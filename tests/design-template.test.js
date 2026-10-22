'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { DesignTemplateClient } = require('../lib/design-template/client');
const { validateManifest, downloadTemplate } = require('../lib/design-template/download');
const { parseArgs } = require('../lib/design-template/design-template');
const ID = `dt_${'a'.repeat(32)}`;
const bytes = Buffer.from('body { color: green; }');
const hash = crypto.createHash('sha256').update(bytes).digest('hex');
const manifest = () => ({ id: ID, files: [{ name: 'style.css', size: bytes.length, sha256: hash, url: 'https://assets.example/style.css?signature=private' }] });
const authRef = () => ({ baseUrl: 'https://org.aliwork.com', corpId: 'corp', userId: 'user' });
describe('design template client', () => {
  test('uses the existing authenticated Tianshu client for both public operations', async () => {
    const postJson = jest.fn().mockResolvedValue({ success: true, content: { id: ID } });
    const get = jest.fn();
    const client = new DesignTemplateClient({ authRef: authRef(), yidaClient: { postJson, get } });
    expect(await client.request('match', { query: 'green' })).toEqual({ id: ID });
    await client.request('files', { id: ID });
    expect(postJson.mock.calls).toEqual([
      ['/query/designTemplates/match.json', { query: 'green' }],
      ['/query/designTemplates/files.json', { id: ID }],
    ]);
    expect(get).not.toHaveBeenCalled();
  });
  test.each([{ success: false, errorMsg: 'forbidden' }, { __needLogin: true }, { __csrfExpired: true }])(
    'rejects business/login failures instead of returning no match: %p', async raw => {
      const postJson = jest.fn().mockResolvedValue(raw);
      const client = new DesignTemplateClient({ authRef: authRef(), yidaClient: { postJson } });
      await expect(client.request('match', { query: 'green' })).rejects.toThrow();
      expect(postJson).toHaveBeenCalledTimes(1);
    });
  test('propagates transport failures and preserves explicit no-match', async () => {
    const postJson = jest.fn().mockRejectedValueOnce(new Error('HTTP 503'))
      .mockResolvedValueOnce({ id: null });
    const client = new DesignTemplateClient({ authRef: authRef(), yidaClient: { postJson } });
    await expect(client.request('match', { query: 'green' })).rejects.toThrow('HTTP 503');
    expect(await client.request('match', { query: 'green' })).toEqual({ id: null });
    await expect(client.request('admin/versions', {})).rejects.toThrow();
    expect(postJson).toHaveBeenCalledTimes(2);
  });
});

describe('template download', () => {
  let root;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'design-template-test-')); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });
  test('verifies hash, writes a new directory and never passes credentials to assets', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(new Response(bytes));
    const out = path.join(root, 'files');
    const result = await downloadTemplate(manifest(), ID, out, fetchImpl);
    expect(fs.readFileSync(path.join(out, 'style.css'))).toEqual(bytes);
    expect(fetchImpl.mock.calls[0][1].headers).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('signature');
    expect(result.id).toBe(ID);
  });
  test('hash failure leaves no partial download', async () => {
    const out = path.join(root, 'files');
    const m = manifest(); m.files.push({ ...m.files[0], name: 'second.css' });
    const fetchImpl = jest.fn().mockResolvedValueOnce(new Response(bytes)).mockResolvedValueOnce(new Response('broken'));
    await expect(downloadTemplate(m, ID, out, fetchImpl)).rejects.toThrow();
    expect(fs.existsSync(out)).toBe(false);
  });
  test('never overwrites user files or an existing directory', async () => {
    const fetchImpl = jest.fn();
    await expect(downloadTemplate(manifest(), ID, root, fetchImpl)).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  test.each(['../escape.css', 'NUL.css', 'a/b.css', 'file.', 'a..css'])('rejects unsafe filename %s', (name) => {
    const m = manifest(); m.files[0].name = name;
    expect(() => validateManifest(m, ID)).toThrow();
  });
  test('rejects duplicate file names, insecure URLs and oversized manifests', () => {
    const m = manifest(); m.files.push({ ...m.files[0], name: 'STYLE.css' });
    expect(() => validateManifest(m, ID)).toThrow();
    m.files.pop(); m.files[0].url = 'http://assets.example/file.css';
    expect(() => validateManifest(m, ID)).toThrow();
    m.files[0].url = 'https://assets.example/file.css'; m.files[0].size = 11 * 1024 * 1024;
    expect(() => validateManifest(m, ID)).toThrow();
  });
});

test('consumer CLI exposes only match and stable-template get', () => {
  expect(parseArgs(['match', 'green'])).toMatchObject({ action: 'match' });
  expect(parseArgs(['get', ID, '--output-dir', 'new-dir'])).toMatchObject({ action: 'get', output: 'new-dir' });
  for (const args of [['list'], ['match', 'green', '--topK', '100'], ['get', 'invalid', '--output-dir', 'out'], ['get', `dtv_${'a'.repeat(32)}`, '--output-dir', 'out']]) {
    expect(() => parseArgs(args)).toThrow();
  }
});
