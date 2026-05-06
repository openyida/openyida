/**
 * app-list.js - 查询我的应用列表
 *
 * 用法：openyida app-list [--page <页码>] [--size <每页数量>]
 *
 * 输出字段：
 *   appName    - 应用名称（zh_CN）
 *   appType    - 应用唯一标识
 *   systemLink - 应用访问地址
 */

'use strict';

const {
  loadCookieData,
  triggerLogin,
  resolveBaseUrl,
  extractInfoFromCookies,
  httpGet,
  requestWithAutoLogin,
} = require('../core/utils');
const { t } = require('../core/i18n');

const API_PATH = '/query/app/getAppList.json';

/**
 * 拉取单页应用列表
 */
function fetchAppListPage(auth, pageIndex, pageSize) {
  const queryParams = {
    _api: 'nattyFetch',
    _mock: 'false',
    pageIndex,
    pageSize,
    creator: auth.userId,
    _csrf_token: auth.csrfToken,
    _stamp: Date.now(),
  };
  return httpGet(auth.baseUrl, API_PATH, queryParams, auth.cookies);
}

/**
 * 拉取全量应用列表（自动翻页）
 */
async function fetchAllApps(auth, pageSize) {
  const firstResult = await fetchAppListPage(auth, 1, pageSize);

  // 如果首次请求就提示需要登录或 CSRF 过期，直接返回原始结果
  // 让外层 requestWithAutoLogin 处理自动重试
  if (firstResult.__needLogin || firstResult.__csrfExpired) {
    return firstResult;
  }

  if (!firstResult.success) {
    throw new Error(firstResult.errorMsg || '查询应用列表失败');
  }

  const { data: firstPageData, totalCount } = firstResult.content;
  const allApps = [...firstPageData];

  const totalPages = Math.ceil(totalCount / pageSize);
  const remainingFetches = [];

  for (let pageIndex = 2; pageIndex <= totalPages; pageIndex++) {
    remainingFetches.push(fetchAppListPage(auth, pageIndex, pageSize));
  }

  const remainingResults = await Promise.all(remainingFetches);
  for (const result of remainingResults) {
    // 如果后续翻页也出现登录态问题，同样返回标记对象
    if (result.__needLogin || result.__csrfExpired) {
      return result;
    }
    if (result.success && result.content && result.content.data) {
      allApps.push(...result.content.data);
    }
  }

  return allApps;
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

/**
 * app-list 命令主入口
 * @param {string[]} args
 */
async function run(args) {
  const pageSizeIndex = args.indexOf('--size');
  const pageSize = pageSizeIndex !== -1 && args[pageSizeIndex + 1]
    ? parseInt(args[pageSizeIndex + 1], 10)
    : 20;

  let cookieData = await loadCookieData();
  if (!cookieData) {
    cookieData = await triggerLogin();
  }

  const baseUrl = resolveBaseUrl(cookieData);
  const { csrfToken, userId } = extractInfoFromCookies(cookieData.cookies);
  const authRef = { baseUrl, cookies: cookieData.cookies, csrfToken, userId };

  let apps;
  try {
    apps = await requestWithAutoLogin(
      (auth) => fetchAllApps(
        { baseUrl: auth.baseUrl, cookies: auth.cookies, csrfToken: auth.csrfToken, userId: auth.userId },
        pageSize
      ),
      authRef
    );
  } catch (err) {
    console.error(`查询应用列表失败：${err.message}`);
    process.exit(1);
  }

  // 如果重试后仍然返回登录失效标记，说明登录态确实不可用
  if (apps && (apps.__needLogin || apps.__csrfExpired)) {
    console.error('登录态已失效，请重新登录');
    process.exit(1);
  }

  if (!apps || apps.length === 0) {
    console.log('暂无应用');
    return;
  }

  const formattedApps = apps.map(formatApp);

  // stdout 输出 JSON，方便 AI 工具解析
  console.log(JSON.stringify(formattedApps, null, 2));

  // stderr 输出人类可读摘要
  const { c, success: chalkSuccess, listItem } = require('../core/chalk');
  chalkSuccess(`共找到 ${c.cyan}${formattedApps.length}${c.reset} 个应用`);
  for (const app of formattedApps) {
    listItem(`${c.bold}${app.appName}${c.reset}  ${c.dim}[${app.appType}]${c.reset}  ${c.cyan}${app.systemLink}${c.reset}`);
  }
}

module.exports = { run };
