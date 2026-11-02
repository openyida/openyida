'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const { materializeBundle, verifyBundle } = require('../lib/agent/frozen-bundle');
const { run } = require('../lib/agent/cmd');
const { resolveRuntime, canonicalPath } = require('../lib/agent/runtime-package');
const { createBundleFixture, removeFixture } = require('./helpers/agent-bundle-fixture');

describe('content-addressed complete local tool bundle', () => {
  let root, fixture;
  beforeEach(() => {
    root = canonicalPath(fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-frozen-bundle-')));
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
  test('shared and cyclic dependencies reuse their visible source package', () => {
    const file = path.join(root, 'package/package.json');
    const metadata = JSON.parse(fs.readFileSync(file, 'utf8'));
    metadata.dependencies['fixture-b'] = '1.0.0';
    fs.writeFileSync(file, JSON.stringify(metadata));
    const frozen = freeze();
    const manifest = verifyBundle(frozen.config.bundle.root, frozen.config.bundle.id);
    const copies = manifest.files.filter(file => file.path.endsWith('/fixture-b/index.js'));
    expect(copies.map(file => file.path)).toEqual(['openyida/node_modules/fixture-b/index.js']);
    expect(manifest.files.filter(file => file.path.endsWith('/fixture-a/index.js'))).toHaveLength(1);
    expect(JSON.parse(execFileSync(process.execPath, [frozen.config.node.cliEntry], { encoding: 'utf8' })).dependency).toBe('a/b-v1');
  });
  test('nested versions shadow ancestors without changing a shared package resolution', () => {
    const sourceRoot = path.join(root, 'package');
    const metadata = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'package.json'), 'utf8'));
    metadata.dependencies['fixture-b'] = '1.0.0';
    fs.writeFileSync(path.join(sourceRoot, 'package.json'), JSON.stringify(metadata));
    const writePackage = (relative, metadata, code) => {
      const directory = path.join(sourceRoot, 'node_modules', relative);
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify(metadata));
      fs.writeFileSync(path.join(directory, 'index.js'), code);
    };
    writePackage('fixture-a/node_modules/fixture-b', {
      name: 'fixture-b', version: '2.0.0', dependencies: { 'fixture-c': '1.0.0' },
    }, "module.exports='b-v2/'+require('fixture-c');");
    writePackage('fixture-c', {
      name: 'fixture-c', version: '1.0.0', dependencies: { 'fixture-b': '1.0.0' },
    }, "module.exports=require('fixture-b');");
    const frozen = freeze();
    const manifest = verifyBundle(frozen.config.bundle.root, frozen.config.bundle.id);
    const nested = 'openyida/node_modules/fixture-a/node_modules/fixture-b';
    expect(manifest.files.map(file => file.path)).toEqual(expect.arrayContaining([
      'openyida/node_modules/fixture-b/index.js', `${nested}/index.js`,
      `${nested}/node_modules/fixture-c/node_modules/fixture-b/index.js`,
    ]));
    expect(JSON.parse(execFileSync(process.execPath, [frozen.config.node.cliEntry], { encoding: 'utf8' })).dependency).toBe('a/b-v2/b-v1');
  });
  test('explicit development bundles skip optional runtime packages without the production platform gate', () => {
    const packageFile = path.join(root, 'package/package.json');
    const metadata = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
    const optionalRuntime = `@openyida/local-agent-runtime-${process.platform}-${process.arch}`;
    metadata.optionalDependencies = { [optionalRuntime]: '0.1.1' };
    fs.writeFileSync(packageFile, JSON.stringify(metadata));
    const installedRuntime = path.join(root, 'package/node_modules', optionalRuntime);
    fs.mkdirSync(installedRuntime, { recursive: true });
    fs.writeFileSync(path.join(installedRuntime, 'package.json'), 'unverified runtime package must not be read');
    jest.isolateModules(() => {
      const runtimePackage = require('../lib/agent/runtime-package');
      const platformGate = jest.spyOn(runtimePackage, 'platformPackageName').mockImplementation(() => {
        throw new Error('production platform unavailable');
      });
      const { materializeBundle: materializeDevelopment } = require('../lib/agent/frozen-bundle');
      const frozen = materializeDevelopment(fixture.runtime, fixture.config);
      expect(verifyBundle(frozen.config.bundle.root, frozen.config.bundle.id).runtime.development).toBe(true);
      expect(platformGate).not.toHaveBeenCalled();
    });
  });
  // Simulated Linux filesystem checks require Unix ownership and mode semantics.
  const unixTest = process.platform === 'win32' ? test.skip : test;
  unixTest('freezes an explicit Linux development runtime without opening production Linux support', () => {
    const platform = Object.getOwnPropertyDescriptor(process, 'platform');
    try {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      fixture = createBundleFixture(root);
      const frozen = freeze();
      expect(verifyBundle(frozen.config.bundle.root, frozen.config.bundle.id).runtime)
        .toMatchObject({ development: true, signature: null });
      expect(() => resolveRuntime({ platform: 'linux', arch: 'x64' }))
        .toThrow(expect.objectContaining({ code: 'AGENT_RUNTIME_PLATFORM_UNSUPPORTED' }));
    } finally {
      Object.defineProperty(process, 'platform', platform);
    }
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
  const windowsTest = process.platform === 'win32' ? test : test.skip;
  windowsTest('all nested frozen directories bind the current Windows user', () => {
    const frozen = freeze();
    const script = `$ErrorActionPreference='Stop'
$current=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$root=Get-Item -LiteralPath $env:OPENYIDA_TEST_BUNDLE
$items=@($root)+@(Get-ChildItem -LiteralPath $root.FullName -Directory -Recurse -Force)
foreach($item in $items){
  if($item.GetAccessControl().GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $current){throw 'Unexpected bundle directory owner'}
}
'owned'`;
    expect(execFileSync(path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
      ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true,
        env: { ...process.env, OPENYIDA_TEST_BUNDLE: frozen.config.bundle.root } }).trim()).toBe('owned');
  }, 60000);
  test('deterministically reuses the same bundle without creating a Node execution lease', () => {
    const first = freeze();
    const write = jest.spyOn(fs, 'writeFileSync');
    const second = freeze();
    expect(write).not.toHaveBeenCalled();
    expect(second.config.bundle).toEqual(first.config.bundle);
    expect(fs.readdirSync(path.join(fixture.config.stateDir, 'bundles'))).toEqual([first.config.bundle.id]);
  });
  test('warm reuse hashes source once and still verifies every frozen file', () => {
    const first = freeze();
    const open = jest.spyOn(fs, 'openSync');
    const second = freeze();
    const source = path.join(root, 'package/lib/fixture.js');
    const target = path.join(first.config.node.packageRoot, 'lib/fixture.js');
    expect(open.mock.calls.filter(call => call[0] === source)).toHaveLength(1);
    expect(open.mock.calls.filter(call => call[0] === target)).toHaveLength(1);
    expect(second.config.bundle.id).toBe(first.config.bundle.id);
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
    expect(paths.indexOf(`openyida/lib/order-${String.fromCodePoint(0xE000)}.js`)).toBeLessThan(paths.indexOf(`openyida/lib/order-${String.fromCodePoint(0x1F680)}.js`));
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
    fs.symlinkSync(root, path.join(frozen.config.bundle.root, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    expect(() => verifyBundle(frozen.config.bundle.root, frozen.config.bundle.id)).toThrow();
  });
  test('fails closed on source links or unavailable required dependencies', () => {
    fs.symlinkSync(path.join(root, 'package/node_modules'), path.join(root, 'package/lib/link'), process.platform === 'win32' ? 'junction' : 'dir');
    expect(freeze).toThrow();
    if (process.platform === 'win32') {fs.rmdirSync(path.join(root, 'package/lib/link'));}
    else {fs.unlinkSync(path.join(root, 'package/lib/link'));}
    fs.renameSync(path.join(root, 'package/node_modules/fixture-b'), path.join(root, 'uninstalled-dependency'));
    expect(freeze).toThrow(expect.objectContaining({ code: 'AGENT_BUNDLE_DEPENDENCY_MISSING' }));
    expect(fs.readdirSync(path.join(fixture.config.stateDir, 'bundles'))).toEqual([]);
  });
  test('failed materialization publishes nothing and does not affect prior bundles', () => {
    const previous = freeze();
    fs.writeFileSync(path.join(root, 'package/lib/fixture.js'), 'new candidate');
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
    const children = [];
    await run([command, '--development-runtime', '--runtime-path', fixture.runtimePath, '--runtime-manifest', fixture.manifestPath,
      '--endpoint', 'https://agent.example.test', '--endpoint-id', 'test', '--state-dir', fixture.config.stateDir,
      '--provider', 'qoder', '--provider-path', process.execPath], {
      // This test isolates bundle launching; enrolled multi-organization
      // Connections are exercised by agent-connection-manager.test.js.
      // The fixture is JavaScript, not a Windows PE executable. Launch the same
      // frozen fixture bytes with Node while preserving the stdio contract.
      spawn: (executable, args, options) => {
        const child = process.platform === 'win32' ? spawn(process.execPath, [executable, ...args], options) : spawn(executable, args, options);
        children.push(new Promise(resolve => child.on('close', resolve)));
        return child;
      },
      packageRoot: fixture.config.node.packageRoot, stdout, env: {}, homedir: root, disableConnectionManager: true, probe: async () => ({ status: 'passed' }),
    });
    await Promise.all(children);
    const event = JSON.parse(stdout.write.mock.calls[0][0]);
    expect(event.config).toMatchObject({ command, developmentRuntime: true, ...(process.platform === 'win32' ? {} : { parentWatchFD: 3 }), bundle: { schemaVersion: 1 } });
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
