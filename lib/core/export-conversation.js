/**
 * export-conversation.js - 对话记录导出命令
 *
 * 读取 .cache/conversation-log.jsonl 日志，生成结构化 Markdown 文档。
 * 支持多种模板风格、钉钉 Webhook 发送、JSON 导出等。
 *
 * 用法：
 *   openyida export-conversation [选项]
 *     --output <file>       输出文件路径（默认 conversation-export.md）
 *     --format <type>       输出格式：markdown | json（默认 markdown）
 *     --template <type>     模板风格：tutorial | case | qa（默认 tutorial）
 *     --dingtalk <webhook>  发送到钉钉群（Webhook URL）
 *     --clear               导出后清除日志
 *     --list                仅列出日志摘要
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { readLogs, clearLogs, getLogSummary } = require('./conversation-logger');
const { t } = require('./i18n');

/**
 * 解析命令行参数。
 * @param {string[]} args
 * @returns {object}
 */
function parseArgs(args) {
  const options = {
    output: null,
    format: 'markdown',
    template: 'tutorial',
    dingtalk: null,
    clear: false,
    list: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--output' && args[i + 1]) {
      options.output = args[++i];
    } else if (arg === '--format' && args[i + 1]) {
      options.format = args[++i];
    } else if (arg === '--template' && args[i + 1]) {
      options.template = args[++i];
    } else if (arg === '--dingtalk' && args[i + 1]) {
      options.dingtalk = args[++i];
    } else if (arg === '--clear') {
      options.clear = true;
    } else if (arg === '--list') {
      options.list = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

/**
 * 打印帮助信息。
 */
function printHelp() {
  console.log(t('export_conv.help'));
}

/**
 * 格式化时间戳为可读格式。
 * @param {string} isoString
 * @returns {string}
 */
function formatTimestamp(isoString) {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds;
}

/**
 * 格式化耗时。
 * @param {number} durationMs
 * @returns {string}
 */
function formatDuration(durationMs) {
  if (durationMs < 1000) { return durationMs + 'ms'; }
  if (durationMs < 60000) { return (durationMs / 1000).toFixed(1) + 's'; }
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.round((durationMs % 60000) / 1000);
  return minutes + 'm ' + seconds + 's';
}

/**
 * 将日志记录分组为对话步骤（command + result 配对）。
 * @param {object[]} records
 * @returns {object[]} 步骤数组
 */
function groupIntoSteps(records) {
  const steps = [];
  let currentStep = null;

  for (const record of records) {
    if (record.type === 'command') {
      if (currentStep) {
        steps.push(currentStep);
      }
      currentStep = {
        command: record.command,
        args: record.args || [],
        timestamp: record.timestamp,
        results: [],
        errors: [],
        notes: [],
      };
    } else if (record.type === 'result') {
      if (currentStep && currentStep.command === record.command) {
        currentStep.results.push({
          output: record.output,
          duration: record.duration,
          success: record.success,
        });
      } else {
        steps.push({
          command: record.command || 'unknown',
          args: [],
          timestamp: record.timestamp,
          results: [{
            output: record.output,
            duration: record.duration,
            success: record.success,
          }],
          errors: [],
          notes: [],
        });
      }
      currentStep = null;
    } else if (record.type === 'error') {
      if (currentStep) {
        currentStep.errors.push(record.message);
      } else {
        steps.push({
          command: record.command || 'error',
          args: [],
          timestamp: record.timestamp,
          results: [],
          errors: [record.message],
          notes: [],
        });
      }
    } else if (record.type === 'note') {
      if (currentStep) {
        currentStep.notes.push(record.message);
      } else {
        steps.push({
          command: 'note',
          args: [],
          timestamp: record.timestamp,
          results: [],
          errors: [],
          notes: [record.message],
        });
      }
    }
  }

  if (currentStep) {
    steps.push(currentStep);
  }

  return steps;
}

/**
 * 生成教程风格的 Markdown。
 */
function generateTutorialMarkdown(steps, summary) {
  const lines = [];

  lines.push('# 🎉 OpenYida 应用搭建记录');
  lines.push('');
  lines.push('> 本文档由 `openyida export-conversation` 自动生成');
  lines.push('');

  if (summary.timeRange) {
    lines.push('## 📋 概览');
    lines.push('');
    lines.push('| 项目 | 信息 |');
    lines.push('|------|------|');
    lines.push('| 开始时间 | ' + formatTimestamp(summary.timeRange.start) + ' |');
    lines.push('| 结束时间 | ' + formatTimestamp(summary.timeRange.end) + ' |');
    lines.push('| 执行命令 | ' + summary.commands.join(', ') + ' |');
    lines.push('| 成功次数 | ' + summary.successCount + ' |');
    if (summary.errorCount > 0) {
      lines.push('| 错误次数 | ' + summary.errorCount + ' |');
    }
    lines.push('');
  }

  lines.push('## 📝 操作步骤');
  lines.push('');

  let stepNumber = 0;
  for (const step of steps) {
    if (step.command === 'note') {
      for (const note of step.notes) {
        lines.push('> 💡 ' + note);
        lines.push('');
      }
      continue;
    }

    stepNumber++;
    const commandDisplay = step.command;
    const argsDisplay = step.args.length > 0 ? ' ' + step.args.join(' ') : '';
    const timeDisplay = formatTimestamp(step.timestamp);

    lines.push('### Step ' + stepNumber + ': ' + commandDisplay);
    lines.push('');
    lines.push('⏰ ' + timeDisplay);
    lines.push('');
    lines.push('```bash');
    lines.push('openyida ' + commandDisplay + argsDisplay);
    lines.push('```');
    lines.push('');

    for (const note of step.notes) {
      lines.push('> 💡 ' + note);
      lines.push('');
    }

    for (const result of step.results) {
      const statusIcon = result.success ? '✅' : '❌';
      const durationText = result.duration ? ' (' + formatDuration(result.duration) + ')' : '';
      lines.push(statusIcon + ' 执行' + (result.success ? '成功' : '失败') + durationText);
      lines.push('');

      if (result.output) {
        lines.push('<details>');
        lines.push('<summary>查看输出</summary>');
        lines.push('');
        lines.push('```');
        lines.push(result.output);
        lines.push('```');
        lines.push('');
        lines.push('</details>');
        lines.push('');
      }
    }

    for (const error of step.errors) {
      lines.push('❌ 错误: ' + error);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  lines.push('## 🔗 相关链接');
  lines.push('');
  lines.push('- [OpenYida GitHub](https://github.com/openyida/openyida)');
  lines.push('- [宜搭平台](https://www.aliwork.com)');
  lines.push('');
  lines.push('---');
  lines.push('*Generated by OpenYida v' + getVersion() + ' at ' + formatTimestamp(new Date().toISOString()) + '*');

  return lines.join('\n');
}

/**
 * 生成案例风格的 Markdown。
 */
function generateCaseMarkdown(steps, summary) {
  const lines = [];

  lines.push('# 📦 OpenYida 应用案例');
  lines.push('');
  lines.push('> 使用 OpenYida CLI 搭建宜搭应用的完整流程记录');
  lines.push('');

  if (summary.timeRange) {
    const startDate = formatTimestamp(summary.timeRange.start).split(' ')[0];
    lines.push('**日期**: ' + startDate + '  ');
    lines.push('**使用命令**: ' + summary.commands.join(' → ') + '  ');
    lines.push('**执行结果**: ' + summary.successCount + ' 成功 / ' + summary.errorCount + ' 失败');
    lines.push('');
  }

  lines.push('## 流程');
  lines.push('');

  let stepNumber = 0;
  for (const step of steps) {
    if (step.command === 'note') {
      for (const note of step.notes) {
        lines.push('> ' + note);
        lines.push('');
      }
      continue;
    }

    stepNumber++;
    const argsDisplay = step.args.length > 0 ? ' ' + step.args.join(' ') : '';
    const resultSummary = step.results.length > 0
      ? (step.results[0].success ? '✅' : '❌')
      : '⏳';

    lines.push(stepNumber + '. ' + resultSummary + ' `openyida ' + step.command + argsDisplay + '`');

    for (const result of step.results) {
      if (result.output) {
        const firstLine = result.output.split('\n')[0].trim();
        if (firstLine) {
          lines.push('   - ' + firstLine);
        }
      }
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('*Generated by OpenYida*');

  return lines.join('\n');
}

/**
 * 生成问答风格的 Markdown。
 */
function generateQAMarkdown(steps, summary) {
  const lines = [];

  lines.push('# ❓ OpenYida 操作问答');
  lines.push('');

  let stepNumber = 0;
  for (const step of steps) {
    if (step.command === 'note') {
      for (const note of step.notes) {
        lines.push('> ' + note);
        lines.push('');
      }
      continue;
    }

    stepNumber++;
    const argsDisplay = step.args.length > 0 ? ' ' + step.args.join(' ') : '';

    lines.push('### Q' + stepNumber + ': 如何执行 ' + step.command + '？');
    lines.push('');
    lines.push('**命令：**');
    lines.push('```bash');
    lines.push('openyida ' + step.command + argsDisplay);
    lines.push('```');
    lines.push('');

    if (step.results.length > 0) {
      const result = step.results[0];
      lines.push('**结果：** ' + (result.success ? '成功 ✅' : '失败 ❌'));
      if (result.output) {
        lines.push('');
        lines.push('```');
        lines.push(result.output);
        lines.push('```');
      }
      lines.push('');
    }

    for (const error of step.errors) {
      lines.push('**错误：** ' + error);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('*Generated by OpenYida*');

  return lines.join('\n');
}

/**
 * 根据模板类型生成 Markdown。
 */
function generateMarkdown(template, steps, summary) {
  switch (template) {
    case 'case':
      return generateCaseMarkdown(steps, summary);
    case 'qa':
      return generateQAMarkdown(steps, summary);
    case 'tutorial':
    default:
      return generateTutorialMarkdown(steps, summary);
  }
}

/**
 * 发送消息到钉钉群（通过 Webhook）。
 */
function sendToDingtalk(webhookUrl, content) {
  return new Promise(function(resolve, reject) {
    const parsedUrl = new URL(webhookUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    const payload = JSON.stringify({
      msgtype: 'markdown',
      markdown: {
        title: 'OpenYida 应用搭建记录',
        text: content.length > 20000
          ? content.substring(0, 20000) + '\n\n...(内容过长已截断)'
          : content,
      },
    });

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 15000,
    };

    const req = requestModule.request(options, function(res) {
      let data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ errcode: -1, errmsg: data });
        }
      });
    });

    req.on('timeout', function() {
      req.destroy();
      reject(new Error(t('export_conv.dingtalk_timeout')));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * 打印日志摘要。
 */
function printSummary(summary) {
  console.log(t('export_conv.summary_title'));
  console.log(t('export_conv.summary_sep'));

  if (summary.totalRecords === 0) {
    console.log(t('export_conv.no_logs'));
    return;
  }

  console.log(t('export_conv.total_records', summary.totalRecords));
  console.log(t('export_conv.commands_used', summary.commands.join(', ')));
  console.log(t('export_conv.success_count', summary.successCount));
  console.log(t('export_conv.error_count', summary.errorCount));

  if (summary.timeRange) {
    console.log(t('export_conv.time_start', formatTimestamp(summary.timeRange.start)));
    console.log(t('export_conv.time_end', formatTimestamp(summary.timeRange.end)));
  }

  console.log(t('export_conv.summary_sep'));
}

/**
 * 获取当前版本号。
 */
function getVersion() {
  try {
    const packageJson = require('../../package.json');
    return packageJson.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * 主入口。
 */
async function run(args) {
  const options = parseArgs(args);

  if (options.list) {
    const summary = getLogSummary();
    printSummary(summary);
    return;
  }

  const records = readLogs();
  if (records.length === 0) {
    console.log(t('export_conv.no_logs'));
    console.log(t('export_conv.no_logs_hint'));
    return;
  }

  const summary = getLogSummary();
  const steps = groupIntoSteps(records);

  let content;
  if (options.format === 'json') {
    content = JSON.stringify({ summary: summary, steps: steps, records: records }, null, 2);
  } else {
    content = generateMarkdown(options.template, steps, summary);
  }

  const outputFile = options.output || (
    options.format === 'json' ? 'conversation-export.json' : 'conversation-export.md'
  );
  const outputPath = path.isAbsolute(outputFile) ? outputFile : path.join(process.cwd(), outputFile);

  fs.writeFileSync(outputPath, content, 'utf-8');
  console.log(t('export_conv.exported', outputPath));
  console.log(t('export_conv.record_count', records.length));
  console.log(t('export_conv.step_count', steps.length));

  if (options.dingtalk) {
    console.log(t('export_conv.sending_dingtalk'));
    try {
      const result = await sendToDingtalk(options.dingtalk, content);
      if (result.errcode === 0) {
        console.log(t('export_conv.dingtalk_success'));
      } else {
        console.error(t('export_conv.dingtalk_failed', result.errmsg || JSON.stringify(result)));
      }
    } catch (sendError) {
      console.error(t('export_conv.dingtalk_error', sendError.message));
    }
  }

  if (options.clear) {
    const clearedCount = clearLogs();
    console.log(t('export_conv.cleared', clearedCount));
  }
}

module.exports = { run: run };
