#!/usr/bin/env node
/**
 * postinstall hook: auto-configure IDE integration after `npm install -g openyida`
 *
 * Creates a symlink named "yida-skills" directly inside each AI tool's config
 * directory, pointing to the yida-skills/ folder inside this package.
 * Each tool discovers the skill pack by scanning its own config directory.
 *
 * Supported tools: Claude Code / OpenCode / Aone Copilot / Cursor / Qoder / iFlow / Wukong
 *
 * Symlink layout (no extra "skills/" subdirectory needed):
 *   ~/.claude/yida-skills          → <package>/yida-skills
 *   ~/.opencode/yida-skills        → <package>/yida-skills
 *   ~/.aone_copilot/yida-skills    → <package>/yida-skills
 *   ~/.cursor/yida-skills          → <package>/yida-skills
 *   ~/.qoder/yida-skills           → <package>/yida-skills
 *   ~/.iflow/yida-skills           → <package>/yida-skills
 *   ~/.real/yida-skills            → <package>/yida-skills  (Wukong)
 */

"use strict";

const path = require("path");
const fs = require("fs");
const os = require("os");

const PACKAGE_ROOT = path.resolve(__dirname, "..");
const SKILLS_DIR = path.join(PACKAGE_ROOT, "yida-skills");
const HOME_DIR = os.homedir();

/**
 * Run fn silently — never throws.
 */
function safeExec(fn) {
  try { fn(); } catch { /* ignore */ }
}

/**
 * Ensure a directory exists (mkdir -p).
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Create (or update) a "yida-skills" symlink directly inside `ideConfigDir`.
 *
 * - If the symlink already points to the correct target → skip.
 * - If it points elsewhere or is a real file/dir → remove and recreate.
 */
function installSymlink(ideConfigDir) {
  const symlinkPath = path.join(ideConfigDir, "yida-skills");

  ensureDir(ideConfigDir);

  let existingStat = null;
  try { existingStat = fs.lstatSync(symlinkPath); } catch { /* does not exist, will create */ }

  if (existingStat) {
    if (existingStat.isSymbolicLink()) {
      const currentTarget = fs.readlinkSync(symlinkPath);
      if (currentTarget === SKILLS_DIR) return; // already correct, skip
      fs.unlinkSync(symlinkPath);
    } else {
      fs.rmSync(symlinkPath, { recursive: true, force: true });
    }
  }

  fs.symlinkSync(SKILLS_DIR, symlinkPath, "junction");
}

// ── 1. Symlink integration (each tool's config root) ──────────────────

// Claude Code
safeExec(() => {
  installSymlink(path.join(HOME_DIR, ".claude"));
});

// OpenCode
safeExec(() => {
  if (fs.existsSync(path.join(HOME_DIR, ".opencode"))) {
    installSymlink(path.join(HOME_DIR, ".opencode"));
  }
});

// Aone Copilot
safeExec(() => {
  if (fs.existsSync(path.join(HOME_DIR, ".aone_copilot"))) {
    installSymlink(path.join(HOME_DIR, ".aone_copilot"));
  }
});

// Cursor
safeExec(() => {
  if (fs.existsSync(path.join(HOME_DIR, ".cursor"))) {
    installSymlink(path.join(HOME_DIR, ".cursor"));
  }
});

// Qoder
safeExec(() => {
  if (fs.existsSync(path.join(HOME_DIR, ".qoder"))) {
    installSymlink(path.join(HOME_DIR, ".qoder"));
  }
});

// iFlow
safeExec(() => {
  if (fs.existsSync(path.join(HOME_DIR, ".iflow"))) {
    installSymlink(path.join(HOME_DIR, ".iflow"));
  }
});

// ── 2. Wukong integration ─────────────────────────────────────────────

safeExec(() => {
  if (fs.existsSync(path.join(HOME_DIR, ".real"))) {
    installSymlink(path.join(HOME_DIR, ".real"));
  }
});

// ── 3. 首次安装欢迎引导 ──────────────────────────────────────────────

safeExec(() => {
  const FIRST_INSTALL_FLAG = path.join(HOME_DIR, ".openyida", "installed");

  const isFirstInstall = !fs.existsSync(FIRST_INSTALL_FLAG);
  if (isFirstInstall) {
    fs.mkdirSync(path.dirname(FIRST_INSTALL_FLAG), { recursive: true });
    fs.writeFileSync(FIRST_INSTALL_FLAG, new Date().toISOString(), "utf8");
  }

  printWelcomeGuide(isFirstInstall);
});

/**
 * 打印欢迎引导信息
 * @param {boolean} isFirstInstall - 是否首次安装
 */
function printWelcomeGuide(isFirstInstall) {
  const RESET  = "\x1b[0m";
  const BOLD   = "\x1b[1m";
  const DIM    = "\x1b[2m";
  const CYAN   = "\x1b[36m";
  const GREEN  = "\x1b[32m";
  const YELLOW = "\x1b[33m";
  const BLUE   = "\x1b[34m";
  const MAGENTA = "\x1b[35m";
  const BG_CYAN = "\x1b[46m";
  const WHITE  = "\x1b[37m";

  const SEP = `${DIM}${"─".repeat(60)}${RESET}`;

  console.log("");
  console.log(`${BG_CYAN}${WHITE}${BOLD}  🎉 欢迎使用 OpenYida！                                    ${RESET}`);
  console.log(SEP);

  if (isFirstInstall) {
    console.log(`${BOLD}${GREEN}  ✅ 安装成功！${RESET} 宜搭 AI 应用开发工具已就绪。`);
  } else {
    console.log(`${BOLD}${GREEN}  ✅ 更新成功！${RESET} OpenYida 已升级到最新版本。`);
  }

  console.log("");
  console.log(`${BOLD}${CYAN}  🚀 开启 AI 问答模式${RESET}`);
  console.log(`  在 Claude Code / Aone Copilot / Cursor 等 AI 工具中直接对话：`);
  console.log("");

  // 示例 prompt 展示
  const prompts = [
    { icon: "📋", text: "帮我用宜搭创建一个考勤管理系统" },
    { icon: "💰", text: "帮我搭建个人薪资计算器应用" },
    { icon: "🏢", text: "创建一个 CRM 客户管理系统" },
    { icon: "🎂", text: "做一个生日祝福小程序" },
  ];

  prompts.forEach(({ icon, text }) => {
    console.log(`  ${icon}  ${YELLOW}「${text}」${RESET}`);
  });

  console.log("");
  console.log(SEP);
  console.log(`${BOLD}${BLUE}  📖 基础使用步骤${RESET}`);
  console.log("");
  console.log(`  ${BOLD}Step 1${RESET}  打开你的 AI 编程工具（Claude Code / Cursor 等）`);
  console.log(`  ${BOLD}Step 2${RESET}  直接用自然语言描述你想要的应用`);
  console.log(`  ${BOLD}Step 3${RESET}  AI 自动调用 openyida 命令完成创建和发布`);
  console.log(`  ${BOLD}Step 4${RESET}  获得可访问的宜搭应用链接 🎉`);
  console.log("");
  console.log(SEP);
  console.log(`${BOLD}${MAGENTA}  ⚡ 快捷命令${RESET}`);
  console.log("");
  console.log(`  ${CYAN}openyida env${RESET}      ${DIM}# 检测当前 AI 工具环境和登录态${RESET}`);
  console.log(`  ${CYAN}openyida login${RESET}    ${DIM}# 登录宜搭账号${RESET}`);
  console.log(`  ${CYAN}openyida --help${RESET}   ${DIM}# 查看所有命令${RESET}`);
  console.log("");
  console.log(SEP);
  console.log(`  ${DIM}📚 文档：https://github.com/openyida/openyida${RESET}`);
  console.log(`  ${DIM}💬 社区：钉钉扫码加入 OpenYida 社区${RESET}`);
  console.log("");
}
