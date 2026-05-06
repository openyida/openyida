/**
 * login.js - 宜搭登录态管理（Cookie 缓存 + 可选 Playwright 浏览器登录）
 *
 * 登录策略（按优先级）：
 *   1. 本地 Cookie 缓存（最快）
 *   2. 可选 Playwright 浏览器登录（仅在用户自行安装 Playwright 时可用）
 *
 * 导出函数：
 *   ensureLogin()          - 确保有效登录态（优先缓存，否则尝试可选浏览器登录）
 *   checkLoginOnly()       - 仅检查登录态，不触发登录
 *   refreshCsrfFromCache() - 从缓存 Cookie 重新提取 csrf_token
 *   interactiveLogin()     - 打开浏览器扫码登录（需要用户自行安装 playwright）
 *   saveCookieCache()      - 保存 Cookie 到本地缓存（供 qr-login.js 使用）
 *   logout()               - 退出登录，清空 Cookie 缓存
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { findProjectRoot, extractInfoFromCookies, loadCookieData, resolveBaseUrl, detectActiveTool } = require('../core/utils');
const { t } = require('../core/i18n');

const DEFAULT_BASE_URL = 'https://www.aliwork.com';
const DEFAULT_LOGIN_URL = 'https://www.aliwork.com/workPlatform';

// ── 配置读取 ──────────────────────────────────────────

function loadConfig() {
  const { resolveLoginUrl } = require('../core/env-manager');
  const loginUrl = resolveLoginUrl();
  return {
    loginUrl,
    defaultBaseUrl: DEFAULT_BASE_URL,
  };
}

// ── Cookie 持久化 ─────────────────────────────────────

function saveCookieCache(cookies, baseUrl) {
  const projectRoot = findProjectRoot();
  const cacheDir = path.join(projectRoot, '.cache');

  // 使用当前激活环境的 Cookie 文件路径（环境隔离）
  const { getCookieFilePath } = require('../core/env-manager');
  const cookieFile = getCookieFilePath(projectRoot);

  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cookieFile, JSON.stringify({ cookies, base_url: baseUrl }, null, 2), 'utf-8');
  const { c } = require('../core/chalk');
  process.stderr.write(`  ${c.green}✔${c.reset} Cookie saved to ${c.dim}${cookieFile}${c.reset}\n`);
}

// ── 仅检查登录态 ──────────────────────────────────────

/**
 * 仅检查登录态，不触发登录。
 * @param {object} [options]
 * @param {boolean} [options.includeSecrets=false] - 是否返回完整 Cookie/CSRF，默认脱敏
 * @returns {object} 含 can_auto_use 字段的状态对象
 */
function checkLoginOnly(options = {}) {
  const includeSecrets = !!options.includeSecrets;
  const projectRoot = findProjectRoot();
  const { getCurrentEnvConfig, getCookieFilePath } = require('../core/env-manager');
  const activeTool = detectActiveTool();
  const currentEnv = getCurrentEnvConfig(projectRoot);
  const cookieFile = getCookieFilePath(projectRoot);
  const legacyCookieFile = path.join(projectRoot, '.cache', 'cookies.json');
  const cookieData = loadCookieData(projectRoot);
  const cookies = cookieData && Array.isArray(cookieData.cookies) ? cookieData.cookies : [];
  const baseDiagnostics = {
    activeTool: activeTool ? activeTool.tool : null,
    isWukong: !!(activeTool && activeTool.tool === 'wukong'),
    projectRoot,
    projectRootExists: fs.existsSync(projectRoot),
    hasConfig: fs.existsSync(path.join(projectRoot, 'config.json')),
    currentEnv: currentEnv.name,
    cookieFile,
    legacyCookieFile,
    cookieFileFound: fs.existsSync(cookieFile) || fs.existsSync(legacyCookieFile),
    usedLegacyCookieFile: !fs.existsSync(cookieFile) && fs.existsSync(legacyCookieFile),
  };

  if (!cookieData || !cookieData.cookies) {
    return {
      status: 'not_logged_in',
      can_auto_use: false,
      diagnostics: {
        ...baseDiagnostics,
        cache_readable: false,
        cookies_array_found: false,
        csrf_token_found: false,
        corp_id_found: false,
        user_id_found: false,
        base_url_found: false,
        failure_reason: baseDiagnostics.cookieFileFound ? 'cookie_cache_unreadable_or_invalid' : 'cookie_cache_missing',
      },
      message: 'No local Cookie cache, QR scan login required',
    };
  }

  const { csrfToken, corpId, userId } = extractInfoFromCookies(cookies);
  const baseUrl = resolveBaseUrl(cookieData);
  const diagnostics = {
    ...baseDiagnostics,
    cache_readable: true,
    cookies_array_found: Array.isArray(cookieData.cookies),
    csrf_token_found: !!csrfToken,
    corp_id_found: !!corpId,
    user_id_found: !!userId,
    base_url_found: !!baseUrl,
    cookies_count: cookies.length,
    failure_reason: csrfToken ? null : 'csrf_token_missing',
  };

  if (!csrfToken) {
    return {
      status: 'not_logged_in',
      can_auto_use: false,
      diagnostics,
      message: 'No tianshu_csrf_token in Cookie, re-login required',
    };
  }

  const result = {
    status: 'ok',
    can_auto_use: true,
    csrf_token: includeSecrets ? csrfToken : `${csrfToken.slice(0, 8)}…`,
    corp_id: corpId,
    user_id: userId,
    base_url: baseUrl,
    cookies_count: cookies.length,
    diagnostics,
    message: `✅ Valid login credentials found\n  Org: ${corpId}\n  User: ${userId}\n  Domain: ${baseUrl}`,
  };
  if (includeSecrets) {
    result.cookies = cookies;
  }
  return result;
}

// ── 从缓存刷新 csrf_token ─────────────────────────────

/**
 * 从本地缓存 Cookie 中重新提取 csrf_token，无需重新扫码。
 * @returns {object} loginResult
 */
function refreshCsrfFromCache() {
  const cookieData = loadCookieData();

  if (!cookieData || !cookieData.cookies) {
    const { error: chalkError } = require('../core/chalk');
    chalkError(t('login.no_cookie_cache'));
    return null;
  }

  const { csrfToken, corpId, userId } = extractInfoFromCookies(cookieData.cookies);

  if (!csrfToken) {
    const { error: chalkError2 } = require('../core/chalk');
    chalkError2(t('login.no_csrf_in_cache'));
    return null;
  }

  const baseUrl = resolveBaseUrl(cookieData);
  const { success: chalkSuccess } = require('../core/chalk');
  chalkSuccess(t('login.csrf_extracted', csrfToken.slice(0, 16)));

  return {
    csrf_token: csrfToken,
    corp_id: corpId,
    user_id: userId,
    base_url: baseUrl,
    cookies: cookieData.cookies,
  };
}

// ── 确保登录态（优先缓存） ────────────────────────────

/**
 * 确保拥有有效的登录态。优先从本地缓存 Cookie 中提取，否则尝试可选 Playwright 浏览器登录。
 * 默认 CLI 登录路径在 bin/yida.js 中优先使用终端二维码或 AI 工具内置浏览器 handoff。
 * @returns {object} loginResult
 */
function ensureLogin() {
  const cookieData = loadCookieData();

  if (cookieData && cookieData.cookies) {
    const { csrfToken, corpId, userId } = extractInfoFromCookies(cookieData.cookies);
    if (csrfToken) {
      const { c: cc, success: chalkSuccess2, label: chalkLabel } = require('../core/chalk');
      chalkSuccess2(t('login.using_cache'));
      chalkLabel('CSRF', `${csrfToken.slice(0, 16)}…`);
      if (corpId) {chalkLabel('Corp ID', corpId);}
      const baseUrl = resolveBaseUrl(cookieData);
      return {
        csrf_token: csrfToken,
        corp_id: corpId,
        user_id: userId,
        base_url: baseUrl,
        cookies: cookieData.cookies,
      };
    }
  }

  return interactiveLogin();
}

// ── 可选 Playwright 扫码登录 ───────────────────────────

/**
 * 获取 playwright 模块的绝对路径，用于临时脚本中 require。
 *
 * 查找策略（按优先级）：
 *   1. 用户项目或全局环境可解析的 playwright
 *   2. 旧版本 openyida 包自身的 node_modules/playwright（向后兼容）
 *   3. 全局 npm root 路径
 *
 * @returns {string|null} playwright index.js 的绝对路径
 */
function getPlaywrightPath() {
  // 策略1：require.resolve 标准解析（用户项目、npm link 或兼容安装场景）
  try {
    return require.resolve('playwright');
  } catch {
    // ignore
  }

  // 策略2：兼容旧版本 openyida 包自身的 node_modules/playwright
  const candidates = [
    path.join(__dirname, '..', 'node_modules', 'playwright', 'index.js'),
    path.join(__dirname, '..', '..', 'node_modules', 'playwright', 'index.js'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // 策略3：全局 npm root 路径
  try {
    const globalRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim();
    const globalPlaywright = path.join(globalRoot, 'playwright', 'index.js');
    if (fs.existsSync(globalPlaywright)) {
      return globalPlaywright;
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * 打开有头浏览器让用户扫码登录（需要用户自行安装 playwright）。
 * @returns {object} loginResult
 */
function interactiveLogin() {
  const config = loadConfig();
  const loginUrl = config.loginUrl || DEFAULT_LOGIN_URL;

  // 检查 playwright 是否可用
  const playwrightPath = getPlaywrightPath();
  if (!playwrightPath) {
    const { error: chalkError3 } = require('../core/chalk');
    chalkError3(t('login.no_playwright'), { hint: `${t('login.playwright_install1')}\n  ${t('login.playwright_install2')}` });
    return null;
  }

  const { c: lc, info: chalkInfo, label: chalkLabel2 } = require('../core/chalk');
  chalkInfo(t('login.browser_opening'));
  chalkLabel2('URL', loginUrl);

  // 通过子进程运行异步 playwright 逻辑，避免顶层 await 兼容性问题
  // 使用 require.resolve 获取的绝对路径，确保临时脚本能找到 playwright
  const scriptContent = `
const playwright = require(${JSON.stringify(playwrightPath)});
const { chromium } = playwright;
const { URL } = require('url');

(async () => {
  // 优先使用本地已安装的 Chrome，避免下载 Playwright 内置 Chromium
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: false });
  } catch {
    // 本地未安装 Chrome，降级为 Playwright 内置 Chromium
    browser = await chromium.launch({ headless: false });
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(${JSON.stringify(loginUrl)}, { timeout: 120000 });

  console.error('  Waiting for login (up to 10 minutes)...');
  // 轮询 tianshu_csrf_token cookie 出现来判断登录成功
  // 兼容专属域名（your-company.aliwork.com）登录后跳转路径不固定的情况
  let loginSuccess = false;
  const deadline = Date.now() + 600000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));
    const cookies = await context.cookies();
    if (cookies.some(c => c.name === 'tianshu_csrf_token' && c.value)) {
      loginSuccess = true;
      break;
    }
  }
  if (!loginSuccess) {
    console.error('  ⏰ Login timed out (10 minutes). Please try again.');
    await browser.close();
    process.exit(1);
  }
  await page.waitForLoadState('networkidle').catch(() => {});
  console.error('  ✅ Login successful!');

  const currentUrl = page.url();
  const cookies = await context.cookies();
  // 优先从 yida_user_cookie 的 domain 提取 base_url，兼容专属域名
  const csrfCookie = cookies.find(c => c.name === 'tianshu_csrf_token');
  let baseUrl;
  if (csrfCookie && csrfCookie.domain && csrfCookie.domain !== '.aliwork.com') {
    baseUrl = 'https://' + csrfCookie.domain.replace(/^\\./, '');
  } else {
    try { baseUrl = new URL(currentUrl).origin; } catch { baseUrl = 'https://www.aliwork.com'; }
  }
  // 再用 yida_user_cookie 的 domain 覆盖，它是最可靠的来源
  const yidaCookie = cookies.find(c => c.name === 'yida_user_cookie');
  if (yidaCookie && yidaCookie.domain && yidaCookie.domain.includes('aliwork.com')) {
    baseUrl = 'https://' + yidaCookie.domain.replace(/^\\./, '');
  }
  await browser.close();

  console.log(JSON.stringify({ cookies, base_url: baseUrl }));
})();
`;

  const tmpScript = path.join(os.tmpdir(), `openyida-login-${Date.now()}.js`);
  fs.writeFileSync(tmpScript, scriptContent, 'utf-8');

  try {
    const stdout = execSync(`node "${tmpScript}"`, {
      encoding: 'utf-8',
      stdio: ['inherit', 'pipe', 'inherit'],
      timeout: 660000,
    });

    const lines = stdout.trim().split('\n');
    const jsonLine = lines[lines.length - 1];
    const result = JSON.parse(jsonLine);

    const { csrfToken, corpId, userId } = extractInfoFromCookies(result.cookies);
    if (!csrfToken) {
      const { error: chalkError4 } = require('../core/chalk');
      chalkError4(t('login.no_csrf_in_cookie'));
      return null;
    }

    saveCookieCache(result.cookies, result.base_url);

    const { success: chalkSuccess3, label: chalkLabel3 } = require('../core/chalk');
    chalkSuccess3(t('login.csrf_ok', csrfToken.slice(0, 16)));
    if (corpId) {chalkLabel3('Corp ID', corpId);}

    return {
      csrf_token: csrfToken,
      corp_id: corpId,
      user_id: userId,
      base_url: result.base_url,
      cookies: result.cookies,
    };
  } finally {
    try { fs.unlinkSync(tmpScript); } catch { /* ignore */ }
  }
}

// ── 退出登录 ──────────────────────────────────────────

/**
 * 退出登录：清空项目级 Cookie 文件。
 */
function logout() {
  const { banner, label, success: chalkSuccess4, warn: chalkWarn, hint: chalkHint, sep } = require('../core/chalk');

  banner(t('login.logout_title'));

  const projectRoot = findProjectRoot();

  // 删除当前环境对应的 Cookie 文件（多环境隔离）
  const { getCookieFilePath } = require('../core/env-manager');
  const envCookieFile = getCookieFilePath(projectRoot);
  // 兼容旧版：同时删除 cookies.json（历史遗留文件）
  const legacyCookieFile = path.join(projectRoot, '.cache', 'cookies.json');

  label('Cookie (env)', envCookieFile);
  if (envCookieFile !== legacyCookieFile) {
    label('Cookie (legacy)', legacyCookieFile);
  }

  let deleted = false;
  for (const cookieFile of [envCookieFile, legacyCookieFile]) {
    if (fs.existsSync(cookieFile)) {
      fs.unlinkSync(cookieFile);
      deleted = true;
    }
  }

  if (deleted) {
    chalkSuccess4(t('login.logout_success'));
    chalkHint(t('login.logout_hint'));
  } else {
    chalkWarn(t('login.logout_no_file'));
  }

  process.stderr.write(`  ${sep()}\n\n`);
}

module.exports = {
  ensureLogin,
  checkLoginOnly,
  refreshCsrfFromCache,
  interactiveLogin,
  saveCookieCache,
  logout,
};
