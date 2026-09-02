'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildEchoOperation,
  cleanupOwnedConnectorResources,
  getConfig,
  parseCliJsonStdout,
  run,
  validateControlledFixtureResponse,
} = require('../scripts/e2e-real/connector/runner');
const { setLanguage } = require('../lib/core/i18n');

describe('real connector E2E runner', () => {
  test('parses the real pretty login JSON and a single-line connector JSON with CLI noise', () => {
    const loginFixture = JSON.stringify({
      ok: true,
      status: 'ok',
      corp_id: 'corp-fixture',
      auth_profile: 'profile-fixture',
    }, null, 2);
    expect(parseCliJsonStdout(loginFixture)).toMatchObject({
      ok: true,
      corp_id: 'corp-fixture',
    });
    expect(parseCliJsonStdout('✓ created\n{"success":true,"connectorId":"101"}\nDone'))
      .toEqual({ success: true, connectorId: '101' });
    expect(parseCliJsonStdout('not json')).toBeNull();
  });

  test('requires an explicit controlled fixture and target organization', () => {
    expect(getConfig({}, new Date('2026-08-27T00:00:00Z'))).toMatchObject({
      enabled: false,
      ready: false,
      missing: [
        'OPENYIDA_E2E=1',
        'OPENYIDA_E2E_CONNECTOR=1',
        'OPENYIDA_E2E_CORP_ID',
        'OPENYIDA_E2E_CONNECTOR_ECHO_URL',
        'OPENYIDA_E2E_CONNECTOR_FIXTURE_MARKER',
        'OPENYIDA_E2E_CONNECTOR_FIXTURE_OWNER',
      ],
      prefix: 'OY_E2E_CONNECTOR_20260827000000',
      echoBaseUrl: null,
    });
    expect(getConfig({
      OPENYIDA_E2E: '1',
      OPENYIDA_E2E_CONNECTOR: '1',
      OPENYIDA_E2E_CORP_ID: 'corp-sensitive',
      OPENYIDA_E2E_CONNECTOR_ECHO_URL: 'https://httpbin.org',
      OPENYIDA_E2E_CONNECTOR_FIXTURE_MARKER: 'fixture-v1',
      OPENYIDA_E2E_CONNECTOR_FIXTURE_OWNER: 'openyida-team',
    })).toMatchObject({ enabled: true, ready: false });
    expect(buildEchoOperation()).toMatchObject({
      id: 'operation-openyida_echo',
      operationId: 'openyida_echo',
      method: 'post',
      url: '/',
    });
  });

  test('blocks a multi-profile target mismatch before remote writes and redacts corp identity', async () => {
    const registryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'connector-e2e-mismatch-'));
    const corpId = 'corp-sensitive-marker';
    const calls = [];
    const logs = [];
    const result = await run({
      env: {
        OPENYIDA_E2E: '1',
        OPENYIDA_E2E_CONNECTOR: '1',
        OPENYIDA_AUTH_PROFILE: 'profile-default-wrong-org',
      },
      config: {
        enabled: true,
        ready: true,
        missing: [],
        prefix: 'OY_E2E_CONNECTOR_MISMATCH',
        connectorName: 'OY_E2E_CONNECTOR_MISMATCH__Connector',
        connectionName: 'OY_E2E_CONNECTOR_MISMATCH__Account',
        echoBaseUrl: 'https://fixture.openyida.team/e2e/echo',
        fixtureMarker: 'fixture-v1',
        fixtureOwner: 'openyida-team',
        registryDir,
        corpId,
      },
      runCli: (args) => {
        calls.push(args);
        return { json: { ok: true, status: 'ok', corp_id: 'corp-other', auth_profile: 'profile-other' } };
      },
      logger: message => logs.push(message),
    });

    expect(result).toMatchObject({ skipped: false, status: 'PLATFORM_PROBE_REQUIRED', remoteWrites: 0 });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(['login', '--check-only', '--json', '--corp-id', corpId]);
    const serialized = [result.registryPath, result.manifestPath]
      .map(filePath => fs.readFileSync(filePath, 'utf8')).join('\n');
    expect(serialized).not.toContain(corpId);
    expect(serialized).not.toContain('corp-other');
    expect(serialized).toContain('sha256:');
    expect(logs.join('\n')).not.toContain(corpId);
    expect(logs.join('\n')).not.toContain('corp-other');
  });

  test('returns probe-required with zero writes when controlled fixture evidence is missing', async () => {
    const registryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'connector-e2e-probe-'));
    const calls = [];
    const logs = [];
    setLanguage('en');
    let result;
    try {
      result = await run({
        config: {
          enabled: true,
          ready: false,
          missing: ['OPENYIDA_E2E_CONNECTOR_ECHO_URL'],
          prefix: 'OY_E2E_CONNECTOR_PROBE',
          connectorName: 'OY_E2E_CONNECTOR_PROBE__Connector',
          connectionName: 'OY_E2E_CONNECTOR_PROBE__Account',
          echoBaseUrl: null,
          fixtureMarker: 'fixture-v1',
          fixtureOwner: 'openyida-team',
          registryDir,
          corpId: 'corp-probe-sensitive',
        },
        runCli: args => calls.push(args),
        logger: message => logs.push(message),
      });
    } finally {
      setLanguage('zh');
    }

    expect(result).toMatchObject({ status: 'PLATFORM_PROBE_REQUIRED', remoteWrites: 0 });
    expect(calls).toHaveLength(0);
    expect(logs.join('\n')).toContain('no remote writes were issued');
    expect(result.registry.cleanup.removed).toHaveLength(1);
    expect(fs.existsSync(result.registry.evidenceFixture.path)).toBe(true);
  });

  test('persists pre-write evidence, uses the selected profile, and preserves the fixture', async () => {
    const calls = [];
    const registryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'connector-e2e-success-'));
    const corpId = 'corp-target-sensitive-marker';
    const operation = buildEchoOperation();
    const result = await run({
      env: {
        OPENYIDA_E2E: '1',
        OPENYIDA_E2E_CONNECTOR: '1',
        OPENYIDA_AUTH_PROFILE: 'profile-default-wrong-org',
      },
      config: {
        enabled: true,
        ready: true,
        missing: [],
        prefix: 'OY_E2E_CONNECTOR_TEST',
        connectorName: 'OY_E2E_CONNECTOR_TEST__Connector',
        connectionName: 'OY_E2E_CONNECTOR_TEST__Account',
        echoBaseUrl: 'https://fixture.openyida.team/e2e/echo',
        fixtureMarker: 'fixture-v1',
        fixtureOwner: 'openyida-team',
        registryDir,
        corpId,
      },
      operation,
      logger: () => {},
      runCli: (args, commandEnv) => {
        calls.push({ args, commandEnv });
        const command = args.slice(0, 2).join(' ');
        if (command === 'login --check-only') {
          expect(commandEnv.OPENYIDA_AUTH_PROFILE).toBeUndefined();
        }
        if (command === 'connector create') {
          const registryFiles = fs.readdirSync(registryDir);
          expect(registryFiles).toEqual(expect.arrayContaining([
            'OY_E2E_CONNECTOR_TEST.json',
            'OY_E2E_CONNECTOR_TEST.manifest.json',
          ]));
          const checkpoint = JSON.parse(fs.readFileSync(path.join(registryDir, 'OY_E2E_CONNECTOR_TEST.json'), 'utf8'));
          const manifest = JSON.parse(fs.readFileSync(path.join(registryDir, 'OY_E2E_CONNECTOR_TEST.manifest.json'), 'utf8'));
          expect(checkpoint.preWriteCheckpoint).toMatchObject({ ready: true, remoteWrites: 0 });
          expect(manifest).toMatchObject({
            runId: 'OY_E2E_CONNECTOR_TEST',
            plannedWrites: 2,
            organizationSelection: { verified: true },
            fixture: { sha256: expect.stringMatching(/^sha256:[a-f0-9]{64}$/) },
          });
          return { json: { success: true, connectorId: '101', connectorName: 'Http_owned', readbackVerified: true } };
        }
        if (command === 'connector create-connection') {
          return { json: { success: true, connectionId: '7', readbackVerified: true } };
        }
        if (command === 'connector list-actions') {
          return { json: { success: true, operations: [operation] } };
        }
        if (command === 'connector test') {
          return {
            json: {
              success: true,
              statusLine: 'HTTP/1.1 200 OK',
              responseHeaders: { 'x-openyida-fixture-owner': 'openyida-team' },
              content: '{"runId":"OY_E2E_CONNECTOR_TEST","fixtureMarker":"fixture-v1","authorization":"Basic ***"}',
            },
          };
        }
        return { json: {
          success: true,
          ok: true,
          status: 'ok',
          corp_id: corpId,
          auth_profile: 'profile-selected',
        } };
      },
    });

    expect(result.registry.status).toBe('cleanup_blocked');
    expect(calls.map(({ args }) => args.slice(0, 2).join(' '))).toEqual([
      'login --check-only',
      'connector create',
      'connector create-connection',
      'connector list-actions',
      'connector test',
      'connector list-actions',
    ]);
    expect(calls.every(({ commandEnv }) => commandEnv.OPENYIDA_AUTH_CORP_ID === corpId)).toBe(true);
    expect(calls.slice(1).every(({ commandEnv }) => commandEnv.OPENYIDA_AUTH_PROFILE === 'profile-selected')).toBe(true);
    expect(calls.filter(({ args }) => args[0] === 'connector' && args[1] === 'test')[0].args)
      .toEqual(expect.arrayContaining(['--path-json', '{}', '--query-json', '{"runId":"OY_E2E_CONNECTOR_TEST"}', '--body-json', '{"runId":"OY_E2E_CONNECTOR_TEST","owned":true}']));
    expect(result.registry.resources.every((resource) => resource.owned === true)).toBe(true);
    expect(JSON.stringify(result.registry)).not.toContain(corpId);
    expect(JSON.stringify(result.registry.commands)).not.toContain('openyida-e2e');
    expect(JSON.stringify(result.registry.commands)).toContain('<redacted>');
    expect(fs.existsSync(result.registry.evidenceFixture.path)).toBe(true);
    expect(result.registry.cleanup.removed).toHaveLength(1);
    expect(result.registry.cleanup.removed[0].resource.type).toBe('temporary-local-artifact');
    expect(result.registry.writeAttempts.map(attempt => attempt.status)).toEqual(['completed', 'completed']);
  });

  test('records connector create as outcome_unknown and stops without a second write', async () => {
    const registryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'connector-e2e-connector-unknown-'));
    const calls = [];
    await expect(run({
      config: {
        enabled: true,
        ready: true,
        missing: [],
        prefix: 'OY_E2E_CONNECTOR_UNKNOWN',
        connectorName: 'OY_E2E_CONNECTOR_UNKNOWN__Connector',
        connectionName: 'OY_E2E_CONNECTOR_UNKNOWN__Account',
        echoBaseUrl: 'https://fixture.openyida.team/e2e/echo',
        fixtureMarker: 'fixture-v1',
        fixtureOwner: 'openyida-team',
        registryDir,
        corpId: 'corp-connector-unknown',
      },
      logger: () => {},
      runCli: args => {
        calls.push(args.slice(0, 2).join(' '));
        if (args[0] === 'login') {
          return { json: { ok: true, status: 'ok', corp_id: 'corp-connector-unknown', auth_profile: 'profile-one' } };
        }
        throw new Error('socket closed after connector request');
      },
    })).rejects.toThrow('socket closed after connector request');

    expect(calls).toEqual(['login --check-only', 'connector create']);
    const registry = JSON.parse(fs.readFileSync(path.join(registryDir, 'OY_E2E_CONNECTOR_UNKNOWN.json'), 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(path.join(registryDir, 'OY_E2E_CONNECTOR_UNKNOWN.manifest.json'), 'utf8'));
    expect(registry.remoteWrites).toBe(1);
    expect(registry.writeAttempts).toEqual([
      expect.objectContaining({ stage: 'connector-create', status: 'outcome_unknown' }),
    ]);
    expect(manifest.writeAttempts).toEqual(registry.writeAttempts);
    expect(manifest).toMatchObject({
      status: 'failed',
      cleanup: { status: 'cleanup_blocked' },
      resources: expect.arrayContaining([
        expect.objectContaining({ type: 'connector-candidate', owned: false, outcome: 'outcome_unknown' }),
      ]),
    });
    expect(registry.cleanup).toMatchObject({
      status: 'cleanup_blocked',
      residual: [expect.objectContaining({ reason: 'remote_outcome_unknown' })],
    });
    expect(registry.cleanup.residual[0].resource).toMatchObject({
      type: 'connector-candidate',
      owned: false,
      outcome: 'outcome_unknown',
    });
  });

  test('records connection create as outcome_unknown after the connector is verified and never retries', async () => {
    const registryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'connector-e2e-connection-unknown-'));
    const calls = [];
    await expect(run({
      config: {
        enabled: true,
        ready: true,
        missing: [],
        prefix: 'OY_E2E_CONNECTION_UNKNOWN',
        connectorName: 'OY_E2E_CONNECTION_UNKNOWN__Connector',
        connectionName: 'OY_E2E_CONNECTION_UNKNOWN__Account',
        echoBaseUrl: 'https://fixture.openyida.team/e2e/echo',
        fixtureMarker: 'fixture-v1',
        fixtureOwner: 'openyida-team',
        registryDir,
        corpId: 'corp-connection-unknown',
      },
      logger: () => {},
      runCli: args => {
        const command = args.slice(0, 2).join(' ');
        calls.push(command);
        if (args[0] === 'login') {
          return { json: { ok: true, status: 'ok', corp_id: 'corp-connection-unknown', auth_profile: 'profile-one' } };
        }
        if (command === 'connector create') {
          return { json: { success: true, connectorId: '101', connectorName: 'Http_owned', readbackVerified: true } };
        }
        throw new Error('socket closed after connection request');
      },
    })).rejects.toThrow('socket closed after connection request');

    expect(calls).toEqual(['login --check-only', 'connector create', 'connector create-connection']);
    const registry = JSON.parse(fs.readFileSync(path.join(registryDir, 'OY_E2E_CONNECTION_UNKNOWN.json'), 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(path.join(registryDir, 'OY_E2E_CONNECTION_UNKNOWN.manifest.json'), 'utf8'));
    expect(registry.writeAttempts).toEqual([
      expect.objectContaining({ stage: 'connector-create', status: 'completed', exactId: '101' }),
      expect.objectContaining({ stage: 'connection-create', status: 'outcome_unknown' }),
    ]);
    expect(manifest.writeAttempts).toEqual(registry.writeAttempts);
    expect(manifest).toMatchObject({
      status: 'failed',
      cleanup: { status: 'cleanup_blocked' },
      resources: expect.arrayContaining([
        expect.objectContaining({ type: 'connection-candidate', owned: false, outcome: 'outcome_unknown' }),
      ]),
    });
    expect(registry.cleanup.status).toBe('cleanup_blocked');
    expect(registry.cleanup.residual).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'remote_cleanup_unsupported' }),
      expect.objectContaining({ reason: 'remote_outcome_unknown' }),
    ]));
    expect(registry.resources).toContainEqual(expect.objectContaining({
      type: 'connection-candidate', owned: false, outcome: 'outcome_unknown', connectorId: '101',
    }));
  });

  test('requires exact controlled fixture fields and rejects malformed or substring-only evidence', () => {
    const config = {
      prefix: 'RUN-EXACT',
      fixtureMarker: 'fixture-v1',
      fixtureOwner: 'openyida-team',
    };
    const valid = {
      statusLine: 'HTTP/1.1 200 OK',
      responseHeaders: { 'x-openyida-fixture-owner': 'openyida-team' },
      content: '{"runId":"RUN-EXACT","fixtureMarker":"fixture-v1","authorization":"Basic ***"}',
    };
    expect(validateControlledFixtureResponse(valid, config)).toBe(true);
    expect(validateControlledFixtureResponse({
      ...valid,
      content: '{"message":"RUN-EXACT fixture-v1 Basic ***"}',
    }, config)).toBe(false);
    expect(validateControlledFixtureResponse({
      ...valid,
      content: '{"runId":"RUN-EXACT-suffix","fixtureMarker":"prefix-fixture-v1","authorization":"Basic *** trailing"}',
    }, config)).toBe(false);
    expect(validateControlledFixtureResponse({ ...valid, content: '{broken' }, config)).toBe(false);
    expect(validateControlledFixtureResponse({ ...valid, responseHeaders: '{broken' }, config)).toBe(false);
    expect(validateControlledFixtureResponse({
      ...valid,
      responseHeaders: { 'x-openyida-fixture-owner': 'openyida-team-suffix' },
    }, config)).toBe(false);
  });

  test('cleanup is owned-only and never guesses unsupported remote deletion', () => {
    const removed = [];
    const result = cleanupOwnedConnectorResources({
      runId: 'RUN',
      namePrefix: 'RUN__',
      localRoot: '/tmp/connector-e2e/RUN',
      removePath: targetPath => removed.push(targetPath),
      resources: [
        { type: 'temporary-local-artifact', runId: 'RUN', owned: true, name: 'RUN__OperationsTemp', path: '/tmp/connector-e2e/RUN/tmp/operations.json' },
        { type: 'connector', runId: 'RUN', owned: true, name: 'RUN__Connector', exactId: '101' },
        { type: 'connection', runId: 'OTHER', owned: true, name: 'OTHER__Account', exactId: '7' },
        { type: 'connector', runId: 'RUN', owned: false, name: 'RUN__Unowned', exactId: '999' },
      ],
    });

    expect(result.status).toBe('cleanup_blocked');
    expect(result.residual).toHaveLength(1);
    expect(result.skipped.map((item) => item.reason)).toEqual(['owned_flag_missing', 'different_run']);
    expect(result.removed).toHaveLength(1);
    expect(removed).toEqual(['/tmp/connector-e2e/RUN/tmp/operations.json']);
    expect(result.deleteCommands).toEqual([]);
  });
});
