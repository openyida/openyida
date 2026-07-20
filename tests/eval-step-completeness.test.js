'use strict';

const {
  STEP_MARKERS,
  getRequiredSteps,
  checkStepCompleteness,
  runStepCompletenessEval,
} = require('../scripts/eval/step-completeness');

describe('eval/step-completeness', () => {
  // -----------------------------------------------------------------------
  // 1. getRequiredSteps
  // -----------------------------------------------------------------------

  describe('getRequiredSteps', () => {
    test('returns steps for known skill (yida-app)', () => {
      const steps = getRequiredSteps('yida-app');
      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThan(0);
      for (const marker of steps) {
        expect(typeof marker.step).toBe('string');
        expect(marker.pattern).toBeInstanceOf(RegExp);
      }
      const stepNames = steps.map((s) => s.step);
      expect(stepNames).toContain('login-check');
      expect(stepNames).toContain('create-app');
      expect(stepNames).toContain('publish');
    });

    test('returns empty array for unknown skill', () => {
      const steps = getRequiredSteps('totally-unknown-skill');
      expect(steps).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // 2. checkStepCompleteness
  // -----------------------------------------------------------------------

  describe('checkStepCompleteness', () => {
    test('rate=1 when all steps present', () => {
      const commands = [
        'openyida login --check-only',
        'openyida create-app --name "Test"',
        'openyida create-form create APP_XXX ...',
        'openyida create-page APP_XXX "Page"',
        'openyida publish src/page.oyd.jsx APP_XXX FORM_XXX',
      ];
      const result = checkStepCompleteness('yida-app', commands);
      expect(result.skill).toBe('yida-app');
      expect(result.rate).toBe(1.0);
      expect(result.missing).toEqual([]);
      expect(result.completed).toBe(result.total);
    });

    test('detects missing steps', () => {
      // Only login-check and create-app, missing create-form, create-page, publish
      const commands = [
        'openyida login --check-only',
        'openyida create-app --name "Test"',
      ];
      const result = checkStepCompleteness('yida-app', commands);
      expect(result.rate).toBeLessThan(1.0);
      expect(result.missing.length).toBeGreaterThan(0);
      expect(result.missing).toContain('create-form');
      expect(result.missing).toContain('publish');
    });

    test('rate=1 for unknown skills (default pass)', () => {
      const result = checkStepCompleteness('nonexistent-skill', ['openyida app-list']);
      expect(result.rate).toBe(1.0);
      expect(result.total).toBe(0);
      expect(result.completed).toBe(0);
      expect(result.missing).toEqual([]);
      expect(result.steps).toEqual([]);
    });

    test('missing array contains correct step names', () => {
      // Provide only login-check for yida-connector
      const commands = [
        'openyida login --check-only',
      ];
      const result = checkStepCompleteness('yida-connector', commands);
      expect(result.missing).toEqual(['create-connector']);
      expect(result.steps.find((s) => s.step === 'login-check').found).toBe(true);
      expect(result.steps.find((s) => s.step === 'create-connector').found).toBe(false);
    });

    test('steps array marks each step found or not found', () => {
      const commands = [
        'openyida login --check-only',
        'openyida create-report --name "Report" APP_XXX',
      ];
      const result = checkStepCompleteness('yida-report', commands);
      expect(result.rate).toBe(1.0);
      for (const step of result.steps) {
        expect(step.required).toBe(true);
        expect(step.found).toBe(true);
      }
    });
  });

  // -----------------------------------------------------------------------
  // 3. runStepCompletenessEval
  // -----------------------------------------------------------------------

  describe('runStepCompletenessEval', () => {
    test('counts fullCompletion correctly', () => {
      const result = runStepCompletenessEval({
        scenarios: [
          {
            skill: 'yida-connector',
            commands: [
              'openyida login --check-only',
              'openyida connector create "My API" "example.com"',
            ],
          },
          {
            skill: 'yida-report',
            commands: [
              'openyida login --check-only',
              'openyida create-report --name "Report" APP_XXX',
            ],
          },
        ],
      });
      expect(result.summary.total).toBe(2);
      expect(result.summary.fullCompletion).toBe(2);
      expect(result.summary.partialCompletion).toBe(0);
      expect(result.summary.noMarkers).toBe(0);
    });

    test('counts partialCompletion correctly', () => {
      const result = runStepCompletenessEval({
        scenarios: [
          {
            skill: 'yida-app',
            commands: [
              'openyida login --check-only',
              'openyida create-app --name "Test"',
              // missing create-form, create-page, publish
            ],
          },
        ],
      });
      expect(result.summary.total).toBe(1);
      expect(result.summary.fullCompletion).toBe(0);
      expect(result.summary.partialCompletion).toBe(1);
      expect(result.results[0].rate).toBeLessThan(1.0);
      expect(result.results[0].missing.length).toBeGreaterThan(0);
    });

    test('counts noMarkers for unknown skills', () => {
      const result = runStepCompletenessEval({
        scenarios: [
          {
            skill: 'unknown-skill-xyz',
            commands: ['openyida app-list'],
          },
        ],
      });
      expect(result.summary.total).toBe(1);
      expect(result.summary.noMarkers).toBe(1);
      expect(result.summary.fullCompletion).toBe(0);
      expect(result.summary.partialCompletion).toBe(0);
    });

    test('mixed scenario with full, partial, and noMarkers', () => {
      const result = runStepCompletenessEval({
        scenarios: [
          {
            skill: 'yida-report',
            commands: [
              'openyida login --check-only',
              'openyida create-report --name "R" APP_XXX',
            ],
          },
          {
            skill: 'yida-app',
            commands: [
              'openyida login --check-only',
              // missing most steps
            ],
          },
          {
            skill: 'unknown-skill',
            commands: ['openyida env'],
          },
        ],
      });
      expect(result.summary.total).toBe(3);
      expect(result.summary.fullCompletion).toBe(1);
      expect(result.summary.partialCompletion).toBe(1);
      expect(result.summary.noMarkers).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // STEP_MARKERS sanity check
  // -----------------------------------------------------------------------

  describe('STEP_MARKERS', () => {
    test('is a non-empty object with known skill keys', () => {
      expect(typeof STEP_MARKERS).toBe('object');
      const keys = Object.keys(STEP_MARKERS);
      expect(keys.length).toBeGreaterThan(0);
      expect(keys).toContain('yida-app');
      expect(keys).toContain('yida-connector');
    });
  });
});
