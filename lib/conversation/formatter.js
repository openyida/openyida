/**
 * formatter.js - Markdown 格式化器
 *
 * 将标准化的对话数据转换为结构化的 Markdown 文档。
 */

'use strict';

const { t } = require('../core/i18n');

// ── 工具调用关键词识别 ───────────────────────────────────

/**
 * 判断工具调用是否为 Yida 相关操作。
 *
 * @param {string} toolName - 工具名称
 * @returns {boolean}
 */
function isYidaOperation(toolName) {
  const yidaKeywords = [
    'create', 'publish', 'export', 'import', 'login', 'logout',
    'form', 'page', 'app', 'schema', 'permission', 'process',
    'connector', 'report', 'yida', 'openyida',
  ];

  const lowerName = toolName.toLowerCase();
  return yidaKeywords.some(keyword => lowerName.includes(keyword));
}

/**
 * 生成工具调用的简要描述。
 *
 * @param {object} toolCall - 工具调用消息
 * @returns {string}
 */
function generateToolDescription(toolCall) {
  const { name, input } = toolCall;

  // 根据工具名称生成描述
  if (name.includes('create') && name.includes('form')) {
    return input.name ? `创建表单「${input.name}」` : '创建表单';
  }
  if (name.includes('create') && name.includes('page')) {
    return input.name ? `创建页面「${input.name}」` : '创建页面';
  }
  if (name.includes('create') && name.includes('app')) {
    return input.name ? `创建应用「${input.name}」` : '创建应用';
  }
  if (name.includes('publish')) {
    return '发布页面';
  }
  if (name.includes('export')) {
    return '导出应用';
  }
  if (name.includes('import')) {
    return '导入应用';
  }
  if (name.includes('login')) {
    return '登录宜搭';
  }
  if (name.includes('schema')) {
    return '获取表单 Schema';
  }
  if (name.includes('permission')) {
    return '配置权限';
  }
  if (name.includes('process')) {
    return '配置流程';
  }
  if (name.includes('connector')) {
    return '配置连接器';
  }
  if (name.includes('execute') || name.includes('command') || name.includes('terminal')) {
    const cmd = input.command || input.cmd || '';
    return cmd ? `执行命令: ${cmd.substring(0, 50)}${cmd.length > 50 ? '...' : ''}` : '执行命令';
  }
  if (name.includes('read') || name.includes('file')) {
    const filePath = input.path || input.file || input.file_path || '';
    return filePath ? `读取文件: ${filePath}` : '读取文件';
  }
  if (name.includes('write') || name.includes('edit')) {
    const filePath = input.path || input.file || input.file_path || '';
    return filePath ? `编辑文件: ${filePath}` : '编辑文件';
  }
  if (name.includes('search')) {
    return '搜索代码';
  }

  // 默认描述
  return name;
}

// ── 关键步骤提取 ─────────────────────────────────────────

/**
 * 从消息列表中提取关键步骤。
 *
 * @param {Array} messages - 消息列表
 * @returns {Array<string>} 关键步骤描述列表
 */
function extractKeySteps(messages) {
  const steps = [];
  let stepIndex = 1;

  for (const msg of messages) {
    if (msg.role === 'tool_call') {
      const isYida = isYidaOperation(msg.name);
      const description = generateToolDescription(msg);
      const prefix = isYida ? '🎯' : '🔧';
      steps.push(`${stepIndex}. ${prefix} 执行 \`${msg.name}\`: ${description}`);
      stepIndex++;
    }
  }

  return steps;
}

// ── 统计信息计算 ─────────────────────────────────────────

/**
 * 计算对话统计信息。
 *
 * @param {Array} messages - 消息列表
 * @returns {object} 统计信息
 */
function calculateStats(messages) {
  let userMessages = 0;
  let assistantMessages = 0;
  let toolCalls = 0;
  let toolResults = 0;

  for (const msg of messages) {
    switch (msg.role) {
      case 'user':
        userMessages++;
        break;
      case 'assistant':
        assistantMessages++;
        break;
      case 'tool_call':
        toolCalls++;
        break;
      case 'tool_result':
        toolResults++;
        break;
    }
  }

  // 对话轮次 = 用户消息数量
  const conversationRounds = userMessages;

  return {
    conversationRounds,
    toolCalls,
    userMessages,
    assistantMessages,
    toolResults,
  };
}

// ── Markdown 生成 ────────────────────────────────────────

/**
 * 转义 Markdown 特殊字符。
 *
 * @param {string} text - 原始文本
 * @returns {string} 转义后的文本
 */
function escapeMarkdown(text) {
  if (!text) {return '';}
  // 仅转义可能破坏结构的字符，保留代码块内容
  return text;
}

/**
 * 截断长文本。
 *
 * @param {string} text - 原始文本
 * @param {number} maxLength - 最大长度
 * @returns {string} 截断后的文本
 */
function truncateText(text, maxLength = 500) {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '... (已截断)';
}

/**
 * 格式化消息内容为 Markdown。
 *
 * @param {object} message - 消息对象
 * @returns {string} Markdown 格式的消息
 */
function formatMessage(message) {
  const { role, content, name, input } = message;
  const lines = [];

  switch (role) {
    case 'user':
      lines.push('---');
      lines.push('');
      lines.push('### 👤 用户');
      lines.push('');
      lines.push('> ' + (content || '').split('\n').join('\n> '));
      lines.push('');
      break;

    case 'assistant':
      lines.push('---');
      lines.push('');
      lines.push('### 🤖 AI 助手');
      lines.push('');
      lines.push(escapeMarkdown(content || ''));
      lines.push('');
      break;

    case 'tool_call':
      lines.push('');
      lines.push(`#### 🔧 执行操作：\`${name}\``);
      lines.push('');
      if (input && Object.keys(input).length > 0) {
        lines.push('```json');
        lines.push(JSON.stringify(input, null, 2));
        lines.push('```');
      }
      lines.push('');
      break;

    case 'tool_result': {
      lines.push('');
      const truncatedContent = truncateText(content, 500);
      const statusIcon = content && content.includes('error') ? '❌' : '✅';
      lines.push(`> ${statusIcon} 执行结果：`);
      lines.push('>');
      lines.push('> ```');
      lines.push('> ' + truncatedContent.split('\n').join('\n> '));
      lines.push('> ```');
      lines.push('');
      break;
    }
  }

  return lines.join('\n');
}

// ── 主格式化函数 ─────────────────────────────────────────

/**
 * 将对话数据格式化为 Markdown 文档。
 *
 * @param {object} conversationData - 标准化的对话数据
 * @param {object|null} appConfig - 应用配置（可能为 null）
 * @returns {string} Markdown 文档内容
 */
function format(conversationData, appConfig) {
  const { metadata, messages } = conversationData;
  const appName = appConfig?.appName || appConfig?.name || 'OpenYida';
  const stats = calculateStats(messages);
  const keySteps = extractKeySteps(messages);

  const lines = [];

  // 标题
  lines.push(`# ${appName} — AI 对话记录`);
  lines.push('');

  // 概要信息
  lines.push('## 概要信息');
  lines.push('');
  lines.push('| 项目 | 值 |');
  lines.push('|------|------|');
  lines.push(`| 应用 | ${appName !== 'OpenYida' ? appName : '未配置'} |`);
  lines.push(`| AI 工具 | ${metadata.tool || '未知'} |`);
  lines.push(`| 导出时间 | ${new Date().toISOString()} |`);
  lines.push(`| 对话时间 | ${metadata.timestamp || '未知'} |`);
  lines.push(`| 对话轮次 | ${stats.conversationRounds} |`);
  lines.push(`| 工具调用 | ${stats.toolCalls} 次 |`);
  lines.push('');

  // 关键步骤摘要
  lines.push('## 关键步骤摘要');
  lines.push('');
  if (keySteps.length > 0) {
    for (const step of keySteps) {
      lines.push(step);
    }
  } else {
    lines.push(t('exportConv.noKeySteps') || '无工具调用记录');
  }
  lines.push('');

  // 完整对话记录
  lines.push('## 完整对话记录');
  lines.push('');

  for (const message of messages) {
    lines.push(formatMessage(message));
  }

  // 文档尾部
  lines.push('---');
  lines.push('');
  lines.push('*本文档由 OpenYida 导出工具自动生成*');
  lines.push('');

  return lines.join('\n');
}

module.exports = { format };
