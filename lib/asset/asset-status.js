
/**
 * asset-status.js - 素材能力检测（CDN 配置 + 推荐素材策略）
 *
 * P3 素材工具化的第一步：在生成官网/落地页前，先诚实地回答
 * “当前环境能提供什么样的素材能力”，据此选择素材策略，绝不在
 * 无 CDN / 无素材时假装已上传或已交付最终版。
 *
 * 用法：
 *   const { getAssetStatus } = require('./asset-status');
 *   const s = getAssetStatus();
 *   // { cdnConfigured, canUpload, canGenerate, recommendedStrategy, reasons, cdn }
 */

'use strict';

const { loadCdnConfig, validateCdnConfig, getCdnConfigPath } = require('../cdn/cdn-config');
const { detectImageGenerator } = require('./ai-image');

/**
 * 素材策略枚举
 * - cdn-upload      : 有 CDN，可把本地/生成的图片转存为稳定 CDN URL
 * - external-url    : 无 CDN，外链素材由 asset resolve 统一处理
 * - low-fidelity    : 既无 CDN 也无可用素材 → 只能交付低保真草稿并标注素材缺口
 */
const STRATEGY = {
  CDN_UPLOAD: 'cdn-upload',
  EXTERNAL_URL: 'external-url',
  LOW_FIDELITY: 'low-fidelity-draft',
};

/**
 * 检测当前素材能力
 * @param {object} [options]
 * @param {boolean} [options.online] 是否可联网（用于是否允许处理外链素材）
 * @returns {{
 *   cdnConfigured: boolean,
 *   canUpload: boolean,
 *   canGenerate: boolean,
 *   recommendedStrategy: string,
 *   reasons: string[],
 *   cdn: { configPath: string, missing: string[], domain: string }
 * }}
 */
function getAssetStatus(options = {}) {
  const online = options.online !== false; // 默认认为可联网处理外链素材
  const config = loadCdnConfig();
  const { valid, missing } = validateCdnConfig(config);

  const generator = detectImageGenerator();
  const reasons = [];

  let recommendedStrategy;
  if (valid) {
    recommendedStrategy = STRATEGY.CDN_UPLOAD;
    reasons.push('CDN 已配置：本地或 AI 生成图片可转存为稳定 CDN URL 并回填 spec。');
  } else if (online) {
    recommendedStrategy = STRATEGY.EXTERNAL_URL;
    reasons.push('未配置 CDN：外链素材交给 `openyida asset resolve` 统一处理，或交付草稿。');
    reasons.push('缺失 CDN 字段：' + (missing.join(', ') || '(未知)') + '，运行 `openyida cdn-config` 可开启上传能力。');
  } else {
    recommendedStrategy = STRATEGY.LOW_FIDELITY;
    reasons.push('未配置 CDN 且无法处理外链素材：只能交付低保真草稿并标注素材缺口。');
  }

  if (!generator.available) {
    reasons.push('AI 图片生成不可用：' + generator.reason + '（不会伪造图片 URL）。');
  }

  return {
    cdnConfigured: valid,
    canUpload: valid,
    canGenerate: generator.available,
    recommendedStrategy,
    reasons,
    cdn: {
      configPath: getCdnConfigPath(),
      missing,
      domain: config.cdnDomain || '',
    },
  };
}

module.exports = {
  getAssetStatus,
  STRATEGY,
};
