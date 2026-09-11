
'use strict';

const FREE_STOCK_LIBRARIES = [
  {
    name: 'Unsplash',
    site: 'https://unsplash.com',
    license: '遵守 Unsplash License 和 API Guidelines',
    bestFor: 'Hero、生活方式和场景图',
    directImageHint: '使用 API 返回的 images.unsplash.com URL。',
    deliveryPolicy: '保留 API 热链和署名；选用时调用 download_location。',
  },
  {
    name: 'Pexels',
    site: 'https://www.pexels.com',
    license: '遵守 Pexels License 和 API Guidelines',
    bestFor: '产品、办公、人物和场景图',
    directImageHint: 'images.pexels.com/photos/... 形式为图片直链。',
    deliveryPolicy: '保留 Pexels 链接，并尽可能署名摄影师。',
  },
];

/**
 * 检测是否存在「内置图片生成能力」。
 *
 * openyida 无内置文生图连接器。宿主能力未确认时返回 available:null，
 * 由 Agent 检查真实工具清单。
 *
 * @param {object} [options]
 * @returns {{ status: string, available: boolean|null, reason: string, delegateToAgent: boolean }}
 */
function detectImageGenerator(options = {}) {
  const capability = options.hostCapabilities && options.hostCapabilities.image_generation;
  if (capability && capability.status === 'available') {
    return {
      status: 'available',
      available: true,
      reason: '当前宿主可生成图片；生成后交给 asset resolve。',
      delegateToAgent: true,
      source: capability.source || 'host_capability',
    };
  }
  if (capability && capability.status === 'unavailable') {
    return {
      status: 'unavailable',
      available: false,
      reason: '当前宿主不支持图片生成。',
      delegateToAgent: false,
      source: capability.source,
    };
  }
  return {
    status: 'unknown',
    available: null,
    reason: '当前宿主未确认图片生成能力。',
    delegateToAgent: true,
    source: (capability && capability.source) || 'host_tool_inventory_required',
  };
}

/**
 * 返回推荐的免费素材库清单（供 skill / agent 检索真实图片）
 * @returns {Array<{name:string, site:string, license:string, bestFor:string, directImageHint:string}>}
 */
function getFreeStockLibraries() {
  return FREE_STOCK_LIBRARIES.map((lib) => ({ ...lib }));
}

/**
 * 素材来源引导（结构化），供 skill 文档 / --json 输出使用。
 * @returns {{ steps: string[], libraries: Array, rules: string[] }}
 */
function getMaterialSourcingGuidance() {
  return {
    steps: [
      '1. 先用用户提供的素材。',
      '2. 再从 Unsplash / Pexels 搜图。',
      '3. 仍有缺口时使用宿主生图。',
      '4. 最后使用中性占位并保持 draft。',
      '5. 所有候选图通过 asset resolve 写入 manifest。',
    ],
    libraries: getFreeStockLibraries(),
    rules: [
      '不编造图片 URL；按 manifest 的页面状态继续，只使用当前页 materialStatus=final 的图片。',
      '未配置 CDN 时不得声称图片已上传。',
      '联网搜图仅使用 Unsplash / Pexels。',
      '来源不明时使用中性占位或宿主生成图。',
    ],
  };
}

module.exports = {
  detectImageGenerator,
  getFreeStockLibraries,
  getMaterialSourcingGuidance,
  FREE_STOCK_LIBRARIES,
};
