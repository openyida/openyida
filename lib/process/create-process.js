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
const { buildProcessAndViewJson } = require('./services/process-compiler');

// ── 参数解析 ─────────────────────────────────────────

function parseArgs(args) {
  const directArgs = args || [];
  const formUuidIndex = directArgs.indexOf('--formUuid');
  const replace = directArgs.includes('--replace');

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
      replace,
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
    replace,
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
  const replace = parsed.replace;
  const stageTracker = createStageTracker();
  let formUuid;
  let fieldCount = 0;
  let processCode = null;

  function context(extra) {
    return Object.assign({
      appType,
      formUuid: formUuid || existingFormUuid || null,
      processDefinitionFile,
    }, extra || {});
  }

  function buildRetryCommand() {
    return 'openyida create-process ' + appType + ' --formUuid ' + formUuid + ' '
      + path.basename(processDefinitionFile) + (replace ? ' --replace' : '');
  }

  function isTerminalSafetyError(error) {
    return !!(error && [
      'NON_IDEMPOTENT_RESULT_UNKNOWN',
      'PUBLISHED_UNVERIFIED',
    ].includes(error.code));
  }

  function terminalSafetyNextStep() {
    return t('process_diagnostics.unknown_result');
  }

  function buildConfigureFailureDetails(configError) {
    const terminalSafetyError = isTerminalSafetyError(configError);
    const retryCommand = terminalSafetyError ? null : buildRetryCommand();
    const failureContext = { processCode };
    if (retryCommand) {
      failureContext.retryCommand = retryCommand;
    }
    const outerDetails = stageTracker.failure('configure_process', {
      context: context(failureContext),
      cause: configError,
      nextStep: terminalSafetyError ? terminalSafetyNextStep() : undefined,
    });
    const innerDetails = configError && configError.isCliError && configError.details && configError.details.stage
      ? configError.details
      : null;
    if (!innerDetails) {
      return terminalSafetyError
        ? Object.assign({}, outerDetails, { noWriteRetry: true })
        : outerDetails;
    }
    const configureProcess = {
      code: configError.code || 'CREATE_PROCESS_CONFIGURE_FAILED',
      stage: innerDetails.stage,
      completedStages: Array.isArray(innerDetails.completedStages)
        ? innerDetails.completedStages.slice()
        : [],
    };
    const nextStep = terminalSafetyError
      ? terminalSafetyNextStep()
      : innerDetails.nextStep;
    if (nextStep) {
      configureProcess.nextStep = nextStep;
    }
    return Object.assign({}, outerDetails, {
      stage: innerDetails.stage,
      nextStep: nextStep || outerDetails.nextStep,
      createProcessStage: 'configure_process',
      noWriteRetry: terminalSafetyError,
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

  // 在创建表单或转换表单前完成流程定义的纯本地编译，避免后续必然失败仍先产生副作用。
  let processDefinition;
  try {
    processDefinition = JSON.parse(fs.readFileSync(processDefinitionFile, 'utf8'));
    buildProcessAndViewJson(
      processDefinition,
      '__OPENYIDA_PENDING_PROCESS_CODE__',
      existingFormUuid || '__OPENYIDA_PENDING_FORM_UUID__',
      'https://openyida.invalid',
      appType,
      { onWarning: warn }
    );
  } catch (error) {
    if (error && error.code) {
      throw error;
    }
    throw new CliError(t('create_process.process_def_not_found') + ': ' + error.message, {
      code: 'CREATE_PROCESS_DEFINITION_INVALID',
      details: stageTracker.failure('validate_inputs', {
        context: context(),
        cause: error,
      }),
    });
  }
  stageTracker.complete('validate_inputs');

  // Step 0: 读取登录态
  warn('🔑 Step 0: ' + t('create_process.loading_auth') + '...');
  const authRef = createAuthRef();
  if (!isAuthRefReady(authRef)) {
    throw new CliError(t('create_process.login_required'), {
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

  // Step 2: 由安全配置入口完成模式读取、必要转换、replace 门禁、保存、发布和平台回读。
  warn('\n⚙️  Step 2: ' + t('create_process.configuring_process') + '...');
  let configureResult;
  try {
    const { run: runConfigureProcess } = require('./configure-process');
    const configureArgs = [appType, formUuid, processDefinitionFile];
    if (replace) {
      configureArgs.push('--replace');
    }
    configureResult = await runConfigureProcess(
      configureArgs,
      { suppressOutput: true }
    );
    stageTracker.complete('configure_process');
  } catch (configError) {
    const failureDetails = buildConfigureFailureDetails(configError);
    const terminalSafetyError = isTerminalSafetyError(configError);
    warn('  ❌ ' + t('create_process.configure_failed') + ': ' + configError.message);
    if (!terminalSafetyError) {
      // 仅对已知、可安全重试的配置失败提供复用表单命令。
      warn('');
      warn('  💡 ' + t('create_process.retry_hint'));
      warn('     ' + buildRetryCommand());
      warn('');
    }
    const failureOutput = {
      success: false,
      errorCode: configError.code || 'CREATE_PROCESS_CONFIGURE_FAILED',
      formUuid: formUuid,
      formTitle: formTitle || '(existing form)',
      appType: appType,
      fieldCount: fieldCount,
      error: t('create_process.configure_failed') + ': ' + configError.message,
      stage: failureDetails.stage,
      completedStages: failureDetails.completedStages,
      nextStep: failureDetails.nextStep,
      configureProcess: failureDetails.configureProcess,
    };
    if (!terminalSafetyError && failureDetails.context && failureDetails.context.retryCommand) {
      failureOutput.retryCommand = failureDetails.context.retryCommand;
    }
    console.log(JSON.stringify(failureOutput));
    throw new CliError(t('create_process.configure_failed') + ': ' + configError.message, {
      code: terminalSafetyError
        ? configError.code
        : 'CREATE_PROCESS_CONFIGURE_FAILED',
      details: failureDetails,
    });
  }
  processCode = configureResult.processCode;

  // 输出最终结果
  const finalResult = {
    success: true,
    formUuid: formUuid,
    formTitle: formTitle || '(existing form)',
    appType: appType,
    fieldCount: fieldCount,
    processCode: processCode,
    processId: configureResult.processId,
    processVersion: configureResult.processVersion,
    verificationLevel: configureResult.verificationLevel,
    platformViewVerified: configureResult.platformViewVerified,
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
};
