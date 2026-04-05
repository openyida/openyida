/**
 * update-app.js - 更新宜搭应用信息
 *
 * 用法：openyida update-app <appType> --name "新名称" [--desc "描述"] [--icon "图标"]
 */

'use strict';

const querystring = require('querystring');
const {
  loadCookieData,
  triggerLogin,
  resolveBaseUrl,
  httpPost,
  requestWithAutoLogin,
} = require('../core/utils');
const { t } = require('../core/i18n');

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
    }
  }

  return result;
}

/**
 * 打印使用帮助
 */
function printUsage() {
  console.error(t('update_app.usage'));
  console.error(t('update_app.example'));
  console.error(t('update_app.options'));
}

async function run(args) {
  const params = parseArgs(args);

  // 验证必填参数
  if (!params.appType) {
    console.error(t('update_app.missing_app_type'));
    printUsage();
    process.exit(1);
  }

  if (!params.name && !params.desc && !params.icon) {
    console.error(t('update_app.missing_update_field'));
    printUsage();
    process.exit(1);
  }

  const SEP = '='.repeat(50);
  console.error(SEP);
  console.error(t('update_app.title'));
  console.error(SEP);
  console.error(t('update_app.app_type', params.appType));
  if (params.name) {console.error(t('update_app.new_name', params.name));}
  if (params.desc) {console.error(t('update_app.new_desc', params.desc));}
  if (params.icon) {console.error(t('update_app.new_icon', params.icon, params.iconColor || '#0089FF'));}

  // Step 1: 读取登录态
  console.error(t('common.step_login', 1));
  let cookieData = loadCookieData();
  if (!cookieData) {
    console.error(t('common.login_no_cache'));
    cookieData = triggerLogin();
  }

  const authRef = {
    csrfToken: cookieData.csrf_token,
    cookies: cookieData.cookies,
    baseUrl: resolveBaseUrl(cookieData),
    cookieData,
  };
  console.error(t('common.login_ready', authRef.baseUrl));

  // Step 2: 更新应用
  console.error(t('update_app.step_update'));

  // 构建请求参数
  const postDataObj = {
    _csrf_token: authRef.csrfToken,
    _locale_time_zone_offset: '28800000',
    appType: params.appType,
  };

  // 应用名称（支持国际化）
  if (params.name) {
    postDataObj.appName = JSON.stringify({
      zh_CN: params.name,
      en_US: params.name,
      type: 'i18n',
      pureEn_US: params.name,
    });
  }

  // 应用描述
  if (params.desc) {
    postDataObj.description = JSON.stringify({
      zh_CN: params.desc,
      en_US: params.desc,
      type: 'i18n',
    });
  }

  // 图标
  if (params.icon) {
    const iconColor = params.iconColor || '#0089FF';
    const iconValue = `${params.icon}%%${iconColor}`;
    postDataObj.icon = iconValue;
    postDataObj.iconUrl = iconValue;
  }

  const postData = querystring.stringify(postDataObj);

  const response = await requestWithAutoLogin((auth) => {
    return httpPost(
      auth.baseUrl,
      `/query/app/updateAppName.json?_api=Form.updateAppName&_mock=false&_stamp=${Date.now()}`,
      postData,
      auth.cookies
    );
  }, authRef);

  // 输出结果
  const SEP2 = '='.repeat(50);
  console.error('\n' + SEP2);
  if (response && response.success) {
    console.error(t('update_app.success'));
    console.error(t('update_app.app_type_label', params.appType));
    if (params.name) {console.error(t('update_app.name_label', params.name));}
    console.error(SEP2);

    console.log(JSON.stringify({
      success: true,
      appType: params.appType,
      updatedFields: {
        name: params.name || undefined,
        desc: params.desc || undefined,
        icon: params.icon || undefined,
      },
    }));
  } else {
    const errorMsg = response ? response.errorMsg || t('common.unknown_error') : t('common.request_failed');
    console.error(t('update_app.failed', errorMsg));
    console.error(SEP2);
    console.log(JSON.stringify({ success: false, error: errorMsg }));
    process.exit(1);
  }
}

module.exports = { run };
