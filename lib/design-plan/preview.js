'use strict';

const fs = require('fs');
const path = require('path');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { readJson, writeFiles } = require('./files');
const { planBase } = require('./parallel');
const { ensureOverview } = require('./normalize');
const { renderDraftPrd, renderDesign, renderHtml } = require('./materialize');
const { applyDesignTokens } = require('../app/theme-from-design');

const ROOT = path.resolve(__dirname, '../..');
const TEMPLATE = path.join(ROOT, 'yida-skills/skills/yida-design/sub_skill/yida-design-plan/assets/build-plan-template.html');
const CSS_TEMPLATE = path.join(ROOT, 'yida-skills/skills/yida-design/references/theme/app-custom-theme-template.css');
const SECTIONS = { overview: '需求总览', 'data-models': '数据模型', 'business-flows': '业务流程', pages: '页面规划' };
const MODULES = ['overview', 'dataModels', 'businessFlows', 'pages', 'visualStyle'];
const clone = value => JSON.parse(JSON.stringify(value));
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function invalid(reason) {
  throw new CliError(t('help.design_plan_preview_invalid'), { code: 'DESIGN_PLAN_PREVIEW_INVALID', details: { reason } });
}

function readPart(file, base) {
  const part = readJson(file, 'preview part');
  if (part.base?.digest !== base.digest || part.base?.revision !== base.revision) { invalid('stale base'); }
  if (!part.facts || typeof part.facts !== 'object' || Array.isArray(part.facts)) { invalid('facts'); }
  const keys = Object.keys(part.facts);
  if (!keys.length || keys.some(key => !MODULES.includes(key))) { invalid('facts modules'); }
  for (const [key, value] of Object.entries(part.facts)) {
    if (['dataModels', 'businessFlows'].includes(key) ? !Array.isArray(value) : !value || typeof value !== 'object' || Array.isArray(value)) { invalid(key); }
  }
  if (part.mode !== undefined && !['replace', 'upsert'].includes(part.mode)) { invalid('mode'); }
  return { facts: part.facts, mode: part.mode || 'replace' };
}

function upsertItems(previous = [], incoming, key) {
  const items = new Map(previous.map(item => [item[key], item]));
  const seen = new Set();
  for (const item of incoming) {
    if (!item || typeof item[key] !== 'string' || !item[key].trim() || seen.has(item[key])) { invalid(`item key: ${key}`); }
    seen.add(item[key]); items.set(item[key], item);
  }
  return [...items.values()];
}

function htmlShell(title) {
  const slots = {
    title: escapeHtml(title),
    nav_items: Object.entries(SECTIONS).map(([id, label]) => `<a class="nav-item" href="#${id}" data-section-id="${id}">${label}</a>`).join(''),
    content: '<p role="status">方案正在完善，完成后将提供完整方案供您确认。</p>\n' + Object.entries(SECTIONS).map(([id, label]) =>
      `<!-- draft:${id}:start --><section id="${id}" class="page-section"><h2>${label}</h2><p>正在完善</p></section><!-- draft:${id}:end -->`).join('\n'),
  };
  return fs.readFileSync(TEMPLATE, 'utf8').replace(/\{\{(title|nav_items|content)\}\}/g, (_, key) => slots[key]);
}

function updateBlock(content, key, value) {
  const start = `<!-- draft:${key}:start -->`;
  const end = `<!-- draft:${key}:end -->`;
  const a = content.indexOf(start), b = content.indexOf(end, a + start.length);
  if (a < 0 || b < 0 || content.indexOf(start, a + start.length) >= 0) { invalid(`missing or duplicate block: ${key}`); }
  return content.slice(0, a + start.length) + value + content.slice(b);
}

function preview(inputPath, options = {}) {
  if (!options.partFile) { invalid('--part-file'); }
  const input = path.resolve(inputPath);
  // Drafts are isolated from the version presented for confirmation.
  const dir = path.join(path.dirname(input), 'preview');
  fs.mkdirSync(dir, { recursive: true });
  const lock = path.join(dir, '.write.lock');
  let fd;
  try { fd = fs.openSync(lock, 'wx'); } catch (error) {
    if (error.code === 'EEXIST') { invalid('preview writer busy; retry after the current update'); }
    throw error;
  }
  try {
    const source = readJson(input);
    const base = planBase(source);
    const part = readPart(options.partFile, base);
    const facts = part.facts;
    const stateFile = path.join(dir, '.state.json');
    const previous = fs.existsSync(stateFile) ? readJson(stateFile) : null;
    const fresh = !previous || previous.base.digest !== base.digest;
    const state = fresh ? { base, facts: {} } : previous;
    if (part.mode === 'upsert') {
      for (const key of Object.keys(facts)) {
        if (['dataModels', 'businessFlows'].includes(key)) { facts[key] = upsertItems(state.facts[key], facts[key], 'name'); }
        else if (key === 'pages' && Array.isArray(facts.pages.customPageDetails)) {
          facts.pages = { ...state.facts.pages, ...facts.pages, customPageDetails: upsertItems(state.facts.pages?.customPageDetails, facts.pages.customPageDetails, 'pageId') };
        } else { invalid(`upsert module: ${key}`); }
      }
    }
    const changed = Object.keys(facts).filter(key => JSON.stringify(state.facts[key]) !== JSON.stringify(facts[key]));
    const outputs = { prd: path.join(dir, 'prd.md'), design: path.join(dir, 'design.md'), html: path.join(dir, 'build-plan.html'), theme: path.join(dir, 'app-theme.css') };
    if (!changed.length) { return { success: true, draft: true, outputs, updated: [] }; }
    const hadVisual = !fresh && Boolean(state.facts.visualStyle);
    Object.assign(state.facts, facts);
    const accepted = state.facts;
    const plan = clone({ ...source, overview: accepted.overview || {}, dataModels: accepted.dataModels || [],
      businessFlows: accepted.businessFlows || [], pages: accepted.pages || {}, visualStyle: accepted.visualStyle || source.visualStyle });
    ensureOverview(plan);
    const prdSections = [...renderDraftPrd(plan).matchAll(/^## (\d+)\. ([^\n]+)\n([\s\S]*?)(?=^## \d+\. |$(?![\s\S]))/gm)];
    const ready = new Set([1, 2]);
    if (accepted.dataModels) { ready.add(3); }
    if (accepted.pages) { ready.add(4); }
    if (accepted.visualStyle) { ready.add(5); }
    if (accepted.businessFlows || accepted.overview?.flowSummary) { ready.add(6); }
    let prd = fresh ? `# ${source.meta.appName || source.meta.projectName} PRD\n\n方案草稿，完成后统一校验。\n\n` + prdSections.map(([, key, title]) =>
      `<!-- draft:${key}:start -->\n## ${key}. ${title}\n\n正在完善\n<!-- draft:${key}:end -->`).join('\n\n') : fs.readFileSync(outputs.prd, 'utf8');
    for (const [section, key] of prdSections) {
      if (ready.has(Number(key))) { prd = updateBlock(prd, key, '\n' + section.trim() + '\n'); }
    }
    let html = fresh ? htmlShell(source.meta.appName || source.meta.projectName) : fs.readFileSync(outputs.html, 'utf8');
    const htmlSections = new Set(['overview']);
    if (changed.includes('dataModels')) { htmlSections.add('data-models'); }
    if (changed.includes('businessFlows')) { htmlSections.add('business-flows'); }
    if (accepted.pages && changed.some(key => ['pages', 'dataModels', 'visualStyle'].includes(key))) { htmlSections.add('pages'); }
    const fragments = JSON.parse(renderHtml(plan, [...htmlSections]));
    for (const [key, fragment] of Object.entries(fragments)) { html = updateBlock(html, key, fragment); }
    const files = [[outputs.prd, prd], [outputs.html, html]];
    if (accepted.visualStyle && changed.some(key => ['visualStyle', 'pages'].includes(key))) {
      const applications = plan.visualStyle.forUser?.pageApplications || [];
      const pages = plan.pages.customPageDetails || [];
      const bindingsReady = pages.every(page => applications.some(item => item.pageId === page.pageId && item.visualMemoryApplications?.length));
      const designPlan = clone(plan);
      if (!bindingsReady) { designPlan.pages = { customPageDetails: [] }; }
      const design = renderDesign(designPlan);
      const oldDesign = hadVisual && fs.existsSync(outputs.design) ? fs.readFileSync(outputs.design, 'utf8') : undefined;
      const css = hadVisual && fs.existsSync(outputs.theme) ? fs.readFileSync(outputs.theme, 'utf8') : fs.readFileSync(CSS_TEMPLATE, 'utf8');
      files.push([outputs.design, design], [outputs.theme, applyDesignTokens(css, design, oldDesign)]);
    } else if (fresh) {
      files.push([outputs.design, '# 设计方案\n\n正在完善\n'], [outputs.theme, '/* 主题方案正在完善 */\n']);
    }
    files.push([stateFile, JSON.stringify(state, null, 2) + '\n']);
    const updates = files.filter(([file, content]) => !fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content);
    writeFiles(updates);
    return { success: true, draft: true, outputs, modules: Object.keys(accepted), updated: updates.map(([file]) => file) };
  } finally {
    fs.closeSync(fd); fs.unlinkSync(lock);
  }
}

function finalizePreview(source, stateFile) {
  const { facts } = readPart(stateFile, planBase(source));
  if (MODULES.some(key => !(key in facts))) { invalid('complete all preview modules before final validation'); }
  const merged = clone({ ...source, ...facts });
  require('./patch').invalidateConfirmation(merged);
  merged.meta.status = 'awaiting_confirmation';
  return merged;
}

module.exports = { preview, updateBlock, finalizePreview };
