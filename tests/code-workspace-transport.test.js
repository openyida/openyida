'use strict';
const mockClient = { get: jest.fn(), postForm: jest.fn() };
jest.mock('../lib/core/yida-client', () => ({
  createAuthRef: () => ({ userId: 'user' }), createYidaClient: () => mockClient,
  buildCommonParams: (ref, params = {}) => params,
}));
const { createWorkspaceApi } = require('../lib/code-workspace/api');

beforeEach(() => jest.resetAllMocks());
test('test resource APIs reuse the issued version header and GET readback without persisting credentials', async () => {
  mockClient.postForm.mockResolvedValue({ success: true, content: { inTestEnvironment: false } });
  mockClient.get.mockImplementation(async (url, params, options) => {
    if (url.endsWith('getPreviewUrl.json')) options.onPreviewVersion('fixture-preview-identity');
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
