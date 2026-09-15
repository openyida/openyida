'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createDiagnosticLog, isProductLog } = require('../lib/agent/diagnostic-log');

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
});
