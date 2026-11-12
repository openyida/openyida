'use strict';

const { mobileBrandAliases, defaultColorGroup } = require('./mobile-brand-tokens');

// Match the native report token contract in yc-common. Keep table overrides local to report cards.
const reportDefaults = {
  '--pod-card-padding': '20px',
  '--pod-element-card-gap': '12px',
  '--pod-chart-colors': 'var(--color-brand1-6, #0089ff), #ff9200, #11ab4f, #ffd100, #7263ee, #67c5eb, #6b748c, #ff755a, #007e99, #ffa8a8',
  '--pod-chart-sequential-colors': 'var(--color-fill1-2, #f1f2f3), var(--color-brand1-3, #66b8ff), var(--color-brand1-6, #0089ff), var(--color-brand1-9, #006dcc)',
  '--pod-chart-font-size': 'var(--font-size-caption, 12px)',
  '--pod-chart-label-color': 'var(--pod-common-level1-base-color, #181c1f)',
  '--pod-chart-axis-label-color': 'var(--pod-common-level3-base-color, rgba(24, 28, 31, 0.4))',
  '--pod-chart-axis-line-color': 'var(--color-line1-2, #c4c6cf)',
  '--pod-chart-grid-line-color': 'var(--color-line1-1, rgba(126, 134, 142, 0.16))',
  '--pod-chart-line-width': 'var(--line-2, 2px)',
  '--pod-chart-point-size': 'var(--s-1, 4px)',
  '--pod-chart-bar-width': 'auto',
  '--pod-chart-bar-max-width': 'var(--s-12, 48px)',
  '--pod-chart-bar-min-width': 'var(--s-0, 0px)',
  '--pod-chart-bar-border-radius': 'var(--corner-1, 4px)',
  '--pod-chart-bar-background-color': 'transparent',
  '--pod-chart-pie-radius': '75%',
  '--pod-chart-pie-inner-radius': '65%',
  '--pod-chart-calendar-cell-size': '10px',
  '--pod-chart-gauge-width': 'var(--s-4, 16px)',
  '--pod-chart-gauge-radius': '95%',
  '--pod-chart-gauge-inner-radius': '90%',
  '--pod-chart-gauge-track-color': 'var(--color-fill1-3, #cbcbcb)',
  '--pod-indicator-value-font-size': 'var(--font-size-title, 20px)',
  '--pod-indicator-value-font-weight': 'var(--yida-md-font-weight, 500)',
  '--pod-chart-wordcloud-min-font-size': 'var(--pod-chart-font-size, 12px)',
  '--pod-chart-wordcloud-max-font-size': '60px',
};

// Defaults consumed by the native portal's theme-bound page and card settings.
const portalDefaults = {
  '--pod-page-bg-image': 'none',
  '--pod-page-bg-color': 'var(--color-fill1-1, #f7f8fa)',
  '--pod-page-content-max-width': '1180px',
  '--pod-page-padding': '20px',
  '--pod-page-mobile-margin': '12px',
  '--pod-card-spacing': '12px',
  '--pod-card-mobile-padding': '12px',
  '--pod-card-bg-color': 'var(--color-white, #fff)',
  '--pod-card-border-radius': '20px',
  '--pod-page-inner-group-spacing': '12px',
  '--pod-lg-gap-pad-margin': '16px',
};

const tableDefaults = {
  '--pod-table-border-radius': '6px',
  '--table-th-bg': 'var(--color-brand1-1, #f6f7f9)',
  '--table-th-color': 'var(--color-text1-4, #171a1d)',
  '--table-th-font-weight': '600',
  '--table-th-font-size': 'var(--font-size-body-2, 14px)',
  '--table-body-font-size': 'var(--font-size-body-2, 14px)',
  '--table-row-bg': 'var(--table-cell-bg, var(--color-white, #fff))',
  '--table-row-color': 'var(--color-text1-4, #171a1d)',
  '--table-row-hover-bg': 'var(--color-fill1-2, #f6f7f9)',
  '--table-row-selected-bg': 'var(--color-brand1-2, #eef7ff)',
  '--table-cell-border': 'var(--color-line1-1, #e5e6e8)',
  '--table-cell-padding-top': 'var(--s-3, 12px)',
  '--table-cell-padding-left': 'var(--s-4, 16px)',
  '--table-size-s-cell-padding-top': 'var(--s-2, 8px)',
  '--table-size-s-cell-padding-left': 'var(--s-2, 8px)',
};

function applyReportThemeTokens(css) {
  const authored = new Set([...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(?:^|[;{])\s*(--[\w-]+)\s*:/g)]
    .map(match => match[1]));
  const mobileDefaults = Object.fromEntries(Object.entries(mobileBrandAliases)
    .map(([alias, source]) => [alias, `var(${source})`]));
  const scopes = [
    [':root', { ...mobileDefaults, '--color-group': defaultColorGroup, ...reportDefaults, ...portalDefaults }],
    ['.report-theme-card', tableDefaults],
  ];
  const blocks = scopes.flatMap(([selector, defaults]) => {
    const declarations = Object.entries(defaults).filter(([name]) => !authored.has(name))
      .map(([name, value]) => `  ${name}: ${value};`);
    return declarations.length ? [`${selector} {\n${declarations.join('\n')}\n}`] : [];
  });
  return blocks.length ? `${css.trimEnd()}\n\n${blocks.join('\n\n')}\n` : css;
}

module.exports = { applyReportThemeTokens };
