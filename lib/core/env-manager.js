/**
 * env-manager.js - 多环境配置管理
 *
 * 支持公有云与私有化宜搭并存，通过环境配置文件管理多套端点和登录态。
 *
 * 配置文件：{projectRoot}/.cache/openyida-envs.json
 * Cookie 隔离：.cache/cookies-{envName}.json
 *
 * 优先级（高 → 低）：
 *   1. 环境变量 OPENYIDA_ENDPOINT
 *   2. 环境变量 OPENYIDA_ENV 指定的环境配置
 *   3. 当前激活的环境配置（openyida-envs.json current 字段）
 *   4. cookieData.base_url（历史兼容）
 *   5. 默认公有云 https://www.aliwork.com
 *
 * 导出函数：
 *   loadEnvsConfig()          - 读取环境配置文件（不存在则返回默认公有云配置）
 *   saveEnvsConfig(config)    - 写入环境配置文件
 *   getCurrentEnvConfig()     - 获取当前激活的环境配置（含环境变量覆盖）
 *   getCookieFilePath(root)   - 获取当前环境的 Cookie 文件绝对路径
 *   migrateOldCookieFile()    - 迁移旧版 cookies.json → cookies-public.json
 *   resolveEndpoint()         - 解析最终 baseUrl（含完整优先级）
 *   resolveLoginUrl()         - 解析最终登录 URL
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { findProjectRoot } = require('./utils');

const DEFAULT_BASE_URL = 'https://www.aliwork.com';
const DEFAULT_LOGIN_URL = 'https://www.aliwork.com/workPlatform';
const ALIBABA_INTERNAL_BASE_URL = 'https://yida-group.alibaba-inc.com';
const ALIBABA_INTERNAL_LOGIN_URL = `${ALIBABA_INTERNAL_BASE_URL}/workPlatform`;
const ENVS_CONFIG_FILE = 'openyida-envs.json';

/** 默认公有云环境配置 */
const DEFAULT_PUBLIC_ENV = {
  baseUrl: DEFAULT_BASE_URL,
  loginUrl: DEFAULT_LOGIN_URL,
  description: '阿里云公有云宜搭',
  cookieFile: 'cookies-public.json',
};

/** 阿里内网宜搭环境配置 */
const DEFAULT_ALIBABA_INTERNAL_ENV = {
  baseUrl: ALIBABA_INTERNAL_BASE_URL,
  loginUrl: ALIBABA_INTERNAL_LOGIN_URL,
  description: '阿里内网宜搭',
  cookieFile: 'cookies-alibaba.json',
};

const BUILTIN_ENVIRONMENTS = {
  public: DEFAULT_PUBLIC_ENV,
  alibaba: DEFAULT_ALIBABA_INTERNAL_ENV,
};

const SHARED_COOKIE_DOMAINS = new Set([
  'aliwork.com',
  'alibaba-inc.com',
]);

const KNOWN_YIDA_HOSTS = new Set([
  'www.aliwork.com',
  'yida-group.alibaba-inc.com',
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

function ensureBuiltinEnvironments(config) {
  if (!config.environments) { config.environments = {}; }
  for (const [envName, envConfig] of Object.entries(BUILTIN_ENVIRONMENTS)) {
    if (!config.environments[envName]) {
      config.environments[envName] = { ...envConfig };
    }
  }
  return config;
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

function isSharedCookieDomain(hostname) {
  return SHARED_COOKIE_DOMAINS.has(normalizeHostname(hostname));
}

function isYidaServiceHost(hostname) {
  const host = normalizeHostname(hostname);
  if (!host) { return false; }
  if (KNOWN_YIDA_HOSTS.has(host)) { return true; }
  if (host.endsWith('.aliwork.com') && host !== 'aliwork.com') { return true; }
  if (host.endsWith('.alibaba-inc.com') && host !== 'alibaba-inc.com') {
    return host.startsWith('yida-') || host.includes('.yida-') || host.includes('.yida.');
  }
  return false;
}

function cookieDomainToBaseUrl(domain, fallbackUrl) {
  const host = normalizeHostname(domain);
  if (!host || isSharedCookieDomain(host)) {
    return null;
  }

  const fallbackOrigin = normalizeBaseUrl(fallbackUrl, null);
  if (fallbackOrigin) {
    const fallbackHost = normalizeHostname(fallbackOrigin);
    if (host === fallbackHost) {
      return fallbackOrigin;
    }
  }

  if (isYidaServiceHost(host)) {
    return `https://${host}`;
  }

  return null;
}

function deriveBaseUrlFromCookies(cookies = [], fallbackUrl = DEFAULT_BASE_URL) {
  const fallbackOrigin = normalizeBaseUrl(fallbackUrl, DEFAULT_BASE_URL);
  const cookieList = Array.isArray(cookies) ? cookies : [];
  const preferredCookieNames = ['yida_user_cookie', 'tianshu_csrf_token'];

  for (const cookieName of preferredCookieNames) {
    const cookie = cookieList.find((item) => item && item.name === cookieName && item.domain);
    const baseUrl = cookie ? cookieDomainToBaseUrl(cookie.domain, fallbackOrigin) : null;
    if (baseUrl) { return baseUrl; }
  }

  return fallbackOrigin;
}

function deriveBaseUrlFromUrl(fallbackBaseUrl, candidateUrl) {
  const fallbackOrigin = normalizeBaseUrl(fallbackBaseUrl, DEFAULT_BASE_URL);
  const candidateOrigin = normalizeBaseUrl(candidateUrl, null);
  if (!candidateOrigin) { return fallbackOrigin; }

  const candidateHost = normalizeHostname(candidateOrigin);
  return isYidaServiceHost(candidateHost) ? candidateOrigin : fallbackOrigin;
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
  const envName = process.env.OPENYIDA_ENV || envsConfig.current || 'public';
  const envConfig = envsConfig.environments[envName] || envsConfig.environments.public || DEFAULT_PUBLIC_ENV;

  return { name: envName, config: envConfig };
}

// ── Cookie 文件路径 ───────────────────────────────────

/**
 * 获取当前环境的 Cookie 文件绝对路径。
 * 若环境配置不存在，兜底使用 cookies-public.json。
 * @param {string} [projectRoot]
 * @returns {string}
 */
function getCookieFilePath(projectRoot) {
  const root = projectRoot || findProjectRoot();
  const { config: envConfig } = getCurrentEnvConfig(root);
  const cookieFileName = envConfig.cookieFile || 'cookies-public.json';
  return path.join(root, '.cache', cookieFileName);
}

// ── 旧版 Cookie 迁移 ──────────────────────────────────

/**
 * 将旧版 cookies.json 迁移为 cookies-public.json。
 * 仅在旧文件存在且新文件不存在时执行，保证向后兼容。
 * @param {string} [projectRoot]
 * @returns {boolean} 是否执行了迁移
 */
function migrateOldCookieFile(projectRoot) {
  const root = projectRoot || findProjectRoot();
  const oldFile = path.join(root, '.cache', 'cookies.json');
  const newFile = path.join(root, '.cache', 'cookies-public.json');

  if (fs.existsSync(oldFile) && !fs.existsSync(newFile)) {
    try {
      fs.copyFileSync(oldFile, newFile);
      // 保留旧文件作为备份，不删除，避免其他工具依赖
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

// ── 端点解析 ──────────────────────────────────────────

/**
 * 解析最终的 baseUrl，按优先级：
 *   1. OPENYIDA_ENDPOINT 环境变量
 *   2. 当前激活环境配置的 baseUrl
 *   3. cookieData.base_url（历史兼容）
 *   4. 默认公有云
 * @param {object} [cookieData]
 * @param {string} [projectRoot]
 * @returns {string}
 */
function resolveEndpoint(cookieData, projectRoot) {
  // 优先级 1：环境变量强制指定
  if (process.env.OPENYIDA_ENDPOINT) {
    return normalizeBaseUrl(process.env.OPENYIDA_ENDPOINT, DEFAULT_BASE_URL);
  }

  // 优先级 2：当前激活环境配置
  const { config: envConfig } = getCurrentEnvConfig(projectRoot);
  // 只有当环境配置不是默认公有云，或者没有 cookieData 时才使用环境配置
  // 这样可以兼容：用户没有配置多环境时，仍从 Cookie 中提取专属域名
  const isDefaultPublic = envConfig.baseUrl === DEFAULT_BASE_URL;
  if (!isDefaultPublic && envConfig.baseUrl) {
    return normalizeBaseUrl(envConfig.baseUrl, DEFAULT_BASE_URL);
  }

  // 优先级 3：从 Cookie 历史提取（兼容专属域名）
  if (cookieData && cookieData.base_url) {
    return normalizeBaseUrl(cookieData.base_url, DEFAULT_BASE_URL);
  }

  // 优先级 4：环境配置（公有云默认）
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

  const { config: envConfig } = getCurrentEnvConfig(projectRoot);
  return envConfig.loginUrl || DEFAULT_LOGIN_URL;
}

module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_LOGIN_URL,
  ALIBABA_INTERNAL_BASE_URL,
  ALIBABA_INTERNAL_LOGIN_URL,
  DEFAULT_PUBLIC_ENV,
  DEFAULT_ALIBABA_INTERNAL_ENV,
  loadEnvsConfig,
  saveEnvsConfig,
  getCurrentEnvConfig,
  getCookieFilePath,
  migrateOldCookieFile,
  resolveEndpoint,
  resolveLoginUrl,
  normalizeBaseUrl,
  normalizeHostname,
  isYidaServiceHost,
  deriveBaseUrlFromCookies,
  deriveBaseUrlFromUrl,
};
