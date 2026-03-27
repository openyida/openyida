/**
 * i18n.js - 国际化支持模块
 *
 * 支持语言：
 *   zh      - 简体中文（默认）
 *   zh-TW   - 繁體中文（台灣 / 香港）
 *   en      - English
 *   ja      - 日本語
 *   ko      - 한국어
 *   fr      - Français
 *   de      - Deutsch
 *   es      - Español
 *   pt      - Português
 *   vi      - Tiếng Việt
 *   hi      - हिन्दी
 *   ar      - العربية
 *
 * 语言检测优先级：
 *   1. OPENYIDA_LANG 环境变量（如：OPENYIDA_LANG=en）
 *   2. LANG / LC_ALL 系统环境变量
 *   3. 默认：zh（简体中文）
 *
 * 用法：
 *   const { t } = require('./i18n');
 *   console.log(t('login.success'));
 *   console.log(t('create_app.usage', 'yidacli'));
 */

'use strict';

const SUPPORTED_LANGUAGES = ['zh', 'zh-TW', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'vi', 'hi', 'ar'];
const DEFAULT_LANGUAGE = 'zh';

/**
 * 将系统 locale 代码映射到支持的语言代码。
 * @param {string} code - 系统 locale 代码（小写）
 * @returns {string|null}
 */
function mapLocaleToLanguage(code) {
  const localeMap = {
    zh: 'zh',
    'zh-tw': 'zh-TW',
    'zh-hk': 'zh-TW',
    'zh-mo': 'zh-TW',
    en: 'en',
    ja: 'ja',
    ko: 'ko',
    fr: 'fr',
    de: 'de',
    es: 'es',
    pt: 'pt',
    vi: 'vi',
    hi: 'hi',
    ar: 'ar',
  };
  return localeMap[code] || null;
}

/**
 * 从环境变量或系统 locale 中检测当前语言。
 * @returns {string} 支持的语言代码
 */
function detectLanguage() {
  // 优先级1：OPENYIDA_LANG 环境变量（支持完整 locale，如 zh-TW、en-US）
  const envLang = process.env.OPENYIDA_LANG;
  if (envLang) {
    const normalized = envLang.toLowerCase().replace(/_/g, '-');
    // 先尝试完整匹配（如 zh-TW）
    const fullMatch = mapLocaleToLanguage(normalized);
    if (fullMatch) {return fullMatch;}
    // 再尝试主语言代码匹配（如 en-US → en）
    const primaryCode = normalized.split('-')[0];
    const primaryMatch = mapLocaleToLanguage(primaryCode);
    if (primaryMatch) {return primaryMatch;}
  }

  // 优先级2：系统 LANG / LC_ALL 环境变量（如 zh_TW.UTF-8、en_US.UTF-8）
  const systemLang = process.env.LC_ALL || process.env.LANG || '';
  const normalizedSystem = systemLang.toLowerCase().replace(/_/g, '-').split('.')[0];
  const systemMatch = mapLocaleToLanguage(normalizedSystem);
  if (systemMatch) {return systemMatch;}
  const systemPrimary = normalizedSystem.split('-')[0];
  const systemPrimaryMatch = mapLocaleToLanguage(systemPrimary);
  if (systemPrimaryMatch) {return systemPrimaryMatch;}

  // 优先级3：默认简体中文
  return DEFAULT_LANGUAGE;
}

let currentLanguage = detectLanguage();
let translations = null;

/**
 * 懒加载翻译文件。
 * @returns {object} 翻译字典
 */
function loadTranslations() {
  if (translations) {return translations;}
  try {
    translations = require(`./locales/${currentLanguage}`);
  } catch {
    // 加载失败时回退到中文
    translations = require('./locales/zh');
  }
  return translations;
}

/**
 * 翻译函数，支持 {0} {1} 占位符插值。
 * @param {string} key - 翻译键（支持点号分隔的嵌套路径，如 "login.success"）
 * @param {...string} args - 插值参数
 * @returns {string}
 */
function t(key, ...args) {
  const dict = loadTranslations();

  // 支持嵌套路径：如 "login.success" → dict.login.success
  const value = key.split('.').reduce((obj, segment) => {
    return obj && typeof obj === 'object' ? obj[segment] : undefined;
  }, dict);

  if (typeof value !== 'string') {
    // 找不到翻译时，尝试中文兜底
    if (currentLanguage !== 'zh') {
      const zhDict = require('./locales/zh');
      const zhValue = key.split('.').reduce((obj, segment) => {
        return obj && typeof obj === 'object' ? obj[segment] : undefined;
      }, zhDict);
      if (typeof zhValue === 'string') {
        return interpolate(zhValue, args);
      }
    }
    // 最终兜底：返回 key 本身
    return key;
  }

  return interpolate(value, args);
}

/**
 * 将 {0} {1} 占位符替换为实际参数。
 * @param {string} template
 * @param {string[]} args
 * @returns {string}
 */
function interpolate(template, args) {
  if (!args || args.length === 0) {return template;}
  return template.replace(/\{(\d+)\}/g, (match, index) => {
    const argValue = args[parseInt(index, 10)];
    return argValue !== undefined ? String(argValue) : match;
  });
}

/**
 * 获取当前语言。
 * @returns {string}
 */
function getLanguage() {
  return currentLanguage;
}

/**
 * 手动设置语言（主要用于测试）。
 * @param {string} lang - 支持的语言代码（如 "zh"、"en"、"zh-TW"、"ko" 等）
 */
function setLanguage(lang) {
  if (SUPPORTED_LANGUAGES.includes(lang)) {
    currentLanguage = lang;
    translations = null; // 清空缓存，下次 t() 时重新加载
  }
}

module.exports = { t, getLanguage, setLanguage, detectLanguage, SUPPORTED_LANGUAGES };
