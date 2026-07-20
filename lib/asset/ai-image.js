
/**
 * ai-image.js - 图片素材来源能力检测（诚实降级 + 引导本地 agent）
 *
 * P3 素材工具化的关键澄清：openyida 本身没有内置「文生图」API，
 * `openyida ai` 只支持文生文与识图，不能凭空生成图片 URL。
 *
 * 因此本模块不假装能生成图片，而是：
 *   1. 诚实地检测「是否存在内置图片生成能力」（目前恒为 false）；
 *   2. 把「生成/寻找素材」这件事交回给正在驱动本 CLI 的智能体（Claude/悟空等），
 *      由 skill 文档引导它：能自己生成就生成，否则去免费素材库搜真实图片；
 *   3. 提供推荐的免费/可商用素材库清单与使用纪律，供 skill / agent 参考。
 *
 * 无论走哪条路，产出的候选 URL 都必须先经过 url-verify 校验真实可达，
 * 再（有 CDN 时）转存 CDN，绝不把未经校验或编造的 URL 直接写进页面。
 *
 * 用法：
 *   const { detectImageGenerator, getFreeStockLibraries, getMaterialSourcingGuidance } = require('./ai-image');
 *   const g = detectImageGenerator();  // { available:false, reason, delegateToAgent:true }
 */

'use strict';

/**
 * 推荐的免费 / 可商用图片素材库
 * 说明：这些站点提供免费可商用（多为 CC0 / 自有免费授权）的高质量图片，
 * 适合官网 Hero、产品图、场景配图。agent 应优先从这里取真实图片 URL，
 * 取到后必须用 `openyida asset verify-url` 校验可达且确为图片。
 */
const FREE_STOCK_LIBRARIES = [
  {
    name: 'Unsplash',
    site: 'https://unsplash.com',
    license: 'Unsplash License（免费可商用，无需署名）',
    bestFor: '高质量摄影级 Hero 大图、生活方式/场景图',
    directImageHint:
      'images.unsplash.com/photo-... 形式的直链可直接用于 <img>；页面链接需先取到直链再校验。',
  },
  {
    name: 'Pexels',
    site: 'https://www.pexels.com',
    license: 'Pexels License（免费可商用，无需署名）',
    bestFor: '产品/办公/团队/自然等主题摄影图与短视频',
    directImageHint: 'images.pexels.com/photos/... 形式为图片直链。',
  },
  {
    name: 'Pixabay',
    site: 'https://pixabay.com',
    license: 'Pixabay Content License（免费可商用）',
    bestFor: '插画、矢量、照片综合库',
    directImageHint: 'cdn.pixabay.com/photo/... 形式为图片直链。',
  },
  {
    name: 'Undraw',
    site: 'https://undraw.co/illustrations',
    license: 'unDraw open-source license（免费可商用，可改色）',
    bestFor: '扁平风品牌插画、空状态/引导插画（SVG，可随品牌色变量着色）',
    directImageHint: '导出 SVG 或使用官方 CDN SVG 直链。',
  },
];

/**
 * 检测是否存在「内置图片生成能力」。
 *
 * 目前 openyida 无内置文生图连接器，恒返回 available:false，并显式声明
 * 由 agent 接管素材来源（避免任何模块据此伪造图片 URL）。
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
  return {
    available: false,
    reason:
      'openyida 无内置文生图能力（`openyida ai` 仅支持文生文/识图）。' +
      '图片素材应由智能体自行生成，或到免费素材库（Unsplash/Pexels 等）检索真实图片，' +
      '再经 `openyida asset verify-url` 校验、（有 CDN 时）转存 CDN 后回填 spec。',
    delegateToAgent: true,
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
      '3. 备选：到免费可商用素材库（见 libraries）检索与主题匹配的真实图片，拿到图片直链。',
      '4. 校验：对每个候选 URL 运行 `openyida asset verify-url <url>`，只保留 ok=true 的。',
      '5. 转存：若已配置 CDN（`openyida asset status` 显示 cdn-upload），用 `openyida asset resolve --upload-assets` 把本地/外链图片转存为稳定 CDN URL 并回填 spec.assets。',
      '6. 兜底：若既无生成能力又找不到可校验素材，交付「标注素材缺口」的低保真草稿，绝不编造图片 URL 或声称已上传。',
    ],
    libraries: getFreeStockLibraries(),
    rules: [
      '绝不编造图片 URL；未经 verify-url 校验的 URL 不得写进页面。',
      '无 CDN 时不得声称「已上传」或「已是最终版」。',
      '素材授权需为免费可商用；如不确定授权，改用文字排版/数据图示/插画（如 unDraw）替代。',
    ],
  };
}

module.exports = {
  detectImageGenerator,
  getFreeStockLibraries,
  getMaterialSourcingGuidance,
  FREE_STOCK_LIBRARIES,
};
