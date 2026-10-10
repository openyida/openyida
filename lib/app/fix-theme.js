'use strict';

const Babel = require('@babel/standalone');
const { collectFixedBrandViolations } = require('./canvas-theme-guard');

// Use parser tokens to remove separators without treating comments as syntax.
// Preserve all other source text, including CSS and the maintained drawer/provider.
function transformFixedBrandTheme(source) {
  const violations = collectFixedBrandViolations(source)
    .filter(item => Number.isInteger(item.start) && Number.isInteger(item.end) && item.end > item.start);
  if (!violations.length) { return { changed: false, output: source, violations: [] }; }
  const parse = value => Babel.packages.parser.parse(value, {
    sourceType: 'module', plugins: ['jsx', 'typescript'], tokens: true,
  });
  const tokens = parse(source).tokens.filter(token => typeof token.type !== 'string');
  const spans = violations.flatMap(({ start, end }) => {
    const next = tokens.find(token => token.start >= end);
    const previous = tokens.filter(token => token.end <= start).pop();
    const comma = next?.type.label === ',' ? next : previous?.type.label === ',' ? previous : null;
    return [{ start, end }, ...(comma ? [{ start: comma.start, end: comma.end }] : [])];
  }).sort((a, b) => a.start - b.start);
  const merged = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span.start <= last.end) { last.end = Math.max(last.end, span.end); }
    else { merged.push({ ...span }); }
  }
  let output = source;
  for (const span of merged.reverse()) { output = output.slice(0, span.start) + output.slice(span.end); }
  parse(output);
  return { changed: output !== source, output, violations: violations.map(({ field, color, line }) => ({ field, color, line })) };
}

module.exports = { transformFixedBrandTheme };
