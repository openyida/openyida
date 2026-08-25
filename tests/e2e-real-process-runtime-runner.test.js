'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  DEFAULT_RUNTIME_DEFINITION_FILE,
  extractResultList,
  run,
  verifyOperationSequence,
} = require('../scripts/e2e-real/process/runtime-runner');
const { generateAllScenarios } = require('../scripts/eval/process-contract/scenario-generator');
const REAL_TODO_FIXTURE = require(
  '../scripts/e2e-real/process/fixtures/runtime-real-todo-envelope.fixture.json'
);
const OFFICIAL_START_FIXTURE = require(
  '../scripts/e2e-real/process/fixtures/runtime-official-start-envelope.fixture.json'
);
const OBSERVED_START_CONTENT_FIXTURE = require(
  '../scripts/e2e-real/process/fixtures/runtime-observed-start-content-envelope.fixture.json'
);
const REAL_OPERATION_FIXTURE = require(
  '../scripts/e2e-real/process/fixtures/runtime-real-operation-envelope.fixture.json'
);

const SECRETS = {
  profileA: 'PROFILE_A_SECRET_VALUE',
  profileB: 'PROFILE_B_SECRET_VALUE',
  corpId: 'CORP_SECRET_VALUE',
  userA: 'USER_A_SECRET_VALUE',
  userB: 'USER_B_SECRET_VALUE',
  appType: 'APP_SECRET_VALUE',
  formUuid: 'FORM_SECRET_VALUE',
  processCode: 'PROCESS_SECRET_VALUE',
  processId: 'PROCESS_VERSION_SECRET_VALUE',
  instanceId: 'INSTANCE_SECRET_VALUE',
  taskB: 'TASK_B_SECRET_VALUE',
  taskA: 'TASK_A_SECRET_VALUE',
};

function serialScenario() {
  return generateAllScenarios().find(function (scenario) {
    return scenario.id === 'serial-approval';
  });
}

function readbackPayload() {
  const viewJson = JSON.parse(JSON.stringify(serialScenario().fixture.viewJson));
  viewJson.bindingForm = SECRETS.formUuid;
  viewJson.formulaRules = [];
  viewJson.globalSetting = {};
  return { success: true, content: JSON.stringify(viewJson) };
}

function task(options) {
  return {
    taskId: options.taskId,
    processInstanceId: SECRETS.instanceId,
    processCode: SECRETS.processCode,
    formUuid: SECRETS.formUuid,
    assigneeId: options.assigneeId,
    activityName: options.nodeName,
    taskStatus: 'RUNNING',
  };
}

function realTodoEnvelope(options) {
  const payload = JSON.parse(JSON.stringify(REAL_TODO_FIXTURE));
  const record = payload.content.data[0];
  record.actualActionerId = options.actorId;
  record.appType = SECRETS.appType;
  record.originatorId = SECRETS.userA;
  record.processInstanceId = SECRETS.instanceId;
  record.taskId = options.taskId;
  return payload;
}

function officialStartEnvelope() {
  const payload = JSON.parse(JSON.stringify(OFFICIAL_START_FIXTURE));
  payload.result = SECRETS.instanceId;
  return payload;
}

function observedStartContentEnvelope() {
  const payload = JSON.parse(JSON.stringify(OBSERVED_START_CONTENT_FIXTURE));
  payload.content = SECRETS.instanceId;
  return payload;
}

function realOperationEnvelope() {
  const payload = JSON.parse(JSON.stringify(REAL_OPERATION_FIXTURE));
  payload.content.forEach(function (record) {
    record.processInstanceId = SECRETS.instanceId;
    if (record.taskId === 'TASK_B_ID_PLACEHOLDER') {record.taskId = SECRETS.taskB;}
    if (record.taskId === 'TASK_A_ID_PLACEHOLDER') {record.taskId = SECRETS.taskA;}
  });
  return payload;
}

function expectedOperationSteps() {
  return [
    {
      actor: 'B', taskId: SECRETS.taskB, instanceId: SECRETS.instanceId,
      nodeName: '直属主管审批',
      actorEvidence: { identityBoundTodo: true, identityGatedApprove: true },
    },
    {
      actor: 'A', taskId: SECRETS.taskA, instanceId: SECRETS.instanceId,
      nodeName: '人事审批',
      actorEvidence: { identityBoundTodo: true, identityGatedApprove: true },
    },
  ];
}

function verifiedViewApprovalSequence() {
  return [
    { nodeName: '直属主管审批', componentName: 'ApprovalNode' },
    { nodeName: '人事审批', componentName: 'ApprovalNode' },
  ];
}

function createHarness(overrides = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-process-runtime-'));
  const runId = overrides.runId || 'OY_PROC_RUNTIME_TEST_abc123';
  const sourceRunId = 'OY_PROC_SOURCE_TEST';
  const sourceRegistryPath = path.join(tmpDir, `${sourceRunId}.json`);
  fs.writeFileSync(sourceRegistryPath, JSON.stringify({
    runId: sourceRunId,
    resources: [
      {
        runId: sourceRunId,
        owned: true,
        type: 'app',
        exactId: SECRETS.appType,
        appType: SECRETS.appType,
        name: 'source-app',
      },
      {
        runId: sourceRunId,
        owned: true,
        type: 'form',
        exactId: SECRETS.formUuid,
        appType: SECRETS.appType,
        formUuid: SECRETS.formUuid,
        name: 'source-form',
      },
      {
        runId: sourceRunId,
        owned: true,
        type: 'process',
        exactId: SECRETS.processCode,
        appType: SECRETS.appType,
        formUuid: SECRETS.formUuid,
        processCode: SECRETS.processCode,
        processId: SECRETS.processId,
        processVersion: 7,
        name: 'source-process',
      },
    ],
  }));

  const events = [];
  const writes = [];
  const approverBUserId = overrides.approverBUserId || SECRETS.userB;
  let bTodoQueryCount = 0;
  const identityAdapter = overrides.identityAdapter || {
    activate: async function activate(input) {
      events.push(`switch:${input.actor}`);
      return { ok: true };
    },
    check: async function check(input) {
      events.push(`check:${input.actor}`);
      return {
        ok: true,
        authProfile: input.profileAlias,
        corpId: SECRETS.corpId,
        userId: input.actor === 'A' ? SECRETS.userA : approverBUserId,
      };
    },
  };

  const apiAdapter = {
    publishDefinition: async function publishDefinition() {
      events.push('api:publish');
      writes.push('publish');
      return {
        success: true,
        processCode: SECRETS.processCode,
        processId: SECRETS.processId,
        processVersion: 8,
      };
    },
    readProcess: async function readProcess() {
      events.push('api:read-process');
      return {
        rawProcessPayload: readbackPayload(),
        processId: SECRETS.processId,
        processVersion: 8,
      };
    },
    startInstance: async function startInstance() {
      events.push('api:start-instance');
      writes.push('submit');
      return overrides.startResponse
        || { success: true, content: { processInstanceId: SECRETS.instanceId } };
    },
    queryTodoTasks: async function queryTodoTasks(input) {
      events.push(`api:query-todo:${input.actor}`);
      if (input.actor === 'B') {
        bTodoQueryCount += 1;
        if (bTodoQueryCount > 1 && !overrides.taskRemainsOpen) {
          return { success: true, content: { data: [] } };
        }
        if (overrides.realTodoB) {
          return realTodoEnvelope({ taskId: SECRETS.taskB, actorId: approverBUserId });
        }
        return {
          success: true,
          content: {
            data: [task({
              taskId: SECRETS.taskB,
              assigneeId: overrides.misassignedTask ? SECRETS.userA : approverBUserId,
              nodeName: overrides.wrongNode ? '错误节点' : '直属主管审批',
            })],
          },
        };
      }
      return {
        success: true,
        content: {
          data: [task({
            taskId: SECRETS.taskA,
            assigneeId: SECRETS.userA,
            nodeName: '人事审批',
          })],
        },
      };
    },
    approveTask: async function approveTask(input) {
      events.push(`api:approve:${input.actor}`);
      writes.push(`approve:${input.actor}`);
      return { success: true };
    },
    getInstance: async function getInstance() {
      events.push('api:get-instance');
      return {
        success: true,
        content: {
          processInstanceId: SECRETS.instanceId,
          processCode: SECRETS.processCode,
          formUuid: SECRETS.formUuid,
          instanceStatus: overrides.incompleteInstance ? 'RUNNING' : 'COMPLETED',
        },
      };
    },
    getOperationRecords: async function getOperationRecords() {
      events.push('api:get-operations');
      return {
        success: true,
        content: [
          {
            taskId: SECRETS.taskA,
            processInstanceId: SECRETS.instanceId,
            activityName: '人事审批',
            operatorId: SECRETS.userA,
            outResult: 'AGREE',
            operateTime: '2026-08-24T10:01:00.000Z',
          },
          {
            taskId: SECRETS.taskB,
            processInstanceId: SECRETS.instanceId,
            activityName: '直属主管审批',
            operatorId: approverBUserId,
            outResult: 'AGREE',
            operateTime: '2026-08-24T10:00:00.000Z',
          },
        ],
      };
    },
    ...overrides.apiAdapter,
  };

  return {
    tmpDir,
    runId,
    sourceRunId,
    sourceRegistryPath,
    events,
    writes,
    apiAdapter,
    identityAdapter,
    runOptions: {
      env: {},
      config: {
        enabled: true,
        missing: [],
        runId,
        namePrefix: `${runId}__`,
        registryDir: tmpDir,
        sourceRunId,
        sourceRegistryPath,
        definitionFile: DEFAULT_RUNTIME_DEFINITION_FILE,
        scenarioId: 'serial-approval',
        profileA: SECRETS.profileA,
        profileB: SECRETS.profileB,
        corpId: SECRETS.corpId,
        approverBUserId,
        instanceData: {},
        firstNodeName: '直属主管审批',
        secondNodeName: '人事审批',
        baseUrl: 'https://www.aliwork.com',
      },
      identityAdapter,
      apiAdapter,
    },
    cleanup: function cleanup() {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}

async function captureFailure(harness) {
  try {
    await run(harness.runOptions);
    throw new Error('expected runtime runner to fail');
  } catch (error) {
    return error;
  }
}

describe('process runtime Slice B runner', () => {
  test('unwraps the two exact query-data list envelopes without recursive descent', () => {
    const item = { id: 'one' };
    expect(extractResultList({ success: true, content: { data: [item] } })).toEqual([item]);
    expect(extractResultList({ success: true, content: [item] })).toEqual([item]);
    expect(extractResultList({ success: true, content: { nested: { data: [item] } } })).toEqual([]);
  });

  test('runs A submit -> B agree -> A agree -> COMPLETED with strictly serial identity gates', async () => {
    const harness = createHarness();
    try {
      const result = await run(harness.runOptions);
      expect(result.status).toBe('cleanup_blocked');
      expect(result.runtimeVerification).toMatchObject({
        verificationLevel: 'RUNTIME_VERIFIED',
        valid: true,
        finalStatus: 'COMPLETED',
        operationSequence: [
          { actor: 'B', nodeName: '直属主管审批', action: 'AGREE' },
          { actor: 'A', nodeName: '人事审批', action: 'AGREE' },
        ],
      });
      expect(result.runtimeVerification.operationSequence.map(function (step) {
        return step.rawAction;
      })).toEqual(['AGREE', 'AGREE']);
      expect(harness.writes).toEqual(['publish', 'submit', 'approve:B', 'approve:A']);

      const apiIndexes = harness.events.reduce(function (indexes, event, index) {
        if (event.startsWith('api:')) {indexes.push(index);}
        return indexes;
      }, []);
      apiIndexes.forEach(function (index) {
        expect(harness.events[index - 2]).toMatch(/^switch:[AB]$/);
        expect(harness.events[index - 1]).toBe(harness.events[index - 2].replace('switch:', 'check:'));
      });

      const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf8'));
      expect(manifest).toMatchObject({
        status: 'cleanup_blocked',
        sourceRunId: harness.sourceRunId,
        contractVerification: { verificationLevel: 'CONTRACT_VERIFIED', valid: true },
        platformViewVerification: { verificationLevel: 'PLATFORM_VIEW_VERIFIED', valid: true },
        runtimeVerification: { verificationLevel: 'RUNTIME_VERIFIED', valid: true },
        profileRestore: {
          actor: 'A', attempted: true, activated: true, checked: true,
          profileMatched: true, corpMatched: true, userMatched: true, passed: true,
        },
        cleanup: { status: 'cleanup_blocked' },
      });
      expect(manifest.target).not.toHaveProperty('sourceProcessVersion');
      const manifestText = JSON.stringify(manifest);
      Object.values(SECRETS).forEach(function (secret) {
        expect(manifestText).not.toContain(String(secret));
      });
      expect(manifestText).toContain('"actor":"A"');
      expect(manifestText).toContain('"actor":"B"');
    } finally {
      harness.cleanup();
    }
  });

  test('accepts the official top-level result startInstance envelope', async () => {
    const harness = createHarness({ startResponse: officialStartEnvelope() });
    try {
      const result = await run(harness.runOptions);
      expect(result.runtimeVerification).toMatchObject({
        verificationLevel: 'RUNTIME_VERIFIED',
        valid: true,
        finalStatus: 'COMPLETED',
      });
    } finally {
      harness.cleanup();
    }
  });

  test('accepts observed top-level string content and persists value-free response shape', async () => {
    const harness = createHarness({ startResponse: observedStartContentEnvelope() });
    try {
      const result = await run(harness.runOptions);
      expect(result.runtimeVerification.valid).toBe(true);
      const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf8'));
      expect(manifest.responseEvidence.startInstance.shape).toEqual({
        topLevelKeys: ['content', 'success'],
        result: { type: 'absent', objectKeys: [] },
        content: { type: 'string', objectKeys: [] },
      });
      expect(manifest.artifacts.startResponseShapePath).toBeTruthy();
      const artifact = JSON.parse(fs.readFileSync(
        manifest.artifacts.startResponseShapePath,
        'utf8'
      ));
      expect(artifact).toEqual(manifest.responseEvidence.startInstance.shape);
      const shapeTrace = manifest.trace.find(function (item) {
        return item.step === 'capture-start-response-shape';
      });
      expect(shapeTrace.observed).toEqual(artifact);
      expect(JSON.stringify({ manifest, artifact, shapeTrace })).not.toContain(SECRETS.instanceId);
    } finally {
      harness.cleanup();
    }
  });

  test.each([
    ['empty', { success: true, result: '' }],
    ['non-string', { success: true, result: 12345 }],
  ])('rejects %s top-level result from startInstance', async (_label, startResponse) => {
    const harness = createHarness({ startResponse });
    try {
      const error = await captureFailure(harness);
      expect(error.code).toBe('PROCESS_RUNTIME_INSTANCE_ID_MISSING');
      expect(harness.writes).toEqual(['publish', 'submit']);
    } finally {
      harness.cleanup();
    }
  });

  test.each([
    ['empty', { success: true, content: '' }],
    ['non-string', { success: true, content: 12345 }],
    ['nested result object', { success: true, content: { result: SECRETS.instanceId } }],
  ])('rejects %s top-level content as a direct instance ID', async (_label, startResponse) => {
    const harness = createHarness({ startResponse });
    try {
      const error = await captureFailure(harness);
      expect(error.code).toBe('PROCESS_RUNTIME_INSTANCE_ID_MISSING');
      expect(harness.writes).toEqual(['publish', 'submit']);
      const manifest = JSON.parse(fs.readFileSync(error.runtimeResult.manifestPath, 'utf8'));
      expect(manifest.artifacts.startResponseShapePath).toBeTruthy();
      expect(fs.existsSync(manifest.artifacts.startResponseShapePath)).toBe(true);
    } finally {
      harness.cleanup();
    }
  });

  test('restores and verifies profile A after a B-stage failure', async () => {
    const harness = createHarness();
    harness.apiAdapter.queryTodoTasks = async function queryTodoTasks(input) {
      harness.events.push(`api:query-todo:${input.actor}`);
      const error = new Error('injected B query failure');
      error.code = 'PROCESS_RUNTIME_TEST_B_FAILURE';
      throw error;
    };
    try {
      const error = await captureFailure(harness);
      expect(error.code).toBe('PROCESS_RUNTIME_TEST_B_FAILURE');
      expect(harness.events.slice(-2)).toEqual(['switch:A', 'check:A']);
      const manifest = JSON.parse(fs.readFileSync(error.runtimeResult.manifestPath, 'utf8'));
      expect(manifest.error.code).toBe('PROCESS_RUNTIME_TEST_B_FAILURE');
      expect(manifest.profileRestore).toEqual({
        actor: 'A', attempted: true, activated: true, checked: true,
        profileMatched: true, corpMatched: true, userMatched: true, passed: true,
      });
      const restoreTrace = manifest.trace.find(function (item) {
        return item.step === 'restore-profile-a';
      });
      expect(restoreTrace.observed).toEqual({
        attempted: true, activated: true, checked: true,
        profileMatched: true, corpMatched: true, userMatched: true,
      });
    } finally {
      harness.cleanup();
    }
  });

  test('preserves the primary B-stage error when restoring A fails', async () => {
    const harness = createHarness();
    const activate = harness.identityAdapter.activate;
    let reachedB = false;
    harness.identityAdapter.activate = async function activateWithRestoreFailure(input) {
      if (input.actor === 'B') {reachedB = true;}
      if (input.actor === 'A' && reachedB) {throw new Error('injected restore failure');}
      return activate(input);
    };
    harness.apiAdapter.queryTodoTasks = async function queryTodoTasks() {
      const error = new Error('primary B query failure');
      error.code = 'PROCESS_RUNTIME_PRIMARY_B_FAILURE';
      throw error;
    };
    try {
      const error = await captureFailure(harness);
      expect(error.code).toBe('PROCESS_RUNTIME_PRIMARY_B_FAILURE');
      const manifest = JSON.parse(fs.readFileSync(error.runtimeResult.manifestPath, 'utf8'));
      expect(manifest.error.code).toBe('PROCESS_RUNTIME_PRIMARY_B_FAILURE');
      expect(manifest.profileRestore).toMatchObject({
        actor: 'A', attempted: true, activated: false, checked: true, passed: false,
      });
      expect(manifest.cleanup).toMatchObject({
        status: 'cleanup_blocked',
        secondaryErrors: [{
          code: 'PROCESS_RUNTIME_PROFILE_RESTORE_FAILED', actor: 'A', cleanup: true,
        }],
      });
    } finally {
      harness.cleanup();
    }
  });

  test('hashes the exact injected runtime definition without persisting either B userId', async () => {
    const alternateApprover = 'ALTERNATE_B_RUNTIME_VALUE';
    const first = createHarness({ runId: 'OY_PROC_RUNTIME_HASH_FIRST' });
    const second = createHarness({
      runId: 'OY_PROC_RUNTIME_HASH_SECOND',
      approverBUserId: alternateApprover,
    });
    try {
      const firstResult = await run(first.runOptions);
      const secondResult = await run(second.runOptions);
      const firstManifest = JSON.parse(fs.readFileSync(firstResult.manifestPath, 'utf8'));
      const secondManifest = JSON.parse(fs.readFileSync(secondResult.manifestPath, 'utf8'));
      expect(firstManifest.definitionHash).toMatch(/^[a-f0-9]{64}$/);
      expect(secondManifest.definitionHash).toMatch(/^[a-f0-9]{64}$/);
      expect(firstManifest.definitionHash).not.toBe(secondManifest.definitionHash);
      expect(JSON.stringify(firstManifest)).not.toContain(SECRETS.userB);
      expect(JSON.stringify(secondManifest)).not.toContain(alternateApprover);
    } finally {
      first.cleanup();
      second.cleanup();
    }
  });

  test('accepts reverse API array order when timestamps prove B before A', async () => {
    const harness = createHarness();
    try {
      const result = await run(harness.runOptions);
      expect(result.runtimeVerification.operationSequence).toMatchObject([
        { actor: 'B', nodeName: '直属主管审批', action: 'AGREE' },
        { actor: 'A', nodeName: '人事审批', action: 'AGREE' },
      ]);
      result.runtimeVerification.operationSequence.forEach(function (step) {
        expect(step.evidenceSources).toEqual({
          operation: ['operation-record.taskId', 'operation-record.processInstanceId',
            'operation-record.outResult', 'operation-record.operateTime'],
          actor: ['identity-bound-todo', 'identity-gated-approve'],
          node: ['platform-view.node-component-name', 'platform-view.designer-tree-order'],
        });
      });
    } finally {
      harness.cleanup();
    }
  });

  test.each([
    ['lack order fields', {}],
    ['have equal timestamps', { operateTime: '2026-08-24T10:00:00.000Z' }],
  ])('blocks when operation records %s', async (_label, orderFields) => {
    const harness = createHarness({
      apiAdapter: {
        getOperationRecords: async function getOperationRecords() {
          return {
            success: true,
            content: [
              {
                taskId: SECRETS.taskB,
                processInstanceId: SECRETS.instanceId,
                activityName: '直属主管审批',
                operatorId: SECRETS.userB,
                outResult: 'AGREE',
                ...orderFields,
              },
              {
                taskId: SECRETS.taskA,
                processInstanceId: SECRETS.instanceId,
                activityName: '人事审批',
                operatorId: SECRETS.userA,
                outResult: 'AGREE',
                ...orderFields,
              },
            ],
          };
        },
      },
    });
    try {
      const error = await captureFailure(harness);
      expect(error.code).toBe('PROCESS_RUNTIME_CAPABILITY_OPERATION_ORDER_BLOCKED');
      expect(error.runtimeResult.status).toBe('capability_blocked');
    } finally {
      harness.cleanup();
    }
  });

  test('identity mismatch fails before every platform write', async () => {
    const harness = createHarness({
      identityAdapter: {
        activate: async function activate(input) {
          harness.events.push(`switch:${input.actor}`);
          return { ok: true };
        },
        check: async function check(input) {
          harness.events.push(`check:${input.actor}`);
          return {
            ok: true,
            authProfile: 'WRONG_PROFILE',
            corpId: SECRETS.corpId,
            userId: SECRETS.userA,
          };
        },
      },
    });
    try {
      const error = await captureFailure(harness);
      expect(error.code).toBe('PROCESS_RUNTIME_IDENTITY_MISMATCH');
      expect(harness.writes).toHaveLength(0);
    } finally {
      harness.cleanup();
    }
  });

  test('accepts the observed identity-bound todo record and records its evidence source', async () => {
    const harness = createHarness({ realTodoB: true });
    try {
      const result = await run(harness.runOptions);
      const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf8'));
      const evidence = manifest.trace.find(function (item) {
        return item.step === 'assert-first-task';
      });
      expect(evidence).toMatchObject({
        actor: 'B',
        expected: {
          evidenceSource: 'identity-bound-todo',
          actor: 'B',
          instanceFingerprint: expect.any(String),
          requestScope: { app: true, processCode: true },
        },
        observed: {
          evidenceSource: 'identity-bound-todo',
          actor: 'B',
          instanceFingerprint: expect.any(String),
          taskFingerprint: expect.any(String),
          recordEvidence: { taskId: true, processInstanceId: true },
        },
      });
      expect(JSON.stringify(evidence)).not.toContain('assigneeId');
      expect(JSON.stringify(evidence)).not.toContain('nodeName');
    } finally {
      harness.cleanup();
    }
  });

  test('a wrong B profile gate cannot turn a todo response into B evidence', async () => {
    const harness = createHarness({ realTodoB: true });
    harness.identityAdapter.check = async function check(input) {
      harness.events.push(`check:${input.actor}`);
      if (input.actor === 'B') {
        return {
          ok: true,
          authProfile: SECRETS.profileA,
          corpId: SECRETS.corpId,
          userId: SECRETS.userA,
        };
      }
      return {
        ok: true,
        authProfile: input.profileAlias,
        corpId: SECRETS.corpId,
        userId: SECRETS.userA,
      };
    };
    try {
      const error = await captureFailure(harness);
      expect(error.code).toBe('PROCESS_RUNTIME_IDENTITY_MISMATCH');
      expect(harness.writes).toEqual(['publish', 'submit']);
      expect(harness.events).not.toContain('api:query-todo:B');
    } finally {
      harness.cleanup();
    }
  });

  test.each([
    ['taskId', { processInstanceId: SECRETS.instanceId }],
    ['processInstanceId', { taskId: SECRETS.taskB }],
  ])('missing %s in an identity-bound todo record is fail-closed', async (_field, record) => {
    const harness = createHarness({
      apiAdapter: {
        queryTodoTasks: async function queryTodoTasks(input) {
          harness.events.push(`api:query-todo:${input.actor}`);
          return { success: true, content: { data: [record] } };
        },
      },
    });
    try {
      const error = await captureFailure(harness);
      expect(error.code).toBe('PROCESS_RUNTIME_CAPABILITY_TASK_SCOPE_BLOCKED');
      expect(harness.writes).toEqual(['publish', 'submit']);
    } finally {
      harness.cleanup();
    }
  });

  test('accepts observed operation keys with actor and node provenance from prior evidence', async () => {
    const harness = createHarness({
      apiAdapter: {
        getOperationRecords: async function getOperationRecords() {
          return realOperationEnvelope();
        },
      },
    });
    try {
      const result = await run(harness.runOptions);
      const expectedSequence = [
        {
          actor: 'B', nodeName: '直属主管审批', action: 'AGREE', rawAction: '同意',
          evidenceSources: {
            operation: ['operation-record.taskId', 'operation-record.processInstanceId',
              'operation-record.action', 'operation-record.operateTime'],
            actor: ['identity-bound-todo', 'identity-gated-approve'],
            node: ['platform-view.node-component-name', 'platform-view.designer-tree-order'],
          },
        },
        {
          actor: 'A', nodeName: '人事审批', action: 'AGREE', rawAction: '同意',
          evidenceSources: {
            operation: ['operation-record.taskId', 'operation-record.processInstanceId',
              'operation-record.action', 'operation-record.operateTime'],
            actor: ['identity-bound-todo', 'identity-gated-approve'],
            node: ['platform-view.node-component-name', 'platform-view.designer-tree-order'],
          },
        },
      ];
      expect(result.runtimeVerification.operationSequence).toEqual(expectedSequence);
      const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf8'));
      expect(manifest.runtimeVerification.operationSequence).toEqual(expectedSequence);
      const operationTrace = manifest.trace.find(function (item) {
        return item.step === 'assert-operation-sequence';
      });
      expect(operationTrace.observed).toEqual(expectedSequence);
      expect(JSON.stringify({ manifest, operationTrace })).not.toContain('operatorId');
      expect(JSON.stringify({ manifest, operationTrace })).not.toContain('nodeNameFromRecord');
    } finally {
      harness.cleanup();
    }
  });

  test.each([
    ['missing taskId', function mutate(records) {delete records[1].taskId;},
      'PROCESS_RUNTIME_CAPABILITY_OPERATION_SCOPE_BLOCKED'],
    ['wrong taskId', function mutate(records) {records[1].taskId = 'WRONG_TASK';},
      'PROCESS_RUNTIME_CAPABILITY_OPERATION_SCOPE_BLOCKED'],
    ['duplicate taskId', function mutate(records) {records[2].taskId = SECRETS.taskB;},
      'PROCESS_RUNTIME_CAPABILITY_OPERATION_SCOPE_BLOCKED'],
    ['wrong instance', function mutate(records) {records[1].processInstanceId = 'WRONG_INSTANCE';},
      'PROCESS_RUNTIME_OPERATION_MISMATCH'],
    ['non-AGREE action', function mutate(records) {records[1].action = 'REJECT';},
      'PROCESS_RUNTIME_OPERATION_MISMATCH'],
    ['missing scope/action/order', function mutate(records) {
      delete records[1].taskId;
      delete records[1].processInstanceId;
      delete records[1].action;
      delete records[1].operateTime;
    }, 'PROCESS_RUNTIME_CAPABILITY_OPERATION_SCOPE_BLOCKED'],
  ])('fails closed for operation evidence with %s', async (_label, mutate, code) => {
    const payload = realOperationEnvelope();
    mutate(payload.content);
    const harness = createHarness({
      apiAdapter: {
        getOperationRecords: async function getOperationRecords() {return payload;},
      },
    });
    try {
      const error = await captureFailure(harness);
      expect(error.code).toBe(code);
      expect(error.runtimeResult.runtimeVerification.valid).toBe(false);
    } finally {
      harness.cleanup();
    }
  });

  test.each([
    ['lowercase agree', 'agree'],
    ['legacy PASS synonym', 'PASS'],
    ['legacy APPROVED synonym', 'APPROVED'],
    ['legacy PASSED synonym', 'PASSED'],
    ['unobserved localized synonym', '通过'],
    ['whitespace-padded localized action', ' 同意 '],
    ['empty action', ''],
  ])('rejects non-whitelisted raw operation action: %s', async (_label, rawAction) => {
    const payload = realOperationEnvelope();
    payload.content[1].action = rawAction;
    const harness = createHarness({
      apiAdapter: {
        getOperationRecords: async function getOperationRecords() {return payload;},
      },
    });
    try {
      const error = await captureFailure(harness);
      expect(error.code).toBe('PROCESS_RUNTIME_OPERATION_MISMATCH');
      expect(error.runtimeResult.runtimeVerification.valid).toBe(false);
    } finally {
      harness.cleanup();
    }
  });

  test('rejects conflicting action fields on one exact operation', async () => {
    const payload = realOperationEnvelope();
    payload.content[1].outResult = 'AGREE';
    payload.content[1].action = 'REJECT';
    const harness = createHarness({
      apiAdapter: {
        getOperationRecords: async function getOperationRecords() {return payload;},
      },
    });
    try {
      const error = await captureFailure(harness);
      expect(error.code).toBe('PROCESS_RUNTIME_OPERATION_MISMATCH');
    } finally {
      harness.cleanup();
    }
  });

  test('does not recursively guess a nested localized operation action', async () => {
    const payload = realOperationEnvelope();
    delete payload.content[1].action;
    payload.content[1].actionExt = { action: '同意' };
    const harness = createHarness({
      apiAdapter: {
        getOperationRecords: async function getOperationRecords() {return payload;},
      },
    });
    try {
      const error = await captureFailure(harness);
      expect(error.code).toBe('PROCESS_RUNTIME_CAPABILITY_OPERATION_SCOPE_BLOCKED');
    } finally {
      harness.cleanup();
    }
  });

  test.each([
    ['approval count', [{ nodeName: '直属主管审批', componentName: 'ApprovalNode' }]],
    ['approval order', [
      { nodeName: '人事审批', componentName: 'ApprovalNode' },
      { nodeName: '直属主管审批', componentName: 'ApprovalNode' },
    ]],
  ])('fails closed when runtime task sequence mismatches platform view %s', (_label, viewSteps) => {
    expect(function () {
      verifyOperationSequence(
        realOperationEnvelope(),
        expectedOperationSteps(),
        { viewApprovalSequence: viewSteps }
      );
    }).toThrow(expect.objectContaining({
      code: 'PROCESS_RUNTIME_TASK_VIEW_SEQUENCE_MISMATCH',
    }));
  });

  test('fails closed when prior actor provenance is incomplete', () => {
    const expected = expectedOperationSteps();
    expected[0].actorEvidence.identityGatedApprove = false;
    expect(function () {
      verifyOperationSequence(
        realOperationEnvelope(),
        expected,
        { viewApprovalSequence: verifiedViewApprovalSequence() }
      );
    }).toThrow(expect.objectContaining({
      code: 'PROCESS_RUNTIME_CAPABILITY_ACTOR_PROVENANCE_BLOCKED',
    }));
  });

  test('multiple tasks for the exact instance remain ambiguous', async () => {
    const harness = createHarness({
      apiAdapter: {
        queryTodoTasks: async function queryTodoTasks(input) {
          harness.events.push(`api:query-todo:${input.actor}`);
          return {
            success: true,
            content: {
              data: [
                { taskId: `${SECRETS.taskB}_1`, processInstanceId: SECRETS.instanceId },
                { taskId: `${SECRETS.taskB}_2`, processInstanceId: SECRETS.instanceId },
              ],
            },
          };
        },
      },
    });
    try {
      const error = await captureFailure(harness);
      expect(error.code).toBe('PROCESS_RUNTIME_TASK_AMBIGUOUS');
      expect(harness.writes).toEqual(['publish', 'submit']);
    } finally {
      harness.cleanup();
    }
  });

  test('does not advance to A when B task remains open after agree', async () => {
    const harness = createHarness({ taskRemainsOpen: true });
    try {
      const error = await captureFailure(harness);
      expect(error.code).toBe('PROCESS_RUNTIME_TASK_STILL_OPEN');
      expect(harness.writes).toEqual(['publish', 'submit', 'approve:B']);
    } finally {
      harness.cleanup();
    }
  });

  test('fails when the final instance is not platform-equivalent COMPLETED', async () => {
    const harness = createHarness({ incompleteInstance: true });
    try {
      const error = await captureFailure(harness);
      expect(error.code).toBe('PROCESS_RUNTIME_INSTANCE_NOT_COMPLETED');
      expect(harness.writes).toEqual(['publish', 'submit', 'approve:B', 'approve:A']);
      const manifest = JSON.parse(fs.readFileSync(error.runtimeResult.manifestPath, 'utf8'));
      expect(manifest.runtimeVerification).toMatchObject({
        verificationLevel: 'RUNTIME_VERIFIED',
        valid: false,
      });
    } finally {
      harness.cleanup();
    }
  });
});
