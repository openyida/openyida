'use strict';

const { topLevelRules } = require('./theme-scope');

const mobileBrandAliases = {
  '--color-brand-1': '--color-brand1-10',
  '--color-brand-2': '--color-brand1-1',
  '--color-brand-3': '--color-brand1-6',
  '--color-brand-4': '--color-brand1-9',
};

// Use distinct series colors when the design has no authored categorical palette.
const defaultColorGroup = 'var(--color-brand-3), #3471ea, #a55bf5, #da66c3, #fc7d29, #ffbc20';

// Bridge primary colors, preserving local palettes.
function bridgePrimaryBrand(css) {
  let result = css;
  for (const rule of topLevelRules(css).reverse()) {
    if (!rule.selector.split(',').some(selector => selector.trim() === ':root')) {continue;}
    const block = css.slice(rule.start, rule.end).replace(/(--color-brand-3\s*:\s*)([^;{}]+)/g,
      (_, prefix, value) => `${prefix}var(--color-brand1-6)${/!important\s*$/i.test(value) ? ' !important' : ''}`);
    result = result.slice(0, rule.start) + block + result.slice(rule.end);
  }
  return result;
}

module.exports = { mobileBrandAliases, defaultColorGroup, bridgePrimaryBrand };
