'use strict';

const { CliError } = require('../core/cli-error');
const { DINGTALK_OAUTH_CLIENT_ID } = require('../core/env-manager');
const { requestJson, resolveTokenBaseUrl, normalizeTokenResponse } = require('./token-auth');
const { isEnvTokenAuthMode, hasEnvTokenCredential, saveDwsTokenSession } = require('./token-store');

const FAILURE_STATUSES = new Set([
  'dws_not_enabled', 'invalid_dws_token', 'unsupported_dws_source', 'insufficient_dws_scope',
  'dws_identity_unmapped', 'dws_upstream_unavailable', 'dws_policy_rejected', 'dws_session_expired',
]);

function failure(reason) {
  return new CliError(`DWS sync failed: ${reason}`, {
    code: 'DWS_SYNC_FAILED', details: { reason },
  });
}

function readHandoff(input = process.stdin, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    if (input.isTTY) { reject(failure('STDIN_REQUIRED')); return; }
    let chunks = [];
    let size = 0;
    const finish = (error, value) => {
      clearTimeout(timer);
      input.removeListener('data', onData);
      input.removeListener('end', onEnd);
      input.removeListener('error', onError);
      input.pause();
      chunks = [];
      if (error) { reject(error); } else { resolve(value); }
    };
    const onData = (chunk) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > 16384) { finish(failure('HANDOFF_TOO_LARGE')); return; }
      chunks.push(bytes);
    };
    const onError = () => finish(failure('HANDOFF_READ_FAILED'));
    const onEnd = () => {
      let data;
      try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch {
        finish(failure('INVALID_HANDOFF')); return;
      }
      if (!data || typeof data !== 'object' || Array.isArray(data)
          || Object.keys(data).some((key) => !['accessToken', 'corpId', 'environment'].includes(key))
          || typeof data.accessToken !== 'string' || !data.accessToken || data.accessToken.length > 8192
          || (/\s/.test(data.accessToken) || [...data.accessToken].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))
          || (data.corpId !== undefined && (typeof data.corpId !== 'string' || !data.corpId.trim() || data.corpId.length > 256))
          || !['pre', 'prod'].includes(data.environment)) {
        finish(failure('INVALID_HANDOFF')); return;
      }
      finish(null, data);
    };
    const timer = setTimeout(() => finish(failure('HANDOFF_TIMEOUT')), timeoutMs);
    input.on('data', onData);
    input.on('end', onEnd);
    input.on('error', onError);
  });
}

async function syncDws(options = {}) {
  const env = options.env || process.env;
  if (isEnvTokenAuthMode(env) || hasEnvTokenCredential(env)
      || options.authProfile || options.profile || options.userId
      || env.OPENYIDA_AUTH_PROFILE || env.OPENYIDA_AUTH_USER_ID || env.OPENYIDA_AUTH_CORP_ID) {
    throw failure('AUTH_OVERRIDE_CONFLICT');
  }
  const clientId = options.clientId || env.OPENYIDA_DINGTALK_CLIENT_ID || DINGTALK_OAUTH_CLIENT_ID;
  if (clientId !== DINGTALK_OAUTH_CLIENT_ID) { throw failure('CLIENT_CONFLICT'); }
  const baseUrl = resolveTokenBaseUrl(options);
  const target = new URL(baseUrl);
  if (target.protocol !== 'https:' || target.username || target.password || target.search || target.hash
      || target.pathname !== '/') { throw failure('TRUSTED_HTTPS_ORIGIN_REQUIRED'); }
  const handoff = await readHandoff(options.input || process.stdin, options.stdinTimeoutMs);
  if (options.corpId && handoff.corpId && options.corpId !== handoff.corpId) { throw failure('ORG_CONFLICT'); }
  const expectedCorp = options.corpId || handoff.corpId;
  let response;
  try {
    response = await requestJson('POST', `${target.origin}/openapi/cli/v1/auth/dws/token`, {
      ...(expectedCorp ? { corpId: expectedCorp } : {}), environment: handoff.environment,
    }, { Authorization: `Bearer ${handoff.accessToken}` }, { timeoutMs: 30000, maxResponseBytes: 65536 });
  } catch {
    throw failure('EXCHANGE_REQUEST_FAILED');
  } finally {
    delete handoff.accessToken;
  }
  const data = response && (response.data || response.content || response);
  if (!data || response.success === false || response.ok === false || data.status !== 'ok') {
    throw failure(data && FAILURE_STATUSES.has(data.status) ? data.status : 'EXCHANGE_REJECTED');
  }
  const session = normalizeTokenResponse(response, baseUrl, clientId);
  const now = Date.now() / 1000;
  if (typeof data.access_token !== 'string' || !data.access_token
      || typeof data.refresh_token !== 'string' || !data.refresh_token
      || data.client_id !== DINGTALK_OAUTH_CLIENT_ID
      || typeof data.corp_id !== 'string' || !data.corp_id.trim()
      || (expectedCorp && data.corp_id !== expectedCorp)
      || typeof data.user_id !== 'string' || !data.user_id
      || data.credential_source !== 'dws' || data.environment !== handoff.environment
      || typeof data.session_id !== 'string' || !/^[a-f0-9-]{36}$/.test(data.session_id)
      || !Number.isInteger(data.session_expires_at) || data.session_expires_at <= now
      || !Number.isInteger(data.expires_in) || data.expires_in <= 0
      || data.expires_in > data.session_expires_at - now + 2) {
    throw failure('INVALID_EXCHANGE_RESPONSE');
  }
  const business = new URL(session.base_url);
  // Token-bearing business requests must remain within this configured environment.
  if (business.origin !== target.origin) { throw failure('ENVIRONMENT_MISMATCH'); }
  delete session.raw;
  delete session.message;
  session.auth_base_url = target.origin;
  session.credential_source = 'dws';
  session.session_id = data.session_id;
  session.session_expires_at = data.session_expires_at;
  session.environment = data.environment;
  let saved;
  try {
    saved = saveDwsTokenSession(session, options);
  } catch {
    // Best-effort revoke only the newly issued session; never touch an existing profile.
    try {
      await requestJson('POST', `${target.origin}/openapi/cli/v1/auth/logout`, {
        refreshToken: session.refresh_token,
      }, { Authorization: `Bearer ${session.access_token}` }, { timeoutMs: 10000, maxResponseBytes: 65536 });
    } catch { /* The fixed server deadline still bounds an unreachable session. */ }
    throw failure('PERSISTENCE_FAILED');
  }
  return { ok: true, status: 'ready', auth_profile: saved.auth_profile,
    corp_id: saved.corp_id, user_id: saved.user_id };
}

async function run(args, options = {}) {
  if (args.length === 2 && args.includes('--capabilities') && args.includes('--json')) {
    const capabilities = { protocol_version: 1, private_stdin: true, independent_profile: true, server_identity: true };
    console.log(JSON.stringify(capabilities));
    return capabilities;
  }
  if (!args.includes('--stdin') || !args.includes('--json')
      || args.some((arg) => !['--stdin', '--json'].includes(arg))) {
    throw failure('USE_AUTH_SYNC_DWS_STDIN_JSON');
  }
  const result = await syncDws(options);
  console.log(JSON.stringify(result));
  return result;
}

module.exports = { run, syncDws, readHandoff };
