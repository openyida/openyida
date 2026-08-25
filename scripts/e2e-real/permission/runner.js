#!/usr/bin/env node

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { parseLastJson } = require('../runner');
const { fetchFormPageList } = require('../../../lib/app/form-navigation');
const {
  createAuthRef,
  createYidaClient,
  isAuthRefReady,
} = require('../../../lib/core/yida-client');
const {
  VALID_OPERATE_KEYS,
  fetchPermitPackages,
  savePermitPackage,
} = require('../../../lib/permission/save-permission');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const BIN = path.join(ROOT, 'bin', 'yida.js');
const DEFAULT_REGISTRY_DIR = path.join(ROOT, 'project', '.cache', 'e2e-real', 'permission');
const PROCESS_REGISTRY_PATTERN = /^OY_PROC.*\.json$/;
const TARGET_ROLE = 'DEFAULT';

function nowStamp(date = new Date()) {
  return date.toISOString().replace(/[-:TZ.]/g, '').slice(0, 17);
}

function createRunId(date = new Date(), randomBytes = crypto.randomBytes) {
  return `OY_PERM_${nowStamp(date)}_${randomBytes(3).toString('hex')}`;
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getConfig(env = process.env, date = new Date()) {
  const runId = env.OPENYIDA_E2E_PERMISSION_RUN_ID || createRunId(date);
  const processRegistryDir = env.OPENYIDA_E2E_PERMISSION_PROCESS_REGISTRY_DIR || '';
  const integrationRegistryPath = env.OPENYIDA_E2E_PERMISSION_INTEGRATION_REGISTRY || '';
  const explicitAppType = env.OPENYIDA_E2E_PERMISSION_APP_TYPE || '';
  const explicitFormUuid = env.OPENYIDA_E2E_PERMISSION_FORM_UUID || '';
  const missing = [];
  if (env.OPENYIDA_E2E !== '1') {missing.push('OPENYIDA_E2E=1');}
  if (env.OPENYIDA_E2E_PERMISSION !== '1') {missing.push('OPENYIDA_E2E_PERMISSION=1');}
  if (!processRegistryDir) {missing.push('OPENYIDA_E2E_PERMISSION_PROCESS_REGISTRY_DIR');}
  if (!integrationRegistryPath) {missing.push('OPENYIDA_E2E_PERMISSION_INTEGRATION_REGISTRY');}
  if (!!explicitAppType !== !!explicitFormUuid) {
    missing.push('OPENYIDA_E2E_PERMISSION_APP_TYPE + OPENYIDA_E2E_PERMISSION_FORM_UUID');
  }
  return {
    enabled: missing.length === 0,
    missing,
    runId,
    namePrefix: `${runId}__`,
    registryDir: env.OPENYIDA_E2E_REGISTRY_DIR || DEFAULT_REGISTRY_DIR,
    processRegistryDir,
    integrationRegistryPath,
    expectedProcessResiduals: toPositiveInt(env.OPENYIDA_E2E_PERMISSION_EXPECTED_PROCESS_RESIDUALS, 29),
    expectedIntegrationResiduals: toPositiveInt(env.OPENYIDA_E2E_PERMISSION_EXPECTED_INTEGRATION_RESIDUALS, 6),
    explicitAppType,
    explicitFormUuid,
    maxApps: toPositiveInt(env.OPENYIDA_E2E_PERMISSION_MAX_APPS, 20),
    maxForms: toPositiveInt(env.OPENYIDA_E2E_PERMISSION_MAX_FORMS, 80),
  };
}

function permissionError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function assertOwnedChange(resource, options) {
  const runId = options.runId;
  const namePrefix = options.namePrefix || `${runId}__`;
  if (!resource
    || resource.runId !== runId
    || resource.owned !== true
    || !resource.name
    || !String(resource.name).startsWith(namePrefix)) {
    throw permissionError('PERMISSION_E2E_RESTORE_OWNERSHIP_UNPROVEN', 'restore ownership could not be proven');
  }
  return {
    status: 'passed',
    runIdMatched: true,
    ownedFlag: true,
    namePrefixMatched: true,
    ownedResourceCount: 1,
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return filePath;
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce(function (result, key) {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
  }
  return value;
}

function parseJsonValue(value, label) {
  if (value === null || value === undefined || value === '') {return {};}
  if (typeof value === 'object' && !Array.isArray(value)) {return value;}
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object');
    }
    return parsed;
  } catch {
    throw permissionError('PERMISSION_E2E_READBACK_INVALID', `${label} readback is not a JSON object`);
  }
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function normalizePackageField(value) {
  if (typeof value !== 'string') {return canonicalize(value);}
  try {
    return canonicalize(JSON.parse(value));
  } catch {
    return value;
  }
}

function packageSnapshot(permitPackage, options = {}) {
  const snapshot = {
    packageUuid: permitPackage.packageUuid || null,
    packageType: permitPackage.packageType || null,
    packageName: normalizePackageField(permitPackage.packageName),
    description: normalizePackageField(permitPackage.description),
    roleData: normalizePackageField(permitPackage.roleData),
    dataPermit: normalizePackageField(permitPackage.dataPermit),
    customButtonPermit: normalizePackageField(permitPackage.customButtonPermit),
    fieldPermit: normalizePackageField(permitPackage.fieldPermit),
    viewData: normalizePackageField(permitPackage.viewData),
  };
  if (!options.excludeOperate) {
    snapshot.operatePermit = canonicalize(parseJsonValue(permitPackage.operatePermit, 'operatePermit'));
  }
  return snapshot;
}

function packageFingerprint(permitPackage, options) {
  return hash(canonicalJson(packageSnapshot(permitPackage, options)));
}

function operateFingerprint(value) {
  return hash(canonicalJson(parseJsonValue(value, 'operatePermit')));
}

function packageRoleTypes(permitPackage) {
  const types = new Set((permitPackage.roleMembers || [])
    .map(item => item && item.roleType)
    .filter(Boolean));
  const roleData = parseJsonValue(permitPackage.roleData || { include: [] }, 'roleData');
  for (const item of Array.isArray(roleData.include) ? roleData.include : []) {
    if (item && item.roleType) {types.add(item.roleType);}
  }
  return types;
}

function isSafeOperatePermit(permitPackage) {
  let operatePermit;
  try {
    operatePermit = parseJsonValue(permitPackage.operatePermit, 'operatePermit');
  } catch {
    return false;
  }
  return Object.entries(operatePermit).every(function ([key, value]) {
    return VALID_OPERATE_KEYS.includes(key) && (value === 'y' || value === true);
  });
}

function targetPackageFromPackages(packages) {
  if (!Array.isArray(packages) || packages.length === 0 || packages.length >= 20) {return null;}
  const matches = packages.filter(function (permitPackage) {
    return (!permitPackage.packageType || permitPackage.packageType === 'FORM_PACKAGE_VIEW')
      && permitPackage.packageUuid
      && packageRoleTypes(permitPackage).has(TARGET_ROLE)
      && isSafeOperatePermit(permitPackage);
  });
  return matches.length === 1 ? matches[0] : null;
}

function selectTarget(candidates, excludedIds = new Set()) {
  const eligible = (candidates || []).filter(function (candidate) {
    return candidate && candidate.appType && candidate.formUuid && candidate.package
      && !excludedIds.has(candidate.appType)
      && !excludedIds.has(candidate.formUuid)
      && !excludedIds.has(candidate.package.packageUuid)
      && (!candidate.package.packageType || candidate.package.packageType === 'FORM_PACKAGE_VIEW')
      && packageRoleTypes(candidate.package).has(TARGET_ROLE)
      && isSafeOperatePermit(candidate.package);
  }).sort(function (left, right) {
    return `${left.appType}\u0000${left.formUuid}\u0000${left.package.packageUuid}`
      .localeCompare(`${right.appType}\u0000${right.formUuid}\u0000${right.package.packageUuid}`);
  });
  if (eligible.length === 0) {
    throw permissionError('PERMISSION_E2E_TARGET_NOT_FOUND', 'no deterministic non-residual permission target was found');
  }
  return eligible[0];
}

function buildMutation(permitPackage) {
  const beforeOperatePermit = parseJsonValue(permitPackage.operatePermit, 'operatePermit');
  if (!isSafeOperatePermit(permitPackage)) {
    throw permissionError('PERMISSION_E2E_OPERATE_UNSAFE', 'target operatePermit is not safely mutable');
  }
  const preferred = ['OPERATE_COMMENT', ...VALID_OPERATE_KEYS.filter(key => key !== 'OPERATE_COMMENT')];
  const operationToAdd = preferred.find(key => !Object.prototype.hasOwnProperty.call(beforeOperatePermit, key));
  let operation = operationToAdd;
  let expectedOperatePermit;
  if (operationToAdd) {
    expectedOperatePermit = { ...beforeOperatePermit, [operationToAdd]: 'y' };
  } else {
    operation = preferred.find(key => Object.prototype.hasOwnProperty.call(beforeOperatePermit, key));
    expectedOperatePermit = { ...beforeOperatePermit };
    delete expectedOperatePermit[operation];
  }
  if (!operation || Object.keys(expectedOperatePermit).length === 0) {
    throw permissionError('PERMISSION_E2E_MUTATION_UNAVAILABLE', 'no non-empty one-key action mutation is available');
  }
  return {
    operation,
    direction: operationToAdd ? 'add' : 'remove',
    beforeOperatePermit,
    expectedOperatePermit,
  };
}

function collectResourceIds(resources, targetSet) {
  for (const resource of resources || []) {
    for (const key of ['exactId', 'appType', 'formUuid', 'processCode', 'processId']) {
      if (resource && resource[key]) {targetSet.add(String(resource[key]));}
    }
  }
}

function loadExclusionEvidence(config) {
  if (!config.processRegistryDir || !fs.existsSync(config.processRegistryDir)) {
    throw permissionError('PERMISSION_E2E_PROCESS_REGISTRY_MISSING', 'process residual registry directory is unavailable');
  }
  if (!config.integrationRegistryPath || !fs.existsSync(config.integrationRegistryPath)) {
    throw permissionError('PERMISSION_E2E_INTEGRATION_REGISTRY_MISSING', 'integration residual registry is unavailable');
  }
  const excludedIds = new Set();
  const processFiles = fs.readdirSync(config.processRegistryDir)
    .filter(file => PROCESS_REGISTRY_PATTERN.test(file))
    .sort();
  let processResidualCount = 0;
  for (const file of processFiles) {
    const registry = readJson(path.join(config.processRegistryDir, file));
    const remoteResources = (registry.resources || []).filter(resource => resource.type !== 'local-artifact');
    processResidualCount += remoteResources.length;
    collectResourceIds(remoteResources, excludedIds);
  }
  const integrationRegistry = readJson(config.integrationRegistryPath);
  const integrationResources = integrationRegistry.resources || [];
  const integrationResidualCount = integrationResources.length;
  collectResourceIds(integrationResources, excludedIds);
  if (processResidualCount !== config.expectedProcessResiduals) {
    throw permissionError('PERMISSION_E2E_PROCESS_RESIDUAL_COUNT_MISMATCH', 'process residual count does not match the frozen gate');
  }
  if (integrationResidualCount !== config.expectedIntegrationResiduals) {
    throw permissionError('PERMISSION_E2E_INTEGRATION_RESIDUAL_COUNT_MISMATCH', 'integration residual count does not match the frozen gate');
  }
  return {
    excludedIds,
    processResidualCount,
    integrationResidualCount,
    sourceCount: processFiles.length + 1,
  };
}

async function fetchApps(authRef, maxApps) {
  const result = await createYidaClient({ authRef }).get('/query/app/getAppList.json', ref => ({
    _api: 'nattyFetch',
    _mock: 'false',
    pageIndex: 1,
    pageSize: maxApps,
    creator: ref.userId,
    _stamp: Date.now(),
  }));
  if (!result || result.success === false || !result.content || !Array.isArray(result.content.data)) {
    throw permissionError('PERMISSION_E2E_APP_DISCOVERY_FAILED', 'application discovery failed');
  }
  return result.content.data.slice(0, maxApps);
}

function unwrapPackages(result) {
  if (!result || result.success === false) {
    throw permissionError('PERMISSION_E2E_READBACK_FAILED', 'permission readback failed');
  }
  return (result.content && result.content.formPermit) || [];
}

async function discoverCandidates(config, authRef, excludedIds) {
  const counts = { appsScanned: 0, formsScanned: 0, permissionCandidates: 0, readErrors: 0 };
  const candidates = [];
  if (config.explicitAppType && config.explicitFormUuid) {
    const packages = unwrapPackages(await fetchPermitPackages(config.explicitAppType, config.explicitFormUuid, authRef));
    const permitPackage = targetPackageFromPackages(packages);
    counts.appsScanned = 1;
    counts.formsScanned = 1;
    if (permitPackage) {
      candidates.push({ appType: config.explicitAppType, formUuid: config.explicitFormUuid, package: permitPackage });
      counts.permissionCandidates = 1;
    }
    return { candidates, counts };
  }
  const apps = (await fetchApps(authRef, config.maxApps))
    .filter(app => app && app.appType && !excludedIds.has(app.appType))
    .sort((left, right) => String(left.appType).localeCompare(String(right.appType)));
  for (const app of apps) {
    if (counts.formsScanned >= config.maxForms) {break;}
    counts.appsScanned += 1;
    let forms;
    try {
      forms = await fetchFormPageList(app.appType, authRef);
    } catch {
      counts.readErrors += 1;
      continue;
    }
    const sortedForms = forms
      .filter(form => form && form.formUuid && !excludedIds.has(form.formUuid))
      .sort((left, right) => String(left.formUuid).localeCompare(String(right.formUuid)));
    for (const form of sortedForms) {
      if (counts.formsScanned >= config.maxForms) {break;}
      counts.formsScanned += 1;
      try {
        const packages = unwrapPackages(await fetchPermitPackages(app.appType, form.formUuid, authRef));
        const permitPackage = targetPackageFromPackages(packages);
        if (permitPackage) {
          candidates.push({ appType: app.appType, formUuid: form.formUuid, package: permitPackage });
          counts.permissionCandidates += 1;
        }
      } catch {
        counts.readErrors += 1;
      }
    }
  }
  return { candidates, counts };
}

function createDefaultAdapters(authRef, env) {
  return {
    readPackages: async function readPackages(target) {
      return unwrapPackages(await fetchPermitPackages(target.appType, target.formUuid, authRef));
    },
    mutate: async function mutate(target, mutation) {
      const actionPermission = {
        role: TARGET_ROLE,
        operations: Object.keys(mutation.expectedOperatePermit).reduce(function (result, key) {
          result[key] = true;
          return result;
        }, {}),
      };
      const command = spawnSync(process.execPath, [
        BIN,
        'save-permission',
        target.appType,
        target.formUuid,
        '--action-permission',
        JSON.stringify(actionPermission),
        '--quiet',
      ], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...env, OPENYIDA_LANG: 'en', CI: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 120000,
      });
      if (command.status !== 0) {
        throw permissionError('PERMISSION_E2E_MUTATION_COMMAND_FAILED', 'save-permission mutation command failed');
      }
      const output = parseLastJson(command.stdout || '');
      if (!output || output.success !== true) {
        throw permissionError('PERMISSION_E2E_MUTATION_RESULT_INVALID', 'save-permission mutation result was not successful JSON');
      }
      return output;
    },
    restore: async function restore(target, restorePackage) {
      const result = await savePermitPackage(target.appType, target.formUuid, restorePackage, null, authRef);
      if (!result || result.success !== true) {
        throw permissionError('PERMISSION_E2E_RESTORE_WRITE_FAILED', 'permission restore request failed');
      }
      return result;
    },
  };
}

function findExactPackage(packages, packageUuid) {
  return (packages || []).find(permitPackage => permitPackage.packageUuid === packageUuid) || null;
}

function assertExactTarget(packages, target) {
  const permitPackage = findExactPackage(packages, target.package.packageUuid);
  const uniqueTarget = targetPackageFromPackages(packages);
  if (!permitPackage || !uniqueTarget || uniqueTarget.packageUuid !== permitPackage.packageUuid) {
    throw permissionError('PERMISSION_E2E_TARGET_CHANGED', 'exact permission target is no longer unique');
  }
  return permitPackage;
}

function writeEvidence(workDir, name, value) {
  const evidencePath = writeJson(path.join(workDir, 'artifacts', `${name}.json`), value);
  return { path: evidencePath, sha256: hash(fs.readFileSync(evidencePath)) };
}

function sanitizedError(error) {
  if (!error) {return null;}
  return { code: error.code || 'PERMISSION_E2E_FAILED', message: error.message };
}

function recordTrace(registry, step, status) {
  registry.trace.push({ step, status, recordedAt: new Date().toISOString() });
}

function createManifest(registry) {
  return {
    schemaVersion: 1,
    runId: registry.runId,
    status: registry.status,
    target: registry.target,
    sample: registry.sample,
    resourceCounts: registry.resourceCounts,
    ownership: registry.ownership,
    exclusionGuard: registry.exclusionGuard,
    deterministicReadback: registry.deterministicReadback,
    mutation: registry.mutation,
    restore: registry.restore,
    cleanup: registry.cleanup,
    artifacts: registry.artifacts,
    trace: registry.trace,
    error: registry.error,
    startedAt: registry.startedAt,
    finishedAt: registry.finishedAt,
  };
}

function persistCheckpoint(persist, registryPath, manifestPath, registry) {
  persist(registryPath, registry);
  persist(manifestPath, createManifest(registry));
}

async function performOwnedRestore(input) {
  const {
    before,
    changeResource,
    env,
    mutation,
    namePrefix,
    options,
    persist,
    registry,
    registryPath,
    manifestPath,
    runId,
    target,
    workDir,
  } = input;
  let readPackages = options.readPackages;
  let restore = options.restore;
  if (!readPackages || !restore) {
    const authRef = options.authRef || createAuthRef();
    const adapters = createDefaultAdapters(authRef, env);
    readPackages = readPackages || adapters.readPackages;
    restore = restore || adapters.restore;
  }
  const preRestorePackages = await readPackages(target);
  const current = assertExactTarget(preRestorePackages, target);
  const currentOperateFingerprint = operateFingerprint(current.operatePermit);
  const mutatedFingerprint = operateFingerprint(mutation.expectedOperatePermit);
  const beforeFingerprint = operateFingerprint(mutation.beforeOperatePermit);
  if (currentOperateFingerprint === mutatedFingerprint) {
    assertOwnedChange(changeResource, { runId, namePrefix });
    const preRestoreEvidence = writeEvidence(workDir, 'restore-precheck-raw', current);
    registry.artifacts.push({ type: 'permission-restore-precheck-raw', path: preRestoreEvidence.path, sha256: preRestoreEvidence.sha256, retained: true });
    const restorePackage = { ...current, operatePermit: before.operatePermit };
    registry.commands.push({ name: 'permission-owned-restore', sideEffect: true, status: 'running' });
    registry.restore = { status: 'pre_write', exactReadback: false };
    persistCheckpoint(persist, registryPath, manifestPath, registry);
    await restore(target, restorePackage);
    registry.commands[registry.commands.length - 1].status = 'passed';
    registry.restore = { status: 'write_succeeded_readback_pending', exactReadback: false };
    persistCheckpoint(persist, registryPath, manifestPath, registry);
    const restoredPackages = await readPackages(target);
    const restored = assertExactTarget(restoredPackages, target);
    if (operateFingerprint(restored.operatePermit) !== beforeFingerprint
      || packageFingerprint(restored, { excludeOperate: true }) !== packageFingerprint(current, { excludeOperate: true })) {
      throw permissionError('PERMISSION_E2E_RESTORE_READBACK_MISMATCH', 'restore exact readback did not return the owned dimension to before');
    }
    const restoredEvidence = writeEvidence(workDir, 'restored-raw', restored);
    registry.artifacts.push({ type: 'permission-restored-raw', path: restoredEvidence.path, sha256: restoredEvidence.sha256, retained: true });
    changeResource.restored = true;
    registry.resourceCounts.restored = 1;
    registry.restore = {
      status: 'passed',
      exactReadback: true,
      beforeFingerprint,
      restoredFingerprint: operateFingerprint(restored.operatePermit),
      nonOwnedPreserved: true,
    };
    registry.cleanup = { status: 'passed', ownedResidualCount: 0, unrelatedResidualsTouched: 0 };
    recordTrace(registry, 'owned-restore-readback', 'passed');
    persistCheckpoint(persist, registryPath, manifestPath, registry);
    return;
  }
  if (currentOperateFingerprint === beforeFingerprint) {
    registry.restore = { status: 'not_needed', exactReadback: true, beforeFingerprint };
    registry.cleanup = { status: 'passed', ownedResidualCount: 0, unrelatedResidualsTouched: 0 };
    recordTrace(registry, 'owned-restore', 'not_needed');
    persistCheckpoint(persist, registryPath, manifestPath, registry);
    return;
  }
  throw permissionError('PERMISSION_E2E_RESTORE_OWNERSHIP_LOST', 'owned operatePermit changed before restore; overwrite was blocked');
}

async function run(options = {}) {
  const env = options.env || process.env;
  const config = options.config || getConfig(env);
  if (!config.enabled) {
    return { skipped: true, status: 'skipped', missing: config.missing || [] };
  }
  const runId = config.runId || createRunId();
  const namePrefix = config.namePrefix || `${runId}__`;
  const workDir = options.workDir || path.join(config.registryDir || DEFAULT_REGISTRY_DIR, runId);
  const registryPath = path.join(workDir, 'registry.json');
  const manifestPath = path.join(workDir, 'acceptance-manifest.json');
  const persist = options.writeJson || writeJson;
  const registry = {
    schemaVersion: 1,
    runId,
    namePrefix,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: 'running',
    ownershipPolicy: 'runId + owned=true + namePrefix; restore only exact owned operatePermit',
    ownership: { status: 'pending', ownedResourceCount: 0 },
    target: null,
    sample: null,
    resourceCounts: { created: 0, mutated: 0, restored: 0 },
    exclusionGuard: null,
    deterministicReadback: { status: 'pending' },
    mutation: { status: 'pending', exactReadback: false },
    restore: { status: 'pending', exactReadback: false },
    cleanup: { status: 'pending', ownedResidualCount: 0 },
    resources: [],
    commands: [],
    artifacts: [],
    trace: [],
    error: null,
  };
  fs.mkdirSync(workDir, { recursive: true });
  persistCheckpoint(persist, registryPath, manifestPath, registry);

  let primaryError = null;
  let restoreError = null;
  let target = null;
  let before = null;
  let mutation = null;
  let mutationAttempted = false;
  let mutationConfirmed = false;
  let changeResource = null;

  try {
    const exclusionEvidence = options.exclusionEvidence || loadExclusionEvidence(config);
    registry.exclusionGuard = {
      status: 'passed',
      processResidualCount: exclusionEvidence.processResidualCount,
      integrationResidualCount: exclusionEvidence.integrationResidualCount,
      sourceCount: exclusionEvidence.sourceCount,
    };
    registry.resourceCounts.processResidualsExcluded = exclusionEvidence.processResidualCount;
    registry.resourceCounts.integrationResidualsExcluded = exclusionEvidence.integrationResidualCount;
    recordTrace(registry, 'residual-exclusion', 'passed');
    persistCheckpoint(persist, registryPath, manifestPath, registry);

    const needsDefaultAuth = !options.discoverCandidates || !options.readPackages || !options.mutate || !options.restore;
    const authRef = options.authRef || (needsDefaultAuth ? createAuthRef() : null);
    if (needsDefaultAuth && !isAuthRefReady(authRef)) {
      throw permissionError('PERMISSION_E2E_AUTH_NOT_READY', 'permission E2E authentication is not ready');
    }
    const adapters = createDefaultAdapters(authRef, env);
    const discover = options.discoverCandidates || (async () => discoverCandidates(config, authRef, exclusionEvidence.excludedIds));
    const readPackages = options.readPackages || adapters.readPackages;
    const mutate = options.mutate || adapters.mutate;

    const discovery = await discover();
    target = selectTarget(discovery.candidates, exclusionEvidence.excludedIds);
    registry.resourceCounts = { ...registry.resourceCounts, ...discovery.counts };
    registry.target = {
      appFingerprint: hash(target.appType),
      formFingerprint: hash(target.formUuid),
      packageFingerprint: hash(target.package.packageUuid),
      role: TARGET_ROLE,
      packageType: 'FORM_PACKAGE_VIEW',
    };
    recordTrace(registry, 'deterministic-target', 'passed');

    const beforePackages = await readPackages(target);
    before = assertExactTarget(beforePackages, target);
    if (packageFingerprint(before) !== packageFingerprint(target.package)) {
      throw permissionError('PERMISSION_E2E_BEFORE_CHANGED', 'exact before readback changed after deterministic selection');
    }
    mutation = buildMutation(before);
    const beforeEvidence = writeEvidence(workDir, 'before-raw', before);
    registry.artifacts.push({ type: 'permission-before-raw', path: beforeEvidence.path, sha256: beforeEvidence.sha256, retained: true });
    registry.sample = {
      dimension: 'operatePermit',
      operation: mutation.operation,
      direction: mutation.direction,
      beforeEnabledCount: Object.keys(mutation.beforeOperatePermit).length,
      mutatedEnabledCount: Object.keys(mutation.expectedOperatePermit).length,
      beforeFingerprint: operateFingerprint(mutation.beforeOperatePermit),
      mutatedFingerprint: operateFingerprint(mutation.expectedOperatePermit),
    };
    registry.deterministicReadback = {
      status: 'passed',
      exactPackageUuid: true,
      uniqueRoleTarget: true,
      beforeFingerprint: packageFingerprint(before),
      nonOwnedFingerprint: packageFingerprint(before, { excludeOperate: true }),
    };
    changeResource = {
      runId,
      owned: true,
      type: 'permission-change',
      exactId: registry.target.packageFingerprint,
      name: `${namePrefix}operatePermit`,
      target: registry.target,
      dimension: 'operatePermit',
      restored: false,
    };
    registry.resources.push(changeResource);
    registry.ownership = assertOwnedChange(changeResource, { runId, namePrefix });
    recordTrace(registry, 'before-readback', 'passed');
    persistCheckpoint(persist, registryPath, manifestPath, registry);

    mutationAttempted = true;
    registry.commands.push({ name: 'save-permission-action-mutation', sideEffect: true, status: 'running' });
    registry.mutation = { status: 'pre_write', exactReadback: false };
    persistCheckpoint(persist, registryPath, manifestPath, registry);
    await mutate(target, mutation);
    registry.commands[registry.commands.length - 1].status = 'passed';
    registry.resourceCounts.mutated = 1;
    registry.mutation = { status: 'write_succeeded_readback_pending', exactReadback: false };
    recordTrace(registry, 'mutation-write', 'passed');
    persistCheckpoint(persist, registryPath, manifestPath, registry);

    const afterPackages = await readPackages(target);
    const after = assertExactTarget(afterPackages, target);
    const expectedOperateFingerprint = operateFingerprint(mutation.expectedOperatePermit);
    if (operateFingerprint(after.operatePermit) !== expectedOperateFingerprint
      || packageFingerprint(after, { excludeOperate: true }) !== packageFingerprint(before, { excludeOperate: true })) {
      throw permissionError('PERMISSION_E2E_MUTATION_READBACK_MISMATCH', 'mutation exact readback did not match the owned one-dimension change');
    }
    mutationConfirmed = true;
    const mutatedEvidence = writeEvidence(workDir, 'mutated-raw', after);
    registry.artifacts.push({ type: 'permission-mutated-raw', path: mutatedEvidence.path, sha256: mutatedEvidence.sha256, retained: true });
    registry.mutation = {
      status: 'passed',
      exactReadback: true,
      operateFingerprint: expectedOperateFingerprint,
      nonOwnedUnchanged: true,
    };
    recordTrace(registry, 'mutation-readback', 'passed');
    persistCheckpoint(persist, registryPath, manifestPath, registry);
  } catch (error) {
    primaryError = error;
    registry.error = sanitizedError(error);
    recordTrace(registry, 'primary-flow', 'failed');
    persistCheckpoint(persist, registryPath, manifestPath, registry);
  } finally {
    if (mutationAttempted && target && before && mutation) {
      try {
        await performOwnedRestore({
          before,
          changeResource,
          env,
          mutation,
          namePrefix,
          options,
          persist,
          registry,
          registryPath,
          manifestPath,
          runId,
          target,
          workDir,
        });
      } catch (error) {
        restoreError = error;
        registry.restore = { status: 'restore_blocked', exactReadback: false, error: sanitizedError(error) };
        registry.cleanup = { status: 'cleanup_blocked', ownedResidualCount: 1, unrelatedResidualsTouched: 0 };
        recordTrace(registry, 'owned-restore', 'restore_blocked');
      }
    } else {
      registry.restore = { status: 'not_required', exactReadback: false };
      registry.cleanup = { status: 'passed', ownedResidualCount: 0, unrelatedResidualsTouched: 0 };
    }
    registry.status = !primaryError && !restoreError && mutationConfirmed && registry.restore.status === 'passed'
      ? 'passed'
      : (restoreError ? 'restore_blocked' : 'failed');
    registry.finishedAt = new Date().toISOString();
    if (restoreError) {registry.error = sanitizedError(restoreError);}
    persistCheckpoint(persist, registryPath, manifestPath, registry);
  }

  const result = {
    skipped: false,
    status: registry.status,
    runId,
    registryPath,
    manifestPath,
    target: registry.target,
    sample: registry.sample,
    resourceCounts: registry.resourceCounts,
    deterministicReadback: registry.deterministicReadback,
    mutation: registry.mutation,
    restore: registry.restore,
    cleanup: registry.cleanup,
  };
  const finalError = restoreError || primaryError;
  if (finalError) {
    finalError.permissionResult = result;
    throw finalError;
  }
  return result;
}

if (require.main === module) {
  run().then(function (result) {
    console.log(JSON.stringify(result));
  }).catch(function (error) {
    const result = error.permissionResult || { status: 'failed', error: sanitizedError(error) };
    console.error(JSON.stringify(result));
    process.exitCode = 1;
  });
}

module.exports = {
  buildMutation,
  createRunId,
  discoverCandidates,
  getConfig,
  loadExclusionEvidence,
  packageFingerprint,
  run,
  selectTarget,
  targetPackageFromPackages,
};
