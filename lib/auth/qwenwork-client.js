'use strict';

const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');

const DEFAULT_TIMEOUT_MS = 20000;
const MAX_RESPONSE_BYTES = 1024 * 1024;

function failure(code, message, stage, details = {}) {
  return new CliError(t(`qwenwork.${message}`), {
    code: `QWENWORK_${code}`,
    details: { stage, ...details },
  });
}

function pick(env, names) {
  for (const name of names) {
    const value = String(env[name] || '').trim();
    if (value) {
      return { name, value };
    }
  }
  return null;
}

function normalizeBaseUrl(value) {
  try {
    const url = new URL(value);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
      url.username || url.password || url.search || url.hash) {
      throw new Error('invalid_url');
    }
    return url.href.replace(/\/+$/, '');
  } catch {
    throw failure('INVALID_GATEWAY', 'invalid_url', 'resolve_credentials');
  }
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// Do not include upstream bodies, headers or exception messages in diagnostics:
// an authentication endpoint may echo credentials even in an error response.
async function requestJson(method, url, accessToken, options, stage) {
  const timeoutMs = options.timeoutMs === undefined ? DEFAULT_TIMEOUT_MS : options.timeoutMs;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw failure('INVALID_TIMEOUT', 'request_failed', stage);
  }
  const controller = new globalThis.AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await globalThis.fetch(url, {
      method,
      headers: { accept: 'application/json', authorization: `Bearer ${accessToken}` },
      redirect: 'manual',
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.body) {
        await response.body.cancel();
      }
      throw failure('HTTP_ERROR', 'request_failed', stage, { status_code: response.status });
    }
    const chunks = [];
    let size = 0;
    if (response.body) {
      const reader = response.body.getReader();
      let next = await reader.read();
      while (!next.done) {
        const { value } = next;
        size += value.byteLength;
        if (size > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          throw failure('RESPONSE_TOO_LARGE', 'invalid_response', stage);
        }
        chunks.push(Buffer.from(value));
        next = await reader.read();
      }
    }
    let payload;
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw failure('INVALID_RESPONSE', 'invalid_response', stage);
    }
    if (!isObject(payload) || (payload.code !== undefined && payload.code !== 'ok')) {
      throw failure('INVALID_RESPONSE', 'invalid_response', stage);
    }
    return payload;
  } catch (error) {
    if (error && error.isCliError) {
      throw error;
    }
    throw controller.signal.aborted
      ? failure('TIMEOUT', 'request_timeout', stage)
      : failure('NETWORK_ERROR', 'request_failed', stage);
  } finally {
    clearTimeout(timer);
  }
}

function decodeClaims(token) {
  try {
    const value = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return isObject(value) ? value : {};
  } catch {
    return {};
  }
}

/** Exchange a cloud Agent credential for an in-memory scoped user credential.
 * This does not issue or persist an OpenYida session.
 */
async function exchangeQwenWorkAgentToken(options = {}) {
  const env = options.env || process.env;
  const agent = pick(env, ['QWENWORK_AGENT_TOKEN', 'MULE_AGENT_TOKEN', 'AGENT_TOKEN']);
  if (!agent || /[\r\n]/.test(agent.value)) {
    throw failure('CREDENTIAL_MISSING', 'credential_missing', 'resolve_credentials');
  }
  const gateway = pick(env, ['QWENWORK_GATEWAY_URL', 'MULE_GATEWAY_URL']);
  if (!gateway) {
    throw failure('GATEWAY_MISSING', 'gateway_missing', 'resolve_credentials');
  }
  const baseUrl = normalizeBaseUrl(gateway.value);
  const response = await requestJson('POST', `${baseUrl}/api/agent-gw/token/exchange`, agent.value, options, 'exchange');
  // The current cloud endpoint returns {token, scope, ttl} without an envelope.
  const payload = isObject(response.data) ? response.data : response;
  if (typeof payload.token !== 'string' || !payload.token.trim() || /\s/.test(payload.token) ||
    typeof payload.scope !== 'string' || !Number.isFinite(payload.ttl) || payload.ttl <= 0) {
    throw failure('INVALID_RESPONSE', 'invalid_response', 'exchange');
  }
  const decoded = decodeClaims(payload.token);
  if (typeof decoded.exp === 'number' && decoded.exp * 1000 <= Date.now()) {
    throw failure('TOKEN_EXPIRED', 'expired_token', 'exchange');
  }
  return {
    access_token: payload.token,
    base_url: baseUrl,
    credential_source: agent.name,
    scope: payload.scope,
    expires_in: payload.ttl,
    expires_at: typeof decoded.exp === 'number' ? decoded.exp * 1000 : Date.now() + payload.ttl * 1000,
  };
}

/** Query the credential's own origin; never infer a YiDA endpoint or organization. */
async function getQwenWorkUserInfo(credential, options = {}) {
  const accessToken = credential && credential.access_token;
  if (typeof accessToken !== 'string' || !accessToken || /[\r\n]/.test(accessToken)) {
    throw failure('CREDENTIAL_MISSING', 'credential_missing', 'user_info');
  }
  const baseUrl = normalizeBaseUrl(credential.base_url);
  const response = await requestJson('GET', `${baseUrl}/user/info`, accessToken, options, 'user_info');
  if (response.code !== 'ok' || !isObject(response.data) ||
    typeof response.data.user_id !== 'string' || !response.data.user_id.trim()) {
    throw failure('INVALID_RESPONSE', 'invalid_response', 'user_info');
  }
  const env = options.env || process.env;
  const decoded = decodeClaims(accessToken);
  // Decoding is not local signature verification. The authenticated /user/info
  // response establishes identity; these comparisons catch context drift.
  for (const expected of [env.QWENWORK_USER_ID, env.MULE_USER_ID, decoded.user_id, decoded.sub]) {
    if (expected && String(expected) !== response.data.user_id) {
      throw failure('IDENTITY_MISMATCH', 'identity_mismatch', 'user_info');
    }
  }
  const orgId = response.data.biz && response.data.biz.org_id;
  if (orgId && decoded.biz_org_id && orgId !== decoded.biz_org_id) {
    throw failure('IDENTITY_MISMATCH', 'identity_mismatch', 'user_info');
  }
  return response.data;
}

/** Safe composition for identity consumers: the returned object has no credential. */
async function getQwenWorkIdentity(options = {}) {
  const credential = await exchangeQwenWorkAgentToken(options);
  const profile = await getQwenWorkUserInfo(credential, options);
  return {
    base_url: credential.base_url,
    credential_source: credential.credential_source,
    scope: credential.scope,
    expires_in: credential.expires_in,
    expires_at: credential.expires_at,
    profile,
  };
}

module.exports = { exchangeQwenWorkAgentToken, getQwenWorkUserInfo, getQwenWorkIdentity };
