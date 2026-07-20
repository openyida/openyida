'use strict';

/**
 * Declarative YAML evaluation case loader.
 *
 * Ported from skill-up's eval.yaml + cases/*.yaml architecture (Go → CommonJS).
 *
 * Supports:
 *   - eval.yaml: global config (engine, judge, benchmark, cases dir)
 *   - cases/*.yaml: individual test cases with per-case judge overrides
 *   - Backward-compatible with existing JSON scenario files
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// ---------------------------------------------------------------------------
// Schema version
// ---------------------------------------------------------------------------

const SCHEMA_VERSION = 'v1';

// ---------------------------------------------------------------------------
// eval.yaml loader
// ---------------------------------------------------------------------------

function loadEvalConfig(evalYamlPath) {
  if (!evalYamlPath || !fs.existsSync(evalYamlPath)) {
    return null;
  }

  const content = fs.readFileSync(evalYamlPath, 'utf8');
  let config;
  try {
    config = yaml.load(content);
  } catch (err) {
    throw new Error('Failed to parse eval.yaml: ' + err.message);
  }

  if (!config || typeof config !== 'object') {
    throw new Error('eval.yaml must be a YAML mapping');
  }

  return normalizeEvalConfig(config);
}

function normalizeEvalConfig(raw) {
  const cfg = {
    schema_version: raw.schema_version || SCHEMA_VERSION,
    engine: normalizeEngine(raw.engine),
    judge: normalizeJudge(raw.judge),
    benchmark: normalizeBenchmark(raw.benchmark),
    cases: normalizeCasesConfig(raw.cases),
    environment: raw.environment || { type: 'none' },
    mcp: raw.mcp || null,
    skills: raw.skills || null,
    report: raw.report || null,
  };
  return cfg;
}

function normalizeEngine(engine) {
  if (!engine) { return { name: 'claude' }; }
  return {
    name: engine.name || 'claude',
    model: engine.model || null,
    timeout_seconds: engine.timeout_seconds || null,
    max_turns: engine.max_turns || null,
  };
}

function normalizeJudge(judge) {
  if (!judge) { return { type: 'rule_based' }; }
  return {
    type: judge.type || 'rule_based',
    model: judge.model || null,
    criteria: judge.criteria || null,
    pass_threshold: judge.pass_threshold || null,
    timeout_seconds: judge.timeout_seconds || null,
    script_path: judge.script_path || null,
    success: judge.success || [],
    failure: judge.failure || [],
  };
}

function normalizeBenchmark(bm) {
  if (!bm) { return { enabled: false }; }
  return { enabled: !!bm.enabled };
}

function normalizeCasesConfig(cases) {
  if (!cases) { return { dir: 'cases', parallelism: 1 }; }
  return {
    dir: cases.dir || 'cases',
    files: cases.files || null,
    parallelism: cases.parallelism || 1,
  };
}

// ---------------------------------------------------------------------------
// Case YAML loader
// ---------------------------------------------------------------------------

function loadCase(casePath) {
  if (!casePath || !fs.existsSync(casePath)) {
    return null;
  }

  const content = fs.readFileSync(casePath, 'utf8');
  let raw;
  try {
    raw = yaml.load(content);
  } catch (err) {
    throw new Error('Failed to parse case YAML ' + casePath + ': ' + err.message);
  }

  if (!raw || typeof raw !== 'object') {
    throw new Error('Case YAML must be a mapping: ' + casePath);
  }

  return normalizeCase(raw, casePath);
}

function normalizeCase(raw, filePath) {
  const id = raw.id || path.basename(filePath || '', '.yaml');
  return {
    id: id,
    title: raw.title || id,
    tags: raw.tags || [],
    input: normalizeInput(raw.input),
    context: raw.context || null,
    constraints: normalizeConstraints(raw.constraints),
    expect: normalizeExpect(raw.expect),
    judge: raw.judge ? normalizeJudge(raw.judge) : null,
    collect_artifacts: raw.collect_artifacts || null,
    retry: normalizeRetry(raw.retry),
  };
}

function normalizeInput(input) {
  if (!input) { return { prompt: '', turns: null }; }
  if (typeof input === 'string') { return { prompt: input, turns: null }; }
  return {
    prompt: input.prompt || '',
    turns: input.turns || null,
  };
}

function normalizeConstraints(c) {
  if (!c) { return { timeout_seconds: 300, max_turns: 50 }; }
  return {
    timeout_seconds: c.timeout_seconds || 300,
    max_turns: c.max_turns || 50,
  };
}

function normalizeExpect(expect) {
  if (!expect) { return null; }
  return {
    must_contain: expect.must_contain || null,
    must_not_contain: expect.must_not_contain || null,
    exit_code: expect.exit_code !== undefined ? expect.exit_code : null,
    files_exist: expect.files_exist || null,
    file_contains: expect.file_contains || null,
    golden_file: expect.golden_file || null,
  };
}

function normalizeRetry(retry) {
  if (!retry) { return { max_retries: 0, retry_on: ['error'] }; }
  return {
    max_retries: retry.max_retries || 0,
    retry_on: retry.retry_on || ['error'],
  };
}

// ---------------------------------------------------------------------------
// Load all cases from a directory
// ---------------------------------------------------------------------------

function loadCases(casesDir) {
  if (!casesDir || !fs.existsSync(casesDir)) { return []; }

  let files;
  try {
    files = fs.readdirSync(casesDir)
      .filter(function (f) { return f.endsWith('.yaml') || f.endsWith('.yml'); })
      .sort();
  } catch (_e) {
    return [];
  }

  const cases = [];
  for (let i = 0; i < files.length; i++) {
    const c = loadCase(path.join(casesDir, files[i]));
    if (c) { cases.push(c); }
  }
  return cases;
}

// ---------------------------------------------------------------------------
// Load full evaluation suite (eval.yaml + cases)
// ---------------------------------------------------------------------------

function loadEvalSuite(evalYamlPath) {
  const config = loadEvalConfig(evalYamlPath);
  if (!config) {
    return null;
  }

  const evalDir = path.dirname(evalYamlPath);
  const casesDir = path.resolve(evalDir, config.cases.dir);
  const cases = loadCases(casesDir);

  return {
    config: config,
    cases: cases,
    evalDir: evalDir,
    casesDir: casesDir,
  };
}

// ---------------------------------------------------------------------------
// Convert existing JSON scenarios to YAML case format
// ---------------------------------------------------------------------------

function jsonScenarioToCase(scenario) {
  const success = [];

  // Map expectedSkill to output_contains
  if (scenario.expectedSkill) {
    success.push({
      output_contains: { all: [scenario.expectedSkill] },
    });
  }

  // Map mustNotTrigger
  const failure = [];
  if (scenario.mustNotTrigger) {
    failure.push({
      output_contains: { all: [scenario.mustNotTrigger] },
    });
  }

  return {
    id: scenario.id || 'scenario-' + Math.random().toString(36).slice(2, 8),
    title: scenario.title || scenario.prompt || scenario.id || '',
    tags: scenario.tags || [],
    input: { prompt: scenario.prompt || '' },
    judge: {
      type: 'rule_based',
      success: success,
      failure: failure,
    },
    expect: {
      must_contain: scenario.expectedSkill ? [scenario.expectedSkill] : null,
    },
    // Preserve original scenario fields for backward compatibility
    _original: scenario,
  };
}

function loadJsonScenarios(dir) {
  if (!dir || !fs.existsSync(dir)) { return []; }

  let files;
  try {
    files = fs.readdirSync(dir)
      .filter(function (f) { return f.endsWith('.json'); })
      .sort();
  } catch (_e) {
    return [];
  }

  const cases = [];
  for (let i = 0; i < files.length; i++) {
    try {
      const content = fs.readFileSync(path.join(dir, files[i]), 'utf8');
      const scenarios = JSON.parse(content);
      if (Array.isArray(scenarios)) {
        for (let j = 0; j < scenarios.length; j++) {
          cases.push(jsonScenarioToCase(scenarios[j]));
        }
      } else if (scenarios && typeof scenarios === 'object') {
        cases.push(jsonScenarioToCase(scenarios));
      }
    } catch (_e) {
      // skip invalid files
    }
  }
  return cases;
}

// ---------------------------------------------------------------------------
// Generate eval.yaml template
// ---------------------------------------------------------------------------

function generateEvalTemplate(options) {
  const opts = options || {};
  return [
    '# OpenYida Eval Configuration',
    '# Generated by openyida eval system',
    'schema_version: v1',
    '',
    'engine:',
    '  name: ' + (opts.engine || 'claude'),
    opts.model ? '  model: ' + opts.model : '  # model: claude-sonnet-4-20250514',
    '',
    'judge:',
    '  type: rule_based',
    '',
    'benchmark:',
    '  enabled: ' + (opts.baseline ? 'true' : 'false'),
    '',
    'cases:',
    '  dir: cases/',
    '  parallelism: ' + (opts.parallelism || 1),
    '',
  ].join('\n');
}

function generateCaseTemplate(options) {
  const opts = options || {};
  return [
    '# Test case: ' + (opts.title || 'example'),
    'id: ' + (opts.id || 'example-case'),
    'title: ' + (opts.title || 'Example test case'),
    '',
    'input:',
    '  prompt: "' + (opts.prompt || 'describe your test prompt here') + '"',
    '',
    'judge:',
    '  type: rule_based',
    '  success:',
    '    - output_contains:',
    '        all: ["expected_keyword"]',
    '',
    'expect:',
    '  must_contain:',
    '    - expected_keyword',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Validate eval config
// ---------------------------------------------------------------------------

function validateEvalConfig(config) {
  const errors = [];

  if (!config) {
    errors.push('config is null');
    return { valid: false, errors: errors };
  }

  const validEngines = ['claude', 'qodercli', 'custom'];
  if (config.engine && validEngines.indexOf(config.engine.name) === -1) {
    errors.push('unknown engine: ' + config.engine.name);
  }

  const validJudgeTypes = ['rule_based', 'script', 'agent_judge'];
  if (config.judge && validJudgeTypes.indexOf(config.judge.type) === -1) {
    errors.push('unknown judge type: ' + config.judge.type);
  }

  if (config.judge && config.judge.type === 'script' && !config.judge.script_path) {
    errors.push('script judge requires script_path');
  }

  return { valid: errors.length === 0, errors: errors };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  SCHEMA_VERSION: SCHEMA_VERSION,
  loadEvalConfig: loadEvalConfig,
  loadCase: loadCase,
  loadCases: loadCases,
  loadEvalSuite: loadEvalSuite,
  loadJsonScenarios: loadJsonScenarios,
  jsonScenarioToCase: jsonScenarioToCase,
  generateEvalTemplate: generateEvalTemplate,
  generateCaseTemplate: generateCaseTemplate,
  validateEvalConfig: validateEvalConfig,
  mergeJudgeConfig: normalizeJudge,
};
