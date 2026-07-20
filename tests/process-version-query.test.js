'use strict';

const mockGet = jest.fn(async () => ({ success: true }));
const mockGetOnce = jest.fn(async () => ({ success: true }));
const mockPostForm = jest.fn(async () => ({ success: true }));
const mockPostFormOnce = jest.fn(async () => ({ success: true }));

jest.mock('../lib/core/yida-client', () => ({
  createYidaClient: jest.fn(() => ({
    get: mockGet,
    getOnce: mockGetOnce,
    postForm: mockPostForm,
    postFormOnce: mockPostFormOnce,
  })),
}));

const {
  newDraftProcess,
  publishProcessById,
  queryProcessVersions,
  saveProcessById,
} = require('../lib/process/services/process-service');

describe('process version query', () => {
  beforeEach(() => {
    mockGet.mockClear();
    mockGetOnce.mockClear();
    mockPostForm.mockClear();
    mockPostFormOnce.mockClear();
  });

  test('preserves legacy defaults and accepts explicit page-number pagination', async () => {
    const authRef = { csrfToken: 'csrf-runtime-only' };

    await queryProcessVersions(authRef, 'APP_TEST', 'TPROC_TEST', 'PUBLISHED');
    await queryProcessVersions(authRef, 'APP_TEST', 'TPROC_TEST', '', {
      pageIndex: 2,
      pageSize: 10,
    });

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockGet.mock.calls[0][0]).toBe('/alibaba/web/APP_TEST/query/process/pageProcessVersion.json');
    expect(mockGet.mock.calls[0][1](authRef)).toMatchObject({
      _api: 'Process.getProcessVersionInfo',
      appType: 'APP_TEST',
      orderByModifyTime: 'desc',
      pageIndex: 1,
      pageSize: 10,
      processCode: 'TPROC_TEST',
      status: 'PUBLISHED',
    });
    expect(mockGet.mock.calls[1][1](authRef)).toMatchObject({
      pageIndex: 2,
      pageSize: 10,
      status: '',
    });
  });

  test('apply options select one-shot process reads and writes without changing legacy defaults', async () => {
    const authRef = { csrfToken: 'csrf-runtime-only' };
    await queryProcessVersions(authRef, 'APP_TEST', 'TPROC_TEST', '', { oneShot: true });
    await newDraftProcess(authRef, 'APP_TEST', 'TPROC_TEST', 'FORM_TEST', '1', 2, { oneShot: true });
    await saveProcessById(authRef, 'APP_TEST', 'FORM_TEST', 'TPROC_TEST', '2', 2, '{}', '{}', { oneShot: true });
    await publishProcessById(authRef, 'APP_TEST', 'FORM_TEST', 'TPROC_TEST', '2', 2, { oneShot: true });

    expect(mockGetOnce).toHaveBeenCalledTimes(1);
    expect(mockPostFormOnce).toHaveBeenCalledTimes(3);
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockPostForm).not.toHaveBeenCalled();
  });
});
