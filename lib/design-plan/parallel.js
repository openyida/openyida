'use strict';

const { createHash } = require('crypto');
const { CliError } = require('../core/cli-error');
const { readJson } = require('./files');

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

function mergeParts(source, businessFile, visualFile) {
  const base = planBase(source);
  const business = readPart(businessFile, 'business', base, ['overview', 'dataModels', 'businessFlows', 'pages', 'execution', 'meta']);
  const visual = readPart(visualFile, 'visual', base, ['visualStyle']);
  if (!object(business.overview) || !Array.isArray(business.dataModels) || !Array.isArray(business.businessFlows)
    || !Array.isArray(business.pages?.customPageDetails) || !object(visual.visualStyle)) {
    throw new CliError('业务片段需包含 overview/dataModels/businessFlows/pages；视觉片段需包含 visualStyle', { code: 'DESIGN_PLAN_PART_INCOMPLETE' });
  }
  if (business.meta !== undefined && (!object(business.meta)
    || Object.keys(business.meta).some(key => !['businessDomain', 'experienceTopology'].includes(key)))) {
    throw new CliError('业务 meta 仅填写 businessDomain/experienceTopology，版本由 CLI 维护', { code: 'DESIGN_PLAN_PART_CONFLICT' });
  }
  const pageIds = business.pages.customPageDetails.map(page => page.pageId);
  const applications = visual.visualStyle.forUser?.pageApplications;
  if (!Array.isArray(applications) || applications.length !== pageIds.length
    || new Set(applications.map(item => item.pageId)).size !== pageIds.length
    || applications.some(item => !pageIds.includes(item.pageId) || !Array.isArray(item.visualMemoryApplications))) {
    throw new CliError('视觉规划需按业务页面逐一完成 pageApplications，再合并产物', { code: 'DESIGN_PLAN_PAGE_BINDINGS_REQUIRED' });
  }
  const plan = JSON.parse(JSON.stringify({ ...source, ...business, ...visual, meta: { ...source.meta, ...business.meta },
    execution: { ...source.execution, ...business.execution, appConfig: { ...source.execution?.appConfig, ...business.execution?.appConfig } },
  }));
  // Load after module initialization: patch also uses the materializer.
  require('./patch').invalidateConfirmation(plan);
  plan.meta.status = 'awaiting_confirmation';
  return plan;
}

module.exports = { planBase, mergeParts };
