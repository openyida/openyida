#!/usr/bin/env node

'use strict';

/**
 * 路由测评（agent-in-the-loop）：测 agent 能否从 ~50 个子技能里选对一个。
 *
 * 把 scenario 的自然语言请求 + 主 SKILL.md 路由说明喂给本地 agent，
 * 让它输出"会选哪个子技能"，与 golden 期望对比，算命中率与混淆对。
 * 这直接度量"改动 SKILL.md 路由表后效果变好还是变差"。
 */

const fs = require('fs');
const path = require('path');

const { runAgent } = require('./agent');
const { listSkillNames } = require('../e2e-real/skill-coverage');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_SKILL_MD = path.join(ROOT, 'yida-skills', 'SKILL.md');

/**
 * 读取主 SKILL.md 作为路由权威说明。
 */
function loadRoutingContext(skillMdPath = DEFAULT_SKILL_MD) {
  return fs.readFileSync(skillMdPath, 'utf8');
}

/**
 * 加载 scenarios 目录下的 *.json golden 用例。
 * @returns {Array<{id, prompt, expectedSkill, expectedMode?, forbiddenDefaultSkills?, expectedStages?, rubric?}>}
 */
function loadScenarios(dir) {
  if (!dir || !fs.existsSync(dir)) {return [];}
  const files = fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort();
  const scenarios = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      scenarios.push({ _file: file, ...item });
    }
  }
  return scenarios;
}

/**
 * 规整子技能名（去掉前导斜杠/空白，统一小写比较用）。
 */
function normalizeSkill(name) {
  return String(name || '').trim().replace(/^\/+/, '').toLowerCase();
}

/**
 * 构造路由 prompt。
 */
function buildRoutingPrompt({ request, routingContext, skillNames }) {
  return [
    '下面是宜搭 AI 应用开发技能（openyida）的路由说明文档。请严格依据它，',
    '判断针对用户请求应当选择哪一个**子技能**来处理。如果是完整应用搭建，还要判断 yida-app 的模式。',
    '',
    '=== 路由说明文档开始 ===',
    routingContext,
    '=== 路由说明文档结束 ===',
    '',
    `可选子技能名（必须从中精确选一个）：\n${skillNames.join(', ')}`,
    '',
    `用户请求：「${request}」`,
    '',
    '只输出一个 JSON 对象，不要任何其它文字，形如：',
    '{"skill": "yida-app", "mode": "fast_build", "defaultLoadSkills": ["yida-app"], "reason": "一句话理由"}',
    '',
    '要求：',
    '- skill 必须是上面可选子技能名之一。',
    '- 只有完整应用搭建才填写 mode；默认方案 / 不要追问 / 直接创建 必须是 fast_build。',
    '- defaultLoadSkills 只列默认会加载的技能；optionalAfterDone 不要列入默认加载。',
  ].join('\n');
}

function normalizeSkillList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(normalizeSkill).filter(Boolean);
}

/**
 * 评测单条 scenario（支持 mustNotTrigger 反例检测）。
 */
function evaluateScenario(options = {}) {
  const { scenario, routingContext, skillNames } = options;
  const agent = options.runAgent || runAgent;

  const prompt = buildRoutingPrompt({
    request: scenario.prompt,
    routingContext,
    skillNames,
  });
  const res = agent({ prompt, timeoutMs: options.timeoutMs, cwd: options.cwd });

  if (!res.available) {
    return {
      id: scenario.id,
      expected: scenario.expectedSkill,
      actual: null,
      hit: null,
      status: 'agent-unavailable',
    };
  }

  // agent 可用但本次调用失败（如未登录 / 配额 / API 错误）——区别于”拿到回答但解析不出技能”。
  if (!res.ok && !res.json) {
    return {
      id: scenario.id,
      expected: scenario.expectedSkill,
      actual: null,
      hit: null,
      status: 'agent-error',
      error: res.error || null,
      raw: res.text ? res.text.slice(0, 300) : undefined,
    };
  }

  const actual = res.json && res.json.skill ? res.json.skill : null;
  const skillHit = actual !== null
    && normalizeSkill(actual) === normalizeSkill(scenario.expectedSkill);
  const actualMode = res.json && res.json.mode ? String(res.json.mode).trim() : null;
  const modeHit = scenario.expectedMode
    ? normalizeSkill(actualMode) === normalizeSkill(scenario.expectedMode)
    : null;
  const defaultLoadSkills = normalizeSkillList(res.json && res.json.defaultLoadSkills);
  const forbiddenDefaultSkillHits = normalizeSkillList(scenario.forbiddenDefaultSkills)
    .filter(skillName => defaultLoadSkills.includes(skillName));

  // mustNotTrigger: for negative/disambiguation scenarios, check the selected skill
  // is NOT in the mustNotTrigger list
  const mustNotTrigger = normalizeSkillList(scenario.mustNotTrigger);
  const mustNotTriggerViolations = actual && mustNotTrigger.length
    ? mustNotTrigger.filter(s => normalizeSkill(actual) === s)
    : [];

  const hit = skillHit
    && (modeHit !== false)
    && forbiddenDefaultSkillHits.length === 0
    && mustNotTriggerViolations.length === 0;

  return {
    id: scenario.id,
    expected: scenario.expectedSkill,
    actual,
    expectedMode: scenario.expectedMode || null,
    actualMode,
    modeHit,
    defaultLoadSkills,
    forbiddenDefaultSkillHits,
    mustNotTriggerViolations,
    reason: res.json ? res.json.reason : null,
    hit,
    status: actual === null ? 'unparsed' : 'ok',
    raw: actual === null && res.text ? res.text.slice(0, 300) : undefined,
  };
}

/**
 * 汇总：命中率 + 混淆对。
 */
function summarize(results = []) {
  const evaluated = results.filter((r) => r.status === 'ok');
  const hits = evaluated.filter((r) => r.hit);
  const confusionMap = new Map();
  for (const r of evaluated) {
    if (r.hit) {continue;}
    const key = `${r.expected} → ${r.actual}`;
    confusionMap.set(key, (confusionMap.get(key) || 0) + 1);
  }
  const confusion = [...confusionMap.entries()]
    .map(([pair, count]) => ({ pair, count }))
    .sort((a, b) => b.count - a.count);

  return {
    total: results.length,
    evaluated: evaluated.length,
    hits: hits.length,
    accuracy: evaluated.length ? +(hits.length / evaluated.length).toFixed(4) : null,
    unparsed: results.filter((r) => r.status === 'unparsed').length,
    agentError: results.filter((r) => r.status === 'agent-error').length,
    agentUnavailable: results.filter((r) => r.status === 'agent-unavailable').length,
    confusion,
  };
}

/**
 * 跑整套路由测评（支持 --runs 多轮稳定性、--skill 技能过滤）。
 */
function runRoutingEval(options = {}) {
  const scenariosDir = options.scenariosDir;
  let scenarios = options.scenarios || loadScenarios(scenariosDir);
  const routingContext = options.routingContext || loadRoutingContext(options.skillMdPath);
  const skillNames = options.skillNames || listSkillNames();
  const runs = options.runs || 1;

  // Skill filter: only run scenarios whose expectedSkill matches
  if (options.skill) {
    const filterSkill = normalizeSkill(options.skill);
    scenarios = scenarios.filter((s) =>
      normalizeSkill(s.expectedSkill) === filterSkill
      || (s.mustNotTrigger && s.mustNotTrigger.some((m) => normalizeSkill(m) === filterSkill))
    );
  }

  const results = scenarios.map((scenario) => evaluateScenario({
    scenario,
    routingContext,
    skillNames,
    runAgent: options.runAgent,
    timeoutMs: options.timeoutMs,
    cwd: options.cwd,
  }));

  // Multi-run stability: repeat each scenario `runs` times and compute consistency
  let stability = null;
  if (runs > 1) {
    const stabilityResults = [];
    for (const scenario of scenarios) {
      const runResults = [];
      for (let r = 0; r < runs; r++) {
        const result = evaluateScenario({
          scenario,
          routingContext,
          skillNames,
          runAgent: options.runAgent,
          timeoutMs: options.timeoutMs,
          cwd: options.cwd,
        });
        runResults.push(result);
      }
      const evaluated = runResults.filter((r) => r.status === 'ok');
      const actuals = evaluated.map((r) => normalizeSkill(r.actual));
      const allSame = actuals.length > 0 && actuals.every((a) => a === actuals[0]);
      stabilityResults.push({
        id: scenario.id,
        runs: runResults.length,
        evaluated: evaluated.length,
        consistent: allSame,
        actuals,
      });
    }
    const consistentCount = stabilityResults.filter((s) => s.consistent).length;
    const evaluatedCount = stabilityResults.filter((s) => s.evaluated > 0).length;
    stability = {
      runs,
      scenarios: stabilityResults.length,
      consistent: consistentCount,
      consistencyRate: evaluatedCount > 0 ? +(consistentCount / evaluatedCount).toFixed(4) : null,
      details: stabilityResults,
    };
  }

  return {
    summary: summarize(results),
    results,
    stability,
    scenariosDir,
  };
}

module.exports = {
  DEFAULT_SKILL_MD,
  loadRoutingContext,
  loadScenarios,
  normalizeSkill,
  buildRoutingPrompt,
  evaluateScenario,
  summarize,
  runRoutingEval,
};


// ---------------------------------------------------------------------------
// Parallel/Batch routing (async entry)
// ---------------------------------------------------------------------------

/**
 * Async routing evaluation with batching + parallel + caching.
 *
 * Drop-in replacement for runRoutingEval when performance matters.
 * Falls back to serial mode if parallel module is missing.
 *
 * @param {object} options — same as runRoutingEval, plus:
 * @param {number} [options.batchSize=5]  — scenarios per batch prompt
 * @param {number} [options.concurrency=4] — max parallel processes
 * @param {boolean} [options.useCache=true] — use result cache
 * @param {function} [options.onProgress] — callback(completed, total)
 * @returns {Promise<{summary, results, stability?, scenariosDir, stats?}>}
 */
async function runRoutingEvalAsync(options = {}) {
  let parallel;
  try { parallel = require('./parallel'); } catch (_e) { parallel = null; }

  // Fallback to serial
  if (!parallel) {
    return runRoutingEval(options);
  }

  const scenariosDir = options.scenariosDir;
  let scenarios = options.scenarios || loadScenarios(scenariosDir);
  const routingContext = options.routingContext || loadRoutingContext(options.skillMdPath);
  const skillNames = options.skillNames || listSkillNames();

  // Skill filter
  if (options.skill) {
    const filterSkill = normalizeSkill(options.skill);
    scenarios = scenarios.filter((s) =>
      normalizeSkill(s.expectedSkill) === filterSkill
      || (s.mustNotTrigger && s.mustNotTrigger.some((m) => normalizeSkill(m) === filterSkill))
    );
  }

  const { resolveAgentCommand } = require('./agent');
  const agentCommand = options.agentCommand || resolveAgentCommand();

  const { results, stats } = await parallel.runParallelRouting({
    scenarios,
    routingContext,
    skillNames,
    agentCommand,
    batchSize: options.batchSize || 5,
    concurrency: options.concurrency || 4,
    timeoutMs: options.timeoutMs || 120000,
    useCache: options.useCache !== false,
    onProgress: options.onProgress,
  });

  return {
    summary: summarize(results),
    results,
    stability: null,
    scenariosDir,
    stats,
  };
}

module.exports.runRoutingEvalAsync = runRoutingEvalAsync;
