'use strict';

const fs = require('fs');
const path = require('path');
const { CliError } = require('../core/cli-error');
const { readJson, writeFiles } = require('./files');
const { planBase } = require('./parallel');

const ROOT = path.resolve(__dirname, '../../yida-skills/skills/yida-design/sub_skill/yida-design-plan');

function initialize(inputPath, options = {}) {
  const input = path.resolve(inputPath);
  const brief = readJson(input, 'requirement-brief.json');
  const project = brief.projectName;
  if (typeof project !== 'string' || !project.trim() || /[/\\]/.test(project) || ['.', '..'].includes(project)) {
    throw new CliError('projectName 必须是单层项目目录名', { code: 'DESIGN_PLAN_INVALID_PROJECT' });
  }
  if (brief.intake?.confirmed !== true || brief.openQuestions?.length) {
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
  const scenes = (brief.pageScenes || []).filter(scene => !['form', 'process-form', 'report'].includes(scene?.kind));
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
  const app = brief.resourceContext?.app || {};
  const appConfig = { navigationType: brief.navigation.type };
  for (const key of ['appType', 'corpId', 'baseUrl']) {if (app[key]) {appConfig[key] = app[key];}}
  const plan = {
    schemaVersion: '2.0',
    meta: { projectName: project, appName: brief.appName || project, revision: '1', status: 'draft', source: input,
      businessDomain: brief.industry || '', experienceTopology: '',
      planState: { planConfirmed: false, presentedRevision: null, confirmedRevision: null } },
    overview: { summary: (brief.businessGoals || []).join('；'), businessGraph: { relations: [] }, rolePermissionSummary: [] },
    dataModels: (brief.businessObjects || []).map(item => {
      const model = typeof item === 'string' ? { name: item } : item;
      return { ...model, name: model.name, formType: model.formType || '宜搭表单', description: model.description || '', fields: Array.isArray(model.fields) ? model.fields : [] };
    }), businessFlows: [], pages: { customPageDetails: pages }, execution: { appConfig, explicitScope: { ...brief.explicitScope, navigation: brief.navigation } },
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
    '先读 build-plan-compact-schema.md；标准首版一次完成 business.json，复用已预填的 visual.json 后合并物化。只有视觉选择不完整或存在品牌稿、参考图、逐页特殊视觉要求时才补充视觉。保留各文件 base、页面 ID 与已有需求细节；普通首版不逐模块调用 preview。', '',
    '## 页面模式', ...patterns.map(item => `- ${item.id}（${item.label}）：${item.mustKeep.join('；')}`), '',
    `## 已选风格：${theme.label}`, overview.trim(), '',
    '用户确认的配色优先于模板固定灰阶：surfaceTone=brand-tinted 将浅色页面、填充和边界与主色协调，正文保留中性层级；用户明确只改强调色、保持中性或忠实参考配色时设为 theme。深色表面保留原层级。不要为了模板的无彩限制撤掉用户要求的品牌氛围。', '',
    '完整主题的 token、组件、状态和响应式规则由 CLI 注入 design.md；调整具体组件时按需读取对应模板章节。', '',
  ].join('\n');
  const base = planBase(plan);
  const businessPart = `${JSON.stringify({ base, ready: false, facts: {} }, null, 2)}\n`;
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
    preview: { command: `openyida design-plan preview ${output} --part-file <module.json> --json`, modules: ['overview', 'dataModels', 'businessFlows', 'pages', 'visualStyle'], finalize: `openyida design-plan materialize ${output} --from-preview --json` },
    parallelTasks: [{ id: 'business', skill: 'yida-prd', output: business, dependsOn: [] },
      ...(!visualReady ? [{ id: 'visual-selection', skill: 'yida-design', output: visual, dependsOn: [] }] : [])],
    preparedInputs: { visual, visualReady },
    optionalTasks: [{ id: 'visual-refinement', skill: 'yida-design', input: business, output: visual, dependsOn: ['business'],
      when: 'brand material, reference images, or explicit page-specific visual differences require refinement' }],
  };
}

module.exports = { initialize };
