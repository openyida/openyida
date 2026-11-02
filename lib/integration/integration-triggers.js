'use strict';

const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');

function invalid(reason) {
  throw new CliError(t('integration_triggers.invalid', reason), {
    code: 'INTEGRATION_TRIGGER_INVALID', details: { reason, remoteWrites: 0 },
  });
}

function scheduleNodes(schedule, id, nextId) {
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)
    || Object.keys(schedule).some(key => !['startDate', 'repeat', 'maxCount', 'expireDate'].includes(key))) {
    invalid('schedule');
  }
  const { startDate, repeat = 'ONCE', maxCount, expireDate } = schedule;
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:00$/.test(startDate || '')
    || !Number.isFinite(Date.parse(startDate.replace(' ', 'T') + '+08:00'))
    || !['ONCE', 'DAILY', 'WORKDAY', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'LAST_DAY_PER_MONTH'].includes(repeat)
    || maxCount !== undefined && (!Number.isInteger(maxCount) || maxCount < 1 || maxCount > 100)
    || expireDate !== undefined && (!Number.isFinite(expireDate)
      || expireDate <= Date.parse(startDate.replace(' ', 'T') + '+08:00'))
    || maxCount !== undefined && expireDate !== undefined
    || repeat === 'ONCE' && (maxCount !== undefined || expireDate !== undefined)) { invalid('schedule values'); }
  if (repeat !== 'ONCE' && maxCount === undefined && expireDate === undefined) {
    throw new CliError(t('integration_triggers.end_required'), {
      code: 'INTEGRATION_TRIGGER_INVALID', details: { reason: 'schedule end condition', remoteWrites: 0 },
    });
  }
  const startTimestamp = Date.parse(startDate.replace(' ', 'T') + '+08:00');
  if (new Date(startTimestamp + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' ') !== startDate) {
    invalid('invalid calendar date');
  }
  const inputs = { startDate: startTimestamp, repeat: { type: repeat } };
  if (maxCount !== undefined) { inputs.end = { maxCount }; }
  if (expireDate !== undefined) { inputs.end = { expireDate }; }
  const name = { zh_CN: '定时触发', en_US: 'Scheduled trigger', type: 'i18n' };
  return {
    processNode: { name, description: '', type: 'trigger', nodeId: id, prevId: '', nextId: [nextId],
      props: { triggerType: 'TimerEvent', inputs }, childNodes: [] },
    viewNode: { componentName: 'StartNode', id, props: { nodeName: 'StartNode', name, nodeError: '',
      start: { type: 'trigger', triggerType: 'TimerEvent', startDate: startTimestamp, repeatRuleType: repeat,
        startTrigger: { startTriggerTime: 'specifiedTime' },
        overTimeType: expireDate !== undefined ? 'time' : 'count',
        ...(expireDate === undefined ? { overCount: maxCount ?? 1 } : {}),
        ...(expireDate !== undefined ? { overTime: expireDate } : {}), rules: true } } },
    formEventTypes: [],
  };
}

function validateTriggerSpec(spec, fields) {
  if (Object.hasOwn(spec, 'schedule')) {
    if (spec.events || spec.formEventTypes || spec.changedFields || spec.triggerConditions?.length
      || spec.approvalActions?.length || spec.approvalNodeIds?.length || spec.triggerRecursively) {
      invalid('schedule conflicts with form trigger');
    }
    scheduleNodes(spec.schedule, 'validate', 'validate');
  }
  if ((spec.events || spec.formEventTypes || []).some(event => ['targetField', 'fieldChange'].includes(event))
    && !spec.changedFields?.length) { invalid('field-change event requires changedFields'); }
  if (spec.changedFields !== undefined) {
    if (!Array.isArray(spec.changedFields) || !spec.changedFields.length
      || spec.changedFields.some(id => typeof id !== 'string' || !id || /[,\s]/.test(id))
      || new Set(spec.changedFields).size !== spec.changedFields.length
      || !(spec.events || spec.formEventTypes || []).some(event => ['update', 'targetField', 'fieldChange'].includes(event))) {
      invalid('changedFields requires update event and unique field IDs');
    }
    if (fields) {
      for (const id of spec.changedFields) {
        const field = fields.find(item => item.props?.fieldId === id || item.fieldId === id);
        if (!field || field.componentName === 'TableField') { invalid(`unknown/list field: ${id}`); }
      }
    }
  }
}

module.exports = { scheduleNodes, validateTriggerSpec };
