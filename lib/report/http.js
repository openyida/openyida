'use strict';

const { createYidaClient } = require('../core/yida-client');
const { buildYidaI18n } = require('../core/yida-i18n');
const { requireSchemaServerRevision } = require('../core/server-revision');
const {
  REPORT_DOMAIN_CODE,
  collectReportI18nKeys,
  prepareReportSchemaForSave,
} = require('./contract');

/**
 * 调用 saveFormSchemaInfo 创建空白报表
 */
async function createBlankReport(authRef, appType, reportTitle) {
  return createYidaClient({ authRef }).postFormOnce(`/dingtalk/web/${appType}/query/formdesign/saveFormSchemaInfo.json`, auth => ({
    _csrf_token: auth.csrfToken,
    formType: 'report',
    title: JSON.stringify(buildYidaI18n(reportTitle, { en_US: reportTitle, ja_JP: reportTitle })),
  }));
}

async function getReportSchema(authRef, appType, reportId) {
  const result = await createYidaClient({ authRef }).get(
    `/alibaba/web/${appType}/_view/query/formdesign/getFormSchema.json`,
    { formUuid: reportId, schemaVersion: 'V5', domainCode: REPORT_DOMAIN_CODE }
  );
  if (result && result.success !== false) {
    requireSchemaServerRevision(result, createRevisionError);
  }
  return result;
}

/**
 * 调用 saveFormSchema 保存报表 Schema
 */
async function saveReportSchema(authRef, appType, reportId, schema, serverRevision) {
  const gmtModified = requireSchemaServerRevision(
    { gmtModified: serverRevision },
    createRevisionError
  );
  const preparedSchema = prepareReportSchemaForSave(schema, { serverRevision: gmtModified });
  const i18nKeys = collectReportI18nKeys(preparedSchema);
  const client = createYidaClient({ authRef });

  if (i18nKeys.length > 0) {
    const bindingResult = await client.postFormOnce(`/${appType}/query/appI18n/updateI18nBinding.json`, auth => ({
      _csrf_token: auth.csrfToken,
      targetType: 'page',
      catalog1: reportId,
      i18nKeyList: i18nKeys.join(','),
    }));
    if (!bindingResult || bindingResult.success === false || bindingResult.__needLogin) {
      const error = new Error('REPORT_I18N_BINDING_FAILED');
      error.code = 'REPORT_I18N_BINDING_FAILED';
      throw error;
    }
  }

  return client.postFormOnce(`/alibaba/web/${appType}/_view/query/formdesign/saveFormSchema.json`, auth => ({
    _csrf_token: auth.csrfToken,
    formUuid: reportId,
    content: JSON.stringify(preparedSchema),
    schemaVersion: 'V5',
    domainCode: REPORT_DOMAIN_CODE,
    gmtModified,
  }));
}

function createRevisionError() {
  const error = new Error('Report Schema revision is missing or invalid.');
  error.code = 'REPORT_SCHEMA_REVISION_INVALID';
  return error;
}

module.exports = {
  createBlankReport,
  getReportSchema,
  saveReportSchema,
};
