'use strict';

const fs = require('fs');
const path = require('path');
const { CliError } = require('../core/cli-error');

function readJson(filePath, label = 'build-plan.json') {
  let source;
  try {
    source = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new CliError(`${label}不可读：${filePath}`, {
      code: 'DESIGN_PLAN_FILE_UNREADABLE',
      details: { filePath, cause: error.message },
    });
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new CliError(`${label}不是有效 JSON：${filePath}`, {
      code: 'DESIGN_PLAN_INVALID_JSON',
      details: { filePath, cause: error.message },
    });
  }
}

// Stage every file before replacing any target. A failed install restores the prior set.
function writeFiles(files) {
  const entries = [];
  const paths = new Set();
  let preserveBackups = false;
  try {
    for (const [filePath, content] of files) {
      const target = path.resolve(filePath);
      if (paths.has(target)) {throw new Error(`重复输出路径：${target}`);}
      paths.add(target);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const dir = fs.mkdtempSync(path.join(path.dirname(target), '.openyida-write-'));
      const entry = { target, dir, next: path.join(dir, 'next'), backup: path.join(dir, 'backup'), existed: fs.existsSync(target), installed: false };
      entries.push(entry);
      if (entry.existed) {fs.copyFileSync(target, entry.backup);}
      fs.writeFileSync(entry.next, content, 'utf8');
    }
    for (const entry of entries) {
      fs.renameSync(entry.next, entry.target);
      entry.installed = true;
    }
  } catch (error) {
    const failures = [];
    for (const entry of [...entries].reverse()) {
      if (!entry.installed) {continue;}
      try {
        if (entry.existed) {fs.renameSync(entry.backup, entry.target);}
        else {fs.rmSync(entry.target);}
      } catch (rollbackError) {
        failures.push({ target: entry.target, backup: entry.backup, cause: rollbackError.message });
      }
    }
    if (failures.length) {
      preserveBackups = true;
      throw new CliError('文件回滚失败，原文件备份已保留', {
        code: 'DESIGN_PLAN_ROLLBACK_FAILED', details: { cause: error.message, failures },
      });
    }
    throw error;
  } finally {
    if (!preserveBackups) {
      for (const entry of entries) {fs.rmSync(entry.dir, { recursive: true, force: true });}
    }
  }
}

module.exports = { readJson, writeFiles };
