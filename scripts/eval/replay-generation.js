#!/usr/bin/env node

'use strict';

/**
 * 用历史 generation report 的真实 CLI trace + 当前平台只读回读，重新执行最新验收合同。
 *
 * 该命令不会运行 agent、不会写宜搭资源。traceCompleteness 默认 partial，避免把恢复
 * trace 中没有观察到的动作误判成技能或 CLI 缺陷。
 */

const fs = require('fs');
const path = require('path');

const {
  loadGenerationScenarios,
  parseGenerationResult,
  mergeGenerationTargets,
  checkExpectedFeatures,
} = require('./generate');
const {
  buildGenerationEvidence,
  evaluateGenerationEvidence,
  mergeEvidence,
} = require('./evidence');
const { collectOpenYidaReadback } = require('./openyida-readback');
const { deriveOptimizationFindings, buildOptimizationBacklog } = require('./optimization-findings');
const reportUtil = require('./report');

const ROOT = path.resolve(__dirname, '..', '..');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return filePath;
}

function parseArgs(argv = []) {
  const out = { traceCompleteness: 'partial', resultIndex: 0 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      if (arg.includes('=')) {return arg.slice(arg.indexOf('=') + 1);}
      index += 1;
      return argv[index];
    };
    if (arg === '--report' || arg.startsWith('--report=')) {out.reportPath = value();}
    else if (arg === '--scenario' || arg.startsWith('--scenario=')) {out.scenarioPath = value();}
    else if (arg === '--scenario-id' || arg.startsWith('--scenario-id=')) {out.scenarioId = value();}
    else if (arg === '--app-type' || arg.startsWith('--app-type=')) {out.appType = value();}
    else if (arg === '--output-dir' || arg.startsWith('--output-dir=')) {out.outputDir = value();}
    else if (arg === '--result-index' || arg.startsWith('--result-index=')) {
      out.resultIndex = Number.parseInt(value(), 10) || 0;
    } else if (arg === '--trace-completeness' || arg.startsWith('--trace-completeness=')) {
      out.traceCompleteness = value();
    } else if (arg === '--help' || arg === '-h') {out.help = true;}
    else {throw new Error(`未知参数：${arg}`);}
  }
  return out;
}

function usage() {
  return [
    '用法: npm run eval:replay -- --report <generation-report.json> --scenario <scenario.json> --app-type <APP_*>',
    '可选: --scenario-id <id> --result-index <n> --trace-completeness partial|full --output-dir <dir>',
    '说明: 只读重放，不运行 agent，不修改宜搭资源；trace 完整性默认 partial。',
  ].join('\n');
}

function chooseScenario(scenarios = [], scenarioId) {
  if (!scenarios.length) {throw new Error('scenario 文件没有可用场景');}
  if (!scenarioId) {return scenarios[0];}
  const scenario = scenarios.find((item) => item.id === scenarioId);
  if (!scenario) {throw new Error(`scenario-id 不存在：${scenarioId}`);}
  return scenario;
}

function chooseArchivedResult(report = {}, resultIndex = 0) {
  const results = Array.isArray(report.results) ? report.results : [];
  const result = results[resultIndex];
  if (!result) {throw new Error(`generation report 中不存在 results[${resultIndex}]`);}
  return result;
}

function recoverGenerationResult(archived = {}) {
  const prior = archived.result && typeof archived.result === 'object' ? archived.result : {};
  const reparsed = prior.raw ? parseGenerationResult({ text: prior.raw }) : null;
  const result = reparsed && (reparsed.ok || reparsed.appType)
    ? { ...prior, ...reparsed }
    : { ...prior };
  result.targets = Array.isArray(result.targets) ? result.targets : [];
  result.evidence = mergeEvidence(
    reparsed && reparsed.evidence || prior.evidence || {},
    {
      skills: archived.evidence && archived.evidence.skills || [],
      resources: archived.evidence && archived.evidence.resources || [],
      findings: [],
    },
  );
  return result;
}

function replayGeneration(options = {}) {
  const archived = options.archivedResult || {};
  const sourceScenario = options.scenario || {};
  const appType = options.appType || archived.appType
    || archived.result && archived.result.appType
    || sourceScenario.readback && sourceScenario.readback.appType;
  if (!appType) {throw new Error('缺少 appType；请传 --app-type');}

  const scenario = {
    ...sourceScenario,
    diagnostics: {
      ...(sourceScenario.diagnostics || {}),
      mode: 'replay',
      traceCompleteness: options.traceCompleteness || 'partial',
    },
    readback: {
      ...(sourceScenario.readback || {}),
      enabled: true,
      appType,
    },
  };
  const result = recoverGenerationResult(archived);
  result.appType = appType;

  const collector = options.collectEvidence || collectOpenYidaReadback;
  const readback = collector({ phase: 'after', scenario, result, agentResult: null }) || {};
  mergeGenerationTargets(result, readback.targets);
  const evidence = buildGenerationEvidence({
    scenario,
    result,
    agentResult: { commandTrace: archived.evidence && archived.evidence.commands || [] },
    extraEvidence: readback,
  });
  const features = checkExpectedFeatures(result, scenario.expectedFeatures || {});
  const evidenceChecks = evaluateGenerationEvidence(scenario, evidence);
  const status = features.pass && evidenceChecks.pass ? 'ok'
    : (features.pass ? 'evidence-miss' : 'feature-miss');
  const outcome = {
    id: scenario.id,
    status,
    appType,
    prompt: scenario.prompt,
    targets: result.targets,
    features,
    evidence,
    evidenceChecks,
    result,
    replay: {
      sourceResultId: archived.id || null,
      sourceStatus: archived.status || null,
      traceCompleteness: scenario.diagnostics.traceCompleteness,
      commandCount: evidence.commands.length,
    },
  };
  outcome.optimizationFindings = deriveOptimizationFindings({
    scenario, evidence, evidenceChecks, features, status,
  });
  return outcome;
}

function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    // eslint-disable-next-line no-console
    console.log(usage());
    return null;
  }
  if (!args.reportPath || !args.scenarioPath) {throw new Error(`${usage()}\n\n--report 和 --scenario 为必填`);}
  if (!['partial', 'full'].includes(args.traceCompleteness)) {
    throw new Error('--trace-completeness 只能是 partial 或 full');
  }
  const reportPath = path.resolve(ROOT, args.reportPath);
  const scenarioPath = path.resolve(ROOT, args.scenarioPath);
  const report = readJson(reportPath);
  const archivedResult = chooseArchivedResult(report, args.resultIndex);
  const scenario = chooseScenario(loadGenerationScenarios(scenarioPath), args.scenarioId);
  const outcome = replayGeneration({
    archivedResult,
    scenario,
    appType: args.appType,
    traceCompleteness: args.traceCompleteness,
  });
  const outputDir = args.outputDir
    ? path.resolve(ROOT, args.outputDir)
    : path.join(ROOT, 'project', '.cache', 'eval', 'replay', `replay-${Date.now()}`);
  const backlog = buildOptimizationBacklog([outcome]);
  const backlogPath = writeJson(path.join(outputDir, 'optimization-backlog.json'), backlog);
  const reportHtml = reportUtil.renderEvalReportHtml({
    config: { mode: 'replay', screenshot: false, autoScore: false },
    registry: { runId: path.basename(outputDir) },
    guardrails: [],
    screenshots: [],
    scores: [],
    generationResults: [outcome],
    optimizationBacklog: backlog,
  });
  const htmlPath = reportUtil.writeReport(outputDir, reportHtml);
  const replayPath = writeJson(path.join(outputDir, 'replay-report.json'), {
    status: outcome.status,
    sourceReport: reportPath,
    scenario: scenarioPath,
    result: outcome,
    optimizationBacklog: backlogPath,
    reportHtml: htmlPath,
  });
  // eslint-disable-next-line no-console
  console.log(`[replay] status=${outcome.status} commands=${outcome.replay.commandCount} findings=${backlog.summary.total}`);
  // eslint-disable-next-line no-console
  console.log(`[replay] 优化清单：${backlogPath}`);
  // eslint-disable-next-line no-console
  console.log(`[replay] HTML 报告：${htmlPath}`);
  // eslint-disable-next-line no-console
  console.log(`[replay] 重放报告：${replayPath}`);
  return { outcome, backlog, replayPath, backlogPath, htmlPath };
}

if (require.main === module) {
  try {runCli();} catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[replay] ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  parseArgs,
  chooseScenario,
  chooseArchivedResult,
  recoverGenerationResult,
  replayGeneration,
  runCli,
};
