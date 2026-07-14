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
  httpPost,
  requestWithAutoLogin,
} = require('../core/utils');
const { createAuthRef } = require('../core/yida-client');
const { t } = require('../core/i18n');
const { buildYidaI18n, resolveContentLocale } = require('../core/yida-i18n');
const { banner, step, label, success, fail, warn, info, error, result, usage, hint } = require('../core/chalk');

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
  });

  const result = await requestWithAutoLogin((auth) => {
    return httpPost(auth.baseUrl, '/query/app/registerApp.json', postData);
  }, authRef);

  if (!result || !result.success || !result.content) {
    throw new Error(t('import.create_app_error') + ': ' + (result ? result.errorMsg || t('common.unknown_error') : t('common.request_failed')));
  }

  return result.content; // appType
}

function normalizeImportFormType(formType) {
  const normalized = String(formType || '').trim().toLowerCase();
  if (!normalized || normalized === 'form') {
    return 'receipt';
  }
  return normalized;
}

function buildCreateFormPostData(csrfToken, formTitle, formType = 'receipt') {
  return querystring.stringify({
    _csrf_token: csrfToken,
    formType: normalizeImportFormType(formType),
    title: JSON.stringify(buildYidaI18n(formTitle, { en_US: formTitle, ja_JP: formTitle })),
  });
}

// ── 创建空白表单/页面/报表 ──────────────────────────────

async function createBlankForm(appType, formTitle, authRef, formType = 'receipt') {
  const postData = buildCreateFormPostData(authRef.csrfToken, formTitle, formType);
  const result = await requestWithAutoLogin((auth) => {
    return httpPost(
      auth.baseUrl,
      `/dingtalk/web/${appType}/query/formdesign/saveFormSchemaInfo.json`,
      postData
    );
  }, authRef);

  if (!result || !result.success || !result.content) {
    throw new Error(t('import.create_form_error') + ': ' + (result ? result.errorMsg || t('common.unknown_error') : t('common.request_failed')));
  }

  const content = result.content;
  return content.formUuid || content;
}

// ── 保存表单 Schema ───────────────────────────────────

async function saveFormSchema(appType, formUuid, schema, authRef, formType = 'receipt') {
  const payload = {
    _csrf_token: authRef.csrfToken,
    appType,
    formUuid,
    content: JSON.stringify(schema),
    schemaVersion: 'V5',
  };
  if (normalizeImportFormType(formType) === 'report') {
    payload.importSchema = 'true';
  }
  const postData = querystring.stringify(payload);

  const result = await requestWithAutoLogin((auth) => {
    return httpPost(
      auth.baseUrl,
      `/alibaba/web/${appType}/_view/query/formdesign/saveFormSchema.json`,
      postData
    );
  }, authRef);

  return result;
}

// ── 更新表单配置（发布表单）─────────────────────────────

async function updateFormConfig(appType, formUuid, authRef) {
  const postData = querystring.stringify({
    _csrf_token: authRef.csrfToken,
    appType,
    formUuid,
    setting: JSON.stringify({ MINI_RESOURCE: 0 }),
    version: 1,
  });

  const result = await requestWithAutoLogin((auth) => {
    return httpPost(
      auth.baseUrl,
      `/dingtalk/web/${appType}/query/formdesign/updateFormConfig.json`,
      postData
    );
  }, authRef);

  return result;
}

// ── 适配 Schema 中的应用 / 表单标识符 ─────────────────
//
// 导入时需要把 Schema 里所有对旧 appType / formUuid 的引用（页面 id、组件
// props.appType、actions.source、SerialNumberField 公式等）重映射为新值。
//
// 早期实现对整个 Schema JSON 做无约束的全局字符串替换，存在数据腐蚀风险：
// 若某个字段的文本值、label、备注恰好包含旧 appType / formUuid 子串，会被
// 误替换。这里改为「标识符边界」约束替换——appType / formUuid 都是由字母、
// 数字、下划线、连字符构成的标识符，只有当匹配片段两侧不是同类标识符字符时
// 才替换，从而避免误伤包含旧标识符子串的普通文本。

function buildIdentifierBoundaryRegExp(identifier) {
  // 标识符字符集：字母、数字、下划线、连字符。
  // 使用 lookbehind / lookahead 保证匹配片段不是更长标识符的一部分。
  return new RegExp(`(?<![A-Za-z0-9_-])${escapeRegExp(identifier)}(?![A-Za-z0-9_-])`, 'g');
}

function adaptSchemaIdentifiers(schema, oldAppType, newAppType, oldFormUuid, newFormUuid) {
  const schemaStr = JSON.stringify(schema);
  const adapted = schemaStr
    .replace(buildIdentifierBoundaryRegExp(oldAppType), newAppType)
    .replace(buildIdentifierBoundaryRegExp(oldFormUuid), newFormUuid);
  return JSON.parse(adapted);
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── 从 Schema 中提取表单 Schema 内容 ─────────────────
//
// getFormSchema 接口返回的结构可能是 { content: {...} } 或直接是 schema 对象。

function extractSchemaContent(schemaResult) {
  if (!schemaResult) {return null;}
  if (schemaResult.content && typeof schemaResult.content === 'object') {
    return schemaResult.content;
  }
  if (schemaResult.pages) {
    return schemaResult;
  }
  return null;
}

// ── 主逻辑 ────────────────────────────────────────────

async function run(args) {
  if (args.length < 1) {
    usage(t('import.usage'));
    hint(t('import.example1'));
    hint(t('import.example2'));
    process.exit(1);
  }

  const exportFilePath = path.resolve(args[0]);
  const targetAppName = args[1] || null;

  banner(t('import.title'));
  label('File:', exportFilePath);

  step(1, t('import.step_read_file'));
  if (!fs.existsSync(exportFilePath)) {
    error(t('import.file_not_found', exportFilePath));
  }

  let exportData;
  try {
    exportData = JSON.parse(fs.readFileSync(exportFilePath, 'utf-8'));
  } catch (err) {
    error(t('import.parse_failed', err.message));
  }

  const { sourceAppType, forms } = exportData;
  if (!sourceAppType || !Array.isArray(forms) || forms.length === 0) {
    error(t('import.invalid_format'));
  }

  const appName = targetAppName || (sourceAppType + t('import.migration_suffix'));
  success(t('import.read_ok', forms.length));
  label('Source App:', sourceAppType);
  label('Target Name:', appName);

  step(2, t('common.step_login_label'));
  const authRef = createAuthRef();
  success(t('common.login_ready', authRef.baseUrl));

  step(3, t('import.step_create_app'));
  let newAppType;
  try {
    newAppType = await createApp(appName, authRef);
  } catch (err) {
    error(err.message);
  }
  success(t('import.app_created', newAppType));

  step(4, t('import.step_rebuild_forms'));
  const migrationReport = {
    version: '1.0',
    migratedAt: new Date().toISOString(),
    sourceAppType,
    targetAppType: newAppType,
    targetAppName: appName,
    baseUrl: authRef.baseUrl,
    forms: [],
  };

  let successCount = 0;
  let failCount = 0;

  for (const form of forms) {
    const { formUuid: oldFormUuid, name: formName, schema: formSchemaResult } = form;
    const formType = normalizeImportFormType(form.formType);
    info(t('import.migrating', formName, oldFormUuid));

    // 4.1 创建空白表单
    let newFormUuid;
    try {
      newFormUuid = await createBlankForm(newAppType, formName, authRef, formType);
      success(t('import.blank_form_created', newFormUuid));
    } catch (err) {
      fail(t('import.create_form_failed', err.message));
      migrationReport.forms.push({
        oldFormUuid,
        newFormUuid: null,
        name: formName,
        formType,
        status: 'failed',
        error: err.message,
      });
      failCount++;
      continue;
    }

    // 4.2 提取并适配 Schema
    const originalSchema = extractSchemaContent(formSchemaResult);
    if (!originalSchema) {
      warn(t('import.schema_empty'));
      migrationReport.forms.push({
        oldFormUuid,
        newFormUuid,
        name: formName,
        formType,
        status: 'skipped',
        error: t('import.schema_empty_msg'),
      });
      failCount++;
      continue;
    }

    // 将 Schema 中所有旧 appType / formUuid 引用重映射为新值（标识符边界约束，避免误伤普通文本）
    const adaptedSchema = adaptSchemaIdentifiers(
      originalSchema,
      sourceAppType,
      newAppType,
      oldFormUuid,
      newFormUuid
    );

    // 4.3 保存 Schema
    const saveResult = await saveFormSchema(newAppType, newFormUuid, adaptedSchema, authRef, formType);
    if (!saveResult || !saveResult.success) {
      const errorMsg = saveResult ? saveResult.errorMsg || t('common.unknown_error') : t('common.request_failed');
      fail(t('import.save_schema_failed', errorMsg));
      migrationReport.forms.push({
        oldFormUuid,
        newFormUuid,
        name: formName,
        formType,
        status: 'failed',
        error: t('import.save_schema_failed', errorMsg),
      });
      failCount++;
      continue;
    }
    success(t('import.schema_saved'));

    // 4.4 更新表单配置
    const configResult = await updateFormConfig(newAppType, newFormUuid, authRef);
    if (!configResult || !configResult.success) {
      const errorMsg = configResult ? configResult.errorMsg || t('common.unknown_error') : t('common.request_failed');
      warn(t('import.config_failed', errorMsg));
    } else {
      success(t('import.config_updated'));
    }

    migrationReport.forms.push({
      oldFormUuid,
      newFormUuid,
      name: formName,
      formType,
      status: 'success',
    });
    successCount++;
  }

  step(5, t('import.step_write_report'));
  const reportPath = path.join(process.cwd(), 'yida-migration-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(migrationReport, null, 2), 'utf-8');
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
  if (failCount > 0) {
    warn(t('import.notice_label'));
    hint(t('import.notice_association'));
    hint(t('import.notice_custom_page'));
  }

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
    buildCreateFormPostData,
    adaptSchemaIdentifiers,
    extractSchemaContent,
  },
};
