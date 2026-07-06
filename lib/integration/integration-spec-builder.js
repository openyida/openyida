'use strict';

const fs = require('fs');
const path = require('path');
const { generateNodeId, generateRuleGroupId, generateDataRuleId, generateButtonUuid } = require('./integration-node-ids');
const {
  mapEventTypes,
  buildTriggerCondition,
  buildDataRetrieveCondition,
  buildDataCreateAssignments,
  buildConnectorCallAssignments,
} = require('./integration-process-builder');
const { buildAddDataChildList } = require('./integration-view-builder');
const {
  lookupConnectorPreset,
  buildConnectorRulesFromInputs,
  buildFallbackInputsFromAssignments,
} = require('./connector-presets');

function readIntegrationSpec(filePath) {
  const resolved = path.resolve(filePath);
  const raw = fs.readFileSync(resolved, 'utf8').replace(/^\uFEFF/u, '');
  const spec = JSON.parse(raw);
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error('--spec must point to a JSON object');
  }
  return spec;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getSpecNodes(spec) {
  return asArray(spec.nodes || spec.flow || spec.steps);
}

function getSpecEventInput(spec, fallbackEvents = ['insert']) {
  const events = Array.isArray(spec.events)
    ? spec.events
    : Array.isArray(spec.formEventTypes)
      ? spec.formEventTypes
      : fallbackEvents;
  return asArray(events).map((event) => String(event).trim()).filter(Boolean);
}

function mapSpecEventTypes(spec, fallbackEvents) {
  return mapEventTypes(getSpecEventInput(spec, fallbackEvents));
}

function validateIntegrationSpec(spec, fallbackEvents = ['insert']) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error('--spec must point to a JSON object');
  }
  if (getSpecNodes(spec).length === 0) {
    throw new Error('integration spec must contain a non-empty nodes array');
  }
  if (mapSpecEventTypes(spec, fallbackEvents).length === 0) {
    throw new Error('integration spec must contain at least one valid event');
  }
}

function normalizeLogic(logic) {
  return String(logic || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND';
}

function conditionCodeFor(logic) {
  return normalizeLogic(logic) === 'OR' ? '||' : '&&';
}

function getNodeAlias(node, fallback) {
  return node.id || node.key || fallback;
}

function registerNodeId(node, context, prefix) {
  if (node._nodeId) {
    return node._nodeId;
  }
  const alias = getNodeAlias(node, `${prefix}_${context.generatedIndex++}`);
  const existing = context.aliasToNodeId.get(alias);
  if (existing) {
    throw new Error(`Duplicate integration spec node alias: ${alias}`);
  }
  const nodeId = node.nodeId || generateNodeId();
  node._nodeId = nodeId;
  context.aliasToNodeId.set(alias, nodeId);
  context.nodeIdToAlias.set(nodeId, alias);
  return nodeId;
}

function preRegisterSpecNodes(nodes, context) {
  for (const node of asArray(nodes)) {
    const type = normalizeNodeType(node.type || node.componentName) || 'node';
    registerNodeId(node, context, type);
    if (type === 'route') {
      for (const branch of asArray(node.branches || node.conditions)) {
        registerNodeId(branch, context, 'condition');
        preRegisterSpecNodes(branch.nodes || branch.childNodes || branch.children, context);
      }
    }
  }
}

function resolveAlias(value, context) {
  if (!value) {
    return value;
  }
  return context.aliasToNodeId.get(value) || value;
}

function resolveNodeRefs(value, context) {
  if (typeof value !== 'string') {
    return value;
  }
  return value.replace(/\$\{([^}.]+)\}/g, (match, alias) => {
    const nodeId = context.aliasToNodeId.get(alias);
    return nodeId ? `\${${nodeId}}` : match;
  });
}

function normalizeToUsers(value, fallback = []) {
  const raw = value === undefined ? fallback : value;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((item) => {
    if (typeof item === 'string') {
      return { userId: item, userName: '' };
    }
    if (item && typeof item === 'object' && item.userId) {
      return { userId: item.userId, userName: item.userName || '' };
    }
    return null;
  }).filter(Boolean);
}

function normalizeDataConditions(conditions, context) {
  return asArray(conditions).map((condition) => ({
    bFieldId: resolveNodeRefs(condition.bFieldId || condition.fieldId || condition.id, context),
    bFieldName: condition.bFieldName || condition.fieldName || condition.name || condition.label || condition.bFieldId || condition.fieldId,
    aFieldId: resolveNodeRefs(condition.aFieldId || condition.value || condition.ruleValue, context),
    componentType: condition.componentType || 'TextField',
    opCode: condition.opCode || condition.op || 'Contain',
    valueType: condition.valueType || 'processVar',
  })).filter((condition) => condition.bFieldId && condition.aFieldId);
}

function normalizeTriggerConditions(conditions, context) {
  return asArray(conditions).map((condition) => ({
    fieldId: resolveNodeRefs(condition.fieldId || condition.id, context),
    fieldName: condition.fieldName || condition.name || condition.label || condition.fieldId || condition.id,
    opCode: condition.opCode || condition.op || 'Equal',
    value: resolveNodeRefs(condition.value, context),
    componentType: condition.componentType || 'TextField',
    valueType: condition.valueType || 'literal',
  })).filter((condition) => condition.fieldId);
}

function buildConditionObject(conditions, logic, context) {
  let conditionRules = conditions;
  let conditionLogic = logic;
  if (conditions && typeof conditions === 'object' && !Array.isArray(conditions)) {
    conditionRules = conditions.rules || conditions.conditions || [];
    conditionLogic = conditions.logic || conditions.condition || logic;
  }
  const normalized = normalizeTriggerConditions(conditionRules, context);
  if (normalized.length === 0) {
    return {
      condition: normalizeLogic(conditionLogic),
      rules: [],
      ruleId: generateRuleGroupId(),
      conditionCode: conditionCodeFor(conditionLogic),
    };
  }
  return buildTriggerCondition(normalized, conditionLogic);
}

function normalizeAssignments(assignments, context) {
  return asArray(assignments).map((assignment) => ({
    column: assignment.column || assignment.fieldId || assignment.targetField,
    valueType: assignment.valueType || 'literal',
    value: resolveNodeRefs(assignment.value, context),
    __display: assignment.__display,
    __source: assignment.__source ? resolveNodeRefs(assignment.__source, context) : undefined,
  })).filter((assignment) => assignment.column);
}

function buildUpdateAssignments(assignments, context) {
  return normalizeAssignments(assignments, context).map((assignment) => {
    const value = assignment.valueType === 'literal' && !isNaN(Number(assignment.value))
      ? Number(assignment.value)
      : assignment.value;
    const result = {
      column: assignment.column,
      valueType: assignment.valueType,
      value,
      assignments: [],
    };
    if (assignment.__display) {
      result.__display = assignment.__display;
    }
    if (assignment.__source) {
      result.__source = assignment.__source;
    }
    return result;
  });
}

function buildMessageProcessNode(node, nodeId, nextNodeId, context) {
  const title = node.title || context.defaultNotificationTitle || context.flowName;
  const content = node.content || context.defaultNotificationContent || '表单有新记录提交，请及时查看。';
  const toUsers = normalizeToUsers(node.receivers || node.toUsers, context.defaultToUsers);
  const userFields = Array.isArray(node.userFields) ? node.userFields : context.defaultUserFields;
  return {
    name: { zh_CN: node.name || '消息通知', en_US: '' },
    description: node.description || '请设置消息通知',
    type: 'sendMessage',
    nodeId,
    prevId: '',
    nextId: [nextNodeId],
    props: {
      template: { templateName: '' },
      messageType: node.messageType || 'NORMAL',
      messageInfo: {
        title,
        content,
        buttons: [
          {
            name: node.buttonName || '查看详情',
            type: 'commit',
            value: node.buttonUrl || `//yidalogin.aliwork.com/${context.appType}/formDetail/${context.formUuid}?formInstId=\${formInstId}`,
            buttonUuid: generateButtonUuid(),
          },
        ],
      },
      appType: context.appType,
      toRoles: [],
      toUsers,
      userFields: Array.isArray(userFields) && userFields.length > 0 ? userFields : ['form_inst_creator'],
    },
    childNodes: [],
  };
}

function buildMessageViewNode(node, nodeId, context) {
  const title = node.title || context.defaultNotificationTitle || context.flowName;
  const content = node.content || context.defaultNotificationContent || '表单有新记录提交，请及时查看。';
  const toUsers = normalizeToUsers(node.receivers || node.toUsers, context.defaultToUsers);
  const userFields = Array.isArray(node.userFields) ? node.userFields : context.defaultUserFields;
  return {
    componentName: 'SendMessageNode',
    id: nodeId,
    props: {
      nodeName: 'SendMessageNode',
      name: node.name || '消息通知',
      description: node.description || '请设置消息通知',
      sendMessageRules: {
        template: { templateName: '' },
        messageType: node.messageType || 'NORMAL',
        messageInfo: {
          title,
          content,
          buttons: [
            {
              name: node.buttonName || '查看详情',
              type: 'commit',
              value: node.buttonUrl || `//yidalogin.aliwork.com/${context.appType}/formDetail/${context.formUuid}?formInstId=\${formInstId}`,
              buttonUuid: generateButtonUuid(),
            },
          ],
        },
        appType: context.appType,
        toRoles: [],
        toUsers,
        userFields: Array.isArray(userFields) && userFields.length > 0 ? userFields : ['form_inst_modifier'],
        description: node.description || '发送工作通知',
      },
    },
    title: node.name || '消息通知',
  };
}

function buildDataRetrieveProcessNode(node, nodeId, nextNodeId, context) {
  const formUuid = node.formUuid || node.sourceId || (node.type === 'getSelf' ? context.formUuid : undefined);
  const rawConditions = node.type === 'getSelf' || node.getSelf
    ? [{
      bFieldId: node.queryField || 'pid',
      bFieldName: '表单实例ID',
      aFieldId: node.triggerField || '__masterdata_form_inst_id',
      componentType: 'TextField',
      opCode: 'Equal',
      valueType: 'processVar',
    }]
    : normalizeDataConditions(node.conditions || node.dataConditions, context);
  const conditions = rawConditions.length > 0
    ? buildDataRetrieveCondition(rawConditions, node.logic || node.conditionLogic)
    : { condition: 'AND', rules: [], ruleId: generateRuleGroupId(), conditionCode: '&&' };
  return {
    name: { zh_CN: node.name || '获取单条数据', en_US: '' },
    description: node.description || '请设置想要获取的数据',
    type: 'dataRetrieve',
    nodeId,
    prevId: '',
    nextId: [nextNodeId],
    props: {
      type: 'single',
      filterType: 'condition',
      sort: node.sort || { type: 'none', column: '' },
      sourceId: formUuid,
      appType: context.appType,
      originalType: node.originalType || 'form',
      subSourceId: node.subSourceId || '',
      condition: conditions,
      quantity: String(node.quantity || '1'),
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
  };
}

function buildDataRetrieveViewNode(node, nodeId, context) {
  const processNode = buildDataRetrieveProcessNode(node, nodeId, nodeId, context);
  const props = processNode.props;
  return {
    componentName: 'GetSingleDataNode',
    id: nodeId,
    props: {
      nodeName: 'GetSingleDataNode',
      name: node.name || '获取单条数据',
      description: node.description || '请设置想要获取的数据',
      type: 'single',
      getData: {
        type: 'single',
        originalType: props.originalType,
        appType: context.appType,
        sourceId: props.sourceId,
        targetItem: {
          appType: context.appType,
          appName: '',
          formItem: {
            formType: 'receipt',
            advanceProc: 'n',
            formUuid: props.sourceId,
            title: '',
            fields: null,
            hasTableField: null,
          },
        },
        subSourceId: props.subSourceId,
        relativeItem: {},
        filterType: 'condition',
        condition: props.condition,
        sort: props.sort,
        rulesFilter: [],
        outputs: [],
        quantity: Number(props.quantity || 1),
        dataRules: props.dataRules,
        assignments: [],
      },
      title: node.name || '获取单条数据',
    },
  };
}

function buildDataCreateProcessNode(node, nodeId, nextNodeId, context) {
  const formUuid = node.formUuid || node.targetFormUuid;
  return {
    name: { zh_CN: node.name || '新增数据', en_US: '' },
    description: node.description || '请设置新增数据',
    type: 'dataCreate',
    nodeId,
    prevId: '',
    nextId: [nextNodeId],
    props: {
      formUuid,
      appType: context.appType,
      subFormUuid: node.subFormUuid || '',
      insertType: node.insertType || 'form',
      type: node.createType || 'single',
      sourceId: node.sourceId || '',
      assignments: buildDataCreateAssignments(normalizeAssignments(node.assignments, context)),
    },
    childNodes: [],
  };
}

function buildDataCreateViewNode(node, nodeId, context) {
  const formUuid = node.formUuid || node.targetFormUuid;
  const schemaComponents = context.formSchemasByUuid.get(formUuid) || [];
  const childList = buildAddDataChildList(schemaComponents);
  const componentOptionMap = {};
  childList.forEach((item) => {
    componentOptionMap[item.fieldId] = '[]';
  });
  const assignmentRules = normalizeAssignments(node.assignments, context).map((assignment) => {
    const matchedField = childList.find((item) => item.fieldId === assignment.column);
    return {
      name: assignment.column,
      componentName: matchedField ? matchedField.componentName : 'TextField',
      valueType: assignment.valueType,
      value: assignment.valueType === 'literal' && !isNaN(Number(assignment.value))
        ? Number(assignment.value)
        : assignment.value,
      required: false,
      ruleId: generateDataRuleId(),
      componentOption: '[]',
      label: matchedField ? matchedField.label : assignment.column,
      componentProps: {
        defaultDataSource: {},
        relateAppType: '',
        relateOrderEnable: false,
        relateOrderConfig: [],
      },
    };
  });
  return {
    componentName: 'AddDataNode',
    id: nodeId,
    props: {
      nodeName: 'AddDataNode',
      name: node.name || '新增数据',
      description: node.description || `在[${node.formName || '目标表单'}]中新增数据`,
      addDataRules: {
        formUuid,
        appType: context.appType,
        insertType: node.insertType || 'form',
        type: node.createType || 'single',
        subFormUuid: node.subFormUuid || '',
        sourceId: node.sourceId || '',
        assignments: [],
        inputs: { childList, componentOptionMap },
        rules: {
          childList,
          componentOptionMap,
          ruleId: generateDataRuleId(),
          rules: assignmentRules,
        },
      },
    },
    title: node.name || '新增数据',
  };
}

function buildDataUpdateRules(node, context) {
  const sourceId = resolveAlias(node.source || node.sourceId || node.from, context) || '';
  const updateType = node.updateType || node.updateMode || (sourceId ? 'node' : 'condition');
  const condition = node.condition
    ? buildConditionObject(node.condition, node.logic, context)
    : {};
  return {
    type: updateType,
    sourceId,
    subSourceId: node.subSourceId || '',
    condition,
    subCondition: node.subCondition || {},
    assignments: buildUpdateAssignments(node.assignments || node.updateAssignments, context),
    noneOperation: node.noneOperation || 'ignored',
    rulesFilter: node.rulesFilter || [],
    tableRulesFilter: node.tableRulesFilter || [],
  };
}

function buildDataUpdateProcessNode(node, nodeId, nextNodeId, context) {
  return {
    name: { zh_CN: node.name || '更新数据', en_US: '' },
    description: node.description || '请设置更新数据',
    type: 'dataUpdate',
    nodeId,
    prevId: '',
    nextId: [nextNodeId],
    props: buildDataUpdateRules(node, context),
    childNodes: [],
  };
}

function buildDataUpdateViewNode(node, nodeId, context) {
  const rules = buildDataUpdateRules(node, context);
  return {
    componentName: 'UpdateDataNode',
    id: nodeId,
    props: {
      nodeName: 'UpdateDataNode',
      name: node.name || '更新数据',
      description: node.description || '请设置更新数据',
      updateDataRules: rules,
    },
    title: node.name || '更新数据',
  };
}

function buildConnectorProcessNode(node, nodeId, nextNodeId, context) {
  return {
    name: { zh_CN: node.name || '连接器', en_US: '' },
    description: node.description || '请选择连接器',
    type: 'innerConnector',
    nodeId,
    prevId: '',
    nextId: [nextNodeId],
    props: {
      inputs: {
        url: '',
        method: '',
        body: '',
        connection: '',
        connectorId: node.connectorId,
        actionId: node.actionId,
        assignments: buildConnectorCallAssignments(normalizeAssignments(node.assignments || node.connectorAssignments, context)),
      },
    },
    childNodes: [],
  };
}

function buildConnectorViewNode(node, nodeId, context) {
  let normalizedInputs = Array.isArray(node.inputs) ? node.inputs : [];
  let normalizedOutputs = [];
  let presetDescription = '';
  let presetSchemaType = 'normal';
  if (normalizedInputs.length === 0) {
    const preset = lookupConnectorPreset(node.connectorId, node.actionId);
    if (preset && preset.inputs && preset.inputs.length > 0) {
      normalizedInputs = preset.inputs;
      normalizedOutputs = preset.outputs || [];
      presetDescription = preset.description || '';
      presetSchemaType = preset.openDevSchemaType || 'normal';
    } else {
      normalizedInputs = buildFallbackInputsFromAssignments(normalizeAssignments(node.assignments || node.connectorAssignments, context));
    }
  }
  const assignments = normalizeAssignments(node.assignments || node.connectorAssignments, context);
  const connectorRulesArray = buildConnectorRulesFromInputs(normalizedInputs, assignments);
  const connectorDisplayName = node.name || '连接器';
  return {
    componentName: 'ConnectorNode',
    id: nodeId,
    props: {
      nodeName: 'ConnectorNode',
      connectorRules: {
        allStepCounts: 2,
        currentStep: 1,
        connectorId: node.connectorId,
        connectionId: '',
        actionId: node.actionId,
        connector: {
          config: null,
          connectorCorpId: '',
          connectorId: node.connectorId,
          containTriggers: null,
          description: connectorDisplayName,
          iconUrl: node.icon || '',
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
      description: node.description || '请选择连接器',
      step: 0,
      status: 'edit',
    },
    title: connectorDisplayName,
  };
}

function buildRouteNode(node, nodeId, exitNodeId, context) {
  const branches = asArray(node.branches || node.conditions);
  const conditionIds = [];
  const conditionProcessNodes = [];
  const conditionViewNodes = [];
  let hasDefault = false;

  branches.forEach((branch, index) => {
    const branchNode = { ...branch, id: branch.id || branch.name || `branch_${index + 1}` };
    const branchId = registerNodeId(branchNode, context, 'condition');
    conditionIds.push(branchId);

    const childResult = buildSpecNodeList(asArray(branch.nodes || branch.childNodes || branch.children), exitNodeId, context);
    const isDefault = Boolean(branch.default || branch.isDefault);
    hasDefault = hasDefault || isDefault;
    const priority = isDefault ? 2147483647 : (branch.priority || index + 1);
    const branchName = branch.name || (isDefault ? '其他情况' : '条件');
    const conditionObject = isDefault
      ? null
      : buildConditionObject(branch.condition || branch.conditions || branch.rules, branch.logic || branch.conditionLogic, context);
    const nextId = childResult.processNodes.length > 0 ? childResult.processNodes[0].nodeId : exitNodeId;

    const props = {
      priority,
      isDefault,
    };
    if (!isDefault) {
      props.conditions = conditionObject;
      props.calculate = 'condition';
    }

    conditionProcessNodes.push({
      name: { zh_CN: branchName, en_US: branchName },
      description: branch.description || '',
      type: 'condition',
      nodeId: branchId,
      prevId: nodeId,
      nextId: [nextId],
      props,
      childNodes: childResult.processNodes,
    });

    const viewProps = isDefault
      ? {
        isDefault: true,
        buttons: [{ name: '关闭' }],
        name: { zh_CN: branchName, en_US: branchName },
        description: branch.description || '',
      }
      : {
        name: { zh_CN: branchName, en_US: branchName },
        description: branch.description || '',
        conditions: {
          calculate: 'condition',
          conditions: conditionObject,
          isDefault: false,
          priority,
          description: branch.description || branchName,
        },
      };
    const viewNode = {
      componentName: 'ConditionNode',
      id: branchId,
      props: viewProps,
    };
    if (childResult.viewNodes.length > 0) {
      viewNode.children = childResult.viewNodes;
    }
    conditionViewNodes.push(viewNode);
  });

  if (!hasDefault) {
    const defaultId = generateNodeId();
    conditionIds.push(defaultId);
    conditionProcessNodes.push({
      name: { zh_CN: '其他情况', en_US: 'Other situations' },
      description: '',
      type: 'condition',
      nodeId: defaultId,
      prevId: nodeId,
      nextId: [exitNodeId],
      props: {
        priority: 2147483647,
        isDefault: true,
      },
      childNodes: [],
    });
    conditionViewNodes.push({
      componentName: 'ConditionNode',
      id: defaultId,
      props: {
        isDefault: true,
        buttons: [{ name: '关闭' }],
        name: { zh_CN: '其他情况', en_US: 'Other situations' },
        description: '',
      },
    });
  }

  return {
    processNode: {
      name: { zh_CN: node.name || '条件分支', en_US: node.name || 'Condition' },
      description: node.description || '',
      type: 'route',
      nodeId,
      prevId: '',
      nextId: conditionIds,
      props: { outgoingType: node.outgoingType || 'priority' },
      childNodes: conditionProcessNodes,
    },
    viewNode: {
      componentName: 'ConditionContainer',
      id: nodeId,
      props: {},
      title: node.name || '条件分支',
      children: conditionViewNodes,
    },
  };
}

function normalizeNodeType(type) {
  const normalized = String(type || '').toLowerCase();
  const mapping = {
    getself: 'getSelf',
    'get-self': 'getSelf',
    getdata: 'dataRetrieve',
    dataretrieve: 'dataRetrieve',
    dataretrievenode: 'dataRetrieve',
    createdata: 'dataCreate',
    adddata: 'dataCreate',
    datacreate: 'dataCreate',
    updatedata: 'dataUpdate',
    dataupdate: 'dataUpdate',
    message: 'sendMessage',
    sendmessage: 'sendMessage',
    connector: 'connector',
    innerconnector: 'connector',
    route: 'route',
    condition: 'route',
  };
  return mapping[normalized] || type;
}

function buildSpecNode(node, nextNodeId, context) {
  const type = normalizeNodeType(node.type || node.componentName);
  const nodeId = registerNodeId(node, context, type || 'node');
  if (type === 'getSelf' || type === 'dataRetrieve') {
    return {
      processNode: buildDataRetrieveProcessNode({ ...node, type }, nodeId, nextNodeId, context),
      viewNode: buildDataRetrieveViewNode({ ...node, type }, nodeId, context),
    };
  }
  if (type === 'dataCreate') {
    return {
      processNode: buildDataCreateProcessNode(node, nodeId, nextNodeId, context),
      viewNode: buildDataCreateViewNode(node, nodeId, context),
    };
  }
  if (type === 'dataUpdate') {
    return {
      processNode: buildDataUpdateProcessNode(node, nodeId, nextNodeId, context),
      viewNode: buildDataUpdateViewNode(node, nodeId, context),
    };
  }
  if (type === 'sendMessage') {
    return {
      processNode: buildMessageProcessNode(node, nodeId, nextNodeId, context),
      viewNode: buildMessageViewNode(node, nodeId, context),
    };
  }
  if (type === 'connector') {
    return {
      processNode: buildConnectorProcessNode(node, nodeId, nextNodeId, context),
      viewNode: buildConnectorViewNode(node, nodeId, context),
    };
  }
  if (type === 'route') {
    return buildRouteNode(node, nodeId, nextNodeId, context);
  }
  throw new Error(`Unsupported integration spec node type: ${node.type || node.componentName}`);
}

function buildSpecNodeList(nodes, exitNodeId, context) {
  const normalizedNodes = asArray(nodes);
  const processNodes = [];
  const viewNodes = [];
  for (let index = normalizedNodes.length - 1; index >= 0; index--) {
    const node = normalizedNodes[index];
    const nextNodeId = processNodes.length > 0 ? processNodes[0].nodeId : exitNodeId;
    const built = buildSpecNode(node, nextNodeId, context);
    processNodes.unshift(built.processNode);
    viewNodes.unshift(built.viewNode);
  }
  return { processNodes, viewNodes };
}

function buildStartNodes(spec, context, triggerNodeId, firstNodeId) {
  const formEventTypes = mapSpecEventTypes(spec, context.defaultFormEventTypes);
  if (formEventTypes.length === 0) {
    throw new Error('integration spec must contain at least one valid event');
  }
  const triggerConditions = asArray(spec.triggerConditions);
  const triggerConditionObject = triggerConditions.length > 0
    ? buildTriggerCondition(normalizeTriggerConditions(triggerConditions, context), spec.triggerConditionLogic || 'AND')
    : null;
  const startFormEventTypes = formEventTypes;
  const processNode = {
    name: {
      en_US: 'Form event trigger',
      zh_CN: '表单事件触发',
      type: 'i18n',
    },
    description: '',
    type: 'trigger',
    nodeId: triggerNodeId,
    prevId: '',
    nextId: [firstNodeId],
    props: {
      inputs: {
        formEventType: formEventTypes,
        formEventField: '',
        formUuid: context.formUuid,
        conditions: triggerConditionObject,
        activityAction: asArray(spec.approvalActions),
        triggerFormEventRecursively: Boolean(spec.triggerRecursively),
        activityId: asArray(spec.approvalNodeIds),
        activityTask: [],
      },
      triggerType: 'FormEvent',
    },
    childNodes: [],
  };
  const viewNode = {
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
        formEventType: startFormEventTypes,
        formEventField: '',
        dataFilterType: triggerConditions.length > 0 ? 'byRule' : 'all',
        fieldType: 'all',
        conditions: triggerConditionObject || {
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
        formUuid: context.formUuid,
        triggerType: 'FormEvent',
        type: 'form',
        triggerFormEventRecursively: Boolean(spec.triggerRecursively),
        examineApproveNode: '',
        examineApproveActiveList: asArray(spec.approvalActions),
        examineApproveActiveTask: [],
      },
    },
  };
  return { processNode, viewNode, formEventTypes };
}

function buildFinishNodes(endNodeId) {
  return {
    processNode: {
      name: { en_US: 'end', zh_CN: '结束', type: 'i18n' },
      description: '',
      type: 'finish',
      nodeId: endNodeId,
      prevId: '',
      nextId: [],
      props: {},
      childNodes: [],
    },
    viewNode: {
      componentName: 'EndNode',
      id: endNodeId,
      props: {
        name: { en_US: 'end', zh_CN: '结束', type: 'i18n' },
      },
    },
  };
}

function buildSpecProcessAndViewJson(options) {
  const spec = options.spec || {};
  validateIntegrationSpec(spec, options.formEventTypes || ['insert']);
  const nodes = getSpecNodes(spec);

  const context = {
    appType: options.appType,
    formUuid: options.formUuid,
    flowName: options.flowName || '',
    defaultFormEventTypes: options.formEventTypes || ['insert'],
    defaultNotificationTitle: options.notificationTitle,
    defaultNotificationContent: options.notificationContent,
    defaultToUsers: options.toUsers || [],
    defaultUserFields: options.userFields || [],
    formSchemasByUuid: options.formSchemasByUuid || new Map(),
    aliasToNodeId: new Map(),
    nodeIdToAlias: new Map(),
    generatedIndex: 1,
  };
  const canvasId = options.canvasId || generateNodeId();
  const triggerNodeId = options.triggerNodeId || generateNodeId();
  const endNodeId = options.endNodeId || generateNodeId();

  preRegisterSpecNodes(nodes, context);
  const middle = buildSpecNodeList(nodes, endNodeId, context);
  const firstNodeId = middle.processNodes.length > 0 ? middle.processNodes[0].nodeId : endNodeId;
  const start = buildStartNodes(spec, context, triggerNodeId, firstNodeId);
  const finish = buildFinishNodes(endNodeId);

  return {
    processJson: {
      props: {
        allowWithdraw: true,
        allowCollaboration: true,
        allowTemporaryStorage: true,
        processCode: options.processCode,
      },
      nodes: [start.processNode, ...middle.processNodes, finish.processNode],
    },
    viewJson: {
      schema: {
        componentName: 'CanvasEngine',
        id: canvasId,
        props: {},
        children: [start.viewNode, ...middle.viewNodes, finish.viewNode],
      },
      globalSetting: {},
    },
    formEventTypes: start.formEventTypes,
    nodeIdMap: Object.fromEntries(context.aliasToNodeId.entries()),
  };
}

function collectAddDataFormUuids(spec) {
  const result = new Set();
  function visit(nodes) {
    for (const node of asArray(nodes)) {
      const type = normalizeNodeType(node.type || node.componentName);
      if (type === 'dataCreate') {
        const formUuid = node.formUuid || node.targetFormUuid;
        if (formUuid) {
          result.add(formUuid);
        }
      }
      if (type === 'route') {
        for (const branch of asArray(node.branches || node.conditions)) {
          visit(branch.nodes || branch.childNodes || branch.children);
        }
      }
    }
  }
  visit(getSpecNodes(spec));
  return Array.from(result);
}

module.exports = {
  readIntegrationSpec,
  validateIntegrationSpec,
  buildSpecProcessAndViewJson,
  collectAddDataFormUuids,
  _private: {
    getSpecNodes,
    mapSpecEventTypes,
    normalizeNodeType,
    resolveNodeRefs,
    buildSpecNodeList,
    buildDataUpdateRules,
  },
};
