'use strict';

const tasks = require('../lib/task-center/contract');
const { createWorkflowContract } = require('../lib/task-center/workflow');
const { createWorkflowLoader } = require('../lib/task-center/workflow-loader');
const { createTaskCenterLoader } = require('../lib/task-center/loader');
const contract = createWorkflowContract(tasks);
const target = { appType: 'APP_TEST', processInstanceId: 'instance-a' };
const detail = extra => ({ success: true, content: { appType: 'APP_TEST', processInstanceId: 'instance-a', formUuid: 'FORM_A', instanceStatus: 'RUNNING', ...extra } });
const records = rows => ({ success: true, content: rows });

test('workflow requests fix app paths and reject identity, endpoint and scope overrides', () => {
  expect(contract.request('detail', target)).toEqual({ appType: 'APP_TEST', method: 'getProcessInstanceById', path: '/dingtalk/web/APP_TEST/v1/process/getInstanceById.json', params: { processInstanceId: 'instance-a' } });
  for (const patch of [{ appType: '../APP' }, { processInstanceId: '' }, { processInstanceId: true }, { endpoint: '/other' }, { userId: 'other' }, { history: 'true' }, { taskId: 'task-a' }]) {
    expect(() => contract.options({ ...target, ...patch })).toThrow();
  }
});

test('details retain independent process result and authoritative times', () => {
  expect(contract.detail(detail({ processApprovedResult: 'AGREE', startTime: '1792195200000', endTime: '1792198800000', finishTime: 12,
    approvalSummary: '[{"label":"Amount","value":50}]', tasks: [{ taskId: 't', activityId: 'n', activityName: 'Review', status: 'RUNNING', operator: { userId: 'u', name: 'Reviewer' } }, { taskId: 'old', status: 'COMPLETED' }],
  }), target)).toMatchObject({ processResult: 'AGREE', submittedAt: 1792195200000, processFinishedAt: 1792198800000,
    summary: [{ label: 'Amount', value: '50' }], currentNodes: [{ taskId: 't', name: 'Review', assignees: [{ id: 'u', name: 'Reviewer' }] }] });
  const value = contract.detail(detail({ instanceStatus: 'COMPLETED', finishTime: 12, currentTasks: [{ taskId: 'stale' }] }), target);
  expect(value).toMatchObject({ processResult: 'UNKNOWN', submittedAt: null, processFinishedAt: null, currentNodes: [] });
});

test('same-task outcomes never fall back to process results or another task', () => {
  const value = tasks.normalize({ data: [{ taskId: 't', outResult: 'AGREE', outResultName: '拒绝', processApprovedResult: 'AGREE' }], totalCount: 1 }, { appType: 'APP_TEST', kind: 'done' });
  expect(value.items[0]).toMatchObject({ result: 'UNKNOWN', personalResult: 'UNKNOWN', processResult: 'AGREE' });
  const input = { ...target, taskId: 'selected', history: true };
  const history = contract.history(records([
    { type: 'HISTORY', processInstanceId: 'instance-a', taskId: 'another', actionExt: 'AGREE' },
    { type: 'TODO', processInstanceId: 'instance-a', taskId: 'selected', actionExt: 'AGREE', operator: { userId: 'u', displayName: 'Member' } },
  ]), input);
  expect(contract.combine(contract.detail(detail({}), input), { state: 'ready', items: history }, input)).toMatchObject({ taskResult: { taskId: 'selected', result: 'UNKNOWN' }, currentNodes: [{ taskId: 'selected', assignees: [{ id: 'u', name: 'Member' }] }] });
  const conflicting = contract.history(records([{ type: 'HISTORY', taskId: 'selected', actionExt: 'AGREE' }, { type: 'HISTORY', taskId: 'selected', actionExt: 'DISAGREE' }]), input);
  expect(contract.combine(contract.detail(detail({}), input), { state: 'ready', items: conflicting }, input).taskResult.result).toBe('UNKNOWN');
  expect(contract.combine(contract.detail(detail({}), input), { state: 'ready', items: [conflicting[0], { ...conflicting[1], result: 'UNKNOWN' }] }, input).taskResult.result).toBe('UNKNOWN');
});

test('history validates scope and preserves multiple records for the same task', () => {
  const value = contract.history(records([{ id: 'a', taskId: 't', type: 'HISTORY', operateTime: 1792195200000 }, { id: 'b', taskId: 't', type: 'HISTORY', operateTime: 1792195200001 }]), target);
  expect(value.map(row => row.key)).toEqual(['a', 'b']);
  for (const patch of [{ appType: 'APP_OTHER' }, { processInstanceId: 'other' }]) {
    expect(() => contract.history(records([{ type: 'TODO', ...patch }]), target)).toThrow('WORKFLOW_SCOPE_MISMATCH');
    expect(() => contract.detail(detail(patch), target)).toThrow('WORKFLOW_SCOPE_MISMATCH');
  }
  expect(() => contract.detail(detail({ formUuid: 'FORM_B' }), { ...target, formUuid: 'FORM_A' })).toThrow('formUuid');
  expect(() => contract.history({ success: true, content: {} }, target)).toThrow('WORKFLOW_RESPONSE_INVALID');
  expect(contract.history(records([]), target)).toEqual([]);
});

test('no history request is made unless requested, and detail remains available on a partial history failure', async () => {
  const request = jest.fn().mockResolvedValueOnce(detail({})).mockResolvedValueOnce(detail({})).mockRejectedValueOnce(new Error('history unavailable'));
  const load = createWorkflowLoader(contract, request);
  expect((await load(target)).history.state).toBe('not-requested');
  expect(request).toHaveBeenCalledTimes(1);
  const value = await load({ ...target, history: true });
  expect(value).toMatchObject({ processInstanceId: 'instance-a', history: { state: 'error', items: [], error: { code: 'WORKFLOW_REQUEST_FAILED' } }, progressAvailable: false });
});

test('history login and identity mismatches fail the read instead of producing an empty history', async () => {
  for (const response of [{ __needLogin: true }, records([{ processInstanceId: 'other', type: 'TODO' }]), records([{ formUuid: 'FORM_OTHER', type: 'TODO' }])]) {
    const request = jest.fn().mockResolvedValueOnce(detail({})).mockResolvedValueOnce(response);
    await expect(createWorkflowLoader(contract, request)({ ...target, history: true })).rejects.toHaveProperty('code', response.__needLogin ? 'NEED_LOGIN' : 'WORKFLOW_SCOPE_MISMATCH');
  }
});

test('process reads deduplicate requests, cache per visitor and invalidate explicitly', async () => {
  let identity = 'visitor-a';
  const request = jest.fn().mockResolvedValue(detail({}));
  const load = createWorkflowLoader(contract, request, () => identity);
  await Promise.all([load(target), load(target)]);
  await load(target);
  expect(request).toHaveBeenCalledTimes(1);
  identity = 'visitor-b'; await load(target);
  expect(request).toHaveBeenCalledTimes(2);
  load.clear(); await load(target);
  expect(request).toHaveBeenCalledTimes(3);
  await load(target, { refresh: true });
  expect(request).toHaveBeenCalledTimes(4);
});

test('cancelled and changed-identity reads never return or cache their results', async () => {
  let resolve, identity = 'a';
  const request = jest.fn().mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValue(detail({}));
  const load = createWorkflowLoader(contract, request, () => identity);
  const pending = load(target); identity = 'b'; resolve(detail({}));
  await expect(pending).rejects.toHaveProperty('code', 'WORKFLOW_IDENTITY_CHANGED');
  const controller = new AbortController(); controller.abort();
  await expect(load(target, { signal: controller.signal })).rejects.toHaveProperty('code', 'WORKFLOW_CANCELLED');
  expect(request).toHaveBeenCalledTimes(1);
});

test.each([['app-v1', 'data'], ['app-query', 'values']])('count uses one filtered server page and retains an unknown total (%s)', async (transport, field) => {
  const request = jest.fn().mockResolvedValue({ success: true, content: { [field]: [], totalCount: 123 } });
  const load = createTaskCenterLoader(tasks, null, request);
  const options = { appType: 'APP_TEST', transport, keyword: 'invoice' };
  expect(await load.count('todo', options)).toMatchObject({ total: 123, basis: 'server-total', available: true, filters: { keyword: 'invoice' } });
  const descriptor = request.mock.calls[0][0];
  expect(transport === 'app-v1' ? descriptor.params : JSON.parse(descriptor.params.query)).toMatchObject(transport === 'app-v1' ? { pageSize: 1, currentPage: 1, keyword: 'invoice' } : { limit: 1, page: 1, appKeys: ['APP_TEST'], keyword: 'invoice' });
  request.mockResolvedValue({ success: true, content: { [field]: [] } });
  expect(await load.count('todo', options)).toMatchObject({ total: null, available: false });
  expect(request).toHaveBeenCalledTimes(2);
  request.mockResolvedValue({ success: true, content: { totalCount: 0, currentPage: 0 } });
  expect(await load.count('todo', options)).toMatchObject({ total: 0, available: true });
  await expect(load.count('todo', { ...options, page: 2 })).rejects.toHaveProperty('code', 'TASK_FILTER_UNSUPPORTED');
  expect(request).toHaveBeenCalledTimes(3);
});

test('the workflow contract is portable without require or access to local credentials', () => {
  const portable = new Function('tasks', 'return (' + createWorkflowContract.toString() + ')(tasks);')(tasks);
  expect(portable.detail(detail({}), target).processInstanceId).toBe('instance-a');
});

test('browser reads prefer the available platform bridge and do not retry a rejected bridge through HTTP', async () => {
  const previous = global.window;
  const fetch = jest.fn();
  const bridge = { ready: true, availableMethods: ['getProcessInstanceById', 'getOperationRecords'],
    getProcessInstanceById: jest.fn().mockResolvedValue(detail({}).content),
    getOperationRecords: jest.fn().mockResolvedValue([{ type: 'TODO', taskId: 'current', operator: { userId: 'u' } }]),
  };
  global.window = { __OPENYIDA_YIDA_API__: bridge, fetch };
  try {
    const result = await createWorkflowLoader(contract)({ ...target, history: true });
    expect(result).toMatchObject({ currentNodes: [{ taskId: 'current' }], history: { state: 'ready' } });
    expect(bridge.getProcessInstanceById).toHaveBeenCalledWith({ appType: 'APP_TEST', processInstanceId: 'instance-a' });
    expect(fetch).not.toHaveBeenCalled();
    bridge.getProcessInstanceById.mockRejectedValue(new Error('permission denied'));
    await expect(createWorkflowLoader(contract)(target)).rejects.toThrow('permission denied');
    expect(fetch).not.toHaveBeenCalled();
  } finally { if (previous === undefined) { delete global.window; } else { global.window = previous; } }
});

test('invalidating pending workflow reads prevents a stale response from repopulating the cache', async () => {
  let resolve;
  const request = jest.fn().mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValue(detail({}));
  const load = createWorkflowLoader(contract, request, () => 'visitor');
  const old = load(target); load.clear(); resolve(detail({}));
  await expect(old).rejects.toHaveProperty('code', 'WORKFLOW_CANCELLED');
  await load(target);
  expect(request).toHaveBeenCalledTimes(2);
});

test('a forced refresh cannot be overwritten in cache by an older in-flight request', async () => {
  let resolve;
  const request = jest.fn().mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValue(detail({ title: 'new' }));
  const load = createWorkflowLoader(contract, request, () => 'visitor');
  const old = load(target);
  expect((await load(target, { refresh: true })).title).toBe('new');
  resolve(detail({ title: 'old' }));
  expect((await old).title).toBe('old');
  expect((await load(target)).title).toBe('new');
  expect(request).toHaveBeenCalledTimes(2);
});

test('corporation count preserves unknown totals and fails on business, login or malformed responses', async () => {
  for (const payload of [{ success: true, content: { values: [] } }, { success: true, content: { values: [], totalCount: 0 } }]) {
    const load = createTaskCenterLoader(tasks, null, async () => payload);
    const result = await load.count('todo', { scope: 'corp', transport: 'app-query' });
    expect(result.available).toBe(payload.content.totalCount === 0);
    expect(result.total).toBe(payload.content.totalCount === 0 ? 0 : null);
  }
  for (const payload of [{ __needLogin: true }, { success: false, errorMsg: 'denied' }, { content: { totalCount: 2 } }, { content: { values: [], totalCount: -1 } }]) {
    await expect(createTaskCenterLoader(tasks, null, async () => payload).count('todo', { scope: 'corp', transport: 'app-query' })).rejects.toThrow();
  }
});
