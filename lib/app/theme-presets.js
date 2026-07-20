'use strict';

const SUPPORTED_THEME_KEYS = [
  'deepBlue',
  'podBlue',
  'royalBlue',
  'lightBlue',
  'teal',
  'podGreen',
  'deepPurple',
  'purple',
  'podOrange',
  'yellow',
  'magenta',
  'red',
  'greyBlue',
  'coffee',
  'black',
];

function isPresetThemeKey(themeKey) {
  return SUPPORTED_THEME_KEYS.includes(themeKey);
}

function formatPresetThemeKeys() {
  return SUPPORTED_THEME_KEYS.join(', ');
}

function assertPresetThemeKey(themeKey) {
  if (!themeKey || isPresetThemeKey(themeKey)) {
    return;
  }
  throw new Error(
    `Unsupported theme: ${themeKey}. Use one of: ${formatPresetThemeKeys()}. ` +
    'For custom colors, inject style#yida-global-theme tokens in each custom page instead of passing a custom --theme value.'
  );
}

module.exports = {
  SUPPORTED_THEME_KEYS,
  isPresetThemeKey,
  formatPresetThemeKeys,
  assertPresetThemeKey,
};
