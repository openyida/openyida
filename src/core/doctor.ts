/**
 * doctor.ts - 宜搭 CLI 应用自动诊断模块
 *
 * 提供环境检查、应用诊断、智能修复、报告生成、健康监控等功能。
 *
 * 导出类：
 *   DiagnosticEngine         - 诊断引擎核心调度器（三层架构）
 *   EnvironmentChecker       - 环境诊断（Node/Python/Playwright/gh/config/Skills/登录态/网络）
 *   ApplicationChecker       - 应用诊断（PRD/页面源码/Schema/React Hooks 检测）
 *   FixEngine                - 智能修复引擎（自动修复/手动提示/命令执行）
 *   ReportGenerator          - 诊断报告生成（JSON/Markdown/HTML）
 *   PreChecker               - 预检查（发布前/创建前自动检查）
 *   HealthMonitor            - 持续健康度监控与趋势分析
 *   ProductionErrorCollector - 线上错误诊断与智能分析
 *   TicketCreator            - 工单创建（集成 GitHub Issues）
 *   VOCCreator               - VOC 创建（业务价值分析/优先级建议）
 *   SubmissionDecider        - 智能提交决策（自动判断工单/VOC）
 *
 * 导出函数：
 *   run(args)                - CLI 入口，解析参数并执行诊断
 */

'use strict';

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { findProjectRoot } from './utils';

// ── 诊断结果常量 ──────────────────────────────────────

const Severity = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
} as const;

type SeverityValue = typeof Severity[keyof typeof Severity];

const FixType = {
  AUTO: 'auto',
  MANUAL: 'manual',
  COMMAND: 'command',
} as const;

type FixTypeValue = typeof FixType[keyof typeof FixType];

interface DiagnosticResult {
  id: string;
  label: string;
  passed: boolean;
  severity: SeverityValue;
  message?: string | null;
  fixType?: FixTypeValue | null;
  fixAction?: string;
  fixTarget?: string;
  fixCommand?: string | null;
}

interface DiagnosticSummary {
  total: number;
  passed: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  autoFixable: number;
}

interface FixResult {
  id: string;
  fixed: boolean;
  message: string;
}

interface HealthSnapshot extends DiagnosticSummary {
  timestamp: string;
  healthScore: number;
}

interface Ticket {
  id: string;
  title: string;
  description: string;
  type: string;
  labels: string[];
  createdAt: string;
  status: string;
  remoteUrl: string | null;
}

interface VOC {
  id: string;
  title: string | undefined;
  description: string | undefined;
  priority: string;
  businessValue: string;
  analysis: BusinessValueAnalysis;
  createdAt: string;
  status: string;
  remoteUrl: string | null;
}

interface BusinessValueAnalysis {
  suggestedPriority: string;
  businessValue: string;
}

interface SubmissionDecision {
  type: 'ticket' | 'voc';
  reason: string;
  confidence: number;
}

interface SubmissionResult {
  decision: SubmissionDecision;
  type: 'ticket' | 'voc';
  data: Ticket | VOC;
  message: string;
}

interface DoctorOptions {
  fix: boolean;
  repair: boolean;
  production: boolean;
  app: string | null;
  monitor: boolean;
  report: string | null;
  createTicket: boolean;
  createVoc: boolean;
  autoSubmit: boolean;
}

// ── DiagnosticEngine ──────────────────────────────────

/**
 * 诊断引擎核心调度器。
 * 三层架构：注册 Checker → 执行诊断 → 汇总结果。
 */
export class DiagnosticEngine {
  private projectRoot: string;
  private checkers: Array<{ check(): Promise<DiagnosticResult[]> }>;
  private results: DiagnosticResult[];

  constructor({ projectRoot }: { projectRoot?: string } = {}) {
    this.projectRoot = projectRoot || findProjectRoot();
    this.checkers = [];
    this.results = [];
  }

  registerChecker(checker: { check(): Promise<DiagnosticResult[]> }): void {
    this.checkers.push(checker);
  }

  async runAll(): Promise<DiagnosticResult[]> {
    this.results = [];
    for (const checker of this.checkers) {
      const checkerResults = await checker.check();
      this.results.push(...checkerResults);
    }
    return this.results;
  }

  getAutoFixableIssues(): DiagnosticResult[] {
    return this.results.filter(
      (result) => result.fixType === FixType.AUTO && result.severity === Severity.ERROR
    );
  }

  getSummary(): DiagnosticSummary {
    const errorCount = this.results.filter((r) => r.severity === Severity.ERROR).length;
    const warningCount = this.results.filter((r) => r.severity === Severity.WARNING).length;
    const infoCount = this.results.filter((r) => r.severity === Severity.INFO).length;
    const autoFixable = this.getAutoFixableIssues().length;
    const passed = this.results.filter((r) => r.passed).length;
    const total = this.results.length;

    return { total, passed, errorCount, warningCount, infoCount, autoFixable };
  }

  formatConsoleOutput(): string {
    const lines: string[] = [];
    for (const result of this.results) {
      const icon = result.passed ? '✅' : result.severity === Severity.ERROR ? '❌' : '⚠️ ';
      lines.push(`${icon} ${result.label}`);
      if (!result.passed && result.message) {
        lines.push(`   ${result.message}`);
      }
    }

    const summary = this.getSummary();
    lines.push('');
    if (summary.errorCount === 0 && summary.warningCount === 0) {
      lines.push('🎉 所有检查通过，环境配置完整！');
    } else {
      lines.push(
        `发现 ${summary.total - summary.passed} 个问题（${summary.errorCount} 个错误，${summary.warningCount} 个警告）`
      );
    }

    return lines.join('\n');
  }
}

// ── EnvironmentChecker ────────────────────────────────

/**
 * 环境诊断检查器。
 * 检查 Node.js、Python、Playwright、gh CLI、config.json、Skills、登录态、网络连通性。
 */
export class EnvironmentChecker {
  private projectRoot: string;

  constructor({ projectRoot }: { projectRoot?: string } = {}) {
    this.projectRoot = projectRoot || findProjectRoot();
  }

  async check(): Promise<DiagnosticResult[]> {
    return [
      this.checkNodeVersion(),
      this.checkPythonVersion(),
      this.checkPlaywrightInstalled(),
      this.checkPlaywrightChromium(),
      this.checkGhCli(),
      this.checkGhAuth(),
      this.checkConfig(),
      this.checkSkills(),
      this.checkLoginStatus(),
      await this.checkNetwork(),
    ];
  }

  private checkNodeVersion(): DiagnosticResult {
    const nodeVersion = process.versions.node;
    const major = parseInt(nodeVersion.split('.')[0], 10);
    const passed = major >= 16;
    return {
      id: 'env-node',
      label: `Node.js v${nodeVersion}（要求 ≥ 16）`,
      passed,
      severity: passed ? Severity.INFO : Severity.ERROR,
      message: passed ? null : `Node.js 版本过低（${nodeVersion}），请升级到 v16+`,
      fixType: null,
    };
  }

  private checkPythonVersion(): DiagnosticResult {
    try {
      const pythonVersion = execSync('python3 --version 2>&1', { encoding: 'utf-8' }).trim();
      const versionMatch = pythonVersion.match(/Python (\d+)\.(\d+)/);
      if (versionMatch) {
        const major = parseInt(versionMatch[1], 10);
        const minor = parseInt(versionMatch[2], 10);
        const passed = major > 3 || (major === 3 && minor >= 10);
        return {
          id: 'env-python',
          label: `${pythonVersion}（要求 ≥ 3.10）`,
          passed,
          severity: passed ? Severity.INFO : Severity.ERROR,
          message: passed ? null : `Python 版本过低（${pythonVersion}），请升级到 3.10+`,
          fixType: null,
        };
      }
      return {
        id: 'env-python',
        label: 'Python 版本检测',
        passed: false,
        severity: Severity.ERROR,
        message: '无法解析 Python 版本',
        fixType: null,
      };
    } catch {
      return {
        id: 'env-python',
        label: 'Python 3 安装检测',
        passed: false,
        severity: Severity.ERROR,
        message: '未找到 python3，请安装：https://www.python.org/',
        fixType: null,
      };
    }
  }

  private checkPlaywrightInstalled(): DiagnosticResult {
    try {
      execSync('python3 -c "import playwright"', { encoding: 'utf-8', stdio: 'pipe' });
      return {
        id: 'env-playwright',
        label: 'Playwright 已安装',
        passed: true,
        severity: Severity.INFO,
        fixType: null,
      };
    } catch {
      return {
        id: 'env-playwright',
        label: 'Playwright 安装检测',
        passed: false,
        severity: Severity.ERROR,
        message: 'Playwright 未安装',
        fixType: FixType.COMMAND,
        fixCommand: 'pip install playwright',
      };
    }
  }

  private checkPlaywrightChromium(): DiagnosticResult {
    try {
      execSync(
        'python3 -c "from playwright.sync_api import sync_playwright; p = sync_playwright().start(); p.stop()"',
        { encoding: 'utf-8', stdio: 'pipe', timeout: 10_000 }
      );
      return {
        id: 'env-playwright-chromium',
        label: 'Playwright Chromium 已安装',
        passed: true,
        severity: Severity.INFO,
        fixType: null,
      };
    } catch {
      return {
        id: 'env-playwright-chromium',
        label: 'Playwright Chromium 安装检测',
        passed: false,
        severity: Severity.WARNING,
        message: 'Playwright Chromium 可能未安装',
        fixType: FixType.COMMAND,
        fixCommand: 'playwright install chromium',
      };
    }
  }

  private checkGhCli(): DiagnosticResult {
    try {
      const ghVersion = execSync('gh --version 2>&1', { encoding: 'utf-8' }).split('\n')[0].trim();
      return {
        id: 'env-gh',
        label: ghVersion,
        passed: true,
        severity: Severity.INFO,
        fixType: null,
      };
    } catch {
      return {
        id: 'env-gh',
        label: 'gh CLI 安装检测',
        passed: false,
        severity: Severity.ERROR,
        message: 'gh CLI 未安装，请安装：https://cli.github.com/',
        fixType: null,
      };
    }
  }

  private checkGhAuth(): DiagnosticResult {
    try {
      execSync('gh auth status 2>&1', { encoding: 'utf-8', stdio: 'pipe' });
      return {
        id: 'env-gh-auth',
        label: 'gh CLI 已登录',
        passed: true,
        severity: Severity.INFO,
        fixType: null,
      };
    } catch {
      return {
        id: 'env-gh-auth',
        label: 'gh CLI 登录状态',
        passed: false,
        severity: Severity.WARNING,
        message: 'gh CLI 未登录',
        fixType: FixType.COMMAND,
        fixCommand: 'gh auth login',
      };
    }
  }

  private checkConfig(): DiagnosticResult {
    const configPath = path.join(this.projectRoot, 'config.json');
    if (!fs.existsSync(configPath)) {
      return {
        id: 'env-config',
        label: 'config.json 检测',
        passed: false,
        severity: Severity.WARNING,
        message: 'config.json 不存在',
        fixType: FixType.AUTO,
        fixAction: 'create-config',
      };
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      JSON.parse(content);
      return {
        id: 'env-config',
        label: 'config.json 存在且格式正确',
        passed: true,
        severity: Severity.INFO,
        fixType: null,
      };
    } catch {
      return {
        id: 'env-config',
        label: 'config.json 检测',
        passed: false,
        severity: Severity.ERROR,
        message: 'config.json 格式错误，请检查 JSON 语法',
        fixType: null,
      };
    }
  }

  private checkSkills(): DiagnosticResult {
    const skillsPath = path.join(this.projectRoot, '.claude', 'skills', 'skills');
    if (fs.existsSync(skillsPath)) {
      const skills = fs.readdirSync(skillsPath).filter((name) =>
        fs.statSync(path.join(skillsPath, name)).isDirectory()
      );
      return {
        id: 'env-skills',
        label: `Skills 已安装（${skills.length} 个）`,
        passed: true,
        severity: Severity.INFO,
        fixType: null,
      };
    }
    return {
      id: 'env-skills',
      label: 'Skills 安装检测',
      passed: false,
      severity: Severity.WARNING,
      message: 'Skills 未安装，运行 bash install-skills.sh 安装',
      fixType: FixType.MANUAL,
    };
  }

  private checkLoginStatus(): DiagnosticResult {
    const cookiePath = path.join(this.projectRoot, '.cache', 'cookies.json');
    if (!fs.existsSync(cookiePath)) {
      return {
        id: 'env-login',
        label: '宜搭登录态',
        passed: false,
        severity: Severity.WARNING,
        message: '未登录（运行 yida login 登录）',
        fixType: FixType.COMMAND,
        fixCommand: 'yida login',
      };
    }

    try {
      const cookieData = JSON.parse(fs.readFileSync(cookiePath, 'utf-8'));
      const cookies: Array<{ name: string }> = Array.isArray(cookieData)
        ? cookieData
        : cookieData.cookies || [];
      const hasToken = cookies.some((c) => c.name === 'tianshu_csrf_token');
      const passed = hasToken;
      return {
        id: 'env-login',
        label: `宜搭登录态：${passed ? '已登录' : 'Cookie 存在但可能已过期'}`,
        passed,
        severity: passed ? Severity.INFO : Severity.WARNING,
        message: passed ? null : 'Cookie 可能已过期，运行 yida login 重新登录',
        fixType: passed ? null : FixType.COMMAND,
        fixCommand: passed ? null : 'yida login',
      };
    } catch {
      return {
        id: 'env-login',
        label: '宜搭登录态',
        passed: false,
        severity: Severity.WARNING,
        message: 'Cookie 文件损坏',
        fixType: FixType.COMMAND,
        fixCommand: 'yida login',
      };
    }
  }

  private async checkNetwork(): Promise<DiagnosticResult> {
    try {
      const https = require('https') as typeof import('https');
      await new Promise<number>((resolve, reject) => {
        const request = https.get('https://www.aliwork.com', { timeout: 5000 }, (response) => {
          resolve(response.statusCode ?? 0);
        });
        request.on('error', reject);
        request.on('timeout', () => {
          request.destroy();
          reject(new Error('timeout'));
        });
      });
      return {
        id: 'env-network',
        label: '网络连通性（aliwork.com）',
        passed: true,
        severity: Severity.INFO,
        fixType: null,
      };
    } catch {
      return {
        id: 'env-network',
        label: '网络连通性检测',
        passed: false,
        severity: Severity.WARNING,
        message: '无法连接 aliwork.com，请检查网络',
        fixType: null,
      };
    }
  }
}

// ── ApplicationChecker ────────────────────────────────

/**
 * 应用诊断检查器。
 * 检查 PRD 文件、页面源码、Schema 缓存、React Hooks 使用规范。
 */
export class ApplicationChecker {
  private projectRoot: string;
  private appId: string | null;

  constructor({ projectRoot, appId }: { projectRoot?: string; appId?: string } = {}) {
    this.projectRoot = projectRoot || findProjectRoot();
    this.appId = appId || null;
  }

  async check(): Promise<DiagnosticResult[]> {
    return [
      this.checkPrdFiles(),
      this.checkPageSources(),
      this.checkSchemaCache(),
      this.checkReactHooks(),
    ];
  }

  private checkPrdFiles(): DiagnosticResult {
    const prdDir = path.join(this.projectRoot, 'prd');
    if (!fs.existsSync(prdDir)) {
      return {
        id: 'app-prd',
        label: 'PRD 文件检测',
        passed: false,
        severity: Severity.WARNING,
        message: 'prd/ 目录不存在，建议创建 PRD 文档描述应用需求',
        fixType: FixType.MANUAL,
      };
    }

    const prdFiles = fs.readdirSync(prdDir).filter((f) => f.endsWith('.md'));
    const passed = prdFiles.length > 0;
    return {
      id: 'app-prd',
      label: `PRD 文件（${prdFiles.length} 个）`,
      passed,
      severity: passed ? Severity.INFO : Severity.WARNING,
      message: passed ? null : 'prd/ 目录为空，建议添加 PRD 文档',
      fixType: null,
    };
  }

  private checkPageSources(): DiagnosticResult {
    const srcDir = path.join(this.projectRoot, 'pages', 'src');
    if (!fs.existsSync(srcDir)) {
      return {
        id: 'app-pages',
        label: '页面源码检测',
        passed: false,
        severity: Severity.WARNING,
        message: 'pages/src/ 目录不存在',
        fixType: FixType.MANUAL,
      };
    }

    const sourceFiles = fs.readdirSync(srcDir).filter((f) => /\.(js|jsx|ts|tsx)$/.test(f));
    const issues: string[] = [];

    for (const file of sourceFiles) {
      const filePath = path.join(srcDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      if (content.length === 0) {
        issues.push(`${file}: 文件为空`);
      }
      if (content.includes('console.log') && !content.includes('// eslint-disable')) {
        issues.push(`${file}: 包含 console.log 调试语句`);
      }
    }

    const passed = issues.length === 0 && sourceFiles.length > 0;
    return {
      id: 'app-pages',
      label: `页面源码（${sourceFiles.length} 个文件${issues.length > 0 ? `，${issues.length} 个问题` : ''}）`,
      passed,
      severity: issues.length > 0 ? Severity.WARNING : Severity.INFO,
      message: issues.length > 0 ? issues.join('；') : null,
      fixType: null,
    };
  }

  private checkSchemaCache(): DiagnosticResult {
    const cacheDir = path.join(this.projectRoot, '.cache');
    if (!fs.existsSync(cacheDir)) {
      return {
        id: 'app-schema',
        label: 'Schema 缓存检测',
        passed: true,
        severity: Severity.INFO,
        message: null,
        fixType: null,
      };
    }

    const schemaFiles = fs.readdirSync(cacheDir).filter((f) => f.endsWith('-schema.json'));
    for (const file of schemaFiles) {
      try {
        const content = fs.readFileSync(path.join(cacheDir, file), 'utf-8');
        JSON.parse(content);
      } catch {
        return {
          id: 'app-schema',
          label: 'Schema 缓存检测',
          passed: false,
          severity: Severity.WARNING,
          message: `Schema 缓存文件 ${file} 格式错误`,
          fixType: FixType.AUTO,
          fixAction: 'delete-invalid-schema',
          fixTarget: file,
        };
      }
    }

    return {
      id: 'app-schema',
      label: `Schema 缓存（${schemaFiles.length} 个）`,
      passed: true,
      severity: Severity.INFO,
      fixType: null,
    };
  }

  private checkReactHooks(): DiagnosticResult {
    const srcDir = path.join(this.projectRoot, 'pages', 'src');
    if (!fs.existsSync(srcDir)) {
      return {
        id: 'app-hooks',
        label: 'React Hooks 检测',
        passed: true,
        severity: Severity.INFO,
        message: '无页面源码，跳过检测',
        fixType: null,
      };
    }

    const sourceFiles = fs.readdirSync(srcDir).filter((f) => /\.(js|jsx)$/.test(f));
    const hookIssues: string[] = [];

    for (const file of sourceFiles) {
      const content = fs.readFileSync(path.join(srcDir, file), 'utf-8');
      const lines = content.split('\n');

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        if (/if\s*\(.*\)\s*\{/.test(line)) {
          const blockEnd = findBlockEnd(lines, lineIndex);
          const blockContent = lines.slice(lineIndex, blockEnd + 1).join('\n');
          if (/\buse[A-Z]\w*\s*\(/.test(blockContent)) {
            hookIssues.push(`${file}:${lineIndex + 1}: 条件语句中使用了 React Hook`);
          }
        }
      }
    }

    const passed = hookIssues.length === 0;
    return {
      id: 'app-hooks',
      label: `React Hooks 规范${hookIssues.length > 0 ? `（${hookIssues.length} 个问题）` : ''}`,
      passed,
      severity: passed ? Severity.INFO : Severity.WARNING,
      message: passed ? null : hookIssues.join('；'),
      fixType: null,
    };
  }
}

/**
 * 查找代码块的结束行号。
 */
function findBlockEnd(lines: string[], startLine: number): number {
  let depth = 0;
  for (let index = startLine; index < lines.length; index++) {
    for (const char of lines[index]) {
      if (char === '{') {depth++;}
      if (char === '}') {depth--;}
      if (depth === 0 && index > startLine) {return index;}
    }
  }
  return lines.length - 1;
}

// ── FixEngine ─────────────────────────────────────────

/**
 * 智能修复引擎。
 * 支持自动修复、手动提示、命令执行三种修复方式。
 */
export class FixEngine {
  private projectRoot: string;
  private fixResults: FixResult[];

  constructor({ projectRoot }: { projectRoot?: string } = {}) {
    this.projectRoot = projectRoot || findProjectRoot();
    this.fixResults = [];
  }

  async autoFix(issues: DiagnosticResult[]): Promise<FixResult[]> {
    this.fixResults = [];

    for (const issue of issues) {
      if (issue.fixType === FixType.AUTO) {
        const result = this.applyAutoFix(issue);
        this.fixResults.push(result);
      } else if (issue.fixType === FixType.COMMAND) {
        this.fixResults.push({
          id: issue.id,
          fixed: false,
          message: `请手动运行：${issue.fixCommand}`,
        });
      } else if (issue.fixType === FixType.MANUAL) {
        this.fixResults.push({
          id: issue.id,
          fixed: false,
          message: issue.message || '请手动修复',
        });
      }
    }

    return this.fixResults;
  }

  private applyAutoFix(issue: DiagnosticResult): FixResult {
    switch (issue.fixAction) {
      case 'create-config': {
        const configPath = path.join(this.projectRoot, 'config.json');
        const template = {
          loginUrl: 'https://www.aliwork.com/workPlatform',
          defaultBaseUrl: 'https://www.aliwork.com',
        };
        fs.writeFileSync(configPath, JSON.stringify(template, null, 2), 'utf-8');
        return {
          id: issue.id,
          fixed: true,
          message: '已创建 config.json 模板，请根据实际情况修改 loginUrl',
        };
      }

      case 'delete-invalid-schema': {
        const schemaPath = path.join(this.projectRoot, '.cache', issue.fixTarget || '');
        if (fs.existsSync(schemaPath)) {
          fs.unlinkSync(schemaPath);
        }
        return {
          id: issue.id,
          fixed: true,
          message: `已删除损坏的 Schema 缓存文件：${issue.fixTarget}`,
        };
      }

      default:
        return {
          id: issue.id,
          fixed: false,
          message: `未知的修复动作：${issue.fixAction}`,
        };
    }
  }

  formatFixOutput(): string {
    const lines: string[] = [];
    for (const result of this.fixResults) {
      const icon = result.fixed ? '✅' : '💡';
      lines.push(`${icon} ${result.message}`);
    }
    const fixedCount = this.fixResults.filter((r) => r.fixed).length;
    if (fixedCount > 0) {
      lines.push(`\n✅ 自动修复了 ${fixedCount} 个问题`);
    }
    return lines.join('\n');
  }
}

// ── ReportGenerator ───────────────────────────────────

/**
 * 诊断报告生成器。
 * 支持 JSON、Markdown、HTML 三种格式。
 */
export class ReportGenerator {
  private projectRoot: string;

  constructor({ projectRoot }: { projectRoot?: string } = {}) {
    this.projectRoot = projectRoot || findProjectRoot();
  }

  generate(results: DiagnosticResult[], summary: DiagnosticSummary, format: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportDir = path.join(this.projectRoot, '.cache', 'reports');

    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    switch (format) {
      case 'json':
        return this.generateJson(results, summary, reportDir, timestamp);
      case 'markdown':
        return this.generateMarkdown(results, summary, reportDir, timestamp);
      case 'html':
        return this.generateHtml(results, summary, reportDir, timestamp);
      default:
        console.error(`未知报告格式：${format}，使用 markdown`);
        return this.generateMarkdown(results, summary, reportDir, timestamp);
    }
  }

  private generateJson(
    results: DiagnosticResult[],
    summary: DiagnosticSummary,
    reportDir: string,
    timestamp: string
  ): string {
    const reportPath = path.join(reportDir, `doctor-${timestamp}.json`);
    const report = { timestamp: new Date().toISOString(), summary, results };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    return reportPath;
  }

  private generateMarkdown(
    results: DiagnosticResult[],
    summary: DiagnosticSummary,
    reportDir: string,
    timestamp: string
  ): string {
    const reportPath = path.join(reportDir, `doctor-${timestamp}.md`);
    const lines = [
      '# OpenYida 诊断报告',
      '',
      `生成时间：${new Date().toLocaleString()}`,
      '',
      '## 汇总',
      '',
      '| 指标 | 数量 |',
      '|------|------|',
      `| 总检查项 | ${summary.total} |`,
      `| 通过 | ${summary.passed} |`,
      `| 错误 | ${summary.errorCount} |`,
      `| 警告 | ${summary.warningCount} |`,
      `| 可自动修复 | ${summary.autoFixable} |`,
      '',
      '## 详细结果',
      '',
    ];

    for (const result of results) {
      const icon = result.passed ? '✅' : result.severity === Severity.ERROR ? '❌' : '⚠️';
      lines.push(`- ${icon} **${result.label}**`);
      if (!result.passed && result.message) {
        lines.push(`  - ${result.message}`);
      }
    }

    fs.writeFileSync(reportPath, lines.join('\n'), 'utf-8');
    return reportPath;
  }

  private generateHtml(
    results: DiagnosticResult[],
    summary: DiagnosticSummary,
    reportDir: string,
    timestamp: string
  ): string {
    const reportPath = path.join(reportDir, `doctor-${timestamp}.html`);
    const resultRows = results
      .map((result) => {
        const icon = result.passed ? '✅' : result.severity === Severity.ERROR ? '❌' : '⚠️';
        const message = result.message || '-';
        return `<tr><td>${icon}</td><td>${result.label}</td><td>${message}</td></tr>`;
      })
      .join('\n');

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>OpenYida 诊断报告</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    h1 { color: #333; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f5f5f5; }
    .summary { display: flex; gap: 20px; margin: 20px 0; }
    .summary-card { background: #f9f9f9; padding: 16px; border-radius: 8px; flex: 1; text-align: center; }
    .summary-card .number { font-size: 24px; font-weight: bold; }
  </style>
</head>
<body>
  <h1>🔍 OpenYida 诊断报告</h1>
  <p>生成时间：${new Date().toLocaleString()}</p>
  <div class="summary">
    <div class="summary-card"><div class="number">${summary.total}</div><div>总检查项</div></div>
    <div class="summary-card"><div class="number">${summary.passed}</div><div>通过</div></div>
    <div class="summary-card"><div class="number">${summary.errorCount}</div><div>错误</div></div>
    <div class="summary-card"><div class="number">${summary.warningCount}</div><div>警告</div></div>
  </div>
  <table>
    <thead><tr><th>状态</th><th>检查项</th><th>详情</th></tr></thead>
    <tbody>${resultRows}</tbody>
  </table>
</body>
</html>`;

    fs.writeFileSync(reportPath, html, 'utf-8');
    return reportPath;
  }
}

// ── PreChecker ────────────────────────────────────────

/**
 * 预检查器。
 * 在发布前或创建前自动执行检查，确保环境和应用状态正常。
 */
export class PreChecker {
  private projectRoot: string;

  constructor({ projectRoot }: { projectRoot?: string } = {}) {
    this.projectRoot = projectRoot || findProjectRoot();
  }

  async prePublishCheck(): Promise<{ passed: boolean; results: DiagnosticResult[]; criticalIssues: DiagnosticResult[] }> {
    const engine = new DiagnosticEngine({ projectRoot: this.projectRoot });
    engine.registerChecker(new EnvironmentChecker({ projectRoot: this.projectRoot }));
    engine.registerChecker(new ApplicationChecker({ projectRoot: this.projectRoot }));

    const results = await engine.runAll();
    const criticalIssues = results.filter(
      (r) => !r.passed && r.severity === Severity.ERROR
    );

    return { passed: criticalIssues.length === 0, results, criticalIssues };
  }

  async preCreateCheck(): Promise<{ passed: boolean; results: DiagnosticResult[]; criticalIssues: DiagnosticResult[] }> {
    const engine = new DiagnosticEngine({ projectRoot: this.projectRoot });
    engine.registerChecker(new EnvironmentChecker({ projectRoot: this.projectRoot }));

    const results = await engine.runAll();
    const criticalIssues = results.filter(
      (r) => !r.passed && r.severity === Severity.ERROR
    );

    return { passed: criticalIssues.length === 0, results, criticalIssues };
  }
}

// ── HealthMonitor ─────────────────────────────────────

/**
 * 持续健康度监控。
 * 定时执行诊断并记录趋势数据。
 */
export class HealthMonitor {
  private projectRoot: string;
  private intervalMs: number;
  private onResult: ((snapshot: HealthSnapshot) => void) | null;
  private timer: ReturnType<typeof setInterval> | null;
  private history: HealthSnapshot[];

  constructor({
    projectRoot,
    intervalMs,
    onResult,
  }: {
    projectRoot?: string;
    intervalMs?: number;
    onResult?: (snapshot: HealthSnapshot) => void;
  } = {}) {
    this.projectRoot = projectRoot || findProjectRoot();
    this.intervalMs = intervalMs || 60_000;
    this.onResult = onResult || null;
    this.timer = null;
    this.history = [];
  }

  start(): void {
    this.runOnce();
    this.timer = setInterval(() => this.runOnce(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runOnce(): Promise<void> {
    const engine = new DiagnosticEngine({ projectRoot: this.projectRoot });
    engine.registerChecker(new EnvironmentChecker({ projectRoot: this.projectRoot }));
    engine.registerChecker(new ApplicationChecker({ projectRoot: this.projectRoot }));

    await engine.runAll();
    const summary = engine.getSummary();
    const snapshot: HealthSnapshot = {
      timestamp: new Date().toISOString(),
      ...summary,
      healthScore: this.calculateHealthScore(summary),
    };

    this.history.push(snapshot);
    if (this.onResult) {
      this.onResult(snapshot);
    }
  }

  calculateHealthScore(summary: DiagnosticSummary): number {
    if (summary.total === 0) {return 100;}
    const passRate = summary.passed / summary.total;
    const errorPenalty = summary.errorCount * 10;
    const warningPenalty = summary.warningCount * 3;
    return Math.max(0, Math.round(passRate * 100 - errorPenalty - warningPenalty));
  }

  formatMonitorOutput(snapshot: HealthSnapshot): string {
    const time = new Date(snapshot.timestamp).toLocaleTimeString();
    const trend =
      this.history.length >= 2
        ? this.history[this.history.length - 1].healthScore -
          this.history[this.history.length - 2].healthScore
        : 0;
    const trendIcon = trend > 0 ? '📈' : trend < 0 ? '📉' : '➡️';

    return [
      `[${time}] 健康度: ${snapshot.healthScore}/100 ${trendIcon}`,
      `  通过: ${snapshot.passed}/${snapshot.total} | 错误: ${snapshot.errorCount} | 警告: ${snapshot.warningCount}`,
    ].join('\n');
  }
}

// ── ProductionErrorCollector ──────────────────────────

/**
 * 线上错误诊断与智能分析。
 * 收集线上应用的错误日志并进行分类分析。
 */
export class ProductionErrorCollector {
  private projectRoot: string;
  private appId: string | null;

  constructor({ projectRoot, appId }: { projectRoot?: string; appId?: string } = {}) {
    this.projectRoot = projectRoot || findProjectRoot();
    this.appId = appId || null;
  }

  async check(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    if (!this.appId) {
      results.push({
        id: 'prod-app-id',
        label: '线上诊断：应用 ID',
        passed: false,
        severity: Severity.ERROR,
        message: '未指定应用 ID，请使用 --app <appId> 参数',
        fixType: null,
      });
      return results;
    }

    const errorLogPath = path.join(
      this.projectRoot,
      '.cache',
      'error-logs',
      `${this.appId}.json`
    );
    if (fs.existsSync(errorLogPath)) {
      try {
        const errorLog = JSON.parse(fs.readFileSync(errorLogPath, 'utf-8'));
        const errorCount = Array.isArray(errorLog) ? errorLog.length : 0;
        results.push({
          id: 'prod-errors',
          label: `线上错误日志（${errorCount} 条）`,
          passed: errorCount === 0,
          severity: errorCount > 0 ? Severity.WARNING : Severity.INFO,
          message: errorCount > 0 ? `发现 ${errorCount} 条错误日志，建议排查` : null,
          fixType: null,
        });
      } catch {
        results.push({
          id: 'prod-errors',
          label: '线上错误日志',
          passed: false,
          severity: Severity.WARNING,
          message: '错误日志文件格式异常',
          fixType: null,
        });
      }
    } else {
      results.push({
        id: 'prod-errors',
        label: '线上错误日志',
        passed: true,
        severity: Severity.INFO,
        message: '无本地错误日志缓存',
        fixType: null,
      });
    }

    return results;
  }
}

// ── TicketCreator ─────────────────────────────────────

/**
 * 工单创建器。
 * 集成 GitHub Issues，支持从诊断结果创建工单。
 */
export class TicketCreator {
  private projectRoot: string;

  constructor({ projectRoot }: { projectRoot?: string } = {}) {
    this.projectRoot = projectRoot || findProjectRoot();
  }

  async createTicket({
    title,
    description,
    type = 'bug',
    labels = [],
  }: {
    title: string;
    description: string;
    type?: string;
    labels?: string[];
  }): Promise<Ticket> {
    const ticket: Ticket = {
      id: `TICKET-${Date.now()}`,
      title,
      description,
      type,
      labels: [...labels, type],
      createdAt: new Date().toISOString(),
      status: 'draft',
      remoteUrl: null,
    };

    try {
      const labelArgs = ticket.labels.map((label) => `-l "${label}"`).join(' ');
      const result = execSync(
        `gh issue create --title "${title}" --body "${description}" ${labelArgs} 2>&1`,
        { encoding: 'utf-8', cwd: this.projectRoot, timeout: 15_000 }
      );
      const urlMatch = result.match(/https:\/\/github\.com\/\S+/);
      if (urlMatch) {
        ticket.status = 'submitted';
        ticket.remoteUrl = urlMatch[0];
      }
    } catch {
      ticket.status = 'local';
    }

    this.saveTicketLocally(ticket);
    return ticket;
  }

  private saveTicketLocally(ticket: Ticket): void {
    const ticketDir = path.join(this.projectRoot, '.cache', 'tickets');
    if (!fs.existsSync(ticketDir)) {
      fs.mkdirSync(ticketDir, { recursive: true });
    }
    const ticketPath = path.join(ticketDir, `${ticket.id}.json`);
    fs.writeFileSync(ticketPath, JSON.stringify(ticket, null, 2), 'utf-8');
  }
}

// ── VOCCreator ────────────────────────────────────────

/**
 * VOC（Voice of Customer）创建器。
 * 业务价值分析与优先级建议。
 */
export class VOCCreator {
  private projectRoot: string;

  constructor({ projectRoot }: { projectRoot?: string } = {}) {
    this.projectRoot = projectRoot || findProjectRoot();
  }

  async createVOC({
    title,
    description,
    priority,
    businessValue,
  }: {
    title?: string;
    description?: string;
    priority?: string;
    businessValue?: string;
  } = {}): Promise<VOC> {
    const analysis = this.analyzeBusinessValue(description || '');
    const voc: VOC = {
      id: `VOC-${Date.now()}`,
      title,
      description,
      priority: priority || analysis.suggestedPriority,
      businessValue: businessValue || analysis.businessValue,
      analysis,
      createdAt: new Date().toISOString(),
      status: 'draft',
      remoteUrl: null,
    };

    try {
      const result = execSync(
        `gh issue create --title "[VOC] ${title}" --body "${description}" -l "voc" -l "enhancement" 2>&1`,
        { encoding: 'utf-8', cwd: this.projectRoot, timeout: 15_000 }
      );
      const urlMatch = result.match(/https:\/\/github\.com\/\S+/);
      if (urlMatch) {
        voc.status = 'submitted';
        voc.remoteUrl = urlMatch[0];
      }
    } catch {
      voc.status = 'local';
    }

    this.saveVOCLocally(voc);
    return voc;
  }

  private analyzeBusinessValue(description: string): BusinessValueAnalysis {
    const keywords = {
      high: ['紧急', '严重', '阻塞', '线上', '生产', '崩溃', '数据丢失'],
      medium: ['影响', '用户', '体验', '性能', '优化', '改进'],
      low: ['建议', '希望', '可以', '美化', '文档'],
    };

    const lowerDescription = description.toLowerCase();
    let suggestedPriority = 'medium';
    let businessValue = 'medium';

    if (keywords.high.some((keyword) => lowerDescription.includes(keyword))) {
      suggestedPriority = 'high';
      businessValue = 'high';
    } else if (keywords.low.some((keyword) => lowerDescription.includes(keyword))) {
      suggestedPriority = 'low';
      businessValue = 'low';
    }

    return { suggestedPriority, businessValue };
  }

  private saveVOCLocally(voc: VOC): void {
    const vocDir = path.join(this.projectRoot, '.cache', 'voc');
    if (!fs.existsSync(vocDir)) {
      fs.mkdirSync(vocDir, { recursive: true });
    }
    const vocPath = path.join(vocDir, `${voc.id}.json`);
    fs.writeFileSync(vocPath, JSON.stringify(voc, null, 2), 'utf-8');
  }
}

// ── SubmissionDecider ─────────────────────────────────

/**
 * 智能提交决策器。
 * 自动判断应该创建工单还是 VOC。
 */
export class SubmissionDecider {
  private projectRoot: string;

  constructor({ projectRoot }: { projectRoot?: string } = {}) {
    this.projectRoot = projectRoot || findProjectRoot();
  }

  async autoSubmit({ title, description }: { title: string; description: string }): Promise<SubmissionResult> {
    const decision = this.decide(title, description);

    if (decision.type === 'ticket') {
      const creator = new TicketCreator({ projectRoot: this.projectRoot });
      const ticket = await creator.createTicket({ title, description, type: 'bug' });
      return {
        decision,
        type: 'ticket',
        data: ticket,
        message:
          ticket.status === 'submitted'
            ? `工单已提交：${ticket.remoteUrl}`
            : `工单已保存到本地（ID: ${ticket.id}）`,
      };
    }

    const creator = new VOCCreator({ projectRoot: this.projectRoot });
    const voc = await creator.createVOC({ title, description });
    return {
      decision,
      type: 'voc',
      data: voc,
      message:
        voc.status === 'submitted'
          ? `VOC 已提交：${voc.remoteUrl}`
          : `VOC 已保存到本地（ID: ${voc.id}）`,
    };
  }

  private decide(title: string, description: string): SubmissionDecision {
    const combined = `${title} ${description}`.toLowerCase();
    const bugKeywords = ['bug', '错误', '异常', '崩溃', '失败', '报错', '无法', '不能', '修复'];
    const featureKeywords = ['需求', '功能', '建议', '希望', '优化', '新增', '改进', '支持'];

    const bugScore = bugKeywords.filter((keyword) => combined.includes(keyword)).length;
    const featureScore = featureKeywords.filter((keyword) => combined.includes(keyword)).length;

    if (bugScore > featureScore) {
      return {
        type: 'ticket',
        reason: '检测到问题/缺陷相关描述，建议创建工单',
        confidence: Math.min(0.95, 0.5 + bugScore * 0.1),
      };
    }

    return {
      type: 'voc',
      reason: '检测到需求/建议相关描述，建议创建 VOC',
      confidence: Math.min(0.95, 0.5 + featureScore * 0.1),
    };
  }
}

// ── CLI 入口 ──────────────────────────────────────────

function parseArgs(args: string[]): DoctorOptions {
  const options: DoctorOptions = {
    fix: false,
    repair: false,
    production: false,
    app: null,
    monitor: false,
    report: null,
    createTicket: false,
    createVoc: false,
    autoSubmit: false,
  };

  for (let index = 0; index < args.length; index++) {
    switch (args[index]) {
      case '--fix':
        options.fix = true;
        break;
      case '--repair':
        options.repair = true;
        break;
      case '--production':
        options.production = true;
        break;
      case '--app':
        options.app = args[++index] || null;
        break;
      case '--monitor':
        options.monitor = true;
        break;
      case '--report':
        options.report = args[++index] || 'markdown';
        break;
      case '--create-ticket':
        options.createTicket = true;
        break;
      case '--create-voc':
        options.createVoc = true;
        break;
      case '--auto-submit':
        options.autoSubmit = true;
        break;
    }
  }

  return options;
}

export async function run(args: string[]): Promise<void> {
  const options = parseArgs(args);
  const projectRoot = findProjectRoot();
  const doFix = options.repair || options.fix;

  // ── 监控模式 ──
  if (options.monitor) {
    console.log('📊 启动健康度实时监控...\n');
    const monitor = new HealthMonitor({
      projectRoot,
      intervalMs: 60_000,
      onResult: (snapshot) => {
        console.log(monitor.formatMonitorOutput(snapshot));
        console.log('');
      },
    });
    monitor.start();
    console.log('按 Ctrl+C 停止监控\n');
    process.on('SIGINT', () => {
      monitor.stop();
      console.log('\n👋 监控已停止');
      process.exit(0);
    });
    return;
  }

  // ── 创建工单 ──
  if (options.createTicket) {
    const readline = require('readline') as typeof import('readline');
    const readlineInterface = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    readlineInterface.question('工单标题：', (title: string) => {
      readlineInterface.question('问题描述：', async (description: string) => {
        readlineInterface.close();
        const creator = new TicketCreator({ projectRoot });
        const ticket = await creator.createTicket({ title, description, type: 'bug' });
        if (ticket.status === 'submitted') {
          console.log(`✅ 工单已提交：${ticket.remoteUrl}`);
        } else {
          console.log(`💾 工单已保存到本地（ID: ${ticket.id}）`);
        }
      });
    });
    return;
  }

  // ── 创建 VOC ──
  if (options.createVoc) {
    const readline = require('readline') as typeof import('readline');
    const readlineInterface = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    readlineInterface.question('VOC 标题：', (title: string) => {
      readlineInterface.question('需求描述：', async (description: string) => {
        readlineInterface.close();
        const creator = new VOCCreator({ projectRoot });
        const voc = await creator.createVOC({ title, description });
        if (voc.status === 'submitted') {
          console.log(`✅ VOC 已提交：${voc.remoteUrl}`);
        } else {
          console.log(`💾 VOC 已保存到本地（ID: ${voc.id}）`);
        }
      });
    });
    return;
  }

  // ── 自动提交决策 ──
  if (options.autoSubmit) {
    const readline = require('readline') as typeof import('readline');
    const readlineInterface = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    readlineInterface.question('标题：', (title: string) => {
      readlineInterface.question('描述：', async (description: string) => {
        readlineInterface.close();
        const decider = new SubmissionDecider({ projectRoot });
        const result = await decider.autoSubmit({ title, description });
        console.log(`\n🤖 决策：${result.decision.reason}`);
        console.log(`📊 置信度：${Math.round(result.decision.confidence * 100)}%`);
        console.log(`✅ ${result.message}`);
      });
    });
    return;
  }

  // ── 标准诊断流程 ──
  const SEP = '='.repeat(55);
  console.log(SEP);
  console.log('  🔍 OpenYida 环境诊断');
  console.log(SEP);

  const engine = new DiagnosticEngine({ projectRoot });

  if (options.production && options.app) {
    engine.registerChecker(new ProductionErrorCollector({ projectRoot, appId: options.app }));
  } else {
    engine.registerChecker(new EnvironmentChecker({ projectRoot }));
    engine.registerChecker(new ApplicationChecker({ projectRoot }));
  }

  console.log('\n🔍 正在执行诊断...\n');
  await engine.runAll();

  console.log(engine.formatConsoleOutput());

  // ── 自动修复 ──
  if (doFix) {
    const autoFixableIssues = engine.getAutoFixableIssues();
    if (autoFixableIssues.length > 0) {
      console.log('\n🔧 正在自动修复...\n');
      const fixEngine = new FixEngine({ projectRoot });
      await fixEngine.autoFix(autoFixableIssues);
      console.log(fixEngine.formatFixOutput());
    } else {
      console.log('\n✅ 没有可自动修复的问题');
    }
  }

  // ── 生成报告 ──
  if (options.report) {
    const summary = engine.getSummary();
    const reportGenerator = new ReportGenerator({ projectRoot });
    const reportPath = reportGenerator.generate(engine['results'], summary, options.report);
    console.log(`\n📄 诊断报告已生成：${reportPath}`);
  }

  console.log('\n' + SEP);
}
