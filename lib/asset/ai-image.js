
/**
 * 检测宿主图片生成能力并提供 Unsplash/Pexels 采集白名单。
 * 候选素材统一经过 asset resolve，不把编造 URL 写入页面。
 */

'use strict';

/** 图片采集白名单；从官方 API/来源页取得图片和元数据。 */
const FREE_STOCK_LIBRARIES = [
  {
    name: 'Unsplash',
    site: 'https://unsplash.com',
    license: '网站下载受 Unsplash License 约束；API 使用还必须遵守署名、热链和下载统计要求',
    bestFor: '高质量摄影级 Hero 大图、生活方式/场景图',
    directImageHint:
      'images.unsplash.com/photo-... 形式的直链可直接用于 <img>；页面链接需先取得图片直链。',
    deliveryPolicy: 'API 返回图必须保留官方热链，不得镜像；展示摄影师与 Unsplash 署名，选用时调用 download_location。',
  },
  {
    name: 'Pexels',
    site: 'https://www.pexels.com',
    license: 'Pexels License（免费可商用，无需署名）',
    bestFor: '产品/办公/团队/自然等主题摄影图与短视频',
    directImageHint: 'images.pexels.com/photos/... 形式为图片直链。',
    deliveryPolicy: 'API 搜索结果展示 Pexels 链接，并尽可能署名摄影师；密钥不得写入页面源码。',
  },
];

/**
 * 检测是否存在「内置图片生成能力」。
 *
 * openyida 无内置文生图连接器；宿主能力检测未确认生成能力时返回 available:false，
 * 并由 agent 检查真实工具清单后接管素材来源。
 *
 * @param {object} [options]
 * @param {boolean} [options.hasImageGenConnector] 预留：未来若配置了文生图连接器可置 true
 * @returns {{ available: boolean, reason: string, delegateToAgent: boolean }}
 */
function detectImageGenerator(options = {}) {
  if (options.hasImageGenConnector) {
    return {
      available: true,
      reason: '检测到已配置的文生图连接器，可由连接器生成图片后再转存 CDN。',
      delegateToAgent: false,
    };
  }
  if (options.hostCapabilities && options.hostCapabilities.image_generation.available === true) {
    return {
      available: true,
      reason: '当前宿主能力检测确认提供图片生成工具；由宿主生成本地文件，再交给 asset resolve 处理。',
      delegateToAgent: true,
      source: options.hostCapabilities.image_generation.source || 'host_capability',
    };
  }
  return {
    available: false,
    reason:
      'openyida 无内置文生图能力（`openyida ai` 仅支持文生文/识图）。' +
      '图片素材应由智能体自行生成，或仅从 Unsplash/Pexels 检索真实图片，' +
      '再交给 `openyida asset resolve` 解析、（有 CDN 时）转存 CDN 后回填 spec。',
    delegateToAgent: true,
    source: 'not-declared',
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
      '1. 判断页面是否需要真实图片（官网 Hero / 产品图 / 场景图通常需要）。',
      '2. 优先：若智能体自身具备图片生成能力，按品牌调性生成图片并保存到本地。',
      '3. 备选：仅从 Unsplash / Pexels（见 libraries）检索与主题匹配的真实图片，取得图片直链和来源元数据。',
      '4. 解析：搜索图片使用 `openyida asset resolve --source search`；用户有权使用的自带外链使用 `--source user`；本地生成图直接解析。',
      '5. 兜底：若既无生成能力又找不到可用素材，交付「标注素材缺口」的低保真草稿，绝不编造图片 URL 或声称已上传。',
    ],
    libraries: getFreeStockLibraries(),
    rules: [
      '绝不编造图片 URL；素材经 `openyida asset resolve` 统一处理后再写进页面。',
      '无 CDN 时不得声称「已上传」或「已是最终版」。',
      '图片素材采集仅使用 Unsplash / Pexels，其他第三方图库不进入自动搜索和采集流程。',
      '授权或来源不明确时，改用文字排版、数据图示、中性占位或宿主生成的示意图。',
    ],
  };
}

module.exports = {
  detectImageGenerator,
  getFreeStockLibraries,
  getMaterialSourcingGuidance,
  FREE_STOCK_LIBRARIES,
};
