'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { compileFormDefinition } = require('../lib/app/services/form-compiler');
const { run: runSchemaCommand } = require('../lib/schema/command');
const { normalizeManifest } = require('../lib/schema/normalize-manifest');
const { createDefaultRegistry } = require('../lib/schema/resource-registry');
const { formAdapter } = require('../lib/schema/adapters/form-adapter');
const { processAdapter } = require('../lib/schema/adapters/process-adapter');
const {
  createEmptyState,
  hashStable,
  readState,
  upsertResourceState,
  writeStateAtomic,
} = require('../lib/schema/state-store');

let tempDir;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-schema-process-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function environment() {
  return {
    endpoint: 'https://example.test',
    corpId: 'corp-schema-process',
  };
}

function authRef() {
  return {
    baseUrl: 'https://example.test',
    corpId: 'corp-schema-process',
    csrfToken: 'csrf-runtime-only',
    cookies: [{ name: 'session', value: 'cookie-runtime-only' }],
  };
}

function processManifest(nodeName = 'Manager approval') {
  return {
    kind: 'openyida_app_manifest',
    schemaVersion: 1,
    app: {
      key: 'workflowApp',
      name: 'Workflow app',
    },
    forms: {
      request: {
        title: 'Request',
        mode: 'process',
        fields: {
          requester: {
            type: 'TextField',
            label: 'Requester',
          },
        },
      },
    },
    processes: {
      approval: {
        form: 'request',
        nodes: [{
          key: 'managerApproval',
          type: 'approval',
          name: nodeName,
          approver: 'originator',
        }],
      },
    },
  };
}

function writeManifest(value) {
  const file = path.join(tempDir, 'app.yida.json');
  fs.writeFileSync(file, JSON.stringify(value), 'utf8');
  return file;
}

function statePath() {
  return path.join(tempDir, 'state.v1.json');
}

function collectStdout() {
  let value = '';
  return {
    stream: { write(chunk) { value += chunk; } },
    value() { return value; },
  };
}

function createInitialState(manifestValue) {
  const registry = createDefaultRegistry();
  const normalized = normalizeManifest(manifestValue, { registry });
  const resources = normalized.normalized.resources;
  const app = resources.find(resource => resource.resourceType === 'app');
  const form = resources.find(resource => resource.resourceType === 'form');
  const receiptManaged = { ...form.desired };
  delete receiptManaged.mode;
  const compiled = compileFormDefinition({
    title: form.desired.title,
    fields: form.desired.fields,
  }, {
    appType: 'APP_RUNTIME_VALUE',
    formUuid: 'FORM_RUNTIME_VALUE',
  });
  compiled.schema.gmtModified = 100;
  let state = createEmptyState(environment(), {
    manifestHash: normalized.manifestHash,
    registry,
  });
  state = upsertResourceState(state, {
    resourceType: 'app',
    key: app.key,
    adapterVersion: 1,
    bindings: { appType: 'APP_RUNTIME_VALUE' },
    lastApplied: app.desired,
    lastAppliedHash: hashStable(app.desired),
  }, { registry });
  state = upsertResourceState(state, {
    resourceType: 'form',
    key: form.key,
    adapterVersion: 1,
    bindings: {
      appType: 'APP_RUNTIME_VALUE',
      formUuid: 'FORM_RUNTIME_VALUE',
      fieldBindings: toStateFieldBindings(compiled),
    },
    lastApplied: receiptManaged,
    lastAppliedHash: hashStable(receiptManaged),
  }, { registry });
  writeStateAtomic(statePath(), state, {
    environment: environment(),
    registry,
  });
  return {
    compiled,
    normalized,
    registry,
  };
}

function toStateFieldBindings(compiled) {
  const result = {};
  Object.keys(compiled.fieldBindings).forEach((semanticPath) => {
    result[semanticPath] = {
      fieldId: compiled.fieldBindings[semanticPath],
      componentType: compiled.fieldBindingComponents[semanticPath],
    };
  });
  return result;
}

function createRemoteHarness(initial, options = {}) {
  const calls = [];
  let formMode = 'receipt';
  let processCode = null;
  let formSchema = { success: true, content: initial.compiled.schema };
  let activeProcessDefinition = null;
  let draftProcessDefinition = null;
  let processStage = null;
  let activeProcess = { processId: 'PROCESS_DEFAULT_VALUE', processVersion: 0 };
  let draftProcess = null;
  const historicalProcesses = [];
  let failSaveOnce = options.failSaveOnce === true;
  let processReadError = options.processReadError || null;

  const services = {
    async readApp() {
      calls.push('read:app');
      return { appType: 'APP_RUNTIME_VALUE', appName: 'Workflow app' };
    },
    async readFormSchema() {
      calls.push('read:form');
      return formSchema;
    },
    async readFormMode() {
      calls.push(`read:mode:${formMode}`);
      return formMode === 'process'
        ? { mode: formMode, processCode }
        : { mode: formMode };
    },
    async updateFormResource(_context, input) {
      calls.push('update:form');
      input.prepared.schema.gmtModified = formSchema.content.gmtModified + 1;
      formSchema = { success: true, content: input.prepared.schema };
      return {
        appType: input.appType,
        formUuid: input.formUuid,
        fieldBindings: input.prepared.compiled.fieldBindings,
        fieldBindingComponents: input.prepared.compiled.fieldBindingComponents,
      };
    },
    async convertFormToProcess() {
      calls.push('convert:form');
      formMode = 'process';
      processCode = 'TPROC_RUNTIME_VALUE';
      return { success: true };
    },
    async queryProcessVersions(_auth, _appType, _processCode, _status, pageOptions) {
      calls.push('query:versions');
      expect(pageOptions).toEqual({ pageIndex: 1, pageSize: 10 });
      const state = readState(statePath(), {
        environment: environment(),
        registry: initial.registry,
      });
      expect(state.resources.form.request.bindings.processCode).toBe('TPROC_RUNTIME_VALUE');
      if (activeProcess.processVersion === 0) {
        expect(state.resources.process).toBeUndefined();
      }
      if (options.emptyVersions === true) {
        return {
          success: true,
          content: { data: [], currentPage: 1, totalCount: 0 },
        };
      }
      const data = historicalProcesses.map(identity => ({
        id: identity.processId,
        version: identity.processVersion,
        status: 'INVALID',
        code: processCode,
      }));
      if (draftProcess) {
        data.push({
          id: draftProcess.processId,
          version: draftProcess.processVersion,
          status: 'SAVED',
          code: processCode,
        });
      }
      data.push({
        id: activeProcess.processId,
        version: activeProcess.processVersion,
        status: 'PUBLISHED',
        code: processCode,
      });
      return {
        success: true,
        content: {
          data,
          currentPage: 1,
          totalCount: data.length,
        },
      };
    },
    async newDraftProcess(_auth, _appType, _processCode, formUuid, _baseId, version) {
      calls.push('draft:process');
      draftProcess = {
        processId: `PROCESS_VERSION_${version}`,
        processVersion: version,
      };
      processStage = 'draft_created';
      draftProcessDefinition = {
        bindingForm: formUuid,
        flowConfig: {},
        formulaRules: [],
        globalSetting: {},
        schema: { children: [] },
      };
      return { success: true, content: { processId: draftProcess.processId } };
    },
    async saveProcessById(_auth, _appType, formUuid, _processCode, _processId, _version, _processJson, viewJson) {
      calls.push(failSaveOnce ? 'save:process:fail' : 'save:process');
      if (failSaveOnce) {
        failSaveOnce = false;
        throw new Error('injected save interruption');
      }
      draftProcessDefinition = {
        ...JSON.parse(viewJson),
        bindingForm: formUuid,
      };
      processStage = 'saved';
      return { success: true };
    },
    async publishProcessById() {
      calls.push('publish:process');
      historicalProcesses.push(activeProcess);
      activeProcess = draftProcess;
      activeProcessDefinition = draftProcessDefinition;
      draftProcess = null;
      draftProcessDefinition = null;
      processStage = 'published';
      return { success: true };
    },
    async readProcessDefinition(_context, bindings) {
      calls.push(`read:process:${processStage || 'none'}`);
      if (processReadError) {
        throw processReadError;
      }
      const readsActive = bindings.processId === activeProcess.processId &&
        bindings.processVersion === activeProcess.processVersion;
      const readsDraft = draftProcess &&
        bindings.processId === draftProcess.processId &&
        bindings.processVersion === draftProcess.processVersion;
      const definition = readsActive ? activeProcessDefinition : readsDraft ? draftProcessDefinition : null;
      if (!definition || bindings.processCode !== processCode) {
        const error = new Error('bound process read failed');
        error.code = 'PROCESS_READ_FAILED';
        throw error;
      }
      return { definition: JSON.parse(JSON.stringify(definition)) };
    },
  };

  return {
    calls,
    getProcessDefinition() {
      return activeProcessDefinition;
    },
    publishExternalVersion() {
      historicalProcesses.push(activeProcess);
      activeProcess = {
        processId: 'PROCESS_EXTERNAL_PUBLISHED',
        processVersion: Math.max(
          activeProcess.processVersion,
          ...historicalProcesses.map(identity => identity.processVersion)
        ) + 1,
      };
      processStage = 'external_published';
    },
    setExternalDraft() {
      draftProcess = {
        processId: 'PROCESS_EXTERNAL_DRAFT',
        processVersion: Math.max(
          activeProcess.processVersion,
          ...historicalProcesses.map(identity => identity.processVersion)
        ) + 1,
      };
      draftProcessDefinition = null;
      processStage = 'external_draft';
    },
    setProcessReadError(error) {
      processReadError = error;
    },
    services,
  };
}

async function runCommand(args, harness) {
  const stdout = collectStdout();
  const payload = await runSchemaCommand(args, {
    authRef: authRef(),
    environment: environment(),
    projectRoot: tempDir,
    services: harness.services,
    setExitCode: false,
    stdout: stdout.stream,
  });
  return { payload, stdout: stdout.value() };
}

async function plan(manifestPath, harness) {
  return runCommand([
    'plan', manifestPath,
    '--state', statePath(),
    '--json', '--quiet',
  ], harness);
}

async function apply(manifestPath, planId, harness) {
  return runCommand([
    'apply', manifestPath,
    '--state', statePath(),
    '--plan-id', planId,
    '--json', '--quiet',
  ], harness);
}

describe('schema process adapter plan and apply', () => {
  test('keeps form mode ownership explicit for create and rejects process-to-receipt locally', async () => {
    const manifestValue = processManifest();
    const initial = createInitialState(manifestValue);
    const formResource = initial.normalized.normalized.resources.find(resource => resource.resourceType === 'form');
    const creator = jest.fn(async (_context, input) => ({ input }));
    await formAdapter.create(formResource.desired, {
      resource: formResource,
      services: { createFormResource: creator },
      state: readState(statePath(), {
        environment: environment(),
        registry: initial.registry,
      }),
    });
    expect(creator.mock.calls[0][1].formType).toBe('process');

    const receiptResource = {
      ...formResource,
      desired: { ...formResource.desired, mode: 'receipt' },
    };
    const stateResource = readState(statePath(), {
      environment: environment(),
      registry: initial.registry,
    }).resources.form.request;
    const prepare = jest.fn();
    expect(() => formAdapter.prepareOperation({
      operation: 'update',
      resource: receiptResource,
      stateResource,
      observed: {
        modeObservation: { mode: 'process', processCode: 'TPROC_RUNTIME_VALUE' },
        schemaResult: { success: true, content: initial.compiled.schema },
      },
    }, {
      services: { prepareFormResourceUpdate: prepare },
      state: {
        resources: {
          app: {
            workflowApp: {
              bindings: { appType: 'APP_RUNTIME_VALUE' },
            },
          },
        },
      },
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_APPLY_DESTRUCTIVE_CHANGE_UNSUPPORTED',
    }));
    expect(prepare).not.toHaveBeenCalled();
  });

  test('maps incomplete process checkpoint bindings to reconciliation required before service I/O', async () => {
    const manifestValue = processManifest();
    const initial = createInitialState(manifestValue);
    const processResource = initial.normalized.normalized.resources.find(resource => resource.resourceType === 'process');
    const services = {
      queryProcessVersions: jest.fn(),
      readProcessDefinition: jest.fn(),
      newDraftProcess: jest.fn(),
      saveProcessById: jest.fn(),
      publishProcessById: jest.fn(),
    };

    await expect(processAdapter.prepareOperation({
      operation: 'create',
      resource: processResource,
      recovery: {
        stageCheckpoint: {
          stage: 'saved',
          processCode: 'TPROC_RUNTIME_VALUE',
          processId: 'PROCESS_DRAFT_VALUE',
          processVersion: 1,
          nodeBindings: {},
        },
      },
    }, {
      authRef: authRef(),
      services,
      state: {
        resources: {
          form: {
            request: {
              bindings: {
                appType: 'APP_RUNTIME_VALUE',
                formUuid: 'FORM_RUNTIME_VALUE',
                processCode: 'TPROC_RUNTIME_VALUE',
              },
            },
          },
        },
      },
    })).rejects.toMatchObject({ code: 'SCHEMA_RECONCILIATION_REQUIRED' });
    for (const service of Object.values(services)) {
      expect(service).not.toHaveBeenCalled();
    }
  });

  test('rejects write verification when the published identity no longer matches the operation binding', () => {
    const normalized = normalizeManifest(processManifest());
    const resource = normalized.normalized.resources.find(item => item.resourceType === 'process');

    expect(() => processAdapter.verify({
      managed: resource.desired,
      observedIdentityMatchesBindings: false,
    }, { resource })).toThrow(expect.objectContaining({
      code: 'SCHEMA_APPLY_VERIFY_FAILED',
    }));
  });

  test.each([false, true])(
    'converts the form first, stages the process, checkpoints bindings, and converges (save interruption=%s)',
    async failSaveOnce => {
      const manifestValue = processManifest();
      const manifestPath = writeManifest(manifestValue);
      const initial = createInitialState(manifestValue);
      const harness = createRemoteHarness(initial, { failSaveOnce });

      const reviewed = await plan(manifestPath, harness);
      expect(reviewed.payload.success).toBe(true);
      expect(reviewed.payload.changes).toEqual(expect.arrayContaining([
        expect.objectContaining({
          resourceType: 'form',
          key: 'request',
          operation: 'update',
          reasonCode: 'FORM_MODE_CONVERSION',
        }),
        expect.objectContaining({
          resourceType: 'process',
          key: 'approval',
          operation: 'create',
        }),
      ]));

      harness.calls.length = 0;
      const applied = await apply(manifestPath, reviewed.payload.planId, harness);
      expect(applied.payload).toMatchObject({
        success: true,
        counts: { create: 1, update: 1, noop: 1, stateRepair: 0 },
      });
      expect(harness.calls.indexOf('convert:form')).toBeLessThan(harness.calls.indexOf('query:versions'));
      expect(harness.calls.indexOf('query:versions')).toBeLessThan(harness.calls.indexOf('draft:process'));
      if (failSaveOnce) {
        expect(harness.calls).toEqual(expect.arrayContaining([
          'save:process:fail',
          'read:process:draft_created',
          'save:process',
        ]));
        expect(harness.calls.indexOf('read:process:draft_created')).toBeLessThan(
          harness.calls.lastIndexOf('save:process')
        );
      }

      const state = readState(statePath(), {
        environment: environment(),
        registry: initial.registry,
      });
      expect(state.resources.form.request).toMatchObject({
        lastApplied: { mode: 'process' },
        bindings: { processCode: 'TPROC_RUNTIME_VALUE' },
      });
      expect(state.resources.process.approval.bindings).toMatchObject({
        appType: 'APP_RUNTIME_VALUE',
        formUuid: 'FORM_RUNTIME_VALUE',
        processCode: 'TPROC_RUNTIME_VALUE',
        processId: expect.any(String),
        processVersion: 1,
        nodeBindings: {
          managerApproval: {
            nodeId: expect.any(String),
            componentName: 'ApprovalNode',
          },
        },
      });
      expect(applied.stdout.trim().split('\n')).toHaveLength(1);
      expect(applied.stdout).not.toMatch(/APP_RUNTIME_VALUE|FORM_RUNTIME_VALUE|TPROC_RUNTIME_VALUE|PROCESS_VERSION_|nodeId|componentsTree|cookie-runtime-only|csrf-runtime-only/);

      const repeatedPlan = await plan(manifestPath, harness);
      expect(repeatedPlan.payload.counts.noop).toBe(3);
      const writesBeforeNoop = harness.calls.filter(value => /^(convert|draft|save|publish|update):/.test(value)).length;
      const repeatedApply = await apply(manifestPath, repeatedPlan.payload.planId, harness);
      expect(repeatedApply.payload).toMatchObject({
        success: true,
        counts: { create: 0, update: 0, noop: 3, stateRepair: 0 },
      });
      expect(harness.calls.filter(value => /^(convert|draft|save|publish|update):/.test(value))).toHaveLength(writesBeforeNoop);

      if (!failSaveOnce) {
        harness.setProcessReadError(Object.assign(new Error('token_PRIVATE internal/path'), {
          code: 'PROCESS_READ_FAILED',
        }));
        const failedRead = await plan(manifestPath, harness);
        expect(failedRead.payload).toMatchObject({
          success: false,
          error: { code: 'SCHEMA_REMOTE_READ_FAILED' },
        });
        expect(failedRead.stdout).not.toMatch(/token_PRIVATE|internal\/path|REMOTE_RESOURCE_MISSING/);
      }
    }
  );

  test('stops fresh-create recovery when checkpoint processCode no longer matches form State', async () => {
    const manifestValue = processManifest();
    const manifestPath = writeManifest(manifestValue);
    const initial = createInitialState(manifestValue);
    const harness = createRemoteHarness(initial, {
      failSaveOnce: true,
      processReadError: Object.assign(new Error('injected unresolved draft'), {
        code: 'PROCESS_READ_FAILED',
      }),
    });
    const reviewed = await plan(manifestPath, harness);
    const interrupted = await apply(manifestPath, reviewed.payload.planId, harness);
    expect(interrupted.payload).toMatchObject({
      success: false,
      error: { code: 'SCHEMA_RECONCILIATION_REQUIRED' },
    });

    const rawState = JSON.parse(fs.readFileSync(statePath(), 'utf8'));
    rawState.resources.form.request.bindings.processCode = 'TPROC_REPAIRED_VALUE';
    fs.writeFileSync(statePath(), JSON.stringify(rawState) + '\n', 'utf8');
    const journalPath = path.join(tempDir, 'apply-operations.v1.json');
    const journalBeforeRetry = fs.readFileSync(journalPath, 'utf8');
    const stateBeforeRetry = fs.readFileSync(statePath(), 'utf8');
    harness.calls.length = 0;

    const retried = await apply(manifestPath, reviewed.payload.planId, harness);

    expect(retried.payload).toMatchObject({
      success: false,
      error: { code: 'SCHEMA_RECONCILIATION_REQUIRED' },
    });
    expect(harness.calls.filter(call => (
      call === 'query:versions' ||
      call.startsWith('read:process:') ||
      /^(draft|save|publish):process/.test(call)
    ))).toEqual([]);
    expect(fs.readFileSync(journalPath, 'utf8')).toBe(journalBeforeRetry);
    expect(fs.readFileSync(statePath(), 'utf8')).toBe(stateBeforeRetry);
    expect(fs.existsSync(path.join(tempDir, 'generated', 'bindings.v1.json'))).toBe(false);
  });

  test('stops on an empty version list after the form checkpoint without creating a process', async () => {
    const manifestValue = processManifest();
    const manifestPath = writeManifest(manifestValue);
    const initial = createInitialState(manifestValue);
    const harness = createRemoteHarness(initial, { emptyVersions: true });
    const reviewed = await plan(manifestPath, harness);
    harness.calls.length = 0;

    const applied = await apply(manifestPath, reviewed.payload.planId, harness);

    expect(applied.payload).toMatchObject({
      success: false,
      error: { code: 'SCHEMA_REMOTE_READ_FAILED' },
    });
    expect(harness.calls).toContain('convert:form');
    expect(harness.calls).toContain('query:versions');
    expect(harness.calls).not.toContain('draft:process');
    const state = readState(statePath(), {
      environment: environment(),
      registry: initial.registry,
    });
    expect(state.resources.form.request.bindings.processCode).toBe('TPROC_RUNTIME_VALUE');
    expect(state.resources.process).toBeUndefined();
    expect(applied.stdout).not.toMatch(/REMOTE_RESOURCE_MISSING|TPROC_RUNTIME_VALUE|FORM_RUNTIME_VALUE/);
  });

  test('reuses node bindings on update and classifies external process drift as conflict', async () => {
    const manifestValue = processManifest();
    const manifestPath = writeManifest(manifestValue);
    const initial = createInitialState(manifestValue);
    const harness = createRemoteHarness(initial);
    const firstPlan = await plan(manifestPath, harness);
    await apply(manifestPath, firstPlan.payload.planId, harness);
    const firstState = readState(statePath(), {
      environment: environment(),
      registry: initial.registry,
    });
    const firstNodeId = firstState.resources.process.approval.bindings.nodeBindings.managerApproval.nodeId;

    const updatedManifest = processManifest('Director approval');
    writeManifest(updatedManifest);
    const updatePlan = await plan(manifestPath, harness);
    expect(updatePlan.payload.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resourceType: 'process',
        operation: 'update',
        reasonCode: 'DESIRED_CHANGED',
      }),
    ]));
    const updated = await apply(manifestPath, updatePlan.payload.planId, harness);
    expect(updated.payload.success).toBe(true);
    const updatedState = readState(statePath(), {
      environment: environment(),
      registry: initial.registry,
    });
    expect(updatedState.resources.process.approval.bindings.nodeBindings.managerApproval.nodeId).toBe(firstNodeId);

    const remoteNode = harness.getProcessDefinition().schema.children.find(node => node.componentName === 'ApprovalNode');
    remoteNode.props.name.zh_CN = 'External drift';
    const driftPlan = await plan(manifestPath, harness);
    expect(driftPlan.payload.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resourceType: 'process',
        operation: 'conflict',
        reasonCode: 'REMOTE_DRIFT',
      }),
    ]));
  });

  test('classifies a different PUBLISHED identity as conflict without reading the stale binding', async () => {
    const manifestValue = processManifest();
    const manifestPath = writeManifest(manifestValue);
    const initial = createInitialState(manifestValue);
    const harness = createRemoteHarness(initial);
    const firstPlan = await plan(manifestPath, harness);
    await apply(manifestPath, firstPlan.payload.planId, harness);
    const convergedPlan = await plan(manifestPath, harness);

    harness.calls.length = 0;
    harness.publishExternalVersion();
    const driftPlan = await plan(manifestPath, harness);

    expect(driftPlan.payload.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resourceType: 'process',
        key: 'approval',
        operation: 'conflict',
        reasonCode: 'REMOTE_IDENTITY_DRIFT',
      }),
    ]));
    expect(driftPlan.payload.planId).not.toBe(convergedPlan.payload.planId);
    expect(harness.calls).toContain('query:versions');
    expect(harness.calls.some(call => call.startsWith('read:process:'))).toBe(false);
    expect(driftPlan.stdout).not.toMatch(/PROCESS_EXTERNAL_PUBLISHED|processId|processVersion|TPROC_RUNTIME_VALUE/);
  });

  test('keeps an external SAVED draft out of current observed but blocks a managed update', async () => {
    const manifestValue = processManifest();
    const manifestPath = writeManifest(manifestValue);
    const initial = createInitialState(manifestValue);
    const harness = createRemoteHarness(initial);
    const firstPlan = await plan(manifestPath, harness);
    await apply(manifestPath, firstPlan.payload.planId, harness);
    const convergedPlan = await plan(manifestPath, harness);

    harness.setExternalDraft();
    const unchangedPlan = await plan(manifestPath, harness);
    expect(unchangedPlan.payload.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resourceType: 'process',
        operation: 'noop',
        reasonCode: 'ALREADY_MATCHES_DESIRED',
      }),
    ]));
    expect(unchangedPlan.payload.planId).not.toBe(convergedPlan.payload.planId);

    writeManifest(processManifest('Director approval'));
    const blockedPlan = await plan(manifestPath, harness);
    expect(blockedPlan.payload.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resourceType: 'process',
        operation: 'conflict',
        reasonCode: 'REMOTE_DRAFT_EXISTS',
      }),
    ]));
    expect(blockedPlan.stdout).not.toMatch(/PROCESS_EXTERNAL_DRAFT|processId|processVersion|TPROC_RUNTIME_VALUE/);
  });
});
