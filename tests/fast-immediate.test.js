'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawnSync } = require('child_process');
const { prepareFastTheme } = require('../lib/app/fast-theme');
const { evaluatePrdCompleteness, parseArgs } = require('../lib/app/check-prd-completeness');
const { parseCreateAppArgs } = require('../lib/app/create-app');
const { parseDesignDocument, extractDesignTokens } = require('../lib/design/document');
const { loadThemeIndex, themeTemplatePath, resolveThemeColors } = require('../lib/design-plan/themes');
const { generateThemeCss } = require('../lib/app/theme-source');
let dir;
beforeEach(() => {dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fast-immediate-'));});
afterEach(() => {fs.rmSync(dir, { recursive: true, force: true });});
const color = '#2E6E8E';
function cli(args) {
  const env = { ...process.env, OPENYIDA_NO_AUTO_UPDATE: '1', OPENYIDA_SKIP_UPDATE_CHECK: '1',
    OPENYIDA_SKILLS_DIR: path.join(dir, 'skills'), NO_COLOR: '1', FORCE_COLOR: '0' };
  delete env.OPENYIDA_MANAGED_RUN;
  return spawnSync(process.execPath, [path.resolve(__dirname, '../bin/yida.js'), ...args], { cwd: dir, env, encoding: 'utf8' });
}

test('actual CLI generates only CSS despite invalid business/Plan files and has no document prerequisite', () => {
  for (const name of ['build-plan.json', 'fast-app.json', 'build-context.json']) {fs.writeFileSync(path.join(dir, name), '{"resources":[{"type":"form"}],"pages":null}');}
  const css = path.join(dir, 'app_theme.css');
  const result = cli(['sample', 'yida-app', 'fast-theme', '--style-id', 'app-platinum', '--primary-color', color, '--output', css, '--json']);
  expect(result.status).toBe(0);
  const json = JSON.parse(result.stdout);
  expect(json).toMatchObject({ outputs: { theme: css }, theme: { themeColor: color, navTheme: 'light' } });
  expect(fs.readdirSync(dir).sort()).toEqual(['app_theme.css', 'build-context.json', 'build-plan.json', 'fast-app.json']);
  expect(fs.readFileSync(css, 'utf8')).toContain(color);
  expect(fs.readFileSync(css, 'utf8')).not.toMatch(/\{\{PRIMARY_COLOR\}\}|<生成实际色值/);
});

test('theme generation does not load the Plan renderer or Fast business validator', () => {
  const result = execFileSync(process.execPath, ['-e', `
    require(${JSON.stringify(path.resolve(__dirname, '../lib/app/fast-theme'))}).prepareFastTheme({styleId:'app-platinum',primaryColor:'${color}',output:process.argv[1]});
    console.log(JSON.stringify(Object.keys(require.cache).filter(x=>/design-plan[/\\\\]materialize|design[/\\\\]fast-document|app[/\\\\]fast-build/.test(x))));
  `, path.join(dir, 'theme.css')], { encoding: 'utf8' });
  expect(JSON.parse(result)).toEqual([]);
});

test('generated stylesheet preserves paired template and authored selectors', () => {
  const output = path.join(dir, 'theme.css');
  prepareFastTheme({ styleId: 'app-platinum', primaryColor: color, output });
  const template = loadThemeIndex().themes.find(t => t.themeId === 'app-platinum');
  const parsed = parseDesignDocument(resolveThemeColors(fs.readFileSync(themeTemplatePath(template), 'utf8')));
  const tokens = extractDesignTokens(parsed.metadata, { strict: false });
  expect(fs.readFileSync(output, 'utf8')).toContain('--pod-nav-menu-item-radius');
  expect(fs.readFileSync(output, 'utf8')).toContain('--pod-page-content-max-width');
  expect(Object.keys(tokens).length).toBeGreaterThan(20);
  const source = require('../lib/design/fast-document').renderFastDocument({
    ...JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/samples/yida-design/fast-design.json'))), primaryColor: color,
  });
  expect(fs.readFileSync(output, 'utf8')).toBe(generateThemeCss(source.markdown));
});

test('dry-run does not write, unchanged CSS is reused and changed output is protected', () => {
  const output = path.join(dir, 'theme.css'), opts = { styleId: 'app-platinum', primaryColor: color, output };
  expect(prepareFastTheme({ ...opts, check: true }).checkedOnly).toBe(true); expect(fs.existsSync(output)).toBe(false);
  prepareFastTheme(opts); const before = fs.statSync(output).mtimeMs;
  prepareFastTheme(opts); expect(fs.statSync(output).mtimeMs).toBe(before);
  expect(() => prepareFastTheme({ ...opts, primaryColor: '#356B86' })).toThrow();
  expect(fs.statSync(output).mtimeMs).toBe(before);
});

test.each([
  ['--style-id', 'unknown', '--primary-color', color],
  ['--style-id', 'app-platinum', '--primary-color', 'broken'],
  ['--style-id', 'app-pop', '--primary-color', color],
  ['--style-id', 'app-platinum', '--primary-color', color, '--nav-theme', 'dark'],
])('theme failures always return structured local repair information: %j', (...args) => {
  const result = cli(['sample', 'yida-app', 'fast-theme', ...args]);
  expect(result.status).toBe(1);
  expect(JSON.parse(result.stderr)).toMatchObject({ success: false, errorCode: 'FAST_THEME_INVALID',
    details: { stage: 'preflight', mutationPerformed: false, issues: expect.any(Array) } });
  expect(fs.readdirSync(dir)).toEqual([]);
});

test('theme contrast is checked on final CSS without a full design/page contract', () => {
  const input = path.join(dir, 'theme.json'); fs.writeFileSync(input, JSON.stringify({ tokens: { '--color-text1-4': '#FFFFFF', '--pod-page-bg-color': '#FFFFFF' } }));
  const result = cli(['sample', 'yida-app', 'fast-theme', '--style-id', 'app-platinum', '--primary-color', color, '--tokens-file', input]);
  expect(result.status).toBe(1); expect(JSON.parse(result.stderr).errorCode).toBe('DESIGN_THEME_CONTRAST_LOW');
  expect(JSON.parse(result.stderr).errorMsg).toContain('app_theme.css');
  expect(JSON.parse(result.stderr).errorMsg).not.toMatch(/设计文档|Design validation/);
  expect(fs.readdirSync(dir)).toEqual(['theme.json']);
});

test('dedicated help explains immediate theme generation and legacy resource enums', () => {
  const theme = JSON.parse(cli(['sample', 'yida-app', 'fast-theme', '--help', '--json']).stdout);
  expect(theme.required).toEqual(['--style-id', '--primary-color']);
  const legacy = JSON.parse(cli(['sample', 'yida-app', 'fast-build', '--help']).stdout);
  expect(legacy.resourceTypes).toContain('normal-form'); expect(legacy.scope).toContain('never required before');
  expect(fs.readdirSync(dir)).toEqual([]);
});

test.each([[], ['--json']])('legacy errors expose all fixes without source inspection: %j', (...flags) => {
  const spec = JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/samples/yida-app/fast-app.json')));
  spec.resources = [{ key: 'one', name: '案例', type: 'form' }, { key: 'two', name: '留言', type: 'form' }];
  const input = path.join(dir, 'invalid.json'); fs.writeFileSync(input, JSON.stringify(spec));
  const result = cli(['sample', 'yida-app', 'fast-build', '--spec-file', input, ...flags]);
  const error = JSON.parse(result.stderr);
  expect(error.errorCode).toBe('FAST_BUILD_INVALID');
  expect(error.details.issues.map(x => x.path)).toEqual(['resources[0].type', 'resources[1].type']);
  expect(error.details.issues[0].expected).toContain('normal-form');
});

test('create-app accepts the common JSON flag without requiring a build spec', () => {
  expect(parseCreateAppArgs(['--name', '旅行官网', '--desc', '三个展示页面', '--json'])).toMatchObject({ appName: '旅行官网', description: '三个展示页面' });
});

test('manifest-only final checks keep exact resource, menu and theme readback without prebuild docs', async () => {
  const options = { appType: 'APP_TEST', manifestOnly: true, buildManifest: {
    resources: [{ name: '旅行官网', type: 'display-page', formUuid: 'FORM-TRAVEL', required: true }],
    applicationTheme: { themeColor: color, navTheme: 'light' },
    navigationVisibility: [{ name: '旅行官网', type: 'display-page', hidden: true, mobileHidden: true }],
  } };
  const form = { formUuid: 'FORM-TRAVEL', formName: '旅行官网', formType: 'display', hidden: true, mobileHidden: true };
  const app = { colour: 'custom', themeColor: color, navTheme: 'light', customThemeStyle: { enabled: true, cssUrl: 'https://example.test/theme.css' } };
  const evaluate = (forms, theme) => evaluatePrdCompleteness('', options, { fetchForms: jest.fn().mockResolvedValue(forms), fetchApp: jest.fn().mockResolvedValue(theme) });
  const result = await evaluate([form], app); expect(result.verdict).toBe('pass'); expect(result.sources.prd).toBeNull();
  expect((await evaluate([], app)).verdict).toBe('fail');
  expect((await evaluate([form], { ...app, themeColor: '#FF0000' })).verdict).toBe('fail');
  expect((await evaluate([{ ...form, hidden: false }], app)).verdict).toBe('fail');
  expect(parseArgs(['--manifest-only', '--build-manifest', 'facts.json', '--app-type', 'APP_TEST'], { strict: true })).toMatchObject({ manifestOnly: true, prdPath: '', buildManifestPath: 'facts.json' });
  expect(cli(['check-prd-completeness', '--manifest-only', '--app-type', 'APP_TEST']).status).toBe(1);
  expect(cli(['check-prd-completeness', 'prd.md', '--manifest-only', '--build-manifest', 'facts.json', '--app-type', 'APP_TEST']).status).toBe(1);
});


test('default Fast routes creation before independent theme work and keeps per-operation business checks', () => {
  const guide = fs.readFileSync(path.join(__dirname, '../yida-skills/skills/yida-app/workflow/fast-build.md'), 'utf8');
  expect(guide.indexOf('openyida create-app')).toBeLessThan(guide.indexOf('openyida sample yida-app fast-theme'));
  expect(guide.slice(0, guide.indexOf('openyida create-app'))).not.toContain('--spec-file');
  expect(guide).toContain('必要业务校验');
  expect(guide).toContain('默认不创建案例表、留言表');
  expect(guide).toContain('--manifest-only');
  expect(guide).toContain('Fast 唯一默认 workflow 入口');
  expect(guide).toContain('子技能明确要求的安全、实现和验收材料仍需读取');
  expect(guide).toContain('同批启动独立工作');
  expect(guide).toContain('只在消费该任务结果时等待');
  expect(guide).toContain('不得用宿主并发绕过串行边界');
  expect(guide).toContain('独占输出和完成标准');
  expect(guide).toContain('未知写入先回读');
  for (const relative of ['SKILL.md', 'skills/yida-app/SKILL.md', 'skills/yida-design/references/ask-human-interaction-contract.md']) {
    const fast = fs.readFileSync(path.join(__dirname, '../yida-skills', relative), 'utf8').split('**Fast 模式**')[1];
    expect(fast).toContain('2. 创建应用\n3. 设计功能和页面');
  }
  expect(cli(['create-app', '--help']).stderr).toContain('--json');
});


test('explicit free creative keeps a theme-only contract, not a business plan', () => {
  const input = path.join(dir, 'creative-theme.json');
  fs.writeFileSync(input, JSON.stringify({
    creativeDirection: { businessRationale: 'Travel service reading', composition: 'Clear service sections', typography: 'Readable system fonts', material: 'Light matte surfaces', formLayout: 'Single clear column' },
    tokens: { '--pod-page-bg-color': '#F8FAFC', '--pod-card-bg-color': '#FFFFFF', '--color-text1-4': '#172033',
      '--form-element-medium-corner': '8px', '--form-element-medium-height': '36px',
      '--pod-page-footer-bg-color': '#FFFFFF', '--pod-sticky-footer-box-shadow': 'none',
      '--oyd-content-width': '1120px', '--oyd-content-padding': '20px', '--oyd-field-gap': '16px',
      '--oyd-heading-font': 'system-ui', '--oyd-heading-size': '20px', '--oyd-rule-style': 'solid' },
  }));
  const result = prepareFastTheme({ styleId: 'free-creative', primaryColor: color, tokensFile: input, navTheme: 'light', output: path.join(dir, 'app_theme.css') });
  expect(result.theme).toEqual({ themeColor: color, navTheme: 'light' });
  expect(fs.readdirSync(dir).sort()).toEqual(['app_theme.css', 'creative-theme.json']);
});
