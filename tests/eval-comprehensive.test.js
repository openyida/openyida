'use strict';

const fs = require('fs');

// Mock peer modules that comprehensive.js tries to require
jest.mock('../scripts/eval/doc-quality', function () {
  return {
    runDocQualityEval: jest.fn(function () {
      return {
        summary: { avgStandards: 88, avgMaintainability: 75 },
      };
    }),
  };
}, { virtual: true });

jest.mock('../scripts/eval/coverage', function () {
  return {
    runCoverageEval: jest.fn(function () {
      return { overall: 0.82 };
    }),
  };
}, { virtual: true });

jest.mock('../scripts/eval/safety', function () {
  return {
    runSafetyEval: jest.fn(function () {
      return { passed: true, checks: [] };
    }),
  };
}, { virtual: true });

jest.mock('../scripts/eval/step-completeness', function () {
  return {
    checkStepCompleteness: jest.fn(function () {
      return { rate: 1.0, missing: [] };
    }),
  };
}, { virtual: true });

jest.mock('../scripts/eval/output-validity', function () {
  return {
    runOutputValidityEval: jest.fn(function () {
      return { summary: { rate: 0.9 } };
    }),
  };
}, { virtual: true });

jest.mock('../scripts/eval/history', function () {
  return {
    loadHistory: jest.fn(function () { return []; }),
    computeTrend: jest.fn(function () { return null; }),
    saveResult: jest.fn(),
  };
}, { virtual: true });

// Ensure the eval output directory write does not fail
beforeEach(function () {
  jest.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
  jest.spyOn(fs, 'writeFileSync').mockReturnValue(undefined);
});

afterEach(function () {
  jest.restoreAllMocks();
});

const mod = require('../scripts/eval/comprehensive');
const HARD_GATES = mod.HARD_GATES;
const DIMENSION_WEIGHTS = mod.DIMENSION_WEIGHTS;
const buildScorecard = mod.buildScorecard;
const runComprehensiveEval = mod.runComprehensiveEval;

// ---------------------------------------------------------------------------
// DIMENSION_WEIGHTS
// ---------------------------------------------------------------------------

describe('DIMENSION_WEIGHTS', function () {
  test('sum to approximately 1.0', function () {
    const keys = Object.keys(DIMENSION_WEIGHTS);
    let sum = 0;
    for (let i = 0; i < keys.length; i++) {
      sum += DIMENSION_WEIGHTS[keys[i]];
    }
    expect(sum).toBeCloseTo(1.0, 10);
  });
});

// ---------------------------------------------------------------------------
// HARD_GATES
// ---------------------------------------------------------------------------

describe('HARD_GATES', function () {
  test('has all 5 required keys', function () {
    expect(HARD_GATES).toHaveProperty('triggerAccuracy');
    expect(HARD_GATES).toHaveProperty('stepCompletionRate');
    expect(HARD_GATES).toHaveProperty('functionalTestRate');
    expect(HARD_GATES).toHaveProperty('outputFormatRate');
    expect(HARD_GATES).toHaveProperty('safetyFailures');
    expect(Object.keys(HARD_GATES)).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// buildScorecard
// ---------------------------------------------------------------------------

describe('buildScorecard', function () {
  test('computes weighted overall from available scores', function () {
    const scores = {
      standards: { score: 80 },
      maintainability: { score: 70 },
      routingAccuracy: { score: 90 },
      generationQuality: { score: 95 },
      safety: { score: 100 },
      efficiency: { score: 60 },
      stability: { score: 85 },
      coverage: { score: 75 },
      stepCompleteness: { score: 100 },
      outputValidity: { score: 90 },
      knowledgeDelta: { score: 50 },
    };

    const card = buildScorecard(scores);

    // Manually compute expected weighted average
    const keys = Object.keys(DIMENSION_WEIGHTS);
    let weightedSum = 0;
    for (let i = 0; i < keys.length; i++) {
      weightedSum += scores[keys[i]].score * DIMENSION_WEIGHTS[keys[i]];
    }
    const expected = Math.round(weightedSum * 100) / 100;

    expect(card.overall).toBeCloseTo(expected, 1);
    expect(card).toHaveProperty('dimensions');
    expect(card).toHaveProperty('hardGates');
    expect(card).toHaveProperty('gate');
  });

  test('sets gate to pass when all hard gates pass', function () {
    const scores = {
      routingAccuracy: { score: 90 },        // 0.90 >= 0.85 triggerAccuracy
      stepCompleteness: { score: 100 },       // 1.00 >= 1.00 stepCompletionRate
      generationQuality: { score: 96 },       // 0.96 >= 0.95 functionalTestRate
      outputValidity: { score: 90 },          // 0.90 >= 0.85 outputFormatRate
      safety: { score: 100, failureCount: 0 }, // 0 == 0 safetyFailures
    };

    const card = buildScorecard(scores);

    expect(card.gate).toBe('pass');
    expect(card.hardGates.triggerAccuracy).toBe('pass');
    expect(card.hardGates.stepCompletionRate).toBe('pass');
    expect(card.hardGates.functionalTestRate).toBe('pass');
    expect(card.hardGates.outputFormatRate).toBe('pass');
    expect(card.hardGates.safetyFailures).toBe('pass');
  });

  test('sets gate to fail when safety score is 0', function () {
    const scores = {
      safety: { score: 0 },
    };

    const card = buildScorecard(scores);

    expect(card.gate).toBe('fail');
    expect(card.hardGates.safetyFailures).toBe('fail');
  });

  test('handles all-null dimension scores', function () {
    const scores = {};
    const keys = Object.keys(DIMENSION_WEIGHTS);
    for (let i = 0; i < keys.length; i++) {
      scores[keys[i]] = { score: null };
    }

    const card = buildScorecard(scores);

    // No data available — overall should be 0
    expect(card.overall).toBe(0);
  });

  test('skips null dimensions in weighted average', function () {
    const scores = {
      standards: { score: 80 },
      routingAccuracy: { score: null },
      safety: { score: null },
    };

    const card = buildScorecard(scores);

    // Only standards contributes — overall should equal its score
    expect(card.overall).toBe(80);
    expect(card.dimensions.standards.weighted).not.toBeNull();
    expect(card.dimensions.routingAccuracy.weighted).toBeNull();
  });

  test('marks hard gates as skipped when data unavailable', function () {
    const card = buildScorecard({});

    expect(card.hardGates.triggerAccuracy).toBe('skipped');
    expect(card.hardGates.stepCompletionRate).toBe('skipped');
    expect(card.hardGates.functionalTestRate).toBe('skipped');
    expect(card.hardGates.outputFormatRate).toBe('skipped');
    expect(card.hardGates.safetyFailures).toBe('skipped');
  });

  test('gate is pass when all hard gates are skipped', function () {
    const card = buildScorecard({});

    // No failures detected — gate defaults to pass
    expect(card.gate).toBe('pass');
  });
});

// ---------------------------------------------------------------------------
// runComprehensiveEval
// ---------------------------------------------------------------------------

describe('runComprehensiveEval', function () {
  test('returns required fields (skill, timestamp, scorecard, radarSvg)', function () {
    const result = runComprehensiveEval({ skill: 'test-skill', saveHistory: false });

    expect(result).toHaveProperty('skill', 'test-skill');
    expect(result).toHaveProperty('timestamp');
    expect(typeof result.timestamp).toBe('string');
    expect(result).toHaveProperty('scorecard');
    expect(result.scorecard).toHaveProperty('overall');
    expect(result.scorecard).toHaveProperty('dimensions');
    expect(result.scorecard).toHaveProperty('hardGates');
    expect(result.scorecard).toHaveProperty('gate');
    expect(result).toHaveProperty('radarSvg');
  });

  test('with real skill produces valid scorecard', function () {
    const result = runComprehensiveEval({
      skill: 'form',
      commands: [['openyida', 'login'], ['openyida', 'gen', '--skill', 'form']],
      output: 'generated form page successfully',
      efficiencyData: {
        commands: ['openyida login', 'openyida gen --skill form'],
        tokens: 10000,
        timeMs: 60000,
      },
      saveHistory: false,
    });

    expect(result.skill).toBe('form');
    expect(typeof result.scorecard.overall).toBe('number');
    expect(result.scorecard.overall).toBeGreaterThanOrEqual(0);
    expect(result.scorecard.overall).toBeLessThanOrEqual(100);
    expect(['pass', 'fail']).toContain(result.scorecard.gate);

    // Dimensions should include all weight keys
    const dimKeys = Object.keys(DIMENSION_WEIGHTS);
    for (let i = 0; i < dimKeys.length; i++) {
      expect(result.scorecard.dimensions).toHaveProperty(dimKeys[i]);
    }
  });

  test('throws when skill is not provided', function () {
    expect(function () {
      runComprehensiveEval({});
    }).toThrow('options.skill is required');
  });
});
