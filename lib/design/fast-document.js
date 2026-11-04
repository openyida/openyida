'use strict';

const fs = require('fs');
const path = require('path');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { loadThemeIndex, themeSelectionDetails } = require('../design-plan/themes');
const { normalizeCssColorToHex } = require('../app/custom-theme');
const { parseDesignDocument, serializeDesignDocument, validateDesignDocument } = require('./document');

const PAGE_TEXT = ['pageId', 'name', 'sceneKey', 'primaryTask', 'firstScreenFocus', 'layout', 'surface', 'primaryAction', 'states', 'responsive'];
const filled = value => typeof value === 'string' && value.trim().length > 0;
const object = value => value && typeof value === 'object' && !Array.isArray(value);

// Fast supplies project decisions; the shared renderer owns tokens, YAML,
// anchors and ordered chapters. No plan, approval or business resource is created.
function renderFastDocument(spec, options = {}) {
  const issues = [];
  const issue = (field, expected) => issues.push({ path: field, expected });
  if (!object(spec)) {issue('spec', 'object');}
  else {
    for (const field of ['name', 'themeId', 'primaryColor']) {if (!filled(spec[field])) {issue(field, 'nonempty string');}}
    if (!object(spec.direction) || !filled(spec.direction.label) || !filled(spec.direction.description)) {
      issue('direction', { label: '<project direction>', description: '<business-specific visual rationale>' });
    }
    if (!['top', 'side'].includes(spec.navigation?.structure)) {issue('navigation.structure', 'top | side');}
    for (const field of ['tokens', 'appConfig', 'iconSystem', 'creativeDirection']) {
      if (spec[field] !== undefined && !object(spec[field])) {issue(field, 'object');}
    }
    if (!Array.isArray(spec.pages)) {issue('pages', 'array');}
    const ids = new Set();
    for (const [index, page] of (Array.isArray(spec.pages) ? spec.pages : []).entries()) {
      const prefix = `pages[${index}]`;
      if (!object(page)) {issue(prefix, 'object'); continue;}
      for (const field of PAGE_TEXT) {if (!filled(page[field])) {issue(`${prefix}.${field}`, 'nonempty project-specific string');}}
      for (const field of ['blocks', 'acceptanceChecks']) {
        if (!Array.isArray(page[field]) || !page[field].length || !page[field].every(filled)) {issue(`${prefix}.${field}`, 'nonempty string array');}
      }
      if (ids.has(page.pageId)) {issue(`${prefix}.pageId`, 'unique pageId');}
      ids.add(page.pageId);
      if (filled(page.sceneKey) && !/^[\p{L}\p{N}_-]+$/u.test(page.sceneKey)) {issue(`${prefix}.sceneKey`, 'letters, numbers, underscore or hyphen');}
    }
    if (!object(spec.assetStrategy) || !Array.isArray(spec.assetStrategy.pages)) {issue('assetStrategy', { pages: [] });}
  }
  if (issues.length) {
    throw new CliError(t('design_document.invalid', issues[0].path, 'FAST_DESIGN_SPEC_INVALID'), {
      code: 'FAST_DESIGN_SPEC_INVALID', details: { issues },
    });
  }
  const themes = loadThemeIndex().themes;
  const theme = themes.find(item => item.themeId === spec.themeId);
  if (!theme) {
    throw new CliError(t('design_document.invalid', 'themeId', 'UNKNOWN_THEME'), {
      code: 'FAST_DESIGN_SPEC_INVALID', details: themeSelectionDetails(spec.themeId, 'themeId', themes),
    });
  }
  if (theme.themeId === 'app-pop' && !['explicit-request', 'showcase'].includes(spec.popArtContext)) {
    throw new CliError(t('design_document.invalid', 'popArtContext', 'EXPLICIT_CONTEXT_REQUIRED'), {
      code: 'FAST_DESIGN_SPEC_INVALID', details: { allowed: ['explicit-request', 'showcase'] },
    });
  }
  if (theme.supportedNavigationLayouts && !theme.supportedNavigationLayouts.includes(spec.navigation.structure)) {
    throw new CliError(t('design_document.invalid', 'navigation.structure', 'UNSUPPORTED_NAVIGATION_LAYOUT'), {
      code: 'FAST_DESIGN_SPEC_INVALID', details: { themeId: theme.themeId, supported: theme.supportedNavigationLayouts },
    });
  }
  const primaryColor = normalizeCssColorToHex(spec.primaryColor);
  if (!primaryColor) {
    throw new CliError(t('design_document.invalid', 'primaryColor', 'HEX_REQUIRED'), { code: 'FAST_DESIGN_SPEC_INVALID' });
  }
  const plan = {
    schemaVersion: '1.0', meta: { projectName: spec.name, appName: spec.name },
    overview: { summary: spec.summary || spec.direction.description },
    pages: { customPageDetails: spec.pages.map(page => ({ ...page,
      density: page.density || 'comfortable', layoutPattern: { id: page.sceneKey },
      pageSpecHandoff: { scene: page.sceneKey, ...(page.entryMode ? { entryMode: page.entryMode } : {}),
        ...(page.navigation ? { navigation: page.navigation } : {}) },
    })) },
    execution: { appConfig: spec.appConfig || {} },
    visualStyle: { tokens: { '--color-brand1-6': primaryColor, ...spec.tokens }, creativeDirection: spec.creativeDirection, forUser: {
      selectedTheme: theme, visualDirection: spec.direction,
      navigationStyle: spec.navigation,
      colorStrategy: { primaryColor, source: spec.colorSource || 'business-inferred' },
      pageApplications: spec.pages, assetStrategy: spec.assetStrategy,
      ...(spec.iconSystem ? { iconSystem: spec.iconSystem } : {}),
    } },
  };
  const outputDir = options.outputDir || '.';
  const rendered = require('../design-plan/materialize').renderDesign(plan, { outputDir, draft: true });
  const parsed = parseDesignDocument(rendered);
  delete parsed.metadata.buildPlanRevision;
  const markdown = serializeDesignDocument(parsed);
  const validation = validateDesignDocument(markdown);
  return { markdown, metadata: parsed.metadata, validation };
}

function generateFastDocument(inputFile, outputFile) {
  const input = path.resolve(inputFile), output = path.resolve(outputFile);
  if (input === output || fs.existsSync(output)) {
    throw new CliError(t('design_document.invalid', output, 'OUTPUT_EXISTS'), { code: 'SAMPLE_OUTPUT_EXISTS' });
  }
  let spec;
  try {spec = JSON.parse(fs.readFileSync(input, 'utf8'));} catch (error) {
    throw new CliError(t('design_document.read_error', input), {
      code: 'FAST_DESIGN_SPEC_INVALID', details: { sourcePath: input, reason: error.code || 'INVALID_JSON' },
    });
  }
  const { markdown, metadata, validation } = renderFastDocument(spec, { outputDir: path.dirname(output) });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, markdown, { flag: 'wx' });
  return { success: true, mode: 'fast', designFile: output, themeId: spec.themeId, pages: validation.pages,
    tokenCount: validation.tokenCount, sceneRecipes: metadata.sceneRecipes,
    references: { components: Object.keys(metadata.components), states: Object.keys(metadata.states) },
    nextCheckArgv: ['check-design', output, '--json'],
    nextThemeArgv: ['sample', 'yida-design', 'app-theme', '--output', metadata.themeProfile.themeFile, '--design-file', output],
  };
}

module.exports = { renderFastDocument, generateFastDocument };
