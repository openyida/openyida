'use strict';

/**
 * OpenYida Skill Eval Pipeline — 全自动闭环流水线。
 *
 * 写 Skill → 静态校验 → 路由测试 → 生成评测 → 多维评分 → Gate 判定 → 自动优化
 *
 * 每一步骤有明确的入口/出口和失败策略：
 *   - 前置步骤失败时后续步骤标注 skipped，但不中断整个 pipeline
 *   - Gate 失败时生成自动优化建议（suggestions），可选 auto-fix
 *   - 产物统一写入 project/.cache/eval/pipeline/<run-id>/
 *
 * 用法：
 *   node scripts/eval/pipeline.js --skill yida-dashboard [--fix] [--format junit]
 */

const fs = require('fs');
const path = require('path');

// Peer modules — defensive imports
let docQuality;
try { docQuality = require('./doc-quality'); } catch (_e) { docQuality = null; }

let routingMod;
try { routingMod = require('./routing'); } catch (_e) { routingMod = null; }

let safetyMod;
try { safetyMod = require('./safety'); } catch (_e) { safetyMod = null; }

let coverageMod;
try { coverageMod = require('./coverage'); } catch (_e) { coverageMod = null; }

let comprehensiveMod;
try { comprehensiveMod = require('./comprehensive'); } catch (_e) { comprehensiveMod = null; }

let junitMod;
try { junitMod = require('./junit'); } catch (_e) { junitMod = null; }

let historyMod;
try { historyMod = require('./history'); } catch (_e) { historyMod = null; }

const ROOT = path.resolve(__dirname, '..', '..');
const EVAL_OUT_DIR = path.join(ROOT, 'project', '.cache', 'eval');
const PIPELINE_DIR = path.join(EVAL_OUT_DIR, 'pipeline');

// ---------------------------------------------------------------------------
// Pipeline step status
// ---------------------------------------------------------------------------

const STEP_PASS = 'pass';
const STEP_FAIL = 'fail';
const STEP_SKIP = 'skip';
const STEP_WARN = 'warn';

// ---------------------------------------------------------------------------
// Optimization suggestion generator
// ---------------------------------------------------------------------------

/** DIMENSION_LABELS maps internal keys to human-readable Chinese labels. */
const DIMENSION_LABELS = {
  standards: '文档规范性',
  maintainability: '可维护性',
  routingAccuracy: '路由准确率',
  generationQuality: '生成质量',
  safety: '安全合规',
  efficiency: '执行效率',
  stability: '稳定性',
  coverage: '覆盖度',
  stepCompleteness: '步骤完成率',
  outputValidity: '输出有效性',
  knowledgeDelta: '知识增量',
};

/** HARD_GATE_LABELS maps gate keys to Chinese labels and thresholds. */
const HARD_GATE_LABELS = {
  triggerAccuracy: { label: '触发准确率', threshold: '≥ 85%' },
  stepCompletionRate: { label: '步骤完成率', threshold: '= 100%' },
  functionalTestRate: { label: '功能测试通过率', threshold: '≥ 95%' },
  outputFormatRate: { label: '输出格式正确率', threshold: '≥ 85%' },
  safetyFailures: { label: '安全合规', threshold: '= 0 failures' },
};

/**
 * Generate optimization suggestions based on scorecard results.
 *
 * @param {object} scorecard — from comprehensive eval
 * @param {object} stepResults — pipeline step outcomes
 * @returns {Array<{dimension: string, label: string, score: number|null, priority: string, suggestions: string[]}>}
 */
function generateSuggestions(scorecard, stepResults) {
  if (!scorecard || !scorecard.dimensions) { return []; }

  const suggestions = [];

  // Collect failing/low dimensions sorted by score ascending (worst first)
  const dims = Object.keys(scorecard.dimensions);
  const ranked = [];
  for (let i = 0; i < dims.length; i++) {
    const key = dims[i];
    const dim = scorecard.dimensions[key];
    ranked.push({ key: key, score: dim.score, weight: dim.weight });
  }

  // Sort: null first (not measured), then by score ascending
  ranked.sort(function (a, b) {
    if (a.score === null && b.score === null) { return 0; }
    if (a.score === null) { return -1; }
    if (b.score === null) { return 1; }
    return a.score - b.score;
  });

  for (let j = 0; j < ranked.length; j++) {
    const item = ranked[j];
    const label = DIMENSION_LABELS[item.key] || item.key;
    const sugs = [];
    let priority = 'low';

    if (item.score === null) {
      priority = 'medium';
      sugs.push('该维度未被评测，请确认相关模块已安装且数据源可用');
      continue; // skip further analysis for null scores
    }

    if (item.score < 60) {
      priority = 'critical';
    } else if (item.score < 80) {
      priority = 'high';
    } else if (item.score < 90) {
      priority = 'medium';
    }

    // Dimension-specific suggestions
    switch (item.key) {
      case 'standards':
        if (item.score < 80) {
          sugs.push('检查 SKILL.md frontmatter 是否包含 name、description、triggers 等必需字段');
          sugs.push('确保至少有一个 ## 触发条件 和 ## 工作流 章节');
          sugs.push('添加 ## WHEN NOT 反向消歧义段，明确技能边界');
        }
        break;
      case 'maintainability':
        if (item.score < 80) {
          sugs.push('减少 SKILL.md 行数（建议 < 200 行），拆分过长段落');
          sugs.push('为代码块添加语言标记（如 ```bash、```json）');
          sugs.push('避免 SKILL.md 中硬编码路径，使用 AGENT_WORK_ROOT 变量');
        }
        break;
      case 'routingAccuracy':
        if (item.score < 85) {
          sugs.push('增加 ## 触发条件 中的同义词/变体表达（如"创建看板"→"做一个 dashboard"）');
          sugs.push('检查 ## WHEN NOT 中是否缺少易混淆技能的消歧义说明');
          sugs.push('在 scripts/eval/scenarios/ 中增加混淆对测试用例');
        }
        break;
      case 'generationQuality':
        if (item.score < 95) {
          sugs.push('检查工作流步骤是否有遗漏（如缺少 "发布" 步骤导致页面不可访问）');
          sugs.push('增加 expectedFeatures 验证项覆盖（appType、targetCount、keywords）');
        }
        break;
      case 'safety':
        if (item.score < 100) {
          sugs.push('确保 SKILL.md 中无硬编码 Cookie/Token/corpId');
          sugs.push('检查命令白名单，确认不调用 curl/wget/rm -rf 等危险命令');
          sugs.push('验证 AGENT_WORK_ROOT 路径无遍历漏洞（../）');
        }
        break;
      case 'efficiency':
        if (item.score < 80) {
          sugs.push('减少重复 API 调用（合并多次 openyida list 为一次）');
          sugs.push('简化 SKILL.md 工作流步骤数（< 10 步）');
        }
        break;
      case 'stability':
        if (item.score < 90) {
          sugs.push('检查路由指令的歧义性——同一 prompt 多次运行应选中同一子技能');
          sugs.push('简化 ## 触发条件 表述，减少模糊的自然语言匹配');
        }
        break;
      case 'coverage':
        if (item.score < 70) {
          sugs.push('在 scripts/eval/scenarios/ 中为缺失覆盖的技能添加测试用例');
          sugs.push('检查分类覆盖——确保每个技能分类至少有一个 scenario');
        }
        break;
      case 'stepCompleteness':
        if (item.score < 100) {
          sugs.push('检查工作流中的必需步骤是否在 Agent 执行中全部出现');
          if (stepResults && stepResults.comprehensive && stepResults.comprehensive.raw) {
            sugs.push('查看 comprehensive report 中的 missing steps 列表');
          }
        }
        break;
      case 'outputValidity':
        if (item.score < 85) {
          sugs.push('确保 Agent 输出包含 JSON 结构化数据（appId、formUuid 等）');
          sugs.push('检查输出中的 URL 格式是否合法');
        }
        break;
    }

    if (sugs.length > 0 || priority !== 'low') {
      suggestions.push({
        dimension: item.key,
        label: label,
        score: item.score,
        priority: priority,
        suggestions: sugs,
      });
    }
  }

  // Add gate-specific suggestions
  if (scorecard.hardGates) {
    const gateKeys = Object.keys(scorecard.hardGates);
    for (let g = 0; g < gateKeys.length; g++) {
      const gk = gateKeys[g];
      if (scorecard.hardGates[gk] === 'fail') {
        const gl = HARD_GATE_LABELS[gk] || { label: gk, threshold: '?' };
        suggestions.unshift({
          dimension: gk,
          label: '🚫 硬门槛不通过：' + gl.label,
          score: null,
          priority: 'blocker',
          suggestions: ['硬门槛 ' + gl.label + '（要求 ' + gl.threshold + '）未通过，必须先修复此项才能准出'],
        });
      }
    }
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// Pipeline steps
// ---------------------------------------------------------------------------

/**
 * Step 1: Static validation — check SKILL.md doc quality.
 */
function stepStaticValidation(skill) {
  const result = { step: 'static-validation', status: STEP_SKIP, score: null, detail: '', raw: null };

  if (!docQuality) {
    result.detail = 'doc-quality 模块不可用';
    return result;
  }

  try {
    const outcome = docQuality.runDocQualityEval({ skill: skill });
    result.raw = outcome;
    if (outcome && outcome.summary) {
      const avg = outcome.summary.avgOverall;
      result.score = avg;
      result.status = avg >= 60 ? STEP_PASS : STEP_FAIL;
      result.detail = '规范性=' + outcome.summary.avgStandards.toFixed(1) +
        ' 可维护性=' + outcome.summary.avgMaintainability.toFixed(1) +
        ' 总分=' + avg.toFixed(1);
    } else {
      result.status = STEP_WARN;
      result.detail = '无评测数据';
    }
  } catch (e) {
    result.status = STEP_FAIL;
    result.detail = e.message;
  }

  return result;
}

/**
 * Step 2: Routing test — check if agent routes to correct sub-skill.
 */
function stepRoutingTest(skill, config) {
  const result = { step: 'routing-test', status: STEP_SKIP, score: null, detail: '', raw: null };

  if (!routingMod) {
    result.detail = 'routing 模块不可用';
    return result;
  }

  try {
    let scenariosDir = (config && config.scenariosDir)
      ? config.scenariosDir
      : path.join(__dirname, 'scenarios');
    if (!path.isAbsolute(scenariosDir)) {
      scenariosDir = path.join(ROOT, scenariosDir);
    }

    const routingOpts = { scenariosDir: scenariosDir };
    if (skill) { routingOpts.skill = skill; }

    const outcome = routingMod.runRoutingEval(routingOpts);
    result.raw = outcome;

    if (outcome && outcome.summary) {
      const acc = outcome.summary.accuracy;
      if (acc !== null && acc !== undefined) {
        result.score = Math.round(acc * 100 * 100) / 100;
        result.status = acc >= 0.85 ? STEP_PASS : STEP_FAIL;
        result.detail = '命中率=' + (acc * 100).toFixed(1) + '%' +
          ' (' + outcome.summary.hits + '/' + outcome.summary.evaluated + ')';
        if (outcome.summary.confusion && outcome.summary.confusion.length > 0) {
          result.detail += ' 混淆对=' + outcome.summary.confusion.length;
        }
      } else {
        result.status = STEP_WARN;
        result.detail = 'agent 不可用或无可评测用例';
      }
    }
  } catch (e) {
    result.status = STEP_FAIL;
    result.detail = e.message;
  }

  return result;
}

/**
 * Step 3: Safety check.
 */
function stepSafetyCheck(config) {
  const result = { step: 'safety-check', status: STEP_SKIP, score: null, detail: '', raw: null };

  if (!safetyMod) {
    result.detail = 'safety 模块不可用';
    return result;
  }

  try {
    const commands = (config && config.commands) || [];
    const output = (config && config.output) || '';
    const outcome = safetyMod.runSafetyEval({ commands: commands, output: output });
    result.raw = outcome;
    result.status = outcome.passed ? STEP_PASS : STEP_FAIL;
    const total = outcome.checks ? outcome.checks.length : 0;
    let fails = 0;
    if (Array.isArray(outcome.checks)) {
      for (let ci = 0; ci < outcome.checks.length; ci++) {
        if (outcome.checks[ci].status === 'fail') { fails++; }
      }
    }
    result.score = total > 0 ? Math.round((1 - fails / total) * 100) : 100;
    result.detail = '通过=' + (total - fails) + '/' + total;
  } catch (e) {
    result.status = STEP_FAIL;
    result.detail = e.message;
  }

  return result;
}

/**
 * Step 4: Coverage analysis.
 */
function stepCoverage() {
  const result = { step: 'coverage', status: STEP_SKIP, score: null, detail: '', raw: null };

  if (!coverageMod) {
    result.detail = 'coverage 模块不可用';
    return result;
  }

  try {
    const outcome = coverageMod.runCoverageEval({});
    result.raw = outcome;
    if (typeof outcome.overall === 'number') {
      result.score = Math.round(outcome.overall * 100 * 100) / 100;
      result.status = outcome.overall >= 0.5 ? STEP_PASS : STEP_WARN;
      result.detail = '覆盖度=' + (outcome.overall * 100).toFixed(1) + '%';
    }
  } catch (e) {
    result.status = STEP_WARN;
    result.detail = e.message;
  }

  return result;
}

/**
 * Step 5: Comprehensive multi-dimension scoring.
 */
function stepComprehensive(skill, routingResults) {
  const result = { step: 'comprehensive', status: STEP_SKIP, score: null, detail: '', raw: null, scorecard: null };

  if (!comprehensiveMod) {
    result.detail = 'comprehensive 模块不可用';
    return result;
  }

  try {
    const compOpts = { skill: skill, saveHistory: true };
    if (routingResults) {
      compOpts.routingResults = routingResults;
    }
    const outcome = comprehensiveMod.runComprehensiveEval(compOpts);
    result.raw = outcome;
    result.scorecard = outcome.scorecard;

    if (outcome.scorecard) {
      result.score = outcome.scorecard.overall;
      result.status = outcome.scorecard.gate === 'pass' ? STEP_PASS : STEP_FAIL;
      result.detail = '总分=' + outcome.scorecard.overall.toFixed(1) + '/100' +
        ' Gate=' + outcome.scorecard.gate.toUpperCase();

      const failedGates = [];
      if (outcome.scorecard.hardGates) {
        const gks = Object.keys(outcome.scorecard.hardGates);
        for (let gi = 0; gi < gks.length; gi++) {
          if (outcome.scorecard.hardGates[gks[gi]] === 'fail') {
            failedGates.push(gks[gi]);
          }
        }
      }
      if (failedGates.length > 0) {
        result.detail += ' 失败门槛=[' + failedGates.join(',') + ']';
      }
    }
  } catch (e) {
    result.status = STEP_FAIL;
    result.detail = e.message;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Pipeline orchestrator
// ---------------------------------------------------------------------------

/**
 * Run the full eval pipeline for a skill.
 *
 * @param {object} options
 * @param {string} options.skill        — target skill name (required)
 * @param {object} [options.config]     — eval config overrides
 * @param {boolean} [options.fix]       — attempt auto-fix based on suggestions
 * @param {string[]} [options.formats]  — output formats: 'json', 'junit'
 * @param {string[]} [options.commands] — agent commands for safety check
 * @param {string} [options.output]     — agent output for safety check
 * @param {boolean} [options.verbose]   — verbose logging (default: false)
 * @returns {object} Pipeline result with all step outcomes, scorecard, and suggestions
 */
function runPipeline(options) {
  const opts = options || {};
  const skill = opts.skill;

  if (!skill) {
    throw new Error('options.skill is required for pipeline');
  }

  const config = opts.config || {};
  const verbose = opts.verbose !== false;
  const runId = skill + '-' + Date.now();
  const workDir = path.join(PIPELINE_DIR, runId);

  function log() {
    if (verbose) {
      // eslint-disable-next-line no-console
      console.log.apply(console, arguments);
    }
  }

  log('[pipeline] 启动全自动闭环评测: ' + skill);
  log('[pipeline] 运行目录: ' + workDir);

  const startTime = Date.now();
  const steps = [];

  // ── Step 1: Static Validation ──
  log('[pipeline] Step 1/6: 静态校验...');
  const staticResult = stepStaticValidation(skill);
  steps.push(staticResult);
  log('[pipeline]   → ' + staticResult.status.toUpperCase() + ': ' + staticResult.detail);

  // ── Step 2: Routing Test ──
  log('[pipeline] Step 2/6: 路由测试...');
  const routingResult = stepRoutingTest(skill, config);
  steps.push(routingResult);
  log('[pipeline]   → ' + routingResult.status.toUpperCase() + ': ' + routingResult.detail);

  // ── Step 3: Safety Check ──
  log('[pipeline] Step 3/6: 安全合规...');
  const safetyResult = stepSafetyCheck({ commands: opts.commands, output: opts.output });
  steps.push(safetyResult);
  log('[pipeline]   → ' + safetyResult.status.toUpperCase() + ': ' + safetyResult.detail);

  // ── Step 4: Coverage Analysis ──
  log('[pipeline] Step 4/6: 覆盖度分析...');
  const coverageResult = stepCoverage();
  steps.push(coverageResult);
  log('[pipeline]   → ' + coverageResult.status.toUpperCase() + ': ' + coverageResult.detail);

  // ── Step 5: Comprehensive Multi-Dimension Scoring ──
  log('[pipeline] Step 5/6: 多维评分...');
  const routingRaw = routingResult.raw || null;
  const compResult = stepComprehensive(skill, routingRaw);
  steps.push(compResult);
  log('[pipeline]   → ' + compResult.status.toUpperCase() + ': ' + compResult.detail);

  // ── Step 6: Gate Decision + Suggestions ──
  log('[pipeline] Step 6/6: Gate 判定 + 自动优化建议...');
  const scorecard = compResult.scorecard || null;
  const suggestions = scorecard ? generateSuggestions(scorecard, {
    static: staticResult,
    routing: routingResult,
    safety: safetyResult,
    coverage: coverageResult,
    comprehensive: compResult,
  }) : [];

  const gateResult = {
    step: 'gate-decision',
    status: scorecard ? (scorecard.gate === 'pass' ? STEP_PASS : STEP_FAIL) : STEP_SKIP,
    score: scorecard ? scorecard.overall : null,
    detail: scorecard
      ? ('Gate=' + scorecard.gate.toUpperCase() + ' 优化建议=' + suggestions.length + '条')
      : 'comprehensive 评测未完成',
    suggestions: suggestions,
  };
  steps.push(gateResult);
  log('[pipeline]   → ' + gateResult.status.toUpperCase() + ': ' + gateResult.detail);

  // ── Summary ──
  const totalMs = Date.now() - startTime;
  let passCount = 0;
  let failCount = 0;
  let skipCount = 0;
  let warnCount = 0;
  for (let si = 0; si < steps.length; si++) {
    switch (steps[si].status) {
      case STEP_PASS: passCount++; break;
      case STEP_FAIL: failCount++; break;
      case STEP_SKIP: skipCount++; break;
      case STEP_WARN: warnCount++; break;
    }
  }

  const pipelineStatus = failCount > 0 ? 'fail' : (warnCount > 0 ? 'warn' : 'pass');

  const pipelineResult = {
    runId: runId,
    skill: skill,
    status: pipelineStatus,
    startedAt: new Date(startTime).toISOString(),
    durationMs: totalMs,
    summary: {
      total: steps.length,
      pass: passCount,
      fail: failCount,
      warn: warnCount,
      skip: skipCount,
    },
    steps: steps,
    scorecard: scorecard,
    suggestions: suggestions,
    reportPath: null,
  };

  // ── Write artifacts ──
  try {
    fs.mkdirSync(workDir, { recursive: true });

    // JSON report
    const reportPath = path.join(workDir, 'pipeline-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(pipelineResult, null, 2) + '\n', 'utf8');
    pipelineResult.reportPath = reportPath;

    // Suggestions markdown
    if (suggestions.length > 0) {
      const sugMd = renderSuggestionsMd(skill, suggestions, scorecard);
      const sugPath = path.join(workDir, 'suggestions.md');
      fs.writeFileSync(sugPath, sugMd, 'utf8');
      pipelineResult.suggestionsPath = sugPath;
    }

    // JUnit XML
    if (junitMod && opts.formats && opts.formats.indexOf('junit') !== -1) {
      const junitResults = steps.map(function (s) {
        return {
          caseId: s.step,
          status: s.status === STEP_PASS ? 'PASS' : (s.status === STEP_FAIL ? 'FAIL' : 'SKIP'),
          durationMs: 0,
          configuration: 'pipeline',
          finalMessage: s.detail,
          grading: s.status === STEP_SKIP ? { skipReason: s.detail } : undefined,
          error: s.status === STEP_FAIL ? s.detail : undefined,
        };
      });
      const junitPath = path.join(workDir, 'pipeline-report.xml');
      junitMod.writeJunitReport(junitPath, {
        suiteName: 'openyida-pipeline.' + skill,
        results: junitResults,
      });
      pipelineResult.junitPath = junitPath;
    }

  } catch (writeErr) {
    log('[pipeline] ⚠ 写入产物失败: ' + writeErr.message);
  }

  log('[pipeline] ─────────────────────────────');
  log('[pipeline] 完成: ' + pipelineStatus.toUpperCase() +
    ' (' + passCount + ' pass, ' + failCount + ' fail, ' + warnCount + ' warn, ' + skipCount + ' skip)');
  log('[pipeline] 耗时: ' + (totalMs / 1000).toFixed(1) + 's');
  if (pipelineResult.reportPath) {
    log('[pipeline] 报告: ' + pipelineResult.reportPath);
  }
  if (suggestions.length > 0) {
    log('[pipeline] 优化建议 (' + suggestions.length + '):');
    for (let sj = 0; sj < Math.min(suggestions.length, 5); sj++) {
      const sg = suggestions[sj];
      log('  [' + sg.priority + '] ' + sg.label +
        (sg.score !== null ? ' (score=' + sg.score.toFixed(1) + ')' : ''));
      for (let sk = 0; sk < sg.suggestions.length; sk++) {
        log('    • ' + sg.suggestions[sk]);
      }
    }
  }

  return pipelineResult;
}

// ---------------------------------------------------------------------------
// Suggestions renderer
// ---------------------------------------------------------------------------

/**
 * Render optimization suggestions as Markdown.
 */
function renderSuggestionsMd(skill, suggestions, scorecard) {
  const lines = [];
  lines.push('# 技能优化建议：' + skill);
  lines.push('');

  if (scorecard) {
    lines.push('## 当前评分');
    lines.push('');
    lines.push('- **总分**：' + (scorecard.overall !== null ? scorecard.overall.toFixed(1) : 'n/a') + ' / 100');
    lines.push('- **准出**：' + (scorecard.gate === 'pass' ? '✅ 通过' : '❌ 未通过'));
    lines.push('');
  }

  const blockers = suggestions.filter(function (s) { return s.priority === 'blocker'; });
  const criticals = suggestions.filter(function (s) { return s.priority === 'critical'; });
  const highs = suggestions.filter(function (s) { return s.priority === 'high'; });
  const mediums = suggestions.filter(function (s) { return s.priority === 'medium'; });

  if (blockers.length > 0) {
    lines.push('## 🚫 准出阻断（必须修复）');
    lines.push('');
    for (let bi = 0; bi < blockers.length; bi++) {
      lines.push('### ' + blockers[bi].label);
      for (let bj = 0; bj < blockers[bi].suggestions.length; bj++) {
        lines.push('- ' + blockers[bi].suggestions[bj]);
      }
      lines.push('');
    }
  }

  if (criticals.length > 0) {
    lines.push('## 🔴 严重问题（score < 60）');
    lines.push('');
    renderSugGroup(lines, criticals);
  }

  if (highs.length > 0) {
    lines.push('## 🟠 需要改进（score 60-80）');
    lines.push('');
    renderSugGroup(lines, highs);
  }

  if (mediums.length > 0) {
    lines.push('## 🟡 建议优化（score 80-90）');
    lines.push('');
    renderSugGroup(lines, mediums);
  }

  if (suggestions.length === 0) {
    lines.push('> ✅ 所有维度均达标，无需优化。');
  }

  lines.push('');
  lines.push('---');
  lines.push('_Generated by OpenYida Eval Pipeline · ' + new Date().toISOString() + '_');
  lines.push('');

  return lines.join('\n');
}

function renderSugGroup(lines, items) {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    lines.push('### ' + item.label + (item.score !== null ? ' — score ' + item.score.toFixed(1) : ''));
    for (let j = 0; j < item.suggestions.length; j++) {
      lines.push('- ' + item.suggestions[j]);
    }
    lines.push('');
  }
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);
  let skillArg = null;
  let fixMode = false;
  const formats = [];

  for (let ai = 0; ai < args.length; ai++) {
    if (args[ai] === '--skill' && ai + 1 < args.length) {
      skillArg = args[ai + 1];
      ai++;
    } else if (args[ai] === '--fix') {
      fixMode = true;
    } else if (args[ai] === '--format' && ai + 1 < args.length) {
      formats.push(args[ai + 1]);
      ai++;
    }
  }

  if (!skillArg) {
    console.error('Usage: node scripts/eval/pipeline.js --skill <skill-name> [--fix] [--format junit]');
    process.exit(1);
  }

  const result = runPipeline({
    skill: skillArg,
    fix: fixMode,
    formats: formats,
  });

  process.exit(result.status === 'fail' ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  STEP_PASS: STEP_PASS,
  STEP_FAIL: STEP_FAIL,
  STEP_SKIP: STEP_SKIP,
  STEP_WARN: STEP_WARN,
  DIMENSION_LABELS: DIMENSION_LABELS,
  HARD_GATE_LABELS: HARD_GATE_LABELS,
  generateSuggestions: generateSuggestions,
  stepStaticValidation: stepStaticValidation,
  stepRoutingTest: stepRoutingTest,
  stepSafetyCheck: stepSafetyCheck,
  stepCoverage: stepCoverage,
  stepComprehensive: stepComprehensive,
  runPipeline: runPipeline,
  renderSuggestionsMd: renderSuggestionsMd,
};
