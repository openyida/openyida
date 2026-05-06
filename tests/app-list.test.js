'use strict';

const { run } = require('../lib/app/app-list');

// ── 工具函数 mock ─────────────────────────────────────────────────────

jest.mock('../lib/core/utils', () => ({
  loadCookieData: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  extractInfoFromCookies: jest.fn(() => ({ csrfToken: 'tok123', userId: 'user001' })),
  httpGet: jest.fn(),
  triggerLogin: jest.fn(),
  requestWithAutoLogin: jest.fn(),
}));

jest.mock('../lib/core/i18n', () => ({
  t: jest.fn((key) => key),
}));

const utils = require('../lib/core/utils');

const mockCookieData = {
  cookies: [{ name: 'tianshu_csrf_token', value: 'tok123', domain: 'www.aliwork.com' }],
};

const makeApp = (overrides = {}) => ({
  appName: { zh_CN: '测试应用', en_US: 'Test App' },
  appType: 'APP_TEST001',
  systemLink: 'https://www.aliwork.com/APP_TEST001/workbench',
  ...overrides,
});

const mockAuth = {
  baseUrl: 'https://www.aliwork.com',
  cookies: mockCookieData.cookies,
  csrfToken: 'tok123',
  userId: 'user001',
};

beforeEach(() => {
  jest.clearAllMocks();
  utils.loadCookieData.mockReturnValue(mockCookieData);
  utils.resolveBaseUrl.mockReturnValue('https://www.aliwork.com');
  utils.extractInfoFromCookies.mockReturnValue({ csrfToken: 'tok123', userId: 'user001' });
  // requestWithAutoLogin 默认透传执行 requestFn
  utils.requestWithAutoLogin.mockImplementation((requestFn) => requestFn(mockAuth));
});

// ── 正常查询：单页 ────────────────────────────────────────────────────

describe('run() 正常查询', () => {
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

  test('多页结果：自动翻页并合并', async () => {
    const page1Apps = [makeApp({ appType: 'APP_P1A' }), makeApp({ appType: 'APP_P1B' })];
    const page2Apps = [makeApp({ appType: 'APP_P2A' })];

    utils.httpGet
      .mockResolvedValueOnce({
        success: true,
        content: { data: page1Apps, totalCount: 3 },
      })
      .mockResolvedValueOnce({
        success: true,
        content: { data: page2Apps, totalCount: 3 },
      });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['--size', '2']);

    const output = JSON.parse(mockLog.mock.calls[0][0]);
    expect(output).toHaveLength(3);
    expect(output.map((a) => a.appType)).toEqual(['APP_P1A', 'APP_P1B', 'APP_P2A']);

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
  test('返回空数组时输出"暂无应用"', async () => {
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: { data: [], totalCount: 0 },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run([]);

    expect(mockLog).toHaveBeenCalledWith('暂无应用');

    mockLog.mockRestore();
    mockError.mockRestore();
  });
});

// ── 未登录场景 ────────────────────────────────────────────────────────

describe('run() 未登录场景', () => {
  test('loadCookieData 返回 null 时调用 triggerLogin', async () => {
    utils.loadCookieData.mockReturnValue(null);
    utils.triggerLogin.mockReturnValue(mockCookieData);

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
  test('API 返回 success=false 时打印错误并以 exit code 1 退出', async () => {
    utils.httpGet.mockResolvedValueOnce({
      success: false,
      errorMsg: '权限不足',
    });

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run([])).rejects.toThrow('process.exit(1)');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('权限不足'));

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  test('requestWithAutoLogin 抛出异常时打印错误并以 exit code 1 退出', async () => {
    utils.requestWithAutoLogin.mockRejectedValue(new Error('网络超时'));

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run([])).rejects.toThrow('process.exit(1)');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('网络超时'));

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  test('API 返回登录失效内部标记时输出明确错误', async () => {
    utils.httpGet.mockResolvedValueOnce({ __needLogin: true });

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run([])).rejects.toThrow('process.exit(1)');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('登录态已失效'));

    mockExit.mockRestore();
    mockError.mockRestore();
  });
});

// ── --size 参数 ───────────────────────────────────────────────────────

describe('run() --size 参数', () => {
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

  test('未传 --size 时默认 pageSize=20', async () => {
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: { data: [makeApp()], totalCount: 1 },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run([]);

    const callArgs = utils.httpGet.mock.calls[0];
    expect(callArgs[2]).toMatchObject({ pageSize: 20 });

    mockLog.mockRestore();
    mockError.mockRestore();
  });
});
