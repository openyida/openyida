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
const { createStageTracker, summarizeRemoteResult } = require('./process-diagnostics');
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
  return result.errorMsg || result.message || JSON.stringify(summarizeRemoteResult(result));
}

function latestProcessVersion(result) {
  const data = result && result.success && result.content && result.content.data;
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }
  return data.reduce(function (latest, item) {
    return !latest || versionNumber(item) > versionNumber(latest) ? item : latest;
  }, null);
}

function versionNumber(item) {
  const rawVersion = item && (item.processVersion !== undefined ? item.processVersion : item.version);
  const value = parseInt(rawVersion, 10);
  return Number.isFinite(value) ? value : 0;
}

// ── 主流程 ───────────────────────────────────────────

async function run(args, options) {
  const runOptions = options || {};
  const parsed = parseArgs(args);
  const appType = parsed.appType;
  const formUuid = parsed.formUuid;
  const processDefinitionFile = parsed.processDefinitionFile;
  const processCodeArg = parsed.processCodeArg;
  const stageTracker = createStageTracker();
  let processCode = processCodeArg;
  let newProcessId = null;
  let newVersion = null;

  function context(extra) {
    return Object.assign({
      appType,
      formUuid,
      processCode: processCode || null,
      processId: newProcessId || null,
      processVersion: newVersion,
      processDefinitionFile,
    }, extra || {});
  }

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
      details: stageTracker.failure('read_definition', {
        context: context(),
      }),
    });
  }

  let definition;
  try {
    definition = JSON.parse(fs.readFileSync(processDefinitionFile, 'utf-8'));
  } catch (e) {
    warn('  ❌ ' + t('configure_process.parse_failed') + ': ' + e.message);
    throw new CliError(t('configure_process.parse_failed') + ': ' + e.message, {
      code: 'CONFIGURE_PROCESS_INVALID_JSON',
      details: stageTracker.failure('read_definition', {
        context: context(),
        cause: e,
      }),
    });
  }
  warn('  ✅ ' + t('configure_process.definition_loaded') + ' (' + (definition.nodes || []).length + ' ' + t('configure_process.nodes') + ')');
  stageTracker.complete('read_definition');

  // 2. 读取登录态
  warn('\n🔑 ' + t('configure_process.loading_auth') + '...');
  const authRef = createAuthRef();
  warn('  ✅ ' + t('configure_process.auth_loaded') + ', baseUrl: ' + authRef.baseUrl);
  stageTracker.complete('load_auth');

  // 3. 在任何线上写操作前完成纯本地编译与校验。
  warn('\n🏗️  ' + t('configure_process.building_json') + '...');
  let result;
  try {
    result = buildProcessAndViewJson(
      definition,
      processCode || '__OPENYIDA_PENDING_PROCESS_CODE__',
      formUuid,
      authRef.baseUrl,
      appType,
      { onWarning: warn }
    );
  } catch (buildError) {
    throw new CliError(t('configure_process.building_json') + ': ' + buildError.message, {
      code: buildError.code || 'CONFIGURE_PROCESS_BUILD_FAILED',
      details: stageTracker.failure('build_definition', {
        context: context(),
        cause: buildError,
      }),
    });
  }
  stageTracker.complete('build_definition');

  // 4. 获取 processCode
  warn('\n🔍 ' + t('configure_process.getting_process_code') + '...');

  if (!processCode) {
    try {
      // 确保表单是流程表单
      warn('  ' + t('configure_process.switching_form_type') + '...');
      const switchResult = await switchFormType(authRef, appType, formUuid);
      if (switchResult.success) {
        warn('  ✅ ' + t('configure_process.switch_success'));
        stageTracker.complete('switch_form_type');
      } else {
        const switchMsg = switchResult.errorMsg || '';
        if (switchMsg.indexOf('已转换') >= 0 || switchMsg.indexOf('已经是') >= 0) {
          warn('  ✅ ' + t('configure_process.already_process'));
          stageTracker.complete('switch_form_type');
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
    } catch (lookupError) {
      throw new CliError(t('configure_process.no_process_code') + ': ' + lookupError.message, {
        code: 'CONFIGURE_PROCESS_CODE_LOOKUP_FAILED',
        details: stageTracker.failure('resolve_process_code', {
          context: context(),
          cause: lookupError,
        }),
      });
    }
  }

  if (!processCode) {
    warn('  ❌ ' + t('configure_process.no_process_code'));
    warn('  💡 ' + t('configure_process.manual_hint'));
    throw new CliError(t('configure_process.no_process_code'), {
      code: 'CONFIGURE_PROCESS_CODE_NOT_FOUND',
      details: stageTracker.failure('resolve_process_code', {
        context: context(),
      }),
    });
  }
  warn('  ✅ processCode: ' + processCode);
  stageTracker.complete('resolve_process_code');

  // 5. 查询已发布版本与已保存草稿
  warn('\n🔍 ' + t('configure_process.querying_versions') + '...');
  let latestProcessId = null;
  let latestVersion = 0;
  let savedDraft = null;

  try {
    const publishedResult = await queryProcessVersions(authRef, appType, processCode, 'PUBLISHED');
    const savedResult = await queryProcessVersions(authRef, appType, processCode, 'SAVED');
    if (!publishedResult || publishedResult.success !== true) {
      throw new Error('PUBLISHED: ' + formatApiError(publishedResult));
    }
    if (!savedResult || savedResult.success !== true) {
      throw new Error('SAVED: ' + formatApiError(savedResult));
    }
    const publishedVersion = latestProcessVersion(publishedResult);
    const savedVersion = latestProcessVersion(savedResult);

    if (publishedVersion) {
      latestProcessId = publishedVersion.id;
      latestVersion = versionNumber(publishedVersion);
      warn('  ✅ ' + t('configure_process.found_published') + ': processId=' + latestProcessId + ', version=' + latestVersion);
    } else {
      warn('  ℹ️ ' + t('configure_process.no_published') + '...');
    }

    if (savedVersion && savedVersion.id && versionNumber(savedVersion) > 0 && versionNumber(savedVersion) >= latestVersion) {
      savedDraft = savedVersion;
      latestProcessId = savedVersion.id;
      latestVersion = versionNumber(savedVersion);
      warn('  ✅ ' + t('configure_process.found_latest') + ': processId=' + latestProcessId + ', version=' + latestVersion);
    }
  } catch (versionError) {
    throw new CliError(t('configure_process.querying_versions') + ': ' + versionError.message, {
      code: 'CONFIGURE_PROCESS_QUERY_VERSIONS_FAILED',
      details: stageTracker.failure('query_process_versions', {
        context: context(),
        cause: versionError,
      }),
    });
  }
  stageTracker.complete('query_process_versions');

  // 6. 安全复用最新草稿，否则创建下一个真实版本。
  let draftResult = null;
  if (savedDraft) {
    newProcessId = savedDraft.id;
    newVersion = versionNumber(savedDraft);
  } else {
    newVersion = latestVersion + 1;
    warn('\n📝 ' + t('configure_process.creating_draft') + '...');
    draftResult = await newDraftProcess(authRef, appType, processCode, formUuid, latestProcessId, newVersion);

    if (
      draftResult.success
      && draftResult.content
      && typeof draftResult.content === 'object'
      && (draftResult.content.processId || draftResult.content.id)
    ) {
      newProcessId = draftResult.content.processId || draftResult.content.id;
      const serverVersion = parseInt(draftResult.content.processVersion || draftResult.content.version, 10);
      if (Number.isFinite(serverVersion)) {
        newVersion = serverVersion;
      }
      warn('  ✅ ' + t('configure_process.draft_created') + ': processId=' + newProcessId);
    } else if (draftResult.success && draftResult.content && typeof draftResult.content === 'number') {
      newProcessId = draftResult.content;
      warn('  ✅ ' + t('configure_process.draft_created') + ': processId=' + newProcessId);
    } else if (draftResult.success) {
      warn('  ✅ ' + t('configure_process.draft_created_no_id'));
      const refreshedSavedResult = await queryProcessVersions(authRef, appType, processCode, 'SAVED');
      const refreshedSaved = latestProcessVersion(refreshedSavedResult);
      if (refreshedSaved) {
        newProcessId = refreshedSaved.id;
        newVersion = versionNumber(refreshedSaved) || newVersion;
      } else {
        newProcessId = null;
      }
    } else {
      const errorMsg = formatApiError(draftResult);
      warn('  ❌ ' + t('configure_process.draft_failed') + ': ' + errorMsg);
      throw new CliError(t('configure_process.draft_failed') + ': ' + errorMsg, {
        code: 'CONFIGURE_PROCESS_DRAFT_FAILED',
        details: stageTracker.failure('create_draft', {
          context: context(),
          cause: draftResult,
        }),
      });
    }
  }

  if (!newProcessId) {
    warn('  ❌ ' + t('configure_process.no_draft_id'));
    throw new CliError(t('configure_process.no_draft_id'), {
      code: 'CONFIGURE_PROCESS_DRAFT_ID_NOT_FOUND',
      details: stageTracker.failure('create_draft', {
        context: context(),
        cause: draftResult,
      }),
    });
  }
  stageTracker.complete('create_draft');

  // 将前置编译时的占位 processCode 替换为服务端真实值。
  result.processJson.props.processCode = processCode;
  result.processJson.props.processInitUrl = authRef.baseUrl + '/alibaba/web/' + appType
    + '/inst/instStart.htm?processCode=' + processCode;
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
      details: stageTracker.failure('save_definition', {
        context: context(),
        cause: saveResult,
      }),
    });
  }
  stageTracker.complete('save_definition');

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
      details: stageTracker.failure('publish_process', {
        context: context(),
        cause: publishResult,
      }),
    });
  }
  stageTracker.complete('publish_process');

  // 9. 输出结果
  const output = {
    success: true,
    processCode: processCode,
    processId: newProcessId,
    processVersion: newVersion,
    appType: appType,
    formUuid: formUuid,
  };

  if (!runOptions.suppressOutput) {
    console.log(JSON.stringify(output));
  }
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
