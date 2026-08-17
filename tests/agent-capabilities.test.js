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

  test('runtime access token fast path skips environment snapshot and auth status checks', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-agent-cap-fast-'));
    const buildEnvironmentSnapshot = jest.fn(() => {
      throw new Error('slow environment precheck should be skipped');
    });
    const getAuthStatus = jest.fn(() => {
      throw new Error('auth status check should be skipped');
    });
    const findProjectRoot = jest.fn(() => projectRoot);

    jest.doMock('../lib/core/env', () => ({ buildEnvironmentSnapshot }));
    jest.doMock('../lib/core/utils', () => ({ findProjectRoot, getAuthStatus }));

    process.env.YIDA_AUTH_ENABLED = 'true';
    process.env.OPENYIDA_ACCESS_TOKEN = 'runtime-access-token';
    process.env.OPENYIDA_TOKEN_CORP_ID = 'corpRuntime';
    process.env.OPENYIDA_TOKEN_CORP_NAME = '运行时组织';
    process.env.OPENYIDA_TOKEN_USER_ID = 'userRuntime';

    try {
      const { buildAgentCapabilitiesSummary } = require('../lib/core/agent-capabilities');
      const summary = buildAgentCapabilitiesSummary();

      expect(buildEnvironmentSnapshot).not.toHaveBeenCalled();
      expect(getAuthStatus).not.toHaveBeenCalled();
      expect(findProjectRoot).toHaveBeenCalledTimes(1);
      expect(() => JSON.parse(JSON.stringify(summary))).not.toThrow();
      expect(summary).toMatchObject({
        schema_version: 1,
        name: 'openyida-agent-capabilities-summary',
        login: {
          status: 'ok',
          auth_mode: 'token',
          auth_source: 'env',
          auth_store: 'host_injected',
          corp_id: 'corpRuntime',
          corp_name: '运行时组织',
          user_id: 'userRuntime',
          user_auth_store_writable: null,
          persistence_scope: 'host',
          can_auto_use: true,
        },
        precheck: {
          skipped: true,
          reason: 'runtime_auth_provisioned',
        },
        workdir: projectRoot,
        workdir_exists: true,
        builder_path: {
          auth: {
            source: 'env',
            store: 'host_injected',
            corp_id: 'corpRuntime',
            corp_name: '运行时组织',
            user_id: 'userRuntime',
            user_auth_store_writable: null,
            persistence_scope: 'host',
            can_auto_use: true,
            host_injected_token_mode: true,
            env_token_present: true,
            runtime_auth_provisioned: true,
            interactive_login_allowed: false,
            browser_session_auth_allowed: false,
          },
          interactive_login: {
            mode: 'not_required',
            browser_owner: 'none',
            recommended_command: null,
            reason: 'host_token_env_detected',
          },
        },
      });
      expect(summary.command_manifest_digest).toMatch(/^[a-f0-9]{64}$/);
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
      expect(summary.builder_path.auth).not.toHaveProperty('runtime_auth_provisioned');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
