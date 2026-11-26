'use strict';

const fs = require('fs');
const path = require('path');
const { createWorkspaceApi } = require('./api');
const { sha256, safePath, fail, collectFiles, describe, verify, readRecipe, readState, writeState } = require('./files');
const { APP_TAG, ABI, compileWorkspace, requireWorkspaceRecipe, previewUrl, testUrl, workspaceUrl, pinnedTest } = require('./workspace-app');
const { readWorkspaceTemplate } = require('./workspace-template');

const ACTIONS = ['limits', 'current', 'pull', 'check', 'push', 'register', 'publish', 'restore', 'bind', 'start-test',
  'build', 'save-test', 'publish-tested'];
function parseArgs(args) {
  const [action, appType, ...rest] = args;
  if (!ACTIONS.includes(action) || !/^[A-Za-z0-9_-]+$/.test(appType || '')) {
    fail('Usage: openyida code-workspace <' + ACTIONS.join('|') + '> <appType> [directory] [options]');
  }
  const options = { action, appType };
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === '--create-canvas') {
      if (action !== 'bind') { fail('--create-canvas is only supported by bind'); }
      options['create-canvas'] = true;
      continue;
    } else if (token === '--workspace') {
      if (action !== 'start-test') { fail('--workspace is only supported by start-test'); }
      options.workspace = true;
      continue;
    } else if (token === '--init-if-empty') {
      if (action !== 'pull') { fail('--init-if-empty is only supported by pull'); }
      options['init-if-empty'] = true;
      continue;
    } else if (token === '--json') {
      continue;
    }
    if (['--expected-revision', '--snapshot', '--build-dir', '--draft-version', '--publish-id', '--form-uuid', '--canvas-node-id', '--entry', '--build-id', '--confirmation-token-file'].includes(token)) {
      if (!rest[i + 1] || rest[i + 1].startsWith('--')) {
        fail('Missing value: ' + token);
      }
      options[token.slice(2)] = rest[++i];
    } else if (!token.startsWith('-') && !options.directory) {
      options.directory = path.resolve(token);
    } else {
      fail('Unexpected argument: ' + token);
    }
  }
  if (!['limits', 'current', 'start-test', 'publish-tested'].includes(action) && !options.directory) {
    fail('A local workspace directory is required');
  }
  if (options['expected-revision'] !== undefined && !/^(0|[1-9][0-9]*)$/.test(options['expected-revision'])) {
    fail('expected-revision must be a nonnegative integer');
  }
  if (['publish', 'save-test', 'publish-tested'].includes(action) &&
      (!options['draft-version'] || !options['publish-id'])) {
    fail(action + ' requires --draft-version and a stable --publish-id');
  }
  if (action === 'publish-tested' && (options.directory || !/^[a-f0-9]{32}$/.test(options['build-id'] || '') ||
      !options['confirmation-token-file'])) {
    fail('publish-tested requires --build-id and --confirmation-token-file');
  }
  if (options['init-if-empty'] && options.snapshot) {
    fail('--init-if-empty cannot be combined with --snapshot');
  }
  if (action === 'register' && !options['build-dir']) {
    fail('register requires --build-dir containing runtime.manifest.json and files/');
  }
  if (action === 'restore' && !options.snapshot) {
    fail('restore requires --snapshot');
  }
  if (action === 'bind' && (!/^FORM-[A-Za-z0-9_-]+$/.test(options['form-uuid'] || '') ||
      !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(options.entry || ''))) {
    fail('bind requires --form-uuid and --entry');
  }
  return options;
}
function enforceLimits(files, limits) {
  const values = Object.values(files);
  const totalBytes = values.reduce((sum, bytes) => sum + bytes.length, 0);
  if (values.length > limits.maxSourceFileCount || totalBytes > limits.maxSourceSnapshotBytes) {
    fail('Workspace exceeds the server source capacity', 'CODE_WORKSPACE_CAPACITY_EXCEEDED');
  }
}
function writePulledFiles(directory, files) {
  fs.mkdirSync(directory, { recursive: false });
  for (const [name, bytes] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(directory, name)), { recursive: true });
    fs.writeFileSync(path.join(directory, name), bytes, { flag: 'wx' });
  }
}

async function requireWorkspaceApp(api) {
  const app = await api.app();
  if (app.appTag !== APP_TAG) {
    fail('Operation requires a WORKSPACE application', 'CODE_WORKSPACE_WRONG_APP_TAG');
  }
  return app;
}

async function assertCurrentWorkspace(api, state, files) {
  const head = await api.get('current');
  if (head?.sourceSnapshotId !== state.sourceSnapshotId || head?.workspaceId !== state.workspaceId ||
      head?.revision !== state.revision ||
      head.sourceManifestSha256 !== state.sourceManifestSha256 || head.buildRecipeSha256 !== state.buildRecipeSha256 ||
      !head.files || Object.keys(files).length !== Object.keys(head.files).length ||
      Object.entries(files).some(([name, bytes]) => head.files[name]?.sha256 !== sha256(bytes))) {
    fail('Source draft changed; pull current into a new directory and compare before continuing.',
      'CODE_WORKSPACE_DRAFT_CONFLICT');
  }
}

function selectionIdentity(options, buildId) {
  return { codeWorkspaceBuildId: buildId, codeWorkspacePublishId: options['publish-id'],
    codeWorkspaceDraftVersion: options['draft-version'] };
}

async function verifySavedTest(api, identity) {
  const saved = await api.version('getWorkspaceDraft');
  if (!saved?.sourceSnapshotId || !saved.workspaceId ||
      Object.entries(identity).some(([key, value]) => saved[key] !== value)) {
    fail('Test-version build readback mismatch', 'CODE_WORKSPACE_READBACK_FAILED');
  }
  return saved;
}

async function publishTested(options, api) {
  await requireWorkspaceApp(api);
  const stat = fs.statSync(options['confirmation-token-file']);
  if (!stat.isFile() || stat.size < 1 || stat.size > 8192) {
    fail('Invalid workspace publish confirmation file');
  }
  const token = fs.readFileSync(options['confirmation-token-file'], 'utf8').trim();
  if (!token || /\s/.test(token)) {
    fail('Invalid workspace publish confirmation token');
  }
  const identity = selectionIdentity(options, options['build-id']);
  const saved = await verifySavedTest(api, identity);
  const appVersion = await api.version('publishDraft', { ...identity, codeWorkspaceConfirmationToken: token });
  if (typeof appVersion !== 'string' || !appVersion) {
    fail('Publish response did not include the live version', 'CODE_WORKSPACE_READBACK_FAILED');
  }
  return { appVersion, publishId: identity.codeWorkspacePublishId, buildId: identity.codeWorkspaceBuildId,
    sourceSnapshotId: saved.sourceSnapshotId, status: await api.version('getPublishStatus'),
    appUrl: workspaceUrl(api.baseUrl, options.appType),
    published: true, runtimeVerified: false };
}

async function execute(options, api) {
  const { action, appType, directory } = options;
  if (['limits', 'current'].includes(action)) {
    return api.get(action);
  }
  if (action === 'publish-tested') {
    return publishTested(options, api);
  }
  if (action === 'start-test') {
    if (!api.currentUserId) { fail('Current user identity is required to enter the app test version'); }
    if (options.workspace) {
      await requireWorkspaceApp(api);
    }
    const active = await api.version('hasActiveTestVersion');
    const previewUrl = active ? undefined : await api.version('createTestVersion');
    await api.version('addTestParticipants', { userIds: api.currentUserId });
    if (options.workspace) {
      const draftVersion = pinnedTest(appType, previewUrl ?? await api.version('getPreviewUrl'));
      return { draftVersion, previewUrl: testUrl(api, appType, draftVersion), testParticipantAdded: true, published: false };
    }
    const status = await api.version('getTestEnvironmentStatus');
    return { previewUrl, ...status, testParticipantAdded: true, published: false };
  }
  if (action === 'pull') {
    if (fs.existsSync(directory)) {
      fail('pull requires a new output directory; existing work is never overwritten');
    }
    if (options['init-if-empty']) {
      await requireWorkspaceApp(api);
    }
    let snapshot = options.snapshot ? await api.get('snapshot', { targetSnapshotId: options.snapshot }) : await api.get('current');
    if (snapshot === null && options['init-if-empty']) {
      const template = readWorkspaceTemplate();
      snapshot = await api.get('current');
      if (snapshot === null) {
        writePulledFiles(directory, template.files);
        return { appType, initialized: true, templateVersion: template.version,
          expectedRevision: 0, fileCount: Object.keys(template.files).length };
      }
    }
    if (!snapshot) {
      fail('No source snapshot exists');
    }
    const downloaded = Object.create(null);
    for (const [name, descriptor] of Object.entries(snapshot.files)) {
      safePath(name);
      if (name.split('/').some(part => ['.git', '.openyida'].includes(part))) {
        fail('Snapshot uses a reserved local state path');
      }
      const bytes = await api.download(snapshot.sourceSnapshotId, name, descriptor.size);
      verify(bytes, descriptor);
      downloaded[name] = bytes;
    }
    // Verify the entire snapshot and editing base before creating any output.
    const head = await api.get('current');
    writePulledFiles(directory, downloaded);
    const baseRevision = head?.sourceSnapshotId === snapshot.sourceSnapshotId ? head.revision : null;
    writeState(directory, { ...snapshot, appType, revision: baseRevision, files: snapshot.files });
    return { appType, sourceSnapshotId: snapshot.sourceSnapshotId, revision: baseRevision, fileCount: Object.keys(downloaded).length,
      note: baseRevision === null ? 'Historical export: repull current before pushing.' : undefined };
  }
  if (action === 'restore') {
    const state = readState(directory, appType);
    const expectedRevision = Number(options['expected-revision'] ?? state?.revision);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || (!state && options['expected-revision'] === undefined)) {
      fail('A valid base revision is required to restore');
    }
    const result = await api.post('restoreDraft', { expectedRevision, targetSnapshotId: options.snapshot });
    return { ...result, localFilesUpdated: false, published: false, next: 'Pull into a new directory before editing or pushing.' };
  }
  const files = collectFiles(directory);
  const recipe = readRecipe(directory, files);
  if (action === 'check') {
    return { valid: true, fileCount: Object.keys(files).length, totalBytes: Object.values(files).reduce((sum, bytes) => sum + bytes.length, 0),
      entries: recipe.entries, compilationVerified: false };
  }
  const state = readState(directory, appType);
  if (action === 'bind') {
    if (!state || !Object.hasOwn(recipe.entries, options.entry)) { fail('Pull the current workspace and select a declared entry'); }
    const head = await api.get('current');
    if (head?.sourceSnapshotId !== state.sourceSnapshotId || head?.workspaceId !== state.workspaceId ||
        Object.keys(files).length !== Object.keys(state.files).length ||
        Object.entries(files).some(([name, bytes]) => state.files[name]?.sha256 !== sha256(bytes))) {
      fail('Push local changes or repull the current workspace before binding');
    }
    const { bindPage } = require('./page-binding');
    await api.enterTest();
    const remote = await api.readPage(options['form-uuid']);
    const bound = bindPage(remote.schema, options, state.workspaceId);
    await api.savePage(options['form-uuid'], bound.schema, remote.revision);
    const readback = await api.readPage(options['form-uuid']);
    const verified = bindPage(readback.schema, { ...options, 'create-canvas': false, 'canvas-node-id': bound.canvasNodeId }, state.workspaceId);
    if (JSON.stringify(readback.schema) !== JSON.stringify(verified.schema)) { fail('Page binding readback mismatch'); }
    return { appType, formUuid: options['form-uuid'], canvasNodeId: bound.canvasNodeId,
      codeBundle: bound.binding, pageBindingReadbackVerified: true, published: false, runtimeVerified: false };
  }
  const expectedRevision = Number(options['expected-revision'] ?? state?.revision);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || (!state && options['expected-revision'] === undefined)) {
    fail('Use a pulled current workspace or provide --expected-revision explicitly');
  }
  if (action === 'push') {
    if (recipe.runtimeAbi === ABI) {
      await requireWorkspaceApp(api);
      requireWorkspaceRecipe(recipe);
      if (expectedRevision !== (state?.revision ?? 0)) {
        fail('The local WORKSPACE base changed. Pull current into a new directory and compare before submitting.',
          'CODE_WORKSPACE_DRAFT_CONFLICT');
      }
    }
    const limits = await api.get('limits');
    enforceLimits(files, limits);
    const head = await api.get('current');
    if ((head?.revision ?? 0) !== expectedRevision ||
        (recipe.runtimeAbi === ABI && state && (state.sourceSnapshotId !== head?.sourceSnapshotId || state.workspaceId !== head?.workspaceId))) {
      fail('Source draft changed; pull and compare before applying', 'CODE_WORKSPACE_DRAFT_CONFLICT');
    }
    const previous = state && state.sourceSnapshotId === head?.sourceSnapshotId && state.revision === expectedRevision ? state.files : null;
    const changed = Object.entries(files).filter(([name, bytes]) => !previous || previous[name]?.sha256 !== sha256(bytes));
    const deleted = previous ? Object.keys(previous).filter(name => !Object.hasOwn(files, name)) : [];
    if (previous && !changed.length && !deleted.length) {
      return { ...head, unchanged: true, appliedFiles: 0, deletedFiles: 0, published: false };
    }
    const payload = { ...recipe, entries: JSON.stringify(recipe.entries), expectedRevision,
      path: changed.map(([name]) => name), ...(previous ? { deletedPath: deleted } : {}) };
    let result;
    try {
      result = await api.multipart(previous ? 'savePatch' : 'saveDraft', payload, {
        files: changed.map(([name, content]) => ({ fileName: path.posix.basename(name), content })),
      });
    } catch (error) {
      if (recipe.runtimeAbi === ABI && error.code === 'CODE_WORKSPACE_DRAFT_CONFLICT') {
        throw error;
      }
      // A lost response can follow a committed write. Reconcile once, without resubmitting or
      // accepting a later/unrelated revision; project.json bytes also freeze the build recipe.
      const saved = await api.get('current').catch(() => null);
      if (!saved || saved.revision !== expectedRevision + 1 || !saved.sourceSnapshotId ||
          (head && (saved.workspaceId !== head.workspaceId || saved.sourceSnapshotId === head.sourceSnapshotId)) ||
          Object.keys(saved.files || {}).length !== Object.keys(files).length ||
          Object.entries(files).some(([name, bytes]) => saved.files[name]?.size !== bytes.length || saved.files[name]?.sha256 !== sha256(bytes))) {
        throw error;
      }
      result = { ...saved, responseRecovered: true };
    }
    const readback = await api.get('snapshot', { targetSnapshotId: result.sourceSnapshotId });
    if (!readback || readback.workspaceId !== result.workspaceId || readback.sourceSnapshotId !== result.sourceSnapshotId) {
      fail('Saved source identity mismatch', 'CODE_WORKSPACE_READBACK_FAILED');
    }
    if (JSON.stringify(describe(files)) !== JSON.stringify(readback.files)) {
      // Compare independent of map insertion order.
      const actual = readback.files;
      if (Object.keys(actual).length !== Object.keys(files).length || Object.entries(files).some(([name, bytes]) =>
        actual[name]?.size !== bytes.length || actual[name]?.sha256 !== sha256(bytes))) {
        fail('Saved source readback mismatch', 'CODE_WORKSPACE_READBACK_FAILED');
      }
    }
    writeState(directory, { ...result, appType, files: describe(files) });
    return { ...result, sourceReadbackVerified: true, appliedFiles: changed.length, deletedFiles: deleted.length, published: false };
  }
  if (!state || Object.entries(files).some(([name, bytes]) => state.files[name]?.sha256 !== sha256(bytes)) ||
      Object.keys(files).length !== Object.keys(state.files).length) {
    fail('Apply all local changes with push before registering or publishing');
  }
  if (action === 'build' || action === 'register') {
    if (action === 'build') {
      await requireWorkspaceApp(api);
      await assertCurrentWorkspace(api, state, files);
    }
    const output = action === 'build' ? await compileWorkspace(files, recipe, state)
      : collectFiles(path.resolve(options['build-dir']));
    if (!output['runtime.manifest.json']) {
      fail('Missing runtime.manifest.json');
    }
    const manifest = JSON.parse(output['runtime.manifest.json'].toString('utf8'));
    if (manifest.formatVersion !== 2 || manifest.workspaceId !== state.workspaceId || manifest.sourceSnapshotId !== state.sourceSnapshotId ||
        manifest.runtimeAbi !== recipe.runtimeAbi || !/^[a-f0-9]{32}$/.test(manifest.buildId)) {
      fail('Build does not match the applied workspace');
    }
    const upload = [];
    const paths = [];
    const seen = new Set();
    for (const descriptor of manifest.files) {
      safePath(descriptor.path);
      if (seen.has(descriptor.path)) {
        fail('Duplicate runtime output path');
      }
      seen.add(descriptor.path);
      const content = output['files/' + descriptor.path];
      if (!content) {
        fail('Missing runtime output: ' + descriptor.path);
      }
      verify(content, descriptor);
      paths.push(descriptor.path);
      upload.push({ fileName: path.posix.basename(descriptor.path), content });
    }
    const result = await api.multipart('registerBuild', {
      uploadAttempt: manifest.buildId, sourceManifestSha256: state.sourceManifestSha256,
      buildRecipeSha256: state.buildRecipeSha256, path: paths,
    }, { runtimeManifest: { fileName: 'runtime.manifest.json', content: output['runtime.manifest.json'], contentType: 'application/json' }, files: upload });
    if (result.buildId !== manifest.buildId || result.sourceSnapshotId !== state.sourceSnapshotId || result.workspaceId !== state.workspaceId) {
      fail('Registered build identity mismatch');
    }
    writeState(directory, { ...state, build: result });
    return { ...result, ...(action === 'build' ? { compilationVerified: true,
      previewUrl: previewUrl(api, appType, state, result.buildId) } : {}), published: false, runtimeVerified: false };
  }
  if (action === 'save-test') {
    await requireWorkspaceApp(api);
    requireWorkspaceRecipe(recipe);
    if (!state.build || state.build.sourceSnapshotId !== state.sourceSnapshotId) {
      fail('Register a matching build before saving a test version');
    }
    await assertCurrentWorkspace(api, state, files);
    const selection = { ...selectionIdentity(options, state.build.buildId), sourceSnapshotId: state.sourceSnapshotId };
    await api.version('saveWorkspaceDraft', selection);
    const saved = await verifySavedTest(api, { ...selection, workspaceId: state.workspaceId });
    return { ...saved, testUrl: testUrl(api, appType, selection.codeWorkspaceDraftVersion),
      testReadbackVerified: true, published: false, runtimeVerified: false };
  }
  if (action === 'publish') {
    if (recipe.runtimeAbi === ABI) {
      fail('WORKSPACE publication requires save-test followed by publish-tested with human confirmation');
    }
    if (!state.build || state.build.sourceSnapshotId !== state.sourceSnapshotId) {
      fail('Register a matching build before publishing');
    }
    await api.enterTest();
    await api.version('startTest');
    const selection = { codeWorkspaceBuildId: state.build.buildId, sourceSnapshotId: state.sourceSnapshotId,
      codeWorkspacePublishId: options['publish-id'], codeWorkspaceDraftVersion: options['draft-version'] };
    await api.version('saveWorkspaceDraft', selection);
    const saved = await api.version('getWorkspaceDraft');
    if (saved?.workspaceId !== state.workspaceId || Object.entries(selection).some(([key, value]) => saved[key] !== value)) {
      fail('Test-version build readback mismatch', 'CODE_WORKSPACE_READBACK_FAILED');
    }
    const version = await api.version('publishDraft', { codeWorkspaceBuildId: state.build.buildId,
      codeWorkspacePublishId: options['publish-id'], codeWorkspaceDraftVersion: options['draft-version'] });
    const status = await api.version('getPublishStatus');
    return { appVersion: version, publishId: options['publish-id'], buildId: state.build.buildId,
      sourceSnapshotId: state.sourceSnapshotId, status, runtimeVerified: false };
  }
  fail('Unsupported workspace action');
}
async function run(args) {
  const options = parseArgs(args);
  const api = options.action === 'check' ? null : createWorkspaceApi(options.appType);
  const result = await execute(options, api);
  console.log(JSON.stringify(result, null, 2));
  return result;
}
module.exports = { run, execute, parseArgs, enforceLimits };
