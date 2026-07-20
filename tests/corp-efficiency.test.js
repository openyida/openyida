'use strict';

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  requestWithAutoLogin: jest.fn(),
  detectActiveTool: jest.fn(() => ({ tool: 'codex' })),
}));

jest.mock('../lib/core/chalk', () => ({
  c: { cyan: '', reset: '' },
  success: jest.fn(),
  listItem: jest.fn(),
}));

const {
  run,
  parseWorkbenchContent,
  formatOverview,
  sanitizeCommodityInfo,
  buildCertificationDetailReportUrl,
  buildReportApiInfo,
  flattenDetailTargets,
  selectDetailTarget,
} = require('../lib/corp-efficiency/corp-efficiency');
const utils = require('../lib/core/utils');

const mockAuthData = {
  base_url: 'https://www.aliwork.com',
  auth_mode: 'token',
  auth_source: 'token',
  corp_id: 'ding-corp',
  user_id: 'user-1',
};

const mockAuth = {
  baseUrl: 'https://www.aliwork.com',
  authMode: 'token',
  authSource: 'token',
  corpId: 'ding-corp',
  userId: 'user-1',
  authData: mockAuthData,
};

const mockEfficacyData = {
  completeAuthNumber: 12,
  completeLessonNumber: 8,
  completeStudy: true,
  isReachStandard: true,
  saveAppDevDays: 30,
  saveAppDevMoney: 50000,
  efficiencyDataList: [
    {
      title: '应用数',
      data: 20,
      standardData: 10,
      percent: 100,
      isOverReference: true,
      detailReportUrl: '/APP_TEST/preview/REPORT_TEST?isPreview=true',
    },
  ],
};

const mockWorkbenchContent = JSON.stringify({
  zh_CN: {
    efficiencyTitle: '企业效能概览',
    efficiencyOverviewTip: '仅供参考',
    saveMoneyStandardTip: '累计已节省',
    industryText: '行业参考值',
    aboveValue: '高于参考值',
    belowValue: '低于参考值',
    lowcodeStandard: '低代码学习完成人数',
    lowcodeCertification: '低代码开发者认证人数',
    efficiencyCardTips: ['指标说明'],
  },
});

const mockCommodityInfo = {
  corpId: 'ding-corp',
  corpName: '测试组织',
  commodityType: 'hybrid_cloud',
  corpToken: 'secret-token',
  remainDays: 10,
};

beforeEach(() => {
  jest.clearAllMocks();
  utils.loadAuthData.mockReturnValue(mockAuthData);
  utils.resolveBaseUrl.mockReturnValue('https://www.aliwork.com');
  utils.requestWithAutoLogin.mockImplementation((requestFn) => requestFn(mockAuth));
});

function mockConsole() {
  return {
    log: jest.spyOn(console, 'log').mockImplementation(() => {}),
    error: jest.spyOn(console, 'error').mockImplementation(() => {}),
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('corp-efficiency overview', () => {
  test('输出企业效能概览 JSON，并隐藏敏感 corpToken', async () => {
    utils.httpGet
      .mockResolvedValueOnce({ success: true, content: mockEfficacyData })
      .mockResolvedValueOnce({ success: true, content: mockWorkbenchContent })
      .mockResolvedValueOnce({ success: true, content: mockCommodityInfo });
    const mock = mockConsole();

    await run([]);

    const output = JSON.parse(mock.log.mock.calls[0][0]);
    expect(output.corpId).toBe('ding-corp');
    expect(output.corpName).toBe('测试组织');
    expect(output.overview.saveAppDevMoney).toBe(50000);
    expect(output.learning.completeAuthNumber).toBe(12);
    expect(output.performance.metrics[0]).toMatchObject({
      key: 'performance.1',
      type: 'performance',
      title: '应用数',
      data: 20,
      standardData: 10,
      detailReportFullUrl: 'https://www.aliwork.com/APP_TEST/preview/REPORT_TEST?isPreview=true',
      report: {
        appType: 'APP_TEST',
        reportId: 'REPORT_TEST',
      },
    });
    expect(output.details.learning[0]).toMatchObject({
      key: 'lowcodeCertification',
      title: '低代码开发者认证人数',
      data: 12,
    });
    expect(output.details.learning[0].detailReportFullUrl).toContain('REPORT-QQ866JB164A81S0X764WJ97ATDKI33SCLP5EL3');
    expect(JSON.stringify(output)).not.toContain('secret-token');

    mock.log.mockRestore();
    mock.error.mockRestore();
  });

  test('API 失败时抛出 CliError', async () => {
    utils.httpGet.mockResolvedValueOnce({ success: false, errorMsg: '权限不足' });
    const mock = mockConsole();

    await expect(run([])).rejects.toThrow('权限不足');
    expect(mock.error).not.toHaveBeenCalled();

    mock.log.mockRestore();
    mock.error.mockRestore();
  });
});

describe('corp-efficiency detail commands', () => {
  test('details 列出学习认证和效能指标明细入口，并带报表接口模板', async () => {
    utils.httpGet
      .mockResolvedValueOnce({ success: true, content: mockEfficacyData })
      .mockResolvedValueOnce({ success: true, content: mockWorkbenchContent })
      .mockResolvedValueOnce({ success: true, content: mockCommodityInfo });
    const mock = mockConsole();

    await run(['details']);

    const output = JSON.parse(mock.log.mock.calls[0][0]);
    expect(output.totalCount).toBe(2);
    expect(output.details[0]).toMatchObject({
      targetIndex: 1,
      key: 'lowcodeCertification',
      type: 'learning',
      reportApi: {
        type: 'yida-native-report',
      },
    });
    expect(output.details[1]).toMatchObject({
      targetIndex: 2,
      key: 'performance.1',
      title: '应用数',
      reportApi: {
        data: {
          path: '/alibaba/web/APP_TEST/visual/visualizationDataRpc/getDataAsync.json',
        },
      },
    });

    mock.log.mockRestore();
    mock.error.mockRestore();
  });

  test('detail 可按标题选择明细并输出浏览器交接信息', async () => {
    utils.httpGet
      .mockResolvedValueOnce({ success: true, content: mockEfficacyData })
      .mockResolvedValueOnce({ success: true, content: mockWorkbenchContent })
      .mockResolvedValueOnce({ success: true, content: mockCommodityInfo });
    const mock = mockConsole();

    await run(['detail', '--title', '应用数', '--open']);

    const output = JSON.parse(mock.log.mock.calls[0][0]);
    expect(output.detail).toMatchObject({
      key: 'performance.1',
      title: '应用数',
      reportApi: {
        schema: {
          path: '/alibaba/web/APP_TEST/query/formdesign/getLatestFormWithNavNew.json',
        },
        data: {
          query: {
            _api: 'EDataService.getDataAsync',
          },
        },
      },
    });
    expect(output.frontendBehavior.permissionFallback.title).toBe('效能分析明细');
    expect(output.browser_handoff).toMatchObject({
      status: 'open_url',
      url: 'https://www.aliwork.com/APP_TEST/preview/REPORT_TEST?isPreview=true',
    });

    mock.log.mockRestore();
    mock.error.mockRestore();
  });
});

describe('corp-efficiency groups', () => {
  test('查询通知群并格式化 cid 和 title', async () => {
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: {
        currentPage: 1,
        limit: 5,
        totalCount: 1,
        values: [{ cid: 'cid-1', title: '项目群' }],
      },
    });
    const mock = mockConsole();

    await run(['groups', '--query', '项目', '--size', '5']);

    const output = JSON.parse(mock.log.mock.calls[0][0]);
    expect(output).toMatchObject({
      query: '项目',
      pageIndex: 1,
      pageSize: 5,
      totalCount: 1,
    });
    expect(output.groups[0]).toEqual({ cid: 'cid-1', title: '项目群' });
    expect(utils.httpGet.mock.calls[0][2]).toMatchObject({
      query: '项目',
      pageSize: 5,
    });

    mock.log.mockRestore();
    mock.error.mockRestore();
  });
});

describe('corp-efficiency notify', () => {
  test('没有 --yes 时不会发送通知', async () => {
    const mock = mockConsole();

    await expect(run(['notify', '--cid', 'cid-1', '--type', 'noticeStudy'])).rejects.toThrow('--yes');
    expect(utils.httpPost).not.toHaveBeenCalled();
    expect(mock.error).not.toHaveBeenCalled();

    mock.log.mockRestore();
    mock.error.mockRestore();
  });

  test('带 --yes 时发送学习通知', async () => {
    utils.httpPost.mockResolvedValueOnce({ success: true, content: { sent: true } });
    const mock = mockConsole();

    await run(['notify', '--cid', 'cid-1,cid-2', '--type', 'noticeStudy', '--yes']);

    const output = JSON.parse(mock.log.mock.calls[0][0]);
    expect(output).toMatchObject({
      ok: true,
      type: 'noticeStudy',
      cidList: ['cid-1', 'cid-2'],
      result: { sent: true },
    });
    const postData = decodeURIComponent(utils.httpPost.mock.calls[0][2]);
    expect(postData).toContain('"type":"noticeStudy"');
    expect(postData).toContain('"cidList":["cid-1","cid-2"]');

    mock.log.mockRestore();
    mock.error.mockRestore();
  });
});

describe('corp-efficiency helpers', () => {
  test('parseWorkbenchContent 按 locale 选择文案', () => {
    const content = JSON.stringify({
      zh_CN: { title: '中文' },
      en_US: { title: 'English' },
    });
    expect(parseWorkbenchContent(content, 'en_US')).toEqual({ title: 'English' });
    expect(parseWorkbenchContent(content, 'fr_FR')).toEqual({ title: '中文' });
  });

  test('formatOverview 和 sanitizeCommodityInfo 不返回 corpToken', () => {
    const commodity = sanitizeCommodityInfo(mockCommodityInfo);
    expect(commodity).not.toHaveProperty('corpToken');

    const output = formatOverview({
      efficacyData: mockEfficacyData,
      workbenchData: parseWorkbenchContent(mockWorkbenchContent),
      commodityInfo: mockCommodityInfo,
      authRef: { baseUrl: 'https://www.aliwork.com', corpId: 'ding-corp' },
      raw: true,
    });
    expect(JSON.stringify(output)).not.toContain('secret-token');
    expect(flattenDetailTargets(output.details)).toHaveLength(2);
  });

  test('明细报表辅助函数解析 URL 和选择入口', () => {
    const url = buildCertificationDetailReportUrl(12);
    expect(url).toContain('data=12');

    const reportApi = buildReportApiInfo({
      appType: 'APP_TEST',
      pageId: 'REPORT_TEST',
      prdId: '2558050',
      isPreview: 'true',
    });
    expect(reportApi.data.path).toBe('/alibaba/web/APP_TEST/visual/visualizationDataRpc/getDataAsync.json');
    expect(reportApi.data.bodyTemplate).toMatchObject({
      pageName: 'report',
      pageId: 'REPORT_TEST',
      prdId: '2558050',
    });

    const targets = flattenDetailTargets({
      performance: [
        { key: 'performance.1', type: 'performance', title: '应用数', performanceIndex: 1, detailReportFullUrl: 'https://example.com/report' },
      ],
    });
    expect(selectDetailTarget(targets, { title: '应用数' })).toMatchObject({ key: 'performance.1' });
    expect(selectDetailTarget(targets, { index: '1' })).toMatchObject({ key: 'performance.1' });
  });
});
