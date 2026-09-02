'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(() => ({
    auth_mode: 'token',
    auth_source: 'token',
    corp_id: 'corp-1',
    user_id: 'user-1',
    base_url: 'https://example.com',
  })),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://example.com'),
}));

jest.mock('../lib/app/form-navigation', () => ({
  fetchFormPageList: jest.fn(),
  resolveLocalizedText: jest.fn((value, fallback = '') => {
    if (!value) { return fallback; }
    if (typeof value === 'string') { return value; }
    return value.zh_CN || value.en_US || fallback;
  }),
}));

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

jest.mock('../lib/integration/integration-api', () => ({
  getFormSchema: jest.fn(),
  createLogicflow: jest.fn(),
  saveProcess: jest.fn(),
}));
jest.mock('../lib/integration/integration-readback', () => ({
  verifyLogicflowFinalState: jest.fn(),
  projectAddDataAssignments: jest.fn(() => []),
}));
jest.mock('../lib/integration/integration-connector-schema', () => ({
  resolveConnectorActionSchema: jest.fn(),
  validateConnectorAssignmentsAgainstSchema: jest.fn(),
}));

const { fetchFormPageList } = require('../lib/app/form-navigation');
const integrationApi = require('../lib/integration/integration-api');
const integrationReadback = require('../lib/integration/integration-readback');
const connectorSchema = require('../lib/integration/integration-connector-schema');
const { run } = require('../lib/integration/integration-create');
const { loadIntegrationScenarios } = require('../scripts/eval/integration-contract/scenario-loader');

describe('integration create command', () => {
  let logSpy;
  let exitSpy;
  let tempDirs;

  function writeTempSpec(spec) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-integration-create-'));
    const file = path.join(dir, 'spec.json');
    fs.writeFileSync(file, JSON.stringify(spec), 'utf8');
    tempDirs.push(dir);
    return file;
  }

  beforeEach(() => {
    process.env.YIDA_QUIET = '1';
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('__exit__'); });
    integrationApi.createLogicflow.mockReset();
    integrationApi.getFormSchema.mockReset();
    integrationApi.saveProcess.mockReset();
    fetchFormPageList.mockReset();
    integrationReadback.verifyLogicflowFinalState.mockResolvedValue({
      verificationLevel: 'PLATFORM_LIST_EXACT_DETAIL_PRESENT',
      processCode: 'LPROC-TEST',
      status: 'y',
    });
    connectorSchema.resolveConnectorActionSchema.mockResolvedValue({
      inputs: [{ name: 'month', componentName: 'TextField', paramType: 'String' }],
      outputs: [],
      description: 'discovered',
      openDevSchemaType: 'normal',
      verificationLevel: 'PLATFORM_READ_ONLY_DISCOVERY',
    });
    tempDirs = [];
  });

  afterEach(() => {
    delete process.env.YIDA_QUIET;
    logSpy.mockRestore();
    exitSpy.mockRestore();
    tempDirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
  });

  test('preflights the complete spec before creating a remote logic-flow binding', async () => {
    const specPath = writeTempSpec({
      events: ['insert'],
      nodes: [{ id: 'unsupported', type: 'notADeclaredNode' }],
    });
    integrationApi.createLogicflow.mockResolvedValue('LPROC-SHOULD-NOT-EXIST');

    await expect(run([
      'APP_TEST',
      'FORM-A',
      'invalid spec',
      '--spec',
      specPath,
    ])).rejects.toThrow(/Unsupported integration spec node type/);

    expect(integrationApi.createLogicflow).not.toHaveBeenCalled();
    expect(integrationApi.getFormSchema).not.toHaveBeenCalled();
    expect(integrationApi.saveProcess).not.toHaveBeenCalled();
  });

  test('rejects dangling designer source node IDs before any remote write', async () => {
    const specPath = writeTempSpec({
      events: ['insert'],
      nodes: [
        {
          id: 'lookup',
          type: 'dataRetrieve',
          formUuid: 'FORM-B',
          conditions: [{ fieldId: 'textField_marker', fieldName: '标记', value: 'x', valueType: 'literal' }],
        },
        {
          id: 'update',
          type: 'dataUpdate',
          source: 'lookup',
          assignments: [{
            column: 'numberField_total',
            valueType: 'column',
            value: '${lookup}.numberField_total+1',
            __source: '#{node_typo//numberField_total}+1',
          }],
        },
      ],
    });
    fetchFormPageList.mockResolvedValue([
      { formUuid: 'FORM-B', formName: 'B普通表单', formType: 'receipt' },
    ]);
    integrationApi.createLogicflow.mockResolvedValue('LPROC-SHOULD-NOT-EXIST');
    integrationApi.saveProcess.mockResolvedValue({ success: true });

    await expect(run([
      'APP_TEST',
      'FORM-A',
      'dangling designer source',
      '--spec',
      specPath,
    ])).rejects.toThrow(/Unknown integration spec node alias: node_typo/);

    expect(integrationApi.getFormSchema).not.toHaveBeenCalled();
    expect(integrationApi.createLogicflow).not.toHaveBeenCalled();
    expect(integrationApi.saveProcess).not.toHaveBeenCalled();
  });

  test('requires --replace for process-code full replacement before auth or remote writes', async () => {
    const coreUtils = require('../lib/core/utils');

    await expect(run([
      'APP_TEST',
      'FORM-A',
      'unsafe replacement',
      '--process-code',
      'LPROC-EXISTING',
    ])).rejects.toMatchObject({
      code: 'INTEGRATION_FULL_REPLACEMENT_REQUIRES_REPLACE',
    });

    expect(coreUtils.loadAuthData).not.toHaveBeenCalled();
    expect(fetchFormPageList).not.toHaveBeenCalled();
    expect(integrationApi.getFormSchema).not.toHaveBeenCalled();
    expect(integrationApi.createLogicflow).not.toHaveBeenCalled();
    expect(integrationApi.saveProcess).not.toHaveBeenCalled();
  });

  test('allows an explicitly confirmed process-code full replacement without creating a binding', async () => {
    integrationApi.saveProcess.mockResolvedValue({ success: true });

    await run([
      'APP_TEST',
      'FORM-A',
      'confirmed replacement',
      '--process-code',
      'LPROC-EXISTING',
      '--replace',
    ]);

    expect(integrationApi.createLogicflow).not.toHaveBeenCalled();
    expect(integrationApi.saveProcess).toHaveBeenCalledTimes(1);
    expect(integrationApi.saveProcess.mock.calls[0][1]).toMatchObject({
      appType: 'APP_TEST',
      formUuid: 'FORM-A',
      processCode: 'LPROC-EXISTING',
      isOnline: false,
    });
  });

  test.each([
    ['ASCII', 'x'.repeat(31)],
    ['Unicode code points', '😀'.repeat(31)],
  ])('rejects %s logic-flow names over 30 characters before auth or remote writes', async (_label, flowName) => {
    const coreUtils = require('../lib/core/utils');

    await expect(run([
      'APP_TEST',
      'FORM-A',
      flowName,
    ])).rejects.toThrow(/30/);

    expect(coreUtils.loadAuthData).not.toHaveBeenCalled();
    expect(fetchFormPageList).not.toHaveBeenCalled();
    expect(integrationApi.getFormSchema).not.toHaveBeenCalled();
    expect(integrationApi.createLogicflow).not.toHaveBeenCalled();
    expect(integrationApi.saveProcess).not.toHaveBeenCalled();
  });

  test.each([
    ['ASCII', 'x'.repeat(30)],
    ['Unicode code points', '😀'.repeat(30)],
  ])('accepts %s logic-flow names at the 30-character boundary', async (_label, flowName) => {
    integrationApi.createLogicflow.mockResolvedValue('LPROC-TEST');
    integrationApi.saveProcess.mockResolvedValue({ success: true });

    await run(['APP_TEST', 'FORM-A', flowName]);

    expect(integrationApi.createLogicflow).toHaveBeenCalledTimes(1);
    expect(integrationApi.saveProcess).toHaveBeenCalledTimes(1);
  });

  test('fails closed when add-data target metadata cannot be verified', async () => {
    fetchFormPageList.mockRejectedValue(new Error('navigation unavailable'));
    integrationApi.createLogicflow.mockResolvedValue('LPROC-SHOULD-NOT-EXIST');
    integrationApi.getFormSchema.mockResolvedValue([
      { componentName: 'TextField', props: { fieldId: 'textField_b', label: 'B' } },
    ]);
    integrationApi.saveProcess.mockResolvedValue({ success: true });

    await expect(run([
      'APP_TEST',
      'FORM-A',
      'unverified target',
      '--add-data-form-uuid',
      'FORM-UNKNOWN',
      '--add-data-assignment',
      'textField_b:literal:value',
    ])).rejects.toThrow(/目标表单信息/);

    expect(integrationApi.createLogicflow).not.toHaveBeenCalled();
    expect(integrationApi.getFormSchema).not.toHaveBeenCalled();
    expect(integrationApi.saveProcess).not.toHaveBeenCalled();
  });

  test('fails closed when an add-data target schema cannot be loaded', async () => {
    fetchFormPageList.mockResolvedValue([
      { formUuid: 'FORM-RECEIPT', formName: 'B普通表单', formType: 'receipt' },
    ]);
    integrationApi.createLogicflow.mockResolvedValue('LPROC-SHOULD-NOT-EXIST');
    integrationApi.getFormSchema.mockRejectedValue(new Error('schema unavailable'));
    integrationApi.saveProcess.mockResolvedValue({ success: true });

    await expect(run([
      'APP_TEST',
      'FORM-A',
      'schema guard',
      '--add-data-form-uuid',
      'FORM-RECEIPT',
      '--add-data-assignment',
      'textField_b:literal:value',
    ])).rejects.toThrow(/Schema/);

    expect(integrationApi.createLogicflow).not.toHaveBeenCalled();
    expect(integrationApi.saveProcess).not.toHaveBeenCalled();
  });

  test('applies ordinary-form target validation to spec dataCreate nodes', async () => {
    const specPath = writeTempSpec({
      events: ['insert'],
      nodes: [{
        id: 'create',
        type: 'dataCreate',
        formUuid: 'FORM-PROCESS',
        assignments: [{ column: 'textField_b', valueType: 'literal', value: 'value' }],
      }],
    });
    fetchFormPageList.mockResolvedValue([
      { formUuid: 'FORM-PROCESS', formName: 'B流程表单', formType: 'process' },
    ]);
    integrationApi.createLogicflow.mockResolvedValue('LPROC-SHOULD-NOT-EXIST');

    await expect(run([
      'APP_TEST',
      'FORM-A',
      'spec target guard',
      '--spec',
      specPath,
    ])).rejects.toThrow('__exit__');

    expect(integrationApi.createLogicflow).not.toHaveBeenCalled();
    expect(integrationApi.getFormSchema).not.toHaveBeenCalled();
    expect(integrationApi.saveProcess).not.toHaveBeenCalled();
    const printed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(printed).toMatchObject({
      success: false,
      code: 'ADD_DATA_TARGET_IS_PROCESS_FORM',
      targetFormUuid: 'FORM-PROCESS',
    });
  });

  test.each([
    [
      'half-configured connector',
      ['--connector-id', 'G-CONN-ONLY'],
      /connector-id.*action-id|action-id.*connector-id/i,
    ],
    [
      'unsupported connector mode',
      ['--connector-id', 'G-CONN', '--action-id', 'G-ACT', '--connector-mode', '3'],
      /Unsupported connector mode: 3/,
    ],
    [
      'invalid connector assignment valueType',
      ['--connector-id', 'G-CONN', '--action-id', 'G-ACT', '--connector-assignment', 'subject:unknown:value'],
      /assignment valueType/,
    ],
  ])('rejects %s instead of silently dropping or degrading it', async (_label, flags, errorPattern) => {
    await expect(run([
      'APP_TEST',
      'FORM-A',
      'strict connector',
      ...flags,
    ])).rejects.toThrow(errorPattern);

    expect(integrationApi.createLogicflow).not.toHaveBeenCalled();
    expect(integrationApi.getFormSchema).not.toHaveBeenCalled();
    expect(integrationApi.saveProcess).not.toHaveBeenCalled();
  });

  test('fails closed before the first write when connector action schema discovery is unverified', async () => {
    const error = new Error('action schema unavailable');
    error.code = 'INTEGRATION_CONNECTOR_SCHEMA_UNVERIFIED';
    connectorSchema.resolveConnectorActionSchema.mockRejectedValue(error);

    await expect(run([
      'APP_TEST', 'FORM-A', 'unknown connector',
      '--connector-id', 'Http_unknown',
      '--action-id', 'missing-action',
    ])).rejects.toMatchObject({ code: 'INTEGRATION_CONNECTOR_SCHEMA_UNVERIFIED' });

    expect(integrationApi.createLogicflow).not.toHaveBeenCalled();
    expect(integrationApi.saveProcess).not.toHaveBeenCalled();
  });

  test('rejects caller-authored connector input schema instead of trusting guessed field types', async () => {
    await expect(run([
      'APP_TEST', 'FORM-A', 'unverified connector file',
      '--connector-id', 'Http_unknown',
      '--action-id', 'sync',
      '--connector-inputs', '/not/read/inputs.json',
    ])).rejects.toMatchObject({
      code: 'INTEGRATION_CONNECTOR_SCHEMA_UNVERIFIED',
      details: expect.objectContaining({ remoteWrites: 0 }),
    });

    expect(require('../lib/core/utils').loadAuthData).not.toHaveBeenCalled();
    expect(integrationApi.createLogicflow).not.toHaveBeenCalled();
    expect(integrationApi.saveProcess).not.toHaveBeenCalled();
  });

  test('rejects unsupported approval actions before any remote write', async () => {
    await expect(run([
      'APP_TEST',
      'FORM-A',
      'invalid approval action',
      '--events',
      'approval',
      '--approval-actions',
      'magic',
    ])).rejects.toThrow(/Unsupported approval action: magic/);

    expect(integrationApi.createLogicflow).not.toHaveBeenCalled();
    expect(integrationApi.saveProcess).not.toHaveBeenCalled();
  });

  test('reports publish failure as a failed command while retaining the saved draft result', async () => {
    integrationApi.createLogicflow.mockResolvedValue('LPROC-TEST');
    integrationApi.saveProcess
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, errorMsg: 'publish unavailable' });

    await expect(run([
      'APP_TEST',
      'FORM-A',
      'publish failure',
      '--publish',
    ])).rejects.toThrow(/publish unavailable/);

    expect(integrationApi.saveProcess).toHaveBeenCalledTimes(2);
    expect(JSON.parse(logSpy.mock.calls[0][0])).toMatchObject({
      success: false,
      published: false,
      savedAsDraft: true,
      processCode: 'LPROC-TEST',
    });
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('publishes only after exact list/status and detail-presence readback succeeds', async () => {
    integrationApi.createLogicflow.mockResolvedValue('LPROC-TEST');
    integrationApi.saveProcess.mockResolvedValue({ success: true });

    await run(['APP_TEST', 'FORM-A', 'publish verified', '--publish']);

    expect(integrationReadback.verifyLogicflowFinalState).toHaveBeenCalledWith(expect.any(Object), {
      appType: 'APP_TEST', formUuid: 'FORM-A', processCode: 'LPROC-TEST', expectedStatus: 'y',
    });
    expect(JSON.parse(logSpy.mock.calls[0][0])).toMatchObject({
      success: true,
      published: true,
      verificationLevel: 'PLATFORM_LIST_EXACT_DETAIL_PRESENT',
      verification: { verificationLevel: 'PLATFORM_LIST_EXACT_DETAIL_PRESENT' },
    });
  });

  test('publish write success without exact final-state proof fails closed', async () => {
    integrationApi.createLogicflow.mockResolvedValue('LPROC-TEST');
    integrationApi.saveProcess.mockResolvedValue({ success: true });
    const error = new Error('status mismatch');
    error.code = 'INTEGRATION_READBACK_STATUS_MISMATCH';
    integrationReadback.verifyLogicflowFinalState.mockRejectedValue(error);

    await expect(run(['APP_TEST', 'FORM-A', 'publish unverified', '--publish']))
      .rejects.toMatchObject({ code: 'INTEGRATION_PUBLISH_READBACK_UNVERIFIED' });

    expect(JSON.parse(logSpy.mock.calls[0][0])).toMatchObject({
      success: false,
      published: null,
      publishRequested: true,
      verificationLevel: 'UNVERIFIED',
    });
  });

  test('rejects process forms as add-data targets before creating a broken flow', async () => {
    fetchFormPageList.mockResolvedValue([
      {
        formUuid: 'FORM-PROCESS',
        formName: 'B流程表单',
        formType: 'process',
      },
    ]);

    await expect(run([
      'APP_TEST',
      'FORM-A',
      'A完成后创建B',
      '--add-data-form-uuid',
      'FORM-PROCESS',
      '--add-data-assignment',
      'textField_b:literal:value',
    ])).rejects.toThrow('__exit__');

    expect(integrationApi.createLogicflow).not.toHaveBeenCalled();
    expect(integrationApi.getFormSchema).not.toHaveBeenCalled();
    expect(integrationApi.saveProcess).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
    const printed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(printed).toMatchObject({
      success: false,
      code: 'ADD_DATA_TARGET_IS_PROCESS_FORM',
    });
    expect(printed.error).toContain('流程表单');
    expect(printed.error).toContain('发起审批');
  });

  test('allows receipt forms as add-data targets and keeps the target form name in viewJson', async () => {
    fetchFormPageList.mockResolvedValue([
      {
        formUuid: 'FORM-RECEIPT',
        formName: 'B普通表单',
        formType: 'receipt',
      },
    ]);
    integrationApi.createLogicflow.mockResolvedValue('LPROC-TEST');
    integrationApi.getFormSchema.mockResolvedValue([
      {
        componentName: 'TextField',
        props: {
          fieldId: 'textField_b',
          label: { zh_CN: 'B字段' },
        },
      },
    ]);
    integrationApi.saveProcess.mockResolvedValue({ success: true });

    await run([
      'APP_TEST',
      'FORM-A',
      'A完成后创建B',
      '--add-data-form-uuid',
      'FORM-RECEIPT',
      '--add-data-assignment',
      'textField_b:literal:value',
    ]);

    expect(integrationApi.createLogicflow).toHaveBeenCalledWith(expect.any(Object), {
      appType: 'APP_TEST',
      formUuid: 'FORM-A',
      flowName: 'A完成后创建B',
    });
    expect(integrationApi.getFormSchema).toHaveBeenCalledWith(expect.any(Object), {
      appType: 'APP_TEST',
      formUuid: 'FORM-RECEIPT',
    });
    expect(integrationApi.saveProcess).toHaveBeenCalledTimes(1);
    const savedViewJson = integrationApi.saveProcess.mock.calls[0][1].viewJson;
    const addDataNode = savedViewJson.schema.children.find((node) => node.componentName === 'AddDataNode');
    expect(addDataNode.props.description).toContain('B普通表单');
    expect(addDataNode.props.addDataRules.inputs.childList[0]).toMatchObject({
      fieldId: 'textField_b',
      label: 'B字段',
    });
    const printed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(printed).toMatchObject({
      success: true,
      published: false,
      processCode: 'LPROC-TEST',
    });
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('publishes with the exact non-empty AddData assignment projection', async () => {
    const expectedAddDataAssignments = [
      {
        nodeId: 'node-2',
        assignments: [
          { column: 'textField_b', valueType: 'literal', value: 'value' },
        ],
      },
    ];
    fetchFormPageList.mockResolvedValue([
      {
        formUuid: 'FORM-RECEIPT',
        formName: 'B普通表单',
        formType: 'receipt',
      },
    ]);
    integrationApi.createLogicflow.mockResolvedValue('LPROC-TEST');
    integrationApi.getFormSchema.mockResolvedValue([
      {
        componentName: 'TextField',
        props: {
          fieldId: 'textField_b',
          label: { zh_CN: 'B字段' },
        },
      },
    ]);
    integrationApi.saveProcess.mockResolvedValue({ success: true });
    integrationReadback.projectAddDataAssignments.mockReturnValueOnce(expectedAddDataAssignments);

    await run([
      'APP_TEST',
      'FORM-A',
      'A完成后创建B并发布',
      '--add-data-form-uuid',
      'FORM-RECEIPT',
      '--add-data-assignment',
      'textField_b:literal:value',
      '--publish',
    ]);

    expect(integrationReadback.projectAddDataAssignments).toHaveBeenCalledWith(expect.any(Object));
    expect(integrationReadback.verifyLogicflowFinalState).toHaveBeenCalledWith(expect.any(Object), {
      appType: 'APP_TEST',
      formUuid: 'FORM-A',
      processCode: 'LPROC-TEST',
      expectedStatus: 'y',
      expectedAddDataAssignments,
    });
  });

  test('reuses form navigation lookup when add-data and initiate-approval targets are both present', async () => {
    fetchFormPageList.mockResolvedValue([
      {
        formUuid: 'FORM-RECEIPT',
        formName: 'B普通表单',
        formType: 'receipt',
      },
      {
        formUuid: 'FORM-PROCESS',
        formName: 'C流程表单',
        formType: 'process',
      },
    ]);
    integrationApi.createLogicflow.mockResolvedValue('LPROC-TEST');
    integrationApi.getFormSchema.mockResolvedValue([
      { componentName: 'TextField', props: { fieldId: 'textField_b', label: 'B' } },
    ]);
    integrationApi.saveProcess.mockResolvedValue({ success: true });

    await run([
      'APP_TEST',
      'FORM-A',
      'A新增后同步并发起审批',
      '--add-data-form-uuid',
      'FORM-RECEIPT',
      '--add-data-assignment',
      'textField_b:literal:value',
      '--initiate-approval-form-uuid',
      'FORM-PROCESS',
      '--initiate-approval-initiator-user',
      'user-1:Alice',
      '--initiate-approval-assignment',
      'textField_c:processVar:textField_a',
    ]);

    expect(fetchFormPageList).toHaveBeenCalledTimes(1);
    const saveParams = integrationApi.saveProcess.mock.calls[0][1];
    expect(saveParams.processJson.nodes.map((node) => node.type)).toEqual([
      'trigger',
      'dataCreate',
      'initiateApproval',
      'finish',
    ]);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('passes HTTP connector metadata into processJson and viewJson', async () => {
    integrationApi.createLogicflow.mockResolvedValue('LPROC-TEST');
    integrationApi.saveProcess.mockResolvedValue({ success: true });

    await run([
      'APP_TEST',
      'FORM-A',
      'HTTP connector flow',
      '--connector-id',
      'Http_2ed1618fdc744a288e5cb52bc02e462f',
      '--action-id',
      'publish_month_qs',
      '--connector-mode',
      '5',
      '--connection-id',
      '28336',
      '--connector-name',
      'Http_2ed1618fdc744a288e5cb52bc02e462f',
      '--connector-display-name',
      '加福加德BI后端',
      '--connector-assignment',
      'month:processVar:textField_month',
    ]);

    expect(integrationApi.saveProcess).toHaveBeenCalledTimes(1);
    const saveParams = integrationApi.saveProcess.mock.calls[0][1];
    const processNode = saveParams.processJson.nodes.find((node) => node.type === 'httpConnector');
    expect(processNode).toMatchObject({
      props: {
        inputs: {
          connectorId: 'Http_2ed1618fdc744a288e5cb52bc02e462f',
          actionId: 'publish_month_qs',
          connectionId: '28336',
          connectorMode: 5,
        },
      },
    });

    const viewNode = saveParams.viewJson.schema.children.find((node) => node.componentName === 'ConnectorNode');
    expect(viewNode.props.name).toBe('加福加德BI后端');
    expect(viewNode.props.connectorRules).toMatchObject({
      connectorId: 'Http_2ed1618fdc744a288e5cb52bc02e462f',
      actionId: 'publish_month_qs',
      connectionId: '28336',
      connector: {
        connectorName: 'Http_2ed1618fdc744a288e5cb52bc02e462f',
        connectorMode: 5,
        mode: 5,
        displayName: '加福加德BI后端',
      },
    });
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('infers HTTP connector mode from Http_ connector ids', async () => {
    integrationApi.createLogicflow.mockResolvedValue('LPROC-TEST');
    integrationApi.saveProcess.mockResolvedValue({ success: true });

    await run([
      'APP_TEST',
      'FORM-A',
      'HTTP inferred connector flow',
      '--connector-id',
      'Http_2ed1618fdc744a288e5cb52bc02e462f',
      '--action-id',
      'publish_month_qs',
      '--connection-id',
      '28336',
    ]);

    const saveParams = integrationApi.saveProcess.mock.calls[0][1];
    const processNode = saveParams.processJson.nodes.find((node) => node.type === 'httpConnector');
    expect(processNode).toBeTruthy();
    const viewNode = saveParams.viewJson.schema.children.find((node) => node.componentName === 'ConnectorNode');
    expect(viewNode.props.connectorRules.connector.mode).toBe(5);
    expect(viewNode.props.connectorRules.connector.connectorMode).toBe(5);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('builds a flat HTTP connector without connectionId and keeps mode 5', async () => {
    integrationApi.createLogicflow.mockResolvedValue('LPROC-TEST');
    integrationApi.saveProcess.mockResolvedValue({ success: true });

    await run([
      'APP_TEST',
      'FORM-A',
      'HTTP connector no connection',
      '--connector-id',
      'Http_2ed1618fdc744a288e5cb52bc02e462f',
      '--action-id',
      'publish_month_qs',
    ]);

    const saveParams = integrationApi.saveProcess.mock.calls[0][1];
    const processNode = saveParams.processJson.nodes.find((node) => node.type === 'httpConnector');
    const viewNode = saveParams.viewJson.schema.children.find((node) => node.componentName === 'ConnectorNode');
    expect(processNode.props.inputs).toMatchObject({
      connectorMode: 5,
      connection: '',
      connectionId: '',
    });
    expect(viewNode.props.connectorRules).toMatchObject({
      connectionId: '',
      connector: { connectorMode: 5, mode: 5 },
    });
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('creates initiate approval node for process form targets', async () => {
    fetchFormPageList.mockResolvedValue([
      {
        formUuid: 'FORM-PROCESS',
        formName: 'B Process',
        formType: 'process',
      },
    ]);
    integrationApi.createLogicflow.mockResolvedValue('LPROC-TEST');
    integrationApi.saveProcess.mockResolvedValue({ success: true });

    await run([
      'APP_TEST',
      'FORM-A',
      'A complete starts B approval',
      '--initiate-approval-form-uuid',
      'FORM-PROCESS',
      '--initiate-approval-initiator-user',
      'user-1:Alice',
      '--initiate-approval-assignment',
      'textField_b:literal:created-by-openyida',
    ]);

    expect(integrationApi.getFormSchema).not.toHaveBeenCalled();
    expect(integrationApi.saveProcess).toHaveBeenCalledTimes(1);
    const saveParams = integrationApi.saveProcess.mock.calls[0][1];
    const processNode = saveParams.processJson.nodes.find((node) => node.type === 'initiateApproval');
    expect(processNode).toMatchObject({
      type: 'initiateApproval',
      props: {
        formUuid: 'FORM-PROCESS',
        processCode: 'LPROC-TEST',
        appType: 'APP_TEST',
        description: '在 [B Process] 中发起一条审批',
        initiator: {
          type: 'select_user',
          value: JSON.stringify({ id: 'user-1', label: 'Alice', type: 'employee' }),
        },
        assignments: [
          { column: 'textField_b', valueType: 'literal', value: 'created-by-openyida' },
        ],
      },
    });
    const viewNode = saveParams.viewJson.schema.children.find((node) => node.componentName === 'InitiateApprovalNode');
    expect(viewNode.props).toMatchObject({
      nodeName: 'InitiateApprovalNode',
      signAction: 'one_by_one',
      initiateApprovalRules: {
        formUuid: 'FORM-PROCESS',
        processCode: 'LPROC-TEST',
        appType: 'APP_TEST',
        assignments: [
          {
            column: 'textField_b',
            valueType: 'literal',
            value: 'created-by-openyida',
            required: false,
          },
        ],
      },
    });
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('fails the declared missing-initiator scenario before any remote write', async () => {
    const scenario = loadIntegrationScenarios().find((item) => item.id === 'integration-initiate-approval');
    expect(scenario.runtimeCases).toContainEqual(expect.objectContaining({
      id: 'missing-initiator-preflight',
      expected: 'validation-error-before-write',
    }));

    await expect(run([
      'APP_TEST',
      'FORM-A',
      'Missing approval initiator',
      '--initiate-approval-form-uuid',
      'FORM-PROCESS',
    ])).rejects.toThrow('__exit__');

    expect(fetchFormPageList).not.toHaveBeenCalled();
    expect(integrationApi.getFormSchema).not.toHaveBeenCalled();
    expect(integrationApi.createLogicflow).not.toHaveBeenCalled();
    expect(integrationApi.saveProcess).not.toHaveBeenCalled();
  });

  test('rejects structural flags mixed with --spec before auth or remote writes', async () => {
    const specPath = writeTempSpec({
      events: ['insert'],
      nodes: [{ type: 'sendMessage', receivers: ['user-1'], content: 'done' }],
    });

    await expect(run([
      'APP_TEST', 'FORM-A', 'mixed spec', '--spec', specPath,
      '--initiate-approval-form-uuid', 'FORM-PROCESS',
      '--initiate-approval-initiator-user', 'user-1',
    ])).rejects.toMatchObject({ code: 'INTEGRATION_SPEC_MIXED_STRUCTURAL_FLAGS' });

    expect(require('../lib/core/utils').loadAuthData).not.toHaveBeenCalled();
    expect(integrationApi.createLogicflow).not.toHaveBeenCalled();
    expect(integrationApi.saveProcess).not.toHaveBeenCalled();
  });

  test.each([
    ['--connector-mode', '5'],
    ['--connection-id', 'connection-1'],
    ['--trigger-condition', 'textField_a:状态:Equal:启用'],
    ['--initiate-approval-initiator-user', 'user-1:Alice'],
    ['--approval-actions', 'agree'],
    ['--approval-node-ids', 'node-1'],
    ['--get-self-field', 'textField_a'],
    ['--get-self-trigger-field', 'textField_a'],
    ['--get-self-query-field', 'textField_b'],
  ])('rejects unsupported %s mixed with --spec before auth or remote writes', async (flag, value) => {
    const specPath = writeTempSpec({
      events: ['insert'],
      nodes: [{ type: 'sendMessage', receivers: ['user-1'], content: 'done' }],
    });

    await expect(run([
      'APP_TEST', 'FORM-A', 'mixed spec', '--spec', specPath, flag, value,
    ])).rejects.toMatchObject({ code: 'INTEGRATION_SPEC_MIXED_STRUCTURAL_FLAGS' });

    expect(require('../lib/core/utils').loadAuthData).not.toHaveBeenCalled();
    expect(integrationApi.createLogicflow).not.toHaveBeenCalled();
    expect(integrationApi.saveProcess).not.toHaveBeenCalled();
  });

  test('hydrates and patches nested spec initiateApproval nodes before the first save', async () => {
    const specPath = writeTempSpec({
      events: ['insert'],
      nodes: [{
        type: 'route',
        branches: [{
          id: 'default',
          default: true,
          nodes: [{
            id: 'approval',
            type: 'initiateApproval',
            formUuid: 'FORM-PROCESS',
            initiator: { type: 'current_user' },
            assignments: [{ column: 'textField_title', valueType: 'literal', value: '重大变更审批' }],
          }],
        }],
      }],
    });
    fetchFormPageList.mockResolvedValue([
      { formUuid: 'FORM-PROCESS', formName: '重大变更审批流程', formType: 'process' },
    ]);
    integrationApi.getFormSchema.mockResolvedValue([
      { componentName: 'TextField', props: { fieldId: 'textField_title', label: '审批标题' } },
    ]);
    integrationApi.createLogicflow.mockResolvedValue('LPROC-TEST');
    integrationApi.saveProcess.mockResolvedValue({ success: true });

    await run(['APP_TEST', 'FORM-A', 'nested approval spec', '--spec', specPath]);

    const saved = integrationApi.saveProcess.mock.calls[0][1];
    const routeProcess = saved.processJson.nodes.find((node) => node.type === 'route');
    const approvalProcess = routeProcess.childNodes[0].childNodes[0];
    const routeView = saved.viewJson.schema.children.find((node) => node.componentName === 'ConditionContainer');
    const approvalView = routeView.children[0].children[0];
    expect(approvalProcess.props.processCode).toBe('LPROC-TEST');
    expect(approvalProcess.props.formUuid).toBe('FORM-PROCESS');
    expect(approvalView.props.initiateApprovalRules.processCode).toBe('LPROC-TEST');
    expect(integrationApi.getFormSchema).toHaveBeenCalledWith(expect.any(Object), {
      appType: 'APP_TEST', formUuid: 'FORM-PROCESS',
    });
  });
});
