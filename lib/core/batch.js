/**
 * batch.js - 批量命令编排（一次登录，多条命令复用 Cookie 缓存）
 *
 * 用法：
 *   openyida batch <commands-file>                 # 从文件读取，每行一条命令
 *   openyida batch --commands "cmd1 ; cmd2 ; cmd3" # 内联模式，分号分隔
 *   openyida batch --commands "cmd1" "cmd2" "cmd3"  # 内联模式，多参数
 *
 * 可选：
 *   --stop-on-error    遇到第一条失败命令即停止（默认继续执行）
 *   --json             最终只输出 JSON 数组到 stdout
 *   --quiet            自动注入到每条子命令（batch 本身也静默）
 *
 * 设计要点：
 * - 零侵入：不修改任何已有命令的 run() 函数
 * - 每条子命令通过 child_process.execFileSync 调用 bin/yida.js，
 *   Cookie 文件已在磁盘上，各命令读取时直接命中缓存（零登录开销）
 * - 子命令自动注入 --quiet，stdout 只收 JSON，stderr 静默
 * - batch 启动时先做一次 loadCookieData 预检，确保登录态可用
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { loadCookieData, triggerLogin } = require('./utils');
const { banner, step, success, fail, info, warn, result, label } = require('./chalk');

const YIDA_BIN = path.resolve(__dirname, '../../bin/yida.js');

function parseArgs(args) {
  const parsed = {
    commandsFile: '',
    inlineCommands: [],
    stopOnError: false,
    json: false,
    quiet: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--stop-on-error') {
      parsed.stopOnError = true;
    } else if (arg === '--json') {
      parsed.json = true;
    } else if (arg === '--quiet') {
      parsed.quiet = true;
    } else if (arg === '--commands') {
      // 收集 --commands 后面的所有非 flag 参数
      i++;
      while (i < args.length && !args[i].startsWith('--')) {
        // 支持分号分隔的内联语法
        const parts = args[i].split(';').map(function (s) { return s.trim(); }).filter(Boolean);
        parsed.inlineCommands.push(...parts);
        i++;
      }
      i--; // 回退一步，外层 for 会 i++
    } else if (!arg.startsWith('--') && !parsed.commandsFile) {
      parsed.commandsFile = arg;
    }
  }

  return parsed;
}

function loadCommandsFromFile(filePath) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    fail('命令文件不存在: ' + resolvedPath);
    process.exit(1);
  }
  const content = fs.readFileSync(resolvedPath, 'utf-8');
  return content
    .split('\n')
    .map(function (line) { return line.trim(); })
    .filter(function (line) { return line && !line.startsWith('#'); }); // 跳过空行和注释
}

function parseCommandLine(commandLine) {
  // 简单的命令行解析：按空格分割，支持引号内的空格
  const tokens = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < commandLine.length; i++) {
    const char = commandLine[i];
    if (inQuote) {
      if (char === quoteChar) {
        inQuote = false;
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      inQuote = true;
      quoteChar = char;
    } else if (char === ' ') {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }
  if (current) {
    tokens.push(current);
  }
  return tokens;
}

function executeCommand(commandTokens, quiet) {
  // 自动注入 --quiet（如果子命令中没有）
  const finalTokens = [...commandTokens];
  if (quiet && !finalTokens.includes('--quiet')) {
    finalTokens.push('--quiet');
  }

  const startTime = Date.now();
  try {
    const stdout = execFileSync(process.execPath, [YIDA_BIN, ...finalTokens], {
      encoding: 'utf-8',
      timeout: 120000, // 2 分钟超时
      env: {
        ...process.env,
        YIDA_QUIET: quiet ? '1' : (process.env.YIDA_QUIET || ''),
      },
      stdio: ['pipe', 'pipe', 'pipe'], // 捕获 stdout/stderr
    });

    const elapsed = Date.now() - startTime;

    // 尝试解析 stdout 中的 JSON
    const output = stdout.trim();
    let parsedOutput = null;
    if (output) {
      // 取最后一行非空内容（多行时前面可能有 stderr 漏到 stdout 的情况）
      const lines = output.split('\n').filter(Boolean);
      const lastLine = lines[lines.length - 1];
      try {
        parsedOutput = JSON.parse(lastLine);
      } catch (_parseError) {
        parsedOutput = output;
      }
    }

    return {
      command: commandTokens.join(' '),
      success: true,
      exitCode: 0,
      elapsed,
      output: parsedOutput,
    };
  } catch (execError) {
    const elapsed = Date.now() - startTime;
    let output = null;
    if (execError.stdout) {
      const lines = execError.stdout.toString().trim().split('\n').filter(Boolean);
      if (lines.length > 0) {
        try {
          output = JSON.parse(lines[lines.length - 1]);
        } catch (_parseError) {
          output = lines[lines.length - 1] || null;
        }
      }
    }

    return {
      command: commandTokens.join(' '),
      success: false,
      exitCode: execError.status || 1,
      elapsed,
      output,
      error: execError.stderr ? execError.stderr.toString().trim().split('\n').filter(Boolean).pop() : execError.message,
    };
  }
}

async function run(args) {
  const parsed = parseArgs(args);
  const quiet = parsed.quiet || parsed.json;

  // 收集命令列表
  let commands = [];
  if (parsed.inlineCommands.length > 0) {
    commands = parsed.inlineCommands;
  } else if (parsed.commandsFile) {
    commands = loadCommandsFromFile(parsed.commandsFile);
  } else {
    const { error } = require('./chalk');
    error(
      '用法: openyida batch <commands-file> 或 openyida batch --commands "cmd1 ; cmd2"',
      { hint: '示例: openyida batch tasks.txt --json --quiet' }
    );
    return;
  }

  if (commands.length === 0) {
    warn('命令列表为空');
    console.log(JSON.stringify({ success: true, total: 0, results: [] }));
    return;
  }

  // 预检登录态
  if (!quiet) {
    banner('Batch 批量执行');
    label('Commands', String(commands.length));
    if (parsed.stopOnError) { label('Mode', 'stop-on-error'); }

    step(1, '检查登录态');
  }

  let cookieData = loadCookieData();
  if (!cookieData) {
    if (!quiet) { info('未找到登录缓存，触发登录...'); }
    cookieData = triggerLogin();
  }
  if (!cookieData) {
    fail('登录失败，无法执行批量命令');
    console.log(JSON.stringify({ success: false, error: 'login_failed' }));
    process.exit(1);
  }
  if (!quiet) { success('登录态可用'); }

  // 逐条执行
  if (!quiet) { step(2, '执行命令 (' + commands.length + ' 条)'); }

  const results = [];
  let successCount = 0;
  let failedCount = 0;
  let stopped = false;

  for (let i = 0; i < commands.length; i++) {
    const commandLine = commands[i];
    const tokens = parseCommandLine(commandLine);

    // 跳过 'openyida' 前缀（用户可能写了完整命令）
    if (tokens[0] === 'openyida') {
      tokens.shift();
    }

    if (tokens.length === 0) { continue; }

    if (!quiet) {
      info('[' + (i + 1) + '/' + commands.length + '] ' + commandLine);
    }

    const commandResult = executeCommand(tokens, quiet);
    results.push(commandResult);

    if (commandResult.success) {
      successCount++;
      if (!quiet) { success('  ✓ ' + commandResult.elapsed + 'ms'); }
    } else {
      failedCount++;
      if (!quiet) { fail('  ✗ exit=' + commandResult.exitCode + ' ' + (commandResult.error || '')); }
      if (parsed.stopOnError) {
        if (!quiet) { warn('--stop-on-error 触发，跳过剩余 ' + (commands.length - i - 1) + ' 条命令'); }
        stopped = true;
        break;
      }
    }
  }

  // 输出结果
  const summary = {
    success: failedCount === 0,
    total: commands.length,
    executed: results.length,
    successCount,
    failedCount,
    stopped,
    results,
  };

  if (!quiet) {
    result(failedCount === 0, 'Batch 完成: ' + successCount + ' 成功, ' + failedCount + ' 失败', [
      ['Total', String(commands.length)],
      ['Executed', String(results.length)],
      ['Success', String(successCount)],
      ['Failed', String(failedCount)],
    ]);
  }

  if (parsed.json) {
    console.log(JSON.stringify(summary));
  } else {
    console.log(JSON.stringify(summary, null, 2));
  }
}

module.exports = { parseArgs, parseCommandLine, loadCommandsFromFile, run };
