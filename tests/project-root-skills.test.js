'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildSkillsDiagnostics,
  resolveProjectRoot,
} = require('../lib/core/utils');
const { _internal } = require('../lib/core/copy');

function qwenWebRuntime(workspaceRoot) {
  return {
    tool: 'qwenwork',
    displayName: 'QwenWork（千问办公）',
    dirName: '.qwenworkcn',
    workspaceRoot,
    workspaceRootSource: 'QWENWORK_WORKSPACE_DIR',
    runtime: 'web_sandbox',
    subtype: 'qwenwork_web',
    capabilities: {
      desktop_shell: false,
      agent_browser: true,
    },
  };
}

describe('projectRoot / skills runtime integration', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-project-root-skills-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('runtime workspace source wins over cwd project probing', () => {
    const workspace = path.join(tmpDir, 'work');
    const cwd = path.join(tmpDir, 'repo');
    fs.mkdirSync(workspace, { recursive: true });
    fs.mkdirSync(path.join(cwd, 'project'), { recursive: true });
    fs.writeFileSync(path.join(cwd, 'project', 'config.json'), '{}');

    const projectRoot = resolveProjectRoot({
      cwd,
      runtime: qwenWebRuntime(workspace),
    });

    expect(projectRoot).toMatchObject({
      projectRoot: workspace,
      source: 'QWENWORK_WORKSPACE_DIR',
      reason: 'qwenwork_web_runtime_workspace_root',
      authoritative: true,
      exists: true,
    });
  });

  test('QwenWork web skills fall back to workspace market-skills when host path is absent', () => {
    const workspace = path.join(tmpDir, 'work');
    fs.mkdirSync(workspace, { recursive: true });

    const projectResolution = resolveProjectRoot({
      cwd: tmpDir,
      runtime: qwenWebRuntime(workspace),
    });
    const skills = buildSkillsDiagnostics({
      cwd: tmpDir,
      runtime: qwenWebRuntime(workspace),
      projectResolution,
    });

    expect(skills.selected).toMatchObject({
      path: path.join(workspace, '.qwenwork', 'market-skills', 'yida-skills'),
      source: 'workspace:.qwenwork/market-skills',
      scope: 'workspace',
      usable: true,
      workspace_only: true,
    });
    expect(skills.diagnostics.fallback).toBe('workspace_only_current_workspace_effect');
  });

  test('QwenWork web honors configured skills paths before workspace fallback', () => {
    const homeDir = path.join(tmpDir, 'home');
    const workspace = path.join(tmpDir, 'work');
    fs.mkdirSync(homeDir, { recursive: true });
    fs.mkdirSync(workspace, { recursive: true });

    const projectResolution = resolveProjectRoot({
      cwd: tmpDir,
      runtime: qwenWebRuntime(workspace),
    });
    const skills = buildSkillsDiagnostics({
      cwd: tmpDir,
      env: {
        QWENWORK_CONFIG_CONTENT: JSON.stringify({
          skills: {
            paths: ['~/configured-skills'],
          },
        }),
      },
      homeDir,
      runtime: qwenWebRuntime(workspace),
      projectResolution,
    });

    expect(skills.selected).toMatchObject({
      path: path.join(homeDir, 'configured-skills', 'yida-skills'),
      source: 'env:QWENWORK_CONFIG_CONTENT.skills.paths',
      scope: 'host-config',
      usable: true,
      workspace_only: false,
    });
  });

  test('QwenWork desktop prefers the user-level qwenworkcn skills directory', () => {
    const homeDir = path.join(tmpDir, 'home');
    const workerCwd = path.join(homeDir, '.qwenworkcn', 'workspace', 'chat-1');
    fs.mkdirSync(workerCwd, { recursive: true });

    const runtime = {
      tool: 'qwenwork',
      displayName: 'QwenWork（千问办公）',
      dirName: '.qwenworkcn',
      workspaceRoot: workerCwd,
      workspaceRootSource: 'QODER_WORKER_CWD',
      runtime: 'desktop_shell',
      subtype: 'qwenwork_desktop',
      capabilities: {
        desktop_shell: true,
        agent_browser: true,
      },
    };
    const projectResolution = resolveProjectRoot({ cwd: tmpDir, runtime });
    const skills = buildSkillsDiagnostics({
      cwd: tmpDir,
      homeDir,
      runtime,
      projectResolution,
    });

    expect(skills.selected).toMatchObject({
      path: path.join(homeDir, '.qwenworkcn', 'skills', 'yida-skills'),
      source: 'home:.qwenworkcn/skills',
      scope: 'user',
      usable: true,
    });
  });

  test('copy target uses explicit runtime workspace instead of cwd', () => {
    const workspace = path.join(tmpDir, 'work');
    const destBase = _internal.resolveDestBaseFromEnv(
      'QwenWork（千问办公）',
      workspace,
      [],
      {
        activeTool: qwenWebRuntime(workspace),
      }
    );

    expect(destBase).toBe(workspace);
  });
});
