'use strict';

const fs = require('fs');
const path = require('path');
const { CliError } = require('../core/cli-error');
const { REQUIRED_BRAND_SCALE_TOKENS, validateThemeCssContent, extractThemeColor } = require('./custom-theme');
const { parseDesignDocument, extractDesignTokens } = require('../design/document');
const { normalizeThemeScopes } = require('./theme-scope');
const DECLARATIONS = /^[ \t]*(--[\w-]+)\s*:\s*([^;]+);/gm;
const isNavigation = name => /^(--pod-nav-|--pod-shell-|--pod-page-header-)/.test(name);

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

function navigationTone(metadata) {
  const tone = metadata.themeProfile?.navTheme || metadata.navTheme;
  if (tone !== undefined && !['light', 'dark'].includes(tone)) {
    throw new CliError('themeProfile.navTheme 必须是 light 或 dark', { code: 'DESIGN_THEME_NAVIGATION_INVALID' });
  }
  return tone || 'light';
}

function declarationValues(body) {
  return Object.fromEntries([...body.matchAll(DECLARATIONS)].map(match => [match[1], match[2].trim()]));
}

// Removing a design override restores its shared default. Preserve a value
// edited directly by the user when it no longer matches the previous design.
function restoreRemovedNavigation(css, tokens, previous) {
  const source = fs.readFileSync(path.resolve(__dirname,
    '../../yida-skills/skills/yida-design/references/theme/app-custom-theme-template.css'), 'utf8');
  const defaults = declarationValues(source.match(/^:root\s*\{([\s\S]*?)^\}/m)[1]);
  const removed = Object.fromEntries(Object.entries(previous || {})
    .filter(([name]) => isNavigation(name) && !(name in tokens)));
  return css.replace(/^:root\s*\{([\s\S]*?)^\}/m, (block, body) => block.replace(body, () =>
    body.replace(DECLARATIONS, (line, name, value) => {
      if (!(name in removed) || value.trim() !== removed[name]) {return line;}
      return name in defaults ? line.replace(value, () => defaults[name]) : '';
    })));
}

// Only emit the extra consumers the design actually uses. Platform rules own
// menu geometry, focus and top-tab behavior; a shadow alone must not reset them.
function applyNavigationShape(css, tokens) {
  const borderNames = ['--pod-nav-menu-item-border', '--pod-nav-menu-item-hover-border', '--pod-nav-menu-item-selected-border'];
  const states = ['', ':hover', '.next-selected'];
  const rules = [];
  borderNames.forEach((name, index) => {
    if (!(name in tokens)) {return;}
    const fallback = index ? 'var(--pod-nav-menu-item-border, none)' : 'none';
    rules.push(`.pod-premium .deep-shell-nav-menu-content .next-nav-item${states[index]},
.pod-premium .deep-shell-nav-tab-list .next-nav-item${states[index]} {
  box-sizing: border-box;
  border: var(${name}, ${fallback});
}`);
  });
  if (borderNames.some(name => name in tokens)) {
    rules.push(`/* Fit native inner rows only when the project opts into borders. */
.vc-shell.pod-premium .next-nav.next-line.next-ver.deep-shell-nav-menu-content:not(.next-icon-only) .next-nav-item.next-menu-item > .next-menu-item-inner,
.vc-shell.pod-premium .next-shell-header .next-shell-navigation .next-nav.next-line.next-hoz.deep-shell-nav-tab-list .next-nav-item.next-menu-item > .next-menu-item-inner {
  box-sizing: border-box;
  height: 100% !important;
  min-height: 0 !important;
}`);
  }
  if ('--pod-nav-menu-item-selected-shadow' in tokens) {
    rules.push(`.pod-premium .deep-shell-nav-menu-content .next-nav-item.next-selected,
.pod-premium .deep-shell-nav-tab-list .next-nav-item.next-selected {
  box-shadow: var(--pod-nav-menu-item-selected-shadow, none);
}`);
  }
  const block = rules.length ? `/* openyida-navigation-shape:start */\n${rules.join('\n')}\n/* openyida-navigation-shape:end */` : '';
  const managed = /\/\* openyida-navigation-shape:start \*\/[\s\S]*?\/\* openyida-navigation-shape:end \*\//;
  if (managed.test(css)) {return css.replace(managed, () => block);}
  return block ? `${css.trimEnd()}\n\n${block}\n` : css;
}

function applyDesignTokens(template, markdown, previousMarkdown) {
  const metadata = designMetadata(markdown);
  const previousMetadata = previousMarkdown === markdown ? metadata : (previousMarkdown ? designMetadata(previousMarkdown) : null);
  const tokens = resolveDesignTokens(metadata);
  // Bundled CSS is an authoring template. Fill only unresolved declarations from
  // the completed design before validating and rewriting CSS scopes.
  template = template.replace(/^([ \t]*)(--[\w-]+)(\s*:\s*)([^;\n]+);/gm,
    (line, indent, name, separator, value) => {
      if (!/\{\{PRIMARY_COLOR\}\}|<生成实际色值：/.test(value)) {return line;}
      if (!tokens[name] || /\{\{|<生成实际色值：/.test(tokens[name])) {
        throw new CliError(`design.md 缺少品牌 token：${name}`, { code: 'DESIGN_THEME_TOKENS_REQUIRED' });
      }
      return `${indent}${name}${separator}${tokens[name]};`;
    });
  // Reject damaged templates or existing stylesheets before the scope rewrite.
  validateThemeCssContent(template);
  const previous = previousMetadata === metadata ? tokens : (previousMetadata ? resolveDesignTokens(previousMetadata) : null);
  navigationTone(metadata); // Validate platform metadata; it does not select a second palette.
  template = normalizeThemeScopes(template, navigationTone(previousMetadata || metadata));
  template = applyNavigationShape(template, tokens);
  if (previous) {template = restoreRemovedNavigation(template, tokens, previous);}
  const changed = Object.fromEntries(Object.entries(tokens).filter(([name, value]) => !previous || previous[name] !== value));
  if (!Object.keys(changed).length) {
    validateThemeCssContent(template);
    extractThemeColor(template);
    return require('./application-style').applyApplicationStyle(template, metadata, tokens);
  }
  const root = /^:root\s*\{([\s\S]*?)^\}/m.exec(template);
  if (!root) {throw new Error('应用主题模板缺少 :root');}
  const declarations = /^[ \t]*(--[\w-]+)\s*:\s*([^;]+);/gm;
  const original = Object.fromEntries([...root[1].matchAll(declarations)].map(m => [m[1], m[2].trim()]));
  // A shared color value does not imply shared semantics. Apply changes by token
  // identity; only explicit var() references establish a relationship to brand.
  let body = root[1].replace(declarations, (line, name, value) => line.replace(value, () => changed[name] || value));
  const extra = Object.entries(changed).filter(([name]) => !(name in original));
  body += extra.map(([name, value]) => `  ${name}: ${value};\n`).join('');
  const tail = template.slice(root.index + root[0].length);
  let css = `${template.slice(0, root.index)}:root {${body}}${tail}`;
  css = require('./application-style').applyApplicationStyle(css, metadata, tokens);
  validateThemeCssContent(css);
  extractThemeColor(css);
  return css;
}

module.exports = { readDesignTokens, applyDesignTokens };
