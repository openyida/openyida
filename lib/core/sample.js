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
    'canvas-theme': 'canvas-theme-provider.template.jsx',
    'canvas-navigation': 'canvas-navigation.jsx',
    'canvas-view-state': 'canvas-view-state.jsx',
    'canvas-admin-entry': 'canvas-admin-entry.jsx',
    'canvas-nav-side': 'canvas-nav/side.jsx',
    'canvas-nav-top': 'canvas-nav/top.jsx',
    'canvas-nav-mixed': 'canvas-nav/mixed.jsx',
    'canvas-nav-dock': 'canvas-nav/dock.jsx',
    'canvas-nav-tabs': 'canvas-nav/tabs.jsx',
    'canvas-nav-data': 'canvas-nav/data.jsx',
    'canvas-nav-content': 'canvas-nav/content.jsx',
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
  'openyida-page-template/canvas-theme': path.join(__dirname, '../../yida-skills/skills/yida-canvas-custom-page/scripts/canvas-theme-provider.template.jsx'),
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
  'openyida-page-template/canvas-nav-side': 'canvas-nav-side.jsx',
  'openyida-page-template/canvas-nav-top': 'canvas-nav-top.jsx',
  'openyida-page-template/canvas-nav-mixed': 'canvas-nav-mixed.jsx',
  'openyida-page-template/canvas-nav-dock': 'canvas-nav-dock.jsx',
  'openyida-page-template/canvas-nav-tabs': 'canvas-nav-tabs.jsx',
  'openyida-page-template/canvas-nav-data': 'canvas-nav-data.jsx',
  'openyida-page-template/canvas-nav-content': 'canvas-nav-content.jsx',
  'openyida-page-template/form-open-container': 'form-open-container.jsx',
  'openyida-page-template/canvas-dialog': 'canvas-dialog.jsx',
  'openyida-page-template/canvas-theme': 'canvas-theme.jsx',
  'yida-design/app-theme': 'app-theme.css',
};

const SAMPLE_HINTS = {
  'openyida-page-template/canvas-admin-entry': '已包含统一跳转 helper；在 CanvasThemeProvider 内渲染 CanvasAdminWorkbenchButton，填写当前 appType 与真实 workbenchFormUuid。身份读取当前应用 loginUser.isAppAdmin，未知时隐藏；默认不跳开发后台或猜测管理首页。',
  'openyida-page-template/canvas-navigation': '先从资源回读填写 appType、目标类型与页面 ID；本页 Tab 用 selectView，独立前台用 custom，管理入口用 page，表单入口接 openForm；按钮和链接共用 buildCanvasPageUrl。',
  'openyida-page-template/canvas-theme': '以 CanvasThemeProvider 包住业务组件；Tabs 用于内容切换，Segmented/Radio 用于筛选，Button 用于动作。默认轻底选中态与可读文字，controls 可供自绘控件复用；避免内层固定色覆盖。保留内置加载遮罩防闪边样式；旧页面需更新 Provider 并重新发布。',
  'openyida-page-template/canvas-nav-top': '顶部默认贴顶通栏；长页先合并 canvas-nav-content，CanvasNav 传 headerOnly，有首屏背景时传 overlay；悬浮外观仅显式 floating=true。',
  'openyida-page-template/canvas-nav-content': '合并 CanvasNavigationContent；长页用 layout=document，CanvasNav 传 headerOnly/overlay；默认 sticky，受宿主限制时用 navigationPosition=fixed。工作区用 workspace，宿主已分配高度时传 height。',
  'openyida-page-template/canvas-nav-data': '页内展示用 mode=local（key/viewKey/targetType=local），不请求平台菜单；platform 需真实资源 ID；independent 或声明 access 时必须接入真实 resolveAccess。保留 PRD 顺序与分组。',
  'openyida-page-template/form-open-container': '将 import、CanvasDrawer、FormOpenContainer、useYidaFormOpen 和辅助函数合并到现有 Canvas 页面；表单按钮调用 openForm(request)，页面必须渲染返回的 formOpenContainer；保留 iframe、标题栏操作、调宽和关闭刷新。普通业务内容使用 CanvasDrawer；抽屉背景为 --pod-shell-theme-bg-color。',
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
  const isNavSample = skill === 'openyida-page-template' && name.startsWith('canvas-nav-');
  const prefixPath = sampleKey === 'openyida-page-template/canvas-admin-entry' ? path.join(path.dirname(sourcePath), 'canvas-navigation.jsx')
    : isNavSample && !['canvas-nav-tabs', 'canvas-nav-data', 'canvas-nav-content'].includes(name) ? path.join(path.dirname(sourcePath), 'shared.jsx') : null;
  const sidebarPath = isNavSample && ['canvas-nav-side', 'canvas-nav-mixed'].includes(name) ? path.join(path.dirname(sourcePath), 'sidebar.jsx') : null;
  if ([sourcePath, prefixPath, sidebarPath, designFile].filter(Boolean).some(file => path.resolve(outputPath) === path.resolve(file))) {
    throw new CliError('输出路径不能覆盖模板或 design.md', { code: 'SAMPLE_OUTPUT_CONFLICT' });
  }
  let themeFiles;
  if (designFile && sampleKey !== 'yida-design/app-theme') {
    throw new CliError('--design-file 仅用于 yida-design app-theme', { code: 'DESIGN_THEME_SAMPLE_INVALID' });
  }
  if (sampleKey === 'yida-design/app-theme') {
    const snapshotPath = `${outputPath}.tokens.md`;
    if (designFile && path.resolve(snapshotPath) === path.resolve(designFile)) {
      throw new CliError('输出路径不能覆盖模板或 design.md', { code: 'SAMPLE_OUTPUT_CONFLICT' });
    }
    const template = fs.readFileSync(sourcePath, 'utf8');
    // Template-only exports must pass the same checks as generated/uploaded CSS.
    require('../app/custom-theme').validateThemeCssContent(template);
    if (designFile) {
      const { applyDesignTokens, readDesignTokens } = require('../app/theme-from-design');
      const markdown = fs.readFileSync(designFile, 'utf8');
      // Both authoring modes use the same final-document contract. Older token-
      // only files still support incremental theme updates without migration.
      const frontmatter = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)?.[1] || '';
      if (/^["']?schemaVersion["']?\s*:/m.test(frontmatter)) {
        require('../design/document').validateDesignDocument(markdown);
      }
      const existing = fs.existsSync(outputPath);
      const previous = existing && fs.existsSync(snapshotPath) ? fs.readFileSync(snapshotPath, 'utf8') : undefined;
      const css = applyDesignTokens(existing ? fs.readFileSync(outputPath, 'utf8') : template, markdown, previous);
      const snapshot = ['---', 'tokens:', ...Object.entries(readDesignTokens(markdown)).map(([name, value]) =>
        `  ${JSON.stringify(name)}: ${JSON.stringify(value)}`), '---', ''].join('\n');
      themeFiles = [[outputPath, css], [snapshotPath, snapshot]];
    } else {
      themeFiles = [[outputPath, template]];
      if (fs.existsSync(snapshotPath)) { themeFiles.push([snapshotPath, '']); }
    }
  }

  // Stage the CSS and its last-applied tokens together; failed writes restore both.
  ensureDirectoryExists(outputPath);
  if (themeFiles) {
    require('../design-plan/files').writeFiles(themeFiles.filter(([file, content]) =>
      !fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content));
  } else if (prefixPath) {
    const content = [prefixPath, sidebarPath, sourcePath].filter(Boolean).map(file => fs.readFileSync(file, 'utf8')).join('\n');
    fs.writeFileSync(outputPath, applyTemplateVariables(content, variables), 'utf8');
  } else if (sampleKey === 'openyida-page-template/canvas-theme') {
    const { buildApplicationProvider } = require('../../yida-skills/skills/yida-canvas-custom-page/scripts/build-canvas-theme');
    fs.writeFileSync(outputPath, buildApplicationProvider(), 'utf8');
  } else if (sampleKey === 'openyida-page-template/form-open-container') {
    const sourceContent = fs.readFileSync(sourcePath, 'utf8');
    const fragment = sourceContent.match(/\/\/ @openyida-form-drawer:start\r?\n([\s\S]*?)\/\/ @openyida-form-drawer:end/);
    if (!fragment) {
      throw new CliError('抽屉模板缺少共享代码片段', { code: 'SAMPLE_FRAGMENT_MISSING' });
    }
    fs.writeFileSync(outputPath, applyTemplateVariables(fragment[1], variables), 'utf8');
  } else {
    const { assembleApplicationTheme } = require('../../yida-skills/skills/yida-canvas-custom-page/scripts/build-canvas-theme');
    const sourceContent = fs.readFileSync(sourcePath, 'utf-8');
    const outputContent = applyTemplateVariables(assembleApplicationTheme(sourceContent), variables);
    fs.writeFileSync(outputPath, outputContent, 'utf-8');
  }

  chalkSuccess(`模板文件已复制到：${c.cyan}${outputPath}${c.reset}`);
  const navigationHint = isNavSample
    ? '平台导航页默认只实现业务内容，不合并第二套应用菜单；页内 Tab 仅切当前任务的分类或状态。确认独立入口或应用级自绘导航后再使用导航壳片段。'
    : '';
  const defaultHint = isNavSample
    ? '已输出所选导航组件；合并 import 后接入 items、activeKey、onSelect 和现有页面内容，样式直接消费应用 token。'
    : '请读取文件并按当前业务需求修改；发布前移除模板标记、示例数据和占位文案。';
  const sampleHint = SAMPLE_HINTS[sampleKey] || defaultHint;
  const hint = designFile
    ? '已按 design.md 应用 token；使用 --theme-file 在应用级配置主题。'
    : navigationHint + sampleHint;
  chalkHint(hint);
}

module.exports = { run, applyTemplateVariables, parseOptions };
