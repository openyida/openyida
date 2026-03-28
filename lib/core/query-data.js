/**
 * query-data.js - 宜搭表单数据查询命令
 *
 * 用法：
 *   openyida query-data <appType> <formUuid> [选项]
 *
 * 选项：
 *   --page <number>       当前页码，默认 1
 *   --size <number>       每页记录数，默认 20，最大 100
 *   --search-json <json>  搜索条件 JSON 字符串
 *   --inst-id <id>        根据实例 ID 查询单条详情
 */

'use strict';

const {
  loadCookieData,
  resolveBaseUrl,
  httpGet,
  requestWithAutoLogin,
} = require('./utils');

function parseArgs(args) {
  if (args.length < 2) {
    console.error('用法：openyida query-data <appType> <formUuid> [--page N] [--size N] [--search-json JSON] [--inst-id ID]');
    process.exit(1);
  }

  const appType = args[0];
  const formUuid = args[1];

  const options = {
    page: 1,
    size: 20,
    searchJson: null,
    instId: null,
  };

  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--page' && args[i + 1]) {
      options.page = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--size' && args[i + 1]) {
      options.size = Math.min(parseInt(args[i + 1], 10) || 20, 100);
      i++;
    } else if (args[i] === '--search-json' && args[i + 1]) {
      options.searchJson = args[i + 1];
      i++;
    } else if (args[i] === '--inst-id' && args[i + 1]) {
      options.instId = args[i + 1];
      i++;
    }
  }

  return { appType, formUuid, options };
}

function buildSearchFormDatasRequest(appType, formUuid, options) {
  return (authRef) => {
    const queryParams = {
      _api: 'nattyFetch',
      _mock: 'false',
      _csrf_token: authRef.csrfToken,
      _stamp: String(Date.now()),
      formUuid,
      appType,
      currentPage: String(options.page),
      pageSize: String(options.size),
    };

    if (options.searchJson) {
      queryParams.searchFieldJson = options.searchJson;
    }

    const requestPath = `/dingtalk/web/${appType}/v1/form/searchFormDatas.json`;
    return httpGet(authRef.baseUrl, requestPath, queryParams, authRef.cookies);
  };
}

function buildGetFormDataByIdRequest(appType, instId) {
  return (authRef) => {
    const queryParams = {
      _api: 'nattyFetch',
      _mock: 'false',
      _csrf_token: authRef.csrfToken,
      _stamp: String(Date.now()),
      formInstId: instId,
    };

    const requestPath = `/dingtalk/web/${appType}/v1/form/getFormDataById.json`;
    return httpGet(authRef.baseUrl, requestPath, queryParams, authRef.cookies);
  };
}

async function run(args) {
  const { appType, formUuid, options } = parseArgs(args);

  const SEP = '='.repeat(50);
  console.error(SEP);
  console.error('  query-data - 宜搭表单数据查询');
  console.error(SEP);
  console.error(`\n  应用 ID:    ${appType}`);
  console.error(`  表单 UUID:  ${formUuid}`);

  console.error('\n🔑 Step 1: 获取登录态');
  const cookieData = loadCookieData();
  if (!cookieData || !cookieData.cookies) {
    console.error('  ❌ 未登录，请先执行 openyida login');
    process.exit(1);
  }

  const authRef = {
    cookieData,
    cookies: cookieData.cookies,
    csrfToken: cookieData.csrf_token,
    baseUrl: resolveBaseUrl(cookieData),
  };
  console.error(`  ✅ 登录态已就绪（${authRef.baseUrl}）`);

  console.error('\n📊 Step 2: 查询数据');

  let result;
  if (options.instId) {
    console.error(`  查询实例详情：${options.instId}`);
    result = await requestWithAutoLogin(
      buildGetFormDataByIdRequest(appType, options.instId),
      authRef
    );
  } else {
    console.error(`  查询数据列表（第 ${options.page} 页，每页 ${options.size} 条）...`);
    result = await requestWithAutoLogin(
      buildSearchFormDatasRequest(appType, formUuid, options),
      authRef
    );
  }

  console.error('\n' + SEP);
  if (result && result.success) {
    if (options.instId) {
      console.error('  ✅ 实例详情查询成功！');
    } else {
      const totalCount = result.content?.totalCount ?? 0;
      console.error(`  ✅ 查询成功！共 ${totalCount} 条记录`);
    }
    console.error(SEP);
    console.log(JSON.stringify(result, null, 2));
  } else {
    const errorMsg = result?.errorMsg ?? '未知错误';
    const errorCode = result?.errorCode ?? '';
    console.error(`  ❌ 查询失败：${errorMsg}`);
    if (errorCode) {
      console.error(`  错误码：${errorCode}`);
    }
    console.error(SEP);
    process.exit(1);
  }
}

module.exports = { run };
