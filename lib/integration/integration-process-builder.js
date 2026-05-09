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
  };
  return events
    .map((event) => eventMapping[event.toLowerCase()])
    .filter(Boolean);
}

/**
 * 构建获取单条数据节点的过滤条件对象
 */
function buildDataRetrieveCondition(dataConditions) {
  const groupId = generateRuleGroupId();
  const rules = dataConditions.map(({ bFieldId, bFieldName, aFieldId, componentType }) => ({
    id: bFieldId,
    op: '包含',
    operators: [],
    value: aFieldId,
    componentType: componentType || 'TextField',
    ruleId: generateRuleItemId(),
    parentId: groupId,
    extValue: 'processVar',
    ruleValue: aFieldId,
    name: bFieldName,
    valueType: 'processVar',
    ruleType: 'rule_text',
    opCode: 'Contain',
  }));
  return {
    condition: 'AND',
    rules,
    ruleId: groupId,
    conditionCode: '&&',
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
    dataFormUuid, dataConditions, hasMessageNode,
    // ConnectorCall 节点（可选）：用于在集成自动化内调用任意连接器动作（如"钉钉待办/创建待办任务"）
    connectorId, actionId, connectorAssignments, connectorDescription,
  } = options;

  const hasAddDataNode = Boolean(addDataFormUuid);
  const hasDataNode = Boolean(dataFormUuid);
  const hasConnectorCallNode = Boolean(connectorId && actionId);
  const includeMessageNode = hasMessageNode !== false;

  // nodeIds 顺序：[triggerNodeId, addDataNodeId?, dataNodeId?, connectorCallNodeId?, messageNodeId?, endNodeId]
  let nodeIdIndex = 0;
  const triggerNodeId = nodeIds[nodeIdIndex++];
  const addDataNodeId = hasAddDataNode ? nodeIds[nodeIdIndex++] : null;
  const dataNodeId = hasDataNode ? nodeIds[nodeIdIndex++] : null;
  const connectorCallNodeId = hasConnectorCallNode ? nodeIds[nodeIdIndex++] : null;
  const messageNodeId = includeMessageNode ? nodeIds[nodeIdIndex++] : null;
  const endNodeId = nodeIds[nodeIdIndex++];

  // 触发节点的下一个节点
  const triggerNextId = hasAddDataNode
    ? addDataNodeId
    : hasDataNode
      ? dataNodeId
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
          conditions: null,
          activityAction: [],
          triggerFormEventRecursively: false,
        },
        triggerType: 'FormEvent',
      },
      childNodes: [],
    },
  ];

  // 新增数据节点（可选）
  if (hasAddDataNode && addDataNodeId) {
    const addDataNextId = hasDataNode
      ? dataNodeId
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
        assignments: buildDataCreateAssignments(addDataAssignments || []),
      },
      childNodes: [],
    });
  }

  // 获取单条数据节点（可选）
  if (hasDataNode && dataNodeId) {
    const conditions = dataConditions && dataConditions.length > 0
      ? buildDataRetrieveCondition(dataConditions)
      : { condition: 'AND', rules: [], ruleId: generateRuleGroupId(), conditionCode: '&&' };

    const dataRetrieveNextId = hasConnectorCallNode
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
  buildDataRetrieveCondition,
  buildDataCreateAssignments,
  buildConnectorCallAssignments,
  buildProcessJson,
};
