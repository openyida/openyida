'use strict';

/**
 * D5 — Agent execution efficiency analysis.
 *
 * Measures how efficiently the Agent completed its task by evaluating:
 *   - Number of CLI commands executed
 *   - Total token consumption
 *   - Wall-clock execution time
 *   - Redundant (consecutive duplicate) commands
 *
 * Each metric is scored 0-100 against a configurable baseline, then combined
 * into a weighted average.
 */

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const EFFICIENCY_DEFAULTS = {
  maxCommands: 20,
  maxTokens: 50000,
  maxTimeMs: 300000,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Count consecutive identical commands.
 * @param {string[]} commands
 * @returns {number}
 */
function countRedundant(commands) {
  if (!Array.isArray(commands) || commands.length === 0) {
    return 0;
  }
  let count = 0;
  for (let i = 1; i < commands.length; i++) {
    if (commands[i] === commands[i - 1]) {
      count++;
    }
  }
  return count;
}

/**
 * Compute a single metric score (0-100).
 * If actual <= max the score is 100; otherwise it degrades linearly.
 * @param {number|null} actual
 * @param {number} max
 * @returns {number|null}
 */
function metricScore(actual, max) {
  if (actual === null || actual === undefined || max <= 0) {
    return null;
  }
  if (actual <= max) {
    return 100;
  }
  return Math.max(0, +(max / actual * 100).toFixed(2));
}

// ---------------------------------------------------------------------------
// Core analysis
// ---------------------------------------------------------------------------

/**
 * Analyze Agent execution efficiency.
 *
 * @param {object} options
 * @param {string[]} options.commands  — CLI command strings the Agent ran
 * @param {number|null} options.tokens — total token count
 * @param {number|null} options.timeMs — total execution time in ms
 * @param {object}  [options.baseline] — {maxCommands, maxTokens, maxTimeMs}
 * @returns {{commands: number, tokens: number|null, timeMs: number|null,
 *            redundantCommands: number, score: number, details: object}}
 */
function analyzeEfficiency(options) {
  const opts = options || {};
  const commands = Array.isArray(opts.commands) ? opts.commands : [];
  const tokens = typeof opts.tokens === 'number' ? opts.tokens : null;
  const timeMs = typeof opts.timeMs === 'number' ? opts.timeMs : null;
  const baseline = Object.assign({}, EFFICIENCY_DEFAULTS, opts.baseline || {});

  const redundantCount = countRedundant(commands);

  const commandScore = metricScore(commands.length, baseline.maxCommands);
  const tokenScore = metricScore(tokens, baseline.maxTokens);
  const timeScore = metricScore(timeMs, baseline.maxTimeMs);

  // Weighted average — only include non-null metrics.
  // Weights: commands 0.4, tokens 0.3, time 0.3
  const weights = [
    { score: commandScore, weight: 0.4 },
    { score: tokenScore, weight: 0.3 },
    { score: timeScore, weight: 0.3 },
  ];

  let totalWeight = 0;
  let weightedSum = 0;
  for (let i = 0; i < weights.length; i++) {
    if (weights[i].score !== null && weights[i].score !== undefined) {
      weightedSum += weights[i].score * weights[i].weight;
      totalWeight += weights[i].weight;
    }
  }

  const score = totalWeight > 0 ? +(weightedSum / totalWeight).toFixed(2) : 0;

  return {
    commands: commands.length,
    tokens: tokens,
    timeMs: timeMs,
    redundantCommands: redundantCount,
    score: score,
    details: {
      commandScore: commandScore,
      tokenScore: tokenScore,
      timeScore: timeScore,
      redundantCount: redundantCount,
    },
  };
}

// ---------------------------------------------------------------------------
// Runner (with defaults applied)
// ---------------------------------------------------------------------------

/**
 * Run efficiency evaluation with defaults applied.
 * Same return shape as `analyzeEfficiency`.
 *
 * @param {object} [options]
 * @returns {object}
 */
function runEfficiencyEval(options) {
  const opts = options || {};
  if (!opts.baseline) {
    opts.baseline = EFFICIENCY_DEFAULTS;
  }
  return analyzeEfficiency(opts);
}

// ---------------------------------------------------------------------------
// CLI entry (when run directly)
// ---------------------------------------------------------------------------

if (require.main === module) {
  // Demo with sample data
  const demo = runEfficiencyEval({
    commands: [
      'openyida login',
      'openyida copy',
      'openyida copy',
      'openyida gen --skill form',
      'openyida push',
    ],
    tokens: 32000,
    timeMs: 120000,
  });

  console.log('=== Efficiency Eval (demo) ===');
  console.log('  commands: %d (max %d)', demo.commands, EFFICIENCY_DEFAULTS.maxCommands);
  console.log('  tokens: %s (max %d)', demo.tokens, EFFICIENCY_DEFAULTS.maxTokens);
  console.log('  timeMs: %s (max %d)', demo.timeMs, EFFICIENCY_DEFAULTS.maxTimeMs);
  console.log('  redundant: %d', demo.redundantCommands);
  console.log('  score: %s / 100', demo.score);
  console.log('  details:', JSON.stringify(demo.details, null, 2));
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  EFFICIENCY_DEFAULTS,
  analyzeEfficiency,
  runEfficiencyEval,
};
