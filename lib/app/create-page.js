/**
 * create-page.js - 宜搭自定义页面创建命令
 *
 * 用法：openyida create-page <appType> "<pageName>"
 */

'use strict';

const querystring = require('querystring');
const {
  httpPost,
  requestWithAutoLogin,
} = require('../core/utils');
const { createAuthRef } = require('../core/yida-client');
const { t } = require('../core/i18n');
const { buildYidaI18n, buildYidaTitleI18n, normalizeYidaLocale, resolveContentLocale } = require('../core/yida-i18n');
const { parseOpenOption, withBrowserHandoff } = require('../core/browser-handoff');
const { throwCommandError } = require('../core/command-errors');
const {
  assertLegacyDirectWriteAllowed,
  extractLegacyGuardArgs,
} = require('../core/legacy-schema-guard');

function parseArgs(args) {
  const openOption = parseOpenOption(args);
  const guardSplit = extractLegacyGuardArgs(openOption.args);
  const filteredArgs = [];
  let mode = 'default';
  let locale = null;

  if (guardSplit.args.includes('--help') || guardSplit.args.includes('-h')) {
    return {
      args: [],
      appType: null,
      pageName: null,
      mode,
      locale,
      help: true,
      openMode: openOption.mode,
      legacyGuardOptions: guardSplit.guardOptions,
    };
  }

  for (let i = 0; i < guardSplit.args.length; i++) {
    const arg = guardSplit.args[i];
    if (arg === '--mode' && guardSplit.args[i + 1]) {
      mode = guardSplit.args[++i];
      continue;
    }
    if ((arg === '--locale' || arg === '--content-locale' || arg === '--lang') && guardSplit.args[i + 1]) {
      locale = guardSplit.args[++i];
      if (!normalizeYidaLocale(locale)) {
        throw new Error(`Unsupported locale: ${locale}`);
      }
      continue;
    }
    filteredArgs.push(arg);
  }

  return {
    args: filteredArgs,
    appType: filteredArgs[0],
    pageName: filteredArgs[1],
    mode,
    locale,
    openMode: openOption.mode,
    legacyGuardOptions: guardSplit.guardOptions,
  };
}

function buildPageInfoPostData(formUuid, pageName, isRenderNav, csrfToken) {
  const titleJson = JSON.stringify(buildYidaTitleI18n(pageName, {
    en_US: pageName,
    ja_JP: pageName,
  }));

  return querystring.stringify({
    _api: 'Form.updateFormSchemaInfo',
    _csrf_token: csrfToken,
    _locale_time_zone_offset: '28800000',
    formUuid,
    serialSwitch: 'n',
    consultPerson: '',
    defaultManager: 'n',
    submissionRule: 'RESUBMIT',
    redirectConfig: '',
    pushTask: 'y',
    defaultOrder: 'cd',
    showPrint: 'y',
    relateUuid: '',
    title: titleJson,
    pageType: 'web,mobile',
    isInner: 'y',
    isNew: 'n',
    isAgent: 'y',
    showAgent: 'n',
    showDingGroup: 'y',
    reStart: 'n',
    previewConfig: 'y',
    formulaType: 'n',
    displayTitle: '%24%7Blegao_creator%7D%E5%8F%91%E8%B5%B7%E7%9A%84%24%7Blegao_formname%7D',
    displayType: 'RE',
    isRenderNav: isRenderNav ? 'true' : 'false',
    manageCustomActionInfo: '[]',
  });
}

async function configureDashboardMode(authRef, appType, pageId, pageName) {
  return requestWithAutoLogin((auth) => {
    return httpPost(
      auth.baseUrl,
      `/dingtalk/web/${appType}/query/formdesign/updateFormSchemaInfo.json`,
      buildPageInfoPostData(pageId, pageName, false, auth.csrfToken),
      auth.cookies
    );
  }, authRef);
}

async function run(args) {
  let options;
  try {
    options = parseArgs(args || []);
  } catch (err) {
    const { error: chalkError } = require('../core/chalk');
    chalkError(err.message, { hint: t('create_page.usage') });
  }

  if (options.help) {
    const { usage, hint } = require('../core/chalk');
    usage(t('create_page.usage'), t('create_page.example'));
    hint(t('create_page.mode_hint'));
    return options;
  }

  if (options.args.length < 2) {
    const { error: chalkError } = require('../core/chalk');
    chalkError(t('create_page.usage'), { hint: t('create_page.example') });
  }

  const appType = options.appType;
  const pageName = options.pageName;
  const mode = options.mode;
  assertLegacyDirectWriteAllowed({
    command: 'create-page',
    resourceType: 'page',
    action: 'create',
    appType,
  }, { guardOptions: options.legacyGuardOptions });
  if (mode !== 'default' && mode !== 'dashboard') {
    const { error: chalkError } = require('../core/chalk');
    chalkError(t('create_page.err_mode_invalid', mode), { hint: t('create_page.mode_hint') });
  }

  const { c, banner, step, label, info, warn, success: chalkSuccess, result: chalkResult } = require('../core/chalk');

  banner(t('create_page.title'));
  label('App', appType);
  label('Page', pageName);
  label('Mode', mode);

  // Step 1: 读取登录态
  step(1, t('common.step_login', 1));
  const authRef = createAuthRef();
  chalkSuccess(t('common.login_ready', authRef.baseUrl));

  const contentLocale = resolveContentLocale({ locale: options.locale, baseUrl: authRef.baseUrl });
  label('Locale', contentLocale);

  // Step 2: 创建自定义页面
  step(2, t('create_page.step_create'));
  info(t('create_page.sending'));

  const response = await requestWithAutoLogin((auth) => {
    const postData = querystring.stringify({
      _csrf_token: auth.csrfToken,
      formType: 'display',
      title: JSON.stringify(buildYidaI18n(pageName, { en_US: pageName, ja_JP: pageName })),
    });
    return httpPost(
      auth.baseUrl,
      `/dingtalk/web/${appType}/query/formdesign/saveFormSchemaInfo.json`,
      postData,
      auth.cookies
    );
  }, authRef);

  // 输出结果
  if (response && response.success && response.content) {
    const pageId = response.content.formUuid || response.content;
    const workbenchUrl = `${authRef.baseUrl}/${appType}/workbench/${pageId}`;
    let pageUrl = workbenchUrl;
    let dashboardConfigWarning = null;

    if (mode === 'dashboard') {
      step(3, t('create_page.step_dashboard_config'));
      const configResponse = await configureDashboardMode(authRef, appType, pageId, pageName);
      if (configResponse && configResponse.success) {
        chalkSuccess(t('create_page.dashboard_config_ok'));
        pageUrl = `${authRef.baseUrl}/${appType}/custom/${pageId}?isRenderNav=false`;
      } else {
        dashboardConfigWarning = configResponse ? configResponse.errorMsg || t('common.unknown_error') : t('common.request_failed');
        warn(t('create_page.dashboard_config_failed', dashboardConfigWarning));
      }
    }

    chalkResult(true, t('create_page.success'), [
      ['Page ID', pageId],
      ['URL', `${c.cyan}${pageUrl}${c.reset}`],
    ]);

    console.log(JSON.stringify(withBrowserHandoff(
      { success: true, pageId, pageName, appType, mode, chromeless: mode === 'dashboard' && !dashboardConfigWarning, url: pageUrl, workbenchUrl, dashboardConfigWarning },
      pageUrl,
      { stage: 'create_page_success', title: pageName },
      options.openMode
    )));
  } else {
    const errorMsg = response ? response.errorMsg || response.error || t('common.unknown_error') : t('common.request_failed');
    chalkResult(false, t('create_page.failed', errorMsg));
    console.log(JSON.stringify({ success: false, error: errorMsg }));
    throwCommandError(errorMsg);
  }
}

module.exports = { run, parseArgs, buildPageInfoPostData };
