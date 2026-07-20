'use strict';

const querystring = require('querystring');

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  requestWithAutoLogin: jest.fn((requestFn, authRef) => requestFn(authRef)),
}));

const utils = require('../lib/core/utils');
const {
  buildNormalAgentParams,
  listAgentTasks,
  createAgentTask,
  updateAgentTask,
  cancelAgentTask,
  getAgentRange,
} = require('../lib/agent-center/api');
const {
  buildMutationOptions,
  parseRangeToken,
  parseTimestamp,
} = require('../lib/agent-center/agent-center');

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

describe('agent-center api', () => {
  test('listAgentTasks sends status filters and normalizes rows', async () => {
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: {
        currentPage: 1,
        limit: 1,
        totalCount: 1,
        values: [{
          id: 1,
          agentUuid: 'Agent_1',
          agentType: 'DEPARTURE',
          agentCategory: 'EXECUTE',
          status: 'EFF',
          sourceActionerId: 'u1',
          sourceActionerName: '离职人',
          toActionerId: 'u2',
          toActionerName: '代理人',
          gmtStartDate: 1779254966000,
          gmtEndDate: 4070880000000,
          gmtCreate: 1779254966000,
        }],
      },
    });

    const result = await listAgentTasks({ status: 'active', keyword: 'u1', page: 2, size: 5 });

    expect(utils.httpGet).toHaveBeenCalledWith(
      'https://www.aliwork.com',
      '/query/agenttask/getAgentTasks.json',
      expect.objectContaining({
        _api: 'Agent.getAgentTasks',
        keywords: 'u1',
        pageIndex: '2',
        pageSize: '5',
        status: 'EFF',
      }),
    );
    expect(result).toMatchObject({
      totalCount: 1,
      agents: [{
        agentUuid: 'Agent_1',
        agentTypeLabel: '离职代理',
        agentCategoryLabel: '代处理流程',
        statusLabel: '代理中',
        sourceActionerName: '离职人',
      }],
    });
  });

  test('createAgentTask sends normal delegation payload with partial range', async () => {
    utils.httpPost.mockResolvedValueOnce({
      success: true,
      content: { agentUuid: 'Agent_2' },
    });

    const result = await createAgentTask({
      sourceUserId: 'u1',
      targetUserId: 'u2',
      type: 'normal',
      start: 1779254966000,
      end: 1779341366000,
      category: 'start',
      notifySource: 'y',
      rangeType: 'part',
      rangeValue: [{ appType: 'APP_1', formUuid: 'FORM_1' }],
    });
    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);

    expect(result).toMatchObject({ success: true, agentUuid: 'Agent_2' });
    expect(body).toMatchObject({
      _api: 'Agent.createAgentTask',
      sourceActionerId: 'u1',
      toActionerId: 'u2',
      agentType: 'NORMAL',
      agentValue: 'ALL',
      gmtStartDate: '1779254966000',
      gmtEndDate: '1779341366000',
      originIsView: 'y',
      agentCategory: 'START',
      agentRangeType: 'PART',
    });
    expect(JSON.parse(body.agentRangeValue)).toEqual([{ appType: 'APP_1', formUuid: 'FORM_1' }]);
  });

  test('createAgentTask sends departure delegation without time range', async () => {
    utils.httpPost.mockResolvedValueOnce({ success: true, content: {} });

    await createAgentTask({
      sourceUserId: 'u1',
      targetUserId: 'u2',
      type: 'departure',
    });
    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);

    expect(body).toMatchObject({
      agentType: 'DEPARTURE',
      sourceActionerId: 'u1',
      toActionerId: 'u2',
    });
    expect(body.gmtStartDate).toBeUndefined();
    expect(body.agentCategory).toBeUndefined();
  });

  test('updateAgentTask can update only target user without overwriting category', async () => {
    utils.httpPost.mockResolvedValueOnce({ success: true, content: {} });

    await updateAgentTask({
      agentUuid: 'Agent_3',
      targetUserId: 'u3',
      type: 'normal',
    });
    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);

    expect(body).toMatchObject({
      _api: 'Agent.updateAgentTask',
      agentUuid: 'Agent_3',
      toActionerId: 'u3',
    });
    expect(body.agentCategory).toBeUndefined();
    expect(body.gmtStartDate).toBeUndefined();
  });

  test('cancelAgentTask sends uuid and type via GET', async () => {
    utils.httpGet.mockResolvedValueOnce({ success: true, content: {} });

    const result = await cancelAgentTask({ agentUuid: 'Agent_4', type: 'departure' });

    expect(utils.httpGet).toHaveBeenCalledWith(
      'https://www.aliwork.com',
      '/query/agenttask/cancelAgentTask.json',
      expect.objectContaining({
        _api: 'Agent.cancelAgentTask',
        agentTaskUuid: 'Agent_4',
        agentType: 'DEPARTURE',
      }),
    );
    expect(result).toMatchObject({ success: true, agentUuid: 'Agent_4', agentType: 'DEPARTURE' });
  });

  test('getAgentRange requests detail API and parses serialized range values', async () => {
    utils.httpPost.mockResolvedValueOnce({
      success: true,
      content: {
        agentUuid: 'Agent_5',
        agentRangeType: 'PART',
        agentRangeValue: '[{"appType":"APP_1","formUuid":"FORM_1"}]',
        agentRangeValues: null,
      },
    });

    const result = await getAgentRange({ agentUuid: 'Agent_5' });
    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);

    expect(body).toMatchObject({
      _api: 'Agent.getTaskByAgentId',
      agentId: 'Agent_5',
    });
    expect(result).toMatchObject({
      success: true,
      agentUuid: 'Agent_5',
      agentRangeType: 'PART',
      agentRangeValues: [{ appType: 'APP_1', formUuid: 'FORM_1' }],
    });
  });

  test('buildNormalAgentParams requires range values for PART', () => {
    expect(() => buildNormalAgentParams({
      start: 1,
      end: 2,
      rangeType: 'part',
    })).toThrow('PART');
  });
});

describe('agent-center cli helpers', () => {
  test('parseTimestamp accepts millisecond timestamps and date strings', () => {
    expect(parseTimestamp('1779254966000', '--start')).toBe(1779254966000);
    expect(Number.isFinite(parseTimestamp('2026-05-20 09:00', '--start'))).toBe(true);
  });

  test('parseRangeToken parses app and form ids', () => {
    expect(parseRangeToken('APP_1:FORM_1')).toEqual({ appType: 'APP_1', formUuid: 'FORM_1' });
  });

  test('buildMutationOptions supports positional departure type and repeated range forms', () => {
    const positionals = ['departure'];
    const options = {
      source_user: 'u1',
      target_user: 'u2',
      range_form: ['APP_1:FORM_1', 'APP_2:FORM_2'],
    };

    expect(buildMutationOptions(positionals, options)).toMatchObject({
      type: 'departure',
      sourceUserId: 'u1',
      targetUserId: 'u2',
      rangeType: 'part',
      rangeValue: [
        { appType: 'APP_1', formUuid: 'FORM_1' },
        { appType: 'APP_2', formUuid: 'FORM_2' },
      ],
    });
  });
});
