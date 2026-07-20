/**
 * create-app.js - 宜搭应用创建命令
 *
 * 用法：openyida create-app "<appName>" [description] [icon] [iconColor] [colour] [navTheme] [layoutDirection]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  loadCookieData,
  triggerLogin,
  resolveBaseUrl,
} = require('../core/utils');
const { t } = require('../core/i18n');
const { normalizeYidaLocale, resolveContentLocale } = require('../core/yida-i18n');
const { parseOpenOption, withBrowserHandoff } = require('../core/browser-handoff');
const {
  assertLegacyDirectWriteAllowed,
  extractLegacyGuardArgs,
} = require('../core/legacy-schema-guard');
const { createAppResource } = require('./services/app-service');

const DEFAULT_APP_OPTIONS = {
  icon: 'xian-yingyong',
  iconColor: '#0089FF',
  colour: 'deepBlue',
  navTheme: 'dark',
  layoutDirection: 'slide',
};

// ── prd 文档更新 ──────────────────────────────────────

function findPrdFile() {
  let currentDir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const prdDir = path.join(currentDir, 'prd');
    if (fs.existsSync(prdDir)) {
      const files = fs.readdirSync(prdDir);
      const mdFile = files.find((f) => f.endsWith('.md'));
      if (mdFile) {return path.join(prdDir, mdFile);}
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {break;}
    currentDir = parentDir;
  }
  return null;
}

function updatePrdCorpId(prdFilePath, corpId, appType, baseUrl) {
  if (!prdFilePath || !fs.existsSync(prdFilePath)) {
    const { warn: chalkWarn } = require('../core/chalk');
    chalkWarn(t('create_app.prd_not_found'));
    return false;
  }

  try {
    let content = fs.readFileSync(prdFilePath, 'utf-8');
    const hasAppConfig = content.includes('## 应用配置') || content.includes('## App Config') || content.includes('## アプリ設定') || content.includes('| appType |');

    if (hasAppConfig) {
      const corpIdRegex = /[|] corpId [|] [^|]*[|]/;
      if (corpIdRegex.test(content)) {
        content = content.replace(corpIdRegex, `| corpId | ${corpId} |`);
      } else {
        content = content.replace(
          /([|] appType [|] [^|]*[|])(\r?\n)/,
          `$1$2| corpId | ${corpId} |$2`
        );
      }
      content = content.replace(/[|] appType [|] [^|]*[|]/, `| appType | ${appType} |`);
      content = content.replace(/[|] baseUrl [|] [^|]*[|]/, `| baseUrl | ${baseUrl} |`);
    } else {
      const appConfigSection = `${t('create_app.prd_config_title')}\n\n| ${t('create_app.prd_config_key')} | ${t('create_app.prd_config_value')} |\n| --- | --- |\n| appType | ${appType} |\n| corpId | ${corpId} |\n| baseUrl | ${baseUrl} |\n\n`;
      if (content.startsWith('#')) {
        content = content.replace(/^(# .*\r?\n)/, `$1\n${appConfigSection}`);
      } else {
        content = appConfigSection + content;
      }
    }

    fs.writeFileSync(prdFilePath, content, 'utf-8');
    const { success: prdSuccess } = require('../core/chalk');
    prdSuccess(t('create_app.prd_updated', path.basename(prdFilePath)));
    return true;
  } catch (err) {
    const { warn: prdWarn } = require('../core/chalk');
    prdWarn(t('create_app.prd_update_failed', err.message));
    return false;
  }
}

// ── 主逻辑 ────────────────────────────────────────────

function hasHelpFlag(args) {
  return (args || []).includes('--help') || (args || []).includes('-h');
}

function readOptionValue(args, index, optionName) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${optionName} requires a value`);
  }
  return value;
}

function parseCreateAppArgs(args) {
  const params = {
    appName: null,
    description: null,
    icon: null,
    iconColor: null,
    colour: null,
    navTheme: null,
    layoutDirection: null,
    locale: null,
  };
  const positional = [];

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    switch (arg) {
      case '--name':
      case '-n':
        params.appName = readOptionValue(args, index, arg);
        index++;
        break;
      case '--desc':
      case '--description':
      case '-d':
        params.description = readOptionValue(args, index, arg);
        index++;
        break;
      case '--icon':
        params.icon = readOptionValue(args, index, arg);
        index++;
        break;
      case '--icon-color':
      case '--iconColor':
        params.iconColor = readOptionValue(args, index, arg);
        index++;
        break;
      case '--theme':
      case '--colour':
        params.colour = readOptionValue(args, index, arg);
        index++;
        break;
      case '--nav-theme':
      case '--navTheme':
        params.navTheme = readOptionValue(args, index, arg);
        index++;
        break;
      case '--layout':
      case '--layout-direction':
      case '--layoutDirection':
        params.layoutDirection = readOptionValue(args, index, arg);
        index++;
        break;
      case '--locale':
      case '--content-locale':
      case '--lang':
        params.locale = readOptionValue(args, index, arg);
        if (!normalizeYidaLocale(params.locale)) {
          throw new Error(`Unsupported locale: ${params.locale}`);
        }
        index++;
        break;
      default:
        if (arg.startsWith('-')) {
          throw new Error(`Unknown option: ${arg}`);
        }
        positional.push(arg);
    }
  }

  if (positional.length > 7) {
    throw new Error(`Too many positional arguments: ${positional.slice(7).join(' ')}`);
  }

  params.appName = params.appName || positional[0] || null;
  params.description = params.description || positional[1] || params.appName;
  params.icon = params.icon || positional[2] || DEFAULT_APP_OPTIONS.icon;
  params.iconColor = params.iconColor || positional[3] || DEFAULT_APP_OPTIONS.iconColor;
  params.colour = params.colour || positional[4] || DEFAULT_APP_OPTIONS.colour;
  params.navTheme = params.navTheme || positional[5] || DEFAULT_APP_OPTIONS.navTheme;
  params.layoutDirection = params.layoutDirection || positional[6] || DEFAULT_APP_OPTIONS.layoutDirection;

  return params;
}

function printUsage() {
  const { c } = require('../core/chalk');
  process.stderr.write(`\n  ${c.yellow}${t('create_app.usage')}${c.reset}\n`);
  process.stderr.write(`  ${c.dim}${t('create_app.example')}${c.reset}\n`);
  process.stderr.write(`  ${c.dim}${t('create_app.available_icons')}${c.reset}\n`);
  process.stderr.write(`  ${c.dim}${t('create_app.icons_list')}${c.reset}\n`);
  process.stderr.write(`  ${c.dim}${t('create_app.available_colors')}${c.reset}\n`);
  process.stderr.write(`  ${c.dim}${t('create_app.colors_list')}${c.reset}\n`);
}

async function run(args) {
  const openOption = parseOpenOption(args);
  const guardSplit = extractLegacyGuardArgs(openOption.args);
  args = guardSplit.args;

  if (hasHelpFlag(args)) {
    printUsage();
    return;
  }

  assertLegacyDirectWriteAllowed({
    command: 'create-app',
    resourceType: 'app',
    action: 'create',
  }, { guardOptions: guardSplit.guardOptions });

  let params;
  try {
    params = parseCreateAppArgs(args);
  } catch (err) {
    const { error: chalkError } = require('../core/chalk');
    chalkError(err.message, { hint: t('create_app.usage') });
  }

  if (!params.appName) {
    const { error: chalkError } = require('../core/chalk');
    chalkError(t('create_app.usage'), { hint: t('create_app.example') });
  }

  const { appName, description, icon, iconColor, colour, navTheme, layoutDirection } = params;

  const { c, banner, step, label, info, success: chalkSuccess, result: chalkResult } = require('../core/chalk');

  banner(t('create_app.title'));
  label('Name', appName);
  label('Desc', description);
  label('Icon', `${icon} ${c.dim}(${iconColor})${c.reset}`);
  label('Theme', `${colour} / ${navTheme} / ${layoutDirection}`);

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

  const contentLocale = resolveContentLocale({ locale: params.locale, baseUrl: authRef.baseUrl });
  label('Locale', contentLocale);

  // Step 2: 创建应用
  step(2, t('create_app.step_create'));

  let response;
  try {
    const created = await createAppResource(authRef, {
      appName,
      description,
      icon,
      iconColor,
      colour,
      navTheme,
      layoutDirection,
      contentLocale,
    });
    response = created.response;
  } catch (error) {
    if (!error || error.code !== 'APP_CREATE_FAILED') {
      throw error;
    }
    response = error.details && error.details.result;
  }

  // 输出结果
  if (response && response.success && response.content) {
    const appType = response.content;
    const appUrl = `${authRef.baseUrl}/${appType}/admin`;
    const corpId = authRef.cookieData.corp_id || '';

    chalkResult(true, t('create_app.success'), [
      ['appType', appType],
      ['Corp ID', corpId || t('common.unknown_error')],
      ['URL', `${c.cyan}${appUrl}${c.reset}`],
    ]);

    const prdFile = findPrdFile();
    if (prdFile) {updatePrdCorpId(prdFile, corpId, appType, authRef.baseUrl);}

    console.log(JSON.stringify(withBrowserHandoff(
      { success: true, appType, appName, corpId, url: appUrl },
      appUrl,
      { stage: 'create_app_success', title: appName },
      openOption.mode
    )));
  } else {
    const errorMsg = response ? response.errorMsg || t('common.unknown_error') : t('common.request_failed');
    chalkResult(false, t('create_app.failed', errorMsg));
    console.log(JSON.stringify({ success: false, error: errorMsg }));
    process.exit(1);
  }
}

module.exports = { run, parseCreateAppArgs };
