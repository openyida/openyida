'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { DesignTemplateClient } = require('../lib/design-template/client');
const { validateManifest, downloadTemplate } = require('../lib/design-template/download');
const { parseArgs } = require('../lib/design-template/design-template');
const ID = `dtv_${'a'.repeat(32)}`;
const bytes = Buffer.from('body { color: green; }');
const hash = crypto.createHash('sha256').update(bytes).digest('hex');
const manifest = () => ({ id: ID, files: [{ name: 'style.css', size: bytes.length, sha256: hash, url: 'https://assets.example/style.css?signature=private' }] });
const authRef = () => ({ baseUrl: 'https://org.aliwork.com', corpId: 'corp', userId: 'user' });
const config = () => ({ success: true, content: { corpId: 'corp', userId: 'user', agentToken: 'private-token', agentTokenExpiresAt: Math.floor(Date.now() / 1000) + 900, apiBase: '/openyida/agent-api' } });

describe('design template client', () => {
  test('reuses login exchange and sends Agent Token only to the same-domain endpoint', async () => {
    const get = jest.fn().mockResolvedValue(config());
    const fetchImpl = jest.fn().mockImplementation(async () => new Response(JSON.stringify({ id: ID })));
    const client = new DesignTemplateClient({ authRef: authRef(), yidaClient: { get }, fetchImpl });
    await client.request('match', { query: 'green' });
    await client.request('files', { id: ID });
    expect(get).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0][0])).toBe('https://org.aliwork.com/openyida/agent-api/api/v1/design-templates/match');
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer private-token');
    expect(fetchImpl.mock.calls[0][1].redirect).toBe('error');
  });
  test('refreshes once after expiry; a second 401 remains an error', async () => {
    const get = jest.fn().mockImplementation(async () => config());
    const fetchImpl = jest.fn().mockImplementation(async () => new Response('', { status: 401 }));
    const client = new DesignTemplateClient({ authRef: authRef(), yidaClient: { get }, fetchImpl });
    await expect(client.request('match', { query: 'green' })).rejects.toMatchObject({ code: 'DESIGN_TEMPLATE_SERVICE_ERROR' });
    expect(get).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  test('rejects a mismatched organization before sending any business request', async () => {
    const bad = config(); bad.content.corpId = 'other';
    const fetchImpl = jest.fn();
    const client = new DesignTemplateClient({ authRef: authRef(), yidaClient: { get: async () => bad }, fetchImpl });
    await expect(client.request('match', { query: 'green' })).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  test('does not mask service failure as no match or retry 403', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(new Response('', { status: 403 }));
    const client = new DesignTemplateClient({ authRef: authRef(), yidaClient: { get: async () => config() }, fetchImpl });
    await expect(client.request('match', { query: 'green' })).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
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

test('consumer CLI exposes only match and fixed-version get', () => {
  expect(parseArgs(['match', 'green'])).toMatchObject({ action: 'match' });
  expect(parseArgs(['get', ID, '--output-dir', 'new-dir'])).toMatchObject({ action: 'get', output: 'new-dir' });
  for (const args of [['list'], ['match', 'green', '--topK', '100'], ['get', 'invalid', '--output-dir', 'out']]) {
    expect(() => parseArgs(args)).toThrow();
  }
});
