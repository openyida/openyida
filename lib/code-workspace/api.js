'use strict';

const { createAuthRef, createYidaClient, buildCommonParams } = require('../core/yida-client');
const { httpPostMultipart, httpGetCodeBundleText, requestWithAutoLogin } = require('../core/utils');
const { fail } = require('./files');
const { requireSchemaServerRevision } = require('../core/server-revision');

function unwrap(value) {
  for (let depth = 0; depth < 3; depth += 1) {
    if (!value || typeof value.success !== 'boolean') {
      fail('Invalid workspace response', 'CODE_WORKSPACE_INVALID_RESPONSE');
    }
    if (!value.success) {
      fail(value.errorMsg || value.msg || value.message || 'Workspace request failed', value.errorCode || value.code);
    }
    const content = Object.hasOwn(value, 'result') ? value.result : value.content;
    if (content && typeof content === 'object' && typeof content.success === 'boolean') {
      value = content;
    } else {
      return content;
    }
  }
  fail('Invalid workspace response nesting');
}
function createWorkspaceApi(appType, authRef = createAuthRef()) {
  if (!/^[A-Za-z0-9_-]+$/.test(appType)) {
    fail('Invalid appType');
  }
  const root = `/dingtalk/web/${appType}/query/codeWorkspace/`;
  const versions = `/dingtalk/web/${appType}/query/yidaAppVersion/`;
  const client = createYidaClient({ authRef });
  let previewVersion;
  return {
    currentUserId: authRef.userId,
    enterTest: async () => {
      const status = unwrap(await client.postForm(versions + 'getTestEnvironmentStatus.json', ref => buildCommonParams(ref)));
      if (status?.inTestEnvironment === true) { return; }
      unwrap(await client.get(versions + 'getPreviewUrl.json', ref => buildCommonParams(ref), {
        onPreviewVersion: value => { previewVersion = value; },
      }));
      if (!previewVersion || /[\r\n]/.test(previewVersion)) {
        fail('Server did not issue an application test-version context; page binding was not written', 'CODE_WORKSPACE_TEST_CONTEXT_UNAVAILABLE');
      }
    },
    readPage: async (formUuid) => {
      const info = unwrap(await require('../app/get-form-config').fetchFormSchemaInfo(authRef, appType, formUuid));
      if (info?.formType !== 'display') { fail('Workspace binding requires a display page'); }
      const response = await client.get(`/alibaba/web/${appType}/_view/query/formdesign/getFormSchema.json`,
        ref => buildCommonParams(ref, { formUuid, schemaVersion: 'V5' }), { previewVersion });
      const schema = unwrap(response);
      if (!Array.isArray(schema?.pages)) { fail('Invalid page schema'); }
      return { schema, revision: requireSchemaServerRevision(response) };
    },
    savePage: async (formUuid, schema, revision) => unwrap(await requestWithAutoLogin(ref =>
      require('../app/publish').sendSaveRequestWithAuth(ref, JSON.stringify(schema), appType, formUuid, revision, { previewVersion }), authRef)),
    get: async (action, params = {}) => unwrap(await client.get(root + action + '.json', ref => buildCommonParams(ref, params))),
    post: async (action, params = {}) => unwrap(await client.postForm(root + action + '.json', ref => buildCommonParams(ref, params))),
    version: async (action, params = {}) => unwrap(await client.postForm(versions + action + '.json', ref => buildCommonParams(ref, params))),
    multipart: async (action, fields, files) => unwrap(await requestWithAutoLogin(ref =>
      httpPostMultipart(ref.baseUrl, root + action + '.json', buildCommonParams(ref, fields), files), authRef)),
    download: (snapshotId, filePath, maxBytes) => requestWithAutoLogin(ref =>
      httpGetCodeBundleText(ref.baseUrl, root + 'downloadSource.json',
        buildCommonParams(ref, { targetSnapshotId: snapshotId, path: filePath }),
        { rawBytes: true, maxBytes: Math.max(1, maxBytes), expectedContentTypes: ['application/octet-stream'] }), authRef),
  };
}
module.exports = { createWorkspaceApi, unwrap };
