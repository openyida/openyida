'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const qs = require('querystring');

jest.mock('../lib/core/utils', () => ({ httpGet: jest.fn(), httpPost: jest.fn(), requestWithAutoLogin: jest.fn((fn, auth) => fn(auth)) }));
jest.mock('../lib/core/yida-client', () => ({ createAuthRef: jest.fn(() => ({ baseUrl: 'https://example.test', authMode: 'token' })), isTokenAuthRef: () => true }));
jest.mock('../lib/core/chalk', () => Object.fromEntries(['banner', 'step', 'label', 'success', 'fail', 'warn', 'info', 'result', 'usage', 'hint'].map(key => [key, jest.fn()])));

const { httpGet, httpPost } = require('../lib/core/utils');
const { run } = require('../lib/app/import-app');

function form(id, target, alias) {
  return { formUuid: id, name: id, alias, schema: { content: { pages: [{ id, props: { appType: 'APP_OLD',
    associationForm: target, mainFieldId: 'textField_name', label: 'APP_OLD FORM_A',
  } }] } } };
}

describe('two-phase application import', () => {
  let dir, file, cwd, log, writes, created;
  beforeEach(() => {
    jest.clearAllMocks();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-import-'));
    file = path.join(dir, 'export.json');
    cwd = jest.spyOn(process, 'cwd').mockReturnValue(dir);
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
    writes = [];
    created = [];
    httpGet.mockImplementation(async (_base, _url, query) => ({ success: true,
      content: { ...(writes.find(w => w.formUuid === query.formUuid)?.schema || { pages: [] }), gmtModified: 42 } }));
    httpPost.mockImplementation(async (_base, url, body) => {
      const params = qs.parse(body);
      if (url.includes('registerApp')) { return { success: true, content: 'APP_NEW' }; }
      if (url.includes('saveFormSchemaInfo')) {
        const id = `FORM_NEW_${created.length}`;
        created.push(id);
        return { success: true, content: { formUuid: id } };
      }
      writes.push({ ...params, schema: JSON.parse(params.content), createdCount: created.length });
      return { success: true };
    });
  });
  afterEach(() => { cwd.mockRestore(); log.mockRestore(); fs.rmSync(dir, { recursive: true, force: true }); });
  function input(forms) { fs.writeFileSync(file, JSON.stringify({ sourceAppType: 'APP_OLD', forms })); }
  function report() { return JSON.parse(fs.readFileSync(path.join(dir, 'yida-migration-report.json'), 'utf8')); }

  test.each([false, true])('remaps forward and cyclic references without aliases (reverse order: %s)', async reverse => {
    const forms = [form('FORM_A', { appType: 'APP_OLD', formUuid: 'FORM_B' }), form('FORM_B', { appType: 'APP_OLD', formUuid: 'FORM_A' })];
    input(reverse ? forms.reverse() : forms);
    await run([file]);
    expect(writes).toHaveLength(2);
    expect(writes.map(w => w.createdCount)).toEqual([2, 2]);
    expect(writes[0].schema.pages[0].props.associationForm.formUuid).toBe('FORM_NEW_1');
    expect(writes[1].schema.pages[0].props.associationForm.formUuid).toBe('FORM_NEW_0');
    expect(writes[0].schema.pages[0].props.mainFieldId).toBe('textField_name');
    expect(writes[0].schema.pages[0].props.label).toBe('APP_OLD FORM_A');
    expect(report().forms.map(f => f.status)).toEqual(['success', 'success']);
  });

  test('resolves forward form aliases and keeps the mapping in the report only', async () => {
    input([form('FORM_A', { formAlias: 'customer' }), form('FORM_B', {}, 'customer')]);
    await run([file]);
    expect(writes[0].schema.pages[0].props.associationForm).toEqual({ appType: 'APP_NEW', formUuid: 'FORM_NEW_1' });
    expect(JSON.stringify(writes.map(w => w.schema))).not.toContain('formAlias');
    expect(report().forms[1]).toMatchObject({ alias: 'customer', oldFormUuid: 'FORM_B', newFormUuid: 'FORM_NEW_1' });
  });

  test.each([
    ['missing alias', () => [form('FORM_A', { formAlias: 'missing' })]],
    ['empty alias on an external reference', () => [form('FORM_A', { appType: 'APP_EXTERNAL', formUuid: 'FORM_EXTERNAL', formAlias: '' })]],
    ['duplicate alias', () => [form('FORM_A', {}, 'same'), form('FORM_B', {}, 'same')]],
    ['duplicate UUID', () => [form('FORM_A', {}), form('FORM_A', {})]],
    ['missing referenced form', () => [form('FORM_A', { appType: 'APP_OLD', formUuid: 'FORM_MISSING' })]],
    ['conflicting reference', () => [form('FORM_A', { formAlias: 'customer', formUuid: 'FORM_A' }), form('FORM_B', {}, 'customer')]],
  ])('rejects %s before creating an application', async (_label, forms) => {
    input(forms());
    await expect(run([file])).rejects.toMatchObject({ code: 'IMPORT_INVALID_PACKAGE' });
    expect(httpPost).not.toHaveBeenCalled();
  });

  test('placeholder failure stops before any schema save and preserves completed IDs', async () => {
    input([form('FORM_A', {}), form('FORM_B', { formUuid: 'FORM_A' })]);
    const normal = httpPost.getMockImplementation();
    httpPost.mockImplementation(async (...args) => {
      if (args[1].includes('saveFormSchemaInfo') && created.length === 1) { throw new Error('transport interrupted'); }
      return normal(...args);
    });
    await expect(run([file])).rejects.toMatchObject({ code: 'IMPORT_PARTIAL_FAILURE' });
    expect(writes).toHaveLength(0);
    expect(report().forms[0]).toMatchObject({ newFormUuid: 'FORM_NEW_0', status: 'created' });
    expect(report().forms[1]).toMatchObject({ status: 'create_unknown' });
  });

  test('schema failure preserves all IDs, records partial success and returns an error', async () => {
    input([form('FORM_A', {}), form('FORM_B', { formUuid: 'FORM_A' })]);
    const normal = httpPost.getMockImplementation();
    httpPost.mockImplementation(async (...args) => {
      if (args[1].includes('/saveFormSchema.json') && writes.length === 1) { return { success: false, errorMsg: 'save rejected' }; }
      return normal(...args);
    });
    await expect(run([file])).rejects.toMatchObject({ code: 'IMPORT_PARTIAL_FAILURE', details: expect.objectContaining({ retrySafe: false }) });
    expect(report().forms.map(f => f.status)).toEqual(['success', 'save_failed']);
    expect(report().forms.map(f => f.newFormUuid)).toEqual(['FORM_NEW_0', 'FORM_NEW_1']);
    const calls = httpPost.mock.calls.length;
    await expect(run([file])).rejects.toMatchObject({ code: 'IMPORT_RECOVERY_REQUIRED' });
    expect(httpPost).toHaveBeenCalledTimes(calls);
  });

  test('unknown schema result is journaled and never automatically replayed', async () => {
    input([form('FORM_A', {})]);
    const normal = httpPost.getMockImplementation();
    httpPost.mockImplementation(async (...args) => {
      if (args[1].includes('/saveFormSchema.json')) { throw new Error('connection closed after send'); }
      return normal(...args);
    });
    await expect(run([file])).rejects.toMatchObject({ code: 'IMPORT_PARTIAL_FAILURE' });
    expect(report().forms[0].status).toBe('save_unknown');
    expect(httpPost.mock.calls.filter(call => call[1].includes('/saveFormSchema.json'))).toHaveLength(1);
  });

  test('invalid source schemas fail before remote writes', async () => {
    input([{ formUuid: 'FORM_A', schema: { success: false, content: { pages: [] } } }]);
    await expect(run([file])).rejects.toMatchObject({ code: 'IMPORT_INVALID_PACKAGE' });
    expect(httpPost).not.toHaveBeenCalled();
  });

  test('explicit external references remain unchanged', async () => {
    input([form('FORM_A', { appType: 'APP_EXTERNAL', formUuid: 'FORM_A' })]);
    await run([file]);
    expect(writes[0].schema.pages[0].props.associationForm).toEqual({ appType: 'APP_EXTERNAL', formUuid: 'FORM_A' });
  });

  test('lost application-create response leaves a journal and blocks duplicate creation', async () => {
    input([form('FORM_A', {})]);
    httpPost.mockRejectedValue(new Error('connection closed after send'));
    await expect(run([file])).rejects.toMatchObject({ code: 'IMPORT_PARTIAL_FAILURE' });
    expect(report().status).toBe('app_create_unknown');
    await expect(run([file])).rejects.toMatchObject({ code: 'IMPORT_RECOVERY_REQUIRED' });
    expect(httpPost).toHaveBeenCalledTimes(1);
  });

  test('accepted save with stale reference readback is not reported as success', async () => {
    input([form('FORM_A', { formUuid: 'FORM_B' }), form('FORM_B', {})]);
    httpGet.mockImplementation(async () => ({ success: true, content: { pages: [], gmtModified: 42 } }));
    await expect(run([file])).rejects.toMatchObject({ code: 'IMPORT_PARTIAL_FAILURE' });
    expect(report().forms[0].status).toBe('verify_failed');
    expect(report().forms[0].readbackVerified).not.toBe(true);
    expect(writes).toHaveLength(1);
  });

  test('invalid revision stops before schema transport', async () => {
    input([form('FORM_A', {})]);
    httpGet.mockResolvedValue({ success: true, content: { pages: [] } });
    await expect(run([file])).rejects.toMatchObject({ code: 'IMPORT_PARTIAL_FAILURE' });
    expect(report().forms[0].status).toBe('read_failed');
    expect(writes).toHaveLength(0);
  });

  test('a completed legacy report does not block a new import', async () => {
    input([form('FORM_A', {})]);
    fs.writeFileSync(path.join(dir, 'yida-migration-report.json'), JSON.stringify({ forms: [{ status: 'success' }] }));
    await run([file]);
    expect(report().status).toBe('complete');
  });
});
