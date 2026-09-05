'use strict';

const fs = require('fs');
const path = require('path');
const { generateNodeId, generateRuleGroupId, generateDataRuleId, generateButtonUuid } = require('./integration-node-ids');
const {
  mapEventTypes,
  buildTriggerCondition,
  buildDataRetrieveCondition,
  buildDataCreateAssignments,
  buildInitiateApprovalAssignments,
  buildConnectorCallAssignments,
  buildApprovalTriggerState,
  getFirstNonNullishOwnValue,
  normalizeUserFields,
  resolveConnectorMode,
  validateAssignments,
} = require('./integration-process-builder');
const {
  buildAddDataChildList,
  buildSubTableAddDataChildList,
  resolveTableFieldLabel,
  listTableFieldSummaries,
  buildSubTableRelativeItem,
  assertAssignmentFieldsExist,
} = require('./integration-view-builder');
const {
  lookupConnectorPreset,
  buildConnectorRulesFromInputs,
} = require('./connector-presets');
const { t } = require('../core/i18n');

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

function validateIntegrationSpec(spec, fallbackEvents = ['insert'], options = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error('--spec must point to a JSON object');
  }
  if (getSpecNodes(spec).length === 0) {
    throw new Error('integration spec must contain a non-empty nodes array');
  }
  if (mapSpecEventTypes(spec, fallbackEvents).length === 0) {
    throw new Error('integration spec must contain at least one valid event');
  }
  const aliases = new Set();
  function validateNodes(nodes) {
    for (const node of asArray(nodes)) {
      if (!node || typeof node !== 'object' || Array.isArray(node)) {
        throw new Error('integration spec nodes must be objects');
      }
      const type = normalizeNodeType(node.type || node.componentName);
      if (!['getSelf', 'dataRetrieve', 'dataCreate', 'dataUpdate', 'sendMessage', 'initiateApproval', 'connector', 'route'].includes(type)) {
        throw new Error(`Unsupported integration spec node type: ${node.type || node.componentName}`);
      }
      const explicitAlias = node.id || node.key;
      if (explicitAlias) {
        if (aliases.has(explicitAlias)) {
          throw new Error(`Duplicate integration spec node alias: ${explicitAlias}`);
        }
        aliases.add(explicitAlias);
      }
      if (type === 'dataRetrieve') {
        if (isSubTableRetrieve(node)) {
          if (!getSourceAlias(node) || !node.subSourceId) {
            throw new Error('dataRetrieve sub_table node source and subSourceId are required');
          }
        } else if (!(node.formUuid || node.sourceId)) {
          throw new Error('dataRetrieve node formUuid is required');
        }
      }
      if (type === 'dataRetrieve' && asArray(node.conditions || node.dataConditions).length === 0) {
        throw new Error(t('integration.spec_data_retrieve_conditions_required'));
      }
      if (type === 'dataCreate') {
        if (isSubTableInsert(node)) {
          if (!getSourceAlias(node) || !node.subFormUuid) {
            throw new Error('dataCreate sub_table node source and subFormUuid are required');
          }
        } else if (!(node.formUuid || node.targetFormUuid)) {
          throw new Error('dataCreate node formUuid is required');
        }
        validateAssignments(asArray(node.assignments), 'dataCreate assignment');
        if (asArray(node.assignments).length === 0) {
          throw new Error(t('integration.spec_data_create_assignments_required'));
        }
      }
      if (type === 'dataUpdate') {
        const assignments = asArray(node.assignments || node.updateAssignments);
        validateAssignments(assignments, 'dataUpdate assignment');
        if (assignments.length === 0) {
          throw new Error(t('integration.spec_data_update_assignments_required'));
        }
        if (!(node.source || node.sourceId || node.from || node.condition)) {
          throw new Error('dataUpdate node source or condition is required');
        }
      }
      if (type === 'sendMessage') {
        if (!node.content) {
          throw new Error('sendMessage node content is required');
        }
      }
      if (type === 'initiateApproval') {
        if (!(node.formUuid || node.targetFormUuid)) {
          throw new Error(t('integration.spec_approval_form_required'));
        }
        const assignments = asArray(node.assignments || node.initiateApprovalAssignments);
        validateAssignments(assignments, 'initiateApproval assignment');
        if (assignments.length === 0) {
          throw new Error(t('integration.spec_approval_assignments_required'));
        }
        const initiator = node.initiator;
        if (!initiator || !['current_user', 'select_user'].includes(initiator.type)) {
          throw new Error(t('integration.spec_approval_initiator_type'));
        }
        if (initiator.type === 'select_user' && !initiator.value) {
          throw new Error(t('integration.spec_approval_initiator_value_required'));
        }
        if (initiator.type === 'select_user') {
          let identity;
          try {
            identity = typeof initiator.value === 'string'
              ? JSON.parse(initiator.value)
              : null;
          } catch (_error) {
            identity = null;
          }
          if (!identity || typeof identity !== 'object' || Array.isArray(identity)
            || typeof identity.id !== 'string' || !identity.id.trim()
            || identity.type !== 'employee') {
            throw new Error(t('integration.spec_approval_initiator_identity_invalid'));
          }
        }
      }
      if (type === 'connector') {
        if (!node.connectorId || !node.actionId) {
          throw new Error('connector node connectorId and actionId are required');
        }
        validateAssignments(asArray(node.assignments || node.connectorAssignments), 'connector assignment');
      }
      if (type === 'route') {
        const branches = asArray(node.branches || node.conditions);
        if (branches.length === 0) {
          throw new Error(t('integration.spec_route_branches_required'));
        }
        const defaultCount = branches.filter((branch) => Boolean(branch.default || branch.isDefault)).length;
        if (defaultCount > 1) {
          throw new Error('route node must contain at most one default branch');
        }
        for (const branch of branches) {
          if (!branch.default && !branch.isDefault) {
            const condition = branch.condition || branch.conditions || branch.rules;
            const rules = condition && !Array.isArray(condition)
              ? asArray(condition.rules || condition.conditions)
              : asArray(condition);
            if (rules.length === 0) {
              throw new Error('non-default route branch conditions are required');
            }
          }
          validateNodes(branch.nodes || branch.childNodes || branch.children);
        }
      }
    }
  }
  validateNodes(getSpecNodes(spec));
  assertSubTableSources(spec, options.formUuid || options.triggerFormUuid);
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

function isSubTableValue(value) {
  return String(value || '').trim().toLowerCase() === 'sub_table';
}

function isSubTableRetrieve(node = {}) {
  return isSubTableValue(node.originalType);
}

function isSubTableInsert(node = {}) {
  return isSubTableValue(node.insertType);
}

function getSourceAlias(node = {}) {
  return node.source || node.from || '';
}

const SUB_TABLE_SOURCE_TYPES = new Set(['getSelf', 'dataRetrieve']);

function getNodeType(node = {}) {
  return normalizeNodeType(node.type || node.componentName);
}

function getDeclaredAlias(node = {}) {
  return node.id || node.key || '';
}

function collectBranchNodes(branch) {
  return branch && (branch.nodes || branch.childNodes || branch.children);
}

function indexSpecNodesByAlias(spec) {
  const byAlias = new Map();
  visitSpecNodes(spec, (node) => {
    const alias = getDeclaredAlias(node);
    if (alias && !byAlias.has(alias)) {
      byAlias.set(alias, node);
    }
  });
  return byAlias;
}

function collectUpstreamAliasMaps(spec) {
  const upstreamByNode = new WeakMap();
  function visit(nodes, inheritedUpstream) {
    const seen = new Map(inheritedUpstream);
    for (const node of asArray(nodes)) {
      if (!node || typeof node !== 'object') {
        continue;
      }
      upstreamByNode.set(node, new Map(seen));
      const type = getNodeType(node);
      if (type === 'route') {
        const branchUpstream = new Map(seen);
        const routeAlias = getDeclaredAlias(node);
        if (routeAlias) {
          branchUpstream.set(routeAlias, node);
        }
        for (const branch of asArray(node.branches || node.conditions)) {
          visit(collectBranchNodes(branch), branchUpstream);
        }
      }
      const alias = getDeclaredAlias(node);
      if (alias) {
        seen.set(alias, node);
      }
    }
  }
  visit(getSpecNodes(spec), new Map());
  return upstreamByNode;
}

function assertSubTableSources(spec, triggerFormUuid) {
  const nodesByAlias = indexSpecNodesByAlias(spec);
  const upstreamByNode = collectUpstreamAliasMaps(spec);
  visitSpecNodes(spec, (node) => {
    if (!isSubTableRetrieve(node) && !isSubTableInsert(node)) {
      return;
    }
    const sourceAlias = getSourceAlias(node);
    if (!sourceAlias) {
      return;
    }
    const sourceNode = nodesByAlias.get(sourceAlias);
    if (!sourceNode) {
      throw new Error(`Unknown integration spec node alias: ${sourceAlias}`);
    }
    const sourceType = getNodeType(sourceNode);
    if (!SUB_TABLE_SOURCE_TYPES.has(sourceType)) {
      throw new Error(
        `sub_table source must be a getSelf or dataRetrieve node: ${sourceAlias}`
      );
    }
    const upstream = upstreamByNode.get(node);
    if (!upstream || !upstream.has(sourceAlias)) {
      throw new Error(`sub_table source must be an upstream node: ${sourceAlias}`);
    }
    resolveSubTableParentFormUuidFromSource(node, sourceNode, triggerFormUuid);
  });
}

function visitSpecNodes(spec, visitor) {
  function visit(nodes) {
    for (const node of asArray(nodes)) {
      if (!node || typeof node !== 'object') {
        continue;
      }
      visitor(node);
      const type = normalizeNodeType(node.type || node.componentName);
      if (type === 'route') {
        for (const branch of asArray(node.branches || node.conditions)) {
          visit(branch && (branch.nodes || branch.childNodes || branch.children));
        }
      }
    }
  }
  visit(getSpecNodes(spec));
}

function findSpecNodeByAlias(spec, alias) {
  if (!alias) {
    return null;
  }
  let found = null;
  visitSpecNodes(spec, (node) => {
    if (!found && (node.id || node.key) === alias) {
      found = node;
    }
  });
  return found;
}

function inferSubTableParentFormUuid(sourceNode, triggerFormUuid) {
  if (!sourceNode) {
    return '';
  }
  if (getNodeType(sourceNode) === 'getSelf') {
    return triggerFormUuid || '';
  }
  return sourceNode.formUuid || sourceNode.sourceId || sourceNode.targetFormUuid || '';
}

function resolveSubTableParentFormUuidFromSource(node, sourceNode, triggerFormUuid) {
  const inferred = inferSubTableParentFormUuid(sourceNode, triggerFormUuid);
  const explicit = node.parentFormUuid ? String(node.parentFormUuid) : '';
  if (explicit && inferred && explicit !== String(inferred)) {
    throw new Error(
      `sub_table parentFormUuid must match the source form: ${explicit} != ${inferred}`
    );
  }
  return explicit || inferred || '';
}

function resolveSubTableParentFormUuid(node, spec, triggerFormUuid) {
  return resolveSubTableParentFormUuidFromSource(
    node,
    findSpecNodeByAlias(spec, getSourceAlias(node)),
    triggerFormUuid
  );
}

function resolveContextSourceNode(node, context) {
  const sourceAlias = getSourceAlias(node);
  if (!sourceAlias || !context.aliasToSpecNode) {
    return null;
  }
  return context.aliasToSpecNode.get(sourceAlias) || null;
}

function resolveSubTableParentFormUuidFromContext(node, context) {
  return resolveSubTableParentFormUuidFromSource(
    node,
    resolveContextSourceNode(node, context),
    context.formUuid
  );
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
  if (context.aliasToSpecNode) {
    context.aliasToSpecNode.set(alias, node);
  }
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
  const nodeId = context.aliasToNodeId.get(value);
  if (!nodeId) {
    throw new Error(`Unknown integration spec node alias: ${value}`);
  }
  return nodeId;
}

function resolveNodeRefs(value, context) {
  if (typeof value !== 'string') {
    return value;
  }
  return value.replace(/\$\{([^}.]+)\}/g, (match, alias) => {
    const nodeId = context.aliasToNodeId.get(alias);
    if (!nodeId) {
      throw new Error(`Unknown integration spec node alias: ${alias}`);
    }
    return `\${${nodeId}}`;
  });
}

function resolveDesignerSourceRefs(value, context) {
  if (typeof value !== 'string') {
    return value;
  }
  return value.replace(/#\{([^}/]+)\/\/([^}]+)\}/g, (match, alias, fieldId) => {
    const nodeId = context.aliasToNodeId.get(alias);
    if (nodeId) {
      return `#{${nodeId}//${fieldId}}`;
    }
    if (context.nodeIdToAlias && context.nodeIdToAlias.has(alias)) {
      return match;
    }
    throw new Error(`Unknown integration spec node alias: ${alias}`);
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
  return asArray(conditions).map((condition) => {
    const bFieldId = condition.bFieldId || condition.fieldId || condition.id;
    const conditionValue = getFirstNonNullishOwnValue(condition, ['aFieldId', 'value', 'ruleValue']);
    if (!bFieldId || !conditionValue.found) {
      throw new Error('dataRetrieve condition field and value are required');
    }
    const valueType = condition.valueType || 'processVar';
    if (!['literal', 'processVar', 'column'].includes(valueType)) {
      throw new Error(`dataRetrieve condition valueType is unsupported: ${valueType}`);
    }
    return {
      bFieldId: resolveNodeRefs(bFieldId, context),
      bFieldName: condition.bFieldName || condition.fieldName || condition.name || condition.label || bFieldId,
      aFieldId: resolveNodeRefs(conditionValue.value, context),
      componentType: condition.componentType || 'TextField',
      opCode: condition.opCode || condition.op || 'Contain',
      valueType,
    };
  });
}

function normalizeTriggerConditions(conditions, context) {
  return asArray(conditions).map((condition) => {
    const fieldId = condition.fieldId || condition.id;
    if (!fieldId) {
      throw new Error('trigger or route condition field is required');
    }
    const valueType = condition.valueType || 'literal';
    if (!['literal', 'processVar', 'column'].includes(valueType)) {
      throw new Error(`condition valueType is unsupported: ${valueType}`);
    }
    return {
      fieldId: resolveNodeRefs(fieldId, context),
      fieldName: condition.fieldName || condition.name || condition.label || fieldId,
      opCode: condition.opCode || condition.op || 'Equal',
      value: resolveNodeRefs(condition.value, context),
      componentType: condition.componentType || 'TextField',
      valueType,
    };
  });
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
  const normalizedAssignments = asArray(assignments);
  validateAssignments(normalizedAssignments, 'integration spec assignment');
  return normalizedAssignments.map((assignment) => ({
    column: assignment.column || assignment.fieldId || assignment.targetField,
    valueType: assignment.valueType || 'literal',
    value: resolveNodeRefs(assignment.value, context),
    __display: assignment.__display,
    __source: assignment.__source,
  }));
}

function configuredDescription(node, fallback) {
  return node.description || fallback;
}

function resolveInitiator(node, context) {
  if (node.initiator && node.initiator.type === 'current_user') {
    if (!context.currentUserId) {
      throw new Error(t('integration.spec_approval_current_user_required'));
    }
    return {
      type: 'select_user',
      value: JSON.stringify({ id: context.currentUserId, label: '', type: 'employee' }),
    };
  }
  if (node.initiator && node.initiator.type === 'select_user' && node.initiator.value) {
    return node.initiator;
  }
  throw new Error(t('integration.spec_approval_initiator_missing'));
}

function buildUpdateAssignments(assignments, context) {
  return normalizeAssignments(assignments, context).map((assignment) => {
    const source = assignment.__source
      ? resolveDesignerSourceRefs(assignment.__source, context)
      : undefined;
    const result = {
      column: assignment.column,
      valueType: assignment.valueType,
      value: assignment.value,
      assignments: [],
    };
    if (assignment.__display) {
      result.__display = assignment.__display;
    }
    if (source) {
      result.__source = source;
    }
    return result;
  });
}

function buildMessageProcessNode(node, nodeId, nextNodeId, context) {
  const title = resolveNodeRefs(node.title || context.defaultNotificationTitle || context.flowName, context);
  const content = resolveNodeRefs(
    node.content || context.defaultNotificationContent || '表单有新记录提交，请及时查看。',
    context
  );
  const toUsers = normalizeToUsers(node.receivers || node.toUsers, context.defaultToUsers);
  const userFields = Array.isArray(node.userFields) ? node.userFields : context.defaultUserFields;
  if (toUsers.length === 0 && normalizeUserFields(userFields).length === 0) {
    throw new Error('sendMessage node requires at least one declared recipient');
  }
  return {
    name: { zh_CN: node.name || '消息通知', en_US: '' },
    description: node.description || `发送已配置通知（接收对象 ${toUsers.length + normalizeUserFields(userFields).length} 类）`,
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
            value: node.buttonUrl || `//yidalogin.aliwork.com/${context.appType}/formDetail/${context.formUuid}?formInstId=\${formInstId}&isRenderNav=false`,
            buttonUuid: generateButtonUuid(),
          },
        ],
      },
      appType: context.appType,
      toRoles: [],
      toUsers,
      userFields: normalizeUserFields(userFields),
    },
    childNodes: [],
  };
}

function buildMessageViewNode(node, nodeId, context) {
  const title = resolveNodeRefs(node.title || context.defaultNotificationTitle || context.flowName, context);
  const content = resolveNodeRefs(
    node.content || context.defaultNotificationContent || '表单有新记录提交，请及时查看。',
    context
  );
  const toUsers = normalizeToUsers(node.receivers || node.toUsers, context.defaultToUsers);
  const userFields = Array.isArray(node.userFields) ? node.userFields : context.defaultUserFields;
  const description = node.description
    || `发送已配置通知（接收对象 ${toUsers.length + normalizeUserFields(userFields).length} 类）`;
  return {
    componentName: 'SendMessageNode',
    id: nodeId,
    props: {
      nodeName: 'SendMessageNode',
      name: node.name || '消息通知',
      description,
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
              value: node.buttonUrl || `//yidalogin.aliwork.com/${context.appType}/formDetail/${context.formUuid}?formInstId=\${formInstId}&isRenderNav=false`,
              buttonUuid: generateButtonUuid(),
            },
          ],
        },
        appType: context.appType,
        toRoles: [],
        toUsers,
        userFields: normalizeUserFields(userFields),
        description,
      },
    },
    title: node.name || '消息通知',
  };
}

function resolveRetrieveSourceId(node, context) {
  if (isSubTableRetrieve(node)) {
    return resolveAlias(getSourceAlias(node), context);
  }
  return node.formUuid || node.sourceId || (node.type === 'getSelf' ? context.formUuid : undefined);
}

function resolveRetrieveSourceLabel(node, context, sourceId) {
  if (isSubTableRetrieve(node)) {
    const sourceNode = context.aliasToSpecNode && context.aliasToSpecNode.get(getSourceAlias(node));
    return (sourceNode && (sourceNode.name || sourceNode.formName))
      || node.formName
      || getSourceAlias(node);
  }
  return node.formName || context.formNamesByUuid.get(sourceId) || sourceId;
}

function isUsedAsSubTableSource(node, context) {
  const alias = node.id || node.key;
  if (!alias || !context.aliasToSpecNode) {
    return false;
  }
  for (const specNode of context.aliasToSpecNode.values()) {
    if (getSourceAlias(specNode) !== alias) {
      continue;
    }
    if (isSubTableRetrieve(specNode) || isSubTableInsert(specNode)) {
      return true;
    }
  }
  return false;
}

function buildDataRetrieveProcessNode(node, nodeId, nextNodeId, context) {
  const sourceId = resolveRetrieveSourceId(node, context);
  const formName = resolveRetrieveSourceLabel(node, context, sourceId);
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
    description: configuredDescription(node, t('integration.spec_desc_retrieve', formName, conditions.rules.length)),
    type: 'dataRetrieve',
    nodeId,
    prevId: '',
    nextId: [nextNodeId],
    props: {
      type: 'single',
      filterType: 'condition',
      sort: node.sort || { type: 'none', column: '' },
      sourceId,
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
  const formName = resolveRetrieveSourceLabel(node, context, props.sourceId);
  let targetItem;
  let relativeItem = {};
  if (isSubTableRetrieve(node)) {
    const parentFormUuid = resolveSubTableParentFormUuidFromContext(node, context);
    const schemaComponents = parentFormUuid
      ? (context.formSchemasByUuid.get(parentFormUuid) || [])
      : [];
    const subTableLabel = node.subSourceLabel
      || resolveTableFieldLabel(schemaComponents, props.subSourceId, props.subSourceId);
    targetItem = {
      deep: 0,
      value: props.sourceId,
      label: formName,
    };
    relativeItem = buildSubTableRelativeItem(props.subSourceId, subTableLabel);
  } else {
    const schemaComponents = context.formSchemasByUuid.get(props.sourceId) || [];
    const tableFields = isUsedAsSubTableSource(node, context)
      ? listTableFieldSummaries(schemaComponents)
      : [];
    targetItem = {
      appType: context.appType,
      appName: '',
      formItem: {
        formType: 'receipt',
        advanceProc: 'n',
        formUuid: props.sourceId,
        title: formName,
        fields: tableFields.length > 0 ? tableFields : null,
        hasTableField: tableFields.length > 0 ? true : null,
      },
    };
  }
  return {
    componentName: 'GetSingleDataNode',
    id: nodeId,
    props: {
      nodeName: 'GetSingleDataNode',
      name: node.name || '获取单条数据',
      description: processNode.description,
      type: 'single',
      getData: {
        type: 'single',
        originalType: props.originalType,
        appType: context.appType,
        sourceId: props.sourceId,
        targetItem,
        subSourceId: props.subSourceId,
        relativeItem,
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

function resolveCreateTarget(node, context) {
  if (isSubTableInsert(node)) {
    const sourceAlias = getSourceAlias(node);
    const sourceNodeId = resolveAlias(sourceAlias, context);
    const sourceNode = resolveContextSourceNode(node, context) || {};
    const parentFormUuid = resolveSubTableParentFormUuidFromContext(node, context);
    const formName = sourceNode.name
      || sourceNode.formName
      || node.formName
      || (parentFormUuid && context.formNamesByUuid.get(parentFormUuid))
      || sourceAlias;
    return {
      formUuid: sourceNodeId,
      insertType: 'sub_table',
      subFormUuid: node.subFormUuid,
      sourceId: '',
      parentFormUuid,
      formName,
      subFormLabel: node.subSourceLabel || node.subFormLabel || node.subFormUuid,
      isSubTable: true,
    };
  }
  const formUuid = node.formUuid || node.targetFormUuid;
  return {
    formUuid,
    insertType: node.insertType || 'form',
    subFormUuid: node.subFormUuid || '',
    sourceId: node.sourceId || '',
    parentFormUuid: formUuid,
    formName: node.formName || context.formNamesByUuid.get(formUuid) || formUuid,
    isSubTable: false,
  };
}

function buildDataCreateProcessNode(node, nodeId, nextNodeId, context) {
  const target = resolveCreateTarget(node, context);
  const assignments = normalizeAssignments(node.assignments, context);
  return {
    name: { zh_CN: node.name || '新增数据', en_US: '' },
    description: configuredDescription(node, t('integration.spec_desc_create', target.formName, assignments.length)),
    type: 'dataCreate',
    nodeId,
    prevId: '',
    nextId: [nextNodeId],
    props: {
      formUuid: target.formUuid,
      appType: context.appType,
      subFormUuid: target.subFormUuid || '',
      insertType: target.insertType,
      type: node.createType || 'single',
      sourceId: target.sourceId,
      assignments: buildDataCreateAssignments(assignments),
    },
    childNodes: [],
  };
}

function buildDataCreateViewNode(node, nodeId, context) {
  const target = resolveCreateTarget(node, context);
  const schemaComponents = context.formSchemasByUuid.get(target.parentFormUuid) || [];
  const inputChildList = target.isSubTable
    ? buildSubTableAddDataChildList(schemaComponents, target.subFormUuid)
    : buildAddDataChildList(schemaComponents);
  const columnList = inputChildList.filter((item) => item.componentName !== 'TableField');
  const normalizedAssignments = normalizeAssignments(node.assignments, context);
  assertAssignmentFieldsExist(normalizedAssignments, columnList);
  const inputOptionMap = {};
  inputChildList.forEach((item) => {
    inputOptionMap[item.fieldId] = item.componentOption || '[]';
  });
  const columnOptionMap = {};
  columnList.forEach((item) => {
    columnOptionMap[item.fieldId] = item.componentOption || '[]';
  });
  const assignmentRules = normalizedAssignments.map((assignment) => {
    const matchedField = columnList.find((item) => item.fieldId === assignment.column);
    const label = matchedField ? matchedField.label : assignment.column;
    return {
      name: assignment.column,
      componentName: matchedField ? matchedField.componentName : 'TextField',
      valueType: assignment.valueType,
      value: assignment.value,
      required: false,
      ruleId: generateDataRuleId(),
      componentOption: matchedField && matchedField.componentOption ? matchedField.componentOption : '[]',
      label,
      valueLabel: label,
      componentProps: {
        defaultDataSource: {},
        relateAppType: '',
        relateOrderEnable: false,
        relateOrderConfig: [],
      },
    };
  });
  const description = node.description
    || (target.isSubTable
      ? `在 [${target.formName}] 中新增数据`
      : `在[${target.formName}]中新增 ${assignmentRules.length} 个字段`);
  const addDataRules = {
    description,
    formUuid: target.formUuid,
    appType: context.appType,
    insertType: target.insertType,
    type: node.createType || 'single',
    subFormUuid: target.subFormUuid || '',
    sourceId: target.sourceId,
    assignments: assignmentRules,
    inputs: { childList: inputChildList, componentOptionMap: inputOptionMap },
    rules: {
      childList: columnList,
      componentOptionMap: columnOptionMap,
      ruleId: generateDataRuleId(),
      rules: assignmentRules,
    },
  };
  if (target.isSubTable) {
    const tableFields = listTableFieldSummaries(schemaComponents);
    const parentFormName = (target.parentFormUuid && context.formNamesByUuid.get(target.parentFormUuid))
      || target.formName;
    const targetItem = {
      deep: 0,
      value: target.formUuid,
      label: target.formName,
      appType: context.appType,
      appName: '',
    };
    if (target.parentFormUuid) {
      targetItem.formItem = {
        formType: 'receipt',
        advanceProc: 'n',
        formUuid: target.parentFormUuid,
        title: parentFormName,
        fields: null,
        hasTableField: tableFields.length > 0 ? true : null,
      };
      addDataRules.formItem = targetItem.formItem;
    }
    addDataRules.targetItem = targetItem;
    addDataRules.crossForm = targetItem;
    addDataRules.relativeItem = buildSubTableRelativeItem(
      target.subFormUuid,
      resolveTableFieldLabel(schemaComponents, target.subFormUuid, target.subFormLabel)
    );
    addDataRules.relativeList = [addDataRules.relativeItem];
    addDataRules.subFormItem = addDataRules.relativeItem;
    addDataRules.subFormName = addDataRules.relativeItem.label;
  }
  return {
    componentName: 'AddDataNode',
    id: nodeId,
    props: {
      nodeName: 'AddDataNode',
      name: node.name || '新增数据',
      description,
      addDataRules,
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
  const assignments = asArray(node.assignments || node.updateAssignments);
  return {
    name: { zh_CN: node.name || '更新数据', en_US: '' },
    description: configuredDescription(node, t('integration.spec_desc_update', assignments.length)),
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
      description: configuredDescription(node, t('integration.spec_desc_update', asArray(node.assignments || node.updateAssignments).length)),
      updateDataRules: rules,
    },
    title: node.name || '更新数据',
  };
}

function buildInitiateApprovalProcessNode(node, nodeId, nextNodeId, context) {
  const formUuid = node.formUuid || node.targetFormUuid;
  const formName = node.formName || context.formNamesByUuid.get(formUuid) || formUuid;
  const normalizedAssignments = normalizeAssignments(node.assignments || node.initiateApprovalAssignments, context);
  const schemaComponents = context.formSchemasByUuid.get(formUuid);
  if (schemaComponents) {
    assertAssignmentFieldsExist(normalizedAssignments, buildAddDataChildList(schemaComponents));
  }
  const assignments = buildInitiateApprovalAssignments(
    normalizedAssignments,
    { includeRequired: false }
  );
  const description = configuredDescription(node, t('integration.spec_desc_approval', formName, assignments.length));
  return {
    name: { zh_CN: node.name || '发起审批', en_US: 'Initiate approval', type: 'i18n' },
    description,
    type: 'initiateApproval',
    nodeId,
    prevId: '',
    nextId: [nextNodeId],
    props: {
      type: 'single',
      initiator: resolveInitiator(node, context),
      assignments,
      formUuid,
      processCode: context.processCode,
      formTitle: '',
      appType: context.appType,
      description,
    },
    childNodes: [],
  };
}

function buildInitiateApprovalViewNode(node, nodeId, context) {
  const processNode = buildInitiateApprovalProcessNode(node, nodeId, nodeId, context);
  return {
    componentName: 'InitiateApprovalNode',
    id: nodeId,
    props: {
      nodeName: 'InitiateApprovalNode',
      name: processNode.name,
      description: processNode.description,
      initiateApprovalRules: {
        ...processNode.props,
        assignments: processNode.props.assignments.map((assignment) => ({ ...assignment, required: false })),
      },
      signAction: 'one_by_one',
      nodeError: '',
    },
    title: node.name || '发起审批',
  };
}

function buildConnectorProcessNode(node, nodeId, nextNodeId, context) {
  const connectorMode = resolveConnectorMode(node.connectorId, node.connectorMode || node.mode);
  const connectionId = node.connectionId || node.connection || '';
  return {
    name: { zh_CN: node.name || '连接器', en_US: '' },
    description: node.description || '请选择连接器',
    type: connectorMode === 5 ? 'httpConnector' : 'innerConnector',
    nodeId,
    prevId: '',
    nextId: [nextNodeId],
    props: {
      inputs: {
        url: '',
        method: '',
        body: '',
        connection: connectionId,
        connectionId,
        connectorMode,
        connectorId: node.connectorId,
        actionId: node.actionId,
        assignments: buildConnectorCallAssignments(normalizeAssignments(node.assignments || node.connectorAssignments, context)),
      },
    },
    childNodes: [],
  };
}

function buildConnectorViewNode(node, nodeId, context) {
  const connectorMode = resolveConnectorMode(node.connectorId, node.connectorMode || node.mode);
  const connectionId = node.connectionId || node.connection || '';
  let normalizedInputs = Array.isArray(node.inputs) ? node.inputs : [];
  let normalizedOutputs = Array.isArray(node.outputs) ? node.outputs : [];
  let presetDescription = node.schemaDescription || '';
  let presetSchemaType = node.openDevSchemaType || 'normal';
  const hasDiscoveredSchema = ['PLATFORM_READ_ONLY_DISCOVERY', 'FIXED_PROVEN_PRESET', 'FIXED_CONTRACT_FIXTURE']
    .includes(node.schemaVerificationLevel);
  if (!hasDiscoveredSchema) {
    const preset = lookupConnectorPreset(node.connectorId, node.actionId);
    if (preset && preset.inputs && preset.inputs.length > 0) {
      normalizedInputs = preset.inputs;
      normalizedOutputs = preset.outputs || [];
      presetDescription = preset.description || '';
      presetSchemaType = preset.openDevSchemaType || 'normal';
    } else {
      const error = new Error(t('integration.connector_schema_unverified', node.connectorId, node.actionId));
      error.code = 'INTEGRATION_CONNECTOR_SCHEMA_UNVERIFIED';
      throw error;
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
        connectionId,
        actionId: node.actionId,
        connector: {
          config: null,
          connectorCorpId: '',
          connectorId: node.connectorId,
          connectorName: node.connectorName || node.connectorId,
          containTriggers: null,
          description: connectorDisplayName,
          iconUrl: node.icon || '',
          mode: connectorMode,
          connectorMode,
          displayName: connectorDisplayName,
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
        priority,
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
        priority: 2147483647,
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
    initiateapproval: 'initiateApproval',
    approval: 'initiateApproval',
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
  if (type === 'initiateApproval') {
    return {
      processNode: buildInitiateApprovalProcessNode(node, nodeId, nextNodeId, context),
      viewNode: buildInitiateApprovalViewNode(node, nodeId, context),
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
  const approvalTrigger = buildApprovalTriggerState(
    formEventTypes,
    asArray(spec.approvalActions),
    asArray(spec.approvalNodeIds)
  );
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
        activityAction: approvalTrigger.approvalActions,
        triggerFormEventRecursively: Boolean(spec.triggerRecursively),
        activityId: approvalTrigger.approvalNodeIds,
        activityTask: approvalTrigger.activityTask,
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
        examineApproveType: approvalTrigger.examineApproveType,
        formEventType: approvalTrigger.startFormEventTypes,
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
        examineApproveNode: approvalTrigger.isApprovalNodeEvent
          ? (approvalTrigger.approvalNodeIds[0] || '')
          : '',
        examineApproveActiveList: approvalTrigger.approvalActions,
        examineApproveActiveTask: approvalTrigger.activityTask,
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
  validateIntegrationSpec(spec, options.formEventTypes || ['insert'], {
    formUuid: options.formUuid,
  });
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
    formNamesByUuid: options.formNamesByUuid || new Map(),
    currentUserId: options.currentUserId || '',
    processCode: options.processCode,
    aliasToNodeId: new Map(),
    nodeIdToAlias: new Map(),
    aliasToSpecNode: new Map(),
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

function collectAddDataFormUuids(spec, triggerFormUuid) {
  const result = new Set();
  visitSpecNodes(spec, (node) => {
    const type = normalizeNodeType(node.type || node.componentName);
    if (type !== 'dataCreate') {
      return;
    }
    if (isSubTableInsert(node)) {
      const parentFormUuid = resolveSubTableParentFormUuid(node, spec, triggerFormUuid);
      if (parentFormUuid) {
        result.add(parentFormUuid);
      }
      return;
    }
    const formUuid = node.formUuid || node.targetFormUuid;
    if (formUuid) {
      result.add(formUuid);
    }
  });
  return Array.from(result);
}

function collectInitiateApprovalFormUuids(spec) {
  const result = new Set();
  function visit(nodes) {
    for (const node of asArray(nodes)) {
      const type = normalizeNodeType(node.type || node.componentName);
      if (type === 'initiateApproval') {
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

function hasSpecNodeType(spec, expectedType) {
  let found = false;
  function visit(nodes) {
    for (const node of asArray(nodes)) {
      const type = normalizeNodeType(node.type || node.componentName);
      if (type === expectedType) {
        found = true;
      }
      if (!found && type === 'route') {
        for (const branch of asArray(node.branches || node.conditions)) {
          visit(branch.nodes || branch.childNodes || branch.children);
        }
      }
    }
  }
  visit(getSpecNodes(spec));
  return found;
}

module.exports = {
  readIntegrationSpec,
  validateIntegrationSpec,
  buildSpecProcessAndViewJson,
  collectAddDataFormUuids,
  collectInitiateApprovalFormUuids,
  hasSpecNodeType,
  _private: {
    getSpecNodes,
    mapSpecEventTypes,
    normalizeNodeType,
    resolveNodeRefs,
    buildSpecNodeList,
    buildDataUpdateRules,
  },
};
