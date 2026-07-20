'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { flattenCommandManifest } = require('../lib/core/command-manifest');
const { compileFormDefinition } = require('../lib/app/services/form-compiler');
const { loadManifest, readManifestFileBounded } = require('../lib/schema/manifest-loader');
const { MANIFEST_INPUT_LIMITS } = require('../lib/schema/manifest-limits');
const { normalizeManifest } = require('../lib/schema/normalize-manifest');
const { run: runSchemaCommand } = require('../lib/schema/command');
const { appAdapter } = require('../lib/schema/adapters/app-adapter');
const { formAdapter } = require('../lib/schema/adapters/form-adapter');
const { createDefaultRegistry, ResourceRegistry } = require('../lib/schema/resource-registry');

const ROOT = path.join(__dirname, '..');
const BIN = path.join(ROOT, 'bin', 'yida.js');

let tempDir;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-schema-validate-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function writeManifest(value) {
  const file = path.join(tempDir, 'app.yida.json');
  fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2), 'utf8');
  return file;
}

function writeManifestAt(root, relativePath, value) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2), 'utf8');
  return file;
}

function collectStdout() {
  let value = '';
  return {
    stream: { write(chunk) { value += chunk; } },
    value() { return value; },
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
        title: 'Visitor Registration',
        fields: {
          visitorName: {
            type: 'TextField',
            label: 'Visitor name',
            required: true,
          },
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

function getResource(result, resourceType, key) {
  return result.normalized.resources.find(resource => (
    resource.resourceType === resourceType && resource.key === key
  ));
}

function collectComponents(component, result = []) {
  if (!component || typeof component !== 'object') {
    return result;
  }
  if (component.componentName) {
    result.push(component);
  }
  if (Array.isArray(component)) {
    component.forEach(child => collectComponents(child, result));
    return result;
  }
  Object.keys(component).forEach(key => collectComponents(component[key], result));
  return result;
}

function findFieldComponent(schema, semanticKey) {
  const components = collectComponents(schema);
  return components.find(component => (
    component.props &&
    component.props.label &&
    component.props.label.zh_CN === semanticKey
  ));
}

function nestedObject(depth) {
  const root = {};
  let cursor = root;
  for (let index = 0; index < depth; index++) {
    cursor.child = {};
    cursor = cursor.child;
  }
  return root;
}

describe('schema validate local manifest', () => {
  test('normalizes a valid app + forms manifest and never exposes fieldId', () => {
    const result = normalizeManifest(baseManifest());

    expect(result.manifestHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.counts).toEqual({
      resources: 3,
      dependencies: 2,
    });
    expect(JSON.stringify(result.normalized)).not.toContain('fieldId');
    expect(result.normalized.resources.map(resource => `${resource.resourceType}:${resource.key}`)).toEqual([
      'app:visitorApp',
      'form:customer',
      'form:visitor',
    ]);
  });

  test('manifest hash is deterministic across object order changes', () => {
    const left = baseManifest();
    const right = {
      schemaVersion: 1,
      forms: {
        customer: left.forms.customer,
        visitor: {
          fields: {
            items: left.forms.visitor.fields.items,
            visitorName: left.forms.visitor.fields.visitorName,
          },
          title: left.forms.visitor.title,
        },
      },
      app: {
        name: left.app.name,
        key: left.app.key,
      },
      kind: left.kind,
    };

    expect(normalizeManifest(left).manifestHash).toBe(normalizeManifest(right).manifestHash);
  });

  test('legacy manifests without mode or processes retain their normalized output and hash', () => {
    const result = normalizeManifest(baseManifest());

    expect(result.manifestHash).toBe('sha256:3c3a2f8805a2f1e3e72aac85105cfadd35f88e8eaf34f35f2fb587ca7ccdfc73');
    expect(JSON.stringify(result.normalized)).toBe(JSON.stringify({
      resources: [
        {
          resourceType: 'app',
          key: 'visitorApp',
          desired: { key: 'visitorApp', name: 'Visitor App' },
          dependsOn: [],
        },
        {
          resourceType: 'form',
          key: 'customer',
          desired: {
            title: 'Customer',
            fields: [
              {
                key: 'companyName',
                semanticPath: 'companyName',
                type: 'TextField',
                label: 'Company name',
              },
            ],
          },
          dependsOn: ['app:visitorApp'],
        },
        {
          resourceType: 'form',
          key: 'visitor',
          desired: {
            title: 'Visitor Registration',
            fields: [
              {
                key: 'items',
                semanticPath: 'items',
                type: 'TableField',
                label: 'Items',
                children: [
                  {
                    key: 'itemName',
                    semanticPath: 'items.itemName',
                    type: 'TextField',
                    label: 'Item name',
                  },
                ],
              },
              {
                key: 'visitorName',
                semanticPath: 'visitorName',
                type: 'TextField',
                label: 'Visitor name',
                required: true,
              },
            ],
          },
          dependsOn: ['app:visitorApp'],
        },
      ],
    }));
  });

  test('legacy manifests do not require a process adapter in an injected registry', () => {
    const registry = new ResourceRegistry()
      .register(appAdapter)
      .register(formAdapter);

    expect(normalizeManifest(baseManifest(), { registry }).manifestHash)
      .toBe('sha256:3c3a2f8805a2f1e3e72aac85105cfadd35f88e8eaf34f35f2fb587ca7ccdfc73');
  });

  test('manifest path trust root accepts in-root relative and absolute paths and rejects escapes', async () => {
    const workspace = path.join(tempDir, 'workspace');
    const outside = path.join(tempDir, 'outside');
    fs.mkdirSync(workspace, { recursive: true });
    fs.mkdirSync(outside, { recursive: true });
    const insideFile = writeManifestAt(workspace, 'nested/app.yida.json', baseManifest());
    const outsideFile = writeManifestAt(outside, 'app.yida.json', baseManifest());

    const relativeStdout = collectStdout();
    const relativePayload = await runSchemaCommand([
      'validate',
      'nested/app.yida.json',
      '--json',
      '--quiet',
    ], {
      projectRoot: workspace,
      setExitCode: false,
      stdout: relativeStdout.stream,
    });
    expect(relativePayload.success).toBe(true);

    const absoluteStdout = collectStdout();
    const absolutePayload = await runSchemaCommand([
      'validate',
      insideFile,
      '--json',
      '--quiet',
    ], {
      projectRoot: workspace,
      setExitCode: false,
      stdout: absoluteStdout.stream,
    });
    expect(absolutePayload.success).toBe(true);

    const externalStdout = collectStdout();
    const externalPayload = await runSchemaCommand([
      'validate',
      outsideFile,
      '--json',
      '--quiet',
    ], {
      projectRoot: workspace,
      setExitCode: false,
      stdout: externalStdout.stream,
    });
    expect(externalPayload).toMatchObject({
      success: false,
      error: { code: 'SCHEMA_MANIFEST_PATH_UNSAFE' },
    });

    const linkPath = path.join(workspace, 'escape.yida.json');
    fs.symlinkSync(outsideFile, linkPath);
    const symlinkStdout = collectStdout();
    const symlinkPayload = await runSchemaCommand([
      'validate',
      'escape.yida.json',
      '--json',
      '--quiet',
    ], {
      projectRoot: workspace,
      setExitCode: false,
      stdout: symlinkStdout.stream,
    });
    expect(symlinkPayload).toMatchObject({
      success: false,
      error: { code: 'SCHEMA_MANIFEST_PATH_UNSAFE' },
    });
  });

  test('manifest input limits fail closed with stable SCHEMA errors and no manifest echo', async () => {
    const file = writeManifest(baseManifest());
    const stdout = collectStdout();
    const tooLarge = await runSchemaCommand([
      'validate',
      file,
      '--json',
      '--quiet',
    ], {
      manifestLimits: { maxBytes: 8 },
      projectRoot: tempDir,
      setExitCode: false,
      stdout: stdout.stream,
    });
    expect(tooLarge).toMatchObject({
      success: false,
      error: { code: 'SCHEMA_MANIFEST_TOO_LARGE' },
    });
    expect(stdout.value()).not.toContain('Visitor App');

    expect(() => loadManifest(file, {
      limits: { maxDepth: 2 },
      workspaceRoot: tempDir,
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_MANIFEST_DEPTH_LIMIT_EXCEEDED',
    }));

    expect(() => loadManifest(file, {
      limits: { maxNodes: 2 },
      workspaceRoot: tempDir,
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_MANIFEST_NODE_LIMIT_EXCEEDED',
    }));

    expect(() => loadManifest(file, {
      limits: { maxCollectionItems: 2 },
      workspaceRoot: tempDir,
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_MANIFEST_COLLECTION_LIMIT_EXCEEDED',
    }));

    const longString = baseManifest();
    longString.app.name = 'X'.repeat(21);
    const longStringFile = writeManifest(longString);
    expect(() => loadManifest(longStringFile, {
      limits: { maxStringLength: 20 },
      workspaceRoot: tempDir,
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_MANIFEST_STRING_LIMIT_EXCEEDED',
    }));
  });

  test('manifest limit overrides can only tighten frozen production limits', () => {
    const largeFile = path.join(tempDir, 'large.yida.json');
    fs.writeFileSync(largeFile, Buffer.alloc(MANIFEST_INPUT_LIMITS.maxBytes + 1, 0x20));
    expect(() => loadManifest(largeFile, {
      limits: { maxBytes: MANIFEST_INPUT_LIMITS.maxBytes + 1024 },
      workspaceRoot: tempDir,
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_MANIFEST_TOO_LARGE',
    }));

    expect(() => normalizeManifest(nestedObject(MANIFEST_INPUT_LIMITS.maxDepth + 1), {
      limits: { maxDepth: MANIFEST_INPUT_LIMITS.maxDepth + 100 },
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_MANIFEST_DEPTH_LIMIT_EXCEEDED',
    }));
  });

  test.each([Infinity, 0, -1, 1.5, '8'])('invalid manifest limit override %p fails closed without echoing input', (value) => {
    const file = writeManifest(baseManifest());
    let thrown;
    try {
      loadManifest(file, {
        limits: { maxBytes: value },
        workspaceRoot: tempDir,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      code: 'SCHEMA_MANIFEST_LIMIT_INVALID',
      message: 'Manifest input limit override is invalid.',
    });
    expect(thrown.path).toBeUndefined();
    expect(thrown.details).toBeUndefined();
    expect(JSON.stringify(thrown)).not.toContain(String(value));
  });

  test('manifest file read is bounded to maxBytes plus one byte on the same fd', () => {
    const data = Buffer.from('12345SHOULD_NOT_READ');
    const readCalls = [];
    const fsImpl = {
      constants: { O_RDONLY: 0 },
      openSync: jest.fn(() => 42),
      fstatSync: jest.fn(() => ({ isFile: () => true, size: 4 })),
      readSync: jest.fn((fd, buffer, offset, length) => {
        readCalls.push({ fd, offset, length });
        if (length > 5) {
          throw new Error('read past bounded limit');
        }
        return data.copy(buffer, offset, 0, Math.min(length, data.length));
      }),
      closeSync: jest.fn(),
    };

    expect(() => readManifestFileBounded('/fake/app.yida.json', {
      fsImpl,
      limits: { maxBytes: 4 },
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_MANIFEST_TOO_LARGE',
    }));
    expect(fsImpl.openSync).toHaveBeenCalledTimes(1);
    expect(fsImpl.fstatSync).toHaveBeenCalledWith(42);
    expect(fsImpl.readSync).toHaveBeenCalledTimes(1);
    expect(readCalls[0]).toMatchObject({ fd: 42, offset: 0, length: 5 });
    expect(fsImpl.closeSync).toHaveBeenCalledWith(42);
  });

  test.each([
    ['depth', () => normalizeManifest(nestedObject(3), { limits: { maxDepth: 2 } }), 'SCHEMA_MANIFEST_DEPTH_LIMIT_EXCEEDED'],
    ['node', () => normalizeManifest(baseManifest(), { limits: { maxNodes: 2 } }), 'SCHEMA_MANIFEST_NODE_LIMIT_EXCEEDED'],
    ['collection', () => normalizeManifest({ a: 1, b: 2, c: 3 }, { limits: { maxCollectionItems: 2 } }), 'SCHEMA_MANIFEST_COLLECTION_LIMIT_EXCEEDED'],
    ['string', () => normalizeManifest({ app: { name: 'X'.repeat(21) } }, { limits: { maxStringLength: 20 } }), 'SCHEMA_MANIFEST_STRING_LIMIT_EXCEEDED'],
    ['cycle', () => {
      const value = {};
      value.self = value;
      return normalizeManifest(value);
    }, 'SCHEMA_MANIFEST_STRUCTURE_UNSUPPORTED'],
    ['non-plain object', () => normalizeManifest(new Date()), 'SCHEMA_MANIFEST_STRUCTURE_UNSUPPORTED'],
  ])('direct object manifest limit rejects %s with stable schema error', (caseName, run, code) => {
    expect(run).toThrow(expect.objectContaining({ code }));
  });

  test('normalizes explicit form mode and the minimal process managed IR locally', () => {
    const manifest = baseManifest();
    manifest.forms.visitor.mode = 'process';
    manifest.processes = {
      visitorApproval: {
        form: 'visitor',
        nodes: [
          {
            key: 'managerApproval',
            type: 'approval',
            name: 'Manager approval',
            approver: 'originator',
          },
        ],
      },
    };

    const result = normalizeManifest(manifest);
    expect(result.counts).toEqual({ resources: 4, dependencies: 3 });
    expect(getResource(result, 'form', 'visitor').desired.mode).toBe('process');
    expect(getResource(result, 'process', 'visitorApproval')).toEqual({
      resourceType: 'process',
      key: 'visitorApproval',
      desired: {
        form: 'form:visitor',
        nodes: [
          {
            key: 'managerApproval',
            type: 'approval',
            name: 'Manager approval',
            approver: 'originator',
          },
        ],
      },
      dependsOn: ['form:visitor'],
    });

    const adapter = createDefaultRegistry().get('process');
    expect(adapter).not.toHaveProperty('capabilities');
    expect(adapter.readObserved).toEqual(expect.any(Function));
    expect(adapter.create).toEqual(expect.any(Function));
    expect(adapter.advanceStagedCheckpoint).toEqual(expect.any(Function));
    expect(adapter.validateStageCheckpoint).toEqual(expect.any(Function));
  });

  test('resource registry rejects the legacy capability matrix and invalid optional methods', () => {
    const baseAdapter = {
      resourceType: 'synthetic',
      adapterVersion: 1,
      normalize(value) { return value; },
      validate() {},
    };

    expect(() => new ResourceRegistry().register({
      ...baseAdapter,
      capabilities: { normalize: true, validate: true },
    })).toThrow('Resource adapter declares an unknown contract property: capabilities');

    expect(() => new ResourceRegistry().register({
      ...baseAdapter,
      create: true,
    })).toThrow('Resource adapter method must be a function create: synthetic');

    expect(createDefaultRegistry().listTypes()).toEqual(['app', 'form', 'page', 'process']);
  });

  test('resource registry snapshots own data-property methods and rejects hidden callable surfaces', () => {
    const inherited = Object.create({ create() {} });
    Object.assign(inherited, {
      resourceType: 'inherited',
      adapterVersion: 1,
      normalize(value) { return value; },
      validate() {},
    });
    expect(() => new ResourceRegistry().register(inherited)).toThrow(
      'Resource adapter must not inherit contract properties'
    );

    let getterCalls = 0;
    const accessor = {
      resourceType: 'accessor',
      adapterVersion: 1,
      normalize(value) { return value; },
      validate() {},
    };
    Object.defineProperty(accessor, 'create', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return () => {};
      },
    });
    expect(() => new ResourceRegistry().register(accessor)).toThrow(
      'Resource adapter contract properties must be data properties: create'
    );
    expect(getterCalls).toBe(0);

    expect(() => new ResourceRegistry().register({
      resourceType: 'unknown',
      adapterVersion: 1,
      normalize(value) { return value; },
      validate() {},
      delete() {},
    })).toThrow('Resource adapter declares an unknown contract property: delete');

    const mutable = {
      resourceType: 'stable',
      adapterVersion: 1,
      validate() {},
      normalize(value) { return `${this.resourceType}:${value}`; },
    };
    const registry = new ResourceRegistry().register(mutable);
    const snapshot = registry.get('stable');
    mutable.resourceType = 'mutated';
    mutable.normalize = () => 'mutated';
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(snapshot.normalize('value')).toBe('stable:value');
  });

  test('canonicalizes equivalent process form references for normalized IR and hash', () => {
    const left = baseManifest();
    left.forms.visitor.mode = 'process';
    left.processes = {
      visitorApproval: {
        form: 'visitor',
        nodes: [{ key: 'approval', type: 'approval', name: 'Approval', approver: 'originator' }],
      },
    };
    const right = JSON.parse(JSON.stringify(left));
    right.processes.visitorApproval.form = 'form:visitor';

    const leftResult = normalizeManifest(left);
    const rightResult = normalizeManifest(right);
    expect(leftResult.normalized).toEqual(rightResult.normalized);
    expect(leftResult.manifestHash).toBe(rightResult.manifestHash);
  });

  test('requires process forms to declare process mode explicitly', () => {
    const manifest = baseManifest();
    manifest.processes = {
      visitorApproval: {
        form: 'visitor',
        nodes: [{ key: 'approval', type: 'approval', name: 'Approval', approver: 'originator' }],
      },
    };

    expect(() => normalizeManifest(manifest)).toThrow(expect.objectContaining({
      code: 'SCHEMA_PROCESS_FORM_MODE_REQUIRED',
      path: '/processes/visitorApproval/form',
    }));

    manifest.forms.visitor.mode = 'receipt';
    expect(() => normalizeManifest(manifest)).toThrow(expect.objectContaining({
      code: 'SCHEMA_PROCESS_FORM_MODE_REQUIRED',
    }));
  });

  test('requires explicit unique process node keys and rejects unsupported node semantics', () => {
    const missingKey = baseManifest();
    missingKey.forms.visitor.mode = 'process';
    missingKey.processes = {
      visitorApproval: {
        form: 'visitor',
        nodes: [{ type: 'approval', name: 'Approval', approver: 'originator' }],
      },
    };
    expect(() => normalizeManifest(missingKey)).toThrow(expect.objectContaining({
      code: 'SCHEMA_MANIFEST_SCHEMA_INVALID',
    }));

    const duplicate = baseManifest();
    duplicate.forms.visitor.mode = 'process';
    duplicate.processes = {
      visitorApproval: {
        form: 'visitor',
        nodes: [
          { key: 'approval', type: 'approval', name: 'First', approver: 'originator' },
          { key: 'approval', type: 'approval', name: 'Second', approver: 'originator' },
        ],
      },
    };
    expect(() => normalizeManifest(duplicate)).toThrow(expect.objectContaining({
      code: 'SCHEMA_DUPLICATE_KEY',
      path: '/processes/visitorApproval/nodes/1/key',
    }));

    const unsupportedType = baseManifest();
    unsupportedType.forms.visitor.mode = 'process';
    unsupportedType.processes = {
      visitorApproval: {
        form: 'visitor',
        nodes: [{ key: 'approval', type: 'approver', name: 'Approval', approver: 'originator' }],
      },
    };
    expect(() => normalizeManifest(unsupportedType)).toThrow(expect.objectContaining({
      code: 'SCHEMA_PROCESS_NODE_TYPE_UNSUPPORTED',
      path: '/processes/visitorApproval/nodes/0/type',
    }));

    const unsupportedApprover = baseManifest();
    unsupportedApprover.forms.visitor.mode = 'process';
    unsupportedApprover.processes = {
      visitorApproval: {
        form: 'visitor',
        nodes: [{ key: 'approval', type: 'approval', name: 'Approval', approver: 'manager' }],
      },
    };
    expect(() => normalizeManifest(unsupportedApprover)).toThrow(expect.objectContaining({
      code: 'SCHEMA_PROCESS_NODE_PROPERTY_INVALID',
      path: '/processes/visitorApproval/nodes/0/approver',
    }));
  });

  test('validates process references and strict process properties', () => {
    const dangling = baseManifest();
    dangling.processes = {
      visitorApproval: {
        form: 'missingForm',
        nodes: [{ key: 'approval', type: 'approval', name: 'Approval', approver: 'originator' }],
      },
    };
    expect(() => normalizeManifest(dangling)).toThrow(expect.objectContaining({
      code: 'SCHEMA_REFERENCE_NOT_FOUND',
      path: '/processes/visitorApproval/form',
    }));

    const wrongType = baseManifest();
    wrongType.processes = {
      visitorApproval: {
        form: 'app:visitorApp',
        nodes: [{ key: 'approval', type: 'approval', name: 'Approval', approver: 'originator' }],
      },
    };
    expect(() => normalizeManifest(wrongType)).toThrow(expect.objectContaining({
      code: 'SCHEMA_INVALID_REFERENCE',
    }));

    const unknownProperty = baseManifest();
    unknownProperty.forms.visitor.mode = 'process';
    unknownProperty.processes = {
      visitorApproval: {
        form: 'visitor',
        nodes: [{ key: 'approval', type: 'approval', name: 'Approval', approver: 'originator', label: 'No aliases' }],
      },
    };
    expect(() => normalizeManifest(unknownProperty)).toThrow(expect.objectContaining({
      code: 'SCHEMA_UNKNOWN_PROPERTY',
      path: '/processes/visitorApproval/nodes/0/label',
    }));
  });

  test('manifest hash canonicalizes equivalent form references and dependency ordering', () => {
    const left = baseManifest();
    left.forms.visitor.dependsOn = ['customer', 'app:visitorApp'];
    left.forms.visitor.fields.customerRef = {
      type: 'AssociationFormField',
      label: 'Customer',
      form: 'customer',
    };

    const right = baseManifest();
    right.forms.visitor.dependsOn = ['app:visitorApp', 'form:customer', 'customer'];
    right.forms.visitor.fields.customerRef = {
      type: 'AssociationFormField',
      label: 'Customer',
      form: 'form:customer',
    };

    const leftResult = normalizeManifest(left);
    const rightResult = normalizeManifest(right);
    expect(leftResult.normalized).toEqual(rightResult.normalized);
    expect(leftResult.manifestHash).toBe(rightResult.manifestHash);

    const visitor = getResource(leftResult, 'form', 'visitor');
    expect(visitor.dependsOn).toEqual(['app:visitorApp', 'form:customer']);
    expect(visitor.desired.fields.find(field => field.key === 'customerRef').form).toBe('form:customer');
    expect(JSON.stringify(visitor.desired)).not.toContain('"dependsOn"');
  });

  test('resource ordering uses deterministic code-point order for case-sensitive keys', () => {
    const manifest = {
      kind: 'openyida_app_manifest',
      schemaVersion: 1,
      app: { key: 'visitorApp', name: 'Visitor App' },
      forms: {
        zForm: { title: 'Z', fields: { name: { type: 'TextField', label: 'Name' } } },
        AForm: { title: 'A', fields: { name: { type: 'TextField', label: 'Name' } } },
        aForm: { title: 'a', fields: { name: { type: 'TextField', label: 'Name' } } },
      },
    };

    expect(normalizeManifest(manifest).normalized.resources.map(resource => `${resource.resourceType}:${resource.key}`)).toEqual([
      'app:visitorApp',
      'form:AForm',
      'form:aForm',
      'form:zForm',
    ]);
  });

  test('rejects missing or empty form fields', () => {
    const missing = baseManifest();
    delete missing.forms.visitor.fields;
    expect(() => normalizeManifest(missing)).toThrow(expect.objectContaining({
      code: 'SCHEMA_FORM_FIELDS_REQUIRED',
      path: '/forms/visitor/fields',
    }));

    const empty = baseManifest();
    empty.forms.visitor.fields = {};
    expect(() => normalizeManifest(empty)).toThrow(expect.objectContaining({
      code: 'SCHEMA_FORM_FIELDS_REQUIRED',
      path: '/forms/visitor/fields',
    }));
  });

  test('rejects field types and properties that the SAC-01 compiler cannot build', () => {
    const typo = baseManifest();
    typo.forms.visitor.fields.bad = { type: 'TextFiled', label: 'Bad' };
    expect(() => normalizeManifest(typo)).toThrow(expect.objectContaining({
      code: 'SCHEMA_FIELD_TYPE_UNSUPPORTED',
      path: '/forms/visitor/fields/bad/type',
    }));

    const textWithChildren = baseManifest();
    textWithChildren.forms.visitor.fields.visitorName.children = {
      child: { type: 'TextField', label: 'Child' },
    };
    expect(() => normalizeManifest(textWithChildren)).toThrow(expect.objectContaining({
      code: 'SCHEMA_FIELD_PROPERTY_INVALID',
      path: '/forms/visitor/fields/visitorName/children',
    }));

    const textWithForm = baseManifest();
    textWithForm.forms.visitor.fields.visitorName.form = 'customer';
    expect(() => normalizeManifest(textWithForm)).toThrow(expect.objectContaining({
      code: 'SCHEMA_FIELD_PROPERTY_INVALID',
      path: '/forms/visitor/fields/visitorName/form',
    }));

    const textWithOptions = baseManifest();
    textWithOptions.forms.visitor.fields.visitorName.options = ['A', 'B'];
    expect(() => normalizeManifest(textWithOptions)).toThrow(expect.objectContaining({
      code: 'SCHEMA_FIELD_PROPERTY_INVALID',
      path: '/forms/visitor/fields/visitorName/options',
    }));
  });

  test('accepts legal table, association form, and option fields', () => {
    const manifest = baseManifest();
    manifest.forms.visitor.fields.customerRef = {
      type: 'AssociationFormField',
      label: 'Customer',
      form: 'form:customer',
    };
    manifest.forms.visitor.fields.status = {
      type: 'SelectField',
      label: 'Status',
      options: ['Draft', 'Done'],
    };

    const visitor = getResource(normalizeManifest(manifest), 'form', 'visitor');
    expect(visitor.desired.fields.find(field => field.key === 'items').children).toEqual([
      expect.objectContaining({
        key: 'itemName',
        type: 'TextField',
      }),
    ]);
    expect(visitor.desired.fields.find(field => field.key === 'customerRef')).toMatchObject({
      type: 'AssociationFormField',
      form: 'form:customer',
    });
    expect(visitor.desired.fields.find(field => field.key === 'status')).toMatchObject({
      type: 'SelectField',
      options: [
        { label: 'Draft', value: 'Draft' },
        { label: 'Done', value: 'Done' },
      ],
    });
  });

  test('normalizes string and object options to the same managed shape', () => {
    const manifest = baseManifest();
    manifest.forms.visitor.fields.status = {
      type: 'SelectField',
      label: 'Status',
      options: ['Draft', { label: 'Done label', value: 'done' }],
    };

    const visitor = getResource(normalizeManifest(manifest), 'form', 'visitor');
    expect(visitor.desired.fields.find(field => field.key === 'status').options).toEqual([
      { label: 'Draft', value: 'Draft' },
      { label: 'Done label', value: 'done' },
    ]);
  });

  test('rejects blank string and object options consistently', () => {
    const stringOption = baseManifest();
    stringOption.forms.visitor.fields.status = {
      type: 'SelectField',
      label: 'Status',
      options: ['   '],
    };
    expect(() => normalizeManifest(stringOption)).toThrow(expect.objectContaining({
      code: 'SCHEMA_FIELD_PROPERTY_INVALID',
      path: '/forms/visitor/fields/status/options/0',
    }));

    const objectLabel = baseManifest();
    objectLabel.forms.visitor.fields.status = {
      type: 'SelectField',
      label: 'Status',
      options: [{ label: '   ', value: 'active' }],
    };
    expect(() => normalizeManifest(objectLabel)).toThrow(expect.objectContaining({
      code: 'SCHEMA_FIELD_PROPERTY_INVALID',
      path: '/forms/visitor/fields/status/options/0/label',
    }));

    const objectValue = baseManifest();
    objectValue.forms.visitor.fields.status = {
      type: 'SelectField',
      label: 'Status',
      options: [{ label: 'Active', value: '   ' }],
    };
    expect(() => normalizeManifest(objectValue)).toThrow(expect.objectContaining({
      code: 'SCHEMA_FIELD_PROPERTY_INVALID',
      path: '/forms/visitor/fields/status/options/0/value',
    }));
  });

  test('rejects properties that are not in the Manifest v1 managed-property matrix', () => {
    const appDescription = baseManifest();
    appDescription.app.description = 'Not reliably observed';
    expect(() => normalizeManifest(appDescription)).toThrow(expect.objectContaining({
      code: 'SCHEMA_UNKNOWN_PROPERTY',
      path: '/app/description',
    }));

    const formDescription = baseManifest();
    formDescription.forms.visitor.description = 'Not reliably observed';
    expect(() => normalizeManifest(formDescription)).toThrow(expect.objectContaining({
      code: 'SCHEMA_UNKNOWN_PROPERTY',
      path: '/forms/visitor/description',
    }));

    const fieldDescription = baseManifest();
    fieldDescription.forms.visitor.fields.visitorName.description = 'Not compiler-backed';
    expect(() => normalizeManifest(fieldDescription)).toThrow(expect.objectContaining({
      code: 'SCHEMA_UNKNOWN_PROPERTY',
      path: '/forms/visitor/fields/visitorName/description',
    }));

    const placeholder = baseManifest();
    placeholder.forms.visitor.fields.visitorName.placeholder = 'Not uniformly supported';
    expect(() => normalizeManifest(placeholder)).toThrow(expect.objectContaining({
      code: 'SCHEMA_UNKNOWN_PROPERTY',
      path: '/forms/visitor/fields/visitorName/placeholder',
    }));

    const defaultValue = baseManifest();
    defaultValue.forms.visitor.fields.visitorName.defaultValue = 'Alice';
    expect(() => normalizeManifest(defaultValue)).toThrow(expect.objectContaining({
      code: 'SCHEMA_UNKNOWN_PROPERTY',
      path: '/forms/visitor/fields/visitorName/defaultValue',
    }));
  });

  test('normalized Manifest form desired can compile through SAC-01 compiler with required validation', () => {
    const result = normalizeManifest(baseManifest());
    const visitor = getResource(result, 'form', 'visitor');
    const compiled = compileFormDefinition({
      title: visitor.desired.title,
      fields: visitor.desired.fields,
    });

    const visitorName = findFieldComponent(compiled.schema, 'Visitor name');
    expect(visitorName).toBeTruthy();
    expect(visitorName.props.validation).toEqual([
      expect.objectContaining({
        type: 'required',
      }),
    ]);
  });

  test('compiler validation props merge path works through shared deepMerge helper', () => {
    const compiled = compileFormDefinition({
      title: 'Deep merge form',
      fields: [{
        key: 'status',
        type: 'SelectField',
        label: 'Status',
        options: ['A', 'B'],
        remoteDataSource: {
          props: {
            searchConfig: {
              url: '/custom/search.json',
            },
            defaultDataSource: {
              searchConfig: {
                beforeFetch: 'function willFetch(params) { return params; }',
              },
            },
          },
        },
      }],
    });

    const status = findFieldComponent(compiled.schema, 'Status');
    expect(status).toBeTruthy();
    expect(status.props.searchConfig).toMatchObject({
      dataType: 'json',
      url: '/custom/search.json',
      afterFetch: expect.any(String),
      beforeFetch: expect.any(String),
    });
    expect(status.props.defaultDataSource.searchConfig).toMatchObject({
      type: 'JSON',
      url: '',
      afterFetch: expect.any(String),
      beforeFetch: 'function willFetch(params) { return params; }',
    });
  });

  test('rejects unknown properties strictly', () => {
    const manifest = baseManifest();
    manifest.app.color = '#1677ff';

    expect(() => normalizeManifest(manifest)).toThrow(expect.objectContaining({
      code: 'SCHEMA_UNKNOWN_PROPERTY',
      path: '/app/color',
    }));
  });

  test('rejects unknown top-level properties as unknown properties', () => {
    const manifest = baseManifest();
    manifest.widgets = {};

    expect(() => normalizeManifest(manifest)).toThrow(expect.objectContaining({
      code: 'SCHEMA_UNKNOWN_PROPERTY',
      path: '/widgets',
    }));
  });

  test('rejects environment IDs and sensitive configuration fields', () => {
    const manifest = baseManifest();
    manifest.app.appType = 'APP_SECRET';

    expect(() => normalizeManifest(manifest)).toThrow(expect.objectContaining({
      code: 'SCHEMA_FORBIDDEN_FIELD',
      path: '/app/appType',
    }));

    for (const forbiddenKey of ['processCode', 'ProcessID', 'process_version', 'nodeId']) {
      const processManifest = baseManifest();
      processManifest.forms.visitor.mode = 'process';
      processManifest.processes = {
        visitorApproval: {
          form: 'visitor',
          nodes: [{ key: 'approval', type: 'approval', name: 'Approval', approver: 'originator' }],
        },
      };
      processManifest.processes.visitorApproval[forbiddenKey] = 'MUST_NOT_LEAK';
      expect(() => normalizeManifest(processManifest)).toThrow(expect.objectContaining({
        code: 'SCHEMA_FORBIDDEN_FIELD',
        path: `/processes/visitorApproval/${forbiddenKey}`,
      }));
    }
  });

  test('rejects prototype-pollution keys before adapter normalization', () => {
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      const file = writeManifest(`{
        "kind": "openyida_app_manifest",
        "schemaVersion": 1,
        "app": {
          "key": "visitorApp",
          "name": "Visitor App",
          "${key}": "blocked"
        }
      }`);
      const manifest = loadManifest(file, { workspaceRoot: tempDir });
      expect(() => normalizeManifest(manifest)).toThrow(expect.objectContaining({
        code: 'SCHEMA_FORBIDDEN_FIELD',
        path: `/app/${key}`,
      }));
    }
  });

  test('rejects mixed-case and deeply nested sensitive keys without leaking values', () => {
    const manifest = baseManifest();
    manifest.forms.visitor.fields.visitorName.defaultValue = [{
      Authorization: 'Bearer SUPER_SECRET_VALUE',
    }];

    expect(() => normalizeManifest(manifest)).toThrow(expect.objectContaining({
      code: 'SCHEMA_FORBIDDEN_FIELD',
      path: '/forms/visitor/fields/visitorName/defaultValue/0/Authorization',
    }));

    const file = writeManifest(manifest);
    const result = spawnSync(process.execPath, [BIN, 'schema', 'validate', file, '--json', '--quiet'], {
      cwd: tempDir,
      env: { ...process.env, CI: '1', OPENYIDA_LANG: 'en' },
      encoding: 'utf8',
      timeout: 10000,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('SCHEMA_FORBIDDEN_FIELD');
    expect(result.stdout).toContain('Authorization');
    expect(result.stdout).not.toContain('SUPER_SECRET_VALUE');

    const labelOnly = baseManifest();
    labelOnly.forms.visitor.fields.visitorName.label = 'Token approval';
    expect(() => normalizeManifest(labelOnly)).not.toThrow();

    const apiKey = baseManifest();
    apiKey.forms.visitor.fields.visitorName.defaultValue = { Api_Key: 'SHOULD_NOT_LEAK' };
    expect(() => normalizeManifest(apiKey)).toThrow(expect.objectContaining({
      code: 'SCHEMA_FORBIDDEN_FIELD',
      path: '/forms/visitor/fields/visitorName/defaultValue/Api_Key',
    }));
  });

  test('rejects duplicate semantic keys before JSON.parse can overwrite them', () => {
    const file = writeManifest(`{
      "kind": "openyida_app_manifest",
      "schemaVersion": 1,
      "app": { "key": "visitorApp", "name": "Visitor App" },
      "forms": {
        "visitor": {
          "title": "Visitor",
          "fields": {
            "visitorName": { "type": "TextField", "label": "A" },
            "visitorName": { "type": "TextField", "label": "B" }
          }
        }
      }
    }`);

    expect(() => loadManifest(file, { workspaceRoot: tempDir })).toThrow(expect.objectContaining({
      code: 'SCHEMA_DUPLICATE_KEY',
      path: '/forms/visitor/fields/visitorName',
    }));
  });

  test('rejects dangling form references', () => {
    const manifest = baseManifest();
    manifest.forms.visitor.fields.customerRef = {
      type: 'AssociationFormField',
      label: 'Customer',
      form: 'missingCustomer',
    };

    expect(() => normalizeManifest(manifest)).toThrow(expect.objectContaining({
      code: 'SCHEMA_REFERENCE_NOT_FOUND',
      path: '/forms/visitor/fields/customerRef/form',
    }));
  });

  test('validates dependency and association reference resource types through registry', () => {
    const processDependency = baseManifest();
    processDependency.forms.visitor.dependsOn = ['process:approval'];
    expect(() => normalizeManifest(processDependency)).toThrow(expect.objectContaining({
      code: 'SCHEMA_DEPENDENCY_NOT_FOUND',
    }));

    const unknownDependencyType = baseManifest();
    unknownDependencyType.forms.visitor.dependsOn = ['widget:chart'];
    expect(() => normalizeManifest(unknownDependencyType)).toThrow(expect.objectContaining({
      code: 'SCHEMA_RESOURCE_TYPE_UNSUPPORTED',
    }));

    const appAssociation = baseManifest();
    appAssociation.forms.visitor.fields.customerRef = {
      type: 'AssociationFormField',
      label: 'Customer',
      form: 'app:visitorApp',
    };
    expect(() => normalizeManifest(appAssociation)).toThrow(expect.objectContaining({
      code: 'SCHEMA_INVALID_REFERENCE',
    }));

    const processAssociation = baseManifest();
    processAssociation.forms.visitor.fields.customerRef = {
      type: 'AssociationFormField',
      label: 'Customer',
      form: 'process:approval',
    };
    expect(() => normalizeManifest(processAssociation)).toThrow(expect.objectContaining({
      code: 'SCHEMA_INVALID_REFERENCE',
    }));

    const validReferences = baseManifest();
    validReferences.forms.visitor.dependsOn = ['app:visitorApp', 'form:customer'];
    validReferences.forms.visitor.fields.customerRef = {
      type: 'AssociationFormField',
      label: 'Customer',
      form: 'form:customer',
    };
    const visitor = getResource(normalizeManifest(validReferences), 'form', 'visitor');
    expect(visitor.dependsOn).toEqual(['app:visitorApp', 'form:customer']);
  });

  test('rejects dependency cycles', () => {
    const manifest = baseManifest();
    manifest.forms.visitor.dependsOn = ['customer'];
    manifest.forms.customer.dependsOn = ['visitor'];

    expect(() => normalizeManifest(manifest)).toThrow(expect.objectContaining({
      code: 'SCHEMA_DEPENDENCY_CYCLE',
    }));
  });

  test('remaining known future resource sections return unsupported resource errors', () => {
    for (const section of ['automations', 'reports']) {
      const manifest = baseManifest();
      manifest[section] = { futureResource: {} };

      expect(() => normalizeManifest(manifest)).toThrow(expect.objectContaining({
        code: 'SCHEMA_RESOURCE_TYPE_UNSUPPORTED',
        path: `/${section}`,
      }));
    }
  });

  test('schema validate --json --quiet accepts process IR without exposing it', () => {
    const manifest = baseManifest();
    manifest.forms.visitor.mode = 'process';
    manifest.processes = {
      visitorApproval: {
        form: 'form:visitor',
        nodes: [{ key: 'approval', type: 'approval', name: 'Approval', approver: 'originator' }],
      },
    };
    const file = writeManifest(manifest);
    const result = spawnSync(process.execPath, [BIN, 'schema', 'validate', file, '--json', '--quiet'], {
      cwd: tempDir,
      env: { ...process.env, CI: '1', OPENYIDA_LANG: 'en' },
      encoding: 'utf8',
      timeout: 10000,
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    const lines = result.stdout.trim().split('\n');
    expect(lines).toHaveLength(1);
    const payload = JSON.parse(lines[0]);
    expect(payload).toMatchObject({
      kind: 'openyida_schema_validation',
      contractVersion: 1,
      success: true,
      counts: { resources: 4, dependencies: 3 },
    });
    expect(payload.normalized).toBeUndefined();
    expect(result.stdout).not.toContain('visitorApproval');
    expect(result.stdout).not.toContain('"nodes"');
  });

  test('schema validate --json --quiet writes exactly one compact JSON object', () => {
    const file = writeManifest(baseManifest());
    const result = spawnSync(process.execPath, [BIN, 'schema', 'validate', file, '--json', '--quiet'], {
      cwd: tempDir,
      env: { ...process.env, CI: '1', OPENYIDA_LANG: 'en' },
      encoding: 'utf8',
      timeout: 10000,
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    const lines = result.stdout.trim().split('\n');
    expect(lines).toHaveLength(1);
    const payload = JSON.parse(lines[0]);
    expect(payload).toMatchObject({
      kind: 'openyida_schema_validation',
      contractVersion: 1,
      success: true,
      counts: {
        resources: 3,
        dependencies: 2,
      },
    });
    expect(payload.normalized).toBeUndefined();
    expect(payload).not.toHaveProperty('action');
  });

  test('schema validate returns deterministic actions for invalid and unsupported manifests', async () => {
    const invalid = baseManifest();
    invalid.app.appType = 'APP_SECRET';
    const invalidPayload = await runSchemaCommand([
      'validate', writeManifest(invalid), '--json', '--quiet',
    ], {
      projectRoot: tempDir,
      setExitCode: false,
      stdout: collectStdout().stream,
    });

    expect(invalidPayload.action).toEqual({
      errorCode: 'SCHEMA_FORBIDDEN_FIELD',
      classification: 'security_failure',
      safeToRetry: false,
      nextAction: 'fix_security_boundary',
      blockText: invalidPayload.error.message,
    });
    expect(invalidPayload.action).not.toHaveProperty('choices');

    const unsupported = baseManifest();
    unsupported.reports = { summary: {} };
    const unsupportedPayload = await runSchemaCommand([
      'validate', writeManifest(unsupported), '--json', '--quiet',
    ], {
      projectRoot: tempDir,
      setExitCode: false,
      stdout: collectStdout().stream,
    });

    expect(unsupportedPayload.action).toEqual({
      errorCode: 'SCHEMA_RESOURCE_TYPE_UNSUPPORTED',
      classification: 'unsupported',
      safeToRetry: false,
      nextAction: 'remove_unsupported_manifest_content',
      blockText: unsupportedPayload.error.message,
    });
    expect(unsupportedPayload.action).not.toHaveProperty('choices');
  });

  test('schema validate --json --quiet writes quiet structured failures', () => {
    const manifest = baseManifest();
    manifest.pages = { home: { title: 'Home' } };
    const file = writeManifest(manifest);
    const result = spawnSync(process.execPath, [BIN, 'schema', 'validate', file, '--json', '--quiet'], {
      cwd: tempDir,
      env: { ...process.env, CI: '1', OPENYIDA_LANG: 'en' },
      encoding: 'utf8',
      timeout: 10000,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    const lines = result.stdout.trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({
      kind: 'openyida_schema_validation',
      contractVersion: 1,
      success: false,
      error: {
        code: 'SCHEMA_MANIFEST_SCHEMA_INVALID',
        path: '/pages/home',
      },
      action: {
        errorCode: 'SCHEMA_MANIFEST_SCHEMA_INVALID',
        classification: 'validation_failure',
        safeToRetry: false,
        nextAction: 'fix_manifest',
      },
    });
  });

  test('schema validate failures perform zero remote reads and zero state or bindings writes', async () => {
    const manifest = baseManifest();
    manifest.app.appType = 'APP_SECRET';
    const file = writeManifest(manifest);
    const stdout = collectStdout();
    const stderr = collectStdout();
    const readObservedResources = jest.fn();
    const loadCookieData = jest.fn();
    const writeSpy = jest.spyOn(fs, 'writeFileSync');
    const mkdirSpy = jest.spyOn(fs, 'mkdirSync');
    const renameSpy = jest.spyOn(fs, 'renameSync');

    let payload;
    try {
      payload = await runSchemaCommand([
        'validate',
        file,
        '--json',
        '--quiet',
      ], {
        loadCookieData,
        projectRoot: tempDir,
        readObservedResources,
        setExitCode: false,
        stderr: stderr.stream,
        stdout: stdout.stream,
      });
      expect(writeSpy).not.toHaveBeenCalled();
      expect(mkdirSpy).not.toHaveBeenCalled();
      expect(renameSpy).not.toHaveBeenCalled();
    } finally {
      writeSpy.mockRestore();
      mkdirSpy.mockRestore();
      renameSpy.mockRestore();
    }

    expect(payload).toMatchObject({
      kind: 'openyida_schema_validation',
      success: false,
      error: { code: 'SCHEMA_FORBIDDEN_FIELD' },
    });
    expect(readObservedResources).not.toHaveBeenCalled();
    expect(loadCookieData).not.toHaveBeenCalled();
    expect(stderr.value()).toBe('');
    expect(fs.existsSync(path.join(tempDir, '.cache'))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, 'state.v1.json'))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, 'apply-operations.v1.json'))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, 'generated', 'bindings.v1.json'))).toBe(false);
  });

  test('command manifest keeps existing create-form route and marks schema validate read-only', () => {
    const commands = flattenCommandManifest();
    const createForm = commands.find(entry => entry.id === 'create-form.create');
    const schemaValidate = commands.find(entry => entry.id === 'schema.validate');

    expect(createForm).toMatchObject({
      path: ['create-form', 'create'],
      usage: 'create-form create <appType> ... [--locale zh_CN|en_US|ja_JP] [--open|--no-open]',
    });
    expect(schemaValidate).toMatchObject({
      path: ['schema', 'validate'],
      requiresLogin: false,
      output: 'json',
    });
    expect(schemaValidate.sideEffect).toMatchObject({
      kind: 'local_read',
      mutates_yida: false,
      mutates_local: false,
    });
    expect(schemaValidate.permission).toMatchObject({
      mode: 'allow',
      effect: 'read',
    });
  });
});
