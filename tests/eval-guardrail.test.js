'use strict';

const {
  isMutatingCommand,
  isLoginCheck,
  assertLoginBeforeMutation,
  runGuardrails,
  hasGuardrailFailure,
} = require('../scripts/eval/guardrail');

describe('eval guardrail', () => {
  test('isLoginCheck 识别只读登录校验', () => {
    expect(isLoginCheck({ args: ['login', '--check-only', '--json'] })).toBe(true);
    expect(isLoginCheck({ args: ['login'] })).toBe(false);
    expect(isLoginCheck({ args: ['create-app', 'x'] })).toBe(false);
  });

  test('isMutatingCommand 识别资源变更命令', () => {
    expect(isMutatingCommand({ args: ['create-app', 'X'] })).toBe(true);
    expect(isMutatingCommand({ args: ['publish', 'p', 'APP', 'pid'] })).toBe(true);
    expect(isMutatingCommand({ args: ['append-chart'] })).toBe(true);
    expect(isMutatingCommand({ args: ['data', 'create', 'form'] })).toBe(true);
    expect(isMutatingCommand({ args: ['data', 'query', 'form'] })).toBe(false);
    expect(isMutatingCommand({ args: ['get-schema'] })).toBe(false);
    expect(isMutatingCommand({ args: [] })).toBe(false);
    expect(isMutatingCommand({ args: ['upgrade-app-theme', 'APP', '--prepare'] })).toBe(false);
    expect(isMutatingCommand({ args: ['upgrade-app-theme', 'APP', '--confirm'] })).toBe(true);
    expect(isMutatingCommand({ args: ['upgrade-app-theme', 'APP', '--prepare', '--confirm'] })).toBe(true);
  });

  test('pass：登录校验在前，变更在后', () => {
    const commands = [
      { name: 'login', args: ['login', '--check-only', '--json'] },
      { name: 'create-app', args: ['create-app', 'X'] },
    ];
    const r = assertLoginBeforeMutation(commands);
    expect(r.status).toBe('pass');
  });

  test('fail：变更出现在登录校验之前', () => {
    const commands = [
      { name: 'create-app', args: ['create-app', 'X'] },
      { name: 'login', args: ['login', '--check-only', '--json'] },
    ];
    const r = assertLoginBeforeMutation(commands);
    expect(r.status).toBe('fail');
    expect(r.detail).toMatch(/之前/);
  });

  test('fail：完全没有登录校验就建资源', () => {
    const commands = [{ name: 'create-app', args: ['create-app', 'X'] }];
    const r = assertLoginBeforeMutation(commands);
    expect(r.status).toBe('fail');
  });

  test('skipped：没有任何资源变更命令', () => {
    const commands = [
      { name: 'login', args: ['login', '--check-only', '--json'] },
      { name: 'get-schema', args: ['get-schema', 'APP'] },
    ];
    const r = assertLoginBeforeMutation(commands);
    expect(r.status).toBe('skipped');
  });

  test('runGuardrails + hasGuardrailFailure', () => {
    const pass = runGuardrails({ commands: [
      { args: ['login', '--check-only'] },
      { args: ['create-app', 'X'] },
    ] });
    expect(hasGuardrailFailure(pass)).toBe(false);

    const fail = runGuardrails({ commands: [
      { args: ['create-app', 'X'] },
    ] });
    expect(hasGuardrailFailure(fail)).toBe(true);
  });
});
