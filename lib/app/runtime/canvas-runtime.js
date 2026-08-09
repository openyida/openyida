'use strict';

const {
  CANVAS_YIDA_API_METHODS,
  CANVAS_YIDA_QUERY_METHODS,
} = require('./canvas-yida-api-methods');

function buildCanvasRuntimeSource() {
  const methodNames = JSON.stringify(CANVAS_YIDA_API_METHODS);
  const queryMethodNames = JSON.stringify(CANVAS_YIDA_QUERY_METHODS);

  return `var OPENYIDA_RUNTIME_VERSION = 1;
var OPENYIDA_YIDA_API_METHODS = ${methodNames};
var OPENYIDA_YIDA_QUERY_METHODS = ${queryMethodNames};

function openyidaRuntimeTargets() {
  var targets = [];
  function pushTarget(target) {
    if (target && targets.indexOf(target) === -1) targets.push(target);
  }
  try { pushTarget(window); } catch (err) {}
  try { pushTarget(window.parent); } catch (err) {}
  try { pushTarget(window.top); } catch (err) {}
  return targets;
}

function openyidaRuntimeError(code, message, evidence, retryable, repairType) {
  var error = new Error(message);
  error.code = code;
  error.evidence = evidence || {};
  error.retryable = retryable === true;
  error.repairType = repairType || 'runtime';
  return error;
}

function openyidaNormalizeYidaApiParams(methodName, params) {
  var next = Object.assign({}, params || {});
  if (OPENYIDA_YIDA_QUERY_METHODS.indexOf(methodName) >= 0) {
    if (next.searchFieldJson && typeof next.searchFieldJson !== 'string') {
      next.searchFieldJson = JSON.stringify(next.searchFieldJson);
    }
    if (next.query && !next.searchFieldJson) {
      next.searchFieldJson = JSON.stringify(next.query);
      delete next.query;
    }
    if (!next.searchFieldJson) next.searchFieldJson = '';
  }
  return next;
}

function openyidaCreateYidaApiBridge(context) {
  var yida = null;
  var bridge = {
    ready: false,
    methods: OPENYIDA_YIDA_API_METHODS.slice(),
    setContext: function(nextContext) {
      yida = nextContext && nextContext.utils && nextContext.utils.yida;
      this.ready = !!yida;
      return this.ready;
    },
    invoke: function(methodName, params) {
      if (OPENYIDA_YIDA_API_METHODS.indexOf(methodName) < 0) {
        return Promise.reject(openyidaRuntimeError(
          'OPENYIDA_YIDA_API_UNKNOWN',
          'Unsupported Yida API: ' + methodName,
          { methodName: methodName },
          false,
          'source'
        ));
      }
      if (!yida || typeof yida[methodName] !== 'function') {
        return Promise.reject(openyidaRuntimeError(
          'OPENYIDA_YIDA_API_UNAVAILABLE',
          'this.utils.yida.' + methodName + ' is not available',
          { methodName: methodName },
          true,
          'runtime'
        ));
      }
      try {
        return Promise.resolve(yida[methodName].call(
          yida,
          openyidaNormalizeYidaApiParams(methodName, params)
        )).catch(function(err) {
          if (err && err.code && err.evidence) throw err;
          throw openyidaRuntimeError(
            'OPENYIDA_YIDA_API_CALL_FAILED',
            err && err.message ? err.message : 'Yida API call failed: ' + methodName,
            { methodName: methodName },
            true,
            'runtime'
          );
        });
      } catch (err) {
        return Promise.reject(openyidaRuntimeError(
          'OPENYIDA_YIDA_API_CALL_FAILED',
          err && err.message ? err.message : 'Yida API call failed: ' + methodName,
          { methodName: methodName },
          true,
          'runtime'
        ));
      }
    }
  };
  OPENYIDA_YIDA_API_METHODS.forEach(function(methodName) {
    bridge[methodName] = function(params) { return bridge.invoke(methodName, params); };
  });
  bridge.setContext(context);
  return bridge;
}

function openyidaThemeNormalizeTokens(tokens) {
  var source = tokens && tokens.tokens ? tokens.tokens : tokens;
  var normalized = {};
  Object.keys(source || {}).forEach(function(key) {
    var value = source[key];
    if (value === undefined || value === null || value === '') return;
    normalized[key.indexOf('--') === 0 ? key : '--' + key] = String(value);
  });
  return normalized;
}

function openyidaThemeBuildCss(tokens) {
  var normalized = openyidaThemeNormalizeTokens(tokens);
  var keys = Object.keys(normalized);
  if (!keys.length) return '';
  return ':root {\\n' + keys.map(function(key) {
    return '  ' + key + ': ' + normalized[key] + ';';
  }).join('\\n') + '\\n}';
}

function openyidaRuntimeUpsertStyle(doc, styleId, cssText) {
  if (!doc || !doc.head || !cssText) return false;
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
  var currentTokens = {};
  var currentStyleId = 'yida-global-theme';
  function installIntoTarget(target, cssText, styleId) {
    try {
      return openyidaRuntimeUpsertStyle(target && target.document, styleId, cssText);
    } catch (err) {
      return false;
    }
  }
  return {
    getTokens: function() { return Object.assign({}, currentTokens); },
    install: function(options) {
      var input = options || {};
      currentTokens = openyidaThemeNormalizeTokens(input.tokens || input);
      currentStyleId = input.styleId || currentStyleId;
      var cssText = input.cssText || openyidaThemeBuildCss(currentTokens);
      var installed = 0;
      openyidaRuntimeTargets().forEach(function(target) {
        if (installIntoTarget(target, cssText, currentStyleId)) installed += 1;
      });
      return { installed: installed, styleId: currentStyleId, tokens: this.getTokens() };
    },
    installIntoFrame: function(tokens, iframeElement) {
      if (tokens) currentTokens = openyidaThemeNormalizeTokens(tokens);
      var frameWindow = iframeElement && iframeElement.contentWindow;
      var cssText = openyidaThemeBuildCss(currentTokens);
      var installed = installIntoTarget(frameWindow, cssText, currentStyleId) ? 1 : 0;
      return { installed: installed, styleId: currentStyleId, tokens: this.getTokens() };
    },
    refresh: function() {
      return this.install({ tokens: currentTokens, styleId: currentStyleId });
    }
  };
}

function openyidaInstallRuntime() {
  var existingRuntime = null;
  openyidaRuntimeTargets().some(function(target) {
    try {
      var candidate = target.__OPENYIDA_RUNTIME__ || target.openyidaRuntime;
      if (candidate && candidate.version === OPENYIDA_RUNTIME_VERSION && candidate.yida) {
        existingRuntime = candidate;
        return true;
      }
    } catch (err) {}
    return false;
  });
  if (existingRuntime) {
    if (typeof existingRuntime.yida.setContext === 'function') {
      existingRuntime.ready = existingRuntime.yida.setContext(this);
    }
    openyidaRuntimeTargets().forEach(function(target) {
      try {
        target.__OPENYIDA_RUNTIME__ = existingRuntime;
        target.openyidaRuntime = existingRuntime;
      target.__OPENYIDA_YIDA_API__ = existingRuntime.yida;
      target.openyidaYidaApi = existingRuntime.yida;
      } catch (err) {}
    });
    return existingRuntime;
  }
  var bridge = openyidaCreateYidaApiBridge(this);
  var runtime = {
    version: OPENYIDA_RUNTIME_VERSION,
    ready: bridge.ready,
    yida: bridge,
    yidaApi: bridge,
    theme: openyidaCreateThemeRuntime(),
    capabilities: {
      yidaMethods: OPENYIDA_YIDA_API_METHODS.slice(),
      themeMethods: ['refresh', 'install', 'installIntoFrame', 'getTokens']
    }
  };
  openyidaRuntimeTargets().forEach(function(target) {
    try {
      target.__OPENYIDA_RUNTIME__ = runtime;
      target.openyidaRuntime = runtime;
      target.__OPENYIDA_YIDA_API__ = bridge;
      target.openyidaYidaApi = bridge;
    } catch (err) {}
  });
  return runtime;
}`;
}

module.exports = {
  buildCanvasRuntimeSource,
};
