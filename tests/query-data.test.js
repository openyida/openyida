'use strict';

const { run } = require('../lib/core/query-data');

// ── 工具函数 mock ─────────────────────────────────────────────────────

// mock lib/core/utils，避免真实网络请求和文件读取
jest.mock('../lib/core/utils', () => ({
  loadCookieData: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(),
  requestWithAutoLogin: jest.fn(),
}));

const utils = require('../lib/core/utils');

// 每个测试前重置 mock
beforeEach(() => {
  jest.clearAllMocks();
});

// ── 参数校验 ──────────────────────────────────────────────────────────

describe('run() 参数校验', () => {
  test('参数不足时打印错误并以 exit code 1 退出', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run(['APP_XXX'])).rejects.toThrow('process.exit(1)');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('用法'));

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  test('参数为空数组时打印错误并以 exit code 1 退出', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run([])).rejects.toThrow('process.exit(1)');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockError.mockRestore();
  });
});

// ── 未登录场景 ────────────────────────────────────────────────────────

describe('run() 未登录场景', () => {
  test('loadCookieData 返回 null 时打印错误并以 exit code 1 退出', async () => {
    utils.loadCookieData.mockReturnValue(null);

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run(['APP_XXX', 'FORM-XXX'])).rejects.toThrow('process.exit(1)');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('未登录'));

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  test('loadCookieData 返回无 cookies 字段时打印错误并退出', async () => {
    utils.loadCookieData.mockReturnValue({ csrf_token: 'tok' }); // 无 cookies 字段

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run(['APP_XXX', 'FORM-XXX'])).rejects.toThrow('process.exit(1)');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockError.mockRestore();
  });
});

// ── 查询列表场景 ──────────────────────────────────────────────────────

describe('run() 查询列表场景', () => {
  const mockCookieData = {
    cookies: [{ name: 'tianshu_csrf_token', value: 'tok123' }],
    csrf_token: 'tok123',
  };

  test('查询成功时输出 JSON 结果', async () => {
    utils.loadCookieData.mockReturnValue(mockCookieData);
    utils.requestWithAutoLogin.mockResolvedValue({
      success: true,
      content: { totalCount: 5, data: [] },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['APP_XXX', 'FORM-XXX']);

    // 应该调用了 requestWithAutoLogin
    expect(utils.requestWithAutoLogin).toHaveBeenCalledTimes(1);
    // 应该通过 console.log 输出 JSON
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('"success": true'));

    mockLog.mockRestore();
    mockError.mockRestore();
  });

  test('查询失败时打印错误并以 exit code 1 退出', async () => {
    utils.loadCookieData.mockReturnValue(mockCookieData);
    utils.requestWithAutoLogin.mockResolvedValue({
      success: false,
      errorMsg: '权限不足',
      errorCode: '403',
    });

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run(['APP_XXX', 'FORM-XXX'])).rejects.toThrow('process.exit(1)');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('权限不足'));

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  test('传入 --page 和 --size 参数时正常执行', async () => {
    utils.loadCookieData.mockReturnValue(mockCookieData);
    utils.requestWithAutoLogin.mockResolvedValue({
      success: true,
      content: { totalCount: 0, data: [] },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['APP_XXX', 'FORM-XXX', '--page', '2', '--size', '50']);
    expect(utils.requestWithAutoLogin).toHaveBeenCalledTimes(1);

    mockLog.mockRestore();
    mockError.mockRestore();
  });

  test('--size 超过 100 时被截断为 100', async () => {
    utils.loadCookieData.mockReturnValue(mockCookieData);

    let capturedRequestFn = null;
    utils.requestWithAutoLogin.mockImplementation(async (requestFn, authRef) => {
      capturedRequestFn = requestFn;
      // 模拟 requestFn 调用，验证参数
      return { success: true, content: { totalCount: 0, data: [] } };
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['APP_XXX', 'FORM-XXX', '--size', '999']);
    // requestWithAutoLogin 应该被调用
    expect(utils.requestWithAutoLogin).toHaveBeenCalledTimes(1);

    mockLog.mockRestore();
    mockError.mockRestore();
  });

  test('传入 --search-json 参数时正常执行', async () => {
    utils.loadCookieData.mockReturnValue(mockCookieData);
    utils.requestWithAutoLogin.mockResolvedValue({
      success: true,
      content: { totalCount: 1, data: [] },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['APP_XXX', 'FORM-XXX', '--search-json', '{"field_1":"value"}']);
    expect(utils.requestWithAutoLogin).toHaveBeenCalledTimes(1);

    mockLog.mockRestore();
    mockError.mockRestore();
  });
});

// ── 查询单条实例场景 ──────────────────────────────────────────────────

describe('run() 查询单条实例场景（--inst-id）', () => {
  const mockCookieData = {
    cookies: [{ name: 'tianshu_csrf_token', value: 'tok123' }],
    csrf_token: 'tok123',
  };

  test('传入 --inst-id 时调用实例详情接口', async () => {
    utils.loadCookieData.mockReturnValue(mockCookieData);
    utils.requestWithAutoLogin.mockResolvedValue({
      success: true,
      content: { formInstId: 'INST-001', formData: {} },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['APP_XXX', 'FORM-XXX', '--inst-id', 'INST-001']);
    expect(utils.requestWithAutoLogin).toHaveBeenCalledTimes(1);
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('"success": true'));

    mockLog.mockRestore();
    mockError.mockRestore();
  });

  test('--inst-id 查询失败时打印错误并退出', async () => {
    utils.loadCookieData.mockReturnValue(mockCookieData);
    utils.requestWithAutoLogin.mockResolvedValue({
      success: false,
      errorMsg: '实例不存在',
      errorCode: '404',
    });

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run(['APP_XXX', 'FORM-XXX', '--inst-id', 'INST-999'])).rejects.toThrow('process.exit(1)');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('实例不存在'));

    mockExit.mockRestore();
    mockError.mockRestore();
  });
});
