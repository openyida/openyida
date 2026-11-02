const querystring = require('querystring');

const { loadAuthData, triggerLogin, resolveBaseUrl, httpPost, requestWithAutoLogin } = require('../core/utils');
const { t } = require('../core/i18n');
const { normalizeYidaLocale, resolveContentLocale } = require('../core/yida-i18n');
const { banner, step, label, success, fail, warn, info, error, result, usage } = require('../core/chalk');
const { throwCommandError, throwUsage } = require('../core/command-errors');
const { readRenderNav } = require('./application-entry-urls');

function parseArgs(inputArgs = process.argv.slice(2)) {
  const args = [...inputArgs];
  let locale = null;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--locale' || arg === '--content-locale' || arg === '--lang') {
      locale = args[i + 1];
      if (!normalizeYidaLocale(locale)) {
        throwUsage(t('update_form_config.usage'), t('update_form_config.example'));
      }
      args.splice(i, 2);
      i--;
    }
  }
  if (args.length < 4) {
    usage(t('update_form_config.usage'), t('update_form_config.example'));
    info(t('update_form_config.params_label'));
    label(t('update_form_config.param_is_render_nav'), '');
    label(t('update_form_config.param_title'), '');
    throwUsage(t('update_form_config.usage'), t('update_form_config.example'));
  }
  if (!['true', 'false', 'keep'].includes(args[2])) {
    throwUsage(t('update_form_config.usage'), t('update_form_config.example'));
  }
  return {
    appType: args[0],
    formUuid: args[1],
    isRenderNav: args[2],
    title: args[3],
    locale,
  };
}

// The broad endpoint can fill defaults for omitted fields. A navigation write
// requires a complete supported snapshot; title-only writes bypass this path.
const CONFIG_FIELDS = [
  'relateUuid', 'icon', 'pageType', 'showNav', 'isInner', 'url', 'isNew',
  'showRemark', 'showDelete', 'showDetail', 'showOperationLog',
  'showTerminate', 'showStash', 'isAgent', 'showAgent', 'customTitle',
  'displayTitle', 'displayType', 'consultTitle', 'consultPerson',
  'defaultManager', 'submissionRule', 'defaultOrder', 'needReportLine',
  'serialSwitch', 'serialExpression', 'serialPrefix', 'serialDateFormat',
  'serialSuffix', 'serialTimeZone', 'serialClean', 'serialCleanList',
  'serialInfo', 'formulaType', 'pushTask', 'redirectConfig',
  'showPrint', 'showAdd', 'showImport', 'showExport', 'showDingGroup',
  'showCopyData', 'reStart', 'previewConfig', 'isEncrypt',
  'detailTheme', 'openGroupMsg', 'procInstShowJoinGroup', 'reStartLatest',
  'approvalRedirect', 'manageCustomActionInfo', 'manageCustomConfigInfo',
];

function requireCurrentConfig(currentConfig) {
  if (!currentConfig || typeof currentConfig !== 'object'
    || Array.isArray(currentConfig) || Object.keys(currentConfig).length === 0) {
    throwCommandError(t('get_form_config.read_failed', t('common.request_failed_label')), {
      code: 'CONFIG_READ_FAILED',
    });
  }
}

function buildInfoPostData(csrfToken, formUuid) {
  return querystring.stringify({
    _api: 'Form.getFormSchemaInfo',
    _csrf_token: csrfToken,
    _locale_time_zone_offset: '28800000',
    formUuid: formUuid,
  });
}

// Read current settings before any write; the caller rejects unreadable data.
async function fetchFormSchemaInfo(authRef, appType, formUuid) {
  const resp = await requestWithAutoLogin((ref) => httpPost(
    ref.baseUrl,
    `/dingtalk/web/${appType}/query/formdesign/getFormSchemaInfo.json`,
    buildInfoPostData(ref.csrfToken, formUuid)
  ), authRef);
  if (!resp || resp.__needLogin || resp.__csrfExpired || resp.success === false) {
    return null;
  }
  return resp.content || resp.result || resp.data || null;
}

function readCurrentTitle(currentConfig) {
  let currentTitle = currentConfig.title;
  if (typeof currentTitle === 'string') {
    try { currentTitle = JSON.parse(currentTitle); } catch { currentTitle = null; }
  }
  if (!currentTitle || typeof currentTitle !== 'object' || Array.isArray(currentTitle)) {
    throwCommandError(t('get_form_config.read_failed', t('common.request_failed_label')), {
      code: 'CONFIG_READ_FAILED',
    });
  }
  return currentTitle;
}

// Request binding may replace empty values on these defaulted fields as well.
const DEFAULTED_FIELDS = new Set([
  'pageType', 'showNav', 'isInner', 'isNew', 'showRemark', 'showDelete',
  'showDetail', 'showOperationLog', 'showTerminate', 'showStash', 'isAgent',
  'showAgent', 'defaultManager', 'showDingGroup', 'reStart', 'isEncrypt',
]);

function buildPostData(csrfToken, formUuid, isRenderNav, title, currentConfig, locale = 'zh_CN') {
  requireCurrentConfig(currentConfig);
  const titleJson = JSON.stringify({ ...readCurrentTitle(currentConfig), [locale]: title });
  const preservedConfig = {};
  for (const key of CONFIG_FIELDS) {
    const sourceKey = key === 'relateUuid' && Object.prototype.hasOwnProperty.call(currentConfig, 'relateFormUuid')
      ? 'relateFormUuid' : key;
    const value = currentConfig[sourceKey];
    if (value === null || value === undefined || (value === '' && DEFAULTED_FIELDS.has(key))) {
      throwCommandError(t('update_form_config.preservation_unsupported', sourceKey), {
        code: 'CONFIG_PRESERVATION_UNSUPPORTED', details: { field: sourceKey },
      });
    }
    // The read API exposes needReportLine as a boolean; the write API stores y/n.
    preservedConfig[key] = key === 'needReportLine' && typeof value === 'boolean'
      ? (value ? 'y' : 'n')
      : (typeof value === 'object' ? JSON.stringify(value) : value);
  }

  return querystring.stringify({
    _api: 'Form.updateFormSchemaInfo',
    _csrf_token: csrfToken,
    _locale_time_zone_offset: '28800000',
    formUuid,
    ...preservedConfig,
    title: titleJson,
    isRenderNav,
  });
}


function sendPostRequest(baseUrl, requestPath, postData) {
  return httpPost(baseUrl, requestPath, postData);
}

async function run(args = process.argv.slice(2)) {
  const { appType, formUuid, isRenderNav, title, locale } = parseArgs(args);
  const keepNav = isRenderNav === 'keep';

  banner(t('update_form_config.title'));
  label('App ID:', appType);
  label('Form UUID:', formUuid);
  label('Render Nav:', keepNav ? 'keep' : (isRenderNav === 'true' ? t('common.yes') : t('common.no')));
  label('Title:', title);

  step(1, t('common.step_login_label'));
  let authData = loadAuthData();
  if (!authData) {
    warn(t('common.no_login_cache'));
    authData = triggerLogin();
  }
  const authRef = {
    baseUrl: resolveBaseUrl(authData),
    authData,
    authMode: authData.auth_mode || '',
    authSource: authData.auth_source || '',
    corpId: authData.corp_id || '',
    userId: authData.user_id || '',
  };
  const baseUrl = authRef.baseUrl;
  success(t('common.login_ready', baseUrl));
  const contentLocale = resolveContentLocale({ locale, baseUrl });
  label('Locale:', contentLocale);

  // Step 2：读取当前配置，保证除 title/isRenderNav 外的设置不被覆盖
  step(2, t('update_form_config.step_read'));
  info(t('get_form_config.sending_request'));
  const currentConfig = await fetchFormSchemaInfo(authRef, appType, formUuid);
  requireCurrentConfig(currentConfig);
  success(t('update_form_config.read_ok'));

  // A keep request must not silently switch navigation when the read is incomplete.
  const currentRenderNav = readRenderNav(currentConfig);
  if (keepNav && currentRenderNav === null) {
    throwCommandError(t('get_form_config.read_failed', t('common.request_failed_label')), {
      code: 'CONFIG_READ_FAILED',
    });
  }
  // The read API exposes renderNav; the write API still accepts isRenderNav.
  const effectiveNav = keepNav ? String(currentRenderNav) : isRenderNav;
  const currentTitle = readCurrentTitle(currentConfig);
  const expectedTitle = { ...currentTitle, [contentLocale]: title };
  const navChanged = currentRenderNav === null || String(currentRenderNav) !== effectiveNav;
  const navMessage = keepNav
    ? t('update_form_config.nav_kept')
    : (effectiveNav === 'true' ? t('update_form_config.nav_shown') : t('update_form_config.nav_hidden'));

  // Check before the broad-write guard: unchanged sparse forms need no save.
  if (!navChanged && currentTitle[contentLocale] === title) {
    const message = t('update_form_config.unchanged');
    result(true, message);
    console.log(JSON.stringify({
      success: true, changed: false, mutationPerformed: false,
      isRenderNav: effectiveNav === 'true', navKept: keepNav, configPreserved: true, message,
    }, null, 2));
    return;
  }

  step(3, t('update_form_config.step_update'));
  const endpoint = navChanged ? 'updateFormSchemaInfo.json' : 'updateFormTitle.json';
  info(t('update_form_config.sending_request', endpoint));
  // buildPostData rejects unsafe snapshots before sendPostRequest is called.
  // Never fall back from a failed title-only write to a broad configuration save.
  const apiResult = await requestWithAutoLogin((ref) => sendPostRequest(
    ref.baseUrl,
    `/dingtalk/web/${appType}/query/formdesign/${endpoint}`,
    navChanged ? buildPostData(ref.csrfToken, formUuid, effectiveNav, title, currentConfig, contentLocale)
      : querystring.stringify({
        _api: 'Form.updateTitle', _csrf_token: ref.csrfToken, _locale_time_zone_offset: '28800000',
        formUuid, title: JSON.stringify(expectedTitle),
      })
  ), authRef);

  if (apiResult && !apiResult.__needLogin && !apiResult.__csrfExpired) {

    if (apiResult.success) {
      result(true, t('update_form_config.update_ok'), [
        ['Render Nav', navMessage],
      ]);
      console.log(JSON.stringify({
        success: true,
        isRenderNav: effectiveNav === 'true',
        navKept: keepNav,
        configPreserved: !!currentConfig,
        message: navMessage
      }, null, 2));
    } else {
      const message = apiResult.errorMsg || t('update_form_config.update_failed_msg');
      result(false, t('update_form_config.update_failed', apiResult.errorMsg || t('common.unknown_error')));
      console.log(JSON.stringify({
        success: false,
        message,
        errorCode: apiResult.errorCode
      }, null, 2));
      throwCommandError(message, { code: apiResult.errorCode });
    }
  } else {
    fail(t('common.request_failed_label'));
    throwCommandError(t('common.request_failed_label'));
  }
}

if (require.main === module) {
  run().catch((err) => {
    error(t('common.exception', err.message));
    process.exitCode = err && err.exitCode ? err.exitCode : 1;
  });
}

module.exports = {
  run,
  parseArgs,
  buildPostData,
};
