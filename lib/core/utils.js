/**
 * utils.js - 宜搭 CLI 公共工具函数
 *
 * 导出函数：
 *   findProjectRoot()         - 查找项目根目录（兼容悟空环境）
 *   extractInfoFromCookies()  - 从 Cookie 列表中提取 csrf_token / corp_id / user_id
 *   loadCookieData()          - 读取 .cache/cookies.json 登录态缓存
 *   getAuthStatus()           - 读取当前鉴权模式的安全状态摘要
 *   triggerLogin()            - 触发登录
 *   refreshCsrfToken()        - 刷新 csrf_token
 *   resolveBaseUrl()          - 从 cookieData 中解析 base_url
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
  const authEnabled = String(env.YIDA_AUTH_ENABLED || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(authEnabled);
}

function hasEnvCookieAuth(env = process.env) {
  return !!String(env.OPENYIDA_COOKIE_B64 || '').trim();
}

function isEnvAuthMode(env = process.env) {
  return isInjectedAuthMode(env);
}

function isTokenAuthMode(env = process.env) {
  return !isEnvAuthMode(env);
}

let lastEnvAuthError = null;

function getLastEnvAuthError() {
  return lastEnvAuthError;
}

function setLastEnvAuthError(code, failureReason, message) {
  lastEnvAuthError = {
    code,
    failure_reason: failureReason,
    message,
    authMode: 'cookie',
  };
  return lastEnvAuthError;
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
    if (!session || (!session.access_token && !session.refresh_token)) {
      return null;
    }
    return {
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

// ── Cookie 解析 ───────────────────────────────────────

const CSRF_COOKIE_NAMES = new Set([
  'tianshu_csrf_token',
  'china_csrf_token',
  'csrf_token',
  '_csrf_token',
]);

/**
 * 从 Cookie 列表中提取 csrf_token、corp_id、user_id。
 *
 * 国内宜搭（aliwork.com）：corpId/userId 合并写在 `tianshu_corp_user` 里，
 * 形如 `${corpId}_${userId}`，按最后一个下划线切分。
 *
 * 海外 YiDA（yidaapps.com）：不写 `tianshu_corp_user`，而是单独写 `corp_id` cookie
 * 存放 corpId 明文；userId 加密在 `pub_uid` 里客户端无法解密，留 null 接受。
 *
 * @param {Array} cookies
 * @returns {{ csrfToken: string|null, corpId: string|null, userId: string|null }}
 */
function extractInfoFromCookies(cookies) {
  let csrfToken = null;
  let corpId = null;
  let userId = null;
  const cookieList = Array.isArray(cookies) ? cookies : [];

  for (const cookie of cookieList) {
    if (cookie && CSRF_COOKIE_NAMES.has(cookie.name) && cookie.value && !csrfToken) {
      csrfToken = cookie.value;
    } else if (cookie && cookie.name === 'tianshu_corp_user') {
      const lastUnderscore = cookie.value.lastIndexOf('_');
      if (lastUnderscore > 0) {
        corpId = cookie.value.slice(0, lastUnderscore);
        userId = cookie.value.slice(lastUnderscore + 1);
      }
    }
  }

  if (!corpId) {
    const corpCookie = cookieList.find((c) => c && ['corp_id', 'corpId'].includes(c.name) && c.value);
    if (corpCookie) {
      corpId = corpCookie.value;
    }
  }

  if (!userId) {
    const userCookie = cookieList.find((c) => c && ['user_id', 'userId', 'staffId'].includes(c.name) && c.value);
    if (userCookie) {
      userId = userCookie.value;
    }
  }

  return { csrfToken, corpId, userId };
}

function parseCookieHeader(rawCookieHeader, options = {}) {
  const raw = String(rawCookieHeader || '').trim();
  if (!raw) {
    return [];
  }
  let domain = '';
  if (options.baseUrl) {
    try {
      domain = new URL(options.baseUrl).hostname;
    } catch {
      domain = '';
    }
  }
  return raw
    .split(';')
    .map((part) => {
      const trimmed = part.trim();
      const equalsIndex = trimmed.indexOf('=');
      if (equalsIndex <= 0) {
        return null;
      }
      const name = trimmed.slice(0, equalsIndex).trim();
      const value = trimmed.slice(equalsIndex + 1).trim();
      if (!name) {
        return null;
      }
      const cookie = { name, value };
      if (domain) {
        cookie.domain = domain;
      }
      return cookie;
    })
    .filter(Boolean);
}

function decodeCookieHeaderFromBase64(encodedCookie) {
  const normalized = String(encodedCookie || '').trim().replace(/\s+/g, '');
  if (!normalized) {
    return null;
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    return null;
  }
  try {
    const decoded = Buffer.from(normalized, 'base64').toString('utf8').trim();
    return decoded && decoded.includes('=') ? decoded : null;
  } catch {
    return null;
  }
}

function loadEnvCookieData(defaultBaseUrl, env = process.env) {
  lastEnvAuthError = null;
  const encodedCookie = String(env.OPENYIDA_COOKIE_B64 || '').trim();
  if (!encodedCookie) {
    if (isInjectedAuthMode(env)) {
      setLastEnvAuthError(
        'not_logged_in',
        'env_cookie_missing',
        'OPENYIDA_COOKIE_B64 is not set'
      );
    }
    return null;
  }

  const baseUrl = normalizeEnvBaseUrl(env.OPENYIDA_BASE_URL, defaultBaseUrl);
  if (!baseUrl) {
    setLastEnvAuthError(
      'not_logged_in',
      'base_url_invalid',
      'OPENYIDA_BASE_URL is invalid'
    );
    return null;
  }

  const rawCookieHeader = decodeCookieHeaderFromBase64(encodedCookie);
  if (!rawCookieHeader) {
    setLastEnvAuthError(
      'not_logged_in',
      'env_cookie_decode_failed',
      'OPENYIDA_COOKIE_B64 is not a valid base64 encoded Cookie header'
    );
    return null;
  }

  const cookies = parseCookieHeader(rawCookieHeader, { baseUrl });
  if (cookies.length === 0) {
    setLastEnvAuthError(
      'not_logged_in',
      'env_cookie_parse_failed',
      'OPENYIDA_COOKIE_B64 decoded to an empty or invalid Cookie header'
    );
    return null;
  }

  const { csrfToken, corpId, userId } = extractInfoFromCookies(cookies);
  if (!csrfToken) {
    setLastEnvAuthError(
      'csrf_missing',
      'csrf_token_missing',
      'Env Cookie header does not contain tianshu_csrf_token'
    );
    return null;
  }

  return {
    cookies,
    csrf_token: csrfToken,
    corp_id: corpId,
    user_id: userId,
    base_url: baseUrl,
    auth_source: 'env',
    auth_mode: 'cookie',
  };
}

// ── 登录态缓存读取 ────────────────────────────────────

/**
 * 读取 Cookie 登录态。
 * YIDA_AUTH_ENABLED=true 时仅接受 OPENYIDA_COOKIE_B64 注入，不回退文件缓存。
 * 未开启注入模式时保留历史文件读取能力，供仍直接调用 loadCookieData 的旧代码使用。
 * @param {string} [projectRoot]
 * @param {string} [defaultBaseUrl]
 * @returns {object|null}
 */
function loadCookieData(projectRoot, defaultBaseUrl) {
  const root = projectRoot || findProjectRoot();
  const fallbackBaseUrl = defaultBaseUrl || 'https://www.aliwork.com';

  const envCookieData = loadEnvCookieData(fallbackBaseUrl);
  if (isEnvAuthMode()) {
    return envCookieData;
  }

  for (const cookieFile of resolveCookieDataFiles(root)) {
    const cookieData = readCookieDataFile(cookieFile, fallbackBaseUrl);
    if (cookieData) {return cookieData;}
  }

  return null;
}

/**
 * 读取当前默认登录态。
 * 默认使用 OAuth token session；YIDA_AUTH_ENABLED=true 时仅使用 OPENYIDA_COOKIE_B64 注入 Cookie。
 * @param {string} [projectRoot]
 * @param {string} [defaultBaseUrl]
 * @returns {object|null}
 */
function loadAuthData(projectRoot, defaultBaseUrl) {
  const root = projectRoot || findProjectRoot();
  const fallbackBaseUrl = defaultBaseUrl || 'https://www.aliwork.com';
  if (isEnvAuthMode()) {
    return loadCookieData(root, fallbackBaseUrl);
  }
  return loadTokenAuthData(root, fallbackBaseUrl);
}

function cleanAuthStatusPayload(payload) {
  return Object.entries(payload).reduce((result, [key, value]) => {
    if (value !== undefined) {
      result[key] = value;
    }
    return result;
  }, {});
}

function getCookieAuthStatus(options = {}) {
  const root = options.projectRoot || findProjectRoot();
  const fallbackBaseUrl = options.defaultBaseUrl || options.baseUrl || 'https://www.aliwork.com';
  const cookieData = loadCookieData(root, fallbackBaseUrl);
  const cookies = Array.isArray(cookieData && cookieData.cookies) ? cookieData.cookies : [];
  const csrfToken = cookieData && (cookieData.csrf_token || cookieData.csrfToken || cookieData._csrf_token);
  const ok = cookies.length > 0 && !!csrfToken;
  const envAuthError = getLastEnvAuthError();
  const failureReason = ok
    ? null
    : (envAuthError && envAuthError.failure_reason) ||
      (cookies.length > 0 ? 'csrf_token_missing' : 'cookie_missing');

  return cleanAuthStatusPayload({
    ok,
    auth_mode: 'cookie',
    auth_source: 'env',
    status: ok ? 'ok' : 'not_logged_in',
    can_auto_use: ok,
    base_url: ok ? resolveBaseUrl(cookieData, fallbackBaseUrl) : undefined,
    corp_id: ok ? (cookieData.corp_id || null) : undefined,
    user_id: ok ? (cookieData.user_id || null) : undefined,
    cookie_count: cookies.length,
    failure_reason: ok ? undefined : failureReason,
    message: ok ? undefined : 'cookie auth is unavailable. Use host-injected cookies or refresh the host Yida page.',
  });
}

function getAuthStatus(options = {}) {
  if (isEnvAuthMode()) {
    return getCookieAuthStatus(options);
  }
  const { tokenStatus } = require('../auth/token-auth');
  return tokenStatus(options);
}

function resolveCookieDataFiles(root) {
  // 尝试迁移旧版 cookies.json（仅在首次使用多环境功能时执行一次）
  const envManager = require('./env-manager');
  if (typeof envManager.migrateOldCookieFile === 'function') {
    envManager.migrateOldCookieFile(root);
  }

  // 优先使用当前 projectRoot 的当前环境 Cookie；仓库外调用再兜底到全局缓存。
  const envCookieFile = typeof envManager.getCookieFilePath === 'function'
    ? envManager.getCookieFilePath(root)
    : resolveDefaultCookieFilePath(root, envManager);
  const legacyCookieFile = path.join(root, '.cache', 'cookies.json');
  const cookieFileName = path.basename(envCookieFile);
  const candidates = [envCookieFile, legacyCookieFile];

  for (const globalCacheDir of getGlobalCookieCacheDirs()) {
    candidates.push(path.join(globalCacheDir, cookieFileName));
    if (cookieFileName !== 'cookies-public.json') {
      candidates.push(path.join(globalCacheDir, 'cookies-public.json'));
    }
    candidates.push(path.join(globalCacheDir, 'cookies.json'));
  }

  const seen = new Set();
  return candidates.filter((candidate) => {
    if (!candidate || seen.has(candidate)) {
      return false;
    }
    seen.add(candidate);
    return true;
  });
}

function resolveDefaultCookieFilePath(root, envManager) {
  let envName = 'public';
  if (envManager && typeof envManager.getCurrentEnvConfig === 'function') {
    try {
      const currentEnv = envManager.getCurrentEnvConfig(root);
      envName = currentEnv && currentEnv.name ? currentEnv.name : envName;
    } catch {
      envName = process.env.OPENYIDA_ENV || envName;
    }
  }
  const normalizedEnvName = String(envName || 'public').replace(/[^a-z0-9_-]+/ig, '-').toLowerCase();
  const cookieFileName = normalizedEnvName === 'public'
    ? 'cookies-public.json'
    : `cookies-${normalizedEnvName}.json`;
  return path.join(root, '.cache', cookieFileName);
}

function getGlobalCookieCacheDirs() {
  const home = os.homedir();
  const candidates = [
    process.env.OPENYIDA_CACHE_DIR,
    process.env.OPENYIDA_COOKIE_CACHE_DIR,
    home && path.join(home, '.openyida'),
    home && path.join(home, '.cache', 'openyida'),
  ].filter(Boolean);

  const seen = new Set();
  return candidates.filter((candidate) => {
    const normalized = path.resolve(candidate);
    if (seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

function readCookieDataFile(cookieFile, fallbackBaseUrl) {
  if (!fs.existsSync(cookieFile)) {return null;}

  try {
    const raw = fs.readFileSync(cookieFile, 'utf-8').trim();
    if (!raw) {return null;}

    const parsed = JSON.parse(raw);
    let cookieData;

    if (Array.isArray(parsed)) {
      cookieData = { cookies: parsed, base_url: fallbackBaseUrl };
    } else {
      cookieData = parsed;
    }

    const cookies = Array.isArray(cookieData.cookies) ? cookieData.cookies : [];
    const { csrfToken, corpId, userId } = extractInfoFromCookies(cookies);
    const normalizedCsrfToken = cookieData.csrf_token || cookieData.csrfToken || cookieData._csrf_token || csrfToken;
    const normalizedCorpId = cookieData.corp_id || cookieData.corpId || corpId;
    const normalizedUserId = cookieData.user_id || cookieData.userId || cookieData.staffId || userId;
    if (normalizedCsrfToken && Array.isArray(cookieData.cookies) && !cookies.some((cookie) => (
      cookie && CSRF_COOKIE_NAMES.has(cookie.name) && cookie.value
    ))) {
      cookieData.cookies = [
        ...cookies,
        { name: 'tianshu_csrf_token', value: normalizedCsrfToken },
      ];
    }
    if (normalizedCsrfToken) {cookieData.csrf_token = normalizedCsrfToken;}
    if (normalizedCorpId) {cookieData.corp_id = normalizedCorpId;}
    if (normalizedUserId) {cookieData.user_id = normalizedUserId;}
    cookieData.auth_mode = cookieData.auth_mode || 'cookie';
    cookieData.auth_source = cookieData.auth_source || 'cookie';

    return cookieData;
  } catch {
    return null;
  }
}

// ── 登录触发 ──────────────────────────────────────────

/**
 * 触发登录（浏览器扫码模式）。
 * @param {object} [options]
 * @param {boolean} [options.force=false] - 是否跳过本地缓存，强制重新登录
 * @returns {object} loginResult
 */
function triggerLogin(options = {}) {
  if (isEnvAuthMode()) {
    const cookieData = loadCookieData(options.projectRoot || findProjectRoot());
    if (cookieData && cookieData.cookies && cookieData.cookies.length > 0 && cookieData.csrf_token) {
      return cookieData;
    }
    const envAuthError = getLastEnvAuthError();
    const reason = envAuthError
      ? envAuthError.failure_reason
      : (cookieData && cookieData.cookies ? 'csrf_token_missing' : 'env_cookie_missing');
    const { CliError } = require('./cli-error');
    throw new CliError(
      `not_logged_in: env cookie is unavailable (${reason}). Refresh the host page so it can inject a fresh Yida cookie.`,
      {
        code: 'INJECTED_AUTH_REQUIRED',
        details: {
          authMode: 'cookie',
          failure_reason: reason,
        },
      }
    );
  }

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
 * 刷新 csrf_token（从本地缓存重新提取，无需重新扫码）。
 * @returns {object} loginResult
 */
function refreshCsrfToken() {
  warn(t('login.csrf_refresh'));
  const cookieData = loadCookieData();
  return cookieData && cookieData.csrf_token ? cookieData : null;
}

// ── 响应检测 ──────────────────────────────────────────

/**
 * 检测响应体是否表示登录过期。
 * @param {object} responseJson
 * @returns {boolean}
 */
function isLoginExpired(responseJson) {
  if (!responseJson) {return false;}
  const content = responseJson && responseJson.content && typeof responseJson.content === 'object' && !Array.isArray(responseJson.content)
    ? responseJson.content
    : {};
  const status = String(responseJson.status || content.status || '').toLowerCase();
  const errorCode = String(
    responseJson.errorCode || responseJson.code || content.errorCode || content.code || ''
  ).toLowerCase();
  const errorMsg = String(
    responseJson.errorMsg || responseJson.message || content.errorMsg || content.message || ''
  ).toLowerCase();
  const loginExpiredCodes = new Set([
    'not_logged_in',
    'invalid_access_token',
    'expired_access_token',
    'access_token_expired',
    'missing_access_token',
  ]);
  if (
    loginExpiredCodes.has(status) ||
    loginExpiredCodes.has(errorCode) ||
    errorMsg.includes('not_logged_in') ||
    errorMsg.includes('invalid_access_token') ||
    errorMsg.includes('expired_access_token') ||
    errorMsg.includes('access_token_expired') ||
    errorMsg.includes('access token is invalid or expired')
  ) {
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
 * 从 cookieData 中解析 base_url，支持多环境配置优先级。
 *
 * 优先级（高 → 低）：
 *   1. OPENYIDA_ENDPOINT 环境变量
 *   2. cookieData.base_url（登录后实际跳转域名）
 *   3. 当前激活的私有化环境配置
 *   4. 当前激活的环境配置（公有云默认）
 *   5. defaultBaseUrl 参数 / 公有云兜底
 *
 * @param {object} cookieData
 * @param {string} [defaultBaseUrl]
 * @returns {string}
 */
function resolveBaseUrl(cookieData, defaultBaseUrl) {
  const { resolveEndpoint } = require('./env-manager');
  const resolved = resolveEndpoint(cookieData, undefined);
  if (defaultBaseUrl && resolved === 'https://www.aliwork.com' && (!cookieData || !cookieData.base_url)) {
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

function splitRequestAuthArgs(cookiesOrOptions, maybeOptions) {
  if (Array.isArray(cookiesOrOptions)) {
    return {
      cookies: cookiesOrOptions,
      options: maybeOptions || {},
    };
  }
  return {
    cookies: [],
    options: cookiesOrOptions || {},
  };
}

function resolveCookieAuthCookies(cookies) {
  if (Array.isArray(cookies) && cookies.length > 0) {
    return cookies;
  }
  if (!isEnvAuthMode()) {
    return [];
  }
  const cookieData = loadCookieData();
  return Array.isArray(cookieData && cookieData.cookies) ? cookieData.cookies : [];
}

function buildCookieAuthHeaders(baseUrl, cookies, optionsOverride = {}) {
  const parsedUrl = new URL(baseUrl);
  const requestHost = parsedUrl.hostname;
  const cookieList = resolveCookieAuthCookies(cookies);
  const filteredCookies = cookieList.filter(c => {
    const cookieDomain = (c.domain || '').replace(/^\./, '');
    return !cookieDomain || requestHost === cookieDomain || requestHost.endsWith('.' + cookieDomain);
  });
  const effectiveCookies = filteredCookies.length > 0 ? filteredCookies : cookieList;
  const cookieHeader = effectiveCookies.map((c) => `${c.name}=${c.value}`).join('; ');
  const { csrfToken } = extractInfoFromCookies(effectiveCookies);
  const headers = {};
  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }
  if (optionsOverride.csrfToken || csrfToken) {
    headers.global_csrf_token = optionsOverride.csrfToken || csrfToken;
  }
  return headers;
}

async function resolveRequestAuthHeaders(baseUrl, cookies, optionsOverride = {}) {
  if (isTokenAuthMode()) {
    const auth = await resolveBearerAuthHeaders(optionsOverride);
    return auth.headers;
  }
  return buildCookieAuthHeaders(baseUrl, cookies, optionsOverride);
}

function createNonJsonResponseResult(statusCode, data) {
  const responseText = data === null || data === undefined ? '' : String(data);
  return {
    success: false,
    errorMsg: `HTTP ${statusCode}: ` + t('common.response_not_json'),
    __httpStatus: statusCode,
    __nonJsonResponse: true,
    __emptyBody: responseText.trim().length === 0,
  };
}

/**
 * 发送 HTTP POST 请求（application/x-www-form-urlencoded）
 * @param {string} baseUrl
 * @param {string} requestPath
 * @param {string} postData - querystring 格式
 * @param {Array} cookies
 * @returns {Promise<object>}
 */
async function httpPost(baseUrl, requestPath, postData, cookiesOrOptions, maybeOptions) {
  const https = require('https');
  const http = require('http');
  const { cookies, options: optionsOverride } = splitRequestAuthArgs(cookiesOrOptions, maybeOptions);
  const authHeaders = await resolveRequestAuthHeaders(baseUrl, cookies, optionsOverride);
  const bodyData = postData === null || postData === undefined ? '' : String(postData);

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(baseUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: requestPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(bodyData),
        Accept: 'application/json, text/plain, */*',
        Origin: baseUrl,
        Referer: optionsOverride.referer || baseUrl + '/',
        'x-requested-with': 'XMLHttpRequest',
        ...authHeaders,
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
          if (!optionsOverride.silentStatus) {
            warn(t('common.http_response', data.substring(0, 500)));
          }
          resolve(createNonJsonResponseResult(res.statusCode, data));
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

async function httpPostJson(baseUrl, requestPath, payload, cookiesOrOptions, maybeOptions) {
  const https = require('https');
  const http = require('http');
  const { cookies, options: optionsOverride } = splitRequestAuthArgs(cookiesOrOptions, maybeOptions);
  const authHeaders = await resolveRequestAuthHeaders(baseUrl, cookies, optionsOverride);

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(baseUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;
    const body = JSON.stringify(payload === undefined ? {} : payload);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: requestPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        Accept: 'application/json, text/plain, */*',
        Origin: baseUrl,
        Referer: optionsOverride.referer || baseUrl + '/',
        'x-requested-with': 'XMLHttpRequest',
        ...authHeaders,
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
          if (!optionsOverride.silentStatus) {
            warn(t('common.http_response', data.substring(0, 500)));
          }
          resolve(createNonJsonResponseResult(res.statusCode, data));
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
 * @param {Array} cookies
 * @returns {Promise<object>}
 */
async function httpGet(baseUrl, requestPath, queryParams, cookiesOrOptions, maybeOptions) {
  const https = require('https');
  const http = require('http');
  const querystring = require('querystring');
  const { cookies, options: optionsOverride } = splitRequestAuthArgs(cookiesOrOptions, maybeOptions);
  const authHeaders = await resolveRequestAuthHeaders(baseUrl, cookies, optionsOverride);

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(baseUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;
    const fullPath = queryParams ? `${requestPath}?${querystring.stringify(queryParams)}` : requestPath;

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
        ...authHeaders,
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
          if (!optionsOverride.silentStatus) {
            warn(t('common.http_response', data.substring(0, 500)));
          }
          resolve(createNonJsonResponseResult(res.statusCode, data));
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
 * @param {object} authRef - { csrfToken, cookies, baseUrl, cookieData }
 * @returns {Promise<object>}
 */
async function requestWithAutoLogin(requestFn, authRef) {
  let result = await requestFn(authRef);
  const usingEnvAuth = isEnvAuthMode()
    || !!(authRef && authRef.cookieData && authRef.cookieData.auth_source === 'env');

  if (!usingEnvAuth) {
    if (result && result.__needLogin) {
      const { tokenRefresh, isRefreshAuthRequired } = require('../auth/token-auth');
      try {
        const currentAuthData = authRef && authRef.authData;
        const currentBaseUrl = authRef && authRef.baseUrl ? authRef.baseUrl : resolveBaseUrl(currentAuthData);
        const refreshResult = await tokenRefresh({
          projectRoot: authRef && authRef.projectRoot,
          baseUrl: currentBaseUrl,
          clientId: currentAuthData && (currentAuthData.client_id || currentAuthData.clientId),
        });
        if (!refreshResult || refreshResult.ok === false || !refreshResult.access_token) {
          if (isRefreshAuthRequired(refreshResult)) {
            return tokenAuthRequiredResult();
          }
          return tokenRefreshFailedResult(new Error('token_refresh_failed'));
        }
        const refreshedTokenData = loadTokenAuthData(authRef && authRef.projectRoot, currentBaseUrl);
        if (refreshedTokenData) {
          authRef.authData = refreshedTokenData;
          authRef.baseUrl = resolveBaseUrl(refreshedTokenData);
          authRef.authMode = refreshedTokenData.auth_mode || refreshedTokenData.authMode || '';
          authRef.authSource = refreshedTokenData.auth_source || refreshedTokenData.authSource || '';
          authRef.corpId = refreshedTokenData.corp_id || authRef.corpId || '';
          authRef.userId = refreshedTokenData.user_id || authRef.userId || '';
          return requestFn(authRef);
        }
        return tokenRefreshFailedResult(new Error('token_refresh_failed'));
      } catch (error) {
        if (isRefreshAuthRequired(error)) {
          return tokenAuthRequiredResult();
        }
        return tokenRefreshFailedResult(error);
      }
    }
    return result;
  }

  if (result && result.__csrfExpired) {
    if (usingEnvAuth) {
      return {
        success: false,
        __needLogin: true,
        errorCode: 'INJECTED_AUTH_REQUIRED',
        errorMsg: 'not_logged_in: env cookie csrf_token expired. Refresh the host page so it can inject a fresh Yida cookie.',
      };
    }
    const refreshedData = refreshCsrfToken();
    if (refreshedData && refreshedData.cookies && refreshedData.csrf_token) {
      authRef.cookieData = refreshedData;
      authRef.csrfToken = refreshedData.csrf_token;
      authRef.cookies = refreshedData.cookies;
      authRef.baseUrl = resolveBaseUrl(refreshedData);
      warn(t('common.csrf_refreshed'));
      result = await requestFn(authRef);
    } else {
      result = { __needLogin: true };
    }
  }

  if (result && result.__needLogin) {
    if (usingEnvAuth) {
      return {
        success: false,
        __needLogin: true,
        errorCode: 'INJECTED_AUTH_REQUIRED',
        errorMsg: 'not_logged_in: env cookie missing or expired. Refresh the host page so it can inject a fresh Yida cookie.',
      };
    }
    const newCookieData = triggerLogin({ force: true });
    if (!newCookieData || !newCookieData.cookies || !newCookieData.csrf_token) {
      return {
        success: false,
        __needLogin: true,
        errorMsg: t('common.login_expired', 'openyida login --qr / openyida login --browser'),
      };
    }
    authRef.cookieData = newCookieData;
    authRef.csrfToken = newCookieData.csrf_token;
    authRef.cookies = newCookieData.cookies;
    authRef.baseUrl = resolveBaseUrl(newCookieData);
    warn(t('common.relogin_retry'));
    result = await requestFn(authRef);
  }

  return result;
}

function tokenAuthRequiredResult() {
  return {
    success: false,
    __needLogin: true,
    errorCode: 'TOKEN_AUTH_REQUIRED',
    errorMsg: 'not_logged_in: token auth is unavailable. Run openyida login first.',
  };
}

function tokenRefreshFailedResult(error) {
  return {
    success: false,
    errorCode: 'TOKEN_REFRESH_FAILED',
    errorMsg: error && error.message
      ? error.message
      : 'token_refresh_failed: failed to refresh access token. Please retry later.',
  };
}

module.exports = {
  detectActiveTool,
  hasDesktopEnvironment,
  findProjectRoot,
  extractInfoFromCookies,
  parseCookieHeader,
  loadEnvCookieData,
  getLastEnvAuthError,
  getAuthStatus,
  loadAuthData,
  loadCookieData,
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
  hasEnvCookieAuth,
  isEnvAuthMode,
  isTokenAuthMode,
};
