'use strict';

const { createYidaClient } = require('../core/yida-client');
const { buildYidaI18n } = require('../core/yida-i18n');
const { requireSchemaServerRevision } = require('../core/server-revision');

/**
 * 调用 saveFormSchemaInfo 创建空白报表
 */
async function createBlankReport(authRef, appType, reportTitle) {
  return createYidaClient({ authRef }).postForm(`/dingtalk/web/${appType}/query/formdesign/saveFormSchemaInfo.json`, auth => ({
    _csrf_token: auth.csrfToken,
    formType: 'report',
    title: JSON.stringify(buildYidaI18n(reportTitle, { en_US: reportTitle, ja_JP: reportTitle })),
  }));
}

async function getReportSchema(authRef, appType, reportId) {
  const result = await createYidaClient({ authRef }).get(
    `/alibaba/web/${appType}/_view/query/formdesign/getFormSchema.json`,
    { formUuid: reportId, schemaVersion: 'V5' }
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
  return createYidaClient({ authRef }).postFormOnce(`/dingtalk/web/${appType}/_view/query/formdesign/saveFormSchema.json`, auth => ({
    _csrf_token: auth.csrfToken,
    formUuid: reportId,
    content: JSON.stringify(schema),
    schemaVersion: 'V5',
    importSchema: 'true',
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
