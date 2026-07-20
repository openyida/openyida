#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const parser = require('@babel/parser');

const ROOT = path.resolve(__dirname, '..');
const TARGET_DIRS = ['bin', 'lib', 'scripts', 'tests'];
const SKIP_DIRS = new Set([
  path.join(ROOT, 'lib', 'samples'),
]);
const BABEL_PARSER_OPTIONS = {
  sourceType: 'module',
  plugins: [
    'jsx',
    'objectRestSpread',
    'classProperties',
    'optionalChaining',
    'nullishCoalescingOperator',
  ],
};

function collectJsFiles(dir, files) {
  if (!fs.existsSync(dir)) {
    return;
  }
  if (SKIP_DIRS.has(dir)) {
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'coverage') {
        continue;
      }
      collectJsFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
}

function shouldTryBabelParser(source, relativePath) {
  if (relativePath.startsWith('lib/samples/')) {
    return true;
  }

  return /(^|\n)\s*(import\s+[^('"`]|export\s+)/.test(source) ||
    /<[A-Za-z][A-Za-z0-9.:-]*(\s|>|\/>)/.test(source);
}

function checkWithBabelParser(file, relativePath) {
  const source = fs.readFileSync(file, 'utf8');
  if (!shouldTryBabelParser(source, relativePath)) {
    return { ok: false };
  }

  try {
    parser.parse(source, BABEL_PARSER_OPTIONS);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error && error.message ? `${relativePath}: ${error.message}\n` : '',
    };
  }
}

function run() {
  const files = [];
  for (const dir of TARGET_DIRS) {
    collectJsFiles(path.join(ROOT, dir), files);
  }

  files.sort();

  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const relativePath = path.relative(ROOT, file);
    if (result.status !== 0) {
      const babelResult = checkWithBabelParser(file, relativePath);
      if (babelResult.ok) {
        process.stdout.write(`  ok ${relativePath}\n`);
        continue;
      }

      if (babelResult.message) {
        process.stderr.write(babelResult.message);
      } else {
        process.stderr.write(result.stderr || result.stdout);
      }
      process.stderr.write(`Syntax check failed: ${relativePath}\n`);
      process.exit(result.status || 1);
    }

    process.stdout.write(`  ok ${relativePath}\n`);
  }

  process.stdout.write(`All ${files.length} JavaScript files passed syntax check\n`);
}

run();
