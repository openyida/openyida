'use strict';

const { generateRuleGroupId, generateRuleItemId, generateDataRuleId, generateButtonUuid } = require('./integration-node-ids');

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
  return events
    .map((event) => eventMapping[event.toLowerCase()])
    .filter(Boolean);
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

function buildTriggerCondition(triggerConditions, logic = 'AND') {
  const groupId = generateRuleGroupId();
  const rules = (triggerConditions || []).map((condition) => {
    const opCode = condition.opCode || 'Equal';
    const valueType = condition.valueType || 'literal';
    const rawValue = condition.value;
    const ruleValue = valueType === 'literal' && !isNaN(Number(rawValue))
      ? Number(rawValue)
      : rawValue;
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
    const rawValue = condition.aFieldId || condition.value;
    const ruleValue = valueType === 'literal' && !isNaN(Number(rawValue))
      ? Number(rawValue)
      : rawValue;
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
function buildDataCreateAssignments(assignments) {
  return assignments.map(({ column, valueType, value }) => ({
    column,
    valueType,
    value: valueType === 'literal' && !isNaN(Number(value)) ? Number(value) : value,
    assignments: [],
  }));
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
function buildConnectorCallAssignments(assignments) {
  return assignments.map(({ column, valueType, value }) => ({
    column,
    valueType,
    value: valueType === 'literal' && !isNaN(Number(value)) ? Number(value) : value,
    assignments: [],
  }));
}

/**
 * 构建 json 参数（节点定义，对应 saveProcess 接口的 json 字段）
 */
function buildProcessJson(options) {
  const {
    processCode, formUuid, appType, formEventTypes,
    notificationTitle, notificationContent, toUsers, userFields, nodeIds,
    addDataFormUuid, addDataAssignments,
    dataFormUuid, dataConditions, hasMessageNode, approvalActions,
    approvalNodeIds, triggerRecursively, triggerConditions,
    // ConnectorCall 节点（可选）：用于在集成自动化内调用任意连接器动作（如"钉钉待办/创建待办任务"）
    connectorId, actionId, connectorAssignments, connectorDescription,
  } = options;

  const hasAddDataNode = Boolean(addDataFormUuid);
  const hasDataNode = Boolean(dataFormUuid);
  const hasConnectorCallNode = Boolean(connectorId && actionId);
  const includeMessageNode = hasMessageNode !== false;
  const isApprovalNodeEvent = formEventTypes.includes('activityTask');
  const isApprovalProcessEvent = formEventTypes.includes('processFinish');
  const normalizedApprovalActions = Array.isArray(approvalActions)
    ? approvalActions.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const normalizedApprovalNodeIds = Array.isArray(approvalNodeIds)
    ? approvalNodeIds.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const normalizedTriggerConditions = Array.isArray(triggerConditions)
    ? triggerConditions.filter(Boolean)
    : [];
  const triggerConditionObject = normalizedTriggerConditions.length > 0
    ? buildTriggerCondition(normalizedTriggerConditions)
    : null;
  const activityTask = isApprovalNodeEvent
    ? normalizedApprovalNodeIds.map((activityId) => ({
      activityId: [activityId],
      activityAction: normalizedApprovalActions,
    }))
    : [];

  // nodeIds 顺序：[triggerNodeId, dataNodeId?, addDataNodeId?, connectorCallNodeId?, messageNodeId?, endNodeId]
  let nodeIdIndex = 0;
  const triggerNodeId = nodeIds[nodeIdIndex++];
  const dataNodeId = hasDataNode ? nodeIds[nodeIdIndex++] : null;
  const addDataNodeId = hasAddDataNode ? nodeIds[nodeIdIndex++] : null;
  const connectorCallNodeId = hasConnectorCallNode ? nodeIds[nodeIdIndex++] : null;
  const messageNodeId = includeMessageNode ? nodeIds[nodeIdIndex++] : null;
  const endNodeId = nodeIds[nodeIdIndex++];

  // 触发节点的下一个节点
  const triggerNextId = hasDataNode
    ? dataNodeId
    : hasAddDataNode
      ? addDataNodeId
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
    const conditions = dataConditions && dataConditions.length > 0
      ? buildDataRetrieveCondition(dataConditions)
      : { condition: 'AND', rules: [], ruleId: generateRuleGroupId(), conditionCode: '&&' };

    const dataRetrieveNextId = hasAddDataNode
      ? addDataNodeId
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
        originalType: 'form',
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
    const addDataNextId = hasConnectorCallNode
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
        assignments: buildDataCreateAssignments(addDataAssignments || []),
      },
      childNodes: [],
    });
  }

  // 连接器调用节点（可选）：调用任意连接器动作，典型如"钉钉待办/创建待办任务"
  // 与宜搭设计器 UI 保存时的节点结构严格对齐：type=innerConnector，props.inputs 包含 connectorId/actionId/assignments
  if (hasConnectorCallNode && connectorCallNodeId) {
    const connectorCallNextId = includeMessageNode ? messageNodeId : endNodeId;

    nodes.push({
      name: { zh_CN: '连接器', en_US: '' },
      description: connectorDescription || '请选择连接器',
      type: 'innerConnector',
      nodeId: connectorCallNodeId,
      prevId: '',
      nextId: [connectorCallNextId],
      props: {
        inputs: {
          url: '',
          method: '',
          body: '',
          connection: '',
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
              value: `//yidalogin.aliwork.com/${appType}/formDetail/${formUuid}?formInstId=\${formInstId}`,
              buttonUuid: generateButtonUuid(),
            },
          ],
        },
        appType,
        toRoles: [],
        toUsers,
        userFields: Array.isArray(userFields) && userFields.length > 0 ? userFields : ['form_inst_creator'],
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
  mapTriggerOperator,
  mapDataRetrieveOperator,
  buildTriggerCondition,
  buildDataRetrieveCondition,
  buildDataCreateAssignments,
  buildConnectorCallAssignments,
  buildProcessJson,
};
