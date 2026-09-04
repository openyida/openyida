'use strict';

const path = require('path');
const { CliError } = require('../core/cli-error');
const { prepareArtifacts } = require('./materialize');
const { readJson, writeFiles } = require('./files');

const PROTECTED_PATHS = [
  'meta.revision',
  'meta.status',
  'meta.updatedAt',
  'meta.planState',
  'visualStyle.forUser.themeProfile',
];
const DANGEROUS_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function parsePath(pathExpression) {
  const expression = String(pathExpression || '').trim();
  if (!expression || !/^[A-Za-z_$][\w$-]*(?:(?:\.(?:[A-Za-z_$][\w$-]*|--[\w-]+))|(?:\[\d+\]))*$/.test(expression)) {
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
    const hint = expression.includes('themeProfile') ? '；themeProfile 只读，请改 visualStyle.tokens 或 colorStrategy.primaryColor' : '';
    throw new CliError(`字段 ${expression} 由 design-plan patch 自动维护，不能通过 --set 修改${hint}`, {
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

const OPTIONAL_PATHS = [
  /^execution$/,
  /^execution\.(resourceBlueprint|resourceCreationOrder|pageImplementationOrder|navigationOrder|navigationFallback|sampleDataPlan|interactionStates|acceptanceCriteria|explicitScope|appConfig)$/,
  /^execution\.appConfig\.(appType|corpId|baseUrl|navigationType|hideAppNav|layoutDirection|navTheme|logoSource)$/,
  /^execution\.interactionStates\.(empty|loading|error|formEntry|detail)$/,
  /^visualStyle\.tokens(?:\.--[\w-]+)?$/,
  /^pages\.customPageDetails\[\d+\]\.(scene|sceneKey|pageStructure|entryMode|dataSources|dataBinding|emptyReason|pageSpecHandoff)$/,
  /^pages\.customPageDetails\[\d+\]\.pageSpecHandoff\.(scene|pageStructure|entryMode|contentBlocks|dataSources|dataBinding|emptyReason|primaryAction|themeSummary|designFile|designRefs)$/,
  /^dataModels\[\d+\]\.(sampleRecords|skipSampleReason)$/,
];

function setExistingPath(target, change) {
  const optional = OPTIONAL_PATHS.some(pattern => pattern.test(change.path));
  let current = target;
  for (let index = 0; index < change.segments.length; index += 1) {
    const segment = change.segments[index];
    if (current === null || typeof current !== 'object') {
      throw new CliError(`字段路径不存在：${change.path}`, { code: 'DESIGN_PLAN_PATH_NOT_FOUND' });
    }
    const exists = Object.prototype.hasOwnProperty.call(current, segment);
    if (!exists && (!optional || typeof segment === 'number' || typeof change.segments[index + 1] === 'number')) {
      throw new CliError(`字段路径不存在：${change.path}`, { code: 'DESIGN_PLAN_PATH_NOT_FOUND' });
    }
    if (index === change.segments.length - 1) {
      const previousValue = current[segment];
      current[segment] = change.value;
      return previousValue;
    }
    if (!exists) {current[segment] = {};}
    current = current[segment];
  }
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
  const artifacts = prepareArtifacts(patched, path.resolve(options.outputDir || path.dirname(resolvedInput)));
  const files = [[resolvedInput, `${JSON.stringify(patched, null, 2)}\n`]];
  if (options.materialize) {files.push(...artifacts.files);}
  writeFiles(files);
  return {
    success: true,
    changed: true,
    input: resolvedInput,
    previousRevision,
    revision: patched.meta.revision,
    changedPaths: effectiveChanges.map(change => change.path),
    confirmationInvalidated: true,
    materialized: options.materialize === true,
    outputs: options.materialize ? artifacts.outputs : undefined,
  };
}

module.exports = {
  incrementRevision,
  parseSetExpression,
  patchPlan,
};
