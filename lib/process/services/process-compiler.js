/**
 * process-compiler.js - 共享宜搭流程定义编译器
 *
 * 服务于 configure-process DSL 与流程创建命令。
 */

'use strict';

const { buildYidaI18n } = require('../../core/yida-i18n');
const { t } = require('../../core/i18n');

const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

class ProcessCompilerError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'ProcessCompilerError';
    this.code = code;
    this.details = details;
  }
}

// ── 操作符映射（基于浏览器捕获的真实数据）────────────

const OP_CODE_TO_DISPLAY = {
  Equal: '等于',
  NotEqual: '不等于',
  Contains: '包含',
  NotContain: '不包含',
  IsEmpty: '为空',
  IsNotEmpty: '不为空',
  GreaterThan: '大于',
  Bigger: '大于',
  GreaterThanOrEqual: '大于等于',
  LessThan: '小于',
  LessThanOrEqual: '小于等于',
  In: '属于',
  NotIn: '不属于',
};

const COMPONENT_TO_RULE_TYPE = {
  TextField: 'rule_text',
  TextareaField: 'rule_text',
  NumberField: 'rule_number',
  SelectField: 'rule_select',
  RadioField: 'rule_radio',
  DateField: 'rule_date',
  EmployeeField: 'rule_employee',
};

const NODE_TYPE_ALIASES = {
  approval: 'approval',
  approver: 'approval',
  approvalnode: 'approval',
  operator: 'operator',
  executor: 'operator',
  handler: 'operator',
  fill: 'operator',
  filler: 'operator',
  formfill: 'operator',
  operatornode: 'operator',
  multiapproval: 'multiApproval',
  multiapprover: 'multiApproval',
  multiapprovalnode: 'multiApproval',
  carbon: 'carbon',
  cc: 'carbon',
  copy: 'carbon',
  copynode: 'carbon',
  carbonnode: 'carbon',
  route: 'route',
  branch: 'route',
  branchnode: 'route',
  conditioncontainer: 'route',
  conditionnode: 'route',
  parallel: 'parallel',
  parallelbranch: 'parallel',
  connector: 'ConnectorNode',
  connectornode: 'ConnectorNode',
  groovy: 'GroovyNode',
  groovynode: 'GroovyNode',
  javascript: 'JavaScriptNode',
  js: 'JavaScriptNode',
  javascriptnode: 'JavaScriptNode',
  initiateapproval: 'InitiateApprovalNode',
  subprocess: 'InitiateApprovalNode',
  initiateapprovalnode: 'InitiateApprovalNode',
  sendmessage: 'SendMessageNode',
  message: 'SendMessageNode',
  sendmessagenode: 'SendMessageNode',
  sendemail: 'SendEmailNode',
  email: 'SendEmailNode',
  sendemailnode: 'SendEmailNode',
  getdata: 'GetSingleDataNode',
  getsingledata: 'GetSingleDataNode',
  getsingledatanode: 'GetSingleDataNode',
  getbatchdata: 'GetBatchDataNode',
  getbatchdatanode: 'GetBatchDataNode',
  adddata: 'AddDataNode',
  createdata: 'AddDataNode',
  adddatanode: 'AddDataNode',
  updatedata: 'UpdateDataNode',
  updatedatanode: 'UpdateDataNode',
  deletedata: 'DeleteDataNode',
  deletedatanode: 'DeleteDataNode',
  sendcard: 'SendCardNode',
  sendcardnode: 'SendCardNode',
  cardnode: 'CardNode',
  updatecard: 'UpdateCardNode',
  updatecardnode: 'UpdateCardNode',
  cardupdate: 'CardUpdateNode',
  cardupdatenode: 'CardUpdateNode',
  cycle: 'CycleContainer',
  foreach: 'CycleContainer',
  cyclecontainer: 'CycleContainer',
  ai: 'AINode',
  ainode: 'AINode',
};

const CONNECTOR_MODE_TO_PROCESS_TYPE = {
  1: 'innerConnector',
  3: 'thirdConnector',
  5: 'httpConnector',
  9: 'faasConnector',
};

const GENERIC_NODE_CONFIGS = {
  ConnectorNode: {
    processType: 'innerConnector',
    title: ['连接器', 'Connector', 'コネクタ'],
    propKeys: ['connectorRules'],
  },
  GroovyNode: {
    processType: 'CodeExecutor',
    title: ['Groovy', 'Groovy', 'Groovy'],
    propKeys: ['groovy'],
  },
  JavaScriptNode: {
    processType: 'CodeExecutor',
    title: ['JavaScript', 'JavaScript', 'JavaScript'],
    propKeys: ['JavaScript'],
    propAliases: { javascript: 'JavaScript' },
  },
  InitiateApprovalNode: {
    processType: 'initiateApproval',
    title: ['子流程', 'Sub process', 'サブプロセス'],
    propKeys: ['initiateApprovalRules'],
  },
  SendMessageNode: {
    processType: 'sendMessage',
    title: ['消息通知', 'Message notification', 'メッセージ通知'],
    propKeys: ['sendMessageRules'],
  },
  SendEmailNode: {
    processType: 'sendEmail',
    title: ['发送邮件', 'Send email', 'メール送信'],
    propKeys: ['sendEmailRules'],
  },
  GetSingleDataNode: {
    processType: 'dataRetrieve',
    title: ['获取单条数据', 'Get single data', '単一データ取得'],
    propKeys: ['getData'],
  },
  GetBatchDataNode: {
    processType: 'dataRetrieve',
    title: ['获取多条数据', 'Get batch data', '複数データ取得'],
    propKeys: ['getData'],
  },
  AddDataNode: {
    processType: 'dataCreate',
    title: ['新增数据', 'Add data', 'データ追加'],
    propKeys: ['addDataRules'],
  },
  UpdateDataNode: {
    processType: 'dataUpdate',
    title: ['更新数据', 'Update data', 'データ更新'],
    propKeys: ['updateDataRules'],
  },
  DeleteDataNode: {
    processType: 'dataDelete',
    title: ['删除数据', 'Delete data', 'データ削除'],
    propKeys: ['deleteData'],
  },
  SendCardNode: {
    processType: 'sendCard',
    title: ['发送卡片', 'Send card', 'カード送信'],
    propKeys: ['sendCardRules', 'cardRules'],
  },
  CardNode: {
    processType: 'sendCard',
    title: ['发送卡片', 'Send card', 'カード送信'],
    propKeys: ['sendCardRules', 'cardRules'],
  },
  UpdateCardNode: {
    processType: 'updateCard',
    title: ['更新卡片', 'Update card', 'カード更新'],
    propKeys: ['updateCardRules', 'cardUpdateRules'],
  },
  CardUpdateNode: {
    processType: 'updateCard',
    title: ['更新卡片', 'Update card', 'カード更新'],
    propKeys: ['updateCardRules', 'cardUpdateRules'],
  },
  CycleContainer: {
    processType: 'foreach',
    title: ['循环', 'Loop', 'ループ'],
    propKeys: ['cycleContainerRules'],
    propAliases: { cycleRules: 'cycleContainerRules', foreachRules: 'cycleContainerRules' },
  },
  AINode: {
    processType: 'AIExecutor',
    title: ['AI 工作流', 'AI workflow', 'AI ワークフロー'],
    propKeys: ['workFlowRules'],
    propAliases: { workflowRules: 'workFlowRules' },
  },
};

// ── 辅助函数 ─────────────────────────────────────────

function generateUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let nodeIdCounter = 1;
function generateNodeId() {
  return 'node_oc' + Date.now().toString(36) + (nodeIdCounter++).toString(36);
}

function i18n(zhText, enText, jaText) {
  return buildYidaI18n(zhText, {
    en_US: enText || zhText,
    ja_JP: jaText || zhText,
  });
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeList(value) {
  if (value === undefined || value === null || value === '') {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function clonePlain(value) {
  if (value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value));
}

function normalizeNodeType(node) {
  if (!node) {
    return '';
  }
  if (node.componentName && GENERIC_NODE_CONFIGS[node.componentName]) {
    return node.componentName;
  }
  const rawType = pickFirstDefined(node.type, node.kind, node.nodeType, node.componentName);
  if (!rawType) {
    return '';
  }
  const raw = String(rawType).trim();
  const normalized = raw.toLowerCase().replace(/[-_\s]/g, '');
  return NODE_TYPE_ALIASES[normalized] || raw;
}

function getNodeName(node, fallback) {
  const value = pickFirstDefined(
    node && node.name,
    node && node.title,
    node && node.props && node.props.name,
    fallback
  );
  if (isPlainObject(value)) {
    return pickFirstDefined(value.zh_CN, value.en_US, value.ja_JP, fallback) || fallback;
  }
  return String(value || fallback || '');
}

function getNodeDescription(node) {
  const value = pickFirstDefined(
    node && node.description,
    node && node.props && node.props.description,
    ''
  );
  if (isPlainObject(value)) {
    return pickFirstDefined(value.zh_CN, value.en_US, value.ja_JP, '') || '';
  }
  return String(value || '');
}

function pickFirstDefined() {
  for (let i = 0; i < arguments.length; i++) {
    if (arguments[i] !== undefined && arguments[i] !== null && arguments[i] !== '') {
      return arguments[i];
    }
  }
  return undefined;
}

function getEntityId(item) {
  if (typeof item === 'string' || typeof item === 'number') {
    return String(item);
  }
  if (!isPlainObject(item)) {
    return '';
  }
  return String(pickFirstDefined(item.id, item.userId, item.workNo, item.value, item.uuid, item.roleId, item.code) || '');
}

function getEntityLabel(item, id) {
  if (!isPlainObject(item)) {
    return id;
  }
  return String(pickFirstDefined(item.label, item.name, item.nickName, item.userName, item.title, id) || id);
}

function normalizeApprovalMode(value) {
  const mode = String(value || 'all');
  const aliases = {
    countersign: 'all',
    counterSign: 'all',
    and: 'all',
    all: 'all',
    or: 'or',
    any: 'or',
    one: 'or',
    oneByOne: 'oneByOne',
    serial: 'oneByOne',
    sequence: 'oneByOne',
  };
  return aliases[mode] || mode;
}

function createBaseApproverRules(type, description, approver) {
  return {
    type: type,
    mode: approver.mode || 'ApprovalNode_rules_only',
    approverList: approver.approverList || [{ type: 'ext_target_approval' }],
    multiApproverType: normalizeApprovalMode(approver.multiApproverType || approver.approvalMode || 'all'),
    conditionalMode: approver.conditionalMode || 'conditional',
    description: description,
  };
}

function getFriendlyApproverKind(approver) {
  if (typeof approver === 'string') {
    const text = approver.trim();
    if (!text || text === 'originator' || text === 'self' || text === 'starter' || text === '发起人') {
      return 'originator';
    }
    return null;
  }
  if (!isPlainObject(approver)) {
    return null;
  }
  const rawKind = String(approver.kind || approver.approverType || approver.type || '').trim();
  if (!rawKind || rawKind.indexOf('ext_target_') === 0) {
    return null;
  }
  const normalized = rawKind.toLowerCase().replace(/[-_\s]/g, '');
  const kindMap = {
    originator: 'originator',
    self: 'originator',
    starter: 'originator',
    user: 'user',
    users: 'user',
    member: 'user',
    members: 'user',
    person: 'user',
    employee: 'user',
    designee: 'user',
    specifiedmember: 'user',
    role: 'role',
    roles: 'role',
    deptleader: 'deptLeader',
    departmentleader: 'deptLeader',
    departmenthead: 'deptLeader',
    supervisor: 'deptLeader',
    manager: 'deptLeader',
    directleader: 'directLeader',
    directsupervisor: 'directLeader',
  };
  return kindMap[normalized] || null;
}

function normalizeUserApprovers(approver) {
  const source = normalizeList(
    pickFirstDefined(
      approver.users,
      approver.members,
      approver.employees,
      approver.userIds,
      approver.ids,
      approver.approvals,
      approver.value
    )
  );
  return source.map(function (item) {
    const id = getEntityId(item);
    if (!id) {
      throw new Error('审批人 user 配置缺少 id/userId/value');
    }
    const user = {
      id: id,
      label: getEntityLabel(item, id),
      type: isPlainObject(item) ? (item.type || 'employee') : 'employee',
      roleType: isPlainObject(item) ? (item.roleType || 'DINGTALK') : 'DINGTALK',
    };
    if (isPlainObject(item) && item.avatar) {
      user.avatar = item.avatar;
    }
    return user;
  });
}

function normalizeRoleApprovers(approver) {
  const source = normalizeList(
    pickFirstDefined(
      approver.roles,
      approver.roleIds,
      approver.ids,
      approver.approvals,
      approver.value
    )
  );
  return source.map(function (item) {
    const id = getEntityId(item);
    if (!id) {
      throw new Error('审批人 role 配置缺少 id/uuid/roleId/value');
    }
    return {
      id: id,
      label: getEntityLabel(item, id),
      type: isPlainObject(item) ? (item.type || 'role') : 'role',
      roleType: isPlainObject(item)
        ? (item.roleType || approver.roleType || 'YIDA')
        : (approver.roleType || 'YIDA'),
    };
  });
}

function buildMultiRoles(roles) {
  const grouped = {};
  roles.forEach(function (role) {
    const roleType = role.roleType || 'YIDA';
    if (!grouped[roleType]) {
      grouped[roleType] = [];
    }
    grouped[roleType].push(role.id);
  });
  return Object.keys(grouped).map(function (roleType) {
    return {
      roleId: grouped[roleType],
      roleExtType: roleType,
    };
  });
}

function getApproverSource(approver, direct) {
  const value = pickFirstDefined(
    approver.source,
    approver.originator,
    approver.userIdVar,
    direct ? approver.directSupervisorSource : approver.supervisorSource,
    'originator'
  );
  const label = pickFirstDefined(
    approver.sourceLabel,
    approver.originatorLabel,
    value === 'originator' ? '发起人' : value
  );
  return {
    value: String(value),
    label: String(label),
  };
}

function formatLevelDescription(sourceLabel, level, direct) {
  return sourceLabel + '的第' + level + '级' + (direct ? '直属主管' : '主管');
}

function buildOriginatorApproverConfig(node, approver) {
  const raw = isPlainObject(approver) ? approver : {};
  return {
    approvalType: 'ext_target_approval_originator',
    approvals: [['originator']],
    processProps: raw.processProps || raw.props || {},
    approverRules: Object.assign(
      createBaseApproverRules('ext_target_approval_originator', raw.description || '发起人本人', raw),
      raw.approverRules || {}
    ),
    description: raw.nodeDescription || node.description || '请选择审批人',
    carbonReceiver: { type: 'VARIABLE', value: [['originator']] },
  };
}

function buildUserApproverConfig(node, approver) {
  const users = normalizeUserApprovers(approver);
  if (users.length === 0) {
    throw new Error('审批人 user 配置至少需要一个 users/userIds/approvals');
  }
  const userIds = users.map(function (user) { return user.id; });
  const description = approver.description || users.map(function (user) { return user.label; }).join(', ');
  const approvalMode = normalizeApprovalMode(approver.multiApproverType || approver.approvalMode || 'all');
  const approverRules = Object.assign(
    createBaseApproverRules('ext_target_approval', description, approver),
    {
      approvals: users,
      approvalType_ext_target_approval: approvalMode,
    },
    approver.approverRules || {}
  );
  return {
    approvalType: 'ext_target_approval',
    approvals: userIds,
    processProps: Object.assign({ multiApprove: approvalMode }, approver.processProps || approver.props || {}),
    approverRules: approverRules,
    description: approver.nodeDescription || node.description || '请选择审批人',
    carbonReceiver: { type: 'NORMAL', value: userIds },
  };
}

function buildRoleApproverConfig(node, approver) {
  const roles = normalizeRoleApprovers(approver);
  if (roles.length === 0) {
    throw new Error('审批人 role 配置至少需要一个 roles/roleIds/approvals');
  }
  const roleIds = roles.map(function (role) { return role.id; });
  const description = approver.description || roles.map(function (role) { return role.label; }).join(', ');
  const approvalMode = normalizeApprovalMode(approver.multiApproverType || approver.approvalMode || 'all');
  const approverRules = Object.assign(
    createBaseApproverRules('ext_target_approval_role', description, approver),
    {
      roles: roles,
      approvalType_ext_target_approval_role: approvalMode,
    },
    approver.approverRules || {}
  );
  return {
    approvalType: 'ext_target_approval_role',
    processProps: Object.assign({
      multiRoles: buildMultiRoles(roles),
      multiApprove: approvalMode,
    }, approver.processProps || approver.props || {}),
    approverRules: approverRules,
    description: approver.nodeDescription || node.description || '请选择审批人',
    carbonReceiver: { type: 'ROLE', value: roleIds },
  };
}

function buildDeptLeaderApproverConfig(node, approver) {
  const source = getApproverSource(approver, false);
  const level = String(pickFirstDefined(approver.level, approver.supervisorLevel, 1));
  const approvalMode = normalizeApprovalMode(approver.multiApproverType || approver.approvalMode || 'all');
  const needLeaderReplace = pickFirstDefined(approver.needLeaderReplace, true);
  const ignoreNoLeaderDept = pickFirstDefined(approver.ignoreNoLeaderDept, false);
  const description = approver.description || formatLevelDescription(source.label, level, false);
  const approverRules = Object.assign(
    createBaseApproverRules('ext_target_dept_leader', description, approver),
    {
      approvalType_ext_target_dept_leader: approvalMode,
      supervisorType: source,
      supervisorLevel: level,
      ignoreNoLeaderDept: String(ignoreNoLeaderDept),
      needLeaderReplace: Boolean(needLeaderReplace),
    },
    approver.approverRules || {}
  );
  return {
    approvalType: 'ext_target_dept_leader',
    processProps: Object.assign({
      key: 'DeptLeaderApproverRule_1.0.0',
      userIdVar: source.value,
      reportLevel: Number(level),
      ignoreNoLeaderDept: String(ignoreNoLeaderDept),
      needLeaderReplace: String(Boolean(needLeaderReplace)),
      multiApprove: approvalMode,
    }, approver.processProps || approver.props || {}),
    approverRules: approverRules,
    description: approver.nodeDescription || node.description || '请选择审批人',
    carbonReceiver: {
      type: 'MANAGER',
      value: {
        originator: source.value,
        level: Number(level),
      },
    },
  };
}

function buildDirectLeaderApproverConfig(node, approver) {
  const source = getApproverSource(approver, true);
  const level = String(pickFirstDefined(approver.level, approver.directSupervisorLevel, 1));
  const approvalMode = normalizeApprovalMode(approver.multiApproverType || approver.approvalMode || 'all');
  const needDeptLeaderReplace = pickFirstDefined(approver.needDeptLeaderReplace, true);
  const description = approver.description || formatLevelDescription(source.label, level, true);
  const approverRules = Object.assign(
    createBaseApproverRules('ext_target_direct_leader', description, approver),
    {
      approvalType_ext_target_direct_leader: approvalMode,
      directSupervisorType: source,
      directSupervisorLevel: level,
      needDeptLeaderReplace: Boolean(needDeptLeaderReplace),
    },
    approver.approverRules || {}
  );
  return {
    approvalType: 'ext_target_direct_leader',
    processProps: Object.assign({
      key: 'DirectLeaderApproverRule_1.0.0',
      userIdVar: source.value,
      reportLevel: Number(level),
      needDeptLeaderReplace: String(Boolean(needDeptLeaderReplace)),
      multiApprove: approvalMode,
    }, approver.processProps || approver.props || {}),
    approverRules: approverRules,
    description: approver.nodeDescription || node.description || '请选择审批人',
  };
}

function buildFriendlyApproverConfig(node, approver) {
  const kind = getFriendlyApproverKind(approver);
  if (!kind) {
    return null;
  }
  const raw = isPlainObject(approver) ? approver : {};
  if (kind === 'originator') {
    return buildOriginatorApproverConfig(node, raw);
  }
  if (kind === 'user') {
    return buildUserApproverConfig(node, raw);
  }
  if (kind === 'role') {
    return buildRoleApproverConfig(node, raw);
  }
  if (kind === 'deptLeader') {
    return buildDeptLeaderApproverConfig(node, raw);
  }
  if (kind === 'directLeader') {
    return buildDirectLeaderApproverConfig(node, raw);
  }
  return null;
}

// ── 构建审批/抄送动作列表 ────────────────────────────

function buildActions() {
  const actionDefs = [
    { action: 'agree', zh: '同意', en: 'Agree', ja: '同意', hidden: false },
    { action: 'disagree', zh: '拒绝', en: 'Disagree', ja: '拒否', hidden: false },
    { action: 'save', zh: '保存', en: 'Save', ja: '保存', hidden: true },
    { action: 'forward', zh: '转交', en: 'Forward', ja: '転送', hidden: true },
    { action: 'append', zh: '加签', en: 'Append', ja: '承認者を追加', hidden: true },
    { action: 'return', zh: '退回', en: 'Return', ja: '差し戻し', hidden: true },
  ];

  return actionDefs.map(function (def) {
    return {
      hidden: def.hidden,
      name: i18n(def.zh, def.en, def.ja),
      action: def.action,
      text: i18n(def.zh, def.en, def.ja),
      alias: i18n(def.zh, def.en, def.ja),
    };
  });
}

// ── 构建条件规则（严格匹配宜搭真实格式）─────────────

function buildConditionRules(rules, logic) {
  const conditionCode = logic === 'OR' ? '||' : '&&';
  const groupId = 'group-' + generateUuid();

  const builtRules = rules.map(function (rule) {
    const opDisplay = OP_CODE_TO_DISPLAY[rule.op] || rule.op;
    const ruleType = COMPONENT_TO_RULE_TYPE[rule.componentType] || 'rule_text';

    const ruleObj = {
      id: rule.fieldId,
      op: opDisplay,
      operators: [],
      value: rule.value,
      componentType: rule.componentType || 'TextField',
      ruleId: 'item-' + generateUuid(),
      parentId: groupId,
      extValue: 'value',
      ruleValue: rule.value,
      name: rule.fieldName || rule.fieldId,
      valueType: 'literal',
      ruleType: ruleType,
      opCode: rule.op,
    };

    // NumberField 需要 formula 字段，宜搭服务端用它构建数字比较公式
    if (rule.componentType === 'NumberField') {
      const opSymbolMap = {
        GreaterThan: '>',
        Bigger: '>',
        GreaterThanOrEqual: '>=',
        LessThan: '<',
        LessThanOrEqual: '<=',
        Equal: '==',
        NotEqual: '!=',
      };
      const opSymbol = opSymbolMap[rule.op] || '==';
      ruleObj.formula = '${' + rule.fieldId + '}' + opSymbol + rule.value;
    }

    return ruleObj;
  });

  return {
    condition: logic === 'OR' ? 'OR' : 'AND',
    rules: builtRules,
    ruleId: groupId,
    conditionCode: conditionCode,
  };
}

// ── 构建跳转规则（routeRule）──────────────────────────

function buildRouteRule(routeRuleDefs, currentNodeId, nodeNameToIdMap) {
  if (!routeRuleDefs || routeRuleDefs.length === 0) {
    return {
      rules: [],
      triggerRule: 'n',
      ruleIfMiss: 'terminate',
      defaultNextId: [],
    };
  }

  const rules = routeRuleDefs.map(function (ruleDef, index) {
    // 解析跳转目标
    const targetNodeId = nodeNameToIdMap[ruleDef.jumpTo];
    if (!targetNodeId) {
      throw new ProcessCompilerError(
        'PROCESS_COMPILE_ROUTE_TARGET_INVALID',
        'routeRule 跳转目标 "' + ruleDef.jumpTo + '" 未找到唯一对应节点',
        { jumpTo: ruleDef.jumpTo, currentNodeId: currentNodeId }
      );
    }

    // 构建条件规则
    const conditionGroupId = 'group-' + generateUuid();
    const conditionRules = [];

    if (ruleDef.when === 'disagree' || ruleDef.when === 'agree') {
      // 基于审批结果的跳转（内置虚拟字段 approvalResult）
      conditionRules.push({
        componentType: 'SelectField',
        id: 'approvalResult',
        extValue: 'value',
        name: '审批结果',
        op: '等于',
        opCode: 'Equal',
        parentId: conditionGroupId,
        ruleId: 'item-' + generateUuid(),
        ruleType: 'rule_text',
        ruleValue: ruleDef.when,
        value: ruleDef.when,
        valueType: 'literal',
      });
    } else if (ruleDef.fieldRules && ruleDef.fieldRules.length > 0) {
      // 基于表单字段的跳转条件
      ruleDef.fieldRules.forEach(function (fieldRule) {
        const opDisplay = OP_CODE_TO_DISPLAY[fieldRule.op] || fieldRule.op;
        const ruleType = COMPONENT_TO_RULE_TYPE[fieldRule.componentType] || 'rule_text';
        conditionRules.push({
          componentType: fieldRule.componentType,
          id: fieldRule.fieldId,
          extValue: 'value',
          name: fieldRule.fieldName,
          op: opDisplay,
          opCode: fieldRule.op,
          parentId: conditionGroupId,
          ruleId: 'item-' + generateUuid(),
          ruleType: ruleType,
          ruleValue: fieldRule.value,
          value: fieldRule.value,
          valueType: 'literal',
        });
      });
    }

    const conditionNodeId = generateNodeId();
    return {
      type: 'condition',
      nodeId: conditionNodeId,
      prevId: currentNodeId,
      nextId: [targetNodeId],
      props: {
        calculate: 'condition',
        isDefault: false,
        conditions: {
          condition: (ruleDef.logic || 'AND'),
          conditionCode: (ruleDef.logic === 'OR' ? '||' : '&&'),
          ruleId: conditionGroupId,
          rules: conditionRules,
        },
        priority: index + 1,
      },
    };
  });

  return {
    rules: rules,
    triggerRule: rules.length > 0 ? 'y' : 'n',
    ruleIfMiss: 'terminate',
    defaultNextId: [],
  };
}

// ── 递归分配 nodeId ──────────────────────────────────

function componentNameForNodeType(nodeType) {
  if (nodeType === 'approval') {return 'ApprovalNode';}
  if (nodeType === 'operator') {return 'OperatorNode';}
  if (nodeType === 'multiApproval') {return 'MultiApprovalNode';}
  if (nodeType === 'carbon') {return 'CarbonNode';}
  if (nodeType === 'route' || nodeType === 'parallel') {return 'ConditionContainer';}
  return GENERIC_NODE_CONFIGS[nodeType] ? nodeType : null;
}

function validateManagedNodeBindings(desiredNodes, nodeBindings) {
  if (
    !Array.isArray(desiredNodes) ||
    !nodeBindings ||
    typeof nodeBindings !== 'object' ||
    Array.isArray(nodeBindings)
  ) {
    return false;
  }

  const expected = Object.create(null);
  for (const node of desiredNodes) {
    const key = node && typeof node.key === 'string' ? node.key : '';
    const componentName = componentNameForNodeType(node && node.type);
    if (!key || !componentName || Object.prototype.hasOwnProperty.call(expected, key)) {
      return false;
    }
    expected[key] = componentName;
  }

  const expectedKeys = Object.keys(expected).sort();
  const bindingKeys = Object.keys(nodeBindings).sort();
  if (
    expectedKeys.length === 0 ||
    expectedKeys.length !== bindingKeys.length ||
    expectedKeys.some((key, index) => key !== bindingKeys[index])
  ) {
    return false;
  }

  const usedNodeIds = new Set();
  for (const key of expectedKeys) {
    const binding = nodeBindings[key];
    if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
      return false;
    }
    const properties = Object.keys(binding).sort();
    if (
      properties.length !== 2 ||
      properties[0] !== 'componentName' ||
      properties[1] !== 'nodeId' ||
      typeof binding.nodeId !== 'string' ||
      binding.nodeId.trim() === '' ||
      binding.componentName !== expected[key] ||
      usedNodeIds.has(binding.nodeId)
    ) {
      return false;
    }
    usedNodeIds.add(binding.nodeId);
  }
  return true;
}

function resolveExistingNodeId(existingBindings, semanticKey) {
  if (!existingBindings || !Object.prototype.hasOwnProperty.call(existingBindings, semanticKey)) {
    return null;
  }
  const binding = existingBindings[semanticKey];
  if (typeof binding === 'string' && binding) {
    return binding;
  }
  if (binding && typeof binding.nodeId === 'string' && binding.nodeId) {
    return binding.nodeId;
  }
  return null;
}

function assignNodeId(node, nodeType, nodeNameToIdMap) {
  const options = nodeNameToIdMap.__compilerOptions || {};
  if (!options.semanticBindings) {
    return generateNodeId();
  }

  const semanticKey = typeof node.key === 'string' ? node.key.trim() : '';
  if (!semanticKey) {
    throw new ProcessCompilerError(
      'PROCESS_COMPILE_NODE_KEY_REQUIRED',
      'Managed process nodes require an explicit semantic key.'
    );
  }
  if (!KEY_PATTERN.test(semanticKey) || semanticKey.includes('.')) {
    throw new ProcessCompilerError(
      'PROCESS_COMPILE_DEFINITION_INVALID',
      'Managed process node semantic key is invalid.',
      { semanticPath: 'nodes' }
    );
  }
  if (nodeNameToIdMap.__semanticKeys.has(semanticKey)) {
    throw new ProcessCompilerError(
      'PROCESS_COMPILE_NODE_KEY_DUPLICATE',
      'Managed process node semantic keys must be unique.',
      { key: semanticKey }
    );
  }
  nodeNameToIdMap.__semanticKeys.add(semanticKey);

  const existingNodeId = resolveExistingNodeId(options.existingBindings, semanticKey);
  let nodeId = existingNodeId;
  if (nodeId && nodeNameToIdMap.__usedNodeIds.has(nodeId)) {
    throw new ProcessCompilerError(
      'PROCESS_COMPILE_NODE_BINDING_CONFLICT',
      'Managed process node bindings contain a duplicate node identity.',
      { semanticPath: 'nodes.' + semanticKey }
    );
  }
  if (!nodeId) {
    do {
      nodeId = generateNodeId();
    } while (nodeNameToIdMap.__usedNodeIds.has(nodeId));
  }
  nodeNameToIdMap.__usedNodeIds.add(nodeId);
  nodeNameToIdMap.__nodeBindings[semanticKey] = {
    nodeId,
    componentName: componentNameForNodeType(nodeType),
  };
  return nodeId;
}

function registerNodeName(node, nodeId, nameToIdMap, mapAsRouteTarget) {
  const nodeName = getNodeName(node, '').trim();
  if (!nodeName) {
    return;
  }
  if (nameToIdMap.__nodeNames.has(nodeName)) {
    throw new ProcessCompilerError(
      'PROCESS_COMPILE_NODE_NAME_DUPLICATE',
      '流程节点名称必须唯一: ' + nodeName,
      { nodeName: nodeName }
    );
  }
  nameToIdMap.__nodeNames.add(nodeName);
  if (mapAsRouteTarget) {
    nameToIdMap[nodeName] = nodeId;
  }
}

function assignNodeIdsRecursive(nodes, nameToIdMap) {
  nodes.forEach(function (node) {
    const nodeType = normalizeNodeType(node);
    if (nodeType === 'route') {
      node._nodeId = assignNodeId(node, nodeType, nameToIdMap);
      registerNodeName(node, node._nodeId, nameToIdMap, false);
      const conditions = node.conditions || [];
      conditions.forEach(function (cond) {
        cond._nodeId = generateNodeId();
        if (cond.childNodes && cond.childNodes.length > 0) {
          assignNodeIdsRecursive(cond.childNodes, nameToIdMap);
        }
      });
    } else if (nodeType === 'parallel') {
      node._nodeId = assignNodeId(node, nodeType, nameToIdMap);
      registerNodeName(node, node._nodeId, nameToIdMap, true);
      const branches = getParallelBranches(node);
      branches.forEach(function (branch) {
        branch._nodeId = generateNodeId();
        const childNodes = getBranchChildNodes(branch);
        if (childNodes.length > 0) {
          assignNodeIdsRecursive(childNodes, nameToIdMap);
        }
      });
    } else if (GENERIC_NODE_CONFIGS[nodeType]) {
      node._nodeId = assignNodeId(node, nodeType, nameToIdMap);
      registerNodeName(node, node._nodeId, nameToIdMap, true);
      const childNodes = getGenericChildNodes(node);
      if (childNodes.length > 0) {
        assignNodeIdsRecursive(childNodes, nameToIdMap);
      }
    } else {
      node._nodeId = assignNodeId(node, nodeType, nameToIdMap);
      registerNodeName(node, node._nodeId, nameToIdMap, true);
    }
  });
}

// ── 递归构建节点 ─────────────────────────────────────

function buildNodeListRecursive(nodes, exitNodeId, nameToIdMap) {
  const processNodes = [];
  const viewNodes = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const nextNodeId = i + 1 < nodes.length ? nodes[i + 1]._nodeId : exitNodeId;
    const nodeType = normalizeNodeType(node);

    if (nodeType === 'route') {
      const routeResult = buildRouteNode(node, nextNodeId, nameToIdMap);
      processNodes.push(routeResult.processNode);
      viewNodes.push(routeResult.viewNode);
    } else if (nodeType === 'parallel') {
      const parallelResult = buildParallelNode(node, nextNodeId, nameToIdMap);
      processNodes.push(parallelResult.processNode);
      viewNodes.push(parallelResult.viewNode);
    } else if (nodeType === 'approval' || nodeType === 'operator' || nodeType === 'multiApproval') {
      const approvalResult = buildApprovalNode(node, nextNodeId, nameToIdMap, nodeType);
      processNodes.push(approvalResult.processNode);
      viewNodes.push(approvalResult.viewNode);
    } else if (nodeType === 'carbon') {
      const carbonResult = buildCarbonNode(node, nextNodeId);
      processNodes.push(carbonResult.processNode);
      viewNodes.push(carbonResult.viewNode);
    } else if (GENERIC_NODE_CONFIGS[nodeType]) {
      const genericResult = buildGenericNode(node, nextNodeId, nameToIdMap, nodeType);
      processNodes.push(genericResult.processNode);
      viewNodes.push(genericResult.viewNode);
    } else {
      throw new Error('不支持的流程节点类型: ' + (node.type || node.componentName || node.kind || JSON.stringify(node)));
    }
  }

  return { processNodes, viewNodes };
}

function wireChildProcessNodes(childProcessNodes, parentNodeId) {
  if (childProcessNodes.length === 0) {
    return;
  }
  childProcessNodes[0].prevId = parentNodeId;
  for (let i = 1; i < childProcessNodes.length; i++) {
    childProcessNodes[i].prevId = childProcessNodes[i - 1].nodeId;
  }
}

// ── 构建审批节点 ─────────────────────────────────────

function buildApproverConfig(node) {
  const nodeType = normalizeNodeType(node);
  let approverInput;
  if (nodeType === 'operator') {
    approverInput = pickFirstDefined(node.approverConfig, node.executor, node.operator, node.approver);
  } else if (nodeType === 'carbon') {
    approverInput = pickFirstDefined(node.approverConfig, node.receiver, node.receivers, node.approver);
  } else {
    approverInput = pickFirstDefined(node.approverConfig, node.approver);
  }
  if (
    (nodeType === 'approval' || nodeType === 'multiApproval' || nodeType === 'operator' || nodeType === 'carbon')
    && (
      approverInput === undefined
      || (Array.isArray(approverInput) && approverInput.length === 0)
      || (isPlainObject(approverInput) && Object.keys(approverInput).length === 0)
    )
  ) {
    throw new ProcessCompilerError(
      'PROCESS_COMPILE_APPROVER_REQUIRED',
      '流程节点缺少必填的人员配置: ' + getNodeName(node, nodeType),
      { nodeType: nodeType, nodeName: getNodeName(node, nodeType) }
    );
  }
  const friendlyApprover = buildFriendlyApproverConfig(node, approverInput);
  if (friendlyApprover) {
    return friendlyApprover;
  }

  const rawApprover = node.approverConfig || (approverInput && typeof approverInput === 'object' ? approverInput : null);
  if (rawApprover) {
    return {
      approvalType: rawApprover.approvalType || rawApprover.type || 'ext_target_approval_originator',
      approvals: rawApprover.approvals || [['originator']],
      processProps: rawApprover.processProps || rawApprover.props || {},
      approverRules: rawApprover.approverRules || {
        type: rawApprover.approvalType || rawApprover.type || 'ext_target_approval_originator',
        mode: 'ApprovalNode_rules_only',
        approverList: rawApprover.approverList || [{ type: 'ext_target_approval' }],
        multiApproverType: rawApprover.multiApproverType || 'all',
        conditionalMode: rawApprover.conditionalMode || 'conditional',
        description: rawApprover.description || '自定义审批人',
      },
      description: rawApprover.description || node.description || '请选择审批人',
      carbonReceiver: rawApprover.carbonReceiver,
    };
  }

  if (node.approvalType || node.approvals || node.approverRules || node.processProps) {
    return {
      approvalType: node.approvalType || 'ext_target_approval_originator',
      approvals: node.approvals || [['originator']],
      processProps: node.processProps || {},
      approverRules: node.approverRules || {
        type: node.approvalType || 'ext_target_approval_originator',
        mode: 'ApprovalNode_rules_only',
        approverList: [{ type: 'ext_target_approval' }],
        multiApproverType: 'all',
        conditionalMode: 'conditional',
        description: node.description || '自定义审批人',
      },
      description: node.description || '请选择审批人',
      carbonReceiver: node.carbonReceiver,
    };
  }

  return buildOriginatorApproverConfig(node, {});
}

function buildApprovalNode(node, nextNodeId, nameToIdMap, nodeType) {
  const nodeId = node._nodeId;
  const routeRule = buildRouteRule(node.routeRules || [], nodeId, nameToIdMap);
  const approverConfig = buildApproverConfig(node);
  const approvalNodeType = nodeType || normalizeNodeType(node);
  const componentName = approvalNodeType === 'operator'
    ? 'OperatorNode'
    : (approvalNodeType === 'multiApproval' ? 'MultiApprovalNode' : 'ApprovalNode');
  const titleText = approvalNodeType === 'operator'
    ? ['办理人', 'Executor', '実行者']
    : (approvalNodeType === 'multiApproval'
      ? ['审批人', 'Approver', '承認者']
      : ['审批人', 'Approver', '承認者']);
  const defaultName = approvalNodeType === 'operator' ? '办理人' : '审批人';
  const displayName = getNodeName(node, defaultName);
  const nodeDescription = approverConfig.description || getNodeDescription(node) || '请选择审批人';

  // 构建字段权限（formConfig.behaviorList）
  // 兼容两种输入格式：
  //   1. node.formConfig.behaviorList（推荐，与 SKILL.md 文档一致）
  //   2. node.fieldPermissions（旧格式，向后兼容）
  let formConfig = undefined;
  if (node.formConfig && node.formConfig.behaviorList && node.formConfig.behaviorList.length > 0) {
    const behaviorList = node.formConfig.behaviorList.map(function (fp) {
      return {
        fieldId: fp.fieldId,
        fieldBehavior: fp.fieldBehavior || fp.behavior || 'READONLY',
      };
    });
    formConfig = { behaviorList: behaviorList };
  } else if (node.fieldPermissions && node.fieldPermissions.length > 0) {
    const behaviorList = node.fieldPermissions.map(function (fp) {
      return {
        fieldId: fp.fieldId,
        fieldBehavior: fp.fieldBehavior || fp.behavior || 'READONLY',
      };
    });
    formConfig = { behaviorList: behaviorList };
  }

  const processNodeProps = {
    conditionalMode: 'conditional',
    actions: buildActions(),
    appendActions: buildActions(),
    openDigitalSign: false,
    noActionersType: 'stopProcess',
    routeRule: routeRule,
  };
  if (approverConfig.approvals !== undefined) {
    processNodeProps.approvals = approverConfig.approvals;
  }
  Object.assign(processNodeProps, approverConfig.processProps);
  let multiApproverRules;
  if (approvalNodeType === 'multiApproval') {
    const multiMode = node.approvalMode
      || node.mode
      || node.multiApprove
      || processNodeProps.multiApprove
      || (approverConfig.approverRules && approverConfig.approverRules.multiApproverType)
      || 'all';
    if (!['all', 'or', 'oneByOne'].includes(multiMode)) {
      throw new ProcessCompilerError(
        'PROCESS_COMPILE_MULTI_APPROVAL_MODE_INVALID',
        t('process_errors.multi_approval_mode_invalid', multiMode),
        { nodeName: displayName, mode: multiMode }
      );
    }
    const multiRules = Array.isArray(node.multiRules)
      ? clonePlain(node.multiRules)
      : [{ status: '0', rules: [] }];
    processNodeProps.mode = 'multi';
    processNodeProps.multiApprove = multiMode;
    processNodeProps.multiRules = multiRules;
    multiApproverRules = {
      approvalType_multi: multiMode,
      multiRules: clonePlain(multiRules),
    };
  }
  if (formConfig) {
    processNodeProps.formConfig = formConfig;
  }

  const processNode = {
    name: i18n(displayName, titleText[1], displayName),
    description: nodeDescription,
    type: 'approval',
    approvalType: approverConfig.approvalType,
    nodeId: nodeId,
    prevId: '',
    nextId: [nextNodeId],
    props: processNodeProps,
    childNodes: [],
  };

  const viewNodeProps = {
    nodeName: componentName,
    name: i18n(displayName, titleText[1], displayName),
    description: nodeDescription,
    actions: {
      normalActions: buildActions(),
      appendActions: buildActions(),
    },
    routeRule: routeRule,
  };
  if (multiApproverRules) {
    viewNodeProps.multiApproverRules = multiApproverRules;
  } else {
    viewNodeProps.approverRules = approverConfig.approverRules;
  }
  if (formConfig) {
    viewNodeProps.formConfig = formConfig;
  }

  const viewNode = {
    componentName: componentName,
    id: nodeId,
    props: viewNodeProps,
    title: i18n(titleText[0], titleText[1], titleText[2]),
  };

  return { processNode, viewNode };
}

// ── 构建抄送节点 ─────────────────────────────────────

function buildCarbonNode(node, nextNodeId) {
  const nodeId = node._nodeId;
  const approverConfig = buildApproverConfig(node);
  const carbonReceiver = approverConfig.carbonReceiver || { type: 'VARIABLE', value: approverConfig.approvals || [['originator']] };
  const displayName = getNodeName(node, '抄送人');
  const nodeDescription = getNodeDescription(node) || '请选择抄送人';

  const processNode = {
    name: i18n(displayName, 'CC', displayName),
    description: '',
    type: 'carbon',
    approvalType: approverConfig.approvalType,
    nodeId: nodeId,
    prevId: '',
    nextId: [nextNodeId],
    props: {
      conditionalMode: 'conditional',
      params: [
        { key: 'nodeId', value: nodeId },
        { key: 'instId', value: '#procInstId' },
        { key: 'userId', value: '#originator' },
        { key: 'receiver', value: carbonReceiver },
      ],
      ...approverConfig.processProps,
    },
    childNodes: [],
  };

  const viewNode = {
    componentName: 'CarbonNode',
    id: nodeId,
    props: {
      nodeName: 'CarbonNode',
      name: i18n(displayName, 'CC', displayName),
      description: nodeDescription,
      approverRules: approverConfig.approverRules,
    },
    title: i18n('抄送人', 'CC', '共有先'),
  };

  return { processNode, viewNode };
}

// ── 构建真实组件节点（连接器、数据、消息、代码、子流程等）──

function getGenericChildNodes(node) {
  const childNodes = node.childNodes || node.children || node.nodes || [];
  return Array.isArray(childNodes) ? childNodes : [];
}

function buildGenericNodeProps(node, componentName) {
  const config = GENERIC_NODE_CONFIGS[componentName] || {};
  const props = Object.assign({}, node.props || {});
  const displayName = getNodeName(node, config.title ? config.title[0] : componentName);
  const description = getNodeDescription(node);

  if (!props.name) {
    props.name = i18n(displayName, config.title ? config.title[1] : displayName, displayName);
  }
  if (!props.nodeName) {
    props.nodeName = componentName;
  }
  if (!props.description && description) {
    props.description = description;
  }

  Object.keys(config.propAliases || {}).forEach(function (sourceKey) {
    const targetKey = config.propAliases[sourceKey];
    if (node[sourceKey] !== undefined && props[targetKey] === undefined) {
      props[targetKey] = clonePlain(node[sourceKey]);
    }
  });

  (config.propKeys || []).forEach(function (key) {
    if (node[key] !== undefined && props[key] === undefined) {
      props[key] = clonePlain(node[key]);
    }
  });

  if (node.viewProps && isPlainObject(node.viewProps)) {
    Object.assign(props, clonePlain(node.viewProps));
  }

  return props;
}

function getGenericProcessType(componentName, node, props) {
  if (node.processType || node.processNodeType) {
    return node.processType || node.processNodeType;
  }

  if (componentName === 'ConnectorNode') {
    const connectorRules = props.connectorRules || {};
    const connector = connectorRules.connector || {};
    const mode = connector.mode || connectorRules.mode;
    return CONNECTOR_MODE_TO_PROCESS_TYPE[mode] || GENERIC_NODE_CONFIGS[componentName].processType;
  }

  return GENERIC_NODE_CONFIGS[componentName].processType;
}

function pickRuleAssignments(ruleContainer) {
  if (!ruleContainer) {
    return [];
  }
  if (Array.isArray(ruleContainer.assignments)) {
    return clonePlain(ruleContainer.assignments);
  }
  if (ruleContainer.inputs && Array.isArray(ruleContainer.inputs.assignments)) {
    return clonePlain(ruleContainer.inputs.assignments);
  }
  if (Array.isArray(ruleContainer.rules)) {
    return ruleContainer.rules
      .map(function (rule) {
        if (Array.isArray(rule && rule.rules)) {
          return clonePlain(rule.rules);
        }
        return null;
      })
      .filter(Boolean)
      .reduce(function (all, rules) {
        return all.concat(rules);
      }, []);
  }
  return [];
}

function buildConnectorProcessProps(props) {
  const connectorRules = props.connectorRules || {};
  const inputs = Object.assign({}, clonePlain(connectorRules.inputs || {}), {
    url: connectorRules.url,
    method: connectorRules.method,
    body: connectorRules.body,
    connection: connectorRules.connectionId || connectorRules.connection,
    connectorId: connectorRules.connectorId,
    actionId: connectorRules.actionId,
  });
  const assignments = pickRuleAssignments(connectorRules);

  if (assignments.length > 0) {
    inputs.assignments = assignments;
  }
  if (connectorRules.openDevSchemaType === 'integrationObject') {
    inputs.openDevSchemaType = 'integrationObject';
    inputs.connectorOrgId = connectorRules.connector && connectorRules.connector.orgId;
    inputs.integrationObject = connectorRules.integrationObject;
    inputs.integrationObjectPath = connectorRules.integrationObjectPath;
  }

  Object.keys(inputs).forEach(function (key) {
    if (inputs[key] === undefined) {
      delete inputs[key];
    }
  });

  return { inputs };
}

function buildCodeExecutorProcessProps(props, componentName) {
  const codeConfig = componentName === 'GroovyNode' ? props.groovy : props.JavaScript;
  if (!codeConfig) {
    return {};
  }
  const outputs = Array.isArray(codeConfig.outputs)
    ? codeConfig.outputs.map(function (output) {
      return {
        description: output.desc || output.description,
        name: output.name,
        type: output.type,
        valueType: output.valueType,
      };
    })
    : undefined;
  return {
    inputs: clonePlain(codeConfig.inputs),
    action: clonePlain(codeConfig.action),
    scriptType: codeConfig.scriptType,
    outputsSchema: outputs,
  };
}

function buildGetDataProcessProps(props) {
  const getData = props.getData || {};
  return {
    type: props.type,
    filterType: getData.filterType,
    sort: clonePlain(getData.sort),
    sourceId: getData.sourceId,
    appType: getData.appType,
    originalType: getData.originalType,
    subSourceId: getData.subSourceId,
    condition: clonePlain(getData.condition),
    quantity: getData.quantity === undefined ? undefined : String(getData.quantity),
    dataRules: clonePlain(getData.dataRules),
    assignments: clonePlain(getData.assignments),
  };
}

function buildAddDataProcessProps(props) {
  const addDataRules = props.addDataRules || {};
  return {
    formUuid: addDataRules.formUuid || '',
    appType: addDataRules.appType || '',
    subFormUuid: addDataRules.subFormUuid || '',
    insertType: addDataRules.insertType || '',
    type: addDataRules.type || '',
    sourceId: addDataRules.sourceId || '',
    assignments: pickRuleAssignments(addDataRules),
  };
}

function buildAIProcessProps(props) {
  const workFlowRules = props.workFlowRules || {};
  return {
    type: 'aiFlow',
    action: workFlowRules.flowId ? { flowId: workFlowRules.flowId } : undefined,
    outputs: clonePlain(workFlowRules.outputs),
    yidaFieldIdList: clonePlain(workFlowRules.yidaFieldIdList),
  };
}

function pruneUndefined(value) {
  if (!isPlainObject(value)) {
    return value;
  }
  Object.keys(value).forEach(function (key) {
    if (value[key] === undefined) {
      delete value[key];
    }
  });
  return value;
}

function buildGenericProcessProps(props, node, componentName) {
  let processProps;

  if (componentName === 'ConnectorNode') {
    processProps = buildConnectorProcessProps(props);
  } else if (componentName === 'GroovyNode' || componentName === 'JavaScriptNode') {
    processProps = buildCodeExecutorProcessProps(props, componentName);
  } else if (componentName === 'InitiateApprovalNode') {
    processProps = clonePlain(props.initiateApprovalRules || {});
  } else if (componentName === 'SendMessageNode') {
    processProps = clonePlain(props.sendMessageRules || {});
    delete processProps.description;
  } else if (componentName === 'SendEmailNode') {
    processProps = clonePlain(props.sendEmailRules || {});
  } else if (componentName === 'GetSingleDataNode' || componentName === 'GetBatchDataNode') {
    processProps = buildGetDataProcessProps(props);
  } else if (componentName === 'AddDataNode') {
    processProps = buildAddDataProcessProps(props);
  } else if (componentName === 'UpdateDataNode') {
    processProps = clonePlain(props.updateDataRules || {});
  } else if (componentName === 'DeleteDataNode') {
    processProps = clonePlain(props.deleteData || {});
  } else if (componentName === 'SendCardNode') {
    processProps = clonePlain(props.sendCardRules || {});
  } else if (componentName === 'UpdateCardNode') {
    processProps = clonePlain(props.updateCardRules || {});
  } else if (componentName === 'CardNode') {
    processProps = clonePlain(props.cardRules || {});
  } else if (componentName === 'CardUpdateNode') {
    processProps = clonePlain(props.cardUpdateRules || {});
  } else if (componentName === 'CycleContainer') {
    processProps = clonePlain(props.cycleContainerRules || {});
  } else if (componentName === 'AINode') {
    processProps = buildAIProcessProps(props);
  } else {
    processProps = clonePlain(props);
  }

  delete processProps.name;
  delete processProps.nodeName;
  delete processProps.description;
  delete processProps.title;
  pruneUndefined(processProps);
  if (node.processProps && isPlainObject(node.processProps)) {
    Object.assign(processProps, clonePlain(node.processProps));
  }
  return processProps;
}

function buildGenericNode(node, nextNodeId, nameToIdMap, componentName) {
  const nodeId = node._nodeId;
  const config = GENERIC_NODE_CONFIGS[componentName];
  const props = buildGenericNodeProps(node, componentName);
  const displayName = getNodeName(node, config.title[0]);
  const description = getNodeDescription(node);
  const childNodes = getGenericChildNodes(node);
  let childProcessNodes = [];
  let childViewNodes = [];

  if (childNodes.length > 0) {
    const childResult = buildNodeListRecursive(childNodes, nextNodeId, nameToIdMap);
    childProcessNodes = childResult.processNodes;
    childViewNodes = childResult.viewNodes;
    wireChildProcessNodes(childProcessNodes, nodeId);
  }

  const processNode = {
    name: i18n(displayName, config.title[1], displayName),
    description: description,
    type: getGenericProcessType(componentName, node, props),
    nodeId: nodeId,
    prevId: '',
    nextId: childProcessNodes.length > 0 ? [childProcessNodes[0].nodeId] : [nextNodeId],
    props: buildGenericProcessProps(props, node, componentName),
    childNodes: childProcessNodes.map(clonePlain),
  };

  if (node.approvalType) {
    processNode.approvalType = node.approvalType;
  }

  const viewNode = {
    componentName: componentName,
    id: nodeId,
    props: props,
    title: i18n(config.title[0], config.title[1], config.title[2]),
  };

  if (childViewNodes.length > 0) {
    viewNode.children = childViewNodes;
  }

  return { processNode, viewNode };
}

// ── 构建条件分支路由节点 ─────────────────────────────

function buildRouteNode(node, exitNodeId, nameToIdMap) {
  const routeNodeId = node._nodeId;
  const conditions = node.conditions || [];

  const conditionNodeIds = [];
  const conditionProcessNodes = [];
  const conditionViewNodes = [];

  // 构建每个条件分支
  conditions.forEach(function (cond, index) {
    const condNodeId = cond._nodeId;
    conditionNodeIds.push(condNodeId);

    // 递归构建条件分支内的子节点
    let childProcessNodes = [];
    let childViewNodes = [];
    if (cond.childNodes && cond.childNodes.length > 0) {
      const childResult = buildNodeListRecursive(cond.childNodes, exitNodeId, nameToIdMap);
      childProcessNodes = childResult.processNodes;
      childViewNodes = childResult.viewNodes;
      wireChildProcessNodes(childProcessNodes, condNodeId);
    }

    // 构建条件规则
    const conditionProps = {
      priority: index + 1,
      isDefault: false,
    };

    // 构建条件规则
    const condRules = buildConditionRules(cond.rules || [], cond.logic || 'AND');
    const condDescription = cond.name || '';

    if (cond.rules && cond.rules.length > 0) {
      conditionProps.conditions = {
        condition: condRules.condition || 'AND',
        rules: condRules.rules || [],
        ruleId: condRules.ruleId || 'group-' + generateUuid(),
        conditionCode: condRules.conditionCode || '&&',
      };
      conditionProps.calculate = 'condition';
    }

    // 条件节点的 nextId：如果有子节点，指向第一个子节点；否则指向出口节点
    const condNextId = (childProcessNodes.length > 0)
      ? [childProcessNodes[0].nodeId]
      : [exitNodeId];

    const condProcessNode = {
      name: i18n(condDescription || '条件', 'Condition', condDescription || '条件'),
      description: '',
      type: 'condition',
      nodeId: condNodeId,
      prevId: routeNodeId,
      nextId: condNextId,
      props: conditionProps,
      childNodes: childProcessNodes.map(clonePlain),
    };

    conditionProcessNodes.push(condProcessNode);

    // 构建 condition viewNode（带嵌套 conditions 包装）
    const condViewNode = {
      componentName: 'ConditionNode',
      id: condNodeId,
      props: {
        name: i18n(condDescription || '条件', 'Condition', condDescription || '条件'),
        description: '',
        conditions: {
          calculate: 'condition',
          conditions: {
            condition: condRules.condition || 'AND',
            rules: condRules.rules || [],
            ruleId: condRules.ruleId || 'group-' + generateUuid(),
            conditionCode: condRules.conditionCode || '&&',
          },
          isDefault: false,
          priority: index + 1,
          description: condDescription,
        },
      },
    };

    if (childViewNodes.length > 0) {
      condViewNode.children = childViewNodes;
    }

    conditionViewNodes.push(condViewNode);
  });

  // 添加默认条件分支（"其他情况"）
  const defaultCondNodeId = generateNodeId();
  conditionNodeIds.push(defaultCondNodeId);

  const defaultCondProcessNode = {
    name: i18n('其他情况', 'Other situations', 'その他の場合'),
    description: '',
    type: 'condition',
    nodeId: defaultCondNodeId,
    prevId: routeNodeId,
    nextId: [exitNodeId],
    props: {
      priority: 2147483647,
      isDefault: true,
    },
    childNodes: [],
  };

  conditionProcessNodes.push(defaultCondProcessNode);

  const defaultCondViewNode = {
    componentName: 'ConditionNode',
    id: defaultCondNodeId,
    props: {
      isDefault: true,
      buttons: [{ name: '关闭' }],
      name: i18n('其他情况', 'Other situations', 'その他の場合'),
      description: '',
    },
  };

  conditionViewNodes.push(defaultCondViewNode);

  // 构建 route processNode
  const routeProcessNode = {
    name: i18n('ConditionNode', 'ConditionNode', '条件ノード'),
    description: '',
    type: 'route',
    nodeId: routeNodeId,
    prevId: '',
    nextId: conditionNodeIds,
    props: { outgoingType: 'priority' },
    childNodes: conditionProcessNodes,
  };

  // 构建 route viewNode（ConditionContainer）
  const routeViewNode = {
    componentName: 'ConditionContainer',
    id: routeNodeId,
    props: {},
    title: '条件分支',
    children: conditionViewNodes,
  };

  return { processNode: routeProcessNode, viewNode: routeViewNode };
}

// ── 构建并行分支节点 ────────────────────────────────

function getParallelBranches(node) {
  const branches = node.branches || node.conditions || node.parallelBranches || [];
  return Array.isArray(branches) ? branches : [];
}

function getBranchChildNodes(branch) {
  const childNodes = branch.childNodes || branch.nodes || branch.children || [];
  return Array.isArray(childNodes) ? childNodes : [];
}

function buildAllDataConditionProps(branch, priority, isDefault) {
  return {
    calculate: 'all',
    conditions: {
      condition: 'AND',
      rules: [
        {
          id: 'originator',
          op: '等于',
          operators: [],
          componentType: 'EmployeeField',
        },
      ],
    },
    isDefault: isDefault,
    priority: priority,
    description: branch.description || '所有数据均可进入',
  };
}

function buildParallelBranchConditionProps(branch, index) {
  const priority = Number(pickFirstDefined(branch.priority, index + 1));
  const isDefault = Boolean(branch.isDefault);
  const rawConditions = branch.conditionProps
    || branch.condition
    || (isPlainObject(branch.conditions) ? branch.conditions : null);

  if (isPlainObject(rawConditions) && rawConditions.calculate) {
    const props = Object.assign({}, rawConditions, {
      isDefault: isDefault,
      priority: priority,
    });
    if (!props.description && branch.description) {
      props.description = branch.description;
    }
    return props;
  }

  if (isPlainObject(rawConditions) && (rawConditions.rules || rawConditions.condition)) {
    return {
      calculate: 'condition',
      conditions: rawConditions,
      isDefault: isDefault,
      priority: priority,
      description: branch.description || branch.name || '',
    };
  }

  if (branch.rules && branch.rules.length > 0) {
    const condRules = buildConditionRules(branch.rules, branch.logic || 'AND');
    return {
      calculate: 'condition',
      conditions: {
        condition: condRules.condition || 'AND',
        rules: condRules.rules || [],
        ruleId: condRules.ruleId || 'group-' + generateUuid(),
        conditionCode: condRules.conditionCode || '&&',
      },
      isDefault: isDefault,
      priority: priority,
      description: branch.description || branch.name || '',
    };
  }

  return buildAllDataConditionProps(branch, priority, isDefault);
}

function buildParallelBranchProcessProps(conditionProps) {
  const props = {};
  if (conditionProps.isDefault !== undefined) {
    props.isDefault = conditionProps.isDefault;
  }
  if (conditionProps.conditions !== undefined) {
    props.conditions = clonePlain(conditionProps.conditions);
  }
  if (conditionProps.calculate !== undefined) {
    props.calculate = conditionProps.calculate;
  }
  if (conditionProps.expression !== undefined) {
    props.expression = conditionProps.expression;
  }
  return props;
}

function buildParallelNode(node, exitNodeId, nameToIdMap) {
  const parallelNodeId = node._nodeId;
  const branches = getParallelBranches(node);

  if (branches.length === 0) {
    throw new Error('parallel 节点至少需要一个 branches 分支');
  }

  const branchNodeIds = [];
  const branchProcessNodes = [];
  const branchViewNodes = [];

  branches.forEach(function (branch, index) {
    const branchNodeId = branch._nodeId;
    const branchName = branch.name || ('条件' + (index + 1));
    const branchConditionProps = buildParallelBranchConditionProps(branch, index);
    const childNodes = getBranchChildNodes(branch);

    branchNodeIds.push(branchNodeId);

    let childProcessNodes = [];
    let childViewNodes = [];
    if (childNodes.length > 0) {
      const childResult = buildNodeListRecursive(childNodes, exitNodeId, nameToIdMap);
      childProcessNodes = childResult.processNodes;
      childViewNodes = childResult.viewNodes;
      wireChildProcessNodes(childProcessNodes, branchNodeId);
    }

    const branchNextId = childProcessNodes.length > 0
      ? [childProcessNodes[0].nodeId]
      : [exitNodeId];

    const branchProcessNode = {
      name: i18n(branchName, 'Parallel branch', branchName),
      description: '',
      type: 'condition',
      nodeId: branchNodeId,
      prevId: parallelNodeId,
      nextId: branchNextId,
      props: buildParallelBranchProcessProps(branchConditionProps),
      childNodes: childProcessNodes.map(clonePlain),
    };

    branchProcessNodes.push(branchProcessNode);

    const branchViewNode = {
      componentName: 'ParallelNode',
      id: branchNodeId,
      props: {
        name: branchConditionProps.isDefault
          ? i18n(branchName, 'Other situations', branchName)
          : branchName,
        description: branch.description || '',
        conditions: clonePlain(branchConditionProps),
      },
    };

    if (branchConditionProps.isDefault) {
      branchViewNode.props.buttons = branch.buttons || [{ name: '关闭' }];
    }

    if (childViewNodes.length > 0) {
      branchViewNode.children = childViewNodes;
    }

    branchViewNodes.push(branchViewNode);
  });

  const parallelProcessNode = {
    name: i18n(node.name || 'ParallelNode', node.name || 'ParallelNode', node.name || 'ParallelNode'),
    description: '',
    type: 'route',
    nodeId: parallelNodeId,
    prevId: '',
    nextId: branchNodeIds,
    props: { outgoingType: 'multiple' },
    childNodes: branchProcessNodes,
  };

  const parallelViewNode = {
    componentName: 'ConditionContainer',
    id: parallelNodeId,
    props: {
      name: i18n(node.name || '并行分支', node.name || 'ParallelNode', node.name || '並行分岐'),
    },
    title: node.title || '并行分支',
    type: 'parallel',
    children: branchViewNodes,
  };

  return { processNode: parallelProcessNode, viewNode: parallelViewNode };
}

function appendOpenDetailParam(url, paramName) {
  if (!url) {
    return url;
  }
  if (new RegExp('([?&])' + paramName + '=').test(url)) {
    return url;
  }
  const separator = url.endsWith('?') || url.endsWith('&')
    ? ''
    : (url.indexOf('?') === -1 ? '?' : '&');
  return url + separator + paramName + '=';
}

// ── 构建完整的 processJson 和 viewJson ──────────────

function buildProcessAndViewJson(definition, processCode, formUuid, baseUrl, appType, options) {
  const compilerOptions = options || {};
  const finishNodeId = generateNodeId();
  const nodes = definition.nodes || [];

  // 第一遍：递归分配 nodeId 并收集名称映射
  const nodeNameToIdMap = {};
  Object.defineProperties(nodeNameToIdMap, {
    __compilerOptions: { value: compilerOptions },
    __nodeBindings: { value: Object.create(null) },
    __semanticKeys: { value: new Set() },
    __usedNodeIds: { value: new Set(['sid_instStart', finishNodeId]) },
    __nodeNames: { value: new Set(['结束', 'finish', 'end']) },
  });
  nodeNameToIdMap['结束'] = finishNodeId;
  nodeNameToIdMap['finish'] = finishNodeId;
  nodeNameToIdMap['end'] = finishNodeId;
  assignNodeIdsRecursive(nodes, nodeNameToIdMap);

  // 第二遍：递归构建所有节点
  const middleResult = buildNodeListRecursive(nodes, finishNodeId, nodeNameToIdMap);

  // 设置顶层节点的 prevId
  if (middleResult.processNodes.length > 0) {
    middleResult.processNodes[0].prevId = 'sid_instStart';
    for (let mi = 1; mi < middleResult.processNodes.length; mi++) {
      middleResult.processNodes[mi].prevId = middleResult.processNodes[mi - 1].nodeId;
    }
  }

  const firstMiddleNodeId = middleResult.processNodes.length > 0
    ? middleResult.processNodes[0].nodeId
    : finishNodeId;

  // 组装发起节点
  const applyProcessNode = {
    name: i18n('发起', 'start', '開始'),
    description: '',
    type: 'apply',
    nodeId: 'sid_instStart',
    prevId: '',
    nextId: [firstMiddleNodeId],
    props: {},
    childNodes: [],
  };

  // 组装结束节点
  const finishProcessNode = {
    name: i18n('结束', 'end', '終了'),
    description: '',
    type: 'finish',
    nodeId: finishNodeId,
    prevId: '',
    nextId: [],
    props: {},
    childNodes: [],
  };

  // 组装 processJson
  const processNodes = [applyProcessNode];
  middleResult.processNodes.forEach(function (node) {
    processNodes.push(node);
  });
  processNodes.push(finishProcessNode);

  const defaultProcessDetailUrl = baseUrl + '/alibaba/web/' + appType + '/inst/taskDetail.htm';
  const defaultProcessMobileDetailUrl = baseUrl + '/alibaba/mobile/' + appType + '/inst/detail/taskDetail/';

  const processJson = {
    props: {
      allowWithdraw: true,
      allowCollaboration: true,
      allowTemporaryStorage: true,
      processCode: processCode,
      processDetailUrl: definition.processDetailUrl
        || (definition.detailUrls && (definition.detailUrls.web || definition.detailUrls.pc))
        || definition.customDetailPageUrl
        || defaultProcessDetailUrl,
      processInitUrl: baseUrl + '/alibaba/web/' + appType + '/inst/instStart.htm?processCode=' + processCode,
      processMobileDetailUrl: definition.processMobileDetailUrl
        || (definition.detailUrls && definition.detailUrls.mobile)
        || (definition.customDetailPageUrl ? appendOpenDetailParam(definition.customDetailPageUrl, 'formInstId') : null)
        || defaultProcessMobileDetailUrl,
      bindingForm: formUuid,
      stopAssociationRulesIfFailed: false,
      noRecordRecall: false,
      untimedRule: [],
    },
    nodes: processNodes,
    flowConfig: {},
    formulaRules: [],
    approvalSummary: [],
    nodeI18nKeyMap: {},
  };

  // 组装 viewJson
  const viewChildren = [];

  viewChildren.push({
    componentName: 'ApplyNode',
    id: generateNodeId(),
    props: {
      nodeName: 'ApplyNode',
      name: i18n('发起', 'start', '開始'),
    },
  });

  middleResult.viewNodes.forEach(function (node) {
    viewChildren.push(node);
  });

  viewChildren.push({
    componentName: 'EndNode',
    id: finishNodeId,
    props: {
      name: i18n('结束', 'end', '終了'),
    },
  });

  const viewJson = {
    schema: {
      componentName: 'CanvasEngine',
      id: generateNodeId(),
      props: {},
      children: viewChildren,
    },
    bindingForm: formUuid,
    formulaRules: [],
    globalSetting: {
      enableSignature: false,
      stopAssociationRulesIfFailed: false,
      nodeMerge: false,
      originatorMerge: false,
      allNodeMerge: false,
      behaviorList: [],
      needOpenDigitalSignNodes: [],
      approvalSummary: [],
      noRecordRecall: false,
      untimedRule: [],
    },
  };

  const result = {
    processJson,
    viewJson,
  };
  if (compilerOptions.semanticBindings) {
    result.nodeBindings = nodeNameToIdMap.__nodeBindings;
  }
  return result;
}

function compileProcessDefinition(definition, options) {
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
    throw new ProcessCompilerError(
      'PROCESS_COMPILE_DEFINITION_INVALID',
      'Process definition must be an object.'
    );
  }
  const compileOptions = options || {};
  const clonedDefinition = clonePlain(definition);
  return buildProcessAndViewJson(
    clonedDefinition,
    compileOptions.processCode,
    compileOptions.formUuid,
    compileOptions.baseUrl,
    compileOptions.appType,
    {
      semanticBindings: true,
      existingBindings: compileOptions.existingBindings || {},
      onWarning: compileOptions.onWarning,
    }
  );
}

module.exports = {
  ProcessCompilerError,
  buildApproverConfig,
  buildProcessAndViewJson,
  compileProcessDefinition,
  validateManagedNodeBindings,
};
