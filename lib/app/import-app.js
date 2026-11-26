/**
 * import-app.js - 宜搭应用导入命令
 *
 * 将 openyida export 生成的迁移包导入到目标宜搭环境，自动重建应用和所有表单页面。
 *
 * 用法：openyida import <file> [name]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const {
  httpGet,
  httpPost,
  requestWithAutoLogin,
} = require('../core/utils');
const { createAuthRef, isTokenAuthRef } = require('../core/yida-client');
const { t } = require('../core/i18n');
const { buildYidaI18n, resolveContentLocale } = require('../core/yida-i18n');
const { banner, step, label, success, info, result, usage, hint } = require('../core/chalk');
const { CliError } = require('../core/cli-error');
const { redactString } = require('../core/redact');
const { throwUsage } = require('../core/command-errors');
const { isPermissionGuidanceError } = require('../core/permission-guidance');
const { getSchemaServerRevision } = require('../core/server-revision');
const { resolveBuilderAiSource } = require('./builder-ai-source');

// ── 创建新应用 ────────────────────────────────────────

async function createApp(appName, authRef) {
  const contentLocale = resolveContentLocale({ baseUrl: authRef.baseUrl });
  const postData = querystring.stringify({
    _csrf_token: authRef.csrfToken,
    appName: JSON.stringify(buildYidaI18n(appName, { en_US: appName, ja_JP: appName })),
    description: JSON.stringify(buildYidaI18n(appName, { en_US: appName, ja_JP: appName })),
    icon: 'xian-yingyong%%#0089FF',
    iconUrl: 'xian-yingyong%%#0089FF',
    colour: 'blue',
    defaultLanguage: contentLocale,
    openExclusive: 'n',
    openPhysicColumn: 'n',
    openIsolationDatabase: 'n',
    openExclusiveUnit: 'n',
    group: 'ALL',
    fromBuilderAi: 'y',
    builderAiSource: resolveBuilderAiSource(),
  });
  const result = await httpPost(authRef.baseUrl, '/query/app/registerApp.json', postData, { projectRoot: authRef.projectRoot });

  if (!result || !result.success || !result.content) {
    throw new Error(t('import.create_app_error') + ': ' + (result ? result.errorMsg || t('common.unknown_error') : t('common.request_failed')));
  }

  const appType = result.content.appType || result.content;
  if (typeof appType !== 'string' || !/^[A-Za-z0-9_-]+$/.test(appType)) { throw invalidPackage('invalid_created_app_id'); }
  return appType;
}

function normalizeImportFormType(formType) {
  const normalized = String(formType || '').trim().toLowerCase();
  if (!normalized || normalized === 'form') {
    return 'receipt';
  }
  return normalized;
}

function buildCreateFormPayload(formTitle, formType = 'receipt') {
  return {
    formType: normalizeImportFormType(formType),
    title: JSON.stringify(buildYidaI18n(formTitle, { en_US: formTitle, ja_JP: formTitle })),
  };
}

function buildCreateFormPostData(formTitle, formType = 'receipt') {
  return querystring.stringify(buildCreateFormPayload(formTitle, formType));
}

// ── 创建空白表单/页面/报表 ──────────────────────────────

async function createBlankForm(appType, formTitle, authRef, formType = 'receipt') {
  const postData = querystring.stringify({
    _csrf_token: authRef.csrfToken,
    ...buildCreateFormPayload(formTitle, formType),
  });
  const result = await httpPost(
    authRef.baseUrl,
    `/dingtalk/web/${appType}/query/formdesign/saveFormSchemaInfo.json`,
    postData,
    { projectRoot: authRef.projectRoot }
  );

  if (!result || !result.success || !result.content) {
    throw new Error(t('import.create_form_error') + ': ' + (result ? result.errorMsg || t('common.unknown_error') : t('common.request_failed')));
  }

  const content = result.content;
  const formUuid = content.formUuid || content;
  if (typeof formUuid !== 'string' || !/^[A-Za-z0-9_-]+$/.test(formUuid)) { throw invalidPackage('invalid_created_form_id'); }
  return formUuid;
}

async function fetchFormSchema(appType, formUuid, authRef) {
  return requestWithAutoLogin((auth) => httpGet(
    auth.baseUrl,
    `/alibaba/web/${appType}/_view/query/formdesign/getFormSchema.json`,
    { formUuid, schemaVersion: 'V5' },
    { projectRoot: auth.projectRoot }
  ), authRef);
}

// ── 保存表单 Schema ───────────────────────────────────

async function saveFormSchema(appType, formUuid, schema, authRef, formType = 'receipt', serverRevision) {
  const tokenReady = isTokenAuthRef(authRef);
  if (!authRef || !authRef.baseUrl || !tokenReady) {
    const err = new Error('Import schema save requires an authenticated request context.');
    err.code = 'IMPORT_SCHEMA_WRITE_PRECHECK_FAILED';
    throw err;
  }
  if (!schema || typeof schema !== 'object' || !Array.isArray(schema.pages)) {
    const err = new Error('Imported schema content must include a pages array before writing.');
    err.code = 'SCHEMA_REMOTE_READ_FAILED';
    throw err;
  }
  if (!Number.isFinite(serverRevision) || serverRevision < 0) {
    const err = new Error('Imported schema revision is missing or invalid.');
    err.code = 'SCHEMA_REMOTE_READ_FAILED';
    throw err;
  }

  const payload = {
    appType,
    formUuid,
    content: JSON.stringify(schema),
    schemaVersion: 'V5',
    gmtModified: serverRevision,
  };
  if (normalizeImportFormType(formType) === 'report') {
    payload.importSchema = 'true';
  }

  const postData = querystring.stringify(Object.assign(
    {},
    authRef.csrfToken ? { _csrf_token: authRef.csrfToken } : {},
    payload
  ));
  const authOptions = { projectRoot: authRef.projectRoot };
  return httpPost(
    authRef.baseUrl,
    `/alibaba/web/${appType}/_view/query/formdesign/saveFormSchema.json`,
    postData,
    authOptions
  );
}

// ── 适配 Schema 中的应用 / 表单标识符 ─────────────────
//
// 导入时需要把 Schema 里所有对旧 appType / formUuid 的引用（页面 id、组件
// props.appType、actions.source、SerialNumberField 公式等）重映射为新值。
//
// 按完整映射一次替换，避免替换级联；保留 label 等文案与字段标识。
// 表达式中的标识符仍采用边界匹配，兼容已有迁移包。

function invalidPackage(reason, details = {}) {
  return new CliError(t('issue_fixes.invalid_import'), { code: 'IMPORT_INVALID_PACKAGE', details: { reason, ...details } });
}

function adaptSchemaIdentifiers(schema, oldAppType, newAppType, oldFormUuid, newFormUuid, aliases = new Map()) {
  const forms = oldFormUuid instanceof Map ? oldFormUuid : new Map([[oldFormUuid, newFormUuid]]);
  const replacements = new Map([[oldAppType, newAppType], ...forms]);
  // One pass prevents a newly allocated ID from being substituted a second time.
  const pattern = new RegExp(`(?<![A-Za-z0-9_-])(?:${[...replacements.keys()].map(escapeRegExp).join('|')})(?![A-Za-z0-9_-])`, 'g');
  const literalKeys = new Set(['label', 'title', 'description', 'placeholder', 'help', 'fieldId', 'mainFieldId']);
  function adapt(value) {
    if (typeof value === 'string') { return value.replace(pattern, match => replacements.get(match)); }
    if (Array.isArray(value)) { return value.map(adapt); }
    if (!value || typeof value !== 'object') { return value; }
    // Explicit external references belong to a different application.
    if (value.formUuid && value.appType && value.appType !== oldAppType && !Object.hasOwn(value, 'formAlias')) { return value; }
    if (value.formUuid && !value.formAlias && !forms.has(value.formUuid)) {
      throw invalidPackage('unknown_form_reference', { formUuid: value.formUuid });
    }
    const copy = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, literalKeys.has(key) ? item : adapt(item)]));
    if (Object.hasOwn(value, 'formAlias')) {
      const target = aliases.get(value.formAlias);
      if (!target || !forms.has(target)) { throw invalidPackage('unknown_form_alias', { alias: value.formAlias }); }
      if (value.formUuid && value.formUuid !== target && value.formUuid !== forms.get(target)) {
        throw invalidPackage('conflicting_form_alias', { alias: value.formAlias });
      }
      if (value.appType && value.appType !== oldAppType) { throw invalidPackage('external_form_alias'); }
      copy.appType = newAppType;
      copy.formUuid = forms.get(target);
      delete copy.formAlias;
    }
    return copy;
  }
  return adapt(schema);
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── 从 Schema 中提取表单 Schema 内容 ─────────────────
//
// getFormSchema 接口返回的结构可能是 { content: {...} } 或直接是 schema 对象。

function extractSchemaContent(schemaResult) {
  if (!schemaResult || schemaResult.success === false) { return null; }
  let schema = schemaResult.content || schemaResult;
  if (typeof schema === 'string') {
    try { schema = JSON.parse(schema); } catch { return null; }
  }
  return schema && Array.isArray(schema.pages) ? schema : null;
}

function preflightPackage(data) {
  if (!data || typeof data.sourceAppType !== 'string' || !/^[A-Za-z0-9_-]+$/.test(data.sourceAppType)
    || !Array.isArray(data.forms) || !data.forms.length) { throw invalidPackage('invalid_structure'); }
  const forms = new Map();
  const aliases = new Map();
  for (const form of data.forms) {
    if (!form || typeof form.formUuid !== 'string' || !/^[A-Za-z0-9_-]+$/.test(form.formUuid) || forms.has(form.formUuid)) {
      throw invalidPackage('invalid_or_duplicate_form_uuid');
    }
    if (!extractSchemaContent(form.schema)) { throw invalidPackage('invalid_schema', { formUuid: form.formUuid }); }
    forms.set(form.formUuid, form.formUuid);
    if (form.alias !== undefined) {
      if (typeof form.alias !== 'string' || !/^[A-Za-z][A-Za-z0-9_.-]*$/.test(form.alias) || aliases.has(form.alias)) {
        throw invalidPackage('invalid_or_duplicate_alias');
      }
      aliases.set(form.alias, form.formUuid);
    }
  }
  for (const form of data.forms) {
    adaptSchemaIdentifiers(extractSchemaContent(form.schema), data.sourceAppType, data.sourceAppType, forms, undefined, aliases);
  }
  return aliases;
}

function verifyImportedReferences(expected, actual) {
  if (!actual || !Array.isArray(actual.pages)) { throw new Error('IMPORT_SCHEMA_READBACK_FAILED'); }
  const keys = new Set(['id', 'appType', 'formUuid', 'mainFieldId', 'fieldId']);
  function compare(left, right) {
    if (!left || typeof left !== 'object') { return; }
    for (const [key, value] of Object.entries(left)) {
      if (keys.has(key) && typeof value === 'string' && value !== right?.[key]) {
        throw new Error('IMPORT_REFERENCE_READBACK_MISMATCH');
      }
      compare(value, right?.[key]);
    }
  }
  compare(expected, actual);
}

// ── 主逻辑 ────────────────────────────────────────────

async function run(args) {
  args = args || [];
  if (args.length < 1) {
    usage(t('import.usage'));
    hint(t('import.example1'));
    hint(t('import.example2'));
    throwUsage(t('import.usage'), `${t('import.example1')}\n${t('import.example2')}`);
  }

  const exportFilePath = path.resolve(args[0]);
  const targetAppName = args[1] || null;

  banner(t('import.title'));
  label('File:', exportFilePath);

  step(1, t('import.step_read_file'));
  if (!fs.existsSync(exportFilePath)) {
    throw new CliError(t('import.file_not_found', exportFilePath), { code: 'IMPORT_FILE_NOT_FOUND' });
  }

  let exportData;
  try {
    exportData = JSON.parse(fs.readFileSync(exportFilePath, 'utf-8'));
  } catch (err) {
    throw invalidPackage('invalid_json');
  }

  const aliases = preflightPackage(exportData);
  const { sourceAppType, forms } = exportData;
  const reportPath = path.join(process.cwd(), 'yida-migration-report.json');
  if (fs.existsSync(reportPath)) {
    let previous;
    try { previous = JSON.parse(fs.readFileSync(reportPath, 'utf8')); } catch { previous = null; }
    const legacyComplete = previous && previous.status === undefined && Array.isArray(previous.forms)
      && previous.forms.length > 0 && previous.forms.every(form => form.status === 'success');
    if (!previous || (previous.status !== 'complete' && !legacyComplete)) {
      throw new CliError(t('issue_fixes.partial_import'), { code: 'IMPORT_RECOVERY_REQUIRED', details: { reportPath, retrySafe: false } });
    }
  }

  const appName = targetAppName || (sourceAppType + t('import.migration_suffix'));
  success(t('import.read_ok', forms.length));
  label('Source App:', sourceAppType);
  label('Target Name:', appName);

  step(2, t('common.step_login_label'));
  const authRef = createAuthRef();
  success(t('common.login_ready', authRef.baseUrl));

  const migrationReport = {
    version: '1.0',
    migratedAt: new Date().toISOString(),
    sourceAppType,
    targetAppType: null,
    targetAppName: appName,
    baseUrl: authRef.baseUrl,
    status: 'app_create_pending',
    forms: forms.map(form => ({ oldFormUuid: form.formUuid, newFormUuid: null, alias: form.alias,
      name: form.name, formType: normalizeImportFormType(form.formType), status: 'pending' })),
  };
  const persist = () => {
    fs.writeFileSync(reportPath + '.tmp', JSON.stringify(migrationReport, null, 2), 'utf-8');
    fs.renameSync(reportPath + '.tmp', reportPath);
  };
  persist();
  step(3, t('import.step_create_app'));
  let newAppType;
  try { newAppType = await createApp(appName, authRef); }
  catch (err) {
    migrationReport.status = 'app_create_unknown';
    migrationReport.errorCode = err.code || 'UNEXPECTED_ERROR';
    migrationReport.error = redactString(String(err.message || '')).slice(0, 500);
    persist();
    if (isPermissionGuidanceError(err)) { throw err; }
    throw new CliError(t('issue_fixes.partial_import'), { code: 'IMPORT_PARTIAL_FAILURE', details: {
      reportPath, stage: 'create_app', retrySafe: false, sideEffectState: 'unknown', causeCode: err.code || 'UNEXPECTED_ERROR',
    } });
  }
  migrationReport.targetAppType = newAppType;
  migrationReport.status = 'creating';
  persist();
  success(t('import.app_created', newAppType));
  step(4, t('import.step_rebuild_forms'));
  const abort = (entry, err) => {
    entry.errorCode = err.code || (/^[A-Z_]+$/.test(err.message) ? err.message : 'UNEXPECTED_ERROR');
    entry.error = redactString(String(err.message || '')).slice(0, 500);
    migrationReport.status = 'partial';
    persist();
    if (isPermissionGuidanceError(err)) {
      err.details = { ...err.details, targetAppType: newAppType, reportPath, partial: true, retrySafe: false };
      throw err;
    }
    throw new CliError(t('issue_fixes.partial_import'), { code: 'IMPORT_PARTIAL_FAILURE', details: {
      targetAppType: newAppType, reportPath, partial: true, retrySafe: false, sideEffectState: 'unknown',
      failedFormUuid: entry.oldFormUuid, status: entry.status, causeCode: entry.errorCode,
    } });
  };
  persist();
  // Allocate every target before adapting any Schema, including cyclic references.
  const mapping = new Map();
  for (const entry of migrationReport.forms) {
    entry.status = 'create_pending';
    persist();
    try {
      entry.newFormUuid = await createBlankForm(newAppType, entry.name, authRef, entry.formType);
      mapping.set(entry.oldFormUuid, entry.newFormUuid);
      entry.status = 'created';
    } catch (err) {
      entry.status = 'create_unknown';
      abort(entry, err);
    }
    persist();
  }
  migrationReport.status = 'saving';
  for (let index = 0; index < forms.length; index++) {
    const entry = migrationReport.forms[index];
    const adapted = adaptSchemaIdentifiers(extractSchemaContent(forms[index].schema), sourceAppType, newAppType, mapping, undefined, aliases);
    info(t('import.migrating', entry.name, entry.oldFormUuid));
    let writeAttempted = false;
    try {
      const target = await fetchFormSchema(newAppType, entry.newFormUuid, authRef);
      const revision = getSchemaServerRevision(target);
      if (!target || target.success === false || !Number.isFinite(revision)) { throw new Error('SCHEMA_REMOTE_READ_FAILED'); }
      entry.status = 'save_pending';
      persist();
      writeAttempted = true;
      const saved = await saveFormSchema(newAppType, entry.newFormUuid, adapted, authRef, entry.formType, revision);
      if (!saved || !saved.success) {
        entry.status = 'save_failed';
        throw new CliError(saved?.errorMsg || t('common.request_failed'), { code: 'SCHEMA_WRITE_REJECTED' });
      }
      entry.status = 'verify_pending';
      persist();
      const readback = await fetchFormSchema(newAppType, entry.newFormUuid, authRef);
      verifyImportedReferences(adapted, extractSchemaContent(readback));
      entry.readbackVerified = true;
      entry.status = 'success';
    } catch (err) {
      if (entry.status === 'verify_pending') { entry.status = 'verify_failed'; }
      else if (entry.status !== 'save_failed') { entry.status = writeAttempted ? 'save_unknown' : 'read_failed'; }
      abort(entry, err);
    }
    persist();
    success(t('import.schema_saved'));
  }
  migrationReport.status = 'complete';
  persist();
  const successCount = forms.length;
  const failCount = 0;
  success(t('import.report_written', reportPath));

  // 输出结果
  const appUrl = `${authRef.baseUrl}/${newAppType}/admin`;
  const resultDetails = [
    ['App ID', newAppType],
    ['App Name', appName],
    ['URL', appUrl],
    ['Success', String(successCount)],
    ['Report', reportPath],
  ];
  if (failCount > 0) {
    resultDetails.push(['Failed', String(failCount)]);
  }
  result(failCount === 0, t('import.done'), resultDetails);

  console.log(
    JSON.stringify({
      success: true,
      sourceAppType,
      targetAppType: newAppType,
      targetAppName: appName,
      appUrl,
      reportPath,
      totalForms: forms.length,
      successCount,
      failCount,
    })
  );
}

module.exports = {
  run,
  __test__: {
    normalizeImportFormType,
    buildCreateFormPayload,
    buildCreateFormPostData,
    fetchFormSchema,
    saveFormSchema,
    adaptSchemaIdentifiers,
    extractSchemaContent,
    preflightPackage,
  },
};
