'use strict';

const { CliError } = require('../core/cli-error');
const { createYidaClient } = require('../core/yida-client');

const TRUSTED_YIDA_OPENAPI_HOSTS = new Set([
  'api.dingtalk.com',
  'oapi.dingtalk.com',
]);

const TRUSTED_YIDA_OPENAPI_PATH_PREFIXES = [
  '/v1.0/yida/',
  '/v2.0/yida/',
  '/topapi/yida/',
  '/topapi/v2/yida/',
];

function systemTokenError(code, message, details = {}) {
  return new CliError(message, {
    code,
    details: {
      retryable: false,
      retrySafe: true,
      sideEffectState: 'none',
      ...details,
      remoteWrites: 0,
    },
  });
}

function normalizeAppType(value) {
  const appType = String(value || '').trim();
  if (!/^APP_[A-Za-z0-9]+$/.test(appType)) {
    throw systemTokenError(
      'YIDA_SYSTEM_TOKEN_APP_TYPE_INVALID',
      'systemToken 目标 appType 无效。',
      { appType }
    );
  }
  return appType;
}

function normalizeHost(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*/, '')
    .replace(/:\d+$/, '');
}

function normalizeOperationPath(operation) {
  const raw = String(operation && (operation.url || operation.path) || '').trim();
  if (!raw) { return ''; }
  try {
    return new URL(raw).pathname;
  } catch (_error) {
    return `/${raw.replace(/^\/+/, '')}`;
  }
}

function inferInputLocation(input) {
  const explicit = String(input && input.paramLocation || '').toLowerCase();
  if (['path', 'query', 'header', 'body'].includes(explicit)) {
    return explicit;
  }
  const name = String(input && input.name || '').toLowerCase();
  if (name === 'path' || name === 'paths') { return 'path'; }
  if (name === 'query' || name === 'queries') { return 'query'; }
  if (name === 'header' || name === 'headers') { return 'header'; }
  if (name === 'body') { return 'body'; }
  return '';
}

function collectSystemTokenLocations(operation) {
  const locations = new Set();
  function visit(input, inheritedLocation = '') {
    if (!input || typeof input !== 'object') { return; }
    const location = inferInputLocation(input) || inheritedLocation;
    if (String(input.name || '').toLowerCase() === 'systemtoken' && location) {
      locations.add(location);
    }
    for (const child of [
      ...(Array.isArray(input.childList) ? input.childList : []),
      ...(Array.isArray(input.children) ? input.children : []),
    ]) {
      visit(child, location);
    }
  }
  for (const input of Array.isArray(operation && operation.inputs) ? operation.inputs : []) {
    visit(input);
  }
  const parameters = operation && operation.parameters;
  if (parameters && typeof parameters === 'object') {
    for (const location of ['path', 'query', 'header']) {
      for (const entry of Array.isArray(parameters[location]) ? parameters[location] : []) {
        if (String(entry && entry.name || '').toLowerCase() === 'systemtoken') {
          locations.add(location);
        }
      }
    }
    const bodyDefault = parameters.body && parameters.body.default;
    if (bodyDefault && typeof bodyDefault === 'object'
      && Object.keys(bodyDefault).some(key => key.toLowerCase() === 'systemtoken')) {
      locations.add('body');
    }
  }
  return Array.from(locations).sort();
}

function assertTrustedYidaSystemTokenTarget(connector, operation) {
  const scheme = String(connector && connector.scheme || 'https').toLowerCase().replace(/:$/, '');
  const host = normalizeHost(connector && connector.host);
  const basePath = String(connector && connector.baseUrl || '').trim().replace(/^\/+|\/+$/g, '');
  const actionPath = normalizeOperationPath(operation).replace(/^\/+/, '');
  const operationPath = `/${[basePath, actionPath].filter(Boolean).join('/')}`;
  const locations = collectSystemTokenLocations(operation);
  if (scheme !== 'https'
    || !TRUSTED_YIDA_OPENAPI_HOSTS.has(host)
    || !TRUSTED_YIDA_OPENAPI_PATH_PREFIXES.some(prefix => operationPath.startsWith(prefix))) {
    throw systemTokenError(
      'YIDA_SYSTEM_TOKEN_TARGET_UNTRUSTED',
      'systemToken 只能注入已验证的宜搭官方 OpenAPI。',
      { scheme, host, operationPath }
    );
  }
  if (locations.length !== 1 || locations[0] !== 'body') {
    throw systemTokenError(
      'YIDA_SYSTEM_TOKEN_BODY_INPUT_REQUIRED',
      '连接器动作必须唯一声明 body.systemToken。',
      { locations }
    );
  }
  return { scheme, host, operationPath, locations };
}

function hasNonEmptySystemToken(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object') { return false; }
  if (seen.has(value)) { return false; }
  seen.add(value);
  if (String(value.name || '').trim().toLowerCase() === 'systemtoken') {
    const declaredDefault = Object.prototype.hasOwnProperty.call(value, 'defaultValue')
      ? value.defaultValue
      : value.value;
    if (declaredDefault !== undefined && declaredDefault !== null
      && String(declaredDefault).trim() !== '') {
      return true;
    }
  }
  for (const [key, entryValue] of Object.entries(value)) {
    if (key.toLowerCase() === 'systemtoken'
      && entryValue !== undefined && entryValue !== null && String(entryValue).trim() !== '') {
      return true;
    }
    if (entryValue && typeof entryValue === 'object' && hasNonEmptySystemToken(entryValue, seen)) {
      return true;
    }
    if (typeof entryValue === 'string'
      && (entryValue.trim().startsWith('{') || entryValue.trim().startsWith('['))) {
      try {
        if (hasNonEmptySystemToken(JSON.parse(entryValue), seen)) { return true; }
      } catch (_error) {
        // Non-JSON strings are ordinary business values.
      }
    }
  }
  return false;
}

function assertNoExplicitSystemToken(value, details = {}) {
  if (hasNonEmptySystemToken(value)) {
    throw systemTokenError(
      'YIDA_SYSTEM_TOKEN_EXPLICIT_VALUE_FORBIDDEN',
      '不得通过参数、文件或 Action 默认值传入 systemToken；请使用 OpenYida 内部解析。',
      details
    );
  }
}

async function resolveYidaSystemToken(authRef, appTypeValue, dependencies = {}) {
  const appType = normalizeAppType(appTypeValue);
  const client = dependencies.client || createYidaClient({ authRef });
  let response;
  try {
    response = await client.postForm(
      `/dingtalk/web/${encodeURIComponent(appType)}/query/app/getSystemToken.json?_api=App.getSystemToken&_mock=false&_stamp=${Date.now()}`,
      { _locale_time_zone_offset: '28800000' },
      { silentStatus: true }
    );
  } catch (_error) {
    throw systemTokenError(
      'YIDA_SYSTEM_TOKEN_READ_FAILED',
      '无法读取目标宜搭应用的 systemToken。',
      { appType }
    );
  }
  if (response && (response.__needLogin || response.__csrfExpired)) {
    let appDetail = null;
    try {
      appDetail = await client.get(
        `/${encodeURIComponent(appType)}/query/app/getAppIncludingAecpInfo.json`,
        {
          _api: 'nattyFetch',
          _mock: 'false',
          appKey: appType,
          _stamp: Date.now(),
        },
        { silentStatus: true }
      );
    } catch (_error) {
      appDetail = null;
    }
    if (appDetail && appDetail.success === true) {
      throw systemTokenError(
        'YIDA_SYSTEM_TOKEN_PERMISSION_DENIED',
        '当前账号可访问目标应用，但无权读取该应用的 systemToken。',
        {
          appType,
          nextStep: '请确认当前账号是该应用管理员，然后重新执行原命令。',
        }
      );
    }

    let appList = null;
    try {
      appList = await client.get(
        '/query/app/getAppList.json',
        {
          _api: 'nattyFetch',
          _mock: 'false',
          pageIndex: 1,
          pageSize: 1,
          creator: authRef && authRef.userId || '',
          _stamp: Date.now(),
        },
        { silentStatus: true }
      );
    } catch (_error) {
      appList = null;
    }
    if (appList && appList.success === true) {
      throw systemTokenError(
        'YIDA_SYSTEM_TOKEN_APP_INACCESSIBLE',
        '当前账号无法访问目标宜搭应用，已停止凭据绑定。',
        {
          appType,
          nextStep: '请切换到可管理该应用的组织或账号，或改用当前账号可管理的 appType。',
        }
      );
    }
    throw systemTokenError(
      'YIDA_SYSTEM_TOKEN_AUTH_REQUIRED',
      '当前 OpenYida 登录态无法读取宜搭 systemToken。',
      {
        appType,
        nextStep: '请重新执行 openyida login，验证组织后重试原命令。',
      }
    );
  }
  if (!response || response.success !== true
    || typeof response.content !== 'string' || !response.content.trim()) {
    throw systemTokenError(
      'YIDA_SYSTEM_TOKEN_READ_FAILED',
      '无法读取目标宜搭应用的 systemToken。',
      { appType, errorCode: response && response.errorCode || '' }
    );
  }
  return response.content;
}

module.exports = {
  TRUSTED_YIDA_OPENAPI_HOSTS,
  TRUSTED_YIDA_OPENAPI_PATH_PREFIXES,
  assertNoExplicitSystemToken,
  assertTrustedYidaSystemTokenTarget,
  collectSystemTokenLocations,
  hasNonEmptySystemToken,
  normalizeAppType,
  resolveYidaSystemToken,
};
