'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execute, parseArgs, normalize, serialize, hash, editable } = require('../lib/app/form-message');

let dir, backupPath, rows, client, formType;
const clone = value => JSON.parse(JSON.stringify(value));
const parsed = (action, extra = []) => parseArgs([action, 'APP_TEST', 'FORM_TEST', ...extra, '--json']);
const config = value => {
  const filename = path.join(dir, `config-${Math.random()}.json`);
  fs.writeFileSync(filename, JSON.stringify(value));
  return filename;
};
const workNotice = (overrides = {}) => ({
  trigger: 'FORM_DATA_CREATE',
  recipients: [{ type: 'variable', value: 'originator' }],
  groups: [],
  template: { key: 'workNotice', title: '新数据提醒', content: '请及时处理', fields: [], image: [], button: null },
  ...overrides,
});
const native = (id = '101', value = workNotice()) => ({
  ...serialize(value, 'FORM_TEST', id), id, formUuid: 'FORM_TEST',
});

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'form-message-test-'));
  backupPath = path.join(dir, 'before.json');
  formType = 'receipt';
  rows = [native()];
  client = {
    getAuthRef: jest.fn(() => ({ baseUrl: 'https://xmtrf1.aliwork.com' })),
    get: jest.fn(async endpoint => {
      if (endpoint.endsWith('listFormMessageBind.json')) {return { success: true, content: clone(rows) };}
      if (endpoint.endsWith('getFormAndAppInfo.json')) {return { success: true, content: { formDatas: { values: [{
        formUuid: 'FORM_TEST', formType, title: { zh_CN: '测试表单' }, fields: [
          { fieldId: 'owner', componentName: 'EmployeeField', label: '负责人' },
          { fieldId: 'amount', componentName: 'NumberField', label: '金额' },
          { fieldId: 'attachment', componentName: 'AttachmentField', label: '附件' },
        ],
      }] } } };}
      throw new Error(`unexpected ${endpoint}`);
    }),
    postFormOnce: jest.fn(async (endpoint, params) => {
      if (endpoint.endsWith('removeMessageBind.json')) {rows = rows.filter(item => String(item.id) !== String(params.id));}
      else if (params.id) {rows = rows.map(item => String(item.id) === String(params.id) ? { ...clone(params), id: String(params.id), formUuid: 'FORM_TEST' } : item);}
      else {rows.push({ ...clone(params), id: '102', formUuid: 'FORM_TEST' });}
      return { success: true, content: true };
    }),
  };
});

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

test('list and inspect normalize the native binding without writes', async () => {
  const list = await execute(parsed('list'), client);
  expect(list).toMatchObject({ totalCount: 1, supportsToggle: false,
    messages: [{ id: '101', trigger: 'FORM_DATA_CREATE', recipients: [{ type: 'variable', value: 'originator' }] }] });
  const inspect = await execute(parsed('inspect', ['101']), client);
  expect(inspect.configHash).toMatch(/^[a-f0-9]{64}$/);
  expect(inspect.configHash).toBe(hash(editable(normalize(rows[0]))));
  expect(client.postFormOnce).not.toHaveBeenCalled();
});

test.each(['https://xmtrf1.aliwork.com/', 'https://private.example.test:8443/'])('settings link uses the authenticated environment for every action: %s', async baseUrl => {
  client.getAuthRef.mockReturnValue({ baseUrl });
  const expected = new URL('/APP_TEST/admin/FORM_TEST/settings/messageSetting', baseUrl).href;
  const assertLink = async args => expect((await execute(args, client)).configUrl).toBe(expected);
  await assertLink(parsed('list'));
  await assertLink(parsed('options'));
  await assertLink(parsed('inspect', ['101']));
  await assertLink(parsed('create', ['--config', config(workNotice())]));
  await assertLink(parsed('update', ['101', '--config', config({ template: { content: '更新通知内容' } })]));
  await assertLink(parsed('update', ['101', '--config', config({ template: { content: '更新通知内容' } })]));
  await assertLink(parsed('delete', ['101', '--yes', '--expected-hash', hash(editable(normalize(rows[0])))]));
});

test('options reports supported write triggers, all seven templates and target fields', async () => {
  const result = await execute(parsed('options'), client);
  expect(result.options.triggers).toEqual(['FORM_DATA_CREATE', 'FORM_DATA_EDIT', 'FORM_DATA_DELETE', 'FORM_COMMENT']);
  expect(result.options.templates).toHaveLength(7);
  expect(result.options.messageFields.map(item => item.fieldId)).toEqual(['owner', 'amount']);
  expect(result.options.recipientFields.map(item => item.fieldId)).toEqual(['owner']);
  expect(result.options).toMatchObject({ supportsToggle: false, recipientVariables: ['originator'] });
});

test('create writes once, backs up and verifies readback', async () => {
  const result = await execute(parsed('create', ['--config', config(workNotice({
    recipients: [{ type: 'employee', value: 'USER_A' }, { type: 'formField', value: 'owner' }],
  })), '--backup', backupPath]), client);
  expect(result).toMatchObject({ changed: true, messageId: '102', readbackVerified: true, backupPath });
  expect(JSON.parse(fs.readFileSync(backupPath)).messages).toHaveLength(1);
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
  expect(client.postFormOnce.mock.calls[0][1]).toMatchObject({ persons: 'USER_A', formField: 'owner', phase: 'FORM_DATA_CREATE' });
});

test('update merges template text while preserving recipients and verifies readback', async () => {
  rows[0].nativeOnly = 'preserved';
  rows[0].studentField = 'legacyRecipientField';
  const beforeHash = hash(editable(normalize(rows[0])));
  const result = await execute(parsed('update', ['101', '--config', config({ template: { content: '内容已更新' } }),
    '--expected-hash', beforeHash, '--backup', backupPath]), client);
  expect(result).toMatchObject({ changed: true, messageId: '101', readbackVerified: true,
    message: { recipients: [{ type: 'variable', value: 'originator' }], template: { content: '内容已更新' } } });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
  expect(client.postFormOnce.mock.calls[0][1]).toMatchObject({ nativeOnly: 'preserved', studentField: 'legacyRecipientField' });
});

test('no-op update does not create backup or write', async () => {
  const result = await execute(parsed('update', ['101', '--config', config({ template: { content: '请及时处理' } }),
    '--backup', backupPath]), client);
  expect(result).toMatchObject({ changed: false, readbackVerified: true });
  expect(fs.existsSync(backupPath)).toBe(false);
  expect(client.postFormOnce).not.toHaveBeenCalled();
});

test('delete requires exact hash, backs up and verifies removal', async () => {
  const expected = hash(editable(normalize(rows[0])));
  const result = await execute(parsed('delete', ['101', '--expected-hash', expected, '--yes', '--backup', backupPath]), client);
  expect(result).toMatchObject({ changed: true, messageId: '101', readbackVerified: true });
  expect(rows).toHaveLength(0);
});

test('stale hashes and concurrent changes stop before mutation', async () => {
  await expect(execute(parsed('update', ['101', '--config', config({ template: { content: '更新' } }),
    '--expected-hash', 'stale']), client)).rejects.toMatchObject({ code: 'FORM_MESSAGE_CONFLICT' });
  let listCalls = 0;
  const get = client.get.getMockImplementation();
  client.get.mockImplementation(async (...args) => {
    if (args[0].endsWith('listFormMessageBind.json') && ++listCalls === 2) {rows[0].phase = 'FORM_DATA_EDIT';}
    return get(...args);
  });
  await expect(execute(parsed('update', ['101', '--config', config({ template: { content: '更新' } })]), client))
    .rejects.toMatchObject({ code: 'FORM_MESSAGE_CONFLICT' });
  expect(client.postFormOnce).not.toHaveBeenCalled();
});

test.each([
  { trigger: 'RECUR_JOB_FIELD' },
  { trigger: 'INST_START' },
  { recipients: [] },
  { recipients: [{ type: 'variable', value: 'currentApproval' }] },
  { recipients: [{ type: 'formField', value: 'amount' }] },
  { template: { key: 'workNotice', title: '', content: '内容' } },
  { template: { key: 'detailImage', title: '详情', fields: [] } },
  { template: { key: 'workNotice', title: '详情', content: '内容', button: { name: '打开', type: 'custom', value: 'javascript:x' } } },
])('invalid or unverified config is rejected before write: %j', async patch => {
  await expect(execute(parsed('create', ['--config', config({ ...workNotice(), ...patch })]), client))
    .rejects.toMatchObject({ code: expect.stringMatching(/^FORM_MESSAGE_/) });
  expect(client.postFormOnce).not.toHaveBeenCalled();
});

test('card field mappings and group pinned cards serialize native card config', async () => {
  const card = workNotice({
    recipients: [{ type: 'variable', value: 'originator' }],
    template: { key: 'detailImage', title: '订单详情', fields: [
      { type: 'variable', value: 'serialNo', title: '流水号' },
      { type: 'formField', value: 'amount', title: '金额' },
    ], image: [], button: { name: '查看详情', type: 'formInstDetail', value: '' } },
  });
  expect((await execute(parsed('create', ['--config', config(card)]), client)).readbackVerified).toBe(true);
  rows = [];
  const pinned = workNotice({ recipients: [], groups: [{ cid: 'GROUP_A', name: '测试群' }],
    template: { key: 'pinnedText', title: '群置顶', content: '请查看', fields: [], image: [] } });
  expect((await execute(parsed('create', ['--config', config(pinned)]), client)).readbackVerified).toBe(true);
});

test('process forms remain readable but mutations fail before write', async () => {
  formType = 'process';
  expect((await execute(parsed('list'), client)).totalCount).toBe(1);
  await expect(execute(parsed('create', ['--config', config(workNotice())]), client))
    .rejects.toMatchObject({ code: 'FORM_MESSAGE_UNSUPPORTED_FORM' });
  expect(client.postFormOnce).not.toHaveBeenCalled();
});

test('ambiguous outcomes expose backup and never replay writes', async () => {
  client.postFormOnce.mockRejectedValueOnce(new Error('timeout'));
  await expect(execute(parsed('create', ['--config', config(workNotice()), '--backup', backupPath]), client))
    .rejects.toMatchObject({ code: 'FORM_MESSAGE_WRITE_FAILED', details: { backupPath, retrySafe: false, sideEffectState: 'unknown' } });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});

test('argument parser requires confirmation and a hash for deletion', () => {
  expect(() => parseArgs(['delete', 'APP_TEST', 'FORM_TEST', '101', '--yes'])).toThrow(expect.objectContaining({ code: 'FORM_MESSAGE_USAGE' }));
  expect(parseArgs(['delete', 'APP_TEST', 'FORM_TEST', '101', '--yes', '--expected-hash', 'abc']))
    .toMatchObject({ action: 'delete', messageId: '101' });
});
