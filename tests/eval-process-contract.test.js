'use strict';

const fs = require('fs');
const path = require('path');

const {
  canonicalStringify,
  normalizeArtifact,
  normalizeOperator,
  sha256Canonical,
} = require('../scripts/eval/process-contract/normalize');
const {
  normalizeReadback,
  verifyContract,
} = require('../scripts/eval/process-contract');
const {
  generateAllScenarios,
} = require('../scripts/eval/process-contract/scenario-generator');
const {
  validateArtifact,
} = require('../scripts/eval/process-contract/validate');

const MANIFEST_PATH = path.join(
  __dirname,
  '..',
  'scripts',
  'eval',
  'process-contract',
  'capability-manifest.json'
);
const PROTOCOL_EXTRACT_PATH = path.join(
  __dirname,
  '..',
  'scripts',
  'eval',
  'process-contract',
  'fixtures',
  'pinned-bundle-protocol-extract.json'
);
const VIEW_ONLY_READBACK_PATH = path.join(
  __dirname,
  '..',
  'scripts',
  'eval',
  'process-contract',
  'fixtures',
  'get-process-by-id-view-only.readback.json'
);

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

function rewriteIdsAndNoise(artifact) {
  const changed = clone(artifact);
  const processNodes = [];
  const viewNodes = [];
  collectProcessNodes(changed.processJson.nodes, processNodes);
  collectViewNodes(changed.viewJson.schema.children, viewNodes);
  const idMap = new Map();

  processNodes.forEach(function (node, index) {
    idMap.set(node.nodeId, 'runtime-random-id-' + (index + 100));
  });

  processNodes.forEach(function (node, index) {
    node.nodeId = idMap.get(node.nodeId);
    node.prevId = idMap.get(node.prevId) || node.prevId;
    node.nextId = (node.nextId || []).map(function (id) { return idMap.get(id) || id; });
    node.version = 'changed-version-' + index;
    const rules = node.props && node.props.routeRule && node.props.routeRule.rules;
    (rules || []).forEach(function (rule) {
      rule.targetNodeId = idMap.get(rule.targetNodeId) || rule.targetNodeId;
    });
  });

  viewNodes.forEach(function (node, index) {
    node.id = idMap.get(node.id) || ('view-random-id-' + index);
    node.x = 9999 + index;
    node.y = -9999 - index;
    node.version = 'changed-designer-version-' + index;
    const rules = node.props && node.props.routeRule && node.props.routeRule.rules;
    (rules || []).forEach(function (rule) {
      rule.targetNodeId = idMap.get(rule.targetNodeId) || rule.targetNodeId;
    });
  });
  changed.processJson.revision = 'another-revision';
  changed.viewJson.designerVersion = 'another-designer-version';
  changed.viewJson.schema.id = 'another-canvas-id';
  return changed;
}

describe('process static capability manifest', () => {
  test('pins the offline protocol source and separates evidence states', () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.source).toEqual(expect.objectContaining({
      package: 'yida-simple-flow',
      version: '0.2.307',
      url: 'https://g.alicdn.com/yida-platform/yida-simple-flow/0.2.307/index.js',
      bundleSizeBytes: 12566951,
      sha256: 'a4d0d5e6a7c54c2b0d348f716d87fb4c126a54cabfdc5881ad98d68d9a183af4',
      bundleCommitted: false,
      ciNetworkRequired: false,
    }));
    expect(Object.keys(manifest.capabilities).sort()).toEqual(['Confirmed', 'Inferred', 'Unknown']);
    expect(manifest.verificationProfiles).toEqual(expect.objectContaining({
      CONTRACT_VERIFIED: expect.objectContaining({
        publicApi: ['normalizeReadback', 'verifyContract'],
      }),
      PLATFORM_VIEW_VERIFIED: expect.objectContaining({
        publicApi: ['normalizeViewReadback', 'verifyViewContract'],
      }),
      RUNTIME: expect.any(Object),
    }));
    Object.values(manifest.capabilities).forEach(function (items) {
      expect(items.length).toBeGreaterThan(0);
      items.forEach(function (item) {
        expect(item.id).toEqual(expect.any(String));
        expect(item.evidenceLocator).toEqual(expect.any(String));
      });
    });
    manifest.capabilities.Confirmed.forEach(function (item) {
      expect(item.evidenceLocator).not.toContain('compiler:');
    });
  });

  test('fixed protocol extract independently records pinned MultiApproval, flowConfig, and operators', () => {
    const captured = JSON.parse(fs.readFileSync(PROTOCOL_EXTRACT_PATH, 'utf8'));
    expect(captured.source).toEqual(expect.objectContaining({
      version: '0.2.307',
      bundleSizeBytes: 12566951,
      sha256: 'a4d0d5e6a7c54c2b0d348f716d87fb4c126a54cabfdc5881ad98d68d9a183af4',
    }));
    expect(captured.protocolSamples.multiApproval).toEqual(expect.objectContaining({
      processType: 'approval',
      componentName: 'MultiApprovalNode',
      modes: ['all', 'or', 'oneByOne'],
    }));
    expect(captured.protocolSamples.multiApproval.processProps).toEqual(expect.objectContaining({
      mode: 'multi',
      multiApprove: 'all',
    }));
    expect(captured.protocolSamples.fieldPermission.flowConfig.captured_permission_node)
      .toEqual(captured.protocolSamples.fieldPermission.nodeBehaviorList);
    expect(captured.protocolSamples.conditionRules.raw.map(function (rule) {
      return normalizeOperator(rule.opCode || rule.op);
    })).toEqual(['GreaterThanOrEqual', 'LessThan']);
    expect(captured.protocolSamples.designerReadback).toEqual(expect.objectContaining({
      legacyEndpoint: '/query/simpleProcess/getProcess.json',
      versionedEndpoint: '/query/simpleProcess/getProcessById.json',
      capturedContentKind: 'viewJson',
      independentProcessJsonIncluded: false,
    }));
  });
});

describe('deterministic process contract scenarios', () => {
  test('generates six isolated builder prompts, hidden contracts, and runtime cases', () => {
    const scenarios = generateAllScenarios();
    expect(scenarios).toHaveLength(6);
    scenarios.forEach(function (scenario) {
      expect(scenario.builderPrompt).toContain('processJson');
      expect(scenario.builderPrompt).toContain('viewJson');
      expect(scenario.builderPrompt).not.toContain('hiddenContract');
      expect(scenario.builderPrompt).not.toContain('canonicalArtifactHash');
      expect(scenario.builderPrompt).not.toContain(scenario.contractHash);
      expect(scenario.runtimeCases.length).toBeGreaterThan(0);
      expect(scenario.contractHashAlgorithm).toBe('sha256');
      expect(scenario.contractHash).toMatch(/^[a-f0-9]{64}$/);
      expect(Object.isFrozen(scenario.hiddenContract)).toBe(true);
      expect(scenario.hiddenContract.canonicalArtifactHash).toBeUndefined();
      expect(scenario.compilerConformance).toBe('pending');
    });
  });

  test('repeated generation has byte-stable canonical contracts and hashes', () => {
    const first = generateAllScenarios();
    const second = generateAllScenarios();
    expect(first.map(function (item) { return item.contractCanonicalJson; }))
      .toEqual(second.map(function (item) { return item.contractCanonicalJson; }));
    expect(first.map(function (item) { return item.contractHash; }))
      .toEqual(second.map(function (item) { return item.contractHash; }));
    first.forEach(function (scenario) {
      expect(scenario.contractHash).toBe(sha256Canonical(scenario.hiddenContract));
      expect(scenario.contractCanonicalJson).toBe(canonicalStringify(scenario.hiddenContract));
    });
  });

  test('all correct fixtures pass validator self-tests', () => {
    const scenarios = generateAllScenarios();
    scenarios.forEach(function (scenario) {
      const result = validateArtifact(scenario.fixture, scenario.hiddenContract);
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
    });
    const componentNames = new Set(scenarios.flatMap(function (scenario) {
      return scenario.hiddenContract.viewBindings.map(function (binding) { return binding.componentName; });
    }));
    [
      'ApplyNode',
      'EndNode',
      'ApprovalNode',
      'OperatorNode',
      'CarbonNode',
      'ConditionContainer',
      'ConditionNode',
      'ParallelNode',
    ].forEach(function (componentName) {
      expect(componentNames.has(componentName)).toBe(true);
    });
  });

  test('amount boundary runtime cases cover AND/OR and comparison edges', () => {
    const scenario = generateAllScenarios().find(function (item) {
      return item.id === 'amount-condition-boundary';
    });
    const result = validateArtifact(scenario.fixture, scenario.hiddenContract);
    expect(result.runtimeCases).toHaveLength(7);
    expect(result.runtimeCases.every(function (item) { return item.status === 'pass'; })).toBe(true);
    expect(scenario.hiddenContract.branches[0].items.map(function (item) { return item.logic; }))
      .toEqual(['OR', 'AND', 'AND', 'AND', null]);
    const operators = scenario.hiddenContract.branches[0].items.flatMap(function (item) {
      return item.rules.map(function (rule) { return rule.operator; });
    });
    expect(new Set(operators)).toEqual(new Set([
      'Equal',
      'GreaterThan',
      'GreaterThanOrEqual',
      'LessThan',
    ]));
  });

  test('multi-approval golden uses MultiApprovalNode for all protocol modes', () => {
    const multi = generateAllScenarios().find(function (item) {
      return item.id === 'multi-approval-modes';
    });
    const modes = multi.hiddenContract.approvalModes;
    expect(modes.map(function (item) { return item.componentName; }))
      .toEqual(['MultiApprovalNode', 'MultiApprovalNode', 'MultiApprovalNode']);
    expect(modes.map(function (item) { return item.processMode; }))
      .toEqual(['all', 'or', 'oneByOne']);
    expect(modes.map(function (item) { return item.viewMode; }))
      .toEqual(['all', 'or', 'oneByOne']);

    const ordinary = generateAllScenarios().find(function (item) {
      return item.id === 'serial-approval';
    });
    expect(ordinary.hiddenContract.approvalModes.every(function (item) {
      return item.componentName === 'ApprovalNode' && item.processKind === 'single';
    })).toBe(true);
  });

  test('field permission contract covers node formConfig and top-level flowConfig', () => {
    const scenario = generateAllScenarios().find(function (item) {
      return item.id === 'field-permissions';
    });
    const permission = scenario.hiddenContract.fieldPermissions[0];
    const captured = JSON.parse(fs.readFileSync(PROTOCOL_EXTRACT_PATH, 'utf8'));
    expect(permission.process).toEqual(permission.view);
    expect(permission.flowConfig).toEqual(permission.process);
    expect(permission.flowConfig)
      .toEqual(captured.protocolSamples.fieldPermission.nodeBehaviorList);
  });
});

describe('process artifact normalizer', () => {
  test('removes random ids, coordinates, and versions while preserving semantics', () => {
    const scenario = generateAllScenarios().find(function (item) {
      return item.id === 'return-target';
    });
    const rewritten = rewriteIdsAndNoise(scenario.fixture);
    const originalNormalized = normalizeArtifact(scenario.fixture);
    const rewrittenNormalized = normalizeArtifact(rewritten);
    expect(rewrittenNormalized).toEqual(originalNormalized);
    expect(canonicalStringify(rewrittenNormalized)).not.toMatch(/runtime-random-id|changed-version|9999/);
    expect(canonicalStringify(rewrittenNormalized)).toContain('routeRule');
    expect(canonicalStringify(rewrittenNormalized)).toContain('targetNodeId');
  });

  test('normalizes opCode, op, and operator into one semantic operator', () => {
    const scenario = generateAllScenarios().find(function (item) {
      return item.id === 'amount-condition-boundary';
    });
    const canonical = normalizeArtifact(scenario.fixture);
    const route = canonical.processJson.nodes.find(function (node) { return node.type === 'route'; });
    const rules = route.childNodes.flatMap(function (branch) {
      return branch.props.conditions ? branch.props.conditions.rules : [];
    });
    expect(rules.every(function (rule) {
      return rule.operator && rule.opCode === undefined && rule.op === undefined;
    })).toBe(true);
    expect(rules.map(function (rule) { return rule.operator; })).toEqual([
      'Equal',
      'GreaterThan',
      'GreaterThanOrEqual',
      'GreaterThan',
      'LessThan',
      'Equal',
    ]);

    const operatorAlias = clone(scenario.fixture);
    const aliasRoute = operatorAlias.processJson.nodes.find(function (node) { return node.type === 'route'; });
    aliasRoute.childNodes[1].props.conditions.rules[0] = {
      fieldId: 'amount',
      operator: 'GreaterThanOrEqual',
      value: 10000,
    };
    expect(normalizeArtifact(operatorAlias)).toEqual(canonical);
  });
});

describe('process contract public readback API', () => {
  function wrapCombinedArtifact(artifact, stringifyOuter) {
    const wrapper = {
      success: true,
      content: {
        json: JSON.stringify(artifact.processJson),
        viewJson: JSON.stringify(artifact.viewJson),
      },
    };
    return stringifyOuter ? JSON.stringify(wrapper) : wrapper;
  }

  test('rejects the confirmed getProcessById view-only shape with a stable missing-process code', () => {
    const captured = JSON.parse(fs.readFileSync(VIEW_ONLY_READBACK_PATH, 'utf8'));
    let caught;
    try {
      normalizeReadback(captured.response);
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({
      name: 'TypeError',
      code: 'PROCESS_READBACK_PROCESS_JSON_MISSING',
    });
  });

  test('normalizeReadback accepts explicit combined adapter payloads and JSON strings', () => {
    const scenario = generateAllScenarios().find(function (item) {
      return item.id === 'serial-approval';
    });
    expect(normalizeReadback(wrapCombinedArtifact(scenario.fixture, false)))
      .toEqual(normalizeArtifact(scenario.fixture));
    expect(normalizeReadback(wrapCombinedArtifact(scenario.fixture, true)))
      .toEqual(normalizeArtifact(scenario.fixture));
    expect(normalizeReadback(scenario.fixture)).toEqual(normalizeArtifact(scenario.fixture));
  });

  test('instance identifiers and unrelated server fields change diagnostics but do not fail semantics', () => {
    const scenario = generateAllScenarios().find(function (item) {
      return item.id === 'serial-approval';
    });
    const baseCanonical = normalizeReadback(wrapCombinedArtifact(scenario.fixture));
    const noisy = clone(scenario.fixture);
    noisy.processJson.props.processCode = 'TPROC-SERVER-OTHER';
    noisy.processJson.props.bindingForm = 'FORM-SERVER-OTHER';
    noisy.viewJson.bindingForm = 'FORM-SERVER-OTHER';
    noisy.processJson.serverGenerated = { processId: 99881, deployedAt: '2026-08-24T10:00:00Z' };
    noisy.processJson.nodes[1].props.serverActorCache = { resolved: true };
    const noisyCanonical = normalizeReadback({
      data: {
        content: JSON.stringify({
          processJson: noisy.processJson,
          viewJson: noisy.viewJson,
        }),
      },
    });

    const baseResult = verifyContract(scenario.hiddenContract, baseCanonical);
    const noisyResult = verifyContract(scenario.hiddenContract, noisyCanonical);
    expect(baseResult.valid).toBe(true);
    expect(baseResult.verificationLevel).toBe('CONTRACT_VERIFIED');
    expect(noisyResult.valid).toBe(true);
    expect(noisyResult.errors).toEqual([]);
    expect(noisyResult.artifactHash).not.toBe(baseResult.artifactHash);
    expect(noisyResult.contractHash).toBe(baseResult.contractHash);
  });

  test('semantic node edge mutations still fail through verifyContract', () => {
    const scenario = generateAllScenarios().find(function (item) {
      return item.id === 'serial-approval';
    });
    const mutated = clone(scenario.fixture);
    mutated.processJson.nodes[1].nextId = ['server-missing-node'];
    const canonical = normalizeReadback(wrapCombinedArtifact(mutated));
    const result = verifyContract(scenario.hiddenContract, canonical);
    expect(result.valid).toBe(false);
    expect(result.errors.some(function (item) {
      return item.code === 'PROCESS_NODE_REFERENCE_BROKEN';
    })).toBe(true);
  });
});
