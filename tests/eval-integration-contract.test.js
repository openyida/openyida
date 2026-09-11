'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  normalizeIntegrationReadback,
  validateRealE2EEvidence,
  verifyIntegrationContract,
} = require('../scripts/eval/integration-contract');
const {
  buildIntegrationBuilderPrompt,
  loadIntegrationScenarios,
} = require('../scripts/eval/integration-contract/scenario-loader');

const CONTRACT_ROOT = path.join(__dirname, '..', 'scripts', 'eval', 'integration-contract');
const CONTRACT_DIR = path.join(CONTRACT_ROOT, 'contracts');
const GOLDEN_DIR = path.join(CONTRACT_ROOT, 'fixtures', 'golden');
const BINDING_DIR = path.join(CONTRACT_ROOT, 'fixtures', 'bindings');
const MANIFEST_PATH = path.join(CONTRACT_ROOT, 'capability-manifest.json');
const EXTRACT_PATH = path.join(CONTRACT_ROOT, 'fixtures', 'pinned-bundle-protocol-extract.json');
const AUDIT_PATH = path.join(CONTRACT_ROOT, 'audit-report.json');
const LOCK_PATH = path.join(CONTRACT_DIR, 'contract-lock.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function canonicalValue(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const output = {};
  Object.keys(value).sort().forEach(function (key) {
    output[key] = canonicalValue(value[key]);
  });
  return output;
}

function canonicalStringify(value) {
  return JSON.stringify(canonicalValue(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function scenarioIds() {
  return fs.readdirSync(CONTRACT_DIR)
    .filter(function (name) { return name.endsWith('.contract.json'); })
    .map(function (name) { return name.replace('.contract.json', ''); })
    .sort();
}

function loadCase(id) {
  const contract = readJson(path.join(CONTRACT_DIR, id + '.contract.json'));
  const golden = readJson(path.join(GOLDEN_DIR, id + '.readback.json'));
  const binding = readJson(path.join(BINDING_DIR, id + '.resource-aliases.json'));
  const canonical = normalizeIntegrationReadback(golden, {
    resourceAliases: binding.resourceAliases,
  });
  return { contract, golden, binding, canonical };
}

function replaceAll(value, replacements) {
  let serialized = JSON.stringify(value);
  replacements.forEach(function (replacement) {
    serialized = serialized.split(replacement[0]).join(replacement[1]);
  });
  return JSON.parse(serialized);
}

describe('integration static protocol baseline', () => {
  test('pins the offline bundle and records independently located evidence', () => {
    const manifest = readJson(MANIFEST_PATH);
    const extract = readJson(EXTRACT_PATH);
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.source).toEqual(expect.objectContaining({
      package: 'yida-logic-flow',
      version: '0.2.245',
      url: 'https://g.alicdn.com/yida-platform/yida-logic-flow/0.2.245/index.js',
      bundleSizeBytes: 12655678,
      sha256: '2963c6a8dcce3a8f56efcd2a2d847d33167f23d71fbf515be24d60a008901c89',
      bundleCommitted: false,
      ciNetworkRequired: false,
    }));
    expect(extract.source).toEqual(expect.objectContaining({
      package: manifest.source.package,
      version: manifest.source.version,
      url: manifest.source.url,
      bundleSizeBytes: manifest.source.bundleSizeBytes,
      sha256: manifest.source.sha256,
      bundleCommitted: false,
      ciNetworkRequired: false,
    }));
    expect(extract.locators).toHaveLength(21);
    extract.locators.forEach(function (locator) {
      expect(locator.byteOffset).toEqual(expect.any(Number));
      expect(locator.windowSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(locator.facts.length).toBeGreaterThan(0);
    });
  });

  test('capability matrix separates confirmed, inferred, and probe-required facts', () => {
    const manifest = readJson(MANIFEST_PATH);
    const requiredFields = [
      'id',
      'values',
      'evidenceLocator',
      'frontendComponentOrApi',
      'skillDeclarationLocation',
      'cliImplementationLocation',
      'unitTestCoverage',
      'realE2ECoverage',
      'currentVerdict',
    ];
    expect(Object.keys(manifest.capabilities).sort()).toEqual(['Confirmed', 'Inferred', 'Unknown']);
    expect(manifest.capabilities.Confirmed).toHaveLength(14);
    expect(manifest.capabilities.Inferred).toHaveLength(5);
    expect(manifest.capabilities.Unknown).toHaveLength(9);
    Object.values(manifest.capabilities).flat().forEach(function (capability) {
      requiredFields.forEach(function (field) {
        expect(Object.prototype.hasOwnProperty.call(capability, field)).toBe(true);
      });
      expect(capability.id).toBe(capability.capability);
      expect(capability.evidenceLocator).toEqual(expect.any(String));
      expect(capability.currentVerdict).toBe(capability.status);
    });
    expect(new Set(manifest.capabilities.Confirmed.map(function (item) { return item.status; })))
      .toEqual(new Set(['CONFIRMED']));
    expect(new Set(manifest.capabilities.Inferred.map(function (item) { return item.status; })))
      .toEqual(new Set(['INFERRED']));
    expect(new Set(manifest.capabilities.Unknown.map(function (item) { return item.status; })))
      .toEqual(new Set(['PLATFORM_PROBE_REQUIRED']));
  });

  test('audit report keeps issue classes and conformance layers explicit', () => {
    const audit = readJson(AUDIT_PATH);
    const counts = audit.findings.reduce(function (output, finding) {
      output[finding.category] = (output[finding.category] || 0) + 1;
      [
        'severity',
        'sourceTags',
        'currentBehavior',
        'expectedBehavior',
        'evidence',
        'recommendation',
        'regressionScenario',
        'acceptanceLayer',
      ].forEach(function (field) {
        expect(Object.prototype.hasOwnProperty.call(finding, field)).toBe(true);
      });
      return output;
    }, {});
    expect(counts).toEqual({
      BUG: 8,
      TEST_GAP: 2,
      OUT_OF_SCOPE: 1,
      UNKNOWN: 1,
      PLATFORM_PROBE_REQUIRED: 1,
    });
    expect(audit.summary).toEqual(expect.objectContaining({
      compilerConformance: 'passed-supported-scenarios',
      platformConformance: 'passed-integration-data-create-publish-and-platform-view-readback',
      runtimeConformance: 'passed-integration-data-create-copies-fields-and-source-update-ignored',
      controlPlaneDisposition: 'PARTIALLY_OBSERVED_WITH_REMAINING_PLATFORM_PROBE_REQUIRED',
    }));
    expect(audit.summary.compilerConformanceEvidence).toEqual({
      scenariosPassed: 6,
      contractOnlyScenarios: ['integration-data-update'],
      contractOnlyRuntimeCases: ['integration-connector/missing-connection-preflight'],
      zeroRemoteWriteScenarios: ['integration-initiate-approval/missing-initiator-preflight'],
    });
    expect(audit.summary.realE2EEvidence).toEqual(expect.objectContaining({
      scenario: 'integration-data-create',
      publishReadback: expect.objectContaining({
        normalizeValidateContractLock: 'passed',
        platformRuntimeJsonReadback: 'PLATFORM_PROBE_REQUIRED',
      }),
      runtime: expect.objectContaining({
        copiesFields: 'passed',
        sourceUpdateIgnored: 'passed',
        successLogObserved: true,
      }),
      cleanup: expect.objectContaining({
        deleteCalls: 0,
        ownedResidualCount: 6,
        processCleanupWaivedResidualsTouched: 0,
      }),
    }));
  });
});

describe('independent integration contract catalog', () => {
  test('loads exactly seven public P0 scenarios without exposing hidden answers', () => {
    const scenarios = loadIntegrationScenarios();
    const extract = readJson(EXTRACT_PATH);
    const manifest = readJson(MANIFEST_PATH);
    const confirmedIds = new Set(extract.locators.map(function (item) { return item.id; }));
    const inferredIds = new Set(manifest.capabilities.Inferred.map(function (item) { return item.id; }));
    expect(scenarios).toHaveLength(7);
    expect(scenarios.map(function (item) { return item.id; }).sort()).toEqual(scenarioIds());
    scenarios.forEach(function (scenario) {
      expect(scenario.title).toEqual(expect.any(String));
      expect(scenario.publicPrompt).toEqual(expect.any(String));
      expect(scenario.requiredCapabilities.length).toBeGreaterThan(0);
      expect(scenario.expectedResources).toEqual(expect.any(Object));
      expect(scenario.runtimeCases.length).toBeGreaterThan(0);
      expect(scenario.protocolEvidence.length).toBeGreaterThan(0);
      scenario.protocolEvidence.forEach(function (evidence) {
        if (evidence.status === 'CONFIRMED') {
          expect(evidence.source).toBe('pinned-bundle-locator');
          expect(confirmedIds.has(evidence.id)).toBe(true);
        } else {
          expect(evidence).toEqual(expect.objectContaining({
            status: 'INFERRED',
            source: 'capability-manifest',
          }));
          expect(inferredIds.has(evidence.id)).toBe(true);
        }
      });
      const prompt = buildIntegrationBuilderPrompt(scenario);
      expect(prompt).toContain(scenario.publicPrompt);
      expect(prompt).not.toMatch(/hiddenContract|canonicalJson|sha256/i);
    });
  });

  test('locks independently authored canonical contracts, not golden artifacts', () => {
    const lock = readJson(LOCK_PATH);
    expect(lock.algorithm).toBe('SHA-256');
    expect(lock.canonicalization).toBe('recursive-key-sort-json');
    expect(lock.canonicalJsonIncluded).toBe(true);
    expect(lock.contracts).toHaveLength(7);
    lock.contracts.forEach(function (entry) {
      const contract = readJson(path.join(CONTRACT_DIR, entry.path));
      const canonicalJson = canonicalStringify(contract);
      expect(entry.canonicalJson).toBe(canonicalJson);
      expect(entry.canonicalLengthBytes).toBe(Buffer.byteLength(canonicalJson, 'utf8'));
      expect(entry.sha256).toBe(sha256(canonicalJson));
      expect(contract).toEqual(expect.objectContaining({
        schemaVersion: 1,
        protocolVersion: 'yida-logic-flow@0.2.245',
        contractRevision: 1,
        artifactKind: 'definition',
        sourceBundle: { package: 'yida-logic-flow', version: '0.2.245' },
      }));
      expect(contract.semantic.requireProcessViewConsistency).toBe(true);
      expect(contract.evidenceProfile.confirmedProtocol.length).toBeGreaterThan(0);
      contract.evidenceProfile.confirmedProtocol.forEach(function (id) {
        expect(readJson(EXTRACT_PATH).locators.some(function (item) { return item.id === id; })).toBe(true);
      });
      contract.evidenceProfile.inferredProtocol.forEach(function (id) {
        expect(readJson(MANIFEST_PATH).capabilities.Inferred
          .some(function (item) { return item.id === id; })).toBe(true);
      });
    });
    expect(lock.artifactPolicy).toMatch(/Golden readback.*never hashed/i);
  });

  test('keeps scenario, contract, raw readback, and resource binding one-to-one', () => {
    const ids = scenarioIds();
    const goldenIds = fs.readdirSync(GOLDEN_DIR)
      .filter(function (name) { return name.endsWith('.readback.json'); })
      .map(function (name) { return name.replace('.readback.json', ''); })
      .sort();
    const bindingIds = fs.readdirSync(BINDING_DIR)
      .filter(function (name) { return name.endsWith('.resource-aliases.json'); })
      .map(function (name) { return name.replace('.resource-aliases.json', ''); })
      .sort();
    expect(goldenIds).toEqual(ids);
    expect(bindingIds).toEqual(ids);
    ids.forEach(function (id) {
      const item = loadCase(id);
      expect(item.golden.scenarioId).toBe(id);
      expect(item.binding.scenarioId).toBe(id);
      expect(item.golden.artifactKind).toBe('synthetic-protocol-fixture');
      expect(item.golden.provenance).toEqual(expect.objectContaining({
        kind: 'synthetic-protocol-fixture',
        authoredBy: 'test-author',
        platformCaptured: false,
        builderGenerated: false,
      }));
      expect(JSON.parse(item.golden.content.json)).toEqual(expect.any(Object));
      expect(JSON.parse(item.golden.content.viewJson)).toEqual(expect.any(Object));
      expect(JSON.stringify(item.golden)).not.toContain('integration-process-builder');
      expect(JSON.stringify(item.golden)).not.toMatch(/semanticKey|contractKey|platform-readback/);
    });
  });

  test('covers AND, OR, comparison boundaries, a unique default, and multi-step references', () => {
    const contracts = scenarioIds().map(function (id) { return loadCase(id).contract; });
    const branches = contracts.flatMap(function (contract) { return contract.semantic.branches; });
    const rules = branches.flatMap(function (branch) { return branch.rules; });
    expect(new Set(branches.map(function (branch) { return branch.logic; })))
      .toEqual(new Set(['AND', 'OR']));
    expect(rules.some(function (rule) { return rule.operator === 'GreaterThanOrEqual'; })).toBe(true);
    const grouped = new Map();
    contracts.forEach(function (contract) {
      contract.semantic.branches.forEach(function (branch) {
        const groupKey = contract.scenarioId + ':' + branch.routeKey;
        const items = grouped.get(groupKey) || [];
        items.push(branch);
        grouped.set(groupKey, items);
      });
    });
    grouped.forEach(function (items) {
      expect(items.filter(function (item) { return item.isDefault; })).toHaveLength(1);
    });
    expect(rules.some(function (rule) {
      return rule.sourceNode === 'dataRetrieve' && rule.sourceField === 'amount';
    })).toBe(true);
  });
});

describe('integration readback normalizer and validator self-test', () => {
  test('all seven independent golden fixtures pass their hidden contracts', () => {
    scenarioIds().forEach(function (id) {
      const item = loadCase(id);
      expect(verifyIntegrationContract(item.contract, item.canonical)).toEqual({
        valid: true,
        errors: [],
      });
      expect(item.canonical).toEqual(expect.objectContaining({
        schemaVersion: 1,
        artifactKind: 'definition',
        process: expect.objectContaining({
          trigger: expect.any(Object),
          nodes: expect.any(Array),
          branches: expect.any(Array),
        }),
        view: expect.objectContaining({
          trigger: expect.any(Object),
          nodes: expect.any(Array),
          branches: expect.any(Array),
        }),
      }));
    });
  });

  test('normalizes string, object, detail, data, and content wrappers identically', () => {
    const item = loadCase('integration-submit-notify');
    const processJson = JSON.parse(item.golden.content.json);
    const viewJson = JSON.parse(item.golden.content.viewJson);
    const options = { resourceAliases: item.binding.resourceAliases };
    const variants = [
      item.golden,
      JSON.stringify(item.golden),
      { processJson, viewJson },
      { data: { processJson: JSON.stringify(processJson), viewJson: JSON.stringify(viewJson) } },
      { result: { content: { json: processJson, viewJson } } },
      {
        data: 'not-json-detail-noise',
        result: { rows: [{ content: { json: processJson, viewJson } }] },
      },
    ];
    variants.forEach(function (variant) {
      expect(normalizeIntegrationReadback(variant, options)).toEqual(item.canonical);
    });
  });

  test('removes random ids and designer noise without erasing semantic references', () => {
    const item = loadCase('integration-get-self-route-notify');
    const rawIds = [
      'node_raw_self_trigger',
      'node_raw_self_retrieve',
      'node_raw_self_route',
      'node_raw_self_pending',
      'node_raw_self_default',
      'node_raw_self_notify',
      'node_raw_self_finish',
    ];
    const replacements = rawIds.map(function (id, index) {
      return [id, 'random-runtime-node-' + (100 + index)];
    });
    const noisy = replaceAll(item.golden, replacements);
    const processJson = JSON.parse(noisy.content.json);
    const viewJson = JSON.parse(noisy.content.viewJson);
    processJson.props.processCode = 'RANDOM-PROCESS-CODE';
    processJson.revision = 'random-revision';
    viewJson.schema.id = 'random-canvas-id';
    viewJson.schema.children.forEach(function (node, index) {
      node.x = 9000 + index;
      node.y = -9000 - index;
      node.version = 'random-version-' + index;
    });
    noisy.content.json = JSON.stringify(processJson);
    noisy.content.viewJson = JSON.stringify(viewJson);
    expect(normalizeIntegrationReadback(noisy, {
      resourceAliases: item.binding.resourceAliases,
    })).toEqual(item.canonical);
    const pending = item.canonical.process.branches.find(function (branch) {
      return branch.key === 'condition';
    });
    expect(pending.rules[1]).toEqual(expect.objectContaining({
      sourceNode: 'dataRetrieve',
      sourceField: 'amount',
      operator: 'GreaterThanOrEqual',
    }));
  });

  test('keeps unbound resource changes visible with a stable fail-closed marker', () => {
    const item = loadCase('integration-initiate-approval');
    const changed = JSON.parse(JSON.stringify(item.golden));
    changed.content.json = changed.content.json.replace(
      /FORM-CONTRACT-PAYMENT-PROCESS/g,
      'FORM-UNDECLARED-TARGET'
    );
    changed.content.viewJson = changed.content.viewJson.replace(
      /FORM-CONTRACT-PAYMENT-PROCESS/g,
      'FORM-UNDECLARED-TARGET'
    );
    const canonical = normalizeIntegrationReadback(changed, {
      resourceAliases: item.binding.resourceAliases,
    });
    const approval = canonical.process.nodes.find(function (node) {
      return node.key === 'initiateApproval';
    });
    expect(approval.config.initiateApproval.targetForm).toMatch(/^unmapped:form:[a-f0-9]{12}$/);
    expect(verifyIntegrationContract(item.contract, canonical)).toEqual(expect.objectContaining({
      valid: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: 'INTEGRATION_APPROVAL_TARGET_MISMATCH' }),
      ]),
    }));
  });

  test('preserves processEvents when a view readback omits the concrete approval action', () => {
    const raw = {
      processJson: {
        nodes: [
          {
            type: 'trigger',
            nodeId: 'approval-trigger',
            nextId: ['approval-finish'],
            name: '审批事件触发',
            props: { inputs: { formEventType: ['processEvents'] } },
          },
          {
            type: 'finish',
            nodeId: 'approval-finish',
            nextId: [],
            name: '结束',
            props: {},
          },
        ],
      },
      viewJson: {
        schema: {
          children: [
            {
              componentName: 'StartNode',
              id: 'approval-trigger',
              props: { name: '审批事件触发', start: { formEventType: ['processEvents'] } },
            },
            {
              componentName: 'EndNode',
              id: 'approval-finish',
              props: { name: '结束' },
            },
          ],
        },
      },
    };
    const canonical = normalizeIntegrationReadback(raw);
    expect(canonical.process.trigger.eventTypes).toEqual(['processEvents']);
    expect(canonical.view.trigger.eventTypes).toEqual(['processEvents']);
  });

  test('reports observed data-create conformance without generalizing unresolved platform contracts', () => {
    const audit = readJson(AUDIT_PATH);
    expect(audit.summary.unitTestEvidence.result).toBe('passed');
    expect(audit.summary.compilerConformance).toBe('passed-supported-scenarios');
    expect(audit.summary.platformConformance).toBe('passed-integration-data-create-publish-and-platform-view-readback');
    expect(audit.summary.runtimeConformance).toBe('passed-integration-data-create-copies-fields-and-source-update-ignored');
    expect(audit.summary.realE2EEvidence.publishReadback.platformRuntimeJsonReadback)
      .toBe('PLATFORM_PROBE_REQUIRED');
    expect(audit.summary.agentVerification).toBe('not-run');
  });
});

describe('integration real-E2E evidence consistency', () => {
  function makeEvidence() {
    const resources = [
      { type: 'app', appType: 'APP_TEST' },
      { type: 'form', formUuid: 'FORM_SOURCE' },
      { type: 'form', formUuid: 'FORM_TARGET' },
      { type: 'logic-flow', processCode: 'LPROC_TEST' },
      {
        type: 'form-instance',
        role: 'runtime-trigger',
        ownershipEvidence: 'exclusive-owned-source-form + single-create-command + exact-runId-record',
      },
      {
        type: 'form-instance',
        role: 'automation-created-target',
        ownershipEvidence: 'owned-target-form + owned-published-flow + exact-unique-runId-field-match + single-post-trigger-readback',
      },
    ];
    const blockerHistory = [{
      previousStatus: 'blocked-profile-selection',
      status: 'resolved',
      resolvedAt: '2026-08-25T00:00:00.000Z',
      resolution: 'resolved-with-confirmed-primary-identity',
    }];
    const recoveryHistory = [
      {
        red: {
          failure: 'platform-rejected-logic-flow-name-over-30-characters',
          ownedFlowAfterFailure: 0,
        },
        resolution: 'local-preflight-length-guard + 30-character-safe-name',
        green: {
          status: 'passed',
          published: true,
          readbackGate: 'passed',
          resolvedAt: '2026-08-25T00:01:00.000Z',
        },
      },
      {
        red: { failure: 'RESPONSE_ID_MISSING', successfulCreateCommands: 1 },
        resolution: 'single create + exclusive owned source form + exact runId unique readback',
        green: {
          step: 'query-source-instance-recovery',
          status: 'passed',
          matchedCount: 1,
          nameAdoption: false,
          resolvedAt: '2026-08-25T00:02:00.000Z',
        },
      },
    ];
    const cleanup = {
      deleteCalls: 0,
      ownedResidualCount: 6,
      processWaivedResidualsTouched: 0,
    };
    return {
      manifest: {
        runId: 'RUN_TEST',
        status: 'passed-with-owned-residuals',
        finishedAt: '2026-08-25T00:03:00.000Z',
        blockerHistory,
        recoveryHistory,
        stageResults: {
          deterministic: { status: 'passed' },
          publishReadback: { status: 'passed' },
          runtime: { status: 'passed' },
          cleanup: { status: 'completed-owned-residuals-reported', ...cleanup },
        },
      },
      registry: {
        runId: 'RUN_TEST',
        status: 'passed-with-owned-residuals',
        finishedAt: '2026-08-25T00:03:00.000Z',
        blockerHistory,
        recoveryHistory,
        resources,
        cleanup,
      },
      residual: {
        runId: 'RUN_TEST',
        ownedResiduals: resources,
      },
    };
  }

  test('accepts resolved history and exact owned-resource evidence', () => {
    expect(validateRealE2EEvidence(makeEvidence())).toMatchObject({
      status: 'passed-with-owned-residuals',
      ownedResidualCount: 6,
    });
  });

  test('rejects passed evidence that retains an unresolved top-level failure', () => {
    const evidence = makeEvidence();
    evidence.registry.failure = { code: 'RESPONSE_ID_MISSING' };
    expect(() => validateRealE2EEvidence(evidence)).toThrow(/top-level failure/);
  });

  test('rejects residuals that drift from the registry resource ledger', () => {
    const evidence = makeEvidence();
    evidence.residual.ownedResiduals = evidence.residual.ownedResiduals.slice(0, 5);
    expect(() => validateRealE2EEvidence(evidence)).toThrow(/deeply equal/);
  });
});
