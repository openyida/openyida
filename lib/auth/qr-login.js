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

const DEFAULT_BASE_URL = 'https://www.aliwork.com';

// ── HTTP 工具 ─────────────────────────────────────────

/**
 * 发送 GET 请求，返回响应体字符串和 Set-Cookie 头。
 * @param {string} url - 完整 URL
 * @param {object} [options] - 额外选项
 * @param {string} [options.cookieHeader] - Cookie 请求头
 * @returns {Promise<{ body: string, cookies: string[], statusCode: number }>}
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
      },
      timeout: 30000,
    };

    const req = requestModule.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        const setCookieHeaders = res.headers['set-cookie'] || [];
        resolve({ body, cookies: setCookieHeaders, statusCode: res.statusCode });
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
 * @returns {Promise<{ body: string, cookies: string[], statusCode: number }>}
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
      },
      timeout: 30000,
    };

    const req = requestModule.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        const setCookieHeaders = res.headers['set-cookie'] || [];
        resolve({ body, cookies: setCookieHeaders, statusCode: res.statusCode });
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error(t('common.request_timeout'))); });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
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
 * 在终端渲染二维码。
 * 优先使用 qrcode 包的 toString 方法（小尺寸），若不可用则降级输出 URL。
 * @param {string} url - 要编码的 URL
 */
async function renderQrCodeInTerminal(url) {
  try {
    // 尝试加载 qrcode 包
    let qrcode;
    try {
      qrcode = require('qrcode');
    } catch {
      // qrcode 未安装，尝试从全局或相邻路径加载
      const path = require('path');
      const candidates = [
        path.join(__dirname, '..', 'node_modules', 'qrcode'),
        path.join(__dirname, '..', '..', 'node_modules', 'qrcode'),
      ];
      for (const candidate of candidates) {
        try {
          qrcode = require(candidate);
          break;
        } catch {
          // continue
        }
      }
    }

    if (qrcode) {
      const qrString = await qrcode.toString(url, {
        type: 'terminal',
        small: true,
        errorCorrectionLevel: 'M',
      });
      console.error(qrString);
    } else {
      // 降级：输出 URL 提示用户手动访问
      console.error(t('qr_login.qrcode_fallback'));
      console.error(`  ${url}`);
    }
  } catch (err) {
    console.error(t('qr_login.qrcode_render_failed', err.message));
    console.error(`  ${url}`);
  }
}

// ── 宜搭登录 API ──────────────────────────────────────

/**
 * Step 1：访问宜搭登录页，获取初始 Cookie 和 CSRF Token。
 * @param {string} baseUrl
 * @returns {Promise<{ cookieHeader: string }>}
 */
async function fetchInitialSession(baseUrl) {
  const loginPageUrl = `${baseUrl}/login.html`;
  const response = await fetchGet(loginPageUrl);
  const cookieHeader = buildCookieHeader(response.cookies);
  return { cookieHeader };
}

/**
 * Step 2：获取钉钉扫码登录的二维码信息。
 * 宜搭使用钉钉 OAuth 扫码，需要先获取 authCode 对应的二维码 URL。
 * @param {string} baseUrl
 * @param {string} cookieHeader
 * @returns {Promise<{ qrUrl: string, state: string, cookieHeader: string }>}
 */
async function fetchQrCodeUrl(baseUrl, cookieHeader) {
  // 获取钉钉扫码登录的跳转 URL
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
  return { qrUrl, state, cookieHeader: updatedCookieHeader };
}

/**
 * Step 3：轮询扫码状态，等待用户扫码并确认。
 * @param {string} baseUrl
 * @param {string} state - 二维码状态标识
 * @param {string} cookieHeader
 * @param {Function} onWaiting - 等待回调（可用于显示进度）
 * @returns {Promise<{ authCode: string, cookieHeader: string }>}
 */
async function pollQrCodeStatus(baseUrl, state, cookieHeader, onWaiting) {
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
    console.error(t('qr_login.only_one_corp', corpList[0].corpName));
    return corpList[0];
  }

  console.error(t('qr_login.select_corp_prompt'));
  console.error('');

  corpList.forEach((corp, index) => {
    console.error(`  ${index + 1}. ${corp.corpName} (${corp.corpId})`);
  });

  console.error('');

  return new Promise((resolve, reject) => {
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
          rl.close();
          resolve(corpList[selectedIndex]);
        } else {
          console.error(t('qr_login.select_corp_invalid', corpList.length));
          askQuestion();
        }
      });
    };

    rl.on('close', () => {
      // stdin 关闭时（非交互式环境），默认选第一个
      reject(new Error(t('qr_login.stdin_closed')));
    });

    askQuestion();
  });
}

// ── 主流程 ────────────────────────────────────────────

/**
 * 执行完整的终端二维码登录流程。
 * @param {object} [options]
 * @param {string} [options.baseUrl] - 宜搭基础 URL
 * @returns {Promise<object>} loginResult - 与 interactiveLogin() 返回格式一致
 */
async function qrLogin(options = {}) {
  const baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const SEP = '─'.repeat(50);

  console.error('');
  console.error(t('qr_login.title'));
  console.error(SEP);

  // Step 1: 获取初始 Session
  console.error(t('qr_login.step_init'));
  let { cookieHeader } = await fetchInitialSession(baseUrl);

  // Step 2: 获取二维码
  console.error(t('qr_login.step_get_qr'));
  let qrUrl, state;
  try {
    ({ qrUrl, state, cookieHeader } = await fetchQrCodeUrl(baseUrl, cookieHeader));
  } catch (err) {
    throw new Error(t('qr_login.get_qr_error', err.message));
  }

  // Step 3: 在终端渲染二维码
  console.error('');
  console.error(t('qr_login.scan_hint'));
  console.error('');
  await renderQrCodeInTerminal(qrUrl);
  console.error('');
  console.error(t('qr_login.qr_url_label', qrUrl));
  console.error('');
  console.error(t('qr_login.waiting_scan'));

  // Step 4: 轮询扫码状态
  let scannedMessageShown = false;
  let authCode;
  try {
    ({ authCode, cookieHeader } = await pollQrCodeStatus(
      baseUrl,
      state,
      cookieHeader,
      (status) => {
        if (status === 'scanned' && !scannedMessageShown) {
          console.error(t('qr_login.scanned_confirm'));
          scannedMessageShown = true;
        }
      }
    ));
  } catch (err) {
    throw new Error(t('qr_login.poll_error', err.message));
  }

  console.error(t('qr_login.scan_success'));

  // Step 5: 换取登录 Cookie
  console.error(t('qr_login.step_exchange'));
  try {
    ({ cookieHeader } = await exchangeAuthCodeForCookie(baseUrl, authCode, cookieHeader));
  } catch (err) {
    throw new Error(t('qr_login.exchange_error', err.message));
  }

  // Step 6: 获取组织列表
  console.error(t('qr_login.step_get_corps'));
  let corpList = [];
  try {
    corpList = await fetchCorpList(baseUrl, cookieHeader);
  } catch (err) {
    // 获取组织列表失败不阻断流程，直接使用当前 Cookie
    console.error(t('qr_login.get_corps_warn', err.message));
  }

  // Step 7: 选择组织（如果有多个）
  let selectedCorp = null;
  if (corpList.length > 0) {
    try {
      selectedCorp = await selectCorpInteractively(corpList);
      console.error(t('qr_login.corp_selected', selectedCorp.corpName));

      // 切换到目标组织
      if (corpList.length > 1) {
        console.error(t('qr_login.step_switch_corp'));
        try {
          ({ cookieHeader } = await switchCorp(baseUrl, selectedCorp.corpId, cookieHeader));
        } catch (err) {
          console.error(t('qr_login.switch_corp_warn', err.message));
        }
      }
    } catch (err) {
      console.error(t('qr_login.select_corp_warn', err.message));
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

  console.error('');
  console.error(t('qr_login.login_success'));
  console.error(t('login.csrf_ok', csrfToken.slice(0, 16)));
  if (corpId) {console.error(t('login.corp_id_ok', corpId));}
  console.error(SEP);

  return {
    csrf_token: csrfToken,
    corp_id: corpId,
    user_id: userId,
    base_url: baseUrl,
    cookies: cookieObjects,
  };
}

module.exports = { qrLogin };
