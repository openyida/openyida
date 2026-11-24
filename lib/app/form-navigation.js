'use strict';

const { createYidaClient } = require('../core/yida-client');
const { parseYidaI18n } = require('../core/yida-i18n');
const { t } = require('../core/i18n');

function resolveLocalizedText(value, fallback = '') {
  return parseYidaI18n(value, fallback, { parseJson: false });
}

function normalizeFormNavigationNode(node, options = {}) {
  if (!node || node.navType === 'SYSTEM' || !node.formUuid) {
    return null;
  }

  return {
    formUuid: node.formUuid,
    formName: resolveLocalizedText(
      node.title || node.i18nTitle || node.formTitle || node.name,
      t('list_forms.unnamed_form')
    ),
    formType: node.formType || '',
    pathName: node.pathName || '',
    ...(options.includeNavigation ? {
      hidden: ['y', true].includes(node.hidden) ? true : ['n', false].includes(node.hidden) ? false : null,
      mobileHidden: ['y', true].includes(node.mobileHidden) ? true : ['n', false].includes(node.mobileHidden) ? false : null,
    } : {}),
  };
}

async function fetchFormPageList(appType, authRef, options = {}) {
  const result = await createYidaClient({ authRef }).get(
    `/dingtalk/web/${appType}/query/formnav/getFormNavigationListByOrder.json`,
    { _api: 'Nav.queryList', _mock: false }
  );

  if (!result || result.success === false) {
    const error = new Error(
      t('list_forms.fetch_failed') + ': ' +
      (result ? result.errorMsg || t('common.unknown_error') : t('common.request_failed'))
    );
    if (result?.refreshDiagnostic) {error.details = { refreshDiagnostic: result.refreshDiagnostic };}
    throw error;
  }

  const items = Array.isArray(result.content) ? result.content : [];
  return items
    .map(node => normalizeFormNavigationNode(node, options))
    .filter(Boolean);
}

module.exports = {
  fetchFormPageList,
  normalizeFormNavigationNode,
  resolveLocalizedText,
};
