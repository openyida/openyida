'use strict';

const fs = require('fs');
const path = require('path');

const { buildHiddenContract } = require('./validate');
const { canonicalStringify, sha256Canonical } = require('./normalize');

const DEFAULT_SCENARIO_DIR = path.join(__dirname, '..', 'scenarios', 'process-contract');

function i18n(name) {
  return { zh_CN: name, en_US: name };
}

function rawId(scenarioId, key) {
  return 'node_' + scenarioId.replace(/-/g, '_') + '_' + key + '_8f31c7';
}

function processNode(options) {
  return {
    name: i18n(options.name),
    description: '',
    type: options.type,
    nodeId: options.id,
    prevId: options.prevId || '',
    nextId: options.nextId || [],
    props: options.props || {},
    childNodes: options.childNodes || [],
  };
}

function viewNode(options) {
  const props = Object.assign({ name: i18n(options.name) }, options.props || {});
  const node = {
    componentName: options.componentName,
    id: options.id,
    props: props,
    x: options.x === undefined ? 180 : options.x,
    y: options.y === undefined ? 240 : options.y,
    version: 'designer-noise-1',
  };
  if (options.children && options.children.length) {
    node.children = options.children;
  }
  if (options.type) {
    node.type = options.type;
  }
  return node;
}

function approvalPair(scenarioId, key, name, nextId, mode, extraProps, componentName) {
  const id = rawId(scenarioId, key);
  const processProps = Object.assign({
    conditionalMode: 'conditional',
    multiApprove: mode || 'all',
  }, (extraProps && extraProps.process) || {});
  const viewProps = Object.assign({
    nodeName: componentName || 'ApprovalNode',
    approverRules: {
      type: 'ext_target_approval',
      multiApproverType: mode || 'all',
    },
  }, (extraProps && extraProps.view) || {});
  return {
    id: id,
    process: processNode({
      id: id,
      type: 'approval',
      name: name,
      nextId: [nextId],
      props: processProps,
    }),
    view: viewNode({
      id: id,
      componentName: componentName || 'ApprovalNode',
      name: name,
      props: viewProps,
    }),
  };
}

function multiApprovalPair(scenarioId, key, name, nextId, mode) {
  const id = rawId(scenarioId, key);
  return {
    id: id,
    process: processNode({
      id: id,
      type: 'approval',
      name: name,
      nextId: [nextId],
      props: {
        mode: 'multi',
        multiApprove: mode,
        multiRules: [{ status: '0', rules: [] }],
      },
    }),
    view: viewNode({
      id: id,
      componentName: 'MultiApprovalNode',
      name: name,
      props: {
        nodeName: 'MultiApprovalNode',
        multiApproverRules: {
          approvalType_multi: mode,
          multiRules: [{ status: '0', rules: [] }],
        },
      },
    }),
  };
}

function carbonPair(scenarioId, key, name, nextId) {
  const id = rawId(scenarioId, key);
  return {
    id: id,
    process: processNode({
      id: id,
      type: 'carbon',
      name: name,
      nextId: [nextId],
      props: { receiver: { type: 'VARIABLE', value: [['originator']] } },
    }),
    view: viewNode({
      id: id,
      componentName: 'CarbonNode',
      name: name,
      props: { nodeName: 'CarbonNode' },
    }),
  };
}

function conditionPair(scenarioId, key, name, targetPair, config) {
  const id = rawId(scenarioId, key);
  const isDefault = !!config.isDefault;
  const rules = config.rules || [];
  const logic = config.logic || 'AND';
  const conditionBlock = {
    condition: logic,
    conditionCode: logic === 'OR' ? '||' : '&&',
    ruleId: 'random-rule-' + scenarioId + '-' + key,
    rules: rules,
  };
  const processProps = {
    priority: isDefault ? 2147483647 : config.priority,
    isDefault: isDefault,
  };
  const viewConditionProps = {
    isDefault: isDefault,
    priority: processProps.priority,
    description: name,
  };
  if (!isDefault) {
    processProps.calculate = 'condition';
    processProps.conditions = conditionBlock;
    viewConditionProps.calculate = 'condition';
    viewConditionProps.conditions = conditionBlock;
  }
  return {
    id: id,
    process: processNode({
      id: id,
      type: 'condition',
      name: name,
      nextId: [targetPair.id],
      props: processProps,
      childNodes: [targetPair.process],
    }),
    view: viewNode({
      id: id,
      componentName: 'ConditionNode',
      name: name,
      props: isDefault
        ? { isDefault: true, buttons: [{ name: '关闭' }] }
        : { conditions: viewConditionProps },
      children: [targetPair.view],
    }),
  };
}

function parallelBranchPair(scenarioId, key, name, targetPair, priority) {
  const id = rawId(scenarioId, key);
  const conditions = {
    calculate: 'all',
    conditions: { condition: 'AND', conditionCode: '&&', rules: [] },
    isDefault: false,
    priority: priority,
  };
  return {
    id: id,
    process: processNode({
      id: id,
      type: 'condition',
      name: name,
      nextId: [targetPair.id],
      props: { calculate: 'all', isDefault: false },
      childNodes: [targetPair.process],
    }),
    view: viewNode({
      id: id,
      componentName: 'ParallelNode',
      name: name,
      props: { conditions: conditions },
      children: [targetPair.view],
    }),
  };
}

function artifactEnvelope(scenarioId, processNodes, viewNodes) {
  return {
    processJson: {
      props: {
        processCode: 'PROC-CONTRACT-' + scenarioId,
        bindingForm: 'FORM-CONTRACT',
      },
      nodes: processNodes,
      flowConfig: {},
      revision: 'runtime-noise-42',
    },
    viewJson: {
      schema: {
        componentName: 'CanvasEngine',
        id: 'canvas-random-' + scenarioId,
        props: {},
        children: viewNodes,
        version: '0.2.307-local-noise',
      },
      bindingForm: 'FORM-CONTRACT',
      designerVersion: '2026-noise',
    },
  };
}

function lifecycle(scenarioId, firstId) {
  const startId = rawId(scenarioId, 'start');
  const endId = rawId(scenarioId, 'end');
  return {
    startId: startId,
    endId: endId,
    startProcess: processNode({ id: startId, type: 'apply', name: '发起', nextId: [firstId || endId] }),
    endProcess: processNode({ id: endId, type: 'finish', name: '结束' }),
    startView: viewNode({
      id: rawId(scenarioId, 'start_view_noise'),
      componentName: 'ApplyNode',
      name: '发起',
      props: { nodeName: 'ApplyNode' },
    }),
    endView: viewNode({ id: endId, componentName: 'EndNode', name: '结束' }),
  };
}

function buildSerialApproval(scenario) {
  const endId = rawId(scenario.id, 'end');
  const hr = approvalPair(scenario.id, 'hr', '人事审批', endId, 'all');
  const manager = approvalPair(scenario.id, 'manager', '直属主管审批', hr.id, 'all');
  const life = lifecycle(scenario.id, manager.id);
  return {
    artifact: artifactEnvelope(
      scenario.id,
      [life.startProcess, manager.process, hr.process, life.endProcess],
      [life.startView, manager.view, hr.view, life.endView]
    ),
    runtimeCases: [{
      id: 'serial-happy-path',
      kind: 'path',
      expectedSequence: ['发起', '直属主管审批', '人事审批', '结束'],
    }],
  };
}

function buildAmountConditionBoundary(scenario) {
  const endId = rawId(scenario.id, 'end');
  const specialTarget = approvalPair(scenario.id, 'special_approval', '特别审批', endId, 'all');
  const highTarget = approvalPair(scenario.id, 'finance_approval', '财务审批', endId, 'all');
  const standardTarget = approvalPair(scenario.id, 'manager_operator', '主管办理', endId, 'all', null, 'OperatorNode');
  const zeroTarget = approvalPair(scenario.id, 'zero_operator', '零金额归档', endId, 'all', null, 'OperatorNode');
  const defaultTarget = approvalPair(scenario.id, 'exception_operator', '异常金额复核', endId, 'all', null, 'OperatorNode');

  const branches = [
    conditionPair(scenario.id, 'special_branch', '紧急或超大额', specialTarget, {
      priority: 1,
      logic: 'OR',
      rules: [
        { id: 'urgency', opCode: 'Equal', ruleValue: '紧急' },
        { id: 'amount', op: '大于', ruleValue: 50000 },
      ],
    }),
    conditionPair(scenario.id, 'high_branch', '一万元及以上', highTarget, {
      priority: 2,
      logic: 'AND',
      rules: [{ id: 'amount', opCode: 'GreaterThanOrEqual', ruleValue: 10000 }],
    }),
    conditionPair(scenario.id, 'standard_branch', '零到一万元', standardTarget, {
      priority: 3,
      logic: 'AND',
      rules: [
        { id: 'amount', opCode: 'GreaterThan', ruleValue: 0 },
        { fieldId: 'amount', op: '小于', ruleValue: 10000 },
      ],
    }),
    conditionPair(scenario.id, 'zero_branch', '零金额', zeroTarget, {
      priority: 4,
      logic: 'AND',
      rules: [{ id: 'amount', opCode: 'Equal', ruleValue: 0 }],
    }),
    conditionPair(scenario.id, 'default_branch', '其他情况', defaultTarget, {
      isDefault: true,
    }),
  ];
  const routeId = rawId(scenario.id, 'amount_route');
  const routeProcess = processNode({
    id: routeId,
    type: 'route',
    name: '金额条件',
    nextId: branches.map(function (branch) { return branch.id; }),
    props: { outgoingType: 'priority' },
    childNodes: branches.map(function (branch) { return branch.process; }),
  });
  const routeView = viewNode({
    id: routeId,
    componentName: 'ConditionContainer',
    name: '金额条件',
    type: 'condition',
    children: branches.map(function (branch) { return branch.view; }),
  });
  const life = lifecycle(scenario.id, routeId);
  const runtimeCases = [
    ['urgent-low', { amount: 1, urgency: '紧急' }, '紧急或超大额', '特别审批'],
    ['greater-than-boundary-hit', { amount: 50001, urgency: '普通' }, '紧急或超大额', '特别审批'],
    ['greater-than-boundary-miss', { amount: 50000, urgency: '普通' }, '一万元及以上', '财务审批'],
    ['greater-or-equal-boundary', { amount: 10000, urgency: '普通' }, '一万元及以上', '财务审批'],
    ['less-than-boundary', { amount: 9999, urgency: '普通' }, '零到一万元', '主管办理'],
    ['equal-zero', { amount: 0, urgency: '普通' }, '零金额', '零金额归档'],
    ['default-negative', { amount: -1, urgency: '普通' }, '其他情况', '异常金额复核'],
  ].map(function (item) {
    return {
      id: item[0],
      kind: 'condition',
      routeName: '金额条件',
      input: item[1],
      expectedBranch: item[2],
      expectedTarget: item[3],
    };
  });
  return {
    artifact: artifactEnvelope(
      scenario.id,
      [life.startProcess, routeProcess, life.endProcess],
      [life.startView, routeView, life.endView]
    ),
    runtimeCases: runtimeCases,
  };
}

function buildParallelReview(scenario) {
  const endId = rawId(scenario.id, 'end');
  const legal = approvalPair(scenario.id, 'legal_approval', '法务审批', endId, 'all');
  const finance = approvalPair(scenario.id, 'finance_approval', '财务审批', endId, 'all');
  const branches = [
    parallelBranchPair(scenario.id, 'legal_branch', '法务分支', legal, 1),
    parallelBranchPair(scenario.id, 'finance_branch', '财务分支', finance, 2),
  ];
  const parallelId = rawId(scenario.id, 'parallel_route');
  const parallelProcess = processNode({
    id: parallelId,
    type: 'route',
    name: '合同并行会审',
    nextId: branches.map(function (branch) { return branch.id; }),
    props: { outgoingType: 'multiple' },
    childNodes: branches.map(function (branch) { return branch.process; }),
  });
  const parallelView = viewNode({
    id: parallelId,
    componentName: 'ConditionContainer',
    name: '合同并行会审',
    type: 'parallel',
    children: branches.map(function (branch) { return branch.view; }),
  });
  const life = lifecycle(scenario.id, parallelId);
  return {
    artifact: artifactEnvelope(
      scenario.id,
      [life.startProcess, parallelProcess, life.endProcess],
      [life.startView, parallelView, life.endView]
    ),
    runtimeCases: [{
      id: 'parallel-fan-out',
      kind: 'parallelTargets',
      routeName: '合同并行会审',
      expectedTargets: ['法务审批', '财务审批'],
    }],
  };
}

function buildMultiApprovalModes(scenario) {
  const endId = rawId(scenario.id, 'end');
  const serial = multiApprovalPair(scenario.id, 'serial', '依次审批', endId, 'oneByOne');
  const any = multiApprovalPair(scenario.id, 'any', '任一审批', serial.id, 'or');
  const all = multiApprovalPair(scenario.id, 'all', '全员审批', any.id, 'all');
  const life = lifecycle(scenario.id, all.id);
  return {
    artifact: artifactEnvelope(
      scenario.id,
      [life.startProcess, all.process, any.process, serial.process, life.endProcess],
      [life.startView, all.view, any.view, serial.view, life.endView]
    ),
    runtimeCases: [{
      id: 'approval-mode-enums',
      kind: 'approvalModes',
      expected: { 全员审批: 'all', 任一审批: 'or', 依次审批: 'oneByOne' },
    }],
  };
}

function buildFieldPermissions(scenario) {
  const endId = rawId(scenario.id, 'end');
  const behaviorList = [
    { fieldId: 'title', fieldBehavior: 'NORMAL' },
    { fieldId: 'amount', fieldBehavior: 'READONLY' },
    { fieldId: 'internalNote', fieldBehavior: 'HIDDEN' },
  ];
  const approval = approvalPair(scenario.id, 'permission_approval', '权限审批', endId, 'all', {
    process: { formConfig: { behaviorList: behaviorList } },
    view: { formConfig: { behaviorList: behaviorList } },
  });
  const life = lifecycle(scenario.id, approval.id);
  const artifact = artifactEnvelope(
    scenario.id,
    [life.startProcess, approval.process, life.endProcess],
    [life.startView, approval.view, life.endView]
  );
  artifact.processJson.flowConfig[approval.id] = behaviorList;
  return {
    artifact: artifact,
    runtimeCases: [{
      id: 'field-permission-matrix',
      kind: 'fieldPermissions',
      nodeName: '权限审批',
      expected: { title: 'NORMAL', amount: 'READONLY', internalNote: 'HIDDEN' },
    }],
  };
}

function buildReturnTarget(scenario) {
  const endId = rawId(scenario.id, 'end');
  const carbon = carbonPair(scenario.id, 'carbon', '抄送申请人', endId);
  const reviewId = rawId(scenario.id, 'review');
  const initialId = rawId(scenario.id, 'initial');
  const review = approvalPair(scenario.id, 'review', '复核审批', carbon.id, 'all', {
    process: {
      routeRule: {
        rules: [{ event: 'disagree', targetNodeId: initialId }],
      },
    },
    view: {
      routeRule: {
        rules: [{ event: 'disagree', targetNodeId: initialId }],
      },
    },
  });
  if (review.id !== reviewId) {
    throw new Error('return target template id mismatch');
  }
  const initial = approvalPair(scenario.id, 'initial', '初审', review.id, 'all');
  const life = lifecycle(scenario.id, initial.id);
  return {
    artifact: artifactEnvelope(
      scenario.id,
      [life.startProcess, initial.process, review.process, carbon.process, life.endProcess],
      [life.startView, initial.view, review.view, carbon.view, life.endView]
    ),
    runtimeCases: [{
      id: 'review-disagree-return',
      kind: 'returnRule',
      nodeName: '复核审批',
      event: 'disagree',
      expectedTarget: '初审',
    }],
  };
}

const TEMPLATE_BUILDERS = {
  serialApproval: buildSerialApproval,
  amountConditionBoundary: buildAmountConditionBoundary,
  parallelReview: buildParallelReview,
  multiApprovalModes: buildMultiApprovalModes,
  fieldPermissions: buildFieldPermissions,
  returnTarget: buildReturnTarget,
};

function loadScenarioFiles(scenarioDir) {
  const dir = scenarioDir || DEFAULT_SCENARIO_DIR;
  return fs.readdirSync(dir)
    .filter(function (file) { return file.endsWith('.json'); })
    .sort()
    .map(function (file) {
      return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    });
}

function buildBuilderPrompt(scenario) {
  return [
    '你是 OpenYida 流程构建器。请只根据以下公开需求生成流程定义。',
    '不得访问网络、登录平台或创建线上资源。',
    '输出必须包含 processJson 与 viewJson；两者的节点类型、名称、连线和分支目标应语义一致。',
    '',
    '场景：' + scenario.title,
    '需求：' + scenario.request,
  ].join('\n');
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
  }
  return value;
}

function freezeContract(contract) {
  const canonicalJson = canonicalStringify(contract);
  const hash = sha256Canonical(contract);
  return {
    contract: deepFreeze(JSON.parse(canonicalJson)),
    canonicalJson: canonicalJson,
    hashAlgorithm: 'sha256',
    hash: hash,
  };
}

function generateScenario(scenario) {
  if (!scenario || !TEMPLATE_BUILDERS[scenario.template]) {
    throw new Error('unknown process contract template: ' + (scenario && scenario.template));
  }
  const generated = TEMPLATE_BUILDERS[scenario.template](scenario);
  const hiddenContract = buildHiddenContract(generated.artifact, generated.runtimeCases, {
    scenarioId: scenario.id,
    protocolVersion: 1,
  });
  const frozen = freezeContract(hiddenContract);
  return {
    id: scenario.id,
    title: scenario.title,
    builderPrompt: buildBuilderPrompt(scenario),
    hiddenContract: frozen.contract,
    contractCanonicalJson: frozen.canonicalJson,
    contractHashAlgorithm: frozen.hashAlgorithm,
    contractHash: frozen.hash,
    runtimeCases: generated.runtimeCases,
    fixture: generated.artifact,
    compilerConformance: 'pending',
  };
}

function generateAllScenarios(options) {
  const scenarios = loadScenarioFiles(options && options.scenarioDir);
  return scenarios.map(generateScenario);
}

module.exports = {
  DEFAULT_SCENARIO_DIR,
  TEMPLATE_BUILDERS,
  loadScenarioFiles,
  buildBuilderPrompt,
  freezeContract,
  generateScenario,
  generateAllScenarios,
};
