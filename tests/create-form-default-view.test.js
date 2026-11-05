'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
jest.mock('../lib/core/yida-client', () => ({ createYidaClient: jest.fn() }));
jest.mock('../lib/core/utils', () => ({ ...jest.requireActual('../lib/core/utils'), resolveProjectRoot: jest.fn() }));
const { createYidaClient } = require('../lib/core/yida-client');
const { configureCreatedFormView } = require('../lib/app/create-form/default-view');

let client, config, fields, dir;
const field = (id, order, extra = {}) => ({ id, componentName: 'TextField', supportVisible: true,
  showTerm: 'y', showOrder: order, ...extra });

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'created-view-test-'));
  require('../lib/core/utils').resolveProjectRoot.mockReturnValue({ projectRoot: dir });
  config = { viewUuid: 'VIEW_DATA', staticConfig: { columnFilter: ['all'], buttonList: [{ code: 'detail' }], unknown: true },
    defaultConfig: { showFields: 'all', widths: { name: 200 }, lockFieldIds: [],
      sort: [{ id: 'createTime', isAsc: 'n' }], filter: { values: {} }, unknown: 'preserve' } };
  fields = [field('processInstanceTitle', 0), field('name', 1), field('createTime', 2),
    field('formInstanceId', 3, { showTerm: 'n' })];
  client = {
    get: jest.fn(async () => ({ success: true, content: { componentValueVoList: fields } })),
    postForm: jest.fn(async (endpoint, params) => {
      expect(params.formUuid).toBe('FORM_TEST');
      return { success: true, content: endpoint.includes('getFormSchemaInfo')
        ? { multiViewInfos: [{ viewUuid: 'VIEW_SUBMIT', viewType: 'form', name: '{}', status: '{}' },
          { viewUuid: 'VIEW_DATA', viewType: 'table', name: '{}', status: '{}' }] }
        : JSON.parse(JSON.stringify(config)) };
    }),
    postFormOnce: jest.fn(async (endpoint, params) => {
      expect(endpoint).toBe('/dingtalk/web/APP_TEST/query/dataview/updateConfig.json');
      expect(params).toMatchObject({ formUuid: 'FORM_TEST', viewUuid: 'VIEW_DATA' });
      config = { viewUuid: params.viewUuid, staticConfig: JSON.parse(params.staticConfig),
        defaultConfig: { ...JSON.parse(params.defaultConfig), latestUpdateTime: 1234 } };
      return { success: true };
    }),
  };
  createYidaClient.mockReturnValue(client);
});
afterEach(() => { jest.restoreAllMocks(); fs.rmSync(dir, { recursive: true, force: true }); });
const apply = () => configureCreatedFormView({ corpId: 'ding-test' }, 'APP_TEST', 'FORM_TEST');

test('saves the native server view and verifies title last, preserving unrelated configuration', async () => {
  const before = JSON.parse(JSON.stringify(config));
  const result = await apply();
  expect(result).toMatchObject({ viewUuid: 'VIEW_DATA', changed: true, readbackVerified: true,
    showFields: ['name', 'createTime', 'processInstanceTitle'] });
  expect(config.staticConfig).toEqual(before.staticConfig);
  expect(config.defaultConfig).toEqual({ ...before.defaultConfig, showFields: result.showFields, latestUpdateTime: 1234 });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fs.readFileSync(result.backupPath)).config).toEqual(before);
  fs.rmSync(result.backupPath);
  expect((await apply()).changed).toBe(false);
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});

test('moves a server-initialized title-first array too, keeping hidden columns and relative order', async () => {
  config.defaultConfig.showFields = ['processInstanceTitle', 'createTime', 'name'];
  expect((await apply()).showFields).toEqual(['createTime', 'name', 'processInstanceTitle']);
});

test('uses visible child fields and native show order without showing excluded components', async () => {
  fields = [field('processInstanceTitle', 0), field('table', 2, { componentName: 'TableField', children: [field('child', 3)] }),
    field('name', 1), field('rich', 4, { componentName: 'EditorField' }), field('hidden', 5, { supportVisible: false })];
  expect((await apply()).showFields).toEqual(['name', 'child', 'processInstanceTitle']);
});

test('supports receipt title ID and restricts default columns to server columnFilter', async () => {
  fields[0].id = 'formInstanceTitle';
  config.staticConfig.columnFilter = ['name', 'formInstanceTitle'];
  expect((await apply()).showFields).toEqual(['name', 'formInstanceTitle']);
});

test('preserves a hidden title instead of adding another visible column', async () => {
  config.defaultConfig.showFields = ['name'];
  expect(await apply()).toMatchObject({ changed: false, readbackVerified: true, showFields: ['name'] });
  expect(client.postFormOnce).not.toHaveBeenCalled();
});

test('refuses an absent table view instead of reporting successful creation', async () => {
  client.postForm.mockResolvedValue({ success: true, content: { multiViewInfos: [] } });
  await expect(apply()).rejects.toMatchObject({ code: 'CREATE_FORM_DEFAULT_VIEW_MISSING',
    details: { formUuid: 'FORM_TEST', formCreated: true, stage: 'configureDefaultView' } });
  expect(client.postFormOnce).not.toHaveBeenCalled();
});

test('detects concurrent configuration changes before writing', async () => {
  const read = client.postForm.getMockImplementation();
  let reads = 0;
  client.postForm.mockImplementation((endpoint, params) => {
    if (endpoint.includes('getViewConfig') && ++reads === 2) { config.defaultConfig.widths.name = 333; }
    return read(endpoint, params);
  });
  await expect(apply()).rejects.toMatchObject({ code: 'CREATE_FORM_DEFAULT_VIEW_FAILED', details: { causeCode: 'FORM_VIEW_CONFLICT' } });
  expect(client.postFormOnce).not.toHaveBeenCalled();
});

test.each(['ack-only', 'transport-failure'])('never claims success or replays uncertain view writes: %s', async fault => {
  client.postFormOnce.mockImplementation(async () => {
    if (fault === 'transport-failure') { throw new Error('timeout'); }
    return { success: true };
  });
  await expect(apply()).rejects.toMatchObject({ details: { formUuid: 'FORM_TEST',
    stage: 'configureDefaultView', retrySafe: false } });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});
