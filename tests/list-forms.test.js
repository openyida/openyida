'use strict';

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(),
  triggerLogin: jest.fn(),
  requestWithAutoLogin: jest.fn(),
}));

const utils = require('../lib/core/utils');
const { filterForms, parseArgs, run } = require('../lib/app/list-forms');

const mockAuthData = {
  base_url: 'https://www.aliwork.com',
  auth_mode: 'token',
  auth_source: 'token',
  corp_id: 'corp-1',
  user_id: 'user-1',
  csrf_token: 'tok123',
};

beforeEach(() => {
  jest.clearAllMocks();
  utils.loadAuthData.mockReturnValue(mockAuthData);
});

describe('parseArgs', () => {
  test('解析 appType 和 keyword', () => {
    expect(parseArgs(['APP_XXX', '--keyword', '客户'])).toEqual({
      appType: 'APP_XXX',
      keyword: '客户',
    });
  });
});

describe('filterForms', () => {
  test('按名称、UUID、pathName 做关键词过滤', () => {
    const forms = [
      { formName: '客户信息', formUuid: 'FORM-A', formType: 'display', pathName: 'customer-info' },
      { formName: '费用报销', formUuid: 'FORM-B', formType: 'process', pathName: 'expense' },
    ];

    expect(filterForms(forms, '客户')).toHaveLength(1);
    expect(filterForms(forms, 'FORM-B')).toHaveLength(1);
    expect(filterForms(forms, 'expense')).toHaveLength(1);
  });
});

describe('run', () => {
  test('查询成功时输出稳定 JSON 列表，并过滤系统导航项', async () => {
    utils.requestWithAutoLogin.mockResolvedValue({
      success: true,
      content: [
        { navType: 'SYSTEM', formUuid: 'SYS-1', title: { zh_CN: '待我处理' }, formType: 'system' },
        { navType: 'FORM', formUuid: 'FORM-AAA', title: { zh_CN: '客户信息' }, formType: 'display', pathName: 'customer-info' },
        { navType: 'FORM', formUuid: 'FORM-BBB', title: { zh_CN: '费用报销' }, formType: 'process', pathName: 'expense' },
      ],
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['APP_XXX', '--keyword', '客户']);

    expect(utils.requestWithAutoLogin).toHaveBeenCalledTimes(1);
    expect(mockLog).toHaveBeenCalledWith(JSON.stringify([
      {
        formUuid: 'FORM-AAA',
        formName: '客户信息',
        formType: 'display',
        pathName: 'customer-info',
      },
    ], null, 2));

    mockLog.mockRestore();
    mockError.mockRestore();
  });

  test('参数不足时打印用法并退出', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run([])).rejects.toThrow('process.exit(1)');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('list-forms'));

    mockExit.mockRestore();
    mockError.mockRestore();
  });
});
