/**
 * create-page.js - 宜搭自定义页面创建命令
 *
 * 用法：openyida create-page <appType> "<pageName>"
 */

'use strict';

const querystring = require('querystring');
const {
  httpGet,
  httpPost,
  requestWithAutoLogin,
  requestNonIdempotentWithAuthPreflight,
} = require('../core/utils');
const { createAuthRef } = require('../core/yida-client');
const { t } = require('../core/i18n');
const { buildYidaI18n, buildYidaTitleI18n, normalizeYidaLocale, resolveContentLocale } = require('../core/yida-i18n');
const { parseOpenOption, withBrowserHandoff } = require('../core/browser-handoff');
const { throwCommandError } = require('../core/command-errors');
const { buildApiPath } = require('./create-form/api-path');
const { fetchFormSchemaInfo } = require('./get-form-config');

function parseArgs(args) {
  const openOption = parseOpenOption(args);
  const filteredArgs = [];
  let mode = 'default';
  let locale = null;
  let hideNav = false;

  if (openOption.args.includes('--help') || openOption.args.includes('-h')) {
    return {
      args: [],
      appType: null,
      pageName: null,
      mode,
      locale,
      hideNav,
      help: true,
      openMode: openOption.mode,
    };
  }

  for (let i = 0; i < openOption.args.length; i++) {
    const arg = openOption.args[i];
    if (arg === '--mode' && openOption.args[i + 1]) {
      mode = openOption.args[++i];
      continue;
    }
    if ((arg === '--locale' || arg === '--content-locale' || arg === '--lang') && openOption.args[i + 1]) {
      locale = openOption.args[++i];
      if (!normalizeYidaLocale(locale)) {
        throw new Error(`Unsupported locale: ${locale}`);
      }
      continue;
    }
    if (arg === '--hide-nav' || arg === '--hide-navigation' || arg === '--no-nav') {
      hideNav = true;
      continue;
    }
    const renderNavMatch = arg.match(/^(--render-nav|--is-render-nav|--isRenderNav)=(.+)$/);
    if (renderNavMatch) {
      hideNav = !parseBooleanOption(renderNavMatch[2], renderNavMatch[1]);
      continue;
    }
    if ((arg === '--render-nav' || arg === '--is-render-nav' || arg === '--isRenderNav') && openOption.args[i + 1]) {
      hideNav = !parseBooleanOption(openOption.args[++i], arg);
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
    hideNav,
    openMode: openOption.mode,
  };
}

function parseBooleanOption(value, optionName) {
  const normalized = String(value || '').toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false;
  }
  throw new Error(`Invalid boolean value for ${optionName}: ${value}`);
}

function buildPageInfoPostData(formUuid, pageName, isRenderNav, csrfToken, currentConfig) {
  const titleJson = JSON.stringify(buildYidaTitleI18n(pageName, {
    en_US: pageName,
    ja_JP: pageName,
  }));

  const payload = {
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
  };
  // 与 update-form-config 一样，保留当前配置，只覆盖标题和导航。
  for (const key of Object.keys(payload)) {
    if (key.startsWith('_') || ['formUuid', 'title', 'isRenderNav'].includes(key)) {continue;}
    const value = currentConfig?.[key];
    if (value !== undefined && value !== null) {
      payload[key] = typeof value === 'object' ? JSON.stringify(value) : value;
    }
  }
  return querystring.stringify(payload);
}

function readRenderNav(config) {
  const value = config && Object.prototype.hasOwnProperty.call(config, 'renderNav')
    ? config.renderNav : config?.isRenderNav;
  if (value === false || value === 'false') {return false;}
  if (value === true || value === 'true') {return true;}
  return null;
}

async function configureNavigationVisibility(authRef, appType, pageId, pageName, isRenderNav) {
  const verification = { requestedRenderNav: isRenderNav, renderNav: null, verified: false, attempts: 0 };
  let currentConfig = null;
  const readConfig = async () => {
    const response = await fetchFormSchemaInfo(authRef, appType, pageId);
    if (!response || response.success === false || response.__needLogin || response.__csrfExpired) {
      throw new Error(response?.errorMsg || t('common.request_failed'));
    }
    currentConfig = response.content || response.result || response.data || {};
    verification.renderNav = readRenderNav(currentConfig);
  };
  try {
    await readConfig();
    for (let attempt = 0; attempt < 2; attempt++) {
      verification.attempts++;
      // 写入后旧读值不再证明当前状态；回读失败必须报告未知。
      verification.renderNav = null;
      const response = await requestWithAutoLogin((auth) => httpPost(
        auth.baseUrl,
        buildApiPath(appType, 'updateFormSchemaInfo'),
        buildPageInfoPostData(pageId, pageName, isRenderNav, auth.csrfToken, currentConfig)
      ), authRef);
      await readConfig();
      if (verification.renderNav === isRenderNav) {
        verification.verified = true;
        return verification;
      }
      if (!response?.success || response.__needLogin || response.__csrfExpired) {
        verification.error = response?.errorMsg || t('common.request_failed');
        return verification;
      }
      // 只补写已创建页面的配置，不重试创建；未知状态也不能当作隐藏成功。
    }
    verification.error = t('create_page.navigation_unverified');
  } catch (err) {
    verification.error = err.message;
  }
  return verification;
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

  const response = await requestNonIdempotentWithAuthPreflight(
    (auth) => {
      const postData = querystring.stringify({
        _csrf_token: auth.csrfToken,
        formType: 'display',
        title: JSON.stringify(buildYidaI18n(pageName, { en_US: pageName, ja_JP: pageName })),
      });
      return httpPost(
        auth.baseUrl,
        buildApiPath(appType, 'saveFormSchemaInfo'),
        postData
      );
    },
    (auth) => httpGet(
      auth.baseUrl,
      buildApiPath(appType, 'getFormNavigationListByOrder', { queryModule: 'formnav' }),
      { _api: 'Nav.queryList', _mock: false }
    ),
    authRef
  );

  // 输出结果
  if (response && response.success && response.content) {
    const pageId = response.content.formUuid || response.content;
    const workbenchUrl = `${authRef.baseUrl}/${appType}/workbench/${pageId}`;
    let pageUrl = workbenchUrl;
    let dashboardConfigWarning = null;
    let navigationVerification = null;

    if (options.hideNav) {
      step(3, t('create_page.step_dashboard_config'));
      navigationVerification = await configureNavigationVisibility(authRef, appType, pageId, pageName, false);
      if (navigationVerification.verified) {
        chalkSuccess(t('create_page.dashboard_config_ok'));
        pageUrl = `${authRef.baseUrl}/${appType}/custom/${pageId}?isRenderNav=false`;
      } else {
        dashboardConfigWarning = navigationVerification.error;
        warn(t('create_page.dashboard_config_failed', dashboardConfigWarning));
      }
    }

    const complete = !options.hideNav || navigationVerification.verified;
    const result = {
      success: complete, pageCreated: true, pageId, pageName, appType, mode,
      hideNavRequested: options.hideNav,
      hideNav: options.hideNav ? (navigationVerification.renderNav === null ? null : !navigationVerification.renderNav) : false,
      chromeless: options.hideNav && navigationVerification.verified,
      navigationVerification, url: pageUrl, workbenchUrl, dashboardConfigWarning,
    };
    if (!complete) {
      result.errorCode = 'CREATE_PAGE_NAVIGATION_NOT_VERIFIED';
      result.recovery = {
        command: 'update-form-config', args: [appType, pageId, 'false', pageName],
        verifyCommand: 'get-form-config', verifyArgs: [appType, pageId, '--json'],
      };
    }
    chalkResult(complete, complete ? t('create_page.success') : t('create_page.navigation_unverified'), [
      ['Page ID', pageId],
      ['URL', `${c.cyan}${pageUrl}${c.reset}`],
    ]);

    console.log(JSON.stringify(complete ? withBrowserHandoff(
      result,
      pageUrl,
      { stage: 'create_page_success', title: pageName },
      options.openMode
    ) : result));
    if (!complete) {
      throwCommandError(t('create_page.navigation_unverified'), { code: result.errorCode, details: result });
    }
  } else {
    const errorMsg = response ? response.errorMsg || response.error || t('common.unknown_error') : t('common.request_failed');
    const errorCode = response && response.errorCode ? response.errorCode : 'CREATE_PAGE_FAILED';
    chalkResult(false, t('create_page.failed', errorMsg));
    console.log(JSON.stringify({ success: false, errorCode, error: errorMsg }));
    throwCommandError(errorMsg, { code: errorCode });
  }
}

module.exports = { run, parseArgs, buildPageInfoPostData };
