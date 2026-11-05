'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { CliError } = require('./cli-error');
const { t } = require('./i18n');
const { prepareWriteData, supportsWriteComponent } = require('../app/form-data-contract');

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const USAGE = 'openyida data seed <form|process> <appType> <formUuid> [--process-code <code>] --expect-form-name <name> --records-file <records.json> [--timezone +08:00] [--resolve-aliases] [--check] [--json]';

function fail(code, details = {}) {
  throw new CliError(t('data_seed.failed', code), {
    code, usage: USAGE, details: { retryable: false, retrySafe: true, sideEffectState: 'none', ...details },
  });
}

function offsetMinutes(value) {
  if (value === 'Z') {return 0;}
  const match = typeof value === 'string' && /^([+-])(\d{2}):(\d{2})$/.exec(value);
  if (!match || Number(match[2]) > 14 || Number(match[3]) > 59
    || Number(match[2]) === 14 && Number(match[3]) !== 0) {return null;}
  return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]));
}

function validateArguments(positionals, options, resource = 'form') {
  const allowed = ['expect_form_name', 'records_file', 'timezone', 'resolve_aliases', 'check', 'json'];
  if (resource === 'process') {allowed.push('process_code');}
  if (positionals.length !== 2 || positionals.some(value => !value.trim())
    || resource === 'process' && (typeof options.process_code !== 'string' || !options.process_code.trim())
    || Object.keys(options).some(key => !allowed.includes(key))
    || ['expect_form_name', 'records_file'].some(key => typeof options[key] !== 'string' || !options[key].trim())
    || ['resolve_aliases', 'check', 'json'].some(key => options[key] !== undefined && options[key] !== true)
    || offsetMinutes(options.timezone === undefined ? '+08:00' : options.timezone) === null) {
    fail('DATA_SEED_INVALID_ARGUMENTS');
  }
}

function readRecords(file) {
  let records;
  try {records = JSON.parse(fs.readFileSync(file, 'utf8'));} catch {fail('DATA_SEED_INVALID_FILE');}
  if (!Array.isArray(records) || records.length < 1 || records.length > 30 || !records.every(object)) {
    fail('DATA_SEED_INVALID_RECORDS', { expected: 'array_of_1_to_30_objects' });
  }
  return records;
}

function dateValue(value, timezone, location, issues) {
  if (value === null || value === '') {return value;}
  if (typeof value === 'number' && Number.isInteger(value) && Math.abs(value) <= 8640000000000000) {return value;}
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(value);
  if (match) {
    const parts = [Number(match[1]), Number(match[2]) - 1, Number(match[3]),
      Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0), Number((match[7] || '').padEnd(3, '0'))];
    const date = new Date(0);
    date.setUTCFullYear(parts[0], parts[1], parts[2]);
    date.setUTCHours(parts[3], parts[4], parts[5], parts[6]);
    const observed = [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(),
      date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()];
    const offset = offsetMinutes(match[8] || timezone);
    if (offset !== null && parts.every((part, index) => part === observed[index])) {
      return date.getTime() - offset * 60000;
    }
  }
  issues.push({ path: location, code: 'INVALID_DATE', expected: 'milliseconds_or_ISO_date' });
  return value;
}

function canOmitUnsupportedField(field, contract) {
  const props = contract.props[field.fieldId];
  if (!props || props.required !== undefined && props.required !== false) {return false;}
  // A missing or executable validation definition is not proof of optionality.
  return Array.isArray(props.validation) && props.validation.length === 0
    && (!props.validations || Array.isArray(props.validations) && props.validations.length === 0);
}

function prepareRecords(records, contract, options, skippedFields = []) {
  const issues = [];
  const timezone = options.timezone || '+08:00';
  const visit = (input, parent = null, prefix = '$', recordIndex = 0) => {
    if (!object(input)) {return input;}
    const output = Object.create(null);
    const seen = new Set();
    const fields = contract.fields.filter(field => field.parentFieldId === parent);
    for (const [key, value] of Object.entries(input)) {
      const exact = fields.filter(field => field.fieldId === key);
      const matches = exact.length ? exact : options.resolve_aliases ? fields.filter(field => field.alias === key) : [];
      const field = matches.length === 1 ? matches[0] : null;
      const location = `${prefix}[${JSON.stringify(key)}]`;
      if (field && seen.has(field.fieldId)) {
        issues.push({ path: location, recordIndex, fieldId: field.fieldId, code: 'DUPLICATE_FIELD_REFERENCE' });
        continue;
      }
      if (field) {seen.add(field.fieldId);}
      if (field && !supportsWriteComponent(field.componentType, contract.props[field.fieldId]) && canOmitUnsupportedField(field, contract)) {
        skippedFields.push({ recordIndex, path: location, fieldId: field.fieldId, componentType: field.componentType,
          label: field.label, parentFieldId: parent, reason: field.componentType === 'SerialNumberField'
            ? 'server_generated' : 'unsupported_optional_component' });
      } else if (field?.componentType === 'TableField' && Array.isArray(value)) {
        output[key] = value.map((row, index) => visit(row, field.fieldId, `${location}[${index}]`, recordIndex));
        output[key].forEach((row, index) => {
          if (object(row) && Object.keys(row).length === 0 && Object.keys(value[index]).length > 0) {
            issues.push({ path: `${location}[${index}]`, recordIndex, code: 'NO_WRITABLE_SUBFORM_FIELDS' });
          }
        });
      } else if (field?.componentType === 'DateField') {
        output[key] = dateValue(value, timezone, location, issues);
      } else if (field?.componentType === 'CascadeDateField' && Array.isArray(value)) {
        output[key] = value.map((endpoint, index) => dateValue(endpoint, timezone, `${location}[${index}]`, issues));
        if (output[key].length === 2 && output[key].every(endpoint => typeof endpoint === 'number')
          && output[key][0] > output[key][1]) {issues.push({ path: location, code: 'REVERSED_DATE_RANGE' });}
      } else {output[key] = value;}
    }
    return output;
  };
  const prepared = records.map((record, index) => {
    const before = issues.length;
    const skippedBefore = skippedFields.length;
    const converted = visit(record, null, `$[${index}]`, index);
    if (!Object.keys(converted).length && skippedFields.length > skippedBefore) {return converted;}
    try {return prepareWriteData(converted, contract, !!options.resolve_aliases);} catch (error) {
      if (!Array.isArray(error.details?.issues)) {throw error;}
      issues.push(...error.details.issues.map(issue => ({ ...issue, path: `$[${index}]${issue.path.slice(1)}` })));
      return null;
    } finally {
      for (const issue of issues.slice(before)) {issue.recordIndex = index;}
    }
  });
  if (issues.length) {fail('DATA_SEED_PREFLIGHT_FAILED', { issues, schemaHash: contract.schemaHash, skippedFields });}
  if (prepared.some(record => !Object.keys(record).length) && !prepared.every(record => !Object.keys(record).length)) {
    fail('DATA_SEED_PREFLIGHT_FAILED', { issues: prepared.flatMap((record, recordIndex) => Object.keys(record).length
      ? [] : [{ path: `$[${recordIndex}]`, recordIndex, code: 'NO_WRITABLE_FIELDS' }]), schemaHash: contract.schemaHash, skippedFields });
  }
  return prepared;
}

function saveReceipt(file, receipt) {
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) {fs.unlinkSync(temporary);}
  }
}

async function run({ appType, formUuid, options, identity, resource = 'form', prepare, normalize = data => data, write, verify }) {
  const idKey = resource === 'process' ? 'processInstanceId' : 'formInstId';
  const idsKey = resource === 'process' ? 'processInstanceIds' : 'formInstIds';
  const source = path.resolve(options.records_file);
  const records = readRecords(source);
  const contract = await prepare();
  const file = `${source}.seed-receipt.json`;
  const lock = `${file}.lock`;
  const skippedFields = [];
  let prepared;
  try {prepared = prepareRecords(records, contract, options, skippedFields).map(normalize);} catch (error) {
    if (error.code === 'DATA_SEED_PREFLIGHT_FAILED') {
      const unsupportedOnly = error.details.issues.every(issue => issue.code === 'UNSUPPORTED_COMPONENT');
      const unattempted = !fs.existsSync(file) && !fs.existsSync(lock);
      const fallbackAllowed = resource === 'form' && unsupportedOnly && unattempted && !options.check;
      error.details.retrySameInput = false;
      error.details.nextStep = !unattempted ? 'inspect_existing_receipt_do_not_create'
        : fallbackAllowed ? 'use_single_record_create_with_known_format_and_readback'
          : 'repair_supported_fields_or_skip_seed';
      error.details.fallback = { allowed: fallbackAllowed,
        command: `data create ${resource}`, requiresKnownFormat: true, singleRecordObject: true, readbackRequired: true };
    }
    throw error;
  }
  const target = { appType, formUuid, formName: options.expect_form_name,
    formType: resource === 'process' ? 'process' : 'receipt',
    ...(resource === 'process' ? { processCode: options.process_code } : {}) };
  const coverage = { skippedFields, requestedFieldsVerified: skippedFields.length === 0,
    verificationScope: 'submitted_fields' };
  if (options.check) {
    return { success: true, checked: true, mutationPerformed: false, target, count: prepared.length,
      schemaHash: contract.schemaHash, ...coverage, records: prepared };
  }
  if (prepared.every(record => !Object.keys(record).length)) {
    if (fs.existsSync(file) || fs.existsSync(lock)) {fail('DATA_SEED_RECEIPT_MISMATCH', { receiptFile: file });}
    return { success: true, skipped: true, mutationPerformed: false, readbackVerified: false,
      target, count: prepared.length, completed: 0, items: [], [idsKey]: [], ...coverage,
      reason: 'no_supported_business_fields', nextStep: 'continue_without_seed_records' };
  }
  let handle;
  try {handle = fs.openSync(lock, 'wx', 0o600);} catch {fail('DATA_SEED_LOCKED', { receiptFile: file, lockFile: lock });}
  let receipt;
  let mutationPerformed = false;
  const summary = () => ({ target, receiptFile: file, schemaHash: contract.schemaHash, count: prepared.length, ...coverage,
    completed: receipt.items.filter(item => item.status === 'verified').length, items: receipt.items,
    mutationPerformed });
  try {
    const inputHash = digest({ records, target, identity, schemaHash: contract.schemaHash,
      timezone: options.timezone || '+08:00', resolveAliases: !!options.resolve_aliases,
      ...(skippedFields.length ? { omittedFields: skippedFields } : {}) });
    if (fs.existsSync(file)) {
      try {receipt = JSON.parse(fs.readFileSync(file, 'utf8'));} catch {fail('DATA_SEED_RECEIPT_INVALID', { receiptFile: file });}
      if (!object(receipt) || receipt.version !== 1 || receipt.inputHash !== inputHash || !Array.isArray(receipt.items)
        || receipt.items.length !== prepared.length || receipt.items.some((item, index) => !object(item)
          || item.recordIndex !== index || !['ready', 'pending', 'verified'].includes(item.status)
          || item[idKey] !== undefined && (typeof item[idKey] !== 'string' || !item[idKey].trim())
          || item.status === 'verified' && !item[idKey]
          || item.status === 'ready' && item[idKey] !== undefined)
        || new Set(receipt.items.filter(item => item[idKey]).map(item => item[idKey])).size
          !== receipt.items.filter(item => item[idKey]).length) {
        fail('DATA_SEED_RECEIPT_MISMATCH', { receiptFile: file });
      }
    } else {
      receipt = { version: 1, inputHash, target, schemaHash: contract.schemaHash, ...coverage,
        items: prepared.map((_, recordIndex) => ({ recordIndex, status: 'ready' })) };
      saveReceipt(file, receipt);
    }

    for (const item of receipt.items) {
      if (item.status === 'verified') {continue;}
      try {
        if (item.status === 'pending' && !item[idKey]) {
          fail('DATA_SEED_WRITE_UNKNOWN', { partial: item, retrySafe: false, sideEffectState: 'unknown' });
        }
        if (item.status === 'ready') {
          item.status = 'pending';
          saveReceipt(file, receipt);
          mutationPerformed = true;
          const result = await write(prepared[item.recordIndex]);
          if (result.idVerified && result[idKey]) {item[idKey] = result[idKey];}
          if (!item[idKey] && result.candidateIds?.length) {item.candidateIds = result.candidateIds;}
          saveReceipt(file, receipt);
          if (!item[idKey]) {fail('DATA_SEED_WRITE_UNKNOWN', { retrySafe: false, sideEffectState: 'unknown' });}
        }
        if (receipt.items.some(other => other !== item && other[idKey] === item[idKey])) {
          fail('DATA_SEED_DUPLICATE_INSTANCE');
        }
        await verify(item[idKey], prepared[item.recordIndex], contract);
        item.status = 'verified';
        delete item.errorCode;
        saveReceipt(file, receipt);
      } catch (error) {
        item.errorCode = error.code || 'DATA_SEED_WRITE_UNKNOWN';
        // Pending remains durable even if saving diagnostic metadata fails.
        try {saveReceipt(file, receipt);} catch { /* The previous receipt already blocks replay. */ }
        fail('DATA_SEED_INCOMPLETE', { ...summary(), failedIndex: item.recordIndex,
          causeCode: item.errorCode, issues: error.details?.issues, partial: { items: receipt.items },
          mutationAccepted: receipt.items.some(entry => !!entry[idKey]),
          readbackVerified: false, readbackAllowed: !!item[idKey],
          retrySafe: false, sideEffectState: item[idKey] ? 'committed' : 'unknown',
          nextStep: item[idKey] ? 'readback_existing_instance_do_not_repeat_write' : 'inspect_unknown_write_do_not_repeat_create' });
      }
    }
    return { success: true, readbackVerified: true, ...summary(),
      [idsKey]: receipt.items.map(item => item[idKey]) };
  } finally {
    fs.closeSync(handle);
    fs.unlinkSync(lock);
  }
}

module.exports = { run, validateArguments, prepareRecords };
