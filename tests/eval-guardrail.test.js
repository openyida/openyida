'use strict';

const {
  isMutatingCommand,
  isLoginCheck,
  assertLoginBeforeMutation,
  runGuardrails,
  hasGuardrailFailure,
} = require('../scripts/eval/guardrail');

describe('eval guardrail', () => {
  test.each([
    ['form-message', 'create'], ['form-message', 'update'], ['form-message', 'delete'],
    ['print-template', 'create'], ['print-template', 'save'], ['print-template', 'render'],
    ['custom-button', 'create'], ['custom-button', 'update'], ['custom-button', 'delete'],
    ['form-view', 'create'], ['form-view', 'save'], ['form-view', 'order'],
    ['data-card', 'save'], ['data-card', 'publish'], ['data-card', 'release-get'],
    ['cool-card', 'create'], ['data', 'transfer'], ['integration', 'delete'],
  ])('%s %s 必须有前置登录校验', (...args) => {
    const mutation = { args: [...args, 'APP_X', 'FORM_X'] };
    expect(assertLoginBeforeMutation([mutation]).status).toBe('fail');
    expect(hasGuardrailFailure(runGuardrails({ commands: [mutation] }))).toBe(true);
    const { checkLoginBeforeMutation } = require('../scripts/eval/safety');
    expect(checkLoginBeforeMutation([mutation.args]).status).toBe('fail');
    expect(assertLoginBeforeMutation([mutation, { args: ['login', '--check-only'] }]).status).toBe('fail');
    expect(assertLoginBeforeMutation([{ args: ['login', '--check-only'] }, mutation]).status).toBe('pass');
  });

  test.each([
    ['form-message', 'list'], ['form-message', 'inspect'], ['form-message', 'options'],
    ['print-template', 'fields'], ['custom-button', 'inspect'], ['form-view', 'list'],
    ['data-card', 'get'], ['cool-card', 'templates'], ['i18n', 'config'],
    ['integration', 'update', 'APP_X', '--dry-run'],
    ['app-theme', 'restore', 'APP_X', '--check'],
    ['compile', 'page.js'], ['formula', 'evaluate', '1+1'],
  ])('%s %s 只读或本地操作不要求资源写入校验', (...args) => {
    expect(isMutatingCommand({ args })).toBe(false);
    expect(assertLoginBeforeMutation([{ args }]).status).toBe('skipped');
  });

  test('未知命令、未知混合动作保守检查，不因参数中的只读词跳过', () => {
    for (const args of [['future-command', 'create'], ['form-message', 'future-action'],
      ['form-message', 'create', '--title', 'list'], ['app-theme', 'restore', 'APP_X', '--confirm']]) {
      expect(isMutatingCommand({ args })).toBe(true);
    }
  });

  test('自动覆盖清单中的每个远程写命令及别名', () => {
    const { flattenCommandManifest } = require('../lib/core/command-manifest');
    const writes = flattenCommandManifest().filter(entry => entry.sideEffect.mutates_yida);
    expect(writes.length).toBeGreaterThan(0);
    for (const entry of writes) {
      const actions = entry.sideEffect.kind === 'mixed' ? entry.sideEffect.mutating_actions : [''];
      for (const path of [entry.path, ...entry.aliases.map(alias => alias.split(/\s+/))]) {
        for (const action of actions) {
          const args = [...path, ...action.split(/\s+/).filter(Boolean)];
          expect(isMutatingCommand({ args })).toBe(true);
          expect(assertLoginBeforeMutation([{ args }]).status).toBe('fail');
        }
      }
    }
  });

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
