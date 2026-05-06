'use strict';

jest.mock('../lib/core/env-manager', () => ({
  resolveLoginUrl: jest.fn(() => 'https://www.aliwork.com/workPlatform'),
}));

jest.mock('../lib/core/chalk', () => ({
  banner: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  hint: jest.fn(),
  success: jest.fn(),
  label: jest.fn(),
}));

const { codexLogin } = require('../lib/auth/codex-login');
const chalk = require('../lib/core/chalk');

describe('codexLogin', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CLAUDE_CODE;
    delete process.env.OPENCODE;
    delete process.env.QODER_IDE;
    delete process.env.QODER_AGENT;
    delete process.env.CURSOR_TRACE_ID;
    delete process.env.AGENT_WORK_ROOT;
    delete process.env.TERM_PROGRAM;
    delete process.env.VSCODE_GIT_ASKPASS_NODE;
    delete process.env.CODEX_CI;
    delete process.env.CODEX_THREAD_ID;
    delete process.env.CODEX_HOME;
    delete process.env.__CFBundleIdentifier;
    process.env.CODEX_SHELL = '1';
  });

  afterEach(() => {
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) {delete process.env[key];}
    });
    Object.assign(process.env, originalEnv);
  });

  test('Codex 环境下返回内置浏览器登录 handoff，不触发 Playwright 或终端 QR', async () => {
    const result = await codexLogin();

    expect(result).toMatchObject({
      status: 'need_codex_browser_login',
      browser: 'codex',
      login_url: 'https://www.aliwork.com/workPlatform',
      can_auto_use: false,
    });
    expect(chalk.info).toHaveBeenCalledWith(expect.stringContaining('Playwright'));
    expect(chalk.warn).not.toHaveBeenCalled();
    expect(chalk.label).toHaveBeenCalledWith('URL', 'https://www.aliwork.com/workPlatform');
  });

  test('非 Codex 环境下给出提示后仍返回浏览器登录 handoff', async () => {
    delete process.env.CODEX_SHELL;
    delete process.env.CODEX_CI;
    delete process.env.CODEX_THREAD_ID;
    delete process.env.CODEX_HOME;

    const result = await codexLogin();

    expect(chalk.warn).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('need_codex_browser_login');
  });
});
