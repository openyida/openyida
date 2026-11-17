'use strict';

const vm = require('vm');

jest.mock('../lib/integration/integration-node-ids', () => ({
  generateRuleGroupId: jest.fn(() => 'group-fixed'),
  generateRuleItemId: jest.fn(() => 'item-fixed'),
  generateDataRuleId: jest.fn(() => 'rule-fixed'),
  generateButtonUuid: jest.fn(() => 'button-fixed'),
}));

const {
  mapEventTypes,
  buildTriggerCondition,
  buildDataRetrieveCondition,
  buildDataCreateAssignments,
  buildInitiateApprovalAssignments,
  buildConnectorCallAssignments,
  resolveConnectorMode,
  buildProcessJson,
} = require('../lib/integration/integration-process-builder');
const { buildViewJson } = require('../lib/integration/integration-view-builder');

describe('HTTP connector runtime assignments', () => {
  const inputs = [
    { name: 'Headers', paramLocation: 'header', childList: [{ name: 'Content-Type' }] },
    { name: 'Body', paramLocation: 'body', childList: [
      { name: 'options', childList: [{ name: 'enabled', paramType: 'Boolean' }, { name: 'count', paramType: 'Number' }] },
      { name: 'tagName' }, { name: 'metadata.key' },
    ] },
  ];
  const assignments = [
    { column: 'Headers.Content-Type', valueType: 'literal', value: 'application/json' },
    { column: 'Body.options.enabled', valueType: 'literal', value: false },
    { column: 'Body.options.count', valueType: 'literal', value: 7 },
    { column: 'Body.tagName', valueType: 'literal', value: 'owned-tag' },
    { column: 'Body.metadata.key', valueType: 'literal', value: 'literal-dot-name' },
  ];
  const readEngineAssignments = list => Object.fromEntries(list.map(item => [item.column,
    item.valueType === 'object' ? readEngineAssignments(item.assignments)
      : item.column === 'Body' && item.valueType === 'literal' ? JSON.parse(item.value) : item.value]));
  // Model the native JSON-expression boundary; the Java/JEP and real-platform
  // acceptance tests separately verify these native function contracts.
  const evaluateBody = (body, values) => {
    const expression = body.value.replace(/"(?:\\.|[^"\\])*"|#\{([^}]+)\}|\$\{([^}]+)\}((?:\.[A-Za-z_]\w*)+)/g,
      (token, field, node, path) => token.startsWith('"') ? token : `values[${JSON.stringify(field || `${node}${path}`)}]`);
    return JSON.parse(vm.runInNewContext(expression, {
      values, CONCATENATE: (...parts) => parts.join(''), TEXT: value => value === null || value === undefined ? '' : JSON.stringify(value),
      ISNULL: value => value === null || value === undefined, IF: (condition, yes, no) => condition ? yes : no,
    }));
  };

  test('simple CLI runtime exposes actual Headers/Body objects consumed by the engine', () => {
    const built = buildProcessJson({ processCode: 'LPROC-HTTP', appType: 'APP-HTTP', formUuid: 'FORM-HTTP',
      nodeIds: ['trigger', 'connector', 'end'], formEventTypes: ['insert'], connectorId: 'Http_owned',
      actionId: 'owned', connectorMode: 5, connectorInputs: inputs, connectorAssignments: assignments });
    const native = built.nodes.find(node => node.type === 'httpConnector').props.inputs.assignments;
    expect(readEngineAssignments(native)).toEqual({ Headers: { 'Content-Type': 'application/json' },
      Body: { options: { enabled: false, count: 7 }, tagName: 'owned-tag', 'metadata.key': 'literal-dot-name' } });
    expect(native[1].valueType).toBe('literal');
  });

  test('mixed variable/boolean mappings keep object structure and use only fixed boolean expressions', () => {
    const native = buildConnectorCallAssignments([
      assignments[1], { ...assignments[2], valueType: 'processVar', value: 'numberField_count' },
      { ...assignments[3], valueType: 'processVar', value: 'textField_marker' },
    ], new Map(), inputs);
    expect(native[0]).toMatchObject({ column: 'Body', valueType: 'object' });
    expect(native[0].assignments[0].assignments).toEqual([
      { column: 'enabled', valueType: 'column', value: 'FALSE()', assignments: [] },
      { column: 'count', valueType: 'processVar', value: 'numberField_count', assignments: [] },
    ]);
    expect(native[0].assignments[1]).toMatchObject({ column: 'tagName', valueType: 'processVar', value: 'textField_marker' });
  });

  test.each([0, 7, -2.25, 1e21])('mixed numeric constant %p stays a JSON number with escaped dynamic text', value => {
    const native = buildConnectorCallAssignments([
      { ...assignments[2], value }, { ...assignments[3], valueType: 'processVar', value: 'textField_marker' },
    ], new Map(), inputs);
    expect(native[0]).toMatchObject({ column: 'Body', valueType: 'column', assignments: [] });
    const marker = 'quoted" slash\\ newline\n tab\t\u0000 中文😺';
    expect(evaluateBody(native[0], { textField_marker: marker })).toEqual({ options: { count: value }, tagName: marker });
  });

  test('mixed literal objects preserve nested booleans and leave formula-looking text unevaluated', () => {
    const native = buildConnectorCallAssignments([
      { column: 'Body.options', valueType: 'literal', value: {
        enabled: true, nested: { disabled: false, text: 'TRUE()', digits: '0012', empty: {} },
      } },
      { column: 'Body.tagName', valueType: 'processVar', value: 'textField_marker' },
    ], new Map(), inputs);
    expect(native[0].assignments).toEqual([
      { column: 'options', valueType: 'object', value: '', assignments: [
        { column: 'enabled', valueType: 'column', value: 'TRUE()', assignments: [] },
        { column: 'nested', valueType: 'object', value: '', assignments: [
          { column: 'disabled', valueType: 'column', value: 'FALSE()', assignments: [] },
          { column: 'text', valueType: 'literal', value: 'TRUE()', assignments: [] },
          { column: 'digits', valueType: 'literal', value: '0012', assignments: [] },
          { column: 'empty', valueType: 'object', value: '', assignments: [] },
        ] },
      ] },
      { column: 'tagName', valueType: 'processVar', value: 'textField_marker', assignments: [] },
    ]);
  });

  test.each([7, []])('mixed object member %p retains its JSON value', value => {
    const native = buildConnectorCallAssignments([
      { column: 'Body.options', valueType: 'literal', value: { nested: { member: value } } },
      { column: 'Body.tagName', valueType: 'processVar', value: 'textField_marker' },
    ], new Map(), inputs);
    expect(evaluateBody(native[0], { textField_marker: 'owned' })).toEqual({ options: { nested: { member: value } }, tagName: 'owned' });
  });

  test.each([false, true])('fixed null members reject before runtime can omit them (mixed=%p)', mixed => {
    expect(() => buildConnectorCallAssignments([
      { column: 'Body.options', valueType: 'literal', value: { nested: { empty: null } } },
      { column: 'Body.tagName', valueType: mixed ? 'processVar' : 'literal', value: 'textField_marker' },
    ], new Map(), inputs)).toThrow(expect.objectContaining({
      code: 'INTEGRATION_CONNECTOR_JSON_NULL_UNSUPPORTED',
      details: expect.objectContaining({ path: 'Body.options.nested.empty', remoteWrites: 0 }),
    }));
  });

  test('raw JSON Body cannot bypass the fixed-null guard', () => {
    expect(() => buildConnectorCallAssignments([{ column: 'Body', valueType: 'literal', value: '{"empty":null}' }], new Map(), inputs))
      .toThrow(expect.objectContaining({ code: 'INTEGRATION_CONNECTOR_JSON_NULL_UNSUPPORTED', details: expect.objectContaining({ remoteWrites: 0 }) }));
  });

  test.each([null, '', 'null', false, 0, ['owned'], { owned: true }])('dynamic JSON value %p preserves type and null semantics', value => {
    const native = buildConnectorCallAssignments([
      assignments[2], { column: 'Body.tagName', valueType: 'processVar', value: 'textField_marker' },
      { column: 'Body.metadata.key', valueType: 'literal', value: '"),DELETE(#{notAReference})' },
    ], new Map(), inputs);
    expect(evaluateBody(native[0], { textField_marker: value })).toEqual({ options: { count: 7 }, tagName: value,
      'metadata.key': '"),DELETE(#{notAReference})' });
  });

  test.each(['TEXT(#{field})', '#{field}),DELETE(1)', 'invalid-field', ['field'], { field: 'field' }])('processVar %p cannot become executable code', value => {
    expect(() => buildConnectorCallAssignments([
      assignments[2], { column: 'Body.tagName', valueType: 'processVar', value },
    ], new Map(), inputs)).toThrow(expect.objectContaining({
      code: 'INTEGRATION_CONNECTOR_JSON_REFERENCE_INVALID', details: expect.objectContaining({ remoteWrites: 0 }),
    }));
  });

  test('resolved upstream node references remain references in generated JSON', () => {
    const native = buildConnectorCallAssignments([
      assignments[2], { column: 'Body.tagName', valueType: 'processVar', value: '${node_owned}.textField_marker' },
    ], new Map(), inputs);
    expect(evaluateBody(native[0], { 'node_owned.textField_marker': 'upstream' })).toEqual({ options: { count: 7 }, tagName: 'upstream' });
  });

  test.each([NaN, Infinity, -Infinity])('non-finite nested JSON number %p rejects before serialization', value => {
    expect(() => buildConnectorCallAssignments([
      { column: 'Body.options', valueType: 'literal', value: { count: value } },
    ], new Map(), inputs)).toThrow(expect.objectContaining({
      code: 'INTEGRATION_CONNECTOR_LITERAL_TYPE_INVALID', details: expect.objectContaining({ path: 'Body.options.count', remoteWrites: 0 }),
    }));
  });

  test('declared primitive strings normalize only as their proven Body schema types', () => {
    const native = buildConnectorCallAssignments([
      { ...assignments[1], value: 'false' }, { ...assignments[2], value: '7' }, assignments[4],
    ], new Map(), inputs);
    expect(JSON.parse(native[0].value)).toEqual({ options: { enabled: false, count: 7 }, 'metadata.key': 'literal-dot-name' });
    expect(() => buildConnectorCallAssignments([{ ...assignments[1], value: 'not-a-boolean' }], new Map(), inputs))
      .toThrow(expect.objectContaining({ code: 'INTEGRATION_CONNECTOR_LITERAL_TYPE_INVALID' }));
  });

  test('unknown and overlapping parent/child targets fail instead of silently losing fields', () => {
    expect(() => buildConnectorCallAssignments([{ column: 'Body.missing', valueType: 'literal', value: 'x' }], new Map(), inputs))
      .toThrow(expect.objectContaining({ code: 'INTEGRATION_CONNECTOR_INPUT_UNKNOWN' }));
    expect(() => buildConnectorCallAssignments([
      { column: 'Body.options', valueType: 'literal', value: '{}' }, assignments[1],
    ], new Map(), inputs)).toThrow(expect.objectContaining({ code: 'INTEGRATION_CONNECTOR_ASSIGNMENT_DUPLICATE' }));
  });

  test('inner connector and callers without HTTP schema keep the original flat contract', () => {
    expect(buildConnectorCallAssignments(assignments.slice(-1))).toEqual([
      { ...assignments.at(-1), assignments: [] },
    ]);
  });
});

describe('integration process builder', () => {
  test('mapEventTypes normalizes supported aliases and rejects unknown events', () => {
    expect(mapEventTypes(['create', 'insert', 'UPDATE', 'delete'])).toEqual([
      'insert',
      'insert',
      'update',
      'delete',
    ]);
    expect(() => mapEventTypes(['insert', 'unknown'])).toThrow(/Unsupported integration event: unknown/);
  });

  test('buildDataRetrieveCondition creates deterministic rule structure around field mapping', () => {
    const condition = buildDataRetrieveCondition([
      {
        bFieldId: 'textField_name',
        bFieldName: 'Name',
        aFieldId: 'form_inst_creator',
        componentType: 'TextField',
      },
    ]);

    expect(condition).toMatchObject({
      condition: 'AND',
      ruleId: 'group-fixed',
      conditionCode: '&&',
    });
    expect(condition.rules[0]).toMatchObject({
      id: 'textField_name',
      op: '包含',
      ruleId: 'item-fixed',
      parentId: 'group-fixed',
      value: 'form_inst_creator',
      valueType: 'processVar',
      opCode: 'Contain',
    });
  });

  test('buildDataRetrieveCondition supports runtime-safe get-self matching by instance id', () => {
    const condition = buildDataRetrieveCondition([
      {
        bFieldId: 'pid',
        bFieldName: '表单实例ID',
        aFieldId: '__masterdata_form_inst_id',
        componentType: 'TextField',
        opCode: 'Equal',
      },
    ]);

    expect(condition.rules[0]).toMatchObject({
      id: 'pid',
      op: '等于',
      value: '__masterdata_form_inst_id',
      valueType: 'processVar',
      opCode: 'Equal',
    });
  });

  test.each([
    ['GreaterThan', 'Bigger', '大于'], ['GreaterThanOrEqual', 'BiggerOrEqual', '大于等于'],
    ['LessThan', 'Lesser', '小于'], ['LessThanOrEqual', 'LesserOrEqual', '小于等于'],
    ['Bigger', 'Bigger', '大于'], ['Lesser', 'Lesser', '小于'],
  ])('compiles query comparison %s to native %s without changing the field reference', (input, opCode, op) => {
    const rules = buildDataRetrieveCondition([{
      bFieldId: 'numberField_target', aFieldId: '${node_source}.numberField_limit',
      componentType: 'NumberField', valueType: 'processVar', opCode: input,
    }]).rules;
    expect(rules[0]).toMatchObject({ opCode, op, valueType: 'processVar', extValue: 'processVar',
      value: '${node_source}.numberField_limit', ruleValue: '${node_source}.numberField_limit' });
  });

  test('buildDataRetrieveCondition preserves explicit primitive literal values', () => {
    const condition = buildDataRetrieveCondition([
      {
        bFieldId: 'numberField_zero',
        bFieldName: 'Zero',
        aFieldId: 0,
        componentType: 'NumberField',
        opCode: 'Equal',
        valueType: 'literal',
      },
      {
        bFieldId: 'checkboxField_false',
        bFieldName: 'False',
        value: false,
        componentType: 'CheckboxField',
        opCode: 'Equal',
        valueType: 'literal',
      },
      {
        bFieldId: 'textField_empty',
        bFieldName: 'Empty',
        ruleValue: '',
        componentType: 'TextField',
        opCode: 'Equal',
        valueType: 'literal',
      },
    ]);

    expect(condition.rules.map((rule) => rule.value)).toEqual([0, false, '']);
    expect(condition.rules.map((rule) => rule.ruleValue)).toEqual([0, false, '']);
  });

  test('literal conversion requires explicit numeric component evidence', () => {
    expect(buildDataCreateAssignments([
      { column: 'numberField_count', valueType: 'literal', value: '12' },
      { column: 'textField_name', valueType: 'processVar', value: 'form_inst_creator' },
    ])).toEqual([
      { column: 'numberField_count', valueType: 'literal', value: '12', assignments: [] },
      { column: 'textField_name', valueType: 'processVar', value: 'form_inst_creator', assignments: [] },
    ]);

    expect(buildDataCreateAssignments(
      [{ column: 'numberField_count', valueType: 'literal', value: '12' }],
      new Map([['numberField_count', 'NumberField']])
    )[0].value).toBe(12);
    expect(buildTriggerCondition([
      { fieldId: 'textField_code', valueType: 'literal', value: '0012', componentType: 'TextField' },
    ]).rules[0].value).toBe('0012');
  });

  test('buildInitiateApprovalAssignments matches designer payload shape', () => {
    const assignments = [
      { column: 'textField_process', valueType: 'literal', value: 'hello' },
      { column: 'numberField_count', valueType: 'literal', value: '7' },
    ];

    expect(buildInitiateApprovalAssignments(assignments, { includeRequired: false })).toEqual([
      { column: 'textField_process', valueType: 'literal', value: 'hello' },
      { column: 'numberField_count', valueType: 'literal', value: '7' },
    ]);
    expect(buildInitiateApprovalAssignments(assignments, { includeRequired: true })[0]).toMatchObject({
      column: 'textField_process',
      valueType: 'literal',
      value: 'hello',
      required: false,
    });
  });

  test('resolveConnectorMode rejects connector modes outside the declared OpenYida scope', () => {
    expect(resolveConnectorMode('G-CONN', 1)).toBe(1);
    expect(resolveConnectorMode('Http_123', 5)).toBe(5);
    expect(() => resolveConnectorMode('G-CONN', 3)).toThrow(/Unsupported connector mode: 3/);
    expect(() => resolveConnectorMode('G-CONN', 8)).toThrow(/Unsupported connector mode: 8/);
    expect(() => resolveConnectorMode('G-CONN', 9)).toThrow(/Unsupported connector mode: 9/);
  });

  test('buildProcessJson links trigger, data, add-data, message, and finish nodes in order', () => {
    const processJson = buildProcessJson({
      processCode: 'LPROC-TEST',
      formUuid: 'FORM-A',
      appType: 'APP-A',
      formEventTypes: ['insert'],
      notificationTitle: 'Title',
      notificationContent: 'Content',
      toUsers: ['user1'],
      nodeIds: ['trigger', 'data', 'add', 'message', 'end'],
      addDataFormUuid: 'FORM-B',
      addDataAssignments: [{ column: 'textField_name', valueType: 'literal', value: 'Ada' }],
      dataFormUuid: 'FORM-C',
      dataConditions: [{ bFieldId: 'field_b', bFieldName: 'B', aFieldId: 'field_a' }],
      hasMessageNode: true,
    });

    expect(processJson.props.processCode).toBe('LPROC-TEST');
    expect(processJson.nodes.map((node) => node.type)).toEqual([
      'trigger',
      'dataRetrieve',
      'dataCreate',
      'sendMessage',
      'finish',
    ]);
    expect(processJson.nodes[0].nextId).toEqual(['data']);
    expect(processJson.nodes[1].nextId).toEqual(['add']);
    expect(processJson.nodes[2].nextId).toEqual(['message']);
    expect(processJson.nodes[3].props.messageInfo.buttons[0].buttonUuid).toBe('button-fixed');
    expect(processJson.nodes[3].props.messageInfo.buttons[0].value).toBe('//yidalogin.aliwork.com/APP-A/formDetail/FORM-A?formInstId=${formInstId}&isRenderNav=false');
  });

  test('buildViewJson keeps get-data before add-data on the canvas', () => {
    const viewJson = buildViewJson({
      formUuid: 'FORM-A',
      appType: 'APP-A',
      formEventTypes: ['insert'],
      notificationTitle: 'Title',
      notificationContent: 'Content',
      toUsers: [{ userId: 'user1', userName: '' }],
      nodeIds: ['canvas', 'trigger', 'data', 'add', 'message', 'end'],
      addDataFormUuid: 'FORM-B',
      addDataAssignments: [{ column: 'textField_name', valueType: 'literal', value: 'Ada' }],
      addDataFormSchema: [
        { componentName: 'TextField', props: { fieldId: 'textField_name', label: 'Name' } },
      ],
      dataFormUuid: 'FORM-C',
      dataConditions: [{ bFieldId: 'field_b', bFieldName: 'B', aFieldId: 'field_a' }],
      hasMessageNode: true,
    });

    expect(viewJson.schema.children.map((node) => node.componentName)).toEqual([
      'StartNode',
      'GetSingleDataNode',
      'AddDataNode',
      'SendMessageNode',
      'EndNode',
    ]);
    expect(viewJson.schema.children[1].id).toBe('data');
    expect(viewJson.schema.children[2].id).toBe('add');
    expect(viewJson.schema.children[3].props.sendMessageRules.messageInfo.buttons[0].value).toBe('//yidalogin.aliwork.com/APP-A/formDetail/FORM-A?formInstId=${formInstId}&isRenderNav=false');
  });

  test('buildProcessJson can omit the message node and point trigger directly to finish', () => {
    const processJson = buildProcessJson({
      processCode: 'LPROC-TEST',
      formUuid: 'FORM-A',
      appType: 'APP-A',
      formEventTypes: ['update'],
      toUsers: [],
      nodeIds: ['trigger', 'end'],
      hasMessageNode: false,
    });

    expect(processJson.nodes.map((node) => node.type)).toEqual(['trigger', 'finish']);
    expect(processJson.nodes[0].nextId).toEqual(['end']);
  });

  test('buildProcessJson inserts innerConnector node when connectorId + actionId provided (对齐真实"待办"payload)', () => {
    const processJson = buildProcessJson({
      processCode: 'LPROC-TEST',
      formUuid: 'FORM-TODO',
      appType: 'APP-TODO',
      formEventTypes: ['insert'],
      toUsers: [],
      nodeIds: ['trigger', 'connector', 'end'],
      hasMessageNode: false,
      connectorId: 'G-CONN-1016B8AEBED50B01B8D00009',
      actionId: 'G-ACT-1016B8B1911A0B01B8D0000I',
      connectorAssignments: [
        { column: 'unionId', valueType: 'processVar', value: 'employeeField_xxx' },
        { column: 'subject', valueType: 'processVar', value: 'textareaField_xxx' },
        { column: 'creatorId', valueType: 'processVar', value: 'form_inst_modifier' },
      ],
    });

    expect(processJson.nodes.map((n) => n.type)).toEqual(['trigger', 'innerConnector', 'finish']);
    expect(processJson.nodes[0].nextId).toEqual(['connector']);
    expect(processJson.nodes[1].nextId).toEqual(['end']);

    const inputs = processJson.nodes[1].props.inputs;
    expect(inputs.connectorId).toBe('G-CONN-1016B8AEBED50B01B8D00009');
    expect(inputs.actionId).toBe('G-ACT-1016B8B1911A0B01B8D0000I');
    expect(inputs.url).toBe('');
    expect(inputs.method).toBe('');
    expect(inputs.assignments).toHaveLength(3);
    expect(inputs.assignments[0]).toEqual({
      column: 'unionId',
      valueType: 'processVar',
      value: 'employeeField_xxx',
      assignments: [],
    });
  });

  test('buildProcessJson inserts httpConnector node when connectorMode is 5', () => {
    const processJson = buildProcessJson({
      processCode: 'LPROC-TEST',
      formUuid: 'FORM-HTTP',
      appType: 'APP-HTTP',
      formEventTypes: ['insert'],
      toUsers: [],
      nodeIds: ['trigger', 'connector', 'end'],
      hasMessageNode: false,
      connectorId: 'Http_2ed1618fdc744a288e5cb52bc02e462f',
      actionId: 'publish_month_qs',
      connectorMode: 5,
      connectionId: '28336',
      connectorAssignments: [
        { column: 'month', valueType: 'processVar', value: 'textField_month' },
      ],
      connectorInputs: [{ name: 'month', componentName: 'TextField', paramType: 'String' }],
      connectorSchemaVerificationLevel: 'FIXED_CONTRACT_FIXTURE',
    });

    expect(processJson.nodes.map((n) => n.type)).toEqual(['trigger', 'httpConnector', 'finish']);
    expect(processJson.nodes[1].props.inputs).toMatchObject({
      connectorId: 'Http_2ed1618fdc744a288e5cb52bc02e462f',
      actionId: 'publish_month_qs',
      connectionId: '28336',
      connectorMode: 5,
    });
  });

  test('buildProcessJson keeps httpConnector mode when connectionId is omitted', () => {
    const processJson = buildProcessJson({
      processCode: 'LPROC-TEST',
      formUuid: 'FORM-HTTP',
      appType: 'APP-HTTP',
      formEventTypes: ['insert'],
      toUsers: [],
      nodeIds: ['trigger', 'connector', 'end'],
      hasMessageNode: false,
      connectorId: 'Http_2ed1618fdc744a288e5cb52bc02e462f',
      actionId: 'publish_month_qs',
      connectorMode: 5,
    });

    expect(processJson.nodes[1]).toMatchObject({
      type: 'httpConnector',
      props: { inputs: {
        connectorMode: 5,
        connection: '',
        connectionId: '',
      } },
    });
  });

  test('buildProcessJson chains dataRetrieve → innerConnector → sendMessage when all present', () => {
    const processJson = buildProcessJson({
      processCode: 'LPROC-TEST',
      formUuid: 'FORM-A',
      appType: 'APP-A',
      formEventTypes: ['insert'],
      toUsers: [{ userId: 'u1', userName: '' }],
      nodeIds: ['trigger', 'data', 'connector', 'message', 'end'],
      dataFormUuid: 'FORM-B',
      dataConditions: [{ bFieldId: 'field_b', bFieldName: 'B', aFieldId: 'field_a' }],
      hasMessageNode: true,
      connectorId: 'G-CONN-TEST',
      actionId: 'G-ACT-TEST',
      connectorAssignments: [{ column: 'subject', valueType: 'literal', value: '测试待办' }],
    });

    expect(processJson.nodes.map((n) => n.type)).toEqual([
      'trigger',
      'dataRetrieve',
      'innerConnector',
      'sendMessage',
      'finish',
    ]);
    expect(processJson.nodes[0].nextId).toEqual(['data']);
    expect(processJson.nodes[1].nextId).toEqual(['connector']);
    expect(processJson.nodes[2].nextId).toEqual(['message']);
    expect(processJson.nodes[3].nextId).toEqual(['end']);
    expect(processJson.nodes[3].props.messageInfo.buttons[0].value).toBe('//yidalogin.aliwork.com/APP-A/formDetail/FORM-A?formInstId=${formInstId}&isRenderNav=false');
  });

  test('buildProcessJson inserts initiateApproval node with captured designer rules', () => {
    const processJson = buildProcessJson({
      processCode: 'LPROC-PARENT',
      formUuid: 'FORM-A',
      appType: 'APP-A',
      formEventTypes: ['insert'],
      toUsers: [],
      nodeIds: ['trigger', 'approval', 'end'],
      hasMessageNode: false,
      initiateApprovalFormUuid: 'FORM-PROCESS-B',
      initiateApprovalFormName: 'Process B',
      initiateApprovalInitiator: {
        type: 'select_user',
        value: '{"id":"user-1","label":"Alice","type":"employee"}',
      },
      initiateApprovalAssignments: [
        { column: 'textField_b', valueType: 'literal', value: 'created-by-openyida' },
      ],
    });

    expect(processJson.nodes.map((node) => node.type)).toEqual(['trigger', 'initiateApproval', 'finish']);
    expect(processJson.nodes[0].nextId).toEqual(['approval']);
    expect(processJson.nodes[1]).toMatchObject({
      type: 'initiateApproval',
      nodeId: 'approval',
      nextId: ['end'],
      props: {
        type: 'single',
        formUuid: 'FORM-PROCESS-B',
        processCode: 'LPROC-PARENT',
        appType: 'APP-A',
        initiator: {
          type: 'select_user',
          value: '{"id":"user-1","label":"Alice","type":"employee"}',
        },
        assignments: [
          { column: 'textField_b', valueType: 'literal', value: 'created-by-openyida' },
        ],
      },
    });
    expect(processJson.nodes[1].props.description).toContain('Process B');
  });

  test('buildViewJson renders InitiateApprovalNode with required flags for the designer', () => {
    const viewJson = buildViewJson({
      processCode: 'LPROC-PARENT',
      formUuid: 'FORM-A',
      appType: 'APP-A',
      formEventTypes: ['insert'],
      toUsers: [],
      nodeIds: ['canvas', 'trigger', 'approval', 'end'],
      hasMessageNode: false,
      initiateApprovalFormUuid: 'FORM-PROCESS-B',
      initiateApprovalFormName: 'Process B',
      initiateApprovalInitiator: {
        type: 'select_user',
        value: '{"id":"user-1","label":"Alice","type":"employee"}',
      },
      initiateApprovalAssignments: [
        { column: 'textField_b', valueType: 'literal', value: 'created-by-openyida' },
      ],
    });

    expect(viewJson.schema.children.map((node) => node.componentName)).toEqual([
      'StartNode',
      'InitiateApprovalNode',
      'EndNode',
    ]);
    const approvalNode = viewJson.schema.children[1];
    expect(approvalNode.props.nodeName).toBe('InitiateApprovalNode');
    expect(approvalNode.props.signAction).toBe('one_by_one');
    expect(approvalNode.props.initiateApprovalRules).toMatchObject({
      type: 'single',
      formUuid: 'FORM-PROCESS-B',
      processCode: 'LPROC-PARENT',
      appType: 'APP-A',
      assignments: [
        {
          column: 'textField_b',
          valueType: 'literal',
          value: 'created-by-openyida',
          required: false,
        },
      ],
    });
  });

  test('buildViewJson keeps HTTP connector metadata for the designer side panel', () => {
    const viewJson = buildViewJson({
      processCode: 'LPROC-TEST',
      formUuid: 'FORM-HTTP',
      appType: 'APP-HTTP',
      formEventTypes: ['insert'],
      toUsers: [],
      nodeIds: ['canvas', 'trigger', 'connector', 'end'],
      hasMessageNode: false,
      connectorId: 'Http_2ed1618fdc744a288e5cb52bc02e462f',
      actionId: 'publish_month_qs',
      connectorMode: 5,
      connectionId: '28336',
      connectorName: 'Http_2ed1618fdc744a288e5cb52bc02e462f',
      connectorDisplayName: '加福加德BI后端',
      connectorAssignments: [
        { column: 'month', valueType: 'processVar', value: 'textField_month' },
      ],
      connectorInputs: [{ name: 'month', componentName: 'TextField', paramType: 'String' }],
      connectorSchemaVerificationLevel: 'FIXED_CONTRACT_FIXTURE',
    });

    const connectorNode = viewJson.schema.children.find((node) => node.componentName === 'ConnectorNode');
    expect(connectorNode.props.name).toBe('加福加德BI后端');
    expect(connectorNode.props.connectorRules).toMatchObject({
      connectorId: 'Http_2ed1618fdc744a288e5cb52bc02e462f',
      actionId: 'publish_month_qs',
      connectionId: '28336',
      connector: {
        connectorId: 'Http_2ed1618fdc744a288e5cb52bc02e462f',
        connectorName: 'Http_2ed1618fdc744a288e5cb52bc02e462f',
        mode: 5,
        connectorMode: 5,
        name: '加福加德BI后端',
        displayName: '加福加德BI后端',
      },
    });
  });
});
