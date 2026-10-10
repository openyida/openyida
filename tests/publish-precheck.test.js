'use strict';

const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const { CliError } = require('../lib/core/cli-error');

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
  buildCanvasSavePayload,
  buildSchemaContent,
  countCustomPageDataSources,
  extractPageDataSource,
  findDuplicateSourceMismatches,
  loadPublishSource,
  mergePageDataSource,
  verifyPublishTarget,
} = require('../lib/app/publish');
const publishPage = require('../lib/app/publish');
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
  let errorSpy;
  let stderrSpy;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-publish-precheck-'));
    jest.clearAllMocks();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = jest.spyOn(process.stderr, 'write').mockReturnValue(true);
  });

  afterEach(() => {
    errorSpy.mockRestore();
    stderrSpy.mockRestore();
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  test('fix-theme requires a mounted theme provider and never rewrites an unthemed page', async () => {
    const sourcePath = path.join(workspace, 'theme.canvas.jsx');
    const source = "import {ConfigProvider} from 'antd'; function YidaComp(){return <ConfigProvider theme={{token:{colorPrimary:'#1677ff'}}}><div/></ConfigProvider>}";
    fs.writeFileSync(sourcePath, source);
    await expect(publishPage([sourcePath, 'APP_XXX', 'FORM-PAGE', '--fix-theme', '--json']))
      .rejects.toMatchObject({ code: 'OPENYIDA_CANVAS_THEME_PROVIDER_INVALID', details: { issueType: 'provider_missing' } });
    expect(fs.readFileSync(sourcePath, 'utf8')).toBe(source);
  });

  test('a later compile error leaves the original source intact after preparing a theme migration', async () => {
    const { buildApplicationProvider } = require('../yida-skills/skills/yida-canvas-custom-page/scripts/build-canvas-theme');
    const sourcePath = path.join(workspace, 'theme.canvas.jsx');
    const source = buildApplicationProvider() + `
      function YidaComp(){return <CanvasThemeProvider><ConfigProvider theme={{token:{colorPrimary:'#1677ff' /* brand */,borderRadius:12}}}><UnknownComponent/></ConfigProvider></CanvasThemeProvider>}
    `;
    fs.writeFileSync(sourcePath, source);
    await expect(publishPage([sourcePath, 'APP_XXX', 'FORM-PAGE', '--fix-theme', '--json'])).rejects.toThrow();
    expect(fs.readFileSync(sourcePath, 'utf8')).toBe(source);
  });

  test('strict publish under a PTY rejects locally without opening a prompt, even with JSON', async () => {
    const sourcePath = path.join(workspace, 'theme.canvas.jsx');
    fs.writeFileSync(sourcePath, "import {ConfigProvider} from 'antd'; function YidaComp(){return <ConfigProvider theme={{token:{colorPrimary:'#1677ff'}}}><div/></ConfigProvider>}");
    const descriptors = [process.stdin, process.stderr].map(stream => Object.getOwnPropertyDescriptor(stream, 'isTTY'));
    const prompt = jest.spyOn(require('readline'), 'createInterface');
    try {
      for (const stream of [process.stdin, process.stderr]) { Object.defineProperty(stream, 'isTTY', { configurable: true, value: true }); }
      await expect(publishPage([sourcePath, 'APP_XXX', 'FORM-PAGE', '--strict-theme', '--json']))
        .rejects.toMatchObject({ code: 'OPENYIDA_CANVAS_THEME_FIXED_BRAND' });
      expect(prompt).not.toHaveBeenCalled();
    } finally {
      [process.stdin, process.stderr].forEach((stream, index) => {
        if (descriptors[index]) { Object.defineProperty(stream, 'isTTY', descriptors[index]); }
        else { delete stream.isTTY; }
      });
      prompt.mockRestore();
    }
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

  test('publish rejects unsupported authoring hooks with CliError before login or process exit', async () => {
    const sourcePath = path.join(workspace, 'reducer.oyd.jsx');
    fs.writeFileSync(sourcePath, `
import React, { useReducer } from 'react';
export default function Page() {
  const [state] = useReducer((value) => value, {});
  return <div>{state.name}</div>;
}
`, 'utf8');
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit should not be called');
    });

    await expect(publishPage([
      sourcePath,
      'APP_XXX',
      'FORM-PAGE',
      '--compat',
      '--no-open',
    ])).rejects.toMatchObject({
      code: 'BUILD_PAGE_FAILED',
      details: {
        retryable: false,
        retrySafe: true,
        sideEffectState: 'none',
        sourceRepairable: true,
        primaryIssue: {
          code: 'UNSUPPORTED_HOOK',
          hook: 'useReducer',
          line: 4,
        },
        nextAction: {
          type: 'edit_source_then_recheck',
          commandId: 'check-page',
        },
      },
    });
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  test('rejects a missing Canvas theme provider before any HTTP request even with force and skip-lint', async () => {
    const { buildApplicationProvider } = require('../yida-skills/skills/yida-canvas-custom-page/scripts/build-canvas-theme');
    const sourcePath = path.join(workspace, 'theme.canvas.jsx');
    fs.writeFileSync(sourcePath, buildApplicationProvider() + `
      function PageContent() { const { token } = useCanvasThemeContext(); return <div style={{color: token.colorText}}>经营指标</div>; }
      function YidaComp() { return <PageContent />; }
    `);
    const requestSpy = jest.spyOn(https, 'request').mockImplementation(() => { throw new Error('Unexpected HTTP request'); });
    try {
      await expect(publishPage([sourcePath, 'APP_XXX', 'FORM-PAGE', '--canvas', '--force', '--skip-lint', '--no-open']))
        .rejects.toMatchObject({ code: 'OPENYIDA_CANVAS_THEME_PROVIDER_INVALID', details: { issueType: 'provider_missing' } });
      expect(requestSpy).not.toHaveBeenCalled();
    } finally {
      requestSpy.mockRestore();
    }
  });

  test.each([
    ["function YidaComp(){return <button onClick={()=>window.open('/custom/FORM-room')}>预订</button>}", 'OPENYIDA_CANVAS_PATH_MISSING_APP_TYPE', []],
    ["import {ConfigProvider} from 'antd'; function YidaComp(){return <ConfigProvider theme={{token:{colorPrimary:'#1677ff'}}}><div/></ConfigProvider>}", 'OPENYIDA_CANVAS_THEME_FIXED_BRAND', ['--strict-theme']],
  ])('rejects invalid navigation and theme before remote writes: %s', async (source, code, extraArgs) => {
    const sourcePath = path.join(workspace, 'entry.canvas.jsx');
    fs.writeFileSync(sourcePath, source);
    const requestSpy = jest.spyOn(https, 'request').mockImplementation(() => { throw new Error('Unexpected HTTP request'); });
    try {
      await expect(publishPage([sourcePath, 'APP_XXX', 'FORM-PAGE', '--canvas', '--force', '--skip-lint', '--no-open', ...extraArgs]))
        .rejects.toMatchObject({ code });
      expect(requestSpy).not.toHaveBeenCalled();
    } finally { requestSpy.mockRestore(); }
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

  test('builds a code-free Canvas save skeleton while preserving local artifacts', () => {
    const sourceCode = 'export default function Page() { return null; }';
    const runtimeCode = 'var YidaComp = function Page() { return null; };';
    const schemaContent = buildCanvasSchemaContent(
      sourceCode,
      runtimeCode,
      '[]',
      'FORM-CANVAS'
    );

    const payload = buildCanvasSavePayload(schemaContent, sourceCode, runtimeCode);
    const schema = JSON.parse(payload.content);
    const canvas = schema.pages[0].componentsTree[0].children[0];

    expect(payload).toMatchObject({
      canvasNodeId: canvas.id,
      sourceCode,
      runtimeCode,
    });
    expect(canvas.componentName).toBe('YidaCodeCanvas');
    expect(canvas.props).not.toHaveProperty('code');
    expect(canvas.props).not.toHaveProperty('runtimeCode');
    expect(canvas.props).not.toHaveProperty('codeBundle');
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
        expectedPublishMode: 'canvas',
        authMode: 'token',
        targetReadable: true,
        schemaParsed: true,
        displayComponentPresent: true,
        publishedContentMatched: true,
        readback: {
          hasYidaCodeCanvas: true,
          runtimeCodeBytes: expect.any(Number),
        },
      });

      expect(requestSpy).not.toHaveBeenCalled();
      expect(httpGetMock).toHaveBeenCalledTimes(1);
    } finally {
      requestSpy.mockRestore();
      jest.dontMock('../lib/core/utils');
      jest.resetModules();
    }
  });

  test.each([
    [{ renderNav: false }, 'custom', false],
    [{ isRenderNav: 'false' }, 'custom', false],
    [{ renderNav: true, isRenderNav: false }, 'workbench', true],
    [{ renderNav: null, isRenderNav: false }, 'workbench', null],
    [null, 'workbench', null],
  ])('publish returns the persisted navigation entry for %j without new flags and keeps post-save failures non-fatal', async (pageConfig, route, renderNav) => {
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
    const autoOrderNavigationMock = jest.fn(() => Promise.reject(new CliError('NAV_ORDER_RESULT_UNKNOWN', {
      code: 'NAV_ORDER_RESULT_UNKNOWN',
      details: {
        retryable: false,
        retrySafe: false,
        sideEffectState: 'unknown',
        readbackVerified: false,
        nextStep: 'openyida nav-group list APP_XXX --flat',
      },
    })));
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
      httpPost: jest.fn(() => pageConfig === null
        ? Promise.reject(new Error('config read unavailable'))
        : Promise.resolve({ success: true, content: pageConfig })),
      httpPostMultipart: jest.fn(() => Promise.resolve({
        success: true,
        content: {
          formUuid: 'FORM-PAGE',
          version: 7,
          storageMode: 'CODE_BUNDLE',
          bundleId: 'a'.repeat(64),
        },
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
      buildCanvasPageSchemaContent: jest.fn((sourceCode, runtimeCode) => JSON.stringify({
        pages: [{
          componentsTree: [{
            componentName: 'Page',
            id: 'page-1',
            children: [{
              componentName: 'YidaCodeCanvas',
              id: 'canvas-1',
              props: { code: sourceCode, runtimeCode },
            }],
          }],
        }],
      })),
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
      expect(warnMock).toHaveBeenCalledWith(expect.stringContaining('NAV_ORDER_RESULT_UNKNOWN'));
      expect(autoOrderNavigationMock).toHaveBeenCalledWith('APP_XXX', expect.any(Object));
      expect(mockUtils.httpPost).toHaveBeenCalledTimes(1);
      expect(mockUtils.httpPost.mock.calls[0][1]).toContain('/getFormSchemaInfo.json');
      expect(mockUtils.httpPostMultipart).toHaveBeenCalledTimes(1);
      expect(mockUtils.httpPostMultipart.mock.calls[0][1]).toContain('/query/codeBundle/save.json');
      expect(mockUtils.httpPostMultipart.mock.calls[0][2]).toMatchObject({
        formUuid: 'FORM-PAGE',
        canvasNodeId: 'canvas-1',
      });
      expect(JSON.parse(mockUtils.httpPostMultipart.mock.calls[0][2].content)
        .pages[0].componentsTree[0].children[0].props).toEqual({});
      const outputPayload = consoleSpy.mock.calls
        .map((call) => call[0])
        .filter((line) => typeof line === 'string' && line.startsWith('{'))
        .map((line) => JSON.parse(line))
        .find((payload) => payload && payload.success === true);
      expect(outputPayload).toMatchObject({
        success: true,
        appType: 'APP_XXX',
        formUuid: 'FORM-PAGE',
        publishMode: 'canvas',
        url: `https://example.test/APP_XXX/${route}/FORM-PAGE`,
        workbenchUrl: 'https://example.test/APP_XXX/workbench/FORM-PAGE',
        standaloneUrl: route === 'custom' ? 'https://example.test/APP_XXX/custom/FORM-PAGE' : null,
        navigationVerification: { renderNav, verified: renderNav !== null },
        navigationWarning: pageConfig === null ? 'config read unavailable' : null,
        storageMode: 'CODE_BUNDLE',
        bundleId: 'a'.repeat(64),
        publishReadbackVerified: false,
        runtimeSmokeVerified: false,
        runtimeSmokeStatus: 'not_checked',
        healthCheck: {
          ok: false,
          expectedPublishMode: 'canvas',
          reason: 'display_component_missing',
        },
        navOrder: {
          success: false,
          errorCode: 'NAV_ORDER_RESULT_UNKNOWN',
          retryable: false,
          retrySafe: false,
          sideEffectState: 'unknown',
          readbackVerified: false,
          nextStep: 'openyida nav-group list APP_XXX --flat',
        },
        navOrderWarning: 'NAV_ORDER_RESULT_UNKNOWN',
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
    ['redirect response', { __needLogin: true, __httpStatus: 302 }],
    ['ordinary failure', { success: false, errorCode: 'FAILED' }],
  ])('token publish Schema transport delegates once on %s', async (label, responseBody) => {
    jest.resetModules();
    const httpPost = jest.fn().mockResolvedValue(responseBody);
    jest.doMock('../lib/core/utils', () => {
      const actual = jest.requireActual('../lib/core/utils');
      return {
        ...actual,
        httpPost,
      };
    });
    const isolatedPublish = require('../lib/app/publish');

    try {
      await isolatedPublish.sendSaveRequestWithAuth(
        { baseUrl: 'https://example.test', authMode: 'token', authSource: 'token' },
        JSON.stringify({ pages: [] }),
        'APP_XXX',
        'FORM_XXX',
        100
      );
      expect(httpPost).toHaveBeenCalledTimes(1);
      expect(httpPost.mock.calls[0][3]).toEqual({ silentStatus: true });
      expect(label).toBeTruthy();
    } finally {
      jest.dontMock('../lib/core/utils');
      jest.resetModules();
    }
  });

  test.each([
    ['login expiry', { __needLogin: true, __httpStatus: 401 }],
    ['ordinary failure', { success: false, errorCode: 'FAILED' }],
    ['success', { success: true, content: { storageMode: 'CODE_BUNDLE' } }],
  ])('Canvas unified save transport delegates once on %s', async (label, responseBody) => {
    jest.resetModules();
    const httpPostMultipart = jest.fn().mockResolvedValue(responseBody);
    jest.doMock('../lib/core/utils', () => {
      const actual = jest.requireActual('../lib/core/utils');
      return {
        ...actual,
        httpPostMultipart,
      };
    });
    const isolatedPublish = require('../lib/app/publish');

    try {
      await isolatedPublish.sendCanvasSaveRequestWithAuth(
        { baseUrl: 'https://example.test', authMode: 'token', authSource: 'token' },
        {
          canvasNodeId: 'canvas-1',
          content: JSON.stringify({ pages: [] }),
          sourceCode: 'source',
          runtimeCode: 'runtime',
        },
        'APP_XXX',
        'FORM_XXX',
        100
      );
      expect(httpPostMultipart).toHaveBeenCalledTimes(1);
      expect(httpPostMultipart.mock.calls[0][1]).toContain('/query/codeBundle/save.json');
      expect(httpPostMultipart.mock.calls[0][2]).toMatchObject({
        formUuid: 'FORM_XXX',
        gmtModified: 100,
        canvasNodeId: 'canvas-1',
        importSchema: true,
      });
      expect(httpPostMultipart.mock.calls[0][3]).toMatchObject({
        source: { content: 'source', fileName: 'source.jsx' },
        runtime: { content: 'runtime', fileName: 'runtime.js' },
      });
      expect(label).toBeTruthy();
    } finally {
      jest.dontMock('../lib/core/utils');
      jest.resetModules();
    }
  });

  test('token publish Schema transport rejects missing token auth or revision before request', async () => {
    jest.resetModules();
    const httpPost = jest.fn();
    jest.doMock('../lib/core/utils', () => {
      const actual = jest.requireActual('../lib/core/utils');
      return {
        ...actual,
        httpPost,
      };
    });
    const isolatedPublish = require('../lib/app/publish');

    await expect(isolatedPublish.sendSaveRequestWithAuth(
      { baseUrl: 'https://example.test', authMode: 'cookie', authSource: 'cookie' },
      JSON.stringify({ pages: [] }),
      'APP_XXX',
      'FORM_XXX',
      100
    )).rejects.toMatchObject({ code: 'PUBLISH_SCHEMA_WRITE_PRECHECK_FAILED' });
    await expect(Promise.resolve().then(() => isolatedPublish.sendSaveRequestWithAuth(
      { baseUrl: 'https://example.test', authMode: 'token', authSource: 'token' },
      JSON.stringify({ pages: [] }),
      'APP_XXX',
      'FORM_XXX'
    ))).rejects.toMatchObject({ code: 'SCHEMA_REMOTE_READ_FAILED' });

    expect(httpPost).not.toHaveBeenCalled();
    jest.dontMock('../lib/core/utils');
    jest.resetModules();
  });
});
