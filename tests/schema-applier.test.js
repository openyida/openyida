'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { compileFormDefinition } = require('../lib/app/services/form-compiler');
const { prepareFormResourceUpdate } = require('../lib/app/services/form-service');
const { run: runSchemaCommand } = require('../lib/schema/command');
const { normalizeManifest } = require('../lib/schema/normalize-manifest');
const { createPlan, hashManagedIdentity } = require('../lib/schema/planner');
const { readObservedResources: readRemoteObservedResources } = require('../lib/schema/remote-reader');
const {
  createApplyOperationId,
  acquireApplyLock,
  createApplyJournal,
  updateJournalOperation,
  writeApplyJournalAtomic,
} = require('../lib/schema/apply-store');
const {
  createEmptyState,
  hashStable,
  readState,
  upsertResourceState,
  writeStateAtomic,
} = require('../lib/schema/state-store');
const { flattenCommandManifest } = require('../lib/core/command-manifest');
const { createServerRevisionConflict } = require('../lib/schema/server-revision');

let tempDir;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-schema-apply-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function environment() {
  return {
    endpoint: 'https://example.test',
    corpId: 'corp-schema-apply',
  };
}

function authRef() {
  return {
    baseUrl: 'https://example.test',
    corpId: 'corp-schema-apply',
    csrfToken: 'csrf-runtime-only',
    cookies: [{ name: 'token', value: 'cookie-runtime-only' }],
  };
}

function manifest(appName = 'Visitor App') {
  return {
    kind: 'openyida_app_manifest',
    schemaVersion: 1,
    app: {
      key: 'visitorApp',
      name: appName,
    },
    forms: {
      visitor: {
        title: 'Visitor',
        fields: {
          firstName: {
            type: 'TextField',
            label: 'First name',
            required: true,
          },
        },
      },
    },
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function writeManifest(value = manifest()) {
  const manifestPath = path.join(tempDir, 'app.yida.json');
  fs.writeFileSync(manifestPath, JSON.stringify(value), 'utf8');
  return manifestPath;
}

function statePath() {
  return path.join(tempDir, 'state.v1.json');
}

function emptyState(normalized) {
  return createEmptyState(environment(), {
    manifestHash: normalized.manifestHash,
  });
}

function planFor(normalized, state, observedResources = []) {
  return createPlan({
    desiredResources: normalized.normalized.resources,
    manifestHash: normalized.manifestHash,
    observedResources,
    state,
  });
}

function collectStdout() {
  let value = '';
  return {
    stream: { write(chunk) { value += chunk; } },
    value() { return value; },
  };
}

function createRemoteHarness(options = {}) {
  const remote = {
    app: null,
    forms: {},
  };
  const calls = [];
  const resourceOrder = [];
  let nextForm = 1;
  const services = {
    async createAppResource(context, input) {
      calls.push('create:app');
      resourceOrder.push('app:visitorApp');
      if (options.createAppError) {
        throw options.createAppError;
      }
      remote.app = {
        appType: 'APP_RUNTIME_SECRET',
        appName: input.appName,
      };
      return {
        appType: remote.app.appType,
        appName: remote.app.appName,
      };
    },
    async updateAppResource(context, input) {
      calls.push('update:app');
      remote.app.appName = input.name;
      return { appType: input.appType };
    },
    async readApp(context, input) {
      calls.push('read:app');
      if (typeof options.readApp === 'function') {
        return options.readApp(context, input, remote);
      }
      if (!remote.app || remote.app.appType !== input.appType) {
        const error = new Error('missing app');
        error.code = 'APP_READ_NOT_FOUND';
        throw error;
      }
      return { ...remote.app };
    },
    async createFormResource(context, input) {
      calls.push('create:form');
      resourceOrder.push(`form:${input.definition.title}`);
      const formUuid = `FORM_RUNTIME_SECRET_${nextForm++}`;
      const compiled = compileFormDefinition(input.definition, {
        appType: input.appType,
        formUuid,
      });
      remote.forms[formUuid] = {
        success: true,
        content: { ...clone(compiled.schema), gmtModified: 100 },
      };
      await context.checkpointCreateIdentity({
        appType: input.appType,
        formUuid,
        fieldBindings: compiled.fieldBindings,
        fieldBindingComponents: compiled.fieldBindingComponents,
      });
      return {
        appType: input.appType,
        formUuid,
        fieldBindings: compiled.fieldBindings,
        fieldBindingComponents: compiled.fieldBindingComponents,
        schemaResult: remote.forms[formUuid],
      };
    },
    async updateFormResource(context, input) {
      calls.push('update:form');
      if (options.formUpdateError) {
        throw options.formUpdateError;
      }
      remote.forms[input.formUuid] = {
        success: true,
        content: {
          ...clone(input.prepared.schema),
          gmtModified: remote.forms[input.formUuid].content.gmtModified + 1,
        },
      };
      if (typeof options.afterFormUpdate === 'function') {
        await options.afterFormUpdate(context, input, remote);
      }
      return {
        appType: input.appType,
        formUuid: input.formUuid,
        fieldBindings: input.prepared.compiled.fieldBindings,
        fieldBindingComponents: input.prepared.compiled.fieldBindingComponents,
        schemaResult: remote.forms[input.formUuid],
      };
    },
    async readFormSchema(context, input) {
      calls.push('read:form');
      if (typeof options.readFormSchema === 'function') {
        return options.readFormSchema(context, input, remote);
      }
      const value = remote.forms[input.formUuid];
      if (!value) {
        const error = new Error('form read failed');
        error.code = 'FORM_SCHEMA_READ_FAILED';
        throw error;
      }
      return value;
    },
  };
  return { calls, remote, resourceOrder, services };
}

async function runApply(manifestPath, planId, harness, overrides = {}) {
  const stdout = collectStdout();
  const payload = await runSchemaCommand([
    'apply',
    manifestPath,
    '--state', statePath(),
    '--plan-id', planId,
    '--json',
    '--quiet',
  ], {
    authRef: authRef(),
    environment: environment(),
    projectRoot: tempDir,
    services: harness.services,
    setExitCode: false,
    stdout: stdout.stream,
    ...overrides,
  });
  return { payload, stdout: stdout.value() };
}

function createBoundAppState(normalized, lastAppliedName) {
  let state = emptyState(normalized);
  const lastApplied = {
    key: 'visitorApp',
    name: lastAppliedName,
  };
  state = upsertResourceState(state, {
    resourceType: 'app',
    key: 'visitorApp',
    adapterVersion: 1,
    bindings: { appType: 'APP_RUNTIME_SECRET' },
    lastApplied,
    lastAppliedHash: hashStable(lastApplied),
  });
  return writeStateAtomic(statePath(), state, {
    environment: environment(),
  });
}

describe('schema apply command and recovery state machine', () => {
  test('creates app then form, checkpoints each resource, and repeated apply is noop', async () => {
    const manifestFile = writeManifest();
    const normalized = normalizeManifest(manifest());
    const initialState = emptyState(normalized);
    const firstPlan = planFor(normalized, initialState);
    const harness = createRemoteHarness();

    const first = await runApply(manifestFile, firstPlan.planId, harness);

    expect(first.payload).toMatchObject({
      kind: 'openyida_schema_apply',
      success: true,
      counts: { create: 2, update: 0, noop: 0, stateRepair: 0 },
      stateRevision: 2,
    });
    expect(first.payload).not.toHaveProperty('action');
    expect(first.stdout.trim().split('\n')).toHaveLength(1);
    expect(harness.calls.filter(value => value.startsWith('create:'))).toEqual([
      'create:app',
      'create:form',
    ]);
    expect(first.stdout).not.toMatch(/APP_RUNTIME_SECRET|FORM_RUNTIME_SECRET|textField_|cookie-runtime-only|csrf-runtime-only|componentsTree/);

    const state = readState(statePath(), { environment: environment() });
    expect(state.resources.app.visitorApp.lastApplied.name).toBe('Visitor App');
    expect(state.resources.form.visitor.bindings.fieldBindings.firstName.fieldId).toMatch(/^textField_/);
    expect(fs.existsSync(path.join(tempDir, 'generated', 'bindings.v1.json'))).toBe(false);

    const repeatedReviewedPlan = await runApply(manifestFile, firstPlan.planId, harness);
    expect(repeatedReviewedPlan.payload).toMatchObject({
      success: true,
      planId: firstPlan.planId,
      counts: { create: 0, update: 0, noop: 2, stateRepair: 0 },
    });

    const planStdout = collectStdout();
    const secondPlan = await runSchemaCommand([
      'plan', manifestFile, '--state', statePath(), '--json', '--quiet',
    ], {
      authRef: authRef(),
      environment: environment(),
      projectRoot: tempDir,
      services: harness.services,
      setExitCode: false,
      stdout: planStdout.stream,
    });
    const createsBeforeSecondApply = harness.calls.filter(value => value.startsWith('create:')).length;
    const second = await runApply(manifestFile, secondPlan.planId, harness);

    expect(second.payload).toMatchObject({
      success: true,
      counts: { create: 0, update: 0, noop: 2, stateRepair: 0 },
    });
    expect(second.payload).not.toHaveProperty('action');
    expect(harness.calls.filter(value => value.startsWith('create:'))).toHaveLength(createsBeforeSecondApply);
  });

  test('updates app and form in dependency order while preserving unmanaged form props', async () => {
    const manifestFile = writeManifest();
    const initialNormalized = normalizeManifest(manifest());
    const harness = createRemoteHarness();
    const firstPlan = planFor(initialNormalized, emptyState(initialNormalized));
    const first = await runApply(manifestFile, firstPlan.planId, harness);
    expect(first.payload.success).toBe(true);

    const formUuid = Object.keys(harness.remote.forms)[0];
    const formSchema = harness.remote.forms[formUuid].content;
    const firstNameId = readState(statePath(), { environment: environment() })
      .resources.form.visitor.bindings.fieldBindings.firstName.fieldId;
    findFieldComponent(formSchema, firstNameId).props.unmanagedCustom = { keep: true };

    const nextManifest = manifest('Visitor App 2');
    nextManifest.forms.visitor.fields.firstName.label = 'Given name';
    nextManifest.forms.visitor.fields.note = {
      type: 'TextField',
      label: 'Note',
    };
    writeManifest(nextManifest);

    const planStdout = collectStdout();
    const reviewedPlan = await runSchemaCommand([
      'plan', manifestFile, '--state', statePath(), '--json', '--quiet',
    ], {
      authRef: authRef(),
      environment: environment(),
      projectRoot: tempDir,
      services: harness.services,
      setExitCode: false,
      stdout: planStdout.stream,
    });
    expect(reviewedPlan.counts.update).toBe(2);

    const callStart = harness.calls.length;
    const applied = await runApply(manifestFile, reviewedPlan.planId, harness);

    expect(applied.payload).toMatchObject({
      success: true,
      counts: { create: 0, update: 2, noop: 0, stateRepair: 0 },
    });
    expect(harness.calls.slice(callStart).filter(value => value.startsWith('update:'))).toEqual([
      'update:app',
      'update:form',
    ]);
    const updatedState = readState(statePath(), { environment: environment() });
    const noteId = updatedState.resources.form.visitor.bindings.fieldBindings.note.fieldId;
    expect(findFieldComponent(harness.remote.forms[formUuid].content, firstNameId).props.unmanagedCustom).toEqual({ keep: true });
    expect(findFieldComponent(harness.remote.forms[formUuid].content, noteId)).toBeTruthy();
  });

  test('app update still requires post-write readback before State checkpoint', async () => {
    const manifestFile = writeManifest();
    const initialNormalized = normalizeManifest(manifest());
    const harness = createRemoteHarness();
    const firstPlan = planFor(initialNormalized, emptyState(initialNormalized));
    expect((await runApply(manifestFile, firstPlan.planId, harness)).payload.success).toBe(true);

    writeManifest(manifest('Visitor App 2'));
    const reviewedPlan = await runSchemaCommand([
      'plan', manifestFile, '--state', statePath(), '--json', '--quiet',
    ], {
      authRef: authRef(),
      environment: environment(),
      projectRoot: tempDir,
      services: harness.services,
      setExitCode: false,
      stdout: collectStdout().stream,
    });
    expect(reviewedPlan.counts.update).toBe(1);

    const stateBefore = fs.readFileSync(statePath(), 'utf8');
    const updateAppResource = harness.services.updateAppResource;
    harness.services.updateAppResource = async function (context, input) {
      const result = await updateAppResource(context, input);
      harness.remote.app.appName = 'Remote Drift';
      return result;
    };
    const callStart = harness.calls.length;

    const failed = await runApply(manifestFile, reviewedPlan.planId, harness);

    expect(failed.payload).toMatchObject({
      success: false,
      error: {
        code: 'SCHEMA_APPLY_VERIFY_FAILED',
        details: {
          resourceType: 'app',
          key: 'visitorApp',
        },
      },
    });
    expect(harness.calls.slice(callStart)).toContain('update:app');
    expect(harness.calls.slice(callStart).lastIndexOf('read:app')).toBeGreaterThan(
      harness.calls.slice(callStart).indexOf('update:app')
    );
    expect(fs.readFileSync(statePath(), 'utf8')).toBe(stateBefore);
  });

  test('full-Schema-only drift after plan makes apply stale before any write', async () => {
    const manifestFile = writeManifest();
    const normalized = normalizeManifest(manifest());
    const harness = createRemoteHarness();
    expect((await runApply(manifestFile, planFor(normalized, emptyState(normalized)).planId, harness)).payload.success).toBe(true);

    const nextManifest = manifest();
    nextManifest.forms.visitor.fields.firstName.label = 'Planned label';
    writeManifest(nextManifest);
    const reviewedPlan = await runSchemaCommand([
      'plan', manifestFile, '--state', statePath(), '--json', '--quiet',
    ], {
      authRef: authRef(),
      environment: environment(),
      projectRoot: tempDir,
      services: harness.services,
      setExitCode: false,
      stdout: collectStdout().stream,
    });
    const stateBefore = fs.readFileSync(statePath(), 'utf8');
    const journalPath = path.join(tempDir, 'apply-operations.v1.json');
    const journalBefore = fs.readFileSync(journalPath, 'utf8');
    const updatesBefore = harness.calls.filter(value => value === 'update:form').length;
    const formUuid = Object.keys(harness.remote.forms)[0];
    const firstNameId = readState(statePath(), { environment: environment() })
      .resources.form.visitor.bindings.fieldBindings.firstName.fieldId;
    findFieldComponent(harness.remote.forms[formUuid].content, firstNameId).props.remoteOnlyAfterPlan = {
      keep: true,
    };

    const failed = await runApply(manifestFile, reviewedPlan.planId, harness);

    expect(failed.payload).toMatchObject({
      success: false,
      error: { code: 'SCHEMA_APPLY_PLAN_STALE' },
      action: {
        errorCode: 'SCHEMA_APPLY_PLAN_STALE',
        classification: 'stale_replanned',
        safeToRetry: false,
        nextAction: 'review_replanned_plan',
      },
      replan: {
        kind: 'openyida_schema_plan',
        success: true,
        planId: expect.any(String),
      },
    });
    expect(failed.payload.replan.planId).not.toBe(reviewedPlan.planId);
    expect(harness.calls.filter(value => value === 'update:form')).toHaveLength(updatesBefore);
    expect(fs.readFileSync(statePath(), 'utf8')).toBe(stateBefore);
    expect(fs.readFileSync(journalPath, 'utf8')).toBe(journalBefore);
  });

  test('creates association target form before its dependent form without label lookup', async () => {
    const value = manifest();
    value.forms.customer = {
      title: 'Customer',
      fields: {
        companyName: {
          type: 'TextField',
          label: 'Company name',
        },
      },
    };
    value.forms.visitor.fields.customer = {
      type: 'AssociationFormField',
      label: 'Customer',
      form: 'form:customer',
    };
    const manifestFile = writeManifest(value);
    const normalized = normalizeManifest(value);
    const harness = createRemoteHarness();
    const reviewedPlan = planFor(normalized, emptyState(normalized));

    const applied = await runApply(manifestFile, reviewedPlan.planId, harness);

    expect(applied.payload).toMatchObject({
      success: true,
      counts: { create: 3 },
    });
    expect(harness.resourceOrder).toEqual([
      'app:visitorApp',
      'form:Customer',
      'form:Visitor',
    ]);
  });

  test('stale plan and lock contention stop before remote writes', async () => {
    const manifestFile = writeManifest();
    const harness = createRemoteHarness();
    const readObservedResources = jest.fn(async () => ({ resources: [] }));

    const stale = await runApply(manifestFile, `sha256:${'0'.repeat(64)}`, harness, {
      readObservedResources,
    });
    expect(stale.payload).toMatchObject({
      success: false,
      error: { code: 'SCHEMA_APPLY_PLAN_STALE' },
      action: {
        classification: 'stale_replanned',
        nextAction: 'review_replanned_plan',
      },
      replan: { success: true },
    });
    expect(readObservedResources).toHaveBeenCalledTimes(1);
    expect(harness.calls.filter(value => /create:|update:/.test(value))).toEqual([]);

    const normalized = normalizeManifest(manifest());
    const plan = planFor(normalized, emptyState(normalized));
    fs.mkdirSync(path.dirname(statePath()), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'apply.lock'), '{}', 'utf8');
    const locked = await runApply(manifestFile, plan.planId, harness);
    expect(locked.payload).toMatchObject({
      success: false,
      error: { code: 'SCHEMA_APPLY_LOCKED' },
    });
    expect(harness.calls.filter(value => /create:|update:/.test(value))).toEqual([]);
  });

  test('automatic re-plan failure is attempted once, stays one-line, and preserves apply exit failure', async () => {
    const manifestFile = writeManifest();
    const harness = createRemoteHarness();
    const readObservedResources = jest.fn(async () => {
      const error = new Error('token_SECRET /private/internal/manifest.json');
      error.code = 'SCHEMA_REMOTE_READ_FAILED';
      error.path = '/private/internal/manifest.json';
      error.details = {
        header: 'Cookie secret',
        internalPath: '/private/internal/manifest.json',
      };
      throw error;
    });
    const previousExitCode = process.exitCode;

    try {
      process.exitCode = undefined;
      const failed = await runApply(manifestFile, `sha256:${'0'.repeat(64)}`, harness, {
        readObservedResources,
        setExitCode: true,
      });

      expect(failed.payload).toMatchObject({
        success: false,
        error: { code: 'SCHEMA_APPLY_PLAN_STALE' },
        action: {
          errorCode: 'SCHEMA_APPLY_PLAN_STALE',
          classification: 'automatic_replan_failed',
          safeToRetry: false,
          nextAction: 'check_remote_read',
        },
        replan: {
          kind: 'openyida_schema_plan',
          success: false,
          error: {
            code: 'SCHEMA_REMOTE_READ_FAILED',
            message: 'Schema plan failed because remote observed read failed.',
          },
          action: {
            classification: 'remote_read_blocked',
            nextAction: 'check_remote_read',
          },
        },
      });
      expect(readObservedResources).toHaveBeenCalledTimes(1);
      expect(harness.calls.filter(value => /create:|update:/.test(value))).toEqual([]);
      expect(failed.stdout.trim().split('\n')).toHaveLength(1);
      expect(JSON.parse(failed.stdout)).toEqual(failed.payload);
      expect(process.exitCode).toBe(1);
      expect(failed.stdout).not.toMatch(/token_SECRET|private\/internal|Cookie secret|internalPath|header/);
      expect(failed.payload.replan.error).not.toHaveProperty('path');
      expect(failed.payload.replan.error).not.toHaveProperty('details');
    } finally {
      process.exitCode = previousExitCode;
    }
  });

  test('ownership lock rejects a live owner and safely reclaims a proven stale owner', () => {
    const lockPath = path.join(tempDir, 'apply.lock');
    const staleHandle = acquireApplyLock(lockPath, {
      isProcessAlive: pid => pid === 101,
      ownerToken: 'a'.repeat(32),
      processId: 101,
      workspaceRoot: tempDir,
    });

    expect(() => acquireApplyLock(lockPath, {
      isProcessAlive: pid => pid === 101,
      ownerToken: 'b'.repeat(32),
      processId: 101,
      workspaceRoot: tempDir,
    })).toThrow(expect.objectContaining({ code: 'SCHEMA_APPLY_LOCKED' }));

    const replacement = acquireApplyLock(lockPath, {
      isProcessAlive: pid => pid === 202,
      ownerToken: 'b'.repeat(32),
      processId: 202,
      workspaceRoot: tempDir,
    });
    expect(JSON.parse(fs.readFileSync(lockPath, 'utf8'))).toMatchObject({
      ownerToken: 'b'.repeat(32),
      pid: 202,
    });
    expect(() => staleHandle.release()).toThrow(expect.objectContaining({
      code: 'SCHEMA_APPLY_LOCK_RELEASE_FAILED',
    }));
    expect(JSON.parse(fs.readFileSync(lockPath, 'utf8')).ownerToken).toBe('b'.repeat(32));

    replacement.release();
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  test('lock owner initialization failure does not leave an apply lock', () => {
    const lockPath = path.join(tempDir, 'apply.lock');
    let failOwnerWrite = true;
    const fsImpl = {
      ...fs,
      writeFileSync(target, value, encoding) {
        if (failOwnerWrite && typeof target === 'number') {
          failOwnerWrite = false;
          throw new Error('owner initialization failed');
        }
        return fs.writeFileSync(target, value, encoding);
      },
    };

    expect(() => acquireApplyLock(lockPath, {
      fsImpl,
      ownerToken: 'c'.repeat(32),
      processId: 303,
      workspaceRoot: tempDir,
    })).toThrow(expect.objectContaining({ code: 'SCHEMA_APPLY_LOCK_FAILED' }));
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  test('lock handle rejects same-owner file generation replacement and cannot remove it', () => {
    const lockPath = path.join(tempDir, 'apply.lock');
    const displacedPath = path.join(tempDir, 'apply.lock.displaced');
    const ownerToken = 'd'.repeat(32);
    const handle = acquireApplyLock(lockPath, {
      isProcessAlive: () => true,
      ownerToken,
      processId: 404,
      workspaceRoot: tempDir,
    });
    const owner = fs.readFileSync(lockPath, 'utf8');
    fs.renameSync(lockPath, displacedPath);
    fs.writeFileSync(lockPath, owner, { mode: 0o600 });

    expect(() => handle.assertOwned()).toThrow(expect.objectContaining({
      code: 'SCHEMA_APPLY_LOCK_LOST',
    }));
    expect(() => handle.release()).toThrow(expect.objectContaining({
      code: 'SCHEMA_APPLY_LOCK_RELEASE_FAILED',
    }));
    expect(fs.readFileSync(lockPath, 'utf8')).toBe(owner);
    expect(JSON.parse(fs.readFileSync(lockPath, 'utf8'))).toMatchObject({
      ownerToken,
      pid: 404,
    });
  });

  test('apply state path rejects workspace escape and symlink traversal', async () => {
    const manifestFile = writeManifest();
    const normalized = normalizeManifest(manifest());
    const plan = planFor(normalized, emptyState(normalized));
    const harness = createRemoteHarness();
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-schema-apply-outside-'));
    const linkedDirectory = path.join(tempDir, 'linked-state');
    fs.symlinkSync(outside, linkedDirectory, 'dir');
    const stdout = collectStdout();
    try {
      const payload = await runSchemaCommand([
        'apply',
        manifestFile,
        '--state', path.join(linkedDirectory, 'state.v1.json'),
        '--plan-id', plan.planId,
        '--json',
        '--quiet',
      ], {
        authRef: authRef(),
        environment: environment(),
        projectRoot: tempDir,
        services: harness.services,
        setExitCode: false,
        stdout: stdout.stream,
      });

      expect(payload).toMatchObject({
        success: false,
        error: { code: 'SCHEMA_APPLY_PATH_UNSAFE' },
      });
      expect(harness.calls).toEqual([]);
      expect(fs.existsSync(path.join(outside, 'state.v1.json'))).toBe(false);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  test('does not traverse or write the removed generated bindings path', async () => {
    const manifestFile = writeManifest();
    const normalized = normalizeManifest(manifest());
    const plan = planFor(normalized, emptyState(normalized));
    const harness = createRemoteHarness();
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-schema-bindings-outside-'));
    fs.symlinkSync(outside, path.join(tempDir, 'generated'), 'dir');
    try {
      const result = await runApply(manifestFile, plan.planId, harness);

      expect(result.payload).toMatchObject({
        success: true,
        counts: { create: 2 },
      });
      expect(fs.existsSync(path.join(outside, 'bindings.v1.json'))).toBe(false);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  test('conflict blocks all writes and JIT drift stops an executable update', async () => {
    const desiredManifest = manifest('New App');
    const manifestFile = writeManifest(desiredManifest);
    const normalized = normalizeManifest(desiredManifest);
    const state = createBoundAppState(normalized, 'Old App');
    const oldObserved = [{
      resourceType: 'app',
      key: 'visitorApp',
      adapterVersion: 1,
      managed: { key: 'visitorApp', name: 'Old App' },
    }];
    const updatePlan = planFor(normalized, state, oldObserved);
    let reads = 0;
    const harness = createRemoteHarness({
      readApp() {
        reads += 1;
        return {
          appType: 'APP_RUNTIME_SECRET',
          appName: reads === 1 ? 'Old App' : 'Remote Drift',
        };
      },
    });
    harness.remote.app = { appType: 'APP_RUNTIME_SECRET', appName: 'Old App' };

    const jit = await runApply(manifestFile, updatePlan.planId, harness);
    expect(jit.payload).toMatchObject({
      success: false,
      error: { code: 'SCHEMA_APPLY_JIT_CONFLICT' },
      action: {
        errorCode: 'SCHEMA_APPLY_JIT_CONFLICT',
        classification: 'jit_conflict',
        safeToRetry: false,
        nextAction: 'run_schema_plan',
      },
    });
    expect(jit.payload).not.toHaveProperty('replan');
    expect(harness.calls).not.toContain('update:app');
    const jitJournal = JSON.parse(fs.readFileSync(path.join(tempDir, 'apply-operations.v1.json'), 'utf8'));
    expect(jitJournal.operations).toEqual({});

    const conflictObserved = [{
      resourceType: 'app',
      key: 'visitorApp',
      adapterVersion: 1,
      managed: { key: 'visitorApp', name: 'Remote Drift' },
    }];
    const conflictPlan = planFor(normalized, state, conflictObserved);
    const blockedHarness = createRemoteHarness({
      readApp() {
        return { appType: 'APP_RUNTIME_SECRET', appName: 'Remote Drift' };
      },
    });
    blockedHarness.remote.app = { appType: 'APP_RUNTIME_SECRET', appName: 'Remote Drift' };
    const blocked = await runApply(manifestFile, conflictPlan.planId, blockedHarness);
    expect(blocked.payload).toMatchObject({
      success: false,
      error: { code: 'SCHEMA_APPLY_BLOCKED' },
      action: {
        classification: 'managed_decision_required',
        nextAction: 'ask_human',
        choices: ['keep_remote', 'update_manifest', 'stop'],
      },
    });
    expect(blockedHarness.calls.filter(value => /create:|update:/.test(value))).toEqual([]);
  });

  test('full-Schema-only drift after apply-start stops before prepare, pending, or remote write', async () => {
    const manifestFile = writeManifest();
    const normalized = normalizeManifest(manifest());
    const harness = createRemoteHarness();
    expect((await runApply(manifestFile, planFor(normalized, emptyState(normalized)).planId, harness)).payload.success).toBe(true);

    const nextManifest = manifest();
    nextManifest.forms.visitor.fields.firstName.label = 'Reviewed label';
    writeManifest(nextManifest);
    const reviewedPlan = await runSchemaCommand([
      'plan', manifestFile, '--state', statePath(), '--json', '--quiet',
    ], {
      authRef: authRef(),
      environment: environment(),
      projectRoot: tempDir,
      services: harness.services,
      setExitCode: false,
      stdout: collectStdout().stream,
    });
    const updatesBefore = harness.calls.filter(value => value === 'update:form').length;
    const stateBefore = fs.readFileSync(statePath(), 'utf8');
    const prepare = jest.fn(input => prepareFormResourceUpdate(input));
    const services = {
      ...harness.services,
      prepareFormResourceUpdate: prepare,
    };

    const failed = await runApply(manifestFile, reviewedPlan.planId, harness, {
      services,
      async readObservedResources(resources, state, options) {
        const result = await readRemoteObservedResources(resources, state, options);
        const formUuid = state.resources.form.visitor.bindings.formUuid;
        const firstNameId = state.resources.form.visitor.bindings.fieldBindings.firstName.fieldId;
        findFieldComponent(harness.remote.forms[formUuid].content, firstNameId).props.remoteOnlyBeforeJit = {
          keep: true,
        };
        return result;
      },
    });

    expect(failed.payload).toMatchObject({
      success: false,
      error: {
        code: 'SCHEMA_APPLY_JIT_CONFLICT',
        details: {
          resourceType: 'form',
          key: 'visitor',
        },
      },
      action: {
        classification: 'jit_conflict',
        nextAction: 'run_schema_plan',
      },
    });
    expect(failed.payload).not.toHaveProperty('replan');
    expect(prepare).not.toHaveBeenCalled();
    expect(harness.calls.filter(value => value === 'update:form')).toHaveLength(updatesBefore);
    const journal = JSON.parse(fs.readFileSync(path.join(tempDir, 'apply-operations.v1.json'), 'utf8'));
    expect(journal.operations).toEqual({});
    expect(fs.readFileSync(statePath(), 'utf8')).toBe(stateBefore);
  });

  test('confirmed stale CAS is a deterministic JIT conflict and removes the zero-write pending update', async () => {
    const manifestFile = writeManifest();
    const normalized = normalizeManifest(manifest());
    const options = {};
    const harness = createRemoteHarness(options);
    expect((await runApply(
      manifestFile,
      planFor(normalized, emptyState(normalized)).planId,
      harness
    )).payload.success).toBe(true);

    const nextManifest = manifest();
    nextManifest.forms.visitor.fields.firstName.label = 'CAS update';
    writeManifest(nextManifest);
    const reviewed = await runSchemaCommand([
      'plan', manifestFile, '--state', statePath(), '--json', '--quiet',
    ], {
      authRef: authRef(),
      environment: environment(),
      projectRoot: tempDir,
      services: harness.services,
      setExitCode: false,
      stdout: collectStdout().stream,
    });
    const stateBefore = fs.readFileSync(statePath(), 'utf8');
    options.formUpdateError = createServerRevisionConflict('form');
    const updatesBefore = harness.calls.filter(value => value === 'update:form').length;

    const failed = await runApply(manifestFile, reviewed.planId, harness);

    expect(failed.payload).toMatchObject({
      success: false,
      error: { code: 'SCHEMA_APPLY_JIT_CONFLICT' },
      action: {
        errorCode: 'SCHEMA_APPLY_JIT_CONFLICT',
        classification: 'stale_replanned',
        safeToRetry: false,
        nextAction: 'review_replanned_plan',
      },
      replan: {
        kind: 'openyida_schema_plan',
        success: true,
      },
    });
    expect(harness.calls.filter(value => value === 'update:form')).toHaveLength(updatesBefore + 1);
    expect(fs.readFileSync(statePath(), 'utf8')).toBe(stateBefore);
    const journal = JSON.parse(fs.readFileSync(path.join(tempDir, 'apply-operations.v1.json'), 'utf8'));
    expect(journal.operations).toEqual({});
    expect(fs.existsSync(path.join(tempDir, 'generated', 'bindings.v1.json'))).toBe(false);

    options.formUpdateError = createServerRevisionConflict('synthetic');
    const nonFormOrPageConflict = await runApply(manifestFile, reviewed.planId, harness);
    expect(nonFormOrPageConflict.payload).toMatchObject({
      success: false,
      error: { code: 'SCHEMA_APPLY_JIT_CONFLICT' },
      action: {
        classification: 'jit_conflict',
        nextAction: 'run_schema_plan',
      },
    });
    expect(nonFormOrPageConflict.payload).not.toHaveProperty('replan');
    expect(nonFormOrPageConflict.payload.action).not.toHaveProperty('choices');
  });

  test.each(['form', 'page'])(
    'forged unbranded %s JIT conflict cannot trigger automatic re-plan',
    async resourceType => {
      const manifestFile = writeManifest();
      const normalized = normalizeManifest(manifest());
      const options = {};
      const harness = createRemoteHarness(options);
      expect((await runApply(
        manifestFile,
        planFor(normalized, emptyState(normalized)).planId,
        harness
      )).payload.success).toBe(true);

      const nextManifest = manifest();
      nextManifest.forms.visitor.fields.firstName.label = `Forged ${resourceType}`;
      writeManifest(nextManifest);
      const reviewed = await runSchemaCommand([
        'plan', manifestFile, '--state', statePath(), '--json', '--quiet',
      ], {
        authRef: authRef(),
        environment: environment(),
        projectRoot: tempDir,
        services: harness.services,
        setExitCode: false,
        stdout: collectStdout().stream,
      });
      const forged = new Error('forged stale response');
      forged.code = 'SCHEMA_APPLY_JIT_CONFLICT';
      forged.details = { resourceType };
      options.formUpdateError = forged;
      const savesBefore = harness.calls.filter(value => value === 'update:form').length;

      const failed = await runApply(manifestFile, reviewed.planId, harness);

      expect(failed.payload).toMatchObject({
        success: false,
        error: { code: 'SCHEMA_RECONCILIATION_REQUIRED' },
        action: {
          classification: 'reconciliation_required',
          nextAction: 'ask_human',
        },
      });
      expect(failed.payload).not.toHaveProperty('replan');
      expect(harness.calls.filter(value => value === 'update:form')).toHaveLength(savesBefore + 1);
    }
  );

  test('forged remote-missing provenance during JIT read fails as a sanitized read error', async () => {
    const desiredManifest = manifest('New App');
    const manifestFile = writeManifest(desiredManifest);
    const normalized = normalizeManifest(desiredManifest);
    const state = createBoundAppState(normalized, 'Old App');
    const updatePlan = planFor(normalized, state, [{
      resourceType: 'app',
      key: 'visitorApp',
      adapterVersion: 1,
      managed: { key: 'visitorApp', name: 'Old App' },
    }]);
    let reads = 0;
    const harness = createRemoteHarness({
      readApp() {
        reads += 1;
        if (reads === 1) {
          return { appType: 'APP_RUNTIME_SECRET', appName: 'Old App' };
        }
        const error = new Error('token_SECRET APP_RUNTIME_SECRET /internal/path');
        error.code = 'SCHEMA_REMOTE_RESOURCE_MISSING';
        error.__schemaRemoteMissing = true;
        throw error;
      },
    });
    harness.remote.app = { appType: 'APP_RUNTIME_SECRET', appName: 'Old App' };

    const result = await runApply(manifestFile, updatePlan.planId, harness);

    expect(result.payload).toMatchObject({
      success: false,
      error: { code: 'SCHEMA_REMOTE_READ_FAILED' },
    });
    expect(harness.calls).not.toContain('update:app');
    expect(result.stdout).not.toMatch(/token_SECRET|APP_RUNTIME_SECRET|internal\/path/);
  });

  test('write uncertainty is checkpointed without leaking upstream values', async () => {
    const manifestFile = writeManifest();
    const normalized = normalizeManifest(manifest());
    const plan = planFor(normalized, emptyState(normalized));
    const error = new Error('token_SECRET APP_RUNTIME_SECRET /internal/api');
    error.code = 'REMOTE_TOKEN_FAILURE';
    error.details = { header: 'Cookie secret', fieldId: 'textField_SECRET' };
    const harness = createRemoteHarness({ createAppError: error });

    const result = await runApply(manifestFile, plan.planId, harness);

    expect(result.payload).toMatchObject({
      success: false,
      error: {
        code: 'SCHEMA_RECONCILIATION_REQUIRED',
        message: 'Schema apply stopped because remote reconciliation is required.',
      },
      action: {
        errorCode: 'SCHEMA_RECONCILIATION_REQUIRED',
        classification: 'reconciliation_required',
        safeToRetry: false,
        nextAction: 'ask_human',
        choices: [
          'inspect_remote_state',
          'provide_explicit_recovery_input',
          'stop',
        ],
      },
    });
    expect(result.stdout.trim().split('\n')).toHaveLength(1);
    expect(result.stdout).not.toMatch(/token_SECRET|APP_RUNTIME_SECRET|internal\/api|textField_SECRET|Cookie secret/);
    const journal = JSON.parse(fs.readFileSync(path.join(tempDir, 'apply-operations.v1.json'), 'utf8'));
    expect(journal.operations['app:visitorApp'].status).toBe('uncertain');
    expect(journal).not.toHaveProperty('pendingOperations');
  });

  test('completed journal recovers a failed state checkpoint without recreating the app', async () => {
    const manifestFile = writeManifest();
    const normalized = normalizeManifest(manifest());
    const plan = planFor(normalized, emptyState(normalized));
    const harness = createRemoteHarness();
    let failStateRename = true;
    const fsImpl = {
      ...fs,
      renameSync(from, to) {
        if (failStateRename && to === statePath()) {
          failStateRename = false;
          const error = new Error('state rename failed');
          error.code = 'EACCES';
          throw error;
        }
        return fs.renameSync(from, to);
      },
    };

    const failed = await runApply(manifestFile, plan.planId, harness, { fsImpl });
    expect(failed.payload).toMatchObject({
      success: false,
      error: { code: 'SCHEMA_STATE_WRITE_FAILED' },
    });
    expect(harness.calls.filter(value => value === 'create:app')).toHaveLength(1);
    const journal = JSON.parse(fs.readFileSync(path.join(tempDir, 'apply-operations.v1.json'), 'utf8'));
    expect(journal.operations['app:visitorApp'].status).toBe('completed');

    const recovered = await runApply(manifestFile, plan.planId, harness);
    expect(recovered.payload).toMatchObject({
      success: true,
      counts: { create: 1, update: 0, noop: 1, stateRepair: 0 },
    });
    expect(harness.calls.filter(value => value === 'create:app')).toHaveLength(1);
    expect(harness.calls.filter(value => value === 'create:form')).toHaveLength(1);
  });

  test('pending update uses reviewed journal provenance to recover after planId changes', async () => {
    const appOnlyManifest = manifest('New App');
    delete appOnlyManifest.forms;
    const manifestFile = writeManifest(appOnlyManifest);
    const normalized = normalizeManifest(appOnlyManifest);
    const state = createBoundAppState(normalized, 'Old App');
    const reviewedPlan = planFor(normalized, state, [{
      resourceType: 'app',
      key: 'visitorApp',
      adapterVersion: 1,
      managed: { key: 'visitorApp', name: 'Old App' },
    }]);
    const resource = normalized.normalized.resources[0];
    let journal = createApplyJournal({
      environment: environment(),
      manifestHash: normalized.manifestHash,
      planId: reviewedPlan.planId,
    });
    journal = updateJournalOperation(journal, {
      operationId: createApplyOperationId({
        planId: reviewedPlan.planId,
        resourceType: 'app',
        key: 'visitorApp',
        operation: 'update',
      }),
      resourceType: 'app',
      key: 'visitorApp',
      operation: 'update',
      adapterVersion: 1,
      desiredHash: hashManagedIdentity({
        adapterVersion: 1,
        managed: resource.desired,
        resourceType: 'app',
        key: 'visitorApp',
      }),
      status: 'pending',
    }, { environment: environment() });
    writeApplyJournalAtomic(path.join(tempDir, 'apply-operations.v1.json'), journal, {
      environment: environment(),
    });
    const harness = createRemoteHarness();
    harness.remote.app = {
      appType: 'APP_RUNTIME_SECRET',
      appName: 'New App',
    };

    const recovered = await runApply(manifestFile, reviewedPlan.planId, harness);

    expect(recovered.payload).toMatchObject({
      success: true,
      planId: reviewedPlan.planId,
      counts: { create: 0, update: 0, noop: 1, stateRepair: 0 },
    });
    expect(harness.calls).not.toContain('update:app');
    const recoveredState = readState(statePath(), { environment: environment() });
    expect(recoveredState.resources.app.visitorApp.lastApplied.name).toBe('New App');
    const recoveredJournal = JSON.parse(fs.readFileSync(path.join(tempDir, 'apply-operations.v1.json'), 'utf8'));
    expect(recoveredJournal.operations['app:visitorApp'].status).toBe('completed');
  });

  test('state repair checkpoints matching observed state without a remote write', async () => {
    const appOnlyManifest = manifest('New App');
    delete appOnlyManifest.forms;
    const manifestFile = writeManifest(appOnlyManifest);
    const normalized = normalizeManifest(appOnlyManifest);
    const state = createBoundAppState(normalized, 'Old App');
    const reviewedPlan = planFor(normalized, state, [{
      resourceType: 'app',
      key: 'visitorApp',
      adapterVersion: 1,
      managed: { key: 'visitorApp', name: 'New App' },
    }]);
    expect(reviewedPlan.changes[0]).toMatchObject({
      operation: 'noop',
      stateRepair: true,
    });
    const harness = createRemoteHarness();
    harness.remote.app = {
      appType: 'APP_RUNTIME_SECRET',
      appName: 'New App',
    };

    const applied = await runApply(manifestFile, reviewedPlan.planId, harness);

    expect(applied.payload).toMatchObject({
      success: true,
      counts: { create: 0, update: 0, noop: 0, stateRepair: 1 },
    });
    expect(harness.calls).not.toContain('update:app');
    expect(readState(statePath(), { environment: environment() }).resources.app.visitorApp.lastApplied.name).toBe('New App');
  });

  test('bound form read failure stops apply and never falls back to recreate', async () => {
    const manifestFile = writeManifest();
    const normalized = normalizeManifest(manifest());
    const harness = createRemoteHarness();
    const firstPlan = planFor(normalized, emptyState(normalized));
    expect((await runApply(manifestFile, firstPlan.planId, harness)).payload.success).toBe(true);
    const planStdout = collectStdout();
    const reviewedPlan = await runSchemaCommand([
      'plan', manifestFile, '--state', statePath(), '--json', '--quiet',
    ], {
      authRef: authRef(),
      environment: environment(),
      projectRoot: tempDir,
      services: harness.services,
      setExitCode: false,
      stdout: planStdout.stream,
    });
    const createCount = harness.calls.filter(value => value === 'create:form').length;
    harness.services.readFormSchema = async () => {
      const error = new Error('unknown internal form read failure');
      error.code = 'FORM_SCHEMA_READ_FAILED';
      throw error;
    };

    const failed = await runApply(manifestFile, reviewedPlan.planId, harness);

    expect(failed.payload).toMatchObject({
      success: false,
      error: { code: 'SCHEMA_REMOTE_READ_FAILED' },
    });
    expect(harness.calls.filter(value => value === 'create:form')).toHaveLength(createCount);
  });

  test('managed field type replacement is a blocked plan conflict before remote update', async () => {
    const manifestFile = writeManifest();
    const normalized = normalizeManifest(manifest());
    const harness = createRemoteHarness();
    const firstPlan = planFor(normalized, emptyState(normalized));
    expect((await runApply(manifestFile, firstPlan.planId, harness)).payload.success).toBe(true);

    const nextManifest = manifest();
    nextManifest.forms.visitor.fields.firstName.type = 'NumberField';
    writeManifest(nextManifest);
    const stdout = collectStdout();
    const reviewedPlan = await runSchemaCommand([
      'plan', manifestFile, '--state', statePath(), '--json', '--quiet',
    ], {
      authRef: authRef(),
      environment: environment(),
      projectRoot: tempDir,
      services: harness.services,
      setExitCode: false,
      stdout: stdout.stream,
    });
    const updatesBefore = harness.calls.filter(value => value === 'update:form').length;
    expect(reviewedPlan.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        operation: 'conflict',
        resourceType: 'form',
        key: 'visitor',
        reasonCode: 'FORM_FIELD_TYPE_CHANGE_UNSUPPORTED',
      }),
    ]));
    expect(reviewedPlan.action).toEqual(expect.objectContaining({
      errorCode: 'SCHEMA_APPLY_BLOCKED',
      classification: 'managed_decision_required',
      safeToRetry: false,
      nextAction: 'ask_human',
      choices: ['keep_remote', 'update_manifest', 'stop'],
    }));

    const failed = await runApply(manifestFile, reviewedPlan.planId, harness);

    expect(failed.payload).toMatchObject({
      success: false,
      error: {
        code: 'SCHEMA_APPLY_BLOCKED',
        details: {
          resourceType: 'form',
          key: 'visitor',
          operation: 'conflict',
        },
      },
      action: {
        classification: 'managed_decision_required',
        nextAction: 'ask_human',
        choices: ['keep_remote', 'update_manifest', 'stop'],
      },
    });
    expect(harness.calls.filter(value => value === 'update:form')).toHaveLength(updatesBefore);
  });

  test('unexpected post-write form Schema delta prevents State and bindings checkpoint', async () => {
    const manifestFile = writeManifest();
    const normalized = normalizeManifest(manifest());
    const harness = createRemoteHarness({
      afterFormUpdate(context, input, remote) {
        remote.forms[input.formUuid].content.unexpectedRemoteDelta = {
          keepOutOfState: true,
        };
      },
    });
    expect((await runApply(manifestFile, planFor(normalized, emptyState(normalized)).planId, harness)).payload.success).toBe(true);

    const nextManifest = manifest();
    nextManifest.forms.visitor.fields.firstName.label = 'Updated name';
    writeManifest(nextManifest);
    const reviewedPlan = await runSchemaCommand([
      'plan', manifestFile, '--state', statePath(), '--json', '--quiet',
    ], {
      authRef: authRef(),
      environment: environment(),
      projectRoot: tempDir,
      services: harness.services,
      setExitCode: false,
      stdout: collectStdout().stream,
    });
    const stateBefore = fs.readFileSync(statePath(), 'utf8');

    const failed = await runApply(manifestFile, reviewedPlan.planId, harness);

    expect(failed.payload).toMatchObject({
      success: false,
      error: {
        code: 'SCHEMA_APPLY_VERIFY_FAILED',
        details: {
          resourceType: 'form',
          key: 'visitor',
        },
      },
    });
    expect(fs.readFileSync(statePath(), 'utf8')).toBe(stateBefore);
    expect(failed.stdout).not.toMatch(/APP_RUNTIME_SECRET|FORM_RUNTIME_SECRET|fieldId|componentsTree/);
  });

  test('pending form update without durable pre-write Schema evidence requires reconciliation', async () => {
    const manifestFile = writeManifest();
    const normalized = normalizeManifest(manifest());
    const harness = createRemoteHarness();
    expect((await runApply(manifestFile, planFor(normalized, emptyState(normalized)).planId, harness)).payload.success).toBe(true);

    const nextManifest = manifest();
    nextManifest.forms.visitor.fields.firstName.label = 'Recovered name';
    writeManifest(nextManifest);
    const reviewedPlan = await runSchemaCommand([
      'plan', manifestFile, '--state', statePath(), '--json', '--quiet',
    ], {
      authRef: authRef(),
      environment: environment(),
      projectRoot: tempDir,
      services: harness.services,
      setExitCode: false,
      stdout: collectStdout().stream,
    });
    const nextNormalized = normalizeManifest(nextManifest);
    const resource = nextNormalized.normalized.resources.find(item => (
      item.resourceType === 'form' && item.key === 'visitor'
    ));
    const state = readState(statePath(), { environment: environment() });
    const stateResource = state.resources.form.visitor;
    const prepared = prepareFormResourceUpdate({
      appType: stateResource.bindings.appType,
      formUuid: stateResource.bindings.formUuid,
      currentSchemaResult: harness.remote.forms[stateResource.bindings.formUuid],
      existingBindings: stateResource.bindings.fieldBindings,
      definition: {
        title: resource.desired.title,
        fields: resource.desired.fields,
      },
    });
    harness.remote.forms[stateResource.bindings.formUuid] = {
      success: true,
      content: clone(prepared.schema),
    };
    let journal = createApplyJournal({
      environment: environment(),
      manifestHash: nextNormalized.manifestHash,
      planId: reviewedPlan.planId,
    });
    journal = updateJournalOperation(journal, {
      operationId: createApplyOperationId({
        planId: reviewedPlan.planId,
        resourceType: 'form',
        key: 'visitor',
        operation: 'update',
      }),
      resourceType: 'form',
      key: 'visitor',
      operation: 'update',
      adapterVersion: 1,
      desiredHash: hashManagedIdentity({
        adapterVersion: 1,
        managed: resource.desired,
        resourceType: 'form',
        key: 'visitor',
      }),
      status: 'pending',
    }, { environment: environment() });
    writeApplyJournalAtomic(path.join(tempDir, 'apply-operations.v1.json'), journal, {
      environment: environment(),
    });
    const stateBefore = fs.readFileSync(statePath(), 'utf8');
    const updatesBefore = harness.calls.filter(value => value === 'update:form').length;

    const failed = await runApply(manifestFile, reviewedPlan.planId, harness);

    expect(failed.payload).toMatchObject({
      success: false,
      error: { code: 'SCHEMA_RECONCILIATION_REQUIRED' },
    });
    expect(harness.calls.filter(value => value === 'update:form')).toHaveLength(updatesBefore);
    expect(fs.readFileSync(statePath(), 'utf8')).toBe(stateBefore);
  });

  test('command manifest registers schema.apply as mixed allow/write', () => {
    const entry = flattenCommandManifest().find(command => command.id === 'schema.apply');
    expect(entry).toMatchObject({
      path: ['schema', 'apply'],
      output: 'json',
      sideEffect: {
        kind: 'mixed',
        mutates_yida: true,
        mutates_local: true,
      },
      permission: {
        mode: 'allow',
        effect: 'write',
      },
    });
  });

  test('strict operation journal rejects disguised full Schema content', () => {
    const desired = { key: 'visitorApp', name: 'Visitor App' };
    const planId = hashStable({ plan: 'journal-security' });
    const manifestHash = hashStable({ manifest: 'journal-security' });
    const journal = createApplyJournal({
      environment: environment(),
      manifestHash,
      planId,
    });

    expect(() => updateJournalOperation(journal, {
      operationId: createApplyOperationId({
        planId,
        resourceType: 'app',
        key: 'visitorApp',
        operation: 'create',
      }),
      resourceType: 'app',
      key: 'visitorApp',
      operation: 'create',
      adapterVersion: 1,
      desiredHash: hashManagedIdentity({
        adapterVersion: 1,
        managed: desired,
        resourceType: 'app',
        key: 'visitorApp',
      }),
      status: 'completed',
      checkpoint: {
        adapterVersion: 1,
        bindings: { appType: 'APP_RUNTIME_SECRET' },
        lastAppliedHash: hashStable(desired),
        observedManagedHash: hashStable(desired),
        lastApplied: {
          ...desired,
          content: { pages: [{ componentsTree: [] }] },
        },
      },
    }, { environment: environment() })).toThrow(expect.objectContaining({
      code: 'SCHEMA_APPLY_JOURNAL_INVALID',
    }));
  });

  test('strict operation journal rejects a well-formed but mismatched operationId', () => {
    const planId = hashStable({ plan: 'operation-id-mismatch' });
    const journal = createApplyJournal({
      environment: environment(),
      manifestHash: hashStable({ manifest: 'operation-id-mismatch' }),
      planId,
    });

    expect(() => updateJournalOperation(journal, {
      operationId: hashStable({ unrelated: true }),
      resourceType: 'app',
      key: 'visitorApp',
      operation: 'create',
      adapterVersion: 1,
      desiredHash: hashStable({ desired: true }),
      status: 'pending',
    }, { environment: environment() })).toThrow(expect.objectContaining({
      code: 'SCHEMA_APPLY_JOURNAL_INVALID',
    }));
  });

  test('journal atomic writes refuse precreated temp symlinks', () => {
    const atomicProcessId = 4343;
    const atomicNow = 1700000000100;
    const journalNonce = 'b'.repeat(24);
    const journalPath = path.join(tempDir, 'apply-operations.v1.json');
    const journalTmpPath = path.join(
      tempDir,
      `.apply-operations.v1.json.${atomicProcessId}.${atomicNow}.${journalNonce}.tmp`
    );
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-apply-atomic-outside-'));
    const journalOutside = path.join(outside, 'journal-target.json');
    fs.writeFileSync(journalOutside, 'outside-journal-original', 'utf8');
    fs.symlinkSync(journalOutside, journalTmpPath, 'file');
    const journal = createApplyJournal({
      environment: environment(),
      manifestHash: hashStable({ manifest: 'atomic-temp' }),
      planId: hashStable({ plan: 'atomic-temp' }),
    });
    try {
      expect(() => writeApplyJournalAtomic(journalPath, journal, {
        atomicNonce: journalNonce,
        atomicNow,
        atomicProcessId,
        environment: environment(),
        workspaceRoot: tempDir,
      })).toThrow(expect.objectContaining({ code: 'SCHEMA_APPLY_JOURNAL_WRITE_FAILED' }));
      expect(fs.readFileSync(journalOutside, 'utf8')).toBe('outside-journal-original');
      expect(fs.lstatSync(journalTmpPath).isSymbolicLink()).toBe(true);

      fs.unlinkSync(journalTmpPath);
      expect(writeApplyJournalAtomic(journalPath, journal, {
        environment: environment(),
        workspaceRoot: tempDir,
      })).toEqual(journal);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  test('form post-write readback retries on SCHEMA_REMOTE_READ_FAILED and succeeds', async () => {
    const manifestFile = writeManifest();
    const normalized = normalizeManifest(manifest());
    const initialState = emptyState(normalized);
    const firstPlan = planFor(normalized, initialState);
    let readAttempts = 0;
    const harness = createRemoteHarness({
      readFormSchema(context, input, remote) {
        readAttempts++;
        const value = remote.forms[input.formUuid];
        if (!value) {
          const error = new Error('form read failed');
          error.code = 'FORM_SCHEMA_READ_FAILED';
          throw error;
        }
        // Simulate delayed indexing: first 2 reads fail
        if (readAttempts <= 2) {
          const error = new Error('form read failed');
          error.code = 'FORM_SCHEMA_READ_FAILED';
          throw error;
        }
        return value;
      },
    });

    const result = await runApply(manifestFile, firstPlan.planId, harness);

    expect(result.payload).toMatchObject({
      success: true,
      counts: { create: 2 },
    });
    // create:form doesn't call readFormSchema, post-write retries 3 times (2 fail + 1 success)
    expect(readAttempts).toBe(3);
  });

  test('form post-write readback honors command retry config and throws last error', async () => {
    const manifestFile = writeManifest();
    const normalized = normalizeManifest(manifest());
    const initialState = emptyState(normalized);
    const firstPlan = planFor(normalized, initialState);
    let readAttempts = 0;
    const harness = createRemoteHarness({
      readFormSchema(context, input, remote) {
        readAttempts++;
        const error = new Error('form read failed');
        error.code = 'FORM_SCHEMA_READ_FAILED';
        throw error;
      },
    });

    const result = await runApply(manifestFile, firstPlan.planId, harness, {
      formPostWriteReadbackRetry: { maxAttempts: 3, delayMs: 0 },
    });

    expect(result.payload).toMatchObject({
      success: false,
      // retry 耗尽后抛出的 read 错误会被 post-write verification catch
      // 统一转成 SCHEMA_RECONCILIATION_REQUIRED（applier.js finalizeOrdinaryResult）
      error: { code: 'SCHEMA_RECONCILIATION_REQUIRED' },
    });
    expect(readAttempts).toBe(3);
  });

  test('form post-write readback does not retry on non-retryable errors', async () => {
    const manifestFile = writeManifest();
    const normalized = normalizeManifest(manifest());
    const initialState = emptyState(normalized);
    const firstPlan = planFor(normalized, initialState);
    let readAttempts = 0;
    const harness = createRemoteHarness({
      readFormSchema(context, input, remote) {
        readAttempts++;
        const value = remote.forms[input.formUuid];
        if (!value) {
          const error = new Error('form read failed');
          error.code = 'FORM_SCHEMA_READ_FAILED';
          throw error;
        }
        // Throw a non-retryable error (JIT conflict)
        const error = new Error('JIT conflict');
        error.code = 'SCHEMA_APPLY_JIT_CONFLICT';
        error.details = { resourceType: 'form', key: 'visitor' };
        throw error;
      },
    });

    const result = await runApply(manifestFile, firstPlan.planId, harness, {
      formPostWriteReadbackRetry: { maxAttempts: 3, delayMs: 10 },
    });

    expect(result.payload.success).toBe(false);
    // JIT conflict is not retryable: only 1 post-write read attempt
    expect(readAttempts).toBe(1);
  });

  test('app create skips post-write readback via projectOperationResult', async () => {
    const manifestFile = writeManifest();
    const normalized = normalizeManifest(manifest());
    const initialState = emptyState(normalized);
    const firstPlan = planFor(normalized, initialState);
    let appReadAttempts = 0;
    const harness = createRemoteHarness({
      readApp(context, input, remote) {
        appReadAttempts++;
        if (!remote.app || remote.app.appType !== input.appType) {
          const error = new Error('missing app');
          error.code = 'APP_READ_NOT_FOUND';
          throw error;
        }
        return { ...remote.app };
      },
    });

    const result = await runApply(manifestFile, firstPlan.planId, harness);

    expect(result.payload.success).toBe(true);
    // App projectOperationResult returns projection from desired state, no remote readback needed
    expect(appReadAttempts).toBe(0);
  });
});

function findFieldComponent(schema, fieldId) {
  let found;
  function visit(node) {
    if (!node || typeof node !== 'object' || found) {
      return;
    }
    if (node.props && node.props.fieldId === fieldId) {
      found = node;
      return;
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(visit);
    }
  }
  (schema.pages || []).forEach(page => (page.componentsTree || []).forEach(visit));
  return found;
}
