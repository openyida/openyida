const querystring = require('querystring');

const { loadAuthData, triggerLogin, resolveBaseUrl, httpPost, requestWithAutoLogin } = require('../core/utils');
const { t } = require('../core/i18n');
const { buildYidaTitleI18n, normalizeYidaLocale, resolveContentLocale } = require('../core/yida-i18n');
const { banner, step, label, success, fail, warn, info, error, result, usage } = require('../core/chalk');

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
    process.exit(1);
  }
  return {
    appType: args[0],
    formUuid: args[1],
    isRenderNav: args[2],
    title: args[3],
    locale,
  };
}

function buildPostData(csrfToken, formUuid, isRenderNav, title) {
  const titleJson = JSON.stringify(buildYidaTitleI18n(title, {
    en_US: title,
    ja_JP: title,
  }));

  return querystring.stringify({
    _api: 'Form.updateFormSchemaInfo',
    _csrf_token: csrfToken,
    _locale_time_zone_offset: '28800000',
    formUuid: formUuid,
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
    isRenderNav: isRenderNav,
    manageCustomActionInfo: '[]',
  });
}


function sendPostRequest(baseUrl, requestPath, postData) {
  return httpPost(baseUrl, requestPath, postData);
}

async function main() {
  const { appType, formUuid, isRenderNav, title, locale } = parseArgs();

  banner(t('update_form_config.title'));
  label('App ID:', appType);
  label('Form UUID:', formUuid);
  label('Render Nav:', isRenderNav === 'true' ? t('common.yes') : t('common.no'));
  label('Title:', title);

  step(1, t('common.step_login_label'));
  let authData = loadAuthData();
  if (!authData) {
    warn(t('common.no_login_cache'));
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
  const baseUrl = authRef.baseUrl;
  success(t('common.login_ready', baseUrl));
  label('Locale:', resolveContentLocale({ locale, baseUrl }));

  step(2, t('update_form_config.step_update'));
  info(t('update_form_config.sending_request'));
  const apiResult = await requestWithAutoLogin((ref) => sendPostRequest(
    ref.baseUrl,
    `/dingtalk/web/${appType}/query/formdesign/updateFormSchemaInfo.json`,
    buildPostData(ref.csrfToken, formUuid, isRenderNav, title)
  ), authRef);

  if (apiResult && !apiResult.__needLogin && !apiResult.__csrfExpired) {
    if (apiResult.success) {
      result(true, t('update_form_config.update_ok'), [
        ['Render Nav', isRenderNav === 'true' ? t('update_form_config.nav_shown') : t('update_form_config.nav_hidden')],
      ]);
      console.log(JSON.stringify({
        success: true,
        isRenderNav: isRenderNav === 'true',
        message: isRenderNav === 'true' ? t('update_form_config.nav_shown') : t('update_form_config.nav_hidden')
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
    process.exit(1);
  }
}

main().catch((err) => {
  error(t('common.exception', err.message));
});
