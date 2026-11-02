'use strict';

/** Local prototype evaluation: same requests and output contract, different Skill snapshots.
 * This module is not an OpenYida command and never creates/publishes platform resources.
 * Artifact generation, browser checks and human design review have separate outcomes.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { runAgent } = require('./agent');
const { loadGenerationScenarios } = require('./generate');

const DESIGN_KEYS = ['firstScreenFocus', 'layout', 'primaryAction', 'responsive', 'acceptanceChecks'];
const CONTEXT_FILES = [
  'yida-skills/skills/yida-design/references/task-driven-visual-design.md',
  'yida-skills/skills/yida-design/references/responsive-layout.md',
  'yida-skills/skills/yida-design/workflow/step-4-wireframe-interaction.md',
];

/** Read the same complete references from either a Git snapshot reader or the working tree. */
function loadContext(readFile) {
  return CONTEXT_FILES.map(file => `\n--- ${file} ---\n${readFile(file)}`).join('\n');
}

/** Keep task/output instructions identical between variants; do not supply a preferred design. */
function buildPrompt(scenario, context) {
  return [
    '这是隔离的设计生成评测。只依据下方规则和需求生成本地可运行原型，不调用工具、不读其他技能、不创建或发布宜搭资源。',
    '本次抽样验证设计决策到浏览器表现，不验证完整平台开发流程；原生表单也只做交互示意。',
    context,
    `用户需求：${scenario.prompt}`,
    '只返回合法 JSON：{"design":{"firstScreenFocus":"...","layout":"...","primaryAction":"...","responsive":"...","acceptanceChecks":["..."]},"html":"完整独立HTML"}。',
    'design 严格复用这五个既有字段，不新增设计字段。html 是评测产物，不是产品设计字段。',
    '先决定设计再实现；HTML 含内联 CSS/JS，无外部资源、网络请求、平台调用或存储。标明演示数据，按钮可本地交互。',
    '浏览器测试会将页面嵌在不同宽度的 iframe 中，并保留同一文档调整宽度；同时检查宽桌面中变窄的内容容器。',
    '仅为测试定位：页面内容的共同容器 id="app"；一个可编辑且不会自动提交的现有输入标记 data-eval-state；一个主要动作标记 data-eval-primary。不新增业务控件来满足标记。',
    'HTML 可直接保存运行；不要声称已运行测试。控制原型复杂度，优先完整可操作的一页。',
  ].join('\n\n');
}

/** Validate transport and existing-field shape, not subjective quality or rendered behavior. */
function parseArtifact(result) {
  if (!result || !result.available || !result.ok) {
    throw new Error(result?.error || 'generation unavailable or failed');
  }
  const raw = String(result.text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const artifact = JSON.parse(raw);
  const keys = Object.keys(artifact.design || {}).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...DESIGN_KEYS].sort())) {
    throw new Error('design must use exactly the five existing fields');
  }
  for (const key of DESIGN_KEYS.slice(0, -1)) {
    if (typeof artifact.design[key] !== 'string' || !artifact.design[key].trim()) {
      throw new Error(`empty design field: ${key}`);
    }
  }
  const checks = artifact.design.acceptanceChecks;
  if (!Array.isArray(checks) || !checks.length || checks.some(x => typeof x !== 'string' || !x.trim())) {
    throw new Error('acceptanceChecks must contain concrete checks');
  }
  if (typeof artifact.html !== 'string' || !/<html[\s>]/i.test(artifact.html) || !/<\/html>/i.test(artifact.html)) {
    throw new Error('missing standalone HTML artifact');
  }
  return artifact;
}

/** Generate sequentially with an injectable real agent; save raw failures as well as successes. */
async function runEvaluation(options) {
  const scenarios = options.scenarios || loadGenerationScenarios(path.join(__dirname, 'scenarios/responsive-design/cases.json'));
  const agent = options.runAgent || runAgent;
  const report = { scope: 'local-prototype', agent: options.agentLabel || 'configured agent', results: [] };
  fs.mkdirSync(options.outputDir, { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'scenarios/responsive-design/browser-review.html'),
    path.join(options.outputDir, 'browser-review.html'));
  fs.writeFileSync(path.join(options.outputDir, 'cases.json'), JSON.stringify(scenarios, null, 2));
  for (const scenario of scenarios) {
    for (const variant of options.variants) {
      if (![scenario.id, variant.id].every(x => /^[a-z0-9-]+$/.test(x))) {throw new Error('invalid evaluation id');}
      const id = `${scenario.id}-${variant.id}`;
      const prompt = buildPrompt(scenario, variant.context);
      const row = { id, scenario: scenario.id, variant: variant.id, source: variant.source,
        contextHash: crypto.createHash('sha256').update(variant.context).digest('hex'),
        review: scenario.review, status: 'failed', browser: 'not-run', designReview: 'not-run' };
      fs.writeFileSync(path.join(options.outputDir, `${id}.prompt.txt`), prompt);
      const started = Date.now();
      try {
        const result = await agent({ prompt, timeoutMs: options.timeoutMs || 240000 });
        fs.writeFileSync(path.join(options.outputDir, `${id}.raw.txt`), result?.text || result?.error || 'no output');
        const artifact = parseArtifact(result);
        fs.writeFileSync(path.join(options.outputDir, `${id}.json`), JSON.stringify(artifact, null, 2));
        fs.writeFileSync(path.join(options.outputDir, `${id}.html`), artifact.html);
        row.status = 'generated';
      } catch (error) {
        row.error = error.message;
      }
      row.durationMs = Date.now() - started;
      report.results.push(row);
      fs.writeFileSync(path.join(options.outputDir, 'generation-report.json'), JSON.stringify(report, null, 2));
      if (options.onResult) {options.onResult(row);}
    }
  }
  return report;
}

module.exports = { DESIGN_KEYS, CONTEXT_FILES, loadContext, buildPrompt, parseArtifact, runEvaluation };
