/**
 * 宜搭连接器 API 封装
 *
 * 复用 core/yida-client 的登录态、baseUrl、自动重登录与 HTTP 封装。
 * 提供连接器相关的所有 API 调用方法
 */

'use strict';

const { createAuthRef, createYidaClient } = require('../core/yida-client');
const {
  assertConnectorReadback,
  buildConnectorTestPayload,
} = require('./contract');

// ── 登录态获取 ────────────────────────────────────────

/**
 * 获取当前登录态，未登录则触发登录
 * @returns {{ baseUrl: string, authData: object }}
 */
function getAuthRef() {
  return createAuthRef();
}

// ── 打印表格 ──────────────────────────────────────────

/**
 * 打印 ASCII 表格
 * @param {string[]} headers - 表头
 * @param {Array[]} rows - 数据行
 */
function printTable(headers, rows) {
  const colWidths = headers.map((header, columnIndex) => {
    const maxDataWidth = rows.reduce((maxWidth, row) => {
      const cellText = String(row[columnIndex] || '');
      return Math.max(maxWidth, cellText.length);
    }, 0);
    return Math.max(header.length, maxDataWidth, 10);
  });

  const headerLine = headers.map((header, index) => header.padEnd(colWidths[index])).join(' | ');
  console.log(headerLine);
  console.log(colWidths.map(width => '-'.repeat(width)).join('-+-'));

  rows.forEach(row => {
    const line = row.map((cell, index) => {
      const cellText = String(cell || '');
      return cellText.length > colWidths[index]
        ? cellText.substring(0, colWidths[index] - 3) + '...'
        : cellText.padEnd(colWidths[index]);
    }).join(' | ');
    console.log(line);
  });
}

// ── 连接器描述构建 ────────────────────────────────────

/**
 * 根据动作列表生成一句话总结
 * @param {Array} operations - 动作列表
 * @returns {string}
 */
function buildOperationsSummary(operations) {
  if (!Array.isArray(operations) || operations.length === 0) {return '';}

  const summaries = operations
    .map(op => op.summary || op.name || op.operationId || op.id || op.url || op.path)
    .filter(Boolean);

  if (summaries.length === 0) {
    return '';
  }

  if (summaries.length === 1) {
    return `支持${summaries[0]}`;
  }

  const allText = summaries.join('、');
  return `支持${allText}等 ${summaries.length} 个操作`;
}

/**
 * 构建连接器描述（包含 openyida 元数据）
 * @param {string|null} userDesc - 用户自定义描述（可选）
 * @param {string|null} originalDesc - 原有描述（用于提取创建信息）
 * @param {object} authRef - 鉴权信息（含 authData）
 * @param {Array|null} operations - 当前所有动作列表
 * @returns {string}
 */
function buildConnectorDesc(userDesc, originalDesc, authRef, operations) {
  void authRef;
  const now = new Date();
  const updateTime = now.toLocaleString('zh-CN');

  let createTime = updateTime;

  if (originalDesc) {
    const createTimeMatch = originalDesc.match(/📅 创建时间: (.+)/);
    if (createTimeMatch) {createTime = createTimeMatch[1].trim();}
  }

  const metaInfo = [
    '',
    '---',
    '🤖 created by openyida',
    `📅 创建时间: ${createTime}`,
    `🔄 最近保存: ${updateTime}`,
  ].join('\n');

  let baseDesc = userDesc;
  if (!baseDesc && Array.isArray(operations) && operations.length > 0) {
    baseDesc = buildOperationsSummary(operations);
  }
  if (!baseDesc && originalDesc) {
    baseDesc = originalDesc.split('---')[0].trim();
  }

  return baseDesc ? `${baseDesc}${metaInfo}` : metaInfo.trim();
}

// ── API 请求封装 ──────────────────────────────────────

/**
 * 发送 GET 请求到宜搭连接器 API
 * @param {string} apiPath - API 路径（含 query string）
 * @param {object} authRef - 鉴权信息
 * @returns {Promise<object>}
 */
async function connectorGet(apiPath, authRef) {
  return createYidaClient({ authRef }).get(apiPath);
}

/**
 * 发送 POST 请求到宜搭连接器 API（application/x-www-form-urlencoded）
 * @param {string} apiPath - API 路径
 * @param {object} bodyParams - 请求体参数对象
 * @param {object} authRef - 鉴权信息
 * @returns {Promise<object>}
 */
async function connectorPost(apiPath, bodyParams, authRef) {
  return createYidaClient({ authRef }).postForm(apiPath, bodyParams);
}

async function connectorPostOnce(apiPath, bodyParams, authRef) {
  return createYidaClient({ authRef }).postFormOnce(apiPath, bodyParams);
}

async function connectorPostJsonOnce(apiPath, bodyParams, authRef) {
  return createYidaClient({ authRef }).postJsonOnce(apiPath, bodyParams);
}

// ── 连接器列表 ────────────────────────────────────────

/**
 * 获取连接器列表
 * @param {object} options - 查询选项
 * @param {string} [options.keyword] - 关键字过滤
 * @param {string} [options.type] - 连接器类型（mine/manager）
 * @param {string} [options.startDate] - 开始日期（YYYY-MM-DD）
 * @param {string} [options.endDate] - 结束日期（YYYY-MM-DD）
 * @param {number} [options.pageSize] - 每页数量
 * @param {object} authRef - 鉴权信息
 * @returns {Promise<Array>}
 */
async function listConnectors(options, authRef) {
  const pageSize = options.pageSize || 100;
  const currentPage = options.currentPage || 1;
  let apiPath = `/query/newconnector/listConnector.json?_api=ConnectorFactory.getConnectorList&pageSize=${pageSize}&currentPage=${currentPage}&connectorMode=5`;

  if (options.keyword) {
    apiPath += `&displayName=${encodeURIComponent(options.keyword)}`;
  }
  if (options.type) {
    apiPath += `&connectorType=${options.type}`;
  }
  if (options.startDate) {
    apiPath += `&startDate=${new Date(options.startDate).getTime()}`;
  }
  if (options.endDate) {
    apiPath += `&endDate=${new Date(options.endDate).getTime()}`;
  }

  const result = await connectorGet(apiPath, authRef);

  if (result.hasError) {
    throw new Error(result.errorMsg || '获取连接器列表失败');
  }

  return {
    connectors: result.content?.data || result.data || [],
    total: result.content?.totalElements || result.content?.totalCount || result.totalCount || 0,
  };
}

async function listAllConnectors(options, authRef) {
  const pageSize = options.pageSize || 100;
  const connectors = [];
  for (let currentPage = 1; currentPage <= 100; currentPage++) {
    const page = await listConnectors({ ...options, pageSize, currentPage }, authRef);
    connectors.push(...page.connectors);
    if (page.connectors.length < pageSize || (page.total > 0 && connectors.length >= page.total)) {
      return connectors;
    }
  }
  const error = new Error('Connector list exceeded the safe pagination limit.');
  error.code = 'CONNECTOR_LIST_PAGINATION_LIMIT';
  throw error;
}

/**
 * 通过 ID 查找连接器（从列表中匹配）
 * @param {string|number} connectorId
 * @param {object} authRef
 * @returns {Promise<object|null>}
 */
async function findConnectorById(connectorId, authRef) {
  const connectors = await listAllConnectors({ pageSize: 100 }, authRef);
  return connectors.find(c => String(c.id) === String(connectorId)) || null;
}

async function findConnectorByName(connectorName, authRef) {
  const connectors = await listAllConnectors({ pageSize: 100 }, authRef);
  return connectors.find(c => c.connectorName === connectorName) || null;
}

// ── 连接器详情 ────────────────────────────────────────

/**
 * 获取连接器详情
 * @param {string} connectorName - 连接器内部名称
 * @param {object} authRef
 * @returns {Promise<object>}
 */
async function getConnectorDetail(identity, authRef) {
  const params = typeof identity === 'object' && identity !== null
    ? identity
    : { connectorName: identity };
  const query = [
    '_api=ConnectorFactory.getConnectorDetail',
    params.id ? `id=${encodeURIComponent(params.id)}` : '',
    params.connectorName ? `connectorName=${encodeURIComponent(params.connectorName)}` : '',
    params.connectorMode ? `connectorMode=${encodeURIComponent(params.connectorMode)}` : '',
  ].filter(Boolean).join('&');
  const apiPath = `/query/newconnector/getConnectorDetail.json?${query}`;
  const result = await connectorGet(apiPath, authRef);

  if (result.hasError || !result.content) {
    throw new Error(result.errorMsg || '获取连接器详情失败');
  }

  return result.content.content || result.content;
}

// ── 创建/更新连接器 ───────────────────────────────────

/**
 * 创建或更新连接器
 * @param {object} params - 连接器参数
 * @param {object} authRef
 * @returns {Promise<object>}
 */
async function saveConnector(params, authRef) {
  // 注意：operations 必须放在 displayName 之前，否则宜搭服务端可能忽略该字段
  const bodyParams = {
    _locale_time_zone_offset: '28800000',
    operations: params.operations,
    displayName: params.displayName,
    iconUrl: params.iconUrl || 'chaxun%%#FFA200',
    connectorDesc: params.connectorDesc || '',
    host: params.host,
    baseUrl: params.baseUrl || '/',
    scheme: params.scheme || 'https',
    tongxunluTemplateId: params.tongxunluTemplateId || '',
    faasTemplateId: params.faasTemplateId || '0',
    securitySchemes: params.securitySchemes || '{}',
    connectorMode: params.connectorMode || '5',
    connectorName: params.connectorName,
    category: params.category || 'http',
  };

  if (params.id) {
    bodyParams.id = params.id;
  }

  const result = await connectorPostOnce(
    '/query/newconnector/createOrUpdateConnector.json?_api=ConnectorFactory.createOrUpdateConnector',
    bodyParams,
    authRef
  );

  if (result.hasError || !result.success) {
    throw new Error(result.errorMsg || result.message || '保存连接器失败');
  }

  const content = result.content;
  const connectorId = content && typeof content === 'object'
    ? content.id
    : (typeof content === 'string' || typeof content === 'number' ? content : null);
  const responseConnectorName = content && typeof content === 'object'
    ? content.connectorName
    : null;
  if (!connectorId && !responseConnectorName) {
    const error = new Error('Connector write succeeded without a recoverable identity.');
    error.code = 'CONNECTOR_WRITE_IDENTITY_MISSING';
    throw error;
  }

  const connectorName = responseConnectorName || params.connectorName;
  const detail = await getConnectorDetail({
    id: connectorId,
    connectorName,
    connectorMode: params.connectorMode || '5',
  }, authRef);
  assertConnectorReadback(params, detail);

  return {
    ...result,
    connectorId,
    connectorName,
    detail,
    readbackVerified: true,
  };
}

// ── 鉴权账号 ──────────────────────────────────────────

/**
 * 获取鉴权账号列表
 * @param {string} connectorName
 * @param {object} authRef
 * @returns {Promise<Array>}
 */
async function listConnectionsPage(connectorName, pageNumber, authRef) {
  const result = await connectorPost(
    '/query/connection/listConnection.json?_api=ConnectorFactory.listConnection',
    { pageSize: 100, pageNumber, connectorName },
    authRef
  );

  if (result.hasError) {
    throw new Error(result.errorMsg || '获取鉴权账号列表失败');
  }

  const connections = result.content?.data || result.data ||
    (Array.isArray(result.content) ? result.content : []);
  return {
    connections,
    total: result.content?.totalCount || result.content?.totalElements || result.totalCount || 0,
  };
}

async function listConnections(connectorName, authRef) {
  const page = await listConnectionsPage(connectorName, 1, authRef);
  return page.connections;
}

async function listAllConnections(connectorName, authRef) {
  const connections = [];
  for (let pageNumber = 1; pageNumber <= 100; pageNumber++) {
    const page = await listConnectionsPage(connectorName, pageNumber, authRef);
    connections.push(...page.connections);
    if (page.connections.length < 100 || (page.total > 0 && connections.length >= page.total)) {
      return connections;
    }
  }
  const error = new Error('Connection list exceeded the safe pagination limit.');
  error.code = 'CONNECTOR_CONNECTION_PAGINATION_LIMIT';
  throw error;
}

/**
 * 创建鉴权账号
 * @param {object} params
 * @param {object} authRef
 * @returns {Promise<object>}
 */
async function createConnection(params, authRef) {
  const before = await listAllConnections(params.connectorName, authRef);
  if (before.some(connection => connection.connectionName === params.connectionName)) {
    const error = new Error('A connection with the requested owned name already exists.');
    error.code = 'CONNECTOR_CONNECTION_NAME_EXISTS';
    throw error;
  }

  const bodyParams = {
    _locale_time_zone_offset: '28800000',
    connectionName: params.connectionName,
    securityValue: params.securityValue,
    connectorName: params.connectorName,
    securitySchemes: params.securitySchemes,
    authType: params.authType,
  };

  const result = await connectorPostOnce(
    '/query/newconnector/createConnection.json?_api=ConnectorFactory.createConnection',
    bodyParams,
    authRef
  );

  if (result.hasError || !result.success) {
    throw new Error(result.errorMsg || result.message || '创建鉴权账号失败');
  }

  const content = result.content;
  const connectionId = content && typeof content === 'object'
    ? (content.id || content.connectionId)
    : (typeof content === 'string' || typeof content === 'number' ? content : null);
  const beforeIds = new Set(before.map(connection => String(connection.id || connection.connectionId)));
  const after = await listAllConnections(params.connectorName, authRef);
  const matches = after.filter(connection => {
    const id = connection.id || connection.connectionId;
    if (connectionId) {
      return String(id) === String(connectionId) && connection.connectionName === params.connectionName;
    }
    return connection.connectionName === params.connectionName && !beforeIds.has(String(id));
  });
  if (matches.length !== 1) {
    const error = new Error('Connection creation could not be recovered by an exact owned readback.');
    error.code = 'CONNECTOR_CONNECTION_READBACK_MISMATCH';
    throw error;
  }

  return { ...matches[0], readbackVerified: true };
}

// ── 连接器测试 ────────────────────────────────────────

/**
 * 测试连接器执行动作
 * @param {object} params
 * @param {object} authRef
 * @returns {Promise<object>}
 */
async function testConnector(params, authRef) {
  const result = await connectorPostJsonOnce(
    '/query/newconnector/testOperation.json',
    buildConnectorTestPayload(params),
    authRef
  );

  return result;
}

module.exports = {
  getAuthRef,
  printTable,
  buildConnectorDesc,
  buildOperationsSummary,
  connectorGet,
  connectorPost,
  connectorPostOnce,
  connectorPostJsonOnce,
  listConnectors,
  listAllConnectors,
  findConnectorById,
  findConnectorByName,
  getConnectorDetail,
  saveConnector,
  listConnections,
  listAllConnections,
  createConnection,
  testConnector,
};
