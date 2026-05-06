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

  test('buildDataCreateAssignments preserves literals and converts numeric literals', () => {
    expect(buildDataCreateAssignments([
      { column: 'numberField_count', valueType: 'literal', value: '12' },
      { column: 'textField_name', valueType: 'processVar', value: 'form_inst_creator' },
    ])).toEqual([
      { column: 'numberField_count', valueType: 'literal', value: 12, assignments: [] },
      { column: 'textField_name', valueType: 'processVar', value: 'form_inst_creator', assignments: [] },
    ]);
  });

  test('buildProcessJson links trigger, data, message, and finish nodes in order', () => {
    const processJson = buildProcessJson({
      processCode: 'LPROC-TEST',
      formUuid: 'FORM-A',
      appType: 'APP-A',
      formEventTypes: ['insert'],
      notificationTitle: 'Title',
      notificationContent: 'Content',
      toUsers: ['user1'],
      nodeIds: ['trigger', 'add', 'data', 'message', 'end'],
      addDataFormUuid: 'FORM-B',
      addDataAssignments: [{ column: 'textField_name', valueType: 'literal', value: 'Ada' }],
      dataFormUuid: 'FORM-C',
      dataConditions: [{ bFieldId: 'field_b', bFieldName: 'B', aFieldId: 'field_a' }],
      hasMessageNode: true,
    });

    expect(processJson.props.processCode).toBe('LPROC-TEST');
    expect(processJson.nodes.map((node) => node.type)).toEqual([
      'trigger',
      'dataCreate',
      'dataRetrieve',
      'sendMessage',
      'finish',
    ]);
    expect(processJson.nodes[0].nextId).toEqual(['add']);
    expect(processJson.nodes[1].nextId).toEqual(['data']);
    expect(processJson.nodes[2].nextId).toEqual(['message']);
    expect(processJson.nodes[3].props.messageInfo.buttons[0].buttonUuid).toBe('button-fixed');
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
});
