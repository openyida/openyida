'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
jest.mock('../lib/core/utils', () => ({
  ...jest.requireActual('../lib/core/utils'),
  httpGet: jest.fn(), httpPostMultipart: jest.fn(),
  requestWithAutoLogin: (fn, auth) => fn(auth),
}));
jest.mock('../lib/core/yida-client', () => ({
  ...jest.requireActual('../lib/core/yida-client'),
  createAuthRef: jest.fn(() => ({ baseUrl: 'https://example.test', authMode: 'token' })),
  isTokenAuthRef: () => true,
}));
jest.mock('../lib/app/form-navigation', () => ({
  fetchFormPageList: jest.fn(async () => [{ formUuid: 'FORM-PAGE', formType: 'display' }]),
}));
const { httpGet, httpPostMultipart } = require('../lib/core/utils');
const { createAuthRef } = require('../lib/core/yida-client');
const publish = require('../lib/app/publish');
const { buildApplicationProvider } = require('../yida-skills/skills/yida-canvas-custom-page/scripts/build-canvas-theme');
let dir, file, log;
beforeEach(() => {
  jest.clearAllMocks();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-theme-'));
  file = path.join(dir, 'orders.canvas.jsx');
  log = jest.spyOn(console, 'log').mockImplementation(() => {});
  httpGet.mockResolvedValue({ success: true, content: { gmtModified: 1, pages: [] } });
  httpPostMultipart.mockResolvedValue({ success: true, content: { formUuid: 'FORM-PAGE', version: 2 } });
});
afterEach(() => { log.mockRestore(); fs.rmSync(dir, { recursive: true, force: true }); });
const source = provider => `${provider ? buildApplicationProvider() : "import {ConfigProvider} from 'antd';"}
function YidaComp(){return ${provider ? '<CanvasThemeProvider>' : ''}<ConfigProvider theme={{token:{colorPrimary:'#1677ff' /* brand */,borderRadius:12}}}><div>订单</div></ConfigProvider>${provider ? '</CanvasThemeProvider>' : ''}}`;

test('JSON publish returns fixed-color warnings without rewriting the page', async () => {
  const original = source(false);
  fs.writeFileSync(file, original);
  await publish([file, 'APP_XXX', 'FORM-PAGE', '--json', '--no-open']);
  const payload = JSON.parse(log.mock.calls.at(-1)[0]);
  expect(payload.success).toBe(true);
  expect(payload.warnings).toEqual([expect.objectContaining({
    code: 'OPENYIDA_CANVAS_THEME_FIXED_BRAND', value: '#1677ff', themeConsistency: 'fixed_override',
  })]);
  expect(fs.readFileSync(file, 'utf8')).toBe(original);
  expect(httpPostMultipart.mock.calls[0][3].runtime.content).toContain('#1677ff');
});

test('explicit migration compiles before source replacement and publishes that exact source', async () => {
  const original = source(true);
  fs.writeFileSync(file, original);
  await publish([file, 'APP_XXX', 'FORM-PAGE', '--fix-theme', '--strict-theme', '--json', '--no-open']);
  const migrated = fs.readFileSync(file, 'utf8');
  expect(migrated).not.toContain("colorPrimary:'#1677ff'");
  expect(migrated).toContain('borderRadius:12');
  expect(migrated).toContain(buildApplicationProvider());
  expect(httpPostMultipart.mock.calls[0][3].source.content).toBe(migrated);
  expect(JSON.parse(log.mock.calls.at(-1)[0]).warnings).toEqual([]);
  expect(fs.readdirSync(dir)).toEqual(['orders.canvas.jsx']);
});

test('a compile failure preserves the original and never authenticates or publishes', async () => {
  const original = source(true).replace('<div>订单</div>', '<MissingComponent/>');
  fs.writeFileSync(file, original);
  await expect(publish([file, 'APP_XXX', 'FORM-PAGE', '--fix-theme', '--json'])).rejects.toThrow();
  expect(fs.readFileSync(file, 'utf8')).toBe(original);
  expect(createAuthRef).not.toHaveBeenCalled();
  expect(httpPostMultipart).not.toHaveBeenCalled();
});

test('migration refuses an unrelated sibling provider instead of falling back to default colors', async () => {
  const original = buildApplicationProvider() + `
    function YidaComp(){return <><CanvasThemeProvider><div>主题区域</div></CanvasThemeProvider><ConfigProvider theme={{token:{colorPrimary:'#1677ff'}}}><div>独立区域</div></ConfigProvider></>}
  `;
  fs.writeFileSync(file, original);
  await expect(publish([file, 'APP_XXX', 'FORM-PAGE', '--fix-theme', '--json']))
    .rejects.toMatchObject({ code: 'OPENYIDA_CANVAS_THEME_PROVIDER_INVALID' });
  expect(fs.readFileSync(file, 'utf8')).toBe(original);
  expect(createAuthRef).not.toHaveBeenCalled();
});

test('migration follows a business child component rendered inside the provider', async () => {
  const original = buildApplicationProvider() + `
    function PageContent(){return <ConfigProvider theme={{token:{colorPrimary:'#1677ff'}}}><div>订单</div></ConfigProvider>}
    function YidaComp(){return <CanvasThemeProvider><PageContent/></CanvasThemeProvider>}
  `;
  fs.writeFileSync(file, original);
  await publish([file, 'APP_XXX', 'FORM-PAGE', '--fix-theme', '--json', '--no-open']);
  expect(fs.readFileSync(file, 'utf8')).not.toContain("colorPrimary:'#1677ff'");
  expect(httpPostMultipart).toHaveBeenCalledTimes(1);
});
