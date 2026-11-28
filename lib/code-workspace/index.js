'use strict';

const fs = require('fs');
const path = require('path');
const { createWorkspaceApi } = require('./api');
const { sha256, safePath, fail, collectFiles, describe, verify, readRecipe, readState, writeState } = require('./files');

const ACTIONS = ['limits', 'current', 'pull', 'check', 'push', 'register', 'save-test-draft', 'publish', 'restore', 'bind', 'start-test'];
function parseArgs(args) {
  const [action, appType, ...rest] = args;
  if (!ACTIONS.includes(action) || !/^[A-Za-z0-9_-]+$/.test(appType || '')) {
    fail('Usage: openyida code-workspace <limits|current|pull|check|push|register|save-test-draft|publish|restore|bind|start-test> <appType> [directory] [options]');
  }
  const options = { action, appType };
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === '--create-canvas') {
      if (action !== 'bind') { fail('--create-canvas is only supported by bind'); }
      options['create-canvas'] = true;
      continue;
    } else if (token === '--json') {
      continue;
    }
    if (['--expected-revision', '--snapshot', '--build-dir', '--draft-version', '--publish-id', '--form-uuid', '--canvas-node-id', '--entry'].includes(token)) {
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
  if (!['limits', 'current', 'start-test'].includes(action) && !options.directory) {
    fail('A local workspace directory is required');
  }
  if (options['expected-revision'] !== undefined && !/^(0|[1-9][0-9]*)$/.test(options['expected-revision'])) {
    fail('expected-revision must be a nonnegative integer');
  }
  if (['publish', 'save-test-draft'].includes(action) && (!options['draft-version'] || !options['publish-id'])) {
    fail(action + ' requires --draft-version and a stable --publish-id');
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
async function execute(options, api) {
  const { action, appType, directory } = options;
  if (['limits', 'current'].includes(action)) {
    return api.get(action);
  }
  if (action === 'start-test') {
    if (!api.currentUserId) { fail('Current user identity is required to enter the app test version'); }
    const active = await api.version('hasActiveTestVersion');
    const previewUrl = active ? undefined : await api.version('createTestVersion');
    await api.version('addTestParticipants', { userIds: api.currentUserId });
    const status = await api.version('getTestEnvironmentStatus');
    return { previewUrl, ...status, testParticipantAdded: true, published: false };
  }
  if (action === 'pull') {
    if (fs.existsSync(directory)) {
      fail('pull requires a new output directory; existing work is never overwritten');
    }
    const snapshot = options.snapshot ? await api.get('snapshot', { targetSnapshotId: options.snapshot }) : await api.get('current');
    if (!snapshot) {
      fail('No source snapshot exists');
    }
    for (const name of Object.keys(snapshot.files)) {
      safePath(name);
      if (name.split('/').some(part => ['.git', '.openyida'].includes(part))) {fail('Snapshot uses a reserved local state path');}
    }
    const { readSourceArchive } = require('./archive');
    const archive = readSourceArchive(await api.downloadArchive(snapshot.sourceSnapshotId), snapshot);
    const downloaded = archive.files;
    const head = await api.get('current');
    const baseRevision = head?.sourceSnapshotId === snapshot.sourceSnapshotId ? head.revision : null;
    // Read and verify the entire snapshot before creating any output.
    fs.mkdirSync(directory, { recursive: false });
    for (const [name, bytes] of Object.entries(downloaded)) {
      fs.mkdirSync(path.dirname(path.join(directory, name)), { recursive: true });
      fs.writeFileSync(path.join(directory, name), bytes, { flag: 'wx' });
    }
    writeState(directory, { ...snapshot, appType, revision: baseRevision, files: snapshot.files, recipe: archive.recipe });
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
    const limits = await api.get('limits');
    enforceLimits(files, limits);
    const head = await api.get('current');
    if ((head?.revision ?? 0) !== expectedRevision) {
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
    writeState(directory, { ...result, appType, files: describe(files), recipe });
    return { ...result, sourceReadbackVerified: true, appliedFiles: changed.length, deletedFiles: deleted.length, published: false };
  }
  if (!state || Object.entries(files).some(([name, bytes]) => state.files[name]?.sha256 !== sha256(bytes)) ||
      Object.keys(files).length !== Object.keys(state.files).length) {
    fail('Apply all local changes with push before registering or publishing');
  }
  if (action === 'register') {
    const buildRoot = path.resolve(options['build-dir']);
    const output = collectFiles(buildRoot);
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
    return { ...result, published: false };
  }
  if (action === 'publish' || action === 'save-test-draft') {
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
    if (action === 'save-test-draft') {return { ...saved, testDraftReadbackVerified: true, published: false, runtimeVerified: false };}
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
