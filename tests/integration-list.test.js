'use strict';

// Mock 整个 integration-api，避免触发真实 HTTP / 登录
jest.mock('../lib/integration/integration-api', () => ({
  listLogicflows: jest.fn(),
  listFormLogicflows: jest.fn(),
  getLogicflowDetail: jest.fn(),
  switchLogicflow: jest.fn(),
}));

// Mock loadAuthData 和 triggerLogin，避免文件系统/交互式登录依赖
jest.mock('../lib/core/utils', () => {
  const real = jest.requireActual('../lib/core/utils');
  return {
    ...real,
    loadAuthData: jest.fn(() => ({
      auth_mode: 'token',
      auth_source: 'token',
      corp_id: 'corp-1',
      user_id: 'user-1',
      base_url: 'https://www.aliwork.com',
    })),
    triggerLogin: jest.fn(),
    resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  };
});

const integrationApi = require('../lib/integration/integration-api');
const integrationList = require('../lib/integration/integration-list');
const { listAllLogicflows } = require('../lib/integration/integration-check');
const { setLanguage } = require('../lib/core/i18n');

describe('integration-list parseListArgs', () => {
  test('解析 appType 与全部可选 flag', () => {
    const parsed = integrationList.parseListArgs([
      'APP_X',
      '--form-uuid', 'FORM-1',
      '--status', 'y',
      '--key', 'sync',
      '--flow-types', '1,2,6',
      '--size', '20',
      '--json',
    ]);
    expect(parsed).toEqual({
      appType: 'APP_X',
      formUuid: 'FORM-1',
      status: 'y',
      key: 'sync',
      flowTypes: ['1', '2', '6'],
      pageSize: 20,
      json: true,
    });
  });

  test('缺省时使用合理默认值', () => {
    const parsed = integrationList.parseListArgs(['APP_Y']);
    expect(parsed).toMatchObject({
      appType: 'APP_Y',
      formUuid: '',
      status: '',
      key: '',
      flowTypes: ['1', '2', '3', '5', '6'],
      pageSize: 50,
      json: false,
    });
  });
});

describe('integration-list flattenFlowList', () => {
  test('把按表单分组的结构打平成扁平 flow 数组', () => {
    const content = {
      data: [
        {
          formUuid: 'FORM-1',
          formName: '订单',
          flowList: [
            { processCode: 'LPROC-1', name: '同步客户', status: 'y' },
            { processCode: 'LPROC-2', name: '通知', status: 'n' },
          ],
        },
        {
          formUuid: 'FORM-2',
          formName: '物流',
          flowList: [{ processCode: 'LPROC-3', name: '推送', status: 'y' }],
        },
      ],
    };
    const flows = integrationList.flattenFlowList(content);
    expect(flows).toHaveLength(3);
    expect(flows[0]).toMatchObject({
      formUuid: 'FORM-1', formName: '订单', processCode: 'LPROC-1', status: 'y',
    });
    expect(flows[2]).toMatchObject({
      formUuid: 'FORM-2', processCode: 'LPROC-3', status: 'y',
    });
  });

  test('空 data 返回空数组', () => {
    expect(integrationList.flattenFlowList({})).toEqual([]);
    expect(integrationList.flattenFlowList(null)).toEqual([]);
  });
});

describe('integration-list runList', () => {
  let logSpy;
  beforeEach(() => {
    setLanguage('zh');
    process.env.YIDA_QUIET = '1';
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    integrationApi.listLogicflows.mockReset();
    integrationApi.listFormLogicflows.mockReset();
  });
  afterEach(() => {
    setLanguage('zh');
    delete process.env.YIDA_QUIET;
    logSpy.mockRestore();
  });

  test('--json 输出扁平数组', async () => {
    integrationApi.listLogicflows.mockImplementation((authRef, params) => Promise.resolve({
      data: params.type === '1' ? [{
        formUuid: 'FORM-1', formName: 'F1',
        flowList: [{ processCode: 'LPROC-1', name: 'flow1', status: 'y' }],
      }] : [],
      totalCount: params.type === '1' ? 1 : 0,
      hasMore: false,
    }));

    await integrationList.runList(['APP_X', '--json']);

    expect(integrationApi.listLogicflows).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      appType: 'APP_X',
    }));
    expect(logSpy).toHaveBeenCalledTimes(1);
    const printed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(Array.isArray(printed)).toBe(true);
    expect(printed[0]).toMatchObject({ processCode: 'LPROC-1', status: 'y', flowType: '1' });
    expect(integrationApi.listLogicflows.mock.calls.map((call) => call[1].type))
      .toEqual(['1', '2', '3', '5', '6']);
  });

  test('公共 list 复用安全 paginator 拉完应用页和表单分组剩余页', async () => {
    integrationApi.listLogicflows
      .mockResolvedValueOnce({
        data: [{
          formUuid: 'FORM-1', formName: 'F1', hasMore: true,
          flowList: [{ processCode: 'LPROC-1', name: 'flow1', status: 'y' }],
        }],
        totalCount: 2,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        data: [{
          formUuid: 'FORM-2', formName: 'F2',
          flowList: [{ processCode: 'LPROC-3', name: 'flow3', status: 'n' }],
        }],
        totalCount: 2,
        hasMore: false,
      });
    integrationApi.listFormLogicflows
      .mockResolvedValueOnce({
        data: [{ formUuid: 'FORM-1', processCode: 'LPROC-1', name: 'flow1', status: 'y' }],
        totalCount: 2,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        data: [{ formUuid: 'FORM-1', processCode: 'LPROC-2', name: 'flow2', status: 'y' }],
        totalCount: 2,
        hasMore: false,
      });

    await integrationList.runList(['APP_X', '--flow-types', '1', '--size', '1', '--json']);

    const printed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(printed.map((flow) => flow.processCode).sort()).toEqual(['LPROC-1', 'LPROC-2', 'LPROC-3']);
    expect(integrationApi.listLogicflows).toHaveBeenCalledTimes(2);
    expect(integrationApi.listFormLogicflows).toHaveBeenCalledTimes(2);
  });

  test('默认输出 JSON 摘要对象', async () => {
    integrationApi.listLogicflows.mockResolvedValue({
      data: [{ formUuid: 'FORM-1', flowList: [] }],
      totalCount: 0,
      hasMore: false,
    });
    await integrationList.runList(['APP_X', '--flow-types', '1']);
    const printed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(printed).toMatchObject({
      appType: 'APP_X', total: 0, totalCount: 0, hasMore: false,
    });
    expect(Array.isArray(printed.flows)).toBe(true);
  });

  test('safe paginator limit uses the active non-zh locale', async () => {
    setLanguage('ja');
    integrationApi.listLogicflows.mockResolvedValue({ data: [], totalCount: 2, hasMore: true });
    await expect(listAllLogicflows({}, 'APP_X', {
      flowTypes: ['1'], pageSize: 1, maxPages: 1,
    })).rejects.toMatchObject({
      code: 'INTEGRATION_LIST_PAGINATION_LIMIT',
      message: '集成自動化一覧が安全なページネーション上限を超えました。',
    });
  });

  test('在 maxPages 边界页完成时不会误报分页上限', async () => {
    integrationApi.listLogicflows
      .mockResolvedValueOnce({ data: [], totalCount: 2, hasMore: true })
      .mockResolvedValueOnce({ data: [], totalCount: 2, hasMore: false });

    await expect(listAllLogicflows({}, 'APP_X', {
      flowTypes: ['1'], pageSize: 1, maxPages: 2,
    })).resolves.toEqual([]);
    expect(integrationApi.listLogicflows).toHaveBeenCalledTimes(2);
  });

  test('表单分组剩余页超过 maxPages 时 fail-closed', async () => {
    integrationApi.listLogicflows.mockResolvedValue({
      data: [{ formUuid: 'FORM-1', formName: 'F1', hasMore: true, flowList: [] }],
      totalCount: 1,
      hasMore: false,
    });
    integrationApi.listFormLogicflows.mockResolvedValue({
      data: [{ formUuid: 'FORM-1', processCode: 'LPROC-1' }],
      totalCount: 2,
      hasMore: true,
    });

    await expect(listAllLogicflows({}, 'APP_X', {
      flowTypes: ['1'], pageSize: 1, maxPages: 1,
    })).rejects.toMatchObject({ code: 'INTEGRATION_LIST_PAGINATION_LIMIT' });
    expect(integrationApi.listLogicflows).toHaveBeenCalledTimes(1);
    expect(integrationApi.listFormLogicflows).toHaveBeenCalledTimes(1);
  });
});

describe('integration-list runEnable / runDisable', () => {
  let logSpy;
  beforeEach(() => {
    process.env.YIDA_QUIET = '1';
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    integrationApi.switchLogicflow.mockReset();
    integrationApi.listLogicflows.mockReset();
    integrationApi.getLogicflowDetail.mockReset();
  });
  afterEach(() => {
    delete process.env.YIDA_QUIET;
    logSpy.mockRestore();
  });

  test('enable 成功输出 success=true 且 status=y', async () => {
    integrationApi.switchLogicflow.mockResolvedValue({ ok: true });
    integrationApi.listLogicflows.mockResolvedValue({
      data: [{
        formUuid: 'FORM-1',
        flowList: [{ processCode: 'LPROC-1', status: 'y' }],
      }],
      totalCount: 1,
      hasMore: false,
    });
    integrationApi.getLogicflowDetail.mockResolvedValue({
      success: true,
      content: { schema: { componentName: 'CanvasEngine' }, globalSetting: {} },
    });
    await integrationList.runEnable(['APP_X', 'FORM-1', 'LPROC-1']);
    expect(integrationApi.switchLogicflow).toHaveBeenCalledWith(expect.any(Object), {
      appType: 'APP_X', formUuid: 'FORM-1', processCode: 'LPROC-1', enable: true,
    });
    const printed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(printed).toMatchObject({
      success: true, action: 'enable', status: 'y', processCode: 'LPROC-1',
      verificationLevel: 'PLATFORM_LIST_EXACT_DETAIL_PRESENT',
      verification: { verificationLevel: 'PLATFORM_LIST_EXACT_DETAIL_PRESENT' },
    });
  });

  test('disable 写失败时抛出 CliError，输出 success=false 与 error', async () => {
    integrationApi.switchLogicflow.mockRejectedValue(new Error('boom'));
    await expect(integrationList.runDisable(['APP_X', 'FORM-1', 'LPROC-1']))
      .rejects.toMatchObject({ code: 'INTEGRATION_SWITCH_FAILED' });
    const printed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(printed).toMatchObject({
      success: false, action: 'disable', error: 'boom', writeAccepted: false, finalState: 'not-written',
    });
  });

  test('switch 写响应成功但最终状态无法回读时仍失败', async () => {
    integrationApi.switchLogicflow.mockResolvedValue({ ok: true });
    integrationApi.listLogicflows.mockResolvedValue({ data: [], totalCount: 0, hasMore: false });

    await expect(integrationList.runDisable(['APP_X', 'FORM-1', 'LPROC-1']))
      .rejects.toMatchObject({ code: 'INTEGRATION_READBACK_EXACT_MATCH_FAILED' });

    expect(JSON.parse(logSpy.mock.calls[0][0])).toMatchObject({
      success: false,
      action: 'disable',
      processCode: 'LPROC-1',
      writeAccepted: true,
      finalState: 'unknown',
    });
  });
});
