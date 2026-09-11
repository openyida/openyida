#!/usr/bin/env node

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { isDeepStrictEqual } = require('util');
const { isPathInside, ownershipResult } = require('../cleanup');
const { t } = require('../../../lib/core/i18n');
const { redactString } = require('../../../lib/core/redact');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const BIN = path.join(ROOT, 'bin', 'yida.js');
const DEFAULT_REGISTRY_DIR = path.join(ROOT, 'project', '.cache', 'e2e-real', 'connector');
const DISALLOWED_FIXTURE_HOSTS = ['httpbin.org', 'httpbingo.org', 'example.com'];

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(String(value)).digest('hex')}`;
}

function hashIdentity(value) {
  return value ? sha256(value) : null;
}

function redactCorpIdentifiers(value) {
  return String(value || '')
    .replace(/((?:corp[_-]?id|corpId)\s*[=:]\s*["']?)[^"'\s,}\]]+/gi, '$1<redacted>')
    .replace(/(--corp-id\s+)[^\s]+/gi, '$1<redacted>');
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeRegistry(registryPath, registry) {
  writeJson(registryPath, registry);
}

function isControlledFixtureUrl(value) {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    return parsed.protocol === 'https:' && !DISALLOWED_FIXTURE_HOSTS.some(
      blocked => hostname === blocked || hostname.endsWith(`.${blocked}`)
    );
  } catch {
    return false;
  }
}

function nowStamp(date = new Date()) {
  return date.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
}

function getConfig(env = process.env, date = new Date()) {
  const prefix = env.OPENYIDA_E2E_CONNECTOR_PREFIX || `OY_E2E_CONNECTOR_${nowStamp(date)}`;
  const corpId = String(env.OPENYIDA_E2E_CORP_ID || '').trim() || null;
  const echoBaseUrl = String(env.OPENYIDA_E2E_CONNECTOR_ECHO_URL || '').trim() || null;
  const fixtureMarker = String(env.OPENYIDA_E2E_CONNECTOR_FIXTURE_MARKER || '').trim() || null;
  const fixtureOwner = String(env.OPENYIDA_E2E_CONNECTOR_FIXTURE_OWNER || '').trim() || null;
  const missing = [];
  if (env.OPENYIDA_E2E !== '1') {missing.push('OPENYIDA_E2E=1');}
  if (env.OPENYIDA_E2E_CONNECTOR !== '1') {missing.push('OPENYIDA_E2E_CONNECTOR=1');}
  if (!corpId) {missing.push('OPENYIDA_E2E_CORP_ID');}
  if (!echoBaseUrl || !isControlledFixtureUrl(echoBaseUrl)) {
    missing.push('OPENYIDA_E2E_CONNECTOR_ECHO_URL');
  }
  if (!fixtureMarker) {missing.push('OPENYIDA_E2E_CONNECTOR_FIXTURE_MARKER');}
  if (!fixtureOwner) {missing.push('OPENYIDA_E2E_CONNECTOR_FIXTURE_OWNER');}
  const enabled = env.OPENYIDA_E2E === '1' && env.OPENYIDA_E2E_CONNECTOR === '1';
  return {
    enabled,
    ready: enabled && missing.length === 0,
    missing,
    prefix,
    connectorName: `${prefix}__Connector`,
    connectionName: `${prefix}__Account`,
    echoBaseUrl,
    fixtureMarker,
    fixtureOwner,
    registryDir: env.OPENYIDA_E2E_REGISTRY_DIR || DEFAULT_REGISTRY_DIR,
    corpId,
  };
}

function buildEchoOperation() {
  return {
    id: 'operation-openyida_echo',
    operationId: 'openyida_echo',
    summary: 'OpenYida deterministic echo',
    description: 'Verifies a controlled echo fixture and Basic auth runtime without persisting credentials.',
    url: '/',
    method: 'post',
    inputs: [
      {
        name: 'Query',
        paramType: 'Object',
        paramLocation: 'query',
        childList: [{ name: 'runId', paramType: 'String', paramLocation: 'query', childList: [], children: [] }],
      },
      {
        name: 'Body',
        paramType: 'Object',
        paramLocation: 'body',
        childList: [
          { name: 'runId', paramType: 'String', paramLocation: 'body', childList: [], children: [] },
          { name: 'owned', paramType: 'Boolean', paramLocation: 'body', childList: [], children: [] },
        ],
      },
    ],
    parameters: {
      header: [],
      query: [{ name: 'runId', value: '' }],
      body: { default: '{"runId":"","owned":true}' },
    },
    responses: { type: 'object', properties: {} },
    outputs: [{ defaultValue: '{}', desc: 'Response body', name: 'Response', paramType: 'Object', required: false, childList: [] }],
    origin: true,
  };
}

function parseCliJsonStdout(stdout) {
  const text = String(stdout || '').trim();
  if (!text) {return null;}
  try {
    return JSON.parse(text);
  } catch {
    // CLI commands may print human-readable lines before or after their JSON.
  }

  let lastParsed = null;
  let lastEnd = -1;
  for (let start = 0; start < text.length; start++) {
    if (text[start] !== '{' && text[start] !== '[') {continue;}
    const stack = [];
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index++) {
      const char = text[index];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === '{' || char === '[') {
        stack.push(char);
        continue;
      }
      if (char !== '}' && char !== ']') {continue;}
      const expected = char === '}' ? '{' : '[';
      if (stack.pop() !== expected) {break;}
      if (stack.length === 0) {
        try {
          const parsed = JSON.parse(text.slice(start, index + 1));
          if (index > lastEnd) {
            lastParsed = parsed;
            lastEnd = index;
          }
        } catch {
          // Keep scanning later top-level candidates.
        }
        break;
      }
    }
  }
  return lastParsed;
}

function runCli(args, env = process.env) {
  const result = spawnSync(process.execPath, [BIN, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...env, CI: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000,
  });
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  if (result.status !== 0) {
    throw new Error(redactCorpIdentifiers(redactString((stderr.trim() || stdout.trim()).slice(0, 1600))));
  }
  return { stdout, stderr, json: parseCliJsonStdout(stdout) };
}

function parseStrictJsonObject(value) {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value.trim());
    } catch {
      return null;
    }
  }
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
}

function validateControlledFixtureResponse(response, config) {
  if (!response || !String(response.statusLine || '').match(/^HTTP\/\d(?:\.\d)?\s+2\d\d(?:\s|$)/)) {
    return false;
  }
  const content = parseStrictJsonObject(response.content);
  const headers = parseStrictJsonObject(response.responseHeaders);
  if (!content || !headers) {return false;}
  const ownerHeaders = Object.entries(headers)
    .filter(([name]) => name.toLowerCase() === 'x-openyida-fixture-owner');
  return content.runId === config.prefix &&
    content.fixtureMarker === config.fixtureMarker &&
    content.authorization === 'Basic ***' &&
    ownerHeaders.length === 1 &&
    ownerHeaders[0][1] === config.fixtureOwner;
}

function writeOperations(config, operations) {
  const runDir = path.join(config.registryDir, config.prefix);
  const serialized = `${JSON.stringify(operations, null, 2)}\n`;
  const evidencePath = path.join(runDir, 'evidence', 'operations.json');
  const temporaryPath = path.join(runDir, 'tmp', 'operations.json');
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.mkdirSync(path.dirname(temporaryPath), { recursive: true });
  fs.writeFileSync(evidencePath, serialized, 'utf8');
  fs.writeFileSync(temporaryPath, serialized, 'utf8');
  return { evidencePath, temporaryPath, sha256: sha256(serialized) };
}

function createEvidence(config, operationArtifact) {
  const organizationSelection = {
    selector: 'explicit-corp-id',
    targetCorpHash: hashIdentity(config.corpId),
    verified: false,
    profileHash: null,
  };
  const fixture = {
    endpointHash: hashIdentity(config.echoBaseUrl),
    ownerHash: hashIdentity(config.fixtureOwner),
    expectedMarkerHash: hashIdentity(config.fixtureMarker),
    path: operationArtifact.evidencePath,
    sha256: operationArtifact.sha256,
  };
  const ownedResourcePlan = [
    { type: 'connector', name: config.connectorName, owned: true },
    { type: 'connection', name: config.connectionName, owned: true },
  ];
  const registry = {
    runId: config.prefix,
    startedAt: new Date().toISOString(),
    status: 'preflight',
    remoteWrites: 0,
    plannedWrites: ownedResourcePlan.length,
    organizationSelection,
    ownedResourcePlan,
    evidenceFixture: fixture,
    preWriteCheckpoint: { ready: false, remoteWrites: 0 },
    resources: [],
    commands: [],
    writeAttempts: [],
  };
  const manifest = {
    runId: config.prefix,
    plannedWrites: ownedResourcePlan.length,
    organizationSelection,
    ownedResourcePlan,
    fixture,
    preWriteCheckpoint: registry.preWriteCheckpoint,
    writeAttempts: registry.writeAttempts,
  };
  return { registry, manifest };
}

function redactRecordedArgs(args) {
  const redacted = args.slice();
  const secretFlags = new Set([
    '--username', '--password', '--api-key', '--app-key', '--app-secret', '--app-code', '--corp-id',
  ]);
  for (let i = 0; i < redacted.length; i++) {
    if (secretFlags.has(redacted[i]) && i + 1 < redacted.length) {
      redacted[i + 1] = '<redacted>';
    }
  }
  return redacted;
}

function requireResult(stepKey, result) {
  if (!result || !result.json || result.json.success === false || result.json.status === 'error') {
    throw new Error(t('connector_e2e.result_contract_invalid', t(`connector_e2e.${stepKey}`)));
  }
  return result.json;
}

function sanitizeMessage(message, sensitiveValues = []) {
  let sanitized = String(message || '');
  for (const value of sensitiveValues.filter(Boolean)) {
    sanitized = sanitized.split(String(value)).join('<redacted>');
  }
  return redactCorpIdentifiers(redactString(sanitized));
}

function cleanupOwnedConnectorResources(options) {
  const removed = [];
  const residual = [];
  const skipped = [];
  const removePath = options.removePath || (targetPath => fs.rmSync(targetPath, { recursive: true, force: true }));
  for (const resource of (options.resources || []).slice().reverse()) {
    if (resource && resource.runId === options.runId && resource.outcome === 'outcome_unknown') {
      residual.push({ resource, reason: 'remote_outcome_unknown' });
      continue;
    }
    const ownership = ownershipResult(resource, {
      runId: options.runId,
      namePrefix: options.namePrefix,
    });
    if (!ownership.owned) {
      skipped.push({ resource, reason: ownership.reason });
      continue;
    }
    if (resource.type === 'temporary-local-artifact') {
      const targetPath = resource.path || resource.exactId;
      if (!options.localRoot || !targetPath || !isPathInside(options.localRoot, targetPath)) {
        skipped.push({ resource, reason: 'local_path_outside_run_root' });
        continue;
      }
      removePath(targetPath);
      removed.push({ resource, path: targetPath });
      continue;
    }
    residual.push({ resource, reason: 'remote_cleanup_unsupported' });
  }
  return {
    status: residual.length || skipped.some(item => item.reason !== 'different_run')
      ? 'cleanup_blocked'
      : 'passed',
    removed,
    residual,
    skipped,
    deleteCommands: [],
  };
}

async function run(options = {}) {
  const env = options.env || process.env;
  const config = options.config || getConfig(env);
  const logger = options.logger || console.log;
  if (!config.enabled) {
    logger(t('connector_e2e.skip_missing', config.missing.join(', ')));
    return { skipped: true, missing: config.missing, remoteWrites: 0 };
  }

  const executeCli = options.runCli || runCli;
  const persistRegistry = options.writeRegistry || writeRegistry;
  const persistManifest = options.writeManifest || writeJson;
  const operation = options.operation || buildEchoOperation();
  const operationArtifact = (options.writeOperations || writeOperations)(config, [operation]);
  const { registry, manifest } = createEvidence(config, operationArtifact);
  const registryPath = path.join(config.registryDir, `${config.prefix}.json`);
  const manifestPath = path.join(config.registryDir, `${config.prefix}.manifest.json`);
  let evidenceRevision = 0;
  const sensitiveValues = [config.corpId];

  function persistEvidence() {
    evidenceRevision += 1;
    registry.evidenceRevision = evidenceRevision;
    manifest.evidenceRevision = evidenceRevision;
    manifest.organizationSelection = registry.organizationSelection;
    manifest.preWriteCheckpoint = registry.preWriteCheckpoint;
    manifest.remoteWrites = registry.remoteWrites;
    manifest.writeAttempts = registry.writeAttempts;
    manifest.status = registry.status;
    manifest.resources = registry.resources;
    manifest.cleanup = registry.cleanup || null;
    persistManifest(manifestPath, manifest);
    persistRegistry(registryPath, registry);
  }

  function trackResource(resource) {
    registry.resources.push({ createdAt: new Date().toISOString(), ...resource });
    persistEvidence();
  }

  const redactedPlan = {
    runId: config.prefix,
    organizationSelection: registry.organizationSelection,
    plannedWrites: registry.plannedWrites,
    ownedResourcePlan: registry.ownedResourcePlan,
    fixture: registry.evidenceFixture,
  };
  persistEvidence();
  logger(t('connector_e2e.resource_plan', JSON.stringify(redactedPlan)));

  function probeRequired(reason, actualCorpId) {
    if (actualCorpId) {
      registry.organizationSelection.actualCorpHash = hashIdentity(actualCorpId);
      sensitiveValues.push(actualCorpId);
    }
    registry.status = 'PLATFORM_PROBE_REQUIRED';
    registry.remoteWrites = 0;
    registry.probe = { code: 'PLATFORM_PROBE_REQUIRED', reason };
    registry.cleanup = cleanupOwnedConnectorResources({
      runId: config.prefix,
      namePrefix: `${config.prefix}__`,
      resources: registry.resources,
      localRoot: path.join(config.registryDir, config.prefix),
      removePath: options.removePath,
    });
    registry.finishedAt = new Date().toISOString();
    persistEvidence();
    logger(t('connector_e2e.probe_required', reason));
    return {
      skipped: false,
      status: 'PLATFORM_PROBE_REQUIRED',
      remoteWrites: 0,
      registryPath,
      manifestPath,
      registry,
    };
  }

  trackResource({
    type: 'temporary-local-artifact',
    runId: config.prefix,
    owned: true,
    name: `${config.prefix}__OperationsTemp`,
    exactId: operationArtifact.temporaryPath,
    path: operationArtifact.temporaryPath,
  });

  if (!config.ready) {
    return probeRequired(config.missing.join(', '));
  }

  const commandEnv = { ...env, OPENYIDA_AUTH_CORP_ID: config.corpId };
  delete commandEnv.OPENYIDA_AUTH_PROFILE;
  delete commandEnv.OPENYIDA_AUTH_USER_ID;
  function step(name, args) {
    const result = executeCli(args, commandEnv);
    registry.commands.push({ name, args: redactRecordedArgs(args), completedAt: new Date().toISOString() });
    persistEvidence();
    return result;
  }

  function beginRemoteWrite(stage, candidate) {
    if (!registry.preWriteCheckpoint.ready || !fs.existsSync(registryPath) || !fs.existsSync(manifestPath)) {
      throw new Error(t('connector_e2e.prewrite_evidence_missing'));
    }
    const attempt = {
      stage,
      status: 'attempted',
      attemptedAt: new Date().toISOString(),
      candidate: { ...candidate, owned: false },
    };
    registry.writeAttempts.push(attempt);
    registry.remoteWrites += 1;
    persistEvidence();
    return attempt;
  }

  function completeRemoteWrite(attempt, exactId) {
    attempt.status = 'completed';
    attempt.completedAt = new Date().toISOString();
    attempt.exactId = String(exactId);
    persistEvidence();
  }

  function markRemoteWriteUnknown(attempt) {
    if (!attempt || attempt.status === 'completed' || attempt.status === 'outcome_unknown') {return;}
    attempt.status = 'outcome_unknown';
    attempt.outcomeRecordedAt = new Date().toISOString();
    registry.resources.push({
      ...attempt.candidate,
      runId: config.prefix,
      owned: false,
      outcome: 'outcome_unknown',
      stage: attempt.stage,
      recordedAt: attempt.outcomeRecordedAt,
    });
    persistEvidence();
  }

  const runtimeAuth = {
    username: 'openyida-e2e-user',
    password: `synthetic-${config.prefix}`,
  };

  try {
    const authResult = requireResult('step_login_check', step('login', [
      'login', '--check-only', '--json', '--corp-id', config.corpId,
    ]));
    if (authResult.ok !== true || authResult.status !== 'ok' ||
        authResult.corp_id !== config.corpId || !authResult.auth_profile) {
      return probeRequired(t('connector_e2e.auth_selection_unverified'), authResult.corp_id);
    }
    registry.organizationSelection.verified = true;
    registry.organizationSelection.profileHash = hashIdentity(authResult.auth_profile);
    registry.organizationSelection.authSource = authResult.auth_source || null;
    commandEnv.OPENYIDA_AUTH_PROFILE = authResult.auth_profile;
    registry.preWriteCheckpoint = {
      ready: true,
      remoteWrites: 0,
      fixtureSha256: operationArtifact.sha256,
      organizationVerified: true,
    };
    persistEvidence();

    const connectorAttempt = beginRemoteWrite('connector-create', {
      type: 'connector-candidate',
      name: config.connectorName,
    });
    let created;
    try {
      created = requireResult('step_connector_create', step('connector-create', [
        'connector', 'create', config.connectorName, config.echoBaseUrl,
        '--auth', '基本身份验证', '--username', runtimeAuth.username, '--password', runtimeAuth.password,
        '--operations', operationArtifact.temporaryPath, '--json',
      ]));
      if (!created.connectorId || !created.connectorName || created.readbackVerified !== true) {
        throw new Error(t('connector_e2e.connector_identity_unverified'));
      }
      completeRemoteWrite(connectorAttempt, created.connectorId);
    } catch (error) {
      markRemoteWriteUnknown(connectorAttempt);
      throw error;
    }
    trackResource({
      type: 'connector', runId: config.prefix, owned: true, name: config.connectorName,
      exactId: String(created.connectorId), connectorName: created.connectorName,
    });

    const connectionAttempt = beginRemoteWrite('connection-create', {
      type: 'connection-candidate',
      name: config.connectionName,
      connectorId: String(created.connectorId),
    });
    let connection;
    try {
      connection = requireResult('step_connection_create', step('connector-create-connection', [
        'connector', 'create-connection', String(created.connectorId), config.connectionName,
        '--username', runtimeAuth.username, '--password', runtimeAuth.password, '--json',
      ]));
      if (!connection.connectionId || connection.readbackVerified !== true) {
        throw new Error(t('connector_e2e.connection_identity_unverified'));
      }
      completeRemoteWrite(connectionAttempt, connection.connectionId);
    } catch (error) {
      markRemoteWriteUnknown(connectionAttempt);
      throw error;
    }
    trackResource({
      type: 'connection', runId: config.prefix, owned: true, name: config.connectionName,
      exactId: String(connection.connectionId), connectorName: created.connectorName,
    });

    const before = requireResult('step_action_readback_before', step('connector-list-actions-before', [
      'connector', 'list-actions', String(created.connectorId), '--json',
    ])).operations;
    if (!Array.isArray(before) || before.length !== 1 || !isDeepStrictEqual(before[0], operation)) {
      throw new Error(t('connector_e2e.action_readback_mismatch'));
    }
    const markerBody = JSON.stringify({ runId: config.prefix, owned: true });
    const tested = requireResult('step_connector_test', step('connector-test', [
      'connector', 'test', '--connector-id', String(created.connectorId), '--action', operation.operationId,
      '--account-id', String(connection.connectionId), '--path-json', '{}',
      '--query-json', JSON.stringify({ runId: config.prefix }), '--header-json', '{}',
      '--body-json', markerBody, '--json',
    ]));
    if (!validateControlledFixtureResponse(tested, config)) {
      throw new Error(t('connector_e2e.test_contract_unverified'));
    }
    const after = requireResult('step_action_readback_after', step('connector-list-actions-after', [
      'connector', 'list-actions', String(created.connectorId), '--json',
    ])).operations;
    if (!isDeepStrictEqual(after, before)) {
      throw new Error(t('connector_e2e.action_mutated'));
    }

    registry.cleanup = cleanupOwnedConnectorResources({
      runId: config.prefix,
      namePrefix: `${config.prefix}__`,
      resources: registry.resources,
      localRoot: path.join(config.registryDir, config.prefix),
      removePath: options.removePath,
    });
    registry.status = registry.cleanup.status;
    registry.finishedAt = new Date().toISOString();
    persistEvidence();
    return { skipped: false, status: registry.status, remoteWrites: registry.remoteWrites, registryPath, manifestPath, registry };
  } catch (error) {
    try {
      registry.cleanup = cleanupOwnedConnectorResources({
        runId: config.prefix,
        namePrefix: `${config.prefix}__`,
        resources: registry.resources,
        localRoot: path.join(config.registryDir, config.prefix),
        removePath: options.removePath,
      });
    } catch (cleanupError) {
      registry.cleanup = { status: 'cleanup_failed', error: sanitizeMessage(cleanupError.message, sensitiveValues) };
    }
    registry.status = 'failed';
    registry.finishedAt = new Date().toISOString();
    registry.error = sanitizeMessage(error.message, sensitiveValues);
    persistEvidence();
    const sanitizedError = new Error(sanitizeMessage(error.message, sensitiveValues));
    sanitizedError.code = error.code;
    throw sanitizedError;
  }
}

if (require.main === module) {
  run().then(result => {
    if (result.status === 'PLATFORM_PROBE_REQUIRED') {
      process.exitCode = 2;
    }
  }).catch(error => {
    console.error(redactCorpIdentifiers(redactString(error.message)));
    process.exitCode = 1;
  });
}

module.exports = {
  buildEchoOperation,
  cleanupOwnedConnectorResources,
  getConfig,
  hashIdentity,
  isControlledFixtureUrl,
  parseCliJsonStdout,
  run,
  runCli,
  validateControlledFixtureResponse,
  writeOperations,
};
