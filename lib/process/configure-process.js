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
const { readFormMode } = require('../app/services/form-mode-service');
const { createStageTracker, summarizeRemoteResult } = require('./process-diagnostics');
const {
  buildApproverConfig,
  buildProcessAndViewJson,
} = require('./services/process-compiler');
const { verifyPlatformView } = require('./services/process-view-verifier');
const {
  getProcessById,
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
    warn(t('cli.configure_process_usage'));
    throw new CliError(t('cli.configure_process_usage'), {
      code: 'CONFIGURE_PROCESS_INVALID_ARGUMENTS',
    });
  }

  let replace = false;
  let processCodeArg = null;
  for (const arg of directArgs.slice(3)) {
    if (arg === '--replace') {
      replace = true;
    } else if (typeof arg === 'string' && arg.startsWith('-')) {
      throw new CliError(t('cli.configure_process_usage'), {
        code: 'CONFIGURE_PROCESS_INVALID_ARGUMENTS',
        details: { option: arg },
      });
    } else if (!processCodeArg) {
      processCodeArg = arg;
    } else {
      throw new CliError(t('cli.configure_process_usage'), {
        code: 'CONFIGURE_PROCESS_INVALID_ARGUMENTS',
      });
    }
  }

  return {
    appType: directArgs[0],
    formUuid: directArgs[1],
    processDefinitionFile: path.resolve(directArgs[2]),
    processCodeArg,
    replace,
  };
}

function formatApiError(result) {
  if (!result) {
    return 'empty response';
  }
  return result.errorMsg || result.message || JSON.stringify(summarizeRemoteResult(result));
}

function versionNumber(item) {
  const rawVersion = item && (item.processVersion !== undefined ? item.processVersion : item.version);
  const value = parseInt(rawVersion, 10);
  return Number.isFinite(value) ? value : 0;
}

function processId(item) {
  const value = rawProcessId(item);
  return value === undefined || value === null ? null : String(value);
}

function rawProcessId(item) {
  return item && (item.processId !== undefined ? item.processId : item.id);
}

function latestProcessVersion(result) {
  const data = processVersionItems(result);
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }
  return data.reduce(function (latest, item) {
    return !latest || versionNumber(item) > versionNumber(latest) ? item : latest;
  }, null);
}

function processVersionItems(result) {
  const data = result && result.success && result.content && result.content.data;
  return Array.isArray(data) ? data : [];
}

function versionIdentity(item) {
  const rawId = rawProcessId(item);
  const id = processId(item);
  const version = versionNumber(item);
  if (!id || version <= 0) {
    return null;
  }
  return { processId: id, processVersion: version, rawProcessId: rawId };
}

function identityKey(identity) {
  return identity.processId + ':' + identity.processVersion;
}

function recoverNewDraftIdentity(baselineItems, observedItems, expectedVersion) {
  const baseline = (baselineItems || []).map(versionIdentity).filter(Boolean);
  const observed = (observedItems || []).map(versionIdentity).filter(Boolean);
  const baselineKeys = new Set(baseline.map(identityKey));
  const candidatesByKey = new Map();
  observed.forEach(function (identity) {
    if (
      identity.processVersion === Number(expectedVersion)
      && !baselineKeys.has(identityKey(identity))
    ) {
      candidatesByKey.set(identityKey(identity), identity);
    }
  });
  const candidates = Array.from(candidatesByKey.values());
  return {
    baseline,
    observed,
    requestedVersion: Number(expectedVersion),
    candidates,
    candidateCount: candidates.length,
  };
}

function exactProcessVersion(result, expectedId, expectedVersion) {
  const data = result && result.success && result.content && result.content.data;
  if (!Array.isArray(data)) {
    return null;
  }
  return data.find(function (item) {
    return processId(item) === String(expectedId)
      && versionNumber(item) === Number(expectedVersion);
  }) || null;
}

function resultIsUnknown(result) {
  return !!(result && (
    result.__needLogin
    || result.__csrfExpired
    || result.errorCode === 'NON_IDEMPOTENT_RESULT_UNKNOWN'
  ));
}

async function run(args, options) {
  const runOptions = options || {};
  const parsed = parseArgs(args);
  const { appType, formUuid, processDefinitionFile, processCodeArg, replace } = parsed;
  const stageTracker = createStageTracker();
  let processCode = processCodeArg;
  let newProcessId = null;
  let newVersion = null;
  let remoteWrites = 0;

  function context(extra) {
    return Object.assign({
      appType,
      formUuid,
      processCode: processCode || null,
      processId: newProcessId || null,
      processVersion: newVersion,
      processDefinitionFile,
      replace,
      remoteWrites,
    }, extra || {});
  }

  function failure(code, message, stage, cause, extra) {
    const details = Object.assign(stageTracker.failure(stage, {
      context: context(),
      cause,
    }), extra || {});
    throw new CliError(message, { code, details });
  }

  function assertKnownWriteResult(result, stage, operation) {
    if (resultIsUnknown(result)) {
      failure(
        'NON_IDEMPOTENT_RESULT_UNKNOWN',
        t('common.non_idempotent_result_unknown'),
        stage,
        result,
        {
          operation,
          resultUnknown: true,
          nextStep: t('process_diagnostics.unknown_result'),
        }
      );
    }
  }

  function failOneShotWrite(error, stage, operation, knownMessage) {
    if (error && error.code === 'YIDA_WRITE_AUTH_NOT_READY') {
      failure(error.code, knownMessage + ': ' + error.message, stage, error, { operation });
    }
    failure(
      'NON_IDEMPOTENT_RESULT_UNKNOWN',
      t('common.non_idempotent_result_unknown'),
      stage,
      error,
      {
        operation,
        resultUnknown: true,
        nextStep: t('process_diagnostics.unknown_result'),
      }
    );
  }

  function publishedUnverified(message, cause, extra) {
    failure(
      'PUBLISHED_UNVERIFIED',
      message || t('configure_process.published_unverified'),
      'verify_published_view',
      cause,
      Object.assign({ verificationLevel: 'PUBLISHED_UNVERIFIED' }, extra || {})
    );
  }

  async function queryVersionState(oneShot) {
    let publishedResult;
    let savedResult;
    try {
      publishedResult = await queryProcessVersions(
        authRef, appType, processCode, 'PUBLISHED', { oneShot: oneShot === true }
      );
      savedResult = await queryProcessVersions(
        authRef, appType, processCode, 'SAVED', { oneShot: oneShot === true }
      );
    } catch (error) {
      failure(
        'CONFIGURE_PROCESS_QUERY_VERSIONS_FAILED',
        t('configure_process.querying_versions') + ': ' + error.message,
        'query_process_versions',
        error
      );
    }
    if (!publishedResult || publishedResult.success !== true) {
      failure(
        'CONFIGURE_PROCESS_QUERY_VERSIONS_FAILED',
        t('configure_process.querying_versions') + ': PUBLISHED: ' + formatApiError(publishedResult),
        'query_process_versions',
        publishedResult
      );
    }
    if (!savedResult || savedResult.success !== true) {
      failure(
        'CONFIGURE_PROCESS_QUERY_VERSIONS_FAILED',
        t('configure_process.querying_versions') + ': SAVED: ' + formatApiError(savedResult),
        'query_process_versions',
        savedResult
      );
    }
    return {
      published: latestProcessVersion(publishedResult),
      saved: latestProcessVersion(savedResult),
      savedVersions: processVersionItems(savedResult).slice(),
    };
  }

  warn('🔧 ' + t('configure_process.title'));
  warn('  ' + t('configure_process.app_id') + ': ' + appType);
  warn('  ' + t('configure_process.form_uuid') + ': ' + formUuid);
  warn('  ' + t('configure_process.definition_file') + ': ' + processDefinitionFile);

  if (!fs.existsSync(processDefinitionFile)) {
    failure(
      'CONFIGURE_PROCESS_FILE_NOT_FOUND',
      t('configure_process.file_not_found') + ': ' + processDefinitionFile,
      'read_definition'
    );
  }

  let definition;
  try {
    definition = JSON.parse(fs.readFileSync(processDefinitionFile, 'utf-8'));
  } catch (error) {
    failure(
      'CONFIGURE_PROCESS_INVALID_JSON',
      t('configure_process.parse_failed') + ': ' + error.message,
      'read_definition',
      error
    );
  }
  stageTracker.complete('read_definition');
  const authRef = createAuthRef();
  stageTracker.complete('load_auth');

  let compiled;
  try {
    compiled = buildProcessAndViewJson(
      definition,
      processCode || '__OPENYIDA_PENDING_PROCESS_CODE__',
      formUuid,
      authRef.baseUrl,
      appType,
      { onWarning: warn }
    );
  } catch (error) {
    failure(
      error.code || 'CONFIGURE_PROCESS_BUILD_FAILED',
      t('configure_process.building_json') + ': ' + error.message,
      'build_definition',
      error
    );
  }
  stageTracker.complete('build_definition');

  let initialMode;
  try {
    initialMode = await readFormMode(authRef, { appType, formUuid });
  } catch (error) {
    failure(
      'CONFIGURE_PROCESS_CODE_LOOKUP_FAILED',
      t('configure_process.no_process_code') + ': ' + error.message,
      'resolve_process_code',
      error,
      { remoteWrites: 0 }
    );
  }

  const startedAsReceipt = initialMode.mode === 'receipt';
  if (initialMode.mode === 'process') {
    if (processCodeArg && initialMode.processCode !== processCodeArg) {
      failure(
        'CONFIGURE_PROCESS_OWNERSHIP_UNVERIFIED',
        t('configure_process.ownership_unverified'),
        'resolve_process_code',
        null,
        {
          remoteWrites: 0,
          expectedProcessCode: processCodeArg,
          observedProcessCode: initialMode.processCode,
        }
      );
    }
    processCode = initialMode.processCode;
  } else if (processCodeArg) {
    failure(
      'CONFIGURE_PROCESS_OWNERSHIP_UNVERIFIED',
      t('configure_process.ownership_unverified'),
      'resolve_process_code',
      null,
      {
        remoteWrites: 0,
        expectedProcessCode: processCodeArg,
        observedProcessCode: null,
      }
    );
  }
  stageTracker.complete('preflight_form_mode');

  let versionState = { published: null, saved: null, savedVersions: [] };
  if (!startedAsReceipt) {
    versionState = await queryVersionState(false);
    stageTracker.complete('query_process_versions');
    if ((versionState.published || versionState.saved) && !replace) {
      failure(
        'CONFIGURE_PROCESS_REPLACE_REQUIRED',
        t('configure_process.replace_required'),
        'authorize_replacement',
        null,
        {
          remoteWrites: 0,
          published: !!versionState.published,
          saved: !!versionState.saved,
        }
      );
    }
    stageTracker.complete('authorize_replacement');
  }

  if (startedAsReceipt) {
    let switchResult;
    try {
      remoteWrites += 1;
      switchResult = await switchFormType(authRef, appType, formUuid, { oneShot: true });
    } catch (error) {
      failOneShotWrite(
        error,
        'switch_form_type',
        'switchFormType',
        t('configure_process.switch_warning')
      );
    }
    assertKnownWriteResult(switchResult, 'switch_form_type', 'switchFormType');
    if (!switchResult || switchResult.success !== true) {
      failure(
        'CONFIGURE_PROCESS_SWITCH_FAILED',
        t('configure_process.switch_warning') + ': ' + formatApiError(switchResult),
        'switch_form_type',
        switchResult
      );
    }
    stageTracker.complete('switch_form_type');

    let convertedMode;
    try {
      convertedMode = await readFormMode(authRef, { appType, formUuid }, { oneShot: true });
    } catch (error) {
      failure(
        'CONFIGURE_PROCESS_CODE_LOOKUP_FAILED',
        t('configure_process.no_process_code') + ': ' + error.message,
        'resolve_process_code',
        error
      );
    }
    if (!convertedMode || convertedMode.mode !== 'process' || !convertedMode.processCode) {
      failure(
        'CONFIGURE_PROCESS_CODE_NOT_FOUND',
        t('configure_process.no_process_code'),
        'resolve_process_code',
        convertedMode
      );
    }
    processCode = convertedMode.processCode;
    versionState = await queryVersionState(true);
    stageTracker.complete('query_process_versions');
  }
  stageTracker.complete('resolve_process_code');

  compiled.processJson.props.processCode = processCode;
  compiled.processJson.props.processInitUrl = authRef.baseUrl + '/alibaba/web/' + appType
    + '/inst/instStart.htm?processCode=' + processCode;

  let latestProcessId = versionState.published && rawProcessId(versionState.published);
  let latestVersion = versionNumber(versionState.published);
  const savedDraft = versionState.saved && versionNumber(versionState.saved) >= latestVersion
    ? versionState.saved
    : null;
  if (savedDraft) {
    latestProcessId = rawProcessId(savedDraft);
    latestVersion = versionNumber(savedDraft);
    newProcessId = latestProcessId;
    newVersion = latestVersion;
  } else {
    newVersion = latestVersion + 1;
    let draftResult;
    try {
      remoteWrites += 1;
      draftResult = await newDraftProcess(
        authRef,
        appType,
        processCode,
        formUuid,
        latestProcessId,
        newVersion,
        { oneShot: true }
      );
    } catch (error) {
      failOneShotWrite(
        error,
        'create_draft',
        'newDraftProcess',
        t('configure_process.draft_failed')
      );
    }
    assertKnownWriteResult(draftResult, 'create_draft', 'newDraftProcess');
    if (!draftResult || draftResult.success !== true) {
      failure(
        'CONFIGURE_PROCESS_DRAFT_FAILED',
        t('configure_process.draft_failed') + ': ' + formatApiError(draftResult),
        'create_draft',
        draftResult
      );
    }
    if (draftResult.content && typeof draftResult.content === 'object') {
      newProcessId = draftResult.content.processId || draftResult.content.id || null;
      const serverVersion = versionNumber(draftResult.content);
      if (serverVersion > 0) {
        newVersion = serverVersion;
      }
    } else if (typeof draftResult.content === 'number' || typeof draftResult.content === 'string') {
      newProcessId = draftResult.content;
    }
    if (!newProcessId) {
      let refreshedSaved;
      try {
        refreshedSaved = await queryProcessVersions(
          authRef, appType, processCode, 'SAVED', { oneShot: true }
        );
      } catch (error) {
        failure(
          'NON_IDEMPOTENT_RESULT_UNKNOWN',
          t('common.non_idempotent_result_unknown'),
          'create_draft',
          error,
          {
            operation: 'newDraftProcess',
            resultUnknown: true,
            nextStep: t('process_diagnostics.unknown_result'),
            identityRecovery: {
              requestedVersion: Number(newVersion),
              baseline: (versionState.savedVersions || []).map(versionIdentity).filter(Boolean),
              observed: [],
              candidates: [],
              candidateCount: 0,
              readbackFailed: true,
            },
          }
        );
      }
      const recovery = recoverNewDraftIdentity(
        versionState.savedVersions,
        processVersionItems(refreshedSaved),
        newVersion
      );
      if (!refreshedSaved || refreshedSaved.success !== true || recovery.candidateCount !== 1) {
        failure(
          'NON_IDEMPOTENT_RESULT_UNKNOWN',
          t('common.non_idempotent_result_unknown'),
          'create_draft',
          refreshedSaved,
          {
            operation: 'newDraftProcess',
            resultUnknown: true,
            nextStep: t('process_diagnostics.unknown_result'),
            identityRecovery: recovery,
          }
        );
      }
      newProcessId = recovery.candidates[0].rawProcessId;
      newVersion = recovery.candidates[0].processVersion;
    }
  }

  if (!newProcessId) {
    failure(
      'CONFIGURE_PROCESS_DRAFT_ID_NOT_FOUND',
      t('configure_process.no_draft_id'),
      'create_draft'
    );
  }
  stageTracker.complete('create_draft');

  const processJsonStr = JSON.stringify(compiled.processJson);
  const viewJsonStr = JSON.stringify(compiled.viewJson);
  let saveResult;
  try {
    remoteWrites += 1;
    saveResult = await saveProcessById(
      authRef,
      appType,
      formUuid,
      processCode,
      newProcessId,
      newVersion,
      processJsonStr,
      viewJsonStr,
      { oneShot: true }
    );
  } catch (error) {
    failOneShotWrite(
      error,
      'save_definition',
      'saveProcessById',
      t('configure_process.save_failed')
    );
  }
  assertKnownWriteResult(saveResult, 'save_definition', 'saveProcessById');
  if (!saveResult || saveResult.success !== true) {
    failure(
      'CONFIGURE_PROCESS_SAVE_FAILED',
      t('configure_process.save_failed') + ': ' + formatApiError(saveResult),
      'save_definition',
      saveResult
    );
  }
  stageTracker.complete('save_definition');

  let publishResult;
  try {
    remoteWrites += 1;
    publishResult = await publishProcessById(
      authRef,
      appType,
      formUuid,
      processCode,
      newProcessId,
      newVersion,
      { oneShot: true }
    );
  } catch (error) {
    failOneShotWrite(
      error,
      'publish_process',
      'publishProcessById',
      t('configure_process.publish_failed')
    );
  }
  assertKnownWriteResult(publishResult, 'publish_process', 'publishProcessById');
  if (!publishResult || publishResult.success !== true) {
    failure(
      'CONFIGURE_PROCESS_PUBLISH_FAILED',
      t('configure_process.publish_failed') + ': ' + formatApiError(publishResult),
      'publish_process',
      publishResult
    );
  }
  stageTracker.complete('publish_process');

  let publishedVersions;
  try {
    publishedVersions = await queryProcessVersions(
      authRef, appType, processCode, 'PUBLISHED', { oneShot: true }
    );
  } catch (error) {
    publishedUnverified(t('configure_process.published_unverified'), error);
  }
  if (!publishedVersions || publishedVersions.success !== true) {
    publishedUnverified(t('configure_process.published_unverified'), publishedVersions);
  }
  const exactPublished = exactProcessVersion(publishedVersions, newProcessId, newVersion);
  if (!exactPublished) {
    publishedUnverified(
      t('configure_process.published_unverified'),
      publishedVersions,
      { expectedProcessId: String(newProcessId), expectedProcessVersion: Number(newVersion) }
    );
  }

  let platformReadback;
  try {
    platformReadback = await getProcessById(authRef, {
      appType,
      formUuid,
      processCode,
      processId: processId(exactPublished),
      processVersion: versionNumber(exactPublished),
    }, { oneShot: true });
  } catch (error) {
    publishedUnverified(t('configure_process.published_unverified'), error);
  }
  const verification = verifyPlatformView(platformReadback, compiled.viewJson, formUuid);
  if (!verification.valid) {
    publishedUnverified(
      t('configure_process.published_unverified'),
      platformReadback,
      { verificationErrors: verification.errors }
    );
  }
  stageTracker.complete('verify_published_view');

  const output = {
    success: true,
    processCode,
    processId: newProcessId,
    processVersion: newVersion,
    appType,
    formUuid,
    verificationLevel: 'PLATFORM_VIEW_VERIFIED',
    platformViewVerified: true,
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
    exactProcessVersion,
    recoverNewDraftIdentity,
    verifyPlatformView,
  },
};
