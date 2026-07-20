'use strict';

const {
  AGENT_ADAPTERS,
  agentBasename,
  resolveAgentCommand,
  getAgentAdapter,
  runAgent,
} = require('../scripts/eval/agent');

describe('eval agent adapter', () => {
  test('resolveAgentCommand 默认 claude，环境变量优先', () => {
    expect(resolveAgentCommand({})).toBe('claude');
    expect(resolveAgentCommand({ OPENYIDA_EVAL_AGENT_CMD: 'qodercli' })).toBe('qodercli');
    expect(resolveAgentCommand({ OPENYIDA_EVAL_AGENT_CMD: '  ' })).toBe('claude');
  });

  test('agentBasename 去掉路径与后缀', () => {
    expect(agentBasename('/usr/local/bin/qodercli')).toBe('qodercli');
    expect(agentBasename('claude')).toBe('claude');
    expect(agentBasename('C:/tools/claude.exe')).toBe('claude');
  });

  test('getAgentAdapter 匹配 qodercli，未知回退 claude', () => {
    expect(getAgentAdapter('qodercli')).toBe(AGENT_ADAPTERS.qodercli);
    expect(getAgentAdapter('/opt/bin/qodercli')).toBe(AGENT_ADAPTERS.qodercli);
    expect(getAgentAdapter('unknown-agent')).toBe(AGENT_ADAPTERS.claude);
  });

  test('claude 与 qodercli 的权限/工具白名单 flag 写法不同', () => {
    expect(AGENT_ADAPTERS.claude.permissionBypass).toEqual(['--permission-mode', 'bypassPermissions']);
    expect(AGENT_ADAPTERS.qodercli.permissionBypass).toEqual(['--permission-mode', 'bypass_permissions']);
    expect(AGENT_ADAPTERS.claude.allowedTools(['Bash', 'Read'])).toEqual(['--allowedTools', 'Bash', 'Read']);
    expect(AGENT_ADAPTERS.qodercli.allowedTools(['Bash', 'Read']))
      .toEqual(['--allowed-tools', 'Bash', '--allowed-tools', 'Read']);
  });

  test('runAgent 用注入 spawn 时使用配置的命令，并解析通用信封', () => {
    const calls = [];
    const fakeSpawn = (command, args) => {
      calls.push({ command, args });
      return {
        status: 0,
        stdout: JSON.stringify({ type: 'result', is_error: false, result: '{"skill":"yida-app"}' }),
        stderr: '',
      };
    };
    const res = runAgent({ prompt: 'hi', command: 'qodercli', spawn: fakeSpawn });
    expect(calls[0].command).toBe('qodercli');
    expect(res.available).toBe(true);
    expect(res.ok).toBe(true);
    expect(res.json).toEqual({ skill: 'yida-app' });
  });

  test('runAgent 识别 is_error 信封为调用失败（未登录等）', () => {
    const fakeSpawn = () => ({
      status: 0,
      stdout: JSON.stringify({ type: 'result', is_error: true, result: 'Not logged in · Please run /login' }),
      stderr: '',
    });
    const res = runAgent({ prompt: 'hi', command: 'qodercli', spawn: fakeSpawn });
    expect(res.ok).toBe(false);
    expect(res.json).toBeNull();
    expect(res.error).toMatch(/Not logged in/);
  });
});
