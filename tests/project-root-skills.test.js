'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildSkillsDiagnostics,
  detectRuntimeCapabilities,
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
      homeDir: path.join(tmpDir, 'home'),
      runtime: qwenWebRuntime(workspace),
      projectResolution,
    });

    expect(skills.install_target).toMatchObject({
      path: path.join(workspace, '.qwenwork', 'market-skills', 'yida-skills'),
      source: 'workspace:.qwenwork/market-skills',
      scope: 'workspace',
      installable: true,
      workspace_only: true,
    });
    expect(skills.selected.scope).toBe('package');
    expect(skills.install_target.usable).toBe(false);
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

    expect(skills.install_target).toMatchObject({
      path: path.join(homeDir, 'configured-skills', 'yida-skills'),
      source: 'env:QWENWORK_CONFIG_CONTENT.skills.paths',
      scope: 'host-config',
      installable: true,
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

    expect(skills.install_target).toMatchObject({
      path: path.join(homeDir, '.qwenworkcn', 'skills', 'yida-skills'),
      source: 'home:.qwenworkcn/skills',
      scope: 'user',
      installable: true,
    });
  });

  test.each([
    ['新 Qoder', {
      QODER_PRODUCT_ID: 'qoder',
      QODER_SESSION_TYPE: 'app',
      __CFBundleIdentifier: 'com.qoder.app',
    }, 'qoder_app'],
    ['Qoder IDE', {
      QODER_IDE: '1',
      QODER_AGENT: 'true',
      __CFBundleIdentifier: 'com.qoder.ide',
    }, 'qoder_ide'],
  ])('%s 使用共享的 .qoder 用户级 skills 目录', (_name, env, subtype) => {
    const homeDir = path.join(tmpDir, 'home');
    fs.mkdirSync(homeDir, { recursive: true });
    const runtime = detectRuntimeCapabilities({
      env,
      cwd: tmpDir,
      platform: 'darwin',
    });
    const projectResolution = resolveProjectRoot({ cwd: tmpDir, env, runtime });
    const skills = buildSkillsDiagnostics({
      cwd: tmpDir,
      env,
      homeDir,
      runtime,
      projectResolution,
    });

    expect(runtime).toMatchObject({
      tool: 'qoder',
      dirName: '.qoder',
      subtype,
    });
    expect(skills.install_target).toMatchObject({
      path: path.join(homeDir, '.qoder', 'skills', 'yida-skills'),
      source: 'home:.qoder/skills',
      scope: 'user',
      installable: true,
    });
  });

  test('read-only existing skills win over writable missing installation paths', () => {
    const homeDir = path.join(tmpDir, 'home');
    const root = path.join(homeDir, '.qwenworkcn', 'skills', 'yida-skills');
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, 'SKILL.md'), '# root');
    const originalAccess = fs.accessSync;
    const access = jest.spyOn(fs, 'accessSync').mockImplementation((target, mode) => {
      if (mode === fs.constants.W_OK && String(target).startsWith(homeDir)) {
        throw Object.assign(new Error('read only'), { code: 'EACCES' });
      }
      return originalAccess(target, mode);
    });
    try {
      const skills = buildSkillsDiagnostics({
        cwd: tmpDir, homeDir, projectRoot: tmpDir,
        runtime: { ...qwenWebRuntime(tmpDir), subtype: 'qwenwork_desktop' },
      });
      expect(skills.selected).toMatchObject({ path: root, exists: true, readable: true, usable: true, writable: false });
      expect(skills.install_target).toMatchObject({ scope: 'workspace', exists: false, usable: false, installable: true });
    } finally { access.mockRestore(); }
  });

  test.each(['missing', 'directory', 'unreadable', 'broken-link'])('invalid root entry %s is never selected', (kind) => {
    const root = path.join(tmpDir, 'yida-skills');
    fs.mkdirSync(root);
    const entry = path.join(root, 'SKILL.md');
    if (kind === 'directory') {fs.mkdirSync(entry);}
    if (kind === 'broken-link') {fs.symlinkSync(path.join(tmpDir, 'absent'), entry);}
    if (kind === 'unreadable') {fs.writeFileSync(entry, '# root');}
    const originalAccess = fs.accessSync;
    const access = jest.spyOn(fs, 'accessSync').mockImplementation((target, mode) => {
      if (kind === 'unreadable' && target === entry && mode === fs.constants.R_OK) {throw new Error('denied');}
      return originalAccess(target, mode);
    });
    try {
      const skills = buildSkillsDiagnostics({ cwd: tmpDir, projectRoot: tmpDir, activeTool: null,
        bundledSkillsPath: path.join(tmpDir, 'missing-package') });
      expect(skills.selected).toBeNull();
      expect(skills.install_target.path).toBe(root);
    } finally { access.mockRestore(); }
  });

  test('bundled fallback is readable but is never an install target', () => {
    const skills = buildSkillsDiagnostics({ cwd: tmpDir, projectRoot: tmpDir, activeTool: null });
    expect(skills.selected).toMatchObject({ scope: 'package', exists: true, usable: true, installable: false });
    expect(skills.install_target.scope).toBe('workspace');
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
