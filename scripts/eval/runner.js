#!/usr/bin/env node

'use strict';

/**
 * OpenYida 测评 harness 入口与编排。
 *
 * 用法：
 *   node scripts/eval/runner.js --mode e2e   --skill yida-dashboard --screenshot [--auto-score]
 *   node scripts/eval/runner.js --mode routing --scenarios scripts/eval/scenarios
 *   node scripts/eval/runner.js --mode all   --skill yida-report --screenshot
 *
 * 设计原则：
 *   - 复用 scripts/e2e-real/full-runner.js 跑真实链路，结果增量回写其 acceptance-manifest。
 *   - 截图 / 自动打分 / claude CLI 均为软能力，缺失时优雅降级而非整体失败。
 *   - 护栏 fail 时以非零退出码作为 CI 红线。
 */

const fs = require('fs');
const path = require('path');

const { resolveConfig, buildE2eEnv } = require('./config');
const fullRunner = require('../e2e-real/full-runner');
const { runGuardrails, hasGuardrailFailure } = require('./guardrail');
const manifestUtil = require('./manifest');
const screenshotUtil = require('./screenshot');
const scoreUtil = require('./score');
const reportUtil = require('./report');
const routing = require('./routing');
const generate = require('./generate');
const docQuality = require('./doc-quality');
const coverage = require('./coverage');
const safety = require('./safety');
const comprehensive = require('./comprehensive');

let baselineModule;
try { baselineModule = require('./baseline'); } catch (_e) { baselineModule = null; }

let yamlLoaderModule;
try { yamlLoaderModule = require('./yaml-loader'); } catch (_e) { yamlLoaderModule = null; }

let judgeModuleRunner;
try { judgeModuleRunner = require('./judge'); } catch (_e) { judgeModuleRunner = null; }

let junitModuleRunner;
try { junitModuleRunner = require('./junit'); } catch (_e) { junitModuleRunner = null; }

let pipelineModule;
try { pipelineModule = require('./pipeline'); } catch (_e) { pipelineModule = null; }

const ROOT = path.resolve(__dirname, '..', '..');
const EVAL_OUT_DIR = path.join(ROOT, 'project', '.cache', 'eval');

function log(...args) {
  // eslint-disable-next-line no-console
  console.log(...args);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return filePath;
}

/**
 * 安全合规评测：检查 Agent 输出中的凭证泄漏、命令白名单等。
 * 独立运行时使用空数据（需从 generate 运行结果中获取实际数据）。
 */
function runSafetyCheck(config) {
  log('\n[safety] 安全合规评测');
  const commands = config.safetyCommands || [];
  const output = config.safetyOutput || '';

  if (commands.length === 0 && !output) {
    log('[safety] 无 Agent 命令/输出数据。独立模式下请配合 --mode generate 使用，或传入数据。');
    log('[safety] 以空数据运行基础检查...');
  }

  const outcome = safety.runSafetyEval({ commands, output });
  for (const check of outcome.checks) {
    const icon = check.status === 'pass' ? '✔' : (check.status === 'fail' ? '✗' : '·');
    log(`[safety] ${check.name}: ${check.status} ${icon}`);
    if (check.status === 'fail' && check.detail) {
      log(`  ${check.detail}`);
    }
  }
  log(`[safety] 总体：${outcome.passed ? 'PASS' : 'FAIL'}`);

  const reportPath = writeJson(path.join(EVAL_OUT_DIR, 'safety-report.json'), outcome);
  log(`[safety] 报告：${reportPath}`);
  return outcome;
}

/**
 * 文档质量评测：检查 SKILL.md 的规范性与可维护性（无副作用、不建资源）。
 */
function runDocQualityEval(config) {
  log('\n[doc-quality] 文档质量评测');
  const options = {};
  if (config.skill) {
    options.skill = config.skill;
    log(`[doc-quality] 过滤技能：${config.skill}`);
  }
  const outcome = docQuality.runDocQualityEval(options);
  const { summary } = outcome;

  log(`[doc-quality] 技能数 ${summary.total}，平均规范性 ${summary.avgStandards.toFixed(1)}，平均可维护性 ${summary.avgMaintainability.toFixed(1)}`);
  log(`[doc-quality] 平均总分：${summary.avgOverall.toFixed(1)}`);
  if (summary.belowThreshold.length) {
    log(`[doc-quality] ${summary.belowThreshold.length} 个技能低于阈值：`);
    for (const b of summary.belowThreshold) {
      log(`  - ${b.skill}  standards=${b.standards}  maintainability=${b.maintainability}`);
    }
  }

  const reportPath = writeJson(path.join(EVAL_OUT_DIR, 'doc-quality-report.json'), outcome);
  log(`[doc-quality] 报告：${reportPath}`);
  return outcome;
}

/**
 * 覆盖度评测：度量测评体系本身的完整性。
 */
function runCoverageEval(_config) {
  log('\n[coverage] 覆盖度分析');
  const outcome = coverage.runCoverageEval({});

  const pct = (rate) => rate === null ? 'n/a' : `${(rate * 100).toFixed(1)}%`;
  log(`[coverage] 技能覆盖率：${pct(outcome.skillCoverage.rate)} (${outcome.skillCoverage.covered}/${outcome.skillCoverage.total})`);
  log(`[coverage] 分类覆盖率：${pct(outcome.categoryCoverage.rate)} (${outcome.categoryCoverage.covered}/${outcome.categoryCoverage.total})`);
  log(`[coverage] 引用覆盖率：${pct(outcome.referenceCoverage.rate)} (${outcome.referenceCoverage.used}/${outcome.referenceCoverage.total})`);
  log(`[coverage] 命令总数：${outcome.commandCoverage.total} (${outcome.commandCoverage.note})`);
  log(`[coverage] 综合覆盖度：${pct(outcome.overall)}`);

  if (outcome.skillCoverage.uncoveredSkills.length) {
    log(`[coverage] 未覆盖技能：${outcome.skillCoverage.uncoveredSkills.join(', ')}`);
  }

  const reportPath = writeJson(path.join(EVAL_OUT_DIR, 'coverage-report.json'), outcome);
  log(`[coverage] 报告：${reportPath}`);
  return outcome;
}

/**
 * 路由测评：测 agent 能否从 ~50 个子技能里选对一个（无副作用、不建资源）。
 * 支持 --parallel 模式: 批量提示 + 并发执行 + 结果缓存。
 */
async function runRouting(config) {
  let scenariosDir = config.scenariosDir;
  if (scenariosDir && !path.isAbsolute(scenariosDir)) {
    scenariosDir = path.join(ROOT, scenariosDir);
  }
  log(`\n[routing] 加载 scenarios：${scenariosDir}`);
  const routingOptions = { scenariosDir };
  if (config.skill) {
    routingOptions.skill = config.skill;
    log(`[routing] 过滤技能：${config.skill}`);
  }
  if (config.runs > 1) {
    routingOptions.runs = config.runs;
    log(`[routing] 多轮稳定性：${config.runs} 次`);
  }

  // Use parallel mode if requested
  const useParallel = config.parallel === true;
  let outcome;

  if (useParallel && typeof routing.runRoutingEvalAsync === 'function') {
    routingOptions.batchSize = config.batchSize || 8;
    routingOptions.concurrency = config.concurrency || 6;
    routingOptions.useCache = config.useCache !== false;
    routingOptions.agentCommand = config.agentCommand;
    routingOptions.onProgress = (done, total) => {
      if (done % 10 === 0 || done === total) {
        log(`[routing] 进度：${done}/${total}`);
      }
    };
    log(`[routing] 并行模式：batch=${routingOptions.batchSize} concurrency=${routingOptions.concurrency} cache=${routingOptions.useCache}`);
    outcome = await routing.runRoutingEvalAsync(routingOptions);
    if (outcome.stats) {
      const s = outcome.stats;
      const elapsed = ((s.endTime - s.startTime) / 1000).toFixed(1);
      log(`[routing] 完成：${s.agentCalls} 次调用（缓存命中 ${s.cached}/${s.total}）耗时 ${elapsed}s`);
      if (s.avgBatchMs) {
        log(`[routing] 每批耗时：平均 ${(s.avgBatchMs / 1000).toFixed(1)}s · 最慢 ${(s.maxBatchMs / 1000).toFixed(1)}s（batch=${routingOptions.batchSize} concurrency=${routingOptions.concurrency}）`);
      }
    }
  } else {
    outcome = routing.runRoutingEval(routingOptions);
  }

  const { summary } = outcome;

  log(`[routing] 用例 ${summary.total}，已评 ${summary.evaluated}，命中 ${summary.hits}`);
  log(`[routing] 路由准确率：${summary.accuracy === null ? 'n/a' : `${(summary.accuracy * 100).toFixed(1)}%`}`);
  if (summary.agentUnavailable) {
    log(`[routing] ⚠ ${summary.agentUnavailable} 条因 ${config.agentCommand} CLI 不可用未评测`);
  }
  if (summary.agentError) {
    const sample = (outcome.results.find((r) => r.status === 'agent-error') || {}).raw;
    log(`[routing] ⚠ ${summary.agentError} 条 agent 调用失败（如未登录/配额/API 错误）`);
    if (sample) {log(`[routing]   示例：${sample.split('\n')[0]}`);}
    log(`[routing]   提示：请先认证 headless agent —— 运行 ${config.agentCommand} login 登录。`);
  }
  if (summary.unparsed) {
    log(`[routing] ⚠ ${summary.unparsed} 条 agent 输出无法解析`);
  }
  if (summary.confusion.length) {
    log('[routing] 混淆对（expected → actual）：');
    for (const c of summary.confusion) {log(`  - ${c.pair}  x${c.count}`);}
  }
  if (outcome.stability) {
    const s = outcome.stability;
    const pct = s.consistencyRate !== null ? `${(s.consistencyRate * 100).toFixed(1)}%` : 'n/a';
    log(`[routing] 稳定性（${s.runs} 轮）：一致率 ${pct}（${s.consistent}/${s.scenarios}）`);
  }

  const reportPath = writeJson(path.join(EVAL_OUT_DIR, 'routing-report.json'), outcome);
  log(`[routing] 报告：${reportPath}`);
  return outcome;
}

/**
 * 真实生成测评：自然语言 → agent 真实生成应用 → 截图 + 打分 + HTML 报告。
 * 测「端到端：一句话能否真生成可用应用」。**会创建真实宜搭资源**，
 * 需 OPENYIDA_E2E=1 且 headless agent 已认证。
 */
async function runGenerate(config) {
  if (!['1', 'true', 'yes', 'on'].includes(String(process.env.OPENYIDA_E2E || '').toLowerCase())) {
    log('\n[generate] 已跳过：真实生成会创建真实宜搭资源，需设置 OPENYIDA_E2E=1 且 headless agent 已认证。');
    return { skipped: true };
  }

  let scenarioPath = config.generationScenarios;
  if (scenarioPath && !path.isAbsolute(scenarioPath)) {
    scenarioPath = path.join(ROOT, scenarioPath);
  }
  log(`\n[generate] 加载生成 scenarios：${scenarioPath}`);

  // Use parallel mode if requested
  const useParallel = config.parallel === true;
  let outcome;

  if (useParallel && typeof generate.runGenerationEvalAsync === 'function') {
    log(`[generate] 并行模式：concurrency=${config.concurrency || 3}`);
    outcome = await generate.runGenerationEvalAsync({
      scenarioPath,
      concurrency: config.concurrency || 3,
      agentCommand: config.agentCommand,
      onProgress: (done, total) => {
        log(`[generate] 进度：${done}/${total}`);
      },
    });
    if (outcome.stats) {
      const elapsed = ((outcome.stats.endTime - outcome.stats.startTime) / 1000).toFixed(1);
      log(`[generate] 完成：${outcome.stats.agentCalls} 次调用 耗时 ${elapsed}s`);
    }
  } else {
    outcome = generate.runGenerationEval({ scenarioPath });
  }

  const { summary } = outcome;
  log(`[generate] 用例 ${summary.total}，产出资源 ${summary.produced}，通过 ${summary.passed}`);
  log(`[generate] 通过率：${summary.passRate === null ? 'n/a' : `${(summary.passRate * 100).toFixed(1)}%`}`);
  if (summary.agentUnavailable) {
    log(`[generate] ⚠ ${summary.agentUnavailable} 条因 ${config.agentCommand} CLI 不可用未评测`);
  }
  if (summary.agentError) {log(`[generate] ⚠ ${summary.agentError} 条 agent 调用失败`);}
  if (summary.noOutput) {log(`[generate] ⚠ ${summary.noOutput} 条未解析到产物 URL`);}
  if (summary.featureMiss) {log(`[generate] ⚠ ${summary.featureMiss} 条产物未满足期望特征`);}

  // 汇总所有 scenario 的产物 URL 为统一截图/打分目标（stage 用 scenario id 区分）。
  const targets = [];
  for (const r of outcome.results) {
    for (const t of (r.targets || [])) {
      targets.push({ stage: `${r.id}:${t.type}`, type: t.type, url: t.url });
    }
  }

  const workDir = path.join(EVAL_OUT_DIR, 'generate', `gen-${Date.now()}`);
  fs.mkdirSync(workDir, { recursive: true });

  // 截图（可选）
  let screenshots = targets.map((t) => ({ ...t, ok: false, path: null, skipped: 'screenshot-disabled' }));
  if (config.screenshot && targets.length) {
    const shotResult = await screenshotUtil.captureScreenshots({
      targets,
      outputDir: path.join(workDir, 'eval-screenshots'),
    });
    screenshots = shotResult.screenshots;
    if (!shotResult.available) {
      log(`[generate] ⚠ 截图不可用（${shotResult.reason}），已跳过。`);
    } else {
      log(`[generate] 截图完成：${screenshots.filter((s) => s.ok).length}/${screenshots.length} 张`);
    }
  } else if (!config.screenshot) {
    log('[generate] 截图未开启（--no-screenshot）。');
  }

  // 打分
  let scores;
  if (config.autoScore) {
    const auto = scoreUtil.autoScoreScreenshots({ screenshots });
    scores = auto.scores;
    log(auto.available
      ? `[generate] 自动打分完成：${scores.filter((s) => s.auto && !s.auto.error).length} 张`
      : `[generate] ⚠ 自动打分不可用（${config.agentCommand} CLI 缺失），退化为人工占位。`);
  } else {
    scores = scoreUtil.buildHumanScores(screenshots);
    log('[generate] 人工打分模式：生成 scoring.md 模板。');
  }

  const scoringMd = scoreUtil.renderScoringMarkdown({ config, scores, workDir });
  const scoringDocPath = scoreUtil.writeScoringDoc(workDir, scoringMd);
  const reportHtml = reportUtil.renderEvalReportHtml({
    config,
    registry: { runId: path.basename(workDir) },
    guardrails: [],
    screenshots,
    scores,
  });
  const reportPath = reportUtil.writeReport(workDir, reportHtml);
  const jsonPath = writeJson(path.join(workDir, 'generation-report.json'), {
    summary, results: outcome.results, scoringDoc: scoringDocPath, reportHtml: reportPath,
  });
  log(`[generate] 打分表：${scoringDocPath}`);
  log(`[generate] HTML 报告：${reportPath}`);
  log(`[generate] 生成报告：${jsonPath}`);

  return { skipped: false, summary, workDir, reportPath, scoringDocPath };
}

/**
 * 工具管道基线（端到端）：确定性 CLI 链路 + 护栏 + 截图 + 打分，回写 manifest。
 * 不经过 agent，作为对照基线验证「建应用→截图→打分」管道本身是否健康。
 */
async function runE2e(config) {
  const env = buildE2eEnv(config, process.env);

  if (config.skill) {
    if (config.skillMapping && !config.skillMapping.ok) {
      log(`\n[e2e] ⚠ ${config.skillMapping.reason}`);
    } else {
      log(`\n[e2e] 子技能过滤：${config.skill} → stages=${config.resolvedStages}`);
    }
  }

  const result = fullRunner.run({ env });
  if (result.skipped) {
    log('[e2e] 已跳过真实链路（需 OPENYIDA_E2E=1 与有效 token session）。');
    return { skipped: true };
  }

  const registry = result.registry;
  const manifestPath = registry.acceptance && registry.acceptance.manifestPath
    ? registry.acceptance.manifestPath
    : null;
  const workDir = manifestPath ? path.dirname(manifestPath) : path.dirname(result.registryPath);

  // 1) 护栏
  const guardrails = runGuardrails(registry);
  for (const g of guardrails) {
    const icon = g.status === 'pass' ? '✔' : (g.status === 'fail' ? '✗' : '·');
    log(`[e2e] 护栏 ${g.name}: ${g.status} ${icon} — ${g.detail}`);
  }

  // 2) 收集可打分目标
  const targets = manifestUtil.collectScoreTargets(registry);
  log(`[e2e] 可打分页面目标：${targets.length}`);

  // 3) 截图（可选）
  let screenshots = targets.map((t) => ({ ...t, ok: false, path: null, skipped: 'screenshot-disabled' }));
  if (config.screenshot && targets.length) {
    const shotResult = await screenshotUtil.captureScreenshots({
      targets,
      outputDir: path.join(workDir, 'eval-screenshots'),
    });
    screenshots = shotResult.screenshots;
    if (!shotResult.available) {
      log(`[e2e] ⚠ 截图不可用（${shotResult.reason}），已跳过；e2e 结果不受影响。`);
    } else {
      const okCount = screenshots.filter((s) => s.ok).length;
      log(`[e2e] 截图完成：${okCount}/${screenshots.length} 张`);
    }
  } else if (!config.screenshot) {
    log('[e2e] 截图未开启（--no-screenshot）。');
  }

  // 4) 打分
  let scores;
  if (config.autoScore) {
    const auto = scoreUtil.autoScoreScreenshots({ screenshots });
    scores = auto.scores;
    if (!auto.available) {
      log('[e2e] ⚠ 自动打分不可用（claude CLI 缺失），已退化为人工打分占位。');
    } else {
      log(`[e2e] 自动打分完成：${scores.filter((s) => s.auto && !s.auto.error).length} 张`);
    }
  } else {
    scores = scoreUtil.buildHumanScores(screenshots);
    log('[e2e] 人工打分模式：生成 scoring.md 模板。');
  }

  // 5) 人工打分文档
  const scoringMd = scoreUtil.renderScoringMarkdown({ config, scores, workDir });
  const scoringDocPath = scoreUtil.writeScoringDoc(workDir, scoringMd);
  log(`[e2e] 打分表：${scoringDocPath}`);

  // 6) HTML 可视化报告（自包含，截图 base64 内联）
  const reportHtml = reportUtil.renderEvalReportHtml({
    config,
    registry,
    guardrails,
    screenshots,
    scores,
  });
  const reportPath = reportUtil.writeReport(workDir, reportHtml);
  log(`[e2e] HTML 报告：${reportPath}`);

  // 7) 回写 manifest 的 eval 段
  const evalSection = manifestUtil.buildEvalSection({
    config,
    guardrails,
    screenshots,
    scores,
    scoringDoc: scoringDocPath,
    reportHtml: reportPath,
  });
  if (manifestPath) {
    manifestUtil.augmentManifestFile(manifestPath, evalSection);
    log(`[e2e] 已回写 eval 段：${manifestPath}`);
  } else {
    log('[e2e] ⚠ 未找到 acceptance-manifest，eval 段未回写。');
  }

  return { skipped: false, guardrails, manifestPath, workDir, scoringDocPath, reportPath };
}

/**
 * 计时包装：始终打印某段评测的墙钟耗时（无论串行/并行），
 * 便于回答「每次评测耗时多少」。
 */
async function timed(label, fn) {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    log(`⏱ [${label}] 总耗时 ${((Date.now() - start) / 1000).toFixed(1)}s`);
  }
}

async function main(argv = process.argv.slice(2)) {
  const config = resolveConfig({ argv, env: process.env });
  const _runStart = Date.now();
  // 把解析出的 agent 命令回写环境变量，供 agent.js 在同进程读取（--agent-cmd 由此生效）。
  if (config.agentCommand) {
    process.env.OPENYIDA_EVAL_AGENT_CMD = config.agentCommand;
  }
  log(`OpenYida 测评 harness · mode=${config.mode} · agent=${config.agentCommand}`);

  let guardrailFailed = false;

  if (config.mode === 'doc-quality' || config.mode === 'all') {
    await timed('doc-quality', async () => runDocQualityEval(config));
  }

  if (config.mode === 'coverage' || config.mode === 'all') {
    await timed('coverage', async () => runCoverageEval(config));
  }

  if (config.mode === 'safety' || config.mode === 'all') {
    await timed('safety', async () => runSafetyCheck(config));
  }

  if (config.mode === 'comprehensive') {
    if (!config.skill) {
      log('\n[comprehensive] 综合评测需要 --skill 参数，例如：--skill yida-dashboard');
      process.exit(1);
    }
    log(`\n[comprehensive] 综合评测：${config.skill}`);
    const result = comprehensive.runComprehensiveEval({ skill: config.skill });
    const sc = result.scorecard;
    log(`[comprehensive] 总分：${sc.overall !== null ? sc.overall.toFixed(1) : 'n/a'} / 100`);
    log(`[comprehensive] Gate：${sc.gate.toUpperCase()}`);
    for (const [name, status] of Object.entries(sc.hardGates)) {
      const icon = status === 'pass' ? '✔' : (status === 'fail' ? '✗' : '·');
      log(`[comprehensive]   ${name}: ${status} ${icon}`);
    }
    if (result.trend) {
      const t = result.trend;
      log(`[comprehensive] 趋势：${t.improving ? '↑ 上升' : '↓ 下降'} ${t.delta > 0 ? '+' : ''}${t.delta.toFixed(1)} (${t.dataPoints} 个数据点)`);
    }
    if (result.reportPath) {
      log(`[comprehensive] 报告：${result.reportPath}`);
    }
  }

  if (config.mode === 'baseline') {
    if (!config.skill) {
      log('\n[baseline] A/B 基线评测需要 --skill 参数');
      process.exit(1);
    }
    log(`\n[baseline] A/B 基线评测：${config.skill}`);
    runBaselineMode(config);
  }

  if (config.mode === 'pipeline') {
    if (!config.skill) {
      log('\n[pipeline] 全自动闭环评测需要 --skill 参数');
      process.exit(1);
    }
    if (pipelineModule) {
      const pipeResult = pipelineModule.runPipeline({
        skill: config.skill,
        config: config,
        fix: config.fix || false,
        formats: config.formats || [],
      });
      if (pipeResult.status === 'fail') {
        guardrailFailed = true;
      }
    } else {
      log('[pipeline] pipeline 模块不可用');
    }
  }

  if (config.mode === 'routing' || config.mode === 'all') {
    await timed('routing', async () => runRouting(config));
  }

  if (config.mode === 'e2e' || config.mode === 'all') {
    const e2e = await timed('e2e', async () => runE2e(config));
    if (!e2e.skipped && hasGuardrailFailure(e2e.guardrails || [])) {
      guardrailFailed = true;
    }
  }

  if (config.mode === 'generate' || config.mode === 'all') {
    await timed('generate', async () => runGenerate(config));
  }

  if (config.mode === 'all') {
    log(`⏱ [all] 全部评测总耗时 ${((Date.now() - _runStart) / 1000).toFixed(1)}s`);
  }

  if (guardrailFailed) {
    log('\n护栏存在 fail，退出码 1（CI 红线）。');
    process.exit(1);
  }
}

/**
 * A/B 基线评测模式：使用声明式 YAML 用例，运行 with_skill / without_skill 对比。
 *
 * 用法：
 *   node scripts/eval/runner.js --mode baseline --skill yida-dashboard [--baseline] [--format junit]
 *
 * 加载用例优先级：evals/eval.yaml > scenarios/*.json
 */
function runBaselineMode(config) {
  if (!baselineModule) {
    log('[baseline] baseline 模块不可用');
    return;
  }

  const skill = config.skill;
  const skillsRoot = path.join(ROOT, 'yida-skills', 'skills');
  const skillDir = path.join(skillsRoot, skill);

  // Load cases: try YAML first, fallback to JSON scenarios
  let cases = [];
  const evalYamlPath = path.join(skillDir, 'evals', 'eval.yaml');
  let evalConfig = null;

  if (yamlLoaderModule && fs.existsSync(evalYamlPath)) {
    log('[baseline] 加载 YAML 评测用例：' + evalYamlPath);
    const suite = yamlLoaderModule.loadEvalSuite(evalYamlPath);
    if (suite) {
      evalConfig = suite.config;
      cases = suite.cases;
      log('[baseline] 已加载 ' + cases.length + ' 个 YAML 用例');
    }
  }

  if (cases.length === 0 && yamlLoaderModule) {
    const scenariosDir = config.scenariosDir || path.join(__dirname, 'scenarios');
    if (fs.existsSync(scenariosDir)) {
      cases = yamlLoaderModule.loadJsonScenarios(scenariosDir);
      log('[baseline] 从 JSON scenarios 转换了 ' + cases.length + ' 个用例');
    }
  }

  if (cases.length === 0) {
    log('[baseline] 无可用评测用例');
    return;
  }

  // Load skill context
  let skillContext = '';
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  if (fs.existsSync(skillMdPath)) {
    try {
      skillContext = fs.readFileSync(skillMdPath, 'utf8').slice(0, 8000);
    } catch (_e) { /* ignore */ }
  }

  // Resolve agent runner
  const agentMod = require('./agent');
  const agentCommand = config.agentCommand || 'claude';
  const runAgentFn = function (opts) {
    return agentMod.runAgent(Object.assign({}, opts, { command: agentCommand }));
  };

  // Determine baseline mode
  const enableBaseline = config.baseline !== false;

  // Run evaluation
  const result = baselineModule.runBaselineEval({
    cases: cases,
    skillName: skill,
    skillContext: skillContext,
    runAgent: runAgentFn,
    judgeConfig: evalConfig ? evalConfig.judge : { type: 'rule_based' },
    baseline: enableBaseline,
  });

  // Print results
  if (result.withSkill) {
    const ws = result.withSkill.summary;
    log(`[baseline] With Skill: ${ws.passed}/${ws.total} passed (${(ws.passRate * 100).toFixed(1)}%)`);
  }
  if (result.withoutSkill) {
    const wos = result.withoutSkill.summary;
    log(`[baseline] Without Skill: ${wos.passed}/${wos.total} passed (${(wos.passRate * 100).toFixed(1)}%)`);
  }

  if (result.benchmark && result.benchmark.runSummary.delta) {
    const d = result.benchmark.runSummary.delta;
    const sign = d.passRate >= 0 ? '+' : '';
    log(`[baseline] Delta: pass_rate ${sign}${(d.passRate * 100).toFixed(1)}%, time ${d.timeSeconds > 0 ? '+' : ''}${d.timeSeconds.toFixed(1)}s`);
  }

  if (result.artifacts) {
    if (result.artifacts.benchmark) {
      log('[baseline] benchmark: ' + result.artifacts.benchmark);
    }
    if (result.artifacts.benchmarkMd) {
      log('[baseline] report: ' + result.artifacts.benchmarkMd);
    }
  }

  // Generate JUnit if requested
  const formats = config.formats || [];
  if (junitModuleRunner && formats.indexOf('junit') !== -1) {
    const allResults = (result.withSkill ? result.withSkill.results : [])
      .concat(result.withoutSkill ? result.withoutSkill.results : []);
    if (allResults.length > 0) {
      const junitPath = path.join(EVAL_OUT_DIR, 'baseline-' + skill + '.xml');
      junitModuleRunner.writeJunitReport(junitPath, {
        suiteName: 'openyida-baseline.' + skill,
        results: allResults,
      });
      log('[baseline] JUnit: ' + junitPath);
    }
  }

  // Run comprehensive evaluation with baseline data
  if (comprehensive && typeof comprehensive.runBaselineComprehensiveEval === 'function') {
    log('[baseline] 运行综合维度评测...');
    const compResult = comprehensive.runBaselineComprehensiveEval({
      skill: skill,
      cases: cases,
      skillContext: skillContext,
      runAgent: runAgentFn,
      baseline: enableBaseline,
      judgeConfig: evalConfig ? evalConfig.judge : { type: 'rule_based' },
      formats: formats,
    });
    const sc = compResult.scorecard;
    log(`[baseline] 综合总分：${sc.overall !== null ? sc.overall.toFixed(1) : 'n/a'} / 100  Gate: ${sc.gate.toUpperCase()}`);
    if (compResult.baseline && compResult.baseline.benchmark) {
      const bm = compResult.baseline.benchmark;
      if (bm.runSummary.delta) {
        const bd = bm.runSummary.delta;
        log(`[baseline] Skill 增量：pass_rate ${bd.passRate >= 0 ? '+' : ''}${(bd.passRate * 100).toFixed(1)}%`);
      }
    }
    if (compResult.dualRadarSvg) {
      const svgPath = path.join(EVAL_OUT_DIR, 'comprehensive', 'dual-radar-' + skill + '.svg');
      fs.mkdirSync(path.dirname(svgPath), { recursive: true });
      fs.writeFileSync(svgPath, compResult.dualRadarSvg, 'utf8');
      log('[baseline] 双线雷达图：' + svgPath);
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = {
  runDocQualityEval,
  runCoverageEval,
  runSafetyCheck,
  runRouting,
  runE2e,
  runGenerate,
  runBaselineMode,
  main,
  EVAL_OUT_DIR,
};
