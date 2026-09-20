'use strict';

const fs = require('fs');
const path = require('path');
const { applyDesignTokens, readDesignTokens } = require('../lib/app/theme-from-design');
const { renderDesign } = require('../lib/design-plan/materialize');
const { validateThemeCssContent } = require('../lib/app/custom-theme');
const fixture = require('./fixtures/design-plan.json');
const template = fs.readFileSync(path.join(__dirname,
  '../yida-skills/skills/yida-design/references/theme/app-custom-theme-template.css'), 'utf8');
const navigationNames = [
  '--pod-shell-theme-bg-color', '--pod-nav-item-text-color', '--pod-nav-item-text-hover-color',
  '--pod-nav-item-text-selected-color', '--pod-nav-menu-bg-hover-color', '--pod-nav-menu-bg-selected-color',
];

function design(themeId, tone, primaryColor = '#6F4E37') {
  const plan = JSON.parse(JSON.stringify(fixture));
  plan.visualStyle.forUser.selectedTheme = { themeId, templatePath: `templates/design-themes/${themeId}.md` };
  plan.visualStyle.forUser.navigationStyle.tone = tone;
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
  ['soft-inset-surfaces', 'light'], ['soft-inset-surfaces', 'dark'],
  ['dark-inset-hairline', 'light'], ['dark-inset-hairline', 'dark'],
])('%s in %s mode applies all six navigation colors through every CSS override', (themeId, tone) => {
  const markdown = design(themeId, tone);
  const tokens = readDesignTokens(markdown);
  const css = applyDesignTokens(template, markdown);
  const active = cascade(css, tone);
  for (const name of navigationNames) {expect(active[name]).toBe(tokens[name]);}
  expect(active['--pod-page-header-bg-color']).toBe(tokens['--pod-shell-theme-bg-color']);
  const other = tone === 'dark' ? 'light' : 'dark';
  const inactive = cascade(css, other);
  const defaults = cascade(template, other);
  for (const name of navigationNames) {expect(inactive[name]).toBe(defaults[name]);}
  for (const mode of ['white', 'gray']) {
    for (const name of ['--pod-shell-theme-bg-color', '--pod-page-header-bg-color']) {
      expect(cascade(css, mode, 'light')[name]).toBe(cascade(template, mode, 'light')[name]);
    }
  }
  expect(applyDesignTokens(css, markdown)).toBe(css);
  expect(applyDesignTokens(css, markdown, markdown)).toBe(css);
});

test.each(['light', 'dark'])('Fast documents infer %s navigation from their shell without Plan metadata', tone => {
  const theme = tone === 'dark' ? 'dark-inset-hairline' : 'soft-inset-surfaces';
  const markdown = design(theme, tone).replace(/^themeProfile:.*\n/m, '');
  const css = applyDesignTokens(template, markdown);
  const active = cascade(css, tone);
  const tokens = readDesignTokens(markdown);
  for (const name of navigationNames) {expect(active[name]).toBe(tokens[name]);}
});

test('changing the selected mode resets its previous mode and preserves unrelated custom CSS', () => {
  const previous = design('soft-inset-surfaces', 'light');
  const next = design('soft-inset-surfaces', 'dark');
  const custom = '\n.local-detail { padding: 7px; }\n';
  const css = applyDesignTokens(applyDesignTokens(template, previous) + custom, next, previous);
  for (const name of navigationNames) {
    expect(cascade(css, 'dark')[name]).toBe(readDesignTokens(next)[name]);
    expect(cascade(css, 'light')[name]).toBe(cascade(template, 'light')[name]);
  }
  expect(css).toContain(custom);
  expect(applyDesignTokens(css, next, next)).toBe(css);
});

test('delta updates preserve hand-edited unchanged navigation colors and page styles', () => {
  const previous = design('soft-inset-surfaces', 'dark');
  const next = design('soft-inset-surfaces', 'dark', '#315BCC');
  const original = applyDesignTokens(template, previous);
  const customized = original.replaceAll('--pod-nav-item-text-color: #D6D6D6;', '--pod-nav-item-text-color: #ABCDEF;')
    .replace('--corner-2: 8px;', '--corner-2: 11px;') + '\n.local-detail { padding: 7px; }\n';
  const changed = applyDesignTokens(customized, next, previous);
  expect(cascade(changed, 'dark')['--pod-nav-item-text-color']).toBe('#ABCDEF');
  expect(cascade(changed, 'dark')['--pod-shell-theme-bg-color']).toBe(readDesignTokens(next)['--pod-shell-theme-bg-color']);
  expect(changed).toContain('--corner-2: 11px;');
  expect(changed).toContain('.local-detail { padding: 7px; }');
  expect(applyDesignTokens(changed, next, next)).toBe(changed);
});

test('mode metadata changes take effect even when token values are unchanged', () => {
  const previous = design('soft-inset-surfaces', 'light');
  const next = previous.replace('"navTheme":"light"', '"navTheme":"dark"');
  const css = applyDesignTokens(applyDesignTokens(template, previous), next, previous);
  const tokens = readDesignTokens(next);
  for (const name of navigationNames) {expect(cascade(css, 'dark')[name]).toBe(tokens[name]);}
});
