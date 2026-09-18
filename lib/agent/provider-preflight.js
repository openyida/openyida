'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { runtimeEnvironment } = require('./stdio');
const { t } = require('../core/i18n');

const PROVIDERS = ['qoder', 'codex', 'opencode'];
const DOCS = {
  qoder: 'https://docs.qoder.com/cli/installation',
  codex: 'https://developers.openai.com/codex/cli/',
  opencode: 'https://opencode.ai/docs/',
};

function exists(file) {
  try { return fs.statSync(file).isFile(); } catch { return false; }
}

// Finite installation locations only; never recursively search a user's disk.
function installationPaths(env, platform, home) {
  const join = path.join;
  const bin = home ? ['.local/bin', '.qoder/bin', '.codex/bin', '.opencode/bin'].map(p => join(home, p)) : [];
  const desktop = { qoder: [], codex: [], opencode: [] };
  const bundled = { qoder: [], codex: [], opencode: [] };
  if (platform === 'win32') {
    if (env.APPDATA) { bin.push(join(env.APPDATA, 'npm')); }
    if (env.LOCALAPPDATA) {
      desktop.qoder.push(join(env.LOCALAPPDATA, 'Programs/Qoder/Qoder.exe'));
      desktop.codex.push(join(env.LOCALAPPDATA, 'OpenAI/Codex/Codex.exe'));
      const root = join(env.LOCALAPPDATA, 'OpenAI/Codex/bin');
      try {
        const versions = fs.readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory())
          .map(d => join(root, d.name, 'codex.exe')).filter(exists)
          .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs).slice(0, 8);
        bundled.codex.push(...versions);
      } catch { /* Desktop CLI is optional. */ }
    }
    if (env.ProgramFiles) { desktop.qoder.push(join(env.ProgramFiles, 'Qoder/Qoder.exe')); }
  } else if (platform === 'darwin') {
    bin.push('/opt/homebrew/bin', '/usr/local/bin');
    for (const root of ['/Applications', ...(home ? [join(home, 'Applications')] : [])]) {
      desktop.qoder.push(join(root, 'Qoder.app/Contents/MacOS/Qoder'));
      desktop.qoder.push(join(root, 'QoderWork.app/Contents/MacOS/QoderWork'));
      desktop.codex.push(join(root, 'Codex.app/Contents/MacOS/Codex'));
      bundled.qoder.push(join(root, 'Qoder.app/Contents/Resources/bin/qodercli'));
      bundled.qoder.push(join(root, 'QoderWork.app/Contents/Resources/bin/qodercli'));
      bundled.codex.push(join(root, 'Codex.app/Contents/Resources/codex'));
    }
  } else {
    bin.push('/usr/local/bin', '/usr/bin');
    desktop.qoder.push('/opt/Qoder/qoder', '/opt/qoder/qoder');
    if (home) { desktop.qoder.push(join(home, '.local/share/applications/qoder.desktop')); }
  }
  return { bin, desktop, bundled };
}

function inventory(env = process.env, platform = process.platform, home = env.HOME || env.USERPROFILE || (env === process.env ? os.homedir() : '')) {
  const locations = installationPaths(env, platform, home);
  const paths = (env.PATH || env.Path || env.path || '').split(platform === 'win32' ? ';' : ':')
    .map(p => p.replace(/^"(.*)"$/, '$1')).filter(p => p && path.isAbsolute(p));
  const extensions = platform === 'win32' ? (env.PATHEXT || '.EXE;.CMD;.BAT').split(';').map(e => e.toLowerCase()) : [''];
  return PROVIDERS.map(provider => {
    const candidates = [];
    const desktopExecutables = locations.desktop[provider].map(candidate => {
      try { return fs.realpathSync(candidate); } catch { return path.resolve(candidate); }
    });
    for (const name of provider === 'qoder' ? ['qodercli', 'qoder'] : [provider]) {
      for (const dir of [...paths, ...locations.bin]) {
        for (const ext of extensions) { candidates.push(path.join(dir, name + ext)); }
      }
    }
    candidates.push(...locations.bundled[provider]);
    const found = [];
    for (const candidate of candidates) {
      try {
        const resolved = fs.realpathSync(candidate);
        // A GUI binary is not a CLI, even when its directory appears on PATH.
        if (desktopExecutables.some(p => p.toLowerCase() === resolved.toLowerCase())) { continue; }
        fs.accessSync(resolved, platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK);
        if (fs.statSync(resolved).isFile() && !found.includes(resolved)) { found.push(resolved); }
      } catch { /* Missing candidates are normal. */ }
    }
    return { provider, desktopDetected: locations.desktop[provider].some(exists) || locations.bundled[provider].some(exists), candidates: found };
  });
}

function discoverProviders(env = process.env, platform = process.platform, home) {
  return inventory(env, platform, home).filter(p => p.candidates.length).map(p => ({
    profileId: `openyida.${p.provider}`, provider: p.provider, executable: p.candidates[0],
  }));
}

// Match the Go Runtime's npm launcher handling; never evaluate a shell string.
function probeCommand(executable, args, platform = process.platform, env = process.env) {
  if (platform !== 'win32' || !/\.(cmd|bat)$/i.test(executable)) { return { executable, args }; }
  const script = executable.replace(/\.(cmd|bat)$/i, '.ps1');
  if (!exists(script)) { throw new Error('npm launcher has no PowerShell sibling; select a native CLI'); }
  return { executable: path.join(env.SystemRoot || env.SYSTEMROOT || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...args] };
}

// No prompts, model calls, login flows or provider output enter our report.
function probe(executable, args, rpc, options = {}) {
  const env = runtimeEnvironment(options.env || process.env);
  const platform = options.platform || process.platform;
  return new Promise(resolve => {
    const signals = options.signals || process;
    const interrupted = () => { stop(); finish({ status: 'probe_cancelled' }); };
    let child, timer, finished = false, output = '', pending = '', result;
    function stop() {
      if (!child || !child.pid) { return; }
      if (platform === 'win32') {
        execFile(path.join(env.SystemRoot || env.SYSTEMROOT || 'C:\\Windows', 'System32/taskkill.exe'),
          ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, timeout: 3000 }, () => {});
      } else {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
      }
    }
    function finish(value) {
      if (finished) { return; }
      finished = true;
      clearTimeout(timer);
      signals.removeListener('SIGINT', interrupted);
      signals.removeListener('SIGTERM', interrupted);
      resolve(value);
    }
    try {
      const command = probeCommand(executable, args, platform, env);
      child = (options.probeSpawn || spawn)(command.executable, command.args, {
        env, cwd: os.tmpdir(), shell: false, windowsHide: true,
        windowsVerbatimArguments: command.windowsVerbatimArguments,
        detached: platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'],
      });
      signals.once('SIGINT', interrupted);
      signals.once('SIGTERM', interrupted);
      timer = setTimeout(() => { stop(); finish({ status: 'probe_timeout' }); }, options.timeoutMs || 15000);
      child.on('error', () => finish({ status: 'launch_failed' }));
      child.stdin.on('error', () => {});
      child.stderr.on('data', chunk => { output = (output + chunk.toString()).slice(-65536); });
      child.stdout.on('data', chunk => {
        output = (output + chunk.toString()).slice(-65536);
        if (!rpc || result) { return; }
        pending += chunk.toString();
        if (pending.length > 262144) { stop(); finish({ status: 'protocol_unsupported' }); return; }
        let end;
        while ((end = pending.indexOf('\n')) >= 0) {
          const line = pending.slice(0, end); pending = pending.slice(end + 1);
          try {
            const message = JSON.parse(line);
            if (message.id !== 1) { continue; }
            const valid = rpc === 'qoder' ? message.result?.protocolVersion === 1 : typeof message.result?.userAgent === 'string';
            result = { status: valid ? 'passed' : 'protocol_unsupported' };
            stop();
          } catch { /* Ignore non-protocol startup banners. */ }
        }
      });
      child.on('close', code => finish(result || { status: rpc ? 'protocol_unsupported' : code === 0 ? 'passed' : 'probe_failed', output }));
      if (rpc) {
        const params = rpc === 'qoder'
          ? { protocolVersion: 1, clientCapabilities: {}, clientInfo: { name: 'openyida-preflight', version: '1' } }
          : { clientInfo: { name: 'openyida-preflight', version: '1' }, capabilities: {} };
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params }) + '\n');
      } else { child.stdin.end(); }
    } catch { finish({ status: 'launch_failed' }); }
  });
}

async function checkProvider(provider, executable, options) {
  const execute = options.probe || probe;
  const version = await execute(executable, ['--version'], null, options);
  if (version.status !== 'passed') { return { status: version.status }; }
  if (provider === 'opencode') { return { status: 'available', authKnown: false, protocolProbe: 'not_run' }; }
  const protocol = await execute(executable, provider === 'qoder' ? ['--acp'] : ['app-server', '--listen', 'stdio://'], provider, options);
  if (protocol.status !== 'passed') { return { status: protocol.status === 'probe_failed' ? 'protocol_unsupported' : protocol.status }; }
  const auth = await execute(executable, provider === 'qoder' ? ['--list-models'] : ['login', 'status'], null, options);
  if (/\bnot logged in\b|\bnot authenticated\b|\bplease (?:log|sign) in\b/i.test(auth.output || '')) {
    return { status: 'login_required', authKnown: true, protocolProbe: 'passed' };
  }
  return { status: auth.status === 'passed' ? 'ready' : auth.status, authKnown: auth.status === 'passed', protocolProbe: 'passed' };
}

function remediation(provider, status, executable, platform) {
  const command = executable || (provider === 'qoder' ? 'qodercli' : provider);
  const quoted = platform === 'win32' ? `& '${command.replace(/'/g, "''")}'` : `'${command.replace(/'/g, "'\\''")}'`;
  const login = status === 'login_required';
  return {
    action: login ? 'LOGIN' : status === 'cli_not_found' ? 'INSTALL_OR_SELECT_CLI' : 'CHECK_CLI',
    requiresUserInteraction: login,
    documentationUrl: DOCS[provider],
    ...(status === 'cli_not_found' ? { installCommand: 'npm install -g ' + ({ qoder: '@qoder-ai/qodercli', codex: '@openai/codex', opencode: 'opencode-ai' })[provider] } : {}),
    ...(login ? { command: `${quoted} login`, shell: platform === 'win32' ? 'powershell' : 'sh' } : {}),
    providerPathOption: `--provider ${provider} --provider-path <absolute-cli-path>`,
    retry: 'repeat_original_connect_command',
    verifyCommand: 'openyida agent doctor --json',
  };
}

async function preflight(args, options = {}) {
  const platform = options.platform || process.platform;
  const entries = args.providerPath ? [{ provider: args.provider, candidates: [args.providerPath], desktopDetected: false }]
    : inventory(options.env || process.env, platform, options.homedir).filter(p => !args.provider || p.provider === args.provider);
  const providers = await Promise.all(entries.map(async entry => {
    let result = { status: 'cli_not_found' }, executable;
    // Try a small number of installations; a stale PATH entry must not hide a working bundled CLI.
    const deadline = Date.now() + (options.budgetMs || 30000);
    const boundedProbe = async (exe, flags, rpc, opts) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) { return { status: 'probe_timeout' }; }
      return (options.probe || probe)(exe, flags, rpc, { ...opts, timeoutMs: Math.min(options.timeoutMs || 15000, remaining) });
    };
    for (const candidate of entry.candidates.slice(0, 4)) {
      executable = candidate;
      result = await checkProvider(entry.provider, executable, { ...options, probe: boundedProbe });
      if (Date.now() >= deadline || ['ready', 'available', 'login_required', 'probe_cancelled'].includes(result.status)) { break; }
    }
    const usable = ['ready', 'available'].includes(result.status);
    return { provider: entry.provider, desktopDetected: entry.desktopDetected, executable, ...result, usable,
      message: t(`agent.preflight_${result.status}`),
      ...(!usable ? { remediation: remediation(entry.provider, result.status, executable, platform) } : {}),
    };
  }));
  return { schemaVersion: 1, type: 'preflight', platform, ready: providers.some(p => p.usable) && !providers.some(p => p.status === 'probe_cancelled'),
    paidPromptExecuted: false, providers };
}

module.exports = { discoverProviders, inventory, installationPaths, probeCommand, probe, preflight };
