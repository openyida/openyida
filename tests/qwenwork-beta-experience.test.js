'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { install } = require('../scripts/install-qwenwork-pre-beta');

describe('千问办公 beta 的可选技能安装', () => {
  let directory; let source; let target; let backupRoot;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-optional-skills-'));
    source = path.join(directory, 'source'); target = path.join(directory, 'skills/yida-skills'); backupRoot = path.join(directory, 'backups');
    fs.mkdirSync(source); fs.writeFileSync(path.join(source, 'SKILL.md'), 'new skill');
    fs.mkdirSync(target, { recursive: true }); fs.writeFileSync(path.join(target, 'SKILL.md'), 'old skill');
  });
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));
  test('正常更新保留备份且安装脚本成功时无输出', () => {
    const result = spawnSync(process.execPath, [path.join(__dirname, '../scripts/install-qwenwork-pre-beta.js'), '--target-dir', target], { encoding: 'utf8', env: process.env });
    expect(result.status).toBe(0); expect(result.stdout).toBe(''); expect(result.stderr).toBe('');
    expect(fs.readFileSync(path.join(target, 'SKILL.md'), 'utf8')).toBe(fs.readFileSync(path.join(__dirname, '../yida-skills/SKILL.md'), 'utf8'));
  });
  test.each(['cpSync', 'backup', 'activate'])('受限或复制失败时保留旧技能且不抛异常：%s', operation => {
    const denied = () => { const error = new Error('denied'); error.code = 'EPERM'; throw error; };
    const io = { ...fs,
      cpSync: (...args) => operation === 'cpSync' ? denied() : fs.cpSync(...args),
      mkdirSync: (...args) => operation === 'backup' && args[0] === backupRoot ? denied() : fs.mkdirSync(...args),
      renameSync: (...args) => operation === 'activate' && args[1] === target && String(args[0]).includes('.openyida-installing-') ? denied() : fs.renameSync(...args),
    };
    expect(install({ source, target, backupRoot, fs: io })).toEqual({ status: 'skipped' });
    expect(fs.readFileSync(path.join(target, 'SKILL.md'), 'utf8')).toBe('old skill');
    expect(fs.readdirSync(path.dirname(target))).toEqual(['yida-skills']);
  });
});

describe('千问办公桌面端的后台认证摘要', () => {
  afterEach(() => { jest.resetModules(); jest.dontMock('../package.json'); jest.dontMock('../lib/core/env'); jest.dontMock('../lib/core/utils'); });
  function summary(runtime) {
    jest.resetModules();
    jest.doMock('../package.json', () => ({ ...jest.requireActual('../package.json'), openyidaLocalBeta: { desktopTicketLogin: true } }));
    jest.doMock('../lib/core/env', () => ({ buildEnvironmentSnapshot: () => ({ active: { projectRoot: os.tmpdir(), projectRootExists: true } }) }));
    jest.doMock('../lib/core/utils', () => ({
      findProjectRoot: () => os.tmpdir(), detectRuntimeCapabilities: () => runtime,
      getAuthStatus: () => ({ status: 'ok', can_auto_use: true, auth_source: 'user_profile', auth_mode: 'token', corp_id: 'private-corp', user_id: 'private-user', corp_name: 'private-name', auth_profile: 'private-profile' }),
    }));
    return require('../lib/core/agent-capabilities').buildAgentCapabilitiesSummary();
  }
  test('桌面摘要仅保留登录是否可用并要求静默交付业务结果', () => {
    const result = summary({ tool: 'qwenwork', subtype: 'qwenwork_desktop' });
    expect(result.login).toEqual({ status: 'ok', can_auto_use: true });
    expect(result.builder_path.interactive_login).toMatchObject({ mode: 'desktop_ticket', user_visible: false, success_action: 'continue_business_command_without_message' });
    expect(result.builder_path.communication).toMatchObject({ preparation_visibility: 'silent', completion_content: 'business_result_and_business_link_only', disclose_authentication_identity_environment: false });
    for (const value of ['private-corp', 'private-user', 'private-name', 'private-profile']) { expect(JSON.stringify(result)).not.toContain(value); }
  });
  test('网页摘要选择云端免登并隐藏身份', () => {
    const result = summary({ tool: 'qwenwork', subtype: 'qwenwork_web' });
    expect(result.login).toEqual({ status: 'ok', can_auto_use: true });
    expect(result.builder_path.interactive_login).toMatchObject({ mode: 'cloud_token', browser_owner: 'none', user_visible: false });
    expect(JSON.parse(JSON.stringify(result.builder_path.auth))).not.toHaveProperty('corp_id');
  });
  test.each([{ tool: 'codex', subtype: 'codex' }, { tool: 'claude-code', subtype: 'claude-code' }, {}])('其他宿主保留原认证和输出契约：%j', runtime => {
    const result = summary(runtime);
    expect(result.login.corp_id).toBe('private-corp');
    expect(result.builder_path.interactive_login.mode).not.toBe('desktop_ticket');
    expect(result.builder_path.communication).toBeUndefined();
  });
});
