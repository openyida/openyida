'use strict';

const { CliError } = require('./cli-error');
const { t } = require('./i18n');
const { redactString } = require('./redact');

const TYPES = { unauth: 'platform_access', noAppCreationAuth: 'create_app' };
const CODES = {
  platform_access: 'YIDA_PLATFORM_ACCESS_REQUIRED',
  create_app: 'YIDA_APP_CREATE_PERMISSION_REQUIRED',
  unknown: 'YIDA_PERMISSION_REQUIRED',
};
const AUTH_CODES = new Set([
  'not_logged_in', 'invalid_access_token', 'expired_access_token',
  'access_token_expired', 'missing_access_token',
]);

function normalizeMessage(value) {
  return String(value || '').replace(/[\s，,。.!！]/g, '');
}

// 仅接受当前宜搭域名的两类申请页；重建查询参数，避免传递凭据或任意回跳地址。
function resolvePermissionPage(location, baseUrl) {
  if (!location || !baseUrl) { return null; }
  try {
    const base = new URL(baseUrl);
    const target = new URL(location, base);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password
      || target.origin !== base.origin || target.username || target.password
      || target.pathname !== '/defaultPage.html') { return null; }
    const values = target.searchParams.getAll('type');
    if (values.length !== 1 || !Object.hasOwn(TYPES, values[0])) { return null; }
    const url = new URL('/defaultPage.html', base);
    url.searchParams.set('type', values[0]);
    for (const key of ['corpid', 'appType']) {
      const value = target.searchParams.get(key);
      if (value && /^[A-Za-z0-9_-]{1,200}$/.test(value)) { url.searchParams.set(key, value); }
    }
    return { permissionType: TYPES[values[0]], url: url.href };
  } catch { return null; }
}

function createPermissionError(response, options = {}) {
  if (options.tool !== 'qwenwork') { return null; }
  let payload = response;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch { payload = {}; }
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) { payload = {}; }
  const content = payload.content && typeof payload.content === 'object' && !Array.isArray(payload.content)
    ? payload.content : {};
  const code = String(payload.errorCode || payload.code || content.errorCode || content.code || '');
  const status = String(payload.status || content.status || '').toLowerCase();
  const message = String(payload.errorMsg || payload.message || content.errorMsg || content.message || '');
  const httpStatus = Number(options.httpStatus || payload.__httpStatus || 0);
  // 明确的凭据失效继续由原有认证链路处理。
  if (httpStatus === 401 || AUTH_CODES.has(code.toLowerCase()) || AUTH_CODES.has(status)
    || /not_logged_in|invalid_access_token|expired_access_token|access_token_expired|access token is invalid or expired/i.test(message)) { return null; }
  const failed = payload.success === false || payload.__needLogin || httpStatus >= 300;
  if (!failed) { return null; }
  let page = resolvePermissionPage(options.location || payload.__location, options.baseUrl);
  const legacyDenied = /^(?:TIANSHU_)?000006$/.test(code);
  if (!page && legacyDenied) {
    const normalized = normalizeMessage(message);
    if (normalized === '已升级宜搭你未在授权范围内因此无法使用如要使用请联系管理员授权') {
      page = resolvePermissionPage('/defaultPage.html?type=unauth', options.baseUrl);
    } else if (normalized === '管理员暂未为您分配权限请联系管理员授权'
      && /^\/query\/app\/registerApp(?:\.json)?(?:\?|$)/.test(options.requestPath || '')) {
      // 000006 被多个权限检查共用，只有已核实的创建接口及文案组合才可归类。
      page = resolvePermissionPage('/defaultPage.html?type=noAppCreationAuth', options.baseUrl);
    }
  }
  if (!page && !legacyDenied && httpStatus !== 403 && code !== '403' && status !== '403') { return null; }
  const permissionType = page ? page.permissionType : 'unknown';
  const label = page ? t(`permission_guidance.${permissionType}_link`) : '';
  const details = {
    status: 'permission_required', permissionType,
    platformErrorCode: code || undefined, httpStatus: httpStatus || undefined,
    platformErrorMessage: message ? redactString(message) : undefined,
    retryable: false,
    nextStep: page ? t('permission_guidance.next_step', label, page.url) : t('permission_guidance.unknown'),
  };
  if (page) {
    details.permissionLabel = label;
    details.permissionUrl = page.url;
    details.nextAction = { type: 'open_url', label, url: page.url };
  }
  const displayMessage = page || !message ? t(`permission_guidance.${permissionType}`) : redactString(message);
  return new CliError(displayMessage, {
    code: CODES[permissionType], details,
  });
}

function isPermissionGuidanceError(error) {
  return !!error && error.isCliError === true && Object.values(CODES).includes(error.code);
}

module.exports = { createPermissionError, isPermissionGuidanceError };
