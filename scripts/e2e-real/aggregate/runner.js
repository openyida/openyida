#!/usr/bin/env node

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  DESIGN_KEYS,
  assertAggregateDesignConfig,
} = require('../../../lib/aggregate-table/contract');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const BIN = path.join(ROOT, 'bin', 'yida.js');
const DEFAULT_REGISTRY_DIR = path.join(ROOT, 'project', '.cache', 'e2e-real', 'aggregate');
const TERMINAL_BUILD_STATES = new Set(['SUCCESS', 'FAIL']);
const SAFE_RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{5,95}$/;

function fingerprint(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function stableValue(value) {
  if (Array.isArray(value)) { return value.map(stableValue); }
  if (!value || typeof value !== 'object') { return value; }
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = stableValue(value[key]);
    return result;
  }, {});
}

function canonicalFingerprint(value) {
  return fingerprint(JSON.stringify(stableValue(value)));
}

function resolveConfig(env = process.env) {
  const runId = env.OPENYIDA_AGGREGATE_E2E_RUN_ID || '';
  const ownedMarker = env.OPENYIDA_AGGREGATE_E2E_OWNED_MARKER || '';
  const config = {
    enabled: env.OPENYIDA_E2E === '1' && env.OPENYIDA_AGGREGATE_E2E === '1',
    runId,
    ownedMarker,
    corpId: env.OPENYIDA_AGGREGATE_E2E_CORP_ID || '',
    appType: env.OPENYIDA_AGGREGATE_E2E_APP_TYPE || '',
    formUuid: env.OPENYIDA_AGGREGATE_E2E_FORM_UUID || '',
    designFixture: env.OPENYIDA_AGGREGATE_E2E_DESIGN_FIXTURE || '',
    registryDir: env.OPENYIDA_AGGREGATE_E2E_REGISTRY_DIR || DEFAULT_REGISTRY_DIR,
    runtimeQueryConfirmed: env.OPENYIDA_AGGREGATE_RUNTIME_QUERY_CONFIRMED === '1',
    maxStatusPolls: Number(env.OPENYIDA_AGGREGATE_STATUS_POLLS || 12),
    statusPollMs: Number(env.OPENYIDA_AGGREGATE_STATUS_POLL_MS || 5000),
  };
  const missing = [];
  if (!runId || !SAFE_RUN_ID.test(runId)) { missing.push('OPENYIDA_AGGREGATE_E2E_RUN_ID'); }
  if (!ownedMarker || !runId || !ownedMarker.startsWith(`${runId}__`)) {
    missing.push('OPENYIDA_AGGREGATE_E2E_OWNED_MARKER');
  }
  if (!config.corpId) { missing.push('OPENYIDA_AGGREGATE_E2E_CORP_ID'); }
  if (!config.appType) { missing.push('OPENYIDA_AGGREGATE_E2E_APP_TYPE'); }
  if (!config.formUuid) { missing.push('OPENYIDA_AGGREGATE_E2E_FORM_UUID'); }
  if (!config.designFixture) { missing.push('OPENYIDA_AGGREGATE_E2E_DESIGN_FIXTURE'); }
  return { config, missing };
}

function buildCommandPlan(config) {
  return [
    { stage: 'auth', args: ['login', '--check-only', '--json', '--corp-id', config.corpId], mutates: false },
    { stage: 'list', args: ['aggregate-table', 'list', config.appType, '--json'], mutates: false },
    { stage: 'inspect', args: ['aggregate-table', 'inspect', config.appType, config.formUuid, '--json'], mutates: false },
    { stage: 'preview', args: ['aggregate-table', 'preview', config.appType, config.formUuid, config.designFixture, '--json'], mutates: false },
    { stage: 'save', args: ['aggregate-table', 'save', config.appType, config.formUuid, config.designFixture, '--json', '--no-open'], mutates: true },
    { stage: 'publish', args: ['aggregate-table', 'publish', config.appType, config.formUuid, config.designFixture, '--json', '--no-open'], mutates: true },
    { stage: 'build', args: ['aggregate-table', 'status', config.appType, config.formUuid, '--json'], mutates: false },
  ];
}

function runCli(args, timeoutMs = 30000) {
  const result = spawnSync(process.execPath, [BIN, ...args, '--quiet'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, CI: '1', OPENYIDA_SKIP_UPDATE_CHECK: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: timeoutMs,
  });
  return {
    status: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

function parseCliJson(result, stage) {
  if (!result || result.status !== 0) {
    const error = new Error(`${stage} failed`);
    let errorPayload = null;
    try {
      errorPayload = JSON.parse((result && (result.stderr || result.stdout)) || '');
    } catch (cause) {
      // A non-JSON CLI failure has an unknown write outcome and remains fail-closed.
    }
    error.code = errorPayload && errorPayload.errorCode ||
      `AGGREGATE_E2E_${String(stage).toUpperCase()}_FAILED`;
    throw error;
  }
  if (result.json !== undefined) { return result.json; }
  try {
    return JSON.parse(result.stdout);
  } catch (cause) {
    const error = new Error(`${stage} returned invalid JSON`);
    error.code = 'AGGREGATE_E2E_INVALID_JSON';
    throw error;
  }
}

function assertRevisionStage(stage, payload, expectedAxis) {
  const responseRevision = payload && payload.responseRevision;
  const readbackRevision = payload && payload.readbackRevision;
  const revisionMatchesReadback = payload && String(payload.revision) === String(readbackRevision);
  const responseMatchesReadback = responseRevision === undefined || responseRevision === null ||
    String(responseRevision) === String(readbackRevision);
  if (!payload || payload.readbackVerified !== true || payload.revisionAxis !== expectedAxis ||
      payload.revision === undefined || payload.revision === null ||
      readbackRevision === undefined || readbackRevision === null ||
      !['response', 'readback'].includes(payload.revisionSource) ||
      !revisionMatchesReadback || !responseMatchesReadback) {
    throw new Error(`${stage} did not prove ${expectedAxis} advancement by exact readback`);
  }
}

function canonicalDesignConfig(config) {
  const canonical = {};
  for (const key of DESIGN_KEYS) {
    if (!config || !Array.isArray(config[key])) {
      const error = new Error(`baseline ${key} is not an array`);
      error.code = 'AGGREGATE_E2E_BASELINE_INVALID';
      throw error;
    }
    canonical[key] = JSON.parse(JSON.stringify(config[key]));
  }
  return canonical;
}

function resourceCounts(canonical) {
  return DESIGN_KEYS.reduce((counts, key) => {
    counts[key] = canonical[key].length;
    return counts;
  }, {});
}

function verifyOwnership(config, listPayload, inspectPayload) {
  if (!Array.isArray(listPayload)) {
    return { verified: false, reason: 'list_shape_unproven' };
  }
  const exactMatches = listPayload.filter((item) => item &&
    String(item.formUuid || item.aggregateTableId || '') === String(config.formUuid));
  if (exactMatches.length !== 1) {
    return { verified: false, reason: 'exact_target_identity_unproven' };
  }
  const listed = exactMatches[0];
  if (listed.name !== config.ownedMarker) {
    return { verified: false, reason: 'exact_owned_marker_unproven' };
  }
  const inspectIdentity = inspectPayload && String(
    inspectPayload.formUuid || inspectPayload.aggregateTableId || ''
  );
  if (inspectIdentity !== String(config.formUuid)) {
    return { verified: false, reason: 'inspect_identity_unproven' };
  }
  if (!inspectPayload.summary || inspectPayload.summary.title !== config.ownedMarker) {
    return { verified: false, reason: 'inspect_owned_marker_unproven' };
  }
  return {
    verified: true,
    exactListIdentity: true,
    exactListNameMarker: true,
    exactInspectIdentity: true,
    exactInspectNameMarker: true,
    runIdBoundMarker: config.ownedMarker.startsWith(`${config.runId}__`),
    markerFingerprint: fingerprint(config.ownedMarker),
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporaryPath, filePath);
  fs.chmodSync(filePath, 0o600);
  return filePath;
}

function persistPreWriteEvidence(config, baseline, ownership, options = {}) {
  const writer = options.writeJson || writeJson;
  const workDir = options.workDir || path.join(config.registryDir, config.runId);
  const target = {
    appFingerprint: fingerprint(config.appType),
    formFingerprint: fingerprint(config.formUuid),
    markerFingerprint: fingerprint(config.ownedMarker),
  };
  const revisions = {
    gmtModified: baseline.raw.gmtModified === undefined ? null : baseline.raw.gmtModified,
    stashGmtModified: baseline.raw.stashGmtModified === undefined ? null : baseline.raw.stashGmtModified,
  };
  const common = {
    schemaVersion: 1,
    campaign: 'aggregate-table',
    runId: config.runId,
    status: 'pre_write_ready',
    target,
    plannedWrites: ['save', 'publish', 'conditional_restore'],
    baseline: { canonicalHash: baseline.canonicalHash, revisions },
    ownershipEvidence: ownership,
    resourceCounts: resourceCounts(baseline.canonical),
  };
  const snapshotPath = writer(path.join(workDir, 'before-design.json'), {
    schemaVersion: 1,
    runId: config.runId,
    target,
    canonicalHash: baseline.canonicalHash,
    designInfo: baseline.canonical,
    revisions,
  });
  const manifestPath = writer(path.join(workDir, 'acceptance-manifest.json'), {
    ...common,
    artifactFingerprints: { beforeDesign: baseline.canonicalHash },
  });
  const registry = {
    ...common,
    resources: [{
      runId: config.runId,
      type: 'aggregate-table',
      owned: true,
      createdByRun: false,
      identity: target,
      ownershipEvidence: ownership,
    }],
    writes: [],
  };
  const registryPath = writer(path.join(workDir, 'registry.json'), registry);
  return { manifestPath, registry, registryPath, snapshotPath, writer };
}

function persistRunState(artifacts, status, writes, restore, residual) {
  const hasUnknownWrite = writes.some((write) => write.status === 'outcome_unknown');
  const confirmedWrites = writes.filter((write) => write.status === 'completed').length;
  artifacts.registry.status = status;
  artifacts.registry.writes = writes.slice();
  artifacts.registry.remoteWrites = hasUnknownWrite ? 'unknown' : confirmedWrites;
  artifacts.registry.remoteWritesConfirmed = confirmedWrites;
  artifacts.registry.restore = restore || null;
  artifacts.registry.residual = residual || null;
  artifacts.writer(artifacts.registryPath, artifacts.registry);
  const manifest = JSON.parse(fs.readFileSync(artifacts.manifestPath, 'utf8'));
  manifest.status = status;
  manifest.executedWrites = writes.slice();
  manifest.remoteWrites = hasUnknownWrite ? 'unknown' : confirmedWrites;
  manifest.remoteWritesConfirmed = confirmedWrites;
  manifest.restore = restore || null;
  manifest.residual = residual || null;
  artifacts.writer(artifacts.manifestPath, manifest);
}

function safeErrorCode(error, fallback) {
  const code = error && error.code ? String(error.code) : '';
  return /^[A-Z][A-Z0-9_]{2,100}$/.test(code) ? code : fallback;
}

function revisionEvidence(stage, payload) {
  return {
    stage,
    revisionAxis: payload.revisionAxis,
    revisionSource: payload.revisionSource,
    revisionFingerprint: fingerprint(payload.revision),
    readbackVerified: payload.readbackVerified === true,
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run(options = {}) {
  const env = options.env || process.env;
  const resolved = resolveConfig(env);
  if (!resolved.config.enabled) {
    return { skipped: true, reason: 'Set OPENYIDA_E2E=1 and OPENYIDA_AGGREGATE_E2E=1 to run.', remoteWrites: 0 };
  }
  if (resolved.missing.length > 0) {
    return { skipped: false, status: 'PLATFORM_PROBE_REQUIRED', missing: resolved.missing, remoteWrites: 0 };
  }

  const config = resolved.config;
  const readDesignFixture = options.readDesignFixture || function(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  };
  readDesignFixture(config.designFixture);

  const execute = options.runCli || runCli;
  const wait = options.delay || delay;
  const plan = buildCommandPlan(config);
  const evidence = [];
  let remoteWritesConfirmed = 0;
  let remoteWritesUnknown = false;
  const writes = [];

  parseCliJson(execute(plan[0].args), 'auth');
  evidence.push({ stage: 'auth', verified: true });
  const listPayload = parseCliJson(execute(plan[1].args), 'list');
  const inspectPayload = parseCliJson(execute(plan[2].args), 'inspect');
  const ownership = verifyOwnership(config, listPayload, inspectPayload);
  evidence.push({ stage: 'ownership', ...ownership });
  if (!ownership.verified) {
    return { skipped: false, status: 'PLATFORM_PROBE_REQUIRED', reason: ownership.reason, remoteWrites: 0, evidence };
  }

  const beforeRaw = inspectPayload.config;
  const beforeCanonical = canonicalDesignConfig(beforeRaw);
  const baseline = { raw: beforeRaw, canonical: beforeCanonical, canonicalHash: canonicalFingerprint(beforeCanonical) };
  evidence.push({ stage: 'baseline', canonicalHash: baseline.canonicalHash, resourceCounts: resourceCounts(beforeCanonical) });
  if (beforeRaw.gmtModified === undefined || beforeRaw.gmtModified === null ||
      beforeRaw.stashGmtModified === undefined || beforeRaw.stashGmtModified === null) {
    return {
      skipped: false,
      status: 'PLATFORM_PROBE_REQUIRED',
      reason: 'baseline_revision_unproven',
      remoteWrites: 0,
      evidence,
    };
  }
  try {
    assertAggregateDesignConfig(beforeCanonical, { mode: 'publish' });
  } catch (error) {
    return {
      skipped: false,
      status: 'PLATFORM_PROBE_REQUIRED',
      reason: 'baseline_restore_contract_unproven',
      remoteWrites: 0,
      evidence,
    };
  }

  const previewPayload = parseCliJson(execute(plan[3].args), 'preview');
  evidence.push({
    stage: 'preview',
    verified: previewPayload && previewPayload.success !== false,
    rowCount: Number(previewPayload && previewPayload.rowCount) || 0,
  });

  const artifacts = persistPreWriteEvidence(config, baseline, ownership, {
    workDir: options.workDir,
    writeJson: options.writeJson,
  });

  function inspectObservedState(stage) {
    let payload;
    try {
      payload = parseCliJson(execute(plan[2].args), stage);
    } catch (error) {
      return {
        verified: false,
        reason: 'inspect_unproven',
        errorCode: safeErrorCode(error, 'AGGREGATE_E2E_INSPECT_FAILED'),
      };
    }
    const observedOwnership = verifyOwnership(config, listPayload, payload);
    let canonicalHash = null;
    try {
      canonicalHash = canonicalFingerprint(canonicalDesignConfig(payload.config));
    } catch (error) {
      return {
        verified: false,
        reason: 'canonical_readback_unproven',
        ownership: observedOwnership,
        payload,
      };
    }
    const state = {
      verified: observedOwnership.verified === true,
      reason: observedOwnership.verified ? null : observedOwnership.reason,
      ownership: observedOwnership,
      canonicalHash,
      payload,
      revisions: {
        gmtModified: payload.config && payload.config.gmtModified,
        stashGmtModified: payload.config && payload.config.stashGmtModified,
      },
    };
    evidence.push({
      stage,
      verified: state.verified,
      canonicalHash,
      liveRevisionFingerprint: fingerprint(state.revisions.gmtModified),
      stashRevisionFingerprint: fingerprint(state.revisions.stashGmtModified),
    });
    return state;
  }

  function buildResidual(observed) {
    const owned = observed && observed.ownership
      ? observed.ownership.verified === true
      : 'unknown';
    const matchesBaseline = observed && observed.canonicalHash === baseline.canonicalHash;
    return {
      status: matchesBaseline ? 'none' : owned === true ? 'owned_residual' : 'residual_unproven',
      owned,
      targetFingerprint: fingerprint(config.formUuid),
      canonicalFingerprint: observed && observed.canonicalHash || null,
      liveRevisionFingerprint: observed && observed.revisions
        ? fingerprint(observed.revisions.gmtModified)
        : null,
      stashRevisionFingerprint: observed && observed.revisions
        ? fingerprint(observed.revisions.stashGmtModified)
        : null,
    };
  }

  function finishResult(status, runtime, restore, operation, residual) {
    persistRunState(artifacts, status, writes, restore, residual);
    return {
      skipped: false,
      status,
      runId: config.runId,
      targetFingerprint: fingerprint(`${config.appType}\u0000${config.formUuid}`),
      remoteWrites: remoteWritesUnknown ? 'unknown' : remoteWritesConfirmed,
      remoteWritesConfirmed,
      evidence,
      runtime,
      operation,
      restore,
      residual,
      cleanup: restore.status === 'restored' || restore.status === 'not_required'
        ? { status: 'restored_to_baseline', targetFingerprint: fingerprint(config.formUuid) }
        : { status: 'cleanup_blocked', reason: 'restore_blocked', targetFingerprint: fingerprint(config.formUuid) },
      manifestPath: artifacts.manifestPath,
      registryPath: artifacts.registryPath,
    };
  }

  function executeWrite(stage, args, revisionAxis) {
    const record = { stage, status: 'attempted' };
    writes.push(record);
    persistRunState(artifacts, `${stage}_attempted`, writes, null, null);
    try {
      const payload = parseCliJson(execute(args), stage);
      assertRevisionStage(stage, payload, revisionAxis);
      record.status = 'completed';
      remoteWritesConfirmed += 1;
      persistRunState(artifacts, `${stage}_completed`, writes, null, null);
      return { ok: true, payload };
    } catch (error) {
      const preconditionFailed = error.code === 'AGGREGATE_WRITE_PRECONDITION_FAILED';
      record.status = preconditionFailed ? 'not_written_precondition_failed' : 'outcome_unknown';
      record.errorCode = safeErrorCode(error, `AGGREGATE_E2E_${stage.toUpperCase()}_FAILED`);
      if (!preconditionFailed) { remoteWritesUnknown = true; }
      persistRunState(artifacts, `${stage}_failed`, writes, null, null);
      return {
        ok: false,
        errorCode: record.errorCode,
        outcome: record.status,
      };
    }
  }

  function finishFailedOperation(failedStage, writeFailure, observedState) {
    const observed = observedState || inspectObservedState(`${failedStage}_failure_inspect`);
    const residual = buildResidual(observed);
    const blockedReason = writeFailure.outcome === 'not_written_precondition_failed'
      ? 'concurrent_revision_change'
      : writeFailure.outcome === 'not_attempted_post_save_guard'
        ? 'post_save_state_unproven'
        : 'write_outcome_unknown';
    const restore = residual.status === 'none'
      ? { status: 'not_required', reason: 'baseline_canonical_unchanged', remoteWrites: 0 }
      : {
        status: 'restore_blocked',
        reason: blockedReason,
        remoteWrites: 0,
      };
    const status = restore.status === 'restore_blocked' ? 'restore_blocked' : 'PLATFORM_PROBE_REQUIRED';
    return finishResult(
      status,
      { status: 'PLATFORM_PROBE_REQUIRED', reason: `${failedStage}_write_incomplete` },
      restore,
      {
        status: 'failed',
        failedStage,
        outcome: writeFailure.outcome,
        errorCode: writeFailure.errorCode,
      },
      residual
    );
  }

  const saveArgs = [
    ...plan[4].args,
    '--expected-revision', String(beforeRaw.stashGmtModified),
  ];
  const save = executeWrite('save', saveArgs, 'stashGmtModified');
  if (!save.ok) {
    return finishFailedOperation('save', save);
  }
  evidence.push(revisionEvidence('save', save.payload));

  const postSaveState = inspectObservedState('post_save_inspect');
  const postSaveLiveRevision = postSaveState.revisions && postSaveState.revisions.gmtModified;
  const postSaveStashRevision = postSaveState.revisions && postSaveState.revisions.stashGmtModified;
  if (!postSaveState.verified || postSaveLiveRevision === undefined || postSaveLiveRevision === null ||
      String(postSaveLiveRevision) !== String(beforeRaw.gmtModified) ||
      String(postSaveStashRevision) !== String(save.payload.readbackRevision)) {
    return finishFailedOperation('publish', {
      outcome: 'not_attempted_post_save_guard',
      errorCode: 'AGGREGATE_E2E_POST_SAVE_STATE_UNPROVEN',
    }, postSaveState);
  }

  const publishArgs = [
    ...plan[5].args,
    '--expected-revision', String(postSaveLiveRevision),
  ];
  const publish = executeWrite('publish', publishArgs, 'gmtModified');
  if (!publish.ok) {
    return finishFailedOperation('publish', publish);
  }
  const publishPayload = publish.payload;
  evidence.push(revisionEvidence('publish', publishPayload));

  let operationFailure = null;
  let buildPayload = null;
  try {
    for (let attempt = 0; attempt < config.maxStatusPolls; attempt++) {
      buildPayload = parseCliJson(execute(plan[6].args), 'build');
      evidence.push({ stage: 'build', attempt: attempt + 1, status: buildPayload.status || null });
      if (TERMINAL_BUILD_STATES.has(buildPayload.status)) { break; }
      await wait(config.statusPollMs);
    }
    if (!buildPayload || !TERMINAL_BUILD_STATES.has(buildPayload.status)) {
      operationFailure = { code: 'build_timeout' };
    } else if (buildPayload.status !== 'SUCCESS') {
      operationFailure = { code: 'build_failed' };
    }
  } catch (error) {
    operationFailure = { code: error.code || 'build_probe_failed' };
  }

  let runtime;
  if (!operationFailure && config.runtimeQueryConfirmed) {
    try {
      const args = ['data', 'query', 'form', config.appType, config.formUuid, '--size', '1', '--json'];
      const payload = parseCliJson(execute(args), 'runtime');
      const rows = Array.isArray(payload) ? payload : payload && payload.data;
      runtime = { status: 'verified', rowCount: Array.isArray(rows) ? rows.length : null };
    } catch (error) {
      operationFailure = { code: error.code || 'runtime_probe_failed' };
      runtime = { status: 'PLATFORM_PROBE_REQUIRED', reason: operationFailure.code };
    }
  } else {
    runtime = {
      status: 'PLATFORM_PROBE_REQUIRED',
      reason: operationFailure ? operationFailure.code : 'Published virtualView runtime query contract is not fixed-front-end proven.',
    };
  }

  let restore;
  let residual = null;
  const restoreState = inspectObservedState('restore_preflight');
  const observedRevision = restoreState.revisions && restoreState.revisions.gmtModified;
  if (!restoreState.verified) {
    restore = { status: 'restore_blocked', reason: 'restore_preflight_unproven', remoteWrites: 0 };
  } else if (!restoreState.ownership.verified) {
    restore = { status: 'restore_blocked', reason: 'ownership_evidence_changed', remoteWrites: 0 };
  } else if (observedRevision === undefined || observedRevision === null ||
      String(observedRevision) !== String(publishPayload.readbackRevision)) {
    restore = { status: 'restore_blocked', reason: 'concurrent_revision_change', remoteWrites: 0 };
  } else {
    const restoreArgs = [
      'aggregate-table', 'publish', config.appType, config.formUuid, artifacts.snapshotPath,
      '--expected-revision', String(observedRevision), '--json', '--no-open',
    ];
    const restoreWrite = executeWrite('conditional_restore', restoreArgs, 'gmtModified');
    if (!restoreWrite.ok) {
      restore = {
        status: 'restore_blocked',
        reason: restoreWrite.outcome === 'not_written_precondition_failed'
          ? 'concurrent_revision_change'
          : 'conditional_restore_unproven',
        remoteWrites: restoreWrite.outcome === 'not_written_precondition_failed' ? 0 : 'unknown',
      };
    } else {
      const restoredState = inspectObservedState('restore_readback');
      const restoredFingerprint = restoredState.canonicalHash;
      if (!restoredState.verified || restoredFingerprint !== baseline.canonicalHash) {
        restore = {
          status: 'restore_blocked',
          reason: 'exact_restore_readback_mismatch',
          remoteWrites: 1,
          beforeFingerprint: baseline.canonicalHash,
          restoredFingerprint,
        };
      } else {
        restore = {
          status: 'restored',
          remoteWrites: 1,
          beforeFingerprint: baseline.canonicalHash,
          restoredFingerprint,
        };
      }
    }
  }

  if (restore.status !== 'restored') {
    residual = buildResidual(restoreState);
  }
  const finalStatus = restore.status === 'restored'
    ? (operationFailure ? 'PLATFORM_PROBE_REQUIRED' : runtime.status === 'verified' ? 'verified' : 'PLATFORM_PROBE_REQUIRED')
    : 'restore_blocked';
  return finishResult(
    finalStatus,
    runtime,
    restore,
    { status: operationFailure ? 'failed' : 'completed', errorCode: operationFailure && operationFailure.code },
    residual
  );
}

if (require.main === module) {
  run().then((result) => {
    console.log(JSON.stringify(result, null, 2));
    if (!result.skipped && result.status !== 'verified') { process.exitCode = 2; }
  }).catch((error) => {
    console.error(error.code || 'AGGREGATE_E2E_FAILED');
    process.exitCode = 1;
  });
}

module.exports = {
  TERMINAL_BUILD_STATES,
  assertRevisionStage,
  buildCommandPlan,
  canonicalDesignConfig,
  canonicalFingerprint,
  fingerprint,
  parseCliJson,
  persistPreWriteEvidence,
  resolveConfig,
  run,
  verifyOwnership,
};
