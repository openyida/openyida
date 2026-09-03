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
 *   folderName 固定为 yida-skills，安装目标始终是 ~/<tool-config>/skills/yida-skills/
 *   ~/.claude/skills/yida-skills/          ← <package>/yida-skills (copy)
 *   ~/.codex/skills/yida-skills/           ← <package>/yida-skills (copy)
 *   ~/.opencode/skills/yida-skills/        ← <package>/yida-skills (copy)
 *   ~/.cursor/skills/yida-skills/          ← <package>/yida-skills (copy)
 *   ~/.qwenworkcn/skills/yida-skills/      ← <package>/yida-skills (copy)
 *   ~/.qoderwork/skills/yida-skills/       ← <package>/yida-skills (copy)
 *   ~/.qoder/skills/yida-skills/           ← <package>/yida-skills (copy)
 *   ~/.mulerun/skills/yida-skills/          ← <package>/yida-skills (copy)
 */

'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');
const {
  detectActiveTool,
  resolveProjectRoot,
  buildSkillsDiagnostics,
} = require('../lib/core/utils');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const PACKAGE_JSON = require(path.join(PACKAGE_ROOT, 'package.json'));
const SKILLS_DIR = path.join(PACKAGE_ROOT, 'yida-skills');
const SKILLS_INDEX_FILE = path.join(SKILLS_DIR, 'skills-index.json');
const HOME_DIR = os.homedir();
const CODEX_MARKETPLACE_NAME = 'openyida';
const CODEX_PLUGIN_NAME = 'openyida';
const CODEX_PLUGIN_LOGO_SVG = '<svg height="200" viewBox="0 0 1024 1024" width="200" xmlns="http://www.w3.org/2000/svg"><g fill="#0089FF"><path d="M966.743 0H57.498A57.197 57.197 0 0 0 .06 57.077v218.07a61.772 61.772 0 0 1 12.042 4.936L348.538 473.83l336.196-193.987a64.421 64.421 0 0 1 87.902 23.36l34.92 60.208a63.94 63.94 0 0 1-23.24 87.54L449.084 643.613v379.905h517.78a57.197 57.197 0 0 0 56.714-56.594V57.077A57.197 57.197 0 0 0 966.743 0z"/><path d="M.663 501.163v465.76a56.715 56.715 0 0 0 16.255 40.34 57.558 57.558 0 0 0 40.58 16.255H252.93V646.141z"/></g></svg>\n';

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

function installSkillsToDest(destPath) {
  const skillsDir = path.dirname(destPath);
  fs.mkdirSync(skillsDir, { recursive: true });
  cleanupLegacy(destPath);
  copyDirRecursive(SKILLS_DIR, destPath);
}

/**
 * 将仍位于 skills/ 下的历史备份移出宿主扫描目录。
 * 这些目录会被 Codex/Qoder 当成独立技能再次加载，不能只保留新版主目录。
 */
function archiveStaleSkillBackups(toolConfigDir) {
  const skillsRoot = path.join(toolConfigDir, 'skills');
  if (!fs.existsSync(skillsRoot)) {return;}

  const toolName = path.basename(toolConfigDir).replace(/^\./, '') || 'unknown';
  const archiveRoot = path.join(HOME_DIR, '.openyida', 'skill-backups', toolName);
  fs.readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^yida-skills\.backup-/.test(entry.name))
    .forEach((entry) => {
      const sourcePath = path.join(skillsRoot, entry.name);
      fs.mkdirSync(archiveRoot, { recursive: true });
      let archivePath = path.join(archiveRoot, entry.name);
      if (fs.existsSync(archivePath)) {
        archivePath += '-' + Date.now();
      }
      fs.renameSync(sourcePath, archivePath);
    });
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

  // 历史备份不能继续留在 skills/ 下，否则宿主会把旧规则当成另一套可用技能。
  archiveStaleSkillBackups(toolConfigDir);

  // 安装到正确路径：~/<tool-config>/skills/yida-skills/
  installSkillsToDest(path.join(toolConfigDir, 'skills', 'yida-skills'));
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
      brandColor: '#0089FF',
      composerIcon: './assets/logo.svg',
      logo: './assets/logo.svg',
    },
    mcpServers: './.mcp.json',
  };
}

/**
 * 构建 Codex 插件 MCP 配置。
 */
function createCodexMcpConfig() {
  return {
    mcpServers: {
      openyida: {
        command: process.execPath,
        args: [
          path.join(PACKAGE_ROOT, 'bin', 'yida.js'),
          'mcp',
        ],
        cwd: '.',
      },
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
openyida agent-capabilities --summary-json
\`\`\`

该 compact 命令一次返回版本、登录态摘要、工作目录、缓存目录和命令 manifest digest，避免大 JSON 被宿主 offload，也避免反复探测 \`which\`、\`--version\`、\`--help\`、\`env\` 和 \`login --check-only\`。

\`openyida agent-capabilities --json\` 是 full capabilities，只用于命令契约排障或深度诊断；不要放进常规完整搭建链路。

字段映射：compact 输出的 \`workdir\` 对应 full capabilities 的 \`active.projectRoot\`；\`workdir_exists\` 对应 \`active.projectRootExists\`。

如果 \`openyida\` 不存在，先提醒用户需要安装，或在用户同意后执行：

\`\`\`bash
npm install -g openyida@latest
\`\`\`

若登录态无效，执行：

\`\`\`bash
openyida login
\`\`\`

登录完成后再次运行 \`openyida login --check-only --json\` 验证 token session，再继续真实资源操作。

## Codex Browser 边界

Codex App 的 in-app browser / \`@Browser\` 适合打开本地开发服务器、file-backed preview 和无需登录的公开页面，用于截图、点击和检查渲染状态。

不要把 Codex in-app browser 用作宜搭登录 Cookie 来源：OpenYida CLI 登录使用 OAuth loopback + token session，不需要导出或手写 Cookie。

需要登录并获得 CLI token session 时，优先运行：

\`\`\`bash
openyida login
\`\`\`

\`openyida login\` 会通过 OAuth loopback 打开常规本地浏览器；如需抑制自动打开浏览器，可设置环境变量 \`OPENYIDA_NO_BROWSER=1\`。只有在需要纯浏览器预览或检查公开页面时才使用 \`@Browser\`。

## 工作目录

执行宜搭开发前检查当前工作区是否已有 \`project/\` 目录。没有时运行：

\`\`\`bash
openyida copy
\`\`\`

## 完整应用默认链路

用户说“按默认方案 / 不要追问 / 直接创建 / 尽快搭建”时，加载 \`yida-app\` 走完整应用统一编排。

统一编排只做：解析资源上下文 → \`yida-design\` 输出 \`prd.md\` 和 \`design.md\` → 创建/复用应用 → 核心表单/流程 → 主页面 → 编写主页面源码 → 发布 + 轻量导航排序 → 返回 2-3 句业务交付总结和一个主入口链接。资源创建顺序按 PRD 执行：应用先落位，表单/流程先于自定义页面。发布主页面成功后，PRD 写明导航顺序时执行 \`openyida nav-group order <appType> <页面/表单...>\`；PRD 只写宽泛分组或缺少导航顺序时，执行 \`openyida publish ... --auto-nav-order\` 或 \`openyida nav-group auto-order <appType>\` 兜底，兜底顺序为门户/首页/工作台入口、业务办理、数据管理、经营分析、系统配置。

表单页开发默认加载 \`yida-form-detail\` 做表单视觉引导，并把 Divider 分割线语义分组合并进字段 JSON。运行容器在自定义页面、表单、提交页、详情页和 \`FormOpenContainer\` iframe 中加载同一应用级自定义主题 CSS，确保主题变量一致。

完整应用页面源码默认不得使用 \`this.dataSourceMap.*\`，除非本轮已经明确创建并绑定设计器数据源；默认使用入口型页面或 \`this.utils.yida.*\` 查询已创建表单。

最终结果先输出 2-3 句业务交付总结，再给一个主入口链接：新增/修改/发布单个页面时主入口是当前页面 URL；其他完整应用、表单、流程、权限、主题、导航或批量资源场景主入口是应用首页 \`{base_url}/{appType}/workbench\`。示例：“已完成订单、商品和客户等核心表单，并发布首页、订单管理和库存看板入口。当前应用已支持订单录入、库存预警、销售统计和表单详情查看，示例记录与轻量导航排序也已就绪。主入口：{base_url}/{appType}/workbench”。不要使用表格、资源 ID 清单或长列表；不要把 \`g.alicdn.com\` 静态资源、CDN 构建产物、locale JSON、\`/admin\` 管理页或中间文件 URL 当成最终结果。

完整应用创建/解析多个表单后，页面阶段需要字段映射时，对每个目标表单默认只执行一次 \`openyida get-schema <appType> <formUuid> --field-map-json\`，读取完整 JSON 并写入/复用 \`.cache/<项目名>-schema.json\`；不要用 \`head\` / \`tail\` / \`grep\` 截断 schema stdout 后重复拉取。

使用 \`YidaCodeCanvas\` 组件实现的自定义页面统一直接写最终 \`.canvas.jsx\`：先读 PRD 的页面场景、业务区块、数据来源和主操作，再读 design.md 的主题、布局、材质、组件和状态规则，然后用 \`compileCanvasLocal\` 快检或 \`openyida publish\` 的编译阶段验证发布。\`openyida check-page\` / \`openyida compile\` 只用于历史平台 JSX 组件页面维护。

完整应用需求分析和产品设计由 \`yida-design\` 承担，并输出两份文件：\`prd/<项目名>/prd.md\` 写业务目标、数据结构、页面与功能、资源顺序、导航顺序和验收标准；\`prd/<项目名>/design.md\` 写主题色、themeProfile、tokens、视觉系统、组件和状态规则。页面实现先读 PRD 的页面场景、页面区块、数据来源、主操作和表单入口，再读 design.md 的主题、布局、材质、组件和状态规则，然后交给 \`yida-canvas-custom-page\` 落地。只有已识别为历史平台 JSX 组件页面维护时，才由 \`yida-custom-page\` 自身闭环处理。

默认只加载当前阶段必需技能；示例数据、精细导航分组、截图验收、公开访问、数据源深接、数据管理和原生报表只在用户明确要求或 PRD 验收标准命中时执行。发布后的轻量导航排序是统一编排默认收尾，不等于精细导航分组。

## 子技能目录

根据用户意图先命中一个大类目录，再选择最匹配的子技能。支持 \`use_skill\` / \`search_skills\` 的宿主中，必须调用 \`use_skill("<技能名>", "<本次目的>")\` 加载子技能；不要用 Read / read_file / cat 读取 SKILL.md 路径，也不要猜测 .skills、插件缓存或 workspace/project/.skills。\`skills-index.json\` 的 \`route_groups\` 与下表一致，供 yida-agent 或同构宿主做机器路由。机器路由推荐顺序：先用 \`route_groups[].signals\` 命中 \`yida-skills/<area>\` 大类，只在该 \`category\` 下用 skill 的 description/tags/signals 精排，再调用 \`use_skill\`。完全没有 \`use_skill\` 的本地工具，才允许按根技能路由表选定技能，并按 \`skills/<技能名>/SKILL.md\` 定位当前阶段唯一必要的 SKILL.md，禁止并发批量读取多个 SKILL.md。

| 大类目录 | 第一层意图信号 | 子技能 |
| --- | --- | --- |
| \`yida-skills/context\` | 登录、退出、组织信息、Schema、fieldId、只读预检 | \`yida-login\`, \`yida-logout\`, \`yida-basic-info\`, \`yida-get-schema\`, \`yida-corp-efficiency\` |
| \`yida-skills/app\` | 从零搭应用、导航、多语言 | \`yida-app\`, \`yida-create-app\`, \`yida-nav-group\`, \`yida-i18n\` |
| \`yida-skills/design\` | 完整应用产品设计、单页 UI 改造、主页面视觉设计、应用主题色、全局换肤、PRD 和 design.md | \`yida-design\` |
| \`yida-skills/form\` | 表单字段、公式、校验、业务规则、详情页、批量录入、数据记录 | \`yida-create-form-page\`, \`yida-formula\`, \`yida-formula-evaluate\`, \`yida-business-rule\`, \`yida-form-detail\`, \`yida-canvas-table-form\`, \`yida-table-form\`, \`yida-data-management\` |
| \`yida-skills/process\` | 审批、流程表单、流程规则、代理人 | \`yida-create-process\`, \`yida-process-rule\`, \`yida-agent-center\` |
| \`yida-skills/page\` | 自定义展示页、YidaCodeCanvas 组件、历史平台 JSX 组件页面维护、发布、导航壳、PPT | \`yida-create-page\`, \`yida-canvas-custom-page\`, \`yida-custom-page\`, \`yida-canvas-data-binding\`, \`yida-canvas-upgrade\`, \`yida-publish-page\`, \`yida-openyida-publish-guard\`, \`yida-density\`, \`yida-nav-shell\`, \`yida-ppt-slider\` |
| \`yida-skills/analytics\` | 报表、统计、图表、Recharts、ECharts、看板、驾驶舱 | \`yida-report\`, \`yida-rechart\`, \`yida-chart\`, \`yida-dashboard\` |
| \`yida-skills/integration\` | 连接器、外部 API、数据源、集成自动化 | \`yida-integration\`, \`yida-connector\`, \`yida-connector-safe-actions\`, \`yida-data-source-connectors\` |
| \`yida-skills/access\` | 平台/应用/表单/页面权限、公开访问、分享 | \`yida-corp-manager\`, \`yida-app-permission\`, \`yida-form-permission\`, \`yida-page-config\` |
| \`yida-skills/ops\` | Sequence、VOC | \`yida-db-seq-fix\`, \`yida-voc\` |
| \`yida-skills/agent\` | 导出对话、读取钉钉文档/听记、会议纪要/闪记转 PRD | \`yida-export-conversation\`, \`yida-document-markdown\`, \`yida-tingji\`, \`yida-flash-note-to-prd\` |

## 执行规则

- 不要编造 \`appType\`、\`formUuid\`、\`fieldId\`、\`reportId\`；必须从命令输出、缓存或 schema 中读取。
- 同一命令失败后，根据错误信息检查登录态、组织、参数和字段 ID；不要无修改地连续重试。
- 历史平台 JSX 组件页面 \`.oyd.jsx\` / \`.jsx\` 发布前先运行 \`openyida check-page\` 和 \`openyida compile\`；使用 \`YidaCodeCanvas\` 组件实现的 \`.canvas.jsx\` 页面不跑这两个普通自定义页面检查，使用 \`openyida publish\` 的编译阶段或 \`compileCanvasLocal\` 快检。
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
 * 已打开的 Codex 会话可能仍引用旧版本缓存路径。同步其中的技能正文，
 * 但保留每个缓存目录自己的 manifest/version，避免当前会话继续执行旧规则。
 */
function syncExistingCodexPluginSkillCaches(codexDir, pluginRoot) {
  const cacheRoot = path.join(
    codexDir,
    'plugins',
    'cache',
    CODEX_MARKETPLACE_NAME,
    CODEX_PLUGIN_NAME,
  );
  if (!fs.existsSync(cacheRoot)) {return;}

  fs.readdirSync(cacheRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .forEach((entry) => {
      const cachedPluginRoot = path.join(cacheRoot, entry.name);
      ['skills', 'references'].forEach((folderName) => {
        const cachedFolder = path.join(cachedPluginRoot, folderName);
        cleanupLegacy(cachedFolder);
        copyDirRecursive(path.join(pluginRoot, folderName), cachedFolder);
      });
    });
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
  writeJsonFile(
    path.join(pluginRoot, '.mcp.json'),
    createCodexMcpConfig(),
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
  fs.copyFileSync(
    SKILLS_INDEX_FILE,
    path.join(pluginRoot, 'skills', CODEX_PLUGIN_NAME, 'skills-index.json'),
  );

  writeCodexMarketplace(marketplaceRoot);
  ensureCodexConfig(codexDir, marketplaceRoot);
  syncExistingCodexPluginSkillCaches(codexDir, pluginRoot);

  return true;
}

/**
 * 本地 marketplace 内容更新后，让 Codex 将当前版本重新安装到实际插件缓存。
 * Codex 不在 PATH、当前版本不支持 plugin 命令或宿主正忙时静默降级，主 skills 安装仍然有效。
 */
function refreshCodexPluginInstall() {
  const codexBin = process.env.OPENYIDA_CODEX_BIN || (process.platform === 'win32' ? 'codex.exe' : 'codex');
  const result = spawnSync(
    codexBin,
    ['plugin', 'add', CODEX_PLUGIN_NAME + '@' + CODEX_MARKETPLACE_NAME, '--json'],
    {
      encoding: 'utf8',
      stdio: 'ignore',
      timeout: 30000,
    },
  );
  return !result.error && result.status === 0;
}

// ── 1. Skills 安装 ───────────────────────────────────────────────────
// 安装到各 AI 工具的正确 skills 目录

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
    if (codexPluginInstalled) {
      refreshCodexPluginInstall();
    }
  }
});

// OpenCode — 仅在已安装时安装
safeExec(() => {
  if (fs.existsSync(path.join(HOME_DIR, '.opencode'))) {
    installSkillsToTool(path.join(HOME_DIR, '.opencode'));
  }
});

// Cursor — 仅在已安装时安装
safeExec(() => {
  if (fs.existsSync(path.join(HOME_DIR, '.cursor'))) {
    installSkillsToTool(path.join(HOME_DIR, '.cursor'));
  }
});

// QwenWork（千问办公）— 仅在已安装时安装到全局 skills 目录
safeExec(() => {
  if (fs.existsSync(path.join(HOME_DIR, '.qwenworkcn'))) {
    installSkillsToTool(path.join(HOME_DIR, '.qwenworkcn'));
  }
});

// QwenWork 运行时 — Web 沙箱可能没有用户级配置目录，按宿主能力降级到 workspace skills 目录
safeExec(() => {
  const activeTool = detectActiveTool();
  if (!activeTool || activeTool.tool !== 'qwenwork') {
    return;
  }
  const projectResolution = resolveProjectRoot({ activeTool });
  const diagnostics = buildSkillsDiagnostics({ activeTool, projectResolution });
  if (diagnostics.selected && diagnostics.selected.usable) {
    installSkillsToDest(diagnostics.selected.path);
  }
});

// QoderWork — 仅在已安装时安装
safeExec(() => {
  if (fs.existsSync(path.join(HOME_DIR, '.qoderwork'))) {
    installSkillsToTool(path.join(HOME_DIR, '.qoderwork'));
  }
});

// Qoder — 仅在已安装时安装
safeExec(() => {
  if (fs.existsSync(path.join(HOME_DIR, '.qoder'))) {
    installSkillsToTool(path.join(HOME_DIR, '.qoder'));
  }
});

// MuleRun — 仅在已安装时安装
safeExec(() => {
  if (fs.existsSync(path.join(HOME_DIR, '.mulerun'))) {
    installSkillsToTool(path.join(HOME_DIR, '.mulerun'));
  }
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
    '  在 Codex / Claude Code / MuleRun / Cursor 等 AI 工具中直接对话：',
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
    `  ${BOLD}Step 1${RESET}  打开你的 AI 编程工具（Codex / Claude Code / MuleRun / Cursor 等）`,
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
