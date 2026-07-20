'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildForbiddenValues,
  leakScan,
  projectError,
  scrubEvidenceForWrite,
  writeSafeEvidence,
} = require('../scripts/e2e-real/schema-process-evidence-runner');

let tempDir;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-schema-process-evidence-test-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('schema process evidence runner safety projection', () => {
  test('redacts transport and top-level failure messages before writing evidence', () => {
    const ids = {
      appType: 'APP_SAC06_REALISTIC_123456',
      formUuid: 'FORM-SAC06-REALISTIC-1234567890',
      processCode: 'TPROC--SAC06_REALISTIC_1234567890',
      processId: '98765432101',
    };
    const cookieData = {
      csrf_token: 'csrf-secret-should-not-appear',
      base_url: 'https://internal.example.test',
      cookies: [
        { name: 'tianshu_csrf_token', value: 'csrf-secret-should-not-appear' },
        { name: 'session_token', value: 'token-secret-should-not-appear' },
      ],
    };
    const privateState = { resourceIds: ids };
    const forbiddenValues = buildForbiddenValues(cookieData, privateState, [
      '/workspace/private/secret.json',
      '/alibaba/web/APP_SAC06_REALISTIC_123456/query/simpleProcess/getProcessById.json',
    ]);
    const sensitiveMessage = [
      'Cookie=tianshu_csrf_token=csrf-secret-should-not-appear',
      'Authorization: Bearer token-secret-should-not-appear',
      ids.appType,
      ids.formUuid,
      ids.processCode,
      ids.processId,
      '/workspace/private/secret.json',
      'https://internal.example.test/alibaba/web/APP_SAC06_REALISTIC_123456/query/simpleProcess/getProcessById.json',
    ].join(' ');

    const transportError = new Error(sensitiveMessage);
    transportError.code = 'ECONNRESET';
    const topLevelError = new Error(sensitiveMessage);

    const evidence = {
      kind: 'openyida_schema_process_api_evidence',
      status: 'failed',
      error: projectError(topLevelError, { phase: 'create-app' }),
      readObservations: [
        {
          phase: 'after-save',
          probes: [
            {
              operation: 'SimpleProcess.getProcessById',
              method: 'GET',
              pathTemplate: '/alibaba/web/{appType}/query/simpleProcess/getProcessById.json',
              transportFailure: true,
              transportError: sensitiveMessage,
              error: projectError(transportError, {
                category: 'transport',
                operation: 'SimpleProcess.getProcessById',
                transportFailure: true,
              }),
            },
          ],
        },
      ],
    };

    const evidencePath = path.join(tempDir, 'evidence.v1.json');
    const written = writeSafeEvidence(evidencePath, evidence, forbiddenValues);
    const raw = fs.readFileSync(evidencePath, 'utf8');
    const parsed = JSON.parse(raw);

    expect(written.leakScan.passed).toBe(true);
    expect(parsed.error).toMatchObject({
      category: 'runtime',
      code: 'EVIDENCE_RUNTIME_ERROR',
      phase: 'create-app',
      transportFailure: false,
    });
    expect(parsed.readObservations[0].probes[0].error).toMatchObject({
      category: 'transport',
      code: 'ECONNRESET',
      operation: 'SimpleProcess.getProcessById',
      transportFailure: true,
    });
    expect(parsed.readObservations[0].probes[0].pathTemplate).toBeUndefined();
    expect(parsed.readObservations[0].probes[0].transportError).toBeUndefined();
    for (const forbidden of forbiddenValues.concat([
      'Cookie=',
      'Authorization:',
      'token-secret-should-not-appear',
      'csrf-secret-should-not-appear',
      'https://internal.example.test',
    ])) {
      expect(raw).not.toContain(forbidden);
    }
  });

  test('scrubs historical pathTemplate and transportError fields', () => {
    const forbiddenValues = ['APP_SAC06_REALISTIC_123456'];
    const scrubbed = scrubEvidenceForWrite({
      pathTemplate: '/alibaba/web/{appType}/query/process/pageProcessVersion.json',
      nested: {
        transportError: 'Cookie=secret APP_SAC06_REALISTIC_123456',
        safe: 'Process.getProcessVersionInfo',
      },
    }, forbiddenValues);
    const evidencePath = path.join(tempDir, 'scrubbed.json');
    fs.writeFileSync(evidencePath, `${JSON.stringify(scrubbed, null, 2)}\n`, 'utf8');

    expect(scrubbed.pathTemplate).toBeUndefined();
    expect(scrubbed.nested.transportError).toBeUndefined();
    expect(scrubbed.nested.safe).toBe('Process.getProcessVersionInfo');
    expect(leakScan([evidencePath], forbiddenValues).passed).toBe(true);
  });

  test('does not trust arbitrary upstream error codes', () => {
    const injectedCodeError = new Error('synthetic failure');
    injectedCodeError.code = 'COOKIE_VALUE';
    const projectedInjected = projectError(injectedCodeError, {
      category: 'transport',
      phase: 'read',
      transportFailure: true,
    });
    expect(projectedInjected).toMatchObject({
      category: 'transport',
      code: 'TRANSPORT_FAILURE',
      phase: 'read',
      transportFailure: true,
    });

    const allowedTransportError = new Error('synthetic timeout');
    allowedTransportError.code = 'ETIMEDOUT';
    const projectedTransport = projectError(allowedTransportError, {
      category: 'transport',
      phase: 'read',
      transportFailure: true,
    });
    expect(projectedTransport.code).toBe('ETIMEDOUT');
  });

  test('writes only a minimal envelope when serialized leak scan fails', () => {
    const evidencePath = path.join(tempDir, 'evidence.v1.json');
    const evidence = {
      kind: 'openyida_schema_process_api_evidence',
      version: 1,
      runId: 'schema-process-evidence-safe-run',
      status: 'failed',
      login: {
        source: 'local-cache',
        preflightPassed: true,
      },
      nested: {
        retainedByScrubber: 'SCAN_ONLY_SECRET_TOKEN_VALUE',
      },
    };

    const written = writeSafeEvidence(evidencePath, evidence, [], {
      phase: 'finalize-evidence',
      throwOnLeak: false,
      extraScanPatterns: [/SCAN_ONLY_SECRET_TOKEN_VALUE/],
    });
    const raw = fs.readFileSync(evidencePath, 'utf8');
    const parsed = JSON.parse(raw);

    expect(written).toEqual(parsed);
    expect(parsed).toEqual({
      kind: 'openyida_schema_process_api_evidence',
      version: 1,
      runId: 'schema-process-evidence-safe-run',
      status: 'failed',
      error: {
        category: 'redaction',
        code: 'EVIDENCE_LEAK_SCAN_FAILED',
        phase: 'finalize-evidence',
        operation: null,
        transportFailure: false,
      },
    });
    expect(raw).not.toContain('SCAN_ONLY_SECRET_TOKEN_VALUE');
    expect(raw).not.toContain('nested');
    expect(raw).not.toContain('leakScan');
  });

  test('shrinks login and command evidence to stable local facts', () => {
    const scrubbed = scrubEvidenceForWrite({
      login: {
        source: 'external-local-cache',
        cookieFileSha256: 'abc123',
        cookiesCount: 22,
        hasCsrf: true,
        baseUrlHash: 'def456',
      },
      commands: [
        {
          command: 'login --check-only',
          status: 0,
          stdoutJsonKeys: ['can_auto_use', 'corp_id', 'csrf_token', 'diagnostics', 'user_id'],
          stdoutJsonShape: {
            type: 'object',
            fields: {
              status: 'ok',
              can_auto_use: { type: 'boolean', value: true },
              diagnostics: {
                type: 'object',
                keys: ['cookieFile', 'legacyCookieFile'],
              },
            },
          },
        },
        {
          command: 'create-app',
          status: 0,
          stdoutJsonKeys: ['appType', 'corpId'],
          stdoutJsonShape: { type: 'object' },
          stdoutSha256: 'hash',
        },
      ],
    }, []);

    expect(scrubbed).toEqual({
      login: {
        source: 'local-cache',
        preflightPassed: true,
      },
      commands: [
        {
          command: 'login --check-only',
          status: 0,
          preflightStatus: 'ok',
          canAutoUse: true,
        },
        {
          command: 'create-app',
          status: 0,
        },
      ],
    });
    const raw = JSON.stringify(scrubbed);
    for (const disallowed of [
      'cookieFileSha256',
      'cookiesCount',
      'hasCsrf',
      'baseUrlHash',
      'corp_id',
      'user_id',
      'csrf_token',
      'cookieFile',
      'legacyCookieFile',
      'diagnostics',
      'stdoutJsonKeys',
      'stdoutJsonShape',
      'corpId',
    ]) {
      expect(raw).not.toContain(disallowed);
    }
  });
});
