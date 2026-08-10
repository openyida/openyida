'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_THEME_TOKENS = Object.freeze({
  '--color-brand1-6': '#2563eb',
  '--color-brand1-1': '#eff6ff',
  '--openyida-surface': '#ffffff',
  '--openyida-bg': '#f6f8fb',
  '--openyida-border': '#d8e0ea',
  '--openyida-text': '#172033',
  '--openyida-muted': '#667085',
});

const DEFAULT_LAYOUT = Object.freeze({
  pagePadding: 24,
  panelPadding: 24,
  sectionGap: 16,
  panelRadius: 22,
  controlRadius: 12,
});

const DEFAULT_FORM = Object.freeze({
  theme: 'comfortable',
  labelAlign: 'top',
  formDetailPreset: 'clean-card',
});

const NUMBER_LIMITS = Object.freeze({
  pagePadding: [0, 64],
  panelPadding: [0, 64],
  sectionGap: [0, 40],
  panelRadius: [0, 32],
  controlRadius: [0, 32],
});

function createConfigError(message, details) {
  const error = new Error(message);
  error.code = 'DESIGN_RUNTIME_CONFIG_INVALID';
  error.details = details || null;
  return error;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeNumber(value, key) {
  if (value === undefined) return DEFAULT_LAYOUT[key];
  const number = Number(value);
  const limits = NUMBER_LIMITS[key];
  if (!Number.isFinite(number) || number < limits[0] || number > limits[1]) {
    throw createConfigError(`design-runtime.layout.${key} 必须是 ${limits[0]}-${limits[1]} 的数字`);
  }
  return number;
}

function normalizeDesignRuntime(input) {
  if (!isPlainObject(input)) {
    throw createConfigError('design-runtime 必须是 JSON 对象');
  }
  if (input.version !== 1) {
    throw createConfigError('design-runtime.version 必须是 1');
  }
  if (typeof input.designFile !== 'string' || !input.designFile.trim()) {
    throw createConfigError('design-runtime.designFile 不能为空');
  }
  if (input.tokens !== undefined && !isPlainObject(input.tokens)) {
    throw createConfigError('design-runtime.tokens 必须是 JSON 对象');
  }

  const tokens = { ...DEFAULT_THEME_TOKENS };
  for (const [key, value] of Object.entries(input.tokens || {})) {
    if (!/^--[A-Za-z0-9_-]+$/.test(key)) {
      throw createConfigError(`无效的主题 token：${key}`);
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw createConfigError(`主题 token ${key} 必须是字符串或数字`);
    }
    tokens[key] = value;
  }

  const layoutInput = input.layout === undefined ? {} : input.layout;
  if (!isPlainObject(layoutInput)) {
    throw createConfigError('design-runtime.layout 必须是 JSON 对象');
  }
  const layout = Object.keys(DEFAULT_LAYOUT).reduce((result, key) => {
    result[key] = normalizeNumber(layoutInput[key], key);
    return result;
  }, {});

  const formInput = input.form === undefined ? {} : input.form;
  if (!isPlainObject(formInput)) {
    throw createConfigError('design-runtime.form 必须是 JSON 对象');
  }
  const form = {
    theme: formInput.theme || DEFAULT_FORM.theme,
    labelAlign: formInput.labelAlign || DEFAULT_FORM.labelAlign,
    formDetailPreset: formInput.formDetailPreset || DEFAULT_FORM.formDetailPreset,
  };
  if (!['default', 'compact', 'comfortable'].includes(form.theme)) {
    throw createConfigError('design-runtime.form.theme 必须是 default、compact 或 comfortable');
  }
  if (!['top', 'left', 'right'].includes(form.labelAlign)) {
    throw createConfigError('design-runtime.form.labelAlign 必须是 top、left 或 right');
  }
  if (!['clean-card', 'none'].includes(form.formDetailPreset)) {
    throw createConfigError('design-runtime.form.formDetailPreset 必须是 clean-card 或 none');
  }

  return {
    version: 1,
    designFile: input.designFile.trim(),
    designId: typeof input.designId === 'string' ? input.designId.trim() : '',
    tokens,
    layout,
    form,
  };
}

function loadDesignRuntime(configPath) {
  const absolutePath = path.resolve(configPath);
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    throw createConfigError(`无法读取 design-runtime：${absolutePath}`, { cause: error.message });
  }
  return normalizeDesignRuntime(parsed);
}

function toFormThemeTokens(tokens) {
  return {
    ...tokens,
    '--openyida-form-bg': tokens['--openyida-form-bg'] || tokens['--openyida-bg'],
    '--openyida-form-surface': tokens['--openyida-form-surface'] || tokens['--openyida-surface'],
    '--openyida-form-border': tokens['--openyida-form-border'] || tokens['--openyida-border'],
    '--openyida-form-text': tokens['--openyida-form-text'] || tokens['--openyida-text'],
  };
}

function applyToFormScaffold(sourceContent, runtime) {
  let definition;
  try {
    definition = JSON.parse(sourceContent);
  } catch (error) {
    throw createConfigError('原生表单脚手架不是有效 JSON', { cause: error.message });
  }
  definition.designSource = {
    designFile: runtime.designFile,
    designId: runtime.designId,
  };
  definition.theme = runtime.form.theme;
  definition.labelAlign = runtime.form.labelAlign;
  definition.themeTokens = toFormThemeTokens(runtime.tokens);
  definition.formDetailPreset = runtime.form.formDetailPreset;
  return `${JSON.stringify(definition, null, 2)}\n`;
}

function applyToCanvasScaffold(sourceContent, runtime) {
  const startMarker = '  // @openyida-design-defaults:start';
  const endMarker = '  // @openyida-design-defaults:end';
  const startIndex = sourceContent.indexOf(startMarker);
  const endIndex = sourceContent.indexOf(endMarker);
  if (startIndex < 0 || endIndex <= startIndex) {
    throw createConfigError('Canvas 脚手架缺少 design defaults 标记');
  }

  const payload = {
    designSource: {
      designFile: runtime.designFile,
      designId: runtime.designId,
    },
    themeTokens: runtime.tokens,
    layout: runtime.layout,
  };
  const body = JSON.stringify(payload, null, 2).split('\n').slice(1, -1).join('\n');
  const bodyStart = startIndex + startMarker.length;
  return `${sourceContent.slice(0, bodyStart)}\n${body}\n${sourceContent.slice(endIndex)}`;
}

function applyDesignRuntimeToSample(skill, name, sourceContent, runtimeInput) {
  const runtime = normalizeDesignRuntime(runtimeInput);
  if (skill === 'yida-create-form-page' && name === 'form') {
    return applyToFormScaffold(sourceContent, runtime);
  }
  if (skill === 'yida-canvas-custom-page' && name === 'canvas') {
    return applyToCanvasScaffold(sourceContent, runtime);
  }
  throw createConfigError(`sample ${skill}/${name} 不支持 --design-config`);
}

module.exports = {
  applyDesignRuntimeToSample,
  loadDesignRuntime,
  normalizeDesignRuntime,
};
