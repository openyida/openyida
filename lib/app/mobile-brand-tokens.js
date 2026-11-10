'use strict';

const mobileBrandAliases = {
  '--color-brand-1': '--color-brand1-10',
  '--color-brand-2': '--color-brand1-1',
  '--color-brand-3': '--color-brand1-6',
  '--color-brand-4': '--color-brand1-9',
};

// Use distinct series colors when the design has no authored categorical palette.
const defaultColorGroup = 'var(--color-brand-3), #3471ea, #a55bf5, #da66c3, #fc7d29, #ffbc20';

module.exports = { mobileBrandAliases, defaultColorGroup };
