#!/usr/bin/env node

'use strict';

/**
 * 截取已发布宜搭页面的截图，供"应用效果"打分（自动或人工）。
 *
 * - Playwright 为软依赖：按本地/全局依赖多策略解析；缺失则优雅跳过，
 *   不让整个 E2E 失败。
 * - 使用 OpenYida token session 注入 Authorization: Bearer，不读取或写入 Cookie。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');

/**
 * 解析 playwright 模块路径（复用 token session 截图链路的 Playwright 解析策略）。
 * @returns {string|null}
 */
function getPlaywrightPath() {
  try {
    return require.resolve('playwright');
  } catch {
    // ignore
  }
  const candidates = [
    path.join(ROOT, 'node_modules', 'playwright', 'index.js'),
    path.join(__dirname, '..', '..', 'node_modules', 'playwright', 'index.js'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {return candidate;}
  }
  try {
    const globalRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim();
    const globalPlaywright = path.join(globalRoot, 'playwright', 'index.js');
    if (fs.existsSync(globalPlaywright)) {return globalPlaywright;}
  } catch {
    // ignore
  }
  return null;
}

/**
 * 读取本地 token session，返回可注入浏览器请求的 Authorization header。
 */
function loadBearerAuth(options = {}) {
  try {
    const { loadTokenSession } = require('../../lib/auth/token-store');
    const session = loadTokenSession({
      projectRoot: options.projectRoot || path.join(ROOT, 'project'),
      envName: options.envName,
    });
    if (session && session.access_token) {
      return {
        authMode: 'token',
        baseUrl: session.base_url || null,
        headers: {
          Authorization: `${session.token_type || 'Bearer'} ${session.access_token}`,
        },
      };
    }
  } catch {
    // Screenshot capture should stay best-effort.
  }
  return { authMode: 'token', baseUrl: null, headers: {} };
}

function slugify(value, fallback) {
  const s = String(value || fallback || 'shot').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return s || fallback || 'shot';
}

function normalizeCookies(cookies, targetUrl) {
  const list = Array.isArray(cookies) ? cookies : [];
  let hostname = '';
  try {
    hostname = new URL(targetUrl).hostname;
  } catch {
    hostname = '';
  }
  return list
    .filter((cookie) => cookie && cookie.name)
    .map((cookie) => ({
      ...cookie,
      value: String(cookie.value === null || typeof cookie.value === 'undefined' ? '' : cookie.value),
      domain: cookie.domain || hostname,
      path: cookie.path || '/',
    }));
}

/**
 * 判断 chromium.launch 抛出的错误是否为「浏览器二进制未下载」。
 * 这类错误会附带大段安装横幅，需要归一化为简短 reason，避免污染报告。
 */
function isBrowserMissingError(message = '') {
  return /Executable doesn't exist|playwright install|chrome-headless-shell|Please run the following command/i.test(String(message));
}

// 浏览器缺失时给用户的一句话修复指引。
const BROWSER_MISSING_HINT = '运行 `npx playwright install chromium` 下载浏览器后重试';

/**
 * 对一组目标 URL 截图。
 * @param {object} options
 * @param {Array<{stage:string,type:string,url:string}>} options.targets
 * @param {string} options.outputDir 截图输出目录
 * @param {number} [options.timeoutMs]
 * @returns {Promise<{available:boolean, reason?:string, screenshots:Array}>}
 */
async function captureScreenshots(options = {}) {
  const targets = Array.isArray(options.targets) ? options.targets : [];
  const outputDir = options.outputDir || path.join(ROOT, 'project', '.cache', 'eval-screenshots');
  const timeoutMs = options.timeoutMs || 30000;

  if (targets.length === 0) {
    return { available: true, screenshots: [] };
  }

  const playwrightPath = getPlaywrightPath();
  if (!playwrightPath) {
    return {
      available: false,
      reason: 'playwright-missing',
      screenshots: targets.map((t) => ({ ...t, ok: false, skipped: 'playwright-missing', path: null })),
    };
  }

  // eslint-disable-next-line import/no-dynamic-require, global-require
  const { chromium } = require(playwrightPath);
  fs.mkdirSync(outputDir, { recursive: true });

  const bearerAuth = options.bearerAuth || loadBearerAuth(options);

  const screenshots = [];
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      extraHTTPHeaders: bearerAuth.headers || {},
    });

    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i];
      const fileName = `${String(i + 1).padStart(2, '0')}-${slugify(target.stage, target.type)}.png`;
      const filePath = path.join(outputDir, fileName);
      const page = await context.newPage();
      try {
        await page.goto(target.url, { waitUntil: 'networkidle', timeout: timeoutMs });
        await page.waitForTimeout(1500);
        await page.screenshot({ path: filePath, fullPage: true });
        screenshots.push({ ...target, ok: true, path: filePath });
      } catch (error) {
        screenshots.push({ ...target, ok: false, path: null, error: error.message });
      } finally {
        await page.close().catch(() => {});
      }
    }
  } catch (error) {
    // launch 失败：区分「浏览器未下载」（环境问题，可修复）与其他启动错误。
    if (isBrowserMissingError(error.message)) {
      return {
        available: false,
        reason: 'browser-missing',
        hint: BROWSER_MISSING_HINT,
        screenshots: targets.map((t) => ({ ...t, ok: false, skipped: 'browser-missing', path: null })),
      };
    }
    return {
      available: false,
      reason: error.message,
      screenshots: targets.map((t) => ({ ...t, ok: false, error: error.message, path: null })),
    };
  } finally {
    if (browser) {await browser.close().catch(() => {});}
  }

  return { available: true, authMode: 'token', screenshots };
}

module.exports = {
  getPlaywrightPath,
  loadBearerAuth,
  slugify,
  normalizeCookies,
  isBrowserMissingError,
  BROWSER_MISSING_HINT,
  captureScreenshots,
};
