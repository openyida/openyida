'use strict';

// Mock 整个 integration-api，避免触发真实 HTTP / 登录
jest.mock('../lib/integration/integration-api', () => ({
  listLogicflows: jest.fn(),
  switchLogicflow: jest.fn(),
}));

// Mock loadCookieData 和 triggerLogin，避免文件系统/交互式登录依赖
jest.mock('../lib/core/utils', () => {
  const real = jest.requireActual('../lib/core/utils');
  return {
    ...real,
    loadCookieData: jest.fn(() => ({
      csrf_token: 'fake-csrf',
      cookies: [{ name: 'tb_token', value: 'fake' }],
      base_url: 'https://www.aliwork.com',
    })),
    triggerLogin: jest.fn(),
    resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  };
});

const integrationApi = require('../lib/integration/integration-api');
const integrationList = require('../lib/integration/integration-list');

describe('integration-list parseListArgs', () => {
  test('解析 appType 与全部可选 flag', () => {
    const parsed = integrationList.parseListArgs([
      'APP_X',
      '--form-uuid', 'FORM-1',
      '--status', 'y',
      '--key', 'sync',
      '--page', '2',
      '--size', '20',
      '--json',
    ]);
    expect(parsed).toEqual({
      appType: 'APP_X',
      formUuid: 'FORM-1',
      status: 'y',
      key: 'sync',
      pageIndex: 2,
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
      pageIndex: 1,
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
    process.env.YIDA_QUIET = '1';
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    integrationApi.listLogicflows.mockReset();
  });
  afterEach(() => {
    delete process.env.YIDA_QUIET;
    logSpy.mockRestore();
  });

  test('--json 输出扁平数组', async () => {
    integrationApi.listLogicflows.mockResolvedValue({
      data: [{
        formUuid: 'FORM-1', formName: 'F1',
        flowList: [{ processCode: 'LPROC-1', name: 'flow1', status: 'y' }],
      }],
      totalCount: 1,
      hasMore: false,
    });

    await integrationList.runList(['APP_X', '--json']);

    expect(integrationApi.listLogicflows).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      appType: 'APP_X',
    }));
    expect(logSpy).toHaveBeenCalledTimes(1);
    const printed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(Array.isArray(printed)).toBe(true);
    expect(printed[0]).toMatchObject({ processCode: 'LPROC-1', status: 'y' });
  });

  test('默认输出 JSON 摘要对象', async () => {
    integrationApi.listLogicflows.mockResolvedValue({
      data: [{ formUuid: 'FORM-1', flowList: [] }],
      totalCount: 0,
      hasMore: false,
    });
    await integrationList.runList(['APP_X']);
    const printed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(printed).toMatchObject({
      appType: 'APP_X', total: 0, totalCount: 0, hasMore: false,
    });
    expect(Array.isArray(printed.flows)).toBe(true);
  });
});

describe('integration-list runEnable / runDisable', () => {
  let logSpy;
  let exitSpy;
  beforeEach(() => {
    process.env.YIDA_QUIET = '1';
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('__exit__'); });
    integrationApi.switchLogicflow.mockReset();
  });
  afterEach(() => {
    delete process.env.YIDA_QUIET;
    logSpy.mockRestore();
    exitSpy.mockRestore();
  });

  test('enable 成功输出 success=true 且 status=y', async () => {
    integrationApi.switchLogicflow.mockResolvedValue({ ok: true });
    await integrationList.runEnable(['APP_X', 'FORM-1', 'LPROC-1']);
    expect(integrationApi.switchLogicflow).toHaveBeenCalledWith(expect.any(Object), {
      appType: 'APP_X', formUuid: 'FORM-1', processCode: 'LPROC-1', enable: true,
    });
    const printed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(printed).toMatchObject({
      success: true, action: 'enable', status: 'y', processCode: 'LPROC-1',
    });
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('disable 失败时退出码 1，输出 success=false 与 error', async () => {
    integrationApi.switchLogicflow.mockRejectedValue(new Error('boom'));
    await expect(integrationList.runDisable(['APP_X', 'FORM-1', 'LPROC-1']))
      .rejects.toThrow('__exit__');
    const printed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(printed).toMatchObject({
      success: false, action: 'disable', error: 'boom',
    });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
