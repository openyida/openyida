#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKILLS_ROOT = path.join(ROOT, 'yida-skills');
const SKILLS_DIR = path.join(SKILLS_ROOT, 'skills');
const INDEX_FILE = path.join(SKILLS_ROOT, 'SKILL.md');
const MAX_RECOMMENDED_LINES = 500;

const errors = [];
const warnings = [];

function toRelative(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
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

  const indexText = readText(INDEX_FILE);
  const expectedPath = 'skills/' + skillDirName + '/SKILL.md';
  if (!indexText.includes(expectedPath)) {
    errors.push(toRelative(skillFile) + ': missing from yida-skills/SKILL.md index as ' + expectedPath);
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

    for (const skillDirName of skillDirNames) {
      const skillFile = path.join(SKILLS_DIR, skillDirName, 'SKILL.md');
      if (!fs.existsSync(skillFile)) {
        errors.push('yida-skills/skills/' + skillDirName + ': missing SKILL.md');
        continue;
      }

      validateSkillFrontmatter(skillDirName, skillFile);
      validateIndexEntry(skillDirName, skillFile);
    }
  }

  const markdownFiles = [];
  collectMarkdownFiles(SKILLS_ROOT, markdownFiles);
  for (const markdownFile of markdownFiles.sort()) {
    validateMarkdownLinks(markdownFile);
  }

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
