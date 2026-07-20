'use strict';

const { createYidaClient } = require('../core/yida-client');
const { parseYidaI18n } = require('../core/yida-i18n');
const { t } = require('../core/i18n');

function resolveLocalizedText(value, fallback = '') {
  return parseYidaI18n(value, fallback, { parseJson: false });
}

function normalizeFormNavigationNode(node) {
  if (!node || node.navType === 'SYSTEM' || !node.formUuid) {
    return null;
  }

  return {
    formUuid: node.formUuid,
    formName: resolveLocalizedText(node.title || node.i18nTitle || node.name, t('list_forms.unnamed_form')),
    formType: node.formType || '',
    pathName: node.pathName || '',
  };
}

async function fetchFormPageList(appType, authRef) {
  const result = await createYidaClient({ authRef }).get(
    `/dingtalk/web/${appType}/query/formnav/getFormNavigationListByOrder.json`,
    { _api: 'Nav.queryList', _mock: false }
  );

  if (!result || result.success === false) {
    throw new Error(
      t('list_forms.fetch_failed') + ': ' +
      (result ? result.errorMsg || t('common.unknown_error') : t('common.request_failed'))
    );
  }

  const items = Array.isArray(result.content) ? result.content : [];
  return items
    .map(normalizeFormNavigationNode)
    .filter(Boolean);
}

module.exports = {
  fetchFormPageList,
  normalizeFormNavigationNode,
  resolveLocalizedText,
};
