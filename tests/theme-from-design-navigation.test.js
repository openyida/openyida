'use strict';

const fs = require('fs');
const path = require('path');
const { applyDesignTokens, readDesignTokens } = require('../lib/app/theme-from-design');
const { parseDesignDocument } = require('../lib/design/document');
const { renderDesign } = require('../lib/design-plan/materialize');
const { validateThemeCssContent } = require('../lib/app/custom-theme');
const fixture = require('./fixtures/design-plan.json');
const template = fs.readFileSync(path.join(__dirname,
  '../yida-skills/skills/yida-design/references/theme/app-custom-theme-template.css'), 'utf8');
const navigationColorNames = [
  '--pod-shell-theme-bg-color', '--pod-nav-item-text-color', '--pod-nav-item-text-hover-color',
  '--pod-nav-item-text-selected-color', '--pod-nav-menu-bg-hover-color', '--pod-nav-menu-bg-selected-color',
];

const themeTones = {
  'soft-inset-surfaces': 'light',
  'dark-inset-hairline': 'dark',
  'dark-rail-fine-lines': 'dark',
};

const selectedShadowToken = '--pod-nav-menu-item-selected-shadow';

function design(themeId, primaryColor = '#6F4E37', requestedTone) {
  const plan = JSON.parse(JSON.stringify(fixture));
  plan.visualStyle.forUser.selectedTheme = { themeId, templatePath: `templates/design-themes/${themeId}/design.md` };
  // A stale caller-provided value must not override the selected template.
  plan.visualStyle.forUser.navigationStyle.tone = requestedTone || (themeTones[themeId] === 'dark' ? 'light' : 'dark');
  plan.visualStyle.forUser.colorStrategy.primaryColor = primaryColor;
  return renderDesign(plan);
}

// Resolve the public template's root inheritance and equal-specificity mode
// rules in source order, including its second :root.
function cascade(css, navigation, tone = navigation) {
  validateThemeCssContent(css);
  const values = {};
  const blocks = [...css.matchAll(/(^:root|^\.pod-premium\.(?:nav|is)-(?:light|dark|white|gray))\s*\{([^}]*)\}/gm)];
  for (const [, , body] of blocks.filter(match => match[1] === ':root')) {
    Object.assign(values, Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(match => [match[1], match[2].trim()])));
  }
  for (const [, selector, body] of blocks) {
    if (![`.pod-premium.nav-${navigation}`, `.pod-premium.is-${tone}`].includes(selector)) {continue;}
    Object.assign(values, Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(match => [match[1], match[2].trim()])));
  }
  return values;
}

test.each([
  ['soft-inset-surfaces', 'light'],
  ['dark-inset-hairline', 'dark'],
])('%s derives %s mode and applies all six navigation colors through every CSS override', (themeId, tone) => {
  const markdown = design(themeId);
  const tokens = readDesignTokens(markdown);
  const css = applyDesignTokens(template, markdown);
  const active = cascade(css, tone);
  for (const name of navigationColorNames) {expect(active[name]).toBe(tokens[name]);}
  expect(active['--pod-page-header-bg-color']).toBe(tokens['--pod-page-header-bg-color'] || tokens['--pod-shell-theme-bg-color']);
  const other = tone === 'dark' ? 'light' : 'dark';
  const inactive = cascade(css, other);
  const defaults = cascade(template, other);
  for (const name of navigationColorNames) {expect(inactive[name]).toBe(defaults[name]);}
  for (const mode of ['white', 'gray']) {
    for (const name of ['--pod-shell-theme-bg-color', '--pod-page-header-bg-color']) {
      expect(cascade(css, mode, 'light')[name]).toBe(cascade(template, mode, 'light')[name]);
    }
  }
  expect(applyDesignTokens(css, markdown)).toBe(css);
  expect(applyDesignTokens(css, markdown, markdown)).toBe(css);
});

test.each(['soft-inset-surfaces', 'dark-inset-hairline'])('%s preserves template navigation and content despite stale caller tone', themeId => {
  const lightNavigation = design(themeId, '#6F4E37', 'light');
  const darkNavigation = design(themeId, '#6F4E37', 'dark');
  const lightMetadata = parseDesignDocument(lightNavigation).metadata;
  const darkMetadata = parseDesignDocument(darkNavigation).metadata;
  const contentNames = [
    '--pod-app-root-bg-color', '--pod-page-bg-color', '--pod-card-bg-color',
    '--color-text1-4', '--color-fill1-1', '--color-fill1-5',
  ];
  expect(lightMetadata.themeProfile.contentTone).toBe(darkMetadata.themeProfile.contentTone);
  expect(lightMetadata.themeProfile.navTheme).toBe(themeTones[themeId]);
  expect(darkMetadata.themeProfile.navTheme).toBe(themeTones[themeId]);
  const lightTokens = readDesignTokens(lightNavigation);
  const darkTokens = readDesignTokens(darkNavigation);
  for (const name of contentNames) {expect(lightTokens[name]).toBe(darkTokens[name]);}
  for (const name of navigationColorNames) {expect(lightTokens[name]).toBe(darkTokens[name]);}
});

test.each(['light', 'dark'])('Fast documents infer %s navigation from their shell without Plan metadata', tone => {
  const theme = tone === 'dark' ? 'dark-inset-hairline' : 'soft-inset-surfaces';
  const markdown = design(theme).replace(/^themeProfile:.*\n/m, '');
  const css = applyDesignTokens(template, markdown);
  const active = cascade(css, tone);
  const tokens = readDesignTokens(markdown);
  for (const name of navigationColorNames) {expect(active[name]).toBe(tokens[name]);}
});

test('changing the selected mode resets its previous mode and preserves unrelated custom CSS', () => {
  const previous = design('soft-inset-surfaces');
  const next = design('dark-inset-hairline');
  const custom = '\n.local-detail { padding: 7px; }\n';
  const css = applyDesignTokens(applyDesignTokens(template, previous) + custom, next, previous);
  for (const name of navigationColorNames) {
    expect(cascade(css, 'dark')[name]).toBe(readDesignTokens(next)[name]);
    expect(cascade(css, 'light')[name]).toBe(cascade(template, 'light')[name]);
  }
  expect(css).toContain(custom);
  expect(applyDesignTokens(css, next, next)).toBe(css);
});

test('delta updates preserve hand-edited unchanged navigation colors and page styles', () => {
  const previous = design('soft-inset-surfaces');
  const next = design('soft-inset-surfaces', '#315BCC');
  const original = applyDesignTokens(template, previous);
  const customized = original.replaceAll(`--pod-nav-item-text-color: ${readDesignTokens(previous)['--pod-nav-item-text-color']};`, '--pod-nav-item-text-color: #ABCDEF;')
    .replace('--corner-2: 8px;', '--corner-2: 11px;') + '\n.local-detail { padding: 7px; }\n';
  const changed = applyDesignTokens(customized, next, previous);
  expect(cascade(changed, 'light')['--pod-nav-item-text-color']).toBe('#ABCDEF');
  expect(cascade(changed, 'light')['--pod-shell-theme-bg-color']).toBe(readDesignTokens(next)['--pod-shell-theme-bg-color']);
  expect(changed).toContain('--corner-2: 11px;');
  expect(changed).toContain('.local-detail { padding: 7px; }');
  expect(applyDesignTokens(changed, next, next)).toBe(changed);
});

test('extended navigation tokens survive root and mode overrides, preserve inactive defaults and update incrementally', () => {
  const previous = design('soft-inset-surfaces');
  const authored = {
    '--pod-page-header-bg-color': '#F5EAD4', '--pod-page-header-text-color': '#223344', '--pod-nav-search-text-color': '#493C20',
    '--pod-nav-popup-bg-color': '#FFF4DF', '--pod-nav-logo-text': '#483818',
    '--pod-nav-menu-item-height': '43px', '--pod-nav-menu-item-radius': '17px',
  };
  const withTokens = (markdown, values) => {
    const metadata = parseDesignDocument(markdown).metadata;
    Object.assign(metadata.tokens['application-global'].appearance.navigation, values);
    return `---\n${Object.entries(metadata).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n${markdown.split(/\n---\n/).slice(1).join('\n---\n')}`;
  };
  const next = withTokens(previous, authored);
  const css = applyDesignTokens(template, next);
  for (const [name, value] of Object.entries(authored)) {
    expect(cascade(css, 'light')[name]).toBe(value);
    expect(cascade(css, 'dark')[name]).toBe(cascade(template, 'dark')[name]);
  }
  const changed = withTokens(next, { '--pod-nav-popup-bg-color': '#FFECCA' });
  const customized = css.replaceAll('--pod-nav-search-text-color: #493C20;', '--pod-nav-search-text-color: #AABBCC;');
  const result = applyDesignTokens(customized, changed, next);
  expect(cascade(result, 'light')['--pod-nav-popup-bg-color']).toBe('#FFECCA');
  expect(cascade(result, 'light')['--pod-nav-search-text-color']).toBe('#AABBCC');
  expect(result).not.toContain(': undefined;');
});

test('mode metadata changes take effect even when token values are unchanged', () => {
  const previous = design('soft-inset-surfaces');
  const next = previous.replace('"navTheme":"light"', '"navTheme":"dark"');
  const css = applyDesignTokens(applyDesignTokens(template, previous), next, previous);
  const tokens = readDesignTokens(next);
  for (const name of navigationColorNames) {expect(cascade(css, 'dark')[name]).toBe(tokens[name]);}
});

test('theme-selected navigation shadow flows into CSS and resets to none', () => {
  const previous = design('dark-rail-fine-lines');
  const previousCss = applyDesignTokens(template, previous);
  expect(readDesignTokens(previous)[selectedShadowToken]).toBe('inset 3px 0 0 var(--color-brand1-6)');
  expect(cascade(previousCss, 'dark')[selectedShadowToken]).toBe('inset 3px 0 0 var(--color-brand1-6)');
  expect(previousCss).toContain('box-shadow: var(--pod-nav-menu-item-selected-shadow, none);');
  for (const mode of ['light', 'dark', 'white', 'gray']) {
    expect(cascade(previousCss, mode)[selectedShadowToken]).toBe('inset 3px 0 0 var(--color-brand1-6)');
  }

  const next = design('soft-inset-surfaces');
  const nextCss = applyDesignTokens(previousCss, next, previous);
  expect(readDesignTokens(next)[selectedShadowToken]).toBe('none');
  expect(cascade(nextCss, 'light')[selectedShadowToken]).toBe('none');
});

test('older generated CSS gains menu shape consumers once and keeps project rules', () => {
  const previous = design('dark-rail-fine-lines');
  const oldCss = applyDesignTokens(template, previous)
    .replace(/\/\* openyida-navigation-shape:start \*\/[\s\S]*?\/\* openyida-navigation-shape:end \*\//, '')
    + '\n.project-only { border: 7px dotted red; }';
  const next = design('app-ticket');
  const css = applyDesignTokens(oldCss, next, previous);
  expect(cascade(css, 'light')['--pod-nav-menu-item-selected-border']).toBe('5px double #542B1B');
  expect(css).toContain('.deep-shell-nav-tab-list .next-nav-item.next-selected');
  expect(css).toContain('border-radius: var(--pod-nav-menu-item-radius, 8px);');
  expect(css).toContain('.project-only { border: 7px dotted red; }');
  const repeated = applyDesignTokens(css, next, next);
  expect(repeated.match(/openyida-navigation-shape:start/g)).toHaveLength(1);
  expect(repeated).toBe(css);
});

test.each([
  ['app-pop', 'light', '0px', '3px solid #211C21', '5px 5px 0 #F07098', '16px'],
  ['app-nordic', 'light', '999px', '2px solid #355D4D', '0 5px 12px rgba(42,74,60,.16)', '14px'],
  ['app-ticket', 'light', '0px', '5px double #542B1B', '4px 4px 0 #9D714C', '14px'],
  ['app-terminal', 'dark', '0px', '1px dashed #9FE5AD', 'inset 5px 0 0 #9FE5AD, inset -5px 0 0 #9FE5AD', '4px'],
])('%s retains the verified case shape in Plan, bundled CSS and Fast generation', (id, tone, radius, border, shadow, gap) => {
  const markdown = design(id);
  const expected = {
    '--pod-nav-menu-item-radius': radius,
    '--pod-nav-menu-item-selected-border': border,
    '--pod-nav-menu-item-selected-shadow': shadow,
    '--pod-nav-menu-gap': gap,
  };
  expect(readDesignTokens(markdown)).toMatchObject(expected);
  const bundle = fs.readFileSync(path.join(__dirname, `../yida-skills/skills/yida-design/templates/design-themes/${id}/app_theme.css`), 'utf8');
  // Placeholders are authoring values, not CSS block delimiters.
  expect(cascade(bundle.replace(/\{\{PRIMARY_COLOR\}\}/g, '#6F4E37'), tone)).toMatchObject(expected);
  expect(cascade(applyDesignTokens(template, markdown), tone)).toMatchObject(expected);
  expect(cascade(applyDesignTokens(bundle, markdown), tone)).toMatchObject(expected);
  expect(markdown).toContain(`| 选中边框 | --pod-nav-menu-item-selected-border | ${border} |`);
});

test('project overrides replace case measurements in the navigation prose and generated CSS', () => {
  const plan = JSON.parse(JSON.stringify(fixture));
  plan.visualStyle.forUser.selectedTheme = { themeId: 'app-nordic', templatePath: 'templates/design-themes/app-nordic/design.md' };
  plan.visualStyle.tokens = {
    '--pod-nav-menu-item-radius': '12px', '--pod-nav-menu-item-selected-border': '2px solid #123456',
    '--pod-nav-menu-item-height': '48px', '--pod-nav-menu-item-padding': '10px 16px',
    '--pod-nav-menu-item-selected-shadow': 'none',
  };
  const markdown = renderDesign(plan);
  const section = markdown.split('### 2.2 应用导航')[1].split('### 2.3 ')[0];
  expect(section).toContain('| 菜单圆角 | --pod-nav-menu-item-radius | 12px |');
  expect(section).toContain('| 菜单内距 | --pod-nav-menu-item-padding | 10px 16px |');
  expect(section).toContain('| 选中项阴影 | --pod-nav-menu-item-selected-shadow | none |');
  expect(section).not.toMatch(/999px|52px|导航示例：/);
  expect(cascade(applyDesignTokens(template, markdown), 'light')).toMatchObject(plan.visualStyle.tokens);
});
