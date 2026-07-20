/**
 * get-page-config.js - 宜搭页面公开访问/分享配置查询命令
 *
 * 用法：openyida get-page-config <appType> <formUuid>
 */

'use strict';

const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { success, fail, warn } = require('../core/chalk');
const { createAuthRef, createYidaClient, isAuthRefReady } = require('../core/yida-client');

function usageMessage() {
  return [t('get_page_config.usage'), t('get_page_config.example')].join('\n');
}

function parseArgs(args) {
  if (args.length < 2) {
    throw new CliError(usageMessage(), {
      code: 'PAGE_CONFIG_INVALID_ARGUMENTS',
    });
  }
  return { appType: args[0], formUuid: args[1] };
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

function assertRequestSucceeded(result) {
  if (result && !result.__needLogin && result.success !== false) {
    return;
  }

  const errorMsg = result ? result.errorMsg || t('common.unknown_error') : t('common.request_failed');
  throw new CliError(t('get_page_config.query_failed', errorMsg), {
    code: result && result.__needLogin ? 'NEED_LOGIN' : 'PAGE_CONFIG_QUERY_FAILED',
    details: result || { success: false, errorMsg },
  });
}

async function run(args) {
  const { appType, formUuid } = parseArgs(args);

  warn(t('get_page_config.title'));
  warn(t('get_page_config.app_id', appType));
  warn(t('get_page_config.form_uuid', formUuid));

  warn(t('common.step_login_label'));
  const authRef = ensureSession();
  success(t('common.login_ready', authRef.baseUrl));

  warn(t('get_page_config.step_query'));
  warn(t('get_page_config.sending_request'));

  const shareConfig = await createYidaClient({ authRef }).postForm(
    `/dingtalk/web/${appType}/query/formdesign/getShareConfig.json`,
    {
      _api: 'Share.getShareConfig',
      _locale_time_zone_offset: '28800000',
      formUuid,
    }
  );

  assertRequestSucceeded(shareConfig);

  const content = shareConfig.content || {};
  const result = {
    isOpen: content.isOpen === 'y',
    openUrl: content.openUrl || null,
    shareUrl: content.shareUrl || null,
  };

  warn(t('get_page_config.query_ok'));

  if (result.openUrl) {warn(t('get_page_config.open_url', authRef.baseUrl + result.openUrl));}
  if (result.shareUrl) {warn(t('get_page_config.share_url', authRef.baseUrl + result.shareUrl));}
  if (!result.openUrl && !result.shareUrl) {warn(t('get_page_config.no_config'));}

  console.log(JSON.stringify(result, null, 2));
  return result;
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
};
