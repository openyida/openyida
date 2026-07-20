'use strict';

/**
 * Comprehensive evaluation orchestrator for openyida skills.
 *
 * Aggregates all 10 evaluation dimensions into a single unified scorecard,
 * applying hard gates and weighted scoring. Produces a radar SVG and
 * persists results to history for trend analysis.
 *
 * Dimensions:
 *   1. standards         — SKILL.md standards compliance (doc-quality)
 *   2. maintainability   — SKILL.md maintainability (doc-quality)
 *   3. routingAccuracy   — Agent routing accuracy
 *   4. generationQuality — Agent generation pass rate
 *   5. safety            — Security & compliance checks
 *   6. efficiency        — Agent execution efficiency
 *   7. stability         — Multi-run routing consistency
 *   8. coverage          — Test coverage breadth
 *   9. stepCompleteness  — Required step completion rate
 *  10. outputValidity    — Output format conformance
 *  11. knowledgeDelta    — Knowledge improvement (placeholder)
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Peer module imports (defensive — each may be absent)
// ---------------------------------------------------------------------------

let docQuality;
try { docQuality = require('./doc-quality'); } catch (_e) { docQuality = null; }

let coverage;
try { coverage = require('./coverage'); } catch (_e) { coverage = null; }

let safety;
try { safety = require('./safety'); } catch (_e) { safety = null; }

let stepCompleteness;
try { stepCompleteness = require('./step-completeness'); } catch (_e) { stepCompleteness = null; }

let outputValidity;
try { outputValidity = require('./output-validity'); } catch (_e) { outputValidity = null; }

let efficiency;
try { efficiency = require('./efficiency'); } catch (_e) { efficiency = null; }

let radarChart;
try { radarChart = require('./radar-chart'); } catch (_e) { radarChart = null; }

let history;
try { history = require('./history'); } catch (_e) { history = null; }

let baseline;
try { baseline = require('./baseline'); } catch (_e) { baseline = null; }

let yamlLoader;
try { yamlLoader = require('./yaml-loader'); } catch (_e) { yamlLoader = null; }

let judgeModule;
try { judgeModule = require('./judge'); } catch (_e) { judgeModule = null; }

let junitModule;
try { junitModule = require('./junit'); } catch (_e) { junitModule = null; }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..', '..');
const EVAL_OUT_DIR = path.join(ROOT, 'project', '.cache', 'eval');

/**
 * Hard gates — pass/fail thresholds that override the overall score.
 * A single hard gate failure means the entire evaluation is a "fail"
 * regardless of the weighted score.
 */
const HARD_GATES = {
  triggerAccuracy: 0.85,
  stepCompletionRate: 1.0,
  functionalTestRate: 0.95,
  outputFormatRate: 0.85,
  safetyFailures: 0,
};

/**
 * Dimension weights for computing the overall weighted score.
 * Must sum to 1.0.
 */
const DIMENSION_WEIGHTS = {
  standards: 0.10,
  maintainability: 0.05,
  routingAccuracy: 0.15,
  generationQuality: 0.15,
  safety: 0.15,
  efficiency: 0.05,
  stability: 0.05,
  coverage: 0.05,
  stepCompleteness: 0.10,
  outputValidity: 0.10,
  knowledgeDelta: 0.05,
};

// ---------------------------------------------------------------------------
// Scorecard builder
// ---------------------------------------------------------------------------

/**
 * Build a unified scorecard from per-dimension scores.
 *
 * @param {Object.<string, {score: number|null}>} dimensionScores
 *   Map of dimension key to an object containing at least `score` (0-100 or null).
 * @returns {{overall: number, dimensions: object, hardGates: Object.<string, string>, gate: string}}
 */
function buildScorecard(dimensionScores) {
  const scores = dimensionScores || {};

  // --- weighted average (skip null scores) ---
  let totalWeight = 0;
  let weightedSum = 0;
  const dimensionKeys = Object.keys(DIMENSION_WEIGHTS);

  const dimensions = {};

  for (let i = 0; i < dimensionKeys.length; i++) {
    const key = dimensionKeys[i];
    const entry = scores[key];
    const score = (entry && typeof entry.score === 'number') ? entry.score : null;

    dimensions[key] = {
      score: score,
      weight: DIMENSION_WEIGHTS[key],
      weighted: null,
    };

    if (score !== null) {
      const weighted = score * DIMENSION_WEIGHTS[key];
      dimensions[key].weighted = Math.round(weighted * 100) / 100;
      weightedSum += weighted;
      totalWeight += DIMENSION_WEIGHTS[key];
    }
  }

  const overall = totalWeight > 0
    ? Math.round(weightedSum / totalWeight * 100) / 100
    : 0;

  // --- hard gates ---
  const hardGates = {};
  let anyFail = false;

  // triggerAccuracy: from routingAccuracy dimension (score is 0-100, threshold is 0-1)
  const routingScore = scores.routingAccuracy;
  if (routingScore && typeof routingScore.score === 'number') {
    const routingRate = routingScore.score / 100;
    if (routingRate < HARD_GATES.triggerAccuracy) {
      hardGates.triggerAccuracy = 'fail';
      anyFail = true;
    } else {
      hardGates.triggerAccuracy = 'pass';
    }
  } else {
    hardGates.triggerAccuracy = 'skipped';
  }

  // stepCompletionRate: from stepCompleteness dimension
  const stepScore = scores.stepCompleteness;
  if (stepScore && typeof stepScore.score === 'number') {
    const stepRate = stepScore.score / 100;
    if (stepRate < HARD_GATES.stepCompletionRate) {
      hardGates.stepCompletionRate = 'fail';
      anyFail = true;
    } else {
      hardGates.stepCompletionRate = 'pass';
    }
  } else {
    hardGates.stepCompletionRate = 'skipped';
  }

  // functionalTestRate: from generationQuality dimension
  const genScore = scores.generationQuality;
  if (genScore && typeof genScore.score === 'number') {
    const genRate = genScore.score / 100;
    if (genRate < HARD_GATES.functionalTestRate) {
      hardGates.functionalTestRate = 'fail';
      anyFail = true;
    } else {
      hardGates.functionalTestRate = 'pass';
    }
  } else {
    hardGates.functionalTestRate = 'skipped';
  }

  // outputFormatRate: from outputValidity dimension
  const outputScore = scores.outputValidity;
  if (outputScore && typeof outputScore.score === 'number') {
    const outputRate = outputScore.score / 100;
    if (outputRate < HARD_GATES.outputFormatRate) {
      hardGates.outputFormatRate = 'fail';
      anyFail = true;
    } else {
      hardGates.outputFormatRate = 'pass';
    }
  } else {
    hardGates.outputFormatRate = 'skipped';
  }

  // safetyFailures: from safety dimension — check if score < 100 (any failure)
  const safetyScore = scores.safety;
  if (safetyScore && typeof safetyScore.score === 'number') {
    // safetyFailures threshold is 0 — any failure count > 0 means fail
    // A perfect safety score is 100; anything less means there were failures
    const safetyFailureCount = (safetyScore.failureCount !== null && safetyScore.failureCount !== undefined)
      ? safetyScore.failureCount
      : (safetyScore.score < 100 ? 1 : 0);
    if (safetyFailureCount > HARD_GATES.safetyFailures) {
      hardGates.safetyFailures = 'fail';
      anyFail = true;
    } else {
      hardGates.safetyFailures = 'pass';
    }
  } else {
    hardGates.safetyFailures = 'skipped';
  }

  return {
    overall: overall,
    dimensions: dimensions,
    hardGates: hardGates,
    gate: anyFail ? 'fail' : 'pass',
  };
}

// ---------------------------------------------------------------------------
// Dimension collectors
// ---------------------------------------------------------------------------

/**
 * Safely run a function, returning null on any error.
 * @param {Function} fn
 * @returns {*|null}
 */
function safeRun(fn) {
  try {
    return fn();
  } catch (_e) {
    return null;
  }
}

/**
 * Collect doc-quality scores for a specific skill.
 * @param {string} skill
 * @returns {{standards: {score: number|null}, maintainability: {score: number|null}}|null}
 */
function collectDocQuality(skill) {
  if (!docQuality) { return null; }

  const result = safeRun(function () {
    return docQuality.runDocQualityEval({ skill: skill });
  });

  if (!result || !result.summary) { return null; }

  return {
    standards: { score: result.summary.avgStandards },
    maintainability: { score: result.summary.avgMaintainability },
    raw: result,
  };
}

/**
 * Collect coverage score.
 * @returns {{score: number|null, raw: object}|null}
 */
function collectCoverage() {
  if (!coverage) { return null; }

  const result = safeRun(function () {
    return coverage.runCoverageEval({});
  });

  if (!result || typeof result.overall !== 'number') { return null; }

  return {
    score: Math.round(result.overall * 100 * 100) / 100,
    raw: result,
  };
}

/**
 * Collect safety score from commands and output.
 * @param {string[][]|undefined} commands
 * @param {string|undefined} output
 * @returns {{score: number|null, failureCount: number, raw: object}|null}
 */
function collectSafety(commands, output) {
  if (!safety) { return null; }
  if (!commands && !output) { return null; }

  const result = safeRun(function () {
    return safety.runSafetyEval({
      commands: commands || [],
      output: output || '',
    });
  });

  if (!result) { return null; }

  let failCount = 0;
  if (Array.isArray(result.checks)) {
    for (let i = 0; i < result.checks.length; i++) {
      if (result.checks[i].status === 'fail') {
        failCount++;
      }
    }
  }

  return {
    score: result.passed ? 100 : Math.max(0, 100 - failCount * 20),
    failureCount: failCount,
    raw: result,
  };
}

/**
 * Collect step-completeness score.
 * @param {string} skill
 * @param {string[]|undefined} commands
 * @returns {{score: number|null, raw: object}|null}
 */
function collectStepCompleteness(skill, commands) {
  if (!stepCompleteness) { return null; }
  if (!skill || !commands) { return null; }

  const result = safeRun(function () {
    return stepCompleteness.checkStepCompleteness(skill, commands);
  });

  if (!result) { return null; }

  return {
    score: Math.round(result.rate * 100 * 100) / 100,
    missing: result.missing,
    raw: result,
  };
}

/**
 * Collect output-validity score.
 * @param {Array<{category: string, output: object}>|undefined} outputs
 * @returns {{score: number|null, raw: object}|null}
 */
function collectOutputValidity(outputs) {
  if (!outputValidity) { return null; }
  if (!outputs || !Array.isArray(outputs) || outputs.length === 0) { return null; }

  const result = safeRun(function () {
    return outputValidity.runOutputValidityEval({ outputs: outputs });
  });

  if (!result || !result.summary) { return null; }

  const rate = result.summary.rate;
  return {
    score: (rate !== null && rate !== undefined) ? Math.round(rate * 100 * 100) / 100 : null,
    raw: result,
  };
}

/**
 * Collect efficiency score.
 * @param {object|undefined} efficiencyData
 * @returns {{score: number|null, raw: object}|null}
 */
function collectEfficiency(efficiencyData) {
  if (!efficiency) { return null; }
  if (!efficiencyData) { return null; }

  const result = safeRun(function () {
    return efficiency.analyzeEfficiency(efficiencyData);
  });

  if (!result) { return null; }

  return {
    score: result.score,
    raw: result,
  };
}

/**
 * Extract routing accuracy score from pre-computed routing results.
 * @param {object|undefined} routingResults
 * @returns {{score: number|null, raw: object}|null}
 */
function collectRoutingAccuracy(routingResults) {
  if (!routingResults || !routingResults.summary) { return null; }

  const accuracy = routingResults.summary.accuracy;
  if (accuracy === null || accuracy === undefined) { return null; }

  return {
    score: Math.round(accuracy * 100 * 100) / 100,
    raw: routingResults,
  };
}

/**
 * Extract generation quality score from pre-computed generation results.
 * @param {object|undefined} generationResults
 * @returns {{score: number|null, raw: object}|null}
 */
function collectGenerationQuality(generationResults) {
  if (!generationResults || !generationResults.summary) { return null; }

  const passRate = generationResults.summary.passRate;
  if (passRate === null || passRate === undefined) { return null; }

  return {
    score: Math.round(passRate * 100 * 100) / 100,
    raw: generationResults,
  };
}

/**
 * Extract stability score from routing results.
 * @param {object|undefined} routingResults
 * @returns {{score: number|null, raw: object}|null}
 */
function collectStability(routingResults) {
  if (!routingResults || !routingResults.stability) { return null; }

  const consistencyRate = routingResults.stability.consistencyRate;
  if (consistencyRate === null || consistencyRate === undefined) { return null; }

  return {
    score: Math.round(consistencyRate * 100 * 100) / 100,
    raw: routingResults.stability,
  };
}

// ---------------------------------------------------------------------------
// Report writer
// ---------------------------------------------------------------------------

/**
 * Write comprehensive evaluation report to disk.
 * @param {object} result - The comprehensive eval result
 * @returns {string} Path to the written report file
 */
function writeComprehensiveReport(result) {
  const outDir = path.join(EVAL_OUT_DIR, 'comprehensive');
  fs.mkdirSync(outDir, { recursive: true });

  const fileName = 'comprehensive-' + result.skill + '-' + result.timestamp + '.json';
  const reportPath = path.join(outDir, fileName);
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2) + '\n', 'utf8');

  return reportPath;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Run a comprehensive evaluation across all dimensions for a given skill.
 *
 * @param {object} options
 * @param {string} options.skill               — target skill name (required)
 * @param {object} [options.routingResults]     — pre-computed routing eval results
 * @param {object} [options.generationResults]  — pre-computed generation eval results
 * @param {string[][]} [options.commands]       — Agent command trace (array of arg arrays)
 * @param {string} [options.output]             — Agent output text
 * @param {string[]} [options.commandStrings]   — Agent commands as flat strings (for step-completeness)
 * @param {Array}  [options.outputs]            — Output validity items [{category, output}]
 * @param {object} [options.efficiencyData]     — Data for efficiency analysis {commands, tokens, timeMs}
 * @param {boolean} [options.saveHistory]       — persist to history (default: true)
 * @returns {{skill: string, timestamp: string, scorecard: object, radarSvg: string|null, trend: object|null, reportPath: string}}
 */
function runComprehensiveEval(options) {
  const opts = options || {};
  const skill = opts.skill;

  if (!skill) {
    throw new Error('options.skill is required');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const shouldSaveHistory = opts.saveHistory !== false;

  // --- Collect all dimension scores ---
  const dimensionScores = {};

  // D1a: Standards (doc-quality)
  const dq = safeRun(function () { return collectDocQuality(skill); });
  if (dq && dq.standards) {
    dimensionScores.standards = dq.standards;
  } else {
    dimensionScores.standards = { score: null };
  }

  // D1b: Maintainability (doc-quality)
  if (dq && dq.maintainability) {
    dimensionScores.maintainability = dq.maintainability;
  } else {
    dimensionScores.maintainability = { score: null };
  }

  // D2: Routing accuracy
  const routing = safeRun(function () { return collectRoutingAccuracy(opts.routingResults); });
  dimensionScores.routingAccuracy = routing || { score: null };

  // D3: Generation quality
  const gen = safeRun(function () { return collectGenerationQuality(opts.generationResults); });
  dimensionScores.generationQuality = gen || { score: null };

  // D4: Safety
  const saf = safeRun(function () { return collectSafety(opts.commands, opts.output); });
  dimensionScores.safety = saf || { score: null };

  // D5: Efficiency
  const eff = safeRun(function () { return collectEfficiency(opts.efficiencyData); });
  dimensionScores.efficiency = eff || { score: null };

  // D6: Stability
  const stab = safeRun(function () { return collectStability(opts.routingResults); });
  dimensionScores.stability = stab || { score: null };

  // D7: Coverage
  const cov = safeRun(function () { return collectCoverage(); });
  dimensionScores.coverage = cov || { score: null };

  // D8: Step completeness
  let cmdStrings = opts.commandStrings || null;
  if (!cmdStrings && opts.commands) {
    // Flatten command arg arrays to strings for step-completeness matching
    cmdStrings = opts.commands.map(function (args) {
      return Array.isArray(args) ? args.join(' ') : String(args);
    });
  }
  const sc = safeRun(function () { return collectStepCompleteness(skill, cmdStrings); });
  dimensionScores.stepCompleteness = sc || { score: null };

  // D9: Output validity
  const ov = safeRun(function () { return collectOutputValidity(opts.outputs); });
  dimensionScores.outputValidity = ov || { score: null };

  // D10: Knowledge delta (placeholder — no implementation yet)
  dimensionScores.knowledgeDelta = { score: null };

  // --- Build scorecard ---
  const scorecard = buildScorecard(dimensionScores);

  // --- Radar SVG ---
  let radarSvg = null;
  if (radarChart && typeof radarChart.renderRadarSvg === 'function') {
    const radarDimensions = [];
    const dimKeys = Object.keys(DIMENSION_WEIGHTS);
    for (let i = 0; i < dimKeys.length; i++) {
      const dimKey = dimKeys[i];
      const dimEntry = scorecard.dimensions[dimKey];
      radarDimensions.push({
        key: dimKey,
        label: dimKey,
        value: (dimEntry && dimEntry.score !== null) ? dimEntry.score : 0,
      });
    }
    radarSvg = safeRun(function () {
      return radarChart.renderRadarSvg(radarDimensions, { title: skill });
    });
  }

  // --- Trend from history ---
  let trend = null;
  if (history && typeof history.loadHistory === 'function' && typeof history.computeTrend === 'function') {
    const pastHistory = safeRun(function () { return history.loadHistory(skill); });
    if (pastHistory && pastHistory.length > 0) {
      trend = safeRun(function () { return history.computeTrend(pastHistory); });
    }
  }

  // --- Assemble result ---
  const result = {
    skill: skill,
    timestamp: timestamp,
    scorecard: scorecard,
    radarSvg: radarSvg,
    trend: trend,
    reportPath: null,
  };

  // --- Write report ---
  const reportPath = safeRun(function () { return writeComprehensiveReport(result); });
  result.reportPath = reportPath;

  // --- Save to history ---
  if (shouldSaveHistory && history && typeof history.saveResult === 'function') {
    safeRun(function () {
      history.saveResult({
        skill: skill,
        timestamp: timestamp,
        overall: scorecard.overall,
        gate: scorecard.gate,
        dimensions: scorecard.dimensions,
        hardGates: scorecard.hardGates,
      });
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Baseline-enhanced comprehensive evaluation
// ---------------------------------------------------------------------------

/**
 * Run comprehensive evaluation with A/B baseline comparison.
 *
 * Runs all cases twice (with_skill vs without_skill) and computes
 * per-dimension deltas showing the Skill's actual value contribution.
 *
 * @param {object} options
 * @param {string} options.skill           — target skill name (required)
 * @param {Array}  options.cases           — eval cases (YAML or JSON format)
 * @param {string} [options.skillContext]  — SKILL.md content for with_skill runs
 * @param {function} [options.runAgent]    — agent runner function
 * @param {object} [options.judgeConfig]   — global judge configuration
 * @param {boolean} [options.baseline=true] — enable A/B comparison
 * @param {string[]} [options.formats]     — report formats: 'json', 'junit', 'html'
 * @param {object} [options.*]             — all runComprehensiveEval options
 * @returns {object} Enhanced result with baseline delta
 */
function runBaselineComprehensiveEval(options) {
  const opts = options || {};
  const skill = opts.skill;

  if (!skill) {
    throw new Error('options.skill is required');
  }

  // Step 1: Run standard comprehensive eval (single run, for dimension scores)
  const standardResult = runComprehensiveEval(opts);

  // Step 2: If baseline module available and cases provided, run A/B comparison
  let baselineResult = null;
  if (baseline && opts.cases && opts.cases.length > 0) {
    baselineResult = safeRun(function () {
      return baseline.runBaselineEval({
        cases: opts.cases,
        skillName: skill,
        skillContext: opts.skillContext || '',
        runAgent: opts.runAgent,
        judgeConfig: opts.judgeConfig || { type: 'rule_based' },
        baseline: opts.baseline !== false,
        workspaceDir: opts.workspaceDir,
        iteration: opts.iteration,
      });
    });
  }

  // Step 3: Generate dual-line radar (with/without overlay)
  let dualRadarSvg = null;
  if (baselineResult && baselineResult.dimensionDelta && radarChart) {
    dualRadarSvg = safeRun(function () {
      return renderDualRadarSvg(standardResult.scorecard, baselineResult, skill);
    });
  }

  // Step 4: Generate JUnit report if requested
  let junitPath = null;
  if (junitModule && opts.formats && opts.formats.indexOf('junit') !== -1) {
    const allResults = baselineResult
      ? (baselineResult.withSkill.results || []).concat(
        baselineResult.withoutSkill ? baselineResult.withoutSkill.results : [])
      : [];
    if (allResults.length > 0) {
      junitPath = safeRun(function () {
        const outDir = path.join(EVAL_OUT_DIR, 'comprehensive');
        fs.mkdirSync(outDir, { recursive: true });
        const jPath = path.join(outDir, 'report-' + skill + '.xml');
        return junitModule.writeJunitReport(jPath, {
          suiteName: 'openyida-eval.' + skill,
          results: allResults,
        });
      });
    }
  }

  // Assemble enhanced result
  const enhancedResult = Object.assign({}, standardResult, {
    baseline: baselineResult ? {
      benchmark: baselineResult.benchmark,
      dimensionDelta: baselineResult.dimensionDelta,
      withSkillSummary: baselineResult.withSkill ? baselineResult.withSkill.summary : null,
      withoutSkillSummary: baselineResult.withoutSkill ? baselineResult.withoutSkill.summary : null,
      iteration: baselineResult.iteration,
      artifacts: baselineResult.artifacts,
    } : null,
    dualRadarSvg: dualRadarSvg,
    junitPath: junitPath,
  });

  return enhancedResult;
}

/**
 * Render a dual-line radar SVG showing with_skill (blue) and without_skill (red) overlay.
 */
function renderDualRadarSvg(scorecard, baselineResult, title) {
  if (!radarChart || typeof radarChart.renderRadarSvg !== 'function') { return null; }
  if (!scorecard || !scorecard.dimensions) { return null; }

  const size = 440;
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size * 0.32;
  const levels = 5;

  const dimKeys = Object.keys(DIMENSION_WEIGHTS);
  const n = dimKeys.length;
  const step = (2 * Math.PI) / n;

  // Collect with_skill scores from scorecard
  const withScores = [];
  for (let i = 0; i < dimKeys.length; i++) {
    const dim = scorecard.dimensions[dimKeys[i]];
    withScores.push(dim && dim.score !== null ? dim.score : 0);
  }

  // Estimate without_skill scores from delta
  const withoutScores = [];
  const delta = baselineResult.benchmark && baselineResult.benchmark.runSummary
    ? baselineResult.benchmark.runSummary.delta : null;
  const overallDelta = delta ? delta.passRate * 100 : 0;

  for (let j = 0; j < dimKeys.length; j++) {
    // Approximate: subtract overall delta from each dimension
    withoutScores.push(Math.max(0, Math.min(100, withScores[j] - overallDelta)));
  }

  function polarToCart(r, angle) {
    return {
      x: +(cx + r * Math.sin(angle)).toFixed(2),
      y: +(cy - r * Math.cos(angle)).toFixed(2),
    };
  }

  function polyPath(radii) {
    const parts = [];
    for (let pi = 0; pi < radii.length; pi++) {
      const pt = polarToCart(radii[pi], step * pi);
      parts.push((pi === 0 ? 'M' : 'L') + pt.x + ',' + pt.y);
    }
    parts.push('Z');
    return parts.join(' ');
  }

  function esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const lines = [];
  lines.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
    '" viewBox="0 0 ' + size + ' ' + size + '" style="font-family:sans-serif;font-size:11px;">');

  // Title
  lines.push('<text x="' + cx + '" y="18" text-anchor="middle" font-size="14" font-weight="bold" fill="#333">' +
    esc(title) + ' - A/B Comparison</text>');

  // Grid
  for (let lv = 1; lv <= levels; lv++) {
    const lvR = (maxRadius * lv) / levels;
    const lvRadii = new Array(n).fill(lvR);
    lines.push('<path d="' + polyPath(lvRadii) + '" fill="none" stroke="#e0e0e0" stroke-width="1"/>');
  }

  // Axes
  for (let ai = 0; ai < n; ai++) {
    const axPt = polarToCart(maxRadius, step * ai);
    lines.push('<line x1="' + cx + '" y1="' + cy + '" x2="' + axPt.x + '" y2="' + axPt.y +
      '" stroke="#e0e0e0" stroke-width="1"/>');
  }

  // Without-skill polygon (red, dashed)
  const woRadii = withoutScores.map(function (s) { return (maxRadius * s) / 100; });
  lines.push('<path d="' + polyPath(woRadii) +
    '" fill="rgba(255,99,132,0.15)" stroke="#ff6384" stroke-width="1.5" stroke-dasharray="5,3"/>');

  // With-skill polygon (blue, solid)
  const wRadii = withScores.map(function (s) { return (maxRadius * s) / 100; });
  lines.push('<path d="' + polyPath(wRadii) +
    '" fill="rgba(54,162,235,0.25)" stroke="#36a2eb" stroke-width="2"/>');

  // Labels and dots
  const labelOffset = maxRadius + 22;
  for (let li = 0; li < n; li++) {
    const wPt = polarToCart(wRadii[li], step * li);
    lines.push('<circle cx="' + wPt.x + '" cy="' + wPt.y + '" r="3" fill="#36a2eb"/>');

    const lPt = polarToCart(labelOffset, step * li);
    let anchor = 'middle';
    if (lPt.x < cx - 10) { anchor = 'end'; }
    else if (lPt.x > cx + 10) { anchor = 'start'; }
    lines.push('<text x="' + lPt.x + '" y="' + (lPt.y + 4) +
      '" text-anchor="' + anchor + '" fill="#333" font-size="10">' +
      esc(dimKeys[li]) + '</text>');
  }

  // Legend
  const legY = size - 16;
  lines.push('<rect x="' + (cx - 90) + '" y="' + (legY - 8) + '" width="12" height="12" fill="rgba(54,162,235,0.5)"/>');
  lines.push('<text x="' + (cx - 74) + '" y="' + legY + '" fill="#333" font-size="10">With Skill</text>');
  lines.push('<rect x="' + (cx + 10) + '" y="' + (legY - 8) + '" width="12" height="12" fill="rgba(255,99,132,0.3)"/>');
  lines.push('<text x="' + (cx + 26) + '" y="' + legY + '" fill="#333" font-size="10">Without Skill</text>');

  lines.push('</svg>');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CLI entry (when run directly)
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);
  let skillArg = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--skill' && i + 1 < args.length) {
      skillArg = args[i + 1];
      break;
    }
  }

  if (!skillArg) {
    console.error('Usage: node scripts/eval/comprehensive.js --skill <skill-name>');
    process.exit(1);
  }

  const result = runComprehensiveEval({ skill: skillArg });

  console.log('=== Comprehensive Evaluation: %s ===', result.skill);
  console.log('  timestamp: %s', result.timestamp);
  console.log('  overall:   %s / 100', result.scorecard.overall);
  console.log('  gate:      %s', result.scorecard.gate.toUpperCase());
  console.log('');

  console.log('  Dimensions:');
  const dimKeys = Object.keys(result.scorecard.dimensions);
  for (let d = 0; d < dimKeys.length; d++) {
    const dk = dimKeys[d];
    const dim = result.scorecard.dimensions[dk];
    const scoreStr = dim.score !== null ? dim.score.toFixed(1) : 'n/a';
    console.log('    %-20s  score=%-7s  weight=%.2f', dk, scoreStr, dim.weight);
  }
  console.log('');

  console.log('  Hard Gates:');
  const gateKeys = Object.keys(result.scorecard.hardGates);
  for (let g = 0; g < gateKeys.length; g++) {
    const gk = gateKeys[g];
    const status = result.scorecard.hardGates[gk];
    const icon = status === 'pass' ? 'PASS' : (status === 'fail' ? 'FAIL' : 'SKIP');
    console.log('    %-22s  %s', gk, icon);
  }
  console.log('');

  if (result.reportPath) {
    console.log('  report: %s', result.reportPath);
  }
  if (result.trend) {
    console.log('  trend: %s', JSON.stringify(result.trend));
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  HARD_GATES: HARD_GATES,
  DIMENSION_WEIGHTS: DIMENSION_WEIGHTS,
  buildScorecard: buildScorecard,
  runComprehensiveEval: runComprehensiveEval,
  runBaselineComprehensiveEval: runBaselineComprehensiveEval,
};
