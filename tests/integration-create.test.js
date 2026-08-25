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

const { fetchFormPageList } = require('../lib/app/form-navigation');
const integrationApi = require('../lib/integration/integration-api');
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
});
