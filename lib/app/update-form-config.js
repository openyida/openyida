const querystring = require('querystring');

const { loadAuthData, triggerLogin, resolveBaseUrl, httpPost, requestWithAutoLogin } = require('../core/utils');
const { t } = require('../core/i18n');
const { buildYidaTitleI18n, normalizeYidaLocale, resolveContentLocale } = require('../core/yida-i18n');
const { banner, step, label, success, fail, warn, info, error, result, usage } = require('../core/chalk');
const { throwCommandError, throwUsage } = require('../core/command-errors');

function parseArgs(inputArgs = process.argv.slice(2)) {
  const args = [...inputArgs];
  let locale = null;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === '--locale' || arg === '--content-locale' || arg === '--lang') && args[i + 1]) {
      locale = args[i + 1];
      if (!normalizeYidaLocale(locale)) {
        error(`Unsupported locale: ${locale}`);
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
  return {
    appType: args[0],
    formUuid: args[1],
    isRenderNav: args[2],
    title: args[3],
    locale,
  };
}

// Only round-trip supported fields that actually exist. Filling absent values
// with defaults changes unrelated settings on sparse/new forms.
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

// 读-改-写：以当前配置为基底，仅覆盖 title 与 isRenderNav，其余字段保留不变。
function buildPostData(csrfToken, formUuid, isRenderNav, title, currentConfig) {
  const titleJson = JSON.stringify(buildYidaTitleI18n(title, {
    en_US: title,
    ja_JP: title,
  }));

  requireCurrentConfig(currentConfig);
  const preservedConfig = {};
  for (const key of CONFIG_FIELDS) {
    const value = currentConfig[key];
    if (value !== null && value !== undefined) {
      // The read API exposes needReportLine as a boolean, while the write
      // API stores a y/n flag. Sending literal true silently turns it off.
      preservedConfig[key] = key === 'needReportLine' && typeof value === 'boolean'
        ? (value ? 'y' : 'n')
        : (typeof value === 'object' ? JSON.stringify(value) : value);
    }
  }
  if (currentConfig.relateFormUuid !== null && currentConfig.relateFormUuid !== undefined) {
    preservedConfig.relateUuid = currentConfig.relateFormUuid;
  }

  return querystring.stringify({
    _api: 'Form.updateFormSchemaInfo',
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
  label('Locale:', resolveContentLocale({ locale, baseUrl }));

  // Step 2：读取当前配置，保证除 title/isRenderNav 外的设置不被覆盖
  step(2, t('update_form_config.step_read'));
  info(t('update_form_config.sending_request'));
  const currentConfig = await fetchFormSchemaInfo(authRef, appType, formUuid);
  requireCurrentConfig(currentConfig);
  success(t('update_form_config.read_ok'));

  // A keep request must not silently switch navigation when the read is incomplete.
  if (keepNav && ![true, false, 'true', 'false'].includes(currentConfig.isRenderNav)) {
    throwCommandError(t('get_form_config.read_failed', t('common.request_failed_label')), {
      code: 'CONFIG_READ_FAILED',
    });
  }
  const effectiveNav = keepNav ? String(currentConfig.isRenderNav) : isRenderNav;

  step(3, t('update_form_config.step_update'));
  info(t('update_form_config.sending_request'));
  const apiResult = await requestWithAutoLogin((ref) => sendPostRequest(
    ref.baseUrl,
    `/dingtalk/web/${appType}/query/formdesign/updateFormSchemaInfo.json`,
    buildPostData(ref.csrfToken, formUuid, effectiveNav, title, currentConfig)
  ), authRef);

  const navMessage = keepNav
    ? t('update_form_config.nav_kept')
    : (effectiveNav === 'true' ? t('update_form_config.nav_shown') : t('update_form_config.nav_hidden'));

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
