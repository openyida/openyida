'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { resolveRuntime } = require('../lib/agent/runtime-package');

describe('explicit agent runtime package', () => {
  let root;
  let executable;
  let manifestPath;
  let manifest;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-runtime-'));
    executable = path.join(root, '运行时 with spaces');
    manifestPath = path.join(root, 'runtime.manifest.json');
    fs.writeFileSync(executable, '# fake runtime; never executed\n', { mode: 0o700 });
    manifest = {
      schemaVersion: 1, version: '0.1.0-dev', protocolVersion: 1,
      platform: process.platform, arch: process.arch,
      binary: { file: path.basename(executable), sha256: crypto.createHash('sha256').update(fs.readFileSync(executable)).digest('hex') },
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
  const resolve = () => resolveRuntime({ developmentRuntime: true, runtimePath: executable, manifestPath });
  test('v1 and environment overrides never silently enable development mode', () => {
    expect(() => resolveRuntime({ runtimePath: executable, manifestPath })).toThrow(expect.objectContaining({ code: 'AGENT_RUNTIME_DEVELOPMENT_REQUIRED' }));
    expect(() => resolveRuntime({ env: { OPENYIDA_AGENT_RUNTIME_PATH: executable, OPENYIDA_AGENT_RUNTIME_MANIFEST: manifestPath, OPENYIDA_DEVELOPMENT_RUNTIME: '1' } })).toThrow(expect.objectContaining({ code: 'AGENT_RUNTIME_NOT_CONFIGURED' }));
  });
  test('checks explicit content without executing or PATH lookup', () => {
    expect(resolve()).toMatchObject({ executable: fs.realpathSync(executable), sha256: manifest.binary.sha256 });
  });
  test('keeps Linux available only for an explicit development runtime', () => {
    manifest.platform = 'linux';
    manifest.arch = 'x64';
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    expect(resolveRuntime({ developmentRuntime: true, runtimePath: executable, manifestPath, platform: 'linux', arch: 'x64' }))
      .toMatchObject({ development: true, manifest: { platform: 'linux', arch: 'x64' } });
  });
  test('missing platform package does not use ambient PATH', () => {
    expect(() => resolveRuntime({ env: { PATH: root } })).toThrow(expect.objectContaining({ code: 'AGENT_RUNTIME_NOT_CONFIGURED' }));
  });
  test('rejects a relative executable', () => {
    expect(() => resolveRuntime({ developmentRuntime: true, runtimePath: 'runtime', manifestPath })).toThrow(expect.objectContaining({ code: 'AGENT_RUNTIME_INVALID_PATH' }));
  });
  test.each([
    ['protocolVersion', 2, 'AGENT_RUNTIME_PROTOCOL_UNSUPPORTED'],
    ['platform', 'unsupported', 'AGENT_RUNTIME_PLATFORM_UNSUPPORTED'],
    ['arch', 'unsupported', 'AGENT_RUNTIME_PLATFORM_UNSUPPORTED'],
    ['schemaVersion', 2, 'AGENT_RUNTIME_INVALID_MANIFEST'],
    ['version', 'version\nmalicious', 'AGENT_RUNTIME_INVALID_MANIFEST'],
  ])('rejects incompatible %s before spawn', (key, value, code) => {
    manifest[key] = value;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    expect(resolve).toThrow(expect.objectContaining({ code }));
  });
  test('refuses modified binary and mismatched filename', () => {
    fs.appendFileSync(executable, 'changed');
    expect(resolve).toThrow(expect.objectContaining({ code: 'AGENT_RUNTIME_INTEGRITY_FAILED' }));
    manifest.binary.file = '../runtime';
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    expect(resolve).toThrow(expect.objectContaining({ code: 'AGENT_RUNTIME_INVALID_MANIFEST' }));
  });
  test('refuses symlink binary', () => {
    const link = path.join(root, 'link');
    fs.symlinkSync(executable, link);
    expect(() => resolveRuntime({ developmentRuntime: true, runtimePath: link, manifestPath })).toThrow(expect.objectContaining({ code: 'AGENT_RUNTIME_INVALID_PATH' }));
  });
});
