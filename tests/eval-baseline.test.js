'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const baseline = require('../scripts/eval/baseline');

describe('baseline module', function () {
  // -----------------------------------------------------------------------
  // Statistics helpers
  // -----------------------------------------------------------------------

  describe('mean', function () {
    it('should compute arithmetic mean', function () {
      expect(baseline.mean([1, 2, 3, 4, 5])).toBe(3);
    });

    it('should return 0 for empty array', function () {
      expect(baseline.mean([])).toBe(0);
    });
  });

  describe('stdDev', function () {
    it('should compute population standard deviation', function () {
      const sd = baseline.stdDev([2, 4, 4, 4, 5, 5, 7, 9]);
      expect(sd).toBeCloseTo(2.0, 1);
    });

    it('should return 0 for single-element array', function () {
      expect(baseline.stdDev([42])).toBe(0);
    });
  });

  describe('statValue', function () {
    it('should compute min, max, mean, stddev', function () {
      const sv = baseline.statValue([10, 20, 30, 40, 50]);
      expect(sv.mean).toBe(30);
      expect(sv.min).toBe(10);
      expect(sv.max).toBe(50);
      expect(sv.stddev).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // Iteration workspace
  // -----------------------------------------------------------------------

  describe('nextIterationNumber', function () {
    let tmpDir;

    beforeEach(function () {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-iter-'));
    });

    afterEach(function () {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should return 1 for non-existent directory', function () {
      expect(baseline.nextIterationNumber('/nonexistent/path')).toBe(1);
    });

    it('should return next number after existing iterations', function () {
      fs.mkdirSync(path.join(tmpDir, 'iteration-1'));
      fs.mkdirSync(path.join(tmpDir, 'iteration-2'));
      fs.mkdirSync(path.join(tmpDir, 'iteration-5'));
      expect(baseline.nextIterationNumber(tmpDir)).toBe(6);
    });

    it('should ignore non-iteration directories', function () {
      fs.mkdirSync(path.join(tmpDir, 'iteration-3'));
      fs.mkdirSync(path.join(tmpDir, 'other-dir'));
      fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'hi', 'utf8');
      expect(baseline.nextIterationNumber(tmpDir)).toBe(4);
    });
  });

  describe('createIterationWorkspace', function () {
    let tmpDir;

    beforeEach(function () {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-ws-'));
    });

    afterEach(function () {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should create iteration directory structure', function () {
      const ws = baseline.createIterationWorkspace(tmpDir, 'test-skill', 1);
      expect(fs.existsSync(ws.iterationDir)).toBe(true);
      expect(ws.iterationDir).toContain('iteration-1');
      expect(ws.workspaceDir).toContain('test-skill-workspace');
    });
  });

  // -----------------------------------------------------------------------
  // Case execution
  // -----------------------------------------------------------------------

  describe('executeCase', function () {
    it('should execute with mock agent runner', function () {
      const mockAgent = function () {
        return { available: true, ok: true, text: 'openyida create done', json: null, error: null };
      };

      const testCase = {
        id: 'test-1',
        title: 'Test Case',
        input: { prompt: 'create an app' },
        expect: { must_contain: ['openyida'] },
        constraints: { timeout_seconds: 10 },
      };

      const result = baseline.executeCase(testCase, {
        runAgent: mockAgent,
        skillEnabled: true,
        skillContext: 'You are a skill assistant',
      });

      expect(result.caseId).toBe('test-1');
      expect(result.configuration).toBe('with_skill');
      expect(result.status).toBe('PASS');
      expect(result.agentAvailable).toBe(true);
    });

    it('should fail when expect keywords not found', function () {
      const mockAgent = function () {
        return { available: true, ok: true, text: 'did something else', json: null, error: null };
      };

      const testCase = {
        id: 'test-2',
        title: 'Fail Case',
        input: { prompt: 'test' },
        expect: { must_contain: ['specific-keyword'] },
      };

      const result = baseline.executeCase(testCase, { runAgent: mockAgent });
      expect(result.status).toBe('FAIL');
    });

    it('should mark as without_skill when skillEnabled is false', function () {
      const mockAgent = function () {
        return { available: true, ok: true, text: 'output', json: null, error: null };
      };

      const testCase = { id: 'test-3', input: { prompt: 'test' } };
      const result = baseline.executeCase(testCase, {
        runAgent: mockAgent,
        skillEnabled: false,
      });
      expect(result.configuration).toBe('without_skill');
    });
  });

  // -----------------------------------------------------------------------
  // Benchmark computation
  // -----------------------------------------------------------------------

  describe('computeBenchmark', function () {
    it('should compute simplified benchmark (without baseline)', function () {
      const withResults = [
        { durationMs: 1000, inputTokens: 100, outputTokens: 200, grading: { summary: { passRate: 1.0 } } },
        { durationMs: 2000, inputTokens: 150, outputTokens: 250, grading: { summary: { passRate: 0.5 } } },
      ];

      const bm = baseline.computeBenchmark('test-skill', withResults, null);
      expect(bm.metadata.skillName).toBe('test-skill');
      expect(bm.runSummary.withSkill.passRate.mean).toBeCloseTo(0.75, 2);
      expect(bm.runSummary.withoutSkill).toBe(null);
      expect(bm.runSummary.delta).toBe(null);
    });

    it('should compute full benchmark with delta', function () {
      const withResults = [
        { durationMs: 1000, inputTokens: 100, outputTokens: 200, grading: { summary: { passRate: 1.0 } } },
      ];
      const withoutResults = [
        { durationMs: 3000, inputTokens: 200, outputTokens: 400, grading: { summary: { passRate: 0.5 } } },
      ];

      const bm = baseline.computeBenchmark('test-skill', withResults, withoutResults);
      expect(bm.runSummary.withoutSkill).not.toBe(null);
      expect(bm.runSummary.delta).not.toBe(null);
      expect(bm.runSummary.delta.passRate).toBeCloseTo(0.5, 2);
      expect(bm.runSummary.delta.timeSeconds).toBeLessThan(0);
    });
  });

  describe('computeDimensionDelta', function () {
    it('should compute per-case delta', function () {
      const withResults = [
        { caseId: 'a', status: 'PASS', durationMs: 1000, grading: { summary: { passRate: 1.0 } } },
      ];
      const withoutResults = [
        { caseId: 'a', status: 'FAIL', durationMs: 2000, grading: { summary: { passRate: 0.0 } } },
      ];

      const delta = baseline.computeDimensionDelta(withResults, withoutResults);
      expect(delta).not.toBe(null);
      expect(delta.passRate.delta).toBe(1.0);
      expect(delta.passRate.improvement).toBe(true);
      expect(delta.perCase).toHaveLength(1);
      expect(delta.perCase[0].delta.passRate).toBe(1.0);
    });

    it('should return null when no baseline results', function () {
      expect(baseline.computeDimensionDelta([], null)).toBe(null);
      expect(baseline.computeDimensionDelta([], [])).toBe(null);
    });
  });

  // -----------------------------------------------------------------------
  // summarizeResults
  // -----------------------------------------------------------------------

  describe('summarizeResults', function () {
    it('should summarize pass/fail counts', function () {
      const results = [
        { status: 'PASS', durationMs: 100 },
        { status: 'PASS', durationMs: 200 },
        { status: 'FAIL', durationMs: 300 },
      ];
      const s = baseline.summarizeResults(results);
      expect(s.total).toBe(3);
      expect(s.passed).toBe(2);
      expect(s.failed).toBe(1);
      expect(s.passRate).toBeCloseTo(0.6667, 3);
      expect(s.avgDurationMs).toBe(200);
    });

    it('should handle empty results', function () {
      const s = baseline.summarizeResults([]);
      expect(s.total).toBe(0);
      expect(s.passRate).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // runBaselineEval (integration)
  // -----------------------------------------------------------------------

  describe('runBaselineEval', function () {
    it('should return error for empty cases', function () {
      const result = baseline.runBaselineEval({ cases: [], skillName: 'test' });
      expect(result.error).toBe('no cases to evaluate');
    });

    it('should run without baseline when disabled', function () {
      const callCount = { n: 0 };
      const mockAgent = function () {
        callCount.n++;
        return { available: true, ok: true, text: 'result text', json: null, error: null };
      };

      const cases = [
        { id: 'c1', title: 'Case 1', input: { prompt: 'test' } },
      ];

      const result = baseline.runBaselineEval({
        cases: cases,
        skillName: 'test',
        runAgent: mockAgent,
        baseline: false,
      });

      expect(result.withSkill).not.toBe(null);
      expect(result.withoutSkill).toBe(null);
      expect(result.benchmark.runSummary.delta).toBe(null);
      expect(callCount.n).toBe(1);
    });

    it('should run with baseline when enabled', function () {
      const callCount = { n: 0 };
      const mockAgent = function (opts) {
        callCount.n++;
        const hasSkill = opts.prompt && opts.prompt.indexOf('SKILL context') !== -1;
        return {
          available: true,
          ok: true,
          text: hasSkill ? 'skill-enhanced result' : 'basic result',
          json: null,
          error: null,
        };
      };

      const cases = [
        { id: 'c1', title: 'Case 1', input: { prompt: 'test prompt' } },
      ];

      const result = baseline.runBaselineEval({
        cases: cases,
        skillName: 'test',
        skillContext: 'SKILL context',
        runAgent: mockAgent,
        baseline: true,
      });

      expect(result.withSkill).not.toBe(null);
      expect(result.withoutSkill).not.toBe(null);
      expect(result.benchmark.runSummary.withoutSkill).not.toBe(null);
      expect(callCount.n).toBe(2);
    });
  });
});
