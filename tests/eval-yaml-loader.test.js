'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

const yamlLoader = require('../scripts/eval/yaml-loader');

describe('yaml-loader module', function () {
  let tmpDir;

  beforeEach(function () {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yaml-loader-test-'));
  });

  afterEach(function () {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // -----------------------------------------------------------------------
  // loadEvalConfig
  // -----------------------------------------------------------------------

  describe('loadEvalConfig', function () {
    it('should load and normalize a valid eval.yaml', function () {
      const evalYaml = [
        'schema_version: v1',
        'engine:',
        '  name: claude',
        '  model: claude-sonnet-4-20250514',
        'judge:',
        '  type: rule_based',
        'benchmark:',
        '  enabled: true',
        'cases:',
        '  dir: cases/',
        '  parallelism: 4',
      ].join('\n');

      const evalPath = path.join(tmpDir, 'eval.yaml');
      fs.writeFileSync(evalPath, evalYaml, 'utf8');

      const config = yamlLoader.loadEvalConfig(evalPath);
      expect(config.schema_version).toBe('v1');
      expect(config.engine.name).toBe('claude');
      expect(config.engine.model).toBe('claude-sonnet-4-20250514');
      expect(config.judge.type).toBe('rule_based');
      expect(config.benchmark.enabled).toBe(true);
      expect(config.cases.dir).toBe('cases/');
      expect(config.cases.parallelism).toBe(4);
    });

    it('should return null for non-existent file', function () {
      const result = yamlLoader.loadEvalConfig('/nonexistent/path.yaml');
      expect(result).toBe(null);
    });

    it('should apply defaults for missing fields', function () {
      const evalPath = path.join(tmpDir, 'eval.yaml');
      fs.writeFileSync(evalPath, 'schema_version: v1\n', 'utf8');

      const config = yamlLoader.loadEvalConfig(evalPath);
      expect(config.engine.name).toBe('claude');
      expect(config.judge.type).toBe('rule_based');
      expect(config.benchmark.enabled).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // loadCase
  // -----------------------------------------------------------------------

  describe('loadCase', function () {
    it('should load and normalize a case YAML', function () {
      const caseYaml = [
        'id: routing-basic',
        'title: Basic routing test',
        'tags:',
        '  - routing',
        '  - smoke',
        'input:',
        '  prompt: "Create a form app"',
        'judge:',
        '  type: rule_based',
        '  success:',
        '    - output_contains:',
        '        all: ["openyida", "create"]',
        'expect:',
        '  must_contain:',
        '    - openyida',
        'retry:',
        '  max_retries: 2',
        '  retry_on:',
        '    - error',
        '    - timeout',
      ].join('\n');

      const casePath = path.join(tmpDir, 'routing-basic.yaml');
      fs.writeFileSync(casePath, caseYaml, 'utf8');

      const c = yamlLoader.loadCase(casePath);
      expect(c.id).toBe('routing-basic');
      expect(c.title).toBe('Basic routing test');
      expect(c.tags).toEqual(['routing', 'smoke']);
      expect(c.input.prompt).toBe('Create a form app');
      expect(c.judge.type).toBe('rule_based');
      expect(c.judge.success).toHaveLength(1);
      expect(c.expect.must_contain).toEqual(['openyida']);
      expect(c.retry.max_retries).toBe(2);
      expect(c.retry.retry_on).toEqual(['error', 'timeout']);
    });

    it('should derive id from filename when id is missing', function () {
      const casePath = path.join(tmpDir, 'my-test-case.yaml');
      fs.writeFileSync(casePath, 'title: My Test\ninput:\n  prompt: "test"\n', 'utf8');

      const c = yamlLoader.loadCase(casePath);
      expect(c.id).toBe('my-test-case');
    });

    it('should return null for non-existent file', function () {
      expect(yamlLoader.loadCase('/nonexistent.yaml')).toBe(null);
    });
  });

  // -----------------------------------------------------------------------
  // loadCases
  // -----------------------------------------------------------------------

  describe('loadCases', function () {
    it('should load all YAML files from a directory', function () {
      const casesDir = path.join(tmpDir, 'cases');
      fs.mkdirSync(casesDir);
      fs.writeFileSync(path.join(casesDir, 'a.yaml'), 'id: a\ninput:\n  prompt: "test a"\n', 'utf8');
      fs.writeFileSync(path.join(casesDir, 'b.yml'), 'id: b\ninput:\n  prompt: "test b"\n', 'utf8');
      fs.writeFileSync(path.join(casesDir, 'c.json'), '{}', 'utf8');

      const cases = yamlLoader.loadCases(casesDir);
      expect(cases).toHaveLength(2);
      expect(cases[0].id).toBe('a');
      expect(cases[1].id).toBe('b');
    });

    it('should return empty array for non-existent directory', function () {
      expect(yamlLoader.loadCases('/nonexistent')).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // loadEvalSuite
  // -----------------------------------------------------------------------

  describe('loadEvalSuite', function () {
    it('should load eval config with cases', function () {
      const evalDir = path.join(tmpDir, 'evals');
      const casesDir = path.join(evalDir, 'cases');
      fs.mkdirSync(casesDir, { recursive: true });

      fs.writeFileSync(path.join(evalDir, 'eval.yaml'),
        'schema_version: v1\ncases:\n  dir: cases/\n', 'utf8');
      fs.writeFileSync(path.join(casesDir, 'test.yaml'),
        'id: test\ninput:\n  prompt: hello\n', 'utf8');

      const suite = yamlLoader.loadEvalSuite(path.join(evalDir, 'eval.yaml'));
      expect(suite).not.toBe(null);
      expect(suite.config.schema_version).toBe('v1');
      expect(suite.cases).toHaveLength(1);
      expect(suite.cases[0].id).toBe('test');
    });
  });

  // -----------------------------------------------------------------------
  // jsonScenarioToCase
  // -----------------------------------------------------------------------

  describe('jsonScenarioToCase', function () {
    it('should convert JSON scenario to case format', function () {
      const scenario = {
        id: 'test-1',
        prompt: 'create a form',
        expectedSkill: 'yida-app',
      };
      const c = yamlLoader.jsonScenarioToCase(scenario);
      expect(c.id).toBe('test-1');
      expect(c.input.prompt).toBe('create a form');
      expect(c.judge.type).toBe('rule_based');
      expect(c.judge.success).toHaveLength(1);
      expect(c.expect.must_contain).toEqual(['yida-app']);
      expect(c._original).toBe(scenario);
    });
  });

  // -----------------------------------------------------------------------
  // validateEvalConfig
  // -----------------------------------------------------------------------

  describe('validateEvalConfig', function () {
    it('should validate a correct config', function () {
      const r = yamlLoader.validateEvalConfig({
        engine: { name: 'claude' },
        judge: { type: 'rule_based' },
      });
      expect(r.valid).toBe(true);
      expect(r.errors).toHaveLength(0);
    });

    it('should report unknown engine', function () {
      const r = yamlLoader.validateEvalConfig({
        engine: { name: 'unknown-engine' },
        judge: { type: 'rule_based' },
      });
      expect(r.valid).toBe(false);
      expect(r.errors[0]).toContain('unknown engine');
    });

    it('should report script judge without script_path', function () {
      const r = yamlLoader.validateEvalConfig({
        engine: { name: 'claude' },
        judge: { type: 'script' },
      });
      expect(r.valid).toBe(false);
      expect(r.errors[0]).toContain('script_path');
    });
  });

  // -----------------------------------------------------------------------
  // Template generators
  // -----------------------------------------------------------------------

  describe('generateEvalTemplate', function () {
    it('should generate valid YAML', function () {
      const tpl = yamlLoader.generateEvalTemplate({ engine: 'qodercli', baseline: true });
      const parsed = yaml.load(tpl);
      expect(parsed.schema_version).toBe('v1');
      expect(parsed.engine.name).toBe('qodercli');
      expect(parsed.benchmark.enabled).toBe(true);
    });
  });

  describe('generateCaseTemplate', function () {
    it('should generate valid case YAML', function () {
      const tpl = yamlLoader.generateCaseTemplate({ id: 'my-case', title: 'My Case' });
      const parsed = yaml.load(tpl);
      expect(parsed.id).toBe('my-case');
      expect(parsed.title).toBe('My Case');
    });
  });
});
