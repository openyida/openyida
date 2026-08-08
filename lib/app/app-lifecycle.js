/**
 * app-lifecycle.js - 启用或停用宜搭应用
 *
 * 用法：
 *   openyida app-online <appType> [--to-ding-app-center] [--show-app-center]
 *   openyida app-offline <appType> [--to-ding-app-center] [--show-app-center]
 */

'use strict';

const querystring = require('querystring');
const { httpPost, requestWithAutoLogin } = require('../core/utils');
const { createAuthRef } = require('../core/yida-client');
const { t } = require('../core/i18n');
const { throwCommandError, throwUsage } = require('../core/command-errors');

const ACTIONS = Object.freeze({
  online: Object.freeze({ endpoint: 'onlineApp', api: 'App.goOnline' }),
  offline: Object.freeze({ endpoint: 'offlineApp', api: 'App.goOffline' }),
});

function parseArgs(args = []) {
  const params = {
    appType: null,
    toDingAppCenter: false,
    showAppCenter: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      params.help = true;
    } else if (arg === '--to-ding-app-center') {
      params.toDingAppCenter = true;
    } else if (arg === '--show-app-center') {
      params.showAppCenter = true;
    } else if (!arg.startsWith('-') && !params.appType) {
      params.appType = arg;
    } else {
      throwUsage(t('app_lifecycle.invalid_argument', arg));
    }
  }

  return params;
}

function buildRequestPath(action, appType, stamp = Date.now()) {
  const config = ACTIONS[action];
  if (!config) {
    throw new Error(t('app_lifecycle.invalid_action', action));
  }
  return `/dingtalk/web/${encodeURIComponent(appType)}/query/app/${config.endpoint}.json` +
    `?_api=${encodeURIComponent(config.api)}&_mock=false&_stamp=${stamp}`;
}

function buildPostData(params, authRef) {
  return querystring.stringify({
    _csrf_token: authRef.csrfToken || '',
    _locale_time_zone_offset: '28800000',
    isToDingAppCenter: params.toDingAppCenter ? 'y' : 'n',
    showAppCenter: params.showAppCenter ? 'y' : 'n',
  });
}

async function changeAppLifecycle(action, params, authRef = createAuthRef()) {
  const response = await requestWithAutoLogin((auth) => httpPost(
    auth.baseUrl,
    buildRequestPath(action, params.appType),
    buildPostData(params, auth),
    auth.cookies
  ), authRef);

  if (!response || response.success !== true || response.content !== true) {
    const errorMsg = response && (response.errorMsg || response.message || response.errorCode);
    throwCommandError(errorMsg || t('app_lifecycle.request_failed'), {
      code: action === 'online' ? 'APP_ONLINE_FAILED' : 'APP_OFFLINE_FAILED',
      details: { action, appType: params.appType },
    });
  }

  return {
    success: true,
    action,
    appType: params.appType,
    isToDingAppCenter: params.toDingAppCenter,
    showAppCenter: params.showAppCenter,
  };
}

function printUsage(action) {
  const { usage } = require('../core/chalk');
  usage(t(`app_lifecycle.${action}_usage`), t(`app_lifecycle.${action}_example`));
}

async function run(action, args = []) {
  if (!ACTIONS[action]) {
    throwCommandError(t('app_lifecycle.invalid_action', action), {
      code: 'APP_LIFECYCLE_INVALID_ACTION',
    });
  }

  const params = parseArgs(args);
  if (params.help) {
    printUsage(action);
    return { success: true, help: true };
  }
  if (!params.appType) {
    printUsage(action);
    throwUsage(t('app_lifecycle.missing_app_type'), t(`app_lifecycle.${action}_usage`), {
      code: 'APP_LIFECYCLE_USAGE',
    });
  }

  const output = await changeAppLifecycle(action, params);
  const { result } = require('../core/chalk');
  result(true, t(`app_lifecycle.${action}_success`), [['appType', params.appType]]);
  console.log(JSON.stringify(output));
  return output;
}

module.exports = {
  ACTIONS,
  buildPostData,
  buildRequestPath,
  changeAppLifecycle,
  parseArgs,
  run,
};
