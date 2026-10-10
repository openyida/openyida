'use strict';

const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');

function invalid(field, issue, details = {}) {
  throw new CliError(t('design_document.invalid', field, issue), {
    code: 'DESIGN_DOCUMENT_INVALID', details: { field, issue, ...details },
  });
}

function color(value, tokens = {}, seen = new Set()) {
  if (typeof value !== 'string') {return null;}
  const text = value.trim().toLowerCase();
  const variable = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/.exec(value.trim());
  if (variable) {
    if (seen.has(variable[1]) || seen.size > 32) {return null;}
    return color(tokens[variable[1]] ?? variable[2], tokens, new Set([...seen, variable[1]]));
  }
  if (text === 'white') {return [255, 255, 255, 1];}
  if (text === 'black') {return [0, 0, 0, 1];}
  if (text === 'transparent') {return [0, 0, 0, 0];}
  if (/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/.test(text)) {
    let hex = text.slice(1);
    if (hex.length < 5) {hex = [...hex].map(c => c + c).join('');}
    return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)).concat(hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1);
  }
  const rgb = /^rgba?\(([^()]+)\)$/.exec(text);
  if (!rgb) {return null;}
  let components;
  if (rgb[1].includes(',')) {
    components = rgb[1].split(',').map(part => part.trim());
  } else {
    const parts = rgb[1].trim().split('/');
    if (parts.length > 2) {return null;}
    components = parts[0].trim().split(/\s+/);
    if (components.length !== 3) {return null;}
    if (parts.length === 2) {components.push(parts[1].trim());}
  }
  if (![3, 4].includes(components.length) || components.some(c => !/^(?:\d*\.)?\d+%?$/.test(c))) {return null;}
  const values = components.map((c, i) => parseFloat(c) * (c.endsWith('%') ? (i < 3 ? 255 / 100 : 1 / 100) : 1));
  if (values.some((v, i) => v < 0 || v > (i < 3 ? 255 : 1))) {return null;}
  return values.length === 3 ? [...values, 1] : values;
}

function composite(front, back) {
  return front.slice(0, 3).map((value, i) => value * front[3] + back[i] * (1 - front[3])).concat(1);
}

function contrast(foreground, background) {
  const luminance = rgb => rgb.slice(0, 3).reduce((sum, value, index) => {
    const channel = value / 255;
    return sum + [0.2126, 0.7152, 0.0722][index] * (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  }, 0);
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function validateIconContrast(iconSystem, tokens) {
  const pairs = iconSystem?.colorPairs;
  if (pairs === undefined) {return [];}
  if (!Array.isArray(pairs)) {invalid('iconSystem.colorPairs', 'ARRAY_REQUIRED');}
  const names = new Set();
  return pairs.map((pair, index) => {
    const field = `iconSystem.colorPairs[${index}]`;
    if (!pair || typeof pair !== 'object' || Array.isArray(pair) || typeof pair.name !== 'string' || !pair.name.trim()
      || names.has(pair.name) || Object.keys(pair).some(key => !['name', 'foreground', 'background', 'surface'].includes(key))) {
      invalid(field, 'ICON_COLOR_PAIR_INVALID');
    }
    names.add(pair.name);
    const foreground = color(pair.foreground, tokens);
    let background = color(pair.background, tokens);
    if (!foreground || !background) {invalid(field, 'ICON_COLOR_UNRESOLVED', { name: pair.name });}
    if (pair.surface !== undefined || background[3] < 1) {
      const surface = color(pair.surface, tokens);
      if (!surface || surface[3] !== 1) {invalid(field, 'ICON_OPAQUE_SURFACE_REQUIRED', { name: pair.name });}
      background = composite(background, surface);
    }
    const ratio = contrast(composite(foreground, background), background);
    if (ratio < 3) {invalid(field, 'ICON_CONTRAST_LOW', { name: pair.name, ratio, minimum: 3 });}
    return { name: pair.name, ratio: Math.round(ratio * 100) / 100, minimum: 3 };
  });
}

module.exports = { color, composite, contrast, validateIconContrast };
