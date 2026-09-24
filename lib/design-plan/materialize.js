'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { normalizePlan, assertThemeProfile } = require('./normalize');
const { readJson, writeFiles } = require('./files');
const { prepareUpdates } = require('./artifact-updates');
const { validateAuthoring } = require('./validate');
const { buildEntryNavigation, resolvePageEntryMode, ENTRY_MODE_SUMMARIES } = require('./entry-navigation');
const { buildPageNavigationPolicy } = require('./navigation-policy');
const { buildAssetTasks } = require('../asset/asset-plan');
const { mergeParts } = require('./parallel');
const { performance } = require('perf_hooks');
const { readDesignTokens, applyDesignTokens } = require('../app/theme-from-design');
const { PLAN_SKILL_ROOT, loadThemeIndex, themeTemplatePath, themeNavTheme, resolveThemeColors, resolveColorToken } = require('./themes');
const { parseDesignDocument, serializeDesignDocument, validateDesignDocument } = require('../design/document');

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const HTML_RENDERER_PATH = path.join(PLAN_SKILL_ROOT, 'scripts', 'render_build_plan.py');
const PAGE_CONTINUITY_PATH = path.join(PACKAGE_ROOT, 'yida-skills', 'skills', 'yida-design', 'references', 'page-continuity.md');
const THEME_CONSISTENCY_PATH = path.join(PACKAGE_ROOT, 'yida-skills', 'skills', 'yida-design', 'references', 'application-theme-consistency.md');

function text(value, fallback = '-') {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.map(item => text(item, '')).filter(Boolean).join(' / ') : fallback;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value).replace(/\r?\n/g, ' ');
}

function mdCell(value) {
  return text(value).replace(/\|/g, '\\|');
}

function mdList(items, fallback = '- 无') {
  const values = Array.isArray(items) ? items.filter(item => item !== undefined && item !== null && item !== '') : [];
  return values.length > 0 ? values.map(item => `- ${text(item)}`).join('\n') : fallback;
}

function mdTable(headers, rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  return [
    `| ${headers.map(mdCell).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...(safeRows.length > 0
      ? safeRows.map(row => `| ${row.map(mdCell).join(' | ')} |`)
      : [`| ${headers.map((_, index) => index === 0 ? '-' : '').join(' | ')} |`]),
  ].join('\n');
}

function visualSelections(plan) {
  const visual = plan.visualStyle || {};
  const forUser = visual.forUser || {};
  const selectedTheme = ((visual.internal || {}).selectedTheme) || forUser.selectedTheme || {};
  const visualDirection = forUser.visualDirection || {
    label: '统一业务工具风格',
    description: forUser.styleSummary || '保持清晰、稳定并适合持续业务操作。',
    source: forUser.styleSource || selectedTheme.source || 'legacy_default',
  };
  const theme = loadThemeIndex().themes.find(item => item.themeId === selectedTheme.themeId);
  const navigationStyle = {
    ...(forUser.navigationStyle || {}),
    ...(theme && theme.mode !== 'creative' ? { tone: themeNavTheme(theme), toneSource: 'theme_derived' } : {}),
  };
  return { visual, forUser, selectedTheme, visualDirection, navigationStyle };
}

function navigationToneLabel(value) {
  return value === 'dark' ? '深色' : '浅色';
}

function resolveContentTone(theme, tokens) {
  if (['light', 'dark'].includes(theme.contentTone)) {return theme.contentTone;}
  requireFact(theme.mode === 'creative', `主题 ${theme.themeId} 缺少 contentTone`);
  const pageColor = resolveColorToken(tokens, '--pod-page-bg-color');
  requireFact(/^#[\dA-F]{6}$/i.test(pageColor || ''), '自由创意必须提供可判断界面明暗的 --pod-page-bg-color');
  const rgb = [1, 3, 5].map(index => parseInt(pageColor.slice(index, index + 2), 16));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 < 128 ? 'dark' : 'light';
}

function requireFact(condition, message) {
  if (!condition) {throw new CliError(message, { code: 'DESIGN_PLAN_INCOMPLETE_CONTRACT' });}
}

const nonEmpty = value => typeof value === 'string' && value.trim().length > 0;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const nonEmptyList = value => Array.isArray(value) && value.length > 0;

function validateBusiness(plan, execution) {
  requireFact(nonEmpty(plan.meta?.projectName) && nonEmpty(plan.overview?.summary), '缺少应用名称或业务目标');
  requireFact(nonEmpty(plan.meta?.revision), '缺少计划 revision');
  requireFact(nonEmptyList(plan.overview?.rolePermissionSummary) && plan.overview.rolePermissionSummary.every(nonEmpty), '缺少角色与权限说明');
  requireFact(Array.isArray(plan.dataModels) && Array.isArray(plan.businessFlows), 'dataModels/businessFlows 必须是数组；无此业务时显式写 []');
  const models = plan.dataModels;
  const names = new Set();
  for (const model of models) {
    requireFact(nonEmpty(model.name) && !names.has(model.name), '数据模型名称缺失或重复');
    names.add(model.name);
    requireFact(nonEmptyList(model.fields), `${model.name} 缺少字段定义`);
    for (const field of model.fields) {
      requireFact(nonEmpty(field.name) && nonEmpty(field.type) && typeof field.required === 'boolean', `${model.name} 字段缺少名称、类型或必填规则`);
    }
  }
  for (const flow of plan.businessFlows) {
    requireFact(nonEmpty(flow.name) && nonEmpty(flow.trigger) && nonEmptyList(flow.nodes) && nonEmptyList(flow.rules), '业务流程缺少名称、触发条件、节点或规则');
  }
  requireFact(object(execution), 'execution 必须是对象');
  const arrays = ['resourceBlueprint', 'resourceCreationOrder', 'pageImplementationOrder', 'navigationOrder', 'sampleDataPlan', 'acceptanceCriteria'];
  const allowed = [...arrays, 'navigationFallback', 'interactionStates', 'explicitScope', 'appConfig', 'entryRecommendation'];
  for (const key of Object.keys(execution)) {
    requireFact(allowed.includes(key), `未知 execution 字段：${key}`);
    if (arrays.includes(key)) {requireFact(Array.isArray(execution[key]), `execution.${key} 必须是数组`);}
  }
  if (execution.appConfig !== undefined) {
    requireFact(object(execution.appConfig), 'execution.appConfig 必须是对象');
    const fields = ['appType', 'corpId', 'baseUrl', 'navigationType', 'hideAppNav', 'layoutDirection', 'navTheme', 'logoSource'];
    for (const [key, value] of Object.entries(execution.appConfig)) {
      requireFact(fields.includes(key) && nonEmpty(value), `无效应用配置：${key}`);
    }
    requireFact(execution.appConfig.hideAppNav === undefined || ['y', 'n'].includes(execution.appConfig.hideAppNav), 'hideAppNav 必须是 y 或 n');
  }
  if (execution.interactionStates !== undefined) {
    requireFact(object(execution.interactionStates), 'interactionStates 必须是对象');
    for (const [key, value] of Object.entries(execution.interactionStates)) {
      requireFact(['empty', 'loading', 'error', 'formEntry', 'detail'].includes(key) && nonEmpty(value), `无效交互状态：${key}`);
    }
  }
  for (const key of ['resourceBlueprint', 'resourceCreationOrder', 'acceptanceCriteria']) {
    if (execution[key] !== undefined) {requireFact(nonEmptyList(execution[key]), `${key} 不能为空`);}
  }
  if (execution.acceptanceCriteria !== undefined) {
    requireFact(execution.acceptanceCriteria.every(nonEmpty), 'acceptanceCriteria 必须使用非空业务验收说明');
  }
  if (execution.navigationFallback !== undefined) {requireFact(nonEmpty(execution.navigationFallback), 'navigationFallback 不能为空');}
}

function sampleDataPlan(models, supplied) {
  const forms = models.filter(model => !String(model.formType).includes('流程'));
  const entries = supplied === undefined ? forms.map(model => ({
    form: model.name, records: model.sampleRecords || [], skipReason: model.skipSampleReason || '',
  })) : supplied;
  requireFact(Array.isArray(entries), 'sampleDataPlan 必须是数组');
  const seen = new Set();
  for (const entry of entries) {
    const model = forms.find(form => form.name === entry.form);
    requireFact(model && !seen.has(entry.form), `示例数据表单未知或重复：${entry.form}`);
    seen.add(entry.form);
    if (nonEmpty(entry.skipReason)) {
      requireFact(!entry.records?.length && (!entry.count || entry.count === 0), `${entry.form} 跳过示例数据时不能同时指定记录`);
      entry.count = 0;
      entry.records = [];
      continue;
    }
    requireFact(nonEmptyList(entry.records) && entry.records.length <= 3, `${entry.form} 必须提供 1–3 条业务示例记录，或写明 skipSampleReason/skipReason`);
    const fields = new Set(model.fields.map(field => field.name));
    for (const record of entry.records) {
      requireFact(object(record) && Object.keys(record).length > 0 && Object.keys(record).every(key => fields.has(key)), `${entry.form} 示例记录必须使用已定义的业务字段名`);
      for (const field of model.fields.filter(field => field.required)) {
        requireFact(record[field.name] !== undefined && record[field.name] !== null && record[field.name] !== '', `${entry.form} 示例记录缺少必填字段：${field.name}`);
      }
    }
    requireFact(entry.count === undefined || entry.count === entry.records.length, `${entry.form} 示例数量与记录不符`);
    entry.count = entry.records.length;
  }
  requireFact(forms.every(form => seen.has(form.name)), 'sampleDataPlan 遗漏核心普通表单；不写入时请说明跳过原因');
  return entries;
}

const NAVIGATION_TYPES = {
  'platform-l-shape': { label: '平台L型导航', layout: 'l_shape' },
  'platform-top': { label: '平台顶部导航', layout: 'top' },
  'platform-side': { label: '平台侧边导航', layout: 'side' },
  custom: { label: '自定义导航' },
};

function navigationConfig(plan) {
  const supplied = plan.execution?.appConfig || {};
  const structure = visualSelections(plan).navigationStyle.structure;
  const legacyLayout = supplied.layoutDirection || structure;
  const navigationType = supplied.navigationType || (supplied.hideAppNav === 'y' ? 'custom'
    : { l_shape: 'platform-l-shape', top: 'platform-top', side: 'platform-side' }[legacyLayout] || 'platform-l-shape');
  const type = NAVIGATION_TYPES[navigationType];
  requireFact(type, `未知导航类型：${navigationType}`);
  const hideAppNav = navigationType === 'custom' ? 'y' : 'n';
  const layoutDirection = type.layout || legacyLayout || 'l_shape';
  requireFact(supplied.hideAppNav === undefined || supplied.hideAppNav === hideAppNav, '导航类型与 hideAppNav 冲突');
  requireFact(supplied.layoutDirection === undefined || supplied.layoutDirection === layoutDirection, '导航类型与 layoutDirection 冲突');
  requireFact(['top', 'side', 'l_shape'].includes(layoutDirection), 'layoutDirection 必须是 top、side 或 l_shape');
  return { navigationType, hideAppNav, layoutDirection };
}

function sceneForPage(page) {
  const patternScenes = {
    'data-insight': 'dashboard', 'catalog-browse': 'list', 'brand-landing': 'landing',
    'progress-narrative': 'detail', 'split-pane-ops': 'detail',
  };
  return page.pageSpecHandoff?.scene || page.scene || patternScenes[(page.layoutPattern || {}).id] || 'workbench';
}

function pageHandoff(page, plan) {
  const supplied = page.pageSpecHandoff === undefined ? {} : page.pageSpecHandoff;
  requireFact(object(supplied), `页面 ${page.name} 的 pageSpecHandoff 必须是对象`);
  const handoffKeys = ['scene', 'pageStructure', 'entryMode', 'navigation', 'contentBlocks', 'dataSources', 'dataBinding', 'emptyReason', 'primaryAction', 'themeSummary', 'designFile', 'designRefs'];
  requireFact(Object.keys(supplied).every(key => handoffKeys.includes(key)), `页面 ${page.name} 的 pageSpecHandoff 包含未知字段`);
  const scene = sceneForPage(page);
  const structures = {
    workbench: 'workbench', dashboard: 'dashboard-overview', list: 'business-list',
    detail: 'detail-profile', landing: 'official-homepage', screen: 'data-screen',
  };
  const customNavigation = navigationConfig(plan).navigationType === 'custom';
  const entryMode = resolvePageEntryMode(page, plan, { sceneKey: page.sceneKey || scene, customNavigation });
  requireFact(!customNavigation || entryMode === 'standalone', `自定义导航的页面 ${page.name} 必须使用 standalone 入口`);
  if (supplied.navigation !== undefined) {
    const nav = supplied.navigation;
    requireFact(object(nav) && Object.keys(nav).every(key => ['type', 'variant', 'reason'].includes(key)), `页面 ${page.name} 的 navigation 必须只描述页面菜单`);
    requireFact(['custom', 'none'].includes(nav.type), `页面 ${page.name} 的 navigation.type 必须是 custom 或 none`);
    requireFact(entryMode === 'standalone', `页面 ${page.name} 的独立菜单必须使用 standalone 入口，不能叠加平台导航`);
    requireFact(nav.type === 'custom' ? ['top', 'side', 'mixed', 'dock'].includes(nav.variant) : nav.variant === undefined, `页面 ${page.name} 的 navigation.variant 与菜单类型不匹配`);
    requireFact(nonEmpty(nav.reason), `页面 ${page.name} 缺少导航依据`);
  }
  if (!structures[scene] || !['platform-shell', 'standalone'].includes(entryMode)) {
    throw new CliError(`页面 ${page.name} 的 scene 或 entryMode 无效`, { code: 'DESIGN_PLAN_INVALID_PAGE_HANDOFF' });
  }
  const pageStructure = supplied.pageStructure || page.pageStructure || structures[scene];
  requireFact([...Object.values(structures), 'split-pane-detail', 'portal-shell-home'].includes(pageStructure), `页面 ${page.name} 的 pageStructure 无效`);
  const dataSources = supplied.dataSources || page.dataSources || [];
  const dataBinding = supplied.dataBinding || page.dataBinding;
  const emptyReason = supplied.emptyReason || page.emptyReason;
  requireFact(['form', 'report', 'connector', 'static-empty'].includes(dataBinding), `页面 ${page.name} 必须明确 dataBinding`);
  requireFact(Array.isArray(dataSources) && dataSources.every(nonEmpty), `页面 ${page.name} 的 dataSources 必须是来源名称数组`);
  if (dataBinding === 'static-empty') {
    requireFact(nonEmpty(emptyReason) && dataSources.length === 0, `页面 ${page.name} 的空态必须写明 emptyReason，不能同时声明已接入数据源`);
  } else {
    requireFact(dataSources.length > 0, `页面 ${page.name} 缺少数据来源`);
    if (dataBinding === 'form') {
      requireFact(dataSources.every(name => (plan.dataModels || []).some(model => model.name === name)), `页面 ${page.name} 引用了未知表单`);
    }
  }
  requireFact(nonEmpty(page.name) && nonEmpty(page.primaryTask) && nonEmpty(page.permissionSummary), '页面缺少名称、核心任务或权限说明');
  requireFact(nonEmpty(supplied.primaryAction || page.primaryTask), `页面 ${page.name} 缺少主操作`);
  const contentBlocks = supplied.contentBlocks || page.blocks;
  requireFact(nonEmptyList(contentBlocks) && contentBlocks.every(nonEmpty), `页面 ${page.name} 的内容区块需使用非空文本，或完整的 name/purpose 结构化输入`);
  requireFact(!Array.isArray(page.blocks) || page.blocks.every(nonEmpty), `页面 ${page.name} 的 blocks 包含未完成的区块说明`);
  const sceneKey = page.sceneKey || scene;
  if (!/^[\p{L}\p{N}_-]+$/u.test(sceneKey)) {
    throw new CliError(`页面 ${page.name} 的 sceneKey 无效`, { code: 'DESIGN_PLAN_INVALID_PAGE_HANDOFF' });
  }
  const designFile = `prd/${plan.meta.projectName}/design.md`;
  requireFact(supplied.designFile === undefined || supplied.designFile === designFile, `页面 ${page.name} 的 designFile 必须指向 ${designFile}`);
  const refs = supplied.designRefs;
  requireFact(refs === undefined || (nonEmptyList(refs) && refs.every(nonEmpty)), `页面 ${page.name} 的 designRefs 必须是非空数组`);
  const forUser = (plan.visualStyle || {}).forUser || {};
  return {
    contentBlocks: page.blocks || [],
    dataSources, dataBinding,
    ...(emptyReason ? { emptyReason } : {}),
    primaryAction: page.primaryTask,
    themeSummary: `${forUser.styleSummary || ''} / ${(forUser.colorStrategy || {}).primaryColor || ''}`,
    ...supplied,
    scene,
    entryMode,
    pageStructure, designFile,
    designRefs: [...new Set(['themeProfile', `sceneRecipes.${sceneKey}`, ...(refs || [])])],
  };
}

function pageNavigationRows(page, plan) {
  // Draft previews can display navigation before business details are complete.
  const handoff = page.pageSpecHandoff || {};
  const applicationCustom = navigationConfig(plan).navigationType === 'custom';
  const menu = handoff.navigation;
  const entryMode = resolvePageEntryMode(page, plan, {
    sceneKey: page.sceneKey || sceneForPage(page), customNavigation: applicationCustom,
  });
  const variants = { top: '顶部', side: '侧边', mixed: '顶部与侧边', dock: '底部' };
  return [
    ['访问方式', entryMode === 'standalone' ? '独立页面入口' : '应用工作区入口'],
    ['页面菜单', menu ? (menu.type === 'custom' ? `自定义${variants[menu.variant] || ''}菜单` : '不设菜单')
      : applicationCustom ? '沿用应用自定义菜单' : entryMode === 'standalone' ? '未规划应用菜单，仅实现业务内容' : '沿用平台导航'],
    ['页面实现边界', entryMode === 'platform-shell' ? '只实现业务内容；同任务分类用页内 Tab，跨模块切换交给平台菜单，不重复自绘管理导航' : '按独立入口方案组织内容，不嵌套平台导航'],
    ['导航影响范围', applicationCustom ? '应用采用自定义导航' : entryMode === 'standalone' ? '仅当前入口，应用工作区保留平台导航' : '保留平台导航'],
    ...(menu ? [['选择依据', menu.reason]] : []),
  ];
}

function buildExecution(plan, options = {}) {
  const pages = (plan.pages || {}).customPageDetails || [];
  const models = plan.dataModels || [];
  const { navigationStyle } = visualSelections(plan);
  const execution = plan.execution === undefined ? {} : plan.execution;
  const resourceOnly = execution.explicitScope?.allowInferredResources === false;
  validateBusiness(plan, execution);
  const visualConfig = { navTheme: navigationStyle.tone, logoSource: 'appIcon' };
  const navigation = navigationConfig(plan);
  for (const [key, value] of Object.entries(visualConfig)) {
    if (execution.appConfig?.[key] !== undefined && execution.appConfig[key] !== value) {
      throw new CliError(`execution.appConfig.${key} 与视觉事实冲突`, { code: 'DESIGN_PLAN_CONFIG_CONFLICT' });
    }
  }
  const interactionStates = {
    empty: '说明当前无数据并提供登记或返回入口', loading: '保留上下文并显示加载状态', error: '显示原因和重试入口',
    formEntry: '复用原生表单时，PC 使用 50vw 抽屉，移动端整页打开；前台全码填写按页面交互设计接入真实数据，提交后刷新结果',
    detail: '使用真实 formInstId 打开详情；缺少 ID 时禁用入口',
  };
  const resources = [
    ...models.map(model => ({ name: model.name, type: String(model.formType).includes('流程') ? 'process-form' : 'normal-form', purpose: model.description })),
    ...pages.map(page => ({ name: page.name, type: 'display-page', pageId: page.pageId, purpose: page.primaryTask })),
  ];
  const pageHandoffs = pages.map(page => {
    const spec = pageHandoff(page, plan);
    if (options.designFile) {spec.designFile = options.designFile;}
    return { pageId: page.pageId, name: page.name, sceneKey: page.sceneKey || spec.scene, pageSpecHandoff: spec,
      navigationPolicy: buildPageNavigationPolicy(spec, navigation.navigationType),
    };
  });
  const defaultAcceptanceCriteria = [
    ...models.map(model => `${model.name}的字段、必填规则与关系符合数据模型`),
    ...(plan.businessFlows || []).map(flow => `${flow.name}按触发条件和业务规则执行`),
    ...pages.map(page => `${page.name}支持${page.primaryTask || page.positioning}`),
    ...pageHandoffs.filter(page => page.navigationPolicy.applicationMenuOwner === 'platform')
      .map(page => `${page.name}只实现业务内容，同任务分类可用页内 Tab，跨模块使用平台菜单；实际管理入口无重复导航`),
    ...(!resourceOnly ? [
      '应用主题按 design.md 配置，页面消费同一组 token',
      '核心普通表单示例数据写入并抽查，或说明跳过原因',
    ] : []),
  ];
  const handoff = {
    resourceBlueprint: resources,
    resourceCreationOrder: resourceOnly
      ? [...models.map(model => model.name), ...pages.map(page => page.name)]
      : ['应用与主题配置', ...models.map(model => model.name), '初始示例数据', ...pages.map(page => page.name), '发布与导航排序'],
    pageImplementationOrder: pages.map(page => page.pageId || page.name),
    navigationOrder: [],
    navigationFallback: resourceOnly ? '本轮显式窄范围不执行导航排序' : '全部资源完成后按管理任务统一排序；不自动创建首页或把独立前台置顶',
    ...execution,
    acceptanceCriteria: [...new Set([...defaultAcceptanceCriteria, ...(execution.acceptanceCriteria || [])])],
    interactionStates: { ...interactionStates, ...execution.interactionStates },
    sampleDataPlan: sampleDataPlan(models, execution.sampleDataPlan === undefined ? undefined : JSON.parse(JSON.stringify(execution.sampleDataPlan))),
    appConfig: { appType: '待创建后回填', corpId: '待登录态确认', baseUrl: '待目标环境确认', ...execution.appConfig, ...visualConfig, ...navigation },
    pages: pageHandoffs,
  };
  requireFact(new Set(pages.map(page => page.pageId)).size === pages.length && pages.every(page => nonEmpty(page.pageId)), '页面 pageId 缺失或重复');
  const resourcesByName = new Map(resources.map(resource => [resource.name, resource]));
  requireFact(resourcesByName.size === resources.length, '业务表单与页面名称重复');
  const blueprintNames = new Set();
  for (const resource of handoff.resourceBlueprint) {
    requireFact(object(resource) && nonEmpty(resource.name), '资源蓝图缺少名称');
    requireFact(['normal-form', 'process-form', 'display-page', 'report'].includes(resource.type), `资源 ${resource.name} 类型必须为 normal-form、process-form、display-page 或 report`);
    requireFact(!blueprintNames.has(resource.name), `资源蓝图名称重复：${resource.name}`);
    blueprintNames.add(resource.name);
    const expected = resourcesByName.get(resource.name);
    requireFact(expected ? resource.type === expected.type : resource.type === 'report', `资源 ${resource.name} 类型与业务模型或页面不一致，表单和自定义页面必须有对应定义`);
    if (expected?.type === 'display-page' && resource.pageId !== undefined) {
      requireFact(resource.pageId === expected.pageId, `资源 ${resource.name} 的 pageId 与页面定义不一致`);
    }
  }
  requireFact(resources.every(resource => blueprintNames.has(resource.name)), '资源蓝图遗漏业务表单或页面');
  const entryNavigation = buildEntryNavigation(plan, handoff.resourceBlueprint, handoff.pages);
  if (entryNavigation) {
    handoff.entryRecommendation = entryNavigation.recommendation;
    handoff.entryModeSummary = ENTRY_MODE_SUMMARIES[entryNavigation.recommendation.mode];
    const skipOrder = resourceOnly || navigation.navigationType === 'custom' || entryNavigation.recommendation.mode === 'frontend-only';
    if (execution.navigationOrder !== undefined) {
      requireFact(JSON.stringify(execution.navigationOrder) === JSON.stringify(skipOrder ? [] : entryNavigation.platformOrder), 'navigationOrder 与入口管理菜单冲突，请修改入口菜单这一份源事实');
    }
    handoff.navigationOrder = skipOrder ? [] : entryNavigation.platformOrder;
    handoff.navigationFallback = skipOrder
      ? (resourceOnly ? '当前窄范围保留无关入口顺序' : '平台排序命令不适用；按各入口 menu 顺序与 defaultMenuKey 实现自定义导航并验证首页')
      : '按业务管理入口的默认任务和菜单顺序排序平台导航；独立前台按自身 menu 与 defaultMenuKey 落实顺序和首页';
    if (!resourceOnly) {
      handoff.acceptanceCriteria.push(entryNavigation.recommendation.mode === 'service-management'
        ? '分别验证访客、业务管理者及双身份用户的入口、视图、数据范围和操作权限；导航预览不代替真实身份验证'
        : '按当前入口的实际访问者验证默认任务、视图、数据范围和操作权限；不追加范围外角色或首页');
      handoff.acceptanceCriteria.push('逐入口核对菜单及分组顺序、默认页面和首屏任务；自定义导航不因跳过平台排序命令而免验，排序回读不替代实际入口验证');
    }
  }
  handoff.pageNavigation = [...resources, ...handoff.resourceBlueprint.filter(resource => resource.type === 'report')]
    .filter(resource => navigation.navigationType === 'custom' || handoff.pages.some(page => page.name === resource.name && page.pageSpecHandoff.entryMode === 'standalone'))
    .map(resource => ({ name: resource.name, type: resource.type, isRenderNav: false }));
  requireFact(handoff.resourceCreationOrder.every(nonEmpty) && resources.every(resource => handoff.resourceCreationOrder.includes(resource.name)), '资源创建顺序遗漏业务表单或页面');
  requireFact(handoff.pageImplementationOrder.every(nonEmpty) && pages.every(page => handoff.pageImplementationOrder.includes(page.pageId) || handoff.pageImplementationOrder.includes(page.name)), '页面实现顺序遗漏页面');
  requireFact(handoff.acceptanceCriteria.every(nonEmpty), '验收标准必须为非空业务描述');
  return handoff;
}

function renderEntryNavigation(recommendation) {
  if (!Array.isArray(recommendation?.entries)) {return [];}
  const lines = ['### 访问态入口与权限', ENTRY_MODE_SUMMARIES[recommendation.mode], '页面隐藏导航不授予业务权限。', ''];
  for (const entry of recommendation.entries) {
    const rows = [];
    const visit = items => {
      for (const item of items || []) {
        if (item.children) {visit(item.children); continue;}
        rows.push([item.label, item.resource, item.targetType, item.viewUuid || item.viewKey,
          (item.access || []).map(access => `${access.resource}：${access.operation}；${access.dataScope}`), item.key === entry.defaultMenuKey ? '默认入口' : '']);
      }
    };
    visit(entry.menu);
    lines.push(`#### ${entry.name}`, '', mdTable(['菜单', '资源', '用途', '视图', '权限依赖', '默认落点'], rows), '');
  }
  return lines;
}

function renderPrd(plan, handoff = buildExecution(plan)) {
  const overview = plan.overview || {};
  const models = plan.dataModels || [];
  const pages = plan.pages || {};
  const forUser = (plan.visualStyle || {}).forUser || {};
  const lines = [
    '---', `projectName: ${JSON.stringify(plan.meta.projectName)}`,
    `buildPlanRevision: ${JSON.stringify(plan.meta.revision || 'unversioned')}`, '---', '',
    `# ${plan.meta.appName || plan.meta.projectName} PRD`, '',
    '由 build-plan.json 派生，业务契约与 Fast 相同。修改源事实后重新物化；完整视觉规则见 design.md。', '',
    '## 1. 应用基本信息', '', text(overview.summary), '',
    mdTable(['项目', '内容'], [
      ['核心对象', models.map(model => model.name)],
      ['角色与权限', overview.rolePermissionSummary],
      ['业务目标', overview.businessGoal || overview.summary],
      ['使用场景', plan.meta.experienceTopology],
    ]), '',
    '### 业务关系', '',
    text(overview.businessGraph?.description || overview.businessGraph?.summary), '',
    mdTable(['起点表', '关系', '终点表', '说明'], (overview.businessGraph?.relations || []).map(r => [r.from, r.label, r.to, r.description])), '',
    '### 数据模型摘要', '', mdList(overview.dataModelSummary), '',
    '### 导航菜单摘要', '', mdList(overview.navigationSummary || overview.pageSummary), '',
    '## 2. 应用配置', '', mdTable(['配置项', '值'], [
      ['导航类型', NAVIGATION_TYPES[handoff.appConfig.navigationType].label],
      ['平台应用导航', handoff.appConfig.hideAppNav === 'y' ? '隐藏' : '显示'],
      ['导航配色', handoff.appConfig.navTheme === 'dark' ? '深色' : '浅色'],
    ]), '',
    '### 页面导航配置', '', mdTable(['页面', '平台页面导航'], handoff.pageNavigation.map(page => [page.name, page.isRenderNav ? '显示' : '隐藏'])), '',
    ...renderEntryNavigation(handoff.entryRecommendation || plan.execution?.entryRecommendation),
    '## 3. 数据结构（业务语义，不含细节 ID）',
  ];
  for (const model of models) {
    lines.push('', `### ${model.name}（${text(model.formType)}）`, '', text(model.description), '',
      `视图：${text(model.views)}`, '',
      mdTable(['字段', '字段类型', '必填', '默认值/选项', '关联关系', '分组', '说明'],
        (model.fields || []).map(f => [f.name, f.type, f.required, f.defaultOrOptions, f.relation, f.group, f.description])));
  }
  lines.push('', '### 初始示例数据计划', '', mdList(handoff.sampleDataPlan), '',
    '## 4. 页面与功能设计', '',
    mdTable(['页面', '类型', '用途'], (pages.overview || []).map(p => [p.name, p.type, p.purpose])));
  (pages.customPageDetails || []).forEach((page, index) => {
    lines.push('', `### ${page.name}`, '', mdTable(['项目', '内容'], [
      ['页面定位', page.positioning], ['核心用户', page.primaryUsers], ['核心任务', page.primaryTask],
      ['内容优先级', page.contentPriority], ['功能区块', page.blocks], ['首屏结构', page.firstScreenStructure],
      ['标志性交互', page.signatureInteraction], ['页面模式', page.layoutPattern], ['信息密度', page.density],
      ['内容丰富度', page.contentRichness], ['权限说明', page.permissionSummary],
      ...pageNavigationRows(page, plan),
      ...Object.entries(handoff.pages[index].pageSpecHandoff),
    ]));
  });
  lines.push('', '## 5. 应用主题与风格摘要', '', mdTable(['项目', '内容'], [
    ['设计文件', `prd/${plan.meta.projectName}/design.md`], ['主题色', forUser.colorStrategy?.primaryColor],
    ['风格摘要', forUser.styleSummary], ['主题交付', '公共 CSS 模板 + design.md token；通过 CLI 生成应用主题'],
    ['设计引用', 'themeProfile / sceneRecipes.<sceneKey>'],
  ]), '', '## 6. 业务逻辑与交互状态');
  if (overview.flowSummary?.length) {
    lines.push('', '### 业务流程与规则摘要', '', mdList(overview.flowSummary));
  }
  for (const flow of plan.businessFlows || []) {
    lines.push('', `### [${text(flow.type)}] ${flow.name}`, '', `触发：${text(flow.trigger)}`, '',
      `链路：${text(flow.nodes)}`, '', text(flow.description), '', mdList(flow.rules));
  }
  lines.push('', mdTable(['状态/入口', '规则'], Object.entries(handoff.interactionStates)), '',
    '## 7. 资源蓝图', '', mdTable(['资源', '类型', '用途'], handoff.resourceBlueprint.map(r => [r.name, r.type, r.purpose])), '',
    '## 8. 资源创建顺序', '', mdList(handoff.resourceCreationOrder), '',
    '## 9. 页面实现交付顺序', '', mdList(handoff.pageImplementationOrder), '',
    '## 10. 导航顺序', '', mdList(handoff.navigationOrder, handoff.navigationFallback), '',
    '## 11. 验收标准', '', mdList(handoff.acceptanceCriteria), '',
    '### 结构化交接', '', '真实资源 ID 由实施阶段解析；designFile 相对项目工作目录。', '',
    '```json', JSON.stringify(handoff, null, 2), '```', '');
  return lines.join('\n');
}

function normalizeHex(value) {
  const match = /^#([0-9a-f]{6})$/i.exec(String(value || '').trim());
  return match ? `#${match[1].toUpperCase()}` : null;
}

function resolveTheme(plan) {
  const { selectedTheme: selected } = visualSelections(plan);
  const index = loadThemeIndex();
  const theme = (index.themes || []).find(item => item.themeId === selected.themeId);
  if (!theme || (theme.templatePath !== selected.templatePath && (!theme.legacyTemplatePath || theme.legacyTemplatePath !== selected.templatePath))) {
    throw new CliError('selectedTheme 的 themeId 与 templatePath 不属于主题索引中的同一记录', {
      code: 'DESIGN_PLAN_THEME_MISMATCH',
      details: { selectedTheme: selected },
    });
  }
  assertThemeProfile(plan.visualStyle?.forUser?.themeProfile, theme);
  const templatePath = themeTemplatePath(theme);
  return { theme, templatePath };
}

function pageAnchor(pageId) {
  return `page-${Buffer.from(String(pageId), 'utf8').toString('hex')}`;
}

function renderProjectFacts(plan, visualDirection, color) {
  return [
    '### 项目视觉选择与事实', '',
    `- 视觉方向：${text(visualDirection.label)}`,
    `- 方向说明：${text(visualDirection.description)}`,
    `- 主题色：${text(color.primaryColorName)} \`${text(color.primaryColor)}\``,
    `- 业务领域：${text(plan.meta?.businessDomain)}`,
    `- 产品形态：${text(plan.meta?.experienceTopology)}`,
    `- 主题应用与前后台边界：${text(plan.visualStyle?.forDesignMd?.productTopologyApplication)}`,
    `- 已确认视觉约束：${text(plan.visualStyle?.constraints, '无额外约束')}`,
  ].join('\n');
}

function renderNavigationDesign(plan, navigationStyle, tokens) {
  const roles = {
    '--pod-shell-theme-bg-color': '导航背景', '--pod-nav-item-text-color': '普通文字',
    '--pod-nav-item-text-hover-color': '悬停文字', '--pod-nav-item-text-selected-color': '选中文字',
    '--pod-nav-menu-bg-hover-color': '悬停背景', '--pod-nav-menu-bg-selected-color': '选中背景',
    '--pod-page-header-bg-color': '页头背景', '--pod-nav-logo-text': '应用名称',
    '--pod-nav-l-group-label-color': '分组文字', '--pod-nav-sub-divider-color': '分组边界',
    '--pod-nav-search-bg-color': '搜索背景', '--pod-nav-search-text-color': '搜索文字',
    '--pod-nav-popup-bg-color': '弹层背景', '--pod-nav-popup-border-radius': '弹层圆角',
    '--pod-nav-menu-item-height': '菜单高度', '--pod-nav-menu-item-radius': '菜单圆角',
    '--pod-nav-menu-item-border': '普通边框', '--pod-nav-menu-item-hover-border': '悬停边框',
    '--pod-nav-menu-item-selected-border': '选中边框', '--pod-nav-menu-item-padding': '菜单内距',
    '--pod-nav-menu-font-size': '菜单字号', '--pod-nav-menu-line-height': '菜单文字行高', '--pod-nav-menu-gap': '菜单间距',
    '--pod-nav-menu-item-selected-shadow': '选中项阴影',
    '--pod-nav-slide-aside-gap': '侧栏分区间距', '--pod-nav-slide-aside-padding': '侧栏内距',
    '--pod-nav-platform-header-height': '顶部框架高度', '--pod-nav-top-header-padding': '顶栏内距',
    '--pod-nav-top-tab-height': '顶部菜单高度', '--pod-nav-top-tab-item-padding': '顶部菜单内距',
    '--pod-nav-top-tab-item-max-width': '顶部菜单最大宽度',
    '--pod-nav-l-header-padding': 'L 型顶栏内距', '--pod-nav-l-aside-padding': 'L 型侧栏内距',
    '--pod-shell-lshape-border-radius': '框架圆角',
  };
  // Layout reasons can come from an older visual choice. Keep their business
  // clauses while stating the current navigation tone separately.
  const reason = navigationStyle.toneSource === 'theme_derived'
    ? String(navigationStyle.selectionReason || '').split(/[，,；;。]/)
      .filter(clause => !/(?:深色|浅色|暗色|亮色|黑色|白色).*(?:导航|菜单|侧栏)|(?:导航|菜单|侧栏).*(?:深色|浅色|暗色|亮色|黑色|白色)|(?:dark|light).*(?:nav|menu|sidebar)|(?:nav|menu|sidebar).*(?:dark|light)/i.test(clause))
      .filter(clause => clause.trim()).join('；')
    : navigationStyle.selectionReason;
  return [
    '#### 本项目导航与应用框架', '',
    `- 导航类型：${NAVIGATION_TYPES[navigationConfig(plan).navigationType].label}`,
    `- 导航明暗：${navigationToneLabel(navigationStyle.tone)}`,
    '- 导航背景：`--pod-shell-theme-bg-color`（最终值见 tokens）',
    `- 布局依据：${text(reason, '按业务入口、模块层级和切换频率安排菜单')}`,
    `- 明暗依据：${navigationStyle.toneSource === 'theme_derived' ? '沿用已选应用风格的导航明暗' : '采用本项目明确设计的导航明暗'}，当前为${navigationToneLabel(navigationStyle.tone)}。`, '',
    '- 导航、表单、自定义页面和记录详情共用本项目设计；导航覆盖项见 tokens.application-global.appearance.navigation，未声明项沿用平台绑定与默认值。', '',
    mdTable(['角色', '变量', '本项目取值'], Object.entries(roles).filter(([name]) => tokens[name]).map(([name, role]) => [role, name, tokens[name]])), '',
    ...(plan.pages?.customPageDetails || []).map(page => [
      `#### ${text(page.name)}的导航`, '', mdTable(['项目', '方案'], pageNavigationRows(page, plan)),
    ].join('\n')),
  ].join('\n');
}

function renderPageApplications(plan, tokens) {
  const applications = plan.visualStyle?.forUser?.pageApplications || [];
  const pages = plan.pages?.customPageDetails || [];
  return pages.map(page => {
    const application = applications.find(item => item.pageId === page.pageId) || {};
    const memories = (application.visualMemoryApplications || []).map(memory =>
      `${text(memory.name)}用于${text(memory.target)}（${text(memory.reason)}）`).join('；');
    const checks = Array.isArray(application.acceptanceChecks) ? application.acceptanceChecks : [];
    return [
      `<a id="${pageAnchor(page.pageId)}"></a>`,
      `### ${text(page.name)}`, '',
      `- 页面任务：${text(page.primaryTask)}。内容覆盖：${text(page.contentRichness?.contentLayers || page.blocks)}`,
      `- 首屏焦点：${text(application.firstScreenFocus, '草稿待补充')}`,
      `- 布局：${text(application.layout, '草稿待补充')}；页面模式 ${text(page.layoutPattern?.id)}，信息密度 ${text(page.density)}`,
      `- 表面与组件：画布使用 --pod-page-bg-color（${tokens['--pod-page-bg-color']}），主容器使用 --pod-card-bg-color（${tokens['--pod-card-bg-color']}），边界使用 --color-line1-1（${tokens['--color-line1-1']}）。${text(application.surface)}${memories ? `；${memories}` : ''}`,
      `- 主操作：${text(application.primaryAction)}`,
      `- 状态：${text(application.states)}`,
      `- 响应式：${text(application.responsive, '草稿待补充')}`,
      `- 验收：${checks.length ? checks.join('；') : '草稿待补充'}`,
    ].join('\n');
  }).join('\n\n') || '本项目使用原生表单与平台页面，没有自定义页面设计。';
}

function themeImplementationRules(chapter) {
  const headings = [...chapter.matchAll(/^### ([^\n]+)\n/gm)];
  const result = [];
  for (const [index, heading] of headings.entries()) {
    if (heading[1] === '项目页面设计') {continue;}
    const content = chapter.slice(heading.index + heading[0].length, headings[index + 1]?.index).trim();
    if (heading[1] === '页面设计验收') {
      result.push(`### 主题表达验收\n\n${content}`);
      continue;
    }
    // These source paragraphs mix durable rendering constraints with instructions
    // for authoring/instantiating templates. Retain the former sentence by sentence.
    const filtered = content.split('\n').map(line => {
      const bullet = /^- /.test(line) ? '- ' : '';
      const sentences = line.replace(/^- /, '').split(/(?<=[。；;])\s*/u);
      const keep = sentences.filter(sentence => !/themeId|front matter|sRGB|round\(|线性光|生成标记|生成期|占位|四舍五入|输出六位十六进制|用户未提供|用户已指定|未指定时|缺少输入|没有可用种子|由项目流程中的 AI|按依赖顺序计算|先解析唯一主色/.test(sentence));
      const text = keep.join('');
      return text.trim() ? bullet + text : '';
    }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (filtered) {result.push(`### ${heading[1].replace(/实例化$/, '职责与约束')}\n\n${filtered}`);}
  }
  return result.join('\n\n');
}

function renderProjectApplications(plan, tokens, color, chapter) {
  const assets = plan.visualStyle?.forUser?.assetStrategy || { pages: [] };
  const colors = {
    '--color-brand1-6': '主色与主要品牌操作', '--color-brand1-1': '品牌悬停',
    '--color-brand1-9': '品牌按下', '--color-brand1-10': '品牌禁用',
    '--pod-page-bg-color': '页面画布', '--pod-card-bg-color': '内容容器',
    '--color-fill1-5': '独立浮层', '--color-fill1-6': '弱图标与辅助操作', '--color-fill1-10': 'Tooltip背景', '--color-text1-5': 'Tooltip前景',
  };
  return [
    '## 5. 项目应用与调整规则', '',
    themeImplementationRules(chapter), '',
    '### 本项目实现边界', '',
    '本项目显式 Token 与页面决定优先于默认值；原生导航采用第二章的导航设计和导航差异 token 与平台默认绑定，自绘导航按本项目入口方案实施。导航、应用框架、表单、自定义页面与详情保持统一风格。业务内容、操作和数据来自 PRD，条件配方用于本项目已有内容。',
    `已确认约束：${text(plan.visualStyle?.constraints, '无额外约束')}。`, '',
    '### 配色与语义', '',
    `本项目主色为 ${text(color.primaryColorName, '')} ${color.primaryColor}；来源为 ${text(color.source, 'AI 推断')}。${text(color.usage, '用于主要品牌操作和少量焦点，独立数据色和平台状态色保持各自语义。')}`, '',
    mdTable(['语义', '变量', '最终取值'], Object.entries(colors).filter(([name]) => tokens[name]).map(([name, role]) => [role, name, tokens[name]])), '',
    renderPageApplications(plan, tokens), '',
    '### 素材与实现验收', '',
    ...(assets.pages || []).map(page => `- ${text(page.pageId)}：${text(page.imageNeed, 'none')}；${text(page.reason)}；素材槽位 ${(page.slots || []).map(slot => slot.slotId || slot.slotKey || slot.key || slot.name).filter(Boolean).join('、') || '无'}`),
    `素材缺口：${text(assets.missingAssets, '无')}。`,
    '- 验证页面任务、首屏焦点、布局和窄屏顺序与逐页方案一致；条件配方只出现在已注明的位置。',
    '- 验证表面层级、操作与文字对比、键盘焦点、空态和错误反馈；数据几何、单位和读数须与真实数据一致。',
  ].join('\n');
}

function componentReferences(body) {
  const match = /^## 3\. 基础组件表达\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(body);
  const components = {};
  const states = {};
  if (!match) {return { body, components, states };}
  const section = match[1];
  const start = match.index + match[0].indexOf(section);
  const headings = [...section.matchAll(/^### (.+)\n/gm)];
  const subsections = headings.map((heading, index) => ({ index: heading.index, title: heading[1],
    content: section.slice(heading.index + heading[0].length, headings[index + 1]?.index) }));
  const anchors = new Map();
  const locate = (anchor, target) => {
    const position = start + target.index;
    anchors.set(position, [...(anchors.get(position) || []), `<a id="${anchor}"></a>`]);
  };
  for (const [key, pattern] of Object.entries({ button: /按钮|主操作|次操作/, input: /输入|搜索|筛选控件/, card: /卡片|面板|容器/, table: /表格|表头|单元格/, chart: /图表|图形|曲线|柱形/ })) {
    const target = subsections.find(item => pattern.test(item.title)) || subsections.find(item => pattern.test(item.content));
    if (!target) {continue;}
    const anchor = `component-${key}`;
    components[key] = { anchor: `#${anchor}` };
    locate(anchor, target);
  }
  const stateSection = subsections.find(item => /^(?:\d+\.\d+ )?(?:组件状态|交互状态|交互与反馈状态|状态与)/.test(item.title))
    || subsections.find(item => /状态/.test(item.title));
  for (const [key, pattern] of Object.entries({ empty: /empty|空态|无数据|暂无/, loading: /loading|加载/, error: /error|错误|失败|异常/,
    disabled: /disabled|禁用/, focus: /focus|聚焦|焦点|键盘/, selected: /selected|选中/ })) {
    const target = stateSection && pattern.test(stateSection.content) ? stateSection : subsections.find(item => pattern.test(item.content));
    if (!target) {continue;}
    const anchor = `state-${key}`;
    states[key] = { anchor: `#${anchor}` };
    locate(anchor, target);
  }
  let output = body;
  for (const [position, tags] of [...anchors].sort((left, right) => right[0] - left[0])) {
    output = output.slice(0, position) + `${tags.join('\n')}\n` + output.slice(position);
  }
  return { body: output, components, states };
}

function overrideTokens(groups, overrides) {
  const remaining = new Set(Object.keys(overrides));
  function update(node) {
    for (const [key, value] of Object.entries(node || {})) {
      if (key.startsWith('--') && remaining.has(key)) {node[key] = overrides[key]; remaining.delete(key);}
      else if (value && typeof value === 'object' && !Array.isArray(value)) {update(value);}
    }
  }
  update(groups);
  for (const key of remaining) {
    const scope = /^(?:--pod-|--color-|--font-|--s-|--corner-|--shadow-)/.test(key) ? 'application-global' : 'custom-page';
    groups[scope] = groups[scope] || {};
    const target = scope === 'application-global' ? (groups[scope].appearance = groups[scope].appearance || {}) : groups[scope];
    target['project-overrides'] = target['project-overrides'] || {};
    target['project-overrides'][key] = overrides[key];
  }
}

function renderDesign(plan, options = {}) {
  const { theme, templatePath } = resolveTheme(plan);
  const meta = plan.meta || {};
  const { visual, forUser, selectedTheme: selected, visualDirection, navigationStyle } = visualSelections(plan);
  const color = forUser.colorStrategy || {};
  if (!['top', 'side'].includes(navigationStyle.structure)) {
    throw new CliError('visualStyle.forUser.navigationStyle.structure 必须是 top 或 side', { code: 'DESIGN_PLAN_INVALID_NAVIGATION_STRUCTURE' });
  }
  if (!['light', 'dark'].includes(navigationStyle.tone)) {
    throw new CliError('visualStyle.forUser.navigationStyle.tone 必须是 light 或 dark', { code: 'DESIGN_PLAN_INVALID_NAVIGATION_TONE' });
  }
  const primaryColor = normalizeHex(color.primaryColor);
  if (!primaryColor) {
    throw new CliError('visualStyle.forUser.colorStrategy.primaryColor 必须是 6 位 HEX 色值', {
      code: 'DESIGN_PLAN_INVALID_PRIMARY_COLOR', details: { primaryColor: color.primaryColor },
    });
  }
  // Parse template metadata before inserting user text; YAML quoting belongs to
  // the common serializer, not string interpolation inside template quotes.
  const source = resolveThemeColors(fs.readFileSync(templatePath, 'utf8').replace(/\{\{PRIMARY_COLOR\}\}/g, primaryColor));
  const parsed = parseDesignDocument(source);
  const themeTokens = readDesignTokens(source);
  const explicitTokens = visual.tokens || {};
  if (theme.mode === 'creative') {
    require('../app/application-style').validateCreativeDirection(visual.creativeDirection, explicitTokens);
  }
  if (typeof explicitTokens !== 'object' || Array.isArray(explicitTokens)) {
    throw new CliError('visualStyle.tokens 必须是 CSS token 对象', { code: 'DESIGN_PLAN_INVALID_TOKENS' });
  }
  if (theme.mode !== 'creative' && themeNavTheme(theme) !== navigationStyle.tone) {
    throw new CliError('navigationStyle.tone 必须由所选主题模板的 navTheme 派生', {
      code: 'DESIGN_PLAN_NAVIGATION_TONE_MISMATCH',
      details: { themeId: theme.themeId, expected: themeNavTheme(theme), actual: navigationStyle.tone },
    });
  }
  const overrides = { ...explicitTokens };
  for (const [token, value] of Object.entries(overrides)) {
    if (!/^--[\w-]+$/.test(token) || /^--color-brand/.test(token) || typeof value !== 'string') {
      throw new CliError(`无效视觉 token：${token}；品牌色由 primaryColor 推导`, { code: 'DESIGN_PLAN_INVALID_TOKENS' });
    }
  }
  overrideTokens(parsed.metadata.tokens, overrides);
  const tokens = { ...themeTokens, ...overrides };
  const name = text(meta.appName || meta.projectName, 'OpenYida 应用');
  const colorSource = color.source || forUser.styleSource || selected.source || 'AI 推断';
  const headings = [...parsed.body.matchAll(/^## ([1-5])\. [^\n]+\n/gm)];
  const chapters = headings.map((heading, index) => parsed.body.slice(heading.index, headings[index + 1]?.index).trim());
  if (chapters.length !== 5) {
    throw new CliError('主题缺少五章设计结构，请检查模板', { code: 'DESIGN_PLAN_THEME_CONTEXT_MISSING' });
  }
  const summaryTitle = new RegExp('(^## 1\\. 风格摘要\\n\\s*)\\*\\*([^\\n]+)\\*\\*[ \\t]*\\n(?:[ \\t]*\\n)?', 'm');
  chapters[0] = chapters[0].replace(summaryTitle,
    (line, heading, title) => title.includes(theme.label) || title.includes(theme.themeId) ? heading : line);
  chapters[0] += `\n\n${renderProjectFacts(plan, visualDirection, { ...color, primaryColor })}`;
  if (theme.mode === 'creative') {
    const decision = visual.creativeDirection;
    chapters[0] += `\n\n### 业务推演依据\n\n${decision.businessRationale}`;
    chapters[1] += `\n\n### 自主设计决策\n\n${decision.composition}\n\n${decision.typography}\n\n${decision.material}`;
    chapters[2] += `\n\n### 表单布局决策\n\n${decision.formLayout}`;
  }
  chapters[1] = chapters[1].replace(/^(### 2\.2 应用导航\n)([\s\S]*?)(?=^### |(?![\s\S]))/m,
    (_, heading, guidance) => {
      // The resolved project values replace the preset's color description;
      // keep its token consumption, interaction and acceptance guidance.
      const sharedGuidance = (theme.navigationSummary ? guidance.replace(theme.navigationSummary, '') : guidance)
        .replace(/^导航示例：[^\n]*\n?/gm, '')
        .replace(/当前模板使用 contentTone:\s*(?:light|dark)、navTheme:\s*(?:light|dark)。/g, '').trim();
      return `${heading}\n${renderNavigationDesign(plan, navigationStyle, tokens)}\n\n${sharedGuidance}\n\n`;
    });
  const themeGuidance = fs.readFileSync(THEME_CONSISTENCY_PATH, 'utf8');
  for (const section of ['指标卡与按钮配色', '分组标题与分割线']) {
    const guidance = themeGuidance.match(new RegExp(`(?:^|\\n)(## ${section}\\n[\\s\\S]*?)(?=\\n## |$)`))?.[1];
    if (!guidance) {
      throw new CliError(t('design_document.invalid', THEME_CONSISTENCY_PATH, '## ' + section), {
        code: 'DESIGN_PLAN_THEME_CONTEXT_MISSING', details: { section },
      });
    }
    chapters[1] += '\n\n' + guidance.trim().replace(/^## /, '### ');
  }
  chapters[2] += '\n\n### 图标与相邻底色\n\n图标前景和底盒分别取色，按上述配色规则检查对比度。颜色配对记录在 iconSystem.colorPairs，页面按同一变量实现，并检查颜色继承、描边和透明度。';
  if (plan.pages?.customPageDetails?.length) {
    chapters[1] += '\n\n' + fs.readFileSync(PAGE_CONTINUITY_PATH, 'utf8').trim().replace(/^(#{1,5}) /gm, '#$1 ');
  }
  chapters[4] = renderProjectApplications(plan, tokens, { ...color, primaryColor, source: colorSource }, chapters[4]);
  let body = `# ${name} design.md\n\n${chapters.join('\n\n')}\n`;
  body = body.replace(/\{\{PROJECT_NAME\}\}/g, () => name).replace(/\{\{COLOR_SOURCE\}\}/g, () => colorSource);
  const references = componentReferences(body);
  body = references.body;
  const scenes = {};
  for (const page of plan.pages?.customPageDetails || []) {
    const key = page.sceneKey || (options.draft ? sceneForPage(page) : pageHandoff(page, plan).scene);
    scenes[key] = scenes[key] || { pages: [] };
    scenes[key].pages.push({ pageId: page.pageId, anchor: `#${pageAnchor(page.pageId)}` });
  }
  const metadata = {
    schemaVersion: '1.0', name, description: parsed.metadata.description,
    ...(theme.collection === 'application-styles' ? { applicationStyle: { recipe: 'application-style-v1', mode: theme.mode } } : {}),
    ...(theme.mode === 'creative' ? { creativeDirection: visual.creativeDirection } : {}),
    buildPlanRevision: text(meta.revision, 'unversioned'), tokens: parsed.metadata.tokens,
    themeProfile: {
      name: visualDirection.label, themeColor: primaryColor, themeColorSource: colorSource,
      contentTone: resolveContentTone(theme, tokens), navTheme: navigationStyle.tone, themeDelivery: 'app-custom-theme-file',
      themeFile: path.join(options.outputDir || path.join('prd', meta.projectName || name), 'app-theme.css'),
      ...navigationConfig(plan), logoSource: 'appIcon',
    },
    sceneRecipes: scenes, components: references.components, states: references.states,
    assetStrategy: { pages: [], ...forUser.assetStrategy },
    iconSystem: forUser.iconSystem || { library: 'lucide-react', mappings: {} },
  };
  for (const page of options.draft ? [] : plan.pages?.customPageDetails || []) {
    for (const ref of pageHandoff(page, plan).designRefs) {
      requireFact(/^(themeProfile|sceneRecipes\.[\p{L}\p{N}_-]+|components\.[\w-]+|states\.[\w-]+)$/u.test(ref)
        && ref.split('.').reduce((value, key) => Object.prototype.hasOwnProperty.call(value || {}, key) ? value[key] : undefined, metadata),
      `页面 ${page.name} 的设计引用不存在：${ref}`);
    }
  }
  const output = serializeDesignDocument(metadata, body);
  const unresolved = output.match(/\{\{[^}]+\}\}|<[^>]*(?:实际色值|生成期标记)[^>]*>|"--[^"]+"\s*:\s*"AI 根据[^"]*生成[^"]*"/g);
  if (unresolved) {
    throw new CliError('design.md 仍包含未解析占位符或 Token 推导指令', {
      code: 'DESIGN_PLAN_UNRESOLVED_TEMPLATE', details: { unresolved: [...new Set(unresolved)] },
    });
  }
  return output;
}

function renderHtml(plan, sections) {
  for (const executable of ['python3', 'python']) {
    const result = spawnSync(executable, [HTML_RENDERER_PATH, '--input', '-', '--output', '-', ...(sections ? ['--sections', sections.join(',')] : [])], {
      encoding: 'utf8', input: JSON.stringify(plan), maxBuffer: 32 * 1024 * 1024,
      // Both ends of the JSON/HTML pipe must use UTF-8, including on Windows.
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    if (result.error?.code === 'ENOENT') {continue;}
    if (result.error || result.status !== 0) {
      throw new CliError((result.stderr || result.error?.message || 'build-plan.html 生成失败').trim(), {
        code: 'DESIGN_PLAN_VALIDATION_FAILED',
        details: { executable, status: result.status, stderr: result.stderr, error: result.error?.message },
      });
    }
    return result.stdout;
  }
  throw new CliError('生成 build-plan.html 需要可用的 Python 3 运行时', {
    code: 'DESIGN_PLAN_PYTHON_UNAVAILABLE',
  });
}

// Draft sections share the final PRD renderer; implementation details are filled at final validation.
function renderDraftPrd(plan) {
  const { navigationStyle } = visualSelections(plan);
  return renderPrd(plan, {
    appConfig: { ...navigationConfig(plan), navTheme: navigationStyle.tone },
    pageNavigation: [], sampleDataPlan: [],
    pages: (plan.pages?.customPageDetails || []).map(page => ({ pageSpecHandoff: page.pageSpecHandoff || {} })),
    interactionStates: {}, resourceBlueprint: [], resourceCreationOrder: [], pageImplementationOrder: [],
    navigationOrder: [], acceptanceCriteria: [],
  });
}

function prepareArtifacts(sourcePlan, outputDir, themeSeed, options = {}) {
  const timings = {};
  const measure = (name, action) => {
    const start = performance.now();
    try {return action();} finally {timings[name] = Math.round((performance.now() - start) * 100) / 100;}
  };
  const plan = measure('validationAndNormalizationMs', () => {
    const normalized = normalizePlan(sourcePlan);
    validateAuthoring(normalized);
    return normalized;
  });
  const designFile = path.resolve(outputDir, 'design.md');
  const execution = measure('businessValidationMs', () => buildExecution(plan, { designFile }));
  const assetStrategy = plan.visualStyle?.forUser?.assetStrategy;
  const assetTasks = measure('assetValidationMs', () => {
    if (assetStrategy !== undefined && (!assetStrategy || typeof assetStrategy !== 'object' || Array.isArray(assetStrategy))) {
      throw new CliError(t('asset.invalidStrategy'), { code: 'ASSET_DESIGN_INVALID', details: { field: 'visualStyle.forUser.assetStrategy' } });
    }
    const tasks = buildAssetTasks({ pages: [], ...assetStrategy }, outputDir);
    return plan.execution?.explicitScope?.allowInferredResources === false ? [] : tasks;
  });
  const prd = measure('prdMs', () => renderPrd(plan, execution));
  const design = measure('designMs', () => renderDesign(plan, { outputDir }));
  measure('designValidationMs', () => validateDesignDocument(design, { prdMarkdown: prd, designFile }));
  // Validate the same public CSS pipeline used by both Fast and Plan before writing artifacts.
  const baseTheme = measure('themeValidationMs', () => applyDesignTokens(fs.readFileSync(path.join(PACKAGE_ROOT, 'yida-skills/skills/yida-design/references/theme/app-custom-theme-template.css'), 'utf8'), design));
  const html = options.renderHtml === false ? undefined : measure('htmlMs', () => renderHtml({ ...plan, execution }));
  const outputs = {
    prd: path.join(outputDir, 'prd.md'),
    design: path.join(outputDir, 'design.md'),
    html: path.join(outputDir, 'build-plan.html'),
    theme: path.join(outputDir, 'app-theme.css'),
  };
  const existingCss = fs.existsSync(outputs.theme) ? fs.readFileSync(outputs.theme, 'utf8') : themeSeed?.css;
  const previousDesign = fs.existsSync(outputs.theme) && fs.existsSync(outputs.design) ? fs.readFileSync(outputs.design, 'utf8') : themeSeed?.design;
  const theme = measure('themeMs', () => existingCss !== undefined ? applyDesignTokens(existingCss, design, previousDesign) : baseTheme);
  return {
    revision: (plan.meta || {}).revision || null, outputs, timings, assetTasks,
    themeInput: { css: existingCss, design: previousDesign },
    files: [[outputs.prd, prd], [outputs.design, design], ...(html === undefined ? [] : [[outputs.html, html]]), [outputs.theme, theme]],
  };
}

function prepareArtifactUpdate(artifacts, outputDir, previousArtifacts) {
  const updates = prepareUpdates(artifacts, outputDir, previousArtifacts);
  const content = file => updates.files.find(([target]) => target === file)?.[1] ?? fs.readFileSync(file, 'utf8');
  const design = content(artifacts.outputs.design);
  const generated = file => artifacts.files.find(([target]) => target === file)?.[1];
  const prd = content(artifacts.outputs.prd);
  // Generated content was already validated; local merges must be checked again.
  if (design !== generated(artifacts.outputs.design) || prd !== generated(artifacts.outputs.prd)) {
    validateDesignDocument(design, { prdMarkdown: prd, designFile: path.resolve(artifacts.outputs.design) });
  }
  // CSS consumes the merged design, including preserved local additions.
  if (fs.existsSync(artifacts.outputs.theme)) {
    const current = fs.readFileSync(artifacts.outputs.theme, 'utf8');
    const previous = updates.previousDesign || (fs.existsSync(artifacts.outputs.design) ? fs.readFileSync(artifacts.outputs.design, 'utf8') : undefined);
    const sameInput = design === generated(artifacts.outputs.design)
      && current === artifacts.themeInput?.css && previous === artifacts.themeInput?.design;
    const css = sameInput ? generated(artifacts.outputs.theme) : applyDesignTokens(current, design, previous);
    updates.files = updates.files.filter(([file]) => file !== artifacts.outputs.theme);
    updates.updated = updates.updated.filter(file => file !== artifacts.outputs.theme);
    if (css !== current) {updates.files.push([artifacts.outputs.theme, css]); updates.updated.push(artifacts.outputs.theme);}
  }
  return updates;
}

function materializeUnlocked(inputPath, options = {}) {
  const start = performance.now();
  const input = path.resolve(inputPath);
  const outputDir = path.resolve(options.outputDir || path.dirname(input));
  const source = readJson(input);
  const readMs = performance.now() - start;
  const mergeStart = performance.now();
  const merging = options.businessFile !== undefined || options.visualFile !== undefined;
  if (options.rebaseParts && !merging) {
    throw new CliError('--rebase-parts requires --business-file and --visual-file', { code: 'DESIGN_PLAN_PARTS_REQUIRED' });
  }
  if (merging && (!options.businessFile || !options.visualFile)) {
    throw new CliError('--business-file 与 --visual-file 需同时提供', { code: 'DESIGN_PLAN_PARTS_REQUIRED' });
  }
  if (merging && new Set([input, path.resolve(options.businessFile), path.resolve(options.visualFile)]).size !== 3) {
    throw new CliError('计划与两个片段需使用三个独立文件', { code: 'DESIGN_PLAN_OUTPUT_CONFLICT' });
  }
  if (merging && options.fromPreview) { throw new CliError('选择一种规划来源', { code: 'DESIGN_PLAN_PART_CONFLICT' }); }
  const merged = options.fromPreview ? require('./preview').finalizePreview(source, path.join(path.dirname(input), 'preview/.state.json'))
    : merging ? mergeParts(source, options.businessFile, options.visualFile, { input, rebaseParts: options.rebaseParts }) : source;
  const updatesSource = merging || options.fromPreview;
  const mergeMs = performance.now() - mergeStart;
  const previewDir = path.join(path.dirname(input), 'preview');
  const previewState = path.join(previewDir, '.state.json');
  let themeSeed;
  const savedPreview = fs.existsSync(previewState) ? readJson(previewState) : null;
  if (savedPreview?.facts?.visualStyle && savedPreview.base?.digest === require('./parallel').planBase(source).digest
    && ['design.md', 'app-theme.css'].every(name => fs.existsSync(path.join(previewDir, name)))) {
    themeSeed = { design: fs.readFileSync(path.join(previewDir, 'design.md'), 'utf8'), css: fs.readFileSync(path.join(previewDir, 'app-theme.css'), 'utf8') };
  }
  const artifacts = prepareArtifacts(merged, outputDir, themeSeed);
  const updates = prepareArtifactUpdate(artifacts, outputDir);
  if (updates.files.some(([file]) => path.resolve(file) === input)) {
    throw new CliError('输出文件不能覆盖 build-plan.json', { code: 'DESIGN_PLAN_OUTPUT_CONFLICT' });
  }
  const writeStart = performance.now();
  if (merging && updates.files.some(([file]) => [options.businessFile, options.visualFile].some(part => path.resolve(part) === path.resolve(file)))) {
    throw new CliError('输出路径与规划片段冲突', { code: 'DESIGN_PLAN_OUTPUT_CONFLICT' });
  }
  if (!options.check) {
    writeFiles(updatesSource ? [[input, `${JSON.stringify(merged, null, 2)}\n`], ...updates.files] : updates.files);
  }
  const timings = { readMs, ...(merging ? { mergeMs } : {}), ...artifacts.timings, writeMs: performance.now() - writeStart, totalMs: performance.now() - start };
  for (const key of Object.keys(timings)) {timings[key] = Math.round(timings[key] * 100) / 100;}
  return { success: true, checked: options.check === true, input, outputDir, revision: artifacts.revision, outputs: artifacts.outputs, updated: options.check ? [] : updates.updated, assetTasks: artifacts.assetTasks, timings,
    ...(!options.check ? { confirmation: require('./confirmation').confirmationPayload(artifacts.outputs, artifacts.revision) } : {}),
    ...(updatesSource ? { merged: true, previousRevision: source.meta.revision } : {}) };
}

function materialize(inputPath, options = {}) {
  if (!options.fromPreview) { return materializeUnlocked(inputPath, options); }
  const dir = path.join(path.dirname(path.resolve(inputPath)), 'preview');
  fs.mkdirSync(dir, { recursive: true });
  const lock = path.join(dir, '.write.lock');
  const fd = fs.openSync(lock, 'wx');
  try { return materializeUnlocked(inputPath, options); }
  finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}

module.exports = {
  prepareArtifacts,
  prepareArtifactUpdate,
  renderDraftPrd,
  renderHtml,
  materialize,
  normalizePlan,
  renderDesign: (plan, options) => renderDesign(normalizePlan(plan), options),
  renderPrd: source => {
    const plan = normalizePlan(source);
    renderDesign(plan);
    return renderPrd(plan);
  },
};
