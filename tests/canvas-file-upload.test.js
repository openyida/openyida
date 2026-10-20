'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const { run } = require('../lib/core/sample');
const { compileCanvasLocal } = require('../lib/app/canvas-compile');
const { CANVAS_YIDA_API_BRIDGE_SOURCE, buildCanvasPageSchemaObject } = require('../lib/app/services/canvas-page-schema-builder');
const clientSource = fs.readFileSync(path.join(__dirname, '../lib/samples/openyida-scaffold/file-upload-client.jsx'), 'utf8');
const sampleSource = fs.readFileSync(path.join(__dirname, '../lib/samples/openyida-scaffold/canvas-file-upload.jsx'), 'utf8');
const binding = { appType: 'APP_test', formUuid: 'FORM_test', businessType: 'evidence' };
const file = { name: '中文 报告.png', size: 123, type: 'image/png' };
const credential = {
  accessid: 'temporary-id', policy: 'signed-policy', signature: 'signed-value',
  host: 'https://upload.example.com', objectName: 'APP_test/server-file.png', uploadToken: 'upload-token',
};
const json = content => ({ ok: true, json: async () => ({ success: true, content }) });
let host;
let api;

beforeEach(() => {
  class TestFormData {
    constructor() { this.fields = []; }
    append(...args) { this.fields.push(args); }
  }
  host = {
    document: { cookie: 'other=x; tianshu_csrf_token=csrf%20token' },
    location: { origin: 'https://private.example.com' }, URL, FormData: TestFormData,
    fetch: jest.fn()
      .mockResolvedValueOnce(json(credential))
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce(json({ success: true, fileUploadId: 42 }))
      .mockResolvedValueOnce(json({ downloadUrl: '/ossFileHandle?sign=x', previewUrl: '/inst/preview?sign=y' })),
    parent: {}, top: {},
  };
  const context = vm.createContext({ host });
  api = vm.runInContext(clientSource + '\ncreateYidaFileClient(host);', context);
});

test('uploads and confirms in order using authenticated JSON and exact OSS multipart fields', async () => {
  const uploaded = await api.upload(binding, file);
  expect(uploaded).toMatchObject({
    name: file.name, size: 123, objectName: credential.objectName,
    fileUuid: credential.objectName, fileUploadId: 42,
    downloadUrl: 'https://private.example.com/ossFileHandle?sign=x',
    previewUrl: 'https://private.example.com/inst/preview?sign=y',
  });
  const [url, options] = host.fetch.mock.calls[0];
  expect(url).toBe('/APP_test/openapi/file/getUploadCredential.json');
  expect(options).toMatchObject({ method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json' } });
  expect(JSON.parse(options.body)).toEqual({ ...binding, fileName: file.name, fileSize: 123, contentType: 'image/png' });
  const [ossUrl, ossOptions] = host.fetch.mock.calls[1];
  expect(ossUrl).toBe('https://upload.example.com/');
  expect(ossOptions.credentials).toBe('omit');
  expect(ossOptions.headers).toEqual({});
  expect(ossOptions.body.fields).toEqual([
    ['key', credential.objectName], ['policy', credential.policy], ['OSSAccessKeyId', credential.accessid],
    ['signature', credential.signature], ['success_action_status', '200'],
    ['Content-Disposition', 'attachment; filename=' + file.name], ['file', file, file.name],
  ]);
  expect(JSON.parse(host.fetch.mock.calls[2][1].body)).toEqual({
    ...binding, fileName: file.name, fileSize: 123, objectName: credential.objectName, uploadToken: credential.uploadToken,
  });
  expect(uploaded).not.toHaveProperty('uploadToken');
});

test('identifies HTML responses at the credential stage without starting OSS upload', async () => {
  host.fetch.mockReset().mockResolvedValueOnce({ ok: true, json: async () => { throw new SyntaxError('HTML response'); } });
  await expect(api.upload(binding, file)).rejects.toMatchObject({ code: 'FILE_RESPONSE_INVALID', stage: 'getUploadCredential' });
  expect(host.fetch).toHaveBeenCalledTimes(1);
});

test('identifies credential network failures without starting OSS upload', async () => {
  host.fetch.mockReset().mockRejectedValueOnce(new TypeError('Failed to fetch'));
  await expect(api.upload(binding, file)).rejects.toMatchObject({ code: 'FILE_NETWORK_ERROR', stage: 'getUploadCredential' });
  expect(host.fetch).toHaveBeenCalledTimes(1);
});

test('identifies OSS network failures without confirming an unuploaded file', async () => {
  host.fetch.mockReset().mockResolvedValueOnce(json(credential)).mockRejectedValueOnce(new TypeError('Failed to fetch'));
  await expect(api.upload(binding, file)).rejects.toMatchObject({ code: 'FILE_OSS_NETWORK_ERROR', stage: 'oss' });
  expect(host.fetch).toHaveBeenCalledTimes(2);
});

test('gateway headers do not override multipart type or leak platform credentials', async () => {
  host.fetch.mockReset()
    .mockResolvedValueOnce(json({ ...credential, headerEnabled: 'y', privateNetwork: true, headers: {
      'X-Gateway': 'route', 'Content-Type': 'application/json', Authorization: 'secret', Cookie: 'secret', global_csrf_token: 'secret',
    } }))
    .mockResolvedValueOnce({ ok: true })
    .mockResolvedValueOnce(json({ success: true }))
    .mockResolvedValueOnce(json({ downloadUrl: '/ossFileHandle' }));
  await api.upload(binding, file);
  expect(host.fetch.mock.calls[1][1].headers).toEqual({ 'X-Gateway': 'route' });
});

test.each([
  [{ name: 'no-extension', size: 1 }, 'FILE_EXTENSION_INVALID'],
  [{ name: 'a.exe?x', size: 1 }, 'FILE_EXTENSION_INVALID'],
  [{ name: 'a.png', size: 0 }, 'FILE_SIZE_INVALID'],
  [{ name: 'a.png', size: 101 * 1024 * 1024 }, 'FILE_SIZE_INVALID'],
])('rejects invalid files without obtaining credentials', async (input, code) => {
  await expect(api.upload(binding, input)).rejects.toMatchObject({ code });
  expect(host.fetch).not.toHaveBeenCalled();
});

test('invalid application fails before network', async () => {
  await expect(api.upload({ appType: '../evil' }, file)).rejects.toMatchObject({ code: 'FILE_APP_REQUIRED' });
  expect(host.fetch).not.toHaveBeenCalled();
});

test('uploads without reading cookies or requiring a runtime CSRF token', async () => {
  Object.defineProperty(host.document, 'cookie', { get: () => { throw new Error('Cookies must not be inspected'); } });
  await api.upload(binding, file);
  expect(host.fetch.mock.calls[0][0]).toBe('/APP_test/openapi/file/getUploadCredential.json');
  expect(host.fetch.mock.calls[0][1].credentials).toBe('include');
  expect(host.fetch.mock.calls[1][1].credentials).toBe('omit');
  expect(host.fetch.mock.calls[1][1].headers).toEqual({});
});

test('existing browser sessions can reuse platform CSRF without treating it as a login requirement', async () => {
  Object.defineProperty(host.document, 'cookie', { get: () => { throw new Error('Cookies must not be inspected'); } });
  host.g_config = { _csrf_token: 'session csrf' };
  await api.upload(binding, file);
  expect(host.fetch.mock.calls[0][0]).toBe('/APP_test/openapi/file/getUploadCredential.json?_csrf_token=session%20csrf');
  expect(host.fetch.mock.calls[0][1]).toMatchObject({ redirect: 'error', headers: { global_csrf_token: 'session csrf' } });
  expect(host.fetch.mock.calls[1][1].headers).toEqual({});
});

test('OSS failure does not confirm or obtain URLs', async () => {
  host.fetch.mockReset().mockResolvedValueOnce(json(credential)).mockResolvedValueOnce({ ok: false, status: 403 });
  await expect(api.upload(binding, file)).rejects.toMatchObject({ code: 'FILE_OSS_FAILED', stage: 'oss' });
  expect(host.fetch).toHaveBeenCalledTimes(2);
});

test('expired credential confirmation surfaces the service code and never reports success', async () => {
  host.fetch.mockReset().mockResolvedValueOnce(json(credential)).mockResolvedValueOnce({ ok: true })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ success: false, errorCode: 350011, errorMsg: '凭证已过期' }) });
  await expect(api.upload(binding, file)).rejects.toMatchObject({ code: '350011', stage: 'confirmUpload', message: '凭证已过期' });
  expect(host.fetch).toHaveBeenCalledTimes(3);
});

test('failed URL step retains confirmed identity and can retry URL without reupload', async () => {
  host.fetch.mockReset().mockResolvedValueOnce(json(credential)).mockResolvedValueOnce({ ok: true })
    .mockResolvedValueOnce(json({ success: true, fileUploadId: 42 }))
    .mockResolvedValueOnce({ ok: false, status: 503 });
  await expect(api.upload(binding, file)).rejects.toMatchObject({ uploadedFile: { objectName: credential.objectName, fileUploadId: 42 } });
  host.fetch.mockResolvedValueOnce(json({ downloadUrl: '/ossFileHandle?fresh=1' }));
  await expect(api.getDownloadUrl(binding, credential.objectName, { instId: 'saved-id' })).resolves.toMatchObject({
    url: 'https://private.example.com/ossFileHandle?fresh=1',
  });
  expect(host.fetch.mock.calls[4][0]).toContain('getDownloadUrl.json');
});

test('binds server object names to the actual saved instance; binding failure is retryable', async () => {
  host.fetch.mockReset().mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, content: { success: false } }) })
    .mockResolvedValueOnce(json({ success: true, instId: 'saved-id', fileCount: 1 }));
  const files = [{ objectName: credential.objectName, url: 'ignored' }];
  await expect(api.bindFiles(binding, 'saved-id', files)).rejects.toMatchObject({ stage: 'bindFiles' });
  await expect(api.bindFiles(binding, 'saved-id', files)).resolves.toMatchObject({ fileCount: 1 });
  expect(JSON.parse(host.fetch.mock.calls[1][1].body)).toEqual({ appType: binding.appType, formUuid: binding.formUuid, instId: 'saved-id', fileNames: [credential.objectName] });
  await expect(api.bindFiles(binding, '', files)).rejects.toMatchObject({ code: 'FILE_BIND_IDENTITY_REQUIRED' });
});

test('private download and preview URLs cannot switch to another origin', async () => {
  host.fetch.mockReset().mockResolvedValueOnce(json({ downloadUrl: '//evil.example/file' }));
  await expect(api.getDownloadUrl(binding, 'object')).rejects.toMatchObject({ code: 'FILE_URL_INVALID' });
});

test('publishing installs the shared client in root, parent and top window', () => {
  const context = vm.createContext({ window: host });
  vm.runInContext(CANVAS_YIDA_API_BRIDGE_SOURCE + '\nopenyidaInstallYidaApiBridge.call({utils:{}});', context);
  expect(host.__OPENYIDA_FILE_API__.ready).toBe(true);
  expect(host.parent.__OPENYIDA_FILE_API__).toBe(host.__OPENYIDA_FILE_API__);
  expect(host.top.__OPENYIDA_FILE_API__).toBe(host.__OPENYIDA_FILE_API__);
  const schema = buildCanvasPageSchemaObject('', 'var YidaComp=function(){return null}', '[]', 'FORM_test');
  expect(schema.actions.module.source).toContain(clientSource);
  expect(schema.actions.module.compiled).toContain(clientSource);
});

test('CLI extracts both samples and they compile in Canvas business content', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-upload-'));
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    for (const [name, source] of [['file-upload-client', clientSource], ['canvas-file-upload', sampleSource]]) {
      const output = path.join(dir, name + '.jsx');
      await run(['openyida-page-template', name, '--output', output]);
      expect(fs.readFileSync(output, 'utf8')).toBe(source);
    }
    expect(() => compileCanvasLocal(sampleSource + '\nfunction YidaComp(){return <CanvasFileUpload binding={{appType:"APP_test"}} onChange={()=>{}}/>}')).not.toThrow();
    expect(() => compileCanvasLocal(clientSource + '\nfunction YidaComp(){return null}')).not.toThrow();
  } finally {
    log.mockRestore(); error.mockRestore(); fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createUploadControl(fileApi) {
  const Babel = require('@babel/standalone');
  const slots = [];
  let cursor = 0;
  const React = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) { slots[index] = typeof initial === 'function' ? initial() : initial; }
      return [slots[index], update => { slots[index] = typeof update === 'function' ? update(slots[index]) : update; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) { slots[index] = { current: initial }; }
      return slots[index];
    },
    useEffect() {},
    createElement(type, props, ...children) { return { type, props: props || {}, children }; },
  };
  const context = vm.createContext({ React, window: { __OPENYIDA_FILE_API__: fileApi } });
  const code = Babel.transform(sampleSource.replace("import React from 'react';", ''), { presets: ['react'] }).code;
  vm.runInContext(code, context);
  const props = { binding, value: [], onUploadingChange: jest.fn() };
  props.onChange = jest.fn(value => { props.value = value; });
  function render() { cursor = 0; return context.CanvasFileUpload(props); }
  function find(node, predicate) {
    if (!node || typeof node !== 'object') { return undefined; }
    if (Array.isArray(node)) {
      for (const child of node) { const match = find(child, predicate); if (match) { return match; } }
    } else {
      if (predicate(node)) { return node; }
      return find(node.children, predicate);
    }
  }
  return { props, render, find };
}

test('upload control preserves earlier files when a later file fails and unlocks submission', async () => {
  const uploaded = { name: file.name, objectName: 'first', downloadUrl: '/ossFileHandle' };
  const fileApi = { upload: jest.fn().mockResolvedValueOnce(uploaded).mockRejectedValueOnce(new Error('OSS failed')) };
  const { props, render, find } = createUploadControl(fileApi);
  const input = find(render(), node => node.type === 'input');
  await input.props.onChange({ target: { files: [file, file], value: 'selected' } });
  expect(props.value).toEqual([uploaded]);
  expect(props.onUploadingChange.mock.calls.map(args => args[0])).toEqual([true, false]);
  expect(find(render(), node => node.props.role === 'alert').children).toContain('OSS failed');
});

test('confirmed file URL recovery blocks submission until retry succeeds, without uploading twice', async () => {
  const uploadedFile = { name: file.name, objectName: 'confirmed' };
  const failure = Object.assign(new Error('URL unavailable'), { uploadedFile });
  const fileApi = {
    upload: jest.fn().mockRejectedValueOnce(failure),
    getDownloadUrl: jest.fn().mockResolvedValueOnce({ downloadUrl: '/ossFileHandle?fresh' }),
  };
  const { props, render, find } = createUploadControl(fileApi);
  await find(render(), node => node.type === 'input').props.onChange({ target: { files: [file], value: '' } });
  expect(props.value).toEqual([]);
  expect(props.onUploadingChange).toHaveBeenLastCalledWith(true);
  const retry = find(render(), node => node.type === 'button' && node.children.includes('重试获取地址'));
  await retry.props.onClick();
  expect(props.value).toEqual([{ ...uploadedFile, downloadUrl: '/ossFileHandle?fresh' }]);
  expect(fileApi.upload).toHaveBeenCalledTimes(1);
  expect(fileApi.getDownloadUrl).toHaveBeenCalledWith(binding, 'confirmed');
  expect(props.onUploadingChange).toHaveBeenLastCalledWith(false);
});
