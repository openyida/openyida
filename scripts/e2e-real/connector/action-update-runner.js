#!/usr/bin/env node

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { isDeepStrictEqual } = require('util');
const { t } = require('../../../lib/core/i18n');
const {
  assertActionUpdateReadback,
  createActionSnapshot,
  patchActionQuery,
} = require('../../../lib/connector/connector-action-update');
const { runCli: defaultRunCli } = require('./runner');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const DEFAULT_REGISTRY_DIR = path.join(ROOT, 'project', '.cache', 'e2e-real', 'connector-action-update');
const FIXTURE_HOST = 'www.aliwork.com';
const FIXTURE_PATH = 'query/loginFreeFormData/listFormDataByType.json';
const TARGET_OPERATION_ID = 'openyida_fixture_search';
const SENTINEL_OPERATION_ID = 'openyida_preservation_sentinel';
const FILTER_FIELD = 'radioField_lbarqa36';

function e2eError(code, messageKey) {
  const error = new Error(t(messageKey));
  error.code = code;
  return error;
}

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(String(value)).digest('hex')}`;
}

function nowStamp(date = new Date()) {
  return date.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
}

function getConfig(env = process.env, date = new Date()) {
  const enabled = env.OPENYIDA_E2E === '1' && env.OPENYIDA_E2E_CONNECTOR_ACTION_UPDATE === '1';
  const prefix = env.OPENYIDA_E2E_CONNECTOR_ACTION_PREFIX || `OY_E2E_CONNECTOR_ACTION_${nowStamp(date)}`;
  return {
    enabled,
    ready: enabled,
    missing: enabled ? [] : ['OPENYIDA_E2E=1', 'OPENYIDA_E2E_CONNECTOR_ACTION_UPDATE=1'],
    prefix,
    displayName: `${prefix}__OwnedNoneAuth`,
    host: FIXTURE_HOST,
    baseUrl: '/',
    scheme: 'https',
    securitySchemes: '{}',
    registryDir: env.OPENYIDA_E2E_REGISTRY_DIR || DEFAULT_REGISTRY_DIR,
  };
}

function queryNode(name, value) {
  return {
    name,
    paramType: 'String',
    paramLocation: 'query',
    queryDefaultValue: { paramType: 'fixedValue', defaultValue: value },
    childList: [],
    children: [],
  };
}

function buildOperation(operationId, queryValues) {
  const headers = [
    { name: 'Referer', value: 'https://www.aliwork.com/' },
    { name: 'X-Requested-With', value: 'XMLHttpRequest' },
  ];
  return {
    id: `operation-${operationId}`,
    operationId,
    summary: operationId,
    description: 'Owned OpenYida connector action update regression fixture.',
    url: FIXTURE_PATH,
    method: 'get',
    inputs: [
      {
        name: 'Headers',
        paramType: 'Object',
        paramLocation: 'header',
        childList: headers.map(header => ({
          name: header.name,
          paramType: 'String',
          paramLocation: 'header',
          defaultValue: header.value,
          childList: [],
          children: [],
        })),
      },
      {
        name: 'Query',
        paramType: 'Object',
        paramLocation: 'query',
        childList: Object.entries(queryValues).map(([name, value]) => queryNode(name, value)),
      },
    ],
    parameters: {
      header: headers,
      query: Object.entries(queryValues).map(([name, value]) => ({ name, value })),
    },
    responses: { type: 'object', properties: {} },
    outputs: [{
      defaultValue: '{}',
      desc: 'Response body',
      name: 'Response',
      paramType: 'Object',
      required: false,
      childList: [],
    }],
    origin: true,
  };
}

function buildFixtureOperations(runId, stamp = Date.now()) {
  const queryValues = {
    _api: 'nattyFetch',
    _mock: 'false',
    userLanguage: 'zh_CN',
    pageSize: '1',
    currentPage: '2',
    type: 'yida_helper_base',
    searchFieldJson: JSON.stringify({ [FILTER_FIELD]: 'y' }),
    _stamp: String(stamp),
  };
  return [
    buildOperation(TARGET_OPERATION_ID, queryValues),
    buildOperation(SENTINEL_OPERATION_ID, { ...queryValues, _stamp: `${stamp}-${sha256(runId).slice(-8)}` }),
  ];
}

function parseObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {return value;}
  if (typeof value !== 'string') {return null;}
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function summarizeFixtureResponse(response, expectation) {
  const expected = typeof expectation === 'number'
    ? { dataLength: expectation }
    : expectation;
  const statusMatch = String(response && response.statusLine || '')
    .match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})(?:\s|$)/i);
  const headers = parseObject(response && response.responseHeaders);
  const bodyText = typeof (response && response.content) === 'string'
    ? response.content
    : JSON.stringify(response && response.content);
  const body = parseObject(bodyText);
  const contentTypeEntry = headers && Object.entries(headers)
    .filter(([name]) => name.toLowerCase() === 'content-type');
  const contentType = contentTypeEntry && contentTypeEntry.length === 1
    ? String(contentTypeEntry[0][1])
    : '';
  const content = body && body.content;
  const data = content && Array.isArray(content.data) ? content.data : null;
  if (!statusMatch || Number(statusMatch[1]) < 200 || Number(statusMatch[1]) >= 300 ||
      !headers || !contentType.toLowerCase().includes('application/json') ||
      !body || body.success !== true || !content || typeof content !== 'object' || !data) {
    throw e2eError(
      'CONNECTOR_ACTION_E2E_RESPONSE_INVALID',
      'connector_action_e2e.response_invalid'
    );
  }
  if (!expected || !Number.isInteger(expected.dataLength) || data.length !== expected.dataLength) {
    throw e2eError(
      'CONNECTOR_ACTION_E2E_COUNT_MISMATCH',
      'connector_action_e2e.count_mismatch'
    );
  }
  if (Object.prototype.hasOwnProperty.call(expected, 'currentPage') &&
      (!Object.prototype.hasOwnProperty.call(content, 'currentPage') ||
       String(content.currentPage) !== String(expected.currentPage))) {
    throw e2eError(
      'CONNECTOR_ACTION_E2E_CURRENT_PAGE_MISMATCH',
      'connector_action_e2e.current_page_mismatch'
    );
  }
  return {
    statusCode: Number(statusMatch[1]),
    contentType: 'application/json',
    bodyBytes: Buffer.byteLength(bodyText || '', 'utf8'),
    bodyHash: sha256(bodyText || ''),
    topKeys: Object.keys(body).sort(),
    contentKeys: Object.keys(content).sort(),
    dataLength: data.length,
    ...(Object.prototype.hasOwnProperty.call(expected, 'currentPage')
      ? { currentPage: content.currentPage }
      : {}),
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function requireResult(result, code = 'CONNECTOR_ACTION_E2E_CLI_CONTRACT_INVALID') {
  if (!result || !result.json || result.json.success === false || result.json.status === 'error') {
    throw e2eError(code, 'connector_action_e2e.cli_contract_invalid');
  }
  return result.json;
}

function operationQuery(operation) {
  if (!operation || !operation.parameters || !Array.isArray(operation.parameters.query)) {
    throw e2eError('CONNECTOR_ACTION_E2E_ACTION_INVALID', 'connector_action_e2e.action_invalid');
  }
  return Object.fromEntries(operation.parameters.query.map(item => [item.name, item.value]));
}

function operationHeaders(operation) {
  if (!operation || !operation.parameters || !Array.isArray(operation.parameters.header)) {
    throw e2eError('CONNECTOR_ACTION_E2E_ACTION_INVALID', 'connector_action_e2e.action_invalid');
  }
  return Object.fromEntries(operation.parameters.header.map(item => [item.name, item.value]));
}

async function run(options = {}) {
  const env = options.env || process.env;
  const config = options.config || getConfig(env);
  const logger = options.logger || console.log;
  if (!config.enabled) {
    logger(t('connector_action_e2e.skip_missing', config.missing.join(', ')));
    return { skipped: true, remoteWrites: 0, missing: config.missing };
  }

  const executeCli = options.runCli || defaultRunCli;
  const operations = options.operations || buildFixtureOperations(config.prefix, options.initialStamp || Date.now());
  const runDir = path.join(config.registryDir, config.prefix);
  const artifactPath = path.join(runDir, 'evidence', 'operations.json');
  const registryPath = path.join(config.registryDir, `${config.prefix}.json`);
  const manifestPath = path.join(config.registryDir, `${config.prefix}.manifest.json`);
  const serializedOperations = `${JSON.stringify(operations, null, 2)}\n`;
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, serializedOperations, 'utf8');

  const transitions = [
    {
      label: 'currentPage',
      patch: { currentPage: '1' },
      evidenceLevel: 'runtime_exact_current_page',
      runtimeExpectation: { dataLength: 1, currentPage: '1' },
      restore: { currentPage: '2' },
      restoreRuntimeExpectation: { dataLength: 1, currentPage: '2' },
    },
    {
      label: 'pageSize',
      patch: { pageSize: '2' },
      evidenceLevel: 'runtime_exact_count',
      runtimeExpectation: { dataLength: 2 },
      restore: { pageSize: '1' },
      restoreRuntimeExpectation: { dataLength: 1 },
    },
    {
      label: 'userLanguage',
      patch: { userLanguage: 'en_US' },
      evidenceLevel: 'platform_exact_readback_restore',
      runtimeExpectation: null,
      restore: { userLanguage: 'zh_CN' },
      restoreRuntimeExpectation: null,
    },
    {
      label: 'searchFieldJson',
      patch: { searchFieldJson: JSON.stringify({ [FILTER_FIELD]: 'n' }) },
      evidenceLevel: 'runtime_exact_count',
      runtimeExpectation: { dataLength: 0 },
      restore: { searchFieldJson: JSON.stringify({ [FILTER_FIELD]: 'y' }) },
      restoreRuntimeExpectation: { dataLength: 1 },
    },
    {
      label: '_stamp',
      patch: { _stamp: String((options.initialStamp || Date.now()) + 1) },
      evidenceLevel: 'platform_exact_readback_restore',
      runtimeExpectation: null,
      restore: { _stamp: operationQuery(operations[0])._stamp },
      restoreRuntimeExpectation: null,
    },
  ];
  const registry = {
    runId: config.prefix,
    status: 'preflight',
    remoteWrites: 0,
    plannedWrites: 1 + transitions.length * 2,
    resourcePlan: [{
      type: 'connector',
      name: config.displayName,
      owned: true,
      auth: 'NONE',
      actionIds: operations.map(operation => operation.operationId),
    }],
    provenance: {
      source: 'owner-confirmed-login-free-fixture',
      host: FIXTURE_HOST,
      path: `/${FIXTURE_PATH}`,
      method: 'GET',
      requiredHeaderNames: ['Referer', 'X-Requested-With'],
      responseEvidence: ['structure', 'count', 'sha256'],
      identityEvidenceStored: false,
    },
    artifact: { path: artifactPath, sha256: sha256(serializedOperations) },
    preWriteCheckpoint: { ready: false, remoteWrites: 0 },
    writeAttempts: [],
    resources: [],
    steps: [],
    evidenceLevel: 'mixed_explicit_contracts',
  };
  const manifest = {
    runId: registry.runId,
    plannedWrites: registry.plannedWrites,
    resourcePlan: registry.resourcePlan,
    provenance: registry.provenance,
    artifact: registry.artifact,
    evidenceLevel: registry.evidenceLevel,
  };
  let revision = 0;
  let connectorId = null;
  let connectorName = null;

  function persist() {
    revision += 1;
    registry.evidenceRevision = revision;
    Object.assign(manifest, {
      evidenceRevision: revision,
      status: registry.status,
      remoteWrites: registry.remoteWrites,
      preWriteCheckpoint: registry.preWriteCheckpoint,
      writeAttempts: registry.writeAttempts,
      resources: registry.resources,
      steps: registry.steps,
      cleanup: registry.cleanup || null,
    });
    writeJson(manifestPath, manifest);
    writeJson(registryPath, registry);
  }

  function beginWrite(stage, candidate) {
    if (!registry.preWriteCheckpoint.ready || !fs.existsSync(registryPath) ||
        !fs.existsSync(manifestPath) || !fs.existsSync(artifactPath)) {
      throw e2eError(
        'CONNECTOR_ACTION_E2E_PREWRITE_MISSING',
        'connector_action_e2e.prewrite_missing'
      );
    }
    const attempt = {
      stage,
      status: 'attempted',
      attemptedAt: new Date().toISOString(),
      candidate: { ...candidate, owned: false },
    };
    registry.writeAttempts.push(attempt);
    registry.remoteWrites += 1;
    persist();
    return attempt;
  }

  function completeWrite(attempt, evidence = {}) {
    attempt.status = 'completed';
    attempt.completedAt = new Date().toISOString();
    attempt.evidence = evidence;
    persist();
  }

  function unknownWrite(attempt) {
    attempt.status = 'outcome_unknown';
    attempt.outcomeRecordedAt = new Date().toISOString();
    registry.resources.push({
      ...attempt.candidate,
      owned: false,
      outcome: 'outcome_unknown',
      stage: attempt.stage,
    });
    persist();
  }

  function execute(args) {
    return requireResult(executeCli(args, env));
  }

  function readState() {
    const detailResult = execute(['connector', 'detail', String(connectorId), '--json']);
    const listResult = execute(['connector', 'list-actions', String(connectorId), '--json']);
    const connectionsResult = execute(['connector', 'list-connections', String(connectorId), '--json']);
    const snapshot = createActionSnapshot(detailResult.detail);
    if (!isDeepStrictEqual(listResult.operations, snapshot.operations) ||
        !Array.isArray(connectionsResult.connections) || connectionsResult.connections.length !== 0) {
      throw e2eError(
        'CONNECTOR_ACTION_E2E_STATE_INCOMPLETE',
        'connector_action_e2e.state_incomplete'
      );
    }
    return { snapshot, connectionCount: 0 };
  }

  function testCurrentAction(snapshot, runtimeExpectation, label, evidenceLevel) {
    const target = snapshot.operations.find(operation => operation.operationId === TARGET_OPERATION_ID);
    if (!target) {
      throw e2eError('CONNECTOR_ACTION_E2E_ACTION_INVALID', 'connector_action_e2e.action_invalid');
    }
    let summary;
    if (runtimeExpectation) {
      const response = execute([
        'connector', 'test', '--connector-id', String(connectorId), '--action', TARGET_OPERATION_ID,
        '--path-json', '{}', '--query-json', JSON.stringify(operationQuery(target)),
        '--header-json', JSON.stringify(operationHeaders(target)), '--body-json', '{}', '--json',
      ]);
      summary = summarizeFixtureResponse(response, runtimeExpectation);
    }
    const step = {
      label,
      evidenceLevel,
      platformExactReadbackVerified: true,
      runtimeVerified: Boolean(runtimeExpectation),
      queryHash: sha256(JSON.stringify(operationQuery(target))),
      actionCount: snapshot.operations.length,
      connectorFingerprint: snapshot.connectorFingerprint,
      connectionCount: 0,
    };
    if (summary) {
      step.runtimeExpectation = { ...runtimeExpectation };
      step.response = summary;
    }
    registry.steps.push(step);
    persist();
    return summary;
  }

  function updateAndVerify(state, label, patch, runtimeExpectation, evidenceLevel) {
    const expected = patchActionQuery(state.snapshot, TARGET_OPERATION_ID, patch);
    const attempt = beginWrite(`update:${label}`, {
      type: 'connector-action-state',
      connectorId: String(connectorId),
      operationId: TARGET_OPERATION_ID,
      patchKeys: Object.keys(patch).sort(),
      patchHash: sha256(JSON.stringify(patch)),
    });
    try {
      const result = execute([
        'connector', 'update-action', '--connector-id', String(connectorId),
        '--action', TARGET_OPERATION_ID, '--query-json', JSON.stringify(patch), '--confirm', '--json',
      ]);
      if (result.readbackVerified !== true || result.beforeFingerprint !== result.afterFingerprint) {
        throw e2eError(
          'CONNECTOR_ACTION_E2E_UPDATE_UNVERIFIED',
          'connector_action_e2e.update_unverified'
        );
      }
      const after = readState();
      assertActionUpdateReadback(state.snapshot, expected.operations, {
        ...after.snapshot.connector,
        operations: JSON.stringify(after.snapshot.operations),
      });
      completeWrite(attempt, {
        connectorFingerprint: after.snapshot.connectorFingerprint,
        actionCount: after.snapshot.operations.length,
        stableIdsHash: sha256(JSON.stringify(after.snapshot.stableIds)),
      });
      testCurrentAction(after.snapshot, runtimeExpectation, label, evidenceLevel);
      return after;
    } catch (error) {
      unknownWrite(attempt);
      throw error;
    }
  }

  persist();
  logger(t('connector_action_e2e.resource_plan', JSON.stringify({
    runId: registry.runId,
    plannedWrites: registry.plannedWrites,
    resourcePlan: registry.resourcePlan,
    provenance: registry.provenance,
    artifact: registry.artifact,
  })));

  try {
    const auth = execute(['login', '--check-only', '--json']);
    if (auth.ok !== true || auth.status !== 'ok') {
      registry.status = 'PLATFORM_PROBE_REQUIRED';
      registry.cleanup = { status: 'passed', residual: [], deleteCommands: [] };
      persist();
      return { skipped: false, status: registry.status, remoteWrites: 0, registryPath, manifestPath, registry };
    }
    registry.preWriteCheckpoint = {
      ready: true,
      remoteWrites: 0,
      artifactSha256: registry.artifact.sha256,
      authenticationChecked: true,
      identityEvidenceStored: false,
    };
    persist();

    const createAttempt = beginWrite('connector-create', {
      type: 'connector-candidate',
      name: config.displayName,
    });
    let created;
    try {
      created = execute([
        'connector', 'create', config.displayName, `https://${FIXTURE_HOST}/`,
        '--auth', '无身份验证', '--operations', artifactPath, '--json',
      ]);
      if (!created.connectorId || !created.connectorName || created.readbackVerified !== true) {
        throw e2eError(
          'CONNECTOR_ACTION_E2E_CREATE_UNVERIFIED',
          'connector_action_e2e.create_unverified'
        );
      }
      connectorId = String(created.connectorId);
      connectorName = created.connectorName;
      completeWrite(createAttempt, { connectorId, connectorNameHash: sha256(connectorName) });
    } catch (error) {
      unknownWrite(createAttempt);
      throw error;
    }
    registry.resources.push({
      type: 'connector',
      runId: config.prefix,
      owned: true,
      exactId: connectorId,
      name: config.displayName,
      connectorNameHash: sha256(connectorName),
    });
    persist();

    let state = readState();
    if (!isDeepStrictEqual(state.snapshot.operations, operations)) {
      throw e2eError(
        'CONNECTOR_ACTION_E2E_STATE_INCOMPLETE',
        'connector_action_e2e.state_incomplete'
      );
    }
    const baselineFingerprint = state.snapshot.connectorFingerprint;
    testCurrentAction(state.snapshot, { dataLength: 1 }, 'baseline', 'runtime_structure_count');

    for (const transition of transitions) {
      state = updateAndVerify(
        state,
        transition.label,
        transition.patch,
        transition.runtimeExpectation,
        transition.evidenceLevel
      );
      state = updateAndVerify(
        state,
        `${transition.label}:restore`,
        transition.restore,
        transition.restoreRuntimeExpectation,
        transition.evidenceLevel
      );
      if (state.snapshot.connectorFingerprint !== baselineFingerprint) {
        throw e2eError(
          'CONNECTOR_ACTION_E2E_STATE_INCOMPLETE',
          'connector_action_e2e.state_incomplete'
        );
      }
    }

    if (!isDeepStrictEqual(state.snapshot.operations, operations)) {
      throw e2eError(
        'CONNECTOR_ACTION_E2E_RESTORE_MISMATCH',
        'connector_action_e2e.restore_mismatch'
      );
    }
    registry.status = 'cleanup_blocked';
    registry.cleanup = {
      status: 'cleanup_blocked',
      residual: registry.resources.map(resource => ({ resource, reason: 'remote_cleanup_unsupported' })),
      deleteCommands: [],
    };
    registry.finishedAt = new Date().toISOString();
    persist();
    return {
      skipped: false,
      status: registry.status,
      remoteWrites: registry.remoteWrites,
      registryPath,
      manifestPath,
      registry,
    };
  } catch (error) {
    registry.status = 'failed';
    registry.error = { code: error.code || 'CONNECTOR_ACTION_E2E_FAILED' };
    registry.cleanup = {
      status: 'cleanup_blocked',
      residual: registry.resources.map(resource => ({
        resource,
        reason: resource.outcome === 'outcome_unknown'
          ? 'remote_outcome_unknown'
          : 'remote_cleanup_unsupported',
      })),
      deleteCommands: [],
    };
    registry.finishedAt = new Date().toISOString();
    persist();
    const safeError = new Error(t('connector_action_e2e.failed'));
    safeError.code = error.code || 'CONNECTOR_ACTION_E2E_FAILED';
    throw safeError;
  }
}

if (require.main === module) {
  run().then(result => {
    if (result.status === 'PLATFORM_PROBE_REQUIRED') {process.exitCode = 2;}
  }).catch(error => {
    console.error(`${error.code || 'CONNECTOR_ACTION_E2E_FAILED'}: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildFixtureOperations,
  getConfig,
  run,
  summarizeFixtureResponse,
};
