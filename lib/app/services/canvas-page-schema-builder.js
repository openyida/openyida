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

const CANVAS_YIDA_API_BRIDGE_SOURCE = `var OPENYIDA_YIDA_FORM_API_METHODS = [
  'saveFormData',
  'updateFormData',
  'searchFormDataIds',
  'getFormComponentDefinationList',
  'deleteFormData',
  'getFormDataById',
  'searchFormDatas'
];
var OPENYIDA_YIDA_PROCESS_API_METHODS = [
  'startProcessInstance',
  'updateProcessInstance',
  'deleteProcessInstance',
  'getProcessInstances',
  'getProcessInstanceIds',
  'getProcessInstanceById'
];
var OPENYIDA_YIDA_FORM_DESIGN_API_METHODS = [
  'saveFormSchemaInfo',
  'getFormSchema',
  'saveFormSchema',
  'updateFormConfig'
];
var OPENYIDA_YIDA_GENERIC_API_METHODS = [
  'request',
  'searchUserList'
];
var OPENYIDA_YIDA_SEARCH_PARAM_METHODS = [
  'searchFormDatas',
  'searchFormDataIds',
  'getProcessInstances',
  'getProcessInstanceIds'
];
var OPENYIDA_KNOWN_YIDA_API_METHODS = OPENYIDA_YIDA_FORM_API_METHODS
  .concat(OPENYIDA_YIDA_PROCESS_API_METHODS)
  .concat(OPENYIDA_YIDA_FORM_DESIGN_API_METHODS)
  .concat(OPENYIDA_YIDA_GENERIC_API_METHODS);
var OPENYIDA_UTIL_API_METHODS = [
  'dialog',
  'formatter',
  'getDateTimeRange',
  'getLocale',
  'getLoginUserId',
  'getLoginUserName',
  'isMobile',
  'isSubmissionPage',
  'isViewPage',
  'loadScript',
  'loadStyleSheet',
  'openPage',
  'previewImage',
  'toast'
];

function openyidaYidaApiBridgeTargets() {
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

function openyidaShouldNormalizeSearchParams(methodName, params) {
  if (!params) {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(params, 'searchFieldJson')) {
    return true;
  }
  return OPENYIDA_YIDA_SEARCH_PARAM_METHODS.indexOf(methodName) !== -1;
}

function openyidaNormalizeYidaApiParams(methodName, params) {
  var next = Object.assign({}, params || {});
  if (!openyidaShouldNormalizeSearchParams(methodName, next)) {
    return next;
  }
  if (next.searchFieldJson && typeof next.searchFieldJson !== 'string') {
    next.searchFieldJson = JSON.stringify(next.searchFieldJson);
  }
  if (
    next.query &&
    !next.searchFieldJson &&
    OPENYIDA_YIDA_SEARCH_PARAM_METHODS.indexOf(methodName) !== -1
  ) {
    next.searchFieldJson = JSON.stringify(next.query);
    delete next.query;
  }
  if (!next.searchFieldJson) {
    next.searchFieldJson = '';
  }
  return next;
}

function openyidaCollectYidaApiMethodNames(yida) {
  var names = OPENYIDA_KNOWN_YIDA_API_METHODS.slice();
  function addName(name) {
    if (name && names.indexOf(name) === -1) {
      names.push(name);
    }
  }
  var cursor = yida;
  while (cursor && cursor !== Object.prototype) {
    try {
      Object.getOwnPropertyNames(cursor).forEach(function(name) {
        if (name !== 'constructor' && typeof yida[name] === 'function') {
          addName(name);
        }
      });
    } catch (err) {}
    cursor = Object.getPrototypeOf(cursor);
  }
  return names;
}

function openyidaAvailableYidaApiMethods(yida, methodNames) {
  if (!yida) {
    return [];
  }
  return methodNames.filter(function(methodName) {
    return typeof yida[methodName] === 'function';
  });
}

function openyidaCreateYidaApiBridge(context) {
  var yida = context && context.utils && context.utils.yida;
  var methodNames = openyidaCollectYidaApiMethodNames(yida);
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
  var bridge = {
    ready: !!yida,
    apiGroups: {
      form: OPENYIDA_YIDA_FORM_API_METHODS.slice(),
      process: OPENYIDA_YIDA_PROCESS_API_METHODS.slice(),
      formDesign: OPENYIDA_YIDA_FORM_DESIGN_API_METHODS.slice(),
      generic: OPENYIDA_YIDA_GENERIC_API_METHODS.slice()
    },
    knownMethods: OPENYIDA_KNOWN_YIDA_API_METHODS.slice(),
    availableMethods: openyidaAvailableYidaApiMethods(yida, methodNames),
    missingKnownMethods: OPENYIDA_KNOWN_YIDA_API_METHODS.filter(function(methodName) {
      return !yida || typeof yida[methodName] !== 'function';
    }),
    invoke: invoke
  };
  methodNames.forEach(function(methodName) {
    if (!bridge[methodName]) {
      bridge[methodName] = function(params) {
        return invoke(methodName, params);
      };
    }
  });
  return bridge;
}

function openyidaCollectUtilsMethodNames(utils) {
  var names = OPENYIDA_UTIL_API_METHODS.slice();
  function addName(name) {
    if (name && names.indexOf(name) === -1) {
      names.push(name);
    }
  }
  var cursor = utils;
  while (cursor && cursor !== Object.prototype) {
    try {
      Object.getOwnPropertyNames(cursor).forEach(function(name) {
        if (name !== 'constructor' && name !== 'yida' && name !== 'router' && typeof utils[name] === 'function') {
          addName(name);
        }
      });
    } catch (err) {}
    cursor = Object.getPrototypeOf(cursor);
  }
  return names;
}

function openyidaAvailableUtilsMethods(utils, methodNames) {
  if (!utils) {
    return [];
  }
  return methodNames.filter(function(methodName) {
    return typeof utils[methodName] === 'function';
  });
}

function openyidaCreateRouterBridge(utils) {
  var router = utils && utils.router;
  var bridge = {
    ready: !!router,
    availableMethods: []
  };
  if (router && typeof router.push === 'function') {
    bridge.availableMethods.push('push');
    bridge.push = function() {
      var args = Array.prototype.slice.call(arguments);
      // 完整地址使用 URL 模式，避免平台再次拼接应用路由前缀。
      if (args[3] === undefined && typeof args[0] === 'string' &&
          /^(https?:[/][/]|[/][/]|[/]APP_[^/?#]+([/?#]|$))/i.test(args[0])) {
        args[3] = true;
      }
      return router.push.apply(router, args);
    };
  } else {
    bridge.push = function() {
      throw new Error('this.utils.router.push is not available');
    };
  }
  return bridge;
}

function openyidaCreateUtilsBridge(context, yidaBridge) {
  var utils = context && context.utils;
  var methodNames = openyidaCollectUtilsMethodNames(utils);
  function invoke(methodName) {
    if (!utils || typeof utils[methodName] !== 'function') {
      throw new Error('this.utils.' + methodName + ' is not available');
    }
    return utils[methodName].apply(utils, Array.prototype.slice.call(arguments, 1));
  }
  var bridge = {
    ready: !!utils,
    apiGroups: {
      utility: OPENYIDA_UTIL_API_METHODS.slice(),
      router: ['push'],
      yida: OPENYIDA_KNOWN_YIDA_API_METHODS.slice()
    },
    knownMethods: OPENYIDA_UTIL_API_METHODS.slice(),
    availableMethods: openyidaAvailableUtilsMethods(utils, methodNames),
    missingKnownMethods: OPENYIDA_UTIL_API_METHODS.filter(function(methodName) {
      return !utils || typeof utils[methodName] !== 'function';
    }),
    invoke: invoke,
    router: openyidaCreateRouterBridge(utils),
    yida: yidaBridge
  };
  methodNames.forEach(function(methodName) {
    if (!bridge[methodName]) {
      bridge[methodName] = function() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(methodName);
        return invoke.apply(null, args);
      };
    }
  });
  return bridge;
}

function openyidaConnectorCsrfToken() {
  var targets = openyidaYidaApiBridgeTargets();
  for (var i = 0; i < targets.length; i += 1) {
    try {
      var config = targets[i] && targets[i].g_config;
      if (config && config._csrf_token) {
        return String(config._csrf_token);
      }
    } catch (err) {}
  }
  return '';
}

function openyidaConnectorBridgeError(code, message) {
  var error = new Error(message);
  error.code = code;
  return error;
}

function openyidaResolveConnectorName(binding) {
  var connectorName = binding && binding.connectorName ? String(binding.connectorName) : '';
  var legacyConnectorId = binding && binding.connectorId ? String(binding.connectorId) : '';
  if (!connectorName && legacyConnectorId.indexOf('Http_') === 0) {
    connectorName = legacyConnectorId;
  }
  if (!connectorName || connectorName.indexOf('Http_') !== 0) {
    throw openyidaConnectorBridgeError(
      'CONNECTOR_RUNTIME_NAME_REQUIRED',
      'connectorName must be the internal Http_* connector name; numeric connectorId is only for CLI management'
    );
  }
  if (legacyConnectorId.indexOf('Http_') === 0 && legacyConnectorId !== connectorName) {
    throw openyidaConnectorBridgeError(
      'CONNECTOR_RUNTIME_IDENTITY_MISMATCH',
      'connectorName and legacy connectorId refer to different connectors'
    );
  }
  return connectorName;
}

function openyidaParseConnectorJson(value) {
  if (typeof value !== 'string') { return value; }
  try { return JSON.parse(value); } catch (err) { return value; }
}

function openyidaConnectorErrorMessage(value, depth) {
  if (depth > 4 || value === null || value === undefined) { return ''; }
  var parsed = openyidaParseConnectorJson(value);
  if (typeof parsed === 'string') { return parsed; }
  if (typeof parsed !== 'object') { return ''; }
  var directKeys = ['errorMsg', 'errorMessage', 'message'];
  for (var i = 0; i < directKeys.length; i += 1) {
    var direct = parsed[directKeys[i]];
    if (direct !== undefined && direct !== null && String(direct).trim()) {
      return String(direct);
    }
  }
  if (parsed.error && typeof parsed.error === 'object') {
    var nestedError = openyidaConnectorErrorMessage(parsed.error, depth + 1);
    if (nestedError) { return nestedError; }
  }
  if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
    var listedError = openyidaConnectorErrorMessage(parsed.errors[0], depth + 1);
    if (listedError) { return listedError; }
  }
  var nestedKeys = ['content', 'serviceReturnValue', 'result', 'data'];
  for (var j = 0; j < nestedKeys.length; j += 1) {
    if (parsed[nestedKeys[j]] !== undefined && parsed[nestedKeys[j]] !== null) {
      var nested = openyidaConnectorErrorMessage(parsed[nestedKeys[j]], depth + 1);
      if (nested) { return nested; }
    }
  }
  return '';
}

function openyidaConnectorPayloadFailed(value) {
  var parsed = openyidaParseConnectorJson(value);
  return !!(parsed && typeof parsed === 'object'
    && (parsed.success === false || parsed.hasError === true));
}

function openyidaNormalizeConnectorInputs(inputs) {
  var source = inputs && typeof inputs === 'object' ? inputs : {};
  var body = Object.prototype.hasOwnProperty.call(source, 'body') ? source.body : {};
  if (body === null || body === undefined) { body = {}; }
  if (typeof body !== 'object' || Array.isArray(body)) {
    throw openyidaConnectorBridgeError(
      'CONNECTOR_BODY_OBJECT_REQUIRED',
      'connector inputs.body must be an object; pass the value directly instead of JSON.stringify(...)'
    );
  }
  return {
    path: source.path && typeof source.path === 'object' ? source.path : {},
    query: source.query && typeof source.query === 'object' ? source.query : {},
    header: source.header && typeof source.header === 'object' ? source.header : {},
    body: body
  };
}

function openyidaCreateConnectorApiBridge() {
  function invoke(binding, inputs) {
    if (!binding || !binding.operationId) {
      return Promise.reject(openyidaConnectorBridgeError(
        'CONNECTOR_RUNTIME_IDENTITY_REQUIRED',
        'connectorName and operationId are required'
      ));
    }
    var connectorName;
    var normalizedInputs;
    try {
      connectorName = openyidaResolveConnectorName(binding);
      normalizedInputs = openyidaNormalizeConnectorInputs(inputs);
    } catch (error) {
      return Promise.reject(error);
    }
    var connectorInfo = {
      connectorId: connectorName,
      actionId: String(binding.operationId),
      type: 'httpConnector'
    };
    if (binding.connectionId !== undefined && binding.connectionId !== null && binding.connectionId !== '') {
      connectorInfo.connection = String(binding.connectionId);
    }
    var csrfToken = openyidaConnectorCsrfToken();
    var endpoint = '/query/publicService/invokeService.json';
    if (csrfToken) {
      endpoint += '?_csrf_token=' + encodeURIComponent(csrfToken);
    }
    var body = 'inputs=' + encodeURIComponent(JSON.stringify(normalizedInputs))
      + '&serviceInfo=' + encodeURIComponent(JSON.stringify({ connectorInfo: connectorInfo }));
    var headers = { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' };
    if (csrfToken) {
      headers.global_csrf_token = csrfToken;
    }
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
      return Promise.reject(new Error('window.fetch is not available'));
    }
    return window.fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: headers,
      body: body
    }).then(function(response) {
      if (!response || response.ok === false || typeof response.json !== 'function') {
        throw new Error('connector invocation HTTP request failed');
      }
      return response.json();
    }).then(function(payload) {
      if (!payload || openyidaConnectorPayloadFailed(payload)) {
        throw openyidaConnectorBridgeError(
          'CONNECTOR_INVOCATION_FAILED',
          openyidaConnectorErrorMessage(payload, 0) || 'connector invocation failed'
        );
      }
      var value = payload.content && Object.prototype.hasOwnProperty.call(payload.content, 'serviceReturnValue')
        ? payload.content.serviceReturnValue
        : payload.content;
      value = openyidaParseConnectorJson(value);
      if (openyidaConnectorPayloadFailed(value)) {
        throw openyidaConnectorBridgeError(
          'CONNECTOR_SERVICE_FAILED',
          openyidaConnectorErrorMessage(value, 0) || 'connector service returned failure'
        );
      }
      return value;
    });
  }
  return { ready: true, invoke: invoke };
}

function openyidaInstallYidaApiBridge() {
  var bridge = openyidaCreateYidaApiBridge(this);
  var utilsBridge = openyidaCreateUtilsBridge(this, bridge);
  var connectorBridge = openyidaCreateConnectorApiBridge();
  try {
    window.__OPENYIDA_YIDA_API__ = bridge;
    window.openyidaYidaApi = bridge;
    window.__OPENYIDA_UTILS__ = utilsBridge;
    window.openyidaUtils = utilsBridge;
    window.__OPENYIDA_CONNECTOR_API__ = connectorBridge;
    window.openyidaConnectorApi = connectorBridge;
  } catch (err) {}
  openyidaYidaApiBridgeTargets().forEach(function(target) {
    try {
      target.__OPENYIDA_YIDA_API__ = bridge;
      target.openyidaYidaApi = bridge;
      target.__OPENYIDA_UTILS__ = utilsBridge;
      target.openyidaUtils = utilsBridge;
      target.__OPENYIDA_CONNECTOR_API__ = connectorBridge;
      target.openyidaConnectorApi = connectorBridge;
    } catch (err) {}
  });
  return bridge;
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
          { package: '@ali/vc-deep-yida', componentName: 'YidaCodeCanvas' },
          { package: '@ali/vc-deep-yida', componentName: 'RootHeader' },
          { package: '@ali/vc-deep-yida', componentName: 'RootContent' },
          { package: '@ali/vc-deep-yida', componentName: 'RootFooter' },
          { package: '@ali/vc-deep-yida', componentName: 'Page' },
        ],
        componentsTree: [
          {
            componentName: 'Page',
            id: nextNodeId(),
            props: {
              contentBgColor: 'var(--oyd-page-background, var(--pod-page-bg-color, var(--color-white, #fff)))',
              pageStyle: { backgroundColor: 'var(--oyd-page-background, var(--pod-page-bg-color, var(--color-white, #fff)))' },
              contentMargin: '0',
              contentPadding: '0',
              showTitle: false,
              contentPaddingMobile: '0',
              templateVersion: '1.0.0',
              contentMarginMobile: '0',
              className: 'page_' + nextSuffix(),
              contentBgColorMobile: 'var(--oyd-page-background, var(--pod-page-bg-color, var(--color-white, #fff)))',
            },
            condition: true,
            css: [
              '.vc-page-yida-page{--yida-form-content-padding:0;--yida-form-content-margin:0;--yida-layout-padding:0}',
              '.vc-deep-container-entry.vc-rootcontent{padding:0!important;margin-top:0!important;margin-right:0!important;margin-bottom:0!important;margin-left:0!important}',
              // 隔离首个子元素的外边距，浮导 margin 不得把整个 Canvas 顶离页面顶部。
              '.yida-code-canvas{display:flow-root}',
              // Canvas 整页的纯容器至少撑满当前视口，避免嵌入时高度塌陷而裁掉内容。
              '.vc-page-yida-pure-container:has(> .yida-code-canvas){min-height:100vh}',
            ].join(''),
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
