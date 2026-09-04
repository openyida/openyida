'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { initialize } = require('../lib/design-plan/init');
const { materialize } = require('../lib/design-plan/materialize');
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
  expect(result.optionalTasks.map(task => [task.id, task.dependsOn])).toEqual([['visual-refinement', ['business']]]);
  const businessPart = JSON.parse(fs.readFileSync(result.parallelTasks[0].output, 'utf8'));
  const visualPart = JSON.parse(fs.readFileSync(result.preparedInputs.visual, 'utf8'));
  expect(businessPart.base).toEqual(require('../lib/design-plan/parallel').planBase(plan));
  expect(visualPart.base).toEqual(businessPart.base);
  expect(visualPart.ready).toBe(true);
  expect(visualPart.facts.visualStyle).toEqual(plan.visualStyle);
  expect(visualPart.facts.visualStyle.tokens).toEqual(brief.visualSelection.tokens);
  const context = fs.readFileSync(result.context, 'utf8');
  expect(context).toContain('视觉记忆点应用策略');
  expect(context).toContain('compact-workbench');
  expect(context).not.toContain('"--color-brand1-1"');
  expect(fs.readFileSync(briefPath, 'utf8')).toBe(original);
  expect(() => materialize(result.output)).toThrow();
  expect(fs.existsSync(path.join(dir, 'prd/prd.md'))).toBe(false);
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
