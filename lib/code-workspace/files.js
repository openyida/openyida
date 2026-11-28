'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { CliError } = require('../core/cli-error');

const STATE = '.openyida/workspace.json';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function fail(message, code = 'CODE_WORKSPACE_INVALID_INPUT') {
  throw new CliError(message, { code });
}
function safePath(value) {
  if (typeof value !== 'string' || !value || value.startsWith('/') ||
      /[\\:%?#]/.test(value) || Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
      value.split('/').some(part => !part || part === '.' || part === '..')) {
    fail('Invalid workspace path: ' + value);
  }
  return value;
}
function collectFiles(directory) {
  const root = path.resolve(directory);
  if (fs.lstatSync(root).isSymbolicLink()) {
    fail('Workspace directory cannot be a symbolic link');
  }
  const files = Object.create(null);
  function walk(relative) {
    const folder = path.join(root, relative);
    for (const entry of fs.readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (['.git', '.openyida', '.cache', 'node_modules', 'dist', '.env', '.npmrc', '.yarnrc', '.DS_Store'].includes(entry.name) || entry.name.startsWith('.env.')) {
        continue;
      }
      const name = relative ? relative + '/' + entry.name : entry.name;
      safePath(name);
      if (entry.isSymbolicLink()) {
        fail('Workspace cannot contain symbolic links: ' + name);
      }
      if (entry.isDirectory()) {
        walk(name);
      } else if (entry.isFile()) {
        files[name] = fs.readFileSync(path.join(root, name));
      } else {
        fail('Unsupported workspace file: ' + name);
      }
    }
  }
  walk('');
  return files;
}
function describe(files) {
  return Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, { size: bytes.length, sha256: sha256(bytes) }]));
}
function verify(bytes, descriptor) {
  if (!descriptor || !Number.isSafeInteger(descriptor.size) || descriptor.size < 0 ||
      !/^[a-f0-9]{64}$/.test(descriptor.sha256) || bytes.length !== descriptor.size || sha256(bytes) !== descriptor.sha256) {
    fail('Source file does not match its frozen snapshot', 'CODE_WORKSPACE_INTEGRITY_ERROR');
  }
}
function readRecipe(directory, files) {
  const stateFile = path.join(directory, STATE);
  if (!files['project.json'] && fs.existsSync(stateFile) &&
      (fs.lstatSync(path.dirname(stateFile)).isSymbolicLink() || fs.lstatSync(stateFile).isSymbolicLink())) {
    fail('Workspace state cannot be a symbolic link');
  }
  const recipe = files['project.json'] ? JSON.parse(files['project.json'].toString('utf8'))
    : fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')).recipe : null;
  if (!recipe) {fail('project.json or a pulled server build recipe is required');}
  for (const key of ['toolchainRef', 'lockfilePath', 'lockfileHash', 'runtimeAbi']) {
    if (typeof recipe[key] !== 'string' || !recipe[key]) {
      fail('Missing project.json field: ' + key);
    }
  }
  safePath(recipe.lockfilePath);
  if (!files[recipe.lockfilePath]) {
    fail('Lockfile is missing');
  }
  const lockHash = sha256(files[recipe.lockfilePath]);
  if (!files['project.json']) {recipe.lockfileHash = lockHash;}
  if (lockHash !== recipe.lockfileHash) {
    fail('Lockfile hash does not match the local file');
  }
  if (!recipe.entries || typeof recipe.entries !== 'object' || Array.isArray(recipe.entries) || !Object.keys(recipe.entries).length) {
    fail('project.json entries must map entry IDs to source paths');
  }
  const ids = new Set();
  for (const [id, entry] of Object.entries(recipe.entries)) {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(id) || ids.has(id.toLowerCase())) {
      fail('Invalid or duplicate entry ID: ' + id);
    }
    ids.add(id.toLowerCase());
    safePath(entry);
    if (!files[entry] || !/\.(js|jsx|ts|tsx)$/.test(entry)) {
      fail('Entry source is missing: ' + entry);
    }
  }
  return { toolchainRef: recipe.toolchainRef, lockfilePath: recipe.lockfilePath,
    lockfileHash: recipe.lockfileHash, runtimeAbi: recipe.runtimeAbi, entries: recipe.entries };
}
function readState(directory, appType) {
  const file = path.join(directory, STATE);
  if (!fs.existsSync(file)) {
    return null;
  }
  if (fs.lstatSync(path.dirname(file)).isSymbolicLink() || fs.lstatSync(file).isSymbolicLink()) {
    fail('Workspace state cannot be a symbolic link');
  }
  const state = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (state.appType !== appType || !Number.isSafeInteger(state.revision) || state.revision < 0) {
    fail('Local workspace state belongs to another application or is invalid');
  }
  return state;
}
function writeState(directory, state) {
  const folder = path.join(directory, '.openyida');
  fs.mkdirSync(folder, { recursive: true });
  if (fs.lstatSync(folder).isSymbolicLink()) {
    fail('Workspace state cannot be a symbolic link');
  }
  const target = path.join(directory, STATE);
  const temporary = target + '.' + crypto.randomUUID() + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(state, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  fs.renameSync(temporary, target);
}
module.exports = { STATE, sha256, safePath, fail, collectFiles, describe, verify, readRecipe, readState, writeState };
