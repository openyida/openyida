/**
 * get-page-config.js - 宜搭页面公开访问/分享配置查询命令
 *
 * 用法：yidacli get-page-config <appType> <formUuid>
 */

"use strict";

const querystring = require("querystring");
const {
  loadCookieData,
  triggerLogin,
  refreshCsrfToken,
  resolveBaseUrl,
  httpPost,
  requestWithAutoLogin,
} = require("../core/utils");
const { t } = require("../core/i18n");

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error(t("get_page_config.usage"));
    console.error(t("get_page_config.example"));
    process.exit(1);
  }
  return { appType: args[0], formUuid: args[1] };
}

async function main() {
  const { appType, formUuid } = parseArgs();

  console.error("=".repeat(50));
  console.error(t("get_page_config.title"));
  console.error("=".repeat(50));
  console.error(t("get_page_config.app_id", appType));
  console.error(t("get_page_config.form_uuid", formUuid));

  // Step 1: 读取登录态
  console.error(t("common.step_login_label"));
  let cookieData = loadCookieData();
  if (!cookieData) {
    console.error(t("common.no_login_cache"));
    cookieData = triggerLogin();
  }

  const authRef = {
    csrfToken: cookieData.csrf_token,
    cookies: cookieData.cookies,
    baseUrl: resolveBaseUrl(cookieData),
    cookieData,
  };
  console.error(t("common.login_ready", authRef.baseUrl));

  // Step 2: 查询分享配置
  console.error(t("get_page_config.step_query"));
  console.error(t("get_page_config.sending_request"));

  const shareConfig = await requestWithAutoLogin((auth) => {
    const postData = querystring.stringify({
      _api: "Share.getShareConfig",
      _csrf_token: auth.csrfToken,
      _locale_time_zone_offset: "28800000",
      formUuid,
    });
    return httpPost(
      auth.baseUrl,
      `/dingtalk/web/${appType}/query/formdesign/getShareConfig.json`,
      postData,
      auth.cookies
    );
  }, authRef);

  // 输出结果
  console.error("\n" + "=".repeat(50));
  if (shareConfig && shareConfig.success !== false && !shareConfig.__needLogin && !shareConfig.__csrfExpired) {
    const content = shareConfig.content || {};
    const result = {
      isOpen: content.isOpen === "y",
      openUrl: content.openUrl || null,
      shareUrl: content.shareUrl || null,
    };

    console.error(t("get_page_config.query_ok"));
    console.error("=".repeat(50));

    if (result.openUrl) console.error(t("get_page_config.open_url", authRef.baseUrl + result.openUrl));
    if (result.shareUrl) console.error(t("get_page_config.share_url", authRef.baseUrl + result.shareUrl));
    if (!result.openUrl && !result.shareUrl) console.error(t("get_page_config.no_config"));

    console.log(JSON.stringify(result, null, 2));
  } else {
    const errorMsg = shareConfig ? shareConfig.errorMsg || t("common.unknown_error") : t("common.request_failed");
    console.error(t("get_page_config.query_failed", errorMsg));
    console.error("=".repeat(50));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(t("common.exception", error.message));
  process.exit(1);
});
