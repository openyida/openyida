'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execute, parseArgs } = require('../lib/code-workspace');
const { collectFiles, describe, readRecipe, writeState } = require('../lib/code-workspace/files');
const { compileWorkspace } = require('../lib/code-workspace/workspace-app');
const { readWorkspaceTemplate } = require('../lib/code-workspace/workspace-template');

const appType = 'APP_WORKSPACE';
const localBase = { workspaceId: '1'.repeat(32), sourceSnapshotId: 'a'.repeat(16), revision: 2,
  sourceManifestSha256: 'b'.repeat(64), buildRecipeSha256: 'c'.repeat(64) };
const testSelection = { workspaceId: localBase.workspaceId, sourceSnapshotId: localBase.sourceSnapshotId,
  codeWorkspaceDraftVersion: '2.0.0', codeWorkspaceBuildId: 'd'.repeat(32), codeWorkspacePublishId: 'draft-release-one' };
const getAppTag = () => ({ appTag: 'WORKSPACE', appType });

let folder;
beforeEach(() => { folder = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-app-')); });
afterEach(() => { fs.rmSync(folder, { recursive: true, force: true }); });

function saveFixtureProject() {
  const { files } = readWorkspaceTemplate();
  for (const [name, bytes] of Object.entries(files)) {
    const target = path.join(folder, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
  writeState(folder, { ...localBase, appType, files: describe(files) });
}

test('initializes only a verified empty WORKSPACE, writes five files and preserves remote zero revision', async () => {
  const destination = path.join(folder, 'new');
  const api = { app: jest.fn(getAppTag), get: jest.fn().mockResolvedValue(null), multipart: jest.fn() };
  const options = parseArgs(['pull', appType, destination, '--init-if-empty']);
  await expect(execute(options, api)).resolves.toEqual({
    appType, initialized: true, expectedRevision: 0, fileCount: 5, templateVersion: 'yida-workspace-v1',
  });
  expect(Object.keys(collectFiles(destination))).toHaveLength(5);
  expect(fs.existsSync(path.join(destination, '.openyida'))).toBe(false);
  expect(api.get.mock.calls).toEqual([['current'], ['current']]);
  expect(api.multipart).not.toHaveBeenCalled();
  await expect(execute(options, api)).rejects.toThrow('never overwritten');
});

test.each([undefined, false, {}])('invalid empty response %p never creates a local project', async response => {
  const destination = path.join(folder, 'invalid');
  const api = { app: jest.fn(getAppTag), get: jest.fn().mockResolvedValue(response) };
  await expect(execute(parseArgs(['pull', appType, destination, '--init-if-empty']), api)).rejects.toThrow();
  expect(fs.existsSync(destination)).toBe(false);
});

test('initialization refuses a regular app and otherwise pulls a source created during preparation', async () => {
  const destination = path.join(folder, 'new');
  const options = parseArgs(['pull', appType, destination, '--init-if-empty']);
  await expect(execute(options, { app: async () => ({ appTag: 'NORMAL' }) })).rejects.toMatchObject({
    code: 'CODE_WORKSPACE_WRONG_APP_TAG',
  });
  const bytes = Buffer.from('already saved');
  const snapshot = { ...localBase, files: describe({ 'README.md': bytes }) };
  const api = { app: jest.fn(getAppTag), get: jest.fn().mockResolvedValueOnce(null).mockResolvedValue(snapshot),
    download: jest.fn().mockResolvedValue(bytes) };
  await expect(execute(options, api)).resolves.toMatchObject({ sourceSnapshotId: localBase.sourceSnapshotId, revision: 2 });
  expect(fs.readFileSync(path.join(destination, 'README.md'))).toEqual(bytes);
});

test('an older working copy is preserved after rollback even if given the newer revision manually', async () => {
  saveFixtureProject();
  const localSource = path.join(folder, 'src/main.tsx');
  fs.appendFileSync(localSource, '\n// unsaved changes\n');
  const head = { ...localBase, sourceSnapshotId: 'f'.repeat(16), revision: 3 };
  const api = { app: jest.fn(getAppTag), get: jest.fn(async action => action === 'current' ? head : {
    maxSourceFileCount: 100, maxSourceSnapshotBytes: 65536,
  }), multipart: jest.fn() };
  for (const extra of [[], ['--expected-revision', '3']]) {
    await expect(execute(parseArgs(['push', appType, folder, ...extra]), api))
      .rejects.toMatchObject({ code: 'CODE_WORKSPACE_DRAFT_CONFLICT' });
  }
  expect(api.multipart).not.toHaveBeenCalled();
  expect(fs.readFileSync(localSource, 'utf8')).toContain('unsaved changes');
});

test('a definitive server conflict after rollback keeps the existing local base', async () => {
  saveFixtureProject();
  fs.appendFileSync(path.join(folder, 'src/main.tsx'), '\n// pending edits\n');
  const conflict = Object.assign(new Error('Server source draft changed'), { code: 'CODE_WORKSPACE_DRAFT_CONFLICT' });
  const api = { app: jest.fn(getAppTag), get: jest.fn(async action => action === 'current' ? localBase : {
    maxSourceFileCount: 100, maxSourceSnapshotBytes: 65536,
  }), multipart: jest.fn().mockRejectedValue(conflict) };
  await expect(execute(parseArgs(['push', appType, folder]), api)).rejects.toBe(conflict);
  expect(api.get.mock.calls).toEqual([['limits'], ['current']]);
  expect(api.multipart).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fs.readFileSync(path.join(folder, '.openyida/workspace.json'), 'utf8')).revision).toBe(localBase.revision);
});

test('compiles the frozen scaffold into repeatable IIFE and stylesheet bytes and registers the exact build', async () => {
  saveFixtureProject();
  const api = { app: jest.fn(getAppTag), get: jest.fn().mockResolvedValue({ ...localBase, files: describe(collectFiles(folder)) }),
    baseUrl: 'https://example.test',
    multipart: jest.fn(async (_action, fields, parts) => {
      const manifest = JSON.parse(parts.runtimeManifest.content);
      const sandbox = { window: { React: {}, ReactDOM: {} } };
      vm.runInNewContext(parts.files.find(file => file.fileName === 'main.js').content.toString(), sandbox);
      expect(typeof sandbox.YidaWorkspaceApp.default).toBe('function');
      expect(manifest).toMatchObject({
        buildId: fields.uploadAttempt, sourceSnapshotId: localBase.sourceSnapshotId,
        entries: { main: { runtimeFiles: ['main.js'], cssFiles: ['main.css'], assetFiles: [], importedModules: [] } },
      });
      expect(manifest.files).toMatchObject([
        { path: 'main.css', mediaType: 'text/css', audience: 'runtime' },
        { path: 'main.js', mediaType: 'application/javascript', audience: 'runtime' },
      ]);
      return { ...localBase, buildId: manifest.buildId };
    }) };
  const options = parseArgs(['build', appType, folder]);
  const first = await execute(options, api);
  const second = await execute(options, api);
  expect(first.buildId).toBe(second.buildId);
  expect(first.previewUrl).toBe('https://example.test/APP_WORKSPACE/workspace?workspaceEnv=preview&sourceSnapshotId=' + localBase.sourceSnapshotId + '&buildId=' + first.buildId);
  expect(first).toMatchObject({ compilationVerified: true, runtimeVerified: false, published: false });
}, 15000);

test('compilation rejects unsupported dependencies and a missing default export', async () => {
  const { files } = readWorkspaceTemplate();
  const recipe = readRecipe(folder, files);
  for (const source of ['export const App = () => null', 'import X from "antd"; export default X']) {
    files['src/main.tsx'] = Buffer.from(source);
    await expect(compileWorkspace(files, recipe, localBase)).rejects.toThrow();
  }
}, 15000);

test('start-test returns a pinned workspace URL and save-test verifies the test binding without publishing', async () => {
  saveFixtureProject();
  writeState(folder, { ...localBase, appType, files: describe(collectFiles(folder)),
    build: { ...localBase, buildId: testSelection.codeWorkspaceBuildId } });
  const api = { app: jest.fn(getAppTag), currentUserId: 'user',
    baseUrl: 'https://example.test', enterTest: jest.fn(), get: jest.fn().mockResolvedValue({ ...localBase, files: describe(collectFiles(folder)) }),
    version: jest.fn(async action => {
      if (action === 'getPreviewUrl') { return '/APP_WORKSPACE/workspace?workspaceEnv=test&workspaceVersion=2.0.0'; }
      if (action === 'hasActiveTestVersion') { return true; }
      if (action === 'getTestEnvironmentStatus') { return { inTestEnvironment: true }; }
      if (action === 'getWorkspaceDraft') { return testSelection; }
      return null;
    }) };
  await expect(execute(parseArgs(['start-test', appType, '--workspace']), api)).resolves.toMatchObject({
    draftVersion: '2.0.0', previewUrl: 'https://example.test/APP_WORKSPACE/workspace?workspaceEnv=test&workspaceVersion=2.0.0',
  });
  api.version.mockClear();
  await expect(execute(parseArgs(['save-test', appType, folder, '--draft-version', '2.0.0',
    '--publish-id', testSelection.codeWorkspacePublishId]), api)).resolves.toMatchObject({
    testUrl: 'https://example.test/APP_WORKSPACE/workspace?workspaceEnv=test&workspaceVersion=2.0.0',
    testReadbackVerified: true, published: false,
  });
  expect(api.version.mock.calls.map(([action]) => action)).toEqual(['saveWorkspaceDraft', 'getWorkspaceDraft']);
  expect(api.enterTest).not.toHaveBeenCalled();
});

test('confirmed publication is bound to the exact active test and never writes another binding', async () => {
  const tokenPath = path.join(folder, 'confirmation');
  fs.writeFileSync(tokenPath, 'fixture.receipt\n', { mode: 0o600 });
  const options = parseArgs(['publish-tested', appType, '--draft-version', '2.0.0', '--build-id',
    testSelection.codeWorkspaceBuildId, '--publish-id', testSelection.codeWorkspacePublishId,
    '--confirmation-token-file', tokenPath]);
  const api = { app: jest.fn(getAppTag), enterTest: jest.fn(), version: jest.fn(async action => {
    if (action === 'getWorkspaceDraft') { return testSelection; }
    if (action === 'publishDraft') { return '2.0.0'; }
    return { status: 'SUCCESS' };
  }) };
  await expect(execute(options, api)).resolves.toMatchObject({ appVersion: '2.0.0', published: true, runtimeVerified: false });
  expect(api.version.mock.calls.map(([action]) => action)).toEqual(['getWorkspaceDraft', 'publishDraft', 'getPublishStatus']);
  expect(api.enterTest).not.toHaveBeenCalled();
  expect(api.version.mock.calls[1][1]).toEqual({
    codeWorkspaceBuildId: testSelection.codeWorkspaceBuildId, codeWorkspacePublishId: testSelection.codeWorkspacePublishId,
    codeWorkspaceDraftVersion: testSelection.codeWorkspaceDraftVersion, codeWorkspaceConfirmationToken: 'fixture.receipt',
  });
  api.version.mockReset().mockResolvedValue({ ...testSelection, codeWorkspaceBuildId: '9'.repeat(32) });
  await expect(execute(options, api)).rejects.toMatchObject({ code: 'CODE_WORKSPACE_READBACK_FAILED' });
  expect(api.version.mock.calls).toEqual([['getWorkspaceDraft']]);
});
