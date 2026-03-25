'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.default = void 0;
function _typeof(obj) { '@babel/helpers - typeof'; return _typeof = 'function' === typeof Symbol && 'symbol' === typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && 'function' === typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? 'symbol' : typeof obj; }, _typeof(obj); }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }
function _defineProperties(target, props) { for (let i = 0; i < props.length; i++) { const descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) {descriptor.writable = true;} Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) {_defineProperties(Constructor.prototype, protoProps);} if (staticProps) {_defineProperties(Constructor, staticProps);} Object.defineProperty(Constructor, 'prototype', { writable: false }); return Constructor; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(arg) { const key = _toPrimitive(arg, 'string'); return _typeof(key) === 'symbol' ? key : String(key); }
function _toPrimitive(input, hint) { if (_typeof(input) !== 'object' || input === null) {return input;} const prim = input[Symbol.toPrimitive]; if (prim !== undefined) { const res = prim.call(input, hint || 'default'); if (_typeof(res) !== 'object') {return res;} throw new TypeError('@@toPrimitive must return a primitive value.'); } return (hint === 'string' ? String : Number)(input); }
const JSXUtil = /*#__PURE__*/function () {
  function JSXUtil() {
    _classCallCheck(this, JSXUtil);
    _defineProperty(this, 'tags', {});
  }
  _createClass(JSXUtil, [{
    key: 'setComps',
    value: function setComps(id, tags) {
      if (!Array.isArray(tags)) {
        return;
      }

      // 去重
      const s = new Set(tags);
      tags = Array.from(s);
      if (!id) {
        id = 'normal';
      }

      // 初始化
      if (!Array.isArray(this.tags[id])) {
        this.tags[id] = [];
      }

      // 收集未传id的情况下的组件，保证组件只多不少
      if (id === 'normal') {
        // 去重
        const arr = this.tags[id];
        tags.forEach(function (i) {
          return !arr.includes(i) && arr.push(i);
        });
      } else {
        // 具体属性更改后重新覆盖
        this.tags[id] = tags;
      }
    }

    /**
     * 返回自定义渲染的组件列表
     */
  }, {
    key: 'getComponentList',
    value: function getComponentList() {
      const _this = this;
      const s = new Set();
      Object.keys(this.tags).forEach(function (id) {
        const comps = _this.tags[id] || [];
        if (Array.isArray(comps)) {
          comps.forEach(function (c) {
            return s.add(c);
          });
        }
      });
      return Array.from(s);
    }
  }, {
    key: 'reset',
    value: function reset() {
      this.tags = {};
    }
  }]);
  return JSXUtil;
}();
let __vu_jsx_util__;
if ((typeof window === 'undefined' ? 'undefined' : _typeof(window)) === 'object') {
  let _window;
  window.__vu_jsx_util__ = ((_window = window) === null || _window === void 0 ? void 0 : _window.__vu_jsx_util__) || new JSXUtil();
  __vu_jsx_util__ = window.__vu_jsx_util__;
} else {
  let _global;
  global.__vu_jsx_util__ = ((_global = global) === null || _global === void 0 ? void 0 : _global.__vu_jsx_util__) || new JSXUtil();
  __vu_jsx_util__ = global.__vu_jsx_util__;
}
const _default = __vu_jsx_util__;
exports.default = _default;
module.exports = exports.default;
