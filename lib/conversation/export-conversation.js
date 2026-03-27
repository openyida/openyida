/**
 * export-conversation.js - 导出 AI 对话记录命令
 *
 * 采集当前 AI 工具的对话记录，格式化为 Markdown 文档导出。
 *
 * 用法：openyida export-conversation [options]
 *   --output, -o    输出文件路径
 *   --input, -i     输入对话文件（JSON/JSONL）
 *   --latest        只导出最新对话（默认）
 *   --list          列出可用的对话记录
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { t } = require('../core/i18n');
const { detectEnvironment } = require('../core/env');
const { findProjectRoot } = require('../core/utils');
const { collect } = require('./collector');
const { format } = require('./formatter');

// ── 获取应用配置 ─────────────────────────────────────────

/**
 * 尝试获取应用配置。
 *
 * @returns {object|null} 应用配置或 null
 */
function tryGetConfig() {
  try {
    const projectRoot = findProjectRoot();
    const configPath = path.join(projectRoot, 'config.json');

    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // 忽略错误，返回 null
  }
  return null;
}

// ── 获取项目目录 ─────────────────────────────────────────

/**
 * 获取项目目录（用于默认输出路径）。
 *
 * @returns {string} 项目目录路径
 */
function getProjectDir() {
  return findProjectRoot();
}

// ── 主函数 ───────────────────────────────────────────────

/**
 * 导出对话记录。
 *
 * @param {object} options - 命令选项
 * @param {string} [options.output] - 输出文件路径
 * @param {string} [options.input] - 输入对话文件
 * @param {boolean} [options.latest=true] - 只取最新对话
 * @param {boolean} [options.list=false] - 列出可用对话
 */
async function exportConversation(options = {}) {
  const { output, input, latest = true, list = false } = options;

  try {
    console.error('='.repeat(50));
    console.error(t('exportConv.title') || '📝 导出 AI 对话记录');
    console.error('='.repeat(50));

    // Step 1: 检测环境
    console.error(t('exportConv.detectEnv') || '🔍 检测当前环境...');
    const env = detectEnvironment();
    const toolName = env.activeToolName || 'Unknown';
    console.error(t('exportConv.currentTool') || `  当前 AI 工具: ${toolName}`);

    // Step 2: 采集对话记录
    console.error(t('exportConv.collecting') || '📥 采集对话记录...');
    const conversationData = collect({ input, latest, list, env });

    // 如果是 --list 模式，collect 返回 null，直接退出
    if (conversationData === null) {
      return;
    }

    // 检查是否有消息
    if (!conversationData.messages || conversationData.messages.length === 0) {
      console.error(t('exportConv.noConversation') || '❌ 未找到对话记录');
      process.exit(1);
    }

    console.error(t('exportConv.messagesFound') || `  找到 ${conversationData.messages.length} 条消息`);

    // Step 3: 获取应用配置
    console.error(t('exportConv.loadingConfig') || '⚙️  加载应用配置...');
    const appConfig = tryGetConfig();
    if (appConfig) {
      console.error(t('exportConv.appName') || `  应用名: ${appConfig.appName || appConfig.name || '未命名'}`);
    } else {
      console.error(t('exportConv.noConfig') || '  未找到应用配置，使用默认值');
    }

    // Step 4: 格式化为 Markdown
    console.error(t('exportConv.formatting') || '📄 格式化 Markdown...');
    const markdown = format(conversationData, appConfig);

    // Step 5: 确定输出路径
    const outputPath = output || path.join(getProjectDir(), 'conversation-export.md');
    const outputDir = path.dirname(outputPath);

    // 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Step 6: 写入文件
    console.error(t('exportConv.writing') || '💾 写入文件...');
    fs.writeFileSync(outputPath, markdown, 'utf-8');

    // 输出成功信息
    console.error('');
    console.error('='.repeat(50));
    console.error(t('exportConv.success') || '✅ 导出成功！');
    console.error(t('exportConv.outputPath') || '📁 输出路径: ' + outputPath);
    console.error('='.repeat(50));

    // 输出 JSON 结果到 stdout（便于程序化使用）
    console.log(JSON.stringify({
      success: true,
      path: outputPath,
      messagesCount: conversationData.messages.length,
      tool: conversationData.metadata.tool,
    }));

  } catch (error) {
    console.error('');
    console.error(t('exportConv.error') || '❌ 导出失败: ' + error.message);
    process.exit(1);
  }
}

module.exports = { exportConversation };
