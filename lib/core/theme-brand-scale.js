'use strict';

// The platform intentionally has no brand1-4/7/8 slots.
const REQUIRED_BRAND_SCALE_TOKENS = Object.freeze([1, 2, 3, 5, 6, 9, 10].map(n => `--color-brand1-${n}`));

const REQUIRED_APPLICATION_BRAND_TOKENS = Object.freeze([
  ...REQUIRED_BRAND_SCALE_TOKENS,
  ...[1, 2, 3, 4].map(n => `--color-brand-${n}`),
]);

// Only unconditional, top-level :root rules establish an application-wide
// contract. Ignore quoted delimiters and nested conditional/local rules.
function rootDeclarations(source) {
  const declarations = new Map();
  let depth = 0;
  let quote = '';
  let start = 0;
  let bodyStart = 0;
  let root = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '\\') {i++; continue;}
    if (quote) {if (char === quote) {quote = '';} continue;}
    if (char === '"' || char === "'") {quote = char; continue;}
    if (char === ';' && !depth) {start = i + 1;}
    if (char === '{') {
      if (!depth) {
        root = source.slice(start, i).split(',').some(selector => selector.trim() === ':root');
        bodyStart = i + 1;
      }
      depth++;
    } else if (char === '}') {
      depth--;
      if (!depth) {
        if (root) {
          // Generated root blocks contain declarations, not nested style rules.
          for (const text of splitValue(source.slice(bodyStart, i), ';')) {
            const match = /^\s*(--[\w-]+)\s*:\s*([^{}]*)$/.exec(text);
            if (!match) {continue;}
            const important = /!important\s*$/i.test(match[2]);
            const value = match[2].replace(/!important\s*$/i, '').trim();
            if (!declarations.get(match[1])?.important || important) {
              declarations.set(match[1], { value, important });
            }
          }
        }
        start = i + 1;
      }
    }
  }
  return Object.fromEntries([...declarations].map(([name, { value }]) => [name, value]));
}

function splitValue(value, delimiter = ',') {
  const parts = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === '\\') {i++; continue;}
    if (quote) {if (char === quote) {quote = '';} continue;}
    if (char === '"' || char === "'") {quote = char; continue;}
    if ('({'.includes(char)) {depth++;}
    if (')}'.includes(char)) {depth--;}
    if (char === delimiter && !depth) {parts.push(value.slice(start, i).trim()); start = i + 1;}
  }
  parts.push(value.slice(start).trim());
  return parts;
}

// Brand tokens have a deliberately portable color contract. The primary slot
// also passes extractThemeColor before upload because the API persists it.
function isColor(value, normalizeColor) {
  if (/^#(?:[\da-f]{4}|[\da-f]{8})$/i.test(value) || /^(?:white|black|transparent)$/i.test(value)) {return true;}
  try {if (normalizeColor(value)) {return true;}} catch (_) { /* Try a color expression below. */ }
  const mix = /^color-mix\((.*)\)$/is.exec(value);
  if (!mix) {return false;}
  const parts = splitValue(mix[1]);
  if (parts.length !== 3 || !/^in (?:srgb|srgb-linear|lab|oklab|xyz|xyz-d50|xyz-d65)$/i.test(parts[0])) {return false;}
  const percentages = [];
  for (const part of parts.slice(1)) {
    const stop = /^(.*?)(?:\s+([\d.]+)%)?$/.exec(part);
    if (!isColor(stop[1], normalizeColor)) {return false;}
    const percent = stop[2] === undefined ? null : Number(stop[2]);
    if (percent !== null && (!Number.isFinite(percent) || percent < 0 || percent > 100)) {return false;}
    percentages.push(percent);
  }
  return percentages.some(value => value === null || value > 0);
}

function invalidBrandValues(tokens, normalizeColor) {
  const issues = [];
  function fail(reason, reference) {throw Object.assign(new Error(reason), { reason, reference });}
  function checkCycles(name, active = new Set(), visited = new Set()) {
    if (!(name in tokens) || visited.has(name)) {return;}
    if (active.has(name)) {fail('TOKEN_REFERENCE_CYCLE', name);}
    if (active.size > 64) {fail('TOKEN_REFERENCE_DEPTH', name);}
    const next = new Set([...active, name]);
    for (const [, ref] of tokens[name].matchAll(/var\(\s*(--[\w-]+)/g)) {checkCycles(ref, next, visited);}
    visited.add(name);
  }
  function resolve(value, depth = 0) {
    if (depth > 64) {fail('TOKEN_REFERENCE_DEPTH');}
    const start = value.search(/var\(/);
    if (start < 0) {return value;}
    let level = 1;
    let end = start + 4;
    while (end < value.length && level) {
      if (value[end] === '(') {level++;}
      if (value[end] === ')') {level--;}
      end++;
    }
    if (level) {fail('INVALID_COLOR');}
    const [reference, ...fallback] = splitValue(value.slice(start + 4, end - 1));
    let replacement = tokens[reference];
    if (replacement === undefined) {
      if (!fallback.length) {fail('UNDECLARED_TOKEN_REFERENCE', reference);}
      replacement = fallback.join(',');
    }
    return resolve(value.slice(0, start) + resolve(replacement, depth + 1) + value.slice(end), depth + 1);
  }
  for (const token of REQUIRED_APPLICATION_BRAND_TOKENS) {
    if (!(token in tokens)) {continue;}
    try {
      checkCycles(token);
      if (!isColor(resolve(tokens[token]), normalizeColor)) {fail('INVALID_COLOR');}
    } catch (issue) {issues.push({ token, value: tokens[token], ...issue });}
  }
  return issues;
}

module.exports = { REQUIRED_BRAND_SCALE_TOKENS, REQUIRED_APPLICATION_BRAND_TOKENS, rootDeclarations, invalidBrandValues };
