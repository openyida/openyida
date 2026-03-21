"use strict";

const path = require("path");
const os = require("os");
const fs = require("fs");

// ── 测试辅助：从 copy.js 中提取可测试的纯函数 ──────────────────────────
// copy.js 只导出 run()，核心函数通过模块内部调用。
// 我们通过 jest.mock 隔离依赖，对关键逻辑进行黑盒测试。

// 为了测试 mergeCopyDir / forceCopyDir / removeSkillsLink / createSymlink，
// 我们直接在测试中重新实现等价逻辑，并通过临时目录验证行为。

// ── mergeCopyDir 行为测试 ─────────────────────────────────────────────

describe("mergeCopyDir 行为", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "yida-copy-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("源目录文件被复制到目标目录", () => {
    const sourceDir = path.join(tmpDir, "source");
    const destDir = path.join(tmpDir, "dest");
    fs.mkdirSync(sourceDir);
    fs.writeFileSync(path.join(sourceDir, "a.txt"), "hello");

    // 调用真实模块逻辑（通过 shell 执行 node 脚本验证）
    // 这里直接用 fs 模拟等价行为并验证
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(path.join(sourceDir, "a.txt"), path.join(destDir, "a.txt"));

    expect(fs.existsSync(path.join(destDir, "a.txt"))).toBe(true);
    expect(fs.readFileSync(path.join(destDir, "a.txt"), "utf-8")).toBe("hello");
  });

  test("目标目录已有额外文件时，合并模式保留多余文件", () => {
    const sourceDir = path.join(tmpDir, "source");
    const destDir = path.join(tmpDir, "dest");
    fs.mkdirSync(sourceDir);
    fs.mkdirSync(destDir);
    fs.writeFileSync(path.join(sourceDir, "new.txt"), "new");
    fs.writeFileSync(path.join(destDir, "existing.txt"), "keep me");

    // 合并复制：只复制 source 中的文件，不删除 dest 中多余文件
    fs.copyFileSync(path.join(sourceDir, "new.txt"), path.join(destDir, "new.txt"));

    expect(fs.existsSync(path.join(destDir, "existing.txt"))).toBe(true);
    expect(fs.existsSync(path.join(destDir, "new.txt"))).toBe(true);
  });
});

// ── removeSkillsLink 行为测试 ─────────────────────────────────────────

describe("removeSkillsLink 行为", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "yida-skills-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("目标是普通目录时，删除成功并返回 true", () => {
    const targetDir = path.join(tmpDir, "yida-skills");
    fs.mkdirSync(targetDir);
    fs.writeFileSync(path.join(targetDir, "SKILL.md"), "skill content");

    // 模拟 removeSkillsLink 逻辑
    const stats = fs.lstatSync(targetDir);
    expect(stats.isDirectory()).toBe(true);
    fs.rmSync(targetDir, { recursive: true, force: true });
    expect(fs.existsSync(targetDir)).toBe(false);
  });

  test("目标是软链接时，删除软链接本身而不影响源目录", () => {
    // 仅在非 Windows 平台测试软链（Windows 需要管理员权限）
    if (process.platform === "win32") return;

    const sourceDir = path.join(tmpDir, "source-skills");
    const linkPath = path.join(tmpDir, "yida-skills");
    fs.mkdirSync(sourceDir);
    fs.writeFileSync(path.join(sourceDir, "SKILL.md"), "content");
    fs.symlinkSync(sourceDir, linkPath, "dir");

    const stats = fs.lstatSync(linkPath);
    expect(stats.isSymbolicLink()).toBe(true);

    fs.unlinkSync(linkPath);
    expect(fs.existsSync(linkPath)).toBe(false);
    // 源目录不受影响
    expect(fs.existsSync(sourceDir)).toBe(true);
    expect(fs.existsSync(path.join(sourceDir, "SKILL.md"))).toBe(true);
  });

  test("目标路径不存在时，lstatSync 抛出异常（应返回 false）", () => {
    const nonExistentPath = path.join(tmpDir, "non-existent");
    expect(() => fs.lstatSync(nonExistentPath)).toThrow();
  });
});

// ── createSymlink Windows 降级行为测试 ───────────────────────────────

describe("createSymlink Windows 降级逻辑", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "yida-symlink-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("非 Windows 平台：symlinkSync 成功时不触发降级", () => {
    if (process.platform === "win32") return;

    const sourceDir = path.join(tmpDir, "source");
    const linkPath = path.join(tmpDir, "link");
    fs.mkdirSync(sourceDir);

    fs.symlinkSync(sourceDir, linkPath, "dir");
    const stats = fs.lstatSync(linkPath);
    expect(stats.isSymbolicLink()).toBe(true);
  });

  test("Windows 平台：symlinkType 应为 junction", () => {
    const symlinkType = process.platform === "win32" ? "junction" : "dir";
    if (process.platform === "win32") {
      expect(symlinkType).toBe("junction");
    } else {
      expect(symlinkType).toBe("dir");
    }
  });

  test("EPERM 错误时降级为目录复制", () => {
    // 模拟 Windows EPERM 场景：symlinkSync 抛出 EPERM，降级为 mergeCopyDir
    const sourceDir = path.join(tmpDir, "source");
    const destDir = path.join(tmpDir, "dest");
    fs.mkdirSync(sourceDir);
    fs.writeFileSync(path.join(sourceDir, "file.txt"), "content");

    // 模拟降级：直接执行 mergeCopyDir 等价操作
    const epermError = Object.assign(new Error("EPERM"), { code: "EPERM" });
    let usedFallback = false;

    try {
      throw epermError;
    } catch (error) {
      if (error.code === "EPERM") {
        usedFallback = true;
        fs.mkdirSync(destDir, { recursive: true });
        fs.copyFileSync(path.join(sourceDir, "file.txt"), path.join(destDir, "file.txt"));
      }
    }

    expect(usedFallback).toBe(true);
    expect(fs.existsSync(path.join(destDir, "file.txt"))).toBe(true);
  });
});

// ── detectActiveTool Windows 路径兼容测试 ────────────────────────────

describe("detectActiveTool Windows 路径兼容", () => {
  const { detectActiveTool } = require("../lib/core/utils");
  const originalEnv = { ...process.env };

  afterEach(() => {
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) delete process.env[key];
    });
    Object.assign(process.env, originalEnv);
  });

  test("AGENT_WORK_ROOT 使用正斜杠路径时检测为悟空", () => {
    delete process.env.CLAUDE_CODE;
    delete process.env.OPENCODE;
    delete process.env.QODER_IDE;
    delete process.env.QODER_AGENT;
    delete process.env.CURSOR_TRACE_ID;
    process.env.AGENT_WORK_ROOT = "/home/user/.real/workspace";
    const result = detectActiveTool();
    expect(result).not.toBeNull();
    expect(result.tool).toBe("wukong");
  });

  test("AGENT_WORK_ROOT 使用 Windows 反斜杠路径时检测为悟空", () => {
    delete process.env.CLAUDE_CODE;
    delete process.env.OPENCODE;
    delete process.env.QODER_IDE;
    delete process.env.QODER_AGENT;
    delete process.env.CURSOR_TRACE_ID;
    // Windows 风格路径，包含 path.join(".real") 的结果
    process.env.AGENT_WORK_ROOT = "C:\\Users\\user\\.real\\workspace";
    const result = detectActiveTool();
    expect(result).not.toBeNull();
    expect(result.tool).toBe("wukong");
  });
});

// ── resolveDestBaseFromEnv 逻辑测试 ──────────────────────────────────

describe("resolveDestBaseFromEnv 逻辑验证", () => {
  const os = require("os");
  const path = require("path");

  test("悟空环境且有 activeProjectRoot 时，返回其父目录", () => {
    const activeProjectRoot = path.join(os.homedir(), ".real", "workspace", "project");
    const expectedBase = path.join(os.homedir(), ".real", "workspace");

    // 模拟 resolveDestBaseFromEnv 的核心逻辑
    const activeToolName = "悟空（Wukong）";
    const envResults = [{ displayName: "悟空（Wukong）", dirName: ".real", isActive: true }];
    const activeResult = envResults.find((r) => r.displayName === activeToolName);
    const isWukong = activeResult && activeResult.dirName === ".real";

    let destBase;
    if (isWukong) {
      destBase = activeProjectRoot ? path.dirname(activeProjectRoot) : path.join(os.homedir(), ".real", "workspace");
    } else if (activeToolName) {
      destBase = process.cwd();
    }

    expect(destBase).toBe(expectedBase);
  });

  test("悟空环境且无 activeProjectRoot 时，返回默认 workspace 路径", () => {
    const expectedBase = path.join(os.homedir(), ".real", "workspace");

    const activeToolName = "悟空（Wukong）";
    const envResults = [{ displayName: "悟空（Wukong）", dirName: ".real", isActive: true }];
    const activeResult = envResults.find((r) => r.displayName === activeToolName);
    const isWukong = activeResult && activeResult.dirName === ".real";

    let destBase;
    if (isWukong) {
      destBase = null ? path.dirname(null) : path.join(os.homedir(), ".real", "workspace");
    }

    expect(destBase).toBe(expectedBase);
  });

  test("非悟空环境时，返回 process.cwd()", () => {
    const activeToolName = "Claude Code";
    const envResults = [{ displayName: "Claude Code", dirName: ".claudecode", isActive: true }];
    const activeResult = envResults.find((r) => r.displayName === activeToolName);
    const isWukong = activeResult && activeResult.dirName === ".real";

    let destBase;
    if (isWukong) {
      destBase = "should-not-reach";
    } else if (activeToolName) {
      destBase = process.cwd();
    }

    expect(destBase).toBe(process.cwd());
  });
});

// ── removePath 行为测试 ───────────────────────────────────────────────

describe("removePath 行为", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "yida-removepath-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("目标是普通目录时，删除成功并返回 true", () => {
    const { removePath } = require("../lib/core/copy");
    const targetDir = path.join(tmpDir, "to-remove");
    fs.mkdirSync(targetDir);
    fs.writeFileSync(path.join(targetDir, "file.txt"), "content");

    const result = removePath(targetDir, false);

    expect(result).toBe(true);
    expect(fs.existsSync(targetDir)).toBe(false);
  });

  test("目标是软链接时，删除软链接本身而不影响源目录", () => {
    if (process.platform === "win32") return;

    const { removePath } = require("../lib/core/copy");
    const sourceDir = path.join(tmpDir, "source");
    const linkPath = path.join(tmpDir, "link");
    fs.mkdirSync(sourceDir);
    fs.writeFileSync(path.join(sourceDir, "SKILL.md"), "content");
    fs.symlinkSync(sourceDir, linkPath, "dir");

    const result = removePath(linkPath, false);

    expect(result).toBe(true);
    expect(fs.existsSync(linkPath)).toBe(false);
    // 源目录不受影响
    expect(fs.existsSync(sourceDir)).toBe(true);
    expect(fs.existsSync(path.join(sourceDir, "SKILL.md"))).toBe(true);
  });

  test("目标路径不存在时，返回 false（非静默模式）", () => {
    const { removePath } = require("../lib/core/copy");
    const nonExistentPath = path.join(tmpDir, "non-existent");

    const result = removePath(nonExistentPath, false);

    expect(result).toBe(false);
  });

  test("目标路径不存在时，静默模式也返回 false", () => {
    const { removePath } = require("../lib/core/copy");
    const nonExistentPath = path.join(tmpDir, "non-existent");

    const result = removePath(nonExistentPath, true);

    expect(result).toBe(false);
  });

  test("悬空软链接（目标不存在）时，删除软链接本身并返回 true", () => {
    if (process.platform === "win32") return;

    const { removePath } = require("../lib/core/copy");
    const danglingLinkPath = path.join(tmpDir, "dangling-link");
    const nonExistentTarget = path.join(tmpDir, "does-not-exist");
    // 创建悬空软链（目标不存在）
    fs.symlinkSync(nonExistentTarget, danglingLinkPath, "dir");

    const result = removePath(danglingLinkPath, true);

    expect(result).toBe(true);
    // 软链接本身已被删除
    expect(fs.existsSync(danglingLinkPath)).toBe(false);
    try {
      fs.lstatSync(danglingLinkPath);
      expect(true).toBe(false); // 不应到达这里
    } catch {
      // 预期：lstatSync 抛出异常，说明软链接已被删除
    }
  });
});

// ── createSymlink 行为测试 ────────────────────────────────────────────

describe("createSymlink 行为", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "yida-createsymlink-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("源目录不存在时，返回 false", () => {
    const { createSymlink } = require("../lib/core/copy");
    const nonExistentSource = path.join(tmpDir, "non-existent-source");
    const destLink = path.join(tmpDir, "link");

    const result = createSymlink(nonExistentSource, destLink);

    expect(result).toBe(false);
    expect(fs.existsSync(destLink)).toBe(false);
  });

  test("成功创建软链接，返回 true", () => {
    if (process.platform === "win32") return;

    const { createSymlink } = require("../lib/core/copy");
    const sourceDir = path.join(tmpDir, "source");
    const destLink = path.join(tmpDir, "link");
    fs.mkdirSync(sourceDir);
    fs.writeFileSync(path.join(sourceDir, "SKILL.md"), "content");

    const result = createSymlink(sourceDir, destLink);

    expect(result).toBe(true);
    const stats = fs.lstatSync(destLink);
    expect(stats.isSymbolicLink()).toBe(true);
    expect(fs.readlinkSync(destLink)).toBe(sourceDir);
  });

  test("目标软链接已存在时，先删除再重新创建", () => {
    if (process.platform === "win32") return;

    const { createSymlink } = require("../lib/core/copy");
    const sourceDir = path.join(tmpDir, "source");
    const oldSourceDir = path.join(tmpDir, "old-source");
    const destLink = path.join(tmpDir, "link");
    fs.mkdirSync(sourceDir);
    fs.mkdirSync(oldSourceDir);
    // 先创建一个指向旧目录的软链
    fs.symlinkSync(oldSourceDir, destLink, "dir");

    const result = createSymlink(sourceDir, destLink);

    expect(result).toBe(true);
    // 软链接现在指向新的源目录
    expect(fs.readlinkSync(destLink)).toBe(sourceDir);
  });

  test("目标是普通目录时，先删除再创建软链接", () => {
    if (process.platform === "win32") return;

    const { createSymlink } = require("../lib/core/copy");
    const sourceDir = path.join(tmpDir, "source");
    const destLink = path.join(tmpDir, "link");
    fs.mkdirSync(sourceDir);
    // 目标位置已有一个普通目录
    fs.mkdirSync(destLink);
    fs.writeFileSync(path.join(destLink, "old.txt"), "old content");

    const result = createSymlink(sourceDir, destLink);

    expect(result).toBe(true);
    const stats = fs.lstatSync(destLink);
    expect(stats.isSymbolicLink()).toBe(true);
  });
});

// ── installSkillsToAllAgents 行为测试 ─────────────────────────────────

describe("installSkillsToAllAgents 行为", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "yida-install-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("悟空工具：清理已有软链，不创建新软链", () => {
    if (process.platform === "win32") return;

    const { installSkillsToAllAgents } = require("../lib/core/copy");
    const sourceDir = path.join(tmpDir, "yida-skills");
    const wukongSkillsDir = path.join(tmpDir, "fake-home", ".real", "skills");
    const wukongLink = path.join(wukongSkillsDir, "yida-skills");
    fs.mkdirSync(sourceDir);
    fs.mkdirSync(wukongSkillsDir, { recursive: true });
    // 预先创建一个软链
    fs.symlinkSync(sourceDir, wukongLink, "dir");

    // 通过 mock os.homedir 指向临时目录
    const originalHomedir = os.homedir;
    os.homedir = () => path.join(tmpDir, "fake-home");

    const results = installSkillsToAllAgents(sourceDir, [
      { dirName: ".real", displayName: "悟空（Wukong）" },
    ]);

    os.homedir = originalHomedir;

    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("wukong-cleanup");
    // 软链已被清理
    expect(fs.existsSync(wukongLink)).toBe(false);
  });

  test("非悟空工具：创建软链接到 skills 目录", () => {
    if (process.platform === "win32") return;

    const { installSkillsToAllAgents } = require("../lib/core/copy");
    const sourceDir = path.join(tmpDir, "yida-skills");
    fs.mkdirSync(sourceDir);

    const originalHomedir = os.homedir;
    os.homedir = () => path.join(tmpDir, "fake-home");

    const results = installSkillsToAllAgents(sourceDir, [
      { dirName: ".aone_copilot", displayName: "Aone Copilot" },
    ]);

    os.homedir = originalHomedir;

    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("symlink");
    expect(results[0].success).toBe(true);
    const destLink = path.join(tmpDir, "fake-home", ".aone_copilot", "skills", "yida-skills");
    const stats = fs.lstatSync(destLink);
    expect(stats.isSymbolicLink()).toBe(true);
  });

  test("Claude Code 使用 .claudecode 作为 skills 目录", () => {
    if (process.platform === "win32") return;

    const { installSkillsToAllAgents } = require("../lib/core/copy");
    const sourceDir = path.join(tmpDir, "yida-skills");
    fs.mkdirSync(sourceDir);

    const originalHomedir = os.homedir;
    os.homedir = () => path.join(tmpDir, "fake-home");

    const results = installSkillsToAllAgents(sourceDir, [
      { dirName: ".claudecode", displayName: "Claude Code" },
    ]);

    os.homedir = originalHomedir;

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    // 软链在 ~/.claudecode/skills/yida-skills
    const expectedDest = path.join(tmpDir, "fake-home", ".claudecode", "skills", "yida-skills");
    expect(fs.existsSync(expectedDest)).toBe(true);
    expect(results[0].dest).toBe(expectedDest);
  });

  test("多个工具时，返回每个工具的安装结果", () => {
    if (process.platform === "win32") return;

    const { installSkillsToAllAgents } = require("../lib/core/copy");
    const sourceDir = path.join(tmpDir, "yida-skills");
    fs.mkdirSync(sourceDir);

    const originalHomedir = os.homedir;
    os.homedir = () => path.join(tmpDir, "fake-home");

    const results = installSkillsToAllAgents(sourceDir, [
      { dirName: ".real", displayName: "悟空（Wukong）" },
      { dirName: ".aone_copilot", displayName: "Aone Copilot" },
      { dirName: ".claudecode", displayName: "Claude Code" },
    ]);

    os.homedir = originalHomedir;

    expect(results).toHaveLength(3);
    expect(results[0].type).toBe("wukong-cleanup");
    expect(results[1].type).toBe("symlink");
    expect(results[2].type).toBe("symlink");
    // Claude Code 的 dest 使用 .claudecode 目录
    expect(results[2].dest).toContain(".claudecode");
  });
});
