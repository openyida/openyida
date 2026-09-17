'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const Babel = require('@babel/standalone');
const { run } = require('../lib/core/sample');
const { compileCanvasLocal } = require('../lib/app/canvas-compile');
const source = fs.readFileSync(path.join(__dirname, '../lib/samples/openyida-scaffold/canvas-admin-entry.jsx'), 'utf8');
const transformed = Babel.transform(source.replace(/^import .*;\n/gm, ''), { presets: ['react'] }).code;
let context, cleanup, refresh, access, navigate;
beforeEach(() => {
  access = 'allowed'; navigate = jest.fn();
  context = { Button: 'Button', URL,
    window: { g_config: { appType: 'APP_current', formUuid: 'FORM-front' }, loginUser: { userId: 'visitor', isAppAdmin: 'y' }, addEventListener: jest.fn((name, callback) => { refresh = callback; }), removeEventListener: jest.fn() },
    document: { addEventListener: jest.fn(), removeEventListener: jest.fn() },
    React: { useState: () => [{ appType: 'APP_current', status: access }, jest.fn()], useEffect: effect => { cleanup = effect(); }, createElement: (type, props, ...children) => ({ type, props, children }) },
    buildCanvasPageUrl: entry => `https://tenant.aliwork.com/${entry.appType}/workbench/${entry.formUuid}`,
    navigateCanvasPage: navigate,
  };
  vm.createContext(context); vm.runInContext(transformed, context);
});

test.each([['y', 'allowed'], [true, 'allowed'], ['n', 'denied'], [false, 'denied'], ['false', 'unknown'], ['true', 'unknown'], [1, 'unknown'], [undefined, 'unknown']])('strictly parses isAppAdmin=%s', (flag, status) => {
  context.window.loginUser.isAppAdmin = flag;
  expect(context.readCanvasAppAdmin('APP_current')).toEqual({ appType: 'APP_current', status });
});
test('identity is scoped to the current app and a logged-in visitor', () => {
  expect(context.readCanvasAppAdmin('APP_other').status).toBe('unknown');
  delete context.window.loginUser.userId;
  expect(context.readCanvasAppAdmin('APP_current').status).toBe('unknown');
  context.window.loginUser = { userId: 'visitor', isSuperAdmin: 'y', isAppAdmin: 'n' };
  expect(context.readCanvasAppAdmin('APP_current').status).toBe('denied');
  delete context.window.g_config;
  expect(context.readCanvasAppAdmin('APP_current').status).toBe('unknown');
});
test('does not guess a landing page or route back to the current front page', () => {
  expect(context.buildCanvasWorkbenchEntry({ appType: 'APP_current' })).toBeNull();
  expect(context.buildCanvasWorkbenchEntry({ appType: 'APP_current', workbenchFormUuid: 'FORM-front' })).toBeNull();
  expect(context.buildCanvasWorkbenchEntry({ appType: 'APP_current', useDefaultWorkbench: true }).targetType).toBe('app');
});
test('supports pageConfig access pages without weakening app identity checks', () => {
  context.window.g_config = {};
  context.window.pageConfig = { appType: 'APP_current', formUuid: 'FORM-front' };
  expect(context.readCanvasAppAdmin('APP_current').status).toBe('allowed');
  expect(context.buildCanvasWorkbenchEntry({ appType: 'APP_current', workbenchFormUuid: 'FORM-front' })).toBeNull();
  context.window.loginUser.isAppAdmin = 'n';
  expect(context.readCanvasAppAdmin('APP_current').status).toBe('denied');
  context.window.loginUser.isAppAdmin = 'y';
  context.window.g_config.appType = 'APP_other';
  expect(context.readCanvasAppAdmin('APP_current').status).toBe('unknown');
  context.window.g_config.appType = 'APP_current';
  context.window.pageConfig.appType = 'APP_other';
  expect(context.readCanvasAppAdmin('APP_current').status).toBe('unknown');
});
test('workbench links drop visitor display flags and retain explicit business context', () => {
  const entry = context.buildCanvasWorkbenchEntry({ appType: 'APP_current', workbenchFormUuid: 'FORM-management', viewUuid: 'view-real', params: { isRenderNav: false, iframe: true, hideLeftNav: true, 'navConfig.layout': '1180', corpid: 'corp', locale: 'zh_CN' } });
  expect(entry).toEqual({ targetType: 'page', appType: 'APP_current', formUuid: 'FORM-management', params: { corpid: 'corp', locale: 'zh_CN', viewUuid: 'view-real' } });
});
test.each(['unknown', 'denied'])('button stays hidden for %s identity', status => {
  access = status;
  expect(context.CanvasAdminWorkbenchButton({ appType: 'APP_current', workbenchFormUuid: 'FORM-management' })).toBeNull();
});
test('button uses the business-workbench route and rechecks identity at click time', () => {
  const button = context.CanvasAdminWorkbenchButton({ appType: 'APP_current', workbenchFormUuid: 'FORM-management' });
  expect(button.children).toEqual(['业务工作台']);
  expect(button.props.href).toContain('/APP_current/workbench/FORM-management');
  expect(button.props.style.color).toBe('var(--color-text1-4, inherit)');
  const event = { button: 0, preventDefault: jest.fn() };
  button.props.onClick(event);
  expect(navigate).toHaveBeenCalledTimes(1);
  context.window.loginUser.isAppAdmin = 'n';
  button.props.onClick(event);
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(event.preventDefault).toHaveBeenCalledTimes(2);
});
test('hook refreshes on return and cleans up listeners; app changes hide stale state', () => {
  expect(context.useCanvasAppAdmin('APP_other')).toBe('unknown');
  expect(context.window.addEventListener).toHaveBeenCalledWith('pageshow', expect.any(Function));
  expect(() => refresh()).not.toThrow();
  cleanup();
  expect(context.window.removeEventListener).toHaveBeenCalledTimes(2);
  expect(context.document.removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
});
test('CLI extracts a complete compilable fragment including the URL helpers', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-admin-entry-'));
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const file = path.join(dir, 'entry.jsx');
    await run(['openyida-page-template', 'canvas-admin-entry', '--output', file]);
    const fragment = fs.readFileSync(file, 'utf8');
    expect(fragment).toContain('function buildCanvasPageUrl');
    expect(fragment).toContain('function CanvasAdminWorkbenchButton');
    expect(() => compileCanvasLocal(fragment + '\nfunction YidaComp(){return <CanvasAdminWorkbenchButton appType="APP_current" workbenchFormUuid="FORM-management"/>;}')).not.toThrow();
  } finally { error.mockRestore(); fs.rmSync(dir, { recursive: true, force: true }); }
});
