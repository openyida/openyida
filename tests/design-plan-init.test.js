'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { initialize } = require('../lib/design-plan/init');
const { materialize, normalizePlan } = require('../lib/design-plan/materialize');
const { collectIssues } = require('../lib/design-plan/validate');

const fixture = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/design-plan.json'), 'utf8'));
let dir;
let briefPath;
let brief;
const save = () => fs.writeFileSync(briefPath, JSON.stringify(brief));
const init = () => initialize(briefPath, { themeId: 'soft-inset-surfaces', outputDir: path.join(dir, 'prd') });
const colorExample = result => JSON.parse(fs.readFileSync(result.context, 'utf8')
  .split('## 输入格式示例')[1].match(/```json\n([\s\S]*?)\n```/)[1]).colorStrategy;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-plan-init-'));
  briefPath = path.join(dir, 'brief.json');
  brief = {
    projectName: 'procurement', appName: '采购协作', industry: '采购', businessGoals: ['跟进采购'],
    intake: { firstBuild: true, sourceDetail: 'detailed', designMode: 'plan', confirmed: true }, openQuestions: [],
    navigation: { type: 'custom', variant: 'top', source: 'user_selected' },
    visualSelection: {
      visualDirection: { label: '暖棕流程', description: '突出采购待办和业务状态' },
      colorStrategy: { primaryColor: '#6F4E37', primaryColorName: '暖棕色' },
      navigationStyle: { structure: 'top', tone: 'light' },
      tokens: { '--pod-card-border-radius': '16px' },
      pageApplications: [{ ...fixture().visualStyle.forUser.pageApplications[0], pageId: 'dashboard' }],
    },
    resourceContext: { app: { appType: 'APP_EXISTING' } },
    businessObjects: [{ name: '采购订单', fields: [{ name: '订单号', type: '文本', required: true }] }],
    pageScenes: [{ key: 'dashboard', name: '采购工作台', kind: 'custom-page', purpose: '跟进采购' }, { key: 'orders', name: '订单', kind: 'form' }],
    explicitScope: { modules: ['订单', '采购工作台'] },
  };
  save();
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

test.each([
  ['workbench', '采购工作台', '处理待确认订单与待收货队列', 'workbench'],
  ['dashboard', '采购成本分析', '比较已确认的采购成本趋势与交付率', 'dashboard-overview'],
])('preserves the planned %s task through initialization and materialization', (scene, name, primaryTask, pageStructure) => {
  const source = fixture();
  const page = source.pages.customPageDetails[0];
  Object.assign(page, { name, primaryTask, scene, sceneKey: 'procurement-entry' });
  brief.appName = '暗黑供应链管理系统';
  brief.pageScenes = [{ ...page, key: page.sceneKey, kind: 'custom-page' }];
  brief.visualSelection.pageApplications[0].pageId = page.pageId;
  save();
  const result = init();
  const business = JSON.parse(fs.readFileSync(result.preparedInputs.business, 'utf8'));
  const initializedPages = business.facts.pages.customPageDetails;
  expect(initializedPages).toHaveLength(1);
  expect(initializedPages[0]).toMatchObject({ name, primaryTask, scene, sceneKey: page.sceneKey });
  business.ready = true;
  business.facts = { ...business.facts, overview: source.overview, dataModels: source.dataModels, businessFlows: source.businessFlows };
  fs.writeFileSync(result.preparedInputs.business, JSON.stringify(business));
  const built = materialize(result.output, { businessFile: result.preparedInputs.business, visualFile: result.preparedInputs.visual });
  const prd = fs.readFileSync(built.outputs.prd, 'utf8');
  const execution = JSON.parse(prd.match(/```json\n([\s\S]*?)\n```/)[1]);
  expect(execution.pages).toHaveLength(1);
  expect(execution.pages[0]).toMatchObject({ name, pageSpecHandoff: { scene, pageStructure, primaryAction: primaryTask } });
  expect(JSON.parse(fs.readFileSync(result.output, 'utf8')).pages.customPageDetails[0].blocks).toEqual(page.blocks);
});

test('does not add a custom homepage for an entry that uses only native business resources', () => {
  brief.navigation = { type: 'platform-side', source: 'ai_default', reason: '维护订单使用平台管理列表' };
  brief.pageScenes = [{ key: 'orders', name: '订单', kind: 'form', purpose: '查询维护订单' }];
  brief.entryRecommendation = { mode: 'unified', source: 'ai_inferred', reason: '主要任务为维护订单',
    entries: [{ key: 'operations', role: 'workspace', name: '订单管理', taskRefs: ['manage-orders'], defaultMenuKey: 'orders',
      menu: [{ key: 'orders', label: '订单管理', resource: '采购订单', targetType: 'page',
        access: [{ resource: '采购订单', operation: 'OPERATE_VIEW', dataScope: '已授权管理范围' }] }] }] };
  save();
  const result = init();
  const plan = JSON.parse(fs.readFileSync(result.output, 'utf8'));
  expect(plan.pages.customPageDetails).toEqual([]);
  expect(plan.execution.entryRecommendation).toEqual(brief.entryRecommendation);
});

test.each(['visualDirection', 'navigationStyle'])('rejects string %s before creating draft files', field => {
  brief.visualSelection[field] = '顶部导航';
  save();
  expect(() => init()).toThrow(expect.objectContaining({
    code: 'DESIGN_PLAN_VISUAL_FIELD_TYPE_INVALID',
    details: expect.objectContaining({ path: `visualSelection.${field}`, sourcePath: briefPath }),
  }));
  expect(fs.existsSync(path.join(dir, 'prd', 'build-plan.json'))).toBe(false);
});

test.each(['#6F4E37', '#1677FF'])('color examples preserve the project choice %s instead of proposing a preset', primaryColor => {
  brief.visualSelection.colorStrategy = { primaryColor, primaryColorName: '项目主色', usage: '来自用户提供的品牌规范' };
  save();
  const result = init();
  expect(colorExample(result)).toEqual(brief.visualSelection.colorStrategy);
  expect(result.authoring.visualDecision).toEqual(require('../lib/design-plan/visual-policy').getVisualDecisionPolicy());
  const plan = JSON.parse(fs.readFileSync(result.output, 'utf8'));
  expect(plan.visualStyle.forUser.colorStrategy.primaryColor).toBe(primaryColor);
});

test('missing color uses the existing visual-design task and leaves the example unfilled', () => {
  delete brief.visualSelection.colorStrategy;
  save();
  const result = init();
  expect(colorExample(result)).toEqual({ primaryColor: '', primaryColorName: '', usage: '' });
  expect(result.authoring.pendingFields).toEqual(expect.arrayContaining([
    expect.objectContaining({ path: 'facts.visualStyle.forUser.colorStrategy.primaryColor' }),
  ]));
  expect(result.parallelTasks.map(task => task.id)).toEqual(['business', 'visual-design']);
  expect(result.authoring.visualDecision.comparison).toMatchObject({ baseline: 'first_instinct', alternatives: 2, distinctDimensions: 2 });
});

test.each([undefined, 'ai_default', 'user_selected'])('visual selection preserves its actual source: %s', source => {
  brief.visualSelection.visualDirection.source = source;
  save();
  const result = init();
  const visual = JSON.parse(fs.readFileSync(result.output, 'utf8')).visualStyle;
  expect(visual.forUser.visualDirection.source).toBe(source || 'ai_default');
  expect(visual.internal.selectedTheme.source).toBe(source || 'ai_default');
});

test('initializes stable references, preserves explicit facts and returns a bounded theme context', () => {
  const original = fs.readFileSync(briefPath, 'utf8');
  const result = init();
  const plan = JSON.parse(fs.readFileSync(result.output, 'utf8'));
  expect(plan.meta).toMatchObject({ projectName: 'procurement', appName: '采购协作', status: 'draft' });
  expect(plan.pages.customPageDetails).toHaveLength(1);
  expect(plan.pages.customPageDetails[0]).toMatchObject({ pageId: 'dashboard', sceneKey: 'dashboard', name: '采购工作台' });
  expect(plan.dataModels[0].fields).toEqual(brief.businessObjects[0].fields);
  expect(plan.execution.appConfig.appType).toBe('APP_EXISTING');
  expect(plan.execution.explicitScope.navigation.variant).toBe('top');
  expect(result.parallelTasks.map(task => [task.id, task.dependsOn])).toEqual([['business', []]]);
  expect(result.preparedInputs.visual).toBe(result.parallelTasks[0].output.replace('business.json', 'visual.json'));
  expect(result.materialize).toMatchObject({ mode: 'complete_files_once', maxCalls: 1 });
  expect(result.materialize.command).toContain('--business-file');
  expect(result.materialize.command).toContain('--visual-file');
  expect(result.preview).toBeUndefined();
  expect(result.optionalTasks.map(task => [task.id, task.dependsOn])).toEqual([['visual-refinement', ['business']]]);
  const businessPart = JSON.parse(fs.readFileSync(result.parallelTasks[0].output, 'utf8'));
  const visualPart = JSON.parse(fs.readFileSync(result.preparedInputs.visual, 'utf8'));
  expect(businessPart.base).toEqual(require('../lib/design-plan/parallel').planBase(plan));
  expect(Object.keys(businessPart.facts)).toEqual(['overview', 'dataModels', 'businessFlows', 'pages', 'execution']);
  expect(businessPart.facts.overview.summary).toBe('跟进采购');
  expect(visualPart.base).toEqual(businessPart.base);
  expect(visualPart.ready).toBe(true);
  expect(visualPart.facts.visualStyle).toEqual(plan.visualStyle);
  expect(visualPart.facts.visualStyle.tokens).toEqual(brief.visualSelection.tokens);
  expect(visualPart.facts.visualStyle.forUser.colorStrategy).toEqual({ source: '', usage: '', ...brief.visualSelection.colorStrategy });
  const context = fs.readFileSync(result.context, 'utf8');
  expect(context).toContain('## 1. 风格摘要');
  expect(context).toContain('compact-workbench');
  expect(context).not.toContain('"--color-brand1-1"');
  expect(fs.readFileSync(briefPath, 'utf8')).toBe(original);
  expect(() => materialize(result.output)).toThrow();
  expect(fs.existsSync(path.join(dir, 'prd/prd.md'))).toBe(false);
});

test('normalizes a single business goal string without crashing', () => {
  brief.businessGoals = '只完成回访记录表单';
  save();
  const result = init();
  const plan = JSON.parse(fs.readFileSync(result.output, 'utf8'));
  expect(plan.overview.summary).toBe('只完成回访记录表单');
});

test('keeps page-specific design decisions pending while preserving selected theme and icon facts', () => {
  delete brief.visualSelection.pageApplications;
  brief.visualSelection.iconSystem = { library: '@ant-design/icons', mappings: { approve: 'CheckOutlined' } };
  save();
  const result = init();
  const visual = JSON.parse(fs.readFileSync(result.preparedInputs.visual, 'utf8'));
  expect(result.preparedInputs.visualReady).toBe(false);
  expect(visual.ready).toBe(false);
  expect(result.parallelTasks.find(task => task.id === 'visual-design').dependsOn).toEqual(['business']);
  expect(visual.facts.visualStyle.forUser.iconSystem).toEqual(brief.visualSelection.iconSystem);
  expect(visual.facts.visualStyle.forUser.pageApplications[0]).toMatchObject({ firstScreenFocus: '', layout: '', responsive: '', acceptanceChecks: [] });
  for (const key of ['firstScreenFocus', 'layout', 'primaryAction', 'responsive', 'acceptanceChecks']) {
    expect(result.authoring.pendingFields.some(item => item.path.endsWith(`.${key}`))).toBe(true);
  }
  expect(fs.readFileSync(result.context, 'utf8')).toContain('不能仅写继承主题');
});

test('rejects a generic inherit-theme answer for a page design decision', () => {
  brief.visualSelection.pageApplications[0].layout = '继承主题';
  save();
  const result = init();
  expect(result.preparedInputs.visualReady).toBe(false);
  expect(result.authoring.pendingFields).toEqual(expect.arrayContaining([
    expect.objectContaining({ path: 'facts.visualStyle.forUser.pageApplications[0].layout' }),
  ]));
});

test('the compact skill example supplies all required page design fields for materialization', () => {
  const contract = fs.readFileSync(path.resolve(__dirname,
    '../yida-skills/skills/yida-design/sub_skill/yida-design-plan/references/build-plan-compact-schema.md'), 'utf8');
  const examples = [...contract.matchAll(/```json\n([\s\S]*?)\n```/g)].map(match => JSON.parse(match[1]));
  const example = examples.find(value => value.forUser?.pageApplications);
  const plan = fixture();
  plan.schemaVersion = '2.0';
  plan.visualStyle.forUser.pageApplications = [{ ...example.forUser.pageApplications[0], pageId: plan.pages.customPageDetails[0].pageId }];
  const input = path.join(dir, 'documented-plan.json');
  fs.writeFileSync(input, JSON.stringify(plan));
  expect(materialize(input, { outputDir: path.join(dir, 'documented-output') }).success).toBe(true);
});

test('prefills resource-only execution with deterministic sample-data skips and root resource context', () => {
  brief.appName = undefined;
  brief.projectDisplayName = '采购协作显示名';
  brief.resourceContext = { appType: 'APP_ROOT_CONTEXT' };
  brief.explicitScope = { forms: ['采购订单'], allowInferredResources: false };
  save();
  const result = init();
  const plan = JSON.parse(fs.readFileSync(result.output, 'utf8'));
  const business = JSON.parse(fs.readFileSync(result.preparedInputs.business, 'utf8'));
  expect(plan.meta.appName).toBe('采购协作显示名');
  expect(plan.execution.appConfig.appType).toBe('APP_ROOT_CONTEXT');
  expect(business.facts.execution.sampleDataPlan).toEqual([
    { form: '采购订单', skipReason: '本轮显式窄范围不包含示例数据' },
  ]);
  expect(result.preparedInputs.businessReady).toBe(true);
  expect(result.parallelTasks).toEqual([]);
});

test('infers a complete form-only scope and drops an unconfirmed custom page invention', () => {
  brief.intake.confirmed = false;
  brief.pageScenes = [{ key: 'visit-form', name: '回访记录表', kind: 'form', purpose: '登记回访' }];
  brief.explicitScope = {
    forms: [{ name: '回访记录表', fields: [{ name: '客户名称', type: 'text', required: true }] }],
    pages: [{ key: 'invented-workbench', name: '臆造工作台', kind: 'custom-page' }],
    delivery: ['回访记录表单'],
  };
  save();
  const result = init();
  const plan = JSON.parse(fs.readFileSync(result.output, 'utf8'));
  expect(plan.execution.explicitScope).toMatchObject({ allowInferredResources: false, pages: [] });
  expect(plan.pages.customPageDetails).toEqual([]);
  expect(plan.dataModels).toHaveLength(1);
  expect(plan.dataModels[0].name).toBe('回访记录表');
  expect(result.preparedInputs.businessReady).toBe(true);
  expect(result.parallelTasks).toEqual([]);
  expect(materialize(result.output, {
    businessFile: result.preparedInputs.business,
    visualFile: result.preparedInputs.visual,
  }).success).toBe(true);
});

test.each([
  { type: 'platform-side', source: 'ai_default', reason: '以原生审批和台账为主，采用平台侧栏' },
  { type: 'custom', variant: 'top', source: 'ai_default', reason: '需要保留品牌菜单与内容状态，采用自定义顶部导航' },
  { type: 'custom', variant: 'side', source: 'user_selected', reason: '用户明确要求自定义侧栏' },
])('initializes Plan and preserves resolved navigation facts: %j', navigation => {
  brief.navigation = navigation;
  save();
  const result = init();
  const plan = JSON.parse(fs.readFileSync(result.output, 'utf8'));
  expect(plan.execution.appConfig.navigationType).toBe(navigation.type);
  expect(plan.execution.explicitScope.navigation).toEqual(navigation);
  expect(plan.meta.status).toBe('draft');
  expect(JSON.parse(fs.readFileSync(briefPath, 'utf8')).navigation).toEqual(navigation);
});

test('normalizes equivalent role, sample-record and navigation authoring shapes before validation', () => {
  const plan = fixture();
  plan.schemaVersion = '2.0';
  plan.overview.rolePermissionSummary = [{ role: '采购专员', permissions: '维护采购申请' }];
  plan.dataModels[0].formType = '宜搭表单';
  plan.dataModels[0].fields[0].key = 'amount';
  plan.dataModels[0].fields[0].fieldType = plan.dataModels[0].fields[0].type;
  delete plan.dataModels[0].fields[0].type;
  plan.dataModels[0].sampleRecords = [{ purpose: '验收记录', fields: { amount: 100 } }];
  plan.visualStyle.forUser.navigationStyle.structure = 'platform-side';
  const normalized = normalizePlan(plan);
  expect(normalized.overview.rolePermissionSummary).toEqual(['采购专员：维护采购申请']);
  expect(normalized.dataModels[0].sampleRecords).toEqual([{ 申请金额: 100 }]);
  expect(normalized.dataModels[0].fields[0]).toMatchObject({ type: expect.any(String) });
  expect(normalized.dataModels[0].fields[0]).not.toHaveProperty('fieldType');
  expect(normalized.visualStyle.forUser.navigationStyle.structure).toBe('side');
  expect(collectIssues(normalized)).toEqual([]);
});

test('normalizes skipped samples and object data sources without materialize probing', () => {
  const plan = fixture();
  plan.schemaVersion = '2.0';
  plan.dataModels[0].formType = '宜搭表单';
  plan.dataModels[0].sampleRecords = { skipReason: '本轮不创建示例数据' };
  plan.pages.customPageDetails[0].dataBinding = '回访记录表单数据';
  plan.pages.customPageDetails[0].dataSources = [{ source: `${plan.dataModels[0].name}表单`, type: 'form' }];

  const normalized = normalizePlan(plan);

  expect(normalized.dataModels[0]).not.toHaveProperty('sampleRecords');
  expect(normalized.dataModels[0].skipSampleReason).toBe('本轮不创建示例数据');
  expect(normalized.pages.customPageDetails[0]).toMatchObject({
    dataBinding: 'form',
    dataSources: [plan.dataModels[0].name],
  });
  expect(collectIssues(normalized)).toEqual([]);
});

test('drops actor edges from the table-only business graph', () => {
  const plan = fixture();
  plan.schemaVersion = '2.0';
  plan.overview.businessGraph.relations = [
    { from: '采购专员', label: '创建', to: plan.dataModels[0].name },
    { from: plan.dataModels[0].name, label: '自关联', to: plan.dataModels[0].name },
  ];
  const normalized = normalizePlan(plan);
  expect(normalized.overview.businessGraph.relations).toEqual([
    { from: plan.dataModels[0].name, label: '自关联', to: plan.dataModels[0].name },
  ]);
});

test('resource-only execution excludes theme, seed and navigation work', () => {
  const plan = fixture();
  plan.schemaVersion = '2.0';
  plan.execution = { explicitScope: { forms: [plan.dataModels[0].name], allowInferredResources: false } };
  const input = path.join(dir, 'resource-only-plan.json');
  fs.writeFileSync(input, JSON.stringify(plan));
  const result = materialize(input);
  const prd = fs.readFileSync(result.outputs.prd, 'utf8');
  expect(prd).not.toContain('- 应用与主题配置');
  expect(prd).not.toContain('- 初始示例数据');
  expect(prd).not.toContain('- 发布与导航排序');
  expect(prd).not.toContain('- 应用主题按 design.md 配置');
  expect(prd).toContain('本轮显式窄范围不执行导航排序');
});

test('normalizes omitted sample data to an explicit skip for resource-only plans', () => {
  const plan = fixture();
  plan.schemaVersion = '2.0';
  plan.dataModels[0].formType = '宜搭表单';
  plan.execution = {};
  plan.execution.explicitScope = { forms: ['采购申请'], allowInferredResources: false };
  const normalized = normalizePlan(plan);
  expect(normalized.execution.sampleDataPlan).toEqual(
    plan.dataModels.map(model => ({ form: model.name, skipReason: '本轮显式窄范围不包含示例数据' })),
  );
});

test.each(['海洋蓝，搭配沙滩暖色', '海洋🌊风格', ''])('keeps a color description as text instead of character properties: %s', description => {
  brief.visualSelection.colorStrategy = description;
  save();
  const original = fs.readFileSync(briefPath, 'utf8');
  const result = init();
  const plan = JSON.parse(fs.readFileSync(result.output, 'utf8'));
  const visual = JSON.parse(fs.readFileSync(result.preparedInputs.visual, 'utf8'));
  const strategy = visual.facts.visualStyle.forUser.colorStrategy;
  expect(strategy).toEqual({ primaryColor: '', primaryColorName: '', source: '', usage: description });
  expect(plan.visualStyle.forUser.colorStrategy).toEqual(strategy);
  expect(visual.ready).toBe(false);
  expect(result.authoring.pendingFields).toContainEqual(expect.objectContaining({ path: 'facts.visualStyle.forUser.colorStrategy.primaryColor' }));
  expect(fs.readFileSync(briefPath, 'utf8')).toBe(original);
});

test.each([undefined, null])('keeps absent color strategies as incomplete objects: %s', value => {
  brief.visualSelection.colorStrategy = value;
  save();
  const result = init();
  const visual = JSON.parse(fs.readFileSync(result.preparedInputs.visual, 'utf8'));
  expect(visual.facts.visualStyle.forUser.colorStrategy.usage).toBe('');
  expect(visual.ready).toBe(false);
});

test.each([[], ['海洋蓝'], 123, true])('rejects invalid color strategy types before creating files: %j', value => {
  brief.visualSelection.colorStrategy = value;
  save();
  expect(init).toThrow(expect.objectContaining({ code: 'DESIGN_PLAN_INVALID_COLOR_STRATEGY' }));
  expect(fs.existsSync(path.join(dir, 'prd'))).toBe(false);
});

test('preserves an explicit neutral reference palette at intake', () => {
  brief.visualSelection.tokens = { '--pod-page-bg-color': '#F7F7F7', '--pod-card-bg-color': '#FFFFFF' };
  save();
  const result = init();
  const plan = JSON.parse(fs.readFileSync(result.output, 'utf8'));
  expect(plan.visualStyle.tokens).toEqual(brief.visualSelection.tokens);
});

test('keeps incomplete visual choices unready and schedules only the missing selection work', () => {
  delete brief.visualSelection.colorStrategy;
  save();
  const result = init();
  expect(result.preparedInputs.visualReady).toBe(false);
  expect(result.parallelTasks.map(task => [task.id, task.dependsOn])).toEqual([['business', []], ['visual-design', ['business']]]);
  const visual = JSON.parse(fs.readFileSync(result.preparedInputs.visual, 'utf8'));
  expect(visual.ready).toBe(false);
  expect(result.authoring.pendingFields).toEqual(expect.arrayContaining([
    expect.objectContaining({ file: result.preparedInputs.visual, path: 'facts.visualStyle.forUser.colorStrategy.primaryColor' }),
    expect.objectContaining({ file: result.preparedInputs.visual, path: 'ready' }),
  ]));
});

test('init reports only missing authoring fields and keeps type examples outside business facts', () => {
  brief.targetUsers = ['采购员'];
  brief.pageScenes[0].permissionSummary = '采购员仅查看自己的订单';
  save();
  const result = init();
  const business = JSON.parse(fs.readFileSync(result.preparedInputs.business, 'utf8'));
  const pending = result.authoring.pendingFields;
  expect(pending).toEqual(expect.arrayContaining([
    expect.objectContaining({ file: result.preparedInputs.business, path: 'facts.pages.customPageDetails[0].primaryTask' }),
    expect.objectContaining({ file: result.preparedInputs.business, path: 'facts.dataModels[0].sampleRecords' }),
    expect.objectContaining({ file: result.preparedInputs.business, path: 'ready' }),
  ]));
  expect(pending.some(item => item.file === result.preparedInputs.visual)).toBe(false);
  expect(pending.some(item => item.path.endsWith('.permissionSummary') || item.path === 'facts.overview.summary')).toBe(false);
  expect(business.facts.dataModels[0].fields).toEqual(brief.businessObjects[0].fields);
  expect(business.facts.execution.interactionStates).toBeUndefined();
  expect(business.ready).toBe(false);
  expect(fs.readFileSync(result.context, 'utf8')).toContain('"interactionStates": {');
  expect(business.facts.pages.customPageDetails[0]).not.toHaveProperty('contentPriority');
  expect(business.facts.pages.customPageDetails[0]).not.toHaveProperty('contentRichness');
  expect(pending.some(item => /contentPriority|contentLayers/.test(item.path))).toBe(false);
  expect(fs.readFileSync(result.context, 'utf8')).toContain('"purpose":');
});

test('catalog is read-only and its theme IDs initialize through the public CLI without login', () => {
  const { execFileSync } = require('child_process');
  const bin = path.join(__dirname, '../bin/yida.js');
  const options = { cwd: dir, encoding: 'utf8', env: { ...process.env, OPENYIDA_SKIP_UPDATE_CHECK: '1' } };
  const before = fs.readdirSync(dir);
  const result = JSON.parse(execFileSync(process.execPath, [bin, 'design-plan', 'catalog', '--json'], options));
  expect(fs.readdirSync(dir)).toEqual(before);
  const themeIndex = require('../yida-skills/skills/yida-design/templates/design-themes/index.json');
  const patterns = require('../yida-skills/skills/yida-design/sub_skill/yida-design-plan/templates/page-patterns/index.json');
  expect(result.themes.map(theme => theme.themeId)).toEqual(themeIndex.themes.map(theme => theme.themeId));
  expect(result.pagePatterns).toEqual(patterns.patterns.map(({ id, label, mustKeep }) => ({ id, label, mustKeep })));
  const initialized = JSON.parse(execFileSync(process.execPath, [bin, 'design-plan', 'init', briefPath,
    '--theme-id', result.themes[0].themeId, '--output-dir', path.join(dir, 'catalog-plan'), '--json'], options));
  expect(initialized.success).toBe(true);
  const { buildCommandManifest } = require('../lib/core/command-manifest');
  const command = buildCommandManifest().commands.find(item => item.id === 'design-plan.catalog');
  expect(command).toMatchObject({ requires_login: false, output: 'json', permission: { mode: 'allow' }, side_effect: { kind: 'local_read', mutates_local: false, mutates_yida: false } });
});

test('collects interaction state format errors alongside other missing facts', () => {
  const plan = fixture();
  plan.execution = { interactionStates: ['empty', 'error'], sampleDataPlan: [] };
  plan.pages.customPageDetails[0].permissionSummary = '';
  const issues = collectIssues(plan);
  expect(issues).toEqual(expect.arrayContaining([
    expect.objectContaining({ path: 'execution.interactionStates' }),
    expect.objectContaining({ path: 'execution.sampleDataPlan' }),
    expect.objectContaining({ path: 'pages.customPageDetails[0].permissionSummary' }),
  ]));
  expect(issues.some(issue => issue.path.includes('[-1]'))).toBe(false);
  plan.execution.interactionStates = { empty: '暂无记录', error: '显示错误' };
  expect(collectIssues(plan).some(issue => issue.path.startsWith('execution.interactionStates'))).toBe(false);
});

test('returned materialize command handles spaces, quotes and shell expressions in paths', () => {
  const { spawnSync } = require('child_process');
  const result = initialize(briefPath, { themeId: 'soft-inset-surfaces', outputDir: path.join(dir, "plan ' $(touch unwanted)") });
  const source = fixture();
  source.pages.customPageDetails[0].pageId = 'dashboard';
  source.pages.customPageDetails[0].sceneKey = 'dashboard';
  delete source.pages.customPageDetails[0].pageSpecHandoff;
  const business = JSON.parse(fs.readFileSync(result.preparedInputs.business, 'utf8'));
  business.ready = true;
  business.facts = { overview: source.overview, dataModels: source.dataModels, businessFlows: source.businessFlows, pages: source.pages };
  fs.writeFileSync(result.preparedInputs.business, JSON.stringify(business));
  const windows = process.platform === 'win32';
  expect(result.materialize.shell).toBe(windows ? 'powershell' : 'posix');
  const executable = windows ? 'powershell.exe' : '/bin/sh';
  const args = windows
    ? ['-NoProfile', '-NonInteractive', '-Command', 'function openyida { & $env:NODE_EXEC $env:YIDA_BIN @args }\n' + result.materialize.command]
    : ['-c', 'openyida() { "$NODE_EXEC" "$YIDA_BIN" "$@"; }\n' + result.materialize.command];
  const execution = spawnSync(executable, args, {
    cwd: dir, encoding: 'utf8', env: { ...process.env, OPENYIDA_SKIP_UPDATE_CHECK: '1', NODE_EXEC: process.execPath, YIDA_BIN: path.resolve(__dirname, '../bin/yida.js') },
  });
  // Keep child-process Error objects out of Jest worker IPC (ENOENT can be circular).
  if (execution.error || execution.status !== 0) {
    throw new Error(`${executable}: ${execution.error?.message || execution.stderr || execution.stdout} (exit ${execution.status})`);
  }
  const output = JSON.parse(execution.stdout);
  expect(output.success).toBe(true);
  expect(fs.existsSync(output.outputs.html)).toBe(true);
  expect(fs.existsSync(path.join(dir, 'unwanted'))).toBe(false);
});

test.each(require('../yida-skills/skills/yida-design/templates/design-themes/index.json').themes)(
  'initializes and materializes shared theme $themeId with its current summary and token contract', theme => {
    delete brief.visualSelection.visualDirection;
    save();
    const result = initialize(briefPath, { themeId: theme.themeId, outputDir: path.join(dir, 'prd') });
    const initialized = JSON.parse(fs.readFileSync(result.output, 'utf8'));
    expect(initialized.visualStyle.forUser.visualDirection.description).toBe(theme.styleSummary);
    expect(result.preparedInputs.visualReady).toBe(true);
    expect(fs.readFileSync(result.context, 'utf8')).toContain('## 1. 风格摘要');
    const source = fixture();
    source.pages.customPageDetails[0].pageId = 'dashboard';
    source.pages.customPageDetails[0].sceneKey = 'dashboard';
    delete source.pages.customPageDetails[0].pageSpecHandoff;
    const businessFile = result.parallelTasks[0].output;
    const business = JSON.parse(fs.readFileSync(businessFile, 'utf8'));
    business.ready = true;
    business.facts = { overview: source.overview, dataModels: source.dataModels, businessFlows: source.businessFlows, pages: source.pages };
    fs.writeFileSync(businessFile, JSON.stringify(business));
    const output = materialize(result.output, { businessFile, visualFile: result.preparedInputs.visual });
    expect(output.success).toBe(true);
    expect(output).toMatchObject({ previousRevision: '1', revision: '1' });
    const design = fs.readFileSync(output.outputs.design, 'utf8');
    expect(design).toContain('dashboard');
    expect(design).toContain('#6F4E37');
    expect(design).not.toMatch(/<生成实际色值|\{\{[A-Z_]+\}\}/);
    expect(require('../lib/app/theme-from-design').readDesignTokens(design)['--color-brand1-6']).toBe('#6F4E37');
    expect(fs.readFileSync(output.outputs.prd, 'utf8')).toContain('采购');
  });

test.each([
  b => {b.intake.confirmed = false;},
  b => {b.openQuestions = ['哪些角色可以审批？'];},
  b => {delete b.navigation.variant;},
  b => {b.projectName = '../escape';},
])('rejects unconfirmed or invalid intake without writing files', change => {
  change(brief); save();
  expect(init).toThrow();
  expect(fs.existsSync(path.join(dir, 'prd'))).toBe(false);
});

test('diagnoses a projectName misplaced under meta without writing files', () => {
  brief.meta = { projectName: brief.projectName };
  delete brief.projectName;
  save();

  try {
    init();
    throw new Error('initialization should fail');
  } catch (error) {
    expect(error).toMatchObject({
      code: 'DESIGN_PLAN_PROJECT_NAME_MISPLACED',
      details: {
        expectedPath: 'projectName',
        actualPath: 'meta.projectName',
        nextAction: 'move_project_name_to_root',
        retryable: true,
        retrySafe: true,
      },
    });
    expect(error.message).toContain('不要更换项目名');
  }
  expect(fs.existsSync(path.join(dir, 'prd'))).toBe(false);
});

test('never overwrites an existing draft', () => {
  const result = init();
  fs.writeFileSync(result.output, 'user edits');
  expect(init).toThrow('已存在');
  expect(fs.readFileSync(result.output, 'utf8')).toBe('user edits');
});

test('reports misplaced sceneKey, wrong design path and missing scene reference together', () => {
  const plan = fixture();
  const page = plan.pages.customPageDetails[0];
  page.pageSpecHandoff = { sceneKey: 'operations', designFile: 'prd/wrong/design.md', designRefs: ['sceneRecipes.operations'] };
  const input = path.join(dir, 'build-plan.json');
  fs.writeFileSync(input, JSON.stringify(plan));
  expect(collectIssues(plan).map(issue => issue.path)).toEqual(expect.arrayContaining([
    'pages.customPageDetails[0].pageSpecHandoff.sceneKey',
    'pages.customPageDetails[0].pageSpecHandoff.designFile',
    'pages.customPageDetails[0].pageSpecHandoff.designRefs[0]',
  ]));
  try {materialize(input); throw new Error('validation should fail');} catch (error) {
    expect(error.details.issues.length).toBeGreaterThanOrEqual(3);
  }
  expect(fs.existsSync(path.join(dir, 'prd.md'))).toBe(false);
});

test('completed source renders all files with display name, stable design references and execution timings', () => {
  const result = init();
  const draft = JSON.parse(fs.readFileSync(result.output, 'utf8'));
  const plan = fixture();
  plan.meta.projectName = draft.meta.projectName;
  plan.meta.appName = draft.meta.appName;
  fs.writeFileSync(result.output, JSON.stringify(plan));
  const output = materialize(result.output);
  expect(fs.readFileSync(output.outputs.prd, 'utf8')).toContain('# 采购协作 PRD');
  expect(fs.readFileSync(output.outputs.prd, 'utf8')).toContain('prd/procurement/design.md');
  expect(fs.readFileSync(output.outputs.design, 'utf8')).toContain('# 采购协作 design.md');
  expect(fs.readFileSync(output.outputs.html, 'utf8')).toContain('采购协作');
  for (const stage of ['readMs', 'validationAndNormalizationMs', 'businessValidationMs', 'prdMs', 'designMs', 'themeValidationMs', 'htmlMs', 'writeMs', 'totalMs']) {
    expect(output.timings[stage]).toBeGreaterThanOrEqual(0);
  }
  expect(output.timings.totalMs).toBeGreaterThan(output.timings.htmlMs);
});

test('CLI init is permitted locally, documents every argument and runs through the public router', () => {
  const { buildCommandManifest } = require('../lib/core/command-manifest');
  const command = buildCommandManifest().commands.find(item => item.id === 'design-plan.init');
  expect(command.requires_login).toBe(false);
  expect(command.side_effect).toMatchObject({ kind: 'local_write', mutates_yida: false });
  expect(command.permission.mode).toBe('allow');
  expect(command.args.map(arg => arg.builder_options[0])).toEqual(['--requirement-brief', '--theme-id', '--output-dir', '--json']);
  const { execFileSync } = require('child_process');
  const result = JSON.parse(execFileSync(process.execPath, [path.join(__dirname, '../bin/yida.js'), 'design-plan', 'init', briefPath,
    '--theme-id', 'soft-inset-surfaces', '--output-dir', path.join(dir, 'cli-prd'), '--json'], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, OPENYIDA_SKIP_UPDATE_CHECK: '1' },
  }));
  expect(result.success).toBe(true);
  expect(fs.existsSync(result.output)).toBe(true);
});


test('preserves a frontend page menu independently of the application navigation', () => {
  brief.navigation = { type: 'platform-side', source: 'ai_default', reason: '后台用平台菜单' };
  brief.pageScenes[0].pageSpecHandoff = {
    entryMode: 'standalone', navigation: { type: 'custom', variant: 'dock', reason: '个人事项入口' },
  };
  save();
  const result = init();
  const plan = JSON.parse(fs.readFileSync(result.output, 'utf8'));
  const business = JSON.parse(fs.readFileSync(result.preparedInputs.business, 'utf8'));
  expect(plan.execution.appConfig.navigationType).toBe('platform-side');
  expect(plan.execution.appConfig.hideAppNav).toBeUndefined();
  expect(business.facts.pages.customPageDetails[0].pageSpecHandoff).toEqual(brief.pageScenes[0].pageSpecHandoff);
});

test('init reports all malformed visual objects in one diagnostic without creating files', () => {
  brief.visualSelection.visualDirection = '专业简洁';
  brief.visualSelection.navigationStyle = '顶部';
  save();
  try { init(); throw new Error('expected validation failure'); } catch (error) {
    expect(error.code).toBe('DESIGN_PLAN_VISUAL_FIELD_TYPE_INVALID');
    expect(error.details.issues.map(issue => issue.path)).toEqual(['visualSelection.visualDirection', 'visualSelection.navigationStyle']);
  }
  expect(fs.existsSync(path.join(dir, 'prd', 'build-plan.json'))).toBe(false);
});
test('authoring context places execution examples at their actual fragment paths', () => {
  const result = init();
  const context = fs.readFileSync(result.context, 'utf8');
  const examples = JSON.parse(context.match(/## 输入格式示例[\s\S]*?```json\n([\s\S]*?)\n```/)[1]);
  expect(examples.businessFragment.facts.execution.sampleDataPlan).toHaveLength(1);
  expect(examples.businessFragment.facts.execution.interactionStates.error).toBeTruthy();
  expect(examples.businessFragment.facts).not.toHaveProperty('sampleDataPlan');
  expect(examples.businessFragment.facts.businessFlows[0]).toEqual(expect.objectContaining({ trigger: expect.any(String), nodes: expect.any(Array), rules: expect.any(Array) }));
});
