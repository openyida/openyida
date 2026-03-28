
/**
 * cdn-config-cmd.js - CDN 配置命令
 *
 * 管理阿里云 CDN/OSS 配置，包括 AccessKey、域名等。
 *
 * 用法：
 *   yida cdn-config [选项]
 *
 * 选项：
 *   --init              初始化配置（交互式）
 *   --show              显示当前配置
 *   --set-key <key>     设置 AccessKey ID
 *   --set-secret <secret> 设置 AccessKey Secret
 *   --set-domain <domain> 设置 CDN 加速域名
 *   --set-bucket <bucket> 设置 OSS Bucket 名称
 *   --set-region <region> 设置 OSS 区域
 *
 * 示例：
 *   yida cdn-config --init
 *   yida cdn-config --show
 *   yida cdn-config --set-domain cdn.example.com
 */

'use strict';

const { t } = require('../core/i18n');
const {
  loadCdnConfig,
  initCdnConfig,
  validateCdnConfig,
  getCdnConfigPath,
} = require('./cdn-config');

/**
 * 解析命令行参数
 * @param {string[]} args
 * @returns {object}
 */
function parseArgs(args) {
  const result = {
    init: false,
    show: false,
    setKey: null,
    setSecret: null,
    setDomain: null,
    setBucket: null,
    setRegion: null,
    setPath: null,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--init') {
      result.init = true;
    } else if (arg === '--show') {
      result.show = true;
    } else if (arg === '--set-key') {
      result.setKey = args[++i];
    } else if (arg === '--set-secret') {
      result.setSecret = args[++i];
    } else if (arg === '--set-domain') {
      result.setDomain = args[++i];
    } else if (arg === '--set-bucket') {
      result.setBucket = args[++i];
    } else if (arg === '--set-region') {
      result.setRegion = args[++i];
    } else if (arg === '--set-path') {
      result.setPath = args[++i];
    }
  }

  return result;
}

/**
 * 打印帮助信息
 */
function printHelp() {
  console.log(t('cdn.config_usage'));
  console.log('');
  console.log(t('cdn.config_examples'));
  console.log('  yida cdn-config --init');
  console.log('  yida cdn-config --show');
  console.log('  yida cdn-config --set-domain cdn.example.com');
  console.log('  yida cdn-config --set-bucket my-bucket --set-region oss-cn-hangzhou');
  console.log('');
  console.log(t('cdn.config_options'));
  console.log('  --init                ' + t('cdn.config_opt_init'));
  console.log('  --show                ' + t('cdn.config_opt_show'));
  console.log('  --set-key <key>       ' + t('cdn.config_opt_key'));
  console.log('  --set-secret <secret> ' + t('cdn.config_opt_secret'));
  console.log('  --set-domain <domain> ' + t('cdn.config_opt_domain'));
  console.log('  --set-bucket <bucket> ' + t('cdn.config_opt_bucket'));
  console.log('  --set-region <region> ' + t('cdn.config_opt_region'));
  console.log('  --set-path <path>     ' + t('cdn.config_opt_path'));
}

/**
 * 掩码敏感信息
 * @param {string} value
 * @param {number} visibleChars
 * @returns {string}
 */
function maskSensitive(value, visibleChars = 4) {
  if (!value) {return '';}
  if (value.length <= visibleChars * 2) {
    return '*'.repeat(value.length);
  }
  return value.slice(0, visibleChars) + '*'.repeat(value.length - visibleChars * 2) + value.slice(-visibleChars);
}

/**
 * 显示当前配置
 */
function showConfig() {
  const config = loadCdnConfig();
  const configPath = getCdnConfigPath();

  console.log(t('cdn.config_file_path', configPath));
  console.log('');

  console.log(t('cdn.config_section_aliyun'));
  console.log(`  AccessKey ID:  ${maskSensitive(config.accessKeyId)}`);
  console.log(`  AccessKey Secret: ${maskSensitive(config.accessKeySecret)}`);
  console.log('');

  console.log(t('cdn.config_section_cdn'));
  console.log(`  ${t('cdn.config_cdn_domain')}: ${config.cdnDomain || t('cdn.config_not_set')}`);
  console.log('');

  console.log(t('cdn.config_section_oss'));
  console.log(`  ${t('cdn.config_oss_region')}: ${config.ossRegion}`);
  console.log(`  ${t('cdn.config_oss_bucket')}: ${config.ossBucket || t('cdn.config_not_set')}`);
  console.log(`  ${t('cdn.config_oss_endpoint')}: ${config.ossEndpoint || t('cdn.config_not_set')}`);
  console.log('');

  console.log(t('cdn.config_section_upload'));
  console.log(`  ${t('cdn.config_upload_path')}: ${config.uploadPath}`);
  console.log(`  ${t('cdn.config_compress')}: ${config.enableCompress ? t('cdn.config_enabled') : t('cdn.config_disabled')}`);
  console.log(`  ${t('cdn.config_max_width')}: ${config.maxImageWidth}px`);
  console.log(`  ${t('cdn.config_quality')}: ${config.imageQuality}%`);
  console.log('');

  // 验证配置
  const { valid, missing } = validateCdnConfig(config);
  if (valid) {
    console.log(t('cdn.config_status_valid'));
  } else {
    console.log(t('cdn.config_status_invalid'));
    console.log(t('cdn.config_missing', missing.join(', ')));
  }
}

/**
 * 交互式初始化配置
 */
function initConfigInteractive() {
  console.log(t('cdn.config_init_title'));
  console.log('');
  console.log(t('cdn.config_init_desc'));
  console.log('');

  // 显示示例
  console.log(t('cdn.config_init_example'));
  console.log('  AccessKey ID: LTAI5t*************');
  console.log('  AccessKey Secret: AbCdEfGhIjKlMnOpQrStUvWxYz******');
  console.log('  CDN Domain: cdn.example.com');
  console.log('  OSS Bucket: my-image-bucket');
  console.log('  OSS Region: oss-cn-hangzhou');
  console.log('');

  console.log(t('cdn.config_init_hint'));
  console.log('  yida cdn-config --set-key LTAI5tXXXXXXXXXXXXXXX');
  console.log('  yida cdn-config --set-secret AbCdEfGhIjKlMnOpQrStUvWxYzXXXXXXXX');
  console.log('  yida cdn-config --set-domain cdn.example.com');
  console.log('  yida cdn-config --set-bucket my-image-bucket');
  console.log('  yida cdn-config --set-region oss-cn-hangzhou');
  console.log('');
  console.log(t('cdn.config_init_or'));
  console.log('  yida cdn-config --set-key YOUR_KEY --set-secret YOUR_SECRET --set-domain cdn.example.com --set-bucket your-bucket');
}

/**
 * CLI 入口函数
 * @param {string[]} args
 */
async function run(args) {
  const options = parseArgs(args);

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  // 显示配置
  if (options.show) {
    showConfig();
    process.exit(0);
  }

  // 交互式初始化
  if (options.init) {
    initConfigInteractive();
    process.exit(0);
  }

  // 设置配置项
  const hasSetOption =
    options.setKey ||
    options.setSecret ||
    options.setDomain ||
    options.setBucket ||
    options.setRegion ||
    options.setPath;

  if (hasSetOption) {
    const newConfig = initCdnConfig({
      accessKeyId: options.setKey,
      accessKeySecret: options.setSecret,
      cdnDomain: options.setDomain,
      ossBucket: options.setBucket,
      ossRegion: options.setRegion,
      uploadPath: options.setPath,
    });

    console.log(t('cdn.config_updated'));
    console.log('');

    // 显示更新后的配置
    const { valid, missing } = validateCdnConfig(newConfig);
    if (valid) {
      console.log(t('cdn.config_status_valid'));
    } else {
      console.log(t('cdn.config_status_invalid'));
      console.log(t('cdn.config_missing', missing.join(', ')));
    }

    process.exit(0);
  }

  // 无参数时显示帮助
  printHelp();
}

module.exports = { run, showConfig, initConfigInteractive };
