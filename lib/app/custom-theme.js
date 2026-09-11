'use strict';

const fs = require('fs');
const path = require('path');
const { getAccessToken } = require('../auth/token-auth');

const MAX_THEME_FILE_BYTES = 20 * 1024 * 1024;
const REQUIRED_BRAND_SCALE_TOKENS = Object.freeze([
  '--color-brand1-1',
  '--color-brand1-2',
  '--color-brand1-3',
  '--color-brand1-5',
  '--color-brand1-6',
  '--color-brand1-9',
  '--color-brand1-10',
]);
const UNSAFE_THEME_PATTERNS = [
  { pattern: /<\/?script\b/i, message: '主题 CSS 不能包含 script 标签' },
  { pattern: /<\/?style\b/i, message: '主题 CSS 不能包含 style 标签' },
  { pattern: /@import\b/i, message: '主题 CSS 不能包含 @import' },
  { pattern: /expression\s*\(/i, message: '主题 CSS 不能包含 expression()' },
  { pattern: /behavior\s*:/i, message: '主题 CSS 不能包含 behavior 属性' },
  { pattern: /-moz-binding\s*:/i, message: '主题 CSS 不能包含 -moz-binding' },
  { pattern: /\b(?:javascript|data|vbscript|file|blob)\s*:/i, message: '主题 CSS 不能包含危险资源协议' },
];

const THEME_COLOR_HEX_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const THEME_COLOR_RGB_PATTERN = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?|\.\d+))?\s*\)$/i;
const THEME_COLOR_HSL_PATTERN = /^hsla?\(\s*([-+]?(?:\d+(?:\.\d+)?|\.\d+))(?:deg)?\s*,\s*([-+]?(?:\d+(?:\.\d+)?|\.\d+))%\s*,\s*([-+]?(?:\d+(?:\.\d+)?|\.\d+))%(?:\s*,\s*([-+]?(?:\d+(?:\.\d+)?|\.\d+))(%?))?\s*\)$/i;

function toHexChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
}

function opaqueHex(red, green, blue, alpha = 1) {
  const blend = (channel) => channel * alpha + 255 * (1 - alpha);
  return `#${toHexChannel(blend(red))}${toHexChannel(blend(green))}${toHexChannel(blend(blue))}`.toUpperCase();
}

/**
 * 与 yc-utils normalizeCssColorToHex 保持相同口径：透明色按白色背景合成。
 * appIcon 的 icon%%color 协议只保存不透明 HEX。
 */
function normalizeCssColorToHex(value) {
  const color = String(value || '').trim();
  const shortHexMatch = color.match(/^#([0-9a-f]{3})$/i);
  if (shortHexMatch) {
    return `#${shortHexMatch[1].split('').map((channel) => channel + channel).join('')}`.toUpperCase();
  }
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color.toUpperCase();
  }

  const rgbMatch = color.match(THEME_COLOR_RGB_PATTERN);
  if (rgbMatch && rgbMatch.slice(1, 4).every((channel) => Number(channel) <= 255)) {
    const alpha = rgbMatch[4] === undefined ? 1 : Number(rgbMatch[4]);
    return opaqueHex(Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3]), alpha);
  }

  const hslMatch = color.match(THEME_COLOR_HSL_PATTERN);
  if (!hslMatch) {return '';}
  const saturation = Number(hslMatch[2]);
  const lightness = Number(hslMatch[3]);
  const alpha = hslMatch[4] === undefined
    ? 1
    : Number(hslMatch[4]) / (hslMatch[5] === '%' ? 100 : 1);
  if (saturation < 0 || saturation > 100 || lightness < 0 || lightness > 100 || alpha < 0 || alpha > 1) {
    return '';
  }

  const hue = ((Number(hslMatch[1]) % 360) + 360) % 360;
  const normalizedSaturation = saturation / 100;
  const normalizedLightness = lightness / 100;
  const chroma = (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation;
  const hueSection = hue / 60;
  const secondLargest = chroma * (1 - Math.abs((hueSection % 2) - 1));
  const matchValue = normalizedLightness - chroma / 2;
  let red = 0;
  let green = 0;
  let blue = 0;
  if (hueSection < 1) {
    red = chroma;
    green = secondLargest;
  } else if (hueSection < 2) {
    red = secondLargest;
    green = chroma;
  } else if (hueSection < 3) {
    green = chroma;
    blue = secondLargest;
  } else if (hueSection < 4) {
    green = secondLargest;
    blue = chroma;
  } else if (hueSection < 5) {
    red = secondLargest;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondLargest;
  }
  return opaqueHex(
    (red + matchValue) * 255,
    (green + matchValue) * 255,
    (blue + matchValue) * 255,
    alpha
  );
}

function normalizeThemeColor(value) {
  if (!value) {return null;}
  const color = String(value).trim();
  if (THEME_COLOR_HEX_PATTERN.test(color)) {
    return color.toUpperCase();
  }

  const rgbMatch = color.match(THEME_COLOR_RGB_PATTERN);
  if (rgbMatch && rgbMatch.slice(1, 4).every((channel) => Number(channel) <= 255)) {
    return color;
  }

  const hslMatch = color.match(THEME_COLOR_HSL_PATTERN);
  if (hslMatch) {
    const saturation = Number(hslMatch[2]);
    const lightness = Number(hslMatch[3]);
    const alpha = hslMatch[4] === undefined
      ? 1
      : Number(hslMatch[4]) / (hslMatch[5] === '%' ? 100 : 1);
    if (saturation >= 0 && saturation <= 100 && lightness >= 0 && lightness <= 100 && alpha >= 0 && alpha <= 1) {
      return color;
    }
  }

  throw new Error(`Unsupported theme color: ${value}. Use #RGB, #RRGGBB, rgb(a), or hsl(a).`);
}

function extractThemeColor(cssText) {
  const source = String(cssText || '').replace(/\/\*[\s\S]*?\*\//g, '');
  const match = source.match(/(?:^|[;{])\s*--color-brand1-6\s*:\s*([^;}\n]+)/i);
  if (!match) {
    throw new Error('自定义主题文件必须声明 --color-brand1-6，CLI 会用它保存应用 themeColor');
  }
  try {
    return normalizeThemeColor(match[1]);
  } catch (error) {
    throw new Error(`--color-brand1-6 必须是可直接保存的颜色值: ${error.message}`);
  }
}

function validateThemeCssContent(cssText) {
  const source = String(cssText || '');
  const sourceWithoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const rule of UNSAFE_THEME_PATTERNS) {
    if (rule.pattern.test(sourceWithoutComments)) {
      throw new Error(rule.message);
    }
  }

  const urlPattern = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
  let match = urlPattern.exec(sourceWithoutComments);
  while (match) {
    const value = String(match[2] || '').trim();
    const allowed = /^https:\/\//i.test(value) ||
      (value.startsWith('/') && !value.startsWith('//')) ||
      /^asset\s*\(/i.test(value) ||
      /^var\s*\(/i.test(value);
    if (!allowed) {
      throw new Error(`主题 CSS 包含不安全的 url(): ${value || '(empty)'}`);
    }
    match = urlPattern.exec(sourceWithoutComments);
  }

  const declaredTokens = new Set();
  const declarationPattern = /(?:^|[;{])\s*(--color-brand1-(?:10|[1-9]))\s*:\s*([^;}\n]+)/gi;
  let declaration = declarationPattern.exec(sourceWithoutComments);
  while (declaration) {
    if (declaration[2].trim()) {
      declaredTokens.add(declaration[1].toLowerCase());
    }
    declaration = declarationPattern.exec(sourceWithoutComments);
  }
  const missingTokens = REQUIRED_BRAND_SCALE_TOKENS.filter((token) => !declaredTokens.has(token));
  if (missingTokens.length > 0) {
    throw new Error(
      `自定义主题文件必须完整声明平台品牌色阶 ${REQUIRED_BRAND_SCALE_TOKENS.join('、')}，缺少: ${missingTokens.join(', ')}`
    );
  }
}

function readThemeCssFile(filePath) {
  const resolvedPath = path.resolve(String(filePath || ''));
  if (path.extname(resolvedPath).toLowerCase() !== '.css') {
    throw new Error('自定义主题文件必须是 .css 文件');
  }
  if (/[<>"'`]/.test(path.basename(resolvedPath))) {
    throw new Error('自定义主题文件名包含不安全字符');
  }
  const stat = fs.statSync(resolvedPath);
  if (!stat.isFile()) {
    throw new Error(`自定义主题文件不存在: ${resolvedPath}`);
  }
  if (stat.size <= 0 || stat.size > MAX_THEME_FILE_BYTES) {
    throw new Error('自定义主题文件大小必须在 1 字节到 20 MB 之间');
  }
  const content = fs.readFileSync(resolvedPath);
  const cssText = content.toString('utf8');
  validateThemeCssContent(cssText);
  return {
    path: resolvedPath,
    name: path.basename(resolvedPath),
    size: stat.size,
    content,
    themeColor: extractThemeColor(cssText),
  };
}

function unwrapUploadResponse(response) {
  let current = response;
  for (let depth = 0; depth < 4; depth++) {
    if (!current || typeof current !== 'object') {
      break;
    }
    if (current.success === false) {
      throw new Error(current.errorMsg || current.message || '自定义主题文件上传失败');
    }
    if (current.content && typeof current.content === 'object') {
      if (current.content.url || current.content.downloadUrl) {
        return current.content;
      }
      current = current.content;
      continue;
    }
    break;
  }
  if (current && typeof current === 'object' && (current.url || current.downloadUrl)) {
    return current;
  }
  throw new Error('自定义主题文件上传结果缺少 CSS 地址');
}

function buildCustomThemeStyle(uploadResult) {
  const upload = unwrapUploadResponse(uploadResult);
  return JSON.stringify({
    enabled: true,
    iframePropagation: false,
    cssUrl: upload.downloadUrl || upload.url,
    cssFileName: upload.name || '',
  });
}

async function uploadCustomThemeFile(appType, filePath, authRef, options = {}) {
  const file = readThemeCssFile(filePath);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const FormDataImpl = options.FormDataImpl || globalThis.FormData;
  const BlobImpl = options.BlobImpl || globalThis.Blob;
  if (typeof fetchImpl !== 'function' || typeof FormDataImpl !== 'function' || typeof BlobImpl !== 'function') {
    throw new Error('当前 Node.js 环境缺少 fetch/FormData/Blob，请使用 Node.js 18+');
  }

  const accessToken = await getAccessToken({ projectRoot: authRef && authRef.projectRoot });
  const endpoint = new URL('/query/app/customTheme/upload.json', authRef.baseUrl);
  if (authRef.csrfToken) {
    endpoint.searchParams.set('_csrf_token', authRef.csrfToken);
  }
  const form = new FormDataImpl();
  form.append('appType', appType);
  form.append('uploadInput', new BlobImpl([file.content], { type: 'text/css' }), file.name);

  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      Authorization: `Bearer ${accessToken}`,
      Origin: authRef.baseUrl,
      Referer: `${authRef.baseUrl}/`,
      'x-requested-with': 'XMLHttpRequest',
    },
    body: form,
  });

  if (response.status === 401 || response.status === 403) {
    return { __needLogin: true, __httpStatus: response.status };
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((payload && (payload.errorMsg || payload.message)) || `主题文件上传失败: HTTP ${response.status}`);
  }
  return payload;
}

module.exports = {
  MAX_THEME_FILE_BYTES,
  REQUIRED_BRAND_SCALE_TOKENS,
  validateThemeCssContent,
  normalizeThemeColor,
  normalizeCssColorToHex,
  extractThemeColor,
  readThemeCssFile,
  unwrapUploadResponse,
  buildCustomThemeStyle,
  uploadCustomThemeFile,
};
