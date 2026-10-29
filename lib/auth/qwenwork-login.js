'use strict';
const { t } = require('../core/i18n');
const { sessionIdentity } = require('./session-identity');
const { CliError } = require('../core/cli-error');
const { loadTokenSession, resolveTokenSession, isEnvTokenAuthMode, hasEnvTokenCredential, saveTokenSession } = require('./token-store');
const { detectRuntimeCapabilities } = require('../core/utils');
const { isQwenWorkWebRuntime } = require('../core/qwenwork-login-guidance');
const { exchangeQwenWorkCloudSession } = require('./qwenwork-cloud');
const { tokenLogin, tokenRefresh, isRefreshAuthRequired } = require('./token-auth');

function failure(code) {
  return new CliError(t('qwenwork.login_check_failed'), { code });
}
function summary(ok, session = {}) { return { ok, status: ok ? 'ok' : 'not_logged_in', can_auto_use: ok, ...(ok ? sessionIdentity(session) : {}) }; }

/** 以服务端状态为准；网络异常不能触发浏览器登录。 */
async function verify(session, options = {}) {
  if (!session || !session.access_token) { return false; }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 15000);
  try {
    const response = await (options.fetch || globalThis.fetch)(`${session.base_url.replace(/\/$/, '')}/openapi/cli/v1/auth/status`, {
      headers: { authorization: `Bearer ${session.access_token}`, accept: 'application/json' },
      redirect: 'error', signal: controller.signal,
    });
    if ([401, 403].includes(response.status)) { await response.body?.cancel(); return false; }
    if (!response.ok) { await response.body?.cancel(); throw failure('QWENWORK_LOGIN_CHECK_FAILED'); }
    const reader = response.body?.getReader();
    if (!reader) { throw failure('QWENWORK_LOGIN_CHECK_FAILED'); }
    const chunks = []; let size = 0;
    try {
      for (let part = await reader.read(); !part.done; part = await reader.read()) {
        size += part.value.byteLength;
        if (size > 65536) { await reader.cancel(); throw failure('QWENWORK_LOGIN_CHECK_FAILED'); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (value.status !== 'ok' || value.can_auto_use !== true || value.auth_mode !== 'token') {
      if (['not_logged_in', 'invalid_access_token', 'token_expired', 'auth_required'].includes(value.status)) { return false; }
      throw failure('QWENWORK_LOGIN_CHECK_FAILED');
    }
    if (value.corp_id !== session.corp_id || value.user_id !== session.user_id ||
      (options.corpId && value.corp_id !== options.corpId)) { throw failure('QWENWORK_LOGIN_IDENTITY_MISMATCH'); }
    return true;
  } catch (error) {
    if (error instanceof CliError) { throw error; }
    throw failure('QWENWORK_LOGIN_CHECK_FAILED');
  } finally { clearTimeout(timer); }
}

/** 网页态消费宿主凭据；其他宿主保留已有登录态与前台 OAuth 流程。 */
async function ensureQwenWorkLogin(options = {}, dependencies = {}) {
  const env = options.env || process.env;
  const runtime = options.runtime || detectRuntimeCapabilities({ env });
  if (isQwenWorkWebRuntime(runtime) && !isEnvTokenAuthMode(env) && !hasEnvTokenCredential(env)) {
    if (options.checkOnly) {
      const session = loadTokenSession(options);
      return summary(await verify(session, options), session || {});
    }
    const selectedProfile = options.authProfile || options.profile || env.OPENYIDA_AUTH_PROFILE;
    const selectedSession = selectedProfile ? loadTokenSession(options) : null;
    if (selectedProfile && !selectedSession) { throw failure('AUTH_PROFILE_REQUIRED'); }
    const cloudOptions = {
      ...options,
      endpoint: options.endpoint || env.OPENYIDA_ENDPOINT || selectedSession?.base_url,
      corpId: options.corpId || env.OPENYIDA_AUTH_CORP_ID || selectedSession?.corp_id,
      userId: options.userId || env.OPENYIDA_AUTH_USER_ID || selectedSession?.user_id,
    };
    const session = await exchangeQwenWorkCloudSession(cloudOptions);
    if (!await verify(session, options)) { throw failure('QWENWORK_LOGIN_CHECK_FAILED'); }
    saveTokenSession(session, options);
    return summary(true, session);
  }
  const resolution = resolveTokenSession(options);
  if (resolution.status === 'profile_required') { throw failure('AUTH_PROFILE_REQUIRED'); }
  let session = loadTokenSession(options);
  if (session && options.endpoint && new URL(session.base_url).origin !== new URL(options.endpoint).origin) {
    session = null;
  }
  if (await verify(session, options)) { return summary(true, session); }
  if (session?.refresh_token) {
    try {
      const refreshed = await (dependencies.refresh || tokenRefresh)(options);
      if (refreshed && refreshed.ok !== false && refreshed.access_token) {
        if (await verify(refreshed, options)) { return summary(true, refreshed); }
      } else if (!isRefreshAuthRequired(refreshed)) { throw failure('QWENWORK_LOGIN_REFRESH_FAILED'); }
    } catch (error) {
      if (!isRefreshAuthRequired(error) && ![401, 403].includes(error.statusCode)) {
        if (error instanceof CliError) { throw error; }
        throw failure('QWENWORK_LOGIN_REFRESH_FAILED');
      }
    }
  }
  if (options.checkOnly) { return summary(false); }
  if (isEnvTokenAuthMode(env) || isQwenWorkWebRuntime(runtime)) { throw failure('QWENWORK_LOGIN_FAILED'); }
  const result = await (dependencies.login || tokenLogin)(options);
  if (!result || result.ok === false || !result.access_token || !await verify(result, options)) {
    throw failure('QWENWORK_LOGIN_FAILED');
  }
  return summary(true, result);
}

async function run(args, options = {}) {
  const result = await ensureQwenWorkLogin({ ...options, checkOnly: args.includes('--check-only') });
  if (args.includes('--json') && !args.includes('--quiet') && process.env.YIDA_QUIET !== '1') {
    console.log(JSON.stringify(result));
  }
  if (!result.ok) { process.exitCode = 1; }
  return result;
}
module.exports = { ensureQwenWorkLogin, run };
