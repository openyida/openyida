/**
 * save-share-config.js - 宜搭页面公开访问/分享配置保存命令
 *
 * 用法：openyida save-share-config <appType> <formUuid> <url> <isOpen> [openAuth]
 */

'use strict';

const crypto = require('crypto');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { success, fail, warn } = require('../core/chalk');
const { createAuthRef, createYidaClient, isAuthRefReady } = require('../core/yida-client');

function usageMessage() {
  return [
    t('save_share_config.usage'),
    t('save_share_config.example'),
    t('save_share_config.is_open_hint'),
    t('save_share_config.open_auth_hint'),
  ].join('\n');
}

function parseArgs(args) {
  if (args.length < 4) {
    throw new CliError(usageMessage(), {
      code: 'SAVE_SHARE_CONFIG_INVALID_ARGUMENTS',
    });
  }
  return {
    appType: args[0],
    formUuid: args[1],
    openUrl: args[2],
    isOpen: args[3],
    openAuth: args.length >= 5 ? args[4] : undefined,
  };
}

function validateParams(params) {
  if (params.isOpen !== 'y' && params.isOpen !== 'n') {
    throw new Error(t('save_share_config.err_is_open_invalid', params.isOpen));
  }
  if (params.openAuth !== undefined && params.openAuth !== 'y' && params.openAuth !== 'n') {
    throw new Error(t('save_share_config.err_open_auth_invalid', params.openAuth));
  }
  if (params.isOpen === 'y' && !params.openUrl) {
    throw new Error(t('save_share_config.err_open_url_required'));
  }
  if (!params.openUrl) {
    return true;
  }
  if (!params.openUrl.startsWith('/o/') && !params.openUrl.startsWith('/s/')) {
    throw new Error(t('save_share_config.err_page_url_prefix', params.openUrl));
  }
  const pathPart = params.openUrl.slice(3);
  if (!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(pathPart)) {
    throw new Error(t('save_share_config.err_open_url_chars', params.openUrl));
  }
  return true;
}

function ensureSession() {
  const authRef = createAuthRef();
  if (!isAuthRefReady(authRef)) {
    throw new CliError(t('common.no_login_cache'), {
      code: 'NEED_LOGIN',
    });
  }
  return authRef;
}

function normalizeShareConfig(content = {}) {
  const normalized = {
    isOpen: content.isOpen === 'y' ? 'y' : 'n',
    openUrl: content.openUrl || '',
    shareUrl: content.shareUrl || '',
  };
  if (Object.prototype.hasOwnProperty.call(content, 'openPageAuthConfig')) {
    normalized.openPageAuthConfig = content.openPageAuthConfig;
  }
  return normalized;
}

function canonicalize(value) {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object') {
        return canonicalize(parsed);
      }
    } catch {
      // 普通字符串按原值比较。
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
  }
  return value;
}

function canonicalFingerprint(value) {
  const serialized = JSON.stringify(canonicalize(value));
  return crypto.createHash('sha256').update(serialized === undefined ? 'undefined' : serialized).digest('hex');
}

function parseOpenAuthConfig(value) {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
    || !Object.prototype.hasOwnProperty.call(parsed, 'openAuth')
    || !['y', 'n'].includes(parsed.openAuth)) {
    return null;
  }
  return parsed;
}

function isUninitializedPublicConfig(before = {}) {
  const hasAuthConfig = Object.prototype.hasOwnProperty.call(before, 'openPageAuthConfig')
    && before.openPageAuthConfig !== undefined
    && before.openPageAuthConfig !== null
    && before.openPageAuthConfig !== '';
  return before.isOpen !== 'y' && !before.openUrl && !hasAuthConfig;
}

function serializeOpenAuthConfig(value) {
  return JSON.stringify(value);
}

function buildExpectedOpenAuthConfig(params, before) {
  const current = parseOpenAuthConfig(before.openPageAuthConfig);
  if (!current) {
    if (isUninitializedPublicConfig(before) && params.openAuth !== undefined) {
      return { openAuth: params.openAuth, authSources: [] };
    }
    throw new CliError(t('save_share_config.current_state_incomplete'), {
      code: 'SAVE_SHARE_CONFIG_CURRENT_STATE_INCOMPLETE',
      details: { verification: buildUnknownVerification(params, before) },
    });
  }
  return params.openAuth === undefined
    ? current
    : { ...current, openAuth: params.openAuth };
}

function buildSaveParams(params, currentConfig = {}) {
  const current = normalizeShareConfig(currentConfig);
  const payload = {
    _api: 'Share.saveShareConfig',
    _locale_time_zone_offset: '28800000',
    formUuid: params.formUuid,
    openUrl: current.openUrl,
    shareUrl: current.shareUrl,
    isOpen: current.isOpen,
  };
  if (Object.prototype.hasOwnProperty.call(current, 'openPageAuthConfig')) {
    payload.openPageAuthConfig = typeof current.openPageAuthConfig === 'string'
      ? current.openPageAuthConfig
      : serializeOpenAuthConfig(current.openPageAuthConfig);
  }

  if (params.openUrl.startsWith('/s/')) {
    payload.shareUrl = params.openUrl;
  } else {
    payload.openUrl = params.openUrl;
    payload.isOpen = params.isOpen;
    payload.openPageAuthConfig = serializeOpenAuthConfig(
      buildExpectedOpenAuthConfig(params, current)
    );
  }

  return payload;
}

async function fetchShareConfig(client, appType, formUuid) {
  const result = await client.postForm(
    `/dingtalk/web/${appType}/query/formdesign/getShareConfig.json`,
    {
      _api: 'Share.getShareConfig',
      _locale_time_zone_offset: '28800000',
      formUuid,
    }
  );
  if (!result || result.__needLogin || result.success === false) {
    const errorMsg = result ? result.errorMsg || t('common.unknown_error') : t('common.request_failed');
    throw new CliError(t('get_page_config.query_failed', errorMsg), {
      code: result && result.__needLogin ? 'NEED_LOGIN' : 'PAGE_CONFIG_QUERY_FAILED',
      details: {
        errorCode: result && result.errorCode || null,
        needLogin: !!(result && result.__needLogin),
      },
    });
  }
  return normalizeShareConfig(result.content || {});
}

function verificationKeys(params, before) {
  const isShareUpdate = params.openUrl.startsWith('/s/');
  if (isShareUpdate) {
    const preservedKeys = ['openUrl', 'isOpen'];
    if (Object.prototype.hasOwnProperty.call(before, 'openPageAuthConfig')) {
      preservedKeys.push('openPageAuthConfig');
    }
    return { changedKeys: ['shareUrl'], preservedKeys };
  }

  const changedKeys = ['openUrl', 'isOpen'];
  const preservedKeys = ['shareUrl'];
  const currentAuthConfig = parseOpenAuthConfig(before.openPageAuthConfig);
  if (params.openAuth === undefined) {
    preservedKeys.push('openPageAuthConfig');
  } else if (!parseOpenAuthConfig(before.openPageAuthConfig) && isUninitializedPublicConfig(before)) {
    changedKeys.push('openPageAuthConfig');
  } else {
    changedKeys.push('openPageAuthConfig.openAuth');
    Object.keys(currentAuthConfig || {})
      .filter(key => key !== 'openAuth')
      .sort()
      .forEach(key => preservedKeys.push(`openPageAuthConfig.${key}`));
  }
  return { changedKeys, preservedKeys };
}

function buildUnknownVerification(params, before) {
  const { changedKeys, preservedKeys } = verificationKeys(params, before);
  return {
    status: 'unknown',
    changedKeys,
    preservedKeys,
    canonicalFingerprints: { before: canonicalFingerprint(before) },
    mismatches: [{ path: 'openPageAuthConfig', kind: 'preserved' }],
  };
}

function mismatchKind(path, changedKeys) {
  return changedKeys.some(key => path === key || path.startsWith(`${key}.`) || key.startsWith(`${path}.`))
    ? 'changed'
    : 'preserved';
}

function collectMismatches(expected, actual, path, changedKeys, mismatches) {
  if (JSON.stringify(canonicalize(expected)) === JSON.stringify(canonicalize(actual))) {
    return;
  }
  const expectedObject = expected && typeof expected === 'object' && !Array.isArray(expected);
  const actualObject = actual && typeof actual === 'object' && !Array.isArray(actual);
  if (expectedObject && actualObject) {
    const childKeys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
    childKeys.forEach((key) => {
      collectMismatches(expected[key], actual[key], path ? `${path}.${key}` : key, changedKeys, mismatches);
    });
    return;
  }
  mismatches.push({ path, kind: mismatchKind(path, changedKeys) });
}

function buildVerification(params, before, expected, after, status = 'verified') {
  const { changedKeys, preservedKeys } = verificationKeys(params, before);
  const mismatches = [];
  Object.entries(expected).forEach(([key, value]) => {
    const actual = key === 'openPageAuthConfig'
      ? parseOpenAuthConfig(after[key])
      : after[key];
    collectMismatches(value, actual, key, changedKeys, mismatches);
  });
  return {
    status,
    changedKeys,
    preservedKeys,
    canonicalFingerprints: {
      before: canonicalFingerprint(before),
      expected: canonicalFingerprint(expected),
      actual: canonicalFingerprint(after),
    },
    ...(mismatches.length > 0 ? { mismatches } : {}),
  };
}

function assertSavedConfig(params, before, after) {
  const isShareUpdate = params.openUrl.startsWith('/s/');
  const expected = isShareUpdate
    ? {
      shareUrl: params.openUrl,
      openUrl: before.openUrl,
      isOpen: before.isOpen,
    }
    : {
      openUrl: params.openUrl,
      isOpen: params.isOpen,
      shareUrl: before.shareUrl,
    };
  if (isShareUpdate && Object.prototype.hasOwnProperty.call(before, 'openPageAuthConfig')) {
    expected.openPageAuthConfig = parseOpenAuthConfig(before.openPageAuthConfig);
  } else if (!isShareUpdate) {
    expected.openPageAuthConfig = buildExpectedOpenAuthConfig(params, before);
  }
  const verification = buildVerification(params, before, expected, after);
  if (verification.mismatches) {
    verification.status = 'failed';
    throw new CliError(t('save_share_config.verify_failed', JSON.stringify(verification.mismatches)), {
      code: 'SAVE_SHARE_CONFIG_VERIFY_FAILED',
      details: { verification },
    });
  }
  return verification;
}

function assertRequestFinished(result) {
  if (result && !result.__needLogin) {
    return;
  }
  throw new CliError(t('common.request_failed_label'), {
    code: result && result.__needLogin ? 'NEED_LOGIN' : 'SAVE_SHARE_CONFIG_FAILED',
    details: {
      errorCode: result && result.errorCode || null,
      needLogin: !!(result && result.__needLogin),
    },
  });
}

async function run(args) {
  const params = parseArgs(args);
  const { appType, formUuid, openUrl, isOpen, openAuth } = params;

  warn(t('save_share_config.title'));
  warn(t('save_share_config.app_id', appType));
  warn(t('save_share_config.form_uuid', formUuid));
  warn(t('save_share_config.open_url', openUrl || t('common.empty')));
  warn(t('save_share_config.is_open', isOpen === 'y' ? t('common.yes') : t('common.no')));
  warn(t(
    'save_share_config.open_auth',
    openAuth === undefined
      ? t('save_share_config.open_auth_preserve')
      : openAuth === 'y' ? t('common.yes') : openAuth === 'n' ? t('common.no') : openAuth
  ));

  warn(t('save_share_config.step_validate'));
  try {
    validateParams({ openUrl, isOpen, openAuth });
    warn(t('save_share_config.validate_ok'));
  } catch (err) {
    throw new CliError(t('save_share_config.validate_failed', err.message), {
      code: 'SAVE_SHARE_CONFIG_INVALID_ARGUMENTS',
    });
  }

  warn(t('common.step_login_label'));
  const authRef = ensureSession();
  success(t('common.login_ready', authRef.baseUrl));

  const client = createYidaClient({ authRef });
  const before = await fetchShareConfig(client, appType, formUuid);
  const needsPreservableAuth = openUrl.startsWith('/o/')
    || before.openUrl
    || Object.prototype.hasOwnProperty.call(before, 'openPageAuthConfig');
  if (needsPreservableAuth) {
    buildExpectedOpenAuthConfig(params, before);
  }

  warn(t('save_share_config.step_save'));
  warn(t('save_share_config.sending_request'));

  const result = await client.postForm(
    `/dingtalk/web/${appType}/query/formdesign/saveShareConfig.json`,
    buildSaveParams(params, before)
  );

  assertRequestFinished(result);

  if (result.success) {
    const after = await fetchShareConfig(client, appType, formUuid);
    const verification = assertSavedConfig(params, before, after);
    const output = {
      success: true,
      verification,
      openUrl: after.openUrl || null,
      shareUrl: after.shareUrl || null,
      isOpen: after.isOpen === 'y',
      message: t('save_share_config.save_ok_msg'),
    };
    warn(t('save_share_config.save_ok'));
    console.log(JSON.stringify(output, null, 2));
    return output;
  }

  const output = {
    success: false,
    message: result.errorMsg || t('save_share_config.save_failed_msg'),
    errorCode: result.errorCode,
  };
  warn(t('save_share_config.save_failed', result.errorMsg || t('common.unknown_error')));
  console.log(JSON.stringify(output, null, 2));
  return output;
}

if (require.main === module) {
  run(process.argv.slice(2)).catch((error) => {
    fail(t('common.exception', error.message));
    process.exitCode = error && error.exitCode ? error.exitCode : 1;
  });
}

module.exports = {
  run,
  parseArgs,
  validateParams,
  normalizeShareConfig,
  canonicalFingerprint,
  parseOpenAuthConfig,
  isUninitializedPublicConfig,
  buildExpectedOpenAuthConfig,
  buildSaveParams,
  fetchShareConfig,
  buildUnknownVerification,
  buildVerification,
  assertSavedConfig,
};
