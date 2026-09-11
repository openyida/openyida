'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { minimumSize, prepareAssetPlan } = require('./asset-plan');
const { verifyImageUrl } = require('./url-verify');
const { readImageMetadata } = require('./image-metadata');
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
  return getCollectedImageProvider(rawUrl) === 'unsplash' ? 'hotlink-only' : 'standard';
}

function extensionFromUrl(rawUrl) {
  try {
    const ext = path.extname(new URL(rawUrl).pathname || '').toLowerCase();
    return ext && ext.length <= 8 ? ext : '.img';
  } catch {
    return '.img';
  }
}

function downloadUrlToTemp(rawUrl, options = {}) {
  const timeout = options.timeout || 15000;
  const tempPath = path.join(os.tmpdir(), `openyida-asset-${Date.now()}-${Math.random().toString(36).slice(2)}${extensionFromUrl(rawUrl)}`);
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      reject(new Error('INVALID_URL'));
      return;
    }
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.get(parsed, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OpenYidaAssetMirror/1.0)',
        Accept: 'image/*,*/*;q=0.8',
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        downloadUrlToTemp(new URL(res.headers.location, rawUrl).toString(), options).then(resolve, reject);
        return;
      }
      if (res.statusCode < 200 || res.statusCode >= 400) {
        res.resume();
        reject(new Error(`HTTP_${res.statusCode || 0}`));
        return;
      }
      const out = fs.createWriteStream(tempPath);
      res.pipe(out);
      out.on('finish', () => out.close(() => resolve(tempPath)));
      out.on('error', reject);
    });
    req.setTimeout(timeout, () => req.destroy(new Error('TIMEOUT')));
    req.on('error', reject);
  });
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
  if (ctx.online === false || delivery.source !== 'cdn' || delivery.input !== input ||
      delivery.assetSource !== ctx.assetSource || !metadata.contentHash || delivery.contentHash !== metadata.contentHash ||
      !isHttpUrl(previous.url)) {return null;}
  const verified = await (ctx.verifyFn || verifyImageUrl)(previous.url, ctx);
  if (!verified.ok) {return null;}
  return {
    ...metadata, resolved: true, url: verified.finalUrl || previous.url, source: 'cdn', reason: 'OK_REUSED',
    width: verified.width, height: verified.height, imageType: verified.imageType,
  };
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
    const verified = await (ctx.verifyFn || verifyImageUrl)(raw, {
      online: ctx.online,
      timeout: ctx.timeout,
      minWidth: ctx.minWidth,
      minHeight: ctx.minHeight,
    });
    if (!verified.ok) {
      return { resolved: false, url: raw, source: 'external', reason: verified.reason || 'ASSET_UNAVAILABLE' };
    }
    const finalUrl = verified.finalUrl || raw;
    const provider = getCollectedImageProvider(finalUrl);
    if (assetSource === 'search' && !provider) {
      return {
        resolved: false,
        url: raw,
        source: 'external',
        reason: 'STOCK_PROVIDER_REDIRECT_NOT_ALLOWED',
        deliveryPolicy: 'blocked',
        provider: null,
        allowedProviders: Object.keys(ALLOWED_STOCK_IMAGE_PROVIDERS),
      };
    }
    const deliveryPolicy = getExternalDeliveryPolicy(finalUrl);
    const common = {
      width: verified.width || 0,
      height: verified.height || 0,
      imageType: verified.imageType || '',
      provider: provider || ctx.provider || assetSource,
    };
    if (deliveryPolicy === 'hotlink-only') {
      return {
        ...common,
        resolved: true,
        url: finalUrl,
        source: 'external',
        reason: ctx.mirrorExternal ? 'OK_HOTLINK_REQUIRED' : 'OK',
        deliveryPolicy,
      };
    }
    const previousCdn = ctx.previous?.delivery?.source === 'cdn';
    if ((ctx.mirrorExternal && ctx.canUpload) || previousCdn) {
      let tempPath = '';
      try {
        tempPath = await (ctx.downloadFn || downloadUrlToTemp)(finalUrl, { timeout: ctx.timeout });
        const downloaded = readImageMetadata(tempPath);
        const failure = sizeFailure(downloaded, ctx);
        if (failure) {return { resolved: false, url: raw, source: 'external', reason: failure };}
        Object.assign(common, downloaded, { contentHash: fileHash(tempPath), imageType: downloaded.type });
        const reused = await reuseDelivery(raw, common, ctx);
        if (reused) {return reused;}
        if (!ctx.canUpload) {return { resolved: false, url: raw, source: 'external', reason: 'LOCAL_NO_CDN' };}
        const results = await ctx.uploadFn([tempPath]);
        const hit = (results || []).find(result => result.success && result.originalPath === tempPath)
          || (results || []).find(result => result.success);
        if (hit && hit.cdnUrl) {
          return { ...common, resolved: true, url: hit.cdnUrl, source: 'cdn', reason: 'OK', deliveryPolicy };
        }
        return { ...common, resolved: false, url: raw, source: 'external', reason: ((results || [])[0] || {}).error || 'UPLOAD_FAILED' };
      } catch (error) {
        return { ...common, resolved: false, url: raw, source: 'external', reason: error.message || 'UPLOAD_FAILED' };
      } finally {
        if (tempPath) {fs.rmSync(tempPath, { force: true });}
      }
    }
    return {
      ...common,
      resolved: true,
      url: finalUrl,
      source: 'external',
      reason: 'OK',
      deliveryPolicy,
    };
  }

  if (isLocalFile(raw)) {
    const assetSource = ASSET_SOURCES.includes(ctx.assetSource) ? ctx.assetSource : '';
    const provider = String(ctx.provider || '').trim().toLowerCase();
    if (assetSource === 'search' && provider === 'unsplash') {
      return { resolved: false, url: raw, source: 'local', reason: 'UNSPLASH_HOTLINK_REQUIRED', provider };
    }
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
    metadata.contentHash = fileHash(raw);
    const reused = await reuseDelivery(raw, metadata, ctx);
    if (reused) {return reused;}
    if (!ctx.canUpload) {
      return { ...metadata, resolved: false, url: raw, source: 'local', reason: 'LOCAL_NO_CDN' };
    }
    try {
      const results = await ctx.uploadFn([raw]);
      const hit = (results || []).find(result => result.success && result.originalPath === raw)
        || (results || []).find(result => result.success);
      if (hit && hit.cdnUrl) {
        return { ...metadata, resolved: true, url: hit.cdnUrl, source: 'cdn', reason: 'OK' };
      }
      return { ...metadata, resolved: false, url: raw, source: 'local', reason: ((results || [])[0] || {}).error || 'UPLOAD_FAILED' };
    } catch (error) {
      return { ...metadata, resolved: false, url: raw, source: 'local', reason: error.message || 'UPLOAD_FAILED' };
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
  const canUpload = online && (status.canUpload || typeof options.uploadFn === 'function');
  const defaultSource = normalizeSource(options.assetSource, 'search');
  const uploadFn = options.uploadFn || ((files) => {
    const { performUpload } = require('../cdn/cdn-upload');
    return performUpload({ files });
  });

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
        mirrorExternal: !!options.mirrorExternal,
        timeout: options.timeout,
        verifyFn: options.verifyFn,
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
      ...(result.resolved ? { delivery: { source: result.source, input, assetSource: source, contentHash: result.contentHash || '' } } : {}),
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
};
