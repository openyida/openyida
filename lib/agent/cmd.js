'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const { EventEmitter } = require('events');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { resolveRuntime, PROTOCOL_VERSION } = require('./runtime-package');
const { materializeBundle } = require('./frozen-bundle');
const { launchRuntime } = require('./stdio');
const { prepareConnection, listConnections } = require('./connection-store');
const { version, openyidaAgent = {} } = require('../../package.json');

const COMMANDS = ['doctor', 'status', 'connect', 'run', 'disconnect', 'logout'];
const VALUE_OPTIONS = {
  '--runtime-path': 'runtimePath', '--runtime-manifest': 'manifestPath',
  '--endpoint': 'endpoint', '--endpoint-id': 'endpointId', '--enroll': 'enrollmentToken',
  '--provider': 'provider', '--provider-path': 'providerPath', '--state-dir': 'stateDir',
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
    for (const directory of pathValue.split(path.delimiter).filter(Boolean)) {
      for (const candidateName of (provider === 'qoder' ? ['qodercli', 'qoder'] : [provider]).flatMap(name => extensions.map(extension => name + extension.toLowerCase()))) {
        const candidate = path.resolve(directory, candidateName);
        try {
          const resolved = fs.realpathSync(candidate);
          const stat = fs.statSync(resolved);
          fs.accessSync(resolved, platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK);
          if (stat.isFile()) {
            discovered.push({ profileId: `openyida.${provider}`, provider, executable: resolved });
            // One executable is enough for this built-in profile. Continue with
            // the next provider so one Connection can register every local CLI.
            break;
          }
        } catch {
          // Continue through the finite list of known provider executable names.
        }
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
    if (['--json', '--development-runtime'].includes(name)) {
      const key = name === '--json' ? 'json' : 'developmentRuntime';
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
  return result;
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
  };
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
  if (['connect', 'run'].includes(args.command) && (!config.endpoint || !config.endpointId) && !options.allowStoredConnections) {
    throw new CliError(t('agent.connection_options_required'), { code: 'AGENT_CONNECTION_OPTIONS_REQUIRED' });
  }
  if (args.provider || args.providerPath) {
    if (!PROVIDERS.includes(args.provider) || !args.providerPath || !path.isAbsolute(args.providerPath)) {
      throw new CliError(t('agent.provider_options_required'), { code: 'AGENT_PROVIDER_OPTIONS_INVALID' });
    }
    config.providers.push({ profileId: `openyida.${args.provider}`, provider: args.provider, executable: args.providerPath });
  }
  if (['connect', 'run'].includes(args.command) && config.providers.length === 0) {
    const discovered = discoverProviders(options.env || process.env, options.platform || process.platform);
    if (discovered.length === 0) {
      throw new CliError(t('agent.provider_not_found'), { code: 'AGENT_PROVIDER_NOT_FOUND' });
    }
    config.providers.push(...discovered);
  }
  return config;
}

async function run(argv = [], options = {}) {
  const args = parseArgs(argv);
  const stdout = options.stdout || process.stdout;
  if (args.command === 'help') {stdout.write(`${t('agent.usage')}\n`); return;}
  let runtime;
  try {
    runtime = resolveRuntime({ ...options, runtimePath: args.runtimePath, manifestPath: args.manifestPath, developmentRuntime: args.developmentRuntime === true });
  } catch (error) {
    if (args.command !== 'doctor') {throw error;}
    stdout.write(`${JSON.stringify({ type: 'doctor', ready: false, runtime: { installed: false, code: error.code, message: error.message }, providers: [], authKnown: false })}\n`);
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
  if (managedConnections && ['run', 'status', 'disconnect', 'logout'].includes(args.command)) {
    const connections = listConnections(config.stateDir);
    if (connections.length === 0) {
      // Development `status` has historically been a no-side-effect Runtime
      // probe before the first enrollment. Keep that useful empty-state
      // diagnostic while requiring a real Connection for all mutations/runs.
      if (args.developmentRuntime === true && args.command === 'status') {
        await launchRuntime(runtime, config, { ...options, stdout });
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
      return launchRuntime(runtime, connectionConfig, { ...options, stdout, signals: supervisorSignals });
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

module.exports = { parseArgs, buildLaunchConfig, discoverProvider, discoverProviders, run };
