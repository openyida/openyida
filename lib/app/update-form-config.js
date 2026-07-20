const querystring = require('querystring');

const { loadAuthData, triggerLogin, resolveBaseUrl, httpPost, requestWithAutoLogin } = require('../core/utils');
const { t } = require('../core/i18n');
const { buildYidaTitleI18n, normalizeYidaLocale, resolveContentLocale } = require('../core/yida-i18n');
const { banner, step, label, success, fail, warn, info, error, result, usage } = require('../core/chalk');
const { throwCommandError, throwUsage } = require('../core/command-errors');

function parseArgs() {
  const args = process.argv.slice(2);
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

// updateFormSchemaInfo 接受的配置字段（仅这些字段会被服务端重写）；
// 读不到当前值时回退到以下默认值，避免与老版行为相比造成额外差异。
const CONFIG_DEFAULTS = {
  serialSwitch: 'n',
  consultPerson: '',
  defaultManager: 'n',
  submissionRule: 'RESUBMIT',
  redirectConfig: '',
  pushTask: 'y',
  defaultOrder: 'cd',
  showPrint: 'y',
  relateUuid: '',
  pageType: 'web,mobile',
  isInner: 'y',
  isNew: 'n',
  isAgent: 'y',
  showAgent: 'n',
  showDingGroup: 'y',
  reStart: 'n',
  previewConfig: 'y',
  formulaType: 'n',
  displayTitle: '${legao_creator}发起的${legao_formname}',
  displayType: 'RE',
  isRenderNav: 'true',
  manageCustomActionInfo: '[]',
};

// 优先采用当前配置值，为空时回退到默认值；对象/数组值序列化为 JSON 字符串。
function pickConfig(currentConfig, key) {
  const value = currentConfig ? currentConfig[key] : undefined;
  if (value === null || value === undefined) {
    return CONFIG_DEFAULTS[key];
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value;
}

function buildInfoPostData(csrfToken, formUuid) {
  return querystring.stringify({
    _api: 'Form.getFormSchemaInfo',
    _csrf_token: csrfToken,
    _locale_time_zone_offset: '28800000',
    formUuid: formUuid,
  });
}

// 读取当前表单配置（getFormSchemaInfo），失败时返回 null 以便上层回退默认。
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

  return querystring.stringify({
    _api: 'Form.updateFormSchemaInfo',
    _locale_time_zone_offset: '28800000',
    formUuid: formUuid,
    serialSwitch: pickConfig(currentConfig, 'serialSwitch'),
    consultPerson: pickConfig(currentConfig, 'consultPerson'),
    defaultManager: pickConfig(currentConfig, 'defaultManager'),
    submissionRule: pickConfig(currentConfig, 'submissionRule'),
    redirectConfig: pickConfig(currentConfig, 'redirectConfig'),
    pushTask: pickConfig(currentConfig, 'pushTask'),
    defaultOrder: pickConfig(currentConfig, 'defaultOrder'),
    showPrint: pickConfig(currentConfig, 'showPrint'),
    relateUuid: pickConfig(currentConfig, 'relateUuid'),
    title: titleJson,
    pageType: pickConfig(currentConfig, 'pageType'),
    isInner: pickConfig(currentConfig, 'isInner'),
    isNew: pickConfig(currentConfig, 'isNew'),
    isAgent: pickConfig(currentConfig, 'isAgent'),
    showAgent: pickConfig(currentConfig, 'showAgent'),
    showDingGroup: pickConfig(currentConfig, 'showDingGroup'),
    reStart: pickConfig(currentConfig, 'reStart'),
    previewConfig: pickConfig(currentConfig, 'previewConfig'),
    formulaType: pickConfig(currentConfig, 'formulaType'),
    displayTitle: pickConfig(currentConfig, 'displayTitle'),
    displayType: pickConfig(currentConfig, 'displayType'),
    isRenderNav: isRenderNav,
    manageCustomActionInfo: pickConfig(currentConfig, 'manageCustomActionInfo'),
  });
}


function sendPostRequest(baseUrl, requestPath, postData) {
  return httpPost(baseUrl, requestPath, postData);
}

async function main() {
  const { appType, formUuid, isRenderNav, title, locale } = parseArgs();
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
  if (currentConfig) {
    success(t('update_form_config.read_ok'));
  } else {
    warn(t('update_form_config.read_failed_fallback'));
  }

  // keep 模式：沿用当前导航设置（读不到时回退 true）
  const effectiveNav = keepNav
    ? String(currentConfig && currentConfig.isRenderNav !== undefined && currentConfig.isRenderNav !== null
      ? currentConfig.isRenderNav
      : 'true')
    : isRenderNav;

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
      result(false, t('update_form_config.update_failed', apiResult.errorMsg || t('common.unknown_error')));
      console.log(JSON.stringify({
        success: false,
        message: apiResult.errorMsg || t('update_form_config.update_failed_msg'),
        errorCode: apiResult.errorCode
      }, null, 2));
    }
  } else {
    fail(t('common.request_failed_label'));
    throwCommandError(t('common.request_failed_label'));
  }
}

main().catch((err) => {
  error(t('common.exception', err.message));
  process.exitCode = err && err.exitCode ? err.exitCode : 1;
});
