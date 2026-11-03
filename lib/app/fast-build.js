'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { renderFastDocument } = require('../design/fast-document');
const { generateThemeCss } = require('./theme-source');
const { writeFiles } = require('../design-plan/files');

const KIND = 'openyida-fast-build';
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const filled = value => typeof value === 'string' && !!value.trim();
const sha = value => crypto.createHash('sha256').update(value).digest('hex');

function invalid(issues) {
  throw new CliError(t('design_document.invalid', issues[0].path, 'FAST_BUILD_INVALID'), {
    code: 'FAST_BUILD_INVALID', details: { issues },
  });
}

// These are declarations, not proof that platform resources or permissions exist.
function validateFastBuild(spec) {
  const issues = [];
  const add = (field, expected) => issues.push({ path: field, expected });
  if (!object(spec)) {invalid([{ path: 'spec', expected: 'object' }]);}
  if (spec.mode !== undefined && spec.mode !== 'fast') {add('mode', 'fast');}
  if (spec.intake?.designMode !== undefined && spec.intake.designMode !== 'fast') {add('intake.designMode', 'fast');}
  for (const field of ['resources', 'roles', 'businessRules', 'acceptanceChecks']) {
    if (!Array.isArray(spec[field])) {add(field, 'array; use [] when not applicable');}
  }
  if (!Array.isArray(spec.pages)) {add('pages', 'array');}
  if (Array.isArray(spec.acceptanceChecks) && (!spec.acceptanceChecks.length || !spec.acceptanceChecks.every(filled))) {
    add('acceptanceChecks', 'nonempty string array');
  }
  if (Array.isArray(spec.businessRules) && !spec.businessRules.every(filled)) {add('businessRules', 'string array');}
  const names = new Set(), keys = new Set();
  const resources = Array.isArray(spec.resources) ? spec.resources : [];
  for (const [i, resource] of resources.entries()) {
    const field = `resources[${i}]`;
    if (!object(resource)) {add(field, 'object'); continue;}
    if (!filled(resource.key) || keys.has(resource.key)) {add(`${field}.key`, 'unique nonempty key');}
    if (!filled(resource.name) || names.has(resource.name)) {add(`${field}.name`, 'unique nonempty name');}
    keys.add(resource.key); names.add(resource.name);
    if (!['normal-form', 'process-form', 'report', 'integration'].includes(resource.type)) {
      add(`${field}.type`, 'normal-form | process-form | report | integration; display pages belong in pages');
    }
    if (['normal-form', 'process-form'].includes(resource.type) && !resource.formUuid
      && (!Array.isArray(resource.fields) || !resource.fields.length || !resource.fields.every(object))) {
      add(`${field}.fields`, 'nonempty field-definition array for a new form');
    }
    if (resource.formUuid !== undefined && !filled(resource.formUuid)) {add(`${field}.formUuid`, 'nonempty verified resource ID');}
    if (resource.dependsOn !== undefined && (!Array.isArray(resource.dependsOn) || !resource.dependsOn.every(filled))) {
      add(`${field}.dependsOn`, 'resource key array');
    }
  }
  for (const [i, resource] of resources.entries()) {
    for (const key of Array.isArray(resource?.dependsOn) ? resource.dependsOn : []) {
      if (!keys.has(key) || key === resource.key) {add(`resources[${i}].dependsOn`, 'existing independent resource keys');}
    }
  }
  const visited = new Set(), active = new Set();
  const visit = key => {
    if (active.has(key)) {add('resources.dependsOn', 'acyclic dependencies'); return;}
    if (visited.has(key)) {return;}
    active.add(key);
    const resource = resources.find(item => item?.key === key);
    for (const dep of Array.isArray(resource?.dependsOn) ? resource.dependsOn : []) {if (keys.has(dep)) {visit(dep);}}
    active.delete(key); visited.add(key);
  };
  for (const key of keys) {visit(key);}
  for (const [i, role] of (Array.isArray(spec.roles) ? spec.roles : []).entries()) {
    if (!object(role) || !filled(role.name) || !filled(role.scope) || !Array.isArray(role.operations)
      || !role.operations.length || !role.operations.every(filled)) {
      add(`roles[${i}]`, { name: '<role>', scope: '<server-side data scope>', operations: ['<allowed business action>'] });
    }
  }
  for (const [i, page] of (Array.isArray(spec.pages) ? spec.pages : []).entries()) {
    if (!object(page)) {add(`pages[${i}]`, 'object'); continue;}
    if (!filled(page.pageId) || !filled(page.name)) {add(`pages[${i}]`, 'nonempty pageId/name');}
    if (names.has(page.name)) {add(`pages[${i}].name`, 'unique resource/page name');}
    names.add(page.name);
    if (page.dataSources !== undefined && (!Array.isArray(page.dataSources)
      || !page.dataSources.every(key => keys.has(key)))) {add(`pages[${i}].dataSources`, 'existing resource key array');}
  }
  if (spec.navigationVisibility !== undefined && !Array.isArray(spec.navigationVisibility)) {add('navigationVisibility', 'array');}
  if (spec.constraints !== undefined && !object(spec.constraints)) {add('constraints', 'object');}
  if (spec.constraints?.prohibitedActions !== undefined && (!Array.isArray(spec.constraints.prohibitedActions)
    || !spec.constraints.prohibitedActions.every(filled))) {add('constraints.prohibitedActions', 'string array');}
  if (issues.length) {invalid(issues);}
  return spec;
}

function readFastBuild(file) {
  let context;
  try {context = JSON.parse(fs.readFileSync(file, 'utf8'));} catch (error) {
    invalid([{ path: file, expected: 'readable Fast build-context.json', reason: error.code || 'INVALID_JSON' }]);
  }
  if (context?.kind !== KIND || context?.schemaVersion !== '1.0' || context?.mode !== 'fast') {
    invalid([{ path: file, expected: `${KIND} schemaVersion=1.0 mode=fast` }]);
  }
  validateFastBuild(context);
  if (!Array.isArray(context.assetStrategy?.pages) || !object(context.themeProfile)) {
    invalid([{ path: file, expected: 'generated assetStrategy and themeProfile' }]);
  }
  if (!context.constraints?.prohibitedActions?.includes('theme-file') && (!object(context.applicationTheme)
    || !filled(context.applicationTheme.themeColor) || !['light', 'dark'].includes(context.applicationTheme.navTheme))) {
    invalid([{ path: 'applicationTheme', expected: 'generated mandatory application theme contract' }]);
  }
  return context;
}

function prepareFastBuild(inputFile, outputDir, options = {}) {
  const input = path.resolve(inputFile), dir = path.resolve(outputDir);
  let bytes, spec;
  try {bytes = fs.readFileSync(input); spec = JSON.parse(bytes);} catch (error) {
    invalid([{ path: input, expected: 'readable Fast application JSON', reason: error.code || 'INVALID_JSON' }]);
  }
  validateFastBuild(spec);
  const contextFile = path.join(dir, 'build-context.json'), themeFile = path.join(dir, 'app_theme.css');
  // Reuse the strict visual compiler only in memory: no Markdown or plan output.
  const { markdown, metadata } = renderFastDocument(spec, { outputDir: dir });
  const skipTheme = spec.constraints?.prohibitedActions?.includes('theme-file');
  const css = skipTheme ? undefined : generateThemeCss(markdown);
  const themeProfile = { ...metadata.themeProfile, themeFile: skipTheme ? '' : themeFile,
    themeDelivery: skipTheme ? 'current-app-theme' : 'app-custom-theme-file' };
  const context = { ...spec, kind: KIND, schemaVersion: '1.0', mode: 'fast',
    source: { path: input, sha256: sha(bytes) }, themeProfile,
    ...(!skipTheme ? { applicationTheme: { required: true, source: 'fast-build',
      themeFile, themeColor: themeProfile.themeColor, navTheme: themeProfile.navTheme } } : {}),
  };
  if (skipTheme) {delete context.applicationTheme;}
  const files = [[contextFile, JSON.stringify(context, null, 2) + '\n'], ...(!skipTheme ? [[themeFile, css]] : [])];
  for (const [file, content] of files) {
    if (file === input) {invalid([{ path: file, expected: 'output distinct from input' }]);}
    if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') !== content) {
      throw new CliError(t('design_document.invalid', file, 'OUTPUT_EXISTS'), { code: 'SAMPLE_OUTPUT_EXISTS' });
    }
  }
  const assetTasks = require('../asset/asset-plan').buildAssetTasks(spec.assetStrategy, dir, { buildSpec: contextFile });
  if (!options.check) {writeFiles(files.filter(([file]) => !fs.existsSync(file)));}
  return { success: true, mode: 'fast', checkedOnly: options.check === true,
    outputs: { context: contextFile, ...(!skipTheme ? { theme: themeFile } : {}) },
    pages: spec.pages.map(({ pageId, name }) => ({ pageId, name })), resourceCount: spec.resources.length,
    theme: { themeColor: themeProfile.themeColor, navTheme: themeProfile.navTheme, contentTone: themeProfile.contentTone },
    assetTasks, ...(skipTheme ? { skipped: ['theme-file'] } : {}),
  };
}

module.exports = { KIND, validateFastBuild, readFastBuild, prepareFastBuild };
