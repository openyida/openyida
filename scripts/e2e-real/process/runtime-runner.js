#!/usr/bin/env node

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { addResource, createRegistry, writeRegistry } = require('../runner');
const { cleanupOwnedResources } = require('../cleanup');
const { compileProcessDefinition } = require('../../../lib/process/services/process-compiler');
const {
  normalizeReadback,
  normalizeViewReadback,
  verifyContract,
  verifyViewContract,
} = require('../../eval/process-contract');
const { generateAllScenarios } = require('../../eval/process-contract/scenario-generator');
const {
  createDefaultApiAdapter: createProcessReadbackAdapter,
  parseSingleJsonObject,
} = require('./runner');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const BIN = path.join(ROOT, 'bin', 'yida.js');
const DEFAULT_REGISTRY_DIR = path.join(ROOT, 'project', '.cache', 'e2e-real');
const DEFAULT_RUNTIME_DEFINITION_FILE = path.join(
  __dirname,
  'fixtures',
  'runtime-serial-two-identity.definition.json'
);
const APPROVER_B_PLACEHOLDER = '__RUNTIME_APPROVER_B_USER_ID__';
const OPERATION_ACTION_PATHS = [
  'outResult', 'approvedResult', 'action', 'operationType', 'result',
];
const OPERATION_ACTION_CANONICAL = new Map([
  ['AGREE', 'AGREE'],
  ['同意', 'AGREE'],
]);
const REQUIRED_API_METHODS = [
  'publishDefinition', 'readProcess', 'startInstance', 'queryTodoTasks',
  'approveTask', 'getInstance', 'getOperationRecords',
];

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16);
}

function sha256(value) {
  const input = Buffer.isBuffer(value) ? value : String(value || '');
  return crypto.createHash('sha256').update(input).digest('hex');
}

function createRunId(date = new Date(), randomBytes = crypto.randomBytes) {
  const stamp = date.toISOString().replace(/[-:TZ.]/g, '').slice(0, 17);
  return `OY_PROC_RUNTIME_${stamp}_${randomBytes(3).toString('hex')}`;
}

function parseObject(value, label) {
  if (!value) {return {};}
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {throw new Error('must be an object');}
    return parsed;
  } catch (error) {
    fail('PROCESS_RUNTIME_CONFIG_INVALID', `${label}: ${error.message}`);
  }
}

function positive(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getConfig(env = process.env, date = new Date()) {
  const runId = createRunId(date);
  const config = {
    runId,
    namePrefix: `${runId}__`,
    registryDir: env.OPENYIDA_E2E_REGISTRY_DIR || DEFAULT_REGISTRY_DIR,
    sourceRunId: env.OPENYIDA_E2E_PROCESS_SOURCE_RUN_ID || '',
    sourceRegistryPath: env.OPENYIDA_E2E_PROCESS_SOURCE_REGISTRY || '',
    definitionFile: env.OPENYIDA_E2E_PROCESS_RUNTIME_DEFINITION || DEFAULT_RUNTIME_DEFINITION_FILE,
    scenarioId: env.OPENYIDA_E2E_PROCESS_SCENARIO || 'serial-approval',
    profileA: env.OPENYIDA_E2E_RUNTIME_PROFILE_A || '',
    profileB: env.OPENYIDA_E2E_RUNTIME_PROFILE_B || '',
    corpId: env.OPENYIDA_E2E_CORP_ID || '',
    approverBUserId: env.OPENYIDA_E2E_RUNTIME_APPROVER_B_USER_ID || '',
    instanceData: parseObject(env.OPENYIDA_E2E_RUNTIME_DATA_JSON, 'OPENYIDA_E2E_RUNTIME_DATA_JSON'),
    firstNodeName: env.OPENYIDA_E2E_RUNTIME_FIRST_NODE || '直属主管审批',
    secondNodeName: env.OPENYIDA_E2E_RUNTIME_SECOND_NODE || '人事审批',
    pollAttempts: positive(env.OPENYIDA_E2E_RUNTIME_POLL_ATTEMPTS, 6),
    pollDelayMs: positive(env.OPENYIDA_E2E_RUNTIME_POLL_DELAY_MS, 1000),
    baseUrl: env.OPENYIDA_E2E_BASE_URL || 'https://www.aliwork.com',
  };
  const required = {
    'OPENYIDA_E2E=1': env.OPENYIDA_E2E === '1',
    'OPENYIDA_E2E_PROCESS_RUNTIME=1': env.OPENYIDA_E2E_PROCESS_RUNTIME === '1',
    OPENYIDA_E2E_PROCESS_SOURCE_RUN_ID: config.sourceRunId,
    OPENYIDA_E2E_RUNTIME_PROFILE_A: config.profileA,
    OPENYIDA_E2E_RUNTIME_PROFILE_B: config.profileB,
    OPENYIDA_E2E_CORP_ID: config.corpId,
    OPENYIDA_E2E_RUNTIME_APPROVER_B_USER_ID: config.approverBUserId,
  };
  config.missing = Object.keys(required).filter(function (key) {return !required[key];});
  config.enabled = config.missing.length === 0;
  return config;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return filePath;
}

function createDefaultCliAdapter() {
  return {
    run: function run(args, env = process.env) {
      return spawnSync(process.execPath, [BIN, ...args], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...env, OPENYIDA_LANG: 'zh', CI: '1', NO_COLOR: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 120000,
      });
    },
  };
}

function commandJson(cliAdapter, args, env) {
  const result = cliAdapter.run(args, env);
  if (!result || result.status !== 0) {
    fail('PROCESS_RUNTIME_CLI_FAILED', `OpenYida command failed (${args[0]} ${args[1] || ''})`);
  }
  return parseSingleJsonObject(result.stdout || '');
}

function createDefaultIdentityAdapter(cliAdapter, env) {
  return {
    activate: async function activate(input) {
      return commandJson(cliAdapter, ['auth', 'profile', 'switch', input.profileAlias], env);
    },
    check: async function check() {
      const result = commandJson(cliAdapter, ['login', '--check-only', '--json'], env);
      return {
        ok: result.ok === true,
        authProfile: result.auth_profile,
        corpId: result.corp_id,
        userId: result.user_id,
      };
    },
  };
}

function createDefaultApiAdapter(cliAdapter, env, processReadbackAdapter) {
  const json = function json(args) {return commandJson(cliAdapter, args, env);};
  const readback = processReadbackAdapter || createProcessReadbackAdapter();
  return {
    publishDefinition: async function publishDefinition(input) {
      return json(['configure-process', input.appType, input.formUuid, input.definitionFile, input.processCode]);
    },
    readProcess: async function readProcess(input) {return readback.readback(input);},
    startInstance: async function startInstance(input) {
      return json([
        'data', 'create', 'process', input.appType, input.formUuid,
        '--process-code', input.processCode, '--data-json', JSON.stringify(input.data || {}),
      ]);
    },
    queryTodoTasks: async function queryTodoTasks(input) {
      return json([
        'data', 'query', 'tasks', input.appType, '--type', 'todo', '--size', '100',
        '--process-codes', JSON.stringify([input.processCode]), '--instance-status', 'RUNNING',
      ]);
    },
    approveTask: async function approveTask(input) {
      return json([
        'data', 'execute', 'task', input.appType, '--task-id', input.taskId,
        '--process-inst-id', input.processInstanceId, '--out-result', 'AGREE',
        '--remark', `OpenYida runtime E2E actor ${input.actor}`,
      ]);
    },
    getInstance: async function getInstance(input) {
      return json(['data', 'get', 'process', input.appType, '--process-inst-id', input.processInstanceId]);
    },
    getOperationRecords: async function getOperationRecords(input) {
      return json([
        'data', 'query', 'operation-records', input.appType,
        '--process-inst-id', input.processInstanceId,
      ]);
    },
  };
}

function resolveOwnedSourceTarget(config) {
  const registryPath = config.sourceRegistryPath
    || path.join(config.registryDir || DEFAULT_REGISTRY_DIR, `${config.sourceRunId}.json`);
  if (!fs.existsSync(registryPath)) {fail('PROCESS_RUNTIME_SOURCE_REGISTRY_NOT_FOUND', 'source registry not found');}
  const registry = readJson(registryPath);
  if (registry.runId !== config.sourceRunId) {fail('PROCESS_RUNTIME_SOURCE_RUN_MISMATCH', 'source run mismatch');}
  const owned = function owned(type) {
    return (registry.resources || []).slice().reverse().find(function (resource) {
      return resource.runId === config.sourceRunId && resource.owned === true && resource.type === type;
    });
  };
  const app = owned('app');
  const form = owned('form');
  const processResource = owned('process');
  if (!app || !form || !processResource) {
    fail('PROCESS_RUNTIME_SOURCE_NOT_OWNED', 'owned source app, form, or process is missing');
  }
  const target = {
    appType: app.appType || app.exactId,
    formUuid: form.formUuid || form.exactId,
    processCode: processResource.processCode || processResource.exactId,
    processId: processResource.processId,
    processVersion: processResource.processVersion,
  };
  if (Object.values(target).some(function (value) {return value === null || value === undefined || value === '';})) {
    fail('PROCESS_RUNTIME_SOURCE_INCOMPLETE', 'owned source target is incomplete');
  }
  if ((form.appType && form.appType !== target.appType)
    || (processResource.appType && processResource.appType !== target.appType)
    || (processResource.formUuid && processResource.formUuid !== target.formUuid)) {
    fail('PROCESS_RUNTIME_SOURCE_SCOPE_MISMATCH', 'owned source resources disagree');
  }
  return target;
}

function loadDefinition(filePath, approverBUserId) {
  const source = fs.readFileSync(filePath, 'utf8');
  if (!source.includes(APPROVER_B_PLACEHOLDER)) {
    fail('PROCESS_RUNTIME_DEFINITION_PLACEHOLDER_MISSING', 'B approver placeholder is missing');
  }
  return JSON.parse(source.split(APPROVER_B_PLACEHOLDER).join(approverBUserId));
}

function summarizeContract(result) {
  return {
    verificationLevel: 'CONTRACT_VERIFIED',
    valid: result.valid === true,
    errors: result.errors || [],
    artifactHash: result.artifactHash || null,
    contractHash: result.contractHash || null,
  };
}

function summarizeView(result) {
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

function content(payload) {
  if (payload && payload.success === false) {fail('PROCESS_RUNTIME_API_FAILED', 'runtime API failed');}
  return payload && payload.content !== undefined ? payload.content : payload;
}

function extractResultList(payload) {
  const value = content(payload);
  if (Array.isArray(value)) {return value;}
  if (!value || typeof value !== 'object') {return [];}
  return ['data', 'items', 'list', 'records', 'result'].reduce(function (found, key) {
    return found || (Array.isArray(value[key]) ? value[key] : null);
  }, null) || [];
}

function pick(object, paths) {
  for (const item of paths) {
    const value = item.split('.').reduce(function (current, key) {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, object);
    if (value !== undefined && value !== null && value !== '') {return String(value);}
  }
  return null;
}

function pickWithPath(object, paths) {
  for (const item of paths) {
    const value = item.split('.').reduce(function (current, key) {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, object);
    if (value !== undefined && value !== null && value !== '') {
      return { path: item, value: String(value) };
    }
  }
  return { path: null, value: null };
}

function taskShape(task) {
  return {
    taskId: pick(task, ['taskId', 'id', 'taskUuid']),
    instanceId: pick(task, ['processInstanceId', 'processInstId', 'procInstId', 'instanceId']),
  };
}

function requireScopedTask(payload, expected) {
  const tasks = extractResultList(payload).map(taskShape);
  if (tasks.some(function (task) {return !task.taskId || !task.instanceId;})) {
    fail(
      'PROCESS_RUNTIME_CAPABILITY_TASK_SCOPE_BLOCKED',
      'identity-bound todo does not expose taskId and processInstanceId'
    );
  }
  const matches = tasks.filter(function (task) {return task.instanceId === expected.instanceId;});
  if (!matches.length) {fail('PROCESS_RUNTIME_TASK_NOT_FOUND', `task for actor ${expected.actor} not found`);}
  if (matches.length !== 1) {fail('PROCESS_RUNTIME_TASK_AMBIGUOUS', 'multiple exact-instance tasks found');}
  return matches[0];
}

function requireTaskClosed(payload, taskId) {
  if (extractResultList(payload).map(taskShape).some(function (task) {return task.taskId === taskId;})) {
    fail('PROCESS_RUNTIME_TASK_STILL_OPEN', 'approved task remains open');
  }
}

function instanceShape(payload) {
  const value = content(payload) || {};
  const status = String(pick(value, ['instanceStatus', 'status']) || '').toUpperCase();
  return {
    instanceId: pick(value, ['processInstanceId', 'processInstId', 'id']),
    processCode: pick(value, ['processCode']),
    formUuid: pick(value, ['formUuid']),
    status: ['COMPLETE', 'FINISHED', 'SUCCESS'].includes(status) ? 'COMPLETED' : status,
  };
}

function operationAction(record) {
  const evidence = OPERATION_ACTION_PATHS.filter(function (key) {
    return Object.prototype.hasOwnProperty.call(record, key)
      && record[key] !== undefined && record[key] !== null;
  }).map(function (key) {
    const rawAction = String(record[key]);
    return {
      source: key,
      rawAction,
      canonicalAction: OPERATION_ACTION_CANONICAL.get(rawAction) || null,
    };
  });
  if (!evidence.length) {
    return { source: null, rawAction: null, canonicalAction: null };
  }
  const allowed = evidence.every(function (item) {return item.canonicalAction === 'AGREE';});
  return {
    source: evidence[0].source,
    rawAction: evidence[0].rawAction,
    canonicalAction: allowed ? 'AGREE' : null,
  };
}

function operationShape(record) {
  const actionEvidence = operationAction(record);
  const sequenceEvidence = pickWithPath(record, [
    'sequence', 'sequenceNo', 'operateSequence', 'operationSequence',
  ]);
  const timeEvidence = pickWithPath(record, [
    'operateTime', 'gmtCreate', 'createTime', 'operationTime',
  ]);
  return {
    taskId: pick(record, ['taskId', 'taskUuid']),
    instanceId: pick(record, ['processInstanceId', 'processInstId', 'procInstId']),
    action: actionEvidence.canonicalAction,
    actionSource: actionEvidence.source,
    rawAction: actionEvidence.rawAction,
    order: {
      sequence: normalizeSequence(sequenceEvidence.value),
      sequenceSource: sequenceEvidence.path,
      time: normalizeTime(timeEvidence.value),
      timeSource: timeEvidence.path,
    },
  };
}

function normalizeSequence(value) {
  if (value === null) {return null;}
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTime(value) {
  if (value === null) {return null;}
  const numeric = /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : Number.NaN;
  if (Number.isFinite(numeric)) {return numeric;}
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function verifyOperationSequence(payload, expected, provenance) {
  const viewApprovalSequence = provenance && provenance.viewApprovalSequence;
  if (!Array.isArray(viewApprovalSequence)
    || viewApprovalSequence.length !== expected.length
    || expected.some(function (step, index) {
      return !viewApprovalSequence[index]
        || viewApprovalSequence[index].nodeName !== step.nodeName;
    })) {
    fail(
      'PROCESS_RUNTIME_TASK_VIEW_SEQUENCE_MISMATCH',
      'runtime task sequence does not match verified platform view approval order'
    );
  }
  if (new Set(expected.map(function (step) {return step.taskId;})).size !== expected.length) {
    fail('PROCESS_RUNTIME_CAPABILITY_OPERATION_SCOPE_BLOCKED', 'runtime task evidence is ambiguous');
  }

  const records = extractResultList(payload).map(operationShape);
  const matched = expected.map(function (step) {
    const candidates = records.filter(function (record) {return record.taskId === step.taskId;});
    if (!candidates.length) {
      fail('PROCESS_RUNTIME_CAPABILITY_OPERATION_SCOPE_BLOCKED', `operation for actor ${step.actor} missing`);
    }
    if (candidates.length !== 1) {
      fail('PROCESS_RUNTIME_CAPABILITY_OPERATION_SCOPE_BLOCKED', 'operation evidence is ambiguous');
    }
    const record = candidates[0];
    if (!record.instanceId || record.rawAction === null) {
      fail('PROCESS_RUNTIME_CAPABILITY_OPERATION_SCOPE_BLOCKED', 'operation evidence is incomplete');
    }
    if (record.instanceId !== step.instanceId || record.action !== 'AGREE') {
      fail('PROCESS_RUNTIME_OPERATION_MISMATCH', 'operation instance/action mismatch');
    }
    if (!step.actorEvidence || step.actorEvidence.identityBoundTodo !== true
      || step.actorEvidence.identityGatedApprove !== true) {
      fail(
        'PROCESS_RUNTIME_CAPABILITY_ACTOR_PROVENANCE_BLOCKED',
        'actor provenance is incomplete'
      );
    }
    return {
      order: record.order,
      actionSource: record.actionSource,
      rawAction: record.rawAction,
      actor: step.actor,
      nodeName: step.nodeName,
      action: 'AGREE',
    };
  });

  const orderType = matched.every(function (item) {return item.order.sequence !== null;})
    ? 'sequence'
    : (matched.every(function (item) {return item.order.time !== null;}) ? 'time' : null);
  if (!orderType || new Set(matched.map(function (item) {
    return item.order[orderType];
  })).size !== matched.length) {
    fail(
      'PROCESS_RUNTIME_CAPABILITY_OPERATION_ORDER_BLOCKED',
      'operation records lack distinct comparable sequence/time evidence'
    );
  }
  const ordered = matched.slice().sort(function (left, right) {
    return left.order[orderType] - right.order[orderType];
  });
  if (ordered.some(function (item, index) {return item.actor !== expected[index].actor;})) {
    fail('PROCESS_RUNTIME_OPERATION_ORDER_MISMATCH', 'operation order is not B then A');
  }
  return ordered.map(function (item) {
    return {
      actor: item.actor,
      nodeName: item.nodeName,
      action: item.action,
      rawAction: item.rawAction,
      evidenceSources: {
        operation: [
          'operation-record.taskId',
          'operation-record.processInstanceId',
          `operation-record.${item.actionSource}`,
          `operation-record.${item.order[`${orderType}Source`]}`,
        ],
        actor: ['identity-bound-todo', 'identity-gated-approve'],
        node: ['platform-view.node-component-name', 'platform-view.designer-tree-order'],
      },
    };
  });
}

function viewNodeName(node) {
  const name = node && node.props && node.props.name;
  if (typeof name === 'string' && name) {return name;}
  if (name && typeof name === 'object') {
    return name.zh_CN || name.en_US || Object.values(name).find(Boolean) || null;
  }
  return null;
}

function requireVerifiedViewApprovalSequence(canonicalView, verification) {
  const assertions = new Set((verification && verification.verifiedAssertions) || []);
  if (!verification || verification.valid !== true
    || !assertions.has('view.node-component-name')
    || !assertions.has('view.designer-tree-order')) {
    fail(
      'PROCESS_RUNTIME_CAPABILITY_VIEW_PROVENANCE_BLOCKED',
      'platform view does not verify approval names and designer-tree order'
    );
  }
  const children = canonicalView && canonicalView.schema && canonicalView.schema.children;
  if (!Array.isArray(children)) {
    fail('PROCESS_RUNTIME_CAPABILITY_VIEW_PROVENANCE_BLOCKED', 'platform view has no serial tree');
  }
  const approvals = children.filter(function (node) {
    return node && ['ApprovalNode', 'MultiApprovalNode'].includes(node.componentName);
  }).map(function (node) {
    return { nodeName: viewNodeName(node), componentName: node.componentName };
  });
  if (!approvals.length || approvals.some(function (node) {return !node.nodeName;})) {
    fail(
      'PROCESS_RUNTIME_CAPABILITY_VIEW_PROVENANCE_BLOCKED',
      'platform view approval provenance is incomplete'
    );
  }
  return approvals;
}

function extractInstanceId(payload) {
  if (payload && payload.success === true
    && typeof payload.result === 'string' && payload.result.trim()) {
    return payload.result;
  }
  if (payload && payload.success === true
    && typeof payload.content === 'string' && payload.content.trim()) {
    return payload.content;
  }
  const value = content(payload) || {};
  const id = pick(value, ['processInstanceId', 'processInstId', 'instanceId', 'id']);
  if (!id) {fail('PROCESS_RUNTIME_INSTANCE_ID_MISSING', 'startInstance returned no processInstanceId');}
  return id;
}

function responseFieldShape(payload, key) {
  if (!payload || typeof payload !== 'object'
    || !Object.prototype.hasOwnProperty.call(payload, key)) {
    return { type: 'absent', objectKeys: [] };
  }
  const value = payload[key];
  const type = value === null ? 'null' : (Array.isArray(value) ? 'array' : typeof value);
  return {
    type,
    objectKeys: type === 'object' ? Object.keys(value).sort() : [],
  };
}

function summarizeStartResponseShape(payload) {
  const isObject = payload && typeof payload === 'object' && !Array.isArray(payload);
  return {
    topLevelKeys: isObject ? Object.keys(payload).sort() : [],
    result: responseFieldShape(payload, 'result'),
    content: responseFieldShape(payload, 'content'),
  };
}

function safeCleanup(cleanup, secondaryErrors = []) {
  const map = function map(item) {
    const resource = item.resource || {};
    return {
      type: resource.type || null,
      alias: resource.name || null,
      fingerprint: fingerprint(resource.exactId || resource.path || resource.name),
      reason: item.reason || null,
    };
  };
  return {
    status: cleanup.status,
    removed: (cleanup.removed || []).map(map),
    residual: (cleanup.residual || []).map(map),
    skipped: (cleanup.skipped || []).map(map),
    secondaryErrors,
  };
}

function redact(message, sensitive) {
  let value = String(message || 'process runtime failed');
  sensitive.filter(Boolean).sort(function (a, b) {return String(b).length - String(a).length;})
    .forEach(function (secret) {
      value = value.split(String(secret)).join(`<redacted:${fingerprint(secret)}>`);
    });
  return value;
}

function wait(ms) {
  return new Promise(function (resolve) {setTimeout(resolve, ms);});
}

async function run(options = {}) {
  const env = options.env || process.env;
  const config = options.config || getConfig(env);
  if (!config.enabled) {return { skipped: true, status: 'skipped', missing: config.missing || [] };}

  const runId = config.runId || createRunId();
  const namePrefix = config.namePrefix || `${runId}__`;
  const registryDir = config.registryDir || DEFAULT_REGISTRY_DIR;
  const workDir = options.workDir || path.join(registryDir, runId);
  const artifactDir = path.join(workDir, 'artifacts');
  const tempDir = path.join(workDir, 'tmp');
  const cli = options.cliAdapter || createDefaultCliAdapter();
  const identity = options.identityAdapter || createDefaultIdentityAdapter(cli, env);
  const api = options.apiAdapter || createDefaultApiAdapter(cli, env, options.processReadbackAdapter);
  const registryInfo = createRegistry({ prefix: runId, registryDir, corpId: null });
  const registry = registryInfo.registry;
  const registryPath = registryInfo.registryPath;
  const state = {
    runId,
    sourceRunId: config.sourceRunId,
    status: 'failed',
    target: null,
    identities: { A: null, B: null },
    trace: [],
    contractVerification: null,
    platformViewVerification: null,
    runtimeVerification: {
      verificationLevel: 'RUNTIME_VERIFIED', valid: false,
      finalStatus: null, operationSequence: [], errors: [],
    },
    profileRestore: null,
    secondaryErrors: [],
    cleanup: null,
    error: null,
  };
  registry.runtimeRuns = [state];
  writeRegistry(registryPath, registry);

  const sensitive = [config.profileA, config.profileB, config.corpId, config.approverBUserId];
  const userIds = {};
  let target;
  let published;
  let instanceId;
  let taskB;
  let taskA;
  let rawReadbackPath = null;
  let canonicalViewPath = null;
  let viewApprovalSequence = null;
  let startResponseShapePath = null;
  let startResponseShape = null;
  let definitionHash = null;
  let primaryError = null;

  function trace(step, actor, action, expected, observed, status = 'passed', error = null) {
    state.trace.push({ step, actor: actor || null, action, expected, observed, status, error });
    writeRegistry(registryPath, registry);
  }

  function command(step, actor, sideEffect, status) {
    registry.commands.push({ name: step, actor, sideEffect, status, recordedAt: new Date().toISOString() });
    writeRegistry(registryPath, registry);
  }

  function resource(type, exactId, name, extra = {}) {
    addResource(registry, registryPath, {
      runId, owned: true, type, exactId, name: `${namePrefix}${name}`, ...extra,
    });
  }

  function actorEvidence(actor, taskId) {
    const taskFingerprint = fingerprint(taskId);
    return {
      identityBoundTodo: state.trace.some(function (item) {
        return item.actor === actor && item.action === 'ASSERT_IDENTITY_BOUND_TODO'
          && item.status === 'passed'
          && item.observed && item.observed.taskFingerprint === taskFingerprint;
      }),
      identityGatedApprove: state.trace.some(function (item) {
        return item.actor === actor && item.action === 'ASSERT_IDENTITY_GATED_APPROVE'
          && item.status === 'passed'
          && item.observed && item.observed.taskFingerprint === taskFingerprint;
      }),
    };
  }

  async function gate(actor, step, sideEffect, action) {
    const profileAlias = actor === 'A' ? config.profileA : config.profileB;
    const activation = await identity.activate({ actor, profileAlias, corpId: config.corpId });
    if (!activation || activation.ok === false) {fail('PROCESS_RUNTIME_IDENTITY_MISMATCH', `switch failed for ${actor}`);}
    const observed = await identity.check({ actor, profileAlias, corpId: config.corpId });
    if (!observed || observed.ok !== true || observed.authProfile !== profileAlias
      || observed.corpId !== config.corpId || !observed.userId
      || (actor === 'B' && observed.userId !== config.approverBUserId)
      || (userIds[actor] && userIds[actor] !== observed.userId)) {
      fail('PROCESS_RUNTIME_IDENTITY_MISMATCH', `identity gate failed for ${actor}`);
    }
    userIds[actor] = observed.userId;
    sensitive.push(observed.userId);
    state.identities[actor] = {
      actor,
      profileFingerprint: fingerprint(profileAlias),
      corpFingerprint: fingerprint(observed.corpId),
      userFingerprint: fingerprint(observed.userId),
    };
    trace(
      'identity-gate', actor, 'CHECK_ONLY',
      { profileFingerprint: fingerprint(profileAlias), corpFingerprint: fingerprint(config.corpId) },
      state.identities[actor]
    );
    command(step, actor, sideEffect, 'started');
    try {
      const result = await action(observed);
      registry.commands[registry.commands.length - 1].status = 'completed';
      writeRegistry(registryPath, registry);
      trace(step, actor, sideEffect, { identityGate: 'passed', exactScope: true }, { result: 'returned' });
      return result;
    } catch (error) {
      registry.commands[registry.commands.length - 1].status = 'failed';
      writeRegistry(registryPath, registry);
      trace(
        step, actor, sideEffect,
        { identityGate: 'passed', exactScope: true }, null, 'failed',
        { code: error.code || 'PROCESS_RUNTIME_FAILED' }
      );
      throw error;
    }
  }

  async function poll(actor, step, probe) {
    const attempts = config.pollAttempts || 1;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await gate(actor, step, 'remote-read', probe);
      } catch (error) {
        const retryable = [
          'PROCESS_RUNTIME_TASK_NOT_FOUND',
          'PROCESS_RUNTIME_TASK_STILL_OPEN',
          'PROCESS_RUNTIME_INSTANCE_NOT_COMPLETED',
        ].includes(error.code);
        if (!retryable || attempt === attempts) {throw error;}
        await (options.delay || wait)(config.pollDelayMs || 0);
      }
    }
    return null;
  }

  async function restoreProfileA() {
    const result = {
      actor: 'A',
      attempted: true,
      activated: false,
      checked: false,
      profileMatched: false,
      corpMatched: false,
      userMatched: false,
      passed: false,
    };
    let observed = null;
    try {
      if (identity && typeof identity.activate === 'function') {
        const activation = await identity.activate({
          actor: 'A', profileAlias: config.profileA, corpId: config.corpId,
        });
        result.activated = Boolean(activation && activation.ok !== false);
      }
    } catch (_error) {
      result.activated = false;
    }
    try {
      if (identity && typeof identity.check === 'function') {
        observed = await identity.check({
          actor: 'A', profileAlias: config.profileA, corpId: config.corpId,
        });
        result.checked = Boolean(observed && observed.ok === true);
      }
    } catch (_error) {
      result.checked = false;
    }
    if (observed) {
      result.profileMatched = observed.authProfile === config.profileA;
      result.corpMatched = observed.corpId === config.corpId;
      result.userMatched = Boolean(observed.userId)
        && (!userIds.A || observed.userId === userIds.A);
    }
    result.passed = result.activated && result.checked && result.profileMatched
      && result.corpMatched && result.userMatched;
    trace(
      'restore-profile-a', 'A', 'RESTORE_PROFILE',
      {
        attempted: true, activated: true, checked: true,
        profileMatched: true, corpMatched: true, userMatched: true,
      },
      {
        attempted: result.attempted, activated: result.activated, checked: result.checked,
        profileMatched: result.profileMatched, corpMatched: result.corpMatched,
        userMatched: result.userMatched,
      },
      result.passed ? 'passed' : 'failed'
    );
    return result;
  }

  try {
    if (!identity || typeof identity.activate !== 'function' || typeof identity.check !== 'function') {
      fail('PROCESS_RUNTIME_CAPABILITY_IDENTITY_BLOCKED', 'identity adapter is incomplete');
    }
    REQUIRED_API_METHODS.forEach(function (method) {
      if (!api || typeof api[method] !== 'function') {
        fail('PROCESS_RUNTIME_CAPABILITY_API_BLOCKED', `runtime API adapter lacks ${method}`);
      }
    });

    target = resolveOwnedSourceTarget(config);
    sensitive.push(target.appType, target.formUuid, target.processCode, target.processId);
    state.target = {
      appFingerprint: fingerprint(target.appType),
      formFingerprint: fingerprint(target.formUuid),
      processFingerprint: fingerprint(target.processCode),
    };

    const scenario = (options.generateScenarios || generateAllScenarios)()
      .find(function (item) {return item.id === config.scenarioId;});
    if (!scenario) {fail('PROCESS_RUNTIME_SCENARIO_NOT_FOUND', 'frozen scenario not found');}
    const definition = loadDefinition(config.definitionFile, config.approverBUserId);
    const compiled = compileProcessDefinition(definition, {
      processCode: target.processCode,
      formUuid: target.formUuid,
      baseUrl: config.baseUrl,
      appType: target.appType,
    });
    const contract = verifyContract(scenario.hiddenContract, normalizeReadback(compiled));
    state.contractVerification = summarizeContract(contract);
    if (!contract.valid) {fail('PROCESS_RUNTIME_PREFLIGHT_CONTRACT_FAILED', 'combined contract preflight failed');}

    fs.mkdirSync(tempDir, { recursive: true });
    const definitionPath = writeJson(path.join(tempDir, `${namePrefix}definition.json`), definition);
    definitionHash = sha256(fs.readFileSync(definitionPath));
    resource('local-artifact', tempDir, 'tmp', { path: tempDir });

    published = await gate('A', 'publish-process-version', 'remote-write', function () {
      return api.publishDefinition({ ...target, definitionFile: definitionPath });
    });
    if (!published || published.success === false || published.processCode !== target.processCode
      || !published.processId || published.processVersion === null || published.processVersion === undefined) {
      fail('PROCESS_RUNTIME_PUBLISH_INVALID', 'published version response is incomplete');
    }
    sensitive.push(published.processId);
    state.target.publishedProcessVersion = published.processVersion;
    resource('process-version', `${published.processId}:${published.processVersion}`, 'ProcessVersion', {
      ...target,
      processId: published.processId,
      processVersion: published.processVersion,
    });

    const readback = await gate('A', 'read-process-view', 'remote-read', function () {
      return api.readProcess({
        ...target,
        processId: published.processId,
        processVersion: published.processVersion,
      });
    });
    rawReadbackPath = writeJson(
      path.join(artifactDir, `${namePrefix}readback-raw.json`),
      readback.rawProcessPayload
    );
    const canonicalView = normalizeViewReadback(readback.rawProcessPayload);
    canonicalViewPath = writeJson(
      path.join(artifactDir, `${namePrefix}readback-view-canonical.json`),
      canonicalView
    );
    const view = verifyViewContract(scenario.hiddenContract, canonicalView);
    state.platformViewVerification = summarizeView(view);
    if (!view.valid) {fail('PROCESS_RUNTIME_PLATFORM_VIEW_FAILED', 'platform view contract failed');}
    viewApprovalSequence = requireVerifiedViewApprovalSequence(
      canonicalView,
      state.platformViewVerification
    );

    const started = await gate('A', 'start-process-instance', 'remote-write', function () {
      return api.startInstance({ ...target, data: config.instanceData || {} });
    });
    startResponseShape = summarizeStartResponseShape(started);
    startResponseShapePath = writeJson(
      path.join(artifactDir, `${namePrefix}start-response-shape.json`),
      startResponseShape
    );
    trace(
      'capture-start-response-shape', 'A', 'CAPTURE_RESPONSE_SHAPE',
      { valueFree: true, persisted: true }, startResponseShape
    );
    instanceId = extractInstanceId(started);
    sensitive.push(instanceId);
    resource('process-instance', instanceId, 'ProcessInstance', {
      ...target,
      processInstanceId: instanceId,
    });
    trace(
      'instance-registered', 'A', 'REGISTER_OWNED_RESOURCE',
      { status: 'created' }, { instanceFingerprint: fingerprint(instanceId) }
    );

    taskB = await poll('B', 'query-first-task', async function () {
      const payload = await api.queryTodoTasks({ ...target, actor: 'B', processInstanceId: instanceId });
      return requireScopedTask(payload, { actor: 'B', instanceId });
    });
    sensitive.push(taskB.taskId);
    resource('process-task', taskB.taskId, 'TaskB', { processInstanceId: instanceId });
    trace(
      'assert-first-task', 'B', 'ASSERT_IDENTITY_BOUND_TODO',
      {
        evidenceSource: 'identity-bound-todo', actor: 'B',
        instanceFingerprint: fingerprint(instanceId),
        requestScope: { app: true, processCode: true },
      },
      {
        evidenceSource: 'identity-bound-todo', actor: 'B',
        instanceFingerprint: fingerprint(instanceId),
        taskFingerprint: fingerprint(taskB.taskId),
        recordEvidence: { taskId: true, processInstanceId: true },
      }
    );

    await gate('B', 'approve-first-task', 'remote-write', async function () {
      const result = await api.approveTask({
        ...target, actor: 'B', taskId: taskB.taskId, processInstanceId: instanceId,
      });
      content(result);
      return result;
    });
    trace(
      'assert-first-approve-scope', 'B', 'ASSERT_IDENTITY_GATED_APPROVE',
      {
        evidenceSource: 'identity-gated-approve', actor: 'B',
        identityGate: true, exactTask: true, exactInstance: true,
      },
      {
        evidenceSource: 'identity-gated-approve', actor: 'B',
        taskFingerprint: fingerprint(taskB.taskId),
        instanceFingerprint: fingerprint(instanceId),
      }
    );
    await poll('B', 'verify-first-task-closed', async function () {
      requireTaskClosed(
        await api.queryTodoTasks({ ...target, actor: 'B', processInstanceId: instanceId }),
        taskB.taskId
      );
      return true;
    });
    trace(
      'assert-first-task-closed', 'B', 'ASSERT_TASK_CLOSED',
      { taskFingerprint: fingerprint(taskB.taskId), open: false }, { open: false }
    );

    taskA = await poll('A', 'query-second-task', async function () {
      const payload = await api.queryTodoTasks({ ...target, actor: 'A', processInstanceId: instanceId });
      return requireScopedTask(payload, { actor: 'A', instanceId });
    });
    sensitive.push(taskA.taskId);
    resource('process-task', taskA.taskId, 'TaskA', { processInstanceId: instanceId });
    trace(
      'assert-second-task', 'A', 'ASSERT_IDENTITY_BOUND_TODO',
      {
        evidenceSource: 'identity-bound-todo', actor: 'A',
        instanceFingerprint: fingerprint(instanceId),
        requestScope: { app: true, processCode: true },
      },
      {
        evidenceSource: 'identity-bound-todo', actor: 'A',
        instanceFingerprint: fingerprint(instanceId),
        taskFingerprint: fingerprint(taskA.taskId),
        recordEvidence: { taskId: true, processInstanceId: true },
      }
    );

    await gate('A', 'approve-second-task', 'remote-write', async function () {
      const result = await api.approveTask({
        ...target, actor: 'A', taskId: taskA.taskId, processInstanceId: instanceId,
      });
      content(result);
      return result;
    });
    trace(
      'assert-second-approve-scope', 'A', 'ASSERT_IDENTITY_GATED_APPROVE',
      {
        evidenceSource: 'identity-gated-approve', actor: 'A',
        identityGate: true, exactTask: true, exactInstance: true,
      },
      {
        evidenceSource: 'identity-gated-approve', actor: 'A',
        taskFingerprint: fingerprint(taskA.taskId),
        instanceFingerprint: fingerprint(instanceId),
      }
    );

    const finalInstance = await poll('A', 'verify-instance-completed', async function () {
      const observed = instanceShape(await api.getInstance({ ...target, processInstanceId: instanceId }));
      ['instanceId', 'processCode', 'formUuid', 'status'].forEach(function (key) {
        if (!observed[key]) {
          fail('PROCESS_RUNTIME_CAPABILITY_INSTANCE_SCOPE_BLOCKED', `instance does not expose ${key}`);
        }
      });
      if (observed.instanceId !== instanceId || observed.processCode !== target.processCode
        || observed.formUuid !== target.formUuid) {
        fail('PROCESS_RUNTIME_INSTANCE_SCOPE_MISMATCH', 'instance scope mismatch');
      }
      if (observed.status !== 'COMPLETED') {
        fail('PROCESS_RUNTIME_INSTANCE_NOT_COMPLETED', 'instance is not completed');
      }
      return observed;
    });

    const operations = await gate('A', 'verify-operation-records', 'remote-read', async function () {
      const payload = await api.getOperationRecords({ ...target, processInstanceId: instanceId });
      return verifyOperationSequence(payload, [
        {
          actor: 'B', taskId: taskB.taskId, instanceId,
          nodeName: config.firstNodeName,
          actorEvidence: actorEvidence('B', taskB.taskId),
        },
        {
          actor: 'A', taskId: taskA.taskId, instanceId,
          nodeName: config.secondNodeName,
          actorEvidence: actorEvidence('A', taskA.taskId),
        },
      ], { viewApprovalSequence });
    });
    trace(
      'assert-instance-completed', 'A', 'ASSERT_INSTANCE_STATUS',
      { status: 'COMPLETED' },
      { status: finalInstance.status, instanceFingerprint: fingerprint(instanceId) }
    );
    trace(
      'assert-operation-sequence', 'A', 'ASSERT_OPERATION_ORDER',
      [
        { actor: 'B', nodeName: config.firstNodeName, action: 'AGREE' },
        { actor: 'A', nodeName: config.secondNodeName, action: 'AGREE' },
      ],
      operations
    );
    state.runtimeVerification = {
      verificationLevel: 'RUNTIME_VERIFIED',
      valid: true,
      finalStatus: finalInstance.status,
      operationSequence: operations,
      errors: [],
    };
    state.status = 'passed';
  } catch (error) {
    primaryError = error;
    state.status = String(error.code || '').includes('CAPABILITY_') ? 'capability_blocked' : 'failed';
    const message = redact(error.message, sensitive);
    state.error = { code: error.code || 'PROCESS_RUNTIME_FAILED', message };
    state.runtimeVerification.errors = [{ code: state.error.code, message }];
  } finally {
    state.profileRestore = await restoreProfileA();
    if (!state.profileRestore.passed) {
      state.secondaryErrors.push({
        code: 'PROCESS_RUNTIME_PROFILE_RESTORE_FAILED', actor: 'A', cleanup: true,
      });
    }
    const cleanup = cleanupOwnedResources({
      registry, runId, namePrefix, localRoot: workDir, removePath: options.removePath,
    });
    if (!state.profileRestore.passed) {cleanup.status = 'cleanup_blocked';}
    registry.cleanupResiduals = cleanup;
    state.cleanup = safeCleanup(cleanup, state.secondaryErrors);
    if (!primaryError && cleanup.status === 'cleanup_blocked') {state.status = 'cleanup_blocked';}

    const manifest = {
      schemaVersion: 1,
      runId,
      sourceRunId: config.sourceRunId,
      status: state.status,
      scenarioId: config.scenarioId,
      target: state.target,
      identities: state.identities,
      definitionHash,
      contractVerification: state.contractVerification,
      platformViewVerification: state.platformViewVerification,
      runtimeVerification: state.runtimeVerification,
      profileRestore: state.profileRestore,
      secondaryErrors: state.secondaryErrors,
      trace: state.trace,
      responseEvidence: {
        startInstance: { shape: startResponseShape, artifactPath: startResponseShapePath },
      },
      artifacts: { rawReadbackPath, canonicalViewPath, startResponseShapePath },
      resources: registry.resources.filter(function (item) {
        return item.runId === runId && item.type !== 'local-artifact';
      }).map(function (item) {
        return {
          type: item.type,
          alias: item.name,
          fingerprint: fingerprint(item.exactId),
          processVersion: item.processVersion === undefined ? null : item.processVersion,
        };
      }),
      cleanup: state.cleanup,
      error: state.error,
    };
    state.manifestPath = writeJson(path.join(workDir, 'acceptance-manifest.json'), manifest);
    registry.status = state.status;
    registry.finishedAt = new Date().toISOString();
    writeRegistry(registryPath, registry);
  }

  const result = {
    skipped: false,
    status: state.status,
    runId,
    sourceRunId: config.sourceRunId,
    contractVerification: state.contractVerification,
    platformViewVerification: state.platformViewVerification,
    runtimeVerification: state.runtimeVerification,
    profileRestore: state.profileRestore,
    cleanup: state.cleanup,
    manifestPath: state.manifestPath,
    registryPath,
  };
  if (primaryError) {
    primaryError.runtimeResult = result;
    throw primaryError;
  }
  return result;
}

if (require.main === module) {
  run().then(function (result) {
    console.log(JSON.stringify(result));
  }).catch(function (error) {
    console.error(error.code || 'PROCESS_RUNTIME_FAILED');
    process.exitCode = 1;
  });
}

module.exports = {
  APPROVER_B_PLACEHOLDER,
  DEFAULT_RUNTIME_DEFINITION_FILE,
  createDefaultApiAdapter,
  createDefaultCliAdapter,
  createDefaultIdentityAdapter,
  createRunId,
  extractResultList,
  fingerprint,
  getConfig,
  requireScopedTask,
  resolveOwnedSourceTarget,
  run,
  verifyOperationSequence,
};
