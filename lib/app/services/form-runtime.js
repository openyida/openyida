'use strict';

const { default: babelTransform } = require('../../core/babel-transform');
const { buildCanvasRuntimeSource } = require('../runtime/canvas-runtime');

const FORM_DID_MOUNT_ACTION_NAME = 'didMount';
const FORM_RUNTIME_ACTION_NAME = 'openyidaRuntimeDidMount';
const FORM_RUNTIME_BLOCK_START = '/* openyida:form-runtime:start */';
const FORM_RUNTIME_BLOCK_END = '/* openyida:form-runtime:end */';
const DEFAULT_FORM_DETAIL_PRESET = 'clean-card';
const DEFAULT_FORM_THEME_TOKENS = Object.freeze({
  '--color-brand1-6': '#2563eb',
  '--color-brand1-1': '#eff6ff',
  '--openyida-form-bg': '#f6f8fb',
  '--openyida-form-surface': '#ffffff',
  '--openyida-form-border': '#d8e0ea',
  '--openyida-form-text': '#172033',
});

const CLEAN_CARD_FORM_DETAIL_CSS = [
  'body[data-mode="formDetail"], body.form-detail { background: var(--openyida-form-bg, #f6f8fb); }',
  'body[data-mode="formDetail"] .vc-form-container, body.form-detail .vc-form-container {',
  '  max-width: 1180px; margin: 20px auto; padding: 24px;',
  '  background: var(--openyida-form-surface, #fff);',
  '  border: 1px solid var(--openyida-form-border, #d8e0ea); border-radius: 8px;',
  '  color: var(--openyida-form-text, #172033);',
  '}',
].join('\n');

function buildFormConstructorCode() {
  return "function constructor() {\nvar module = { exports: {} };\nvar _this = this;\nthis.__initMethods__(module.exports, module);\nObject.keys(module.exports).forEach(function(item) {\n  if(typeof module.exports[item] === 'function'){\n    _this[item] = module.exports[item];\n  }\n});\n\n}";
}

function normalizeRuntimeOptions(options) {
  const input = options || {};
  return {
    themeTokens: Object.assign({}, DEFAULT_FORM_THEME_TOKENS, input.themeTokens || {}),
    formDetailPreset: input.formDetailPreset || DEFAULT_FORM_DETAIL_PRESET,
  };
}

function buildFormRuntimeSource(options) {
  const runtimeOptions = normalizeRuntimeOptions(options);
  const themeTokens = JSON.stringify(runtimeOptions.themeTokens);
  const formDetailPreset = JSON.stringify(runtimeOptions.formDetailPreset);
  const formDetailCss = JSON.stringify(CLEAN_CARD_FORM_DETAIL_CSS);

  return `${buildCanvasRuntimeSource()}
var OPENYIDA_FORM_THEME_TOKENS = ${themeTokens};
var OPENYIDA_FORM_DETAIL_PRESET = ${formDetailPreset};
var OPENYIDA_FORM_DETAIL_CSS = ${formDetailCss};

function openyidaIsFormDetailDocument(doc) {
  if (!doc) return false;
  try {
    var locationText = String(doc.defaultView && doc.defaultView.location && doc.defaultView.location.href || '');
    if (locationText.indexOf('/formDetail/') >= 0) return true;
  } catch (err) {}
  try {
    return !!(doc.querySelector && doc.querySelector('.yida-formDetail, .vc-page-yida-page.yida-formDetail'));
  } catch (err) {}
  return false;
}

function openyidaInstallFormDetailStyle() {
  if (OPENYIDA_FORM_DETAIL_PRESET === 'none') return { installed: 0 };
  var installed = 0;
  openyidaRuntimeTargets().forEach(function(target) {
    try {
      if (!openyidaIsFormDetailDocument(target.document)) return;
      if (openyidaRuntimeUpsertStyle(
        target.document,
        'yida-form-detail-style',
        OPENYIDA_FORM_DETAIL_CSS
      )) installed += 1;
    } catch (err) {}
  });
  return { installed: installed, preset: OPENYIDA_FORM_DETAIL_PRESET };
}

function openyidaFormDidMount(context) {
  var runtime = openyidaInstallRuntime.call(context);
  runtime.theme.install({ tokens: OPENYIDA_FORM_THEME_TOKENS });
  var formDetail = openyidaInstallFormDetailStyle();
  runtime.form = {
    themeTokens: runtime.theme.getTokens(),
    formDetailPreset: OPENYIDA_FORM_DETAIL_PRESET,
    formDetailInstalled: formDetail.installed,
    installDetailStyle: openyidaInstallFormDetailStyle,
    refresh: function() {
      runtime.theme.refresh();
      return openyidaInstallFormDetailStyle();
    }
  };
  return runtime;
}`;
}

function buildFormActionsSource(options) {
  return `${buildFormRuntimeSource(options)}

export function didMount() {
  return openyidaFormDidMount(this);
}`;
}

function buildFormActionsCompiled(options) {
  return `"use strict";

exports.__esModule = true;
exports.didMount = didMount;
${buildFormRuntimeSource(options)}
function didMount() {
  return openyidaFormDidMount(this);
}`;
}

function buildFormActionsModule(options) {
  return {
    compiled: buildFormActionsCompiled(options),
    source: buildFormActionsSource(options),
  };
}

function buildFormActionListItem(nextNodeId) {
  const id = typeof nextNodeId === 'function' ? nextNodeId() : FORM_DID_MOUNT_ACTION_NAME;
  return {
    id,
    type: 'lifeCycleEvent',
    name: FORM_DID_MOUNT_ACTION_NAME,
    relatedEventId: 'lifecycle:didMount',
    params: {},
  };
}

function buildFormDidMountLifecycle() {
  return {
    name: FORM_DID_MOUNT_ACTION_NAME,
    id: FORM_DID_MOUNT_ACTION_NAME,
    params: {},
    type: 'actionRef',
  };
}

function getFormRoot(schema) {
  return schema && schema.pages && schema.pages[0] && schema.pages[0].componentsTree && schema.pages[0].componentsTree[0];
}

function removeFormRuntimeBlock(source) {
  const text = String(source || '');
  const start = text.indexOf(FORM_RUNTIME_BLOCK_START);
  const end = text.indexOf(FORM_RUNTIME_BLOCK_END);
  if (start < 0 || end <= start) {return text;}
  return (text.slice(0, start).trimEnd() + text.slice(end + FORM_RUNTIME_BLOCK_END.length)).trim();
}

function readPreviousDidMount(source) {
  const match = String(source || '').match(/var OPENYIDA_PREVIOUS_DID_MOUNT_NAME = ("(?:\\.|[^"\\])*");/);
  if (!match) {return '';}
  try {return JSON.parse(match[1]);} catch (error) {return '';}
}

function isActionName(value) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(String(value || ''));
}

function compileFormActions(source) {
  const result = babelTransform(source, {}, false, { RE_VERSION: '7.4.0' });
  if (result.error instanceof Error) {
    const error = new Error('表单运行时动作编译失败: ' + result.error.message);
    error.code = 'FORM_RUNTIME_COMPILE_FAILED';
    throw error;
  }
  return result.compiled;
}

function ensureFormRuntime(schema, options) {
  const root = getFormRoot(schema);
  if (!root) {
    const error = new Error('原生表单缺少页面根节点');
    error.code = 'FORM_RUNTIME_ROOT_MISSING';
    throw error;
  }
  schema.actions = schema.actions && typeof schema.actions === 'object'
    ? schema.actions
    : { type: 'FUNCTION', list: [], module: {} };
  schema.actions.module = schema.actions.module && typeof schema.actions.module === 'object'
    ? schema.actions.module
    : {};
  schema.actions.list = Array.isArray(schema.actions.list) ? schema.actions.list : [];
  const existingSource = String(schema.actions.module.source || '');
  const hasCompleteRuntime = existingSource.includes('openyidaInstallRuntime') &&
    existingSource.includes('openyidaFormDidMount');
  if (hasCompleteRuntime) {return false;}

  const currentLifecycle = root.lifeCycles && root.lifeCycles.componentDidMount;
  let previousName = currentLifecycle && currentLifecycle.type === 'actionRef' ? currentLifecycle.name : FORM_DID_MOUNT_ACTION_NAME;
  if (previousName === FORM_RUNTIME_ACTION_NAME) {
    previousName = readPreviousDidMount(existingSource) || FORM_DID_MOUNT_ACTION_NAME;
  }
  if (!isActionName(previousName) || previousName === FORM_RUNTIME_ACTION_NAME) {
    previousName = FORM_DID_MOUNT_ACTION_NAME;
  }
  const previousCall = previousName === FORM_DID_MOUNT_ACTION_NAME && !existingSource.includes('export function didMount')
    ? ''
    : `\n  if (typeof ${previousName} === 'function') { ${previousName}.call(this, event); }`;
  const runtimeBlock = `${FORM_RUNTIME_BLOCK_START}
${buildFormRuntimeSource(options)}
var OPENYIDA_PREVIOUS_DID_MOUNT_NAME = ${JSON.stringify(previousName)};
export function ${FORM_RUNTIME_ACTION_NAME}(event) {${previousCall}
  return openyidaFormDidMount(this);
}
${FORM_RUNTIME_BLOCK_END}`;
  const source = removeFormRuntimeBlock(existingSource).trimEnd() + '\n\n' + runtimeBlock + '\n';
  schema.actions.module.source = source;
  schema.actions.module.compiled = compileFormActions(source);
  schema.actions.type = schema.actions.type || 'FUNCTION';
  schema.actions.list = schema.actions.list.filter(function (item) {
    return !(item && item.id === FORM_RUNTIME_ACTION_NAME);
  });
  schema.actions.list.push({
    id: FORM_RUNTIME_ACTION_NAME,
    name: FORM_RUNTIME_ACTION_NAME,
    relatedEventId: 'lifecycle:didMount',
    type: 'lifeCycleEvent',
    params: {},
  });
  root.lifeCycles = root.lifeCycles || {};
  root.lifeCycles.componentDidMount = {
    name: FORM_RUNTIME_ACTION_NAME,
    id: FORM_RUNTIME_ACTION_NAME,
    params: {},
    type: 'actionRef',
  };
  return true;
}

module.exports = {
  CLEAN_CARD_FORM_DETAIL_CSS,
  DEFAULT_FORM_DETAIL_PRESET,
  DEFAULT_FORM_THEME_TOKENS,
  FORM_DID_MOUNT_ACTION_NAME,
  FORM_RUNTIME_ACTION_NAME,
  buildFormActionListItem,
  buildFormActionsCompiled,
  buildFormActionsModule,
  buildFormActionsSource,
  buildFormConstructorCode,
  buildFormDidMountLifecycle,
  buildFormRuntimeSource,
  ensureFormRuntime,
};
