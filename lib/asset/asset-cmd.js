
/**
 * asset-cmd.js - `openyida asset` 素材能力命令
 *
 * 素材工具的统一入口，把「检测素材能力 / 解析回填 / 素材来源引导」
 * 暴露为可脚本化命令，供本地智能体在生成官网/落地页前调用，
 * 从而做到：无 CDN 不谎称已上传、无可用素材不交付「最终版」。
 *
 * 子命令：
 *   status                     检测当前素材能力（CDN / 生成 / 推荐策略）
 *   resolve --hero <..> [--product <..>] [--upload-assets]  解析并回填一组素材，输出 materialStatus/缺口
 *   generate                   输出素材来源引导（免费素材库清单 + 纪律）
 *
 * 所有子命令均支持 --json 便于智能体解析。
 */

'use strict';

const { getAssetStatus } = require('./asset-status');
const { resolveAssets } = require('./asset-resolve');
const {
  detectImageGenerator,
  getMaterialSourcingGuidance,
} = require('./ai-image');
const { throwCommandError, throwStatus } = require('../core/command-errors');

function printHelp() {
  console.log(`
用法:
  openyida asset status [--offline] [--json]
  openyida asset resolve --hero <路径或URL> [--product <路径或URL> ...] [--require-hero] [--upload-assets] [--offline] [--json]
  openyida asset generate [--json]

子命令:
  status       检测当前素材能力：是否配置 CDN、是否可生成、推荐素材策略
  resolve      把本地/外链素材解析为稳定 URL 并回填，输出 materialStatus(final|draft|none) 与缺口
  generate     输出素材来源引导（免费可商用素材库清单 + 使用纪律，供智能体检索真实图片）

说明:
  openyida 无内置文生图能力；图片应由智能体自行生成或到免费素材库检索，
  再通过 resolve 解析，并在配置 CDN 时转存后回填 spec。
`);
}

function parseArgs(args) {
  const parsed = {
    subCommand: args[0],
    hero: '',
    products: [],
    requireHero: false,
    offline: false,
    uploadAssets: false,
    timeout: 0,
    json: false,
    help: false,
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--json') {
      parsed.json = true;
    } else if (arg === '--offline') {
      parsed.offline = true;
    } else if (arg === '--require-hero') {
      parsed.requireHero = true;
    } else if (arg === '--upload-assets' || arg === '--mirror-external') {
      parsed.uploadAssets = true;
    } else if (arg === '--hero') {
      parsed.hero = args[++i] || '';
    } else if (arg === '--product') {
      const v = args[++i];
      if (v) {parsed.products.push(v);}
    } else if (arg === '--timeout') {
      parsed.timeout = parseInt(args[++i], 10) || 0;
    }
  }

  return parsed;
}

function runStatus(options) {
  const status = getAssetStatus({ online: !options.offline });
  if (options.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }
  console.log('素材能力检测');
  console.log('  CDN 已配置    : ' + (status.cdnConfigured ? '是' : '否'));
  console.log('  可上传转存    : ' + (status.canUpload ? '是' : '否'));
  console.log('  可 AI 生成    : ' + (status.canGenerate ? '是' : '否（由智能体生成/检索素材）'));
  console.log('  推荐素材策略  : ' + status.recommendedStrategy);
  console.log('  CDN 配置文件  : ' + status.cdn.configPath);
  if (status.cdn.missing.length) {
    console.log('  缺失 CDN 字段 : ' + status.cdn.missing.join(', '));
  }
  console.log('原因/建议:');
  status.reasons.forEach((r) => console.log('  - ' + r));
}

async function runResolve(options) {
  const assets = {
    heroImage: options.hero,
    productImages: options.products,
  };
  const result = await resolveAssets(assets, {
    requireHero: options.requireHero,
    online: !options.offline,
    mirrorExternal: !!options.uploadAssets,
    timeout: options.timeout || undefined,
  });
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log('素材解析结果');
  console.log('  materialStatus : ' + result.materialStatus +
    (result.materialStatus === 'final' ? '（可交付最终版）'
      : result.materialStatus === 'draft' ? '（仅可交付标注缺口的草稿）'
        : '（无可用素材，只能低保真草稿）'));
  console.log('  strategy       : ' + result.strategy);
  console.log('  Hero           : ' + (result.assets.heroImage || '(无)'));
  console.log('  产品图         : ' + (result.assets.productImages.length
    ? result.assets.productImages.join(', ') : '(无)'));
  if (result.materialGaps.length) {
    console.log('素材缺口:');
    result.materialGaps.forEach((g) => console.log('  - ' + g));
  }
  // 非 final 时以非零退出码提示调用方（生成链路可据此拦截「最终版」）
  if (result.materialStatus !== 'final') {
    throwStatus('素材未达到 final 状态', 2, {
      code: 'ASSET_MATERIAL_NOT_FINAL',
      details: result,
    });
  }
}

function runGenerate(options) {
  const generator = detectImageGenerator();
  const guidance = getMaterialSourcingGuidance();
  if (options.json) {
    console.log(JSON.stringify({ generator, guidance }, null, 2));
    return;
  }
  console.log('图片生成能力: ' + (generator.available ? '可用' : '不可用'));
  console.log('  ' + generator.reason);
  console.log('\n素材来源步骤:');
  guidance.steps.forEach((s) => console.log('  ' + s));
  console.log('\n免费可商用素材库:');
  guidance.libraries.forEach((lib) => {
    console.log('  · ' + lib.name + ' (' + lib.site + ')');
    console.log('    授权: ' + lib.license);
    console.log('    适合: ' + lib.bestFor);
  });
  console.log('\n纪律:');
  guidance.rules.forEach((r) => console.log('  - ' + r));
}

async function run(args) {
  const options = parseArgs(args || []);
  if (options.help || !options.subCommand) {
    printHelp();
    return;
  }
  switch (options.subCommand) {
    case 'status':
      runStatus(options);
      break;
    case 'resolve':
      await runResolve(options);
      break;
    case 'generate':
      runGenerate(options);
      break;
    default:
      printHelp();
      throwCommandError('未知子命令: ' + options.subCommand, {
        code: 'ASSET_UNKNOWN_SUBCOMMAND',
      });
  }
}

module.exports = { run, parseArgs };
