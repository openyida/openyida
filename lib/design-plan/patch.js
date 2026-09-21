'use strict';

const path = require('path');
const { isDeepStrictEqual } = require('util');
const { CliError } = require('../core/cli-error');
const { prepareArtifacts, prepareArtifactUpdate } = require('./materialize');
const { readJson, writeFiles } = require('./files');

const PROTECTED_PATHS = [
  'meta.revision',
  'meta.status',
  'meta.updatedAt',
  'meta.planState',
  'visualStyle.forUser.themeProfile',
  'visualStyle.forUser.navigationStyle.tone',
  'visualStyle.forUser.navigationStyle.toneSource',
  'execution.appConfig.navTheme',
];
const DANGEROUS_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function parsePath(pathExpression, options = {}) {
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
  const protectedPaths = options.creative ? PROTECTED_PATHS.filter(field => field !== 'visualStyle.forUser.navigationStyle.tone') : PROTECTED_PATHS;
  if (protectedPaths.some(protectedPath => expression === protectedPath
    || expression.startsWith(`${protectedPath}.`)
    || expression.startsWith(`${protectedPath}[`)
    || protectedPath.startsWith(`${expression}.`))) {
    const hint = expression.includes('themeProfile')
      ? '；themeProfile 只读，请改 visualStyle.tokens 或 colorStrategy.primaryColor'
      : /(?:navigationStyle\.(?:tone|toneSource)|appConfig\.navTheme)/.test(expression)
        ? '；导航明暗由所选主题模板派生，请改选主题'
        : '';
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

function parseSetExpression(expression, options = {}) {
  const separator = String(expression || '').indexOf('=');
  if (separator <= 0) {
    throw new CliError(`--set 必须使用 path=value 格式：${expression || '(empty)'}`, {
      code: 'DESIGN_PLAN_INVALID_SET',
    });
  }
  const pathExpression = expression.slice(0, separator).trim();
  return {
    path: pathExpression,
    segments: parsePath(pathExpression, options),
    value: parseValue(expression.slice(separator + 1)),
  };
}

const OPTIONAL_PATHS = [
  /^execution$/,
  /^execution\.(resourceBlueprint|resourceCreationOrder|pageImplementationOrder|navigationOrder|navigationFallback|entryRecommendation|sampleDataPlan|interactionStates|acceptanceCriteria|explicitScope|appConfig)$/,
  /^execution\.appConfig\.(appType|corpId|baseUrl|navigationType|hideAppNav|layoutDirection|logoSource)$/,
  /^execution\.interactionStates\.(empty|loading|error|formEntry|detail)$/,
  /^visualStyle\.tokens(?:\.--[\w-]+)?$/,
  /^visualStyle\.forUser\.iconSystem(?:\.(library|mappings|colorPairs))?$/,
  /^visualStyle\.forUser\.assetStrategy\.(materialStatus|missingAssets)$/,
  /^pages\.customPageDetails\[\d+\]\.(scene|sceneKey|pageStructure|entryMode|dataSources|dataBinding|emptyReason|pageSpecHandoff)$/,
  /^pages\.customPageDetails\[\d+\]\.pageSpecHandoff\.(scene|pageStructure|entryMode|navigation|contentBlocks|dataSources|dataBinding|emptyReason|primaryAction|themeSummary|designFile|designRefs)$/,
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

function invalidateConfirmation(plan, original) {
  if (original && isDeepStrictEqual(plan, original)) { return false; }
  plan.meta = plan.meta || {};
  const state = plan.meta.planState;
  // Legacy plans without presentation facts keep conservative version invalidation.
  if (!state || state.presentedRevision === plan.meta.revision
    || state.confirmedRevision === plan.meta.revision || state.planConfirmed === true || plan.meta.status === 'confirmed') {
    plan.meta.revision = incrementRevision(plan.meta.revision);
  }
  plan.meta.status = 'draft';
  plan.meta.updatedAt = new Date().toISOString();
  plan.meta.planState = plan.meta.planState || {};
  plan.meta.planState.presentedRevision = null;
  plan.meta.planState.confirmedRevision = null;
  plan.meta.planState.planConfirmed = false;
  plan.meta.planState.confirmationInteractionId = '';
  plan.meta.planState.confirmedAt = '';
  return true;
}

// Collection results describe execution progress; the approved design stays the same.
function isAssetProgressOnly(original, patched) {
  const withoutProgress = (plan) => {
    const copy = JSON.parse(JSON.stringify(plan));
    const strategy = copy.visualStyle?.forUser?.assetStrategy;
    if (strategy) {
      delete strategy.materialStatus;
      delete strategy.missingAssets;
    }
    return JSON.stringify(copy);
  };
  return withoutProgress(original) === withoutProgress(patched);
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
  const selectedTheme = original.visualStyle?.internal?.selectedTheme || original.visualStyle?.forUser?.selectedTheme;
  const creative = selectedTheme?.themeId === 'free-creative';
  const changes = expressions.map(expression => parseSetExpression(expression, { creative })).map(change => ({
    ...change,
    previousValue: setExistingPath(patched, change),
  }));
  const effectiveChanges = changes.filter(change => JSON.stringify(change.previousValue) !== JSON.stringify(change.value));
  if (JSON.stringify(original) === JSON.stringify(patched)) {
    if (options.materialize) {
      return { ...require('./materialize').materialize(resolvedInput, { outputDir: options.outputDir }), changed: false, materialized: true, changedPaths: [], confirmationInvalidated: false };
    }
    return {
      success: true,
      changed: false,
      input: resolvedInput,
      previousRevision: (original.meta || {}).revision || null,
      revision: (original.meta || {}).revision || null,
      changedPaths: [],
      confirmationInvalidated: false,
      materialized: false,
      updated: [],
    };
  }
  const previousRevision = (patched.meta || {}).revision || null;
  const assetProgressOnly = isAssetProgressOnly(original, patched);
  if (assetProgressOnly) {
    patched.meta.updatedAt = new Date().toISOString();
  } else {
    invalidateConfirmation(patched);
  }
  const outputDir = path.resolve(options.outputDir || path.dirname(resolvedInput));
  const artifacts = prepareArtifacts(patched, outputDir, undefined, { renderHtml: options.materialize === true });
  const updates = options.materialize ? prepareArtifactUpdate(artifacts, outputDir, () => prepareArtifacts(original, outputDir)) : null;
  const files = [[resolvedInput, `${JSON.stringify(patched, null, 2)}\n`]];
  if (updates) {files.push(...updates.files);}
  writeFiles(files);
  return {
    success: true,
    changed: true,
    input: resolvedInput,
    previousRevision,
    revision: patched.meta.revision,
    changedPaths: effectiveChanges.map(change => change.path),
    confirmationInvalidated: !assetProgressOnly,
    materialized: options.materialize === true,
    outputs: options.materialize ? artifacts.outputs : undefined,
    ...(options.materialize ? { confirmation: require('./confirmation').confirmationPayload(artifacts.outputs, artifacts.revision) } : {}),
    updated: updates?.updated || [],
  };
}

module.exports = {
  invalidateConfirmation,
  incrementRevision,
  parseSetExpression,
  patchPlan,
};
