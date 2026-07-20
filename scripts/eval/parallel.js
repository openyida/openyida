'use strict';

/**
 * OpenYida Eval — 并行执行引擎 + 批量路由 + 结果缓存。
 *
 * 优化策略:
 *   1. 批量路由: 多条 scenario 合并为一次 agent 调用 (N-in-1)
 *   2. 并行执行: async spawn 并发池 (默认 concurrency=4)
 *   3. 结果缓存: sha256(routingContext + prompt) → 缓存命中时跳过调用
 *   4. 早退机制: 首条发现 agent 不可用即跳过剩余全部
 *   5. 增量评测: 仅对变更的 scenario 重新评测
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

// Pre-load extractJsonObject at module scope to avoid require-after-teardown in tests
let _extractJsonObject;
try { _extractJsonObject = require('./agent').extractJsonObject; } catch (_e) { _extractJsonObject = null; }
function extractJsonObjectSafe(text) {
  if (_extractJsonObject) { return _extractJsonObject(text); }
  // Minimal fallback: try JSON.parse on first { ... } block
  if (!text) { return null; }
  const start = text.indexOf('{');
  if (start === -1) { return null; }
  try { return JSON.parse(text.slice(start)); } catch (_e2) { return null; }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..', '..');
const CACHE_DIR = path.join(ROOT, 'project', '.cache', 'eval', 'route-cache');
const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_TIMEOUT_MS = 120000;

// ---------------------------------------------------------------------------
// Cache layer
// ---------------------------------------------------------------------------

/**
 * Compute cache key for a routing evaluation.
 * @param {string} routingContext — full SKILL.md text
 * @param {string} prompt — scenario prompt text
 * @returns {string} hex hash
 */
function cacheKey(routingContext, prompt) {
  const hash = crypto.createHash('sha256');
  hash.update(routingContext || '');
  hash.update('\x00');
  hash.update(prompt || '');
  return hash.digest('hex').slice(0, 16);
}

/**
 * Try to load a cached result.
 * @param {string} key
 * @returns {object|null}
 */
function loadCached(key) {
  const filePath = path.join(CACHE_DIR, key + '.json');
  try {
    if (!fs.existsSync(filePath)) { return null; }
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    // Cache entries expire after 24 hours
    if (data._ts && (Date.now() - data._ts) > 86400000) {
      return null;
    }
    return data;
  } catch (_e) {
    return null;
  }
}

/**
 * Save a result to cache.
 * @param {string} key
 * @param {object} result
 */
function saveToCache(key, result) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const data = Object.assign({}, result, { _ts: Date.now() });
    fs.writeFileSync(
      path.join(CACHE_DIR, key + '.json'),
      JSON.stringify(data) + '\n',
      'utf8'
    );
  } catch (_e) {
    // cache write failure is non-fatal
  }
}

/**
 * Clear the route cache.
 */
function clearCache() {
  try {
    if (fs.existsSync(CACHE_DIR)) {
      const files = fs.readdirSync(CACHE_DIR);
      for (let i = 0; i < files.length; i++) {
        fs.unlinkSync(path.join(CACHE_DIR, files[i]));
      }
    }
  } catch (_e) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Batch routing prompt builder
// ---------------------------------------------------------------------------

/**
 * Build a batch routing prompt that evaluates multiple scenarios in one call.
 *
 * @param {object} options
 * @param {Array<{id: string, prompt: string}>} options.scenarios
 * @param {string} options.routingContext — SKILL.md content
 * @param {string[]} options.skillNames
 * @returns {string}
 */
function buildBatchRoutingPrompt(options) {
  const scenarios = options.scenarios || [];
  const routingContext = options.routingContext || '';
  const skillNames = options.skillNames || [];

  const lines = [
    '下面是宜搭 AI 应用开发技能（openyida）的路由说明文档。',
    '请严格依据它，对下面每条用户请求分别判断应当选择哪一个子技能来处理。',
    '',
    '=== 路由说明文档开始 ===',
    routingContext,
    '=== 路由说明文档结束 ===',
    '',
    '可选子技能名（必须从中精确选一个）：',
    skillNames.join(', '),
    '',
    '下面有 ' + scenarios.length + ' 条独立的用户请求，请对每条分别给出判断。',
    '输出一个 JSON 数组，每个元素对应一条请求，形如：',
    '[',
    '  {"id": "请求ID", "skill": "选中的子技能", "mode": "模式(如适用)", "reason": "一句话理由"},',
    '  ...',
    ']',
    '',
    '要求：',
    '- 每个 id 必须与下面列出的请求 ID 完全一致',
    '- skill 必须是上面可选子技能名之一',
    '- 只有完整应用搭建才填 mode；默认方案/不要追问/直接创建必须是 fast_build',
    '',
    '=== 用户请求列表 ===',
  ];

  for (let i = 0; i < scenarios.length; i++) {
    lines.push('');
    lines.push('【请求 ' + (i + 1) + '】');
    lines.push('ID: ' + scenarios[i].id);
    lines.push('用户说: 「' + scenarios[i].prompt + '」');
  }

  lines.push('');
  lines.push('请输出包含 ' + scenarios.length + ' 个元素的 JSON 数组。');

  return lines.join('\n');
}

/**
 * Parse batch routing response — extract JSON array from agent output.
 * @param {string} text
 * @returns {Array<{id: string, skill: string, mode?: string, reason?: string}>}
 */
function parseBatchRoutingResponse(text) {
  if (!text || typeof text !== 'string') { return []; }

  // Try to extract JSON array from fenced code block first
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [];
  if (fenced) { candidates.push(fenced[1].trim()); }
  candidates.push(text);

  for (let ci = 0; ci < candidates.length; ci++) {
    const candidate = candidates[ci];
    // Find first [ ... ] block
    const start = candidate.indexOf('[');
    if (start === -1) { continue; }
    let depth = 0;
    for (let i = start; i < candidate.length; i++) {
      if (candidate[i] === '[') { depth++; }
      else if (candidate[i] === ']') {
        depth--;
        if (depth === 0) {
          const slice = candidate.slice(start, i + 1);
          try {
            const arr = JSON.parse(slice);
            if (Array.isArray(arr)) { return arr; }
          } catch (_e) { break; }
        }
      }
    }
  }

  // Fallback: try to parse individual JSON objects
  const results = [];
  const objRegex = /\{[^{}]*"id"\s*:\s*"[^"]*"[^{}]*"skill"\s*:\s*"[^"]*"[^{}]*\}/g;
  let match;
  while ((match = objRegex.exec(text)) !== null) {
    try {
      results.push(JSON.parse(match[0]));
    } catch (_e) { /* skip */ }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Async agent execution
// ---------------------------------------------------------------------------

/**
 * Run agent asynchronously (non-blocking spawn).
 *
 * @param {object} options
 * @param {string} options.command — agent CLI command
 * @param {string} options.prompt — prompt text
 * @param {number} [options.timeoutMs=120000]
 * @param {string} [options.cwd]
 * @param {string[]} [options.extraArgs]
 * @returns {Promise<{available: boolean, ok: boolean, text: string|null, json: object|null, error: string|null}>}
 */
function runAgentAsync(options) {
  const command = options.command || 'claude';
  const timeout = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const prompt = options.prompt || '';
  const extraArgs = options.extraArgs || [];

  return new Promise(function (resolve) {
    const args = ['-p', prompt, '--output-format', 'json'].concat(extraArgs);
    let child;

    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      resolve({ available: false, ok: false, text: null, json: null, error: e.message });
      return;
    }

    let stdout = '';
    let stderr = '';
    let killed = false;
    let settled = false;

    const timer = setTimeout(function () {
      killed = true;
      child.kill('SIGTERM');
    }, timeout);
    if (typeof timer.unref === 'function') {
      timer.unref();
    }

    function finish(result) {
      if (settled) { return; }
      settled = true;
      clearTimeout(timer);
      resolve(result);
    }

    child.stdout.on('data', function (chunk) { stdout += chunk.toString(); });
    child.stderr.on('data', function (chunk) { stderr += chunk.toString(); });

    child.on('error', function (e) {
      const missing = e.code === 'ENOENT';
      finish({ available: !missing, ok: false, text: null, json: null, error: e.message });
    });

    child.on('close', function (code) {
      if (killed) {
        finish({ available: true, ok: false, text: null, json: null, error: 'timeout after ' + timeout + 'ms' });
        return;
      }

      // Parse envelope
      let text = stdout;
      const envelope = extractJsonObjectSafe(stdout);
      if (envelope && typeof envelope.result === 'string') {
        text = envelope.result;
      }
      if (envelope && envelope.is_error) {
        finish({ available: true, ok: false, text: text, json: null, error: 'agent-error: ' + (text || 'unknown') });
        return;
      }

      const json = extractJsonObjectSafe(text);
      finish({
        available: true,
        ok: code === 0,
        text: text,
        json: json,
        error: code === 0 ? null : (stderr || 'exit ' + code),
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Concurrency pool
// ---------------------------------------------------------------------------

/**
 * Run tasks with limited concurrency.
 *
 * @param {Array<function():Promise>} tasks — array of async functions
 * @param {number} concurrency — max parallel tasks
 * @returns {Promise<Array>} results in original order
 */
function runWithConcurrency(tasks, concurrency) {
  concurrency = concurrency || DEFAULT_CONCURRENCY;
  const results = new Array(tasks.length);
  let cursor = 0;

  function next() {
    const idx = cursor++;
    if (idx >= tasks.length) { return Promise.resolve(); }
    return tasks[idx]().then(function (result) {
      results[idx] = result;
      return next();
    });
  }

  const workers = [];
  for (let i = 0; i < Math.min(concurrency, tasks.length); i++) {
    workers.push(next());
  }

  return Promise.all(workers).then(function () { return results; });
}

// ---------------------------------------------------------------------------
// Parallel routing evaluation
// ---------------------------------------------------------------------------

/**
 * Run routing evaluation with parallelism and batching.
 *
 * @param {object} options
 * @param {Array} options.scenarios — routing scenarios
 * @param {string} options.routingContext — SKILL.md content
 * @param {string[]} options.skillNames
 * @param {string} [options.agentCommand='claude']
 * @param {number} [options.batchSize=5] — scenarios per batch prompt
 * @param {number} [options.concurrency=4] — parallel agent processes
 * @param {number} [options.timeoutMs=120000]
 * @param {boolean} [options.useCache=true]
 * @param {function} [options.onProgress] — callback(completed, total)
 * @returns {Promise<{results: Array, stats: object}>}
 */
function runParallelRouting(options) {
  const scenarios = options.scenarios || [];
  const routingContext = options.routingContext || '';
  const skillNames = options.skillNames || [];
  const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
  const concurrency = options.concurrency || DEFAULT_CONCURRENCY;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const useCache = options.useCache !== false;
  const agentCommand = options.agentCommand || 'claude';
  const onProgress = options.onProgress || function () {};
  const normalizeSkill = require('./routing').normalizeSkill;

  // Phase 1: Check cache, separate cached vs uncached
  const cached = [];
  const uncached = [];

  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    const key = cacheKey(routingContext, s.prompt);
    const hit = useCache ? loadCached(key) : null;
    if (hit && hit.status === 'ok') {
      cached.push({ index: i, scenario: s, result: hit, fromCache: true });
    } else {
      uncached.push({ index: i, scenario: s, key: key });
    }
  }

  const stats = {
    total: scenarios.length,
    cached: cached.length,
    batches: 0,
    agentCalls: 0,
    savedCalls: cached.length,
    startTime: Date.now(),
    endTime: 0,
  };

  if (uncached.length === 0) {
    // All cached — return immediately
    const allResults = new Array(scenarios.length);
    for (let ci = 0; ci < cached.length; ci++) {
      const cr = cached[ci];
      allResults[cr.index] = Object.assign({}, cr.result, { _cached: true });
    }
    stats.endTime = Date.now();
    onProgress(scenarios.length, scenarios.length);
    return Promise.resolve({ results: allResults, stats: stats });
  }

  // Phase 2: Split uncached into batches
  const batches = [];
  for (let bi = 0; bi < uncached.length; bi += batchSize) {
    batches.push(uncached.slice(bi, bi + batchSize));
  }
  stats.batches = batches.length;
  stats.agentCalls = batches.length;

  let completed = cached.length;
  let agentUnavailable = false;

  // Phase 3: Create tasks for each batch
  const batchDurations = [];
  const tasks = batches.map(function (batch) {
    const runBatch = function () {
      // Early bail if agent already known unavailable
      if (agentUnavailable) {
        const batchResults = [];
        for (let ei = 0; ei < batch.length; ei++) {
          batchResults.push({
            id: batch[ei].scenario.id,
            expected: batch[ei].scenario.expectedSkill,
            actual: null,
            hit: null,
            status: 'agent-unavailable',
          });
        }
        completed += batch.length;
        onProgress(completed, scenarios.length);
        return Promise.resolve(batchResults);
      }

      // Build batch prompt
      const batchScenarios = batch.map(function (item) {
        return { id: item.scenario.id, prompt: item.scenario.prompt };
      });

      let prompt;
      if (batch.length === 1) {
        // Single scenario — use original prompt format for best accuracy
        const routing = require('./routing');
        prompt = routing.buildRoutingPrompt({
          request: batch[0].scenario.prompt,
          routingContext: routingContext,
          skillNames: skillNames,
        });
      } else {
        prompt = buildBatchRoutingPrompt({
          scenarios: batchScenarios,
          routingContext: routingContext,
          skillNames: skillNames,
        });
      }

      return runAgentAsync({
        command: agentCommand,
        prompt: prompt,
        timeoutMs: timeoutMs,
      }).then(function (res) {
        if (!res.available) {
          agentUnavailable = true;
          const unavailResults = [];
          for (let ui = 0; ui < batch.length; ui++) {
            unavailResults.push({
              id: batch[ui].scenario.id,
              expected: batch[ui].scenario.expectedSkill,
              actual: null,
              hit: null,
              status: 'agent-unavailable',
            });
          }
          completed += batch.length;
          onProgress(completed, scenarios.length);
          return unavailResults;
        }

        // agent 调用失败（未登录/配额/API 错误）：runAgentAsync 对 is_error 信封会回传
        // error='agent-error: ...'，但此时 res.text 为错误信封原文（非空），不能靠 !res.text 判定。
        const isAgentError = (res.error && /^agent-error/i.test(res.error))
          || (!res.ok && !res.json && !res.text);
        if (isAgentError) {
          const errResults = [];
          for (let eri = 0; eri < batch.length; eri++) {
            errResults.push({
              id: batch[eri].scenario.id,
              expected: batch[eri].scenario.expectedSkill,
              actual: null,
              hit: null,
              status: 'agent-error',
              error: res.error || null,
              raw: res.text ? res.text.slice(0, 300) : undefined,
            });
          }
          completed += batch.length;
          onProgress(completed, scenarios.length);
          return errResults;
        }

        // Parse results
        let parsedResults;
        if (batch.length === 1) {
          // Single scenario — parse as single JSON object
          const actual = res.json && res.json.skill ? res.json.skill : null;
          const scenario = batch[0].scenario;
          const skillHit = actual !== null
            && normalizeSkill(actual) === normalizeSkill(scenario.expectedSkill);
          const result = {
            id: scenario.id,
            expected: scenario.expectedSkill,
            actual: actual,
            hit: skillHit,
            reason: res.json ? res.json.reason : null,
            status: actual === null ? 'unparsed' : 'ok',
            raw: actual === null && res.text ? res.text.slice(0, 300) : undefined,
          };
          if (useCache && result.status === 'ok') {
            saveToCache(batch[0].key, result);
          }
          parsedResults = [result];
        } else {
          // Batch — parse JSON array
          const batchParsed = parseBatchRoutingResponse(res.text || '');
          const resultMap = {};
          for (let pi = 0; pi < batchParsed.length; pi++) {
            if (batchParsed[pi].id) {
              resultMap[batchParsed[pi].id] = batchParsed[pi];
            }
          }

          parsedResults = [];
          for (let ri = 0; ri < batch.length; ri++) {
            const sc = batch[ri].scenario;
            // 优先按 id 精确匹配；若模型未原样回传 id 且数量与本批一致，回退按顺序匹配。
            let matched = resultMap[sc.id] || null;
            if (!matched && batchParsed.length === batch.length) {
              matched = batchParsed[ri] || null;
            }
            const actualSkill = matched ? matched.skill : null;
            const isHit = actualSkill !== null
              && normalizeSkill(actualSkill) === normalizeSkill(sc.expectedSkill);
            const singleResult = {
              id: sc.id,
              expected: sc.expectedSkill,
              actual: actualSkill,
              actualMode: matched ? matched.mode : null,
              hit: isHit,
              reason: matched ? matched.reason : null,
              status: actualSkill === null ? 'unparsed' : 'ok',
              raw: actualSkill === null && res.text ? res.text.slice(0, 300) : undefined,
            };
            if (useCache && singleResult.status === 'ok') {
              saveToCache(batch[ri].key, singleResult);
            }
            parsedResults.push(singleResult);
          }
        }

        completed += batch.length;
        onProgress(completed, scenarios.length);
        return parsedResults;
      });
    };
    return function () {
      const _start = Date.now();
      return Promise.resolve().then(runBatch).then(function (r) {
        batchDurations.push(Date.now() - _start);
        return r;
      });
    };
  });

  // Phase 4: Execute with concurrency pool
  return runWithConcurrency(tasks, concurrency).then(function (batchResults) {
    // Merge cached + fresh results in original order
    const allResults = new Array(scenarios.length);
    for (let ci2 = 0; ci2 < cached.length; ci2++) {
      const cr2 = cached[ci2];
      allResults[cr2.index] = Object.assign({}, cr2.result, { _cached: true });
    }

    for (let bi2 = 0; bi2 < batches.length; bi2++) {
      const batch2 = batches[bi2];
      const batchRes = batchResults[bi2] || [];
      for (let ri2 = 0; ri2 < batch2.length; ri2++) {
        allResults[batch2[ri2].index] = batchRes[ri2] || {
          id: batch2[ri2].scenario.id,
          expected: batch2[ri2].scenario.expectedSkill,
          actual: null,
          hit: null,
          status: 'unparsed',
        };
      }
    }

    stats.endTime = Date.now();
    if (batchDurations.length) {
      const _sum = batchDurations.reduce(function (a, b) { return a + b; }, 0);
      stats.avgBatchMs = Math.round(_sum / batchDurations.length);
      stats.maxBatchMs = Math.max.apply(null, batchDurations);
      stats.batchDurations = batchDurations;
    }
    return { results: allResults, stats: stats };
  });
}

// ---------------------------------------------------------------------------
// Parallel generation evaluation
// ---------------------------------------------------------------------------

/**
 * Run generation evaluation with parallelism.
 *
 * @param {object} options
 * @param {Array} options.scenarios — generation scenarios
 * @param {string} options.skillContext — SKILL.md content
 * @param {string} [options.agentCommand='claude']
 * @param {number} [options.concurrency=2] — parallel agent processes (lower for gen since heavier)
 * @param {number} [options.timeoutMs=600000]
 * @param {function} [options.onProgress] — callback(completed, total)
 * @returns {Promise<{results: Array, stats: object}>}
 */
function runParallelGeneration(options) {
  const scenarios = options.scenarios || [];
  const skillContext = options.skillContext || '';
  const concurrency = options.concurrency || 2; // Lower default for generation (heavy)
  const timeoutMs = options.timeoutMs || 600000;
  const agentCommand = options.agentCommand || 'claude';
  const onProgress = options.onProgress || function () {};

  let generate;
  try { generate = require('./generate'); } catch (_e) { generate = null; }
  if (!generate) {
    return Promise.resolve({
      results: scenarios.map(function (s) {
        return { id: s.id, status: 'module-unavailable', prompt: s.prompt, targets: [] };
      }),
      stats: { total: scenarios.length, agentCalls: 0 },
    });
  }

  const agentMod = require('./agent');
  const adapter = agentMod.getAgentAdapter(agentCommand);
  let agentUnavailable = false;
  let completed = 0;

  const stats = {
    total: scenarios.length,
    agentCalls: 0,
    startTime: Date.now(),
    endTime: 0,
  };

  const tasks = scenarios.map(function (scenario) {
    return function () {
      if (agentUnavailable) {
        completed++;
        onProgress(completed, scenarios.length);
        return Promise.resolve({
          id: scenario.id,
          status: 'agent-unavailable',
          prompt: scenario.prompt,
          targets: [],
        });
      }

      const prompt = generate.buildGenerationPrompt({
        request: scenario.prompt,
        skillContext: skillContext,
      });

      const extraArgs = [].concat(
        adapter.permissionBypass,
        adapter.allowedTools(['Bash', 'Read', 'Write']),
        ['--add-dir', ROOT]
      );

      stats.agentCalls++;

      return runAgentAsync({
        command: agentCommand,
        prompt: prompt,
        timeoutMs: timeoutMs,
        cwd: ROOT,
        extraArgs: extraArgs,
      }).then(function (res) {
        completed++;
        onProgress(completed, scenarios.length);

        if (!res.available) {
          agentUnavailable = true;
          return { id: scenario.id, status: 'agent-unavailable', prompt: scenario.prompt, targets: [] };
        }
        if (!res.ok && !(res.text)) {
          return {
            id: scenario.id, status: 'agent-error', prompt: scenario.prompt,
            error: res.error, targets: [],
          };
        }

        const result = generate.parseGenerationResult(res);
        const features = generate.checkExpectedFeatures(result, scenario.expectedFeatures || {});
        let status = 'ok';
        if (!result.ok) { status = 'no-output'; }
        else if (!features.pass) { status = 'feature-miss'; }

        return {
          id: scenario.id,
          status: status,
          prompt: scenario.prompt,
          appType: result.appType,
          appUrl: result.appUrl,
          summary: result.summary,
          targets: result.targets,
          features: features,
          result: result,
        };
      });
    };
  });

  return runWithConcurrency(tasks, concurrency).then(function (results) {
    stats.endTime = Date.now();
    return { results: results, stats: stats };
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Cache
  cacheKey: cacheKey,
  loadCached: loadCached,
  saveToCache: saveToCache,
  clearCache: clearCache,
  CACHE_DIR: CACHE_DIR,

  // Batch routing
  buildBatchRoutingPrompt: buildBatchRoutingPrompt,
  parseBatchRoutingResponse: parseBatchRoutingResponse,
  DEFAULT_BATCH_SIZE: DEFAULT_BATCH_SIZE,
  DEFAULT_CONCURRENCY: DEFAULT_CONCURRENCY,

  // Async agent
  runAgentAsync: runAgentAsync,
  runWithConcurrency: runWithConcurrency,

  // Parallel evaluators
  runParallelRouting: runParallelRouting,
  runParallelGeneration: runParallelGeneration,
};
