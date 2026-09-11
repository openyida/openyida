'use strict';

const {
  generateAllScenarios,
} = require('../scripts/eval/process-contract/scenario-generator');
const {
  validateArtifact,
} = require('../scripts/eval/process-contract/validate');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function collectProcessNodes(nodes, output) {
  (nodes || []).forEach(function (node) {
    output.push(node);
    collectProcessNodes(node.childNodes, output);
  });
}

function collectViewNodes(nodes, output) {
  (nodes || []).forEach(function (node) {
    output.push(node);
    collectViewNodes(node.children, output);
  });
}

function findProcessNode(artifact, name) {
  const nodes = [];
  collectProcessNodes(artifact.processJson.nodes, nodes);
  return nodes.find(function (node) {
    const value = node.name;
    return (typeof value === 'string' ? value : value.zh_CN) === name;
  });
}

function findViewNode(artifact, name) {
  const nodes = [];
  collectViewNodes(artifact.viewJson.schema.children, nodes);
  return nodes.find(function (node) {
    const value = node.props && node.props.name;
    return (typeof value === 'string' ? value : value && value.zh_CN) === name;
  });
}

function scenarioById(id) {
  return generateAllScenarios().find(function (scenario) { return scenario.id === id; });
}

function expectMutationError(scenario, mutated, code) {
  const result = validateArtifact(mutated, scenario.hiddenContract);
  const detected = result.errors.find(function (item) { return item.code === code; });
  expect(result.valid).toBe(false);
  expect(detected).toBeDefined();
  expect(Object.keys(detected)).toEqual(['code', 'path', 'expected', 'actual']);
  expect(detected.path).toMatch(/^\$/);
}

function extraApprovalProcessNode(id, name) {
  return {
    name: { zh_CN: name, en_US: name },
    description: '',
    type: 'approval',
    nodeId: id,
    prevId: '',
    nextId: [],
    props: {
      conditionalMode: 'conditional',
      multiApprove: 'all',
    },
    childNodes: [],
  };
}

function extraApprovalViewNode(id, name) {
  return {
    componentName: 'ApprovalNode',
    id: id,
    props: {
      name: { zh_CN: name, en_US: name },
      nodeName: 'ApprovalNode',
      approverRules: {
        type: 'ext_target_approval',
        multiApproverType: 'all',
      },
    },
  };
}

describe('process contract mutation detection', () => {
  test('detects a deleted node', () => {
    const scenario = scenarioById('serial-approval');
    const mutated = clone(scenario.fixture);
    const removed = findProcessNode(mutated, '人事审批');
    mutated.processJson.nodes = mutated.processJson.nodes.filter(function (node) {
      return node.nodeId !== removed.nodeId;
    });
    mutated.viewJson.schema.children = mutated.viewJson.schema.children.filter(function (node) {
      return node.id !== removed.nodeId;
    });
    expectMutationError(scenario, mutated, 'PROCESS_NODE_MISSING');
  });

  test('detects swapped branch targets', () => {
    const scenario = scenarioById('amount-condition-boundary');
    const mutated = clone(scenario.fixture);
    const high = findProcessNode(mutated, '一万元及以上');
    const fallback = findProcessNode(mutated, '其他情况');
    const highTarget = high.nextId[0];
    high.nextId[0] = fallback.nextId[0];
    fallback.nextId[0] = highTarget;
    expectMutationError(scenario, mutated, 'PROCESS_BRANCH_TARGET_MISMATCH');
  });

  test('detects GreaterThanOrEqual weakened to GreaterThan', () => {
    const scenario = scenarioById('amount-condition-boundary');
    const mutated = clone(scenario.fixture);
    const branch = findProcessNode(mutated, '一万元及以上');
    branch.props.conditions.rules[0].opCode = 'GreaterThan';
    expectMutationError(scenario, mutated, 'PROCESS_CONDITION_OPERATOR_MISMATCH');
  });

  test('detects all changed to or', () => {
    const scenario = scenarioById('multi-approval-modes');
    const mutated = clone(scenario.fixture);
    findProcessNode(mutated, '全员审批').props.multiApprove = 'or';
    expectMutationError(scenario, mutated, 'PROCESS_APPROVAL_MODE_MISMATCH');
  });

  test('detects a missing default branch marker', () => {
    const scenario = scenarioById('amount-condition-boundary');
    const mutated = clone(scenario.fixture);
    findProcessNode(mutated, '其他情况').props.isDefault = false;
    const viewDefault = findViewNode(mutated, '其他情况');
    viewDefault.props.isDefault = false;
    expectMutationError(scenario, mutated, 'PROCESS_DEFAULT_BRANCH_MISSING');
  });

  test('detects changed field permission', () => {
    const scenario = scenarioById('field-permissions');
    const mutated = clone(scenario.fixture);
    const approval = findProcessNode(mutated, '权限审批');
    const amount = approval.props.formConfig.behaviorList.find(function (item) {
      return item.fieldId === 'amount';
    });
    amount.fieldBehavior = 'NORMAL';
    expectMutationError(scenario, mutated, 'PROCESS_FIELD_PERMISSION_MISMATCH');
  });

  test('detects missing top-level flowConfig field permission mapping', () => {
    const scenario = scenarioById('field-permissions');
    const mutated = clone(scenario.fixture);
    const approval = findProcessNode(mutated, '权限审批');
    delete mutated.processJson.flowConfig[approval.nodeId];
    expectMutationError(scenario, mutated, 'PROCESS_FLOW_CONFIG_PERMISSION_MISMATCH');
  });

  test('distinguishes MultiApprovalNode from ordinary ApprovalNode', () => {
    const scenario = scenarioById('multi-approval-modes');
    const mutated = clone(scenario.fixture);
    const processNode = findProcessNode(mutated, '全员审批');
    const viewNode = findViewNode(mutated, '全员审批');
    processNode.props.mode = 'single';
    viewNode.componentName = 'ApprovalNode';
    viewNode.props.nodeName = 'ApprovalNode';
    expectMutationError(scenario, mutated, 'PROCESS_APPROVAL_COMPONENT_MISMATCH');
  });

  test('detects a broken node reference', () => {
    const scenario = scenarioById('serial-approval');
    const mutated = clone(scenario.fixture);
    findProcessNode(mutated, '直属主管审批').nextId = ['missing-node-reference'];
    expectMutationError(scenario, mutated, 'PROCESS_NODE_REFERENCE_BROKEN');
  });

  test('detects an undeclared process and view node outside the main chain', () => {
    const scenario = scenarioById('serial-approval');
    const mutated = clone(scenario.fixture);
    const id = 'undeclared-process-and-view-node';
    mutated.processJson.nodes.push(extraApprovalProcessNode(id, '未声明审批'));
    mutated.viewJson.schema.children.push(extraApprovalViewNode(id, '未声明审批'));
    expectMutationError(scenario, mutated, 'PROCESS_NODE_UNEXPECTED');
  });

  test('detects an undeclared view-only business node', () => {
    const scenario = scenarioById('serial-approval');
    const mutated = clone(scenario.fixture);
    mutated.viewJson.schema.children.push(extraApprovalViewNode('undeclared-view-node', '未声明视图审批'));
    expectMutationError(scenario, mutated, 'PROCESS_VIEW_NODE_UNEXPECTED');
  });
});
