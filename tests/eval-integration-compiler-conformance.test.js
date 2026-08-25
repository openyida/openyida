'use strict';

const fs = require('fs');
const path = require('path');

const {
  normalizeIntegrationReadback,
  verifyIntegrationContract,
} = require('../scripts/eval/integration-contract');
const {
  loadIntegrationScenarios,
} = require('../scripts/eval/integration-contract/scenario-loader');
const { buildProcessJson } = require('../lib/integration/integration-process-builder');
const { buildViewJson } = require('../lib/integration/integration-view-builder');
const { buildSpecProcessAndViewJson } = require('../lib/integration/integration-spec-builder');

const CONTRACT_ROOT = path.join(__dirname, '..', 'scripts', 'eval', 'integration-contract');
const CONTRACT_DIR = path.join(CONTRACT_ROOT, 'contracts');
const BINDING_DIR = path.join(CONTRACT_ROOT, 'fixtures', 'bindings');

const PRODUCT_COMPILER_SCENARIOS = [
  'integration-connector',
  'integration-data-create',
  'integration-data-retrieve-default',
  'integration-get-self-route-notify',
  'integration-initiate-approval',
  'integration-submit-notify',
];

const CONTRACT_ONLY_SCENARIOS = {
  'integration-data-update': 'current builder does not declare target-form conditional update',
};

const CONTRACT_ONLY_RUNTIME_CASES = {
  'integration-connector/missing-connection-preflight': 'connectionId is optional in the reviewed product contract',
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadContractCase(scenarioId) {
  return {
    contract: readJson(path.join(CONTRACT_DIR, scenarioId + '.contract.json')),
    binding: readJson(path.join(BINDING_DIR, scenarioId + '.resource-aliases.json')),
  };
}

function buildFlatArtifacts(options, processNodeIds, viewNodeIds) {
  return {
    processJson: buildProcessJson({ ...options, nodeIds: processNodeIds }),
    viewJson: buildViewJson({ ...options, nodeIds: viewNodeIds }),
  };
}

function buildSpecArtifacts(spec, formUuid, formSchemasByUuid = new Map()) {
  return buildSpecProcessAndViewJson({
    spec,
    processCode: 'LPROC-OFFLINE-CONFORMANCE',
    appType: 'APP-OFFLINE-CONFORMANCE',
    formUuid,
    flowName: spec.title || 'Offline compiler conformance',
    formSchemasByUuid,
  });
}

function compileProductScenario(scenarioId) {
  if (scenarioId === 'integration-submit-notify') {
    return buildFlatArtifacts({
      processCode: 'LPROC-OFFLINE-NOTIFY',
      appType: 'APP-OFFLINE-CONFORMANCE',
      formUuid: 'FORM-CONTRACT-LEAVE',
      formEventTypes: ['insert'],
      notificationTitle: '新请假申请：#{employeeField_applicant-EmployeeField}#',
      notificationContent: '请假类型：#{selectField_leave_type-SelectField}#',
      toUsers: [{ userId: 'USER-CONTRACT-HR', userName: '' }],
      userFields: [],
      hasMessageNode: true,
    }, ['trigger-notify', 'message-notify', 'finish-notify'], [
      'canvas-notify', 'trigger-notify', 'message-notify', 'finish-notify',
    ]);
  }

  if (scenarioId === 'integration-data-create') {
    return buildSpecArtifacts({
      events: ['insert'],
      nodes: [{
        id: 'createStats',
        type: 'dataCreate',
        name: '新增统计数据',
        formUuid: 'FORM-CONTRACT-STATS',
        assignments: [
          { column: 'textField_stats_order_no', valueType: 'processVar', value: 'textField_order_no' },
          { column: 'numberField_stats_amount', valueType: 'processVar', value: 'numberField_amount' },
          { column: 'selectField_sync_status', valueType: 'literal', value: '已同步' },
        ],
      }],
    }, 'FORM-CONTRACT-ORDER', new Map([['FORM-CONTRACT-STATS', [
      { componentName: 'TextField', props: { fieldId: 'textField_stats_order_no', label: '订单号' } },
      { componentName: 'NumberField', props: { fieldId: 'numberField_stats_amount', label: '金额' } },
      { componentName: 'SelectField', props: { fieldId: 'selectField_sync_status', label: '同步状态' } },
    ]]]));
  }

  if (scenarioId === 'integration-data-retrieve-default') {
    return buildSpecArtifacts({
      events: ['insert'],
      nodes: [
        {
          id: 'customer',
          type: 'dataRetrieve',
          name: '获取客户',
          formUuid: 'FORM-CONTRACT-CUSTOMER',
          conditions: [{
            fieldId: 'textField_customer_no',
            fieldName: '客户编号',
            value: 'textField_ticket_customer_no',
            componentType: 'TextField',
            opCode: 'Equal',
            valueType: 'processVar',
          }],
        },
        {
          id: 'customerRoute',
          type: 'route',
          name: '查询结果分支',
          branches: [
            {
              id: 'found',
              name: '查到客户',
              conditions: [{
                fieldId: '${customer}.textField_customer_name',
                fieldName: '客户名称',
                opCode: 'ExistValue',
                valueType: 'literal',
              }],
              nodes: [{
                id: 'notifyManager',
                type: 'sendMessage',
                name: '通知客户经理',
                receivers: ['USER-CONTRACT-MANAGER'],
                title: '客户工单',
                content: '客户 ${customer}.textField_customer_name 有新工单',
              }],
            },
            {
              id: 'missing',
              name: '未查到客户',
              default: true,
              nodes: [{
                id: 'notifyAdmin',
                type: 'sendMessage',
                name: '通知数据管理员',
                receivers: ['USER-CONTRACT-ADMIN'],
                title: '客户资料缺失',
                content: '未找到客户资料',
              }],
            },
          ],
        },
      ],
    }, 'FORM-CONTRACT-TICKET');
  }

  if (scenarioId === 'integration-get-self-route-notify') {
    return buildSpecArtifacts({
      events: ['insert', 'update'],
      triggerRecursively: true,
      nodes: [
        {
          id: 'self',
          type: 'getSelf',
          name: '获取自身',
          queryField: 'pid',
          triggerField: '__masterdata_form_inst_id',
        },
        {
          id: 'statusRoute',
          type: 'route',
          name: '状态分支',
          branches: [
            {
              id: 'matched',
              name: '待处理或大额',
              logic: 'OR',
              conditions: [
                {
                  fieldId: '${self}.selectField_status',
                  fieldName: '状态',
                  opCode: 'Equal',
                  value: '待处理',
                  componentType: 'SelectField',
                  valueType: 'literal',
                },
                {
                  fieldId: '${self}.numberField_amount',
                  fieldName: '金额',
                  opCode: 'GreaterThanOrEqual',
                  value: 1000,
                  componentType: 'NumberField',
                  valueType: 'literal',
                },
              ],
              nodes: [{
                id: 'notifyOwner',
                type: 'sendMessage',
                name: '通知负责人',
                receivers: ['USER-CONTRACT-OWNER'],
                title: '待处理工单',
                content: '工单 ${self}.textField_ticket_no 等待处理',
              }],
            },
            { id: 'otherwise', name: '其他情况', default: true },
          ],
        },
      ],
    }, 'FORM-CONTRACT-WORKORDER');
  }

  if (scenarioId === 'integration-connector') {
    return buildSpecArtifacts({
      events: ['insert'],
      nodes: [{
        id: 'syncOrder',
        type: 'connector',
        name: '同步订单',
        connectorId: 'Http_CONTRACT_ORDER_SYNC',
        actionId: 'sync_order',
        connectorMode: 5,
        connectionId: 'CONNECTION-CONTRACT-001',
        assignments: [
          { column: 'orderNo', valueType: 'processVar', value: 'textField_order_no' },
          { column: 'amount', valueType: 'processVar', value: 'numberField_order_amount' },
        ],
      }],
    }, 'FORM-CONTRACT-ORDER');
  }

  if (scenarioId === 'integration-initiate-approval') {
    return buildFlatArtifacts({
      processCode: 'LPROC-OFFLINE-APPROVAL',
      appType: 'APP-OFFLINE-CONFORMANCE',
      formUuid: 'FORM-CONTRACT-PURCHASE',
      formEventTypes: ['insert'],
      toUsers: [],
      hasMessageNode: false,
      initiateApprovalFormUuid: 'FORM-CONTRACT-PAYMENT-PROCESS',
      initiateApprovalFormName: '付款审批',
      initiateApprovalInitiator: { type: 'select_user', value: 'USER-CONTRACT-INITIATOR' },
      initiateApprovalAssignments: [
        { column: 'textField_approval_request_no', valueType: 'processVar', value: 'textField_request_no' },
        { column: 'numberField_approval_amount', valueType: 'processVar', value: 'numberField_request_amount' },
        { column: 'textField_approval_source', valueType: 'literal', value: '采购申请' },
      ],
    }, ['trigger-approval', 'approval', 'finish-approval'], [
      'canvas-approval', 'trigger-approval', 'approval', 'finish-approval',
    ]);
  }

  throw new Error('contract-only integration scenario: ' + scenarioId);
}

describe('integration product compiler conformance', () => {
  test('classifies every public scenario without expanding current product builders', () => {
    const scenarios = loadIntegrationScenarios();
    expect([
      ...PRODUCT_COMPILER_SCENARIOS,
      ...Object.keys(CONTRACT_ONLY_SCENARIOS),
    ].sort()).toEqual(scenarios.map((scenario) => scenario.id).sort());
    expect(CONTRACT_ONLY_SCENARIOS['integration-data-update']).toMatch(/does not declare/);

    const connectorScenario = scenarios.find((scenario) => scenario.id === 'integration-connector');
    expect(connectorScenario.runtimeCases.some((runtimeCase) => (
      runtimeCase.id === 'missing-connection-preflight'
    ))).toBe(true);
    expect(CONTRACT_ONLY_RUNTIME_CASES['integration-connector/missing-connection-preflight'])
      .toMatch(/connectionId is optional/);
  });

  test.each(PRODUCT_COMPILER_SCENARIOS)('%s builder output satisfies the locked contract', (scenarioId) => {
    const scenario = loadIntegrationScenarios().find((item) => item.id === scenarioId);
    expect(scenario).toBeTruthy();
    const { contract, binding } = loadContractCase(scenarioId);
    const artifact = compileProductScenario(scenarioId);
    const canonical = normalizeIntegrationReadback(artifact, {
      resourceAliases: binding.resourceAliases,
    });
    const result = verifyIntegrationContract(contract, canonical);

    expect(result).toEqual({ valid: true, errors: [] });
  });
});
