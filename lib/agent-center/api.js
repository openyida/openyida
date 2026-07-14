'use strict';

const { createAuthRef, createYidaClient, isAuthRefReady } = require('../core/yida-client');

const AGENT_TYPE_ALIASES = {
  normal: 'NORMAL',
  NORMAL: 'NORMAL',
  departure: 'DEPARTURE',
  depart: 'DEPARTURE',
  dismissed: 'DEPARTURE',
  dismiss: 'DEPARTURE',
  DEPARTURE: 'DEPARTURE',
};

const AGENT_TYPE_LABELS = {
  NORMAL: '在职代理',
  DEPARTURE: '离职代理',
};

const AGENT_CATEGORY_ALIASES = {
  execute: 'EXECUTE',
  process: 'EXECUTE',
  approve: 'EXECUTE',
  approval: 'EXECUTE',
  EXECUTE: 'EXECUTE',
  start: 'START',
  submit: 'START',
  START: 'START',
};

const AGENT_CATEGORY_LABELS = {
  EXECUTE: '代处理流程',
  START: '代提交流程',
};

const AGENT_STATUS_ALIASES = {
  all: 'ALL',
  ALL: 'ALL',
  pending: 'DIS',
  dis: 'DIS',
  DIS: 'DIS',
  active: 'EFF',
  effective: 'EFF',
  eff: 'EFF',
  EFF: 'EFF',
  expired: 'OUT',
  out: 'OUT',
  OUT: 'OUT',
  canceled: 'CANCEL',
  cancelled: 'CANCEL',
  cancel: 'CANCEL',
  CANCEL: 'CANCEL',
};

const AGENT_STATUS_LABELS = {
  ALL: '全部',
  DIS: '待生效',
  EFF: '代理中',
  OUT: '已过期',
  CANCEL: '已撤销',
};

const AGENT_RANGE_ALIASES = {
  all: 'ALL',
  ALL: 'ALL',
  part: 'PART',
  partial: 'PART',
  PART: 'PART',
};

function getAuthRef() {
  const authRef = createAuthRef();
  if (!isAuthRefReady(authRef)) {
    throw new Error('无法获取有效登录态或 CSRF Token');
  }
  return authRef;
}

function normalizeAgentType(type) {
  const normalized = AGENT_TYPE_ALIASES[type || 'normal'];
  if (!normalized) {
    throw new Error(`无效代理类型：${type}，可用值：normal, departure`);
  }
  return normalized;
}

function normalizeAgentCategory(category) {
  const normalized = AGENT_CATEGORY_ALIASES[category || 'execute'];
  if (!normalized) {
    throw new Error(`无效代理类别：${category}，可用值：execute, start`);
  }
  return normalized;
}

function normalizeAgentStatus(status) {
  const normalized = AGENT_STATUS_ALIASES[status || 'ALL'];
  if (!normalized) {
    throw new Error(`无效代理状态：${status}，可用值：ALL, DIS, EFF, OUT, CANCEL`);
  }
  return normalized;
}

function normalizeAgentRangeType(rangeType) {
  const normalized = AGENT_RANGE_ALIASES[rangeType || 'ALL'];
  if (!normalized) {
    throw new Error(`无效代理范围：${rangeType}，可用值：ALL, PART`);
  }
  return normalized;
}

function normalizeYesNo(value, defaultValue = 'n') {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  if (value === true) {
    return 'y';
  }
  const normalized = String(value).trim().toLowerCase();
  if (['y', 'yes', 'true', '1', 'on'].includes(normalized)) {
    return 'y';
  }
  if (['n', 'no', 'false', '0', 'off'].includes(normalized)) {
    return 'n';
  }
  throw new Error(`布尔参数只支持 y/n：${value}`);
}

function buildCommonParams(authRef, apiName, params = {}) {
  const base = {
    _mock: 'false',
    _csrf_token: authRef.csrfToken,
    _locale_time_zone_offset: '28800000',
    _stamp: String(Date.now()),
  };
  if (apiName) {
    base._api = apiName;
  }
  return {
    ...base,
    ...params,
  };
}

async function agentGet(path, apiName, params = {}, authRef = getAuthRef()) {
  return createYidaClient({ authRef }).get(path, auth => buildCommonParams(auth, apiName, params));
}

async function agentPost(path, apiName, params = {}, authRef = getAuthRef()) {
  return createYidaClient({ authRef }).postForm(path, auth => buildCommonParams(auth, apiName, params));
}

function assertSuccess(result, action) {
  if (result && result.success !== false && !result.__needLogin && !result.__csrfExpired) {
    return result;
  }
  const message = result && (result.errorMsg || result.message || result.errorCode);
  throw new Error(`${action}失败${message ? `：${message}` : ''}`);
}

function formatTimestamp(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '';
  }
  const date = new Date(numeric);
  const pad = n => String(n).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + ' ' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
  ].join(':');
}

function normalizeAgentTask(record = {}) {
  const agentType = record.agentType || '';
  const agentCategory = record.agentCategory || '';
  const status = record.status || '';
  return {
    id: record.id,
    agentUuid: record.agentUuid || '',
    agentType,
    agentTypeLabel: AGENT_TYPE_LABELS[agentType] || agentType,
    agentCategory,
    agentCategoryLabel: AGENT_CATEGORY_LABELS[agentCategory] || agentCategory,
    status,
    statusLabel: AGENT_STATUS_LABELS[status] || status,
    sourceActionerId: record.sourceActionerId || '',
    sourceActionerName: record.sourceActionerName || '',
    toActionerId: record.toActionerId || '',
    toActionerName: record.toActionerName || '',
    creator: record.creator || '',
    creatorName: record.creatorName || '',
    originIsView: record.originIsView || 'n',
    agentValue: record.agentValue || '',
    agentRangeType: record.agentRangeType || '',
    agentRangeValue: record.agentRangeValue || '',
    gmtStartDate: record.gmtStartDate || null,
    gmtStartDateText: formatTimestamp(record.gmtStartDate),
    gmtEndDate: record.gmtEndDate || null,
    gmtEndDateText: formatTimestamp(record.gmtEndDate),
    gmtCreate: record.gmtCreate || null,
    gmtCreateText: formatTimestamp(record.gmtCreate),
  };
}

function parseAgentList(result) {
  const content = (result && result.content) || {};
  return {
    success: true,
    currentPage: Number(content.currentPage || 1),
    pageSize: Number(content.limit || content.pageSize || 0),
    totalCount: Number(content.totalCount || 0),
    agents: (content.values || []).map(normalizeAgentTask),
  };
}

function serializeRangeValue(rangeValue) {
  if (!rangeValue) {
    return undefined;
  }
  if (typeof rangeValue === 'string') {
    return rangeValue;
  }
  if (!Array.isArray(rangeValue)) {
    throw new Error('agentRangeValue 必须是 JSON 字符串或数组');
  }
  return JSON.stringify(rangeValue.map(item => ({
    appType: item.appType,
    formUuid: item.formUuid || item.value,
  })));
}

function buildNormalAgentParams(options = {}, config = {}) {
  const start = options.gmtStartDate || options.start;
  const end = options.gmtEndDate || options.end;
  if (!start || !end) {
    throw new Error('在职代理必须提供开始和结束时间');
  }

  const agentRangeType = normalizeAgentRangeType(options.agentRangeType || options.rangeType);
  const params = {
    gmtStartDate: String(start),
    gmtEndDate: String(end),
    originIsView: normalizeYesNo(options.originIsView || options.notifySource, 'n'),
    agentRangeType,
  };

  if (config.includeCategory !== false || options.agentCategory || options.category) {
    params.agentCategory = normalizeAgentCategory(options.agentCategory || options.category);
  }

  const agentRangeValue = serializeRangeValue(options.agentRangeValue || options.rangeValue);
  if (agentRangeType === 'PART') {
    if (!agentRangeValue) {
      throw new Error('PART 代理范围必须提供 agentRangeValue');
    }
    params.agentRangeValue = agentRangeValue;
  }

  return params;
}

async function listAgentTasks(options = {}, authRef = getAuthRef()) {
  const result = await agentGet('/query/agenttask/getAgentTasks.json', 'Agent.getAgentTasks', {
    pageIndex: String(options.page || options.pageIndex || 1),
    pageSize: String(options.size || options.pageSize || 10),
    keywords: options.keyword || options.keywords || '',
    status: normalizeAgentStatus(options.status),
  }, authRef);
  assertSuccess(result, '查询代理列表');
  return parseAgentList(result);
}

async function createAgentTask(options = {}, authRef = getAuthRef()) {
  const sourceActionerId = options.sourceActionerId || options.sourceUserId || options.source;
  const toActionerId = options.toActionerId || options.targetUserId || options.target;
  if (!sourceActionerId) {
    throw new Error('缺少被代理人/离职人 userId');
  }
  if (!toActionerId) {
    throw new Error('缺少代理人 userId');
  }

  const agentType = normalizeAgentType(options.agentType || options.type);
  let params = {
    sourceActionerId,
    toActionerId,
    agentType,
    agentValue: options.agentValue || 'ALL',
  };

  if (agentType === 'NORMAL') {
    params = {
      ...params,
      ...buildNormalAgentParams(options, { includeCategory: true }),
    };
  }

  const result = await agentPost('/query/agenttask/createAgentTask.json', 'Agent.createAgentTask', params, authRef);
  assertSuccess(result, '创建代理');
  const content = result.content || {};
  return {
    success: content.errorCode ? false : true,
    conflict: content.errorCode === '1002',
    errorCode: content.errorCode || '',
    agentUuid: content.agentUuid || '',
    name: content.name || '',
    content,
  };
}

async function updateAgentTask(options = {}, authRef = getAuthRef()) {
  const agentUuid = options.agentUuid || options.uuid;
  if (!agentUuid) {
    throw new Error('缺少 agentUuid');
  }
  const toActionerId = options.toActionerId || options.targetUserId || options.target;
  if (!toActionerId) {
    throw new Error('缺少代理人 userId');
  }

  const requestedType = options.agentType || options.type;
  const agentType = requestedType ? normalizeAgentType(requestedType) : 'NORMAL';
  let params = {
    agentUuid,
    toActionerId,
  };

  if (agentType === 'NORMAL' && (options.gmtStartDate || options.start || options.gmtEndDate || options.end)) {
    params = {
      ...params,
      ...buildNormalAgentParams(options, { includeCategory: false }),
    };
  }

  const result = await agentPost('/query/agenttask/updateAgentTask.json', 'Agent.updateAgentTask', params, authRef);
  assertSuccess(result, '更新代理');
  return {
    success: true,
    agentUuid,
    content: result.content || {},
  };
}

async function cancelAgentTask(options = {}, authRef = getAuthRef()) {
  const agentTaskUuid = options.agentTaskUuid || options.agentUuid || options.uuid;
  if (!agentTaskUuid) {
    throw new Error('缺少 agentUuid');
  }
  const agentType = normalizeAgentType(options.agentType || options.type);
  const result = await agentGet('/query/agenttask/cancelAgentTask.json', 'Agent.cancelAgentTask', {
    agentTaskUuid,
    agentType,
  }, authRef);
  assertSuccess(result, '撤销代理');
  return {
    success: true,
    agentUuid: agentTaskUuid,
    agentType,
    content: result.content || {},
  };
}

async function isLeaderShip(authRef = getAuthRef()) {
  const result = await agentGet('/query/agenttask/isLeaderShip.json', 'Agent.isLeaderShip', {}, authRef);
  assertSuccess(result, '查询主管身份');
  return {
    success: true,
    isLeader: !!result.content,
    content: result.content,
  };
}

async function getLastDepartureAgent(authRef = getAuthRef()) {
  const result = await agentGet('/query/agenttask/getLastDissmissAgent.json', 'Agent.getLastDissmissAgent', {}, authRef);
  assertSuccess(result, '查询最近离职代理人');
  return {
    success: true,
    lastDepartureAgent: result.content || {},
  };
}

async function getAgentRange(options = {}, authRef = getAuthRef()) {
  const agentId = options.agentId || options.agentUuid || options.uuid;
  if (!agentId) {
    throw new Error('缺少 agentUuid');
  }
  const result = await agentPost('/query/agenttask/getTaskByAgentId.json', 'Agent.getTaskByAgentId', {
    agentId,
  }, authRef);
  assertSuccess(result, '查询代理范围');
  const content = result.content || {};
  let agentRangeValues = content.agentRangeValues || [];
  if ((!Array.isArray(agentRangeValues) || agentRangeValues.length === 0) && content.agentRangeValue) {
    try {
      agentRangeValues = JSON.parse(content.agentRangeValue);
    } catch (err) {
      agentRangeValues = [];
    }
  }
  return {
    success: true,
    agentUuid: content.agentUuid || agentId,
    agentRangeType: content.agentRangeType || '',
    agentRangeValue: content.agentRangeValue || '',
    agentRangeValues,
    content,
  };
}

module.exports = {
  AGENT_TYPE_ALIASES,
  AGENT_TYPE_LABELS,
  AGENT_CATEGORY_ALIASES,
  AGENT_CATEGORY_LABELS,
  AGENT_STATUS_ALIASES,
  AGENT_STATUS_LABELS,
  AGENT_RANGE_ALIASES,
  getAuthRef,
  normalizeAgentType,
  normalizeAgentCategory,
  normalizeAgentStatus,
  normalizeAgentRangeType,
  normalizeYesNo,
  normalizeAgentTask,
  serializeRangeValue,
  buildNormalAgentParams,
  listAgentTasks,
  createAgentTask,
  updateAgentTask,
  cancelAgentTask,
  isLeaderShip,
  getLastDepartureAgent,
  getAgentRange,
};
