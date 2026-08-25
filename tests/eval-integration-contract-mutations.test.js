'use strict';

const fs = require('fs');
const path = require('path');

const {
  normalizeIntegrationReadback,
  verifyIntegrationContract,
} = require('../scripts/eval/integration-contract');

const ROOT = path.join(__dirname, '..', 'scripts', 'eval', 'integration-contract');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadCase(id) {
  const contract = readJson(path.join(ROOT, 'contracts', id + '.contract.json'));
  const golden = readJson(path.join(ROOT, 'fixtures', 'golden', id + '.readback.json'));
  const binding = readJson(path.join(ROOT, 'fixtures', 'bindings', id + '.resource-aliases.json'));
  const canonical = normalizeIntegrationReadback(golden, {
    resourceAliases: binding.resourceAliases,
  });
  expect(verifyIntegrationContract(contract, canonical)).toEqual({ valid: true, errors: [] });
  return { contract, golden, binding, canonical: clone(canonical) };
}

function findNode(side, key) {
  return side.nodes.find(function (node) { return node.key === key; });
}

function findBranch(side, key) {
  return side.branches.find(function (branch) { return branch.key === key; });
}

function mutateBoth(canonical, callback) {
  callback(canonical.process);
  callback(canonical.view);
}

function expectMutation(id, code, mutate) {
  const item = loadCase(id);
  mutate(item.canonical);
  const result = verifyIntegrationContract(item.contract, item.canonical);
  const error = result.errors.find(function (candidate) { return candidate.code === code; });
  expect(result.valid).toBe(false);
  expect(error).toBeDefined();
  expect(Object.keys(error)).toEqual(['code', 'path', 'expected', 'actual']);
  expect(error.path).toMatch(/^\$/);
  expect(Object.prototype.hasOwnProperty.call(error, 'expected')).toBe(true);
  expect(Object.prototype.hasOwnProperty.call(error, 'actual')).toBe(true);
}

describe('integration contract mutation detection', () => {
  test('detects a deleted trigger', () => {
    expectMutation('integration-submit-notify', 'INTEGRATION_TRIGGER_MISSING', function (canonical) {
      canonical.process.trigger = null;
    });
  });

  test('detects a changed trigger event', () => {
    expectMutation('integration-submit-notify', 'INTEGRATION_TRIGGER_EVENT_MISMATCH', function (canonical) {
      canonical.process.trigger.eventTypes = ['delete'];
    });
  });

  test('detects a deleted intermediate node', () => {
    expectMutation('integration-get-self-route-notify', 'INTEGRATION_NODE_MISSING', function (canonical) {
      mutateBoth(canonical, function (side) {
        side.nodes = side.nodes.filter(function (node) { return node.key !== 'dataRetrieve'; });
      });
    });
  });

  test('detects swapped route targets', () => {
    expectMutation('integration-data-retrieve-default', 'INTEGRATION_ROUTE_TARGET_MISMATCH', function (canonical) {
      const found = findBranch(canonical.process, 'condition');
      const fallback = findBranch(canonical.process, 'condition~2');
      const target = found.targetKey;
      found.targetKey = fallback.targetKey;
      fallback.targetKey = target;
    });
  });

  test('detects AND changed to OR', () => {
    expectMutation('integration-data-retrieve-default', 'INTEGRATION_CONDITION_LOGIC_MISMATCH', function (canonical) {
      mutateBoth(canonical, function (side) {
        findBranch(side, 'condition').logic = 'OR';
      });
    });
  });

  test('detects a deleted default branch', () => {
    expectMutation('integration-get-self-route-notify', 'INTEGRATION_DEFAULT_BRANCH_MISSING', function (canonical) {
      mutateBoth(canonical, function (side) {
        side.branches = side.branches.filter(function (branch) { return !branch.isDefault; });
      });
    });
  });

  test('detects a literal assignment changed to a variable', () => {
    expectMutation('integration-data-create', 'INTEGRATION_VALUE_TYPE_MISMATCH', function (canonical) {
      mutateBoth(canonical, function (side) {
        const assignment = findNode(side, 'dataCreate')
          .config.dataCreate.assignments.find(function (item) {
            return item.field === 'targetSyncStatus';
          });
        assignment.valueType = 'processVar';
        delete assignment.value;
        assignment.sourceField = 'sourceStatus';
      });
    });
  });

  test('detects a variable reference changed to the wrong upstream node', () => {
    expectMutation('integration-get-self-route-notify', 'INTEGRATION_REFERENCE_SOURCE_MISMATCH', function (canonical) {
      mutateBoth(canonical, function (side) {
        findBranch(side, 'condition').rules[0].sourceNode = 'trigger';
      });
    });
  });

  test('detects a changed dataUpdate match field', () => {
    expectMutation('integration-data-update', 'INTEGRATION_DATA_UPDATE_CONDITION_MISMATCH', function (canonical) {
      mutateBoth(canonical, function (side) {
        findNode(side, 'dataUpdate').config.dataUpdate.query[0].field = 'targetPaymentStatus';
      });
    });
  });

  test('detects a deleted connector action', () => {
    expectMutation('integration-connector', 'INTEGRATION_CONNECTOR_ACTION_MISMATCH', function (canonical) {
      mutateBoth(canonical, function (side) {
        delete findNode(side, 'httpConnector').config.connector.action;
      });
    });
  });

  test('detects a changed initiate-approval target form', () => {
    expectMutation('integration-initiate-approval', 'INTEGRATION_APPROVAL_TARGET_MISMATCH', function (canonical) {
      mutateBoth(canonical, function (side) {
        findNode(side, 'initiateApproval').config.initiateApproval.targetForm = 'wrongApprovalForm';
      });
    });
  });

  test('detects process/view node type inconsistency', () => {
    expectMutation('integration-submit-notify', 'INTEGRATION_PROCESS_VIEW_MISMATCH', function (canonical) {
      const viewNode = findNode(canonical.view, 'sendMessage');
      viewNode.type = 'dataCreate';
      viewNode.componentName = 'AddDataNode';
    });
  });

  test('detects a dangling nextId', () => {
    expectMutation('integration-data-create', 'INTEGRATION_EDGE_DANGLING', function (canonical) {
      findNode(canonical.process, 'dataCreate').nextKeys = ['missing-node'];
    });
  });

  test('detects an inserted extra business node', () => {
    expectMutation('integration-submit-notify', 'INTEGRATION_EXTRA_NODE', function (canonical) {
      mutateBoth(canonical, function (side) {
        side.nodes.splice(side.nodes.length - 1, 0, {
          key: 'undeclaredNotify',
          type: 'sendMessage',
          componentName: 'SendMessageNode',
          name: '未声明通知',
          nextKeys: ['finish'],
          config: {
            sendMessage: { recipients: [], title: '额外节点', content: '额外节点' },
          },
        });
      });
    });
  });

  test('detects multiple default branches', () => {
    const item = loadCase('integration-get-self-route-notify');
    mutateBoth(item.canonical, function (side) {
      findBranch(side, 'condition').isDefault = true;
    });
    const result = verifyIntegrationContract(item.contract, item.canonical);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INTEGRATION_DEFAULT_BRANCH_MULTIPLE' }),
    ]));
    expect(result.errors.some(function (error) {
      return error.code === 'INTEGRATION_DEFAULT_BRANCH_MISSING';
    })).toBe(false);
  });

  test('detects a weakened comparison boundary', () => {
    expectMutation('integration-get-self-route-notify', 'INTEGRATION_CONDITION_BOUNDARY_MISMATCH', function (canonical) {
      mutateBoth(canonical, function (side) {
        findBranch(side, 'condition').rules[1].operator = 'GreaterThan';
      });
    });
  });

  test('detects changed node order', () => {
    expectMutation('integration-data-create', 'INTEGRATION_NODE_ORDER_MISMATCH', function (canonical) {
      mutateBoth(canonical, function (side) {
        const middle = side.nodes.splice(1, 1)[0];
        side.nodes.push(middle);
      });
    });
  });

  test('detects a view-only extra node', () => {
    expectMutation('integration-submit-notify', 'INTEGRATION_PROCESS_VIEW_MISMATCH', function (canonical) {
      canonical.view.nodes.push({
        key: 'view-orphan:deadbeefcafe',
        type: 'sendMessage',
        componentName: 'SendMessageNode',
        name: '孤儿通知',
        nextKeys: [],
        config: { sendMessage: { recipients: [], title: '', content: '' } },
      });
    });
  });

  test('detects a dangling variable source directly', () => {
    expectMutation('integration-get-self-route-notify', 'INTEGRATION_REFERENCE_DANGLING', function (canonical) {
      findBranch(canonical.process, 'condition').rules[0].sourceNode = 'missing-upstream-node';
    });
  });

  test('detects view-only node reordering', () => {
    expectMutation('integration-data-create', 'INTEGRATION_PROCESS_VIEW_MISMATCH', function (canonical) {
      const moved = canonical.view.nodes.splice(1, 1)[0];
      canonical.view.nodes.push(moved);
    });
  });

  test('detects a wrong explicit view edge', () => {
    expectMutation('integration-submit-notify', 'INTEGRATION_PROCESS_VIEW_MISMATCH', function (canonical) {
      findNode(canonical.view, 'sendMessage').nextKeys = ['trigger'];
    });
  });

  test('detects a wrong explicit view branch target', () => {
    expectMutation('integration-get-self-route-notify', 'INTEGRATION_PROCESS_VIEW_MISMATCH', function (canonical) {
      findBranch(canonical.view, 'condition').targetKey = 'finish';
    });
  });

  test('detects a disconnected non-default view branch target', () => {
    expectMutation('integration-get-self-route-notify', 'INTEGRATION_PROCESS_VIEW_MISMATCH', function (canonical) {
      findBranch(canonical.view, 'condition').targetKey = null;
    });
  });

  test('rejects an unexpected explicit source node on a trigger-field assignment', () => {
    expectMutation('integration-data-create', 'INTEGRATION_REFERENCE_SOURCE_MISMATCH', function (canonical) {
      mutateBoth(canonical, function (side) {
        findNode(side, 'dataCreate').config.dataCreate.assignments[0].sourceNode = 'finish';
      });
    });
  });

  test('rejects a duplicate non-default branch key', () => {
    const item = loadCase('integration-get-self-route-notify');
    item.canonical.process.branches.push(clone(findBranch(item.canonical.process, 'condition')));
    const result = verifyIntegrationContract(item.contract, item.canonical);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INTEGRATION_CANONICAL_STRUCTURE_INVALID' }),
    ]));
  });

  test('does not fold an unknown raw condition logic into AND or OR', () => {
    const item = loadCase('integration-get-self-route-notify');
    const mutated = clone(item.golden);
    mutated.content.json = mutated.content.json.replace('"condition":"OR"', '"condition":"XOR"');
    mutated.content.viewJson = mutated.content.viewJson.replace('"condition":"OR"', '"condition":"XOR"');
    const canonical = normalizeIntegrationReadback(mutated, {
      resourceAliases: item.binding.resourceAliases,
    });
    expect(findBranch(canonical.process, 'condition').logic).toBe('XOR');
    const result = verifyIntegrationContract(item.contract, canonical);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INTEGRATION_CONDITION_LOGIC_MISMATCH' }),
    ]));
  });

  test('does not infer a deleted literal valueType', () => {
    const item = loadCase('integration-data-create');
    const mutated = clone(item.golden);
    mutated.content.json = mutated.content.json.replace(
      '"valueType":"literal","value":"已同步"',
      '"value":"已同步"'
    );
    mutated.content.viewJson = mutated.content.viewJson.replace(
      '"valueType":"literal","value":"已同步"',
      '"value":"已同步"'
    );
    const canonical = normalizeIntegrationReadback(mutated, {
      resourceAliases: item.binding.resourceAliases,
    });
    const result = verifyIntegrationContract(item.contract, canonical);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INTEGRATION_VALUE_TYPE_MISMATCH' }),
    ]));
  });

  test('does not accept a semantic role as a raw resource id', () => {
    const item = loadCase('integration-initiate-approval');
    const mutated = clone(item.golden);
    mutated.content.json = mutated.content.json.replace(
      /FORM-CONTRACT-PAYMENT-PROCESS/g,
      'paymentApproval'
    );
    mutated.content.viewJson = mutated.content.viewJson.replace(
      /FORM-CONTRACT-PAYMENT-PROCESS/g,
      'paymentApproval'
    );
    const canonical = normalizeIntegrationReadback(mutated, {
      resourceAliases: item.binding.resourceAliases,
    });
    expect(findNode(canonical.process, 'initiateApproval').config.initiateApproval.targetForm)
      .toMatch(/^unmapped:form:/);
    expect(verifyIntegrationContract(item.contract, canonical).valid).toBe(false);
  });

  test('rejects colliding raw resource bindings', () => {
    const item = loadCase('integration-data-create');
    const aliases = clone(item.binding.resourceAliases);
    aliases.forms.duplicateTarget = aliases.forms.salesStats;
    expect(function () {
      normalizeIntegrationReadback(item.golden, { resourceAliases: aliases });
    }).toThrow(/resource alias collision/i);
  });
});
