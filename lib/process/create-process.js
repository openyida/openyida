#!/usr/bin/env node
/**
 * create-process.js - 宜搭流程表单一体化创建命令
 *
 * 整合「创建表单 → 转流程表单 → 获取 processCode → 配置流程」四步为一步。
 *
 * 用法 1（创建新表单 + 转流程）：
 *   openyida create-process <appType> <formTitle> <fieldsJsonFile> <processDefinitionFile>
 *
 * 用法 2（复用已有表单 + 转流程，推荐）：
 *   openyida create-process <appType> --formUuid <formUuid> <processDefinitionFile>
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { CliError } = require('../core/cli-error');
const { createAuthRef, isAuthRefReady } = require('../core/yida-client');
const { t } = require('../core/i18n');
const { warn } = require('../core/chalk');
const { createFormForLegacyProcess } = require('../app/create-form');
const { createStageTracker, summarizeRemoteResult } = require('./process-diagnostics');
const {
  getProcessCodeFromAppParam,
  getProcessCodeFromSchema,
  switchFormType,
} = require('./services/process-service');

// ── 参数解析 ─────────────────────────────────────────

function parseArgs(args) {
  const directArgs = args || [];
  const formUuidIndex = directArgs.indexOf('--formUuid');

  // 用法 2: <appType> --formUuid <formUuid> <processDefinitionFile>
  if (formUuidIndex !== -1) {
    if (formUuidIndex + 2 >= directArgs.length) {
      warn(t('create_process.usage2'));
      throw new CliError(t('create_process.usage2'), {
        code: 'CREATE_PROCESS_INVALID_ARGUMENTS',
      });
    }
    let appType = null;
    const existingFormUuid = directArgs[formUuidIndex + 1];
    const processDefFile = directArgs[formUuidIndex + 2];

    for (let i = 0; i < directArgs.length; i++) {
      if (directArgs[i] !== '--formUuid' && directArgs[i] !== existingFormUuid && directArgs[i] !== processDefFile) {
        appType = directArgs[i];
        break;
      }
    }

    return {
      appType,
      formTitle: null,
      fieldsJsonFile: null,
      processDefinitionFile: processDefFile,
      existingFormUuid,
    };
  }

  // 用法 1: <appType> <formTitle> <fieldsJsonFile> <processDefinitionFile>
  if (directArgs.length < 4) {
    warn(t('create_process.usage'));
    throw new CliError(t('create_process.usage'), {
      code: 'CREATE_PROCESS_INVALID_ARGUMENTS',
    });
  }
  return {
    appType: directArgs[0],
    formTitle: directArgs[1],
    fieldsJsonFile: directArgs[2],
    processDefinitionFile: directArgs[3],
    existingFormUuid: null,
  };
}

// ── 主流程 ───────────────────────────────────────────

async function run(args) {
  const parsed = parseArgs(args);
  const appType = parsed.appType;
  const formTitle = parsed.formTitle;
  const existingFormUuid = parsed.existingFormUuid;
  const useExistingForm = !!existingFormUuid;
  const fieldsJsonFile = parsed.fieldsJsonFile ? path.resolve(parsed.fieldsJsonFile) : null;
  const processDefinitionFile = path.resolve(parsed.processDefinitionFile);
  const stageTracker = createStageTracker();
  let formUuid;
  let fieldCount = 0;

  function context(extra) {
    return Object.assign({
      appType,
      formUuid: formUuid || existingFormUuid || null,
      processDefinitionFile,
    }, extra || {});
  }

  function buildRetryCommand() {
    return 'openyida create-process ' + appType + ' --formUuid ' + formUuid + ' ' + path.basename(processDefinitionFile);
  }

  function buildConfigureFailureDetails(configError) {
    const retryCommand = buildRetryCommand();
    const outerDetails = stageTracker.failure('configure_process', {
      context: context({ processCode, retryCommand }),
      cause: configError,
    });
    const innerDetails = configError && configError.isCliError && configError.details && configError.details.stage
      ? configError.details
      : null;
    if (!innerDetails) {
      return outerDetails;
    }
    const configureProcess = {
      stage: innerDetails.stage,
      completedStages: Array.isArray(innerDetails.completedStages)
        ? innerDetails.completedStages.slice()
        : [],
    };
    if (innerDetails.nextStep) {
      configureProcess.nextStep = innerDetails.nextStep;
    }
    return Object.assign({}, outerDetails, {
      stage: innerDetails.stage,
      nextStep: innerDetails.nextStep || outerDetails.nextStep,
      createProcessStage: 'configure_process',
      configureProcess,
    });
  }

  warn('═'.repeat(60));
  warn('  🔧 ' + t('create_process.title'));
  warn('═'.repeat(60));
  warn('  ' + t('create_process.app_id') + ':     ' + appType);
  if (useExistingForm) {
    warn('  ' + t('create_process.mode') + ':        ' + t('create_process.reuse_form'));
    warn('  formUuid:    ' + existingFormUuid);
  } else {
    warn('  ' + t('create_process.mode') + ':        ' + t('create_process.new_form'));
    warn('  ' + t('create_process.form_title') + ':    ' + formTitle);
    warn('  ' + t('create_process.fields_file') + ':    ' + fieldsJsonFile);
  }
  warn('  ' + t('create_process.process_def') + ':    ' + processDefinitionFile);
  warn('');

  // 验证文件存在
  if (!useExistingForm && fieldsJsonFile && !fs.existsSync(fieldsJsonFile)) {
    warn('  ❌ ' + t('create_process.fields_not_found') + ': ' + fieldsJsonFile);
    throw new CliError(t('create_process.fields_not_found') + ': ' + fieldsJsonFile, {
      code: 'CREATE_PROCESS_FIELDS_NOT_FOUND',
      details: stageTracker.failure('validate_inputs', {
        context: context({ fieldsJsonFile }),
      }),
    });
  }
  if (!fs.existsSync(processDefinitionFile)) {
    warn('  ❌ ' + t('create_process.process_def_not_found') + ': ' + processDefinitionFile);
    throw new CliError(t('create_process.process_def_not_found') + ': ' + processDefinitionFile, {
      code: 'CREATE_PROCESS_DEFINITION_NOT_FOUND',
      details: stageTracker.failure('validate_inputs', {
        context: context(),
      }),
    });
  }

  // Step 0: 读取登录态
  warn('🔑 Step 0: ' + t('create_process.loading_auth') + '...');
  const authRef = createAuthRef();
  if (!isAuthRefReady(authRef)) {
    throw new CliError('未获取到有效宜搭登录态，请先执行 openyida login', {
      code: 'NEED_LOGIN',
      details: stageTracker.failure('load_auth', {
        context: context(),
      }),
    });
  }
  warn('  ✅ ' + t('create_process.auth_loaded') + ', baseUrl: ' + authRef.baseUrl);
  stageTracker.complete('load_auth');

  // Step 1: 创建或复用表单
  if (useExistingForm) {
    warn('\n📋 Step 1: ' + t('create_process.reusing_form') + '...');
    formUuid = existingFormUuid;
    warn('  ✅ ' + t('create_process.using_form') + ': ' + formUuid);
    stageTracker.complete('reuse_form');
  } else {
    warn('\n📋 Step 1: ' + t('create_process.creating_form') + '...');
    try {
      const createFormResult = await createFormForLegacyProcess(authRef, {
        appType,
        formTitle,
        fieldsJsonFile,
      });

      if (!createFormResult || !createFormResult.success || !createFormResult.formUuid) {
        warn('  ❌ ' + t('create_process.create_form_failed') + ': ' + JSON.stringify(summarizeRemoteResult(createFormResult)));
        throw new CliError(t('create_process.create_form_failed'), {
          code: 'CREATE_PROCESS_CREATE_FORM_FAILED',
          details: stageTracker.failure('create_form', {
            context: context({ formTitle, fieldsJsonFile }),
            cause: createFormResult,
          }),
        });
      }

      formUuid = createFormResult.formUuid;
      fieldCount = createFormResult.fieldCount || 0;
      warn('  ✅ ' + t('create_process.form_created') + ': ' + formUuid);
      stageTracker.complete('create_form');
    } catch (createError) {
      warn('  ❌ ' + t('create_process.create_form_failed') + ': ' + createError.message);
      if (createError.stderr) {
        warn('  ' + createError.stderr.substring(0, 1000));
      }
      if (createError && createError.isCliError && createError.details && createError.details.stage) {
        throw createError;
      }
      throw new CliError(t('create_process.create_form_failed') + ': ' + createError.message, {
        code: 'CREATE_PROCESS_CREATE_FORM_FAILED',
        details: stageTracker.failure('create_form', {
          context: context({ formTitle, fieldsJsonFile }),
          cause: createError,
        }),
      });
    }
  }

  // Step 2: 转为流程表单
  warn('\n🔄 Step 2: ' + t('create_process.switching_form_type') + '...');
  const switchResult = await switchFormType(authRef, appType, formUuid);
  if (switchResult.success) {
    warn('  ✅ ' + t('create_process.switch_success'));
  } else {
    const switchMsg = switchResult.errorMsg || '';
    if (switchMsg.indexOf('已转换') >= 0 || switchMsg.indexOf('已经是') >= 0) {
      warn('  ✅ ' + t('create_process.already_process'));
    } else {
      warn('  ❌ ' + t('create_process.switch_failed') + ': ' + switchMsg);
      throw new CliError(t('create_process.switch_failed') + ': ' + switchMsg, {
        code: 'CREATE_PROCESS_SWITCH_FAILED',
        details: stageTracker.failure('switch_form_type', {
          context: context(),
          cause: switchResult,
        }),
      });
    }
  }
  stageTracker.complete('switch_form_type');

  // Step 3: 获取 processCode
  warn('\n🔍 Step 3: ' + t('create_process.getting_process_code') + '...');
  let processCode = null;

  try {
    // 方法 1: 从精确表单流程绑定接口提取
    warn('  ' + t('create_process.method1') + '...');
    processCode = await getProcessCodeFromAppParam(authRef, appType, formUuid);
    if (processCode) {
      warn('  ✅ ' + t('create_process.got_process_code') + ': ' + processCode);
    }

    // 方法 2: 从 getFormSchema 中提取
    if (!processCode) {
      warn('  ' + t('create_process.method2') + '...');
      processCode = await getProcessCodeFromSchema(authRef, appType, formUuid);
      if (processCode) {
        warn('  ✅ ' + t('create_process.got_from_schema') + ': ' + processCode);
      }
    }
  } catch (lookupError) {
    throw new CliError(t('create_process.no_process_code') + ': ' + lookupError.message, {
      code: 'CREATE_PROCESS_CODE_LOOKUP_FAILED',
      details: stageTracker.failure('resolve_process_code', {
        context: context(),
        cause: lookupError,
      }),
    });
  }

  if (!processCode) {
    const failureDetails = stageTracker.failure('resolve_process_code', {
      context: context(),
    });
    warn('  ❌ ' + t('create_process.no_process_code'));
    warn('  💡 ' + t('create_process.manual_hint', formUuid));
    console.log(JSON.stringify({
      success: false,
      formUuid: formUuid,
      formTitle: formTitle || '(existing form)',
      appType: appType,
      fieldCount: fieldCount,
      error: t('create_process.no_process_code'),
      stage: failureDetails.stage,
      completedStages: failureDetails.completedStages,
      nextStep: failureDetails.nextStep,
    }));
    throw new CliError(t('create_process.no_process_code'), {
      code: 'CREATE_PROCESS_CODE_NOT_FOUND',
      details: failureDetails,
    });
  }
  stageTracker.complete('resolve_process_code');

  // Step 4: 配置并发布流程
  warn('\n⚙️  Step 4: ' + t('create_process.configuring_process') + '...');
  try {
    const { run: runConfigureProcess } = require('./configure-process');
    await runConfigureProcess(
      [appType, formUuid, processDefinitionFile, processCode],
      { suppressOutput: true }
    );
    stageTracker.complete('configure_process');
  } catch (configError) {
    const failureDetails = buildConfigureFailureDetails(configError);
    warn('  ❌ ' + t('create_process.configure_failed') + ': ' + configError.message);
    // 提示用户可以使用 --formUuid 复用已创建的表单
    warn('');
    warn('  💡 ' + t('create_process.retry_hint'));
    warn('     ' + buildRetryCommand());
    warn('');
    console.log(JSON.stringify({
      success: false,
      formUuid: formUuid,
      formTitle: formTitle || '(existing form)',
      appType: appType,
      fieldCount: fieldCount,
      error: t('create_process.configure_failed') + ': ' + configError.message,
      stage: failureDetails.stage,
      completedStages: failureDetails.completedStages,
      nextStep: failureDetails.nextStep,
      retryCommand: failureDetails.context && failureDetails.context.retryCommand,
      configureProcess: failureDetails.configureProcess,
    }));
    throw new CliError(t('create_process.configure_failed') + ': ' + configError.message, {
      code: 'CREATE_PROCESS_CONFIGURE_FAILED',
      details: failureDetails,
    });
  }

  // 输出最终结果
  const finalResult = {
    success: true,
    formUuid: formUuid,
    formTitle: formTitle || '(existing form)',
    appType: appType,
    fieldCount: fieldCount,
    processCode: processCode,
    url: authRef.baseUrl + '/' + appType + '/workbench/' + formUuid,
  };

  warn('\n' + '═'.repeat(60));
  warn('  🎉 ' + t('create_process.done'));
  warn('  formUuid:       ' + formUuid);
  warn('  processCode:    ' + processCode);
  warn('  ' + t('create_process.url') + ':       ' + finalResult.url);
  warn('═'.repeat(60));

  console.log(JSON.stringify(finalResult));
  return finalResult;
}

module.exports = {
  run,
  parseArgs,
  switchFormType,
  getProcessCodeFromAppParam,
  getProcessCodeFromSchema,
};
