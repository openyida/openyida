'use strict';

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(),
  httpPost: jest.fn(),
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
};

beforeEach(() => {
  jest.clearAllMocks();
  utils.loadAuthData.mockReturnValue(mockAuthData);
});

describe('task-center run', () => {
  test('流程详情按需读取历史，并区分指定任务与流程最终结果', async () => {
    utils.requestWithAutoLogin.mockImplementation((request, auth) => request(auth));
    utils.httpGet.mockResolvedValueOnce({ success: true, content: { appType: 'APP_TEST', processInstanceId: 'instance-a', instanceStatus: 'COMPLETED', approvedResult: 'AGREE' } })
      .mockResolvedValueOnce({ success: true, content: [{ processInstanceId: 'instance-a', taskId: 'task-a', type: 'HISTORY', actionExt: 'DISAGREE' }] });
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const result = await run(['inspect', 'APP_TEST', '--process-inst-id', 'instance-a', '--history', '--task-id', 'task-a', '--json']);
      expect(result).toMatchObject({ processResult: 'AGREE', taskResult: { taskId: 'task-a', result: 'DISAGREE' }, history: { state: 'ready' } });
      expect(utils.httpGet.mock.calls.map(call => call[1])).toEqual(['/dingtalk/web/APP_TEST/v1/process/getInstanceById.json', '/dingtalk/web/APP_TEST/v1/process/getOperationRecords.json']);
    } finally { log.mockRestore(); }
  });

  test('计数只读一次带相同条件的服务端总数', async () => {
    utils.requestWithAutoLogin.mockImplementation((request, auth) => request(auth));
    utils.httpGet.mockResolvedValue({ success: true, content: { values: [], totalCount: 20 } });
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const result = await run(['count', 'APP_TEST', '--type', 'cc', '--transport', 'app-query', '--filters-json', '{"instanceStatus":0}', '--json']);
      expect(result).toMatchObject({ total: 20, scope: 'current-visitor-in-app', filters: { instanceStatus: 0 } });
      expect(utils.httpGet).toHaveBeenCalledTimes(1);
      expect(JSON.parse(utils.httpGet.mock.calls[0][2].query)).toMatchObject({ appKeys: ['APP_TEST'], limit: 1, instanceStatus: 0 });
    } finally { log.mockRestore(); }
  });

  test('通用读取的无效条件在登录前被拒绝', async () => {
    for (const args of [['inspect', 'APP_TEST'], ['inspect', 'APP_TEST', '--process-inst-id', 'p', '--user-id', 'other'], ['count', 'APP_TEST', '--type', 'created', '--filters-json', '{"instanceStatus":0}']]) {
      await expect(run(args)).rejects.toBeTruthy();
    }
    expect(utils.loadAuthData).not.toHaveBeenCalled();
  });
  test('候选项查询返回标准选项且不输出完整成员记录', async () => {
    utils.httpGet.mockResolvedValue({ success: true, content: { values: [{ staffId: 'person-a', displayName: 'Requester A', email: 'private@example.test' }] } });
    utils.requestWithAutoLogin.mockImplementation((request, auth) => request(auth));
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const result = await run(['options', 'APP_TEST', '--type', 'originators', '--keyword', 'Requester', '--size', '5', '--json']);
    expect(utils.httpGet.mock.calls[0][1]).toBe('/query/userservice/searchUsers.json');
    expect(utils.httpGet.mock.calls[0][2]).toMatchObject({ key: 'Requester', size: 5 });
    expect(result).toEqual({ items: [{ value: 'person-a', label: 'Requester A' }], total: null });
    expect(log.mock.calls.join(' ')).not.toContain('private@example.test');
    log.mockRestore();
  });

  test('流程候选通过应用范围只读POST查询', async () => {
    utils.httpPost.mockResolvedValue({ success: true, content: [
      { appType: 'APP_TEST', processCode: 'process-a', formUuid: 'FORM_A', formType: 'process', title: { zh_CN: '采购申请' } },
      { appType: 'APP_TEST', processCode: 'process-b', formUuid: 'FORM_B', formType: 'process', title: { zh_CN: '采购审批' } },
      { appType: 'APP_TEST', processCode: 'process-c', formUuid: 'FORM_C', formType: 'process', title: { zh_CN: '销售审批' } },
    ] });
    utils.requestWithAutoLogin.mockImplementation((request, auth) => request(auth));
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const result = await run(['options', 'APP_TEST', '--type', 'processes', '--keyword', '采购', '--size', '1', '--json']);
    expect(utils.httpPost.mock.calls[0][1]).toBe('/dingtalk/web/APP_TEST/query/formdesign/listFormDesignsByFormType.json');
    expect(new URLSearchParams(utils.httpPost.mock.calls[0][2]).get('key')).toBe('采购');
    expect(result).toMatchObject({ total: 2, items: [{ value: 'process-a', label: '采购申请' }] });
    log.mockRestore();
  });

  test('候选项非法范围和未知参数在认证前失败', async () => {
    await expect(run(['options', 'APP_TEST', '--type', 'unknown'])).rejects.toHaveProperty('code', 'TASK_LOOKUP_INVALID');
    await expect(run(['options', 'APP_TEST', '--type', 'originators', '--user-id', 'other'])).rejects.toHaveProperty('isCliError', true);
    expect(utils.loadAuthData).not.toHaveBeenCalled();
    expect(utils.requestWithAutoLogin).not.toHaveBeenCalled();
  });

  test('全局查询第二页使用 page/limit 协议', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    utils.httpGet.mockResolvedValue({ success: true, content: { values: [] } });
    utils.requestWithAutoLogin.mockImplementation((request, auth) => request(auth));
    await run(['created', '--page', '2', '--size', '30', '--keyword', '采购', '--no-detail']);
    const [base, endpoint, params] = utils.httpGet.mock.calls[0];
    expect(base).toBe('https://www.aliwork.com');
    expect(endpoint).toBe('/query/task/getMyCreateInCorp.json');
    expect(JSON.parse(params.query)).toEqual({ page: 2, limit: 30, keyword: '采购', ignoreDetail: 'y' });
    log.mockRestore();
  });

  test('能力查询无需登录且不发送请求', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    utils.loadAuthData.mockReturnValue(null);
    const result = await run(['capabilities', '--json']);
    expect(result).toMatchObject({ scope: 'app', inlineApproval: false, identity: 'current-visitor' });
    expect(utils.loadAuthData).not.toHaveBeenCalled();
    expect(utils.requestWithAutoLogin).not.toHaveBeenCalled();
    log.mockRestore();
  });

  test('装配缺参数或未知参数在登录和网络前报错', async () => {
    await expect(run(['scaffold', '--output', 'task.canvas.jsx'])).rejects.toHaveProperty('isCliError', true);
    await expect(run(['capabilities', '--app-type', 'APP_OTHER'])).rejects.toHaveProperty('isCliError', true);
    expect(utils.loadAuthData).not.toHaveBeenCalled();
    expect(utils.requestWithAutoLogin).not.toHaveBeenCalled();
  });

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
