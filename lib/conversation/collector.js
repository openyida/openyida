/**
 * collector.js - 对话记录采集器
 *
 * 从不同 AI 工具环境采集对话数据，输出标准化格式。
 *
 * 支持的数据源：
 *   - Claude Code JSONL 文件（~/.claude/projects/）
 *   - 用户指定的 JSON/JSONL 文件（--input）
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { t } = require('../core/i18n');

// ── Claude Code 对话文件定位 ─────────────────────────────

/**
 * 扫描 Claude Code 的 projects 目录，找到匹配当前项目的对话文件夹。
 * Claude Code 将项目路径编码后作为文件夹名存储在 ~/.claude/projects/ 下。
 *
 * @returns {string|null} 项目对话目录的路径，未找到返回 null
 */
function findClaudeProjectDir() {
  const home = os.homedir();
  const claudeProjectsDir = path.join(home, '.claude', 'projects');

  if (!fs.existsSync(claudeProjectsDir)) {
    return null;
  }

  const cwd = process.cwd();
  const entries = fs.readdirSync(claudeProjectsDir);

  // Claude Code 使用 URL 编码的路径作为文件夹名，将 / 替换为 -
  // 例如：/Users/js/workspace/openyida → -Users-js-workspace-openyida
  const encodedCwd = cwd.replace(/\//g, '-');

  for (const entry of entries) {
    const entryPath = path.join(claudeProjectsDir, entry);
    const stat = fs.statSync(entryPath);

    if (stat.isDirectory()) {
      // 检查编码后的路径是否匹配
      if (entry === encodedCwd || entry.endsWith(encodedCwd)) {
        return entryPath;
      }
      // 也尝试解码比较
      const decodedEntry = entry.replace(/-/g, '/');
      if (decodedEntry === cwd || cwd.startsWith(decodedEntry) || decodedEntry.endsWith(cwd)) {
        return entryPath;
      }
    }
  }

  return null;
}

/**
 * 获取 Claude Code 项目目录中的所有对话文件列表。
 *
 * @param {string} projectDir - 项目对话目录
 * @returns {Array<{path: string, name: string, mtime: Date}>} 对话文件列表，按时间倒序
 */
function listClaudeConversations(projectDir) {
  const files = fs.readdirSync(projectDir);
  const jsonlFiles = files
    .filter(f => f.endsWith('.jsonl'))
    .map(f => {
      const filePath = path.join(projectDir, f);
      const stat = fs.statSync(filePath);
      return {
        path: filePath,
        name: f,
        mtime: stat.mtime,
      };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()); // 按修改时间倒序

  return jsonlFiles;
}

// ── 对话文件解析 ─────────────────────────────────────────

/**
 * 解析 Claude Code 的 JSONL 对话文件。
 *
 * @param {string} filePath - JSONL 文件路径
 * @returns {object} 标准化的对话数据
 */
function parseClaudeJsonl(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.trim());
  const messages = [];
  let timestamp = null;

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      const entryTimestamp = entry.timestamp || null;

      if (!timestamp && entryTimestamp) {
        timestamp = entryTimestamp;
      }

      if (entry.type === 'human') {
        const msg = parseClaudeMessage(entry, 'user');
        if (msg) {
          msg.timestamp = entryTimestamp;
          messages.push(msg);
        }
      } else if (entry.type === 'assistant') {
        const assistantMessages = parseClaudeAssistantMessage(entry);
        for (const msg of assistantMessages) {
          msg.timestamp = entryTimestamp;
          messages.push(msg);
        }
      }
    } catch {
      // 跳过解析失败的行
      continue;
    }
  }

  return {
    metadata: {
      tool: 'claude-code',
      timestamp: timestamp || new Date().toISOString(),
      project: process.cwd(),
    },
    messages,
  };
}

/**
 * 解析 Claude 的消息内容（user 消息）。
 *
 * @param {object} entry - JSONL 条目
 * @param {string} role - 角色
 * @returns {object|null} 标准化消息
 */
function parseClaudeMessage(entry, role) {
  const messageContent = entry.message?.content;
  if (!messageContent) {
    return null;
  }

  let textContent = '';

  if (typeof messageContent === 'string') {
    textContent = messageContent;
  } else if (Array.isArray(messageContent)) {
    // 提取所有文本内容
    const textParts = messageContent
      .filter(item => item.type === 'text')
      .map(item => item.text);
    textContent = textParts.join('\n');
  }

  if (!textContent.trim()) {
    return null;
  }

  return {
    role,
    content: textContent,
  };
}

/**
 * 解析 Claude 的 assistant 消息（可能包含 tool_use 和 tool_result）。
 *
 * @param {object} entry - JSONL 条目
 * @returns {Array<object>} 标准化消息数组
 */
function parseClaudeAssistantMessage(entry) {
  const messageContent = entry.message?.content;
  const messages = [];

  if (!messageContent) {
    return messages;
  }

  if (typeof messageContent === 'string') {
    messages.push({
      role: 'assistant',
      content: messageContent,
    });
    return messages;
  }

  if (Array.isArray(messageContent)) {
    let textParts = [];

    for (const item of messageContent) {
      if (item.type === 'text') {
        textParts.push(item.text);
      } else if (item.type === 'tool_use') {
        // 先输出累积的文本内容
        if (textParts.length > 0) {
          messages.push({
            role: 'assistant',
            content: textParts.join('\n'),
          });
          textParts = [];
        }
        // 添加工具调用
        messages.push({
          role: 'tool_call',
          name: item.name,
          input: item.input || {},
        });
      } else if (item.type === 'tool_result') {
        // 添加工具结果
        const resultContent = typeof item.content === 'string'
          ? item.content
          : JSON.stringify(item.content);
        messages.push({
          role: 'tool_result',
          content: resultContent,
        });
      }
    }

    // 处理剩余的文本内容
    if (textParts.length > 0) {
      messages.push({
        role: 'assistant',
        content: textParts.join('\n'),
      });
    }
  }

  return messages;
}

/**
 * 解析用户提供的 JSON 文件。
 *
 * @param {string} filePath - JSON 文件路径
 * @returns {object} 标准化的对话数据
 */
function parseJsonFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // 尝试作为普通 JSON 解析
  try {
    const data = JSON.parse(content);
    // 如果已经是标准格式，直接返回
    if (data.metadata && data.messages) {
      return data;
    }
    // 否则包装成标准格式
    return {
      metadata: {
        tool: 'unknown',
        timestamp: new Date().toISOString(),
        project: process.cwd(),
      },
      messages: Array.isArray(data) ? data : [data],
    };
  } catch {
    // 不是有效 JSON
    throw new Error('Invalid JSON file: ' + filePath);
  }
}

/**
 * 解析用户提供的 JSONL 文件。
 *
 * @param {string} filePath - JSONL 文件路径
 * @returns {object} 标准化的对话数据
 */
function parseJsonlFile(filePath) {
  // 首先尝试作为 Claude Code JSONL 解析
  return parseClaudeJsonl(filePath);
}

// ── 主函数 ───────────────────────────────────────────────

/**
 * 采集对话记录。
 *
 * @param {object} options - 采集选项
 * @param {string} [options.input] - 用户指定的输入文件路径
 * @param {boolean} [options.latest=true] - 是否只取最新对话
 * @param {boolean} [options.list=false] - 是否列出可用对话
 * @param {object} [options.env] - 环境信息
 * @returns {object|null} 标准化的对话数据
 */
function collect(options = {}) {
  const { input, latest = true, list = false, env } = options;

  // 场景1：用户指定了输入文件
  if (input) {
    if (!fs.existsSync(input)) {
      console.error(t('exportConv.inputNotFound') || `Input file not found: ${input}`);
      process.exit(1);
    }

    if (input.endsWith('.jsonl')) {
      return parseJsonlFile(input);
    } else if (input.endsWith('.json')) {
      return parseJsonFile(input);
    } else {
      console.error(t('exportConv.unsupportedFormat') || 'Unsupported file format. Please use .json or .jsonl');
      process.exit(1);
    }
  }

  // 场景2：自动检测对话文件
  const toolName = env?.activeToolName || '';
  const isClaudeCode = toolName.toLowerCase().includes('claude') ||
                       process.env.CLAUDE_CODE ||
                       fs.existsSync(path.join(os.homedir(), '.claude'));

  if (isClaudeCode) {
    const projectDir = findClaudeProjectDir();

    if (!projectDir) {
      console.error(t('exportConv.noClaudeProject') || 'No Claude Code project found for current directory.');
      console.error(t('exportConv.useInputHint') || 'Please use --input to specify a conversation file manually.');
      process.exit(1);
    }

    const conversations = listClaudeConversations(projectDir);

    if (conversations.length === 0) {
      console.error(t('exportConv.noConversations') || 'No conversation files found.');
      process.exit(1);
    }

    // 场景2a：列出可用对话
    if (list) {
      console.log(t('exportConv.availableConversations') || 'Available conversations:');
      conversations.forEach((conv, index) => {
        const date = conv.mtime.toISOString().replace('T', ' ').substring(0, 19);
        console.log(`  ${index + 1}. ${conv.name} (${date})`);
      });
      return null; // 返回 null 表示只是列出，不进行后续处理
    }

    // 场景2b：取最新对话
    if (latest) {
      const latestConv = conversations[0];
      console.error(t('exportConv.usingLatest') || `Using latest conversation: ${latestConv.name}`);
      return parseClaudeJsonl(latestConv.path);
    }

    // 默认取最新
    const latestConv = conversations[0];
    return parseClaudeJsonl(latestConv.path);
  }

  // 场景3：其他环境，提示用户手动指定
  console.error(t('exportConv.envNotSupported') || 'Current environment does not support automatic conversation detection.');
  console.error(t('exportConv.useInputHint') || 'Please use --input to specify a conversation file manually.');
  process.exit(1);
}

module.exports = { collect };
