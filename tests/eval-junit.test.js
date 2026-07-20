'use strict';

const junit = require('../scripts/eval/junit');

describe('junit module', function () {
  describe('escapeXml', function () {
    it('should escape XML entities', function () {
      expect(junit.escapeXml('<tag attr="val">')).toBe('&lt;tag attr=&quot;val&quot;&gt;');
      expect(junit.escapeXml('a & b')).toBe('a &amp; b');
    });

    it('should handle null/undefined', function () {
      expect(junit.escapeXml(null)).toBe('');
      expect(junit.escapeXml(undefined)).toBe('');
    });
  });

  describe('renderJunitXml', function () {
    it('should render valid XML for passing results', function () {
      const xml = junit.renderJunitXml({
        suiteName: 'test-suite',
        results: [
          { caseId: 'case-1', status: 'PASS', durationMs: 1000, configuration: 'with_skill' },
          { caseId: 'case-2', status: 'PASS', durationMs: 2000, configuration: 'with_skill' },
        ],
      });

      expect(xml).toContain('<?xml version="1.0"');
      expect(xml).toContain('tests="2"');
      expect(xml).toContain('failures="0"');
      expect(xml).toContain('name="case-1"');
      expect(xml).toContain('name="case-2"');
    });

    it('should render failure details', function () {
      const xml = junit.renderJunitXml({
        suiteName: 'test-suite',
        results: [
          {
            caseId: 'fail-case',
            status: 'FAIL',
            durationMs: 500,
            configuration: 'with_skill',
            grading: {
              assertions: [
                { text: 'check output', passed: false, evidence: 'keyword missing' },
              ],
            },
          },
        ],
      });

      expect(xml).toContain('failures="1"');
      expect(xml).toContain('<failure');
      expect(xml).toContain('keyword missing');
    });

    it('should render error details', function () {
      const xml = junit.renderJunitXml({
        suiteName: 'test-suite',
        results: [
          {
            caseId: 'err-case',
            status: 'ERROR',
            durationMs: 0,
            configuration: 'with_skill',
            error: 'agent timeout',
          },
        ],
      });

      expect(xml).toContain('errors="1"');
      expect(xml).toContain('<error');
      expect(xml).toContain('agent timeout');
    });

    it('should render skipped tests', function () {
      const xml = junit.renderJunitXml({
        suiteName: 'test-suite',
        results: [
          {
            caseId: 'skip-case',
            status: 'SKIP',
            durationMs: 0,
            configuration: 'with_skill',
            grading: { skipReason: 'not applicable' },
          },
        ],
      });

      expect(xml).toContain('skipped="1"');
      expect(xml).toContain('<skipped');
    });

    it('should group results by configuration', function () {
      const xml = junit.renderJunitXml({
        suiteName: 'test-suite',
        results: [
          { caseId: 'c1', status: 'PASS', durationMs: 100, configuration: 'with_skill' },
          { caseId: 'c1', status: 'FAIL', durationMs: 200, configuration: 'without_skill' },
        ],
      });

      expect(xml).toContain('with_skill');
      expect(xml).toContain('without_skill');
      // Two testsuite elements
      const suiteCount = (xml.match(/<testsuite /g) || []).length;
      expect(suiteCount).toBe(2);
    });

    it('should include system-out with final message', function () {
      const xml = junit.renderJunitXml({
        suiteName: 'test',
        results: [
          {
            caseId: 'c1',
            status: 'PASS',
            durationMs: 100,
            configuration: 'default',
            finalMessage: 'hello world output',
          },
        ],
      });

      expect(xml).toContain('<system-out>');
      expect(xml).toContain('hello world output');
    });
  });
});
