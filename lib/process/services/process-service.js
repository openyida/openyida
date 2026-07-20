'use strict';

const { createYidaClient } = require('../../core/yida-client');
const {
  getProcessCodeFromAppParam,
  switchFormType,
} = require('../../app/services/form-mode-service');

function queryProcessVersions(authRef, appType, processCode, status, options = {}) {
  const paging = options || {};
  const requestPath = '/alibaba/web/' + appType + '/query/process/pageProcessVersion.json';
  const client = createYidaClient({ authRef });
  const method = options.oneShot === true ? 'getOnce' : 'get';
  return client[method](requestPath, auth => ({
    _api: 'Process.getProcessVersionInfo',
    _mock: 'false',
    _csrf_token: auth.csrfToken,
    _locale_time_zone_offset: '28800000',
    processCode,
    appType,
    status: status || '',
    pageIndex: paging.pageIndex || 1,
    pageSize: paging.pageSize || 10,
    orderByModifyTime: 'desc',
    _stamp: Date.now(),
  }));
}

function getProcessCodeFromSchema(authRef, appType, formUuid) {
  const requestPath = '/dingtalk/web/' + appType + '/query/formdesign/getFormSchema.json';
  return createYidaClient({ authRef }).get(requestPath, {
    formUuid,
    schemaVersion: 'V5',
  }).then(function (result) {
    if (result && result.success && result.content) {
      const schemaStr = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
      const matches = schemaStr.match(/TPROC[A-Za-z0-9_-]+/g);
      if (matches && matches.length > 0) {
        return Array.from(new Set(matches))[0];
      }
    }
    return null;
  });
}

function newDraftProcess(authRef, appType, processCode, formUuid, processId, processVersion, options = {}) {
  const requestPath = '/' + appType + '/query/simpleProcess/newDraftProcess.json';
  const client = createYidaClient({ authRef });
  const method = options.oneShot === true ? 'postFormOnce' : 'postForm';
  return client[method](requestPath, auth => {
    const postObj = {
      _csrf_token: auth.csrfToken,
      _locale_time_zone_offset: '28800000',
      formUuid,
      processCode,
    };
    if (processId) {postObj.processId = String(processId);}
    if (processVersion !== undefined && processVersion !== null) {
      postObj.processVersion = String(processVersion);
    }
    return postObj;
  });
}

function saveProcessById(authRef, appType, formUuid, processCode, processId, processVersion, processJsonStr, viewJsonStr, options = {}) {
  const requestPath = '/alibaba/web/' + appType + '/query/simpleProcess/saveProcessById.json';
  const client = createYidaClient({ authRef });
  const method = options.oneShot === true ? 'postFormOnce' : 'postForm';
  return client[method](requestPath, auth => ({
    _csrf_token: auth.csrfToken,
    formUuid,
    isOnline: 'true',
    json: processJsonStr,
    needReportLine: 'y',
    processCode,
    processId: String(processId),
    processVersion: String(processVersion),
    viewJson: viewJsonStr,
  }));
}

function publishProcessById(authRef, appType, formUuid, processCode, processId, processVersion, options = {}) {
  const requestPath = '/alibaba/web/' + appType + '/query/simpleProcess/publishProcessById.json';
  const client = createYidaClient({ authRef });
  const method = options.oneShot === true ? 'postFormOnce' : 'postForm';
  return client[method](requestPath, auth => ({
    _csrf_token: auth.csrfToken,
    formUuid,
    processCode,
    processId: String(processId),
    processVersion: String(processVersion),
  }));
}

function getProcessById(authRef, input, options = {}) {
  const appType = input && input.appType;
  const requestPath = '/alibaba/web/' + appType + '/query/simpleProcess/getProcessById.json';
  const client = createYidaClient({ authRef });
  const method = options.oneShot === true ? 'getOnce' : 'get';
  return client[method](requestPath, auth => ({
    _api: 'SimpleProcess.getProcessById',
    _mock: 'false',
    _csrf_token: auth.csrfToken,
    _locale_time_zone_offset: '28800000',
    formUuid: input && input.formUuid,
    processCode: input && input.processCode,
    processId: input && input.processId,
    processVersion: input && input.processVersion,
    _stamp: Date.now(),
  }));
}

module.exports = {
  getProcessById,
  getProcessCodeFromAppParam,
  getProcessCodeFromSchema,
  newDraftProcess,
  publishProcessById,
  queryProcessVersions,
  saveProcessById,
  switchFormType,
};
