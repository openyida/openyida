#!/usr/bin/env node

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { t } = require('../../../lib/core/i18n');
const { redactSensitive, safeJsonStringify } = require('../../../lib/core/redact');
const {
  getReportChartCapability,
  listReportChartTypes,
} = require('../../../lib/report/capability-registry');
const { assertReportLayout } = require('../../../lib/report/layout');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const DEFAULT_REGISTRY_DIR = path.join(ROOT, 'project', '.cache', 'e2e-real', 'report');
const REPORT_CHART_COMPONENT_NAMES = new Set(listReportChartTypes()
  .map(type => getReportChartCapability(type).componentName));
const REPORT_COMPONENT_DATASET_KEYS = new Map(listReportChartTypes().map(type => {
  const capability = getReportChartCapability(type);
  return [capability.componentName, capability.dataSetKey];
}));

const REPORT_E2E_CASES = Object.freeze([
  Object.freeze({ id: 'platform-create-append-inspect', package: 'platform', effects: 'remote_write_then_readback' }),
  Object.freeze({ id: 'runtime-binding-query', package: 'runtime', effects: 'remote_read' }),
  Object.freeze({ id: 'ui-report-render', package: 'ui', effects: 'browser_read' }),
]);

function reportE2EError(code, key, ...args) {
  const error = new Error(t(`report_runtime.${key}`, ...args));
  error.code = code;
  return error;
}

function missingFlags(env, flags) {
  return flags.filter(flag => {
    const [name, expected] = flag.split('=');
    return env[name] !== expected;
  });
}

function probeReportE2EPackages(options = {}) {
  const env = options.env || process.env;
  const hasPlaywright = options.hasPlaywright === true;
  const shared = ['OPENYIDA_E2E=1', 'OPENYIDA_E2E_REPORT=1'];
  const platformMissing = missingFlags(env, shared);
  const runtimeMissing = missingFlags(env, [...shared, 'OPENYIDA_E2E_REPORT_RUNTIME=1']);
  const uiMissing = missingFlags(env, [...shared, 'OPENYIDA_E2E_REPORT_UI=1']);
  if (!hasPlaywright) {uiMissing.push('playwright');}
  const packages = {
    platform: { ready: platformMissing.length === 0, missing: platformMissing },
    runtime: { ready: runtimeMissing.length === 0, missing: runtimeMissing },
    ui: { ready: uiMissing.length === 0, missing: uiMissing },
  };
  return {
    enabled: Object.values(packages).every(entry => entry.ready),
    packages,
  };
}

function requireAdapter(options, name) {
  if (typeof options[name] !== 'function') {
    throw reportE2EError('REPORT_E2E_ADAPTER_REQUIRED', 'e2e_adapter_required', name);
  }
  return options[name];
}

function canonicalize(value) {
  if (Array.isArray(value)) {return value.map(canonicalize);}
  if (!value || typeof value !== 'object') {return value;}
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function hash(value) {
  const input = typeof value === 'string' ? value : canonicalJson(value);
  return crypto.createHash('sha256').update(input).digest('hex');
}

function sanitizeReportEvidence(value, corpId) {
  const rawCorpId = typeof corpId === 'string' ? corpId : String(corpId || '');
  if (!rawCorpId) {return value;}
  const runtimeFingerprint = hash(rawCorpId);
  const replacement = `<corpId:sha256:${runtimeFingerprint}>`;

  function sanitize(current) {
    if (typeof current === 'string') {
      return current.includes(rawCorpId)
        ? current.split(rawCorpId).join(replacement)
        : current;
    }
    if (Array.isArray(current)) {return current.map(sanitize);}
    if (!current || typeof current !== 'object') {return current;}

    const result = {};
    let hasCorpId = false;
    let observedCorpId;
    for (const [key, child] of Object.entries(current)) {
      if (key === 'corpId') {
        hasCorpId = true;
        observedCorpId = child;
        continue;
      }
      const safeKey = key.includes(rawCorpId)
        ? key.split(rawCorpId).join(replacement)
        : key;
      result[safeKey] = sanitize(child);
    }
    if (hasCorpId) {
      const normalized = typeof observedCorpId === 'string'
        ? observedCorpId
        : String(observedCorpId || '');
      result.corpIdMatched = normalized === rawCorpId;
      result.corpIdFingerprint = normalized ? hash(normalized) : null;
    }
    return result;
  }

  return sanitize(value);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${safeJsonStringify(value)}\n`, 'utf8');
  return filePath;
}

function sanitizedError(error) {
  return error ? { code: error.code || 'REPORT_E2E_FAILED', message: error.message } : null;
}

function sanitizeErrorForOutput(error, corpId) {
  if (!error) {return error;}
  if (typeof error.message === 'string') {
    error.message = sanitizeReportEvidence(error.message, corpId);
  }
  if (typeof error.stack === 'string') {
    error.stack = sanitizeReportEvidence(error.stack, corpId);
  }
  for (const key of Object.keys(error)) {
    if (key === 'reportResult') {continue;}
    error[key] = sanitizeReportEvidence(redactSensitive(error[key]), corpId);
  }
  return error;
}

function createManifest(registry) {
  return redactSensitive({
    schemaVersion: registry.schemaVersion,
    runId: registry.runId,
    status: registry.status,
    writeState: registry.writeState,
    ownership: registry.ownership,
    baseline: registry.baseline,
    expectedEvidence: registry.expectedEvidence,
    candidate: registry.candidate,
    exactIdentity: registry.exactIdentity,
    remoteWrites: registry.remoteWrites,
    resourceCounts: registry.resourceCounts,
    resources: registry.resources,
    platform: registry.platform,
    runtime: registry.runtime,
    ui: registry.ui,
    cleanup: registry.cleanup,
    restore: registry.restore,
    residual: registry.residual,
    cases: registry.cases,
    commands: registry.commands,
    trace: registry.trace,
    error: registry.error,
    startedAt: registry.startedAt,
    finishedAt: registry.finishedAt,
  });
}

function persistCheckpoint(persist, registryPath, manifestPath, registry, corpId) {
  const evidenceCorpId = corpId || registry.corpId;
  persist(registryPath, sanitizeReportEvidence(redactSensitive(registry), evidenceCorpId));
  persist(manifestPath, sanitizeReportEvidence(createManifest(registry), evidenceCorpId));
}

function recordTrace(registry, step, status, details) {
  registry.trace.push({
    step,
    status,
    ...(details ? { details: redactSensitive(details) } : {}),
    recordedAt: new Date().toISOString(),
  });
}

function validateConfig(config) {
  if (!config.runId || !/^OY_REPORT_[A-Za-z0-9_-]+$/.test(config.runId)) {
    throw reportE2EError('REPORT_E2E_RUN_ID_REQUIRED', 'e2e_run_id_required');
  }
  if (!config.marker || !String(config.marker).startsWith(config.runId)) {
    throw reportE2EError('REPORT_E2E_MARKER_INVALID', 'e2e_marker_invalid');
  }
  if (!config.corpId || !config.appType || !config.reportTitle
    || !String(config.reportTitle).includes(config.runId)
    || !Array.isArray(config.charts) || config.charts.length === 0
    || !Array.isArray(config.appendCharts) || config.appendCharts.length === 0) {
    throw reportE2EError('REPORT_E2E_CONFIG_INVALID', 'e2e_config_invalid');
  }
  const requestedPackages = Array.isArray(config.packages) ? config.packages : ['platform'];
  if (requestedPackages.some(packageName => !['platform', 'runtime', 'ui'].includes(packageName))) {
    throw reportE2EError('REPORT_E2E_CONFIG_INVALID', 'e2e_config_invalid');
  }
  const packages = ['platform', ...new Set(requestedPackages.filter(packageName => packageName !== 'platform'))];
  if (packages.includes('runtime') && (!config.expected || !config.expected.runtime)) {
    throw reportE2EError('REPORT_E2E_CONFIG_INVALID', 'e2e_runtime_expected_required');
  }
  const runtimeExpected = config.expected && config.expected.runtime;
  if (packages.includes('runtime') && (!Array.isArray(runtimeExpected.markerPath)
    || runtimeExpected.markerPath.length === 0
    || runtimeExpected.markerPath.length > 8
    || runtimeExpected.markerPath.some(segment => typeof segment !== 'string' || !segment)
    || runtimeExpected.markerValue !== config.marker)) {
    throw reportE2EError('REPORT_E2E_CONFIG_INVALID', 'e2e_runtime_marker_contract_invalid');
  }
  if (packages.includes('ui') && (!config.expected || !config.expected.ui)) {
    throw reportE2EError('REPORT_E2E_CONFIG_INVALID', 'e2e_ui_expected_required');
  }
  return packages;
}

function normalizeIdentitySummary(identity) {
  if (!identity || typeof identity !== 'object' || !identity.reportId) {return null;}
  return {
    reportId: String(identity.reportId),
    reportTitle: identity.reportTitle || null,
    marker: identity.marker || null,
    appType: identity.appType || null,
    corpId: identity.corpId || null,
  };
}

function normalizeBaseline(baseline) {
  if (!baseline || typeof baseline !== 'object'
    || !Array.isArray(baseline.existingReportIds)
    || !Array.isArray(baseline.reportIdentities)) {
    throw reportE2EError('REPORT_E2E_BASELINE_REQUIRED', 'e2e_baseline_required');
  }
  const existingReportIds = baseline.existingReportIds.map(reportId => String(reportId || ''));
  if (existingReportIds.some(reportId => !reportId)
    || new Set(existingReportIds).size !== existingReportIds.length) {
    throw reportE2EError('REPORT_E2E_BASELINE_REQUIRED', 'e2e_baseline_required');
  }
  const reportIdentities = baseline.reportIdentities.map(normalizeIdentitySummary);
  if (reportIdentities.some(identity => !identity)
    || reportIdentities.some(identity => !existingReportIds.includes(identity.reportId))) {
    throw reportE2EError('REPORT_E2E_BASELINE_REQUIRED', 'e2e_baseline_required');
  }
  return {
    existingReportIds,
    reportIdentities,
  };
}

function assertPreflight(preflight, config, packages) {
  const ownership = preflight && preflight.ownership;
  if (!preflight || preflight.authorized !== true || !ownership
    || ownership.owned !== true
    || ownership.remoteWritesAllowed !== true
    || ownership.runId !== config.runId
    || ownership.marker !== config.marker
    || ownership.corpId !== config.corpId
    || ownership.appType !== config.appType) {
    throw reportE2EError('REPORT_E2E_OWNERSHIP_UNPROVEN', 'e2e_ownership_unproven');
  }
  const baseline = normalizeBaseline(preflight.baseline);
  if (packages.includes('runtime')
    && canonicalJson(preflight.runtimeFixture) !== canonicalJson(config.expected.runtime)) {
    throw reportE2EError('REPORT_E2E_RUNTIME_FIXTURE_MISMATCH', 'e2e_runtime_fixture_mismatch');
  }
  return {
    ownership: {
      status: 'passed',
      owned: true,
      runIdMatched: true,
      markerMatched: true,
      corpIdMatched: true,
      appTypeMatched: true,
      remoteWritesAllowed: true,
    },
    baseline,
  };
}

function createCandidate(created) {
  if (!created || !created.reportId) {
    throw reportE2EError('REPORT_E2E_IDENTITY_MISSING', 'e2e_identity_missing');
  }
  return {
    reportId: String(created.reportId),
    owned: false,
    verificationStatus: 'candidate',
    url: created.url || null,
  };
}

function identityMatches(identity, expected) {
  const normalized = normalizeIdentitySummary(identity);
  return normalized && canonicalJson(normalized) === canonicalJson(expected);
}

function assertCreatedOwnership(candidate, readback, baseline, config) {
  const expected = {
    reportId: candidate.reportId,
    reportTitle: config.reportTitle,
    marker: config.marker,
    appType: config.appType,
    corpId: config.corpId,
  };
  const candidates = readback && readback.identityCandidates;
  if (!readback || baseline.existingReportIds.includes(candidate.reportId)
    || !identityMatches(readback, expected)
    || !Array.isArray(candidates) || candidates.length !== 1
    || !identityMatches(candidates[0], expected)) {
    throw reportE2EError(
      'REPORT_E2E_CREATED_IDENTITY_UNVERIFIED',
      'e2e_created_identity_unverified'
    );
  }
  return expected;
}

function runtimeComponents(inspectResult) {
  return inspectResult && Array.isArray(inspectResult.components)
    ? inspectResult.components.filter(component => REPORT_CHART_COMPONENT_NAMES.has(component.componentName)
      && Array.isArray(component.dataSetKeys) && component.dataSetKeys.length > 0)
    : [];
}

function expectedComponentSignatures(charts) {
  return charts.map(chart => {
    const capability = getReportChartCapability(chart && chart.type);
    if (!capability) {
      throw reportE2EError('REPORT_E2E_PLATFORM_INVALID', 'e2e_platform_invalid');
    }
    return `${capability.componentName}\u0000${capability.dataSetKey}`;
  }).sort();
}

function componentSignature(component) {
  const expectedDataSetKey = REPORT_COMPONENT_DATASET_KEYS.get(component.componentName) || '';
  const observedDataSetKey = component.dataSetKeys.includes(expectedDataSetKey) ? expectedDataSetKey : '';
  return `${component.componentName}\u0000${observedDataSetKey}`;
}

function filterTargetIndexes(config) {
  const targets = new Set();
  const charts = config.charts;
  for (const filter of Array.isArray(config.filters) ? config.filters : []) {
    if (filter.linkTo === undefined) {
      charts.forEach((chart, index) => {
        if (chart.cubeCode === filter.cubeCode) {targets.add(index);}
      });
      continue;
    }
    for (const target of Array.isArray(filter.linkTo) ? filter.linkTo : []) {
      if (Number.isInteger(target) && target >= 0 && target < charts.length) {
        targets.add(target);
        continue;
      }
      if (typeof target === 'string') {
        const matches = charts
          .map((chart, index) => chart.title === target ? index : -1)
          .filter(index => index >= 0);
        if (matches.length === 1) {targets.add(matches[0]);}
      }
    }
  }
  return targets;
}

function assertComponentEvidence(inspectResult, charts, config) {
  const components = runtimeComponents(inspectResult);
  const signatures = components.map(componentSignature).sort();
  if (canonicalJson(signatures) !== canonicalJson(expectedComponentSignatures(charts))) {
    throw reportE2EError('REPORT_E2E_PLATFORM_INVALID', 'e2e_platform_invalid');
  }
  const cids = new Set();
  const fieldIds = new Set();
  for (const component of components) {
    if (!component.cid || cids.has(component.cid)
      || !component.fieldId || fieldIds.has(component.fieldId)
      || !Array.isArray(component.dataSetKeys) || component.dataSetKeys.length === 0) {
      throw reportE2EError('REPORT_E2E_PLATFORM_INVALID', 'e2e_platform_invalid');
    }
    cids.add(component.cid);
    fieldIds.add(component.fieldId);
  }
  for (const targetIndex of filterTargetIndexes(config)) {
    if (!components[targetIndex] || !Array.isArray(components[targetIndex].filterKeys)
      || components[targetIndex].filterKeys.length === 0) {
      throw reportE2EError('REPORT_E2E_FILTER_LINK_INVALID', 'e2e_filter_link_invalid');
    }
  }
  const layout = Array.isArray(inspectResult.layout) ? inspectResult.layout : [];
  assertReportLayout(layout);
  if (components.some(component => !layout.some(item => item.i === component.fieldId))) {
    throw reportE2EError('REPORT_E2E_PLATFORM_INVALID', 'e2e_platform_invalid');
  }
  return { components, componentCount: components.length, layoutNonOverlapping: true };
}

function assertPlatformEvidence(created, appended, config) {
  if (!Number.isFinite(created.revision) || !Number.isFinite(appended.revision)
    || appended.revision <= created.revision) {
    throw reportE2EError('REPORT_E2E_REVISION_NOT_ADVANCED', 'e2e_revision_not_advanced');
  }
  const createEvidence = assertComponentEvidence(created, config.charts, config);
  const allCharts = [...config.charts, ...config.appendCharts];
  const appendEvidence = assertComponentEvidence(appended, allCharts, config);
  const appendedByCid = new Map(appendEvidence.components.map(component => [component.cid, component]));
  const originalComponentsPreserved = createEvidence.components.every(component => {
    const current = appendedByCid.get(component.cid);
    return current && canonicalJson(current) === canonicalJson(component);
  });
  if (!originalComponentsPreserved) {
    throw reportE2EError('REPORT_E2E_ORIGINAL_COMPONENT_LOST', 'e2e_original_component_lost');
  }
  const expected = {
    create: {
      componentCount: config.charts.length,
      signatures: expectedComponentSignatures(config.charts),
      filterTargetIndexes: [...filterTargetIndexes(config)].sort((left, right) => left - right),
    },
    append: {
      componentCount: allCharts.length,
      signatures: expectedComponentSignatures(allCharts),
      originalComponentsPreserved: true,
    },
  };
  const observed = {
    create: {
      componentCount: createEvidence.componentCount,
      signatures: createEvidence.components.map(componentSignature).sort(),
      layoutNonOverlapping: createEvidence.layoutNonOverlapping,
    },
    append: {
      componentCount: appendEvidence.componentCount,
      signatures: appendEvidence.components.map(componentSignature).sort(),
      originalComponentsPreserved,
      layoutNonOverlapping: appendEvidence.layoutNonOverlapping,
    },
  };
  return {
    expected,
    observed,
    create: {
      revision: created.revision,
      componentCount: createEvidence.componentCount,
      layoutNonOverlapping: createEvidence.layoutNonOverlapping,
    },
    append: {
      revision: appended.revision,
      componentCount: appendEvidence.componentCount,
      originalComponentsPreserved,
      layoutNonOverlapping: appendEvidence.layoutNonOverlapping,
    },
  };
}

function runtimeBinding(inspectResult) {
  const component = runtimeComponents(inspectResult).find(entry => entry.cid && entry.dataSetKeys.length > 0);
  if (!component) {
    throw reportE2EError('REPORT_E2E_BINDING_MISSING', 'e2e_binding_missing');
  }
  return {
    reportId: inspectResult.reportId,
    cid: component.cid,
    componentName: component.componentName || null,
    dataSetKey: REPORT_COMPONENT_DATASET_KEYS.get(component.componentName),
    filterKey: Array.isArray(component.filterKeys) && component.filterKeys.length > 0
      ? component.filterKeys[0]
      : null,
  };
}

function readMarkerAtPath(row, markerPath) {
  let current = row;
  for (const segment of markerPath) {
    if (!current || typeof current !== 'object'
      || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return { found: false, value: undefined };
    }
    current = current[segment];
  }
  return { found: true, value: current };
}

function assertRuntimeEvidence(result, expected) {
  const observed = result && result.observed;
  const markerPathValid = expected && Array.isArray(expected.markerPath)
    && expected.markerPath.length > 0 && expected.markerPath.length <= 8
    && expected.markerPath.every(segment => typeof segment === 'string' && segment);
  const markerMatched = markerPathValid && observed && Array.isArray(observed.rows)
    && observed.rows.some(row => {
      const marker = readMarkerAtPath(row, expected.markerPath);
      return marker.found && marker.value === expected.markerValue;
    });
  if (!result || canonicalJson(result.expected) !== canonicalJson(expected)
    || !observed || !Array.isArray(observed.rows) || observed.rows.length === 0
    || !markerMatched
    || canonicalJson(observed.aggregate) !== canonicalJson(expected.aggregate)
    || !expected.filter || expected.filter.before === expected.filter.after
    || canonicalJson(observed.filter) !== canonicalJson(expected.filter)) {
    throw reportE2EError('REPORT_E2E_RUNTIME_INVALID', 'e2e_runtime_invalid');
  }
  return {
    status: 'passed',
    rowCount: observed.rows.length,
    markerMatched: true,
    markerPath: [...expected.markerPath],
    aggregateMatched: true,
    filterChanged: true,
  };
}

function assertUiEvidence(result, expected) {
  const observed = result && result.observed;
  if (!result || canonicalJson(result.expected) !== canonicalJson(expected)
    || !observed || observed.visible !== true
    || observed.blankPage !== false || observed.permissionDenied !== false
    || !Array.isArray(observed.markers) || !observed.markers.includes(expected.marker)
    || !Array.isArray(observed.consoleErrors) || observed.consoleErrors.length > 0
    || !Array.isArray(observed.runtimeErrors) || observed.runtimeErrors.length > 0) {
    throw reportE2EError('REPORT_E2E_UI_INVALID', 'e2e_ui_invalid');
  }
  return {
    status: 'passed',
    markerMatched: true,
    blankPage: false,
    permissionDenied: false,
    consoleErrorCount: 0,
    runtimeErrorCount: 0,
    screenshot: observed.screenshot ? { ...observed.screenshot, auxiliary: true } : null,
  };
}

function assertOwnedResource(resource, config) {
  return resource && resource.owned === true
    && resource.runId === config.runId
    && resource.marker === config.marker
    && resource.exactIdentity
    && resource.exactIdentity.appType === config.appType
    && resource.exactIdentity.corpId === config.corpId
    && resource.exactIdentity.reportTitle === config.reportTitle
    && resource.exactIdentity.reportId;
}

async function performCleanup(options, registry, config, resource, candidate) {
  if (!resource) {
    if (registry.remoteWrites.attempted > 0) {
      return {
        status: 'cleanup_blocked',
        exactIdentity: false,
        reason: candidate ? 'candidate_ownership_unverified' : 'create_result_unknown',
      };
    }
    return { status: 'not_required', exactIdentity: false, reason: 'no_remote_write' };
  }
  if (!assertOwnedResource(resource, config)) {
    return { status: 'cleanup_blocked', exactIdentity: false, reason: 'ownership_unproven' };
  }
  const cleanupReport = requireAdapter(options, 'cleanupReport');
  const cleanup = await cleanupReport({
    runId: config.runId,
    marker: config.marker,
    corpId: config.corpId,
    appType: config.appType,
    reportId: resource.exactIdentity.reportId,
    exactIdentity: { ...resource.exactIdentity },
    owned: true,
  });
  if (!cleanup || cleanup.status !== 'passed' || cleanup.deleted !== true
    || cleanup.exactIdentity !== true || !cleanup.observed || cleanup.observed.reportAbsent !== true) {
    return {
      status: 'cleanup_blocked',
      exactIdentity: cleanup && cleanup.exactIdentity === true,
      reason: 'owned_delete_not_proven',
    };
  }
  registry.remoteWrites.succeeded += 1;
  resource.cleanupStatus = 'passed';
  return { status: 'passed', exactIdentity: true, deleted: true, reportAbsent: true };
}

function resultFromRegistry(registry, registryPath, manifestPath, binding, corpId) {
  const evidenceCorpId = corpId || registry.corpId;
  return sanitizeReportEvidence(redactSensitive({
    skipped: false,
    status: registry.status,
    runId: registry.runId,
    reportId: registry.exactIdentity && registry.exactIdentity.reportId,
    registryPath,
    manifestPath,
    binding: binding || null,
    cases: registry.cases,
    platform: registry.platform,
    runtime: registry.runtime,
    ui: registry.ui,
    cleanup: registry.cleanup,
    restore: registry.restore,
    residual: registry.residual,
    remoteWrites: registry.remoteWrites,
  }), evidenceCorpId);
}

async function run(options = {}) {
  const config = options.config || {};
  if (config.enabled === false) {
    return { skipped: true, status: 'skipped', missing: config.missing || [] };
  }
  const packages = validateConfig(config);
  const prepare = requireAdapter(options, 'prepare');
  const createReport = requireAdapter(options, 'createReport');
  const inspectReport = requireAdapter(options, 'inspectReport');
  const appendChart = requireAdapter(options, 'appendChart');
  const workDir = options.workDir || path.join(config.registryDir || DEFAULT_REGISTRY_DIR, config.runId);
  const registryPath = path.join(workDir, 'registry.json');
  const manifestPath = path.join(workDir, 'acceptance-manifest.json');
  const persist = options.writeJson || writeJson;
  const registry = {
    schemaVersion: 1,
    runId: config.runId,
    marker: config.marker,
    corpId: config.corpId,
    status: 'running',
    writeState: 'not_started',
    ownership: { status: 'pending' },
    baseline: null,
    expectedEvidence: {
      sha256: hash(config.expected || {}),
      packages: [...packages],
    },
    candidate: null,
    exactIdentity: null,
    remoteWrites: { attempted: 0, succeeded: 0 },
    resourceCounts: { created: 0, cleaned: 0, residual: 0 },
    resources: [],
    platform: null,
    runtime: null,
    ui: null,
    cleanup: { status: 'pending', exactIdentity: false },
    restore: { status: 'not_applicable', reason: 'runner_creates_owned_report' },
    residual: [],
    cases: [],
    commands: [],
    trace: [],
    error: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  fs.mkdirSync(workDir, { recursive: true });
  persistCheckpoint(persist, registryPath, manifestPath, registry);

  let primaryError = null;
  let resource = null;
  let candidate = null;
  let binding = null;
  try {
    const preflight = await prepare({
      runId: config.runId,
      marker: config.marker,
      corpId: config.corpId,
      appType: config.appType,
      expected: config.expected,
      readOnly: true,
    });
    const preflightEvidence = assertPreflight(preflight, config, packages);
    registry.ownership = preflightEvidence.ownership;
    registry.baseline = {
      sha256: hash(preflightEvidence.baseline),
      existingReportIds: [...preflightEvidence.baseline.existingReportIds],
      reportIdentities: preflightEvidence.baseline.reportIdentities.map(identity => ({ ...identity })),
      existingReportCount: preflightEvidence.baseline.existingReportIds.length,
    };
    recordTrace(registry, 'prepare-read-only-ownership', 'passed');
    persistCheckpoint(persist, registryPath, manifestPath, registry);

    registry.writeState = 'pre_write';
    registry.remoteWrites.attempted += 1;
    registry.commands.push({ name: 'create-report', sideEffect: true, status: 'pre_write' });
    persistCheckpoint(persist, registryPath, manifestPath, registry);
    const created = await createReport({ ...config, reportTitle: config.reportTitle, marker: config.marker });
    registry.commands[registry.commands.length - 1].status = 'passed';
    registry.remoteWrites.succeeded += 1;
    registry.resourceCounts.created = 1;
    candidate = createCandidate(created);
    registry.candidate = { ...candidate };
    registry.writeState = 'candidate_readback_pending';
    recordTrace(registry, 'create-report-candidate', 'passed', { reportId: candidate.reportId });
    persistCheckpoint(persist, registryPath, manifestPath, registry);

    const afterCreate = await inspectReport({
      appType: config.appType,
      corpId: config.corpId,
      reportId: candidate.reportId,
      reportTitle: config.reportTitle,
      marker: config.marker,
      includeIdentityCandidates: true,
      readOnly: true,
    });
    registry.exactIdentity = assertCreatedOwnership(
      candidate,
      afterCreate,
      preflightEvidence.baseline,
      config
    );
    registry.candidate = {
      ...candidate,
      owned: true,
      verificationStatus: 'platform_verified',
    };
    resource = {
      type: 'report',
      runId: config.runId,
      marker: config.marker,
      owned: true,
      exactIdentity: { ...registry.exactIdentity },
      cleanupStatus: 'pending',
    };
    registry.resources.push(resource);
    registry.writeState = 'created_identity_verified';
    recordTrace(registry, 'create-identity-readback', 'passed', {
      reportId: registry.exactIdentity.reportId,
      baselineNew: true,
      uniqueCandidate: true,
    });
    persistCheckpoint(persist, registryPath, manifestPath, registry);

    assertComponentEvidence(afterCreate, config.charts, config);
    recordTrace(registry, 'create-inspect', 'passed');

    registry.writeState = 'append_pre_write';
    registry.remoteWrites.attempted += 1;
    registry.commands.push({ name: 'append-chart', sideEffect: true, status: 'pre_write' });
    persistCheckpoint(persist, registryPath, manifestPath, registry);
    const appendResult = await appendChart({
      ...config,
      reportId: registry.exactIdentity.reportId,
      exactIdentity: { ...registry.exactIdentity },
    });
    if (!appendResult || appendResult.success !== true
      || String(appendResult.reportId) !== registry.exactIdentity.reportId) {
      throw reportE2EError('REPORT_E2E_APPEND_IDENTITY_MISMATCH', 'e2e_append_identity_mismatch');
    }
    registry.commands[registry.commands.length - 1].status = 'passed';
    registry.remoteWrites.succeeded += 1;
    registry.writeState = 'append_readback_pending';
    persistCheckpoint(persist, registryPath, manifestPath, registry);

    const afterAppend = await inspectReport({ ...registry.exactIdentity });
    registry.platform = assertPlatformEvidence(afterCreate, afterAppend, config);
    registry.cases.push({ id: 'platform-create-append-inspect', package: 'platform', status: 'passed' });
    binding = runtimeBinding(afterAppend);
    recordTrace(registry, 'platform-evidence', 'passed');
    persistCheckpoint(persist, registryPath, manifestPath, registry);

    if (packages.includes('runtime')) {
      const queryRuntime = requireAdapter(options, 'queryRuntime');
      const runtimeResult = await queryRuntime({
        ...registry.exactIdentity,
        binding,
        expected: config.expected.runtime,
      });
      registry.runtime = assertRuntimeEvidence(runtimeResult, config.expected.runtime);
      registry.cases.push({ id: 'runtime-binding-query', package: 'runtime', status: 'passed' });
      recordTrace(registry, 'runtime-evidence', 'passed');
      persistCheckpoint(persist, registryPath, manifestPath, registry);
    }

    if (packages.includes('ui')) {
      const verifyUi = requireAdapter(options, 'verifyUi');
      const uiResult = await verifyUi({
        ...registry.exactIdentity,
        reportUrl: created.url,
        binding,
        expected: config.expected.ui,
      });
      registry.ui = assertUiEvidence(uiResult, config.expected.ui);
      registry.cases.push({ id: 'ui-report-render', package: 'ui', status: 'passed' });
      recordTrace(registry, 'ui-evidence', 'passed');
      persistCheckpoint(persist, registryPath, manifestPath, registry);
    }
  } catch (error) {
    primaryError = error;
    registry.error = sanitizedError(error);
    recordTrace(registry, 'primary-flow', 'failed');
    persistCheckpoint(persist, registryPath, manifestPath, registry);
  } finally {
    try {
      if (resource) {
        registry.cleanup = { status: 'pre_write', exactIdentity: true };
        registry.remoteWrites.attempted += 1;
        persistCheckpoint(persist, registryPath, manifestPath, registry);
      }
      registry.cleanup = await performCleanup(options, registry, config, resource, candidate);
    } catch (error) {
      registry.cleanup = {
        status: 'cleanup_blocked',
        exactIdentity: false,
        reason: 'cleanup_adapter_failed',
        error: sanitizedError(error),
      };
    }
    if (registry.cleanup.status === 'passed') {
      registry.resourceCounts.cleaned = 1;
      registry.residual = [];
    } else if (registry.cleanup.status === 'cleanup_blocked') {
      registry.residual = [{
        type: 'report',
        runId: config.runId,
        marker: config.marker,
        owned: resource ? true : (candidate ? false : 'unknown'),
        reportId: resource && resource.exactIdentity.reportId
          || candidate && candidate.reportId
          || null,
        state: resource
          ? 'created_cleanup_blocked'
          : (candidate ? 'candidate_ownership_unverified' : 'create_result_unknown'),
        cleanupAttempted: !!resource,
      }];
      registry.resourceCounts.residual = 1;
    }
    const cleanupPassed = registry.cleanup.status === 'passed';
    const allCasesPassed = registry.cases.length === packages.length
      && registry.cases.every(testCase => testCase.status === 'passed');
    registry.status = !primaryError && cleanupPassed && allCasesPassed
      ? 'passed'
      : (registry.cleanup.status === 'cleanup_blocked' ? 'cleanup_blocked' : 'failed');
    registry.writeState = 'finished';
    registry.finishedAt = new Date().toISOString();
    recordTrace(registry, 'owned-cleanup', registry.cleanup.status);
    persistCheckpoint(persist, registryPath, manifestPath, registry);
  }

  const result = resultFromRegistry(registry, registryPath, manifestPath, binding);
  if (primaryError) {
    const safeError = sanitizeErrorForOutput(primaryError, config.corpId);
    safeError.reportResult = result;
    throw safeError;
  }
  return result;
}

function detectPlaywright() {
  try {
    require.resolve('playwright');
    return true;
  } catch {
    return false;
  }
}

if (require.main === module) {
  const probe = probeReportE2EPackages({ env: process.env, hasPlaywright: detectPlaywright() });
  console.log(JSON.stringify({
    runner: 'report-domain-e2e',
    cases: REPORT_E2E_CASES,
    probe,
    sharedFullRunnerWired: false,
  }, null, 2));
}

module.exports = Object.freeze({
  REPORT_E2E_CASES,
  assertPlatformEvidence,
  assertRuntimeEvidence,
  assertUiEvidence,
  probeReportE2EPackages,
  run,
  runtimeBinding,
});
