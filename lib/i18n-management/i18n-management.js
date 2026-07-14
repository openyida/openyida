'use strict';

const { createAuthRef: createCoreAuthRef, createYidaClient, isAuthRefReady } = require('../core/yida-client');
const { normalizeYidaLocale } = require('../core/yida-i18n');

const SYSTEM_LANGUAGES = {
  zh_CN: { languageTag: 'zh_CN', languageName: '简体中文', autonym: '简体中文', support: 'full' },
  zh_TW: { languageTag: 'zh_TW', languageName: '繁体中文(中国台湾)', autonym: '繁体中文(中國台灣)', support: 'full' },
  zh_HK: { languageTag: 'zh_HK', languageName: '繁体中文(中国香港)', autonym: '繁体中文(中國香港)', support: 'full' },
  en_US: { languageTag: 'en_US', languageName: 'English', autonym: 'English', support: 'full' },
  ja_JP: { languageTag: 'ja_JP', languageName: '日语', autonym: '日本語', support: 'full' },
  ko_KR: { languageTag: 'ko_KR', languageName: '韩语', autonym: '한국어', support: 'full' },
  vi_VN: { languageTag: 'vi_VN', languageName: '越南语', autonym: 'Tiếng Việt', support: 'full' },
  th_TH: { languageTag: 'th_TH', languageName: '泰语', autonym: 'ไทย', support: 'full' },
  id_ID: { languageTag: 'id_ID', languageName: '印度尼西亚语', autonym: 'Bahasa Indonesia', support: 'full' },
  ms_MY: { languageTag: 'ms_MY', languageName: '马来语', autonym: 'Bahasa Melayu', support: 'full' },
  fr_FR: { languageTag: 'fr_FR', languageName: '法语', autonym: 'Français', support: 'full' },
  pt_BR: { languageTag: 'pt_BR', languageName: '葡萄牙语', autonym: 'Português', support: 'full' },
  tr_TR: { languageTag: 'tr_TR', languageName: '土耳其语', autonym: 'Türkçe', support: 'full' },
  es_419: { languageTag: 'es_419', languageName: '西班牙语', autonym: 'Español', support: 'full' },
  ru_RU: { languageTag: 'ru_RU', languageName: '俄语', autonym: 'Русский', support: 'full' },
};

const USAGE = `openyida i18n - 应用多语言管理

Usage:
  openyida i18n overview <appType>
  openyida i18n config get <appType>
  openyida i18n config set <appType> --default <locale> --languages <locale1,locale2>
  openyida i18n languages <appType> [--extend]
  openyida i18n list <appType> [--keyword <text>] [--page N] [--size N] [--form-uuid <formUuid>] [--target-type page|flow|views|other|ALL]
  openyida i18n upsert <appType> <i18nKey> --zh-CN <text> --en-US <text> [--ja-JP <text>] [--bind <formUuid>] [--target-type page]
  openyida i18n batch-upsert <appType> --file <items.json>
  openyida i18n delete <appType> <i18nKey> --confirm
  openyida i18n translate <appType> --text <text> --source <locale> --targets <locale1,locale2>
  openyida i18n translate-all <appType> --targets <locale1,locale2> --confirm
  openyida i18n upgrade <appType> --confirm

Examples:
  openyida i18n overview APP_XXX
  openyida i18n config set APP_XXX --default zh_CN --languages zh_CN,en_US,ja_JP
  openyida i18n upsert APP_XXX welcome_title --zh-CN "欢迎" --en-US "Welcome" --ja-JP "ようこそ"
`;

function fail(message) {
  console.error(message);
  console.error(USAGE);
  process.exit(1);
}

function printJson(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

function validateAppType(appType) {
  if (!appType) {
    throw new Error('缺少 appType');
  }
  if (/[/?#]/.test(appType)) {
    throw new Error(`无效 appType：${appType}`);
  }
  return appType;
}

function validateI18nKey(i18nKey) {
  if (!i18nKey) {
    throw new Error('缺少 i18nKey');
  }
  if (/[,\s]/.test(i18nKey)) {
    throw new Error(`无效 i18nKey：${i18nKey}`);
  }
  return i18nKey;
}

function parseCliOptions(tokens = []) {
  const positionals = [];
  const options = {};

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.startsWith('--')) {
      const key = token.slice(2).replace(/-/g, '_');
      const next = tokens[index + 1];
      if (next !== undefined && !next.startsWith('--')) {
        options[key] = next;
        index += 1;
      } else {
        options[key] = true;
      }
    } else {
      positionals.push(token);
    }
  }

  return { positionals, options };
}

function splitList(value) {
  if (!value || value === true) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

function unique(values) {
  return [...new Set((values || []).map(value => String(value).trim()).filter(Boolean))];
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value || `${fallback}`, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeLanguageTag(value) {
  if (!value) {
    return '';
  }
  const raw = String(value).trim();
  if (!raw) {
    return '';
  }
  if (/^ext_[a-z0-9-]+$/i.test(raw)) {
    return `ext_${raw.slice(4).toLowerCase()}`;
  }
  const supported = normalizeYidaLocale(raw);
  if (supported) {
    return supported;
  }
  const parts = raw.replace(/-/g, '_').split('_').filter(Boolean);
  if (parts.length === 1) {
    return parts[0].toLowerCase();
  }
  const language = parts[0].toLowerCase();
  const region = parts.slice(1).join('_');
  const normalizedRegion = /^\d+$/.test(region) ? region : region.toUpperCase();
  return `${language}_${normalizedRegion}`;
}

function getLanguageName(languageTag, fallbackName) {
  const tag = normalizeLanguageTag(languageTag);
  const language = SYSTEM_LANGUAGES[tag];
  return fallbackName || (language && language.languageName) || (language && language.autonym) || tag;
}

function normalizeLanguageItem(item, fallbackEnabled = true) {
  if (typeof item === 'string') {
    const languageTag = normalizeLanguageTag(item);
    return {
      enabled: fallbackEnabled,
      languageName: getLanguageName(languageTag),
      languageTag,
    };
  }

  const languageTag = normalizeLanguageTag(item && item.languageTag);
  return {
    ...item,
    enabled: item && Object.prototype.hasOwnProperty.call(item, 'enabled') ? !!item.enabled : fallbackEnabled,
    languageName: getLanguageName(languageTag, item && (item.languageName || item.autonym)),
    languageTag,
  };
}

function buildLanguageConfig(currentConfig = {}, options = {}) {
  const currentLanguages = Array.isArray(currentConfig.languageList) ? currentConfig.languageList : [];
  const currentMap = new Map(currentLanguages.map(item => [normalizeLanguageTag(item.languageTag), item]));
  const languageTags = unique(splitList(options.languages || options.languageList)).map(normalizeLanguageTag);
  const nextTags = languageTags.length
    ? languageTags
    : currentLanguages.map(item => normalizeLanguageTag(item.languageTag)).filter(Boolean);

  const defaultLanguage = normalizeLanguageTag(
    options.defaultLanguage || options.default || currentConfig.defaultLanguage || nextTags[0] || 'zh_CN',
  );

  if (!nextTags.includes(defaultLanguage)) {
    nextTags.unshift(defaultLanguage);
  }

  return {
    ...currentConfig,
    defaultLanguage,
    languageList: unique(nextTags).map(tag => normalizeLanguageItem(currentMap.get(tag) || tag)),
  };
}

function buildI18nTextFromOptions(options = {}) {
  const i18nText = {};
  Object.keys(options).forEach((key) => {
    const match = key.match(/^([a-z]{2,3}(?:_[a-z0-9]{2,3})?|ext_[a-z0-9]+)$/i);
    if (match && typeof options[key] === 'string') {
      i18nText[normalizeLanguageTag(key)] = options[key];
    }
  });

  const aliasMap = {
    zh: 'zh_CN',
    cn: 'zh_CN',
    en: 'en_US',
    ja: 'ja_JP',
    jp: 'ja_JP',
  };
  Object.keys(aliasMap).forEach((key) => {
    if (typeof options[key] === 'string') {
      i18nText[aliasMap[key]] = options[key];
    }
  });

  return i18nText;
}

function normalizeI18nItem(input = {}) {
  const i18nKey = validateI18nKey(input.i18nKey || input.key);
  const i18nText = input.i18nText && typeof input.i18nText === 'object'
    ? input.i18nText
    : buildI18nTextFromOptions(input);

  const normalizedText = {};
  Object.keys(i18nText).forEach((languageTag) => {
    normalizedText[normalizeLanguageTag(languageTag)] = i18nText[languageTag] === undefined || i18nText[languageTag] === null
      ? ''
      : String(i18nText[languageTag]);
  });

  if (Object.keys(normalizedText).length === 0) {
    throw new Error('至少需要提供一个语言文案，例如 --zh-CN 或 --en-US');
  }

  return {
    i18nKey,
    i18nText: normalizedText,
    textFormat: input.textFormat || input.format || 'plain',
  };
}

function getAuthRef() {
  const authRef = createCoreAuthRef();
  if (!isAuthRefReady(authRef)) {
    throw new Error('无法获取有效登录态或 CSRF Token');
  }
  return authRef;
}

function buildCommonParams(authRef, params = {}) {
  return {
    _csrf_token: authRef.csrfToken,
    _locale_time_zone_offset: String(-new Date().getTimezoneOffset() * 60 * 1000),
    _stamp: String(Date.now()),
    ...params,
  };
}

function buildRequestPath(appType, path) {
  if (/^\/(?:dingtalk|alibaba)\//.test(path)) {
    return path;
  }
  return `/${validateAppType(appType)}/${path.replace(/^\/+/, '')}`;
}

function assertSuccess(result, action) {
  if (result && result.success) {
    return result;
  }
  const message = result && (result.errorMsg || result.message || result.errorCode);
  throw new Error(`${action}失败${message ? `：${message}` : ''}`);
}

function unwrapContent(result, action) {
  return assertSuccess(result, action).content;
}

async function appGet(appType, path, params = {}, authRef = getAuthRef()) {
  return createYidaClient({ authRef }).get(
    buildRequestPath(appType, path),
    auth => buildCommonParams(auth, params),
    { silentStatus: true },
  );
}

async function appPost(appType, path, params = {}, authRef = getAuthRef()) {
  return createYidaClient({ authRef }).postForm(
    buildRequestPath(appType, path),
    auth => buildCommonParams(auth, params),
    { silentStatus: true },
  );
}

async function checkI18nAbility(appType, authRef = getAuthRef()) {
  const [enabled, context] = await Promise.all([
    appGet(appType, '/query/commodity/checkI18nAbility.json', {}, authRef),
    appGet(appType, '/query/commodity/i18nAbilityContext.json', {}, authRef),
  ]);

  return {
    enabled: unwrapContent(enabled, '检查多语言能力'),
    context: unwrapContent(context, '查询多语言能力上下文'),
  };
}

async function getLanguageConfig(appType, authRef = getAuthRef()) {
  return unwrapContent(
    await appGet(appType, '/query/appI18n/getAppLanguageConfig.json', {}, authRef),
    '查询应用多语言配置',
  );
}

async function updateLanguageConfig(appType, config, authRef = getAuthRef()) {
  const result = await appPost(appType, '/query/appI18n/updateAppLanguageConfig.json', {
    config: JSON.stringify(config),
  }, authRef);
  assertSuccess(result, '保存应用多语言配置');
  return {
    success: true,
    appType,
    config,
    content: result.content,
  };
}

async function listExtendLanguages(appType, authRef = getAuthRef()) {
  return unwrapContent(
    await appGet(appType, `/dingtalk/web/${validateAppType(appType)}/query/appI18n/listExtendLanguages.json`, {}, authRef),
    '查询扩展语言列表',
  ) || [];
}

async function checkAppI18nUpgraded(appType, authRef = getAuthRef()) {
  return unwrapContent(
    await appGet(appType, '/query/appI18n/checkAppI18nUpgraded.json', {}, authRef),
    '检查应用多语言升级状态',
  );
}

async function upgradeAppI18n(appType, authRef = getAuthRef()) {
  const result = await appPost(appType, '/query/appI18n/upgradeAppI18n.json', {}, authRef);
  assertSuccess(result, '升级应用多语言配置');
  return { success: true, appType, content: result.content };
}

async function getTranslationStatus(appType, authRef = getAuthRef()) {
  return unwrapContent(
    await appGet(appType, '/query/appI18n/checkAppTranslationStatus.json', {}, authRef),
    '查询一键翻译状态',
  );
}

async function getOverview(appType, authRef = getAuthRef()) {
  const [ability, config, upgraded, translationStatus] = await Promise.all([
    checkI18nAbility(appType, authRef),
    getLanguageConfig(appType, authRef),
    checkAppI18nUpgraded(appType, authRef),
    getTranslationStatus(appType, authRef),
  ]);
  return {
    success: true,
    appType,
    baseUrl: authRef.baseUrl,
    ability,
    config,
    upgraded,
    translationStatus,
    requiresInternationalAbility: !ability.enabled,
  };
}

async function ensureI18nAvailable(appType, authRef = getAuthRef()) {
  const ability = await checkI18nAbility(appType, authRef);
  if (!ability.enabled) {
    const version = ability.context && ability.context.corpVersion ? `（当前版本：${ability.context.corpVersion}）` : '';
    throw new Error(`当前组织未开通应用多语言能力${version}，通常需要国际化能力包或 Global YiDA 环境`);
  }
  return ability;
}

async function queryI18nItems(appType, options = {}, authRef = getAuthRef()) {
  const params = {
    keyword: options.keyword || '',
    pageIndex: toPositiveInt(options.page || options.pageIndex, 1),
    pageSize: toPositiveInt(options.size || options.pageSize, 20),
    textFormat: options.textFormat || 'plain',
  };

  if (options.targetType && options.targetType !== 'ALL') {
    params.targetType = options.targetType;
  }
  if (options.formUuid || options.catalog1) {
    params.catalog1 = options.formUuid || options.catalog1;
  }

  if (options.formUuid || options.catalog1) {
    return unwrapContent(
      await appGet(appType, '/query/appI18n/getBinded18nItems.json', params, authRef),
      '查询页面绑定多语言词条',
    );
  }

  return unwrapContent(
    await appPost(appType, '/query/appI18n/queryI18nItems.json', params, authRef),
    '查询多语言词条',
  );
}

async function getI18nItem(appType, i18nKey, authRef = getAuthRef()) {
  return unwrapContent(
    await appGet(appType, '/query/appI18n/get18nItem.json', { i18nKey: validateI18nKey(i18nKey) }, authRef),
    '查询多语言词条',
  );
}

async function bindI18nKeys(appType, options = {}, authRef = getAuthRef()) {
  const formUuid = options.formUuid || options.bind || options.catalog1;
  const i18nKeys = unique(options.i18nKeys || splitList(options.i18nKeyList)).map(validateI18nKey);

  if (!formUuid) {
    throw new Error('缺少绑定目标，请提供 --bind <formUuid>');
  }
  if (i18nKeys.length === 0) {
    throw new Error('缺少要绑定的 i18nKey');
  }

  const result = await appPost(appType, '/query/appI18n/addI18nBinding.json', {
    targetType: options.targetType || 'page',
    catalog1: formUuid,
    i18nKeyList: i18nKeys.join(','),
    ...(options.catalog2 ? { catalog2: options.catalog2 } : {}),
  }, authRef);
  assertSuccess(result, '绑定多语言词条');
  return { success: true, appType, formUuid, i18nKeys, content: result.content };
}

async function upsertI18nItem(appType, input = {}, authRef = getAuthRef()) {
  await ensureI18nAvailable(appType, authRef);
  const item = normalizeI18nItem(input);
  const params = {
    i18nKey: item.i18nKey,
    i18nText: JSON.stringify(item.i18nText),
  };
  if (item.textFormat && item.textFormat !== 'plain') {
    params.textFormat = item.textFormat;
  }

  const result = await appPost(appType, '/query/appI18n/createOrUpdateI18nItem.json', params, authRef);
  assertSuccess(result, '保存多语言词条');

  let binding = null;
  if (input.bind || input.formUuid || input.catalog1) {
    binding = await bindI18nKeys(appType, {
      formUuid: input.bind || input.formUuid || input.catalog1,
      targetType: input.targetType,
      catalog2: input.catalog2,
      i18nKeys: [item.i18nKey],
    }, authRef);
  }

  return {
    success: true,
    appType,
    ...item,
    content: result.content,
    binding,
  };
}

async function batchUpsertI18nItems(appType, items = [], authRef = getAuthRef()) {
  await ensureI18nAvailable(appType, authRef);
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('items must be a non-empty array');
  }

  const list = items.map((item) => {
    const normalized = normalizeI18nItem(item);
    return {
      i18nKey: normalized.i18nKey,
      i18nText: normalized.i18nText,
    };
  });

  const result = await appPost(appType, '/query/appI18n/batchCreateI18nItem.json', {
    list: JSON.stringify(list),
  }, authRef);
  assertSuccess(result, '批量保存多语言词条');
  return { success: true, appType, count: list.length, content: result.content };
}

async function deleteI18nItem(appType, i18nKey, authRef = getAuthRef()) {
  await ensureI18nAvailable(appType, authRef);
  const result = await appPost(appType, '/query/appI18n/deleteI18nItem.json', {
    i18nKey: validateI18nKey(i18nKey),
  }, authRef);
  assertSuccess(result, '删除多语言词条');
  return { success: true, appType, i18nKey, content: result.content };
}

async function translateText(appType, options = {}, authRef = getAuthRef()) {
  await ensureI18nAvailable(appType, authRef);
  const sourceLanguage = normalizeLanguageTag(options.source || options.sourceLanguage || 'zh_CN');
  const targetLanguageList = unique(splitList(options.targets || options.targetLanguageList)).map(normalizeLanguageTag);
  const sourceText = options.text || options.sourceText;
  if (!sourceText) {
    throw new Error('缺少待翻译文案，请提供 --text');
  }
  if (targetLanguageList.length === 0) {
    throw new Error('缺少目标语言，请提供 --targets');
  }

  const result = await appPost(appType, '/query/appI18n/translateMultiLang.json', {
    sourceText,
    sourceLanguage,
    textFormat: options.textFormat || options.format || 'plain',
    targetLanguageList: JSON.stringify(targetLanguageList),
  }, authRef);
  return {
    success: true,
    appType,
    sourceLanguage,
    targetLanguageList,
    translations: unwrapContent(result, '翻译文案'),
  };
}

async function translateAllItems(appType, targetLanguage, authRef = getAuthRef()) {
  await ensureI18nAvailable(appType, authRef);
  const target = normalizeLanguageTag(targetLanguage);
  if (!target) {
    throw new Error('缺少目标语言');
  }
  const result = await appPost(appType, '/query/appI18n/translateAllItems.json', {
    targetLanguage: target,
  }, authRef);
  assertSuccess(result, `一键翻译 ${target}`);
  return { success: true, appType, targetLanguage: target, content: result.content };
}

async function runOverview(appType) {
  printJson(await getOverview(appType));
}

async function runConfig(action, appType, options) {
  const authRef = getAuthRef();
  if (action === 'set') {
    await ensureI18nAvailable(appType, authRef);
    const currentConfig = await getLanguageConfig(appType, authRef);
    const nextConfig = buildLanguageConfig(currentConfig, {
      defaultLanguage: options.default || options.default_language,
      languages: options.languages || options.language_list,
    });
    printJson(await updateLanguageConfig(appType, nextConfig, authRef));
    return;
  }
  printJson({
    success: true,
    appType,
    config: await getLanguageConfig(appType, authRef),
  });
}

async function runLanguages(appType, options) {
  const payload = {
    success: true,
    appType,
    system: Object.values(SYSTEM_LANGUAGES),
  };
  if (options.extend) {
    payload.extend = await listExtendLanguages(appType);
  }
  printJson(payload);
}

async function runList(appType, options) {
  printJson({
    success: true,
    appType,
    items: await queryI18nItems(appType, {
      keyword: options.keyword,
      page: options.page,
      size: options.size,
      formUuid: options.form_uuid || options.formUuid,
      targetType: options.target_type || options.targetType,
    }),
  });
}

async function runUpsert(appType, i18nKey, options) {
  printJson(await upsertI18nItem(appType, {
    ...options,
    i18nKey,
    textFormat: options.text_format || options.textFormat || options.format,
    targetType: options.target_type || options.targetType,
    formUuid: options.bind || options.form_uuid || options.formUuid,
  }));
}

async function runBatchUpsert(appType, options) {
  const filePath = options.file;
  if (!filePath) {
    fail('缺少 --file <items.json>');
  }
  const fs = require('fs');
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const items = Array.isArray(payload) ? payload : payload.items;
  printJson(await batchUpsertI18nItems(appType, items));
}

async function runDelete(appType, i18nKey, options) {
  if (!options.confirm) {
    throw new Error('删除多语言词条需要显式传入 --confirm');
  }
  printJson(await deleteI18nItem(appType, i18nKey));
}

async function runTranslate(appType, options) {
  printJson(await translateText(appType, {
    text: options.text,
    source: options.source || options.source_language,
    targets: options.targets || options.target_language_list,
    textFormat: options.text_format || options.format,
  }));
}

async function runTranslateAll(appType, options) {
  if (!options.confirm) {
    throw new Error('一键翻译会批量写入目标语言文案，需要显式传入 --confirm');
  }
  const targets = unique(splitList(options.targets || options.target_language_list)).map(normalizeLanguageTag);
  if (targets.length === 0) {
    throw new Error('缺少目标语言，请提供 --targets');
  }
  const authRef = getAuthRef();
  const results = [];
  for (const target of targets) {
    results.push(await translateAllItems(appType, target, authRef));
  }
  printJson({ success: true, appType, results });
}

async function runUpgrade(appType, options) {
  if (!options.confirm) {
    throw new Error('升级应用多语言配置需要显式传入 --confirm');
  }
  printJson(await upgradeAppI18n(appType));
}

async function run(args = []) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    return;
  }

  const parsed = parseCliOptions(args);
  const subcommand = parsed.positionals[0] || 'overview';
  const options = parsed.options;

  switch (subcommand) {
    case 'overview':
    case 'check':
      if (!parsed.positionals[1]) { fail('缺少 appType'); }
      await runOverview(parsed.positionals[1]);
      break;
    case 'config': {
      const action = parsed.positionals[1] && !parsed.positionals[1].startsWith('APP_')
        ? parsed.positionals[1]
        : 'get';
      const appType = action === 'get' && parsed.positionals[1] && parsed.positionals[1].startsWith('APP_')
        ? parsed.positionals[1]
        : parsed.positionals[2];
      if (!appType) { fail('缺少 appType'); }
      await runConfig(action, appType, options);
      break;
    }
    case 'languages':
      if (!parsed.positionals[1]) { fail('缺少 appType'); }
      await runLanguages(parsed.positionals[1], options);
      break;
    case 'list':
      if (!parsed.positionals[1]) { fail('缺少 appType'); }
      await runList(parsed.positionals[1], options);
      break;
    case 'get':
      if (!parsed.positionals[1]) { fail('缺少 appType'); }
      printJson({ success: true, appType: parsed.positionals[1], item: await getI18nItem(parsed.positionals[1], parsed.positionals[2]) });
      break;
    case 'upsert':
    case 'set':
      if (!parsed.positionals[1]) { fail('缺少 appType'); }
      await runUpsert(parsed.positionals[1], parsed.positionals[2], options);
      break;
    case 'batch-upsert':
      if (!parsed.positionals[1]) { fail('缺少 appType'); }
      await runBatchUpsert(parsed.positionals[1], options);
      break;
    case 'bind':
      if (!parsed.positionals[1]) { fail('缺少 appType'); }
      printJson(await bindI18nKeys(parsed.positionals[1], {
        formUuid: options.bind || options.form_uuid || options.formUuid || parsed.positionals[2],
        targetType: options.target_type || options.targetType,
        catalog2: options.catalog2,
        i18nKeys: splitList(options.keys || options.i18n_keys || options.i18nKeyList),
      }));
      break;
    case 'delete':
    case 'remove':
      if (!parsed.positionals[1]) { fail('缺少 appType'); }
      await runDelete(parsed.positionals[1], parsed.positionals[2], options);
      break;
    case 'translate':
      if (!parsed.positionals[1]) { fail('缺少 appType'); }
      await runTranslate(parsed.positionals[1], options);
      break;
    case 'translate-all':
      if (!parsed.positionals[1]) { fail('缺少 appType'); }
      await runTranslateAll(parsed.positionals[1], options);
      break;
    case 'upgrade':
      if (!parsed.positionals[1]) { fail('缺少 appType'); }
      await runUpgrade(parsed.positionals[1], options);
      break;
    default:
      fail(`未知 i18n 子命令：${subcommand}`);
  }
}

module.exports = {
  SYSTEM_LANGUAGES,
  USAGE,
  appGet,
  appPost,
  batchUpsertI18nItems,
  bindI18nKeys,
  buildLanguageConfig,
  checkAppI18nUpgraded,
  checkI18nAbility,
  deleteI18nItem,
  getI18nItem,
  getLanguageConfig,
  getOverview,
  getTranslationStatus,
  listExtendLanguages,
  normalizeI18nItem,
  normalizeLanguageTag,
  parseCliOptions,
  queryI18nItems,
  run,
  translateAllItems,
  translateText,
  updateLanguageConfig,
  upgradeAppI18n,
  upsertI18nItem,
};
