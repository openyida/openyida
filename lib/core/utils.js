/**
 * utils.js - 宜搭 CLI 公共工具函数
 *
 * 导出函数：
 *   findProjectRoot()         - 查找项目根目录（兼容悟空环境）
 *   loadAuthData()            - 读取 token 登录态缓存
 *   triggerLogin()            - 触发登录
 *   refreshCsrfToken()        - 刷新 csrf_token
 *   resolveBaseUrl()          - 从 authData 中解析 base_url
 *   isLoginExpired()          - 检测响应体是否表示登录过期
 *   isCsrfTokenExpired()      - 检测响应体是否表示 csrf_token 过期
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { t } = require('./i18n');
const { warn } = require('./chalk');

// ── 项目根目录查找 ────────────────────────────────────

/**
 * 检测当前活跃的 AI 工具。
 * 优先级：环境变量 > 兜底检测
 *
 * 注意：只返回当前"活跃"的工具，不返回已安装但未使用的工具。
 *
 * @returns {{ tool: string, displayName: string, dirName: string, workspaceRoot: string }|null}
 */
function detectActiveTool() {
  const env = process.env;
  const cwd = process.cwd();
  const home = os.homedir();

  // 优先级1：通过环境变量检测

  // QoderWork (桌面客户端，__CFBundleIdentifier=com.qoder.work 或 QODERCLI_INTEGRATION_MODE=qoder_work)
  // 必须在 Claude Code 之前检测，因为 QoderWork 内部设置了 CLAUDE_CODE_ENTRYPOINT 会干扰后续判断
  if (
    env.QODERCLI_INTEGRATION_MODE === 'qoder_work' ||
    (env.__CFBundleIdentifier || '').toLowerCase().includes('qoder')
  ) {
    return {
      tool: 'qoderwork',
      displayName: 'QoderWork',
      dirName: '.qoderwork',
      workspaceRoot: path.join(cwd, 'project'),
    };
  }

  // Qoder IDE / Qoder Agent（CLI 集成模式）
  if (env.QODER_IDE || env.QODER_AGENT) {
    return {
      tool: 'qoder',
      displayName: 'Qoder',
      dirName: '.qoder',
      workspaceRoot: path.join(cwd, 'project'),
    };
  }

  // 悟空（Wukong）
  // Windows 路径可能使用反斜杠，需同时兼容正斜杠和反斜杠。
  // AGENT_WORK_ROOT 是悟空最明确的运行时信号，优先级高于可能继承到的
  // 外层 IDE/agent 环境变量。
  if (env.AGENT_WORK_ROOT && (env.AGENT_WORK_ROOT.includes('.real') || env.AGENT_WORK_ROOT.includes(path.join('.real')))) {
    return {
      tool: 'wukong',
      displayName: '悟空（Wukong）',
      dirName: '.real',
      workspaceRoot: resolveWukongWorkspaceRoot(env.AGENT_WORK_ROOT),
    };
  }

  // OpenAI Codex
  if (
    env.CODEX_SHELL ||
    env.CODEX_CI ||
    env.CODEX_THREAD_ID ||
    env.CODEX_HOME ||
    (env.__CFBundleIdentifier || '').toLowerCase().includes('codex')
  ) {
    return {
      tool: 'codex',
      displayName: 'Codex',
      dirName: '.codex',
      workspaceRoot: path.join(cwd, 'project'),
    };
  }

  // MuleRun（内部基于 Claude Code SDK，会同时设置 CLAUDE_CODE 变量，需先于 Claude Code 检测）
  if (env.MULERUN_CHAT_ID || env.MULE_DATA_DIR) {
    return {
      tool: 'mulerun',
      displayName: 'MuleRun',
      dirName: '.mulerun',
      workspaceRoot: path.join(cwd, 'project'),
    };
  }

  // Claude Code
  if (env.CLAUDE_CODE_ENTRYPOINT || env.CLAUDE_CODE) {
    return {
      tool: 'claude-code',
      displayName: 'Claude Code',
      dirName: '.claude',
      workspaceRoot: path.join(cwd, 'project'),
    };
  }

  // OpenCode
  // Windows 上配置目录为 ~/.config/opencode，macOS/Linux 为 ~/.opencode。
  // OpenCode 当前运行时会暴露 OPENCODE_CLIENT；保留 OPENCODE 兼容旧检测。
  if (env.OPENCODE || env.OPENCODE_CLIENT) {
    const opencodeDirName = process.platform === 'win32'
      ? path.join('.config', 'opencode')
      : '.opencode';
    return {
      tool: 'opencode',
      displayName: 'OpenCode',
      dirName: opencodeDirName,
      workspaceRoot: path.join(cwd, 'project'),
    };
  }

  // Cursor
  if (env.CURSOR_TRACE_ID || (env.VSCODE_GIT_ASKPASS_NODE || '').includes('Cursor')) {
    return {
      tool: 'cursor',
      displayName: 'Cursor',
      dirName: '.cursor',
      workspaceRoot: path.join(cwd, 'project'),
    };
  }

  // 优先级2：兜底检测

  // Aone Copilot - 通过专属配置目录检测（VSCode 环境）
  // Aone Copilot 没有独立的环境变量，但会在 home 目录创建 ~/.aone_copilot/
  if (env.TERM_PROGRAM === 'vscode' && fs.existsSync(path.join(home, '.aone_copilot'))) {
    return {
      tool: 'aone-copilot',
      displayName: 'Aone Copilot',
      dirName: '.aone_copilot',
      workspaceRoot: path.join(cwd, 'project'),
    };
  }

  // 未检测到活跃工具
  return null;
}

function hasDesktopEnvironment(env = process.env, platform = process.platform) {
  if (env.OPENYIDA_FORCE_TERMINAL_QR === '1') {
    return false;
  }
  if (env.OPENYIDA_ASSUME_DESKTOP === '1') {
    return true;
  }
  if (env.CI || env.CODEX_CI) {
    return false;
  }
  if (platform === 'darwin' || platform === 'win32') {
    return true;
  }
  if (platform === 'linux') {
    return !!(
      env.DISPLAY ||
      env.WAYLAND_DISPLAY ||
      env.MIR_SOCKET ||
      ['x11', 'wayland'].includes(String(env.XDG_SESSION_TYPE || '').toLowerCase())
    );
  }
  return false;
}

/**
 * 解析悟空工作区根目录。
 *
 * 悟空的 AGENT_WORK_ROOT 历史上有两种形态：
 *   - ~/.real/users/{uuid}/workspace/           直接就是工作区
 *   - ~/.real/users/{uuid}/                     workspace 在其下
 *
 * openyida copy 在空工作区会把 project/ 内容直接铺入工作区，因此这里优先
 * 识别已经含 config.json 的目录，最后回退到 AGENT_WORK_ROOT 本身。
 *
 * @param {string} agentWorkRoot
 * @returns {string}
 */
function resolveWukongWorkspaceRoot(agentWorkRoot) {
  if (!agentWorkRoot) {
    return path.join(os.homedir(), '.real', 'workspace');
  }

  const candidates = [
    agentWorkRoot,
    path.join(agentWorkRoot, 'project'),
    path.join(agentWorkRoot, 'workspace'),
    path.join(agentWorkRoot, 'workspace', 'project'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'config.json'))) {
      return candidate;
    }
  }

  return agentWorkRoot;
}

/**
 * 获取悟空环境的 node bin 目录路径
 * @returns {string|null} 悟空 node bin 目录路径，非悟空环境返回 null
 */
function getWukongNodeBinDir() {
  const activeTool = detectActiveTool();
  if (activeTool && activeTool.tool === 'wukong') {
    const wukongBin = path.join(os.homedir(), '.real', '.bin', 'node', 'bin');
    if (fs.existsSync(wukongBin)) {
      return wukongBin;
    }
  }
  return null;
}

/**
 * 获取当前环境应使用的 npm 可执行文件路径
 * 悟空环境优先使用悟空自带的 npm，避免权限问题
 * @returns {string} npm 可执行文件路径或命令名
 */
function getNpmExecutable() {
  const wukongBin = getWukongNodeBinDir();
  if (wukongBin) {
    const npmName = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const npmPath = path.join(wukongBin, npmName);
    if (fs.existsSync(npmPath)) {
      return npmPath;
    }
  }
  return 'npm';
}

/**
 * 获取当前环境应使用的 node 可执行文件路径
 * 悟空环境优先使用悟空自带的 node，避免权限问题
 * @returns {string} node 可执行文件路径或命令名
 */
function getNodeExecutable() {
  const wukongBin = getWukongNodeBinDir();
  if (wukongBin) {
    const nodeName = process.platform === 'win32' ? 'node.exe' : 'node';
    const nodePath = path.join(wukongBin, nodeName);
    if (fs.existsSync(nodePath)) {
      return nodePath;
    }
  }
  return 'node';
}

function isInjectedAuthMode(env = process.env) {
  return false;
}

function isEnvAuthMode(env = process.env) {
  return false;
}

function isTokenAuthMode(env = process.env) {
  return true;
}

function normalizeEnvBaseUrl(baseUrl, fallbackBaseUrl) {
  const raw = String(baseUrl || fallbackBaseUrl || 'https://www.aliwork.com').trim();
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return raw.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

/**
 * 查找项目根目录（project 工作区）。
 *
 * 查找策略：
 *   1. 通过环境变量检测当前活跃的 AI 工具
 *   2. 返回对应工具的项目根目录
 *   3. 兜底：返回 process.cwd()
 *
 * @returns {string} 项目根目录的绝对路径
 */
function findProjectRoot() {
  const activeTool = detectActiveTool();

  if (activeTool) {
    // 如果 project 目录存在，返回它；否则返回当前工作目录
    if (fs.existsSync(activeTool.workspaceRoot)) {
      return activeTool.workspaceRoot;
    }
  }

  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, 'config.json'))) {
    return cwd;
  }

  const nestedProjectRoot = path.join(cwd, 'project');
  if (fs.existsSync(path.join(nestedProjectRoot, 'config.json'))) {
    return nestedProjectRoot;
  }

  // 兜底：返回当前工作目录
  return cwd;
}

function resolveTokenBaseUrl(root, fallbackBaseUrl, session) {
  if (session && session.base_url) {
    return normalizeEnvBaseUrl(session.base_url, fallbackBaseUrl);
  }
  try {
    const { getCurrentEnvConfig } = require('./env-manager');
    const { config } = getCurrentEnvConfig(root);
    return normalizeEnvBaseUrl(process.env.OPENYIDA_ENDPOINT || config.baseUrl, fallbackBaseUrl);
  } catch {
    return fallbackBaseUrl;
  }
}

function loadTokenAuthData(projectRoot, defaultBaseUrl) {
  if (!isTokenAuthMode()) {
    return null;
  }
  try {
    const { loadTokenSession } = require('../auth/token-store');
    const session = loadTokenSession({ projectRoot });
    if (!session || !session.access_token) {
      return null;
    }
    return {
      csrf_token: 'openyida_cli_bearer',
      corp_id: session.corp_id,
      user_id: session.user_id,
      base_url: resolveTokenBaseUrl(projectRoot, defaultBaseUrl, session),
      auth_source: 'token',
      auth_mode: 'token',
    };
  } catch {
    return null;
  }
}

async function resolveBearerAuthHeaders(options = {}) {
  if (!isTokenAuthMode()) {
    return { tokenAuth: false, headers: {} };
  }
  const { getAccessToken } = require('../auth/token-auth');
  const accessToken = await getAccessToken({ projectRoot: options.projectRoot });
  return {
    tokenAuth: true,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
}

function stripCsrfFromPath(requestPath) {
  if (!requestPath || !requestPath.includes('_csrf_token') && !requestPath.includes('_tb_token_')) {
    return requestPath;
  }
  const [pathname, query = ''] = String(requestPath).split('?');
  if (!query) {
    return requestPath;
  }
  const params = new URLSearchParams(query);
  params.delete('_csrf_token');
  params.delete('_tb_token_');
  const nextQuery = params.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

function stripCsrfFromFormData(postData) {
  if (typeof postData !== 'string' || (!postData.includes('_csrf_token') && !postData.includes('_tb_token_'))) {
    return postData;
  }
  const params = new URLSearchParams(postData);
  params.delete('_csrf_token');
  params.delete('_tb_token_');
  return params.toString();
}

function stripCsrfFromPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }
  const next = { ...payload };
  delete next._csrf_token;
  delete next._tb_token_;
  return next;
}

// ── 登录态缓存读取 ────────────────────────────────────

/**
 * 读取 token 登录态缓存。
 * @param {string} [projectRoot]
 * @param {string} [defaultBaseUrl]
 * @returns {object|null}
 */
function loadAuthData(projectRoot, defaultBaseUrl) {
  const root = projectRoot || findProjectRoot();
  const fallbackBaseUrl = defaultBaseUrl || 'https://www.aliwork.com';
  return loadTokenAuthData(root, fallbackBaseUrl);
}

// ── 登录触发 ──────────────────────────────────────────

/**
 * 触发登录。
 * @param {object} [options]
 * @param {boolean} [options.force=false] - 是否跳过本地缓存，强制重新登录
 * @returns {object} loginResult
 */
function triggerLogin(options = {}) {
  const tokenAuthData = loadTokenAuthData(options.projectRoot || findProjectRoot(), 'https://www.aliwork.com');
  if (tokenAuthData) {
    return tokenAuthData;
  }
  const { CliError } = require('./cli-error');
  throw new CliError(
    'not_logged_in: token auth is unavailable. Run openyida login first.',
    {
      code: 'TOKEN_AUTH_REQUIRED',
      details: {
        authMode: 'token',
      },
    }
  );
}

/**
 * 历史兼容占位：token 模式不在客户端刷新 csrf_token。
 * @returns {object} loginResult
 */
function refreshCsrfToken() {
  return null;
}

// ── 响应检测 ──────────────────────────────────────────

/**
 * 检测响应体是否表示登录过期。
 * @param {object} responseJson
 * @returns {boolean}
 */
function isLoginExpired(responseJson) {
  if (!responseJson) {return false;}
  const status = String(responseJson.status || '').toLowerCase();
  const errorCode = String(responseJson.errorCode || responseJson.code || '').toLowerCase();
  const errorMsg = String(responseJson.errorMsg || responseJson.message || '').toLowerCase();
  if (status === 'not_logged_in' || errorCode === 'not_logged_in' || errorMsg.includes('not_logged_in')) {
    return true;
  }
  return (
    responseJson.success === false &&
    ['307', '302', '401', '403'].includes(errorCode)
  );
}

/**
 * 检测响应体是否表示 csrf_token 过期。
 * @param {object} responseJson
 * @returns {boolean}
 */
function isCsrfTokenExpired(responseJson) {
  return (
    responseJson &&
    responseJson.success === false &&
    responseJson.errorCode === 'TIANSHU_000030'
  );
}

function isHttpRedirectStatus(statusCode) {
  return [301, 302, 303, 307, 308].includes(Number(statusCode));
}

function isHttpAuthStatus(statusCode) {
  return [401, 403].includes(Number(statusCode));
}

// ── base_url 解析 ─────────────────────────────────────

/**
 * 从 authData 中解析 base_url，支持多环境配置优先级。
 *
 * 优先级（高 → 低）：
 *   1. OPENYIDA_ENDPOINT 环境变量
 *   2. authData.base_url（登录后实际跳转域名）
 *   3. 当前激活的私有化环境配置
 *   4. 当前激活的环境配置（公有云默认）
 *   5. defaultBaseUrl 参数 / 公有云兜底
 *
 * @param {object} authData
 * @param {string} [defaultBaseUrl]
 * @returns {string}
 */
function resolveBaseUrl(authData, defaultBaseUrl) {
  const { resolveEndpoint } = require('./env-manager');
  const resolved = resolveEndpoint(authData, undefined);
  if (defaultBaseUrl && resolved === 'https://www.aliwork.com' && (!authData || !authData.base_url)) {
    return defaultBaseUrl.replace(/\/+$/, '');
  }
  return resolved;
}

// ── HTTP 请求工具 ─────────────────────────────────────

function collectResponseText(res, onEnd) {
  const chunks = [];
  res.on('data', (chunk) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });
  res.on('end', () => {
    onEnd(Buffer.concat(chunks).toString('utf8'));
  });
}

/**
 * 发送 HTTP POST 请求（application/x-www-form-urlencoded）
 * @param {string} baseUrl
 * @param {string} requestPath
 * @param {string} postData - querystring 格式
 * @param {object} [optionsOverride]
 * @returns {Promise<object>}
 */
async function httpPost(baseUrl, requestPath, postData, optionsOverride = {}) {
  const https = require('https');
  const http = require('http');

  const auth = await resolveBearerAuthHeaders(optionsOverride);
  const tokenAuth = auth.tokenAuth;
  const effectiveRequestPath = tokenAuth ? stripCsrfFromPath(requestPath) : requestPath;
  const effectivePostData = tokenAuth ? stripCsrfFromFormData(postData) : postData;
  const bodyData = effectivePostData === null || effectivePostData === undefined ? '' : String(effectivePostData);

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(baseUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: effectiveRequestPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(bodyData),
        Accept: 'application/json, text/plain, */*',
        Origin: baseUrl,
        Referer: optionsOverride.referer || baseUrl + '/',
        'x-requested-with': 'XMLHttpRequest',
        ...auth.headers,
      },
      timeout: 30000,
    };

    const req = requestModule.request(options, (res) => {
      collectResponseText(res, (data) => {
        if (!optionsOverride.silentStatus) {
          warn(t('common.http_status', res.statusCode));
        }
        if (isHttpRedirectStatus(res.statusCode) || isHttpAuthStatus(res.statusCode)) {
          resolve({
            __needLogin: true,
            __httpStatus: res.statusCode,
            __location: res.headers.location || '',
          });
          return;
        }
        try {
          const parsed = JSON.parse(data);
          if (isLoginExpired(parsed)) {
            resolve({ __needLogin: true });
            return;
          }
          if (isCsrfTokenExpired(parsed)) {
            resolve({ __csrfExpired: true });
            return;
          }
          resolve(parsed);
        } catch {
          warn(t('common.http_response', data.substring(0, 500)));
          resolve({ success: false, errorMsg: `HTTP ${res.statusCode}: ` + t('common.response_not_json') });
        }
      });
    });

    // 用标志位防止 timeout 后 req.destroy() 触发 error 事件导致双重 reject
    let hasRejected = false;
    req.on('timeout', () => {
      hasRejected = true;
      req.destroy();
      reject(new Error(t('common.request_timeout')));
    });
    req.on('error', (err) => { if (!hasRejected) { reject(err); } });
    req.write(bodyData);
    req.end();
  });
}

async function httpPostJson(baseUrl, requestPath, payload, optionsOverride = {}) {
  const https = require('https');
  const http = require('http');

  const auth = await resolveBearerAuthHeaders(optionsOverride);
  const tokenAuth = auth.tokenAuth;
  const effectiveRequestPath = tokenAuth ? stripCsrfFromPath(requestPath) : requestPath;
  const effectivePayload = tokenAuth ? stripCsrfFromPayload(payload) : payload;

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(baseUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;
    const body = JSON.stringify(effectivePayload === undefined ? {} : effectivePayload);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: effectiveRequestPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        Accept: 'application/json, text/plain, */*',
        Origin: baseUrl,
        Referer: optionsOverride.referer || baseUrl + '/',
        'x-requested-with': 'XMLHttpRequest',
        ...auth.headers,
      },
      timeout: optionsOverride.timeout || 30000,
    };

    const req = requestModule.request(options, (res) => {
      collectResponseText(res, (data) => {
        if (!optionsOverride.silentStatus) {
          warn(t('common.http_status', res.statusCode));
        }
        if (isHttpRedirectStatus(res.statusCode) || isHttpAuthStatus(res.statusCode)) {
          resolve({
            __needLogin: true,
            __httpStatus: res.statusCode,
            __location: res.headers.location || '',
          });
          return;
        }
        try {
          const parsed = JSON.parse(data);
          if (isLoginExpired(parsed)) {
            resolve({ __needLogin: true });
            return;
          }
          if (isCsrfTokenExpired(parsed)) {
            resolve({ __csrfExpired: true });
            return;
          }
          resolve(parsed);
        } catch {
          warn(t('common.http_response', data.substring(0, 500)));
          resolve({ success: false, errorMsg: `HTTP ${res.statusCode}: ` + t('common.response_not_json') });
        }
      });
    });

    let hasRejected = false;
    req.on('timeout', () => {
      hasRejected = true;
      req.destroy();
      reject(new Error(t('common.request_timeout')));
    });
    req.on('error', (err) => { if (!hasRejected) { reject(err); } });
    req.write(body);
    req.end();
  });
}

/**
 * 发送 HTTP GET 请求
 * @param {string} baseUrl
 * @param {string} requestPath
 * @param {object} queryParams
 * @param {object} [optionsOverride]
 * @returns {Promise<object>}
 */
async function httpGet(baseUrl, requestPath, queryParams, optionsOverride = {}) {
  const https = require('https');
  const http = require('http');
  const querystring = require('querystring');

  const auth = await resolveBearerAuthHeaders(optionsOverride);
  const tokenAuth = auth.tokenAuth;

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(baseUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;
    const rawPath = queryParams ? `${requestPath}?${querystring.stringify(queryParams)}` : requestPath;
    const fullPath = tokenAuth ? stripCsrfFromPath(rawPath) : rawPath;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: fullPath,
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain, */*',
        Origin: baseUrl,
        Referer: baseUrl + '/',
        'x-requested-with': 'XMLHttpRequest',
        ...auth.headers,
      },
      timeout: 30000,
    };

    const req = requestModule.request(options, (res) => {
      collectResponseText(res, (data) => {
        if (!optionsOverride.silentStatus) {
          warn(t('common.http_status', res.statusCode));
        }
        if (isHttpRedirectStatus(res.statusCode) || isHttpAuthStatus(res.statusCode)) {
          resolve({
            __needLogin: true,
            __httpStatus: res.statusCode,
            __location: res.headers.location || '',
          });
          return;
        }
        try {
          const parsed = JSON.parse(data);
          if (isLoginExpired(parsed)) {
            resolve({ __needLogin: true });
            return;
          }
          if (isCsrfTokenExpired(parsed)) {
            resolve({ __csrfExpired: true });
            return;
          }
          resolve(parsed);
        } catch {
          warn(t('common.http_response', data.substring(0, 500)));
          resolve({ success: false, errorMsg: `HTTP ${res.statusCode}: ` + t('common.response_not_json') });
        }
      });
    });

    // 用标志位防止 timeout 后 req.destroy() 触发 error 事件导致双重 reject
    let hasRejected = false;
    req.on('timeout', () => {
      hasRejected = true;
      req.destroy();
      reject(new Error(t('common.request_timeout')));
    });
    req.on('error', (err) => { if (!hasRejected) { reject(err); } });
    req.end();
  });
}

/**
 * 带自动重登录的请求封装。
 * @param {Function} requestFn - 接受 authRef 返回 Promise 的工厂函数
 * @param {object} authRef - { csrfToken, baseUrl, authData }
 * @returns {Promise<object>}
 */
async function requestWithAutoLogin(requestFn, authRef) {
  const result = await requestFn(authRef);

  if (result && result.__csrfExpired) {
    return {
      success: false,
      __needLogin: true,
      errorCode: 'TOKEN_AUTH_REQUIRED',
      errorMsg: 'token_auth_failed: Bearer authenticated requests should not require client csrf_token.',
    };
  }

  if (result && result.__needLogin) {
    try {
      const { tokenRefresh } = require('../auth/token-auth');
      await tokenRefresh();
      const currentAuthData = authRef && authRef.authData;
      const refreshedTokenData = loadTokenAuthData(undefined, resolveBaseUrl(currentAuthData));
      if (refreshedTokenData) {
        authRef.authData = refreshedTokenData;
        authRef.csrfToken = refreshedTokenData.csrf_token;
        authRef.baseUrl = resolveBaseUrl(refreshedTokenData);
        authRef.authMode = refreshedTokenData.auth_mode || refreshedTokenData.authMode || '';
        authRef.authSource = refreshedTokenData.auth_source || refreshedTokenData.authSource || '';
        authRef.corpId = refreshedTokenData.corp_id || authRef.corpId || '';
        authRef.userId = refreshedTokenData.user_id || authRef.userId || '';
        return requestFn(authRef);
      }
    } catch {
      // Fall through to token auth error below.
    }
    return {
      success: false,
      __needLogin: true,
      errorCode: 'TOKEN_AUTH_REQUIRED',
      errorMsg: 'not_logged_in: token auth is unavailable. Run openyida login first.',
    };
  }

  return result;
}

module.exports = {
  detectActiveTool,
  hasDesktopEnvironment,
  findProjectRoot,
  loadAuthData,
  triggerLogin,
  refreshCsrfToken,
  resolveBaseUrl,
  isLoginExpired,
  isCsrfTokenExpired,
  httpPost,
  httpPostJson,
  httpGet,
  requestWithAutoLogin,
  getWukongNodeBinDir,
  getNpmExecutable,
  getNodeExecutable,
  resolveWukongWorkspaceRoot,
  isInjectedAuthMode,
  isEnvAuthMode,
  isTokenAuthMode,
};
