'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const { resolveAssets } = require('../lib/asset/asset-resolve');
const { buildAssetTasks } = require('../lib/asset/asset-plan');
const { assetDeadline, getAssetExecutionContract } = require('../lib/asset/asset-execution');

const status = { canUpload: false, cdnConfigured: false, hostCapabilities: {} };
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const website = { pages: ['home', 'cases', 'contact'].map(pageId => ({ pageId, imageNeed: 'required',
  slots: [{ slotId: `${pageId}.hero`, usage: 'hero', minSize: '1x1' }] })) };
const candidate = input => ({ slotId: 'home.hero', usage: 'hero', alt: '页面图片', source: 'user', input });
let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-nonblocking-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

test('three-page website shares one collection budget and images do not gate its first preview', async () => {
  const tasks = buildAssetTasks(website, dir);
  expect(new Set(tasks.map(task => task.collectionKey)).size).toBe(1);
  expect(tasks).toHaveLength(3);
  tasks.forEach(task => {
    expect(task.timeBudget).toMatchObject({ collectionDeadlineMs: 60000, requestTimeoutMs: 15000 });
    expect(task.resolve).toMatchObject({ deadlineOption: '--deadline-at', deadlineSource: 'shared_collection_deadline_at' });
  });
  const policy = getAssetExecutionContract();
  expect(policy.pageDependencies).toEqual({ implementation: [], preview: [], finalAssetAcceptance: ['required_assets'] });
  expect(policy.synchronousOrder.indexOf('authorized_first_preview')).toBeLessThan(policy.synchronousOrder.indexOf('bounded_asset_batch'));
  const result = await resolveAssets([], { assetStrategy: website, online: false, status });
  expect(result.materialStatus).toBe('draft');
  result.pages.forEach(page => expect(page).toMatchObject({ materialStatus: 'draft',
    assetGate: { implementation: 'unblocked', preview: 'unblocked', finalAssetAcceptance: 'blocked' } }));
});

test('an expired collection performs no network or upload work', async () => {
  const verifyFn = jest.fn(), uploadFn = jest.fn();
  const result = await resolveAssets([{ ...candidate('https://example.test/image.png'), hotlinkAllowed: true }], {
    status, verifyFn, uploadFn, deadlineAt: new Date(Date.now() - 1000).toISOString(),
  });
  expect(verifyFn).not.toHaveBeenCalled();
  expect(uploadFn).not.toHaveBeenCalled();
  expect(result.assets[0].gaps).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'ASSET_DEADLINE_EXCEEDED' })]));
  expect(result.executionBudget.exhausted).toBe(true);
});

test('expired CLI retries preserve the existing verified manifest', () => {
  const manifest = path.join(dir, 'manifest.json'), original = '{"previous":"verified receipt"}\n';
  fs.writeFileSync(manifest, original);
  const env = { ...process.env, OPENYIDA_NO_AUTO_UPDATE: '1', OPENYIDA_SKIP_UPDATE_CHECK: '1', NO_COLOR: '1', FORCE_COLOR: '0' };
  delete env.OPENYIDA_MANAGED_RUN;
  let failure;
  try {
    execFileSync(process.execPath, [path.resolve(__dirname, '../bin/yida.js'), 'asset', 'resolve', '--slot', 'hero=https://example.test/x.png',
      '--manifest', manifest, '--deadline-at', '2020-01-01T00:00:00Z', '--json'], { cwd: dir, env, stdio: 'pipe' });
  } catch (error) { failure = error; }
  expect(failure.status).toBe(2);
  expect(failure.stderr.toString()).toContain('ASSET_DEADLINE_EXCEEDED');
  expect(fs.readFileSync(manifest, 'utf8')).toBe(original);
  expect(fs.readdirSync(dir)).toEqual(['manifest.json']);
});

test.each(['tomorrow', '2026-11-03', 123])('rejects an ambiguous collection deadline %s', value => {
  expect(() => assetDeadline(value)).toThrow('ASSET_INPUT_INVALID');
});

test('streaming downloads share an absolute deadline across redirects', async () => {
  const uploadFn = jest.fn();
  const server = http.createServer((req, res) => {
    if (req.url === '/redirect') {
      const timer = setTimeout(() => { res.writeHead(302, { Location: '/stream' }); res.end(); }, 50);
      res.on('close', () => clearTimeout(timer));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.write(image);
    const interval = setInterval(() => res.write(Buffer.from([0])), 5);
    const finish = setTimeout(() => res.end(), 1200);
    res.on('close', () => { clearInterval(interval); clearTimeout(finish); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const started = Date.now();
    const result = await resolveAssets([candidate(`http://127.0.0.1:${server.address().port}/redirect`)], {
      status, uploadFn, timeout: 1000, deadlineAt: new Date(started + 100).toISOString(),
    });
    expect(Date.now() - started).toBeLessThan(900);
    expect(result.assets[0].materialStatus).toBe('draft');
    expect(uploadFn).not.toHaveBeenCalled();
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('an upload already dispatched retains its accepted receipt after the deadline', async () => {
  const file = path.join(dir, 'image.png'); fs.writeFileSync(file, image);
  const uploadFn = jest.fn(async () => {
    await new Promise(resolve => setTimeout(resolve, 150));
    return [{ success: true, originalPath: file, cdnUrl: 'https://example.test/accepted.png' }];
  });
  const result = await resolveAssets([candidate(file)], { status, uploadFn, deadlineAt: new Date(Date.now() + 100).toISOString() });
  expect(uploadFn).toHaveBeenCalledTimes(1);
  expect(result.assets[0]).toMatchObject({ url: 'https://example.test/accepted.png', materialStatus: 'final' });
  expect(result.executionBudget.exhausted).toBe(true);
});

test('a denied image closes its streaming response without retrying or waiting for the body', async () => {
  let requests = 0;
  const server = http.createServer((_req, res) => {
    requests++;
    res.writeHead(403); res.write('denied');
    const timer = setInterval(() => res.write('.'), 5);
    res.on('close', () => clearInterval(timer));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const started = Date.now();
  try {
    const result = await resolveAssets([candidate(`http://127.0.0.1:${server.address().port}/denied`)], {
      status, deadlineAt: new Date(started + 1500).toISOString(),
    });
    expect(result.assets[0].gaps).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'HTTP_403' })]));
    expect(requests).toBe(1);
  } finally { await new Promise(resolve => server.close(resolve)); }
  expect(Date.now() - started).toBeLessThan(900);
});
