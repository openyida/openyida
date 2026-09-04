'use strict';

const { CliError } = require('../core/cli-error');
const { REQUIRED_BRAND_SCALE_TOKENS, validateThemeCssContent, extractThemeColor } = require('./custom-theme');

// Both flat Fast tokens and grouped Plan tokens use one scalar declaration per line.
function readDesignTokens(markdown) {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
  if (!frontmatter) {
    throw new CliError('design.md 缺少包含 token 的 frontmatter', { code: 'DESIGN_THEME_TOKENS_REQUIRED' });
  }
  const tokens = {};
  for (const line of frontmatter[1].split(/\r?\n/)) {
    const match = /^\s*["']?(--[\w-]+)["']?\s*:\s*(.+?)\s*$/.exec(line);
    if (!match) {continue;}
    const name = match[1];
    // YAML comments may follow a quoted value; # inside a color or string is data.
    const scalar = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|.*?)\s*(?:\s+#.*)?$/.exec(match[2]);
    const raw = scalar[1].trim();
    let value = raw;
    if (raw.startsWith('"')) {
      try { value = JSON.parse(raw); } catch {
        throw new CliError(`token ${name} 必须是单行字符串`, { code: 'DESIGN_THEME_TOKEN_INVALID' });
      }
    } else if (raw.startsWith("'")) {
      if (!raw.endsWith("'")) {throw new CliError(`token ${name} 引号不完整`, { code: 'DESIGN_THEME_TOKEN_INVALID' });}
      value = raw.slice(1, -1).replace(/''/g, "'");
    }
    if (typeof value !== 'string' || !value.trim() || /[;{}\r\n<>]|\/\*|\*\//.test(value) || /^[|>]/.test(value)) {
      throw new CliError(`token ${name} 必须是已确定的单行 CSS 值`, { code: 'DESIGN_THEME_TOKEN_INVALID' });
    }
    if (name in tokens && tokens[name] !== value) {
      throw new CliError(`token ${name} 存在冲突值`, { code: 'DESIGN_THEME_TOKEN_CONFLICT' });
    }
    if (/^--color-brand1-(4|7|8)$/.test(name)) {
      throw new CliError(`平台不支持 ${name}`, { code: 'DESIGN_THEME_TOKEN_INVALID' });
    }
    tokens[name] = value;
  }
  const missing = REQUIRED_BRAND_SCALE_TOKENS.filter(name => !tokens[name]);
  if (missing.length) {
    throw new CliError(`design.md 缺少品牌 token：${missing.join(', ')}`, { code: 'DESIGN_THEME_TOKENS_REQUIRED' });
  }
  return tokens;
}

function applyDesignTokens(template, markdown) {
  const tokens = readDesignTokens(markdown);
  for (const [alias, source] of Object.entries({
    '--color-brand-1': '--color-brand1-10', '--color-brand-2': '--color-brand1-1',
    '--color-brand-3': '--color-brand1-6', '--color-brand-4': '--color-brand1-9',
  })) {
    tokens[alias] = tokens[alias] || tokens[source];
  }
  tokens['--color-group'] = tokens['--color-group'] || [6, 1, 5, 2, 9, 3].map(n => tokens[`--color-brand1-${n}`]).join(', ');
  const root = /^:root\s*\{([\s\S]*?)^\}/m.exec(template);
  if (!root) {throw new Error('应用主题模板缺少 :root');}
  const declarations = /^[ \t]*(--[\w-]+)\s*:\s*([^;]+);/gm;
  const original = Object.fromEntries([...root[1].matchAll(declarations)].map(m => [m[1], m[2].trim()]));
  const brandValues = new Map(REQUIRED_BRAND_SCALE_TOKENS.map(name => [original[name], tokens[name]]));
  const escaped = [...brandValues.keys()].map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const brandPattern = new RegExp(escaped.join('|'), 'g');
  const replaceBrand = value => value.replace(brandPattern, old => brandValues.get(old));
  let body = root[1].replace(declarations, (line, name, value) => line.replace(value, () => tokens[name] || replaceBrand(value)));
  const extra = Object.entries(tokens).filter(([name]) => !(name in original));
  body += extra.map(([name, value]) => `  ${name}: ${value};\n`).join('');
  // Keep scoped nav/light/dark selectors and their variable relationships intact.
  const tail = template.slice(root.index + root[0].length).replace(declarations,
    (line, name, value) => line.replace(value, () => replaceBrand(value)));
  const css = `${template.slice(0, root.index)}:root {${body}}${tail}`;
  validateThemeCssContent(css);
  extractThemeColor(css);
  return css;
}

module.exports = { readDesignTokens, applyDesignTokens };
