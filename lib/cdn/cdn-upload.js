
/**
 * cdn-upload.js - 图片上传到 CDN 命令
 *
 * 支持上传图片到阿里云 OSS，并通过 CDN 域名访问。
 *
 * 用法：
 *   yida cdn-upload <图片路径> [选项]
 *
 * 参数：
 *   图片路径          单个图片文件或目录（支持 glob 模式）
 *
 * 选项：
 *   --domain <域名>   CDN 加速域名（可选，使用配置文件中的域名）
 *   --path <路径>     上传目录前缀（可选，默认 yida-images/）
 *   --compress        启用图片压缩（默认启用）
 *   --no-compress     禁用图片压缩
 *
 * 示例：
 *   yida cdn-upload ./image.png
 *   yida cdn-upload ./images/*.png --domain cdn.example.com
 *   yida cdn-upload ./photo.jpg --path products/
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { t } = require('../core/i18n');
const {
  loadCdnConfig,
  validateCdnConfig,
  hasCdnConfig,
} = require('./cdn-config');

// 支持的图片格式
const SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];

/**
 * 解析命令行参数
 * @param {string[]} args
 * @returns {object}
 */
function parseArgs(args) {
  const result = {
    files: [],
    domain: null,
    uploadPath: null,
    compress: true,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--domain') {
      result.domain = args[++i];
    } else if (arg === '--path') {
      result.uploadPath = args[++i];
    } else if (arg === '--compress') {
      result.compress = true;
    } else if (arg === '--no-compress') {
      result.compress = false;
    } else if (!arg.startsWith('-')) {
      result.files.push(arg);
    }
  }

  return result;
}

/**
 * 打印帮助信息
 */
function printHelp() {
  console.log(t('cdn.upload_usage'));
  console.log('');
  console.log(t('cdn.upload_examples'));
  console.log('  yida cdn-upload ./image.png');
  console.log('  yida cdn-upload ./images/*.png --domain cdn.example.com');
  console.log('  yida cdn-upload ./photo.jpg --path products/');
  console.log('');
  console.log(t('cdn.upload_options'));
  console.log('  --domain <域名>   ' + t('cdn.upload_opt_domain'));
  console.log('  --path <路径>     ' + t('cdn.upload_opt_path'));
  console.log('  --compress        ' + t('cdn.upload_opt_compress'));
  console.log('  --no-compress     ' + t('cdn.upload_opt_no_compress'));
}

/**
 * 检查文件是否为支持的图片格式
 * @param {string} filePath
 * @returns {boolean}
 */
function isImageFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_FORMATS.includes(ext);
}

/**
 * 生成唯一文件名（保留原始扩展名）
 * @param {string} originalName
 * @returns {string}
 */
function generateUniqueFileName(originalName) {
  const ext = path.extname(originalName);
  const timestamp = Date.now();
  const randomStr = crypto.randomBytes(4).toString('hex');
  return `${timestamp}-${randomStr}${ext}`;
}

/**
 * 上传单个文件到 OSS
 * @param {object} ossClient - OSS 客户端实例
 * @param {string} filePath - 本地文件路径
 * @param {string} objectKey - OSS 对象键
 * @returns {Promise<object>}
 */
async function uploadToOss(ossClient, filePath, objectKey) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    ossClient.putStream(objectKey, stream, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * 创建 OSS 客户端（延迟加载 SDK）
 * @param {object} config
 * @returns {object}
 */
function createOssClient(config) {
  try {
    const OSS = require('ali-oss');
    return new OSS({
      region: config.ossRegion,
      bucket: config.ossBucket,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      secure: true,
    });
  } catch (error) {
    console.error(t('cdn.oss_sdk_required'));
    console.error(t('cdn.run_npm_install', 'ali-oss'));
    process.exit(1);
  }
}

/**
 * 执行上传操作
 * @param {object} options
 * @param {string[]} options.files - 文件列表
 * @param {string} options.domain - CDN 域名
 * @param {string} options.uploadPath - 上传路径前缀
 * @param {boolean} options.compress - 是否压缩
 * @returns {Promise<object[]>}
 */
async function performUpload(options) {
  const config = loadCdnConfig();
  const { valid, missing } = validateCdnConfig(config);

  if (!valid) {
    console.error(t('cdn.config_incomplete'));
    console.error(t('cdn.missing_fields', missing.join(', ')));
    console.error(t('cdn.run_config_init'));
    process.exit(1);
  }

  // 合并配置
  const uploadConfig = {
    ...config,
    cdnDomain: options.domain || config.cdnDomain,
    uploadPath: options.uploadPath || config.uploadPath,
  };

  // 创建 OSS 客户端
  const ossClient = createOssClient(uploadConfig);

  // 收集所有图片文件
  const imageFiles = [];
  for (const filePattern of options.files) {
    if (fs.existsSync(filePattern)) {
      const stat = fs.statSync(filePattern);
      if (stat.isDirectory()) {
        // 目录：遍历所有图片
        const files = fs.readdirSync(filePattern);
        for (const file of files) {
          const fullPath = path.join(filePattern, file);
          if (fs.statSync(fullPath).isFile() && isImageFile(fullPath)) {
            imageFiles.push(fullPath);
          }
        }
      } else if (stat.isFile() && isImageFile(filePattern)) {
        imageFiles.push(filePattern);
      }
    } else {
      // 可能是 glob 模式，尝试展开
      const glob = require('glob');
      const matches = glob.sync(filePattern);
      for (const match of matches) {
        if (fs.statSync(match).isFile() && isImageFile(match)) {
          imageFiles.push(match);
        }
      }
    }
  }

  if (imageFiles.length === 0) {
    console.error(t('cdn.no_images_found'));
    process.exit(1);
  }

  console.log(t('cdn.uploading_images', imageFiles.length));

  // 上传结果
  const results = [];

  for (const filePath of imageFiles) {
    const fileName = path.basename(filePath);
    const uniqueName = generateUniqueFileName(fileName);
    const objectKey = uploadConfig.uploadPath + uniqueName;

    try {
      console.log(t('cdn.uploading_file', fileName));

      // 上传到 OSS
      await uploadToOss(ossClient, filePath, objectKey);

      // 生成 CDN URL
      const cdnUrl = `https://${uploadConfig.cdnDomain}/${objectKey}`;

      results.push({
        originalPath: filePath,
        fileName,
        objectKey,
        cdnUrl,
        success: true,
      });

      console.log(t('cdn.upload_success', cdnUrl));
    } catch (error) {
      results.push({
        originalPath: filePath,
        fileName,
        success: false,
        error: error.message,
      });
      console.error(t('cdn.upload_failed', fileName, error.message));
    }
  }

  return results;
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

  if (options.files.length === 0) {
    console.error(t('cdn.upload_no_files'));
    printHelp();
    process.exit(1);
  }

  // 检查配置
  if (!hasCdnConfig()) {
    console.error(t('cdn.no_config'));
    console.error(t('cdn.run_config_init'));
    process.exit(1);
  }

  try {
    const results = await performUpload(options);

    // 输出汇总
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;

    console.log('');
    console.log(t('cdn.upload_summary'));
    console.log(t('cdn.upload_success_count', successCount));
    if (failCount > 0) {
      console.log(t('cdn.upload_fail_count', failCount));
    }

    // 输出 CDN URL 列表
    console.log('');
    console.log(t('cdn.cdn_urls'));
    for (const result of results) {
      if (result.success) {
        console.log(`  ${result.cdnUrl}`);
      }
    }

    // 返回 JSON 格式结果（供 AI 工具使用）
    console.log('');
    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    console.error(t('cdn.upload_error', error.message));
    process.exit(1);
  }
}

module.exports = { run, performUpload, parseArgs };
