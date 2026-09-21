'use strict';

const fs = require('fs');
const path = require('path');
const { CliError } = require('../core/cli-error');
const { readJson } = require('./files');
const { parseDesignDocument } = require('../design/document');

const DESIGN_SKILL_ROOT = path.resolve(__dirname, '../../yida-skills/skills/yida-design');
const PLAN_SKILL_ROOT = path.join(DESIGN_SKILL_ROOT, 'sub_skill/yida-design-plan');
const THEME_DIR = path.join(DESIGN_SKILL_ROOT, 'templates/design-themes');

function loadThemeIndex() {
  return readJson(path.join(THEME_DIR, 'index.json'), '主题索引');
}

function themeTemplatePath(theme) {
  const file = path.resolve(DESIGN_SKILL_ROOT, theme.templatePath);
  if (!file.startsWith(`${THEME_DIR}${path.sep}`) || !fs.existsSync(file)) {
    throw new CliError(`主题模板不可读：${theme.templatePath}`, { code: 'DESIGN_PLAN_THEME_UNREADABLE' });
  }
  return file;
}

function themeNavTheme(theme) {
  if (theme.mode === 'creative') {return undefined;}
  const file = themeTemplatePath(theme);
  const metadata = parseDesignDocument(fs.readFileSync(file, 'utf8')).metadata;
  const navTheme = metadata.themeProfile?.navTheme || metadata.navTheme;
  if (!['light', 'dark'].includes(navTheme)) {
    throw new CliError(`主题模板 navTheme 无效：${theme.themeId}`, {
      code: 'DESIGN_PLAN_THEME_NAV_THEME_INVALID',
      details: { themeId: theme.themeId, navTheme: metadata.navTheme, templatePath: theme.templatePath },
    });
  }
  return navTheme;
}

// Color recipes live with the visual theme. Resolve their token dependencies rather
// than duplicating per-theme palettes in JavaScript.
function resolveThemeColors(source) {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  const tokenSource = frontmatter ? frontmatter[1] : source;
  const definitions = new Map([...tokenSource.matchAll(/^\s*"(--[\w-]+)":\s*"([^"\n]*)"/gm)]
    .map(([, name, value]) => [name, value]));
  const resolved = new Map();
  const resolving = new Set();
  const invalid = value => { throw new CliError(`主题色值无法生成：${value}`, { code: 'DESIGN_PLAN_THEME_COLOR_INVALID' }); };
  function color(value) {
    if (value.startsWith('--')) {return resolve(value);}
    if (/^#[\da-f]{6}$/i.test(value)) {return value.toUpperCase();}
    const alias = /^var\((--[\w-]+)(?:,\s*[^)]+)?\)$/.exec(value);
    if (alias) {return resolve(alias[1]);}
    return invalid(value);
  }
  function channels(value) {
    const hex = color(value);
    if (!/^#[\da-f]{6}$/i.test(hex)) {return invalid(value);}
    return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  }
  function resolve(name) {
    if (resolved.has(name)) {return resolved.get(name);}
    if (resolving.has(name) || !definitions.has(name)) {return invalid(name);}
    resolving.add(name);
    const raw = definitions.get(name);
    let result = raw;
    if (raw.startsWith('<生成实际色值：')) {
      const mix = /^<生成实际色值：(--[\w-]+|#[\da-f]{6}) (\d+(?:\.\d+)?)% \+ (--[\w-]+|#[\da-f]{6}) (\d+(?:\.\d+)?)%，sRGB 逐通道混合>$/i.exec(raw);
      const alpha = /^<生成实际色值：取 (--[\w-]+) 的 sRGB 三通道，alpha 设为 (0(?:\.\d+)?|1(?:\.0+)?)，输出 rgba>$/.exec(raw);
      if (mix) {
        const [, left, leftPercent, right, rightPercent] = mix;
        if (Math.abs(Number(leftPercent) + Number(rightPercent) - 100) > 0.001) {return invalid(raw);}
        const a = channels(left);
        const b = channels(right);
        result = `#${a.map((channel, index) => Math.round((channel * Number(leftPercent) + b[index] * Number(rightPercent)) / 100)
          .toString(16).padStart(2, '0')).join('').toUpperCase()}`;
      } else if (alpha) {
        result = `rgba(${channels(alpha[1]).join(', ')}, ${alpha[2]})`;
      } else {return invalid(raw);}
    } else if (raw.startsWith('var(')) {
      result = color(raw);
    }
    resolving.delete(name);
    resolved.set(name, result);
    return result;
  }
  const output = tokenSource.replace(/^(\s*"(--[\w-]+)":\s*)"(<生成实际色值：[^"\n]*>)"/gm,
    (line, prefix, name) => `${prefix}"${resolve(name)}"`);
  return frontmatter ? frontmatter[0].replace(frontmatter[1], () => output) + source.slice(frontmatter[0].length) : output;
}

function resolveColorToken(tokens, name, seen = new Set()) {
  if (seen.has(name)) {return null;}
  seen.add(name);
  const value = tokens[name];
  if (/^#[\da-f]{6}$/i.test(value || '')) {return value.toUpperCase();}
  const alias = /^var\((--[\w-]+)(?:,\s*([^)]+))?\)$/.exec(value || '');
  return alias ? resolveColorToken(tokens, alias[1], seen) || alias[2] || null : null;
}

module.exports = { DESIGN_SKILL_ROOT, PLAN_SKILL_ROOT, loadThemeIndex, themeTemplatePath, themeNavTheme, resolveThemeColors, resolveColorToken };
