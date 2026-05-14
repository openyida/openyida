/**
 * org.js - 组织管理模块
 *
 * 提供组织切换能力，支持：
 *   - 列出用户可访问的组织
 *   - 切换组织（无需重新登录）
 *   - 交互式组织选择
 *
 * 切换组织原理：
 *   通过一系列 HTTP 请求完成组织切换，无需重新登录。
 *   流程：
 *     1. GET /start.html?corpid={corpId}&switchCorp=true
 *     2. GET /start.html?corpid={corpId}&
 *     3. 跟随重定向获取新 Cookie
 *
 * 导出函数：
 *   listOrganizations()     - 列出可访问的组织
 *   switchOrganization()    - 切换到指定组织
 *   interactiveSwitch()     - 交互式组织选择
 */

'use strict';

const https = require('https');
const http = require('http');
const { extractInfoFromCookies, resolveBaseUrl } = require('../core/utils');
const { saveCookieCache } = require('./login');
const { saveAuthConfig, loadAuthConfig } = require('./auth');
const { t } = require('../core/i18n');

// ── HTTP 请求工具 ─────────────────────────────────────

/**
 * 发送 HTTP GET 请求并跟随重定向，提取响应中的 Cookie
 * @param {string} url - 完整 URL
 * @param {Array} cookies - 当前 Cookie 列表
 * @param {boolean} _followRedirect - 是否跟随重定向（保留参数以保持 API 一致性）
 * @returns {Promise<{statusCode: number, headers: object, cookies: Array}>}
 */
function httpGetWithCookies(url, cookies, _followRedirect = true) {
  return new Promise((resolve, reject) => {
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cookie': cookieHeader,
      },
      timeout: 30000,
    };

    // 不自动跟随重定向，手动处理以提取 Cookie
    const req = requestModule.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        // 提取 Set-Cookie 中的新 Cookie
        const setCookies = res.headers['set-cookie'] || [];
        const newCookies = parseSetCookies(setCookies, cookies);

        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          cookies: newCookies,
          location: res.headers.location,
          body: data,
        });
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error(t('common.request_timeout'))); });
    req.on('error', reject);
    req.end();
  });
}

/**
 * 解析 Set-Cookie 响应头，合并到现有 Cookie 中
 * @param {Array<string>} setCookies - Set-Cookie 响应头数组
 * @param {Array} existingCookies - 现有 Cookie 列表
 * @returns {Array} 合并后的 Cookie 列表
 */
function parseSetCookies(setCookies, existingCookies) {
  const cookieMap = new Map();

  // 先添加现有 Cookie
  for (const cookie of existingCookies) {
    cookieMap.set(cookie.name, cookie);
  }

  // 解析并更新 Cookie
  for (const setCookie of setCookies) {
    const parts = setCookie.split(';')[0].split('=');
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      cookieMap.set(name, { name, value });
    }
  }

  return Array.from(cookieMap.values());
}

// ── 组织列表获取 ──────────────────────────────────────

/**
 * 获取用户可访问的组织列表
 * @param {object} cookieData - Cookie 数据
 * @returns {Promise<Array>} 组织列表
 */
async function listOrganizations(cookieData) {
  const { c, banner, warn, sep } = require('../core/chalk');

  banner(t('org.list_title'), { stderr: false });

  const cookies = cookieData.cookies;

  // 从 Cookie 中提取当前组织信息
  const { corpId } = extractInfoFromCookies(cookies);

  if (!corpId) {
    warn(t('org.no_corp_id'), false);
    console.log(`  ${sep()}\n`);
    return [];
  }

  // 尝试调用 API 获取组织列表
  // 注意：宜搭没有直接的组织列表 API，我们从 Cookie 和 auth 配置中获取
  const authConfig = loadAuthConfig();
  const recentCorps = authConfig?.recentCorps || [];

  // 构建组织列表
  const organizations = [];

  // 添加当前组织
  organizations.push({
    corpId,
    name: t('org.current_org'),
    isCurrent: true,
    lastUsed: new Date().toISOString(),
  });

  // 添加历史组织
  for (const org of recentCorps) {
    if (org.corpId !== corpId) {
      organizations.push({
        corpId: org.corpId,
        name: org.name || org.corpId,
        isCurrent: false,
        lastUsed: org.lastUsed,
      });
    }
  }

  // 显示组织列表
  if (organizations.length === 0) {
    warn(t('org.no_organizations'), false);
  } else {
    for (const org of organizations) {
      const statusIcon = org.isCurrent ? `${c.green}✔${c.reset}` : `${c.dim}○${c.reset}`;
      const current = org.isCurrent ? ` ${c.green}(${t('org.current')})${c.reset}` : '';
      console.log(`    ${statusIcon} ${org.name}${current}`);
      console.log(`      ${c.dim}corpId: ${org.corpId}${c.reset}`);
    }
  }

  console.log(`\n  ${sep()}\n`);
  return organizations;
}

// ── 组织切换 ──────────────────────────────────────────

/**
 * 切换到指定组织（无需重新登录）
 * @param {string} targetCorpId - 目标组织 ID
 * @param {object} cookieData - 当前 Cookie 数据
 * @returns {Promise<object>} 切换结果
 */
async function switchOrganization(targetCorpId, cookieData) {
  const { c, banner, label, info, success: chalkSuccess, warn: chalkWarn, fail: chalkFail, step, sep } = require('../core/chalk');

  banner(t('org.switch_title'), { stderr: false });

  const cookies = cookieData.cookies;
  const { corpId: currentCorpId } = extractInfoFromCookies(cookies);

  label('From', currentCorpId || t('org.unknown'), { stderr: false });
  label('To', `${c.green}${targetCorpId}${c.reset}`, { stderr: false });

  if (currentCorpId === targetCorpId) {
    chalkWarn(t('org.already_in_org'), false);
    console.log(`  ${sep()}\n`);
    return {
      success: true,
      corpId: targetCorpId,
      message: 'Already in target organization',
    };
  }

  try {
    const baseUrl = resolveBaseUrl(cookieData);

    // Step 1: 发起切换请求
    step(1, t('org.step1'), false);
    const step1Url = `${baseUrl}/start.html?corpid=${targetCorpId}&switchCorp=true`;
    const step1Result = await httpGetWithCookies(step1Url, cookies, false);

    // Step 2: 确认切换
    step(2, t('org.step2'), false);
    const step2Url = `${baseUrl}/start.html?corpid=${targetCorpId}&`;
    const step2Result = await httpGetWithCookies(step2Url, step1Result.cookies, false);

    // Step 3-4: 获取新 Cookie（跟随重定向）
    step(3, t('org.step3'), false);
    const step3Url = `${baseUrl}/start.html?corpid=${targetCorpId}&`;
    const step3Result = await httpGetWithCookies(step3Url, step2Result.cookies, false);

    // 处理重定向
    let finalCookies = step3Result.cookies;
    let currentUrl = step3Result.location;

    // 跟随重定向最多 5 次
    let redirectCount = 0;
    while (currentUrl && redirectCount < 5) {
      redirectCount++;
      info(`${t('org.redirect', redirectCount)}`, false);

      // 构建完整 URL
      if (!currentUrl.startsWith('http')) {
        currentUrl = new URL(currentUrl, baseUrl).toString();
      }

      const redirectResult = await httpGetWithCookies(currentUrl, finalCookies, false);
      finalCookies = redirectResult.cookies;
      currentUrl = redirectResult.location;

      // 如果到达工作台，停止
      if (currentUrl && currentUrl.includes('workPlatform')) {
        break;
      }
    }

    // 提取新的 csrf_token 和 corpId
    const { csrfToken, corpId: newCorpId, userId } = extractInfoFromCookies(finalCookies);

    if (!csrfToken) {
      chalkFail(t('org.switch_failed_no_csrf'), { exit: false });
      console.log(`  ${sep()}\n`);
      return {
        success: false,
        message: 'No csrf_token in new cookies',
      };
    }

    // 保存新的 Cookie
    const newBaseUrl = baseUrl;
    saveCookieCache(finalCookies, newBaseUrl);

    // 更新 auth 配置
    const authConfig = loadAuthConfig() || {};
    authConfig.corpId = newCorpId;
    authConfig.userId = userId;
    authConfig.switchTime = new Date().toISOString();

    // 更新历史组织列表
    if (!authConfig.recentCorps) {
      authConfig.recentCorps = [];
    }

    // 移除旧记录，添加新记录
    authConfig.recentCorps = authConfig.recentCorps.filter((c) => c.corpId !== newCorpId);
    authConfig.recentCorps.unshift({
      corpId: newCorpId,
      name: t('org.switched_org'),
      lastUsed: new Date().toISOString(),
    });

    // 保留最近 10 个组织
    authConfig.recentCorps = authConfig.recentCorps.slice(0, 10);
    saveAuthConfig(authConfig);

    chalkSuccess(t('org.switch_success'), false);
    label('Corp ID', newCorpId, { stderr: false });
    label('CSRF', `${csrfToken.slice(0, 16)}…`, { stderr: false });
    console.log(`  ${sep()}\n`);

    return {
      success: true,
      corpId: newCorpId,
      csrfToken,
      userId,
      baseUrl: newBaseUrl,
      cookies: finalCookies,
    };
  } catch (error) {
    chalkFail(t('org.switch_error', error.message), { exit: false });
    console.log(`  ${sep()}\n`);
    return {
      success: false,
      message: error.message,
    };
  }
}

// ── 交互式组织选择 ────────────────────────────────────

/**
 * 交互式组织选择
 * @param {object} cookieData - Cookie 数据
 * @returns {Promise<object>} 切换结果
 */
async function interactiveSwitch(cookieData) {
  const organizations = await listOrganizations(cookieData);

  if (organizations.length === 0) {
    return {
      success: false,
      message: 'No organizations available',
    };
  }

  // 过滤掉当前组织
  const switchableOrgs = organizations.filter((org) => !org.isCurrent);

  if (switchableOrgs.length === 0) {
    const { info: chalkInfo2 } = require('../core/chalk');
    chalkInfo2(t('org.only_one_org'), false);
    return {
      success: false,
      message: 'Only one organization available',
    };
  }

  // 显示可选组织
  const { c: oc, hint: chalkHint2 } = require('../core/chalk');
  console.log(`\n  ${oc.bold}${t('org.select_prompt')}${oc.reset}`);
  switchableOrgs.forEach((org, index) => {
    console.log(`    ${oc.cyan}${index + 1}.${oc.reset} ${org.name} ${oc.dim}(${org.corpId})${oc.reset}`);
  });

  // 在非交互模式下，提示用户使用 --corp-id 参数
  chalkHint2(t('org.use_corp_id_hint'), false);

  return {
    success: false,
    message: 'Interactive mode not supported, please use --corp-id option',
    organizations: switchableOrgs,
  };
}

module.exports = {
  listOrganizations,
  switchOrganization,
  interactiveSwitch,
};
