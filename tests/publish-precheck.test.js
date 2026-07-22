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
  buildMissingSourceHints,
  buildDefaultPageDataSource,
  buildCanvasSchemaContent,
  buildSchemaContent,
  countCustomPageDataSources,
  extractPageDataSource,
  findDuplicateSourceMismatches,
  mergePageDataSource,
  sendSaveRequestOnce,
  verifyPublishTarget,
} = require('../lib/app/publish');

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
