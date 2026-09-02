'use strict';

jest.mock('../lib/integration/integration-node-ids', () => {
  let counter = 0;
  return {
    generateNodeId: jest.fn(() => `node-${++counter}`),
    generateRuleGroupId: jest.fn(() => 'group-fixed'),
    generateRuleItemId: jest.fn(() => 'item-fixed'),
    generateDataRuleId: jest.fn(() => 'rule-fixed'),
    generateButtonUuid: jest.fn(() => 'button-fixed'),
  };
});

const { buildProcessJson } = require('../lib/integration/integration-process-builder');
const { buildViewJson } = require('../lib/integration/integration-view-builder');
const { buildSpecProcessAndViewJson } = require('../lib/integration/integration-spec-builder');

function getFlatMessagePair(options = {}) {
  const common = {
    processCode: 'LPROC-CONSISTENCY',
    formUuid: 'FORM-A',
    appType: 'APP-A',
    formEventTypes: ['insert'],
    notificationTitle: 'Title',
    notificationContent: 'Content',
    toUsers: [{ userId: 'user-1', userName: '' }],
    userFields: [],
    hasMessageNode: true,
    ...options,
  };
  const processJson = buildProcessJson({ ...common, nodeIds: ['trigger', 'message', 'end'] });
  const viewJson = buildViewJson({ ...common, nodeIds: ['canvas', 'trigger', 'message', 'end'] });
  return {
    process: processJson.nodes.find((node) => node.type === 'sendMessage').props,
    view: viewJson.schema.children.find((node) => node.componentName === 'SendMessageNode').props.sendMessageRules,
  };
}

describe('integration process/view builder consistency', () => {
  test('unknown connector actions fail closed instead of synthesizing TextField inputs', () => {
    expect(() => buildViewJson({
      processCode: 'LPROC-UNKNOWN',
      formUuid: 'FORM-A',
      appType: 'APP-A',
      formEventTypes: ['insert'],
      connectorId: 'Http_unknown',
      actionId: 'missing',
      connectorMode: 5,
      connectorAssignments: [{ column: 'amount', valueType: 'literal', value: 1 }],
      hasMessageNode: false,
      toUsers: [],
      nodeIds: ['canvas', 'trigger', 'connector', 'end'],
    })).toThrow(expect.objectContaining({ code: 'INTEGRATION_CONNECTOR_SCHEMA_UNVERIFIED' }));
  });

  test('flat builders preserve the exact declared recipient collections without implicit user fields', () => {
    const pair = getFlatMessagePair();

    expect({ toUsers: pair.process.toUsers, userFields: pair.process.userFields }).toEqual({
      toUsers: [{ userId: 'user-1', userName: '' }],
      userFields: [],
    });
    expect({ toUsers: pair.view.toUsers, userFields: pair.view.userFields }).toEqual({
      toUsers: pair.process.toUsers,
      userFields: pair.process.userFields,
    });
  });

  test('spec builder process/view outputs preserve the exact declared recipient collections', () => {
    const built = buildSpecProcessAndViewJson({
      spec: {
        events: ['insert'],
        nodes: [{
          id: 'notify',
          type: 'sendMessage',
          receivers: ['user-1'],
          userFields: [],
          content: 'Content',
        }],
      },
      processCode: 'LPROC-SPEC',
      formUuid: 'FORM-A',
      appType: 'APP-A',
      flowName: 'Spec Flow',
    });
    const process = built.processJson.nodes.find((node) => node.type === 'sendMessage').props;
    const view = built.viewJson.schema.children.find((node) => node.componentName === 'SendMessageNode').props.sendMessageRules;

    expect({ toUsers: process.toUsers, userFields: process.userFields }).toEqual({
      toUsers: [{ userId: 'user-1', userName: '' }],
      userFields: [],
    });
    expect({ toUsers: view.toUsers, userFields: view.userFields }).toEqual({
      toUsers: process.toUsers,
      userFields: process.userFields,
    });
  });

  test('spec builder keeps declared HTTP connector mode and connection metadata in process/view', () => {
    const built = buildSpecProcessAndViewJson({
      spec: {
        events: ['insert'],
        nodes: [{
          id: 'http',
          type: 'connector',
          connectorId: 'Http_123',
          actionId: 'publish',
          connectorMode: 5,
          connectionId: 'connection-1',
          name: 'HTTP connector',
          assignments: [{ column: 'code', valueType: 'literal', value: '0012' }],
          inputs: [{ name: 'code', componentName: 'TextField', paramType: 'String' }],
          outputs: [],
          schemaVerificationLevel: 'FIXED_CONTRACT_FIXTURE',
        }],
      },
      processCode: 'LPROC-SPEC',
      formUuid: 'FORM-A',
      appType: 'APP-A',
      flowName: 'Spec Flow',
    });
    const process = built.processJson.nodes.find((node) => node.nodeId === built.nodeIdMap.http);
    const view = built.viewJson.schema.children.find((node) => node.id === built.nodeIdMap.http);

    expect(process).toMatchObject({
      type: 'httpConnector',
      props: { inputs: {
        connectorId: 'Http_123',
        actionId: 'publish',
        connectorMode: 5,
        connection: 'connection-1',
        connectionId: 'connection-1',
      } },
    });
    expect(view.props.connectorRules).toMatchObject({
      connectorId: 'Http_123',
      actionId: 'publish',
      connectionId: 'connection-1',
      connector: { connectorMode: 5, mode: 5 },
    });
    expect(process.props.inputs.assignments[0].value).toBe('0012');
    expect(view.props.connectorRules.rules[0].rules[0].value).toBe('0012');
  });

  test('flat and spec builders keep HTTP mode without requiring connectionId', () => {
    const flatOptions = {
      processCode: 'LPROC-FLAT-HTTP',
      formUuid: 'FORM-A',
      appType: 'APP-A',
      formEventTypes: ['insert'],
      connectorId: 'Http_123',
      actionId: 'publish',
      connectorMode: 5,
      hasMessageNode: false,
      toUsers: [],
      connectorInputs: [],
      connectorOutputs: [],
      connectorSchemaVerificationLevel: 'FIXED_CONTRACT_FIXTURE',
    };
    const flatProcess = buildProcessJson({ ...flatOptions, nodeIds: ['trigger', 'connector', 'end'] });
    const flatView = buildViewJson({ ...flatOptions, nodeIds: ['canvas', 'trigger', 'connector', 'end'] });
    const flatProcessConnector = flatProcess.nodes.find((node) => node.type === 'httpConnector');
    const flatViewConnector = flatView.schema.children.find((node) => node.componentName === 'ConnectorNode');

    expect(flatProcessConnector.props.inputs).toMatchObject({
      connectorMode: 5,
      connection: '',
      connectionId: '',
    });
    expect(flatViewConnector.props.connectorRules).toMatchObject({
      connectionId: '',
      connector: { connectorMode: 5, mode: 5 },
    });

    const specBuilt = buildSpecProcessAndViewJson({
      spec: {
        events: ['insert'],
        nodes: [{
          id: 'http',
          type: 'connector',
          connectorId: 'Http_123',
          actionId: 'publish',
          inputs: [],
          outputs: [],
          schemaVerificationLevel: 'FIXED_CONTRACT_FIXTURE',
        }],
      },
      processCode: 'LPROC-SPEC-HTTP',
      formUuid: 'FORM-A',
      appType: 'APP-A',
      flowName: 'Spec HTTP',
    });
    const specProcessConnector = specBuilt.processJson.nodes.find((node) => node.nodeId === specBuilt.nodeIdMap.http);
    const specViewConnector = specBuilt.viewJson.schema.children.find((node) => node.id === specBuilt.nodeIdMap.http);

    expect(specProcessConnector).toMatchObject({
      type: 'httpConnector',
      props: { inputs: { connectorMode: 5, connection: '', connectionId: '' } },
    });
    expect(specViewConnector.props.connectorRules).toMatchObject({
      connectionId: '',
      connector: { connectorMode: 5, mode: 5 },
    });
  });

  test('flat builder outputs keep node order and typed assignments aligned across process/view', () => {
    const common = {
      processCode: 'LPROC-FLAT',
      formUuid: 'FORM-A',
      appType: 'APP-A',
      formEventTypes: ['insert'],
      addDataFormUuid: 'FORM-B',
      addDataFormSchema: [
        { componentName: 'TextField', props: { fieldId: 'textField_code', label: 'Code' } },
        { componentName: 'NumberField', props: { fieldId: 'numberField_count', label: 'Count' } },
      ],
      addDataAssignments: [
        { column: 'textField_code', valueType: 'literal', value: '0012' },
        { column: 'numberField_count', valueType: 'literal', value: '12' },
      ],
      notificationTitle: 'Title',
      notificationContent: 'Content',
      toUsers: [{ userId: 'user-1', userName: '' }],
      userFields: ['employeeField_owner'],
      hasMessageNode: true,
    };
    const processJson = buildProcessJson({ ...common, nodeIds: ['trigger', 'create', 'message', 'end'] });
    const viewJson = buildViewJson({ ...common, nodeIds: ['canvas', 'trigger', 'create', 'message', 'end'] });
    const viewNodes = viewJson.schema.children;

    expect(processJson.nodes.map((node) => node.nodeId)).toEqual(viewNodes.map((node) => node.id));
    expect(processJson.nodes.map((node) => node.type)).toEqual([
      'trigger', 'dataCreate', 'sendMessage', 'finish',
    ]);
    expect(viewNodes.map((node) => node.componentName)).toEqual([
      'StartNode', 'AddDataNode', 'SendMessageNode', 'EndNode',
    ]);
    const processCreate = processJson.nodes[1].props.assignments;
    const viewCreate = viewNodes[1].props.addDataRules.rules.rules;
    const viewAssignments = viewNodes[1].props.addDataRules.assignments;
    expect(processCreate.map(({ column, valueType, value }) => ({ column, valueType, value }))).toEqual(
      viewCreate.map((rule) => ({ column: rule.name, valueType: rule.valueType, value: rule.value }))
    );
    expect(viewAssignments.map((rule) => ({ column: rule.name, valueType: rule.valueType, value: rule.value }))).toEqual(
      viewCreate.map((rule) => ({ column: rule.name, valueType: rule.valueType, value: rule.value }))
    );
    expect(viewNodes[1].props.addDataRules.description).toBe(viewNodes[1].props.description);
    expect(processCreate.map((assignment) => assignment.value)).toEqual(['0012', 12]);
    expect(processJson.nodes[2].nextId).toEqual([viewNodes[3].id]);
  });

  test('flat get-single-data keeps its empty assignment contract and does not depend on add-data scope', () => {
    const viewJson = buildViewJson({
      processCode: 'LPROC-GET',
      formUuid: 'FORM-A',
      appType: 'APP-A',
      formEventTypes: ['insert'],
      nodeIds: ['canvas', 'trigger', 'get', 'end'],
      dataFormUuid: 'FORM-A',
      dataConditions: [{ bFieldId: 'pid', bFieldName: '实例ID', aFieldId: '__masterdata_form_inst_id' }],
      hasMessageNode: false,
      toUsers: [],
    });
    const getNode = viewJson.schema.children.find((node) => node.componentName === 'GetSingleDataNode');
    expect(getNode.props.getData.assignments).toEqual([]);
  });

  test('rejects add-data assignments that are absent from the verified target schema', () => {
    expect(() => buildViewJson({
      processCode: 'LPROC-FLAT',
      formUuid: 'FORM-A',
      appType: 'APP-A',
      formEventTypes: ['insert'],
      nodeIds: ['canvas', 'trigger', 'create', 'end'],
      addDataFormUuid: 'FORM-B',
      addDataFormSchema: [],
      addDataAssignments: [{ column: 'missingField', valueType: 'literal', value: 'x' }],
      hasMessageNode: false,
    })).toThrow(/missingField.*target form Schema/);

    expect(() => buildSpecProcessAndViewJson({
      spec: {
        events: ['insert'],
        nodes: [{
          type: 'dataCreate',
          formUuid: 'FORM-B',
          assignments: [{ column: 'missingField', valueType: 'literal', value: 'x' }],
        }],
      },
      processCode: 'LPROC-SPEC',
      formUuid: 'FORM-A',
      appType: 'APP-A',
      flowName: 'Spec Flow',
      formSchemasByUuid: new Map([['FORM-B', []]]),
    })).toThrow(/missingField.*target form Schema/);
  });
});
