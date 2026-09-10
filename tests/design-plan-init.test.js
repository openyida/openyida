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
const init = () => initialize(briefPath, { themeId: 'airy-modular-clarity', outputDir: path.join(dir, 'prd') });

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
    },
    resourceContext: { app: { appType: 'APP_EXISTING' } },
    businessObjects: [{ name: '采购订单', fields: [{ name: '订单号', type: '文本', required: true }] }],
    pageScenes: [{ key: 'dashboard', name: '采购工作台', kind: 'custom-page', purpose: '跟进采购' }, { key: 'orders', name: '订单', kind: 'form' }],
    explicitScope: { modules: ['订单', '采购工作台'] },
  };
  save();
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

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
  expect(visualPart.facts.visualStyle.forUser.colorStrategy.surfaceTone).toBe('brand-tinted');
  const context = fs.readFileSync(result.context, 'utf8');
  expect(context).toContain('视觉记忆点应用策略');
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

test('preserves an explicit neutral reference palette at intake', () => {
  brief.visualSelection.colorStrategy.surfaceTone = 'theme';
  save();
  const result = init();
  const plan = JSON.parse(fs.readFileSync(result.output, 'utf8'));
  expect(plan.visualStyle.forUser.colorStrategy.surfaceTone).toBe('theme');
});

test('keeps incomplete visual choices unready and schedules only the missing selection work', () => {
  delete brief.visualSelection.colorStrategy;
  save();
  const result = init();
  expect(result.preparedInputs.visualReady).toBe(false);
  expect(result.parallelTasks.map(task => [task.id, task.dependsOn])).toEqual([['business', []], ['visual-selection', []]]);
  const visual = JSON.parse(fs.readFileSync(result.preparedInputs.visual, 'utf8'));
  expect(visual.ready).toBe(false);
});

test('materializes a complete standard Plan from business facts and the prepared visual input without another visual task', () => {
  const result = init();
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
  const design = fs.readFileSync(output.outputs.design, 'utf8');
  expect(design).toContain('dashboard');
  expect(design).toContain('#6F4E37');
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
    '--theme-id', 'airy-modular-clarity', '--output-dir', path.join(dir, 'cli-prd'), '--json'], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, OPENYIDA_SKIP_UPDATE_CHECK: '1' },
  }));
  expect(result.success).toBe(true);
  expect(fs.existsSync(result.output)).toBe(true);
});
