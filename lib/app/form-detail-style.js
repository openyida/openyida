'use strict';

const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

const { httpGet, httpPost, requestWithAutoLogin } = require('../core/utils');
const { createAuthRef } = require('../core/yida-client');
const { banner, step, label, info, success, warn, result, error } = require('../core/chalk');
const { throwCommandError, throwUsage } = require('../core/command-errors');
const { buildApiPath } = require('./create-form/api-path');
const {
  ensureYidaGlobalThemeAction,
  hasYidaGlobalThemeAction,
  hasYidaFormDetailStyleAction,
} = require('./form-theme-action');

const FORM_DETAIL_STYLE_ID = 'yida-form-detail-style';
const STYLE_MARKER = 'yida-form-detail';
const DEFAULT_PRESET = 'clean-card';

const USAGE = '用法: openyida form-detail-style <apply|remove|check> <appType> <formUuid> [--css file] [--preset clean-card] [--theme-tokens-json json] [--theme-tokens-file file] [--json]';
const EXAMPLE = '示例: openyida form-detail-style apply APP_XXX FORM_XXX --preset clean-card --theme-tokens-json \'{"--color-brand1-6":"#3954E4"}\'';

const FALLBACK_CLEAN_CARD_CSS = `/* =========================================
   yida-form-detail detail page style v1.4
   ========================================= */
:root {
  --yida-form-container-bgcolor-custom: #f6f7f9;
  --oyd-detail-page-bg: #f6f7f9;
  --oyd-detail-card-bg: #ffffff;
  --oyd-detail-border: #e5e6e8;
  --oyd-detail-radius: 20px;
  --oyd-detail-gap: 12px;
  --oyd-detail-max-width: 1440px;
  --oyd-detail-label-color: rgba(24, 32, 51, 0.72);
  --oyd-detail-value-color: #182033;
  --oyd-detail-value-bg: rgba(247, 248, 250, 0.72);
  --oyd-detail-value-border: rgba(131, 137, 143, 0.24);
}
.vc-page-yida-page.vc-page.yida-formDetail {
  background-color: var(--oyd-detail-page-bg) !important;
  padding-left: var(--oyd-detail-gap) !important;
  padding-right: var(--oyd-detail-gap) !important;
}
.vc-page-content-1180 .vc-rootcontent,
.top-banner-area.pc-1200,
.view-detail-footer,
.stickyFooter.is-sticky {
  max-width: var(--oyd-detail-max-width) !important;
}
.top-banner-area.pc-1200,
.vc-deep-container-entry.vc-rootcontent,
.view-detail-footer {
  border-radius: var(--oyd-detail-radius) !important;
  border: 1px solid var(--oyd-detail-border) !important;
  background-color: var(--oyd-detail-card-bg) !important;
}
.next-form-item-label,
.next-form-item-label label,
.vc-page-yida-page .next-form-item .next-form-item-label {
  color: var(--oyd-detail-label-color) !important;
}
.next-form-preview {
  color: var(--oyd-detail-value-color) !important;
}
.next-form-item-control > .next-form-preview:not(.employee) {
  min-height: 28px !important;
  padding: 0 8px !important;
  border-radius: 8px !important;
  border-left: 2px solid var(--oyd-detail-value-border) !important;
  background-color: var(--oyd-detail-value-bg) !important;
  overflow: hidden !important;
}
.stickyFooter.is-sticky {
  width: calc(100% - 24px) !important;
  height: 56px !important;
  margin: 0 auto 12px !important;
  border-radius: 30px !important;
  border: 1px solid var(--oyd-detail-border) !important;
  background-color: var(--oyd-detail-card-bg) !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16) !important;
}`;

function hasHelpFlag(args) {
  return args.includes('--help') || args.includes('-h');
}

function parseArgs(args = []) {
  const parsed = {
    action: args[0] || '',
    appType: '',
    formUuid: '',
    cssFile: '',
    preset: DEFAULT_PRESET,
    themeTokensJson: '',
    themeTokensFile: '',
    json: false,
  };

  const positional = [];
  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--json') {
      parsed.json = true;
    } else if (arg === '--css' && args[i + 1]) {
      parsed.cssFile = args[i + 1];
      i += 1;
    } else if (arg === '--preset' && args[i + 1]) {
      parsed.preset = args[i + 1];
      i += 1;
    } else if (arg === '--theme-tokens-json' && args[i + 1]) {
      parsed.themeTokensJson = args[i + 1];
      i += 1;
    } else if (arg === '--theme-tokens-file' && args[i + 1]) {
      parsed.themeTokensFile = args[i + 1];
      i += 1;
    } else if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }

  parsed.appType = positional[0] || '';
  parsed.formUuid = positional[1] || '';
  return parsed;
}

function printUsage() {
  console.log(USAGE);
  console.log(EXAMPLE);
}

function assertValidArgs(parsed) {
  if (!['apply', 'remove', 'check'].includes(parsed.action)) {
    throwUsage(USAGE, EXAMPLE);
  }
  if (!parsed.appType || !parsed.formUuid) {
    throwUsage(USAGE, EXAMPLE);
  }
  if (parsed.preset && parsed.preset !== DEFAULT_PRESET) {
    throwCommandError(`不支持的 preset: ${parsed.preset}。当前支持: ${DEFAULT_PRESET}`);
  }
  if (parsed.themeTokensJson && parsed.themeTokensFile) {
    throwCommandError('--theme-tokens-json 和 --theme-tokens-file 只能选择一个');
  }
}

function stripMarkdownFence(source) {
  const match = String(source || '').match(/```css\s*([\s\S]*?)```/i);
  return match ? match[1] : source;
}

function normalizeCssSource(source) {
  let css = stripMarkdownFence(source);
  css = String(css || '').replace(/<\/?style[^>]*>/gi, '').trim();
  return css;
}

function extractDefaultPresetCss(markdown) {
  const css = normalizeCssSource(markdown);
  return css || FALLBACK_CLEAN_CARD_CSS;
}

function readPresetCss(preset = DEFAULT_PRESET) {
  if (preset !== DEFAULT_PRESET) {
    throwCommandError(`不支持的 preset: ${preset}。当前支持: ${DEFAULT_PRESET}`);
  }

  const docPath = path.join(__dirname, '..', '..', 'yida-skills', 'skills', 'yida-form-detail', 'references', 'form-detail-css.md');
  if (!fs.existsSync(docPath)) {
    return FALLBACK_CLEAN_CARD_CSS;
  }
  return extractDefaultPresetCss(fs.readFileSync(docPath, 'utf8'));
}

function readCss(parsed) {
  if (parsed.cssFile) {
    const absolutePath = path.resolve(process.cwd(), parsed.cssFile);
    if (!fs.existsSync(absolutePath)) {
      throwCommandError(`CSS 文件不存在: ${absolutePath}`);
    }
    return normalizeCssSource(fs.readFileSync(absolutePath, 'utf8'));
  }
  return readPresetCss(parsed.preset);
}

function readThemeTokens(parsed) {
  function parseTokensJson(source) {
    try {
      return JSON.parse(source);
    } catch (err) {
      throwCommandError(`主题 tokens 不是合法 JSON: ${err.message}`);
    }
    return undefined;
  }

  if (parsed.themeTokensFile) {
    const absolutePath = path.resolve(process.cwd(), parsed.themeTokensFile);
    if (!fs.existsSync(absolutePath)) {
      throwCommandError(`主题 tokens 文件不存在: ${absolutePath}`);
    }
    return parseTokensJson(fs.readFileSync(absolutePath, 'utf8'));
  }
  if (parsed.themeTokensJson) {
    return parseTokensJson(parsed.themeTokensJson);
  }
  return undefined;
}

function findRootNode(schema) {
  const page = schema && Array.isArray(schema.pages) ? schema.pages[0] : null;
  const tree = page && Array.isArray(page.componentsTree) ? page.componentsTree : null;
  return tree && tree[0] ? tree[0] : null;
}

function upsertFormDetailCss(schema, css, options = {}) {
  const rootNode = findRootNode(schema);
  if (!rootNode) {
    throwCommandError('Schema 中未找到 RootContent');
  }
  const hadDetailAction = hasYidaFormDetailStyleAction(schema);
  const actionOptions = { formDetailCss: normalizeCssSource(css) };
  if (Object.prototype.hasOwnProperty.call(options, 'themeTokens') && options.themeTokens !== undefined) {
    actionOptions.themeTokens = options.themeTokens;
  }
  ensureYidaGlobalThemeAction(schema, actionOptions);
  return hadDetailAction ? 'updated' : 'inserted';
}

function removeFormDetailCss(schema, options = {}) {
  const rootNode = findRootNode(schema);
  if (!rootNode) {
    throwCommandError('Schema 中未找到 RootContent');
  }
  const hadDetailAction = hasYidaFormDetailStyleAction(schema);
  const actionOptions = { formDetailCss: '' };
  if (Object.prototype.hasOwnProperty.call(options, 'themeTokens') && options.themeTokens !== undefined) {
    actionOptions.themeTokens = options.themeTokens;
  }
  ensureYidaGlobalThemeAction(schema, actionOptions);
  return hadDetailAction ? 'removed' : 'absent';
}

function inspectFormDetailCss(schema) {
  return {
    installed: hasYidaFormDetailStyleAction(schema),
    globalThemeActionFound: hasYidaGlobalThemeAction(schema),
    formDetailStyleActionFound: hasYidaFormDetailStyleAction(schema),
  };
}

function extractSchemaServerRevision(schemaResult) {
  const content = schemaResult && schemaResult.content && typeof schemaResult.content === 'object'
    ? schemaResult.content
    : null;
  const candidates = [
    schemaResult && schemaResult.gmtModified,
    schemaResult && schemaResult.serverRevision,
    content && content.gmtModified,
    content && content.serverRevision,
    content && content.version,
    schemaResult && schemaResult.version,
  ];
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && String(candidate).trim() !== '') {
      return candidate;
    }
  }
  return undefined;
}

function normalizeSchemaContent(value) {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return JSON.parse(value);
  }
  if (value.schema) {
    return normalizeSchemaContent(value.schema);
  }
  return value;
}

function extractSchema(schemaResult) {
  if (!schemaResult || schemaResult.__needLogin || schemaResult.__csrfExpired || schemaResult.success === false) {
    const detail = schemaResult && (schemaResult.errorMsg || schemaResult.message);
    throwCommandError(detail || '读取表单 Schema 失败');
  }
  const schema = normalizeSchemaContent(schemaResult.content || schemaResult.result || schemaResult.data || schemaResult);
  if (!schema || typeof schema !== 'object') {
    throwCommandError('读取表单 Schema 失败：响应中没有有效 Schema');
  }
  return schema;
}

async function fetchFormSchema(authRef, appType, formUuid) {
  return requestWithAutoLogin((auth) => {
    return httpGet(
      auth.baseUrl,
      buildApiPath(appType, 'getFormSchema', { prefix: '_view', namespace: 'alibaba' }),
      { formUuid, schemaVersion: 'V5' },
      {}
    );
  }, authRef);
}

async function saveFormSchema(authRef, appType, formUuid, schema, version) {
  return requestWithAutoLogin((auth) => {
    const requestOptions = {
      referer: `${auth.baseUrl}/alibaba/web/${appType}/design/pageDesigner?formUuid=${formUuid}`,
    };
    const body = {
      appType,
      formUuid,
      content: JSON.stringify(schema),
      schemaVersion: 'V5',
      prefix: '_view',
      importSchema: 'true',
    };
    if (auth.csrfToken) {
      body._csrf_token = auth.csrfToken;
    }
    if (version !== undefined && version !== null && String(version).trim() !== '') {
      body.gmtModified = version;
    }
    return httpPost(
      auth.baseUrl,
      buildApiPath(appType, 'saveFormSchema', { prefix: '_view' }),
      querystring.stringify(body),
      requestOptions
    );
  }, authRef);
}

async function refreshFormConfig(authRef, appType, formUuid, version) {
  return requestWithAutoLogin((auth) => {
    const body = {
      formUuid,
      version: version || 1,
      configType: 'MINI_RESOURCE',
      value: 0,
    };
    if (auth.csrfToken) {
      body._csrf_token = auth.csrfToken;
    }
    return httpPost(
      auth.baseUrl,
      `/dingtalk/web/${appType}/query/formdesign/updateFormConfig.json`,
      querystring.stringify(body)
    );
  }, authRef);
}

function assertSaveSuccess(saveResult) {
  if (!saveResult || saveResult.__needLogin || saveResult.__csrfExpired || saveResult.success === false) {
    const detail = saveResult && (saveResult.errorMsg || saveResult.message);
    throwCommandError(detail || '保存表单 Schema 失败');
  }
}

async function applyStyle(authRef, parsed) {
  const schemaResult = await fetchFormSchema(authRef, parsed.appType, parsed.formUuid);
  const version = extractSchemaServerRevision(schemaResult);
  const schema = extractSchema(schemaResult);
  const css = readCss(parsed);
  const action = upsertFormDetailCss(schema, css, { themeTokens: readThemeTokens(parsed) });
  const themeAction = hasYidaGlobalThemeAction(schema) ? 'upserted' : 'skipped';
  const saveResult = await saveFormSchema(authRef, parsed.appType, parsed.formUuid, schema, version);
  assertSaveSuccess(saveResult);
  const configResult = await refreshFormConfig(authRef, parsed.appType, parsed.formUuid, version);
  return { success: true, action, themeAction, installed: true, saveResult, configResult };
}

async function removeStyle(authRef, parsed) {
  const schemaResult = await fetchFormSchema(authRef, parsed.appType, parsed.formUuid);
  const version = extractSchemaServerRevision(schemaResult);
  const schema = extractSchema(schemaResult);
  const action = removeFormDetailCss(schema, { themeTokens: readThemeTokens(parsed) });
  const saveResult = await saveFormSchema(authRef, parsed.appType, parsed.formUuid, schema, version);
  assertSaveSuccess(saveResult);
  const configResult = await refreshFormConfig(authRef, parsed.appType, parsed.formUuid, version);
  return { success: true, action, installed: false, saveResult, configResult };
}

async function checkStyle(authRef, parsed) {
  const schemaResult = await fetchFormSchema(authRef, parsed.appType, parsed.formUuid);
  const schema = extractSchema(schemaResult);
  return Object.assign({ success: true }, inspectFormDetailCss(schema));
}

async function run(args = process.argv.slice(2)) {
  if (hasHelpFlag(args)) {
    printUsage();
    return { success: true, help: true };
  }

  const parsed = parseArgs(args);
  assertValidArgs(parsed);

  banner('form-detail-style - 表单详情页样式工具');
  label('Action:', parsed.action);
  label('App ID:', parsed.appType);
  label('Form UUID:', parsed.formUuid);

  step(1, '读取登录态');
  const authRef = createAuthRef();
  success(`登录态可用: ${authRef.baseUrl}`);

  step(2, parsed.action === 'check' ? '检查样式注入状态' : '读取并更新表单 Schema');
  info('读取表单 Schema...');

  let output;
  if (parsed.action === 'apply') {
    output = await applyStyle(authRef, parsed);
  } else if (parsed.action === 'remove') {
    output = await removeStyle(authRef, parsed);
  } else {
    output = await checkStyle(authRef, parsed);
  }

  if (parsed.action === 'check') {
    result(output.installed, output.installed ? '已安装 formDetail 样式' : '未安装 formDetail 样式');
  } else {
    result(true, parsed.action === 'apply' ? 'formDetail 样式已写入' : 'formDetail 样式已移除');
  }

  const payload = Object.assign({
    appType: parsed.appType,
    formUuid: parsed.formUuid,
  }, output);
  if (!parsed.json && parsed.action !== 'check' && output.configResult && output.configResult.success === false) {
    warn(`刷新 MINI_RESOURCE 返回警告: ${output.configResult.errorMsg || output.configResult.message || 'unknown'}`);
  }
  console.log(JSON.stringify(payload, null, parsed.json ? 2 : 0));
  return payload;
}

if (require.main === module) {
  run().catch((err) => {
    error(err.message);
    process.exitCode = err && err.exitCode ? err.exitCode : 1;
  });
}

module.exports = {
  run,
  parseArgs,
  readCss,
  readThemeTokens,
  extractDefaultPresetCss,
  normalizeCssSource,
  upsertFormDetailCss,
  removeFormDetailCss,
  inspectFormDetailCss,
  extractSchema,
  extractSchemaServerRevision,
  fetchFormSchema,
  saveFormSchema,
  refreshFormConfig,
  _private: {
    FORM_DETAIL_STYLE_ID,
    STYLE_MARKER,
    ensureYidaGlobalThemeAction,
  },
};
