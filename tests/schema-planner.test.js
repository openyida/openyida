'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { compileFormDefinition } = require('../lib/app/services/form-compiler');
const { appAdapter } = require('../lib/schema/adapters/app-adapter');
const { formAdapter } = require('../lib/schema/adapters/form-adapter');
const { run: runSchemaCommand } = require('../lib/schema/command');
const { schemaError } = require('../lib/schema/errors');
const { normalizeManifest } = require('../lib/schema/normalize-manifest');
const { ResourceRegistry } = require('../lib/schema/resource-registry');
const {
  createEmptyState,
  hashStable,
  upsertResourceState,
  writeStateAtomic,
} = require('../lib/schema/state-store');
const {
  REASON_CODES,
  createPlan,
  selectObservableResources,
} = require('../lib/schema/planner');
const { flattenCommandManifest } = require('../lib/core/command-manifest');

let tempDir;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-schema-plan-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function environmentInput() {
  return {
    endpoint: 'https://example.test',
    corpId: 'corp-plan-test',
  };
}

function baseManifest() {
  return {
    kind: 'openyida_app_manifest',
    schemaVersion: 1,
    app: {
      key: 'visitorApp',
      name: 'Visitor App',
    },
    forms: {
      customer: {
        title: 'Customer',
        fields: {
          companyName: {
            type: 'TextField',
            label: 'Company name',
          },
        },
      },
      visitor: {
        title: 'Visitor',
        fields: {
          firstName: {
            type: 'TextField',
            label: 'First name',
            required: true,
          },
          status: {
            type: 'SelectField',
            label: 'Status',
            options: ['Draft', { label: 'Done label', value: 'done' }],
          },
          customerRef: {
            type: 'AssociationFormField',
            label: 'Customer',
            form: 'form:customer',
          },
        },
      },
    },
  };
}

function simpleManifest() {
  return {
    kind: 'openyida_app_manifest',
    schemaVersion: 1,
    app: {
      key: 'visitorApp',
      name: 'Visitor App',
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

function tableManifest() {
  return {
    kind: 'openyida_app_manifest',
    schemaVersion: 1,
    app: {
      key: 'visitorApp',
      name: 'Visitor App',
    },
    forms: {
      visitor: {
        title: 'Visitor',
        fields: {
          items: {
            type: 'TableField',
            label: 'Items',
            children: {
              itemName: {
                type: 'TextField',
                label: 'Item name',
              },
            },
          },
        },
      },
    },
  };
}

function normalize(manifest = baseManifest()) {
  return normalizeManifest(manifest);
}

function resourceId(resource) {
  return `${resource.resourceType}:${resource.key}`;
}

function findResource(normalizedResult, resourceType, key) {
  return normalizedResult.normalized.resources.find(resource => (
    resource.resourceType === resourceType && resource.key === key
  ));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createState(normalizedResult, options = {}) {
  let state = createEmptyState(options.environment || environmentInput(), {
    manifestHash: normalizedResult.manifestHash,
    registry: options.registry,
  });
  const omitted = new Set(options.omitLastApplied || []);
  const overrides = options.lastAppliedOverrides || {};

  for (const resource of normalizedResult.normalized.resources) {
    const id = resourceId(resource);
    const lastApplied = clone(overrides[id] || resource.desired);
    const adapterVersion = resolveAdapterVersion(resource, options);
    const resourceState = {
      resourceType: resource.resourceType,
      key: resource.key,
      adapterVersion,
      bindings: createBindings(resource),
    };
    if (!omitted.has(id)) {
      resourceState.lastApplied = lastApplied;
      resourceState.lastAppliedHash = hashStable(lastApplied);
    }
    state = upsertResourceState(state, resourceState, {
      registry: options.registry,
    });
  }
  state.revision = options.revision === undefined ? 1 : options.revision;
  return state;
}

function resolveAdapterVersion(resource, options) {
  if (options.adapterVersionByType && options.adapterVersionByType[resource.resourceType]) {
    return options.adapterVersionByType[resource.resourceType];
  }
  return options.adapterVersion || 1;
}

function createBindings(resource) {
  if (resource.resourceType === 'app') {
    return {
      appType: 'APP_PLAN',
    };
  }
  return {
    appType: 'APP_PLAN',
    formUuid: `FORM_${resource.key}`,
    fieldBindings: collectFieldBindings(resource.desired.fields || []),
  };
}

function collectFieldBindings(fields) {
  const result = {};
  for (const field of fields) {
    result[field.semanticPath] = {
      fieldId: fieldIdForField(field),
    };
    if (Array.isArray(field.children)) {
      Object.assign(result, collectFieldBindings(field.children));
    }
  }
  return result;
}

function fieldIdForField(field) {
  const suffix = field.semanticPath.replace(/\./g, '_');
  const prefixes = {
    AssociationFormField: 'associationFormField',
    NumberField: 'numberField',
    SelectField: 'selectField',
    TableField: 'tableField',
    TextField: 'textField',
  };
  return `${prefixes[field.type] || 'textField'}_${suffix}`;
}

function createObserved(normalizedResult, overrides = {}, options = {}) {
  return {
    resources: normalizedResult.normalized.resources
      .filter(resource => overrides[resourceId(resource)] !== null)
      .map(resource => {
        const managed = clone(overrides[resourceId(resource)] || resource.desired);
        const adapterVersion = resolveAdapterVersion(resource, options);
        return {
          resourceType: resource.resourceType,
          key: resource.key,
          adapterVersion,
          managed,
          observedManagedHash: hashStable(managed),
        };
      }),
  };
}

function planFor(desiredResult, state, observed) {
  return createPlan({
    desiredResources: desiredResult.normalized.resources,
    manifestHash: desiredResult.manifestHash,
    observedResources: observed.resources,
    state,
  });
}

function changeFor(plan, resourceType, key) {
  return plan.changes.find(change => (
    change.resourceType === resourceType && change.key === key
  ));
}

function writeManifest(manifest) {
  const file = path.join(tempDir, 'manifest.json');
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2), 'utf8');
  return file;
}

function collectStdout() {
  let value = '';
  return {
    stream: {
      write(chunk) {
        value += chunk;
      },
    },
    value() {
      return value;
    },
  };
}

function compileSchemaForResource(resource, stateResource) {
  const existingBindings = {};
  Object.keys(stateResource.bindings.fieldBindings || {}).forEach((semanticPath) => {
    existingBindings[semanticPath] = stateResource.bindings.fieldBindings[semanticPath].fieldId;
  });
  const compiled = compileFormDefinition({
    title: resource.desired.title,
    appType: stateResource.bindings.appType,
    formUuid: stateResource.bindings.formUuid,
    fields: resource.desired.fields,
  }, {
    existingBindings,
  });
  compiled.schema.title = resource.desired.title;
  return compiled.schema;
}

function createObservedServices(schemaByFormUuid) {
  return {
    readApp: jest.fn(async () => ({
      appType: 'APP_PLAN',
      appName: { zh_CN: 'Visitor App' },
    })),
    readFormSchema: jest.fn(async (context, input) => {
      return {
        content: schemaByFormUuid[input.formUuid],
      };
    }),
  };
}

function createLowLevelObservedServices(resultFactory) {
  const httpGet = jest.fn(async (baseUrl, requestPath, queryParams) => (
    typeof resultFactory === 'function'
      ? resultFactory({ baseUrl, queryParams, requestPath })
      : resultFactory
  ));
  return {
    httpGet,
    readApp: jest.fn(async () => ({
      appType: 'APP_PLAN',
      appName: { zh_CN: 'Visitor App' },
    })),
    requestWithAutoLogin: jest.fn((requestFn, authRef) => requestFn(authRef || {
      baseUrl: 'https://example.test',
      cookies: [],
    })),
  };
}

function moveFieldToTopLevel(schema, fieldId) {
  const formContainer = findFormContainer(schema);
  const field = removeChildByFieldId(formContainer.children, fieldId);
  formContainer.children.push(field);
}

function findFormContainer(schema) {
  let found = null;

  function visit(node) {
    if (!node || found) {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node !== 'object') {
      return;
    }
    if (node.componentName === 'FormContainer' && Array.isArray(node.children)) {
      found = node;
      return;
    }
    Object.keys(node).forEach(key => visit(node[key]));
  }

  visit(schema);
  return found;
}

function removeChildByFieldId(children, fieldId) {
  for (const child of children) {
    if (child.props && child.props.fieldId === fieldId) {
      const index = children.indexOf(child);
      return children.splice(index, 1)[0];
    }
    if (Array.isArray(child.children)) {
      const found = removeChildByFieldId(child.children, fieldId);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function createVersionedRegistry(adapterVersion) {
  return new ResourceRegistry()
    .register(Object.assign({}, appAdapter, { adapterVersion }))
    .register(Object.assign({}, formAdapter, { adapterVersion }));
}

describe('schema planner three-way diff', () => {
  test('marks desired resources without state bindings as create candidates without guessing remote identity', () => {
    const desired = normalize();
    const state = createEmptyState(environmentInput(), {
      manifestHash: desired.manifestHash,
    });
    const plan = planFor(desired, state, { resources: [] });

    expect(plan.counts.create).toBe(3);
    expect(plan.changes[0]).toMatchObject({
      operation: 'create',
      resourceType: 'app',
      key: 'visitorApp',
      reasonCode: REASON_CODES.NO_STATE_BINDING,
    });
    expect(plan.changes.map(change => `${change.resourceType}:${change.key}`)).toEqual([
      'app:visitorApp',
      'form:customer',
      'form:visitor',
    ]);
  });

  test('fails when planner dependency sorting finds a cycle after validation is bypassed', () => {
    const manifestHash = hashStable({ manifest: 'cyclic' });
    const desiredResources = [
      {
        resourceType: 'form',
        key: 'alpha',
        adapterVersion: 1,
        desired: { title: 'Alpha', fields: [] },
        dependsOn: ['form:beta'],
      },
      {
        resourceType: 'form',
        key: 'beta',
        adapterVersion: 1,
        desired: { title: 'Beta', fields: [] },
        dependsOn: ['form:alpha'],
      },
    ];

    expect(() => createPlan({
      desiredResources,
      manifestHash,
      observedResources: [],
      state: createEmptyState(environmentInput(), {
        manifestHash,
      }),
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_DEPENDENCY_CYCLE',
      details: expect.objectContaining({
        cycle: ['form:alpha', 'form:beta', 'form:alpha'],
      }),
    }));
  });

  test('classifies update, noop, state repair, remote drift, and dual-change conflict', () => {
    const original = normalize();
    const desiredManifest = baseManifest();
    desiredManifest.forms.visitor.title = 'Visitor v2';
    const desired = normalize(desiredManifest);
    const state = createState(original);

    const updatePlan = planFor(desired, state, createObserved(original));
    expect(changeFor(updatePlan, 'form', 'visitor')).toMatchObject({
      operation: 'update',
      reasonCode: REASON_CODES.DESIRED_CHANGED,
      risk: 'low',
    });
    expect(updatePlan.counts.update).toBe(1);
    expect(updatePlan.counts.noop).toBe(2);

    const noopPlan = planFor(original, state, createObserved(original));
    expect(noopPlan.counts.noop).toBe(3);
    expect(changeFor(noopPlan, 'form', 'visitor')).toMatchObject({
      operation: 'noop',
      reasonCode: REASON_CODES.ALREADY_MATCHES_DESIRED,
    });

    const stateRepairPlan = planFor(desired, state, createObserved(desired));
    expect(changeFor(stateRepairPlan, 'form', 'visitor')).toMatchObject({
      operation: 'noop',
      reasonCode: REASON_CODES.STATE_REPAIR_REQUIRED,
      stateRepair: true,
    });

    const remoteDriftObserved = createObserved(original, {
      'form:visitor': Object.assign({}, findResource(original, 'form', 'visitor').desired, {
        title: 'Changed remotely',
      }),
    });
    const remoteDriftPlan = planFor(original, state, remoteDriftObserved);
    expect(changeFor(remoteDriftPlan, 'form', 'visitor')).toMatchObject({
      operation: 'conflict',
      reasonCode: REASON_CODES.REMOTE_DRIFT,
    });

    const dualChangeObserved = createObserved(original, {
      'form:visitor': Object.assign({}, findResource(original, 'form', 'visitor').desired, {
        title: 'Remote v3',
      }),
    });
    const dualChangePlan = planFor(desired, state, dualChangeObserved);
    expect(changeFor(dualChangePlan, 'form', 'visitor')).toMatchObject({
      operation: 'conflict',
      reasonCode: REASON_CODES.DESIRED_AND_OBSERVED_CHANGED,
    });
  });

  test('blocks managed field loss and high-risk field changes as stable conflicts', () => {
    const original = normalize();
    const originalState = createState(original);
    const originalVisitor = findResource(original, 'form', 'visitor').desired;

    const missingObserved = clone(originalVisitor);
    missingObserved.fields = missingObserved.fields.filter(field => field.key !== 'firstName');
    expect(changeFor(
      planFor(original, originalState, createObserved(original, {
        'form:visitor': missingObserved,
      })),
      'form',
      'visitor'
    )).toMatchObject({
      operation: 'conflict',
      reasonCode: REASON_CODES.MANAGED_FIELD_MISSING,
    });

    const removalManifest = baseManifest();
    delete removalManifest.forms.visitor.fields.firstName;
    expect(changeFor(
      planFor(normalize(removalManifest), originalState, createObserved(original)),
      'form',
      'visitor'
    )).toMatchObject({
      operation: 'conflict',
      reasonCode: REASON_CODES.FORM_MANAGED_FIELD_REMOVAL_UNSUPPORTED,
    });

    const typeManifest = baseManifest();
    typeManifest.forms.visitor.fields.firstName.type = 'NumberField';
    const typeDesired = normalize(typeManifest);
    expect(changeFor(
      planFor(typeDesired, originalState, createObserved(typeDesired)),
      'form',
      'visitor'
    )).toMatchObject({
      operation: 'conflict',
      reasonCode: REASON_CODES.FORM_FIELD_TYPE_CHANGE_UNSUPPORTED,
    });

    const optionManifest = baseManifest();
    optionManifest.forms.visitor.fields.status.options = ['Draft'];
    expect(changeFor(
      planFor(normalize(optionManifest), originalState, createObserved(original)),
      'form',
      'visitor'
    )).toMatchObject({
      operation: 'conflict',
      reasonCode: REASON_CODES.FORM_OPTION_VALUE_CHANGE_UNSUPPORTED,
    });

    const associationManifest = baseManifest();
    associationManifest.forms.supplier = {
      title: 'Supplier',
      fields: {
        companyName: {
          type: 'TextField',
          label: 'Company name',
        },
      },
    };
    associationManifest.forms.visitor.fields.customerRef.form = 'form:supplier';
    expect(changeFor(
      planFor(normalize(associationManifest), originalState, createObserved(original)),
      'form',
      'visitor'
    )).toMatchObject({
      operation: 'conflict',
      reasonCode: REASON_CODES.FORM_ASSOCIATION_TARGET_CHANGE_UNSUPPORTED,
    });

    const optionAdditionManifest = baseManifest();
    optionAdditionManifest.forms.visitor.fields.status.options.push('Archived');
    expect(changeFor(
      planFor(normalize(optionAdditionManifest), originalState, createObserved(original)),
      'form',
      'visitor'
    )).toMatchObject({
      operation: 'update',
      reasonCode: REASON_CODES.DESIRED_CHANGED,
    });
  });

  test('marks unmanaged, orphan, and remote missing resources without executable changes', () => {
    const desired = normalize();
    const unmanagedState = createState(desired, {
      omitLastApplied: ['form:visitor'],
    });
    const unmanagedPlan = planFor(desired, unmanagedState, createObserved(desired));
    expect(changeFor(unmanagedPlan, 'form', 'visitor')).toMatchObject({
      operation: 'unmanaged',
      reasonCode: REASON_CODES.STATE_LAST_APPLIED_MISSING,
      risk: 'high',
    });

    const withRemovedManifest = baseManifest();
    delete withRemovedManifest.forms.customer;
    delete withRemovedManifest.forms.visitor.fields.customerRef;
    const removedDesired = normalize(withRemovedManifest);
    const orphanPlan = planFor(removedDesired, createState(desired), createObserved(desired));
    expect(changeFor(orphanPlan, 'form', 'customer')).toMatchObject({
      operation: 'orphan',
      reasonCode: REASON_CODES.MANIFEST_RESOURCE_REMOVED,
      risk: 'medium',
    });

    const missingObserved = createObserved(desired, {
      'form:visitor': null,
    });
    const missingPlan = planFor(desired, createState(desired), missingObserved);
    expect(changeFor(missingPlan, 'form', 'visitor')).toMatchObject({
      operation: 'conflict',
      reasonCode: REASON_CODES.REMOTE_RESOURCE_MISSING,
      risk: 'high',
    });
  });

  test('rejects inconsistent lastApplied hashes and incompatible adapter versions', () => {
    const desired = normalize();
    const badHashState = createState(desired);
    badHashState.resources.form.visitor.lastAppliedHash = hashStable({ title: 'bad' });
    expect(() => planFor(desired, badHashState, createObserved(desired))).toThrow(expect.objectContaining({
      code: 'SCHEMA_PLAN_STATE_INTEGRITY_FAILED',
    }));

    const incompatibleState = createState(desired);
    incompatibleState.resources.form.visitor.adapterVersion = 999;
    expect(() => planFor(desired, incompatibleState, createObserved(desired))).toThrow(expect.objectContaining({
      code: 'SCHEMA_STATE_ADAPTER_VERSION_UNSUPPORTED',
    }));
  });

  test('planId is deterministic and changes with manifest, state revision, or observed managed hashes', () => {
    const original = normalize();
    const state = createState(original, { revision: 3 });
    const observed = createObserved(original);
    const first = planFor(original, state, observed);
    const second = planFor(original, clone(state), createObserved(original));
    expect(second.planId).toBe(first.planId);

    const changedManifest = baseManifest();
    changedManifest.forms.visitor.title = 'Visitor changed';
    const changedDesired = normalize(changedManifest);
    expect(planFor(changedDesired, state, observed).planId).not.toBe(first.planId);

    const changedRevision = clone(state);
    changedRevision.revision = 4;
    expect(planFor(original, changedRevision, observed).planId).not.toBe(first.planId);

    const changedObserved = createObserved(original, {
      'form:visitor': Object.assign({}, findResource(original, 'form', 'visitor').desired, {
        title: 'Remote changed',
      }),
    });
    expect(planFor(original, state, changedObserved).planId).not.toBe(first.planId);
  });

  test('remoteSchemaHash changes planId, stays private, validates sha256, and remains optional', () => {
    const original = normalize();
    const state = createState(original, { revision: 3 });
    const withoutHash = createObserved(original);
    expect(planFor(original, state, withoutHash).planId).toBe(
      planFor(original, clone(state), createObserved(original)).planId
    );

    const firstObserved = createObserved(original);
    const firstForm = firstObserved.resources.find(resource => (
      resource.resourceType === 'form' && resource.key === 'visitor'
    ));
    firstForm.remoteSchemaHash = hashStable({ remoteSchema: 'first' });
    const first = planFor(original, state, firstObserved);

    const secondObserved = clone(firstObserved);
    secondObserved.resources.find(resource => (
      resource.resourceType === 'form' && resource.key === 'visitor'
    )).remoteSchemaHash = hashStable({ remoteSchema: 'second' });
    const second = planFor(original, state, secondObserved);

    expect(second.planId).not.toBe(first.planId);
    expect(JSON.stringify(first)).not.toContain(firstForm.remoteSchemaHash);

    const invalidObserved = clone(firstObserved);
    invalidObserved.resources.find(resource => (
      resource.resourceType === 'form' && resource.key === 'visitor'
    )).remoteSchemaHash = 'not-a-sha256';
    expect(() => planFor(original, state, invalidObserved)).toThrow(expect.objectContaining({
      code: 'SCHEMA_INTERNAL_ERROR',
    }));
  });

  test('adapterVersion participates in managed identity and planId while legacy state hashes stay compatible', () => {
    const desired = normalize(simpleManifest());
    const v1Plan = planFor(desired, createState(desired), createObserved(desired));
    const registryV2 = createVersionedRegistry(2);
    const v2State = createState(desired, {
      adapterVersion: 2,
      registry: registryV2,
    });
    const v2Observed = createObserved(desired, {}, { adapterVersion: 2 });
    const v2Plan = createPlan({
      desiredResources: desired.normalized.resources,
      manifestHash: desired.manifestHash,
      observedResources: v2Observed.resources,
      state: v2State,
    }, {
      registry: registryV2,
    });

    expect(v2Plan.counts.noop).toBe(2);
    expect(v2Plan.planId).not.toBe(v1Plan.planId);

    const incompatibleState = createState(desired);
    expect(() => createPlan({
      desiredResources: desired.normalized.resources,
      manifestHash: desired.manifestHash,
      observedResources: v2Observed.resources,
      state: incompatibleState,
    }, {
      registry: registryV2,
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_STATE_ADAPTER_VERSION_UNSUPPORTED',
    }));
  });

  test('uses a generic adapter observed-conflict hook and binds safe identity hashes into planId', () => {
    const managed = { name: 'Managed resource' };
    const adapter = {
      resourceType: 'managed',
      adapterVersion: 1,
      normalize() {},
      validate() {},
      classifyObservedConflict(input) {
        return input.observedResource.observedIdentityMatchesBindings === false
          ? 'REMOTE_IDENTITY_DRIFT'
          : undefined;
      },
    };
    const registry = new ResourceRegistry().register(adapter);
    const desiredResources = [{
      resourceType: 'managed',
      key: 'primary',
      adapterVersion: 1,
      desired: managed,
      dependsOn: [],
    }];
    const state = {
      revision: 1,
      environment: { environmentKey: 'sha256:environment' },
      resources: {
        managed: {
          primary: {
            adapterVersion: 1,
            bindings: {},
            lastApplied: managed,
            lastAppliedHash: hashStable(managed),
          },
        },
      },
    };
    const observedIdentityHash = hashStable({ identity: 'active-a' });
    const observedResources = [{
      resourceType: 'managed',
      key: 'primary',
      adapterVersion: 1,
      managed,
      observedIdentityHash,
      observedIdentityMatchesBindings: false,
    }];
    const first = createPlan({
      desiredResources,
      manifestHash: 'sha256:manifest',
      observedResources,
      state,
    }, { registry });

    expect(first.changes[0]).toMatchObject({
      operation: 'conflict',
      reasonCode: 'REMOTE_IDENTITY_DRIFT',
      risk: 'high',
    });

    const changedIdentity = createPlan({
      desiredResources,
      manifestHash: 'sha256:manifest',
      observedResources: [{
        ...observedResources[0],
        observedIdentityHash: hashStable({ identity: 'active-b' }),
      }],
      state,
    }, { registry });
    expect(changedIdentity.planId).not.toBe(first.planId);
  });

  test('output is compact and does not expose bindings, remote IDs, credentials, or full Schema', () => {
    const desired = normalize();
    const state = createState(desired);
    state.resources.form.visitor.bindings.fieldBindings.firstName.fieldId = 'fieldId_SECRET';
    const plan = planFor(desired, state, createObserved(desired));
    const serialized = JSON.stringify(plan);

    expect(serialized).not.toContain('APP_PLAN');
    expect(serialized).not.toContain('FORM_visitor');
    expect(serialized).not.toContain('fieldId');
    expect(serialized).not.toContain('componentsTree');
    expect(serialized).not.toContain('token');
    expect(plan.changes[0]).toEqual(expect.objectContaining({
      operation: 'noop',
      resourceType: 'app',
      key: 'visitorApp',
      risk: 'low',
      reasonCode: REASON_CODES.ALREADY_MATCHES_DESIRED,
    }));
  });

  test('selectObservableResources excludes create candidates and unmanaged resources', () => {
    const desired = normalize();
    const state = createState(desired, {
      omitLastApplied: ['form:visitor'],
    });
    delete state.resources.form.customer;

    const observable = selectObservableResources(desired.normalized.resources, state);
    expect(observable.map(resourceId)).toEqual(['app:visitorApp']);
  });
});

describe('schema plan command', () => {
  test('schema plan --json --quiet writes one compact JSON object and leaves state unchanged', async () => {
    const desired = normalize();
    const state = createState(desired);
    const stateFile = path.join(tempDir, 'state.v1.json');
    const written = writeStateAtomic(stateFile, state, {
      environment: environmentInput(),
      incrementRevision: false,
    });
    const originalStateFile = fs.readFileSync(stateFile, 'utf8');
    const manifestFile = writeManifest(baseManifest());
    const stdout = collectStdout();
    const stderr = collectStdout();

    const payload = await runSchemaCommand([
      'plan',
      manifestFile,
      '--state',
      stateFile,
      '--json',
      '--quiet',
    ], {
      environment: environmentInput(),
      observed: createObserved(desired),
      projectRoot: tempDir,
      setExitCode: false,
      stderr: stderr.stream,
      stdout: stdout.stream,
    });

    expect(payload).toMatchObject({
      kind: 'openyida_schema_plan',
      contractVersion: 1,
      success: true,
      manifestHash: desired.manifestHash,
      stateRevision: written.revision,
      counts: {
        noop: 3,
      },
    });
    expect(stdout.value().trim().split('\n')).toHaveLength(1);
    expect(stderr.value()).toBe('');
    expect(JSON.parse(stdout.value())).toEqual(payload);
    expect(payload).not.toHaveProperty('action');
    expect(fs.readFileSync(stateFile, 'utf8')).toBe(originalStateFile);
  });

  test('schema plan quiet failures use plan kind and sanitized errors', async () => {
    const desired = normalize();
    const state = createState(desired);
    state.resources.form.visitor.lastAppliedHash = hashStable({ token: 'SECRET' });
    const manifestFile = writeManifest(baseManifest());
    const stdout = collectStdout();
    const stderr = collectStdout();

    const payload = await runSchemaCommand([
      'plan',
      manifestFile,
      '--state',
      path.join(tempDir, 'unused.json'),
      '--json',
      '--quiet',
    ], {
      observed: createObserved(desired),
      projectRoot: tempDir,
      setExitCode: false,
      state,
      stderr: stderr.stream,
      stdout: stdout.stream,
    });

    expect(payload).toMatchObject({
      kind: 'openyida_schema_plan',
      success: false,
      error: {
        code: 'SCHEMA_PLAN_STATE_INTEGRITY_FAILED',
      },
    });
    expect(stdout.value().trim().split('\n')).toHaveLength(1);
    expect(stderr.value()).toBe('');
    expect(JSON.stringify(payload)).not.toContain('SECRET');
  });

  test('schema plan action classification uses exact security and validation boundaries', async () => {
    const desired = normalize(simpleManifest());
    const state = createState(desired);
    const manifestFile = writeManifest(simpleManifest());

    async function planFailureActionFor(code) {
      const stdout = collectStdout();
      const payload = await runSchemaCommand([
        'plan',
        manifestFile,
        '--state',
        path.join(tempDir, 'unused.json'),
        '--json',
        '--quiet',
      ], {
        projectRoot: tempDir,
        readObservedResources: jest.fn(async () => {
          throw schemaError(code, 'Synthetic schema failure for classification.');
        }),
        setExitCode: false,
        state: clone(state),
        stdout: stdout.stream,
      });
      expect(payload).toMatchObject({
        kind: 'openyida_schema_plan',
        success: false,
        error: { code },
      });
      return payload.action;
    }

    await expect(planFailureActionFor('SCHEMA_FORBIDDEN_FIELD')).resolves.toMatchObject({
      classification: 'security_failure',
      nextAction: 'fix_security_boundary',
    });
    await expect(planFailureActionFor('SCHEMA_MANIFEST_SCHEMA_INVALID')).resolves.toMatchObject({
      classification: 'validation_failure',
      nextAction: 'fix_manifest',
    });
    await expect(planFailureActionFor('SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID')).resolves.toMatchObject({
      classification: 'validation_failure',
      nextAction: 'fix_manifest',
    });
    await expect(planFailureActionFor('SCHEMA_DEPENDENCY_CYCLE')).resolves.toMatchObject({
      classification: 'validation_failure',
      nextAction: 'fix_manifest',
    });

    for (const code of [
      'SCHEMA_APPLY_BLOCKED',
      'SCHEMA_CACHE_INVALIDATION_FAILED',
      'SCHEMA_OBSERVED_FIELD_READ_FAILED',
      'SCHEMA_PROFILE_FORBIDDEN_ALIAS',
    ]) {
      await expect(planFailureActionFor(code)).resolves.toMatchObject({
        classification: 'blocked',
        nextAction: 'stop',
      });
    }
  });

  test('schema plan reports stale managed field bindings as a compact conflict', async () => {
    const desired = normalize(simpleManifest());
    const state = createState(desired);
    const visitor = findResource(desired, 'form', 'visitor');
    const visitorSchema = compileSchemaForResource(visitor, state.resources.form.visitor);
    state.resources.form.visitor.bindings.fieldBindings.firstName.fieldId = 'textField_REAL_STALE';
    state.resources.form.visitor.bindings.appType = 'APP_REAL_SECRET';
    state.resources.form.visitor.bindings.formUuid = 'FORM_REAL_SECRET';
    const stateFile = path.join(tempDir, 'state-stale.v1.json');
    fs.writeFileSync(stateFile, JSON.stringify(state), 'utf8');
    const manifestFile = writeManifest(simpleManifest());
    const stdout = collectStdout();
    const stderr = collectStdout();

    const payload = await runSchemaCommand([
      'plan',
      manifestFile,
      '--state',
      stateFile,
      '--json',
      '--quiet',
    ], {
      environment: environmentInput(),
      projectRoot: tempDir,
      services: createObservedServices({
        FORM_REAL_SECRET: visitorSchema,
      }),
      setExitCode: false,
      stderr: stderr.stream,
      stdout: stdout.stream,
    });

    const serialized = stdout.value();
    expect(payload).toMatchObject({
      kind: 'openyida_schema_plan',
      success: true,
      counts: {
        conflict: 1,
      },
      changes: expect.arrayContaining([
        expect.objectContaining({
          operation: 'conflict',
          resourceType: 'form',
          key: 'visitor',
          reasonCode: REASON_CODES.MANAGED_FIELD_MISSING,
        }),
      ]),
    });
    expect(serialized.trim().split('\n')).toHaveLength(1);
    expect(stderr.value()).toBe('');
    expect(serialized).not.toContain('textField_REAL_STALE');
    expect(serialized).not.toContain('APP_REAL_SECRET');
    expect(serialized).not.toContain('FORM_REAL_SECRET');
    expect(serialized).not.toContain('fieldBindings');
  });

  test('schema plan sanitizes parent mismatch projection failures', async () => {
    const desired = normalize(tableManifest());
    const state = createState(desired);
    const visitor = findResource(desired, 'form', 'visitor');
    const schema = compileSchemaForResource(visitor, state.resources.form.visitor);
    moveFieldToTopLevel(schema, 'textField_items_itemName');
    const stateFile = path.join(tempDir, 'state-parent.v1.json');
    const written = writeStateAtomic(stateFile, state, {
      environment: environmentInput(),
      incrementRevision: false,
    });
    const manifestFile = writeManifest(tableManifest());
    const stdout = collectStdout();
    const stderr = collectStdout();

    const payload = await runSchemaCommand([
      'plan',
      manifestFile,
      '--state',
      stateFile,
      '--json',
      '--quiet',
    ], {
      environment: environmentInput(),
      projectRoot: tempDir,
      services: createObservedServices({
        [written.resources.form.visitor.bindings.formUuid]: schema,
      }),
      setExitCode: false,
      stderr: stderr.stream,
      stdout: stdout.stream,
    });

    const serialized = stdout.value();
    expect(payload).toMatchObject({
      kind: 'openyida_schema_plan',
      success: false,
      error: {
        code: 'SCHEMA_OBSERVED_STRUCTURE_MISMATCH',
      },
    });
    expect(serialized.trim().split('\n')).toHaveLength(1);
    expect(stderr.value()).toBe('');
    expect(serialized).not.toContain('tableField_items');
    expect(serialized).not.toContain('textField_items_itemName');
    expect(serialized).not.toContain('APP_PLAN');
    expect(serialized).not.toContain('FORM_visitor');
  });

  test('schema plan turns explicit app missing into planner remote missing conflict', async () => {
    const desired = normalize(simpleManifest());
    const state = createState(desired);
    const visitor = findResource(desired, 'form', 'visitor');
    const schema = compileSchemaForResource(visitor, state.resources.form.visitor);
    const stateFile = path.join(tempDir, 'state-app-missing.v1.json');
    writeStateAtomic(stateFile, state, {
      environment: environmentInput(),
      incrementRevision: false,
    });
    const manifestFile = writeManifest(simpleManifest());
    const stdout = collectStdout();
    const stderr = collectStdout();

    const services = createObservedServices({
      [state.resources.form.visitor.bindings.formUuid]: schema,
    });
    services.readApp = jest.fn(async () => {
      const error = new Error('APP_PLAN token SECRET');
      error.code = 'APP_READ_NOT_FOUND';
      throw error;
    });
    const payload = await runSchemaCommand([
      'plan',
      manifestFile,
      '--state',
      stateFile,
      '--json',
      '--quiet',
    ], {
      environment: environmentInput(),
      projectRoot: tempDir,
      services,
      setExitCode: false,
      stderr: stderr.stream,
      stdout: stdout.stream,
    });

    expect(payload.success).toBe(true);
    expect(changeFor(payload, 'app', 'visitorApp')).toMatchObject({
      operation: 'conflict',
      reasonCode: REASON_CODES.REMOTE_RESOURCE_MISSING,
    });
    expect(payload.counts.conflict).toBe(1);
    expect(stdout.value()).not.toContain('APP_PLAN');
    expect(stdout.value()).not.toContain('SECRET');
    expect(stderr.value()).toBe('');
    expect(services.readApp).toHaveBeenCalled();
  });

  test('schema plan does not treat plain remote-missing SCHEMA code as trusted missing', async () => {
    const desired = normalize(simpleManifest());
    const state = createState(desired);
    const visitor = findResource(desired, 'form', 'visitor');
    const schema = compileSchemaForResource(visitor, state.resources.form.visitor);
    const stateFile = path.join(tempDir, 'state-plain-remote-missing.v1.json');
    writeStateAtomic(stateFile, state, {
      environment: environmentInput(),
      incrementRevision: false,
    });
    const manifestFile = writeManifest(simpleManifest());
    const stdout = collectStdout();
    const stderr = collectStdout();

    const services = createObservedServices({
      [state.resources.form.visitor.bindings.formUuid]: schema,
    });
    services.readApp = jest.fn(async () => {
      const error = new Error('APP_PLAN token SECRET');
      error.code = 'SCHEMA_REMOTE_RESOURCE_MISSING';
      error.details = {
        key: 'FORM_SECRET',
        semanticPath: 'textField_SECRET',
      };
      throw error;
    });

    const payload = await runSchemaCommand([
      'plan',
      manifestFile,
      '--state',
      stateFile,
      '--json',
      '--quiet',
    ], {
      environment: environmentInput(),
      projectRoot: tempDir,
      services,
      setExitCode: false,
      stderr: stderr.stream,
      stdout: stdout.stream,
    });

    expect(payload).toMatchObject({
      kind: 'openyida_schema_plan',
      success: false,
      error: {
        code: 'SCHEMA_REMOTE_READ_FAILED',
        message: 'Schema plan failed because remote observed read failed.',
      },
    });
    expect(payload.error.details).toEqual({
      resourceType: 'app',
      key: 'visitorApp',
    });
    expect(payload.error.path).toBeUndefined();
    expect(stdout.value()).not.toContain('APP_PLAN');
    expect(stdout.value()).not.toContain('FORM_SECRET');
    expect(stdout.value()).not.toContain('textField_SECRET');
    expect(stdout.value()).not.toContain('SECRET');
    expect(stderr.value()).toBe('');
  });

  test.each([
    ['public OpenAPI form.formNotExist on internal reader', { success: false, errorCode: 'form.formNotExist', errorMsg: 'FORM_visitor token SECRET' }],
    ['public OpenAPI 200008 on internal reader', { success: false, errorCode: '200008', errorMsg: 'FORM_visitor fieldId_MUST_NOT_LEAK token SECRET' }],
    ['generic 404', { success: false, errorCode: '404', errorMsg: 'FORM_visitor missing' }],
    ['endpoint not found', { success: false, errorCode: 'ENDPOINT_NOT_FOUND', errorMsg: '/internal/path token SECRET' }],
    ['unknown failure', { success: false, errorCode: 'FORM_SCHEMA_BROKEN', errorMsg: 'FORM_visitor token SECRET' }],
  ])('schema plan keeps %s as stable read failure instead of remote missing', async (caseName, result) => {
    const desired = normalize(simpleManifest());
    const state = createState(desired);
    const stateFile = path.join(tempDir, `state-read-fail-${caseName.replace(/\s+/g, '-')}.v1.json`);
    writeStateAtomic(stateFile, state, {
      environment: environmentInput(),
      incrementRevision: false,
    });
    const manifestFile = writeManifest(simpleManifest());
    const stdout = collectStdout();
    const services = createLowLevelObservedServices(result);

    const payload = await runSchemaCommand([
      'plan',
      manifestFile,
      '--state',
      stateFile,
      '--json',
      '--quiet',
    ], {
      environment: environmentInput(),
      projectRoot: tempDir,
      services,
      setExitCode: false,
      stdout: stdout.stream,
    });

    expect(payload).toMatchObject({
      kind: 'openyida_schema_plan',
      success: false,
      error: {
        code: 'SCHEMA_REMOTE_READ_FAILED',
      },
    });
    expect(stdout.value()).not.toContain('SECRET');
    expect(stdout.value()).not.toContain('FORM_visitor');
    expect(stdout.value()).not.toContain('fieldId_MUST_NOT_LEAK');
    expect(stdout.value()).not.toContain('REMOTE_RESOURCE_MISSING');
    expect(services.httpGet).toHaveBeenCalled();
    expect(services.requestWithAutoLogin).toHaveBeenCalled();
  });

  test('schema plan drops details and path from untrusted plain SCHEMA errors', async () => {
    const desired = normalize(simpleManifest());
    const state = createState(desired);
    const stateFile = path.join(tempDir, 'state-malicious-schema-error.v1.json');
    writeStateAtomic(stateFile, state, {
      environment: environmentInput(),
      incrementRevision: false,
    });
    const manifestFile = writeManifest(simpleManifest());
    const stdout = collectStdout();
    const stderr = collectStdout();

    const payload = await runSchemaCommand([
      'plan',
      manifestFile,
      '--state',
      stateFile,
      '--json',
      '--quiet',
    ], {
      environment: environmentInput(),
      projectRoot: tempDir,
      readObservedResources: jest.fn(async () => {
        const error = new Error('Cookie abc token SECRET header h APP_PLAN FORM_SECRET textField_SECRET /internal/path');
        error.code = 'SCHEMA_REMOTE_PROJECT_FAILED';
        error.path = '/environment/token';
        error.details = {
          adapterVersion: 1,
          stateAdapterVersion: 1,
          resourceType: 'form',
          key: 'FORM_SECRET',
          semanticPath: 'textField_SECRET',
          operation: 'read',
          property: 'title',
          reason: 'token_SECRET',
          ordinary: 'token SECRET APP_PLAN FORM_SECRET textField_SECRET',
          nested: {
            key: 'customer',
          },
          list: [{
            operation: 'project',
            header: 'AUTH',
          }],
          appType: 'APP_PLAN',
          formUuid: 'FORM_SECRET',
          fieldId: 'textField_SECRET',
        };
        throw error;
      }),
      setExitCode: false,
      stderr: stderr.stream,
      stdout: stdout.stream,
    });

    expect(payload).toMatchObject({
      kind: 'openyida_schema_plan',
      success: false,
      error: {
        code: 'SCHEMA_REMOTE_PROJECT_FAILED',
        message: 'Schema plan failed because remote observed projection failed.',
      },
    });
    expect(payload.error.path).toBeUndefined();
    expect(payload.error.details).toBeUndefined();
    expect(stdout.value().trim().split('\n')).toHaveLength(1);
    expect(stderr.value()).toBe('');
    for (const leaked of ['Cookie', 'token', 'SECRET', 'header', 'APP_PLAN', 'FORM_SECRET', 'textField_SECRET', '/internal/path', '/environment/token', 'ordinary', 'nested', 'list']) {
      expect(stdout.value()).not.toContain(leaked);
    }
  });

  test('schema plan projects only per-code safe details from trusted schema errors', async () => {
    const desired = normalize(simpleManifest());
    const state = createState(desired);
    const stateFile = path.join(tempDir, 'state-trusted-schema-error.v1.json');
    writeStateAtomic(stateFile, state, {
      environment: environmentInput(),
      incrementRevision: false,
    });
    const manifestFile = writeManifest(simpleManifest());
    const stdout = collectStdout();
    const stderr = collectStdout();

    const payload = await runSchemaCommand([
      'plan',
      manifestFile,
      '--state',
      stateFile,
      '--json',
      '--quiet',
    ], {
      environment: environmentInput(),
      projectRoot: tempDir,
      readObservedResources: jest.fn(async () => {
        throw schemaError('SCHEMA_OBSERVED_STRUCTURE_MISMATCH', 'Cookie token SECRET APP_PLAN FORM_SECRET textField_SECRET', {
          path: '/environment/token',
          details: {
            actualParentBound: false,
            expectedParentBound: true,
            key: 'FORM_SECRET',
            reason: 'token_SECRET',
            resourceType: 'form',
            semanticPath: 'items.itemName',
          },
        });
      }),
      setExitCode: false,
      stderr: stderr.stream,
      stdout: stdout.stream,
    });

    expect(payload).toMatchObject({
      kind: 'openyida_schema_plan',
      success: false,
      error: {
        code: 'SCHEMA_OBSERVED_STRUCTURE_MISMATCH',
        message: 'Schema plan failed because observed structure does not match managed state.',
        details: {
          actualParentBound: false,
          expectedParentBound: true,
          semanticPath: 'items.itemName',
        },
      },
    });
    expect(payload.error.path).toBeUndefined();
    expect(stdout.value().trim().split('\n')).toHaveLength(1);
    expect(stderr.value()).toBe('');
    for (const leaked of ['Cookie', 'token', 'SECRET', 'APP_PLAN', 'FORM_SECRET', 'textField_SECRET', '/environment/token', 'reason']) {
      expect(stdout.value()).not.toContain(leaked);
    }
  });

  test('schema plan resolves auth context once and reuses it for state and observed reads', async () => {
    const environment = {
      endpoint: 'https://auth.example.test',
      corpId: 'corp-auth',
    };
    const desired = normalize(simpleManifest());
    const state = createState(desired, { environment });
    const stateFile = path.join(tempDir, 'state-auth.v1.json');
    writeStateAtomic(stateFile, state, {
      environment,
      incrementRevision: false,
    });
    const manifestFile = writeManifest(simpleManifest());
    const loadCookieData = jest.fn();
    const authRef = {
      baseUrl: environment.endpoint,
      corpId: environment.corpId,
      authMode: 'token',
      authSource: 'env',
      authData: {
        auth_mode: 'token',
        auth_source: 'env',
        base_url: environment.endpoint,
        corp_id: environment.corpId,
      },
    };
    const cookieData = {
      base_url: environment.endpoint,
      corp_id: environment.corpId,
      csrf_token: 'csrf-secret',
      cookies: [
        { name: 'tianshu_corp_user', value: 'corp-auth_user-auth' },
        { name: 'tianshu_csrf_token', value: 'csrf-secret' },
      ],
    };
    const readObservedResources = jest.fn(async (resources, observedState, options) => {
      expect(observedState.environment).toEqual(state.environment);
      expect(options.context.authRef).toMatchObject({
        baseUrl: environment.endpoint,
        corpId: environment.corpId,
      });
      expect(options.context.environment).toMatchObject(environment);
      return createObserved(desired);
    });
    const stdout = collectStdout();

    const payload = await runSchemaCommand([
      'plan',
      manifestFile,
      '--state',
      stateFile,
      '--json',
      '--quiet',
    ], {
      authRef,
      cookieData,
      loadCookieData,
      projectRoot: tempDir,
      readObservedResources,
      setExitCode: false,
      stdout: stdout.stream,
    });

    expect(payload.success).toBe(true);
    expect(loadCookieData).not.toHaveBeenCalled();
    expect(readObservedResources).toHaveBeenCalledTimes(1);
  });

  test('schema validate route and command manifest remain compatible while schema plan is read-only remote read', async () => {
    const manifestFile = writeManifest(baseManifest());
    const stdout = collectStdout();
    const payload = await runSchemaCommand([
      'validate',
      manifestFile,
      '--json',
      '--quiet',
    ], {
      projectRoot: tempDir,
      setExitCode: false,
      stdout: stdout.stream,
    });

    expect(payload).toMatchObject({
      kind: 'openyida_schema_validation',
      success: true,
      counts: {
        resources: 3,
        dependencies: 3,
      },
    });

    const commands = flattenCommandManifest();
    const schemaValidate = commands.find(entry => entry.id === 'schema.validate');
    const schemaPlan = commands.find(entry => entry.id === 'schema.plan');
    expect(schemaValidate).toMatchObject({
      path: ['schema', 'validate'],
      requiresLogin: false,
      sideEffect: {
        kind: 'local_read',
        mutates_yida: false,
        mutates_local: false,
      },
    });
    expect(schemaPlan).toMatchObject({
      path: ['schema', 'plan'],
      requiresLogin: true,
      output: 'json',
      sideEffect: {
        kind: 'remote_read',
        mutates_yida: false,
        mutates_local: false,
      },
      permission: {
        mode: 'allow',
        effect: 'read',
      },
    });
  });
});
