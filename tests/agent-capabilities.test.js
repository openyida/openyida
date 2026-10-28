'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('agent-capabilities summary', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.dontMock('../lib/core/env');
    jest.dontMock('../lib/core/utils');
  });

  test('exposes non-cloud search and QwenWork generation runtime defaults', () => {
    const { buildAssetCapabilities } = require('../lib/core/agent-capabilities');
    const local = buildAssetCapabilities({ tool: 'codex', runtime: 'desktop_shell', subtype: 'codex' }, {});
    expect(local).toMatchObject({
      host: { tool: 'codex', class: 'non_cloud' },
      online_search: { status: 'available', available: true },
      image_search: { status: 'available', available: true },
      image_generation: { status: 'unknown', available: null },
      requires_host_tool_inventory_check: true,
    });

    const qwenwork = buildAssetCapabilities(
      { tool: 'qwenwork', runtime: 'desktop_shell', subtype: 'qwenwork_desktop' },
      {}
    );
    expect(qwenwork).toMatchObject({
      host: { tool: 'qwenwork', class: 'non_cloud' },
      online_search: { status: 'available', available: true },
      image_search: { status: 'available', available: true },
      image_generation: { status: 'available', available: true },
      requires_host_tool_inventory_check: true,
    });

    const declared = buildAssetCapabilities(
      { tool: 'qwenwork', runtime: 'web_sandbox', subtype: 'qwenwork_web' },
      {
        OPENYIDA_AGENT_ONLINE_SEARCH: '1',
        OPENYIDA_AGENT_IMAGE_SEARCH: '1',
        OPENYIDA_AGENT_IMAGE_GENERATION: '0',
      }
    );
    expect(declared).toMatchObject({
      online_search: { status: 'available', available: true },
      image_search: { status: 'available', available: true },
      image_generation: { status: 'unavailable', available: false },
      requires_host_tool_inventory_check: true,
    });
  });

  test('application entry policy includes developer admin regardless of injected auth or host signals', () => {
    const { buildApplicationEntryPolicy } = require('../lib/core/agent-capabilities');

    expect(buildApplicationEntryPolicy({
      auth: { auth_runtime: 'env_token_bootstrap', can_auto_use: true },
      runtime: { runtime: 'desktop_shell' },
    }, { CODEX_SHELL: '1', CODEX_CI: '1' })).toMatchObject({
      environment: 'managed_cloud_agent',
      entries: { admin: 'include' },
    });

    expect(buildApplicationEntryPolicy({
      auth: { auth_runtime: 'token_oauth_session', can_auto_use: true },
      runtime: { runtime: 'web_sandbox', tool: 'mulerun' },
    }, { OPENYIDA_MANAGED_RUNTIME: 'cloud' })).toMatchObject({
      environment: 'non_cloud_agent',
      entries: { admin: 'include' },
    });

    expect(buildApplicationEntryPolicy({
      auth: { auth_runtime: 'env_token_bootstrap', can_auto_use: false },
      runtime: { runtime: 'web_sandbox', tool: 'mulerun' },
    }, {})).toMatchObject({
      environment: 'non_cloud_agent',
      entries: { admin: 'include' },
    });

    expect(buildApplicationEntryPolicy({
      runtime: { runtime: 'web_sandbox', tool: 'mulerun' },
    }, { OPENYIDA_MANAGED_RUNTIME: 'cloud' })).toMatchObject({
      environment: 'non_cloud_agent',
      entries: { admin: 'include' },
    });
  });

  test('YIDA_AUTH_ENABLED does not skip environment snapshot or auth status checks', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-agent-cap-fast-'));
    const buildEnvironmentSnapshot = jest.fn(() => ({
      active: {
        projectRoot,
        projectRootExists: true,
      },
    }));
    const getAuthStatus = jest.fn(() => ({
      ok: true,
      auth_mode: 'token',
      auth_source: 'env',
      auth_store: 'env',
      corp_id: 'corpRuntime',
      corp_name: '运行时组织',
      user_id: 'userRuntime',
      user_auth_store_writable: null,
      persistence_scope: 'process',
      status: 'ok',
      can_auto_use: true,
    }));
    const findProjectRoot = jest.fn(() => {
      throw new Error('findProjectRoot should not be needed when env snapshot provides project root');
    });

    jest.doMock('../lib/core/env', () => ({ buildEnvironmentSnapshot }));
    jest.doMock('../lib/core/utils', () => ({ findProjectRoot, getAuthStatus }));

    process.env.YIDA_AUTH_ENABLED = 'true';
    process.env.OPENYIDA_MANAGED_RUNTIME = 'cloud';
    process.env.OPENYIDA_ACCESS_TOKEN = 'runtime-access-token';
    process.env.OPENYIDA_TOKEN_CORP_ID = 'corpRuntime';
    process.env.OPENYIDA_TOKEN_CORP_NAME = '运行时组织';
    process.env.OPENYIDA_TOKEN_USER_ID = 'userRuntime';

    try {
      const { buildAgentCapabilitiesSummary } = require('../lib/core/agent-capabilities');
      const summary = buildAgentCapabilitiesSummary();

      expect(buildEnvironmentSnapshot).toHaveBeenCalledTimes(1);
      expect(getAuthStatus).toHaveBeenCalledWith({ projectRoot, includeSecrets: false });
      expect(findProjectRoot).not.toHaveBeenCalled();
      expect(() => JSON.parse(JSON.stringify(summary))).not.toThrow();
      expect(summary).toMatchObject({
        schema_version: 1,
        name: 'openyida-agent-capabilities-summary',
        login: {
          status: 'ok',
          auth_mode: 'token',
          auth_source: 'env',
          auth_store: 'env',
          corp_id: 'corpRuntime',
          corp_name: '运行时组织',
          user_id: 'userRuntime',
          user_auth_store_writable: null,
          persistence_scope: 'process',
          can_auto_use: true,
        },
        workdir: projectRoot,
        workdir_exists: true,
        builder_path: {
          auth: {
            source: 'env',
            store: 'env',
            corp_id: 'corpRuntime',
            corp_name: '运行时组织',
            user_id: 'userRuntime',
            user_auth_store_writable: null,
            persistence_scope: 'process',
            can_auto_use: true,
            interactive_login_allowed: false,
            browser_session_auth_allowed: false,
          },
          interactive_login: {
            mode: 'not_required',
            browser_owner: 'none',
            recommended_command: null,
            reason: 'env_token_bootstrap',
          },
        },
      });
      expect(summary).not.toHaveProperty('precheck');
      expect(JSON.stringify(summary)).not.toContain('host_injected');
      expect(JSON.stringify(summary)).not.toContain('host_token');
      expect(JSON.stringify(summary)).not.toContain('runtime_auth_provisioned');
      expect(summary.command_manifest_digest).toMatch(/^[a-f0-9]{64}$/);
      expect(summary.build_identity).toEqual({
        schema_version: 1,
        package_version: expect.any(String),
        build_id: expect.any(String),
        commit_sha: 'unknown',
        bundle_digest: 'unknown',
        command_manifest_digest: summary.command_manifest_digest,
      });
      expect(summary.application_entry_policy).toEqual({
        schema_version: 1,
        environment: 'managed_cloud_agent',
        delivery_unit: 'single_application_entry_group',
        resource_delivery: 'summary_only',
        internal_artifact_delivery: 'never',
        frontend_delivery: expect.stringContaining('verified publish/get-form-config standaloneUrl'),
        entries: {
          workbench: 'when_workspace_in_scope',
          custom: 'when_entry_mode_standalone_and_is_render_nav_false_readback',
          admin: 'include',
        },
      });
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test.each([
    ['千问桌面', 'qwenwork', 'desktop_shell', 'token_session', 'ok', {}, true],
    ['千问网页', 'qwenwork', 'web_sandbox', 'token_session', 'not_logged_in', {}, true],
    ['云端沙箱', 'mulerun', 'web_sandbox', 'token_session', 'profile_required', {}, true],
    ['注入凭据', 'codex', 'desktop_shell', 'env', 'ok', {}, true],
    ['缺失注入', 'codex', 'desktop_shell', 'env', 'not_logged_in', {}, true],
    ['托管云端', 'unknown', 'unknown', 'token_session', 'not_logged_in', { OPENYIDA_MANAGED_RUNTIME: 'cloud' }, true],
    ['普通本地', 'codex', 'desktop_shell', 'token_session', 'ok', {}, false],
    ['本地未就绪', 'codex', 'desktop_shell', 'token_session', 'not_logged_in', {}, false],
  ])('%s 的展示策略保留真实认证决策', (_name, tool, runtime, source, status, env, quiet) => {
    delete process.env.OPENYIDA_MANAGED_RUNTIME;
    Object.assign(process.env, env);
    const projectRoot = os.tmpdir();
    const login = {
      auth_mode: 'token', auth_source: source, status, can_auto_use: status === 'ok',
      next_step: 'Follow the existing authentication decision.',
      next_step_commands: ['openyida auth profiles'],
      ...(source === 'env' && status !== 'ok' ? { failure_reason: 'env_token_missing' } : {}),
    };
    const getAuthStatus = jest.fn(() => ({ ...login }));
    jest.doMock('../lib/core/env', () => ({
      buildEnvironmentSnapshot: () => ({ active: { projectRoot, projectRootExists: true } }),
    }));
    jest.doMock('../lib/core/utils', () => ({
      getAuthStatus,
      findProjectRoot: () => projectRoot,
      detectRuntimeCapabilities: () => ({ tool, runtime, capabilities: { desktop_shell: runtime === 'desktop_shell', agent_browser: runtime === 'web_sandbox' } }),
    }));
    const capabilities = require('../lib/core/agent-capabilities');
    const summary = capabilities.buildAgentCapabilitiesSummary();
    const full = capabilities.buildAgentCapabilities();
    expect(getAuthStatus).toHaveBeenCalledTimes(2);
    expect(getAuthStatus).toHaveBeenCalledWith({ projectRoot, includeSecrets: false });
    const publicLogin = { ...login };
    delete publicLogin.failure_reason;
    expect(summary.login).toMatchObject(publicLogin);
    expect(full.login).toEqual(login);
    expect(summary.builder_path.auth).toMatchObject({
      source, can_auto_use: login.can_auto_use,
      interactive_login_allowed: source !== 'env',
      next_step: login.next_step, next_step_commands: login.next_step_commands,
    });
    expect(summary.builder_path.auth).toEqual(expect.objectContaining({
      missing_token_action: source === 'env' ? 'STOP_AND_REQUEST_ENV_TOKEN' : 'RUN_OPENYIDA_LOGIN_IF_USER_APPROVES',
    }));
    expect(summary.builder_path.interactive_login).toEqual(full.builder_path.interactive_login);
    expect(summary.builder_path.interactive_login.mode).toBe(
      source === 'env' ? 'not_required'
        : runtime === 'web_sandbox' ? 'caller_open_url'
          : runtime === 'desktop_shell' ? 'cli_auto_open' : 'unsupported'
    );
    const policy = summary.builder_path.user_communication;
    expect(policy).toEqual(full.builder_path.user_communication);
    if (quiet) {
      expect(policy).toMatchObject({
        routine_preparation: 'internal_only',
        on_ready: 'continue_business_task_without_auth_announcement',
        notify_only_when: ['user_action_required', 'blocking_failure', 'user_requested_auth_diagnostics'],
        diagnostics: 'retain_tool_results_and_exit_codes_never_expose_credentials',
        authorization: 'preserve_explicit_user_confirmation_and_organization_selection',
      });
      expect(policy.applies_to).toContain('visible_reasoning');
      expect(policy.do_not_narrate).toEqual(expect.arrayContaining(['login_check', 'silent_login', 'login_success']));
    } else {
      expect(summary.builder_path).not.toHaveProperty('user_communication');
    }
  });

  test('reports immutable CI build identity in summary and full diagnostics', () => {
    process.env.OPENYIDA_BUILD_ID = 'openyida-phase6-build';
    process.env.OPENYIDA_COMMIT_SHA = 'abc123def456';
    process.env.OPENYIDA_BUNDLE_DIGEST = 'sha256:bundle123';

    const capabilities = require('../lib/core/agent-capabilities');
    const summary = capabilities.buildAgentCapabilitiesSummary();
    const full = capabilities.buildAgentCapabilities();

    expect(summary.build_identity).toEqual({
      schema_version: 1,
      package_version: expect.any(String),
      build_id: 'openyida-phase6-build',
      commit_sha: 'abc123def456',
      bundle_digest: 'sha256:bundle123',
      command_manifest_digest: summary.command_manifest_digest,
    });
    expect(full.build_identity).toEqual(summary.build_identity);
    expect(full.openyida.build_identity).toEqual(summary.build_identity);
  });

  test('non-runtime access token path still uses existing summary checks', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-agent-cap-slow-'));
    const buildEnvironmentSnapshot = jest.fn(() => ({
      active: {
        projectRoot,
        projectRootExists: true,
      },
    }));
    const getAuthStatus = jest.fn(() => ({
      ok: false,
      auth_mode: 'token',
      auth_source: 'project_legacy',
      auth_store: 'project_cache',
      corp_id: 'corp-a',
      corp_name: '组织 A',
      user_auth_store_writable: true,
      persistence_scope: 'project',
      status: 'not_logged_in',
      can_auto_use: false,
      candidate_count: 1,
      candidates: [
        {
          auth_profile: 'profile-a',
          corp_id: 'corp-a',
          corp_name: '组织 A',
          user_id: 'user-a',
        },
      ],
      next_step: 'Run openyida auth profiles, then switch to an existing profile.',
      next_step_commands: [
        'openyida auth profiles',
        'openyida auth profile switch <auth_profile>',
      ],
    }));
    const findProjectRoot = jest.fn(() => {
      throw new Error('findProjectRoot is only needed by the runtime fast path');
    });

    jest.doMock('../lib/core/env', () => ({ buildEnvironmentSnapshot }));
    jest.doMock('../lib/core/utils', () => ({ findProjectRoot, getAuthStatus }));

    delete process.env.YIDA_AUTH_ENABLED;
    delete process.env.OPENYIDA_ACCESS_TOKEN;

    try {
      const { buildAgentCapabilitiesSummary } = require('../lib/core/agent-capabilities');
      const summary = buildAgentCapabilitiesSummary();

      expect(buildEnvironmentSnapshot).toHaveBeenCalledTimes(1);
      expect(getAuthStatus).toHaveBeenCalledWith({ projectRoot, includeSecrets: false });
      expect(findProjectRoot).not.toHaveBeenCalled();
      expect(summary).not.toHaveProperty('precheck');
      expect(summary.login).toMatchObject({
        status: 'not_logged_in',
        auth_mode: 'token',
        auth_source: 'project_legacy',
        auth_store: 'project_cache',
        corp_id: 'corp-a',
        corp_name: '组织 A',
        user_auth_store_writable: true,
        persistence_scope: 'project',
        candidate_count: 1,
        candidates: [
          expect.objectContaining({
            auth_profile: 'profile-a',
            corp_name: '组织 A',
          }),
        ],
        next_step: 'Run openyida auth profiles, then switch to an existing profile.',
        next_step_commands: [
          'openyida auth profiles',
          'openyida auth profile switch <auth_profile>',
        ],
        can_auto_use: false,
      });
      expect(summary.builder_path.auth).toMatchObject({
        source: 'project_legacy',
        store: 'project_cache',
        corp_id: 'corp-a',
        corp_name: '组织 A',
        user_auth_store_writable: true,
        persistence_scope: 'project',
        next_step: 'Run openyida auth profiles, then switch to an existing profile.',
        next_step_commands: [
          'openyida auth profiles',
          'openyida auth profile switch <auth_profile>',
        ],
      });
      expect(summary.application_entry_policy).toMatchObject({
        environment: 'non_cloud_agent',
        entries: {
          workbench: 'when_workspace_in_scope',
          custom: 'when_entry_mode_standalone_and_is_render_nav_false_readback',
          admin: 'include',
        },
      });
      expect(summary.builder_path.auth).not.toHaveProperty('runtime_auth_provisioned');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
