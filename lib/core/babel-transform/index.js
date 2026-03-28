'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
Object.defineProperty(exports, 'JSXUtil', {
  enumerable: true,
  get: function get() {
    return _jsxUtils.default;
  }
});
exports.default = compile;
exports.getCode = getCode;
var _jsxUtils = _interopRequireDefault(require('./jsx-utils'));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function ownKeys(object, enumerableOnly) { const keys = Object.keys(object); if (Object.getOwnPropertySymbols) { let symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (let i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(arg) { const key = _toPrimitive(arg, 'string'); return _typeof(key) === 'symbol' ? key : String(key); }
function _toPrimitive(input, hint) { if (_typeof(input) !== 'object' || input === null) {return input;} const prim = input[Symbol.toPrimitive]; if (prim !== undefined) { const res = prim.call(input, hint || 'default'); if (_typeof(res) !== 'object') {return res;} throw new TypeError('@@toPrimitive must return a primitive value.'); } return (hint === 'string' ? String : Number)(input); }
function _typeof(obj) { '@babel/helpers - typeof'; return _typeof = 'function' === typeof Symbol && 'symbol' === typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && 'function' === typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? 'symbol' : typeof obj; }, _typeof(obj); }
// should not use import Babel from 'babel-standalone';
const Babel = require('@babel/standalone');
let RE_VERSION = '4.0.0';
// 区分浏览器还是node环境
if ((typeof window === 'undefined' ? 'undefined' : _typeof(window)) === 'object') {
  const VisualEngine = window.VisualEngine;
  RE_VERSION = window.pageConfig && window.pageConfig.RE_VERSION || VisualEngine && VisualEngine.Env && VisualEngine.Env.get('RE_VERSION') || window.RenderEngine && window.RenderEngine.version || '4.0.0';
}
function isString(string) {
  return {}.toString.call(string) === '[object String]';
}

// 查找组件
function findComps(ast) {
  const id = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'normal';
  const _ref = (typeof window === 'undefined' ? 'undefined' : _typeof(window)) === 'object' ? window : {},
    MyBabel = _ref.MyBabel;
  if (!ast || !MyBabel) {
    return;
  }
  const comps = [];
  MyBabel.traverse(ast, {
    CallExpression: function CallExpression(path) {
      if (!path.node.callee || path.node.callee.type !== 'MemberExpression' || !path.node.callee.property || !['createElement', 'getComponentView'].includes(path.node.callee.property.name)) {
        return;
      }
      let node = Array.isArray(path.node.arguments) ? path.node.arguments[0] : {};
      // 形如 Deep.Button，分析出Deep.Button
      let componentName = '';
      while (true) {
        if (node && node.type === 'MemberExpression' && node.object) {
          var _node, _node$property;
          componentName = ''.concat((_node = node) === null || _node === void 0 ? void 0 : (_node$property = _node.property) === null || _node$property === void 0 ? void 0 : _node$property.name).concat(componentName == '' ? '' : '.') + componentName;
          node = node.object;
        } else if (node && node.type === 'Identifier') {
          componentName = ''.concat(node.name).concat(componentName == '' ? '' : '.') + componentName;
          break;
        } else if (node && node.type === 'StringLiteral') {
          componentName += ''.concat(node.value) + componentName;
          break;
        } else {
          break;
        }
      }
      comps.push(componentName);
    }
  });
  _jsxUtils.default.setComps(id, comps);
}
const EMPTY_FUNC_STRING = 'function emptyCall() {}';
function getCode(obj) {
  const opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {
    compiled: false,
    allowEmpty: false
  };
  if (typeof obj === 'string') {
    return obj;
  }
  if (_typeof(obj) === 'object' && obj !== null) {
    const result = opts.compiled ? 'value' in obj ? obj.value : obj.compiled : obj.source;
    return opts.allowEmpty ? result : result || EMPTY_FUNC_STRING;
  }
  if (opts.allowEmpty) {
    return obj;
  }
  return EMPTY_FUNC_STRING;
}
function compile() {
  const source = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  const options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  const transformFunction = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  let env = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
  const compileOptions = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};
  let compiled = '';
  let error = {};
  env = _objectSpread({
    RE_VERSION: RE_VERSION
  }, env);
  const isOldRenderEngine = parseFloat(env.RE_VERSION, 10) < 4.2;
  if (isString(source) && source !== '') {
    if (isOldRenderEngine && !env.shouldCompile) {
      return source;
    }
    let decoSource = source;
    if (transformFunction) {
      decoSource = 'var __compiledFunc__ = '.concat(source, ';');
    }
    try {
      const presets = parseInt(Babel.version, 10) > 6 ? ['react', ['env', {
        'loose': true,
        'spec': true,
        targets: {
          browsers: ['ie >= 11', 'chrome >= 62']
        }
      }]] : ['react', 'es2015-loose', 'stage-0'];
      if (parseFloat(env.RE_VERSION, 10) < 7.0) {
        const result = Babel.transform(decoSource, _objectSpread({
          presets: presets,
          ast: true
        }, options));
        compiled = result.code;
        findComps(result.ast, env.id);
        if (transformFunction) {
          compiled = 'function main(){\n    '.concat(compiled, '\n    return __compiledFunc__.apply(this, arguments);\n  }');
        } else {
          compiled = ''.concat(compiled, '\n');
        }
      } else {
        const addonBindings = [];
        function addBindingToScope(scope, bind) {
          if (!scope.addonBindings) {
            scope.addonBindings = [];
          }
          scope.addonBindings.push(bind);
        }
        function hasAddonBinding(scope, bind) {
          return scope.addonBindings && scope.addonBindings.indexOf(bind) > -1;
        }
        let plugins = [function (_ref2) {
          const types = _ref2.types,
            template = _ref2.template;
          function getJSXTagName(ast) {
            if (ast.type === 'JSXMemberExpression') {
              return getJSXTagName(ast.object);
            }
            if (ast.type === 'JSXIdentifier') {
              return ast.name;
            }
            return null;
          }
          function isCustomTag(name) {
            return /^[A-Z]/.test(name);
          }
          function getTopStatement(path) {
            // todo:
            const st = path.getStatementParent();
          }
          const DC = template('const TAGNAME = this._getComponentView(TAGNAME_S)');
          return {
            visitor: {
              JSXElement: function JSXElement(path) {
                const node = path.node,
                  scope = path.scope;
                // todo: get top function declaration for nesting function statement
                const tagName = getJSXTagName(node.openingElement.name);
                if (!tagName || !isCustomTag(tagName) || scope.hasBinding(tagName)) {
                  return;
                }
                if (transformFunction) {
                  if (addonBindings.indexOf(tagName) > -1) {
                    return;
                  }
                  addonBindings.push(tagName);
                } else {
                  if (hasAddonBinding(scope, tagName)) {
                    return;
                  }
                  const st = path.getStatementParent();
                  // simple arrow function, body is not statement
                  if (st.parentPath.isProgram()) {
                    // todo: not go here now
                    /*
                    path.replaceWith(ast);
                    const body = path.scope.path.get('body');
                    body.replaceWith(types.blockStatement([
                      ...declares,
                      types.returnStatement(body.node)
                    ]));
                    */
                  } else {
                    // st mybe return statement
                    st.insertBefore(DC({
                      TAGNAME: types.identifier(tagName),
                      TAGNAME_S: types.stringLiteral(tagName)
                    }));
                  }
                  addBindingToScope(scope, tagName);
                }
              }
            }
          };
        }];
        if (options.plugins) {
          plugins = plugins.concat(options.plugins);
        }
        const _result = Babel.transform(decoSource, _objectSpread(_objectSpread({
          presets: presets,
          ast: true
        }, options), {}, {
          plugins: plugins
        }));
        compiled = _result.code;
        findComps(_result.ast, env.id);
        if (transformFunction) {
          const addonCodes = addonBindings.map(function (name) {
            return 'const '.concat(name, " = this._getComponentView('").concat(name, "');");
          }).join('\n');
          compiled = 'function main(){\n    '.concat(addonCodes, '\n    ').concat(compiled, '\n    return __compiledFunc__.apply(this, arguments);\n  }');
        } else {
          compiled = ''.concat(compiled, '\n');
        }
      }
    } catch (e) {
      console.error(e);
      error = e;
    }
  }
  if (compileOptions !== null && compileOptions !== void 0 && compileOptions.preferJSExpression) {
    return {
      type: 'JSExpression',
      source: source,
      value: compiled,
      extType: 'function',
      error: error
    };
  }
  return {
    type: 'js',
    source: source,
    compiled: compiled,
    error: error
  };
}
