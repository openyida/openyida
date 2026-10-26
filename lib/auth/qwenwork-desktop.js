'use strict';

const { CliError } = require('../core/cli-error');
const { buildQwenWorkLoginInvocation } = require('../core/qwenwork-login-guidance');
const { t } = require('../core/i18n');
const { DINGTALK_OAUTH_CLIENT_ID } = require('../core/env-manager');
const { saveTokenSession, loadTokenSession, isEnvTokenAuthMode } = require('./token-store');
const { readManagedContext } = require('../agent/managed-context');

const TICKET_ENV = 'OPENYIDA_QWENWORK_EXCHANGE_TICKET';
const TICKET_CONTEXT_ENV = 'OPENYIDA_QWENWORK_EXCHANGE_TICKET_CONTEXT';
const CONSUME_PATH = '/openapi/cli/v1/auth/qwenwork/desktop/consume';
const MAX_RESPONSE_BYTES = 65536;

function fail(code) {
  return new CliError(t('qwenwork.desktop_login_failed'), {
    code: `QWENWORK_DESKTOP_${code}`,
    details: { invocation: buildQwenWorkLoginInvocation() },
  });
}

function parseTicket(raw, context) {
  try {
    if (typeof raw !== 'string' || !raw || /\s/.test(raw) || raw.length > 32768 || typeof context !== 'string' || context.length > 8192) { throw new Error(); }
    const value = JSON.parse(context);
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !Number.isSafeInteger(value.expires_at) || value.expires_at <= Date.now() || value.expires_at > Date.now() + 300000 ||
      typeof value.corp_id !== 'string' || !value.corp_id || typeof value.user_id !== 'string' || !value.user_id ||
      typeof value.exchange_id !== 'string' || !value.exchange_id ||
      'access_token' in value || 'refresh_token' in value || 'accessToken' in value || 'refreshToken' in value) { throw new Error(); }
    return { ...value, exchange_ticket: raw };
  } catch {
    throw fail('TICKET_MISSING_OR_INVALID');
  }
}

function origin(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') { throw new Error(); }
    return url.origin;
  } catch {
    throw fail('ENDPOINT_INVALID');
  }
}

async function requestJson(url, init, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 15000);
  try {
    const response = await (options.fetch || globalThis.fetch)(url, { ...init, redirect: 'error', signal: controller.signal });
    if (!response.ok) {
      if (response.body) { await response.body.cancel(); }
      throw fail('REQUEST_REJECTED');
    }
    const reader = response.body && response.body.getReader();
    if (!reader) { throw fail('RESPONSE_INVALID'); }
    const chunks = [];
    let bytes = 0;
    try {
      for (let next = await reader.read(); !next.done; next = await reader.read()) {
        bytes += next.value.byteLength;
        if (bytes > MAX_RESPONSE_BYTES) { await reader.cancel(); throw fail('RESPONSE_INVALID'); }
        chunks.push(next.value);
      }
    } finally {
      reader.releaseLock();
    }
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) { throw fail('RESPONSE_INVALID'); }
    return value;
  } catch (error) {
    // 服务端和网络异常可能回显凭据，只透传本模块生成的固定错误。
    if (error instanceof CliError && /^QWENWORK_DESKTOP_/.test(error.code)) { throw error; }
    throw fail(controller.signal.aborted ? 'REQUEST_TIMED_OUT' : 'REQUEST_FAILED');
  } finally {
    clearTimeout(timer);
  }
}

/** 客户端内部入口：消费一次性兑换票并持久化双 Token，不调用或重启普通 login。 */
async function loginQwenWork(options = {}) {
  const env = options.env || process.env;
  const raw = options.exchangeTicket || env[TICKET_ENV];
  const context = options.ticketContext || env[TICKET_CONTEXT_ENV];
  delete env[TICKET_ENV];
  delete env[TICKET_CONTEXT_ENV];
  if (isEnvTokenAuthMode(env) || readManagedContext(env)) { throw fail('MANAGED_AUTH_CONFLICT'); }
  const ticket = parseTicket(raw, context);
  const baseUrl = origin(ticket.base_url);
  const expectedEndpoint = options.endpoint || env.OPENYIDA_ENDPOINT;
  if (expectedEndpoint && origin(expectedEndpoint) !== baseUrl) { throw fail('ENDPOINT_MISMATCH'); }
  if (options.corpId && options.corpId !== ticket.corp_id) { throw fail('IDENTITY_MISMATCH'); }
  const startedAt = Date.now();
  const value = await requestJson(`${baseUrl}${CONSUME_PATH}`, {
    method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json', authorization: `Bearer ${ticket.exchange_ticket}` },
    body: '{}',
  }, options);
  const expiresAt = startedAt + Number(value.expires_in) * 1000;
  if (value.status !== 'ok' || value.auth_mode !== 'token' || value.can_auto_use !== true ||
    value.token_type !== 'Bearer' || value.credential_source !== 'qwenwork_desktop' ||
    'refreshToken' in value || 'exchange_ticket' in value ||
    typeof value.access_token !== 'string' || !value.access_token || /\s/.test(value.access_token) || value.access_token.length > 32768 ||
    !Number.isInteger(value.expires_in) || value.expires_in < 1 || value.expires_in > 1800 ||
    typeof value.refresh_token !== 'string' || !value.refresh_token || /\s/.test(value.refresh_token) || value.refresh_token.length > 32768 ||
    !Number.isInteger(value.refresh_token_expires_in) || value.refresh_token_expires_in < 1 ||
    (value.client_id && value.client_id !== DINGTALK_OAUTH_CLIENT_ID) ||
    value.corp_id !== ticket.corp_id || value.user_id !== ticket.user_id || value.exchange_id !== ticket.exchange_id ||
    (value.base_url && origin(value.base_url) !== baseUrl)) { throw fail('CREDENTIAL_INVALID'); }
  const verified = await requestJson(`${baseUrl}/openapi/cli/v1/auth/status`, {
    method: 'GET', headers: { authorization: `Bearer ${value.access_token}`, accept: 'application/json' },
  }, options);
  if (verified.status !== 'ok' || verified.auth_mode !== 'token' || verified.can_auto_use !== true ||
    verified.corp_id !== value.corp_id || verified.user_id !== value.user_id || expiresAt <= Date.now()) { throw fail('IDENTITY_MISMATCH'); }
  const session = saveTokenSession({
    auth_mode: 'token', token_type: 'Bearer', access_token: value.access_token, refresh_token: value.refresh_token,
    expires_at: expiresAt, base_url: baseUrl, client_id: DINGTALK_OAUTH_CLIENT_ID,
    corp_id: value.corp_id, user_id: value.user_id, credential_source: 'qwenwork_desktop',
  }, options);
  const restored = loadTokenSession(options);
  if (!['user', 'project'].includes(session.persistence_scope) || !restored ||
    restored.access_token !== value.access_token || restored.refresh_token !== value.refresh_token || restored.base_url !== baseUrl ||
    restored.corp_id !== value.corp_id || restored.user_id !== value.user_id) { throw fail('PERSISTENCE_FAILED'); }
  // 身份、环境和存储细节仅用于内部校验，不进入模型可见的登录结果。
  return { ok: true, status: 'ok', can_auto_use: true };
}

async function run(args, options = {}) {
  if (args.includes('--help') || args.includes('-h')) {
    const invocation = buildQwenWorkLoginInvocation();
    if (args.includes('--json')) { console.log(JSON.stringify({ usage: t('qwenwork.desktop_login_usage'), invocation })); }
    else { console.log(`${t('qwenwork.desktop_login_usage')}\n${t('qwenwork.desktop_login_standalone', invocation.command)}`); }
    return;
  }
  const parsed = {};
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (seen.has(flag)) { throw new CliError(t('qwenwork.desktop_login_usage'), { code: 'CLI_USAGE_ERROR', exitCode: 2, details: { invocation: buildQwenWorkLoginInvocation() } }); }
    seen.add(flag);
    if (['--json', '--quiet'].includes(flag)) { continue; }
    const key = flag === '--corp-id' ? 'corpId' : flag === '--endpoint' ? 'endpoint'
      : flag === '--exchange-ticket' ? 'exchangeTicket' : flag === '--ticket-context' ? 'ticketContext' : null;
    const value = args[++index];
    if (!key || !value || value.startsWith('--')) { throw new CliError(t('qwenwork.desktop_login_usage'), { code: 'CLI_USAGE_ERROR', exitCode: 2, details: { invocation: buildQwenWorkLoginInvocation() } }); }
    parsed[key] = value;
  }
  const result = await loginQwenWork({ ...options, ...parsed });
  if (args.includes('--json') && !args.includes('--quiet') && (options.env || process.env).YIDA_QUIET !== '1') { console.log(JSON.stringify({ ...result, next_action: 'continue_business_operation_silently', user_visible: false })); }
  return result;
}

module.exports = { TICKET_ENV, TICKET_CONTEXT_ENV, loginQwenWork, run };
