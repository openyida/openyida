/**
 * utils.js - 宜搭 CLI 公共工具函数
 *
 * 导出函数：
 *   findProjectRoot()         - 查找项目根目录（兼容悟空环境）
 *   extractInfoFromCookies()  - 从 Cookie 列表中提取 csrf_token / corp_id / user_id
 *   loadCookieData()          - 读取 .cache/cookies.json 登录态缓存
 *   triggerLogin()            - 触发登录（自动区分标准/悟空环境）
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

  // Qoder (qoder.com)
  if (env.QODER_IDE || env.QODER_AGENT) {
    return {
      tool: 'qoder',
      displayName: 'Qoder',
      dirName: '.qoder',
      workspaceRoot: path.join(cwd, 'project'),
    };
  }

  // Claude Code
  if (env.CLAUDECODE) {
    return {
      tool: 'claude-code',
      displayName: 'Claude Code',
      dirName: '.claude',
      workspaceRoot: path.join(cwd, 'project'),
    };
  }

  // OpenCode
  // Windows 上配置目录为 ~/.config/opencode，macOS/Linux 为 ~/.opencode
  if (env.OPENCODE) {
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

  // 悟空（Wukong）
  // Windows 路径可能使用反斜杠，需同时兼容正斜杠和反斜杠
  if (env.AGENT_WORK_ROOT && (env.AGENT_WORK_ROOT.includes('.real') || env.AGENT_WORK_ROOT.includes(path.join('.real')))) {
    return {
      tool: 'wukong',
      displayName: '悟空（Wukong）',
      dirName: '.real',
      workspaceRoot: path.join(home, '.real', 'workspace', 'project'),
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

  // 兜底：返回当前工作目录
  return process.cwd();
}

// ── Cookie 解析 ───────────────────────────────────────

/**
 * 从 Cookie 列表中提取 csrf_token、corp_id、user_id。
 * @param {Array} cookies
 * @returns {{ csrfToken: string|null, corpId: string|null, userId: string|null }}
 */
function extractInfoFromCookies(cookies) {
  let csrfToken = null;
  let corpId = null;
  let userId = null;

  for (const cookie of cookies) {
    if (cookie.name === 'tianshu_csrf_token') {
      csrfToken = cookie.value;
    } else if (cookie.name === 'tianshu_corp_user') {
      const lastUnderscore = cookie.value.lastIndexOf('_');
      if (lastUnderscore > 0) {
        corpId = cookie.value.slice(0, lastUnderscore);
        userId = cookie.value.slice(lastUnderscore + 1);
      }
    }
  }

  return { csrfToken, corpId, userId };
}

// ── 登录态缓存读取 ────────────────────────────────────

/**
 * 读取 .cache/cookies.json 登录态缓存。
 * @param {string} [projectRoot]
 * @param {string} [defaultBaseUrl]
 * @returns {object|null}
 */
function loadCookieData(projectRoot, defaultBaseUrl) {
  const root = projectRoot || findProjectRoot();
  const fallbackBaseUrl = defaultBaseUrl || 'https://www.aliwork.com';
  const cookieFile = path.join(root, '.cache', 'cookies.json');

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

    if (cookieData.cookies && cookieData.cookies.length > 0) {
      const { csrfToken, corpId, userId } = extractInfoFromCookies(cookieData.cookies);
      if (csrfToken) {cookieData.csrf_token = csrfToken;}
      if (corpId) {cookieData.corp_id = corpId;}
      if (userId) {cookieData.user_id = userId;}
    }

    return cookieData;
  } catch {
    return null;
  }
}

// ── 登录触发 ──────────────────────────────────────────

/**
 * 触发登录（Playwright 扫码模式）。
 * @returns {object} loginResult
 */
function triggerLogin() {
  console.error(t('login.trigger_login'));
  const { ensureLogin } = require('../auth/login');
  return ensureLogin();
}

/**
 * 刷新 csrf_token（从本地缓存重新提取，无需重新扫码）。
 * @returns {object} loginResult
 */
function refreshCsrfToken() {
  console.error(t('login.csrf_refresh'));
  const { refreshCsrfFromCache } = require('../auth/login');
  return refreshCsrfFromCache();
}

// ── 响应检测 ──────────────────────────────────────────

/**
 * 检测响应体是否表示登录过期。
 * @param {object} responseJson
 * @returns {boolean}
 */
function isLoginExpired(responseJson) {
  return (
    responseJson &&
    responseJson.success === false &&
    (responseJson.errorCode === '307' || responseJson.errorCode === '302')
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

// ── base_url 解析 ─────────────────────────────────────

/**
 * 从 cookieData 中解析 base_url，去除末尾斜杠。
 * @param {object} cookieData
 * @param {string} [defaultBaseUrl]
 * @returns {string}
 */
function resolveBaseUrl(cookieData, defaultBaseUrl) {
  const fallback = defaultBaseUrl || 'https://www.aliwork.com';
  return ((cookieData && cookieData.base_url) || fallback).replace(/\/+$/, '');
}

// ── HTTP 请求工具 ─────────────────────────────────────

/**
 * 发送 HTTP POST 请求（application/x-www-form-urlencoded）
 * @param {string} baseUrl
 * @param {string} requestPath
 * @param {string} postData - querystring 格式
 * @param {Array} cookies
 * @returns {Promise<object>}
 */
function httpPost(baseUrl, requestPath, postData, cookies) {
  const https = require('https');
  const http = require('http');

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(baseUrl);
    const requestHost = parsedUrl.hostname;
    const filteredCookies = cookies.filter(c => {
      const cookieDomain = (c.domain || '').replace(/^\./, '');
      return requestHost === cookieDomain || requestHost.endsWith('.' + cookieDomain);
    });
    const cookieHeader = filteredCookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const isHttps = parsedUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    // 从 cookies 中提取 csrf_token 用于 global_csrf_token 请求头
    const csrfCookie = filteredCookies.find(c => c.name === 'tianshu_csrf_token');
    const globalCsrfToken = csrfCookie ? csrfCookie.value : '';

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: requestPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        Accept: 'application/json, text/plain, */*',
        Origin: baseUrl,
        Referer: baseUrl + '/',
        Cookie: cookieHeader,
        'x-requested-with': 'XMLHttpRequest',
        global_csrf_token: globalCsrfToken,
      },
      timeout: 30000,
    };

    const req = requestModule.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.error(t('common.http_status', res.statusCode));
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
          console.error(t('common.http_response', data.substring(0, 500)));
          resolve({ success: false, errorMsg: `HTTP ${res.statusCode}: ` + t('common.response_not_json') });
        }
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error(t('common.request_timeout'))); });
    req.on('error', reject);
    req.write(postData);
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
function httpGet(baseUrl, requestPath, queryParams, cookies) {
  const https = require('https');
  const http = require('http');
  const querystring = require('querystring');

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(baseUrl);
    const requestHost = parsedUrl.hostname;
    const filteredCookies = cookies.filter(c => {
      const cookieDomain = (c.domain || '').replace(/^\./, '');
      return requestHost === cookieDomain || requestHost.endsWith('.' + cookieDomain);
    });
    const cookieHeader = filteredCookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const isHttps = parsedUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;
    const fullPath = queryParams ? `${requestPath}?${querystring.stringify(queryParams)}` : requestPath;

    // 从 cookies 中提取 csrf_token 用于 global_csrf_token 请求头
    const csrfCookie = filteredCookies.find(c => c.name === 'tianshu_csrf_token');
    const globalCsrfToken = csrfCookie ? csrfCookie.value : '';

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: fullPath,
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain, */*',
        Origin: baseUrl,
        Referer: baseUrl + '/',
        Cookie: cookieHeader,
        'x-requested-with': 'XMLHttpRequest',
        global_csrf_token: globalCsrfToken,
      },
      timeout: 30000,
    };

    const req = requestModule.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.error(t('common.http_status', res.statusCode));
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
          console.error(t('common.http_response', data.substring(0, 500)));
          resolve({ success: false, errorMsg: `HTTP ${res.statusCode}: ` + t('common.response_not_json') });
        }
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error(t('common.request_timeout'))); });
    req.on('error', reject);
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

  if (result && result.__csrfExpired) {
    const refreshedData = refreshCsrfToken();
    authRef.cookieData = refreshedData;
    authRef.csrfToken = refreshedData.csrf_token;
    authRef.cookies = refreshedData.cookies;
    authRef.baseUrl = resolveBaseUrl(refreshedData);
    console.error(t('common.csrf_refreshed'));
    result = await requestFn(authRef);
  }

  if (result && result.__needLogin) {
    const newCookieData = triggerLogin();
    authRef.cookieData = newCookieData;
    authRef.csrfToken = newCookieData.csrf_token;
    authRef.cookies = newCookieData.cookies;
    authRef.baseUrl = resolveBaseUrl(newCookieData);
    console.error(t('common.relogin_retry'));
    result = await requestFn(authRef);
  }

  return result;
}

module.exports = {
  detectActiveTool,
  findProjectRoot,
  extractInfoFromCookies,
  loadCookieData,
  triggerLogin,
  refreshCsrfToken,
  resolveBaseUrl,
  isLoginExpired,
  isCsrfTokenExpired,
  httpPost,
  httpGet,
  requestWithAutoLogin,
};
