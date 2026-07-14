'use strict';

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(),
  requestWithAutoLogin: jest.fn(),
}));

const utils = require('../lib/core/utils');
const { run } = require('../lib/core/task-center');

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

    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    let error;
    try {
      await run(['todo', '--page', '1', '--size', '1']);
    } catch (err) {
      error = err;
    }
    expect(error).toBeTruthy();
    expect(error.isCliError).toBe(true);
    expect(error.message).toContain('登录态已失效');

    expect(mockLog).not.toHaveBeenCalledWith(JSON.stringify({ __needLogin: true }, null, 2));

    mockLog.mockRestore();
  });
});
