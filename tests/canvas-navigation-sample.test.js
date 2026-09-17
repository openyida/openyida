'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { compileCanvasLocal } = require('../lib/app/canvas-compile');
const { run } = require('../lib/core/sample');
const os = require('os');
const source = fs.readFileSync(path.join(__dirname, '../lib/samples/openyida-scaffold/canvas-navigation.jsx'), 'utf8');
let context;
beforeEach(() => {
  context = { URL, window: { location: { origin: 'https://tenant.aliwork.com', assign: jest.fn() }, open: jest.fn() } };
  vm.createContext(context);
  vm.runInContext(source, context);
});
const app = { appType: 'APP_test' };
test.each([['custom', 'custom'], ['page', 'workbench'], ['submission', 'submission']])('builds %s using the application and page', (targetType, route) => {
  const url = new URL(context.buildCanvasPageUrl({ targetType, formUuid: 'FORM-a', params: { corpid: 'corp', search: 'a & b' }, hash: 'section' }, app));
  expect(url.pathname).toBe('/APP_test/' + route + '/FORM-a');
  expect(url.searchParams.get('search')).toBe('a & b');
  expect(url.searchParams.get('corpid')).toBe('corp');
  expect(url.hash).toBe('#section');
});
test('detail identity cannot be replaced through query params', () => {
  const entry = { targetType: 'detail', formUuid: 'FORM-a', formInstId: 'real & id', params: { formInstId: 'wrong' } };
  expect(new URL(context.buildCanvasPageUrl(entry, app)).searchParams.get('formInstId')).toBe('real & id');
  expect(() => context.buildCanvasPageUrl({ ...entry, formInstId: '' }, app)).toThrow('formInstId');
});
test('missing resources and unsupported targets fail before opening a window', () => {
  for (const entry of [{ targetType: 'custom' }, { targetType: 'wrong', formUuid: 'FORM-a' }, { targetType: 'url', url: 'javascript:alert(1)' }]) {
    expect(() => context.navigateCanvasPage(entry, app)).toThrow();
  }
  expect(() => context.buildCanvasPageUrl({ targetType: 'custom', formUuid: 'FORM-a' })).toThrow('appType');
  expect(context.window.open).not.toHaveBeenCalled();
});
test('opaque embeddings need an explicit verified platform origin', () => {
  context.window.location.origin = 'null';
  expect(() => context.buildCanvasPageUrl({ targetType: 'app' }, app)).toThrow();
  expect(context.buildCanvasPageUrl({ targetType: 'app' }, { ...app, platformOrigin: 'https://real.aliwork.com' })).toBe('https://real.aliwork.com/APP_test/workbench');
});
test('routes full URLs in URL mode and falls back in the current window', () => {
  const push = jest.fn();
  const entry = { targetType: 'custom', formUuid: 'FORM-a' };
  context.navigateCanvasPage(entry, { ...app, utils: { router: { push } } });
  expect(push).toHaveBeenCalledWith('https://tenant.aliwork.com/APP_test/custom/FORM-a', {}, false, true);
  context.navigateCanvasPage(entry, app);
  expect(context.window.location.assign).toHaveBeenCalledWith('https://tenant.aliwork.com/APP_test/custom/FORM-a');
});
test('local tabs and native forms preserve their own handlers', () => {
  const selectView = jest.fn(), openForm = jest.fn();
  context.navigateCanvasPage({ targetType: 'local', viewKey: 'rooms' }, { selectView });
  context.navigateCanvasPage({ targetType: 'submission', formUuid: 'FORM-a' }, { ...app, openForm });
  expect(selectView).toHaveBeenCalledWith('rooms');
  expect(openForm).toHaveBeenCalledWith(expect.objectContaining({ type: 'submission', appType: 'APP_test', formUuid: 'FORM-a' }));
  expect(context.window.open).not.toHaveBeenCalled();
});
test('explicit new-tab intent uses the bridge', () => {
  const openPage = jest.fn();
  context.navigateCanvasPage({ targetType: 'custom', formUuid: 'FORM-a', openMode: 'new-tab' }, { ...app, utils: { openPage } });
  expect(openPage).toHaveBeenCalledWith('https://tenant.aliwork.com/APP_test/custom/FORM-a');
});
test('CLI extracts the complete helper and the helper compiles with business content', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-navigation-'));
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const output = path.join(dir, 'navigation.jsx');
    await run(['openyida-page-template', 'canvas-navigation', '--output', output]);
    expect(fs.readFileSync(output, 'utf8')).toBe(source);
    expect(() => compileCanvasLocal(source + '\nfunction YidaComp(){return <button onClick={()=>navigateCanvasPage({targetType:"app"},{appType:"APP_test"})}>首页</button>}')).not.toThrow();
  } finally { log.mockRestore(); error.mockRestore(); fs.rmSync(dir, { recursive: true, force: true }); }
});
