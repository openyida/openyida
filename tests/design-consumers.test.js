'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { readDesignTokens, applyDesignTokens } = require('../lib/app/theme-from-design');
const { readDesignAssetStrategy } = require('../lib/asset/asset-plan');

const tokens = {
  '--color-brand1-1': '#E8EDF9', '--color-brand1-2': '#F1F4FC', '--color-brand1-3': '#D3DDF3',
  '--color-brand1-5': '#254599', '--color-brand1-6': '#315BCC', '--color-brand1-9': '#1E387D',
  '--color-brand1-10': '#C3CEEB', '--pod-shell-theme-bg-color': '#FAFAFA',
  '--pod-nav-item-text-color': '#D6D6D6', '--pod-nav-item-text-hover-color': '#FFFFFF',
  '--pod-nav-item-text-selected-color': '#FFFFFF', '--pod-nav-menu-bg-hover-color': '#202020',
  '--pod-nav-menu-bg-selected-color': '#303030',
};
const tokenLines = Object.entries(tokens).map(([name, value]) => `  ${name}: ${JSON.stringify(value)}`).join('\n');
const design = (metadata = '') => `---\n${metadata}tokens:\n${tokenLines}\n---\n# 示例\n`;

test('CSS reads only tokens and rejects invalid YAML anywhere in the configuration', () => {
  expect(readDesignTokens(design('other:\n  --color-brand1-6: "#FFFFFF"\n'))).toEqual(tokens);
  expect(() => readDesignTokens(design().replace('tokens:', 'notTokens:'))).toThrow();
  expect(() => readDesignTokens(design('name: "研发 "A" 系统"\n'))).toThrow();
  expect(() => readDesignTokens(design('name: A\nname: B\n'))).toThrow();
});

test('legacy bare HEX values remain readable while versioned documents require valid YAML values', () => {
  const bare = design().replace(/"(#[A-F\d]+)"/g, '$1');
  expect(readDesignTokens(bare)).toEqual(tokens);
  expect(() => readDesignTokens(bare.replace('---\n', '---\nschemaVersion: "1.0"\n'))).toThrow();
});

test('equivalent YAML and JSON navigation metadata produce identical CSS', () => {
  const template = fs.readFileSync(path.join(__dirname,
    '../yida-skills/skills/yida-design/references/theme/app-custom-theme-template.css'), 'utf8');
  const variants = [
    'themeProfile: {"navTheme":"dark"}\n',
    'themeProfile: {navTheme: dark}\n',
    'themeProfile:\n  navTheme: dark\n',
  ].map(metadata => applyDesignTokens(template, design(metadata)));
  expect(new Set(variants).size).toBe(1);
  const shared = require('../lib/app/theme-scope').topLevelRules(variants[0])
    .find(rule => rule.selector.split(',').map(selector => selector.trim()).includes('.pod-premium.nav-dark'));
  expect(shared.selector).toContain(':root');
  expect(shared.body).toContain('--pod-shell-theme-bg-color: #FAFAFA;');
  expect(() => applyDesignTokens(template, design('themeProfile: {navTheme: invalid}\n'))).toThrow();
});

test('assets share the complete YAML parser and preserve existing single-line JSON input', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-design-consumers-'));
  const file = path.join(dir, 'design.md');
  const expected = { pages: [{ pageId: 'settings', imageNeed: 'none', slots: [] }] };
  try {
    for (const metadata of [
      `assetStrategy: ${JSON.stringify(expected)}\n`,
      'assetStrategy:\n  pages:\n    - pageId: settings\n      imageNeed: none\n      slots: []\n',
    ]) {
      fs.writeFileSync(file, design(metadata));
      expect(readDesignAssetStrategy(file)).toEqual(expected);
    }
    fs.writeFileSync(file, design(`assetStrategy: ${JSON.stringify(expected)}\n`).replace(/"(#[A-F\d]+)"/g, '$1'));
    expect(readDesignAssetStrategy(file)).toEqual(expected);
    for (const metadata of [
      'assetStrategy: {pages: []}\nassetStrategy: {pages: []}\n',
      'name: "研发 "A" 系统"\nassetStrategy: {pages: []}\n',
      'assetStrategy: {pages: null}\n',
    ]) {
      fs.writeFileSync(file, design(metadata));
      expect(() => readDesignAssetStrategy(file)).toThrow('ASSET_DESIGN_INVALID');
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
