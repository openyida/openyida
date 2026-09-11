'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  triggerLogin: jest.fn(),
}));
jest.mock('../lib/integration/integration-api', () => ({
  saveProcess: jest.fn(),
}));
jest.mock('../lib/integration/integration-spec-builder', () => ({
  readIntegrationSpec: jest.fn(),
  validateIntegrationSpec: jest.fn(),
  buildSpecProcessAndViewJson: jest.fn(),
}));

const auth = require('../lib/core/utils');
const integrationApi = require('../lib/integration/integration-api');
const specBuilder = require('../lib/integration/integration-spec-builder');
const {
  detectIntegrationUpdateCapability,
  run,
} = require('../lib/integration/integration-update');

describe('integration update capability detection', () => {
  let artifactDir;

  beforeEach(() => {
    artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-integration-update-'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    fs.rmSync(artifactDir, { recursive: true, force: true });
  });

  test('reports the checked-in platform verdict without reading a runtime manifest', () => {
    expect(detectIntegrationUpdateCapability()).toEqual({
      capabilityId: 'integration_detail_readback_wrapper',
      verdict: 'PLATFORM_PROBE_REQUIRED',
      evidenceLocator: 'scripts/eval/integration-contract/capability-manifest.json',
      blocker: 'FULL_DEFINITION_READBACK_UNPROVEN',
    });
  });

  test('blocks before auth, spec reads/builds, ownership, or remote writes', async () => {
    const missingSpec = path.join(artifactDir, 'does-not-exist.json');

    await expect(run([
      'APP-PRIVATE-VALUE',
      'FORM-PRIVATE-VALUE',
      'LPROC-PRIVATE-VALUE',
      '--spec',
      missingSpec,
      '--publish',
    ], { artifactDir })).rejects.toMatchObject({
      code: 'PLATFORM_PROBE_REQUIRED',
      details: expect.objectContaining({
        blocker: 'FULL_DEFINITION_READBACK_UNPROVEN',
        remoteWrites: 0,
      }),
    });

    expect(auth.loadAuthData).not.toHaveBeenCalled();
    expect(auth.triggerLogin).not.toHaveBeenCalled();
    expect(specBuilder.readIntegrationSpec).not.toHaveBeenCalled();
    expect(specBuilder.validateIntegrationSpec).not.toHaveBeenCalled();
    expect(specBuilder.buildSpecProcessAndViewJson).not.toHaveBeenCalled();
    expect(integrationApi.saveProcess).not.toHaveBeenCalled();
  });

  test('writes only an honest redacted capability artifact', async () => {
    await expect(run([
      'APP-PRIVATE-VALUE',
      'FORM-PRIVATE-VALUE',
      'LPROC-PRIVATE-VALUE',
      '--spec',
      '/not/read/desired-spec.json',
    ], { artifactDir })).rejects.toMatchObject({ code: 'PLATFORM_PROBE_REQUIRED' });

    const files = fs.readdirSync(artifactDir);
    expect(files).toHaveLength(1);
    const artifactText = fs.readFileSync(path.join(artifactDir, files[0]), 'utf8');
    const artifact = JSON.parse(artifactText);
    expect(Object.keys(artifact).sort()).toEqual([
      'blocker',
      'probe',
      'remoteWrites',
      'schemaVersion',
      'targetSummary',
    ]);
    expect(artifact).toMatchObject({
      probe: {
        capabilityId: 'integration_detail_readback_wrapper',
        verdict: 'PLATFORM_PROBE_REQUIRED',
        evidenceLocator: 'scripts/eval/integration-contract/capability-manifest.json',
      },
      remoteWrites: 0,
      blocker: 'FULL_DEFINITION_READBACK_UNPROVEN',
      targetSummary: {
        digest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        fields: {
          appType: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
          formUuid: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
          processCode: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        },
      },
    });
    expect(artifactText).not.toContain('APP-PRIVATE-VALUE');
    expect(artifactText).not.toContain('FORM-PRIVATE-VALUE');
    expect(artifactText).not.toContain('LPROC-PRIVATE-VALUE');
    expect(artifactText).not.toContain('desired-spec');
    expect(artifactText).not.toContain('mutated');
    expect(artifactText).not.toContain('restored');
  });

  test('rejects incomplete targets without creating an artifact', async () => {
    await expect(run(['APP', 'FORM'], { artifactDir })).rejects.toMatchObject({
      code: 'INTEGRATION_UPDATE_ARGUMENTS_INVALID',
      details: expect.objectContaining({ remoteWrites: 0 }),
    });
    expect(fs.readdirSync(artifactDir)).toEqual([]);
  });
});
