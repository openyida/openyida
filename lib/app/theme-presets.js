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

const APP_THEME_TOKEN_PRESETS = Object.freeze({
  blue: Object.freeze({
    '--color-brand1-1': 'rgb(51, 160, 255)',
    '--color-brand1-2': 'rgb(242, 249, 255)',
    '--color-brand1-3': 'rgba(0, 137, 255, 0.2)',
    '--color-brand1-6': 'rgb(0, 137, 255)',
    '--color-brand1-9': 'rgb(0, 109, 204)',
    '--color-brand1-10': 'rgba(0, 137, 255, 0.3)',
    '--color-brand-1': 'rgb(178, 219, 255)',
    '--color-brand-2': 'rgb(51, 160, 255)',
    '--color-brand-3': 'rgb(0, 137, 255)',
    '--color-brand-4': 'rgb(0, 109, 204)',
  }),
  green: Object.freeze({
    '--color-brand1-1': 'rgb(60, 190, 113)',
    '--color-brand1-2': 'rgb(246, 252, 248)',
    '--color-brand1-3': 'rgba(64, 179, 112, 0.2)',
    '--color-brand1-6': 'rgb(64, 179, 112)',
    '--color-brand1-9': 'rgb(62, 170, 107)',
    '--color-brand1-10': 'rgba(64, 179, 112, 0.3)',
    '--color-brand-1': 'rgb(197, 232, 212)',
    '--color-brand-2': 'rgb(60, 190, 113)',
    '--color-brand-3': 'rgb(64, 179, 112)',
    '--color-brand-4': 'rgb(62, 170, 107)',
  }),
  orange: Object.freeze({
    '--color-brand1-1': 'rgb(255, 125, 26)',
    '--color-brand1-2': 'rgb(255, 248, 242)',
    '--color-brand1-3': 'rgba(255, 111, 0, 0.2)',
    '--color-brand1-6': 'rgb(255, 111, 0)',
    '--color-brand1-9': 'rgb(242, 105, 0)',
    '--color-brand1-10': 'rgba(255, 111, 0, 0.3)',
    '--color-brand-1': 'rgb(255, 211, 178)',
    '--color-brand-2': 'rgb(255, 125, 26)',
    '--color-brand-3': 'rgb(255, 111, 0)',
    '--color-brand-4': 'rgb(242, 105, 0)',
  }),
  podBlue: Object.freeze({
    '--color-brand1-1': 'rgb(51, 160, 255)',
    '--color-brand1-2': 'rgb(242, 249, 255)',
    '--color-brand1-3': 'rgba(0, 137, 255, 0.2)',
    '--color-brand1-6': 'rgb(0, 137, 255)',
    '--color-brand1-9': 'rgb(0, 109, 204)',
    '--color-brand1-10': 'rgba(0, 137, 255, 0.3)',
    '--color-brand-1': 'rgb(178, 219, 255)',
    '--color-brand-2': 'rgb(51, 160, 255)',
    '--color-brand-3': 'rgb(0, 137, 255)',
    '--color-brand-4': 'rgb(0, 109, 204)',
  }),
  podGreen: Object.freeze({
    '--color-brand1-1': 'rgb(60, 190, 113)',
    '--color-brand1-2': 'rgb(246, 252, 248)',
    '--color-brand1-3': 'rgba(64, 179, 112, 0.2)',
    '--color-brand1-6': 'rgb(64, 179, 112)',
    '--color-brand1-9': 'rgb(62, 170, 107)',
    '--color-brand1-10': 'rgba(64, 179, 112, 0.3)',
    '--color-brand-1': 'rgb(197, 232, 212)',
    '--color-brand-2': 'rgb(60, 190, 113)',
    '--color-brand-3': 'rgb(64, 179, 112)',
    '--color-brand-4': 'rgb(62, 170, 107)',
  }),
  podOrange: Object.freeze({
    '--color-brand1-1': 'rgb(255, 125, 26)',
    '--color-brand1-2': 'rgb(255, 248, 242)',
    '--color-brand1-3': 'rgba(255, 111, 0, 0.2)',
    '--color-brand1-6': 'rgb(255, 111, 0)',
    '--color-brand1-9': 'rgb(242, 105, 0)',
    '--color-brand1-10': 'rgba(255, 111, 0, 0.3)',
    '--color-brand-1': 'rgb(255, 211, 178)',
    '--color-brand-2': 'rgb(255, 125, 26)',
    '--color-brand-3': 'rgb(255, 111, 0)',
    '--color-brand-4': 'rgb(242, 105, 0)',
  }),
});

const APP_THEME_TOKEN_PRESET_KEYS = Object.freeze(Object.keys(APP_THEME_TOKEN_PRESETS));

function isPresetThemeKey(themeKey) {
  return SUPPORTED_THEME_KEYS.includes(themeKey);
}

function isAppThemeTokenPreset(presetKey) {
  return APP_THEME_TOKEN_PRESET_KEYS.includes(presetKey);
}

function formatPresetThemeKeys() {
  return SUPPORTED_THEME_KEYS.join(', ');
}

function formatAppThemeTokenPresetKeys() {
  return APP_THEME_TOKEN_PRESET_KEYS.join(', ');
}

function getAppThemeTokenPreset(presetKey) {
  return APP_THEME_TOKEN_PRESETS[presetKey] || null;
}

function assertPresetThemeKey(themeKey) {
  if (!themeKey || isPresetThemeKey(themeKey)) {
    return;
  }
  throw new Error(
    `Unsupported theme: ${themeKey}. Use one of: ${formatPresetThemeKeys()}. ` +
    'For custom colors or application theme token profiles that are not platform --theme keys, ' +
    'upload an application theme CSS file with update-app --theme-file and pass --theme-color instead.'
  );
}

module.exports = {
  SUPPORTED_THEME_KEYS,
  APP_THEME_TOKEN_PRESETS,
  APP_THEME_TOKEN_PRESET_KEYS,
  isPresetThemeKey,
  isAppThemeTokenPreset,
  formatPresetThemeKeys,
  formatAppThemeTokenPresetKeys,
  getAppThemeTokenPreset,
  assertPresetThemeKey,
};
