/**
 * app-list.js - 查询我的应用列表
 *
 * 用法：openyida app-list [--type managed|created] [--page <页码>] [--size <每页数量>]
 *
 * 输出字段：
 *   appName    - 应用名称（zh_CN）
 *   appType    - 应用唯一标识
 *   systemLink - 应用访问地址
 */

'use strict';

const { createAuthRef, createYidaClient } = require('../core/yida-client');
const { t } = require('../core/i18n');
const { throwCommandError, throwUsage } = require('../core/command-errors');

const API_PATH = '/query/app/getAppList.json';
const DEFAULT_PAGE_SIZE = 16;
const DEFAULT_PAGE_INDEX = 1;
const DEFAULT_TYPE = 'managed';
const APP_TYPES = Object.freeze({
  managed: true,
  created: false,
});

/**
 * 拉取单页应用列表
 */
function fetchAppListPage(auth, pageIndex, pageSize, isAdmin) {
  return createYidaClient({ authRef: auth }).get(API_PATH, (ref) => ({
    _api: 'nattyFetch',
    _mock: 'false',
    pageIndex,
    pageSize,
    creator: ref.userId,
    isAdmin,
    _stamp: Date.now(),
  }));
}

function parsePositiveInteger(value, optionName) {
  if (!/^\d+$/.test(String(value || '')) || Number(value) < 1) {
    throwUsage(t('app_list.invalid_positive_integer', optionName, value || ''));
  }
  return Number(value);
}

function parseArgs(args = []) {
  const options = {
    type: DEFAULT_TYPE,
    pageIndex: DEFAULT_PAGE_INDEX,
    pageSize: DEFAULT_PAGE_SIZE,
  };

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--type') {
      const type = args[++index];
      if (!Object.prototype.hasOwnProperty.call(APP_TYPES, type)) {
        throwUsage(t('app_list.invalid_type', type || '', Object.keys(APP_TYPES).join(', ')));
      }
      options.type = type;
    } else if (arg === '--page') {
      options.pageIndex = parsePositiveInteger(args[++index], '--page');
    } else if (arg === '--size') {
      options.pageSize = parsePositiveInteger(args[++index], '--size');
    } else {
      throwUsage(t('app_list.invalid_argument', arg));
    }
  }

  return options;
}

/**
 * 将应用原始数据提取为输出字段
 */
function formatApp(app) {
  return {
    appName: (app.appName && app.appName.zh_CN) || '',
    appType: app.appType || '',
    systemLink: app.systemLink || '',
  };
}

function hasHelpFlag(args) {
  return (args || []).includes('--help') || (args || []).includes('-h');
}

function printUsage() {
  process.stderr.write([
    t('app_list.usage'),
    '',
    t('app_list.options'),
    t('app_list.option_type'),
    t('app_list.option_page'),
    t('app_list.option_size'),
    t('app_list.option_help'),
    '',
  ].join('\n'));
}

/**
 * app-list 命令主入口
 * @param {string[]} args
 */
async function run(args) {
  if (hasHelpFlag(args)) {
    printUsage();
    return;
  }

  const options = parseArgs(args);

  const authRef = createAuthRef();

  let result;
  try {
    result = await fetchAppListPage(
      authRef,
      options.pageIndex,
      options.pageSize,
      APP_TYPES[options.type]
    );
  } catch (err) {
    throwCommandError(t('app_list.query_failed', err.message));
  }

  // 如果重试后仍然返回登录失效标记，说明登录态确实不可用
  if (result && result.__needLogin) {
    throwCommandError(t('app_list.auth_required'), { code: 'CLI_AUTH_REQUIRED' });
  }

  if (!result || !result.success) {
    throwCommandError(t('app_list.query_failed', (result && result.errorMsg) || t('app_list.unknown_error')));
  }

  const content = result.content || {};
  const apps = Array.isArray(content.data) ? content.data : [];
  const totalCount = Number.isFinite(Number(content.totalCount)) ? Number(content.totalCount) : apps.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / options.pageSize));
  const scopeLabel = t(`app_list.scope_${options.type}`);
  const formattedApps = apps.map(formatApp);

  // stdout 输出 JSON，方便 AI 工具解析
  console.log(JSON.stringify(formattedApps, null, 2));

  // stderr 输出人类可读摘要
  const { c, success: chalkSuccess, hint, listItem } = require('../core/chalk');
  chalkSuccess(t(
    'app_list.found',
    scopeLabel,
    options.pageIndex,
    totalPages,
    formattedApps.length,
    totalCount
  ));
  for (const app of formattedApps) {
    listItem(`${c.bold}${app.appName}${c.reset}  ${c.dim}[${app.appType}]${c.reset}  ${c.cyan}${app.systemLink}${c.reset}`);
  }
  if (options.pageIndex < totalPages) {
    hint(t(
      'app_list.next_page',
      `openyida app-list --type ${options.type} --page ${options.pageIndex + 1} --size ${options.pageSize}`
    ));
  }
}

module.exports = { parseArgs, run };
