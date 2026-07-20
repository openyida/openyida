'use strict';

/**
 * Coverage analysis for the openyida skill evaluation system.
 *
 * Computes four coverage metrics:
 *   1. skillCoverage     — how many skills have routing test scenarios
 *   2. categoryCoverage  — how many skill categories have generation test scenarios
 *   3. commandCoverage   — how many CLI commands are exercised (placeholder)
 *   4. referenceCoverage — how many shared reference files are actually used
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULTS = {
  skillsDir: path.join(ROOT, 'yida-skills', 'skills'),
  scenariosDir: path.join(ROOT, 'scripts', 'eval', 'scenarios'),
  generationDir: path.join(ROOT, 'scripts', 'eval', 'scenarios', 'generation'),
  indexFile: path.join(ROOT, 'yida-skills', 'skills-index.json'),
  referencesDir: path.join(ROOT, 'yida-skills', 'references'),
};

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
 * List immediate subdirectory names under `dir`.
 */
function listDirs(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
  } catch {
    return [];
  }
}

/**
 * List files matching an extension under `dir` (non-recursive).
 */
function listFiles(dir, ext) {
  try {
    return fs.readdirSync(dir)
      .filter(f => f.endsWith(ext));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

/**
 * Load all skill directory names under `skillsDir`.
 * @param {string} skillsDir
 * @returns {string[]}
 */
function loadSkillNames(skillsDir) {
  return listDirs(skillsDir || DEFAULTS.skillsDir).sort();
}

/**
 * Scan all *.json scenario files in `scenariosDir` (non-recursive) and
 * collect unique `expectedSkill` values.
 * @param {string} scenariosDir
 * @returns {Set<string>}
 */
function loadScenarioSkills(scenariosDir) {
  const dir = scenariosDir || DEFAULTS.scenariosDir;
  const skills = new Set();
  const files = listFiles(dir, '.json');

  for (let i = 0; i < files.length; i++) {
    const data = readJSON(path.join(dir, files[i]));
    if (!Array.isArray(data)) {continue;}
    for (let j = 0; j < data.length; j++) {
      if (data[j] && typeof data[j].expectedSkill === 'string') {
        skills.add(data[j].expectedSkill);
      }
    }
  }

  return skills;
}

/**
 * Load all unique category strings from the skills index file.
 * @param {string} indexFile
 * @returns {Set<string>}
 */
function loadCategories(indexFile) {
  const data = readJSON(indexFile || DEFAULTS.indexFile);
  const categories = new Set();

  if (!data || !Array.isArray(data.skills)) {return categories;}

  for (let i = 0; i < data.skills.length; i++) {
    const skill = data.skills[i];
    if (skill && typeof skill.category === 'string') {
      categories.add(skill.category);
    }
  }

  return categories;
}

/**
 * Best-effort extraction of covered categories from generation scenario files.
 *
 * Strategy: read each generation JSON file, extract scenario `id` and `note`
 * fields, then match them against category keywords (the part after the `/`
 * in categories like "yida/form", "yida/report", etc.).
 *
 * This is intentionally fuzzy — generation scenarios don't carry an explicit
 * `category` field, so we map by keyword overlap.
 *
 * @param {string} genDir
 * @returns {Set<string>}
 */
function loadGenerationCategories(genDir) {
  const dir = genDir || DEFAULTS.generationDir;
  const covered = new Set();
  const files = listFiles(dir, '.json');

  // Collect all text tokens from generation scenarios
  const tokens = [];
  for (let i = 0; i < files.length; i++) {
    const data = readJSON(path.join(dir, files[i]));
    if (!Array.isArray(data)) {continue;}
    for (let j = 0; j < data.length; j++) {
      const scenario = data[j];
      if (!scenario) {continue;}
      const text = [
        scenario.id || '',
        scenario.note || '',
        scenario.prompt || '',
      ].join(' ').toLowerCase();
      tokens.push(text);
    }
  }

  // Map category keywords to full category strings
  const allCategories = loadCategories(DEFAULTS.indexFile);
  const categoryArray = Array.from(allCategories);

  // Build keyword map: extract the part after '/' and also the full category
  const keywordMap = {};
  for (let k = 0; k < categoryArray.length; k++) {
    const cat = categoryArray[k];
    const parts = cat.split('/');
    const keyword = parts[parts.length - 1].toLowerCase();
    if (!keywordMap[keyword]) {
      keywordMap[keyword] = cat;
    }
  }

  // Match tokens against keywords
  const keywords = Object.keys(keywordMap);
  for (let ti = 0; ti < tokens.length; ti++) {
    for (let ki = 0; ki < keywords.length; ki++) {
      if (tokens[ti].indexOf(keywords[ki]) !== -1) {
        covered.add(keywordMap[keywords[ki]]);
      }
    }
  }

  return covered;
}

// ---------------------------------------------------------------------------
// Coverage computers
// ---------------------------------------------------------------------------

/**
 * Compute skill coverage: how many skills have routing test scenarios.
 * @param {object} [options]
 * @returns {{covered: number, total: number, rate: number, uncoveredSkills: string[]}}
 */
function computeSkillCoverage(options) {
  const opts = options || {};
  const skillNames = loadSkillNames(opts.skillsDir);
  const scenarioSkills = loadScenarioSkills(opts.scenariosDir);

  const uncovered = [];
  for (let i = 0; i < skillNames.length; i++) {
    if (!scenarioSkills.has(skillNames[i])) {
      uncovered.push(skillNames[i]);
    }
  }

  const total = skillNames.length;
  const covered = total - uncovered.length;

  return {
    covered: covered,
    total: total,
    rate: total > 0 ? +(covered / total).toFixed(4) : 0,
    uncoveredSkills: uncovered,
  };
}

/**
 * Compute category coverage: how many skill categories have generation scenarios.
 * @param {object} [options]
 * @returns {{covered: number, total: number, rate: number, uncoveredCategories: string[]}}
 */
function computeCategoryCoverage(options) {
  const opts = options || {};
  const allCategories = loadCategories(opts.indexFile);
  const coveredCategories = loadGenerationCategories(opts.generationDir);

  const allArray = Array.from(allCategories);
  const uncovered = [];
  for (let i = 0; i < allArray.length; i++) {
    if (!coveredCategories.has(allArray[i])) {
      uncovered.push(allArray[i]);
    }
  }

  const total = allArray.length;
  const covered = total - uncovered.length;

  return {
    covered: covered,
    total: total,
    rate: total > 0 ? +(covered / total).toFixed(4) : 0,
    uncoveredCategories: uncovered,
  };
}

/**
 * Compute command coverage (placeholder).
 *
 * Determining which CLI commands are actually exercised requires runtime data
 * from e2e/generate runs, so this returns a structure with null rate.
 *
 * @param {object} [options]
 * @returns {{covered: null, total: number, rate: null, note: string}}
 */
function computeCommandCoverage(_options) {
  let COMMAND_GROUPS;
  try {
    COMMAND_GROUPS = require('../../lib/core/command-manifest').COMMAND_GROUPS;
  } catch {
    return {
      covered: null,
      total: 0,
      rate: null,
      note: 'could not load COMMAND_GROUPS from command-manifest',
    };
  }

  let total = 0;
  for (let i = 0; i < COMMAND_GROUPS.length; i++) {
    total += COMMAND_GROUPS[i].commands.length;
  }

  return {
    covered: null,
    total: total,
    rate: null,
    note: 'requires runtime data from e2e/generate runs',
  };
}

/**
 * Compute reference coverage: how many shared reference .md files under
 * `yida-skills/references/` are actually referenced from any SKILL.md.
 *
 * @param {object} [options]
 * @returns {{used: number, total: number, rate: number, unusedFiles: string[]}}
 */
function computeReferenceCoverage(options) {
  const opts = options || {};
  const refsDir = opts.referencesDir || DEFAULTS.referencesDir;
  const skillsDir = opts.skillsDir || DEFAULTS.skillsDir;

  // List all .md files under the shared references directory
  const refFiles = listFiles(refsDir, '.md');

  if (refFiles.length === 0) {
    return { used: 0, total: 0, rate: 0, unusedFiles: [] };
  }

  // Collect all SKILL.md content across all skills
  const skillDirs = listDirs(skillsDir);
  let allSkillContent = '';

  for (let i = 0; i < skillDirs.length; i++) {
    const skillMdPath = path.join(skillsDir, skillDirs[i], 'SKILL.md');
    try {
      allSkillContent += fs.readFileSync(skillMdPath, 'utf8') + '\n';
    } catch {
      // Skill directory without SKILL.md — skip
    }
  }

  // Check which reference filenames appear in any SKILL.md
  const unused = [];
  for (let j = 0; j < refFiles.length; j++) {
    if (allSkillContent.indexOf(refFiles[j]) === -1) {
      unused.push(refFiles[j]);
    }
  }

  const total = refFiles.length;
  const used = total - unused.length;

  return {
    used: used,
    total: total,
    rate: total > 0 ? +(used / total).toFixed(4) : 0,
    unusedFiles: unused,
  };
}

// ---------------------------------------------------------------------------
// Aggregated runner
// ---------------------------------------------------------------------------

/**
 * Run all coverage evaluations and return a combined result with an overall
 * weighted average (excluding commandCoverage which has null rate).
 *
 * @param {object} [options]
 * @returns {{skillCoverage, categoryCoverage, commandCoverage, referenceCoverage, overall: number}}
 */
function runCoverageEval(options) {
  const opts = options || {};

  const skill = computeSkillCoverage(opts);
  const category = computeCategoryCoverage(opts);
  const command = computeCommandCoverage(opts);
  const reference = computeReferenceCoverage(opts);

  // Weighted average of metrics that have a numeric rate.
  // Weights: skill 40%, category 30%, reference 30%.
  const weights = [
    { rate: skill.rate, weight: 0.4 },
    { rate: category.rate, weight: 0.3 },
    { rate: reference.rate, weight: 0.3 },
  ];

  let totalWeight = 0;
  let weightedSum = 0;
  for (let i = 0; i < weights.length; i++) {
    if (typeof weights[i].rate === 'number') {
      weightedSum += weights[i].rate * weights[i].weight;
      totalWeight += weights[i].weight;
    }
  }

  const overall = totalWeight > 0 ? +(weightedSum / totalWeight).toFixed(4) : 0;

  return {
    skillCoverage: skill,
    categoryCoverage: category,
    commandCoverage: command,
    referenceCoverage: reference,
    overall: overall,
  };
}

// ---------------------------------------------------------------------------
// CLI entry (when run directly)
// ---------------------------------------------------------------------------

if (require.main === module) {
  const result = runCoverageEval();

  const pct = function (rate) { return (rate * 100).toFixed(1) + '%'; };

  console.log('=== Skill Coverage ===');
  console.log('  covered: %d / %d  (%s)', result.skillCoverage.covered, result.skillCoverage.total, pct(result.skillCoverage.rate));
  if (result.skillCoverage.uncoveredSkills.length > 0) {
    console.log('  uncovered:', result.skillCoverage.uncoveredSkills.join(', '));
  }

  console.log('\n=== Category Coverage ===');
  console.log('  covered: %d / %d  (%s)', result.categoryCoverage.covered, result.categoryCoverage.total, pct(result.categoryCoverage.rate));
  if (result.categoryCoverage.uncoveredCategories.length > 0) {
    console.log('  uncovered:', result.categoryCoverage.uncoveredCategories.join(', '));
  }

  console.log('\n=== Command Coverage ===');
  console.log('  total commands: %d', result.commandCoverage.total);
  console.log('  note: %s', result.commandCoverage.note);

  console.log('\n=== Reference Coverage ===');
  console.log('  used: %d / %d  (%s)', result.referenceCoverage.used, result.referenceCoverage.total, pct(result.referenceCoverage.rate));
  if (result.referenceCoverage.unusedFiles.length > 0) {
    console.log('  unused:', result.referenceCoverage.unusedFiles.join(', '));
  }

  console.log('\n=== Overall ===');
  console.log('  weighted average: %s', pct(result.overall));
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  loadSkillNames,
  loadScenarioSkills,
  loadCategories,
  loadGenerationCategories,
  computeSkillCoverage,
  computeCategoryCoverage,
  computeCommandCoverage,
  computeReferenceCoverage,
  runCoverageEval,
};
