#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKILLS_ROOT = path.join(ROOT, 'yida-skills');
const SKILLS_DIR = path.join(SKILLS_ROOT, 'skills');
const INDEX_FILE = path.join(SKILLS_ROOT, 'SKILL.md');
const SKILLS_INDEX_FILE = path.join(SKILLS_ROOT, 'skills-index.json');
const GENERATED_SKILL_ROOT = path.join(ROOT, 'dist', 'skills', 'openyida');
const MAX_RECOMMENDED_LINES = 500;
const SKILLS_INDEX_ENTRY_ALLOWED_FIELDS = new Set([
  'name',
  'path',
  'display_name',
  'description',
  'category',
  'tags',
  'aliases',
  'positive_signals',
  'negative_signals',
  'command_ids',
  'done_when',
  'priority',
  'requires',
  'capabilities',
  'modes',
  'requires_login',
]);
const SKILLS_INDEX_PROMPT_FIELDS = new Set([
  'prompt',
  'instructions',
  'rules',
  'workflow',
  'steps',
  'doneWhen',
  'optionalAfterDone',
]);

const errors = [];
const warnings = [];

function toRelative(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function collectMarkdownFiles(dir, files) {
  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectMarkdownFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
}

function parseFrontmatter(content) {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== '---') {
    return null;
  }

  const endIndex = lines.findIndex(function(line, index) {
    return index > 0 && line === '---';
  });

  if (endIndex < 0) {
    return null;
  }

  return lines.slice(1, endIndex).join('\n');
}

function frontmatterField(frontmatter, fieldName) {
  const match = frontmatter.match(new RegExp('^' + fieldName + ':\\s*(.*)$', 'm'));
  if (!match) {
    return null;
  }

  return match[1].trim();
}

function isDeprecatedSkill(skillFile) {
  const content = readText(skillFile);
  const frontmatter = parseFrontmatter(content) || '';
  return /已废弃|deprecated/i.test(frontmatter);
}

function validateSkillFrontmatter(skillDirName, skillFile) {
  const content = readText(skillFile);
  const frontmatter = parseFrontmatter(content);

  if (!frontmatter) {
    errors.push(toRelative(skillFile) + ': missing YAML frontmatter');
    return;
  }

  const name = frontmatterField(frontmatter, 'name');
  const description = frontmatterField(frontmatter, 'description');

  if (!name) {
    errors.push(toRelative(skillFile) + ': missing frontmatter field "name"');
  } else if (name !== skillDirName) {
    errors.push(toRelative(skillFile) + ': frontmatter name must match directory name "' + skillDirName + '"');
  }

  if (!description) {
    errors.push(toRelative(skillFile) + ': missing frontmatter field "description"');
  }

  const lineCount = content.split(/\r?\n/).length;
  if (lineCount > MAX_RECOMMENDED_LINES) {
    warnings.push(
      toRelative(skillFile) + ': ' + lineCount + ' lines, consider moving rarely used details into references/'
    );
  }
}

function validateRootSkillFrontmatter() {
  const content = readText(INDEX_FILE);
  const frontmatter = parseFrontmatter(content);

  if (!frontmatter) {
    errors.push(toRelative(INDEX_FILE) + ': missing YAML frontmatter');
    return;
  }

  const fieldNames = frontmatter.split(/\r?\n/).filter(function(line) {
    return /^[a-zA-Z0-9_-]+:\s*/.test(line);
  }).map(function(line) {
    return line.split(':')[0];
  });

  const allowedFields = ['name', 'description'];
  const unexpectedFields = fieldNames.filter(function(fieldName) {
    return !allowedFields.includes(fieldName);
  });

  if (unexpectedFields.length > 0) {
    errors.push(toRelative(INDEX_FILE) + ': Wukong root skill frontmatter must only contain name and description');
  }

  const name = frontmatterField(frontmatter, 'name');
  if (name !== 'openyida') {
    errors.push(toRelative(INDEX_FILE) + ': root skill name must be "openyida"');
  }

  const description = frontmatterField(frontmatter, 'description');
  if (!description) {
    errors.push(toRelative(INDEX_FILE) + ': missing frontmatter field "description"');
  } else {
    const normalizedDescription = frontmatter.replace(/^description:\s*>?\s*/m, '').trim();
    if (!/不要触发|不触发|DO NOT TRIGGER/i.test(normalizedDescription)) {
      errors.push(toRelative(INDEX_FILE) + ': root description must include a do-not-trigger boundary');
    }
  }
}

function validateIndexEntry(skillDirName, skillFile) {
  if (!fs.existsSync(INDEX_FILE)) {
    errors.push(toRelative(INDEX_FILE) + ': missing root skill index');
    return;
  }

  if (isDeprecatedSkill(skillFile)) {
    return;
  }

  const indexText = readText(INDEX_FILE);
  const expectedPath = 'skills/' + skillDirName + '/SKILL.md';
  // Support both old format (explicit path) and new grouped format (backtick skill name)
  const skillNameRef = '`' + skillDirName + '`';
  if (!indexText.includes(expectedPath) && !indexText.includes(skillNameRef)) {
    errors.push(toRelative(skillFile) + ': missing from yida-skills/SKILL.md index as ' + expectedPath + ' or ' + skillNameRef);
  }
}

function validateSkillsIndex(skillDirNames, options = {}) {
  const indexFile = options.indexFile || SKILLS_INDEX_FILE;
  const indexRoot = options.indexRoot || SKILLS_ROOT;
  const pathPattern = options.pathPattern || /^skills\/[a-z0-9-]+\/SKILL\.md$/;
  const pathForSkill = options.pathForSkill || function(skillDirName) {
    return 'skills/' + skillDirName + '/SKILL.md';
  };
  const skillNameFromPath = options.skillNameFromPath || function(entryPath) {
    return entryPath.split('/')[1];
  };
  const frontmatterRequired = options.frontmatterRequired !== false;

  if (!fs.existsSync(indexFile)) {
    errors.push(toRelative(indexFile) + ': missing machine-readable skills index');
    return;
  }

  let index;
  try {
    index = readJson(indexFile);
  } catch (error) {
    errors.push(toRelative(indexFile) + ': invalid JSON: ' + error.message);
    return;
  }

  if (index.version !== 1) {
    errors.push(toRelative(indexFile) + ': version must be 1');
  }
  if (index.source !== 'openyida') {
    errors.push(toRelative(indexFile) + ': source must be "openyida"');
  }
  if (index.entry !== 'openyida') {
    errors.push(toRelative(indexFile) + ': entry must be "openyida"');
  }
  if (!Array.isArray(index.skills)) {
    errors.push(toRelative(indexFile) + ': skills must be an array');
    return;
  }
  if (!Array.isArray(index.route_groups) || index.route_groups.length === 0) {
    errors.push(toRelative(indexFile) + ': route_groups must be a non-empty array');
    return;
  }

  const routeGroupNames = new Set();
  for (let i = 0; i < index.route_groups.length; i++) {
    const group = index.route_groups[i];
    const groupLabel = toRelative(indexFile) + ': route_groups[' + i + ']';
    if (!group || typeof group !== 'object' || Array.isArray(group)) {
      errors.push(groupLabel + ': entry must be an object');
      continue;
    }
    if (!group.name || typeof group.name !== 'string') {
      errors.push(groupLabel + ': missing string field "name"');
    } else if (!group.name.startsWith('yida-skills/')) {
      errors.push(groupLabel + ': name must start with "yida-skills/"');
    } else if (routeGroupNames.has(group.name)) {
      errors.push(groupLabel + ': duplicate route group "' + group.name + '"');
    } else {
      routeGroupNames.add(group.name);
    }
    if (!group.display_name || typeof group.display_name !== 'string') {
      errors.push(groupLabel + ': missing string field "display_name"');
    }
    if (!group.description || typeof group.description !== 'string') {
      errors.push(groupLabel + ': missing string field "description"');
    }
    if (!Array.isArray(group.signals) || group.signals.length === 0) {
      errors.push(groupLabel + ': signals must be a non-empty array');
    }
  }

  const expectedPaths = new Set(skillDirNames.map(pathForSkill));
  const expectedNames = new Set(skillDirNames);
  const seenNames = new Set();
  const seenPaths = new Set();

  for (let i = 0; i < index.skills.length; i++) {
    const entry = index.skills[i];
    const entryLabel = toRelative(indexFile) + ': skills[' + i + ']';

    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(entryLabel + ': entry must be an object');
      continue;
    }

    for (const key of Object.keys(entry)) {
      if (!SKILLS_INDEX_ENTRY_ALLOWED_FIELDS.has(key)) {
        errors.push(entryLabel + ': unsupported field "' + key + '"; skills-index.json must stay a machine registry');
      }
      if (SKILLS_INDEX_PROMPT_FIELDS.has(key)) {
        errors.push(entryLabel + ': prompt/workflow field "' + key + '" belongs in SKILL.md, not skills-index.json');
      }
    }

    if (!entry.name || typeof entry.name !== 'string') {
      errors.push(entryLabel + ': missing string field "name"');
    } else if (seenNames.has(entry.name)) {
      errors.push(entryLabel + ': duplicate name "' + entry.name + '"');
    } else {
      seenNames.add(entry.name);
      if (!expectedNames.has(entry.name)) {
        errors.push(entryLabel + ': orphan skill name "' + entry.name + '" has no matching skills/<name>/ directory');
      }
    }

    if (!entry.path || typeof entry.path !== 'string') {
      errors.push(entryLabel + ': missing string field "path"');
      continue;
    }
    if (seenPaths.has(entry.path)) {
      errors.push(entryLabel + ': duplicate path "' + entry.path + '"');
    } else {
      seenPaths.add(entry.path);
      if (!expectedPaths.has(entry.path)) {
        errors.push(entryLabel + ': orphan path "' + entry.path + '" has no matching skills directory');
      }
    }

    if (!pathPattern.test(entry.path)) {
      errors.push(entryLabel + ': path has invalid layout: ' + entry.path);
      continue;
    }

    const skillFile = path.join(indexRoot, entry.path);
    if (!fs.existsSync(skillFile)) {
      errors.push(entryLabel + ': path does not exist: ' + entry.path);
      continue;
    }

    if (frontmatterRequired) {
      const content = readText(skillFile);
      const frontmatter = parseFrontmatter(content);
      const frontmatterName = frontmatter ? frontmatterField(frontmatter, 'name') : null;
      if (frontmatterName && entry.name !== frontmatterName) {
        errors.push(entryLabel + ': name "' + entry.name + '" does not match frontmatter name "' + frontmatterName + '"');
      }
    }

    const pathSkillName = skillNameFromPath(entry.path);
    if (entry.name && entry.name !== pathSkillName) {
      errors.push(entryLabel + ': name "' + entry.name + '" does not match path skill name "' + pathSkillName + '"');
    }

    if (!entry.display_name || typeof entry.display_name !== 'string') {
      errors.push(entryLabel + ': missing string field "display_name"');
    }
    if (!entry.description || typeof entry.description !== 'string') {
      errors.push(entryLabel + ': missing string field "description"');
    } else if (entry.description.length > 280) {
      errors.push(entryLabel + ': description must stay concise for machine search (<= 280 chars)');
    }
    if (!entry.category || typeof entry.category !== 'string') {
      errors.push(entryLabel + ': missing string field "category"');
    } else if (!routeGroupNames.has(entry.category)) {
      errors.push(entryLabel + ': category "' + entry.category + '" must reference route_groups[].name');
    }
    if (!Array.isArray(entry.tags) || entry.tags.length === 0) {
      errors.push(entryLabel + ': tags must be a non-empty array');
    }
  }

  for (const expectedPath of expectedPaths) {
    if (!seenPaths.has(expectedPath)) {
      errors.push(toRelative(indexFile) + ': missing skill path "' + expectedPath + '"');
    }
  }
  for (const expectedName of expectedNames) {
    if (!seenNames.has(expectedName)) {
      errors.push(toRelative(indexFile) + ': missing skill name "' + expectedName + '"');
    }
  }

  return index;
}

function comparableSkillEntry(entry) {
  return Object.keys(entry).sort().reduce(function(result, key) {
    if (key !== 'path') {
      result[key] = entry[key];
    }
    return result;
  }, {});
}

function validateGeneratedSkillsIndex(sourceIndex, generatedIndexFile) {
  const generatedIndex = validateSkillsIndex(sourceIndex.skills.map(function(skill) {
    return skill.name;
  }).sort(), {
    indexFile: generatedIndexFile,
    indexRoot: GENERATED_SKILL_ROOT,
    pathPattern: /^references\/subskills\/[a-z0-9-]+\/README\.md$/,
    pathForSkill: function(skillName) {
      return 'references/subskills/' + skillName + '/README.md';
    },
    skillNameFromPath: function(entryPath) {
      return entryPath.split('/')[2];
    },
    frontmatterRequired: false,
  });

  if (!generatedIndex) {
    return;
  }

  const generatedNames = generatedIndex.skills.map(function(skill) { return skill.name; }).sort();
  const sourceNames = sourceIndex.skills.map(function(skill) { return skill.name; }).sort();
  if (JSON.stringify(generatedNames) !== JSON.stringify(sourceNames)) {
    errors.push(toRelative(generatedIndexFile) + ': skill set must match source yida-skills/skills-index.json');
    return;
  }

  const sourceByName = new Map(sourceIndex.skills.map(function(skill) {
    return [skill.name, comparableSkillEntry(skill)];
  }));
  for (const generatedSkill of generatedIndex.skills) {
    const sourceSkill = sourceByName.get(generatedSkill.name);
    if (JSON.stringify(comparableSkillEntry(generatedSkill)) !== JSON.stringify(sourceSkill)) {
      errors.push(toRelative(generatedIndexFile) + ': metadata for "' + generatedSkill.name + '" must match source except path');
    }
  }

  if (JSON.stringify(generatedIndex.route_groups) !== JSON.stringify(sourceIndex.route_groups)) {
    errors.push(toRelative(generatedIndexFile) + ': route_groups must match source yida-skills/skills-index.json');
  }
}

function validateGeneratedSkillRoot() {
  if (!fs.existsSync(GENERATED_SKILL_ROOT)) {
    warnings.push(toRelative(GENERATED_SKILL_ROOT) + ': generated skill root not found; run npm run build:skills to validate package output');
    return;
  }

  for (const fileName of ['SKILL.md', 'skills-index.json']) {
    const filePath = path.join(GENERATED_SKILL_ROOT, fileName);
    if (!fs.existsSync(filePath)) {
      errors.push(toRelative(GENERATED_SKILL_ROOT) + ': generated skill root must contain ' + fileName);
    }
  }

  const generatedIndexFile = path.join(GENERATED_SKILL_ROOT, 'skills-index.json');
  if (fs.existsSync(generatedIndexFile)) {
    try {
      const sourceIndex = readJson(SKILLS_INDEX_FILE);
      validateGeneratedSkillsIndex(sourceIndex, generatedIndexFile);
    } catch (error) {
      errors.push(toRelative(generatedIndexFile) + ': invalid JSON: ' + error.message);
    }
  }
}

function validateSkillLoadingInstructions(instructionFiles) {
  const forbiddenPatterns = [
    {
      pattern: /skills\/[a-z0-9-]+\/SKILL\.md/,
      message: 'must load subskills via use_skill instead of source skill paths',
    },
    {
      pattern: /\.\.\/[a-z0-9-]+\/SKILL\.md/,
      message: 'must load sibling subskills via use_skill instead of relative SKILL.md paths',
    },
    {
      pattern: /(?:先读|先读取|完整读取|完整学习|读它的|详见|参考|查阅).{0,60}SKILL\.md/,
      message: 'must not instruct agents to read SKILL.md directly',
    },
    {
      pattern: /未读取.{0,60}SKILL\.md/,
      message: 'must express prerequisites as loaded skills, not direct SKILL.md reads',
    },
    {
      pattern: /一次性(?:读取|加载).{0,40}(?:全部|多个|全量).{0,20}技能|全部技能文档/,
      message: 'must not describe bulk loading multiple skills',
    },
  ];

  for (const instructionFile of instructionFiles) {
    const content = readText(instructionFile);
    const lines = content.split(/\r?\n/);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const isAllowedFallback = /没有\s*`?use_skill\/search_skills`?|当前阶段唯一必要/.test(line);
      const isAllowedBan = /禁止.*(?:Read|read_file|cat).*SKILL\.md/.test(line);
      if (isAllowedFallback || isAllowedBan) {
        continue;
      }

      for (const rule of forbiddenPatterns) {
        if (rule.pattern.test(line)) {
          errors.push(
            toRelative(instructionFile) + ':' + (lineIndex + 1) + ': ' + rule.message
          );
          break;
        }
      }
    }
  }
}

function isExternalLink(target) {
  return /^(https?:|mailto:|tel:|app:\/\/|plugin:\/\/|#)/i.test(target);
}

function normalizeMarkdownTarget(rawTarget) {
  const trimmed = rawTarget.trim().replace(/^<|>$/g, '');
  const targetWithoutTitle = trimmed.split(/\s+/)[0];
  const targetWithoutAnchor = targetWithoutTitle.split('#')[0];

  if (!targetWithoutAnchor) {
    return null;
  }

  try {
    return decodeURIComponent(targetWithoutAnchor);
  } catch (_error) {
    return targetWithoutAnchor;
  }
}

function validateMarkdownLinks(markdownFile) {
  const content = readText(markdownFile);
  const linkPattern = /!?\[[^\]\n]*\]\(([^)\n]+)\)/g;
  let match = linkPattern.exec(content);

  while (match) {
    const rawTarget = match[1];
    const normalizedTarget = normalizeMarkdownTarget(rawTarget);

    if (normalizedTarget && !isExternalLink(normalizedTarget)) {
      if (/^file:/i.test(normalizedTarget) || path.isAbsolute(normalizedTarget)) {
        errors.push(
          toRelative(markdownFile) + ': non-portable markdown link "' + rawTarget + '"'
        );
        match = linkPattern.exec(content);
        continue;
      }

      const absoluteTarget = path.resolve(path.dirname(markdownFile), normalizedTarget);
      if (!fs.existsSync(absoluteTarget)) {
        errors.push(
          toRelative(markdownFile) + ': broken markdown link "' + rawTarget + '"'
        );
      }
    }

    match = linkPattern.exec(content);
  }
}

function run() {
  if (!fs.existsSync(SKILLS_DIR)) {
    errors.push(toRelative(SKILLS_DIR) + ': missing skills directory');
  } else {
    validateRootSkillFrontmatter();

    const skillDirNames = fs.readdirSync(SKILLS_DIR).filter(function(name) {
      const fullPath = path.join(SKILLS_DIR, name);
      return fs.statSync(fullPath).isDirectory();
    }).sort();

    const skillDirNamesWithSkillFile = [];
    for (const skillDirName of skillDirNames) {
      const skillFile = path.join(SKILLS_DIR, skillDirName, 'SKILL.md');
      if (!fs.existsSync(skillFile)) {
        errors.push('yida-skills/skills/' + skillDirName + ': missing SKILL.md');
        continue;
      }

      skillDirNamesWithSkillFile.push(skillDirName);
      validateSkillFrontmatter(skillDirName, skillFile);
      validateIndexEntry(skillDirName, skillFile);
    }

    validateSkillsIndex(skillDirNames);
  }

  const markdownFiles = [];
  collectMarkdownFiles(SKILLS_ROOT, markdownFiles);
  for (const markdownFile of markdownFiles.sort()) {
    validateMarkdownLinks(markdownFile);
  }

  const instructionFiles = [INDEX_FILE];
  if (fs.existsSync(SKILLS_DIR)) {
    const skillDirNames = fs.readdirSync(SKILLS_DIR).filter(function(name) {
      return fs.statSync(path.join(SKILLS_DIR, name)).isDirectory();
    }).sort();
    for (const skillDirName of skillDirNames) {
      const skillFile = path.join(SKILLS_DIR, skillDirName, 'SKILL.md');
      if (fs.existsSync(skillFile)) {
        instructionFiles.push(skillFile);
      }
    }
  }
  validateSkillLoadingInstructions(instructionFiles);
  validateGeneratedSkillRoot();

  if (warnings.length > 0) {
    console.warn('Skill validation warnings:');
    for (const warning of warnings) {
      console.warn('  warn ' + warning);
    }
  }

  if (errors.length > 0) {
    console.error('Skill validation failed:');
    for (const error of errors) {
      console.error('  error ' + error);
    }
    process.exit(1);
  }

  console.log('Skill validation OK: checked ' + markdownFiles.length + ' markdown files');
}

run();
