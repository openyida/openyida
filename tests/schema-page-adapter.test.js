'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { applySchema } = require('../lib/schema/applier');
const { run: runSchemaCommand } = require('../lib/schema/command');
const {
  buildDefaultPageDataSource,
} = require('../lib/app/services/native-page-schema-builder');
const { normalizeManifest } = require('../lib/schema/normalize-manifest');
const { createPlan, hashManagedIdentity, selectObservableResources } = require('../lib/schema/planner');
const { readObservedResources } = require('../lib/schema/remote-reader');
const { createDefaultRegistry } = require('../lib/schema/resource-registry');
const {
  computeDataSourceOnlyShellFingerprint,
  createDataSourceOnlyShellProfile,
} = require('../lib/schema/page-data-source-builder');
const {
  createEmptyState,
  hashStable,
  readState,
  upsertResourceState,
  writeStateAtomic,
} = require('../lib/schema/state-store');
const { createServerRevisionConflict } = require('../lib/schema/server-revision');

const SOURCE_ONE = 'export default function Page() { return <div>One</div>; }\n';
const SOURCE_TWO = 'export default function Page() { return <div>Two</div>; }\n';
const CANVAS_SOURCE_ONE = 'import React from "react";\nexport default function Page() { return <div>Canvas one</div>; }\n';
const CANVAS_SOURCE_TWO = 'import React from "react";\nexport default function Page() { return <div>Canvas two</div>; }\n';

describe('minimal page resource adapter lifecycle', () => {
  let calls;
  let environment;
  let initialProfile;
  let registry;
  let remotePage;
  let services;
  let saveError;
  let statePath;
  let workspace;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-page-adapter-'));
    statePath = path.join(workspace, '.cache', 'openyida', 'state.v1.json');
    environment = { endpoint: 'https://example.test', corpId: 'corp-page' };
    registry = createDefaultRegistry();
    calls = { create: 0, read: 0, save: 0 };
    const initialSchema = makeInitialShell();
    initialProfile = createDataSourceOnlyShellProfile({
      fingerprint: computeDataSourceOnlyShellFingerprint(initialSchema),
      profileId: 'synthetic-page-adapter-shell-v1',
    });
    remotePage = null;
    saveError = null;
    services = {
      pageInitialShellProfile: initialProfile,
      readApp: jest.fn(async () => ({ appName: 'Demo' })),
      createPageShellOnce: jest.fn(async (context, input) => {
        calls.create += 1;
        remotePage = {
          appType: input.appType,
          formUuid: 'FORM-SYNTHETIC-PAGE',
          observedFormType: 'display',
          observedTitle: input.title,
          schema: makeInitialShell(),
        };
        return { appType: remotePage.appType, formUuid: remotePage.formUuid };
      }),
      readPageResource: jest.fn(async (context, binding) => {
        calls.read += 1;
        if (!remotePage || binding.appType !== remotePage.appType || binding.formUuid !== remotePage.formUuid) {
          throw new Error('page missing');
        }
        return clone(remotePage);
      }),
      savePageSchemaOnce: jest.fn(async (context, input) => {
        calls.save += 1;
        if (saveError) {
          throw saveError;
        }
        remotePage.schema = clone(input.schema);
        remotePage.schema.gmtModified = 101;
        return { success: true };
      }),
    };
    writeSource(SOURCE_ONE);
  });

  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  test('normalizes page source and registers page in stable dependency order', () => {
    const normalized = normalize();
    const page = normalized.normalized.resources.find(resource => resource.resourceType === 'page');

    expect(registry.listTypes()).toEqual(['app', 'form', 'page', 'process']);
    expect(page).toMatchObject({
      key: 'home',
      source: 'pages/home.oyd.jsx',
      dependsOn: ['app:demoApp'],
      desired: {
        formType: 'display',
        profile: 'native/default',
        title: 'Home',
        sourceHash: expect.stringMatching(/^sha256:/),
        compiledHash: expect.stringMatching(/^sha256:/),
      },
    });
  });

  test('normalizes Canvas page source under a separate profile', () => {
    writeCanvasSource(CANVAS_SOURCE_ONE);
    const normalized = normalize('Home', 'pages/home.canvas.jsx');
    const page = normalized.normalized.resources.find(resource => resource.resourceType === 'page');

    expect(page).toMatchObject({
      key: 'home',
      source: 'pages/home.canvas.jsx',
      dependsOn: ['app:demoApp'],
      desired: {
        formType: 'display',
        profile: 'canvas/default',
        title: 'Home',
        sourceHash: expect.stringMatching(/^sha256:/),
        compiledHash: expect.stringMatching(/^sha256:/),
      },
    });
  });

  test('strict State validation rejects incomplete page identity bindings', () => {
    const state = createEmptyState(environment, { registry });
    expect(() => upsertResourceState(state, {
      resourceType: 'page',
      key: 'home',
      adapterVersion: 1,
      bindings: {},
    }, { registry })).toThrow(expect.objectContaining({
      code: 'SCHEMA_STATE_INVALID',
    }));
  });

  test('creates, identity-checkpoints, saves, exact-readbacks, and commits page State', async () => {
    const normalized = normalize();
    const state = writeAppState(normalized);
    const plan = await planFor(normalized, state);

    const result = await runApply(normalized, plan.planId);

    expect(result).toMatchObject({ success: true, counts: { create: 1, noop: 1 } });
    expect(calls).toEqual({ create: 1, read: 2, save: 1 });
    const persisted = readState(statePath, { environment, registry });
    expect(persisted.resources.page.home).toMatchObject({
      bindings: {
        appType: 'APP-SYNTHETIC',
        formUuid: 'FORM-SYNTHETIC-PAGE',
      },
      lastApplied: normalized.normalized.resources.find(resource => resource.resourceType === 'page').desired,
    });
  });

  test('plans noop after read-only exact observation and updates only managed source', async () => {
    const first = normalize();
    const firstState = writeAppState(first);
    const firstPlan = await planFor(first, firstState);
    await runApply(first, firstPlan.planId);

    const committed = readState(statePath, { environment, registry });
    const noopPlan = await planFor(first, committed);
    expect(noopPlan.changes.find(change => change.resourceType === 'page')).toMatchObject({
      operation: 'noop',
    });

    const preserved = { serverOnly: { enabled: true } };
    remotePage.schema.serverOnly = clone(preserved.serverOnly);
    writeSource(SOURCE_TWO);
    const second = normalize();
    const updatePlan = await planFor(second, committed);
    expect(updatePlan.changes.find(change => change.resourceType === 'page')).toMatchObject({
      operation: 'update',
      reasonCode: 'PAGE_SOURCE_CHANGED',
    });

    const result = await runApply(second, updatePlan.planId);
    expect(result.counts.update).toBe(1);
    expect(calls.create).toBe(1);
    expect(calls.save).toBe(2);
    expect(remotePage.schema.serverOnly).toEqual(preserved.serverOnly);
  });

  test('creates and updates Canvas pages without rediscovering or duplicating remote identity', async () => {
    writeCanvasSource(CANVAS_SOURCE_ONE);
    const first = normalize('Home', 'pages/home.canvas.jsx');
    const firstState = writeAppState(first);
    const firstPlan = await planFor(first, firstState);

    const created = await runApply(first, firstPlan.planId);

    expect(created).toMatchObject({ success: true, counts: { create: 1, noop: 1 } });
    expect(calls).toEqual({ create: 1, read: 2, save: 1 });
    expect(remotePage.schema.pages[0].componentsTree[0].children[0]).toMatchObject({
      componentName: 'YidaCodeCanvas',
      props: {
        code: CANVAS_SOURCE_ONE,
        runtimeCode: expect.stringContaining('YidaComp'),
        importedModules: expect.any(String),
      },
    });

    const committed = readState(statePath, { environment, registry });
    expect(committed.resources.page.home).toMatchObject({
      bindings: {
        appType: 'APP-SYNTHETIC',
        formUuid: 'FORM-SYNTHETIC-PAGE',
      },
      lastApplied: first.normalized.resources.find(resource => resource.resourceType === 'page').desired,
    });

    remotePage.schema.serverOnly = { enabled: true };
    writeCanvasSource(CANVAS_SOURCE_TWO);
    const second = normalize('Home', 'pages/home.canvas.jsx');
    const updatePlan = await planFor(second, committed);
    expect(updatePlan.changes.find(change => change.resourceType === 'page')).toMatchObject({
      operation: 'update',
      reasonCode: 'PAGE_SOURCE_CHANGED',
    });

    const updated = await runApply(second, updatePlan.planId);

    expect(updated.counts.update).toBe(1);
    expect(calls.create).toBe(1);
    expect(calls.save).toBe(2);
    expect(remotePage.schema.serverOnly).toEqual({ enabled: true });
    expect(remotePage.schema.pages[0].componentsTree[0].children[0].props.code).toBe(CANVAS_SOURCE_TWO);
  });

  test('title update is a stable conflict and performs zero page writes', async () => {
    const first = normalize();
    const firstState = writeAppState(first);
    await runApply(first, (await planFor(first, firstState)).planId);
    const committed = readState(statePath, { environment, registry });
    const changed = normalize('Changed title');

    const plan = await planFor(changed, committed);

    expect(plan.changes.find(change => change.resourceType === 'page')).toMatchObject({
      operation: 'conflict',
      reasonCode: 'PAGE_TITLE_UPDATE_UNSUPPORTED',
    });
    expect(calls.create).toBe(1);
    expect(calls.save).toBe(1);
  });

  test('confirmed stale CAS leaves State unchanged and no uncertain journal operation', async () => {
    const first = normalize();
    const firstState = writeAppState(first);
    await runApply(first, (await planFor(first, firstState)).planId);
    const committed = readState(statePath, { environment, registry });
    const stateBefore = fs.readFileSync(statePath, 'utf8');
    writeSource(SOURCE_TWO);
    const changed = normalize();
    const reviewed = await planFor(changed, committed);
    const savesBefore = calls.save;
    saveError = createServerRevisionConflict('page');

    await expect(runApply(changed, reviewed.planId)).rejects.toMatchObject({
      code: 'SCHEMA_APPLY_JIT_CONFLICT',
    });

    expect(calls.save).toBe(savesBefore + 1);
    expect(fs.readFileSync(statePath, 'utf8')).toBe(stateBefore);
    const journal = JSON.parse(fs.readFileSync(
      path.join(path.dirname(statePath), 'apply-operations.v1.json'),
      'utf8'
    ));
    expect(journal.operations).toEqual({});
  });

  test('schema command auto-replans a branded page CAS once without retrying save', async () => {
    const first = normalize();
    const firstState = writeAppState(first);
    await runApply(first, (await planFor(first, firstState)).planId);
    const committed = readState(statePath, { environment, registry });
    writeSource(SOURCE_TWO);
    const changed = normalize();
    const reviewed = await planFor(changed, committed);
    const manifestPath = writeManifest();
    const stdout = collectStdout();
    const savesBefore = calls.save;
    const previousExitCode = process.exitCode;
    saveError = createServerRevisionConflict('page');

    try {
      process.exitCode = undefined;
      const result = await runSchemaCommand([
        'apply', manifestPath,
        '--state', statePath,
        '--plan-id', reviewed.planId,
        '--json', '--quiet',
      ], {
        environment,
        projectRoot: workspace,
        registry,
        services,
        setExitCode: true,
        stdout: stdout.stream,
      });

      expect(result).toMatchObject({
        success: false,
        error: { code: 'SCHEMA_APPLY_JIT_CONFLICT' },
        action: {
          classification: 'stale_replanned',
          nextAction: 'review_replanned_plan',
        },
        replan: {
          kind: 'openyida_schema_plan',
          success: true,
        },
      });
      expect(calls.save).toBe(savesBefore + 1);
      expect(stdout.value().trim().split('\n')).toHaveLength(1);
      expect(JSON.parse(stdout.value())).toEqual(result);
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = previousExitCode;
    }
  });

  test('apply without write-ready auth or injected page services fails before State and journal', async () => {
    const normalized = normalize();
    const state = writeAppState(normalized);
    const plan = await planFor(normalized, state);
    const before = fs.readFileSync(statePath, 'utf8');
    const journalPath = path.join(path.dirname(statePath), 'apply-operations.v1.json');

    await expect(applySchema({
      environment,
      expectedPlanId: plan.planId,
      loadDesired: async () => normalized,
      statePath,
      workspaceRoot: workspace,
    }, { fsImpl: fs, registry, services: {} })).rejects.toMatchObject({
      code: 'SCHEMA_PAGE_WRITE_PRECHECK_FAILED',
    });

    expect(fs.readFileSync(statePath, 'utf8')).toBe(before);
    expect(fs.existsSync(journalPath)).toBe(false);
    expect(calls).toEqual({ create: 0, read: 0, save: 0 });
  });

  async function planFor(normalized, state) {
    const resources = selectObservableResources(normalized.normalized.resources, state, { registry });
    const observed = await readObservedResources(resources, state, { registry, services });
    return createPlan({
      desiredResources: normalized.normalized.resources,
      manifestHash: normalized.manifestHash,
      observedResources: observed.resources,
      state,
    }, { registry });
  }

  function runApply(normalized, planId) {
    return applySchema({
      environment,
      expectedPlanId: planId,
      loadDesired: async () => normalized,
      statePath,
      workspaceRoot: workspace,
    }, { fsImpl: fs, registry, services });
  }

  function normalize(title = 'Home', source = 'pages/home.oyd.jsx') {
    return normalizeManifest(pageManifest(title, source), {
      fsImpl: fs,
      registry,
      workspaceRoot: workspace,
    });
  }

  function writeManifest(title = 'Home', source = 'pages/home.oyd.jsx') {
    const target = path.join(workspace, 'app.yida.json');
    fs.writeFileSync(target, JSON.stringify(pageManifest(title, source)), 'utf8');
    return target;
  }

  function pageManifest(title, source) {
    return {
      kind: 'openyida_app_manifest',
      schemaVersion: 1,
      app: { key: 'demoApp', name: 'Demo' },
      pages: {
        home: { title, source },
      },
    };
  }

  function writeAppState(normalized) {
    const app = normalized.normalized.resources.find(resource => resource.resourceType === 'app');
    let state = createEmptyState(environment, { manifestHash: normalized.manifestHash, registry });
    state = upsertResourceState(state, {
      resourceType: 'app',
      key: app.key,
      adapterVersion: 1,
      bindings: { appType: 'APP-SYNTHETIC' },
      lastApplied: app.desired,
      lastAppliedHash: hashStable(app.desired),
      observedManagedHash: hashManagedIdentity({
        adapterVersion: 1,
        key: app.key,
        managed: app.desired,
        resourceType: 'app',
      }),
    }, { registry });
    return writeStateAtomic(statePath, state, { environment, fsImpl: fs, registry });
  }

  function writeSource(content) {
    const target = path.join(workspace, 'pages', 'home.oyd.jsx');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  }

  function writeCanvasSource(content) {
    const target = path.join(workspace, 'pages', 'home.canvas.jsx');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  }
});

function makeInitialShell() {
  const defaults = buildDefaultPageDataSource('FORM-FOUNDATION');
  return {
    gmtModified: 100,
    i18nData: [],
    pages: [{ componentsTree: [{ dataSource: {
      globalConfig: clone(defaults.globalConfig),
      list: [],
      offline: [],
      online: [],
      sync: true,
    } }] }],
    status: 'ONLINE',
  };
}

function collectStdout() {
  let value = '';
  return {
    stream: { write(chunk) { value += chunk; } },
    value() { return value; },
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
