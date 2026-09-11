'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { minimumSize, prepareAssetPlan } = require('./asset-plan');
const { readImageMetadata, parseImageMetadata } = require('./image-metadata');
const { MAX_IMAGE_BYTES, uploadAttachment } = require('./attachment-upload');
const { getAssetStatus } = require('./asset-status');

const ALLOWED_STOCK_IMAGE_PROVIDERS = Object.freeze({
  unsplash: Object.freeze(['images.unsplash.com']),
  pexels: Object.freeze(['images.pexels.com']),
});
const ASSET_SOURCES = Object.freeze(['search', 'user', 'generated']);

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function isLocalFile(value) {
  if (!value || typeof value !== 'string' || isHttpUrl(value)) {return false;}
  try {
    return fs.existsSync(value) && fs.statSync(value).isFile();
  } catch {
    return false;
  }
}

function getCollectedImageProvider(rawUrl) {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    for (const [provider, hosts] of Object.entries(ALLOWED_STOCK_IMAGE_PROVIDERS)) {
      if (hosts.some(allowed => host === allowed || host.endsWith(`.${allowed}`))) {return provider;}
    }
  } catch {
    return null;
  }
  return null;
}

function getExternalDeliveryPolicy(rawUrl) {
  return isHttpUrl(rawUrl) ? 'yida-attachment' : 'standard';
}

function extensionFromUrl(rawUrl) {
  try {
    const ext = path.extname(new URL(rawUrl).pathname || '').toLowerCase();
    return ext && ext.length <= 8 ? ext : '.img';
  } catch {
    return '.img';
  }
}

async function downloadUrlToTemp(rawUrl, options = {}, depth = 0) {
  if (depth > 4) {throw new Error('TOO_MANY_REDIRECTS');}
  if (options.stockOnly && !getCollectedImageProvider(rawUrl)) {throw new Error('STOCK_PROVIDER_REDIRECT_NOT_ALLOWED');}
  const parsed = new URL(rawUrl);
  if (!['https:', 'http:'].includes(parsed.protocol)) {throw new Error('UNSUPPORTED_PROTOCOL');}
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-asset-'));
  const tempPath = path.join(dir, `image${extensionFromUrl(rawUrl)}`);
  let fileStream;
  let fileClosed;
  try {
    const redirect = await new Promise((resolve, reject) => {
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.get(parsed, { headers: { 'User-Agent': 'OpenYidaAsset/1.0', Accept: 'image/*' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          try { resolve(new URL(res.headers.location, rawUrl).toString()); } catch (error) { reject(error); }
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          res.resume(); reject(new Error(`HTTP_${res.statusCode}`)); return;
        }
        const declaredTooLarge = Number(res.headers['content-length']) > MAX_IMAGE_BYTES;
        let bytes = 0;
        let header = Buffer.alloc(0);
        const out = fs.createWriteStream(tempPath);
        fileStream = out;
        fileClosed = new Promise(resolve => out.once('close', resolve));
        let failed = false;
        const fail = error => {
          if (failed) {return;}
          failed = true;
          reject(error);
          out.destroy();
          res.destroy();
        };
        res.on('data', chunk => {
          bytes += chunk.length;
          if (header.length < 128 * 1024) {header = Buffer.concat([header, chunk.subarray(0, 128 * 1024 - header.length)]);}
          const metadata = declaredTooLarge ? parseImageMetadata(header) : null;
          if (bytes > MAX_IMAGE_BYTES || (declaredTooLarge && (metadata.width > 0 || header.length >= 128 * 1024))) {
            const error = new Error('ASSET_TOO_LARGE');
            error.metadata = metadata || parseImageMetadata(header);
            fail(error);
          }
        });
        res.on('error', fail);
        res.on('aborted', () => fail(new Error('DOWNLOAD_ABORTED')));
        out.on('error', fail);
        out.on('finish', () => out.close(() => resolve('')));
        res.pipe(out);
      });
      req.setTimeout(options.timeout || 15000, () => req.destroy(new Error('TIMEOUT')));
      req.on('error', reject);
    });
    if (redirect) {
      fs.rmSync(dir, { recursive: true, force: true });
      return downloadUrlToTemp(redirect, options, depth + 1);
    }
    // Correct missing/wrong URL extensions using the downloaded image header.
    const type = readImageMetadata(tempPath).type;
    const target = path.join(dir, `image.${type || 'img'}`);
    if (tempPath !== target) {fs.renameSync(tempPath, target);}
    return target;
  } catch (error) {
    if (fileStream) {
      // destroy() closes the handle asynchronously; Windows cannot unlink it yet.
      fileStream.destroy();
      await fileClosed;
    }
    fs.rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

function sizeFailure(metadata, ctx) {
  if (!metadata.type) {return 'NOT_IMAGE_FILE';}
  if (![metadata.width, metadata.height].every(value => Number.isFinite(value) && value > 0)) {
    return 'DIMENSIONS_UNAVAILABLE';
  }
  if (ctx.minWidth > 0 && metadata.width < ctx.minWidth) {return 'WIDTH_TOO_SMALL';}
  if (ctx.minHeight > 0 && metadata.height < ctx.minHeight) {return 'HEIGHT_TOO_SMALL';}
  return '';
}

function fileHash(file) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(64 * 1024);
    let bytes;
    while ((bytes = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) {hash.update(buffer.subarray(0, bytes));}
    return hash.digest('hex');
  } finally { fs.closeSync(fd); }
}

async function reuseDelivery(input, metadata, ctx) {
  const previous = ctx.previous || {};
  const delivery = previous.delivery || {};
  if (ctx.online === false || delivery.source !== 'yida-attachment' || delivery.input !== input ||
      delivery.assetSource !== ctx.assetSource || !metadata.contentHash || delivery.contentHash !== metadata.contentHash ||
      !isHttpUrl(previous.url)) {return null;}
  return { ...metadata, resolved: true, url: previous.url, source: 'yida-attachment', reason: 'OK_REUSED' };
}

async function resolveOne(candidate, ctx = {}) {
  const raw = String(candidate || '').trim();
  if (!raw) {return { resolved: false, url: '', source: 'empty', reason: 'EMPTY' };}

  if (isHttpUrl(raw)) {
    if (ctx.online === false) {
      return { resolved: false, url: raw, source: 'external', reason: 'OFFLINE_EXTERNAL_URL' };
    }
    const assetSource = ASSET_SOURCES.includes(ctx.assetSource) ? ctx.assetSource : 'search';
    const inputProvider = getCollectedImageProvider(raw);
    if (assetSource === 'search' && !inputProvider) {
      return {
        resolved: false,
        url: raw,
        source: 'external',
        reason: 'STOCK_PROVIDER_NOT_ALLOWED',
        deliveryPolicy: 'blocked',
        provider: null,
        allowedProviders: Object.keys(ALLOWED_STOCK_IMAGE_PROVIDERS),
      };
    }
    const deliveryPolicy = getExternalDeliveryPolicy(raw);
    const common = { provider: inputProvider || ctx.provider || assetSource };
    const original = metadata => {
      const failure = sizeFailure(metadata, ctx);
      if (failure) {return { ...common, resolved: false, reason: failure };}
      return { ...common, ...metadata, imageType: metadata.type, resolved: true, url: raw,
        source: 'external', reason: 'ASSET_TOO_LARGE', deliveryPolicy: 'original-url' };
    };
    let tempPath = '';
    try {
      tempPath = await (ctx.downloadFn || downloadUrlToTemp)(raw, { timeout: ctx.timeout, stockOnly: assetSource === 'search' });
      if (fs.statSync(tempPath).size > MAX_IMAGE_BYTES) {return original(readImageMetadata(tempPath));}
      const downloaded = readImageMetadata(tempPath);
      const failure = sizeFailure(downloaded, ctx);
      if (failure) {return { resolved: false, url: raw, source: 'external', reason: failure };}
      Object.assign(common, downloaded, { contentHash: fileHash(tempPath), imageType: downloaded.type });
      const reused = await reuseDelivery(raw, common, ctx);
      if (reused) {return reused;}
      if (!ctx.canUpload) {return { resolved: false, url: raw, source: 'external', reason: 'YIDA_ATTACHMENT_UNAVAILABLE' };}
      const results = await ctx.uploadFn([tempPath]);
      const hit = (results || []).find(result => result.success && result.originalPath === tempPath)
        || (results || []).find(result => result.success);
      if (hit && isHttpUrl(hit.cdnUrl)) {
        return { ...common, resolved: true, url: hit.cdnUrl, source: 'yida-attachment', reason: 'OK', deliveryPolicy };
      }
      return { ...common, resolved: false, url: raw, source: 'external', reason: ((results || [])[0] || {}).error || 'UPLOAD_FAILED' };
    } catch (error) {
      if (error.message === 'ASSET_TOO_LARGE') {return original(error.metadata || {});}
      return { ...common, resolved: false, url: raw, source: 'external', reason: error.code || error.message || 'UPLOAD_FAILED' };
    } finally {
      if (tempPath) {
        fs.rmSync(tempPath, { force: true });
        if (!ctx.downloadFn) {fs.rmSync(path.dirname(tempPath), { recursive: true, force: true });}
      }
    }
  }

  if (isLocalFile(raw)) {
    const assetSource = ASSET_SOURCES.includes(ctx.assetSource) ? ctx.assetSource : '';
    const provider = String(ctx.provider || '').trim().toLowerCase();
    if (assetSource === 'search' && !ALLOWED_STOCK_IMAGE_PROVIDERS[provider]) {
      return {
        resolved: false,
        url: raw,
        source: 'local',
        reason: 'STOCK_PROVIDER_NOT_ALLOWED',
        provider: provider || null,
        allowedProviders: Object.keys(ALLOWED_STOCK_IMAGE_PROVIDERS),
      };
    }
    const metadata = readImageMetadata(raw);
    const failure = sizeFailure(metadata, ctx);
    if (failure) {
      return { ...metadata, resolved: false, url: raw, source: 'local', reason: failure };
    }
    if (ctx.online === false) {
      return { ...metadata, resolved: false, url: raw, source: 'local', reason: 'OFFLINE_UPLOAD_BLOCKED' };
    }
    if (fs.statSync(raw).size > MAX_IMAGE_BYTES) {return { ...metadata, resolved: false, url: '', source: 'local', reason: 'ASSET_TOO_LARGE_NO_ORIGINAL_URL' };}
    metadata.contentHash = fileHash(raw);
    const reused = await reuseDelivery(raw, metadata, ctx);
    if (reused) {return reused;}
    if (!ctx.canUpload) {
      return { ...metadata, resolved: false, url: raw, source: 'local', reason: 'YIDA_ATTACHMENT_UNAVAILABLE' };
    }
    try {
      const results = await ctx.uploadFn([raw]);
      const hit = (results || []).find(result => result.success && result.originalPath === raw)
        || (results || []).find(result => result.success);
      if (hit && isHttpUrl(hit.cdnUrl)) {
        return { ...metadata, resolved: true, url: hit.cdnUrl, source: 'yida-attachment', reason: 'OK' };
      }
      return { ...metadata, resolved: false, url: raw, source: 'local', reason: ((results || [])[0] || {}).error || 'UPLOAD_FAILED' };
    } catch (error) {
      return { ...metadata, resolved: false, url: raw, source: 'local', reason: error.code || error.message || 'UPLOAD_FAILED' };
    }
  }

  return { resolved: false, url: raw, source: 'unknown', reason: 'NOT_FOUND' };
}

function normalizeSource(source, fallback) {
  return ASSET_SOURCES.includes(source) ? source : fallback;
}

function metadataGaps(asset) {
  const missing = [];
  ['slotId', 'usage', 'alt'].forEach((field) => {
    if (typeof asset[field] !== 'string' || !asset[field].trim()) {missing.push(field);}
  });
  if (![asset.width, asset.height].every(value => Number.isFinite(value) && value > 0)) {missing.push('width/height');}
  if (asset.source === 'search') {
    ['provider', 'sourcePage', 'creator', 'license', 'attribution'].forEach((field) => {
      if (typeof asset[field] !== 'string' || !asset[field].trim()) {missing.push(field);}
    });
    if (asset.provider === 'unsplash') {
      if (!asset.downloadLocation) {missing.push('downloadLocation');}
      if (asset.downloadTracked !== true) {missing.push('downloadTracked');}
    }
  }
  return missing;
}

async function resolveAssets(assets = [], options = {}) {
  const plan = prepareAssetPlan(assets, options.assetStrategy);
  const entries = plan.entries;
  const online = options.online !== false;
  const status = options.status || getAssetStatus({ online, env: options.env, runtime: options.runtime });
  const canUpload = online;
  const defaultSource = normalizeSource(options.assetSource, 'search');
  const uploadFn = options.uploadFn || (files => uploadAttachment(files, options));

  const actions = await Promise.all(entries.map(async (asset, index) => {
    const declaredSource = String(asset.source || '').trim();
    const source = declaredSource || defaultSource;
    const input = String(asset.input || asset.localPath || asset.url || '').trim();
    const size = minimumSize(asset);
    if (!ASSET_SOURCES.includes(source) || (source === 'generated' && asset.generationAllowed === false)) {
      return {
        index,
        asset,
        input,
        source,
        result: { resolved: false, url: input, source: 'unknown', reason: !ASSET_SOURCES.includes(source) ? 'INVALID_SOURCE' : 'GENERATION_NOT_ALLOWED' },
      };
    }
    let result;
    try {
      result = await resolveOne(input, {
        previous: asset,
        assetSource: source,
        provider: asset.provider,
        online,
        canUpload,
        timeout: options.timeout,
        downloadFn: options.downloadFn,
        uploadFn,
        ...size,
      });
    } catch (error) {
      result = { resolved: false, url: input, reason: error.code || 'ASSET_READ_FAILED' };
    }
    return { index, asset, input, source, result };
  }));

  const outputAssets = [];
  const gaps = [];
  actions.forEach(({ asset, input, source, result }, index) => {
    const slotId = String(asset.slotId || '').trim();
    const provider = result.provider || asset.provider || '';
    const output = {
      slotId,
      pageId: asset.pageId || '',
      input,
      ...minimumSize(asset),
      ...(asset.minSize !== undefined ? { minSize: asset.minSize } : {}),
      usage: asset.usage || '',
      required: asset.required !== false,
      url: result.resolved ? result.url : '',
      localPath: isLocalFile(input) ? input : '',
      source,
      provider,
      sourcePage: asset.sourcePage || '',
      creator: asset.creator || '',
      license: asset.license || '',
      attribution: asset.attribution || '',
      downloadLocation: asset.downloadLocation || '',
      downloadTracked: asset.downloadTracked === true,
      width: result.width || 0,
      height: result.height || 0,
      imageType: result.imageType || result.type || '',
      ...(result.resolved ? { delivery: { source: result.source, input, assetSource: source, contentHash: result.contentHash || '', reason: result.reason } } : {}),
      alt: asset.alt || '',
      isIllustrative: asset.isIllustrative === true || source === 'generated',
    };
    output.materialStatus = 'draft';
    output.gaps = [];
    outputAssets.push(output);
    if (!result.resolved) {
      output.gaps.push({
        slotId: slotId || `slot-${index + 1}`,
        pageId: output.pageId,
        code: result.reason,
        message: `图片未落地：${result.reason}`,
      });
      gaps.push(...output.gaps.map(gap => ({ ...gap })));
      return;
    }
    const missing = metadataGaps(output);
    if (missing.length > 0) {
      output.gaps.push({
        slotId: slotId || `slot-${index + 1}`,
        pageId: output.pageId,
        code: 'MISSING_METADATA',
        message: `缺少字段：${missing.join(', ')}`,
      });
    }
    output.materialStatus = output.gaps.length ? 'draft' : 'final';
    gaps.push(...output.gaps.map(gap => ({ ...gap })));
  });

  const pages = plan.pages.map(page => {
    const pageAssets = outputAssets.filter(asset => asset.pageId === page.pageId);
    const pageGaps = gaps.filter(gap => gap.pageId === page.pageId).map(gap => ({ ...gap }));
    if (page.imageNeed === 'required' && page.slotIds.length === 0) {
      const gap = { pageId: page.pageId, code: 'MISSING_PAGE_SLOTS', message: 'MISSING_PAGE_SLOTS' };
      pageGaps.push(gap);
      gaps.push({ ...gap });
    }
    const blocked = pageGaps.some(gap => !gap.slotId || pageAssets.some(asset => asset.slotId === gap.slotId && asset.required));
    return { ...page, materialStatus: blocked ? 'draft' : pageAssets.length ? 'final' : 'none', gaps: pageGaps };
  });
  const materialStatus = gaps.length ? 'draft' : entries.length ? 'final' : 'none';
  return {
    schemaVersion: 2,
    materialStatus,
    ...(plan.assetStrategy !== undefined ? { assetStrategy: plan.assetStrategy } : {}),
    pages,
    capabilityEvidence: {
      host: status.hostCapabilities,
      cdnConfigured: status.cdnConfigured,
      uploadTarget: 'yida-attachment',
      maxUploadBytes: MAX_IMAGE_BYTES,
      online,
    },
    assets: outputAssets,
    gaps,
  };
}

module.exports = {
  resolveAssets,
  resolveOne,
  isHttpUrl,
  isLocalFile,
  getExternalDeliveryPolicy,
  getCollectedImageProvider,
  ALLOWED_STOCK_IMAGE_PROVIDERS,
  ASSET_SOURCES,
  downloadUrlToTemp,
};
