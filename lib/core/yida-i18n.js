'use strict';

const DEFAULT_CONTENT_LOCALE = 'zh_CN';
const INTERNATIONAL_CONTENT_LOCALE = 'en_US';
const SUPPORTED_CONTENT_LOCALES = ['zh_CN', 'en_US', 'ja_JP'];

const LOCALE_ALIASES = {
  zh: 'zh_CN',
  'zh-cn': 'zh_CN',
  'zh-hans': 'zh_CN',
  'zh_cn': 'zh_CN',
  cn: 'zh_CN',
  chinese: 'zh_CN',
  '中文': 'zh_CN',
  '简体中文': 'zh_CN',
  en: 'en_US',
  'en-us': 'en_US',
  'en_us': 'en_US',
  english: 'en_US',
  '英文': 'en_US',
  ja: 'ja_JP',
  jp: 'ja_JP',
  'ja-jp': 'ja_JP',
  'ja_jp': 'ja_JP',
  japanese: 'ja_JP',
  '日语': 'ja_JP',
  '日本语': 'ja_JP',
  '日本語': 'ja_JP',
};

function normalizeRawLocale(value) {
  if (!value) { return ''; }
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .split('.')[0];
}

function normalizeYidaLocale(value) {
  const raw = normalizeRawLocale(value);
  if (!raw) { return null; }
  if (LOCALE_ALIASES[raw]) { return LOCALE_ALIASES[raw]; }
  const primary = raw.split('-')[0];
  return LOCALE_ALIASES[primary] || null;
}

function isInternationalBaseUrl(baseUrl) {
  if (!baseUrl) { return false; }
  try {
    const hostname = new URL(String(baseUrl)).hostname.toLowerCase();
    return hostname === 'www.yidaapps.com' || hostname.endsWith('.yidaapps.com');
  } catch {
    return String(baseUrl).toLowerCase().includes('yidaapps.com');
  }
}

function detectContentLocaleFromEnv() {
  const candidates = [
    process.env.OPENYIDA_CONTENT_LOCALE,
    process.env.YIDA_CONTENT_LOCALE,
    process.env.OPENYIDA_APP_LOCALE,
    process.env.OPENYIDA_LANG,
    process.env.LC_ALL,
    process.env.LANG,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeYidaLocale(candidate);
    if (normalized) { return normalized; }
  }
  return null;
}

function resolveContentLocale(options = {}) {
  return normalizeYidaLocale(options.locale || options.contentLocale)
    || detectContentLocaleFromEnv()
    || (isInternationalBaseUrl(options.baseUrl) ? INTERNATIONAL_CONTENT_LOCALE : DEFAULT_CONTENT_LOCALE);
}

function toText(value) {
  return value === undefined || value === null ? '' : String(value);
}

function normalizeTranslations(translations) {
  if (typeof translations === 'string') {
    return { en_US: translations };
  }
  return translations && typeof translations === 'object' ? translations : {};
}

function buildYidaI18n(text, translations = {}, options = {}) {
  const normalizedTranslations = normalizeTranslations(translations);
  const baseText = toText(text);
  const enText = toText(normalizedTranslations.en_US || normalizedTranslations.pureEn_US || baseText);
  const result = {
    type: 'i18n',
    zh_CN: toText(normalizedTranslations.zh_CN || baseText),
    en_US: enText,
    ja_JP: toText(normalizedTranslations.ja_JP || baseText),
  };

  if (options.includePureEn) {
    result.pureEn_US = enText;
  }
  if (options.includeMeta) {
    result.envLocale = null;
    result.key = null;
  }

  return result;
}

function buildYidaTitleI18n(text, translations = {}) {
  return buildYidaI18n(text, translations, {
    includePureEn: true,
    includeMeta: true,
  });
}

// Preference order covers every locale key produced across the project so a
// single getter can replace the per-module resolveLocalizedText copies.
const LOCALIZED_TEXT_KEYS = ['zh_CN', 'en_US', 'zh_TW', 'ja_JP', 'pureEn_US', 'name'];

/**
 * Read a human-readable label from a Yida i18n value.
 * Accepts plain strings, i18n objects, or JSON strings that encode an i18n
 * object. The counterpart to buildYidaI18n / buildYidaTitleI18n on the read side.
 *
 * @param {*} value raw title/label value
 * @param {string} [fallback] returned when nothing usable is found
 * @param {{parseJson?: boolean}} [options] set parseJson=false to keep JSON-looking strings verbatim
 * @returns {string}
 */
function parseYidaI18n(value, fallback = '', options = {}) {
  if (!value) {
    return fallback;
  }

  if (typeof value === 'string') {
    if (options.parseJson !== false) {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object') {
          return parseYidaI18n(parsed, fallback, options);
        }
      } catch {
        // Not JSON, treat as a plain string below.
      }
    }
    return value;
  }

  if (typeof value === 'object') {
    for (const key of LOCALIZED_TEXT_KEYS) {
      if (value[key]) {
        return value[key];
      }
    }
    return fallback;
  }

  return fallback;
}

module.exports = {
  SUPPORTED_CONTENT_LOCALES,
  buildYidaI18n,
  buildYidaTitleI18n,
  detectContentLocaleFromEnv,
  isInternationalBaseUrl,
  normalizeYidaLocale,
  parseYidaI18n,
  resolveContentLocale,
};
