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

  test('delivery runtime detector keeps local Codex non-cloud and honors managed cloud signals', () => {
    const { buildApplicationEntryPolicy } = require('../lib/core/agent-capabilities');

    expect(buildApplicationEntryPolicy({
      auth: { auth_runtime: 'env_token_bootstrap' },
      runtime: { runtime: 'desktop_shell' },
    }, { CODEX_SHELL: '1', CODEX_CI: '1' })).toMatchObject({
      environment: 'non_cloud_agent',
      entries: { admin: 'include' },
    });

    expect(buildApplicationEntryPolicy({
      auth: { auth_runtime: 'token_oauth_session' },
      runtime: { runtime: 'unknown' },
    }, { OPENYIDA_MANAGED_RUNTIME: 'cloud' })).toMatchObject({
      environment: 'managed_cloud_agent',
      entries: { admin: 'omit' },
    });

    expect(buildApplicationEntryPolicy({
      auth: { auth_runtime: 'token_oauth_session' },
      runtime: { runtime: 'web_sandbox', tool: 'qwenwork' },
    }, {})).toMatchObject({
      environment: 'managed_cloud_agent',
      entries: { admin: 'omit' },
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
      expect(summary.application_entry_policy).toEqual({
        schema_version: 1,
        environment: 'managed_cloud_agent',
        delivery_unit: 'single_application_entry_group',
        resource_delivery: 'summary_only',
        internal_artifact_delivery: 'never',
        entries: {
          workbench: 'always',
          custom: 'when_entry_mode_standalone_and_is_render_nav_false_readback',
          admin: 'omit',
        },
      });
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
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
          workbench: 'always',
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
