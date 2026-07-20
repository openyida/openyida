'use strict';

/**
 * Evaluation history — store and retrieve eval results for trend analysis.
 *
 * Results are persisted as individual JSON files under:
 *   HISTORY_DIR/<skill>/<timestamp>.json
 *
 * Each file contains the comprehensive eval result object (skill, timestamp,
 * dimensions, overall, gate, etc.).
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..', '..');
const HISTORY_DIR = path.join(ROOT, 'project', '.cache', 'eval', 'history');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read and parse a JSON file. Returns null on failure.
 */
function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * List files matching an extension under `dir` (non-recursive).
 */
function listFiles(dir, ext) {
  try {
    return fs.readdirSync(dir)
      .filter(function (f) { return f.endsWith(ext); });
  } catch {
    return [];
  }
}

/**
 * Resolve the history directory, respecting an optional override.
 */
function resolveDir(options) {
  const opts = options || {};
  return opts.historyDir || HISTORY_DIR;
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

/**
 * Save an evaluation result to disk.
 *
 * @param {object} result — comprehensive eval JSON
 *   Must contain at least `result.skill` (string).
 *   If `result.timestamp` is missing, the current ISO timestamp is used.
 * @param {object} [options]
 * @param {string} [options.historyDir] — override base directory
 * @returns {string} absolute file path of the saved file
 */
function saveResult(result, options) {
  const baseDir = resolveDir(options);
  const skill = result.skill || 'unknown';
  const timestamp = result.timestamp || new Date().toISOString();

  // Sanitise timestamp for use as a filename (replace colons)
  const safeTs = timestamp.replace(/:/g, '-');
  const dir = path.join(baseDir, skill);
  fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, safeTs + '.json');
  const data = Object.assign({}, result, { timestamp: timestamp });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');

  return filePath;
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

/**
 * Load evaluation history for a single skill, sorted by timestamp ascending.
 *
 * @param {string} skill
 * @param {object} [options]
 * @param {string} [options.historyDir]
 * @returns {object[]}
 */
function loadHistory(skill, options) {
  const baseDir = resolveDir(options);
  const dir = path.join(baseDir, skill);
  const files = listFiles(dir, '.json');

  const results = [];
  for (let i = 0; i < files.length; i++) {
    const data = readJSON(path.join(dir, files[i]));
    if (data) {
      results.push(data);
    }
  }

  // Sort by timestamp ascending
  results.sort(function (a, b) {
    const tsA = a.timestamp || '';
    const tsB = b.timestamp || '';
    return tsA < tsB ? -1 : tsA > tsB ? 1 : 0;
  });

  return results;
}

/**
 * Load evaluation history for all skills.
 *
 * @param {object} [options]
 * @param {string} [options.historyDir]
 * @returns {Object.<string, object[]>} map of skillName -> results[]
 */
function loadAllHistory(options) {
  const baseDir = resolveDir(options);
  const map = {};

  let dirs;
  try {
    dirs = fs.readdirSync(baseDir, { withFileTypes: true })
      .filter(function (d) { return d.isDirectory(); })
      .map(function (d) { return d.name; });
  } catch {
    return map;
  }

  for (let i = 0; i < dirs.length; i++) {
    const history = loadHistory(dirs[i], options);
    if (history.length > 0) {
      map[dirs[i]] = history;
    }
  }

  return map;
}

/**
 * Get the most recent evaluation result for a skill.
 *
 * @param {string} skill
 * @param {object} [options]
 * @param {string} [options.historyDir]
 * @returns {object|null}
 */
function getLatestResult(skill, options) {
  const history = loadHistory(skill, options);
  if (history.length === 0) {
    return null;
  }
  return history[history.length - 1];
}

// ---------------------------------------------------------------------------
// Trend
// ---------------------------------------------------------------------------

/**
 * Compute a simple trend from a history array.
 *
 * Compares the latest vs earliest `overall` score.
 *
 * @param {object[]} history — array of eval results (sorted ascending)
 * @returns {{improving: boolean, delta: number, dataPoints: number}}
 */
function computeTrend(history) {
  if (!Array.isArray(history) || history.length === 0) {
    return { improving: false, delta: 0, dataPoints: 0 };
  }

  if (history.length === 1) {
    return { improving: false, delta: 0, dataPoints: 1 };
  }

  const earliest = history[0];
  const latest = history[history.length - 1];

  const earlyScore = typeof earliest.overall === 'number' ? earliest.overall : 0;
  const latestScore = typeof latest.overall === 'number' ? latest.overall : 0;
  const delta = +(latestScore - earlyScore).toFixed(4);

  return {
    improving: delta > 0,
    delta: delta,
    dataPoints: history.length,
  };
}

// ---------------------------------------------------------------------------
// CLI entry (when run directly)
// ---------------------------------------------------------------------------

if (require.main === module) {
  const allHistory = loadAllHistory();
  const skills = Object.keys(allHistory);

  if (skills.length === 0) {
    console.log('No evaluation history found in', HISTORY_DIR);
  } else {
    console.log('=== Evaluation History ===');
    for (let i = 0; i < skills.length; i++) {
      const sk = skills[i];
      const hist = allHistory[sk];
      const trend = computeTrend(hist);
      console.log(
        '  %s: %d results, delta=%s, improving=%s',
        sk, hist.length, trend.delta, trend.improving
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  HISTORY_DIR,
  saveResult,
  loadHistory,
  loadAllHistory,
  getLatestResult,
  computeTrend,
};
