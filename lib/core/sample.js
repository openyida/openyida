/**
 * sample.js - 输出代码示例/模板文件到工作目录
 *
 * 用法：
 *   openyida sample --list                          列出所有可用 sample
 *   openyida sample <skill> <name>                  输出到 .cache/samples/<name>.js
 *   openyida sample <skill> <name> --output <路径>  输出到指定路径
 *   openyida sample <skill> <name> --var KEY=VALUE  替换模板变量 {{KEY}}
 *
 * 示例：
 *   openyida sample yida-chart line-trend
 *   openyida sample yida-custom-page custom-page-template --output pages/src/my-page.jsx
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
    'product-homepage':     'product-homepage.jsx',
    'todo-mvc':             'todo-mvc.oyd.jsx',
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
  const { c, banner, listItem } = require('./chalk');

  banner('Sample Templates', { subtitle: '可用的代码示例/模板', stderr: false });
  for (const [skill, samples] of Object.entries(SAMPLES)) {
    console.log(`\n  ${c.bold}${c.cyan}${skill}${c.reset}`);
    for (const [name] of Object.entries(samples)) {
      console.log(`    ${c.green}openyida sample ${skill} ${name}${c.reset}`);
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

/**
 * 解析 --output 与 --var KEY=VALUE 参数。
 * @param {string[]} rest
 * @param {string} defaultOutputPath
 * @returns {{ outputPath: string, variables: Object }}
 */
function parseOptions(rest, defaultOutputPath) {
  let outputPath = defaultOutputPath;
  const variables = {};

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];

    if (arg === '--output' && rest[i + 1]) {
      outputPath = rest[i + 1];
      i++;
      continue;
    }

    if (arg === '--var' && rest[i + 1]) {
      const pair = rest[i + 1];
      const eqIndex = pair.indexOf('=');
      if (eqIndex > 0) {
        const key = pair.slice(0, eqIndex).trim();
        const value = pair.slice(eqIndex + 1);
        if (key) {
          variables[key] = value;
        }
      }
      i++;
      continue;
    }
  }

  return { outputPath, variables };
}

/**
 * 替换模板变量 {{KEY}}。
 * @param {string} content
 * @param {Object} variables
 * @returns {string}
 */
function applyTemplateVariables(content, variables) {
  return Object.keys(variables).reduce((result, key) => {
    const token = new RegExp(`\\{\\{${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}\\}`, 'g');
    return result.replace(token, variables[key]);
  }, content);
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

  const { c, error: chalkError, success: chalkSuccess, hint: chalkHint } = require('./chalk');

  // 校验 skill
  if (!SAMPLES[skill]) {
    chalkError(`未知技能：${skill}`, { hint: `可用技能：${Object.keys(SAMPLES).join(', ')}\n  使用 openyida sample --list 查看所有可用 sample` });
  }

  // 校验 name
  if (!name) {
    chalkError('请指定 sample 名称', { hint: `${skill} 可用的 sample：${Object.keys(SAMPLES[skill]).join(', ')}` });
  }

  const filename = SAMPLES[skill][name];
  if (!filename) {
    chalkError(`未知 sample：${name}`, { hint: `${skill} 可用的 sample：${Object.keys(SAMPLES[skill]).join(', ')}` });
  }

  // 解析源文件路径
  const sourcePath = resolveSampleSourcePath(skill, filename);
  if (!fs.existsSync(sourcePath)) {
    chalkError(`sample 文件不存在：${sourcePath}`, { hint: '请确认 openyida 已正确安装（npm install -g openyida@latest）' });
  }

  // 解析输出路径与模板变量
  const defaultOutputPath = path.join(process.cwd(), '.cache', 'samples', filename);
  const { outputPath, variables } = parseOptions(rest, defaultOutputPath);

  // 写入文件
  ensureDirectoryExists(outputPath);
  const sourceContent = fs.readFileSync(sourcePath, 'utf-8');
  const outputContent = applyTemplateVariables(sourceContent, variables);
  fs.writeFileSync(outputPath, outputContent, 'utf-8');

  chalkSuccess(`sample 已输出到：${c.cyan}${outputPath}${c.reset}`);
  chalkHint('使用 read_file 读取该文件作为代码模板参考。可通过 --var KEY=VALUE 替换 {{KEY}} 模板变量。');
}

module.exports = { run, applyTemplateVariables, parseOptions };
