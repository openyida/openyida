'use strict';

const { generateDataRuleId, generateRuleGroupId, generateButtonUuid } = require('./integration-node-ids');
const { buildDataRetrieveCondition } = require('./integration-process-builder');
const {
  lookupConnectorPreset,
  buildConnectorRulesFromInputs,
  buildFallbackInputsFromAssignments,
} = require('./connector-presets');

/**
 * integration-view-builder.js - 构建逻辑流画布 Schema（viewJson）
 *
 * viewJson 是 saveProcess 接口的 viewJson 参数，描述节点在前端画布上的渲染结构。
 * 与 integration-process-builder.js 的区别：
 *   - process-builder：执行引擎用，关注 nextId、type、props.inputs 等执行逻辑
 *   - 本文件：前端画布用，关注 componentName、addDataRules.inputs/rules 等渲染 Schema
 */

/**
 * 将表单 Schema components 转换为 AddDataNode viewJson 所需的 childList 格式
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
 */
function buildViewJson(options) {
  const {
    formUuid, formEventTypes, notificationTitle, notificationContent,
    toUsers, userFields, appType, nodeIds,
    addDataFormUuid, addDataAssignments, addDataFormSchema, addDataFormName,
    dataFormUuid, dataConditions, hasMessageNode,
    // ConnectorCall 节点（可选）
    connectorId, actionId, connectorAssignments, connectorName, connectorIcon, connectorInputs,
  } = options;

  const hasAddDataNode = Boolean(addDataFormUuid);
  const hasDataNode = Boolean(dataFormUuid);
  const hasConnectorCallNode = Boolean(connectorId && actionId);
  const includeMessageNode = hasMessageNode !== false;

  // nodeIds 顺序：[canvasId, triggerNodeId, addDataNodeId?, dataNodeId?, connectorCallNodeId?, messageNodeId?, endNodeId]
  let nodeIdIndex = 0;
  const canvasId = nodeIds[nodeIdIndex++];
  const triggerNodeId = nodeIds[nodeIdIndex++];
  const addDataNodeId = hasAddDataNode ? nodeIds[nodeIdIndex++] : null;
  const dataNodeId = hasDataNode ? nodeIds[nodeIdIndex++] : null;
  const connectorCallNodeId = hasConnectorCallNode ? nodeIds[nodeIdIndex++] : null;
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
        nodeError: '',
        start: {
          examineApproveType: 'processFinish',
          formEventType: formEventTypes,
          formEventField: '',
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
          triggerFormEventRecursively: false,
          examineApproveNode: '',
          examineApproveActiveList: [],
        },
      },
    },
  ];

  // 新增数据节点（可选）
  if (hasAddDataNode && addDataNodeId) {
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
  if (hasDataNode && dataNodeId) {
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

  // 连接器调用节点（可选）
  // 与宜搭设计器 UI 严格对齐：componentName=ConnectorNode，props.connectorRules.* 需含 inputs/outputs/rules/...
  if (hasConnectorCallNode && connectorCallNodeId) {
    // 三级降级构建 inputs/outputs/description：
    //   1) 用户显式传入 --connector-inputs 文件
    //   2) 已知连接器 action preset（含 inputs + outputs + description）
    //   3) 按 assignments 合成最小 fallback inputs
    let normalizedInputs = Array.isArray(connectorInputs) ? connectorInputs : [];
    let normalizedOutputs = [];
    let presetDescription = '';
    let presetSchemaType = 'normal';

    if (normalizedInputs.length === 0) {
      const preset = lookupConnectorPreset(connectorId, actionId);
      if (preset && preset.inputs && preset.inputs.length > 0) {
        normalizedInputs = preset.inputs;
        normalizedOutputs = preset.outputs || [];
        presetDescription = preset.description || '';
        presetSchemaType = preset.openDevSchemaType || 'normal';
      } else {
        normalizedInputs = buildFallbackInputsFromAssignments(connectorAssignments);
      }
    }

    // 合成 rules 数组（前端画布识别「已配置」的关键依据）
    const connectorRulesArray = buildConnectorRulesFromInputs(normalizedInputs, connectorAssignments);
    const connectorDisplayName = connectorName || '连接器';

    children.push({
      componentName: 'ConnectorNode',
      id: connectorCallNodeId,
      props: {
        nodeName: 'ConnectorNode',
        connectorRules: {
          allStepCounts: 2,
          currentStep: 1,
          connectorId,
          connectionId: '',
          actionId,
          connector: {
            config: null,
            connectorCorpId: '',
            connectorId,
            containTriggers: null,
            description: connectorDisplayName,
            iconUrl: connectorIcon || '',
            mode: 1,
            name: connectorDisplayName,
            orgId: 0,
            prioirty: 0,
            subscribed: null,
            underControl: null,
          },
          inputs: normalizedInputs,
          outputs: normalizedOutputs,
          url: '',
          method: '',
          body: '',
          rules: connectorRulesArray,
          description: presetDescription || connectorDisplayName,
          openDevSchemaType: presetSchemaType,
          totalLevel: 0,
          categoryListMap: {},
          selectedCategoryList: [],
          integrationObjectPath: [],
          integrationObjectName: '',
        },
        name: connectorDisplayName,
        description: '请选择连接器',
        step: 0,
        status: 'edit',
      },
      title: connectorDisplayName,
    });
  }

  // 消息通知节点（可选）
  if (includeMessageNode && messageNodeId) {
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
          userFields: Array.isArray(userFields) && userFields.length > 0 ? userFields : ['form_inst_modifier'],
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

module.exports = {
  buildAddDataChildList,
  buildViewJson,
};
