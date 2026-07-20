'use strict';

/**
 * Unified three-tier judge system for OpenYida evaluations.
 *
 * Ported from skill-up's judge architecture (Go → CommonJS).
 *
 * Three judge types:
 *   rule_based  — deterministic assertions (zero LLM cost, instant)
 *   script      — custom evaluation scripts
 *   agent_judge — LLM-as-judge (powerful but expensive)
 *
 * Eight rule_based assertion types:
 *   output_contains (all/any/not), exit_code, tool_called, files_exist,
 *   files_not_exist, command_sequence, output_matches, custom_fn
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// ---------------------------------------------------------------------------
// Status constants
// ---------------------------------------------------------------------------

const STATUS_PASS = 'PASS';
const STATUS_FAIL = 'FAIL';
const STATUS_SKIP = 'SKIP';
const STATUS_ERROR = 'ERROR';

// ---------------------------------------------------------------------------
// Result builders
// ---------------------------------------------------------------------------

function buildResult(assertions, turnsExecuted, turnsTotal) {
  turnsExecuted = turnsExecuted || 0;
  turnsTotal = turnsTotal || 0;

  if (!assertions || assertions.length === 0) {
    return {
      status: STATUS_PASS,
      assertions: [],
      summary: { passed: 0, failed: 0, total: 0, passRate: 1.0 },
      turnsExecuted: turnsExecuted,
      turnsTotal: turnsTotal,
    };
  }

  let passed = 0;
  let failed = 0;
  for (let i = 0; i < assertions.length; i++) {
    if (assertions[i].passed) { passed++; } else { failed++; }
  }
  const total = passed + failed;
  const passRate = total > 0 ? passed / total : 1.0;

  return {
    status: failed > 0 ? STATUS_FAIL : STATUS_PASS,
    assertions: assertions,
    summary: { passed: passed, failed: failed, total: total, passRate: passRate },
    turnsExecuted: turnsExecuted,
    turnsTotal: turnsTotal,
  };
}

function buildSkipResult(reason) {
  return {
    status: STATUS_SKIP,
    skipReason: reason,
    assertions: [],
    summary: { passed: 0, failed: 0, total: 0, passRate: 0 },
    turnsExecuted: 0,
    turnsTotal: 0,
  };
}

function buildErrorResult(error) {
  return {
    status: STATUS_ERROR,
    errorReason: typeof error === 'string' ? error : (error && error.message) || 'unknown',
    assertions: [],
    summary: { passed: 0, failed: 0, total: 0, passRate: 0 },
    turnsExecuted: 0,
    turnsTotal: 0,
  };
}

// ---------------------------------------------------------------------------
// Assertion result helper
// ---------------------------------------------------------------------------

function assertion(text, passed, evidence) {
  return { text: text, passed: !!passed, evidence: evidence || '' };
}

// ---------------------------------------------------------------------------
// Rule-based assertion evaluators
// ---------------------------------------------------------------------------

function evalOutputContains(rule, finalMessage) {
  const msg = finalMessage || '';

  // all: every keyword must be present
  if (rule.all && rule.all.length > 0) {
    const missing = [];
    for (let i = 0; i < rule.all.length; i++) {
      if (msg.indexOf(rule.all[i]) === -1) { missing.push(rule.all[i]); }
    }
    if (missing.length > 0) {
      return assertion(
        'output_contains.all: missing ' + JSON.stringify(missing),
        false,
        'output does not contain required keywords: ' + JSON.stringify(missing)
      );
    }
  }

  // any: at least one keyword must be present
  if (rule.any && rule.any.length > 0) {
    let found = false;
    for (let j = 0; j < rule.any.length; j++) {
      if (msg.indexOf(rule.any[j]) !== -1) { found = true; break; }
    }
    if (!found) {
      return assertion(
        'output_contains.any: ' + JSON.stringify(rule.any),
        false,
        'output does not contain any of ' + JSON.stringify(rule.any)
      );
    }
  }

  // not: none of the keywords should be present
  if (rule.not && rule.not.length > 0) {
    for (let k = 0; k < rule.not.length; k++) {
      if (msg.indexOf(rule.not[k]) !== -1) {
        return assertion(
          'output_contains.not: "' + rule.not[k] + '"',
          false,
          'output contains forbidden keyword "' + rule.not[k] + '"'
        );
      }
    }
  }

  let desc = 'output_contains';
  const parts = [];
  if (rule.all && rule.all.length) { parts.push('all:' + JSON.stringify(rule.all)); }
  if (rule.any && rule.any.length) { parts.push('any:' + JSON.stringify(rule.any)); }
  if (rule.not && rule.not.length) { parts.push('not:' + JSON.stringify(rule.not)); }
  if (parts.length > 0) { desc += '{' + parts.join(', ') + '}'; }

  return assertion(desc, true, 'output satisfies all contains checks');
}

function evalExitCode(expected, actual) {
  if (actual === expected) {
    return assertion('exit_code: ' + expected, true, 'exit_code is ' + actual + ' as expected');
  }
  return assertion('exit_code: ' + expected, false, 'expected exit_code ' + expected + ', got ' + actual);
}

function evalToolCalled(rule, toolCalls) {
  const calls = toolCalls || [];
  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    if (call.name !== rule.name) { continue; }

    if (!rule.args || Object.keys(rule.args).length === 0) {
      return assertion('tool_called: ' + rule.name, true, 'tool "' + rule.name + '" was called');
    }

    if (argsMatch(rule.args, call.args || {})) {
      return assertion('tool_called: ' + rule.name + ' (with args)', true,
        'tool "' + rule.name + '" was called with matching args');
    }
  }

  let evidence = 'tool "' + rule.name + '" was not called';
  if (rule.args && Object.keys(rule.args).length > 0) {
    evidence += ' with matching args';
  }
  return assertion('tool_called: ' + rule.name, false, evidence);
}

function evalFilesExist(files, workspacePath) {
  if (!workspacePath) {
    return assertion('files_exist', false, 'no workspace path provided');
  }
  for (let i = 0; i < files.length; i++) {
    const fullPath = path.resolve(workspacePath, files[i]);
    if (!fullPath.startsWith(path.resolve(workspacePath))) {
      return assertion('files_exist: ' + files[i], false, 'path escapes workspace: ' + files[i]);
    }
    if (!fs.existsSync(fullPath)) {
      return assertion('files_exist: ' + files[i], false, 'expected file "' + files[i] + '" does not exist');
    }
  }
  return assertion('files_exist: ' + JSON.stringify(files), true, 'all required files exist');
}

function evalFilesNotExist(files, workspacePath) {
  if (!workspacePath) {
    return assertion('files_not_exist', true, 'no workspace path (vacuously true)');
  }
  for (let i = 0; i < files.length; i++) {
    const fullPath = path.resolve(workspacePath, files[i]);
    if (!fullPath.startsWith(path.resolve(workspacePath))) {
      return assertion('files_not_exist: ' + files[i], false, 'path escapes workspace: ' + files[i]);
    }
    if (fs.existsSync(fullPath)) {
      return assertion('files_not_exist: ' + files[i], false, 'file "' + files[i] + '" should not exist but does');
    }
  }
  return assertion('files_not_exist: ' + JSON.stringify(files), true, 'none of the forbidden files exist');
}

function evalCommandSequence(patterns, commands) {
  const cmds = commands || [];
  let patternIdx = 0;
  for (let i = 0; i < cmds.length && patternIdx < patterns.length; i++) {
    const cmdStr = Array.isArray(cmds[i]) ? cmds[i].join(' ') : String(cmds[i]);
    const re = new RegExp(patterns[patternIdx]);
    if (re.test(cmdStr)) { patternIdx++; }
  }
  if (patternIdx >= patterns.length) {
    return assertion('command_sequence: all ' + patterns.length + ' steps matched', true,
      'all required command patterns were found in order');
  }
  return assertion('command_sequence: matched ' + patternIdx + '/' + patterns.length, false,
    'missing pattern: ' + patterns[patternIdx]);
}

function evalOutputMatches(pattern, finalMessage) {
  const msg = finalMessage || '';
  const re = new RegExp(pattern);
  if (re.test(msg)) {
    return assertion('output_matches: /' + pattern + '/', true, 'output matches pattern');
  }
  return assertion('output_matches: /' + pattern + '/', false, 'output does not match pattern');
}

// ---------------------------------------------------------------------------
// Argument partial matching (from skill-up)
// ---------------------------------------------------------------------------

function argsMatch(expected, actual) {
  const keys = Object.keys(expected);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (!(k in actual)) { return false; }
    if (String(expected[k]) !== String(actual[k])) { return false; }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Single rule dispatcher
// ---------------------------------------------------------------------------

function evaluateRule(rule, input) {
  if (rule.output_contains) {
    return evalOutputContains(rule.output_contains, input.finalMessage);
  }
  if (rule.exit_code !== undefined && rule.exit_code !== null) {
    return evalExitCode(rule.exit_code, input.exitCode || 0);
  }
  if (rule.tool_called) {
    return evalToolCalled(rule.tool_called, input.toolCalls);
  }
  if (rule.files_exist) {
    return evalFilesExist(rule.files_exist, input.workspacePath);
  }
  if (rule.files_not_exist) {
    return evalFilesNotExist(rule.files_not_exist, input.workspacePath);
  }
  if (rule.command_sequence) {
    return evalCommandSequence(rule.command_sequence, input.commands);
  }
  if (rule.output_matches) {
    return evalOutputMatches(rule.output_matches, input.finalMessage);
  }
  if (typeof rule.custom_fn === 'function') {
    try {
      const result = rule.custom_fn(input);
      return assertion('custom_fn', !!result.passed, result.evidence || '');
    } catch (err) {
      return assertion('custom_fn', false, 'custom function threw: ' + err.message);
    }
  }
  return assertion('unknown_rule', false, 'no recognizable rule field');
}

// ---------------------------------------------------------------------------
// Rule-based judge
// ---------------------------------------------------------------------------

function ruleBasedEvaluate(judgeConfig, input) {
  const allAssertions = [];

  // 1. Failure rules first — any match is immediate FAIL
  const failureRules = judgeConfig.failure || [];
  for (let i = 0; i < failureRules.length; i++) {
    const ar = evaluateRule(failureRules[i], input);
    if (ar.passed) {
      allAssertions.push(assertion('failure: ' + ar.text, false, 'failure rule matched: ' + ar.evidence));
    }
  }
  if (allAssertions.length > 0) {
    return buildResult(allAssertions, input.turnsExecuted, input.turnsTotal);
  }

  // 2. Success rules — all must pass
  const successRules = judgeConfig.success || [];
  for (let j = 0; j < successRules.length; j++) {
    allAssertions.push(evaluateRule(successRules[j], input));
  }

  return buildResult(allAssertions, input.turnsExecuted, input.turnsTotal);
}

// ---------------------------------------------------------------------------
// Script judge
// ---------------------------------------------------------------------------

function scriptEvaluate(judgeConfig, input) {
  const scriptPath = judgeConfig.script_path;
  if (!scriptPath) {
    return buildErrorResult('script judge requires script_path');
  }

  if (!fs.existsSync(scriptPath)) {
    return buildErrorResult('judge script not found: ' + scriptPath);
  }

  const timeout = (judgeConfig.timeout_seconds || 60) * 1000;
  const inputJson = JSON.stringify({
    caseId: input.caseId,
    finalMessage: input.finalMessage,
    exitCode: input.exitCode,
    workspacePath: input.workspacePath,
    commands: input.commands,
    toolCalls: input.toolCalls,
  });

  try {
    const result = spawnSync('node', [scriptPath], {
      input: inputJson,
      encoding: 'utf8',
      timeout: timeout,
      cwd: input.workspacePath || process.cwd(),
    });

    if (result.error) {
      return buildErrorResult('script execution failed: ' + result.error.message);
    }

    let output;
    try {
      output = JSON.parse(result.stdout);
    } catch (_e) {
      return buildErrorResult('script output is not valid JSON: ' + (result.stdout || '').slice(0, 200));
    }

    let assertions = [];
    if (Array.isArray(output.assertions)) {
      assertions = output.assertions.map(function (a) {
        return assertion(a.text || 'script assertion', !!a.passed, a.evidence || '');
      });
    } else if (typeof output.passed === 'boolean') {
      assertions = [assertion('script verdict', output.passed, output.evidence || '')];
    }

    return buildResult(assertions, input.turnsExecuted, input.turnsTotal);
  } catch (err) {
    return buildErrorResult('script judge error: ' + err.message);
  }
}

// ---------------------------------------------------------------------------
// Agent judge (LLM-as-judge)
// ---------------------------------------------------------------------------

function agentJudgeEvaluate(judgeConfig, input, agentRunner) {
  if (!agentRunner || typeof agentRunner !== 'function') {
    return buildErrorResult('agent_judge requires an agentRunner function');
  }

  const criteria = judgeConfig.criteria || 'Evaluate whether the output correctly fulfills the task.';
  const passThreshold = judgeConfig.pass_threshold || 0.6;

  const prompt = [
    'You are an evaluation judge. Evaluate the following agent output against the criteria below.',
    '',
    '## Criteria',
    criteria,
    '',
    '## Agent Output',
    (input.finalMessage || '(no output)').slice(0, 8000),
    '',
    '## Instructions',
    'Return a JSON object with this structure:',
    '{"assertions": [{"text": "description", "passed": true/false, "evidence": "explanation"}]}',
    '',
    'Each assertion should test one aspect of the criteria.',
    'Be strict but fair. Output only the JSON object.',
  ].join('\n');

  const agentResult = agentRunner({ prompt: prompt });

  if (!agentResult || !agentResult.available) {
    return buildErrorResult('agent_judge: agent CLI not available');
  }
  if (!agentResult.ok) {
    return buildErrorResult('agent_judge: agent error: ' + (agentResult.error || 'unknown'));
  }

  let parsed = agentResult.json;
  if (!parsed) {
    // try to extract JSON from text
    try {
      const match = (agentResult.text || '').match(/\{[\s\S]*\}/);
      if (match) { parsed = JSON.parse(match[0]); }
    } catch (_e) { /* ignore */ }
  }

  if (!parsed || !Array.isArray(parsed.assertions)) {
    return buildErrorResult('agent_judge: could not parse judge response');
  }

  const assertions = parsed.assertions.map(function (a) {
    return assertion(a.text || 'judge criterion', !!a.passed, a.evidence || '');
  });

  const result = buildResult(assertions, input.turnsExecuted, input.turnsTotal);

  // Apply pass threshold
  if (result.summary.passRate < passThreshold && result.status === STATUS_PASS) {
    result.status = STATUS_FAIL;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Judge factory
// ---------------------------------------------------------------------------

function mergeJudgeConfig(globalConfig, caseConfig) {
  if (!caseConfig || !caseConfig.type) {
    return globalConfig || {};
  }
  const merged = Object.assign({}, caseConfig);
  const g = globalConfig || {};
  if (!merged.model && g.model) { merged.model = g.model; }
  if (merged.pass_threshold === undefined && g.pass_threshold !== undefined) {
    merged.pass_threshold = g.pass_threshold;
  }
  if (merged.timeout_seconds === undefined && g.timeout_seconds !== undefined) {
    merged.timeout_seconds = g.timeout_seconds;
  }
  return merged;
}

function createJudge(judgeConfig, agentRunner) {
  const cfg = judgeConfig || {};
  const type = cfg.type || 'rule_based';

  return {
    type: type,
    config: cfg,

    evaluate: function (input) {
      switch (type) {
        case 'rule_based':
          return ruleBasedEvaluate(cfg, input);
        case 'script':
          return scriptEvaluate(cfg, input);
        case 'agent_judge':
          return agentJudgeEvaluate(cfg, input, agentRunner);
        default:
          return buildErrorResult('unknown judge type: ' + type);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  STATUS_PASS: STATUS_PASS,
  STATUS_FAIL: STATUS_FAIL,
  STATUS_SKIP: STATUS_SKIP,
  STATUS_ERROR: STATUS_ERROR,

  buildResult: buildResult,
  buildSkipResult: buildSkipResult,
  buildErrorResult: buildErrorResult,
  assertion: assertion,

  evaluateRule: evaluateRule,
  ruleBasedEvaluate: ruleBasedEvaluate,
  scriptEvaluate: scriptEvaluate,
  agentJudgeEvaluate: agentJudgeEvaluate,

  mergeJudgeConfig: mergeJudgeConfig,
  createJudge: createJudge,

  // Individual evaluators exposed for direct use
  evalOutputContains: evalOutputContains,
  evalExitCode: evalExitCode,
  evalToolCalled: evalToolCalled,
  evalFilesExist: evalFilesExist,
  evalFilesNotExist: evalFilesNotExist,
  evalCommandSequence: evalCommandSequence,
  evalOutputMatches: evalOutputMatches,
};
