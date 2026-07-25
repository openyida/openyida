#!/usr/bin/env node
/**
 * configure-process.js - 宜搭流程规则配置 legacy adapter
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { CliError } = require('../core/cli-error');
const { createAuthRef } = require('../core/yida-client');
const { t } = require('../core/i18n');
const { warn } = require('../core/chalk');
const {
  buildApproverConfig,
  buildProcessAndViewJson,
} = require('./services/process-compiler');
const {
  getProcessCodeFromAppParam,
  getProcessCodeFromSchema,
  newDraftProcess,
  publishProcessById,
  queryProcessVersions,
  saveProcessById,
  switchFormType,
} = require('./services/process-service');

function parseArgs(args) {
  const directArgs = args || [];
  if (!Array.isArray(directArgs) || directArgs.length < 3) {
    warn(t('configure_process.usage'));
    throw new CliError(t('configure_process.usage'), {
      code: 'CONFIGURE_PROCESS_INVALID_ARGUMENTS',
    });
  }

  return {
    appType: directArgs[0],
    formUuid: directArgs[1],
    processDefinitionFile: path.resolve(directArgs[2]),
    processCodeArg: directArgs[3] || null,
  };
}

function formatApiError(result) {
  if (!result) {
    return 'empty response';
  }
  return result.errorMsg || result.message || JSON.stringify(result);
}

// ── 主流程 ───────────────────────────────────────────

async function run(args) {
  const parsed = parseArgs(args);
  const appType = parsed.appType;
  const formUuid = parsed.formUuid;
  const processDefinitionFile = parsed.processDefinitionFile;
  const processCodeArg = parsed.processCodeArg;

  warn('🔧 ' + t('configure_process.title'));
  warn('  ' + t('configure_process.app_id') + ': ' + appType);
  warn('  ' + t('configure_process.form_uuid') + ': ' + formUuid);
  warn('  ' + t('configure_process.definition_file') + ': ' + processDefinitionFile);
  if (processCodeArg) {
    warn('  processCode: ' + processCodeArg + ' (' + t('configure_process.from_cli') + ')');
  }
  warn('');

  // 1. 读取流程定义
  if (!fs.existsSync(processDefinitionFile)) {
    warn('  ❌ ' + t('configure_process.file_not_found') + ': ' + processDefinitionFile);
    throw new CliError(t('configure_process.file_not_found') + ': ' + processDefinitionFile, {
      code: 'CONFIGURE_PROCESS_FILE_NOT_FOUND',
      details: { processDefinitionFile },
    });
  }

  let definition;
  try {
    definition = JSON.parse(fs.readFileSync(processDefinitionFile, 'utf-8'));
  } catch (e) {
    warn('  ❌ ' + t('configure_process.parse_failed') + ': ' + e.message);
    throw new CliError(t('configure_process.parse_failed') + ': ' + e.message, {
      code: 'CONFIGURE_PROCESS_INVALID_JSON',
      details: { processDefinitionFile },
    });
  }
  warn('  ✅ ' + t('configure_process.definition_loaded') + ' (' + (definition.nodes || []).length + ' ' + t('configure_process.nodes') + ')');

  // 2. 读取登录态
  warn('\n🔑 ' + t('configure_process.loading_auth') + '...');
  const authRef = createAuthRef();
  warn('  ✅ ' + t('configure_process.auth_loaded') + ', baseUrl: ' + authRef.baseUrl);

  // 3. 获取 processCode
  warn('\n🔍 ' + t('configure_process.getting_process_code') + '...');
  let processCode = processCodeArg;

  if (!processCode) {
    // 确保表单是流程表单
    warn('  ' + t('configure_process.switching_form_type') + '...');
    const switchResult = await switchFormType(authRef, appType, formUuid);
    if (switchResult.success) {
      warn('  ✅ ' + t('configure_process.switch_success'));
    } else {
      const switchMsg = switchResult.errorMsg || '';
      if (switchMsg.indexOf('已转换') >= 0 || switchMsg.indexOf('已经是') >= 0) {
        warn('  ✅ ' + t('configure_process.already_process'));
      } else {
        warn('  ⚠️ ' + t('configure_process.switch_warning') + ': ' + switchMsg);
      }
    }

    // 方法 1: 从精确表单流程绑定接口提取
    warn('  ' + t('configure_process.method1') + '...');
    processCode = await getProcessCodeFromAppParam(authRef, appType, formUuid);
    if (processCode) {
      warn('  ✅ ' + t('configure_process.got_process_code') + ': ' + processCode);
    }

    // 方法 2: 从 getFormSchema 中提取
    if (!processCode) {
      warn('  ' + t('configure_process.method2') + '...');
      processCode = await getProcessCodeFromSchema(authRef, appType, formUuid);
      if (processCode) {
        warn('  ✅ ' + t('configure_process.got_from_schema') + ': ' + processCode);
      }
    }
  }

  if (!processCode) {
    warn('  ❌ ' + t('configure_process.no_process_code'));
    warn('  💡 ' + t('configure_process.manual_hint'));
    throw new CliError(t('configure_process.no_process_code'), {
      code: 'CONFIGURE_PROCESS_CODE_NOT_FOUND',
      details: { appType, formUuid },
    });
  }
  warn('  ✅ processCode: ' + processCode);

  // 4. 查询流程版本列表
  warn('\n🔍 ' + t('configure_process.querying_versions') + '...');
  const publishedResult = await queryProcessVersions(authRef, appType, processCode, 'PUBLISHED');

  let latestProcessId = null;
  let latestVersion = 0;

  if (publishedResult.success && publishedResult.content && publishedResult.content.data && publishedResult.content.data.length > 0) {
    const publishedVersion = publishedResult.content.data[0];
    latestProcessId = publishedVersion.id;
    latestVersion = parseInt(publishedVersion.version, 10);
    warn('  ✅ ' + t('configure_process.found_published') + ': processId=' + latestProcessId + ', version=' + latestVersion);
  } else {
    warn('  ℹ️ ' + t('configure_process.no_published') + '...');
    const allVersionsResult = await queryProcessVersions(authRef, appType, processCode, '');
    if (allVersionsResult.success && allVersionsResult.content && allVersionsResult.content.data && allVersionsResult.content.data.length > 0) {
      const latestItem = allVersionsResult.content.data[0];
      latestProcessId = latestItem.id;
      latestVersion = parseInt(latestItem.version, 10);
      warn('  ✅ ' + t('configure_process.found_latest') + ': processId=' + latestProcessId + ', version=' + latestVersion);
    }
  }

  const newVersion = latestVersion + 1;

  // 5. 创建新流程版本草稿
  warn('\n📝 ' + t('configure_process.creating_draft') + '...');
  const draftResult = await newDraftProcess(authRef, appType, processCode, formUuid, latestProcessId, newVersion);

  let newProcessId = null;

  if (draftResult.success && draftResult.content && draftResult.content.processId) {
    // content 是对象，包含 processId 字段
    newProcessId = draftResult.content.processId;
    warn('  ✅ ' + t('configure_process.draft_created') + ': processId=' + newProcessId);
  } else if (draftResult.success && draftResult.content && typeof draftResult.content === 'number') {
    // content 直接是 processId 数字（宜搭 API 的另一种返回格式）
    newProcessId = draftResult.content;
    warn('  ✅ ' + t('configure_process.draft_created') + ': processId=' + newProcessId);
  } else if (draftResult.success) {
    warn('  ✅ ' + t('configure_process.draft_created_no_id'));
    const savedResult = await queryProcessVersions(authRef, appType, processCode, '');
    if (savedResult.success && savedResult.content && savedResult.content.data) {
      const savedVersions = savedResult.content.data.filter(function (item) { return item.status === 'SAVED'; });
      if (savedVersions.length > 0) {
        newProcessId = savedVersions[0].id;
      } else {
        newProcessId = savedResult.content.data[0].id;
      }
    }
  } else {
    const errorMsg = formatApiError(draftResult);
    warn('  ❌ ' + t('configure_process.draft_failed') + ': ' + errorMsg);
    throw new CliError(t('configure_process.draft_failed') + ': ' + errorMsg, {
      code: 'CONFIGURE_PROCESS_DRAFT_FAILED',
      details: { appType, formUuid, processCode, result: draftResult },
    });
  }

  if (!newProcessId) {
    warn('  ❌ ' + t('configure_process.no_draft_id'));
    throw new CliError(t('configure_process.no_draft_id'), {
      code: 'CONFIGURE_PROCESS_DRAFT_ID_NOT_FOUND',
      details: { appType, formUuid, processCode, draftResult },
    });
  }

  // 6. 构建 processJson 和 viewJson
  warn('\n🏗️  ' + t('configure_process.building_json') + '...');
  const result = buildProcessAndViewJson(
    definition,
    processCode,
    formUuid,
    authRef.baseUrl,
    appType,
    { onWarning: warn }
  );
  const processJsonStr = JSON.stringify(result.processJson);
  const viewJsonStr = JSON.stringify(result.viewJson);
  warn('  ✅ processJson: ' + processJsonStr.length + ' chars');
  warn('  ✅ viewJson: ' + viewJsonStr.length + ' chars');

  // 7. 保存流程
  warn('\n💾 ' + t('configure_process.saving') + '...');
  const saveResult = await saveProcessById(
    authRef, appType, formUuid, processCode, newProcessId, newVersion,
    processJsonStr, viewJsonStr
  );

  if (saveResult.success) {
    warn('  ✅ ' + t('configure_process.save_success'));
  } else {
    const errorMsg = formatApiError(saveResult);
    warn('  ❌ ' + t('configure_process.save_failed') + ': ' + errorMsg);
    throw new CliError(t('configure_process.save_failed') + ': ' + errorMsg, {
      code: 'CONFIGURE_PROCESS_SAVE_FAILED',
      details: { appType, formUuid, processCode, processId: newProcessId, result: saveResult },
    });
  }

  // 8. 发布流程
  warn('\n🚀 ' + t('configure_process.publishing') + '...');
  const publishResult = await publishProcessById(
    authRef, appType, formUuid, processCode, newProcessId, newVersion
  );

  if (publishResult.success) {
    warn('  ✅ ' + t('configure_process.publish_success'));
  } else {
    const errorMsg = formatApiError(publishResult);
    warn('  ❌ ' + t('configure_process.publish_failed') + ': ' + errorMsg);
    throw new CliError(t('configure_process.publish_failed') + ': ' + errorMsg, {
      code: 'CONFIGURE_PROCESS_PUBLISH_FAILED',
      details: { appType, formUuid, processCode, processId: newProcessId, result: publishResult },
    });
  }

  // 9. 输出结果
  const output = {
    success: true,
    processCode: processCode,
    processId: newProcessId,
    processVersion: newVersion,
    appType: appType,
    formUuid: formUuid,
  };

  console.log(JSON.stringify(output));
  warn('\n🎉 ' + t('configure_process.done'));
  return output;
}

module.exports = {
  run,
  parseArgs,
  queryProcessVersions,
  switchFormType,
  getProcessCodeFromAppParam,
  getProcessCodeFromSchema,
  newDraftProcess,
  saveProcessById,
  publishProcessById,
  _private: {
    buildApproverConfig,
    buildProcessAndViewJson,
  },
};
