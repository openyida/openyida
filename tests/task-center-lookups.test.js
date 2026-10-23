'use strict';

const lookups = require('../lib/task-center/lookups');

test('lookup requests match native taskCenter advanced-search parameters', () => {
  expect(lookups.request('processes', { appType: 'APP_TEST', keyword: '采购' })).toEqual({
    method: 'POST', path: '/dingtalk/web/APP_TEST/query/formdesign/listFormDesignsByFormType.json',
    params: { formTypes: 'process', key: '采购', pageIndex: 1, pageSize: 50 },
  });
  expect(() => lookups.request('forms', { appType: '../other' })).toThrow('appType');
  expect(() => lookups.request('originators', { appType: 'APP_TEST', pageSize: 51 })).toThrow('pageSize');
  expect(lookups.request('forms', { appType: 'APP_TEST' })).toEqual({
    method: 'POST', path: '/dingtalk/web/APP_TEST/query/formdesign/listFormDesignsByFormType.json',
    params: { formTypes: 'process', key: '', pageIndex: 1, pageSize: 50 },
  });
  expect(() => lookups.request('originators', { appType: 'APP_TEST', pageSize: true })).toThrow('pageSize');
  expect(() => lookups.request('originators', { appType: 'APP_TEST', userId: 'other' })).toThrow('userId');
  expect(() => lookups.request('originators', null)).toThrow('options');
});

test('originator options use employee identifiers and expose no extra directory data', () => {
  expect(lookups.normalize('originators', { success: true, content: { values: [
    { staffId: 'staff-a', displayName: '示例成员', email: 'private@example.test' },
    { staffId: 'staff-a', displayName: '重复记录' },
  ] } })).toEqual({ items: [{ value: 'staff-a', label: '示例成员' }], total: null });
});

test('process and form options have distinct semantics and reject scope mismatches', () => {
  const payload = { success: true, content: [
    { appType: 'APP_TEST', formUuid: 'FORM-A', formType: 'receipt', processCode: 'IGNORED', title: { zh_CN: '普通表单' } },
    { appType: 'APP_TEST', formUuid: 'FORM-B', formType: 'process', processCode: 'PROC-B', title: { zh_CN: '审批流程' } },
    { appType: 'APP_TEST', formUuid: 'FORM-C', formType: 'display', title: { zh_CN: '展示页' } },
  ] };
  expect(lookups.normalize('processes', payload, { appType: 'APP_TEST' }).items.map(item => item.value)).toEqual(['PROC-B']);
  expect(lookups.normalize('forms', payload, { appType: 'APP_TEST' }).items.map(item => item.value)).toEqual(['FORM-A', 'PROC-B']);
  expect(() => lookups.normalize('forms', payload, { appType: 'APP_OTHER' })).toThrow('scope');
  expect(lookups.normalize('forms', { success: true, content: [{ formUuid: 'FORM-A', formType: 'receipt', processCode: 'unused', title: '普通表单' }] }).items[0].value).toBe('FORM-A');
});

test('process and form options enforce title search and page size when the endpoint returns every design', () => {
  const payload = { success: true, content: [
    { formUuid: 'FORM-A', formType: 'receipt', title: { zh_CN: '采购申请' } },
    { formUuid: 'FORM-B', formType: 'process', processCode: 'PROC-B', title: { zh_CN: '采购审批' } },
    { formUuid: 'FORM-C', formType: 'receipt', title: { zh_CN: '销售合同' } },
  ] };
  expect(lookups.normalize('forms', payload, { keyword: '采购', pageSize: 1 })).toEqual({
    items: [{ value: 'FORM-A', label: '采购申请', formUuid: 'FORM-A', formType: 'receipt' }], total: 2,
  });
  expect(lookups.normalize('forms', payload, { keyword: 'ZZZ_NOT_EXIST_12345', pageSize: 20 })).toEqual({ items: [], total: 0 });
});

test('malformed or rejected option responses are never treated as a successful empty list', () => {
  expect(() => lookups.normalize('originators', { success: false, content: null })).toThrow('response');
  expect(() => lookups.normalize('originators', { success: true, content: {} })).toThrow('response');
  expect(() => lookups.normalize('processes', { success: true, errorCode: '500', content: [] })).toThrow('response');
  expect(() => lookups.normalize('processes', { success: true, content: [[]] })).toThrow('item');
  expect(lookups.normalize('processes', { success: true, content: null })).toEqual({ items: [], total: 0 });
});

test('browser option loading uses the current session, fixed endpoints and normalized options', async () => {
  const send = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, content: [] }) });
  await expect(lookups.load('forms', { appType: 'APP_TEST', keyword: '合同' }, send)).resolves.toEqual({ items: [], total: 0 });
  expect(send).toHaveBeenCalledWith('/dingtalk/web/APP_TEST/query/formdesign/listFormDesignsByFormType.json', expect.objectContaining({
    method: 'POST', credentials: 'include', cache: 'no-store',
  }));
  expect(Object.fromEntries(new URLSearchParams(send.mock.calls[0][1].body))).toEqual({
    _api: 'nattyFetch', _mock: 'false', formTypes: 'process', key: '合同', pageIndex: '1', pageSize: '50',
  });
  const failed = jest.fn().mockResolvedValue({ ok: false });
  await expect(lookups.load('forms', { appType: 'APP_TEST' }, failed)).rejects.toThrow('request');
  const malformed = jest.fn().mockResolvedValue({ ok: true, json: async () => { throw new Error('not JSON'); } });
  await expect(lookups.load('forms', { appType: 'APP_TEST' }, malformed)).rejects.toThrow('response');
});
