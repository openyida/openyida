'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { resolveAssets } = require('../lib/asset/asset-resolve');
const { readDesignAssetStrategy, buildAssetTasks } = require('../lib/asset/asset-plan');
const { renderDesign, materialize } = require('../lib/design-plan/materialize');

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
    res.writeHead(200, { 'Content-Type': responseType, 'Content-Length': responseBody.length });
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
  return { slotId: 'home.hero', usage: 'hero', input: `${baseUrl}/image.png`, source: 'user', deliveryMode: 'upload', hotlinkAllowed: true, alt: 'Home hero', ...overrides };
}
function upload() {
  return jest.fn(async files => [{ success: true, originalPath: files[0], cdnUrl: `${baseUrl}/cdn.png` }]);
}

test('Plan CLI returns independent searches for slots on the same page before app creation', async () => {
  const plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/design-plan.json'), 'utf8'));
  const pageId = plan.pages.customPageDetails[0].pageId;
  plan.visualStyle.forUser.assetStrategy = { pages: [
    { pageId, imageNeed: 'required', slots: ['hero', 'room', 'garden'].map(slotId => ({ slotId, usage: slotId, minSize: '1200x800' })) },
  ] };
  const input = path.join(dir, 'plan.json');
  fs.writeFileSync(input, JSON.stringify(plan));
  const output = await run(process.execPath, [path.join(__dirname, '../bin/yida.js'), 'design-plan', 'materialize', input, '--json'], {
    env: { ...process.env, OPENYIDA_SKIP_UPDATE_CHECK: '1' },
  });
  const result = JSON.parse(output.stdout);
  expect(result.assetTasks).toHaveLength(1);
  const task = result.assetTasks[0];
  expect(task).toMatchObject({ pageId, startWhen: 'plan_confirmed', owner: 'host_agent', searchConcurrency: 4,
    concurrencyScope: 'collection_run', resumePolicy: 'reuse_final_slots_and_remaining_round_budget',
    dispatchMode: 'host_capability_adaptive', afterDispatch: 'continue_resource_and_page_work',
    resumeRunning: 'attach_existing_host_task', waitPolicy: 'own_page_only_after_independent_work',
    runAlongside: ['app_creation', 'form_creation', 'page_creation', 'pages_without_images', 'image_page_layout', 'page_data_binding', 'page_interactions'],
    resultWriter: 'one_per_page',
    timeBudget: { owner: 'host_agent', requestTimeoutMs: 30000, pageDeadlineMs: 180000, resume: 'keep_original_deadline' } });
  const guidance = require('../lib/asset/ai-image').getMaterialSourcingGuidance();
  expect(task).toMatchObject(guidance.schedulingPolicy);
  expect(task.executionContract.modes).toEqual(['background_agent', 'background_shell', 'synchronous']);
  expect(task.executionContract.shell.qwenworkHint).toContain('Bash.run_in_background');
  expect(task.executionContract.synchronousOrder[0]).toBe('authorized_resource_creation_or_reuse');
  expect(task.collectionPolicy).toEqual(guidance.collectionPolicy);
  expect(task.failurePolicy).toEqual(guidance.failurePolicy);
  expect(task.searches.map(search => search.slotId)).toEqual(['hero', 'room', 'garden']);
  task.searches.forEach(search => expect(search).toMatchObject({ dependsOn: [], minWidth: 1200, minHeight: 800 }));
  expect(task.resolve).toMatchObject({ startWhen: 'page_draft_ready', appTypeRequired: false, uploadRequiresAppType: true });
  expect(task.resolve.argv).not.toContain('--app-type');
  expect(task.resolve.uploadArgs).toEqual(['--app-type', '<appType>']);
  expect(task.resolve.argv).toContain(task.draft);
  expect(task.resolve.argv).toContain(task.manifest);
  expect(task.resolve.argv).toContain(result.outputs.design);
  expect(fs.existsSync(task.manifest)).toBe(false);
  expect(fs.existsSync(task.draft)).toBe(false);
  expect(task.taskKey).toBe(path.resolve(task.manifest));
  expect(task.taskState).toBe(task.manifest.replace(/\.json$/, '.task.json'));
  expect(fs.existsSync(task.taskState)).toBe(false);
  const running = { hostTaskId: 'host-task-123', status: 'running', deadlineAt: '2026-09-16T00:03:00Z', rounds: { hero: 1 } };
  fs.mkdirSync(path.dirname(task.taskState), { recursive: true });
  fs.writeFileSync(task.taskState, JSON.stringify(running));
  const again = materialize(input);
  expect(again.assetTasks[0].taskKey).toBe(task.taskKey);
  expect(JSON.parse(fs.readFileSync(task.taskState, 'utf8'))).toEqual(running);
});

test('background tasks isolate page outputs and prioritize required images without changing the design', () => {
  const design = { pages: [
    { pageId: 'front/home', imageNeed: 'required', slots: [
      { slotId: 'decoration', usage: 'cover', required: false },
      { slotId: 'room', usage: 'room' },
      { slotId: 'optional-hero', usage: 'hero', required: false },
      { slotId: 'hero', usage: 'hero' },
      { slotId: 'garden', usage: 'garden' },
    ] },
    { pageId: 'back/home', imageNeed: 'required', slots: [{ slotId: 'back-cover', usage: 'cover' }] },
    { pageId: 'settings', imageNeed: 'none' },
  ] };
  const original = JSON.stringify(design);
  const tasks = buildAssetTasks(design, dir);
  expect(tasks).toHaveLength(2);
  expect(tasks[0].searches.map(search => search.slotId)).toEqual(['hero', 'room', 'garden', 'optional-hero', 'decoration']);
  expect(JSON.stringify(design)).toBe(original);
  expect(new Set(tasks.map(task => task.taskState)).size).toBe(2);
  expect(tasks[0].taskKey).not.toBe(buildAssetTasks(design, path.join(dir, 'another-project'))[0].taskKey);
  expect(path.dirname(tasks[0].taskState)).toBe(path.join(dir, 'asset-manifests'));
  tasks.forEach(task => expect(task.resolve.argv).toContain(task.pageId));
});

test.each([
  [{ slotId: 'hero', usage: 'hero', minSize: 1200 }, 'ASSET_INVALID_SIZE'],
  [{ slotId: 'hero', usage: 'hero', minSize: '0x800' }, 'ASSET_INVALID_SIZE'],
  [{ slotId: '', usage: 'hero' }, 'ASSET_DESIGN_INVALID'],
  [{ slotId: 'hero', usage: '' }, 'ASSET_DESIGN_INVALID'],
])('Plan rejects invalid image requirements before overwriting artifacts: %j', (slot, code) => {
  const plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/design-plan.json'), 'utf8'));
  plan.visualStyle.forUser.assetStrategy = { pages: [{ pageId: 'home', imageNeed: 'required', slots: [slot] }] };
  const input = path.join(dir, 'plan.json');
  fs.writeFileSync(input, JSON.stringify(plan));
  const outputs = ['prd.md', 'design.md', 'build-plan.html', 'app-theme.css'];
  outputs.forEach(file => fs.writeFileSync(path.join(dir, file), 'original'));
  expect(() => materialize(input)).toThrow(expect.objectContaining({ code }));
  outputs.forEach(file => expect(fs.readFileSync(path.join(dir, file), 'utf8')).toBe('original'));
});

test('none pages may omit slots in the same contract used by resolve', async () => {
  const result = await resolveAssets([], { status, online: false, assetStrategy: { pages: [{ pageId: 'settings', imageNeed: 'none' }] } });
  expect(result.materialStatus).toBe('none');
  expect(result.assetStrategy.pages[0].slots).toEqual([]);
});

test('missing local images report the actual path and cwd', async () => {
  const input = './missing-assets/home.png';
  const result = await resolveAssets([asset({ input })], { status, online: false });
  expect(result.gaps[0]).toMatchObject({ code: 'NOT_FOUND',
    details: { input, resolvedPath: path.resolve(input), baseDir: process.cwd(), pathBase: 'cwd' } });
  expect(result.gaps[0].message).toContain(path.resolve(input));
});

test.each(['image/png', 'application/octet-stream'])('declared dimensions and %s cannot make text final', async contentType => {
  responseBody = Buffer.from('this is not an image');
  responseType = contentType;
  const result = await resolveAssets([asset({ width: 1600, height: 900 })], { status, uploadFn: upload() });
  expect(result.materialStatus).toBe('draft');
  expect(result.gaps[0].code).toBe('NOT_IMAGE_FILE');
  expect(result.assets[0]).toMatchObject({ width: 0, height: 0, url: '', materialStatus: 'draft' });
});

test('failed remote input and dimension requirements survive retries', async () => {
  const first = await resolveAssets([asset({ minSize: '1600x900' })], { status, uploadFn: upload() });
  const second = await resolveAssets(first.assets, { status, uploadFn: upload() });
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
  const result = await resolveAssets([asset()], { status, uploadFn: upload(), assetStrategy: strategy });
  expect(result.materialStatus).toBe('draft');
  expect(result.pages.map(page => [page.pageId, page.materialStatus])).toEqual([
    ['home', 'final'], ['catalog', 'draft'], ['settings', 'none'],
  ]);
  expect(result.assets[0].materialStatus).toBe('final');
  expect(result.assets[1]).toMatchObject({ slotId: 'catalog.cover', pageId: 'catalog', required: true, materialStatus: 'draft' });
});

test('empty assets cannot erase declared image requirements', async () => {
  const result = await resolveAssets([], { status, uploadFn: upload(), assetStrategy: strategy });
  expect(result.materialStatus).toBe('draft');
  expect(result.assets).toHaveLength(2);
  const noSlots = await resolveAssets([], { status, uploadFn: upload(), assetStrategy: { pages: [{ pageId: 'home', imageNeed: 'required', slots: [] }] } });
  expect(noSlots.pages[0].materialStatus).toBe('draft');
  expect(noSlots.gaps[0].code).toBe('MISSING_PAGE_SLOTS');
});

test('design membership and minimum size override weakened input declarations', async () => {
  const current = { pages: [{ pageId: 'home', imageNeed: 'required', slots: [{ slotId: 'home.hero', usage: 'hero', minSize: '1600x900' }] }] };
  const result = await resolveAssets([asset({ required: false, pageId: 'other', minSize: '1x1' })], { status, uploadFn: upload(), assetStrategy: current });
  expect(result.assets[0]).toMatchObject({ required: true, pageId: 'home', minWidth: 1600 });
  expect(result.pages[0].materialStatus).toBe('draft');
  await expect(resolveAssets([asset({ slotId: 'typo' })], { status, uploadFn: upload(), assetStrategy: current }))
    .rejects.toMatchObject({ code: 'ASSET_UNDECLARED_SLOT' });
});

test('optional gaps remain visible without blocking a ready page', async () => {
  const current = { pages: [{ pageId: 'home', imageNeed: 'beneficial', slots: [{ slotId: 'home.hero', usage: 'hero', required: false }] }] };
  const result = await resolveAssets([], { status, uploadFn: upload(), assetStrategy: current });
  expect(result.materialStatus).toBe('draft');
  expect(result.pages[0]).toMatchObject({ materialStatus: 'final' });
  expect(result.pages[0].gaps).toHaveLength(1);
  expect(result.assets[0].materialStatus).toBe('draft');
});

test('counted slots expand deterministically and missing items stay visible', async () => {
  const current = { pages: [{ pageId: 'home', imageNeed: 'required', slots: [{ slotId: 'gallery', usage: 'scene', count: 2 }] }] };
  const result = await resolveAssets([asset({ slotId: 'gallery[0]' })], { status, uploadFn: upload(), assetStrategy: current });
  expect(result.pages[0].slotIds).toEqual(['gallery[0]', 'gallery[1]']);
  expect(result.assets.map(item => item.materialStatus)).toEqual(['final', 'draft']);
});

test('local retries reuse delivery, but changed content uploads again', async () => {
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

test('a malformed attachment URL triggers reupload', async () => {
  const input = path.join(dir, 'local.png');
  fs.writeFileSync(input, image);
  const uploadFn = upload();
  const first = await resolveAssets([asset({ input, source: 'generated' })], { status, uploadFn });
  first.assets[0].url = 'invalid-url';
  const result = await resolveAssets(first.assets, { status, uploadFn });
  expect(result.materialStatus).toBe('final');
  expect(uploadFn).toHaveBeenCalledTimes(2);
});

test('remote images reuse attachment delivery without requiring --upload-assets', async () => {
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
  // Large images retain the original URL, so this CLI test needs no live login.
  responseBody = Buffer.concat([image, Buffer.alloc(20 * 1024 * 1024 + 1 - image.length)]);
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
  Object.assign(partial.assets[1], { input: `${baseUrl}/image.png`, source: 'user', hotlinkAllowed: true, alt: 'Catalog cover' });
  fs.writeFileSync(manifest, JSON.stringify(partial));
  const result = await run(process.execPath, [cli, 'asset', 'resolve', '--input', manifest, '--manifest', manifest, '--json']);
  const final = JSON.parse(result.stdout);
  expect(final.materialStatus).toBe('final');
  expect(final.pages.map(page => page.materialStatus)).toEqual(['final', 'final', 'none']);
});

test('embedded SVG in HTML is not accepted as an image document', async () => {
  responseBody = Buffer.from('<html><body><svg width="1600" height="900"></svg></body></html>');
  responseType = 'image/svg+xml';
  const result = await resolveAssets([asset()], { status, uploadFn: upload() });
  expect(result.gaps[0].code).toBe('NOT_IMAGE_FILE');
});

test('SVG dimensions come from the root viewBox, not percentages or child shapes', async () => {
  responseBody = Buffer.from('<svg width="100%" height="100%" viewBox="0 0 1200 800"><rect width="10" height="10"/></svg>');
  responseType = 'image/svg+xml';
  const result = await resolveAssets([asset({ minSize: '1200x800' })], { status, uploadFn: upload() });
  expect(result.materialStatus).toBe('final');
  expect(result.assets[0]).toMatchObject({ width: 1200, height: 800 });
});

test('numeric zero cannot weaken a declared minSize', async () => {
  const result = await resolveAssets([asset({ minSize: '1600x900', minWidth: 0, minHeight: 0 })], { status, uploadFn: upload() });
  expect(result.gaps[0].code).toBe('WIDTH_TOO_SMALL');
  expect(result.assets[0]).toMatchObject({ minWidth: 1600, minHeight: 900 });
});

test('Pexels keeps search provenance when its attachment delivery is reused', async () => {
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


test('asset handoff continues with existing Plan approval across workflow entry points', () => {
  const skills = path.join(__dirname, '../yida-skills/skills');
  const assets = fs.readFileSync(path.join(skills, 'yida-image-assets/SKILL.md'), 'utf8');
  expect(assets).toContain('素材采集完成后直接继续搭建，沿用已有方案确认');
  expect(assets).toContain('CLI 保留 revision 与已有确认');
  for (const file of ['yida-app/workflow/step-7-page-code.md', 'yida-app/workflow/plan/step-4-deliver.md']) {
    const workflow = fs.readFileSync(path.join(skills, file), 'utf8');
    expect(workflow).toContain('yida-image-assets/SKILL.md#6-交给页面使用');
    expect(workflow).not.toContain('每次调整后重新展示并确认当前版本');
    expect(workflow).not.toContain('修正均由对应技能');
  }
});


test('page selection resolves only its slots and keeps page ownership from the design', async () => {
  const uploadFn = upload();
  const result = await resolveAssets([asset({ pageId: 'catalog' })], { status, uploadFn, assetStrategy: strategy, pageId: 'home' });
  expect(uploadFn).toHaveBeenCalledTimes(1);
  expect(result.materialStatus).toBe('final');
  expect(result.pages.map(page => page.pageId)).toEqual(['home']);
  expect(result.assets.map(item => item.slotId)).toEqual(['home.hero']);
  expect(result.assetStrategy.pages).toEqual([strategy.pages[0]]);
  expect(result.gaps).toEqual([]);
});

test.each([
  [{ pageId: 'home' }, 'ASSET_PAGE_REQUIRES_DESIGN'],
  [{ pageId: 'missing', assetStrategy: strategy }, 'ASSET_PAGE_NOT_FOUND'],
  [{ pageId: '', assetStrategy: strategy }, 'ASSET_PAGE_NOT_FOUND'],
])('invalid page selection fails before uploading (%j)', async (options, code) => {
  const uploadFn = upload();
  await expect(resolveAssets([asset()], { status, uploadFn, ...options })).rejects.toMatchObject({ code });
  expect(uploadFn).not.toHaveBeenCalled();
});

test('images within a page upload concurrently', async () => {
  const file = path.join(dir, 'image.png');
  fs.writeFileSync(file, image);
  const selected = { pages: [{ pageId: 'home', imageNeed: 'required', slots: [
    { slotId: 'hero', usage: 'hero' }, { slotId: 'cover', usage: 'cover' },
  ] }] };
  let finish;
  const barrier = new Promise(resolve => { finish = resolve; });
  const uploadFn = jest.fn(async () => {
    if (uploadFn.mock.calls.length === 2) { finish(); }
    await barrier;
    return [{ success: true, cdnUrl: `${baseUrl}/cdn.png` }];
  });
  const result = await resolveAssets(['hero', 'cover'].map(slotId => asset({ slotId, input: file, source: 'user' })), {
    assetStrategy: selected, pageId: 'home', status, uploadFn,
  });
  expect(uploadFn).toHaveBeenCalledTimes(2);
  expect(result.pages[0].materialStatus).toBe('final');
  expect(result.assets).toHaveLength(2);
});

test('CLI writes independent page results while keeping another page untouched', async () => {
  const design = path.join(dir, 'design.md');
  fs.writeFileSync(design, `---\nassetStrategy: ${JSON.stringify(strategy)}\n---\n`);
  const draft = path.join(dir, 'draft.json');
  fs.writeFileSync(draft, JSON.stringify({ assets: [asset()] }));
  const readyFile = path.join(dir, 'settings.json');
  const blockedFile = path.join(dir, 'catalog.json');
  const cli = path.join(__dirname, '../bin/yida.js');
  const args = ['asset', 'resolve', '--input', draft, '--design', design, '--offline', '--json'];
  const results = await Promise.allSettled([
    run(process.execPath, [cli, ...args, '--page-id', 'settings', '--manifest', readyFile]),
    run(process.execPath, [cli, ...args, '--page-id', 'catalog', '--manifest', blockedFile]),
  ]);
  expect(results[0].status).toBe('fulfilled');
  expect(results[1].reason.code).toBe(2);
  expect(JSON.parse(fs.readFileSync(readyFile)).pages).toEqual([expect.objectContaining({ pageId: 'settings', materialStatus: 'none' })]);
  const blocked = JSON.parse(fs.readFileSync(blockedFile));
  expect(blocked.pages).toEqual([expect.objectContaining({ pageId: 'catalog', materialStatus: 'draft' })]);
  expect(blocked.assets.map(item => item.slotId)).toEqual(['catalog.cover']);
  for (const subcommand of ['status', 'sources', 'resolve']) {
    await expect(run(process.execPath, [cli, 'asset', subcommand, '--page-id', '--json']))
      .rejects.toMatchObject({ code: 1 });
  }
});
