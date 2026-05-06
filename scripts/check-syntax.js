#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TARGET_DIRS = ['bin', 'lib', 'scripts', 'tests'];

function collectJsFiles(dir, files) {
  if (!fs.existsSync(dir)) {
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
      process.stderr.write(result.stderr || result.stdout);
      process.stderr.write(`Syntax check failed: ${relativePath}\n`);
      process.exit(result.status || 1);
    }

    process.stdout.write(`  ok ${relativePath}\n`);
  }

  process.stdout.write(`All ${files.length} JavaScript files passed syntax check\n`);
}

run();
