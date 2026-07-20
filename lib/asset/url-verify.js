
/**
 * url-verify.js - 轻量公开图库 / 图片 URL 校验
 *
 * P3 素材工具化：官网/落地页在使用外部公开图片前，必须先校验该 URL 是否
 * 真实可达、且确为图片资源，避免把编造或失效的 URL 直接写进页面。
 *
 * 仅使用 Node 原生 https/http，无第三方依赖。
 *
 * 用法：
 *   const { verifyImageUrl, verifyImageUrls } = require('./url-verify');
 *   const r = await verifyImageUrl('https://example.com/a.png');
 *   // { url, ok, status, contentType, bytes, reason }
 */

'use strict';

const https = require('https');
const http = require('http');
const { URL } = require('url');

const IMAGE_CONTENT_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'image/webp', 'image/bmp', 'image/svg+xml', 'image/avif',
];
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|svg|avif)(\?|#|$)/i;

const DEFAULT_TIMEOUT = 8000;
const MAX_REDIRECTS = 4;

/**
 * 判断 content-type 是否为图片
 * @param {string} contentType
 * @returns {boolean}
 */
function isImageContentType(contentType) {
  if (!contentType) {return false;}
  const main = String(contentType).split(';')[0].trim().toLowerCase();
  return IMAGE_CONTENT_TYPES.includes(main);
}

/**
 * 发起一次请求（HEAD 或 GET），返回 { status, headers, location }
 * GET 时在拿到响应头后立即 destroy，避免下载完整图片。
 * @param {string} rawUrl
 * @param {object} opts
 * @returns {Promise<{status:number, headers:object}>}
 */
function requestOnce(rawUrl, opts) {
  const method = (opts && opts.method) || 'HEAD';
  const timeout = (opts && opts.timeout) || DEFAULT_TIMEOUT;

  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch (err) {
      reject(new Error('INVALID_URL'));
      return;
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      reject(new Error('UNSUPPORTED_PROTOCOL'));
      return;
    }

    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request(
      parsed,
      {
        method,
        // 部分 CDN 对无 UA 的请求返回 403，带一个常规 UA 更接近真实浏览器访问
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; OpenYidaAssetVerifier/1.0)',
          Accept: 'image/*,*/*;q=0.8',
        },
      },
      (res) => {
        // GET 请求：拿到响应头即可，无需读 body
        if (method === 'GET') {
          res.destroy();
        }
        resolve({ status: res.statusCode || 0, headers: res.headers || {} });
      }
    );

    req.setTimeout(timeout, () => {
      req.destroy(new Error('TIMEOUT'));
    });
    req.on('error', (err) => reject(err));
    req.end();
  });
}

/**
 * 跟随重定向发起请求
 * @param {string} rawUrl
 * @param {object} opts
 * @param {number} depth
 * @returns {Promise<{status:number, headers:object, finalUrl:string}>}
 */
async function requestFollow(rawUrl, opts, depth = 0) {
  const res = await requestOnce(rawUrl, opts);
  const status = res.status;
  if (status >= 300 && status < 400 && res.headers.location && depth < MAX_REDIRECTS) {
    const next = new URL(res.headers.location, rawUrl).toString();
    return requestFollow(next, opts, depth + 1);
  }
  return { ...res, finalUrl: rawUrl };
}

/**
 * 校验单个图片 URL
 * @param {string} rawUrl
 * @param {object} [options]
 * @param {number} [options.timeout]
 * @param {number} [options.minBytes] 最小字节数（默认 0，不限制）
 * @returns {Promise<{url:string, ok:boolean, status:number, contentType:string, bytes:number, reason:string, finalUrl:string}>}
 */
async function verifyImageUrl(rawUrl, options = {}) {
  const base = {
    url: rawUrl,
    ok: false,
    status: 0,
    contentType: '',
    bytes: 0,
    reason: '',
    finalUrl: rawUrl,
  };

  if (!rawUrl || typeof rawUrl !== 'string') {
    return { ...base, reason: 'EMPTY_URL' };
  }
  const trimmed = rawUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return { ...base, url: trimmed, reason: 'NOT_HTTP_URL' };
  }

  const minBytes = options.minBytes || 0;

  let res;
  try {
    res = await requestFollow(trimmed, { method: 'HEAD', timeout: options.timeout });
    // 某些服务器不支持 HEAD（405/501）或返回异常 → 回退 GET
    if (res.status === 405 || res.status === 501 || res.status === 0) {
      res = await requestFollow(trimmed, { method: 'GET', timeout: options.timeout });
    }
  } catch (err) {
    // HEAD 报错时再尝试一次 GET，避免部分 CDN 对 HEAD 直接断连
    try {
      res = await requestFollow(trimmed, { method: 'GET', timeout: options.timeout });
    } catch (err2) {
      return { ...base, url: trimmed, reason: normalizeError(err2) };
    }
  }

  const contentType = String(res.headers['content-type'] || '').split(';')[0].trim();
  const bytes = Number(res.headers['content-length'] || 0) || 0;
  const out = {
    url: trimmed,
    ok: false,
    status: res.status,
    contentType,
    bytes,
    reason: '',
    finalUrl: res.finalUrl || trimmed,
  };

  if (res.status < 200 || res.status >= 400) {
    out.reason = 'HTTP_' + res.status;
    return out;
  }

  // content-type 优先；缺失时用扩展名兜底判断
  const typeOk = isImageContentType(contentType);
  const extOk = IMAGE_EXT.test(trimmed);
  if (!typeOk && !(contentType === '' && extOk)) {
    out.reason = contentType ? 'NOT_IMAGE_CONTENT_TYPE' : 'UNKNOWN_CONTENT_TYPE';
    return out;
  }

  if (minBytes > 0 && bytes > 0 && bytes < minBytes) {
    out.reason = 'TOO_SMALL';
    return out;
  }

  out.ok = true;
  out.reason = 'OK';
  return out;
}

/**
 * 批量校验（并发）
 * @param {string[]} urls
 * @param {object} [options]
 * @returns {Promise<Array>}
 */
async function verifyImageUrls(urls, options = {}) {
  const list = Array.isArray(urls) ? urls : [urls];
  return Promise.all(list.map((u) => verifyImageUrl(u, options)));
}

function normalizeError(err) {
  const msg = (err && err.message) || String(err);
  if (msg === 'TIMEOUT') {return 'TIMEOUT';}
  if (msg === 'INVALID_URL') {return 'INVALID_URL';}
  if (msg === 'UNSUPPORTED_PROTOCOL') {return 'UNSUPPORTED_PROTOCOL';}
  if (err && err.code) {return err.code;} // ENOTFOUND / ECONNREFUSED / CERT_...
  return 'REQUEST_FAILED';
}

module.exports = {
  verifyImageUrl,
  verifyImageUrls,
  isImageContentType,
  IMAGE_CONTENT_TYPES,
};
