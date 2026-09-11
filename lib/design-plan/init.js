'use strict';

const fs = require('fs');
const path = require('path');
const { CliError } = require('../core/cli-error');
const { readJson, writeFiles } = require('./files');
const { planBase } = require('./parallel');

const ROOT = path.resolve(__dirname, '../../yida-skills/skills/yida-design/sub_skill/yida-design-plan');

function list(value) {
  return Array.isArray(value) ? value : [];
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
  const themes = readJson(path.join(ROOT, 'templates/design-themes/index.json')).themes;
  const themeId = options.themeId || brief.visualSelection?.themeId;
  const theme = themes.find(item => item.themeId === themeId);
  if (!theme) {
    throw new CliError('请通过 --theme-id 指定已选风格对应的主题', {
      code: 'DESIGN_PLAN_THEME_UNKNOWN', details: { themes: themes.map(({ themeId, label }) => ({ themeId, label })) },
    });
  }
  const outputDir = path.resolve(options.outputDir || path.join('prd', project));
  const output = path.join(outputDir, 'build-plan.json');
  const guide = path.join(outputDir, 'authoring-context.md');
  const business = path.join(outputDir, 'business.json');
  const visual = path.join(outputDir, 'visual.json');
  if ([output, guide, business, visual].some(file => fs.existsSync(file))) {
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
      primaryUsers: [], positioning: '', contentPriority: [], blocks: [], firstScreenStructure: '', signatureInteraction: '',
      layoutPattern: { id: 'custom-page-pattern', reason: '', adaptations: [] }, contentRichness: { contentLayers: [] },
      density: '', permissionSummary: '', dataBinding: '', dataSources: [], ...facts };
  });
  const choice = brief.visualSelection || {};
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
      forUser: { visualDirection: choice.visualDirection || { label: theme.label, description: theme.description, source: 'user_selected' },
        colorStrategy: { primaryColor: '', primaryColorName: '', source: '', usage: '', surfaceTone: 'brand-tinted', ...choice.colorStrategy },
        navigationStyle: choice.navigationStyle || { structure: '', tone: '', source: '', selectionReason: '' },
        pageApplications: pages.map(page => ({ pageId: page.pageId, visualMemoryApplications: [] })),
        ...(choice.assetStrategy ? { assetStrategy: choice.assetStrategy } : {}) },
      internal: { selectedTheme: { themeId, source: 'user_selected' } },
    },
    askhuman: {},
  };
  // Keep the business description and visual memory rules verbatim; the renderer consumes the full template.
  const template = fs.readFileSync(path.join(ROOT, theme.templatePath), 'utf8');
  const overview = template.match(/^## 设计总览\n([\s\S]*?)(?=^## |$(?![\s\S]))/m)?.[0];
  if (!overview) {throw new CliError('主题缺少设计总览，请检查模板', { code: 'DESIGN_PLAN_THEME_CONTEXT_MISSING' });}
  const patterns = readJson(path.join(ROOT, 'templates/page-patterns/index.json')).patterns;
  const context = [
    '# 计划编写上下文', '', `需求事实：${input}`, `计划目录：${outputDir}`, '',
    `先读 build-plan-compact-schema.md，再读 init 已创建的 business.json；保留 base 并一次补完 facts 后写回。business facts 只能包含 overview、dataModels、businessFlows、pages 和可选 execution，不得写 visualStyle。写完后只执行一次：openyida design-plan materialize ${output} --business-file ${business} --visual-file ${visual} --json。标准首版禁止先调用 --from-preview、preview、--check 或无参数 materialize，也不要用 Glob 或额外 Read 检查产物；成功结果已返回 HTML 路径和 revision。只有视觉选择不完整或存在品牌稿、参考图、逐页特殊视觉要求时才补充视觉。保留页面 ID 与已有需求细节。`, '',
    '## 页面模式', ...patterns.map(item => `- ${item.id}（${item.label}）：${item.mustKeep.join('；')}`), '',
    `## 已选风格：${theme.label}`, overview.trim(), '',
    '用户确认的配色优先于模板固定灰阶：surfaceTone=brand-tinted 将浅色页面、填充和边界与主色协调，正文保留中性层级；用户明确只改强调色、保持中性或忠实参考配色时设为 theme。深色表面保留原层级。不要为了模板的无彩限制撤掉用户要求的品牌氛围。', '',
    '完整主题的 token、组件、状态和响应式规则由 CLI 注入 design.md；调整具体组件时按需读取对应模板章节。', '',
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
  // The intake already records an atomic visual selection. Seed it here so a
  // standard first Plan only needs one model planning pass for business facts.
  const selectedVisual = plan.visualStyle.forUser;
  const visualReady = /^#[0-9a-f]{6}$/i.test(selectedVisual.colorStrategy.primaryColor || '')
    && ['top', 'side'].includes(selectedVisual.navigationStyle.structure)
    && ['light', 'dark'].includes(selectedVisual.navigationStyle.tone)
    && ['label', 'description'].every(key => typeof selectedVisual.visualDirection[key] === 'string' && selectedVisual.visualDirection[key].trim());
  const visualPart = `${JSON.stringify({ base, ready: visualReady, facts: { visualStyle: plan.visualStyle } }, null, 2)}\n`;
  writeFiles([[output, `${JSON.stringify(plan, null, 2)}\n`], [guide, context], [business, businessPart], [visual, visualPart]]);
  return { success: true, input, output, context: guide, contract: path.join(ROOT, 'references/build-plan-compact-schema.md'), draft: true,
    materialize: { mode: 'complete_files_once', maxCalls: 1,
      command: `openyida design-plan materialize ${output} --business-file ${business} --visual-file ${visual} --json` },
    parallelTasks: [...(!businessReady ? [{ id: 'business', skill: 'yida-prd', output: business, dependsOn: [] }] : []),
      ...(!visualReady ? [{ id: 'visual-selection', skill: 'yida-design', output: visual, dependsOn: [] }] : [])],
    preparedInputs: { business, businessReady, visual, visualReady },
    optionalTasks: [{ id: 'visual-refinement', skill: 'yida-design', input: business, output: visual, dependsOn: ['business'],
      when: 'brand material, reference images, or explicit page-specific visual differences require refinement' }],
  };
}

module.exports = { initialize };
