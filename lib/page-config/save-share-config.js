/**
 * save-share-config.js - 宜搭页面公开访问/分享配置保存命令
 *
 * 用法：openyida save-share-config <appType> <formUuid> <url> <isOpen> [openAuth]
 */

'use strict';

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
    openAuth: args[4] || 'n',
  };
}

function validateParams(params) {
  if (params.isOpen !== 'y' && params.isOpen !== 'n') {
    throw new Error(t('save_share_config.err_is_open_invalid', params.isOpen));
  }
  if (params.openAuth !== 'y' && params.openAuth !== 'n') {
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

function serializeOpenAuthConfig(value, fallbackOpenAuth = 'n') {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return JSON.stringify({
    openAuth: fallbackOpenAuth,
    authSources: [],
  });
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
    payload.openPageAuthConfig = serializeOpenAuthConfig(current.openPageAuthConfig);
  }

  if (params.openUrl.startsWith('/s/')) {
    payload.shareUrl = params.openUrl;
  } else {
    payload.openUrl = params.openUrl;
    payload.isOpen = params.isOpen;
    payload.openPageAuthConfig = serializeOpenAuthConfig(null, params.openAuth);
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
      details: result || { success: false, errorMsg },
    });
  }
  return normalizeShareConfig(result.content || {});
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
    expected.openPageAuthConfig = before.openPageAuthConfig;
  }
  const mismatches = Object.entries(expected)
    .filter(([key, value]) => {
      if (key === 'openPageAuthConfig') {
        if (!Object.prototype.hasOwnProperty.call(after, key)) {
          return true;
        }
        return serializeOpenAuthConfig(after[key]) !== serializeOpenAuthConfig(value);
      }
      return after[key] !== value;
    })
    .map(([key, value]) => ({ key, expected: value, actual: after[key] }));
  if (mismatches.length > 0) {
    throw new CliError(t('save_share_config.verify_failed', JSON.stringify(mismatches)), {
      code: 'SAVE_SHARE_CONFIG_VERIFY_FAILED',
      details: { before, expected, actual: after, mismatches },
    });
  }
  return expected;
}

function assertRequestFinished(result) {
  if (result && !result.__needLogin) {
    return;
  }
  throw new CliError(t('common.request_failed_label'), {
    code: result && result.__needLogin ? 'NEED_LOGIN' : 'SAVE_SHARE_CONFIG_FAILED',
    details: result || { success: false, errorMsg: t('common.request_failed') },
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
  warn(t('save_share_config.open_auth', openAuth === 'y' ? t('common.yes') : t('common.no')));

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
  if (openUrl.startsWith('/s/') && before.openUrl && !Object.prototype.hasOwnProperty.call(before, 'openPageAuthConfig')) {
    throw new CliError(t('save_share_config.current_state_incomplete'), {
      code: 'SAVE_SHARE_CONFIG_CURRENT_STATE_INCOMPLETE',
      details: { before },
    });
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
    const expected = assertSavedConfig(params, before, after);
    const output = {
      success: true,
      before,
      after,
      expected,
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
  buildSaveParams,
  fetchShareConfig,
  assertSavedConfig,
};
