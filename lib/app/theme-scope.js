'use strict';

// A fixed application theme owns one palette. Match the platform's own scope
// specificity so a nearer light/dark declaration cannot replace root inheritance.
const THEME_SCOPE_START = '/* openyida-theme-tokens:start */';
const THEME_SCOPE_END = '/* openyida-theme-tokens:end */';
const THEME_SELECTORS = [
  '.pod-premium.is-light', '.pod-premium.is-dark',
  ...['light', 'dark', 'white', 'gray'].flatMap(mode => [`.pod-premium.nav-${mode}`, `.pod-premium.nav-theme-${mode}`]),
  ':root',
];
const DECLARATIONS = /^[ \t]*(--[\w-]+)\s*:\s*([^;]+);/gm;

// Read top-level rules only; quoted braces, comments and conditional rules must
// not be mistaken for the generated application's global token blocks.
function topLevelRules(css) {
  const rules = [];
  let depth = 0;
  let quote = '';
  let comment = false;
  let start = -1;
  let open = -1;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (comment) {if (c === '*' && css[i + 1] === '/') {comment = false; i++;} continue;}
    if (quote) {if (c === '\\') {i++;} else if (c === quote) {quote = '';} continue;}
    if (c === '/' && css[i + 1] === '*') {comment = true; i++; continue;}
    if (start < 0 && !/\s/.test(c)) {start = i;}
    if (c === '"' || c === "'") {quote = c; continue;}
    if (c === '{') {if (!depth) {open = i;} depth++;}
    else if (c === '}') {
      depth--;
      if (!depth) {
        rules.push({ start, end: i + 1, selector: css.slice(start, open).trim(), body: css.slice(open + 1, i) });
        start = -1;
      }
    } else if (!depth && c === ';') {start = -1;}
  }
  return rules;
}

function normalizeThemeScopes(css, tone = 'light') {
  if (css.includes(THEME_SCOPE_START)) {return css;}
  const rules = topLevelRules(css);
  const owned = rules.filter(rule => rule.selector === ':root' || /^\.pod-premium\.(?:is|nav)-(?:light|dark|white|gray)$/.test(rule.selector));
  const roots = owned.filter(rule => rule.selector === ':root');
  if (!roots.length) {throw new Error('应用主题模板缺少 :root');}
  // Collapse the legacy active palette once when upgrading an existing file.
  // Delta updates afterwards operate only on this single block.
  const active = owned.filter(rule => [`.pod-premium.nav-${tone}`, `.pod-premium.is-${tone}`].includes(rule.selector));
  const properties = /^[ \t]*(?!-)[a-zA-Z][\w-]*\s*:[^;]+;/gm;
  let body = [...roots, ...active].map(rule => rule.body.replace(properties, '').trimEnd()).join('\n');
  const last = new Map([...body.matchAll(DECLARATIONS)].map(match => [match[1], match.index]));
  body = body.replace(DECLARATIONS, (line, name, _value, offset) => last.get(name) === offset ? line : '');
  body = body.replace(/\/\* (?:Light theme defaults\.|Dark theme overrides\.) \*\//g, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n');
  const unified = `${THEME_SCOPE_START}\n${THEME_SELECTORS.join(',\n')} {${body}\n}\n${THEME_SCOPE_END}`;
  const replacements = new Map(owned.map(rule => [rule.start, rule]));
  // White-navigation card framing was another preset-mode override. The project
  // already owns --pod-card-border, so drop only the known generated rule.
  for (const rule of rules) {
    if (rule.selector === '.pod-premium.nav-white,\n.pod-premium.nav-theme-white' &&
        /^\s*--pod-card-border:\s*1px solid var\(--color-line1-1, #efefef\);\s*$/.test(rule.body)) {
      replacements.set(rule.start, rule);
    }
  }
  for (const rule of [...replacements.values()].sort((a, b) => b.start - a.start)) {
    const rest = rule.body.replace(DECLARATIONS, '');
    const custom = rest.replace(/\/\*[\s\S]*?\*\//g, '').trim()
      ? `\n${rule.selector} {${rest}\n}` : '';
    css = css.slice(0, rule.start) + (rule === roots[0] ? unified : '') + custom + css.slice(rule.end);
  }
  return css.replace(/\n\s*\n\s*\n/g, '\n\n');
}

module.exports = { normalizeThemeScopes, topLevelRules, THEME_SELECTORS, THEME_SCOPE_START, THEME_SCOPE_END };
