'use strict';

const fs = require('fs');
const path = require('path');
const { CliError, isCliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { loadThemeIndex, themeTemplatePath, themeNavTheme, resolveThemeColors } = require('../design-plan/themes');
const { parseDesignDocument, serializeDesignDocument, extractDesignTokens } = require('../design/document');
const { normalizeCssColorToHex } = require('./custom-theme');
const { generateThemeCss } = require('./theme-source');
const { validatePalette } = require('../design/palette-contrast');

function preflight(error) {
  if (isCliError(error)) {
    if (/^DESIGN_/.test(error.code)) {error.message = t('cli_argument.invalid', `app_theme.css (${error.code})`);}
    error.details = { ...error.details, stage: 'preflight', retrySafe: true,
      sideEffectState: 'not_started', mutationPerformed: false };
  }
  return error;
}

function invalid(field, expected, actual) {
  throw preflight(new CliError(t('cli_argument.invalid', field), { code: 'FAST_THEME_INVALID',
    details: { issues: [{ path: field, expected, ...(actual !== undefined ? { actual } : {}) }] } }));
}

// Theme-only generation: no business plan, page specification or Plan renderer.
function prepareFastTheme(options) {
  let theme, color, css, palette, navTheme;
  try {
    theme = loadThemeIndex().themes.find(item => item.themeId === options.styleId);
    if (!theme) {invalid('--style-id', 'themeId from design-plan catalog --compact', options.styleId);}
    color = normalizeCssColorToHex(options.primaryColor);
    if (!color) {invalid('--primary-color', 'CSS hex or rgb color', options.primaryColor);}
    if (theme.themeId === 'app-pop' && !['explicit-request', 'showcase'].includes(options.popArtContext)) {
      invalid('--pop-art-context', 'explicit-request | showcase');
    }
    let custom = {};
    if (options.tokensFile) {
      try {custom = JSON.parse(fs.readFileSync(path.resolve(options.tokensFile), 'utf8'));}
      catch (error) {invalid('--tokens-file', 'readable theme-only JSON', error.code || 'INVALID_JSON');}
    }
    if (!custom || typeof custom !== 'object' || Array.isArray(custom) || (custom.tokens !== undefined
      && (!custom.tokens || typeof custom.tokens !== 'object' || Array.isArray(custom.tokens)))) {
      invalid('--tokens-file', '{ tokens: { "--token": "value" }, creativeDirection?: object }');
    }
    const parsed = parseDesignDocument(resolveThemeColors(fs.readFileSync(themeTemplatePath(theme), 'utf8')
      .replace(/\{\{PRIMARY_COLOR\}\}/g, color)));
    const tokens = { ...extractDesignTokens(parsed.metadata, { strict: false }), ...custom.tokens,
      '--color-brand1-6': color };
    for (const [name, value] of Object.entries(tokens)) {
      if (!/^--[\w-]+$/.test(name) || typeof value !== 'string') {invalid(`tokens.${name}`, 'CSS variable string');}
    }
    navTheme = theme.mode === 'creative' ? options.navTheme : themeNavTheme(theme);
    if (theme.mode !== 'creative' && options.navTheme !== undefined && options.navTheme !== navTheme) {
      invalid('--nav-theme', `derived from ${theme.themeId}: ${navTheme}`, options.navTheme);
    }
    if (!['light', 'dark'].includes(navTheme)) {invalid('--nav-theme', 'light | dark for free-creative');}
    if (theme.mode === 'creative') {require('./application-style').validateCreativeDirection(custom.creativeDirection, tokens);}
    const markdown = serializeDesignDocument({ metadata: { tokens,
      themeProfile: { sourceThemeId: theme.themeId, navTheme },
      ...(parsed.metadata.applicationStyle ? { applicationStyle: parsed.metadata.applicationStyle } : {}),
      ...(theme.mode === 'creative' ? { creativeDirection: custom.creativeDirection } : {}),
    }, body: '' });
    css = generateThemeCss(markdown);
    const root = /^:root\s*\{([\s\S]*?)^\}/m.exec(css);
    const actual = Object.fromEntries([...root[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
    palette = validatePalette({ ...tokens, ...actual }, { css });
  } catch (error) {throw preflight(error);}
  const output = path.resolve(options.output || '.cache/openyida/app_theme.css');
  if (fs.existsSync(output) && fs.readFileSync(output, 'utf8') !== css) {
    invalid('--output', 'new output path or identical existing stylesheet', output);
  }
  if (!options.check && !fs.existsSync(output)) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, css, { flag: 'wx' });
  }
  return { success: true, checkedOnly: options.check === true, themeId: theme.themeId,
    outputs: { theme: output }, theme: { themeColor: color, navTheme }, paletteContrast: { status: palette.unresolved.length ? 'partial' : 'pass', checkedPairs: palette.checks.length, unresolved: palette.unresolved },
    applicationTheme: { required: true, source: 'fast-theme', themeFile: output, themeColor: color, navTheme } };
}

module.exports = { prepareFastTheme, preflight };
