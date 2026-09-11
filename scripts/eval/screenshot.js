#!/usr/bin/env node

'use strict';

/* global document, window */

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

function evaluatePageRuntime(runtime = {}, expectations = {}) {
  const expected = {
    maxConsoleErrors: 0,
    maxPageErrors: 0,
    maxBrokenImages: 0,
    minTextLength: 20,
    requireSettled: true,
    ...expectations,
  };
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });
  add('consoleErrors', Number(runtime.consoleErrorCount || 0) <= expected.maxConsoleErrors,
    `期望 ≤${expected.maxConsoleErrors}，实际 ${Number(runtime.consoleErrorCount || 0)}`);
  add('pageErrors', Number(runtime.pageErrorCount || 0) <= expected.maxPageErrors,
    `期望 ≤${expected.maxPageErrors}，实际 ${Number(runtime.pageErrorCount || 0)}`);
  add('brokenImages', Number(runtime.brokenImageCount || 0) <= expected.maxBrokenImages,
    `期望 ≤${expected.maxBrokenImages}，实际 ${Number(runtime.brokenImageCount || 0)}`);
  add('textLength', Number(runtime.textLength || 0) >= expected.minTextLength,
    `期望 ≥${expected.minTextLength}，实际 ${Number(runtime.textLength || 0)}`);
  if (expected.requireSettled) {
    add('loadingSettled', Number(runtime.loadingIndicatorCount || 0) === 0,
      `可见加载指示器 ${Number(runtime.loadingIndicatorCount || 0)} 个`);
  }
  if (Array.isArray(expected.requiredTextAny) && expected.requiredTextAny.length) {
    const matched = expected.requiredTextAny.filter((text) => String(runtime.bodyText || '').includes(String(text)));
    add('requiredTextAny', matched.length > 0,
      matched.length ? `命中 ${matched.join('、')}` : `未命中任一要求文案：${expected.requiredTextAny.join('、')}`);
  }
  if (Array.isArray(expected.forbiddenTextAny) && expected.forbiddenTextAny.length) {
    const matched = expected.forbiddenTextAny.filter((text) => String(runtime.bodyText || '').includes(String(text)));
    add('forbiddenTextAny', matched.length === 0,
      matched.length ? `命中禁止文案：${matched.join('、')}` : '未命中禁止文案');
  }
  if (expected.requireKnownDataEvidence) {
    const bodyText = String(runtime.bodyText || '');
    const positiveCounts = (Array.isArray(expected.knownDataCounts) ? expected.knownDataCounts : [])
      .filter(item => item && Number(item.count) > 0);
    const matched = positiveCounts.find(item => (
      bodyText.includes(String(item.name || '')) && bodyText.includes(String(item.count))
    ));
    let detail = '已知业务数据非空，但页面未显示任何对应数据源名称与数量';
    if (positiveCounts.length === 0) {
      detail = '只读回读未发现非空业务数据，不要求页面显示非零数量';
    } else if (matched) {
      detail = `页面显示已回读数据源 ${matched.name} 的数量 ${matched.count}`;
    }
    add(
      'knownDataEvidence',
      positiveCounts.length === 0 || !!matched,
      detail
    );
  }
  return { pass: checks.every((check) => check.ok), checks };
}

async function collectPageRuntime(page, diagnostics = {}) {
  const dom = await page.evaluate(() => {
    const bodyText = document.body ? document.body.innerText || '' : '';
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const loadingIndicatorCount = Array.from(document.querySelectorAll(
      '[aria-busy="true"], .next-loading, .next-loading-tip, .ant-spin-spinning',
    )).filter(visible).length;
    const brokenImageCount = Array.from(document.images || [])
      .filter((image) => image.complete && image.naturalWidth === 0).length;
    return {
      title: document.title || '',
      bodyText,
      textLength: bodyText.trim().length,
      loadingIndicatorCount,
      brokenImageCount,
    };
  });
  return {
    ...dom,
    finalUrl: page.url(),
    consoleErrorCount: diagnostics.consoleErrorCount || 0,
    pageErrorCount: diagnostics.pageErrorCount || 0,
  };
}

function runtimeFindingsFromScreenshots(screenshots = []) {
  const findings = [];
  for (const shot of screenshots) {
    if (!shot || !Array.isArray(shot.runtimeChecks)) {continue;}
    for (const check of shot.runtimeChecks.filter((item) => item && item.ok === false)) {
      findings.push({
        code: check.name === 'forbiddenTextAny' ? 'page-visible-data-missing' : 'browser-runtime-signal-failed',
        detail: `${shot.name || shot.stage || shot.url}: ${check.detail}`,
        source: 'browser-runtime',
        scenarioId: shot.scenarioId || null,
        targetUrl: shot.url || null,
        check: check.name,
      });
    }
  }
  return findings;
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
      const diagnostics = { consoleErrorCount: 0, pageErrorCount: 0 };
      page.on('console', (message) => {
        if (message.type() === 'error') {diagnostics.consoleErrorCount += 1;}
      });
      page.on('pageerror', () => {diagnostics.pageErrorCount += 1;});
      try {
        await page.goto(target.url, { waitUntil: 'networkidle', timeout: timeoutMs });
        await page.waitForTimeout(1500);
        const runtimeWithText = await collectPageRuntime(page, diagnostics);
        const runtimeEvaluation = evaluatePageRuntime(runtimeWithText, target.runtimeExpectations || {});
        const runtime = { ...runtimeWithText };
        delete runtime.bodyText;
        await page.screenshot({ path: filePath, fullPage: true });
        screenshots.push({
          ...target,
          ok: true,
          path: filePath,
          runtime,
          runtimePass: runtimeEvaluation.pass,
          runtimeChecks: runtimeEvaluation.checks,
        });
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
  evaluatePageRuntime,
  collectPageRuntime,
  runtimeFindingsFromScreenshots,
  captureScreenshots,
};
