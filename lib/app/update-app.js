/**
 * update-app.js - 更新宜搭应用信息
 *
 * 用法：openyida update-app <appType> --name "新名称" [--desc "描述"] [--icon "图标"] [--layout slide|ver]
 */

'use strict';

const querystring = require('querystring');
const {
  httpGet,
  httpPost,
  requestWithAutoLogin,
} = require('../core/utils');
const { createAuthRef } = require('../core/yida-client');
const { t } = require('../core/i18n');
const { buildYidaI18n } = require('../core/yida-i18n');
const { throwCommandError, throwUsage } = require('../core/command-errors');
const { assertPresetThemeKey } = require('./theme-presets');

/**
 * 解析命令行参数
 * @param {string[]} args 命令行参数
 * @returns {Object} 解析后的参数对象
 */
function parseArgs(args) {
  const result = {
    appType: null,
    name: null,
    desc: null,
    icon: null,
    iconColor: null,
    colour: null,
    navTheme: null,
    layoutDirection: null,
  };

  // 第一个参数是 appType
  if (args.length < 1) {
    return result;
  }
  result.appType = args[0];

  // 解析选项参数
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--name':
      case '-n':
        if (nextArg) {
          result.name = nextArg;
          i++;
        }
        break;
      case '--desc':
      case '-d':
        if (nextArg) {
          result.desc = nextArg;
          i++;
        }
        break;
      case '--icon':
        if (nextArg) {
          result.icon = nextArg;
          i++;
        }
        break;
      case '--icon-color':
        if (nextArg) {
          result.iconColor = nextArg;
          i++;
        }
        break;
      case '--theme':
      case '--colour':
        if (nextArg) {
          result.colour = nextArg;
          i++;
        }
        break;
      case '--nav-theme':
      case '--navTheme':
        if (nextArg) {
          result.navTheme = nextArg;
          i++;
        }
        break;
      case '--layout':
      case '--layout-direction':
      case '--layoutDirection':
        if (nextArg) {
          result.layoutDirection = nextArg;
          i++;
        }
        break;
    }
  }

  return result;
}

/**
 * 打印使用帮助
 */
function printUsage() {
  const { usage } = require('../core/chalk');
  usage(t('update_app.usage'), t('update_app.example'));
  process.stderr.write(`  ${t('update_app.options')}\n`);
}

function hasShellUpdate(params) {
  return !!(params.icon || params.colour || params.navTheme || params.layoutDirection);
}

function pickText(value, fallback) {
  if (!value) {return fallback || '';}
  if (typeof value === 'string') {return value;}
  return value.zh_CN || value.value || value.en_US || fallback || '';
}

function normalizeI18nJson(value, fallback, options = {}) {
  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }
  const text = value || fallback || '';
  return JSON.stringify(buildYidaI18n(text, {
    en_US: text,
    ja_JP: text,
  }, options));
}

function buildUpdateAppNamePostData(params, authRef) {
  const postDataObj = {
    _csrf_token: authRef.csrfToken,
    _locale_time_zone_offset: '28800000',
    appType: params.appType,
  };

  if (params.name) {
    postDataObj.appName = JSON.stringify(buildYidaI18n(params.name, {
      en_US: params.name,
      ja_JP: params.name,
    }, { includePureEn: true }));
  }

  if (params.desc) {
    postDataObj.description = JSON.stringify(buildYidaI18n(params.desc, {
      en_US: params.desc,
      ja_JP: params.desc,
    }));
  }

  return postDataObj;
}

function buildUpdateAppPostData(params, currentApp = {}, authRef) {
  const appName = params.name || pickText(currentApp.appName, params.appType);
  const description = params.desc || pickText(currentApp.description, appName);
  const icon = params.icon
    ? `${params.icon}%%${params.iconColor || '#0089FF'}`
    : (currentApp.icon || currentApp.iconUrl || 'xian-yingyong%%#0089FF');

  return {
    _csrf_token: authRef.csrfToken,
    _locale_time_zone_offset: '28800000',
    appType: params.appType,
    appKey: params.appType,
    appName: params.name
      ? normalizeI18nJson(params.name, appName, { includePureEn: true })
      : normalizeI18nJson(currentApp.appName, appName, { includePureEn: true }),
    description: params.desc
      ? normalizeI18nJson(params.desc, description)
      : normalizeI18nJson(currentApp.description, description),
    icon,
    iconUrl: icon,
    colour: params.colour || currentApp.colour || (currentApp.config && currentApp.config.COLOUR) || 'deepBlue',
    // updateApp 的报错文案叫 appMode，但实际接受的请求字段是 mode。
    mode: currentApp.mode || (currentApp.config && currentApp.config.APPMODE) || 'normal',
    type: currentApp.type || (currentApp.config && currentApp.config.APPTYPE) || 'single',
    navTheme: params.navTheme || currentApp.navTheme || (currentApp.config && currentApp.config.NAV_THEME) || 'light',
    navType: currentApp.navType || (currentApp.config && currentApp.config.NAVTYPE) || 'top_side',
    navLayout: currentApp.navLayout || (currentApp.config && currentApp.config.NAVLAYOUT) || 'auto',
    layoutDirection: params.layoutDirection || currentApp.layoutDirection || (currentApp.config && currentApp.config.LAY_OUT_DIRECTION) || 'ver',
    showIcon: currentApp.showIcon || (currentApp.config && currentApp.config.SHOWICON) || 'n',
    showNav: currentApp.showNav || (currentApp.config && currentApp.config.SHOWNAV) || 'y',
    showCrumb: currentApp.showCrumb || (currentApp.config && currentApp.config.SHOWCRUMB) || 'y',
    showAppCenter: currentApp.showAppCenter || (currentApp.config && currentApp.config.SHOWAPPCENTER) || 'n',
    deviceType: currentApp.deviceType || (currentApp.config && currentApp.config.DEVICETYPE) || 'web,mobile',
    detailLayout: currentApp.detailLayout || (currentApp.config && currentApp.config.DETAIL_LAYOUT) || 'vertical',
    procOperateRecordLayout: currentApp.procOperateRecordLayout || (currentApp.config && currentApp.config.PROC_OPERATERECORD_LAYOUT) || 'merge',
    navigation: currentApp.navigation || (currentApp.config && currentApp.config.NAVIGATION) || 'TODO,DONE,SUBMIT',
    pageHeader: currentApp.pageHeader || '',
    pageFooter: currentApp.pageFooter || '',
    addWaterMark: currentApp.addWaterMark || (currentApp.config && currentApp.config.ADDWATERMARK) || 'y',
    sentryMode: currentApp.sentryMode || (currentApp.config && currentApp.config.SENTRY_MODE) || 'y',
  };
}

async function fetchCurrentApp(appType, authRef) {
  const response = await requestWithAutoLogin((auth) => httpGet(
    auth.baseUrl,
    `/${appType}/query/app/getAppIncludingAecpInfo.json`,
    {
      _api: 'nattyFetch',
      _mock: 'false',
      appKey: appType,
      _csrf_token: auth.csrfToken,
      _stamp: Date.now(),
    }
  ), authRef);

  if (!response || !response.success) {
    throw new Error(response ? response.errorMsg || '查询应用详情失败' : '查询应用详情失败');
  }
  return response.content || {};
}

async function run(args) {
  const params = parseArgs(args || []);

  // 验证必填参数
  const { c, banner, step, label, warn, success: chalkSuccess, result: chalkResult, error: chalkError } = require('../core/chalk');

  if (!params.appType) {
    chalkError(t('update_app.missing_app_type'), { exit: false });
    printUsage();
    throwUsage(t('update_app.missing_app_type'), t('update_app.usage'));
  }

  if (!params.name && !params.desc && !params.icon && !params.colour && !params.navTheme && !params.layoutDirection) {
    chalkError(t('update_app.missing_update_field'), { exit: false });
    printUsage();
    throwUsage(t('update_app.missing_update_field'), t('update_app.usage'));
  }
  assertPresetThemeKey(params.colour);

  banner(t('update_app.title'));
  label('App', params.appType);
  if (params.name) {label('Name', params.name);}
  if (params.desc) {label('Desc', params.desc);}
  if (params.icon) {label('Icon', `${params.icon} ${c.dim}(${params.iconColor || '#0089FF'})${c.reset}`);}
  if (params.colour || params.navTheme || params.layoutDirection) {
    label('Theme', `${params.colour || '-'} / ${params.navTheme || '-'} / ${params.layoutDirection || '-'}`);
  }

  // Step 1: 读取登录态
  step(1, t('common.step_login', 1));
  const authRef = createAuthRef();
  chalkSuccess(t('common.login_ready', authRef.baseUrl));

  // Step 2: 更新应用
  step(2, t('update_app.step_update'));

  const shellUpdate = hasShellUpdate(params);
  if (params.layoutDirection) {
    warn(t('update_app.layout_notice'));
  }

  const currentApp = shellUpdate ? await fetchCurrentApp(params.appType, authRef) : null;
  const requestPath = shellUpdate
    ? `/${params.appType}/query/app/updateApp.json?_api=Form.updateApp&_mock=false&_stamp=${Date.now()}`
    : `/query/app/updateAppName.json?_api=Form.updateAppName&_mock=false&_stamp=${Date.now()}`;

  const response = await requestWithAutoLogin((auth) => {
    const postDataObj = shellUpdate
      ? buildUpdateAppPostData(params, currentApp, auth)
      : buildUpdateAppNamePostData(params, auth);
    const postData = querystring.stringify(postDataObj);
    return httpPost(
      auth.baseUrl,
      requestPath,
      postData
    );
  }, authRef);

  // 输出结果
  if (response && response.success) {
    const details = [['appType', params.appType]];
    if (params.name) {details.push(['Name', params.name]);}
    chalkResult(true, t('update_app.success'), details);

    console.log(JSON.stringify({
      success: true,
      appType: params.appType,
      updatedFields: {
        name: params.name || undefined,
        desc: params.desc || undefined,
        icon: params.icon || undefined,
        colour: params.colour || undefined,
        navTheme: params.navTheme || undefined,
        layoutDirection: params.layoutDirection || undefined,
      },
    }));
  } else {
    const errorMsg = response ? response.errorMsg || t('common.unknown_error') : t('common.request_failed');
    chalkResult(false, t('update_app.failed', errorMsg));
    console.log(JSON.stringify({ success: false, error: errorMsg }));
    throwCommandError(errorMsg);
  }
}

module.exports = {
  run,
  parseArgs,
  hasShellUpdate,
  buildUpdateAppNamePostData,
  buildUpdateAppPostData,
};
