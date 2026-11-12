'use strict';

const { generateRuleGroupId, generateRuleItemId, generateDataRuleId, generateButtonUuid } = require('./integration-node-ids');
const {
  resolveDataSourceFormType,
  resolveDataOriginalType,
  toRuntimeDataQueryField,
  normalizeDataQueryFieldName,
} = require('./integration-form-metadata');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');

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
    targetfield: 'targetField',
    fieldchange: 'targetField',
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
    Bigger: '大于',
    BiggerOrEqual: '大于等于',
    Lesser: '小于',
    LesserOrEqual: '小于等于',
    In: '等于任意一个',
    NotIn: '不等于任意一个',
  };
  return operatorMapping[opCode] || opCode || '等于';
}

function mapDataRetrieveOperator(opCode) {
  return mapTriggerOperator(opCode || 'Contain');
}

// DataNodeRpc.getConfig supplies these native codes to GetDataSetter. The
// friendly aliases are input conveniences, not codes accepted by the consumer.
function normalizeDataRetrieveOpCode(opCode) {
  const aliases = {
    GreaterThan: 'Bigger', GreaterThanOrEqual: 'BiggerOrEqual',
    LessThan: 'Lesser', LessThanOrEqual: 'LesserOrEqual',
  };
  return Object.hasOwn(aliases, opCode) ? aliases[opCode] : opCode || 'Contain';
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

function buildTriggerCondition(triggerConditions, logic = 'AND', options = {}) {
  if (!options.allowFormula && (triggerConditions || []).some(condition => condition.valueType === 'column')) {
    const { fail } = require('../formula/metadata');
    fail(require('../core/i18n').t('formula_v2.trigger_formula'));
  }
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
      value: valueType === 'column' && ruleValue && typeof ruleValue === 'object' ? ruleValue.value : ruleValue,
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
    const opCode = normalizeDataRetrieveOpCode(condition.opCode);
    const valueType = condition.valueType || 'processVar';
    const rawValue = getFirstNonNullishOwnValue(condition, ['aFieldId', 'value', 'ruleValue']).value;
    const ruleValue = normalizeTypedLiteral(valueType, rawValue, condition.componentType);
    return {
      id: condition.bFieldId,
      op: mapDataRetrieveOperator(opCode),
      operators: [],
      value: valueType === 'column' && ruleValue && typeof ruleValue === 'object' ? ruleValue.value : ruleValue,
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
  return assignments.map(({ column, valueType, value, __source, __display }) => {
    const normalizedValueType = valueType || 'literal';
    return {
      column,
      valueType: normalizedValueType,
      value: normalizeTypedLiteral(normalizedValueType, value, componentTypesByColumn.get(column)),
      assignments: [],
      ...(__source !== undefined ? { __source } : {}),
      ...(__display !== undefined ? { __display } : {}),
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
function buildConnectorCallAssignments(assignments, componentTypesByColumn = new Map(), inputsSchema = []) {
  validateAssignments(assignments, 'connector assignment');
  const flat = assignments.map(({ column, valueType, value }) => {
    const normalizedValueType = valueType || 'literal';
    return {
      column,
      valueType: normalizedValueType,
      value: normalizeTypedLiteral(normalizedValueType, value, componentTypesByColumn.get(column)),
      assignments: [],
    };
  });
  if (!Array.isArray(inputsSchema) || !inputsSchema.length) { return flat; }
  // The HTTP engine consumes object assignments, not dotted column strings.
  // Resolve against the discovered schema so literal dots in names stay intact.
  // Lazy imports avoid the existing presets -> normalizeTypedLiteral dependency.
  const { buildConnectorInputIndex, resolveConnectorAssignmentTarget } = require('./connector-presets');
  require('./integration-connector-schema').validateConnectorAssignmentsAgainstSchema(assignments, inputsSchema, { requireRequired: false });
  const index = buildConnectorInputIndex(inputsSchema);
  const runtimeError = (key, inputPath) => {
    throw new CliError(t(`connector_runtime.${key}`, inputPath), {
      code: key === 'literal_type_invalid' ? 'INTEGRATION_CONNECTOR_LITERAL_TYPE_INVALID'
        : key === 'json_null_unsupported' ? 'INTEGRATION_CONNECTOR_JSON_NULL_UNSUPPORTED'
          : key === 'json_reference_invalid' ? 'INTEGRATION_CONNECTOR_JSON_REFERENCE_INVALID' : 'INTEGRATION_CONNECTOR_MIXED_BODY_TYPE_UNVERIFIED',
      details: { path: inputPath, remoteWrites: 0, sideEffectState: 'none', retrySafe: true },
    });
  };
  const byPath = new Map(flat.map(item => {
    const descriptor = resolveConnectorAssignmentTarget(item.column, index).descriptor;
    const type = String(descriptor.input.paramType || '').toLowerCase();
    if (descriptor.location === 'body' && item.valueType === 'literal') {
      if (['number', 'integer', 'int', 'float', 'double'].includes(type)) {
        if (typeof item.value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(item.value.trim())) {
          item.value = Number(item.value);
        }
        if (typeof item.value !== 'number' || !Number.isFinite(item.value)) { runtimeError('literal_type_invalid', descriptor.path); }
      } else if (['boolean', 'bool'].includes(type)) {
        if (item.value === 'true' || item.value === 'false') { item.value = item.value === 'true'; }
        if (typeof item.value !== 'boolean') { runtimeError('literal_type_invalid', descriptor.path); }
      }
    }
    return [descriptor.path, item];
  }));
  const compile = (input, parent = '') => {
    const inputPath = parent ? `${parent}.${input.name}` : input.name;
    const children = (input.childList || []).map(child => compile(child, inputPath)).filter(Boolean);
    const assignment = byPath.get(inputPath);
    if (assignment && children.length) {
      throw new CliError(t('integration.connector_assignment_duplicate', inputPath), {
        code: 'INTEGRATION_CONNECTOR_ASSIGNMENT_DUPLICATE', details: { path: inputPath, remoteWrites: 0 },
      });
    }
    if (assignment) { return { ...assignment, column: input.name }; }
    return children.length ? { column: input.name, valueType: 'object', value: '', assignments: children } : null;
  };
  const compiled = inputsSchema.map(input => compile(input)).filter(Boolean);
  const literalObject = item => {
    if (item.valueType === 'literal') { return { known: true, value: item.value }; }
    if (item.valueType !== 'object') { return { known: false }; }
    const children = item.assignments.map(child => [child.column, literalObject(child)]);
    return children.every(([, child]) => child.known)
      ? { known: true, value: Object.fromEntries(children.map(([name, child]) => [name, child.value])) } : { known: false };
  };
  const needsJsonValue = value => typeof value === 'number' || value === null || Array.isArray(value)
    || (value && typeof value === 'object' && Object.values(value).some(needsJsonValue));
  const needsJsonBody = item => item.valueType === 'literal' ? needsJsonValue(item.value)
    : item.valueType === 'object' && item.assignments.some(needsJsonBody);
  const validateJsonValue = (value, inputPath) => {
    if (value === null) { runtimeError('json_null_unsupported', inputPath); }
    if (typeof value === 'number' && !Number.isFinite(value)) { runtimeError('literal_type_invalid', inputPath); }
    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([name, child]) => validateJsonValue(child, `${inputPath}.${name}`));
    }
  };
  const jsonBodyExpression = (item, parent) => {
    const inputPath = parent ? `${parent}.${item.column}` : item.column;
    if (item.valueType === 'literal') {
      validateJsonValue(item.value, inputPath);
      // Encode JSON data, then encode that fragment as a formula string literal.
      return JSON.stringify(JSON.stringify(item.value));
    }
    if (item.valueType === 'object') {
      const parts = [JSON.stringify('{')];
      item.assignments.forEach((child, childIndex) => {
        parts.push(JSON.stringify(`${childIndex ? ',' : ''}${JSON.stringify(child.column)}:`), jsonBodyExpression(child, inputPath));
      });
      parts.push(JSON.stringify('}'));
      return `CONCATENATE(${parts.join(',')})`;
    }
    let expression = item.value;
    if (item.valueType === 'processVar') {
      // A processVar is a key/reference, never arbitrary executable formula text.
      if (typeof expression !== 'string') { runtimeError('json_reference_invalid', inputPath); }
      if (/^[A-Za-z_]\w*$/.test(expression)) { expression = `#{${expression}}`; }
      else if (!/^#\{[A-Za-z_]\w*\}$/.test(expression)
        && !/^(?:\$\{[A-Za-z_]\w*\}|[A-Za-z_]\w*)(?:\.[A-Za-z_]\w*)+$/.test(expression)) {
        runtimeError('json_reference_invalid', inputPath);
      }
    }
    // Native one-argument TEXT serializes JSON, including quotes/control chars.
    // Its null result is empty text, so emit JSON null explicitly.
    return `IF(ISNULL(${expression}),"null",TEXT(${expression}))`;
  };
  const mixedBody = (item, parent) => {
    const inputPath = parent ? `${parent}.${item.column}` : item.column;
    if (item.valueType === 'object') { return { ...item, assignments: item.assignments.map(child => mixedBody(child, inputPath)) }; }
    if (item.valueType !== 'literal') { return item; }
    if (typeof item.value === 'boolean') {
      return { ...item, valueType: 'column', value: item.value ? 'TRUE()' : 'FALSE()' };
    }
    if (item.value !== null && typeof item.value === 'object' && !Array.isArray(item.value)) {
      return { ...item, valueType: 'object', value: '', assignments: Object.entries(item.value)
        .map(([column, value]) => mixedBody({ column, valueType: 'literal', value, assignments: [] }, inputPath)) };
    }
    if (typeof item.value === 'number' || item.value === null || Array.isArray(item.value)) {
      runtimeError('mixed_body_type_unverified', inputPath);
    }
    return item;
  };
  return compiled.map(item => {
    if (item.column !== 'Body') { return item; }
    const literal = literalObject(item);
    // Native root Body parsing preserves JSON types, while leaf literal values
    // are always strings in the engine. Keep mixed variable bindings explicit.
    if (literal.known) {
      let jsonValue = literal.value;
      if (item.valueType === 'literal' && typeof jsonValue === 'string') {
        try { jsonValue = JSON.parse(jsonValue); } catch (_error) { /* Keep existing raw-Body handling. */ }
      }
      validateJsonValue(jsonValue, item.column);
      return { ...item, valueType: 'literal', value: item.valueType === 'literal' && typeof item.value === 'string'
        ? item.value : JSON.stringify(literal.value), assignments: [] };
    }
    if (needsJsonBody(item)) {
      return { ...item, valueType: 'column', value: jsonBodyExpression(item), assignments: [] };
    }
    return mixedBody(item);
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
    connectorId, actionId, connectorAssignments, connectorDescription, connectorInputs,
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
          assignments: buildConnectorCallAssignments(connectorAssignments || [], new Map(), normalizedConnectorMode === 5 ? connectorInputs : []),
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
