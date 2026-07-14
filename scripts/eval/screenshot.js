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
 * 解析 playwright 模块路径（复刻 lib/auth/login.js getPlaywrightPath 策略）。
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
  captureScreenshots,
};
