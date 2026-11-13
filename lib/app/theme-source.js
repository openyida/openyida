'use strict';

const fs = require('fs');
const path = require('path');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { parseDesignDocument } = require('../design/document');
const { DESIGN_SKILL_ROOT, resolveTheme } = require('../design-plan/themes');
const { applyReportThemeTokens } = require('./report-theme-tokens');
const { applyDesignTokens } = require('./theme-from-design');
const SOURCE = /^\/\* openyida-theme-source: ([a-z0-9-]+) \*\/\r?\n/m;

function sourceId(markdown) {
  const metadata = parseDesignDocument(markdown, { legacyTokenValues: true }).metadata;
  return metadata.themeProfile?.sourceThemeId ?? metadata.themeId;
}

// Resolve only catalog paths, never a project-supplied CSS path or theme directory.
function themeSource(markdown) {
  const id = sourceId(markdown);
  const theme = id !== undefined ? resolveTheme(id, 'themeProfile.sourceThemeId') : undefined;
  const relative = theme && theme.mode !== 'creative' ? theme.cssTemplatePath : 'references/theme/app-custom-theme-template.css';
  const file = path.resolve(DESIGN_SKILL_ROOT, relative);
  if (!file.startsWith(DESIGN_SKILL_ROOT + path.sep)) {throw new Error('Invalid theme CSS path');}
  return { id: id || 'legacy', css: fs.readFileSync(file, 'utf8'), paired: theme?.mode === 'template',
    design: theme?.mode === 'template' ? fs.readFileSync(path.resolve(DESIGN_SKILL_ROOT, theme.templatePath), 'utf8') : undefined };
}

function generateThemeCss(markdown, existingCss, previousMarkdown) {
  const source = themeSource(markdown);
  const marker = existingCss?.match(SOURCE)?.[1];
  // An exported paired stylesheet is also a valid first-generation input.
  // Unknown historical CSS cannot safely be relabeled as a different template.
  const previousId = marker || (previousMarkdown && sourceId(previousMarkdown))
    || (existingCss?.startsWith(source.css.trimEnd()) ? source.id : 'legacy');
  if (existingCss !== undefined && previousId !== source.id) {
    throw new CliError(t('theme_source.conflict'), {
      code: 'THEME_SOURCE_CONFLICT', details: { previousThemeId: previousId, themeId: source.id },
    });
  }
  const input = existingCss ?? source.css;
  // The paired CSS wins when its design has a different authored default.
  // Only project deltas and unresolved brand expressions are instantiated.
  const css = applyReportThemeTokens(applyDesignTokens(input, markdown, previousMarkdown ?? source.design, { paired: source.paired }));
  // Legacy files keep their marker-free format. Named and creative outputs
  // retain identity even when the file is renamed or its token snapshot is lost.
  return source.id === 'legacy' ? css : `/* openyida-theme-source: ${source.id} */\n${css.replace(SOURCE, '')}`;
}

module.exports = { generateThemeCss, sourceId, themeSource };
