'use strict';

const {
  createNodeIdGenerator,
  generateSuffix,
  getGlobalDataSourceFitConfig,
} = require('./native-page-schema-builder');
const {
  buildEmojiErrorMessage,
  findEmojiInValue,
} = require('../../core/no-emoji-detector');

const CANVAS_YIDA_API_BRIDGE_SOURCE = `function openyidaYidaApiBridgeTargets() {
  var targets = [];
  function pushTarget(target) {
    if (target && targets.indexOf(target) === -1) {
      targets.push(target);
    }
  }
  try { pushTarget(window); } catch (err) {}
  try { pushTarget(window.parent); } catch (err) {}
  try { pushTarget(window.top); } catch (err) {}
  return targets;
}

function openyidaNormalizeYidaApiParams(methodName, params) {
  var next = Object.assign({}, params || {});
  if (methodName === 'searchFormDatas' || methodName === 'searchFormDataIds' ||
      methodName === 'getProcessInstances' || methodName === 'getProcessInstanceIds') {
    if (next.searchFieldJson && typeof next.searchFieldJson !== 'string') {
      next.searchFieldJson = JSON.stringify(next.searchFieldJson);
    }
    if (next.query && !next.searchFieldJson) {
      next.searchFieldJson = JSON.stringify(next.query);
      delete next.query;
    }
    if (!next.searchFieldJson) {
      next.searchFieldJson = '';
    }
  }
  return next;
}

function openyidaCreateYidaApiBridge(context) {
  var yida = context && context.utils && context.utils.yida;
  function invoke(methodName, params) {
    if (!yida || typeof yida[methodName] !== 'function') {
      return Promise.reject(new Error('this.utils.yida.' + methodName + ' is not available'));
    }
    try {
      return Promise.resolve(yida[methodName].call(yida, openyidaNormalizeYidaApiParams(methodName, params)));
    } catch (err) {
      return Promise.reject(err);
    }
  }
  return {
    ready: !!yida,
    invoke: invoke,
    searchFormDatas: function(params) { return invoke('searchFormDatas', params); },
    searchFormDataIds: function(params) { return invoke('searchFormDataIds', params); },
    getFormDataById: function(params) { return invoke('getFormDataById', params); },
    getFormComponentDefinationList: function(params) { return invoke('getFormComponentDefinationList', params); },
    saveFormData: function(params) { return invoke('saveFormData', params); },
    updateFormData: function(params) { return invoke('updateFormData', params); },
    deleteFormData: function(params) { return invoke('deleteFormData', params); },
    startProcessInstance: function(params) { return invoke('startProcessInstance', params); },
    updateProcessInstance: function(params) { return invoke('updateProcessInstance', params); },
    deleteProcessInstance: function(params) { return invoke('deleteProcessInstance', params); },
    getProcessInstances: function(params) { return invoke('getProcessInstances', params); },
    getProcessInstanceIds: function(params) { return invoke('getProcessInstanceIds', params); },
    getProcessInstanceById: function(params) { return invoke('getProcessInstanceById', params); }
  };
}

function openyidaThemeNormalizeTokens(tokens) {
  var source = tokens && tokens.tokens ? tokens.tokens : tokens;
  var normalized = {};
  Object.keys(source || {}).forEach(function(key) {
    var value = source[key];
    if (value === undefined || value === null || value === '') {
      return;
    }
    var cssKey = key.indexOf('--') === 0 ? key : '--' + key;
    normalized[cssKey] = String(value);
  });
  return normalized;
}

function openyidaThemeBuildCss(tokens) {
  var normalized = openyidaThemeNormalizeTokens(tokens);
  var keys = Object.keys(normalized);
  if (!keys.length) {
    return '';
  }
  return ':root {\\n' + keys.map(function(key) {
    return '  ' + key + ': ' + normalized[key] + ';';
  }).join('\\n') + '\\n}';
}

function openyidaThemeUpsertStyle(doc, styleId, cssText) {
  if (!doc || !doc.head || !cssText) {
    return false;
  }
  var style = doc.getElementById(styleId);
  if (!style) {
    style = doc.createElement('style');
    style.id = styleId;
    doc.head.appendChild(style);
  }
  style.textContent = cssText;
  return true;
}

function openyidaCreateThemeRuntime() {
  return {
    install: function(options) {
      var input = options || {};
      var cssText = input.cssText || openyidaThemeBuildCss(input.tokens || input);
      var styleId = input.styleId || 'yida-global-theme';
      var installed = 0;
      openyidaYidaApiBridgeTargets().forEach(function(target) {
        try {
          if (openyidaThemeUpsertStyle(target.document, styleId, cssText)) {
            installed += 1;
          }
        } catch (err) {}
      });
      return { installed: installed, styleId: styleId };
    }
  };
}

function openyidaInstallYidaApiBridge() {
  var bridge = openyidaCreateYidaApiBridge(this);
  var runtime = {
    ready: bridge.ready,
    yida: bridge,
    yidaApi: bridge,
    theme: openyidaCreateThemeRuntime()
  };
  try {
    window.__OPENYIDA_RUNTIME__ = runtime;
    window.openyidaRuntime = runtime;
    window.__OPENYIDA_YIDA_API__ = bridge;
    window.openyidaYidaApi = bridge;
  } catch (err) {}
  openyidaYidaApiBridgeTargets().forEach(function(target) {
    try {
      target.__OPENYIDA_RUNTIME__ = runtime;
      target.openyidaRuntime = runtime;
      target.__OPENYIDA_YIDA_API__ = bridge;
      target.openyidaYidaApi = bridge;
    } catch (err) {}
  });
  return runtime;
}`;

const CANVAS_ACTIONS_SOURCE = `${CANVAS_YIDA_API_BRIDGE_SOURCE}

export function didMount() {
  return openyidaInstallYidaApiBridge.call(this);
}`;
const CANVAS_ACTIONS_COMPILED = `"use strict";

exports.__esModule = true;
exports.didMount = didMount;
${CANVAS_YIDA_API_BRIDGE_SOURCE}
function didMount() {
  return openyidaInstallYidaApiBridge.call(this);
}`;

function buildCanvasPageSchemaContent(sourceCode, runtimeCode, importedModules, formUuid, options = {}) {
  return JSON.stringify(buildCanvasPageSchemaObject(
    sourceCode,
    runtimeCode,
    importedModules,
    formUuid,
    options
  ));
}

function buildCanvasPageSchemaObject(sourceCode, runtimeCode, importedModules, formUuid, options = {}) {
  const nextNodeId = resolveSchemaBuilderDependency(
    options.nextNodeId,
    createNodeIdGenerator,
    'nextNodeId'
  );
  const nextSuffix = resolveSchemaBuilderDependency(
    options.nextSuffix,
    () => generateSuffix,
    'nextSuffix'
  );
  const constructorCode = "function constructor() {\nvar module = { exports: {} };\nvar _this = this;\nthis.__initMethods__(module.exports, module);\nObject.keys(module.exports).forEach(function(item) {\n  if(typeof module.exports[item] === 'function'){\n    _this[item] = module.exports[item];\n  }\n});\n\n}";

  const schema = {
    schemaType: 'superform',
    schemaVersion: '5.0',
    pages: [
      {
        utils: [
          {
            name: 'legaoBuiltin',
            type: 'npm',
            content: { package: '@ali/vu-legao-builtin', version: '3.0.0', exportName: 'legaoBuiltin' },
          },
          {
            name: 'yidaPlugin',
            type: 'npm',
            content: { package: '@ali/vu-yida-plugin', version: '1.1.0', exportName: 'yidaPlugin' },
          },
        ],
        componentsMap: [
          { package: '@ali/vc-deep-yida', version: '1.5.169', componentName: 'YidaCodeCanvas' },
          { package: '@ali/vc-deep-yida', version: '1.5.169', componentName: 'RootHeader' },
          { package: '@ali/vc-deep-yida', version: '1.5.169', componentName: 'RootContent' },
          { package: '@ali/vc-deep-yida', version: '1.5.169', componentName: 'RootFooter' },
          { package: '@ali/vc-deep-yida', version: '1.5.169', componentName: 'Page' },
        ],
        componentsTree: [
          {
            componentName: 'Page',
            id: nextNodeId(),
            props: {
              contentBgColor: 'white',
              pageStyle: { backgroundColor: '#f2f3f5' },
              contentMargin: '0',
              contentPadding: '0',
              showTitle: false,
              contentPaddingMobile: '0',
              templateVersion: '1.0.0',
              contentMarginMobile: '0',
              className: 'page_' + nextSuffix(),
              contentBgColorMobile: 'white',
            },
            condition: true,
            css: 'body{background-color:#f2f3f5}.vc-page-yida-page{--yida-form-content-padding:0;--yida-form-content-margin:0;--yida-layout-padding:0}.vc-deep-container-entry.vc-rootcontent{padding:0!important;margin-top:0!important;margin-right:0!important;margin-bottom:0!important;margin-left:0!important}',
            methods: {
              __initMethods__: {
                type: 'js',
                source: 'function (exports, module) { /*set actions code here*/ }',
                compiled: 'function (exports, module) { /*set actions code here*/ }',
              },
            },
            dataSource: {
              offline: [],
              globalConfig: getGlobalDataSourceFitConfig(),
              online: [],
              list: [],
              sync: true,
            },
            lifeCycles: {
              constructor: { type: 'js', compiled: constructorCode, source: constructorCode },
              componentWillUnmount: '',
              componentDidMount: { name: 'didMount', id: 'didMount', params: {}, type: 'actionRef' },
            },
            hidden: false,
            title: '',
            isLocked: false,
            conditionGroup: '',
            children: [
              {
                componentName: 'YidaCodeCanvas',
                id: nextNodeId(),
                props: {
                  code: sourceCode,
                  runtimeCode,
                  pageType: 'application',
                  isWebCCompiled: true,
                  componentProps: {},
                  importedModules: importedModules || '',
                },
                condition: true,
                hidden: false,
                title: '',
                isLocked: false,
                conditionGroup: '',
              },
            ],
          },
        ],
        id: formUuid,
        connectComponent: [],
      },
    ],
    actions: {
      module: { compiled: CANVAS_ACTIONS_COMPILED, source: CANVAS_ACTIONS_SOURCE },
      type: 'FUNCTION',
      list: [{ id: 'didMount', title: 'didMount' }],
    },
    config: { connectComponent: [] },
  };
  assertCanvasSchemaHasNoEmoji(schema, formUuid);
  return schema;
}

function assertCanvasSchemaHasNoEmoji(schema, formUuid) {
  const artifact = 'canvas page schema ' + formUuid;
  const issues = findEmojiInValue(schema, {
    artifact,
  });
  if (issues.length === 0) {
    return;
  }

  const error = new Error(buildEmojiErrorMessage(issues, { artifact }));
  error.code = 'OPENYIDA_PAGE_SCHEMA_EMOJI_FORBIDDEN';
  error.details = { artifact, issues };
  throw error;
}

function resolveSchemaBuilderDependency(value, createDefault, property) {
  if (value === undefined) {
    return createDefault();
  }
  if (typeof value !== 'function') {
    throw new TypeError(`buildCanvasPageSchemaContent ${property} must be a function`);
  }
  return value;
}

module.exports = Object.freeze({
  CANVAS_ACTIONS_COMPILED,
  CANVAS_ACTIONS_SOURCE,
  CANVAS_YIDA_API_BRIDGE_SOURCE,
  buildCanvasPageSchemaContent,
  buildCanvasPageSchemaObject,
});
