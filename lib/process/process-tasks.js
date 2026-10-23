'use strict';

const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');

function fail(code, key, details = {}) {
  throw new CliError(t(`process_tasks.${key}`), {
    code,
    details: { retryable: false, retrySafe: true, sideEffectState: 'none', ...details },
  });
}

function taskId(value) {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value <= 0)) {return null;}
  const id = typeof value === 'number' ? String(value) : value;
  return typeof id === 'string' && /^[1-9][0-9]*$/.test(id) ? id : null;
}

function validateArguments(positionals, options, transfer = false) {
  const required = ['process_inst_id', ...(transfer
    ? ['to_user_id', 'form_uuid', 'expect_form_name', 'expect_form_type'] : [])];
  const allowed = [...required, 'json', ...(transfer ? ['task_id', 'remark'] : [])];
  if (positionals.length !== 1 || !/^APP_[A-Za-z0-9_-]+$/.test(positionals[0])) {
    fail('DATA_INVALID_ARGUMENTS', 'arguments_invalid');
  }
  if (Object.keys(options).some(key => !allowed.includes(key))
    || required.some(key => typeof options[key] !== 'string' || !options[key].trim())
    || (options.remark !== undefined && (typeof options.remark !== 'string' || !options.remark.trim()))
    || !/^[A-Za-z0-9_-]+$/.test(options.process_inst_id)
    || (transfer && !/^FORM[-_][A-Za-z0-9_-]+$/.test(options.form_uuid))
    || ['process_inst_id', 'form_uuid', 'to_user_id'].some(key =>
      typeof options[key] === 'string' && /\s/.test(options[key]))
    || (options.task_id !== undefined && !taskId(options.task_id))) {
    fail('DATA_INVALID_ARGUMENTS', 'arguments_invalid');
  }
}

function successful(response) {
  return response && response.success === true && !response.__needLogin && !response.__csrfExpired
    && [undefined, null, '', 0, '0'].includes(response.errorCode);
}

async function queryProcessTasks(client, appType, processInstanceId) {
  const response = await client.get(
    `/dingtalk/web/${appType}/query/formProcInstData/getInstTaskDatas.json`,
    {
      _api: 'DataManage.getInstTasks', _mock: 'false', _stamp: String(Date.now()),
      _locale_time_zone_offset: '28800000', procInstId: processInstanceId,
    }
  );
  if (!successful(response)) {
    fail('DATA_PROCESS_TASK_QUERY_FAILED', 'query_failed', {
      causeCode: response && response.errorCode,
    });
  }
  if (!Array.isArray(response.content)) {
    fail('DATA_PROCESS_TASK_RESPONSE_INVALID', 'response_invalid');
  }
  const ids = new Set();
  const tasks = response.content.map(task => {
    const id = task && taskId(task.id);
    if (!id || task.processInstanceId !== processInstanceId || ids.has(id)
      || typeof task.status !== 'string' || !task.status) {
      fail('DATA_PROCESS_TASK_RESPONSE_INVALID', 'response_invalid');
    }
    ids.add(id);
    return { ...task, taskId: id };
  });
  return { ...response, content: tasks };
}

function selectTask(tasks, requestedId) {
  const running = tasks.filter(task => task.status === 'RUNNING');
  if (requestedId !== undefined) {
    const selected = running.find(task => task.taskId === requestedId);
    if (!selected) {fail('DATA_PROCESS_TASK_NOT_RUNNING', 'not_running', { taskId: requestedId });}
    return selected;
  }
  if (!running.length) {fail('DATA_PROCESS_TASK_NOT_RUNNING', 'not_running');}
  if (running.length !== 1) {
    fail('DATA_PROCESS_TASK_AMBIGUOUS', 'ambiguous', {
      tasks: running.map(task => ({ taskId: task.taskId, groupName: task.groupName,
        activityCode: task.activityCode, actualActionerId: task.actualActionerId })),
    });
  }
  return running[0];
}

function verifiedTask(before, selected, after, toUserId) {
  const original = after.find(task => task.taskId === selected.taskId);
  if (original && original.status === 'RUNNING') {
    return original.actualActionerId === toUserId ? original : null;
  }
  // A recipient's existing parallel task is not evidence of this transfer.
  // Require the old task to close and a uniquely new task in the same node/group.
  if (!selected.activityCode || !taskId(selected.taskGroupId)) {return null;}
  const previousIds = new Set(before.map(task => task.taskId));
  const candidates = after.filter(task => task.status === 'RUNNING'
    && !previousIds.has(task.taskId)
    && task.activityCode === selected.activityCode
    && String(task.taskGroupId) === String(selected.taskGroupId));
  return candidates.length === 1 && candidates[0].actualActionerId === toUserId ? candidates[0] : null;
}

async function transferTask(client, input) {
  const { appType, formUuid, processInstanceId, toUserId, remark = '转交' } = input;
  const before = (await queryProcessTasks(client, appType, processInstanceId)).content;
  const selected = selectTask(before, input.taskId);
  if (typeof selected.actualActionerId !== 'string' || !selected.actualActionerId.trim()) {
    fail('DATA_PROCESS_TASK_RESPONSE_INVALID', 'response_invalid');
  }
  const target = { appType, formUuid, processInstanceId, taskId: selected.taskId, toUserId };
  const nextStep = `openyida data query process-tasks ${appType} --process-inst-id ${processInstanceId} --json`;
  const result = {
    ...target, target, previousActionerId: selected.actualActionerId,
    mutationPerformed: false, mutationAccepted: false, readbackVerified: false,
  };
  if (selected.actualActionerId === toUserId) {
    return { ...result, success: true, status: 'ALREADY_ASSIGNED', alreadyAssigned: true,
      transferred: false, readbackVerified: true, sideEffectState: 'none' };
  }
  let response;
  try {
    const query = new URLSearchParams({
      _api: 'DataManage.redirectTask', _mock: 'false', _stamp: String(Date.now()),
    });
    response = await client.postFormOnce(
      `/dingtalk/web/${appType}/query/instance/redirectTask.json?${query}`,
      { _locale_time_zone_offset: '28800000', taskId: selected.taskId,
        procInstId: processInstanceId, nowActionerId: toUserId, remark, byManager: 'true' },
      { referer: `${client.getAuthRef().baseUrl}/${appType}/admin/${formUuid}/dataManage` }
    );
  } catch (error) {
    fail('DATA_PROCESS_TRANSFER_RESULT_UNKNOWN', 'result_unknown', {
      ...result, mutationPerformed: true, status: 'RESULT_UNKNOWN', mutationAccepted: null,
      retrySafe: false, sideEffectState: 'unknown', readbackAllowed: true, nextStep,
      causeCode: error.code || 'TRANSFER_TRANSPORT_FAILED',
    });
  }
  if (!successful(response)) {
    const rejected = response && response.success === false && !response.__needLogin
      && !response.__csrfExpired && !response.__nonJsonResponse;
    fail(rejected ? 'DATA_PROCESS_TRANSFER_REJECTED' : 'DATA_PROCESS_TRANSFER_RESULT_UNKNOWN',
      rejected ? 'rejected' : 'result_unknown', {
        ...result, mutationPerformed: true, mutationAccepted: rejected ? false : null,
        status: rejected ? 'REJECTED' : 'RESULT_UNKNOWN', retrySafe: false,
        sideEffectState: rejected ? 'none' : 'unknown', readbackAllowed: true, nextStep,
        causeCode: response && response.errorCode,
      });
  }
  let verified;
  try {
    const after = (await queryProcessTasks(client, appType, processInstanceId)).content;
    verified = verifiedTask(before, selected, after, toUserId);
  } catch (error) {
    fail('DATA_PROCESS_TRANSFER_UNVERIFIED', 'unverified', {
      ...result, mutationPerformed: true, mutationAccepted: true, status: 'UNVERIFIED',
      retrySafe: false, sideEffectState: 'unknown', readbackAllowed: true, nextStep,
      causeCode: error.code || 'TRANSFER_READBACK_FAILED',
    });
  }
  if (!verified) {
    fail('DATA_PROCESS_TRANSFER_UNVERIFIED', 'unverified', {
      ...result, mutationPerformed: true, mutationAccepted: true, status: 'UNVERIFIED',
      retrySafe: false, sideEffectState: 'unknown', readbackAllowed: true, nextStep,
      causeCode: 'TRANSFER_READBACK_MISMATCH',
    });
  }
  return { ...result, success: true, transferred: true, status: 'TRANSFERRED',
    mutationPerformed: true, mutationAccepted: true, readbackVerified: true,
    currentTaskId: verified.taskId, actualActionerId: verified.actualActionerId,
    retryable: false, sideEffectState: 'committed' };
}

module.exports = { validateArguments, queryProcessTasks, transferTask };
