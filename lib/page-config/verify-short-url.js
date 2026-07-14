/**
 * verify-short-url.js - 宜搭公开访问/分享 URL 验证命令
 *
 * 用法：openyida verify-short-url <appType> <formUuid> <url>
 */

'use strict';

const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { success, fail, warn } = require('../core/chalk');
const { createAuthRef, createYidaClient, isAuthRefReady } = require('../core/yida-client');

function usageMessage() {
  return [
    t('verify_short_url.usage'),
    t('verify_short_url.example'),
    t('verify_short_url.formats_label'),
    t('verify_short_url.format_open'),
    t('verify_short_url.format_share'),
  ].join('\n');
}

function getUrlType(url) {
  if (url.startsWith('/o/')) {return 'open';}
  if (url.startsWith('/s/')) {return 'share';}
  return null;
}

function parseArgs(args) {
  if (args.length < 3) {
    throw new CliError(usageMessage(), {
      code: 'VERIFY_SHORT_URL_INVALID_ARGUMENTS',
    });
  }
  const url = args[2];
  return {
    appType: args[0],
    formUuid: args[1],
    url,
    urlType: getUrlType(url),
  };
}

/**
 * 验证 URL 格式
 * - /o/xxx - 公开访问（对外）
 * - /s/xxx - 组织内分享（对内）
 */
function validateUrl(url, urlType) {
  if (!urlType) {
    throw new Error(t('verify_short_url.err_url_prefix', url));
  }
  const pathPart = url.slice(3);
  if (pathPart.length === 0) {
    throw new Error(t('verify_short_url.err_url_empty', url));
  }
  if (!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(pathPart)) {
    throw new Error(t('verify_short_url.err_url_chars', url));
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

function assertRequestFinished(result) {
  if (result && !result.__needLogin && !result.__csrfExpired) {
    return;
  }
  throw new CliError(t('verify_short_url.verify_failed'), {
    code: result && result.__needLogin ? 'NEED_LOGIN' : 'VERIFY_SHORT_URL_FAILED',
    details: result || { success: false, errorMsg: t('common.request_failed') },
  });
}

async function run(args) {
  const { appType, formUuid, url, urlType } = parseArgs(args);
  const urlLabel = urlType === 'open' ? t('verify_short_url.open_url_label') : t('verify_short_url.share_url_label');

  warn(t('verify_short_url.title'));
  warn(t('verify_short_url.app_id', appType));
  warn(t('verify_short_url.form_uuid', formUuid));
  warn('  ' + urlLabel + ': ' + url);

  warn(t('verify_short_url.step_validate'));
  try {
    validateUrl(url, urlType);
    warn(t('verify_short_url.validate_ok'));
  } catch (err) {
    throw new CliError(t('verify_short_url.validate_failed', err.message), {
      code: 'VERIFY_SHORT_URL_INVALID_ARGUMENTS',
    });
  }

  warn(t('common.step_login_label'));
  const authRef = ensureSession();
  success(t('common.login_ready', authRef.baseUrl));

  warn(t('verify_short_url.step_verify'));
  warn(t('verify_short_url.sending_request'));

  const result = await createYidaClient({ authRef }).get(
    `/dingtalk/web/${appType}/query/formdesign/verifyShortUrl.json`,
    auth => {
      const requestParams = {
        _api: 'App.verifyShortUrlForm',
        formUuid,
        _csrf_token: auth.csrfToken,
        _locale_time_zone_offset: '28800000',
        _stamp: Date.now().toString(),
      };
      if (urlType === 'open') {
        requestParams.openUrl = url;
      } else {
        requestParams.shareUrl = url;
      }
      return requestParams;
    }
  );

  assertRequestFinished(result);

  const output = result.success && result.content
    ? {
      available: true,
      url,
      urlType,
      message: urlType === 'open' ? t('verify_short_url.open_available_msg') : t('verify_short_url.share_available_msg'),
    }
    : {
      available: false,
      url,
      urlType,
      message: result.errorMsg || t('verify_short_url.url_taken_msg'),
      errorCode: result.errorCode,
    };

  warn(output.available ? t('verify_short_url.url_available') : t('verify_short_url.url_taken'));
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
  validateUrl,
};
