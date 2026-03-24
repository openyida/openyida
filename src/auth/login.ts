/**
 * login.ts - 宜搭登录态管理（Playwright 扫码登录）
 *
 * 导出函数：
 *   ensureLogin()          - 确保有效登录态（优先缓存，否则扫码）
 *   checkLoginOnly()       - 仅检查登录态，不触发登录
 *   refreshCsrfFromCache() - 从缓存 Cookie 重新提取 csrf_token
 *   interactiveLogin()     - 打开浏览器扫码登录（需要 playwright）
 *   saveCookieCache()      - 保存 Cookie 到本地缓存（供 qr-login.ts 使用）
 *   logout()               - 退出登录，清空 Cookie 缓存
 */

'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { findProjectRoot, extractInfoFromCookies, loadCookieData, resolveBaseUrl } from '../core/utils';
import { t } from '../core/i18n';
import type { Cookie, CookieData, LoginResult } from '../types';

const DEFAULT_BASE_URL = 'https://www.aliwork.com';
const DEFAULT_LOGIN_URL = 'https://www.aliwork.com/workPlatform';

// ── 配置读取 ──────────────────────────────────────────

interface AppConfig {
  loginUrl?: string;
  defaultBaseUrl?: string;
}

function loadConfig(): AppConfig {
  const projectRoot = findProjectRoot();
  const configPath = path.join(projectRoot, 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as AppConfig;
    } catch {
      // ignore
    }
  }
  return {
    loginUrl: DEFAULT_LOGIN_URL,
    defaultBaseUrl: DEFAULT_BASE_URL,
  };
}

// ── Cookie 持久化 ─────────────────────────────────────

export function saveCookieCache(cookies: Cookie[], baseUrl: string): void {
  const projectRoot = findProjectRoot();
  const cacheDir = path.join(projectRoot, '.cache');
  const cookieFile = path.join(cacheDir, 'cookies.json');

  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cookieFile, JSON.stringify({ cookies, base_url: baseUrl }, null, 2), 'utf-8');
  console.error(`  Cookie saved to ${cookieFile}`);
}

// ── 仅检查登录态 ──────────────────────────────────────

interface CheckLoginResult {
  status: string;
  can_auto_use: boolean;
  message: string;
  csrf_token?: string;
  corp_id?: string | null;
  user_id?: string | null;
  base_url?: string;
  cookies?: Cookie[];
}

export function checkLoginOnly(): CheckLoginResult {
  const cookieData = loadCookieData();

  if (!cookieData || !cookieData.cookies) {
    return {
      status: 'not_logged_in',
      can_auto_use: false,
      message: 'No local Cookie cache, QR scan login required',
    };
  }

  const { csrfToken, corpId, userId } = extractInfoFromCookies(cookieData.cookies);

  if (!csrfToken) {
    return {
      status: 'not_logged_in',
      can_auto_use: false,
      message: 'No tianshu_csrf_token in Cookie, re-login required',
    };
  }

  const baseUrl = resolveBaseUrl(cookieData);
  return {
    status: 'ok',
    can_auto_use: true,
    csrf_token: csrfToken,
    corp_id: corpId,
    user_id: userId,
    base_url: baseUrl,
    cookies: cookieData.cookies,
    message: `✅ Valid login credentials found\n  Org: ${corpId}\n  User: ${userId}\n  Domain: ${baseUrl}`,
  };
}

// ── 从缓存刷新 csrf_token ─────────────────────────────

export function refreshCsrfFromCache(): LoginResult {
  const cookieData = loadCookieData();

  if (!cookieData || !cookieData.cookies) {
    console.error(t('login.no_cookie_cache'));
    process.exit(1);
  }

  const { csrfToken, corpId, userId } = extractInfoFromCookies(cookieData.cookies);

  if (!csrfToken) {
    console.error(t('login.no_csrf_in_cache'));
    process.exit(1);
  }

  const baseUrl = resolveBaseUrl(cookieData);
  console.error(t('login.csrf_extracted', csrfToken.slice(0, 16)));

  return {
    csrf_token: csrfToken,
    corp_id: corpId,
    user_id: userId,
    base_url: baseUrl,
    cookies: cookieData.cookies,
  };
}

// ── 确保登录态（优先缓存） ────────────────────────────

export function ensureLogin(): LoginResult {
  const cookieData = loadCookieData();

  if (cookieData && cookieData.cookies) {
    const { csrfToken, corpId, userId } = extractInfoFromCookies(cookieData.cookies);
    if (csrfToken) {
      console.error(t('login.using_cache'));
      console.error(t('login.csrf_ok', csrfToken.slice(0, 16)));
      if (corpId) {console.error(t('login.corp_id_ok', corpId));}
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

// ── Playwright 扫码登录 ───────────────────────────────

/**
 * 获取 playwright 模块的绝对路径，用于临时脚本中 require。
 *
 * 查找策略（按优先级）：
 *   1. yidacli 包自身的 node_modules/playwright（最可靠）
 *   2. require.resolve 标准解析
 *   3. 全局 npm root 路径
 */
function getPlaywrightPath(): string | null {
  const candidates = [
    path.join(__dirname, '..', 'node_modules', 'playwright', 'index.js'),
    path.join(__dirname, '..', '..', 'node_modules', 'playwright', 'index.js'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  try {
    return require.resolve('playwright');
  } catch {
    // ignore
  }

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

export function interactiveLogin(): LoginResult {
  const config = loadConfig();
  const loginUrl = config.loginUrl || DEFAULT_LOGIN_URL;

  const playwrightPath = getPlaywrightPath();
  if (!playwrightPath) {
    console.error(t('login.no_playwright'));
    console.error(t('login.playwright_install1'));
    console.error(t('login.playwright_install2'));
    process.exit(1);
  }

  console.error(t('login.browser_opening'));
  console.error(t('login.login_url_label', loginUrl));

  const scriptContent = `
const playwright = require(${JSON.stringify(playwrightPath)});
const { chromium } = playwright;
const { URL } = require('url');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(${JSON.stringify(loginUrl)}, { timeout: 120000 });

  console.error('  Waiting for login (up to 10 minutes)...');
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
  const csrfCookie = cookies.find(c => c.name === 'tianshu_csrf_token');
  let baseUrl;
  if (csrfCookie && csrfCookie.domain && csrfCookie.domain !== '.aliwork.com') {
    baseUrl = 'https://' + csrfCookie.domain.replace(/^\\./, '');
  } else {
    try { baseUrl = new URL(currentUrl).origin; } catch { baseUrl = 'https://www.aliwork.com'; }
  }
  const yidaCookie = cookies.find(c => c.name === 'yida_user_cookie');
  if (yidaCookie && yidaCookie.domain && yidaCookie.domain.includes('aliwork.com')) {
    baseUrl = 'https://' + yidaCookie.domain.replace(/^\\./, '');
  }
  await browser.close();

  console.log(JSON.stringify({ cookies, base_url: baseUrl }));
})();
`;

  const tmpScript = path.join(os.tmpdir(), `yidacli-login-${Date.now()}.js`);
  fs.writeFileSync(tmpScript, scriptContent, 'utf-8');

  try {
    const stdout = execSync(`node "${tmpScript}"`, {
      encoding: 'utf-8',
      stdio: ['inherit', 'pipe', 'inherit'],
      timeout: 660000,
    });

    const lines = stdout.trim().split('\n');
    const jsonLine = lines[lines.length - 1];
    const result = JSON.parse(jsonLine) as { cookies: Cookie[]; base_url: string };

    const { csrfToken, corpId, userId } = extractInfoFromCookies(result.cookies);
    if (!csrfToken) {
      console.error(t('login.no_csrf_in_cookie'));
      process.exit(1);
    }

    saveCookieCache(result.cookies, result.base_url);

    console.error(t('login.csrf_ok', csrfToken.slice(0, 16)));
    if (corpId) {console.error(t('login.corp_id_ok', corpId));}

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

export function logout(): void {
  const SEP = '='.repeat(50);
  console.error(SEP);
  console.error(t('login.logout_title'));
  console.error(SEP);

  const projectRoot = findProjectRoot();
  const projectCookieFile = path.join(projectRoot, '.cache', 'cookies.json');
  console.error(t('login.cookie_file_label', projectCookieFile));

  if (fs.existsSync(projectCookieFile)) {
    fs.unlinkSync(projectCookieFile);
    console.error(t('login.logout_success'));
    console.error(t('login.logout_hint'));
  } else {
    console.error(t('login.logout_no_file'));
  }

  console.error(SEP);
}
