/**
 * export-app.js - 宜搭应用导出命令
 *
 * 导出应用的所有表单 Schema，生成可移植的迁移包（yida-export.json）。
 *
 * 用法：openyida export <appType> [output]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  loadCookieData,
  triggerLogin,
  resolveBaseUrl,
  httpGet,
  requestWithAutoLogin,
} = require('../core/utils');
const { t } = require('../core/i18n');

// ── 获取应用下所有表单页面列表 ────────────────────────

async function fetchFormPageList(appType, authRef) {
  const result = await requestWithAutoLogin((auth) => {
    return httpGet(
      auth.baseUrl,
      `/dingtalk/web/${appType}/query/formnav/getFormNavigationListByOrder.json`,
      { _api: 'Nav.queryList', _mock: false },
      auth.cookies
    );
  }, authRef);

  if (!result || result.success === false) {
    throw new Error(t('export.fetch_forms_failed') + ': ' + (result ? result.errorMsg || t('common.unknown_error') : t('common.request_failed')));
  }

  const items = result.content || [];
  const formPages = [];

  for (const node of items) {
    // 跳过系统导航项（待我处理、我已处理等）
    if (node.navType === 'SYSTEM' || !node.formUuid) {
      continue;
    }

    // 提取页面名称（title 是 i18n 对象）
    const titleObj = node.title || node.i18nTitle || {};
    const pageName = titleObj.zh_CN || titleObj.en_US || t('export.unnamed_form');

    formPages.push({
      formUuid: node.formUuid,
      name: pageName,
      formType: node.formType || '',
    });
  }

  return formPages;
}

// ── 获取单个表单 Schema ───────────────────────────────

async function fetchFormSchema(appType, formUuid, authRef) {
  const result = await requestWithAutoLogin((auth) => {
    return httpGet(
      auth.baseUrl,
      `/alibaba/web/${appType}/_view/query/formdesign/getFormSchema.json`,
      { formUuid, schemaVersion: 'V5' },
      auth.cookies
    );
  }, authRef);

  if (!result || result.success === false) {
    return null;
  }

  return result;
}

// ── 主逻辑 ────────────────────────────────────────────

async function run(args) {
  if (args.length < 1) {
    console.error(t('export.usage'));
    console.error(t('export.example1'));
    console.error(t('export.example2'));
    process.exit(1);
  }

  const appType = args[0];
  const outputPath = args[1] || path.join(process.cwd(), 'yida-export.json');

  console.error('='.repeat(50));
  console.error(t('export.title'));
  console.error('='.repeat(50));
  console.error(t('export.app_id', appType));
  console.error(t('export.output_file', outputPath));

  // Step 1: 读取登录态
  console.error(t('common.step_login_label'));
  let cookieData = loadCookieData();
  if (!cookieData) {
    console.error(t('common.no_login_cache'));
    cookieData = triggerLogin();
  }

  const authRef = {
    csrfToken: cookieData.csrf_token,
    cookies: cookieData.cookies,
    baseUrl: resolveBaseUrl(cookieData),
    cookieData,
  };
  console.error(t('common.login_ready', authRef.baseUrl));

  // Step 2: 获取表单页面列表
  console.error(t('export.step_get_forms'));
  let formPages;
  try {
    formPages = await fetchFormPageList(appType, authRef);
  } catch (err) {
    console.error('  ❌ ' + err.message);
    process.exit(1);
  }

  if (formPages.length === 0) {
    console.error(t('export.no_forms'));
    process.exit(1);
  }

  console.error(t('export.forms_found', formPages.length));
  formPages.forEach((page, index) => {
    console.error('     ' + (index + 1) + '. ' + page.name + ' (' + page.formUuid + ')');
  });

  // Step 3: 逐个导出表单 Schema
  console.error(t('export.step_export_schema'));
  const exportedForms = [];
  let successCount = 0;
  let failCount = 0;

  for (const page of formPages) {
    console.error(t('export.exporting', page.name, page.formUuid));
    const schema = await fetchFormSchema(appType, page.formUuid, authRef);
    if (schema) {
      exportedForms.push({
        formUuid: page.formUuid,
        name: page.name,
        formType: page.formType,
        schema,
      });
      console.error(t('export.export_ok'));
      successCount++;
    } else {
      console.error(t('export.export_failed'));
      failCount++;
    }
  }

  // Step 4: 写入导出文件
  console.error(t('export.step_write_file'));
  const exportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    sourceAppType: appType,
    baseUrl: authRef.baseUrl,
    forms: exportedForms,
  };

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');

  // 输出结果
  console.error('\n' + '='.repeat(50));
  console.error(t('export.done'));
  console.error(t('export.success_count', successCount));
  if (failCount > 0) {
    console.error(t('export.fail_count', failCount));
  }
  console.error(t('export.output_file', outputPath));
  console.error('='.repeat(50));

  console.log(
    JSON.stringify({
      success: true,
      appType,
      outputPath,
      totalForms: formPages.length,
      successCount,
      failCount,
    })
  );
}

module.exports = { run };
