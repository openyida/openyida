'use strict';

const fs = require('fs');
const path = require('path');
const { applyDesignTokens, readDesignTokens } = require('../lib/app/theme-from-design');
const { parseDesignDocument } = require('../lib/design/document');
const { renderDesign } = require('../lib/design-plan/materialize');
const { resolveThemeColors } = require('../lib/design-plan/themes');
const { validateThemeCssContent } = require('../lib/app/custom-theme');
const { topLevelRules, THEME_SELECTORS } = require('../lib/app/theme-scope');
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

// Model root inheritance followed by matching platform scopes in source order.
function cascade(css, navigation, tone = navigation) {
  validateThemeCssContent(css);
  const values = {};
  const rules = topLevelRules(css);
  const read = rule => Object.assign(values, Object.fromEntries([...rule.body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)]
    .map(match => [match[1], match[2].trim()])));
  rules.filter(rule => rule.selector.split(',').map(x => x.trim()).includes(':root')).forEach(read);
  rules.filter(rule => rule.selector.split(',').map(x => x.trim())
    .some(selector => [`.pod-premium.nav-${navigation}`, `.pod-premium.is-${tone}`].includes(selector))).forEach(read);
  return values;
}

function navigationOverrides(overrides, tone = 'light') {
  const metadata = parseDesignDocument(design('soft-inset-surfaces')).metadata;
  metadata.themeProfile.navTheme = tone;
  metadata.tokens['application-global'].appearance.navigation = overrides;
  return `---\n${JSON.stringify(metadata)}\n---\n`;
}

test.each(['light', 'dark'])('a single %s navigation override leaves platform bindings intact', tone => {
  const markdown = navigationOverrides({ '--pod-nav-menu-item-radius': '19px' }, tone);
  const css = applyDesignTokens(template, markdown);
  const defaults = cascade(template, tone);
  const active = cascade(css, tone);
  expect(active['--pod-nav-menu-item-radius']).toBe('19px');
  for (const name of ['--pod-nav-search-text-color', '--pod-nav-search-border-active-color', '--pod-nav-logo-bg', '--pod-page-header-bg-color', ...navigationColorNames]) {
    expect(active[name]).toBe(defaults[name]);
  }
  expect(css).not.toContain(': undefined;');
});

test('removing authored navigation overrides restores platform references and default shapes', () => {
  const previous = navigationOverrides({
    '--pod-nav-search-text-color': '#765432', '--pod-nav-logo-bg': '#234567',
    '--pod-nav-menu-item-selected-shadow': 'inset 4px 0 0 #234567',
    '--pod-nav-menu-item-hover-border': '2px dotted #234567',
  });
  const next = navigationOverrides({});
  const css = applyDesignTokens(applyDesignTokens(template, previous), next, previous);
  const defaults = cascade(template, 'light');
  for (const name of Object.keys(parseDesignDocument(previous).metadata.tokens['application-global'].appearance.navigation)) {
    expect(cascade(css, 'light')[name]).toBe(defaults[name]);
  }
  expect(css).toContain('--pod-nav-search-text-color: var(--pod-nav-item-text-hover-color, var(--color-text1-4, #202020));');
  expect(applyDesignTokens(css, next, next)).toBe(css);
});

test('removing a generated navigation override preserves a later manual customization', () => {
  const previous = navigationOverrides({ '--pod-nav-search-text-color': '#765432' });
  const generated = applyDesignTokens(template, previous).replaceAll('--pod-nav-search-text-color: #765432;', '--pod-nav-search-text-color: #123456;');
  const css = applyDesignTokens(generated, navigationOverrides({}), previous);
  expect(cascade(css, 'light')['--pod-nav-search-text-color']).toBe('#123456');
});

test('a selected-border-only override upgrades an older CSS consumer without requiring other borders', () => {
  const legacy = template.replace(/\/\* openyida-navigation-shape:start \*\/[\s\S]*?\/\* openyida-navigation-shape:end \*\//, '');
  const css = applyDesignTokens(legacy, navigationOverrides({ '--pod-nav-menu-item-selected-border': '2px solid #345678' }));
  expect(css).toContain('border: var(--pod-nav-menu-item-selected-border, var(--pod-nav-menu-item-border, none));');
  expect(cascade(css, 'light')['--pod-nav-menu-item-selected-border']).toBe('2px solid #345678');
});

test('omitted shapes preserve native rules; explicit none and shadow-only designs remain supported', () => {
  const native = '\n.project-native .next-nav-item { border: 2px solid red; box-shadow: 0 1px 2px black; }';
  const original = template + native;
  const plain = navigationOverrides({});
  const shadowOnly = navigationOverrides({ '--pod-nav-menu-item-selected-shadow': 'none' });
  const shaped = applyDesignTokens(original, shadowOnly);
  expect(shaped).toContain('box-shadow: var(--pod-nav-menu-item-selected-shadow, none);');
  expect(shaped).not.toMatch(/^\s*border: var\(--pod-nav-menu-item-/m);
  expect(shaped).not.toContain('height: 100% !important;');
  expect(shaped).not.toContain('margin-inline: calc(var(--pod-nav-menu-gap');
  const restored = applyDesignTokens(shaped, plain, shadowOnly);
  expect(restored).not.toContain('openyida-navigation-shape:start');
  expect(restored).toContain(native);
  expect(applyDesignTokens(restored, plain, plain)).toBe(restored);
});

test('removing borders drops the managed layout overrides and retains project CSS', () => {
  const withBorder = navigationOverrides({ '--pod-nav-menu-item-border': '2px solid #345678' });
  const plain = navigationOverrides({});
  const css = applyDesignTokens(template, withBorder) + '\n.project-only { padding: 7px; }';
  expect(css).toContain('height: 100% !important;');
  const restored = applyDesignTokens(css, plain, withBorder);
  expect(restored).not.toContain('openyida-navigation-shape:start');
  expect(restored).toContain('.project-only { padding: 7px; }');
});

test.each([
  ['soft-inset-surfaces', 'light'],
  ['dark-inset-hairline', 'dark'],
])('%s uses its %s design palette in every platform mode', (themeId, tone) => {
  const markdown = design(themeId);
  const tokens = readDesignTokens(markdown);
  const css = applyDesignTokens(template, markdown);
  const active = cascade(css, tone);
  for (const name of navigationColorNames) {expect(active[name]).toBe(tokens[name]);}
  expect(active['--pod-page-header-bg-color']).toBe(tokens['--pod-page-header-bg-color'] || cascade(template, tone)['--pod-page-header-bg-color']);
  const other = tone === 'dark' ? 'light' : 'dark';
  const inactive = cascade(css, other);
  for (const name of navigationColorNames) {expect(inactive[name]).toBe(tokens[name]);}
  for (const mode of ['white', 'gray']) {
    for (const name of ['--pod-shell-theme-bg-color', '--pod-page-header-bg-color']) {
      expect(cascade(css, mode, 'light')[name]).toBe(active[name]);
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

test('changing the design updates every mode and preserves unrelated custom CSS', () => {
  const previous = design('soft-inset-surfaces');
  const next = design('dark-inset-hairline');
  const custom = '\n.local-detail { padding: 7px; }\n';
  const css = applyDesignTokens(applyDesignTokens(template, previous) + custom, next, previous);
  for (const name of navigationColorNames) {
    expect(cascade(css, 'dark')[name]).toBe(readDesignTokens(next)[name]);
    expect(cascade(css, 'light')[name]).toBe(readDesignTokens(next)[name]);
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

test('extended navigation tokens share one palette across modes and update incrementally', () => {
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
    expect(cascade(css, 'dark')[name]).toBe(value);
  }
  const changed = withTokens(next, { '--pod-nav-popup-bg-color': '#FFECCA' });
  const customized = css.replaceAll('--pod-nav-search-text-color: #493C20;', '--pod-nav-search-text-color: #AABBCC;');
  const result = applyDesignTokens(customized, changed, next);
  expect(cascade(result, 'light')['--pod-nav-popup-bg-color']).toBe('#FFECCA');
  expect(cascade(result, 'light')['--pod-nav-search-text-color']).toBe('#AABBCC');
  expect(result).not.toContain(': undefined;');
});

test('mode metadata changes leave the fixed palette unchanged', () => {
  const previous = design('soft-inset-surfaces');
  const next = previous.replace('"navTheme":"light"', '"navTheme":"dark"');
  const css = applyDesignTokens(applyDesignTokens(template, previous), next, previous);
  expect(css).toBe(applyDesignTokens(template, previous));
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
  expect(readDesignTokens(next)[selectedShadowToken]).toBeUndefined();
  expect(cascade(nextCss, 'light')[selectedShadowToken]).toBe('none');
});

test('older generated CSS gains menu shape consumers once and keeps project rules', () => {
  const previous = design('dark-rail-fine-lines');
  const oldCss = applyDesignTokens(template, previous)
    .replace(/\/\* openyida-navigation-shape:start \*\/[\s\S]*?\/\* openyida-navigation-shape:end \*\//, '')
    + '\n.project-only { border: 7px dotted red; }';
  const next = navigationOverrides({ '--pod-nav-menu-item-selected-border': '1px solid #542B1B' });
  const css = applyDesignTokens(oldCss, next, previous);
  expect(cascade(css, 'light')['--pod-nav-menu-item-selected-border']).toBe('1px solid #542B1B');
  expect(css).toContain('.deep-shell-nav-tab-list .next-nav-item.next-selected');
  expect(css).not.toContain('border-radius: var(--pod-nav-menu-item-radius, 8px);');
  expect(css).toContain('.project-only { border: 7px dotted red; }');
  const repeated = applyDesignTokens(css, next, next);
  expect(repeated.match(/openyida-navigation-shape:start/g)).toHaveLength(1);
  expect(repeated).toBe(css);
});

test.each([
  ['app-pop', 'light', '0px', '8px'],
  ['app-nordic', 'light', '8px', '8px'],
  ['app-ticket', 'light', '0px', '8px'],
  ['app-terminal', 'dark', '0px', '4px'],
])('%s retained source keeps the restrained menu shape in bundled CSS and Fast generation', (id, tone, radius, gap) => {
  const markdown = resolveThemeColors(fs.readFileSync(path.join(__dirname,
    `../yida-skills/skills/yida-design/templates/design-themes/${id}/design.md`), 'utf8').replaceAll('{{PRIMARY_COLOR}}', '#6F4E37'));
  const expected = {
    '--pod-nav-sub-divider-color': readDesignTokens(markdown)['--pod-nav-sub-divider-color'],
    '--pod-nav-menu-item-radius': radius,
    '--pod-nav-menu-gap': gap,
  };
  expect(readDesignTokens(markdown)).toMatchObject(expected);
  const bundle = fs.readFileSync(path.join(__dirname, `../yida-skills/skills/yida-design/templates/design-themes/${id}/app_theme.css`), 'utf8');
  // Authoring CSS must be instantiated before it is valid for upload.
  expect(() => validateThemeCssContent(bundle)).toThrow(expect.objectContaining({ code: 'THEME_CSS_UNRESOLVED_TOKEN' }));
  expect(cascade(applyDesignTokens(template, markdown), tone)).toMatchObject(expected);
  expect(cascade(applyDesignTokens(bundle, markdown), tone)).toMatchObject(expected);
  expect(readDesignTokens(markdown)).not.toHaveProperty('--pod-nav-menu-item-selected-border');
  expect(bundle).not.toContain('openyida-navigation-shape:start');
});

test('project overrides replace case measurements in the navigation prose and generated CSS', () => {
  const plan = JSON.parse(JSON.stringify(fixture));
  plan.visualStyle.forUser.selectedTheme = { themeId: 'soft-inset-surfaces', templatePath: 'templates/design-themes/soft-inset-surfaces/design.md' };
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


test('one declaration block covers root, light/dark and legacy shell mode nodes', () => {
  const css = applyDesignTokens(template, design('dark-inset-hairline'));
  const rules = topLevelRules(css).filter(rule => rule.selector.split(',').map(x => x.trim()).includes(':root'));
  expect(rules).toHaveLength(1);
  expect(rules[0].selector.split(',').map(x => x.trim())).toEqual(THEME_SELECTORS);
  const names = [...rules[0].body.matchAll(/(--[\w-]+)\s*:/g)].map(match => match[1]);
  expect(new Set(names).size).toBe(names.length);
  for (const nav of ['light', 'dark', 'white', 'gray']) {
    for (const tone of ['light', 'dark']) {
      expect(cascade(css, nav, tone)).toMatchObject(readDesignTokens(design('dark-inset-hairline')));
    }
  }
});

test('upgrades legacy mode blocks without a token delta and preserves local and conditional rules', () => {
  const previous = design('dark-inset-hairline');
  const rootBody = applyDesignTokens(template, previous).match(/^:root\s*\{([\s\S]*?)^\}/m)[1];
  const custom = '\n.project-only { color: #123456; }\n@media (min-width: 900px) { :root { --project-wide: 1; } }';
  const old = `:root {${rootBody}\n}
:root { --extra-root: #abcdef; }
.pod-premium.nav-light { --pod-shell-theme-bg-color: #fff; }
.pod-premium.nav-dark { --pod-shell-theme-bg-color: #0B142B; }
.pod-premium.is-light {
  --pod-nav-item-text-color: #ffffff;
  outline: 2px solid red;
}
.pod-premium.is-dark { --pod-nav-item-text-color: #98CDCF; }
${custom}`;
  const migrated = applyDesignTokens(old, previous, previous);
  expect(cascade(migrated, 'light')['--pod-shell-theme-bg-color']).toBe('#0B142B');
  expect(cascade(migrated, 'dark')['--pod-nav-item-text-color']).toBe('#98CDCF');
  expect(migrated).toContain('--extra-root: #abcdef;');
  expect(migrated).toContain(custom);
  expect(migrated).toContain('outline: 2px solid red;');
  expect(migrated.match(/^:root\s*\{([\s\S]*?)^\}/m)[1]).not.toContain('outline:');
  expect(applyDesignTokens(migrated, previous, previous)).toBe(migrated);
});
