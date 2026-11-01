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
  function summary(runtime, login = {}) {
    jest.resetModules();
    jest.doMock('../lib/core/env', () => ({ buildEnvironmentSnapshot: () => ({ active: { projectRoot: os.tmpdir(), projectRootExists: true } }) }));
    jest.doMock('../lib/core/utils', () => ({
      findProjectRoot: () => os.tmpdir(), detectRuntimeCapabilities: () => runtime,
      getAuthStatus: () => ({ status: 'ok', can_auto_use: true, auth_source: 'user_profile', auth_mode: 'token', corp_id: 'private-corp', user_id: 'private-user', corp_name: 'private-name', auth_profile: 'private-profile', ...login }),
    }));
    return require('../lib/core/agent-capabilities').buildAgentCapabilitiesSummary();
  }
  test('桌面摘要仅保留登录是否可用并要求静默交付业务结果', () => {
    const result = summary({ tool: 'qwenwork', subtype: 'qwenwork_desktop' });
    expect(result.login).toEqual({ status: 'ok', can_auto_use: true });
    expect(result.builder_path.interactive_login).toMatchObject({ mode: 'desktop_ticket', user_visible: false, success_action: 'continue_business_command_without_message' });
    expect(result.builder_path.communication).toMatchObject({
      preparation_visibility: 'silent', completion_content: 'business_result_and_business_link_only',
      disclose_authentication_identity_environment: false,
      authentication_narration: 'forbidden_in_messages_progress_todos_cards_and_tool_titles',
      readiness_announcement: 'never_announce_environment_login_or_organization_readiness',
      preparation_success_action: 'continue_business_operation_without_transition_message',
      tool_title_content: 'current_business_stage_only_preserve_raw_command_in_execution_record',
      report_preparation_only_when_user_action_is_required: false,
      app_build_task: {
        title_template: '在{organization_name}组织下搭建宜搭应用',
        applies_to: 'controllable_task_title_and_start_message_conversation_title_when_host_supports_update',
        organization_source: 'verified_current_host_organization_display_name_never_environment_label_domain_id_or_history',
        unknown_organization_title: '在当前组织下搭建宜搭应用',
        update_title_after_organization_is_verified: true,
        append_authentication_or_preparation_status: false,
      },
      app_creation_notice: {
        template: '当前在{organization_name}组织下为您创建{app_name}应用',
        when: 'once_immediately_before_creating_new_app_not_preparation_retries_or_resume',
        organization_source: 'verified_current_host_organization_display_name_never_environment_label_domain_id_or_history',
        app_name_source: 'confirmed_app_name', unknown_organization: '当前组织',
        append_authentication_or_preparation_status: false,
      },
      user_action_content: 'minimal_action_and_business_impact_without_technical_explanation',
    });
    expect(result.builder_path.host_context).toMatchObject({
      default_organization: 'current_host_organization', ask_organization_by_default: false,
      recovery: { max_attempts: 1, output_visibility: 'internal' },
    });
    for (const value of ['private-corp', 'private-user', 'private-name', 'private-profile']) { expect(JSON.stringify(result)).not.toContain(value); }
  });
  test('网页摘要选择云端免登并隐藏身份', () => {
    const result = summary({ tool: 'qwenwork', subtype: 'qwenwork_web' });
    expect(result.login).toEqual({ status: 'ok', can_auto_use: true });
    expect(result.builder_path.interactive_login).toMatchObject({ mode: 'cloud_token', browser_owner: 'cli_if_auth_required', user_visible: false });
    expect(JSON.parse(JSON.stringify(result.builder_path.auth))).not.toHaveProperty('corp_id');
  });
  test('正式包缺少状态时仅推荐一次宿主命令，不引导历史账号选择', () => {
    const result = summary({ tool: 'qwenwork', subtype: 'qwenwork_desktop' }, {
      status: 'profile_required', can_auto_use: false,
      candidates: [{ auth_profile: 'private-profile', corp_id: 'private-corp' }],
      next_step_commands: ['openyida auth profiles --json'],
    });
    expect(result.builder_path.interactive_login).toMatchObject({
      mode: 'desktop_ticket', invocation: { max_attempts: 1 },
      recommended_command: expect.stringMatching(/ login --qwenwork --json$/),
    });
    expect(JSON.stringify(result)).not.toContain('private-profile');
    expect(JSON.stringify(result)).not.toContain('auth profiles');
  });
  test('千问 env 模式保留宿主注入要求，隐藏身份，不触发桌面或云端回退', () => {
    const result = summary({ tool: 'qwenwork', subtype: 'qwenwork_desktop' }, {
      auth_source: 'env', status: 'not_logged_in', can_auto_use: false, failure_reason: 'env_token_missing',
    });
    expect(result.login).toMatchObject({ auth_source: 'env', failure_reason: 'env_token_missing', can_auto_use: false });
    expect(result.builder_path.auth).toMatchObject({ auth_runtime: 'env_token_bootstrap', missing_token_action: 'STOP_AND_REQUEST_ENV_TOKEN' });
    expect(result.builder_path.interactive_login).toMatchObject({ mode: 'not_required', recommended_command: null });
    for (const value of ['private-corp', 'private-user', 'private-name', 'private-profile']) { expect(JSON.stringify(result)).not.toContain(value); }
  });
  test('云端免登的 OAuth 回退复用原有 Agent Browser 引导', () => {
    const result = summary({ tool: 'qwenwork', subtype: 'qwenwork_web', capabilities: { agent_browser: true } });
    expect(result.builder_path.interactive_login.oauth_fallback).toMatchObject({
      mode: 'caller_open_url', browser_owner: 'agent_browser', url_source: 'login_command_stderr',
      agent_action: 'open_cli_printed_url_once_with_agent_browser',
    });
  });
  test.each([{ tool: 'codex', subtype: 'codex' }, { tool: 'claude-code', subtype: 'claude-code' }, {}])('其他宿主保留原认证和输出契约：%j', runtime => {
    const result = summary(runtime);
    expect(result.login.corp_id).toBe('private-corp');
    expect(result.builder_path.interactive_login.mode).not.toBe('desktop_ticket');
    expect(result.builder_path.host_context).toBeUndefined();
    expect(result.builder_path.communication).toMatchObject({
      preparation_visibility: 'silent', disclose_implementation_details: false,
      user_action_content: 'minimal_action_and_business_impact_without_technical_explanation',
    });
  });
});
