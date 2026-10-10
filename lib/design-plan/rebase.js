'use strict';

const path = require('path');
const fs = require('fs');
const { CliError } = require('../core/cli-error');
const { readJson } = require('./files');
const { t } = require('../core/i18n');

const BASE_FILE = '.build-plan-base.json';
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const object = value => value && typeof value === 'object' && !Array.isArray(value);

// Arrays represent ordered business facts; conflicting edits require a decision.
function reconcile(base, current, proposed, field, conflicts) {
  if (equal(current, proposed) || equal(proposed, base)) { return current; }
  if (equal(current, base)) { return proposed; }
  if (object(base) && object(current) && object(proposed)) {
    const result = {};
    for (const key of new Set([...Object.keys(base), ...Object.keys(current), ...Object.keys(proposed)])) {
      const value = reconcile(base[key], current[key], proposed[key], field ? `${field}.${key}` : key, conflicts);
      if (value !== undefined) { result[key] = value; }
    }
    return result;
  }
  conflicts.push(field);
  return proposed;
}

// Only part-proposed meta keys merge, so CLI-owned fields (revision, status, planState) stay untouched.
function reconcileMeta(base, current, proposed, conflicts) {
  if (!object(proposed)) { return reconcile(base, current, proposed, 'meta', conflicts); }
  return Object.fromEntries(Object.entries(proposed).map(([key, value]) => [key,
    reconcile(base?.[key], current?.[key], value, `meta.${key}`, conflicts)]));
}

function rebaseParts(source, input, businessFile, visualFile) {
  const { planBase } = require('./parallel');
  const baselinePath = path.join(path.dirname(path.resolve(input)), BASE_FILE);
  const fail = (code, details) => { throw new CliError(t('design_plan.rebase_required'), { code, details: { baselinePath, ...details } }); };
  if (!fs.existsSync(baselinePath)) { fail('DESIGN_PLAN_BASELINE_MISSING', { nextStep: t('design_plan.baseline_missing') }); }
  const saved = readJson(baselinePath);
  if (saved.schemaVersion !== 1 || !object(saved.plan) || !equal(saved.base, planBase(saved.plan))) {
    fail('DESIGN_PLAN_BASELINE_INVALID', { nextStep: t('design_plan.baseline_missing') });
  }
  // Confirmed plans are final: later edits go through patch --materialize.
  if (source.meta?.status === 'confirmed' || source.meta?.planState?.planConfirmed === true
      || source.meta?.planState?.confirmedRevision) {
    fail('DESIGN_PLAN_REBASE_STAGE_INVALID', { nextStep: t('design_plan.rebase_stage_invalid') });
  }
  const parts = [businessFile, visualFile].map(file => readJson(file));
  for (const [index, part] of parts.entries()) {
    if (!equal(part.base, saved.base) || !object(part.facts)) {
      fail('DESIGN_PLAN_BASELINE_MISMATCH', { sourcePath: [businessFile, visualFile][index], nextStep: t('design_plan.baseline_missing') });
    }
  }
  return parts.map((part, index) => {
    const conflicts = [];
    const facts = Object.fromEntries(Object.keys(part.facts).map(key => [key, key === 'meta'
      ? reconcileMeta(saved.plan.meta, source.meta, part.facts.meta, conflicts)
      : reconcile(saved.plan[key], source[key], part.facts[key], key, conflicts),
    ]));
    if (conflicts.length) {
      fail('DESIGN_PLAN_REBASE_CONFLICT', { sourcePath: [businessFile, visualFile][index], conflicts, nextStep: t('design_plan.rebase_conflict') });
    }
    return { ...part, facts, base: planBase(source) };
  });
}

module.exports = { BASE_FILE, rebaseParts };
