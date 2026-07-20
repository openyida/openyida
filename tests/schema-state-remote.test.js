'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { compileFormDefinition } = require('../lib/app/services/form-compiler');
const { normalizeManifest } = require('../lib/schema/normalize-manifest');
const {
  createEmptyState,
  createEnvironmentIdentity,
  createSha256,
  hashStable,
  readState,
  upsertResourceState,
  writeStateAtomic,
} = require('../lib/schema/state-store');
const { readObservedResources } = require('../lib/schema/remote-reader');
const { ResourceRegistry } = require('../lib/schema/resource-registry');

let tempDir;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-schema-state-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function statePath() {
  return path.join(tempDir, 'state.v1.json');
}

function environmentInput() {
  return {
    endpoint: 'https://example.test/',
    corpId: 'corp-state-test',
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
      visitor: {
        title: 'Visitor',
        fields: {
          firstName: {
            type: 'TextField',
            label: 'Same Label',
          },
          amount: {
            type: 'NumberField',
            label: 'Same Label',
            required: true,
          },
          items: {
            type: 'TableField',
            label: 'Items',
            children: {
              itemName: {
                type: 'TextField',
                label: 'Same Label',
              },
            },
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
      customer: {
        title: 'Customer',
        fields: {
          companyName: {
            type: 'TextField',
            label: 'Company name',
          },
        },
      },
    },
  };
}

function getResource(normalized, resourceType, key) {
  return normalized.resources.find(resource => (
    resource.resourceType === resourceType && resource.key === key
  ));
}

function compileVisitorSchema(visitorResource) {
  const compiled = compileFormDefinition({
    title: visitorResource.desired.title,
    appType: 'APP_STATE',
    formUuid: 'FORM_STATE',
    fields: visitorResource.desired.fields,
  }, {
    existingBindings: {
      firstName: 'textField_first',
      amount: 'numberField_amount',
      items: 'tableField_items',
      'items.itemName': 'textField_itemName',
      status: 'selectField_status',
      customerRef: 'associationFormField_customer',
    },
  });
  compiled.schema.title = visitorResource.desired.title;
  const association = findComponentByFieldId(compiled.schema, 'associationFormField_customer');
  association.props.associationForm.formUuid = 'FORM_CUSTOMER';
  association.props.associationForm.appType = 'APP_STATE';
  return compiled;
}

function createBoundState(normalizedResult) {
  const env = environmentInput();
  const state = createEmptyState(env, {
    manifestHash: normalizedResult.manifestHash,
  });
  const withApp = upsertResourceState(state, {
    resourceType: 'app',
    key: 'visitorApp',
    adapterVersion: 1,
    bindings: {
      appType: 'APP_STATE',
    },
    lastAppliedHash: hashStable(getResource(normalizedResult.normalized, 'app', 'visitorApp').desired),
  });
  const withCustomer = upsertResourceState(withApp, {
    resourceType: 'form',
    key: 'customer',
    adapterVersion: 1,
    bindings: {
      appType: 'APP_STATE',
      formUuid: 'FORM_CUSTOMER',
      fieldBindings: {
        companyName: { fieldId: 'textField_companyName' },
      },
    },
    lastAppliedHash: hashStable(getResource(normalizedResult.normalized, 'form', 'customer').desired),
  });
  return upsertResourceState(withCustomer, {
    resourceType: 'form',
    key: 'visitor',
    adapterVersion: 1,
    bindings: {
      appType: 'APP_STATE',
      formUuid: 'FORM_STATE',
      fieldBindings: {
        firstName: { fieldId: 'textField_first' },
        amount: { fieldId: 'numberField_amount' },
        items: { fieldId: 'tableField_items' },
        'items.itemName': { fieldId: 'textField_itemName' },
        status: { fieldId: 'selectField_status' },
        customerRef: { fieldId: 'associationFormField_customer' },
      },
    },
    lastAppliedHash: hashStable(getResource(normalizedResult.normalized, 'form', 'visitor').desired),
    remoteSchemaHash: hashStable({ initial: true }),
  });
}

function createObservedServices(schema) {
  return {
    readApp: jest.fn(async () => ({
      appType: 'APP_STATE',
      appName: { zh_CN: 'Visitor App' },
    })),
    readFormSchema: jest.fn(async () => ({
      content: schema,
    })),
  };
}

function reorderSchemaObjectKeys(schema) {
  const clone = JSON.parse(JSON.stringify(schema));

  function visit(node) {
    if (!node || typeof node !== 'object') {
      return;
    }
    if (node.props && typeof node.props === 'object' && !Array.isArray(node.props)) {
      const reordered = {};
      Object.keys(node.props).reverse().forEach((key) => {
        reordered[key] = node.props[key];
      });
      node.props = reordered;
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(visit);
    }
  }

  (clone.pages || []).forEach((page) => {
    (page.componentsTree || []).forEach(visit);
  });
  return clone;
}

function findComponentByFieldId(schema, fieldId) {
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
    if (node.props && node.props.fieldId === fieldId) {
      found = node;
      return;
    }
    Object.keys(node).forEach(key => visit(node[key]));
  }

  visit(schema);
  return found;
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

function moveFieldToTopLevel(schema, fieldId) {
  const formContainer = findFormContainer(schema);
  const field = removeChildByFieldId(formContainer.children, fieldId);
  formContainer.children.push(field);
}

function moveFieldToAnotherTable(schema, fieldId) {
  const formContainer = findFormContainer(schema);
  const otherTable = JSON.parse(JSON.stringify(findComponentByFieldId(schema, 'tableField_items')));
  otherTable.props.fieldId = 'tableField_otherItems';
  otherTable.fieldId = 'tableField_otherItems';
  otherTable.props.label = { zh_CN: 'Other Items' };
  otherTable.children = [];
  const field = removeChildByFieldId(formContainer.children, fieldId);
  otherTable.children.push(field);
  formContainer.children.push(otherTable);
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

describe('schema state store v1', () => {
  test('round-trips state v1 and increments revision atomically', () => {
    const normalizedResult = normalizeManifest(baseManifest());
    const state = createBoundState(normalizedResult);

    const written = writeStateAtomic(statePath(), state, {
      environment: environmentInput(),
    });
    const reloaded = readState(statePath(), {
      environment: environmentInput(),
    });

    expect(written.revision).toBe(1);
    expect(reloaded).toEqual(written);
    expect(reloaded.environment).toEqual(createEnvironmentIdentity(environmentInput()));
    expect(reloaded.resources.form.visitor.bindings.fieldBindings.amount).toEqual({
      fieldId: 'numberField_amount',
    });
  });

  test('failed atomic replacement preserves existing state file', () => {
    const state = createEmptyState(environmentInput());
    writeStateAtomic(statePath(), state, {
      environment: environmentInput(),
    });
    const original = fs.readFileSync(statePath(), 'utf8');
    const nextState = upsertResourceState(state, {
      resourceType: 'app',
      key: 'visitorApp',
      adapterVersion: 1,
      bindings: { appType: 'APP_STATE' },
    });
    const fsImpl = Object.assign({}, fs, {
      renameSync() {
        throw new Error('disk full token SECRET');
      },
    });

    let thrown;
    try {
      writeStateAtomic(statePath(), nextState, {
        environment: environmentInput(),
        fsImpl,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({ code: 'SCHEMA_STATE_WRITE_FAILED' });
    expect(JSON.stringify(thrown)).not.toContain('SECRET');
    expect(fs.readFileSync(statePath(), 'utf8')).toBe(original);
  });

  test('state atomic write refuses a precreated temp symlink without touching its target', () => {
    const state = createEmptyState(environmentInput());
    const atomicProcessId = 4242;
    const atomicNow = 1700000000000;
    const atomicNonce = 'a'.repeat(24);
    const tmpPath = path.join(
      tempDir,
      `.state.v1.json.${atomicProcessId}.${atomicNow}.${atomicNonce}.tmp`
    );
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-state-atomic-outside-'));
    const outsideFile = path.join(outside, 'state-target.json');
    fs.writeFileSync(outsideFile, 'outside-state-original', 'utf8');
    fs.symlinkSync(outsideFile, tmpPath, 'file');

    try {
      expect(() => writeStateAtomic(statePath(), state, {
        atomicNonce,
        atomicNow,
        atomicProcessId,
        environment: environmentInput(),
      })).toThrow(expect.objectContaining({ code: 'SCHEMA_STATE_WRITE_FAILED' }));
      expect(fs.readFileSync(outsideFile, 'utf8')).toBe('outside-state-original');
      expect(fs.lstatSync(tmpPath).isSymbolicLink()).toBe(true);

      fs.unlinkSync(tmpPath);
      const written = writeStateAtomic(statePath(), state, {
        environment: environmentInput(),
      });
      expect(readState(statePath(), { environment: environmentInput() })).toEqual(written);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  test('rejects incompatible versions and environment mismatches', () => {
    const state = createEmptyState(environmentInput());
    fs.writeFileSync(statePath(), JSON.stringify(Object.assign({}, state, {
      contractVersion: 999,
    })), 'utf8');

    expect(() => readState(statePath(), {
      environment: environmentInput(),
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_STATE_VERSION_UNSUPPORTED',
    }));

    writeStateAtomic(statePath(), state, {
      environment: environmentInput(),
    });
    expect(() => readState(statePath(), {
      environment: {
        endpoint: 'https://another.example.test',
        corpId: 'corp-state-test',
      },
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_STATE_ENVIRONMENT_MISMATCH',
    }));
  });

  test('requires environment by default and accepts precomputed environment hashes', () => {
    expect(() => createEmptyState()).toThrow(expect.objectContaining({
      code: 'SCHEMA_STATE_ENVIRONMENT_REQUIRED',
    }));
    expect(() => readState(statePath())).toThrow(expect.objectContaining({
      code: 'SCHEMA_STATE_ENVIRONMENT_REQUIRED',
    }));
    expect(() => writeStateAtomic(statePath(), {
      kind: 'openyida_resource_state',
      contractVersion: 1,
      revision: 0,
      environment: {
        environmentKey: createSha256('env'),
        corpIdHash: createSha256('corp'),
      },
      resources: {},
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_STATE_ENVIRONMENT_REQUIRED',
    }));

    const identity = createEnvironmentIdentity({
      environmentKey: createSha256('env'),
      corpIdHash: createSha256('corp'),
    });
    const state = createEmptyState(identity);
    const written = writeStateAtomic(statePath(), state, { environment: identity });
    expect(readState(statePath(), { environment: identity })).toEqual(written);
  });

  test('rejects unknown state structure and non-empty pending operations', () => {
    const state = createEmptyState(environmentInput());
    const unknownTopLevel = Object.assign({}, state, { pendingOperations: [{ kind: 'write' }] });
    expect(() => writeStateAtomic(statePath(), unknownTopLevel, {
      environment: environmentInput(),
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_STATE_INVALID',
      path: '/pendingOperations',
    }));

    const normalizedResult = normalizeManifest(baseManifest());
    const badResource = createBoundState(normalizedResult);
    badResource.resources.form.visitor.extra = true;
    expect(() => writeStateAtomic(statePath(), badResource, {
      environment: environmentInput(),
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_STATE_INVALID',
      path: '/resources/form/visitor/extra',
    }));

    const duplicateBinding = createBoundState(normalizedResult);
    duplicateBinding.resources.form.visitor.bindings.fieldBindings.amount.fieldId =
      duplicateBinding.resources.form.visitor.bindings.fieldBindings.firstName.fieldId;
    expect(() => writeStateAtomic(statePath(), duplicateBinding, {
      environment: environmentInput(),
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_STATE_INVALID',
      path: '/resources/form/visitor/bindings/fieldBindings/amount/fieldId',
    }));
  });

  test('rejects remote IDs outside adapter bindings and disguised full Schema in lastApplied', () => {
    const normalizedResult = normalizeManifest(baseManifest());
    const badId = createBoundState(normalizedResult);
    badId.resources.form.visitor.lastApplied = {
      title: 'Visitor',
      fields: [{
        key: 'name',
        semanticPath: 'name',
        type: 'TextField',
        label: 'Name',
        fieldId: 'textField_leak',
      }],
    };
    expect(() => writeStateAtomic(statePath(), badId, {
      environment: environmentInput(),
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_STATE_FORBIDDEN_FIELD',
      path: '/resources/form/visitor/lastApplied/fields/0/fieldId',
    }));

    const badProcessId = createBoundState(normalizedResult);
    badProcessId.resources.form.visitor.lastApplied = {
      title: 'Visitor',
      fields: [],
      processCode: 'TPROC_LEAK',
    };
    expect(() => writeStateAtomic(statePath(), badProcessId, {
      environment: environmentInput(),
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_STATE_FORBIDDEN_FIELD',
      path: '/resources/form/visitor/lastApplied/processCode',
    }));

    const disguisedSchema = createBoundState(normalizedResult);
    disguisedSchema.resources.form.visitor.lastApplied = {
      title: 'Visitor',
      fields: [],
      content: {
        pages: [{ componentsTree: [] }],
      },
    };
    expect(() => writeStateAtomic(statePath(), disguisedSchema, {
      environment: environmentInput(),
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_STATE_INVALID',
      path: '/resources/form/visitor/lastApplied/content',
    }));
  });

  test('rejects missing and incompatible resource adapterVersion', () => {
    const normalizedResult = normalizeManifest(baseManifest());
    const missing = createBoundState(normalizedResult);
    delete missing.resources.form.visitor.adapterVersion;
    expect(() => writeStateAtomic(statePath(), missing, {
      environment: environmentInput(),
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_STATE_INVALID',
      path: '/resources/form/visitor/adapterVersion',
    }));

    const incompatible = createBoundState(normalizedResult);
    incompatible.resources.form.visitor.adapterVersion = 999;
    expect(() => writeStateAtomic(statePath(), incompatible, {
      environment: environmentInput(),
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_STATE_ADAPTER_VERSION_UNSUPPORTED',
      path: '/resources/form/visitor/adapterVersion',
    }));
  });

  test('distinguishes state read failures from malformed JSON', () => {
    const fsImpl = Object.assign({}, fs, {
      existsSync() {
        return true;
      },
      readFileSync() {
        throw new Error('/private/path token SECRET');
      },
    });
    let readError;
    try {
      readState(statePath(), {
        environment: environmentInput(),
        fsImpl,
      });
    } catch (error) {
      readError = error;
    }
    expect(readError).toMatchObject({
      code: 'SCHEMA_STATE_READ_FAILED',
    });
    expect(JSON.stringify(readError)).not.toContain('/private/path');
    expect(JSON.stringify(readError)).not.toContain('SECRET');

    fs.writeFileSync(statePath(), '{bad json', 'utf8');
    expect(() => readState(statePath(), {
      environment: environmentInput(),
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_STATE_INVALID',
      details: { reason: 'invalid_json' },
    }));
  });

  test('rejects sensitive state keys without leaking values', () => {
    const state = createEmptyState(environmentInput());
    const badState = upsertResourceState(state, {
      resourceType: 'form',
      key: 'visitor',
      adapterVersion: 1,
      bindings: {
        appType: 'APP_STATE',
        formUuid: 'FORM_STATE',
        fieldBindings: {},
      },
    });
    badState.resources.form.visitor.bindings.headers = {
      Authorization: 'Bearer SECRET_VALUE',
    };

    let thrown;
    try {
      writeStateAtomic(statePath(), badState, {
        environment: environmentInput(),
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      code: 'SCHEMA_STATE_FORBIDDEN_FIELD',
      path: '/resources/form/visitor/bindings/headers',
    });
    expect(JSON.stringify(thrown)).not.toContain('SECRET_VALUE');
  });
});

describe('schema remote observed reader', () => {
  test('reads app/form observed resources with deterministic hashes and fieldId bindings', async () => {
    const normalizedResult = normalizeManifest(baseManifest());
    const resources = [
      getResource(normalizedResult.normalized, 'app', 'visitorApp'),
      getResource(normalizedResult.normalized, 'form', 'visitor'),
    ];
    const visitor = getResource(normalizedResult.normalized, 'form', 'visitor');
    const compiled = compileVisitorSchema(visitor);
    const state = createBoundState(normalizedResult);
    const services = createObservedServices(compiled.schema);

    const observed = await readObservedResources(resources, state, { services });
    const formObserved = getResource(observed, 'form', 'visitor');
    const appObserved = getResource(observed, 'app', 'visitorApp');

    expect(services.readApp).toHaveBeenCalledTimes(1);
    expect(services.readFormSchema).toHaveBeenCalledWith(expect.any(Object), {
      appType: 'APP_STATE',
      formUuid: 'FORM_STATE',
    });
    expect(appObserved.managed).toMatchObject({
      key: 'visitorApp',
      name: 'Visitor App',
    });
    expect(formObserved.remoteSchemaHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(formObserved.observedManagedHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(formObserved.bindings.fieldBindings).toMatchObject({
      firstName: {
        fieldId: 'textField_first',
        componentType: 'TextField',
      },
      amount: {
        fieldId: 'numberField_amount',
        componentType: 'NumberField',
      },
      'items.itemName': {
        fieldId: 'textField_itemName',
        componentType: 'TextField',
      },
    });
    expect(formObserved.managed.fields.find(field => field.key === 'amount')).toMatchObject({
      key: 'amount',
      semanticPath: 'amount',
      type: 'NumberField',
      label: 'Same Label',
      required: true,
    });
    expect(formObserved.managed.fields.find(field => field.key === 'status')).toMatchObject({
      key: 'status',
      type: 'SelectField',
      options: [
        { label: 'Draft', value: 'Draft' },
        { label: 'Done label', value: 'done' },
      ],
    });
    expect(formObserved.managed.fields.find(field => field.key === 'customerRef')).toMatchObject({
      key: 'customerRef',
      type: 'AssociationFormField',
      form: 'form:customer',
    });
    expect(formObserved.managed.fields.find(field => field.key === 'items').children[0]).toMatchObject({
      key: 'itemName',
      semanticPath: 'items.itemName',
      type: 'TextField',
      label: 'Same Label',
    });
    expect(JSON.stringify(observed)).not.toContain('componentsTree');
  });

  test('observed hashes are deterministic across object key order changes', async () => {
    const normalizedResult = normalizeManifest(baseManifest());
    const visitor = getResource(normalizedResult.normalized, 'form', 'visitor');
    const compiled = compileVisitorSchema(visitor);
    const state = createBoundState(normalizedResult);
    const formResource = [visitor];

    const left = await readObservedResources(formResource, state, {
      services: createObservedServices(compiled.schema),
    });
    const right = await readObservedResources(formResource, state, {
      services: createObservedServices(reorderSchemaObjectKeys(compiled.schema)),
    });

    expect(left.resources[0].remoteSchemaHash).toBe(right.resources[0].remoteSchemaHash);
    expect(left.resources[0].observedManagedHash).toBe(right.resources[0].observedManagedHash);
    expect(left.resources[0].managed).toEqual(right.resources[0].managed);
  });

  test('persisted observed state excludes full remote Schema', async () => {
    const normalizedResult = normalizeManifest(baseManifest());
    const visitor = getResource(normalizedResult.normalized, 'form', 'visitor');
    const compiled = compileVisitorSchema(visitor);
    const state = createBoundState(normalizedResult);
    const observed = await readObservedResources([visitor], state, {
      services: createObservedServices(compiled.schema),
    });

    const updated = upsertResourceState(state, observed.resources[0]);
    writeStateAtomic(statePath(), updated, {
      environment: environmentInput(),
    });
    const raw = fs.readFileSync(statePath(), 'utf8');

    expect(raw).toContain('remoteSchemaHash');
    expect(raw).toContain('numberField_amount');
    expect(raw).not.toContain('componentsTree');
    expect(raw).not.toContain('Same Label');
  });

  test('remote read failures use a stable sanitized error', async () => {
    const normalizedResult = normalizeManifest(baseManifest());
    const visitor = getResource(normalizedResult.normalized, 'form', 'visitor');
    const state = createBoundState(normalizedResult);
    const services = {
      readFormSchema: jest.fn(async () => {
        const error = new Error('Authorization token SECRET_VALUE failed');
        error.code = 'UPSTREAM_AUTH';
        throw error;
      }),
    };

    let thrown;
    try {
      await readObservedResources([visitor], state, { services });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      code: 'SCHEMA_REMOTE_READ_FAILED',
      details: {
        resourceType: 'form',
        key: 'visitor',
        adapterCode: 'UPSTREAM_AUTH',
      },
    });
    expect(JSON.stringify(thrown)).not.toContain('SECRET_VALUE');
  });

  test('empty-success form Schema remains read-invalid instead of managed missing', async () => {
    const normalizedResult = normalizeManifest(baseManifest());
    const visitor = getResource(normalizedResult.normalized, 'form', 'visitor');
    const state = createBoundState(normalizedResult);

    await expect(readObservedResources([visitor], state, {
      services: {
        readFormSchema: jest.fn(async () => ({
          success: true,
          content: '',
        })),
      },
    })).rejects.toMatchObject({
      code: 'SCHEMA_OBSERVED_STRUCTURE_MISMATCH',
      details: { resourceType: 'form' },
    });
  });

  test('controlled app missing provenance becomes a missing observed resource', async () => {
    const normalizedResult = normalizeManifest(baseManifest());
    const app = getResource(normalizedResult.normalized, 'app', 'visitorApp');
    const state = createBoundState(normalizedResult);

    const result = await readObservedResources([app], state, {
      services: {
        readApp: jest.fn(async () => {
          const error = new Error('APP_STATE token SECRET_VALUE');
          error.code = 'APP_READ_NOT_FOUND';
          throw error;
        }),
      },
    });

    expect(result).toEqual({
      resources: [],
      missingResources: [{ resourceType: 'app', key: 'visitorApp' }],
    });
    expect(JSON.stringify(result)).not.toContain('APP_STATE');
    expect(JSON.stringify(result)).not.toContain('SECRET_VALUE');
  });

  test.each([
    ['forged legacy property', { __schemaRemoteMissing: true }],
    ['plain missing code', { code: 'SCHEMA_REMOTE_RESOURCE_MISSING' }],
    ['generic 404', { code: '404', statusCode: 404 }],
    ['generic 500', { code: '500', statusCode: 500 }],
  ])('treats %s as a remote read failure instead of missing', async (_label, properties) => {
    const normalizedResult = normalizeManifest(baseManifest());
    const app = getResource(normalizedResult.normalized, 'app', 'visitorApp');
    const state = createBoundState(normalizedResult);
    let thrown;

    try {
      await readObservedResources([app], state, {
        services: {
          readApp: jest.fn(async () => {
            throw Object.assign(new Error('APP_STATE token SECRET_VALUE /internal/path'), properties);
          }),
        },
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({ code: 'SCHEMA_REMOTE_READ_FAILED' });
    expect(JSON.stringify(thrown)).not.toContain('APP_STATE');
    expect(JSON.stringify(thrown)).not.toContain('SECRET_VALUE');
    expect(JSON.stringify(thrown)).not.toContain('/internal/path');
  });

  test('remote projection failures use a stable sanitized error', async () => {
    const registry = new ResourceRegistry().register({
      resourceType: 'app',
      adapterVersion: 1,
      validate() {},
      normalize() {
        return { resourceType: 'app', key: 'visitorApp', desired: {}, dependsOn: [] };
      },
      async readObserved() {
        return {};
      },
      projectObserved() {
        throw new TypeError('projection token SECRET_VALUE failed');
      },
    });
    const state = createEmptyState(environmentInput());
    const bound = upsertResourceState(state, {
      resourceType: 'app',
      key: 'visitorApp',
      adapterVersion: 1,
      bindings: { appType: 'APP_STATE' },
    }, { registry });

    let thrown;
    try {
      await readObservedResources([
        { resourceType: 'app', key: 'visitorApp', desired: {}, dependsOn: [] },
      ], bound, { registry });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      code: 'SCHEMA_REMOTE_PROJECT_FAILED',
      details: {
        resourceType: 'app',
        key: 'visitorApp',
      },
    });
    expect(JSON.stringify(thrown)).not.toContain('SECRET_VALUE');
  });

  test('remote reader rejects an invalid adapter-provided remoteSchemaHash', async () => {
    const registry = new ResourceRegistry().register({
      resourceType: 'app',
      adapterVersion: 1,
      validate() {},
      normalize() {
        return { resourceType: 'app', key: 'visitorApp', desired: {}, dependsOn: [] };
      },
      async readObserved() {
        return {};
      },
      projectObserved() {
        return {
          managed: {},
          remoteSchemaHash: 'invalid-hash',
        };
      },
    });
    const state = upsertResourceState(createEmptyState(environmentInput()), {
      resourceType: 'app',
      key: 'visitorApp',
      adapterVersion: 1,
      bindings: { appType: 'APP_STATE' },
    }, { registry });

    await expect(readObservedResources([
      { resourceType: 'app', key: 'visitorApp', desired: {}, dependsOn: [] },
    ], state, { registry })).rejects.toMatchObject({
      code: 'SCHEMA_INTERNAL_ERROR',
    });
  });

  test('remote reader rejects incompatible state adapterVersion before reading', async () => {
    const normalizedResult = normalizeManifest(baseManifest());
    const visitor = getResource(normalizedResult.normalized, 'form', 'visitor');
    const state = createBoundState(normalizedResult);
    state.resources.form.visitor.adapterVersion = 999;

    await expect(readObservedResources([visitor], state, {
      services: {
        readFormSchema: jest.fn(async () => {
          throw new Error('should not read');
        }),
      },
    })).rejects.toMatchObject({
      code: 'SCHEMA_STATE_ADAPTER_VERSION_UNSUPPORTED',
      details: {
        resourceType: 'form',
        key: 'visitor',
        stateAdapterVersion: 999,
        adapterVersion: 1,
      },
    });
  });

  test('bound managed field missing remotely projects partial observed state without label fallback', async () => {
    const normalizedResult = normalizeManifest(baseManifest());
    const visitor = getResource(normalizedResult.normalized, 'form', 'visitor');
    const compiled = compileVisitorSchema(visitor);
    const state = createBoundState(normalizedResult);
    state.resources.form.visitor.bindings.fieldBindings.amount.fieldId = 'numberField_missing';

    const observed = await readObservedResources([visitor], state, {
      services: createObservedServices(compiled.schema),
    });
    const projected = observed.resources[0];
    expect(projected.managed.fields.some(field => field.semanticPath === 'amount')).toBe(false);
    expect(projected.bindings.fieldBindings.amount).toBeUndefined();
    expect(JSON.stringify(projected)).not.toContain('numberField_missing');
  });

  test('missing or ambiguous fieldId identity fails closed before projection', async () => {
    const normalizedResult = normalizeManifest(baseManifest());
    const visitor = getResource(normalizedResult.normalized, 'form', 'visitor');
    const compiled = compileVisitorSchema(visitor);

    const missingBinding = createBoundState(normalizedResult);
    delete missingBinding.resources.form.visitor.bindings.fieldBindings.amount;
    await expect(readObservedResources([visitor], missingBinding, {
      services: createObservedServices(compiled.schema),
    })).rejects.toMatchObject({
      code: 'SCHEMA_OBSERVED_BINDING_MISSING',
      details: { semanticPath: 'amount' },
    });

    const duplicateBinding = createBoundState(normalizedResult);
    duplicateBinding.resources.form.visitor.bindings.fieldBindings.amount.fieldId = 'textField_first';
    await expect(readObservedResources([visitor], duplicateBinding, {
      services: createObservedServices(compiled.schema),
    })).rejects.toMatchObject({
      code: 'SCHEMA_OBSERVED_BINDING_AMBIGUOUS',
      details: { semanticPath: 'firstName' },
    });

    const duplicateRemote = JSON.parse(JSON.stringify(compiled.schema));
    findComponentByFieldId(duplicateRemote, 'numberField_amount').props.fieldId = 'textField_first';
    await expect(readObservedResources([visitor], createBoundState(normalizedResult), {
      services: createObservedServices(duplicateRemote),
    })).rejects.toMatchObject({
      code: 'SCHEMA_OBSERVED_BINDING_AMBIGUOUS',
      details: { resourceType: 'form' },
    });
  });

  test('association form projection requires an unambiguous state formUuid mapping', async () => {
    const normalizedResult = normalizeManifest(baseManifest());
    const visitor = getResource(normalizedResult.normalized, 'form', 'visitor');
    const compiled = compileVisitorSchema(visitor);
    const missing = createBoundState(normalizedResult);
    delete missing.resources.form.customer;

    await expect(readObservedResources([visitor], missing, {
      services: createObservedServices(compiled.schema),
    })).rejects.toMatchObject({
      code: 'SCHEMA_OBSERVED_REFERENCE_MISSING',
      details: {
        semanticPath: 'customerRef',
      },
    });

    const ambiguous = createBoundState(normalizedResult);
    ambiguous.resources.form.duplicateCustomer = JSON.parse(JSON.stringify(ambiguous.resources.form.customer));
    ambiguous.resources.form.duplicateCustomer.bindings.appType = '';
    findComponentByFieldId(compiled.schema, 'associationFormField_customer').props.associationForm.appType = '';
    await expect(readObservedResources([visitor], ambiguous, {
      services: createObservedServices(compiled.schema),
    })).rejects.toMatchObject({
      code: 'SCHEMA_OBSERVED_REFERENCE_AMBIGUOUS',
      details: {
        semanticPath: 'customerRef',
      },
    });
  });

  test('subtable projection validates actual parentFieldId instead of labels', async () => {
    const normalizedResult = normalizeManifest(baseManifest());
    const visitor = getResource(normalizedResult.normalized, 'form', 'visitor');
    const compiled = compileVisitorSchema(visitor);
    const state = createBoundState(normalizedResult);

    const topLevelSchema = JSON.parse(JSON.stringify(compiled.schema));
    moveFieldToTopLevel(topLevelSchema, 'textField_itemName');
    await expect(readObservedResources([visitor], state, {
      services: createObservedServices(topLevelSchema),
    })).rejects.toMatchObject({
      code: 'SCHEMA_OBSERVED_STRUCTURE_MISMATCH',
      details: {
        semanticPath: 'items.itemName',
        expectedParentBound: true,
        actualParentBound: false,
      },
    });

    const anotherTableSchema = JSON.parse(JSON.stringify(compiled.schema));
    moveFieldToAnotherTable(anotherTableSchema, 'textField_itemName');
    await expect(readObservedResources([visitor], state, {
      services: createObservedServices(anotherTableSchema),
    })).rejects.toMatchObject({
      code: 'SCHEMA_OBSERVED_STRUCTURE_MISMATCH',
      details: {
        semanticPath: 'items.itemName',
        expectedParentBound: true,
        actualParentBound: true,
      },
    });
  });
});
