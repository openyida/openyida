/**
 * batch.js - 批量命令编排（一次登录，多条命令复用 token 缓存）
 *
 * 用法：
 *   openyida batch <commands-file>                 # 从文件读取，每行一条命令
 *   openyida batch --commands "cmd1 ; cmd2 ; cmd3" # 内联模式，分号分隔
 *   openyida batch --commands "cmd1" "cmd2" "cmd3"  # 内联模式，多参数
 *
 * 可选：
 *   --concurrency N    独立就绪任务的并发上限 1..4（默认 1）
 *   --stop-on-error    失败后停止排队任务，等待运行中的任务完成
 *   --json             最终只输出 JSON 汇总到 stdout
 *   --quiet            自动注入到每条子命令（batch 本身也静默）
 *
 * 设计要点：
 * - 零侵入：不修改任何已有命令的 run() 函数
 * - 每条子命令通过 child_process.execFile 调用 bin/yida.js，
 *   token 文件已在磁盘上，各命令读取时直接命中缓存（零登录开销）
 * - 静默模式为子命令注入 --quiet，逐项保存输出和耗时，结果按输入顺序汇总
 * - 需要登录的任务启动前预检登录态；纯本地检查/编译不触发登录
 * - 仅 manifest 已核实的独立操作并发；资源冲突等待，其他命令串行隔离
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { CliError } = require('./cli-error');
const { t } = require('./i18n');
const { describeTask, runTaskWave } = require('./task-concurrency');
const { loadAuthData, triggerLogin } = require('./utils');
const { banner, step, success, fail, info, warn, result, label } = require('./chalk');

const YIDA_BIN = path.resolve(__dirname, '../../bin/yida.js');

function parseArgs(args) {
  const parsed = {
    commandsFile: '',
    inlineCommands: [],
    stopOnError: false,
    json: false,
    quiet: false,
    concurrency: 1,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--concurrency') {
      const value = args[++i];
      if (!/^[1-4]$/.test(value || '')) {
        throw new CliError(t('batch.invalid_concurrency'), { code: 'BATCH_INVALID_CONCURRENCY' });
      }
      parsed.concurrency = Number(value);
    } else if (arg === '--stop-on-error') {
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

function parseOutput(value) {
  const text = String(value || '').trim();
  if (!text) { return null; }
  for (const candidate of [text, text.slice(text.lastIndexOf('\n{') + 1), ...text.split('\n').reverse()]) {
    try { return JSON.parse(candidate); } catch { /* Try the next complete JSON value. */ }
  }
  return text;
}

function executeCommand(commandTokens, quiet) {
  const finalTokens = [...commandTokens];
  if (quiet && !finalTokens.includes('--quiet')) { finalTokens.push('--quiet'); }
  const started = Date.now();
  return new Promise(resolve => {
    execFile(process.execPath, [YIDA_BIN, ...finalTokens], {
      encoding: 'utf-8', timeout: 120000, maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, YIDA_QUIET: quiet ? '1' : (process.env.YIDA_QUIET || '') },
    }, (error, stdout, stderr) => {
      const primary = parseOutput(stdout), diagnostic = error ? parseOutput(stderr) : null;
      const output = primary && typeof primary === 'object' ? primary
        : diagnostic && typeof diagnostic === 'object' ? diagnostic : primary ?? diagnostic;
      const failed = !!error || output?.success === false || output?.ok === false;
      resolve({ command: commandTokens.join(' '), success: !failed,
        exitCode: failed ? (Number.isInteger(error?.code) && error.code !== 0 ? error.code : 1) : 0,
        elapsed: Date.now() - started, startedAt: new Date(started).toISOString(), endedAt: new Date().toISOString(),
        output, ...(failed ? { error: output?.errorMsg || output?.message || output?.error || String(stderr || error?.message || '').trim() } : {}),
      });
    });
  });
}

async function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    const entry = require('./command-manifest').flattenCommandManifest().find(item => item.id === 'batch');
    console.log('openyida ' + entry.usage);
    entry.notes.forEach(note => console.log(note));
    return;
  }
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

  const tasks = commands.map(command => {
    const tokens = parseCommandLine(command);
    if (tokens[0] === 'openyida') { tokens.shift(); }
    return { tokens, policy: describeTask(tokens) };
  }).filter(task => task.tokens.length);

  // 预检登录态
  if (!quiet) {
    banner('Batch 批量执行');
    label('Commands', String(commands.length));
    if (parsed.stopOnError) { label('Mode', 'stop-on-error'); }

    step(1, '检查登录态');
  }

  let authData = tasks.some(task => task.policy.requiresLogin) ? loadAuthData() : {};
  if (!authData) {
    if (!quiet) { info('未找到登录缓存，触发登录...'); }
    authData = await triggerLogin();
  }
  if (!authData) {
    fail('登录失败，无法执行批量命令');
    console.log(JSON.stringify({ success: false, error: 'login_failed' }));
    process.exit(1);
  }
  if (!quiet) { success('登录态可用'); }

  if (!quiet) { step(2, t('batch.executing', String(parsed.concurrency))); }
  const wave = await runTaskWave(tasks, parsed, async (task, index) => {
    if (!quiet) { info('[' + (index + 1) + '/' + tasks.length + '] ' + task.tokens.join(' ')); }
    return executeCommand(task.tokens, quiet);
  });
  const results = wave.results;
  const successCount = results.filter(item => item.success).length;
  const failedCount = results.length - successCount;
  const summary = { success: failedCount === 0, total: tasks.length, executed: results.length,
    successCount, failedCount, ...wave };

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
  return summary;
}

module.exports = { parseArgs, parseCommandLine, loadCommandsFromFile, parseOutput, executeCommand, run };
