'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
jest.mock('../lib/ai/ai', () => ({
  inferAppType: jest.fn(options => options.appType || ''),
  getAuthRef: jest.fn(() => ({ token: 'test-only' })),
  uploadImageForAI: jest.fn(),
}));
const ai = require('../lib/ai/ai');
const { uploadAttachment, MAX_IMAGE_BYTES } = require('../lib/asset/attachment-upload');
const { resolveAssets, downloadUrlToTemp } = require('../lib/asset/asset-resolve');
const { parseArgs } = require('../lib/asset/asset-cmd');

const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
let dir;
let file;
let server;
let baseUrl;
let body;
let declaredSize;
let requests;
beforeEach(async () => {
  jest.clearAllMocks();
  ai.uploadImageForAI.mockResolvedValue({ imageUrl: 'https://attachment.example.com/public.png' });
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-attachment-test-'));
  file = path.join(dir, 'image.png');
  fs.writeFileSync(file, image);
  body = image;
  declaredSize = undefined;
  requests = [];
  server = http.createServer((req, res) => {
    requests.push(req.url);
    if (req.url === '/missing') {res.writeHead(404); res.end(); return;}
    const headers = { 'Content-Type': 'image/png' };
    if (declaredSize !== undefined) {headers['Content-Length'] = declaredSize;}
    res.writeHead(200, headers);
    res.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(dir, { recursive: true, force: true });
});
function asset(input = `${baseUrl}/no-extension`) {
  return { slotId: 'hero', usage: 'hero', alt: '示意', source: 'user', input };
}
function uploader() {
  return jest.fn(async files => [{ success: true, originalPath: files[0], cdnUrl: `${baseUrl}/public` }]);
}

test('adapter uses the public ImageField URL, with the selected app and auth', async () => {
  ai.uploadImageForAI.mockResolvedValue({ imageUrl: `${baseUrl}/public`, downloadUrl: 'https://private.example.com/signed' });
  const result = await uploadAttachment([file], { appType: 'APP_REAL_TARGET' });
  expect(ai.uploadImageForAI).toHaveBeenCalledWith(file, { appType: 'APP_REAL_TARGET' }, { token: 'test-only' });
  expect(result[0].cdnUrl).toBe(`${baseUrl}/public`);
});

test('missing app or oversized local file never begins auth or upload', async () => {
  await expect(uploadAttachment([file])).rejects.toMatchObject({ code: 'ASSET_APP_TYPE_REQUIRED' });
  fs.truncateSync(file, MAX_IMAGE_BYTES + 1);
  await expect(uploadAttachment([file], { appType: 'APP_TARGET' })).rejects.toMatchObject({ code: 'ASSET_TOO_LARGE' });
  expect(ai.getAuthRef).not.toHaveBeenCalled();
  expect(ai.uploadImageForAI).not.toHaveBeenCalled();
});

test('a private download URL cannot substitute for a missing public URL', async () => {
  ai.uploadImageForAI.mockResolvedValue({ downloadUrl: `${baseUrl}/signed` });
  await expect(uploadAttachment([file], { appType: 'APP_TARGET' })).rejects.toMatchObject({ code: 'ASSET_ATTACHMENT_URL_INVALID' });
});

test('default resolver downloads, fixes the extension and uploads without CDN configuration', async () => {
  ai.uploadImageForAI.mockResolvedValue({ imageUrl: `${baseUrl}/public` });
  const result = await resolveAssets([asset()], { appType: 'APP_TARGET' });
  expect(result.materialStatus).toBe('final');
  expect(requests).toEqual(['/no-extension']);
  const downloaded = ai.uploadImageForAI.mock.calls[0][0];
  expect(downloaded.endsWith('.png')).toBe(true);
  expect(fs.existsSync(path.dirname(downloaded))).toBe(false);
  expect(result.assets[0]).toMatchObject({ source: 'user', input: `${baseUrl}/no-extension`, url: `${baseUrl}/public`, delivery: { source: 'yida-attachment' } });
});

test('20 MiB exactly uploads, while a declared larger image keeps its original URL', async () => {
  body = Buffer.concat([image, Buffer.alloc(MAX_IMAGE_BYTES - image.length)]);
  declaredSize = body.length;
  const uploadFn = uploader();
  const exact = await resolveAssets([asset()], { uploadFn });
  expect(exact.materialStatus).toBe('final');
  expect(exact.assets[0].delivery.source).toBe('yida-attachment');
  expect(uploadFn).toHaveBeenCalledTimes(1);
  body = Buffer.concat([body, Buffer.from([0])]);
  declaredSize = body.length;
  uploadFn.mockClear();
  requests.length = 0;
  const large = await resolveAssets([asset()], { uploadFn });
  expect(large.materialStatus).toBe('final');
  expect(large.assets[0]).toMatchObject({ url: asset().input, delivery: { source: 'external', reason: 'ASSET_TOO_LARGE' } });
  expect(requests).toEqual(['/no-extension']);
  expect(uploadFn).not.toHaveBeenCalled();
});

test('unknown stream length is bounded and oversized downloads are cleaned up', async () => {
  body = Buffer.concat([image, Buffer.alloc(MAX_IMAGE_BYTES + 1 - image.length)]);
  const created = [];
  const mkdtemp = fs.mkdtempSync;
  const spy = jest.spyOn(fs, 'mkdtempSync').mockImplementation(prefix => {
    const result = mkdtemp(prefix); created.push(result); return result;
  });
  try {
    await expect(downloadUrlToTemp(`${baseUrl}/chunked`)).rejects.toThrow('ASSET_TOO_LARGE');
    const uploadFn = uploader();
    const result = await resolveAssets([asset()], { uploadFn });
    expect(result.assets[0]).toMatchObject({ url: asset().input, delivery: { reason: 'ASSET_TOO_LARGE' } });
    expect(uploadFn).not.toHaveBeenCalled();
    expect(created.every(temp => !fs.existsSync(temp))).toBe(true);
  } finally { spy.mockRestore(); }
});

test('oversized local image has no invented original URL', async () => {
  fs.truncateSync(file, MAX_IMAGE_BYTES + 1);
  const result = await resolveAssets([asset(file)]);
  expect(result.assets[0]).toMatchObject({ url: '', materialStatus: 'draft' });
  expect(result.gaps[0].code).toBe('ASSET_TOO_LARGE_NO_ORIGINAL_URL');
  expect(ai.uploadImageForAI).not.toHaveBeenCalled();
});

test.each(['UPLOAD_FAILED', 'INVALID_UPLOAD_RESULT'])('%s stays draft instead of silently using the external URL', async code => {
  const uploadFn = code === 'UPLOAD_FAILED'
    ? jest.fn(async () => { throw new Error(code); })
    : jest.fn(async files => [{ success: true, originalPath: files[0], cdnUrl: 'invalid-url' }]);
  const result = await resolveAssets([asset()], { uploadFn });
  expect(result.assets[0]).toMatchObject({ url: '', materialStatus: 'draft', input: asset().input });
  expect(result.gaps[0].code).toBe('UPLOAD_FAILED');
});

test('CLI accepts the target app and reports missing option values', () => {
  expect(parseArgs(['resolve', '--app-type', 'APP_TARGET']).appType).toBe('APP_TARGET');
  expect(parseArgs(['resolve', '--app-type']).errors).toContain('ASSET_APP_TYPE_REQUIRED');
});


test('failed download is attempted once, skips upload and leaves a visible gap', async () => {
  const uploadFn = uploader();
  const input = `${baseUrl}/missing`;
  const result = await resolveAssets([asset(input)], { uploadFn });
  expect(requests).toEqual(['/missing']);
  expect(uploadFn).not.toHaveBeenCalled();
  expect(result.assets[0]).toMatchObject({ input, url: '', materialStatus: 'draft' });
  expect(result.gaps[0].code).toBe('HTTP_404');
});

test('reused attachment URLs need no extra network verification', async () => {
  const uploadFn = uploader();
  const first = await resolveAssets([asset()], { uploadFn });
  requests.length = 0;
  const second = await resolveAssets(first.assets, { uploadFn });
  expect(second.assets[0].delivery.reason).toBe('OK_REUSED');
  expect(requests).toEqual(['/no-extension']);
  expect(uploadFn).toHaveBeenCalledTimes(1);
});


test.each([true, false])('oversized download waits for file close before cleanup (declared size: %s)', async declared => {
  body = Buffer.concat([image, Buffer.alloc(MAX_IMAGE_BYTES + 1 - image.length)]);
  declaredSize = declared ? body.length : undefined;
  const files = [];
  const createWriteStream = fs.createWriteStream;
  const rmSync = fs.rmSync;
  const createSpy = jest.spyOn(fs, 'createWriteStream').mockImplementation((target, options) => {
    const stream = createWriteStream(target, options);
    const closed = new Promise(resolve => stream.once('close', resolve));
    files.push({ target, stream, closed });
    return stream;
  });
  const rmSpy = jest.spyOn(fs, 'rmSync').mockImplementation((target, options) => {
    // Windows refuses to remove files whose handles are still open.
    if (files.some(file => path.dirname(file.target) === target && !file.stream.closed)) {
      throw Object.assign(new Error('Cannot remove an open file'), { code: 'EPERM' });
    }
    return rmSync(target, options);
  });
  try {
    const uploadFn = uploader();
    const result = await resolveAssets([asset()], { uploadFn });
    expect(result.gaps).toEqual([]);
    expect(result.assets[0]).toMatchObject({ materialStatus: 'final', url: asset().input, delivery: { reason: 'ASSET_TOO_LARGE' } });
    expect(uploadFn).not.toHaveBeenCalled();
    expect(files.length).toBeGreaterThan(0);
    expect(files.every(file => file.stream.closed && !fs.existsSync(path.dirname(file.target)))).toBe(true);
  } finally {
    createSpy.mockRestore();
    rmSpy.mockRestore();
    await Promise.all(files.map(file => file.closed));
    files.forEach(file => rmSync(path.dirname(file.target), { recursive: true, force: true }));
  }
});
