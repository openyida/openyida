'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { initialize } = require('../lib/design-plan/init');
const { materialize } = require('../lib/design-plan/materialize');

const fixture = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/design-plan.json'), 'utf8'));
let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-scaffold-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

function init(edit = () => {}) {
  const plan = fixture(), page = plan.pages.customPageDetails[0];
  const brief = { projectName: 'procurement', appName: '采购协作', intake: { confirmed: true }, openQuestions: [],
    navigation: { type: 'platform-side' }, businessGoals: [plan.overview.summary], targetUsers: ['采购专员'],
    businessObjects: plan.dataModels, pageScenes: [{ ...page, key: page.pageId, kind: 'custom-page' }],
    visualSelection: { ...plan.visualStyle.forUser, themeId: 'soft-outline-rhythm' } };
  edit(brief);
  const file = path.join(dir, 'brief.json'), original = JSON.stringify(brief);
  fs.writeFileSync(file, original);
  const result = initialize(file, { outputDir: path.join(dir, 'plan') });
  expect(fs.readFileSync(file, 'utf8')).toBe(original);
  return { result, plan: JSON.parse(fs.readFileSync(result.output)), source: plan };
}

test('known facts generate a usable skeleton and keep the confirmation after generation', () => {
  const { result, plan, source } = init(brief => {
    brief.visualSelection.colorStrategy.primaryColor = '#abc';
    brief.entryRecommendation = { mode: 'unified', entries: [{ key: 'workspace', name: '采购管理', role: 'workspace',
      sceneKey: brief.pageScenes[0].key, menu: [{ targetType: 'local',
        access: [{ resource: brief.pageScenes[0].name, operation: 'OPERATE_VIEW', dataScope: '当前角色已授权范围' }] }] }] };
  });
  expect(plan.visualStyle.forUser.colorStrategy.primaryColor).toBe('#AABBCC');
  expect(plan.visualStyle.tokens['--color-brand1-6']).toBe('#AABBCC');
  const entry = plan.execution.entryRecommendation.entries[0];
  expect(entry.menu[0]).toMatchObject({ key: 'menu-1', label: '采购工作台', resource: '采购工作台', viewKey: 'menu-1' });
  expect(entry.defaultMenuKey).toBe('menu-1');
  expect(result.materialize.checkCommand).toContain('--check --json');
  const business = JSON.parse(fs.readFileSync(result.preparedInputs.business));
  business.facts.overview = source.overview;
  business.facts.businessFlows = source.businessFlows;
  business.ready = true;
  fs.writeFileSync(result.preparedInputs.business, JSON.stringify(business));
  const options = { businessFile: result.preparedInputs.business, visualFile: result.preparedInputs.visual };
  const checked = materialize(result.output, { ...options, check: true });
  expect(checked.checked).toBe(true);
  expect(checked).not.toHaveProperty('confirmation');
  expect(fs.existsSync(checked.outputs.html)).toBe(false);
  const built = materialize(result.output, options);
  expect(fs.existsSync(built.outputs.html)).toBe(true);
  expect(built.confirmation.revision).toBe(built.revision);
});

test('explicit choices and conflicts survive init; missing business decisions stay pending', () => {
  const { result, plan } = init(brief => {
    delete brief.businessObjects[0].fields[0].required;
    brief.visualSelection.tokens = { '--color-brand1-6': '#FF0000' };
    brief.entryRecommendation = { mode: 'unified', entries: [{ key: 'workspace', name: '采购管理', role: 'workspace',
      sceneKey: brief.pageScenes[0].key, menu: [{ key: 'custom', label: '自定名称', targetType: 'local', resource: '错误引用' }] }] };
  });
  expect(plan.execution.entryRecommendation.entries[0].menu[0]).toMatchObject({ key: 'custom', label: '自定名称', resource: '错误引用' });
  expect(plan.execution.entryRecommendation.entries[0].menu[0]).not.toHaveProperty('access');
  expect(plan.dataModels[0].fields[0]).not.toHaveProperty('required');
  expect(plan.visualStyle.tokens['--color-brand1-6']).toBe('#FF0000');
  expect(result.authoring.pendingFields).toEqual(expect.arrayContaining([
    expect.objectContaining({ path: 'facts.dataModels[0].fields[0].required', code: 'EXPECTED_BOOLEAN', expectedType: 'boolean' }),
    expect.objectContaining({ path: 'facts.execution.entryRecommendation.entries[0].menu[0].access', expectedType: 'array' }),
    expect.objectContaining({ path: 'facts.visualStyle.tokens.--color-brand1-6', code: 'PRIMARY_COLOR_MISMATCH' }),
  ]));
  expect(result.preparedInputs.visualReady).toBe(false);
  expect(result.authoring.pendingFields.filter(item => item.expectedType)
    .every(item => ['string', 'array', 'object', 'boolean'].includes(item.expectedType))).toBe(true);
});

test('generated menu keys do not collide with explicit keys, and multiple tasks keep default selection pending', () => {
  const { plan, result } = init(brief => {
    brief.entryRecommendation = { mode: 'unified', entries: [{ key: 'workspace', name: '管理', role: 'workspace',
      menu: [{ resource: '采购订单', targetType: 'page' }, { key: 'menu-1', resource: '采购申请' }] }] };
  });
  const entry = plan.execution.entryRecommendation.entries[0];
  expect(entry.menu.map(item => item.key)).toEqual(['menu-1-2', 'menu-1']);
  expect(entry).not.toHaveProperty('defaultMenuKey');
  expect(entry.menu[1]).not.toHaveProperty('targetType');
  expect(result.authoring.pendingFields).toContainEqual(expect.objectContaining({
    path: 'facts.execution.entryRecommendation.entries[0].menu[1].targetType',
    code: 'ENTRY_TARGET_REQUIRED', allowedValues: ['local', 'submission', 'page', 'custom'],
  }));
});

test('typed examples do not copy malformed field values into the repair guidance', () => {
  const { result, plan } = init(brief => {
    brief.businessObjects[1].fields[0].type = 42;
    brief.businessObjects[1].fields[0].required = 'yes';
  });
  const examples = JSON.parse(fs.readFileSync(result.context, 'utf8')
    .split('## 输入格式示例')[1].match(/```json\n([\s\S]*?)\n```/)[1]);
  expect(examples.field).toMatchObject({ name: '订单名称', type: 'TextField', required: true });
  expect(plan.dataModels[1].fields[0]).toMatchObject({ type: 42, required: 'yes' });
  expect(result.authoring.pendingFields).toContainEqual(expect.objectContaining({
    path: 'facts.dataModels[1].fields[0].required', expectedType: 'boolean',
  }));
});

test('real CLI check aggregates independent repairs without writing plan artifacts', () => {
  const plan = fixture(); plan.schemaVersion = '2.0';
  plan.dataModels[0].fields[0].required = 'true';
  plan.pages.customPageDetails[0].sceneKey = 'workbench';
  plan.pages.customPageDetails[0].contentRichness.contentLayers = 'wrong type';
  plan.execution = { entryRecommendation: { mode: 'unified', entries: [{ key: 'workspace', name: '管理', role: 'workspace',
    sceneKey: 'workbench', defaultMenuKey: 'task', menu: [{ key: 'task', targetType: 'local', resource: '采购工作台' }] }] } };
  plan.visualStyle.tokens = { '--color-brand1-6': '#FF0000' };
  plan.visualStyle.forUser.assetStrategy = { pages: 'wrong type' };
  const input = path.join(dir, 'build-plan.json'), original = JSON.stringify(plan);
  fs.writeFileSync(input, original);
  const env = { ...process.env, OPENYIDA_NO_AUTO_UPDATE: '1', OPENYIDA_SKIP_UPDATE_CHECK: '1', NO_COLOR: '1', FORCE_COLOR: '0' };
  delete env.OPENYIDA_MANAGED_RUN;
  const bin = process.env.OPENYIDA_TEST_BIN || path.resolve(__dirname, '../bin/yida.js');
  let failure;
  try { execFileSync(process.execPath, [bin, 'design-plan', 'materialize', input, '--check', '--json'], { cwd: dir, env, stdio: 'pipe' }); }
  catch (error) { failure = error; }
  expect(failure.status).toBe(1);
  const stderr = failure.stderr.toString();
  const payload = JSON.parse(stderr.slice(stderr.indexOf('{\n  "success"')));
  expect(payload.details.issues).toEqual(expect.arrayContaining([
    expect.objectContaining({ path: 'dataModels[0].fields[0].required', code: 'EXPECTED_BOOLEAN' }),
    expect.objectContaining({ path: 'execution.entryRecommendation.entries[0].menu[0].label' }),
    expect.objectContaining({ path: 'execution.entryRecommendation.entries[0].menu[0].viewKey' }),
    expect.objectContaining({ path: 'execution.entryRecommendation.entries[0].menu[0].access' }),
    expect.objectContaining({ path: 'visualStyle.forUser.assetStrategy.pages', expectedType: 'array' }),
    expect.objectContaining({ code: 'PRIMARY_COLOR_MISMATCH', expected: '#6F4E37', actual: '#FF0000' }),
  ]));
  expect(fs.readFileSync(input, 'utf8')).toBe(original);
  expect(fs.readdirSync(dir)).toEqual(['build-plan.json']);
});
