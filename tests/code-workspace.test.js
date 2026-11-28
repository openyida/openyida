'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
jest.mock('../lib/code-workspace/api', () => ({ createWorkspaceApi: jest.fn() }));
const { execute, parseArgs, run } = require('../lib/code-workspace');
const { sha256, collectFiles, describe, writeState } = require('../lib/code-workspace/files');
const { createWorkspaceApi } = require('../lib/code-workspace/api');
const { zipSync } = require('fflate');
const archiveRecipe = { toolchainRef: 'frozen-v1', lockfilePath: 'lock.json', lockfileHash: sha256(Buffer.from('{}')), runtimeAbi: 'canvas-v2' };
function archive(snapshot, files, recipe = archiveRecipe) {
  return zipSync({ 'workspace.json': Buffer.from(JSON.stringify({ ...snapshot, formatVersion: 1,
    buildRecipe: recipe, entries: recipe.entries })), ...Object.fromEntries(Object.entries(files).map(([name, bytes]) => ['files/' + name, bytes])) });
}

test('archive validation rejects foreign identities, changed recipes and unexpected paths', () => {
  const { readSourceArchive } = require('../lib/code-workspace/archive');
  const snapshot = { ...identity, buildRecipeSha256: sha256(Buffer.from(JSON.stringify(archiveRecipe))), files: {} };
  expect(() => readSourceArchive(archive({ ...snapshot, workspaceId: 'other' }, {}), snapshot)).toThrow('identity');
  expect(() => readSourceArchive(archive(snapshot, {}, { ...archiveRecipe, toolchainRef: 'other' }), snapshot)).toThrow('recipe');
  expect(() => readSourceArchive(archive(snapshot, { '../escape': Buffer.from('x') }), snapshot)).toThrow('path');
  expect(() => readSourceArchive(archive(snapshot, { 'unlisted.ts': Buffer.from('x') }), snapshot)).toThrow('outside');
});

let root;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-test-')); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); jest.restoreAllMocks(); });
function project() {
  const recipe = { toolchainRef: 'frozen-v1', lockfilePath: 'lock.json', lockfileHash: sha256(Buffer.from('{}')),
    runtimeAbi: 'canvas-v2', entries: { app: 'App.tsx' } };
  fs.writeFileSync(path.join(root, 'project.json'), JSON.stringify(recipe));
  fs.writeFileSync(path.join(root, 'lock.json'), '{}');
  fs.writeFileSync(path.join(root, 'App.tsx'), 'export default function App(){return null;}');
  return recipe;
}
const identity = { workspaceId: 'W1', sourceSnapshotId: '1234567890abcdef', revision: 2,
  sourceManifestSha256: 'a'.repeat(64), buildRecipeSha256: 'b'.repeat(64) };
test('start-test reuses the active test version and adds only the authenticated current user', async () => {
  const api = { currentUserId: 'current-user', version: jest.fn(async action => {
    if (action === 'hasActiveTestVersion') { return true; }
    if (action === 'getTestEnvironmentStatus') { return { inTestEnvironment: true }; }
    return ['current-user'];
  }) };
  expect(await execute({ action: 'start-test', appType: 'APP_A' }, api)).toMatchObject({ inTestEnvironment: true, published: false });
  expect(api.version.mock.calls.map(call => call[0])).toEqual(['hasActiveTestVersion', 'addTestParticipants', 'getTestEnvironmentStatus']);
  expect(api.version).toHaveBeenCalledWith('addTestParticipants', { userIds: 'current-user' });
  await expect(execute({ action: 'start-test', appType: 'APP_A' }, { version: jest.fn() })).rejects.toThrow('identity');
});
test('bind selects a declared entry, keeps schema revision and verifies remote binding', async () => {
  project();
  writeState(root, { ...identity, appType: 'APP_A', files: describe(collectFiles(root)) });
  let schema = { gmtModified: 123, pages: [{ componentsTree: [
    { componentName: 'YidaCodeCanvas', id: 'canvas', props: { code: 'old' } },
  ] }] };
  const api = { get: jest.fn().mockResolvedValue(identity), enterTest: jest.fn(),
    readPage: jest.fn(async () => ({ schema, revision: 123 })),
    savePage: jest.fn(async (id, next, revision) => { expect(revision).toBe(123); schema = next; }) };
  const result = await execute({ action: 'bind', appType: 'APP_A', directory: root, 'form-uuid': 'FORM-A', entry: 'app' }, api);
  expect(result).toMatchObject({ canvasNodeId: 'canvas', pageBindingReadbackVerified: true, published: false });
  expect(api.savePage).toHaveBeenCalledTimes(1);
  api.enterTest.mockRejectedValue(new Error('missing test context'));
  await expect(execute({ action: 'bind', appType: 'APP_A', directory: root, 'form-uuid': 'FORM-A', entry: 'app' }, api)).rejects.toThrow('missing test context');
  expect(api.savePage).toHaveBeenCalledTimes(1);
  fs.writeFileSync(path.join(root, 'App.tsx'), 'unsaved');
  await expect(execute({ action: 'bind', appType: 'APP_A', directory: root, 'form-uuid': 'FORM-A', entry: 'app' }, api)).rejects.toThrow('Push local changes');
});
test('local check routes through the real command without initializing auth or making writes', async () => {
  project();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  const result = await run(['check', 'APP_A', root, '--json']);
  expect(result).toMatchObject({ valid: true, compilationVerified: false, fileCount: 3 });
  expect(createWorkspaceApi).not.toHaveBeenCalled();
});
test('a whole editing round produces one patch request and verifies the saved snapshot', async () => {
  project();
  const before = describe(collectFiles(root));
  writeState(root, { ...identity, appType: 'APP_A', files: { ...before, 'deleted.ts': { size: 0, sha256: sha256(Buffer.alloc(0)) } } });
  fs.writeFileSync(path.join(root, 'App.tsx'), 'updated');
  fs.writeFileSync(path.join(root, 'Added.ts'), 'new');
  const api = { get: jest.fn(async (action) => {
    if (action === 'limits') {
      return { maxSourceFileCount: 1000, maxSourceSnapshotBytes: 10485760 };
    }
    if (action === 'current') {
      return identity;
    }
    return { ...identity, revision: 3, files: describe(collectFiles(root)) };
  }), multipart: jest.fn().mockResolvedValue({ ...identity, revision: 3 }), version: jest.fn() };
  const result = await execute({ action: 'push', appType: 'APP_A', directory: root }, api);
  expect(api.multipart).toHaveBeenCalledTimes(1);
  expect(api.multipart.mock.calls[0][0]).toBe('savePatch');
  expect(api.multipart.mock.calls[0][1]).toMatchObject({ expectedRevision: 2, path: ['Added.ts', 'App.tsx'], deletedPath: ['deleted.ts'] });
  expect(result).toMatchObject({ sourceReadbackVerified: true, published: false, appliedFiles: 2 });
  expect(api.version).not.toHaveBeenCalled();
});
test('conflicting revision blocks upload and preserves local edits', async () => {
  project();
  const api = { get: jest.fn(async (action) => action === 'limits'
    ? { maxSourceFileCount: 1000, maxSourceSnapshotBytes: 10485760 } : { ...identity, revision: 9 }), multipart: jest.fn() };
  await expect(execute({ action: 'push', appType: 'APP_A', directory: root, 'expected-revision': '2' }, api)).rejects.toMatchObject({ code: 'CODE_WORKSPACE_DRAFT_CONFLICT' });
  expect(api.multipart).not.toHaveBeenCalled();
  expect(fs.readFileSync(path.join(root, 'App.tsx'), 'utf8')).toContain('export');
});
test('lost upload response reconciles an exact committed snapshot without retrying the write', async () => {
  project();
  const files = describe(collectFiles(root));
  const saved = { ...identity, revision: 1, files };
  let currentReads = 0;
  const api = { get: jest.fn(async action => {
    if (action === 'limits') { return { maxSourceFileCount: 100, maxSourceSnapshotBytes: 1048576 }; }
    if (action === 'current') { return currentReads++ === 0 ? null : saved; }
    return saved;
  }), multipart: jest.fn().mockRejectedValue(new Error('request timed out')) };
  const result = await execute({ action: 'push', appType: 'APP_A', directory: root, 'expected-revision': '0' }, api);
  expect(result).toMatchObject({ responseRecovered: true, sourceReadbackVerified: true, revision: 1 });
  expect(api.multipart).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fs.readFileSync(path.join(root, '.openyida/workspace.json'))).sourceSnapshotId).toBe(saved.sourceSnapshotId);
});
test.each(['different files', 'later revision', 'readback unavailable'])('uncertain upload preserves error for %s and never retries', async reason => {
  project();
  const saved = { ...identity, revision: reason === 'later revision' ? 2 : 1,
    files: reason === 'different files' ? {} : describe(collectFiles(root)) };
  let currentReads = 0;
  const error = new Error('request timed out');
  const api = { get: jest.fn(async action => {
    if (action === 'limits') { return { maxSourceFileCount: 100, maxSourceSnapshotBytes: 1048576 }; }
    if (currentReads++ === 0) { return null; }
    if (reason === 'readback unavailable') { throw new Error('offline'); }
    return saved;
  }), multipart: jest.fn().mockRejectedValue(error) };
  await expect(execute({ action: 'push', appType: 'APP_A', directory: root, 'expected-revision': '0' }, api)).rejects.toBe(error);
  expect(api.multipart).toHaveBeenCalledTimes(1);
  expect(fs.existsSync(path.join(root, '.openyida/workspace.json'))).toBe(false);
});
test('pull preserves binary bytes, refuses overwrite and verifies all bytes before creating output', async () => {
  const target = path.join(root, 'pull');
  const bytes = Buffer.from([0, 255, 19]);
  const snapshot = { ...identity, buildRecipeSha256: sha256(Buffer.from(JSON.stringify(archiveRecipe))), files: { 'assets/a.png': { size: bytes.length, sha256: sha256(bytes) } } };
  const api = { get: jest.fn().mockResolvedValue(snapshot), downloadArchive: jest.fn().mockResolvedValue(archive(snapshot, { 'assets/a.png': bytes })) };
  await execute({ action: 'pull', appType: 'APP_A', directory: target }, api);
  expect(fs.readFileSync(path.join(target, 'assets/a.png'))).toEqual(bytes);
  await expect(execute({ action: 'pull', appType: 'APP_A', directory: target }, api)).rejects.toThrow('never overwritten');
  const badTarget = path.join(root, 'bad');
  api.downloadArchive.mockResolvedValue(archive(snapshot, { 'assets/a.png': Buffer.from('bad') }));
  await expect(execute({ action: 'pull', appType: 'APP_A', directory: badTarget }, api)).rejects.toMatchObject({ code: 'CODE_WORKSPACE_INTEGRITY_ERROR' });
  expect(fs.existsSync(badTarget)).toBe(false);
});
test('traversal and source symlinks are rejected; credentials and generated artifacts are excluded', async () => {
  fs.writeFileSync(path.join(root, '.env'), 'credential');
  fs.writeFileSync(path.join(root, '.npmrc'), 'credential');
  fs.mkdirSync(path.join(root, 'dist'));
  fs.writeFileSync(path.join(root, 'dist/runtime.js'), 'generated');
  expect(Object.keys(collectFiles(root))).toEqual([]);
  fs.symlinkSync('/tmp', path.join(root, 'linked'));
  expect(() => collectFiles(root)).toThrow('symbolic');
  const api = { get: jest.fn().mockResolvedValue({ ...identity, files: { '../escape': {} } }), download: jest.fn() };
  await expect(execute({ action: 'pull', appType: 'APP_A', directory: path.join(root, 'out') }, api)).rejects.toThrow('Invalid workspace path');
  expect(api.download).not.toHaveBeenCalled();
});
test('restore changes only the server editing head and does not require an invented recipe', async () => {
  writeState(root, { ...identity, appType: 'APP_A', files: {} });
  const api = { post: jest.fn().mockResolvedValue({ ...identity, revision: 3 }) };
  const result = await execute({ action: 'restore', appType: 'APP_A', directory: root, snapshot: 'old' }, api);
  expect(api.post).toHaveBeenCalledWith('restoreDraft', { expectedRevision: 2, targetSnapshotId: 'old' });
  expect(result).toMatchObject({ localFilesUpdated: false, published: false });
});
test('publish requires stable identities and a previously registered unchanged source', async () => {
  expect(() => parseArgs(['publish', 'APP_A', root])).toThrow('stable');
  project();
  writeState(root, { ...identity, appType: 'APP_A', files: describe(collectFiles(root)) });
  const api = { version: jest.fn() };
  await expect(execute({ action: 'publish', appType: 'APP_A', directory: root, 'draft-version': '1.1', 'publish-id': 'P1' }, api)).rejects.toThrow('Register');
  expect(api.version).not.toHaveBeenCalled();
});

test('unchanged source does not create another server snapshot', async () => {
  project();
  writeState(root, { ...identity, appType: 'APP_A', files: describe(collectFiles(root)) });
  const api = { get: jest.fn(async action => action === 'limits'
    ? { maxSourceFileCount: 1000, maxSourceSnapshotBytes: 10485760 } : identity), multipart: jest.fn() };
  await expect(execute({ action: 'push', appType: 'APP_A', directory: root }, api)).resolves.toMatchObject({ unchanged: true, published: false });
  expect(api.multipart).not.toHaveBeenCalled();
});

test('register verifies frozen output, then publish explicitly uses the registered build', async () => {
  const recipe = project();
  writeState(root, { ...identity, appType: 'APP_A', files: describe(collectFiles(root)) });
  const buildRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-build-'));
  try {
    const bytes = Buffer.from('export default null');
    const buildId = 'c'.repeat(32);
    const manifest = { formatVersion: 2, ...identity, runtimeAbi: recipe.runtimeAbi, buildId,
      files: [{ path: 'app.js', size: bytes.length, sha256: sha256(bytes) }], entries: {} };
    fs.mkdirSync(path.join(buildRoot, 'files'));
    fs.writeFileSync(path.join(buildRoot, 'files/app.js'), bytes);
    fs.writeFileSync(path.join(buildRoot, 'runtime.manifest.json'), JSON.stringify(manifest));
    const build = { ...identity, buildId };
    const selected = { workspaceId: identity.workspaceId, sourceSnapshotId: identity.sourceSnapshotId, codeWorkspaceBuildId: buildId, codeWorkspacePublishId: 'P1', codeWorkspaceDraftVersion: '1.2' };
    const api = { enterTest: jest.fn(), multipart: jest.fn().mockResolvedValue(build), version: jest.fn(async action => action === 'getWorkspaceDraft' ? selected : { success: true }) };
    await execute({ action: 'register', appType: 'APP_A', directory: root, 'build-dir': buildRoot }, api);
    expect(api.multipart).toHaveBeenCalledWith('registerBuild', expect.objectContaining({ uploadAttempt: buildId }), expect.any(Object));
    expect(api.version).not.toHaveBeenCalled();
    const draft = await execute({ action: 'save-test-draft', appType: 'APP_A', directory: root, 'draft-version': '1.2', 'publish-id': 'P1' }, api);
    expect(draft).toMatchObject({ published: false, testDraftReadbackVerified: true });
    expect(api.version.mock.calls.map(call => call[0])).toEqual(['startTest', 'saveWorkspaceDraft', 'getWorkspaceDraft']);
    api.version.mockClear();
    api.enterTest.mockClear();
    const result = await execute({ action: 'publish', appType: 'APP_A', directory: root, 'draft-version': '1.2', 'publish-id': 'P1' }, api);
    expect(api.enterTest).toHaveBeenCalledTimes(1);
    expect(api.version.mock.calls).toEqual([
      ['startTest'],
      ['saveWorkspaceDraft', { codeWorkspaceBuildId: buildId, sourceSnapshotId: identity.sourceSnapshotId, codeWorkspacePublishId: 'P1', codeWorkspaceDraftVersion: '1.2' }],
      ['getWorkspaceDraft'],
      ['publishDraft', { codeWorkspaceBuildId: buildId, codeWorkspacePublishId: 'P1', codeWorkspaceDraftVersion: '1.2' }],
      ['getPublishStatus'],
    ]);
    expect(result).toMatchObject({ buildId, runtimeVerified: false });
  } finally {
    fs.rmSync(buildRoot, { recursive: true, force: true });
  }
});

test('pull retains the server recipe when source has no invented project.json', async () => {
  const recipe = project();
  fs.unlinkSync(path.join(root, 'project.json'));
  const files = collectFiles(root);
  const snapshot = { ...identity, buildRecipeSha256: sha256(Buffer.from(JSON.stringify(archiveRecipe))), files: describe(files) };
  const target = path.join(root, 'server-recipe');
  const api = { get: jest.fn().mockResolvedValue(snapshot), downloadArchive: jest.fn().mockResolvedValue(archive(snapshot, files, recipe)) };
  await execute({ action: 'pull', appType: 'APP_A', directory: target }, api);
  expect(fs.existsSync(path.join(target, 'project.json'))).toBe(false);
  expect(await execute({ action: 'check', appType: 'APP_A', directory: target }, null)).toMatchObject({ valid: true, entries: recipe.entries });
  fs.writeFileSync(path.join(target, 'lock.json'), '{}\n');
  const savedFiles = describe(collectFiles(target));
  const saved = { ...snapshot, revision: snapshot.revision + 1, sourceSnapshotId: 'new-snapshot', files: savedFiles };
  api.get.mockImplementation(async action => action === 'limits'
    ? { maxSourceFileCount: 1000, maxSourceSnapshotBytes: 10485760 } : action === 'current' ? snapshot : saved);
  api.multipart = jest.fn().mockResolvedValue(saved);
  await execute({ action: 'push', appType: 'APP_A', directory: target }, api);
  expect(api.multipart.mock.calls[0][1].lockfileHash).toBe(sha256(Buffer.from('{}\n')));
  expect(await execute({ action: 'check', appType: 'APP_A', directory: target }, null)).toMatchObject({ valid: true });
  expect(fs.existsSync(path.join(target, 'project.json'))).toBe(false);
});

test('pull never installs repository metadata supplied by a remote snapshot', async () => {
  const api = { get: jest.fn().mockResolvedValue({ ...identity, files: { '.git/hooks/post-checkout': {} } }), download: jest.fn() };
  await expect(execute({ action: 'pull', appType: 'APP_A', directory: path.join(root, 'out') }, api)).rejects.toThrow('reserved');
  expect(api.download).not.toHaveBeenCalled();
});


test('publish stops before ONLINE promotion when the test build readback differs', async () => {
  project();
  writeState(root, { ...identity, appType: 'APP_A', files: describe(collectFiles(root)), build: { ...identity, buildId: 'b'.repeat(32) } });
  const api = { enterTest: jest.fn(), version: jest.fn(async () => ({ workspaceId: 'foreign' })) };
  await expect(execute({ action: 'publish', appType: 'APP_A', directory: root, 'draft-version': '1.2', 'publish-id': 'P1' }, api))
    .rejects.toThrow('readback mismatch');
  expect(api.version.mock.calls.map(call => call[0])).toEqual(['startTest', 'saveWorkspaceDraft', 'getWorkspaceDraft']);
});
