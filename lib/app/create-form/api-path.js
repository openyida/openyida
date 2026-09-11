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
 * @param {'formdesign'|'formnav'} [options.queryModule] 查询模块，默认 formdesign
 * @param {string} [options.api]            页面请求标识，例如 Nav.update
 * @param {boolean} [options.mock]          是否使用 mock 接口
 * @param {boolean} [options.addTimestamp] 是否追加 _stamp 时间戳查询参数
 * @returns {string} 拼接完成的 API 请求路径
 */
function buildApiPath(appType, apiName, options = {}) {
  const {
    prefix = '',
    namespace = 'dingtalk',
    queryModule = 'formdesign',
    api,
    mock,
    addTimestamp = false,
  } = options;
  if (queryModule !== 'formdesign' && queryModule !== 'formnav') {
    throw new Error(`Unsupported query module: ${queryModule}`);
  }
  const prefixPath = prefix ? `/${prefix}` : '';
  const queryParams = [];
  if (api) {
    queryParams.push(`_api=${encodeURIComponent(api)}`);
  }
  if (mock !== undefined) {
    queryParams.push(`_mock=${String(Boolean(mock))}`);
  }
  if (addTimestamp) {
    queryParams.push(`_stamp=${Date.now()}`);
  }
  const query = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
  return `/${namespace}/web/${appType}${prefixPath}/query/${queryModule}/${apiName}.json${query}`;
}

module.exports = {
  buildApiPath,
};
