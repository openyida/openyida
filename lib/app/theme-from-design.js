'use strict';

const fs = require('fs');
const path = require('path');
const { CliError } = require('../core/cli-error');
const { REQUIRED_BRAND_SCALE_TOKENS, validateThemeCssContent, extractThemeColor } = require('./custom-theme');
const { parseDesignDocument, extractDesignTokens } = require('../design/document');
const NAVIGATION_TOKENS = [
  '--pod-shell-theme-bg-color', '--pod-nav-item-text-color', '--pod-nav-item-text-hover-color',
  '--pod-nav-item-text-selected-color', '--pod-nav-menu-bg-hover-color', '--pod-nav-menu-bg-selected-color',
];
const DECLARATIONS = /^[ \t]*(--[\w-]+)\s*:\s*([^;]+);/gm;

function designMetadata(markdown) {
  const frontmatter = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
  if (!frontmatter) {
    throw new CliError('design.md 缺少包含 token 的 frontmatter', { code: 'DESIGN_THEME_TOKENS_REQUIRED' });
  }
  // Historical Fast files permitted bare HEX values. Versioned documents use
  // valid YAML; all consumers share the same narrow legacy compatibility path.
  return parseDesignDocument(markdown, { legacyTokenValues: true }).metadata;
}

// New Fast and Plan files share grouped tokens. Legacy flat files remain readable.
function readDesignTokens(markdown) {
  return tokensFromMetadata(designMetadata(markdown));
}

function tokensFromMetadata(metadata) {
  const tokens = extractDesignTokens(metadata, { strict: false });
  const missing = REQUIRED_BRAND_SCALE_TOKENS.filter(name => !tokens[name]);
  if (missing.length) {
    throw new CliError(`design.md 缺少品牌 token：${missing.join(', ')}`, { code: 'DESIGN_THEME_TOKENS_REQUIRED' });
  }
  return tokens;
}

function resolveDesignTokens(metadata) {
  const tokens = tokensFromMetadata(metadata);
  for (const [alias, source] of Object.entries({
    '--color-brand-1': '--color-brand1-10', '--color-brand-2': '--color-brand1-1',
    '--color-brand-3': '--color-brand1-6', '--color-brand-4': '--color-brand1-9',
  })) {
    tokens[alias] = tokens[alias] || tokens[source];
  }
  tokens['--color-group'] = tokens['--color-group'] || [6, 1, 5, 2, 9, 3].map(n => tokens[`--color-brand1-${n}`]).join(', ');
  return tokens;
}

function navigationTone(metadata, tokens) {
  if (!NAVIGATION_TOKENS.every(name => tokens[name])) {return null;}
  const tone = metadata.themeProfile?.navTheme;
  if (['light', 'dark'].includes(tone)) {return tone;}
  if (tone !== undefined) {throw new CliError('themeProfile.navTheme 必须是 light 或 dark', { code: 'DESIGN_THEME_NAVIGATION_INVALID' });}
  const seen = new Set();
  let value = tokens['--pod-shell-theme-bg-color'];
  while (/^var\(/.test(value || '')) {
    const alias = /^var\((--[\w-]+)(?:,\s*([^)]+))?\)$/.exec(value);
    if (!alias || seen.has(alias[1])) {return null;}
    seen.add(alias[1]);
    value = tokens[alias[1]] || alias[2];
  }
  let rgb;
  if (/^#[\da-f]{3}$/i.test(value || '')) {value = `#${[...value.slice(1)].map(char => char + char).join('')}`;}
  if (/^#[\da-f]{6}$/i.test(value || '')) {rgb = [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16));}
  const functional = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value || '');
  if (functional) {rgb = functional.slice(1, 4).map(Number);}
  return rgb ? (rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 < 128 ? 'dark' : 'light') : null;
}

function declarationValues(body) {
  return Object.fromEntries([...body.matchAll(DECLARATIONS)].map(match => [match[1], match[2].trim()]));
}

function replaceDeclarations(body, values, addMissing = false) {
  const existing = new Set();
  let result = body.replace(DECLARATIONS, (line, name, value) => {
    existing.add(name);
    return name in values ? line.replace(value, () => values[name]) : line;
  });
  if (addMissing) {
    result += Object.entries(values).filter(([name]) => !existing.has(name))
      .map(([name, value]) => `  ${name}: ${value};\n`).join('');
  }
  return result;
}

function applyNavigationTokens(css, tokens, changed, tone, previousTone) {
  // The public stylesheet has a second :root and explicit mode overrides. Read
  // their defaults so applying a dark project cannot leak white text into light modes.
  const source = fs.readFileSync(path.resolve(__dirname,
    '../../yida-skills/skills/yida-design/references/theme/app-custom-theme-template.css'), 'utf8');
  const defaults = Object.assign({}, ...[...source.matchAll(/^:root\s*\{([^}]+)\}/gm)].map(match => declarationValues(match[1])));
  const navigationChanged = Object.fromEntries(NAVIGATION_TOKENS.filter(name => name in changed).map(name => [name, tokens[name]]));
  let output = css.replace(/(^:root\s*\{)([^}]+)(\})/gm,
    (block, start, body, close) => start + replaceDeclarations(body, navigationChanged) + close);
  for (const mode of ['light', 'dark']) {
    const modeDefaults = { ...defaults };
    for (const selector of [`nav-${mode}`, `is-${mode}`]) {
      Object.assign(modeDefaults, declarationValues(source.match(new RegExp(`\\.pod-premium\\.${selector}\\s*\\{([^}]+)\\}`))?.[1] || ''));
    }
    // A first application or a mode change establishes both palettes. Delta
    // updates otherwise leave unrelated, manually customized declarations alone.
    const resetMode = !previousTone || previousTone !== tone;
    const names = resetMode ? NAVIGATION_TOKENS : (mode === tone ? Object.keys(navigationChanged) : []);
    const values = Object.fromEntries(names.map(name => [name, mode === tone ? tokens[name] : modeDefaults[name]]));
    if (!Object.keys(values).length) {continue;}
    const shell = values['--pod-shell-theme-bg-color'];
    if (shell) {
      const background = {
        '--pod-shell-theme-bg-color': shell,
        '--pod-page-header-bg-color': mode === tone ? shell : modeDefaults['--pod-page-header-bg-color'],
      };
      output = output.replace(new RegExp(`(\\.pod-premium\\.nav-${mode}\\s*\\{)([^}]*)(\\})`, 'g'),
        (block, start, body, close) => start + replaceDeclarations(body, background, true) + close);
    }
    const foregrounds = Object.fromEntries(Object.entries(values).filter(([name]) => name !== '--pod-shell-theme-bg-color'));
    output = output.replace(new RegExp(`(\\.pod-premium\\.is-${mode}\\s*\\{)([^}]*)(\\})`, 'g'),
      (block, start, body, close) => start + replaceDeclarations(body, foregrounds, true) + close);
  }
  return output;
}

function applyDesignTokens(template, markdown, previousMarkdown) {
  // Reject damaged templates or existing stylesheets before the scope rewrite.
  validateThemeCssContent(template);
  const metadata = designMetadata(markdown);
  const previousMetadata = previousMarkdown === markdown ? metadata : (previousMarkdown ? designMetadata(previousMarkdown) : null);
  const tokens = resolveDesignTokens(metadata);
  const previous = previousMetadata === metadata ? tokens : (previousMetadata ? resolveDesignTokens(previousMetadata) : null);
  const tone = navigationTone(metadata, tokens);
  const previousTone = previous ? navigationTone(previousMetadata, previous) : null;
  const changed = Object.fromEntries(Object.entries(tokens).filter(([name, value]) => !previous || previous[name] !== value));
  if (!Object.keys(changed).length && tone === previousTone) {
    extractThemeColor(template);
    return require('./application-style').applyApplicationStyle(template, metadata, tokens);
  }
  const root = /^:root\s*\{([\s\S]*?)^\}/m.exec(template);
  if (!root) {throw new Error('应用主题模板缺少 :root');}
  const declarations = /^[ \t]*(--[\w-]+)\s*:\s*([^;]+);/gm;
  const original = Object.fromEntries([...root[1].matchAll(declarations)].map(m => [m[1], m[2].trim()]));
  const brandValues = new Map(REQUIRED_BRAND_SCALE_TOKENS.filter(name => original[name] && changed[name]).map(name => [original[name], tokens[name]]));
  const escaped = [...brandValues.keys()].map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const brandPattern = new RegExp(escaped.join('|'), 'g');
  const replaceBrand = value => brandValues.size ? value.replace(brandPattern, old => brandValues.get(old)) : value;
  let body = root[1].replace(declarations, (line, name, value) => line.replace(value, () => changed[name] || replaceBrand(value)));
  const extra = Object.entries(changed).filter(([name]) => !(name in original));
  body += extra.map(([name, value]) => `  ${name}: ${value};\n`).join('');
  let tail = template.slice(root.index + root[0].length).replace(declarations,
    (line, name, value) => line.replace(value, () => replaceBrand(value)));
  // Platform navigation modes bind independently; the root shell remains the custom-page default.
  if (!tone && changed['--pod-shell-theme-bg-color']) {
    tail = tail.replace(/(\.pod-premium\.nav-(light|dark)\s*\{)([^}]*)(\})/g,
      (block, selector, tone, body, close) => selector + body.replace(declarations,
        (line, name, value) => ['--pod-shell-theme-bg-color', '--pod-page-header-bg-color'].includes(name)
          ? line.replace(value, `var(--color-brand1-${tone === 'dark' ? 5 : 3})`) : line) + close);
  }
  let css = `${template.slice(0, root.index)}:root {${body}}${tail}`;
  if (tone) {css = applyNavigationTokens(css, tokens, changed, tone, previousTone);}
  css = require('./application-style').applyApplicationStyle(css, metadata, tokens);
  validateThemeCssContent(css);
  extractThemeColor(css);
  return css;
}

module.exports = { readDesignTokens, applyDesignTokens };
