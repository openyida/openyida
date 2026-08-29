'use strict';

const {
  redactArgs,
  normalizeTraceEntry,
  parseCommandTrace,
  createCommandTraceSession,
} = require('../scripts/eval/command-trace');
const { spawnSync } = require('child_process');

describe('eval command trace', () => {
  test('redactArgs 脱敏分离值、等号值和 Bearer', () => {
    const result = redactArgs([
      'login', '--token', 'secret-a', '--client-secret=secret-b', 'Bearer secret-c', '--json',
    ]);
    expect(result.args).toEqual([
      'login', '--token', '[REDACTED]', '--client-secret=[REDACTED]', 'Bearer [REDACTED]', '--json',
    ]);
    expect(result.redactions).toBe(3);
  });

  test('parseCommandTrace 解析 NDJSON 并跳过坏行', () => {
    const trace = [
      JSON.stringify({ name: 'openyida', args: ['login', '--check-only'], exitCode: 0 }),
      'not-json',
      JSON.stringify({ command: 'yida', argv: ['create-app', 'CRM'], status: 1 }),
    ].join('\n');
    const commands = parseCommandTrace(trace);
    expect(commands).toHaveLength(2);
    expect(commands[0].ok).toBe(true);
    expect(commands[1].name).toBe('yida');
    expect(commands[1].ok).toBe(false);
  });

  test('normalizeTraceEntry 统一 argv/status 字段', () => {
    expect(normalizeTraceEntry({ argv: ['list-forms', 'APP_X'], status: 0 })).toMatchObject({
      args: ['list-forms', 'APP_X'], exitCode: 0, ok: true, source: 'harness-cli-trace',
    });
  });

  (process.platform === 'win32' ? test.skip : test)('临时 shim 转发命令并留下脱敏轨迹', () => {
    const lookup = () => ({ status: 0, stdout: '/usr/bin/true\n' });
    const session = createCommandTraceSession({ spawn: lookup, env: process.env, cliNames: ['openyida'] });
    try {
      const result = spawnSync('openyida', ['create-app', 'CRM', '--token', 'secret'], {
        env: session.env,
        encoding: 'utf8',
      });
      expect(result.status).toBe(0);
      const commands = session.read();
      expect(commands).toHaveLength(1);
      expect(commands[0]).toMatchObject({
        name: 'openyida', args: ['create-app', 'CRM', '--token', '[REDACTED]'], ok: true, exitCode: 0,
      });
    } finally {
      session.cleanup();
    }
  });
});
