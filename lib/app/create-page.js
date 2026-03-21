/**
 * create-page.js - 宜搭自定义页面创建命令
 *
 * 用法：yidacli create-page <appType> "<pageName>" [--datasource <jsonOrFile>]
 *
 * --datasource 参数（可选）：JSON 字符串或文件路径，用于在页面创建后注入连接器数据源。
 * 数据源定义格式：
 *   [{ "id": "myApi", "connectorId": "G-CONN-xxx", "actionId": "G-ACT-xxx" }]
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
const { buildDataSourceList, parseDatasourceArg, extractDatasourceArg } = require('./datasource-utils');

async function run(args) {
  // 从参数中提取 --datasource 选项（会原地修改 args 数组）
  const mutableArgs = [...args];
  const datasourceArg = extractDatasourceArg(mutableArgs);

  if (mutableArgs.length < 2) {
    console.error(t('create_page.usage'));
    console.error(t('create_page.example'));
    process.exit(1);
  }

  const appType = mutableArgs[0];
  const pageName = mutableArgs[1];

  const SEP = '='.repeat(50);
  console.error(SEP);
  console.error(t('create_page.title'));
  console.error(SEP);
  console.error(t('create_page.app_id', appType));
  console.error(t('create_page.page_name', pageName));

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

  // Step 2: 创建自定义页面
  console.error(t('create_page.step_create'));
  console.error(t('create_page.sending'));

  const response = await requestWithAutoLogin((auth) => {
    const postData = querystring.stringify({
      _csrf_token: auth.csrfToken,
      formType: 'display',
      title: JSON.stringify({ zh_CN: pageName, en_US: pageName, type: 'i18n' }),
    });
    return httpPost(
      auth.baseUrl,
      `/dingtalk/web/${appType}/query/formdesign/saveFormSchemaInfo.json`,
      postData,
      auth.cookies
    );
  }, authRef);

  if (!response || !response.success || !response.content) {
    const errorMsg = response ? response.errorMsg || t('common.unknown_error') : t('common.request_failed');
    console.error(t('create_page.failed', errorMsg));
    console.error('='.repeat(50));
    console.log(JSON.stringify({ success: false, error: errorMsg }));
    process.exit(1);
  }

  const pageId = response.content.formUuid || response.content;
  const pageUrl = `${authRef.baseUrl}/${appType}/workbench/${pageId}`;

  // Step 3: 注入连接器数据源（如果提供了 --datasource 参数）
  const datasourceDefinitions = parseDatasourceArg(datasourceArg);
  if (datasourceDefinitions.length > 0) {
    console.error(`[datasource] 正在注入 ${datasourceDefinitions.length} 个连接器数据源...`);

    const dataSourceList = buildDataSourceList(datasourceDefinitions);
    const schema = {
      schemaType: 'superform',
      schemaVersion: '5.0',
      dataSourceList: dataSourceList,
    };

    const saveSchemaResponse = await requestWithAutoLogin((auth) => {
      const postData = querystring.stringify({
        _csrf_token: auth.csrfToken,
        formUuid: pageId,
        schemaVersion: 1,
        content: JSON.stringify(schema),
      });
      return httpPost(
        auth.baseUrl,
        `/dingtalk/web/${appType}/query/formdesign/saveFormSchema.json`,
        postData,
        auth.cookies
      );
    }, authRef);

    if (saveSchemaResponse && saveSchemaResponse.success) {
      console.error('[datasource] 数据源注入成功');
    } else {
      const schemaErrorMsg = saveSchemaResponse
        ? saveSchemaResponse.errorMsg || t('common.unknown_error')
        : t('common.request_failed');
      console.error(`[datasource] 数据源注入失败：${schemaErrorMsg}`);
    }
  }

  // 输出结果
  const SEP2 = '='.repeat(50);
  console.error('\n' + SEP2);
  console.error(t('create_page.success'));
  console.error(t('create_page.page_id_label', pageId));
  console.error(t('create_page.url_label', pageUrl));
  console.error(SEP2);

  console.log(JSON.stringify({ success: true, pageId, pageName, appType, url: pageUrl }));
}

module.exports = { run };
