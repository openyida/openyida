'use strict';

// Each theme's design.md owns its complete visual system. This maintainer tool
// compiles paired CSS only; it never rewrites design prose, tokens or form layouts.
const fs = require('fs');
const path = require('path');
const { parseDesignDocument } = require('../lib/design/document');
const { resolveThemeColors, loadThemeIndex, DESIGN_SKILL_ROOT } = require('../lib/design-plan/themes');
const { applyDesignTokens, readDesignTokens } = require('../lib/app/theme-from-design');
const { writeFiles } = require('../lib/design-plan/files');
const { rootDeclarations } = require('../lib/core/theme-brand-scale');
const { validatePalette } = require('../lib/design/palette-contrast');
const platformCss = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, 'references/theme/app-custom-theme-template.css'), 'utf8');

/** Serialize template metadata without inserting user text into token expressions. */
function yaml(value, depth = 0) {
  return Object.entries(value).map(([key, item]) => {
    const prefix = `${'  '.repeat(depth)}${key.startsWith('--') ? JSON.stringify(key) : key}:`;
    return item && typeof item === 'object' ? `${prefix}\n${yaml(item, depth + 1)}` : `${prefix} ${JSON.stringify(String(item))}`;
  }).join('\n');
}

/** Compile the complete authored theme into scoped CSS, retaining brand placeholders. */
function cssTemplate(markdown) {
  // Resolve only to reuse the platform's scope/recipe writer, then restore every
  // project-dependent value. The temporary seed never becomes a template default.
  const metadata = parseDesignDocument(markdown).metadata;
  if (metadata.applicationStyle?.mode === 'creative') {delete metadata.applicationStyle;}
  const source = `---\n${yaml(metadata)}\n---\n`;
  const resolved = resolveThemeColors(source.replace(/\{\{PRIMARY_COLOR\}\}/g, '#2C73A9'));
  const before = {};
  const collect = node => Object.entries(node).forEach(([key, value]) => {
    if (key.startsWith('--')) {before[key] = String(value);}
    else if (value && typeof value === 'object') {collect(value);}
  });
  collect(metadata.tokens);
  const after = readDesignTokens(resolved);
  // Restore authoring expressions by token identity. An independently designed
  // border or accent may happen to equal the temporary seed and must stay literal.
  const bridges = {
    '--color-brand-1': 'var(--color-brand1-10)', '--color-brand-2': 'var(--color-brand1-1)',
    '--color-brand-3': 'var(--color-brand1-6)', '--color-brand-4': 'var(--color-brand1-9)',
    '--color-group': [6, 1, 5, 2, 9, 3].map(slot => `var(--color-brand1-${slot})`).join(', '),
  };
  const compiled = applyDesignTokens(platformCss, resolved);
  const audit = validatePalette(rootDeclarations(compiled.replace(/\/\*[\s\S]*?\*\//g, '')));
  if (audit.unresolved.length) {throw new Error(`Unresolved template palette: ${audit.unresolved.map(pair => pair.role).join(', ')}`);}
  return compiled
    .replace(/^(\s*(--[\w-]+)\s*:\s*)([^;\n]+);/gm, (_, prefix, name, value) =>
      `${prefix}${value.trim() === after[name] && /\{\{|<生成实际色值：/.test(before[name] || '')
        ? before[name] : (!(name in before) && bridges[name]) || value};`)
    .replace('本模板默认品牌种子为 coffee 咖啡色；最终配色和圆角以 design.md 的 tokens 为准。',
      '品牌值保留项目占位和派生说明；先完成 design.md，再生成实际主题 CSS。')
    .replace(/\s+$/, '\n');
}

/** Compile every template first so an invalid design cannot cause partial writes. */
function build({ root = DESIGN_SKILL_ROOT, themes = loadThemeIndex().themes, check = false } = {}) {
  const outputs = themes.map(theme => {
    const directory = path.resolve(root, 'templates/design-themes', theme.themeId);
    const source = path.resolve(root, theme.templatePath);
    const output = path.resolve(root, theme.cssTemplatePath);
    if (source !== path.join(directory, 'design.md') || output !== path.join(directory, 'app_theme.css')) {
      throw new Error(`Invalid theme paths: ${theme.themeId}`);
    }
    return [output, cssTemplate(fs.readFileSync(source, 'utf8'))];
  });
  const changed = outputs.filter(([file, css]) => !fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== css);
  if (check && changed.length) {throw new Error(`Theme CSS out of date: ${changed.map(([file]) => path.relative(root, file)).join(', ')}`);}
  if (!check && changed.length) {writeFiles(changed);}
  return changed.map(([file]) => file);
}

if (require.main === module) {
  if (process.argv.slice(2).some(arg => arg !== '--check')) {throw new Error('Usage: node scripts/build-application-styles.js [--check]');}
  build({ check: process.argv.includes('--check') });
}
module.exports = { build, cssTemplate };
