#!/usr/bin/env node

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  addResource,
  createRegistry,
  runCli,
  writeRegistry,
} = require('../runner');
const { cleanupOwnedResources } = require('../cleanup');
const { createAuthRef } = require('../../../lib/core/yida-client');
const { compileProcessDefinition } = require('../../../lib/process/services/process-compiler');
const {
  getProcessById,
  queryProcessVersions,
} = require('../../../lib/process/services/process-service');
const {
  normalizeReadback,
  normalizeViewReadback,
  verifyContract,
  verifyViewContract,
} = require('../../eval/process-contract');
const { generateAllScenarios } = require('../../eval/process-contract/scenario-generator');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const DEFAULT_REGISTRY_DIR = path.join(ROOT, 'project', '.cache', 'e2e-real');
const DEFAULT_SCENARIO_ID = 'serial-approval';
const DEFAULT_DEFINITION_FILE = path.join(__dirname, 'fixtures', 'serial-approval.definition.json');
const ALLOWED_STATUSES = new Set([
  'passed',
  'failed',
  'skipped',
  'capability_blocked',
  'cleanup_blocked',
]);

function nowStamp(date = new Date()) {
  return date.toISOString().replace(/[-:TZ.]/g, '').slice(0, 17);
}

function createRunId(date = new Date(), randomBytes = crypto.randomBytes) {
  return `OY_PROC_${nowStamp(date)}_${randomBytes(3).toString('hex')}`;
}

function getConfig(env = process.env, date = new Date()) {
  const runId = createRunId(date);
  const readbackOnly = env.OPENYIDA_E2E_PROCESS_READBACK_ONLY === '1';
  const appType = env.OPENYIDA_E2E_APP_TYPE || '';
  const formUuid = env.OPENYIDA_E2E_FORM_UUID || '';
  const sourceRunId = env.OPENYIDA_E2E_PROCESS_SOURCE_RUN_ID || '';
  const missing = [];
  if (env.OPENYIDA_E2E !== '1') {missing.push('OPENYIDA_E2E=1');}
  if (readbackOnly) {
    if (!sourceRunId) {missing.push('OPENYIDA_E2E_PROCESS_SOURCE_RUN_ID');}
  } else {
    if (!appType) {missing.push('OPENYIDA_E2E_APP_TYPE');}
    if (!formUuid) {missing.push('OPENYIDA_E2E_FORM_UUID');}
  }
  return {
    enabled: missing.length === 0,
    missing,
    runId,
    namePrefix: `${runId}__`,
    appType,
    formUuid,
    processCode: env.OPENYIDA_E2E_PROCESS_CODE || '',
    processId: env.OPENYIDA_E2E_PROCESS_ID || '',
    processVersion: env.OPENYIDA_E2E_PROCESS_VERSION || null,
    readbackOnly,
    sourceRunId,
    sourceRegistryPath: env.OPENYIDA_E2E_PROCESS_SOURCE_REGISTRY || '',
    scenarioId: env.OPENYIDA_E2E_PROCESS_SCENARIO || DEFAULT_SCENARIO_ID,
    definitionFile: env.OPENYIDA_E2E_PROCESS_DEFINITION || DEFAULT_DEFINITION_FILE,
    registryDir: env.OPENYIDA_E2E_REGISTRY_DIR || DEFAULT_REGISTRY_DIR,
    baseUrl: env.OPENYIDA_E2E_BASE_URL || 'https://www.aliwork.com',
  };
}

function parseSingleJsonObject(stdout) {
  if (typeof stdout !== 'string' || stdout.trim() === '') {
    throw processError('PROCESS_E2E_STDOUT_INVALID', 'process command did not emit JSON on stdout');
  }
  let parsed;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch (error) {
    throw processError(
      'PROCESS_E2E_STDOUT_INVALID',
      `process command stdout must contain exactly one top-level JSON object: ${error.message}`
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw processError('PROCESS_E2E_STDOUT_INVALID', 'process command stdout JSON must be an object');
  }
  return parsed;
}

function processError(code, message, details) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) {error.details = details;}
  return error;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return filePath;
}

function findScenario(scenarioId, generateScenarios = generateAllScenarios) {
  const scenario = generateScenarios().find(function (item) { return item.id === scenarioId; });
  if (!scenario) {
    throw processError('PROCESS_E2E_SCENARIO_NOT_FOUND', `unknown process scenario: ${scenarioId}`);
  }
  return scenario;
}

function latestPublishedVersion(result) {
  const items = result && result.success && result.content && result.content.data;
  if (!Array.isArray(items) || items.length === 0) {return null;}
  return items.reduce(function (latest, item) {
    const currentVersion = Number(item.processVersion !== undefined ? item.processVersion : item.version) || 0;
    const latestVersion = latest
      ? Number(latest.processVersion !== undefined ? latest.processVersion : latest.version) || 0
      : -1;
    return currentVersion > latestVersion ? item : latest;
  }, null);
}

function createDefaultCommandAdapter() {
  return {
    run: function runCommand(args, env) {
      return runCli(args, env);
    },
  };
}

function createDefaultApiAdapter() {
  return {
    readback: async function readback(input) {
      const authRef = createAuthRef();
      let processId = input.processId || null;
      let processVersion = input.processVersion || null;
      if (!processId || processVersion === null || processVersion === undefined) {
        const versions = await queryProcessVersions(
          authRef,
          input.appType,
          input.processCode,
          'PUBLISHED'
        );
        const latest = latestPublishedVersion(versions);
        if (!latest || !latest.id) {
          throw processError(
            'PROCESS_E2E_PUBLISHED_VERSION_NOT_FOUND',
            `published process version not found for ${input.processCode}`
          );
        }
        processId = latest.id;
        processVersion = latest.processVersion !== undefined ? latest.processVersion : latest.version;
      }
      const rawProcessPayload = await getProcessById(authRef, {
        appType: input.appType,
        formUuid: input.formUuid,
        processCode: input.processCode,
        processId,
        processVersion,
      });
      return { rawProcessPayload, processId, processVersion };
    },
  };
}

function addEvidenceArtifact(registry, persistRegistry, registryPath, artifact) {
  registry.artifacts = registry.artifacts || [];
  registry.acceptance = registry.acceptance || { artifacts: [] };
  registry.acceptance.artifacts = registry.acceptance.artifacts || [];
  const normalized = {
    createdAt: new Date().toISOString(),
    retained: true,
    ...artifact,
  };
  registry.artifacts.push(normalized);
  registry.acceptance.artifacts.push(normalized);
  persistRegistry(registryPath, registry);
  return normalized;
}

function summarizeContractVerification(result) {
  return {
    verificationLevel: 'CONTRACT_VERIFIED',
    valid: result.valid === true,
    errors: result.errors || [],
    artifactHash: result.artifactHash || null,
    contractHash: result.contractHash || null,
    runtimeCases: result.runtimeCases || [],
  };
}

function summarizePlatformViewVerification(result) {
  return {
    verificationLevel: 'PLATFORM_VIEW_VERIFIED',
    valid: result.valid === true,
    errors: result.errors || [],
    artifactHash: result.artifactHash || null,
    verifiedAssertions: result.verifiedAssertions || [],
    observedCapabilities: result.observedCapabilities || [],
    unverifiedAssertions: result.unverifiedAssertions || [],
    runtimeRequired: result.runtimeRequired || [],
  };
}

function failedPlatformViewVerification(error) {
  return {
    verificationLevel: 'PLATFORM_VIEW_VERIFIED',
    valid: false,
    errors: [{
      code: error.code || 'PROCESS_VIEW_READBACK_NORMALIZE_FAILED',
      message: error.message,
    }],
    artifactHash: null,
    verifiedAssertions: [],
    observedCapabilities: [],
    unverifiedAssertions: [],
    runtimeRequired: [],
  };
}

function buildManifest(options) {
  const registry = options.registry;
  return {
    runId: options.runId,
    namePrefix: options.namePrefix,
    status: options.status,
    readbackOnly: options.readbackOnly === true,
    sourceRunId: options.sourceRunId || null,
    scenarioId: options.scenarioId,
    contractRevision: options.contractRevision,
    contractHash: options.contractHash,
    rawReadbackPath: options.rawReadbackPath,
    canonicalPath: options.canonicalPath,
    canonicalViewPath: options.canonicalViewPath || options.canonicalPath,
    canonicalHash: options.canonicalHash,
    validationErrors: options.validationErrors,
    contractVerification: options.contractVerification || null,
    platformViewVerification: options.platformViewVerification || null,
    error: options.error,
    cleanup: options.cleanup,
    resources: (registry.resources || []).filter(function (resource) {
      return resource.runId === options.runId;
    }),
    artifacts: (registry.artifacts || []).filter(function (artifact) {
      return artifact.runId === options.runId;
    }),
  };
}

function extractReadbackResult(result) {
  if (result && Object.prototype.hasOwnProperty.call(result, 'rawProcessPayload')) {
    return result;
  }
  return { rawProcessPayload: result, processId: null, processVersion: null };
}

function assertConfig(config) {
  if (!config.readbackOnly && (!config.appType || !config.formUuid)) {
    throw processError('PROCESS_E2E_CONFIG_INVALID', 'process runner requires appType and formUuid');
  }
  if (!config.definitionFile || !fs.existsSync(config.definitionFile)) {
    throw processError(
      'PROCESS_E2E_DEFINITION_NOT_FOUND',
      `process definition not found: ${config.definitionFile || ''}`
    );
  }
}

function lastResource(registry, type, sourceRunId) {
  return (registry.resources || []).slice().reverse().find(function (resource) {
    return resource.type === type && (!sourceRunId || resource.runId === sourceRunId);
  });
}

function resolveReadbackTarget(config) {
  let sourceRegistry = null;
  const sourceRunId = config.sourceRunId || '';
  const hasExplicitTarget = config.appType && config.formUuid && config.processCode
    && config.processId && config.processVersion !== null && config.processVersion !== undefined
    && config.processVersion !== '';
  if (!sourceRunId) {
    throw processError(
      'PROCESS_E2E_READBACK_SOURCE_REQUIRED',
      'readback-only requires sourceRunId'
    );
  }
  if (!hasExplicitTarget) {
    const sourceRegistryPath = config.sourceRegistryPath
      || path.join(config.registryDir || DEFAULT_REGISTRY_DIR, `${sourceRunId}.json`);
    if (!fs.existsSync(sourceRegistryPath)) {
      throw processError(
        'PROCESS_E2E_SOURCE_REGISTRY_NOT_FOUND',
        `source registry not found: ${sourceRegistryPath}`
      );
    }
    sourceRegistry = readJson(sourceRegistryPath);
    if (sourceRegistry.runId !== sourceRunId) {
      throw processError(
        'PROCESS_E2E_SOURCE_RUN_MISMATCH',
        `source registry runId does not match ${sourceRunId}`
      );
    }
  }
  const appResource = sourceRegistry && lastResource(sourceRegistry, 'app', sourceRunId);
  const formResource = sourceRegistry && lastResource(sourceRegistry, 'form', sourceRunId);
  const processResource = sourceRegistry && lastResource(sourceRegistry, 'process', sourceRunId);
  const target = {
    appType: config.appType || (processResource && processResource.appType)
      || (formResource && formResource.appType) || (appResource && (appResource.appType || appResource.exactId)),
    formUuid: config.formUuid || (processResource && processResource.formUuid)
      || (formResource && (formResource.formUuid || formResource.exactId)),
    processCode: config.processCode || (processResource && (processResource.processCode || processResource.exactId)),
    processId: config.processId || (processResource && processResource.processId),
    processVersion: config.processVersion !== null && config.processVersion !== undefined
      && config.processVersion !== '' ? config.processVersion : (processResource && processResource.processVersion),
  };
  const missing = Object.keys(target).filter(function (key) {
    return target[key] === null || target[key] === undefined || target[key] === '';
  });
  if (missing.length > 0) {
    throw processError(
      'PROCESS_E2E_READBACK_TARGET_INCOMPLETE',
      `readback-only target missing: ${missing.join(', ')}`
    );
  }
  return target;
}

async function run(options = {}) {
  const env = options.env || process.env;
  const config = options.config || getConfig(env);
  if (!config.enabled) {
    return { status: 'skipped', skipped: true, missing: config.missing || [] };
  }

  assertConfig(config);
  const runId = config.runId || createRunId();
  const namePrefix = config.namePrefix || `${runId}__`;
  const scenario = findScenario(config.scenarioId || DEFAULT_SCENARIO_ID, options.generateScenarios);
  const definition = readJson(config.definitionFile);
  const commandAdapter = options.commandAdapter || createDefaultCommandAdapter();
  const apiAdapter = options.apiAdapter || createDefaultApiAdapter();
  const persistRegistry = options.writeRegistry || writeRegistry;
  const trackResource = options.addResource || addResource;
  const registryFactory = options.createRegistry || createRegistry;
  const workDir = options.workDir || path.join(config.registryDir || DEFAULT_REGISTRY_DIR, runId);
  const artifactDir = path.join(workDir, 'artifacts');
  const tempDir = path.join(workDir, 'tmp');
  const providedRegistry = options.registry;
  const registryInfo = providedRegistry
    ? { registry: providedRegistry, registryPath: options.registryPath }
    : registryFactory({
      ...config,
      prefix: runId,
      registryDir: config.registryDir || DEFAULT_REGISTRY_DIR,
    });
  const registry = registryInfo.registry;
  const registryPath = registryInfo.registryPath;
  const processRun = {
    runId,
    namePrefix,
    readbackOnly: config.readbackOnly === true,
    sourceRunId: config.sourceRunId || null,
    scenarioId: scenario.id,
    contractRevision: `schema-${scenario.hiddenContract.schemaVersion}-protocol-${scenario.hiddenContract.protocolVersion}`,
    contractHash: scenario.contractHash,
    status: 'failed',
    rawReadbackPath: null,
    canonicalPath: null,
    canonicalViewPath: null,
    canonicalHash: null,
    validationErrors: [],
    contractVerification: null,
    platformViewVerification: null,
    error: null,
    cleanup: null,
  };
  registry.processRuns = registry.processRuns || [];
  registry.processRuns.push(processRun);
  persistRegistry(registryPath, registry);

  let primaryError = null;
  let processResource = null;
  let readbackTarget = null;

  try {
    if (config.readbackOnly) {
      if (config.sourceRunId === runId) {
        throw processError(
          'PROCESS_E2E_SOURCE_RUN_REUSE_FORBIDDEN',
          'readback-only runId must differ from sourceRunId'
        );
      }
      readbackTarget = resolveReadbackTarget(config);
    }
    const compiledArtifact = compileProcessDefinition(definition, {
      processCode: '__OPENYIDA_E2E_PREFLIGHT__',
      formUuid: config.formUuid || (readbackTarget && readbackTarget.formUuid),
      baseUrl: config.baseUrl || 'https://www.aliwork.com',
      appType: config.appType || (readbackTarget && readbackTarget.appType),
    });
    const contractResult = verifyContract(
      scenario.hiddenContract,
      normalizeReadback(compiledArtifact)
    );
    processRun.contractVerification = summarizeContractVerification(contractResult);
    persistRegistry(registryPath, registry);
    if (!contractResult.valid) {
      processRun.validationErrors = contractResult.errors || [];
      throw processError(
        'PROCESS_E2E_PREFLIGHT_CONTRACT_FAILED',
        `compiled process contract failed with ${processRun.validationErrors.length} error(s)`,
        processRun.validationErrors
      );
    }

    if (!config.readbackOnly) {
      fs.mkdirSync(tempDir, { recursive: true });
      const runtimeDefinitionPath = path.join(tempDir, `${namePrefix}definition.json`);
      fs.copyFileSync(config.definitionFile, runtimeDefinitionPath);
      trackResource(registry, registryPath, {
        runId,
        owned: true,
        type: 'local-artifact',
        exactId: tempDir,
        path: tempDir,
        name: `${namePrefix}tmp`,
      });

      const commandArgs = [
        'create-process',
        config.appType,
        '--formUuid',
        config.formUuid,
        runtimeDefinitionPath,
        '--quiet',
      ];
      const commandResult = await commandAdapter.run(commandArgs, env);
      registry.commands = registry.commands || [];
      registry.commands.push({
        name: 'process-mvp-create-publish',
        args: commandArgs,
        completedAt: new Date().toISOString(),
      });
      persistRegistry(registryPath, registry);
      if (commandResult && typeof commandResult.status === 'number' && commandResult.status !== 0) {
        throw processError(
          'PROCESS_E2E_COMMAND_FAILED',
          commandResult.stderr || `create-process exited with ${commandResult.status}`
        );
      }
      const published = parseSingleJsonObject(commandResult && commandResult.stdout);
      if (published.success === false || !published.processCode) {
        throw processError(
          'PROCESS_E2E_PUBLISH_FAILED',
          `create-process did not return a successful processCode: ${JSON.stringify(published)}`
        );
      }

      trackResource(registry, registryPath, {
        runId,
        owned: true,
        type: 'process',
        exactId: published.processCode,
        appType: published.appType || config.appType,
        formUuid: published.formUuid || config.formUuid,
        processCode: published.processCode,
        processId: published.processId || null,
        processVersion: published.processVersion || null,
        name: `${namePrefix}Process`,
        url: published.url || null,
      });
      processResource = (registry.resources || []).slice().reverse().find(function (resource) {
        return resource.runId === runId && resource.type === 'process';
      });
      readbackTarget = {
        appType: config.appType,
        formUuid: config.formUuid,
        processCode: published.processCode,
        processId: published.processId,
        processVersion: published.processVersion,
      };
    }

    const readback = extractReadbackResult(await apiAdapter.readback({
      appType: readbackTarget.appType,
      formUuid: readbackTarget.formUuid,
      processCode: readbackTarget.processCode,
      processId: readbackTarget.processId,
      processVersion: readbackTarget.processVersion,
    }));
    if (processResource) {
      processResource.processId = readback.processId || processResource.processId;
      processResource.processVersion = readback.processVersion || processResource.processVersion;
      persistRegistry(registryPath, registry);
    }

    processRun.rawReadbackPath = writeJson(
      path.join(artifactDir, `${namePrefix}readback-raw.json`),
      readback.rawProcessPayload
    );
    addEvidenceArtifact(registry, persistRegistry, registryPath, {
      runId,
      owned: true,
      type: 'process-readback-raw',
      name: `${namePrefix}readback-raw`,
      path: processRun.rawReadbackPath,
    });

    let canonicalView;
    try {
      canonicalView = normalizeViewReadback(readback.rawProcessPayload);
    } catch (error) {
      processRun.platformViewVerification = failedPlatformViewVerification(error);
      processRun.validationErrors = processRun.platformViewVerification.errors;
      throw error;
    }
    processRun.canonicalViewPath = writeJson(
      path.join(artifactDir, `${namePrefix}readback-view-canonical.json`),
      canonicalView
    );
    processRun.canonicalPath = processRun.canonicalViewPath;
    addEvidenceArtifact(registry, persistRegistry, registryPath, {
      runId,
      owned: true,
      type: 'process-readback-view-canonical',
      name: `${namePrefix}readback-view-canonical`,
      path: processRun.canonicalViewPath,
    });

    const platformViewResult = verifyViewContract(scenario.hiddenContract, canonicalView);
    processRun.platformViewVerification = summarizePlatformViewVerification(platformViewResult);
    processRun.canonicalHash = platformViewResult.artifactHash;
    processRun.validationErrors = platformViewResult.errors || [];
    if (!platformViewResult.valid) {
      throw processError(
        'PROCESS_E2E_PLATFORM_VIEW_CONTRACT_FAILED',
        `platform process view contract failed with ${processRun.validationErrors.length} error(s)`,
        processRun.validationErrors
      );
    }
    processRun.status = 'passed';
  } catch (error) {
    primaryError = error;
    processRun.status = 'failed';
    processRun.error = {
      code: error.code || 'PROCESS_E2E_FAILED',
      message: error.message,
    };
  } finally {
    processRun.cleanup = cleanupOwnedResources({
      registry,
      runId,
      namePrefix,
      localRoot: workDir,
      removePath: options.removePath,
    });
    if (!primaryError && processRun.cleanup.status === 'cleanup_blocked') {
      processRun.status = 'cleanup_blocked';
    }
    if (!ALLOWED_STATUSES.has(processRun.status)) {
      processRun.status = 'failed';
    }

    const manifestPath = path.join(workDir, 'acceptance-manifest.json');
    addEvidenceArtifact(registry, persistRegistry, registryPath, {
      runId,
      owned: true,
      type: 'process-acceptance-manifest',
      name: `${namePrefix}acceptance-manifest`,
      path: manifestPath,
    });
    writeJson(manifestPath, buildManifest({
      registry,
      runId,
      namePrefix,
      status: processRun.status,
      readbackOnly: processRun.readbackOnly,
      sourceRunId: processRun.sourceRunId,
      scenarioId: processRun.scenarioId,
      contractRevision: processRun.contractRevision,
      contractHash: processRun.contractHash,
      rawReadbackPath: processRun.rawReadbackPath,
      canonicalPath: processRun.canonicalPath,
      canonicalViewPath: processRun.canonicalViewPath,
      canonicalHash: processRun.canonicalHash,
      validationErrors: processRun.validationErrors,
      contractVerification: processRun.contractVerification,
      platformViewVerification: processRun.platformViewVerification,
      error: processRun.error,
      cleanup: processRun.cleanup,
    }));
    processRun.manifestPath = manifestPath;
    if (!providedRegistry || registry.runId === runId) {
      registry.status = processRun.status;
      registry.finishedAt = new Date().toISOString();
    }
    persistRegistry(registryPath, registry);
  }

  const result = {
    skipped: false,
    status: processRun.status,
    runId,
    namePrefix,
    readbackOnly: processRun.readbackOnly,
    sourceRunId: processRun.sourceRunId,
    scenarioId: processRun.scenarioId,
    contractRevision: processRun.contractRevision,
    contractHash: processRun.contractHash,
    canonicalHash: processRun.canonicalHash,
    validationErrors: processRun.validationErrors,
    contractVerification: processRun.contractVerification,
    platformViewVerification: processRun.platformViewVerification,
    rawReadbackPath: processRun.rawReadbackPath,
    canonicalViewPath: processRun.canonicalViewPath,
    manifestPath: processRun.manifestPath,
    cleanup: processRun.cleanup,
    processCode: readbackTarget && readbackTarget.processCode,
    processId: (processResource && processResource.processId) || (readbackTarget && readbackTarget.processId),
    processVersion: (processResource && processResource.processVersion)
      || (readbackTarget && readbackTarget.processVersion),
    registryPath,
  };
  if (primaryError) {
    primaryError.processResult = result;
    throw primaryError;
  }
  return result;
}

if (require.main === module) {
  run().then(function (result) {
    console.log(JSON.stringify(result));
  }).catch(function (error) {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  ALLOWED_STATUSES,
  DEFAULT_DEFINITION_FILE,
  DEFAULT_SCENARIO_ID,
  buildManifest,
  createDefaultApiAdapter,
  createDefaultCommandAdapter,
  createRunId,
  getConfig,
  latestPublishedVersion,
  parseSingleJsonObject,
  run,
};
