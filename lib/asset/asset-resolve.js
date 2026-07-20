
/**
 * asset-resolve.js - 素材解析与回填引擎
 *
 * P3 素材工具化的收口层：把 spec 里声明的图片素材（Hero / 产品图，可能是
 * 本地路径、外链 URL 或空）解析为「可直接写进页面的稳定 URL」，并诚实地
 * 给出素材完成度（materialStatus）与缺口（materialGaps），供生成链路决定
 * 交付「最终版」还是「标注缺口的低保真草稿」。
 *
 * 解析规则（对每个候选图片）：
 *   - 本地文件（存在于磁盘）：
 *       · 有 CDN → 转存 CDN，替换为稳定 CDN URL（source: cdn）；
 *       · 无 CDN → 无法交付浏览器可访问的稳定 URL → 记为缺口。
 *   - http(s) 外链：
 *       · 经 url-verify 校验可达且为图片 → 保留（source: verified-external）；
 *         若有 CDN 且 options.mirror=true，可后续扩展为镜像转存；
 *       · 校验失败 → 记为缺口（绝不带病写进页面）。
 *   - 空 / 占位：记为对应槽位缺口。
 *
 * materialStatus：
 *   - 'final' : 所需素材（含 Hero，若 requireHero）均已解析为稳定 URL；
 *   - 'draft' : 页面可渲染但存在素材缺口（缺 Hero / 部分产品图失败）；
 *   - 'none'  : 无任何可用素材且需要图片 → 只能交付低保真草稿。
 *
 * 用法：
 *   const { resolveAssets } = require('./asset-resolve');
 *   const r = await resolveAssets(spec.assets, { requireHero: true });
 *   // { assets, materialStatus, materialGaps, strategy, actions, status }
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const http = require('http');
const { verifyImageUrl } = require('./url-verify');
const { getAssetStatus, STRATEGY } = require('./asset-status');

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

/**
 * 解析单个候选图片
 * @param {string} candidate 本地路径或外链 URL
 * @param {object} ctx { canUpload, online, uploadFn }
 * @returns {Promise<{ resolved:boolean, url:string, source:string, reason:string }>}
 */
async function resolveOne(candidate, ctx) {
  const raw = (candidate || '').trim();
  if (!raw) {
    return { resolved: false, url: '', source: 'empty', reason: 'EMPTY' };
  }

  // 外链 URL：先校验可达且为图片
  if (isHttpUrl(raw)) {
    const v = await (ctx.verifyFn || verifyImageUrl)(raw, { timeout: ctx.timeout });
    if (v.ok) {
      if (ctx.mirrorExternal && ctx.canUpload) {
        let tempPath = '';
        try {
          tempPath = await (ctx.downloadFn || downloadUrlToTemp)(v.finalUrl || raw, { timeout: ctx.timeout });
          const results = await ctx.uploadFn([tempPath]);
          const hit = (results || []).find((r) => r.success && r.originalPath === tempPath) ||
            (results || []).find((r) => r.success);
          if (hit && hit.cdnUrl) {
            return { resolved: true, url: hit.cdnUrl, source: 'cdn-mirrored', reason: 'OK' };
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
        url: v.finalUrl || raw,
        source: 'verified-external',
        reason: 'OK',
      };
    }
    return { resolved: false, url: raw, source: 'external', reason: v.reason || 'VERIFY_FAILED' };
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

  // 既不是可达 URL 也不是磁盘文件 → 视为未落地的占位引用
  return { resolved: false, url: raw, source: 'unknown', reason: 'NOT_FOUND' };
}

/**
 * 解析并回填一组素材
 * @param {object} assets { heroImage, heroImageAlt, productImages, materialStrategy }
 * @param {object} [options]
 * @param {boolean} [options.requireHero] 页面是否必须有 Hero 图（官网/落地页通常 true）
 * @param {boolean} [options.online] 是否可联网校验外链（默认 true）
 * @param {number}  [options.timeout] 单个 URL 校验超时
 * @param {function} [options.uploadFn] 自定义上传函数（默认懒加载 cdn-upload.performUpload）
 * @returns {Promise<{
 *   assets: object,
 *   materialStatus: 'final'|'draft'|'none',
 *   materialGaps: string[],
 *   strategy: string,
 *   actions: Array,
 *   status: object
 * }>}
 */
async function resolveAssets(assets = {}, options = {}) {
  const online = options.online !== false;
  const requireHero = !!options.requireHero;
  const status = getAssetStatus({ online });
  const hasInjectedUpload = typeof options.uploadFn === 'function';

  const ctx = {
    canUpload: status.canUpload || hasInjectedUpload,
    online,
    mirrorExternal: !!options.mirrorExternal,
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
};
