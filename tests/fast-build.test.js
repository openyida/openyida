'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { prepareFastBuild, readFastBuild } = require('../lib/app/fast-build');
const { evaluatePrdCompleteness, parseArgs } = require('../lib/app/check-prd-completeness');
const { buildAssetTasks } = require('../lib/asset/asset-plan');
const fixture = () => JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/samples/yida-app/fast-app.json'), 'utf8'));
let dir;
beforeEach(() => {dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fast-build-'));});
afterEach(() => {fs.rmSync(dir, { recursive: true, force: true });});
function input(spec = fixture()) {
  const file = path.join(dir, 'spec.json'); fs.writeFileSync(file, JSON.stringify(spec)); return file;
}
function cli(args) {
  const env = { ...process.env, OPENYIDA_NO_AUTO_UPDATE: '1', OPENYIDA_SKIP_UPDATE_CHECK: '1',
    OPENYIDA_SKILLS_DIR: path.join(dir, 'skills'), NO_COLOR: '1', FORCE_COLOR: '0' };
  delete env.OPENYIDA_MANAGED_RUN;
  return execFileSync(process.execPath, [path.resolve(__dirname, '../bin/yida.js'), ...args], { cwd: dir, env, encoding: 'utf8', stdio: 'pipe' });
}

test('public Fast CLI generates only context and app_theme.css, with matching theme and no long documents', () => {
  const file = path.join(dir, 'input.json'), output = path.join(dir, 'build');
  cli(['sample', 'yida-app', 'fast-spec', '--output', file]);
  const result = JSON.parse(cli(['sample', 'yida-app', 'fast-build', '--spec-file', file, '--output', output]));
  expect(fs.readdirSync(output).sort()).toEqual(['app_theme.css', 'build-context.json']);
  const context = readFastBuild(result.outputs.context);
  expect(context).toMatchObject({ mode: 'fast', pages: fixture().pages, resources: [], roles: [],
    applicationTheme: { required: true, themeColor: '#356B86', navTheme: 'light', themeFile: result.outputs.theme } });
  expect(fs.readFileSync(result.outputs.theme, 'utf8')).toContain('#356B86');
  const task = result.assetTasks[0];
  expect(task.startWhen).toBe('fast_context_ready');
  expect(task.resolve.argv).toEqual(expect.arrayContaining(['--build-spec', result.outputs.context]));
  expect(task.resolve.argv).not.toContain('--design');
  expect(task.timeBudget).toMatchObject({ collectionDeadlineMs: 60000, requestTimeoutMs: 15000 });
  expect(buildAssetTasks(fixture().assetStrategy, output)[0].startWhen).toBe('plan_confirmed');
});

test('dry run writes nothing; unchanged runs preserve files; changed output refuses all writes', () => {
  const file = input(), output = path.join(dir, 'build');
  expect(prepareFastBuild(file, output, { check: true }).checkedOnly).toBe(true);
  expect(fs.existsSync(output)).toBe(false);
  const { outputs } = prepareFastBuild(file, output);
  const before = Object.values(outputs).map(p => ({ p, text: fs.readFileSync(p, 'utf8'), mtime: fs.statSync(p).mtimeMs }));
  prepareFastBuild(file, output);
  before.forEach(({ p, text, mtime }) => {expect(fs.readFileSync(p, 'utf8')).toBe(text); expect(fs.statSync(p).mtimeMs).toBe(mtime);});
  input({ ...fixture(), name: 'changed business' });
  expect(() => prepareFastBuild(file, output)).toThrow(expect.objectContaining({ code: 'SAMPLE_OUTPUT_EXISTS' }));
  before.forEach(({ p, text }) => expect(fs.readFileSync(p, 'utf8')).toBe(text));
});

test('business resources, role data scopes, constraints and rules survive without claiming execution', () => {
  const spec = fixture();
  spec.resources = [{ key: 'customers', name: '客户档案', type: 'normal-form', fields: [{ type: 'TextField', label: '客户名称' }] }];
  spec.roles = [{ name: '销售', scope: '只维护本人负责的客户', operations: ['新增客户', '编辑本人客户'] }];
  spec.businessRules = ['同一客户可有多条跟进']; spec.pages[0].dataSources = ['customers'];
  spec.constraints = { prohibitedActions: ['publish'] }; spec.intake = { confirmed: true, designMode: 'fast' };
  const result = prepareFastBuild(input(spec), path.join(dir, 'build'));
  const context = readFastBuild(result.outputs.context);
  for (const key of ['resources', 'roles', 'businessRules', 'constraints', 'intake']) {expect(context[key]).toEqual(spec[key]);}
  expect(context).not.toHaveProperty('permissionsVerified');
  expect(result.outputs.theme).toBeTruthy();
});

test('explicit theme-file prohibition preserves current theme without generating or replacing CSS', () => {
  const output = path.join(dir, 'build'); fs.mkdirSync(output); fs.writeFileSync(path.join(output, 'app_theme.css'), 'existing');
  const spec = fixture(); spec.constraints = { prohibitedActions: ['theme-file'] };
  const result = prepareFastBuild(input(spec), output);
  expect(result.outputs).not.toHaveProperty('theme');
  expect(readFastBuild(result.outputs.context)).not.toHaveProperty('applicationTheme');
  expect(fs.readFileSync(path.join(output, 'app_theme.css'), 'utf8')).toBe('existing');
});

test('invalid business inputs aggregate repairs and leave no artifacts', () => {
  const spec = fixture(); spec.resources = [{ key: 'one', name: '客户', type: 'normal-form', dependsOn: ['two'] },
    { key: 'two', name: '商机', type: 'normal-form', dependsOn: ['one'] }];
  spec.roles = [{ name: '销售' }]; spec.pages[0].dataSources = ['unknown'];
  let failure;
  try {prepareFastBuild(input(spec), path.join(dir, 'build'));} catch (error) {failure = error;}
  expect(failure.code).toBe('FAST_BUILD_INVALID');
  expect(failure.details.issues.map(x => x.path)).toEqual(expect.arrayContaining(['resources[0].fields', 'roles[0]', 'pages[0].dataSources', 'resources.dependsOn']));
  expect(fs.readdirSync(dir)).toEqual(['spec.json']);
});

test.each(['unknown-theme', 'app-pop'])('keeps theme eligibility validation for %s', themeId => {
  expect(() => prepareFastBuild(input({ ...fixture(), themeId }), path.join(dir, 'build'))).toThrow();
  expect(fs.existsSync(path.join(dir, 'build'))).toBe(false);
});

test('keeps primary-color and contrast validation without design.md', () => {
  const spec = fixture(); spec.tokens = { '--color-brand1-6': '#FF0000' };
  expect(() => prepareFastBuild(input(spec), path.join(dir, 'build'))).toThrow();
  spec.tokens = { '--color-text1-4': '#FFFFFF', '--pod-page-bg-color': '#FFFFFF' };
  expect(() => prepareFastBuild(input(spec), path.join(dir, 'build'))).toThrow();
});

test.each([{ mode: 'plan' }, { roles: null }, { pages: null }])('rejects invalid contexts and options: %j', overrides => {
  const spec = { ...fixture(), ...overrides };
  expect(() => prepareFastBuild(input(spec), path.join(dir, 'build'))).toThrow();
  expect(() => cli(['sample', 'yida-app', 'fast-build', '--spec-file', 'input.json', '--design-file', 'x'])).toThrow();
});

test('Fast asset resolve reads the JSON strategy and keeps required-image acceptance gaps', () => {
  const spec = fixture(); spec.assetStrategy.pages[0].imageNeed = 'required'; spec.assetStrategy.pages[0].slots[0].required = true;
  const { outputs } = prepareFastBuild(input(spec), path.join(dir, 'build'));
  const draft = path.join(dir, 'draft.json'), manifest = path.join(dir, 'manifest.json'); fs.writeFileSync(draft, '{"assets":[]}');
  let failure;
  try {cli(['asset', 'resolve', '--input', draft, '--build-spec', outputs.context, '--page-id', 'website', '--manifest', manifest, '--offline', '--json']);} catch (e) {failure = e;}
  expect(failure.status).toBe(2);
  const result = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  expect(result.pages[0].assetGate).toMatchObject({ implementation: 'unblocked', preview: 'unblocked', finalAssetAcceptance: 'blocked' });
  expect(() => cli(['asset', 'resolve', '--input', draft, '--build-spec', outputs.context, '--design', 'missing.md'])).toThrow();
});

test('Fast completion uses real resource IDs and live theme readback, without Markdown', async () => {
  const { outputs } = prepareFastBuild(input(), path.join(dir, 'build'));
  const fastSpec = readFastBuild(outputs.context), buildManifest = { resources: [{ name: fastSpec.pages[0].name, type: 'display-page', formUuid: 'FORM-WEBSITE', required: true }] };
  const forms = [{ formUuid: 'FORM-WEBSITE', formName: fastSpec.pages[0].name, formType: 'display' }];
  const app = { colour: 'custom', themeColor: '#356B86', navTheme: 'light', customThemeStyle: { enabled: true, cssUrl: 'https://example.test/theme.css' } };
  const evaluate = (rows, theme) => evaluatePrdCompleteness('', { appType: 'APP_TEST', fastSpec, buildManifest, buildSpecPath: outputs.context }, {
    fetchForms: jest.fn().mockResolvedValue(rows), fetchApp: jest.fn().mockResolvedValue(theme) });
  const result = await evaluate(forms, app);
  expect(result.verdict).toBe('pass'); expect(result.sources.prd).toBeNull();
  expect(result.sources.buildSpec).toMatchObject({ resources: 1 });
  expect(result.themeVerification).toMatchObject({ verified: true, runtimeVerified: false });
  expect((await evaluate([], app)).verdict).toBe('fail');
  expect((await evaluate(forms, { ...app, themeColor: '#FF0000' })).verdict).toBe('fail');
  expect(parseArgs(['--build-spec', outputs.context, '--app-type', 'APP_TEST'], { strict: true })).toMatchObject({ buildSpecPath: outputs.context, appType: 'APP_TEST', prdPath: '' });
  expect(() => parseArgs(['--build-spec'], { strict: true })).toThrow();
  expect(() => cli(['check-prd-completeness', 'prd.md', '--build-spec', outputs.context, '--app-type', 'APP_TEST'])).toThrow();
});


test('a malformed generated context cannot silently drop its mandatory theme check', () => {
  const { outputs } = prepareFastBuild(input(), path.join(dir, 'build'));
  const context = readFastBuild(outputs.context); delete context.applicationTheme;
  fs.writeFileSync(outputs.context, JSON.stringify(context));
  expect(() => readFastBuild(outputs.context)).toThrow(expect.objectContaining({ code: 'FAST_BUILD_INVALID' }));
});
