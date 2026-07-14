/**
 * env-manager.js - 多环境配置管理
 *
 * 支持公有云与私有化宜搭并存，通过环境配置文件管理多套端点。
 *
 * 配置文件：{projectRoot}/.cache/openyida-envs.json
 * 优先级（高 → 低）：
 *   1. 环境变量 OPENYIDA_ENDPOINT
 *   2. authData.base_url（登录后实际跳转域名）
 *   3. 环境变量 OPENYIDA_ENV 指定的环境配置
 *   4. 当前激活的环境配置（openyida-envs.json current 字段）
 *   5. 默认公有云 https://www.aliwork.com
 *
 * 导出函数：
 *   loadEnvsConfig()          - 读取环境配置文件（不存在则返回默认公有云配置）
 *   saveEnvsConfig(config)    - 写入环境配置文件
 *   getCurrentEnvConfig()     - 获取当前激活的环境配置（含环境变量覆盖）
 *   resolveEndpoint()         - 解析最终 baseUrl（含完整优先级）
 *   resolveLoginUrl()         - 解析最终登录 URL
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { findProjectRoot } = require('./utils');

const DEFAULT_BASE_URL = 'https://www.aliwork.com';
const DEFAULT_LOGIN_URL = 'https://www.aliwork.com/workPlatform';
const INTERNATIONAL_BASE_URL = 'https://www.yidaapps.com';
const DINGTALK_OAUTH_CLIENT_ID = 'suite9xvlxxerybljwheo';
const DINGTALK_LOGIN_ORIGIN = 'https://login.dingtalk.com';
const DINGTALK_INTL_LOGIN_ORIGIN = 'https://login.dingtalk.io';
const ALIBABA_INTERNAL_BASE_URL = 'https://yida-group.alibaba-inc.com';
const ALIBABA_INTERNAL_LOGIN_URL = `${ALIBABA_INTERNAL_BASE_URL}/workPlatform`;
const ENVS_CONFIG_FILE = 'openyida-envs.json';

function normalizeUrlOrigin(value, fallback) {
  const raw = value || fallback;
  const trimmed = String(raw || '').trim();
  if (!trimmed) {return fallback;}
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    return new URL(withProtocol).origin.replace(/\/+$/, '');
  } catch {
    return fallback;
  }
}

function buildDingtalkOAuthLoginUrl(options = {}) {
  const loginOrigin = normalizeUrlOrigin(options.loginOrigin || DINGTALK_LOGIN_ORIGIN, DINGTALK_LOGIN_ORIGIN);
  const baseUrl = normalizeUrlOrigin(options.baseUrl || DEFAULT_BASE_URL, DEFAULT_BASE_URL);
  const continueUrl = `${baseUrl}${options.continuePath || '/workPlatform'}`;
  const callbackUrl = `${baseUrl}/dingtalk_sso_call_back?continue=${encodeURIComponent(continueUrl)}`;
  const params = new URLSearchParams({
    redirect_uri: callbackUrl,
    response_type: 'code',
    client_id: options.clientId || DINGTALK_OAUTH_CLIENT_ID,
    scope: 'openid corpid',
    lang: options.lang || 'zh_CN',
  });
  if (options.forceLogin) {
    params.set('FEForceLogin', 'true');
  }

  return `${loginOrigin}/oauth2/auth?${params.toString()}`;
}

// 海外 YiDA / DingTalk International 登录入口。
// 必须满足三个条件才能让国际版钉钉扫码识别：
//   1. login origin 为 login.dingtalk.io
//   2. redirect_uri 落在 www.yidaapps.com（否则登完跳回国内域名，海外后端拿不到 session）
//   3. 追加 FEForceLogin=true，强制走国际版登录流程
const INTERNATIONAL_LOGIN_URL = buildDingtalkOAuthLoginUrl({
  loginOrigin: DINGTALK_INTL_LOGIN_ORIGIN,
  baseUrl: INTERNATIONAL_BASE_URL,
  lang: 'en_US',
  forceLogin: true,
});
const LEGACY_INTERNATIONAL_LOGIN_URL = buildDingtalkOAuthLoginUrl({
  loginOrigin: DINGTALK_INTL_LOGIN_ORIGIN,
  baseUrl: DEFAULT_BASE_URL,
  lang: 'en_US',
});

/** 默认公有云环境配置 */
const DEFAULT_PUBLIC_ENV = {
  baseUrl: DEFAULT_BASE_URL,
  loginUrl: DEFAULT_LOGIN_URL,
  description: '阿里云公有云宜搭',
};

/** 阿里内网宜搭环境配置 */
const DEFAULT_ALIBABA_INTERNAL_ENV = {
  baseUrl: ALIBABA_INTERNAL_BASE_URL,
  loginUrl: ALIBABA_INTERNAL_LOGIN_URL,
  description: '阿里内网宜搭',
};

/** 海外版 YiDA / DingTalk International 环境配置 */
const DEFAULT_INTERNATIONAL_ENV = {
  baseUrl: INTERNATIONAL_BASE_URL,
  loginUrl: INTERNATIONAL_LOGIN_URL,
  description: '海外版 YiDA Apps / DingTalk International（www.yidaapps.com）',
};

const BUILTIN_ENVIRONMENTS = {
  public: DEFAULT_PUBLIC_ENV,
  intl: DEFAULT_INTERNATIONAL_ENV,
  alibaba: DEFAULT_ALIBABA_INTERNAL_ENV,
};

const ENV_ALIASES = {
  public: 'public',
  aliyun: 'public',
  domestic: 'public',
  china: 'public',
  '国内': 'public',
  '国内版': 'public',
  '中国': 'public',
  '中国版': 'public',
  '国内宜搭': 'public',
  '中国宜搭': 'public',
  overseas: 'intl',
  oversea: 'intl',
  international: 'intl',
  global: 'intl',
  abroad: 'intl',
  intl: 'intl',
  '海外': 'intl',
  '海外版': 'intl',
  '国际': 'intl',
  '国际版': 'intl',
  '全球': 'intl',
  '全球版': 'intl',
  '海外宜搭': 'intl',
  '海外yida': 'intl',
  '国际宜搭': 'intl',
  '全球宜搭': 'intl',
  '日本': 'intl',
  '日本宜搭': 'intl',
  '日本yida': 'intl',
  alibaba: 'alibaba',
  internal: 'alibaba',
  intranet: 'alibaba',
  '阿里': 'alibaba',
  '阿里内网': 'alibaba',
  '内网': 'alibaba',
};

const KNOWN_YIDA_HOSTS = new Set([
  'www.aliwork.com',
  'www.yidaapps.com',
  'yida-group.alibaba-inc.com',
  'www.yidaapps.com',
]);

function cloneBuiltinEnvironments() {
  return Object.fromEntries(
    Object.entries(BUILTIN_ENVIRONMENTS).map(([name, envConfig]) => [name, { ...envConfig }])
  );
}

function buildDefaultEnvsConfig() {
  return {
    current: 'public',
    environments: cloneBuiltinEnvironments(),
  };
}

function resolveEnvNameAlias(envName) {
  if (!envName) {return envName;}
  const normalized = String(envName).trim().toLowerCase();
  return ENV_ALIASES[normalized] || envName;
}

function ensureBuiltinEnvironments(config) {
  if (!config.environments) { config.environments = {}; }
  for (const [envName, envConfig] of Object.entries(BUILTIN_ENVIRONMENTS)) {
    if (!config.environments[envName]) {
      config.environments[envName] = { ...envConfig };
    }
  }
  if (isLegacyInternationalEnv(config.environments.intl)) {
    config.environments.intl = { ...DEFAULT_INTERNATIONAL_ENV };
  }
  return config;
}

function isLegacyInternationalEnv(envConfig) {
  return !!(
    envConfig &&
    normalizeBaseUrl(envConfig.baseUrl, null) === DEFAULT_BASE_URL &&
    (!envConfig.loginUrl || envConfig.loginUrl === LEGACY_INTERNATIONAL_LOGIN_URL)
  );
}

function normalizeBaseUrl(value, fallback = null) {
  if (!value) { return fallback; }
  const trimmed = String(value).trim();
  if (!trimmed) { return fallback; }
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    return new URL(withProtocol).origin.replace(/\/+$/, '');
  } catch {
    return fallback;
  }
}

function normalizeHostname(value) {
  if (!value) { return ''; }
  const trimmed = String(value).trim().replace(/^\./, '').toLowerCase();
  if (!trimmed) { return ''; }
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
      return new URL(trimmed).hostname.toLowerCase();
    }
    if (trimmed.includes('/')) {
      return new URL(`https://${trimmed}`).hostname.toLowerCase();
    }
  } catch {
    return '';
  }
  return trimmed;
}

function isYidaServiceHost(hostname) {
  const host = normalizeHostname(hostname);
  if (!host) { return false; }
  if (KNOWN_YIDA_HOSTS.has(host)) { return true; }
  if (host.endsWith('.aliwork.com') && host !== 'aliwork.com') { return true; }
  if (host.endsWith('.yidaapps.com') && host !== 'yidaapps.com') { return true; }
  if (host.endsWith('.alibaba-inc.com') && host !== 'alibaba-inc.com') {
    return host.startsWith('yida-') || host.includes('.yida-') || host.includes('.yida.');
  }
  return false;
}

function isYidaAppsHost(hostname) {
  const host = normalizeHostname(hostname);
  return host === 'yidaapps.com' || host.endsWith('.yidaapps.com');
}

function inferEnvironmentNameFromUrl(value) {
  const redirectBaseUrl = deriveBaseUrlFromDingtalkOAuthUrl(value, null);
  if (redirectBaseUrl) {
    return inferEnvironmentNameFromUrl(redirectBaseUrl);
  }

  const host = normalizeHostname(value);
  if (!host) { return null; }

  if (host === 'login.dingtalk.io' || host.endsWith('.dingtalk.io')) {
    return 'intl';
  }
  if (host === 'yidaapps.com' || host.endsWith('.yidaapps.com')) {
    return 'intl';
  }
  if (host === 'aliwork.com' || host.endsWith('.aliwork.com')) {
    return 'public';
  }
  if (host === 'yida-group.alibaba-inc.com') {
    return 'alibaba';
  }
  if (host.endsWith('.alibaba-inc.com') && isYidaServiceHost(host)) {
    return 'alibaba';
  }

  return null;
}

function isDefaultWorkPlatformLoginUrl(loginUrl, baseUrl) {
  const loginOrigin = normalizeBaseUrl(loginUrl, null);
  const baseOrigin = normalizeBaseUrl(baseUrl, null);
  if (!loginOrigin || !baseOrigin || loginOrigin !== baseOrigin) {
    return false;
  }

  try {
    const parsedUrl = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(loginUrl) ? loginUrl : `https://${loginUrl}`);
    return parsedUrl.pathname.replace(/\/+$/, '') === '/workPlatform' &&
      !parsedUrl.search &&
      !parsedUrl.hash;
  } catch {
    return false;
  }
}

function inferLoginUrlForBaseUrl(baseUrl, fallbackLoginUrl) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl, DEFAULT_BASE_URL);
  if (isYidaAppsHost(normalizedBaseUrl)) {
    return buildDingtalkOAuthLoginUrl({
      loginOrigin: DINGTALK_INTL_LOGIN_ORIGIN,
      baseUrl: normalizedBaseUrl,
      lang: 'en_US',
      forceLogin: true,
    });
  }
  return fallbackLoginUrl || `${normalizedBaseUrl}/workPlatform`;
}

function deriveBaseUrlFromUrl(fallbackBaseUrl, candidateUrl) {
  let fallbackOrigin = normalizeBaseUrl(fallbackBaseUrl, DEFAULT_BASE_URL);
  const fallbackHost = normalizeHostname(fallbackOrigin);
  if (!isYidaServiceHost(fallbackHost)) {
    const callbackOrigin = deriveBaseUrlFromDingtalkOAuthUrl(fallbackBaseUrl, null);
    if (callbackOrigin) {
      fallbackOrigin = callbackOrigin;
    }
  }

  const candidateOrigin = normalizeBaseUrl(candidateUrl, null);
  if (!candidateOrigin) { return fallbackOrigin; }

  const candidateHost = normalizeHostname(candidateOrigin);
  return isYidaServiceHost(candidateHost) ? candidateOrigin : fallbackOrigin;
}

function deriveBaseUrlFromDingtalkOAuthUrl(oauthUrl, fallbackUrl) {
  if (!oauthUrl) { return fallbackUrl || null; }

  try {
    const parsedUrl = new URL(oauthUrl);
    const host = normalizeHostname(parsedUrl.hostname);
    const isDingtalkLoginHost = host.endsWith('dingtalk.com') || host.endsWith('dingtalk.io');
    if (!isDingtalkLoginHost || !parsedUrl.pathname.startsWith('/oauth2/')) {
      return fallbackUrl || null;
    }

    const redirectUri = parsedUrl.searchParams.get('redirect_uri');
    const redirectOrigin = normalizeBaseUrl(redirectUri, null);
    if (redirectOrigin && isYidaServiceHost(normalizeHostname(redirectOrigin))) {
      return redirectOrigin;
    }
  } catch {
    // ignore malformed URLs
  }

  return fallbackUrl || null;
}

// ── 配置文件读写 ──────────────────────────────────────

/**
 * 读取环境配置文件。
 * 若文件不存在，返回含默认公有云环境的配置（不写入磁盘）。
 * @param {string} [projectRoot]
 * @returns {{ current: string, environments: object }}
 */
function loadEnvsConfig(projectRoot) {
  const root = projectRoot || findProjectRoot();
  const configPath = path.join(root, '.cache', ENVS_CONFIG_FILE);

  if (!fs.existsSync(configPath)) {
    return buildDefaultEnvsConfig();
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf-8').trim();
    const parsed = JSON.parse(raw);
    // 确保内置环境始终存在，已有同名环境不覆盖，保证用户配置优先
    return ensureBuiltinEnvironments(parsed);
  } catch {
    return buildDefaultEnvsConfig();
  }
}

/**
 * 写入环境配置文件。
 * @param {object} config
 * @param {string} [projectRoot]
 */
function saveEnvsConfig(config, projectRoot) {
  const root = projectRoot || findProjectRoot();
  const cacheDir = path.join(root, '.cache');
  const configPath = path.join(cacheDir, ENVS_CONFIG_FILE);

  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

// ── 当前环境解析 ──────────────────────────────────────

/**
 * 获取当前激活的环境配置对象。
 * 优先级：OPENYIDA_ENV 环境变量 > config.current > 'public'
 * @param {string} [projectRoot]
 * @returns {{ name: string, config: object }}
 */
function getCurrentEnvConfig(projectRoot) {
  const envsConfig = loadEnvsConfig(projectRoot);
  const envName = resolveEnvNameAlias(process.env.OPENYIDA_ENV || envsConfig.current || 'public');
  const envConfig = envsConfig.environments[envName] || envsConfig.environments.public || DEFAULT_PUBLIC_ENV;

  return { name: envName, config: envConfig };
}

// ── 端点解析 ──────────────────────────────────────────

/**
 * 解析最终的 baseUrl，按优先级：
 *   1. OPENYIDA_ENDPOINT 环境变量
 *   2. authData.base_url（登录后实际跳转域名）
 *   3. 当前激活环境配置的 baseUrl
 *   4. 默认公有云
 * @param {object} [authData]
 * @param {string} [projectRoot]
 * @returns {string}
 */
function resolveEndpoint(authData, projectRoot) {
  // 优先级 1：环境变量强制指定
  if (process.env.OPENYIDA_ENDPOINT) {
    return normalizeBaseUrl(process.env.OPENYIDA_ENDPOINT, DEFAULT_BASE_URL);
  }

  // 优先级 2：登录缓存中记录的实际服务域名
  if (authData && authData.base_url) {
    return normalizeBaseUrl(authData.base_url, DEFAULT_BASE_URL);
  }

  // 优先级 3：当前激活环境配置
  const { config: envConfig } = getCurrentEnvConfig(projectRoot);
  if (envConfig.baseUrl) {
    return normalizeBaseUrl(envConfig.baseUrl, DEFAULT_BASE_URL);
  }

  return DEFAULT_BASE_URL;
}

/**
 * 解析最终的登录 URL，按优先级：
 *   1. OPENYIDA_LOGIN_URL 环境变量
 *   2. 当前激活环境配置的 loginUrl
 *   3. 默认公有云登录 URL
 * @param {string} [projectRoot]
 * @returns {string}
 */
function resolveLoginUrl(projectRoot) {
  if (process.env.OPENYIDA_LOGIN_URL) {
    return process.env.OPENYIDA_LOGIN_URL;
  }

  if (process.env.OPENYIDA_ENDPOINT) {
    return inferLoginUrlForBaseUrl(process.env.OPENYIDA_ENDPOINT);
  }

  const { config: envConfig } = getCurrentEnvConfig(projectRoot);
  const baseUrl = normalizeBaseUrl(envConfig.baseUrl, DEFAULT_BASE_URL);
  if (!envConfig.loginUrl || isDefaultWorkPlatformLoginUrl(envConfig.loginUrl, baseUrl)) {
    return inferLoginUrlForBaseUrl(baseUrl, envConfig.loginUrl || DEFAULT_LOGIN_URL);
  }

  return envConfig.loginUrl || DEFAULT_LOGIN_URL;
}

module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_LOGIN_URL,
  INTERNATIONAL_BASE_URL,
  DINGTALK_OAUTH_CLIENT_ID,
  DINGTALK_LOGIN_ORIGIN,
  DINGTALK_INTL_LOGIN_ORIGIN,
  INTERNATIONAL_LOGIN_URL,
  ALIBABA_INTERNAL_BASE_URL,
  ALIBABA_INTERNAL_LOGIN_URL,
  DEFAULT_PUBLIC_ENV,
  DEFAULT_INTERNATIONAL_ENV,
  DEFAULT_ALIBABA_INTERNAL_ENV,
  buildDingtalkOAuthLoginUrl,
  resolveEnvNameAlias,
  loadEnvsConfig,
  saveEnvsConfig,
  getCurrentEnvConfig,
  resolveEndpoint,
  resolveLoginUrl,
  normalizeBaseUrl,
  normalizeHostname,
  isYidaServiceHost,
  isYidaAppsHost,
  inferEnvironmentNameFromUrl,
  inferLoginUrlForBaseUrl,
  deriveBaseUrlFromDingtalkOAuthUrl,
  deriveBaseUrlFromUrl,
};
