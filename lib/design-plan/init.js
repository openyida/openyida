'use strict';

const fs = require('fs');
const path = require('path');
const { getVisualDecisionPolicy } = require('./visual-policy');
const { CliError } = require('../core/cli-error');
const { readJson, writeFiles } = require('./files');
const { planBase } = require('./parallel');
const { collectIssues } = require('./validate');
const { assertVisualFieldObjects } = require('./normalize');

const { PLAN_SKILL_ROOT: ROOT, loadThemeIndex, themeTemplatePath, themeNavTheme } = require('./themes');

function list(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeColorStrategy(value) {
  if (value === undefined || value === null) {return {};}
  if (typeof value === 'string') {return { usage: value };}
  if (typeof value === 'object' && !Array.isArray(value)) {return value;}
  throw new CliError('visualSelection.colorStrategy 应为配色对象或文字说明', {
    code: 'DESIGN_PLAN_INVALID_COLOR_STRATEGY',
    details: { field: 'visualSelection.colorStrategy', expected: 'object|string' },
  });
}

function quoteArgument(value) {
  const escaped = process.platform === 'win32' ? value.replace(/'/g, "''") : value.replace(/'/g, '\'"\'"\'');
  return `'${escaped}'`;
}

function customScene(scene) {
  return !['form', 'process-form', 'report'].includes(scene?.kind);
}

function resourceOnlyScope(brief) {
  if (brief.explicitScope?.allowInferredResources === false) {return true;}
  const scopedForms = list(brief.explicitScope?.forms);
  const confirmedCustomPages = list(brief.pageScenes).filter(customScene);
  return scopedForms.length > 0 && confirmedCustomPages.length === 0;
}

function scopeEntryMatchesScene(entry, scene) {
  const candidate = typeof entry === 'string' ? entry : entry?.key || entry?.name;
  return candidate && [scene?.key, scene?.name].includes(candidate);
}

function loadCatalog() {
  return {
    themes: loadThemeIndex().themes,
    pagePatterns: readJson(path.join(ROOT, 'templates/page-patterns/index.json')).patterns,
  };
}

function catalog() {
  const { themes, pagePatterns } = loadCatalog();
  return {
    success: true,
    themes: themes.filter(theme => theme.mode !== 'creative').map(theme => ({ ...theme })),
    creativeOption: themes.find(theme => theme.mode === 'creative'),
    pagePatterns: pagePatterns.map(({ id, label, mustKeep }) => ({ id, label, mustKeep })),
  };
}

// Format examples stay outside business facts, so examples never become requirements.
function authoringGuidance(plan, business, visual, businessReady, visualReady) {
  const color = plan.visualStyle.forUser.colorStrategy;
  const pendingFields = collectIssues(plan).map(issue => ({
    file: issue.path.startsWith('visualStyle.') ? visual : business,
    path: `facts.${issue.path}`,
    message: issue.message,
  }));
  for (const [file, ready] of [[business, businessReady], [visual, visualReady]]) {
    if (!ready) {pendingFields.push({ file, path: 'ready', message: '完成本片段的业务或视觉内容后设置为 true' });}
  }
  return {
    visualDecision: getVisualDecisionPolicy(),
    pendingFields,
    completion: '保留 base 和已有事实；按待补字段完成内容并复核业务覆盖，将完成的片段设为 ready=true，再执行 materialize.command。待补字段为初始化检查结果，最终生成时继续执行完整校验。',
    examples: {
      colorStrategy: { primaryColor: color.primaryColor, primaryColorName: color.primaryColorName, usage: color.usage },
      blocks: [{ name: '客房选择', purpose: '按日期和人数筛选可预约房型' }, { name: '预约结果', purpose: '查看提交结果，失败时保留已填内容并显示原因' }],
      field: { name: '订单编号', type: '单行文本', required: true, defaultOrOptions: '', relation: '', group: '基本信息', description: '订单唯一标识' },
      businessFragment: { facts: {
        overview: { businessGraph: { relations: [{ from: '订单', to: '客户', label: '归属客户', description: '一个客户可以拥有多笔订单' }] } },
        businessFlows: [{ name: '订单审核', type: '审批', description: '订单提交后审核', trigger: '订单提交', nodes: ['提交', '审批'], rules: ['审批通过后进入执行'] }],
        pages: { customPageDetails: [{ pageId: 'orders', dataBinding: 'form', dataSources: ['订单'] }] },
        execution: {
          sampleDataPlan: [{ form: '订单', records: [{ '订单编号': 'ORDER-001' }] }],
          interactionStates: { empty: '展示空态和新建入口', loading: '显示加载状态', error: '保留输入并提示失败原因' },
        },
      } },
      skippedSampleDataPlan: { path: 'facts.execution.sampleDataPlan', value: [{ form: '订单', skipReason: '填写本项目跳过示例数据的原因' }] },
      referenceRules: 'relations.from/to、field.relation、dataSources 必须填写 dataModels 中的完整名称；关系描述写 description，不放进引用值。示例中的模型名和流程只说明格式，无此业务时使用空数组。',
      pageApplication: { pageId: '填写实际页面ID', firstScreenFocus: '待审批订单位于首屏左上，数量与最临近截止时间组成焦点',
        layout: '桌面主列放待审批表格，右列放当前订单详情；两列比例为 2:1，区块间距 24px',
        primaryAction: '待审批表格每行末尾提供审批按钮，打开该订单对应的原生审批页面，处理成功后刷新列表',
        responsive: '宽度小于 768px 时详情移至表格下方，行内次操作收入菜单，主操作保持可见',
        acceptanceChecks: ['首屏待审批数量与表格筛选结果一致', '窄屏下订单号和主操作无需横向滚动即可查看'] },
    },
  };
}

function initialize(inputPath, options = {}) {
  const input = path.resolve(inputPath);
  const brief = readJson(input, 'requirement-brief.json');
  const project = brief.projectName;
  if ((project === undefined || project === null || project === '')
    && typeof brief.meta?.projectName === 'string'
    && brief.meta.projectName.trim()) {
    throw new CliError('projectName 必须位于 requirement-brief.json 根级；检测到 meta.projectName，请将该字段移动到根级后重试，不要更换项目名', {
      code: 'DESIGN_PLAN_PROJECT_NAME_MISPLACED',
      details: {
        expectedPath: 'projectName',
        actualPath: 'meta.projectName',
        nextAction: 'move_project_name_to_root',
        retryable: true,
        retrySafe: true,
      },
    });
  }
  if (typeof project !== 'string' || !project.trim() || /[/\\]/.test(project) || ['.', '..'].includes(project)) {
    throw new CliError('projectName 必须是单层项目目录名', { code: 'DESIGN_PLAN_INVALID_PROJECT' });
  }
  const resourceOnly = resourceOnlyScope(brief);
  if ((!resourceOnly && brief.intake?.confirmed !== true) || brief.openQuestions?.length) {
    throw new CliError('请先完成需求确认并记录 intake.confirmed=true', { code: 'DESIGN_PLAN_INTAKE_REQUIRED' });
  }
  if (!['platform-l-shape', 'platform-top', 'platform-side', 'custom'].includes(brief.navigation?.type)
    || (brief.navigation.type === 'custom' && !['side', 'top', 'mixed', 'dock'].includes(brief.navigation.variant))) {
    throw new CliError('请记录已确认的导航类型；自定义导航还需 variant: side/top/mixed/dock', { code: 'DESIGN_PLAN_NAVIGATION_REQUIRED' });
  }
  const { themes, pagePatterns: patterns } = loadCatalog();
  const themeId = options.themeId || brief.visualSelection?.themeId;
  const theme = themes.find(item => item.themeId === themeId);
  if (!theme) {
    throw new CliError('请通过 --theme-id 指定已选风格对应的主题', {
      code: 'DESIGN_PLAN_THEME_UNKNOWN', details: { themes: themes.map(({ themeId, label }) => ({ themeId, label })), catalogCommand: 'openyida design-plan catalog --json' },
    });
  }
  const navTheme = theme.mode === 'creative' ? brief.visualSelection?.navigationStyle?.tone || '' : themeNavTheme(theme);
  const outputDir = path.resolve(options.outputDir || path.join('prd', project));
  const output = path.join(outputDir, 'build-plan.json');
  const guide = path.join(outputDir, 'authoring-context.md');
  const business = path.join(outputDir, 'business.json');
  const visual = path.join(outputDir, 'visual.json');
  const materializeCommand = `openyida design-plan materialize ${quoteArgument(output)} --business-file ${quoteArgument(business)} --visual-file ${quoteArgument(visual)} --json`;
  if ([output, guide, business, visual, path.join(outputDir, require('./rebase').BASE_FILE)].some(file => fs.existsSync(file))) {
    throw new CliError('计划或编写上下文已存在，请继续补充现有文件', { code: 'DESIGN_PLAN_ALREADY_EXISTS' });
  }
  const scopedPages = list(brief.explicitScope?.pages);
  const scenes = list(brief.pageScenes)
    .filter(customScene)
    .filter(scene => !resourceOnly || scopedPages.some(entry => scopeEntryMatchesScene(entry, scene)));
  const pages = scenes.map((scene, index) => {
    const source = typeof scene === 'string' ? { name: scene } : scene;
    const { key, ...facts } = source;
    delete facts.kind;
    return { pageId: key || `page-${index + 1}`, sceneKey: key || `page-${index + 1}`, name: '', primaryTask: '',
      primaryUsers: [], positioning: '', blocks: [], firstScreenStructure: '', signatureInteraction: '',
      layoutPattern: { id: 'custom-page-pattern', reason: '', adaptations: [] },
      density: '', permissionSummary: '', dataBinding: '', dataSources: [], ...facts };
  });
  const choice = brief.visualSelection || {};
  assertVisualFieldObjects(choice, { prefix: 'visualSelection', sourcePath: input });
  const visualSource = choice.visualDirection?.source || 'ai_default';
  const app = brief.resourceContext?.app || brief.resourceContext || {};
  const appConfig = { navigationType: brief.navigation.type };
  for (const key of ['appType', 'corpId', 'baseUrl']) {if (app[key]) {appConfig[key] = app[key];}}
  const businessGoals = Array.isArray(brief.businessGoals)
    ? brief.businessGoals
    : (typeof brief.businessGoals === 'string' && brief.businessGoals.trim() ? [brief.businessGoals] : []);
  const modelInputs = (resourceOnly && list(brief.explicitScope?.forms).length > 0
    ? list(brief.explicitScope.forms)
    : list(brief.businessObjects)).map(item => {
    if (typeof item !== 'string') {return item;}
    return list(brief.businessObjects).find(candidate => candidate?.name === item) || item;
  });
  const normalizedScope = {
    ...brief.explicitScope,
    ...(resourceOnly ? {
      allowInferredResources: false,
      pages: scopedPages.filter(entry => scenes.some(scene => scopeEntryMatchesScene(entry, scene))),
    } : {}),
  };
  const rolePermissionSummary = list(brief.targetUsers)
    .map(user => typeof user === 'string' ? `${user}：使用本轮范围内已授权资源` : '')
    .filter(Boolean);
  if (resourceOnly && rolePermissionSummary.length === 0) {
    rolePermissionSummary.push('应用成员：使用本轮范围内已授权资源');
  }
  const plan = {
    schemaVersion: '2.0',
    meta: { projectName: project, appName: brief.appName || brief.projectDisplayName || brief.meta?.displayName || project, revision: '1', status: 'draft', source: input,
      businessDomain: brief.industry || '', experienceTopology: '',
      planState: { planConfirmed: false, presentedRevision: null, confirmedRevision: null } },
    overview: { summary: businessGoals.join('；'), businessGraph: { relations: [] }, rolePermissionSummary },
    dataModels: modelInputs.map(item => {
      const model = typeof item === 'string' ? { name: item } : item;
      return { ...model, name: model.name, formType: model.formType || '宜搭表单', description: model.description || '', fields: Array.isArray(model.fields) ? model.fields : [] };
    }), businessFlows: [], pages: { customPageDetails: pages }, execution: {
      appConfig,
      ...(!resourceOnly && brief.entryRecommendation ? { entryRecommendation: JSON.parse(JSON.stringify(brief.entryRecommendation)) } : {}),
      explicitScope: { ...normalizedScope, navigation: brief.navigation },
      ...(resourceOnly ? {
        sampleDataPlan: modelInputs
          .filter(item => !String(item?.formType || '').includes('流程'))
          .map(item => ({ form: typeof item === 'string' ? item : item.name, skipReason: '本轮显式窄范围不包含示例数据' })),
      } : {}),
    },
    visualStyle: {
      ...(choice.tokens ? { tokens: choice.tokens } : {}),
      ...(choice.evidence ? { evidence: choice.evidence } : {}),
      ...(choice.constraints ? { constraints: choice.constraints } : {}),
      ...(choice.creativeDirection ? { creativeDirection: choice.creativeDirection } : {}),
      forUser: { visualDirection: { ...(choice.visualDirection || { label: theme.label, description: theme.styleSummary }), source: visualSource },
        colorStrategy: { primaryColor: '', primaryColorName: '', source: '', usage: '', ...normalizeColorStrategy(choice.colorStrategy) },
        navigationStyle: { structure: '', source: '', selectionReason: '', ...(choice.navigationStyle || {}), tone: navTheme, toneSource: theme.mode === 'creative' ? 'project_defined' : 'theme_derived' },
        pageApplications: pages.map(page => ({ pageId: page.pageId, firstScreenFocus: '', layout: '', responsive: '', primaryAction: '', acceptanceChecks: [],
          visualMemoryApplications: [], ...list(choice.pageApplications).find(item => item?.pageId === page.pageId) })),
        ...(choice.assetStrategy ? { assetStrategy: choice.assetStrategy } : {}),
        ...(choice.iconSystem ? { iconSystem: choice.iconSystem } : {}) },
      internal: { selectedTheme: { themeId, source: visualSource } },
    },
    askhuman: {},
  };
  // Keep the business description and visual memory rules verbatim; the renderer consumes the full template.
  const template = fs.readFileSync(themeTemplatePath(theme), 'utf8');
  const overview = template.match(/^## 1\. 风格摘要\n([\s\S]*?)(?=^## |$(?![\s\S]))/m)?.[0];
  if (!overview) {throw new CliError('主题缺少风格摘要，请检查模板', { code: 'DESIGN_PLAN_THEME_CONTEXT_MISSING' });}
  const context = [
    '# 计划编写上下文', '', `需求事实：${input}`, `计划目录：${outputDir}`, '',
    `读取本上下文、编写契约和 business.json；按 authoring.pendingFields 补齐事实，保留 base 与已有需求。business facts 填写 overview、dataModels、businessFlows、pages 和可选 execution；视觉填写 visual.json。复核业务覆盖后设置片段 ready=true，再执行：${materializeCommand}。使用成功结果中的 HTML 路径展示“当前方案”，revision 仅放在内部确认字段，不写入用户可见标题、摘要或问题。视觉片段按每页实际任务补齐焦点、布局、主操作、响应式与验收；已完成的选择直接复用。`, '',
    '## 本轮编写重点', '设计功能范围、数据与规则、页面组织、关键交互和业务验收。页面 blocks 按优先顺序填写 {name,purpose}；CLI 派生默认内容优先级与内容层次，保留明确填写的独立设计。通用状态和验收检查由 CLI 补齐，interactionStates 与 acceptanceCriteria 填写项目差异。', '',
    '首页按使用者的主要任务选择：集中办事可用门户式工作台（workbench），单项任务可直达原生业务页；只有已确认的指标分析或投屏监控任务才规划 dashboard/screen。工作台按需求组织待办、操作队列、业务列表和常用入口，辅助统计不改变页面主任务。不得从后台身份、系统名称或暗色风格自动增加驾驶舱。完整规则见 yida-requirement-analysis/references/experience-groups.md 的“首页按任务选择”。', '',
    '无论是否分前后台，每个业务入口都要确定默认页面、菜单及分组顺序、打开后的首屏任务。menu 数组记录展示顺序，defaultMenuKey 记录默认任务；按角色需求决定，不按资源创建先后排列。平台导航通过排序命令落实，自定义导航通过页面菜单落实，frontend-only 也必须完成入口排序与首页验收。', '',
    '入口方案沿用 execution.entryRecommendation：unified 表示不分前后台，service-management 表示分前后台，frontend-only 表示只有访问前台，backend-only 表示只有访问后台。向用户说明谁使用、看到什么、能做什么；只有前台且提交后需要处理时，在 reason 和业务流程中说明承接方式；逐入口补齐 role、menu 和 defaultMenuKey，前台关联独立页面 sceneKey。任何身份的入口含 local 菜单时，entry.sceneKey 必须关联承载页面，menu.resource 等于页面 name，viewKey 非空。管理端可直接落到原生业务视图，不强制创建首页。所有叶子菜单按资源、视图和操作记录 access 权限依赖，平台导航排序从管理菜单派生。详见 yida-app/references/entry-navigation.md。', '',
    theme.mode === 'creative'
      ? '保留 visual.json 中 facts.visualStyle.forUser.visualDirection 和 navigationStyle 的对象结构；自由创意需明确填写 structure=top|side 和 tone=light|dark，并配套导航 Token。'
      : `保留 visual.json 中 facts.visualStyle.forUser.visualDirection 和 navigationStyle 的对象结构，只补齐内部字段；前者包含 label/description，后者只需维护 structure=top|side。tone=${navTheme} 由已选主题模板派生，不要修改。`, '',
    '## 页面模式', ...patterns.map(item => `- ${item.id}（${item.label}）：${item.mustKeep.join('；')}`), '',
    `## 已选风格：${theme.label}`, overview.trim(), '',
    '平台变量清单是基础契约，不是主题能力上限。visualStyle.tokens 可新增项目命名空间的材质、布局、字体、动效和组件状态变量，并在设计正文说明消费位置；平台变量可引用同一主题中已声明且无循环的扩展变量。不要为一次性页面样式强制新增 token。', '',
    'Fast 和 Plan 使用同一主题的颜色、圆角、间距和组件规则。主色按主题公式推导；已选方向承诺的画布、卡片、填充、字体或辅助色与模板不同时，由设计者将差异写入 visualStyle.tokens。description 和 colorStrategy.usage 不会自动转换为 CSS；物化后核对主题变量，再交接页面引用，不能在各页另写固定基础色盘。详见 yida-design/references/application-theme-consistency.md。根背景的渐变使用 --pod-app-root-bg-image，单页装饰写入该页设计。', '',
    '完整主题的 token、组件和状态规则由 CLI 注入 design.md。逐页补齐 pageApplications.firstScreenFocus、layout、responsive 和 acceptanceChecks，并在 primaryAction 写明真实主操作及所在位置；这些字段记录基于真实业务和所选主题做出的最终设计决定，不能仅写继承主题。旧计划缺项时继续补充原计划，预览可保持草稿，最终物化前必须完整。', '',
  ].join('\n');
  const base = planBase(plan);
  const businessFacts = Object.fromEntries(
    ['overview', 'dataModels', 'businessFlows', 'pages', 'execution'].map(key => [key, plan[key]]),
  );
  const businessReady = resourceOnly
    && businessGoals.length > 0
    && rolePermissionSummary.length > 0
    && plan.dataModels.length > 0
    && plan.dataModels.every(model => model.name && list(model.fields).length > 0
      && model.fields.every(field => field?.name && field?.type && typeof field.required === 'boolean'));
  const businessPart = `${JSON.stringify({ base, ready: businessReady, facts: businessFacts }, null, 2)}\n`;
  // Reuse the selected theme; page-specific design remains required for custom pages.
  const selectedVisual = plan.visualStyle.forUser;
  const visualReady = /^#[0-9a-f]{6}$/i.test(selectedVisual.colorStrategy.primaryColor || '')
    && ['top', 'side'].includes(selectedVisual.navigationStyle.structure)
    && ['light', 'dark'].includes(selectedVisual.navigationStyle.tone)
    && ['label', 'description'].every(key => typeof selectedVisual.visualDirection[key] === 'string' && selectedVisual.visualDirection[key].trim())
    && !collectIssues(plan).some(issue => issue.path.startsWith('visualStyle.forUser.pageApplications[')
      || issue.path.startsWith('visualStyle.creativeDirection.') || issue.path.startsWith('visualStyle.tokens.'));
  const visualPart = `${JSON.stringify({ base, ready: visualReady, facts: { visualStyle: plan.visualStyle } }, null, 2)}\n`;
  const authoring = authoringGuidance(plan, business, visual, businessReady, visualReady);
  const formatContext = ['## 输入格式示例', '示例仅说明格式，按当前业务填写。', '```json', JSON.stringify(authoring.examples, null, 2), '```', '', authoring.completion, ''].join('\n');
  const baseline = path.join(outputDir, require('./rebase').BASE_FILE);
  writeFiles([[output, `${JSON.stringify(plan, null, 2)}\n`], [baseline, `${JSON.stringify({ schemaVersion: 1, base, plan }, null, 2)}\n`], [guide, context + formatContext], [business, businessPart], [visual, visualPart]]);
  return { success: true, input, output, context: guide, contract: path.join(ROOT, 'references/build-plan-compact-schema.md'), draft: true,
    materialize: { mode: 'complete_files_once', maxCalls: 1,
      shell: process.platform === 'win32' ? 'powershell' : 'posix',
      command: materializeCommand },
    parallelTasks: [...(!businessReady ? [{ id: 'business', skill: 'yida-prd', output: business, dependsOn: [] }] : []),
      ...(!visualReady ? [{ id: 'visual-design', skill: 'yida-design', output: visual, dependsOn: !businessReady && pages.length ? ['business'] : [] }] : [])],
    preparedInputs: { business, businessReady, visual, visualReady },
    authoring: { pendingFields: authoring.pendingFields, completion: authoring.completion, visualDecision: authoring.visualDecision },
    optionalTasks: [{ id: 'visual-refinement', skill: 'yida-design', input: business, output: visual, dependsOn: ['business'],
      when: 'brand material, reference images, or explicit page-specific visual differences require refinement' }],
  };
}

module.exports = { initialize, catalog };
