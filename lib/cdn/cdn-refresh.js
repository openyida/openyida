
/**
 * cdn-refresh.js - CDN 缓存刷新命令
 *
 * 支持刷新阿里云 CDN 节点上的缓存，确保用户访问到最新内容。
 *
 * 用法：
 *   yida cdn-refresh [选项]
 *
 * 选项：
 *   --urls <URL列表>    刷新的 URL 列表（逗号分隔）
 *   --paths <路径列表>  刷新的目录路径列表（逗号分隔）
 *   --file <文件>       从文件读取 URL 列表（每行一个）
 *
 * 示例：
 *   yida cdn-refresh --urls "https://cdn.example.com/image1.png,https://cdn.example.com/image2.png"
 *   yida cdn-refresh --paths "/yida-images/"
 *   yida cdn-refresh --file urls.txt
 */

'use strict';

const fs = require('fs');
const { t } = require('../core/i18n');
const { loadCdnConfig, validateCdnConfig, hasCdnConfig } = require('./cdn-config');

/**
 * 解析命令行参数
 * @param {string[]} args
 * @returns {object}
 */
function parseArgs(args) {
  const result = {
    urls: [],
    paths: [],
    file: null,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--urls') {
      result.urls = (args[++i] || '').split(',').map((u) => u.trim()).filter(Boolean);
    } else if (arg === '--paths') {
      result.paths = (args[++i] || '').split(',').map((p) => p.trim()).filter(Boolean);
    } else if (arg === '--file') {
      result.file = args[++i];
    }
  }

  return result;
}

/**
 * 打印帮助信息
 */
function printHelp() {
  console.log(t('cdn.refresh_usage'));
  console.log('');
  console.log(t('cdn.refresh_examples'));
  console.log('  yida cdn-refresh --urls "https://cdn.example.com/image.png"');
  console.log('  yida cdn-refresh --paths "/yida-images/"');
  console.log('  yida cdn-refresh --file urls.txt');
  console.log('');
  console.log(t('cdn.refresh_options'));
  console.log('  --urls <URL列表>    ' + t('cdn.refresh_opt_urls'));
  console.log('  --paths <路径列表>  ' + t('cdn.refresh_opt_paths'));
  console.log('  --file <文件>       ' + t('cdn.refresh_opt_file'));
}

/**
 * 创建 CDN 客户端（延迟加载 SDK）
 * @param {object} config
 * @returns {object}
 */
function createCdnClient(config) {
  try {
    const Cdn = require('@alicloud/cdn20180510').default;
    const OpenApi = require('@alicloud/openapi-client');

    const openApiConfig = new OpenApi.Config({
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
    });
    openApiConfig.endpoint = 'cdn.aliyuncs.com';

    return new Cdn(openApiConfig);
  } catch (error) {
    console.error(t('cdn.cdn_sdk_required'));
    console.error(t('cdn.run_npm_install', '@alicloud/cdn20180510 @alicloud/openapi-client'));
    process.exit(1);
  }
}

/**
 * 刷新 URL 缓存
 * @param {object} cdnClient - CDN 客户端
 * @param {string[]} urls - URL 列表
 * @returns {Promise<object>}
 */
async function refreshUrls(cdnClient, urls) {
  const Cdn = require('@alicloud/cdn20180510');
  const request = new Cdn.RefreshObjectCachesRequest({
    objectPath: urls.join('\n'),
    objectType: 'File',
  });

  const response = await cdnClient.refreshObjectCaches(request);
  return response.body;
}

/**
 * 刷新目录缓存
 * @param {object} cdnClient - CDN 客户端
 * @param {string[]} paths - 目录路径列表
 * @returns {Promise<object>}
 */
async function refreshPaths(cdnClient, paths) {
  const Cdn = require('@alicloud/cdn20180510');
  const request = new Cdn.RefreshObjectCachesRequest({
    objectPath: paths.join('\n'),
    objectType: 'Directory',
  });

  const response = await cdnClient.refreshObjectCaches(request);
  return response.body;
}

/**
 * 查询刷新配额
 * @param {object} cdnClient - CDN 客户端
 * @returns {Promise<object>}
 */
async function describeRefreshQuota(cdnClient) {
  const response = await cdnClient.describeRefreshQuota();
  return response.body;
}

/**
 * 查询刷新任务状态
 * @param {object} cdnClient - CDN 客户端
 * @param {string} taskId - 任务 ID
 * @returns {Promise<object>}
 */
async function describeRefreshTasks(cdnClient, taskId) {
  const Cdn = require('@alicloud/cdn20180510');
  const request = new Cdn.DescribeRefreshTasksRequest({
    taskId,
  });
  const response = await cdnClient.describeRefreshTasks(request);
  return response.body;
}

/**
 * 执行刷新操作
 * @param {object} options
 * @returns {Promise<object>}
 */
async function performRefresh(options) {
  const config = loadCdnConfig();
  const { valid, missing } = validateCdnConfig(config);

  if (!valid) {
    console.error(t('cdn.config_incomplete'));
    console.error(t('cdn.missing_fields', missing.join(', ')));
    console.error(t('cdn.run_config_init'));
    process.exit(1);
  }

  // 创建 CDN 客户端
  const cdnClient = createCdnClient(config);

  // 从文件读取 URL
  let urls = [...options.urls];
  if (options.file) {
    if (!fs.existsSync(options.file)) {
      console.error(t('cdn.file_not_found', options.file));
      process.exit(1);
    }
    const content = fs.readFileSync(options.file, 'utf-8');
    const fileUrls = content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    urls = urls.concat(fileUrls);
  }

  const results = {
    urlRefresh: null,
    pathRefresh: null,
    quota: null,
  };

  // 查询配额
  try {
    console.log(t('cdn.querying_quota'));
    results.quota = await describeRefreshQuota(cdnClient);
    console.log(t('cdn.quota_info',
      results.quota.UrlQuota,
      results.quota.UrlRemain,
      results.quota.DirQuota,
      results.quota.DirRemain
    ));
  } catch (error) {
    console.error(t('cdn.quota_query_failed', error.message));
  }

  // 刷新 URL
  if (urls.length > 0) {
    console.log(t('cdn.refreshing_urls', urls.length));
    try {
      results.urlRefresh = await refreshUrls(cdnClient, urls);
      console.log(t('cdn.refresh_task_id', results.urlRefresh.refreshTaskId));
    } catch (error) {
      console.error(t('cdn.refresh_urls_failed', error.message));
      results.urlRefresh = { error: error.message };
    }
  }

  // 刷新目录
  if (options.paths.length > 0) {
    console.log(t('cdn.refreshing_paths', options.paths.length));
    try {
      results.pathRefresh = await refreshPaths(cdnClient, options.paths);
      console.log(t('cdn.refresh_task_id', results.pathRefresh.refreshTaskId));
    } catch (error) {
      console.error(t('cdn.refresh_paths_failed', error.message));
      results.pathRefresh = { error: error.message };
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

  if (options.urls.length === 0 && options.paths.length === 0 && !options.file) {
    console.error(t('cdn.refresh_no_targets'));
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
    const results = await performRefresh(options);

    // 输出汇总
    console.log('');
    console.log(t('cdn.refresh_summary'));

    if (results.urlRefresh && !results.urlRefresh.error) {
      console.log(t('cdn.url_refresh_success', results.urlRefresh.refreshTaskId));
    }
    if (results.pathRefresh && !results.pathRefresh.error) {
      console.log(t('cdn.path_refresh_success', results.pathRefresh.refreshTaskId));
    }

    // 返回 JSON 格式结果
    console.log('');
    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    console.error(t('cdn.refresh_error', error.message));
    process.exit(1);
  }
}

module.exports = {
  run,
  performRefresh,
  refreshUrls,
  refreshPaths,
  describeRefreshQuota,
  describeRefreshTasks,
};
