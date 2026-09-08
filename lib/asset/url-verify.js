'use strict';

const https = require('https');
const http = require('http');
const { URL } = require('url');
const { MAX_HEADER_BYTES, parseImageMetadata } = require('./image-metadata');

const IMAGE_CONTENT_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'image/webp', 'image/bmp', 'image/svg+xml', 'image/avif',
];
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|svg|avif)(\?|#|$)/i;
const DEFAULT_TIMEOUT = 8000;
const MAX_REDIRECTS = 4;

function isImageContentType(contentType) {
  if (!contentType) {return false;}
  const main = String(contentType).split(';')[0].trim().toLowerCase();
  return IMAGE_CONTENT_TYPES.includes(main);
}

function requestOnce(rawUrl, options = {}) {
  const method = options.method || 'GET';
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      reject(new Error('INVALID_URL'));
      return;
    }
    if (!['https:', 'http:'].includes(parsed.protocol)) {
      reject(new Error('UNSUPPORTED_PROTOCOL'));
      return;
    }

    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request(parsed, {
      method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OpenYidaAssetVerifier/1.0)',
        Accept: 'image/*,*/*;q=0.8',
        ...(method === 'GET' ? { Range: `bytes=0-${MAX_HEADER_BYTES - 1}` } : {}),
      },
    }, (res) => {
      if (method !== 'GET') {
        resolve({ status: res.statusCode || 0, headers: res.headers || {}, body: Buffer.alloc(0) });
        return;
      }
      const chunks = [];
      let bytes = 0;
      let settled = false;
      const finish = () => {
        if (settled) {return;}
        settled = true;
        resolve({
          status: res.statusCode || 0,
          headers: res.headers || {},
          body: Buffer.concat(chunks, bytes),
        });
      };
      res.on('data', (chunk) => {
        const remaining = MAX_HEADER_BYTES - bytes;
        if (remaining <= 0) {return;}
        const part = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
        chunks.push(part);
        bytes += part.length;
        if (bytes >= MAX_HEADER_BYTES) {
          finish();
          res.destroy();
        }
      });
      res.on('end', finish);
      res.on('error', reject);
    });
    req.setTimeout(timeout, () => req.destroy(new Error('TIMEOUT')));
    req.on('error', reject);
    req.end();
  });
}

async function requestFollow(rawUrl, options, depth = 0) {
  const response = await requestOnce(rawUrl, options);
  if (response.status >= 300 && response.status < 400 && response.headers.location && depth < MAX_REDIRECTS) {
    const next = new URL(response.headers.location, rawUrl).toString();
    return requestFollow(next, options, depth + 1);
  }
  return { ...response, finalUrl: rawUrl };
}

async function verifyImageUrl(rawUrl, options = {}) {
  const base = {
    url: rawUrl,
    ok: false,
    status: 0,
    contentType: '',
    bytes: 0,
    width: 0,
    height: 0,
    imageType: '',
    reason: '',
    finalUrl: rawUrl,
  };
  if (!rawUrl || typeof rawUrl !== 'string') {return { ...base, reason: 'EMPTY_URL' };}
  const trimmed = rawUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) {return { ...base, url: trimmed, reason: 'NOT_HTTP_URL' };}
  if (options.online === false) {return { ...base, url: trimmed, reason: 'OFFLINE_EXTERNAL_URL' };}

  let response;
  try {
    response = await requestFollow(trimmed, { method: 'GET', timeout: options.timeout });
  } catch (error) {
    return { ...base, url: trimmed, reason: normalizeError(error) };
  }

  const contentType = String(response.headers['content-type'] || '').split(';')[0].trim();
  const contentRange = String(response.headers['content-range'] || '');
  const bytes = Number(contentRange.split('/')[1] || response.headers['content-length'] || 0) || 0;
  const metadata = parseImageMetadata(response.body);
  const out = {
    ...base,
    url: trimmed,
    status: response.status,
    contentType,
    bytes,
    width: metadata.width,
    height: metadata.height,
    imageType: metadata.type,
    finalUrl: response.finalUrl || trimmed,
  };
  if (response.status < 200 || response.status >= 400) {
    out.reason = `HTTP_${response.status}`;
    return out;
  }

  const genericType = ['', 'application/octet-stream', 'binary/octet-stream'].includes(contentType.toLowerCase());
  const extensionFallback = genericType && IMAGE_EXT.test(out.finalUrl);
  if (!isImageContentType(contentType) && !extensionFallback && !metadata.type) {
    out.reason = contentType ? 'NOT_IMAGE_CONTENT_TYPE' : 'UNKNOWN_CONTENT_TYPE';
    return out;
  }
  if (options.minBytes > 0 && bytes > 0 && bytes < options.minBytes) {
    out.reason = 'TOO_SMALL';
    return out;
  }
  if ((options.minWidth > 0 || options.minHeight > 0) && (!metadata.width || !metadata.height)) {
    out.reason = 'DIMENSIONS_UNAVAILABLE';
    return out;
  }
  if (options.minWidth > 0 && metadata.width < options.minWidth) {
    out.reason = 'WIDTH_TOO_SMALL';
    return out;
  }
  if (options.minHeight > 0 && metadata.height < options.minHeight) {
    out.reason = 'HEIGHT_TOO_SMALL';
    return out;
  }
  out.ok = true;
  out.reason = 'OK';
  return out;
}

async function verifyImageUrls(urls, options = {}) {
  const list = Array.isArray(urls) ? urls : [urls];
  return Promise.all(list.map(url => verifyImageUrl(url, options)));
}

function normalizeError(error) {
  const message = (error && error.message) || String(error);
  if (['TIMEOUT', 'INVALID_URL', 'UNSUPPORTED_PROTOCOL'].includes(message)) {return message;}
  return (error && error.code) || 'REQUEST_FAILED';
}

module.exports = {
  verifyImageUrl,
  verifyImageUrls,
  isImageContentType,
  IMAGE_CONTENT_TYPES,
};
