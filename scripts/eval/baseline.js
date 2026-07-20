'use strict';

/**
 * A/B Baseline comparison engine for OpenYida skill evaluation.
 *
 * Core concept ported from skill-up's benchmark architecture:
 *   - Run each case TWICE: once with Skill installed, once without
 *   - Compute per-dimension delta to quantify Skill value
 *   - Generate benchmark.json with with_skill / without_skill / delta
 *
 * This is the key mechanism for "每次迭代可验证" — every Skill iteration
 * produces a measurable, comparable delta against a no-Skill baseline.
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Peer module imports (defensive)
// ---------------------------------------------------------------------------

let judge;
try { judge = require('./judge'); } catch (_e) { judge = null; }

let yamlLoader;
try { yamlLoader = require('./yaml-loader'); } catch (_e) { yamlLoader = null; }

let comprehensive;
try { comprehensive = require('./comprehensive'); } catch (_e) { comprehensive = null; }

let agentModule;
try { agentModule = require('./agent'); } catch (_e) { agentModule = null; }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..', '..');
const WORKSPACE_DIR = path.join(ROOT, 'project', '.cache', 'eval', 'baseline');

const CONFIG_WITH_SKILL = 'with_skill';
const CONFIG_WITHOUT_SKILL = 'without_skill';

// ---------------------------------------------------------------------------
// Statistics helpers (ported from skill-up benchmark.go)
// ---------------------------------------------------------------------------

function mean(values) {
  if (!values || values.length === 0) { return 0; }
  let sum = 0;
  for (let i = 0; i < values.length; i++) { sum += values[i]; }
  return sum / values.length;
}

function stdDev(values) {
  if (!values || values.length < 2) { return 0; }
  const avg = mean(values);
  let sumSq = 0;
  for (let i = 0; i < values.length; i++) {
    const d = values[i] - avg;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / values.length);
}

function statValue(values) {
  if (!values || values.length === 0) {
    return { mean: 0, stddev: 0, min: 0, max: 0 };
  }
  const sorted = values.slice().sort(function (a, b) { return a - b; });
  return {
    mean: +mean(values).toFixed(4),
    stddev: +stdDev(values).toFixed(4),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

// ---------------------------------------------------------------------------
// Iteration workspace management (ported from skill-up runner.go)
// ---------------------------------------------------------------------------

function nextIterationNumber(workspaceDir) {
  if (!fs.existsSync(workspaceDir)) { return 1; }
  let entries;
  try {
    entries = fs.readdirSync(workspaceDir, { withFileTypes: true });
  } catch (_e) {
    return 1;
  }

  let maxIter = 0;
  for (let i = 0; i < entries.length; i++) {
    if (!entries[i].isDirectory()) { continue; }
    const match = entries[i].name.match(/^iteration-(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxIter) { maxIter = n; }
    }
  }
  return maxIter + 1;
}

function createIterationWorkspace(baseDir, skillName, iterationNum) {
  const wsDir = path.join(baseDir, skillName + '-workspace');
  const iterDir = path.join(wsDir, 'iteration-' + iterationNum);
  fs.mkdirSync(iterDir, { recursive: true });
  return { workspaceDir: wsDir, iterationDir: iterDir };
}

function ensureCaseDir(iterDir, caseId, configName) {
  const caseDir = path.join(iterDir, caseId, configName);
  fs.mkdirSync(caseDir, { recursive: true });
  return caseDir;
}

// ---------------------------------------------------------------------------
// Single case executor
// ---------------------------------------------------------------------------

function executeCase(evalCase, options) {
  const opts = options || {};
  const runAgent = opts.runAgent;
  const skillEnabled = opts.skillEnabled !== false;
  const skillContext = opts.skillContext || '';
  const judgeConfig = opts.judgeConfig || { type: 'rule_based' };
  const caseJudge = evalCase.judge || null;

  let mergedJudge = judgeConfig;
  if (judge && caseJudge) {
    mergedJudge = judge.mergeJudgeConfig(judgeConfig, caseJudge);
  } else if (caseJudge) {
    mergedJudge = caseJudge;
  }

  let prompt = evalCase.input ? evalCase.input.prompt : '';
  if (skillEnabled && skillContext) {
    prompt = skillContext + '\n\n' + prompt;
  }

  const startTime = Date.now();
  let agentResult = { available: false, ok: false, text: '', json: null, error: 'no agent runner' };

  if (typeof runAgent === 'function') {
    agentResult = runAgent({
      prompt: prompt,
      timeoutMs: (evalCase.constraints ? evalCase.constraints.timeout_seconds : 300) * 1000,
    });
  }

  const durationMs = Date.now() - startTime;

  // Build judge input
  const judgeInput = {
    caseId: evalCase.id,
    finalMessage: agentResult.text || '',
    exitCode: agentResult.ok ? 0 : 1,
    workspacePath: opts.workspacePath || null,
    commands: opts.commands || [],
    toolCalls: opts.toolCalls || [],
    turnsExecuted: 1,
    turnsTotal: 1,
  };

  // Run judge
  let judgeResult;
  if (judge) {
    const j = judge.createJudge(mergedJudge, runAgent);
    judgeResult = j.evaluate(judgeInput);
  } else {
    // Fallback: simple expect checks
    judgeResult = simpleExpectCheck(evalCase, agentResult);
  }

  // Run expect pre-checks (from skill-up's expect field)
  const expectAssertions = evaluateExpect(evalCase.expect, agentResult);
  if (expectAssertions.length > 0) {
    judgeResult.assertions = (judgeResult.assertions || []).concat(expectAssertions);
    // Recompute summary
    let p = 0, f = 0;
    for (let i = 0; i < judgeResult.assertions.length; i++) {
      if (judgeResult.assertions[i].passed) { p++; } else { f++; }
    }
    judgeResult.summary = {
      passed: p, failed: f, total: p + f,
      passRate: (p + f) > 0 ? p / (p + f) : 1.0,
    };
    if (f > 0) { judgeResult.status = 'FAIL'; }
  }

  return {
    caseId: evalCase.id,
    caseName: evalCase.title || evalCase.id,
    configuration: skillEnabled ? CONFIG_WITH_SKILL : CONFIG_WITHOUT_SKILL,
    status: judgeResult.status,
    prompt: prompt,
    finalMessage: agentResult.text || '',
    exitCode: agentResult.ok ? 0 : 1,
    durationMs: durationMs,
    inputTokens: 0,
    outputTokens: 0,
    grading: judgeResult,
    agentAvailable: agentResult.available,
    error: agentResult.error || null,
  };
}

// ---------------------------------------------------------------------------
// Expect pre-checks (from skill-up schema)
// ---------------------------------------------------------------------------

function evaluateExpect(expect, agentResult) {
  if (!expect) { return []; }
  const assertions = [];
  const text = agentResult.text || '';

  if (expect.must_contain && Array.isArray(expect.must_contain)) {
    for (let i = 0; i < expect.must_contain.length; i++) {
      const kw = expect.must_contain[i];
      const found = text.indexOf(kw) !== -1;
      assertions.push({
        text: 'expect.must_contain: "' + kw + '"',
        passed: found,
        evidence: found ? 'found in output' : 'not found in output',
      });
    }
  }

  if (expect.must_not_contain && Array.isArray(expect.must_not_contain)) {
    for (let j = 0; j < expect.must_not_contain.length; j++) {
      const nkw = expect.must_not_contain[j];
      const absent = text.indexOf(nkw) === -1;
      assertions.push({
        text: 'expect.must_not_contain: "' + nkw + '"',
        passed: absent,
        evidence: absent ? 'correctly absent from output' : 'found in output (should not be present)',
      });
    }
  }

  if (expect.exit_code !== null && expect.exit_code !== undefined) {
    const actualCode = agentResult.ok ? 0 : 1;
    assertions.push({
      text: 'expect.exit_code: ' + expect.exit_code,
      passed: actualCode === expect.exit_code,
      evidence: 'exit code is ' + actualCode,
    });
  }

  return assertions;
}

function simpleExpectCheck(evalCase, agentResult) {
  const assertions = evaluateExpect(evalCase.expect, agentResult);
  let p = 0, f = 0;
  for (let i = 0; i < assertions.length; i++) {
    if (assertions[i].passed) { p++; } else { f++; }
  }
  return {
    status: f > 0 ? 'FAIL' : 'PASS',
    assertions: assertions,
    summary: { passed: p, failed: f, total: p + f, passRate: (p + f) > 0 ? p / (p + f) : 1.0 },
    turnsExecuted: 1,
    turnsTotal: 1,
  };
}

// ---------------------------------------------------------------------------
// Concurrent executor with retry (P2)
// ---------------------------------------------------------------------------

function executeWithRetry(evalCase, options) {
  const maxRetries = (evalCase.retry && evalCase.retry.max_retries) || 0;
  const retryOn = (evalCase.retry && evalCase.retry.retry_on) || ['error'];
  let attempt = 0;
  let result;

  while (attempt <= maxRetries) {
    result = executeCase(evalCase, options);

    if (result.status !== 'ERROR' || attempt >= maxRetries) { break; }

    let shouldRetry = false;
    for (let i = 0; i < retryOn.length; i++) {
      if (retryOn[i] === 'error' && result.status === 'ERROR') { shouldRetry = true; }
      if (retryOn[i] === 'timeout' && result.error && result.error.indexOf('timeout') !== -1) { shouldRetry = true; }
    }

    if (!shouldRetry) { break; }

    attempt++;
    // Exponential backoff: 1s, 2s, 4s...
    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
    const end = Date.now() + delay;
    while (Date.now() < end) { /* busy wait - synchronous context */ }
  }

  return result;
}

function executeCasesConcurrently(cases, options, concurrency) {
  // In synchronous Node.js context, we run sequentially but the API supports concurrency
  // for future async migration
  concurrency = concurrency || 1;
  const results = [];
  for (let i = 0; i < cases.length; i++) {
    results.push(executeWithRetry(cases[i], options));
  }
  return results;
}

// ---------------------------------------------------------------------------
// A/B Baseline comparison
// ---------------------------------------------------------------------------

function runWithBaseline(cases, options) {
  const opts = options || {};
  const skillName = opts.skillName || 'unknown';
  const skillContext = opts.skillContext || '';
  const runAgent = opts.runAgent;
  const judgeConfig = opts.judgeConfig || { type: 'rule_based' };
  const concurrency = opts.concurrency || 1;
  const workspaceBase = opts.workspaceDir || WORKSPACE_DIR;

  const iterNum = opts.iteration || nextIterationNumber(path.join(workspaceBase, skillName + '-workspace'));
  const ws = createIterationWorkspace(workspaceBase, skillName, iterNum);

  // Phase 1: Run with Skill
  const withSkillResults = [];
  for (let i = 0; i < cases.length; i++) {
    const caseDir = ensureCaseDir(ws.iterationDir, cases[i].id, CONFIG_WITH_SKILL);
    const result = executeWithRetry(cases[i], {
      runAgent: runAgent,
      skillEnabled: true,
      skillContext: skillContext,
      judgeConfig: judgeConfig,
      workspacePath: caseDir,
    });
    withSkillResults.push(result);
  }

  // Phase 2: Run without Skill
  const withoutSkillResults = [];
  for (let j = 0; j < cases.length; j++) {
    const caseDirNoSkill = ensureCaseDir(ws.iterationDir, cases[j].id, CONFIG_WITHOUT_SKILL);
    const resultNoSkill = executeWithRetry(cases[j], {
      runAgent: runAgent,
      skillEnabled: false,
      skillContext: '',
      judgeConfig: judgeConfig,
      workspacePath: caseDirNoSkill,
    });
    withoutSkillResults.push(resultNoSkill);
  }

  // Phase 3: Compute benchmark
  const benchmark = computeBenchmark(skillName, withSkillResults, withoutSkillResults);

  // Phase 4: Compute per-dimension delta
  const dimensionDelta = computeDimensionDelta(withSkillResults, withoutSkillResults);

  // Phase 5: Write artifacts
  const artifacts = writeBaselineArtifacts(ws, {
    skillName: skillName,
    iteration: iterNum,
    withSkillResults: withSkillResults,
    withoutSkillResults: withoutSkillResults,
    benchmark: benchmark,
    dimensionDelta: dimensionDelta,
  });

  return {
    skillName: skillName,
    iteration: iterNum,
    workspace: ws,
    withSkill: { results: withSkillResults, summary: summarizeResults(withSkillResults) },
    withoutSkill: { results: withoutSkillResults, summary: summarizeResults(withoutSkillResults) },
    benchmark: benchmark,
    dimensionDelta: dimensionDelta,
    artifacts: artifacts,
  };
}

// ---------------------------------------------------------------------------
// Run without baseline (simplified mode)
// ---------------------------------------------------------------------------

function runWithoutBaseline(cases, options) {
  const opts = options || {};
  const skillName = opts.skillName || 'unknown';
  const skillContext = opts.skillContext || '';
  const runAgent = opts.runAgent;
  const judgeConfig = opts.judgeConfig || { type: 'rule_based' };
  const workspaceBase = opts.workspaceDir || WORKSPACE_DIR;

  const iterNum = opts.iteration || nextIterationNumber(path.join(workspaceBase, skillName + '-workspace'));
  const ws = createIterationWorkspace(workspaceBase, skillName, iterNum);

  const results = [];
  for (let i = 0; i < cases.length; i++) {
    const caseDir = ensureCaseDir(ws.iterationDir, cases[i].id, CONFIG_WITH_SKILL);
    const result = executeWithRetry(cases[i], {
      runAgent: runAgent,
      skillEnabled: true,
      skillContext: skillContext,
      judgeConfig: judgeConfig,
      workspacePath: caseDir,
    });
    results.push(result);
  }

  const benchmark = computeBenchmark(skillName, results, null);

  const artifacts = writeBaselineArtifacts(ws, {
    skillName: skillName,
    iteration: iterNum,
    withSkillResults: results,
    withoutSkillResults: null,
    benchmark: benchmark,
    dimensionDelta: null,
  });

  return {
    skillName: skillName,
    iteration: iterNum,
    workspace: ws,
    withSkill: { results: results, summary: summarizeResults(results) },
    withoutSkill: null,
    benchmark: benchmark,
    dimensionDelta: null,
    artifacts: artifacts,
  };
}

// ---------------------------------------------------------------------------
// Benchmark computation (ported from skill-up benchmark_anthropic.go)
// ---------------------------------------------------------------------------

function summarizeResults(results) {
  if (!results || results.length === 0) {
    return { total: 0, passed: 0, failed: 0, passRate: 0, avgDurationMs: 0 };
  }
  let passed = 0, failed = 0;
  let totalDuration = 0;
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'PASS') { passed++; } else { failed++; }
    totalDuration += results[i].durationMs || 0;
  }
  return {
    total: results.length,
    passed: passed,
    failed: failed,
    passRate: results.length > 0 ? +(passed / results.length).toFixed(4) : 0,
    avgDurationMs: Math.round(totalDuration / results.length),
  };
}

function computeBenchmark(skillName, withSkillResults, withoutSkillResults) {
  const withPassRates = [], withTimes = [], withTokens = [];
  for (let i = 0; i < withSkillResults.length; i++) {
    const r = withSkillResults[i];
    withPassRates.push(r.grading && r.grading.summary ? r.grading.summary.passRate : 0);
    withTimes.push((r.durationMs || 0) / 1000);
    withTokens.push((r.inputTokens || 0) + (r.outputTokens || 0));
  }

  const benchmark = {
    metadata: {
      skillName: skillName,
      timestamp: new Date().toISOString(),
      casesRun: withSkillResults.length,
    },
    runSummary: {
      withSkill: {
        passRate: statValue(withPassRates),
        timeSeconds: statValue(withTimes),
        tokens: statValue(withTokens),
      },
      withoutSkill: null,
      delta: null,
    },
  };

  if (withoutSkillResults && withoutSkillResults.length > 0) {
    const woPassRates = [], woTimes = [], woTokens = [];
    for (let j = 0; j < withoutSkillResults.length; j++) {
      const wr = withoutSkillResults[j];
      woPassRates.push(wr.grading && wr.grading.summary ? wr.grading.summary.passRate : 0);
      woTimes.push((wr.durationMs || 0) / 1000);
      woTokens.push((wr.inputTokens || 0) + (wr.outputTokens || 0));
    }

    benchmark.runSummary.withoutSkill = {
      passRate: statValue(woPassRates),
      timeSeconds: statValue(woTimes),
      tokens: statValue(woTokens),
    };

    benchmark.runSummary.delta = {
      passRate: +(mean(withPassRates) - mean(woPassRates)).toFixed(4),
      timeSeconds: +(mean(withTimes) - mean(woTimes)).toFixed(2),
      tokens: +(mean(withTokens) - mean(woTokens)).toFixed(0),
    };
  }

  return benchmark;
}

// ---------------------------------------------------------------------------
// Per-dimension delta computation (OpenYida unique)
// ---------------------------------------------------------------------------

function computeDimensionDelta(withSkillResults, withoutSkillResults) {
  if (!withoutSkillResults || withoutSkillResults.length === 0) { return null; }

  const withSummary = summarizeResults(withSkillResults);
  const withoutSummary = summarizeResults(withoutSkillResults);

  return {
    passRate: {
      withSkill: withSummary.passRate,
      withoutSkill: withoutSummary.passRate,
      delta: +(withSummary.passRate - withoutSummary.passRate).toFixed(4),
      improvement: withSummary.passRate > withoutSummary.passRate,
    },
    avgDuration: {
      withSkill: withSummary.avgDurationMs,
      withoutSkill: withoutSummary.avgDurationMs,
      delta: withSummary.avgDurationMs - withoutSummary.avgDurationMs,
      improvement: withSummary.avgDurationMs < withoutSummary.avgDurationMs,
    },
    perCase: buildPerCaseDelta(withSkillResults, withoutSkillResults),
  };
}

function buildPerCaseDelta(withResults, withoutResults) {
  const delta = [];
  const len = Math.min(withResults.length, withoutResults.length);
  for (let i = 0; i < len; i++) {
    const w = withResults[i];
    const wo = withoutResults[i];
    const wRate = w.grading && w.grading.summary ? w.grading.summary.passRate : 0;
    const woRate = wo.grading && wo.grading.summary ? wo.grading.summary.passRate : 0;
    delta.push({
      caseId: w.caseId,
      withSkill: { status: w.status, passRate: wRate, durationMs: w.durationMs },
      withoutSkill: { status: wo.status, passRate: woRate, durationMs: wo.durationMs },
      delta: {
        passRate: +(wRate - woRate).toFixed(4),
        durationMs: (w.durationMs || 0) - (wo.durationMs || 0),
      },
    });
  }
  return delta;
}

// ---------------------------------------------------------------------------
// Artifact writers
// ---------------------------------------------------------------------------

function writeBaselineArtifacts(ws, data) {
  const paths = {};

  // result.json
  const resultPath = path.join(ws.iterationDir, 'result.json');
  writeJson(resultPath, {
    skillName: data.skillName,
    iteration: data.iteration,
    timestamp: new Date().toISOString(),
    withSkill: data.withSkillResults.map(resultToSummary),
    withoutSkill: data.withoutSkillResults ? data.withoutSkillResults.map(resultToSummary) : null,
  });
  paths.result = resultPath;

  // benchmark.json
  const benchmarkPath = path.join(ws.iterationDir, 'benchmark.json');
  writeJson(benchmarkPath, data.benchmark);
  paths.benchmark = benchmarkPath;

  // Per-case grading.json
  for (let i = 0; i < data.withSkillResults.length; i++) {
    const r = data.withSkillResults[i];
    if (r.grading) {
      const gradingPath = path.join(ws.iterationDir, r.caseId, CONFIG_WITH_SKILL, 'grading.json');
      fs.mkdirSync(path.dirname(gradingPath), { recursive: true });
      writeJson(gradingPath, convertToGrading(r.grading));
    }
  }

  if (data.withoutSkillResults) {
    for (let j = 0; j < data.withoutSkillResults.length; j++) {
      const wr = data.withoutSkillResults[j];
      if (wr.grading) {
        const gradingPathWo = path.join(ws.iterationDir, wr.caseId, CONFIG_WITHOUT_SKILL, 'grading.json');
        fs.mkdirSync(path.dirname(gradingPathWo), { recursive: true });
        writeJson(gradingPathWo, convertToGrading(wr.grading));
      }
    }
  }

  // benchmark.md (human-readable)
  const mdPath = path.join(ws.iterationDir, 'benchmark.md');
  fs.writeFileSync(mdPath, renderBenchmarkMd(data), 'utf8');
  paths.benchmarkMd = mdPath;

  // dimension-delta.json
  if (data.dimensionDelta) {
    const deltaPath = path.join(ws.iterationDir, 'dimension-delta.json');
    writeJson(deltaPath, data.dimensionDelta);
    paths.dimensionDelta = deltaPath;
  }

  return paths;
}

function resultToSummary(r) {
  return {
    caseId: r.caseId,
    caseName: r.caseName,
    configuration: r.configuration,
    status: r.status,
    durationMs: r.durationMs,
    passRate: r.grading && r.grading.summary ? r.grading.summary.passRate : null,
  };
}

function convertToGrading(judgeResult) {
  const expectations = (judgeResult.assertions || []).map(function (a) {
    return { text: a.text, passed: a.passed, evidence: a.evidence };
  });
  return {
    expectations: expectations,
    summary: judgeResult.summary || { passed: 0, failed: 0, total: 0, passRate: 0 },
  };
}

function renderBenchmarkMd(data) {
  const lines = [];
  lines.push('# Benchmark Report: ' + data.skillName);
  lines.push('');
  lines.push('**Iteration:** ' + data.iteration);
  lines.push('**Timestamp:** ' + new Date().toISOString());
  lines.push('');

  const bm = data.benchmark;
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | With Skill | Without Skill | Delta |');
  lines.push('|--------|-----------|---------------|-------|');

  const ws = bm.runSummary.withSkill;
  const wos = bm.runSummary.withoutSkill;
  const d = bm.runSummary.delta;

  lines.push('| Pass Rate | ' + (ws.passRate.mean * 100).toFixed(1) + '% | ' +
    (wos ? (wos.passRate.mean * 100).toFixed(1) + '%' : 'N/A') + ' | ' +
    (d ? (d.passRate > 0 ? '+' : '') + (d.passRate * 100).toFixed(1) + '%' : 'N/A') + ' |');
  lines.push('| Time (s) | ' + ws.timeSeconds.mean.toFixed(1) + ' | ' +
    (wos ? wos.timeSeconds.mean.toFixed(1) : 'N/A') + ' | ' +
    (d ? (d.timeSeconds > 0 ? '+' : '') + d.timeSeconds.toFixed(1) : 'N/A') + ' |');
  lines.push('| Tokens | ' + Math.round(ws.tokens.mean) + ' | ' +
    (wos ? Math.round(wos.tokens.mean) : 'N/A') + ' | ' +
    (d ? (d.tokens > 0 ? '+' : '') + Math.round(d.tokens) : 'N/A') + ' |');

  lines.push('');

  // Per-case details
  if (data.dimensionDelta && data.dimensionDelta.perCase) {
    lines.push('## Per-Case Delta');
    lines.push('');
    lines.push('| Case | With Skill | Without Skill | Pass Rate Delta |');
    lines.push('|------|-----------|---------------|-----------------|');
    const pc = data.dimensionDelta.perCase;
    for (let i = 0; i < pc.length; i++) {
      const c = pc[i];
      const deltaStr = c.delta.passRate > 0 ? '+' + (c.delta.passRate * 100).toFixed(1) + '%' :
        (c.delta.passRate * 100).toFixed(1) + '%';
      lines.push('| ' + c.caseId + ' | ' + c.withSkill.status + ' | ' +
        c.withoutSkill.status + ' | ' + deltaStr + ' |');
    }
  }

  lines.push('');
  return lines.join('\n');
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Main entry: run baseline evaluation
// ---------------------------------------------------------------------------

function runBaselineEval(options) {
  const opts = options || {};
  const baselineEnabled = opts.baseline !== false;
  const cases = opts.cases || [];

  if (cases.length === 0) {
    return {
      skillName: opts.skillName || 'unknown',
      error: 'no cases to evaluate',
      withSkill: null,
      withoutSkill: null,
      benchmark: null,
    };
  }

  if (baselineEnabled) {
    return runWithBaseline(cases, opts);
  }
  return runWithoutBaseline(cases, opts);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Core functions
  runBaselineEval: runBaselineEval,
  runWithBaseline: runWithBaseline,
  runWithoutBaseline: runWithoutBaseline,

  // Case execution
  executeCase: executeCase,
  executeWithRetry: executeWithRetry,
  executeCasesConcurrently: executeCasesConcurrently,

  // Benchmark computation
  computeBenchmark: computeBenchmark,
  computeDimensionDelta: computeDimensionDelta,
  summarizeResults: summarizeResults,

  // Iteration workspace
  nextIterationNumber: nextIterationNumber,
  createIterationWorkspace: createIterationWorkspace,

  // Statistics
  mean: mean,
  stdDev: stdDev,
  statValue: statValue,

  // Constants
  CONFIG_WITH_SKILL: CONFIG_WITH_SKILL,
  CONFIG_WITHOUT_SKILL: CONFIG_WITHOUT_SKILL,
};
