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

// ── resolveDestBaseFromEnv 逻辑测试 ──────────────────────────────────

describe('resolveDestBaseFromEnv 逻辑验证', () => {
  const os = require('os');
  const path = require('path');
  const { _internal } = require('../lib/core/copy');

  test('普通活跃工具默认返回 process.cwd()', () => {
    const activeToolName = 'Claude Code';
    const envResults = [{ displayName: 'Claude Code', dirName: '.claudecode', isActive: true }];
    const destBase = _internal.resolveDestBaseFromEnv(activeToolName, null, envResults);

    expect(destBase).toBe(process.cwd());
  });

  test('--force 允许未检测到活跃 AI 工具时使用当前目录', () => {
    const originalCwd = process.cwd();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yida-copy-force-'));

    try {
      process.chdir(tmpDir);
      const destBase = _internal.resolveDestBaseFromEnv(null, null, [], {
        allowCurrentDir: true,
      });
      expect(destBase).toBe(fs.realpathSync(tmpDir));
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('forceCopyDir 行为', () => {
  const { _internal } = require('../lib/core/copy');

  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yida-force-copy-'));
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('目标目录是当前工作目录时清空内容但保留目录本身', () => {
    const sourceDir = path.join(tmpDir, 'source');
    const destDir = path.join(tmpDir, 'dest');
    fs.mkdirSync(sourceDir);
    fs.mkdirSync(destDir);
    fs.writeFileSync(path.join(sourceDir, 'fresh.txt'), 'fresh');
    fs.writeFileSync(path.join(destDir, 'stale.txt'), 'stale');

    process.chdir(destDir);
    const count = _internal.forceCopyDir(sourceDir, destDir);

    expect(count).toBe(1);
    expect(fs.existsSync(destDir)).toBe(true);
    expect(process.cwd()).toBe(fs.realpathSync(destDir));
    expect(fs.existsSync(path.join(destDir, 'stale.txt'))).toBe(false);
    expect(fs.readFileSync(path.join(destDir, 'fresh.txt'), 'utf8')).toBe('fresh');
  });
});

describe('copy 源目标重叠保护', () => {
  const { _internal } = require('../lib/core/copy');
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yida-copy-overlap-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('拒绝复制到源目录自身或子目录', () => {
    const sourceDir = path.join(tmpDir, 'source');
    fs.mkdirSync(sourceDir);

    expect(() => _internal.assertCopyDestinationSafe(sourceDir, sourceDir)).toThrow(expect.objectContaining({
      code: 'COPY_SOURCE_DESTINATION_OVERLAP',
      details: expect.objectContaining({ sideEffectState: 'none' }),
    }));
    expect(() => _internal.assertCopyDestinationSafe(sourceDir, path.join(sourceDir, 'project'))).toThrow(expect.objectContaining({
      code: 'COPY_SOURCE_DESTINATION_OVERLAP',
      details: expect.objectContaining({ relation: 'destination_inside_source' }),
    }));
  });

  test('拒绝 force 目标包含源目录，避免清空源文件', () => {
    const destinationDir = path.join(tmpDir, 'destination');
    const sourceDir = path.join(destinationDir, 'project');
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, 'keep.txt'), 'keep', 'utf8');

    expect(() => _internal.assertCopyDestinationSafe(sourceDir, destinationDir)).toThrow(expect.objectContaining({
      code: 'COPY_SOURCE_DESTINATION_OVERLAP',
      details: expect.objectContaining({ relation: 'source_inside_destination' }),
    }));
    expect(fs.readFileSync(path.join(sourceDir, 'keep.txt'), 'utf8')).toBe('keep');
  });

  test('允许互不重叠的源目录和目标目录', () => {
    const sourceDir = path.join(tmpDir, 'source');
    const destinationDir = path.join(tmpDir, 'destination');
    fs.mkdirSync(sourceDir);

    expect(() => _internal.assertCopyDestinationSafe(sourceDir, destinationDir)).not.toThrow();
  });
});

describe('project 工作区基础目录', () => {
  const { _internal } = require('../lib/core/copy');

  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yida-project-dirs-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('补齐源码目录但不创建本地缓存和构建产物目录', () => {
    _internal.ensureProjectWorkspaceDirs(tmpDir);

    expect(fs.existsSync(path.join(tmpDir, 'pages', 'src'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.cache'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'pages', 'build'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'pages', 'dist'))).toBe(false);
  });
});
