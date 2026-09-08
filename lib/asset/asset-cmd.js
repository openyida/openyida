'use strict';

const fs = require('fs');
const path = require('path');
const { getAssetStatus } = require('./asset-status');
const { resolveAssets, ASSET_SOURCES } = require('./asset-resolve');
const { detectImageGenerator, getMaterialSourcingGuidance } = require('./ai-image');
const { throwCommandError, throwStatus, throwUsage } = require('../core/command-errors');

const RESOLVE_USAGE = '用法: openyida asset resolve (--input <manifest-draft.json> | --slot <slotId>=<路径或URL> ...) [--manifest <asset-manifest.json>] [--source search|user|generated] [--upload-assets] [--offline] [--json]';

function printHelp() {
  console.log(`
用法:
  openyida asset status [--offline] [--json]
  openyida asset resolve (--input <manifest-draft.json> | --slot <slotId>=<路径或URL> ...) [--manifest <asset-manifest.json>] [--source search|user|generated] [--upload-assets] [--offline] [--json]
  openyida asset sources [--json]

子命令:
  status    检测素材能力
  resolve   校验图片并生成 asset manifest
  sources   输出 Unsplash/Pexels 使用规则
`);
}

function parseSlot(value) {
  const index = String(value || '').indexOf('=');
  if (index <= 0 || index === String(value).length - 1) {return null;}
  const slotId = String(value).slice(0, index).trim();
  const input = String(value).slice(index + 1).trim();
  if (!slotId || !input) {return null;}
  return {
    slotId,
    input,
    required: true,
  };
}

function parseArgs(args) {
  const parsed = {
    subCommand: args[0],
    slots: [],
    input: '',
    manifest: '',
    offline: false,
    uploadAssets: false,
    source: 'search',
    timeout: 0,
    json: false,
    help: false,
    errors: [],
    usedOptions: [],
  };
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--json') {
      parsed.usedOptions.push('--json');
      parsed.json = true;
    } else if (arg === '--offline') {
      parsed.usedOptions.push('--offline');
      parsed.offline = true;
    } else if (arg === '--upload-assets') {
      parsed.usedOptions.push('--upload-assets');
      parsed.uploadAssets = true;
    } else if (arg === '--source') {
      parsed.usedOptions.push('--source');
      parsed.source = args[++i] || '';
    } else if (arg === '--input') {
      parsed.usedOptions.push('--input');
      parsed.input = args[++i] || '';
    } else if (arg === '--manifest') {
      parsed.usedOptions.push('--manifest');
      parsed.manifest = args[++i] || '';
    } else if (arg === '--slot') {
      parsed.usedOptions.push('--slot');
      const slot = parseSlot(args[++i]);
      if (slot) {parsed.slots.push(slot);} else {parsed.errors.push('--slot 格式应为 <slotId>=<路径或URL>');}
    } else if (arg === '--timeout') {
      parsed.usedOptions.push('--timeout');
      parsed.timeout = parseInt(args[++i], 10) || 0;
    } else {
      parsed.errors.push(`未知参数：${arg}`);
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
  console.log('  CDN 已配置 : ' + (status.cdnConfigured ? '是' : '否'));
  console.log('  可上传     : ' + (status.canUpload ? '是' : '否'));
  console.log('  可生成图片 : ' + (status.canGenerate === true ? '是' : status.canGenerate === false ? '否' : '未确认'));
  console.log('  建议策略   : ' + status.recommendedStrategy);
  status.reasons.forEach(reason => console.log('  - ' + reason));
}

function readDraft(filePath) {
  let draft;
  try {
    draft = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
  } catch (error) {
    throwCommandError(`无法读取素材草稿：${error.message}`, { code: 'ASSET_INPUT_INVALID' });
  }
  if (!draft || !Array.isArray(draft.assets)) {
    throwCommandError('素材草稿必须包含 assets 数组', { code: 'ASSET_INPUT_INVALID' });
  }
  return draft.assets;
}

function writeManifest(filePath, manifest) {
  const target = path.resolve(filePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return target;
}

async function runResolve(options) {
  if (options.errors.length > 0) {
    throwUsage(options.errors.join('\n'), RESOLVE_USAGE, { code: 'ASSET_INVALID_ARGUMENTS' });
  }
  if (options.input && options.slots.length > 0) {
    throwUsage('--input 与 --slot 不能同时使用', RESOLVE_USAGE, { code: 'ASSET_INPUT_CONFLICT' });
  }
  if (!ASSET_SOURCES.includes(options.source)) {
    throwUsage('--source 仅支持 search、user 或 generated', RESOLVE_USAGE, { code: 'ASSET_INVALID_SOURCE' });
  }
  const assets = [
    ...(options.input ? readDraft(options.input) : []),
    ...options.slots.map(slot => ({ ...slot, source: options.source })),
  ];
  if (assets.length === 0 && !options.input) {
    throwUsage('至少提供一个 --slot 或 --input', RESOLVE_USAGE, { code: 'ASSET_INPUT_REQUIRED' });
  }

  const result = await resolveAssets(assets, {
    online: !options.offline,
    mirrorExternal: !!options.uploadAssets,
    assetSource: options.source,
    timeout: options.timeout || undefined,
  });
  const manifestPath = options.manifest ? writeManifest(options.manifest, result) : '';
  if (result.materialStatus === 'draft') {
    throwStatus('素材未达到 final 状态', 2, {
      code: 'ASSET_MATERIAL_NOT_FINAL',
      details: { ...result, manifestPath },
    });
  }
  if (options.json) {
    console.log(JSON.stringify({ ...result, manifestPath }, null, 2));
    return;
  }
  console.log('素材状态: ' + result.materialStatus);
  console.log('素材数量: ' + result.assets.length);
  if (manifestPath) {console.log('素材清单: ' + manifestPath);}
}

function runSources(options) {
  const status = getAssetStatus();
  const output = {
    generator: detectImageGenerator({ hostCapabilities: status.hostCapabilities }),
    guidance: getMaterialSourcingGuidance(),
  };
  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }
  console.log('图片来源: 用户素材、Unsplash、Pexels 或宿主生成');
  output.guidance.rules.forEach(rule => console.log('  - ' + rule));
}

async function run(args) {
  const options = parseArgs(args || []);
  if (options.help || !options.subCommand) {
    printHelp();
    return;
  }
  const allowedOptions = {
    status: new Set(['--offline', '--json']),
    sources: new Set(['--json']),
  };
  if (allowedOptions[options.subCommand]) {
    const invalid = options.usedOptions.filter(option => !allowedOptions[options.subCommand].has(option));
    const errors = [...options.errors, ...invalid.map(option => `参数不适用于 ${options.subCommand}：${option}`)];
    if (errors.length > 0) {
      throwCommandError(errors.join('\n'), { code: 'ASSET_INVALID_ARGUMENTS' });
    }
  }
  if (options.subCommand === 'status') {runStatus(options); return;}
  if (options.subCommand === 'resolve') {await runResolve(options); return;}
  if (options.subCommand === 'sources') {runSources(options); return;}
  throwCommandError(`未知子命令：${options.subCommand}`, { code: 'ASSET_UNKNOWN_SUBCOMMAND' });
}

module.exports = {
  run,
  parseArgs,
  parseSlot,
  readDraft,
  writeManifest,
};
