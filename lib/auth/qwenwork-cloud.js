'use strict';

const { sessionIdentity } = require('./session-identity');

const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { DINGTALK_OAUTH_CLIENT_ID } = require('../core/env-manager');
const { resolveTokenBaseUrl } = require('./token-auth');

function failure(code, details = {}) {
  return new CliError(t('qwenwork.login_check_failed'), { code: `QWENWORK_CLOUD_${code}`, details });
}

const ODS_CORP_ID = /^yida[0-9a-f]{32}$/;
const CORP_ID = /^(?:(?:ding|yida)[0-9a-f]{32}|dingd8e1123006514592)$/;

// Only bounded protocol identifiers are diagnostic data; never forward the response body or message.
function diagnostics(value, statusCode, credential = {}) {
  const details = { stage: 'yida_exchange', status_code: statusCode };
  if (!value || typeof value !== 'object' || Array.isArray(value)) { return details; }
  const secrets = [credential.access_token, value.access_token, value.refresh_token, value.refreshToken].filter(token => typeof token === 'string' && token);
  const publicValue = text => typeof text === 'string' && !secrets.some(token => text.includes(token));
  if (publicValue(value.status) && value.status.length <= 64 && /^(?:ok|error|failure|[a-z][a-z0-9]*_[a-z0-9_]+)$/.test(value.status)
    && !/^(?:qwex|dws)_/.test(value.status)) { details.status = value.status; }
  if (publicValue(value.stage) && ['request', 'qwen_verify', 'token_issue'].includes(value.stage)) { details.stage = value.stage; }
  if (publicValue(value.exchange_id) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.exchange_id)) {
    details.exchange_id = value.exchange_id;
  }
  return details;
}

function origin(value, details = {}) {
  try {
    const url = new URL(value);
    if (typeof value !== 'string' || value.length > 2048 || /\s/.test(value) || url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) { throw new Error(); }
    return url.origin;
  } catch { throw failure('ENDPOINT_INVALID', details); }
}

async function exchangeSession(credential, baseUrl, options) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs === undefined ? 15000 : options.timeoutMs;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) { throw failure('INVALID_TIMEOUT'); }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await (options.fetch || globalThis.fetch)(`${baseUrl}/openapi/cli/v1/auth/qwenwork/token`, {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { authorization: `Bearer ${credential.access_token}`, accept: 'application/json', 'content-type': 'application/json' },
      // corp_id selects a DingTalk organization upstream; ODS identity is checked locally after exchange.
      body: JSON.stringify({ gateway_url: credential.base_url, ...(options.corpId && !ODS_CORP_ID.test(options.corpId) ? { corp_id: options.corpId } : {}) }),
    });
    const reader = response.body?.getReader();
    if (!reader) { throw failure(response.ok ? 'RESPONSE_INVALID' : 'HTTP_ERROR', diagnostics(null, response.status)); }
    const chunks = []; let bytes = 0;
    try {
      for (let part = await reader.read(); !part.done; part = await reader.read()) {
        bytes += part.value.byteLength;
        if (bytes > 65536) { await reader.cancel(); throw failure(response.ok ? 'RESPONSE_INVALID' : 'HTTP_ERROR', { ...diagnostics(null, response.status), reason: 'response_too_large' }); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    let value;
    try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw failure(response.ok ? 'RESPONSE_INVALID' : 'HTTP_ERROR', { ...diagnostics(null, response.status), reason: 'invalid_json' }); }
    const details = diagnostics(value, response.status, credential);
    if (!response.ok) { throw failure('HTTP_ERROR', details); }
    return { value, details };
  } catch (error) {
    // 上游正文和异常可能回显凭据，仅保留本模块生成的固定错误码。
    if (error instanceof CliError && /^QWENWORK_CLOUD_/.test(error.code)) { throw error; }
    throw failure(controller.signal.aborted ? 'REQUEST_TIMED_OUT' : 'REQUEST_FAILED', { stage: 'yida_exchange' });
  } finally { clearTimeout(timer); }
}

/** 只读取本次沙箱凭据，由宜搭服务端向受信任网关验证身份。 */
function sandboxCredential(options) {
  const env = options.env || process.env;
  const token = ['QWENWORK_AGENT_TOKEN', 'MULE_AGENT_TOKEN', 'AGENT_TOKEN'].map(name => env[name]).find(value => typeof value === 'string' && value);
  if (!token) { throw new CliError(t('qwenwork.login_check_failed'), { code: 'QWENWORK_CREDENTIAL_MISSING' }); }
  if (token.length > 4096 || /\s/.test(token)) { throw failure('CREDENTIAL_INVALID'); }
  const gateway = env.QWENWORK_GATEWAY_URL || env.MULE_GATEWAY_URL;
  if (!gateway) { throw new CliError(t('qwenwork.login_check_failed'), { code: 'QWENWORK_GATEWAY_MISSING' }); }
  return { access_token: token, base_url: origin(gateway) };
}

/** 只向宜搭提交 Agent Token 和网关地址；返回会话供调用方校验后保存。 */
async function exchangeQwenWorkCloudSession(options = {}) {
  const baseUrl = origin(options.endpoint || (options.env || process.env).OPENYIDA_ENDPOINT || resolveTokenBaseUrl(options));
  const credential = sandboxCredential(options);
  try {
    const startedAt = Date.now();
    const { value, details } = await exchangeSession(credential, baseUrl, options);
    if (!value || typeof value !== 'object' || Array.isArray(value)) { throw failure('RESPONSE_INVALID', { ...details, reason: 'response_shape' }); }
    if (value.status !== 'ok') { throw failure('EXCHANGE_REJECTED', details); }
    const env = options.env || process.env;
    const hostTokens = ['QWENWORK_AGENT_TOKEN', 'MULE_AGENT_TOKEN', 'AGENT_TOKEN'].map(name => env[name]).filter(Boolean);
    const validToken = token => typeof token === 'string' && !!token && !/\s/.test(token) && token.length <= 32768 && !hostTokens.includes(token);
    // Older cloud deployments may return access-only sessions. Preserve a refresh token when supplied.
    const refreshToken = value.refresh_token === undefined ? value.refreshToken : value.refresh_token;
    const invalid = [
      [value.auth_mode !== 'token', 'auth_mode'],
      [value.can_auto_use !== true, 'can_auto_use'],
      [value.token_type !== 'Bearer', 'token_type'],
      [value.credential_source !== 'qwenwork_cloud', 'credential_source'],
      [!validToken(value.access_token), 'access_token'],
      [!Number.isInteger(value.expires_in) || value.expires_in <= 0 || value.expires_in > 1800, 'expires_in'],
      [typeof value.corp_id !== 'string' || !CORP_ID.test(value.corp_id), 'corp_id'],
      [typeof value.user_id !== 'string' || !value.user_id || value.user_id.trim() !== value.user_id || value.user_id.length > 256, 'user_id'],
      [options.corpId && value.corp_id !== options.corpId, 'corp_id_mismatch'],
      [options.userId && value.user_id !== options.userId, 'user_id_mismatch'],
      ['exchange_ticket' in value, 'exchange_ticket'],
      [refreshToken !== undefined && !validToken(refreshToken), 'refresh_token'],
      [value.client_id !== undefined && value.client_id !== (options.clientId || DINGTALK_OAUTH_CLIENT_ID), 'client_id'],
    ].find(([rejected]) => rejected);
    if (invalid) { throw failure('RESPONSE_INVALID', { ...details, reason: invalid[1] }); }
    return {
      ...sessionIdentity(value),
      auth_mode: 'token', credential_source: 'qwenwork_cloud', token_type: 'Bearer',
      // 可信宜搭签发服务决定业务域名；认证请求仍只发往最初选择的 origin。
      access_token: value.access_token, refresh_token: refreshToken, base_url: value.base_url === undefined ? baseUrl : origin(value.base_url, { ...details, reason: 'base_url' }),
      client_id: options.clientId || DINGTALK_OAUTH_CLIENT_ID,
      corp_id: value.corp_id, user_id: value.user_id,
      user_name: typeof value.user_name === 'string' ? value.user_name : undefined,
      expires_at: startedAt + value.expires_in * 1000,
    };
  } finally { credential.access_token = undefined; }
}

module.exports = { exchangeQwenWorkCloudSession };
