/**
 * qr-login.js - 终端二维码扫码登录
 *
 * 实现流程：
 *   1. 调用宜搭登录接口获取钉钉二维码 URL
 *   2. 在终端渲染二维码（使用 qrcode 包）
 *   3. 轮询扫码状态，等待用户用钉钉扫码确认
 *   4. 获取登录 Cookie
 *   5. 调用接口获取用户可访问的组织列表
 *   6. 交互式问答让用户选择组织
 *   7. 切换到目标组织，保存最终 Cookie
 *
 * 导出函数：
 *   qrLogin() - 执行完整的终端二维码登录流程
 */

'use strict';

const https = require('https');
const http = require('http');
const readline = require('readline');
const { extractInfoFromCookies } = require('../core/utils');
const { saveCookieCache } = require('./login');
const { t } = require('../core/i18n');
const { warn } = require('../core/chalk');

const { resolveLoginUrl, resolveEndpoint } = require('../core/env-manager');

// ── HTTP 工具 ─────────────────────────────────────────

/**
 * 发送 GET 请求，返回响应体字符串和 Set-Cookie 头。
 * @param {string} url - 完整 URL
 * @param {object} [options] - 额外选项
 * @param {string} [options.cookieHeader] - Cookie 请求头
 * @returns {Promise<{ body: string, cookies: string[], statusCode: number, headers: object }>}
 */
function fetchGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'application/json, text/plain, */*',
        ...(options.cookieHeader ? { Cookie: options.cookieHeader } : {}),
        ...(options.referer ? { Referer: options.referer } : {}),
        ...(options.origin ? { Origin: options.origin } : {}),
        ...(options.headers || {}),
      },
      timeout: 30000,
    };

    const req = requestModule.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        const setCookieHeaders = res.headers['set-cookie'] || [];
        resolve({ body, cookies: setCookieHeaders, statusCode: res.statusCode, headers: res.headers });
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error(t('common.request_timeout'))); });
    req.on('error', reject);
    req.end();
  });
}

/**
 * 发送 POST 请求，返回响应体字符串和 Set-Cookie 头。
 * @param {string} url - 完整 URL
 * @param {string} postData - 请求体
 * @param {object} [options] - 额外选项
 * @returns {Promise<{ body: string, cookies: string[], statusCode: number, headers: object }>}
 */
function fetchPost(url, postData, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': options.contentType || 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'application/json, text/plain, */*',
        ...(options.cookieHeader ? { Cookie: options.cookieHeader } : {}),
        ...(options.referer ? { Referer: options.referer } : {}),
        ...(options.origin ? { Origin: options.origin } : {}),
        ...(options.headers || {}),
      },
      timeout: 30000,
    };

    const req = requestModule.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        const setCookieHeaders = res.headers['set-cookie'] || [];
        resolve({ body, cookies: setCookieHeaders, statusCode: res.statusCode, headers: res.headers });
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error(t('common.request_timeout'))); });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function isRedirectStatus(statusCode) {
  return [301, 302, 303, 307, 308].includes(statusCode);
}

/**
 * 跟随 GET 重定向，并持续合并 Set-Cookie。
 * @param {string} url
 * @param {object} [options]
 * @param {number} [maxRedirects]
 * @returns {Promise<{ body: string, cookies: string[], statusCode: number, headers: object, finalUrl: string, cookieHeader: string }>}
 */
async function fetchGetFollowRedirects(url, options = {}, maxRedirects = 10) {
  let currentUrl = url;
  let referer = options.referer;
  let cookieHeader = options.cookieHeader || '';

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    const response = await fetchGet(currentUrl, {
      ...options,
      cookieHeader,
      referer,
    });

    cookieHeader = mergeCookies(cookieHeader, response.cookies);

    const location = response.headers && response.headers.location;
    if (!isRedirectStatus(response.statusCode) || !location) {
      return {
        ...response,
        finalUrl: currentUrl,
        cookieHeader,
      };
    }

    referer = currentUrl;
    currentUrl = new URL(location, currentUrl).toString();
  }

  throw new Error(t('qr_login.get_qr_failed', 'too many redirects'));
}

// ── Cookie 工具 ───────────────────────────────────────

/**
 * 将 Set-Cookie 响应头数组解析为 name=value 格式的 Cookie 字符串。
 * @param {string[]} setCookieHeaders
 * @returns {string}
 */
function buildCookieHeader(setCookieHeaders) {
  return setCookieHeaders
    .map((header) => header.split(';')[0].trim())
    .join('; ');
}

/**
 * 将 Set-Cookie 响应头数组合并到已有 Cookie 字符串中（去重，新值覆盖旧值）。
 * @param {string} existingCookieHeader
 * @param {string[]} newSetCookieHeaders
 * @returns {string}
 */
function mergeCookies(existingCookieHeader, newSetCookieHeaders) {
  const cookieMap = new Map();

  // 解析已有 Cookie
  if (existingCookieHeader) {
    for (const pair of existingCookieHeader.split(';')) {
      const trimmed = pair.trim();
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        cookieMap.set(trimmed.slice(0, eqIndex).trim(), trimmed.slice(eqIndex + 1).trim());
      }
    }
  }

  // 合并新 Cookie（覆盖旧值）
  for (const header of newSetCookieHeaders) {
    const pair = header.split(';')[0].trim();
    const eqIndex = pair.indexOf('=');
    if (eqIndex > 0) {
      cookieMap.set(pair.slice(0, eqIndex).trim(), pair.slice(eqIndex + 1).trim());
    }
  }

  return Array.from(cookieMap.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

/**
 * 将 Cookie 字符串转换为 Playwright 格式的 Cookie 对象数组。
 * @param {string} cookieHeader
 * @param {string} domain
 * @returns {Array<{ name: string, value: string, domain: string, path: string }>}
 */
function cookieHeaderToObjects(cookieHeader, domain) {
  return cookieHeader
    .split(';')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const eqIndex = pair.indexOf('=');
      if (eqIndex < 0) {return null;}
      return {
        name: pair.slice(0, eqIndex).trim(),
        value: pair.slice(eqIndex + 1).trim(),
        domain,
        path: '/',
      };
    })
    .filter(Boolean);
}

// ── 二维码渲染 ────────────────────────────────────────

/**
 * 查找 qrcode 模块。
 * @param {Function} [requireFn]
 * @returns {object|null}
 */
function resolveQrcodeModule(requireFn = require) {
  try {
    return requireFn('qrcode');
  } catch {
    // qrcode 未安装，尝试从全局或相邻路径加载
    const path = require('path');
    const candidates = [
      path.join(__dirname, '..', 'node_modules', 'qrcode'),
      path.join(__dirname, '..', '..', 'node_modules', 'qrcode'),
    ];
    for (const candidate of candidates) {
      try {
        return requireFn(candidate);
      } catch {
        // continue
      }
    }
  }

  return null;
}

/**
 * 在终端渲染二维码。
 * 优先使用 qrcode 包的 toString 方法（小尺寸），若不可用则降级输出 URL。
 * 二维码本体必须直接写入终端，不能加 warn/info 前缀，否则可能破坏终端二维码的对齐。
 * @param {string} url - 要编码的 URL
 * @param {object} [options] - 测试注入选项
 * @param {object|null} [options.qrcode] - qrcode 模块
 * @param {Function} [options.requireFn] - 自定义 require
 * @param {Function} [options.writeFn] - 直接输出二维码
 * @param {Function} [options.warnFn] - 输出 fallback/错误提示
 */
async function renderQrCodeInTerminal(url, options = {}) {
  const qrcode = Object.prototype.hasOwnProperty.call(options, 'qrcode')
    ? options.qrcode
    : resolveQrcodeModule(options.requireFn || require);
  const writeFn = options.writeFn || ((text) => process.stderr.write(text));
  const warnFn = options.warnFn || warn;

  try {
    if (qrcode && typeof qrcode.toString === 'function') {
      const qrString = await qrcode.toString(url, {
        type: 'terminal',
        small: true,
        errorCorrectionLevel: 'M',
      });
      writeFn(qrString.endsWith('\n') ? qrString : `${qrString}\n`);
    } else {
      // 降级：输出 URL 提示用户手动访问
      warnFn(t('qr_login.qrcode_fallback'));
      warnFn(`  ${url}`);
    }
  } catch (err) {
    warnFn(t('qr_login.qrcode_render_failed', err.message));
    warnFn(`  ${url}`);
  }
}

// ── 宜搭登录 API ──────────────────────────────────────

function isDingtalkOAuthChallengeUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname.endsWith('dingtalk.com') &&
      parsedUrl.pathname.startsWith('/oauth2/');
  } catch {
    return false;
  }
}

function buildOAuthPostData(loginPageUrl, extraParams = {}) {
  const parsedUrl = new URL(loginPageUrl);
  const params = new URLSearchParams(parsedUrl.searchParams);

  Object.entries(extraParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  });

  return params.toString();
}

function extractDingtalkQrCode(qrUrl) {
  try {
    return new URL(qrUrl).searchParams.get('code');
  } catch {
    const matched = qrUrl.match(/[?&]code=([^&]+)/);
    return matched ? decodeURIComponent(matched[1]) : null;
  }
}

function resolveDingtalkLoginResultUrl(loginResult) {
  if (typeof loginResult === 'string') {
    return loginResult;
  }

  if (!loginResult || typeof loginResult !== 'object') {
    return null;
  }

  return loginResult.url ||
    loginResult.redirectUrl ||
    loginResult.loginUrl ||
    loginResult.nextUrl ||
    null;
}

function shouldChooseDingtalkOAuthOrganization(loginResult) {
  return !!(
    loginResult &&
    typeof loginResult === 'object' &&
    loginResult.chooseOrganization === true &&
    Array.isArray(loginResult.orgList)
  );
}

function normalizeDingtalkOAuthOrgList(orgList) {
  if (!Array.isArray(orgList)) {return [];}

  return orgList
    .map((org) => ({
      corpId: org.corpId || org.corpID || org.id,
      corpName: org.corpName || org.name || org.corpId || org.id,
      mainOrg: !!org.mainOrg,
    }))
    .filter((org) => org.corpId);
}

function selectCorpById(corpList, targetCorpId) {
  const selectedCorp = corpList.find((corp) => corp.corpId === targetCorpId);
  if (!selectedCorp) {
    throw new Error(t('qr_login.target_corp_not_found', targetCorpId));
  }
  return selectedCorp;
}

async function resolveCorpSelection(corpList, options = {}) {
  const targetCorpId = options.corpId || options.targetCorpId;
  if (targetCorpId) {
    return selectCorpById(corpList, targetCorpId);
  }

  const selectCorp = options.selectCorp || selectCorpInteractively;
  return selectCorp(corpList);
}

function deriveAliworkBaseUrl(fallbackBaseUrl, finalUrl) {
  try {
    const parsedUrl = new URL(finalUrl);
    if (parsedUrl.hostname.endsWith('aliwork.com')) {
      return parsedUrl.origin;
    }
  } catch {
    // ignore
  }

  return fallbackBaseUrl;
}

/**
 * Step 1：访问宜搭登录页，获取初始 Cookie 和 CSRF Token。
 * @param {string} baseUrl
 * @param {object} [options]
 * @returns {Promise<{ cookieHeader: string, loginPageUrl: string }>}
 */
async function fetchInitialSession(baseUrl, options = {}) {
  const loginPageUrl = options.loginUrl || resolveLoginUrl() || `${baseUrl}/workPlatform`;
  const response = await fetchGetFollowRedirects(loginPageUrl, {
    cookieHeader: options.cookieHeader || '',
  });

  return {
    cookieHeader: response.cookieHeader || buildCookieHeader(response.cookies),
    loginPageUrl: response.finalUrl,
  };
}

/**
 * 旧版宜搭二维码接口。保留给私有化/旧环境兜底。
 * @param {string} baseUrl
 * @param {string} cookieHeader
 * @returns {Promise<{ qrUrl: string, state: string, cookieHeader: string, context: object }>}
 */
async function fetchLegacyQrCodeUrl(baseUrl, cookieHeader) {
  const apiUrl = `${baseUrl}/dingtalk/web/getLoginQrCode.json`;
  const response = await fetchGet(apiUrl, {
    cookieHeader,
    referer: `${baseUrl}/login.html`,
  });

  const updatedCookieHeader = mergeCookies(cookieHeader, response.cookies);

  let parsed;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    throw new Error(t('qr_login.get_qr_failed', response.body.substring(0, 200)));
  }

  if (!parsed.success || !parsed.content) {
    throw new Error(t('qr_login.get_qr_api_failed', parsed.errorMsg || JSON.stringify(parsed)));
  }

  const { qrUrl, state } = parsed.content;
  return {
    qrUrl,
    state,
    cookieHeader: updatedCookieHeader,
    context: { type: 'legacy' },
  };
}

async function fetchDingtalkOAuthQrCodeUrl(loginPageUrl, cookieHeader) {
  const parsedLoginUrl = new URL(loginPageUrl);
  const origin = parsedLoginUrl.origin;
  const apiUrl = `${origin}/oauth2/generate_qrcode`;

  const response = await fetchPost(apiUrl, buildOAuthPostData(loginPageUrl), {
    cookieHeader,
    referer: loginPageUrl,
    origin,
  });

  const updatedCookieHeader = mergeCookies(cookieHeader, response.cookies);

  let parsed;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    throw new Error(t('qr_login.get_qr_failed', response.body.substring(0, 200)));
  }

  const qrUrl = parsed.result || parsed.content || parsed.qrUrl;
  if (!parsed.success || !qrUrl) {
    throw new Error(t('qr_login.get_qr_api_failed', parsed.errorMsg || JSON.stringify(parsed)));
  }

  const code = extractDingtalkQrCode(qrUrl);
  if (!code) {
    throw new Error(t('qr_login.get_qr_api_failed', JSON.stringify(parsed)));
  }

  return {
    qrUrl,
    state: code,
    cookieHeader: updatedCookieHeader,
    context: {
      type: 'dingtalk_oauth',
      loginPageUrl,
      origin,
      code,
    },
  };
}

/**
 * Step 2：获取钉钉扫码登录的二维码信息。
 * 当前公有云使用钉钉 OAuth 二维码；旧环境继续走旧版宜搭接口。
 * @param {string} baseUrl
 * @param {string} cookieHeader
 * @param {string} loginPageUrl
 * @returns {Promise<{ qrUrl: string, state: string, cookieHeader: string, context: object }>}
 */
async function fetchQrCodeUrl(baseUrl, cookieHeader, loginPageUrl) {
  if (isDingtalkOAuthChallengeUrl(loginPageUrl)) {
    return fetchDingtalkOAuthQrCodeUrl(loginPageUrl, cookieHeader);
  }

  return fetchLegacyQrCodeUrl(baseUrl, cookieHeader);
}

async function postDingtalkOAuthLoginWithQr(context, cookieHeader, extraParams = {}) {
  const pollUrl = `${context.origin}/oauth2/login_with_qr`;
  const response = await fetchPost(pollUrl, buildOAuthPostData(context.loginPageUrl, {
    code: context.code,
    exclusiveCorpId: '',
    stayLogin: false,
    ...extraParams,
  }), {
    cookieHeader,
    referer: context.loginPageUrl,
    origin: context.origin,
  });

  const updatedCookieHeader = mergeCookies(cookieHeader, response.cookies);

  let parsed;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    parsed = null;
  }

  return {
    parsed,
    cookieHeader: updatedCookieHeader,
  };
}

async function pollDingtalkQrCodeStatus(state, cookieHeader, onWaiting, context) {
  const maxAttempts = 120;
  const pollIntervalMs = 1000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

    const { parsed, cookieHeader: updatedCookieHeader } = await postDingtalkOAuthLoginWithQr(context, cookieHeader, {
      code: state,
      exclusiveCorpId: '',
      stayLogin: false,
    });
    cookieHeader = updatedCookieHeader;

    if (!parsed) {
      continue;
    }

    if (parsed.success) {
      return {
        loginResult: parsed.result || parsed.content || parsed,
        cookieHeader,
      };
    }

    const errorCode = String(parsed.errorCode || '');
    if (errorCode === '11041') {
      if (onWaiting) {onWaiting('scanned');}
      continue;
    }

    if (errorCode === '11021') {
      continue;
    }

    if (errorCode === '11019') {
      throw new Error(t('qr_login.qr_expired'));
    }

    throw new Error(parsed.errorMsg || JSON.stringify(parsed));
  }

  throw new Error(t('qr_login.poll_timeout'));
}

/**
 * Step 3：轮询扫码状态，等待用户扫码并确认。
 * @param {string} baseUrl
 * @param {string} state - 二维码状态标识
 * @param {string} cookieHeader
 * @param {Function} onWaiting - 等待回调（可用于显示进度）
 * @param {object} [context]
 * @returns {Promise<{ authCode?: string, loginResult?: object|string, cookieHeader: string }>}
 */
async function pollQrCodeStatus(baseUrl, state, cookieHeader, onWaiting, context = {}) {
  if (context.type === 'dingtalk_oauth') {
    return pollDingtalkQrCodeStatus(state, cookieHeader, onWaiting, context);
  }

  const pollUrl = `${baseUrl}/dingtalk/web/checkLoginQrCode.json`;
  const maxAttempts = 120; // 最多轮询 2 分钟（每秒一次）
  const pollIntervalMs = 1000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

    const response = await fetchGet(`${pollUrl}?state=${encodeURIComponent(state)}`, {
      cookieHeader,
      referer: `${baseUrl}/login.html`,
    });

    const updatedCookieHeader = mergeCookies(cookieHeader, response.cookies);
    cookieHeader = updatedCookieHeader;

    let parsed;
    try {
      parsed = JSON.parse(response.body);
    } catch {
      continue;
    }

    if (!parsed.success) {continue;}

    const { status, authCode } = parsed.content || {};

    if (status === 'scanned') {
      // 已扫码，等待用户在手机上确认
      if (onWaiting) {onWaiting('scanned');}
    } else if (status === 'confirmed' && authCode) {
      // 用户已确认，返回 authCode
      return { authCode, cookieHeader };
    } else if (status === 'expired') {
      throw new Error(t('qr_login.qr_expired'));
    }
  }

  throw new Error(t('qr_login.poll_timeout'));
}

/**
 * Step 4：用 authCode 换取登录 Cookie。
 * @param {string} baseUrl
 * @param {string} authCode
 * @param {string} cookieHeader
 * @returns {Promise<{ cookieHeader: string }>}
 */
async function exchangeAuthCodeForCookie(baseUrl, authCode, cookieHeader) {
  const exchangeUrl = `${baseUrl}/dingtalk/web/loginByAuthCode.json`;
  const postData = `authCode=${encodeURIComponent(authCode)}`;

  const response = await fetchPost(exchangeUrl, postData, {
    cookieHeader,
    referer: `${baseUrl}/login.html`,
  });

  const updatedCookieHeader = mergeCookies(cookieHeader, response.cookies);

  let parsed;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    throw new Error(t('qr_login.exchange_failed', response.body.substring(0, 200)));
  }

  if (!parsed.success) {
    throw new Error(t('qr_login.exchange_api_failed', parsed.errorMsg || JSON.stringify(parsed)));
  }

  return { cookieHeader: updatedCookieHeader };
}

async function exchangeDingtalkOAuthResult(baseUrl, loginResult, cookieHeader, context, options = {}) {
  const postLoginWithQr = options.postLoginWithQr || postDingtalkOAuthLoginWithQr;
  const getFollowRedirects = options.fetchGetFollowRedirects || fetchGetFollowRedirects;
  let selectedCorp = null;
  let resolvedLoginResult = loginResult;

  if (shouldChooseDingtalkOAuthOrganization(resolvedLoginResult)) {
    const corpList = normalizeDingtalkOAuthOrgList(resolvedLoginResult.orgList);
    selectedCorp = await resolveCorpSelection(corpList, options);

    const retryResult = await postLoginWithQr(context, cookieHeader, {
      exclusiveCorpId: selectedCorp.corpId,
    });
    cookieHeader = retryResult.cookieHeader;
    const parsed = retryResult.parsed;

    if (!parsed || !parsed.success) {
      throw new Error(t('qr_login.exchange_api_failed', parsed?.errorMsg || JSON.stringify(parsed)));
    }

    resolvedLoginResult = parsed.result || parsed.content || parsed;
  }

  const redirectUrl = resolveDingtalkLoginResultUrl(resolvedLoginResult);
  if (!redirectUrl) {
    throw new Error(t('qr_login.exchange_api_failed', JSON.stringify(resolvedLoginResult)));
  }

  const response = await getFollowRedirects(redirectUrl, {
    cookieHeader,
    referer: context.loginPageUrl,
  });

  return {
    cookieHeader: response.cookieHeader,
    baseUrl: deriveAliworkBaseUrl(baseUrl, response.finalUrl),
    selectedCorp,
  };
}

/**
 * Step 5：获取用户可访问的组织列表。
 * @param {string} baseUrl
 * @param {string} cookieHeader
 * @returns {Promise<Array<{ corpId: string, corpName: string }>>}
 */
async function fetchCorpList(baseUrl, cookieHeader) {
  const apiUrl = `${baseUrl}/dingtalk/web/getCorpList.json`;
  const response = await fetchGet(apiUrl, {
    cookieHeader,
    referer: `${baseUrl}/workPlatform`,
  });

  let parsed;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    throw new Error(t('qr_login.get_corp_list_failed', response.body.substring(0, 200)));
  }

  if (!parsed.success || !parsed.content) {
    throw new Error(t('qr_login.get_corp_list_api_failed', parsed.errorMsg || JSON.stringify(parsed)));
  }

  // 兼容不同的响应结构
  const corpList = Array.isArray(parsed.content)
    ? parsed.content
    : parsed.content.corpList || parsed.content.list || [];

  return corpList.map((corp) => ({
    corpId: corp.corpId || corp.id,
    corpName: corp.corpName || corp.name || corp.corpId,
  }));
}

/**
 * Step 6：切换到指定组织，获取该组织的登录 Cookie。
 * @param {string} baseUrl
 * @param {string} corpId
 * @param {string} cookieHeader
 * @returns {Promise<{ cookieHeader: string }>}
 */
async function switchCorp(baseUrl, corpId, cookieHeader) {
  const switchUrl = `${baseUrl}/dingtalk/web/switchCorp.json`;
  const postData = `corpId=${encodeURIComponent(corpId)}`;

  const response = await fetchPost(switchUrl, postData, {
    cookieHeader,
    referer: `${baseUrl}/workPlatform`,
  });

  const updatedCookieHeader = mergeCookies(cookieHeader, response.cookies);

  let parsed;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    // 切换组织可能不返回 JSON，直接使用更新后的 Cookie
    return { cookieHeader: updatedCookieHeader };
  }

  if (parsed.success === false) {
    throw new Error(t('qr_login.switch_corp_failed', parsed.errorMsg || JSON.stringify(parsed)));
  }

  return { cookieHeader: updatedCookieHeader };
}

// ── 交互式组织选择 ────────────────────────────────────

/**
 * 在终端交互式地让用户选择组织。
 * @param {Array<{ corpId: string, corpName: string }>} corpList
 * @returns {Promise<{ corpId: string, corpName: string }>}
 */
async function selectCorpInteractively(corpList) {
  if (corpList.length === 0) {
    throw new Error(t('qr_login.no_corp_available'));
  }

  if (corpList.length === 1) {
    const { info: scInfo } = require('../core/chalk');
    scInfo(t('qr_login.only_one_corp', corpList[0].corpName));
    return corpList[0];
  }

  const { c: sc } = require('../core/chalk');
  process.stderr.write(`\n  ${sc.bold}${t('qr_login.select_corp_prompt')}${sc.reset}\n\n`);

  corpList.forEach((corp, index) => {
    process.stderr.write(`    ${sc.cyan}${index + 1}.${sc.reset} ${corp.corpName} ${sc.dim}(${corp.corpId})${sc.reset}\n`);
  });

  process.stderr.write('\n');

  return new Promise((resolve, reject) => {
    let settled = false;
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
    });

    const askQuestion = () => {
      rl.question(t('qr_login.select_corp_input', corpList.length), (answer) => {
        const trimmed = answer.trim();
        const selectedIndex = parseInt(trimmed, 10) - 1;

        if (
          !isNaN(selectedIndex) &&
          selectedIndex >= 0 &&
          selectedIndex < corpList.length
        ) {
          settled = true;
          rl.close();
          resolve(corpList[selectedIndex]);
        } else {
          const { warn: scWarn } = require('../core/chalk');
          scWarn(t('qr_login.select_corp_invalid', corpList.length));
          askQuestion();
        }
      });
    };

    rl.on('close', () => {
      if (!settled) {
        reject(new Error(t('qr_login.stdin_closed')));
      }
    });

    askQuestion();
  });
}

// ── 主流程 ────────────────────────────────────────────

/**
 * 执行完整的终端二维码登录流程。
 * @param {object} [options]
 * @param {string} [options.baseUrl] - 宜搭基础 URL（不传则从环境配置自动解析）
 * @returns {Promise<object>} loginResult - 与 interactiveLogin() 返回格式一致
 */
async function qrLogin(options = {}) {
  // 优先使用传入的 baseUrl，否则从环境配置解析（支持私有化）
  let baseUrl = (options.baseUrl || resolveEndpoint(null)).replace(/\/+$/, '');

  const { banner: qBanner, step: qStep, info: qInfo, success: qSuccess, warn: qWarn, label: qLabel, sep: qSep } = require('../core/chalk');

  qBanner(t('qr_login.title'));

  // Step 1: 获取初始 Session
  qStep(1, t('qr_login.step_init'));
  const session = await fetchInitialSession(baseUrl, options);
  let { cookieHeader } = session;
  const { loginPageUrl } = session;

  // Step 2: 获取二维码
  qStep(2, t('qr_login.step_get_qr'));
  let qrUrl, state, context;
  try {
    ({ qrUrl, state, cookieHeader, context } = await fetchQrCodeUrl(baseUrl, cookieHeader, loginPageUrl));
  } catch (err) {
    throw new Error(t('qr_login.get_qr_error', err.message));
  }

  // Step 3: 在终端渲染二维码
  qStep(3, t('qr_login.scan_hint'));
  process.stderr.write('\n');
  await renderQrCodeInTerminal(qrUrl);
  process.stderr.write('\n');
  qLabel('URL', qrUrl);
  process.stderr.write('\n');
  qInfo(t('qr_login.waiting_scan'));

  // Step 4: 轮询扫码状态
  let scannedMessageShown = false;
  let authCode, loginResult;
  try {
    ({ authCode, loginResult, cookieHeader } = await pollQrCodeStatus(
      baseUrl,
      state,
      cookieHeader,
      (status) => {
        if (status === 'scanned' && !scannedMessageShown) {
          qInfo(t('qr_login.scanned_confirm'));
          scannedMessageShown = true;
        }
      },
      context
    ));
  } catch (err) {
    throw new Error(t('qr_login.poll_error', err.message));
  }

  qSuccess(t('qr_login.scan_success'));

  // Step 5: 换取登录 Cookie
  qStep(5, t('qr_login.step_exchange'));
  let selectedCorp = null;
  try {
    if (context && context.type === 'dingtalk_oauth') {
      const exchangeResult = await exchangeDingtalkOAuthResult(baseUrl, loginResult, cookieHeader, context, {
        corpId: options.corpId,
      });
      ({ cookieHeader, baseUrl, selectedCorp } = exchangeResult);
      if (selectedCorp) {
        qSuccess(t('qr_login.corp_selected', selectedCorp.corpName));
      }
    } else {
      ({ cookieHeader } = await exchangeAuthCodeForCookie(baseUrl, authCode, cookieHeader));
    }
  } catch (err) {
    throw new Error(t('qr_login.exchange_error', err.message));
  }

  // Step 6: 获取组织列表
  qStep(6, t('qr_login.step_get_corps'));
  let corpList = [];
  try {
    corpList = await fetchCorpList(baseUrl, cookieHeader);
  } catch (err) {
    // 获取组织列表失败不阻断流程，直接使用当前 Cookie
    qWarn(t('qr_login.get_corps_warn', err.message));
  }

  // Step 7: 选择组织（如果有多个）
  if (!selectedCorp && corpList.length > 0) {
    try {
      selectedCorp = await resolveCorpSelection(corpList, { corpId: options.corpId });
      qSuccess(t('qr_login.corp_selected', selectedCorp.corpName));

      // 切换到目标组织
      if (corpList.length > 1) {
        qStep(7, t('qr_login.step_switch_corp'));
        try {
          ({ cookieHeader } = await switchCorp(baseUrl, selectedCorp.corpId, cookieHeader));
        } catch (err) {
          qWarn(t('qr_login.switch_corp_warn', err.message));
        }
      }
    } catch (err) {
      qWarn(t('qr_login.select_corp_warn', err.message));
    }
  }

  // Step 8: 将 Cookie 字符串转换为对象数组并保存
  const parsedDomain = new URL(baseUrl).hostname;
  const cookieObjects = cookieHeaderToObjects(cookieHeader, parsedDomain);

  const { csrfToken, corpId, userId } = extractInfoFromCookies(cookieObjects);
  if (!csrfToken) {
    throw new Error(t('qr_login.no_csrf_in_cookie'));
  }

  saveCookieCache(cookieObjects, baseUrl);

  process.stderr.write('\n');
  qSuccess(t('qr_login.login_success'));
  qLabel('CSRF', `${csrfToken.slice(0, 16)}…`);
  if (corpId) {qLabel('Corp ID', corpId);}
  process.stderr.write(`  ${qSep()}\n\n`);

  return {
    csrf_token: csrfToken,
    corp_id: corpId,
    user_id: userId,
    base_url: baseUrl,
    cookies: cookieObjects,
  };
}

module.exports = {
  qrLogin,
  __test__: {
    renderQrCodeInTerminal,
    resolveQrcodeModule,
    normalizeDingtalkOAuthOrgList,
    shouldChooseDingtalkOAuthOrganization,
    selectCorpById,
    resolveCorpSelection,
    exchangeDingtalkOAuthResult,
  },
};
