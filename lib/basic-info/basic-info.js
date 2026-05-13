'use strict';

const querystring = require('querystring');
const {
  loadCookieData,
  triggerLogin,
  resolveBaseUrl,
  extractInfoFromCookies,
  httpGet,
  httpPost,
  requestWithAutoLogin,
} = require('../core/utils');

const API = {
  commodityInfo: '/query/commodity/getCommodityInfo.json',
  isEduEdition: '/query/commodity/isEduEdition.json',
  grantInfo: '/query/corpadmin/getCorpGrantInfo.json',
  updateCorpDomain: '/query/corpadmin/updateCorpDomain.json',
  absPathRecords: '/query/corpadmin/pageFormAbsPathRecord.json',
  fileSummary: '/query/capacity/fileSummary.json',
  dataSummary: '/query/capacity/dataSummary.json',
  flowSummary: '/query/formLogicflowBinding/getCorpAllNum.json',
  quota: '/query/commodity/queryResourceQuotaVo.json',
  batchQuota: '/query/commodity/batchQueryResourceQuotaVo.json',
  dataflowCost: '/query/dataflowInfo/getDataflowCostQuotaMap.json',
  checkI18nAbility: '/query/commodity/checkI18nAbility.json',
  i18nContext: '/query/commodity/i18nAbilityContext.json',
};

const DEFAULT_RESOURCE_KEYS = [
  'singleFormInstanceLimit',
  'ocrAmount',
  'portalAmount',
  'corpDataCardAmount',
  'corpDataCardPushAmount',
  'faasAmount',
  'corpVviewAmount',
  'ddDataSetAmount',
];

function printUsage() {
  console.error(`Usage:
  openyida basic-info [overview] [--include-secrets]
  openyida basic-info commodity [--include-secrets]
  openyida basic-info grant
  openyida basic-info capacity [--type file|data|flow|all]
  openyida basic-info quota [--resource-key <key>|--resource-keys <a,b>]
  openyida basic-info abs-path [--page N] [--size N]
  openyida basic-info dataflow
  openyida basic-info i18n
  openyida basic-info domain
  openyida basic-info domain set --target <domain> [--origin <domain>] --confirm`);
}

function getOption(args, names) {
  const list = Array.isArray(names) ? names : [names];
  for (const name of list) {
    const index = args.indexOf(name);
    if (index !== -1 && args[index + 1] && !args[index + 1].startsWith('--')) {
      return args[index + 1];
    }
  }
  return null;
}

function hasFlag(args, names) {
  const list = Array.isArray(names) ? names : [names];
  return list.some(name => args.includes(name));
}

function getSubcommand(args) {
  if (!args[0] || args[0].startsWith('--')) {
    return 'overview';
  }
  return args[0];
}

function parsePositiveInt(value, fallback, optionName) {
  if (value === null || value === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${optionName} must be a positive integer`);
  }
  return parsed;
}

function parseResourceKeys(value) {
  if (!value) {
    return [];
  }
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function buildCommonParams(auth, extra = {}) {
  return {
    _api: 'nattyFetch',
    _mock: 'false',
    _csrf_token: auth.csrfToken,
    _locale_time_zone_offset: String(-new Date().getTimezoneOffset() * 60 * 1000),
    _stamp: Date.now(),
    ...extra,
  };
}

function unwrapResponse(response, actionName) {
  if (response && (response.__needLogin || response.__csrfExpired)) {
    throw new Error('Login state is invalid. Please run openyida login again.');
  }
  if (!response || response.success === false) {
    throw new Error((response && response.errorMsg) || `${actionName} failed`);
  }
  return response.content;
}

async function requestGet(authRef, path, params = {}, actionName = path) {
  const response = await requestWithAutoLogin(
    auth => httpGet(auth.baseUrl, path, buildCommonParams(auth, params), auth.cookies),
    authRef
  );
  return unwrapResponse(response, actionName);
}

async function requestPost(authRef, path, params = {}, actionName = path) {
  const response = await requestWithAutoLogin((auth) => {
    const body = querystring.stringify(buildCommonParams(auth, params));
    return httpPost(auth.baseUrl, path, body, auth.cookies);
  }, authRef);
  return unwrapResponse(response, actionName);
}

async function loadAuth() {
  let cookieData = loadCookieData();
  if (!cookieData) {
    cookieData = await triggerLogin();
  }

  const cookieInfo = extractInfoFromCookies(cookieData.cookies || []);
  const csrfToken = cookieData.csrf_token || cookieInfo.csrfToken;
  if (!csrfToken) {
    throw new Error('Missing csrf token. Please run openyida login again.');
  }

  return {
    cookieData,
    cookies: cookieData.cookies || [],
    csrfToken,
    corpId: cookieInfo.corpId,
    userId: cookieInfo.userId,
    baseUrl: resolveBaseUrl(cookieData),
  };
}

function sanitizeCommodityInfo(content, options = {}) {
  if (!content || typeof content !== 'object') {
    return content;
  }
  const result = { ...content };
  if (!options.includeSecrets && Object.prototype.hasOwnProperty.call(result, 'corpToken')) {
    result.corpToken = result.corpToken ? '[redacted]' : result.corpToken;
    result.corpTokenRedacted = true;
  }
  return result;
}

async function fetchCommodityInfo(authRef, options = {}) {
  const content = await requestGet(authRef, API.commodityInfo, {}, 'query commodity info');
  return sanitizeCommodityInfo(content, options);
}

async function fetchGrantInfo(authRef) {
  return requestGet(authRef, API.grantInfo, {}, 'query grant info');
}

async function fetchIsEduEdition(authRef) {
  return requestGet(authRef, API.isEduEdition, {}, 'query education edition flag');
}

async function fetchAbsPathRecords(authRef, options = {}) {
  const currentPage = parsePositiveInt(options.page, 1, '--page');
  const pageSize = parsePositiveInt(options.size, 10, '--size');
  const content = await requestPost(
    authRef,
    API.absPathRecords,
    { currentPage, pageSize },
    'query absolute path records'
  );
  return {
    currentPage: content.currentPage || currentPage,
    pageSize,
    totalCount: content.totalCount || 0,
    hasMore: !!content.hasMore,
    data: content.data || [],
  };
}

async function fetchCapacity(authRef, type = 'all') {
  const normalized = type || 'all';
  const result = {};

  if (normalized === 'all' || normalized === 'file') {
    result.file = await requestGet(authRef, API.fileSummary, {}, 'query file capacity summary');
  }
  if (normalized === 'all' || normalized === 'data') {
    result.data = await requestGet(authRef, API.dataSummary, {}, 'query data capacity summary');
  }
  if (normalized === 'all' || normalized === 'flow') {
    result.flow = await requestGet(authRef, API.flowSummary, {}, 'query flow capacity summary');
  }
  if (!['all', 'file', 'data', 'flow'].includes(normalized)) {
    throw new Error('--type must be one of file, data, flow, all');
  }

  return result;
}

async function fetchQuota(authRef, options = {}) {
  const singleKey = options.resourceKey;
  const resourceKeys = options.resourceKeys && options.resourceKeys.length
    ? options.resourceKeys
    : DEFAULT_RESOURCE_KEYS;

  if (singleKey) {
    return {
      [singleKey]: await requestGet(
        authRef,
        API.quota,
        { resourceKey: singleKey },
        `query quota ${singleKey}`
      ),
    };
  }

  return requestGet(
    authRef,
    API.batchQuota,
    { resourceKeys },
    'query resource quotas'
  );
}

async function fetchDataflow(authRef) {
  return requestGet(authRef, API.dataflowCost, {}, 'query dataflow quota map');
}

async function fetchI18n(authRef) {
  const [enabled, context] = await Promise.all([
    requestGet(authRef, API.checkI18nAbility, {}, 'check i18n ability'),
    requestGet(authRef, API.i18nContext, {}, 'query i18n context'),
  ]);
  return { enabled, context };
}

async function tryFetch(name, fetcher) {
  try {
    return { name, ok: true, data: await fetcher() };
  } catch (error) {
    return { name, ok: false, error: error.message };
  }
}

async function fetchOverview(authRef, options = {}) {
  const results = await Promise.all([
    tryFetch('commodityInfo', () => fetchCommodityInfo(authRef, options)),
    tryFetch('isEduEdition', () => fetchIsEduEdition(authRef)),
    tryFetch('grantInfo', () => fetchGrantInfo(authRef)),
    tryFetch('capacity', () => fetchCapacity(authRef, 'all')),
    tryFetch('resourceQuota', () => fetchQuota(authRef, {})),
    tryFetch('dataflowCostQuotaMap', () => fetchDataflow(authRef)),
    tryFetch('i18nAbility', () => fetchI18n(authRef)),
  ]);

  const overview = { success: true, errors: [] };
  for (const item of results) {
    if (item.ok) {
      overview[item.name] = item.data;
    } else {
      overview[item.name] = null;
      overview.errors.push({ name: item.name, message: item.error });
    }
  }
  return overview;
}

function validateDomainValue(value, optionName) {
  if (!value) {
    throw new Error(`${optionName} is required`);
  }
  if (value.length > 10) {
    throw new Error(`${optionName} must be at most 10 characters`);
  }
  if (!/^[a-z][a-z0-9-]*$/.test(value)) {
    throw new Error(`${optionName} must start with a lowercase letter and contain only lowercase letters, numbers, and hyphens`);
  }
}

async function updateDomain(authRef, args) {
  if (!hasFlag(args, '--confirm')) {
    throw new Error('Refusing to update organization domain without --confirm');
  }

  const targetDomainValue = getOption(args, ['--target', '--domain', '--target-domain-value']);
  validateDomainValue(targetDomainValue, '--target');

  let originDomainValue = getOption(args, ['--origin', '--origin-domain-value']);
  if (!originDomainValue) {
    const commodityInfo = await fetchCommodityInfo(authRef, { includeSecrets: false });
    originDomainValue = commodityInfo && commodityInfo.corpDomainVo && commodityInfo.corpDomainVo.domainValue;
  }
  validateDomainValue(originDomainValue, '--origin');

  const content = await requestPost(
    authRef,
    API.updateCorpDomain,
    { originDomainValue, targetDomainValue },
    'update organization domain'
  );
  return {
    success: true,
    originDomainValue,
    targetDomainValue,
    content,
  };
}

function outputJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

async function run(args = []) {
  if (hasFlag(args, ['--help', '-h'])) {
    printUsage();
    return;
  }

  const subcommand = getSubcommand(args);
  const includeSecrets = hasFlag(args, '--include-secrets');
  const authRef = await loadAuth();

  switch (subcommand) {
    case 'overview':
      outputJson(await fetchOverview(authRef, { includeSecrets }));
      break;
    case 'commodity':
      outputJson(await fetchCommodityInfo(authRef, { includeSecrets }));
      break;
    case 'grant':
      outputJson(await fetchGrantInfo(authRef));
      break;
    case 'abs-path':
      outputJson(await fetchAbsPathRecords(authRef, {
        page: getOption(args, '--page'),
        size: getOption(args, '--size'),
      }));
      break;
    case 'capacity':
      outputJson(await fetchCapacity(authRef, getOption(args, '--type') || 'all'));
      break;
    case 'quota':
      outputJson(await fetchQuota(authRef, {
        resourceKey: getOption(args, '--resource-key'),
        resourceKeys: parseResourceKeys(getOption(args, '--resource-keys')),
      }));
      break;
    case 'dataflow':
      outputJson(await fetchDataflow(authRef));
      break;
    case 'i18n':
      outputJson(await fetchI18n(authRef));
      break;
    case 'domain': {
      const action = args.find((arg, index) => index > args.indexOf('domain') && !arg.startsWith('--'));
      if (action === 'set') {
        outputJson(await updateDomain(authRef, args));
      } else {
        const commodityInfo = await fetchCommodityInfo(authRef, { includeSecrets: false });
        outputJson({
          success: true,
          corpDomainVo: commodityInfo && commodityInfo.corpDomainVo,
        });
      }
      break;
    }
    default:
      printUsage();
      process.exit(1);
  }
}

module.exports = {
  API,
  DEFAULT_RESOURCE_KEYS,
  fetchAbsPathRecords,
  fetchCapacity,
  fetchCommodityInfo,
  fetchDataflow,
  fetchGrantInfo,
  fetchI18n,
  fetchIsEduEdition,
  fetchOverview,
  fetchQuota,
  loadAuth,
  run,
  sanitizeCommodityInfo,
  updateDomain,
};
