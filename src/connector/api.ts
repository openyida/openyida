/**
 * 宜搭连接器 API 封装
 *
 * 复用 lib/utils.js 的登录态管理（loadCookieData / httpPost / httpGet / requestWithAutoLogin）
 * 提供连接器相关的所有 API 调用方法
 */

import querystring from 'querystring';
import {
  loadCookieData,
  triggerLogin,
  resolveBaseUrl,
  httpPost,
  httpGet,
  requestWithAutoLogin,
} from '../core/utils';

// ── 类型定义 ────────────────────────────────────────────

interface CookieData {
  csrf_token?: string;
  cookies?: any[];
  user_id?: string;
  [key: string]: any;
}

interface AuthRef {
  csrfToken: string;
  cookies: any[];
  baseUrl: string;
  cookieData: CookieData;
}

interface ListConnectorsOptions {
  keyword?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  pageSize?: number;
}

interface Connector {
  id?: string | number;
  displayName?: string;
  connectorName?: string;
  connectorDesc?: string;
  creator?: string;
  host?: string;
  securitySchemes?: string;
  [key: string]: any;
}

interface ListConnectorsResult {
  connectors: Connector[];
  total: number;
}

interface SaveConnectorParams {
  operations?: string;
  displayName?: string;
  iconUrl?: string;
  connectorDesc?: string;
  host?: string;
  baseUrl?: string;
  scheme?: string;
  tongxunluTemplateId?: string;
  faasTemplateId?: string;
  securitySchemes?: string;
  connectorMode?: string;
  connectorName?: string;
  category?: string;
  id?: string | number;
}

interface CreateConnectionParams {
  connectionName: string;
  securityValue: string;
  connectorName: string;
  securitySchemes: string;
  authType: number;
}

interface TestConnectorParams {
  connectorId: string | number;
  operationId: string;
  header?: Record<string, string>;
  query?: Record<string, any>;
  body?: any;
  authId?: string;
}

// ── 登录态获取 ────────────────────────────────────────

/**
 * 获取当前登录态，未登录则触发登录
 */
function getAuthRef(): AuthRef {
  let cookieData = loadCookieData();
  if (!cookieData || !cookieData.cookies) {
    cookieData = triggerLogin();
  }

  return {
    csrfToken: cookieData.csrf_token || '',
    cookies: cookieData.cookies || [],
    baseUrl: resolveBaseUrl(cookieData),
    cookieData,
  };
}

// ── 打印表格 ──────────────────────────────────────────

/**
 * 打印 ASCII 表格
 */
function printTable(headers: string[], rows: any[][]): void {
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
 */
function buildOperationsSummary(operations: any[]): string {
  if (!Array.isArray(operations) || operations.length === 0) {return '';}

  const summaries = operations.map(op => op.summary || op.operationId);

  if (summaries.length === 1) {
    return `支持${summaries[0]}`;
  }

  const allText = summaries.join('、');
  return `支持${allText}等 ${summaries.length} 个操作`;
}

/**
 * 构建连接器描述（包含 openyida 元数据）
 */
function buildConnectorDesc(
  userDesc: string | null,
  originalDesc: string | null,
  authRef: AuthRef,
  operations: any[] | null
): string {
  const now = new Date();
  const updateTime = now.toLocaleString('zh-CN');
  const currentUserId = authRef.cookieData && authRef.cookieData.user_id
    ? authRef.cookieData.user_id
    : '';

  let createTime = updateTime;
  let createUserId = currentUserId;

  if (originalDesc) {
    const createTimeMatch = originalDesc.match(/📅 创建时间: (.+)/);
    const createUserMatch = originalDesc.match(/👤 创建人: (.+)/);
    if (createTimeMatch) {createTime = createTimeMatch[1].trim();}
    if (createUserMatch) {createUserId = createUserMatch[1].trim();}
  }

  const metaInfo = [
    '',
    '---',
    '🤖 created by openyida',
    `👤 创建人: ${createUserId}`,
    `📅 创建时间: ${createTime}`,
    `✏️ 最近修改人: ${currentUserId}`,
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
 */
async function connectorGet(apiPath: string, authRef: AuthRef): Promise<any> {
  return requestWithAutoLogin(
    (ref) => httpGet(ref.baseUrl, apiPath, null, ref.cookies),
    authRef as any
  );
}

/**
 * 发送 POST 请求到宜搭连接器 API（application/x-www-form-urlencoded）
 */
async function connectorPost(apiPath: string, bodyParams: Record<string, any>, authRef: AuthRef): Promise<any> {
  const postData = querystring.stringify(bodyParams);
  return requestWithAutoLogin(
    (ref) => httpPost(ref.baseUrl, apiPath, postData, ref.cookies),
    authRef as any
  );
}

// ── 连接器列表 ────────────────────────────────────────

/**
 * 获取连接器列表
 */
async function listConnectors(options: ListConnectorsOptions, authRef: AuthRef): Promise<ListConnectorsResult> {
  const pageSize = options.pageSize || 100;
  let apiPath = `/query/newconnector/listConnector.json?_api=ConnectorFactory.getConnectorList&pageSize=${pageSize}&currentPage=1&connectorMode=5`;

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
    total: result.content?.totalElements || 0,
  };
}

/**
 * 通过 ID 查找连接器（从列表中匹配）
 */
async function findConnectorById(connectorId: string | number, authRef: AuthRef): Promise<Connector | null> {
  const { connectors } = await listConnectors({ pageSize: 100 }, authRef);
  return connectors.find(c => String(c.id) === String(connectorId)) || null;
}

// ── 连接器详情 ────────────────────────────────────────

/**
 * 获取连接器详情
 */
async function getConnectorDetail(connectorName: string, authRef: AuthRef): Promise<any> {
  const apiPath = `/query/newconnector/getConnectorDetail.json?_api=ConnectorFactory.getConnectorDetail&connectorName=${connectorName}`;
  const result = await connectorGet(apiPath, authRef);

  if (result.hasError || !result.content) {
    throw new Error(result.errorMsg || '获取连接器详情失败');
  }

  return result.content.content || result.content;
}

// ── 创建/更新连接器 ───────────────────────────────────

/**
 * 创建或更新连接器
 */
async function saveConnector(params: SaveConnectorParams, authRef: AuthRef): Promise<any> {
  // 注意：operations 必须放在 displayName 之前，否则宜搭服务端可能忽略该字段
  const bodyParams: Record<string, any> = {
    _csrf_token: authRef.csrfToken,
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

  const result = await connectorPost(
    '/query/newconnector/createOrUpdateConnector.json?_api=ConnectorFactory.createOrUpdateConnector',
    bodyParams,
    authRef
  );

  if (result.hasError || !result.success) {
    throw new Error(result.errorMsg || result.message || '保存连接器失败');
  }

  // 返回连接器 ID（新建时服务端在 content 中返回）
  const connectorId = result.content?.id || result.content || null;
  return { ...result, connectorId };
}

// ── 鉴权账号 ──────────────────────────────────────────

/**
 * 获取鉴权账号列表
 */
async function listConnections(connectorName: string, authRef: AuthRef): Promise<any[]> {
  const apiPath = `/query/connection/listConnection.json?_api=ConnectorFactory.listConnection&connectorName=${connectorName}`;
  const result = await connectorGet(apiPath, authRef);

  if (result.hasError) {
    throw new Error(result.errorMsg || '获取鉴权账号列表失败');
  }

  return result.content?.data || result.content || [];
}

/**
 * 创建鉴权账号
 */
async function createConnection(params: CreateConnectionParams, authRef: AuthRef): Promise<any> {
  const bodyParams: Record<string, any> = {
    _csrf_token: authRef.csrfToken,
    _locale_time_zone_offset: '28800000',
    connectionName: params.connectionName,
    securityValue: params.securityValue,
    connectorName: params.connectorName,
    securitySchemes: params.securitySchemes,
    authType: params.authType,
  };

  const result = await connectorPost(
    '/query/newconnector/createConnection.json?_api=ConnectorFactory.createConnection',
    bodyParams,
    authRef
  );

  if (result.hasError || !result.success) {
    throw new Error(result.errorMsg || result.message || '创建鉴权账号失败');
  }

  return result.content || result;
}

// ── 连接器测试 ────────────────────────────────────────

/**
 * 测试连接器执行动作
 */
async function testConnector(params: TestConnectorParams, authRef: AuthRef): Promise<any> {
  const bodyParams: Record<string, any> = {
    _csrf_token: authRef.csrfToken,
    _locale_time_zone_offset: '28800000',
    connectorId: params.connectorId,
    operationId: params.operationId,
    header: JSON.stringify(params.header || {}),
    query: JSON.stringify(params.query || {}),
    body: JSON.stringify(params.body || {}),
    authId: params.authId || '',
  };

  const result = await connectorPost(
    '/query/newconnector/testConnector.json?_api=ConnectorFactory.testConnector',
    bodyParams,
    authRef
  );

  return result;
}

export {
  getAuthRef,
  printTable,
  buildConnectorDesc,
  buildOperationsSummary,
  connectorGet,
  connectorPost,
  listConnectors,
  findConnectorById,
  getConnectorDetail,
  saveConnector,
  listConnections,
  createConnection,
  testConnector,
};
