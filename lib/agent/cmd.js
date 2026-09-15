'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { resolveRuntime, PROTOCOL_VERSION } = require('./runtime-package');
const { materializeBundle } = require('./frozen-bundle');
const { launchRuntime } = require('./stdio');
const { prepareConnection, listConnections } = require('./connection-store');
const { createDiagnosticLog, defaultDiagnosticDir, readRecentCredentialFailures } = require('./diagnostic-log');
const { version, openyidaAgent = {} } = require('../../package.json');

const COMMANDS = ['doctor', 'diagnose', 'status', 'connect', 'run', 'disconnect', 'logout'];
const VALUE_OPTIONS = {
  '--runtime-path': 'runtimePath', '--runtime-manifest': 'manifestPath',
  '--endpoint': 'endpoint', '--endpoint-id': 'endpointId', '--enroll': 'enrollmentToken',
  '--provider': 'provider', '--provider-path': 'providerPath', '--state-dir': 'stateDir',
  '--session': 'diagnosticSession', '--output': 'diagnosticOutput',
};

function safeUrl(value) {
  let url;
  try {url = new URL(value);} catch {throw new CliError(t('agent.identity_invalid'), { code: 'AGENT_ENDPOINT_INVALID' });}
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || url.search || url.hash) {
    throw new CliError(t('agent.identity_invalid'), { code: 'AGENT_ENDPOINT_INVALID' });
  }
  return url.toString().replace(/\/+$/, '');
}

const PROVIDERS = ['qoder', 'codex', 'opencode'];

function discoverProviders(env = process.env, platform = process.platform) {
  const pathValue = env.PATH || env.Path || env.path || '';
  const extensions = platform === 'win32'
    ? String(env.PATHEXT || '.EXE;.CMD;.BAT').split(';')
    : [''];
  const discovered = [];
  for (const provider of PROVIDERS) {
    const delimiter = platform === 'win32' ? ';' : ':';
    const names = provider === 'qoder' ? ['qodercli', 'qoder'] : [provider];
    for (const name of names) {
      for (const directory of pathValue.split(delimiter).filter(Boolean)) {
        for (const candidateName of extensions.map(extension => name + extension.toLowerCase())) {
          const candidate = path.resolve(directory, candidateName);
          try {
            const resolved = fs.realpathSync(candidate);
            const stat = fs.statSync(resolved);
            fs.accessSync(resolved, platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK);
            if (stat.isFile()) {
              discovered.push({ profileId: `openyida.${provider}`, provider, executable: resolved });
              break;
            }
          } catch {
            // Continue through the finite list of known executable names.
          }
        }
        if (discovered.some((item) => item.provider === provider)) {break;}
      }
      if (discovered.some((item) => item.provider === provider)) {break;}
    }
  }
  return discovered;
}

function discoverProvider(env = process.env, platform = process.platform) {
  return discoverProviders(env, platform)[0];
}

function parseArgs(args = []) {
  const result = { command: args[0] || 'help', json: false };
  if (args.includes('--help') || args.includes('-h')) {return { command: 'help' };}
  if (result.command === 'help') {return result;}
  if (!COMMANDS.includes(result.command)) {
    throw new CliError(t('agent.usage'), { code: 'INVALID_ARGUMENTS' });
  }
  for (let i = 1; i < args.length; i++) {
    const name = args[i];
    if (['--json', '--development-runtime', '--deep'].includes(name)) {
      const key = name === '--json' ? 'json' : name === '--deep' ? 'diagnosticDeep' : 'developmentRuntime';
      if (result[key] === true) {throw new CliError(t('agent.usage'), { code: 'INVALID_ARGUMENTS' });}
      result[key] = true;
      continue;
    }
    const key = VALUE_OPTIONS[name];
    if (!key || result[key] !== undefined || !args[i + 1] || args[i + 1].startsWith('--')) {
      throw new CliError(t('agent.usage'), { code: 'INVALID_ARGUMENTS' });
    }
    result[key] = args[++i];
  }
  if (result.enrollmentToken && result.command !== 'connect') {throw new CliError(t('agent.input_invalid'), { code: 'AGENT_INPUT_INVALID' });}
  if ((result.diagnosticSession || result.diagnosticOutput || result.diagnosticDeep) && result.command !== 'diagnose') {
    throw new CliError(t('agent.input_invalid'), { code: 'AGENT_INPUT_INVALID' });
  }
  return result;
}

function parseDiagnosticSession(value) {
  if (!value) {return null;}
  const direct = /^local_[a-zA-Z0-9_-]{1,200}$/.test(value) ? value : null;
  if (direct) {return { sessionId: direct, appType: null };}
  let parsed;
  try {parsed = new URL(value);} catch {parsed = null;}
  if (!parsed || parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new CliError(t('agent.diagnostic_session_invalid'), { code: 'AGENT_DIAGNOSTIC_SESSION_INVALID' });
  }
  const sessionId = parsed.searchParams.get('sessionId') || '';
  const appType = parsed.pathname.split('/').find(part => /^APP_[a-zA-Z0-9_-]{1,200}$/.test(part)) || null;
  if (!/^local_[a-zA-Z0-9_-]{1,200}$/.test(sessionId)) {
    throw new CliError(t('agent.diagnostic_session_invalid'), { code: 'AGENT_DIAGNOSTIC_SESSION_INVALID' });
  }
  return { sessionId, appType };
}

function writeDiagnosticSummary(args, config, results, stdout) {
  const diagnosticId = config.diagnosticId || `diag_${crypto.randomUUID()}`;
  const summary = { type: 'diagnostic', schemaVersion: 1, diagnosticId,
    phase: config.diagnosticSession ? 'session' : 'connection',
    sessionId: config.diagnosticSession || undefined, appType: config.diagnosticAppType || undefined,
    connections: results, findings: results.flatMap(item => Array.isArray(item.findings) ? item.findings : []) };
  // Connection-stage failures can predate any paired Connection or Session.
  // Do not attribute installation-wide history to an unrelated session.
  if (!config.diagnosticSession && config.diagnosticsDir) {
    summary.recentConnectionFailures = readRecentCredentialFailures(config.diagnosticsDir);
    if (summary.recentConnectionFailures.length) {
      summary.findings.push({ severity: 'warning', code: 'RECENT_DEVICE_CREDENTIAL_REJECTION',
        historical: true, action: 'CHECK_RECENT_CONNECTION_FAILURE_DETAILS' });
    }
  }
  const serialized = `${JSON.stringify(summary, null, args.json ? 0 : 2)}\n`;
  if (args.diagnosticOutput) {
    const output = path.resolve(args.diagnosticOutput);
    fs.mkdirSync(output, { recursive: true, mode: 0o700 });
    const target = path.join(output, `openyida-local-agent-diagnostic-${diagnosticId}.json`);
    fs.writeFileSync(target, serialized, { mode: 0o600, flag: 'wx' });
    summary.outputPath = target;
  }
  stdout.write(`${JSON.stringify(summary, null, args.json ? 0 : 2)}\n`);
}

function buildLaunchConfig(args, options = {}) {
  const packageRoot = options.packageRoot || path.resolve(__dirname, '..', '..');
  const stateDir = args.stateDir || path.join(options.homedir || os.homedir(), '.openyida', 'local-agent');
  if (!path.isAbsolute(stateDir)) {
    throw new CliError(t('agent.absolute_path_required'), { code: 'AGENT_STATE_PATH_INVALID' });
  }
  const config = {
    protocolVersion: PROTOCOL_VERSION,
    command: args.command,
    stateDir,
    node: { executable: process.execPath, cliEntry: path.join(packageRoot, 'bin', 'yida.js'), packageRoot, version },
    providers: [],
    diagnosticsDir: path.join(stateDir, 'logs'),
  };
  if (args.diagnosticId) {config.diagnosticId = args.diagnosticId;}
  if (args.developmentRuntime === true) {config.developmentRuntime = true;}
  const endpoint = args.endpoint || options.env?.OPENYIDA_AGENT_CONTROL_ENDPOINT || process.env.OPENYIDA_AGENT_CONTROL_ENDPOINT || openyidaAgent.endpoint;
  const endpointId = args.endpointId || options.env?.OPENYIDA_AGENT_ENDPOINT_ID || process.env.OPENYIDA_AGENT_ENDPOINT_ID || openyidaAgent.endpointId;
  if (endpoint) {config.endpoint = safeUrl(endpoint);}
  if (endpointId) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(endpointId)) {
      throw new CliError(t('agent.identity_invalid'), { code: 'AGENT_ENDPOINT_INVALID' });
    }
    config.endpointId = endpointId;
  }
  if (args.enrollmentToken) {
    if (args.enrollmentToken.length < 32 || args.enrollmentToken.length > 4096 || /\s/.test(args.enrollmentToken)) {
      throw new CliError(t('agent.input_invalid'), { code: 'AGENT_ENROLLMENT_TOKEN_INVALID' });
    }
    config.enrollmentToken = args.enrollmentToken;
  }
  if (args.diagnosticSession) {
    const diagnostic = parseDiagnosticSession(args.diagnosticSession);
    config.diagnosticSession = diagnostic.sessionId;
    if (diagnostic.appType) {config.diagnosticAppType = diagnostic.appType;}
  }
  if (args.diagnosticDeep === true) {config.diagnosticDeep = true;}
  if (['connect', 'run'].includes(args.command) && (!config.endpoint || !config.endpointId) && !options.allowStoredConnections) {
    throw new CliError(t('agent.connection_options_required'), { code: 'AGENT_CONNECTION_OPTIONS_REQUIRED' });
  }
  if (args.provider || args.providerPath) {
    if (!PROVIDERS.includes(args.provider) || !args.providerPath || !path.isAbsolute(args.providerPath)) {
      throw new CliError(t('agent.provider_options_required'), { code: 'AGENT_PROVIDER_OPTIONS_INVALID' });
    }
    config.providers.push({ profileId: `openyida.${args.provider}`, provider: args.provider, executable: args.providerPath });
  }
  if (['connect', 'run', 'diagnose'].includes(args.command) && config.providers.length === 0) {
    const discovered = discoverProviders(options.env || process.env, options.platform || process.platform);
    if (discovered.length === 0) {
      if (args.command !== 'diagnose') {
        throw new CliError(t('agent.provider_not_found'), { code: 'AGENT_PROVIDER_NOT_FOUND' });
      }
    }
    config.providers.push(...discovered);
  }
  return config;
}

async function run(argv = [], options = {}) {
  const args = parseArgs(argv);
  const stdout = options.stdout || process.stdout;
  if (args.command === 'help') {stdout.write(`${t('agent.usage')}\n`); return;}
  const diagnosticsDir = args.stateDir
    ? path.join(args.stateDir, 'logs')
    : defaultDiagnosticDir(options.homedir || os.homedir());
  const diagnostic = createDiagnosticLog(diagnosticsDir);
  diagnostic('info', 'launcher_started', { command: args.command, component: 'node', runtimeVersion: version });
  options = { ...options, diagnostic };
  if (args.command === 'diagnose') {args.diagnosticId = `diag_${crypto.randomUUID()}`;}
  let runtime;
  try {
    runtime = resolveRuntime({ ...options, runtimePath: args.runtimePath, manifestPath: args.manifestPath, developmentRuntime: args.developmentRuntime === true });
  } catch (error) {
    diagnostic('error', 'runtime_unavailable', { command: args.command, component: 'node', errorCode: error.code || 'AGENT_RUNTIME_NOT_AVAILABLE' });
    if (!['doctor', 'diagnose'].includes(args.command)) {throw error;}
    if (args.command === 'diagnose') {
      const correlation = parseDiagnosticSession(args.diagnosticSession);
      writeDiagnosticSummary(args, {
        diagnosticId: args.diagnosticId,
        diagnosticsDir,
        diagnosticSession: correlation?.sessionId,
        diagnosticAppType: correlation?.appType,
      }, [{ type: 'diagnostic', ready: false, phase: 'connection', runtime: { installed: false, code: error.code }, providers: [], findings: [{ severity: 'error', code: 'RUNTIME_NOT_AVAILABLE', action: 'INSTALL_OR_UPDATE_OPENYIDA' }] }], stdout);
      return;
    }
    stdout.write(`${JSON.stringify({ type: 'doctor', ready: false, authKnown: false, runtime: { installed: false, code: error.code }, providers: [] })}\n`);
    return;
  }
  // An unsigned development Runtime still uses the same installation and
  // per-organization Connection state as a production Runtime. Without this
  // preparation Go rejects `connect` before it can create an enrollment because
  // its state store correctly requires an installation identity.
  const managedConnections = options.disableConnectionManager !== true;
  let config = buildLaunchConfig(args, { ...options, allowStoredConnections: managedConnections && args.command === 'run' });
  if (managedConnections && args.command === 'connect') {
    const prepared = prepareConnection(config.stateDir, config.enrollmentToken);
    config = { ...config, stateDir: prepared.stateDir, installationId: prepared.installationId };
  }
  if (managedConnections && ['run', 'diagnose', 'status', 'disconnect', 'logout'].includes(args.command)) {
    const connections = listConnections(config.stateDir);
    const diagnosticResults = [];
    const diagnosticWriter = {write(value) {
      try {diagnosticResults.push(JSON.parse(String(value)));} catch { /* Runtime output is validated by launchRuntime. */ }
    }};
    if (connections.length === 0) {
      // Development `status` has historically been a no-side-effect Runtime
      // probe before the first enrollment. Keep that useful empty-state
      // diagnostic while requiring a real Connection for all mutations/runs.
      if (args.command === 'diagnose' || args.developmentRuntime === true && args.command === 'status') {
        await launchRuntime(runtime, config, { ...options, stdout: args.command === 'diagnose' ? diagnosticWriter : stdout });
        if (args.command === 'diagnose') {writeDiagnosticSummary(args, config, diagnosticResults, stdout);}
        return;
      }
      throw new CliError(t('agent.identity_invalid'), { code: 'AGENT_CONNECTION_NOT_FOUND' });
    }
    const upstreamSignals = options.signals || process;
    const supervisorSignals = new EventEmitter();
    // Each Connection owns one Go child and therefore one pair of signal
    // listeners. Multi-organization installations can legitimately exceed the
    // EventEmitter default of ten listeners; this emitter is private and all
    // listeners are removed when their child exits.
    supervisorSignals.setMaxListeners(0);
    const forwardInterrupt = () => supervisorSignals.emit('SIGINT');
    const forwardTerminate = () => supervisorSignals.emit('SIGTERM');
    upstreamSignals.on('SIGINT', forwardInterrupt);
    upstreamSignals.on('SIGTERM', forwardTerminate);
    const launches = connections.map((connection) => {
      const connectionConfig = {
        ...config,
        stateDir: connection.stateDir,
        installationId: connection.installationId,
        endpoint: connection.endpoint,
        endpointId: connection.endpointId,
      };
      if (args.command === 'run') {
        const frozen = materializeBundle(runtime, connectionConfig, options);
        return launchRuntime(frozen.runtime, frozen.config, { ...options, stdout, signals: supervisorSignals });
      }
      return launchRuntime(runtime, connectionConfig, { ...options,
        stdout: args.command === 'diagnose' ? diagnosticWriter : stdout, signals: supervisorSignals });
    });
    try {
      await Promise.all(launches);
    } catch (error) {
      supervisorSignals.emit('SIGTERM');
      await Promise.allSettled(launches);
      throw error;
    } finally {
      upstreamSignals.removeListener('SIGINT', forwardInterrupt);
      upstreamSignals.removeListener('SIGTERM', forwardTerminate);
    }
    if (args.command === 'diagnose') {
      writeDiagnosticSummary(args, config, diagnosticResults, stdout);
    }
    return;
  }
  if (['connect', 'run'].includes(args.command)) {
    const frozen = materializeBundle(runtime, config, options);
    runtime = frozen.runtime;
    config = frozen.config;
  }
  await launchRuntime(runtime, config, { ...options, stdout });
  if (args.command === 'connect') {
    const runConfig = { ...config, command: 'run' };
    delete runConfig.enrollmentToken;
    await launchRuntime(runtime, runConfig, { ...options, stdout });
  }
}

module.exports = { parseArgs, parseDiagnosticSession, buildLaunchConfig, discoverProvider, discoverProviders, run };
