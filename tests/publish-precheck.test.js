'use strict';

const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');

jest.mock('../lib/app/form-navigation', () => ({
  fetchFormPageList: jest.fn(),
}));

const { fetchFormPageList } = require('../lib/app/form-navigation');
const {
  loadPageSource,
} = require('../lib/app/services/page-source-loader');
const {
  buildMissingSourceHints,
  buildDefaultPageDataSource,
  buildCanvasSchemaContent,
  buildSchemaContent,
  countCustomPageDataSources,
  extractPageDataSource,
  findDuplicateSourceMismatches,
  loadPublishSource,
  mergePageDataSource,
  sendSaveRequestOnce,
  verifyPublishTarget,
} = require('../lib/app/publish');
const {
  verifyPublishedContentMatch,
} = require('../lib/app/display-page-readback');

function cloneStat(stat, overrides = {}) {
  return {
    dev: overrides.dev === undefined ? stat.dev : overrides.dev,
    ino: overrides.ino === undefined ? stat.ino : overrides.ino,
    mode: stat.mode,
    size: overrides.size === undefined ? stat.size : overrides.size,
    mtimeMs: overrides.mtimeMs === undefined ? stat.mtimeMs : overrides.mtimeMs,
    ctimeMs: overrides.ctimeMs === undefined ? stat.ctimeMs : overrides.ctimeMs,
    birthtimeMs: overrides.birthtimeMs === undefined ? stat.birthtimeMs : overrides.birthtimeMs,
    isFile: () => stat.isFile(),
    isSymbolicLink: () => stat.isSymbolicLink(),
  };
}

function createSandboxIdentityFs(options = {}) {
  return {
    ...fs,
    lstatSync(targetPath) {
      const stat = fs.lstatSync(targetPath);
      return cloneStat(stat, {
        dev: 1001,
        ino: 2001,
      });
    },
    fstatSync(fd) {
      const stat = fs.fstatSync(fd);
      return cloneStat(stat, {
        dev: 3001,
        ino: 4001,
        mtimeMs: options.driftFingerprint ? stat.mtimeMs + 5000 : stat.mtimeMs,
      });
    },
  };
}

describe('publish prechecks', () => {
  let workspace;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-publish-precheck-'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  test('detects project and artifacts copies with the same name but different content', () => {
    const projectRoot = path.join(workspace, 'project');
    const projectSourceDir = path.join(projectRoot, 'pages', 'src');
    const artifactDir = path.join(workspace, 'projects', 'demo-id', 'artifacts');
    fs.mkdirSync(projectSourceDir, { recursive: true });
    fs.mkdirSync(artifactDir, { recursive: true });

    const sourcePath = path.join(projectSourceDir, 'dashboard.jsx');
    const artifactPath = path.join(artifactDir, 'dashboard.jsx');
    fs.writeFileSync(sourcePath, 'export function renderJsx() { return <div>A</div>; }\n', 'utf8');
    fs.writeFileSync(artifactPath, 'export function renderJsx() { return <div>B</div>; }\n', 'utf8');

    const mismatches = findDuplicateSourceMismatches(sourcePath, projectRoot);

    expect(mismatches).toEqual([
      { sourcePath, duplicatePath: artifactPath },
    ]);
  });

  test('suggests pages/src path when cwd is already the OpenYida project directory', () => {
    const sourceDir = path.join(workspace, 'pages', 'src');
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, 'home.canvas.jsx'), 'export default function Page() { return null; }\n', 'utf8');

    expect(buildMissingSourceHints('project/pages/src/home.canvas.jsx', workspace)).toEqual([
      'pages/src/home.canvas.jsx',
    ]);
  });

  test('suggests project/pages/src path when running from the repository root', () => {
    const sourceDir = path.join(workspace, 'project', 'pages', 'src');
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, 'home.oyd.jsx'), 'export function renderJsx() { return <div />; }\n', 'utf8');

    expect(buildMissingSourceHints('pages/src/home.oyd.jsx', workspace)).toEqual([
      'project/pages/src/home.oyd.jsx',
    ]);
  });

  test('loads workspace page source through the trusted source loader', () => {
    const sourceDir = path.join(workspace, 'project', 'pages', 'src');
    fs.mkdirSync(sourceDir, { recursive: true });
    const sourcePath = path.join(sourceDir, 'home.oyd.jsx');
    fs.writeFileSync(sourcePath, 'export function renderJsx() { return <div>ok</div>; }\n', 'utf8');

    const loaded = loadPublishSource(sourcePath, { workspaceRoot: workspace });

    expect(loaded).toMatchObject({
      absolutePath: sourcePath,
      profile: 'native/default',
      relativePath: 'project/pages/src/home.oyd.jsx',
      source: expect.stringContaining('renderJsx'),
      sourceHash: expect.stringMatching(/^sha256:/),
    });
  });

  test('loads page source when sandbox path and fd identities differ but stat fingerprint matches', () => {
    const relativePath = path.join('project', 'pages', 'src', 'home.oyd.jsx');
    const sourcePath = path.join(workspace, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, 'export function renderJsx() { return <div>ok</div>; }\n', 'utf8');

    const loaded = loadPageSource(relativePath, {
      fsImpl: createSandboxIdentityFs(),
      workspaceRoot: workspace,
    });

    expect(loaded).toMatchObject({
      profile: 'native/default',
      relativePath: 'project/pages/src/home.oyd.jsx',
      source: expect.stringContaining('renderJsx'),
      sourceHash: expect.stringMatching(/^sha256:/),
    });
  });

  test('rejects page source when sandbox identity and stat fingerprint both differ', () => {
    const relativePath = path.join('project', 'pages', 'src', 'home.oyd.jsx');
    const sourcePath = path.join(workspace, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, 'export function renderJsx() { return <div>ok</div>; }\n', 'utf8');

    expect(() => loadPageSource(relativePath, {
      fsImpl: createSandboxIdentityFs({ driftFingerprint: true }),
      workspaceRoot: workspace,
    })).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_SOURCE_READ_FAILED',
      message: 'Page source changed while it was being opened.',
    }));
  });

  test('allows publishing only to display custom pages', async () => {
    fetchFormPageList.mockResolvedValue([
      { formUuid: 'FORM-DATA', formName: 'Skill 信息底表', formType: 'receipt' },
      { formUuid: 'FORM-PAGE', formName: 'Skill 广场首页', formType: 'display' },
    ]);

    await expect(verifyPublishTarget('APP_XXX', 'FORM-PAGE', {})).resolves.toEqual({
      ok: true,
      target: { formUuid: 'FORM-PAGE', formName: 'Skill 广场首页', formType: 'display' },
    });

    await expect(verifyPublishTarget('APP_XXX', 'FORM-DATA', {})).resolves.toEqual({
      ok: false,
      reason: 'wrong_type',
      target: { formUuid: 'FORM-DATA', formName: 'Skill 信息底表', formType: 'receipt' },
    });
  });

  test('supports an explicit force bypass for unusual publish targets', async () => {
    await expect(verifyPublishTarget('APP_XXX', 'FORM-DATA', {}, { force: true })).resolves.toEqual({
      ok: true,
      skipped: true,
    });

    expect(fetchFormPageList).not.toHaveBeenCalled();
  });

  test('preserves existing custom page data sources while keeping built-ins', () => {
    const existingDataSource = {
      offline: [{ id: 'LOCAL_1', name: 'localCache', protocal: 'VALUE', initialData: [] }],
      online: [
        { id: 'REMOTE_1', name: 'customers', protocal: 'HTTP', url: '/query/customers' },
        { id: 'VCB660714833IBHEOXK376TA7XJH2AXUWR8MMW', name: 'urlParams', protocal: 'URI', custom: true },
        { id: 'SERVER_TIMESTAMP_1', name: 'timestamp', protocal: 'VALUE', initialData: '' },
      ],
      list: [{ id: 'REMOTE_1', name: 'customers', protocal: 'HTTP', url: '/query/customers' }],
      globalConfig: {
        fit: { type: 'js', source: 'function fit(response) { return response; }' },
        timeout: 30000,
      },
      sync: false,
      extra: 'keep-me',
    };

    const merged = mergePageDataSource(
      existingDataSource,
      buildDefaultPageDataSource('FORM-PAGE')
    );

    expect(merged.extra).toBe('keep-me');
    expect(merged.sync).toBe(false);
    expect(merged.globalConfig.fit.source).toBe('function fit(response) { return response; }');
    expect(merged.globalConfig.timeout).toBe(30000);
    expect(merged.online.map((item) => item.name)).toEqual(['customers', 'urlParams', 'timestamp']);
    expect(merged.list.map((item) => item.name)).toEqual(['customers', 'urlParams', 'timestamp']);
    expect(merged.offline.map((item) => item.name)).toEqual(['localCache']);
    expect(countCustomPageDataSources(merged)).toBe(2);
  });

  test('builds publish schema with existing page data sources merged in', () => {
    const existingDataSource = {
      online: [{ id: 'REMOTE_ORDERS', name: 'orders', protocal: 'HTTP', url: '/query/orders' }],
      list: [{ id: 'REMOTE_ORDERS', name: 'orders', protocal: 'HTTP', url: '/query/orders' }],
    };

    const previousQuiet = process.env.YIDA_QUIET;
    process.env.YIDA_QUIET = '1';
    let schema;
    try {
      schema = JSON.parse(buildSchemaContent(
        'export function renderJsx() { return React.createElement("div", null, "ok"); }',
        'function renderJsx(){return React.createElement("div",null,"ok");}',
        'FORM-PAGE',
        { existingDataSource }
      ));
    } finally {
      if (previousQuiet === undefined) {
        delete process.env.YIDA_QUIET;
      } else {
        process.env.YIDA_QUIET = previousQuiet;
      }
    }
    const pageDataSource = extractPageDataSource(schema);

    expect(pageDataSource.online.map((item) => item.name)).toEqual(['orders', 'urlParams', 'timestamp']);
    expect(pageDataSource.list.map((item) => item.name)).toEqual(['orders', 'urlParams', 'timestamp']);
  });

  test('keeps Canvas publish Schema builder export compatible', () => {
    const previousQuiet = process.env.YIDA_QUIET;
    process.env.YIDA_QUIET = '1';
    let schema;
    try {
      schema = JSON.parse(buildCanvasSchemaContent(
        'export default function Page() { return React.createElement("div", null, "ok"); }',
        'var YidaComp = function Page(){ return window.React.createElement("div", null, "ok"); };',
        '["react"]',
        'FORM-CANVAS'
      ));
    } finally {
      if (previousQuiet === undefined) {
        delete process.env.YIDA_QUIET;
      } else {
        process.env.YIDA_QUIET = previousQuiet;
      }
    }

    expect(schema.pages[0].componentsTree[0].children[0]).toMatchObject({
      componentName: 'YidaCodeCanvas',
      props: {
        code: expect.stringContaining('export default function Page'),
        runtimeCode: expect.stringContaining('YidaComp'),
        importedModules: '["react"]',
      },
    });
  });

  test('publish schema builders reject emoji in stored page source', () => {
    expect(() => buildSchemaContent(
      'export function renderJsx() { return React.createElement("div", null, "✅"); }',
      'function renderJsx(){return React.createElement("div",null,"✅");}',
      'FORM-PAGE',
      { silent: true }
    )).toThrow(expect.objectContaining({
      code: 'OPENYIDA_PAGE_SCHEMA_EMOJI_FORBIDDEN',
    }));

    expect(() => buildCanvasSchemaContent(
      'export default function Page() { return <div>📊</div>; }',
      'var YidaComp = function Page(){ return window.React.createElement("div", null, "📊"); };',
      '["react"]',
      'FORM-CANVAS'
    )).toThrow(expect.objectContaining({
      code: 'OPENYIDA_PAGE_SCHEMA_EMOJI_FORBIDDEN',
    }));
  });

  test('publish schema builders reject unicode escape emoji in stored page source', () => {
    expect(() => buildSchemaContent(
      'export function renderJsx() { return React.createElement("div", null, "\\u2705"); }',
      'function renderJsx(){return React.createElement("div",null,"\\u2705");}',
      'FORM-PAGE',
      { silent: true }
    )).toThrow(expect.objectContaining({
      code: 'OPENYIDA_PAGE_SCHEMA_EMOJI_FORBIDDEN',
    }));

    expect(() => buildCanvasSchemaContent(
      'export default function Page() { return <div>{"\\u2705"}</div>; }',
      'var YidaComp = function Page(){ return window.React.createElement("div", null, "\\u2705"); };',
      '["react"]',
      'FORM-CANVAS'
    )).toThrow(expect.objectContaining({
      code: 'OPENYIDA_PAGE_SCHEMA_EMOJI_FORBIDDEN',
    }));
  });

  test('publish readback fingerprint matches Canvas runtime code without cookies', () => {
    const schemaContent = JSON.stringify({
      pages: [{
        componentsTree: [{
          children: [{
            componentName: 'YidaCodeCanvas',
            props: {
              code: 'export default function Page() { return null; }',
              runtimeCode: 'var YidaComp = function Page() { return null; };',
            },
          }],
        }],
      }],
      actions: { module: { compiled: '', source: '' } },
      gmtModified: 100,
    });

    const match = verifyPublishedContentMatch(JSON.parse(schemaContent), schemaContent, 'canvas');

    expect(match).toMatchObject({
      displayComponentPresent: true,
      publishedContentMatched: true,
    });
  });

  test('publish readback fingerprint detects mismatched native compiled code', () => {
    const expectedSchema = {
      pages: [{ componentsTree: [{ children: [{ componentName: 'Jsx', props: {} }] }] }],
      actions: { module: { compiled: 'function renderJsx(){return "new";}', source: 'source' } },
    };
    const readbackSchema = {
      pages: [{ componentsTree: [{ children: [{ componentName: 'Jsx', props: {} }] }] }],
      actions: { module: { compiled: 'function renderJsx(){return "old";}', source: 'source' } },
    };

    const match = verifyPublishedContentMatch(readbackSchema, JSON.stringify(expectedSchema), 'native');

    expect(match).toMatchObject({
      displayComponentPresent: true,
      publishedContentMatched: false,
    });
  });

  test('publish readback health check uses token schema readback and never GETs page HTML', async () => {
    const schemaContent = JSON.stringify({
      pages: [{
        componentsTree: [{
          children: [{
            componentName: 'YidaCodeCanvas',
            props: {
              code: 'export default function Page() { return null; }',
              runtimeCode: 'var YidaComp = function Page() { return null; };',
            },
          }],
        }],
      }],
      actions: { module: { compiled: '', source: '' } },
      gmtModified: 100,
    });

    jest.resetModules();
    const requestSpy = jest.spyOn(https, 'request');
    const httpGetMock = jest.fn(() => Promise.resolve({
      success: true,
      content: JSON.parse(schemaContent),
      gmtModified: 100,
    }));

    jest.doMock('../lib/core/utils', () => {
      const actual = jest.requireActual('../lib/core/utils');
      return {
        ...actual,
        findProjectRoot: jest.fn(() => workspace),
        httpGet: httpGetMock,
        requestWithAutoLogin: jest.fn((requestFn, authRef) => requestFn(authRef)),
      };
    });

    try {
      const isolatedPublish = require('../lib/app/publish');
      await expect(isolatedPublish.runPublishReadbackHealthCheck(
        'APP_XXX',
        'FORM-PAGE',
        { baseUrl: 'https://example.test', authMode: 'token', authSource: 'token' },
        schemaContent,
        'canvas'
      )).resolves.toMatchObject({
        ok: true,
        mode: 'publish_readback',
        authMode: 'token',
        targetReadable: true,
        schemaParsed: true,
        displayComponentPresent: true,
        publishedContentMatched: true,
      });

      expect(requestSpy).not.toHaveBeenCalled();
      expect(httpGetMock).toHaveBeenCalledTimes(1);
    } finally {
      requestSpy.mockRestore();
      jest.dontMock('../lib/core/utils');
      jest.resetModules();
    }
  });

  test('publish main treats health check and auto nav order errors as non-fatal after save succeeds', async () => {
    const sourcePath = path.join(workspace, 'home.canvas.jsx');
    fs.writeFileSync(sourcePath, 'export default function Page() { return null; }\n', 'utf8');

    jest.resetModules();
    const previousQuiet = process.env.YIDA_QUIET;
    process.env.YIDA_QUIET = '1';
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error('process.exit ' + code);
    });
    const warnMock = jest.fn();
    const resultMock = jest.fn();
    const autoOrderNavigationMock = jest.fn(() => Promise.reject(new Error('nav order broke')));
    const requestSpy = jest.spyOn(https, 'request').mockImplementation((options, callback) => {
      const response = new EventEmitter();
      response.statusCode = 200;
      const request = new EventEmitter();
      request.write = jest.fn();
      request.end = jest.fn(() => {
        callback(response);
        response.emit('data', JSON.stringify({ success: true }));
        response.emit('end');
      });
      request.destroy = jest.fn();
      return request;
    });
    const mockUtils = {
      findProjectRoot: jest.fn(() => workspace),
      isLoginExpired: jest.fn(() => false),
      isCsrfTokenExpired: jest.fn(() => false),
      httpGet: jest.fn(() => Promise.resolve({
        success: true,
        content: { pages: [], gmtModified: 100 },
      })),
      httpPost: jest.fn(() => Promise.resolve({
        success: true,
        content: { formUuid: 'FORM-PAGE', version: 7 },
      })),
      requestWithAutoLogin: jest.fn((requestFn, authRef) => requestFn(authRef)),
    };

    jest.doMock('../lib/core/utils', () => mockUtils);
    jest.doMock('../lib/core/yida-client', () => ({
      createAuthRef: jest.fn(() => ({
        baseUrl: 'https://example.test',
        authMode: 'token',
        authSource: 'token',
        authData: { auth_mode: 'token', auth_source: 'token' },
      })),
      isTokenAuthRef: jest.fn(() => true),
    }));
    jest.doMock('../lib/core/chalk', () => ({
      banner: jest.fn(),
      step: jest.fn(),
      label: jest.fn(),
      success: jest.fn(),
      fail: jest.fn(),
      warn: warnMock,
      info: jest.fn(),
      error: jest.fn(),
      result: resultMock,
      usage: jest.fn(),
      hint: jest.fn(),
    }));
    jest.doMock('../lib/core/browser-handoff', () => ({
      parseOpenOption: jest.fn((args) => ({
        args: args.filter((arg) => arg !== '--no-open'),
        mode: false,
      })),
      withBrowserHandoff: jest.fn((payload) => payload),
    }));
    jest.doMock('../lib/app/canvas-compile', () => ({
      compileCanvas: jest.fn(() => Promise.resolve({
        runtimeCode: 'var YidaComp = function Page() { return null; };',
        importedModules: '[]',
      })),
    }));
    jest.doMock('../lib/app/services/canvas-page-schema-builder', () => ({
      buildCanvasPageSchemaContent: jest.fn(() => JSON.stringify({ pages: [] })),
    }));
    jest.doMock('../lib/app/nav-group', () => ({
      autoOrderNavigation: autoOrderNavigationMock,
    }));

    try {
      const isolatedPublish = require('../lib/app/publish');
      await expect(isolatedPublish([
        sourcePath,
        'APP_XXX',
        'FORM-PAGE',
        '--canvas',
        '--force',
        '--skip-lint',
        '--health-check',
        '--auto-nav-order',
        '--no-open',
      ])).resolves.toBeUndefined();

      expect(exitSpy).not.toHaveBeenCalled();
      expect(resultMock).toHaveBeenCalledWith(true, expect.any(String), expect.any(Array));
      expect(warnMock).toHaveBeenCalledWith(expect.stringContaining('display_component_missing'));
      expect(warnMock).toHaveBeenCalledWith(expect.stringContaining('nav order broke'));
      expect(autoOrderNavigationMock).toHaveBeenCalledWith('APP_XXX', expect.any(Object));
      const outputPayload = consoleSpy.mock.calls
        .map((call) => call[0])
        .filter((line) => typeof line === 'string' && line.startsWith('{'))
        .map((line) => JSON.parse(line))
        .find((payload) => payload && payload.success === true);
      expect(outputPayload).toMatchObject({
        success: true,
        appType: 'APP_XXX',
        formUuid: 'FORM-PAGE',
        healthCheck: {
          ok: false,
          reason: 'display_component_missing',
        },
        navOrderWarning: 'nav order broke',
      });
    } finally {
      requestSpy.mockRestore();
      exitSpy.mockRestore();
      consoleSpy.mockRestore();
      jest.dontMock('../lib/core/utils');
      jest.dontMock('../lib/core/yida-client');
      jest.dontMock('../lib/core/chalk');
      jest.dontMock('../lib/core/browser-handoff');
      jest.dontMock('../lib/app/canvas-compile');
      jest.dontMock('../lib/app/services/canvas-page-schema-builder');
      jest.dontMock('../lib/app/nav-group');
      jest.resetModules();
      if (previousQuiet === undefined) {
        delete process.env.YIDA_QUIET;
      } else {
        process.env.YIDA_QUIET = previousQuiet;
      }
    }
  });

  test.each([
    ['login expiry', { success: false, errorCode: '307' }],
    ['CSRF expiry', { success: false, errorCode: 'TIANSHU_000030' }],
    ['redirect response', { success: false, errorCode: '302' }],
    ['ordinary failure', { success: false, errorCode: 'FAILED' }],
  ])('legacy publish Schema transport sends once on %s', async (label, responseBody) => {
    const previousQuiet = process.env.YIDA_QUIET;
    process.env.YIDA_QUIET = '1';
    const requestSpy = jest.spyOn(https, 'request').mockImplementation((options, callback) => {
      const response = new EventEmitter();
      response.statusCode = label === 'redirect response' ? 302 : 200;
      const request = new EventEmitter();
      request.write = jest.fn();
      request.end = jest.fn(() => {
        callback(response);
        response.emit('data', JSON.stringify(responseBody));
        response.emit('end');
      });
      return request;
    });

    try {
      await sendSaveRequestOnce(
        'csrf',
        [{ name: 'session', value: 'private' }],
        JSON.stringify({ pages: [] }),
        'https://example.test',
        'APP_XXX',
        'FORM_XXX',
        100
      );
      expect(requestSpy).toHaveBeenCalledTimes(1);
    } finally {
      requestSpy.mockRestore();
      if (previousQuiet === undefined) {
        delete process.env.YIDA_QUIET;
      } else {
        process.env.YIDA_QUIET = previousQuiet;
      }
    }
  });

  test('legacy publish Schema transport rejects missing auth or revision before request', async () => {
    const requestSpy = jest.spyOn(https, 'request');

    await expect(sendSaveRequestOnce(
      '',
      [],
      JSON.stringify({ pages: [] }),
      'https://example.test',
      'APP_XXX',
      'FORM_XXX',
      100
    )).rejects.toMatchObject({ code: 'PUBLISH_SCHEMA_WRITE_PRECHECK_FAILED' });
    await expect(Promise.resolve().then(() => sendSaveRequestOnce(
      'csrf',
      [],
      JSON.stringify({ pages: [] }),
      'https://example.test',
      'APP_XXX',
      'FORM_XXX'
    ))).rejects.toMatchObject({ code: 'SCHEMA_REMOTE_READ_FAILED' });

    expect(requestSpy).not.toHaveBeenCalled();
    requestSpy.mockRestore();
  });
});
