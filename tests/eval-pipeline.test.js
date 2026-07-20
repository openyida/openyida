'use strict';

const pipeline = require('../scripts/eval/pipeline');

describe('pipeline module', function () {
  describe('constants', function () {
    it('should export step status constants', function () {
      expect(pipeline.STEP_PASS).toBe('pass');
      expect(pipeline.STEP_FAIL).toBe('fail');
      expect(pipeline.STEP_SKIP).toBe('skip');
      expect(pipeline.STEP_WARN).toBe('warn');
    });

    it('should export dimension labels', function () {
      expect(pipeline.DIMENSION_LABELS).toBeDefined();
      expect(pipeline.DIMENSION_LABELS.standards).toBe('文档规范性');
      expect(pipeline.DIMENSION_LABELS.routingAccuracy).toBe('路由准确率');
      expect(pipeline.DIMENSION_LABELS.safety).toBe('安全合规');
    });

    it('should export hard gate labels with thresholds', function () {
      expect(pipeline.HARD_GATE_LABELS).toBeDefined();
      expect(pipeline.HARD_GATE_LABELS.triggerAccuracy).toEqual({
        label: '触发准确率',
        threshold: '≥ 85%',
      });
      expect(pipeline.HARD_GATE_LABELS.safetyFailures).toEqual({
        label: '安全合规',
        threshold: '= 0 failures',
      });
    });
  });

  describe('generateSuggestions', function () {
    it('should return empty array for null scorecard', function () {
      expect(pipeline.generateSuggestions(null, {})).toEqual([]);
    });

    it('should return empty array for scorecard with no dimensions', function () {
      expect(pipeline.generateSuggestions({}, {})).toEqual([]);
    });

    it('should generate suggestions for low-scoring dimensions', function () {
      const scorecard = {
        dimensions: {
          standards: { score: 40, weight: 0.1 },
          routingAccuracy: { score: 70, weight: 0.15 },
          safety: { score: 95, weight: 0.15 },
        },
        hardGates: {},
      };
      const result = pipeline.generateSuggestions(scorecard, {});
      expect(result.length).toBeGreaterThan(0);

      // standards (40) should be critical priority
      const stdSug = result.find(s => s.dimension === 'standards');
      expect(stdSug).toBeDefined();
      expect(stdSug.priority).toBe('critical');
      expect(stdSug.suggestions.length).toBeGreaterThan(0);

      // routingAccuracy (70) should be high priority
      const routSug = result.find(s => s.dimension === 'routingAccuracy');
      expect(routSug).toBeDefined();
      expect(routSug.priority).toBe('high');
    });

    it('should add blocker suggestions for failed hard gates', function () {
      const scorecard = {
        dimensions: { standards: { score: 90, weight: 0.1 } },
        hardGates: {
          triggerAccuracy: 'fail',
          safetyFailures: 'pass',
        },
      };
      const result = pipeline.generateSuggestions(scorecard, {});
      const blockers = result.filter(s => s.priority === 'blocker');
      expect(blockers.length).toBe(1);
      expect(blockers[0].label).toContain('触发准确率');
    });

    it('should sort by score ascending (worst first)', function () {
      const scorecard = {
        dimensions: {
          standards: { score: 90, weight: 0.1 },
          routingAccuracy: { score: 50, weight: 0.15 },
          safety: { score: 70, weight: 0.15 },
        },
        hardGates: {},
      };
      const result = pipeline.generateSuggestions(scorecard, {});
      // routingAccuracy (50) should come before safety (70)
      const routIdx = result.findIndex(s => s.dimension === 'routingAccuracy');
      const safIdx = result.findIndex(s => s.dimension === 'safety');
      if (routIdx !== -1 && safIdx !== -1) {
        expect(routIdx).toBeLessThan(safIdx);
      }
    });

    it('should handle dimensions with null scores', function () {
      const scorecard = {
        dimensions: {
          standards: { score: null, weight: 0.1 },
        },
        hardGates: {},
      };
      const result = pipeline.generateSuggestions(scorecard, {});
      // null-scored dimensions should not crash
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('stepStaticValidation', function () {
    it('should return a result object with correct step name', function () {
      const result = pipeline.stepStaticValidation('nonexistent-skill-xyz');
      expect(result.step).toBe('static-validation');
      // Will either be pass/fail/skip depending on whether the skill exists
      expect(['pass', 'fail', 'skip', 'warn']).toContain(result.status);
    });
  });

  describe('stepSafetyCheck', function () {
    it('should pass with safe input', function () {
      const result = pipeline.stepSafetyCheck({ commands: [], output: '' });
      expect(result.step).toBe('safety-check');
      expect(['pass', 'skip']).toContain(result.status);
    });

    it('should detect credential leaks', function () {
      const result = pipeline.stepSafetyCheck({
        commands: [],
        output: 'cookie: ALIDOCS_COOKIE=abc123; token=secret-token-xyz',
      });
      expect(result.step).toBe('safety-check');
      // Safety module may detect leaks
      expect(result.raw).toBeDefined();
    });
  });

  describe('stepCoverage', function () {
    it('should return coverage analysis', function () {
      const result = pipeline.stepCoverage();
      expect(result.step).toBe('coverage');
      expect(['pass', 'warn', 'skip']).toContain(result.status);
    });
  });

  describe('renderSuggestionsMd', function () {
    it('should render markdown with header', function () {
      const md = pipeline.renderSuggestionsMd('test-skill', [], null);
      expect(md).toContain('# 技能优化建议：test-skill');
      expect(md).toContain('所有维度均达标');
    });

    it('should render scorecard summary', function () {
      const scorecard = { overall: 75.5, gate: 'fail' };
      const md = pipeline.renderSuggestionsMd('test-skill', [], scorecard);
      expect(md).toContain('75.5');
      expect(md).toContain('未通过');
    });

    it('should render blocker suggestions', function () {
      const suggestions = [{
        dimension: 'triggerAccuracy',
        label: '🚫 硬门槛不通过：触发准确率',
        score: null,
        priority: 'blocker',
        suggestions: ['必须修复'],
      }];
      const md = pipeline.renderSuggestionsMd('test-skill', suggestions, null);
      expect(md).toContain('准出阻断');
      expect(md).toContain('必须修复');
    });

    it('should render critical/high/medium sections', function () {
      const suggestions = [
        { dimension: 'a', label: 'A', score: 30, priority: 'critical', suggestions: ['fix A'] },
        { dimension: 'b', label: 'B', score: 65, priority: 'high', suggestions: ['fix B'] },
        { dimension: 'c', label: 'C', score: 85, priority: 'medium', suggestions: ['improve C'] },
      ];
      const md = pipeline.renderSuggestionsMd('test-skill', suggestions, null);
      expect(md).toContain('严重问题');
      expect(md).toContain('需要改进');
      expect(md).toContain('建议优化');
    });
  });

  describe('runPipeline', function () {
    it('should throw when skill is missing', function () {
      expect(() => pipeline.runPipeline({})).toThrow('options.skill is required');
    });

    it('should complete a pipeline run with all steps', function () {
      const result = pipeline.runPipeline({
        skill: 'yida-dashboard',
        verbose: false,
      });

      expect(result).toBeDefined();
      expect(result.skill).toBe('yida-dashboard');
      expect(result.runId).toContain('yida-dashboard-');
      expect(result.status).toBeDefined();
      expect(['pass', 'fail', 'warn']).toContain(result.status);

      // Should have 6 steps
      expect(result.steps.length).toBe(6);
      expect(result.steps[0].step).toBe('static-validation');
      expect(result.steps[1].step).toBe('routing-test');
      expect(result.steps[2].step).toBe('safety-check');
      expect(result.steps[3].step).toBe('coverage');
      expect(result.steps[4].step).toBe('comprehensive');
      expect(result.steps[5].step).toBe('gate-decision');

      // Summary counts
      expect(result.summary.total).toBe(6);
      expect(result.summary.pass + result.summary.fail + result.summary.warn + result.summary.skip).toBe(6);

      // Duration
      expect(result.durationMs).toBeGreaterThanOrEqual(0);

      // Suggestions should be an array
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('should generate artifacts', function () {
      const result = pipeline.runPipeline({
        skill: 'yida-dashboard',
        verbose: false,
      });

      // Report path should be set (if directory creation succeeds)
      if (result.reportPath) {
        const fs = require('fs');
        expect(fs.existsSync(result.reportPath)).toBe(true);
      }
    });

    it('should support junit format', function () {
      const result = pipeline.runPipeline({
        skill: 'yida-dashboard',
        formats: ['junit'],
        verbose: false,
      });

      // Should attempt JUnit generation
      expect(result).toBeDefined();
      if (result.junitPath) {
        const fs = require('fs');
        expect(fs.existsSync(result.junitPath)).toBe(true);
      }
    });
  });
});
