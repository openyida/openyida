'use strict';

const { default: babelTransform } = require('../core/babel-transform');

const YIDA_THEME_BLOCK_START = '/* openyida:theme:start */';
const YIDA_THEME_BLOCK_END = '/* openyida:theme:end */';
const YIDA_THEME_DID_MOUNT = 'openyidaThemeDidMount';
const FORM_DETAIL_STYLE_MARKER = 'openyida:yida-form-detail';
const FORM_DETAIL_STYLE_ID = 'yida-form-detail-style';

function getRootComponent(schema) {
  return schema &&
    schema.pages &&
    schema.pages[0] &&
    schema.pages[0].componentsTree &&
    schema.pages[0].componentsTree[0];
}

function ensureActionModule(schema) {
  if (!schema.actions || typeof schema.actions !== 'object') {
    schema.actions = { type: 'FUNCTION', list: [], module: {} };
  }
  if (!schema.actions.module || typeof schema.actions.module !== 'object') {
    schema.actions.module = {};
  }
  if (!Array.isArray(schema.actions.list)) {
    schema.actions.list = [];
  }
  return schema.actions;
}

function compileActionSource(source) {
  const compiledResult = babelTransform(source, {}, false, { RE_VERSION: '7.4.0' });
  if (compiledResult.error instanceof Error) {
    throw new Error('动作源码编译失败: ' + compiledResult.error.message);
  }
  return compiledResult.compiled;
}

function isValidActionIdentifier(value) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(String(value || ''));
}

function upsertGeneratedSourceBlockWithBounds(existingSource, generatedSource, blockStart, blockEnd) {
  const cleanSource = removeGeneratedSourceBlockWithBounds(existingSource, blockStart, blockEnd);
  return cleanSource.trimEnd() + '\n\n' + blockStart + '\n' + generatedSource.trim() + '\n' + blockEnd + '\n';
}

function removeGeneratedSourceBlockWithBounds(existingSource, blockStart, blockEnd) {
  const source = String(existingSource || '');
  const startIndex = source.indexOf(blockStart);
  const endIndex = source.indexOf(blockEnd);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return source;
  }
  return (source.slice(0, startIndex).trimEnd() + source.slice(endIndex + blockEnd.length)).trim();
}

function removeKnownThemeBlocks(source) {
  return removeGeneratedSourceBlockWithBounds(source || '', YIDA_THEME_BLOCK_START, YIDA_THEME_BLOCK_END);
}

function upsertActionListEntry(actions, entry) {
  actions.list = (actions.list || []).filter(function (item) {
    return !(item.id === entry.id && item.relatedEventId === entry.relatedEventId);
  });
  actions.list.push(entry);
}

function normalizeThemeTokens(themeTokens) {
  let source = themeTokens;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch (err) {
      source = {};
    }
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return {};
  }
  return Object.keys(source).reduce(function (result, key) {
    const value = source[key];
    if (/^--[A-Za-z0-9-_]+$/.test(key) && (typeof value === 'string' || typeof value === 'number')) {
      const cssValue = String(value).trim();
      if (cssValue && !/[{};<>]/.test(cssValue)) {
        result[key] = cssValue;
      }
    }
    return result;
  }, {});
}

function readExistingThemeTokens(source) {
  const match = String(source || '').match(/var\s+OPENYIDA_THEME_TOKENS\s*=\s*({[\s\S]*?});/);
  if (!match || !match[1]) {
    return {};
  }
  try {
    return normalizeThemeTokens(JSON.parse(match[1]));
  } catch (err) {
    return {};
  }
}

function buildYidaThemeActionSource(previousActionName, formDetailCss, themeTokens) {
  const previousName = isValidActionIdentifier(previousActionName) &&
    previousActionName !== YIDA_THEME_DID_MOUNT
    ? previousActionName
    : 'didMount';
  const detailCssLiteral = JSON.stringify(String(formDetailCss || ''));
  const themeTokensLiteral = JSON.stringify(normalizeThemeTokens(themeTokens));
  return `
var OPENYIDA_FORM_DETAIL_CSS = ${detailCssLiteral};
var OPENYIDA_THEME_TOKENS = ${themeTokensLiteral};

function openyidaThemeGetWindowDocuments() {
  var docs = [];
  var cursor = typeof window !== 'undefined' ? window : null;
  try {
    while (cursor && cursor.document) {
      if (docs.indexOf(cursor.document) === -1) {
        docs.push(cursor.document);
      }
      if (!cursor.parent || cursor.parent === cursor) {
        break;
      }
      cursor = cursor.parent;
    }
  } catch (err) {}
  return docs;
}

function openyidaThemeParseThemeName(doc) {
  var links = doc && doc.querySelectorAll ? doc.querySelectorAll('link[href]') : [];
  for (var index = 0; index < links.length; index++) {
    var href = links[index].getAttribute('href') || '';
    var match = href.match(/uxcore-kuma\\/[^/]+\\/([^/.,?]+)\\.min\\.css/) || href.match(/uxcore\\/uxcore-kuma\\/[^/]+\\/([^/.,?]+)\\.min\\.css/);
    if (match && match[1]) {
      return match[1];
    }
  }
  return '';
}

function openyidaThemeColorToRgb(color) {
  var source = String(color || '').trim();
  var rgbaMatch = source.match(/^rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/i);
  if (rgbaMatch) {
    return {
      r: Number(rgbaMatch[1]),
      g: Number(rgbaMatch[2]),
      b: Number(rgbaMatch[3])
    };
  }
  var value = source.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    return null;
  }
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

function openyidaThemeRgba(rgb, alpha) {
  return 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + alpha + ')';
}

function openyidaThemeMix(rgb, opacity, bg) {
  var bgValue = bg === 'black' ? 0 : 255;
  return {
    r: Math.round(rgb.r * opacity + bgValue * (1 - opacity)),
    g: Math.round(rgb.g * opacity + bgValue * (1 - opacity)),
    b: Math.round(rgb.b * opacity + bgValue * (1 - opacity))
  };
}

function openyidaThemeReadBrand(doc) {
  try {
    var value = doc.defaultView.getComputedStyle(doc.documentElement).getPropertyValue('--color-brand1-6').trim();
    if (value) {
      return value;
    }
  } catch (err) {}
  return '';
}

function openyidaThemeResolveColor(doc) {
  var fromVar = openyidaThemeReadBrand(doc);
  if (fromVar) {
    return fromVar;
  }
  var themeName = openyidaThemeParseThemeName(doc);
  var themeColors = {
    podBlue: '#007FFF',
    blue: '#007FFF',
    teal: '#009595',
    podGreen: '#00A532',
    green: '#00A532',
    deepBlue: '#3954E4',
    deepPurple: '#704AF7',
    purple: '#B421FD',
    podOrange: '#FD9100',
    orange: '#FD9100',
    yellow: '#FDBD00'
  };
  return themeColors[themeName] || '#3954E4';
}

function openyidaThemeBuildVariables(brandColor) {
  var rgb = openyidaThemeColorToRgb(brandColor);
  if (!rgb) {
    return {
      '--color-brand1-6': brandColor,
      '--color-brand-3': brandColor
    };
  }
  var deep = openyidaThemeMix(rgb, 0.7, 'black');
  var light = openyidaThemeMix(rgb, 0.7, 'white');
  var soft = openyidaThemeMix(rgb, 0.06, 'white');
  return {
    '--color-brand1-6': openyidaThemeRgba(rgb, 1),
    '--color-brand-4': openyidaThemeRgba(deep, 1),
    '--color-brand1-2': openyidaThemeRgba(soft, 1),
    '--color-brand-3': openyidaThemeRgba(rgb, 1),
    '--color-brand1-1': openyidaThemeRgba(light, 1),
    '--color-brand-2': openyidaThemeRgba(light, 1),
    '--color-brand-1': openyidaThemeRgba(rgb, 0.3),
    '--color-brand1-3': openyidaThemeRgba(rgb, 0.2),
    '--color-group': openyidaThemeRgba(rgb, 1) + ',rgba(0, 122, 255, 1),rgba(138, 92, 253, 1),rgba(30, 41, 128, 1),rgba(255, 107, 53, 1),rgba(0, 200, 255, 1)',
    '--color-brand1-10': openyidaThemeRgba(rgb, 0.3),
    '--color-brand1-9': openyidaThemeRgba(deep, 1)
  };
}

function openyidaThemeReadExplicitTokens() {
  var result = {};
  var tokens = OPENYIDA_THEME_TOKENS || {};
  Object.keys(tokens).forEach(function(key) {
    var value = tokens[key];
    if (/^--[A-Za-z0-9-_]+$/.test(key) && (typeof value === 'string' || typeof value === 'number')) {
      var cssValue = String(value).trim();
      if (cssValue && !/[{};<>]/.test(cssValue)) {
        result[key] = cssValue;
      }
    }
  });
  return result;
}

function openyidaThemeHasVariables(themeConfig) {
  return !!themeConfig && Object.keys(themeConfig).length > 0;
}

function openyidaThemeUpsertStyle(doc, id, cssText) {
  if (!doc || !doc.head || !doc.documentElement) {
    return;
  }
  var style = doc.getElementById(id);
  if (!style) {
    style = doc.createElement('style');
    style.id = id;
    doc.head.insertBefore(style, doc.head.firstChild);
  }
  style.innerHTML = cssText;
}

function openyidaThemeRemoveStyle(doc, id) {
  var style = doc && doc.getElementById ? doc.getElementById(id) : null;
  if (style && style.parentNode) {
    style.parentNode.removeChild(style);
  }
}

function openyidaThemeInjectGlobal(doc) {
  if (!doc || !doc.head || !doc.documentElement) {
    return;
  }
  var explicitThemeConfig = openyidaThemeReadExplicitTokens();
  var themeConfig = openyidaThemeHasVariables(explicitThemeConfig)
    ? explicitThemeConfig
    : openyidaThemeBuildVariables(openyidaThemeResolveColor(doc));
  var cssText = ':root {\\n' + Object.keys(themeConfig).map(function(key) {
    return '    ' + key + ': ' + themeConfig[key] + ';';
  }).join('\\n') + '\\n  }';
  openyidaThemeUpsertStyle(doc, 'yida-global-theme', cssText);
}

function openyidaThemeIsFormDetail(doc) {
  if (!doc) {
    return false;
  }
  try {
    var href = doc.defaultView && doc.defaultView.location ? String(doc.defaultView.location.href || '') : '';
    if (href.indexOf('/formDetail/') !== -1 || href.indexOf('formDetail') !== -1) {
      return true;
    }
  } catch (err) {}
  try {
    return !!(doc.querySelector && doc.querySelector('.yida-formDetail, .vc-page-yida-page.yida-formDetail'));
  } catch (err2) {}
  return false;
}

function openyidaThemeInjectFormDetail(doc) {
  if (!OPENYIDA_FORM_DETAIL_CSS) {
    openyidaThemeRemoveStyle(doc, '${FORM_DETAIL_STYLE_ID}');
    return;
  }
  if (!openyidaThemeIsFormDetail(doc)) {
    openyidaThemeRemoveStyle(doc, '${FORM_DETAIL_STYLE_ID}');
    return;
  }
  openyidaThemeUpsertStyle(doc, '${FORM_DETAIL_STYLE_ID}', '/* ${FORM_DETAIL_STYLE_MARKER}:runtime */\\n' + OPENYIDA_FORM_DETAIL_CSS);
}

export function openyidaInjectTheme() {
  var runtime = null;
  try { runtime = window.__OPENYIDA_RUNTIME__ || window.openyidaRuntime; } catch (err) {}
  if (!runtime) {
    try { runtime = window.parent.__OPENYIDA_RUNTIME__ || window.parent.openyidaRuntime; } catch (err) {}
  }
  if (!runtime) {
    try { runtime = window.top.__OPENYIDA_RUNTIME__ || window.top.openyidaRuntime; } catch (err) {}
  }
  if (runtime && runtime.theme && typeof runtime.theme.install === 'function') {
    runtime.theme.install({ tokens: OPENYIDA_THEME_TOKENS });
    if (runtime.form && typeof runtime.form.installDetailStyle === 'function') {
      runtime.form.installDetailStyle();
    }
    return runtime;
  }
  openyidaThemeGetWindowDocuments().forEach(function(doc) {
    openyidaThemeInjectGlobal(doc);
    openyidaThemeInjectFormDetail(doc);
  });
}

export function ${YIDA_THEME_DID_MOUNT}(event) {
  if (typeof ${previousName} === 'function') {
    ${previousName}.call(this, event);
  }
  return openyidaInjectTheme();
}
`;
}

function readExistingFormDetailCss(source) {
  const match = String(source || '').match(/var\s+OPENYIDA_FORM_DETAIL_CSS\s*=\s*("(?:\\.|[^"\\])*");/);
  if (!match || !match[1]) {
    return '';
  }
  try {
    return JSON.parse(match[1]);
  } catch (err) {
    return '';
  }
}

function ensureYidaGlobalThemeAction(schema, options = {}) {
  const root = getRootComponent(schema);
  if (!root) {
    return false;
  }
  const actions = ensureActionModule(schema);
  const currentLifeCycle = root.lifeCycles && root.lifeCycles.componentDidMount;
  const previousActionName = currentLifeCycle && currentLifeCycle.type === 'actionRef'
    ? currentLifeCycle.name
    : 'didMount';
  const hasFormDetailCssOption = Object.prototype.hasOwnProperty.call(options, 'formDetailCss');
  const formDetailCss = hasFormDetailCssOption
    ? options.formDetailCss
    : readExistingFormDetailCss(actions.module.source || '');
  const hasThemeTokensOption = Object.prototype.hasOwnProperty.call(options, 'themeTokens') ||
    Object.prototype.hasOwnProperty.call(options, 'tokens');
  const themeTokens = hasThemeTokensOption
    ? normalizeThemeTokens(Object.prototype.hasOwnProperty.call(options, 'themeTokens') ? options.themeTokens : options.tokens)
    : readExistingThemeTokens(actions.module.source || '');
  const generatedSource = buildYidaThemeActionSource(previousActionName, formDetailCss || '', themeTokens);

  root.lifeCycles = root.lifeCycles || {};
  root.lifeCycles.componentDidMount = {
    name: YIDA_THEME_DID_MOUNT,
    id: YIDA_THEME_DID_MOUNT,
    params: {},
    type: 'actionRef',
  };
  actions.list = (actions.list || []).filter(function (item) {
    return item.id !== YIDA_THEME_DID_MOUNT;
  });
  upsertActionListEntry(actions, {
    id: YIDA_THEME_DID_MOUNT,
    name: YIDA_THEME_DID_MOUNT,
    relatedEventId: 'lifecycle:didMount',
    type: 'lifeCycleEvent',
    params: {},
  });
  actions.module.source = upsertGeneratedSourceBlockWithBounds(
    removeKnownThemeBlocks(actions.module.source || ''),
    generatedSource,
    YIDA_THEME_BLOCK_START,
    YIDA_THEME_BLOCK_END
  );
  actions.module.compiled = compileActionSource(actions.module.source);
  actions.type = actions.type || 'FUNCTION';
  return true;
}

function hasYidaGlobalThemeAction(schema) {
  const root = getRootComponent(schema);
  const actionSource = schema && schema.actions && schema.actions.module
    ? String(schema.actions.module.source || '')
    : '';
  const componentDidMount = root && root.lifeCycles ? root.lifeCycles.componentDidMount : null;
  return actionSource.includes(YIDA_THEME_BLOCK_START) &&
    actionSource.includes('yida-global-theme') &&
    !!componentDidMount &&
    componentDidMount.type === 'actionRef' &&
    componentDidMount.name === YIDA_THEME_DID_MOUNT;
}

function hasYidaFormDetailStyleAction(schema) {
  const actionSource = schema && schema.actions && schema.actions.module
    ? String(schema.actions.module.source || '')
    : '';
  return hasYidaGlobalThemeAction(schema) &&
    actionSource.includes(FORM_DETAIL_STYLE_MARKER) &&
    actionSource.includes(FORM_DETAIL_STYLE_ID) &&
    readExistingFormDetailCss(actionSource).trim() !== '';
}

module.exports = {
  ensureYidaGlobalThemeAction,
  hasYidaGlobalThemeAction,
  hasYidaFormDetailStyleAction,
  constants: {
    YIDA_THEME_BLOCK_START,
    YIDA_THEME_BLOCK_END,
    YIDA_THEME_DID_MOUNT,
    FORM_DETAIL_STYLE_MARKER,
    FORM_DETAIL_STYLE_ID,
  },
  _private: {
    buildYidaThemeActionSource,
    compileActionSource,
    ensureActionModule,
    normalizeThemeTokens,
    readExistingThemeTokens,
    removeKnownThemeBlocks,
    readExistingFormDetailCss,
  },
};
