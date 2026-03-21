'use strict';

/**
 * integration-view-builder.js - 构建逻辑流画布 Schema（viewJson）
 *
 * viewJson 是 saveProcess 接口的 viewJson 参数，描述节点在前端画布上的渲染结构。
 * 与 integration-process-builder.js 的区别：
 *   - process-builder：执行引擎用，关注 nextId、type、props.inputs 等执行逻辑
 *   - 本文件：前端画布用，关注 componentName、addDataRules.inputs/rules 等渲染 Schema
 */

const {
  generateButtonUuid,
  generateRuleGroupId,
  generateDataRuleId,
} = require('./integration-node-ids');
const { buildDataRetrieveCondition } = require('./integration-process-builder');

/**
 * 将表单 Schema components 转换为 AddDataNode viewJson 所需的 childList 格式
 * @param {Array} components - getFormSchema 返回的 components 数组
 * @returns {Array} childList 数组
 */
function buildAddDataChildList(components) {
  return components
    .filter((component) => component.props && component.props.fieldId)
    .map((component) => {
      const { props } = component;
      const fieldId = props.fieldId;
      const labelObj = props.label || {};
      const labelText = typeof labelObj === 'object'
        ? (labelObj.zh_CN || labelObj.en_US || fieldId)
        : String(labelObj);
      return {
        fieldId,
        label: labelText,
        name: fieldId,
        required: false,
        componentName: component.componentName || 'TextField',
        componentOption: '[]',
        props,
      };
    });
}

/**
 * 构建 viewJson 参数（画布 Schema，对应 saveProcess 接口的 viewJson 字段）
 * @param {object} options
 * @param {string} options.formUuid - 触发表单 UUID
 * @param {string[]} options.formEventTypes - 触发事件类型列表
 * @param {string} options.notificationTitle - 通知标题
 * @param {string} options.notificationContent - 通知内容
 * @param {Array<{userId: string, userName: string}>} options.toUsers - 接收通知的用户列表
 * @param {string} options.appType - 应用 appType
 * @param {string[]} options.nodeIds - 节点 ID 列表（canvasId 开头，按顺序：canvas, trigger, [addData], [dataRetrieve], [message], end）
 * @param {string} [options.addDataFormUuid] - 新增数据节点的目标表单 UUID
 * @param {Array<{column: string, valueType: string, value: string}>} [options.addDataAssignments] - 新增数据节点字段赋值
 * @param {Array} [options.addDataFormSchema] - 目标表单字段 Schema 列表（来自 getFormSchema）
 * @param {string} [options.addDataFormName] - 目标表单名称（用于 description 显示）
 * @param {string} [options.dataFormUuid] - 获取单条数据的目标表单 UUID（B 表单）
 * @param {Array<{bFieldId: string, bFieldName: string, aFieldId: string, componentType: string}>} [options.dataConditions]
 * @param {boolean} [options.hasMessageNode] - 是否包含消息通知节点（无 receivers 时为 false）
 * @returns {object} viewJson 参数对象
 */
function buildViewJson({
  formUuid,
  formEventTypes,
  notificationTitle,
  notificationContent,
  toUsers,
  appType,
  nodeIds,
  addDataFormUuid,
  addDataAssignments,
  addDataFormSchema,
  addDataFormName,
  dataFormUuid,
  dataConditions,
  hasMessageNode,
}) {
  const hasAddDataNode = Boolean(addDataFormUuid);
  const hasDataNode = Boolean(dataFormUuid);
  const includeMessageNode = hasMessageNode !== false;

  // nodeIds 顺序：[canvasId, triggerNodeId, addDataNodeId?, dataNodeId?, messageNodeId?, endNodeId]
  let nodeIdIndex = 0;
  const canvasId = nodeIds[nodeIdIndex++];
  const triggerNodeId = nodeIds[nodeIdIndex++];
  const addDataNodeId = hasAddDataNode ? nodeIds[nodeIdIndex++] : null;
  const dataNodeId = hasDataNode ? nodeIds[nodeIdIndex++] : null;
  const messageNodeId = includeMessageNode ? nodeIds[nodeIdIndex++] : null;
  const endNodeId = nodeIds[nodeIdIndex++];

  const children = [
    {
      componentName: 'StartNode',
      id: triggerNodeId,
      props: {
        nodeName: 'StartNode',
        name: {
          en_US: 'Form event trigger',
          zh_CN: '表单事件触发',
          type: 'i18n',
        },
        start: {
          examineApproveType: 'processFinish',
          formEventType: formEventTypes,
          dataFilterType: 'all',
          fieldType: 'all',
          conditions: {
            condition: 'AND',
            rules: [
              {
                id: '',
                op: '等于',
                operators: [],
                componentType: 'TextField',
              },
            ],
          },
          formUuid,
          triggerType: 'FormEvent',
          type: 'form',
          triggerFormEventRecursively: true,
          examineApproveNode: '',
          examineApproveActiveList: [],
        },
      },
    },
  ];

  // 新增数据节点（可选）
  if (hasAddDataNode) {
    const schemaComponents = Array.isArray(addDataFormSchema) ? addDataFormSchema : [];
    const childList = buildAddDataChildList(schemaComponents);
    const componentOptionMap = {};
    childList.forEach((item) => {
      componentOptionMap[item.fieldId] = '[]';
    });

    // 根据 addDataAssignments 构建 rules 数组
    const assignmentRules = (addDataAssignments || []).map((assignment) => {
      const matchedField = childList.find((item) => item.fieldId === assignment.column);
      const labelText = matchedField ? matchedField.label : assignment.column;
      const componentName = matchedField ? matchedField.componentName : 'TextField';
      return {
        name: assignment.column,
        componentName,
        valueType: assignment.valueType,
        value: assignment.valueType === 'literal' && !isNaN(Number(assignment.value))
          ? Number(assignment.value)
          : assignment.value,
        required: false,
        ruleId: generateDataRuleId(),
        componentOption: '[]',
        label: labelText,
        componentProps: {
          defaultDataSource: {},
          relateAppType: '',
          relateOrderEnable: false,
          relateOrderConfig: [],
        },
      };
    });

    const formDisplayName = addDataFormName || '目标表单';
    children.push({
      componentName: 'AddDataNode',
      id: addDataNodeId,
      props: {
        nodeName: 'AddDataNode',
        name: '新增数据',
        description: `在 [${formDisplayName}] 中新增数据`,
        addDataRules: {
          formUuid: addDataFormUuid,
          appType,
          insertType: 'form',
          type: 'single',
          subFormUuid: '',
          sourceId: '',
          assignments: [],
          inputs: {
            childList,
            componentOptionMap,
          },
          rules: {
            childList,
            componentOptionMap,
            ruleId: generateDataRuleId(),
            rules: assignmentRules,
          },
        },
      },
      title: '新增数据',
    });
  }

  // 获取单条数据节点（可选）
  if (hasDataNode) {
    const conditions = dataConditions && dataConditions.length > 0
      ? buildDataRetrieveCondition(dataConditions)
      : { condition: 'AND', rules: [], ruleId: generateRuleGroupId(), conditionCode: '&&' };

    children.push({
      componentName: 'GetSingleDataNode',
      id: dataNodeId,
      props: {
        nodeName: 'GetSingleDataNode',
        name: '获取单条数据',
        description: '请设置想要获取的数据',
        type: 'single',
        getData: {
          type: 'single',
          originalType: 'form',
          appType,
          sourceId: dataFormUuid,
          targetItem: {
            appType,
            appName: '',
            formItem: {
              formType: 'receipt',
              advanceProc: 'n',
              formUuid: dataFormUuid,
              title: '',
              fields: null,
              hasTableField: null,
            },
          },
          subSourceId: '',
          relativeItem: {},
          filterType: 'condition',
          condition: conditions,
          sort: { type: 'none', column: '' },
          rulesFilter: [],
          outputs: [],
          quantity: 1,
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
        title: '获取单条数据',
      },
    });
  }

  // 消息通知节点（可选）
  if (includeMessageNode) {
    children.push({
      componentName: 'SendMessageNode',
      id: messageNodeId,
      props: {
        nodeName: 'SendMessageNode',
        name: '消息通知',
        description: '请设置消息通知',
        sendMessageRules: {
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
          userFields: ['form_inst_modifier'],
          description: '发送工作通知',
        },
      },
      title: '消息通知',
    });
  }

  children.push({
    componentName: 'EndNode',
    id: endNodeId,
    props: {
      name: { en_US: 'end', zh_CN: '结束', type: 'i18n' },
    },
  });

  return {
    schema: {
      componentName: 'CanvasEngine',
      id: canvasId,
      props: {},
      children,
    },
    globalSetting: {},
  };
}

module.exports = { buildAddDataChildList, buildViewJson };
