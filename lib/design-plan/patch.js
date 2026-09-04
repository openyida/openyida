'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { CliError } = require('../core/cli-error');
const { materialize } = require('./materialize');
const { readJson, atomicWrite } = require('./files');

const PROTECTED_PATHS = [
  'meta.revision',
  'meta.status',
  'meta.updatedAt',
  'meta.planState',
];
const DANGEROUS_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function parsePath(pathExpression) {
  const expression = String(pathExpression || '').trim();
  if (!expression || !/^[A-Za-z_$][\w$-]*(?:(?:\.[A-Za-z_$][\w$-]*)|(?:\[\d+\]))*$/.test(expression)) {
    throw new CliError(`无效字段路径：${expression || '(empty)'}`, {
      code: 'DESIGN_PLAN_INVALID_PATH',
    });
  }
  const segments = expression.replace(/\[(\d+)\]/g, '.$1').split('.');
  if (segments.some(segment => DANGEROUS_SEGMENTS.has(segment))) {
    throw new CliError(`不允许修改危险字段路径：${expression}`, {
      code: 'DESIGN_PLAN_UNSAFE_PATH',
    });
  }
  if (PROTECTED_PATHS.some(protectedPath => expression === protectedPath
    || expression.startsWith(`${protectedPath}.`)
    || expression.startsWith(`${protectedPath}[`)
    || protectedPath.startsWith(`${expression}.`))) {
    throw new CliError(`字段 ${expression} 由 design-plan patch 自动维护，不能通过 --set 修改`, {
      code: 'DESIGN_PLAN_PROTECTED_PATH',
    });
  }
  return segments.map(segment => /^\d+$/.test(segment) ? Number(segment) : segment);
}

function parseValue(rawValue) {
  const value = String(rawValue);
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseSetExpression(expression) {
  const separator = String(expression || '').indexOf('=');
  if (separator <= 0) {
    throw new CliError(`--set 必须使用 path=value 格式：${expression || '(empty)'}`, {
      code: 'DESIGN_PLAN_INVALID_SET',
    });
  }
  const pathExpression = expression.slice(0, separator).trim();
  return {
    path: pathExpression,
    segments: parsePath(pathExpression),
    value: parseValue(expression.slice(separator + 1)),
  };
}

function setExistingPath(target, change) {
  let current = target;
  for (let index = 0; index < change.segments.length - 1; index += 1) {
    const segment = change.segments[index];
    if (current === null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, segment)) {
      throw new CliError(`字段路径不存在：${change.path}`, {
        code: 'DESIGN_PLAN_PATH_NOT_FOUND',
      });
    }
    current = current[segment];
  }
  const leaf = change.segments[change.segments.length - 1];
  if (current === null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, leaf)) {
    throw new CliError(`字段路径不存在：${change.path}`, {
      code: 'DESIGN_PLAN_PATH_NOT_FOUND',
    });
  }
  const previousValue = current[leaf];
  current[leaf] = change.value;
  return previousValue;
}

function incrementRevision(revision) {
  const value = String(revision || '').trim();
  const match = /^(.*?)(\d+)$/.exec(value);
  if (match) {
    const nextNumber = String(Number(match[2]) + 1).padStart(match[2].length, '0');
    return `${match[1]}${nextNumber}`;
  }
  const date = new Date().toISOString().slice(0, 10);
  return value ? `${value}-01` : `${date}-01`;
}

function invalidateConfirmation(plan) {
  plan.meta = plan.meta || {};
  plan.meta.revision = incrementRevision(plan.meta.revision);
  plan.meta.status = 'draft';
  plan.meta.updatedAt = new Date().toISOString();
  plan.meta.planState = plan.meta.planState || {};
  plan.meta.planState.presentedRevision = null;
  plan.meta.planState.confirmedRevision = null;
  plan.meta.planState.planConfirmed = false;
  plan.meta.planState.confirmationInteractionId = '';
  plan.meta.planState.confirmedAt = '';
}

function validatePatchedPlan(plan) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-design-plan-patch-'));
  const tempInput = path.join(tempDir, 'build-plan.json');
  try {
    fs.writeFileSync(tempInput, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
    materialize(tempInput, { check: true });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function patchPlan(inputPath, setExpressions, options = {}) {
  const resolvedInput = path.resolve(inputPath);
  const expressions = Array.isArray(setExpressions) ? setExpressions : [];
  if (expressions.length === 0) {
    throw new CliError('design-plan patch 至少需要一个 --set path=value', {
      code: 'DESIGN_PLAN_SET_REQUIRED',
    });
  }
  const original = readJson(resolvedInput);
  const patched = JSON.parse(JSON.stringify(original));
  const changes = expressions.map(parseSetExpression).map(change => ({
    ...change,
    previousValue: setExistingPath(patched, change),
  }));
  const effectiveChanges = changes.filter(change => JSON.stringify(change.previousValue) !== JSON.stringify(change.value));
  if (JSON.stringify(original) === JSON.stringify(patched)) {
    return {
      success: true,
      changed: false,
      input: resolvedInput,
      previousRevision: (original.meta || {}).revision || null,
      revision: (original.meta || {}).revision || null,
      changedPaths: [],
      confirmationInvalidated: false,
      materialized: false,
    };
  }
  const previousRevision = (patched.meta || {}).revision || null;
  invalidateConfirmation(patched);
  validatePatchedPlan(patched);
  atomicWrite(resolvedInput, `${JSON.stringify(patched, null, 2)}\n`);

  let materializedResult = null;
  if (options.materialize) {
    materializedResult = materialize(resolvedInput, { outputDir: options.outputDir });
  }
  return {
    success: true,
    changed: true,
    input: resolvedInput,
    previousRevision,
    revision: patched.meta.revision,
    changedPaths: effectiveChanges.map(change => change.path),
    confirmationInvalidated: true,
    materialized: options.materialize === true,
    outputs: materializedResult ? materializedResult.outputs : undefined,
  };
}

module.exports = {
  incrementRevision,
  parseSetExpression,
  patchPlan,
};
