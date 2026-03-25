'use strict';

const querystring = require('querystring');
const { httpPost } = require('../core/utils');

/**
 * 调用 saveFormSchemaInfo 创建空白报表
 */
async function createBlankReport(baseUrl, csrfToken, cookies, appType, reportTitle) {
  const postData = querystring.stringify({
    _csrf_token: csrfToken,
    formType: 'report',
    title: JSON.stringify({ zh_CN: reportTitle, en_US: reportTitle, type: 'i18n' }),
  });
  return httpPost(baseUrl, `/dingtalk/web/${appType}/query/formdesign/saveFormSchemaInfo.json`, postData, cookies);
}

/**
 * 调用 saveFormSchema 保存报表 Schema
 */
async function saveReportSchema(baseUrl, csrfToken, cookies, appType, reportId, schema) {
  const postData = querystring.stringify({
    _csrf_token: csrfToken,
    formUuid: reportId,
    content: JSON.stringify(schema),
    schemaVersion: 'V5',
    importSchema: 'true',
  });
  return httpPost(baseUrl, `/dingtalk/web/${appType}/_view/query/formdesign/saveFormSchema.json`, postData, cookies);
}

module.exports = {
  createBlankReport,
  saveReportSchema,
};
