'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createRequire } = require('module');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { MAX_MANIFEST_BYTES, MAX_BINARY_BYTES, SHA256, decodeManifestV2, verifyManifestSignature, parseStrictJson, exactKeys } = require('./runtime-manifest');
const bundledCatalog = require('./runtime-catalog.json');

const PROTOCOL_VERSION = 1;

function runtimeError(code, key) {
  return new CliError(t(`agent.${key}`), { code });
}

function requireAbsoluteFile(value, code) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) {
    throw runtimeError(code, 'absolute_path_required');
  }
  let stat;
  try {
    stat = fs.lstatSync(value);
  } catch {
    throw runtimeError(code, 'runtime_missing');
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw runtimeError(code, 'unsafe_file');
  }
  return { path: fs.realpathSync(value), stat };
}

function readRegularFile(filename, maxBytes, code = 'AGENT_RUNTIME_INVALID_PATH') {
  const file = requireAbsoluteFile(filename, code);
  if (file.stat.size > maxBytes) {throw runtimeError(code, 'unsafe_file');}
  let descriptor;
  try {
    descriptor = fs.openSync(file.path, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile() || opened.size > maxBytes || opened.ino !== file.stat.ino || opened.dev !== file.stat.dev) {throw new Error('changed file');}
    const bytes = fs.readFileSync(descriptor);
    if (bytes.length > maxBytes || bytes.length !== opened.size) {throw new Error('changed file');}
    return { ...file, bytes };
  } catch {throw runtimeError(code, 'unsafe_file');}
  finally {if (descriptor !== undefined) {fs.closeSync(descriptor);}}
}

function checkExecutable(binary, platform) {
  if (platform !== 'win32') {
    try {fs.accessSync(binary.path, fs.constants.X_OK);}
    catch {throw runtimeError('AGENT_RUNTIME_NOT_EXECUTABLE', 'runtime_not_executable');}
  }
}

function digest(bytes) {return crypto.createHash('sha256').update(bytes).digest('hex');}

function resolveDevelopment(options) {
  if (!options.runtimePath || !options.manifestPath) {throw runtimeError('AGENT_RUNTIME_NOT_CONFIGURED', 'runtime_not_configured');}
  const binary = readRegularFile(options.runtimePath, MAX_BINARY_BYTES);
  const file = readRegularFile(options.manifestPath, MAX_MANIFEST_BYTES, 'AGENT_RUNTIME_INVALID_MANIFEST');
  const manifest = parseStrictJson(file.bytes);
  if (!exactKeys(manifest, ['schemaVersion', 'version', 'protocolVersion', 'platform', 'arch', 'binary']) || manifest.schemaVersion !== 1 ||
      typeof manifest.version !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9.+_-]{0,99}$/.test(manifest.version) ||
      !exactKeys(manifest.binary, ['file', 'sha256']) || typeof manifest.binary.file !== 'string' ||
      path.basename(manifest.binary.file) !== manifest.binary.file ||
      manifest.binary.file !== path.basename(binary.path) ||
      !/^[a-f0-9]{64}$/i.test(manifest.binary.sha256 || '')) {
    throw runtimeError('AGENT_RUNTIME_INVALID_MANIFEST', 'manifest_invalid');
  }
  if (manifest.protocolVersion !== PROTOCOL_VERSION) {
    throw runtimeError('AGENT_RUNTIME_PROTOCOL_UNSUPPORTED', 'protocol_unsupported');
  }
  if (manifest.platform !== (options.platform || process.platform) ||
      manifest.arch !== (options.arch || process.arch)) {
    throw runtimeError('AGENT_RUNTIME_PLATFORM_UNSUPPORTED', 'platform_unsupported');
  }
  checkExecutable(binary, options.platform || process.platform);
  const sha256 = digest(binary.bytes);
  if (sha256 !== manifest.binary.sha256.toLowerCase()) {
    throw runtimeError('AGENT_RUNTIME_INTEGRITY_FAILED', 'integrity_failed');
  }
  return { executable: binary.path, manifestPath: file.path, manifest, sha256, binaryBytes: binary.bytes, manifestBytes: file.bytes, runtimeVersion: manifest.version, development: true };
}

function platformPackageName(platform, arch) {
  if (!['darwin', 'linux', 'win32'].includes(platform) || !['arm64', 'x64'].includes(arch)) {
    throw runtimeError('AGENT_RUNTIME_PLATFORM_UNSUPPORTED', 'platform_unsupported');
  }
  // Reserved proposal only: no dependency is declared until an approved release exists.
  return `@openyida/local-agent-runtime-${platform}-${arch}`;
}

function safePackageFile(root, relative) {
  let current = root;
  for (const component of relative.split('/')) {
    if (!component || component === '.' || component === '..' || component.includes('\\')) {throw runtimeError('AGENT_RUNTIME_INVALID_PATH', 'unsafe_file');}
    current = path.join(current, component);
    let stat;
    try {stat = fs.lstatSync(current);} catch {throw runtimeError('AGENT_RUNTIME_INVALID_PATH', 'runtime_missing');}
    if (stat.isSymbolicLink()) {throw runtimeError('AGENT_RUNTIME_INVALID_PATH', 'unsafe_file');}
  }
  return current;
}

function resolveProduction(options) {
  const platform = options.platform || process.platform;
  const arch = options.arch || process.arch;
  const name = platformPackageName(platform, arch);
  // The catalog and roots are part of the Node host, never read from a platform
  // package or network. Injection is an internal unit-test seam, not a CLI flag.
  const catalog = options.catalog || bundledCatalog;
  const releases = catalog.schemaVersion === 1 && Array.isArray(catalog.releases) ? catalog.releases.filter((entry) => entry.platform === platform && entry.arch === arch) : [];
  if (releases.length !== 1) {throw runtimeError('AGENT_RUNTIME_NOT_CONFIGURED', 'runtime_not_configured');}
  const release = releases[0];
  if (release.packageName !== name || !SHA256.test(release.manifestSha256 || '') || !release.packageVersion || !release.runtimeVersion) {
    throw runtimeError('AGENT_RUNTIME_INVALID_MANIFEST', 'manifest_invalid');
  }
  const packageRoot = path.resolve(options.packageRoot || path.join(__dirname, '..', '..'));
  let installedRoot;
  try {
    const main = parseStrictJson(readRegularFile(path.join(packageRoot, 'package.json'), MAX_MANIFEST_BYTES).bytes);
    if (!main.optionalDependencies || main.optionalDependencies[name] !== release.packageVersion) {throw new Error('unapproved dependency');}
    const localRequire = createRequire(path.join(packageRoot, 'package.json'));
    installedRoot = path.dirname(fs.realpathSync(localRequire.resolve(`${name}/package.json`)));
    const metadata = parseStrictJson(readRegularFile(safePackageFile(installedRoot, 'package.json'), MAX_MANIFEST_BYTES).bytes);
    if (metadata.name !== name || metadata.version !== release.packageVersion ||
        !Array.isArray(metadata.os) || metadata.os.length !== 1 || metadata.os[0] !== platform ||
        !Array.isArray(metadata.cpu) || metadata.cpu.length !== 1 || metadata.cpu[0] !== arch ||
        metadata.scripts && Object.keys(metadata.scripts).length) {throw new Error('wrong platform package');}
  } catch {throw runtimeError('AGENT_RUNTIME_PACKAGE_UNAVAILABLE', 'runtime_not_configured');}
  const file = readRegularFile(safePackageFile(installedRoot, 'runtime-manifest.json'), MAX_MANIFEST_BYTES, 'AGENT_RUNTIME_INVALID_MANIFEST');
  const manifest = decodeManifestV2(file.bytes);
  const signature = readRegularFile(safePackageFile(installedRoot, 'runtime-manifest.sig'), 128, 'AGENT_RUNTIME_SIGNATURE_FAILED');
  verifyManifestSignature(file.bytes, signature.bytes, manifest, catalog.keys);
  if (digest(file.bytes) !== release.manifestSha256 || manifest.runtimeVersion !== release.runtimeVersion) {throw runtimeError('AGENT_RUNTIME_INTEGRITY_FAILED', 'integrity_failed');}
  if (manifest.platform !== platform || manifest.arch !== arch) {throw runtimeError('AGENT_RUNTIME_PLATFORM_UNSUPPORTED', 'platform_unsupported');}
  if ([manifest.launcherProtocol, manifest.wireProtocol].some((range) => range.min > PROTOCOL_VERSION || range.max < PROTOCOL_VERSION)) {
    throw runtimeError('AGENT_RUNTIME_PROTOCOL_UNSUPPORTED', 'protocol_unsupported');
  }
  const binary = readRegularFile(safePackageFile(installedRoot, manifest.binary.file), MAX_BINARY_BYTES);
  checkExecutable(binary, platform);
  const sha256 = digest(binary.bytes);
  if (binary.bytes.length !== manifest.binary.size || sha256 !== manifest.binary.sha256) {throw runtimeError('AGENT_RUNTIME_INTEGRITY_FAILED', 'integrity_failed');}
  return { executable: binary.path, manifestPath: file.path, signaturePath: signature.path, manifest, sha256, binaryBytes: binary.bytes,
    manifestBytes: file.bytes, signatureBytes: signature.bytes, runtimeVersion: manifest.runtimeVersion, development: false };
}

function resolveRuntime(options = {}) {
  if (options.developmentRuntime === true) {return resolveDevelopment(options);}
  if (options.runtimePath || options.manifestPath) {throw runtimeError('AGENT_RUNTIME_DEVELOPMENT_REQUIRED', 'development_required');}
  return resolveProduction(options);
}

module.exports = { PROTOCOL_VERSION, resolveRuntime, requireAbsoluteFile, readRegularFile, digest, platformPackageName };
