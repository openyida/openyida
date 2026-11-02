'use strict';

jest.mock('../lib/core/utils', () => ({ detectActiveTool: jest.fn(), detectRuntimeCapabilities: jest.fn() }));
const utils = require('../lib/core/utils');
const { browserVerificationPolicy, buildBrowserHandoff } = require('../lib/core/browser-handoff');
const fs = require('fs');
const path = require('path');
const originalEnv = process.env;
beforeEach(() => {
  process.env = {};
  utils.detectActiveTool.mockReturnValue({ tool: 'qwenwork' });
});
afterEach(() => { process.env = originalEnv; });

test.each(['web_sandbox', 'cloud', 'remote', 'unknown', 'agent_cli'])(
  '%s cannot open an agent browser even with browser capability or explicit --open', runtime => {
    utils.detectRuntimeCapabilities.mockReturnValue({ tool: 'qwenwork', runtime,
      capabilities: { agent_browser: true, desktop_shell: true } });
    for (const mode of [null, true]) {
      expect(buildBrowserHandoff('https://public.example/page', {}, mode)).toMatchObject({
        status: 'present_url', can_auto_use: false, agent_action: 'present_url_to_user',
        browser_verification: { allowed: false, action: 'do_not_open_browser',
          unavailable: 'record_internal_not_checked_and_continue_readback', default_user_action_required: false },
      });
    }
  });

test.each([
  { OPENYIDA_MANAGED_RUNTIME: 'cloud', OPENYIDA_ASSUME_DESKTOP: '1' },
  { OPENYIDA_MANAGED_RUNTIME: 'remote' },
  { SSH_CONNECTION: 'remote-session' },
  { SSH_CLIENT: 'remote-client' },
  { SSH_TTY: '/dev/pts/1' },
  { SESSIONNAME: 'RDP-Tcp#1' },
  { VSCODE_REMOTE_NAME: 'ssh-remote' },
  { CODESPACES: 'true' },
  { CI: '1' },
])('remote signals %j take precedence over a desktop and browser capability', env => {
  expect(browserVerificationPolicy({ tool: 'codex', runtime: 'desktop_shell',
    browser_capabilities: { agent_browser: true } }, env)).toMatchObject({
    execution_location: 'remote', allowed: false, action: 'do_not_open_browser',
  });
});

test('local agent keeps the user entry handoff but does not claim page verification', () => {
  utils.detectRuntimeCapabilities.mockReturnValue({ tool: 'qwenwork', runtime: 'desktop_shell' });
  expect(buildBrowserHandoff('https://example.com/app')).toMatchObject({
    status: 'open_url', can_auto_use: true, agent_action: 'open_url_in_in_app_browser',
    browser_verification: { execution_location: 'local', allowed: true },
  });
  expect(buildBrowserHandoff('https://example.com/app', {}, false)).toBeNull();
});

test('entry and delivery skills condition browser acceptance on location, not browser availability', () => {
  const root = fs.readFileSync(path.join(__dirname, '../yida-skills/SKILL.md'), 'utf8');
  const finish = fs.readFileSync(path.join(__dirname, '../yida-skills/skills/yida-app/workflow/step-9-output-finish.md'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '../yida-skills/skills/yida-design/references/application-style-library.md'), 'utf8');
  expect(root).toContain('references/execution-rules.md#本地浏览器验收');
  expect(root).toContain('浏览器验收仅限用户本机 Agent');
  expect(root).not.toContain('两个入口均须实际打开验收');
  expect(finish).toContain('浏览器检查先按执行位置判定');
  expect(finish).toContain('云端页面未验不转为用户补验任务');
  expect(finish).toContain('真实业务缺口及用户明确要求但未执行的验收须说明');
  expect(finish).not.toContain('`runtimeVerified=false` 仍需实际打开验证');
  expect(styles).toContain('页面检查按[本地浏览器验收]');
  expect(styles).not.toContain('没有浏览器证据时补充“访问态效果待验证”');
});
