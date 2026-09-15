'use strict';

const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const { StringDecoder } = require('string_decoder');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');

const MAX_CONFIG_BYTES = 64 * 1024;
const MAX_OUTPUT_LINE_BYTES = 256 * 1024;
const ENV_KEYS = [
  'USERPROFILE', 'DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'PATH', 'TMPDIR', 'TMP', 'TEMP',
  'SystemRoot', 'SYSTEMROOT', 'COMSPEC', 'PATHEXT', 'APPDATA', 'LOCALAPPDATA',
  'LANG', 'LC_ALL', 'LC_CTYPE', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY',
  'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy', 'SSL_CERT_FILE',
  'NODE_EXTRA_CA_CERTS', 'OPENYIDA_AUTH_DIR', 'OPENYIDA_LANG',
  // Go needs the original provider home before creating its isolated home.
  // Only its location crosses this boundary; provider token env does not.
  'CODEX_HOME',
];

function runtimeEnvironment(env = process.env) {
  const result = {};
  for (const key of ENV_KEYS) {
    if (env[key] !== undefined) {result[key] = env[key];}
  }
  result.OPENYIDA_NO_AUTO_UPDATE = '1';
  result.OPENYIDA_MANAGED_RUNTIME = 'local';
  return result;
}

function readStdinJson(input = process.stdin, limit = MAX_CONFIG_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    function fail() {
      if (failed) {return;}
      failed = true;
      reject(new CliError(t('agent.input_invalid'), { code: 'AGENT_INPUT_INVALID' }));
    }
    input.on('data', (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > limit) {fail(); input.pause(); return;}
      chunks.push(Buffer.from(chunk));
    });
    input.once('error', fail);
    input.once('end', () => {
      if (failed) {return;}
      try {
        const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!data || typeof data !== 'object' || Array.isArray(data)) {fail(); return;}
        resolve(data);
      } catch {fail();}
    });
  });
}

// The launcher forwards signals; only Go owns provider cancellation, journal,
// reconnection and child processes. No cloud transport or retry loop lives here.
function launchRuntime(runtime, config, options = {}) {
  const watchesParent = ['connect', 'run'].includes(config.command);
  if (watchesParent) {config = process.platform === 'win32'
    ? { ...config, parentPID: process.pid } : { ...config, parentWatchFD: 3 };}
  const payload = JSON.stringify(config);
  if (Buffer.byteLength(payload) > MAX_CONFIG_BYTES) {
    throw new CliError(t('agent.input_invalid'), { code: 'AGENT_INPUT_INVALID' });
  }
  const stdout = options.stdout || process.stdout;
  const signals = options.signals || process;
  return new Promise((resolve, reject) => {
    const diagnostic = typeof options.diagnostic === 'function' ? options.diagnostic : () => {};
    let child;
    let failure;
    let pending = '';
    let killTimer;
    let stopping = false;
    let closed = false;
    let receivedEvent = false;
    const decoder = new StringDecoder('utf8');
    function stop(signal) {
      if (closed) {return;}
      if (stopping) {return;}
      stopping = true;
      if (process.platform === 'win32' && config.command === 'run') {
        // Windows child.kill does not deliver a catchable Unix signal. Ask the
        // owning Runtime to drain through its authenticated loopback control.
        const stopConfig = { ...config, command: 'disconnect', parentPID: 0, parentWatchFD: 0 };
        launchRuntime(runtime, stopConfig, { ...options, signals: new EventEmitter(), stdout: { write() {} } })
          .catch(() => { /* Bounded force-stop below preserves unknown status. */ });
      } else {
        child.kill(signal);
      }
      if (killTimer) {return;}
      killTimer = setTimeout(() => {
        failure = new CliError(t('agent.runtime_failed'), { code: 'AGENT_RUNTIME_STOP_UNCONFIRMED', details: { executionState: 'unknown' } });
        child.kill('SIGKILL');
      }, options.stopGraceMs === undefined ? 15000 : options.stopGraceMs);
      killTimer.unref();
    }
    const forwardInterrupt = () => stop('SIGINT');
    const forwardTerminate = () => stop('SIGTERM');
    function fail(code = 'AGENT_RUNTIME_OUTPUT_INVALID') {
      if (failure) {return;}
      diagnostic('error', 'runtime_output_failed', { command: config.command, component: 'node', errorCode: code });
      failure = new CliError(t('agent.runtime_failed'), { code });
      stop('SIGTERM');
    }
    function emitLine(line) {
      if (!line.trim() || failure) {return;}
      try {
        if (Buffer.byteLength(line) > MAX_OUTPUT_LINE_BYTES) {fail(); return;}
        const event = JSON.parse(line);
        if (!event || typeof event.type !== 'string' || !event.type || Array.isArray(event)) {fail(); return;}
        receivedEvent = true;
        if (event.type === 'error') {
          const code = typeof event.code === 'string' && /^[A-Z0-9_]{1,100}$/.test(event.code)
            ? event.code : 'AGENT_RUNTIME_FAILED';
          failure = new CliError(t('agent.runtime_failed'), { code, details: { retryable: event.retryable === true } });
          stop('SIGTERM');
          return;
        }
        stdout.write(`${JSON.stringify(event)}\n`);
      } catch {fail();}
    }
    try {
      child = (options.spawn || spawn)(runtime.executable, [config.command, '--stdio-config'], {
        cwd: config.node.packageRoot,
        env: runtimeEnvironment(options.env),
        stdio: watchesParent ? ['pipe', 'pipe', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        shell: false,
      });
      diagnostic('info', 'runtime_spawned', { command: config.command, component: 'node' });
    } catch {
      diagnostic('error', 'runtime_spawn_failed', { command: config.command, component: 'node', errorCode: 'AGENT_RUNTIME_START_FAILED' });
      reject(new CliError(t('agent.runtime_failed'), { code: 'AGENT_RUNTIME_START_FAILED' }));
      return;
    }
    signals.on('SIGINT', forwardInterrupt);
    signals.on('SIGTERM', forwardTerminate);
    // Config stdin intentionally reaches EOF after one JSON. This distinct
    // pipe remains open for the parent lifetime; Go treats EOF as stop/drain,
    // not successful completion. Do not send credentials on the watch pipe.
    const parentWatch = watchesParent && child.stdio && child.stdio[3];
    if (parentWatch) {parentWatch.on('error', () => {if (!closed) {fail('AGENT_RUNTIME_PARENT_WATCH_FAILED');}});}
    child.stdout.on('data', (chunk) => {
      pending += decoder.write(chunk);
      let newline;
      while ((newline = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        emitLine(line);
      }
      if (Buffer.byteLength(pending) > MAX_OUTPUT_LINE_BYTES) {pending = ''; fail();}
    });
    // Runtime diagnostics must be structured on stdout. Drain untrusted stderr
    // without echoing potential credentials or uncontrolled provider output.
    child.stderr.on('data', () => {});
    child.stdin.on('error', () => fail('AGENT_RUNTIME_INPUT_FAILED'));
    child.once('error', () => {
      diagnostic('error', 'runtime_spawn_failed', { command: config.command, component: 'node', errorCode: 'AGENT_RUNTIME_START_FAILED' });
      failure = new CliError(t('agent.runtime_failed'), { code: 'AGENT_RUNTIME_START_FAILED' });
    });
    child.once('close', (code, signal) => {
      diagnostic(code === 0 ? 'info' : 'error', 'runtime_closed', { command: config.command, component: 'node', closeCode: typeof code === 'number' ? code : -1, status: signal || (code === 0 ? 'completed' : 'failed') });
      closed = true;
      signals.removeListener('SIGINT', forwardInterrupt);
      signals.removeListener('SIGTERM', forwardTerminate);
      pending += decoder.end();
      if (pending) {emitLine(pending);}
      clearTimeout(killTimer);
      if (parentWatch) {parentWatch.destroy();}
      if (failure) {reject(failure); return;}
      if (!receivedEvent) {reject(new CliError(t('agent.runtime_failed'), { code: 'AGENT_RUNTIME_OUTPUT_INVALID' })); return;}
      if (code !== 0 || signal) {
        reject(new CliError(t('agent.runtime_failed'), { code: 'AGENT_RUNTIME_FAILED', details: { exitCode: code, signal } }));
        return;
      }
      resolve();
    });
    child.stdin.end(`${payload}\n`);
  });
}

module.exports = { MAX_CONFIG_BYTES, runtimeEnvironment, readStdinJson, launchRuntime };
