#!/usr/bin/env node
/**
 * postinstall hook: skills installation + Codex plugin import + welcome guide after `npm install -g openyida`
 *
 * 职责：
 *   1. 清理旧版本遗留的错误安装（~/.xxx/yida-skills/，缺少 skills/ 中间层级）
 *   2. 将 yida-skills/ 安装到各 AI 工具的正确 skills 目录
 *   3. Codex 已安装时，导入本地 Codex 插件，让用户可在 @ 菜单中选择「宜搭」
 *   4. 首次安装欢迎引导
 *
 * 正确的 skills 安装路径（所有工具统一使用 skills/ 子目录）：
 *   ~/.claude/skills/yida-skills/          ← <package>/yida-skills (copy)
 *   ~/.codex/skills/yida-skills/           ← <package>/yida-skills (copy)
 *   ~/.opencode/skills/yida-skills/        ← <package>/yida-skills (copy)
 *   ~/.aone_copilot/skills/yida-skills/    ← <package>/yida-skills (copy)
 *   ~/.cursor/skills/yida-skills/          ← <package>/yida-skills (copy)
 *   ~/.qoder/skills/yida-skills/           ← <package>/yida-skills (copy)
 *
 * 悟空（Wukong）通过手动上传技能，不在此安装。
 */

'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const PACKAGE_JSON = require(path.join(PACKAGE_ROOT, 'package.json'));
const SKILLS_DIR = path.join(PACKAGE_ROOT, 'yida-skills');
const HOME_DIR = os.homedir();
const CODEX_MARKETPLACE_NAME = 'openyida';
const CODEX_PLUGIN_NAME = 'openyida';
const CODEX_PLUGIN_LOGO_SVG = '<svg height="200" viewBox="0 0 1024 1024" width="200" xmlns="http://www.w3.org/2000/svg"><g fill="#0089ff"><path d="M966.743 0H57.498A57.197 57.197 0 0 0 .06 57.077v218.07a61.772 61.772 0 0 1 12.042 4.936L348.538 473.83l336.196-193.987a64.421 64.421 0 0 1 87.902 23.36l34.92 60.208a63.94 63.94 0 0 1-23.24 87.54L449.084 643.613v379.905h517.78a57.197 57.197 0 0 0 56.714-56.594V57.077A57.197 57.197 0 0 0 966.743 0z"/><path d="M.663 501.163v465.76a56.715 56.715 0 0 0 16.255 40.34 57.558 57.558 0 0 0 40.58 16.255H252.93V646.141z"/></g></svg>\n';

/**
 * Run fn silently — never throws.
 */
function safeExec(fn) {
  try {
    fn();
  } catch {
    /* ignore */
  }
}

/**
 * Recursively copy a directory, overwriting existing files.
 */
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) {return;}
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Write a JSON file with stable formatting.
 */
function writeJsonFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

/**
 * Escape a string for TOML output.
 */
function tomlString(value) {
  return JSON.stringify(value);
}

/**
 * Return an ISO timestamp without milliseconds for compact config churn.
 */
function nowIsoSeconds() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * 清理旧版遗留的错误路径（软链接或目录）。
 */
function cleanupLegacy(dirPath) {
  try {
    const stat = fs.lstatSync(dirPath);
    if (stat.isSymbolicLink()) {
      fs.unlinkSync(dirPath);
    } else if (stat.isDirectory()) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch {
    /* not exists, ok */
  }
}

/**
 * 将 yida-skills 安装到 AI 工具的 skills 目录。
 * 正确路径：~/<tool-config>/skills/yida-skills/
 *
 * 同时清理旧版遗留在根目录的错误安装：~/<tool-config>/yida-skills/
 */
function installSkillsToTool(toolConfigDir) {
  // 清理旧版遗留在根目录的错误安装（缺少 skills/ 中间层级）
  cleanupLegacy(path.join(toolConfigDir, 'yida-skills'));

  // 安装到正确路径：~/<tool-config>/skills/yida-skills/
  const skillsDir = path.join(toolConfigDir, 'skills');
  const destPath = path.join(skillsDir, 'yida-skills');

  fs.mkdirSync(skillsDir, { recursive: true });

  // 如果已存在，先清理（旧软链接或旧目录）
  cleanupLegacy(destPath);

  // 复制文件（不用软链接，确保 AI 工具首次扫描就能发现）
  copyDirRecursive(SKILLS_DIR, destPath);
}

/**
 * 构建 Codex 插件 manifest。
 */
function createCodexPluginManifest() {
  return {
    name: CODEX_PLUGIN_NAME,
    version: PACKAGE_JSON.version,
    description: 'OpenYida CLI plugin for building and managing Yida low-code apps from Codex.',
    author: {
      name: 'OpenYida Contributors',
      email: 'yize.shc@gmail.com',
      url: 'https://github.com/openyida/openyida',
    },
    homepage: 'https://github.com/openyida/openyida',
    repository: 'https://github.com/openyida/openyida',
    license: PACKAGE_JSON.license || 'MIT',
    keywords: ['openyida', 'yida', 'low-code', 'aliyun', 'codex'],
    skills: './skills/',
    interface: {
      displayName: '宜搭',
      shortDescription: '通过 OpenYida CLI 创建和管理宜搭应用、表单、页面与数据',
      longDescription: 'Use OpenYida from Codex to log in to Yida, create low-code apps, manage forms, publish custom pages, configure permissions, build reports, and query data through the openyida command line.',
      developerName: 'OpenYida Contributors',
      category: 'Productivity',
      capabilities: ['Interactive', 'Write'],
      websiteURL: 'https://github.com/openyida/openyida',
      privacyPolicyURL: 'https://github.com/openyida/openyida',
      termsOfServiceURL: 'https://github.com/openyida/openyida',
      defaultPrompt: [
        '帮我检查宜搭登录态并初始化项目',
        '帮我创建一个宜搭应用和表单',
        '帮我发布一个宜搭自定义页面',
      ],
      brandColor: '#FF6A00',
      composerIcon: './assets/logo.svg',
      logo: './assets/logo.svg',
    },
  };
}

/**
 * 构建 Codex 插件总入口技能。
 */
function createCodexPluginSkill() {
  return `---
name: openyida
description: >
  OpenYida / 宜搭总入口技能。用户提到宜搭、OpenYida、Yida、低代码应用、创建应用、创建表单、自定义页面、
  页面发布、权限、报表、连接器、流程、数据查询或登录态管理时使用。通过 openyida CLI 在 Codex 中操作宜搭平台。
---

# OpenYida 宜搭开发总入口

## 目标

使用 \`openyida\` CLI 帮用户在 Codex 中完成宜搭低代码平台操作，包括登录态检查、应用创建、表单管理、自定义页面开发、页面发布、权限配置、报表、连接器、流程和数据查询。

## 首要步骤

在执行任何会创建、修改或发布真实宜搭资源的操作前，先运行只读检查：

\`\`\`bash
openyida env --json
openyida login --check-only --json
\`\`\`

如果 \`openyida\` 不存在，先提醒用户需要安装，或在用户同意后执行：

\`\`\`bash
npm install -g openyida@latest
\`\`\`

若登录态无效，执行：

\`\`\`bash
openyida login
\`\`\`

登录完成后再次运行 \`openyida login --check-only --json\` 验证缓存写入，再继续真实资源操作。

## 工作目录

执行宜搭开发前检查当前工作区是否已有 \`project/\` 目录。没有时运行：

\`\`\`bash
openyida copy
\`\`\`

## 子技能索引

根据用户意图选择最匹配的子技能，并在执行前读取对应 \`SKILL.md\`：

| 意图 | 子技能 |
| --- | --- |
| 完整应用开发编排 | \`../yida-app/SKILL.md\` |
| 登录态管理 | \`../yida-login/SKILL.md\` |
| 退出登录 / 切换账号 | \`../yida-logout/SKILL.md\` |
| 创建应用 | \`../yida-create-app/SKILL.md\` |
| 创建自定义页面 | \`../yida-create-page/SKILL.md\` |
| 创建 / 更新表单页面 | \`../yida-create-form-page/SKILL.md\` |
| 创建流程表单 | \`../yida-create-process/SKILL.md\` |
| 获取表单 Schema | \`../yida-get-schema/SKILL.md\` |
| 自定义页面 JSX 开发 | \`../yida-custom-page/SKILL.md\` |
| 发布自定义页面 | \`../yida-publish-page/SKILL.md\` |
| 页面公开访问 / 分享配置 | \`../yida-page-config/SKILL.md\` |
| 表单权限 | \`../yida-form-permission/SKILL.md\` |
| 数据查询与管理 | \`../yida-data-management/SKILL.md\` |
| 流程规则 | \`../yida-process-rule/SKILL.md\` |
| 集成自动化 | \`../yida-integration/SKILL.md\` |
| HTTP 连接器 | \`../yida-connector/SKILL.md\` |
| 图表页面 | \`../yida-chart/SKILL.md\` |
| 原生报表 | \`../yida-report/SKILL.md\` |
| 公式字段 | \`../yida-formula/SKILL.md\` |
| 闪记 / 会议纪要转 PRD | \`../yida-flash-note-to-prd/SKILL.md\` |

## 执行规则

- 不要编造 \`appType\`、\`formUuid\`、\`fieldId\`、\`reportId\`；必须从命令输出、缓存或 schema 中读取。
- 同一命令失败后，根据错误信息检查登录态、组织、参数和字段 ID；不要无修改地连续重试。
- 自定义页面发布前先运行 \`openyida check-page\` 和 \`openyida compile\`。
- JSON 配置写入文件后先解析校验，再调用会修改平台资源的命令。
- 新增用户可见文案或 CLI 行为时，遵循当前 OpenYida 仓库的 \`AGENTS.md\` 开发规范。
`;
}

/**
 * 写入 Codex 本地 marketplace。
 */
function writeCodexMarketplace(marketplaceRoot) {
  writeJsonFile(path.join(marketplaceRoot, '.agents', 'plugins', 'marketplace.json'), {
    name: CODEX_MARKETPLACE_NAME,
    interface: {
      displayName: 'OpenYida',
    },
    plugins: [
      {
        name: CODEX_PLUGIN_NAME,
        source: {
          source: 'local',
          path: `./plugins/${CODEX_PLUGIN_NAME}`,
        },
        policy: {
          installation: 'INSTALLED_BY_DEFAULT',
          authentication: 'ON_INSTALL',
        },
        category: 'Productivity',
      },
    ],
  });
}

/**
 * 确保 Codex 配置中启用了 OpenYida marketplace 和插件。
 * 保守策略：只追加缺失 section；如果用户已经手动配置或禁用，不覆盖。
 */
function ensureCodexConfig(codexDir, marketplaceRoot) {
  const configPath = path.join(codexDir, 'config.toml');
  let config = '';

  if (fs.existsSync(configPath)) {
    config = fs.readFileSync(configPath, 'utf8');
  }

  const chunks = [];
  const pluginSection = `[plugins."${CODEX_PLUGIN_NAME}@${CODEX_MARKETPLACE_NAME}"]`;
  const marketplaceSection = `[marketplaces.${CODEX_MARKETPLACE_NAME}]`;

  if (!config.includes(pluginSection)) {
    chunks.push(`${pluginSection}\nenabled = true`);
  }

  if (!config.includes(marketplaceSection)) {
    chunks.push(
      `${marketplaceSection}\nlast_updated = ${tomlString(nowIsoSeconds())}\nsource_type = "local"\nsource = ${tomlString(marketplaceRoot)}`,
    );
  }

  if (chunks.length === 0) {return;}

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const prefix = config ? (config.endsWith('\n') ? '\n' : '\n\n') : '';
  fs.writeFileSync(configPath, `${config}${prefix}${chunks.join('\n\n')}\n`, 'utf8');
}

/**
 * 将 OpenYida 导入为 Codex 本地插件。
 */
function installCodexPlugin() {
  const codexDir = path.join(HOME_DIR, '.codex');
  if (!fs.existsSync(codexDir)) {return false;}

  const marketplaceRoot = path.join(HOME_DIR, '.openyida', 'codex-plugin');
  const pluginRoot = path.join(marketplaceRoot, 'plugins', CODEX_PLUGIN_NAME);

  cleanupLegacy(pluginRoot);
  fs.mkdirSync(path.join(pluginRoot, '.codex-plugin'), { recursive: true });

  writeJsonFile(
    path.join(pluginRoot, '.codex-plugin', 'plugin.json'),
    createCodexPluginManifest(),
  );

  fs.mkdirSync(path.join(pluginRoot, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(pluginRoot, 'assets', 'logo.svg'), CODEX_PLUGIN_LOGO_SVG, 'utf8');

  copyDirRecursive(path.join(SKILLS_DIR, 'skills'), path.join(pluginRoot, 'skills'));
  copyDirRecursive(path.join(SKILLS_DIR, 'references'), path.join(pluginRoot, 'references'));

  fs.mkdirSync(path.join(pluginRoot, 'skills', CODEX_PLUGIN_NAME), { recursive: true });
  fs.writeFileSync(
    path.join(pluginRoot, 'skills', CODEX_PLUGIN_NAME, 'SKILL.md'),
    createCodexPluginSkill(),
    'utf8',
  );

  writeCodexMarketplace(marketplaceRoot);
  ensureCodexConfig(codexDir, marketplaceRoot);

  return true;
}

// ── 1. Skills 安装 ───────────────────────────────────────────────────
// 安装到各 AI 工具的正确 skills 目录（悟空跳过，悟空通过手动上传技能）

let codexPluginInstalled = false;

// Claude Code — 始终安装（Claude Code 是主要目标用户）
safeExec(() => {
  installSkillsToTool(path.join(HOME_DIR, '.claude'));
});

// Codex — 仅在已安装时安装 skills，并导入本地插件
safeExec(() => {
  if (fs.existsSync(path.join(HOME_DIR, '.codex'))) {
    installSkillsToTool(path.join(HOME_DIR, '.codex'));
    codexPluginInstalled = installCodexPlugin();
  }
});

// OpenCode — 仅在已安装时安装
safeExec(() => {
  if (fs.existsSync(path.join(HOME_DIR, '.opencode'))) {
    installSkillsToTool(path.join(HOME_DIR, '.opencode'));
  }
});

// Aone Copilot — 仅在已安装时安装
safeExec(() => {
  if (fs.existsSync(path.join(HOME_DIR, '.aone_copilot'))) {
    installSkillsToTool(path.join(HOME_DIR, '.aone_copilot'));
  }
});

// Cursor — 仅在已安装时安装
safeExec(() => {
  if (fs.existsSync(path.join(HOME_DIR, '.cursor'))) {
    installSkillsToTool(path.join(HOME_DIR, '.cursor'));
  }
});

// Qoder — 仅在已安装时安装
safeExec(() => {
  if (fs.existsSync(path.join(HOME_DIR, '.qoder'))) {
    installSkillsToTool(path.join(HOME_DIR, '.qoder'));
  }
});

// 悟空（Wukong）— 跳过安装，只清理旧版遗留
safeExec(() => {
  cleanupLegacy(path.join(HOME_DIR, '.real', 'yida-skills'));
});

// ── 2. 首次安装欢迎引导 ──────────────────────────────────────────────

safeExec(() => {
  const FIRST_INSTALL_FLAG = path.join(HOME_DIR, '.openyida', 'installed');

  const isFirstInstall = !fs.existsSync(FIRST_INSTALL_FLAG);
  if (isFirstInstall) {
    fs.mkdirSync(path.dirname(FIRST_INSTALL_FLAG), { recursive: true });
    fs.writeFileSync(FIRST_INSTALL_FLAG, new Date().toISOString(), 'utf8');
  }

  printWelcomeGuide(isFirstInstall, codexPluginInstalled);
});

/**
 * 打印欢迎引导信息
 * @param {boolean} isFirstInstall - 是否首次安装
 * @param {boolean} hasCodexPlugin - 是否已导入 Codex 插件
 */
function printWelcomeGuide(isFirstInstall, hasCodexPlugin) {
  const RESET = '\x1b[0m';
  const BOLD = '\x1b[1m';
  const DIM = '\x1b[2m';
  const CYAN = '\x1b[36m';
  const GREEN = '\x1b[32m';
  const YELLOW = '\x1b[33m';
  const BLUE = '\x1b[34m';
  const MAGENTA = '\x1b[35m';
  const BG_CYAN = '\x1b[46m';
  const WHITE = '\x1b[37m';

  const SEP = `${DIM}${'─'.repeat(60)}${RESET}`;

  console.log('');
  console.log(
    `${BG_CYAN}${WHITE}${BOLD}  🎉 欢迎使用 OpenYida！                                    ${RESET}`,
  );
  console.log(SEP);

  if (isFirstInstall) {
    console.log(
      `${BOLD}${GREEN}  ✅ 安装成功！${RESET} 宜搭 AI 应用开发工具已就绪。`,
    );
  } else {
    console.log(
      `${BOLD}${GREEN}  ✅ 更新成功！${RESET} OpenYida 已升级到最新版本。`,
    );
  }

  console.log('');
  console.log(`${BOLD}${CYAN}  🚀 开启 AI 问答模式${RESET}`);
  console.log(
    '  在 Codex / Claude Code / Aone Copilot / Cursor 等 AI 工具中直接对话：',
  );
  console.log('');

  // 示例 prompt 展示
  const prompts = [
    { icon: '📋', text: '帮我用宜搭创建一个考勤管理系统' },
    { icon: '💰', text: '帮我搭建个人薪资计算器应用' },
    { icon: '🏢', text: '创建一个 CRM 客户管理系统' },
    { icon: '🎂', text: '做一个生日祝福小程序' },
  ];

  prompts.forEach(({ icon, text }) => {
    console.log(`  ${icon}  ${YELLOW}「${text}」${RESET}`);
  });

  console.log('');
  console.log(SEP);
  console.log(`${BOLD}${BLUE}  📖 基础使用步骤${RESET}`);
  console.log('');
  console.log(
    `  ${BOLD}Step 1${RESET}  打开你的 AI 编程工具（Codex / Claude Code / Cursor 等）`,
  );
  console.log(`  ${BOLD}Step 2${RESET}  直接用自然语言描述你想要的应用`);
  console.log(
    `  ${BOLD}Step 3${RESET}  AI 自动调用 openyida 命令完成创建和发布`,
  );
  console.log(`  ${BOLD}Step 4${RESET}  获得可访问的宜搭应用链接 🎉`);
  if (hasCodexPlugin) {
    console.log('');
    console.log(
      `  ${BOLD}${GREEN}Codex 已导入宜搭插件：${RESET}重启 Codex 后可在输入框输入 ${CYAN}@宜搭${RESET}`,
    );
  }
  console.log('');
  console.log(SEP);
  console.log(`${BOLD}${MAGENTA}  ⚡ 快捷命令${RESET}`);
  console.log('');
  console.log(
    `  ${CYAN}openyida env${RESET}      ${DIM}# 检测当前 AI 工具环境和登录态${RESET}`,
  );
  console.log(
    `  ${CYAN}openyida login${RESET}    ${DIM}# 登录宜搭账号${RESET}`,
  );
  console.log(
    `  ${CYAN}openyida --help${RESET}   ${DIM}# 查看所有命令${RESET}`,
  );
  console.log('');
  console.log(SEP);
  console.log(`  ${DIM}📚 文档：https://github.com/openyida/openyida${RESET}`);
  console.log(`  ${DIM}💬 社区：钉钉扫码加入 OpenYida 社区${RESET}`);
  console.log('');
}
