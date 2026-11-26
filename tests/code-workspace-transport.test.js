'use strict';
const mockClient = { get: jest.fn(), postForm: jest.fn(), postFormOnce: jest.fn() };
jest.mock('../lib/core/yida-client', () => ({
  createAuthRef: () => ({ userId: 'user' }), createYidaClient: () => mockClient,
  buildCommonParams: (ref, params = {}) => params,
}));
const { createWorkspaceApi } = require('../lib/code-workspace/api');

beforeEach(() => jest.resetAllMocks());
test('test resource APIs reuse the issued version header and GET readback without persisting credentials', async () => {
  mockClient.postForm.mockResolvedValue({ success: true, content: { inTestEnvironment: false } });
  mockClient.get.mockImplementation(async (url, params, options) => {
    if (url.endsWith('getPreviewUrl.json')) { options.onPreviewVersion('fixture-preview-identity'); }
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

test('WORKSPACE readback uses the populated wrapper field and keeps the confirmation write one-shot', async () => {
  const api = createWorkspaceApi('APP_WORKSPACE');
  mockClient.get.mockResolvedValue({ success: true, result: null, content: { success: true, result: 'readback' } });
  expect(await api.version('getWorkspaceDraft')).toBe('readback');
  mockClient.get.mockResolvedValue({ success: true, result: null, content: null });
  expect(await api.get('current')).toBeNull();
  mockClient.get.mockResolvedValue({ success: true });
  expect(await api.get('current')).toBeUndefined();
  mockClient.get.mockResolvedValue({ success: true, content: null, errorCode: 404 });
  await expect(api.get('current')).rejects.toMatchObject({ code: 404 });
  mockClient.postFormOnce.mockResolvedValue({ success: true, result: '1.0' });
  const fields = { codeWorkspaceConfirmationToken: 'fixture' };
  expect(await api.version('publishDraft', fields)).toBe('1.0');
  expect(mockClient.postFormOnce).toHaveBeenCalledWith(expect.stringContaining('/publishDraft.json'),
    expect.any(Function), { previewVersion: undefined });
  expect(mockClient.postForm).not.toHaveBeenCalled();
});
