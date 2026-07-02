'use strict';

jest.mock('../lib/integration/integration-node-ids', () => ({
  generateRuleGroupId: jest.fn(() => 'group-fixed'),
  generateRuleItemId: jest.fn(() => 'item-fixed'),
  generateDataRuleId: jest.fn(() => 'rule-fixed'),
  generateButtonUuid: jest.fn(() => 'button-fixed'),
}));

const {
  mapEventTypes,
  buildDataRetrieveCondition,
  buildDataCreateAssignments,
  buildProcessJson,
} = require('../lib/integration/integration-process-builder');
const { buildViewJson } = require('../lib/integration/integration-view-builder');

describe('integration process builder', () => {
  test('mapEventTypes normalizes supported aliases and drops unknown events', () => {
    expect(mapEventTypes(['create', 'insert', 'UPDATE', 'delete', 'unknown'])).toEqual([
      'insert',
      'insert',
      'update',
      'delete',
    ]);
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

  test('buildDataCreateAssignments preserves literals and converts numeric literals', () => {
    expect(buildDataCreateAssignments([
      { column: 'numberField_count', valueType: 'literal', value: '12' },
      { column: 'textField_name', valueType: 'processVar', value: 'form_inst_creator' },
    ])).toEqual([
      { column: 'numberField_count', valueType: 'literal', value: 12, assignments: [] },
      { column: 'textField_name', valueType: 'processVar', value: 'form_inst_creator', assignments: [] },
    ]);
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
      addDataFormSchema: [],
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
    });

    expect(processJson.nodes.map((n) => n.type)).toEqual(['trigger', 'httpConnector', 'finish']);
    expect(processJson.nodes[1].props.inputs).toMatchObject({
      connectorId: 'Http_2ed1618fdc744a288e5cb52bc02e462f',
      actionId: 'publish_month_qs',
      connectionId: '28336',
      connectorMode: 5,
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
