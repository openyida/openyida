'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { compileFormDefinition } = require('../lib/app/services/form-compiler');
const { appAdapter } = require('../lib/schema/adapters/app-adapter');
const { formAdapter } = require('../lib/schema/adapters/form-adapter');
const { applySchema } = require('../lib/schema/applier');
const {
  createApplyJournal,
  createApplyOperationId,
  readApplyJournal,
  resolveApplyPaths,
  updateJournalOperation,
  writeApplyJournalAtomic,
} = require('../lib/schema/apply-store');
const { normalizeManifest } = require('../lib/schema/normalize-manifest');
const { createPlan, hashManagedIdentity } = require('../lib/schema/planner');
const { ResourceRegistry } = require('../lib/schema/resource-registry');
const {
  createEmptyState,
  hashStable,
  readState,
  upsertResourceState,
  writeStateAtomic,
} = require('../lib/schema/state-store');

const APP_KEY = 'recoveryApp';
const APP_NAME = 'Recovery App';
const APP_TYPE = 'APP_CREATED_EXACT';
const FORM_KEY = 'followup';
const FORM_UUID = 'FORM_RESUME_EXACT';
const TOKEN_SECRET = 'TOKEN_SECRET_VALUE';
const COOKIE_SECRET = 'COOKIE_SECRET_VALUE';

let workspace;

describe('schema app create identity recovery', () => {
  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-app-create-recovery-'));
  });

  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  test('app create receipt checkpoints state without post-write readback', async () => {
    const registry = createRegistry();
    const normalized = normalizeAppManifest(registry);
    const plan = createReviewedPlan(normalized, registry);
    const behavior = {
      readError: new Error(`post read should not be required ${TOKEN_SECRET}`),
    };
    const harness = createAppHarness(behavior);

    const result = await runApply(normalized, plan.planId, harness.services, registry);

    expect(result.success).toBe(true);
    expect(harness.calls).toEqual(['createAppResource']);
    expect(harness.readInputs).toEqual([]);
    const operation = readOperation(registry);
    expect(operation).toMatchObject({
      resourceType: 'app',
      key: APP_KEY,
      operation: 'create',
      status: 'completed',
      createIdentity: {
        bindings: { appType: APP_TYPE },
      },
    });
    expect(readState(statePath(), { environment: environment(), registry })
      .resources.app[APP_KEY]).toMatchObject({
      bindings: { appType: APP_TYPE },
      lastApplied: { key: APP_KEY, name: APP_NAME },
    });

    const rawJournal = fs.readFileSync(resolveApplyPaths(statePath()).journalPath, 'utf8');
    expect(rawJournal).toContain(APP_TYPE);
    expect(rawJournal).not.toContain(TOKEN_SECRET);
    expect(rawJournal).not.toContain(COOKIE_SECRET);
    expect(rawJournal).not.toContain('response');
  });

  test('app create receipt checkpoints before dependents when app readback is still missing', async () => {
    const registry = createRegistry({ formContract: createFollowupFormAdapter() });
    const normalized = normalizeAppWithFormManifest(registry);
    const plan = createReviewedPlan(normalized, registry);
    const harness = createAppHarness({
      appReadMissingCount: 99,
      enableFollowupForm: true,
    });

    const result = await runApply(normalized, plan.planId, harness.services, registry);

    expect(result.success).toBe(true);
    expect(result.counts).toMatchObject({ create: 2 });
    expect(harness.calls.filter(call => call === 'readApp')).toHaveLength(0);
    expect(harness.calls.indexOf('createFollowupFormResource')).toBeGreaterThan(
      harness.calls.indexOf('createAppResource')
    );
    expect(harness.readInputs).toEqual([]);
    expect(harness.calls.filter(call => call === 'createAppResource')).toHaveLength(1);

    const state = readState(statePath(), { environment: environment(), registry });
    expect(state.resources.app[APP_KEY]).toMatchObject({
      bindings: { appType: APP_TYPE },
      lastApplied: { key: APP_KEY, name: APP_NAME },
    });
    expect(state.resources.form.followup).toMatchObject({
      bindings: { appType: APP_TYPE, formUuid: 'FORM_FOLLOWUP_EXACT' },
    });
    const operations = readOperations(registry);
    expect(Object.values(operations).every(operation => operation.status !== 'uncertain')).toBe(true);
    expect(operations[`app:${APP_KEY}`].status).toBe('completed');
    expect(operations['form:followup'].status).toBe('completed');
  });

  test('form post-write readback uses expanded default retry budget without recreating', async () => {
    const registry = createRegistry({ formContract: createFollowupFormAdapter() });
    const normalized = normalizeAppWithFormManifest(registry);
    const plan = createReviewedPlan(normalized, registry);
    const harness = createAppHarness({
      enableFollowupForm: true,
      formReadFailureCount: 9,
    });

    const result = await runApply(normalized, plan.planId, harness.services, registry, {
      formPostWriteReadbackRetry: { delayMs: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.counts).toMatchObject({ create: 2 });
    expect(harness.calls.filter(call => call === 'readFollowupFormResource')).toHaveLength(10);
    expect(harness.calls.filter(call => call === 'createFollowupFormResource')).toHaveLength(1);
    expect(harness.formReadInputs).toHaveLength(10);
    expect(harness.formReadInputs.every(input => (
      input.appType === APP_TYPE && input.formUuid === 'FORM_FOLLOWUP_EXACT'
    ))).toBe(true);

    const state = readState(statePath(), { environment: environment(), registry });
    expect(state.resources.form.followup).toMatchObject({
      bindings: { appType: APP_TYPE, formUuid: 'FORM_FOLLOWUP_EXACT' },
    });
    expect(readOperations(registry)['form:followup'].status).toBe('completed');
  });

  test('pending form create identity resume retries pre-resume readback without recreating', async () => {
    const registry = createRegistry();
    const normalized = normalizeAppWithFormManifest(registry);
    const appState = writeAppOnlyState(normalized, registry);
    const plan = createReviewedPlan(normalized, registry, {
      observedResources: [observedAppResource()],
      state: appState,
    });
    const formResource = desiredResources(normalized, registry)
      .find(resource => resource.resourceType === 'form' && resource.key === FORM_KEY);
    const compiled = compileFormDefinition({
      title: formResource.desired.title,
      fields: formResource.desired.fields,
    }, {
      appType: APP_TYPE,
      formUuid: FORM_UUID,
    });
    const formBindings = stateFormBindings(compiled);
    writePendingFormCreateIdentity(normalized, plan.planId, registry, formResource, formBindings, appState);

    const harness = createAppHarness({
      remoteApp: { appType: APP_TYPE, appName: APP_NAME },
    });
    const formReadInputs = [];
    let formReadFailures = 9;
    harness.remote.forms[FORM_UUID] = {
      success: true,
      content: {
        ...compiled.schema,
        gmtModified: 100,
      },
    };
    harness.services.createFormResource = async function () {
      harness.calls.push('createFormResource');
      throw new Error('form create should not be called during identity resume');
    };
    harness.services.resumeFormResource = async function () {
      harness.calls.push('resumeFormResource');
      throw new Error('resume write should not be called when observed form already matches desired');
    };
    harness.services.readFormSchema = async function (_context, input) {
      harness.calls.push('readFormSchema');
      formReadInputs.push({ ...input });
      if (formReadFailures > 0) {
        formReadFailures -= 1;
        const error = new Error('transient resume form read failure');
        error.code = 'FORM_SCHEMA_READ_FAILED';
        throw error;
      }
      return harness.remote.forms[input.formUuid];
    };

    const result = await runApply(normalized, plan.planId, harness.services, registry, {
      formPostWriteReadbackRetry: { delayMs: 0 },
    });

    expect(result.success).toBe(true);
    expect(formReadFailures).toBe(0);
    expect(formReadInputs.length).toBeGreaterThanOrEqual(10);
    expect(formReadInputs.every(input => input.appType === APP_TYPE && input.formUuid === FORM_UUID)).toBe(true);
    expect(harness.calls).not.toContain('createFormResource');
    expect(harness.calls).not.toContain('resumeFormResource');
    expect(readState(statePath(), { environment: environment(), registry })
      .resources.form[FORM_KEY]).toMatchObject({
      bindings: {
        appType: APP_TYPE,
        formUuid: FORM_UUID,
        fieldBindings: formBindings,
      },
      lastApplied: formResource.desired,
    });
    expect(readOperations(registry)[`form:${FORM_KEY}`].status).toBe('completed');
  });

  test('pending receipt form create identity resume falls back when mode read fails after schema match', async () => {
    const registry = createRegistry();
    const normalized = normalizeAppWithFormManifest(registry, { formMode: 'receipt' });
    const appState = writeAppOnlyState(normalized, registry);
    const plan = createReviewedPlan(normalized, registry, {
      observedResources: [observedAppResource()],
      state: appState,
    });
    const formResource = desiredResources(normalized, registry)
      .find(resource => resource.resourceType === 'form' && resource.key === FORM_KEY);
    const compiled = compileFormDefinition({
      title: formResource.desired.title,
      fields: formResource.desired.fields,
    }, {
      appType: APP_TYPE,
      formUuid: FORM_UUID,
    });
    compiled.schema.gmtModified = 100;
    const formBindings = stateFormBindings(compiled);
    writePendingFormCreateIdentity(normalized, plan.planId, registry, formResource, formBindings, appState);

    const harness = createAppHarness({
      remoteApp: { appType: APP_TYPE, appName: APP_NAME },
    });
    const formReadInputs = [];
    const modeReadInputs = [];
    harness.remote.forms[FORM_UUID] = {
      success: true,
      content: compiled.schema,
    };
    harness.services.createFormResource = async function () {
      harness.calls.push('createFormResource');
      throw new Error('form create should not be called during identity resume');
    };
    harness.services.resumeFormResource = async function () {
      harness.calls.push('resumeFormResource');
      throw new Error('resume write should not be called when observed receipt form already matches desired');
    };
    harness.services.readFormSchema = async function (_context, input) {
      harness.calls.push('readFormSchema');
      formReadInputs.push({ ...input });
      return harness.remote.forms[input.formUuid];
    };
    harness.services.readFormMode = async function (_context, input) {
      harness.calls.push('readFormMode');
      modeReadInputs.push({ ...input });
      const error = new Error('transient resume form mode read failure');
      error.code = 'FORM_MODE_READ_FAILED';
      error.details = {
        operation: 'FormProcBinding.getBindingByFormUuid',
        result: { success: false, errorCode: '500' },
      };
      throw error;
    };

    const result = await runApply(normalized, plan.planId, harness.services, registry, {
      formPostWriteReadbackRetry: { maxAttempts: 3, delayMs: 0 },
    });

    expect(result.success).toBe(true);
    expect(modeReadInputs).toHaveLength(3);
    expect(formReadInputs).toHaveLength(4);
    expect(formReadInputs.every(input => input.appType === APP_TYPE && input.formUuid === FORM_UUID)).toBe(true);
    expect(modeReadInputs.every(input => input.appType === APP_TYPE && input.formUuid === FORM_UUID)).toBe(true);
    expect(harness.calls).not.toContain('createFormResource');
    expect(harness.calls).not.toContain('resumeFormResource');
    expect(readState(statePath(), { environment: environment(), registry })
      .resources.form[FORM_KEY]).toMatchObject({
      bindings: {
        appType: APP_TYPE,
        formUuid: FORM_UUID,
        fieldBindings: formBindings,
      },
      lastApplied: formResource.desired,
    });
    expect(readOperations(registry)[`form:${FORM_KEY}`].status).toBe('completed');
  });

  test('pending process form create identity resume write re-reads mode before checkpointing', async () => {
    const registry = createRegistry();
    const normalized = normalizeAppWithFormManifest(registry, { formMode: 'process' });
    const appState = writeAppOnlyState(normalized, registry);
    const plan = createReviewedPlan(normalized, registry, {
      observedResources: [observedAppResource()],
      state: appState,
    });
    const formResource = desiredResources(normalized, registry)
      .find(resource => resource.resourceType === 'form' && resource.key === FORM_KEY);
    const compiled = compileFormDefinition({
      title: formResource.desired.title,
      fields: formResource.desired.fields,
    }, {
      appType: APP_TYPE,
      formUuid: FORM_UUID,
    });
    compiled.schema.gmtModified = 101;
    const formBindings = stateFormBindings(compiled);
    writePendingFormCreateIdentity(normalized, plan.planId, registry, formResource, formBindings, appState);

    const harness = createAppHarness({
      remoteApp: { appType: APP_TYPE, appName: APP_NAME },
    });
    const formReadInputs = [];
    const modeReadInputs = [];
    harness.remote.forms[FORM_UUID] = {
      success: true,
      content: compiled.schema,
    };
    harness.services.createFormResource = async function () {
      harness.calls.push('createFormResource');
      throw new Error('form create should not be called during identity resume');
    };
    harness.services.resumeFormResource = async function (_context, input) {
      harness.calls.push('resumeFormResource');
      expect(input.formUuid).toBe(FORM_UUID);
      return {
        appType: input.appType,
        formUuid: input.formUuid,
        fieldBindings: compiled.fieldBindings,
        fieldBindingComponents: compiled.fieldBindingComponents,
        schemaResult: harness.remote.forms[input.formUuid],
      };
    };
    harness.services.readFormSchema = async function (_context, input) {
      harness.calls.push('readFormSchema');
      formReadInputs.push({ ...input });
      if (formReadInputs.length === 1) {
        return {
          success: true,
          content: {
            gmtModified: 100,
            pages: [],
          },
        };
      }
      return harness.remote.forms[input.formUuid];
    };
    harness.services.readFormMode = async function (_context, input) {
      harness.calls.push('readFormMode');
      modeReadInputs.push({ ...input });
      return { mode: 'process', processCode: 'TPROC_RESUME_WRITE' };
    };

    const result = await runApply(normalized, plan.planId, harness.services, registry);

    expect(result.success).toBe(true);
    expect(harness.calls).toContain('resumeFormResource');
    expect(harness.calls).not.toContain('createFormResource');
    expect(formReadInputs.length).toBeGreaterThanOrEqual(2);
    expect(modeReadInputs.length).toBeGreaterThanOrEqual(2);
    expect(harness.calls.lastIndexOf('readFormMode')).toBeGreaterThan(
      harness.calls.indexOf('resumeFormResource')
    );
    expect(readState(statePath(), { environment: environment(), registry })
      .resources.form[FORM_KEY]).toMatchObject({
      bindings: {
        appType: APP_TYPE,
        formUuid: FORM_UUID,
        fieldBindings: formBindings,
        processCode: 'TPROC_RESUME_WRITE',
      },
      lastApplied: formResource.desired,
    });
    expect(readOperations(registry)[`form:${FORM_KEY}`].status).toBe('completed');
  });

  test('pending process form create identity resume keeps mode read failure uncertain', async () => {
    const registry = createRegistry();
    const normalized = normalizeAppWithFormManifest(registry, { formMode: 'process' });
    const appState = writeAppOnlyState(normalized, registry);
    const plan = createReviewedPlan(normalized, registry, {
      observedResources: [observedAppResource()],
      state: appState,
    });
    const formResource = desiredResources(normalized, registry)
      .find(resource => resource.resourceType === 'form' && resource.key === FORM_KEY);
    const compiled = compileFormDefinition({
      title: formResource.desired.title,
      fields: formResource.desired.fields,
    }, {
      appType: APP_TYPE,
      formUuid: FORM_UUID,
    });
    compiled.schema.gmtModified = 100;
    const formBindings = stateFormBindings(compiled);
    writePendingFormCreateIdentity(normalized, plan.planId, registry, formResource, formBindings, appState);

    const harness = createAppHarness({
      remoteApp: { appType: APP_TYPE, appName: APP_NAME },
    });
    const modeReadInputs = [];
    harness.remote.forms[FORM_UUID] = {
      success: true,
      content: compiled.schema,
    };
    harness.services.createFormResource = async function () {
      harness.calls.push('createFormResource');
      throw new Error('form create should not be called during identity resume');
    };
    harness.services.resumeFormResource = async function () {
      harness.calls.push('resumeFormResource');
      throw new Error('resume write should not be called after process mode read failure');
    };
    harness.services.readFormSchema = async function (_context, input) {
      harness.calls.push('readFormSchema');
      return harness.remote.forms[input.formUuid];
    };
    harness.services.readFormMode = async function (_context, input) {
      harness.calls.push('readFormMode');
      modeReadInputs.push({ ...input });
      const error = new Error('process form mode read failure');
      error.code = 'FORM_MODE_READ_FAILED';
      throw error;
    };

    await expect(runApply(normalized, plan.planId, harness.services, registry, {
      formPostWriteReadbackRetry: { maxAttempts: 2, delayMs: 0 },
    })).rejects.toMatchObject({ code: 'SCHEMA_RECONCILIATION_REQUIRED' });

    expect(modeReadInputs).toHaveLength(2);
    expect(harness.calls).not.toContain('createFormResource');
    expect(harness.calls).not.toContain('resumeFormResource');
    expect(readOperations(registry)[`form:${FORM_KEY}`].status).toBe('uncertain');
    expect(readState(statePath(), { environment: environment(), registry }).resources.form).toBeUndefined();
  });

  test('pending receipt form create identity resume does not fallback on permission mode read failure', async () => {
    const registry = createRegistry();
    const normalized = normalizeAppWithFormManifest(registry, { formMode: 'receipt' });
    const appState = writeAppOnlyState(normalized, registry);
    const plan = createReviewedPlan(normalized, registry, {
      observedResources: [observedAppResource()],
      state: appState,
    });
    const formResource = desiredResources(normalized, registry)
      .find(resource => resource.resourceType === 'form' && resource.key === FORM_KEY);
    const compiled = compileFormDefinition({
      title: formResource.desired.title,
      fields: formResource.desired.fields,
    }, {
      appType: APP_TYPE,
      formUuid: FORM_UUID,
    });
    compiled.schema.gmtModified = 100;
    const formBindings = stateFormBindings(compiled);
    writePendingFormCreateIdentity(normalized, plan.planId, registry, formResource, formBindings, appState);

    const harness = createAppHarness({
      remoteApp: { appType: APP_TYPE, appName: APP_NAME },
    });
    const formReadInputs = [];
    const modeReadInputs = [];
    harness.remote.forms[FORM_UUID] = {
      success: true,
      content: compiled.schema,
    };
    harness.services.createFormResource = async function () {
      harness.calls.push('createFormResource');
      throw new Error('form create should not be called during identity resume');
    };
    harness.services.resumeFormResource = async function () {
      harness.calls.push('resumeFormResource');
      throw new Error('resume write should not be called after permission mode read failure');
    };
    harness.services.readFormSchema = async function (_context, input) {
      harness.calls.push('readFormSchema');
      formReadInputs.push({ ...input });
      return harness.remote.forms[input.formUuid];
    };
    harness.services.readFormMode = async function (_context, input) {
      harness.calls.push('readFormMode');
      modeReadInputs.push({ ...input });
      const error = new Error('permission denied');
      error.code = 'FORM_MODE_READ_FAILED';
      error.details = {
        operation: 'FormProcBinding.getBindingByFormUuid',
        result: { success: false, errorCode: '403', errorMsg: 'permission denied' },
      };
      throw error;
    };

    await expect(runApply(normalized, plan.planId, harness.services, registry, {
      formPostWriteReadbackRetry: { maxAttempts: 3, delayMs: 0 },
    })).rejects.toMatchObject({ code: 'SCHEMA_RECONCILIATION_REQUIRED' });

    expect(modeReadInputs).toHaveLength(1);
    expect(formReadInputs).toHaveLength(1);
    expect(harness.calls).not.toContain('createFormResource');
    expect(harness.calls).not.toContain('resumeFormResource');
    expect(readOperations(registry)[`form:${FORM_KEY}`].status).toBe('uncertain');
  });

  test('app create receipt completes without readback retry or recreate', async () => {
    const registry = createRegistry();
    const normalized = normalizeAppManifest(registry);
    const plan = createReviewedPlan(normalized, registry);
    const harness = createAppHarness({ appReadMissingCount: 99 });

    const result = await runApply(normalized, plan.planId, harness.services, registry);

    expect(result.success).toBe(true);
    expect(harness.calls).toEqual(['createAppResource']);
    expect(harness.readInputs).toEqual([]);
    expect(harness.calls.filter(call => call === 'createAppResource')).toHaveLength(1);
    expect(readOperation(registry)).toMatchObject({
      status: 'completed',
      createIdentity: { bindings: { appType: APP_TYPE } },
    });
    expect(readState(statePath(), { environment: environment(), registry })
      .resources.app[APP_KEY]).toMatchObject({
      bindings: { appType: APP_TYPE },
      lastApplied: { key: APP_KEY, name: APP_NAME },
    });
  });

  test('pending crash-recovery app identity resumes from journal receipt without readback', async () => {
    const resumeCalls = [];
    const registry = createRegistry({ resumeCalls });
    const normalized = normalizeAppManifest(registry);
    const plan = createReviewedPlan(normalized, registry);
    writePendingAppCreateIdentity(normalized, plan.planId, registry);
    const harness = createAppHarness({ appReadMissingCount: 99 });

    const result = await runApply(normalized, plan.planId, harness.services, registry);

    expect(result.success).toBe(true);
    expect(resumeCalls).toHaveLength(1);
    expect(harness.calls).not.toContain('createAppResource');
    expect(harness.calls).not.toContain('updateAppResource');
    expect(harness.calls).not.toContain('readApp');
    expect(harness.readInputs).toEqual([]);
    expect(readState(statePath(), { environment: environment(), registry })
      .resources.app[APP_KEY]).toMatchObject({
      bindings: { appType: APP_TYPE },
      lastApplied: { key: APP_KEY, name: APP_NAME },
    });
    expect(readOperation(registry).status).toBe('completed');
  });

  test('create failure before appType remains identity-less uncertain and is not retried', async () => {
    const registry = createRegistry();
    const normalized = normalizeAppManifest(registry);
    const plan = createReviewedPlan(normalized, registry);
    const harness = createAppHarness({
      createError: new Error(`create failed before appType ${TOKEN_SECRET}`),
    });

    await expect(runApply(normalized, plan.planId, harness.services, registry))
      .rejects.toMatchObject({ code: 'SCHEMA_RECONCILIATION_REQUIRED' });

    let operation = readOperation(registry);
    expect(operation).toMatchObject({
      resourceType: 'app',
      key: APP_KEY,
      operation: 'create',
      status: 'uncertain',
    });
    expect(operation.createIdentity).toBeUndefined();
    expect(harness.calls).toEqual(['createAppResource']);

    await expect(runApply(normalized, plan.planId, harness.services, registry))
      .rejects.toMatchObject({ code: 'SCHEMA_RECONCILIATION_REQUIRED' });

    operation = readOperation(registry);
    expect(operation.status).toBe('uncertain');
    expect(operation.createIdentity).toBeUndefined();
    expect(harness.calls).toEqual(['createAppResource']);
    expect(fs.existsSync(statePath())).toBe(false);
  });

});

function createRegistry(options = {}) {
  const appContract = {
    ...appAdapter,
    async resumeCreate(...args) {
      if (options.resumeCalls) {
        options.resumeCalls.push(args);
      }
      return appAdapter.resumeCreate.apply(this, args);
    },
  };
  return new ResourceRegistry()
    .register(appContract)
    .register(options.formContract || formAdapter);
}

function appManifest() {
  return {
    kind: 'openyida_app_manifest',
    schemaVersion: 1,
    app: {
      key: APP_KEY,
      name: APP_NAME,
    },
  };
}

function appWithFormManifest(options = {}) {
  const followup = {
    title: 'Followup',
    fields: {
      note: {
        type: 'TextField',
        label: 'Note',
      },
    },
  };
  if (options.formMode !== undefined) {
    followup.mode = options.formMode;
  }
  return {
    ...appManifest(),
    forms: {
      followup,
    },
  };
}

function normalizeAppManifest(registry) {
  return normalizeManifest(appManifest(), {
    registry,
    workspaceRoot: workspace,
  });
}

function normalizeAppWithFormManifest(registry, options = {}) {
  return normalizeManifest(appWithFormManifest(options), {
    registry,
    workspaceRoot: workspace,
  });
}

function createReviewedPlan(normalized, registry, options = {}) {
  const state = options.state || createEmptyState(environment(), {
    manifestHash: normalized.manifestHash,
    registry,
  });
  return createPlan({
    desiredResources: normalized.normalized.resources,
    manifestHash: normalized.manifestHash,
    observedResources: options.observedResources || [],
    state,
  }, { registry });
}

function runApply(normalized, planId, services, registry, applyOptions = {}) {
  return applySchema({
    environment: environment(),
    expectedPlanId: planId,
    loadDesired: async () => normalized,
    statePath: statePath(),
    workspaceRoot: workspace,
  }, {
    fsImpl: fs,
    registry,
    services,
    ...applyOptions,
  });
}

function createAppHarness(options = {}) {
  const calls = [];
  const createInputs = [];
  const readInputs = [];
  const formReadInputs = [];
  const remote = {
    app: options.remoteApp || null,
    forms: {},
  };
  let appReadMissingCount = options.appReadMissingCount || 0;
  let formReadFailureCount = options.formReadFailureCount || 0;
  const services = {
    async createAppResource(_context, input) {
      calls.push('createAppResource');
      createInputs.push({ ...input });
      if (options.createError) {
        throw options.createError;
      }
      remote.app = {
        appType: APP_TYPE,
        appName: input.appName,
      };
      return {
        appType: APP_TYPE,
        appName: input.appName,
        response: {
          success: true,
          token: TOKEN_SECRET,
          headers: {
            Cookie: COOKIE_SECRET,
          },
        },
      };
    },
    async readApp(_context, input) {
      calls.push('readApp');
      readInputs.push({ ...input });
      if (options.readError) {
        throw options.readError;
      }
      if (appReadMissingCount > 0) {
        appReadMissingCount -= 1;
        const error = new Error('missing app');
        error.code = 'APP_READ_NOT_FOUND';
        throw error;
      }
      if (!remote.app || remote.app.appType !== input.appType) {
        const error = new Error('missing app');
        error.code = 'APP_READ_NOT_FOUND';
        throw error;
      }
      return { ...remote.app };
    },
    async createFollowupFormResource(_context, input) {
      calls.push('createFollowupFormResource');
      if (!options.enableFollowupForm) {
        throw new Error('followup form create should not be called');
      }
      remote.forms.followup = {
        appType: input.appType,
        formUuid: 'FORM_FOLLOWUP_EXACT',
        managed: input.desired,
      };
      return {
        appType: input.appType,
        formUuid: remote.forms.followup.formUuid,
        managed: input.desired,
      };
    },
    async readFollowupFormResource(_context, input) {
      calls.push('readFollowupFormResource');
      formReadInputs.push({ ...input });
      const form = remote.forms.followup;
      if (!form || form.appType !== input.appType || form.formUuid !== input.formUuid) {
        const error = new Error('missing form');
        error.code = 'FORM_READ_NOT_FOUND';
        throw error;
      }
      if (formReadFailureCount > 0) {
        formReadFailureCount -= 1;
        const error = new Error('transient form read failure');
        error.code = 'FORM_SCHEMA_READ_FAILED';
        throw error;
      }
      return { ...form };
    },
    async updateAppResource() {
      calls.push('updateAppResource');
      throw new Error('app update should not be called');
    },
  };
  return {
    calls,
    createInputs,
    formReadInputs,
    readInputs,
    remote,
    services,
  };
}

function createFollowupFormAdapter() {
  const adapter = {
    ...formAdapter,
    async readObserved(binding, context = {}) {
      const bindings = normalizeFollowupFormBindings(binding);
      const reader = context.services && context.services.readFollowupFormResource;
      if (!reader) {
        throw new Error('missing followup form reader');
      }
      return reader(context, {
        appType: bindings.appType,
        formUuid: bindings.formUuid,
      });
    },
    projectObserved(observed, binding) {
      const bindings = normalizeFollowupFormBindings(binding);
      return {
        managed: observed.managed,
        bindings: {
          appType: bindings.appType,
          formUuid: bindings.formUuid,
        },
      };
    },
    async create(desired, context = {}) {
      const creator = context.services && context.services.createFollowupFormResource;
      if (!creator) {
        throw new Error('missing followup form creator');
      }
      return creator(context, {
        appType: appTypeFromState(context),
        desired,
      });
    },
    async update() {
      throw new Error('followup form update should not be called');
    },
    buildBindings(result, context = {}) {
      const existing = normalizeFollowupFormBindings(context.stateResource);
      return {
        appType: result && result.appType || existing.appType || appTypeFromState(context),
        formUuid: result && result.formUuid || existing.formUuid,
      };
    },
    verify(projection, context = {}) {
      if (JSON.stringify(projection && projection.managed) !== JSON.stringify(context.resource && context.resource.desired)) {
        throw new Error('followup form projection mismatch');
      }
      return projection;
    },
    validateStateResource() {},
  };
  delete adapter.resumeCreate;
  return adapter;
}

function normalizeFollowupFormBindings(binding) {
  const source = binding && binding.bindings ? binding.bindings : binding || {};
  return {
    appType: source.appType || '',
    formUuid: source.formUuid || '',
  };
}

function appTypeFromState(context = {}) {
  return context.state &&
    context.state.resources &&
    context.state.resources.app &&
    context.state.resources.app[APP_KEY] &&
    context.state.resources.app[APP_KEY].bindings &&
    context.state.resources.app[APP_KEY].bindings.appType || '';
}

function writePendingAppCreateIdentity(normalized, planId, registry) {
  const resource = desiredResources(normalized, registry)[0];
  let journal = createApplyJournal({
    environment: environment(),
    manifestHash: normalized.manifestHash,
    planId,
    registry,
  });
  journal = updateJournalOperation(journal, {
    operationId: createApplyOperationId({
      planId,
      resourceType: resource.resourceType,
      key: resource.key,
      operation: 'create',
    }),
    resourceType: resource.resourceType,
    key: resource.key,
    operation: 'create',
    adapterVersion: resource.adapterVersion,
    desiredHash: hashManagedIdentity({
      adapterVersion: resource.adapterVersion,
      key: resource.key,
      managed: resource.desired,
      resourceType: resource.resourceType,
    }),
    status: 'pending',
    stateRevision: 0,
    createIdentity: {
      bindings: { appType: APP_TYPE },
    },
  }, {
    environment: environment(),
    registry,
  });
  writeApplyJournalAtomic(resolveApplyPaths(statePath()).journalPath, journal, {
    environment: environment(),
    fsImpl: fs,
    registry,
    workspaceRoot: workspace,
  });
}

function desiredResources(normalized, registry) {
  return normalized.normalized.resources.map(resource => ({
    ...resource,
    adapterVersion: resource.adapterVersion || registry.get(resource.resourceType).adapterVersion,
  }));
}

function observedAppResource() {
  return {
    resourceType: 'app',
    key: APP_KEY,
    adapterVersion: 1,
    managed: { key: APP_KEY, name: APP_NAME },
  };
}

function writeAppOnlyState(normalized, registry) {
  const appLastApplied = { key: APP_KEY, name: APP_NAME };
  let state = createEmptyState(environment(), {
    manifestHash: normalized.manifestHash,
    registry,
  });
  state = upsertResourceState(state, {
    resourceType: 'app',
    key: APP_KEY,
    adapterVersion: 1,
    bindings: { appType: APP_TYPE },
    lastApplied: appLastApplied,
    lastAppliedHash: hashStable(appLastApplied),
  }, { registry });
  return writeStateAtomic(statePath(), state, {
    environment: environment(),
    fsImpl: fs,
    registry,
  });
}

function stateFormBindings(compiled) {
  const result = {};
  Object.keys(compiled.fieldBindings || {}).sort().forEach((semanticPath) => {
    result[semanticPath] = {
      fieldId: compiled.fieldBindings[semanticPath],
      componentType: compiled.fieldBindingComponents[semanticPath] || '',
    };
  });
  return result;
}

function writePendingFormCreateIdentity(normalized, planId, registry, resource, formBindings, state) {
  let journal = createApplyJournal({
    environment: environment(),
    manifestHash: normalized.manifestHash,
    planId,
    registry,
  });
  journal = updateJournalOperation(journal, {
    operationId: createApplyOperationId({
      planId,
      resourceType: resource.resourceType,
      key: resource.key,
      operation: 'create',
    }),
    resourceType: resource.resourceType,
    key: resource.key,
    operation: 'create',
    adapterVersion: resource.adapterVersion,
    desiredHash: hashManagedIdentity({
      adapterVersion: resource.adapterVersion,
      key: resource.key,
      managed: resource.desired,
      resourceType: resource.resourceType,
    }),
    status: 'pending',
    stateRevision: state.revision,
    createIdentity: {
      bindings: {
        appType: APP_TYPE,
        formUuid: FORM_UUID,
        fieldBindings: formBindings,
      },
    },
  }, {
    environment: environment(),
    registry,
  });
  writeApplyJournalAtomic(resolveApplyPaths(statePath()).journalPath, journal, {
    environment: environment(),
    fsImpl: fs,
    registry,
    workspaceRoot: workspace,
  });
}

function readOperation(registry) {
  return readOperations(registry)[`app:${APP_KEY}`];
}

function readOperations(registry) {
  return readApplyJournal(resolveApplyPaths(statePath()).journalPath, {
    environment: environment(),
    fsImpl: fs,
    registry,
    workspaceRoot: workspace,
  }).operations;
}

function statePath() {
  return path.join(workspace, '.cache', 'openyida', 'state.v1.json');
}

function environment() {
  return {
    endpoint: 'https://example.test',
    corpId: 'corp-app-create-recovery',
  };
}
