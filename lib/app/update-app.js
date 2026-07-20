/**
 * update-app.js - 更新宜搭应用信息
 *
 * 用法：openyida update-app <appType> --name "新名称" [--desc "描述"] [--icon "图标"] [--layout slide|ver]
 */

'use strict';

const {
  loadCookieData,
  triggerLogin,
  resolveBaseUrl,
} = require('../core/utils');
const { t } = require('../core/i18n');
const { updateAppResource } = require('./services/app-service');

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

async function run(args) {
  const params = parseArgs(args);

  // 验证必填参数
  const { c, banner, step, label, info, warn, success: chalkSuccess, result: chalkResult, error: chalkError } = require('../core/chalk');

  if (!params.appType) {
    chalkError(t('update_app.missing_app_type'), { exit: false });
    printUsage();
    process.exit(1);
  }

  if (!params.name && !params.desc && !params.icon && !params.colour && !params.navTheme && !params.layoutDirection) {
    chalkError(t('update_app.missing_update_field'), { exit: false });
    printUsage();
    process.exit(1);
  }

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
  let cookieData = loadCookieData();
  if (!cookieData) {
    info(t('common.login_no_cache'));
    cookieData = triggerLogin();
  }

  const authRef = {
    csrfToken: cookieData.csrf_token,
    cookies: cookieData.cookies,
    baseUrl: resolveBaseUrl(cookieData),
    cookieData,
  };
  chalkSuccess(t('common.login_ready', authRef.baseUrl));

  // Step 2: 更新应用
  step(2, t('update_app.step_update'));

  if (params.layoutDirection) {
    warn(t('update_app.layout_notice'));
  }
  let response;
  try {
    const updated = await updateAppResource(authRef, params);
    response = updated.response;
  } catch (error) {
    if (!error || error.code !== 'APP_UPDATE_FAILED') {
      throw error;
    }
    response = error.details && error.details.result;
  }

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
    process.exit(1);
  }
}

module.exports = { run };
