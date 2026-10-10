'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { fetchFormPageList } = require('./form-navigation');
const { fetchSchemaRecord, resolveCodeBundleSchema } = require('./get-schema');
const { throwCommandError } = require('../core/command-errors');
const { t } = require('../core/i18n');

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const pointer = value => String(value).replace(/~/g, '~0').replace(/\//g, '~1');

// Findings are review candidates, never a license to delete business code or all styles.
function inspectUpgradeSchema(schema) {
  const content = schema.content || schema;
  const sources = [];
  const styleCandidates = [];
  const blockers = [];
  let jsxCount = 0;
  let canvasCount = 0;
  function walk(value, at) {
    if (typeof value === 'string') {
      if (/\/(?:style|css|customStyle|customCss)(?:\/|$)/i.test(at) || /createElement\s*\(\s*['"]style['"]|insertRule\s*\(|(?:parent|top)\.document|contentDocument|formDetail|inject\w*(?:Theme|Style)|<style\b|--(?:pod-|color-brand)/i.test(value)) {
        styleCandidates.push({ pointer: at, sha256: hash(value), reviewRequired: true });
      }
      return;
    }
    if (!value || typeof value !== 'object') { return; }
    const isInstance = Boolean(value.id || value.props || value.children);
    if (isInstance && value.componentName === 'Jsx') { jsxCount++; }
    if (isInstance && value.componentName === 'YidaCodeCanvas') {
      canvasCount++;
      if (typeof value.props?.code === 'string' && value.props.code.trim()) {
        sources.push({ kind: 'canvas', pointer: `${at}/props/code`, code: value.props.code });
      } else { blockers.push({ code: 'CANVAS_SOURCE_MISSING', pointer: at }); }
    }
    for (const [key, child] of Object.entries(value)) { walk(child, `${at}/${pointer(key)}`); }
  }
  walk(content, '');
  const moduleSource = content.actions?.module?.source;
  if (typeof moduleSource === 'string' && moduleSource.trim()) {
    sources.push({ kind: jsxCount ? 'legacy-jsx' : 'actions', pointer: '/actions/module/source', code: moduleSource });
  } else if (jsxCount) { blockers.push({ code: 'LEGACY_JSX_SOURCE_MISSING', pointer: '/actions/module/source' }); }
  // A multi-component page cannot safely be replaced by publish's single Canvas template.
  if (canvasCount > 1 || jsxCount > 1 || (jsxCount && canvasCount)) {
    blockers.push({ code: 'MIXED_PAGE_REQUIRES_SCHEMA_PRESERVING_MIGRATION', pointer: '/pages' });
  }
  return { sources, styleCandidates, blockers, jsxCount, canvasCount };
}

async function prepareAppThemeUpgrade(params, authRef) {
  if (!params.outputDir) {
    throwCommandError(t('upgrade_app_theme.prepare_output_required'), { code: 'APP_THEME_PREPARE_OUTPUT_REQUIRED' });
  }
  const outputDir = path.resolve(params.outputDir);
  if (fs.existsSync(outputDir)) {
    throwCommandError(t('upgrade_app_theme.prepare_exists'), { code: 'APP_THEME_PREPARE_OUTPUT_EXISTS' });
  }
  const forms = await fetchFormPageList(params.appType, authRef);
  // Never overwrite a previous backup or trust resource names as filesystem paths.
  fs.mkdirSync(path.dirname(outputDir), { recursive: true });
  fs.mkdirSync(outputDir);
  const records = [];
  for (const [index, form] of forms.entries()) {
    const dir = path.join(outputDir, `resource-${index + 1}`);
    fs.mkdirSync(dir);
    const resource = { ...form, sources: [], styleCandidates: [], blockers: [], status: 'pending-review' };
    records.push(resource);
    try {
      const record = await fetchSchemaRecord(params.appType, form, authRef, 0, { resolveCodeBundles: false });
      if (!record.success) { throw new Error(record.errorMsg); }
      const raw = JSON.stringify(record.schema, null, 2);
      fs.writeFileSync(path.join(dir, 'schema.original.json'), raw, { flag: 'wx' });
      resource.schemaFile = path.join(dir, 'schema.original.json');
      resource.schemaSha256 = hash(raw);
      const resolved = await resolveCodeBundleSchema(JSON.parse(raw), params.appType, form.formUuid, authRef);
      fs.writeFileSync(path.join(dir, 'schema.resolved.json'), JSON.stringify(resolved, null, 2), { flag: 'wx' });
      const inspected = inspectUpgradeSchema(resolved);
      Object.assign(resource, { styleCandidates: inspected.styleCandidates, blockers: inspected.blockers,
        kind: inspected.jsxCount ? 'legacy-jsx' : inspected.canvasCount ? 'canvas' : 'native-form-or-page' });
      for (const [sourceIndex, source] of inspected.sources.entries()) {
        const ext = source.kind === 'canvas' ? 'canvas.jsx' : source.kind === 'legacy-jsx' ? 'oyd.jsx' : 'js';
        const file = path.join(dir, `source-${sourceIndex + 1}.${ext}`);
        fs.writeFileSync(file, source.code, { flag: 'wx' });
        resource.sources.push({ kind: source.kind, pointer: source.pointer, file, sha256: hash(source.code) });
      }
    } catch (error) {
      resource.blockers.push({ code: error.code || 'SCHEMA_OR_SOURCE_FETCH_FAILED', message: error.message });
    }
    if (resource.blockers.length) { resource.status = 'blocked'; }
  }
  const manifestFile = path.join(outputDir, 'upgrade-plan.json');
  const blockedCount = records.filter(record => record.blockers.length).length;
  const output = { success: blockedCount === 0, stage: blockedCount ? 'blocked' : 'prepared',
    appType: params.appType, corpId: authRef.corpId, baseUrl: authRef.baseUrl,
    createdAt: new Date().toISOString(), manifestFile, remoteModified: false, appUpgradeComplete: false,
    inventorySource: 'form-navigation', inventoryCoverageVerified: false,
    total: records.length, blockedCount, resources: records };
  fs.writeFileSync(manifestFile, JSON.stringify(output, null, 2), { flag: 'wx' });
  return output;
}

module.exports = { inspectUpgradeSchema, prepareAppThemeUpgrade };
