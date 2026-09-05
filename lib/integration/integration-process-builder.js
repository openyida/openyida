'use strict';

const { generateRuleGroupId, generateRuleItemId, generateDataRuleId, generateButtonUuid } = require('./integration-node-ids');
const {
  resolveDataSourceFormType,
  resolveDataOriginalType,
  toRuntimeDataQueryField,
  normalizeDataQueryFieldName,
} = require('./integration-form-metadata');

const ALLOWED_ASSIGNMENT_VALUE_TYPES = new Set(['literal', 'processVar', 'column']);
const ALLOWED_APPROVAL_ACTIONS = new Set(['agree', 'disagree', 'terminated']);
const NUMERIC_COMPONENT_TYPES = new Set(['NumberField', 'RateField']);

/**
 * integration-process-builder.js - 构建逻辑流执行引擎节点定义（processJson）
 *
 * processJson 是 saveProcess 接口的 json 参数，描述节点的逻辑关系和执行规则。
 * 与 integration-view-builder.js 的区别：
 *   - 本文件：执行引擎用，关注 nextId、type、props.inputs 等执行逻辑
 *   - view-builder：前端画布用，关注 componentName、addDataRules.inputs/rules 等渲染 Schema
 */

/**
 * 将用户友好的事件名称映射到宜搭 API 使用的事件类型
 */
function mapEventTypes(events) {
  const eventMapping = {
    create: 'insert',
    insert: 'insert',
    update: 'update',
    delete: 'delete',
    comment: 'comment',
    processfinish: 'processFinish',
    process_finish: 'processFinish',
    approval: 'processFinish',
    approve: 'processFinish',
    process: 'processFinish',
    activitytask: 'activityTask',
    activity_task: 'activityTask',
    approvalnode: 'activityTask',
    approval_node: 'activityTask',
  };
  return events.map((event) => {
    const normalized = String(event || '').trim().toLowerCase();
    const mapped = eventMapping[normalized];
    if (!mapped) {
      throw new Error(`Unsupported integration event: ${event}`);
    }
    return mapped;
  });
}

function normalizeTypedLiteral(valueType, value, componentType) {
  if (valueType !== 'literal' || typeof value !== 'string'
    || !NUMERIC_COMPONENT_TYPES.has(componentType)) {
    return value;
  }
  const normalized = value.trim();
  if (!normalized || !Number.isFinite(Number(normalized))) {
    return value;
  }
  return Number(normalized);
}

function validateAssignments(assignments, label = 'assignment') {
  for (const assignment of assignments || []) {
    if (!assignment || typeof assignment !== 'object') {
      throw new Error(`${label} must be an object`);
    }
    const column = assignment.column || assignment.fieldId || assignment.targetField;
    if (!column || !String(column).trim()) {
      throw new Error(`${label} column is required`);
    }
    const valueType = assignment.valueType || 'literal';
    if (!ALLOWED_ASSIGNMENT_VALUE_TYPES.has(valueType)) {
      throw new Error(`${label} valueType is unsupported: ${valueType}`);
    }
    if (!Object.prototype.hasOwnProperty.call(assignment, 'value')
      || assignment.value === undefined || assignment.value === null || assignment.value === '') {
      throw new Error(`${label} value is required`);
    }
  }
}

function normalizeApprovalActions(actions) {
  return (Array.isArray(actions) ? actions : [])
    .map((item) => String(item).trim())
    .filter(Boolean)
    .map((action) => {
      const normalized = action.toLowerCase();
      if (!ALLOWED_APPROVAL_ACTIONS.has(normalized)) {
        throw new Error(`Unsupported approval action: ${action}`);
      }
      return normalized;
    });
}

function buildApprovalTriggerState(formEventTypes, approvalActions, approvalNodeIds) {
  const isApprovalNodeEvent = formEventTypes.includes('activityTask');
  const isApprovalProcessEvent = formEventTypes.includes('processFinish');
  const actions = normalizeApprovalActions(approvalActions);
  const nodeIds = Array.isArray(approvalNodeIds)
    ? approvalNodeIds.map((item) => String(item).trim()).filter(Boolean)
    : [];
  if ((isApprovalProcessEvent || isApprovalNodeEvent) && actions.length === 0) {
    throw new Error('Approval events require at least one approval action');
  }
  if (isApprovalNodeEvent && nodeIds.length === 0) {
    throw new Error('activityTask events require at least one approval node id');
  }
  if (!isApprovalProcessEvent && !isApprovalNodeEvent && actions.length > 0) {
    throw new Error('approval actions require an approval event');
  }
  if (!isApprovalNodeEvent && nodeIds.length > 0) {
    throw new Error('approval node ids require an activityTask event');
  }
  const activityTask = isApprovalNodeEvent
    ? nodeIds.map((activityId) => ({ activityId: [activityId], activityAction: actions }))
    : [];
  const normalFormEventTypes = formEventTypes.filter((eventType) => (
    eventType !== 'processFinish' && eventType !== 'activityTask'
  ));
  return {
    isApprovalNodeEvent,
    isApprovalProcessEvent,
    approvalActions: actions,
    approvalNodeIds: nodeIds,
    activityTask,
    startFormEventTypes: isApprovalProcessEvent || isApprovalNodeEvent
      ? ['processEvents', ...normalFormEventTypes]
      : formEventTypes,
    examineApproveType: isApprovalNodeEvent ? 'activityTask' : 'processFinish',
  };
}

function mapTriggerOperator(opCode) {
  const operatorMapping = {
    Equal: '等于',
    NotEqual: '不等于',
    Contain: '包含',
    NotContain: '不包含',
    HasValue: '有值',
    NoValue: '没有值',
    ExistValue: '有值',
    NotExistValue: '没有值',
    GreaterThan: '大于',
    LessThan: '小于',
    GreaterThanOrEqual: '大于等于',
    LessThanOrEqual: '小于等于',
    In: '等于任意一个',
    NotIn: '不等于任意一个',
  };
  return operatorMapping[opCode] || opCode || '等于';
}

function mapDataRetrieveOperator(opCode) {
  return mapTriggerOperator(opCode || 'Contain');
}

function getFirstNonNullishOwnValue(source, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)
      && source[key] !== undefined
      && source[key] !== null) {
      return { found: true, value: source[key] };
    }
  }
  return { found: false, value: undefined };
}

function buildTriggerCondition(triggerConditions, logic = 'AND') {
  const groupId = generateRuleGroupId();
  const rules = (triggerConditions || []).map((condition) => {
    const opCode = condition.opCode || 'Equal';
    const valueType = condition.valueType || 'literal';
    const rawValue = condition.value;
    const ruleValue = normalizeTypedLiteral(valueType, rawValue, condition.componentType);
    return {
      id: condition.fieldId,
      op: mapTriggerOperator(opCode),
      operators: [],
      value: ruleValue,
      componentType: condition.componentType || 'TextField',
      ruleId: generateRuleItemId(),
      parentId: groupId,
      extValue: valueType === 'literal' ? 'value' : valueType,
      ruleValue,
      name: condition.fieldName || condition.fieldId,
      valueType,
      ruleType: 'rule_text',
      opCode,
    };
  });
  const normalizedLogic = String(logic || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND';
  return {
    condition: normalizedLogic,
    rules,
    ruleId: groupId,
    conditionCode: normalizedLogic === 'OR' ? '||' : '&&',
  };
}

/**
 * 构建获取单条数据节点的过滤条件对象
 */
function buildDataRetrieveCondition(dataConditions, logic = 'AND') {
  const groupId = generateRuleGroupId();
  const rules = dataConditions.map((condition) => {
    const opCode = condition.opCode || 'Contain';
    const valueType = condition.valueType || 'processVar';
    const rawValue = getFirstNonNullishOwnValue(condition, ['aFieldId', 'value', 'ruleValue']).value;
    const ruleValue = normalizeTypedLiteral(valueType, rawValue, condition.componentType);
    return {
      id: condition.bFieldId,
      op: mapDataRetrieveOperator(opCode),
      operators: [],
      value: ruleValue,
      componentType: condition.componentType || 'TextField',
      ruleId: generateRuleItemId(),
      parentId: groupId,
      extValue: valueType === 'literal' ? 'value' : valueType,
      ruleValue,
      name: condition.bFieldName,
      valueType,
      ruleType: 'rule_text',
      opCode,
    };
  });
  const normalizedLogic = String(logic || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND';
  return {
    condition: normalizedLogic,
    rules,
    ruleId: groupId,
    conditionCode: normalizedLogic === 'OR' ? '||' : '&&',
  };
}

/**
 * 构建新增数据节点的字段赋值列表
 */
function buildDataCreateAssignments(assignments, componentTypesByColumn = new Map()) {
  validateAssignments(assignments, 'dataCreate assignment');
  return assignments.map(({ column, valueType, value }) => {
    const normalizedValueType = valueType || 'literal';
    return {
      column,
      valueType: normalizedValueType,
      value: normalizeTypedLiteral(normalizedValueType, value, componentTypesByColumn.get(column)),
      assignments: [],
    };
  });
}

function normalizeAssignmentValue(valueType, value, componentType) {
  return normalizeTypedLiteral(valueType, value, componentType);
}

function buildInitiateApprovalAssignments(assignments, options = {}) {
  const includeRequired = options.includeRequired !== false;
  validateAssignments(assignments, 'initiateApproval assignment');
  return (assignments || []).map(({ column, valueType, value }) => {
    const normalizedValueType = valueType || 'literal';
    const assignment = {
      column,
      valueType: normalizedValueType,
      value: normalizeAssignmentValue(normalizedValueType, value, options.componentTypesByColumn?.get(column)),
    };
    if (includeRequired) {
      assignment.required = false;
    }
    return assignment;
  });
}

/**
 * 构建连接器调用节点的入参映射列表（assignments）
 *
 * 字段结构与"新增数据"同形：{column, valueType, value, assignments:[]}，
 * 但 column 是连接器动作的入参名（如 subject/unionId/executorIds/dueTime），
 * 不是表单字段 ID。
 *
 * valueType 支持：
 *   - processVar：引用触发表单字段 ID 或系统变量（如 form_inst_modifier）
 *   - literal   ：字面量（数字/字符串常量）
 */
function buildConnectorCallAssignments(assignments, componentTypesByColumn = new Map()) {
  validateAssignments(assignments, 'connector assignment');
  return assignments.map(({ column, valueType, value }) => {
    const normalizedValueType = valueType || 'literal';
    return {
      column,
      valueType: normalizedValueType,
      value: normalizeTypedLiteral(normalizedValueType, value, componentTypesByColumn.get(column)),
      assignments: [],
    };
  });
}

function resolveConnectorMode(connectorId, connectorMode) {
  const hasExplicitMode = connectorMode !== undefined && connectorMode !== null && connectorMode !== '';
  const parsedMode = Number(connectorMode);
  if (hasExplicitMode) {
    if (!Number.isFinite(parsedMode)) {
      throw new Error(`Unsupported connector mode: ${connectorMode}`);
    }
    if (parsedMode !== 1 && parsedMode !== 5) {
      throw new Error(`Unsupported connector mode: ${parsedMode}`);
    }
    if (String(connectorId || '').startsWith('Http_') && parsedMode !== 5) {
      throw new Error(`HTTP connector ${connectorId} requires connector mode 5`);
    }
    return parsedMode;
  }
  return String(connectorId || '').startsWith('Http_') ? 5 : 1;
}

function normalizeUserFields(userFields) {
  return Array.isArray(userFields)
    ? userFields.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

/**
 * 构建 json 参数（节点定义，对应 saveProcess 接口的 json 字段）
 */
function buildProcessJson(options) {
  const {
    processCode, formUuid, appType, formEventTypes,
    notificationTitle, notificationContent, toUsers, userFields, nodeIds,
    addDataFormUuid, addDataAssignments, addDataFormSchema,
    initiateApprovalFormUuid, initiateApprovalFormName,
    initiateApprovalInitiator, initiateApprovalAssignments,
    dataFormUuid, dataFormType, dataConditions, hasMessageNode, approvalActions,
    approvalNodeIds, triggerRecursively, triggerConditions,
    // ConnectorCall 节点（可选）：用于在集成自动化内调用任意连接器动作（如"钉钉待办/创建待办任务"）
    connectorId, actionId, connectorAssignments, connectorDescription,
    connectorMode, connectionId,
  } = options;

  const hasAddDataNode = Boolean(addDataFormUuid);
  const hasDataNode = Boolean(dataFormUuid);
  const hasInitiateApprovalNode = Boolean(initiateApprovalFormUuid);
  const hasConnectorCallNode = Boolean(connectorId && actionId);
  const addDataComponentTypesByColumn = new Map(
    (Array.isArray(addDataFormSchema) ? addDataFormSchema : [])
      .filter((component) => component && component.props && component.props.fieldId)
      .map((component) => [component.props.fieldId, component.componentName])
  );
  const normalizedConnectorMode = resolveConnectorMode(connectorId, connectorMode);
  const connectorProcessType = normalizedConnectorMode === 5 ? 'httpConnector' : 'innerConnector';
  const includeMessageNode = hasMessageNode !== false;
  const approvalTrigger = buildApprovalTriggerState(formEventTypes, approvalActions, approvalNodeIds);
  const {
    isApprovalNodeEvent,
    isApprovalProcessEvent,
    approvalActions: normalizedApprovalActions,
    approvalNodeIds: normalizedApprovalNodeIds,
    activityTask,
  } = approvalTrigger;
  const normalizedTriggerConditions = Array.isArray(triggerConditions)
    ? triggerConditions.filter(Boolean)
    : [];
  const triggerConditionObject = normalizedTriggerConditions.length > 0
    ? buildTriggerCondition(normalizedTriggerConditions)
    : null;

  // nodeIds 顺序：[triggerNodeId, dataNodeId?, addDataNodeId?, connectorCallNodeId?, messageNodeId?, endNodeId]
  let nodeIdIndex = 0;
  const triggerNodeId = nodeIds[nodeIdIndex++];
  const dataNodeId = hasDataNode ? nodeIds[nodeIdIndex++] : null;
  const addDataNodeId = hasAddDataNode ? nodeIds[nodeIdIndex++] : null;
  const initiateApprovalNodeId = hasInitiateApprovalNode ? nodeIds[nodeIdIndex++] : null;
  const connectorCallNodeId = hasConnectorCallNode ? nodeIds[nodeIdIndex++] : null;
  const messageNodeId = includeMessageNode ? nodeIds[nodeIdIndex++] : null;
  const endNodeId = nodeIds[nodeIdIndex++];

  // 触发节点的下一个节点
  const triggerNextId = hasDataNode
    ? dataNodeId
    : hasAddDataNode
      ? addDataNodeId
      : hasInitiateApprovalNode
        ? initiateApprovalNodeId
        : hasConnectorCallNode
          ? connectorCallNodeId
          : includeMessageNode
            ? messageNodeId
            : endNodeId;

  const nodes = [
    {
      name: {
        en_US: 'Form event trigger',
        zh_CN: '表单事件触发',
        type: 'i18n',
      },
      description: '',
      type: 'trigger',
      nodeId: triggerNodeId,
      prevId: '',
      nextId: [triggerNextId],
      props: {
        inputs: {
          formEventType: formEventTypes,
          formEventField: '',
          formUuid,
          conditions: triggerConditionObject,
          activityAction: isApprovalProcessEvent || isApprovalNodeEvent ? normalizedApprovalActions : [],
          triggerFormEventRecursively: Boolean(triggerRecursively),
          activityId: isApprovalNodeEvent ? normalizedApprovalNodeIds : [],
          activityTask,
        },
        triggerType: 'FormEvent',
      },
      childNodes: [],
    },
  ];

  // 获取单条数据节点（可选）
  if (hasDataNode && dataNodeId) {
    const dataSourceFormType = resolveDataSourceFormType(
      { formUuid: dataFormUuid, formType: dataFormType },
      { defaultFormType: dataFormType, formEventTypes },
    );
    const normalizedDataConditions = Array.isArray(dataConditions)
      ? dataConditions.map((condition) => {
        if (!condition) {
          return condition;
        }
        const runtimeFieldId = toRuntimeDataQueryField(condition.bFieldId, dataSourceFormType);
        return {
          ...condition,
          bFieldId: runtimeFieldId,
          bFieldName: normalizeDataQueryFieldName(
            runtimeFieldId,
            dataSourceFormType,
            condition.bFieldName,
          ),
        };
      })
      : dataConditions;
    const conditions = normalizedDataConditions && normalizedDataConditions.length > 0
      ? buildDataRetrieveCondition(normalizedDataConditions)
      : { condition: 'AND', rules: [], ruleId: generateRuleGroupId(), conditionCode: '&&' };

    const dataRetrieveNextId = hasAddDataNode
      ? addDataNodeId
      : hasInitiateApprovalNode
        ? initiateApprovalNodeId
        : hasConnectorCallNode
          ? connectorCallNodeId
          : includeMessageNode
            ? messageNodeId
            : endNodeId;

    nodes.push({
      name: { zh_CN: '获取单条数据', en_US: '' },
      description: '请设置想要获取的数据',
      type: 'dataRetrieve',
      nodeId: dataNodeId,
      prevId: '',
      nextId: [dataRetrieveNextId],
      props: {
        type: 'single',
        filterType: 'condition',
        sort: { type: 'none', column: '' },
        sourceId: dataFormUuid,
        appType,
        originalType: resolveDataOriginalType(dataSourceFormType),
        subSourceId: '',
        condition: conditions,
        quantity: '1',
        dataRules: {
          rules: [
            {
              componentName: '',
              labe: '',
              name: '',
              required: false,
              ruleId: generateDataRuleId(),
              value: '',
              valueType: 'literal',
            },
          ],
        },
        assignments: [],
      },
      childNodes: [],
    });
  }

  // 新增数据节点（可选）
  if (hasAddDataNode && addDataNodeId) {
    const addDataNextId = hasInitiateApprovalNode
      ? initiateApprovalNodeId
      : hasConnectorCallNode
        ? connectorCallNodeId
        : includeMessageNode
          ? messageNodeId
          : endNodeId;

    nodes.push({
      name: { zh_CN: '新增数据', en_US: '' },
      description: '请设置新增数据',
      type: 'dataCreate',
      nodeId: addDataNodeId,
      prevId: '',
      nextId: [addDataNextId],
      props: {
        formUuid: addDataFormUuid,
        appType,
        subFormUuid: '',
        insertType: 'form',
        type: 'single',
        sourceId: '',
        assignments: buildDataCreateAssignments(addDataAssignments || [], addDataComponentTypesByColumn),
      },
      childNodes: [],
    });
  }

  // 发起审批节点（可选）
  if (hasInitiateApprovalNode && initiateApprovalNodeId) {
    const initiateApprovalNextId = hasConnectorCallNode
      ? connectorCallNodeId
      : includeMessageNode
        ? messageNodeId
        : endNodeId;
    const formDisplayName = initiateApprovalFormName || initiateApprovalFormUuid;

    nodes.push({
      name: { zh_CN: '发起审批', en_US: 'Initiate approval', type: 'i18n' },
      description: '请设置发起审批',
      type: 'initiateApproval',
      nodeId: initiateApprovalNodeId,
      prevId: '',
      nextId: [initiateApprovalNextId],
      props: {
        type: 'single',
        initiator: initiateApprovalInitiator || { type: 'select_user', value: '' },
        // processJson is the execution payload and does not need designer-only required flags.
        assignments: buildInitiateApprovalAssignments(initiateApprovalAssignments || [], { includeRequired: false }),
        formUuid: initiateApprovalFormUuid,
        // Parent integration processCode used by the designer binding, not the target approval flow code.
        processCode,
        formTitle: '',
        appType,
        description: `在 [${formDisplayName}] 中发起一条审批`,
      },
      childNodes: [],
    });
  }

  // 连接器调用节点（可选）：调用任意连接器动作，典型如"钉钉待办/创建待办任务"
  // 与宜搭设计器 UI 保存时的节点结构严格对齐：type 由 connector.mode 映射，props.inputs 包含 connectorId/actionId/assignments
  if (hasConnectorCallNode && connectorCallNodeId) {
    const connectorCallNextId = includeMessageNode ? messageNodeId : endNodeId;

    nodes.push({
      name: { zh_CN: '连接器', en_US: '' },
      description: connectorDescription || '请选择连接器',
      type: connectorProcessType,
      nodeId: connectorCallNodeId,
      prevId: '',
      nextId: [connectorCallNextId],
      props: {
        inputs: {
          url: '',
          method: '',
          body: '',
          // Keep both keys for compatibility with designer payloads that read either legacy or current field names.
          connection: connectionId || '',
          connectionId: connectionId || '',
          connectorMode: normalizedConnectorMode,
          connectorId,
          actionId,
          assignments: buildConnectorCallAssignments(connectorAssignments || []),
        },
      },
      childNodes: [],
    });
  }

  // 消息通知节点（可选）
  if (includeMessageNode && messageNodeId) {
    nodes.push({
      name: { zh_CN: '消息通知', en_US: '' },
      description: '请设置消息通知',
      type: 'sendMessage',
      nodeId: messageNodeId,
      prevId: '',
      nextId: [endNodeId],
      props: {
        template: { templateName: '' },
        messageType: 'NORMAL',
        messageInfo: {
          title: notificationTitle,
          content: notificationContent,
          buttons: [
            {
              name: '查看详情',
              type: 'commit',
              value: `//yidalogin.aliwork.com/${appType}/formDetail/${formUuid}?formInstId=\${formInstId}&isRenderNav=false`,
              buttonUuid: generateButtonUuid(),
            },
          ],
        },
        appType,
        toRoles: [],
        toUsers,
        userFields: normalizeUserFields(userFields),
      },
      childNodes: [],
    });
  }

  nodes.push({
    name: { en_US: 'end', zh_CN: '结束', type: 'i18n' },
    description: '',
    type: 'finish',
    nodeId: endNodeId,
    prevId: '',
    nextId: [],
    props: {},
    childNodes: [],
  });

  return {
    props: {
      allowWithdraw: true,
      allowCollaboration: true,
      allowTemporaryStorage: true,
      processCode,
    },
    nodes,
  };
}

module.exports = {
  mapEventTypes,
  normalizeTypedLiteral,
  validateAssignments,
  normalizeApprovalActions,
  buildApprovalTriggerState,
  mapTriggerOperator,
  mapDataRetrieveOperator,
  getFirstNonNullishOwnValue,
  buildTriggerCondition,
  buildDataRetrieveCondition,
  buildDataCreateAssignments,
  buildInitiateApprovalAssignments,
  buildConnectorCallAssignments,
  resolveConnectorMode,
  normalizeUserFields,
  buildProcessJson,
};
