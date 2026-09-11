'use strict';

const fs = require('fs');
const path = require('path');

const processContract = require('../scripts/eval/process-contract');
const {
  normalizeViewReadback,
  verifyViewContract,
} = processContract;
const {
  generateAllScenarios,
} = require('../scripts/eval/process-contract/scenario-generator');

const FIXTURE_PATH = path.join(
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

function readFixtureResponse() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')).response;
}

function mutateViewResponse(mutator) {
  const response = clone(readFixtureResponse());
  const viewJson = JSON.parse(response.content);
  mutator(viewJson);
  response.content = JSON.stringify(viewJson);
  return response;
}

function serialContract() {
  return generateAllScenarios().find(function (scenario) {
    return scenario.id === 'serial-approval';
  }).hiddenContract;
}

function scenarioViewResult(scenarioId) {
  const scenario = generateAllScenarios().find(function (item) {
    return item.id === scenarioId;
  });
  const viewJson = clone(scenario.fixture.viewJson);
  viewJson.bindingForm = viewJson.bindingForm || 'FORM-CONTRACT-REDACTED';
  viewJson.formulaRules = viewJson.formulaRules || [];
  viewJson.globalSetting = viewJson.globalSetting || {};
  return verifyViewContract(
    scenario.hiddenContract,
    normalizeViewReadback({ success: true, content: JSON.stringify(viewJson) })
  );
}

function expectViewError(rawResponse, code) {
  const canonicalView = normalizeViewReadback(rawResponse);
  const result = verifyViewContract(serialContract(), canonicalView);
  const detected = result.errors.find(function (item) { return item.code === code; });
  expect(result.valid).toBe(false);
  expect(detected).toBeDefined();
  expect(Object.keys(detected)).toEqual(['code', 'path', 'expected', 'actual']);
  return result;
}

describe('platform process view contract', () => {
  test('freezes separate combined and platform-view public interfaces', () => {
    expect(Object.keys(processContract).sort()).toEqual([
      'normalizeReadback',
      'normalizeViewReadback',
      'verifyContract',
      'verifyViewContract',
    ]);
  });

  test('normalizes the sanitized platform payload and reports honest view-only coverage', () => {
    const canonicalView = normalizeViewReadback(readFixtureResponse());
    const result = verifyViewContract(serialContract(), canonicalView);

    expect(canonicalView).toEqual(expect.objectContaining({
      bindingForm: 'FORM-READBACK-REDACTED',
      formulaRules: [],
      globalSetting: expect.any(Object),
      schema: expect.objectContaining({ componentName: 'CanvasEngine' }),
    }));
    expect(canonicalView.processJson).toBeUndefined();
    expect(result.verificationLevel).toBe('PLATFORM_VIEW_VERIFIED');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.verifiedAssertions).toEqual(expect.arrayContaining([
      'view.node-set',
      'view.node-component-name',
      'view.designer-tree-order',
      'view.approval-component-mode',
    ]));
    expect(result.observedCapabilities).toEqual(expect.arrayContaining([
      'viewJson.schema',
      'view.approval.mode',
    ]));
    expect(result.unverifiedAssertions.length).toBeGreaterThan(0);
    expect(result.runtimeRequired).toEqual(expect.arrayContaining([
      'process.edge-targets',
      'process.view-bindings',
      'runtime.approver-resolution',
      'runtime.cases',
    ]));
    expect(result.artifactHash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('normalizes view ids and designer noise deterministically', () => {
    const original = normalizeViewReadback(readFixtureResponse());
    expect(normalizeViewReadback(JSON.stringify(readFixtureResponse()))).toEqual(original);
    const noisy = mutateViewResponse(function (viewJson) {
      viewJson.schema.id = 'another-canvas-id';
      viewJson.schema.version = 'another-designer-version';
      viewJson.schema.children.forEach(function (node, index) {
        node.id = 'random-view-node-' + index;
        node.x = 9000 + index;
        node.y = -9000 - index;
        node.version = 'random-version-' + index;
      });
    });
    expect(normalizeViewReadback(noisy)).toEqual(original);
  });

  test('kills a deleted approval node without claiming approval mode was verified', () => {
    const result = expectViewError(mutateViewResponse(function (viewJson) {
      viewJson.schema.children.splice(2, 1);
    }), 'PROCESS_VIEW_NODE_MISSING');
    expect(result.verifiedAssertions).not.toContain('view.approval-component-mode');
  });

  test('kills a swapped designer order', () => {
    expectViewError(mutateViewResponse(function (viewJson) {
      const manager = viewJson.schema.children[1];
      viewJson.schema.children[1] = viewJson.schema.children[2];
      viewJson.schema.children[2] = manager;
    }), 'PROCESS_VIEW_NODE_ORDER_MISMATCH');
  });

  test('kills a changed visible approval mode', () => {
    expectViewError(mutateViewResponse(function (viewJson) {
      viewJson.schema.children[1].props.approverRules.multiApproverType = 'or';
    }), 'PROCESS_APPROVAL_MODE_MISMATCH');
  });

  test('declares branch, condition, default, target, and runtime cases unverified', () => {
    const result = scenarioViewResult('amount-condition-boundary');
    expect(result.valid).toBe(true);
    expect(result.runtimeRequired).toEqual(expect.arrayContaining([
      'view.branches',
      'view.condition-rules',
      'view.default-branch',
      'view.branch-targets',
      'process.branches',
      'process.condition-rules',
      'process.default-branch',
      'process.branch-targets',
      'runtime.condition-evaluation',
      'runtime.cases',
    ]));
    expect(result.verifiedAssertions).not.toContain('view.branches');
    expect(result.verifiedAssertions).not.toContain('view.condition-rules');
  });

  test('declares all field-permission dimensions unverified', () => {
    const result = scenarioViewResult('field-permissions');
    expect(result.valid).toBe(true);
    expect(result.runtimeRequired).toEqual(expect.arrayContaining([
      'view.field-permissions',
      'process.field-permissions',
      'process.flow-config',
      'runtime.field-permissions',
      'runtime.cases',
    ]));
  });

  test('declares view, process, and runtime return rules unverified', () => {
    const result = scenarioViewResult('return-target');
    expect(result.valid).toBe(true);
    expect(result.runtimeRequired).toEqual(expect.arrayContaining([
      'view.return-rules',
      'process.return-rules',
      'runtime.return-routing',
      'runtime.cases',
    ]));
  });

  test('rejects a forged combined wrapper at the view-only entry point', () => {
    const scenario = generateAllScenarios().find(function (item) {
      return item.id === 'serial-approval';
    });
    expect(function () {
      normalizeViewReadback({
        success: true,
        content: {
          json: JSON.stringify(scenario.fixture.processJson),
          viewJson: JSON.stringify(scenario.fixture.viewJson),
        },
      });
    }).toThrow(expect.objectContaining({
      code: 'PROCESS_VIEW_READBACK_COMBINED_PAYLOAD_REJECTED',
    }));
  });
});
