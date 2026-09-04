'use strict';

const { run } = require('../lib/app/app-list');

// ── 工具函数 mock ─────────────────────────────────────────────────────

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(),
  triggerLogin: jest.fn(),
  requestWithAutoLogin: jest.fn(),
}));

jest.mock('../lib/core/i18n', () => ({
  t: jest.fn((key, ...args) => [key, ...args].join(':')),
}));

const utils = require('../lib/core/utils');

const mockAuthData = {
  base_url: 'https://www.aliwork.com',
  auth_mode: 'token',
  auth_source: 'token',
  corp_id: 'corp-1',
  user_id: 'user-1',
};

const makeApp = (overrides = {}) => ({
  appName: { zh_CN: '测试应用', en_US: 'Test App' },
  appType: 'APP_TEST001',
  systemLink: 'https://www.aliwork.com/APP_TEST001/workbench',
  ...overrides,
});

const mockAuth = {
  baseUrl: 'https://www.aliwork.com',
  userId: 'user001',
};

beforeEach(() => {
  jest.clearAllMocks();
  utils.loadAuthData.mockReturnValue(mockAuthData);
  utils.resolveBaseUrl.mockReturnValue('https://www.aliwork.com');
  // requestWithAutoLogin 默认透传执行 requestFn
  utils.requestWithAutoLogin.mockImplementation((requestFn) => requestFn(mockAuth));
});

// ── 正常查询：单页 ────────────────────────────────────────────────────

describe('run() 正常查询', () => {
  test('--help 只输出用法，不读取登录态', async () => {
    const mockWrite = jest.spyOn(process.stderr, 'write').mockImplementation(() => {});

    await run(['--help']);

    expect(utils.loadAuthData).not.toHaveBeenCalled();
    expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining('app_list.usage'));

    mockWrite.mockRestore();
  });

  test('单页结果：正确输出 JSON 到 stdout', async () => {
    const apps = [
      makeApp(),
      makeApp({ appName: { zh_CN: '应用B' }, appType: 'APP_B', systemLink: 'https://www.aliwork.com/APP_B/workbench' }),
    ];

    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: { data: apps, totalCount: 2 },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run([]);

    const output = JSON.parse(mockLog.mock.calls[0][0]);
    expect(output).toHaveLength(2);
    expect(output[0]).toEqual({
      appName: '测试应用',
      appType: 'APP_TEST001',
      systemLink: 'https://www.aliwork.com/APP_TEST001/workbench',
    });
    expect(output[1].appName).toBe('应用B');

    mockLog.mockRestore();
    mockError.mockRestore();
  });

  test('结果超过一页时仅返回当前页并提示下一页命令', async () => {
    const page1Apps = [makeApp({ appType: 'APP_P1A' }), makeApp({ appType: 'APP_P1B' })];

    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: { data: page1Apps, totalCount: 3 },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['--size', '2']);

    const output = JSON.parse(mockLog.mock.calls[0][0]);
    expect(output).toHaveLength(2);
    expect(output.map((a) => a.appType)).toEqual(['APP_P1A', 'APP_P1B']);
    expect(utils.httpGet).toHaveBeenCalledTimes(1);
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining(
      'openyida app-list --type managed --page 2 --size 2'
    ));

    mockLog.mockRestore();
    mockError.mockRestore();
  });

  test('appName 为 null 时降级为空字符串', async () => {
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: { data: [makeApp({ appName: null })], totalCount: 1 },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run([]);

    const output = JSON.parse(mockLog.mock.calls[0][0]);
    expect(output[0].appName).toBe('');

    mockLog.mockRestore();
    mockError.mockRestore();
  });
});

// ── 空列表 ────────────────────────────────────────────────────────────

describe('run() 空列表', () => {
  test('返回空数组时 stdout 仍输出 JSON 数组', async () => {
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: { data: [], totalCount: 0 },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run([]);

    expect(JSON.parse(mockLog.mock.calls[0][0])).toEqual([]);

    mockLog.mockRestore();
    mockError.mockRestore();
  });
});

// ── 未登录场景 ────────────────────────────────────────────────────────

describe('run() 未登录场景', () => {
  test('loadAuthData 返回 null 时调用 triggerLogin', async () => {
    utils.loadAuthData.mockReturnValue(null);
    utils.triggerLogin.mockReturnValue(mockAuthData);

    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: { data: [makeApp()], totalCount: 1 },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run([]);

    expect(utils.triggerLogin).toHaveBeenCalledTimes(1);
    const output = JSON.parse(mockLog.mock.calls[0][0]);
    expect(output).toHaveLength(1);

    mockLog.mockRestore();
    mockError.mockRestore();
  });
});

// ── API 失败场景 ──────────────────────────────────────────────────────

describe('run() API 失败场景', () => {
  test('API 返回 success=false 时抛出 CliError', async () => {
    utils.httpGet.mockResolvedValueOnce({
      success: false,
      errorMsg: '权限不足',
    });

    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run([])).rejects.toThrow('权限不足');
    expect(mockError).not.toHaveBeenCalled();

    mockError.mockRestore();
  });

  test('requestWithAutoLogin 抛出异常时抛出 CliError', async () => {
    utils.requestWithAutoLogin.mockRejectedValue(new Error('网络超时'));

    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run([])).rejects.toThrow('网络超时');
    expect(mockError).not.toHaveBeenCalled();

    mockError.mockRestore();
  });

  test('API 返回登录失效内部标记时输出明确错误', async () => {
    utils.httpGet.mockResolvedValueOnce({ __needLogin: true });

    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run([])).rejects.toThrow('app_list.auth_required');
    expect(mockError).not.toHaveBeenCalled();

    mockError.mockRestore();
  });
});

// ── --size 参数 ───────────────────────────────────────────────────────

describe('run() 查询范围与分页参数', () => {
  test('默认查询我管理的第 1 页，每页 16 条', async () => {
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: { data: [makeApp()], totalCount: 1 },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run([]);

    expect(utils.httpGet.mock.calls[0][2]).toMatchObject({
      pageIndex: 1,
      pageSize: 16,
      creator: 'user001',
      isAdmin: true,
    });

    mockLog.mockRestore();
    mockError.mockRestore();
  });

  test('--type created 以 isAdmin=false 查询我创建的', async () => {
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: { data: [makeApp()], totalCount: 1 },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['--type', 'created']);

    expect(utils.httpGet.mock.calls[0][2]).toMatchObject({ isAdmin: false });

    mockLog.mockRestore();
    mockError.mockRestore();
  });

  test('--page 3 只查询第 3 页', async () => {
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: { data: [makeApp()], totalCount: 40 },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['--page', '3']);

    expect(utils.httpGet).toHaveBeenCalledTimes(1);
    expect(utils.httpGet.mock.calls[0][2]).toMatchObject({ pageIndex: 3, pageSize: 16 });

    mockLog.mockRestore();
    mockError.mockRestore();
  });

  test('--size 50 时以 pageSize=50 发起请求', async () => {
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: { data: [makeApp()], totalCount: 1 },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['--size', '50']);

    const callArgs = utils.httpGet.mock.calls[0];
    expect(callArgs[2]).toMatchObject({ pageSize: 50 });

    mockLog.mockRestore();
    mockError.mockRestore();
  });

  test.each([
    [['--type', 'all'], 'app_list.invalid_type'],
    [['--page', '0'], 'app_list.invalid_positive_integer'],
    [['--size', 'nope'], 'app_list.invalid_positive_integer'],
    [['--all'], 'app_list.invalid_argument'],
  ])('无效参数 %j 在读取登录态前失败', async (args, expectedMessage) => {
    await expect(run(args)).rejects.toThrow(expectedMessage);
    expect(utils.loadAuthData).not.toHaveBeenCalled();
    expect(utils.httpGet).not.toHaveBeenCalled();
  });
});
