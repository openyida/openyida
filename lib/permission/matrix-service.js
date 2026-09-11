/**
 * matrix-service.js - 宜搭权限矩阵查询服务
 *
 * 提供权限矩阵列表查询与单个矩阵详情查询，供 save-permission 等命令使用。
 */
'use strict';

const { createAuthRef, createYidaClient } = require('../core/yida-client');

/**
 * 查询权限矩阵列表
 *
 * @param {object} authRef - 认证引用对象
 * @param {object} options - 查询选项
 * @param {string} [options.keyword] - 搜索关键词
 * @param {number} [options.page=1] - 页码
 * @param {number} [options.limit=10] - 每页条数
 * @returns {Promise<Array>} 权限矩阵列表
 */
async function getMatrixList(authRef, options = {}) {
  const ref = authRef || createAuthRef();
  const { keyword = '', page = 1, limit = 10 } = options;
  const client = createYidaClient({ authRef: ref });
  const result = await client.getContent('/query/matrix/getMatrixList.json', {
    keyword,
    page,
    limit,
  }, {
    action: 'getMatrixList',
    failMessage: '获取权限矩阵列表失败',
  });
  return (result && result.data) || [];
}

/**
 * 根据 ID 查询单个权限矩阵详情
 *
 * @param {object} authRef - 认证引用对象
 * @param {string} matrixId - 权限矩阵 ID
 * @returns {Promise<object>} 权限矩阵详情
 */
async function getMatrixById(authRef, matrixId) {
  const ref = authRef || createAuthRef();
  const client = createYidaClient({ authRef: ref });
  return client.getContent('/query/matrix/getMatrixById.json', {
    matrixId,
  }, {
    action: 'getMatrixById',
    failMessage: `获取权限矩阵 ${matrixId} 详情失败`,
  });
}

module.exports = {
  getMatrixList,
  getMatrixById,
};
