'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { cleanupOwnedResources } = require('../scripts/e2e-real/cleanup');
const {
  DEFAULT_DEFINITION_FILE,
  parseSingleJsonObject,
  run,
} = require('../scripts/e2e-real/process/runner');
const { generateAllScenarios } = require('../scripts/eval/process-contract/scenario-generator');

function serialScenario() {
  return generateAllScenarios().find(function (scenario) {
    return scenario.id === 'serial-approval';
  });
}

function readbackPayload(fixture) {
  const viewJson = JSON.parse(JSON.stringify(fixture.viewJson));
  viewJson.bindingForm = viewJson.bindingForm || 'FORM-PROC';
  viewJson.formulaRules = viewJson.formulaRules || [];
  viewJson.globalSetting = viewJson.globalSetting || {};
  return {
    success: true,
    content: JSON.stringify(viewJson),
  };
}

function createHarness(options = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-process-e2e-'));
  const runId = options.runId || 'OY_PROC_TEST_abcdef';
  const registry = {
    runId,
    status: 'running',
    resources: [],
    commands: [],
    artifacts: [],
  };
  const registryPath = path.join(tmpDir, `${runId}.json`);
  const workDir = path.join(tmpDir, runId);
  const scenario = serialScenario();
  const commandCalls = [];
  const apiCalls = [];
  const events = [];
  const definitionFile = options.definitionFile || DEFAULT_DEFINITION_FILE;

  const runOptions = {
    env: { OPENYIDA_E2E: '1' },
    config: {
      enabled: true,
      missing: [],
      runId,
      namePrefix: `${runId}__`,
      appType: 'APP-PROC',
      formUuid: 'FORM-PROC',
      scenarioId: 'serial-approval',
      definitionFile,
      registryDir: tmpDir,
      baseUrl: 'https://www.aliwork.com',
    },
    registry,
    registryPath,
    workDir,
    writeRegistry: function writeRegistry() {},
    addResource: function addResource(currentRegistry, ignoredPath, resource) {
      currentRegistry.resources.push({ createdAt: new Date().toISOString(), ...resource });
      events.push(`resource:${resource.type}`);
    },
    commandAdapter: {
      run: async function runCommand(args) {
        commandCalls.push(args);
        events.push('command');
        if (options.commandError) {throw options.commandError;}
        return options.commandResult || {
          status: 0,
          stdout: JSON.stringify({
            success: true,
            appType: 'APP-PROC',
            formUuid: 'FORM-PROC',
            processCode: 'TPROC-PROC',
            verificationLevel: options.commandVerificationLevel || 'PLATFORM_VIEW_VERIFIED',
            platformViewVerified: options.platformViewVerified !== false,
          }),
          stderr: '',
        };
      },
    },
    apiAdapter: {
      readback: async function readback(input) {
        apiCalls.push(input);
        events.push('readback');
        if (options.onReadback) {options.onReadback(registry);}
        return {
          rawProcessPayload: options.rawProcessPayload || readbackPayload(scenario.fixture),
          processId: 'PID-PROC',
          processVersion: 3,
        };
      },
    },
  };
  return {
    tmpDir,
    runId,
    registry,
    registryPath,
    workDir,
    scenario,
    commandCalls,
    apiCalls,
    events,
    runOptions,
    cleanup: function cleanup() {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}

describe('process deterministic E2E runner', () => {
  test('verifies combined preflight, publishes, verifies platform view, and records cleanup_blocked', async () => {
    const harness = createHarness({
      onReadback: function onReadback(registry) {
        expect(registry.resources).toContainEqual(expect.objectContaining({
          runId: 'OY_PROC_TEST_abcdef',
          owned: true,
          type: 'process',
          exactId: 'TPROC-PROC',
        }));
      },
    });
    try {
      const result = await run(harness.runOptions);

      expect(result.status).toBe('cleanup_blocked');
      expect(result.validationErrors).toEqual([]);
      expect(result.canonicalHash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.contractVerification).toMatchObject({
        verificationLevel: 'CONTRACT_VERIFIED',
        valid: true,
        errors: [],
      });
      expect(result.platformViewVerification).toMatchObject({
        verificationLevel: 'PLATFORM_VIEW_VERIFIED',
        valid: true,
        errors: [],
        artifactHash: result.canonicalHash,
        verifiedAssertions: expect.arrayContaining(['view.node-set']),
        observedCapabilities: expect.arrayContaining(['viewJson.schema']),
        unverifiedAssertions: expect.any(Array),
        runtimeRequired: expect.any(Array),
      });
      expect(fs.existsSync(result.rawReadbackPath)).toBe(true);
      expect(fs.existsSync(result.manifestPath)).toBe(true);
      expect(fs.existsSync(path.join(harness.workDir, 'tmp'))).toBe(false);
      expect(harness.events).toEqual([
        'resource:local-artifact',
        'command',
        'resource:process',
        'readback',
      ]);

      const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf8'));
      expect(manifest).toMatchObject({
        status: 'cleanup_blocked',
        scenarioId: 'serial-approval',
        contractRevision: 'schema-1-protocol-1',
        contractHash: harness.scenario.contractHash,
        canonicalHash: result.canonicalHash,
        validationErrors: [],
        contractVerification: expect.objectContaining({
          verificationLevel: 'CONTRACT_VERIFIED',
          valid: true,
        }),
        platformViewVerification: expect.objectContaining({
          verificationLevel: 'PLATFORM_VIEW_VERIFIED',
          valid: true,
          verifiedAssertions: expect.any(Array),
          observedCapabilities: expect.any(Array),
          unverifiedAssertions: expect.any(Array),
          runtimeRequired: expect.any(Array),
        }),
        cleanup: { status: 'cleanup_blocked' },
      });
      expect(manifest.rawReadbackPath).toBe(result.rawReadbackPath);
      expect(manifest.resources).toContainEqual(expect.objectContaining({
        type: 'process',
        processCode: 'TPROC-PROC',
        processId: 'PID-PROC',
        processVersion: 3,
      }));
    } finally {
      harness.cleanup();
    }
  });

  test('requires stdout to contain exactly one top-level JSON object', () => {
    expect(parseSingleJsonObject(' {"success":true}\n')).toEqual({ success: true });
    expect(function parseTwoObjects() {
      parseSingleJsonObject('{"success":true}\n{"success":true}');
    }).toThrow(expect.objectContaining({ code: 'PROCESS_E2E_STDOUT_INVALID' }));
    expect(function parseDecoratedObject() {
      parseSingleJsonObject('done\n{"success":true}');
    }).toThrow(expect.objectContaining({ code: 'PROCESS_E2E_STDOUT_INVALID' }));
  });

  test('fails closed when create-process does not return PLATFORM_VIEW_VERIFIED', async () => {
    const harness = createHarness({
      commandVerificationLevel: 'PUBLISHED_UNVERIFIED',
      platformViewVerified: false,
    });
    try {
      await expect(run(harness.runOptions)).rejects.toMatchObject({
        code: 'PROCESS_E2E_PUBLISH_UNVERIFIED',
      });
      expect(harness.commandCalls).toHaveLength(1);
      expect(harness.apiCalls).toHaveLength(0);
      expect(harness.registry.resources).not.toContainEqual(expect.objectContaining({
        type: 'process',
      }));
    } finally {
      harness.cleanup();
    }
  });

  test('preflight failure performs zero command and API writes', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-process-invalid-'));
    const definitionFile = path.join(tmpDir, 'invalid.json');
    fs.writeFileSync(definitionFile, JSON.stringify({
      nodes: [{ key: 'missing_approver', type: 'approval', name: '缺审批人' }],
    }));
    const harness = createHarness({ definitionFile });
    try {
      await expect(run(harness.runOptions)).rejects.toMatchObject({
        code: 'PROCESS_COMPILE_APPROVER_REQUIRED',
      });
      expect(harness.commandCalls).toHaveLength(0);
      expect(harness.apiCalls).toHaveLength(0);
      expect(harness.registry.resources).toHaveLength(0);
      expect(harness.registry.processRuns[0]).toMatchObject({
        status: 'failed',
        cleanup: { status: 'passed' },
      });
    } finally {
      harness.cleanup();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('combined preflight contract failure performs zero command and API writes', async () => {
    const harness = createHarness();
    const mismatchedScenario = JSON.parse(JSON.stringify(harness.scenario));
    mismatchedScenario.hiddenContract.nodes[1].name = '不匹配的主管审批';
    harness.runOptions.generateScenarios = function generateMismatch() {
      return [mismatchedScenario];
    };
    try {
      await expect(run(harness.runOptions)).rejects.toMatchObject({
        code: 'PROCESS_E2E_PREFLIGHT_CONTRACT_FAILED',
      });
      expect(harness.commandCalls).toHaveLength(0);
      expect(harness.apiCalls).toHaveLength(0);
      expect(harness.registry.resources).toHaveLength(0);
      const manifest = JSON.parse(fs.readFileSync(
        path.join(harness.workDir, 'acceptance-manifest.json'),
        'utf8'
      ));
      expect(manifest.contractVerification).toMatchObject({
        verificationLevel: 'CONTRACT_VERIFIED',
        valid: false,
        errors: expect.any(Array),
      });
      expect(manifest.platformViewVerification).toBeNull();
    } finally {
      harness.cleanup();
    }
  });

  test('platform view contract failure retains raw readback evidence', async () => {
    const scenario = serialScenario();
    const mutated = JSON.parse(JSON.stringify(scenario.fixture));
    mutated.viewJson.schema.children[1].props.name.zh_CN = '被篡改的审批';
    const harness = createHarness({ rawProcessPayload: readbackPayload(mutated) });
    try {
      let error;
      try {
        await run(harness.runOptions);
      } catch (caught) {
        error = caught;
      }
      expect(error).toMatchObject({ code: 'PROCESS_E2E_PLATFORM_VIEW_CONTRACT_FAILED' });
      expect(error.processResult.status).toBe('failed');
      expect(error.processResult.validationErrors.length).toBeGreaterThan(0);
      expect(error.processResult.contractVerification.valid).toBe(true);
      expect(error.processResult.platformViewVerification.valid).toBe(false);
      expect(fs.existsSync(error.processResult.rawReadbackPath)).toBe(true);
      const manifest = JSON.parse(fs.readFileSync(error.processResult.manifestPath, 'utf8'));
      expect(manifest.status).toBe('failed');
      expect(manifest.validationErrors.length).toBeGreaterThan(0);
      expect(manifest.contractVerification.valid).toBe(true);
      expect(manifest.platformViewVerification).toMatchObject({
        verificationLevel: 'PLATFORM_VIEW_VERIFIED',
        valid: false,
        verifiedAssertions: expect.any(Array),
        observedCapabilities: expect.any(Array),
        unverifiedAssertions: expect.any(Array),
        runtimeRequired: expect.any(Array),
      });
      expect(manifest.cleanup.status).toBe('cleanup_blocked');
    } finally {
      harness.cleanup();
    }
  });

  test('readback-only creates new evidence with sourceRunId and performs zero command writes', async () => {
    const harness = createHarness({ runId: 'OY_PROC_READBACK_ONLY' });
    const sourceRunId = 'OY_PROC_SOURCE';
    const sourceRegistryPath = path.join(harness.tmpDir, `${sourceRunId}.json`);
    fs.writeFileSync(sourceRegistryPath, JSON.stringify({
      runId: sourceRunId,
      resources: [
        { runId: sourceRunId, owned: true, type: 'app', exactId: 'APP-SOURCE', appType: 'APP-SOURCE' },
        { runId: sourceRunId, owned: true, type: 'form', exactId: 'FORM-SOURCE', appType: 'APP-SOURCE', formUuid: 'FORM-SOURCE' },
        {
          runId: sourceRunId,
          owned: true,
          type: 'process',
          exactId: 'TPROC-SOURCE',
          appType: 'APP-SOURCE',
          formUuid: 'FORM-SOURCE',
          processCode: 'TPROC-SOURCE',
          processId: 'PID-SOURCE',
          processVersion: 7,
        },
      ],
    }));
    Object.assign(harness.runOptions.config, {
      readbackOnly: true,
      sourceRunId,
      sourceRegistryPath,
      appType: '',
      formUuid: '',
      processCode: '',
      processId: '',
      processVersion: null,
    });
    try {
      const result = await run(harness.runOptions);
      expect(result.status).toBe('passed');
      expect(result.sourceRunId).toBe(sourceRunId);
      expect(result.readbackOnly).toBe(true);
      expect(harness.commandCalls).toHaveLength(0);
      expect(harness.apiCalls).toEqual([{
        appType: 'APP-SOURCE',
        formUuid: 'FORM-SOURCE',
        processCode: 'TPROC-SOURCE',
        processId: 'PID-SOURCE',
        processVersion: 7,
      }]);
      expect(harness.registry.resources).toEqual([]);
      expect(result.cleanup).toMatchObject({
        status: 'passed',
        residual: [],
      });
      expect(fs.existsSync(result.rawReadbackPath)).toBe(true);
      expect(fs.existsSync(result.canonicalViewPath)).toBe(true);
      const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf8'));
      expect(manifest).toMatchObject({
        runId: 'OY_PROC_READBACK_ONLY',
        sourceRunId,
        readbackOnly: true,
        resources: [],
        cleanup: { status: 'passed' },
        platformViewVerification: {
          verificationLevel: 'PLATFORM_VIEW_VERIFIED',
          valid: true,
          verifiedAssertions: expect.any(Array),
          observedCapabilities: expect.any(Array),
          unverifiedAssertions: expect.any(Array),
          runtimeRequired: expect.any(Array),
          artifactHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          errors: [],
        },
      });
    } finally {
      harness.cleanup();
    }
  });

  test('readback-only accepts explicit process identifiers without reading the source registry', async () => {
    const harness = createHarness({ runId: 'OY_PROC_READBACK_EXPLICIT' });
    Object.assign(harness.runOptions.config, {
      readbackOnly: true,
      sourceRunId: 'OY_PROC_SOURCE_EXPLICIT',
      sourceRegistryPath: path.join(harness.tmpDir, 'must-not-be-read.json'),
      appType: 'APP-EXPLICIT',
      formUuid: 'FORM-EXPLICIT',
      processCode: 'TPROC-EXPLICIT',
      processId: 'PID-EXPLICIT',
      processVersion: 9,
    });
    try {
      const result = await run(harness.runOptions);
      expect(result.status).toBe('passed');
      expect(harness.commandCalls).toHaveLength(0);
      expect(harness.apiCalls).toEqual([{
        appType: 'APP-EXPLICIT',
        formUuid: 'FORM-EXPLICIT',
        processCode: 'TPROC-EXPLICIT',
        processId: 'PID-EXPLICIT',
        processVersion: 9,
      }]);
      expect(harness.registry.resources).toEqual([]);
    } finally {
      harness.cleanup();
    }
  });

  test('finally removes the owned local temp directory after command failure', async () => {
    const harness = createHarness({ commandError: new Error('command exploded') });
    try {
      await expect(run(harness.runOptions)).rejects.toThrow('command exploded');
      expect(fs.existsSync(path.join(harness.workDir, 'tmp'))).toBe(false);
      expect(harness.registry.processRuns[0].cleanup).toMatchObject({
        status: 'passed',
      });
    } finally {
      harness.cleanup();
    }
  });

  test('ownership mismatch never removes the local path', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-process-owner-'));
    const runRoot = path.join(tmpDir, 'run');
    const target = path.join(runRoot, 'tmp');
    fs.mkdirSync(target, { recursive: true });
    const result = cleanupOwnedResources({
      runId: 'OY_PROC_OWNER',
      namePrefix: 'OY_PROC_OWNER__',
      localRoot: runRoot,
      registry: {
        resources: [{
          runId: 'OY_PROC_OWNER',
          owned: true,
          type: 'local-artifact',
          name: 'wrong-prefix',
          path: target,
        }],
      },
    });
    expect(result.status).toBe('cleanup_blocked');
    expect(result.removed).toHaveLength(0);
    expect(result.skipped[0].reason).toBe('name_prefix_mismatch');
    expect(fs.existsSync(target)).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('owned remote resources remain explicit cleanup blockers', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-process-remote-'));
    const runRoot = path.join(tmpDir, 'run');
    fs.mkdirSync(runRoot, { recursive: true });
    const result = cleanupOwnedResources({
      runId: 'OY_PROC_REMOTE',
      namePrefix: 'OY_PROC_REMOTE__',
      localRoot: runRoot,
      registry: {
        resources: [{
          runId: 'OY_PROC_REMOTE',
          owned: true,
          type: 'process',
          name: 'OY_PROC_REMOTE__Process',
          exactId: 'TPROC-REMOTE',
        }],
      },
    });
    expect(result).toMatchObject({
      status: 'cleanup_blocked',
      removed: [],
    });
    expect(result.residual).toContainEqual(expect.objectContaining({
      reason: 'remote_cleanup_unsupported',
    }));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
