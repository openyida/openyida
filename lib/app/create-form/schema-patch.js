'use strict';

function decodeJsonPointerSegment(segment) {
  return String(segment).replace(/~1/g, '/').replace(/~0/g, '~');
}

function splitJsonPointer(pointer) {
  if (pointer === '') {
    return [];
  }
  if (!String(pointer).startsWith('/')) {
    throw new Error('JSON Pointer 必须以 / 开头: ' + pointer);
  }
  return String(pointer).split('/').slice(1).map(decodeJsonPointerSegment);
}

function deepMerge(target, source) {
  Object.keys(source || {}).forEach(function (key) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return;
    }
    const value = source[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
        target[key] = {};
      }
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  });
  return target;
}

module.exports = {
  decodeJsonPointerSegment,
  deepMerge,
  splitJsonPointer,
};
