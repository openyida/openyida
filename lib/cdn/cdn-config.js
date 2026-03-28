
/**
 * cdn-config.js - CDN 配置管理模块
 *
 * 管理 CDN 服务配置，包括：
 *   - 阿里云 AccessKey 存储（安全存储在 ~/.openyida/cdn-config.json）
 *   - 加速域名配置
 *   - 上传目录配置
 *
 * 用法：
 *   const { loadCdnConfig, saveCdnConfig, initCdnConfig } = require('./cdn-config');
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { t } = require('../core/i18n');

const OPENYIDA_DIR = path.join(os.homedir(), '.openyida');
const CDN_CONFIG_FILE = path.join(OPENYIDA_DIR, 'cdn-config.json');

/**
 * 默认 CDN 配置结构
 */
const DEFAULT_CONFIG = {
  // 阿里云 AccessKey
  accessKeyId: '',
  accessKeySecret: '',
  // CDN 加速域名
  cdnDomain: '',
  // OSS 配置（用于存储图片）
  ossRegion: 'oss-cn-hangzhou',
  ossBucket: '',
  ossEndpoint: '',
  // 上传目录前缀
  uploadPath: 'yida-images/',
  // 是否启用图片压缩
  enableCompress: true,
  // 图片最大宽度（像素）
  maxImageWidth: 1920,
  // 图片质量（1-100）
  imageQuality: 85,
};

/**
 * 确保 .openyida 目录存在
 */
function ensureOpenyidaDir() {
  if (!fs.existsSync(OPENYIDA_DIR)) {
    fs.mkdirSync(OPENYIDA_DIR, { recursive: true });
  }
}

/**
 * 加载 CDN 配置
 * @returns {object} CDN 配置对象
 */
function loadCdnConfig() {
  if (!fs.existsSync(CDN_CONFIG_FILE)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = fs.readFileSync(CDN_CONFIG_FILE, 'utf-8').trim();
    if (!raw) {
      return { ...DEFAULT_CONFIG };
    }
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (error) {
    console.error(t('cdn.config_load_error', error.message));
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * 保存 CDN 配置
 * @param {object} config - CDN 配置对象
 */
function saveCdnConfig(config) {
  ensureOpenyidaDir();
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  fs.writeFileSync(CDN_CONFIG_FILE, JSON.stringify(mergedConfig, null, 2), 'utf-8');
  console.log(t('cdn.config_saved', CDN_CONFIG_FILE));
}

/**
 * 初始化 CDN 配置（交互式配置向导）
 * @param {object} options - 配置选项
 * @param {string} options.accessKeyId - 阿里云 AccessKey ID
 * @param {string} options.accessKeySecret - 阿里云 AccessKey Secret
 * @param {string} options.cdnDomain - CDN 加速域名
 * @param {string} options.ossBucket - OSS Bucket 名称
 * @param {string} options.ossRegion - OSS 区域
 */
function initCdnConfig(options) {
  const currentConfig = loadCdnConfig();
  const newConfig = { ...currentConfig };

  // 更新配置项
  if (options.accessKeyId) {
    newConfig.accessKeyId = options.accessKeyId;
  }
  if (options.accessKeySecret) {
    newConfig.accessKeySecret = options.accessKeySecret;
  }
  if (options.cdnDomain) {
    newConfig.cdnDomain = options.cdnDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
  if (options.ossBucket) {
    newConfig.ossBucket = options.ossBucket;
    // 自动生成 OSS Endpoint
    if (options.ossRegion) {
      newConfig.ossRegion = options.ossRegion;
    }
    newConfig.ossEndpoint = `https://${newConfig.ossBucket}.${newConfig.ossRegion}.aliyuncs.com`;
  }
  if (options.uploadPath) {
    newConfig.uploadPath = options.uploadPath.replace(/^\//, '').replace(/\/$/, '') + '/';
  }

  saveCdnConfig(newConfig);
  return newConfig;
}

/**
 * 验证 CDN 配置是否完整
 * @param {object} config - CDN 配置对象
 * @returns {{ valid: boolean, missing: string[] }}
 */
function validateCdnConfig(config) {
  const required = ['accessKeyId', 'accessKeySecret', 'cdnDomain', 'ossBucket'];
  const missing = required.filter((key) => !config[key]);

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * 检查 CDN 配置是否存在
 * @returns {boolean}
 */
function hasCdnConfig() {
  if (!fs.existsSync(CDN_CONFIG_FILE)) {
    return false;
  }
  const config = loadCdnConfig();
  const { valid } = validateCdnConfig(config);
  return valid;
}

/**
 * 获取 CDN 配置文件路径
 * @returns {string}
 */
function getCdnConfigPath() {
  return CDN_CONFIG_FILE;
}

module.exports = {
  loadCdnConfig,
  saveCdnConfig,
  initCdnConfig,
  validateCdnConfig,
  hasCdnConfig,
  getCdnConfigPath,
  DEFAULT_CONFIG,
};
