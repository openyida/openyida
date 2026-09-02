/**
 * update-app.js - 更新宜搭应用信息
 *
 * 用法：openyida update-app <appType> --name "新名称" [--theme-file ./theme.css] [--nav-theme light] [--logo-source appIcon] [--layout side]
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
const {
  buildCustomThemeStyle,
  normalizeCssColorToHex,
  normalizeThemeColor,
  readThemeCssFile,
  uploadCustomThemeFile,
} = require('./custom-theme');

const SUPPORTED_NAV_THEMES = ['light', 'dark', 'white', 'gray'];
const SUPPORTED_LOGO_SOURCES = ['appIcon', 'customImage'];
const SUPPORTED_LAYOUT_DIRECTIONS = ['side', 'top', 'l_shape'];
const LEGACY_LAYOUT_DIRECTION_MAP = {
  slide: 'side',
  ver: 'side',
  hoz: 'top',
};
const APP_ICON_VALUE_SEPARATOR = '%%';
const DEFAULT_APP_ICON_NAME = 'xian-yingyong';

function isImageAppIcon(icon) {
  return /^(https?:)?\/\//.test(String(icon || '')) || /^data:image\//.test(String(icon || ''));
}

/** 与新版 ThemeNavSetting 一致：系统图标跟随主题色，图片图标保持原值。 */
function syncSystemIconColor(icon, themeColor) {
  const currentIcon = String(icon || '');
  if (isImageAppIcon(currentIcon)) {return currentIcon;}
  const [iconName = DEFAULT_APP_ICON_NAME] = currentIcon.split(APP_ICON_VALUE_SEPARATOR);
  const iconColor = normalizeCssColorToHex(themeColor);
  if (!iconColor) {
    throw new Error(`应用主题色无法转换为图标颜色: ${themeColor}`);
  }
  return `${iconName || DEFAULT_APP_ICON_NAME}${APP_ICON_VALUE_SEPARATOR}${iconColor}`;
}

function resolveAppIcon(params, currentApp) {
  const currentIcon = currentApp.icon || currentApp.iconUrl || `${DEFAULT_APP_ICON_NAME}%%#0089FF`;
  let icon = currentIcon;
  if (params.icon) {
    icon = isImageAppIcon(params.icon)
      ? params.icon
      : `${String(params.icon).split(APP_ICON_VALUE_SEPARATOR)[0]}%%${params.iconColor || '#0089FF'}`;
  }
  return params.themeFile && params.themeColor
    ? syncSystemIconColor(icon, params.themeColor)
    : icon;
}

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
    themeColor: null,
    themeFile: null,
    customThemeStyle: null,
    navTheme: null,
    logoSource: null,
    layoutDirection: null,
    hideAppNav: null,
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
      case '--theme-color':
      case '--themeColor':
        if (nextArg) {
          result.themeColor = nextArg;
          i++;
        }
        break;
      case '--theme-file':
      case '--custom-theme-file':
        if (nextArg) {
          result.themeFile = nextArg;
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
      case '--logo-source':
      case '--logoSource':
        if (nextArg) {
          result.logoSource = nextArg;
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
      case '--hide-app-nav':
        result.hideAppNav = 'y';
        break;
      case '--show-app-nav':
        result.hideAppNav = 'n';
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
  return !!(
    params.icon ||
    params.colour ||
    params.themeColor ||
    params.themeFile ||
    params.navTheme ||
    params.logoSource ||
    params.layoutDirection ||
    params.hideAppNav !== null
  );
}

function assertNavTheme(navTheme) {
  if (!navTheme || SUPPORTED_NAV_THEMES.includes(navTheme)) {return;}
  throw new Error(`Unsupported nav theme: ${navTheme}. Use one of: ${SUPPORTED_NAV_THEMES.join(', ')}.`);
}

function assertLogoSource(logoSource) {
  if (!logoSource || SUPPORTED_LOGO_SOURCES.includes(logoSource)) {return;}
  throw new Error(`Unsupported logo source: ${logoSource}. Use one of: ${SUPPORTED_LOGO_SOURCES.join(', ')}.`);
}

function normalizeLayoutDirection(layoutDirection) {
  if (!layoutDirection) {return null;}
  const normalized = LEGACY_LAYOUT_DIRECTION_MAP[layoutDirection] || layoutDirection;
  if (!SUPPORTED_LAYOUT_DIRECTIONS.includes(normalized)) {
    throw new Error(`Unsupported layout direction: ${layoutDirection}. Use one of: ${SUPPORTED_LAYOUT_DIRECTIONS.join(', ')}.`);
  }
  return normalized;
}

function pickAppField(currentApp, fieldName, configName) {
  if (currentApp[fieldName] !== undefined && currentApp[fieldName] !== null) {
    return currentApp[fieldName];
  }
  return currentApp.config && currentApp.config[configName];
}

function mergeOwners(owners) {
  if (typeof owners === 'string') {return owners;}
  if (!Array.isArray(owners)) {return '';}
  return owners
    .map((owner) => owner && (owner.emplId || owner.userId || owner.key))
    .filter(Boolean)
    .join(',');
}

function serializeCustomThemeStyle(value) {
  if (!value) {return null;}
  return typeof value === 'string' ? value : JSON.stringify(value);
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
  const icon = resolveAppIcon(params, currentApp);

  const currentThemeColor = pickAppField(currentApp, 'themeColor', 'THEME_COLOR');
  const currentCustomThemeStyle = pickAppField(currentApp, 'customThemeStyle', 'CUSTOM_THEME_STYLE');
  const postDataObj = {
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
    colour: params.customThemeStyle || params.themeColor
      ? 'custom'
      : (params.colour || currentApp.colour || (currentApp.config && currentApp.config.COLOUR) || 'deepBlue'),
    // updateApp 的报错文案叫 appMode，但实际接受的请求字段是 mode。
    mode: currentApp.mode || (currentApp.config && currentApp.config.APPMODE) || 'normal',
    type: currentApp.type || (currentApp.config && currentApp.config.APPTYPE) || 'single',
    navTheme: params.navTheme || currentApp.navTheme || (currentApp.config && currentApp.config.NAV_THEME) || 'light',
    navType: currentApp.navType || (currentApp.config && currentApp.config.NAVTYPE) || 'top_side',
    navLayout: currentApp.navLayout || (currentApp.config && currentApp.config.NAVLAYOUT) || 'auto',
    layoutDirection: params.layoutDirection || currentApp.layoutDirection || (currentApp.config && currentApp.config.LAY_OUT_DIRECTION) || 'side',
    homepageLogo: currentApp.homepageLogo || (currentApp.config && currentApp.config.HOMEPAGELOGO) || '',
    logoSource: params.logoSource || currentApp.logoSource || (currentApp.config && currentApp.config.LOGO_SOURCE) || 'appIcon',
    logoLink: currentApp.logoLink || (currentApp.config && currentApp.config.LOGOLINK) || '',
    systemLink: currentApp.systemLink || (currentApp.config && currentApp.config.SYSTEMLINK) || '',
    showAppTitle: currentApp.showAppTitle || (currentApp.config && currentApp.config.SHOWAPPTITLE) || '',
    mainManagers: mergeOwners(
      Array.isArray(currentApp.managers) && currentApp.managers.length
        ? currentApp.managers
        : currentApp.mainManagers
    ),
    dataManagers: mergeOwners(currentApp.dataManagers),
    devManagers: mergeOwners(currentApp.devManagers),
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

  if (params.hideAppNav !== null) {
    postDataObj.hideAppNav = params.hideAppNav;
  }
  if (params.themeColor) {
    postDataObj.themeColor = params.themeColor;
  } else if (params.colour) {
    postDataObj.themeColor = '';
  } else if (currentThemeColor !== undefined && currentThemeColor !== null) {
    postDataObj.themeColor = currentThemeColor;
  }

  if (params.colour && !params.customThemeStyle) {
    // 切回平台预置主题时必须清空旧 CSS，避免 CUSTOM_THEME_STYLE 继续覆盖 colour。
    postDataObj.customThemeStyle = '';
  } else {
    const customThemeStyle = serializeCustomThemeStyle(params.customThemeStyle || currentCustomThemeStyle);
    if (customThemeStyle) {
      postDataObj.customThemeStyle = customThemeStyle;
    }
  }

  return postDataObj;
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

async function applyCustomThemeUpdate(appType, themeParams, authRef) {
  const params = {
    ...themeParams,
    appType,
    navTheme: themeParams.navTheme || 'light',
    logoSource: themeParams.logoSource || 'appIcon',
    layoutDirection: normalizeLayoutDirection(themeParams.layoutDirection || 'side'),
  };
  assertNavTheme(params.navTheme);
  assertLogoSource(params.logoSource);

  const themeFile = readThemeCssFile(params.themeFile);
  params.themeColor = themeFile.themeColor;
  const currentApp = await fetchCurrentApp(appType, authRef);
  const uploadResponse = await requestWithAutoLogin(
    (auth) => uploadCustomThemeFile(appType, params.themeFile, auth),
    authRef
  );
  params.customThemeStyle = buildCustomThemeStyle(uploadResponse);

  return requestWithAutoLogin((auth) => {
    const requestPath = `/${appType}/query/app/updateApp.json?_api=Form.updateApp&_mock=false&_stamp=${Date.now()}`;
    return httpPost(
      auth.baseUrl,
      requestPath,
      querystring.stringify(buildUpdateAppPostData(params, currentApp, auth))
    );
  }, authRef);
}

async function run(args) {
  if ((args || []).includes('--help') || (args || []).includes('-h')) {
    printUsage();
    return;
  }
  const params = parseArgs(args || []);

  // 验证必填参数
  const { c, banner, step, label, warn, success: chalkSuccess, result: chalkResult, error: chalkError } = require('../core/chalk');

  if (!params.appType) {
    chalkError(t('update_app.missing_app_type'), { exit: false });
    printUsage();
    throwUsage(t('update_app.missing_app_type'), t('update_app.usage'));
  }

  if (
    !params.name &&
    !params.desc &&
    !params.icon &&
    !params.colour &&
    !params.themeColor &&
    !params.themeFile &&
    !params.navTheme &&
    !params.logoSource &&
    !params.layoutDirection &&
    params.hideAppNav === null
  ) {
    chalkError(t('update_app.missing_update_field'), { exit: false });
    printUsage();
    throwUsage(t('update_app.missing_update_field'), t('update_app.usage'));
  }
  assertPresetThemeKey(params.colour);
  params.themeColor = normalizeThemeColor(params.themeColor);
  assertNavTheme(params.navTheme);
  assertLogoSource(params.logoSource);
  params.layoutDirection = normalizeLayoutDirection(params.layoutDirection);
  if (params.themeFile) {
    // 自定义主题文件是主色唯一来源，避免命令参数和 CSS token 漂移。
    params.themeColor = readThemeCssFile(params.themeFile).themeColor;
  }

  banner(t('update_app.title'));
  label('App', params.appType);
  if (params.name) {label('Name', params.name);}
  if (params.desc) {label('Desc', params.desc);}
  if (params.icon) {label('Icon', `${params.icon} ${c.dim}(${params.iconColor || '#0089FF'})${c.reset}`);}
  if (params.colour || params.themeColor || params.themeFile || params.navTheme || params.logoSource || params.layoutDirection) {
    label('Theme', `${params.colour || params.themeColor || '-'} / ${params.navTheme || '-'} / ${params.logoSource || '-'} / ${params.layoutDirection || '-'}`);
  }
  if (params.themeFile) {
    label('Theme CSS', params.themeFile);
  }
  if (params.hideAppNav !== null) {
    label('Hide App Nav', params.hideAppNav);
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
  if (params.themeFile) {
    const uploadResponse = await requestWithAutoLogin(
      (auth) => uploadCustomThemeFile(params.appType, params.themeFile, auth),
      authRef
    );
    params.customThemeStyle = buildCustomThemeStyle(uploadResponse);
  }
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
        themeColor: params.themeColor || undefined,
        themeFile: params.themeFile || undefined,
        navTheme: params.navTheme || undefined,
        logoSource: params.logoSource || undefined,
        layoutDirection: params.layoutDirection || undefined,
        hideAppNav: params.hideAppNav === null ? undefined : params.hideAppNav,
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
  normalizeThemeColor,
  assertNavTheme,
  assertLogoSource,
  normalizeLayoutDirection,
  syncSystemIconColor,
  applyCustomThemeUpdate,
};
