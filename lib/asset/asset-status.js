
'use strict';

const { loadCdnConfig, validateCdnConfig, getCdnConfigPath } = require('../cdn/cdn-config');
const { detectImageGenerator } = require('./ai-image');
const { buildHostAssetCapabilities } = require('./host-capabilities');
const { detectRuntimeCapabilities } = require('../core/utils');

/**
 * 素材策略枚举。
 */
const STRATEGY = {
  CDN_UPLOAD: 'cdn-upload',
  YIDA_ATTACHMENT: 'yida-attachment',
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
 *   canGenerate: boolean|null,
 *   recommendedStrategy: string,
 *   reasons: string[],
 *   cdn: { configPath: string, missing: string[], domain: string }
 * }}
 */
function getAssetStatus(options = {}) {
  const online = options.online !== false;
  const config = loadCdnConfig();
  const { valid, missing } = validateCdnConfig(config);

  const runtime = options.runtime || detectRuntimeCapabilities({ env: options.env });
  const hostCapabilities = buildHostAssetCapabilities({ env: options.env, runtime });
  const generator = detectImageGenerator({ hostCapabilities });
  const reasons = [];

  let recommendedStrategy;
  if (online) {
    recommendedStrategy = STRATEGY.YIDA_ATTACHMENT;
    reasons.push('图片默认上传宜搭附件，需要登录态和 appType；超过 20 MiB 的外链保留原链接。');
  } else {
    recommendedStrategy = STRATEGY.LOW_FIDELITY;
    reasons.push('离线模式不校验外链，也不上传图片。');
  }

  if (generator.available !== true) {
    reasons.push(generator.reason);
  }

  return {
    cdnConfigured: valid,
    canUpload: online,
    uploadTarget: 'yida-attachment',
    requiresLogin: true,
    requiresAppType: true,
    canGenerate: generator.available,
    hostCapabilities,
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
