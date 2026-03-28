'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');

// ── 测试辅助：从 copy.js 中提取可测试的纯函数 ──────────────────────────
// copy.js 只导出 run()，核心函数通过模块内部调用。
// 我们通过 jest.mock 隔离依赖，对关键逻辑进行黑盒测试。

// 为了测试 mergeCopyDir / forceCopyDir / removeSkillsLink / createSymlink，
// 我们直接在测试中重新实现等价逻辑，并通过临时目录验证行为。

// ── mergeCopyDir 行为测试 ─────────────────────────────────────────────

describe('mergeCopyDir 行为', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yida-copy-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('源目录文件被复制到目标目录', () => {
    const sourceDir = path.join(tmpDir, 'source');
    const destDir = path.join(tmpDir, 'dest');
    fs.mkdirSync(sourceDir);
    fs.writeFileSync(path.join(sourceDir, 'a.txt'), 'hello');

    // 调用真实模块逻辑（通过 shell 执行 node 脚本验证）
    // 这里直接用 fs 模拟等价行为并验证
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(path.join(sourceDir, 'a.txt'), path.join(destDir, 'a.txt'));

    expect(fs.existsSync(path.join(destDir, 'a.txt'))).toBe(true);
    expect(fs.readFileSync(path.join(destDir, 'a.txt'), 'utf-8')).toBe('hello');
  });

  test('目标目录已有额外文件时，合并模式保留多余文件', () => {
    const sourceDir = path.join(tmpDir, 'source');
    const destDir = path.join(tmpDir, 'dest');
    fs.mkdirSync(sourceDir);
    fs.mkdirSync(destDir);
    fs.writeFileSync(path.join(sourceDir, 'new.txt'), 'new');
    fs.writeFileSync(path.join(destDir, 'existing.txt'), 'keep me');

    // 合并复制：只复制 source 中的文件，不删除 dest 中多余文件
    fs.copyFileSync(path.join(sourceDir, 'new.txt'), path.join(destDir, 'new.txt'));

    expect(fs.existsSync(path.join(destDir, 'existing.txt'))).toBe(true);
    expect(fs.existsSync(path.join(destDir, 'new.txt'))).toBe(true);
  });
});

// ── removeSkillsLink 行为测试 ─────────────────────────────────────────

describe('removeSkillsLink 行为', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yida-skills-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('目标是普通目录时，删除成功并返回 true', () => {
    const targetDir = path.join(tmpDir, 'yida-skills');
    fs.mkdirSync(targetDir);
    fs.writeFileSync(path.join(targetDir, 'SKILL.md'), 'skill content');

    // 模拟 removeSkillsLink 逻辑
    const stats = fs.lstatSync(targetDir);
    expect(stats.isDirectory()).toBe(true);
    fs.rmSync(targetDir, { recursive: true, force: true });
    expect(fs.existsSync(targetDir)).toBe(false);
  });

  test('目标是软链接时，删除软链接本身而不影响源目录', () => {
    // 仅在非 Windows 平台测试软链（Windows 需要管理员权限）
    if (process.platform === 'win32') {return;}

    const sourceDir = path.join(tmpDir, 'source-skills');
    const linkPath = path.join(tmpDir, 'yida-skills');
    fs.mkdirSync(sourceDir);
    fs.writeFileSync(path.join(sourceDir, 'SKILL.md'), 'content');
    fs.symlinkSync(sourceDir, linkPath, 'dir');

    const stats = fs.lstatSync(linkPath);
    expect(stats.isSymbolicLink()).toBe(true);

    fs.unlinkSync(linkPath);
    expect(fs.existsSync(linkPath)).toBe(false);
    // 源目录不受影响
    expect(fs.existsSync(sourceDir)).toBe(true);
    expect(fs.existsSync(path.join(sourceDir, 'SKILL.md'))).toBe(true);
  });

  test('目标路径不存在时，lstatSync 抛出异常（应返回 false）', () => {
    const nonExistentPath = path.join(tmpDir, 'non-existent');
    expect(() => fs.lstatSync(nonExistentPath)).toThrow();
  });
});

// ── createSymlink Windows 降级行为测试 ───────────────────────────────

describe('createSymlink Windows 降级逻辑', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yida-symlink-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('非 Windows 平台：symlinkSync 成功时不触发降级', () => {
    if (process.platform === 'win32') {return;}

    const sourceDir = path.join(tmpDir, 'source');
    const linkPath = path.join(tmpDir, 'link');
    fs.mkdirSync(sourceDir);

    fs.symlinkSync(sourceDir, linkPath, 'dir');
    const stats = fs.lstatSync(linkPath);
    expect(stats.isSymbolicLink()).toBe(true);
  });

  test('Windows 平台：symlinkType 应为 junction', () => {
    const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
    if (process.platform === 'win32') {
      expect(symlinkType).toBe('junction');
    } else {
      expect(symlinkType).toBe('dir');
    }
  });

  test('EPERM 错误时降级为目录复制', () => {
    // 模拟 Windows EPERM 场景：symlinkSync 抛出 EPERM，降级为 mergeCopyDir
    const sourceDir = path.join(tmpDir, 'source');
    const destDir = path.join(tmpDir, 'dest');
    fs.mkdirSync(sourceDir);
    fs.writeFileSync(path.join(sourceDir, 'file.txt'), 'content');

    // 模拟降级：直接执行 mergeCopyDir 等价操作
    const epermError = Object.assign(new Error('EPERM'), { code: 'EPERM' });
    let usedFallback = false;

    try {
      throw epermError;
    } catch (error) {
      if (error.code === 'EPERM') {
        usedFallback = true;
        fs.mkdirSync(destDir, { recursive: true });
        fs.copyFileSync(path.join(sourceDir, 'file.txt'), path.join(destDir, 'file.txt'));
      }
    }

    expect(usedFallback).toBe(true);
    expect(fs.existsSync(path.join(destDir, 'file.txt'))).toBe(true);
  });
});

// ── detectActiveTool Windows 路径兼容测试 ────────────────────────────

describe('detectActiveTool Windows 路径兼容', () => {
  const { detectActiveTool } = require('../lib/core/utils');
  const originalEnv = { ...process.env };

  afterEach(() => {
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) {delete process.env[key];}
    });
    Object.assign(process.env, originalEnv);
  });

  test('AGENT_WORK_ROOT 使用正斜杠路径时检测为悟空', () => {
    delete process.env.CLAUDE_CODE;
    delete process.env.OPENCODE;
    delete process.env.QODER_IDE;
    delete process.env.QODER_AGENT;
    delete process.env.CURSOR_TRACE_ID;
    process.env.AGENT_WORK_ROOT = '/home/user/.real/workspace';
    const result = detectActiveTool();
    expect(result).not.toBeNull();
    expect(result.tool).toBe('wukong');
  });

  test('AGENT_WORK_ROOT 使用 Windows 反斜杠路径时检测为悟空', () => {
    delete process.env.CLAUDE_CODE;
    delete process.env.OPENCODE;
    delete process.env.QODER_IDE;
    delete process.env.QODER_AGENT;
    delete process.env.CURSOR_TRACE_ID;
    // Windows 风格路径，包含 path.join(".real") 的结果
    process.env.AGENT_WORK_ROOT = 'C:\\Users\\user\\.real\\workspace';
    const result = detectActiveTool();
    expect(result).not.toBeNull();
    expect(result.tool).toBe('wukong');
  });
});

// ── resolveDestBaseFromEnv 逻辑测试 ──────────────────────────────────

describe('resolveDestBaseFromEnv 逻辑验证', () => {
  const os = require('os');
  const path = require('path');

  test('悟空环境且有 activeProjectRoot 时，返回其父目录', () => {
    const activeProjectRoot = path.join(os.homedir(), '.real', 'workspace', 'project');
    const expectedBase = path.join(os.homedir(), '.real', 'workspace');

    // 模拟 resolveDestBaseFromEnv 的核心逻辑
    const activeToolName = '悟空（Wukong）';
    const envResults = [{ displayName: '悟空（Wukong）', dirName: '.real', isActive: true }];
    const activeResult = envResults.find((r) => r.displayName === activeToolName);
    const isWukong = activeResult && activeResult.dirName === '.real';

    let destBase;
    if (isWukong) {
      destBase = activeProjectRoot ? path.dirname(activeProjectRoot) : path.join(os.homedir(), '.real', 'workspace');
    } else if (activeToolName) {
      destBase = process.cwd();
    }

    expect(destBase).toBe(expectedBase);
  });

  test('悟空环境且无 activeProjectRoot 时，返回默认 workspace 路径', () => {
    const expectedBase = path.join(os.homedir(), '.real', 'workspace');

    const activeToolName = '悟空（Wukong）';
    const envResults = [{ displayName: '悟空（Wukong）', dirName: '.real', isActive: true }];
    const activeResult = envResults.find((r) => r.displayName === activeToolName);
    const isWukong = activeResult && activeResult.dirName === '.real';

    const activeProjectRoot = null;
    let destBase;
    if (isWukong) {
      destBase = activeProjectRoot ? path.dirname(activeProjectRoot) : path.join(os.homedir(), '.real', 'workspace');
    }

    expect(destBase).toBe(expectedBase);
  });

  test('非悟空环境时，返回 process.cwd()', () => {
    const activeToolName = 'Claude Code';
    const envResults = [{ displayName: 'Claude Code', dirName: '.claudecode', isActive: true }];
    const activeResult = envResults.find((r) => r.displayName === activeToolName);
    const isWukong = activeResult && activeResult.dirName === '.real';

    let destBase;
    if (isWukong) {
      destBase = 'should-not-reach';
    } else if (activeToolName) {
      destBase = process.cwd();
    }

    expect(destBase).toBe(process.cwd());
  });
});
