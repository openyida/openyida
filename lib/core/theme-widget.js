'use strict';

const fs = require('fs');
const path = require('path');
const { buildSkillsDiagnostics } = require('./utils');
const { CliError } = require('./cli-error');
const { t } = require('./i18n');

const TEMPLATE_SOURCE = path.resolve(__dirname, '../../yida-skills/skills/yida-design/templates/theme-selector.html');
const TEMPLATE_IN_PACKAGE = path.join('skills', 'yida-design', 'templates', 'theme-selector.html');

function canonicalPath(target) {
  if (fs.lstatSync(target, { throwIfNoEntry: false })) {return fs.realpathSync(target);}
  return path.join(canonicalPath(path.dirname(target)), path.basename(target));
}

function fail(code, details) {
  throw new CliError(t('cli_argument.invalid', `theme-preview: ${code}`), { code, details });
}

// Resolve the same host skills roots as copy -skills, but prepare only the widget.
// A writable generic workspace fallback is not necessarily searched by the widget tool.
function prepareThemeSelector(options = {}) {
  const diagnostics = buildSkillsDiagnostics(options);
  const subtype = diagnostics.active_tool?.subtype;
  const allowedReasons = subtype === 'qwenwork_desktop'
    ? ['qwenwork_desktop_user_skills_dir']
    : subtype === 'qwenwork_web'
      ? ['qwenwork_web_configured_skills_path', 'qwenwork_web_workspace_market_skills'] : [];
  if (diagnostics.active_tool?.tool !== 'qwenwork' || !allowedReasons.length) {
    fail('THEME_WIDGET_QWENWORK_REQUIRED', { activeTool: diagnostics.active_tool });
  }
  const target = diagnostics.candidates.find(candidate => candidate.usable && allowedReasons.includes(candidate.reason));
  if (!target || diagnostics.diagnostics.config_content_error) {
    fail('THEME_WIDGET_SKILLS_ROOT_UNAVAILABLE', { configError: diagnostics.diagnostics.config_content_error });
  }
  const skillsRoot = path.dirname(target.path);
  const outputPath = path.join(target.path, TEMPLATE_IN_PACKAGE);
  const source = fs.readFileSync(TEMPLATE_SOURCE);
  const existing = fs.existsSync(outputPath);
  const resolvedOutput = canonicalPath(outputPath);
  const linkedToSource = existing && resolvedOutput === fs.realpathSync(TEMPLATE_SOURCE);
  const relative = path.relative(canonicalPath(skillsRoot), resolvedOutput);
  if (!linkedToSource && (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))) {
    fail('THEME_WIDGET_PATH_OUTSIDE_SKILLS', { outputPath });
  }
  // Existing linked installs can be used directly; never write back into package sources.
  if (!existing || !fs.readFileSync(outputPath).equals(source)) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, source);
  }
  if (!fs.readFileSync(outputPath).equals(source)) {
    fail('THEME_WIDGET_COPY_MISMATCH', { outputPath });
  }
  return {
    success: true,
    tool: 'qoder_show_widget',
    purpose: 'preview_only',
    selectionTool: 'ask_human',
    widget_path: path.relative(skillsRoot, outputPath).split(path.sep).join('/'),
    skillsRoot,
    outputPath,
  };
}

// Standalone preview works without a host bridge. All selections stay in ask_human.
function createThemePreview(args) {
  let ids;
  let popArtContext;
  let outputPath = path.resolve('.cache/samples/theme-preview.html');
  const seen = new Set();
  for (let i = 0; i < args.length; i += 1) {
    const flag = args[i];
    if (seen.has(flag)) {fail('SAMPLE_ARGUMENT_INVALID', { flag });}
    seen.add(flag);
    if (flag === '--json') {continue;}
    if (!['--theme-ids', '--output', '--pop-art-context'].includes(flag) || !args[i + 1] || args[i + 1].startsWith('--')) {
      fail('SAMPLE_ARGUMENT_INVALID', { flag });
    }
    const value = args[++i];
    if (flag === '--theme-ids') {ids = value.split(',').map(id => id.trim());}
    else if (flag === '--pop-art-context') {popArtContext = value;}
    else {outputPath = path.resolve(value);}
  }
  if (!ids?.length || ids.some(id => !id) || new Set(ids).size !== ids.length) {
    fail('SAMPLE_ARGUMENT_INVALID', { flag: '--theme-ids' });
  }
  const { POP_ART_ELIGIBILITY } = require('../design-plan/visual-policy');
  if (popArtContext && !POP_ART_ELIGIBILITY.allowedContexts.includes(popArtContext)) {
    fail('SAMPLE_ARGUMENT_INVALID', { flag: '--pop-art-context' });
  }
  if (ids.includes('app-pop') && !popArtContext) {
    fail('THEME_PREVIEW_CONTEXT_REQUIRED', { themeId: 'app-pop', allowedContexts: POP_ART_ELIGIBILITY.allowedContexts });
  }
  const catalog = require('../design-plan/init').catalog();
  const available = [...catalog.themes, catalog.creativeOption];
  const themes = ids.map(id => {
    const theme = available.find(item => item.themeId === id);
    if (!theme) {fail('APPLICATION_STYLE_UNKNOWN', { themeId: id });}
    return { id, name: theme.label,
      ...(theme.previewImage?.url ? { img: theme.previewImage.url } : {}) };
  });
  // Escape HTML-significant characters in the JSON data block, never interpolate markup.
  const json = JSON.stringify({ themes, ...(popArtContext ? { popArtContext } : {}) }).replace(/[<>&\u2028\u2029]/g,
    char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'));
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  // Conversation attachment renderers may disable scripts. Named templates use
  // their catalog image verbatim; render actual cards instead of an empty JS shell.
  const cards = themes.map(({ id, name, img }, index) => {
    const image = typeof img === 'string' && /^https:\/\//i.test(img)
      ? `<img class="preview" src="${escapeHtml(img)}" alt="${escapeHtml(name)} · 效果参考图">` : '';
    return `<article class="card" role="listitem" data-theme-id="${escapeHtml(id)}" aria-labelledby="theme-title-${index}"><h2 id="theme-title-${index}">${escapeHtml(name)}</h2>${image}</article>`;
  }).join('\n');
  const html = fs.readFileSync(TEMPLATE_SOURCE, 'utf8').replace(
    '<script id="preview-data" type="application/json">{}</script>',
    () => `<script id="preview-data" type="application/json">${json}</script>`)
    .replace('<div id="themes" class="themes" role="list" aria-label="风格效果参考"></div>',
      () => `<div id="themes" class="themes" role="list" aria-label="风格效果参考">${cards}</div>`)
    .replace(/\s*<script>[\s\S]*?<\/script>/g, '');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, { flag: 'wx' });
  return { success: true, purpose: 'preview_only', selectionTool: 'ask_human', outputPath,
    attachment: { name: path.basename(outputPath), path: outputPath },
    presentation: require('../design-plan/visual-policy').getVisualDecisionPolicy().themeSelection.preview.presentation,
    themes: themes.map(({ id, name }, index) => ({ number: index + 1, themeId: id, name })) };
}

module.exports = { prepareThemeSelector, createThemePreview };
