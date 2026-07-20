'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  parseFrontmatter,
  checkStandards,
  checkMaintainability,
  evaluateSkill,
  evaluateAllSkills,
  runDocQualityEval,
} = require('../scripts/eval/doc-quality');

// ---------------------------------------------------------------------------
// Helpers — build temp skill directory tree
// ---------------------------------------------------------------------------

let tmpDir;

const GOOD_SKILL_MD = [
  '---',
  'name: skill-good',
  'description: A well-documented skill for testing',
  '---',
  '',
  '# Skill Good',
  '',
  '## Workflow',
  '',
  '## When to use',
  '',
  '## Output',
  '',
  '1. First step',
  '2. Second step',
  '',
  'Step 1: do something.',
  '',
  '```js',
  'console.log("example");',
  '```',
  '',
  'WHEN NOT to trigger: do not use this skill for unrelated tasks.',
  '',
  'DO NOT TRIGGER this skill when the user asks about other topics.',
  '',
].join('\n');

function buildBadSkillMd() {
  // >800 lines, no frontmatter, no sections, no examples, no disambiguation
  const lines = ['# Bad Skill', ''];
  for (let i = 0; i < 810; i++) {
    lines.push('This is filler line ' + (i + 1) + '.');
  }
  return lines.join('\n');
}

const MID_SKILL_MD = [
  '---',
  'name: skill-mid',
  '---',
  '',
  '# Skill Mid',
  '',
  '## Workflow',
  '',
  'Some workflow description.',
  '',
].join('\n');

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-eval-doc-'));

  // skill-good: full quality
  const goodDir = path.join(tmpDir, 'skill-good');
  fs.mkdirSync(goodDir, { recursive: true });
  fs.writeFileSync(path.join(goodDir, 'SKILL.md'), GOOD_SKILL_MD);
  const goodRefs = path.join(goodDir, 'references');
  fs.mkdirSync(goodRefs);
  fs.writeFileSync(path.join(goodRefs, 'api.md'), '# API Reference\nSome content.');

  // skill-bad: minimal quality
  const badDir = path.join(tmpDir, 'skill-bad');
  fs.mkdirSync(badDir, { recursive: true });
  fs.writeFileSync(path.join(badDir, 'SKILL.md'), buildBadSkillMd());

  // skill-mid: partial quality
  const midDir = path.join(tmpDir, 'skill-mid');
  fs.mkdirSync(midDir, { recursive: true });
  fs.writeFileSync(path.join(midDir, 'SKILL.md'), MID_SKILL_MD);
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// parseFrontmatter
// ---------------------------------------------------------------------------

describe('parseFrontmatter', () => {
  test('returns name and description from valid frontmatter', () => {
    const result = parseFrontmatter(GOOD_SKILL_MD);
    expect(result).toEqual({
      name: 'skill-good',
      description: 'A well-documented skill for testing',
    });
  });

  test('returns null when content has no frontmatter', () => {
    const result = parseFrontmatter('# Just a heading\nSome content.');
    expect(result).toBeNull();
  });

  test('returns null for missing fields when frontmatter is partial', () => {
    const result = parseFrontmatter(MID_SKILL_MD);
    expect(result).not.toBeNull();
    expect(result.name).toBe('skill-mid');
    expect(result.description).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// checkStandards
// ---------------------------------------------------------------------------

describe('checkStandards', () => {
  test('skill with all sections/examples/disambiguation scores high', () => {
    const result = checkStandards(path.join(tmpDir, 'skill-good'));
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  test('minimal skill with no sections/examples/disambiguation scores low', () => {
    const result = checkStandards(path.join(tmpDir, 'skill-bad'));
    expect(result.score).toBeLessThan(30);
  });

  test('each expected key is present in checks', () => {
    const result = checkStandards(path.join(tmpDir, 'skill-good'));
    const keys = result.checks.map(function(c) { return c.key; });
    expect(keys).toContain('frontmatter');
    expect(keys).toContain('sections');
    expect(keys).toContain('references');
    expect(keys).toContain('examples');
    expect(keys).toContain('disambiguation');
  });

  test('each check has label, score, maxScore, and detail', () => {
    const result = checkStandards(path.join(tmpDir, 'skill-mid'));
    result.checks.forEach(function(c) {
      expect(c).toHaveProperty('label');
      expect(typeof c.score).toBe('number');
      expect(typeof c.maxScore).toBe('number');
      expect(typeof c.detail).toBe('string');
    });
  });
});

// ---------------------------------------------------------------------------
// checkMaintainability
// ---------------------------------------------------------------------------

describe('checkMaintainability', () => {
  let allSkillDirs;

  beforeAll(() => {
    allSkillDirs = ['skill-good', 'skill-bad', 'skill-mid'].map(function(n) {
      return path.join(tmpDir, n);
    });
  });

  test('skill with <500 lines, no circular refs, matching name scores high', () => {
    const result = checkMaintainability(path.join(tmpDir, 'skill-good'), allSkillDirs);
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  test('skill with >800 lines scores 0 on fileSize check', () => {
    const result = checkMaintainability(path.join(tmpDir, 'skill-bad'), allSkillDirs);
    const fileSizeCheck = result.checks.find(function(c) { return c.key === 'fileSize'; });
    expect(fileSizeCheck.score).toBe(0);
  });

  test('naming mismatch is detected when frontmatter name differs from directory', () => {
    // skill-bad has no frontmatter at all, so naming score should be 0
    const result = checkMaintainability(path.join(tmpDir, 'skill-bad'), allSkillDirs);
    const namingCheck = result.checks.find(function(c) { return c.key === 'naming'; });
    expect(namingCheck.score).toBe(0);
    expect(namingCheck.detail).toMatch(/no frontmatter name/);
  });

  test('each expected key is present in checks', () => {
    const result = checkMaintainability(path.join(tmpDir, 'skill-good'), allSkillDirs);
    const keys = result.checks.map(function(c) { return c.key; });
    expect(keys).toContain('fileSize');
    expect(keys).toContain('refDepth');
    expect(keys).toContain('refCount');
    expect(keys).toContain('noCircular');
    expect(keys).toContain('naming');
    expect(keys).toContain('isolation');
  });
});

// ---------------------------------------------------------------------------
// evaluateSkill
// ---------------------------------------------------------------------------

describe('evaluateSkill', () => {
  test('returns combined scores with overall as average of standards and maintainability', () => {
    const allSkillDirs = ['skill-good', 'skill-bad', 'skill-mid'].map(function(n) {
      return path.join(tmpDir, n);
    });
    const result = evaluateSkill(path.join(tmpDir, 'skill-good'), allSkillDirs);

    expect(result).toHaveProperty('skill', 'skill-good');
    expect(result).toHaveProperty('standards');
    expect(result).toHaveProperty('maintainability');
    expect(typeof result.overall).toBe('number');

    // overall should be the average of the two scores (rounded)
    const expected = Math.round((result.standards.score + result.maintainability.score) / 2 * 100) / 100;
    expect(result.overall).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// evaluateAllSkills
// ---------------------------------------------------------------------------

describe('evaluateAllSkills', () => {
  test('returns array matching number of skill directories', () => {
    const results = evaluateAllSkills(tmpDir);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(3);

    const names = results.map(function(r) { return r.skill; }).sort();
    expect(names).toEqual(['skill-bad', 'skill-good', 'skill-mid']);
  });

  test('returns empty array for non-existent directory', () => {
    const results = evaluateAllSkills(path.join(tmpDir, 'does-not-exist'));
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// runDocQualityEval
// ---------------------------------------------------------------------------

describe('runDocQualityEval', () => {
  test('returns results and summary with correct total', () => {
    const output = runDocQualityEval({ skillsRoot: tmpDir });
    expect(output).toHaveProperty('results');
    expect(output).toHaveProperty('summary');
    expect(output.summary.total).toBe(3);
    expect(typeof output.summary.avgStandards).toBe('number');
    expect(typeof output.summary.avgMaintainability).toBe('number');
    expect(typeof output.summary.avgOverall).toBe('number');
    expect(Array.isArray(output.summary.belowThreshold)).toBe(true);
  });

  test('filters by skill name', () => {
    const output = runDocQualityEval({ skillsRoot: tmpDir, skill: 'skill-good' });
    expect(output.results.length).toBe(1);
    expect(output.results[0].skill).toBe('skill-good');
    expect(output.summary.total).toBe(1);
  });

  test('belowThreshold reports skills under threshold', () => {
    // Use a very high threshold so skill-bad definitely fails
    const output = runDocQualityEval({
      skillsRoot: tmpDir,
      thresholds: { standards: 90, maintainability: 90 },
    });
    const belowNames = output.summary.belowThreshold.map(function(b) { return b.skill; });
    expect(belowNames).toContain('skill-bad');
  });

  test('thresholds work — low thresholds produce fewer violations', () => {
    const strict = runDocQualityEval({
      skillsRoot: tmpDir,
      thresholds: { standards: 95, maintainability: 95 },
    });
    const lenient = runDocQualityEval({
      skillsRoot: tmpDir,
      thresholds: { standards: 1, maintainability: 1 },
    });
    expect(strict.summary.belowThreshold.length).toBeGreaterThanOrEqual(
      lenient.summary.belowThreshold.length
    );
  });
});
