'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const { materializeBundle, verifyBundle } = require('../lib/agent/frozen-bundle');
const { run } = require('../lib/agent/cmd');
const { createBundleFixture, removeFixture } = require('./helpers/agent-bundle-fixture');

describe('content-addressed complete local tool bundle', () => {
  let root, fixture;
  beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-frozen-bundle-')));
    fixture = createBundleFixture(root);
  });
  afterEach(() => {jest.restoreAllMocks(); removeFixture(root);});
  const freeze = () => materializeBundle(fixture.runtime, fixture.config);
  test('freezes transitive dependency closure and skills with no credentials/dev checkout', () => {
    const result = freeze();
    const manifest = verifyBundle(result.config.bundle.root, result.config.bundle.id);
    expect(manifest).toMatchObject({ schemaVersion: 1, product: 'openyida-local-agent-bundle', runtime: { development: true, signature: null }, node: { version: process.version } });
    expect(result.config.node).toMatchObject({ nodeVersion: process.version, sha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(manifest.files.map((file) => file.path)).toContain('openyida/node_modules/fixture-a/node_modules/fixture-b/index.js');
    expect(JSON.stringify(manifest)).not.toMatch(/never-copy-dev|user-login|\.git/);
    expect(JSON.parse(execFileSync(process.execPath, [result.config.node.cliEntry], { encoding: 'utf8' }))).toEqual({ dependency: 'a/b-v1', skill: 'frozen skill v1\n' });
    expect(fs.readdirSync(path.join(fixture.config.stateDir, 'bundles'))).toEqual([result.config.bundle.id]);
    expect(fs.existsSync(path.join(fixture.config.stateDir, 'bundle-references'))).toBe(false); // Go owns references.
  });
  test('old bundle survives npm-like upgrade, uninstall and a new bundle publication', () => {
    const old = freeze();
    fs.writeFileSync(path.join(root, 'package/node_modules/fixture-b/index.js'), "module.exports='b-v2';\n");
    fs.writeFileSync(path.join(root, 'package/yida-skills/SKILL.md'), 'new skill\n');
    const updated = freeze();
    expect(updated.config.bundle.id).not.toBe(old.config.bundle.id);
    fs.renameSync(path.join(root, 'package'), path.join(root, 'removed-npm-package'));
    fs.unlinkSync(fixture.runtimePath);
    const read = (frozen) => JSON.parse(execFileSync(process.execPath, [frozen.config.node.cliEntry], { encoding: 'utf8' }));
    expect(read(old)).toEqual({ dependency: 'a/b-v1', skill: 'frozen skill v1\n' });
    expect(read(updated)).toEqual({ dependency: 'a/b-v2', skill: 'new skill\n' });
    expect(fs.existsSync(old.runtime.executable)).toBe(true);
  });
  test('deterministically reuses the same bundle without creating a Node execution lease', () => {
    const first = freeze();
    const second = freeze();
    expect(second.config.bundle).toEqual(first.config.bundle);
    expect(fs.readdirSync(path.join(fixture.config.stateDir, 'bundles'))).toEqual([first.config.bundle.id]);
  });
  test.each([0o027, 0o077])('freezes and verifies exact file modes under umask %i', (mask) => {
    if (process.platform === 'win32') {return;}
    const modulePath = path.resolve(__dirname, '../lib/agent/frozen-bundle.js');
    const runtimeModule = path.resolve(__dirname, '../lib/agent/runtime-package.js');
    const resolveOptions = { developmentRuntime: true, runtimePath: fixture.runtimePath, manifestPath: fixture.manifestPath };
    const code = `process.umask(${mask});const {resolveRuntime}=require(${JSON.stringify(runtimeModule)});const {materializeBundle}=require(${JSON.stringify(modulePath)});process.stdout.write(JSON.stringify(materializeBundle(resolveRuntime(${JSON.stringify(resolveOptions)}),${JSON.stringify(fixture.config)}).config.bundle));`;
    const bundle = JSON.parse(execFileSync(process.execPath, ['-e', code], { encoding: 'utf8' }));
    const manifest = verifyBundle(bundle.root, bundle.id);
    expect(new Set(manifest.files.map(file => fs.statSync(path.join(bundle.root, file.path)).mode & 0o777))).toEqual(new Set([0o444, 0o555]));
    expect(fs.statSync(bundle.manifestPath).mode & 0o777).toBe(0o444);
    expect(freeze().config.bundle.id).toBe(bundle.id);
  });
  test('inventory uses UTF-8 byte order shared with the Go verifier', () => {
    const frozen = freeze();
    const manifest = verifyBundle(frozen.config.bundle.root, frozen.config.bundle.id);
    const paths = manifest.files.map((file) => file.path);
    expect(paths.indexOf('openyida/lib/\uE000.js')).toBeLessThan(paths.indexOf('openyida/lib/\u{10000}.js'));
    expect(paths).toEqual([...paths].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b))));
  });
  test('rejects existing bundle tampering and never silently repairs or deletes it', () => {
    const frozen = freeze();
    const target = path.join(frozen.config.node.packageRoot, 'lib/fixture.js');
    fs.chmodSync(target, 0o600); fs.writeFileSync(target, 'changed');
    expect(freeze).toThrow(expect.objectContaining({ code: 'AGENT_BUNDLE_INVALID' }));
    expect(fs.readFileSync(target, 'utf8')).toBe('changed');
  });
  test('rejects unlisted files, symlinks and changed manifest bytes', () => {
    const frozen = freeze();
    fs.chmodSync(frozen.config.bundle.root, 0o700);
    fs.writeFileSync(path.join(frozen.config.bundle.root, 'extra'), 'unexpected');
    expect(() => verifyBundle(frozen.config.bundle.root, frozen.config.bundle.id)).toThrow();
    fs.unlinkSync(path.join(frozen.config.bundle.root, 'extra'));
    fs.symlinkSync('/tmp', path.join(frozen.config.bundle.root, 'escape'));
    expect(() => verifyBundle(frozen.config.bundle.root, frozen.config.bundle.id)).toThrow();
  });
  test('fails closed on source links or unavailable required dependencies', () => {
    fs.symlinkSync(path.join(root, 'package/lib/fixture.js'), path.join(root, 'package/lib/link'));
    expect(freeze).toThrow();
    fs.unlinkSync(path.join(root, 'package/lib/link'));
    fs.renameSync(path.join(root, 'package/node_modules/fixture-b'), path.join(root, 'uninstalled-dependency'));
    expect(freeze).toThrow(expect.objectContaining({ code: 'AGENT_BUNDLE_DEPENDENCY_MISSING' }));
    expect(fs.readdirSync(path.join(fixture.config.stateDir, 'bundles'))).toEqual([]);
  });
  test('failed materialization publishes nothing and does not affect prior bundles', () => {
    const previous = freeze();
    const originalWrite = fs.writeFileSync;
    jest.spyOn(fs, 'writeFileSync').mockImplementation((filename, ...args) => {
      if (String(filename).includes('.staging-') && String(filename).endsWith('fixture.js')) {throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });}
      return originalWrite(filename, ...args);
    });
    expect(freeze).toThrow();
    expect(fs.readdirSync(path.join(fixture.config.stateDir, 'bundles'))).toEqual([previous.config.bundle.id]);
    expect(() => verifyBundle(previous.config.bundle.root, previous.config.bundle.id)).not.toThrow();
  });
  test.each(['content', 'added-file', 'package-version'])('rejects concurrent npm source change: %s', (change) => {
    const originalWrite = fs.writeFileSync;
    let changed = false;
    jest.spyOn(fs, 'writeFileSync').mockImplementation((filename, ...args) => {
      const result = originalWrite(filename, ...args);
      if (!changed && String(filename).includes('.staging-') && String(filename).endsWith('SKILL.md')) {
        changed = true;
        if (change === 'package-version') {
          const file = path.join(root, 'package/package.json');
          const metadata = JSON.parse(fs.readFileSync(file, 'utf8'));
          metadata.version = '2026.9.8';
          originalWrite(file, JSON.stringify(metadata));
        } else {
          originalWrite(path.join(root, change === 'content' ? 'package/lib/fixture.js' : 'package/lib/new-file.js'), 'changed by concurrent installer');
        }
      }
      return result;
    });
    expect(freeze).toThrow(expect.objectContaining({ code: 'AGENT_BUNDLE_SOURCE_CHANGED' }));
    expect(fs.readdirSync(path.join(fixture.config.stateDir, 'bundles'))).toEqual([]);
  });
  test('refuses group-writable cache parents on Unix', () => {
    if (process.platform === 'win32') {return;}
    fs.mkdirSync(path.join(root, 'unsafe'), { mode: 0o777 }); fs.chmodSync(path.join(root, 'unsafe'), 0o777);
    fixture.config.stateDir = path.join(root, 'unsafe/state');
    expect(freeze).toThrow(expect.objectContaining({ code: 'AGENT_BUNDLE_UNSAFE_DIRECTORY' }));
  });
  test.each(['connect', 'run'])('%s launches only frozen paths and carries explicit development marker', async (command) => {
    const stdout = { write: jest.fn() };
    await run([command, '--development-runtime', '--runtime-path', fixture.runtimePath, '--runtime-manifest', fixture.manifestPath,
      '--endpoint', 'https://agent.example.test', '--endpoint-id', 'test', '--state-dir', fixture.config.stateDir], {
      // This test isolates bundle launching; enrolled multi-organization
      // Connections are exercised by agent-connection-manager.test.js.
      packageRoot: fixture.config.node.packageRoot, stdout, disableConnectionManager: true, probe: async () => ({ status: 'passed' }),
    });
    const event = JSON.parse(stdout.write.mock.calls[0][0]);
    expect(event.config).toMatchObject({ command, developmentRuntime: true, parentWatchFD: 3, bundle: { schemaVersion: 1 } });
    expect(event.config.node.packageRoot).toBe(path.join(event.config.bundle.root, 'openyida'));
    expect(event.config).not.toHaveProperty('profile');
  });
  test('two independent materializers atomically agree on one complete bundle', async () => {
    const modulePath = path.resolve(__dirname, '../lib/agent/frozen-bundle.js');
    const runtimeModule = path.resolve(__dirname, '../lib/agent/runtime-package.js');
    const code = `const {resolveRuntime}=require(${JSON.stringify(runtimeModule)});const {materializeBundle}=require(${JSON.stringify(modulePath)});const r=resolveRuntime(${JSON.stringify({ developmentRuntime: true, runtimePath: fixture.runtimePath, manifestPath: fixture.manifestPath })});console.log(materializeBundle(r,${JSON.stringify(fixture.config)}).config.bundle.id);`;
    const execute = () => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['-e', code], { stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '', error = '';
      child.stdout.on('data', (chunk) => {output += chunk;}); child.stderr.on('data', (chunk) => {error += chunk;});
      child.on('error', reject); child.on('close', (status) => status === 0 ? resolve(output.trim()) : reject(new Error(error)));
    });
    const ids = await Promise.all([execute(), execute()]);
    expect(ids[0]).toBe(ids[1]);
    expect(fs.readdirSync(path.join(fixture.config.stateDir, 'bundles'))).toEqual([ids[0]]);
    expect(() => verifyBundle(path.join(fixture.config.stateDir, 'bundles', ids[0]), ids[0])).not.toThrow();
  });
});
