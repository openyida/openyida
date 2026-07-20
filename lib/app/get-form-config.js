/**
 * get-form-config.js - 宜搭表单配置查询命令
 *
 * 用法：
 *   openyida get-form-config <appType> <formUuid> [--json]
 *
 * 读取 Form.getFormSchemaInfo，输出表单的关键配置（导航、提交规则、标题等）。
 * 默认输出常用字段摘要，--json 输出完整配置对象。
 */

'use strict';

const querystring = require('querystring');
const {
  loadAuthData,
  triggerLogin,
  resolveBaseUrl,
  httpPost,
  requestWithAutoLogin,
} = require('../core/utils');
const { t } = require('../core/i18n');
const { banner, step, label, info, success, error, result } = require('../core/chalk');
const { throwCommandError } = require('../core/command-errors');

// 常用配置字段白名单（人读摘要），--json 会输出完整对象
const SUMMARY_FIELDS = [
  'isRenderNav',
  'submissionRule',
  'defaultOrder',
  'showPrint',
  'pageType',
  'displayType',
  'displayTitle',
  'formType',
  'formStatus',
];

function parseArgs(args) {
  const parsed = { appType: args[0] || '', formUuid: '', json: false };
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json') {
      parsed.json = true;
    } else if (!arg.startsWith('--') && !parsed.formUuid) {
      parsed.formUuid = arg;
    }
  }
  return parsed;
}

function createAuthRef() {
  step(1, t('common.step_login_label'));
  let authData = loadAuthData();
  if (!authData) {
    info(t('common.no_login_cache'));
    authData = triggerLogin();
  }
  const authRef = {
    csrfToken: authData.csrf_token,
    baseUrl: resolveBaseUrl(authData),
    authData,
    authMode: authData.auth_mode || '',
    authSource: authData.auth_source || '',
    corpId: authData.corp_id || '',
    userId: authData.user_id || '',
  };
  success(t('common.login_ready', authRef.baseUrl));
  return authRef;
}

async function fetchFormSchemaInfo(authRef, appType, formUuid) {
  return requestWithAutoLogin((ref) => httpPost(
    ref.baseUrl,
    `/dingtalk/web/${appType}/query/formdesign/getFormSchemaInfo.json`,
    querystring.stringify({
      _api: 'Form.getFormSchemaInfo',
      _csrf_token: ref.csrfToken,
      _locale_time_zone_offset: '28800000',
      formUuid: formUuid,
    })
  ), authRef);
}

function extractTitle(titleField) {
  if (!titleField) {
    return '';
  }
  if (typeof titleField === 'string') {
    return titleField;
  }
  return titleField.zh_CN || titleField.en_US || titleField.pureEn_US || '';
}

async function run(args) {
  const parsed = parseArgs(args);
  if (!parsed.appType || !parsed.formUuid) {
    error(t('get_form_config.usage'), { hint: t('get_form_config.example') });
    return;
  }

  banner(t('get_form_config.title'));
  label('App ID:', parsed.appType);
  label('Form UUID:', parsed.formUuid);

  const authRef = createAuthRef();

  step(2, t('get_form_config.step_read'));
  info(t('get_form_config.sending_request'));
  const resp = await fetchFormSchemaInfo(authRef, parsed.appType, parsed.formUuid);

  if (!resp || resp.__needLogin || resp.__csrfExpired || resp.success === false) {
    const errorMsg = (resp && resp.errorMsg) || t('common.unknown_error');
    result(false, t('get_form_config.read_failed', errorMsg));
    console.log(JSON.stringify({
      success: false,
      message: (resp && resp.errorMsg) || t('get_form_config.read_failed_msg'),
      errorCode: resp && resp.errorCode,
    }, null, 2));
    throwCommandError(errorMsg);
  }

  const cfg = resp.content || resp.result || resp.data || {};
  success(t('get_form_config.read_ok'));

  if (parsed.json) {
    console.log(JSON.stringify({
      success: true,
      appType: parsed.appType,
      formUuid: parsed.formUuid,
      config: cfg,
    }, null, 2));
    return;
  }

  const summary = {
    success: true,
    appType: parsed.appType,
    formUuid: parsed.formUuid,
    title: extractTitle(cfg.title),
  };
  SUMMARY_FIELDS.forEach((key) => {
    if (cfg[key] !== undefined) {
      summary[key] = cfg[key];
    }
  });
  console.log(JSON.stringify(summary, null, 2));
}

module.exports = { run, parseArgs, extractTitle, fetchFormSchemaInfo };
