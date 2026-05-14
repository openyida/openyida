'use strict';

jest.mock('../lib/core/utils', () => ({
  loadCookieData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  extractInfoFromCookies: jest.fn(() => ({
    csrfToken: 'csrf-token',
    corpId: 'ding-test',
    userId: 'user-test',
  })),
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  requestWithAutoLogin: jest.fn(),
}));

const utils = require('../lib/core/utils');
const basicInfo = require('../lib/basic-info/basic-info');

const mockCookieData = {
  csrf_token: 'cookie-csrf',
  cookies: [{ name: 'tianshu_csrf_token', value: 'cookie-csrf', domain: 'www.aliwork.com' }],
};

function mockSuccess(content) {
  return { success: true, content, errorMsg: '', errorCode: '' };
}

function mockPathResponses() {
  utils.httpGet.mockImplementation((baseUrl, requestPath, params) => {
    if (requestPath === basicInfo.API.commodityInfo) {
      return Promise.resolve(mockSuccess({
        corpId: 'ding-test',
        corpName: 'Test Org',
        corpToken: 'SECRET_TOKEN',
        corpDomainVo: { domainValue: 'demo', fullCorpDomain: 'https://demo.aliwork.com' },
      }));
    }
    if (requestPath === basicInfo.API.grantInfo) {
      return Promise.resolve(mockSuccess({ accountNum: 100, distributionNum: 20 }));
    }
    if (requestPath === basicInfo.API.isEduEdition) {
      return Promise.resolve(mockSuccess(false));
    }
    if (requestPath === basicInfo.API.fileSummary) {
      return Promise.resolve(mockSuccess({ appNum: 3, formNum: 9, attachmentUsageAmount: 1024 }));
    }
    if (requestPath === basicInfo.API.dataSummary) {
      return Promise.resolve(mockSuccess({ appNum: 3, formNum: 9, instanceUsageAmount: 200 }));
    }
    if (requestPath === basicInfo.API.flowSummary) {
      return Promise.resolve(mockSuccess(15));
    }
    if (requestPath === basicInfo.API.batchQuota) {
      return Promise.resolve(mockSuccess(
        Object.fromEntries(params.resourceKeys.map(key => [key, { consume: 1, totalQuota: 10 }]))
      ));
    }
    if (requestPath === basicInfo.API.quota) {
      return Promise.resolve(mockSuccess({ consume: 2, totalQuota: 20, key: params.resourceKey }));
    }
    if (requestPath === basicInfo.API.dataflowCost) {
      return Promise.resolve(mockSuccess({ total: { usedQuota: 1, maxQuota: 10 } }));
    }
    if (requestPath === basicInfo.API.checkI18nAbility) {
      return Promise.resolve(mockSuccess(true));
    }
    if (requestPath === basicInfo.API.i18nContext) {
      return Promise.resolve(mockSuccess({ accountNum: 2, resourceQuota: 10 }));
    }
    return Promise.resolve({ success: false, errorMsg: `unexpected GET ${requestPath}` });
  });
}

describe('basic-info command', () => {
  let mockLog;
  let mockError;
  let mockExit;

  beforeEach(() => {
    jest.clearAllMocks();
    utils.loadCookieData.mockReturnValue(mockCookieData);
    utils.requestWithAutoLogin.mockImplementation((requestFn, authRef) => requestFn(authRef));
    mockPathResponses();
    mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
  });

  afterEach(() => {
    mockLog.mockRestore();
    mockError.mockRestore();
    mockExit.mockRestore();
  });

  test('overview redacts corpToken by default', async () => {
    await basicInfo.run(['overview']);

    const output = JSON.parse(mockLog.mock.calls[0][0]);
    expect(output.success).toBe(true);
    expect(output.commodityInfo.corpToken).toBe('[redacted]');
    expect(output.commodityInfo.corpTokenRedacted).toBe(true);
    expect(output.isEduEdition).toBe(false);
    expect(output.capacity).toMatchObject({
      file: { appNum: 3 },
      data: { instanceUsageAmount: 200 },
      flow: 15,
    });
  });

  test('commodity can include secrets when explicitly requested', async () => {
    await basicInfo.run(['commodity', '--include-secrets']);

    const output = JSON.parse(mockLog.mock.calls[0][0]);
    expect(output.corpToken).toBe('SECRET_TOKEN');
  });

  test('abs-path posts currentPage and pageSize', async () => {
    utils.httpPost.mockResolvedValueOnce(mockSuccess({
      currentPage: 2,
      data: [{ appType: 'APP_1', formUuid: 'FORM_1' }],
      hasMore: true,
      totalCount: 12,
    }));

    await basicInfo.run(['abs-path', '--page', '2', '--size', '5']);

    const output = JSON.parse(mockLog.mock.calls[0][0]);
    expect(output).toMatchObject({ currentPage: 2, pageSize: 5, totalCount: 12, hasMore: true });
    expect(utils.httpPost.mock.calls[0][1]).toBe(basicInfo.API.absPathRecords);
    expect(utils.httpPost.mock.calls[0][2]).toContain('currentPage=2');
    expect(utils.httpPost.mock.calls[0][2]).toContain('pageSize=5');
  });

  test('quota with a single resource key uses queryResourceQuotaVo', async () => {
    await basicInfo.run(['quota', '--resource-key', 'ocrAmount']);

    const output = JSON.parse(mockLog.mock.calls[0][0]);
    expect(output).toEqual({ ocrAmount: { consume: 2, totalQuota: 20, key: 'ocrAmount' } });
    expect(utils.httpGet.mock.calls.some(call => call[1] === basicInfo.API.quota)).toBe(true);
  });

  test('domain set refuses to run without --confirm', async () => {
    await expect(basicInfo.run(['domain', 'set', '--target', 'newdemo'])).rejects.toThrow('without --confirm');
    expect(utils.httpPost).not.toHaveBeenCalled();
  });

  test('domain set posts origin and target values when confirmed', async () => {
    utils.httpPost.mockResolvedValueOnce(mockSuccess({}));

    await basicInfo.run(['domain', 'set', '--target', 'newdemo', '--confirm']);

    const output = JSON.parse(mockLog.mock.calls[0][0]);
    expect(output).toMatchObject({
      success: true,
      originDomainValue: 'demo',
      targetDomainValue: 'newdemo',
    });
    expect(utils.httpPost.mock.calls[0][1]).toBe(basicInfo.API.updateCorpDomain);
    expect(utils.httpPost.mock.calls[0][2]).toContain('originDomainValue=demo');
    expect(utils.httpPost.mock.calls[0][2]).toContain('targetDomainValue=newdemo');
  });
});
