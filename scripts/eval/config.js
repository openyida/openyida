#!/usr/bin/env node

'use strict';

/**
 * OpenYida 测评 harness 配置解析。
 *
 * 解析优先级：CLI flag > 环境变量 > eval.config.json > 内置默认值。
 * 负责把 `--skill <name>` 经 skill-coverage 矩阵反查为 E2E stages，
 * 供 runner 设置 OPENYIDA_E2E_STAGES。
 */

const fs = require('fs');
const path = require('path');

const { SKILL_COVERAGE } = require('../e2e-real/skill-coverage');

const DEFAULT_CONFIG_FILE = path.join(__dirname, 'eval.config.json');
const DEFAULT_SCENARIOS_DIR = path.join(__dirname, 'scenarios');
const DEFAULT_GENERATION_DIR = path.join(__dirname, 'scenarios', 'generation');

const DEFAULTS = {
  mode: 'e2e', // 'e2e' | 'routing' | 'all'
  skill: null, // null = 跑默认全链路；否则只跑该子技能相关 stages
  stages: null, // 显式 stages（逗号分隔字符串）；优先级低于 skill 反查
  screenshot: true,
  autoScore: false,
  scenariosDir: DEFAULT_SCENARIOS_DIR,
  generationScenarios: DEFAULT_GENERATION_DIR,
  generationTimeoutMs: 600000,
  agentCommand: 'claude', // headless agent CLI；阿里内网可设为 qodercli
};

const VALID_MODES = ['e2e', 'routing', 'generate', 'doc-quality', 'safety', 'coverage', 'comprehensive', 'baseline', 'pipeline', 'all'];

// full-runner 的 stage 规范顺序（与 scripts/e2e-real/full-runner.js 的
// DEFAULT_STAGES + EXTENDED_STAGES 保持一致）。仅用于把展开后的 stages 排回正确顺序。
const STAGE_ORDER = [
  'auth', 'app', 'form', 'page', 'data', 'permission', 'share', 'report', 'dashboard',
  'export', 'import', 'batch', 'task', 'offline', 'connector-local', 'skill-coverage',
  'ai', 'process', 'integration', 'connector-real',
];

// 每个 stage 运行前在 full-runner 里依赖的上游 stage：
// - 上游 stage 会写入 context.appType / formUuid / fields 等,下游 stage 直接引用;
// - 同时保证护栏要求的 login 校验(auth)在任何建资源命令之前发生。
// 若只跑某个下游 stage 而不带上游,会出现空 appId 之类的失败。
const STAGE_PREREQUISITES = {
  app: ['auth'],
  form: ['auth', 'app'],
  page: ['auth', 'app'],
  data: ['auth', 'app', 'form'],
  permission: ['auth', 'app', 'form'],
  share: ['auth', 'app', 'page'],
  report: ['auth', 'app', 'form'],
  dashboard: ['auth', 'app'],
  process: ['auth', 'app', 'form'],
};

/**
 * 把目标 stages 展开为「上游依赖 + 目标」的完整有序列表(去重、按规范顺序)。
 * 例如 ['dashboard'] → ['auth','app','dashboard']；['report'] → ['auth','app','form','report']。
 */
function expandStages(stages = []) {
  const set = new Set();
  const add = (stage) => {
    if (set.has(stage)) {return;}
    for (const dep of STAGE_PREREQUISITES[stage] || []) {add(dep);}
    set.add(stage);
  };
  for (const s of stages) {add(s);}
  return [...set].sort((a, b) => {
    const ia = STAGE_ORDER.indexOf(a);
    const ib = STAGE_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}

/**
 * 把布尔型字符串解析为布尔值，无法识别时返回 fallback。
 */
function toBool(value, fallback) {
  if (value === undefined || value === null || value === '') {return fallback;}
  if (typeof value === 'boolean') {return value;}
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {return true;}
  if (['0', 'false', 'no', 'off'].includes(normalized)) {return false;}
  return fallback;
}

/**
 * 反查某子技能对应的真实 E2E stages。
 * @returns {{ok:boolean, skill:string, level:string|null, stages:string[], reason:string|null}}
 */
function mapSkillToStages(skillName, coverage = SKILL_COVERAGE) {
  const entry = coverage[skillName];
  if (!entry) {
    const known = Object.keys(coverage).sort();
    throw new Error(
      `未知子技能 "${skillName}"。可选：${known.join(', ')}`,
    );
  }
  const stages = Array.isArray(entry.stages) ? entry.stages.filter(Boolean) : [];
  const isRealE2e = entry.level === 'real-e2e' || entry.level === 'opt-in-real-e2e';
  if (!isRealE2e || stages.length === 0) {
    return {
      ok: false,
      skill: skillName,
      level: entry.level || null,
      stages,
      reason:
        entry.reason
        || `子技能 "${skillName}" 的覆盖级别为 "${entry.level}"，没有可跑的真实 E2E stages；`
          + '请用 --mode routing 做路由测评，或参考其单测覆盖。',
    };
  }
  return { ok: true, skill: skillName, level: entry.level, stages, reason: null };
}

/**
 * 解析 CLI 参数（仅识别 harness 自有 flag，其余原样保留到 rest）。
 */
function parseArgs(argv = []) {
  const out = { rest: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const takeValue = () => {
      const inline = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : null;
      if (inline !== null) {return inline;}
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {return '';}
      i += 1;
      return next;
    };
    if (arg === '--mode' || arg.startsWith('--mode=')) {
      out.mode = takeValue();
    } else if (arg === '--skill' || arg.startsWith('--skill=')) {
      out.skill = takeValue();
    } else if (arg === '--stages' || arg.startsWith('--stages=')) {
      out.stages = takeValue();
    } else if (arg === '--scenarios' || arg.startsWith('--scenarios=')) {
      out.scenariosDir = takeValue();
    } else if (arg === '--gen-scenarios' || arg.startsWith('--gen-scenarios=')) {
      out.generationScenarios = takeValue();
    } else if (arg === '--agent-cmd' || arg.startsWith('--agent-cmd=')) {
      out.agentCommand = takeValue();
    } else if (arg === '--gen-timeout-ms' || arg.startsWith('--gen-timeout-ms=')) {
      out.generationTimeoutMs = parseInt(takeValue(), 10) || DEFAULTS.generationTimeoutMs;
    } else if (arg === '--screenshot') {
      out.screenshot = true;
    } else if (arg === '--no-screenshot') {
      out.screenshot = false;
    } else if (arg === '--runs' || arg.startsWith('--runs=')) {
      out.runs = parseInt(takeValue(), 10) || 1;
    } else if (arg === '--auto-score') {
      out.autoScore = true;
    } else if (arg === '--no-auto-score') {
      out.autoScore = false;
    } else if (arg === '--baseline') {
      out.baseline = true;
    } else if (arg === '--no-baseline') {
      out.baseline = false;
    } else if (arg === '--fix') {
      out.fix = true;
    } else if (arg === '--parallel') {
      out.parallel = true;
    } else if (arg === '--no-parallel') {
      out.parallel = false;
    } else if (arg === '--batch-size' || arg.startsWith('--batch-size=')) {
      out.batchSize = parseInt(takeValue(), 10) || 5;
    } else if (arg === '--concurrency' || arg.startsWith('--concurrency=')) {
      out.concurrency = parseInt(takeValue(), 10) || 4;
    } else if (arg === '--no-cache') {
      out.useCache = false;
    } else if (arg === '--format' || arg.startsWith('--format=')) {
      const fmt = takeValue();
      if (!out.formats) { out.formats = []; }
      out.formats.push(fmt);
    } else {
      out.rest.push(arg);
    }
  }
  return out;
}

/**
 * 读取 eval.config.json（缺失则返回空对象）。
 */
function readFileConfig(configFile = DEFAULT_CONFIG_FILE) {
  try {
    if (!fs.existsSync(configFile)) {return {};}
    const raw = fs.readFileSync(configFile, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`无法解析 eval 配置文件 ${configFile}: ${error.message}`);
  }
}

/**
 * 从环境变量读取 harness 配置（不含 OPENYIDA_E2E_* 链路自身的变量）。
 */
function readEnvConfig(env = process.env) {
  const cfg = {};
  if (env.OPENYIDA_EVAL_MODE) {cfg.mode = env.OPENYIDA_EVAL_MODE;}
  if (env.OPENYIDA_EVAL_SKILL) {cfg.skill = env.OPENYIDA_EVAL_SKILL;}
  if (env.OPENYIDA_EVAL_STAGES) {cfg.stages = env.OPENYIDA_EVAL_STAGES;}
  if (env.OPENYIDA_EVAL_SCENARIOS) {cfg.scenariosDir = env.OPENYIDA_EVAL_SCENARIOS;}
  if (env.OPENYIDA_EVAL_GEN_SCENARIOS) {cfg.generationScenarios = env.OPENYIDA_EVAL_GEN_SCENARIOS;}
  if (env.OPENYIDA_EVAL_AGENT_CMD) {cfg.agentCommand = env.OPENYIDA_EVAL_AGENT_CMD;}
  if (env.OPENYIDA_EVAL_GEN_TIMEOUT_MS) {
    cfg.generationTimeoutMs = parseInt(env.OPENYIDA_EVAL_GEN_TIMEOUT_MS, 10) || DEFAULTS.generationTimeoutMs;
  }
  if (env.OPENYIDA_EVAL_SCREENSHOT !== undefined) {
    cfg.screenshot = toBool(env.OPENYIDA_EVAL_SCREENSHOT, undefined);
  }
  if (env.OPENYIDA_EVAL_AUTO_SCORE !== undefined) {
    cfg.autoScore = toBool(env.OPENYIDA_EVAL_AUTO_SCORE, undefined);
  }
  return cfg;
}

/**
 * 合并三层配置并校验，产出 runner 可直接消费的最终配置。
 * @param {object} options
 * @param {string[]} [options.argv]
 * @param {object} [options.env]
 * @param {string} [options.configFile]
 * @param {object} [options.coverage]
 */
function resolveConfig(options = {}) {
  const env = options.env || process.env;
  const cli = parseArgs(options.argv || []);
  const file = options.fileConfig || readFileConfig(options.configFile);
  const fromEnv = readEnvConfig(env);
  const coverage = options.coverage || SKILL_COVERAGE;

  // 逐字段按优先级 pick：CLI > env > file > 默认
  const pick = (key) => {
    if (cli[key] !== undefined) {return cli[key];}
    if (fromEnv[key] !== undefined) {return fromEnv[key];}
    if (file[key] !== undefined) {return file[key];}
    return DEFAULTS[key];
  };

  const config = {
    mode: pick('mode'),
    skill: pick('skill') || null,
    stages: pick('stages') || null,
    runs: parseInt(pick('runs'), 10) || 1,
    screenshot: toBool(pick('screenshot'), DEFAULTS.screenshot),
    autoScore: toBool(pick('autoScore'), DEFAULTS.autoScore),
    scenariosDir: pick('scenariosDir'),
    generationScenarios: pick('generationScenarios'),
    generationTimeoutMs: parseInt(pick('generationTimeoutMs'), 10) || DEFAULTS.generationTimeoutMs,
    agentCommand: pick('agentCommand') || DEFAULTS.agentCommand,
    // 并行/批量/缓存与产物开关：此前遗漏未透传，导致 --parallel/--batch-size/
    // --concurrency/--no-cache/--fix/--format/--baseline 被静默忽略（评测退化为串行）。
    parallel: pick('parallel'),
    batchSize: pick('batchSize'),
    concurrency: pick('concurrency'),
    useCache: pick('useCache'),
    fix: pick('fix'),
    baseline: pick('baseline'),
    formats: pick('formats'),
    rest: cli.rest,
  };

  if (!VALID_MODES.includes(config.mode)) {
    throw new Error(`未知 --mode "${config.mode}"，可选：${VALID_MODES.join(', ')}`);
  }

  // skill → stages 反查（仅在需要跑 e2e 链路时生效；routing / generate / doc-quality / coverage 不按 stage 过滤）
  config.skillMapping = null;
  if (config.skill && (config.mode === 'e2e' || config.mode === 'all')) {
    config.skillMapping = mapSkillToStages(config.skill, coverage);
  }

  // 计算最终注入给 full-runner 的 OPENYIDA_E2E_STAGES
  // 优先级：显式 --stages > skill 反查 > 不设置（用 full-runner 默认全 stages）
  // 注意：skill 反查的 stages 会自动展开上游依赖（如 dashboard → auth,app,dashboard），
  // 否则下游 stage 拿不到 appId/formUuid 会失败；显式 --stages 视为用户已自行决定，不展开。
  if (config.stages) {
    config.resolvedStages = config.stages;
  } else if (config.skillMapping && config.skillMapping.ok) {
    config.targetStages = config.skillMapping.stages;
    config.resolvedStages = expandStages(config.skillMapping.stages).join(',');
  } else {
    config.resolvedStages = null;
  }

  return config;
}

/**
 * 基于最终配置，构造传给 full-runner 的环境变量覆盖。
 */
function buildE2eEnv(config, baseEnv = process.env) {
  const env = { ...baseEnv };
  if (config.resolvedStages) {
    env.OPENYIDA_E2E_STAGES = config.resolvedStages;
  }
  return env;
}

module.exports = {
  DEFAULTS,
  VALID_MODES,
  DEFAULT_CONFIG_FILE,
  DEFAULT_SCENARIOS_DIR,
  DEFAULT_GENERATION_DIR,
  toBool,
  mapSkillToStages,
  expandStages,
  STAGE_PREREQUISITES,
  parseArgs,
  readFileConfig,
  readEnvConfig,
  resolveConfig,
  buildE2eEnv,
};
