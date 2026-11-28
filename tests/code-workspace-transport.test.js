'use strict';
const mockClient = { get: jest.fn(), postForm: jest.fn() };
jest.mock('../lib/core/utils', () => ({ ...jest.requireActual('../lib/core/utils'),
  requestWithAutoLogin: jest.fn(fn => fn({ baseUrl: 'https://example.test' })),
  httpGetCodeBundleText: jest.fn(),
}));
jest.mock('../lib/core/yida-client', () => ({
  createAuthRef: () => ({ userId: 'user' }), createYidaClient: () => mockClient,
  buildCommonParams: (ref, params = {}) => params,
}));
const { createWorkspaceApi } = require('../lib/code-workspace/api');
const { httpGetCodeBundleText } = require('../lib/core/utils');

beforeEach(() => jest.resetAllMocks());
test('archive download uses the fixed snapshot endpoint and preserves structured stale-draft errors', async () => {
  require('../lib/core/utils').requestWithAutoLogin.mockImplementation(fn => fn({ baseUrl: 'https://example.test' }));
  const api = createWorkspaceApi('APP_TEST');
  httpGetCodeBundleText.mockResolvedValue(Buffer.from('zip'));
  await api.downloadArchive('snapshot-1');
  expect(httpGetCodeBundleText).toHaveBeenCalledWith('https://example.test',
    '/dingtalk/web/APP_TEST/query/codeWorkspace/downloadSourceArchive.json', { targetSnapshotId: 'snapshot-1' },
    expect.objectContaining({ rawBytes: true, expectedContentTypes: ['application/zip'] }));
  httpGetCodeBundleText.mockRejectedValue(Object.assign(new Error('binary error'), {
    code: 'CODE_BUNDLE_DOWNLOAD_JSON_RESPONSE', details: { responsePreview: JSON.stringify({
      success: true, content: { success: false, code: 'CODE_WORKSPACE_DRAFT_CONFLICT', msg: 'refresh draft' },
    }) },
  }));
  await expect(api.downloadArchive('snapshot-1')).rejects.toMatchObject({ code: 'CODE_WORKSPACE_DRAFT_CONFLICT' });
});
test('test resource APIs reuse the issued version header and GET readback without persisting credentials', async () => {
  mockClient.postForm.mockResolvedValue({ success: true, content: { inTestEnvironment: false } });
  mockClient.get.mockImplementation(async (url, params, options) => {
    if (url.endsWith('getPreviewUrl.json')) {options.onPreviewVersion('fixture-preview-identity');}
    return { success: true, content: { build: 'fixed' } };
  });
  const api = createWorkspaceApi('APP_TEST');
  await api.enterTest();
  await api.version('saveWorkspaceDraft', { codeWorkspaceBuildId: 'fixed' });
  expect(mockClient.postForm.mock.calls.at(-1)[2]).toEqual({ previewVersion: 'fixture-preview-identity' });
  expect(await api.version('getWorkspaceDraft')).toEqual({ build: 'fixed' });
  expect(mockClient.get.mock.calls.at(-1)[0]).toContain('/yidaAppVersion/getWorkspaceDraft.json');
  expect(mockClient.get.mock.calls.at(-1)[2]).toEqual({ previewVersion: 'fixture-preview-identity' });
  const other = createWorkspaceApi('APP_OTHER');
  await other.version('listVersions');
  expect(mockClient.postForm.mock.calls.at(-1)[2]).toEqual({ previewVersion: undefined });
});
test('missing test identity does not silently switch to an ONLINE write', async () => {
  mockClient.postForm.mockResolvedValue({ success: true, content: { inTestEnvironment: false } });
  mockClient.get.mockResolvedValue({ success: true, content: '/APP_TEST/workbench' });
  await expect(createWorkspaceApi('APP_TEST').enterTest()).rejects.toThrow('test-version context');
});
