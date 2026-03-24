/**
 * qr-login.ts - 终端二维码扫码登录
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

import * as https from 'https';
import * as http from 'http';
import * as readline from 'readline';
import { extractInfoFromCookies } from '../core/utils';
import { saveCookieCache } from './login';
import { t } from '../core/i18n';
import type { Cookie, LoginResult } from '../types';

const DEFAULT_BASE_URL = 'https://www.aliwork.com';

// ── HTTP 工具 ─────────────────────────────────────────

interface FetchResult {
  body: string;
  cookies: string[];
  statusCode: number | undefined;
}

interface FetchOptions {
  cookieHeader?: string;
  referer?: string;
  contentType?: string;
}

function fetchGet(url: string, options: FetchOptions = {}): Promise<FetchResult> {
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
      res.on('data', (chunk: Buffer) => { body += chunk; });
      res.on('end', () => {
        const setCookieHeaders = (res.headers['set-cookie'] as string[]) || [];
        resolve({ body, cookies: setCookieHeaders, statusCode: res.statusCode });
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error(t('common.request_timeout'))); });
    req.on('error', reject);
    req.end();
  });
}

function fetchPost(url: string, postData: string, options: FetchOptions = {}): Promise<FetchResult> {
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
      res.on('data', (chunk: Buffer) => { body += chunk; });
      res.on('end', () => {
        const setCookieHeaders = (res.headers['set-cookie'] as string[]) || [];
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

function buildCookieHeader(setCookieHeaders: string[]): string {
  return setCookieHeaders
    .map((header) => header.split(';')[0].trim())
    .join('; ');
}

function mergeCookies(existingCookieHeader: string, newSetCookieHeaders: string[]): string {
  const cookieMap = new Map<string, string>();

  if (existingCookieHeader) {
    for (const pair of existingCookieHeader.split(';')) {
      const trimmed = pair.trim();
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        cookieMap.set(trimmed.slice(0, eqIndex).trim(), trimmed.slice(eqIndex + 1).trim());
      }
    }
  }

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

function cookieHeaderToObjects(
  cookieHeader: string,
  domain: string
): Cookie[] {
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
      } as Cookie;
    })
    .filter((c): c is Cookie => c !== null);
}

// ── 二维码渲染 ────────────────────────────────────────

async function renderQrCodeInTerminal(url: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let qrcode: { toString(url: string, opts: Record<string, unknown>): Promise<string> } | null | any = null;
    try {
      qrcode = require('qrcode') as typeof qrcode;
    } catch {
      const pathModule = require('path') as typeof import('path');
      const candidates = [
        pathModule.join(__dirname, '..', 'node_modules', 'qrcode'),
        pathModule.join(__dirname, '..', '..', 'node_modules', 'qrcode'),
      ];
      for (const candidate of candidates) {
        try {
          qrcode = require(candidate) as typeof qrcode;
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
      console.error(t('qr_login.qrcode_fallback'));
      console.error(`  ${url}`);
    }
  } catch (err) {
    const error = err as Error;
    console.error(t('qr_login.qrcode_render_failed', error.message));
    console.error(`  ${url}`);
  }
}

// ── 宜搭登录 API ──────────────────────────────────────

async function fetchInitialSession(baseUrl: string): Promise<{ cookieHeader: string }> {
  const loginPageUrl = `${baseUrl}/login.html`;
  const response = await fetchGet(loginPageUrl);
  const cookieHeader = buildCookieHeader(response.cookies);
  return { cookieHeader };
}

async function fetchQrCodeUrl(
  baseUrl: string,
  cookieHeader: string
): Promise<{ qrUrl: string; state: string; cookieHeader: string }> {
  const apiUrl = `${baseUrl}/dingtalk/web/getLoginQrCode.json`;
  const response = await fetchGet(apiUrl, {
    cookieHeader,
    referer: `${baseUrl}/login.html`,
  });

  const updatedCookieHeader = mergeCookies(cookieHeader, response.cookies);

  let parsed: { success: boolean; content?: { qrUrl: string; state: string }; errorMsg?: string };
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

async function pollQrCodeStatus(
  baseUrl: string,
  state: string,
  cookieHeader: string,
  onWaiting: (status: string) => void
): Promise<{ authCode: string; cookieHeader: string }> {
  const pollUrl = `${baseUrl}/dingtalk/web/checkLoginQrCode.json`;
  const maxAttempts = 120;
  const pollIntervalMs = 1000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise<void>((resolve) => setTimeout(resolve, pollIntervalMs));

    const response = await fetchGet(`${pollUrl}?state=${encodeURIComponent(state)}`, {
      cookieHeader,
      referer: `${baseUrl}/login.html`,
    });

    const updatedCookieHeader = mergeCookies(cookieHeader, response.cookies);
    cookieHeader = updatedCookieHeader;

    let parsed: { success: boolean; content?: { status: string; authCode?: string } };
    try {
      parsed = JSON.parse(response.body);
    } catch {
      continue;
    }

    if (!parsed.success) {continue;}

    const { status, authCode } = parsed.content || {};

    if (status === 'scanned') {
      if (onWaiting) {onWaiting('scanned');}
    } else if (status === 'confirmed' && authCode) {
      return { authCode, cookieHeader };
    } else if (status === 'expired') {
      throw new Error(t('qr_login.qr_expired'));
    }
  }

  throw new Error(t('qr_login.poll_timeout'));
}

async function exchangeAuthCodeForCookie(
  baseUrl: string,
  authCode: string,
  cookieHeader: string
): Promise<{ cookieHeader: string }> {
  const exchangeUrl = `${baseUrl}/dingtalk/web/loginByAuthCode.json`;
  const postData = `authCode=${encodeURIComponent(authCode)}`;

  const response = await fetchPost(exchangeUrl, postData, {
    cookieHeader,
    referer: `${baseUrl}/login.html`,
  });

  const updatedCookieHeader = mergeCookies(cookieHeader, response.cookies);

  let parsed: { success: boolean; errorMsg?: string };
  try {
    parsed = JSON.parse(response.body);
  } catch {
    throw new Error(t('qr_login.exchange_failed', response.body.substring(0, 200)));
  }

  if (parsed.success === false) {
    throw new Error(t('qr_login.exchange_api_failed', parsed.errorMsg || JSON.stringify(parsed)));
  }

  return { cookieHeader: updatedCookieHeader };
}

interface CorpInfo {
  corpId: string;
  corpName: string;
}

async function fetchCorpList(baseUrl: string, cookieHeader: string): Promise<CorpInfo[]> {
  const apiUrl = `${baseUrl}/dingtalk/web/getCorpList.json`;
  const response = await fetchGet(apiUrl, {
    cookieHeader,
    referer: `${baseUrl}/workPlatform`,
  });

  let parsed: {
    success: boolean;
    content?: CorpInfo[] | { corpList?: CorpInfo[]; list?: CorpInfo[] };
    errorMsg?: string;
  };
  try {
    parsed = JSON.parse(response.body);
  } catch {
    throw new Error(t('qr_login.get_corp_list_failed', response.body.substring(0, 200)));
  }

  if (!parsed.success || !parsed.content) {
    throw new Error(
      t('qr_login.get_corp_list_api_failed', parsed.errorMsg || JSON.stringify(parsed))
    );
  }

  const rawList = Array.isArray(parsed.content)
    ? parsed.content
    : (parsed.content as { corpList?: CorpInfo[]; list?: CorpInfo[] }).corpList ||
      (parsed.content as { corpList?: CorpInfo[]; list?: CorpInfo[] }).list ||
      [];

  return rawList.map((corp: CorpInfo) => ({
    corpId: (corp as unknown as Record<string, string>).corpId || (corp as unknown as Record<string, string>).id,
    corpName: (corp as unknown as Record<string, string>).corpName || (corp as unknown as Record<string, string>).name || (corp as unknown as Record<string, string>).corpId,
  }));
}

async function switchCorp(
  baseUrl: string,
  corpId: string,
  cookieHeader: string
): Promise<{ cookieHeader: string }> {
  const switchUrl = `${baseUrl}/dingtalk/web/switchCorp.json`;
  const postData = `corpId=${encodeURIComponent(corpId)}`;

  const response = await fetchPost(switchUrl, postData, {
    cookieHeader,
    referer: `${baseUrl}/workPlatform`,
  });

  const updatedCookieHeader = mergeCookies(cookieHeader, response.cookies);

  let parsed: { success?: boolean; errorMsg?: string };
  try {
    parsed = JSON.parse(response.body);
  } catch {
    return { cookieHeader: updatedCookieHeader };
  }

  if (parsed.success === false) {
    throw new Error(t('qr_login.switch_corp_failed', parsed.errorMsg || JSON.stringify(parsed)));
  }

  return { cookieHeader: updatedCookieHeader };
}

// ── 交互式组织选择 ────────────────────────────────────

async function selectCorpInteractively(corpList: CorpInfo[]): Promise<CorpInfo> {
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
      rl.question(t('qr_login.select_corp_input', String(corpList.length)), (answer: string) => {
        const trimmed = answer.trim();
        const selectedIndex = parseInt(trimmed, 10) - 1;

        if (!isNaN(selectedIndex) && selectedIndex >= 0 && selectedIndex < corpList.length) {
          rl.close();
          resolve(corpList[selectedIndex]);
        } else {
          console.error(t('qr_login.select_corp_invalid', String(corpList.length)));
          askQuestion();
        }
      });
    };

    rl.on('close', () => {
      reject(new Error(t('qr_login.stdin_closed')));
    });

    askQuestion();
  });
}

// ── 主流程 ────────────────────────────────────────────

interface QrLoginOptions {
  baseUrl?: string;
}

export async function qrLogin(options: QrLoginOptions = {}): Promise<LoginResult> {
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
  let qrUrl: string;
  let state: string;
  try {
    ({ qrUrl, state, cookieHeader } = await fetchQrCodeUrl(baseUrl, cookieHeader));
  } catch (err) {
    const error = err as Error;
    throw new Error(t('qr_login.get_qr_error', error.message));
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
  let authCode: string;
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
    const error = err as Error;
    throw new Error(t('qr_login.poll_error', error.message));
  }

  console.error(t('qr_login.scan_success'));

  // Step 5: 换取登录 Cookie
  console.error(t('qr_login.step_exchange'));
  try {
    ({ cookieHeader } = await exchangeAuthCodeForCookie(baseUrl, authCode, cookieHeader));
  } catch (err) {
    const error = err as Error;
    throw new Error(t('qr_login.exchange_error', error.message));
  }

  // Step 6: 获取组织列表
  console.error(t('qr_login.step_get_corps'));
  let corpList: CorpInfo[] = [];
  try {
    corpList = await fetchCorpList(baseUrl, cookieHeader);
  } catch (err) {
    const error = err as Error;
    console.error(t('qr_login.get_corps_warn', error.message));
  }

  // Step 7: 选择组织（如果有多个）
  let selectedCorp: CorpInfo | null = null;
  if (corpList.length > 0) {
    try {
      selectedCorp = await selectCorpInteractively(corpList);
      console.error(t('qr_login.corp_selected', selectedCorp.corpName));

      if (corpList.length > 1) {
        console.error(t('qr_login.step_switch_corp'));
        try {
          ({ cookieHeader } = await switchCorp(baseUrl, selectedCorp.corpId, cookieHeader));
        } catch (err) {
          const error = err as Error;
          console.error(t('qr_login.switch_corp_warn', error.message));
        }
      }
    } catch (err) {
      const error = err as Error;
      console.error(t('qr_login.select_corp_warn', error.message));
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
