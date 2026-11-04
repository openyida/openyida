'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { run } = require('../lib/core/sample');
const { renderDesign, prepareArtifacts, materialize } = require('../lib/design-plan/materialize');
const { generateThemeCss } = require('../lib/app/theme-source');
const { build, cssTemplate } = require('../scripts/build-application-styles');
const { DESIGN_SKILL_ROOT, loadThemeIndex } = require('../lib/design-plan/themes');
const { parseDesignDocument, serializeDesignDocument } = require('../lib/design/document');
const fixture = require('./fixtures/design-plan.json');
const { resolveThemeColors } = require('../lib/design-plan/themes');
const { topLevelRules } = require('../lib/app/theme-scope');
const rules = '\n.template-floating-rail { border-radius: 16px; box-shadow: 0 2px 8px #0003; }\n.template-divider::before { display: none; }\n';
const projectRule = '\n.project-help { padding: 17px; }\n';
let directory;

function planFor(themeId = 'soft-outline-rhythm') {
  const plan = JSON.parse(JSON.stringify(fixture));
  plan.visualStyle.forUser.selectedTheme = { themeId, templatePath: `templates/design-themes/${themeId}/design.md` };
  return plan;
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'oyd-theme-source-'));
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); fs.rmSync(directory, { recursive: true, force: true }); });

// Inject a template-only rule through the actual paired file read, without editing
// repository templates. Token-only generation would lose both selectors.
function withPairedRules() {
  const read = fs.readFileSync;
  const paired = path.join(DESIGN_SKILL_ROOT, 'templates/design-themes/soft-outline-rhythm/app_theme.css');
  jest.spyOn(fs, 'readFileSync').mockImplementation((file, ...args) => {
    const content = read(file, ...args);
    return String(file) === paired ? content + rules : content;
  });
}

test('Fast and Plan retain paired rules regardless of output filename, then preserve incremental edits', async () => {
  withPairedRules();
  const plan = planFor();
  const design = path.join(directory, 'design.md');
  const cssFile = path.join(directory, 'renamed.css');
  fs.writeFileSync(design, renderDesign(plan));
  const apply = () => run(['yida-design', 'app-theme', '--design-file', design, '--output', cssFile]);
  await apply();
  const first = fs.readFileSync(cssFile, 'utf8');
  expect(first).toContain(rules.trim());
  expect(first).not.toMatch(/\{\{|<生成实际色值：/);
  const artifacts = prepareArtifacts(plan, directory, undefined, { renderHtml: false });
  expect(artifacts.files.find(([file]) => file === artifacts.outputs.theme)[1]).toBe(first);
  fs.appendFileSync(cssFile, projectRule);
  plan.visualStyle.forUser.colorStrategy.primaryColor = '#245B57';
  fs.writeFileSync(design, renderDesign(plan));
  await apply();
  const updated = fs.readFileSync(cssFile, 'utf8');
  expect(updated).toContain('--color-brand1-6: #245B57;');
  expect(updated).toContain(rules.trim());
  expect(updated).toContain(projectRule.trim());
  await apply();
  expect(fs.readFileSync(cssFile, 'utf8')).toBe(updated);
});

test('Plan rematerialization retains template rules and local additions', () => {
  withPairedRules();
  const plan = planFor();
  const input = path.join(directory, 'build-plan.json');
  fs.writeFileSync(input, JSON.stringify(plan));
  const result = materialize(input);
  fs.appendFileSync(result.outputs.theme, projectRule);
  plan.visualStyle.forUser.colorStrategy.primaryColor = '#245B57';
  fs.writeFileSync(input, JSON.stringify(plan));
  materialize(input);
  const css = fs.readFileSync(result.outputs.theme, 'utf8');
  expect(css).toContain(rules.trim());
  expect(css).toContain(projectRule.trim());
  expect(css).toContain('--color-brand1-6: #245B57;');
  const previous = fs.readFileSync(input, 'utf8');
  fs.writeFileSync(input, JSON.stringify(planFor('hairline-soft-blocks')));
  expect(() => materialize(input)).toThrow(expect.objectContaining({ code: 'THEME_SOURCE_CONFLICT' }));
  expect(fs.readFileSync(result.outputs.theme, 'utf8')).toBe(css);
  fs.writeFileSync(input, previous);
});

test('theme switches fail without modifying CSS or snapshots, including after file rename', async () => {
  withPairedRules();
  const designFile = path.join(directory, 'design.md');
  const cssFile = path.join(directory, 'theme.css');
  fs.writeFileSync(designFile, renderDesign(planFor()));
  const apply = output => run(['yida-design', 'app-theme', '--design-file', designFile, '--output', output]);
  await apply(cssFile);
  const before = [cssFile, `${cssFile}.tokens.md`].map(file => fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(designFile, renderDesign(planFor('hairline-soft-blocks')));
  await expect(apply(cssFile)).rejects.toMatchObject({ code: 'THEME_SOURCE_CONFLICT' });
  expect([cssFile, `${cssFile}.tokens.md`].map(file => fs.readFileSync(file, 'utf8'))).toEqual(before);
  const moved = path.join(directory, 'moved.css');
  fs.renameSync(cssFile, moved);
  await expect(apply(moved)).rejects.toMatchObject({ code: 'THEME_SOURCE_CONFLICT' });
  await apply(cssFile);
  expect(fs.readFileSync(cssFile, 'utf8')).not.toContain('.template-floating-rail');
});

test('unknown sources fail closed; historical files remain compatible without claiming template provenance', () => {
  const document = parseDesignDocument(renderDesign(planFor()));
  document.metadata.themeProfile.sourceThemeId = 'not-a-theme';
  expect(() => generateThemeCss(serializeDesignDocument(document))).toThrow(expect.objectContaining({ code: 'APPLICATION_STYLE_UNKNOWN' }));
  delete document.metadata.themeProfile.sourceThemeId;
  const legacy = serializeDesignDocument(document);
  const css = generateThemeCss(legacy) + projectRule;
  expect(generateThemeCss(legacy, css, legacy)).toContain(projectRule.trim());
  expect(() => generateThemeCss(renderDesign(planFor()), css, legacy)).toThrow(expect.objectContaining({ code: 'THEME_SOURCE_CONFLICT' }));
});

test('creative starts from the shared skeleton even if its paired file has extra rules', () => {
  const document = parseDesignDocument(renderDesign(planFor()));
  document.metadata.themeProfile.sourceThemeId = 'free-creative';
  const read = fs.readFileSync;
  const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((file, ...args) => {
    if (String(file).endsWith('/free-creative/app_theme.css')) {throw new Error('Must use shared skeleton');}
    return read(file, ...args);
  });
  expect(generateThemeCss(serializeDesignDocument(document))).toContain('openyida-theme-source: free-creative');
  spy.mockRestore();
});

test('template-specific source rules survive rebuild and are exported in paired CSS', () => {
  const theme = loadThemeIndex().themes.find(item => item.themeId === 'soft-outline-rhythm');
  const designFile = path.join(directory, theme.templatePath);
  const cssFile = path.join(directory, theme.cssTemplatePath);
  fs.mkdirSync(path.dirname(designFile), { recursive: true });
  fs.copyFileSync(path.join(DESIGN_SKILL_ROOT, theme.templatePath), designFile);
  fs.writeFileSync(path.join(path.dirname(designFile), 'theme-rules.css'), rules);
  build({ root: directory, themes: [theme] });
  expect(fs.readFileSync(cssFile, 'utf8')).toContain(rules.trim());
  expect(build({ root: directory, themes: [theme], check: true })).toEqual([]);
  fs.writeFileSync(designFile, fs.readFileSync(designFile, 'utf8').replace(/("--pod-nav-menu-item-height": )"[^"]+"/, '$1"36px"'));
  build({ root: directory, themes: [theme] });
  expect(fs.readFileSync(cssFile, 'utf8')).toContain(rules.trim());
  // Editing design alone must not rewrite the independently authored CSS.
  expect(fs.readFileSync(cssFile, 'utf8')).not.toContain('--pod-nav-menu-item-height: 36px;');
});

test.each(loadThemeIndex().themes.filter(theme => theme.mode === 'template'))('$themeId preserves every authored selector on first and repeated generation', theme => {
  const source = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, theme.templatePath), 'utf8');
  const design = resolveThemeColors(source.replaceAll('{{PRIMARY_COLOR}}', '#245B57'));
  const paired = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, theme.cssTemplatePath), 'utf8');
  const css = generateThemeCss(design);
  const compiled = cssTemplate(source, '', paired);
  expect(compiled).toBe(paired);
  expect(cssTemplate(source, '', compiled)).toBe(compiled);
  const tokens = require('../lib/app/theme-from-design').readDesignTokens(design);
  const instantiated = paired.replace(/^([ \t]*)(--[\w-]+)(\s*:\s*)([^;\n]+);/gm,
    (line, indent, name, separator, value) => /\{\{|<生成实际色值：/.test(value)
      ? `${indent}${name}${separator}${tokens[name]};` : line);
  expect(css).toBe(`/* openyida-theme-source: ${theme.themeId} */\n${instantiated}`);
  const rules = topLevelRules(css);
  const compiledRules = topLevelRules(compiled);
  const canonical = value => value.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
  for (const rule of topLevelRules(paired).filter(rule => !rule.selector.split(',').map(x => x.trim()).includes(':root'))) {
    for (const output of [rules, compiledRules]) {
      expect(output.some(actual => canonical(actual.selector) === canonical(rule.selector) && canonical(actual.body) === canonical(rule.body))).toBe(true);
    }
  }
  expect(generateThemeCss(design, css + projectRule, design)).toContain(projectRule.trim());
  expect(generateThemeCss(design, css, design)).toBe(css);
});

test('the main picture rail survives legacy navigation markers and repeated compilation', () => {
  const theme = loadThemeIndex().themes.find(item => item.themeId === 'soft-inset-surfaces');
  const markdown = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, theme.templatePath), 'utf8');
  const paired = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, theme.cssTemplatePath), 'utf8');
  const design = resolveThemeColors(markdown.replaceAll('{{PRIMARY_COLOR}}', '#245B57'));
  const css = generateThemeCss(design);
  expect(css).toContain('/* openyida-navigation-shape:start */');
  expect(css.split('/* openyida-navigation-shape:start */')).toHaveLength(2);
  expect(cssTemplate(markdown, '', paired)).toBe(paired);
  expect(css).toContain('O1CN01YOwO9y84p7E1IZQm_');
  expect(css).toContain('border-radius: 16px;');
  expect(css).toContain('box-shadow: var(--shadow-3);');
  expect(css).toContain('background-color: #181c1f;');
});

// Upstream may intentionally rely on platform tokens or authored local scopes.
test('paired generation retains external variables, transparent surfaces and original gradients', () => {
  for (const id of ['inset-frame-pixel-rhythm', 'ink-glow-soft-panels', 'soft-inset-surfaces', 'soft-outline-rhythm']) {
    const theme = loadThemeIndex().themes.find(item => item.themeId === id);
    const design = resolveThemeColors(fs.readFileSync(path.join(DESIGN_SKILL_ROOT, theme.templatePath), 'utf8').replaceAll('{{PRIMARY_COLOR}}', '#245B57'));
    const css = generateThemeCss(design);
    if (id === 'inset-frame-pixel-rhythm') {
      expect(css).toContain('--pod-page-bg-color: radial-gradient(circle at 12% 0%, var(--oy-brand-soft), transparent 26%), var(--pod-page-bg-color);');
      expect(css).not.toContain('--oyd-page-bg-image:');
      expect(css).toContain('--pod-nav-menu-item-selected-shadow: var(--shadow-1);');
    }
    if (id === 'ink-glow-soft-panels') {expect(css).toContain('--oyd-page-bg: rgba(255, 255, 255, 0);');}
    if (['soft-inset-surfaces', 'soft-outline-rhythm'].includes(id)) {expect(css).not.toContain('--color-group:');}
  }
});
