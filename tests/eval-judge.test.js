'use strict';

const judge = require('../scripts/eval/judge');

describe('judge module', function () {
  // -----------------------------------------------------------------------
  // Result builders
  // -----------------------------------------------------------------------

  describe('buildResult', function () {
    it('should return PASS with empty assertions', function () {
      const r = judge.buildResult([], 1, 1);
      expect(r.status).toBe('PASS');
      expect(r.summary.passRate).toBe(1.0);
    });

    it('should return FAIL when assertions fail', function () {
      const assertions = [
        judge.assertion('test1', true, 'ok'),
        judge.assertion('test2', false, 'bad'),
      ];
      const r = judge.buildResult(assertions, 1, 1);
      expect(r.status).toBe('FAIL');
      expect(r.summary.passed).toBe(1);
      expect(r.summary.failed).toBe(1);
      expect(r.summary.passRate).toBe(0.5);
    });

    it('should return PASS when all assertions pass', function () {
      const assertions = [
        judge.assertion('a', true, 'ok'),
        judge.assertion('b', true, 'ok'),
      ];
      const r = judge.buildResult(assertions, 2, 2);
      expect(r.status).toBe('PASS');
      expect(r.summary.passRate).toBe(1.0);
      expect(r.turnsExecuted).toBe(2);
    });
  });

  describe('buildSkipResult', function () {
    it('should create SKIP result', function () {
      const r = judge.buildSkipResult('not applicable');
      expect(r.status).toBe('SKIP');
      expect(r.skipReason).toBe('not applicable');
    });
  });

  describe('buildErrorResult', function () {
    it('should create ERROR result from string', function () {
      const r = judge.buildErrorResult('something broke');
      expect(r.status).toBe('ERROR');
      expect(r.errorReason).toBe('something broke');
    });

    it('should create ERROR result from Error object', function () {
      const r = judge.buildErrorResult(new Error('oops'));
      expect(r.status).toBe('ERROR');
      expect(r.errorReason).toBe('oops');
    });
  });

  // -----------------------------------------------------------------------
  // Rule-based assertions
  // -----------------------------------------------------------------------

  describe('evalOutputContains', function () {
    it('should pass when all keywords present', function () {
      const r = judge.evalOutputContains(
        { all: ['hello', 'world'] },
        'hello wonderful world'
      );
      expect(r.passed).toBe(true);
    });

    it('should fail when keyword missing', function () {
      const r = judge.evalOutputContains(
        { all: ['hello', 'missing'] },
        'hello world'
      );
      expect(r.passed).toBe(false);
      expect(r.evidence).toContain('missing');
    });

    it('should pass any when at least one present', function () {
      const r = judge.evalOutputContains(
        { any: ['apple', 'banana'] },
        'I have a banana'
      );
      expect(r.passed).toBe(true);
    });

    it('should fail any when none present', function () {
      const r = judge.evalOutputContains(
        { any: ['apple', 'banana'] },
        'I have nothing'
      );
      expect(r.passed).toBe(false);
    });

    it('should fail when forbidden keyword present', function () {
      const r = judge.evalOutputContains(
        { not: ['error', 'fail'] },
        'there was an error'
      );
      expect(r.passed).toBe(false);
      expect(r.evidence).toContain('error');
    });

    it('should pass when no forbidden keywords present', function () {
      const r = judge.evalOutputContains(
        { not: ['error', 'fail'] },
        'success'
      );
      expect(r.passed).toBe(true);
    });
  });

  describe('evalExitCode', function () {
    it('should pass when exit codes match', function () {
      const r = judge.evalExitCode(0, 0);
      expect(r.passed).toBe(true);
    });

    it('should fail when exit codes differ', function () {
      const r = judge.evalExitCode(0, 1);
      expect(r.passed).toBe(false);
    });
  });

  describe('evalToolCalled', function () {
    it('should pass when tool was called', function () {
      const calls = [
        { name: 'Read', args: { file_path: '/foo' } },
        { name: 'Bash', args: { command: 'ls' } },
      ];
      const r = judge.evalToolCalled({ name: 'Bash' }, calls);
      expect(r.passed).toBe(true);
    });

    it('should fail when tool not called', function () {
      const calls = [{ name: 'Read', args: {} }];
      const r = judge.evalToolCalled({ name: 'Write' }, calls);
      expect(r.passed).toBe(false);
    });

    it('should check args when specified', function () {
      const calls = [{ name: 'Bash', args: { command: 'ls -la' } }];
      const r = judge.evalToolCalled({ name: 'Bash', args: { command: 'ls -la' } }, calls);
      expect(r.passed).toBe(true);

      const r2 = judge.evalToolCalled({ name: 'Bash', args: { command: 'rm -rf' } }, calls);
      expect(r2.passed).toBe(false);
    });
  });

  describe('evalCommandSequence', function () {
    it('should pass when all patterns match in order', function () {
      const commands = ['openyida login --check-only', 'openyida create app', 'openyida publish'];
      const r = judge.evalCommandSequence(['login', 'create', 'publish'], commands);
      expect(r.passed).toBe(true);
    });

    it('should fail when pattern missing', function () {
      const commands = ['openyida login', 'openyida create'];
      const r = judge.evalCommandSequence(['login', 'create', 'publish'], commands);
      expect(r.passed).toBe(false);
      expect(r.evidence).toContain('publish');
    });
  });

  describe('evalOutputMatches', function () {
    it('should pass when regex matches', function () {
      const r = judge.evalOutputMatches('app-\\w+', 'created app-abc123');
      expect(r.passed).toBe(true);
    });

    it('should fail when regex does not match', function () {
      const r = judge.evalOutputMatches('^ERROR', 'success');
      expect(r.passed).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Rule-based judge
  // -----------------------------------------------------------------------

  describe('ruleBasedEvaluate', function () {
    it('should fail immediately on failure rule match', function () {
      const cfg = {
        success: [{ output_contains: { all: ['ok'] } }],
        failure: [{ output_contains: { all: ['error'] } }],
      };
      const input = { finalMessage: 'error occurred but ok' };
      const r = judge.ruleBasedEvaluate(cfg, input);
      expect(r.status).toBe('FAIL');
      expect(r.assertions[0].text).toContain('failure');
    });

    it('should pass when success rules all pass and no failure rules match', function () {
      const cfg = {
        success: [
          { output_contains: { all: ['hello'] } },
          { exit_code: 0 },
        ],
        failure: [{ output_contains: { all: ['error'] } }],
      };
      const input = { finalMessage: 'hello world', exitCode: 0 };
      const r = judge.ruleBasedEvaluate(cfg, input);
      expect(r.status).toBe('PASS');
      expect(r.summary.passRate).toBe(1.0);
    });
  });

  // -----------------------------------------------------------------------
  // Judge factory
  // -----------------------------------------------------------------------

  describe('createJudge', function () {
    it('should create rule_based judge by default', function () {
      const j = judge.createJudge({ type: 'rule_based', success: [{ exit_code: 0 }] });
      expect(j.type).toBe('rule_based');
      const r = j.evaluate({ exitCode: 0 });
      expect(r.status).toBe('PASS');
    });

    it('should return error for unknown type', function () {
      const j = judge.createJudge({ type: 'unknown' });
      const r = j.evaluate({});
      expect(r.status).toBe('ERROR');
    });
  });

  describe('mergeJudgeConfig', function () {
    it('should return global when case has no type', function () {
      const global = { type: 'rule_based', model: 'gpt-4' };
      const result = judge.mergeJudgeConfig(global, {});
      expect(result.type).toBe('rule_based');
    });

    it('should use case config when it has a type', function () {
      const global = { type: 'rule_based', model: 'gpt-4' };
      const caseLevel = { type: 'agent_judge', criteria: 'be strict' };
      const result = judge.mergeJudgeConfig(global, caseLevel);
      expect(result.type).toBe('agent_judge');
      expect(result.model).toBe('gpt-4');
    });
  });
});
