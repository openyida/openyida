'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  PAGE_SOURCE_MAX_BYTES,
  loadPageSource,
} = require('../lib/schema/page-source-loader');
const {
  compileNativePageSource,
} = require('../lib/app/services/native-page-compiler');
const {
  compileCanvasPageSource,
} = require('../lib/app/services/canvas-page-compiler');
const {
  buildCanvasPageSchemaContent,
} = require('../lib/app/services/canvas-page-schema-builder');
const {
  buildCanvasPageSchemaPatch,
  projectCanvasPageSchema,
} = require('../lib/schema/page-canvas-foundation');
const {
  buildNativePageSchemaPatch,
  compareNativePageWrite,
  computeNativePageShellFingerprint,
  createNativePageShellProfile,
  projectNativePageSchema,
} = require('../lib/schema/page-foundation');
const { normalizeManifest } = require('../lib/schema/normalize-manifest');
const { createDefaultRegistry } = require('../lib/schema/resource-registry');

const SOURCE = 'export default function Page() { return <div>Hello</div>; }\n';
const CANVAS_SOURCE = 'import React from "react";\nexport default function Page() { return <div>Canvas</div>; }\n';

describe('SAC-09A offline page foundation', () => {
  let approvedShellProfile;
  let workspace;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-page-foundation-'));
    approvedShellProfile = createNativePageShellProfile({
      fingerprint: computeNativePageShellFingerprint(makeShellSchema()),
      profileId: 'sanitized-fixture-v1',
    });
  });

  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  function writeSource(relativePath, content = SOURCE) {
    const target = path.join(workspace, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    return target;
  }

  function load(relativePath = 'pages/home.oyd.jsx', options = {}) {
    return loadPageSource(relativePath, {
      workspaceRoot: workspace,
      ...options,
    });
  }

  function compile(relativePath = 'pages/home.oyd.jsx') {
    if (!fs.existsSync(path.join(workspace, relativePath))) {
      writeSource(relativePath);
    }
    return compileNativePageSource(load(relativePath));
  }

  function compileCanvas(relativePath = 'pages/home.canvas.jsx') {
    if (!fs.existsSync(path.join(workspace, relativePath))) {
      writeSource(relativePath, CANVAS_SOURCE);
    }
    return compileCanvasPageSource(load(relativePath));
  }

  test('loads a workspace-relative regular UTF-8 source', () => {
    writeSource('pages/home.oyd.jsx');

    const loaded = load();

    expect(loaded).toEqual({
      byteLength: Buffer.byteLength(SOURCE),
      profile: 'native/default',
      relativePath: 'pages/home.oyd.jsx',
      source: SOURCE,
      sourceHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    });
  });

  test.each([
    ['absolute path', () => path.join(workspace, 'pages', 'home.jsx')],
    ['parent traversal', () => '../outside.jsx'],
    ['normalized parent traversal', () => 'pages/../pages/home.jsx'],
  ])('rejects an unsafe %s without exposing the workspace path', (label, sourcePath) => {
    writeSource('pages/home.jsx');

    let error;
    try {
      loadPageSource(sourcePath(), { workspaceRoot: workspace });
    } catch (caught) {
      error = caught;
    }

    expect(label).toBeTruthy();
    expect(error).toMatchObject({ code: 'SCHEMA_PAGE_SOURCE_PATH_UNSAFE' });
    expect(JSON.stringify({
      code: error.code,
      details: error.details,
      message: error.message,
      path: error.path,
    })).not.toContain(workspace);
  });

  test('rejects a parent-directory symlink that escapes the workspace', () => {
    const external = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-page-external-'));
    try {
      fs.writeFileSync(path.join(external, 'outside.jsx'), SOURCE);
      fs.mkdirSync(path.join(workspace, 'pages'), { recursive: true });
      fs.symlinkSync(external, path.join(workspace, 'pages', 'linked'));

      expect(() => load('pages/linked/outside.jsx')).toThrow(expect.objectContaining({
        code: 'SCHEMA_PAGE_SOURCE_PATH_UNSAFE',
      }));
    } finally {
      fs.rmSync(external, { recursive: true, force: true });
    }
  });

  test('rejects a final source symlink even when its target is inside the workspace', () => {
    writeSource('pages/real.jsx');
    fs.symlinkSync('real.jsx', path.join(workspace, 'pages', 'linked.jsx'));

    expect(() => load('pages/linked.jsx')).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_SOURCE_PATH_UNSAFE',
    }));
  });

  test('rejects non-regular files', () => {
    fs.mkdirSync(path.join(workspace, 'pages', 'directory.jsx'), { recursive: true });

    expect(() => load('pages/directory.jsx')).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_SOURCE_INVALID',
    }));
  });

  test('accepts exactly 2 MiB and rejects one byte more', () => {
    writeSource('pages/exact.jsx', Buffer.alloc(PAGE_SOURCE_MAX_BYTES, 0x61));
    writeSource('pages/large.jsx', Buffer.alloc(PAGE_SOURCE_MAX_BYTES + 1, 0x61));

    expect(load('pages/exact.jsx').byteLength).toBe(PAGE_SOURCE_MAX_BYTES);
    expect(() => load('pages/large.jsx')).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_SOURCE_TOO_LARGE',
    }));
  });

  test('fails closed when file size changes during the descriptor read', () => {
    writeSource('pages/home.jsx');
    let fstatCalls = 0;
    const fsImpl = Object.create(fs);
    fsImpl.fstatSync = (fd) => {
      const stat = fs.fstatSync(fd);
      fstatCalls += 1;
      if (fstatCalls === 2) {
        return {
          dev: stat.dev,
          ino: stat.ino,
          size: stat.size + 1,
        };
      }
      return stat;
    };

    expect(() => load('pages/home.jsx', { fsImpl })).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_SOURCE_READ_FAILED',
    }));
  });

  test('fails closed when the path identity changes after descriptor open', () => {
    const target = writeSource('pages/home.jsx');
    const original = target + '.opened';
    let replaced = false;
    const fsImpl = Object.create(fs);
    fsImpl.readSync = (...args) => {
      const bytesRead = fs.readSync(...args);
      if (!replaced) {
        replaced = true;
        fs.renameSync(target, original);
        fs.writeFileSync(target, SOURCE.replace('Hello', 'Replacement'));
      }
      return bytesRead;
    };

    expect(() => load('pages/home.jsx', { fsImpl })).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_SOURCE_READ_FAILED',
    }));
  });

  test('fails closed when file descriptor identity fields are missing', () => {
    writeSource('pages/home.jsx');
    const fsImpl = Object.create(fs);
    fsImpl.fstatSync = (fd) => {
      const stat = fs.fstatSync(fd);
      return {
        isFile: () => stat.isFile(),
        size: stat.size,
      };
    };

    expect(() => load('pages/home.jsx', { fsImpl })).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_SOURCE_READ_FAILED',
    }));
  });

  test.each([
    ['invalid UTF-8', Buffer.from([0xc3, 0x28])],
    ['unsafe control text', Buffer.from('export default function Page() {\u0000return null; }')],
  ])('rejects %s', (label, content) => {
    writeSource('pages/home.jsx', content);

    expect(label).toBeTruthy();
    expect(() => load('pages/home.jsx')).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_SOURCE_INVALID',
    }));
  });

  test('loads Canvas source profiles and rejects unsupported source profiles', () => {
    writeSource('pages/home.canvas.jsx', CANVAS_SOURCE);
    writeSource('pages/home.canvas.tsx', CANVAS_SOURCE);
    writeSource('pages/home.canvas.js', CANVAS_SOURCE);
    writeSource('pages/home.tsx');

    expect(load('pages/home.canvas.jsx')).toMatchObject({
      profile: 'canvas/default',
      relativePath: 'pages/home.canvas.jsx',
      source: CANVAS_SOURCE,
    });
    expect(load('pages/home.canvas.tsx')).toMatchObject({
      profile: 'canvas/default',
    });
    expect(load('pages/home.canvas.js')).toMatchObject({
      profile: 'canvas/default',
    });
    expect(() => load('pages/home.tsx')).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_SOURCE_PROFILE_UNSUPPORTED',
    }));
  });

  test('compiler is deterministic, silent, and creates no filesystem artifact', () => {
    writeSource('pages/home.oyd.jsx');
    const loaded = load();
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    let first;
    let second;

    try {
      first = compileNativePageSource(loaded);
      second = compileNativePageSource(loaded);
    } finally {
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      compiled: expect.any(String),
      compiledHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      profile: 'native/default',
      source: expect.any(String),
      sourceHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    });
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(workspace, 'pages', 'dist'))).toBe(false);
    expect(fs.existsSync(path.join(workspace, 'pages', 'build'))).toBe(false);
  });

  test('compiler rejects untrusted source objects and empty source fails locally', () => {
    expect(() => compileNativePageSource({
      relativePath: 'pages/home.oyd.jsx',
      source: SOURCE,
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_SOURCE_INVALID',
    }));

    writeSource('pages/empty.jsx', '');
    expect(() => compileNativePageSource(load('pages/empty.jsx'))).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_SOURCE_COMPILE_FAILED',
    }));
  });

  test('Canvas compiler is deterministic, trusted, silent, and creates no filesystem artifact', () => {
    writeSource('pages/home.canvas.jsx', CANVAS_SOURCE);
    const loaded = load('pages/home.canvas.jsx');
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    let first;
    let second;

    try {
      first = compileCanvasPageSource(loaded);
      second = compileCanvasPageSource(loaded);
    } finally {
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      compiledHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      importedModules: expect.any(String),
      profile: 'canvas/default',
      runtimeCode: expect.stringContaining('YidaComp'),
      source: CANVAS_SOURCE,
      sourceHash: loaded.sourceHash,
    });
    expect(JSON.parse(first.importedModules)).toContain('react');
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(workspace, 'pages', 'dist'))).toBe(false);
    expect(fs.existsSync(path.join(workspace, 'pages', 'build'))).toBe(false);
    expect(() => compileCanvasPageSource({
      relativePath: 'pages/home.canvas.jsx',
      source: CANVAS_SOURCE,
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_SOURCE_INVALID',
    }));
  });

  test('Canvas compiler rejects unicode escape emoji before producing runtime code', () => {
    writeSource(
      'pages/escaped.canvas.jsx',
      'import React from "react";\nexport default function Page() { return <div>{"\\u2705"}</div>; }\n'
    );

    expect(() => compileCanvasPageSource(load('pages/escaped.canvas.jsx'))).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_SOURCE_EMOJI_FORBIDDEN',
    }));
  });

  test('Canvas schema builder rejects unicode escape emoji in stored source or runtime code', () => {
    expect(() => buildCanvasPageSchemaContent(
      'export default function Page() { return <div>{"\\u2705"}</div>; }',
      'var YidaComp = function Page(){ return window.React.createElement("div", null, "\\u2705"); };',
      '["react"]',
      'FORM-CANVAS'
    )).toThrow(expect.objectContaining({
      code: 'OPENYIDA_PAGE_SCHEMA_EMOJI_FORBIDDEN',
    }));
  });

  test('projects saved Canvas pages from YidaCodeCanvas props without native shell fingerprints', () => {
    const compiledPage = compileCanvas();
    const firstSchema = makeCanvasSavedSchema(compiledPage, {
      canvasId: 'canvas-random-a',
      modifiedTime: 100,
      pageClassName: 'page_randoma',
      pageId: 'page-random-a',
    });
    const secondSchema = makeCanvasSavedSchema(compiledPage, {
      canvasId: 'canvas-random-b',
      modifiedTime: 999,
      pageClassName: 'page_randomb',
      pageId: 'page-random-b',
      reverseChildren: true,
    });

    const first = projectCanvas(firstSchema);
    const second = projectCanvas(secondSchema);

    expect(first.managed).toEqual(second.managed);
    expect(first.managed).toMatchObject({
      compiledHash: compiledPage.compiledHash,
      formType: 'display',
      profile: 'canvas/default',
      sourceHash: compiledPage.sourceHash,
      title: 'Home',
    });
    expect(first.managedHash).toBe(second.managedHash);
    expect(first.remoteSchemaHash).not.toBe(second.remoteSchemaHash);
  });

  test('patches only Canvas managed props and preserves unmanaged Schema content', () => {
    const compiledPage = compileCanvas();
    writeSource('pages/other.canvas.jsx', CANVAS_SOURCE.replace('Canvas', 'Next'));
    const nextCompiled = compileCanvas('pages/other.canvas.jsx');
    const schema = makeCanvasSavedSchema(compiledPage);
    schema.vendorExtension = { keep: true };
    const original = JSON.parse(JSON.stringify(schema));

    const patch = buildCanvasPageSchemaPatch({
      compiledPage: nextCompiled,
      desiredTitle: 'Home',
      expectedRemoteSchemaHash: projectCanvas(schema).remoteSchemaHash,
      observedFormType: 'display',
      observedTitle: 'Home',
      remoteSchema: schema,
    });

    expect(schema).toEqual(original);
    expect(patch.schema.vendorExtension).toEqual({ keep: true });
    const canvas = findComponent(patch.schema.pages[0].componentsTree, 'YidaCodeCanvas');
    expect(canvas.props.code).toBe(nextCompiled.source);
    expect(canvas.props.runtimeCode).toBe(nextCompiled.runtimeCode);
    expect(canvas.props.importedModules).toBe(nextCompiled.importedModules);
    expect(patch.managed).toEqual(projectCanvas(patch.schema).managed);
    expect(patch.schema.actions.module.source).toBe(original.actions.module.source);
  });

  test('random node identity, timestamps, and component order do not affect managed projection', () => {
    const compiledPage = compile();
    const firstSchema = makeSavedSchema(compiledPage, {
      jsxId: 'node-random-a',
      modifiedTime: 100,
      pageClassName: 'page_randoma',
      pageId: 'page-random-a',
    });
    const secondSchema = makeSavedSchema(compiledPage, {
      jsxId: 'node-random-b',
      modifiedTime: 999,
      pageClassName: 'page_randomb',
      pageId: 'page-random-b',
      reverseChildren: true,
    });

    const first = project(firstSchema);
    const second = project(secondSchema);

    expect(first.managed).toEqual(second.managed);
    expect(first.managedHash).toBe(second.managedHash);
    expect(first.remoteSchemaHash).not.toBe(second.remoteSchemaHash);
  });

  test('treats root gmtModified as server-managed metadata in the remote Schema hash', () => {
    const compiledPage = compile();
    const firstSchema = makeSavedSchema(compiledPage);
    const secondSchema = JSON.parse(JSON.stringify(firstSchema));
    secondSchema.gmtModified = 101;

    expect(project(firstSchema).remoteSchemaHash).toBe(project(secondSchema).remoteSchemaHash);
  });

  test('classifies a recognized shell and saved native page without using node identity', () => {
    const compiledPage = compile();
    const shell = project(makeShellSchema());
    const saved = project(makeSavedSchema(compiledPage));

    expect(shell).toMatchObject({
      classification: 'PAGE_CREATED',
      managed: {
        formType: 'display',
        profile: 'native/default',
        title: 'Home',
      },
    });
    expect(shell.managed.sourceHash).toBeUndefined();
    expect(shell.managed.compiledHash).toBeUndefined();
    expect(saved).toMatchObject({
      classification: 'SCHEMA_SAVED',
      managed: {
        compiledHash: compiledPage.compiledHash,
        formType: 'display',
        profile: 'native/default',
        sourceHash: compiledPage.sourceHash,
        title: 'Home',
      },
    });
  });

  test('requires an explicit branded shell profile and never trusts a plain fingerprint object', () => {
    const compiledPage = compile();
    const shell = makeShellSchema();
    const plainProfile = {
      contractVersion: 1,
      fingerprint: computeNativePageShellFingerprint(shell),
      profileId: 'sanitized-fixture-v1',
    };

    for (const shellProfile of [undefined, plainProfile]) {
      expect(() => projectNativePageSchema({
        observedFormType: 'display',
        observedTitle: 'Home',
        schema: shell,
        shellProfile,
      })).toThrow(expect.objectContaining({
        code: 'SCHEMA_PAGE_FOUNDATION_SHELL_PROFILE_REQUIRED',
      }));
      expect(() => buildNativePageSchemaPatch({
        compiledPage,
        desiredTitle: 'Home',
        observedFormType: 'display',
        observedTitle: 'Home',
        remoteSchema: shell,
        shellProfile,
      })).toThrow(expect.objectContaining({
        code: 'SCHEMA_PAGE_FOUNDATION_SHELL_PROFILE_REQUIRED',
      }));
    }
    expect(shell.actions.module).toEqual({});
  });

  test('does not accept generic desired-looking title and formType as observed identity', () => {
    expect(() => projectNativePageSchema({
      formType: 'display',
      schema: makeShellSchema(),
      shellProfile: approvedShellProfile,
      title: 'Home',
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_FOUNDATION_OBSERVED_IDENTITY_INVALID',
    }));
  });

  test.each([
    ['extra component', (schema) => {
      schema.pages[0].componentsTree[0].children.push({
        componentName: 'Button',
        id: 'manual-button',
        props: {},
      });
    }],
    ['unexpected action', (schema) => {
      schema.actions.list.push({
        name: 'manualAction',
        type: 'js',
      });
    }],
    ['data source', (schema) => {
      schema.pages[0].componentsTree[0].dataSource = {
        online: [{ name: 'manualSource', type: 'HTTP' }],
      };
    }],
    ['critical page prop', (schema) => {
      schema.pages[0].componentsTree[0].props.contentPadding = '24px';
    }],
  ])('rejects %s drift against the approved initial shell before patch', (label, mutate) => {
    const compiledPage = compile();
    const shell = makeShellSchema();
    mutate(shell);

    expect(label).toBeTruthy();
    expect(() => buildNativePageSchemaPatch({
      compiledPage,
      desiredTitle: 'Home',
      observedFormType: 'display',
      observedTitle: 'Home',
      remoteSchema: shell,
      shellProfile: approvedShellProfile,
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_FOUNDATION_CONFLICT',
    }));
    expect(shell.actions.module).toEqual({});
  });

  test('managed title and source changes are detectable', () => {
    const firstCompiled = compile();
    writeSource('pages/other.oyd.jsx', SOURCE.replace('Hello', 'Changed'));
    const secondCompiled = compile('pages/other.oyd.jsx');

    const baseline = project(makeSavedSchema(firstCompiled));
    const titleChanged = project(makeSavedSchema(firstCompiled), {
      observedTitle: 'Different title',
    });
    const sourceChanged = project(makeSavedSchema(secondCompiled));

    expect(titleChanged.managedHash).not.toBe(baseline.managedHash);
    expect(sourceChanged.managedHash).not.toBe(baseline.managedHash);
  });

  test.each([
    ['title', { observedTitle: 'Remote title' }],
    ['form type', { observedFormType: 'receipt' }],
  ])('rejects observed %s drift before patch without exposing remote identity', (label, observed) => {
    const compiledPage = compile();
    const shell = makeShellSchema();
    shell.pages[0].id = 'FORM-REMOTE-SECRET';
    const saved = buildNativePageSchemaPatch({
      compiledPage,
      desiredTitle: 'Home',
      observedFormType: 'display',
      observedTitle: 'Home',
      remoteSchema: shell,
      shellProfile: approvedShellProfile,
    });
    let error;

    try {
      buildNativePageSchemaPatch({
        compiledPage,
        desiredTitle: 'Home',
        observedFormType: 'display',
        observedTitle: 'Home',
        remoteSchema: shell,
        shellProfile: approvedShellProfile,
        ...observed,
      });
    } catch (caught) {
      error = caught;
    }

    expect(label).toBeTruthy();
    expect(error).toMatchObject({
      code: 'SCHEMA_PAGE_FOUNDATION_CONFLICT',
    });
    expect(JSON.stringify({
      code: error.code,
      details: error.details,
      message: error.message,
      path: error.path,
    })).not.toContain('FORM-REMOTE-SECRET');
    expect(shell.actions.module).toEqual({});
    expect(() => compareNativePageWrite({
      afterSchema: saved.schema,
      beforeSchema: shell,
      compiledPage,
      desiredTitle: 'Home',
      observedFormType: 'display',
      observedTitle: 'Home',
      shellProfile: approvedShellProfile,
      ...observed,
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_FOUNDATION_CONFLICT',
    }));
  });

  test('patches only managed action text and preserves unknown Schema content', () => {
    const compiledPage = compile();
    const shell = makeShellSchema();
    const original = JSON.parse(JSON.stringify(shell));

    const patch = buildNativePageSchemaPatch({
      compiledPage,
      expectedRemoteSchemaHash: project(shell).remoteSchemaHash,
      desiredTitle: 'Home',
      observedFormType: 'display',
      observedTitle: 'Home',
      remoteSchema: shell,
      shellProfile: approvedShellProfile,
    });

    expect(shell).toEqual(original);
    expect(patch.schema.vendorExtension).toEqual(original.vendorExtension);
    expect(patch.schema.pages[0].componentsTree).toEqual(original.pages[0].componentsTree);
    expect(patch.schema.actions.module).toEqual({
      compiled: compiledPage.compiled,
      source: compiledPage.source,
    });
    expect(patch.managed).toEqual(project(patch.schema).managed);

    const comparison = compareNativePageWrite({
      afterSchema: patch.schema,
      beforeSchema: shell,
      compiledPage,
      desiredTitle: 'Home',
      observedFormType: 'display',
      observedTitle: 'Home',
      shellProfile: approvedShellProfile,
    });
    expect(comparison).toMatchObject({
      managedMatches: true,
      unexpectedDelta: false,
      unmanagedPreserved: true,
    });
  });

  test('post-write comparison reports unexpected unmanaged delta', () => {
    const compiledPage = compile();
    const shell = makeShellSchema();
    const patch = buildNativePageSchemaPatch({
      compiledPage,
      desiredTitle: 'Home',
      observedFormType: 'display',
      observedTitle: 'Home',
      remoteSchema: shell,
      shellProfile: approvedShellProfile,
    });
    const changed = JSON.parse(JSON.stringify(patch.schema));
    changed.vendorExtension.keep = 'remote-change';

    const comparison = compareNativePageWrite({
      afterSchema: changed,
      beforeSchema: shell,
      compiledPage,
      desiredTitle: 'Home',
      observedFormType: 'display',
      observedTitle: 'Home',
      shellProfile: approvedShellProfile,
    });

    expect(comparison).toMatchObject({
      managedMatches: true,
      shellProfileMatches: false,
      unexpectedDelta: true,
      unmanagedPreserved: false,
    });
  });

  test('managed-neutral node, timestamp, and component-order rewrites remain unexpected deltas', () => {
    const compiledPage = compile();
    const shell = makeShellSchema();
    const patch = buildNativePageSchemaPatch({
      compiledPage,
      desiredTitle: 'Home',
      observedFormType: 'display',
      observedTitle: 'Home',
      remoteSchema: shell,
      shellProfile: approvedShellProfile,
    });
    const rewritten = JSON.parse(JSON.stringify(patch.schema));
    rewritten.modifiedTime = 999;
    rewritten.pages[0].id = 'remote-page-rewritten';
    rewritten.pages[0].componentsTree[0].id = 'remote-root-rewritten';
    rewritten.pages[0].componentsTree[0].props.className = 'page_remoterewritten';
    rewritten.pages[0].componentsTree[0].children.reverse();
    const jsx = findComponent(rewritten.pages[0].componentsTree, 'Jsx');
    jsx.id = 'remote-jsx-rewritten';
    jsx.props.fieldId = 'remote-field-rewritten';

    const comparison = compareNativePageWrite({
      afterSchema: rewritten,
      beforeSchema: shell,
      compiledPage,
      desiredTitle: 'Home',
      observedFormType: 'display',
      observedTitle: 'Home',
      shellProfile: approvedShellProfile,
    });

    expect(comparison).toMatchObject({
      managedMatches: true,
      shellProfileMatches: true,
      unexpectedDelta: true,
      unmanagedPreserved: false,
    });
  });

  test('rejects stale patch baselines and patches managed source on an existing native page', () => {
    const compiledPage = compile();
    const shell = makeShellSchema();

    expect(() => buildNativePageSchemaPatch({
      compiledPage,
      desiredTitle: 'Home',
      expectedRemoteSchemaHash: 'sha256:' + '0'.repeat(64),
      observedFormType: 'display',
      observedTitle: 'Home',
      remoteSchema: shell,
      shellProfile: approvedShellProfile,
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_FOUNDATION_CONFLICT',
    }));

    writeSource('pages/other.oyd.jsx', SOURCE.replace('Hello', 'Other'));
    const otherCompiled = compile('pages/other.oyd.jsx');
    const patched = buildNativePageSchemaPatch({
      compiledPage,
      desiredTitle: 'Home',
      observedFormType: 'display',
      observedTitle: 'Home',
      remoteSchema: makeSavedSchema(otherCompiled),
      shellProfile: approvedShellProfile,
    });
    expect(patched.managed).toMatchObject({
      sourceHash: compiledPage.sourceHash,
      compiledHash: compiledPage.compiledHash,
    });
    expect(patched.schema.actions.module.source).toBe(compiledPage.source);
    expect(patched.schema.actions.module.compiled).toBe(compiledPage.compiled);
  });

  test.each([
    ['empty Schema', () => ({})],
    ['partial actions', () => {
      const schema = makeShellSchema();
      schema.actions.module.source = 'partial';
      return schema;
    }],
    ['ambiguous native tree', () => {
      const schema = makeShellSchema();
      schema.pages[0].componentsTree[0].children.push({
        componentName: 'Jsx',
        id: 'second-jsx',
        props: {},
      });
      return schema;
    }],
  ])('fails closed for %s', (label, makeSchema) => {
    expect(label).toBeTruthy();
    expect(() => project(makeSchema())).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID',
    }));
  });

  test('rejects wrong form type and Canvas structures', () => {
    expect(() => projectNativePageSchema({
      observedFormType: 'receipt',
      observedTitle: 'Home',
      schema: makeShellSchema(),
      shellProfile: approvedShellProfile,
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_FOUNDATION_PROFILE_UNSUPPORTED',
    }));

    const canvas = makeShellSchema();
    canvas.pages[0].componentsTree[0].children.push({
      componentName: 'YidaCodeCanvas',
      id: 'canvas-node',
    });
    expect(() => project(canvas)).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_FOUNDATION_PROFILE_UNSUPPORTED',
    }));
  });

  test('default registry and Manifest normalization expose the minimal native page resource', () => {
    writeSource('pages/home.oyd.jsx');
    expect(createDefaultRegistry().listTypes()).toEqual(['app', 'form', 'page', 'process']);
    const result = normalizeManifest({
      kind: 'openyida_app_manifest',
      schemaVersion: 1,
      app: {
        key: 'demoApp',
        name: 'Demo',
      },
      forms: {
        seed: {
          title: 'Seed',
          fields: {
            name: {
              label: 'Name',
              type: 'TextField',
            },
          },
        },
      },
      pages: {
        home: {
          source: 'pages/home.oyd.jsx',
          title: 'Home',
        },
      },
    }, { workspaceRoot: workspace });
    expect(result.normalized.resources.find(resource => resource.resourceType === 'page')).toMatchObject({
      key: 'home',
      source: 'pages/home.oyd.jsx',
      dependsOn: ['app:demoApp'],
      desired: {
        formType: 'display',
        profile: 'native/default',
        title: 'Home',
      },
    });
  });

  function project(schema, overrides = {}) {
    return projectNativePageSchema({
      observedFormType: 'display',
      observedTitle: 'Home',
      schema,
      shellProfile: approvedShellProfile,
      ...overrides,
    });
  }

  function projectCanvas(schema, overrides = {}) {
    return projectCanvasPageSchema({
      observedFormType: 'display',
      observedTitle: 'Home',
      schema,
      ...overrides,
    });
  }
});

function makeShellSchema(options = {}) {
  const pageChildren = [
    {
      componentName: 'RootHeader',
      id: 'root-header',
      props: {},
    },
    {
      componentName: 'RootContent',
      id: 'root-content',
      props: { keep: true },
      children: [
        {
          componentName: 'Jsx',
          id: options.jsxId || 'jsx-node',
          props: {
            fieldId: 'fixture-only',
            render: {
              compiled: 'function render(){ return this.renderJsx(); }',
              source: 'function render() { return this.renderJsx(); }',
              type: 'js',
            },
          },
        },
      ],
    },
    {
      componentName: 'RootFooter',
      id: 'root-footer',
      props: {},
    },
  ];
  if (options.reverseChildren) {
    pageChildren.reverse();
  }
  const schema = {
    modifiedTime: options.modifiedTime || 1,
    pages: [
      {
        componentsMap: [
          { componentName: 'Page', package: '@fixture/page' },
          { componentName: 'Jsx', package: '@fixture/jsx' },
        ],
        componentsTree: [
          {
            children: pageChildren,
            componentName: 'Page',
            id: options.pageId || 'page-node',
            props: {
              className: options.pageClassName || 'page_fixture',
              contentPadding: '0',
              unknownLayout: {
                keep: true,
              },
            },
          },
        ],
        id: 'fixture-page-id',
      },
    ],
    schemaType: 'superform',
    schemaVersion: '5.0',
    vendorExtension: {
      keep: 'unchanged',
    },
  };
  if (options.includeActions !== false) {
    schema.actions = {
      list: [],
      module: {},
      type: 'FUNCTION',
    };
  }
  return schema;
}

function makeSavedSchema(compiledPage, options = {}) {
  const schema = makeShellSchema(options);
  if (!schema.actions) {
    schema.actions = {};
  }
  if (!schema.actions.module) {
    schema.actions.module = {};
  }
  schema.actions.module.source = compiledPage.source;
  schema.actions.module.compiled = compiledPage.compiled;
  return schema;
}

function makeCanvasSavedSchema(compiledPage, options = {}) {
  const schema = JSON.parse(buildCanvasPageSchemaContent(
    compiledPage.source,
    compiledPage.runtimeCode,
    compiledPage.importedModules,
    'FORM-CANVAS',
    {
      nextNodeId: tokenFactory([
        options.pageId || 'page-node',
        options.canvasId || 'canvas-node',
      ]),
      nextSuffix: tokenFactory([options.pageClassName || 'fixture']),
    }
  ));
  schema.modifiedTime = options.modifiedTime || 1;
  if (options.pageClassName) {
    schema.pages[0].componentsTree[0].props.className = options.pageClassName;
  }
  if (options.reverseChildren) {
    schema.pages[0].componentsMap.reverse();
    schema.pages[0].componentsTree[0].children.reverse();
  }
  return schema;
}

function tokenFactory(values) {
  let index = 0;
  return () => values[index++] || values[values.length - 1] || 'token';
}

function findComponent(value, componentName) {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  if (!Array.isArray(value) && value.componentName === componentName) {
    return value;
  }
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    const match = findComponent(child, componentName);
    if (match) {
      return match;
    }
  }
  return undefined;
}
