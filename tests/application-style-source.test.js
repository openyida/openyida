'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { build, cssTemplate } = require('../scripts/build-application-styles');
const { loadThemeIndex, DESIGN_SKILL_ROOT, resolveThemeColors } = require('../lib/design-plan/themes');
const { renderDesign, materialize } = require('../lib/design-plan/materialize');
const { readDesignTokens, applyDesignTokens } = require('../lib/app/theme-from-design');
const { catalog } = require('../lib/design-plan/init');
const { exportApplicationStyle } = require('../lib/app/application-style');
const { validateThemeCssContent } = require('../lib/app/custom-theme');
const { parseDesignDocument, serializeDesignDocument } = require('../lib/design/document');
const { rootDeclarations } = require('../lib/core/theme-brand-scale');
const { auditPalette } = require('../lib/design/palette-contrast');
const { color, contrast } = require('../lib/design/icon-contrast');
const { topLevelRules } = require('../lib/app/theme-scope');
const fixture = require('./fixtures/design-plan.json');
const template = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, 'templates/design-themes/app-amber/design.md'), 'utf8');
const platformCss = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, 'references/theme/app-custom-theme-template.css'), 'utf8');

test.each(['#2C73A9', '#29E6FF', '#2F6B57'])('dark rail keeps dark navigation and white content with brand %s', primary => {
  const theme = loadThemeIndex().themes.find(item => item.themeId === 'dark-rail-fine-lines');
  const source = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, theme.templatePath), 'utf8');
  const design = resolveThemeColors(source.replaceAll('{{PRIMARY_COLOR}}', primary));
  const css = applyDesignTokens(fs.readFileSync(path.join(DESIGN_SKILL_ROOT, theme.cssTemplatePath), 'utf8'), design);
  const tokens = rootDeclarations(css.replace(/\/\*[\s\S]*?\*\//g, ''));
  const rgb = name => color(tokens[name], tokens);
  expect(rgb('--color-brand1-6')).toEqual(color(primary));
  expect(contrast(rgb('--pod-shell-theme-bg-color'), color('white'))).toBeGreaterThan(12);
  for (const name of ['--pod-page-bg-color', '--pod-card-bg-color', '--pod-page-header-bg-color', '--pod-shell-content-container-bg-color']) {
    expect(rgb(name)).toEqual(color('white'));
  }
  expect(auditPalette(tokens, { css })).toMatchObject({ issues: [], unresolved: [] });
  // Platform drawers also consume the shell token; their local scope must keep
  // the content surface white without changing the parent navigation palette.
  const content = topLevelRules(css).find(rule => rule.selector.includes('.yida-data-manage-drawer'));
  const local = { ...tokens, ...rootDeclarations(':root {' + content.body + '}') };
  expect(color(local['--pod-shell-theme-bg-color'], local)).toEqual(color('white'));
});

test('strict audit reports and blocks main palette findings without recoloring', () => {
  expect(() => build({ check: true })).toThrow(expect.objectContaining({ code: 'THEME_PALETTE_REVIEW_REQUIRED' }));
});

test.each(loadThemeIndex().themes)('$themeId resolves placeholders or preserves its complete default palette', theme => {
  const css = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, theme.cssTemplatePath), 'utf8');
  const seededCss = css.replaceAll('{{PRIMARY_COLOR}}', '#345B49');
  if (seededCss.includes('<生成实际色值：')) {
    expect(() => validateThemeCssContent(seededCss)).toThrow(expect.objectContaining({ code: 'THEME_CSS_UNRESOLVED_TOKEN' }));
  } else {
    expect(() => validateThemeCssContent(seededCss)).not.toThrow();
  }
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
    expect(parseDesignDocument(design).metadata.themeId).toBe(theme.themeId);
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


test('restored templates pass strict palette checks without rewriting their authored files', () => {
  const themes = loadThemeIndex().themes.filter(theme => ['dark-rail-fine-lines', 'app-pop', 'app-platinum', 'app-sage', 'app-teal', 'app-terminal'].includes(theme.themeId));
  const files = themes.flatMap(theme => [theme.templatePath, theme.cssTemplatePath, theme.formLayoutPath]);
  const before = files.map(file => fs.readFileSync(path.join(DESIGN_SKILL_ROOT, file), 'utf8'));
  expect(build({ check: true, themes })).toEqual([]);
  expect(files.map(file => fs.readFileSync(path.join(DESIGN_SKILL_ROOT, file), 'utf8'))).toEqual(before);
});

test('Plan inherits the selected template icon rules unless the project supplies its own', () => {
  const plan = JSON.parse(JSON.stringify(fixture));
  const theme = loadThemeIndex().themes.find(item => item.themeId === 'app-platinum');
  plan.visualStyle.forUser.selectedTheme = { themeId: theme.themeId, source: 'user_selected', templatePath: theme.templatePath };
  plan.visualStyle.forUser.colorStrategy.primaryColor = '#897253';
  delete plan.visualStyle.forUser.iconSystem;
  const template = parseDesignDocument(fs.readFileSync(path.join(DESIGN_SKILL_ROOT, theme.templatePath), 'utf8'));
  expect(parseDesignDocument(renderDesign(plan, { draft: true })).metadata.iconSystem).toEqual(template.metadata.iconSystem);
  plan.visualStyle.forUser.iconSystem = { library: 'lucide-react', mappings: { orders: 'Package' } };
  expect(parseDesignDocument(renderDesign(plan, { draft: true })).metadata.iconSystem).toEqual(plan.visualStyle.forUser.iconSystem);
});


test.each([true, false])('a partial design keeps CSS colors and rejects an incomplete final stylesheet (paired=%s)', paired => {
  const theme = loadThemeIndex().themes.find(item => item.themeId === 'app-platinum');
  const css = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, theme.cssTemplatePath), 'utf8');
  const design = '---\nnavTheme: light\ntokens:\n  "--color-brand1-6": "#897253"\n  "--pod-card-border-radius": "8px"\n---\n';
  expect(readDesignTokens(design)).toEqual({ '--color-brand1-6': '#897253', '--pod-card-border-radius': '8px' });
  const result = applyDesignTokens(css, design, undefined, { paired });
  expect(result).toContain('--color-brand1-9: #755E41;');
  expect(result).toContain('--pod-card-border-radius: 8px;');
  expect(() => validateThemeCssContent(result)).not.toThrow();
  const incomplete = css.replace(/^.*--color-brand1-9:.*\n/gm, '');
  expect(() => applyDesignTokens(incomplete, design, undefined, { paired }))
    .toThrow(expect.objectContaining({ code: 'THEME_BRAND_SCALE_INCOMPLETE' }));
});

test('Plan accepts an independently authored brand slot without recoloring other slots', () => {
  const plan = JSON.parse(JSON.stringify(fixture));
  const theme = loadThemeIndex().themes.find(item => item.themeId === 'app-platinum');
  plan.visualStyle.forUser.selectedTheme = { themeId: theme.themeId, source: 'user_selected', templatePath: theme.templatePath };
  plan.visualStyle.forUser.colorStrategy.primaryColor = '#897253';
  plan.visualStyle.tokens = { '--color-brand1-1': '#765F40' };
  const design = renderDesign(plan, { draft: true });
  expect(readDesignTokens(design)).toMatchObject({ '--color-brand1-1': '#765F40', '--color-brand1-6': '#897253', '--color-brand1-9': '#755E41' });
  const paired = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, theme.cssTemplatePath), 'utf8');
  const css = applyDesignTokens(paired, design, undefined, { paired: true });
  expect(css).toContain('--color-brand1-1: #765F40;');
  expect(css).toContain('--color-brand1-9: #755E41;');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'oyd-independent-palette-'));
  try {
    const file = path.join(directory, 'build-plan.json');
    fs.writeFileSync(file, JSON.stringify(plan));
    const output = materialize(file);
    const generated = fs.readFileSync(output.outputs.theme, 'utf8');
    expect(generated).toContain('--color-brand1-1: #765F40;');
    expect(generated).toContain('--color-brand1-9: #755E41;');
  } finally {fs.rmSync(directory, { recursive: true, force: true });}

});
