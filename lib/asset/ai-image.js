
'use strict';

const FREE_STOCK_LIBRARIES = [
  {
    name: 'Unsplash',
    site: 'https://unsplash.com',
    license: '遵守 Unsplash License 和 API Guidelines',
    bestFor: 'Hero、生活方式和场景图',
    directImageHint: '使用 API 返回的 images.unsplash.com URL。',
    deliveryPolicy: '下载授权图片后上传宜搭附件；保留署名和 download_location 记录。',
  },
  {
    name: 'Pexels',
    site: 'https://www.pexels.com',
    license: '遵守 Pexels License 和 API Guidelines',
    bestFor: '产品、办公、人物和场景图',
    directImageHint: 'images.pexels.com/photos/... 形式为图片直链。',
    deliveryPolicy: '下载后上传宜搭附件；保留 Pexels 链接和摄影师信息。',
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
      '1. Plan 确认后、Fast 设计就绪后启动素材任务，同时推进应用、表单和无图页面；先复用用户图片和已完成位置。',
      '2. 同一页面的图片位置也并发搜索，最多同时四个；每个位置选一张来源完整的图片并查看。',
      '3. 第二轮只补第一轮失败的必需位置，换一张图片或使用设计允许的生成图。',
      '4. 两轮结束后，可选位置采用设计允许的无图布局，必需位置保留缺口；已就绪页面直接继续。',
      '5. 每页使用 asset resolve --page-id 并发下载上传，写入独立清单并交接该页。',
    ],
    schedulingPolicy: {
      owner: 'host_agent',
      searchConcurrency: 4,
      concurrencyScope: 'collection_run',
      searchUnit: 'slot',
      resumePolicy: 'reuse_final_slots_and_remaining_round_budget',
      runAlongside: ['app_creation', 'form_creation', 'pages_without_images'],
      waitAt: 'own_page_image_binding_and_acceptance',
      resultWriter: 'one_per_page',
    },
    collectionPolicy: {
      maxRoundsPerPage: 2,
      imagesPerSlot: 1,
      candidatesPerSlotPerRound: 1,
      secondRound: 'failed_required_slots_only',
      concurrency: 'independent_pages_and_assets',
      roundOwner: 'host_agent',
      pageSelector: '--page-id',
    },
    completionPolicy: {
      resultSource: 'asset-manifests/<pageId>.json',
      planApproval: 'reuse_existing_approval',
      progressFields: ['visualStyle.forUser.assetStrategy.materialStatus', 'visualStyle.forUser.assetStrategy.missingAssets'],
      nextStep: 'continue_ready_pages',
    },
    failurePolicy: {
      attemptsPerCandidate: 1,
      sourceUnavailable: 'switch_source_for_remaining_slots',
      candidateFailed: 'replace_input',
      exhausted: 'planned_optional_layout_or_required_gap',
      retryCondition: 'within_two_rounds_or_explicit_request',
    },
    libraries: getFreeStockLibraries(),
    rules: [
      '不编造图片 URL；按 manifest 的页面状态继续，只使用当前页 materialStatus=final 的图片。',
      '默认下载并上传宜搭图片附件；超过 20 MiB 保留原链接；不额外探测 URL，下载失败跳过并记录缺口。',
      '联网搜图仅使用 Unsplash / Pexels。',
      '401、403、429、反爬挑战或超时后，将该来源标记为本次采集不可用，其他页面和后续轮次使用其他来源。',
      '每页最多两轮；每个位置每轮选一张，同一候选尝试一次，成功即结束。第二轮只补失败的必需位置；换来源、换工具或恢复上传仍计入本轮预算。',
      '来源信息获取失败时换用信息齐全的候选；真实房源、商品和人员保持真实素材要求。',
    ],
  };
}

module.exports = {
  detectImageGenerator,
  getFreeStockLibraries,
  getMaterialSourcingGuidance,
  FREE_STOCK_LIBRARIES,
};
