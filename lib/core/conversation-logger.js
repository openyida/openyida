/**
 * conversation-logger.js - 对话记录采集模块
 *
 * 在每次 CLI 命令执行时，自动记录命令输入/输出到 .cache/conversation-log.jsonl。
 * 支持记录、读取、清除、统计等操作。
 *
 * 日志格式（JSONL，每行一条 JSON）：
 * {
 *   "timestamp": "2026-03-26T17:45:00.000Z",
 *   "type": "command" | "result" | "error" | "note",
 *   "command": "create-app",
 *   "args": ["应用名"],
 *   "output": "执行结果摘要",
 *   "duration": 1234,
 *   "success": true
 * }
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { findProjectRoot } = require('./utils');

const LOG_FILENAME = 'conversation-log.jsonl';

/**
 * 获取日志文件的绝对路径。
 * @returns {string}
 */
function getLogFilePath() {
  const projectRoot = findProjectRoot();
  const cacheDir = path.join(projectRoot, '.cache');

  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  return path.join(cacheDir, LOG_FILENAME);
}

/**
 * 追加一条日志记录。
 * @param {object} entry - 日志条目
 * @param {string} entry.type - 记录类型：command | result | error | note
 * @param {string} [entry.command] - 命令名称
 * @param {string[]} [entry.args] - 命令参数
 * @param {string} [entry.output] - 输出摘要（截断到 2000 字符）
 * @param {number} [entry.duration] - 执行耗时（毫秒）
 * @param {boolean} [entry.success] - 是否成功
 * @param {string} [entry.message] - 附加消息
 */
function appendLog(entry) {
  const logFile = getLogFilePath();

  const record = {
    timestamp: new Date().toISOString(),
    type: entry.type || 'command',
  };

  if (entry.command) { record.command = entry.command; }
  if (entry.args) { record.args = entry.args; }
  if (entry.output) {
    record.output = String(entry.output).length > 2000
      ? String(entry.output).substring(0, 2000) + '...(truncated)'
      : String(entry.output);
  }
  if (entry.duration !== undefined) { record.duration = entry.duration; }
  if (entry.success !== undefined) { record.success = entry.success; }
  if (entry.message) { record.message = entry.message; }

  try {
    fs.appendFileSync(logFile, JSON.stringify(record) + '\n', 'utf-8');
  } catch (writeError) {
    // 日志写入失败不应影响主流程
    console.error(`[conversation-logger] 日志写入失败: ${writeError.message}`);
  }
}

/**
 * 记录命令开始执行。
 * @param {string} command - 命令名称
 * @param {string[]} args - 命令参数
 * @returns {Function} 返回一个 finish 函数，调用时记录执行结果
 */
function logCommandStart(command, args) {
  const startTime = Date.now();

  appendLog({
    type: 'command',
    command,
    args: sanitizeArgs(args),
  });

  return function finishCommand(output, success) {
    const duration = Date.now() - startTime;
    appendLog({
      type: 'result',
      command,
      output: output || '',
      duration,
      success: success !== false,
    });
  };
}

/**
 * 记录错误。
 * @param {string} command - 命令名称
 * @param {string} errorMessage - 错误信息
 */
function logError(command, errorMessage) {
  appendLog({
    type: 'error',
    command,
    message: errorMessage,
  });
}

/**
 * 记录备注信息（如 AI 对话上下文）。
 * @param {string} message - 备注内容
 */
function logNote(message) {
  appendLog({
    type: 'note',
    message,
  });
}

/**
 * 读取所有日志记录。
 * @returns {object[]} 日志记录数组
 */
function readLogs() {
  const logFile = getLogFilePath();

  if (!fs.existsSync(logFile)) {
    return [];
  }

  const content = fs.readFileSync(logFile, 'utf-8').trim();
  if (!content) { return []; }

  const lines = content.split('\n');
  const records = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { continue; }
    try {
      records.push(JSON.parse(trimmed));
    } catch {
      // 跳过解析失败的行
    }
  }

  return records;
}

/**
 * 清除所有日志记录。
 * @returns {number} 被清除的记录数
 */
function clearLogs() {
  const logFile = getLogFilePath();

  if (!fs.existsSync(logFile)) {
    return 0;
  }

  const records = readLogs();
  const count = records.length;

  fs.writeFileSync(logFile, '', 'utf-8');
  return count;
}

/**
 * 获取日志统计摘要。
 * @returns {object} 统计信息
 */
function getLogSummary() {
  const records = readLogs();

  if (records.length === 0) {
    return {
      totalRecords: 0,
      commands: [],
      timeRange: null,
      successCount: 0,
      errorCount: 0,
    };
  }

  const commandSet = new Set();
  let successCount = 0;
  let errorCount = 0;

  for (const record of records) {
    if (record.command) { commandSet.add(record.command); }
    if (record.type === 'result' && record.success) { successCount++; }
    if (record.type === 'error') { errorCount++; }
  }

  const firstTimestamp = records[0].timestamp;
  const lastTimestamp = records[records.length - 1].timestamp;

  return {
    totalRecords: records.length,
    commands: Array.from(commandSet),
    timeRange: { start: firstTimestamp, end: lastTimestamp },
    successCount,
    errorCount,
  };
}

/**
 * 清理敏感参数（如密码、token 等）。
 * @param {string[]} args - 原始参数
 * @returns {string[]} 清理后的参数
 */
function sanitizeArgs(args) {
  if (!Array.isArray(args)) { return []; }

  const sensitivePatterns = ['password', 'token', 'secret', 'cookie', 'key'];

  return args.map(function(arg, index) {
    const lowerArg = String(arg).toLowerCase();
    // 如果参数名包含敏感词，隐藏下一个参数的值
    for (const pattern of sensitivePatterns) {
      if (lowerArg.includes(pattern)) {
        return '***';
      }
    }
    // 如果前一个参数是敏感参数标志（如 --token），隐藏当前值
    if (index > 0) {
      const prevArg = String(args[index - 1]).toLowerCase();
      for (const pattern of sensitivePatterns) {
        if (prevArg.includes(pattern)) {
          return '***';
        }
      }
    }
    return arg;
  });
}

module.exports = {
  appendLog,
  logCommandStart,
  logError,
  logNote,
  readLogs,
  clearLogs,
  getLogSummary,
  getLogFilePath,
};
