'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  loadSkillNames,
  loadScenarioSkills,
  loadCategories,
  loadGenerationCategories,
  computeSkillCoverage,
  computeCategoryCoverage,
  computeReferenceCoverage,
  computeCommandCoverage,
  runCoverageEval,
} = require('../scripts/eval/coverage');

// ---------------------------------------------------------------------------
// Helpers — build a temporary directory tree for each test
// ---------------------------------------------------------------------------

let tmpDir;

function mkdirs(...segments) {
  const dir = path.join(tmpDir, ...segments);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeFile(relPath, content) {
  const full = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-coverage-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// loadSkillNames
// ---------------------------------------------------------------------------

describe('loadSkillNames', () => {
  test('returns sorted directory names', () => {
    mkdirs('skills', 'skill-c');
    mkdirs('skills', 'skill-a');
    mkdirs('skills', 'skill-b');
    // drop a regular file — should be excluded
    writeFile('skills/not-a-dir.txt', 'ignore');

    const names = loadSkillNames(path.join(tmpDir, 'skills'));
    expect(names).toEqual(['skill-a', 'skill-b', 'skill-c']);
  });

  test('returns empty array for non-existent directory', () => {
    const names = loadSkillNames(path.join(tmpDir, 'does-not-exist'));
    expect(names).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// loadScenarioSkills
// ---------------------------------------------------------------------------

describe('loadScenarioSkills', () => {
  test('extracts expectedSkill values from JSON arrays', () => {
    writeFile('scenarios/test.json', JSON.stringify([
      { id: 's1', prompt: 'p1', expectedSkill: 'skill-a' },
      { id: 's2', prompt: 'p2', expectedSkill: 'skill-b' },
    ]));
    writeFile('scenarios/other.json', JSON.stringify([
      { id: 's3', prompt: 'p3', expectedSkill: 'skill-a' },
      { id: 's4', prompt: 'p4', expectedSkill: 'skill-c' },
    ]));

    const skills = loadScenarioSkills(path.join(tmpDir, 'scenarios'));
    expect(skills).toBeInstanceOf(Set);
    expect(Array.from(skills).sort()).toEqual(['skill-a', 'skill-b', 'skill-c']);
  });

  test('returns empty set for missing directory', () => {
    const skills = loadScenarioSkills(path.join(tmpDir, 'no-scenarios'));
    expect(skills).toBeInstanceOf(Set);
    expect(skills.size).toBe(0);
  });

  test('ignores non-array JSON and missing expectedSkill', () => {
    writeFile('scenarios/object.json', JSON.stringify({ not: 'an array' }));
    writeFile('scenarios/partial.json', JSON.stringify([
      { id: 's1', prompt: 'p1' }, // no expectedSkill
      { id: 's2', prompt: 'p2', expectedSkill: 'skill-x' },
    ]));

    const skills = loadScenarioSkills(path.join(tmpDir, 'scenarios'));
    expect(Array.from(skills)).toEqual(['skill-x']);
  });
});

// ---------------------------------------------------------------------------
// loadCategories
// ---------------------------------------------------------------------------

describe('loadCategories', () => {
  test('extracts unique categories from skills index', () => {
    const indexFile = writeFile('skills-index.json', JSON.stringify({
      version: 1,
      source: 'openyida',
      entry: 'openyida',
      skills: [
        { name: 'skill-a', path: 'skills/skill-a', display_name: 'A', description: 'd', category: 'yida/form', tags: ['tag'] },
        { name: 'skill-b', path: 'skills/skill-b', display_name: 'B', description: 'd', category: 'yida/report', tags: [] },
        { name: 'skill-c', path: 'skills/skill-c', display_name: 'C', description: 'd', category: 'yida/form', tags: [] },
      ],
    }));

    const cats = loadCategories(indexFile);
    expect(cats).toBeInstanceOf(Set);
    expect(Array.from(cats).sort()).toEqual(['yida/form', 'yida/report']);
  });

  test('returns empty set when index file is missing', () => {
    const cats = loadCategories(path.join(tmpDir, 'nope.json'));
    expect(cats.size).toBe(0);
  });

  test('returns empty set when skills array is absent', () => {
    const indexFile = writeFile('bad-index.json', JSON.stringify({ version: 1 }));
    const cats = loadCategories(indexFile);
    expect(cats.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// loadGenerationCategories
// ---------------------------------------------------------------------------

describe('loadGenerationCategories', () => {
  test('matches keywords from scenario text to categories', () => {
    // loadGenerationCategories reads DEFAULTS.indexFile internally, so we
    // only verify that it returns a Set (the real index file may or may not
    // exist in the test environment).
    const genDir = mkdirs('generation');
    writeFile('generation/gen.json', JSON.stringify([
      { id: 'form-test', prompt: '创建表单', note: '表单类' },
    ]));

    const covered = loadGenerationCategories(genDir);
    expect(covered).toBeInstanceOf(Set);
    // Cannot assert exact contents because it depends on DEFAULTS.indexFile,
    // but the function should not throw.
  });

  test('returns empty set for empty directory', () => {
    const genDir = mkdirs('generation-empty');
    const covered = loadGenerationCategories(genDir);
    expect(covered).toBeInstanceOf(Set);
    expect(covered.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeSkillCoverage
// ---------------------------------------------------------------------------

describe('computeSkillCoverage', () => {
  test('computes correct covered/total/rate/uncovered', () => {
    mkdirs('skills', 'skill-a');
    mkdirs('skills', 'skill-b');
    mkdirs('skills', 'skill-c');

    writeFile('scenarios/test.json', JSON.stringify([
      { expectedSkill: 'skill-a' },
      { expectedSkill: 'skill-b' },
    ]));

    const result = computeSkillCoverage({
      skillsDir: path.join(tmpDir, 'skills'),
      scenariosDir: path.join(tmpDir, 'scenarios'),
    });

    expect(result.covered).toBe(2);
    expect(result.total).toBe(3);
    expect(result.rate).toBeCloseTo(2 / 3, 4);
    expect(result.uncoveredSkills).toEqual(['skill-c']);
  });

  test('returns zero rate when no skills exist', () => {
    mkdirs('empty-skills');
    mkdirs('empty-scenarios');

    const result = computeSkillCoverage({
      skillsDir: path.join(tmpDir, 'empty-skills'),
      scenariosDir: path.join(tmpDir, 'empty-scenarios'),
    });

    expect(result.covered).toBe(0);
    expect(result.total).toBe(0);
    expect(result.rate).toBe(0);
    expect(result.uncoveredSkills).toEqual([]);
  });

  test('all skills covered yields rate 1', () => {
    mkdirs('skills2', 'alpha');
    mkdirs('skills2', 'beta');

    writeFile('scenarios2/s.json', JSON.stringify([
      { expectedSkill: 'alpha' },
      { expectedSkill: 'beta' },
    ]));

    const result = computeSkillCoverage({
      skillsDir: path.join(tmpDir, 'skills2'),
      scenariosDir: path.join(tmpDir, 'scenarios2'),
    });

    expect(result.covered).toBe(2);
    expect(result.total).toBe(2);
    expect(result.rate).toBe(1);
    expect(result.uncoveredSkills).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// computeCategoryCoverage
// ---------------------------------------------------------------------------

describe('computeCategoryCoverage', () => {
  test('computes correct covered/uncovered categories', () => {
    const indexFile = writeFile('cat-index.json', JSON.stringify({
      version: 1,
      source: 'openyida',
      entry: 'openyida',
      skills: [
        { name: 'a', category: 'yida/form' },
        { name: 'b', category: 'yida/report' },
        { name: 'c', category: 'yida/dashboard' },
      ],
    }));

    // computeCategoryCoverage calls loadGenerationCategories which uses
    // DEFAULTS.indexFile internally, so the generation matching depends on
    // the real project index. We can still verify the structure is correct
    // and that all categories from our custom index are loaded.
    const result = computeCategoryCoverage({ indexFile });

    expect(result.total).toBe(3);
    expect(typeof result.covered).toBe('number');
    expect(typeof result.rate).toBe('number');
    expect(Array.isArray(result.uncoveredCategories)).toBe(true);
    expect(result.covered + result.uncoveredCategories.length).toBe(result.total);
  });
});

// ---------------------------------------------------------------------------
// computeCommandCoverage
// ---------------------------------------------------------------------------

describe('computeCommandCoverage', () => {
  test('returns structure with null rate and a note', () => {
    const result = computeCommandCoverage();

    expect(result.covered).toBeNull();
    expect(result.rate).toBeNull();
    expect(typeof result.total).toBe('number');
    expect(typeof result.note).toBe('string');
    expect(result.note.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// computeReferenceCoverage
// ---------------------------------------------------------------------------

describe('computeReferenceCoverage', () => {
  test('detects used vs unused reference files', () => {
    mkdirs('skills', 'skill-a');
    mkdirs('skills', 'skill-b');
    writeFile('skills/skill-a/SKILL.md', '# Skill A\n\nSee ref-used.md for details.');
    writeFile('skills/skill-b/SKILL.md', '# Skill B\n\nNo references here.');

    writeFile('references/ref-used.md', '# Used Reference');
    writeFile('references/ref-unused.md', '# Unused Reference');

    const result = computeReferenceCoverage({
      referencesDir: path.join(tmpDir, 'references'),
      skillsDir: path.join(tmpDir, 'skills'),
    });

    expect(result.used).toBe(1);
    expect(result.total).toBe(2);
    expect(result.rate).toBe(0.5);
    expect(result.unusedFiles).toEqual(['ref-unused.md']);
  });

  test('returns zeros when references directory is empty', () => {
    mkdirs('refs-empty');
    mkdirs('skills-empty');

    const result = computeReferenceCoverage({
      referencesDir: path.join(tmpDir, 'refs-empty'),
      skillsDir: path.join(tmpDir, 'skills-empty'),
    });

    expect(result.used).toBe(0);
    expect(result.total).toBe(0);
    expect(result.rate).toBe(0);
    expect(result.unusedFiles).toEqual([]);
  });

  test('all references used yields rate 1', () => {
    mkdirs('skills', 'skill-x');
    writeFile('skills/skill-x/SKILL.md', 'Uses both a.md and b.md in this doc.');

    writeFile('refs/a.md', 'ref a');
    writeFile('refs/b.md', 'ref b');

    const result = computeReferenceCoverage({
      referencesDir: path.join(tmpDir, 'refs'),
      skillsDir: path.join(tmpDir, 'skills'),
    });

    expect(result.used).toBe(2);
    expect(result.total).toBe(2);
    expect(result.rate).toBe(1);
    expect(result.unusedFiles).toEqual([]);
  });

  test('skill directories without SKILL.md are silently skipped', () => {
    mkdirs('skills', 'skill-no-md');
    writeFile('refs2/only.md', 'ref content');

    const result = computeReferenceCoverage({
      referencesDir: path.join(tmpDir, 'refs2'),
      skillsDir: path.join(tmpDir, 'skills'),
    });

    expect(result.used).toBe(0);
    expect(result.total).toBe(1);
    expect(result.unusedFiles).toEqual(['only.md']);
  });
});

// ---------------------------------------------------------------------------
// runCoverageEval
// ---------------------------------------------------------------------------

describe('runCoverageEval', () => {
  test('overall is weighted average and all sub-results present', () => {
    // Set up skills
    mkdirs('skills', 'skill-a');
    mkdirs('skills', 'skill-b');
    writeFile('skills/skill-a/SKILL.md', 'Uses ref-used.md here.');
    writeFile('skills/skill-b/SKILL.md', 'No refs.');

    // Set up scenarios — skill-a covered, skill-b not
    writeFile('scenarios/s.json', JSON.stringify([
      { expectedSkill: 'skill-a' },
    ]));

    // Set up references
    writeFile('references/ref-used.md', 'used');
    writeFile('references/ref-unused.md', 'unused');

    // Set up index for categories
    const indexFile = writeFile('skills-index.json', JSON.stringify({
      version: 1,
      source: 'openyida',
      entry: 'openyida',
      skills: [
        { name: 'skill-a', category: 'yida/form' },
        { name: 'skill-b', category: 'yida/report' },
      ],
    }));

    // Generation dir (empty — no categories covered via generation)
    mkdirs('generation');

    const result = runCoverageEval({
      skillsDir: path.join(tmpDir, 'skills'),
      scenariosDir: path.join(tmpDir, 'scenarios'),
      generationDir: path.join(tmpDir, 'generation'),
      indexFile: indexFile,
      referencesDir: path.join(tmpDir, 'references'),
    });

    // Structure checks
    expect(result).toHaveProperty('skillCoverage');
    expect(result).toHaveProperty('categoryCoverage');
    expect(result).toHaveProperty('commandCoverage');
    expect(result).toHaveProperty('referenceCoverage');
    expect(result).toHaveProperty('overall');

    // Skill: 1/2
    expect(result.skillCoverage.covered).toBe(1);
    expect(result.skillCoverage.total).toBe(2);
    expect(result.skillCoverage.rate).toBe(0.5);
    expect(result.skillCoverage.uncoveredSkills).toEqual(['skill-b']);

    // Reference: 1/2
    expect(result.referenceCoverage.used).toBe(1);
    expect(result.referenceCoverage.total).toBe(2);
    expect(result.referenceCoverage.rate).toBe(0.5);

    // Command: placeholder
    expect(result.commandCoverage.covered).toBeNull();
    expect(result.commandCoverage.rate).toBeNull();

    // Overall: weighted average of skill (40%), category (30%), reference (30%)
    // All three have numeric rates, so totalWeight = 1.0
    const skillRate = result.skillCoverage.rate;
    const catRate = result.categoryCoverage.rate;
    const refRate = result.referenceCoverage.rate;
    const expected = +(skillRate * 0.4 + catRate * 0.3 + refRate * 0.3).toFixed(4);
    expect(result.overall).toBe(expected);
  });

  test('overall is 0 when all metrics are zero', () => {
    mkdirs('empty-skills');
    mkdirs('empty-scenarios');
    mkdirs('empty-gen');
    mkdirs('empty-refs');

    const indexFile = writeFile('empty-index.json', JSON.stringify({
      version: 1,
      skills: [],
    }));

    const result = runCoverageEval({
      skillsDir: path.join(tmpDir, 'empty-skills'),
      scenariosDir: path.join(tmpDir, 'empty-scenarios'),
      generationDir: path.join(tmpDir, 'empty-gen'),
      indexFile: indexFile,
      referencesDir: path.join(tmpDir, 'empty-refs'),
    });

    expect(result.overall).toBe(0);
    expect(result.skillCoverage.rate).toBe(0);
    expect(result.referenceCoverage.rate).toBe(0);
  });
});
