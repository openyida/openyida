/**
 * get-schema.js - 宜搭表单 Schema 获取命令
 *
 * 用法：openyida get-schema <appType> <formUuid>
 */

'use strict';

const {
  loadCookieData,
  triggerLogin,
  resolveBaseUrl,
  httpGet,
  requestWithAutoLogin,
} = require('../core/utils');
const { t } = require('../core/i18n');

// 需要在报表 fieldCode 中加 _value 后缀的字段类型
const FIELD_TYPES_NEEDING_VALUE_SUFFIX = new Set([
  'SelectField',
  'EmployeeField',
  'RadioField',
  'CheckboxField',
]);

/**
 * 从 Schema 中提取字段摘要，列出每个字段的真实 fieldId 和报表用 reportFieldCode。
 * @param {object} schemaResult - getFormSchema API 返回结果
 * @returns {Array<{label, componentName, fieldId, reportFieldCode}>}
 */
function extractFieldSummary(schemaResult) {
  const fields = [];
  const pages = schemaResult.content && schemaResult.content.pages;
  if (!pages || pages.length === 0) {
    return fields;
  }

  const FIELD_COMPONENT_NAMES = new Set([
    'TextField', 'TextareaField', 'SelectField', 'DateField', 'NumberField',
    'RadioField', 'CheckboxField', 'EmployeeField', 'PhoneField', 'EmailField',
    'CascadeSelectField', 'ImageField', 'AttachmentField', 'TableField',
  ]);

  function traverse(node) {
    if (!node) {
      return;
    }
    if (FIELD_COMPONENT_NAMES.has(node.componentName)) {
      const props = node.props || {};
      const labelRaw = props.label;
      const label = labelRaw
        ? (typeof labelRaw === 'object' ? (labelRaw.zh_CN || labelRaw.en_US || '') : String(labelRaw))
        : '';
      const fieldId = props.fieldId || '';
      const reportFieldCode = FIELD_TYPES_NEEDING_VALUE_SUFFIX.has(node.componentName)
        ? `${fieldId}_value`
        : fieldId;
      if (fieldId) {
        fields.push({ label, componentName: node.componentName, fieldId, reportFieldCode });
      }
    }
    if (node.children) {
      node.children.forEach(traverse);
    }
  }

  // 遍历所有页面，避免多页面表单遗漏字段
  for (const page of pages) {
    const tree = page.componentsTree && page.componentsTree[0];
    if (tree) {
      traverse(tree);
    }
  }

  return fields;
}

async function run(args) {
  if (args.length < 2) {
    console.error(t('get_schema.usage'));
    console.error(t('get_schema.example'));
    process.exit(1);
  }

  const appType = args[0];
  const formUuid = args[1];

  const SEP = '='.repeat(50);
  console.error(SEP);
  console.error(t('get_schema.title'));
  console.error(SEP);
  console.error(t('get_schema.app_id', appType));
  console.error(t('get_schema.form_uuid', formUuid));

  // Step 1: 读取登录态
  console.error(t('common.step_login', 1));
  let cookieData = loadCookieData();
  if (!cookieData) {
    console.error(t('common.login_no_cache'));
    cookieData = triggerLogin();
  }

  const authRef = {
    csrfToken: cookieData.csrf_token,
    cookies: cookieData.cookies,
    baseUrl: resolveBaseUrl(cookieData),
    cookieData,
  };
  console.error(t('common.login_ready', authRef.baseUrl));

  // Step 2: 获取表单 Schema
  console.error(t('get_schema.step_get'));
  console.error(t('get_schema.sending'));

  const result = await requestWithAutoLogin((auth) => {
    return httpGet(
      auth.baseUrl,
      `/alibaba/web/${appType}/_view/query/formdesign/getFormSchema.json`,
      { formUuid, schemaVersion: 'V5' },
      auth.cookies
    );
  }, authRef);

  // 输出结果
  console.error('\n' + SEP);
  if (result && result.success !== false && !result.__needLogin && !result.__csrfExpired) {
    console.error(t('get_schema.success'));
    console.error(SEP);

    // 提取字段摘要，方便 AI 直接获取正确的 fieldId
    const fieldSummary = extractFieldSummary(result);
    if (fieldSummary.length > 0) {
      console.error('\n📋 字段摘要（报表配置请使用 reportFieldCode）：');
      console.error('─'.repeat(80));
      console.error(
        'label'.padEnd(16) +
        'componentName'.padEnd(20) +
        'fieldId'.padEnd(28) +
        'reportFieldCode'
      );
      console.error('─'.repeat(80));
      for (const field of fieldSummary) {
        console.error(
          field.label.padEnd(16) +
          field.componentName.padEnd(20) +
          field.fieldId.padEnd(28) +
          field.reportFieldCode
        );
      }
      console.error('─'.repeat(80));
      console.error('注：SelectField/EmployeeField 在报表中需加 _value 后缀\n');
    }

    console.log(JSON.stringify(result, null, 2));
  } else {
    const errorMsg = result ? result.errorMsg || t('common.unknown_error') : t('common.request_failed');
    console.error(t('get_schema.failed', errorMsg));
    console.error(SEP);
    process.exit(1);
  }
}

module.exports = { run };
