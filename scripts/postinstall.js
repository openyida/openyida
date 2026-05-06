#!/usr/bin/env node
/**
 * postinstall hook: skills installation + welcome guide after `npm install -g openyida`
 *
 * 职责：
 *   1. 清理旧版本遗留的错误安装（~/.xxx/yida-skills/，缺少 skills/ 中间层级）
 *   2. 将 yida-skills/ 安装到各 AI 工具的正确 skills 目录
 *   3. 首次安装欢迎引导
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
const SKILLS_DIR = path.join(PACKAGE_ROOT, 'yida-skills');
const HOME_DIR = os.homedir();

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

// ── 1. Skills 安装 ───────────────────────────────────────────────────
// 安装到各 AI 工具的正确 skills 目录（悟空跳过，悟空通过手动上传技能）

// Claude Code — 始终安装（Claude Code 是主要目标用户）
safeExec(() => {
  installSkillsToTool(path.join(HOME_DIR, '.claude'));
});

// Codex — 仅在已安装时安装
safeExec(() => {
  if (fs.existsSync(path.join(HOME_DIR, '.codex'))) {
    installSkillsToTool(path.join(HOME_DIR, '.codex'));
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

  printWelcomeGuide(isFirstInstall);
});

/**
 * 打印欢迎引导信息
 * @param {boolean} isFirstInstall - 是否首次安装
 */
function printWelcomeGuide(isFirstInstall) {
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
