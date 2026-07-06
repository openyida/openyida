/**
 * auth.js - 登录态管理模块
 *
 * 提供统一的登录态管理能力，支持：
 *   - 登录态状态查询
 *   - 钉钉扫码登录
 *   - 登录态刷新
 *   - 安全退出
 *
 * 导出函数：
 *   authStatus()     - 查询当前登录状态
 *   authLogin()      - 执行登录（扫码/钉钉自动登录）
 *   authRefresh()    - 刷新登录态
 *   authLogout()     - 退出登录
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  findProjectRoot,
  loadCookieData,
  extractInfoFromCookies,
  resolveBaseUrl,
  detectActiveTool,
  hasDesktopEnvironment,
  isInjectedAuthMode,
} = require('../core/utils');
const { logout, checkLoginOnly, interactiveLogin } = require('./login');
const { t } = require('../core/i18n');

const AUTH_CACHE_FILE = '.cache/auth.json';

// ── 配置读取 ──────────────────────────────────────────

function loadAuthConfig() {
  const projectRoot = findProjectRoot();
  const authConfigPath = path.join(projectRoot, AUTH_CACHE_FILE);

  if (fs.existsSync(authConfigPath)) {
    try {
      const content = fs.readFileSync(authConfigPath, 'utf-8').trim();
      if (content) {
        return JSON.parse(content);
      }
    } catch {
      // ignore
    }
  }
  return null;
}

function saveAuthConfig(config) {
  const projectRoot = findProjectRoot();
  const cacheDir = path.join(projectRoot, '.cache');
  const authConfigPath = path.join(cacheDir, 'auth.json');

  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(authConfigPath, JSON.stringify(config, null, 2), 'utf-8');
}

// ── 登录态状态查询 ────────────────────────────────────

/**
 * 查询当前登录状态
 * @returns {object} 登录状态信息
 */
function authStatus() {
  const { banner, warn, success: chalkSuccess, label, sep, hint } = require('../core/chalk');

  banner(t('auth.status_title'), { stderr: false });

  // 读取 Cookie 缓存
  const cookieData = loadCookieData();

  if (!cookieData || !cookieData.cookies || cookieData.cookies.length === 0) {
    warn(t('auth.not_logged_in'), false);
    hint(t('auth.login_hint'), false);
    console.log(`  ${sep()}\n`);
    return {
      status: 'not_logged_in',
      canAutoUse: false,
    };
  }

  const cookieInfo = extractInfoFromCookies(cookieData.cookies);
  const csrfToken = cookieData.csrf_token || cookieData.csrfToken || cookieData._csrf_token || cookieInfo.csrfToken;
  const corpId = cookieData.corp_id || cookieData.corpId || cookieInfo.corpId;
  const userId = cookieData.user_id || cookieData.userId || cookieData.staffId || cookieInfo.userId;
  const baseUrl = resolveBaseUrl(cookieData);
  const authConfig = loadAuthConfig();

  if (!csrfToken) {
    warn(t('auth.no_csrf_token'), false);
    hint(t('auth.relogin_hint'), false);
    console.log(`  ${sep()}\n`);
    return {
      status: 'invalid',
      canAutoUse: false,
    };
  }

  // 登录态有效
  chalkSuccess(t('auth.logged_in'), false);
  label('Base URL', baseUrl, { stderr: false });
  if (corpId) {
    label('Corp ID', corpId, { stderr: false });
  }
  if (userId) {
    label('User ID', userId, { stderr: false });
  }
  label('CSRF', `${csrfToken.slice(0, 16)}…`, { stderr: false });

  // 显示登录信息
  if (authConfig) {
    if (authConfig.loginType) {
      label('Login Type', authConfig.loginType, { stderr: false });
    }
    if (authConfig.loginTime) {
      label('Login Time', authConfig.loginTime, { stderr: false });
    }
  }

  console.log(`  ${sep()}\n`);

  return {
    status: 'ok',
    canAutoUse: true,
    csrfToken,
    corpId,
    userId,
    baseUrl,
    loginType: authConfig?.loginType,
    loginTime: authConfig?.loginTime,
  };
}

// ── 执行登录 ──────────────────────────────────────────

/**
 * 执行登录
 * @param {object} options - 登录选项
 * @param {string} options.type - 登录类型：'qrcode' | 'dingtalk' | 'browser' | 'codex' | 'qoder' | 'wukong'
 * @param {string} [options.corpId] - 多组织登录时指定目标组织
 * @returns {Promise<object>|object} 登录结果
 */
async function authLogin(options = {}) {
  const { type = 'qrcode', corpId, forceTerminalQr = false } = options;

  const { info, success: chalkSuccess, label } = require('../core/chalk');
  info(t('auth.login_start', type));

  // 调用现有的登录逻辑
  let result;
  const cachedResult = checkLoginOnly({ includeSecrets: true });
  if (cachedResult.status === 'ok') {
    result = cachedResult;
  } else if (isInjectedAuthMode()) {
    return cachedResult;
  } else if (type === 'browser') {
    result = interactiveLogin({ playwrightFallback: true });
  } else if (type === 'codex' || type === 'qoder' || type === 'wukong') {
    result = await require('./codex-login').codexLogin({
      tool: type,
    });
  } else if (type === 'qrcode' && !forceTerminalQr && isAgentConversationEnvironment()) {
    result = await loginInAgentConversation({ corpId });
  } else if (type === 'qrcode' && !forceTerminalQr && hasDesktopEnvironment()) {
    result = interactiveLogin({ playwrightFallback: true }) ||
      await require('./qr-login').qrLogin({ corpId });
  } else {
    result = await require('./qr-login').qrLogin({ corpId });
  }

  if (!result) {
    return result;
  }

  if (!result.csrf_token || !result.cookies) {
    return result;
  }

  // 保存登录信息
  const authConfig = {
    loginType: type,
    loginTime: new Date().toISOString(),
    corpId: result.corp_id,
    userId: result.user_id,
  };
  saveAuthConfig(authConfig);

  chalkSuccess(t('auth.login_success'));
  if (result.corp_id) {
    label('Corp ID', result.corp_id);
  }

  return result;
}

function isAgentConversationEnvironment() {
  return !!detectActiveTool() || process.env.OPENYIDA_AGENT_MODE === '1';
}

function shouldUsePlaywrightFallbackInAgentLogin() {
  return hasDesktopEnvironment() || process.env.OPENYIDA_AGENT_PLAYWRIGHT_FALLBACK === '1';
}

async function loginInAgentConversation(options = {}) {
  const activeTool = detectActiveTool();

  const browserResult = interactiveLogin({
    playwrightFallback: shouldUsePlaywrightFallbackInAgentLogin(),
  });
  if (browserResult) {
    return browserResult;
  }

  if (activeTool && (activeTool.tool === 'wukong' || activeTool.tool === 'qoderwork')) {
    return require('./codex-login').codexLogin({ tool: activeTool.tool });
  }

  return require('./qr-login').startCodexQrLogin({ corpId: options.corpId });
}

// ── 刷新登录态 ────────────────────────────────────────

/**
 * 刷新登录态（从本地缓存重新提取 csrf_token）
 * @returns {object} 刷新结果
 */
function authRefresh() {
  const { info: chalkInfo, fail: chalkFail, success: chalkSuccess2, label: chalkLabel } = require('../core/chalk');
  chalkInfo(t('auth.refresh_start'));

  const cookieData = loadCookieData();

  if (!cookieData || !cookieData.cookies) {
    chalkFail(t('auth.no_cookie_cache'), { exit: false });
    return {
      status: 'error',
      message: 'No cookie cache',
    };
  }

  const cookieInfo = extractInfoFromCookies(cookieData.cookies);
  const csrfToken = cookieData.csrf_token || cookieData.csrfToken || cookieData._csrf_token || cookieInfo.csrfToken;
  const corpId = cookieData.corp_id || cookieData.corpId || cookieInfo.corpId;
  const userId = cookieData.user_id || cookieData.userId || cookieData.staffId || cookieInfo.userId;

  if (!csrfToken) {
    chalkFail(t('auth.no_csrf_in_cache'), { exit: false });
    return {
      status: 'error',
      message: 'No csrf_token in cache',
    };
  }

  const baseUrl = resolveBaseUrl(cookieData);

  // 更新登录时间
  const authConfig = loadAuthConfig() || {};
  authConfig.refreshTime = new Date().toISOString();
  authConfig.corpId = corpId;
  authConfig.userId = userId;
  saveAuthConfig(authConfig);

  chalkSuccess2(t('auth.refresh_success'));
  chalkLabel('CSRF', `${csrfToken.slice(0, 16)}…`);

  return {
    status: 'ok',
    csrfToken,
    corpId,
    userId,
    baseUrl,
  };
}

// ── 退出登录 ──────────────────────────────────────────

/**
 * 退出登录
 */
function authLogout() {
  // 调用现有的退出逻辑
  logout();

  // 清空 auth 配置
  const projectRoot = findProjectRoot();
  const authConfigPath = path.join(projectRoot, AUTH_CACHE_FILE);

  // 确保目录存在
  const authConfigDir = path.dirname(authConfigPath);
  if (!fs.existsSync(authConfigDir)) {
    fs.mkdirSync(authConfigDir, { recursive: true });
  }
  fs.writeFileSync(authConfigPath, '{}', 'utf-8');
  const { success: chalkSuccess3 } = require('../core/chalk');
  chalkSuccess3(t('auth.auth_config_cleared'));
}

module.exports = {
  authStatus,
  authLogin,
  authRefresh,
  authLogout,
  loadAuthConfig,
  saveAuthConfig,
};
