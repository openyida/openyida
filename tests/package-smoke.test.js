'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const packageJson = require('../package.json');

const ROOT = path.join(__dirname, '..');
const NPM_RUNNER = resolveNpmRunner();
const MAX_TARBALL_BYTES = 1536 * 1024;
const MAX_UNPACKED_BYTES = 4608 * 1024;
const MAX_ENTRY_COUNT = 350;
const PROJECT_ASSETS = Object.freeze([
  'config.json',
  'pages/src/demo-compat-smoke.oyd.jsx',
  'pages/src/demo-crm-batch-entry.oyd.jsx',
  'pages/src/demo-crm-dashboard.oyd.jsx',
  'pages/src/demo-salary-calculator.oyd.jsx',
  'prd/demo-crm.md',
  'prd/demo-salary-calculator.md',
]);
const SKILL_MANIFEST_EXCLUDES = Object.freeze(['skills/.DS_Store']);
const NETWORK_BLOCK_CODE = 'OPENYIDA_TEST_NETWORK_BLOCKED';

jest.setTimeout(240000);

describe('npm package smoke', () => {
  test('runtime dependencies stay lightweight for agent installs', () => {
    expect(packageJson.dependencies).not.toHaveProperty('playwright');
    expect(packageJson.dependencies).not.toHaveProperty('playwright-core');
  });

  test('one tgz passes mandatory extraction audit and isolated offline install smoke', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-package-gate-'));
    const artifactDir = path.join(tempRoot, 'artifact');
    const extractDir = path.join(tempRoot, 'extract');
    const installPrefix = path.join(tempRoot, 'prefix');
    const installWork = path.join(tempRoot, 'install-work');
    const smokeWork = path.join(tempRoot, 'smoke-work');
    const tempHome = path.join(tempRoot, 'home');
    const tempCache = path.join(tempRoot, 'npm-cache');
    const networkMarker = path.join(tempRoot, 'network-attempted');
    const networkBlocker = path.join(tempRoot, 'network-blocker.cjs');
    const userConfig = path.join(tempRoot, 'npm-user.ini');
    const globalConfig = path.join(tempRoot, 'npm-global.ini');
    for (const directory of [artifactDir, extractDir, installPrefix, installWork, smokeWork, tempHome, tempCache]) {
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(userConfig, '', 'utf8');
    fs.writeFileSync(globalConfig, '', 'utf8');
    writeNetworkBlocker(networkBlocker);
    const phaseEnv = minimalEnv({
      cache: tempCache,
      globalConfig,
      home: tempHome,
      networkBlocker,
      networkMarker,
      userConfig,
    });

    try {
      assertOutsideCheckout(tempRoot, 'package gate root');
      assertOutsideCheckout(installWork, 'install working directory');
      assertOutsideCheckout(smokeWork, 'smoke working directory');
      const sourceCache = resolveSourceNpmCache();
      seedIsolatedNpmCache(tempCache, sourceCache);
      assertNetworkBlockerCoverage(phaseEnv, installWork, networkMarker);

      const pack = runNpm(['pack', '--json', '--pack-destination', artifactDir], {
        cwd: ROOT,
        env: phaseEnv,
        timeout: 60000,
      });
      const [metadata] = JSON.parse(pack.stdout);
      const tgzPath = path.join(artifactDir, metadata.filename);
      expect(fs.existsSync(tgzPath)).toBe(true);

      run('tar', ['-xzf', tgzPath, '-C', extractDir], {
        cwd: installWork,
        env: phaseEnv,
        timeout: 60000,
      });
      const extractedRoot = path.join(extractDir, 'package');
      const extractedFiles = listFiles(extractedRoot);
      assertArchiveContract(extractedFiles);
      expect(fs.statSync(tgzPath).size).toBeLessThanOrEqual(MAX_TARBALL_BYTES);
      expect(sumFileBytes(extractedRoot, extractedFiles)).toBeLessThanOrEqual(MAX_UNPACKED_BYTES);
      expect(extractedFiles).toHaveLength(metadata.entryCount);
      expect(extractedFiles.length).toBeLessThanOrEqual(MAX_ENTRY_COUNT);
      expect(fs.existsSync(networkMarker)).toBe(false);

      runNpm([
        'install',
        '--prefix', installPrefix,
        '--offline',
        '--no-audit',
        '--no-fund',
        '--ignore-scripts=false',
        tgzPath,
      ], {
        cwd: installWork,
        env: phaseEnv,
        timeout: 180000,
      });
      expect(fs.existsSync(networkMarker)).toBe(false);

      const installedRoot = path.join(installPrefix, 'node_modules', 'openyida');
      const installedBin = path.join(installPrefix, 'node_modules', '.bin', process.platform === 'win32' ? 'openyida.cmd' : 'openyida');
      const installedEntry = path.join(installedRoot, 'bin', 'yida.js');
      expect(isInside(fs.realpathSync(installedRoot), fs.realpathSync(installPrefix))).toBe(true);
      expect(isInside(fs.realpathSync(installedRoot), fs.realpathSync(ROOT))).toBe(false);
      expect(fs.existsSync(installedBin)).toBe(true);
      assertInstalledWrapper(installedBin, installedEntry);
      for (const dependency of Object.keys(packageJson.dependencies)) {
        expect(fs.existsSync(path.join(installPrefix, 'node_modules', ...dependency.split('/'), 'package.json'))).toBe(true);
      }

      const commandEnv = minimalEnv({
        cache: tempCache,
        globalConfig,
        home: tempHome,
        networkBlocker,
        networkMarker,
        userConfig,
      }, {
        CODEX_CI: '1',
        OPENYIDA_LANG: 'en',
        OPENYIDA_SKIP_UPDATE_CHECK: '1',
        PATH: `${path.dirname(installedBin)}${path.delimiter}${path.dirname(process.execPath)}${path.delimiter}/usr/bin${path.delimiter}/bin`,
      });

      const help = runInstalledBin(installedBin, installedEntry, ['--help'], { cwd: smokeWork, env: commandEnv });
      expect(help.stdout).toContain('schema validate');
      expect(help.stdout).toContain('schema plan');
      expect(help.stdout).toContain('schema apply');

      const manifestPath = path.join(smokeWork, 'app.yida.json');
      fs.writeFileSync(manifestPath, `${JSON.stringify({
        kind: 'openyida_app_manifest',
        schemaVersion: 1,
        app: { key: 'packageSmoke', name: 'Package smoke' },
      }, null, 2)}\n`, 'utf8');
      const validate = runInstalledBin(installedBin, installedEntry, ['schema', 'validate', manifestPath, '--json', '--quiet'], {
        cwd: smokeWork,
        env: commandEnv,
      });
      expect(JSON.parse(validate.stdout.trim())).toMatchObject({
        kind: 'openyida_schema_validation',
        success: true,
      });

      assertSkillTreeHashes(extractedRoot, installedRoot, tempHome);

      runInstalledBin(installedBin, installedEntry, ['copy', '-project'], { cwd: smokeWork, env: commandEnv });
      expect(listFiles(path.join(smokeWork, 'project'))).toEqual(PROJECT_ASSETS);
      expect(fs.existsSync(networkMarker)).toBe(false);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

function assertArchiveContract(files) {
  const required = [
    'LICENSE',
    'README.md',
    'bin/yida.js',
    'lib/core/utils.js',
    'package.json',
    'scripts/postinstall.js',
    'yida-skills/SKILL.md',
    'yida-skills/references/schema-as-code-phase1.md',
    ...PROJECT_ASSETS.map(file => `project/${file}`),
  ];
  for (const file of required) {
    expect(files).toContain(file);
  }
  expect(files.filter(file => file.startsWith('project/')).sort()).toEqual(
    PROJECT_ASSETS.map(file => `project/${file}`)
  );
  expect(files.filter(file => file.startsWith('scripts/'))).toEqual(['scripts/postinstall.js']);
  expect(files.some(file => file.startsWith('tests/'))).toBe(false);
  expect(files.some(file => file.startsWith('mydocs/'))).toBe(false);
  expect(files.some(file => file.startsWith('docs/'))).toBe(false);
  expect(files.some(file => file.startsWith('node_modules/'))).toBe(false);
  expect(files.some(file => file.includes('/.cache/') || file.startsWith('.cache/'))).toBe(false);
  expect(files.filter(isSensitiveRuntimeFile)).toEqual([]);

  for (const file of files) {
    const allowed = [
      'bin/',
      'lib/',
      'agent/',
      'project/',
      'scripts/postinstall.js',
      'yida-skills/',
      'LICENSE',
      'README.md',
      'package.json',
    ].some(prefix => file === prefix || file.startsWith(prefix));
    expect(allowed).toBe(true);
  }
}

function minimalEnv(options, extra = {}) {
  const nodeOptions = `--require=${options.networkBlocker}`;
  return Object.freeze({
    CI: '1',
    HOME: options.home,
    USERPROFILE: options.home,
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    NODE_OPTIONS: nodeOptions,
    OPENYIDA_PACKAGE_NETWORK_MARKER: options.networkMarker,
    PATH: `${path.dirname(process.execPath)}${path.delimiter}/usr/bin${path.delimiter}/bin`,
    TMPDIR: path.dirname(options.networkBlocker),
    npm_config_audit: 'false',
    npm_config_cache: options.cache,
    npm_config_fund: 'false',
    npm_config_globalconfig: options.globalConfig,
    npm_config_offline: 'true',
    npm_config_prefix: path.join(options.home, '.npm-global'),
    npm_config_update_notifier: 'false',
    npm_config_userconfig: options.userConfig,
    ...extra,
  });
}

function seedIsolatedNpmCache(target, sourceCache) {
  const source = path.join(sourceCache, '_cacache');
  if (!fs.existsSync(source)) {
    throw new Error('Offline package install blocked: local npm content cache is unavailable');
  }
  const destination = path.join(target, '_cacache');
  fs.cpSync(source, destination, {
    recursive: true,
    force: false,
    errorOnExist: true,
    mode: fs.constants.COPYFILE_FICLONE,
  });
}

function resolveSourceNpmCache() {
  const env = {
    HOME: process.env.HOME || os.homedir(),
    USERPROFILE: process.env.USERPROFILE || os.homedir(),
    PATH: `${path.dirname(process.execPath)}${path.delimiter}/usr/bin${path.delimiter}/bin`,
    ...(process.env.npm_config_cache ? { npm_config_cache: process.env.npm_config_cache } : {}),
    ...(process.env.NPM_CONFIG_CACHE ? { NPM_CONFIG_CACHE: process.env.NPM_CONFIG_CACHE } : {}),
  };
  const result = runNpm(['config', 'get', 'cache'], { cwd: os.tmpdir(), env });
  const configured = result.stdout.trim();
  if (!configured || !path.isAbsolute(configured) || !fs.existsSync(configured)) {
    throw new Error('Offline package install blocked: effective npm cache is unavailable');
  }
  return fs.realpathSync(configured);
}

function resolveNpmRunner() {
  const candidates = [];
  if (process.env.npm_execpath) {
    candidates.push(process.env.npm_execpath);
  }
  candidates.push(path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'));
  candidates.push(path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'));
  candidates.push(path.join(path.dirname(process.execPath), process.platform === 'win32' ? 'npm.cmd' : 'npm'));
  for (const directory of String(process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    candidates.push(path.join(directory, process.platform === 'win32' ? 'npm.cmd' : 'npm'));
  }
  for (const candidate of candidates) {
    try {
      const real = fs.realpathSync(candidate);
      if (fs.statSync(real).isFile() && !isInside(real, path.join(ROOT, 'node_modules'))) {
        if (/\.cmd$/i.test(real)) {
          const adjacentCli = path.join(path.dirname(real), 'node_modules', 'npm', 'bin', 'npm-cli.js');
          if (fs.existsSync(adjacentCli) && fs.statSync(adjacentCli).isFile()) {
            return Object.freeze({ kind: 'node', path: fs.realpathSync(adjacentCli) });
          }
          return Object.freeze({ kind: 'cmd', path: real });
        }
        return Object.freeze({ kind: 'node', path: real });
      }
    } catch (error) {
      // Continue to the next fixed host npm candidate.
    }
  }
  throw new Error('npm CLI could not be resolved outside checkout node_modules');
}

function runNpm(args, options) {
  if (NPM_RUNNER.kind === 'cmd') {
    return runWindowsCommand(NPM_RUNNER.path, args, options);
  }
  return run(process.execPath, [NPM_RUNNER.path, ...args], options);
}

function writeNetworkBlocker(filePath) {
  const content = `'use strict';
const fs = require('fs');
const Module = require('module');
const marker = process.env.OPENYIDA_PACKAGE_NETWORK_MARKER;
const code = ${JSON.stringify(NETWORK_BLOCK_CODE)};
const dnsMethods = ${JSON.stringify([
    'lookup', 'lookupService', 'resolve', 'resolve4', 'resolve6', 'resolveAny',
    'resolveCaa', 'resolveCname', 'resolveMx', 'resolveNaptr', 'resolveNs',
    'resolvePtr', 'resolveSoa', 'resolveSrv', 'resolveTxt', 'reverse',
  ])};
const undiciNetworkMembers = new Set(${JSON.stringify([
    'Agent', 'BalancedPool', 'Client', 'Pool', 'ProxyAgent', 'RetryAgent',
    'connect', 'fetch', 'pipeline', 'request', 'stream', 'upgrade',
  ])});
function blocked(name) {
  return function blockNetwork() {
    if (marker) fs.writeFileSync(marker, name + '\\n', { flag: 'a' });
    const error = new Error('offline package gate blocked network primitive');
    error.code = code;
    throw error;
  };
}
for (const name of ['http', 'https']) {
  const mod = require(name);
  mod.request = blocked(name + '.request');
  mod.get = blocked(name + '.get');
}
const net = require('net');
net.connect = blocked('net.connect');
net.createConnection = blocked('net.createConnection');
net.Socket.prototype.connect = blocked('net.Socket.prototype.connect');
require('tls').connect = blocked('tls.connect');
require('http2').connect = blocked('http2.connect');
const dgram = require('dgram');
dgram.Socket.prototype.connect = blocked('dgram.Socket.prototype.connect');
dgram.Socket.prototype.send = blocked('dgram.Socket.prototype.send');
const dns = require('dns');
for (const name of dnsMethods) {
  if (typeof dns[name] === 'function') dns[name] = blocked('dns.' + name);
  if (dns.promises && typeof dns.promises[name] === 'function') dns.promises[name] = blocked('dns.promises.' + name);
  if (dns.Resolver && typeof dns.Resolver.prototype[name] === 'function') dns.Resolver.prototype[name] = blocked('dns.Resolver.prototype.' + name);
  if (dns.promises && dns.promises.Resolver && typeof dns.promises.Resolver.prototype[name] === 'function') dns.promises.Resolver.prototype[name] = blocked('dns.promises.Resolver.prototype.' + name);
}
global.fetch = blocked('fetch');
global.WebSocket = blocked('WebSocket');
const originalLoad = Module._load;
Module._load = function networkSafeLoad(request, parent, isMain) {
  if (request === 'undici' || request.startsWith('undici/')) {
    let original;
    try {
      original = originalLoad.call(Module, request, parent, isMain);
    } catch (error) {
      if (!error || error.code !== 'MODULE_NOT_FOUND') throw error;
      original = { Headers: global.Headers, Request: global.Request, Response: global.Response };
    }
    return new Proxy(original, {
      get(target, property, receiver) {
        if (undiciNetworkMembers.has(property)) return blocked('undici.' + String(property));
        return Reflect.get(target, property, receiver);
      }
    });
  }
  return originalLoad.call(Module, request, parent, isMain);
};
`;
  fs.writeFileSync(filePath, content, { encoding: 'utf8', mode: 0o600 });
}

function assertNetworkBlockerCoverage(env, cwd, marker) {
  const script = `'use strict';
const expectedCode = ${JSON.stringify(NETWORK_BLOCK_CODE)};
const dnsMethods = ${JSON.stringify([
    'lookup', 'lookupService', 'resolve', 'resolve4', 'resolve6', 'resolveAny',
    'resolveCaa', 'resolveCname', 'resolveMx', 'resolveNaptr', 'resolveNs',
    'resolvePtr', 'resolveSoa', 'resolveSrv', 'resolveTxt', 'reverse',
  ])};
const net = require('net');
const dgram = require('dgram');
const dns = require('dns');
const resolver = new dns.Resolver();
const promisesResolver = dns.promises && dns.promises.Resolver ? new dns.promises.Resolver() : null;
const undici = require('undici');
const checks = [
  ['http.get', () => require('http').get('http://blocked.invalid')],
  ['https.request', () => require('https').request('https://blocked.invalid')],
  ['net.connect', () => net.connect(1, 'blocked.invalid')],
  ['net.Socket.prototype.connect', () => new net.Socket().connect(1, 'blocked.invalid')],
  ['tls.connect', () => require('tls').connect(1, 'blocked.invalid')],
  ['http2.connect', () => require('http2').connect('https://blocked.invalid')],
  ['dgram.Socket.prototype.send', () => {
    const socket = dgram.createSocket('udp4');
    try { socket.send(Buffer.from('x'), 1, 'blocked.invalid'); } finally { socket.close(); }
  }],
  ['fetch', () => global.fetch('https://blocked.invalid')],
  ['WebSocket', () => new global.WebSocket('wss://blocked.invalid')],
  ['undici.request', () => undici.request('https://blocked.invalid')],
];
for (const name of dnsMethods) {
  if (typeof dns[name] === 'function') checks.push(['dns.' + name, () => dns[name]('blocked.invalid')]);
  if (dns.promises && typeof dns.promises[name] === 'function') checks.push(['dns.promises.' + name, () => dns.promises[name]('blocked.invalid')]);
  if (typeof resolver[name] === 'function') checks.push(['dns.Resolver.prototype.' + name, () => resolver[name]('blocked.invalid')]);
  if (promisesResolver && typeof promisesResolver[name] === 'function') checks.push(['dns.promises.Resolver.prototype.' + name, () => promisesResolver[name]('blocked.invalid')]);
}
for (const [name, operation] of checks) {
  try { operation(); throw new Error('network primitive escaped: ' + name); }
  catch (error) { if (!error || error.code !== expectedCode) throw error; }
}
if (!['Headers', 'Request', 'Response'].every(name => typeof undici[name] === 'function')) {
  throw new Error('undici pure constructors were not preserved');
}
process.stdout.write(JSON.stringify({ primitives: checks.map(([name]) => name) }));`;
  const result = run(process.execPath, ['-e', script], { cwd, env });
  const payload = JSON.parse(result.stdout);
  const attempts = fs.readFileSync(marker, 'utf8').trim().split(/\r?\n/).filter(Boolean);
  expect(attempts).toEqual(payload.primitives);
  fs.rmSync(marker, { force: true });
}

function assertOutsideCheckout(target, label) {
  const targetReal = fs.realpathSync(target);
  const rootReal = fs.realpathSync(ROOT);
  if (isInside(targetReal, rootReal) || isInside(rootReal, targetReal)) {
    throw new Error(`${label} must be outside the source checkout`);
  }
}

function isInside(child, parent) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertInstalledWrapper(installedBin, installedEntry) {
  if (process.platform === 'win32') {
    const wrapper = fs.readFileSync(installedBin, 'utf8').replace(/\\/g, '/');
    expect(wrapper).toContain('/openyida/bin/yida.js');
    return;
  }
  expect(fs.realpathSync(installedBin)).toBe(fs.realpathSync(installedEntry));
}

function runInstalledBin(installedBin, installedEntry, args, options) {
  if (process.platform === 'win32') {
    return runWindowsCommand(installedBin, args, options);
  }
  return run(installedBin, args, options);
}

function runWindowsCommand(command, args, options) {
  const comspec = process.env.ComSpec || process.env.COMSPEC || 'cmd.exe';
  const commandLine = [command, ...args].map(quoteWindowsArgument).join(' ');
  return run(comspec, ['/d', '/s', '/c', `"${commandLine}"`], options);
}

function quoteWindowsArgument(value) {
  return `"${String(value).replace(/%/g, '%%').replace(/(["^&|<>])/g, '^$1')}"`;
}

function assertSkillTreeHashes(extractedRoot, installedRoot, tempHome) {
  const copiedRoot = path.join(tempHome, '.claude', 'skills', 'yida-skills');
  expect(SKILL_MANIFEST_EXCLUDES).toEqual(['skills/.DS_Store']);
  const source = hashManifest(path.join(ROOT, 'yida-skills'));
  const extracted = hashManifest(path.join(extractedRoot, 'yida-skills'));
  const installed = hashManifest(path.join(installedRoot, 'yida-skills'));
  const copied = hashManifest(copiedRoot);
  expect(extracted).toEqual(source);
  expect(installed).toEqual(source);
  expect(copied).toEqual(source);
}

function hashManifest(root) {
  const manifest = {};
  for (const relative of listFiles(root)) {
    if (!SKILL_MANIFEST_EXCLUDES.includes(relative)) {
      manifest[relative] = hashFile(path.join(root, relative));
    }
  }
  return manifest;
}

function hashFile(filePath) {
  return require('crypto').createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function isSensitiveRuntimeFile(file) {
  if (!/^(bin|lib|agent|yida-skills)\//.test(file)) {
    return false;
  }
  const segments = file.split('/');
  const basename = segments[segments.length - 1];
  if (segments.some(segment => /^(?:\.cache|tmp|temp|backup|backups)$/i.test(segment))) {
    return true;
  }
  return /^\.env(?:\.|$)/i.test(basename) ||
    /^(?:credentials?|cookies?|sessions?|tokens?|secrets?|id_rsa|id_ed25519)(?:\.|$)/i.test(basename) ||
    /\.(?:key|pem|crt|cer|p12|pfx|log|map|bak|backup|tmp|temp|zip|tar|tgz|gz|7z)$/i.test(basename) ||
    /~$/.test(basename);
}

function listFiles(root) {
  const files = [];
  walk(root, '');
  return files.sort();

  function walk(directory, relative) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const entryRelative = relative ? `${relative}/${entry.name}` : entry.name;
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath, entryRelative);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        files.push(entryRelative);
      }
    }
  }
}

function sumFileBytes(root, files) {
  return files.reduce((total, file) => total + fs.statSync(path.join(root, file)).size, 0);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env || process.env,
    shell: false,
    timeout: options.timeout || 30000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error([
      `${command} ${args.join(' ')} failed with status ${result.status}`,
      result.error && result.error.message,
      result.stderr,
      result.stdout,
    ].filter(Boolean).join('\n'));
  }
  return { stdout: result.stdout || '', stderr: result.stderr || '' };
}
