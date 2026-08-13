/**
 * create-app.js - 宜搭应用创建命令
 *
 * 用法：openyida create-app "<appName>" [description] [icon] [iconColor] [colour] [navTheme] [layoutDirection]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const {
  httpPost,
  requestWithAutoLogin,
} = require('../core/utils');
const { createAuthRef } = require('../core/yida-client');
const { t } = require('../core/i18n');
const { buildYidaI18n, normalizeYidaLocale, resolveContentLocale } = require('../core/yida-i18n');
const { parseOpenOption, withBrowserHandoff } = require('../core/browser-handoff');
const { throwCommandError } = require('../core/command-errors');
const { assertPresetThemeKey } = require('./theme-presets');

const DEFAULT_APP_OPTIONS = {
  icon: 'xian-yingyong',
  iconColor: '#0089FF',
  colour: 'podBlue',
};

const INDUSTRY_APP_DEFAULTS = [
  {
    name: 'legal',
    pattern: /(律所|律师|法律|法务|合规|仲裁|知识产权|诉讼|legal|law\s*firm|lawyer)/i,
    options: {
      icon: 'xian-falv',
      iconColor: '#5C72FF',
      colour: 'podBlue',
    },
  },
  {
    name: 'tea-ecology',
    pattern: /(茶叶|茶园|茶业|茶庄|茶文化|农业|生态|环保|有机|健康|tea|agri|eco|green)/i,
    options: {
      icon: 'xian-diqiu',
      iconColor: '#00B853',
      colour: 'podGreen',
    },
  },
  {
    name: 'command-screen',
    pattern: /(数据大屏|大屏|实时监控|监测预警|预警系统|态势|指挥舱|水质|物联网|iot|screen|monitoring|command\s*center)/i,
    options: {
      icon: 'xian-baogao',
      iconColor: '#14A9FF',
      colour: 'podBlue',
    },
  },
  {
    name: 'professional-service',
    pattern: /(咨询|审计|会计|投顾|专业服务|企业服务|consulting|audit|advisory)/i,
    options: {
      icon: 'xian-qiye',
      iconColor: '#5C72FF',
      colour: 'podBlue',
    },
  },
];

function inferAppDefaults(appName, description) {
  const text = `${appName || ''} ${description || ''}`;
  const matched = INDUSTRY_APP_DEFAULTS.find((item) => item.pattern.test(text));
  return matched ? { industry: matched.name, ...matched.options } : { industry: 'default', ...DEFAULT_APP_OPTIONS };
}

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

  const inferredDefaults = inferAppDefaults(params.appName, params.description);
  params.icon = params.icon || positional[2] || inferredDefaults.icon;
  params.iconColor = params.iconColor || positional[3] || inferredDefaults.iconColor;
  params.colour = params.colour || positional[4] || inferredDefaults.colour;
  assertPresetThemeKey(params.colour);
  params.navTheme = params.navTheme || positional[5] || null;
  params.layoutDirection = params.layoutDirection || positional[6] || null;
  params.industry = inferredDefaults.industry;

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

function buildCreateAppPayload(params, auth, contentLocale, openExclusive, openPhysicColumn) {
  const {
    appName,
    description,
    icon,
    iconColor,
    colour,
    navTheme,
    layoutDirection,
  } = params;
  const iconValue = `${icon}%%${iconColor}`;
  const payload = {
    _csrf_token: auth.csrfToken,
    appName: JSON.stringify(buildYidaI18n(appName, { en_US: appName, ja_JP: appName })),
    description: JSON.stringify(buildYidaI18n(description, { en_US: description, ja_JP: description })),
    icon: iconValue,
    iconUrl: iconValue,
    colour,
    defaultLanguage: contentLocale,
    openExclusive,
    openPhysicColumn,
    openIsolationDatabase: 'n',
    openExclusiveUnit: 'n',
    group: 'ALL',
    fromBuilderAi: 'y',
    builderAiSource: 'local',
  };
  if (navTheme) {
    payload.navTheme = navTheme;
  }
  if (layoutDirection) {
    payload.layoutDirection = layoutDirection;
  }
  return payload;
}

async function run(args) {
  const openOption = parseOpenOption(args);
  args = openOption.args;

  if (hasHelpFlag(args)) {
    printUsage();
    return;
  }

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

  const { c, banner, step, label, success: chalkSuccess, result: chalkResult } = require('../core/chalk');

  banner(t('create_app.title'));
  label('Name', appName);
  label('Desc', description);
  label('Icon', `${icon} ${c.dim}(${iconColor})${c.reset}`);
  label('Theme', `${colour} / ${navTheme || 'default'} / ${layoutDirection || 'default'}`);

  // Step 1: 读取登录态
  step(1, t('common.step_login', 1));
  const authRef = createAuthRef();
  chalkSuccess(t('common.login_ready', authRef.baseUrl));

  const contentLocale = resolveContentLocale({ locale: params.locale, baseUrl: authRef.baseUrl });
  label('Locale', contentLocale);

  // Step 2: 创建应用
  step(2, t('create_app.step_create'));

  // 查询企业专属域名配置，动态决定 openExclusive / openPhysicColumn 参数
  // 避免在开启了专属数据库策略的企业中硬编码 "n" 导致创建失败
  let openExclusive = 'n';
  let openPhysicColumn = 'n';
  try {
    const corpConfig = await httpPost(
      authRef.baseUrl,
      `/query/exclusive/queryCorpAppConfig.json?_api=Global.queryCorpAppConfig&_mock=false&_locale_time_zone_offset=28800000&_stamp=${Date.now()}`,
      ''
    );
    if (corpConfig && corpConfig.content) {
      if (corpConfig.content.forceExclusiveDb === 'y') {openExclusive = 'y';}
      if (corpConfig.content.forcePhysicalColumn === 'y') {openPhysicColumn = 'y';}
    }
  } catch (err) {
    // 查询失败时使用默认值，不影响主流程
  }

  const response = await requestWithAutoLogin((auth) => {
    const payload = buildCreateAppPayload(params, auth, contentLocale, openExclusive, openPhysicColumn);
    const postData = querystring.stringify(payload);
    return httpPost(auth.baseUrl, '/query/app/registerApp.json', postData);
  }, authRef);

  // 输出结果
  if (response && response.success && response.content) {
    const appType = response.content;
    const appUrl = `${authRef.baseUrl}/${appType}/workbench`;
    const corpId = authRef.corpId || (authRef.authData && authRef.authData.corp_id) || '';

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
    throwCommandError(errorMsg);
  }
}

module.exports = { run, parseCreateAppArgs, inferAppDefaults, buildCreateAppPayload };
