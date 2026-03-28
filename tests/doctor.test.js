"use strict";

const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

const {
  DiagnosticEngine,
  EnvironmentChecker,
  ApplicationChecker,
  FixEngine,
  ReportGenerator,
  PreChecker,
  HealthMonitor,
  ProductionErrorCollector,
  TicketCreator,
  VOCCreator,
  SubmissionDecider,
} = require("../lib/core/doctor");

// ── 测试用临时目录 ────────────────────────────────────

function createTempProject(options = {}) {
  const tmpDir = path.join(os.tmpdir(), `yida-doctor-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  if (options.config) {
    fs.writeFileSync(path.join(tmpDir, "config.json"), JSON.stringify(options.config, null, 2), "utf-8");
  }

  if (options.prdFiles) {
    const prdDir = path.join(tmpDir, "prd");
    fs.mkdirSync(prdDir, { recursive: true });
    for (const [name, content] of Object.entries(options.prdFiles)) {
      fs.writeFileSync(path.join(prdDir, name), content, "utf-8");
    }
  }

  if (options.pageSources) {
    const srcDir = path.join(tmpDir, "pages", "src");
    fs.mkdirSync(srcDir, { recursive: true });
    for (const [name, content] of Object.entries(options.pageSources)) {
      fs.writeFileSync(path.join(srcDir, name), content, "utf-8");
    }
  }

  if (options.schemaCache) {
    const cacheDir = path.join(tmpDir, ".cache");
    fs.mkdirSync(cacheDir, { recursive: true });
    for (const [name, content] of Object.entries(options.schemaCache)) {
      fs.writeFileSync(path.join(cacheDir, name), content, "utf-8");
    }
  }

  if (options.cookies) {
    const cacheDir = path.join(tmpDir, ".cache");
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, "cookies.json"), JSON.stringify(options.cookies), "utf-8");
  }

  if (options.errorLogs) {
    const errorLogDir = path.join(tmpDir, ".cache", "error-logs");
    fs.mkdirSync(errorLogDir, { recursive: true });
    for (const [name, content] of Object.entries(options.errorLogs)) {
      fs.writeFileSync(path.join(errorLogDir, name), JSON.stringify(content), "utf-8");
    }
  }

  return tmpDir;
}

function cleanupTempDir(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// ── DiagnosticEngine ──────────────────────────────────

describe("DiagnosticEngine", () => {
  test("注册并执行检查器", async () => {
    const tmpDir = createTempProject();
    const engine = new DiagnosticEngine({ projectRoot: tmpDir });

    const mockChecker = {
      check: async () => [
        { id: "test-1", label: "测试项 1", passed: true, severity: "info" },
        { id: "test-2", label: "测试项 2", passed: false, severity: "error", message: "出错了" },
      ],
    };

    engine.registerChecker(mockChecker);
    const results = await engine.runAll();

    expect(results).toHaveLength(2);
    expect(results[0].passed).toBe(true);
    expect(results[1].passed).toBe(false);

    cleanupTempDir(tmpDir);
  });

  test("getSummary 正确统计", async () => {
    const tmpDir = createTempProject();
    const engine = new DiagnosticEngine({ projectRoot: tmpDir });

    engine.registerChecker({
      check: async () => [
        { id: "a", label: "A", passed: true, severity: "info" },
        { id: "b", label: "B", passed: false, severity: "error", fixType: "auto" },
        { id: "c", label: "C", passed: false, severity: "warning" },
      ],
    });

    await engine.runAll();
    const summary = engine.getSummary();

    expect(summary.total).toBe(3);
    expect(summary.passed).toBe(1);
    expect(summary.errorCount).toBe(1);
    expect(summary.warningCount).toBe(1);
    expect(summary.autoFixable).toBe(1);

    cleanupTempDir(tmpDir);
  });

  test("getAutoFixableIssues 只返回 severity=error 且 fixType=auto 的项", async () => {
    const tmpDir = createTempProject();
    const engine = new DiagnosticEngine({ projectRoot: tmpDir });

    engine.registerChecker({
      check: async () => [
        { id: "a", label: "A", passed: false, severity: "error", fixType: "auto" },
        { id: "b", label: "B", passed: false, severity: "warning", fixType: "auto" },
        { id: "c", label: "C", passed: false, severity: "error", fixType: "manual" },
      ],
    });

    await engine.runAll();
    const fixable = engine.getAutoFixableIssues();

    expect(fixable).toHaveLength(1);
    expect(fixable[0].id).toBe("a");

    cleanupTempDir(tmpDir);
  });

  test("formatConsoleOutput 包含通过和失败信息", async () => {
    const tmpDir = createTempProject();
    const engine = new DiagnosticEngine({ projectRoot: tmpDir });

    engine.registerChecker({
      check: async () => [
        { id: "a", label: "通过项", passed: true, severity: "info" },
        { id: "b", label: "失败项", passed: false, severity: "error", message: "错误详情" },
      ],
    });

    await engine.runAll();
    const output = engine.formatConsoleOutput();

    expect(output).toContain("✅");
    expect(output).toContain("❌");
    expect(output).toContain("通过项");
    expect(output).toContain("失败项");
    expect(output).toContain("错误详情");

    cleanupTempDir(tmpDir);
  });

  test("所有检查通过时显示恭喜信息", async () => {
    const tmpDir = createTempProject();
    const engine = new DiagnosticEngine({ projectRoot: tmpDir });

    engine.registerChecker({
      check: async () => [
        { id: "a", label: "OK", passed: true, severity: "info" },
      ],
    });

    await engine.runAll();
    const output = engine.formatConsoleOutput();

    expect(output).toContain("🎉");

    cleanupTempDir(tmpDir);
  });
});

// ── EnvironmentChecker ────────────────────────────────

describe("EnvironmentChecker", () => {
  let networkSpy;

  beforeEach(() => {
    // mock 网络检查，避免在 CI 环境中因网络不通或超时导致测试失败
    networkSpy = jest.spyOn(EnvironmentChecker.prototype, "checkNetwork").mockResolvedValue({
      id: "env-network",
      label: "网络连通性（aliwork.com）",
      passed: true,
      severity: "info",
      fixType: null,
    });
  });

  afterEach(() => {
    networkSpy.mockRestore();
  });

  test("checkNodeVersion 当前环境应通过", () => {
    const tmpDir = createTempProject();
    const checker = new EnvironmentChecker({ projectRoot: tmpDir });
    const result = checker.checkNodeVersion();

    expect(result.id).toBe("env-node");
    expect(result.passed).toBe(true);
    expect(result.label).toContain("Node.js");

    cleanupTempDir(tmpDir);
  });

  test("checkConfig 无 config.json 时报警告", () => {
    const tmpDir = createTempProject();
    const checker = new EnvironmentChecker({ projectRoot: tmpDir });
    const result = checker.checkConfig();

    expect(result.id).toBe("env-config");
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("warning");
    expect(result.fixType).toBe("auto");

    cleanupTempDir(tmpDir);
  });

  test("checkConfig 有合法 config.json 时通过", () => {
    const tmpDir = createTempProject({
      config: { loginUrl: "https://www.aliwork.com", defaultBaseUrl: "https://www.aliwork.com" },
    });
    const checker = new EnvironmentChecker({ projectRoot: tmpDir });
    const result = checker.checkConfig();

    expect(result.passed).toBe(true);

    cleanupTempDir(tmpDir);
  });

  test("checkConfig 非法 JSON 时报错", () => {
    const tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, "config.json"), "not-json", "utf-8");
    const checker = new EnvironmentChecker({ projectRoot: tmpDir });
    const result = checker.checkConfig();

    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");

    cleanupTempDir(tmpDir);
  });

  test("checkLoginStatus 无 cookies 时报警告", () => {
    const tmpDir = createTempProject();
    const checker = new EnvironmentChecker({ projectRoot: tmpDir });
    const result = checker.checkLoginStatus();

    expect(result.id).toBe("env-login");
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("warning");

    cleanupTempDir(tmpDir);
  });

  test("checkLoginStatus 有有效 cookies 时通过", () => {
    const tmpDir = createTempProject({
      cookies: [{ name: "tianshu_csrf_token", value: "token123" }],
    });
    const checker = new EnvironmentChecker({ projectRoot: tmpDir });
    const result = checker.checkLoginStatus();

    expect(result.passed).toBe(true);

    cleanupTempDir(tmpDir);
  });

  test("checkSkills 无 skills 目录时报警告", () => {
    const tmpDir = createTempProject();
    const checker = new EnvironmentChecker({ projectRoot: tmpDir });
    const result = checker.checkSkills();

    expect(result.id).toBe("env-skills");
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("warning");

    cleanupTempDir(tmpDir);
  });

  test("check 返回所有检查结果", async () => {
    const tmpDir = createTempProject();
    const checker = new EnvironmentChecker({ projectRoot: tmpDir });
    const results = await checker.check();

    expect(results.length).toBeGreaterThanOrEqual(8);
    expect(results.every((r) => r.id && r.label)).toBe(true);

    cleanupTempDir(tmpDir);
  });
});

// ── ApplicationChecker ────────────────────────────────

describe("ApplicationChecker", () => {
  test("checkPrdFiles 无 prd 目录时报警告", () => {
    const tmpDir = createTempProject();
    const checker = new ApplicationChecker({ projectRoot: tmpDir });
    const result = checker.checkPrdFiles();

    expect(result.id).toBe("app-prd");
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("warning");

    cleanupTempDir(tmpDir);
  });

  test("checkPrdFiles 有 PRD 文件时通过", () => {
    const tmpDir = createTempProject({
      prdFiles: { "demo.md": "# 需求文档\n这是一个示例" },
    });
    const checker = new ApplicationChecker({ projectRoot: tmpDir });
    const result = checker.checkPrdFiles();

    expect(result.passed).toBe(true);
    expect(result.label).toContain("1 个");

    cleanupTempDir(tmpDir);
  });

  test("checkPageSources 无 pages/src 目录时报警告", () => {
    const tmpDir = createTempProject();
    const checker = new ApplicationChecker({ projectRoot: tmpDir });
    const result = checker.checkPageSources();

    expect(result.passed).toBe(false);
    expect(result.severity).toBe("warning");

    cleanupTempDir(tmpDir);
  });

  test("checkPageSources 检测 console.log 调试语句", () => {
    const tmpDir = createTempProject({
      pageSources: { "app.js": 'console.log("debug");\nconst x = 1;' },
    });
    const checker = new ApplicationChecker({ projectRoot: tmpDir });
    const result = checker.checkPageSources();

    expect(result.severity).toBe("warning");
    expect(result.message).toContain("console.log");

    cleanupTempDir(tmpDir);
  });

  test("checkSchemaCache 合法 schema 时通过", () => {
    const tmpDir = createTempProject({
      schemaCache: { "demo-schema.json": '{"componentName":"Page"}' },
    });
    const checker = new ApplicationChecker({ projectRoot: tmpDir });
    const result = checker.checkSchemaCache();

    expect(result.passed).toBe(true);

    cleanupTempDir(tmpDir);
  });

  test("checkSchemaCache 非法 schema 时报警告并可修复", () => {
    const tmpDir = createTempProject({
      schemaCache: { "bad-schema.json": "not-json" },
    });
    const checker = new ApplicationChecker({ projectRoot: tmpDir });
    const result = checker.checkSchemaCache();

    expect(result.passed).toBe(false);
    expect(result.fixType).toBe("auto");
    expect(result.fixAction).toBe("delete-invalid-schema");

    cleanupTempDir(tmpDir);
  });

  test("checkReactHooks 无源码时跳过", () => {
    const tmpDir = createTempProject();
    const checker = new ApplicationChecker({ projectRoot: tmpDir });
    const result = checker.checkReactHooks();

    expect(result.passed).toBe(true);

    cleanupTempDir(tmpDir);
  });

  test("check 返回所有应用检查结果", async () => {
    const tmpDir = createTempProject();
    const checker = new ApplicationChecker({ projectRoot: tmpDir });
    const results = await checker.check();

    expect(results).toHaveLength(4);

    cleanupTempDir(tmpDir);
  });
});

// ── FixEngine ─────────────────────────────────────────

describe("FixEngine", () => {
  test("autoFix 创建 config.json", async () => {
    const tmpDir = createTempProject();
    const fixEngine = new FixEngine({ projectRoot: tmpDir });

    const issues = [
      { id: "env-config", fixType: "auto", fixAction: "create-config", severity: "error" },
    ];

    await fixEngine.autoFix(issues);
    expect(fs.existsSync(path.join(tmpDir, "config.json"))).toBe(true);

    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, "config.json"), "utf-8"));
    expect(config.loginUrl).toBeDefined();

    cleanupTempDir(tmpDir);
  });

  test("autoFix 删除损坏的 schema 缓存", async () => {
    const tmpDir = createTempProject({
      schemaCache: { "bad-schema.json": "not-json" },
    });
    const fixEngine = new FixEngine({ projectRoot: tmpDir });

    const issues = [
      {
        id: "app-schema",
        fixType: "auto",
        fixAction: "delete-invalid-schema",
        fixTarget: "bad-schema.json",
        severity: "error",
      },
    ];

    await fixEngine.autoFix(issues);
    expect(fs.existsSync(path.join(tmpDir, ".cache", "bad-schema.json"))).toBe(false);

    cleanupTempDir(tmpDir);
  });

  test("autoFix 对 command 类型给出手动提示", async () => {
    const tmpDir = createTempProject();
    const fixEngine = new FixEngine({ projectRoot: tmpDir });

    const issues = [
      { id: "env-playwright", fixType: "command", fixCommand: "npm install playwright && npx playwright install chromium", severity: "error" },
    ];

    await fixEngine.autoFix(issues);
    expect(fixEngine.fixResults[0].fixed).toBe(false);
    expect(fixEngine.fixResults[0].message).toContain("npm install playwright");

    cleanupTempDir(tmpDir);
  });

  test("formatFixOutput 包含修复结果", async () => {
    const tmpDir = createTempProject();
    const fixEngine = new FixEngine({ projectRoot: tmpDir });

    await fixEngine.autoFix([
      { id: "env-config", fixType: "auto", fixAction: "create-config", severity: "error" },
    ]);

    const output = fixEngine.formatFixOutput();
    expect(output).toContain("✅");
    expect(output).toContain("config.json");

    cleanupTempDir(tmpDir);
  });
});

// ── ReportGenerator ───────────────────────────────────

describe("ReportGenerator", () => {
  const mockResults = [
    { id: "a", label: "Node.js", passed: true, severity: "info" },
    { id: "b", label: "Playwright", passed: false, severity: "error", message: "未安装" },
  ];
  const mockSummary = { total: 2, passed: 1, errorCount: 1, warningCount: 0, infoCount: 1, autoFixable: 0 };

  test("生成 JSON 报告", () => {
    const tmpDir = createTempProject();
    const reporter = new ReportGenerator({ projectRoot: tmpDir });
    const reportPath = reporter.generate(mockResults, mockSummary, "json");

    expect(reportPath).toContain(".json");
    expect(fs.existsSync(reportPath)).toBe(true);

    const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
    expect(report.summary.total).toBe(2);
    expect(report.results).toHaveLength(2);

    cleanupTempDir(tmpDir);
  });

  test("生成 Markdown 报告", () => {
    const tmpDir = createTempProject();
    const reporter = new ReportGenerator({ projectRoot: tmpDir });
    const reportPath = reporter.generate(mockResults, mockSummary, "markdown");

    expect(reportPath).toContain(".md");
    expect(fs.existsSync(reportPath)).toBe(true);

    const content = fs.readFileSync(reportPath, "utf-8");
    expect(content).toContain("# OpenYida 诊断报告");
    expect(content).toContain("Node.js");

    cleanupTempDir(tmpDir);
  });

  test("生成 HTML 报告", () => {
    const tmpDir = createTempProject();
    const reporter = new ReportGenerator({ projectRoot: tmpDir });
    const reportPath = reporter.generate(mockResults, mockSummary, "html");

    expect(reportPath).toContain(".html");
    expect(fs.existsSync(reportPath)).toBe(true);

    const content = fs.readFileSync(reportPath, "utf-8");
    expect(content).toContain("<!DOCTYPE html>");
    expect(content).toContain("OpenYida 诊断报告");

    cleanupTempDir(tmpDir);
  });

  test("未知格式默认生成 Markdown", () => {
    const tmpDir = createTempProject();
    const reporter = new ReportGenerator({ projectRoot: tmpDir });
    const reportPath = reporter.generate(mockResults, mockSummary, "unknown");

    expect(reportPath).toContain(".md");

    cleanupTempDir(tmpDir);
  });
});

// ── PreChecker ────────────────────────────────────────

describe("PreChecker", () => {
  let networkSpy;

  beforeEach(() => {
    // mock 网络检查，避免在 CI 环境中因网络不通或超时导致测试失败
    networkSpy = jest.spyOn(EnvironmentChecker.prototype, "checkNetwork").mockResolvedValue({
      id: "env-network",
      label: "网络连通性（aliwork.com）",
      passed: true,
      severity: "info",
      fixType: null,
    });
  });

  afterEach(() => {
    networkSpy.mockRestore();
  });

  test("prePublishCheck 返回检查结果和通过状态", async () => {
    const tmpDir = createTempProject({
      config: { loginUrl: "https://www.aliwork.com" },
    });
    const preChecker = new PreChecker({ projectRoot: tmpDir });
    const result = await preChecker.prePublishCheck();

    expect(result).toHaveProperty("passed");
    expect(result).toHaveProperty("results");
    expect(result).toHaveProperty("criticalIssues");
    expect(Array.isArray(result.results)).toBe(true);

    cleanupTempDir(tmpDir);
  });

  test("preCreateCheck 仅执行环境检查", async () => {
    const tmpDir = createTempProject();
    const preChecker = new PreChecker({ projectRoot: tmpDir });
    const result = await preChecker.preCreateCheck();

    expect(result).toHaveProperty("passed");
    // 环境检查结果的 id 都以 env- 开头
    const envResults = result.results.filter((r) => r.id.startsWith("env-"));
    expect(envResults.length).toBe(result.results.length);

    cleanupTempDir(tmpDir);
  });
});

// ── HealthMonitor ─────────────────────────────────────

describe("HealthMonitor", () => {
  test("calculateHealthScore 全部通过时返回 100", () => {
    const tmpDir = createTempProject();
    const monitor = new HealthMonitor({ projectRoot: tmpDir });
    const score = monitor.calculateHealthScore({ total: 10, passed: 10, errorCount: 0, warningCount: 0 });

    expect(score).toBe(100);

    cleanupTempDir(tmpDir);
  });

  test("calculateHealthScore 有错误时扣分", () => {
    const tmpDir = createTempProject();
    const monitor = new HealthMonitor({ projectRoot: tmpDir });
    const score = monitor.calculateHealthScore({ total: 10, passed: 8, errorCount: 2, warningCount: 0 });

    expect(score).toBeLessThan(100);
    expect(score).toBeGreaterThanOrEqual(0);

    cleanupTempDir(tmpDir);
  });

  test("calculateHealthScore 空检查返回 100", () => {
    const tmpDir = createTempProject();
    const monitor = new HealthMonitor({ projectRoot: tmpDir });
    const score = monitor.calculateHealthScore({ total: 0, passed: 0, errorCount: 0, warningCount: 0 });

    expect(score).toBe(100);

    cleanupTempDir(tmpDir);
  });

  test("formatMonitorOutput 包含健康度信息", () => {
    const tmpDir = createTempProject();
    const monitor = new HealthMonitor({ projectRoot: tmpDir });
    monitor.history = [{ healthScore: 80 }];

    const output = monitor.formatMonitorOutput({
      timestamp: new Date().toISOString(),
      healthScore: 85,
      passed: 8,
      total: 10,
      errorCount: 1,
      warningCount: 1,
    });

    expect(output).toContain("健康度");
    expect(output).toContain("85");

    cleanupTempDir(tmpDir);
  });

  test("start 和 stop 正常工作", () => {
    jest.useFakeTimers();
    const tmpDir = createTempProject();
    const monitor = new HealthMonitor({
      projectRoot: tmpDir,
      intervalMs: 100_000,
    });

    // mock runOnce 避免实际执行异步诊断
    monitor.runOnce = jest.fn();

    monitor.start();
    expect(monitor.timer).not.toBeNull();

    monitor.stop();
    expect(monitor.timer).toBeNull();

    jest.useRealTimers();
    cleanupTempDir(tmpDir);
  });
});

// ── ProductionErrorCollector ──────────────────────────

describe("ProductionErrorCollector", () => {
  test("无 appId 时报错", async () => {
    const tmpDir = createTempProject();
    const collector = new ProductionErrorCollector({ projectRoot: tmpDir });
    const results = await collector.check();

    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(false);
    expect(results[0].message).toContain("应用 ID");

    cleanupTempDir(tmpDir);
  });

  test("有 appId 但无错误日志时通过", async () => {
    const tmpDir = createTempProject();
    const collector = new ProductionErrorCollector({ projectRoot: tmpDir, appId: "APP_TEST" });
    const results = await collector.check();

    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(true);

    cleanupTempDir(tmpDir);
  });

  test("有错误日志时报警告", async () => {
    const tmpDir = createTempProject({
      errorLogs: { "APP_TEST.json": [{ error: "TypeError", timestamp: "2026-01-01" }] },
    });
    const collector = new ProductionErrorCollector({ projectRoot: tmpDir, appId: "APP_TEST" });
    const results = await collector.check();

    expect(results[0].passed).toBe(false);
    expect(results[0].severity).toBe("warning");
    expect(results[0].message).toContain("1 条");

    cleanupTempDir(tmpDir);
  });
});

// ── TicketCreator ─────────────────────────────────────

describe("TicketCreator", () => {
  test("createTicket 保存工单到本地", async () => {
    const tmpDir = createTempProject();
    const creator = new TicketCreator({ projectRoot: tmpDir });
    const ticket = await creator.createTicket({
      title: "测试工单",
      description: "这是一个测试",
      type: "bug",
    });

    expect(ticket.id).toMatch(/^TICKET-/);
    expect(ticket.title).toBe("测试工单");
    expect(ticket.type).toBe("bug");
    expect(["draft", "local", "submitted"]).toContain(ticket.status);

    // 验证本地文件已保存
    const ticketPath = path.join(tmpDir, ".cache", "tickets", `${ticket.id}.json`);
    expect(fs.existsSync(ticketPath)).toBe(true);

    cleanupTempDir(tmpDir);
  });
});

// ── VOCCreator ────────────────────────────────────────

describe("VOCCreator", () => {
  test("createVOC 保存 VOC 到本地", async () => {
    const tmpDir = createTempProject();
    const creator = new VOCCreator({ projectRoot: tmpDir });
    const voc = await creator.createVOC({
      title: "测试需求",
      description: "希望增加暗色模式",
    });

    expect(voc.id).toMatch(/^VOC-/);
    expect(voc.title).toBe("测试需求");
    expect(["draft", "local", "submitted"]).toContain(voc.status);

    const vocPath = path.join(tmpDir, ".cache", "voc", `${voc.id}.json`);
    expect(fs.existsSync(vocPath)).toBe(true);

    cleanupTempDir(tmpDir);
  });

  test("analyzeBusinessValue 高优先级关键词", () => {
    const tmpDir = createTempProject();
    const creator = new VOCCreator({ projectRoot: tmpDir });
    const analysis = creator.analyzeBusinessValue("线上崩溃，紧急修复");

    expect(analysis.suggestedPriority).toBe("high");
    expect(analysis.businessValue).toBe("high");

    cleanupTempDir(tmpDir);
  });

  test("analyzeBusinessValue 低优先级关键词", () => {
    const tmpDir = createTempProject();
    const creator = new VOCCreator({ projectRoot: tmpDir });
    const analysis = creator.analyzeBusinessValue("建议美化一下文档");

    expect(analysis.suggestedPriority).toBe("low");

    cleanupTempDir(tmpDir);
  });

  test("analyzeBusinessValue 默认中优先级", () => {
    const tmpDir = createTempProject();
    const creator = new VOCCreator({ projectRoot: tmpDir });
    const analysis = creator.analyzeBusinessValue("一般性描述");

    expect(analysis.suggestedPriority).toBe("medium");

    cleanupTempDir(tmpDir);
  });
});

// ── SubmissionDecider ─────────────────────────────────

describe("SubmissionDecider", () => {
  test("decide 识别 bug 类描述为工单", () => {
    const tmpDir = createTempProject();
    const decider = new SubmissionDecider({ projectRoot: tmpDir });
    const decision = decider.decide("页面崩溃", "点击按钮后报错，无法正常使用");

    expect(decision.type).toBe("ticket");
    expect(decision.confidence).toBeGreaterThan(0.5);

    cleanupTempDir(tmpDir);
  });

  test("decide 识别需求类描述为 VOC", () => {
    const tmpDir = createTempProject();
    const decider = new SubmissionDecider({ projectRoot: tmpDir });
    const decision = decider.decide("新增功能", "希望支持暗色模式，优化用户体验");

    expect(decision.type).toBe("voc");
    expect(decision.confidence).toBeGreaterThan(0.5);

    cleanupTempDir(tmpDir);
  });

  test("autoSubmit 返回完整结果", async () => {
    const tmpDir = createTempProject();
    const decider = new SubmissionDecider({ projectRoot: tmpDir });
    const result = await decider.autoSubmit({
      title: "页面报错",
      description: "登录后页面崩溃",
    });

    expect(result).toHaveProperty("decision");
    expect(result).toHaveProperty("type");
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("message");

    cleanupTempDir(tmpDir);
  });
});