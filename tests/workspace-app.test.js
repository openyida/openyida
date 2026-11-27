'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execute, parseArgs } = require('../lib/code-workspace');
const { collectFiles, describe, readRecipe, writeState } = require('../lib/code-workspace/files');
const { compileWorkspace, testUrl } = require('../lib/code-workspace/workspace-app');
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
  expect(first.previewUrl).toBeUndefined(); // An uploaded build is not a bound test version.
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

test('start-test identifies the draft independently of the preview URL and save-test verifies its binding', async () => {
  saveFixtureProject();
  writeState(folder, { ...localBase, appType, files: describe(collectFiles(folder)),
    build: { ...localBase, buildId: testSelection.codeWorkspaceBuildId } });
  const api = { app: jest.fn(getAppTag), currentUserId: 'user',
    baseUrl: 'https://example.test', enterTest: jest.fn(), get: jest.fn().mockResolvedValue({ ...localBase, files: describe(collectFiles(folder)) }),
    version: jest.fn(async action => {
      if (action === 'getPreviewUrl') { return '/APP_WORKSPACE/preview'; }
      if (action === 'listVersions') { return [{ version: '2.0.0', status: 'DRAFT' }]; }
      if (action === 'hasActiveTestVersion') { return true; }
      if (action === 'getTestEnvironmentStatus') { return { inTestEnvironment: true }; }
      if (action === 'getWorkspaceDraft') { return testSelection; }
      return null;
    }) };
  await expect(execute(parseArgs(['start-test', appType, '--workspace']), api)).resolves.toMatchObject({
    draftVersion: '2.0.0', previewUrl: 'https://example.test/APP_WORKSPACE/preview',
  });
  api.version.mockClear();
  await expect(execute(parseArgs(['save-test', appType, folder, '--draft-version', '2.0.0',
    '--publish-id', testSelection.codeWorkspacePublishId]), api)).resolves.toMatchObject({
    testUrl: 'https://example.test/APP_WORKSPACE/preview',
    testReadbackVerified: true, published: false,
  });
  expect(api.version.mock.calls.map(([action]) => action)).toEqual(['saveWorkspaceDraft', 'getWorkspaceDraft', 'getPreviewUrl']);
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

function syncOptions() {
  return parseArgs(['sync-test', appType, folder, '--json']);
}

function unboundWorkspaceApi(versions) {
  const head = { ...localBase, files: describe(collectFiles(folder)) };
  let saved;
  return {
    app: jest.fn(getAppTag), baseUrl: 'https://example.test', multipart: jest.fn(),
    get: jest.fn(async action => {
      if (action === 'limits') { return { maxSourceFileCount: 100, maxSourceSnapshotBytes: 65536 }; }
      if (action === 'currentBuild') { return { ...head, buildId: testSelection.codeWorkspaceBuildId }; }
      return head;
    }),
    version: jest.fn(async (action, params) => {
      if (action === 'getWorkspaceDraft') {
        if (saved) { return saved; }
        throw Object.assign(new Error('Test not bound'), { code: 'CODE_WORKSPACE_TEST_BUILD_REQUIRED' });
      }
      if (action === 'hasActiveTestVersion') { return true; }
      if (action === 'listVersions') { return versions; }
      if (action === 'getPreviewUrl') { return '/APP_WORKSPACE/preview'; }
      if (action === 'saveWorkspaceDraft') {
        saved = { ...testSelection, ...params };
        return saved;
      }
      throw new Error('Unexpected version operation: ' + action);
    }),
  };
}

test('resumes the unbound uploaded build left by beta without creating another draft or rebuilding', async () => {
  saveFixtureProject();
  const api = unboundWorkspaceApi([{ status: 'ONLINE', version: '1.0' }, { status: 'DRAFT', version: '2.0.0' }]);
  await expect(execute(syncOptions(), api)).resolves.toMatchObject({
    testUrl: 'https://example.test/APP_WORKSPACE/preview', ...testSelection,
    buildUploaded: false, testBindingUpdated: true, testReadbackVerified: true, published: false,
  });
  expect(api.multipart).not.toHaveBeenCalled();
  expect(api.version.mock.calls.map(([action]) => action)).toEqual([
    'getWorkspaceDraft', 'listVersions', 'hasActiveTestVersion', 'listVersions',
    'saveWorkspaceDraft', 'getWorkspaceDraft', 'getPreviewUrl',
  ]);
});

test.each([
  { versions: [] }, { versions: [{ status: 'ONLINE', version: '1.0' }] },
  { versions: [{ status: 'DRAFT', version: '2.0' }, { status: 'DRAFT', version: '3.0' }] },
  { versions: [{ status: 'DRAFT', version: '' }] },
])('missing or ambiguous DRAFT stops before binding: $versions', async ({ versions }) => {
  saveFixtureProject();
  const api = unboundWorkspaceApi(versions);
  await expect(execute(syncOptions(), api)).rejects.toMatchObject({ code: 'CODE_WORKSPACE_TEST_CONTEXT_UNAVAILABLE' });
  expect(api.version.mock.calls.some(([action]) => action === 'saveWorkspaceDraft' || action === 'createTestVersion')).toBe(false);
  expect(api.multipart).not.toHaveBeenCalled();
});

test('workspace start-test accepts a legacy server URL without deriving draft identity from it', async () => {
  const url = '/APP_WORKSPACE/workspace?workspaceEnv=test&workspaceVersion=actual-version';
  const api = { app: jest.fn(getAppTag), baseUrl: 'https://example.test', currentUserId: 'user',
    version: jest.fn(async action => {
      if (action === 'hasActiveTestVersion') { return true; }
      if (action === 'listVersions') { return [{ status: 'DRAFT', version: 'actual-version' }]; }
      if (action === 'getPreviewUrl') { return url; }
      return null;
    }) };
  await expect(execute(parseArgs(['start-test', appType, '--workspace']), api)).resolves.toMatchObject({
    draftVersion: 'actual-version', previewUrl: 'https://example.test' + url,
  });
});

test.each([
  '/OTHER_APP/preview', 'https://other.test/APP_WORKSPACE/preview',
  '/APP_WORKSPACE/workspace?workspaceEnv=test&workspaceVersion=changed-version',
])('rejects a preview for another app, host or draft: %s', async link => {
  const api = { baseUrl: 'https://example.test', version: jest.fn().mockResolvedValue(link) };
  await expect(testUrl(api, appType, 'actual-version')).rejects.toMatchObject({ code: 'CODE_WORKSPACE_TEST_CONTEXT_UNAVAILABLE' });
});

test('an empty WORKSPACE saves, compiles, uploads and binds once, and every completed round returns one stable URL', async () => {
  saveFixtureProject();
  fs.rmSync(path.join(folder, '.openyida'), { recursive: true });
  const limits = { maxSourceFileCount: 100, maxSourceSnapshotBytes: 65536 };
  let head = null;
  let registered = null;
  let test = null;
  const api = {
    app: jest.fn(getAppTag), baseUrl: 'https://example.test',
    get: jest.fn(async action => {
      if (action === 'limits') { return limits; }
      if (action === 'currentBuild') { return registered?.sourceSnapshotId === head?.sourceSnapshotId ? registered : null; }
      return head;
    }),
    multipart: jest.fn(async (action, fields, parts) => {
      if (action === 'registerBuild') {
        const manifest = JSON.parse(parts.runtimeManifest.content);
        expect(manifest.sourceSnapshotId).toBe(head.sourceSnapshotId);
        expect(parts.files.map(file => file.fileName).sort()).toEqual(head.revision === 1 ? ['main.css', 'main.js'] : ['main.js']);
        registered = { ...head, buildId: manifest.buildId };
        return registered;
      }
      const revision = (head?.revision ?? 0) + 1;
      expect(fields.expectedRevision).toBe(revision - 1);
      expect(action).toBe(revision === 1 ? 'saveDraft' : 'savePatch');
      expect(parts.files).toHaveLength(revision === 1 ? 5 : 1);
      head = { ...localBase, revision, sourceSnapshotId: String(revision).repeat(16), files: describe(collectFiles(folder)) };
      return head;
    }),
    version: jest.fn(async (action, params) => {
      if (action === 'getWorkspaceDraft') {
        if (test) { return test; }
        throw Object.assign(new Error('Test not saved'), { code: 'CODE_WORKSPACE_TEST_BUILD_REQUIRED' });
      }
      if (action === 'createTestVersion' || action === 'getPreviewUrl') { return '/APP_WORKSPACE/preview'; }
      if (action === 'hasActiveTestVersion') { return false; }
      if (action === 'listVersions') { return [{ version: '2.0.0', status: 'DRAFT' }]; }
      if (action !== 'saveWorkspaceDraft') { throw new Error(`Unexpected version operation ${action}`); }
      expect(params.sourceSnapshotId).toBe(registered.sourceSnapshotId);
      expect(params.codeWorkspaceBuildId).toBe(registered.buildId);
      test = { ...params, workspaceId: localBase.workspaceId, codeWorkspacePublishId: 'receipt-' + head.revision };
      return test;
    }),
  };
  const testUrl = 'https://example.test/APP_WORKSPACE/preview';
  const first = await execute(syncOptions(), api);
  expect(first).toMatchObject({ sourceChanged: true, buildUploaded: true, testBindingUpdated: true,
    testReadbackVerified: true, published: false, revision: 1, testUrl });
  expect(api.multipart.mock.calls.map(([action]) => action)).toEqual(['saveDraft', 'registerBuild']);

  api.multipart.mockClear();
  api.version.mockClear();
  await expect(execute(syncOptions(), api)).resolves.toMatchObject({ sourceChanged: false, testBindingUpdated: false,
    buildUploaded: false, codeWorkspaceBuildId: first.codeWorkspaceBuildId, testUrl });
  expect(api.multipart).not.toHaveBeenCalled();
  expect(api.version.mock.calls).toEqual([['getWorkspaceDraft'], ['getPreviewUrl']]);

  fs.writeFileSync(path.join(folder, 'src/main.tsx'), "export default function App() { return 'revised'; }\n");
  const second = await execute(syncOptions(), api);
  expect(second).toMatchObject({ sourceChanged: true, buildUploaded: true, testBindingUpdated: true, revision: 2, testUrl,
    codeWorkspaceDraftVersion: first.codeWorkspaceDraftVersion });
  expect(second.codeWorkspaceBuildId).not.toBe(first.codeWorkspaceBuildId);
  expect(api.multipart.mock.calls.map(([action]) => action)).toEqual(['savePatch', 'registerBuild']);
  expect(api.version.mock.calls.map(([action]) => action)).toEqual(['getWorkspaceDraft', 'getPreviewUrl', 'getWorkspaceDraft', 'saveWorkspaceDraft', 'getWorkspaceDraft', 'getPreviewUrl']);
}, 15000);

test('an already uploaded build resumes binding with its exact identity even when the bind response is lost', async () => {
  saveFixtureProject();
  const head = { ...localBase, files: describe(collectFiles(folder)) };
  const previous = { ...testSelection, sourceSnapshotId: 'b'.repeat(16), codeWorkspaceBuildId: 'e'.repeat(32) };
  const lostResponse = new Error('connection closed after the bind');
  const api = {
    app: jest.fn(getAppTag), baseUrl: 'https://example.test', multipart: jest.fn(),
    get: jest.fn(async action => {
      if (action === 'limits') { return { maxSourceFileCount: 100, maxSourceSnapshotBytes: 65536 }; }
      if (action === 'currentBuild') { return { sourceSnapshotId: head.sourceSnapshotId, buildId: testSelection.codeWorkspaceBuildId }; }
      return head;
    }),
    version: jest.fn().mockResolvedValueOnce(previous).mockRejectedValueOnce(lostResponse).mockResolvedValueOnce(previous),
  };
  await expect(execute(syncOptions(), api)).rejects.toBe(lostResponse);
  api.version.mockReset().mockResolvedValueOnce(previous).mockRejectedValueOnce(lostResponse).mockResolvedValueOnce(testSelection)
    .mockResolvedValueOnce('/APP_WORKSPACE/preview');
  await expect(execute(syncOptions(), api)).resolves.toMatchObject({ ...testSelection, sourceChanged: false,
    buildUploaded: false, testBindingUpdated: true, published: false });
  expect(api.multipart).not.toHaveBeenCalled();
  expect(api.version.mock.calls).toEqual([['getWorkspaceDraft'], ['saveWorkspaceDraft', {
    sourceSnapshotId: head.sourceSnapshotId, codeWorkspaceDraftVersion: testSelection.codeWorkspaceDraftVersion,
    codeWorkspaceBuildId: testSelection.codeWorkspaceBuildId,
  }], ['getWorkspaceDraft'], ['getPreviewUrl']]);
});

test('a compile failure leaves the previous successful test candidate available', async () => {
  saveFixtureProject();
  const sourcePath = path.join(folder, 'src/main.tsx');
  fs.writeFileSync(sourcePath, 'export const MissingDefault = () => null;\n');
  const head = { ...localBase, files: describe(collectFiles(folder)) };
  writeState(folder, { ...head, appType });
  const api = {
    app: jest.fn(getAppTag), baseUrl: 'https://example.test', multipart: jest.fn(),
    get: jest.fn(async action => {
      if (action === 'limits') { return { maxSourceFileCount: 100, maxSourceSnapshotBytes: 65536 }; }
      return action === 'currentBuild' ? null : head;
    }),
    version: jest.fn().mockResolvedValue({ ...testSelection, sourceSnapshotId: 'b'.repeat(16) }),
  };
  await expect(execute(syncOptions(), api)).rejects.toThrow();
  expect(api.version.mock.calls).toEqual([['getWorkspaceDraft']]);
  expect(api.multipart).not.toHaveBeenCalled();
}, 15000);

test.each([false, true])('already published sources avoid opening an empty test version, including rollback=%s', async restored => {
  saveFixtureProject();
  const head = { ...localBase, files: describe(collectFiles(folder)) };
  if (restored) { head.restoredFromSnapshotId = 'e'.repeat(16); }
  const online = { status: 'ONLINE', version: '1.2.0', sourceSnapshotId: head.restoredFromSnapshotId ?? head.sourceSnapshotId,
    codeWorkspaceBuildId: testSelection.codeWorkspaceBuildId };
  const api = {
    app: jest.fn(getAppTag), baseUrl: 'https://example.test', multipart: jest.fn(),
    get: jest.fn().mockResolvedValueOnce({ maxSourceFileCount: 100, maxSourceSnapshotBytes: 65536 }).mockResolvedValueOnce(head),
    version: jest.fn().mockRejectedValueOnce(Object.assign(new Error('Test not saved'), { code: 'CODE_WORKSPACE_TEST_BUILD_REQUIRED' }))
      .mockResolvedValueOnce([online]),
  };
  await expect(execute(syncOptions(), api)).resolves.toMatchObject({ appVersion: online.version, testSource: 'online',
    sourceChanged: false, buildUploaded: false, testBindingUpdated: false, published: false,
    testUrl: 'https://example.test/APP_WORKSPACE/workspace' });
  expect(api.version.mock.calls).toEqual([['getWorkspaceDraft'], ['listVersions']]);
  expect(api.multipart).not.toHaveBeenCalled();
});
