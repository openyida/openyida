'use strict';

const { queryProcessTasks, transferTask } = require('../lib/process/process-tasks');

const input = { appType: 'APP_X', formUuid: 'FORM-X', processInstanceId: 'PROC-1',
  toUserId: '00042', remark: 'Reassign approval' };
const task = (overrides = {}) => ({ id: 101, processInstanceId: 'PROC-1', status: 'RUNNING',
  actualActionerId: '00001', originalActionerId: '00001', activityCode: 'node-A',
  taskGroupId: 201, taskSequenceId: 301, groupName: 'Approver', ...overrides });
const list = content => ({ success: true, content });
let client;

beforeEach(() => {
  client = { get: jest.fn(), postFormOnce: jest.fn().mockResolvedValue({ success: true, content: null }),
    getAuthRef: () => ({ baseUrl: 'https://private.example.test' }) };
});

async function runTransfer(before = [task()], after = [task({ actualActionerId: '00042' })], options = {}) {
  client.get.mockResolvedValueOnce(list(before)).mockResolvedValueOnce(list(after));
  return transferTask(client, { ...input, ...options });
}

test('queries administrator tasks and uses id, never activity, group, sequence or URL IDs', async () => {
  client.get.mockResolvedValue(list([task({ url: 'http://localhost/?taskId=999' })]));
  const result = await queryProcessTasks(client, 'APP_X', 'PROC-1');
  expect(client.get).toHaveBeenCalledWith(
    '/dingtalk/web/APP_X/query/formProcInstData/getInstTaskDatas.json',
    expect.objectContaining({ _api: 'DataManage.getInstTasks', procInstId: 'PROC-1' }));
  expect(result.content[0]).toMatchObject({ id: 101, taskId: '101', actualActionerId: '00001' });
  client.get.mockResolvedValue(list([]));
  expect((await queryProcessTasks(client, 'APP_X', 'PROC-1')).content).toEqual([]);
  expect(client.postFormOnce).not.toHaveBeenCalled();
});

test.each([
  null, {}, [null], [task({ id: 0 })], [task({ id: Number.MAX_SAFE_INTEGER + 1 })],
  [task({ id: 'abc' })], [task({ id: undefined, taskId: '101' })],
  [task({ processInstanceId: 'OTHER' })], [task({ status: undefined })], [task(), task()],
].map(content => [content]))('rejects unverifiable task responses %j before writing', async content => {
  client.get.mockResolvedValue(list(content));
  await expect(transferTask(client, input)).rejects.toMatchObject({ code: 'DATA_PROCESS_TASK_RESPONSE_INVALID' });
  expect(client.postFormOnce).not.toHaveBeenCalled();
});

test('keeps large decimal string IDs intact', async () => {
  client.get.mockResolvedValue(list([task({ id: '9007199254740993' })]));
  expect((await queryProcessTasks(client, 'APP_X', 'PROC-1')).content[0].taskId).toBe('9007199254740993');
});

test('does not treat query denial as an empty task list', async () => {
  client.get.mockResolvedValue({ success: false, errorCode: 'NO_PERMISSION' });
  await expect(transferTask(client, input)).rejects.toMatchObject({ code: 'DATA_PROCESS_TASK_QUERY_FAILED' });
  expect(client.postFormOnce).not.toHaveBeenCalled();
});

test('accepts null content only after readback proves the actual recipient', async () => {
  const result = await runTransfer();
  expect(result).toMatchObject({ success: true, transferred: true, status: 'TRANSFERRED',
    taskId: '101', currentTaskId: '101', actualActionerId: '00042', previousActionerId: '00001',
    mutationAccepted: true, readbackVerified: true, sideEffectState: 'committed' });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
  const [path, body, options] = client.postFormOnce.mock.calls[0];
  const url = new URL(path, client.getAuthRef().baseUrl);
  expect(url.pathname).toBe('/dingtalk/web/APP_X/query/instance/redirectTask.json');
  expect(url.searchParams.get('_api')).toBe('DataManage.redirectTask');
  expect(body).toMatchObject({ taskId: '101', procInstId: 'PROC-1', nowActionerId: '00042',
    remark: 'Reassign approval', byManager: 'true' });
  expect(body).not.toHaveProperty('_csrf_token');
  expect(options.referer).toBe('https://private.example.test/APP_X/admin/FORM-X/dataManage');
  expect(client.get).toHaveBeenCalledTimes(2);
});

test.each([
  [undefined, '转交'],
  ['我休假，请叶研代为处理', '我休假，请叶研代为处理'],
])('uses default or the exact user reason %j', async (remark, expected) => {
  await runTransfer(undefined, undefined, { remark });
  expect(client.postFormOnce.mock.calls[0][1].remark).toBe(expected);
});

test.each([
  [], [task({ status: 'COMPLETED' })],
].map(before => [before]))('blocks absence and ended tasks %j', async before => {
  await expect(runTransfer(before)).rejects.toMatchObject({ code: 'DATA_PROCESS_TASK_NOT_RUNNING' });
  expect(client.postFormOnce).not.toHaveBeenCalled();
});

test('requires explicit selection when several tasks run', async () => {
  await expect(runTransfer([task(), task({ id: 102 })])).rejects.toMatchObject({
    code: 'DATA_PROCESS_TASK_AMBIGUOUS', details: { tasks: [{ taskId: '101' }, { taskId: '102' }] },
  });
  expect(client.postFormOnce).not.toHaveBeenCalled();
});

test('explicit selection transfers only the selected running task', async () => {
  await runTransfer([task(), task({ id: 102 })],
    [task(), task({ id: 102, actualActionerId: '00042' })], { taskId: '102' });
  expect(client.postFormOnce.mock.calls[0][1].taskId).toBe('102');
});

test.each(['201', '301', '999'])('rejects a non-task or stale ID %s', async id => {
  await expect(runTransfer([task()], undefined, { taskId: id })).rejects.toMatchObject({
    code: 'DATA_PROCESS_TASK_NOT_RUNNING',
  });
  expect(client.postFormOnce).not.toHaveBeenCalled();
});

test('missing actual actioner blocks writing', async () => {
  await expect(runTransfer([task({ actualActionerId: undefined })])).rejects.toMatchObject({
    code: 'DATA_PROCESS_TASK_RESPONSE_INVALID',
  });
  expect(client.postFormOnce).not.toHaveBeenCalled();
});

test('already assigned task is a verified no-op', async () => {
  const result = await runTransfer([task({ actualActionerId: '00042' })]);
  expect(result).toMatchObject({ success: true, status: 'ALREADY_ASSIGNED', transferred: false,
    mutationPerformed: false, mutationAccepted: false, readbackVerified: true });
  expect(client.postFormOnce).not.toHaveBeenCalled();
});

test.each([
  [task({ id: 102, actualActionerId: '00042' })],
  [task({ status: 'COMPLETED' }), task({ id: 102, actualActionerId: '00042' })],
].map(after => [after]))('verifies a uniquely new recipient task in the same node/group %j', async after => {
  expect(await runTransfer([task()], after)).toMatchObject({ currentTaskId: '102', readbackVerified: true });
});

test.each([
  [], [task()], [task({ status: 'COMPLETED', actualActionerId: '00042' })],
  [task({ originalActionerId: '00042' })],
  [task(), task({ id: 102, actualActionerId: '00042' })],
  [task({ id: 102, activityCode: 'OTHER', actualActionerId: '00042' })],
  [task({ id: 102, taskGroupId: 999, actualActionerId: '00042' })],
  [task({ id: 102, actualActionerId: '00042' }), task({ id: 103 })],
].map(after => [after]))('does not infer successful transfer from ambiguous readback %j', async after => {
  await expect(runTransfer([task()], after)).rejects.toMatchObject({
    code: 'DATA_PROCESS_TRANSFER_UNVERIFIED', details: { status: 'UNVERIFIED',
      mutationAccepted: true, readbackVerified: false, retrySafe: false, sideEffectState: 'unknown',
      nextStep: expect.stringContaining('data query process-tasks') },
  });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});

test('an existing parallel recipient task cannot prove successful transfer', async () => {
  const recipientTask = task({ id: 102, actualActionerId: '00042' });
  await expect(runTransfer([task(), recipientTask], [recipientTask], { taskId: '101' }))
    .rejects.toMatchObject({ code: 'DATA_PROCESS_TRANSFER_UNVERIFIED' });
});

test('new ID without a verified node/group stays unverified', async () => {
  await expect(runTransfer([task({ taskGroupId: undefined })], [task({ id: 102, actualActionerId: '00042' })]))
    .rejects.toMatchObject({ code: 'DATA_PROCESS_TRANSFER_UNVERIFIED' });
});

test('readback failure preserves accepted state without resubmission', async () => {
  client.get.mockResolvedValueOnce(list([task()])).mockRejectedValueOnce(new Error('timeout'));
  await expect(transferTask(client, input)).rejects.toMatchObject({
    code: 'DATA_PROCESS_TRANSFER_UNVERIFIED', details: { mutationAccepted: true, readbackVerified: false },
  });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});

test('submission timeout reports unknown outcome and never replays', async () => {
  client.get.mockResolvedValue(list([task()]));
  client.postFormOnce.mockRejectedValue(new Error('timeout'));
  await expect(transferTask(client, input)).rejects.toMatchObject({
    code: 'DATA_PROCESS_TRANSFER_RESULT_UNKNOWN', details: { status: 'RESULT_UNKNOWN',
      mutationAccepted: null, retrySafe: false, readbackAllowed: true },
  });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
  expect(client.get).toHaveBeenCalledTimes(1);
});

test.each([null, { __needLogin: true }, { __csrfExpired: true },
  { success: false, __nonJsonResponse: true }, { success: true, errorCode: 'NONZERO' },
])('unknown submission response %j never succeeds or replays', async response => {
  client.get.mockResolvedValue(list([task()]));
  client.postFormOnce.mockResolvedValue(response);
  await expect(transferTask(client, input)).rejects.toMatchObject({
    code: 'DATA_PROCESS_TRANSFER_RESULT_UNKNOWN', details: { mutationAccepted: null },
  });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});

test('explicit business refusal is reported as rejected', async () => {
  client.get.mockResolvedValue(list([task()]));
  client.postFormOnce.mockResolvedValue({ success: false, errorCode: 'NO_PERMISSION' });
  await expect(transferTask(client, input)).rejects.toMatchObject({ code: 'DATA_PROCESS_TRANSFER_REJECTED',
    details: { mutationAccepted: false, sideEffectState: 'none', causeCode: 'NO_PERMISSION' } });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});
