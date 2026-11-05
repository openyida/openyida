'use strict';

const fs = require('fs');
const crypto = require('crypto');
const { CliError } = require('./cli-error');
const { t } = require('./i18n');
const { createYidaClient } = require('./yida-client');
const { redactSensitive } = require('./redact');
const { isPermissionGuidanceError } = require('./permission-guidance');

const MAX_BYTES = 64 * 1024;
const ROW_STATES = new Set(['NOT_STARTED', 'SUCCEEDED', 'FAILED', 'UNKNOWN']);

function fail(code, reason, details = {}) {
  throw new CliError(t('mock_records.stopped', reason), { code, details });
}

function invalid(reason) {
  fail('AI_INVALID_ARGUMENT', reason, { retryable: false, sideEffectState: 'none' });
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value, max) {
  return typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max;
}

function validateJson(value, depth = 0) {
  if (depth > 8) { invalid('json_depth'); }
  if (typeof value === 'number' && (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))) {
    invalid('unsafe_number');
  }
  if (Array.isArray(value)) { value.forEach(item => validateJson(item, depth + 1)); }
  else if (object(value)) { Object.values(value).forEach(item => validateJson(item, depth + 1)); }
}

function validateArguments(positionals, options) {
  const allowed = ['records_file', 'request_id', 'expect_form_name', 'expect_form_type', 'schema_version', 'resolve_aliases', 'json'];
  Object.keys(options).forEach(key => { if (!allowed.includes(key)) { invalid(`--${key.replace(/_/g, '-')}`); } });
  if (positionals.length !== 2 || !/^APP_[A-Za-z0-9_-]+$/.test(positionals[0])
    || !/^[A-Za-z0-9_-]{1,128}$/.test(positionals[1])) { invalid('appType/formUuid'); }
  if (options.request_id !== undefined && (typeof options.request_id !== 'string'
    || !/^[A-Za-z0-9_-]{8,64}$/.test(options.request_id))) { invalid('requestId'); }
  ['json', 'resolve_aliases'].forEach(key => {
    if (options[key] !== undefined && options[key] !== true) { invalid(`--${key}`); }
  });
  if (!text(options.records_file, 4096) || !text(options.expect_form_name, 256)) { invalid('records-file/expect-form-name'); }
  if (options.expect_form_type !== undefined && options.expect_form_type !== 'receipt') { invalid('expect-form-type=receipt'); }
  if (options.schema_version !== undefined && (!/^\d+$/.test(String(options.schema_version))
    || !Number.isSafeInteger(Number(options.schema_version)))) { invalid('schema-version'); }
}

function readRecords(file) {
  let value;
  try {
    if (fs.statSync(file).size > MAX_BYTES) { invalid('records-file_size'); }
    value = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (error.isCliError) { throw error; }
    invalid('records-file_json');
  }
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) { invalid('records_count_1_3'); }
  const ids = new Set();
  value.forEach(row => {
    if (!object(row) || Object.keys(row).some(key => !['clientRecordId', 'data'].includes(key))
      || !text(row.clientRecordId, 64) || ids.has(row.clientRecordId) || !object(row.data)
      || Object.keys(row.data).length === 0 || Object.keys(row.data).length > 100) { invalid('records_row'); }
    ids.add(row.clientRecordId);
    validateJson(row.data);
    if (Buffer.byteLength(JSON.stringify(row.data)) > 16 * 1024) { invalid('record_size'); }
  });
  return value;
}

function sanitizeError(error, depth = 0) {
  if (!object(error) || !text(error.code, 128) || typeof error.retryable !== 'boolean'
    || !['NONE', 'UNKNOWN', 'PARTIAL', 'COMMITTED'].includes(error.sideEffectState)) { return null; }
  const result = { code: error.code, retryable: error.retryable, sideEffectState: error.sideEffectState };
  if (text(error.message, 256)) { result.message = redactSensitive(error.message); }
  ['nextAction', 'fieldId', 'fieldPath'].forEach(key => { if (text(error[key], 256)) { result[key] = error[key]; } });
  if (Number.isSafeInteger(error.rowIndex) && error.rowIndex >= 0 && error.rowIndex < 3) { result.rowIndex = error.rowIndex; }
  if (depth < 2 && Array.isArray(error.fieldErrors)) {
    result.fieldErrors = error.fieldErrors.slice(0, 100).map(detail => sanitizeError(detail, depth + 1)).filter(Boolean);
  }
  if (Number.isSafeInteger(error.retryAfterSeconds) && error.retryAfterSeconds >= 0) { result.retryAfterSeconds = error.retryAfterSeconds; }
  return result;
}

function parseResponse(response, requestId, recordIds) {
  const source = response && response.content;
  // 参数绑定前的拒绝可能没有 requestId；Tianshu 将 null 字符串字段序列化为空串。
  const rejectedWithoutRequestId = source?.status === 'REJECTED'
    && [null, undefined, ''].includes(source.requestId);
  if (!response || typeof response.success !== 'boolean' || !object(source)
    || (source.requestId !== requestId && !rejectedWithoutRequestId)
    || !['COMPLETED', 'UNKNOWN', 'REJECTED'].includes(source.status)) { return null; }
  const result = { requestId, status: source.status, readbackVerified: false, results: [] };
  const traceId = source.traceId || response.traceId;
  if (text(traceId, 256)) { result.traceId = traceId; }
  if (source.status === 'REJECTED') {
    const error = sanitizeError(source.error);
    if (response.success !== false || !error || error.sideEffectState !== 'NONE' || response.errorCode !== error.code) { return null; }
    return { success: false, errorCode: error.code, content: { ...result, error,
      createdCount: 0, failedCount: 0, unknownCount: 0, notStartedCount: recordIds.length,
      results: recordIds.map(clientRecordId => ({ clientRecordId, status: 'NOT_STARTED' })),
    } };
  }
  if (response.success !== true || !Array.isArray(source.results) || source.results.length !== recordIds.length) { return null; }
  const counts = { SUCCEEDED: 0, FAILED: 0, UNKNOWN: 0, NOT_STARTED: 0 };
  for (let index = 0; index < source.results.length; index++) {
    const row = source.results[index];
    if (!object(row) || row.clientRecordId !== recordIds[index] || !ROW_STATES.has(row.status)) { return null; }
    counts[row.status]++;
    const clean = { clientRecordId: row.clientRecordId, status: row.status };
    if (row.status === 'SUCCEEDED') {
      if (typeof row.formInstId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(row.formInstId)) { return null; }
      clean.formInstId = row.formInstId;
    }
    const error = sanitizeError(row.error);
    if (error) { clean.error = error; }
    result.results.push(clean);
  }
  const mapping = { createdCount: 'SUCCEEDED', failedCount: 'FAILED', unknownCount: 'UNKNOWN', notStartedCount: 'NOT_STARTED' };
  for (const [key, state] of Object.entries(mapping)) {
    if (source[key] !== counts[state]) { return null; }
    result[key] = counts[state];
  }
  if ((source.status === 'COMPLETED' && counts.UNKNOWN) || (source.status === 'UNKNOWN' && !counts.UNKNOWN)) { return null; }
  return { success: true, content: result };
}

function present(response, appType, formUuid) {
  const content = response.content;
  const created = content.results.find(row => row.status === 'SUCCEEDED');
  const readbackCommand = created
    ? `openyida data get form ${appType} --form-uuid ${formUuid} --inst-id ${created.formInstId} --json`
    : `openyida data query form ${appType} ${formUuid} --json`;
  const output = { ...response, content: { ...content, readbackCommand } };
  if (!response.success || content.status !== 'COMPLETED' || content.createdCount !== content.results.length) {
    fail(response.errorCode || (content.status === 'UNKNOWN' ? 'AI_MOCK_OUTCOME_UNKNOWN'
      : content.createdCount ? 'AI_MOCK_PARTIAL' : 'AI_MOCK_FAILED'), content.error?.message || response.errorCode || content.status, {
      ...output.content, target: { appType, formUuid },
      partial: content.createdCount > 0, residual: content.createdCount > 0 ? { results: content.results } : undefined,
      retryable: content.error?.retryable === true, retrySafe: false,
      sideEffectState: content.status === 'UNKNOWN' ? 'unknown' : content.createdCount > 0 ? 'partial' : 'none',
      nextAction: content.error?.nextAction || (content.status === 'UNKNOWN' ? 'VERIFY_DATA_DO_NOT_RESUBMIT' : 'INSPECT_RESULTS'),
    });
  }
  console.log(JSON.stringify(output, null, 2));
}

async function mockRecords(positionals, options, session, prepareRecords) {
  const [appType, formUuid] = positionals;
  const records = readRecords(options.records_file);
  const requestId = options.request_id || crypto.randomUUID();
  const payload = { requestId, formUuid, expectedFormName: options.expect_form_name, expectedFormType: 'receipt',
    records: prepareRecords ? await prepareRecords(records) : records,
    ...(options.schema_version !== undefined ? { schemaVersion: Number(options.schema_version) } : {}) };
  if (Buffer.byteLength(JSON.stringify(payload)) > MAX_BYTES) { invalid('payload_size'); }
  let response;
  try {
    response = await createYidaClient({ authRef: session }).postJsonOnce(
      `/dingtalk/web/${appType}/query/aiTool/mockRecords.json`, payload, { timeout: 100000, silentStatus: true });
  } catch (error) {
    if (isPermissionGuidanceError(error)) {
      error.details = { ...error.details, requestId, batchStatus: 'REJECTED', sideEffectState: 'none', retrySafe: false,
        createdCount: 0, failedCount: 0, unknownCount: 0, notStartedCount: records.length,
        results: records.map(row => ({ clientRecordId: row.clientRecordId, status: 'NOT_STARTED' })),
      };
      throw error;
    }
    // A lost response cannot prove whether any row was saved.
  }
  // This endpoint converts downstream save failures into row-level UNKNOWN, so these HTTP
  // authentication markers are confirmed entry rejections. Keep unknown/redirect responses uncertain.
  if (response?.__csrfExpired || (response?.__needLogin && [401, 403].includes(response.__httpStatus))) {
    const forbidden = response.__httpStatus === 403;
    const code = forbidden ? 'AI_FORBIDDEN' : 'AI_UNAUTHORIZED';
    response = { success: false, errorCode: code, content: { requestId, status: 'REJECTED',
      error: { code, retryable: false, sideEffectState: 'NONE', nextAction: 'RESOLVE_PERMISSION',
        message: t(forbidden ? 'permission_guidance.unknown' : 'create_process.login_required') },
    } };
  }
  // The existing entry filter rejects before the controller and uses its legacy envelope.
  if (response?.success === false && response.errorCode === 'TIANSHU_000071') {
    response = { success: false, errorCode: 'AI_RATE_LIMITED', content: { requestId, status: 'REJECTED',
      error: { code: 'AI_RATE_LIMITED', retryable: true, sideEffectState: 'NONE', nextAction: 'WAIT_OR_REDUCE_RATE' },
    } };
  }
  const parsed = parseResponse(response, requestId, records.map(row => row.clientRecordId));
  if (!parsed) {
    return present({ success: true, content: { requestId, status: 'UNKNOWN', createdCount: 0, failedCount: 0,
      unknownCount: records.length, notStartedCount: 0, readbackVerified: false,
      results: records.map(row => ({ clientRecordId: row.clientRecordId, status: 'UNKNOWN' })),
    } }, appType, formUuid);
  }
  present(parsed, appType, formUuid);
}

module.exports = { validateArguments, mockRecords };
