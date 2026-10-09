'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { build, cssTemplate } = require('../scripts/build-application-styles');
const { loadThemeIndex, DESIGN_SKILL_ROOT, resolveThemeColors } = require('../lib/design-plan/themes');
const { renderDesign } = require('../lib/design-plan/materialize');
const { readDesignTokens, applyDesignTokens } = require('../lib/app/theme-from-design');
const { catalog } = require('../lib/design-plan/init');
const { exportApplicationStyle } = require('../lib/app/application-style');
const { validateThemeCssContent } = require('../lib/app/custom-theme');
const { parseDesignDocument, serializeDesignDocument } = require('../lib/design/document');
const fixture = require('./fixtures/design-plan.json');
const template = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, 'templates/design-themes/app-amber/design.md'), 'utf8');
const platformCss = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, 'references/theme/app-custom-theme-template.css'), 'utf8');

test('all bundled styles compile from their own complete design without another palette source', () => {
  expect(build({ check: true })).toEqual([]);
});

test.each(loadThemeIndex().themes)('$themeId rejects primary-only replacement and generates all usable color slots', theme => {
  const css = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, theme.cssTemplatePath), 'utf8');
  expect(() => validateThemeCssContent(css.replaceAll('{{PRIMARY_COLOR}}', '#345B49')))
    .toThrow(expect.objectContaining({ code: 'THEME_CSS_UNRESOLVED_TOKEN' }));
  const source = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, theme.templatePath), 'utf8');
  const creative = theme.mode === 'creative' ? '\ncreativeDirection:\n  businessRationale: Daily operations\n  composition: Single workspace\n  typography: Clear labels\n  material: Flat surfaces\n  formLayout: Single column\n' : '';
  const design = resolveThemeColors(source.replaceAll('{{PRIMARY_COLOR}}', '#345B49').replace(/\n---\n/, creative + '\n---\n'));
  const resolved = applyDesignTokens(css, design);
  expect(() => validateThemeCssContent(resolved)).not.toThrow();
  expect(resolved).not.toMatch(/\{\{|<生成实际色值：/);
});

test('the CLI catalog covers indexed themes while unlisted bundles remain on disk', () => {
  const { themes, creativeOption } = catalog();
  const all = [...themes, creativeOption];
  const directories = fs.readdirSync(path.join(DESIGN_SKILL_ROOT, 'templates/design-themes'), { withFileTypes: true })
    .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  expect(all.map(theme => theme.themeId).sort()).toEqual(loadThemeIndex().themes.map(theme => theme.themeId).sort());
  expect(directories).toEqual(expect.arrayContaining(all.map(theme => theme.themeId)));
  expect(directories.filter(id => id.startsWith('app-'))).toHaveLength(18);
  expect(all.every(theme => !theme.themeId.startsWith('nav-'))).toBe(true);
  for (const name of ['navigation-styles.json', 'application-styles.json']) {
    expect(fs.existsSync(path.join(DESIGN_SKILL_ROOT, 'templates', name))).toBe(false);
  }
});

test.each(loadThemeIndex().themes)('$themeId exports the complete authored design, CSS and form layout', theme => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oyd-complete-theme-'));
  try {
    const result = exportApplicationStyle(theme.themeId, root);
    expect(result.themeId).toBe(theme.themeId);
    for (const [name, source] of [['design.md', theme.templatePath], ['app_theme.css', theme.cssTemplatePath], ['form-layout.json', theme.formLayoutPath]]) {
      expect(fs.readFileSync(path.join(root, name), 'utf8')).toBe(fs.readFileSync(path.join(DESIGN_SKILL_ROOT, source), 'utf8'));
    }
    const design = fs.readFileSync(path.join(root, 'design.md'), 'utf8');
    expect(design).toContain('导航外观属于这份完整应用主题');
    const tokens = readDesignTokens(resolveThemeColors(design.replaceAll('{{PRIMARY_COLOR}}', '#C2410C')));
    for (const name of ['--pod-shell-theme-bg-color', '--pod-nav-menu-item-radius', '--pod-page-bg-color', '--input-bg-color', '--pod-field-preview-bg-color']) {
      expect(tokens[name]).toEqual(expect.any(String));
    }
    expect(Object.keys(tokens).some(name => name.startsWith('--oyd-'))).toBe(true);
  } finally {fs.rmSync(root, { recursive: true, force: true });}
});

test('editing one complete template updates all consumers without rewriting design or layout', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oyd-style-source-'));
  const theme = { themeId: 'app-amber', templatePath: 'templates/design-themes/app-amber/design.md', cssTemplatePath: 'templates/design-themes/app-amber/app_theme.css', formLayoutPath: 'templates/design-themes/app-amber/form-layout.json' };
  const designFile = path.join(root, theme.templatePath);
  const cssFile = path.join(root, theme.cssTemplatePath);
  const layoutFile = path.join(root, theme.formLayoutPath);
  fs.mkdirSync(path.dirname(designFile), { recursive: true });
  // Deliberately use complementary colors: coherence is authored, not a hue test.
  const document = parseDesignDocument(template);
  const global = document.metadata.tokens['application-global'];
  Object.assign(global.appearance.navigation, {
    '--pod-shell-theme-bg-color': '#EDF4F2',
    '--pod-nav-menu-bg-selected-color': '#245B57',
    '--pod-nav-item-text-selected-color': '#FFFFFF',
    '--pod-nav-menu-item-radius': '12px',
    '--pod-nav-menu-item-selected-shadow': 'inset 3px 0 0 #C2410C',
  });
  Object.assign(global.appearance['native-form'], {
    '--input-bg-color': '#FCFAF5',
    '--pod-field-preview-bg-color': '#FCFAF5',
  });
  global.appearance.surfaces['--pod-card-bg-color'] = '#FCFAF5';
  global.colors['--color-text1-4'] = '#343C3A';
  document.body += '\n项目说明：橙红操作与低饱和青绿导航，页面与详情使用暖白表面。\n';
  const edited = serializeDesignDocument(document);
  fs.writeFileSync(designFile, edited);
  fs.writeFileSync(layoutFile, '[{"type":"Divider","title":"项目专属布局"}]\n');
  const layout = fs.readFileSync(layoutFile, 'utf8');
  try {
    expect(() => build({ root, themes: [theme], check: true })).toThrow('out of date');
    expect(fs.existsSync(cssFile)).toBe(false);
    expect(build({ root, themes: [theme] })).toEqual([cssFile]);
    const css = fs.readFileSync(cssFile, 'utf8');
    expect(css).toContain('--pod-shell-theme-bg-color: #EDF4F2;');
    expect(css).toContain('--pod-nav-menu-bg-selected-color: #245B57;');
    expect(css).toContain('--pod-nav-menu-item-radius: 12px;');
    expect(css).toContain('--pod-nav-menu-item-selected-shadow: inset 3px 0 0 #C2410C;');
    expect(css).toContain('--input-bg-color: #FCFAF5;');
    expect(css).toContain('--pod-field-preview-bg-color: #FCFAF5;');
    expect(css).toContain('--pod-card-bg-color: #FCFAF5;');
    expect(css).toContain('--oyd-surface: var(--pod-card-bg-color);');
    expect(css).toContain('--oyd-ink: var(--color-text1-4);');
    expect(fs.readFileSync(designFile, 'utf8')).toBe(edited);
    expect(fs.readFileSync(layoutFile, 'utf8')).toBe(layout);
    expect(build({ root, themes: [theme], check: true })).toEqual([]);
  } finally {fs.rmSync(root, { recursive: true, force: true });}
});

test('the temporary compiler brand seed cannot capture independently authored colors', () => {
  const document = parseDesignDocument(template);
  Object.assign(document.metadata.tokens['application-global'].appearance.navigation, {
    '--pod-nav-menu-bg-selected-color': '#2C73A9',
    '--pod-nav-item-text-selected-color': '#FFFFFF',
    '--pod-nav-menu-item-hover-border': '1px solid #2C73A9',
  });
  const edited = serializeDesignDocument(document);
  const css = cssTemplate(edited);
  expect(css).toContain('--pod-nav-menu-bg-selected-color: #2C73A9;');
  expect(css).toContain('--pod-nav-menu-item-hover-border: 1px solid #2C73A9;');
  expect(css).toContain('--color-brand1-6: {{PRIMARY_COLOR}};');
  expect(css).toContain('--color-brand-3: var(--color-brand1-6);');
});

test('changing the primary updates explicit references but preserves independent identical colors', () => {
  const input = JSON.parse(JSON.stringify(fixture));
  input.visualStyle.forUser.selectedTheme = { themeId: 'soft-inset-surfaces', templatePath: 'templates/design-themes/soft-inset-surfaces/design.md' };
  input.visualStyle.forUser.colorStrategy.primaryColor = '#C2410C';
  input.visualStyle.tokens = {
    '--pod-nav-menu-bg-selected-color': '#C2410C',
    '--pod-nav-menu-item-hover-border': '2px solid #C2410C',
    '--pod-nav-menu-item-selected-shadow': 'inset 3px 0 0 #C2410C',
    '--pod-page-bg-color': '#C2410C',
    '--input-bg-color': '#C2410C',
    '--pod-field-preview-bg-color': '#C2410C',
    '--oyd-accent': '#C2410C',
    '--oyd-linked-accent': 'var(--color-brand1-6)',
  };
  const before = renderDesign(input);
  const previousCss = applyDesignTokens(platformCss, before);
  input.visualStyle.forUser.colorStrategy.primaryColor = '#245B57';
  const after = renderDesign(input);
  const css = applyDesignTokens(previousCss, after, before);
  expect(readDesignTokens(after)).toMatchObject(input.visualStyle.tokens);
  for (const [name, value] of Object.entries(input.visualStyle.tokens)) {
    expect(css).toContain(`${name}: ${value};`);
  }
  // Check the active navigation override, where a global color substitution used
  // to silently replace a value even though its own token had not changed.
  const light = css.match(/^:root\s*\{([^}]+)\}/m)[1];
  expect(light).toContain('--pod-nav-menu-bg-selected-color: #C2410C;');
  expect(css).toContain('--color-brand1-6: #245B57;');
  expect(applyDesignTokens(css, after, after)).toBe(css);
});
