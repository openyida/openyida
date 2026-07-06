'use strict';

const { generateDataRuleId, generateRuleGroupId, generateButtonUuid } = require('./integration-node-ids');
const {
  buildDataRetrieveCondition,
  buildInitiateApprovalAssignments,
  buildTriggerCondition,
  resolveConnectorMode,
} = require('./integration-process-builder');
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
    processCode, formUuid, formEventTypes, notificationTitle, notificationContent,
    toUsers, userFields, appType, nodeIds,
    addDataFormUuid, addDataAssignments, addDataFormSchema, addDataFormName,
    initiateApprovalFormUuid, initiateApprovalFormName,
    initiateApprovalInitiator, initiateApprovalAssignments,
    dataFormUuid, dataConditions, hasMessageNode, approvalActions,
    approvalNodeIds, triggerRecursively, triggerConditions,
    // ConnectorCall 节点（可选）
    connectorId, actionId, connectorAssignments, connectorName, connectorDisplayName,
    connectorIcon, connectorInputs, connectorMode, connectionId,
  } = options;

  const hasAddDataNode = Boolean(addDataFormUuid);
  const hasDataNode = Boolean(dataFormUuid);
  const hasInitiateApprovalNode = Boolean(initiateApprovalFormUuid);
  const hasConnectorCallNode = Boolean(connectorId && actionId);
  const normalizedConnectorMode = resolveConnectorMode(connectorId, connectorMode);
  const includeMessageNode = hasMessageNode !== false;
  const isApprovalNodeEvent = formEventTypes.includes('activityTask');
  const isApprovalProcessEvent = formEventTypes.includes('processFinish');
  const normalFormEventTypes = formEventTypes.filter((eventType) => eventType !== 'processFinish' && eventType !== 'activityTask');
  const startFormEventTypes = isApprovalProcessEvent || isApprovalNodeEvent
    ? ['processEvents', ...normalFormEventTypes]
    : formEventTypes;
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
    : {
      condition: 'AND',
      rules: [
        {
          id: '',
          op: '等于',
          operators: [],
          componentType: 'TextField',
        },
      ],
    };
  const approvalNodeActionTasks = isApprovalNodeEvent
    ? normalizedApprovalNodeIds.map((activityId) => ({
      activityId: [activityId],
      activityAction: normalizedApprovalActions,
    }))
    : [];
  const startExamineApproveType = isApprovalNodeEvent
    ? 'activityTask'
    : 'processFinish';

  // nodeIds 顺序：[canvasId, triggerNodeId, dataNodeId?, addDataNodeId?, connectorCallNodeId?, messageNodeId?, endNodeId]
  let nodeIdIndex = 0;
  const canvasId = nodeIds[nodeIdIndex++];
  const triggerNodeId = nodeIds[nodeIdIndex++];
  const dataNodeId = hasDataNode ? nodeIds[nodeIdIndex++] : null;
  const addDataNodeId = hasAddDataNode ? nodeIds[nodeIdIndex++] : null;
  const initiateApprovalNodeId = hasInitiateApprovalNode ? nodeIds[nodeIdIndex++] : null;
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
          examineApproveType: startExamineApproveType,
          formEventType: startFormEventTypes,
          formEventField: '',
          dataFilterType: normalizedTriggerConditions.length > 0 ? 'byRule' : 'all',
          fieldType: 'all',
          conditions: triggerConditionObject,
          formUuid,
          triggerType: 'FormEvent',
          type: 'form',
          triggerFormEventRecursively: Boolean(triggerRecursively),
          examineApproveNode: isApprovalNodeEvent ? (normalizedApprovalNodeIds[0] || '') : '',
          examineApproveActiveList: isApprovalProcessEvent || isApprovalNodeEvent ? normalizedApprovalActions : [],
          examineApproveActiveTask: approvalNodeActionTasks,
        },
      },
    },
  ];

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

  // 连接器调用节点（可选）
  // 与宜搭设计器 UI 严格对齐：componentName=ConnectorNode，props.connectorRules.* 需含 inputs/outputs/rules/...
  if (hasInitiateApprovalNode && initiateApprovalNodeId) {
    const formDisplayName = initiateApprovalFormName || initiateApprovalFormUuid;
    children.push({
      componentName: 'InitiateApprovalNode',
      id: initiateApprovalNodeId,
      props: {
        nodeName: 'InitiateApprovalNode',
        name: { zh_CN: '发起审批', en_US: 'Initiate approval', type: 'i18n' },
        description: '请设置发起审批',
        initiateApprovalRules: {
          type: 'single',
          initiator: initiateApprovalInitiator || { type: 'select_user', value: '' },
          assignments: buildInitiateApprovalAssignments(initiateApprovalAssignments || [], { includeRequired: true }),
          formUuid: initiateApprovalFormUuid,
          processCode,
          formTitle: '',
          appType,
          description: `在 [${formDisplayName}] 中发起一条审批`,
        },
        signAction: 'one_by_one',
        nodeError: '',
      },
      title: '发起审批',
    });
  }

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
    const connectorDisplayTitle = connectorDisplayName || connectorName || '连接器';
    const connectorInternalName = connectorName || connectorId || connectorDisplayTitle;

    children.push({
      componentName: 'ConnectorNode',
      id: connectorCallNodeId,
      props: {
        nodeName: 'ConnectorNode',
        connectorRules: {
          allStepCounts: 2,
          currentStep: 1,
          connectorId,
          connectionId: connectionId || '',
          actionId,
          connector: {
            config: null,
            connectorCorpId: '',
            connectorId,
            connectorName: connectorInternalName,
            connectorMode: normalizedConnectorMode,
            containTriggers: null,
            description: connectorDisplayTitle,
            displayName: connectorDisplayTitle,
            iconUrl: connectorIcon || '',
            mode: normalizedConnectorMode,
            name: connectorDisplayTitle,
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
          description: presetDescription || connectorDisplayTitle,
          openDevSchemaType: presetSchemaType,
          totalLevel: 0,
          categoryListMap: {},
          selectedCategoryList: [],
          integrationObjectPath: [],
          integrationObjectName: '',
        },
        name: connectorDisplayTitle,
        description: '请选择连接器',
        step: 0,
        status: 'edit',
      },
      title: connectorDisplayTitle,
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
