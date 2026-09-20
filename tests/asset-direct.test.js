'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { promisify } = require('util');
const { execFile } = require('child_process');
const { resolveAssets } = require('../lib/asset/asset-resolve');
const { verifyImageUrl } = require('../lib/asset/url-verify');
const { MAX_HEADER_BYTES } = require('../lib/asset/image-metadata');

const run = promisify(execFile);
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
let server;
let url;
let requests;
let dir;
beforeEach(async () => {
  requests = [];
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-direct-'));
  server = http.createServer((req, res) => {
    requests.push({ path: req.url, range: req.headers.range, cookie: req.headers.cookie });
    if (req.url === '/denied') {res.writeHead(403); res.end(); return;}
    if (req.url === '/challenge') {res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html>Anubis challenge</html>'); return;}
    if (req.url === '/redirect') {res.writeHead(302, { Location: '/image' }); res.end(); return;}
    if (req.url === '/loop') {res.writeHead(302, { Location: '/loop' }); res.end(); return;}
    if (req.url === '/slow') {
      res.writeHead(200);
      const timer = setInterval(() => res.write('x'), 10);
      res.on('close', () => clearInterval(timer));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(req.url === '/large' ? Buffer.concat([image, Buffer.alloc(MAX_HEADER_BYTES * 2)]) : image);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(dir, { recursive: true, force: true });
});
const asset = (overrides = {}) => ({ slotId: 'hero', usage: 'hero', alt: '主图', input: `${url}/image`, source: 'user', hotlinkAllowed: true, ...overrides });

test('a public direct URL needs one bounded GET and no download, upload or app', async () => {
  const downloadFn = jest.fn();
  const uploadFn = jest.fn();
  const result = await resolveAssets([asset()], { downloadFn, uploadFn });
  expect(result.assets[0]).toMatchObject({ url: `${url}/image`, width: 1, height: 1, materialStatus: 'final', delivery: { reason: 'OK_DIRECT', source: 'external' } });
  expect(requests).toEqual([{ path: '/image', range: `bytes=0-${MAX_HEADER_BYTES - 1}`, cookie: undefined }]);
  expect(downloadFn).not.toHaveBeenCalled();
  expect(uploadFn).not.toHaveBeenCalled();
});

test.each([
  ['/challenge', 'INVALID_IMAGE_CONTENT'], ['/denied', 'HTTP_403'], ['/slow', 'TIMEOUT'], ['/loop', 'TOO_MANY_REDIRECTS'],
])('unusable direct URL %s remains a gap', async (suffix, reason) => {
  const result = await resolveAssets([asset({ input: url + suffix })], { timeout: 150 });
  expect(result.assets[0]).toMatchObject({ url: '', materialStatus: 'draft' });
  expect(result.gaps[0].code).toBe(reason);
  expect(requests).toHaveLength(suffix === '/loop' ? 5 : 1);
});

test('redirect destinations are checked before following them', async () => {
  const result = await verifyImageUrl(`${url}/redirect`, { allowUrl: target => target === `${url}/redirect` });
  expect(result).toMatchObject({ ok: false, reason: 'STOCK_PROVIDER_REDIRECT_NOT_ALLOWED' });
  expect(requests.map(request => request.path)).toEqual(['/redirect']);
});

test('direct URL checks enforce dimensions and bound reads when Range is ignored', async () => {
  const result = await resolveAssets([asset({ input: `${url}/large`, minSize: '2x2' })]);
  expect(result.gaps[0].code).toBe('WIDTH_TOO_SMALL');
  expect(requests).toHaveLength(1);
});

test.each([false, true])('upload failure falls back only with hotlink permission: %s', async hotlinkAllowed => {
  const uploadFn = jest.fn(async () => { throw new Error('SIGN_FAILED'); });
  const result = await resolveAssets([asset({ hotlinkAllowed, deliveryMode: 'upload' })], { uploadFn });
  expect(uploadFn).toHaveBeenCalledTimes(1);
  expect(requests).toHaveLength(1);
  expect(result.assets[0]).toMatchObject({
    materialStatus: hotlinkAllowed ? 'final' : 'draft', url: hotlinkAllowed ? `${url}/image` : '',
  });
  if (hotlinkAllowed) {expect(result.assets[0].delivery.reason).toBe('SIGN_FAILED');}
  else {expect(result.gaps[0].code).toBe('SIGN_FAILED');}
});

test('hosting permission is checked before downloading', async () => {
  const result = await resolveAssets([asset({ rehostAllowed: false, deliveryMode: 'upload' })]);
  expect(result.gaps[0].code).toBe('REHOST_NOT_ALLOWED');
  expect(requests).toEqual([]);
});

test('Unsplash uses its official direct URL and needs explicit permission for hosting', async () => {
  const input = 'https://images.unsplash.com/photo-example?ixid=preserved';
  const entry = asset({ input, source: 'search', hotlinkAllowed: undefined, provider: 'unsplash',
    sourcePage: 'https://unsplash.com/photos/example', creator: 'Creator', license: 'Unsplash API',
    attribution: 'Photo by Creator on Unsplash', downloadLocation: 'https://api.unsplash.com/photos/example/download', downloadTracked: true });
  const verifyFn = jest.fn(async () => ({ ok: true, width: 1, height: 1, imageType: 'png' }));
  const uploadFn = jest.fn();
  const result = await resolveAssets([entry], { verifyFn, uploadFn });
  expect(result.assets[0]).toMatchObject({ materialStatus: 'final', url: input, downloadTracked: true });
  const blocked = await resolveAssets([entry], { verifyFn, uploadFn, uploadAssets: true });
  expect(blocked.gaps[0].code).toBe('REHOST_NOT_ALLOWED');
  expect(uploadFn).not.toHaveBeenCalled();
  expect(verifyFn).toHaveBeenCalledTimes(1);
});

test.each([{ hotlinkAllowed: 'false' }, { rehostAllowed: 1 }, { deliveryMode: 'direct' }])('invalid delivery options fail before network: %j', async overrides => {
  await expect(resolveAssets([asset(overrides)])).rejects.toMatchObject({ code: 'ASSET_INPUT_INVALID' });
  expect(requests).toEqual([]);
});

test('slots are verified concurrently and results retain their input order', async () => {
  const pending = [];
  const verifyFn = jest.fn(input => new Promise(resolve => pending.push({ input, resolve })));
  const promise = resolveAssets([asset(), asset({ slotId: 'second', input: `${url}/second` })], { verifyFn });
  expect(verifyFn).toHaveBeenCalledTimes(2);
  pending.reverse().forEach(item => item.resolve({ ok: true, width: 1, height: 1, imageType: 'png' }));
  const result = await promise;
  expect(result.assets.map(item => item.slotId)).toEqual(['hero', 'second']);
  expect(result.materialStatus).toBe('final');
});

test('public CLI resolves a direct URL without auth or appType and retains delivery inputs', async () => {
  const input = path.join(dir, 'draft.json');
  const manifest = path.join(dir, 'manifest.json');
  const records = {
    assetId: 'company-team-001', creator: 'Company photographer', sourcePage: 'https://example.com/team',
    license: 'Website use granted', licenseUrl: 'https://example.com/license', licenseCheckedAt: '2026-09-18',
    authorizationEvidence: [path.join(dir, 'team-release.pdf'), 'https://example.com/receipt/001'],
  };
  fs.writeFileSync(input, JSON.stringify({ assets: [asset(records)] }));
  const result = await run(process.execPath, [path.resolve(__dirname, '../bin/yida.js'), 'asset', 'resolve', '--input', input, '--manifest', manifest, '--json'], {
    cwd: dir, env: { ...process.env, OPENYIDA_SKIP_UPDATE_CHECK: '1' },
  });
  expect(JSON.parse(result.stdout).materialStatus).toBe('final');
  expect(JSON.parse(result.stdout).assets[0]).toMatchObject(records);
  expect(JSON.parse(fs.readFileSync(manifest, 'utf8')).assets[0]).toMatchObject({ hotlinkAllowed: true, deliveryMode: 'auto', url: `${url}/image` });
  expect(JSON.parse(fs.readFileSync(manifest, 'utf8')).assets[0]).toMatchObject(records);
  expect(requests).toHaveLength(1);
});

test('source records survive failed checks and retrying the resulting manifest', async () => {
  const records = {
    assetId: 'photo-001', creator: 'Author', sourcePage: 'https://example.com/photos/001',
    license: 'Project permission', licenseUrl: 'https://example.com/license', licenseCheckedAt: '2024-02-29',
    authorizationEvidence: [path.join(dir, 'permission.pdf')],
  };
  const failed = await resolveAssets([asset(records)], { online: false });
  expect(failed.assets[0]).toMatchObject({ ...records, materialStatus: 'draft' });
  const saved = JSON.parse(JSON.stringify(failed));
  const retried = await resolveAssets(saved.assets);
  expect(retried.assets[0]).toMatchObject({ ...records, materialStatus: 'final' });
  expect(requests).toHaveLength(1);
});

test('missing source records stay empty instead of implying permission was checked', async () => {
  const result = await resolveAssets([asset()]);
  expect(result.assets[0]).toMatchObject({
    assetId: '', creator: '', sourcePage: '', license: '', licenseUrl: '', licenseCheckedAt: '', authorizationEvidence: [],
  });
  expect(requests).toHaveLength(1);
});

test.each([
  ['assetId', 123], ['licenseUrl', {}], ['licenseUrl', 'javascript:alert(1)'],
  ['licenseCheckedAt', '2026-02-30'], ['licenseCheckedAt', '2026-09-18T00:00:00Z'],
  ['authorizationEvidence', 'https://example.com/permission'], ['authorizationEvidence', [null]],
  ['authorizationEvidence', ['  ']],
])('invalid source record %s fails before accessing the image', async (field, value) => {
  await expect(resolveAssets([asset({ [field]: value })])).rejects.toMatchObject({
    code: 'ASSET_INPUT_INVALID', details: { slotId: 'hero', field },
  });
  expect(requests).toEqual([]);
});

test('public CLI --upload-assets requests hosting and preserves a verified fallback without an app', async () => {
  const input = path.join(dir, 'draft.json');
  fs.writeFileSync(input, JSON.stringify({ assets: [asset()] }));
  const result = await run(process.execPath, [path.resolve(__dirname, '../bin/yida.js'), 'asset', 'resolve', '--input', input, '--upload-assets', '--json'], {
    cwd: dir, env: { ...process.env, OPENYIDA_SKIP_UPDATE_CHECK: '1' },
  });
  expect(JSON.parse(result.stdout).assets[0]).toMatchObject({
    deliveryMode: 'upload', materialStatus: 'final', url: `${url}/image`, delivery: { source: 'external', reason: 'ASSET_APP_TYPE_REQUIRED' },
  });
  expect(requests).toHaveLength(1);
});
