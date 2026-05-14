'use strict';

const {
  SKILL_COVERAGE,
  validateSkillCoverage,
} = require('../scripts/e2e-real/skill-coverage');

describe('real E2E skill coverage matrix', () => {
  test('covers every current yida skill with an explicit test strategy', () => {
    const result = validateSkillCoverage();

    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.extra).toEqual([]);
    expect(result.invalid).toEqual([]);
    expect(result.checked).toBeGreaterThan(0);
  });

  test('fails when a new skill has no coverage entry', () => {
    const result = validateSkillCoverage({
      skillNames: ['yida-create-app', 'yida-new-skill'],
      coverage: {
        'yida-create-app': SKILL_COVERAGE['yida-create-app'],
      },
    });

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(['yida-new-skill']);
  });

  test('dashboard and AI-backed skills are classified deliberately', () => {
    expect(SKILL_COVERAGE['yida-dashboard']).toMatchObject({
      level: 'real-e2e',
      stages: ['dashboard'],
    });
    expect(SKILL_COVERAGE['yida-flash-note-to-prd']).toMatchObject({
      level: 'opt-in',
      stages: ['ai'],
    });
  });
});
