/**
 * chalk.js - 公共终端样式工具模块
 *
 * 提供统一的 ANSI 颜色常量、图标、分隔线、spinner 动画、
 * 表格渲染等终端输出工具，供所有 CLI 命令文件引用。
 *
 * 用法：
 *   const { c, icon, sep, banner, step, label, spinner, table } = require('./chalk');
 */

'use strict';

// ── 全局静默开关 ───────────────────────────────────────
//
// YIDA_QUIET=1 时所有装饰性输出（banner/step/label/info/hint/listItem/
// table/result/spinner/success/warn/commandGroup/usage）变为 no-op；
// fail/error 仍写入 stderr 但去除装饰，保证错误信息可见。
// console.log 由各 command 用于输出 JSON 结果，本模块不做处理。
function isQuiet() {
  return process.env.YIDA_QUIET === '1';
}

// ── ANSI 颜色常量 ──────────────────────────────────────

const c = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  italic:  '\x1b[3m',
  underline: '\x1b[4m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
  gray:    '\x1b[90m',
};

// ── 图标常量 ───────────────────────────────────────────

const icon = {
  success:  `${c.green}✔${c.reset}`,
  fail:     `${c.red}✖${c.reset}`,
  warn:     `${c.yellow}⚠${c.reset}`,
  info:     `${c.cyan}ℹ${c.reset}`,
  arrow:    `${c.cyan}→${c.reset}`,
  bullet:   `${c.dim}•${c.reset}`,
  star:     `${c.yellow}★${c.reset}`,
  check:    `${c.green}✓${c.reset}`,
  cross:    `${c.red}✗${c.reset}`,
  dot:      `${c.dim}·${c.reset}`,
  play:     `${c.green}▶${c.reset}`,
  folder:   `${c.cyan}📁${c.reset}`,
  file:     `${c.dim}📄${c.reset}`,
  link:     `${c.blue}🔗${c.reset}`,
  key:      `${c.yellow}🔑${c.reset}`,
  lock:     `${c.red}🔒${c.reset}`,
  unlock:   `${c.green}🔓${c.reset}`,
  rocket:   '🚀',
  package:  '📦',
  gear:     '⚙️',
  sparkle:  '✨',
};

// ── 分隔线 ─────────────────────────────────────────────

/**
 * 生成分隔线。
 * @param {number} [width=60] - 分隔线宽度
 * @returns {string}
 */
function sep(width = 60) {
  return `${c.dim}${'─'.repeat(width)}${c.reset}`;
}

// ── Banner 标题 ────────────────────────────────────────

/**
 * 打印命令标题 banner（替代旧的 '='.repeat(55) 风格）。
 * @param {string} title - 标题文字
 * @param {object} [options]
 * @param {string} [options.subtitle] - 副标题
 * @param {boolean} [options.stderr=true] - 是否输出到 stderr
 */
function banner(title, options = {}) {
  if (isQuiet()) {return;}
  const { subtitle, stderr = true } = options;
  const out = stderr ? process.stderr : process.stdout;
  out.write('\n');
  out.write(`  ${c.bold}${c.cyan}${title}${c.reset}\n`);
  if (subtitle) {
    out.write(`  ${c.dim}${subtitle}${c.reset}\n`);
  }
  out.write(`  ${sep()}\n`);
}

// ── 步骤输出 ───────────────────────────────────────────

/**
 * 打印步骤信息。
 * @param {number} stepNumber - 步骤编号
 * @param {string} message - 步骤描述
 * @param {boolean} [stderr=true] - 是否输出到 stderr
 */
function step(stepNumber, message, stderr = true) {
  if (isQuiet()) {return;}
  const out = stderr ? process.stderr : process.stdout;
  out.write(`\n  ${c.cyan}[${stepNumber}]${c.reset} ${c.bold}${message}${c.reset}\n`);
}

// ── 标签值对输出 ───────────────────────────────────────

/**
 * 打印标签-值对（如 "  地址：https://..."）。
 * @param {string} labelText - 标签文字
 * @param {string} value - 值
 * @param {object} [options]
 * @param {string} [options.indent='      '] - 缩进
 * @param {boolean} [options.stderr=true] - 是否输出到 stderr
 */
function label(labelText, value, options = {}) {
  if (isQuiet()) {return;}
  const { indent = '      ', stderr = true } = options;
  const out = stderr ? process.stderr : process.stdout;
  out.write(`${indent}${c.dim}${labelText}${c.reset} ${value}\n`);
}

// ── 状态消息 ───────────────────────────────────────────

/**
 * 打印成功消息。
 * @param {string} message
 * @param {boolean} [stderr=true]
 */
function success(message, stderr = true) {
  if (isQuiet()) {return;}
  if (stderr) {
    console.error(`  ${icon.success} ${message}`);
  } else {
    process.stdout.write(`  ${icon.success} ${message}\n`);
  }
}

/**
 * 打印失败消息。
 * @param {string} message
 * @param {boolean} [stderr=true]
 */
function fail(message, stderr = true) {
  // fail 在 quiet 模式下仍写 stderr，但去除装饰，保证错误可见
  if (isQuiet()) {
    process.stderr.write(`${message}\n`);
    return;
  }
  if (stderr) {
    console.error(`  ${icon.fail} ${c.red}${message}${c.reset}`);
  } else {
    process.stdout.write(`  ${icon.fail} ${c.red}${message}${c.reset}\n`);
  }
}

/**
 * 打印警告消息。
 * @param {string} message
 * @param {boolean} [stderr=true]
 */
function warn(message, stderr = true) {
  if (isQuiet()) {return;}
  if (stderr) {
    console.error(`  ${icon.warn} ${c.yellow}${message}${c.reset}`);
  } else {
    process.stdout.write(`  ${icon.warn} ${c.yellow}${message}${c.reset}\n`);
  }
}

/**
 * 打印信息消息。
 * @param {string} message
 * @param {boolean} [stderr=true]
 */
function info(message, stderr = true) {
  if (isQuiet()) {return;}
  if (stderr) {
    console.error(`  ${icon.info} ${message}`);
  } else {
    process.stdout.write(`  ${icon.info} ${message}\n`);
  }
}

/**
 * 打印暗淡的提示文字。
 * @param {string} message
 * @param {boolean} [stderr=true]
 */
function hint(message, stderr = true) {
  if (isQuiet()) {return;}
  if (stderr) {
    console.error(`  ${c.dim}${message}${c.reset}`);
  } else {
    process.stdout.write(`  ${c.dim}${message}${c.reset}\n`);
  }
}

// ── Spinner 动画 ───────────────────────────────────────

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * 创建 spinner 动画。
 * @param {string} message - 加载提示文字
 * @returns {{ succeed: function, fail: function, update: function }}
 */
function spinner(message) {
  if (isQuiet()) {
    return { succeed() {}, fail() {}, update() {} };
  }
  let frameIndex = 0;
  const timer = setInterval(() => {
    process.stderr.write(`\r  ${c.cyan}${SPINNER_FRAMES[frameIndex]}${c.reset} ${message}`);
    frameIndex = (frameIndex + 1) % SPINNER_FRAMES.length;
  }, 80);

  return {
    succeed(text) {
      clearInterval(timer);
      process.stderr.write(`\r  ${icon.success} ${text}\n`);
    },
    fail(text) {
      clearInterval(timer);
      process.stderr.write(`\r  ${icon.fail} ${c.red}${text}${c.reset}\n`);
    },
    update(text) {
      message = text;
    },
  };
}

// ── 表格渲染 ───────────────────────────────────────────

/**
 * 渲染键值对表格（仿 openclaw 风格）。
 * @param {Array<[string, string]>} rows - [标签, 值] 数组
 * @param {object} [options]
 * @param {boolean} [options.stderr=true]
 * @param {string} [options.indent='      ']
 */
function table(rows, options = {}) {
  if (isQuiet()) {return;}
  const { stderr = true, indent = '      ' } = options;
  const out = stderr ? process.stderr : process.stdout;
  const labelWidth = Math.max(...rows.map(([labelText]) => labelText.length)) + 2;

  for (const [labelText, value] of rows) {
    out.write(`${indent}${c.dim}${labelText.padEnd(labelWidth)}${c.reset}${value}\n`);
  }
}

/**
 * 渲染命令分组列表（用于 help 输出）。
 * @param {string} groupTitle - 分组标题
 * @param {Array<[string, string]>} commands - [命令, 描述] 数组
 * @param {boolean} [stderr=false]
 */
function commandGroup(groupTitle, commands, stderr = false) {
  if (isQuiet()) {return;}
  const out = stderr ? process.stderr : process.stdout;
  out.write(`\n  ${c.bold}${c.cyan}${groupTitle}${c.reset}\n`);
  const maxCmdLen = Math.max(...commands.map(([cmd]) => cmd.length));
  const padWidth = Math.min(maxCmdLen + 2, 50);
  for (const [cmd, desc] of commands) {
    out.write(`    ${c.green}${cmd.padEnd(padWidth)}${c.reset}${c.dim}${desc}${c.reset}\n`);
  }
}

// ── 列表项输出 ─────────────────────────────────────────

/**
 * 打印列表项。
 * @param {string} text - 列表项文字
 * @param {object} [options]
 * @param {string} [options.indent='    '] - 缩进
 * @param {string} [options.marker] - 自定义标记（默认使用 bullet）
 * @param {boolean} [options.stderr=true]
 */
function listItem(text, options = {}) {
  if (isQuiet()) {return;}
  const { indent = '    ', marker = icon.bullet, stderr = true } = options;
  const out = stderr ? process.stderr : process.stdout;
  out.write(`${indent}${marker} ${text}\n`);
}

// ── 错误输出 ───────────────────────────────────────────

/**
 * 打印错误信息并退出。
 * @param {string} message - 错误消息
 * @param {object} [options]
 * @param {string} [options.hint] - 提示信息
 * @param {boolean} [options.exit=true] - 是否退出进程
 */
function error(message, options = {}) {
  const { hint: hintText, exit: shouldExit = true } = options;
  // error 在 quiet 模式下仍输出，但去除装饰，保证错误可见
  if (isQuiet()) {
    process.stderr.write(`${message}\n`);
    if (hintText) {
      process.stderr.write(`${hintText}\n`);
    }
  } else {
    process.stderr.write(`\n  ${icon.fail} ${c.red}${message}${c.reset}\n`);
    if (hintText) {
      process.stderr.write(`  ${c.dim}${hintText}${c.reset}\n`);
    }
  }
  if (shouldExit) {
    process.exit(1);
  }
}

// ── 用法提示 ───────────────────────────────────────────

/**
 * 打印命令用法提示。
 * @param {string} usage - 用法字符串
 * @param {string} [example] - 示例
 */
function usage(usageText, example) {
  if (isQuiet()) {return;}
  process.stderr.write(`\n  ${c.yellow}用法:${c.reset} ${usageText}\n`);
  if (example) {
    process.stderr.write(`  ${c.dim}示例:${c.reset} ${example}\n`);
  }
}

// ── 结果摘要 ───────────────────────────────────────────

/**
 * 打印操作结果摘要框。
 * @param {boolean} isSuccess - 是否成功
 * @param {string} title - 标题
 * @param {Array<[string, string]>} [details] - 详情键值对
 * @param {boolean} [stderr=true]
 */
function result(isSuccess, title, details, stderr = true) {
  if (isQuiet()) {return;}
  const out = stderr ? process.stderr : process.stdout;
  out.write('\n');
  out.write(`  ${sep()}\n`);
  if (isSuccess) {
    out.write(`  ${icon.success} ${c.green}${c.bold}${title}${c.reset}\n`);
  } else {
    out.write(`  ${icon.fail} ${c.red}${c.bold}${title}${c.reset}\n`);
  }
  if (details && details.length > 0) {
    out.write('\n');
    table(details, { stderr, indent: '      ' });
  }
  out.write(`  ${sep()}\n\n`);
}

module.exports = {
  c,
  icon,
  sep,
  banner,
  step,
  label,
  success,
  fail,
  warn,
  info,
  hint,
  spinner,
  table,
  commandGroup,
  listItem,
  error,
  usage,
  result,
};
