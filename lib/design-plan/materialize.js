'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { CliError } = require('../core/cli-error');
const { normalizePlan, assertThemeProfile } = require('./normalize');
const { readJson, writeFiles } = require('./files');
const { validateAuthoring } = require('./validate');
const { mergeParts } = require('./parallel');
const { performance } = require('perf_hooks');
const { readDesignTokens, applyDesignTokens } = require('../app/theme-from-design');

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const PLAN_SKILL_ROOT = path.join(
  PACKAGE_ROOT,
  'yida-skills',
  'skills',
  'yida-design',
  'sub_skill',
  'yida-design-plan'
);
const THEME_DIR = path.join(PLAN_SKILL_ROOT, 'templates', 'design-themes');
const THEME_INDEX_PATH = path.join(THEME_DIR, 'index.json');
const HTML_RENDERER_PATH = path.join(PLAN_SKILL_ROOT, 'scripts', 'render_build_plan.py');

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
  const navigationStyle = forUser.navigationStyle || {
    structure: 'side',
    tone: 'light',
    source: 'legacy_default',
    selectionReason: '兼容旧版搭建计划；新计划必须显式记录导航选择。',
  };
  return { visual, forUser, selectedTheme, visualDirection, navigationStyle };
}

function navigationToneLabel(value) {
  return value === 'dark' ? '深色' : '浅色';
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
  const allowed = [...arrays, 'navigationFallback', 'interactionStates', 'explicitScope', 'appConfig'];
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

function pageHandoff(page, plan) {
  const supplied = page.pageSpecHandoff === undefined ? {} : page.pageSpecHandoff;
  requireFact(object(supplied), `页面 ${page.name} 的 pageSpecHandoff 必须是对象`);
  const handoffKeys = ['scene', 'pageStructure', 'entryMode', 'contentBlocks', 'dataSources', 'dataBinding', 'emptyReason', 'primaryAction', 'themeSummary', 'designFile', 'designRefs'];
  requireFact(Object.keys(supplied).every(key => handoffKeys.includes(key)), `页面 ${page.name} 的 pageSpecHandoff 包含未知字段`);
  const patternScenes = {
    'data-insight': 'dashboard', 'catalog-browse': 'list', 'brand-landing': 'landing',
    'progress-narrative': 'detail', 'split-pane-ops': 'detail',
  };
  const scene = supplied.scene || page.scene || patternScenes[(page.layoutPattern || {}).id] || 'workbench';
  const structures = {
    workbench: 'workbench', dashboard: 'dashboard-overview', list: 'business-list',
    detail: 'detail-profile', landing: 'official-homepage', screen: 'data-screen',
  };
  const customNavigation = navigationConfig(plan).navigationType === 'custom';
  const entryMode = supplied.entryMode || page.entryMode || (customNavigation ? 'standalone' : 'platform-shell');
  requireFact(!customNavigation || entryMode === 'standalone', `自定义导航的页面 ${page.name} 必须使用 standalone 入口`);
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
  requireFact(nonEmptyList(supplied.contentBlocks || page.blocks), `页面 ${page.name} 缺少内容区块`);
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

function buildExecution(plan) {
  const pages = (plan.pages || {}).customPageDetails || [];
  const models = plan.dataModels || [];
  const { navigationStyle } = visualSelections(plan);
  const execution = plan.execution === undefined ? {} : plan.execution;
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
    formEntry: 'PC 使用 50vw 抽屉承载原生表单，移动端整页打开；提交后刷新数据',
    detail: '使用真实 formInstId 打开详情；缺少 ID 时禁用入口',
  };
  const resources = [
    ...models.map(model => ({ name: model.name, type: String(model.formType).includes('流程') ? 'process-form' : 'normal-form', purpose: model.description })),
    ...pages.map(page => ({ name: page.name, type: 'display-page', pageId: page.pageId, purpose: page.primaryTask })),
  ];
  const handoff = {
    resourceBlueprint: resources,
    resourceCreationOrder: ['应用与主题配置', ...models.map(model => model.name), '初始示例数据', ...pages.map(page => page.name), '发布与导航排序'],
    pageImplementationOrder: pages.map(page => page.pageId || page.name),
    navigationOrder: [],
    navigationFallback: '发布时使用 --auto-nav-order，不再重复执行排序',
    acceptanceCriteria: [
      ...models.map(model => `${model.name}的字段、必填规则与关系符合数据模型`),
      ...(plan.businessFlows || []).map(flow => `${flow.name}按触发条件和业务规则执行`),
      ...pages.map(page => `${page.name}支持${page.primaryTask || page.positioning}`),
      '应用主题按 design.md 配置，页面消费同一组 token',
      '核心普通表单示例数据写入并抽查，或说明跳过原因',
    ],
    ...execution,
    interactionStates: { ...interactionStates, ...execution.interactionStates },
    sampleDataPlan: sampleDataPlan(models, execution.sampleDataPlan === undefined ? undefined : JSON.parse(JSON.stringify(execution.sampleDataPlan))),
    appConfig: { appType: '待创建后回填', corpId: '待登录态确认', baseUrl: '待目标环境确认', ...execution.appConfig, ...visualConfig, ...navigation },
    pages: pages.map(page => ({ pageId: page.pageId, name: page.name, pageSpecHandoff: pageHandoff(page, plan) })),
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
  handoff.pageNavigation = [...resources, ...handoff.resourceBlueprint.filter(resource => resource.type === 'report')]
    .filter(resource => navigation.navigationType === 'custom' || handoff.pages.some(page => page.name === resource.name && page.pageSpecHandoff.entryMode === 'standalone'))
    .map(resource => ({ name: resource.name, type: resource.type, isRenderNav: false }));
  requireFact(handoff.resourceCreationOrder.every(nonEmpty) && resources.every(resource => handoff.resourceCreationOrder.includes(resource.name)), '资源创建顺序遗漏业务表单或页面');
  requireFact(handoff.pageImplementationOrder.every(nonEmpty) && pages.every(page => handoff.pageImplementationOrder.includes(page.pageId) || handoff.pageImplementationOrder.includes(page.name)), '页面实现顺序遗漏页面');
  requireFact(handoff.acceptanceCriteria.every(nonEmpty), '验收标准必须为非空业务描述');
  return handoff;
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

function mixHex(hex, target, targetRatio) {
  const source = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  const mixed = source.map((channel, index) => Math.round(channel * (1 - targetRatio) + target[index] * targetRatio));
  return `#${mixed.map(channel => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function mixTwoHex(left, right, rightRatio) {
  const target = [1, 3, 5].map(index => parseInt(right.slice(index, index + 2), 16));
  return mixHex(left, target, rightRatio);
}

function hexToRgba(hex, alpha) {
  const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  return `rgba(${channels.join(', ')}, ${alpha})`;
}

function replaceTokenValue(source, token, value) {
  const tokenPattern = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return source.replace(new RegExp(`("${tokenPattern}"\\s*:\\s*)"[^"]*"`), `$1"${value}"`);
}

function deriveBrandColors(primaryColor, themeId) {
  if (themeId === 'dark-luminous-modular') {
    return {
      '--color-brand1-1': mixHex(primaryColor, [255, 255, 255], 0.10),
      '--color-brand1-2': mixTwoHex(primaryColor, '#181818', 0.76),
      '--color-brand1-3': mixTwoHex(primaryColor, '#101010', 0.90),
      '--color-brand1-5': mixHex(primaryColor, [0, 0, 0], 0.18),
      '--color-brand1-9': mixHex(primaryColor, [0, 0, 0], 0.10),
      '--color-brand1-10': mixTwoHex(primaryColor, '#181818', 0.58),
    };
  }
  const defaults = {
    brand1: 0.12,
    brand2: 0.88,
    brand3: 0.94,
    brand5: 0.18,
    brand9: 0.12,
    brand10: 0.62,
  };
  const profiles = {
    'airy-media-grid': { brand1: 0.14, brand3: 0.95, brand5: 0.16, brand9: 0.10, brand10: 0.64 },
    'ambient-halo-layered': { brand1: 0.14, brand9: 0.10, brand10: 0.64 },
    'hairline-runway-clarity': { brand1: 0.90, brand2: 0.82, brand3: 0.74, brand10: 0.70 },
    'media-rail-inspector': { brand1: 0.90, brand2: 0.82, brand3: 0.74, brand10: 0.68 },
    'mist-layered-signal': { brand1: 0.14, brand5: 0.16, brand9: 0.10, brand10: 0.64 },
    'modular-rail-signal': { brand1: 0.14, brand9: 0.10, brand10: 0.64 },
    'mono-grid-signal': { brand1: 0.90, brand2: 0.82, brand3: 0.74, brand10: 0.68 },
    'ribbon-ledger-lift': { brand1: 0.90, brand2: 0.82, brand3: 0.74, brand5: 0.16, brand10: 0.68 },
    'segmented-meter-clarity': { brand1: 0.90, brand2: 0.82, brand3: 0.74, brand10: 0.66 },
    'status-framed-media-grid': { brand1: 0.08, brand9: 0.10, brand10: 0.72 },
  };
  const profile = { ...defaults, ...(profiles[themeId] || {}) };
  return {
    '--color-brand1-1': mixHex(primaryColor, [255, 255, 255], profile.brand1),
    '--color-brand1-2': mixHex(primaryColor, [255, 255, 255], profile.brand2),
    '--color-brand1-3': mixHex(primaryColor, [255, 255, 255], profile.brand3),
    '--color-brand1-5': mixHex(primaryColor, [0, 0, 0], profile.brand5),
    '--color-brand1-9': mixHex(primaryColor, [0, 0, 0], profile.brand9),
    '--color-brand1-10': mixHex(primaryColor, [255, 255, 255], profile.brand10),
  };
}

function deriveThemeColors(primaryColor, themeId) {
  const themes = {
    'high-contrast-modular': {
      '--oyd-page-background': mixTwoHex(primaryColor, '#F5F5F5', 0.97),
      '--oyd-surface-soft': mixTwoHex(primaryColor, '#F1F1F1', 0.95),
      '--oyd-accent-deep': mixTwoHex(primaryColor, '#202020', 0.55),
    },
    'interlocked-vivid-modules': {
      '--oyd-page-background': mixTwoHex(primaryColor, '#F7F7F7', 0.98),
    },
    'media-rail-inspector': {
      '--oyd-media-surface': mixTwoHex(primaryColor, '#F7F7F7', 0.96),
      '--oyd-tag-surface': mixTwoHex(primaryColor, '#F2F2F2', 0.92),
      '--oyd-action-deep': mixTwoHex(primaryColor, '#151515', 0.86),
    },
    'mono-grid-signal': {
      '--oyd-pattern-surface': mixTwoHex(primaryColor, '#F3F3F3', 0.92),
    },
    'status-framed-media-grid': {
      '--oyd-brand-focus-soft': mixTwoHex(primaryColor, '#FFFFFF', 0.92),
    },
    'dark-luminous-modular': {
      '--oyd-brand-glow-soft': hexToRgba(primaryColor, 0.18),
      '--oyd-brand-chart-strong': mixHex(primaryColor, [255, 255, 255], 0.06),
      '--oyd-brand-chart-muted': hexToRgba(primaryColor, 0.46),
      '--oyd-brand-chart-area': hexToRgba(primaryColor, 0.14),
    },
  };
  return themes[themeId] || {};
}

function resolveTheme(plan) {
  const { selectedTheme: selected } = visualSelections(plan);
  const index = readJson(THEME_INDEX_PATH, '主题索引');
  const theme = (index.themes || []).find(item => item.themeId === selected.themeId);
  if (!theme || theme.templatePath !== selected.templatePath) {
    throw new CliError('selectedTheme 的 themeId 与 templatePath 不属于主题索引中的同一记录', {
      code: 'DESIGN_PLAN_THEME_MISMATCH',
      details: { selectedTheme: selected },
    });
  }
  assertThemeProfile(plan.visualStyle?.forUser?.themeProfile, theme);
  const templatePath = path.resolve(PLAN_SKILL_ROOT, selected.templatePath);
  if (!templatePath.startsWith(`${THEME_DIR}${path.sep}`) || !fs.existsSync(templatePath)) {
    throw new CliError(`主题模板不可读：${selected.templatePath}`, {
      code: 'DESIGN_PLAN_THEME_UNREADABLE',
    });
  }
  return { theme, templatePath };
}

function renderProjectVisualSection(visualDirection, color, navigationStyle, navigation) {
  const navigationToken = navigationStyle.tone === 'dark'
    ? '--color-brand1-5'
    : '--color-brand1-3';
  return [
    '## 项目视觉选择',
    '',
    `- 视觉方向：${text(visualDirection.label)}`,
    `- 方向说明：${text(visualDirection.description)}`,
    `- 主题色：${text(color.primaryColorName)} \`${text(color.primaryColor)}\``,
    `- 导航类型：${NAVIGATION_TYPES[navigation.navigationType].label}`,
    `- 导航明暗：${navigationToneLabel(navigationStyle.tone)}`,
    `- 导航背景：\`${navigationToken}\``,
    `- 选择依据：${text(navigationStyle.selectionReason || visualDirection.description)}`,
  ].join('\n');
}

function injectAfterFrontmatter(source, content) {
  const frontmatter = /^---\n[\s\S]*?\n---\n/;
  if (!frontmatter.test(source)) {
    return `${content}\n\n${source}`;
  }
  return source.replace(frontmatter, match => `${match}\n${content}\n\n`);
}

function renderPagePatterns(pages) {
  return (pages.customPageDetails || []).map(page => {
    const pattern = page.layoutPattern || {};
    const richness = page.contentRichness || {};
    return [
      `#### ${text(page.name)}`,
      '',
      `- 模式：${text(pattern.mode)} / ${text(pattern.id)}`,
      `- 选择原因：${text(pattern.reason)}`,
      `- 调整项：${text(pattern.adaptations)}`,
      `- 必须保留：${text(pattern.mustKeep)}`,
      `- 信息密度：${text(page.density)}`,
      `- 内容覆盖：${text(richness.contentLayers)}`,
    ].join('\n');
  }).join('\n\n') || '- 无自定义页面';
}

function renderPageApplications(applications) {
  return (applications || []).map(application => {
    const memories = (application.visualMemoryApplications || []).map(memory =>
      `  - ${text(memory.name)}：${text(memory.target)}（${text(memory.renderPolicy)}；${text(memory.reason)}）`
    );
    return [
      `#### ${text(application.pageName || application.pageId)}`,
      '',
      `- 视觉应用：${text(application.visualApplication)}`,
      `- 表面：${text(application.surface)}`,
      `- 主操作：${text(application.primaryAction)}`,
      `- 状态：${text(application.states)}`,
      '- 视觉记忆点：',
      ...(memories.length > 0 ? memories : ['  - 无匹配内容，不虚构视觉组件']),
    ].join('\n');
  }).join('\n\n') || '- 无自定义页面';
}

function assetSummary(assetStrategy) {
  const strategy = assetStrategy || {};
  const values = [];
  for (const [key, value] of Object.entries(strategy)) {
    if (key === 'missingAssets' || key === 'notes' || value === undefined || value === null || value === '') {
      continue;
    }
    values.push(`${key}: ${text(value)}`);
  }
  return values.join('；') || '无现成品牌素材';
}

function componentReferences(markdown) {
  const sections = [...markdown.matchAll(/^### (.+)\n([\s\S]*?)(?=^#{1,3} |$(?![\s\S]))/gm)];
  const patterns = { button: /按钮/, input: /输入/, card: /卡片/, table: /表格/, chart: /图表/ };
  const components = {};
  for (const [key, pattern] of Object.entries(patterns)) {
    const section = sections.find(match => pattern.test(match[1]));
    if (section) {components[key] = { rules: section[2].trim() };}
  }
  const states = {};
  const section = sections.find(match => /状态与交互/.test(match[1]));
  if (section) {
    for (const key of ['empty', 'loading', 'error', 'disabled', 'focus', 'selected']) {
      states[key] = { rules: section[2].trim() };
    }
  }
  return { components, states };
}

function renderDesign(plan) {
  const { templatePath } = resolveTheme(plan);
  const template = fs.readFileSync(templatePath, 'utf8');
  const meta = plan.meta || {};
  const { visual, forUser, selectedTheme: selected, visualDirection, navigationStyle } = visualSelections(plan);
  const forDesignMd = visual.forDesignMd || {};
  const color = forUser.colorStrategy || {};
  if (!['top', 'side'].includes(navigationStyle.structure)) {
    throw new CliError('visualStyle.forUser.navigationStyle.structure 必须是 top 或 side', {
      code: 'DESIGN_PLAN_INVALID_NAVIGATION_STRUCTURE',
    });
  }
  if (!['light', 'dark'].includes(navigationStyle.tone)) {
    throw new CliError('visualStyle.forUser.navigationStyle.tone 必须是 light 或 dark', {
      code: 'DESIGN_PLAN_INVALID_NAVIGATION_TONE',
    });
  }
  const primaryColor = normalizeHex(color.primaryColor);
  if (!primaryColor) {
    throw new CliError('visualStyle.forUser.colorStrategy.primaryColor 必须是 6 位 HEX 色值', {
      code: 'DESIGN_PLAN_INVALID_PRIMARY_COLOR',
      details: { primaryColor: color.primaryColor },
    });
  }
  const replacements = {
    PROJECT_NAME: text(meta.appName || meta.projectName, 'OpenYida 应用'),
    BUSINESS_DOMAIN: text(meta.businessDomain),
    EXPERIENCE_TOPOLOGY: text(meta.experienceTopology),
    THEME_SOURCE: text(forUser.styleSource || selected.source),
    PRIMARY_COLOR: primaryColor,
    COLOR_SOURCE: text(color.source),
    PROJECT_CONSTRAINTS: text(visual.constraints, '无额外约束'),
    PRODUCT_TOPOLOGY_APPLICATION: text(forDesignMd.productTopologyApplication),
    PAGE_PATTERN_SUMMARY: renderPagePatterns(plan.pages || {}),
    PAGE_APPLICATIONS: renderPageApplications(forUser.pageApplications),
    BRAND_ASSETS: assetSummary(forUser.assetStrategy),
    ASSET_GAPS: text((forUser.assetStrategy || {}).missingAssets, '无'),
  };
  let output = template.replace(/\{\{([A-Z_]+)\}\}/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(replacements, key)) {
      return match;
    }
    return replacements[key];
  });
  output = output.replace(/^themeId:\s*[^\n]+\n?/m, '');
  if (!/^buildPlanRevision:/m.test(output)) {
    output = output.replace(
      /^---\n/,
      `---\nbuildPlanRevision: "${text(meta.revision, 'unversioned')}"\n`
    );
  }
  output = injectAfterFrontmatter(
    output,
    renderProjectVisualSection(visualDirection, color, navigationStyle, navigationConfig(plan))
  );
  const derived = {
    ...deriveBrandColors(primaryColor, selected.themeId),
    '--oyd-stage-bottom': mixTwoHex(primaryColor, '#121212', 0.72),
    '--oyd-heat-1': mixHex(primaryColor, [255, 255, 255], 0.92),
    '--oyd-heat-2': mixHex(primaryColor, [255, 255, 255], 0.80),
    '--oyd-heat-3': mixHex(primaryColor, [255, 255, 255], 0.62),
    '--oyd-heat-4': mixHex(primaryColor, [255, 255, 255], 0.32),
    '--oyd-heat-5': primaryColor,
    '--oyd-chart-stripe': mixHex(primaryColor, [0, 0, 0], 0.08),
    '--oyd-chart-pale': mixHex(primaryColor, [255, 255, 255], 0.84),
    ...deriveThemeColors(primaryColor, selected.themeId),
  };
  for (const [token, value] of Object.entries(derived)) {
    output = replaceTokenValue(output, token, value);
  }
  const overrides = visual.tokens || {};
  if (typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw new CliError('visualStyle.tokens 必须是 CSS token 对象', { code: 'DESIGN_PLAN_INVALID_TOKENS' });
  }
  const tokens = readDesignTokens(output);
  for (const [token, value] of Object.entries(overrides)) {
    if (!/^--[\w-]+$/.test(token) || /^--color-brand/.test(token) || typeof value !== 'string') {
      throw new CliError(`无效视觉 token：${token}；品牌色由 primaryColor 推导`, { code: 'DESIGN_PLAN_INVALID_TOKENS' });
    }
    tokens[token] = value;
  }
  // Preserve template grouping; only project token values and missing declarations change.
  output = output.replace(/^tokens:\s*\n[\s\S]*?(?=^[^\s#]|$(?![\s\S]))/m, block => {
    const existing = new Set();
    const updated = block.replace(/^(\s*)["']?(--[\w-]+)["']?\s*:[^\n]*$/gm, (line, indent, name) => {
      existing.add(name);
      return name in overrides ? `${indent}${JSON.stringify(name)}: ${JSON.stringify(tokens[name])}` : line;
    });
    const extra = Object.entries(overrides).filter(([name]) => !existing.has(name));
    return updated + extra.map(([name, value]) => `  ${JSON.stringify(name)}: ${JSON.stringify(value)}\n`).join('');
  });
  const scenes = {};
  for (const page of plan.pages?.customPageDetails || []) {
    const handoff = pageHandoff(page, plan);
    const key = page.sceneKey || handoff.scene;
    scenes[key] = scenes[key] || { scene: handoff.scene, inherits: 'themeProfile', pages: [] };
    scenes[key].pages.push({
      pageId: page.pageId, density: page.density, layoutPattern: page.layoutPattern,
      visualApplication: (forUser.pageApplications || []).find(item => item.pageId === page.pageId) || {},
    });
  }
  const references = { themeProfile: {}, sceneRecipes: scenes, ...componentReferences(output) };
  for (const page of plan.pages?.customPageDetails || []) {
    for (const ref of pageHandoff(page, plan).designRefs) {
      requireFact(/^(themeProfile|sceneRecipes\.[\p{L}\p{N}_-]+|components\.[\w-]+|states\.[\w-]+)$/u.test(ref)
        && ref.split('.').reduce((value, key) => Object.prototype.hasOwnProperty.call(value || {}, key) ? value[key] : undefined, references),
      `页面 ${page.name} 的设计引用不存在：${ref}`);
    }
  }
  output = output.replace(/^---\n/, () => [
    '---',
    `themeProfile: ${JSON.stringify({ themeColor: primaryColor, navTheme: navigationStyle.tone, ...navigationConfig(plan), logoSource: 'appIcon', themeDelivery: 'app-custom-theme-file' })}`,
    `sceneRecipes: ${JSON.stringify(scenes)}`,
    `components: ${JSON.stringify(references.components)}`,
    `states: ${JSON.stringify(references.states)}`, '',
  ].join('\n'));
  const unresolved = output.match(
    /\{\{[^}]+\}\}|<[^>]*(?:实际色值|生成期标记)[^>]*>|"--[^"]+"\s*:\s*"AI 根据[^"]*生成[^"]*"/g
  );
  if (unresolved) {
    throw new CliError('design.md 仍包含未解析占位符或 Token 推导指令', {
      code: 'DESIGN_PLAN_UNRESOLVED_TEMPLATE',
      details: { unresolved: [...new Set(unresolved)] },
    });
  }
  return output;
}

function renderHtml(plan, sections) {
  for (const executable of ['python3', 'python']) {
    const result = spawnSync(executable, [HTML_RENDERER_PATH, '--input', '-', '--output', '-', ...(sections ? ['--sections', sections.join(',')] : [])], {
      encoding: 'utf8', input: JSON.stringify(plan), maxBuffer: 32 * 1024 * 1024,
    });
    if (result.error?.code === 'ENOENT') {continue;}
    if (result.error || result.status !== 0) {
      throw new CliError((result.stderr || result.error?.message || 'build-plan.html 生成失败').trim(), {
        code: 'DESIGN_PLAN_VALIDATION_FAILED',
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
  return renderPrd(plan, {
    appConfig: { ...navigationConfig(plan), navTheme: plan.visualStyle?.forUser?.navigationStyle?.tone },
    pageNavigation: [], sampleDataPlan: [],
    pages: (plan.pages?.customPageDetails || []).map(page => ({ pageSpecHandoff: page.pageSpecHandoff || {} })),
    interactionStates: {}, resourceBlueprint: [], resourceCreationOrder: [], pageImplementationOrder: [],
    navigationOrder: [], acceptanceCriteria: [],
  });
}

function prepareArtifacts(sourcePlan, outputDir, themeSeed) {
  const timings = {};
  let authoringIssues = [];
  const measure = (name, action) => {
    const start = performance.now();
    try {return action();} catch (error) {
      if (authoringIssues.length && !error.details?.issues) {
        error.details = { ...error.details, issues: authoringIssues };
      }
      throw error;
    } finally {timings[name] = Math.round((performance.now() - start) * 100) / 100;}
  };
  const plan = measure('validationAndNormalizationMs', () => {
    authoringIssues = validateAuthoring(sourcePlan);
    return normalizePlan(sourcePlan);
  });
  const execution = measure('businessValidationMs', () => buildExecution(plan));
  const prd = measure('prdMs', () => renderPrd(plan, execution));
  const design = measure('designMs', () => renderDesign(plan));
  // Validate the same public CSS pipeline used by both Fast and Plan before writing artifacts.
  measure('themeValidationMs', () => applyDesignTokens(fs.readFileSync(path.join(PACKAGE_ROOT, 'yida-skills/skills/yida-design/references/theme/app-custom-theme-template.css'), 'utf8'), design));
  const html = measure('htmlMs', () => renderHtml({ ...plan, execution }));
  const outputs = {
    prd: path.join(outputDir, 'prd.md'),
    design: path.join(outputDir, 'design.md'),
    html: path.join(outputDir, 'build-plan.html'),
    theme: path.join(outputDir, 'app-theme.css'),
  };
  const existingCss = fs.existsSync(outputs.theme) ? fs.readFileSync(outputs.theme, 'utf8') : themeSeed?.css;
  const previousDesign = fs.existsSync(outputs.theme) && fs.existsSync(outputs.design) ? fs.readFileSync(outputs.design, 'utf8') : themeSeed?.design;
  const theme = measure('themeMs', () => applyDesignTokens(existingCss || fs.readFileSync(path.join(PACKAGE_ROOT,
    'yida-skills/skills/yida-design/references/theme/app-custom-theme-template.css'), 'utf8'), design, previousDesign));
  return {
    revision: (plan.meta || {}).revision || null, outputs, timings,
    files: [[outputs.prd, prd], [outputs.design, design], [outputs.html, html], [outputs.theme, theme]],
  };
}

function materializeUnlocked(inputPath, options = {}) {
  const start = performance.now();
  const input = path.resolve(inputPath);
  const outputDir = path.resolve(options.outputDir || path.dirname(input));
  const source = readJson(input);
  const readMs = performance.now() - start;
  const mergeStart = performance.now();
  const merging = options.businessFile !== undefined || options.visualFile !== undefined;
  if (merging && (!options.businessFile || !options.visualFile)) {
    throw new CliError('--business-file 与 --visual-file 需同时提供', { code: 'DESIGN_PLAN_PARTS_REQUIRED' });
  }
  if (merging && new Set([input, path.resolve(options.businessFile), path.resolve(options.visualFile)]).size !== 3) {
    throw new CliError('计划与两个片段需使用三个独立文件', { code: 'DESIGN_PLAN_OUTPUT_CONFLICT' });
  }
  if (merging && options.fromPreview) { throw new CliError('选择一种规划来源', { code: 'DESIGN_PLAN_PART_CONFLICT' }); }
  const merged = options.fromPreview ? require('./preview').finalizePreview(source, path.join(path.dirname(input), 'preview/.state.json'))
    : merging ? mergeParts(source, options.businessFile, options.visualFile) : source;
  const updatesSource = merging || options.fromPreview;
  const mergeMs = performance.now() - mergeStart;
  const previewDir = path.join(path.dirname(input), 'preview');
  const previewState = path.join(previewDir, '.state.json');
  let themeSeed;
  if (fs.existsSync(previewState) && readJson(previewState).facts?.visualStyle && readJson(previewState).base?.digest === require('./parallel').planBase(source).digest
    && ['design.md', 'app-theme.css'].every(name => fs.existsSync(path.join(previewDir, name)))) {
    themeSeed = { design: fs.readFileSync(path.join(previewDir, 'design.md'), 'utf8'), css: fs.readFileSync(path.join(previewDir, 'app-theme.css'), 'utf8') };
  }
  const artifacts = prepareArtifacts(merged, outputDir, themeSeed);
  if (artifacts.files.some(([file]) => path.resolve(file) === input)) {
    throw new CliError('输出文件不能覆盖 build-plan.json', { code: 'DESIGN_PLAN_OUTPUT_CONFLICT' });
  }
  const writeStart = performance.now();
  if (merging && artifacts.files.some(([file]) => [options.businessFile, options.visualFile].some(part => path.resolve(part) === path.resolve(file)))) {
    throw new CliError('输出路径与规划片段冲突', { code: 'DESIGN_PLAN_OUTPUT_CONFLICT' });
  }
  if (!options.check) {
    writeFiles(updatesSource ? [[input, `${JSON.stringify(merged, null, 2)}\n`], ...artifacts.files] : artifacts.files);
  }
  const timings = { readMs, ...(merging ? { mergeMs } : {}), ...artifacts.timings, writeMs: performance.now() - writeStart, totalMs: performance.now() - start };
  for (const key of Object.keys(timings)) {timings[key] = Math.round(timings[key] * 100) / 100;}
  return { success: true, checked: options.check === true, input, outputDir, revision: artifacts.revision, outputs: artifacts.outputs, timings, ...(updatesSource ? { merged: true, previousRevision: source.meta.revision } : {}) };
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
  renderDraftPrd,
  renderHtml,
  materialize,
  normalizePlan,
  renderDesign: plan => renderDesign(normalizePlan(plan)),
  renderPrd: source => {
    const plan = normalizePlan(source);
    renderDesign(plan);
    return renderPrd(plan);
  },
};
