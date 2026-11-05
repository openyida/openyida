'use strict';

const { httpGet, requestWithAutoLogin } = require('../core/utils');
const { throwCommandError } = require('../core/command-errors');
const { t } = require('../core/i18n');
const { isAgentAppType } = require('./agent-app-type');

function themeContextFailure(reason) {
  throwCommandError(t('upgrade_app_theme.context_failed'), {
    code: 'APP_THEME_CONTEXT_UNVERIFIED', details: { reason },
  });
}

// The application API exposes persisted mode/provenance. These establish the
// configured theme, not proof that a browser loaded the stylesheet.
function resolveAppThemeState(app = {}) {
  const config = app.config && typeof app.config === 'object' && !Array.isArray(app.config) ? app.config : {};
  const mode = app.appThemeMode ?? config.APP_THEME_MODE;
  const enabled = app.appThemeEnable;
  const createdModern = config.CREATED_WITH_MODERN_THEME;
  if (enabled === 'n' || mode === 'legacy' || createdModern === 'n') {
    return { mode: 'legacy', source: 'server_settings' };
  }
  if (enabled === 'y' && mode === 'modern') {
    return { mode: 'modern', source: 'server_theme_state' };
  }
  if (enabled !== undefined && enabled !== null && enabled !== 'y') {
    return { mode: 'unknown', source: 'server_settings' };
  }
  if (createdModern === 'y' &&
      (mode === 'modern' || ((mode === undefined || mode === null || mode === '') && isAgentAppType(app.agentAppType)))) {
    return { mode: 'modern', source: 'server_creation_config' };
  }
  return { mode: 'unknown', source: 'server_settings' };
}

async function fetchCurrentApp(appType, authRef, verifyIdentity = false) {
  const target = { baseUrl: authRef.baseUrl, corpId: authRef.corpId, userId: authRef.userId };
  if (verifyIdentity && (typeof appType !== 'string' || !/^[A-Za-z0-9_-]+$/.test(appType) ||
      typeof target.corpId !== 'string' || !target.corpId || !target.baseUrl)) {
    themeContextFailure('invalid_target');
  }
  const assertIdentity = auth => {
    if (verifyIdentity && Object.keys(target).some(key => auth[key] !== target[key])) {
      themeContextFailure('identity_changed');
    }
  };
  const response = await requestWithAutoLogin((auth) => {
    assertIdentity(auth);
    return httpGet(
      auth.baseUrl,
      `/${encodeURIComponent(appType)}/query/app/getAppIncludingAecpInfo.json`,
      {
        _api: 'nattyFetch',
        _mock: 'false',
        appKey: appType,
        _csrf_token: auth.csrfToken,
        _stamp: Date.now(),
      }
    );
  }, authRef);
  assertIdentity(authRef);

  if (verifyIdentity) {
    const app = response?.content;
    if (response?.success !== true || !app || typeof app !== 'object' || Array.isArray(app)) {
      themeContextFailure('app_query_failed');
    }
    // The response corpId identifies the app owner. The auth snapshot tracks the login organization.
    if (app.appType !== appType) {
      themeContextFailure('app_identity_mismatch');
    }
  }

  if (!response || !response.success) {
    throw new Error(response ? response.errorMsg || '查询应用详情失败' : '查询应用详情失败');
  }
  return response.content || {};
}

module.exports = { fetchCurrentApp, resolveAppThemeState };
