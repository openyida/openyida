#!/usr/bin/env node

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { addResource, createRegistry, writeRegistry } = require('../runner');
const { cleanupOwnedResources, isPathInside } = require('../cleanup');
const {
  createRunId: createProcessRunId,
  parseSingleJsonObject,
} = require('./runner');
const { run: runProcessRuntime } = require('./runtime-runner');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const DEFAULT_REGISTRY_DIR = path.join(ROOT, 'project', '.cache', 'e2e-real');
const DEFAULT_CANDIDATE_SKILL = path.join(
  ROOT,
  'yida-skills',
  'skills',
  'yida-create-process'
);
const DEFAULT_QODER_BRIDGE = path.join(
  os.homedir(),
  '.codex',
  'skills',
  'qoder-control',
  'scripts',
  'qoder_bridge.py'
);
const ALLOWED_STATUSES = new Set([
  'passed', 'failed', 'skipped', 'capability_blocked', 'cleanup_blocked',
]);
const AGENT_SELECTION_KEYS = ['scenarioId', 'schemaVersion'];
const CANDIDATE_RELATIVE_PATH = 'candidate-skill/SKILL.md';
const AGENT_ENV_ALLOWLIST = new Set([
  'PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'LANG', 'LC_ALL', 'LC_CTYPE',
  'TERM', 'SHELL', 'USER', 'LOGNAME', 'QODERCLI', 'QODERCLI_PATH',
  'CODEX_HOME', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'SSL_CERT_FILE',
  'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS', 'NO_COLOR', 'CI',
]);
const SENSITIVE_ENV_NAME = /(?:^OPENYIDA_|ACCESS_KEY|API_KEY|TOKEN|COOKIE|SECRET|PASSWORD|PASSWD|PASSPHRASE|PRIVATE_KEY|AUTH|SESSION|CREDENTIAL|AUTHORIZATION)/i;

function agentError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function sha256(value) {
  const input = Buffer.isBuffer(value) ? value : String(value || '');
  return crypto.createHash('sha256').update(input).digest('hex');
}

function createAgentRunId(date = new Date(), randomBytes = crypto.randomBytes) {
  return createProcessRunId(date, randomBytes).replace(/^OY_PROC_/, 'OY_PROC_AGENT_');
}

function getConfig(env = process.env, date = new Date()) {
  const runId = createAgentRunId(date);
  const enabled = env.OPENYIDA_E2E_AGENT === '1';
  const adapter = env.OPENYIDA_E2E_AGENT_ADAPTER || 'qoder';
  const prompt = env.OPENYIDA_E2E_AGENT_PROMPT || '';
  const missing = [];
  if (!enabled) {missing.push('OPENYIDA_E2E_AGENT=1');}
  if (!prompt) {missing.push('OPENYIDA_E2E_AGENT_PROMPT');}
  return {
    enabled: missing.length === 0,
    missing,
    runId,
    namePrefix: `${runId}__`,
    adapter,
    prompt,
    scenarioId: env.OPENYIDA_E2E_PROCESS_SCENARIO || 'serial-approval',
    candidateSkillPath: env.OPENYIDA_E2E_AGENT_CANDIDATE_SKILL || DEFAULT_CANDIDATE_SKILL,
    registryDir: env.OPENYIDA_E2E_REGISTRY_DIR || DEFAULT_REGISTRY_DIR,
  };
}

function sanitizeAgentEnvironment(env = process.env) {
  const sanitized = {};
  Object.entries(env || {}).forEach(function ([key, value]) {
    if (SENSITIVE_ENV_NAME.test(key) || !AGENT_ENV_ALLOWLIST.has(key)) {return;}
    sanitized[key] = value;
  });
  return sanitized;
}

function listTreeFiles(root, current = root, result = []) {
  fs.readdirSync(current, { withFileTypes: true }).forEach(function (entry) {
    const absolute = path.join(current, entry.name);
    if (entry.isSymbolicLink()) {
      throw agentError(
        'PROCESS_AGENT_CANDIDATE_SYMLINK_FORBIDDEN',
        'candidate Skill must not contain symbolic links'
      );
    }
    if (entry.isDirectory()) {
      listTreeFiles(root, absolute, result);
    } else if (entry.isFile()) {
      result.push(path.relative(root, absolute));
    }
  });
  return result;
}

function hashTree(targetPath) {
  if (!targetPath || !fs.existsSync(targetPath)) {
    throw agentError('PROCESS_AGENT_CANDIDATE_NOT_FOUND', 'candidate Skill path does not exist');
  }
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {return sha256(fs.readFileSync(targetPath));}
  if (!stat.isDirectory()) {
    throw agentError('PROCESS_AGENT_CANDIDATE_INVALID', 'candidate Skill path must be a file or directory');
  }
  const hash = crypto.createHash('sha256');
  listTreeFiles(targetPath).sort().forEach(function (relative) {
    hash.update(relative);
    hash.update('\0');
    hash.update(fs.readFileSync(path.join(targetPath, relative)));
    hash.update('\0');
  });
  return hash.digest('hex');
}

function parseJsonObject(stdout, code, message) {
  try {
    return parseSingleJsonObject(stdout);
  } catch (_error) {
    throw agentError(code, message);
  }
}

function parseAgentSelection(output) {
  const parsed = parseJsonObject(
    output,
    'PROCESS_AGENT_OUTPUT_INVALID',
    'Agent output must be exactly one top-level JSON object'
  );
  const keys = Object.keys(parsed).sort();
  const forbidden = keys.filter(function (key) {return !AGENT_SELECTION_KEYS.includes(key);});
  if (forbidden.length > 0) {
    throw agentError(
      'PROCESS_AGENT_OUTPUT_FORBIDDEN_FIELD',
      `Agent output contains forbidden fields: ${forbidden.join(', ')}`
    );
  }
  if (keys.length !== AGENT_SELECTION_KEYS.length
    || parsed.schemaVersion !== 1
    || typeof parsed.scenarioId !== 'string'
    || !parsed.scenarioId.trim()) {
    throw agentError(
      'PROCESS_AGENT_OUTPUT_INVALID',
      'Agent output must contain only schemaVersion=1 and a non-empty scenarioId'
    );
  }
  return { schemaVersion: 1, scenarioId: parsed.scenarioId };
}

function candidateExposureFor(adapter, hash) {
  return {
    method: adapter === 'qoder' ? 'bridge-add-file' : 'cwd-relative-read',
    relativePath: CANDIDATE_RELATIVE_PATH,
    hash,
  };
}

function validAdapterExposure(input, expectedMethod) {
  const exposure = input && input.candidateExposure;
  if (!exposure
    || exposure.method !== expectedMethod
    || exposure.relativePath !== CANDIDATE_RELATIVE_PATH
    || !/^[a-f0-9]{64}$/.test(exposure.hash || '')
    || path.resolve(input.boundSkillPath || '')
      !== path.resolve(input.workspaceDir || '', ...CANDIDATE_RELATIVE_PATH.split('/'))) {
    return null;
  }
  return {
    method: exposure.method,
    relativePath: exposure.relativePath,
    hash: exposure.hash,
  };
}

function codexCandidateInstruction(exposure) {
  return [
    `Before selecting a scenario, first read ${exposure.relativePath} from the isolated current working directory.`,
    'Use only that relative path for Skill instructions; do not read any other Skill path or globally installed Skill.',
  ].join(' ');
}

function qoderVersion(status) {
  const candidates = Array.isArray(status && status.qodercli_candidates)
    ? status.qodercli_candidates : [];
  const loggedIn = candidates.find(function (candidate) {return candidate && candidate.logged_in === true;});
  const match = loggedIn && String(loggedIn.status || '').match(/Version:\s*([^\r\n]+)/);
  return match ? match[1].trim() : null;
}

function createQoderAdapter(options = {}) {
  const execute = options.spawnSync || spawnSync;
  const pythonCommand = options.pythonCommand || 'python3';
  const bridgePath = options.bridgePath || process.env.OPENYIDA_QODER_BRIDGE || DEFAULT_QODER_BRIDGE;

  function probe(env) {
    const result = execute(pythonCommand, [bridgePath, 'status'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30000,
      env: sanitizeAgentEnvironment(env),
    });
    if (!result || result.status !== 0) {
      return {
        available: false,
        loggedIn: false,
        source: 'qoder-bridge-status',
        errorCode: 'PROCESS_AGENT_QODER_CAPABILITY_BLOCKED',
      };
    }
    let status;
    try {
      status = JSON.parse(String(result.stdout || '').trim());
    } catch (_error) {
      return {
        available: false,
        loggedIn: false,
        source: 'qoder-bridge-status',
        errorCode: 'PROCESS_AGENT_QODER_CAPABILITY_INVALID',
      };
    }
    const candidates = Array.isArray(status.qodercli_candidates) ? status.qodercli_candidates : [];
    const loggedIn = candidates.some(function (candidate) {return candidate && candidate.logged_in === true;});
    const available = Boolean(status.preferred_qodercli) && loggedIn;
    return {
      available,
      loggedIn,
      source: 'qoder-bridge-status',
      version: qoderVersion(status),
      errorCode: available ? null : 'PROCESS_AGENT_QODER_CAPABILITY_BLOCKED',
    };
  }

  return {
    name: 'qoder',
    probe,
    run: async function runQoder(input = {}) {
      const capability = probe(input.env);
      if (!capability.available) {
        return {
          adapter: 'qoder',
          available: false,
          status: 'capability_blocked',
          executionSupported: true,
          capability,
          error: { code: capability.errorCode || 'PROCESS_AGENT_QODER_CAPABILITY_BLOCKED' },
        };
      }
      if (!input.runId || !input.prompt || !input.workspaceDir || !input.boundSkillPath) {
        return {
          adapter: 'qoder', available: true, status: 'failed', executionSupported: true,
          capability, error: { code: 'PROCESS_AGENT_QODER_INPUT_INVALID' },
        };
      }
      const candidateExposure = validAdapterExposure(input, 'bridge-add-file');
      if (!candidateExposure) {
        return {
          adapter: 'qoder', available: true, status: 'failed', executionSupported: true,
          capability, error: { code: 'PROCESS_AGENT_CANDIDATE_EXPOSURE_INVALID' },
        };
      }
      const promptPath = path.join(input.workspaceDir, 'agent-prompt.md');
      fs.writeFileSync(promptPath, input.prompt, 'utf8');
      const bridgeRunId = `${input.runId}_qoder`;
      const bridgeDir = path.join(input.workspaceDir, 'qoder-bridge');
      const args = [
        bridgePath,
        '--bridge-dir', bridgeDir,
        'send',
        '--transport', 'qodercli',
        '--artifact-profile', 'none',
        '--mode', 'agent',
        '--max-turns', '2',
        '--cwd', input.workspaceDir,
        '--add-file', input.boundSkillPath,
        '--run-id', bridgeRunId,
        '--prompt-file', promptPath,
      ];
      const result = execute(pythonCommand, args, {
        cwd: input.workspaceDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: input.timeoutMs || 180000,
        env: sanitizeAgentEnvironment(input.env),
      });
      if (!result || result.status !== 0) {
        return {
          adapter: 'qoder', available: true, status: 'failed', executionSupported: true,
          capability, error: { code: 'PROCESS_AGENT_QODER_EXECUTION_FAILED' },
        };
      }
      const envelope = parseJsonObject(
        result.stdout,
        'PROCESS_AGENT_QODER_ENVELOPE_INVALID',
        'Qoder bridge must emit exactly one JSON envelope'
      );
      if (envelope.run_id !== bridgeRunId || envelope.qoder_chat_exit_code !== 0) {
        return {
          adapter: 'qoder', available: true, status: 'failed', executionSupported: true,
          capability, error: { code: 'PROCESS_AGENT_QODER_EXECUTION_FAILED' },
        };
      }
      const summaryPath = path.join(bridgeDir, 'runs', bridgeRunId, 'summary.md');
      if (!fs.existsSync(summaryPath)) {
        return {
          adapter: 'qoder', available: true, status: 'failed', executionSupported: true,
          capability, error: { code: 'PROCESS_AGENT_QODER_OUTPUT_MISSING' },
        };
      }
      return {
        adapter: 'qoder',
        available: true,
        status: 'passed',
        executionSupported: true,
        capability,
        output: fs.readFileSync(summaryPath, 'utf8').trim(),
        guardrail: {
          permissionBypass: false,
          isolatedWorkspace: true,
          authEnvironmentStripped: true,
          candidateBinding: true,
          candidateExposure,
        },
      };
    },
  };
}

function createCodexAdapter(options = {}) {
  const execute = options.spawnSync || spawnSync;
  const command = options.command || 'codex';

  function runProbe(args, env) {
    return execute(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15000,
      env: sanitizeAgentEnvironment(env),
    });
  }

  function resultShape(result) {
    const stdout = result && result.stdout;
    return {
      exitCode: result && Number.isInteger(result.status) ? result.status : null,
      outputType: typeof stdout,
      nonEmpty: typeof stdout === 'string' && stdout.trim().length > 0,
    };
  }

  function probe(env) {
    const versionResult = runProbe(['--version'], env);
    const versionShape = resultShape(versionResult);
    if (versionShape.exitCode !== 0) {
      return {
        available: false,
        source: 'codex-version-exec-help-probe',
        probeShape: { version: versionShape, execution: null },
        errorCode: 'PROCESS_AGENT_CODEX_CAPABILITY_BLOCKED',
      };
    }
    const executionResult = runProbe(['exec', '--help'], env);
    const executionOutput = typeof executionResult.stdout === 'string'
      ? executionResult.stdout : '';
    const executionShape = {
      ...resultShape(executionResult),
      usageExec: /Usage:\s*codex exec\b/i.test(executionOutput),
      sandbox: /--sandbox\b/.test(executionOutput),
      outputLastMessage: /--output-last-message\b/.test(executionOutput),
      skipGitRepoCheck: /--skip-git-repo-check\b/.test(executionOutput),
    };
    const available = executionShape.exitCode === 0
      && executionShape.usageExec
      && executionShape.sandbox
      && executionShape.outputLastMessage
      && executionShape.skipGitRepoCheck;
    return {
      available,
      source: 'codex-version-exec-help-probe',
      probeShape: { version: versionShape, execution: executionShape },
      errorCode: available ? null : 'PROCESS_AGENT_CODEX_CAPABILITY_BLOCKED',
    };
  }

  return {
    name: 'codex',
    probe,
    run: async function runCodex(input = {}) {
      const capability = probe(input.env);
      if (!capability.available) {
        return {
          adapter: 'codex',
          available: false,
          status: 'capability_blocked',
          executionSupported: false,
          capability,
          error: { code: capability.errorCode || 'PROCESS_AGENT_CODEX_CAPABILITY_BLOCKED' },
        };
      }
      if (!input.runId || !input.prompt || !input.workspaceDir || !input.boundSkillPath) {
        return {
          adapter: 'codex', available: true, status: 'failed', executionSupported: true,
          capability, error: { code: 'PROCESS_AGENT_CODEX_INPUT_INVALID' },
        };
      }
      const candidateExposure = validAdapterExposure(input, 'cwd-relative-read');
      if (!candidateExposure) {
        return {
          adapter: 'codex', available: true, status: 'failed', executionSupported: true,
          capability, error: { code: 'PROCESS_AGENT_CANDIDATE_EXPOSURE_INVALID' },
        };
      }
      const exposureInstruction = codexCandidateInstruction(candidateExposure);
      const executionPrompt = input.prompt.includes(exposureInstruction)
        ? input.prompt : `${exposureInstruction}\n${input.prompt}`;
      const outputPath = path.join(input.workspaceDir, 'codex-last-message.json');
      const result = execute(command, [
        'exec',
        '--sandbox', 'read-only',
        '--cd', input.workspaceDir,
        '--skip-git-repo-check',
        '--color', 'never',
        '--output-last-message', outputPath,
        executionPrompt,
      ], {
        cwd: input.workspaceDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: input.timeoutMs || 180000,
        env: sanitizeAgentEnvironment(input.env),
      });
      if (!result || result.status !== 0) {
        return {
          adapter: 'codex', available: true, status: 'failed', executionSupported: true,
          capability, error: { code: 'PROCESS_AGENT_CODEX_EXECUTION_FAILED' },
        };
      }
      if (!fs.existsSync(outputPath)) {
        return {
          adapter: 'codex', available: true, status: 'failed', executionSupported: true,
          capability, error: { code: 'PROCESS_AGENT_CODEX_OUTPUT_MISSING' },
        };
      }
      return {
        adapter: 'codex',
        available: true,
        status: 'passed',
        executionSupported: true,
        capability,
        output: fs.readFileSync(outputPath, 'utf8').trim(),
        guardrail: {
          permissionBypass: false,
          isolatedWorkspace: true,
          authEnvironmentStripped: true,
          candidateBinding: true,
          candidateExposure,
        },
      };
    },
  };
}

function buildAgentPrompt(userPrompt, scenarioId, candidateHash, candidateExposure) {
  const exposureInstruction = candidateExposure.method === 'cwd-relative-read'
    ? codexCandidateInstruction(candidateExposure)
    : `The candidate Skill is exposed through the bridge add-file binding as ${candidateExposure.relativePath}.`;
  return [
    'You are evaluating the explicitly bound candidate OpenYida process Skill.',
    exposureInstruction,
    'Do not load or use any globally/user-installed Skill. Do not run shell, OpenYida CLI, network, or platform actions. Do not write files.',
    `Candidate content hash: ${candidateHash}`,
    `Supported frozen scenario: ${scenarioId}`,
    'Interpret the user request and return exactly one JSON object with no markdown and no extra fields:',
    `{"schemaVersion":1,"scenarioId":"${scenarioId}"}`,
    '',
    'User request:',
    userPrompt,
  ].join('\n');
}

function requireAgentGuardrail(result, expectedExposure) {
  const guardrail = result && result.guardrail;
  const exposure = guardrail && guardrail.candidateExposure;
  const exposureKeys = exposure && Object.keys(exposure).sort();
  if (!guardrail
    || guardrail.permissionBypass !== false
    || guardrail.isolatedWorkspace !== true
    || guardrail.authEnvironmentStripped !== true
    || guardrail.candidateBinding !== true) {
    throw agentError('PROCESS_AGENT_GUARDRAIL_FAILED', 'Agent execution guardrail evidence is incomplete');
  }
  if (!exposure
    || exposureKeys.join(',') !== 'hash,method,relativePath'
    || exposure.method !== expectedExposure.method
    || exposure.relativePath !== expectedExposure.relativePath
    || exposure.hash !== expectedExposure.hash) {
    throw agentError(
      'PROCESS_AGENT_CANDIDATE_EXPOSURE_INVALID',
      'Agent candidate exposure evidence is invalid'
    );
  }
  return {
    permissionBypass: false,
    isolatedWorkspace: true,
    authEnvironmentStripped: true,
    candidateBinding: true,
    candidateExposure: {
      method: exposure.method,
      relativePath: exposure.relativePath,
      hash: exposure.hash,
    },
    passed: true,
  };
}

function safeRelative(root, filePath) {
  const relative = path.relative(root, filePath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
    ? relative : path.basename(filePath);
}

function hasOperationProvenance(operation) {
  const evidence = operation && operation.evidenceSources;
  return operation
    && operation.action === 'AGREE'
    && typeof operation.rawAction === 'string'
    && operation.rawAction.length > 0
    && evidence
    && Array.isArray(evidence.operation) && evidence.operation.length > 0
    && Array.isArray(evidence.actor) && evidence.actor.length > 0
    && Array.isArray(evidence.node) && evidence.node.length > 0;
}

function verifyStandardEvidence(standardResult, options = {}) {
  if (!standardResult || !standardResult.runId || !standardResult.manifestPath) {
    throw agentError('PROCESS_AGENT_STANDARD_EVIDENCE_INVALID', 'standard runner result is incomplete');
  }
  const registryDir = path.resolve(options.registryDir || DEFAULT_REGISTRY_DIR);
  const manifestPath = path.resolve(standardResult.manifestPath);
  if (!isPathInside(registryDir, manifestPath)) {
    throw agentError(
      'PROCESS_AGENT_STANDARD_MANIFEST_SCOPE_INVALID',
      'standard manifest is outside the configured registry root'
    );
  }
  if (!fs.existsSync(manifestPath)) {
    throw agentError('PROCESS_AGENT_STANDARD_EVIDENCE_INVALID', 'standard manifest does not exist');
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (_error) {
    throw agentError('PROCESS_AGENT_STANDARD_EVIDENCE_INVALID', 'standard manifest is not valid JSON');
  }
  const standardRegistryPath = path.join(registryDir, `${standardResult.runId}.json`);
  let standardRegistry;
  try {
    standardRegistry = JSON.parse(fs.readFileSync(standardRegistryPath, 'utf8'));
  } catch (_error) {
    throw agentError(
      'PROCESS_AGENT_STANDARD_REGISTRY_INVALID',
      'standard manifest is not linked by a readable standard registry'
    );
  }
  const runtimeRun = Array.isArray(standardRegistry.runtimeRuns)
    ? standardRegistry.runtimeRuns.find(function (item) {return item && item.runId === standardResult.runId;})
    : null;
  if (standardRegistry.runId !== standardResult.runId
    || standardRegistry.status !== manifest.status
    || !runtimeRun
    || path.resolve(runtimeRun.manifestPath || '') !== manifestPath) {
    throw agentError(
      'PROCESS_AGENT_STANDARD_REGISTRY_INVALID',
      'standard registry/run/manifest linkage is inconsistent'
    );
  }
  const operations = manifest.runtimeVerification && manifest.runtimeVerification.operationSequence;
  const valid = manifest.runId === standardResult.runId
    && ['passed', 'cleanup_blocked'].includes(manifest.status)
    && manifest.error === null
    && manifest.contractVerification
    && manifest.contractVerification.verificationLevel === 'CONTRACT_VERIFIED'
    && manifest.contractVerification.valid === true
    && manifest.platformViewVerification
    && manifest.platformViewVerification.verificationLevel === 'PLATFORM_VIEW_VERIFIED'
    && manifest.platformViewVerification.valid === true
    && manifest.runtimeVerification
    && manifest.runtimeVerification.verificationLevel === 'RUNTIME_VERIFIED'
    && manifest.runtimeVerification.valid === true
    && manifest.runtimeVerification.finalStatus === 'COMPLETED'
    && Array.isArray(operations)
    && operations.length > 0
    && operations.every(hasOperationProvenance)
    && manifest.profileRestore
    && manifest.profileRestore.passed === true;
  if (!valid) {
    throw agentError(
      'PROCESS_AGENT_STANDARD_EVIDENCE_INVALID',
      'standard manifest did not satisfy contract/platform/runtime/restore gates'
    );
  }
  const manifestText = fs.readFileSync(manifestPath, 'utf8');
  const sensitiveValues = (options.sensitiveValues || []).filter(function (value) {
    return typeof value === 'string' && value.length >= 8;
  });
  if (sensitiveValues.some(function (value) {return manifestText.includes(value);})) {
    throw agentError(
      'PROCESS_AGENT_STANDARD_EVIDENCE_SENSITIVE',
      'standard manifest contains a configured sensitive value'
    );
  }
  return {
    runId: manifest.runId,
    status: manifest.status,
    manifestPath: safeRelative(ROOT, manifestPath),
    manifestHash: sha256(manifestText),
    registryHash: sha256(fs.readFileSync(standardRegistryPath)),
    contractVerified: true,
    platformViewVerified: true,
    runtimeVerified: true,
    finalStatus: 'COMPLETED',
    profileRestorePassed: true,
    operationCount: operations.length,
    operationProvenanceComplete: true,
    cleanupStatus: manifest.cleanup && manifest.cleanup.status || manifest.status,
    residualCount: manifest.cleanup && Array.isArray(manifest.cleanup.residual)
      ? manifest.cleanup.residual.length : 0,
  };
}

function observeStandardCleanup(standardResult, registryDir) {
  if (!standardResult || !standardResult.manifestPath) {return null;}
  const root = path.resolve(registryDir || DEFAULT_REGISTRY_DIR);
  const manifestPath = path.resolve(standardResult.manifestPath);
  if (!isPathInside(root, manifestPath) || !fs.existsSync(manifestPath)) {return null;}
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const cleanup = manifest && manifest.cleanup;
    return {
      status: cleanup && cleanup.status || null,
      residualCount: cleanup && Array.isArray(cleanup.residual) ? cleanup.residual.length : 0,
    };
  } catch (_error) {
    return null;
  }
}

function safeAdapterResult(result) {
  if (!result) {return null;}
  return {
    adapter: result.adapter || null,
    available: result.available === true,
    status: result.status || 'failed',
    executionSupported: result.executionSupported === true,
    capability: result.capability ? {
      available: result.capability.available === true,
      loggedIn: result.capability.loggedIn === true,
      source: result.capability.source || null,
      version: result.capability.version || null,
      probeShape: result.capability.probeShape ? {
        version: result.capability.probeShape.version || null,
        execution: result.capability.probeShape.execution || null,
      } : null,
    } : null,
    error: result.error && result.error.code ? { code: result.error.code } : null,
  };
}

function redactMessage(message, sensitiveValues = []) {
  let result = String(message || 'process Agent run failed');
  sensitiveValues.filter(Boolean).sort(function (left, right) {
    return String(right).length - String(left).length;
  }).forEach(function (value) {
    result = result.split(String(value)).join('<redacted>');
  });
  return result;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return filePath;
}

async function run(options = {}) {
  const env = options.env || process.env;
  const config = options.config || getConfig(env);
  if (!config.enabled) {
    return { skipped: true, status: 'skipped', missing: config.missing || [] };
  }
  if (!['qoder', 'codex'].includes(config.adapter)) {
    throw agentError('PROCESS_AGENT_ADAPTER_INVALID', `unsupported process Agent adapter: ${config.adapter}`);
  }
  const runId = config.runId || createAgentRunId();
  const namePrefix = config.namePrefix || `${runId}__`;
  const registryDir = config.registryDir || DEFAULT_REGISTRY_DIR;
  const workDir = options.workDir || path.join(registryDir, runId);
  const isolatedWorkspace = path.join(workDir, 'isolated-workspace');
  const boundCandidatePath = path.join(isolatedWorkspace, 'candidate-skill');
  const registryInfo = (options.createRegistry || createRegistry)({
    prefix: runId, registryDir, corpId: null,
  });
  const registry = registryInfo.registry;
  const registryPath = registryInfo.registryPath;
  const persistRegistry = options.writeRegistry || writeRegistry;
  const trackResource = options.addResource || addResource;
  const sensitiveValues = (options.sensitiveValues || []).filter(Boolean);
  const state = {
    runId,
    status: 'failed',
    adapter: config.adapter,
    scenarioId: config.scenarioId,
    promptHash: sha256(config.prompt),
    adapterResult: null,
    guardrails: [],
    candidateBinding: null,
    standardEvidence: null,
    agentVerification: {
      verificationLevel: 'AGENT_VERIFIED', valid: false, errors: [],
    },
    cleanup: null,
    privacy: null,
    error: null,
  };
  registry.agentRuns = [state];
  persistRegistry(registryPath, registry);
  const adapter = options.adapter || (config.adapter === 'qoder'
    ? createQoderAdapter(options.qoderAdapterOptions)
    : createCodexAdapter(options.codexAdapterOptions));
  let primaryError = null;
  let standardCleanupStatus = null;
  let standardResidualCount = 0;
  let sourceCandidatePath = null;
  let sourceCandidateHash = null;
  let standardResultRef = null;

  try {
    if (!adapter || adapter.name !== config.adapter || typeof adapter.run !== 'function') {
      throw agentError('PROCESS_AGENT_ADAPTER_INVALID', 'configured process Agent adapter does not match');
    }
    if (!config.prompt) {
      throw agentError('PROCESS_AGENT_PROMPT_REQUIRED', 'process Agent prompt is required');
    }
    sourceCandidatePath = path.resolve(config.candidateSkillPath || '');
    const sourceHash = hashTree(sourceCandidatePath);
    sourceCandidateHash = sourceHash;
    fs.mkdirSync(isolatedWorkspace, { recursive: true });
    fs.cpSync(sourceCandidatePath, boundCandidatePath, { recursive: true, errorOnExist: true });
    const boundHashBefore = hashTree(boundCandidatePath);
    if (sourceHash !== boundHashBefore) {
      throw agentError('PROCESS_AGENT_CANDIDATE_BINDING_FAILED', 'candidate Skill copy hash mismatch');
    }
    trackResource(registry, registryPath, {
      runId,
      owned: true,
      type: 'local-artifact',
      exactId: isolatedWorkspace,
      path: isolatedWorkspace,
      name: `${namePrefix}isolated-workspace`,
    });
    state.candidateBinding = {
      sourceHash,
      boundHashBefore,
      boundHashAfter: null,
      unchanged: false,
      isolated: true,
      installedSkillLoading: 'forbidden',
    };
    const candidateExposure = candidateExposureFor(config.adapter, sourceHash);
    const prompt = buildAgentPrompt(
      config.prompt,
      config.scenarioId,
      sourceHash,
      candidateExposure
    );
    registry.commands.push({
      name: `${config.adapter}-agent-prompt`, actor: config.adapter.toUpperCase(),
      sideEffect: 'agent-local-readonly',
      status: 'started', recordedAt: new Date().toISOString(),
    });
    persistRegistry(registryPath, registry);
    const agentResult = await adapter.run({
      runId,
      prompt,
      workspaceDir: isolatedWorkspace,
      boundSkillPath: path.join(boundCandidatePath, 'SKILL.md'),
      boundCandidatePath,
      candidateExposure,
      env,
    });
    registry.commands[registry.commands.length - 1].status = agentResult && agentResult.status || 'failed';
    persistRegistry(registryPath, registry);
    state.adapterResult = safeAdapterResult(agentResult);
    if (!agentResult || agentResult.status === 'capability_blocked' || agentResult.available === false) {
      throw agentError(
        agentResult && agentResult.error && agentResult.error.code
            || `PROCESS_AGENT_${config.adapter.toUpperCase()}_CAPABILITY_BLOCKED`,
        `${config.adapter} capability is unavailable`
      );
    }
    if (agentResult.status !== 'passed') {
      throw agentError(
        agentResult.error && agentResult.error.code
            || `PROCESS_AGENT_${config.adapter.toUpperCase()}_EXECUTION_FAILED`,
        `${config.adapter} Agent execution did not complete`
      );
    }
    state.guardrails = [requireAgentGuardrail(agentResult, candidateExposure)];
    const selection = parseAgentSelection(agentResult.output);
    if (selection.scenarioId !== config.scenarioId) {
      throw agentError(
        'PROCESS_AGENT_SCENARIO_MISMATCH',
        'Agent-selected scenario does not match the approved scenario'
      );
    }
    const sourceHashAfter = hashTree(sourceCandidatePath);
    const boundHashAfter = hashTree(boundCandidatePath);
    state.candidateBinding.boundHashAfter = boundHashAfter;
    state.candidateBinding.unchanged = sourceHashAfter === sourceHash
        && boundHashAfter === boundHashBefore;
    if (!state.candidateBinding.unchanged) {
      throw agentError('PROCESS_AGENT_CANDIDATE_MUTATED', 'candidate Skill hash changed during Agent execution');
    }
    const standardRunner = options.standardRunner || async function executeStandard(input) {
      return runProcessRuntime({
        ...(options.standardRunOptions || {}),
        env: input.env,
      });
    };
    standardResultRef = await standardRunner({
      env: { ...env, OPENYIDA_E2E_PROCESS_SCENARIO: selection.scenarioId },
      scenarioId: selection.scenarioId,
      parentRunId: runId,
    });
    const observedCleanup = observeStandardCleanup(standardResultRef, registryDir);
    standardCleanupStatus = observedCleanup && observedCleanup.status;
    standardResidualCount = observedCleanup && observedCleanup.residualCount || 0;
    state.standardEvidence = verifyStandardEvidence(standardResultRef, {
      registryDir,
      sensitiveValues,
    });
    standardCleanupStatus = state.standardEvidence.cleanupStatus;
    standardResidualCount = state.standardEvidence.residualCount;
    state.agentVerification = {
      verificationLevel: 'AGENT_VERIFIED',
      valid: true,
      errors: [],
      evidenceSources: [
        `${config.adapter}.strict-scenario-selection`,
        `${config.adapter}.candidate-exposure.${candidateExposure.method}`,
        'candidate-skill.hash-before-after',
        'standard-manifest.CONTRACT_VERIFIED',
        'standard-manifest.PLATFORM_VIEW_VERIFIED',
        'standard-manifest.RUNTIME_VERIFIED',
      ],
    };
    state.status = standardCleanupStatus === 'cleanup_blocked' ? 'cleanup_blocked' : 'passed';
  } catch (error) {
    primaryError = error;
    if (!standardResultRef && error && error.runtimeResult) {
      standardResultRef = error.runtimeResult;
      const observedCleanup = observeStandardCleanup(standardResultRef, registryDir);
      standardCleanupStatus = observedCleanup && observedCleanup.status;
      standardResidualCount = observedCleanup && observedCleanup.residualCount || 0;
    }
    state.status = (state.adapterResult && state.adapterResult.status === 'capability_blocked')
      || String(error.code || '').includes('CAPABILITY_BLOCKED')
      ? 'capability_blocked' : 'failed';
    state.error = {
      code: error.code || 'PROCESS_AGENT_FAILED',
      message: redactMessage(error.message, sensitiveValues),
    };
    state.agentVerification.errors = [{ code: state.error.code }];
  } finally {
    if (state.candidateBinding && fs.existsSync(boundCandidatePath)) {
      state.candidateBinding.boundHashAfter = hashTree(boundCandidatePath);
      const sourceUnchanged = Boolean(sourceCandidatePath && fs.existsSync(sourceCandidatePath))
        && hashTree(sourceCandidatePath) === sourceCandidateHash;
      state.candidateBinding.unchanged = sourceUnchanged
        && state.candidateBinding.boundHashAfter === state.candidateBinding.boundHashBefore;
    }
    const localCleanup = cleanupOwnedResources({
      registry,
      runId,
      namePrefix,
      localRoot: workDir,
      removePath: options.removePath,
    });
    const cleanupStatus = localCleanup.status === 'cleanup_blocked'
      || standardCleanupStatus === 'cleanup_blocked'
      ? 'cleanup_blocked' : 'passed';
    state.cleanup = {
      status: cleanupStatus,
      agentLocalStatus: localCleanup.status,
      localRemovedCount: localCleanup.removed.length,
      standardStatus: standardCleanupStatus,
      standardResidualCount,
    };
    if (!primaryError && state.status === 'passed' && cleanupStatus === 'cleanup_blocked') {
      state.status = 'cleanup_blocked';
    }
    if (!ALLOWED_STATUSES.has(state.status)) {state.status = 'failed';}
    let manifest = {
      schemaVersion: 1,
      runId,
      status: state.status,
      adapter: state.adapter,
      scenarioId: state.scenarioId,
      promptHash: state.promptHash,
      adapterResult: state.adapterResult,
      guardrails: state.guardrails,
      candidateBinding: state.candidateBinding,
      standardEvidence: state.standardEvidence,
      agentVerification: state.agentVerification,
      cleanup: state.cleanup,
      error: state.error,
    };
    let manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
    const leaked = sensitiveValues.filter(function (value) {
      return String(value).length >= 8 && manifestText.includes(String(value));
    });
    state.privacy = { passed: leaked.length === 0, leakedValueCount: leaked.length };
    manifest.privacy = state.privacy;
    if (leaked.length > 0) {
      manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
      leaked.forEach(function (value) {
        manifestText = manifestText.split(String(value)).join('<redacted>');
      });
      manifest = JSON.parse(manifestText);
      manifest.status = 'failed';
      manifest.error = { code: 'PROCESS_AGENT_PUBLIC_ARTIFACT_SENSITIVE' };
      state.status = 'failed';
      state.error = manifest.error;
    }
    const manifestPath = path.join(workDir, 'acceptance-manifest.json');
    writeJson(manifestPath, manifest);
    state.manifestPath = manifestPath;
    registry.status = state.status;
    registry.finishedAt = new Date().toISOString();
    persistRegistry(registryPath, registry);
  }

  return {
    skipped: false,
    status: state.status,
    runId,
    adapter: state.adapter,
    adapterResult: state.adapterResult,
    candidateBinding: state.candidateBinding,
    standardEvidence: state.standardEvidence,
    agentVerification: state.agentVerification,
    cleanup: state.cleanup,
    privacy: state.privacy,
    error: state.error,
    manifestPath: state.manifestPath,
    registryPath,
  };
}

if (require.main === module) {
  run().then(function (result) {
    console.log(JSON.stringify(result));
    if (result.status === 'failed' || result.status === 'capability_blocked') {
      process.exitCode = 1;
    }
  }).catch(function (error) {
    console.error(error.code || 'PROCESS_AGENT_FAILED');
    process.exitCode = 1;
  });
}

module.exports = {
  ALLOWED_STATUSES,
  createAgentRunId,
  createCodexAdapter,
  createQoderAdapter,
  getConfig,
  hashTree,
  parseAgentSelection,
  run,
  sanitizeAgentEnvironment,
  verifyStandardEvidence,
};
