'use strict';

const mod = require('../scripts/eval/efficiency');
const EFFICIENCY_DEFAULTS = mod.EFFICIENCY_DEFAULTS;
const analyzeEfficiency = mod.analyzeEfficiency;
const runEfficiencyEval = mod.runEfficiencyEval;

describe('EFFICIENCY_DEFAULTS', function () {
  test('contains expected baseline values', function () {
    expect(EFFICIENCY_DEFAULTS).toEqual({
      maxCommands: 20,
      maxTokens: 50000,
      maxTimeMs: 300000,
    });
  });
});

describe('analyzeEfficiency', function () {
  test('perfect score when all metrics well under baseline', function () {
    const result = analyzeEfficiency({
      commands: ['openyida login', 'openyida push'],
      tokens: 5000,
      timeMs: 30000,
    });

    expect(result.score).toBe(100);
    expect(result.commands).toBe(2);
    expect(result.tokens).toBe(5000);
    expect(result.timeMs).toBe(30000);
    expect(result.redundantCommands).toBe(0);
    expect(result.details.commandScore).toBe(100);
    expect(result.details.tokenScore).toBe(100);
    expect(result.details.timeScore).toBe(100);
  });

  test('lower score when commands exceed baseline', function () {
    const cmds = [];
    for (let i = 0; i < 40; i++) {
      cmds.push('cmd-' + i);
    }
    const result = analyzeEfficiency({
      commands: cmds,
      tokens: 5000,
      timeMs: 30000,
    });

    expect(result.score).toBeLessThan(100);
    expect(result.details.commandScore).toBeLessThan(100);
    // tokens and time are under baseline — still 100
    expect(result.details.tokenScore).toBe(100);
    expect(result.details.timeScore).toBe(100);
  });

  test('detects consecutive duplicate commands as redundant', function () {
    const result = analyzeEfficiency({
      commands: ['openyida login', 'openyida copy', 'openyida copy', 'openyida push'],
      tokens: 10000,
      timeMs: 60000,
    });

    expect(result.redundantCommands).toBe(1);
    expect(result.details.redundantCount).toBe(1);
  });

  test('non-consecutive duplicates are NOT redundant', function () {
    const result = analyzeEfficiency({
      commands: ['openyida copy', 'openyida login', 'openyida copy'],
      tokens: 10000,
      timeMs: 60000,
    });

    expect(result.redundantCommands).toBe(0);
  });

  test('handles null tokens gracefully (excludes from average)', function () {
    const result = analyzeEfficiency({
      commands: ['openyida login'],
      tokens: null,
      timeMs: 30000,
    });

    expect(result.tokens).toBeNull();
    expect(result.details.tokenScore).toBeNull();
    // Score should still be computed from commands + time only
    expect(result.score).toBe(100);
  });

  test('handles null timeMs gracefully', function () {
    const result = analyzeEfficiency({
      commands: ['openyida login'],
      tokens: 5000,
      timeMs: null,
    });

    expect(result.timeMs).toBeNull();
    expect(result.details.timeScore).toBeNull();
    expect(result.score).toBe(100);
  });

  test('custom baseline overrides defaults', function () {
    const result = analyzeEfficiency({
      commands: ['a', 'b', 'c', 'd', 'e'],
      tokens: 8000,
      timeMs: 60000,
      baseline: { maxCommands: 3, maxTokens: 50000, maxTimeMs: 300000 },
    });

    // 5 commands > maxCommands 3, so commandScore < 100
    expect(result.details.commandScore).toBeLessThan(100);
    // tokens and time under baseline
    expect(result.details.tokenScore).toBe(100);
    expect(result.details.timeScore).toBe(100);
    expect(result.score).toBeLessThan(100);
  });

  test('empty commands array scores well', function () {
    const result = analyzeEfficiency({
      commands: [],
      tokens: 1000,
      timeMs: 5000,
    });

    expect(result.commands).toBe(0);
    expect(result.redundantCommands).toBe(0);
    expect(result.details.commandScore).toBe(100);
    expect(result.score).toBe(100);
  });
});

describe('runEfficiencyEval', function () {
  test('applies defaults and returns same shape as analyzeEfficiency', function () {
    const result = runEfficiencyEval({
      commands: ['openyida login', 'openyida gen --skill form', 'openyida push'],
      tokens: 25000,
      timeMs: 150000,
    });

    expect(result).toHaveProperty('commands');
    expect(result).toHaveProperty('tokens');
    expect(result).toHaveProperty('timeMs');
    expect(result).toHaveProperty('redundantCommands');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('details');
    expect(typeof result.score).toBe('number');
    expect(result.score).toBe(100);
  });

  test('works with no options (undefined)', function () {
    const result = runEfficiencyEval();

    expect(result.commands).toBe(0);
    expect(result.tokens).toBeNull();
    expect(result.timeMs).toBeNull();
    expect(result.redundantCommands).toBe(0);
    expect(typeof result.score).toBe('number');
  });
});
