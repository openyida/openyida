'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createDiagnosticLog, isProductLog, readRecentCredentialFailures } = require('../lib/agent/diagnostic-log');

describe('local Agent diagnostic log', () => {
  let root;
  beforeEach(() => {root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-diagnostic-'));});
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test('persists only allowlisted and redacted lifecycle fields', () => {
    const write = createDiagnosticLog(root);
    write('error', 'runtime_spawn_failed', {
      command: 'run', errorCode: 'AGENT_RUNTIME_START_FAILED',
      status: 'Bearer secret-value', token: 'never-write-this', prompt: 'private user text',
    });
    const files = fs.readdirSync(root);
    expect(files).toHaveLength(1);
    expect(isProductLog(files[0])).toBe(true);
    const raw = fs.readFileSync(path.join(root, files[0]), 'utf8');
    expect(raw).toContain('AGENT_RUNTIME_START_FAILED');
    expect(raw).toContain('Bearer ***');
    expect(raw).not.toContain('secret-value');
    expect(raw).not.toContain('never-write-this');
    expect(raw).not.toContain('private user text');
  });

  test('cleanup ignores unrelated jsonl files', () => {
    const unrelated = path.join(root, 'notes.jsonl');
    fs.writeFileSync(unrelated, 'keep');
    createDiagnosticLog(root)('info', 'launcher_started', { command: 'diagnose' });
    expect(fs.readFileSync(unrelated, 'utf8')).toBe('keep');
  });

  test('cleanup bounds the number of product log files', () => {
    for (let index = 0; index < 260; index++) {
      fs.writeFileSync(path.join(root, `openyida-local-agent-runtime-20260915T000000Z-${1000 + index}.0.jsonl`), '{}\n');
    }
    createDiagnosticLog(root)('info', 'launcher_started', { command: 'diagnose' });
    expect(fs.readdirSync(root).filter(isProductLog).length).toBeLessThanOrEqual(256);
  });

  test('reads credential rejection without paired state or exposing arbitrary fields', () => {
    const file = path.join(root, 'openyida-local-agent-runtime-20260915T000000Z-123.0.jsonl');
    const record = { schema: 'openyida.local_agent.diagnostic.v1', timestamp: new Date().toISOString(),
      event: 'runtime_failed', errorCode: 'DEVICE_CREDENTIAL_RESPONSE_INVALID', phase: 'connect',
      credentialReason: 'access_expired', accessRemainingSeconds: -2, refreshRemainingSeconds: 604798,
      endpointId: 'pre-test', accessToken: 'private-token', message: 'private-user-content' };
    fs.writeFileSync(file, `${JSON.stringify(record)}\n{"partial":`);
    const result = readRecentCredentialFailures(root);
    expect(result).toEqual([expect.objectContaining({ historical: true, phase: 'connect',
      credentialReason: 'access_expired', accessRemainingSeconds: -2, endpointId: 'pre-test' })]);
    expect(JSON.stringify(result)).not.toContain('private');
    expect(fs.existsSync(path.join(root, 'device.json'))).toBe(false);
  });

  test('ignores stale, foreign, malformed, oversized and symlink log inputs', () => {
    const now = Date.now();
    const base = { schema: 'openyida.local_agent.diagnostic.v1', event: 'runtime_failed',
      errorCode: 'DEVICE_CREDENTIAL_RESPONSE_INVALID', timestamp: new Date(now).toISOString() };
    const records = [{ ...base, timestamp: new Date(now - 7200001).toISOString() },
      { ...base, timestamp: 'invalid' }, { ...base, schema: 'foreign' },
      { ...base, event: 'other' }, { ...base, errorCode: 'other' }];
    const product = path.join(root, 'openyida-local-agent-runtime-20260915T000000Z-124.0.jsonl');
    fs.writeFileSync(product, records.map(record => JSON.stringify(record)).join('\n'));
    fs.writeFileSync(path.join(root, 'user-notes.jsonl'), JSON.stringify(base));
    const large = path.join(root, 'openyida-local-agent-runtime-20260915T000000Z-125.0.jsonl');
    fs.writeFileSync(large, `${JSON.stringify(base)}\n${'x'.repeat(5 * 1024 * 1024)}`);
    if (process.platform !== 'win32') {
      fs.symlinkSync(path.join(root, 'user-notes.jsonl'), path.join(root, 'openyida-local-agent-runtime-20260915T000000Z-126.0.jsonl'));
    }
    expect(readRecentCredentialFailures(root, now)).toEqual([]);
  });

  test('limits recent failures and validates every exported value', () => {
    const now = Date.now();
    const records = Array.from({ length: 12 }, (_, index) => ({
      schema: 'openyida.local_agent.diagnostic.v1', event: 'runtime_failed', errorCode: 'DEVICE_CREDENTIAL_RESPONSE_INVALID',
      timestamp: new Date(now-index*1000).toISOString(), credentialReason: 'private-token',
      endpointId: 'https://private.example/?token=secret', phase: 'private-output', accessRemainingSeconds: 'private-token',
    }));
    fs.writeFileSync(path.join(root, 'openyida-local-agent-runtime-20260915T000000Z-127.0.jsonl'), records.map(record=>JSON.stringify(record)).join('\n'));
    const result = readRecentCredentialFailures(root, now);
    expect(result).toHaveLength(5);
    expect(result[0].timestamp).toBe(new Date(now).toISOString());
    expect(JSON.stringify(result)).not.toContain('private');
    expect(result[0]).not.toHaveProperty('credentialReason');
  });

  test('includes live refresh failures before the Runtime exits', () => {
    fs.writeFileSync(path.join(root, 'openyida-local-agent-runtime-20260915T000000Z-128.0.jsonl'), JSON.stringify({
      schema: 'openyida.local_agent.diagnostic.v1', timestamp: new Date().toISOString(),
      event: 'connection_error', errorCode: 'DEVICE_CREDENTIAL_RESPONSE_INVALID',
      phase: 'reauthenticate', credentialReason: 'rotation_binding_invalid', endpointId: 'pre-test',
    }));
    expect(readRecentCredentialFailures(root)).toEqual([expect.objectContaining({phase: 'reauthenticate', credentialReason: 'rotation_binding_invalid'})]);
  });
});
