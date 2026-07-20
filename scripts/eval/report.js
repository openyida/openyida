#!/usr/bin/env node

'use strict';

/**
 * 把一次端到端测评（护栏 + 截图 + 打分）渲染成一份自包含的 HTML 可视化报告。
 *
 * - 截图以 base64 data URI 内联：单文件可直接双击打开 / 拷走分享，不依赖相对路径。
 * - 零依赖、纯字符串拼接；缺图/失败项以占位卡片展示，不影响整体渲染。
 */

const fs = require('fs');
const path = require('path');

const { DEFAULT_RUBRIC } = require('./score');

/**
 * HTML 转义，防止 URL / 评语里的特殊字符破坏结构。
 */
function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 把本地截图文件读成 data URI；失败返回 null。
 */
function imageToDataUri(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) {return null;}
    const ext = path.extname(filePath).slice(1).toLowerCase() || 'png';
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
    const b64 = fs.readFileSync(filePath).toString('base64');
    return `data:${mime};base64,${b64}`;
  } catch {
    return null;
  }
}

function statusBadge(status) {
  const map = {
    pass: ['#0a7d33', '#e4f7ea', '✔ PASS'],
    fail: ['#b42318', '#fde8e6', '✗ FAIL'],
    skip: ['#6b7280', '#eef0f3', '· SKIP'],
  };
  const [color, bg, label] = map[status] || map.skip;
  return `<span class="badge" style="color:${color};background:${bg}">${label}</span>`;
}

// 已知跳过码 -> 友好中文描述（避免把原始错误横幅堆到卡片里）。
const SKIP_LABELS = {
  'playwright-missing': '未安装 Playwright（截图为软依赖）',
  'browser-missing': 'Playwright 浏览器未下载',
};

/**
 * 把可能跨多行/带框线的错误信息压成可读的单行摘要。
 */
function cleanMessage(msg, max = 160) {
  const first = String(msg === undefined || msg === null ? '' : msg)
    .split('\n')[0]
    .replace(/[\u2500-\u257f]/g, '') // 去掉制表符框线字符
    .trim();
  return first.length > max ? `${first.slice(0, max)}…` : first;
}

/**
 * 渲染单张截图 + 打分卡片。
 * @param {object} shot 截图项 {stage,type,url,ok,path,skipped,error}
 * @param {object|null} score 对应打分项 {auto,human}
 * @param {object} rubric
 */
function renderCard(shot, score, rubric, index) {
  const title = `${index}. ${escapeHtml(shot.stage || '页面')}${shot.type && shot.type !== shot.stage ? `（${escapeHtml(shot.type)}）` : ''}`;
  const urlLine = shot.url
    ? `<a class="url" href="${escapeHtml(shot.url)}" target="_blank" rel="noreferrer">${escapeHtml(shot.url)}</a>`
    : '<span class="muted">（无 URL）</span>';

  let media;
  const dataUri = shot.ok ? imageToDataUri(shot.path) : null;
  if (dataUri) {
    media = `<a href="${escapeHtml(shot.url || '#')}" target="_blank" rel="noreferrer"><img class="shot" src="${dataUri}" alt="${title}"></a>`;
  } else {
    if (shot.skipped) {
      const label = SKIP_LABELS[shot.skipped] || cleanMessage(shot.skipped);
      // 保留原始跳过码到 data-skip，便于排查与测试断言。
      media = `<div class="shot placeholder" data-skip="${escapeHtml(shot.skipped)}">已跳过：${escapeHtml(label)}</div>`;
    } else if (shot.error) {
      media = `<div class="shot placeholder">截取失败：${escapeHtml(cleanMessage(shot.error))}</div>`;
    } else {
      media = '<div class="shot placeholder">无截图</div>';
    }
  }

  // 自动打分块
  let autoBlock = '';
  const auto = score && score.auto;
  if (auto && !auto.error) {
    const dims = auto.dimensions || {};
    const dimRows = rubric.dimensions.map((d) => {
      const v = dims[d.key];
      const pct = typeof v === 'number' ? Math.max(0, Math.min(100, (v / 10) * 100)) : 0;
      return `<div class="dim">
        <span class="dim-label">${escapeHtml(d.label)}</span>
        <span class="bar"><span class="bar-fill" style="width:${pct}%"></span></span>
        <span class="dim-val">${v === undefined ? '—' : escapeHtml(v)}</span>
      </div>`;
    }).join('');
    autoBlock = `<div class="score auto">
      <div class="score-head">自动打分 <span class="muted">(${escapeHtml(auto.model || 'agent')})</span>
        <span class="overall">${escapeHtml(auto.overall === undefined ? 'n/a' : auto.overall)}<small>/10</small></span></div>
      ${dimRows}
      ${auto.comment ? `<p class="comment">“${escapeHtml(auto.comment)}”</p>` : ''}
    </div>`;
  } else if (auto && auto.error) {
    autoBlock = `<div class="score auto err">自动打分失败：${escapeHtml(auto.error)}</div>`;
  }

  // 人工打分块
  const human = score && score.human;
  const humanBlock = human
    ? `<div class="score human">人工打分：overall=${escapeHtml(human.overall ?? 'n/a')}${human.comment ? ` — ${escapeHtml(human.comment)}` : ''}</div>`
    : '<div class="score human muted">人工打分：待填写（见 scoring.md）</div>';

  return `<section class="card">
    <h3>${title}</h3>
    <div class="meta">${urlLine}</div>
    ${media}
    ${autoBlock}
    ${humanBlock}
  </section>`;
}

/**
 * 渲染完整 HTML 报告。
 * @param {object} options
 * @param {object} [options.config]      解析后的配置
 * @param {object} [options.registry]    full-runner 的 registry（取 runId / resultApp）
 * @param {Array}  [options.guardrails]
 * @param {Array}  [options.screenshots]
 * @param {Array}  [options.scores]
 * @param {object} [options.rubric]
 * @param {string} [options.generatedAt]
 * @returns {string} HTML
 */
function renderEvalReportHtml(options = {}) {
  const {
    config = {},
    registry = {},
    guardrails = [],
    screenshots = [],
    scores = [],
    rubric = DEFAULT_RUBRIC,
  } = options;
  const generatedAt = options.generatedAt || new Date().toISOString();
  const runId = registry.runId || registry.id || (registry.resultApp && registry.resultApp.runId) || '—';

  const scoreByUrl = new Map();
  for (const s of scores) {if (s && s.url) {scoreByUrl.set(s.url, s);}}

  const okShots = screenshots.filter((s) => s.ok).length;
  const autoScored = scores.filter((s) => s.auto && !s.auto.error).length;
  const overallGuardrail = guardrails.some((g) => g.status === 'fail')
    ? 'fail'
    : (guardrails.length ? 'pass' : 'skip');

  const guardrailRows = guardrails.length
    ? guardrails.map((g) => `<tr>
        <td>${escapeHtml(g.name)}</td>
        <td>${statusBadge(g.status)}</td>
        <td>${escapeHtml(g.detail || '')}</td>
      </tr>`).join('')
    : '<tr><td colspan="3" class="muted">（无护栏记录）</td></tr>';

  const cards = screenshots.length
    ? screenshots.map((shot, i) => renderCard(shot, scoreByUrl.get(shot.url), rubric, i + 1)).join('\n')
    : '<p class="muted">本次没有可截图/打分的已发布页面目标。</p>';

  // 若所有截图都因环境原因（浏览器/Playwright 缺失）被跳过，顶部统一提示一次，不再逐卡片刷屏。
  const envSkipCodes = new Set(['browser-missing', 'playwright-missing']);
  const envSkips = screenshots.filter((s) => envSkipCodes.has(s.skipped));
  let noticeHtml = '';
  if (screenshots.length && envSkips.length === screenshots.length) {
    const browserMissing = envSkips.some((s) => s.skipped === 'browser-missing');
    const cause = browserMissing
      ? 'Playwright 已安装，但缺少浏览器二进制文件。'
      : '未安装 Playwright（截图为软依赖）。';
    noticeHtml = `<div class="notice">
      <span class="notice-ico">ⓘ</span>
      <div><b>页面截图未生成</b>：${cause}
      执行 <code>npx playwright install chromium</code> 后重新运行评测即可生成截图；<b>护栏、打分与报告其余内容不受影响</b>。</div>
    </div>`;
  }

  const chips = [
    `<span class="chip">模式 <b>${escapeHtml(config.mode || 'e2e')}</b></span>`,
    `<span class="chip">子技能 <b>${escapeHtml(config.skill || '全链路')}</b></span>`,
    `<span class="chip">阶段 <b>${escapeHtml(config.resolvedStages || '默认')}</b></span>`,
    `<span class="chip">截图 <b>${okShots}/${screenshots.length}</b></span>`,
    `<span class="chip">自动打分 <b>${autoScored}</b></span>`,
    `<span class="chip">护栏 ${statusBadge(overallGuardrail)}</span>`,
  ].join('');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OpenYida 测评报告 · ${escapeHtml(runId)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;
         background: #f5f6f8; color: #1f2329; }
  header { background: #fff; border-bottom: 1px solid #e7e9ee; padding: 24px 32px; }
  header h1 { margin: 0 0 4px; font-size: 20px; }
  header .sub { color: #6b7280; font-size: 13px; }
  .chips { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { background: #f0f2f5; border-radius: 999px; padding: 4px 12px; font-size: 12px; color: #4b5563; }
  .chip b { color: #111827; font-weight: 600; }
  .badge { border-radius: 6px; padding: 1px 8px; font-size: 12px; font-weight: 600; }
  main { padding: 24px 32px; max-width: 1100px; margin: 0 auto; }
  h2 { font-size: 15px; margin: 28px 0 12px; color: #374151; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e7e9ee; border-radius: 8px; overflow: hidden; }
  th, td { text-align: left; padding: 10px 14px; border-bottom: 1px solid #f0f2f5; font-size: 13px; vertical-align: top; }
  th { background: #fafbfc; color: #6b7280; font-weight: 600; }
  tr:last-child td { border-bottom: none; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 18px; }
  .card { background: #fff; border: 1px solid #e7e9ee; border-radius: 10px; padding: 16px; }
  .card h3 { margin: 0 0 6px; font-size: 14px; }
  .card .meta { margin-bottom: 10px; word-break: break-all; }
  .url { color: #2563eb; text-decoration: none; font-size: 12px; }
  .url:hover { text-decoration: underline; }
  img.shot { width: 100%; border: 1px solid #eceef2; border-radius: 6px; display: block; background: #fafbfc; }
  .shot.placeholder { display: flex; align-items: center; justify-content: center; min-height: 160px;
                      background: #fafbfc; border: 1px dashed #d6d9e0; border-radius: 6px; color: #9aa1ad; font-size: 13px; }
  .score { margin-top: 12px; font-size: 13px; }
  .score.auto { background: #f8fafc; border: 1px solid #eef1f5; border-radius: 8px; padding: 10px 12px; }
  .score-head { font-weight: 600; display: flex; align-items: center; gap: 6px; }
  .overall { margin-left: auto; font-size: 18px; font-weight: 700; color: #2563eb; }
  .overall small { font-size: 11px; color: #9aa1ad; font-weight: 500; }
  .dim { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
  .dim-label { width: 96px; color: #6b7280; font-size: 12px; flex: none; }
  .bar { flex: 1; height: 8px; background: #eef1f5; border-radius: 999px; overflow: hidden; }
  .bar-fill { display: block; height: 100%; background: linear-gradient(90deg,#60a5fa,#2563eb); }
  .dim-val { width: 24px; text-align: right; font-variant-numeric: tabular-nums; color: #374151; }
  .comment { margin: 8px 0 0; color: #4b5563; font-style: italic; }
  .score.auto.err { background: #fef3f2; border-color: #fdd; color: #b42318; }
  .score.human { margin-top: 8px; color: #374151; }
  .notice { display: flex; gap: 10px; align-items: flex-start; background: #fff7ed; border: 1px solid #fed7aa;
            border-radius: 8px; padding: 12px 14px; margin: 0 0 16px; color: #92400e; font-size: 13px; line-height: 1.7; }
  .notice-ico { flex: none; font-size: 15px; line-height: 1.5; }
  .notice code { background: #fffdf7; border: 1px solid #fed7aa; border-radius: 4px; padding: 1px 6px;
                 font-size: 12px; color: #b45309; }
  .muted { color: #9aa1ad; }
  footer { padding: 20px 32px 48px; color: #9aa1ad; font-size: 12px; max-width: 1100px; margin: 0 auto; }
</style>
</head>
<body>
<header>
  <h1>OpenYida 应用效果测评报告</h1>
  <div class="sub">runId: ${escapeHtml(runId)} · 生成于 ${escapeHtml(generatedAt)}</div>
  <div class="chips">${chips}</div>
</header>
<main>
  <h2>护栏断言</h2>
  <table>
    <thead><tr><th>断言</th><th>结果</th><th>说明</th></tr></thead>
    <tbody>${guardrailRows}</tbody>
  </table>

  <h2>页面截图与打分（${screenshots.length}）</h2>
  ${noticeHtml}
  <div class="grid">
    ${cards}
  </div>
</main>
<footer>
  评分量表：${escapeHtml(rubric.scale)}（整数，10 为最佳）·
  维度：${rubric.dimensions.map((d) => escapeHtml(d.label)).join(' / ')}。
  人工打分请在同目录 scoring.md 填写。
</footer>
</body>
</html>`;
}

/**
 * 写出 HTML 报告，返回路径。
 */
function writeReport(workDir, html, fileName = 'eval-report.html') {
  fs.mkdirSync(workDir, { recursive: true });
  const reportPath = path.join(workDir, fileName);
  fs.writeFileSync(reportPath, html, 'utf8');
  return reportPath;
}

module.exports = {
  escapeHtml,
  imageToDataUri,
  renderEvalReportHtml,
  writeReport,
};
