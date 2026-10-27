'use strict';

const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { DINGTALK_OAUTH_CLIENT_ID } = require('../core/env-manager');
const { resolveTokenBaseUrl } = require('./token-auth');

function failure(code, details = {}) {
  return new CliError(t('qwenwork.login_check_failed'), { code: `QWENWORK_CLOUD_${code}`, details });
}

function origin(value) {
  try {
    const url = new URL(value);
    if (typeof value !== 'string' || value.length > 2048 || /\s/.test(value) || url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) { throw new Error(); }
    return url.origin;
  } catch { throw failure('ENDPOINT_INVALID'); }
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
      body: JSON.stringify({ gateway_url: credential.base_url, ...(options.corpId ? { corp_id: options.corpId } : {}) }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw failure('HTTP_ERROR', { stage: 'yida_exchange', status_code: response.status });
    }
    const reader = response.body?.getReader();
    if (!reader) { throw failure('RESPONSE_INVALID'); }
    const chunks = []; let bytes = 0;
    try {
      for (let part = await reader.read(); !part.done; part = await reader.read()) {
        bytes += part.value.byteLength;
        if (bytes > 65536) { await reader.cancel(); throw failure('RESPONSE_INVALID'); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    // 上游正文和异常可能回显凭据，仅保留本模块生成的固定错误码。
    if (error instanceof CliError && /^QWENWORK_CLOUD_/.test(error.code)) { throw error; }
    throw failure(controller.signal.aborted ? 'REQUEST_TIMED_OUT' : 'REQUEST_FAILED');
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
    const value = await exchangeSession(credential, baseUrl, options);
    if (!value || value.status !== 'ok' || value.auth_mode !== 'token' || value.can_auto_use !== true ||
      value.token_type !== 'Bearer' || value.credential_source !== 'qwenwork_cloud' ||
      typeof value.access_token !== 'string' || !value.access_token || /\s/.test(value.access_token) || value.access_token.length > 32768 ||
      value.access_token === credential.access_token ||
      ['QWENWORK_AGENT_TOKEN', 'MULE_AGENT_TOKEN', 'AGENT_TOKEN'].some(name => value.access_token === (options.env || process.env)[name]) ||
      !Number.isInteger(value.expires_in) || value.expires_in <= 0 || value.expires_in > 1800 ||
      typeof value.corp_id !== 'string' || !/^(?:ding[0-9a-f]{32}|dingd8e1123006514592)$/.test(value.corp_id) ||
      typeof value.user_id !== 'string' || !value.user_id || value.user_id.trim() !== value.user_id || value.user_id.length > 256 ||
      (options.corpId && value.corp_id !== options.corpId) ||
      (options.userId && value.user_id !== options.userId) ||
      'refresh_token' in value || 'refreshToken' in value || 'exchange_ticket' in value) { throw failure('RESPONSE_INVALID'); }
    return {
      auth_mode: 'token', credential_source: 'qwenwork_cloud', token_type: 'Bearer',
      // 可信宜搭签发服务决定业务域名；认证请求仍只发往最初选择的 origin。
      access_token: value.access_token, base_url: value.base_url === undefined ? baseUrl : origin(value.base_url),
      client_id: options.clientId || DINGTALK_OAUTH_CLIENT_ID,
      corp_id: value.corp_id, user_id: value.user_id,
      expires_at: startedAt + value.expires_in * 1000,
    };
  } finally { credential.access_token = undefined; }
}

module.exports = { exchangeQwenWorkCloudSession };
