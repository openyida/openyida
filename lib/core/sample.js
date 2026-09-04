/**
 * sample.js - 输出代码示例/模板文件到工作目录
 *
 * 用法：
 *   openyida sample --list                          列出所有可用 sample
 *   openyida sample <skill> <name>                  输出到 .cache/samples/<name>.js
 *   openyida sample <skill> <name> --output <路径>  输出到指定路径
 *   openyida sample <skill> <name> --var KEY=VALUE  替换模板变量 {{KEY}}
 *   openyida sample yida-design app-theme --design-file <design.md>  按设计 token 生成应用主题
 *
 * 示例：
 *   openyida sample yida-chart line-trend
 *   openyida sample yida-chart line-trend --output pages/src/chart.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { CliError } = require('./cli-error');

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
  'yida-rechart': {
    'trend-combo': 'trend-combo.canvas.jsx',
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
  'yida-canvas-table-form': {
    'table-form-batch-submit': 'table-form-batch-submit.canvas.jsx',
  },
  'openyida-page-template': {
    'form-fields': 'form-fields.json',
    'canvas-form-drawer': 'canvas-form-drawer.canvas.jsx',
    'form-open-container': 'canvas-form-drawer.canvas.jsx',
    'canvas-dialog': 'canvas-dialog.canvas.jsx',
  },
  'yida-design': {
    'app-theme': 'app-custom-theme-template.css',
  },
  'yida-table-form': {
    'table-form-batch-submit': 'table-form-batch-submit.js',
  },
};

const SAMPLE_SOURCE_DIRECTORIES = {
  'openyida-page-template': 'openyida-scaffold',
};

const SAMPLE_SOURCE_FILES = {
  'yida-design/app-theme': path.join(
    __dirname,
    '..',
    '..',
    'yida-skills',
    'skills',
    'yida-design',
    'references',
    'theme',
    'app-custom-theme-template.css'
  ),
};

const SAMPLE_OUTPUT_FILENAMES = {
  'openyida-page-template/form-open-container': 'form-open-container.jsx',
  'openyida-page-template/canvas-dialog': 'canvas-dialog.jsx',
  'yida-design/app-theme': 'app-theme.css',
};

const SAMPLE_HINTS = {
  'openyida-page-template/form-open-container': '将 import、抽屉组件和辅助函数合并到现有 Canvas 页面；表单使用 useYidaFormOpen，其他内容使用 CanvasDrawer。',
  'yida-design/app-theme': '已复制应用主题模板；请由 yida-design 按 design.md 定点修改需要变化的 token。',
};

// ── 工具函数 ──────────────────────────────────────────────────────────

/**
 * 解析 sample 文件在 npm 包中的绝对路径
 * @param {string} skill
 * @param {string} name
 * @param {string} filename
 * @returns {string}
 */
function resolveSampleSourcePath(skill, name, filename) {
  const sourceFile = SAMPLE_SOURCE_FILES[`${skill}/${name}`];
  if (sourceFile) {
    return sourceFile;
  }
  const sourceDirectory = SAMPLE_SOURCE_DIRECTORIES[skill] || skill;
  return path.join(__dirname, '..', 'samples', sourceDirectory, filename);
}

/**
 * 打印所有可用代码模板列表
 */
function printSampleList() {
  const { c, banner } = require('./chalk');

  banner('Code Templates', { subtitle: '可用的代码模板', stderr: false });
  for (const [skill, samples] of Object.entries(SAMPLES)) {
    console.log(`\n  ${c.bold}${c.cyan}${skill}${c.reset}`);
    for (const [name] of Object.entries(samples)) {
      console.log(`    ${c.green}openyida sample ${skill} ${name}${c.reset}`);
    }
  }
  console.log('');
  console.log('  应用主题：openyida sample yida-design app-theme --output <app-theme.css> --design-file <design.md>');
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
  let designFile;
  const variables = {};

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];

    if (arg === '--design-file') {
      if (!rest[i + 1] || rest[i + 1].startsWith('--')) {
        throw new CliError('--design-file 缺少 design.md 路径', { code: 'DESIGN_THEME_FILE_REQUIRED' });
      }
      designFile = rest[++i];
      continue;
    }

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

  return { outputPath, variables, designFile };
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
  if (args.includes('--list') || args.includes('--help') || args.includes('-h') || args.length === 0) {
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
  const sampleKey = `${skill}/${name}`;
  const sourcePath = resolveSampleSourcePath(skill, name, filename);
  if (!fs.existsSync(sourcePath)) {
    chalkError(`sample 文件不存在：${sourcePath}`, { hint: '请确认 openyida 已正确安装（npm install -g openyida@latest）' });
  }

  // 解析输出路径与模板变量
  const outputFilename = SAMPLE_OUTPUT_FILENAMES[sampleKey] || filename;
  const defaultOutputPath = path.join(process.cwd(), '.cache', 'samples', outputFilename);
  const { outputPath, variables, designFile } = parseOptions(rest, defaultOutputPath);
  if (path.resolve(outputPath) === path.resolve(sourcePath) || (designFile && path.resolve(outputPath) === path.resolve(designFile))) {
    throw new CliError('输出路径不能覆盖模板或 design.md', { code: 'SAMPLE_OUTPUT_CONFLICT' });
  }
  let themeContent;
  if (designFile) {
    if (sampleKey !== 'yida-design/app-theme') {
      throw new CliError('--design-file 仅用于 yida-design app-theme', { code: 'DESIGN_THEME_SAMPLE_INVALID' });
    }
    const { applyDesignTokens } = require('../app/theme-from-design');
    themeContent = applyDesignTokens(fs.readFileSync(sourcePath, 'utf8'), fs.readFileSync(designFile, 'utf8'));
  }

  // 写入文件
  ensureDirectoryExists(outputPath);
  if (themeContent !== undefined) {
    const temporary = `${outputPath}.${process.pid}.tmp`;
    try {
      fs.copyFileSync(sourcePath, temporary);
      fs.writeFileSync(temporary, themeContent, 'utf8');
      fs.renameSync(temporary, outputPath);
    } finally {
      fs.rmSync(temporary, { force: true });
    }
  } else if (sampleKey === 'openyida-page-template/form-open-container') {
    const sourceContent = fs.readFileSync(sourcePath, 'utf8');
    const fragment = sourceContent.match(/\/\/ @openyida-form-drawer:start\r?\n([\s\S]*?)\/\/ @openyida-form-drawer:end/);
    if (!fragment) {
      throw new CliError('抽屉模板缺少共享代码片段', { code: 'SAMPLE_FRAGMENT_MISSING' });
    }
    fs.writeFileSync(outputPath, applyTemplateVariables(fragment[1], variables), 'utf8');
  } else if (Object.keys(variables).length === 0) {
    fs.copyFileSync(sourcePath, outputPath);
  } else {
    const sourceContent = fs.readFileSync(sourcePath, 'utf-8');
    const outputContent = applyTemplateVariables(sourceContent, variables);
    fs.writeFileSync(outputPath, outputContent, 'utf-8');
  }

  chalkSuccess(`模板文件已复制到：${c.cyan}${outputPath}${c.reset}`);
  chalkHint(designFile ? '已按 design.md 应用 token；使用 --theme-file 在应用级配置主题。' :
    SAMPLE_HINTS[sampleKey] || '请读取文件并按当前业务需求修改；发布前移除模板标记、示例数据和占位文案。');
}

module.exports = { run, applyTemplateVariables, parseOptions };
