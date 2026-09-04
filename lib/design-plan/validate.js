'use strict';

const path = require('path');
const { readJson } = require('./files');
const { CliError } = require('../core/cli-error');

const ROOT = path.resolve(__dirname, '../../yida-skills/skills/yida-design/sub_skill/yida-design-plan');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const filled = value => typeof value === 'string' && value.trim().length > 0;

// Collect independent authoring errors before running the full rendering and business validators.
function collectIssues(plan) {
  const issues = [];
  const check = (valid, path, message) => {if (!valid) {issues.push({ path, message });} return !!valid;};
  const strings = (value, path, keys) => keys.forEach(key => check(filled(value?.[key]), `${path}.${key}`, '填写非空文本'));
  const array = (value, path, required = false) => check(Array.isArray(value) && (!required || value.length > 0), path, required ? '填写非空数组' : '填写数组');
  if (!check(object(plan), '$', '填写计划对象')) {return issues;}
  strings(plan.meta, 'meta', ['projectName', 'revision']);
  strings(plan.overview, 'overview', ['summary']);
  array(plan.overview?.rolePermissionSummary, 'overview.rolePermissionSummary', true);
  const models = Array.isArray(plan.dataModels) ? plan.dataModels : [];
  array(plan.dataModels, 'dataModels');
  const modelNames = new Set();
  models.forEach((model, index) => {
    const p = `dataModels[${index}]`;
    if (!check(object(model), p, '填写数据模型对象')) {return;}
    strings(model, p, ['name']);
    check(!modelNames.has(model.name), `${p}.name`, '模型名称保持唯一');
    modelNames.add(model.name);
    if (array(model.fields, `${p}.fields`, true)) {
      model.fields.forEach((field, i) => {
        strings(field, `${p}.fields[${i}]`, ['name', 'type']);
        check(typeof field?.required === 'boolean', `${p}.fields[${i}].required`, '使用 true 或 false');
      });
    }
  });
  if (array(plan.businessFlows, 'businessFlows')) {
    plan.businessFlows.forEach((flow, index) => {
      const p = `businessFlows[${index}]`;
      strings(flow, p, ['name', 'trigger']);
      array(flow?.nodes, `${p}.nodes`, true);
      array(flow?.rules, `${p}.rules`, true);
    });
  }
  const samples = plan.execution?.sampleDataPlan;
  if (samples !== undefined) {array(samples, 'execution.sampleDataPlan');}
  models.forEach((model, index) => {
    if (!object(model) || String(model.formType).includes('流程')) {return;}
    const entryIndex = Array.isArray(samples) ? samples.findIndex(entry => entry?.form === model.name) : -1;
    const entry = samples === undefined ? { records: model.sampleRecords, skipReason: model.skipSampleReason } : samples?.[entryIndex];
    const p = samples === undefined ? `dataModels[${index}].sampleRecords` : `execution.sampleDataPlan[${entryIndex}]`;
    if (!check(object(entry), p, `补齐 ${model.name} 的示例记录或 skipReason`)) {return;}
    if (filled(entry.skipReason)) {return;}
    if (!check(Array.isArray(entry.records) && entry.records.length > 0 && entry.records.length <= 3, p, '填写 1–3 条业务示例记录，或说明跳过原因')) {return;}
    const fields = Array.isArray(model.fields) ? model.fields : [];
    entry.records.forEach((record, i) => {
      if (!check(object(record), `${p}[${i}]`, '使用字段名称与具体值组成记录对象')) {return;}
      check(Object.keys(record).every(key => fields.some(field => field?.name === key)), `${p}[${i}]`, '示例记录使用已定义的业务字段名称');
      fields.filter(field => field?.required).forEach(field => {
        check(record[field.name] !== undefined && record[field.name] !== null && record[field.name] !== '', `${p}[${i}].${field.name}`, '补齐必填字段');
      });
    });
  });
  const pages = plan.pages?.customPageDetails;
  const ids = new Set();
  const patternScenes = { 'data-insight': 'dashboard', 'catalog-browse': 'list', 'brand-landing': 'landing', 'progress-narrative': 'detail', 'split-pane-ops': 'detail' };
  const scenes = new Set((Array.isArray(pages) ? pages : []).map(page => page?.sceneKey || page?.pageSpecHandoff?.scene || page?.scene || patternScenes[page?.layoutPattern?.id] || 'workbench'));
  const patterns = readJson(path.join(ROOT, 'templates/page-patterns/index.json')).patterns;
  if (array(pages, 'pages.customPageDetails')) {
    pages.forEach((page, index) => {
      const p = `pages.customPageDetails[${index}]`;
      if (!check(object(page), p, '填写页面对象')) {return;}
      strings(page, p, ['pageId', 'name', 'primaryTask', 'permissionSummary', 'firstScreenStructure', 'density']);
      check(!ids.has(page.pageId), `${p}.pageId`, '页面 ID 保持唯一');
      ids.add(page.pageId);
      array(page.contentPriority, `${p}.contentPriority`, true);
      array(page.contentRichness?.contentLayers, `${p}.contentRichness.contentLayers`, true);
      check(patterns.some(item => item.id === page.layoutPattern?.id), `${p}.layoutPattern.id`, '使用 authoring-context 中的页面模式 ID');
      const handoff = page.pageSpecHandoff || {};
      if (check(object(handoff), `${p}.pageSpecHandoff`, '填写交接对象')) {
        const keys = ['scene', 'pageStructure', 'entryMode', 'contentBlocks', 'dataSources', 'dataBinding', 'emptyReason', 'primaryAction', 'themeSummary', 'designFile', 'designRefs'];
        for (const key of Object.keys(handoff)) {
          check(keys.includes(key), `${p}.pageSpecHandoff.${key}`, key === 'sceneKey' ? `移到 ${p}.sceneKey` : '使用编写契约中的交接字段');
        }
        check(handoff.designFile === undefined || handoff.designFile === `prd/${plan.meta?.projectName}/design.md`, `${p}.pageSpecHandoff.designFile`, '省略此字段，由 CLI 生成同项目设计路径');
        if (handoff.designRefs !== undefined && array(handoff.designRefs, `${p}.pageSpecHandoff.designRefs`, true)) {
          handoff.designRefs.forEach((ref, i) => {
            if (typeof ref === 'string' && ref.startsWith('sceneRecipes.')) {
              check(scenes.has(ref.slice('sceneRecipes.'.length)), `${p}.pageSpecHandoff.designRefs[${i}]`, '引用已有页面的 sceneKey，默认设计引用由 CLI 生成');
            }
          });
        }
        array(handoff.contentBlocks || page.blocks, `${p}.blocks`, true);
        const binding = handoff.dataBinding || page.dataBinding;
        check(['form', 'report', 'connector', 'static-empty'].includes(binding), `${p}.dataBinding`, '选择 form/report/connector/static-empty');
        const sources = handoff.dataSources || page.dataSources;
        if (array(sources, `${p}.dataSources`, binding !== 'static-empty')) {
          if (binding === 'form') {check(sources.every(name => modelNames.has(name)), `${p}.dataSources`, '引用已定义的数据模型名称');}
          if (binding === 'static-empty') {
            check(sources.length === 0 && filled(handoff.emptyReason || page.emptyReason), `${p}.emptyReason`, '空态填写原因并使用空数据来源数组');
          }
        }
      }
    });
  }
  if (/^2(?:\.|$)/.test(String(plan.schemaVersion))) {
    const user = plan.visualStyle?.forUser;
    strings(user?.visualDirection, 'visualStyle.forUser.visualDirection', ['label', 'description']);
    check(['top', 'side'].includes(user?.navigationStyle?.structure), 'visualStyle.forUser.navigationStyle.structure', '选择 top 或 side');
    check(['light', 'dark'].includes(user?.navigationStyle?.tone), 'visualStyle.forUser.navigationStyle.tone', '选择 light 或 dark');
    check(/^#[0-9a-f]{6}$/i.test(user?.colorStrategy?.primaryColor || ''), 'visualStyle.forUser.colorStrategy.primaryColor', '填写 6 位 HEX 色值');
    const selected = plan.visualStyle?.internal?.selectedTheme || user?.selectedTheme;
    const themes = readJson(path.join(ROOT, 'templates/design-themes/index.json')).themes;
    check(themes.some(theme => theme.themeId === selected?.themeId), 'visualStyle.internal.selectedTheme.themeId', '使用主题索引中的 themeId');
  }
  return issues;
}

function validateAuthoring(plan) {
  const issues = collectIssues(plan);
  // A single issue keeps the existing precise error code from the full validator.
  if (issues.length > 1) {
    throw new CliError(`计划有 ${issues.length} 项待补充：\n${issues.map(issue => `${issue.path}: ${issue.message}`).join('\n')}`, {
      code: 'DESIGN_PLAN_VALIDATION_FAILED', details: { issues },
    });
  }
  return issues;
}

module.exports = { collectIssues, validateAuthoring };
