/**
 * Curl 命令解析模块
 */

/**
 * 解析 curl 命令
 * @param {string} curlCommand - curl 命令字符串
 * @returns {Object} 解析结果
 */
function parseCurl(curlCommand) {
  const result = {
    url: '',
    method: 'GET',
    headers: {},
    body: null,
    protocol: 'https',
    host: '',
    path: ''
  };

  try {
    // 提取 URL
    const urlMatch = curlCommand.match(/curl\s+['"]([^'"]+)['"]/);
    if (urlMatch) {
      result.url = urlMatch[1];
      const url = new URL(result.url);
      result.protocol = url.protocol.replace(':', '');
      result.host = url.hostname;
      result.path = url.pathname + url.search;
    }

    // 提取方法
    const methodMatch = curlCommand.match(/-X\s+(\w+)/);
    if (methodMatch) {
      result.method = methodMatch[1].toUpperCase();
    } else if (curlCommand.includes('--data') || curlCommand.includes('-d')) {
      result.method = 'POST';
    }

    // 提取 headers
    const headerMatches = curlCommand.matchAll(/-H\s+['"]([^:]+):\s*([^'"]+)['"]/g);
    for (const match of headerMatches) {
      result.headers[match[1]] = match[2].trim();
    }

    // 提取 body
    const bodyMatch = curlCommand.match(/--data(?:-raw)?\s+['"]([\s\S]*?)['"](?:\s+-H|\s+--|\s*$)/);
    if (bodyMatch) {
      result.body = bodyMatch[1];
    }

    return result;
  } catch (error) {
    throw new Error(`解析 curl 命令失败: ${error.message}`);
  }
}

/**
 * 从 headers 中检测鉴权方式
 * @param {Object} headers - 请求头对象
 * @returns {Object} 鉴权类型信息
 */
function detectAuthType(headers) {
  const authHeader = headers['Authorization'] || headers['authorization'];

  if (authHeader) {
    if (authHeader.startsWith('Bearer')) {
      return { type: 'API密钥', code: 'ApiKeyAuth', headerName: 'Authorization' };
    }
    if (authHeader.startsWith('Basic')) {
      return { type: '基本身份验证', code: 'BasicAuth', headerName: 'Authorization' };
    }
  }

  if (headers['x-acs-dingtalk-access-token']) {
    return { type: '钉钉开放平台验证', code: 'DingAuth', headerName: 'x-acs-dingtalk-access-token' };
  }

  const apiKeyHeaders = Object.keys(headers).filter(h =>
    h.toLowerCase().includes('api-key') ||
    h.toLowerCase().includes('apikey') ||
    h.toLowerCase().includes('x-api')
  );

  if (apiKeyHeaders.length > 0) {
    return { type: 'API密钥', code: 'ApiKeyAuth', headerName: apiKeyHeaders[0] };
  }

  return { type: '无身份验证', code: 'NONE', headerName: '' };
}

/**
 * 定义需要过滤掉的浏览器自动添加的 headers
 */
const BROWSER_HEADERS = [
  'accept', 'accept-language', 'accept-encoding', 'connection',
  'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
  'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site',
  'user-agent', 'priority', 'referer', 'origin',
  'cache-control', 'pragma', 'dnt', 'upgrade-insecure-requests'
];

/**
 * 过滤浏览器自动添加的 headers
 * @param {Object} headers - 原始 headers
 * @returns {Array} 过滤后的 headers 数组 [{name, value}]
 */
function filterBrowserHeaders(headers) {
  return Object.entries(headers).filter(([key]) => {
    const lowerKey = key.toLowerCase();
    return !BROWSER_HEADERS.includes(lowerKey) &&
           lowerKey !== 'content-type' &&
           !lowerKey.startsWith('sec-');
  });
}

module.exports = {
  parseCurl,
  detectAuthType,
  filterBrowserHeaders,
  BROWSER_HEADERS
};
