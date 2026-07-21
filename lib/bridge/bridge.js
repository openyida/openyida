'use strict';

const http = require('http');
const crypto = require('crypto');
const path = require('path');
const { spawn } = require('child_process');

const { parseOpenOption } = require('../core/browser-handoff');
const { resolveBrowserLauncher } = require('../auth/oauth-loopback');
const { banner, label, success, hint, fail } = require('../core/chalk');

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 6736;
const FALLBACK_PORT = 9432;
const DEFAULT_ORIGIN = 'https://demo.aliwork.com';
const DEFAULT_PAGE_URL = 'https://demo.aliwork.com/s/openyida';
const PROTOCOL_VERSION = 1;
const MAX_ACTION_OUTPUT_CHARS = 120000;
const CREATE_APP_TIMEOUT_MS = 120000;
const APP_LIST_TIMEOUT_MS = 30000;

const SAFE_DIAGNOSTIC_KEYS = [
  'activeTool',
  'currentEnv',
  'projectRootExists',
  'hasConfig',
  'cache_readable',
  'cacheReadable',
  'tokenFileFound',
  'tokenFound',
  'corp_id_found',
  'corpIdFound',
  'user_id_found',
  'userIdFound',
  'base_url_found',
  'baseUrlFound',
  'failure_reason',
  'failureReason',
];

function printUsage() {
  process.stderr.write(`
用法:
  openyida bridge start [--token <pair-token>] [--port 6736] [--origin https://demo.aliwork.com] [--open|--no-open]

说明:
  bridge 会启动只监听 127.0.0.1 的本地服务，供 https://demo.aliwork.com/s/openyida 探测和配对。
  页面可生成带 --token 的启动命令；token 仅用于本机配对，不包含会话内容。
  默认端口 6736，若默认端口被占用会自动尝试 9432。
`);
}

function packageVersion() {
  try {
    return require('../../package.json').version || '';
  } catch {
    return '';
  }
}

function readOptionValue(args, index, optionName) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${optionName} requires a value`);
  }
  return value;
}

function parsePort(value, optionName = '--port') {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`${optionName} must be an integer between 0 and 65535`);
  }
  return port;
}

function normalizeLoopbackHost(host) {
  const value = String(host || DEFAULT_HOST).trim();
  if (value === 'localhost' || value === DEFAULT_HOST || value === '::1') {
    return value;
  }
  throw new Error('--host only supports loopback hosts: 127.0.0.1, localhost, ::1');
}

function normalizeOrigin(origin) {
  const value = String(origin || '').trim();
  if (!value) {
    return '';
  }
  const parsed = new URL(value);
  return parsed.origin;
}

function normalizeOrigins(originValue) {
  return String(originValue || DEFAULT_ORIGIN)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map(normalizeOrigin);
}

function parseStartArgs(args) {
  const openOption = parseOpenOption(args);
  const filteredArgs = openOption.args;
  const options = {
    host: DEFAULT_HOST,
    port: process.env.OPENYIDA_BRIDGE_PORT ? parsePort(process.env.OPENYIDA_BRIDGE_PORT, 'OPENYIDA_BRIDGE_PORT') : DEFAULT_PORT,
    explicitPort: !!process.env.OPENYIDA_BRIDGE_PORT,
    origin: process.env.OPENYIDA_BRIDGE_ORIGIN || DEFAULT_ORIGIN,
    pageUrl: process.env.OPENYIDA_BRIDGE_PAGE_URL || DEFAULT_PAGE_URL,
    pairingToken: process.env.OPENYIDA_BRIDGE_TOKEN || '',
    openMode: openOption.mode,
    json: false,
  };

  for (let index = 0; index < filteredArgs.length; index++) {
    const arg = filteredArgs[index];
    if (arg === '--port' || arg === '-p') {
      options.port = parsePort(readOptionValue(filteredArgs, index, arg), arg);
      options.explicitPort = true;
      index++;
    } else if (arg === '--host') {
      options.host = normalizeLoopbackHost(readOptionValue(filteredArgs, index, arg));
      index++;
    } else if (arg === '--origin') {
      options.origin = readOptionValue(filteredArgs, index, arg);
      index++;
    } else if (arg === '--page' || arg === '--page-url') {
      options.pageUrl = readOptionValue(filteredArgs, index, arg);
      index++;
    } else if (arg === '--token') {
      options.pairingToken = readOptionValue(filteredArgs, index, arg);
      index++;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  options.host = normalizeLoopbackHost(options.host);
  options.origins = normalizeOrigins(options.origin);
  options.pageUrl = String(new URL(options.pageUrl));
  return options;
}

function parseArgs(args = []) {
  const command = args[0] || 'help';
  const subArgs = args.slice(1);

  if (command === 'start') {
    return { command, options: parseStartArgs(subArgs) };
  }
  if (command === '--help' || command === '-h' || command === 'help') {
    return { command: 'help', options: {} };
  }
  throw new Error(`Unknown bridge sub-command: ${command}`);
}

function randomToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function hostForUrl(host) {
  return host === '::1' ? '[::1]' : host;
}

function buildLocalBaseUrl(host, port) {
  return `http://${hostForUrl(host)}:${port}`;
}

function buildBridgePageUrl(pageUrl, bridge) {
  const url = new URL(pageUrl || DEFAULT_PAGE_URL);
  const params = new URLSearchParams();
  params.set('oy_bridge', '1');
  params.set('oy_bridge_url', bridge.localBaseUrl);
  params.set('oy_bridge_token', bridge.pairingToken);
  url.hash = params.toString();
  return url.toString();
}

function buildBridgeState(options = {}) {
  const host = normalizeLoopbackHost(options.host || DEFAULT_HOST);
  const port = Object.prototype.hasOwnProperty.call(options, 'port') ? options.port : DEFAULT_PORT;
  const pairingToken = options.pairingToken || randomToken();
  const accessToken = options.accessToken || randomToken();
  const origins = options.origins || normalizeOrigins(options.origin || DEFAULT_ORIGIN);
  const localBaseUrl = buildLocalBaseUrl(host, port);

  return {
    host,
    port,
    localBaseUrl,
    pageUrl: options.pageUrl || DEFAULT_PAGE_URL,
    pairingToken,
    accessToken,
    paired: false,
    origins,
    startedAt: new Date().toISOString(),
    loginSessions: new Map(),
    handlers: {
      checkLogin: options.checkLogin || null,
      startLogin: options.startLogin || null,
      pollLogin: options.pollLogin || null,
      selectCorp: options.selectCorp || null,
      readFeedbackConfig: options.readFeedbackConfig || null,
      createApp: options.createApp || null,
      listApps: options.listApps || null,
    },
  };
}

function isAllowedOrigin(origin, allowedOrigins) {
  if (!origin) {
    return true;
  }
  try {
    return allowedOrigins.includes(normalizeOrigin(origin));
  } catch {
    return false;
  }
}

function setCorsHeaders(req, res, state) {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin, state.origins)) {
    res.setHeader('Access-Control-Allow-Origin', normalizeOrigin(origin));
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-OpenYida-Token, Authorization');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Max-Age', '600');
}

function respondJson(req, res, state, statusCode, body) {
  if (req.bridgeJsonpCallback) {
    const payload = {
      ...body,
      statusCode,
    };
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(`${req.bridgeJsonpCallback}(${JSON.stringify(payload)});`);
    return;
  }

  setCorsHeaders(req, res, state);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readJsonBody(req, maxBytes = 1024 * 1024) {
  if (req.bridgeQueryBody) {
    return Promise.resolve(req.bridgeQueryBody);
  }

  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      raw += chunk;
      if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
        reject(new Error('Request body is too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Request body must be valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function getRequestToken(req) {
  if (req.bridgeAccessToken) {
    return req.bridgeAccessToken;
  }

  const headerToken = req.headers['x-openyida-token'];
  if (headerToken) {
    return String(Array.isArray(headerToken) ? headerToken[0] : headerToken);
  }

  const auth = req.headers.authorization || '';
  const matched = String(auth).match(/^Bearer\s+(.+)$/i);
  return matched ? matched[1] : '';
}

function authenticateRequest(req, state) {
  return state.paired && getRequestToken(req) === state.accessToken;
}

function maskId(value) {
  if (!value) {
    return null;
  }
  const text = String(value);
  if (text.length <= 8) {
    return `${text.slice(0, 2)}...`;
  }
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
}

function originFromUrl(value) {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function safeUrl(value) {
  if (!value) {
    return '';
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return '';
    }
    return url.toString();
  } catch {
    return '';
  }
}

function stripAnsi(value) {
  const escape = String.fromCharCode(27);
  return String(value || '').replace(new RegExp(escape + '\\[[0-?]*[ -/]*[@-~]', 'g'), '');
}

function containsControlCharacter(value) {
  return Array.from(String(value || '')).some((char) => {
    const code = char.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

function appendLimitedOutput(current, chunk) {
  const next = current + String(chunk || '');
  if (next.length <= MAX_ACTION_OUTPUT_CHARS) {
    return next;
  }
  return next.slice(next.length - MAX_ACTION_OUTPUT_CHARS);
}

function normalizeCreateAppInput(body = {}) {
  const appName = String(body.appName || body.name || '').trim();
  const description = String(body.description || body.desc || appName).trim();
  const locale = String(body.locale || body.contentLocale || body.lang || '').trim();

  if (!appName) {
    throw new Error('appName is required');
  }
  if (appName.length > 60) {
    throw new Error('appName must be 60 characters or less');
  }
  if (containsControlCharacter(appName)) {
    throw new Error('appName contains unsupported control characters');
  }
  if (description.length > 240) {
    throw new Error('description must be 240 characters or less');
  }
  if (locale && !/^[A-Za-z]{2,3}[-_][A-Za-z]{2,4}$/.test(locale)) {
    throw new Error('locale must look like zh_CN or en_US');
  }

  return {
    appName,
    description: description || appName,
    locale,
  };
}

function normalizeAppListInput(body = {}) {
  const size = Number(body.size || body.pageSize || 20);
  if (!Number.isInteger(size) || size < 1 || size > 100) {
    throw new Error('size must be an integer between 1 and 100');
  }
  return { size };
}

function parseCreateAppJsonOutput(stdout) {
  const lines = stripAnsi(stdout).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index--) {
    const line = lines[index];
    if (!line.startsWith('{') || !line.endsWith('}')) {
      continue;
    }
    try {
      const parsed = JSON.parse(line);
      if (parsed && (Object.prototype.hasOwnProperty.call(parsed, 'success') || parsed.appType || parsed.url)) {
        return parsed;
      }
    } catch {
      // Keep scanning earlier lines.
    }
  }
  return null;
}

function parseAppListJsonOutput(stdout) {
  const text = stripAnsi(stdout).trim();
  if (!text || text === '暂无应用') {
    return [];
  }
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) {
    return null;
  }
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getCliErrorMessage(stdout, stderr, fallback) {
  const text = stripAnsi([stderr, stdout].filter(Boolean).join('\n'));
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return (lines[lines.length - 1] || fallback || 'openyida command failed').slice(0, 600);
}

function sanitizeCreateAppResult(result = {}, params = {}) {
  const payload = result.app || result;
  return {
    success: payload.success !== false && (payload.success === true || !!payload.appType || !!payload.url),
    appName: String(payload.appName || params.appName || '').slice(0, 80),
    appType: payload.appType ? String(payload.appType).slice(0, 120) : '',
    url: safeUrl(payload.url),
    baseUrlOrigin: originFromUrl(payload.url || payload.baseUrl),
    corpId: maskId(payload.corpId || payload.corp_id),
  };
}

function sanitizeAppListResult(result = {}) {
  const apps = Array.isArray(result) ? result : (Array.isArray(result.apps) ? result.apps : []);
  return apps.slice(0, 100).map(app => ({
    appName: String(app.appName || app.name || '').slice(0, 120),
    appType: String(app.appType || '').slice(0, 160),
    systemLink: safeUrl(app.systemLink || app.url || app.link),
  })).filter(app => app.appName || app.appType || app.systemLink);
}

function getSafeJsonpCallback(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  if (!/^[A-Za-z_$][A-Za-z0-9_$]{0,80}$/.test(text)) {
    return '';
  }
  return text;
}

function isAllowedJsonpRequest(req, state) {
  const refererOrigin = originFromUrl(req.headers.referer || req.headers.referrer || '');
  return !!refererOrigin && isAllowedOrigin(refererOrigin, state.origins);
}

function buildQueryBody(url) {
  const body = {};
  url.searchParams.forEach((value, key) => {
    if (key !== 'callback' && key !== '_') {
      body[key] = value;
    }
  });
  return body;
}

function sanitizeDiagnostics(diagnostics = {}) {
  const result = {};
  for (const key of SAFE_DIAGNOSTIC_KEYS) {
    if (Object.prototype.hasOwnProperty.call(diagnostics, key)) {
      result[key] = diagnostics[key];
    }
  }
  return result;
}

function sanitizeLoginResult(result = {}) {
  const status = result.status || (result.ok ? 'ok' : 'unknown');

  if (status === 'need_corp_selection') {
    return {
      status,
      canAutoUse: false,
      organizations: (result.organizations || []).map((org) => ({
        corpId: org.corp_id || org.corpId,
        corpName: org.corp_name || org.corpName,
        mainOrg: !!(org.main_org || org.mainOrg),
      })),
    };
  }

  return {
    status,
    canAutoUse: !!(result.can_auto_use || result.canAutoUse),
    loggedIn: status === 'ok',
    authMode: result.auth_mode || result.authMode,
    authSource: result.auth_source || result.authSource,
    baseUrlOrigin: originFromUrl(result.base_url || result.baseUrl),
    corpId: maskId(result.corp_id || result.corpId),
    userId: maskId(result.user_id || result.userId),
    diagnostics: sanitizeDiagnostics(result.diagnostics || {}),
    message: result.message ? String(result.message).slice(0, 300) : undefined,
  };
}

function sanitizeQrLoginStart(result = {}, loginSessionId) {
  return {
    status: result.status || 'need_qr_scan',
    canAutoUse: false,
    loginSessionId,
    qrUrl: result.qr_url || result.qrUrl || '',
    qrImageOpened: !!result.qr_image_opened,
    pollable: true,
    pollIntervalMs: 1000,
    message: result.message || 'Scan the QR code with DingTalk, then poll login status.',
  };
}

function isTokenLoginStartResult(result = {}) {
  const authMode = result.auth_mode || result.authMode;
  return authMode === 'token' || result.status === 'token_login_required';
}

function sanitizeTokenLoginStart(result = {}) {
  const status = result.status || 'token_login_required';
  return {
    status,
    canAutoUse: !!(result.can_auto_use || result.canAutoUse),
    loggedIn: status === 'ok',
    authMode: result.auth_mode || result.authMode || 'token',
    authSource: result.auth_source || result.authSource,
    baseUrlOrigin: originFromUrl(result.base_url || result.baseUrl),
    corpId: maskId(result.corp_id || result.corpId),
    userId: maskId(result.user_id || result.userId),
    diagnostics: sanitizeDiagnostics(result.diagnostics || {}),
    pollable: false,
    loginSessionId: null,
    message: result.message ? String(result.message).slice(0, 300) : undefined,
  };
}

function sanitizeLoginStart(result = {}, loginSessionId) {
  if (isTokenLoginStartResult(result)) {
    return sanitizeTokenLoginStart(result);
  }
  return sanitizeQrLoginStart(result, loginSessionId);
}

function getBridgeInfo(state) {
  return {
    ok: true,
    name: 'openyida-bridge',
    protocol: 'openyida.local-bridge',
    protocolVersion: PROTOCOL_VERSION,
    version: packageVersion(),
    host: state.host,
    port: state.port,
    localBaseUrl: state.localBaseUrl,
    paired: state.paired,
    allowedOrigins: state.origins,
    capabilities: [
      'pair',
      'login.check',
      'feedback.url',
      'openyida.app-list',
      'openyida.create-app',
    ],
  };
}

function defaultCheckLogin() {
  const { getAuthStatus } = require('../core/utils');
  return getAuthStatus({ includeSecrets: false });
}

async function defaultStartLogin() {
  return {
    status: 'token_login_required',
    auth_mode: 'token',
    can_auto_use: false,
    message: 'Token-only auth does not support bridge QR login. Run openyida login first.',
  };
}

async function defaultPollLogin() {
  return {
    status: 'token_login_required',
    auth_mode: 'token',
    can_auto_use: false,
    message: 'Token-only auth does not support bridge QR polling. Run openyida login first.',
  };
}

async function defaultSelectCorp() {
  return {
    status: 'token_login_required',
    auth_mode: 'token',
    can_auto_use: false,
    message: 'Token-only auth does not support bridge organization selection.',
  };
}

function defaultReadFeedbackConfig(configPath) {
  const { readFeedbackConfig } = require('../feedback/feedback');
  return readFeedbackConfig(configPath);
}

function defaultCreateApp(params) {
  const cliPath = path.join(__dirname, '../../bin/yida.js');
  const args = [
    cliPath,
    'create-app',
    '--name',
    params.appName,
    '--desc',
    params.description || params.appName,
    '--no-open',
  ];
  if (params.locale) {
    args.push('--locale', params.locale);
  }

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        OPENYIDA_BRIDGE_ACTION: 'create-app',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill('SIGTERM');
      reject(new Error('openyida create-app timed out'));
    }, CREATE_APP_TIMEOUT_MS);

    child.stdout.on('data', chunk => {
      stdout = appendLimitedOutput(stdout, chunk.toString('utf8'));
    });
    child.stderr.on('data', chunk => {
      stderr = appendLimitedOutput(stderr, chunk.toString('utf8'));
    });
    child.on('error', error => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', code => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      const parsed = parseCreateAppJsonOutput(stdout);
      if (code !== 0 || !parsed || parsed.success === false) {
        reject(new Error(parsed && parsed.error ? parsed.error : getCliErrorMessage(stdout, stderr, 'openyida create-app failed')));
        return;
      }
      resolve(parsed);
    });
  });
}

function defaultListApps(params = {}) {
  const cliPath = path.join(__dirname, '../../bin/yida.js');
  const args = [
    cliPath,
    'app-list',
    '--size',
    String(params.size || 20),
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        OPENYIDA_BRIDGE_ACTION: 'app-list',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill('SIGTERM');
      reject(new Error('openyida app-list timed out'));
    }, APP_LIST_TIMEOUT_MS);

    child.stdout.on('data', chunk => {
      stdout = appendLimitedOutput(stdout, chunk.toString('utf8'));
    });
    child.stderr.on('data', chunk => {
      stderr = appendLimitedOutput(stderr, chunk.toString('utf8'));
    });
    child.on('error', error => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', code => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      const parsed = parseAppListJsonOutput(stdout);
      if (code !== 0 || !parsed) {
        reject(new Error(getCliErrorMessage(stdout, stderr, 'openyida app-list failed')));
        return;
      }
      resolve(parsed);
    });
  });
}

function getHandler(state, name, fallback) {
  return state.handlers[name] || fallback;
}

function mapLoginPollError(error) {
  const message = error && error.message ? error.message : String(error || '');
  if (/timeout|timed out|超时|二维码已过期|expired/i.test(message)) {
    return {
      waiting: true,
      status: /expired|过期/i.test(message) ? 'expired' : 'waiting_scan',
      message,
    };
  }
  return null;
}

async function handleLoginCheck(req, res, state) {
  const checkLogin = getHandler(state, 'checkLogin', defaultCheckLogin);
  const result = await checkLogin();
  respondJson(req, res, state, 200, {
    ok: true,
    login: sanitizeLoginResult(result),
  });
}

async function handleLoginStart(req, res, state) {
  const body = await readJsonBody(req);
  const checkLogin = getHandler(state, 'checkLogin', defaultCheckLogin);
  const current = await checkLogin();
  if (current && (current.status === 'ok' || current.can_auto_use)) {
    respondJson(req, res, state, 200, {
      ok: true,
      alreadyLoggedIn: true,
      login: sanitizeLoginResult(current),
    });
    return;
  }

  const startLogin = getHandler(state, 'startLogin', defaultStartLogin);
  const result = await startLogin(body);
  const tokenLoginStart = isTokenLoginStartResult(result);
  const loginSessionId = tokenLoginStart ? null : randomToken();
  if (!tokenLoginStart && result && result.session_file) {
    state.loginSessions.set(loginSessionId, {
      sessionFile: result.session_file,
      createdAt: new Date().toISOString(),
    });
  }

  respondJson(req, res, state, 200, {
    ok: true,
    login: sanitizeLoginStart(result, loginSessionId),
  });
}

async function handleLoginPoll(req, res, state) {
  const body = await readJsonBody(req);
  const loginSessionId = body.loginSessionId || body.login_session_id;
  const session = state.loginSessions.get(loginSessionId);
  if (!session) {
    respondJson(req, res, state, 404, {
      ok: false,
      error: 'login_session_not_found',
    });
    return;
  }

  const pollLogin = getHandler(state, 'pollLogin', defaultPollLogin);
  try {
    const result = await pollLogin(session.sessionFile, body);
    if (result && result.status === 'ok') {
      state.loginSessions.delete(loginSessionId);
    }
    respondJson(req, res, state, 200, {
      ok: true,
      login: sanitizeLoginResult(result),
    });
  } catch (error) {
    const waiting = mapLoginPollError(error);
    if (waiting) {
      respondJson(req, res, state, 200, {
        ok: true,
        login: waiting,
      });
      return;
    }
    throw error;
  }
}

async function handleLoginSelectCorp(req, res, state) {
  const body = await readJsonBody(req);
  const loginSessionId = body.loginSessionId || body.login_session_id;
  const session = state.loginSessions.get(loginSessionId);
  if (!session) {
    respondJson(req, res, state, 404, {
      ok: false,
      error: 'login_session_not_found',
    });
    return;
  }

  const selectCorp = getHandler(state, 'selectCorp', defaultSelectCorp);
  const result = await selectCorp(session.sessionFile, body);
  if (result && result.status === 'ok') {
    state.loginSessions.delete(loginSessionId);
  }
  respondJson(req, res, state, 200, {
    ok: true,
    login: sanitizeLoginResult(result),
  });
}

async function handleFeedbackUrl(req, res, state) {
  const body = await readJsonBody(req);
  const readFeedbackConfig = getHandler(state, 'readFeedbackConfig', defaultReadFeedbackConfig);
  const { buildFeedbackUrl } = require('../feedback/feedback');
  const config = readFeedbackConfig(body.configPath || body.config_path || '');
  const result = buildFeedbackUrl(config, {
    tool: body.tool,
    model: body.model,
    command: body.command,
    session: body.session || body.sessionId || body.session_id,
    version: body.version,
    reason: body.reason,
    diagnostics: body.diagnostics || body.diag,
  });

  respondJson(req, res, state, 200, {
    ok: true,
    url: result.url,
    metadata: result.metadata,
  });
}

async function handleCreateApp(req, res, state) {
  const body = await readJsonBody(req, 64 * 1024);
  let params;
  try {
    params = normalizeCreateAppInput(body);
  } catch (error) {
    respondJson(req, res, state, 400, {
      ok: false,
      error: 'invalid_create_app_payload',
      message: error && error.message ? error.message : 'Invalid create-app payload',
    });
    return;
  }

  const createApp = getHandler(state, 'createApp', defaultCreateApp);
  const result = await createApp(params, { state });
  const app = sanitizeCreateAppResult(result, params);
  if (!app.success) {
    respondJson(req, res, state, 500, {
      ok: false,
      error: 'create_app_failed',
      message: result && result.error ? String(result.error).slice(0, 600) : 'openyida create-app failed',
    });
    return;
  }

  respondJson(req, res, state, 200, {
    ok: true,
    action: 'openyida.create-app',
    app,
  });
}

async function handleAppList(req, res, state) {
  const body = await readJsonBody(req, 16 * 1024);
  let params;
  try {
    params = normalizeAppListInput(body);
  } catch (error) {
    respondJson(req, res, state, 400, {
      ok: false,
      error: 'invalid_app_list_payload',
      message: error && error.message ? error.message : 'Invalid app-list payload',
    });
    return;
  }

  const listApps = getHandler(state, 'listApps', defaultListApps);
  const result = await listApps(params, { state });
  const apps = sanitizeAppListResult(result);

  respondJson(req, res, state, 200, {
    ok: true,
    action: 'openyida.app-list',
    apps,
    count: apps.length,
  });
}

function requireAuth(req, res, state) {
  if (authenticateRequest(req, state)) {
    return true;
  }
  respondJson(req, res, state, 401, {
    ok: false,
    error: 'not_paired',
    message: 'Call POST /v1/pair with the pairing token first.',
  });
  return false;
}

async function handlePair(req, res, state) {
  const body = await readJsonBody(req);
  if (!body.token || body.token !== state.pairingToken) {
    respondJson(req, res, state, 401, {
      ok: false,
      error: 'invalid_pairing_token',
    });
    return;
  }

  state.paired = true;
  respondJson(req, res, state, 200, {
    ok: true,
    token: state.accessToken,
    protocolVersion: PROTOCOL_VERSION,
    localBaseUrl: state.localBaseUrl,
    allowedOrigins: state.origins,
    capabilities: getBridgeInfo(state).capabilities,
  });
}

async function handleRequest(req, res, state) {
  const url = new URL(req.url || '/', state.localBaseUrl);
  const pathName = url.pathname.replace(/\/+$/, '') || '/';
  const requestedJsonpCallback = url.searchParams.get('callback');
  if (requestedJsonpCallback) {
    const callback = getSafeJsonpCallback(requestedJsonpCallback);
    if (!callback) {
      respondJson(req, res, state, 400, {
        ok: false,
        error: 'invalid_jsonp_callback',
      });
      return;
    }
    req.bridgeJsonpCallback = callback;
    req.bridgeQueryBody = buildQueryBody(url);
    req.bridgeAccessToken = url.searchParams.get('accessToken') || url.searchParams.get('token') || '';
  }

  if (req.bridgeJsonpCallback && !isAllowedJsonpRequest(req, state)) {
    respondJson(req, res, state, 403, {
      ok: false,
      error: 'origin_not_allowed',
    });
    return;
  }

  if (!req.bridgeJsonpCallback && !isAllowedOrigin(req.headers.origin, state.origins)) {
    respondJson(req, res, state, 403, {
      ok: false,
      error: 'origin_not_allowed',
    });
    return;
  }

  if (req.method === 'OPTIONS') {
    setCorsHeaders(req, res, state);
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === 'GET' && pathName === '/v1/hello') {
    respondJson(req, res, state, 200, getBridgeInfo(state));
    return;
  }

  if (req.method === 'GET' && pathName === '/v1/status') {
    const authenticated = authenticateRequest(req, state);
    const payload = {
      ...getBridgeInfo(state),
      authenticated,
    };
    if (authenticated) {
      payload.login = sanitizeLoginResult(await getHandler(state, 'checkLogin', defaultCheckLogin)());
    }
    respondJson(req, res, state, 200, payload);
    return;
  }

  if ((req.method === 'POST' || req.bridgeJsonpCallback) && pathName === '/v1/pair') {
    await handlePair(req, res, state);
    return;
  }

  if (!requireAuth(req, res, state)) {
    return;
  }

  if ((req.method === 'POST' || req.bridgeJsonpCallback) && pathName === '/v1/actions/login/check') {
    await handleLoginCheck(req, res, state);
    return;
  }

  if ((req.method === 'POST' || req.bridgeJsonpCallback) && pathName === '/v1/actions/login/start') {
    await handleLoginStart(req, res, state);
    return;
  }

  if ((req.method === 'POST' || req.bridgeJsonpCallback) && pathName === '/v1/actions/login/poll') {
    await handleLoginPoll(req, res, state);
    return;
  }

  if ((req.method === 'POST' || req.bridgeJsonpCallback) && pathName === '/v1/actions/login/select-corp') {
    await handleLoginSelectCorp(req, res, state);
    return;
  }

  if ((req.method === 'POST' || req.bridgeJsonpCallback) && pathName === '/v1/actions/feedback-url') {
    await handleFeedbackUrl(req, res, state);
    return;
  }

  if ((req.method === 'POST' || req.bridgeJsonpCallback) && pathName === '/v1/actions/app-list') {
    await handleAppList(req, res, state);
    return;
  }

  if ((req.method === 'POST' || req.bridgeJsonpCallback) && pathName === '/v1/actions/create-app') {
    await handleCreateApp(req, res, state);
    return;
  }

  respondJson(req, res, state, 404, {
    ok: false,
    error: 'not_found',
  });
}

function createBridgeServer(options = {}) {
  const state = buildBridgeState(options);
  const server = http.createServer((req, res) => {
    handleRequest(req, res, state).catch((error) => {
      respondJson(req, res, state, 500, {
        ok: false,
        error: 'internal_error',
        message: error && error.message ? error.message : String(error),
      });
    });
  });
  server.bridgeState = state;
  return server;
}

function listenOn(server, host, port) {
  return new Promise((resolve, reject) => {
    function onError(error) {
      server.removeListener('listening', onListening);
      reject(error);
    }
    function onListening() {
      server.removeListener('error', onError);
      resolve();
    }
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

async function startBridgeServer(options = {}) {
  const server = createBridgeServer(options);
  const preferredPort = Object.prototype.hasOwnProperty.call(options, 'port') ? options.port : DEFAULT_PORT;
  const explicitPort = !!options.explicitPort || preferredPort === 0;
  const ports = explicitPort ? [preferredPort] : [preferredPort, FALLBACK_PORT];
  let lastError = null;

  for (const port of ports) {
    try {
      server.bridgeState.port = port;
      server.bridgeState.localBaseUrl = buildLocalBaseUrl(server.bridgeState.host, port);
      await listenOn(server, server.bridgeState.host, port);
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      server.bridgeState.port = actualPort;
      server.bridgeState.localBaseUrl = buildLocalBaseUrl(server.bridgeState.host, actualPort);
      const pageUrl = buildBridgePageUrl(server.bridgeState.pageUrl, server.bridgeState);
      return {
        server,
        state: server.bridgeState,
        host: server.bridgeState.host,
        port: actualPort,
        localBaseUrl: server.bridgeState.localBaseUrl,
        pageUrl,
      };
    } catch (error) {
      lastError = error;
      if (error.code !== 'EADDRINUSE' || explicitPort) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Failed to start bridge server');
}

function openExternalUrl(url) {
  // Reuse the shared launcher so the URL is passed as a single argument.
  // On Windows this avoids `cmd /c start` splitting the URL on `&`, which
  // would drop the bridge params carried in the URL hash
  // (oy_bridge_url / oy_bridge_token) and break bridge pairing.
  const { command, args } = resolveBrowserLauncher(url);

  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  if (child && typeof child.unref === 'function') {
    child.unref();
  }
}

async function runStart(options) {
  const result = await startBridgeServer(options);

  if (options.json) {
    console.log(JSON.stringify({
      ok: true,
      host: result.host,
      port: result.port,
      localBaseUrl: result.localBaseUrl,
      pageUrl: result.pageUrl,
      allowedOrigins: result.state.origins,
      protocolVersion: PROTOCOL_VERSION,
    }, null, 2));
  } else {
    banner('OpenYida Local Bridge');
    success(`Bridge is listening on ${result.localBaseUrl}`);
    label('Remote page', result.pageUrl);
    label('Allowed origin', result.state.origins.join(', '));
    hint('Press Ctrl+C to stop.');
  }

  if (options.openMode === true) {
    openExternalUrl(result.pageUrl);
  }

  const shutdown = () => {
    result.server.close(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

async function run(args = []) {
  let parsed;
  try {
    parsed = parseArgs(args);
  } catch (error) {
    fail(error.message);
    printUsage();
    process.exit(1);
  }

  if (parsed.command === 'help') {
    printUsage();
    return;
  }

  try {
    if (parsed.command === 'start') {
      await runStart(parsed.options);
    }
  } catch (error) {
    fail(error.message);
    process.exit(1);
  }
}

module.exports = {
  DEFAULT_HOST,
  DEFAULT_PORT,
  FALLBACK_PORT,
  DEFAULT_ORIGIN,
  DEFAULT_PAGE_URL,
  PROTOCOL_VERSION,
  buildBridgePageUrl,
  buildLocalBaseUrl,
  createBridgeServer,
  handleRequest,
  isAllowedOrigin,
  normalizeOrigins,
  parseArgs,
  sanitizeLoginResult,
  sanitizeAppListResult,
  sanitizeCreateAppResult,
  startBridgeServer,
  run,
};
