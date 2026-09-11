'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  createCodexAdapter,
  createQoderAdapter,
  parseAgentSelection,
  run,
  sanitizeAgentEnvironment,
  verifyStandardEvidence,
} = require('../scripts/e2e-real/process/agent-runner');

const CANDIDATE_RELATIVE_PATH = 'candidate-skill/SKILL.md';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return filePath;
}

function createHarness() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-process-agent-'));
  const registryDir = path.join(root, 'registry');
  const candidateSkillPath = path.join(root, 'candidate-skill');
  fs.mkdirSync(candidateSkillPath, { recursive: true });
  fs.writeFileSync(path.join(candidateSkillPath, 'SKILL.md'), '# Candidate process skill\n', 'utf8');
  const config = {
    enabled: true,
    missing: [],
    runId: 'OY_PROC_AGENT_TEST',
    namePrefix: 'OY_PROC_AGENT_TEST__',
    adapter: 'qoder',
    prompt: '搭建一个 B 审批后由发起人 A 审批的串行流程',
    scenarioId: 'serial-approval',
    candidateSkillPath,
    registryDir,
  };
  const adapter = {
    name: 'qoder',
    run: jest.fn(async function (input) {
      return {
        adapter: 'qoder',
        available: true,
        status: 'passed',
        output: JSON.stringify({ schemaVersion: 1, scenarioId: 'serial-approval' }),
        capability: { available: true, loggedIn: true, source: 'qoder-bridge-status' },
        guardrail: {
          permissionBypass: false,
          isolatedWorkspace: true,
          authEnvironmentStripped: true,
          candidateBinding: true,
          candidateExposure: input.candidateExposure,
        },
      };
    }),
  };

  function standard(overrides = {}) {
    const runId = overrides.runId || 'OY_PROC_RUNTIME_CHILD';
    const manifestPath = path.join(registryDir, runId, 'acceptance-manifest.json');
    const manifest = {
      schemaVersion: 1,
      runId,
      status: 'cleanup_blocked',
      contractVerification: { verificationLevel: 'CONTRACT_VERIFIED', valid: true, errors: [] },
      platformViewVerification: {
        verificationLevel: 'PLATFORM_VIEW_VERIFIED', valid: true, errors: [],
        verifiedAssertions: ['view.node-component-name', 'view.designer-tree-order'],
        runtimeRequired: ['runtime.task-transition'],
      },
      runtimeVerification: {
        verificationLevel: 'RUNTIME_VERIFIED', valid: true, finalStatus: 'COMPLETED', errors: [],
        operationSequence: [
          {
            actor: 'B', nodeName: '直属主管审批', rawAction: '同意', action: 'AGREE',
            evidenceSources: {
              operation: ['operation-record.taskId'], actor: ['identity-gated-approve'],
              node: ['platform-view.designer-tree-order'],
            },
          },
          {
            actor: 'A', nodeName: '人事审批', rawAction: '同意', action: 'AGREE',
            evidenceSources: {
              operation: ['operation-record.taskId'], actor: ['identity-gated-approve'],
              node: ['platform-view.designer-tree-order'],
            },
          },
        ],
      },
      profileRestore: { actor: 'A', passed: true },
      cleanup: { status: 'cleanup_blocked', residual: [{ fingerprint: 'remote-fingerprint-only' }] },
      error: null,
      ...overrides.manifest,
    };
    writeJson(manifestPath, manifest);
    writeJson(path.join(registryDir, `${runId}.json`), {
      runId,
      status: manifest.status,
      resources: [],
      commands: [],
      runtimeRuns: [{ runId, status: manifest.status, manifestPath }],
    });
    return {
      runId,
      status: manifest.status,
      manifestPath,
      contractVerification: manifest.contractVerification,
      platformViewVerification: manifest.platformViewVerification,
      runtimeVerification: manifest.runtimeVerification,
      profileRestore: manifest.profileRestore,
      cleanup: manifest.cleanup,
    };
  }

  return {
    root,
    registryDir,
    candidateSkillPath,
    config,
    adapter,
    standard,
    cleanup: function cleanup() {fs.rmSync(root, { recursive: true, force: true });},
  };
}

describe('process agent Slice C runner', () => {
  test('accepts only an exact single JSON scenario selection', () => {
    expect(parseAgentSelection('{"schemaVersion":1,"scenarioId":"serial-approval"}'))
      .toEqual({ schemaVersion: 1, scenarioId: 'serial-approval' });
    expect(() => parseAgentSelection('{"schemaVersion":1,"scenarioId":"serial-approval"}\n{}'))
      .toThrow(expect.objectContaining({ code: 'PROCESS_AGENT_OUTPUT_INVALID' }));
    expect(() => parseAgentSelection(JSON.stringify({
      schemaVersion: 1, scenarioId: 'serial-approval', passed: true,
    }))).toThrow(expect.objectContaining({ code: 'PROCESS_AGENT_OUTPUT_FORBIDDEN_FIELD' }));
  });

  test('strips OpenYida and credential selectors from the Qoder child environment', () => {
    const sanitized = sanitizeAgentEnvironment({
      PATH: '/safe/bin', HOME: '/safe/home', LANG: 'zh_CN.UTF-8',
      QODERCLI: '/safe/qodercli', CODEX_HOME: '/safe/codex-home',
      OPENYIDA_ACCESS_TOKEN: 'token-secret',
      OPENYIDA_AUTH_PROFILE: 'profile-secret',
      SOME_COOKIE: 'cookie-secret',
      AWS_ACCESS_KEY_ID: 'access-key-secret',
      ALIBABA_CLOUD_ACCESS_KEY_SECRET: 'access-key-value-secret',
      SERVICE_AUTH: 'auth-secret',
      SERVICE_SESSION: 'session-secret',
      PRIVATE_KEY: 'private-key-secret',
      NORMAL_VALUE: 'must-not-pass-minimal-env',
    });
    expect(sanitized).toEqual({
      PATH: '/safe/bin', HOME: '/safe/home', LANG: 'zh_CN.UTF-8',
      QODERCLI: '/safe/qodercli', CODEX_HOME: '/safe/codex-home',
    });
    const serialized = JSON.stringify(sanitized);
    [
      'token-secret', 'profile-secret', 'cookie-secret', 'access-key-secret',
      'access-key-value-secret', 'auth-secret', 'session-secret', 'private-key-secret',
      'must-not-pass-minimal-env',
    ].forEach(function (secret) {expect(serialized).not.toContain(secret);});
  });

  test('Qoder adapter uses bridge without permission bypass and returns strict output', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-qoder-adapter-'));
    const globalBridgeDir = path.join(root, 'global-bridge-must-stay-empty');
    const workspaceDir = path.join(root, 'workspace');
    const boundSkillPath = path.join(workspaceDir, 'candidate-skill', 'SKILL.md');
    fs.mkdirSync(path.dirname(boundSkillPath), { recursive: true });
    fs.writeFileSync(boundSkillPath, '# candidate\n', 'utf8');
    const calls = [];
    const spawnSync = jest.fn(function (_command, args, options) {
      calls.push({ args, env: options.env });
      if (args.includes('status')) {
        return {
          status: 0,
          stdout: JSON.stringify({
            preferred_qodercli: '$HOME/.local/bin/qodercli',
            qodercli_candidates: [{ logged_in: true, status: 'Version: 1.1.3\nUsername: redacted' }],
          }),
          stderr: '',
        };
      }
      const bridgeDir = args[args.indexOf('--bridge-dir') + 1];
      const runId = args[args.indexOf('--run-id') + 1];
      const summaryPath = path.join(bridgeDir, 'runs', runId, 'summary.md');
      fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
      fs.writeFileSync(summaryPath, '{"schemaVersion":1,"scenarioId":"serial-approval"}\n', 'utf8');
      writeJson(path.join(bridgeDir, 'runs', runId, 'status.json'), { status: 'done' });
      fs.writeFileSync(path.join(bridgeDir, 'runs', runId, 'raw_output.txt'), 'fallback\n', 'utf8');
      return {
        status: 0,
        stdout: JSON.stringify({ run_id: runId, artifact_profile: 'none', qoder_chat_exit_code: 0 }),
        stderr: '',
      };
    });
    try {
      const adapter = createQoderAdapter({
        spawnSync, bridgePath: path.join(root, 'qoder_bridge.py'), bridgeDir: globalBridgeDir,
      });
      const result = await adapter.run({
        runId: 'OY_PROC_AGENT_QODER_TEST', prompt: 'prompt', workspaceDir, boundSkillPath,
        candidateExposure: {
          method: 'bridge-add-file', relativePath: CANDIDATE_RELATIVE_PATH, hash: 'a'.repeat(64),
        },
        env: { PATH: '/safe/bin', OPENYIDA_ACCESS_TOKEN: 'must-not-leak' },
      });
      expect(result).toMatchObject({ adapter: 'qoder', available: true, status: 'passed' });
      expect(result.guardrail.candidateExposure).toEqual({
        method: 'bridge-add-file', relativePath: CANDIDATE_RELATIVE_PATH, hash: 'a'.repeat(64),
      });
      expect(parseAgentSelection(result.output)).toEqual({ schemaVersion: 1, scenarioId: 'serial-approval' });
      const sendCall = calls.find((call) => call.args.includes('send'));
      const expectedBridgeDir = path.join(workspaceDir, 'qoder-bridge');
      expect(sendCall.args).toEqual(expect.arrayContaining([
        'send', '--transport', 'qodercli', '--artifact-profile', 'none', '--cwd', workspaceDir,
        '--add-file', boundSkillPath,
      ]));
      expect(sendCall.args).toEqual(expect.arrayContaining(['--bridge-dir', expectedBridgeDir]));
      expect(sendCall.args).not.toContain('--yolo');
      expect(sendCall.args).not.toContain('--dangerously-skip-permissions');
      expect(JSON.stringify(sendCall.env)).not.toContain('must-not-leak');
      expect(fs.existsSync(path.join(expectedBridgeDir, 'runs', 'OY_PROC_AGENT_QODER_TEST_qoder', 'summary.md'))).toBe(true);
      expect(fs.existsSync(globalBridgeDir)).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('Qoder capability absence is structured and does not send a prompt', async () => {
    const spawnSync = jest.fn(function () {
      return { status: 0, stdout: JSON.stringify({ preferred_qodercli: null, qodercli_candidates: [] }), stderr: '' };
    });
    const adapter = createQoderAdapter({ spawnSync, bridgePath: '/bridge.py', bridgeDir: '/global-bridge' });
    const result = await adapter.run({ runId: 'R', prompt: 'p', workspaceDir: '/tmp/w', boundSkillPath: '/tmp/w/SKILL.md' });
    expect(result).toMatchObject({
      adapter: 'qoder', available: false, status: 'capability_blocked',
      error: { code: 'PROCESS_AGENT_QODER_CAPABILITY_BLOCKED' },
    });
    expect(spawnSync).toHaveBeenCalledTimes(1);
  });

  test('Codex adapter reports missing CLI as capability_blocked without fallback', async () => {
    const spawnSync = jest.fn(() => ({ status: null, stdout: '', stderr: '', error: { code: 'ENOENT' } }));
    const result = await createCodexAdapter({ spawnSync }).run({});
    expect(result).toEqual(expect.objectContaining({
      adapter: 'codex', available: false, status: 'capability_blocked', executionSupported: false,
      error: { code: 'PROCESS_AGENT_CODEX_CAPABILITY_BLOCKED' },
    }));
    expect(spawnSync).toHaveBeenCalledTimes(1);
  });

  test('Codex requires version plus headless exec help capability', async () => {
    const spawnSync = jest.fn(function (_command, args) {
      if (args[0] === '--version') {return { status: 0, stdout: 'codex-cli 0.149.0\n', stderr: '' };}
      return { status: 1, stdout: '', stderr: 'exec unavailable' };
    });
    const result = await createCodexAdapter({ spawnSync }).run({});
    expect(result).toMatchObject({
      adapter: 'codex', available: false, status: 'capability_blocked', executionSupported: false,
      capability: {
        available: false,
        source: 'codex-version-exec-help-probe',
        probeShape: {
          version: { exitCode: 0, outputType: 'string', nonEmpty: true },
          execution: { exitCode: 1, outputType: 'string', usageExec: false },
        },
      },
    });
    expect(spawnSync).toHaveBeenCalledTimes(2);
  });

  test('Codex cannot claim a bound candidate without explicit exposure evidence', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-codex-no-exposure-'));
    const workspaceDir = path.join(root, 'workspace');
    const boundSkillPath = path.join(workspaceDir, CANDIDATE_RELATIVE_PATH);
    fs.mkdirSync(path.dirname(boundSkillPath), { recursive: true });
    fs.writeFileSync(boundSkillPath, '# candidate\n', 'utf8');
    const spawnSync = jest.fn(function (_command, args) {
      if (args[0] === '--version') {return { status: 0, stdout: 'codex-cli\n', stderr: '' };}
      return {
        status: 0,
        stdout: 'Usage: codex exec\n--sandbox\n--output-last-message\n--skip-git-repo-check\n',
        stderr: '',
      };
    });
    try {
      const result = await createCodexAdapter({ spawnSync }).run({
        runId: 'OY_PROC_AGENT_CODEX_NO_EXPOSURE', prompt: 'prompt', workspaceDir, boundSkillPath,
      });
      expect(result).toMatchObject({
        status: 'failed', error: { code: 'PROCESS_AGENT_CANDIDATE_EXPOSURE_INVALID' },
      });
      expect(spawnSync).toHaveBeenCalledTimes(2);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('Codex adapter uses read-only headless exec and strict owned output', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-codex-adapter-'));
    const workspaceDir = path.join(root, 'workspace');
    const boundSkillPath = path.join(workspaceDir, 'candidate-skill', 'SKILL.md');
    fs.mkdirSync(path.dirname(boundSkillPath), { recursive: true });
    fs.writeFileSync(boundSkillPath, '# candidate\n', 'utf8');
    const calls = [];
    const spawnSync = jest.fn(function (_command, args, options) {
      calls.push({ args, env: options.env });
      if (args[0] === '--version') {return { status: 0, stdout: 'codex-cli 0.149.0\n', stderr: '' };}
      if (args[0] === 'exec' && args[1] === '--help') {
        return {
          status: 0,
          stdout: 'Usage: codex exec [OPTIONS] [PROMPT]\n--sandbox\n--output-last-message\n--skip-git-repo-check\n',
          stderr: '',
        };
      }
      const outputPath = args[args.indexOf('--output-last-message') + 1];
      fs.writeFileSync(outputPath, '{"schemaVersion":1,"scenarioId":"serial-approval"}\n', 'utf8');
      return { status: 0, stdout: '', stderr: '' };
    });
    try {
      const result = await createCodexAdapter({ spawnSync }).run({
        runId: 'OY_PROC_AGENT_CODEX_TEST', prompt: 'prompt', workspaceDir, boundSkillPath,
        candidateExposure: {
          method: 'cwd-relative-read', relativePath: CANDIDATE_RELATIVE_PATH, hash: 'b'.repeat(64),
        },
        env: { PATH: '/safe/bin', PRIVATE_KEY: 'must-not-leak' },
      });
      expect(result).toMatchObject({
        adapter: 'codex', available: true, status: 'passed', executionSupported: true,
        guardrail: {
          permissionBypass: false, isolatedWorkspace: true,
          authEnvironmentStripped: true, candidateBinding: true,
          candidateExposure: {
            method: 'cwd-relative-read', relativePath: CANDIDATE_RELATIVE_PATH, hash: 'b'.repeat(64),
          },
        },
      });
      expect(parseAgentSelection(result.output)).toEqual({ schemaVersion: 1, scenarioId: 'serial-approval' });
      const execCall = calls.find((call) => call.args[0] === 'exec' && call.args[1] !== '--help');
      expect(execCall.args).toEqual(expect.arrayContaining([
        'exec', '--sandbox', 'read-only', '--cd', workspaceDir,
        '--skip-git-repo-check', '--output-last-message', path.join(workspaceDir, 'codex-last-message.json'),
      ]));
      expect(execCall.args).not.toContain('--dangerously-bypass-approvals-and-sandbox');
      const sentPrompt = execCall.args[execCall.args.length - 1];
      expect(sentPrompt).toContain('first read candidate-skill/SKILL.md');
      expect(sentPrompt).toContain('do not read any other Skill path or globally installed Skill');
      expect(sentPrompt).not.toContain(boundSkillPath);
      expect(JSON.stringify(execCall.env)).not.toContain('must-not-leak');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('Codex orchestration uses the same standard manifest gate', async () => {
    const harness = createHarness();
    const standardRunner = jest.fn(async () => harness.standard());
    const adapter = createCodexAdapter({
      spawnSync: jest.fn(function (_command, args) {
        if (args[0] === '--version') {return { status: 0, stdout: 'codex-cli 0.149.0\n', stderr: '' };}
        if (args[0] === 'exec' && args[1] === '--help') {
          return { status: 0, stdout: 'Usage: codex exec\n--sandbox\n--output-last-message\n--skip-git-repo-check\n', stderr: '' };
        }
        const outputPath = args[args.indexOf('--output-last-message') + 1];
        fs.writeFileSync(outputPath, '{"schemaVersion":1,"scenarioId":"serial-approval"}\n', 'utf8');
        return { status: 0, stdout: '', stderr: '' };
      }),
    });
    harness.config.adapter = 'codex';
    try {
      const result = await run({ config: harness.config, adapter, standardRunner });
      expect(result).toMatchObject({
        status: 'cleanup_blocked', adapter: 'codex',
        adapterResult: { available: true, executionSupported: true },
        agentVerification: { valid: true },
      });
      expect(standardRunner).toHaveBeenCalledTimes(1);
      const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf8'));
      expect(manifest.adapterResult.capability.probeShape).toEqual(expect.objectContaining({
        version: expect.objectContaining({ outputType: 'string' }),
        execution: expect.objectContaining({ usageExec: true }),
      }));
      expect(manifest.guardrails[0].candidateExposure).toEqual({
        method: 'cwd-relative-read',
        relativePath: CANDIDATE_RELATIVE_PATH,
        hash: manifest.candidateBinding.sourceHash,
      });
      expect(JSON.stringify(manifest.adapterResult.capability.probeShape)).not.toContain('codex-cli 0.149.0');
    } finally {
      harness.cleanup();
    }
  });

  test('happy Qoder chain trusts only the standard manifest and cleans isolation', async () => {
    const harness = createHarness();
    const standardResult = harness.standard();
    const standardRunner = jest.fn(async () => standardResult);
    try {
      const result = await run({ config: harness.config, adapter: harness.adapter, standardRunner });
      expect(result).toMatchObject({
        status: 'cleanup_blocked',
        agentVerification: { verificationLevel: 'AGENT_VERIFIED', valid: true },
        standardEvidence: {
          runId: standardResult.runId,
          contractVerified: true,
          platformViewVerified: true,
          runtimeVerified: true,
          finalStatus: 'COMPLETED',
        },
      });
      expect(standardRunner).toHaveBeenCalledTimes(1);
      const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf8'));
      expect(manifest.agentVerification.valid).toBe(true);
      expect(manifest.adapterResult).not.toHaveProperty('output');
      expect(manifest).not.toHaveProperty('prompt');
      expect(manifest.candidateBinding).toEqual(expect.objectContaining({
        sourceHash: expect.any(String), boundHashBefore: expect.any(String), boundHashAfter: expect.any(String),
        unchanged: true, isolated: true,
      }));
      expect(fs.existsSync(path.join(harness.registryDir, harness.config.runId, 'isolated-workspace'))).toBe(false);
    } finally {
      harness.cleanup();
    }
  });

  test('Qoder blocked or guardrail failure prevents the standard runner', async () => {
    const harness = createHarness();
    const standardRunner = jest.fn();
    try {
      harness.adapter.run.mockResolvedValueOnce({
        adapter: 'qoder', available: false, status: 'capability_blocked',
        capability: { available: false },
        error: { code: 'PROCESS_AGENT_QODER_CAPABILITY_BLOCKED' },
      });
      const blocked = await run({ config: harness.config, adapter: harness.adapter, standardRunner });
      expect(blocked.status).toBe('capability_blocked');
      expect(standardRunner).not.toHaveBeenCalled();
      expect(fs.existsSync(path.join(harness.registryDir, 'OY_PROC_AGENT_TEST', 'isolated-workspace'))).toBe(false);

      harness.config.runId = 'OY_PROC_AGENT_GUARDRAIL';
      harness.config.namePrefix = `${harness.config.runId}__`;
      harness.adapter.run.mockResolvedValueOnce({
        adapter: 'qoder', available: true, status: 'passed',
        output: '{"schemaVersion":1,"scenarioId":"serial-approval"}',
        capability: { available: true },
        guardrail: { permissionBypass: true, isolatedWorkspace: true, authEnvironmentStripped: true, candidateBinding: true },
      });
      const guarded = await run({ config: harness.config, adapter: harness.adapter, standardRunner });
      expect(guarded.status).toBe('failed');
      expect(guarded.error.code).toBe('PROCESS_AGENT_GUARDRAIL_FAILED');
      expect(standardRunner).not.toHaveBeenCalled();
      expect(fs.existsSync(path.join(harness.registryDir, 'OY_PROC_AGENT_GUARDRAIL', 'isolated-workspace'))).toBe(false);
    } finally {
      harness.cleanup();
    }
  });

  test.each([
    ['installed global Skill method', { method: 'installed-global-skill' }],
    ['absolute candidate path', { relativePath: '/outside/global-skill/SKILL.md' }],
    ['wrong candidate hash', { hash: 'f'.repeat(64) }],
  ])('candidate exposure rejects %s before the standard runner', async (_name, mutation) => {
    const harness = createHarness();
    const standardRunner = jest.fn();
    harness.adapter.run.mockImplementationOnce(async function (input) {
      return {
        adapter: 'qoder', available: true, status: 'passed',
        output: '{"schemaVersion":1,"scenarioId":"serial-approval"}',
        capability: { available: true },
        guardrail: {
          permissionBypass: false, isolatedWorkspace: true,
          authEnvironmentStripped: true, candidateBinding: true,
          candidateExposure: { ...input.candidateExposure, ...mutation },
        },
      };
    });
    try {
      const result = await run({ config: harness.config, adapter: harness.adapter, standardRunner });
      expect(result.status).toBe('failed');
      expect(result.error.code).toBe('PROCESS_AGENT_CANDIDATE_EXPOSURE_INVALID');
      expect(standardRunner).not.toHaveBeenCalled();
      expect(fs.existsSync(path.join(harness.registryDir, harness.config.runId, 'isolated-workspace'))).toBe(false);
      expect(fs.readFileSync(result.manifestPath, 'utf8')).not.toContain('/outside/global-skill');
    } finally {
      harness.cleanup();
    }
  });

  test('Qoder bridge failure keeps all fallback artifacts run-scoped and finally removes them', async () => {
    const harness = createHarness();
    const globalBridgeDir = path.join(harness.root, 'global-bridge-must-stay-empty');
    const standardRunner = jest.fn();
    const spawnSync = jest.fn(function (_command, args) {
      if (args.includes('status')) {
        return {
          status: 0,
          stdout: JSON.stringify({
            preferred_qodercli: '$HOME/.local/bin/qodercli',
            qodercli_candidates: [{ logged_in: true, status: 'Version: 1.1.3' }],
          }),
          stderr: '',
        };
      }
      const bridgeDir = args[args.indexOf('--bridge-dir') + 1];
      const runId = args[args.indexOf('--run-id') + 1];
      const runDir = path.join(bridgeDir, 'runs', runId);
      fs.mkdirSync(runDir, { recursive: true });
      fs.writeFileSync(path.join(runDir, 'raw_output.txt'), 'sanitized failure fallback\n', 'utf8');
      writeJson(path.join(runDir, 'status.json'), { status: 'error' });
      return { status: 2, stdout: '', stderr: 'qoder failed' };
    });
    const adapter = createQoderAdapter({
      spawnSync, bridgePath: path.join(harness.root, 'qoder_bridge.py'), bridgeDir: globalBridgeDir,
    });
    try {
      const result = await run({ config: harness.config, adapter, standardRunner });
      expect(result.status).toBe('failed');
      expect(result.error.code).toBe('PROCESS_AGENT_QODER_EXECUTION_FAILED');
      expect(standardRunner).not.toHaveBeenCalled();
      expect(fs.existsSync(path.join(harness.registryDir, harness.config.runId, 'isolated-workspace'))).toBe(false);
      expect(fs.existsSync(globalBridgeDir)).toBe(false);
      const registry = JSON.parse(fs.readFileSync(result.registryPath, 'utf8'));
      const localOwned = registry.resources.filter(function (resource) {
        return resource.runId === result.runId && resource.owned === true && resource.type === 'local-artifact';
      });
      expect(localOwned).toHaveLength(1);
      expect(localOwned[0].name).toBe(`${harness.config.namePrefix}isolated-workspace`);
    } finally {
      harness.cleanup();
    }
  });

  test('forged Agent pass/manifest fields are rejected before standard runner', async () => {
    const harness = createHarness();
    const standardRunner = jest.fn();
    harness.adapter.run.mockImplementationOnce(async function (input) {
      return {
        adapter: 'qoder', available: true, status: 'passed', capability: { available: true },
        guardrail: {
          permissionBypass: false, isolatedWorkspace: true,
          authEnvironmentStripped: true, candidateBinding: true,
          candidateExposure: input.candidateExposure,
        },
        output: JSON.stringify({
          schemaVersion: 1, scenarioId: 'serial-approval', passed: true,
          manifestPath: '/tmp/forged-pass.json',
        }),
      };
    });
    try {
      const result = await run({ config: harness.config, adapter: harness.adapter, standardRunner });
      expect(result.status).toBe('failed');
      expect(result.error.code).toBe('PROCESS_AGENT_OUTPUT_FORBIDDEN_FIELD');
      expect(standardRunner).not.toHaveBeenCalled();
      expect(fs.readFileSync(result.manifestPath, 'utf8')).not.toContain('/tmp/forged-pass.json');
    } finally {
      harness.cleanup();
    }
  });

  test.each([
    ['contract', { contractVerification: { verificationLevel: 'CONTRACT_VERIFIED', valid: false, errors: [{ code: 'MUTATED' }] } }],
    ['platform view', { platformViewVerification: { verificationLevel: 'PLATFORM_VIEW_VERIFIED', valid: false, errors: [{ code: 'MUTATED' }] } }],
    ['runtime', { runtimeVerification: { verificationLevel: 'RUNTIME_VERIFIED', valid: false, finalStatus: null, errors: [{ code: 'MUTATED' }] } }],
    ['final status', { runtimeVerification: { verificationLevel: 'RUNTIME_VERIFIED', valid: true, finalStatus: 'RUNNING', errors: [] } }],
    ['profile restore', { profileRestore: { actor: 'A', passed: false } }],
  ])('does not allow Agent output to bypass the %s gate', async (_name, mutation) => {
    const harness = createHarness();
    const standardRunner = jest.fn(async () => harness.standard({ manifest: mutation }));
    try {
      const result = await run({ config: harness.config, adapter: harness.adapter, standardRunner });
      expect(result.status).toBe('failed');
      expect(result.agentVerification.valid).toBe(false);
      expect(result.error.code).toBe('PROCESS_AGENT_STANDARD_EVIDENCE_INVALID');
      expect(result.cleanup).toMatchObject({
        status: 'cleanup_blocked', standardStatus: 'cleanup_blocked', standardResidualCount: 1,
      });
    } finally {
      harness.cleanup();
    }
  });

  test('rejects a standard manifest outside the owned registry root', () => {
    const harness = createHarness();
    const outside = path.join(harness.root, 'outside', 'acceptance-manifest.json');
    writeJson(outside, { runId: 'FORGED' });
    try {
      expect(() => verifyStandardEvidence({ runId: 'FORGED', manifestPath: outside }, {
        registryDir: harness.registryDir,
      })).toThrow(expect.objectContaining({ code: 'PROCESS_AGENT_STANDARD_MANIFEST_SCOPE_INVALID' }));
    } finally {
      harness.cleanup();
    }
  });

  test('rejects a standalone pass manifest that is not linked by the standard registry', () => {
    const harness = createHarness();
    const standard = harness.standard();
    fs.rmSync(path.join(harness.registryDir, `${standard.runId}.json`));
    try {
      expect(() => verifyStandardEvidence(standard, {
        registryDir: harness.registryDir,
      })).toThrow(expect.objectContaining({ code: 'PROCESS_AGENT_STANDARD_REGISTRY_INVALID' }));
    } finally {
      harness.cleanup();
    }
  });

  test('candidate mutation fails closed before the standard runner and finally cleans local workspace', async () => {
    const harness = createHarness();
    const standardRunner = jest.fn();
    harness.adapter.run.mockImplementationOnce(async function (input) {
      fs.appendFileSync(path.join(input.boundCandidatePath, 'SKILL.md'), 'mutated\n', 'utf8');
      return {
        adapter: 'qoder', available: true, status: 'passed',
        output: '{"schemaVersion":1,"scenarioId":"serial-approval"}', capability: { available: true },
        guardrail: {
          permissionBypass: false, isolatedWorkspace: true,
          authEnvironmentStripped: true, candidateBinding: true,
          candidateExposure: input.candidateExposure,
        },
      };
    });
    try {
      const result = await run({ config: harness.config, adapter: harness.adapter, standardRunner });
      expect(result.status).toBe('failed');
      expect(result.error.code).toBe('PROCESS_AGENT_CANDIDATE_MUTATED');
      expect(standardRunner).not.toHaveBeenCalled();
      expect(fs.existsSync(path.join(harness.registryDir, harness.config.runId, 'isolated-workspace'))).toBe(false);
    } finally {
      harness.cleanup();
    }
  });

  test('public manifest excludes prompt, raw Agent output, sensitive values and remote exact IDs', async () => {
    const harness = createHarness();
    const exactId = 'PROCESS_INSTANCE_EXACT_SECRET_123456';
    const profile = 'PROFILE_EXACT_SECRET_123456';
    const standardRunner = jest.fn(async () => harness.standard());
    harness.config.prompt = `simple prompt ${profile}`;
    try {
      const result = await run({
        config: harness.config,
        adapter: harness.adapter,
        standardRunner,
        sensitiveValues: [exactId, profile],
      });
      const text = fs.readFileSync(result.manifestPath, 'utf8');
      expect(text).not.toContain(exactId);
      expect(text).not.toContain(profile);
      expect(text).not.toContain(harness.config.prompt);
      expect(text).toContain(CANDIDATE_RELATIVE_PATH);
      expect(text).not.toContain(harness.candidateSkillPath);
      expect(result.privacy).toEqual({ passed: true, leakedValueCount: 0 });
    } finally {
      harness.cleanup();
    }
  });

  test('sensitive exact ID in a standard manifest is rejected and never copied publicly', async () => {
    const harness = createHarness();
    const exactId = 'PROCESS_INSTANCE_EXACT_SECRET_654321';
    const standardRunner = jest.fn(async () => harness.standard({
      manifest: { diagnosticMutation: exactId },
    }));
    try {
      const result = await run({
        config: harness.config,
        adapter: harness.adapter,
        standardRunner,
        sensitiveValues: [exactId],
      });
      expect(result.status).toBe('failed');
      expect(result.error.code).toBe('PROCESS_AGENT_STANDARD_EVIDENCE_SENSITIVE');
      expect(fs.readFileSync(result.manifestPath, 'utf8')).not.toContain(exactId);
    } finally {
      harness.cleanup();
    }
  });
});
