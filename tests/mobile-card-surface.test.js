'use strict';

const { applyMobileCardSurface } = require('../lib/app/report-theme-tokens');
const { rootDeclarations } = require('../lib/core/theme-brand-scale');

const border = css => rootDeclarations(css.replace(/\/\*[\s\S]*?\*\//g, ''))['--pod-card-mobile-border'];

test.each([
  ['#fff', '#fff', true], ['white', 'rgb(255 255 255)', true],
  ['#f2f3f5', '#fff', false], ['#fff', '#f2f3f5', false],
  ['#192221', '#25312f', false], ['#fff', 'transparent', false],
  ['var(--missing)', '#fff', false],
])('mobile border follows page %s and card %s', (page, card, expected) => {
  const css = `:root { --pod-page-bg-color: ${page}; --pod-card-bg-color: ${card}; --pod-card-border: none; }`;
  const result = applyMobileCardSurface(css);
  expect(result).toContain(css);
  expect(border(result).startsWith('0.5px solid')).toBe(expected);
  expect(border(result)).toBe(expected ? '0.5px solid var(--color-line1-1, rgba(24, 28, 31, 0.08))' : 'none');
  expect(applyMobileCardSurface(result)).toBe(result);
});

test('generated defaults follow palette edits while preserving explicit overrides', () => {
  const original = ':root { --pod-page-bg-color: #fff; --pod-card-bg-color: var(--color-white, #fff); }';
  const white = applyMobileCardSurface(original);
  expect(border(white)).toContain('0.5px');
  const gray = applyMobileCardSurface(white.replace('--pod-page-bg-color: #fff', '--pod-page-bg-color: #f2f3f5'));
  expect(border(gray)).toBe('none');
  expect(border(applyMobileCardSurface(gray.replace('#f2f3f5', '#fff')))).toContain('0.5px');
  for (const custom of ['none', '0', '1px dashed red']) {
    expect(border(applyMobileCardSurface(white + `\n:root { --pod-card-mobile-border: ${custom}; }`))).toBe(custom);
  }
  expect(border(applyMobileCardSurface(original + '\n:root { --pod-card-border: 1px solid red; }')))
    .toBe('var(--pod-card-border)');
});

test('image or gradient canvases do not acquire a guessed white border', () => {
  const css = ':root { --pod-page-bg-color: #fff; --pod-card-bg-color: #fff; --pod-page-bg-image: linear-gradient(#fff, #f2f3f5); }';
  expect(border(applyMobileCardSurface(css))).toBe('none');
});
