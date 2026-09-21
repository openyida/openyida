'use strict';

const { createHash } = require('crypto');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { readJson } = require('./files');
const { assertVisualFieldObjects } = require('./normalize');

const object = value => value && typeof value === 'object' && !Array.isArray(value);

function planBase(plan) {
  return { revision: plan.meta?.revision, digest: createHash('sha256').update(JSON.stringify(plan)).digest('hex') };
}

function readPart(file, role, base, allowed) {
  const part = readJson(file, `${role} 规划片段`);
  if (!object(part) || part.ready !== true || !object(part.facts)) {
    throw new CliError(`${role} 规划尚未完成，请补齐 facts 并设置 ready=true`, { code: 'DESIGN_PLAN_PART_NOT_READY' });
  }
  if (part.base?.revision !== base.revision || part.base?.digest !== base.digest) {
    throw new CliError(`${role} 规划来自旧版本，请根据当前计划重新整理`, { code: 'DESIGN_PLAN_STALE_PART' });
  }
  const unknown = Object.keys(part.facts).filter(key => !allowed.includes(key));
  if (unknown.length) {
    throw new CliError(`${role} 规划包含其他职责的字段：${unknown.join(', ')}`, { code: 'DESIGN_PLAN_PART_CONFLICT' });
  }
  return part.facts;
}

// Report all binding defects at once so agents can repair the existing part.
function assertPageBindings(pages, applications, visualFile, businessFile) {
  const prefix = 'facts.visualStyle.forUser.pageApplications';
  const issues = [];
  const pageIds = [];
  pages.forEach((page, index) => {
    const field = `facts.pages.customPageDetails[${index}].pageId`;
    if (!object(page) || typeof page.pageId !== 'string' || !page.pageId.trim()) {
      issues.push({ sourcePath: businessFile, path: field, code: 'expected_nonempty_string' });
    } else if (pageIds.includes(page.pageId)) {
      issues.push({ sourcePath: businessFile, path: field, code: 'duplicate_page', pageId: page.pageId });
    } else { pageIds.push(page.pageId); }
  });
  const seen = new Set();
  if (!Array.isArray(applications)) {
    issues.push({ sourcePath: visualFile, path: prefix, code: 'expected_array' });
  } else {
    applications.forEach((item, index) => {
      const field = `${prefix}[${index}]`;
      if (!object(item)) {
        issues.push({ sourcePath: visualFile, path: field, code: 'expected_object' });
        return;
      }
      if (typeof item.pageId !== 'string' || !item.pageId.trim()) {
        issues.push({ sourcePath: visualFile, path: `${field}.pageId`, code: 'expected_nonempty_string' });
      } else {
        if (!pageIds.includes(item.pageId)) {
          issues.push({ sourcePath: visualFile, path: `${field}.pageId`, code: 'unexpected_page', pageId: item.pageId });
        }
        if (seen.has(item.pageId)) {
          issues.push({ sourcePath: visualFile, path: `${field}.pageId`, code: 'duplicate_page', pageId: item.pageId });
        }
        seen.add(item.pageId);
      }
      if (!Array.isArray(item.visualMemoryApplications)) {
        issues.push({ sourcePath: visualFile, path: `${field}.visualMemoryApplications`, code: 'expected_array' });
      }
    });
  }
  pageIds.filter(pageId => !seen.has(pageId)).forEach(pageId => {
    issues.push({ sourcePath: visualFile, path: prefix, code: 'missing_page', pageId });
  });
  if (issues.length) {
    const nextStep = t('design_plan.repair_page_bindings');
    const summary = issues.map(issue => `${issue.path}: ${issue.code}${issue.pageId ? ` (${issue.pageId})` : ''}`).join('; ');
    throw new CliError(`${nextStep} ${summary}`, {
      code: 'DESIGN_PLAN_PAGE_BINDINGS_REQUIRED',
      details: { sourcePath: visualFile, expectedPageIds: pageIds, issues, nextStep },
    });
  }
}

function mergeParts(source, businessFile, visualFile) {
  const base = planBase(source);
  const business = readPart(businessFile, 'business', base, ['overview', 'dataModels', 'businessFlows', 'pages', 'execution', 'meta']);
  const visual = readPart(visualFile, 'visual', base, ['visualStyle']);
  assertVisualFieldObjects(visual.visualStyle?.forUser, { prefix: 'facts.visualStyle.forUser', sourcePath: visualFile });
  if (!object(business.overview) || !Array.isArray(business.dataModels) || !Array.isArray(business.businessFlows)
    || !Array.isArray(business.pages?.customPageDetails) || !object(visual.visualStyle)) {
    throw new CliError('业务片段需包含 overview/dataModels/businessFlows/pages；视觉片段需包含 visualStyle', { code: 'DESIGN_PLAN_PART_INCOMPLETE' });
  }
  if (business.meta !== undefined && (!object(business.meta)
    || Object.keys(business.meta).some(key => !['businessDomain', 'experienceTopology'].includes(key)))) {
    throw new CliError('业务 meta 仅填写 businessDomain/experienceTopology，版本由 CLI 维护', { code: 'DESIGN_PLAN_PART_CONFLICT' });
  }
  assertPageBindings(business.pages.customPageDetails, visual.visualStyle.forUser?.pageApplications, visualFile, businessFile);
  const plan = JSON.parse(JSON.stringify({ ...source, ...business, ...visual, meta: { ...source.meta, ...business.meta },
    ...(source.execution || business.execution ? { execution: { ...source.execution, ...business.execution,
      ...(source.execution?.appConfig || business.execution?.appConfig
        ? { appConfig: { ...source.execution?.appConfig, ...business.execution?.appConfig } } : {}),
    } } : {}),
  }));
  // Load after module initialization: patch also uses the materializer.
  if (require('./patch').invalidateConfirmation(plan, source) || plan.meta.status === 'draft') {
    plan.meta.status = 'awaiting_confirmation';
  }
  return plan;
}

module.exports = { planBase, mergeParts };
