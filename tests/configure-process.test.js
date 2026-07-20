'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const configureProcess = require('../lib/process/configure-process');
const { _private } = configureProcess;

function getApprovalNodes(result) {
  return result.processJson.nodes.filter(function (node) {
    return node.type === 'approval';
  });
}

function getViewApprovalNode(result) {
  return result.viewJson.schema.children.find(function (node) {
    return node.componentName === 'ApprovalNode';
  });
}

describe('configure-process detail urls', () => {
  test('builds mobile custom detail url with DingTalk formInstId parameter', () => {
    const result = _private.buildProcessAndViewJson({
      customDetailPageUrl: 'https://www.aliwork.com/o/custom-detail?source=process',
      nodes: [
        {
          type: 'approval',
          name: '主管审批',
          approver: 'originator',
        },
      ],
    }, 'TPROC-TEST', 'FORM-TEST', 'https://www.aliwork.com', 'APP_TEST');

    expect(Object.keys(result).sort()).toEqual(['processJson', 'viewJson']);
    expect(result.processJson.props.processDetailUrl).toBe('https://www.aliwork.com/o/custom-detail?source=process');
    expect(result.processJson.props.processMobileDetailUrl).toBe('https://www.aliwork.com/o/custom-detail?source=process&formInstId=');
  });
});

describe('configure-process approver DSL', () => {
  test('builds specified member approver from users', () => {
    const result = _private.buildProcessAndViewJson({
      nodes: [
        {
          type: 'approval',
          name: '主管审批',
          approver: {
            type: 'user',
            users: [{ id: 'manager7350', name: '九神' }],
          },
        },
      ],
    }, 'TPROC-TEST', 'FORM-TEST', 'https://www.aliwork.com', 'APP_TEST');

    const approvalNode = getApprovalNodes(result)[0];
    expect(approvalNode.approvalType).toBe('ext_target_approval');
    expect(approvalNode.props.approvals).toEqual(['manager7350']);
    expect(approvalNode.props.multiApprove).toBe('all');

    const approverRules = getViewApprovalNode(result).props.approverRules;
    expect(approverRules.type).toBe('ext_target_approval');
    expect(approverRules.approvals).toEqual([
      {
        id: 'manager7350',
        label: '九神',
        type: 'employee',
        roleType: 'DINGTALK',
      },
    ]);
    expect(approverRules.description).toBe('九神');
  });

  test('builds role approver with multiRoles grouped by roleType', () => {
    const result = _private.buildProcessAndViewJson({
      nodes: [
        {
          type: 'approval',
          name: '财务审批',
          approver: {
            type: 'role',
            roles: [
              { id: 'ROLE-FINANCE', label: '财务', roleType: 'YIDA' },
              { id: 'ROLE-DING', label: '钉钉角色', roleType: 'DINGTALK' },
            ],
            multiApproverType: 'or',
          },
        },
      ],
    }, 'TPROC-TEST', 'FORM-TEST', 'https://www.aliwork.com', 'APP_TEST');

    const approvalNode = getApprovalNodes(result)[0];
    expect(approvalNode.approvalType).toBe('ext_target_approval_role');
    expect(approvalNode.props.approvals).toBeUndefined();
    expect(approvalNode.props.multiApprove).toBe('or');
    expect(approvalNode.props.multiRoles).toEqual([
      { roleId: ['ROLE-FINANCE'], roleExtType: 'YIDA' },
      { roleId: ['ROLE-DING'], roleExtType: 'DINGTALK' },
    ]);

    const approverRules = getViewApprovalNode(result).props.approverRules;
    expect(approverRules.type).toBe('ext_target_approval_role');
    expect(approverRules.approvalType_ext_target_approval_role).toBe('or');
    expect(approverRules.roles[0]).toEqual({
      id: 'ROLE-FINANCE',
      label: '财务',
      type: 'role',
      roleType: 'YIDA',
    });
  });

  test('builds department leader approver from originator source', () => {
    const result = _private.buildProcessAndViewJson({
      nodes: [
        {
          type: 'approval',
          name: '部门主管审批',
          approver: {
            type: 'deptLeader',
            source: 'originator',
            level: 2,
            needLeaderReplace: true,
            ignoreNoLeaderDept: false,
          },
        },
      ],
    }, 'TPROC-TEST', 'FORM-TEST', 'https://www.aliwork.com', 'APP_TEST');

    const approvalNode = getApprovalNodes(result)[0];
    expect(approvalNode.approvalType).toBe('ext_target_dept_leader');
    expect(approvalNode.props.approvals).toBeUndefined();
    expect(approvalNode.props).toMatchObject({
      key: 'DeptLeaderApproverRule_1.0.0',
      userIdVar: 'originator',
      reportLevel: 2,
      ignoreNoLeaderDept: 'false',
      needLeaderReplace: 'true',
      multiApprove: 'all',
    });

    const approverRules = getViewApprovalNode(result).props.approverRules;
    expect(approverRules.type).toBe('ext_target_dept_leader');
    expect(approverRules.supervisorType).toEqual({ value: 'originator', label: '发起人' });
    expect(approverRules.supervisorLevel).toBe('2');
    expect(approverRules.description).toBe('发起人的第2级主管');
  });

  test('builds operator node from executor DSL', () => {
    const result = _private.buildProcessAndViewJson({
      nodes: [
        {
          type: 'operator',
          name: '资料补充',
          executor: {
            type: 'user',
            users: [{ id: 'operator001', name: '运营同学' }],
          },
        },
      ],
    }, 'TPROC-TEST', 'FORM-TEST', 'https://www.aliwork.com', 'APP_TEST');

    const operatorNode = getApprovalNodes(result)[0];
    expect(operatorNode.type).toBe('approval');
    expect(operatorNode.approvalType).toBe('ext_target_approval');
    expect(operatorNode.props.approvals).toEqual(['operator001']);

    const viewOperatorNode = result.viewJson.schema.children.find(function (node) {
      return node.componentName === 'OperatorNode';
    });
    expect(viewOperatorNode).toBeTruthy();
    expect(viewOperatorNode.props.nodeName).toBe('OperatorNode');
    expect(viewOperatorNode.props.approverRules.description).toBe('运营同学');
  });
});

describe('configure-process parallel DSL', () => {
  test('builds parallel branches that rejoin the following node', () => {
    const result = _private.buildProcessAndViewJson({
      nodes: [
        {
          type: 'parallel',
          name: '并行审批',
          branches: [
            {
              name: '产管审批',
              childNodes: [
                {
                  type: 'approval',
                  name: '产管审批',
                  approver: 'originator',
                },
              ],
            },
            {
              name: '价管审批',
              childNodes: [
                {
                  type: 'approval',
                  name: '价管审批',
                  approver: 'originator',
                },
              ],
            },
          ],
        },
        {
          type: 'carbon',
          name: '抄送销售和BI',
          approver: 'originator',
        },
      ],
    }, 'TPROC-TEST', 'FORM-TEST', 'https://www.aliwork.com', 'APP_TEST');

    const middleNodes = result.processJson.nodes.slice(1, -1);
    const parallelNode = middleNodes[0];
    const carbonNode = middleNodes[1];

    expect(parallelNode.type).toBe('route');
    expect(parallelNode.props.outgoingType).toBe('multiple');
    expect(parallelNode.nextId).toHaveLength(2);
    expect(parallelNode.childNodes).toHaveLength(2);
    expect(carbonNode.type).toBe('carbon');
    expect(carbonNode.prevId).toBe(parallelNode.nodeId);

    parallelNode.childNodes.forEach(function (branchNode) {
      expect(branchNode.type).toBe('condition');
      expect(branchNode.prevId).toBe(parallelNode.nodeId);
      expect(branchNode.props.calculate).toBe('all');
      expect(branchNode.childNodes).toHaveLength(1);

      const approvalNode = branchNode.childNodes[0];
      expect(branchNode.nextId).toEqual([approvalNode.nodeId]);
      expect(approvalNode.type).toBe('approval');
      expect(approvalNode.prevId).toBe(branchNode.nodeId);
      expect(approvalNode.nextId).toEqual([carbonNode.nodeId]);
    });

    const viewParallelNode = result.viewJson.schema.children.find(function (node) {
      return node.componentName === 'ConditionContainer' && node.type === 'parallel';
    });
    expect(viewParallelNode).toBeTruthy();
    expect(viewParallelNode.children).toHaveLength(2);
    expect(viewParallelNode.children.map(function (node) { return node.componentName; })).toEqual([
      'ParallelNode',
      'ParallelNode',
    ]);
    expect(viewParallelNode.children[0].children[0].componentName).toBe('ApprovalNode');
  });

  test('builds route-style rules for conditional parallel branches', () => {
    const result = _private.buildProcessAndViewJson({
      nodes: [
        {
          type: 'parallel',
          branches: [
            {
              name: '大额审批',
              logic: 'OR',
              rules: [
                {
                  fieldId: 'numberField_amount',
                  fieldName: '金额',
                  componentType: 'NumberField',
                  op: 'GreaterThan',
                  value: 1000,
                },
              ],
              childNodes: [
                {
                  type: 'approval',
                  name: '大额审批',
                  approver: 'originator',
                },
              ],
            },
          ],
        },
      ],
    }, 'TPROC-TEST', 'FORM-TEST', 'https://www.aliwork.com', 'APP_TEST');

    const parallelNode = result.processJson.nodes.find(function (node) {
      return node.type === 'route' && node.props.outgoingType === 'multiple';
    });
    const branchNode = parallelNode.childNodes[0];

    expect(branchNode.props.calculate).toBe('condition');
    expect(branchNode.props.conditions.condition).toBe('OR');
    expect(branchNode.props.conditions.conditionCode).toBe('||');
    expect(branchNode.props.conditions.rules[0].formula).toBe('${numberField_amount}>1000');
  });
});

describe('configure-process official component nodes', () => {
  test('builds connector node from captured connectorRules props', () => {
    const result = _private.buildProcessAndViewJson({
      nodes: [
        {
          type: 'connector',
          name: '创建钉钉待办',
          connectorRules: {
            connectorId: 'G-CONN-TEST',
            actionId: 'G-ACT-TEST',
            connector: { mode: 1 },
            inputs: {
              assignments: [
                { column: 'subject', valueType: 'literal', value: '测试待办', assignments: [] },
              ],
            },
          },
        },
      ],
    }, 'TPROC-TEST', 'FORM-TEST', 'https://www.aliwork.com', 'APP_TEST');

    const connectorNode = result.processJson.nodes.find(function (node) {
      return node.type === 'innerConnector';
    });
    expect(connectorNode).toBeTruthy();
    expect(connectorNode.props.inputs.connectorId).toBe('G-CONN-TEST');
    expect(connectorNode.props.inputs.actionId).toBe('G-ACT-TEST');
    expect(connectorNode.props.connectorRules).toBeUndefined();

    const viewConnectorNode = result.viewJson.schema.children.find(function (node) {
      return node.componentName === 'ConnectorNode';
    });
    expect(viewConnectorNode).toBeTruthy();
    expect(viewConnectorNode.props.nodeName).toBe('ConnectorNode');
    expect(viewConnectorNode.props.connectorRules.actionId).toBe('G-ACT-TEST');
  });

  test('supports all known yida-simple-flow component aliases in raw props mode', () => {
    const nodes = [
      { componentName: 'GroovyNode', name: 'Groovy', groovy: { action: { code: 'return inputs;' } } },
      { componentName: 'JavaScriptNode', name: 'JS', JavaScript: { action: { code: 'return inputs;' } } },
      { componentName: 'SendMessageNode', name: '消息', sendMessageRules: { messageType: 'workNotice' } },
      { componentName: 'SendEmailNode', name: '邮件', sendEmailRules: { accountId: 'mail-account' } },
      { componentName: 'GetSingleDataNode', name: '查单条', getData: { sourceId: 'FORM-A' } },
      { componentName: 'GetBatchDataNode', name: '查多条', getData: { sourceId: 'FORM-A' } },
      { componentName: 'AddDataNode', name: '新增', addDataRules: { formUuid: 'FORM-B' } },
      { componentName: 'UpdateDataNode', name: '更新', updateDataRules: { sourceId: 'node-a' } },
      { componentName: 'DeleteDataNode', name: '删除', deleteData: { sourceId: 'node-a' } },
      { componentName: 'InitiateApprovalNode', name: '子流程', initiateApprovalRules: { formUuid: 'FORM-C' } },
      { componentName: 'SendCardNode', name: '发卡片', sendCardRules: { cardId: 'CARD-A' } },
      { componentName: 'UpdateCardNode', name: '更新卡片', updateCardRules: { cardId: 'CARD-A' } },
      { componentName: 'CycleContainer', name: '循环', cycleRules: { sourceId: 'node-a' } },
      { componentName: 'AINode', name: 'AI', workFlowRules: { name: 'AI 节点' } },
    ];

    const result = _private.buildProcessAndViewJson({ nodes }, 'TPROC-TEST', 'FORM-TEST', 'https://www.aliwork.com', 'APP_TEST');
    const middleTypes = result.processJson.nodes.slice(1, -1).map(function (node) {
      return node.type;
    });

    expect(middleTypes).toEqual([
      'CodeExecutor',
      'CodeExecutor',
      'sendMessage',
      'sendEmail',
      'dataRetrieve',
      'dataRetrieve',
      'dataCreate',
      'dataUpdate',
      'dataDelete',
      'initiateApproval',
      'sendCard',
      'updateCard',
      'foreach',
      'AIExecutor',
    ]);
    expect(result.viewJson.schema.children.some(function (node) {
      return node.componentName === 'InitiateApprovalNode';
    })).toBe(true);

    const cycleNode = result.processJson.nodes.find(function (node) {
      return node.type === 'foreach';
    });
    expect(cycleNode.props.sourceId).toBe('node-a');
  });

  test('throws on unsupported node types instead of creating broken links', () => {
    expect(function () {
      _private.buildProcessAndViewJson({
        nodes: [{ type: 'madeUpNode', name: '未知节点' }],
      }, 'TPROC-TEST', 'FORM-TEST', 'https://www.aliwork.com', 'APP_TEST');
    }).toThrow('不支持的流程节点类型');
  });
});

describe('configure-process command runner', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('../lib/core/yida-client');
    jest.restoreAllMocks();
  });

  test('throws a CliError for missing arguments without exiting', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit should not be called');
    });

    await expect(configureProcess.run([])).rejects.toMatchObject({
      code: 'CONFIGURE_PROCESS_INVALID_ARGUMENTS',
    });
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('uses yida-client and returns the published process result', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-configure-process-'));
    const definitionFile = path.join(tempDir, 'process.json');
    fs.writeFileSync(definitionFile, JSON.stringify({ nodes: [] }));

    const mockAuthRef = {
      baseUrl: 'https://www.aliwork.com',
    };
    const mockGet = jest.fn().mockResolvedValueOnce({
      success: true,
      content: { data: [{ id: 100, version: '2' }] },
    });
    const mockPostForm = jest.fn()
      .mockResolvedValueOnce({ success: true, content: { processId: 101 } })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true });

    jest.resetModules();
    jest.doMock('../lib/core/yida-client', () => ({
      createAuthRef: jest.fn(() => mockAuthRef),
      createYidaClient: jest.fn(() => ({
        get: mockGet,
        postForm: mockPostForm,
      })),
    }));

    const freshConfigureProcess = require('../lib/process/configure-process');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit should not be called');
    });

    const result = await freshConfigureProcess.run([
      'APP_TEST',
      'FORM_TEST',
      definitionFile,
      'TPROC_TEST',
    ]);

    expect(result).toEqual({
      success: true,
      processCode: 'TPROC_TEST',
      processId: 101,
      processVersion: 3,
      appType: 'APP_TEST',
      formUuid: 'FORM_TEST',
    });
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe('/alibaba/web/APP_TEST/query/process/pageProcessVersion.json');
    expect(mockPostForm).toHaveBeenCalledTimes(3);
    expect(mockPostForm.mock.calls[0][0]).toBe('/APP_TEST/query/simpleProcess/newDraftProcess.json');
    expect(mockPostForm.mock.calls[1][0]).toBe('/alibaba/web/APP_TEST/query/simpleProcess/saveProcessById.json');
    expect(mockPostForm.mock.calls[2][0]).toBe('/alibaba/web/APP_TEST/query/simpleProcess/publishProcessById.json');
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(result));
    expect(exitSpy).not.toHaveBeenCalled();

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
