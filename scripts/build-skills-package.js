#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_ROOT = path.join(ROOT, 'yida-skills');
const SOURCE_SUBSKILLS_ROOT = path.join(SOURCE_ROOT, 'skills');
const DEFAULT_OUTPUT_ROOT = path.join(ROOT, 'dist', 'skills', 'openyida');

function parseArgs(argv) {
  const options = {
    out: DEFAULT_OUTPUT_ROOT,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') {
      options.out = path.resolve(ROOT, argv[++i]);
    }
  }

  return options;
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    return 0;
  }

  fs.mkdirSync(dest, { recursive: true });

  let count = 0;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      count += copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
      count++;
    }
  }

  return count;
}

function readRequiredFile(src) {
  if (!fs.existsSync(src)) {
    throw new Error('Missing required file: ' + path.relative(ROOT, src));
  }

  return fs.readFileSync(src, 'utf8');
}

function writeRootSkill(src, dest) {
  const content = readRequiredFile(src)
    .replace(/skills\/([a-z0-9-]+)\/SKILL\.md/g, 'references/subskills/$1/README.md')
    .replace(/详见 SKILL\.md/g, '详见 README.md')
    .replace('| 技能 | SKILL.md 路径 | 用途 | 典型命令 |', '| 技能 | README 路径 | 用途 | 典型命令 |')
    .replace('> 每个子技能均有独立的 SKILL.md。执行时先选定一个最匹配的子技能，只读取该子技能文档；references 按文档提示按需读取，避免一次性加载全量文档。',
      '> 悟空上传包只暴露一个根 SKILL.md；原子技能已打包到 references/subskills/，执行时先选定一个最匹配的子技能，只读取对应 README.md；references 按文档提示按需读取，避免一次性加载全量文档。');

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content, 'utf8');
  return 1;
}

function transformSubskillReference(content) {
  return content
    .replace(/^---\n[\s\S]*?\n---\n?/, '')
    .replace(/yida-skills\/SKILL\.md/g, '../../../SKILL.md')
    .replace(/skills\/([a-z0-9-]+)\/SKILL\.md/g, '../$1/README.md')
    .replace(/\.\.\/([a-z0-9-]+)\/SKILL\.md/g, '../$1/README.md')
    .replace(/详见 SKILL\.md/g, '详见 README.md');
}

function copySubskillAsReference(skillDirName, outputRoot) {
  const sourceDir = path.join(SOURCE_SUBSKILLS_ROOT, skillDirName);
  const destDir = path.join(outputRoot, 'references', 'subskills', skillDirName);

  if (!fs.existsSync(path.join(sourceDir, 'SKILL.md'))) {
    return 0;
  }

  fs.mkdirSync(destDir, { recursive: true });
  let count = 0;
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destName = entry.name === 'SKILL.md' ? 'README.md' : entry.name;
    const destPath = path.join(destDir, destName);

    if (entry.isDirectory()) {
      count += copyDirRecursive(sourcePath, destPath);
    } else if (entry.isFile()) {
      if (entry.name === 'SKILL.md') {
        fs.writeFileSync(destPath, transformSubskillReference(readRequiredFile(sourcePath)), 'utf8');
      } else {
        fs.copyFileSync(sourcePath, destPath);
      }
      count++;
    }
  }

  return count;
}

function copySubskillsAsReferences(outputRoot) {
  if (!fs.existsSync(SOURCE_SUBSKILLS_ROOT)) {
    return 0;
  }

  const skillDirNames = fs.readdirSync(SOURCE_SUBSKILLS_ROOT).filter(function(name) {
    return fs.statSync(path.join(SOURCE_SUBSKILLS_ROOT, name)).isDirectory();
  }).sort();

  let count = 0;
  for (const skillDirName of skillDirNames) {
    count += copySubskillAsReference(skillDirName, outputRoot);
  }

  return count;
}

function collectSkillFiles(dir, files) {
  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSkillFiles(fullPath, files);
    } else if (entry.isFile() && entry.name === 'SKILL.md') {
      files.push(fullPath);
    }
  }
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

function assertSingleWukongSkill(outputRoot) {
  const skillFiles = [];
  collectSkillFiles(outputRoot, skillFiles);
  if (skillFiles.length !== 1 || skillFiles[0] !== path.join(outputRoot, 'SKILL.md')) {
    throw new Error('Wukong skill package must contain exactly one root SKILL.md');
  }
}

function assertWukongFrontmatter(outputRoot) {
  const skillText = readRequiredFile(path.join(outputRoot, 'SKILL.md'));
  const frontmatterMatch = skillText.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    throw new Error('Wukong root SKILL.md must start with YAML frontmatter');
  }

  const keys = frontmatterMatch[1].split(/\r?\n/).filter(function(line) {
    return /^[a-zA-Z0-9_-]+:\s*/.test(line);
  }).map(function(line) {
    return line.split(':')[0];
  });

  const invalidKeys = keys.filter(function(key) {
    return key !== 'name' && key !== 'description';
  });
  if (invalidKeys.length > 0) {
    throw new Error('Wukong root SKILL.md frontmatter must only contain name and description');
  }
}

function assertNoSourceSkillLinks(outputRoot) {
  const markdownFiles = [];
  collectMarkdownFiles(outputRoot, markdownFiles);

  for (const markdownFile of markdownFiles) {
    const text = readRequiredFile(markdownFile);
    if (/skills\/[a-z0-9-]+\/SKILL\.md|yida-skills\/SKILL\.md/.test(text)) {
      throw new Error('Generated Wukong package contains source skill path: ' + path.relative(ROOT, markdownFile));
    }
  }
}

function buildSkillsPackage(outputRoot) {
  if (!fs.existsSync(SOURCE_ROOT)) {
    throw new Error('Missing source skills directory: yida-skills');
  }

  fs.rmSync(outputRoot, { recursive: true, force: true });
  fs.mkdirSync(outputRoot, { recursive: true });

  let count = 0;
  count += writeRootSkill(
    path.join(SOURCE_ROOT, 'SKILL.md'),
    path.join(outputRoot, 'SKILL.md'),
  );
  count += copyDirRecursive(
    path.join(SOURCE_ROOT, 'references'),
    path.join(outputRoot, 'references'),
  );
  count += copySubskillsAsReferences(outputRoot);

  assertSingleWukongSkill(outputRoot);
  assertWukongFrontmatter(outputRoot);
  assertNoSourceSkillLinks(outputRoot);

  return count;
}

function run() {
  const options = parseArgs(process.argv.slice(2));
  const count = buildSkillsPackage(options.out);
  console.log('Built OpenYida skills package: ' + path.relative(ROOT, options.out));
  console.log('Files copied: ' + count);
}

run();
