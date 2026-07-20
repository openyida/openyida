#!/usr/bin/env node

'use strict';

/**
 * 应用效果打分。
 * - 自动模式（--auto-score）：把截图喂给本地 agent（claude -p，多模态），按 rubric 打分。
 * - 人工模式（默认）：产出 scoring.md 模板，内嵌截图与链接，留空白评分项供人工填写。
 */

const fs = require('fs');
const path = require('path');

const { runAgent, resolveAgentCommand } = require('./agent');

const DEFAULT_RUBRIC = {
  scale: '1-10',
  dimensions: [
    { key: 'layout', label: '布局与视觉', desc: '排版是否清晰、对齐、留白合理，无明显错位/溢出' },
    { key: 'dataIntegrity', label: '数据呈现完整性', desc: '图表/字段/数值是否完整渲染，无空白或加载失败' },
    { key: 'requirementFit', label: '与需求契合度', desc: '页面内容是否覆盖预期业务场景' },
    { key: 'usability', label: '可用性', desc: '信息层级、可读性、交互入口是否合理' },
    { key: 'cliCorrectness', label: 'CLI 调用正确性', desc: '命令参数是否正确、顺序是否合理、无冗余调用' },
    { key: 'outputCompliance', label: '输出规范性', desc: '输出格式是否符合 SKILL.md 定义的规范' },
  ],
};

/**
 * 构造打分 prompt（图片以绝对路径内联，agent 自行 Read 截图）。
 */
function buildScorePrompt({ screenshotPath, url, stage, rubric = DEFAULT_RUBRIC } = {}) {
  const dims = rubric.dimensions
    .map((d) => `- ${d.key}（${d.label}）：${d.desc}`)
    .join('\n');
  return [
    '你是宜搭应用效果评审。请先读取下面这张已发布页面的截图，然后按 rubric 打分。',
    `截图路径：${screenshotPath}`,
    url ? `页面 URL：${url}` : '',
    stage ? `所属阶段：${stage}` : '',
    '',
    `评分量表：${rubric.scale}（整数，10 为最佳）。各维度分别打分，并给出 overall 总分。`,
    '评分维度：',
    dims,
    '',
    '只输出一个 JSON 对象，不要其它文字，形如：',
    '{"overall": 8, "dimensions": {"layout": 8, "dataIntegrity": 7, "requirementFit": 9, "usability": 8, "cliCorrectness": 8, "outputCompliance": 9}, "comment": "一句话点评"}',
  ].filter(Boolean).join('\n');
}

/**
 * 自动打分：逐张截图调 agent。
 * @returns {{available:boolean, scores:Array}}
 */
function autoScoreScreenshots(options = {}) {
  const screenshots = (options.screenshots || []).filter((s) => s.ok && s.path);
  const rubric = options.rubric || DEFAULT_RUBRIC;
  const agent = options.runAgent || runAgent;

  if (screenshots.length === 0) {
    return { available: true, scores: [] };
  }

  const scores = [];
  let anyUnavailable = false;
  const agentCmd = resolveAgentCommand();

  for (const shot of screenshots) {
    const prompt = buildScorePrompt({
      screenshotPath: shot.path,
      url: shot.url,
      stage: shot.stage,
      rubric,
    });
    const res = agent({ prompt, timeoutMs: options.timeoutMs });
    if (!res.available) {
      anyUnavailable = true;
      scores.push({
        stage: shot.stage,
        url: shot.url,
        screenshot: shot.path,
        auto: null,
        human: null,
        note: `${agentCmd} CLI 不可用，已跳过自动打分`,
      });
      continue;
    }
    scores.push({
      stage: shot.stage,
      url: shot.url,
      screenshot: shot.path,
      auto: res.json
        ? { ...res.json, model: `${agentCmd} -p`, rubric: rubric.scale }
        : { error: '无法从 agent 输出解析评分 JSON', raw: res.text ? res.text.slice(0, 500) : null },
      human: null,
    });
  }

  return { available: !anyUnavailable, scores };
}

/**
 * 人工模式：仅产出占位评分项。
 */
function buildHumanScores(screenshots = []) {
  return screenshots.map((shot) => ({
    stage: shot.stage,
    url: shot.url,
    screenshot: shot.ok ? shot.path : null,
    auto: null,
    human: null, // 由评审在 scoring.md 中填写后回填
  }));
}

function toMarkdownPath(abs, workDir) {
  if (!abs) {return null;}
  if (!workDir) {return abs.replace(/\\/g, '/');}

  const isWindowsPath = /^[a-zA-Z]:[\\/]/.test(abs) || /^[a-zA-Z]:[\\/]/.test(workDir);
  const relPath = isWindowsPath
    ? path.win32.relative(workDir, abs)
    : path.relative(workDir, abs);

  return (relPath || abs).replace(/\\/g, '/');
}

/**
 * 生成人工打分文档（Markdown），内嵌截图与链接。
 * @param {object} options
 * @param {object} options.config
 * @param {Array} options.scores
 * @param {string} options.workDir manifest/截图所在目录，用于计算相对路径
 * @param {object} [options.rubric]
 */
function renderScoringMarkdown(options = {}) {
  const { config = {}, scores = [], workDir, rubric = DEFAULT_RUBRIC } = options;

  const lines = [];
  lines.push('# 宜搭应用效果 · 人工打分表');
  lines.push('');
  lines.push(`- 生成时间：${new Date().toISOString()}`);
  lines.push(`- 子技能过滤：${config.skill || '（全链路）'}`);
  lines.push(`- 阶段：${config.resolvedStages || '默认'}`);
  lines.push(`- 评分量表：${rubric.scale}（整数，10 为最佳）`);
  lines.push('');
  lines.push('评分维度：');
  for (const d of rubric.dimensions) {
    lines.push(`- **${d.label}**（${d.key}）：${d.desc}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  if (scores.length === 0) {
    lines.push('> 本次没有可打分的已发布页面（无截图目标）。');
    lines.push('');
  }

  scores.forEach((s, idx) => {
    lines.push(`## ${idx + 1}. ${s.stage || '页面'}`);
    lines.push('');
    if (s.url) {lines.push(`- 链接：${s.url}`);}
    if (s.screenshot) {
      const relPath = toMarkdownPath(s.screenshot, workDir);
      lines.push(`- 截图：\`${relPath}\``);
      lines.push('');
      lines.push(`![${s.stage || 'screenshot'}](${relPath})`);
    } else {
      lines.push('- 截图：（无 / 截取失败）');
    }
    lines.push('');
    if (s.auto && !s.auto.error) {
      lines.push(`- 自动打分参考（${s.auto.model || 'agent'}）：overall=${s.auto.overall ?? 'n/a'}`);
      if (s.auto.comment) {lines.push(`  - 点评：${s.auto.comment}`);}
    }
    lines.push('');
    lines.push('| 维度 | 人工评分(1-10) | 备注 |');
    lines.push('| --- | --- | --- |');
    for (const d of rubric.dimensions) {
      lines.push(`| ${d.label} |  |  |`);
    }
    lines.push('| **总分(overall)** |  |  |');
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * 写出 scoring.md，返回路径。
 */
function writeScoringDoc(workDir, content, fileName = 'scoring.md') {
  fs.mkdirSync(workDir, { recursive: true });
  const docPath = path.join(workDir, fileName);
  fs.writeFileSync(docPath, content, 'utf8');
  return docPath;
}

module.exports = {
  DEFAULT_RUBRIC,
  buildScorePrompt,
  autoScoreScreenshots,
  buildHumanScores,
  renderScoringMarkdown,
  toMarkdownPath,
  writeScoringDoc,
};
