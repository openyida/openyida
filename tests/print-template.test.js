'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { fields, build, compile } = require('../lib/print-template/builder');
const { execute, parseArgs, settings } = require('../lib/print-template/print-template');
const { hash } = require('../lib/print-template/model');
const codes = require('../lib/print-template/codes');
const scenes = require('../lib/print-template/scenes');
const detail = require('../lib/print-template/detail');

const app = 'APP_TEST';
const form = 'FORM_TEST';
const rawFields = { formField: [
  { key: 'text', description: '{"zh_CN":"客户"}', type: 'value', children: [] },
  { key: 'date_timestamp', description: '日期', type: 'date', children: [{ key: 'yyyy-MM-dd', description: '年月日', type: 'boolean' }] },
  { key: 'lines', description: '明细', type: 'table', children: [{ key: 'price', description: '单价', type: 'value' }] },
], systemField: [{ key: 'originator', description: '发起人', type: 'value' }] };
const dictionary = fields(rawFields);
const document = { title: '报价单', blocks: [{ type: 'fields', columns: 2, fields: ['客户', '日期'] },
  { type: 'table', field: '明细', columns: ['单价'] }, { type: 'html', html: '<p>签字：{{发起人}}</p>' }] };
let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-print-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });
const file = (name, value) => { const output = path.join(dir, name); fs.writeFileSync(output, JSON.stringify(value)); return output; };
const ok = content => ({ success: true, content });

/** Model a native server, including optional dictionary fields added after persistence. */
function server(options = {}) {
  const metadata = { formUuid: form, templateId: 123, title: '{"zh_CN":"已有模板","en_US":"Existing"}', description: '{}', templateType: '', status: 'START', roleMembers: [], fileNameConfig: '$!{instanceTitle}' };
  let body = options.body || {};
  const calls = [];
  const client = {
    get: jest.fn(async (url) => {
      if (url.endsWith('listTemplate.json') || url.endsWith('listTemplateWithAuth.json')) { return ok([metadata]); }
      if (url.endsWith('queryTemplateById.json')) { return ok(body); }
      if (url.endsWith('listDictionarys.json')) { return ok(rawFields); }
      throw new Error(url);
    }),
    postFormOnce: jest.fn(async (url, params) => {
      calls.push({ url, params });
      if (options.throwWrite) { throw new Error('transport disconnected'); }
      if (url.endsWith('saveTemplate.json')) {
        body = { termContents: params.termContents, termJsonAttr: params.termJsonAttr,
          dictionaryList: JSON.parse(params.dictionaryList).map(item => ({ ...item, children: [], printProps: null, componentName: '' })), gmtModified: 101 };
        if (options.corrupt) { body.termContents = '<div>lost content</div>'; }
        return ok({ gmtModified: 101 });
      }
      if (url.endsWith('print.json')) { return ok(987); }
      return ok(null);
    }),
  };
  return { client, calls };
}

async function inspect(client) { return execute(parseArgs(['inspect', app, form, '123']), client); }

test('builds native repeat-table/date/system macros with live keys and escaped literals', () => {
  const result = build({ ...document, title: '<报价&单>' }, dictionary);
  expect(result.termContents).toContain('&lt;报价&amp;单&gt;');
  expect(result.termContents).toContain('font-family:SimSun;');
  expect(result.dictionaryList.map(item => item.key)).toEqual(['text', 'date_timestamp', 'lines', 'originator']);
  expect(result.termJsonAttr.find(item => item.type === 'date').content).toContain('dateformat="yyyy-MM-dd"');
  expect(result.termJsonAttr.find(item => item.type === 'table').content).toContain('class="render-table row"');
  expect(result.termJsonAttr.find(item => item.type === 'table').content).toContain('key="price"');
});

test.each([
  { blocks: [{ type: 'field', field: '不存在' }] },
  { blocks: [{ type: 'field', field: '日期', format: 'not-a-format' }] },
  { blocks: [{ type: 'html', html: '<script>alert(1)</script>' }] },
  { paperSize: 'A4', ...document },
  { blocks: [{ type: 'image', url: 'javascript:bad' }] },
])('rejects unknown fields, formats, executable markup and unsupported settings: %j', config => {
  expect(() => build(config, dictionary)).toThrow();
});

test('ambiguous labels fail and exact field keys remain usable', () => {
  const duplicate = [...dictionary, { key: 'text2', label: '客户', type: 'value' }];
  expect(() => build({ blocks: [{ type: 'field', field: '客户' }] }, duplicate)).toThrow();
  expect(() => build({ blocks: [{ type: 'field', field: 'text' }] }, duplicate)).not.toThrow();
});

test('native import rejects orphan macros and missing dictionary entries', () => {
  const result = build(document, dictionary);
  expect(() => compile({ ...result, termContents: result.termContents + ' #macro_missing ' }, dictionary)).toThrow();
  expect(() => compile({ ...result, dictionaryList: [] }, dictionary)).toThrow();
});

test('rejects unsupported options, duplicate options, target path traversal and missing hashes before auth', () => {
  for (const args of [
    ['inspect', app, form, '../123'], ['save', app, form, '123', '--config', 'a'],
    ['list', app, form, '--name', 'x'], ['list', app, form, '--json', '--json'],
  ]) { expect(() => parseArgs(args)).toThrow(); }
});

test('metadata patches preserve other locales and require explicit permission scope edits', () => {
  expect(settings({ title: { zh_CN: '旧名', ja_JP: '保持' } }, { title: '新名' }).title.ja_JP).toBe('保持');
  expect(settings({ title: { zh_CN: '旧名' }, description: { zh_CN: '原描述' } }, { title: '新名' }).description.zh_CN).toBe('原描述');
  expect(() => settings({}, { roleData: [{ roleType: 'ALL', roleValue: 'y' }] })).toThrow();
  expect(() => settings({}, { fileNameConfig: '#evaluate($x)' })).toThrow();
});

test('saves a backed-up body, sends native concurrency timestamp and tolerates derived dictionary metadata', async () => {
  const { client, calls } = server({ body: { termContents: '', termJsonAttr: [], dictionaryList: [], gmtModified: 100 } });
  const before = await inspect(client);
  const backupPath = path.join(dir, 'backup.json');
  const result = await execute(parseArgs(['save', app, form, '123', '--config', file('doc.json', { document }), '--expected-hash', before.configHash, '--backup', backupPath]), client);
  expect(result.readbackVerified).toBe(true);
  expect(calls[0].params.gmtModified).toBe('100');
  expect(JSON.parse(fs.readFileSync(backupPath)).content.gmtModified).toBe(100);
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});

test('a stale fingerprint or wrong restore target performs zero writes', async () => {
  const { client } = server();
  await expect(execute(parseArgs(['save', app, form, '123', '--config', file('doc.json', { document }), '--expected-hash', 'a'.repeat(64)]), client)).rejects.toMatchObject({ code: 'PRINT_TEMPLATE_STALE_CONFIG' });
  const before = await inspect(client);
  await expect(execute(parseArgs(['restore', app, form, '123', '--config', file('backup.json', { ...before, appType: 'APP_OTHER' }), '--expected-hash', before.configHash]), client)).rejects.toMatchObject({ code: 'PRINT_TEMPLATE_TARGET_MISMATCH' });
  expect(client.postFormOnce).not.toHaveBeenCalled();
});

test('write transport failure is never replayed and includes a recoverable backup', async () => {
  const { client } = server({ throwWrite: true });
  const before = await inspect(client);
  await expect(execute(parseArgs(['save', app, form, '123', '--config', file('doc.json', { document }), '--expected-hash', before.configHash, '--backup', path.join(dir, 'before.json')]), client))
    .rejects.toMatchObject({ details: { retrySafe: false, sideEffectState: 'unknown' } });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
  expect(fs.existsSync(path.join(dir, 'before.json'))).toBe(true);
});

test('accepted writes with incorrect readback are reported as unverified', async () => {
  const { client } = server({ corrupt: true });
  const before = await inspect(client);
  await expect(execute(parseArgs(['save', app, form, '123', '--config', file('doc.json', { document }), '--expected-hash', before.configHash, '--backup', path.join(dir, 'before.json')]), client))
    .rejects.toMatchObject({ code: 'PRINT_TEMPLATE_READBACK_MISMATCH', details: { mutationAccepted: true, sideEffectState: 'accepted_unverified' } });
});

test('a reused backup path fails before any remote mutation', async () => {
  const { client } = server();
  const before = await inspect(client);
  await expect(execute(parseArgs(['save', app, form, '123', '--config', file('doc.json', { document }), '--expected-hash', before.configHash, '--backup', file('already.json', {})]), client)).rejects.toMatchObject({ code: 'EEXIST' });
  expect(client.postFormOnce).not.toHaveBeenCalled();
});

test('auth sentinels and malformed business responses fail closed', async () => {
  for (const response of [{ success: true, __needLogin: true }, { success: true, content: {} }, { success: false, errorMsg: 'permission denied' }]) {
    const client = { get: jest.fn(async () => response), postFormOnce: jest.fn() };
    await expect(execute(parseArgs(['list', app, form]), client)).rejects.toThrow();
    expect(client.postFormOnce).not.toHaveBeenCalled();
  }
});

test('fingerprints change with metadata, timestamps or content changes', () => {
  const original = { template: { title: 'A' }, content: { gmtModified: 100 } };
  expect(hash(original)).not.toBe(hash({ ...original, content: { gmtModified: 101 } }));
  expect(hash(original)).not.toBe(hash({ ...original, template: { title: 'B' } }));
});

test('supports native checkbox groups, images and live approval nodes', () => {
  const extra = fields({ ...rawFields, formField: [...rawFields.formField,
    { key: 'choice', description: '选择', type: 'commonCheckbox', children: [{ key: 'yes', type: 'boolean', description: '同意' }] },
    { key: 'photo', description: '图片', type: 'img', children: [] }],
  approvedNode: [{ key: 'approval1', description: '主管审批', type: 'yidaApproveNode', children: [{ key: 'approver', description: '审批人', type: 'value' }] }] });
  const result = build({ blocks: [{ type: 'field', field: '选择' }, { type: 'field', field: '图片', width: 100 },
    { type: 'table', field: '主管审批', columns: ['审批人'] }] }, extra);
  expect(result.termJsonAttr.map(item => item.type)).toEqual(['commonCheckbox', 'img', 'yidaApproveNode']);
});

test('native copy with an omitted dictionary is completed once on the new resource and verified', async () => {
  const originalBody = { ...build(document, dictionary), gmtModified: 100 };
  const metadata = { formUuid: form, templateId: 123, title: '{"zh_CN":"原稿"}', description: '{}', templateType: '' };
  let copied;
  let copiedBody;
  const client = {
    get: jest.fn(async url => {
      if (url.endsWith('listTemplate.json')) { return ok(copied ? [metadata, copied] : [metadata]); }
      if (url.endsWith('listDictionarys.json')) { return ok(rawFields); }
      throw new Error(url);
    }),
    postFormOnce: jest.fn(async (url, params) => {
      if (url.endsWith('copyTemplateIndependently.json')) {
        copied = { ...metadata, templateId: 124, title: params.title };
        copiedBody = { ...originalBody, dictionaryList: [] };
        return ok(124);
      }
      if (url.endsWith('saveTemplate.json')) {
        expect(params.templateId).toBe('124');
        copiedBody = { ...copiedBody, dictionaryList: JSON.parse(params.dictionaryList) };
        return ok({ gmtModified: 100 });
      }
      throw new Error(url);
    }),
  };
  const nativeGet = client.get.getMockImplementation();
  client.get.mockImplementation(async (url, params) => url.endsWith('queryTemplateById.json') ? ok(params.templateId === '123' ? originalBody : copiedBody) : nativeGet(url, params));
  const before = await inspect(client);
  const result = await execute(parseArgs(['copy', app, form, '123', '--name', '复制稿', '--expected-hash', before.configHash, '--backup', path.join(dir, 'source.json')]), client);
  expect(result.readbackVerified).toBe(true);
  expect(result.templateId).toBe('124');
  expect(client.postFormOnce).toHaveBeenCalledTimes(2);
  // The repair backup is created by the real backup helper; remove this test-only artifact.
  fs.rmSync(result.copyBackupPath);
});

test('ordering requires the exact template set, rejects duplicates and verifies the readback order', async () => {
  const a = { formUuid: form, templateId: 0, title: '{}', description: '{}', templateType: 'DEFAULT' };
  const b = { ...a, templateId: 123, templateType: '' };
  let templates = [a, b];
  const client = { get: jest.fn(async () => ok(templates)), postFormOnce: jest.fn(async (_, params) => {
    templates = JSON.parse(params.templateIdList).map(id => [a, b].find(item => item.templateId === id)); return ok(null);
  }) };
  const listed = await execute(parseArgs(['list', app, form]), client);
  await expect(execute(parseArgs(['order', app, form, '--config', file('bad-order.json', [0, 0]), '--expected-hash', listed.orderHash]), client)).rejects.toThrow();
  expect(client.postFormOnce).not.toHaveBeenCalled();
  const result = await execute(parseArgs(['order', app, form, '--config', file('order.json', ['123', '0']), '--expected-hash', listed.orderHash, '--backup', path.join(dir, 'order-before.json')]), client);
  expect(result.templates.map(item => item.templateId)).toEqual(['123', '0']);
});

test('PDF requests retain CUSTOM template permission checks and never claim a ready file', async () => {
  const { client, calls } = server();
  const result = await execute(parseArgs(['render', app, form, '123', '--instance', 'FINST_TEST']), client);
  expect(calls[0].params.templateType).toBe('CUSTOM');
  expect(result.fileReadyVerified).toBe(false);
  fs.rmSync(result.backupPath);
});

const codeFields = (capability = { enabled: true }) => fields({ formField: [
  { key: 'textField_order', description: '订单编号', type: 'value', children: [] },
  { key: 'numberField_amount', description: '金额', type: 'value', children: [] },
  { key: 'dateField_date_timestamp', description: '日期', type: 'date', children: [] },
  { key: 'tableField_items', description: '明细', type: 'table', children: [
    { key: 'textField_sku', description: '商品编码', type: 'value', children: [] },
  ] },
], systemField: [{ key: 'serialNo', description: '流水号', type: 'value', children: [] }] }, capability);

test('field QR and barcodes compile to native dynamic images with the correct suffix and dimensions', () => {
  const result = build({ blocks: [{ type: 'qrcode', field: '订单编号', width: 120, height: 120 },
    { type: 'barcode', field: '金额' }, { type: 'qrcode', field: '流水号' }] }, codeFields());
  expect(result.dictionaryList.map(item => item.key)).toEqual(['textField_order.qrcode', 'numberField_amount.barcode', 'serialNo.qrcode']);
  expect(result.termJsonAttr.map(item => item.type)).toEqual(['img', 'img', 'img']);
  expect(result.termJsonAttr[0].content).toContain('td-width="120.0"');
  expect(result.termJsonAttr[0].content).toContain('td-height="120.0"');
  expect(result.termJsonAttr[0].content).toContain('${订单编号.二维码}');
  expect(result.termJsonAttr[1].content).toContain('td-width="240.0"');
  expect(result.termJsonAttr[1].content).toContain('td-height="80.0"');
  expect(result.termContents).toContain('width:120px;height:120px;');
  expect(compile(result, codeFields())).toEqual(result);
  const fractional = build({ blocks: [{ type: 'qrcode', field: '订单编号', width: 120.5, height: 120.5 }] }, codeFields());
  expect(fractional.termJsonAttr[0].content).toContain('td-width="120.5"');
});

test('QR/barcode rendering works in field grids and repeating subtable columns', () => {
  const result = build({ blocks: [{ type: 'fields', columns: 2, fields: [{ field: '订单编号', render: 'qrcode' }, { field: '金额', render: 'barcode' }] },
    { type: 'table', field: '明细', columns: [{ field: '商品编码', render: 'barcode', width: 200, height: 70 }] }] }, codeFields());
  expect(result.termJsonAttr[2].content).toContain('key="textField_sku.barcode"');
  expect(result.termJsonAttr[2].content).toContain('keytype="img"');
});

test.each([
  { enabled: false, reason: 'edition_not_supported' },
  { enabled: false, reason: 'feature_not_enabled' },
  { enabled: false, reason: 'feature_unverified' },
])('unavailable field-code capabilities block authored and imported codes: %j', capability => {
  const doc = { blocks: [{ type: 'qrcode', field: '订单编号' }] };
  expect(() => build(doc, codeFields(capability))).toThrow();
  const native = build(doc, codeFields());
  expect(() => compile(native, codeFields(capability))).toThrow();
});

test('unknown fields, unsupported field types, formats and dimensions cannot be converted to codes', () => {
  for (const block of [{ type: 'barcode', field: '日期' }, { type: 'qrcode', field: '不存在' },
    { type: 'field', field: '订单编号', render: 'ean13' }, { type: 'qrcode', field: '订单编号', width: -1 }]) {
    expect(() => build({ blocks: [block] }, codeFields())).toThrow();
  }
  const native = build({ blocks: [{ type: 'qrcode', field: '订单编号' }] }, codeFields());
  native.dictionaryList[0].key = 'missing.qrcode';
  expect(() => compile(native, codeFields())).toThrow();
});

test('native repeating-table imports validate embedded code fields and the image protocol', () => {
  const native = build({ blocks: [{ type: 'table', field: '明细', columns: [{ field: '商品编码', render: 'barcode' }] }] }, codeFields());
  expect(compile(native, codeFields())).toEqual(native);
  expect(() => compile(native, codeFields({ enabled: false, reason: 'feature_not_enabled' }))).toThrow();
  const invalid = JSON.parse(JSON.stringify(native));
  invalid.termJsonAttr[0].content = invalid.termJsonAttr[0].content.replace('keytype="img"', 'keytype="value"');
  expect(() => compile(invalid, codeFields())).toThrow();
  invalid.termJsonAttr[0].content = native.termJsonAttr[0].content.replace('textField_sku.barcode', 'missing.barcode');
  expect(() => compile(invalid, codeFields())).toThrow();
  expect(() => build({ blocks: [{ type: 'field', field: '明细', render: 'qrcode' }] }, codeFields())).toThrow();
});

test.each([
  ['HYBRID_CLOUD', true, true], ['PRO', true, true], ['vip', true, true],
  ['lite', true, false], ['FREE', true, false], ['PRO', false, false], ['PRO', 'true', false],
])('matches the native editor gates: edition=%s gray=%s => enabled=%s', async (edition, gray, enabled) => {
  const client = { get: jest.fn(async url => ok(url.includes('commodity') ? { corpVersion: edition } : gray)) };
  expect((await codes.capabilities(client)).enabled).toBe(enabled);
});

test('a failed capability lookup remains unavailable without blocking ordinary text templates', async () => {
  const client = { get: jest.fn(async () => { throw new Error('no connection'); }) };
  const capability = await codes.capabilities(client);
  expect(capability.enabled).toBe(false);
  expect(() => build({ blocks: [{ type: 'field', field: '订单编号' }] }, codeFields(capability))).not.toThrow();
});

test('scene bindings resolve semantic roles to real table-scoped fields without changing source samples', () => {
  const bindings = { 发货编号: 'text', 收货单位: '客户', 发货日期: '日期', 经办人: '发起人', 发货明细: 'lines',
    商品名称: 'price', 发货数量: 'price', 交接备注: '客户' };
  const source = scenes.document('delivery', bindings);
  expect(build(source.document, dictionary).dictionaryList.map(item => item.key)).toContain('lines');
  expect(scenes.document('delivery').document.blocks[0].fields[0]).toBe('发货编号');
  expect(() => scenes.document('delivery', { ...bindings, 拼错字段: 'text' })).toThrow();
  expect(() => build(scenes.document('delivery', { ...bindings, 发货明细: 'text' }).document, dictionary)).toThrow();
  expect(() => build(scenes.document('delivery', { ...bindings, 商品名称: 'text' }).document, dictionary)).toThrow();
});

test('scene build returns reusable authored and native content and performs no remote writes', async () => {
  const { client } = server();
  const result = await execute(parseArgs(['build', app, form, '--scene', 'codes', '--bindings', file('bindings.json', { 订单编号: '客户' })]), client)
    .catch(error => error);
  // The actual field is not eligible for native codes; capabilities must not be bypassed by scene mode.
  expect(result).toBeInstanceOf(Error);
  const delivery = { 发货编号: 'text', 收货单位: '客户', 发货日期: '日期', 经办人: '发起人', 发货明细: 'lines', 商品名称: 'price', 发货数量: 'price', 交接备注: '客户' };
  const built = await execute(parseArgs(['build', app, form, '--scene', 'delivery', '--bindings', file('delivery.json', delivery), '--out', path.join(dir, 'native.json')]), client);
  expect(built.saved).toBe(false);
  expect(built.document.title).toBe('发货交接单');
  expect(JSON.parse(fs.readFileSync(built.outputPath)).termContents).toContain('发货交接单');
  expect(client.postFormOnce).not.toHaveBeenCalled();
  for (const flags of [['--config', 'a', '--scene', 'order'], ['--scene', 'missing'], ['--config', 'a', '--bindings', 'b']]) {
    expect(() => parseArgs(['build', app, form, ...flags])).toThrow();
  }
});

/** Model two-phase create so failed saves cannot accidentally create another template. */
function creationServer(failSave = false) {
  let metadata;
  let body = {};
  const client = { get: jest.fn(async url => {
    if (url.endsWith('listDictionarys.json')) { return ok(rawFields); }
    if (url.endsWith('listTemplate.json')) { return ok(metadata ? [metadata] : []); }
    if (url.endsWith('queryTemplateById.json')) { return ok(body); }
    throw new Error(url);
  }), postFormOnce: jest.fn(async (url, params) => {
    if (url.endsWith('createTemplate.json')) {
      metadata = { templateId: 456, formUuid: form, title: params.title, description: '{}', status: 'START' };
      return ok(456);
    }
    if (failSave) { throw new Error('save disconnected'); }
    body = { termContents: params.termContents, termJsonAttr: params.termJsonAttr, dictionaryList: params.dictionaryList, gmtModified: 101 };
    return ok({ gmtModified: 101 });
  }) };
  return client;
}

test('create with config validates before mutation and returns a saved template with both backups', async () => {
  const client = creationServer();
  const invalid = parseArgs(['create', app, form, '--name', '新模板', '--config', file('invalid.json', { document: { blocks: [{ type: 'field', field: '不存在' }] } })]);
  await expect(execute(invalid, client)).rejects.toThrow();
  expect(client.postFormOnce).not.toHaveBeenCalled();
  const result = await execute(parseArgs(['create', app, form, '--name', '新模板', '--config', file('create.json', { document }), '--backup', path.join(dir, 'create-before.json')]), client);
  expect(result).toMatchObject({ action: 'create', templateId: '456', created: true, contentSaved: true, readbackVerified: true });
  expect(client.postFormOnce.mock.calls.map(([url]) => url.split('/').pop())).toEqual(['createTemplate.json', 'saveTemplate.json']);
  expect(fs.existsSync(result.createBackupPath)).toBe(true);
  fs.rmSync(result.backupPath);
});

test('a failed create-content save exposes the created ID and never retries either mutation', async () => {
  const client = creationServer(true);
  const error = await execute(parseArgs(['create', app, form, '--name', '新模板', '--config', file('create.json', { document }), '--backup', path.join(dir, 'before.json')]), client).catch(value => value);
  expect(error.details).toMatchObject({ createdTemplateId: '456', mutationAccepted: true, retrySafe: false });
  expect(client.postFormOnce).toHaveBeenCalledTimes(2);
  fs.rmSync(error.details.contentSaveDetails.backupPath);
});

const detailUrl = `https://tenant.aliwork.com/${app}/formDetail/${form}?formInstId=FINST_TEST`;

test('native record URLs parse form/process, legacy and activity identifiers without guessing', () => {
  expect(detail.parse(detailUrl)).toMatchObject({ appType: app, formUuid: form, instance: 'FINST_TEST', kind: 'formDetail' });
  expect(detail.parse(detailUrl.replace('formDetail', 'processDetail') + '&activityId=ACT_1')).toMatchObject({ activityId: 'ACT_1', kind: 'processDetail' });
  expect(detail.parse(`https://tenant.aliwork.com/alibaba/web/${app}/inst/formEdit.html?formInstId=FINST_TEST&formUuid=FORM-TEST`)).toMatchObject({ formUuid: 'FORM-TEST' });
  for (const url of [detailUrl.replace('FINST_TEST', ''), detailUrl + '&formInstId=OTHER', detailUrl + '&formUuid=FORM_OTHER',
    detailUrl.replace('tenant.', 'user:password@tenant.'), detailUrl.replace('formDetail', 'dataManage'), detailUrl + '#another-record']) {
    expect(() => detail.parse(url)).toThrow();
  }
});

test('detail-link lists use record-scoped authorization, omit ordering hashes and never require admin body reads', async () => {
  const { client } = server();
  client.getAuthRef = () => ({ baseUrl: 'https://tenant.aliwork.com' });
  const result = await execute(parseArgs(['list', '--detail-url', detailUrl]), client);
  expect(result).toMatchObject({ authorizationScoped: true, instance: 'FINST_TEST' });
  expect(result.orderHash).toBeUndefined();
  expect(client.get).toHaveBeenCalledWith(expect.stringContaining('listTemplateWithAuth.json'), { formUuid: form, formInstId: 'FINST_TEST' });
  expect(client.get).toHaveBeenCalledTimes(1);
});

test('rendering a detail link uses the authorized runtime template, activity and exact record', async () => {
  const { client, calls } = server();
  client.getAuthRef = () => ({ baseUrl: 'https://tenant.aliwork.com' });
  const result = await execute(parseArgs(['render', '--detail-url', detailUrl.replace('formDetail', 'processDetail') + '&activityId=ACT_1', '--template-id', '123']), client);
  expect(calls[0].params).toMatchObject({ templateType: 'CUSTOM', templateId: '123', formInstId: 'FINST_TEST', activityId: 'ACT_1' });
  expect(client.get).toHaveBeenCalledTimes(1);
  expect(result).toMatchObject({ fileReadyVerified: false, authorizationScoped: true });
  fs.rmSync(result.backupPath);
});

test('cross-origin links, missing template choices, mixed targets and unavailable templates do not print', async () => {
  const { client } = server();
  client.getAuthRef = () => ({ baseUrl: 'https://other.aliwork.com' });
  await expect(execute(parseArgs(['render', '--detail-url', detailUrl, '--template-id', '123']), client)).rejects.toMatchObject({ code: 'PRINT_TEMPLATE_TARGET_MISMATCH' });
  expect(client.get).not.toHaveBeenCalled();
  client.getAuthRef = () => ({ baseUrl: 'https://tenant.aliwork.com' });
  await expect(execute(parseArgs(['render', '--detail-url', detailUrl, '--template-id', '999']), client)).rejects.toThrow();
  expect(client.postFormOnce).not.toHaveBeenCalled();
  for (const args of [['render', '--detail-url', detailUrl], ['render', app, form, '123', '--detail-url', detailUrl],
    ['list', '--detail-url', detailUrl, '--instance', 'FINST_OTHER']]) { expect(() => parseArgs(args)).toThrow(); }
});

test('default runtime printing sends DEFAULT without a custom template ID', async () => {
  const client = { get: jest.fn(async () => ok([{ templateId: 0, formUuid: form, title: '{}', templateType: 'DEFAULT' }])),
    postFormOnce: jest.fn(async () => ok(999)) };
  const result = await execute(parseArgs(['render', app, form, '0', '--instance', 'FINST_TEST']), client);
  expect(client.postFormOnce.mock.calls[0][1]).toEqual({ formUuid: form, formInstId: 'FINST_TEST', templateType: 'DEFAULT' });
  fs.rmSync(result.backupPath);
});
