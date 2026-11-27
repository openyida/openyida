'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildLoginLoopFeedbackHint,
  getLoginLoopStatus,
  getReminderStatus,
  parseArgs,
  recordLoginEvent,
} = require('../lib/feedback/feedback');

describe('feedback command helpers', () => {
  test('legacy URL options are accepted but their values are discarded', () => {
    expect(parseArgs(['url', '--tool', 'Codex', '--diagnostics', 'private-diagnostics', '--json'])).toEqual({
      command: 'url',
      options: { json: true },
    });

    expect(parseArgs(['dismiss', '--today'])).toMatchObject({
      command: 'dismiss',
      options: { today: true },
    });
  });

  test('login-loop hint directs users to prepare feedback locally', () => {
    expect(buildLoginLoopFeedbackHint({ shouldSuggestFeedback: true, windowMinutes: 30 })).not.toHaveProperty('feedbackUrl');
  });

  test('login loop status trips after repeated login events and respects reminder state', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-feedback-'));
    const configPath = path.join(tempDir, 'config.json');

    expect(getReminderStatus(configPath).shouldRemind).toBe(true);

    recordLoginEvent('trigger', { reason: 'missing_cookie' }, { configPath });
    recordLoginEvent('need_qr_scan', { reason: 'need_qr_scan' }, { configPath });
    const status = recordLoginEvent('failed', { reason: 'no_cookie_after_login' }, { configPath });

    expect(status.detected).toBe(true);
    expect(status.shouldSuggestFeedback).toBe(true);
    expect(getLoginLoopStatus(configPath).count).toBe(3);
  });
});

describe('feedback logs evidence snapshots', () => {
  const { exportCommandLog, parseArgs } = require('../lib/feedback/feedback');
  const firstId = 'ef539a9d-e4eb-4799-bb3c-a6aba8237239';
  const otherId = '1fb3f4d4-e558-4727-96ca-ce3929e35f24';
  const timeArgs = ['--since', '2026-11-27T10:34:00+08:00', '--until', '2026-11-27T10:35:00+08:00'];
  let dir, output;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-feedback-log-export-'));
    output = path.join(dir, 'snapshot.jsonl');
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('selects the reviewed command IDs and refuses to replace a snapshot', () => {
    const { options } = parseArgs(['logs', ...timeArgs, '--output', output, '--command-id', firstId.toUpperCase(), '--json']);
    const row = { commandExecutionId: firstId, command: 'create-app', status: 'success' };
    const read = jest.fn(() => [row, { ...row, commandExecutionId: otherId }]);
    expect(exportCommandLog(options, read)).toMatchObject({ count: 1, output });
    expect(read).toHaveBeenCalledWith({ since: Date.parse(timeArgs[1]), until: Date.parse(timeArgs[3]) });
    expect(fs.readFileSync(output, 'utf8')).toBe(JSON.stringify(row) + '\n');
    if (process.platform !== 'win32') {expect(fs.statSync(output).mode & 0o077).toBe(0);}
    expect(() => exportCommandLog(options, read)).toThrow();
  });
  test('requires an explicit time window and reports missing evidence without creating a file', () => {
    expect(() => parseArgs(['logs', '--output', output])).toThrow();
    expect(() => parseArgs(['logs', '--since', timeArgs[3], '--until', timeArgs[1], '--output', output])).toThrow();
    expect(() => parseArgs(['logs', ...timeArgs, '--output', output, '--command-id', 'not-an-id'])).toThrow();
    expect(exportCommandLog(parseArgs(['logs', ...timeArgs, '--output', output]).options, () => [])).toMatchObject({ count: 0, output: null, status: 'no_records' });
    expect(fs.existsSync(output)).toBe(false);
  });
});
