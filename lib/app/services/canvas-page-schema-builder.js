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
      return router.push.apply(router, arguments);
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

function openyidaInstallYidaApiBridge() {
  var bridge = openyidaCreateYidaApiBridge(this);
  var utilsBridge = openyidaCreateUtilsBridge(this, bridge);
  try {
    window.__OPENYIDA_YIDA_API__ = bridge;
    window.openyidaYidaApi = bridge;
    window.__OPENYIDA_UTILS__ = utilsBridge;
    window.openyidaUtils = utilsBridge;
  } catch (err) {}
  openyidaYidaApiBridgeTargets().forEach(function(target) {
    try {
      target.__OPENYIDA_YIDA_API__ = bridge;
      target.openyidaYidaApi = bridge;
      target.__OPENYIDA_UTILS__ = utilsBridge;
      target.openyidaUtils = utilsBridge;
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
              contentBgColor: 'var(--pod-page-bg-color, var(--color-white, #fff))',
              pageStyle: { backgroundColor: 'var(--pod-page-bg-color, var(--color-white, #fff))' },
              contentMargin: '0',
              contentPadding: '0',
              showTitle: false,
              contentPaddingMobile: '0',
              templateVersion: '1.0.0',
              contentMarginMobile: '0',
              className: 'page_' + nextSuffix(),
              contentBgColorMobile: 'var(--pod-page-bg-color, var(--color-white, #fff))',
            },
            condition: true,
            css: 'body{background-color:var(--pod-page-bg-color,var(--color-white,#fff))}.vc-page-yida-page{--yida-form-content-padding:0;--yida-form-content-margin:0;--yida-layout-padding:0}.vc-deep-container-entry.vc-rootcontent{padding:0!important;margin-top:0!important;margin-right:0!important;margin-bottom:0!important;margin-left:0!important}',
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
