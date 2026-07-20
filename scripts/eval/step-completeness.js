#!/usr/bin/env node

'use strict';

/**
 * 步骤完整性评估器（D8 — 执行完整度）。
 *
 * 根据每个 skill 在 SKILL.md 中定义的必经步骤，
 * 检查 Agent 的实际 CLI 命令输出是否覆盖了全部步骤。
 * 步骤完成率必须为 100% 才能通过硬门禁。
 */

/**
 * 各技能的必经步骤及其检测正则。
 * key = 技能名，value = [{step, pattern}]
 */
const STEP_MARKERS = {
  'yida-app': [
    { step: 'login-check', pattern: /login\s+--check-only/ },
    { step: 'create-app', pattern: /create-app/ },
    { step: 'create-form', pattern: /create-form/ },
    { step: 'create-page', pattern: /create-page|update-page/ },
    { step: 'publish', pattern: /publish/ },
  ],
  'yida-create-process': [
    { step: 'login-check', pattern: /login\s+--check-only/ },
    { step: 'create-app', pattern: /create-app/ },
    { step: 'create-form', pattern: /create-form/ },
    { step: 'configure-process', pattern: /configure-process|process\s+configure/ },
  ],
  'yida-dashboard': [
    { step: 'login-check', pattern: /login\s+--check-only/ },
    { step: 'create-app', pattern: /create-app/ },
    { step: 'create-form', pattern: /create-form/ },
    { step: 'create-page', pattern: /create-page|update-page/ },
    { step: 'publish', pattern: /publish/ },
  ],
  'yida-report': [
    { step: 'login-check', pattern: /login\s+--check-only/ },
    { step: 'create-report', pattern: /create-report/ },
  ],
  'yida-connector': [
    { step: 'login-check', pattern: /login\s+--check-only/ },
    { step: 'create-connector', pattern: /connector\s+create/ },
  ],
  'yida-custom-page': [
    { step: 'create-page', pattern: /create-page/ },
    { step: 'write-jsx', pattern: /update-page|\.oyd\.jsx/ },
    { step: 'publish', pattern: /publish/ },
  ],
  'yida-publish-page': [
    { step: 'compile', pattern: /compile|publish/ },
    { step: 'publish', pattern: /publish/ },
  ],
  'yida-integration': [
    { step: 'login-check', pattern: /login\s+--check-only/ },
    { step: 'integration-create', pattern: /integration\s+create/ },
  ],
};

/**
 * 获取指定技能的必经步骤列表。
 * @param {string} skillName
 * @returns {Array<{step: string, pattern: RegExp}>}
 */
function getRequiredSteps(skillName) {
  return STEP_MARKERS[skillName] || [];
}

/**
 * 检查单个技能场景的步骤完成情况。
 * @param {string} skillName
 * @param {string[]} commands — 每条为完整 CLI 命令行字符串
 * @returns {{skill: string, total: number, completed: number, rate: number, missing: string[], steps: Array<{step: string, required: boolean, found: boolean}>}}
 */
function checkStepCompleteness(skillName, commands) {
  const markers = getRequiredSteps(skillName);
  const cmds = Array.isArray(commands) ? commands : [];

  // 未定义步骤标记的技能默认通过
  if (markers.length === 0) {
    return {
      skill: skillName,
      total: 0,
      completed: 0,
      rate: 1.0,
      missing: [],
      steps: [],
    };
  }

  const steps = markers.map(function (marker) {
    const found = cmds.some(function (cmd) {
      return marker.pattern.test(cmd);
    });
    return {
      step: marker.step,
      required: true,
      found: found,
    };
  });

  const completed = steps.filter(function (s) { return s.found; }).length;
  const total = steps.length;
  const missing = steps
    .filter(function (s) { return !s.found; })
    .map(function (s) { return s.step; });

  return {
    skill: skillName,
    total: total,
    completed: completed,
    rate: total > 0 ? completed / total : 1.0,
    missing: missing,
    steps: steps,
  };
}

/**
 * 批量运行步骤完整性评估。
 * @param {{scenarios: Array<{skill: string, commands: string[]}>}} options
 * @returns {{results: Array, summary: {total: number, fullCompletion: number, partialCompletion: number, noMarkers: number}}}
 */
function runStepCompletenessEval(options) {
  const scenarios = (options && Array.isArray(options.scenarios)) ? options.scenarios : [];

  const results = scenarios.map(function (scenario) {
    return checkStepCompleteness(scenario.skill, scenario.commands);
  });

  let fullCompletion = 0;
  let partialCompletion = 0;
  let noMarkers = 0;

  results.forEach(function (r) {
    if (r.total === 0) {
      noMarkers++;
    } else if (r.rate === 1.0) {
      fullCompletion++;
    } else {
      partialCompletion++;
    }
  });

  return {
    results: results,
    summary: {
      total: results.length,
      fullCompletion: fullCompletion,
      partialCompletion: partialCompletion,
      noMarkers: noMarkers,
    },
  };
}

module.exports = {
  STEP_MARKERS,
  getRequiredSteps,
  checkStepCompleteness,
  runStepCompletenessEval,
};
