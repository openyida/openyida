
/**
 * 把 Hero / 产品图片解析为可落地 URL，并返回 final、draft 或 none。
 * 本地文件有 CDN 才上传；搜索外链仅接受 Unsplash/Pexels；用户授权外链使用
 * assetSource=user。任何失败都保留为 materialGaps，不编造 URL。
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const http = require('http');
const { verifyImageUrl } = require('./url-verify');
const { getAssetStatus, STRATEGY } = require('./asset-status');

const ALLOWED_STOCK_IMAGE_PROVIDERS = Object.freeze({
  unsplash: Object.freeze(['images.unsplash.com']),
  pexels: Object.freeze(['images.pexels.com']),
});

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function isLocalFile(value) {
  if (!value || typeof value !== 'string') {return false;}
  if (isHttpUrl(value)) {return false;}
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
      if (hosts.some((allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`))) {
        return provider;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function getExternalDeliveryPolicy(rawUrl) {
  if (getCollectedImageProvider(rawUrl) === 'unsplash') {
    return 'hotlink-only';
  }
  return 'standard';
}

function extensionFromUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const ext = path.extname(parsed.pathname || '').toLowerCase();
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
    const req = client.get(
      parsed,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; OpenYidaAssetMirror/1.0)',
          Accept: 'image/*,*/*;q=0.8',
        },
      },
      (res) => {
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
      }
    );
    req.setTimeout(timeout, () => req.destroy(new Error('TIMEOUT')));
    req.on('error', reject);
  });
}

async function resolveOne(candidate, ctx) {
  const raw = (candidate || '').trim();
  if (!raw) {
    return { resolved: false, url: '', source: 'empty', reason: 'EMPTY' };
  }

  // 外链素材：由 resolve 流程统一确认并按需镜像
  if (isHttpUrl(raw)) {
    const assetSource = ctx.assetSource === 'user' ? 'user' : 'search';
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
    const v = await (ctx.verifyFn || verifyImageUrl)(raw, { timeout: ctx.timeout });
    if (v.ok) {
      const finalUrl = v.finalUrl || raw;
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
      if (deliveryPolicy === 'hotlink-only') {
        return {
          resolved: true,
          url: finalUrl,
          source: 'external',
          reason: ctx.mirrorExternal ? 'OK_HOTLINK_REQUIRED' : 'OK',
          deliveryPolicy,
          provider: provider || 'user',
        };
      }
      if (ctx.mirrorExternal && ctx.canUpload) {
        let tempPath = '';
        try {
          tempPath = await (ctx.downloadFn || downloadUrlToTemp)(finalUrl, { timeout: ctx.timeout });
          const results = await ctx.uploadFn([tempPath]);
          const hit = (results || []).find((r) => r.success && r.originalPath === tempPath) ||
            (results || []).find((r) => r.success);
          if (hit && hit.cdnUrl) {
            return {
              resolved: true,
              url: hit.cdnUrl,
              source: 'cdn-mirrored',
              reason: 'OK',
              provider: provider || 'user',
            };
          }
          const failed = (results || [])[0];
          return {
            resolved: false,
            url: raw,
            source: 'external',
            reason: (failed && failed.error) || 'MIRROR_UPLOAD_FAILED',
          };
        } catch (err) {
          return { resolved: false, url: raw, source: 'external', reason: (err && err.message) || 'MIRROR_FAILED' };
        } finally {
          if (tempPath) {
            fs.rmSync(tempPath, { force: true });
          }
        }
      }
      return {
        resolved: true,
        url: finalUrl,
        source: 'external',
        reason: 'OK',
        deliveryPolicy,
        provider: provider || 'user',
      };
    }
    return { resolved: false, url: raw, source: 'external', reason: v.reason || 'ASSET_UNAVAILABLE' };
  }

  // 本地文件：需要 CDN 才能转存为浏览器可访问的稳定 URL
  if (isLocalFile(raw)) {
    if (!ctx.canUpload) {
      return {
        resolved: false,
        url: raw,
        source: 'local',
        reason: 'LOCAL_NO_CDN',
      };
    }
    try {
      const results = await ctx.uploadFn([raw]);
      const hit = (results || []).find((r) => r.success && r.originalPath === raw) ||
        (results || []).find((r) => r.success);
      if (hit && hit.cdnUrl) {
        return { resolved: true, url: hit.cdnUrl, source: 'cdn', reason: 'OK' };
      }
      const failed = (results || [])[0];
      return {
        resolved: false,
        url: raw,
        source: 'local',
        reason: (failed && failed.error) || 'UPLOAD_FAILED',
      };
    } catch (err) {
      return { resolved: false, url: raw, source: 'local', reason: (err && err.message) || 'UPLOAD_ERROR' };
    }
  }

  // 既不是外链也不是磁盘文件 → 视为未落地的占位引用
  return { resolved: false, url: raw, source: 'unknown', reason: 'NOT_FOUND' };
}

/** 解析素材组；assetSource 为 search（默认）或 user。 */
async function resolveAssets(assets = {}, options = {}) {
  const online = options.online !== false;
  const requireHero = !!options.requireHero;
  const status = getAssetStatus({ online });
  const hasInjectedUpload = typeof options.uploadFn === 'function';

  const ctx = {
    canUpload: status.canUpload || hasInjectedUpload,
    online,
    mirrorExternal: !!options.mirrorExternal,
    assetSource: options.assetSource === 'user' ? 'user' : 'search',
    timeout: options.timeout,
    verifyFn: options.verifyFn,
    downloadFn: options.downloadFn,
    uploadFn:
      options.uploadFn ||
      ((files) => {
        // 懒加载，避免无 CDN 场景加载 ali-oss
        const { performUpload } = require('../cdn/cdn-upload');
        return performUpload({ files });
      }),
  };

  const inputHero = assets.heroImage || '';
  const inputProducts = Array.isArray(assets.productImages) ? assets.productImages : [];

  const actions = [];
  const materialGaps = [];

  // Hero
  let heroUrl = '';
  if (inputHero) {
    const r = await resolveOne(inputHero, ctx);
    actions.push({ slot: 'heroImage', input: inputHero, ...r });
    if (r.resolved) {
      heroUrl = r.url;
    } else {
      materialGaps.push(`Hero 图未落地（${r.reason}）：${inputHero}`);
    }
  } else if (requireHero) {
    materialGaps.push('缺少 Hero 图：官网/落地页应提供一张品牌主视觉大图。');
  }

  // 产品/场景图
  const productUrls = [];
  for (let i = 0; i < inputProducts.length; i++) {
    const item = inputProducts[i];
    const r = await resolveOne(item, ctx);
    actions.push({ slot: `productImages[${i}]`, input: item, ...r });
    if (r.resolved) {
      productUrls.push(r.url);
    } else {
      materialGaps.push(`产品图 #${i + 1} 未落地（${r.reason}）：${item}`);
    }
  }

  // 计算 materialStatus
  const resolvedCount = (heroUrl ? 1 : 0) + productUrls.length;
  let materialStatus;
  if (materialGaps.length === 0) {
    // 没有缺口：要么素材齐全，要么本就不需要图片
    materialStatus = 'final';
  } else if (resolvedCount > 0) {
    // 有部分素材落地，但仍有缺口 → 草稿
    materialStatus = 'draft';
  } else if (requireHero) {
    // 需要图片却一张都没落地 → 低保真
    materialStatus = 'none';
  } else {
    materialStatus = 'draft';
  }

  // strategy：以实际落地来源反推，优先反映真实能力
  let strategy = status.recommendedStrategy;
  if (materialStatus === 'none') {
    strategy = STRATEGY.LOW_FIDELITY;
  }

  const resolvedAssets = {
    heroImage: heroUrl,
    heroImageAlt: assets.heroImageAlt || '',
    productImages: productUrls,
    materialStrategy: strategy,
  };

  return {
    assets: resolvedAssets,
    materialStatus,
    materialGaps,
    strategy,
    actions,
    status,
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
};
