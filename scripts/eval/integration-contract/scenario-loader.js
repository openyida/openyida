'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_SCENARIO_DIR = path.join(__dirname, '..', 'scenarios', 'integration-contract');

function listScenarioFiles(scenarioDir = DEFAULT_SCENARIO_DIR) {
  if (!fs.existsSync(scenarioDir)) {
    return [];
  }

  const files = [];
  function visit(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .sort(function (left, right) { return left.name.localeCompare(right.name); });
    entries.forEach(function (entry) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        files.push(entryPath);
      }
    });
  }

  visit(scenarioDir);
  return files;
}

function validatePublicScenario(scenario, filePath) {
  if (!scenario || typeof scenario !== 'object' || Array.isArray(scenario)) {
    throw new TypeError('integration contract scenario must be an object: ' + filePath);
  }
  if (typeof scenario.id !== 'string' || scenario.id.trim() === '') {
    throw new TypeError('integration contract scenario id is required: ' + filePath);
  }
  if (typeof scenario.publicPrompt !== 'string' || scenario.publicPrompt.trim() === '') {
    throw new TypeError('integration contract scenario publicPrompt is required: ' + filePath);
  }
  if (typeof scenario.title !== 'string' || scenario.title.trim() === '') {
    throw new TypeError('integration contract scenario title is required: ' + filePath);
  }
  ['requiredCapabilities', 'runtimeCases', 'protocolEvidence'].forEach(function (field) {
    if (!Array.isArray(scenario[field]) || scenario[field].length === 0) {
      throw new TypeError('integration contract scenario ' + field + ' must be a non-empty array: ' + filePath);
    }
  });
  if (scenario.requiredCapabilities.some(function (item) {
    return typeof item !== 'string' || item.trim() === '';
  })) {
    throw new TypeError(
      'integration contract scenario requiredCapabilities entries must be strings: ' + filePath
    );
  }
  ['runtimeCases', 'protocolEvidence'].forEach(function (field) {
    if (scenario[field].some(function (item) {
      return !item
        || typeof item !== 'object'
        || Array.isArray(item)
        || Object.keys(item).length === 0;
    })) {
      throw new TypeError(
        'integration contract scenario ' + field + ' entries must be objects: ' + filePath
      );
    }
  });
  if (!scenario.expectedResources
    || typeof scenario.expectedResources !== 'object'
    || Array.isArray(scenario.expectedResources)
    || Object.keys(scenario.expectedResources).length === 0) {
    throw new TypeError(
      'integration contract scenario expectedResources must be an object: ' + filePath
    );
  }
  return scenario;
}

function loadIntegrationScenarios(options = {}) {
  const scenarioDir = typeof options === 'string'
    ? options
    : (options.scenarioDir || DEFAULT_SCENARIO_DIR);
  const scenarios = [];

  listScenarioFiles(scenarioDir).forEach(function (filePath) {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const items = Array.isArray(parsed) ? parsed : [parsed];
    items.forEach(function (item) {
      const scenario = validatePublicScenario(item, filePath);
      scenarios.push(Object.assign({
        _file: path.relative(scenarioDir, filePath).replace(/\\/g, '/'),
      }, scenario));
    });
  });

  const seen = new Set();
  scenarios.forEach(function (scenario) {
    if (seen.has(scenario.id)) {
      throw new Error('duplicate integration contract scenario id: ' + scenario.id);
    }
    seen.add(scenario.id);
  });
  return scenarios;
}

function buildIntegrationBuilderPrompt(scenario) {
  validatePublicScenario(scenario, '<memory>');
  return [
    '你是 OpenYida 集成自动化定义构建器。',
    '只根据下面的公开业务需求生成 processJson 与 viewJson。',
    '不得访问网络、登录平台或创建线上资源。',
    '',
    scenario.title ? '场景：' + scenario.title : '',
    '需求：' + scenario.publicPrompt,
  ].filter(Boolean).join('\n');
}

module.exports = {
  DEFAULT_SCENARIO_DIR,
  buildIntegrationBuilderPrompt,
  listScenarioFiles,
  loadIntegrationScenarios,
  validatePublicScenario,
};
