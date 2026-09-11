'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { resolveAssets } = require('../lib/asset/asset-resolve');
const { readDesignAssetStrategy } = require('../lib/asset/asset-plan');
const { renderDesign } = require('../lib/design-plan/materialize');

const run = promisify(execFile);
const status = { canUpload: false, cdnConfigured: false, hostCapabilities: {} };
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const strategy = { pages: [
  { pageId: 'home', imageNeed: 'required', slots: [{ slotId: 'home.hero', usage: 'hero', minSize: '1x1' }] },
  { pageId: 'catalog', imageNeed: 'required', slots: [{ slotId: 'catalog.cover', usage: 'cover', minSize: '1x1' }] },
  { pageId: 'settings', imageNeed: 'none', slots: [] },
] };

let server;
let baseUrl;
let dir;
let responseBody;
let responseType;
beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-workflow-'));
  responseBody = image;
  responseType = 'image/png';
  server = http.createServer((req, res) => {
    if (req.url === '/missing') {res.writeHead(404); res.end(); return;}
    res.writeHead(200, { 'Content-Type': responseType });
    res.end(responseBody);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(dir, { recursive: true, force: true });
});

function asset(overrides = {}) {
  return { slotId: 'home.hero', usage: 'hero', input: `${baseUrl}/image.png`, source: 'user', alt: 'Home hero', ...overrides };
}
function upload() {
  return jest.fn(async files => [{ success: true, originalPath: files[0], cdnUrl: `${baseUrl}/cdn.png` }]);
}

test.each(['image/png', 'application/octet-stream'])('declared dimensions and %s cannot make text final', async contentType => {
  responseBody = Buffer.from('this is not an image');
  responseType = contentType;
  const result = await resolveAssets([asset({ width: 1600, height: 900 })], { status });
  expect(result.materialStatus).toBe('draft');
  expect(result.gaps[0].code).toBe('INVALID_IMAGE_CONTENT');
  expect(result.assets[0]).toMatchObject({ width: 0, height: 0, url: '', materialStatus: 'draft' });
});

test('failed remote input and dimension requirements survive retries', async () => {
  const first = await resolveAssets([asset({ minSize: '1600x900' })], { status });
  const second = await resolveAssets(first.assets, { status });
  expect(first.assets[0]).toMatchObject({ input: `${baseUrl}/image.png`, minSize: '1600x900', minWidth: 1600, minHeight: 900 });
  expect(second.gaps[0].code).toBe('WIDTH_TOO_SMALL');
});

test('duplicate slot ids fail before verification or upload', async () => {
  const verifyFn = jest.fn();
  const uploadFn = jest.fn();
  await expect(resolveAssets([asset(), asset({ slotId: ' home.hero ' })], { status, verifyFn, uploadFn }))
    .rejects.toMatchObject({ code: 'ASSET_DUPLICATE_SLOT' });
  expect(verifyFn).not.toHaveBeenCalled();
  expect(uploadFn).not.toHaveBeenCalled();
});

test.each([null, 'bad', {}, { slotId: 'home.hero', minSize: 'invalid' }])('malformed entries fail before side effects: %j', async entry => {
  const uploadFn = jest.fn();
  await expect(resolveAssets([entry], { status, uploadFn })).rejects.toThrow();
  expect(uploadFn).not.toHaveBeenCalled();
});

test('missing required design slots block only their own page', async () => {
  const result = await resolveAssets([asset()], { status, assetStrategy: strategy });
  expect(result.materialStatus).toBe('draft');
  expect(result.pages.map(page => [page.pageId, page.materialStatus])).toEqual([
    ['home', 'final'], ['catalog', 'draft'], ['settings', 'none'],
  ]);
  expect(result.assets[0].materialStatus).toBe('final');
  expect(result.assets[1]).toMatchObject({ slotId: 'catalog.cover', pageId: 'catalog', required: true, materialStatus: 'draft' });
});

test('empty assets cannot erase declared image requirements', async () => {
  const result = await resolveAssets([], { status, assetStrategy: strategy });
  expect(result.materialStatus).toBe('draft');
  expect(result.assets).toHaveLength(2);
  const noSlots = await resolveAssets([], { status, assetStrategy: { pages: [{ pageId: 'home', imageNeed: 'required', slots: [] }] } });
  expect(noSlots.pages[0].materialStatus).toBe('draft');
  expect(noSlots.gaps[0].code).toBe('MISSING_PAGE_SLOTS');
});

test('design membership and minimum size override weakened input declarations', async () => {
  const current = { pages: [{ pageId: 'home', imageNeed: 'required', slots: [{ slotId: 'home.hero', usage: 'hero', minSize: '1600x900' }] }] };
  const result = await resolveAssets([asset({ required: false, pageId: 'other', minSize: '1x1' })], { status, assetStrategy: current });
  expect(result.assets[0]).toMatchObject({ required: true, pageId: 'home', minWidth: 1600 });
  expect(result.pages[0].materialStatus).toBe('draft');
  await expect(resolveAssets([asset({ slotId: 'typo' })], { status, assetStrategy: current }))
    .rejects.toMatchObject({ code: 'ASSET_UNDECLARED_SLOT' });
});

test('optional gaps remain visible without blocking a ready page', async () => {
  const current = { pages: [{ pageId: 'home', imageNeed: 'beneficial', slots: [{ slotId: 'home.hero', usage: 'hero', required: false }] }] };
  const result = await resolveAssets([], { status, assetStrategy: current });
  expect(result.materialStatus).toBe('draft');
  expect(result.pages[0]).toMatchObject({ materialStatus: 'final' });
  expect(result.pages[0].gaps).toHaveLength(1);
  expect(result.assets[0].materialStatus).toBe('draft');
});

test('counted slots expand deterministically and missing items stay visible', async () => {
  const current = { pages: [{ pageId: 'home', imageNeed: 'required', slots: [{ slotId: 'gallery', usage: 'scene', count: 2 }] }] };
  const result = await resolveAssets([asset({ slotId: 'gallery[0]' })], { status, assetStrategy: current });
  expect(result.pages[0].slotIds).toEqual(['gallery[0]', 'gallery[1]']);
  expect(result.assets.map(item => item.materialStatus)).toEqual(['final', 'draft']);
});

test('local retries verify and reuse delivery, but changed content uploads again', async () => {
  const input = path.join(dir, 'local.png');
  fs.writeFileSync(input, image);
  const uploadFn = upload();
  const first = await resolveAssets([asset({ input, source: 'generated' })], { status, uploadFn });
  const second = await resolveAssets(first.assets, { status, uploadFn });
  expect(second.materialStatus).toBe('final');
  expect(uploadFn).toHaveBeenCalledTimes(1);
  fs.appendFileSync(input, 'changed');
  await resolveAssets(second.assets, { status, uploadFn });
  expect(uploadFn).toHaveBeenCalledTimes(2);
});

test('a stale CDN URL is reuploaded instead of being trusted', async () => {
  const input = path.join(dir, 'local.png');
  fs.writeFileSync(input, image);
  const uploadFn = upload();
  const first = await resolveAssets([asset({ input, source: 'generated' })], { status, uploadFn });
  first.assets[0].url = `${baseUrl}/missing`;
  const result = await resolveAssets(first.assets, { status, uploadFn });
  expect(result.materialStatus).toBe('final');
  expect(uploadFn).toHaveBeenCalledTimes(2);
});

test('mirrored remote images reuse CDN delivery even when --upload-assets is omitted on retry', async () => {
  const uploadFn = upload();
  const first = await resolveAssets([asset()], { status, uploadFn, mirrorExternal: true });
  const second = await resolveAssets(first.assets, { status, uploadFn });
  expect(second.materialStatus).toBe('final');
  expect(second.assets[0].url).toBe(`${baseUrl}/cdn.png`);
  expect(uploadFn).toHaveBeenCalledTimes(1);
});

test('offline retry makes no network or upload calls', async () => {
  const input = path.join(dir, 'local.png');
  fs.writeFileSync(input, image);
  const uploadFn = upload();
  const first = await resolveAssets([asset({ input })], { status, uploadFn });
  const verifyFn = jest.fn();
  uploadFn.mockClear();
  const result = await resolveAssets(first.assets, { status, uploadFn, verifyFn, online: false });
  expect(result.materialStatus).toBe('draft');
  expect(uploadFn).not.toHaveBeenCalled();
  expect(verifyFn).not.toHaveBeenCalled();
});

test('Plan hands the full strategy to design.md and the CLI preserves it through retries', async () => {
  const plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/design-plan.json'), 'utf8'));
  plan.visualStyle.forUser.assetStrategy = strategy;
  const design = path.join(dir, 'design.md');
  fs.writeFileSync(design, renderDesign(plan));
  expect(readDesignAssetStrategy(design)).toEqual(strategy);
  const draft = path.join(dir, 'draft.json');
  const manifest = path.join(dir, 'manifest.json');
  fs.writeFileSync(draft, JSON.stringify({ assets: [asset()] }));
  const cli = path.join(__dirname, '../bin/yida.js');
  const args = ['asset', 'resolve', '--input', draft, '--manifest', manifest, '--design', design, '--json'];
  let error;
  try { await run(process.execPath, [cli, ...args]); } catch (caught) { error = caught; }
  expect(error.code).toBe(2);
  expect(error.stderr).not.toContain('[Circular]');
  const partial = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  expect(partial.assetStrategy).toEqual(strategy);
  expect(partial.pages[0].materialStatus).toBe('final');
  Object.assign(partial.assets[1], { input: `${baseUrl}/image.png`, source: 'user', alt: 'Catalog cover' });
  fs.writeFileSync(manifest, JSON.stringify(partial));
  const result = await run(process.execPath, [cli, 'asset', 'resolve', '--input', manifest, '--manifest', manifest, '--json']);
  const final = JSON.parse(result.stdout);
  expect(final.materialStatus).toBe('final');
  expect(final.pages.map(page => page.materialStatus)).toEqual(['final', 'final', 'none']);
});

test('embedded SVG in HTML is not accepted as an image document', async () => {
  responseBody = Buffer.from('<html><body><svg width="1600" height="900"></svg></body></html>');
  responseType = 'image/svg+xml';
  const result = await resolveAssets([asset()], { status });
  expect(result.gaps[0].code).toBe('INVALID_IMAGE_CONTENT');
});

test('SVG dimensions come from the root viewBox, not percentages or child shapes', async () => {
  responseBody = Buffer.from('<svg width="100%" height="100%" viewBox="0 0 1200 800"><rect width="10" height="10"/></svg>');
  responseType = 'image/svg+xml';
  const result = await resolveAssets([asset({ minSize: '1200x800' })], { status });
  expect(result.materialStatus).toBe('final');
  expect(result.assets[0]).toMatchObject({ width: 1200, height: 800 });
});

test('numeric zero cannot weaken a declared minSize', async () => {
  const result = await resolveAssets([asset({ minSize: '1600x900', minWidth: 0, minHeight: 0 })], { status });
  expect(result.gaps[0].code).toBe('WIDTH_TOO_SMALL');
  expect(result.assets[0]).toMatchObject({ minWidth: 1600, minHeight: 900 });
});

test('Pexels keeps search provenance when its CDN delivery is reused', async () => {
  const uploadFn = upload();
  const input = 'https://images.pexels.com/photos/1/image.jpg';
  const downloadFn = jest.fn(async () => {
    const file = path.join(dir, 'download.png');
    fs.writeFileSync(file, image);
    return file;
  });
  const verifyFn = jest.fn(async url => ({ ok: true, finalUrl: url, width: 1, height: 1, imageType: 'png' }));
  const sourceAsset = asset({ input, source: 'search', provider: 'pexels', sourcePage: 'https://www.pexels.com/photo/1/',
    creator: 'Creator', license: 'Pexels License', attribution: 'Photo by Creator on Pexels' });
  const options = { status, uploadFn, verifyFn, downloadFn, mirrorExternal: true };
  const first = await resolveAssets([sourceAsset], options);
  const second = await resolveAssets(first.assets, { ...options, mirrorExternal: false });
  expect(second.materialStatus).toBe('final');
  expect(second.assets[0]).toMatchObject({ source: 'search', provider: 'pexels', input, url: `${baseUrl}/cdn.png` });
  expect(uploadFn).toHaveBeenCalledTimes(1);
});
