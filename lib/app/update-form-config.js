const https = require('https');
const http = require('http');
const querystring = require('querystring');

const { loadCookieData, triggerLogin, refreshCsrfToken, resolveBaseUrl, isLoginExpired, isCsrfTokenExpired } = require('../core/utils');
const { t } = require('../core/i18n');

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length < 4) {
    console.error(t('update_form_config.usage'));
    console.error(t('update_form_config.example'));
    console.error('');
    console.error(t('update_form_config.params_label'));
    console.error(t('update_form_config.param_is_render_nav'));
    console.error(t('update_form_config.param_title'));
    process.exit(1);
  }
  return {
    appType: args[0],
    formUuid: args[1],
    isRenderNav: args[2],
    title: args[3],
  };
}

function buildPostData(csrfToken, formUuid, isRenderNav, title) {
  const titleJson = JSON.stringify({
    pureEn_US: title,
    en_US: title,
    zh_CN: title,
    envLocale: null,
    type: 'i18n',
    ja_JP: null,
    key: null,
  });

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


function sendPostRequest(baseUrl, cookies, requestPath, postData) {
  return new Promise((resolve, reject) => {
    const cookieHeader = cookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join('; ');

    const parsedUrl = new URL(baseUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: requestPath,
      method: 'POST',
      headers: {
        Origin: baseUrl,
        Referer: baseUrl + '/',
        Cookie: cookieHeader,
        Accept: 'application/json, text/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-requested-with': 'XMLHttpRequest',
      },
      timeout: 30000,
    };

    const request = requestModule.request(requestOptions, (response) => {
      let responseData = '';
      response.on('data', (chunk) => { responseData += chunk; });
      response.on('end', () => {
        console.error(t('common.http_status', response.statusCode));
        let parsed;
        try {
          parsed = JSON.parse(responseData);
        } catch (parseError) {
          console.error(t('common.response_body', responseData.substring(0, 500)));
          resolve({ success: false, errorMsg: 'HTTP ' + response.statusCode + ': ' + t('common.response_not_json') });
          return;
        }
        if (isLoginExpired(parsed)) {
          console.error(t('common.login_expired', parsed.errorMsg));
          resolve({ __needLogin: true });
          return;
        }
        if (isCsrfTokenExpired(parsed)) {
          console.error(t('common.csrf_expired', parsed.errorMsg));
          resolve({ __csrfExpired: true });
          return;
        }
        resolve(parsed);
      });
    });

    request.on('timeout', () => {
      console.error(t('common.request_timeout'));
      request.destroy();
      reject(new Error(t('common.request_timeout')));
    });

    request.on('error', (requestError) => {
      reject(requestError);
    });

    request.write(postData);
    request.end();
  });
}

async function main() {
  const { appType, formUuid, isRenderNav, title } = parseArgs();

  console.error('='.repeat(50));
  console.error(t('update_form_config.title'));
  console.error('='.repeat(50));
  console.error(t('update_form_config.app_id', appType));
  console.error(t('update_form_config.form_uuid', formUuid));
  console.error(t('update_form_config.is_render_nav', isRenderNav === 'true' ? t('common.yes') : t('common.no')));
  console.error(t('update_form_config.page_title', title));

  console.error(t('common.step_login_label'));
  let cookieData = loadCookieData();
  if (!cookieData) {
    console.error(t('common.no_login_cache'));
    cookieData = triggerLogin();
  }
  let { cookies } = cookieData;
  let baseUrl = resolveBaseUrl(cookieData);
  console.error(t('common.login_ready', baseUrl));

  console.error(t('update_form_config.step_update'));
  console.error(t('update_form_config.sending_request'));
  let { csrf_token: csrfToken } = cookieData;

  const postData = buildPostData(csrfToken, formUuid, isRenderNav, title);

  let result = await sendPostRequest(
    baseUrl,
    cookies,
    `/dingtalk/web/${appType}/query/formdesign/updateFormSchemaInfo.json`,
    postData
  );

  if (result && result.__csrfExpired) {
    cookieData = refreshCsrfToken();
    csrfToken = cookieData.csrf_token;
    cookies = cookieData.cookies;
    baseUrl = resolveBaseUrl(cookieData);
    const newPostData = buildPostData(csrfToken, formUuid, isRenderNav, title);
    console.error(t('common.resend_csrf'));
    result = await sendPostRequest(
      baseUrl,
      cookies,
      `/dingtalk/web/${appType}/query/formdesign/updateFormSchemaInfo.json`,
      newPostData
    );
  }

  if (result && result.__needLogin) {
    cookieData = triggerLogin();
    csrfToken = cookieData.csrf_token;
    cookies = cookieData.cookies;
    baseUrl = resolveBaseUrl(cookieData);
    const newPostData = buildPostData(csrfToken, formUuid, isRenderNav, title);
    console.error(t('common.resend'));
    result = await sendPostRequest(
      baseUrl,
      cookies,
      `/dingtalk/web/${appType}/query/formdesign/updateFormSchemaInfo.json`,
      newPostData
    );
  }

  console.error('\n' + '='.repeat(50));
  if (result && !result.__needLogin && !result.__csrfExpired) {
    if (result.success) {
      console.error(t('update_form_config.update_ok'));
      console.error('='.repeat(50));
      console.log(JSON.stringify({
        success: true,
        isRenderNav: isRenderNav === 'true',
        message: isRenderNav === 'true' ? t('update_form_config.nav_shown') : t('update_form_config.nav_hidden')
      }, null, 2));
    } else {
      console.error(t('update_form_config.update_failed', result.errorMsg || t('common.unknown_error')));
      console.error('='.repeat(50));
      console.log(JSON.stringify({
        success: false,
        message: result.errorMsg || t('update_form_config.update_failed_msg'),
        errorCode: result.errorCode
      }, null, 2));
    }
  } else {
    console.error(t('common.request_failed_label'));
    console.error('='.repeat(50));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(t('common.exception', error.message));
  process.exit(1);
});
