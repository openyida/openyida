'use strict';

const querystring = require('querystring');
const { httpPost, requestWithAutoLogin } = require('../../core/utils');
const { buildYidaI18n } = require('../../core/yida-i18n');
const {
  dispatchRemotePrimitive,
  hasRemoteDispatchBoundary,
  rethrowRemoteDispatchBoundaryFailure,
} = require('../../schema/remote-dispatch-boundary');
const { isTokenAuthRef } = require('../../core/yida-client');

const DEFAULT_APP_OPTIONS = Object.freeze({
  icon: 'xian-yingyong',
  iconColor: '#0089FF',
  colour: 'deepBlue',
  navTheme: 'dark',
  layoutDirection: 'slide',
});

function createAppServiceError(message, code, details) {
  const error = new Error(message);
  error.code = code || 'APP_SERVICE_FAILED';
  if (details) {
    error.details = details;
  }
  return error;
}

function resolveAuthRef(context) {
  return context && context.authRef ? context.authRef : context;
}

function resolveServices(context) {
  const services = context && context.services || {};
  return {
    httpPost: services.httpPost || httpPost,
    requestWithAutoLogin: services.requestWithAutoLogin || requestWithAutoLogin,
  };
}

async function readExclusiveAppConfig(context) {
  const authRef = resolveAuthRef(context);
  const services = resolveServices(context);
  let openExclusive = 'n';
  let openPhysicColumn = 'n';

  try {
    const result = await dispatchRemotePrimitive(context, () => services.httpPost(
      authRef.baseUrl,
      `/query/exclusive/queryCorpAppConfig.json?_api=Global.queryCorpAppConfig&_mock=false&_csrf_token=${authRef.csrfToken}&_locale_time_zone_offset=28800000&_stamp=${Date.now()}`,
      '',
      authRef.cookies
    ));
    if (result && result.content) {
      if (result.content.forceExclusiveDb === 'y') {
        openExclusive = 'y';
      }
      if (result.content.forcePhysicalColumn === 'y') {
        openPhysicColumn = 'y';
      }
    }
  } catch (error) {
    rethrowRemoteDispatchBoundaryFailure(error);
    // This lookup is advisory; legacy create-app also falls back to defaults.
  }

  return { openExclusive, openPhysicColumn };
}

async function createAppResource(context, input = {}) {
  const authRef = resolveAuthRef(context);
  const services = resolveServices(context);
  const appName = input.appName || input.name;
  if (!appName) {
    throw createAppServiceError('app name is required', 'APP_CREATE_INVALID_ARGUMENTS');
  }

  const description = input.description || appName;
  const icon = input.icon || DEFAULT_APP_OPTIONS.icon;
  const iconColor = input.iconColor || DEFAULT_APP_OPTIONS.iconColor;
  const colour = input.colour || DEFAULT_APP_OPTIONS.colour;
  const navTheme = input.navTheme || DEFAULT_APP_OPTIONS.navTheme;
  const layoutDirection = input.layoutDirection || DEFAULT_APP_OPTIONS.layoutDirection;
  const contentLocale = input.contentLocale || input.defaultLanguage || 'zh_CN';
  const exclusive = await readExclusiveAppConfig(context);
  const iconValue = `${icon}%%${iconColor}`;

  const response = await dispatchAppWrite(context, services, authRef, (auth) => {
    const postData = querystring.stringify({
      _csrf_token: auth.csrfToken,
      appName: JSON.stringify(buildYidaI18n(appName, { en_US: appName, ja_JP: appName })),
      description: JSON.stringify(buildYidaI18n(description, { en_US: description, ja_JP: description })),
      icon: iconValue,
      iconUrl: iconValue,
      colour,
      navTheme,
      layoutDirection,
      defaultLanguage: contentLocale,
      openExclusive: exclusive.openExclusive,
      openPhysicColumn: exclusive.openPhysicColumn,
      openIsolationDatabase: 'n',
      openExclusiveUnit: 'n',
      group: 'ALL',
    });
    return services.httpPost(auth.baseUrl, '/query/app/registerApp.json', postData, auth.cookies);
  });

  if (!response || !response.success || !response.content) {
    throw createAppServiceError(
      response && response.errorMsg || 'app create request failed',
      'APP_CREATE_FAILED',
      { result: sanitizeServiceResult(response) }
    );
  }

  return {
    appType: response.content,
    appName,
    response,
  };
}

async function updateAppResource(context, input = {}) {
  const authRef = resolveAuthRef(context);
  const services = resolveServices(context);
  const appType = input.appType;
  if (!appType) {
    throw createAppServiceError('appType is required', 'APP_UPDATE_INVALID_ARGUMENTS');
  }

  const updateFields = {
    _locale_time_zone_offset: '28800000',
    appType,
  };
  if (input.name) {
    updateFields.appName = JSON.stringify(buildYidaI18n(input.name, {
      en_US: input.name,
      ja_JP: input.name,
    }, { includePureEn: true }));
  }
  if (input.desc) {
    updateFields.description = JSON.stringify(buildYidaI18n(input.desc, {
      en_US: input.desc,
      ja_JP: input.desc,
    }));
  }
  if (input.icon) {
    const iconValue = `${input.icon}%%${input.iconColor || DEFAULT_APP_OPTIONS.iconColor}`;
    updateFields.icon = iconValue;
    updateFields.iconUrl = iconValue;
  }
  if (input.colour) {
    updateFields.colour = input.colour;
  }
  if (input.navTheme) {
    updateFields.navTheme = input.navTheme;
  }
  if (input.layoutDirection) {
    updateFields.layoutDirection = input.layoutDirection;
  }

  const response = await dispatchAppWrite(context, services, authRef, (auth) => {
    const postDataObject = {
      _csrf_token: auth.csrfToken,
      ...updateFields,
    };
    return services.httpPost(
      auth.baseUrl,
      `/query/app/updateAppName.json?_api=Form.updateAppName&_mock=false&_stamp=${Date.now()}`,
      querystring.stringify(postDataObject),
      auth.cookies
    );
  });

  if (!response || !response.success) {
    throw createAppServiceError(
      response && response.errorMsg || 'app update request failed',
      'APP_UPDATE_FAILED',
      { result: sanitizeServiceResult(response) }
    );
  }

  return { appType, response };
}

async function dispatchAppWrite(context, services, authRef, callback) {
  if (!hasRemoteDispatchBoundary(context)) {
    return services.requestWithAutoLogin(callback, authRef);
  }
  requireAppWriteAuth(authRef);
  return dispatchRemotePrimitive(context, () => callback(authRef));
}

function requireAppWriteAuth(authRef) {
  if (!authRef || typeof authRef.baseUrl !== 'string' || !authRef.baseUrl) {
    throw createAppServiceError(
      'app write authentication is not ready',
      'APP_WRITE_PRECHECK_FAILED'
    );
  }
  if (isTokenAuthRef(authRef)) {
    return authRef;
  }
  if (
    typeof authRef.csrfToken !== 'string' || !authRef.csrfToken ||
    !Array.isArray(authRef.cookies)
  ) {
    throw createAppServiceError(
      'app write authentication is not ready',
      'APP_WRITE_PRECHECK_FAILED'
    );
  }
  return authRef;
}

function sanitizeServiceResult(result) {
  if (!result || typeof result !== 'object') {
    return result || null;
  }
  const sanitized = {};
  ['success', 'errorMsg', 'errorCode', 'code', 'message'].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(result, key)) {
      sanitized[key] = result[key];
    }
  });
  return sanitized;
}

module.exports = {
  DEFAULT_APP_OPTIONS,
  createAppResource,
  createAppServiceError,
  updateAppResource,
};
