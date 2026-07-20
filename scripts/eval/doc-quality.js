'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Document quality and maintainability evaluator for openyida skills.
 *
 * Exports pure functions (no side effects except final file writes in
 * runDocQualityEval) that score each SKILL.md against standards and
 * maintainability criteria.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse YAML frontmatter from markdown content.
 * @param {string} content - Raw markdown text.
 * @returns {{name: string|null, description: string|null}|null}
 */
function parseFrontmatter(content) {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== '---') {
    return null;
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex < 0) {
    return null;
  }

  const block = lines.slice(1, endIndex).join('\n');

  function field(name) {
    const match = block.match(new RegExp('^' + name + ':\\s*(.*)$', 'm'));
    return match ? match[1].trim() : null;
  }

  return {
    name: field('name'),
    description: field('description'),
  };
}

/**
 * Extract all markdown link targets from content.
 * Returns an array of raw target strings (the part inside parentheses).
 */
function extractMarkdownLinks(content) {
  const results = [];
  const pattern = /!?\[[^\]\n]*\]\(([^)\n]+)\)/g;
  let match = pattern.exec(content);
  while (match) {
    const raw = match[1].trim().replace(/^<|>$/g, '');
    let target = raw.split(/\s+/)[0].split('#')[0];
    if (target) {
      try {
        target = decodeURIComponent(target);
      } catch (_e) {
        // keep as-is
      }
      results.push(target);
    }
    match = pattern.exec(content);
  }
  return results;
}

function isExternalLink(target) {
  return /^(https?:|mailto:|tel:|app:\/\/|plugin:\/\/|#)/i.test(target);
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

// ---------------------------------------------------------------------------
// D1a — Standards checks (0-100)
// ---------------------------------------------------------------------------

const STANDARDS_WEIGHTS = {
  frontmatter: 0.20,
  sections: 0.25,
  references: 0.20,
  examples: 0.15,
  disambiguation: 0.20,
};

function checkStandards(skillDir) {
  const skillFile = path.join(skillDir, 'SKILL.md');
  const content = readText(skillFile);
  const checks = [];

  // --- frontmatter (0.20) ---
  const fm = parseFrontmatter(content);
  let fmScore = 0;
  let fmDetail = '';
  if (fm && fm.name && fm.description) {
    fmScore = 1;
    fmDetail = 'name and description present';
  } else if (fm) {
    const missing = [];
    if (!fm.name) { missing.push('name'); }
    if (!fm.description) { missing.push('description'); }
    fmScore = 0.5;
    fmDetail = 'missing ' + missing.join(', ');
  } else {
    fmDetail = 'no frontmatter found';
  }
  checks.push({
    key: 'frontmatter',
    label: 'Frontmatter',
    score: fmScore * STANDARDS_WEIGHTS.frontmatter * 100,
    maxScore: STANDARDS_WEIGHTS.frontmatter * 100,
    detail: fmDetail,
  });

  // --- sections (0.25) ---
  const sectionPatterns = [
    /^##\s+工作流/m,
    /^##\s+触发条件/m,
    /^##\s+输出/m,
    /^##\s+步骤/m,
    /^##\s+Workflow/mi,
    /^##\s+When to use/mi,
    /^##\s+Output/mi,
    /(?:^|\n)1\.\s/,
    /(?:^|\n)2\.\s/,
    /Step\s+1/i,
  ];
  const matchedSections = sectionPatterns.filter(function(p) { return p.test(content); });
  const sectScore = matchedSections.length >= 3 ? 1 : matchedSections.length >= 1 ? 0.5 : 0;
  checks.push({
    key: 'sections',
    label: 'Required sections',
    score: sectScore * STANDARDS_WEIGHTS.sections * 100,
    maxScore: STANDARDS_WEIGHTS.sections * 100,
    detail: matchedSections.length + ' workflow/step markers found',
  });

  // --- references (0.20) ---
  const refsDir = path.join(skillDir, 'references');
  let refScore = 0;
  let refDetail = '';
  if (fs.existsSync(refsDir) && fs.statSync(refsDir).isDirectory()) {
    const refFiles = fs.readdirSync(refsDir).filter(function(f) {
      const fp = path.join(refsDir, f);
      return fs.statSync(fp).isFile();
    });
    if (refFiles.length === 0) {
      refScore = 0;
      refDetail = 'references/ exists but is empty';
    } else {
      const allNonEmpty = refFiles.every(function(f) {
        const fp = path.join(refsDir, f);
        return fs.statSync(fp).size > 0;
      });
      if (allNonEmpty) {
        refScore = 1;
        refDetail = refFiles.length + ' reference file(s), all non-empty';
      } else {
        const emptyFiles = refFiles.filter(function(f) {
          return fs.statSync(path.join(refsDir, f)).size === 0;
        });
        refScore = 0.5;
        refDetail = emptyFiles.length + ' empty reference file(s)';
      }
    }
  } else {
    // No references/ directory — neutral: give full marks (no files to be broken)
    refScore = 1;
    refDetail = 'no references/ directory (n/a)';
  }
  checks.push({
    key: 'references',
    label: 'References integrity',
    score: refScore * STANDARDS_WEIGHTS.references * 100,
    maxScore: STANDARDS_WEIGHTS.references * 100,
    detail: refDetail,
  });

  // --- examples (0.15) ---
  const hasCodeBlock = /```[\s\S]*?```/.test(content);
  const examplesDir = path.join(skillDir, 'examples');
  const hasExamplesDir = fs.existsSync(examplesDir) && fs.statSync(examplesDir).isDirectory();
  const hasExampleFiles = hasExamplesDir && fs.readdirSync(examplesDir).filter(function(f) {
    return fs.statSync(path.join(examplesDir, f)).isFile();
  }).length > 0;
  const exScore = (hasCodeBlock || hasExampleFiles) ? 1 : 0;
  const exDetail = [];
  if (hasCodeBlock) { exDetail.push('code block(s) in SKILL.md'); }
  if (hasExampleFiles) { exDetail.push('examples/ directory with files'); }
  if (exDetail.length === 0) { exDetail.push('no code blocks or examples/ files'); }
  checks.push({
    key: 'examples',
    label: 'Examples',
    score: exScore * STANDARDS_WEIGHTS.examples * 100,
    maxScore: STANDARDS_WEIGHTS.examples * 100,
    detail: exDetail.join('; '),
  });

  // --- disambiguation (0.20) ---
  const disambigPatterns = [
    /WHEN NOT/i,
    /不适用/,
    /不要使用/,
    /不要触发/,
    /DO NOT TRIGGER/i,
    /DO NOT USE/i,
    /不承担/,
    /严格禁止/,
    /NEVER DO/i,
    /不处理/,
  ];
  const hasDisambig = disambigPatterns.some(function(p) { return p.test(content); });
  checks.push({
    key: 'disambiguation',
    label: 'Disambiguation',
    score: (hasDisambig ? 1 : 0) * STANDARDS_WEIGHTS.disambiguation * 100,
    maxScore: STANDARDS_WEIGHTS.disambiguation * 100,
    detail: hasDisambig ? 'disambiguation text found' : 'no disambiguation text found',
  });

  const totalScore = checks.reduce(function(sum, c) { return sum + c.score; }, 0);

  return {
    score: Math.round(totalScore * 100) / 100,
    checks: checks,
  };
}

// ---------------------------------------------------------------------------
// D1b — Maintainability checks (0-100)
// ---------------------------------------------------------------------------

const MAINTAINABILITY_WEIGHTS = {
  fileSize: 0.15,
  refDepth: 0.20,
  refCount: 0.15,
  noCircular: 0.20,
  naming: 0.15,
  isolation: 0.15,
};

/**
 * Recursively follow markdown link chains within yida-skills to measure depth.
 * Returns the maximum depth found from the starting file.
 */
function measureRefDepth(startFile, visited, maxDepth) {
  if (visited.has(startFile)) {
    return maxDepth;
  }
  visited.add(startFile);

  if (!fs.existsSync(startFile) || !fs.statSync(startFile).isFile()) {
    return maxDepth;
  }

  const content = readText(startFile);
  const links = extractMarkdownLinks(content);

  for (let i = 0; i < links.length; i++) {
    const target = links[i];
    if (isExternalLink(target)) { continue; }
    const absTarget = path.resolve(path.dirname(startFile), target);
    if (!fs.existsSync(absTarget) || !fs.statSync(absTarget).isFile()) { continue; }
    if (!absTarget.endsWith('.md')) { continue; }
    const depth = measureRefDepth(absTarget, visited, maxDepth + 1);
    if (depth > maxDepth) {
      maxDepth = depth;
    }
  }

  return maxDepth;
}

/**
 * Detect circular references: follow markdown links within yida-skills, return
 * true if any cycle is found starting from startFile.
 */
function hasCircularRefs(startFile, skillsRootDir) {
  const stack = [startFile];
  const visited = new Set();

  while (stack.length > 0) {
    const file = stack.pop();
    if (visited.has(file)) {
      return true;
    }
    visited.add(file);

    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { continue; }

    const content = readText(file);
    const links = extractMarkdownLinks(content);

    for (let i = 0; i < links.length; i++) {
      const target = links[i];
      if (isExternalLink(target)) { continue; }
      const absTarget = path.resolve(path.dirname(file), target);
      if (!absTarget.endsWith('.md')) { continue; }
      if (!fs.existsSync(absTarget)) { continue; }
      // Only consider links within the skills root
      if (absTarget.indexOf(skillsRootDir) !== 0) { continue; }
      if (visited.has(absTarget)) {
        return true;
      }
      stack.push(absTarget);
    }
  }

  return false;
}

function checkMaintainability(skillDir, allSkillDirs) {
  const skillFile = path.join(skillDir, 'SKILL.md');
  const content = readText(skillFile);
  const checks = [];
  const skillDirName = path.basename(skillDir);
  const skillsRootDir = path.dirname(skillDir);

  // --- fileSize (0.15) ---
  const lineCount = content.split(/\r?\n/).length;
  const sizeScore = lineCount <= 500 ? 1 : lineCount <= 800 ? 0.5 : 0;
  checks.push({
    key: 'fileSize',
    label: 'File size',
    score: sizeScore * MAINTAINABILITY_WEIGHTS.fileSize * 100,
    maxScore: MAINTAINABILITY_WEIGHTS.fileSize * 100,
    detail: lineCount + ' lines' + (lineCount > 500 ? ' (exceeds 500)' : ''),
  });

  // --- refDepth (0.20) ---
  const depth = measureRefDepth(skillFile, new Set(), 0);
  const depthScore = depth <= 3 ? 1 : 0;
  checks.push({
    key: 'refDepth',
    label: 'Reference depth',
    score: depthScore * MAINTAINABILITY_WEIGHTS.refDepth * 100,
    maxScore: MAINTAINABILITY_WEIGHTS.refDepth * 100,
    detail: 'max depth ' + depth + (depth > 3 ? ' (exceeds 3)' : ''),
  });

  // --- refCount (0.15) ---
  const refsDir = path.join(skillDir, 'references');
  let refFileCount = 0;
  if (fs.existsSync(refsDir) && fs.statSync(refsDir).isDirectory()) {
    refFileCount = fs.readdirSync(refsDir).filter(function(f) {
      return fs.statSync(path.join(refsDir, f)).isFile();
    }).length;
  }
  const refCountScore = refFileCount <= 10 ? 1 : 0;
  checks.push({
    key: 'refCount',
    label: 'Reference count',
    score: refCountScore * MAINTAINABILITY_WEIGHTS.refCount * 100,
    maxScore: MAINTAINABILITY_WEIGHTS.refCount * 100,
    detail: refFileCount + ' file(s) in references/' + (refFileCount > 10 ? ' (exceeds 10)' : ''),
  });

  // --- noCircular (0.20) ---
  const circular = hasCircularRefs(skillFile, skillsRootDir);
  checks.push({
    key: 'noCircular',
    label: 'No circular references',
    score: (circular ? 0 : 1) * MAINTAINABILITY_WEIGHTS.noCircular * 100,
    maxScore: MAINTAINABILITY_WEIGHTS.noCircular * 100,
    detail: circular ? 'circular reference detected' : 'no circular references',
  });

  // --- naming (0.15) ---
  const fm = parseFrontmatter(content);
  let namingScore = 0;
  let namingDetail = '';
  if (fm && fm.name) {
    if (fm.name === skillDirName) {
      namingScore = 1;
      namingDetail = 'directory name matches frontmatter name';
    } else {
      namingDetail = 'directory "' + skillDirName + '" does not match frontmatter name "' + fm.name + '"';
    }
  } else {
    namingDetail = 'no frontmatter name to compare';
  }
  checks.push({
    key: 'naming',
    label: 'Naming consistency',
    score: namingScore * MAINTAINABILITY_WEIGHTS.naming * 100,
    maxScore: MAINTAINABILITY_WEIGHTS.naming * 100,
    detail: namingDetail,
  });

  // --- isolation (0.15) ---
  const links = extractMarkdownLinks(content);
  const isolationViolations = [];
  for (let i = 0; i < links.length; i++) {
    const target = links[i];
    if (isExternalLink(target)) { continue; }
    const absTarget = path.resolve(path.dirname(skillFile), target);
    // Check if this link points into another skill's references/ directory
    for (let j = 0; j < allSkillDirs.length; j++) {
      const otherDir = allSkillDirs[j];
      if (otherDir === skillDir) { continue; }
      const otherRefs = path.join(otherDir, 'references');
      if (absTarget.indexOf(otherRefs + path.sep) === 0 || absTarget === otherRefs) {
        isolationViolations.push(path.relative(skillDir, absTarget));
      }
    }
  }
  const isolationScore = isolationViolations.length === 0 ? 1 : 0;
  checks.push({
    key: 'isolation',
    label: 'Isolation',
    score: isolationScore * MAINTAINABILITY_WEIGHTS.isolation * 100,
    maxScore: MAINTAINABILITY_WEIGHTS.isolation * 100,
    detail: isolationViolations.length === 0
      ? 'does not reference other skills\' internal files'
      : 'references other skills\' files: ' + isolationViolations.join(', '),
  });

  const totalScore = checks.reduce(function(sum, c) { return sum + c.score; }, 0);

  return {
    score: Math.round(totalScore * 100) / 100,
    checks: checks,
  };
}

// ---------------------------------------------------------------------------
// Combined evaluation
// ---------------------------------------------------------------------------

function evaluateSkill(skillDir, allSkillDirs) {
  const skillName = path.basename(skillDir);
  const standards = checkStandards(skillDir);
  const maintainability = checkMaintainability(skillDir, allSkillDirs);
  const overall = Math.round((standards.score + maintainability.score) / 2 * 100) / 100;

  return {
    skill: skillName,
    standards: standards,
    maintainability: maintainability,
    overall: overall,
  };
}

function evaluateAllSkills(skillsRoot) {
  if (!fs.existsSync(skillsRoot)) {
    return [];
  }

  const allSkillDirs = fs.readdirSync(skillsRoot).filter(function(name) {
    const fullPath = path.join(skillsRoot, name);
    return fs.statSync(fullPath).isDirectory() &&
      fs.existsSync(path.join(fullPath, 'SKILL.md'));
  }).sort().map(function(name) {
    return path.join(skillsRoot, name);
  });

  return allSkillDirs.map(function(dir) {
    return evaluateSkill(dir, allSkillDirs);
  });
}

// ---------------------------------------------------------------------------
// Top-level runner
// ---------------------------------------------------------------------------

function runDocQualityEval(options) {
  options = options || {};
  const skillsRoot = options.skillsRoot || path.resolve(__dirname, '..', '..', 'yida-skills', 'skills');
  const thresholds = options.thresholds || { standards: 70, maintainability: 60 };
  const filterSkill = options.skill || null;

  const allResults = evaluateAllSkills(skillsRoot);

  const results = filterSkill
    ? allResults.filter(function(r) { return r.skill === filterSkill; })
    : allResults;

  const total = results.length;
  let sumStandards = 0;
  let sumMaintainability = 0;
  let sumOverall = 0;
  const belowThreshold = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    sumStandards += r.standards.score;
    sumMaintainability += r.maintainability.score;
    sumOverall += r.overall;

    if (r.standards.score < thresholds.standards ||
        r.maintainability.score < thresholds.maintainability) {
      belowThreshold.push({
        skill: r.skill,
        standards: r.standards.score,
        maintainability: r.maintainability.score,
      });
    }
  }

  const avg = function(sum) {
    return total > 0 ? Math.round(sum / total * 100) / 100 : 0;
  };

  return {
    results: results,
    summary: {
      total: total,
      avgStandards: avg(sumStandards),
      avgMaintainability: avg(sumMaintainability),
      avgOverall: avg(sumOverall),
      belowThreshold: belowThreshold,
    },
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  parseFrontmatter: parseFrontmatter,
  checkStandards: checkStandards,
  checkMaintainability: checkMaintainability,
  evaluateSkill: evaluateSkill,
  evaluateAllSkills: evaluateAllSkills,
  runDocQualityEval: runDocQualityEval,
};
