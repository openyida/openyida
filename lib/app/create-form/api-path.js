'use strict';

/**
 * create-form/api-path.js
 *
 * 接口路径生成：构建宜搭表单设计相关的 API 请求路径。
 *
 * @param {string} appType         应用标识（appType）
 * @param {string} apiName         接口名称（不含扩展名），如 saveFormSchema
 * @param {object} [options]       可选项
 * @param {string} [options.prefix]        额外的路径前缀（会以 / 拼接）
 * @param {string} [options.namespace]     命名空间，默认 dingtalk
 * @param {boolean} [options.addTimestamp] 是否追加 _stamp 时间戳查询参数
 * @returns {string} 拼接完成的 API 请求路径
 */
function buildApiPath(appType, apiName, options = {}) {
  const { prefix = '', namespace = 'dingtalk', addTimestamp = false } = options;
  const prefixPath = prefix ? `/${prefix}` : '';
  const timestamp = addTimestamp ? `?_stamp=${Date.now()}` : '';
  return `/${namespace}/web/${appType}${prefixPath}/query/formdesign/${apiName}.json${timestamp}`;
}

module.exports = {
  buildApiPath,
};
