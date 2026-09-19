'use strict';

const fs = require('fs');
const path = require('path');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { DESIGN_SKILL_ROOT, loadThemeIndex } = require('../design-plan/themes');
const START = '/* OPENYIDA APPLICATION STYLE RECIPES START';
const END = '/* OPENYIDA APPLICATION STYLE RECIPES END */';
const CREATIVE_TOKENS = [
  '--pod-page-bg-color', '--pod-card-bg-color', '--color-text1-4',
  '--form-element-medium-corner', '--form-element-medium-height',
  '--pod-page-footer-bg-color', '--pod-sticky-footer-box-shadow',
  '--oyd-content-width', '--oyd-content-padding', '--oyd-field-gap',
  '--oyd-heading-font', '--oyd-heading-size', '--oyd-rule-style',
];

function validateCreativeDirection(direction, tokens) {
  const missing = ['businessRationale', 'composition', 'typography', 'material', 'formLayout']
    .filter(key => typeof direction?.[key] !== 'string' || !direction[key].trim());
  missing.push(...CREATIVE_TOKENS.filter(key => typeof tokens?.[key] !== 'string' || !tokens[key].trim()));
  if (missing.length) {
    throw new CliError(t('design_document.invalid', 'creativeDirection', missing.join(', ')), {
      code: 'APPLICATION_STYLE_CREATIVE_INCOMPLETE', details: { missing },
    });
  }
}

function applyApplicationStyle(css, metadata, tokens) {
  const style = metadata.applicationStyle;
  if (style && (style.recipe !== 'application-style-v1' || !['template', 'creative'].includes(style.mode))) {
    throw new CliError(t('design_document.invalid', 'applicationStyle', 'APPLICATION_STYLE_INVALID'), { code: 'APPLICATION_STYLE_INVALID' });
  }
  if (style?.mode === 'creative') {validateCreativeDirection(metadata.creativeDirection, tokens);}
  const first = css.indexOf(START);
  const last = css.indexOf(END);
  if (first >= 0 && last < first) {
    throw new CliError(t('design_document.invalid', 'app_theme.css', 'APPLICATION_STYLE_CSS_INVALID'), { code: 'APPLICATION_STYLE_CSS_INVALID' });
  }
  const recipe = style
    ? fs.readFileSync(path.join(DESIGN_SKILL_ROOT, 'references/theme/application-style-recipes.css'), 'utf8').trim()
    : '';
  // Only the managed recipe block is replaced. User-authored rules stay intact.
  if (first >= 0) {return css.slice(0, first) + recipe + css.slice(last + END.length);}
  return recipe ? `${css.trimEnd()}\n\n${recipe}\n` : css;
}

function exportApplicationStyle(id, outputDirectory) {
  const theme = loadThemeIndex().themes.find(item => item.themeId === id && item.collection === 'application-styles');
  if (!theme) {throw new CliError(t('design_document.invalid', id || '--style-id', 'APPLICATION_STYLE_UNKNOWN'), { code: 'APPLICATION_STYLE_UNKNOWN' });}
  const directory = path.resolve(outputDirectory);
  const assets = [['design.md', theme.templatePath], ['app_theme.css', theme.cssTemplatePath], ['form-layout.json', theme.formLayoutPath]];
  const outputs = assets.map(([name, relative]) => {
    const source = path.resolve(DESIGN_SKILL_ROOT, relative);
    const target = path.join(directory, name);
    const root = path.resolve(DESIGN_SKILL_ROOT, 'templates/design-themes') + path.sep;
    if (!source.startsWith(root) || fs.existsSync(target)) {
      throw new CliError(t('design_document.invalid', target, 'APPLICATION_STYLE_OUTPUT_CONFLICT'), { code: 'APPLICATION_STYLE_OUTPUT_CONFLICT' });
    }
    return { source, target, content: fs.readFileSync(source, 'utf8') };
  });
  fs.mkdirSync(directory, { recursive: true });
  for (const item of outputs) {fs.writeFileSync(item.target, item.content, { flag: 'wx' });}
  return { success: true, mode: theme.mode, themeId: id, authoringRequired: true, outputs: outputs.map(item => item.target) };
}

module.exports = { applyApplicationStyle, validateCreativeDirection, CREATIVE_TOKENS, exportApplicationStyle };
