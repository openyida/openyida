'use strict';

jest.mock('../lib/core/utils', () => ({
  loadCookieData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(),
  requestWithAutoLogin: jest.fn(),
}));

const utils = require('../lib/core/utils');
const { run } = require('../lib/core/task-center');

const mockCookieData = {
  cookies: [{ name: 'tianshu_csrf_token', value: 'tok123' }],
  csrf_token: 'tok123',
};

beforeEach(() => {
  jest.clearAllMocks();
  utils.loadCookieData.mockReturnValue(mockCookieData);
});

describe('task-center run', () => {
  test('查询成功时输出 JSON', async () => {
    utils.requestWithAutoLogin.mockResolvedValue({
      success: true,
      content: { data: [] },
    });

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await run(['todo', '--page', '1', '--size', '1']);

    expect(utils.requestWithAutoLogin).toHaveBeenCalledTimes(1);
    expect(mockLog).toHaveBeenCalledWith(JSON.stringify({
      success: true,
      content: { data: [] },
    }, null, 2));

    mockLog.mockRestore();
    mockError.mockRestore();
  });

  test('登录态失效内部标记应失败退出，不能当作成功 JSON 输出', async () => {
    utils.requestWithAutoLogin.mockResolvedValue({ __needLogin: true });

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });
    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run(['todo', '--page', '1', '--size', '1'])).rejects.toThrow('process.exit(1)');

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockLog).not.toHaveBeenCalledWith(JSON.stringify({ __needLogin: true }, null, 2));
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('登录态已失效'));

    mockExit.mockRestore();
    mockLog.mockRestore();
    mockError.mockRestore();
  });
});
