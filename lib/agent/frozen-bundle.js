'use strict';

const fs = require('fs');
const path = require('path');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { digest, readRegularFile } = require('./runtime-package');
const { parseStrictJson } = require('./runtime-manifest');

const MAX_FILE_BYTES = 256 * 1024 * 1024;
const MAX_BUNDLE_BYTES = 1024 * 1024 * 1024;
const MAX_FILES = 30000;
const MAX_BUNDLE_MANIFEST_BYTES = 16 * 1024 * 1024;
const PACKAGE_NAME = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i;

// Retry only transient Windows publication locks; never remove a winner.
function publishBundle(stage, root) {
  const delays = [20, 40, 80, 160, 320];
  for (let attempt = 0; ; attempt++) {
    try {fs.renameSync(stage, root); return;} catch (error) {
      if (process.platform !== 'win32' || attempt === delays.length ||
          !['EBUSY', 'EPERM', 'EACCES'].includes(error.code) || fs.existsSync(root)) {throw error;}
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delays[attempt]);
    }
  }
}

function bundleError(code = 'AGENT_BUNDLE_INVALID') {return new CliError(t('agent.bundle_invalid'), { code });}
function slash(value) {return value.split(path.sep).join('/');}

function privateDirectory(directory) {
  if (!path.isAbsolute(directory)) {throw bundleError();}
  // Canonicalize an existing ancestor before creating anything. Verify every
  // canonical parent against replacement by other OS users. A root-owned
  // sticky temp directory is acceptable; our descendants must be private.
  const suffix = [];
  let ancestor = directory;
  while (!fs.existsSync(ancestor)) {suffix.unshift(path.basename(ancestor)); ancestor = path.dirname(ancestor);}
  if (fs.lstatSync(ancestor).isSymbolicLink()) {throw bundleError();}
  let current = fs.realpathSync(ancestor);
  const uid = typeof process.getuid === 'function' ? process.getuid() : null;
  for (let parent = current; ; parent = path.dirname(parent)) {
    const stat = fs.lstatSync(parent);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {throw bundleError();}
    if (process.platform !== 'win32' && ((stat.uid !== uid && stat.uid !== 0) ||
        (stat.mode & 0o022) && !(stat.uid === 0 && stat.mode & 0o1000))) {throw bundleError('AGENT_BUNDLE_UNSAFE_DIRECTORY');}
    if (parent === path.dirname(parent)) {break;}
  }
  for (const component of suffix) {
    current = path.join(current, component);
    try {fs.mkdirSync(current, { mode: 0o700 });} catch (error) {if (error.code !== 'EEXIST') {throw error;}}
    const stat = fs.lstatSync(current);
    if (!stat.isDirectory() || stat.isSymbolicLink() || process.platform !== 'win32' && (stat.uid !== uid || stat.mode & 0o077)) {throw bundleError('AGENT_BUNDLE_UNSAFE_DIRECTORY');}
  }
  const final = fs.lstatSync(current);
  if (process.platform !== 'win32' && (final.uid !== uid || final.mode & 0o077)) {throw bundleError('AGENT_BUNDLE_UNSAFE_DIRECTORY');}
  return current;
}

function packageMetadata(root) {
  return parseStrictJson(readRegularFile(path.join(root, 'package.json'), 1024 * 1024).bytes, 1024 * 1024);
}

function findDependency(root, name) {
  if (!PACKAGE_NAME.test(name) || name.startsWith('.') || name.includes('..')) {throw bundleError();}
  // Match normal node_modules ancestor resolution, without NODE_PATH, cwd, an
  // npm subprocess, or an install hook. Preserve each package's own resolution.
  for (let current = root; ; current = path.dirname(current)) {
    const candidate = path.join(current, 'node_modules', name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) {return fs.realpathSync(candidate);}
    if (current === path.dirname(current)) {return null;}
  }
}

function walkFiles(root, visit, relative = '') {
  const entries = fs.readdirSync(path.join(root, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'));
  for (const entry of entries) {
    const next = path.join(relative, entry.name);
    const stat = fs.lstatSync(path.join(root, next));
    if (stat.isSymbolicLink() || !stat.isDirectory() && !stat.isFile()) {throw bundleError();}
    if (stat.isDirectory()) {walkFiles(root, visit, next);} else {visit(slash(next), stat);}
  }
}

function makeWritable(directory) {
  if (!fs.existsSync(directory)) {return;}
  fs.chmodSync(directory, 0o700);
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.isSymbolicLink()) {makeWritable(path.join(directory, entry.name));}
  }
}

function sealDirectories(directory, sealRoot = true) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {sealDirectories(path.join(directory, entry.name));}
  }
  if (sealRoot) {fs.chmodSync(directory, 0o500);}
}

function verifyBundle(root, expectedId) {
  try {
    if (fs.lstatSync(root).isSymbolicLink()) {throw bundleError();}
    const raw = readRegularFile(path.join(root, 'bundle-manifest.json'), MAX_BUNDLE_MANIFEST_BYTES).bytes;
    if (digest(raw) !== expectedId) {throw bundleError();}
    const manifest = parseStrictJson(raw, MAX_BUNDLE_MANIFEST_BYTES);
    if (manifest.schemaVersion !== 1 || manifest.product !== 'openyida-local-agent-bundle' || !Array.isArray(manifest.files) || manifest.files.length > MAX_FILES) {throw bundleError();}
    const files = new Map();
    for (const file of manifest.files) {
      if (typeof file.path !== 'string' || file.path.startsWith('/') || file.path.includes('\\') ||
          file.path.split('/').some((part) => !part || part === '.' || part === '..') || files.has(file.path) ||
          !Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_FILE_BYTES || !/^[a-f0-9]{64}$/.test(file.sha256) ||
          ![0o444, 0o555].includes(file.mode)) {throw bundleError();}
      files.set(file.path, file);
    }
    const actual = new Set();
    walkFiles(root, (relative, stat) => {
      if (relative === 'bundle-manifest.json') {return;}
      const file = files.get(relative);
      if (!file || stat.size !== file.size || process.platform !== 'win32' && (stat.mode & 0o777) !== file.mode ||
          digest(readRegularFile(path.join(root, relative), MAX_FILE_BYTES).bytes) !== file.sha256) {throw bundleError();}
      actual.add(relative);
    });
    if (actual.size !== files.size) {throw bundleError();}
    return manifest;
  } catch {throw bundleError();}
}

function materializeBundle(runtime, config, options = {}) {
  const sourceRoot = fs.realpathSync(config.node.packageRoot);
  const cache = privateDirectory(options.bundleCache || path.join(config.stateDir, 'bundles'));
  const stage = fs.mkdtempSync(path.join(cache, '.staging-'));
  fs.chmodSync(stage, 0o700);
  const files = [];
  const sources = [];
  const sourceTrees = [];
  const destinations = new Set();
  let totalBytes = 0;
  let published = false;
  const nodeBytes = readRegularFile(config.node.executable, MAX_FILE_BYTES).bytes;
  const nodeIdentity = { version: process.version, sha256: digest(nodeBytes) };
  function writeFile(relative, bytes, executable = false) {
    if (destinations.has(relative) || files.length >= MAX_FILES || (totalBytes += bytes.length) > MAX_BUNDLE_BYTES) {throw bundleError();}
    destinations.add(relative);
    const target = path.join(stage, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    const mode = executable ? 0o555 : 0o444;
    fs.writeFileSync(target, bytes, { flag: 'wx', mode });
    // Creation mode is masked by the user's umask. The manifest and the Go
    // verifier require these exact sealed modes, including with umask 077.
    fs.chmodSync(target, mode);
    files.push({ path: relative, size: bytes.length, sha256: digest(bytes), mode });
  }
  function copyFile(source, target) {
    const file = readRegularFile(source, MAX_FILE_BYTES);
    writeFile(target, file.bytes, Boolean(file.stat.mode & 0o111));
    sources.push({ path: source, sha256: digest(file.bytes), mode: file.stat.mode & 0o111 });
  }
  function copyTree(source, target, skip = () => false) {
    const stat = fs.lstatSync(source);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {throw bundleError();}
    const treeFiles = [];
    function copy(relative = '') {
      for (const entry of fs.readdirSync(path.join(source, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
        const next = path.join(relative, entry.name);
        if (skip(slash(next), entry)) {continue;}
        const filename = path.join(source, next);
        const child = fs.lstatSync(filename);
        if (child.isSymbolicLink() || !child.isFile() && !child.isDirectory()) {throw bundleError();}
        if (child.isDirectory()) {copy(next);} else {treeFiles.push(slash(next)); copyFile(filename, `${target}/${slash(next)}`);}
      }
    }
    copy();
    sourceTrees.push({ source, skip, files: treeFiles.sort() });
  }
  function copyDependencies(source, target, ancestors = []) {
    if (ancestors.length > 50) {throw bundleError();}
    const metadata = packageMetadata(source);
    const optional = metadata.optionalDependencies || {};
    const peers = metadata.peerDependencies || {};
    const dependencies = { ...peers, ...metadata.dependencies, ...optional };
    for (const name of Object.keys(dependencies).sort()) {
      // Runtime is copied from the verified bytes, never from optional node_modules.
      if (source === sourceRoot && name.startsWith('@openyida/local-agent-runtime-')) {continue;}
      const resolved = findDependency(source, name);
      if (!resolved) {
        if (Object.hasOwn(optional, name) || metadata.peerDependenciesMeta?.[name]?.optional) {continue;}
        throw bundleError('AGENT_BUNDLE_DEPENDENCY_MISSING');
      }
      if (packageMetadata(resolved).name !== name) {throw bundleError();}
      // An ancestor copy already satisfies cycles using normal Node resolution.
      if (ancestors.includes(resolved)) {continue;}
      const destination = `${target}/node_modules/${name}`;
      copyTree(resolved, destination, (relative) => ['node_modules', '.git', '.cache'].includes(relative.split('/')[0]));
      copyDependencies(resolved, destination, [...ancestors, resolved]);
    }
  }
  try {
    const metadata = packageMetadata(sourceRoot);
    if (metadata.name !== 'openyida' || typeof metadata.version !== 'string') {throw bundleError();}
    // Deliberate installed CLI allowlist: no checkout, private state, user
    // project, devDependencies, postinstall execution, or global Skills links.
    for (const directory of ['bin', 'lib', 'yida-skills']) {
      copyTree(path.join(sourceRoot, directory), `openyida/${directory}`, (relative) => directory === 'lib' && /^samples\/.+\/assets(?:\/|$)/.test(relative));
    }
    for (const filename of ['package.json', 'LICENSE', 'README.md', 'project/config.json']) {
      if (fs.existsSync(path.join(sourceRoot, filename))) {copyFile(path.join(sourceRoot, filename), `openyida/${filename}`);}
    }
    const prd = path.join(sourceRoot, 'project', 'prd');
    if (fs.existsSync(prd)) {
      for (const name of fs.readdirSync(prd).sort()) {if (/^demo-.*\.md$/.test(name)) {copyFile(path.join(prd, name), `openyida/project/prd/${name}`);}}
    }
    copyDependencies(sourceRoot, 'openyida', [sourceRoot]);
    // An npm replacement during copying must not produce an internally mixed
    // CLI/skills snapshot. Recheck source content and tree membership before
    // publishing. Once published, execution never consults these source paths.
    for (const source of sources) {
      const current = readRegularFile(source.path, MAX_FILE_BYTES);
      if (digest(current.bytes) !== source.sha256 || (current.stat.mode & 0o111) !== source.mode) {throw bundleError('AGENT_BUNDLE_SOURCE_CHANGED');}
    }
    for (const tree of sourceTrees) {
      const actual = [];
      const inspect = (relative = '') => {
        for (const entry of fs.readdirSync(path.join(tree.source, relative), { withFileTypes: true })) {
          const next = slash(path.join(relative, entry.name));
          if (tree.skip(next, entry)) {continue;}
          if (entry.isSymbolicLink() || !entry.isDirectory() && !entry.isFile()) {throw bundleError();}
          if (entry.isDirectory()) {inspect(next);} else {actual.push(next);}
          if (actual.length > MAX_FILES) {throw bundleError();}
        }
      };
      inspect();
      if (JSON.stringify(actual.sort()) !== JSON.stringify(tree.files)) {throw bundleError('AGENT_BUNDLE_SOURCE_CHANGED');}
    }
    if (JSON.stringify(packageMetadata(sourceRoot)) !== JSON.stringify(metadata)) {throw bundleError('AGENT_BUNDLE_SOURCE_CHANGED');}
    const runtimeFile = `runtime/bin/openyida-agent-runtime${process.platform === 'win32' ? '.exe' : ''}`;
    if (digest(runtime.binaryBytes) !== runtime.sha256) {throw bundleError();}
    writeFile(runtimeFile, runtime.binaryBytes, true);
    writeFile('runtime/runtime-manifest.json', runtime.manifestBytes);
    if (runtime.signatureBytes) {writeFile('runtime/runtime-manifest.sig', runtime.signatureBytes);}
    const manifest = {
      schemaVersion: 1, product: 'openyida-local-agent-bundle', openyidaVersion: metadata.version,
      runtimeVersion: runtime.runtimeVersion, launcherProtocol: 1, wireProtocol: 1, node: nodeIdentity,
      runtime: { executable: runtimeFile, manifest: 'runtime/runtime-manifest.json', signature: runtime.signatureBytes ? 'runtime/runtime-manifest.sig' : null, development: runtime.development === true },
      cliEntry: 'openyida/bin/yida.js', skillsDir: 'openyida/yida-skills',
      files: files.sort((a, b) => Buffer.compare(Buffer.from(a.path, 'utf8'), Buffer.from(b.path, 'utf8'))),
    };
    if (!destinations.has(manifest.cliEntry) || !files.some((file) => file.path.startsWith(`${manifest.skillsDir}/`))) {throw bundleError();}
    const raw = Buffer.from(`${JSON.stringify(manifest)}\n`);
    if (raw.length > MAX_BUNDLE_MANIFEST_BYTES) {throw bundleError();}
    const id = digest(raw);
    fs.writeFileSync(path.join(stage, 'bundle-manifest.json'), raw, { flag: 'wx', mode: 0o444 });
    fs.chmodSync(path.join(stage, 'bundle-manifest.json'), 0o444);
    verifyBundle(stage, id);
    // macOS requires a writable source directory for rename. Contents and
    // descendants are already sealed; the private root is sealed on publish.
    sealDirectories(stage, false);
    const root = path.join(cache, id);
    // Unique private staging + atomic publish is a lock-free compare-and-publish.
    // Concurrent identical installers verify the winner; neither can replace a
    // completed bundle, hold a Go execution lease, or remove an active bundle.
    if (!fs.existsSync(root)) {
      try {publishBundle(stage, root); published = true;}
      catch (error) {
        // macOS can report EACCES when the winning directory is read-only.
        // Reuse is allowed only if that complete winner validates below.
        if (!['EEXIST', 'ENOTEMPTY', 'EACCES', 'EPERM'].includes(error.code) || !fs.existsSync(root)) {throw error;}
      }
    }
    if (published) {fs.chmodSync(root, 0o500);}
    verifyBundle(root, id);
    const bundle = { schemaVersion: 1, id, root, manifestPath: path.join(root, 'bundle-manifest.json'), manifestSha256: id,
      runtimeVersion: runtime.runtimeVersion, skillsDir: path.join(root, manifest.skillsDir) };
    return { runtime: { ...runtime, executable: path.join(root, runtimeFile), manifestPath: path.join(root, 'runtime/runtime-manifest.json') },
      config: { ...config, bundle, node: { ...config.node, packageRoot: path.join(root, 'openyida'), cliEntry: path.join(root, manifest.cliEntry),
        version: metadata.version, nodeVersion: nodeIdentity.version, sha256: nodeIdentity.sha256 } } };
  } catch (error) {
    if (error instanceof CliError) {throw error;}
    throw bundleError();
  } finally {
    if (!published) {makeWritable(stage); fs.rmSync(stage, { recursive: true, force: true });}
  }
}

module.exports = { materializeBundle, verifyBundle, privateDirectory };
