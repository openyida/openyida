'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadThemeIndex, DESIGN_SKILL_ROOT, resolveThemeColors } = require('../lib/design-plan/themes');
const { catalog } = require('../lib/design-plan/init');
const { materialize } = require('../lib/design-plan/materialize');
const { readDesignTokens, applyDesignTokens } = require('../lib/app/theme-from-design');
const { exportApplicationStyle, CREATIVE_TOKENS } = require('../lib/app/application-style');
const { validateThemeCssContent } = require('../lib/app/custom-theme');
const { parseDesignDocument } = require('../lib/design/document');
const sample = require('../lib/core/sample');
const form = require('../lib/app/create-form')._private;
const styles = loadThemeIndex().themes.filter(theme => theme.collection === 'application-styles' && theme.mode !== 'creative');
let directory;

beforeEach(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'oyd-app-style-')); });
afterEach(() => { fs.rmSync(directory, { recursive: true, force: true }); });

function planFor(themeId) {
  const plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/design-plan.json'), 'utf8'));
  plan.visualStyle.forUser.selectedTheme = { themeId, source: 'user_selected', templatePath: loadThemeIndex().themes.find(theme => theme.themeId === themeId).templatePath };
  plan.pages.customPageDetails[0].pageSpecHandoff = { designRefs: ['themeProfile'] };
  return plan;
}

test('catalog separates the creative option from eighteen application presets', () => {
  expect(styles).toHaveLength(18);
  expect(catalog().creativeOption).toMatchObject({ themeId: 'free-creative', mode: 'creative' });
  expect(catalog().themes.some(theme => theme.mode === 'creative')).toBe(false);
  const layouts = new Set(styles.map(theme => JSON.parse(fs.readFileSync(path.join(DESIGN_SKILL_ROOT, theme.formLayoutPath), 'utf8'))[0].layout));
  expect(layouts.size).toBeGreaterThanOrEqual(5);
});

test.each(styles.map(style => [style.themeId, style]))('%s pairs ship valid CSS and compile native layout without injected code', (_id, style) => {
  const css = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, style.cssTemplatePath), 'utf8');
  expect(() => validateThemeCssContent(css)).not.toThrow();
  expect(css.match(/OPENYIDA APPLICATION STYLE RECIPES START/g)).toHaveLength(1);
  const layout = JSON.parse(fs.readFileSync(path.join(DESIGN_SKILL_ROOT, style.formLayoutPath), 'utf8'));
  // Populate a real business field: decorative components are not data fields.
  layout[0].children[layout[0].children.length - 1].push({ type: 'TextField', label: '申请事由', required: true });
  expect(() => form.validateFormFieldDefinitions(layout)).not.toThrow();
  const node = form.buildFormNodeComponent(layout[0]);
  expect(node.componentName).toBe('ColumnsLayout');
  expect(node.props).toMatchObject({ columnGap: layout[0].columnGap, rowGap: layout[0].rowGap, display: 'VERTICAL' });
  expect(JSON.stringify(node)).not.toMatch(/didMount|createElement|<style|document\./);
});

test.each(styles.map(style => style.themeId))('%s survives Plan materialization and Fast regeneration', async themeId => {
  const input = path.join(directory, 'build-plan.json');
  fs.writeFileSync(input, JSON.stringify(planFor(themeId)));
  const result = materialize(input);
  const design = fs.readFileSync(result.outputs.design, 'utf8');
  expect(parseDesignDocument(design).metadata.applicationStyle).toEqual({ recipe: 'application-style-v1', mode: 'template' });
  const fastOutput = path.join(directory, 'fast.css');
  await sample.run(['yida-design', 'app-theme', '--design-file', result.outputs.design, '--output', fastOutput]);
  expect(fs.readFileSync(fastOutput, 'utf8')).toBe(fs.readFileSync(result.outputs.theme, 'utf8'));
  expect(design).toContain('原生结构与介绍区');
});

test('export writes all three assets and refuses to overwrite authored work', async () => {
  const result = await sample.run(['yida-design', 'application-style', '--style-id', 'app-executive', '--output', directory]);
  expect(result.outputs.map(file => path.basename(file))).toEqual(['design.md', 'app_theme.css', 'form-layout.json']);
  fs.writeFileSync(result.outputs[0], 'authored work');
  expect(() => exportApplicationStyle('app-paper', directory)).toThrow();
  expect(fs.readFileSync(result.outputs[0], 'utf8')).toBe('authored work');
  expect(() => exportApplicationStyle('../outside', directory)).toThrow();
  await expect(sample.run(['yida-design', 'application-style', '--style-id', 'app-wire', '--design-file', 'ignored.md']))
    .rejects.toMatchObject({ code: 'APPLICATION_STYLE_SAMPLE_INVALID' });
});

test('free creative rejects absent business decisions and explicit design tokens, then renders authored decisions', () => {
  const plan = planFor('free-creative');
  const input = path.join(directory, 'build-plan.json');
  fs.writeFileSync(input, JSON.stringify(plan));
  expect(() => materialize(input)).toThrow(/creativeDirection/);
  plan.visualStyle.creativeDirection = {
    businessRationale: '现场检查需要快速找到未完成事项，使用低干扰的工作面。',
    composition: '左侧窄目录、中央检查项、右侧证据摘要；抽屉合并为单列。',
    typography: '标题采用衬线，记录使用平台正文字体，编号按列对齐。',
    material: '暖灰画布、白色内容面、铜色细线，底栏使用相同纸面。',
    formLayout: '短字段双列、证据附件整行，字段间距24px，移动端单列。',
  };
  fs.writeFileSync(input, JSON.stringify(plan));
  expect(() => materialize(input)).toThrow(/--pod-page-bg-color/);
  const starter = readDesignTokens(resolveThemeColors(fs.readFileSync(path.join(DESIGN_SKILL_ROOT, 'templates/design-themes/free-creative/design.md'), 'utf8').replace(/\{\{PRIMARY_COLOR\}\}/g, '#685544')));
  plan.visualStyle.tokens = Object.fromEntries(CREATIVE_TOKENS.map(key => [key, starter[key]]));
  plan.visualStyle.tokens['--pod-page-bg-color'] = '#eee8df';
  fs.writeFileSync(input, JSON.stringify(plan));
  const result = materialize(input);
  const design = fs.readFileSync(result.outputs.design, 'utf8');
  expect(design).toContain(plan.visualStyle.creativeDirection.businessRationale);
  expect(design).toContain(plan.visualStyle.creativeDirection.formLayout);
  expect(design).not.toMatch(/窄幅纸页|香槟金标题/);
  expect(fs.readFileSync(result.outputs.theme, 'utf8')).toContain('--pod-page-bg-color: #eee8df;');
});

test('regeneration replaces only the managed recipe, preserving custom CSS', () => {
  const plan = planFor('app-editorial');
  const input = path.join(directory, 'build-plan.json');
  fs.writeFileSync(input, JSON.stringify(plan));
  const result = materialize(input);
  const design = fs.readFileSync(result.outputs.design, 'utf8');
  const css = fs.readFileSync(result.outputs.theme, 'utf8') + '\n.project-note { padding: 7px; }\n';
  const regenerated = applyDesignTokens(css, design, design);
  expect(regenerated).toContain('.project-note { padding: 7px; }');
  expect(regenerated.match(/OPENYIDA APPLICATION STYLE RECIPES START/g)).toHaveLength(1);
});
