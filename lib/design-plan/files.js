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

function atomicWrite(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(temporary, content, 'utf8');
    fs.renameSync(temporary, filePath);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

module.exports = { readJson, atomicWrite };
