'use strict';

const path = require('path');
const { CliError } = require('../core/cli-error');
const { readJson } = require('./files');

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const PLAN_SKILL_ROOT = path.join(
  PACKAGE_ROOT,
  'yida-skills',
  'skills',
  'yida-design',
  'sub_skill',
  'yida-design-plan'
);
const THEME_INDEX_PATH = path.join(PLAN_SKILL_ROOT, 'templates', 'design-themes', 'index.json');
const PAGE_PATTERN_INDEX_PATH = path.join(PLAN_SKILL_ROOT, 'templates', 'page-patterns', 'index.json');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function compactSchema(plan) {
  return /^2(?:\.|$)/.test(String(plan.schemaVersion || ''));
}

function pageType(formType) {
  if (String(formType || '').includes('流程')) {
    return '宜搭流程表单';
  }
  return '宜搭表单';
}

function derivePageOverview(plan) {
  const pages = plan.pages || {};
  const custom = list(pages.customPageDetails).map(page => ({
    name: page.name,
    type: page.type || 'AI 自定义页面',
    purpose: page.purpose || page.primaryTask || page.positioning,
  }));
  const customNames = new Set(custom.map(page => page.name));
  const forms = list(plan.dataModels)
    .filter(model => !customNames.has(model.name))
    .map(model => ({
      name: model.name,
      type: pageType(model.formType),
      purpose: model.description,
    }));
  return [...custom, ...forms];
}

function deriveGraphNodes(dataModels) {
  const colors = ['#5B8FF9', '#61C5A8', '#F6B269', '#9270CA', '#5AD8A6', '#E8684A'];
  return list(dataModels).map((model, index) => ({
    id: `model-${index + 1}`,
    name: model.name,
    source: model.formType,
    group: model.group || '业务数据',
    color: colors[index % colors.length],
  }));
}

function ensureOverview(plan) {
  const overview = plan.overview = plan.overview || {};
  const pages = plan.pages = plan.pages || {};
  if (!list(pages.overview).length) {
    pages.overview = derivePageOverview(plan);
  }
  overview.businessGraph = overview.businessGraph || {};
  overview.businessGraph.type = overview.businessGraph.type || 'table_relation_graph';
  if (!list(overview.businessGraph.nodes).length) {
    overview.businessGraph.nodes = deriveGraphNodes(plan.dataModels);
  }
  overview.businessGraph.relations = list(overview.businessGraph.relations);
  if (!list(overview.dataModelSummary).length) {
    overview.dataModelSummary = list(plan.dataModels).map(model => `${model.name}：${model.description || '核心业务数据'}`);
  }
  if (!list(overview.flowSummary).length) {
    overview.flowSummary = list(plan.businessFlows).map(flow => `${flow.name}：${flow.description || list(flow.nodes).join(' → ')}`);
  }
  if (!list(overview.pageSummary).length) {
    overview.pageSummary = list(pages.customPageDetails).map(page => `${page.name}：${page.primaryTask || page.positioning}`);
  }
  if (!list(overview.navigationSummary).length) {
    overview.navigationSummary = list(pages.overview).map(page => `${page.name}：${page.purpose}`);
  }
}

function ensurePageRules(plan, pagePatternIndex) {
  const patterns = new Map(list(pagePatternIndex.patterns).map(pattern => [pattern.id, pattern]));
  const richnessDefaults = pagePatternIndex.contentRichness || {};
  for (const page of list((plan.pages || {}).customPageDetails)) {
    const pattern = page.layoutPattern = page.layoutPattern || {};
    pattern.id = pattern.id || 'custom-page-pattern';
    const preset = patterns.get(pattern.id);
    if (!preset) {
      throw new CliError(`未知页面模式：${pattern.id}`, {
        code: 'DESIGN_PLAN_PAGE_PATTERN_UNKNOWN',
        details: { pageId: page.pageId, patternId: pattern.id },
      });
    }
    if (!pattern.mode) {
      pattern.mode = pattern.id === 'custom-page-pattern'
        ? 'custom'
        : list(pattern.adaptations).length > 0 ? 'adapted' : 'preset';
    }
    pattern.adaptations = list(pattern.adaptations);
    if (!list(pattern.mustKeep).length) {
      pattern.mustKeep = list(preset.mustKeep);
    }
    const richness = page.contentRichness = page.contentRichness || {};
    richness.requirement = richness.requirement || richnessDefaults.requirement || 'rich-but-relevant';
    richness.contentLayers = list(richness.contentLayers);
    if (!list(richness.antiFiller).length) {
      richness.antiFiller = list(richnessDefaults.antiFiller);
    }
  }
}

function selectedTheme(plan, themeIndex) {
  const visual = plan.visualStyle = plan.visualStyle || {};
  const forUser = visual.forUser = visual.forUser || {};
  const internal = visual.internal = visual.internal || {};
  const selected = internal.selectedTheme || forUser.selectedTheme || {};
  internal.selectedTheme = selected;
  const theme = list(themeIndex.themes).find(item => item.themeId === selected.themeId);
  if (!theme) {
    throw new CliError(`主题索引中不存在 themeId：${selected.themeId || '(empty)'}`, {
      code: 'DESIGN_PLAN_THEME_UNKNOWN',
      details: { themeId: selected.themeId },
    });
  }
  if (selected.templatePath && selected.templatePath !== theme.templatePath) {
    throw new CliError('selectedTheme 的 themeId 与 templatePath 不属于主题索引中的同一记录', {
      code: 'DESIGN_PLAN_THEME_MISMATCH',
      details: { selectedTheme: selected },
    });
  }
  selected.label = selected.label || theme.label;
  selected.templatePath = theme.templatePath;
  selected.summary = selected.summary || [theme.description, selected.customText].filter(Boolean).join('；');
  forUser.themeProfile = { ...(theme.defaultProfile || {}), ...(forUser.themeProfile || {}) };
  return theme;
}

function pageApplicationDefaults(page, color) {
  const pattern = page.layoutPattern || {};
  const colorUsage = color.usage || `${color.primaryColorName || '主题色'}只用于主操作、关键焦点和选中状态`;
  return {
    pageId: page.pageId,
    pageName: page.name,
    layoutPatternMode: pattern.mode,
    layoutPatternId: pattern.id,
    visualApplication: `继承项目设计系统的完整 Token、组件、状态与响应式规则，不改变 ${page.name} 的 ${pattern.id} 页面模式。`,
    surface: '画布、容器、边框、圆角与阴影按项目设计系统执行，不另写页面级标准。',
    primaryAction: `按钮与动作层级按项目设计系统执行；${colorUsage}。`,
    states: '默认、悬停、按下、聚焦、禁用、加载、空态、错误、无权限和选中状态按项目设计系统执行。',
  };
}

function ensureVisual(plan) {
  const visual = plan.visualStyle;
  const forUser = visual.forUser;
  const selected = visual.internal.selectedTheme;
  const direction = forUser.visualDirection || {};
  const color = forUser.colorStrategy = forUser.colorStrategy || {};
  const navigation = forUser.navigationStyle || {};
  if (!direction.label || !direction.description) {
    throw new CliError('schemaVersion 2.0 必须提供 visualStyle.forUser.visualDirection.label 和 description', {
      code: 'DESIGN_PLAN_VISUAL_DIRECTION_REQUIRED',
    });
  }
  if (!['top', 'side'].includes(navigation.structure)) {
    throw new CliError('visualStyle.forUser.navigationStyle.structure 必须是 top 或 side', {
      code: 'DESIGN_PLAN_INVALID_NAVIGATION_STRUCTURE',
      details: { structure: navigation.structure },
    });
  }
  if (!['light', 'dark'].includes(navigation.tone)) {
    throw new CliError('visualStyle.forUser.navigationStyle.tone 必须是 light 或 dark', {
      code: 'DESIGN_PLAN_INVALID_NAVIGATION_TONE',
      details: { tone: navigation.tone },
    });
  }
  const sourceApplications = new Map(list(forUser.pageApplications).map(item => [item.pageId || item.pageName, item]));
  forUser.pageApplications = list((plan.pages || {}).customPageDetails).map(page => {
    const source = sourceApplications.get(page.pageId) || sourceApplications.get(page.name) || {};
    const application = { ...pageApplicationDefaults(page, color), ...source };
    application.pageId = page.pageId;
    application.pageName = page.name;
    application.layoutPatternMode = (page.layoutPattern || {}).mode;
    application.layoutPatternId = (page.layoutPattern || {}).id;
    application.visualMemoryApplications = list(source.visualMemoryApplications);
    application.visualMemories = application.visualMemoryApplications.map(item => item.name).filter(Boolean);
    return application;
  });
  forUser.styleSource = forUser.styleSource || direction.source || color.source || 'AI 推断';
  forUser.styleSummary = forUser.styleSummary || `${direction.label}：${direction.description}；${color.primaryColorName || '主题色'} ${color.primaryColor || '-'} 按项目色彩策略使用。`;
  forUser.hierarchySummary = forUser.hierarchySummary || '页面层次、表面和容器关系遵循统一项目设计系统。';
  forUser.componentToneSummary = forUser.componentToneSummary || '按钮、输入、卡片、表格和反馈组件遵循统一项目设计系统。';
  forUser.stateSummary = forUser.stateSummary || '默认、悬停、按下、聚焦、禁用、加载、空态、错误、无权限和选中状态保持一致。';
  forUser.responsiveSummary = forUser.responsiveSummary || '响应式断点、重排和触控规则保持统一，并维持页面主任务顺序。';
  forUser.iconSummary = forUser.iconSummary || '图标风格、尺寸和语义保持一致。';
  forUser.assetStrategy = forUser.assetStrategy || { materialStatus: 'none', missingAssets: [], notes: '不得编造素材 URL。' };
  forUser.designMdReady = forUser.designMdReady || 'materialize 将从所选完整主题模板生成 design.md。';

  const forDesignMd = visual.forDesignMd = visual.forDesignMd || {};
  forDesignMd.designTemplate = {
    themeId: selected.themeId,
    templatePath: selected.templatePath,
    instanceRule: '完整读取主题模板，注入项目业务差异与逐页视觉记忆点绑定。',
  };
  forDesignMd.productTopologyApplication = forDesignMd.productTopologyApplication
    || `${plan.meta.experienceTopology || '当前产品形态'}下的全部页面共享项目设计系统；页面模式、内容优先级和信息密度保持页面规划。`;
  forDesignMd.pagePatterns = list((plan.pages || {}).customPageDetails).map(page => ({
    pageId: page.pageId,
    mode: page.layoutPattern.mode,
    id: page.layoutPattern.id,
    adaptations: list(page.layoutPattern.adaptations),
    contentRichness: page.contentRichness.requirement,
    mustKeep: list(page.layoutPattern.mustKeep),
  }));
  forDesignMd.themeStrategy = forDesignMd.themeStrategy || {
    colorSource: color.source,
    colorRoles: ['主色', '辅助色', '中性色', '语义色'],
    notes: '主题色策略与页面模式相互独立。',
  };
  delete forDesignMd.componentRules;
  delete forDesignMd.stateRules;
  delete forDesignMd.responsiveRules;
  delete forDesignMd.qualityGates;

  const overview = plan.overview || {};
  overview.visualSummary = overview.visualSummary || forUser.styleSummary;
}

function normalizePlan(sourcePlan) {
  if (!sourcePlan || typeof sourcePlan !== 'object' || Array.isArray(sourcePlan)) {
    throw new CliError('build-plan.json 顶层必须是 object', {
      code: 'DESIGN_PLAN_INVALID_ROOT',
    });
  }
  if (!compactSchema(sourcePlan)) {
    return sourcePlan;
  }
  const plan = clone(sourcePlan);
  const themeIndex = readJson(THEME_INDEX_PATH, '主题索引');
  const pagePatternIndex = readJson(PAGE_PATTERN_INDEX_PATH, '页面模式索引');
  ensureOverview(plan);
  ensurePageRules(plan, pagePatternIndex);
  selectedTheme(plan, themeIndex);
  ensureVisual(plan);
  return plan;
}

module.exports = {
  normalizePlan,
};
