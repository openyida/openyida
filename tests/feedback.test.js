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
