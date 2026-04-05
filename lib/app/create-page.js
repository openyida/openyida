/**
 * create-page.js - 宜搭自定义页面创建命令
 *
 * 用法：openyida create-page <appType> "<pageName>"
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

async function run(args) {
  if (args.length < 2) {
    console.error(t('create_page.usage'));
    console.error(t('create_page.example'));
    process.exit(1);
  }

  const appType = args[0];
  const pageName = args[1];

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

  // 输出结果
  const SEP2 = '='.repeat(50);
  console.error('\n' + SEP2);
  if (response && response.success && response.content) {
    const pageId = response.content.formUuid || response.content;
    const pageUrl = `${authRef.baseUrl}/${appType}/workbench/${pageId}`;

    console.error(t('create_page.success'));
    console.error(t('create_page.page_id_label', pageId));
    console.error(t('create_page.url_label', pageUrl));
    console.error(SEP2);

    console.log(JSON.stringify({ success: true, pageId, pageName, appType, url: pageUrl }));
  } else {
    const errorMsg = response ? response.errorMsg || t('common.unknown_error') : t('common.request_failed');
    console.error(t('create_page.failed', errorMsg));
    console.error(SEP2);
    console.log(JSON.stringify({ success: false, error: errorMsg }));
    process.exit(1);
  }
}

module.exports = { run };
