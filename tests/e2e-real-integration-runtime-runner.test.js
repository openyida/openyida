'use strict';

const {
  RUNTIME_CASES,
  verifyRuntimeObservation,
} = require('../scripts/e2e-real/integration/runtime-contracts');
const { runRuntimeCases } = require('../scripts/e2e-real/integration/runtime-runner');
const { getLanguage, setLanguage } = require('../lib/core/i18n');

function passingObservation(runtimeCase) {
  return JSON.parse(JSON.stringify(runtimeCase.expectedObservation));
}

function createAdapter(overrides = {}) {
  return {
    prepare: jest.fn(async (runtimeCase) => ({
      remoteWrites: 0,
      correlationMarker: `OY_INT_${runtimeCase.id}`,
      ownershipEvidence: {
        verified: true,
        resourceFingerprint: `sha256:${runtimeCase.id}`,
        proofs: [{ type: 'owned-fixture-marker', marker: `OY_INT_${runtimeCase.id}` }],
      },
    })),
    trigger: jest.fn(async () => ({ accepted: true })),
    readback: jest.fn(async (runtimeCase) => passingObservation(runtimeCase)),
    cleanup: jest.fn(async () => {}),
    ...overrides,
  };
}

describe('integration domain runtime contracts', () => {
  const initialLanguage = getLanguage();

  afterAll(() => {
    setLanguage(initialLanguage);
  });

  test('covers every currently declared business node with deterministic real-readback assertions', () => {
    expect(RUNTIME_CASES.map((item) => item.nodeType).sort()).toEqual([
      'connector',
      'dataCreate',
      'dataRetrieve',
      'dataUpdate',
      'initiateApproval',
      'route',
      'sendMessage',
    ]);
    for (const runtimeCase of RUNTIME_CASES) {
      expect(runtimeCase.mutation).toEqual(expect.any(String));
      expect(runtimeCase.requiredReadbacks.length).toBeGreaterThan(0);
      expect(verifyRuntimeObservation(runtimeCase.id, passingObservation(runtimeCase))).toEqual({
        valid: true,
        errors: [],
        verificationLevel: 'REAL_RUNTIME_OBSERVED',
      });
    }
  });

  test.each(RUNTIME_CASES.map((item) => [item.id, item]))(
    'mutation for %s is rejected by the runtime contract',
    (_id, runtimeCase) => {
      const observation = passingObservation(runtimeCase);
      const firstKey = Object.keys(observation)[0];
      observation[firstKey] = typeof observation[firstKey] === 'boolean'
        ? !observation[firstKey]
        : '__mutated__';
      const result = verifyRuntimeObservation(runtimeCase.id, observation);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: runtimeCase.errorCode, path: `$.${firstKey}` }),
      ]));
    }
  );

  test('runner executes owned prepare/trigger/readback/cleanup in order and returns verification-grade results', async () => {
    const calls = [];
    const adapter = createAdapter({
      prepare: jest.fn(async (runtimeCase) => {
        calls.push(`${runtimeCase.id}:prepare`);
        return {
          remoteWrites: 0,
          correlationMarker: `OY_INT_${runtimeCase.id}`,
          ownershipEvidence: {
            verified: true,
            resourceFingerprint: `sha256:${runtimeCase.id}`,
            proofs: [{ type: 'owned-fixture-marker', marker: `OY_INT_${runtimeCase.id}` }],
          },
        };
      }),
      trigger: jest.fn(async (runtimeCase) => {
        calls.push(`${runtimeCase.id}:trigger`);
        return { accepted: true };
      }),
      readback: jest.fn(async (runtimeCase) => {
        calls.push(`${runtimeCase.id}:readback`);
        return passingObservation(runtimeCase);
      }),
      cleanup: jest.fn(async (runtimeCase) => {
        calls.push(`${runtimeCase.id}:cleanup`);
      }),
    });
    const result = await runRuntimeCases({ adapter });
    expect(result.status).toBe('passed');
    expect(result.verificationLevel).toBe('REAL_RUNTIME_OBSERVED');
    expect(result.cases).toHaveLength(RUNTIME_CASES.length);
    expect(adapter.trigger).toHaveBeenCalledTimes(RUNTIME_CASES.length);
    expect(adapter.readback).toHaveBeenCalledTimes(RUNTIME_CASES.length);
    expect(adapter.cleanup).toHaveBeenCalledTimes(RUNTIME_CASES.length);
    expect(calls.slice(0, 4)).toEqual([
      'integration-data-create:prepare',
      'integration-data-create:trigger',
      'integration-data-create:readback',
      'integration-data-create:cleanup',
    ]);
  });

  test('runner fails closed on the first runtime semantic mismatch and still cleans the owned fixture', async () => {
    const adapter = createAdapter({
      readback: jest.fn(async (runtimeCase) => {
        const observation = passingObservation(runtimeCase);
        if (runtimeCase.id === 'integration-data-update') {
          observation.updatedCount = 2;
        }
        return observation;
      }),
    });
    await expect(runRuntimeCases({ adapter })).rejects.toMatchObject({
      code: 'INTEGRATION_RUNTIME_CONTRACT_FAILED',
      details: expect.objectContaining({ caseId: 'integration-data-update' }),
    });
    expect(adapter.cleanup).toHaveBeenCalledTimes(3);
  });

  test('unowned context performs zero trigger, readback, and cleanup side effects', async () => {
    const adapter = createAdapter({
      prepare: jest.fn(async () => ({
        remoteWrites: 0,
        correlationMarker: 'OY_INT_UNOWNED',
        ownershipEvidence: {
          verified: false,
          resourceFingerprint: 'sha256:unowned',
          proofs: [],
        },
      })),
    });
    await expect(runRuntimeCases({ adapter })).rejects.toMatchObject({
      code: 'INTEGRATION_RUNTIME_OWNERSHIP_UNVERIFIED',
      details: expect.objectContaining({ remoteWrites: 0 }),
    });
    expect(adapter.trigger).not.toHaveBeenCalled();
    expect(adapter.readback).not.toHaveBeenCalled();
    expect(adapter.cleanup).not.toHaveBeenCalled();
  });

  test.each([
    ['declared write', async () => ({
      remoteWrites: 1,
      correlationMarker: 'OY_INT_PREFLIGHT_WRITE',
      ownershipEvidence: {
        verified: true,
        resourceFingerprint: 'sha256:written',
        proofs: [{ type: 'owned-fixture-marker', marker: 'OY_INT_PREFLIGHT_WRITE' }],
      },
    })],
    ['reported write before throwing', async () => {
      const error = new Error('preflight mutated platform state');
      error.details = { remoteWrites: 1 };
      throw error;
    }],
  ])('prepare %s is rejected with zero follow-up side effects', async (_label, prepare) => {
    const adapter = createAdapter({ prepare: jest.fn(prepare) });
    await expect(runRuntimeCases({ adapter })).rejects.toMatchObject({
      code: 'INTEGRATION_RUNTIME_PREFLIGHT_NOT_READ_ONLY',
      details: expect.objectContaining({ remoteWrites: 1 }),
    });
    expect(adapter.trigger).not.toHaveBeenCalled();
    expect(adapter.readback).not.toHaveBeenCalled();
    expect(adapter.cleanup).not.toHaveBeenCalled();
  });

  test('primary failure and cleanup failure preserve both machine errors and residual evidence', async () => {
    const primary = new Error('runtime readback unavailable');
    primary.code = 'INTEGRATION_RUNTIME_READBACK_FAILED';
    primary.details = { stage: 'readback' };
    const cleanup = new Error('fixture could not be removed');
    cleanup.code = 'INTEGRATION_RUNTIME_FIXTURE_DELETE_FAILED';
    cleanup.details = {
      residual: { status: 'present', resourceFingerprint: 'sha256:residual-fixture' },
    };
    const adapter = createAdapter({
      readback: jest.fn(async () => { throw primary; }),
      cleanup: jest.fn(async () => { throw cleanup; }),
    });

    await expect(runRuntimeCases({ adapter })).rejects.toMatchObject({
      code: 'INTEGRATION_RUNTIME_PRIMARY_AND_CLEANUP_FAILED',
      details: {
        primary: expect.objectContaining({
          code: 'INTEGRATION_RUNTIME_READBACK_FAILED',
          details: { stage: 'readback' },
        }),
        cleanup: expect.objectContaining({
          status: 'failed',
          code: 'INTEGRATION_RUNTIME_FIXTURE_DELETE_FAILED',
          residual: { status: 'present', resourceFingerprint: 'sha256:residual-fixture' },
        }),
      },
    });
  });

  test('runner without the four-method real adapter stays PLATFORM_PROBE_REQUIRED with zero writes', async () => {
    setLanguage('ja');
    await expect(runRuntimeCases({ adapter: { readback: jest.fn() } })).rejects.toMatchObject({
      code: 'PLATFORM_PROBE_REQUIRED',
      message: '集成自動化ランタイムアダプターが設定されていません。',
      details: expect.objectContaining({ remoteWrites: 0 }),
    });
  });
});
