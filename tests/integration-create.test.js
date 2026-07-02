'use strict';

jest.mock('../lib/core/utils', () => ({
  loadCookieData: jest.fn(() => ({
    csrf_token: 'csrf-token',
    cookies: [],
    base_url: 'https://example.com',
  })),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://example.com'),
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

const integrationApi = require('../lib/integration/integration-api');
const { run } = require('../lib/integration/integration-create');

describe('integration create command', () => {
  let logSpy;
  let exitSpy;

  beforeEach(() => {
    process.env.YIDA_QUIET = '1';
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('__exit__'); });
    integrationApi.createLogicflow.mockReset();
    integrationApi.saveProcess.mockReset();
  });

  afterEach(() => {
    delete process.env.YIDA_QUIET;
    logSpy.mockRestore();
    exitSpy.mockRestore();
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
});
