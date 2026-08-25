'use strict';

const crypto = require('crypto');

const PROCESS_TYPE_TO_COMPONENT = {
  trigger: 'StartNode',
  finish: 'EndNode',
  dataRetrieve: 'GetSingleDataNode',
  dataCreate: 'AddDataNode',
  dataUpdate: 'UpdateDataNode',
  route: 'ConditionContainer',
  condition: 'ConditionNode',
  sendMessage: 'SendMessageNode',
  innerConnector: 'ConnectorNode',
  httpConnector: 'ConnectorNode',
  initiateApproval: 'InitiateApprovalNode',
};

const COMPONENT_TO_PROCESS_TYPE = {
  StartNode: 'trigger',
  EndNode: 'finish',
  GetSingleDataNode: 'dataRetrieve',
  AddDataNode: 'dataCreate',
  UpdateDataNode: 'dataUpdate',
  ConditionContainer: 'route',
  ConditionNode: 'condition',
  SendMessageNode: 'sendMessage',
  InitiateApprovalNode: 'initiateApproval',
};

const RESOURCE_KIND_CONFIG = {
  apps: { singular: 'app', rawPattern: /^(APP|APP_|APP-)/i },
  forms: { singular: 'form', rawPattern: /^(FORM|FORM_|FORM-|PROC_FORM|processForm)/i },
  fields: { singular: 'field', rawPattern: /(^(__|form_inst_))|field|Field|^pid$/ },
  connectors: { singular: 'connector', rawPattern: /^(G-CONN|Http_|CONN)/i },
  actions: { singular: 'action', rawPattern: /^(G-ACT|ACT|ACTION)/i },
  connections: { singular: 'connection', rawPattern: /^(CONNECTION|CONN-|CONN_)/i },
  users: { singular: 'user', rawPattern: /^(USER|EMP|STAFF)/i },
  roles: { singular: 'role', rawPattern: /^(ROLE|GROUP)/i },
};

const OPERATOR_ALIASES = {
  '=': 'Equal',
  '==': 'Equal',
  '等于': 'Equal',
  Equal: 'Equal',
  '!=': 'NotEqual',
  '不等于': 'NotEqual',
  NotEqual: 'NotEqual',
  '包含': 'Contain',
  Contain: 'Contain',
  '不包含': 'NotContain',
  NotContain: 'NotContain',
  '有值': 'HasValue',
  HasValue: 'HasValue',
  ExistValue: 'ExistValue',
  '没有值': 'NoValue',
  NoValue: 'NoValue',
  NotExistValue: 'NotExistValue',
  '>': 'GreaterThan',
  '大于': 'GreaterThan',
  GreaterThan: 'GreaterThan',
  '>=': 'GreaterThanOrEqual',
  '大于等于': 'GreaterThanOrEqual',
  GreaterThanOrEqual: 'GreaterThanOrEqual',
  '<': 'LessThan',
  '小于': 'LessThan',
  LessThan: 'LessThan',
  '<=': 'LessThanOrEqual',
  '小于等于': 'LessThanOrEqual',
  LessThanOrEqual: 'LessThanOrEqual',
  In: 'In',
  '等于任意一个': 'In',
  NotIn: 'NotIn',
  '不等于任意一个': 'NotIn',
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function shortHash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 12);
}

function parseJsonValue(value, label) {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new TypeError(label + ' must be valid JSON: ' + error.message);
  }
}

function localizedText(value) {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (!isPlainObject(value)) {
    return '';
  }
  return String(value.zh_CN || value.en_US || value.pureEn_US || value.name || '');
}

function semanticSlug(value) {
  const slug = String(value || 'node')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'node';
}

function normalizedLogic(value) {
  if (value === undefined || value === null || value === '') {
    return 'AND';
  }
  return String(value).toUpperCase();
}

function normalizedOperator(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return OPERATOR_ALIASES[String(value)] || String(value);
}

function normalizeStatus(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['y', 'yes', 'true', '1', 'online', 'published', 'enabled'].includes(normalized)) {
    return true;
  }
  if (['n', 'no', 'false', '0', 'offline', 'draft', 'disabled'].includes(normalized)) {
    return false;
  }
  return null;
}

function findDefinitionPayload(rawPayload) {
  const initial = parseJsonValue(rawPayload, 'rawPayload');
  const queue = [{ value: initial, label: 'rawPayload', depth: 0 }];
  const seen = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    let value = current.value;
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch (_error) {
        continue;
      }
    }
    if (Array.isArray(value)) {
      if (current.depth < 8) {
        value.forEach(function (item, index) {
          queue.push({
            value: item,
            label: current.label + '[' + index + ']',
            depth: current.depth + 1,
          });
        });
      }
      continue;
    }
    if (!isPlainObject(value) || seen.has(value)) {
      continue;
    }
    seen.add(value);

    const processCandidate = value.processJson !== undefined ? value.processJson : value.json;
    if (processCandidate !== undefined && value.viewJson !== undefined) {
      let processJson = processCandidate;
      let viewJson = value.viewJson;
      try {
        processJson = typeof processJson === 'string' ? JSON.parse(processJson) : processJson;
        viewJson = typeof viewJson === 'string' ? JSON.parse(viewJson) : viewJson;
      } catch (_error) {
        processJson = null;
        viewJson = null;
      }
      if (isPlainObject(processJson) && isPlainObject(viewJson)) {
        return { processJson, viewJson, envelope: initial, detail: value };
      }
    }

    if (current.depth >= 8) {
      continue;
    }
    ['data', 'content', 'result', 'list', 'rows'].forEach(function (key) {
      if (value[key] !== undefined) {
        queue.push({
          value: value[key],
          label: current.label + '.' + key,
          depth: current.depth + 1,
        });
      }
    });
  }
  throw new TypeError('integration readback must contain processJson/json and viewJson');
}

function buildResourceAliasMaps(resourceAliases) {
  const maps = {};
  Object.keys(RESOURCE_KIND_CONFIG).forEach(function (pluralKind) {
    const config = RESOURCE_KIND_CONFIG[pluralKind];
    const map = new Map();
    const source = resourceAliases && resourceAliases[pluralKind];
    if (isPlainObject(source)) {
      Object.keys(source).sort().forEach(function (role) {
        const rawValue = source[role];
        if (rawValue === undefined || rawValue === null || rawValue === '') {
          return;
        }
        const raw = String(rawValue);
        const semanticRole = String(role);
        if (map.has(raw) && map.get(raw) !== semanticRole) {
          throw new TypeError(
            'resource alias collision for ' + config.singular + ' raw id ' + raw
          );
        }
        map.set(raw, semanticRole);
      });
    }
    maps[config.singular] = map;
  });
  return maps;
}

function createResourceMapper(resourceAliases) {
  const maps = buildResourceAliasMaps(resourceAliases || {});
  return function mapResource(kind, value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const raw = String(value);
    const map = maps[kind] || new Map();
    if (map.has(raw)) {
      return map.get(raw);
    }
    return 'unmapped:' + kind + ':' + shortHash(raw);
  };
}

function collectProcessNodes(nodes, output) {
  (Array.isArray(nodes) ? nodes : []).forEach(function (node) {
    if (!isPlainObject(node)) {
      return;
    }
    output.push(node);
    collectProcessNodes(node.childNodes, output);
  });
}

function collectViewNodes(nodes, output) {
  (Array.isArray(nodes) ? nodes : []).forEach(function (node) {
    if (!isPlainObject(node)) {
      return;
    }
    output.push(node);
    collectViewNodes(node.children, output);
  });
}

function processNodeName(node) {
  return localizedText(node && (node.name || (node.props && (node.props.name || node.props.nodeName))));
}

function viewNodeName(node) {
  return localizedText(node && node.props && (node.props.name || node.props.nodeName))
    || localizedText(node && node.title);
}

function buildProcessNodeMap(processNodes) {
  const rawToKey = new Map();
  const counts = new Map();
  processNodes.forEach(function (node) {
    const base = normalizeProcessType(node);
    const count = (counts.get(base) || 0) + 1;
    counts.set(base, count);
    const key = count === 1 ? base : base + '~' + count;
    if (node.nodeId !== undefined && node.nodeId !== null && node.nodeId !== '') {
      rawToKey.set(String(node.nodeId), key);
    }
  });
  return rawToKey;
}

function createReferenceNormalizer(rawToKey, mapResource) {
  const canonicalKeys = new Set(rawToKey.values());
  function nodeFieldReference(value) {
    if (typeof value !== 'string') {
      return null;
    }
    const match = value.match(/^\$\{([^}.]+)\}(?:\.([^\s]+))?$/)
      || value.match(/^\$\{([^}.]+)\.([^}]+)\}$/);
    if (!match) {
      return null;
    }
    return {
      sourceNode: rawToKey.get(match[1])
        || (canonicalKeys.has(match[1]) ? match[1] : 'unmapped-node:' + shortHash(match[1])),
      sourceField: match[2] ? mapResource('field', match[2]) : null,
    };
  }

  function rewriteString(value) {
    const raw = String(value);
    if (rawToKey.has(raw)) {
      return rawToKey.get(raw);
    }
    const referenceNormalized = raw.replace(
      /\$\{([^}.]+)(?:\.([^}]+))?\}(?:\.([A-Za-z0-9_%.-]+))?/g,
      function (_match, rawNodeId, innerField, outerField) {
        const rawField = innerField || outerField || null;
        if (rawNodeId === 'field' && rawField) {
          return '${field.' + mapResource('field', rawField) + '}';
        }
        const canonicalNode = rawToKey.get(rawNodeId)
          || (canonicalKeys.has(rawNodeId) ? rawNodeId : null);
        if (!canonicalNode) {
          return '${unmapped-node:' + shortHash(rawNodeId)
            + (rawField ? '.' + rawField : '') + '}';
        }
        return '${' + canonicalNode + (rawField
          ? '.' + mapResource('field', rawField)
          : '') + '}';
      }
    );
    return referenceNormalized.replace(/#\{([^-}]+)-[^}]+\}#/g, function (_match, rawField) {
      return '${field.' + mapResource('field', rawField) + '}';
    });
  }

  function normalizeValue(value, valueType) {
    if (Array.isArray(value)) {
      return value.map(function (item) { return normalizeValue(item, valueType); });
    }
    if (isPlainObject(value)) {
      const output = {};
      Object.keys(value).sort().forEach(function (key) {
        output[key] = normalizeValue(value[key], valueType);
      });
      return output;
    }
    if (typeof value !== 'string') {
      return value;
    }
    const rewritten = rewriteString(value);
    if (rewritten !== value || valueType !== 'processVar') {
      return rewritten;
    }
    if (rawToKey.has(value)) {
      return rawToKey.get(value);
    }
    return mapResource('field', value);
  }

  function sourceNodeFromValue(value) {
    const reference = nodeFieldReference(value);
    return reference && reference.sourceNode;
  }

  return { nodeFieldReference, normalizeValue, rewriteString, sourceNodeFromValue };
}

function compactObject(entries) {
  const output = {};
  Object.keys(entries).forEach(function (key) {
    const value = entries[key];
    if (value !== undefined && value !== null) {
      output[key] = value;
    }
  });
  return output;
}

function normalizeAssignment(assignment, context) {
  const valueType = assignment.valueType !== undefined
    ? assignment.valueType
    : (assignment.extValue !== undefined ? assignment.extValue : null);
  const rawValue = assignment.value !== undefined ? assignment.value : assignment.ruleValue;
  const rawField = assignment.field || assignment.fieldId || assignment.column || assignment.name || assignment.id;
  const fieldReference = context.references.nodeFieldReference(rawField);
  const valueReference = context.references.nodeFieldReference(rawValue);
  const explicitSource = assignment.sourceNode || assignment.sourceNodeId || assignment.__source;
  const sourceNode = explicitSource
    ? (context.references.sourceNodeFromValue(String(explicitSource))
      || context.rawToKey.get(String(explicitSource))
      || 'unmapped-node:' + shortHash(explicitSource))
    : ((fieldReference && fieldReference.sourceNode)
      || (valueReference && valueReference.sourceNode));
  const sourceFieldRaw = assignment.sourceField || assignment.sourceFieldId;
  const normalizedValue = context.references.normalizeValue(rawValue, valueType);
  const inferredSourceField = valueType === 'processVar'
    && typeof rawValue === 'string'
    && !sourceNode
    ? context.mapResource('field', rawValue)
    : null;
  return compactObject({
    field: fieldReference && fieldReference.sourceField
      ? fieldReference.sourceField
      : context.mapResource('field', rawField),
    valueType,
    value: valueType === 'processVar' ? null : normalizedValue,
    sourceNode,
    sourceField: sourceFieldRaw
      ? context.mapResource('field', sourceFieldRaw)
      : ((fieldReference && fieldReference.sourceField)
        || (valueReference && valueReference.sourceField)
        || inferredSourceField || (sourceNode
        ? context.mapResource('field', assignment.field || assignment.fieldId || assignment.id)
        : null)),
    operator: normalizedOperator(assignment.operator || assignment.opCode || assignment.op),
  });
}

function normalizeAssignments(assignments, context) {
  return (Array.isArray(assignments) ? assignments : [])
    .filter(isPlainObject)
    .map(function (assignment) { return normalizeAssignment(assignment, context); });
}

function hasConditionRuleSemantics(rule) {
  if (!isPlainObject(rule)) {
    return false;
  }
  const field = rule.field || rule.fieldId || rule.column || rule.id || rule.name;
  return field !== undefined && field !== null && String(field).trim() !== '';
}

function preferConditionFieldId(rule) {
  if (rule.field || rule.fieldId || rule.column || !rule.id) {
    return rule;
  }
  return Object.assign({}, rule, { field: rule.id });
}

function normalizeCondition(condition, context) {
  if (!isPlainObject(condition)) {
    return { logic: 'AND', rules: [] };
  }
  const nested = isPlainObject(condition.conditions) ? condition.conditions : condition;
  const rules = (nested.rules || condition.rules || [])
    .filter(hasConditionRuleSemantics)
    .map(preferConditionFieldId);
  return {
    logic: normalizedLogic(nested.condition || nested.logic || condition.condition || condition.logic),
    rules: normalizeAssignments(rules, context),
  };
}

function normalizeRecipients(toUsers, userFields, toRoles, context) {
  const recipients = [];
  (Array.isArray(toUsers) ? toUsers : []).forEach(function (user) {
    const raw = isPlainObject(user) ? (user.userId || user.id || user.value) : user;
    if (raw) {
      recipients.push({ valueType: 'user', value: context.mapResource('user', raw) });
    }
  });
  (Array.isArray(userFields) ? userFields : []).forEach(function (field) {
    const raw = isPlainObject(field) ? (field.fieldId || field.id || field.value) : field;
    if (raw) {
      recipients.push({ valueType: 'field', value: context.mapResource('field', raw) });
    }
  });
  (Array.isArray(toRoles) ? toRoles : []).forEach(function (role) {
    const raw = isPlainObject(role) ? (role.roleId || role.id || role.value) : role;
    if (raw) {
      recipients.push({ valueType: 'role', value: context.mapResource('role', raw) });
    }
  });
  const unique = new Map();
  recipients.forEach(function (recipient) {
    unique.set(recipient.valueType + ':' + recipient.value, recipient);
  });
  return Array.from(unique.values()).sort(function (left, right) {
    return (left.valueType + ':' + left.value).localeCompare(right.valueType + ':' + right.value);
  });
}

function normalizeOutputs(outputs, context, options = {}) {
  return (Array.isArray(outputs) ? outputs : []).filter(isPlainObject).map(function (output) {
    const rawOutput = output.field || output.fieldId || output.name || output.id;
    const explicitSource = output.sourceNode || output.sourceNodeId;
    return compactObject({
      field: context.mapResource('field', rawOutput),
      valueType: options.descriptor ? null : output.valueType,
      value: options.descriptor || output.value === undefined
        ? null
        : context.references.normalizeValue(output.value, output.valueType),
      sourceNode: options.descriptor || !explicitSource
        ? null
        : (context.rawToKey.get(String(explicitSource))
          || 'unmapped-node:' + shortHash(explicitSource)),
      sourceField: options.descriptor ? null : (output.sourceField || output.sourceFieldId),
      operator: normalizedOperator(output.operator || output.opCode || output.op),
    });
  });
}

function connectorAssignments(rules) {
  if (Array.isArray(rules.assignments)) {
    return rules.assignments;
  }
  if (!Array.isArray(rules.rules)) {
    return [];
  }
  const assignments = [];
  rules.rules.forEach(function (rule) {
    if (rule && Array.isArray(rule.rules)) {
      rule.rules.forEach(function (inner) {
        assignments.push(Object.assign({}, inner, {
          column: inner.column || inner.name || rule.name || rule.id,
        }));
      });
    } else if (rule) {
      assignments.push(rule);
    }
  });
  return assignments;
}

function normalizeNodeConfig(type, props, side, context) {
  const source = props || {};
  if (type === 'sendMessage') {
    const rules = side === 'view' ? (source.sendMessageRules || {}) : source;
    const message = rules.messageInfo || {};
    return {
      sendMessage: {
        recipients: normalizeRecipients(rules.toUsers, rules.userFields, rules.toRoles, context),
        title: context.references.rewriteString(message.title || ''),
        content: context.references.rewriteString(message.content || ''),
      },
    };
  }
  if (type === 'dataRetrieve') {
    const rules = side === 'view' ? (source.getData || {}) : source;
    return {
      dataRetrieve: compactObject({
        sourceForm: context.mapResource('form', rules.sourceId || rules.formUuid),
        query: normalizeCondition(rules.condition || rules.conditions, context).rules,
        assignments: normalizeAssignments(rules.assignments, context),
        emptyBehavior: rules.emptyBehavior || rules.noneOperation || null,
      }),
    };
  }
  if (type === 'dataCreate') {
    const rules = side === 'view' ? (source.addDataRules || {}) : source;
    const viewAssignments = rules.rules && rules.rules.rules;
    return {
      dataCreate: {
        targetForm: context.mapResource('form', rules.formUuid || rules.targetFormUuid),
        assignments: normalizeAssignments(viewAssignments || rules.assignments, context),
      },
    };
  }
  if (type === 'dataUpdate') {
    const rules = side === 'view' ? (source.updateDataRules || {}) : source;
    return {
      dataUpdate: compactObject({
        targetForm: context.mapResource('form', rules.formUuid || rules.targetFormUuid),
        sourceNode: rules.sourceId
          ? (context.rawToKey.get(String(rules.sourceId)) || 'unmapped-node:' + shortHash(rules.sourceId))
          : null,
        query: normalizeCondition(rules.condition || rules.conditions, context).rules,
        assignments: normalizeAssignments(rules.assignments, context),
        emptyBehavior: rules.emptyBehavior || rules.noneOperation || null,
      }),
    };
  }
  if (type === 'initiateApproval') {
    const rules = side === 'view' ? (source.initiateApprovalRules || {}) : source;
    const initiator = rules.initiator || {};
    let initiatorRaw = isPlainObject(initiator) ? (initiator.value || initiator.userId || initiator.id) : initiator;
    if (typeof initiatorRaw === 'string' && initiatorRaw.startsWith('{')) {
      try {
        const parsedInitiator = JSON.parse(initiatorRaw);
        initiatorRaw = parsedInitiator.id || parsedInitiator.userId || initiatorRaw;
      } catch (_error) {
        // Preserve the opaque value; resource mapping will hash it if it has no declared alias.
      }
    }
    return {
      initiateApproval: {
        targetForm: context.mapResource('form', rules.formUuid || rules.targetFormUuid),
        initiator: initiatorRaw
          ? { valueType: 'user', value: context.mapResource('user', initiatorRaw) }
          : null,
        assignments: normalizeAssignments(rules.assignments, context),
      },
    };
  }
  if (type === 'innerConnector' || type === 'httpConnector') {
    const rules = side === 'view' ? (source.connectorRules || {}) : (source.inputs || {});
    const connector = rules.connector || {};
    const mode = Number(rules.connectorMode || connector.connectorMode || connector.mode || (type === 'httpConnector' ? 5 : 1));
    return {
      connector: {
        mode,
        connector: context.mapResource('connector', rules.connectorId || connector.connectorId),
        action: context.mapResource('action', rules.actionId),
        connection: context.mapResource('connection', rules.connectionId || rules.connection),
        inputs: normalizeAssignments(connectorAssignments(rules), context),
        outputs: normalizeOutputs(side === 'view' ? rules.outputs : source.outputs, context, {
          descriptor: side === 'view',
        }),
      },
    };
  }
  return {};
}

function normalizeProcessType(node) {
  return String(node.type || 'unknown');
}

function normalizeViewType(node) {
  if (node.componentName === 'ConnectorNode') {
    const rules = node.props && node.props.connectorRules || {};
    const connector = rules.connector || {};
    const mode = Number(rules.connectorMode || connector.connectorMode || connector.mode || 1);
    return mode === 5 ? 'httpConnector' : 'innerConnector';
  }
  return COMPONENT_TO_PROCESS_TYPE[node.componentName] || String(node.componentName || 'unknown');
}

function normalizeNextKeys(nextId, rawToKey) {
  const values = Array.isArray(nextId) ? nextId : (nextId ? [nextId] : []);
  return values.map(function (raw) {
    return rawToKey.get(String(raw)) || 'unmapped-node:' + shortHash(raw);
  });
}

function normalizeProcessNode(node, context) {
  const type = normalizeProcessType(node);
  const rawId = node.nodeId === undefined || node.nodeId === null ? '' : String(node.nodeId);
  return {
    key: context.rawToKey.get(rawId) || 'unmapped-node:' + shortHash(rawId),
    type,
    componentName: PROCESS_TYPE_TO_COMPONENT[type] || null,
    name: processNodeName(node),
    nextKeys: normalizeNextKeys(node.nextId, context.rawToKey),
    config: normalizeNodeConfig(type, node.props || {}, 'process', Object.assign({}, context, {
      currentNodeKey: context.rawToKey.get(rawId) || 'unmapped-node:' + shortHash(rawId),
    })),
  };
}

function normalizeViewNode(node, context) {
  const rawId = node.id === undefined || node.id === null ? '' : String(node.id);
  const key = context.rawToKey.get(rawId) || 'view-orphan:' + shortHash(rawId || JSON.stringify(node));
  const type = normalizeViewType(node);
  return {
    key,
    type,
    componentName: node.componentName || null,
    name: viewNodeName(node),
    nextKeys: normalizeNextKeys(node.nextId || (node.props && node.props.nextId), context.rawToKey),
    config: normalizeNodeConfig(type, node.props || {}, 'view', Object.assign({}, context, {
      currentNodeKey: key,
    })),
  };
}

function normalizeProcessBranches(processNodes, context) {
  const branches = [];
  processNodes.filter(function (node) { return node.type === 'route'; }).forEach(function (route) {
    const routeKey = context.rawToKey.get(String(route.nodeId));
    (Array.isArray(route.childNodes) ? route.childNodes : [])
      .filter(function (node) { return node && node.type === 'condition'; })
      .forEach(function (branch) {
        const conditions = normalizeCondition(branch.props && branch.props.conditions, context);
        branches.push({
          routeKey,
          key: context.rawToKey.get(String(branch.nodeId)) || 'unmapped-node:' + shortHash(branch.nodeId),
          name: processNodeName(branch),
          isDefault: Boolean(branch.props && branch.props.isDefault),
          priority: branch.props && branch.props.priority !== undefined ? branch.props.priority : null,
          logic: conditions.logic,
          rules: branch.props && branch.props.isDefault ? [] : conditions.rules,
          targetKey: normalizeNextKeys(branch.nextId, context.rawToKey)[0] || null,
        });
      });
  });
  return branches;
}

function normalizeViewBranches(viewNodes, context) {
  const branches = [];
  viewNodes.filter(function (node) { return node.componentName === 'ConditionContainer'; }).forEach(function (route) {
    const routeKey = context.rawToKey.get(String(route.id)) || 'view-orphan:' + shortHash(route.id);
    (Array.isArray(route.children) ? route.children : [])
      .filter(function (node) { return node && node.componentName === 'ConditionNode'; })
      .forEach(function (branch) {
        const wrapper = branch.props && branch.props.conditions || {};
        const conditionSource = wrapper.conditions || wrapper;
        const isDefault = Boolean(branch.props && branch.props.isDefault)
          || Boolean(wrapper.isDefault);
        const conditions = normalizeCondition(conditionSource, context);
        const firstChild = Array.isArray(branch.children) ? branch.children[0] : null;
        branches.push({
          routeKey,
          key: context.rawToKey.get(String(branch.id)) || 'view-orphan:' + shortHash(branch.id),
          name: viewNodeName(branch),
          isDefault,
          priority: wrapper.priority !== undefined
            ? wrapper.priority
            : (branch.props && branch.props.priority !== undefined ? branch.props.priority : null),
          logic: conditions.logic,
          rules: isDefault ? [] : conditions.rules,
          targetKey: firstChild
            ? (context.rawToKey.get(String(firstChild.id)) || 'view-orphan:' + shortHash(firstChild.id))
            : null,
        });
      });
  });
  return branches;
}

function normalizeTrigger(node, side, context) {
  if (!node) {
    return null;
  }
  const normalizedNode = side === 'process'
    ? normalizeProcessNode(node, context)
    : normalizeViewNode(node, context);
  const source = side === 'process'
    ? ((node.props && node.props.inputs) || {})
    : ((node.props && node.props.start) || {});
  let eventTypes = Array.isArray(source.formEventType) ? source.formEventType.slice() : [];
  if (side === 'view'
    && eventTypes.includes('processEvents')
    && source.examineApproveType) {
    eventTypes = eventTypes.filter(function (event) { return event !== 'processEvents'; });
    eventTypes.push(source.examineApproveType);
  }
  return {
    key: normalizedNode.key,
    type: normalizedNode.type,
    componentName: normalizedNode.componentName,
    eventTypes: Array.from(new Set(eventTypes.map(String))).sort(),
    recursive: Boolean(source.triggerFormEventRecursively),
    conditions: source.conditions ? normalizeCondition(source.conditions, context).rules : [],
  };
}

function findStatusValue(root, keys) {
  const queue = [{ value: root, depth: 0 }];
  const seen = new Set();
  while (queue.length > 0) {
    const current = queue.shift();
    let value = current.value;
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch (_error) { continue; }
    }
    if (!isPlainObject(value) || seen.has(value)) {
      continue;
    }
    seen.add(value);
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const status = normalizeStatus(value[key]);
        if (status !== null) {
          return status;
        }
      }
    }
    if (current.depth < 6) {
      ['data', 'content', 'result'].forEach(function (key) {
        if (value[key] !== undefined) {
          queue.push({ value: value[key], depth: current.depth + 1 });
        }
      });
    }
  }
  return null;
}

function normalizeIntegrationReadback(rawPayload, options = {}) {
  const extracted = findDefinitionPayload(rawPayload);
  const processNodes = [];
  const viewNodes = [];
  collectProcessNodes(extracted.processJson.nodes, processNodes);
  collectViewNodes(extracted.viewJson.schema && extracted.viewJson.schema.children, viewNodes);

  const rawToKey = buildProcessNodeMap(processNodes);
  const mapResource = createResourceMapper(options.resourceAliases || {});
  const references = createReferenceNormalizer(rawToKey, mapResource);
  const context = { rawToKey, mapResource, references };

  const processTriggerNode = processNodes.find(function (node) { return node.type === 'trigger'; }) || null;
  const viewTriggerNode = viewNodes.find(function (node) { return node.componentName === 'StartNode'; }) || null;
  const canonicalProcessNodes = processNodes
    .filter(function (node) { return node.type !== 'condition'; })
    .map(function (node) { return normalizeProcessNode(node, context); });
  const canonicalViewNodes = viewNodes
    .filter(function (node) { return node.componentName !== 'ConditionNode'; })
    .map(function (node) { return normalizeViewNode(node, context); });

  return {
    schemaVersion: 1,
    artifactKind: 'definition',
    process: {
      trigger: normalizeTrigger(processTriggerNode, 'process', context),
      nodes: canonicalProcessNodes,
      branches: normalizeProcessBranches(processNodes, context),
    },
    view: {
      trigger: normalizeTrigger(viewTriggerNode, 'view', context),
      nodes: canonicalViewNodes,
      branches: normalizeViewBranches(viewNodes, context),
    },
    control: {
      published: findStatusValue(extracted.envelope, ['published', 'isOnline', 'online']),
      enabled: findStatusValue(extracted.envelope, ['enabled', 'enable', 'status']),
    },
  };
}

module.exports = {
  COMPONENT_TO_PROCESS_TYPE,
  OPERATOR_ALIASES,
  PROCESS_TYPE_TO_COMPONENT,
  buildResourceAliasMaps,
  createResourceMapper,
  findDefinitionPayload,
  localizedText,
  normalizeIntegrationReadback,
  normalizedLogic,
  normalizedOperator,
  semanticSlug,
  shortHash,
};
