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
const { CliError } = require('../core/cli-error');
const { createAuthRef, createYidaClient, isAuthRefReady } = require('../core/yida-client');
const { t } = require('../core/i18n');
const { fetchFormPageList } = require('./form-navigation');

// ── 获取单个表单 Schema ───────────────────────────────

async function fetchFormSchema(appType, formUuid, authRef) {
  const result = await createYidaClient({ authRef }).get(
    `/alibaba/web/${appType}/_view/query/formdesign/getFormSchema.json`,
    { formUuid, schemaVersion: 'V5' }
  );

  if (!result || result.success === false) {
    return null;
  }

  return result;
}

function ensureSession() {
  const authRef = createAuthRef();
  if (!isAuthRefReady(authRef)) {
    throw new CliError(t('common.no_login_cache'), {
      code: 'NEED_LOGIN',
    });
  }
  return authRef;
}

// ── 主逻辑 ────────────────────────────────────────────

async function run(args) {
  if (args.length < 1) {
    throw new CliError(`${t('export.usage')}\n${t('export.example1')}\n${t('export.example2')}`, {
      code: 'EXPORT_INVALID_ARGUMENTS',
    });
  }

  const appType = args[0];
  const outputPath = args[1] || path.join(process.cwd(), 'yida-export.json');

  const { c, banner, step, label, info, success: chalkSuccess, fail: chalkFail, warn: chalkWarn, result: chalkResult, listItem } = require('../core/chalk');

  banner(t('export.title'));
  label('App', appType);
  label('Output', outputPath);

  // Step 1: 读取登录态
  step(1, t('common.step_login_label'));
  const authRef = ensureSession();
  chalkSuccess(t('common.login_ready', authRef.baseUrl));

  // Step 2: 获取表单页面列表
  step(2, t('export.step_get_forms'));
  let formPages;
  try {
    const forms = await fetchFormPageList(appType, authRef);
    formPages = forms.map((form) => ({
      formUuid: form.formUuid,
      name: form.formName,
      formType: form.formType,
      pathName: form.pathName,
    }));
  } catch (err) {
    throw new CliError(err.message, {
      code: 'EXPORT_LIST_FORMS_FAILED',
    });
  }

  if (formPages.length === 0) {
    chalkWarn(t('export.no_forms'));
    throw new CliError(t('export.no_forms'), {
      code: 'EXPORT_NO_FORMS',
    });
  }

  chalkSuccess(t('export.forms_found', formPages.length));
  formPages.forEach((page, index) => {
    listItem(`${c.bold}${index + 1}.${c.reset} ${page.name} ${c.dim}(${page.formUuid})${c.reset}`);
  });

  // Step 3: 逐个导出表单 Schema
  step(3, t('export.step_export_schema'));
  const exportedForms = [];
  let successCount = 0;
  let failCount = 0;

  for (const page of formPages) {
    info(t('export.exporting', page.name, page.formUuid));
    const schema = await fetchFormSchema(appType, page.formUuid, authRef);
    if (schema) {
      exportedForms.push({
        formUuid: page.formUuid,
        name: page.name,
        formType: page.formType,
        schema,
      });
      chalkSuccess(t('export.export_ok'));
      successCount++;
    } else {
      chalkFail(t('export.export_failed'), { exit: false });
      failCount++;
    }
  }

  // Step 4: 写入导出文件
  step(4, t('export.step_write_file'));
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
  try {
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');
  } catch (err) {
    throw new CliError(err.message, {
      code: 'EXPORT_WRITE_FAILED',
      details: { outputPath },
    });
  }

  // 输出结果
  const details = [
    ['Success', `${c.green}${successCount}${c.reset}`],
  ];
  if (failCount > 0) {
    details.push(['Failed', `${c.red}${failCount}${c.reset}`]);
  }
  details.push(['Output', outputPath]);
  chalkResult(failCount === 0, t('export.done'), details);

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

  return {
    success: true,
    appType,
    outputPath,
    totalForms: formPages.length,
    successCount,
    failCount,
  };
}

module.exports = {
  run,
  fetchFormSchema,
};
