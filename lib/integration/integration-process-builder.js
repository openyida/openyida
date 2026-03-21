'use strict';

/**
 * integration-process-builder.js - 构建逻辑流执行引擎节点定义（processJson）
 *
 * processJson 是 saveProcess 接口的 json 参数，描述节点的逻辑关系和执行规则。
 * 与 integration-view-builder.js 的区别：
 *   - 本文件：执行引擎用，关注 nextId、type、props.inputs 等执行逻辑
 *   - view-builder：前端画布用，关注 componentName、addDataRules.inputs/rules 等渲染 Schema
 */

const {
  generateButtonUuid,
  generateRuleGroupId,
  generateRuleItemId,
  generateDataRuleId,
} = require('./integration-node-ids');

/**
 * 将用户友好的事件名称映射到宜搭 API 使用的事件类型
 * @param {string[]} events - 用户输入的事件列表
 * @returns {string[]} 宜搭 API 事件类型列表
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
 * @param {Array<{bFieldId: string, bFieldName: string, aFieldId: string, componentType: string}>} dataConditions
 * @returns {object} condition 对象
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
 * @param {Array<{column: string, valueType: string, value: string}>} assignments
 * @returns {Array} assignments 数组
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
 * 构建 json 参数（节点定义，对应 saveProcess 接口的 json 字段）
 * @param {object} options
 * @param {string} options.processCode - 逻辑流唯一标识
 * @param {string} options.formUuid - 触发表单 UUID
 * @param {string} options.appType - 应用 appType
 * @param {string[]} options.formEventTypes - 触发事件类型列表（insert/update/delete/comment）
 * @param {string} options.notificationTitle - 通知标题
 * @param {string} options.notificationContent - 通知内容
 * @param {Array<{userId: string, userName: string}>} options.toUsers - 接收通知的用户列表
 * @param {string[]} options.nodeIds - 节点 ID 列表（按顺序：trigger, [addData], [dataRetrieve], [message], end）
 * @param {string} [options.addDataFormUuid] - 新增数据节点的目标表单 UUID
 * @param {Array<{column: string, valueType: string, value: string}>} [options.addDataAssignments] - 新增数据节点字段赋值
 * @param {string} [options.dataFormUuid] - 获取单条数据的目标表单 UUID（B 表单）
 * @param {Array<{bFieldId: string, bFieldName: string, aFieldId: string, componentType: string}>} [options.dataConditions]
 * @param {boolean} [options.hasMessageNode] - 是否包含消息通知节点
 * @returns {object} json 参数对象
 */
function buildProcessJson({
  processCode,
  formUuid,
  appType,
  formEventTypes,
  notificationTitle,
  notificationContent,
  toUsers,
  nodeIds,
  addDataFormUuid,
  addDataAssignments,
  dataFormUuid,
  dataConditions,
  hasMessageNode,
}) {
  const hasAddDataNode = Boolean(addDataFormUuid);
  const hasDataNode = Boolean(dataFormUuid);
  const includeMessageNode = hasMessageNode !== false;

  // nodeIds 顺序：[triggerNodeId, addDataNodeId?, dataNodeId?, messageNodeId?, endNodeId]
  let nodeIdIndex = 0;
  const triggerNodeId = nodeIds[nodeIdIndex++];
  const addDataNodeId = hasAddDataNode ? nodeIds[nodeIdIndex++] : null;
  const dataNodeId = hasDataNode ? nodeIds[nodeIdIndex++] : null;
  const messageNodeId = includeMessageNode ? nodeIds[nodeIdIndex++] : null;
  const endNodeId = nodeIds[nodeIdIndex++];

  // 触发节点的下一个节点
  const triggerNextId = hasAddDataNode
    ? addDataNodeId
    : hasDataNode
      ? dataNodeId
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
          formUuid,
          conditions: null,
          activityAction: [],
          triggerFormEventRecursively: true,
        },
        triggerType: 'FormEvent',
      },
      childNodes: [],
    },
  ];

  // 新增数据节点（可选）
  if (hasAddDataNode) {
    const addDataNextId = hasDataNode
      ? dataNodeId
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
  if (hasDataNode) {
    const conditions = dataConditions && dataConditions.length > 0
      ? buildDataRetrieveCondition(dataConditions)
      : { condition: 'AND', rules: [], ruleId: generateRuleGroupId(), conditionCode: '&&' };

    const dataRetrieveNextId = includeMessageNode ? messageNodeId : endNodeId;
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

  // 消息通知节点（可选）
  if (includeMessageNode) {
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
        userFields: ['form_inst_creator'],
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
  buildProcessJson,
};
