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
const { extractInfoFromCookies } = require('../core/utils');
const { saveCookieCache } = require('./login');
const { saveAuthConfig, loadAuthConfig } = require('./auth');
const { t } = require('../core/i18n');

const DEFAULT_BASE_URL = 'https://www.aliwork.com';

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
  const SEP = '='.repeat(55);
  console.log(SEP);
  console.log(t('org.list_title'));
  console.log(SEP);

  const cookies = cookieData.cookies;

  // 从 Cookie 中提取当前组织信息
  const { corpId } = extractInfoFromCookies(cookies);

  if (!corpId) {
    console.log(t('org.no_corp_id'));
    console.log(SEP);
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
    console.log(t('org.no_organizations'));
  } else {
    for (const org of organizations) {
      const icon = org.isCurrent ? '✅' : '  ';
      const current = org.isCurrent ? ` (${t('org.current')})` : '';
      console.log(`  ${icon} ${org.name}${current}`);
      console.log(`     corpId: ${org.corpId}`);
    }
  }

  console.log(SEP);
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
  const SEP = '='.repeat(55);
  console.log(SEP);
  console.log(t('org.switch_title'));
  console.log(SEP);

  const cookies = cookieData.cookies;
  const { corpId: currentCorpId } = extractInfoFromCookies(cookies);

  console.log(t('org.switch_from', currentCorpId || t('org.unknown')));
  console.log(t('org.switch_to', targetCorpId));

  if (currentCorpId === targetCorpId) {
    console.log(t('org.already_in_org'));
    console.log(SEP);
    return {
      success: true,
      corpId: targetCorpId,
      message: 'Already in target organization',
    };
  }

  try {
    // Step 1: 发起切换请求
    console.log(t('org.step1'));
    const step1Url = `${DEFAULT_BASE_URL}/start.html?corpid=${targetCorpId}&switchCorp=true`;
    const step1Result = await httpGetWithCookies(step1Url, cookies, false);

    // Step 2: 确认切换
    console.log(t('org.step2'));
    const step2Url = `${DEFAULT_BASE_URL}/start.html?corpid=${targetCorpId}&`;
    const step2Result = await httpGetWithCookies(step2Url, step1Result.cookies, false);

    // Step 3-4: 获取新 Cookie（跟随重定向）
    console.log(t('org.step3'));
    const step3Url = `https://ding.aliwork.com/start.html?corpid=${targetCorpId}&`;
    const step3Result = await httpGetWithCookies(step3Url, step2Result.cookies, false);

    // 处理重定向
    let finalCookies = step3Result.cookies;
    let currentUrl = step3Result.location;

    // 跟随重定向最多 5 次
    let redirectCount = 0;
    while (currentUrl && redirectCount < 5) {
      redirectCount++;
      console.log(t('org.redirect', redirectCount));

      // 构建完整 URL
      if (!currentUrl.startsWith('http')) {
        currentUrl = `https://ding.aliwork.com${currentUrl}`;
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
      console.log(t('org.switch_failed_no_csrf'));
      console.log(SEP);
      return {
        success: false,
        message: 'No csrf_token in new cookies',
      };
    }

    // 保存新的 Cookie
    const newBaseUrl = 'https://ding.aliwork.com';
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

    console.log(t('org.switch_success'));
    console.log(t('org.new_corp_id', newCorpId));
    console.log(t('org.new_csrf', csrfToken.slice(0, 16)));
    console.log(SEP);

    return {
      success: true,
      corpId: newCorpId,
      csrfToken,
      userId,
      baseUrl: newBaseUrl,
      cookies: finalCookies,
    };
  } catch (error) {
    console.log(t('org.switch_error', error.message));
    console.log(SEP);
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
    console.log(t('org.only_one_org'));
    return {
      success: false,
      message: 'Only one organization available',
    };
  }

  // 显示可选组织
  console.log(t('org.select_prompt'));
  switchableOrgs.forEach((org, index) => {
    console.log(`  ${index + 1}. ${org.name} (${org.corpId})`);
  });

  // 在非交互模式下，提示用户使用 --corp-id 参数
  console.log(t('org.use_corp_id_hint'));

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
