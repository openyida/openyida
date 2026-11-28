'use strict';

const { unzipSync } = require('fflate');
const { safePath, verify, fail, sha256 } = require('./files');

/** The server ZIP contains one workspace.json and files/<source path> from one frozen manifest. */
function readSourceArchive(bytes, snapshot) {
  let total = 0;
  const names = new Set();
  const decoded = unzipSync(bytes, { filter: entry => {
    if (names.has(entry.name) || names.size >= 1001) {fail('Duplicate or excessive archive entries');}
    names.add(entry.name);
    if (entry.name !== 'workspace.json') {
      if (!entry.name.startsWith('files/')) {fail('Unexpected source archive entry');}
      const name = safePath(entry.name.slice(6));
      if (name.split('/').some(part => ['.git', '.openyida'].includes(part))) {fail('Snapshot uses a reserved local state path');}
      if (!Object.hasOwn(snapshot.files, name)) {fail('Archive file is outside the snapshot');}
      if (entry.originalSize !== snapshot.files[name].size) {fail('Archive source size mismatch');}
    } else if (entry.originalSize > 4 * 1024 * 1024) {fail('Archive metadata is too large');}
    total += entry.originalSize;
    if (!Number.isSafeInteger(total) || total > 68 * 1024 * 1024) {fail('Source archive is too large');}
    return true;
  } });
  if (!decoded['workspace.json']) {fail('Source archive metadata is missing');}
  const metadata = JSON.parse(Buffer.from(decoded['workspace.json']).toString('utf8'));
  if (metadata.formatVersion !== 1 || ['workspaceId', 'sourceSnapshotId', 'sourceManifestSha256', 'buildRecipeSha256']
    .some(key => metadata[key] !== snapshot[key])) {fail('Source archive identity mismatch');}
  const files = Object.create(null);
  for (const [name, descriptor] of Object.entries(snapshot.files)) {
    const content = decoded['files/' + name];
    if (!content || metadata.files?.[name]?.size !== descriptor.size || metadata.files?.[name]?.sha256 !== descriptor.sha256) {
      fail('Source archive manifest mismatch');
    }
    verify(content, descriptor);
    files[name] = Buffer.from(content);
    // Reject file/directory collisions before creating any output.
    const parts = name.split('/');
    while (parts.length > 1) {
      parts.pop();
      if (Object.hasOwn(snapshot.files, parts.join('/'))) {fail('Conflicting archive source paths');}
    }
  }
  if (Object.keys(metadata.files || {}).length !== Object.keys(files).length) {fail('Source archive manifest mismatch');}
  const recipe = metadata.buildRecipe;
  if (!recipe || ['toolchainRef', 'lockfilePath', 'lockfileHash', 'runtimeAbi'].some(key => typeof recipe[key] !== 'string' || !recipe[key])) {
    fail('Source archive build recipe is missing');
  }
  const frozen = { toolchainRef: recipe.toolchainRef, lockfilePath: recipe.lockfilePath,
    lockfileHash: recipe.lockfileHash, runtimeAbi: recipe.runtimeAbi };
  if (sha256(Buffer.from(JSON.stringify(frozen))) !== snapshot.buildRecipeSha256) {fail('Source archive build recipe mismatch');}
  return { files, recipe: { ...frozen, entries: metadata.entries } };
}
module.exports = { readSourceArchive };
