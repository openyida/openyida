'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { resolveRuntime, digest, platformPackageName } = require('../lib/agent/runtime-package');
const { decodeManifestV2, parseStrictJson } = require('../lib/agent/runtime-manifest');

describe('production runtime manifest and platform package', () => {
  let root, packageRoot, platformRoot, binary, manifest, catalog, keys;
  const fixturePlatform = process.platform === 'win32' ? 'win32' : 'darwin';
  const fixtureArch = process.arch === 'x64' ? 'x64' : 'arm64';
  function writeSigned() {
    const bytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
    fs.writeFileSync(path.join(platformRoot, 'runtime-manifest.json'), bytes);
    fs.writeFileSync(path.join(platformRoot, 'runtime-manifest.sig'), `${crypto.sign(null, bytes, keys.privateKey).toString('base64')}\n`);
    catalog.releases[0].manifestSha256 = digest(bytes);
  }
  function resolve() {return resolveRuntime({ packageRoot, catalog, platform: fixturePlatform, arch: fixtureArch });}
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-signed-package-'));
    packageRoot = path.join(root, 'node_modules', 'openyida');
    const name = platformPackageName(fixturePlatform, fixtureArch);
    // Hoisted sibling: do not assume the package is nested inside openyida.
    platformRoot = path.join(root, 'node_modules', name);
    fs.mkdirSync(packageRoot, { recursive: true });
    fs.mkdirSync(path.join(platformRoot, 'bin'), { recursive: true });
    fs.writeFileSync(path.join(packageRoot, 'package.json'), JSON.stringify({ name: 'openyida', version: '2026.9.7', optionalDependencies: { [name]: '0.1.0' } }));
    fs.writeFileSync(path.join(platformRoot, 'package.json'), JSON.stringify({ name, version: '0.1.0', os: [fixturePlatform], cpu: [fixtureArch] }));
    binary = path.join(platformRoot, 'bin', `openyida-agent-runtime${fixturePlatform === 'win32' ? '.exe' : ''}`);
    const bytes = Buffer.from('fake fixture binary, never execute');
    fs.writeFileSync(binary, bytes, { mode: 0o700 });
    keys = crypto.generateKeyPairSync('ed25519');
    manifest = { schemaVersion: 2, product: 'openyida-local-agent-runtime', runtimeVersion: '0.1.0', sourceRevision: 'a'.repeat(40),
      platform: fixturePlatform, arch: fixtureArch, launcherProtocol: { min: 1, max: 1 }, wireProtocol: { min: 1, max: 1 },
      stateSchema: { write: 1, readMin: 1, readMax: 1 }, binary: { file: `bin/${path.basename(binary)}`, size: bytes.length, sha256: digest(bytes) }, releaseId: 'release-0.1.0', keyId: 'test-key' };
    catalog = { schemaVersion: 1, keys: { 'test-key': { publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }) } },
      releases: [{ platform: fixturePlatform, arch: fixtureArch, packageName: name, packageVersion: '0.1.0', runtimeVersion: '0.1.0', manifestSha256: '' }] };
    writeSigned();
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
  test('validates trusted Ed25519 raw bytes, fixed package version, OS and digest without spawning', () => {
    expect(resolve()).toMatchObject({ executable: fs.realpathSync(binary), development: false, runtimeVersion: '0.1.0', sha256: manifest.binary.sha256 });
  });
  test.each([
    ['product', 'another-product'], ['runtimeVersion', 'latest'], ['sourceRevision', 'internal-branch'],
    ['arch', 'amd64'], ['platform', 'windows'], ['platform', 'linux'], ['schemaVersion', 1], ['unknown', true],
    ['binary', { file: '../escape', size: 1, sha256: 'a'.repeat(64) }],
    ['binary', { file: 'bin/openyida-agent-runtime', size: 1.5, sha256: 'a'.repeat(64) }],
    ['launcherProtocol', { min: 2, max: 1 }], ['wireProtocol', { min: 1, max: 1, future: true }],
    ['stateSchema', { write: 1, readMin: 2, readMax: 3 }],
  ])('strictly rejects invalid signed field %s', (field, value) => {
    manifest[field] = value; writeSigned();
    expect(resolve).toThrow(expect.objectContaining({ code: 'AGENT_RUNTIME_INVALID_MANIFEST' }));
  });
  test.each(['launcherProtocol', 'wireProtocol'])('refuses incompatible %s even with valid signature', (field) => {
    manifest[field] = { min: 2, max: 3 }; writeSigned();
    expect(resolve).toThrow(expect.objectContaining({ code: 'AGENT_RUNTIME_PROTOCOL_UNSUPPORTED' }));
  });
  test('rejects duplicate escaped keys, malformed UTF8 and unbounded manifests', () => {
    expect(() => parseStrictJson(Buffer.from('{"x":1,"\\u0078":2}'))).toThrow();
    expect(() => parseStrictJson(Buffer.from([0x22, 0xff, 0x22]))).toThrow();
    expect(() => decodeManifestV2(Buffer.alloc(65537))).toThrow();
  });
  test('does not fetch trust roots from the platform package or accept revoked roots', () => {
    fs.writeFileSync(path.join(platformRoot, 'trusted-keys.json'), JSON.stringify(catalog.keys));
    catalog.keys = {};
    expect(resolve).toThrow(expect.objectContaining({ code: 'AGENT_RUNTIME_SIGNATURE_FAILED' }));
    catalog.keys = { 'test-key': { publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }), revoked: true } };
    expect(resolve).toThrow(expect.objectContaining({ code: 'AGENT_RUNTIME_SIGNATURE_FAILED' }));
  });
  test('signature covers exact whitespace and only strict base64 is accepted', () => {
    fs.appendFileSync(path.join(platformRoot, 'runtime-manifest.json'), ' ');
    expect(resolve).toThrow(expect.objectContaining({ code: 'AGENT_RUNTIME_SIGNATURE_FAILED' }));
    writeSigned(); fs.appendFileSync(path.join(platformRoot, 'runtime-manifest.sig'), 'ignored');
    expect(resolve).toThrow(expect.objectContaining({ code: 'AGENT_RUNTIME_SIGNATURE_FAILED' }));
  });
  test('rejects validly signed substitution not pinned by host catalog', () => {
    const pinned = catalog.releases[0].manifestSha256;
    manifest.releaseId = 'different-release'; writeSigned(); catalog.releases[0].manifestSha256 = pinned;
    expect(resolve).toThrow(expect.objectContaining({ code: 'AGENT_RUNTIME_INTEGRITY_FAILED' }));
  });
  test('checks both file size and content hash', () => {
    fs.appendFileSync(binary, 'x');
    expect(resolve).toThrow(expect.objectContaining({ code: 'AGENT_RUNTIME_INTEGRITY_FAILED' }));
    manifest.binary.size++; writeSigned();
    expect(resolve).toThrow(expect.objectContaining({ code: 'AGENT_RUNTIME_INTEGRITY_FAILED' }));
  });
  test('refuses scripts, wrong exact npm version and missing optional dependency', () => {
    fs.writeFileSync(path.join(platformRoot, 'package.json'), JSON.stringify({ name: catalog.releases[0].packageName, version: '0.1.1', os: [fixturePlatform], cpu: [fixtureArch] }));
    expect(resolve).toThrow(expect.objectContaining({ code: 'AGENT_RUNTIME_PACKAGE_UNAVAILABLE' }));
    fs.writeFileSync(path.join(packageRoot, 'package.json'), JSON.stringify({ name: 'openyida' }));
    expect(resolve).toThrow(expect.objectContaining({ code: 'AGENT_RUNTIME_PACKAGE_UNAVAILABLE' }));
  });
  test('rejects binary symlink and platform aliases', () => {
    fs.renameSync(binary, `${binary}.real`); fs.symlinkSync(`${binary}.real`, binary);
    expect(resolve).toThrow(expect.objectContaining({ code: 'AGENT_RUNTIME_INVALID_PATH' }));
    expect(() => platformPackageName('windows', 'amd64')).toThrow();
    expect(() => platformPackageName('linux', 'x64')).toThrow(expect.objectContaining({ code: 'AGENT_RUNTIME_PLATFORM_UNSUPPORTED' }));
  });
});
