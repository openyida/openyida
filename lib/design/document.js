'use strict';

const yaml = require('js-yaml');
const path = require('path');
const fs = require('fs');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { concretePageText } = require('./page-content');
const { validateIconContrast } = require('./icon-contrast');
const CONTRACT = require('../../yida-skills/skills/yida-design/templates/design-themes/basic-tokens.json');

const HEADINGS = ['1. 风格摘要', '2. 页面视觉系统', '3. 基础组件表达', '4. 特色表达配方', '5. 项目应用与调整规则'];
const PAGE_LABELS = ['页面任务', '首屏焦点', '布局', '表面与组件', '主操作', '状态', '响应式', '验收'];
const BRAND_TOKENS = [1, 2, 3, 5, 6, 9, 10].map(n => `--color-brand1-${n}`);
const TOKEN_NAME = /^--[a-zA-Z_][\w-]*$/;
const ANCHOR = /^#[a-zA-Z][\w.:-]*$/;
const REFERENCE_KEY = /^[\p{L}\p{N}_-]+$/u;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

function invalid(field, code, details = {}) {
  throw new CliError(t('design_document.invalid', field, code), {
    code: 'DESIGN_DOCUMENT_INVALID', details: { field, issue: code, ...details },
  });
}

function jsonValue(value, field = 'metadata', active = new Set(), visited = new Set(), depth = 0) {
  if (depth > 128) {invalid(field, 'MAX_DEPTH');}
  if (value === null || ['string', 'boolean'].includes(typeof value)) {return;}
  if (typeof value === 'number' && Number.isFinite(value)) {return;}
  if (!object(value) && !Array.isArray(value)) {invalid(field, 'JSON_VALUE_REQUIRED');}
  if (active.has(value)) {invalid(field, 'CYCLIC_ALIAS');}
  if (visited.has(value)) {return;}
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    invalid(field, 'PLAIN_MAPPING_REQUIRED');
  }
  active.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) {invalid(`${field}.${key}`, 'UNSAFE_KEY');}
    jsonValue(child, `${field}.${key}`, active, visited, depth + 1);
  }
  active.delete(value);
  visited.add(value);
}

function parseDesignDocument(markdown, options = {}) {
  if (typeof markdown !== 'string') {invalid('document', 'STRING_REQUIRED');}
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
  if (!match) {invalid('frontmatter', 'FRONTMATTER_REQUIRED');}
  let metadata;
  try {
    const load = source => yaml.load(source, { schema: yaml.JSON_SCHEMA, json: false });
    metadata = load(match[1]);
    // Historical Fast files allowed bare HEX tokens. Opt in only for consumers
    // reading unversioned files; final document validation always uses real YAML.
    if (options.legacyTokenValues === true && object(metadata)
      && !Object.prototype.hasOwnProperty.call(metadata, 'schemaVersion')) {
      const compatible = match[1].replace(/^(\s*["']?--[\w-]+["']?\s*:\s*)(#[\da-f]{3,8})([ \t]*(?:#.*)?)$/gmi,
        (line, prefix, color, comment) => `${prefix}${JSON.stringify(color)}${comment}`);
      if (compatible !== match[1]) {metadata = load(compatible);}
    }
  } catch (error) {
    throw new CliError(t('design_document.yaml'), {
      code: 'DESIGN_DOCUMENT_INVALID', details: { field: 'frontmatter', issue: 'INVALID_YAML', reason: error.reason || error.message },
    });
  }
  if (!object(metadata)) {invalid('frontmatter', 'MAPPING_REQUIRED');}
  jsonValue(metadata);
  return { metadata, body: markdown.slice(match[0].length).replace(/\r\n/g, '\n') };
}

function serializeDesignDocument(metadata, body) {
  if (body === undefined && object(metadata) && object(metadata.metadata) && typeof metadata.body === 'string') {
    ({ metadata, body } = metadata);
  }
  if (!object(metadata) || typeof body !== 'string') {invalid('document', 'METADATA_AND_BODY_REQUIRED');}
  jsonValue(metadata);
  const lines = ['---'];
  const keyText = key => /^[a-zA-Z_][\w-]*$/.test(key) ? key : JSON.stringify(key);
  function tokenLines(node, indent) {
    return Object.entries(node).map(([key, value]) => {
      const prefix = `${' '.repeat(indent)}${keyText(key)}:`;
      return object(value) && Object.keys(value).length
        ? `${prefix}\n${tokenLines(value, indent + 2).join('\n')}`
        : `${prefix} ${JSON.stringify(value)}`;
    });
  }
  for (const [key, value] of Object.entries(metadata)) {
    if (key === 'tokens' && object(value) && Object.keys(value).length) {
      lines.push('tokens:', ...tokenLines(value, 2));
    } else {
      // JSON is a YAML subset and keeps names and arbitrary user text safely quoted.
      // assetStrategy deliberately remains one line for existing stored documents.
      lines.push(`${keyText(key)}: ${JSON.stringify(value)}`);
    }
  }
  lines.push('---', '', body.trim(), '');
  return lines.join('\n');
}

function cssValue(name, raw) {
  const value = typeof raw === 'number' && Number.isFinite(raw) ? String(raw) : raw;
  if (!TOKEN_NAME.test(name) || typeof value !== 'string' || !value.trim()
    || /[;{}\r\n<>]|\/\*|\*\//.test(value) || /^[|>]/.test(value)
    || /(?:javascript|data|vbscript|file|blob)\s*:/i.test(value)) {
    throw new CliError(t('design_document.token_value', name), { code: 'DESIGN_THEME_TOKEN_INVALID', details: { token: name } });
  }
  if (['--pod-app-root-bg-color', '--pod-page-bg-color', '--pod-card-bg-color'].includes(name)
    && /(?:gradient|url)\s*\(/i.test(value)) {
    invalid(name, 'COLOR_CANNOT_BE_IMAGE');
  }
  let quote = '';
  let depth = 0;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (char === '\\') {index++; continue;}
    if (quote) {if (char === quote) {quote = '';} continue;}
    if (char === '"' || char === "'") {quote = char;}
    else if (char === '(') {depth++;}
    else if (char === ')' && --depth < 0) {invalid(name, 'UNBALANCED_CSS_VALUE');}
  }
  if (quote || depth) {invalid(name, 'UNBALANCED_CSS_VALUE');}
  return value;
}

function flattenTokens(node, target, field, strict) {
  if (!object(node)) {invalid(field, 'TOKEN_MAPPING_REQUIRED');}
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('--')) {
      const scalar = cssValue(key, value);
      if (Object.prototype.hasOwnProperty.call(target, key) && (strict || target[key] !== scalar)) {
        throw new CliError(t('design_document.token_conflict', key), { code: 'DESIGN_THEME_TOKEN_CONFLICT', details: { token: key } });
      }
      if (/^--color-brand1-(4|7|8)$/.test(key)) {invalid(key, 'UNSUPPORTED_BRAND_TOKEN');}
      target[key] = scalar;
    } else {
      flattenTokens(value, target, `${field}.${key}`, strict);
    }
  }
}

function validateTokenReferences(tokens) {
  const dependencies = new Map(Object.entries(tokens).map(([name, value]) => [name, [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map(match => match[1])]));
  for (const [name, refs] of dependencies) {
    for (const ref of refs) {
      if (!(ref in tokens)) {invalid(name, 'UNDECLARED_TOKEN_REFERENCE', { reference: ref });}
    }
  }
  const active = new Set();
  const visited = new Set();
  function visit(name) {
    if (active.has(name)) {invalid(name, 'TOKEN_REFERENCE_CYCLE');}
    if (visited.has(name)) {return;}
    active.add(name);
    for (const ref of dependencies.get(name)) {visit(ref);}
    active.delete(name);
    visited.add(name);
  }
  for (const name of dependencies.keys()) {visit(name);}
}

function extractDesignTokens(metadata, options = {}) {
  const strict = options.strict === true;
  if (!object(metadata) || !object(metadata.tokens)) {
    throw new CliError(t('design_document.tokens_required'), { code: 'DESIGN_THEME_TOKENS_REQUIRED' });
  }
  jsonValue(metadata.tokens, 'tokens');
  const tokens = {};
  if (strict) {
    if (Object.keys(metadata.tokens).length !== 2 || !object(metadata.tokens['application-global']) || !object(metadata.tokens['custom-page'])) {
      invalid('tokens', 'GLOBAL_AND_CUSTOM_SCOPES_REQUIRED');
    }
    const globals = metadata.tokens['application-global'];
    if (Object.keys(globals).sort().join('|') !== Object.keys(CONTRACT.groups).sort().join('|')) {
      invalid('tokens.application-global', 'SIX_GLOBAL_GROUPS_REQUIRED');
    }
    for (const [group, expected] of Object.entries(CONTRACT.groups)) {
      const values = {};
      flattenTokens(globals[group], values, `tokens.application-global.${group}`, true);
      const otherGroups = Object.entries(CONTRACT.groups).filter(([name]) => name !== group).flatMap(([, names]) => names);
      if (expected.some(name => !(name in values)) || otherGroups.some(name => name in values)) {
        invalid(`tokens.application-global.${group}`, 'GLOBAL_TOKEN_SET_MISMATCH', { expected });
      }
    }
    for (const scope of ['application-global', 'custom-page']) {
      flattenTokens(metadata.tokens[scope], tokens, `tokens.${scope}`, true);
    }
    for (const name of ['--color-white', '--pod-table-cell-color', '--color-fill1-10', '--color-text1-5']) {
      if (tokens[name] !== CONTRACT.fixedValues[name]) {invalid(name, 'FIXED_PLATFORM_VALUE', { expected: CONTRACT.fixedValues[name] });}
    }
    // Both metadata groups are emitted into the application's :root. Shared
    // project tokens can back platform roles; only missing/cyclic refs are invalid.
    validateTokenReferences(tokens);
  } else {
    flattenTokens(metadata.tokens, tokens, 'tokens', false);
  }
  const missing = BRAND_TOKENS.filter(name => !tokens[name]);
  if (missing.length) {
    throw new CliError(t('design_document.brand_required', missing.join(', ')), {
      code: 'DESIGN_THEME_TOKENS_REQUIRED', details: { missing },
    });
  }
  validateIconContrast(metadata.iconSystem, tokens);
  return tokens;
}

// Strip fenced examples before interpreting document headings, anchors or labels.
function structuralLines(body) {
  const lines = body.split('\n');
  let fence = null;
  return lines.map(line => {
    const open = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (!fence && open) {fence = open[1]; return '';}
    if (fence) {
      if (new RegExp(`^ {0,3}${fence[0]}{${fence.length},}\\s*$`).test(line)) {fence = null;}
      return '';
    }
    return line;
  });
}

function documentAnchors(body) {
  const text = structuralLines(body).join('\n');
  const anchors = new Map();
  for (const match of text.matchAll(/<a\s+id=(?:"([^"]+)"|'([^']+)')\s*>\s*<\/a>/g)) {
    const id = '#' + (match[1] || match[2]);
    if (!ANCHOR.test(id)) {invalid('body', 'INVALID_ANCHOR', { anchor: id });}
    if (anchors.has(id)) {invalid('body', 'DUPLICATE_ANCHOR', { anchor: id });}
    anchors.set(id, match.index);
  }
  return { text, anchors };
}

function inlineValue(value) {
  const text = value.trim();
  const code = /^(`+)([^`]*)\1$/.exec(text);
  return code ? code[2].trim() : text;
}

function fastPrdPages(prdMarkdown) {
  const lines = structuralLines(prdMarkdown);
  const starts = lines.map((line, index) => /^## 4\. 页面与功能设计\s*$/.test(line) ? index : -1).filter(index => index >= 0);
  if (starts.length !== 1) {invalid('prd', 'ONE_STRUCTURED_HANDOFF_REQUIRED', { count: 0 });}
  const end = lines.findIndex((line, index) => index > starts[0] && /^## /.test(line));
  const section = lines.slice(starts[0] + 1, end < 0 ? undefined : end);
  const headings = section.map((line, index) => /^### /.test(line) ? index : -1).filter(index => index >= 0);
  const pages = [];
  for (let index = 0; index < headings.length; index++) {
    const entries = section.slice(headings[index] + 1, headings[index + 1]).flatMap(line => {
      const match = /^([ \t]*)[-*+]\s+(.+?)[：:][ \t]*(.*?)\s*$/.exec(line);
      return match ? [{ indent: match[1].replace(/\t/g, '    ').length, key: inlineValue(match[2]).replace(/^\*\*|\*\*$/g, ''), value: match[3] }] : [];
    });
    if (!entries.length) {continue;}
    const topIndent = Math.min(...entries.map(entry => entry.indent));
    const top = entries.filter(entry => entry.indent === topIndent);
    const field = (records, key) => {
      const matches = records.filter(entry => entry.key === key);
      if (matches.length > 1) {invalid(`prd.${key}`, 'DUPLICATE_PRD_FIELD');}
      return matches[0];
    };
    if (inlineValue(field(top, '页面类型')?.value || '') !== 'display-page') {continue;}
    const pageId = inlineValue(field(top, 'pageId')?.value || '');
    const parent = field(top, 'pageSpecHandoff');
    if (!parent) {invalid(`prd.pages.${pageId}.pageSpecHandoff`, 'PAGE_HANDOFF_REQUIRED');}
    const following = entries.slice(entries.indexOf(parent) + 1);
    const nextTop = following.findIndex(entry => entry.indent <= topIndent);
    const children = following.slice(0, nextTop < 0 ? undefined : nextTop);
    const childIndent = Math.min(...children.map(entry => entry.indent));
    const direct = children.filter(entry => entry.indent === childIndent);
    const designFile = inlineValue(field(direct, 'designFile')?.value || '');
    const rawRefs = inlineValue(field(direct, 'designRefs')?.value || '');
    let designRefs;
    if (rawRefs.startsWith('[')) {
      try {designRefs = JSON.parse(rawRefs);} catch {invalid('prd.designRefs', 'INVALID_DESIGN_REFERENCE');}
    } else {
      designRefs = rawRefs ? rawRefs.split(/[/、,，]/).map(inlineValue) : [];
    }
    pages.push({ pageId, pageSpecHandoff: { designFile, designRefs } });
  }
  return pages;
}

function prdHandoffPages(prdMarkdown) {
  const candidates = [];
  const lines = prdMarkdown.replace(/\r\n/g, '\n').split('\n');
  const declared = structuralLines(prdMarkdown).some(line => /^#{2,6} (?:\d+\.\s*)?结构化交接\s*$/.test(line));
  let fence;
  let content = [];
  for (const line of lines) {
    const start = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (!fence && start) {fence = { marker: start[1], info: start[2].trim() }; content = []; continue;}
    if (!fence) {continue;}
    if (!new RegExp(`^ {0,3}${fence.marker[0]}{${fence.marker.length},}\\s*$`).test(line)) {content.push(line); continue;}
    if (fence.info === 'json') {
      const source = content.join('\n');
      let value;
      try {value = JSON.parse(source);} catch {
        if (declared || /"pages"\s*:/.test(source) && /"(?:appConfig|resourceBlueprint)"\s*:/.test(source)) {
          invalid('prd', 'INVALID_STRUCTURED_HANDOFF');
        }
      }
      if (object(value) && 'pages' in value && ('appConfig' in value || 'resourceBlueprint' in value)) {
        if (!Array.isArray(value.pages) || !(object(value.appConfig) || Array.isArray(value.resourceBlueprint))) {
          invalid('prd', 'INVALID_STRUCTURED_HANDOFF');
        }
        candidates.push(value);
      }
    }
    fence = null;
  }
  if (fence?.info === 'json' && /"pages"\s*:/.test(content.join('\n'))
    && /"(?:appConfig|resourceBlueprint)"\s*:/.test(content.join('\n'))) {invalid('prd', 'INVALID_STRUCTURED_HANDOFF');}
  if (candidates.length > 1) {invalid('prd', 'ONE_STRUCTURED_HANDOFF_REQUIRED', { count: candidates.length });}
  if (candidates.length === 1) {return candidates[0].pages;}
  if (declared) {invalid('prd', 'INVALID_STRUCTURED_HANDOFF');}
  return fastPrdPages(prdMarkdown);
}

/** Compare existing document locations through symlinks; retain logical paths before files are written. */
function documentLocation(file) {
  const resolved = path.resolve(file);
  try {return fs.realpathSync(resolved);} catch (error) {
    if (!['ENOENT', 'ENOTDIR'].includes(error.code)) {throw error;}
    return resolved;
  }
}

function validatePrd(prdMarkdown, metadata, pageIds, options) {
  const prdPages = new Set();
  for (const page of prdHandoffPages(prdMarkdown)) {
    if (!object(page)) {invalid('prd.pages', 'PAGE_MAPPING_REQUIRED');}
    if (!object(page.pageSpecHandoff)) {continue;}
    const handoff = page.pageSpecHandoff;
    if (!nonempty(page.pageId) || prdPages.has(page.pageId)) {invalid('prd.pages', 'UNIQUE_PAGE_ID_REQUIRED');}
    prdPages.add(page.pageId);
    if (!nonempty(handoff.designFile)) {invalid(`prd.pages.${page.pageId}.designFile`, 'DESIGN_FILE_REQUIRED');}
    // A supplied document location is always checked. Relocated bundles must
    // explicitly provide their project root instead of skipping relative paths.
    if (options.designFile) {
      const expected = documentLocation(options.designFile);
      const resolved = documentLocation(path.resolve(options.baseDir || process.cwd(), handoff.designFile));
      if (resolved !== expected) {
        invalid(`prd.pages.${page.pageId}.designFile`, 'DESIGN_FILE_MISMATCH', { actual: handoff.designFile, resolved, expected });
      }
    }
    if (!Array.isArray(handoff.designRefs) || !handoff.designRefs.length) {invalid('prd.designRefs', 'NONEMPTY_ARRAY_REQUIRED');}
    for (const ref of handoff.designRefs) {
      if (typeof ref !== 'string' || !/^(themeProfile|(?:sceneRecipes|components|states)\.[\p{L}\p{N}_-]+)$/u.test(ref)) {
        invalid('prd.designRefs', 'INVALID_DESIGN_REFERENCE', { reference: ref });
      }
      const [root, key] = ref.split('.');
      const target = key === undefined ? metadata[root] : metadata[root]?.[key];
      if (!target) {invalid('prd.designRefs', 'MISSING_DESIGN_REFERENCE', { reference: ref });}
      if (root === 'sceneRecipes' && !target.pages.some(item => item.pageId === page.pageId)) {
        invalid('prd.designRefs', 'SCENE_PAGE_MISMATCH', { reference: ref, pageId: page.pageId });
      }
    }
  }
  if ([...pageIds].sort().join('|') !== [...prdPages].sort().join('|')) {invalid('prd.pages', 'DESIGN_PAGE_COVERAGE_MISMATCH');}
}

function validateDesignDocument(markdown, options = {}) {
  const { metadata, body } = parseDesignDocument(markdown);
  if (metadata.schemaVersion !== '1.0') {invalid('schemaVersion', 'EXPECTED_1_0');}
  for (const key of ['name', 'description']) {if (!nonempty(metadata[key])) {invalid(key, 'NONEMPTY_STRING_REQUIRED');}}
  if (metadata.buildPlanRevision !== undefined && !nonempty(metadata.buildPlanRevision)) {
    invalid('buildPlanRevision', 'NONEMPTY_STRING_REQUIRED');
  }
  for (const key of ['themeId', 'templatePath']) {
    if (Object.prototype.hasOwnProperty.call(metadata, key)) {invalid(key, 'TEMPLATE_IDENTITY_NOT_ALLOWED');}
  }
  const tokens = extractDesignTokens(metadata, { strict: true });
  const profile = metadata.themeProfile;
  if (!object(profile)) {invalid('themeProfile', 'MAPPING_REQUIRED');}
  for (const key of ['name', 'themeColor', 'themeColorSource']) {if (!nonempty(profile[key])) {invalid(`themeProfile.${key}`, 'NONEMPTY_STRING_REQUIRED');}}
  if (!/^#[\da-f]{6}$/i.test(profile.themeColor) || profile.themeColor.toUpperCase() !== tokens['--color-brand1-6'].toUpperCase()) {
    invalid('themeProfile.themeColor', 'PRIMARY_COLOR_MISMATCH');
  }
  if (!['light', 'dark'].includes(profile.contentTone)) {invalid('themeProfile.contentTone', 'LIGHT_OR_DARK_REQUIRED');}
  if (!['light', 'dark'].includes(profile.navTheme)) {invalid('themeProfile.navTheme', 'LIGHT_OR_DARK_REQUIRED');}
  if (!['app-custom-theme-file', 'current-app-theme'].includes(profile.themeDelivery)) {invalid('themeProfile.themeDelivery', 'INVALID_THEME_DELIVERY');}
  if (typeof profile.themeFile !== 'string') {invalid('themeProfile.themeFile', 'STRING_REQUIRED');}
  if (profile.themeDelivery === 'app-custom-theme-file' && !nonempty(profile.themeFile)) {invalid('themeProfile.themeFile', 'THEME_FILE_REQUIRED');}
  for (const [key, values] of Object.entries({
    navigationType: ['platform-l-shape', 'platform-top', 'platform-side', 'custom'],
    layoutDirection: ['l_shape', 'top', 'side'], hideAppNav: ['y', 'n'],
  })) {
    if (profile[key] !== undefined && !values.includes(profile[key])) {invalid(`themeProfile.${key}`, 'INVALID_NAVIGATION_VALUE');}
  }
  if (!object(metadata.iconSystem) || !['lucide-react', '@ant-design/icons'].includes(metadata.iconSystem.library) || !object(metadata.iconSystem.mappings)) {
    invalid('iconSystem', 'ICON_LIBRARY_AND_MAPPINGS_REQUIRED');
  }
  for (const [key, value] of Object.entries(metadata.iconSystem.mappings)) {
    if (!nonempty(key) || !nonempty(value)) {invalid(`iconSystem.mappings.${key}`, 'ICON_COMPONENT_NAME_REQUIRED');}
  }
  if (!object(metadata.assetStrategy) || !Array.isArray(metadata.assetStrategy.pages)) {invalid('assetStrategy.pages', 'ARRAY_REQUIRED');}
  // Lazy require: the asset reader imports this document parser too.
  require('../asset/asset-plan').prepareAssetPlan([], metadata.assetStrategy);
  const lines = structuralLines(body);
  if (!/^# [^#\s]/.test(lines.find(line => line.trim()) || '') || lines.filter(line => /^# /.test(line)).length !== 1) {
    invalid('body', 'ONE_LEADING_H1_REQUIRED');
  }
  const headings = lines.filter(line => /^## /.test(line)).map(line => line.slice(3).trim());
  if (headings.join('|') !== HEADINGS.join('|')) {invalid('body', 'FIVE_ORDERED_CHAPTERS_REQUIRED', { expected: HEADINGS });}
  if (/\{\{[^}]+\}\}|<[^>]*(?:实际色值|生成期标记)[^>]*>/.test(markdown)) {invalid('document', 'UNRESOLVED_PLACEHOLDER');}
  const { text, anchors } = documentAnchors(body);
  const chapterThree = text.indexOf('## 3. 基础组件表达');
  const chapterFour = text.indexOf('## 4. 特色表达配方');
  function reference(value, field) {
    if (!object(value) || !ANCHOR.test(value.anchor || '') || !anchors.has(value.anchor)) {
      invalid(field, 'EXISTING_ANCHOR_REQUIRED', { anchor: value?.anchor, nextStep: t('design_document.anchor_hint') });
    }
  }
  for (const root of ['components', 'states']) {
    if (!object(metadata[root])) {invalid(root, 'MAPPING_REQUIRED');}
    for (const [key, value] of Object.entries(metadata[root])) {
      if (!REFERENCE_KEY.test(key)) {invalid(`${root}.${key}`, 'INVALID_REFERENCE_KEY');}
      reference(value, `${root}.${key}`);
      if (Object.keys(value).join('|') !== 'anchor') {invalid(`${root}.${key}`, 'ANCHOR_ONLY_REQUIRED');}
      const position = anchors.get(value.anchor);
      if (position < chapterThree || position >= chapterFour) {invalid(`${root}.${key}`, 'ANCHOR_MUST_BE_IN_CHAPTER_THREE', { nextStep: t('design_document.anchor_chapter_three_hint') });}
    }
  }
  if (!object(metadata.sceneRecipes)) {invalid('sceneRecipes', 'MAPPING_REQUIRED');}
  const pageIds = new Set();
  const pageAnchors = new Set();
  for (const [key, scene] of Object.entries(metadata.sceneRecipes)) {
    if (!REFERENCE_KEY.test(key)) {invalid(`sceneRecipes.${key}`, 'INVALID_REFERENCE_KEY');}
    if (!object(scene) || !Array.isArray(scene.pages) || !scene.pages.length) {invalid(`sceneRecipes.${key}.pages`, 'NONEMPTY_ARRAY_REQUIRED');}
    for (const page of scene.pages) {
      if (!object(page) || !nonempty(page.pageId) || pageIds.has(page.pageId)) {invalid(`sceneRecipes.${key}.pages`, 'UNIQUE_PAGE_ID_REQUIRED');}
      reference(page, `sceneRecipes.${key}.${page.pageId}`);
      if (Object.keys(page).sort().join('|') !== 'anchor|pageId') {invalid(`sceneRecipes.${key}.${page.pageId}`, 'PAGE_ID_AND_ANCHOR_ONLY_REQUIRED');}
      if (!page.anchor.startsWith('#page-') || pageAnchors.has(page.anchor)) {invalid(page.pageId, 'UNIQUE_PAGE_ANCHOR_REQUIRED', { nextStep: t('design_document.page_anchor_prefix_hint') });}
      pageIds.add(page.pageId);
      pageAnchors.add(page.anchor);
    }
  }
  const positions = [...pageAnchors].map(anchor => [anchor, anchors.get(anchor)]).sort((a, b) => a[1] - b[1]);
  const chapterFive = text.indexOf('## 5. 项目应用与调整规则');
  for (let index = 0; index < positions.length; index++) {
    const [anchor, start] = positions[index];
    if (start < chapterFive) {invalid(anchor, 'PAGE_MUST_BE_IN_CHAPTER_FIVE', { nextStep: t('design_document.page_anchor_chapter_five_hint') });}
    const section = text.slice(start, positions[index + 1]?.[1] || text.length);
    for (const label of PAGE_LABELS) {
      const pattern = new RegExp(`^(?:[ \\t]*[-*][ \\t]+)?(?:\\*\\*)?${label}[：:](?:\\*\\*)?[ \\t]*(\\S[^\\n]*)$`, 'm');
      const match = pattern.exec(section);
      if (!match || !concretePageText(match[1])) {invalid(anchor, 'PAGE_LABEL_REQUIRED', { label, nextStep: t('design_document.page_label_hint', label) });}
    }
  }
  for (const page of metadata.assetStrategy.pages) {if (!pageIds.has(page.pageId)) {invalid('assetStrategy.pages', 'UNKNOWN_DESIGN_PAGE', { pageId: page.pageId });}}
  for (const match of text.matchAll(/var\(\s*(--[\w-]+)/g)) {if (!(match[1] in tokens)) {invalid('body', 'UNDECLARED_TOKEN_REFERENCE', { reference: match[1] });}}
  if (options.prdMarkdown !== undefined) {validatePrd(options.prdMarkdown, metadata, pageIds, options);}
  return { success: true, schemaVersion: metadata.schemaVersion, name: metadata.name, pages: [...pageIds], tokenCount: Object.keys(tokens).length, anchorCount: anchors.size, prdChecked: options.prdMarkdown !== undefined,
    iconContrast: validateIconContrast(metadata.iconSystem, tokens) };
}

module.exports = { parseDesignDocument, serializeDesignDocument, extractDesignTokens, validateDesignDocument, HEADINGS, PAGE_LABELS };
