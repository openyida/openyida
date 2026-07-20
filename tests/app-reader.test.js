'use strict';

const mockGet = jest.fn();
const mockGetOnce = jest.fn();

jest.mock('../lib/core/yida-client', () => ({
  createAuthRef: jest.fn(() => ({
    baseUrl: 'https://www.aliwork.com',
    csrfToken: 'csrf-default',
    cookies: [],
  })),
  createYidaClient: jest.fn(() => ({ get: mockGet, getOnce: mockGetOnce })),
}));

const { createYidaClient } = require('../lib/core/yida-client');
const { readApp } = require('../lib/app/services/app-reader');

const authRef = {
  baseUrl: 'https://www.aliwork.com',
  csrfToken: 'csrf-token',
  cookies: [],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('app service reader', () => {
  test('reads app detail directly by appType instead of scanning app list', async () => {
    mockGet.mockImplementation(async (requestPath, queryParams) => {
      const params = queryParams({ csrfToken: 'csrf-token' });
      expect(requestPath).toBe('/APP_DIRECT/query/app/getAppIncludingAecpInfo.json');
      expect(params).toMatchObject({
        _api: 'nattyFetch',
        _mock: 'false',
        appKey: 'APP_DIRECT',
        _csrf_token: 'csrf-token',
      });
      expect(params).not.toHaveProperty('pageIndex');
      expect(params).not.toHaveProperty('creator');
      return {
        success: true,
        content: {
          appName: { zh_CN: '直读应用' },
          systemLink: 'https://www.aliwork.com/APP_DIRECT/workbench',
        },
      };
    });

    const result = await readApp({ authRef }, { appType: 'APP_DIRECT' });

    expect(createYidaClient).toHaveBeenCalledWith({ authRef });
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGetOnce).not.toHaveBeenCalled();
    expect(result).toEqual({
      appType: 'APP_DIRECT',
      appName: { zh_CN: '直读应用' },
      systemLink: 'https://www.aliwork.com/APP_DIRECT/workbench',
    });
  });

  test('uses one-shot app detail read inside remote dispatch boundary', async () => {
    const phases = [];
    mockGetOnce.mockResolvedValue({
      success: true,
      content: {
        appName: 'Boundary App',
      },
    });

    const result = await readApp({
      authRef,
      assertRemoteDispatchBoundary(phase) {
        phases.push(phase);
      },
    }, { appType: 'APP_BOUNDARY' });

    expect(result).toMatchObject({
      appType: 'APP_BOUNDARY',
      appName: 'Boundary App',
    });
    expect(mockGetOnce).toHaveBeenCalledTimes(1);
    expect(mockGetOnce.mock.calls[0][0]).toBe('/APP_BOUNDARY/query/app/getAppIncludingAecpInfo.json');
    expect(mockGet).not.toHaveBeenCalled();
    expect(phases).toEqual(['before', 'after']);
  });

  test('maps exact app detail missing responses to APP_READ_NOT_FOUND', async () => {
    mockGet.mockResolvedValue({
      success: false,
      errorCode: 'APP_NOT_FOUND',
      errorMsg: '应用不存在',
    });

    await expect(readApp({ authRef }, { appType: 'APP_MISSING' })).rejects.toMatchObject({
      code: 'APP_READ_NOT_FOUND',
      details: {
        appType: 'APP_MISSING',
      },
    });
  });
});
