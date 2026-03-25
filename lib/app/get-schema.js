/**
 * get-schema.js - 宜搭表单 Schema 获取命令
 *
 * 用法：yidacli get-schema <appType> <formUuid>
 */

'use strict';

const {
  loadCookieData,
  triggerLogin,
  resolveBaseUrl,
  httpGet,
  requestWithAutoLogin,
} = require('../core/utils');
const { t } = require('../core/i18n');

async function run(args) {
  if (args.length < 2) {
    console.error(t('get_schema.usage'));
    console.error(t('get_schema.example'));
    process.exit(1);
  }

  const appType = args[0];
  const formUuid = args[1];

  const SEP = '='.repeat(50);
  console.error(SEP);
  console.error(t('get_schema.title'));
  console.error(SEP);
  console.error(t('get_schema.app_id', appType));
  console.error(t('get_schema.form_uuid', formUuid));

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

  // Step 2: 获取表单 Schema
  console.error(t('get_schema.step_get'));
  console.error(t('get_schema.sending'));

  const result = await requestWithAutoLogin((auth) => {
    return httpGet(
      auth.baseUrl,
      `/alibaba/web/${appType}/_view/query/formdesign/getFormSchema.json`,
      { formUuid, schemaVersion: 'V5' },
      auth.cookies
    );
  }, authRef);

  // 输出结果
  console.error('\n' + SEP);
  if (result && result.success !== false && !result.__needLogin && !result.__csrfExpired) {
    console.error(t('get_schema.success'));
    console.error(SEP);
    console.log(JSON.stringify(result, null, 2));
  } else {
    const errorMsg = result ? result.errorMsg || t('common.unknown_error') : t('common.request_failed');
    console.error(t('get_schema.failed', errorMsg));
    console.error(SEP);
    process.exit(1);
  }
}

module.exports = { run };
