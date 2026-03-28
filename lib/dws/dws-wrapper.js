#!/usr/bin/env node
/**
 * 钉钉 CLI (dws) 包装器
 *
 * 功能：
 * 1. 检测并提示安装钉钉 CLI
 * 2. 透传所有 dws 命令到系统安装的 dws
 * 3. 提供一键安装指引
 */

'use strict';

const { execSync, spawn } = require('child_process');
const { t } = require('../core/i18n');

const DWS_BINARY_NAME = 'dws';
const INSTALL_SCRIPTS = {
  unix: 'curl -fsSL https://raw.githubusercontent.com/DingTalk-Real-AI/dingtalk-workspace-cli/main/scripts/install.sh | sh',
  windows: 'irm https://raw.githubusercontent.com/DingTalk-Real-AI/dingtalk-workspace-cli/main/scripts/install.ps1 | iex'
};

/**
 * 检查 dws 是否已安装
 * @returns {boolean}
 */
function isDwsInstalled() {
  try {
    execSync(`which ${DWS_BINARY_NAME}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取 dws 版本
 * @returns {string|null}
 */
function getDwsVersion() {
  try {
    const output = execSync(`${DWS_BINARY_NAME} version`, { encoding: 'utf8' });
    return output.trim();
  } catch {
    return null;
  }
}

/**
 * 显示安装指引
 */
function showInstallGuide() {
  const RESET   = '\x1b[0m';
  const BOLD    = '\x1b[1m';
  const DIM     = '\x1b[2m';
  const CYAN    = '\x1b[36m';
  const GREEN   = '\x1b[32m';
  const YELLOW  = '\x1b[33m';
  const BLUE    = '\x1b[34m';

  const BG_BLUE = '\x1b[44m';
  const WHITE   = '\x1b[37m';

  const isWindows = process.platform === 'win32';
  const installCommand = isWindows ? INSTALL_SCRIPTS.windows : INSTALL_SCRIPTS.unix;

  console.log('');
  console.log(`${BG_BLUE}${WHITE}${BOLD}  钉钉 CLI (dws) 安装指引  ${RESET}`);
  console.log('');
  console.log(`${YELLOW}钉钉 CLI 尚未安装${RESET}`);
  console.log('');
  console.log(`${BOLD}钉钉 CLI 是什么？${RESET}`);
  console.log('  钉钉官方推出的跨平台 CLI 工具，覆盖以下核心能力：');
  console.log('  • 通讯录管理 - 用户/部门搜索与管理');
  console.log('  • 日历日程 - 事件创建/闲忙查询/会议室预定');
  console.log('  • 待办任务 - 任务创建/分配/跟踪');
  console.log('  • 审批流程 - 表单/实例管理');
  console.log('  • 考勤打卡 - 排班/统计/打卡记录');
  console.log('  • 智能表格 - AI 表格操作');
  console.log('  • DING 消息 - 发送/撤回');
  console.log('  • 群聊管理 - 群成员/机器人消息');
  console.log('  • 更多：日志、工作台、开发者文档等');
  console.log('');
  console.log(`${BOLD}快速安装（推荐）${RESET}`);
  console.log('');

  if (isWindows) {
    console.log(`  ${GREEN}PowerShell:${RESET}`);
    console.log(`  ${installCommand}`);
    console.log('');
  } else {
    console.log(`  ${GREEN}macOS / Linux:${RESET}`);
    console.log(`  ${CYAN}${installCommand}${RESET}`);
    console.log('');
  }

  console.log(`${BOLD}手动安装：${RESET}`);
  console.log('  从 GitHub Releases 下载预编译二进制文件：');
  console.log('  https://github.com/DingTalk-Real-AI/dingtalk-workspace-cli/releases');
  console.log('');
  console.log(`${DIM}注意：使用本工具需要钉钉企业管理员授权。${RESET}`);
  console.log(`${DIM}参考：https://github.com/DingTalk-Real-AI/dingtalk-workspace-cli${RESET}`);
  console.log('');
  console.log(`${BLUE}安装完成后，重新运行命令即可自动调用 dws${RESET}`);
  console.log('');
}

/**
 * 自动安装 dws（交互式）
 */
async function autoInstallDws() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(t('cli.dws_install_prompt', '是否现在安装钉钉 CLI？(y/n) '), (answer) => {
      rl.close();

      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        console.log('');
        console.log(t('cli.dws_install_start', '开始安装钉钉 CLI...'));
        console.log('');

        const isWindows = process.platform === 'win32';
        const script = isWindows ? INSTALL_SCRIPTS.windows : INSTALL_SCRIPTS.unix;

        try {
          execSync(script, { stdio: 'inherit', shell: true });
          console.log('');
          console.log(t('cli.dws_install_success', '安装完成！请重新运行原命令。'));
          resolve(true);
        } catch (error) {
          console.error(t('cli.dws_install_failed', '安装失败，请手动执行安装脚本。'));
          console.error(error.message);
          resolve(false);
        }
      } else {
        showInstallGuide();
        resolve(false);
      }
    });
  });
}

/**
 * 执行 dws 命令
 * @param {string[]} args - 命令行参数
 */
async function executeDwsCommand(args) {
  // 特殊处理 help 命令
  if (args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    showDwsHelp();
    return;
  }

  // 特殊处理 install 命令
  if (args[0] === 'install' || args[0] === 'setup') {
    await autoInstallDws();
    return;
  }

  // 检查是否已安装
  if (!isDwsInstalled()) {
    const shouldInstall = await autoInstallDws();
    if (!shouldInstall) {
      process.exit(1);
    }

    // 安装后再次检查
    if (!isDwsInstalled()) {
      console.error(t('cli.dws_not_found', '钉钉 CLI 未找到，请先安装。'));
      process.exit(1);
    }
  }

  // 透传命令到 dws
  try {
    const result = spawn(DWS_BINARY_NAME, args, {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    result.on('close', (code) => {
      process.exit(code);
    });

    result.on('error', (err) => {
      console.error(t('cli.dws_exec_failed', '执行 dws 命令失败：'), err.message);
      process.exit(1);
    });
  } catch (error) {
    console.error(t('cli.dws_exec_failed', '执行 dws 命令失败：'), error.message);
    process.exit(1);
  }
}

/**
 * 显示 dws 帮助信息
 */
function showDwsHelp() {
  const RESET   = '\x1b[0m';
  const BOLD    = '\x1b[1m';
  const CYAN    = '\x1b[36m';
  const GREEN   = '\x1b[32m';
  const YELLOW  = '\x1b[33m';

  console.log('');
  console.log(`${BOLD}openyida dws - 钉钉 CLI 集成${RESET}`);
  console.log('');
  console.log(`${CYAN}用法：${RESET}`);
  console.log('  openyida dws <command> [args]');
  console.log('');
  console.log(`${CYAN}常用命令：${RESET}`);
  console.log('');
  console.log(`  ${GREEN}contact user search --keyword "悟空"${RESET}     搜索联系人`);
  console.log(`  ${GREEN}calendar event list${RESET}                       列出日历事件`);
  console.log(`  ${GREEN}todo task create --title "任务" --executors "ID"${RESET}  创建待办`);
  console.log(`  ${GREEN}approval instance list${RESET}                    列出审批实例`);
  console.log(`  ${GREEN}attendance record list${RESET}                    查询考勤记录`);
  console.log(`  ${GREEN}chat robot send --content "消息"${RESET}          发送机器人消息`);
  console.log('');
  console.log(`${CYAN}特殊命令：${RESET}`);
  console.log(`  ${GREEN}openyida dws install${RESET}                      一键安装钉钉 CLI`);
  console.log(`  ${GREEN}openyida dws help${RESET}                         显示此帮助信息`);
  console.log('');
  console.log(`${YELLOW}提示：所有 dws 命令都可以通过 openyida dws <command> 执行${RESET}`);
  console.log('');
  console.log(`${CYAN}输出格式：${RESET}`);
  console.log('  默认使用表格输出（适合人类阅读）');
  console.log('  添加 -f json 参数使用 JSON 输出（适合 AI Agent）');
  console.log('');
  console.log(`${CYAN}更多信息：${RESET}`);
  console.log('  https://github.com/DingTalk-Real-AI/dingtalk-workspace-cli');
  console.log('');
}

/**
 * 主函数
 * @param {string[]} args - 命令行参数
 */
async function run(args) {
  // 如果没有参数，显示帮助
  if (args.length === 0) {
    showDwsHelp();
    return;
  }

  await executeDwsCommand(args);
}

module.exports = {
  run,
  isDwsInstalled,
  getDwsVersion,
  showInstallGuide
};
