/**
 * sample.js - 输出代码示例/模板文件到工作目录
 *
 * 用法：
 *   openyida sample --list                          列出所有可用 sample
 *   openyida sample <skill> <name>                  输出到 .cache/samples/<name>.js
 *   openyida sample <skill> <name> --output <路径>  输出到指定路径
 *
 * 示例：
 *   openyida sample yida-chart line-trend
 *   openyida sample yida-custom-page custom-page-template --output pages/src/my-page.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Sample 索引表 ─────────────────────────────────────────────────────

const SAMPLES = {
  'yida-chart': {
    'line-trend':        'line-trend.js',
    'multi-bar-compare': 'multi-bar-compare.js',
    'radar-chart':       'radar-chart.js',
    'stacked-area':      'stacked-area.js',
    'china-map':         'china-map.js',
    'dashboard-bindform':'dashboard-bindform.js',
    'scatter-bindform':  'scatter-bindform.js',
  },
  'yida-custom-page': {
    'custom-page-template': 'custom-page-template.js',
    'design-tokens':        'design-tokens.js',
  },
  'yida-create-app': {
    'ipd-app-template': 'ipd-app-template.js',
  },
  'yida-data-management': {
    'form-field-template': 'form-field-template.js',
  },
  'yida-density': {
    'density-switch-page': 'density-switch-page.js',
  },
  'yida-table-form': {
    'table-form-batch-submit': 'table-form-batch-submit.js',
  },
};

// ── 工具函数 ──────────────────────────────────────────────────────────

/**
 * 解析 sample 文件在 npm 包中的绝对路径
 * @param {string} skill
 * @param {string} filename
 * @returns {string}
 */
function resolveSampleSourcePath(skill, filename) {
  return path.join(__dirname, '..', 'samples', skill, filename);
}

/**
 * 打印所有可用 sample 列表
 */
function printSampleList() {
  console.log('\n可用 sample 列表：\n');
  for (const [skill, samples] of Object.entries(SAMPLES)) {
    console.log(`  ${skill}`);
    for (const [name] of Object.entries(samples)) {
      console.log(`    openyida sample ${skill} ${name}`);
    }
  }
  console.log('');
}

/**
 * 确保目标目录存在
 * @param {string} filePath
 */
function ensureDirectoryExists(filePath) {
  const directory = path.dirname(filePath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

// ── 主逻辑 ────────────────────────────────────────────────────────────

/**
 * sample 命令主入口
 * @param {string[]} args
 */
async function run(args) {
  // --list 模式
  if (args.includes('--list') || args.length === 0) {
    printSampleList();
    return;
  }

  const [skill, name, ...rest] = args;

  // 校验 skill
  if (!SAMPLES[skill]) {
    console.error(`未知技能：${skill}`);
    console.error(`可用技能：${Object.keys(SAMPLES).join(', ')}`);
    console.error('使用 openyida sample --list 查看所有可用 sample');
    process.exit(1);
  }

  // 校验 name
  if (!name) {
    console.error(`请指定 sample 名称`);
    console.error(`${skill} 可用的 sample：${Object.keys(SAMPLES[skill]).join(', ')}`);
    process.exit(1);
  }

  const filename = SAMPLES[skill][name];
  if (!filename) {
    console.error(`未知 sample：${name}`);
    console.error(`${skill} 可用的 sample：${Object.keys(SAMPLES[skill]).join(', ')}`);
    process.exit(1);
  }

  // 解析源文件路径
  const sourcePath = resolveSampleSourcePath(skill, filename);
  if (!fs.existsSync(sourcePath)) {
    console.error(`sample 文件不存在：${sourcePath}`);
    console.error('请确认 openyida 已正确安装（npm install -g openyida@latest）');
    process.exit(1);
  }

  // 解析输出路径
  const outputIndex = rest.indexOf('--output');
  const outputPath = outputIndex !== -1 && rest[outputIndex + 1]
    ? rest[outputIndex + 1]
    : path.join(process.cwd(), '.cache', 'samples', filename);

  // 写入文件
  ensureDirectoryExists(outputPath);
  fs.copyFileSync(sourcePath, outputPath);

  console.log(`✓ sample 已输出到：${outputPath}`);
  console.error(`\n提示：使用 read_file 读取该文件作为代码模板参考。`);
}

module.exports = { run };
