'use strict';

const { applyMobileCardSurface, applyReportThemeTokens } = require('../lib/app/report-theme-tokens');
const { rootDeclarations } = require('../lib/core/theme-brand-scale');

const tokens = css => rootDeclarations(css.replace(/\/\*[\s\S]*?\*\//g, ''));
const border = css => tokens(css)['--pod-card-mobile-border'];

test.each([
  ['#fff', '#fff'], ['white', 'rgb(255 255 255)'], ['#f2f3f5', '#fff'],
  ['#fff', '#f2f3f5'], ['#192221', '#25312f'], ['#fff', 'transparent'], ['var(--missing)', '#fff'],
])('mobile cards have no default border on page %s and card %s', (page, card) => {
  const css = `:root { --pod-page-bg-color: ${page}; --pod-card-bg-color: ${card}; --pod-card-border: none; }`;
  const result = applyMobileCardSurface(css);
  expect(result).toContain(css);
  expect(border(result)).toBe('none');
  expect(applyMobileCardSurface(result)).toBe(result);
});

test('removes obsolete automatic borders and preserves authored overrides', () => {
  const original = ':root { --pod-page-bg-color: #fff; --pod-card-bg-color: #fff; }';
  const old = original + '\n/* openyida-mobile-card-surface:start */\n:root { --pod-card-mobile-border: 0.5px solid gray; }\n/* openyida-mobile-card-surface:end */\n';
  const refreshed = applyMobileCardSurface(old);
  expect(border(refreshed)).toBe('none');
  expect(applyMobileCardSurface(refreshed)).toBe(refreshed);
  for (const custom of ['none', '0', '1px dashed red']) {
    expect(border(applyMobileCardSurface(old + `\n:root { --pod-card-mobile-border: ${custom}; }`))).toBe(custom);
  }
  expect(border(applyMobileCardSurface(original + '\n:root { --pod-card-border: 1px solid red; }')))
    .toBe('var(--pod-card-border)');
});

test('generated defaults follow platform palette and glass footer while preserving overrides', () => {
  const input = ':root { --color-group: #00A532, #FF9200; }';
  const result = applyReportThemeTokens(input);
  expect(tokens(result)['--pod-chart-colors']).toBe('var(--color-group)');
  expect(tokens(result)['--color-group']).toBe('#00A532, #FF9200');
  expect(tokens(result)['--pod-page-footer-mobile-border']).toBe('none');
  expect(tokens(result)['--pod-page-footer-bg-opacity']).toBe('90%');
  expect(tokens(result)['--pod-page-footer-backdrop-filter']).toBe('blur(16px)');
  expect(tokens(result)['--pod-drawer-border-radius']).toBe('var(--corner-5, 20px)');
  const overrides = ':root { --pod-chart-colors: red, blue; --pod-page-footer-mobile-border: 1px solid red; --pod-page-footer-bg-opacity: 70%; --pod-page-footer-backdrop-filter: none; }';
  const custom = tokens(applyReportThemeTokens(overrides));
  expect(custom['--pod-chart-colors']).toBe('red, blue');
  expect(custom['--pod-page-footer-mobile-border']).toBe('1px solid red');
  expect(custom['--pod-page-footer-bg-opacity']).toBe('70%');
  expect(custom['--pod-page-footer-backdrop-filter']).toBe('none');
});
