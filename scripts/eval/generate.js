#!/usr/bin/env node

'use strict';

/**
 * 真实生成测评：自然语言 → agent 真实生成应用（agent-in-the-loop，**会建真实宜搭资源**）。
 *
 * 目的：度量「端到端 —— 用户一句话 → 技能真能生成可用应用」的整体效果。
 *
 * 与其他测评的区别：
 *   - 路由测评（routing.js）：只问 agent「该选哪个子技能」，不动任何资源。
 *   - 工具管道基线（full-runner）：确定性 CLI 链路，用固定命名直接调 create-* 命令，
 *     验证「建应用→截图→打分」这套管道本身能跑通，**不经过自然语言、不经过 agent**。
 *   - 真实生成（本文件）：把一句「帮我创建一个订单管理系统」喂给本地 `claude -p`，
 *     让它**自己读懂 openyida 技能、自己决定并真的执行 CLI 命令**产出真实应用，
 *     再把产出的页面 URL 交给现有截图 + 打分 + HTML 报告链路。
 *
 * 设计原则：
 *   - agent 运行器可注入（runGenerationAgent），单测永远不碰真实 CLI / 不建资源。
 *   - 真实运行器用 `claude -p` 并开放工具执行权限（Bash/Read/Write），cwd 指向仓库根。
 *   - 解析 agent 自报的产出 JSON 时尽量鲁棒：取最后一个含生成相关字段的 JSON 对象。
 */

const fs = require('fs');
const path = require('path');

const { runAgent, extractJsonObject, resolveAgentCommand, getAgentAdapter } = require('./agent');
const { createCommandTraceSession } = require('./command-trace');
const { buildGenerationEvidence, evaluateGenerationEvidence, runEvidenceCollector, mergeEvidence } = require('./evidence');
const { collectOpenYidaReadback } = require('./openyida-readback');
const { deriveOptimizationFindings } = require('./optimization-findings');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_SKILL_MD = path.join(ROOT, 'yida-skills', 'SKILL.md');
const DEFAULT_SCENARIOS = path.join(__dirname, 'scenarios', 'generation');

// agent 必须在产出末尾打印的结果对象前缀（哨兵），便于稳健解析。
const RESULT_SENTINEL = 'OPENYIDA_GENERATION_RESULT';

/**
 * 读取主 SKILL.md 作为 openyida 技能上下文（截断到合理长度，避免超长 prompt）。
 */
function loadSkillContext(skillMdPath = DEFAULT_SKILL_MD, maxChars = 8000) {
  try {
    const raw = fs.readFileSync(skillMdPath, 'utf8');
    return raw.length > maxChars ? `${raw.slice(0, maxChars)}\n…（已截断）` : raw;
  } catch {
    return '';
  }
}

/**
 * 加载生成测评 golden 集（数组或单对象皆可）。
 * 每条：{ id, prompt, expectedFeatures? }
 */
function loadGenerationScenarios(scenarioPath = DEFAULT_SCENARIOS) {
  if (!scenarioPath || !fs.existsSync(scenarioPath)) {return [];}
  const stat = fs.statSync(scenarioPath);
  const files = [];
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(scenarioPath).filter((n) => n.endsWith('.json')).sort()) {
      files.push(path.join(scenarioPath, name));
    }
  } else {
    files.push(scenarioPath);
  }
  const scenarios = [];
  for (const file of files) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {scenarios.push({ _file: path.basename(file), ...item });}
  }
  return scenarios;
}

/**
 * 构造生成 prompt：要求 agent 用 openyida CLI 真实建应用，并在末尾输出结果 JSON。
 */
function buildGenerationPrompt({ request, skillContext = '', cliName = 'openyida' } = {}) {
  return [
    '你是宜搭应用开发助手。请使用本机已安装的 openyida CLI（命令名 `' + cliName + '`，',
    '也可用别名 `yida`）真实地完成下面的用户需求：创建并发布一个可用的宜搭应用。',
    '',
    '可用工具：Bash（执行 openyida 命令）、Read（查看技能文档与产物）、Write（必要时写配置）。',
    '请先阅读技能文档了解命令与流程，再按需调用命令。务必真正执行命令，而不是只描述步骤。',
    '',
    skillContext ? '=== openyida 技能说明（节选）===' : '',
    skillContext,
    skillContext ? '=== 技能说明结束 ===' : '',
    '',
    `用户需求：「${request}」`,
    '',
    '完成后，请在回答的**最后**单独输出一行哨兵，紧接着一个 JSON 对象（用 ```json 围栏包裹），',
    '汇总你真实创建并发布的产物，形如：',
    RESULT_SENTINEL,
    '```json',
    '{',
    '  "appType": "真实 APP_* 应用 ID（例如 APP_ABC123）",',
    '  "appUrl": "应用主页 URL（如有）",',
    '  "targets": [',
    '    {"type": "page", "url": "已发布页面 URL"},',
    '    {"type": "dashboard", "url": "数据看板 URL"}',
    '  ],',
    '  "skillsUsed": ["本次实际读取和使用的 yida-* 子技能名"],',
    '  "summary": "一句话说明你创建了什么、包含哪些关键字段/页面",',
    '  "evidence": {',
    '    "resources": [{"type":"form|process|page|dashboard|report|integration|permission|i18n|nav", "name":"资源名", "id":"真实资源 ID"}],',
    '    "findings": [{"code":"发现的问题码", "detail":"说明"}]',
    '  }',
    '}',
    '```',
    '必须严格保留 targets/skillsUsed/evidence 字段名，不要改名为 created、assertions 或 capabilityGaps。',
    '只汇报你**真实创建成功**的资源；未成功的不要写进 targets。',
  ].filter((line) => line !== '').join('\n');
}

/**
 * 把 agent 文本里所有顶层 JSON 对象扫出来（花括号配平），返回数组。
 */
function extractAllJsonObjects(text) {
  if (!text || typeof text !== 'string') {return [];}
  const objects = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') {
      if (depth === 0) {start = i;}
      depth += 1;
    } else if (ch === '}') {
      if (depth > 0) {
        depth -= 1;
        if (depth === 0 && start !== -1) {
          const slice = text.slice(start, i + 1);
          try {objects.push(JSON.parse(slice));} catch { /* 跳过非法片段 */ }
          start = -1;
        }
      }
    }
  }
  return objects;
}

/**
 * 判断一个对象是否像「生成结果」（含生成相关键）。
 */
function looksLikeGenerationResult(obj) {
  if (!obj || typeof obj !== 'object') {return false;}
  return ['appType', 'appUrl', 'targets', 'pages', 'created', 'summary'].some((k) => k in obj);
}

function normalizeCreatedType(type) {
  const normalized = String(type || '').toLowerCase();
  if (normalized === 'display') {return 'page';}
  if (normalized === 'nav-group' || normalized === 'nav_group') {return 'nav';}
  return normalized || null;
}

function resultBaseUrl(resultObj = {}) {
  if (typeof resultObj.baseUrl === 'string' && /^https?:\/\//.test(resultObj.baseUrl)) {
    return resultObj.baseUrl.replace(/\/$/, '');
  }
  if (typeof resultObj.appUrl === 'string') {
    try {return new URL(resultObj.appUrl).origin;} catch { /* ignore malformed URL */ }
  }
  return null;
}

function normalizeReportedEvidence(resultObj = {}) {
  const reported = resultObj.evidence && typeof resultObj.evidence === 'object'
    ? resultObj.evidence
    : {};
  const skills = [
    ...(Array.isArray(reported.skills) ? reported.skills : []),
    ...(Array.isArray(resultObj.skillsUsed) ? resultObj.skillsUsed : []),
    ...(Array.isArray(resultObj.usedSkills) ? resultObj.usedSkills : []),
  ];
  const resources = Array.isArray(reported.resources) ? [...reported.resources] : [];
  for (const item of Array.isArray(resultObj.created) ? resultObj.created : []) {
    if (!item || typeof item !== 'object') {continue;}
    resources.push({
      ...item,
      type: normalizeCreatedType(item.type),
      source: item.source || 'agent-report',
    });
  }
  const findings = Array.isArray(reported.findings) ? [...reported.findings] : [];
  for (const gap of Array.isArray(resultObj.capabilityGaps) ? resultObj.capabilityGaps : []) {
    if (!gap || typeof gap !== 'object') {continue;}
    findings.push({
      code: `capability-gap:${gap.area || 'unknown'}`,
      detail: gap.actual || gap.detail || gap.expected || '',
      source: 'agent-report',
    });
  }
  return { ...reported, skills, resources, findings };
}

/**
 * 把各种形态的产物对象归一为打分目标数组：[{stage,type,url}]。
 */
function normalizeTargets(resultObj = {}) {
  const out = [];
  const seen = new Set();
  const push = (type, url) => {
    if (!url || typeof url !== 'string' || seen.has(url)) {return;}
    seen.add(url);
    out.push({ stage: type || 'page', type: type || 'page', url });
  };
  const arrays = [];
  if (Array.isArray(resultObj.targets)) {arrays.push(...resultObj.targets);}
  if (Array.isArray(resultObj.pages)) {arrays.push(...resultObj.pages);}
  for (const item of arrays) {
    if (!item) {continue;}
    if (typeof item === 'string') {push('page', item);}
    else {push(item.type || item.stage, item.url);}
  }
  const baseUrl = resultBaseUrl(resultObj);
  const appType = typeof resultObj.appType === 'string' ? resultObj.appType : null;
  if (baseUrl && appType) {
    for (const item of Array.isArray(resultObj.created) ? resultObj.created : []) {
      if (!item || typeof item !== 'object' || !item.id) {continue;}
      const type = normalizeCreatedType(item.type);
      if (!['page', 'dashboard', 'report'].includes(type)) {continue;}
      push(type, item.url || `${baseUrl}/${appType}/workbench/${item.id}`);
    }
  }
  return out;
}

function mergeGenerationTargets(result, targets = []) {
  const merged = [];
  const seen = new Set();
  for (const target of [...(result.targets || []), ...(Array.isArray(targets) ? targets : [])]) {
    if (!target || !target.url || seen.has(target.url)) {continue;}
    seen.add(target.url);
    merged.push(target);
  }
  result.targets = merged;
  result.ok = result.ok || merged.length > 0;
  return result;
}

function resolveEvidenceCollector(scenario = {}, collector) {
  if (typeof collector === 'function') {return collector;}
  if (scenario.readback && scenario.readback.enabled === true) {
    return collectOpenYidaReadback;
  }
  return null;
}

function collectGenerationBeforeEvidence(scenario, collector) {
  if (scenario.expectedSchemaDiff === undefined || typeof collector !== 'function') {return {};}
  return runEvidenceCollector(collector, {
    phase: 'before', scenario, result: { appType: scenario.readback && scenario.readback.appType }, agentResult: null,
  });
}

/**
 * 解析 agent 运行结果 → 结构化生成产物。
 * @param {object|string} agentResult runAgent 的返回对象，或直接传一段文本（便于测试）
 * @returns {{ok:boolean, appType:string|null, appUrl:string|null, targets:Array, summary:string|null, evidence:object, raw:string|null}}
 */
function parseGenerationResult(agentResult) {
  const text = typeof agentResult === 'string'
    ? agentResult
    : (agentResult && (agentResult.text || agentResult.raw)) || '';

  // 1) 优先取哨兵之后的内容
  let scope = text;
  const idx = text.lastIndexOf(RESULT_SENTINEL);
  if (idx !== -1) {scope = text.slice(idx + RESULT_SENTINEL.length);}

  // 2) 哨兵作用域里找围栏 JSON / 任意 JSON
  let resultObj = extractJsonObject(scope);
  if (!looksLikeGenerationResult(resultObj)) {
    // 3) 回退：全文里取最后一个「像生成结果」的 JSON 对象
    const all = extractAllJsonObjects(text).filter(looksLikeGenerationResult);
    resultObj = all.length ? all[all.length - 1] : (resultObj || null);
  }

  if (!resultObj) {
    const appTypeMatch = text.match(/\bAPP_[A-Z0-9]+\b/);
    return {
      ok: false,
      appType: appTypeMatch ? appTypeMatch[0] : null,
      appUrl: null,
      targets: [],
      summary: null,
      evidence: {},
      raw: text || null,
    };
  }

  const targets = normalizeTargets(resultObj);
  return {
    ok: targets.length > 0 || !!resultObj.appUrl,
    appType: resultObj.appType || null,
    appUrl: resultObj.appUrl || null,
    targets,
    summary: resultObj.summary || null,
    evidence: normalizeReportedEvidence(resultObj),
    raw: text || null,
  };
}

/**
 * 校验产物是否满足 scenario 期望特征。
 * 支持的 expectedFeatures 字段（全部可选）：
 *   - appType:   string，子串不区分大小写匹配 result.appType
 *   - minTargets: number，targets 数量下限
 *   - targetTypes: string[]，这些 type 必须出现在 targets 里
 *   - keywords:  string[]，这些子串必须出现在 summary 或 raw 中
 * @returns {{pass:boolean, checks:Array<{name:string, ok:boolean, detail:string}>}}
 */
function checkExpectedFeatures(result = {}, expected = {}) {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail || '' });

  if (expected.appType) {
    const got = String(result.appType || '');
    const ok = got.toLowerCase().includes(String(expected.appType).toLowerCase());
    add('appType', ok, `期望含「${expected.appType}」，实际「${got || '空'}」`);
  }
  if (typeof expected.minTargets === 'number') {
    const n = (result.targets || []).length;
    add('minTargets', n >= expected.minTargets, `期望 ≥${expected.minTargets}，实际 ${n}`);
  }
  if (Array.isArray(expected.targetTypes) && expected.targetTypes.length) {
    const types = new Set((result.targets || []).map((t) => t.type));
    for (const want of expected.targetTypes) {
      add(`targetType:${want}`, types.has(want), `targets 中${types.has(want) ? '含' : '缺'}「${want}」`);
    }
  }
  if (Array.isArray(expected.keywords) && expected.keywords.length) {
    const hay = `${result.summary || ''}\n${result.raw || ''}`.toLowerCase();
    for (const kw of expected.keywords) {
      const ok = hay.includes(String(kw).toLowerCase());
      add(`keyword:${kw}`, ok, ok ? '命中' : '未命中');
    }
  }

  const pass = checks.length === 0 ? result.ok : checks.every((c) => c.ok);
  return { pass: !!pass, checks };
}

/**
 * 真实生成 agent 运行器：用当前 agent（claude / qodercli）开放工具执行权限，cwd 指向仓库根。
 * 单测里会用注入的假运行器替换它，永远不会真的执行。
 */
function defaultGenerationAgent(options = {}) {
  const command = options.command || resolveAgentCommand();
  const adapter = getAgentAdapter(command);
  const extraArgs = [
    ...adapter.permissionBypass,
    ...adapter.allowedTools(['Bash', 'Read', 'Write']),
    '--add-dir', ROOT,
  ];
  const trace = options.trace === false
    ? { env: process.env, read: () => [], cleanup: () => {}, available: false }
    : createCommandTraceSession({ env: process.env });
  try {
    const result = runAgent({
      prompt: options.prompt,
      command,
      cwd: ROOT,
      env: trace.env,
      timeoutMs: options.timeoutMs || 600000,
      extraArgs,
    });
    return { ...result, commandTrace: trace.read(), commandTraceAvailable: trace.available };
  } finally {
    trace.cleanup();
  }
}

/**
 * 评测单条生成 scenario。
 */
function evaluateGenerationScenario(options = {}) {
  const { scenario, skillContext } = options;
  const agent = options.runGenerationAgent || defaultGenerationAgent;
  const collector = resolveEvidenceCollector(scenario, options.collectEvidence);
  const beforeEvidence = collectGenerationBeforeEvidence(scenario, collector);

  if (scenario.auditOnly === true) {
    const result = {
      ok: true,
      appType: scenario.readback && scenario.readback.appType || null,
      appUrl: null,
      targets: [],
      summary: 'deterministic platform audit',
      evidence: {},
      raw: null,
    };
    const afterEvidence = runEvidenceCollector(collector, {
      phase: 'after', scenario, result, agentResult: null,
    });
    mergeGenerationTargets(result, afterEvidence.targets);
    result.ok = result.ok && (result.targets.length > 0 || (afterEvidence.resources || []).length > 0);
    const features = checkExpectedFeatures(result, scenario.expectedFeatures || {});
    const evidence = buildGenerationEvidence({
      scenario, result, agentResult: { commandTrace: [] },
      extraEvidence: mergeEvidence(beforeEvidence, afterEvidence),
    });
    const evidenceChecks = evaluateGenerationEvidence(scenario, evidence);
    let status = 'ok';
    if (!result.ok) {status = 'no-output';}
    else if (!features.pass) {status = 'feature-miss';}
    else if (!evidenceChecks.pass) {status = 'evidence-miss';}
    const outcome = {
      id: scenario.id,
      status,
      prompt: scenario.prompt,
      appType: result.appType,
      appUrl: result.appUrl,
      summary: result.summary,
      targets: result.targets,
      features,
      evidence,
      evidenceChecks,
      result,
      auditOnly: true,
    };
    outcome.optimizationFindings = deriveOptimizationFindings({
      scenario, evidence, evidenceChecks, features, status,
    });
    return outcome;
  }

  const prompt = buildGenerationPrompt({ request: scenario.prompt, skillContext });
  const res = agent({ prompt, timeoutMs: options.timeoutMs });

  if (res && res.available === false) {
    const outcome = {
      id: scenario.id,
      status: 'agent-unavailable',
      prompt: scenario.prompt,
      result: null,
      features: null,
      targets: [],
    };
    outcome.optimizationFindings = deriveOptimizationFindings({
      scenario, status: outcome.status,
    });
    return outcome;
  }
  if (res && res.ok === false && !(res.text || res.raw)) {
    const emptyResult = parseGenerationResult(res);
    const afterEvidence = runEvidenceCollector(collector, {
      phase: 'after',
      scenario, result: emptyResult, agentResult: res,
    });
    const extraEvidence = mergeEvidence(beforeEvidence, afterEvidence);
    const evidence = buildGenerationEvidence({
      scenario, result: emptyResult, agentResult: res, extraEvidence,
    });
    const evidenceChecks = evaluateGenerationEvidence(scenario, evidence);
    const outcome = {
      id: scenario.id,
      status: 'agent-error',
      prompt: scenario.prompt,
      error: res.error || null,
      result: emptyResult,
      features: null,
      evidence,
      evidenceChecks,
      targets: [],
    };
    outcome.optimizationFindings = deriveOptimizationFindings({
      scenario, evidence, evidenceChecks, status: outcome.status, error: outcome.error,
    });
    return outcome;
  }

  const result = parseGenerationResult(res);
  const afterEvidence = runEvidenceCollector(collector, { phase: 'after', scenario, result, agentResult: res });
  const extraEvidence = mergeEvidence(beforeEvidence, afterEvidence);
  mergeGenerationTargets(result, extraEvidence.targets);
  const features = checkExpectedFeatures(result, scenario.expectedFeatures || {});
  const evidence = buildGenerationEvidence({ scenario, result, agentResult: res, extraEvidence });
  const evidenceChecks = evaluateGenerationEvidence(scenario, evidence);
  let status = 'ok';
  if (!result.ok) {status = 'no-output';}
  else if (!features.pass) {status = 'feature-miss';}
  else if (!evidenceChecks.pass) {status = 'evidence-miss';}

  const outcome = {
    id: scenario.id,
    status,
    prompt: scenario.prompt,
    appType: result.appType,
    appUrl: result.appUrl,
    summary: result.summary,
    targets: result.targets,
    features,
    evidence,
    evidenceChecks,
    result,
  };
  outcome.optimizationFindings = deriveOptimizationFindings({
    scenario, evidence, evidenceChecks, features, status,
  });
  return outcome;
}

/**
 * 汇总生成测评结果。
 */
function summarizeGeneration(results = []) {
  const produced = results.filter((r) => r.targets && r.targets.length);
  const passed = results.filter((r) => r.status === 'ok');
  const optimizationFindings = results.flatMap((result) => result.optimizationFindings || []);
  return {
    total: results.length,
    produced: produced.length,
    passed: passed.length,
    featureMiss: results.filter((r) => r.status === 'feature-miss').length,
    evidenceMiss: results.filter((r) => r.status === 'evidence-miss').length,
    noOutput: results.filter((r) => r.status === 'no-output').length,
    agentError: results.filter((r) => r.status === 'agent-error').length,
    agentUnavailable: results.filter((r) => r.status === 'agent-unavailable').length,
    optimizationFindings: optimizationFindings.length,
    passRate: results.length ? +(passed.length / results.length).toFixed(4) : null,
  };
}

/**
 * 跑整套生成测评（仅编排；截图/打分由 runner 在外层复用现有链路）。
 */
function runGenerationEval(options = {}) {
  const scenarios = options.scenarios || loadGenerationScenarios(options.scenarioPath);
  const skillContext = options.skillContext !== undefined
    ? options.skillContext
    : loadSkillContext(options.skillMdPath);

  const results = scenarios.map((scenario) => evaluateGenerationScenario({
    scenario,
    skillContext,
    runGenerationAgent: options.runGenerationAgent,
    collectEvidence: options.collectEvidence,
    timeoutMs: options.timeoutMs,
  }));

  return { summary: summarizeGeneration(results), results };
}

module.exports = {
  RESULT_SENTINEL,
  loadSkillContext,
  loadGenerationScenarios,
  buildGenerationPrompt,
  extractAllJsonObjects,
  looksLikeGenerationResult,
  normalizeCreatedType,
  normalizeReportedEvidence,
  normalizeTargets,
  mergeGenerationTargets,
  resolveEvidenceCollector,
  collectGenerationBeforeEvidence,
  parseGenerationResult,
  checkExpectedFeatures,
  defaultGenerationAgent,
  evaluateGenerationScenario,
  summarizeGeneration,
  runGenerationEval,
};


// ---------------------------------------------------------------------------
// Parallel generation evaluation (async entry)
// ---------------------------------------------------------------------------

/**
 * Async generation evaluation with parallelism.
 *
 * @param {object} options — same as runGenerationEval, plus:
 * @param {number} [options.concurrency=2] — max parallel agent processes
 * @param {function} [options.onProgress] — callback(completed, total)
 * @returns {Promise<{summary, results, stats?}>}
 */
async function runGenerationEvalAsync(options = {}) {
  let parallel;
  try { parallel = require('./parallel'); } catch (_e) { parallel = null; }

  // Fallback to serial
  if (!parallel) {
    return runGenerationEval(options);
  }

  const scenarios = options.scenarios || loadGenerationScenarios(options.scenarioPath);
  const skillContext = options.skillContext !== undefined
    ? options.skillContext
    : loadSkillContext(options.skillMdPath);

  const { resolveAgentCommand } = require('./agent');
  const agentCommand = options.agentCommand || resolveAgentCommand();

  const { results, stats } = await parallel.runParallelGeneration({
    scenarios,
    skillContext,
    agentCommand,
    concurrency: options.concurrency || 2,
    timeoutMs: options.timeoutMs || 600000,
    onProgress: options.onProgress,
    collectEvidence: options.collectEvidence,
  });

  return {
    summary: summarizeGeneration(results),
    results,
    stats,
  };
}

module.exports.runGenerationEvalAsync = runGenerationEvalAsync;
