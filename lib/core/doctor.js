/**
 * doctor.js - 宜搭 CLI 应用自动诊断模块
 *
 * 提供环境检查、应用诊断、智能修复、报告生成、健康监控等功能。
 *
 * 导出类：
 *   DiagnosticEngine         - 诊断引擎核心调度器（三层架构）
 *   EnvironmentChecker       - 环境诊断（Node/npm/可选浏览器登录/config/Skills/登录态/网络）
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

const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');
const { findProjectRoot, getNpmExecutable } = require('./utils');

// ── 诊断结果常量 ──────────────────────────────────────

const Severity = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

const FixType = {
  AUTO: 'auto',
  MANUAL: 'manual',
  COMMAND: 'command',
};

// ── DiagnosticEngine ──────────────────────────────────

/**
 * 诊断引擎核心调度器。
 * 三层架构：注册 Checker → 执行诊断 → 汇总结果。
 */
class DiagnosticEngine {
  constructor({ projectRoot } = {}) {
    this.projectRoot = projectRoot || findProjectRoot();
    this.checkers = [];
    this.results = [];
  }

  /**
   * 注册诊断检查器。
   * @param {object} checker - 需实现 check() 方法，返回诊断结果数组
   */
  registerChecker(checker) {
    this.checkers.push(checker);
  }

  /**
   * 执行所有已注册的检查器。
   * @returns {Promise<Array>} 所有诊断结果
   */
  async runAll() {
    this.results = [];
    for (const checker of this.checkers) {
      const checkerResults = await checker.check();
      this.results.push(...checkerResults);
    }
    return this.results;
  }

  /**
   * 获取可自动修复的问题列表。
   * @returns {Array}
   */
  getAutoFixableIssues() {
    return this.results.filter(
      (result) => result.fixType === FixType.AUTO && result.severity === Severity.ERROR
    );
  }

  /**
   * 获取诊断汇总信息。
   * @returns {object}
   */
  getSummary() {
    const errorCount = this.results.filter((r) => r.severity === Severity.ERROR).length;
    const warningCount = this.results.filter((r) => r.severity === Severity.WARNING).length;
    const infoCount = this.results.filter((r) => r.severity === Severity.INFO).length;
    const autoFixable = this.getAutoFixableIssues().length;
    const passed = this.results.filter((r) => r.passed).length;
    const total = this.results.length;

    return { total, passed, errorCount, warningCount, infoCount, autoFixable };
  }

  /**
   * 格式化控制台输出。
   * @returns {string}
   */
  formatConsoleOutput() {
    const lines = [];
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
 * 检查 Node.js、npm、可选浏览器登录支持、config.json、Skills、登录态、网络连通性。
 */
class EnvironmentChecker {
  constructor({ projectRoot } = {}) {
    this.projectRoot = projectRoot || findProjectRoot();
  }

  /**
   * 执行所有环境检查。
   * @returns {Promise<Array>}
   */
  async check() {
    return [
      this.checkNodeVersion(),
      this.checkNpmVersion(),
      this.checkOptionalBrowserLogin(),
      this.checkConfig(),
      this.checkLoginStatus(),
      await this.checkNetwork(),
    ];
  }

  checkNpmVersion() {
    try {
      const npmVersion = execFileSync(getNpmExecutable(), ['--version'], { encoding: 'utf-8' }).trim();
      const major = parseInt(npmVersion.split('.')[0], 10);
      const passed = major >= 7;
      return {
        id: 'env-npm',
        label: `npm v${npmVersion}（要求 ≥ 7）`,
        passed,
        severity: passed ? Severity.INFO : Severity.WARNING,
        message: passed ? null : `npm 版本过低（${npmVersion}），建议升级到 v7+`,
        fixType: passed ? null : FixType.COMMAND,
        fixCommand: passed ? null : 'npm install -g npm@latest',
      };
    } catch {
      return {
        id: 'env-npm',
        label: 'npm 安装检测',
        passed: false,
        severity: Severity.ERROR,
        message: 'npm 未安装或无法执行',
        fixType: null,
      };
    }
  }

  checkNodeVersion() {
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

  checkOptionalBrowserLogin() {
    try {
      require.resolve('playwright');
      return {
        id: 'env-playwright',
        label: '可选浏览器登录（Playwright 已安装）',
        passed: true,
        severity: Severity.INFO,
        message: '已安装 Playwright，可使用兼容的本地浏览器扫码登录路径',
        fixType: null,
      };
    } catch {
      return {
        id: 'env-playwright',
        label: '可选浏览器登录（Playwright 未安装）',
        passed: true,
        severity: Severity.INFO,
        message: '默认登录使用终端二维码或 AI 工具内置浏览器 handoff，不需要 Playwright',
        fixType: null,
      };
    }
  }

  checkConfig() {
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

  checkLoginStatus() {
    // 使用统一的 loadCookieData 加载登录态（兼容多环境 cookie 文件）
    const { loadCookieData } = require('./utils');
    const cookieData = loadCookieData(this.projectRoot);

    if (!cookieData || !cookieData.cookies || cookieData.cookies.length === 0) {
      return {
        id: 'env-login',
        label: '宜搭登录态',
        passed: false,
        severity: Severity.WARNING,
        message: '未登录（运行 openyida login 登录）',
        fixType: FixType.COMMAND,
        fixCommand: 'openyida login --qr',
      };
    }

    const hasToken = cookieData.cookies.some((c) => c.name === 'tianshu_csrf_token');
    const passed = hasToken;
    return {
      id: 'env-login',
      label: `宜搭登录态：${passed ? '已登录' : 'Cookie 存在但可能已过期'}`,
      passed,
      severity: passed ? Severity.INFO : Severity.WARNING,
      message: passed ? null : 'Cookie 可能已过期，运行 openyida login 重新登录',
      fixType: passed ? null : FixType.COMMAND,
      fixCommand: passed ? null : 'openyida login --qr',
    };
  }

  async checkNetwork() {
    try {
      const https = require('https');
      await new Promise((resolve, reject) => {
        const request = https.get('https://www.aliwork.com', { timeout: 5000 }, (response) => {
          resolve(response.statusCode);
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

// ── VersionChecker ───────────────────────────────────

/**
 * openyida 版本检查器。
 * 检测当前安装版本是否与 SKILL.md 中的 metadata.version 一致，
 * 不一致时在 --fix 模式下自动升级到最新版。
 */
class VersionChecker {
  constructor({ projectRoot } = {}) {
    this.projectRoot = projectRoot || findProjectRoot();
  }

  /**
   * 读取 SKILL.md 中 metadata.version 字段。
   * @returns {string|null}
   */
  readSkillVersion() {
    const skillPaths = [
      path.join(this.projectRoot, 'yida-skills', 'SKILL.md'),
      path.join(require('os').homedir(), '.claude', 'yida-skills', 'SKILL.md'),
      path.join(require('os').homedir(), '.aone_copilot', 'yida-skills', 'SKILL.md'),
    ];
    for (const skillPath of skillPaths) {
      if (!fs.existsSync(skillPath)) {continue;}
      const content = fs.readFileSync(skillPath, 'utf-8');
      const match = content.match(/^metadata:\s*\n\s*version:\s*(.+)$/m);
      if (match) {return match[1].trim();}
    }
    return null;
  }

  /**
   * 获取当前安装的 openyida 版本。
   * @returns {string|null}
   */
  getInstalledVersion() {
    try {
      return execSync('openyida -v', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    } catch {
      return null;
    }
  }

  async check() {
    const skillVersion = this.readSkillVersion();
    const installedVersion = this.getInstalledVersion();

    if (!skillVersion) {
      return [{
        id: 'version-skill',
        label: 'openyida 版本检测',
        passed: true,
        severity: Severity.INFO,
        message: '无法读取 SKILL.md 版本，跳过版本比对',
        fixType: null,
      }];
    }

    if (!installedVersion) {
      return [{
        id: 'version-installed',
        label: 'openyida 版本检测',
        passed: false,
        severity: Severity.ERROR,
        message: 'openyida 未安装，请运行：npm install -g openyida',
        fixType: FixType.COMMAND,
        fixCommand: 'npm install -g openyida@latest',
      }];
    }

    // 比较主版本号（忽略 -beta.x 等预发布后缀）
    const installedMain = installedVersion.replace(/-.+$/, '');
    const skillMain = skillVersion.replace(/-.+$/, '');
    const passed = installedMain === skillMain;

    return [{
      id: 'version-match',
      label: `openyida 版本：${installedVersion}（SKILL 期望：${skillVersion}）`,
      passed,
      severity: passed ? Severity.INFO : Severity.WARNING,
      message: passed ? null : '版本不匹配，建议升级到最新版',
      fixType: passed ? null : FixType.COMMAND,
      fixCommand: passed ? null : 'npm install -g openyida@latest',
    }];
  }
}

// ── ProjectInitChecker ────────────────────────────────

/**
 * project 工作目录初始化检查器。
 * 检测 project/ 目录是否存在，不存在时在 --fix 模式下自动执行 openyida copy。
 */
class ProjectInitChecker {
  constructor({ projectRoot } = {}) {
    this.projectRoot = projectRoot || findProjectRoot();
  }

  async check() {
    // 若 projectRoot 本身就是 project 目录（AI 工具将工作区根识别为 project/ 子目录时），
    // 则直接检测 projectRoot/config.json，避免拼出 project/project 的错误路径。
    const rootBasename = path.basename(this.projectRoot);
    const projectDir = rootBasename === 'project'
      ? this.projectRoot
      : path.join(this.projectRoot, 'project');
    const configPath = path.join(projectDir, 'config.json');
    const passed = fs.existsSync(projectDir) && fs.existsSync(configPath);

    return [{
      id: 'project-init',
      label: passed ? 'project/ 工作目录已初始化' : 'project/ 工作目录检测',
      passed,
      severity: passed ? Severity.INFO : Severity.ERROR,
      message: passed ? null : 'project/ 目录未初始化，将自动初始化',
      fixType: passed ? null : FixType.AUTO,
      fixAction: passed ? null : 'init-project',
    }];
  }
}

// ── ApplicationChecker ────────────────────────────────

/**
 * 应用诊断检查器。
 * 检查 PRD 文件、页面源码、Schema 缓存、React Hooks 使用规范。
 */
class ApplicationChecker {
  constructor({ projectRoot, appId } = {}) {
    this.projectRoot = projectRoot || findProjectRoot();
    this.appId = appId || null;
  }

  /**
   * 执行所有应用检查。
   * @returns {Promise<Array>}
   */
  async check() {
    return [
      this.checkPrdFiles(),
      this.checkPageSources(),
      this.checkSchemaCache(),
      this.checkReactHooks(),
    ];
  }

  checkPrdFiles() {
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

  checkPageSources() {
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
    const issues = [];

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

  checkSchemaCache() {
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

  checkReactHooks() {
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
    const hookIssues = [];

    for (const file of sourceFiles) {
      const content = fs.readFileSync(path.join(srcDir, file), 'utf-8');
      const lines = content.split('\n');

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        // 检测条件语句中使用 Hooks
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
 * @param {string[]} lines
 * @param {number} startLine
 * @returns {number}
 */
function findBlockEnd(lines, startLine) {
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
class FixEngine {
  constructor({ projectRoot } = {}) {
    this.projectRoot = projectRoot || findProjectRoot();
    this.fixResults = [];
  }

  /**
   * 自动修复所有可修复的问题。
   * @param {Array} issues - 可修复的诊断结果列表
   * @returns {Promise<Array>}
   */
  async autoFix(issues) {
    this.fixResults = [];

    for (const issue of issues) {
      if (issue.fixType === FixType.AUTO) {
        const result = await this.applyAutoFix(issue);
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
          message: issue.message,
        });
      }
    }

    return this.fixResults;
  }

  /**
   * 执行自动修复动作。
   * @param {object} issue
   * @returns {Promise<object>}
   */
  async applyAutoFix(issue) {
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
        const schemaPath = path.join(this.projectRoot, '.cache', issue.fixTarget);
        if (fs.existsSync(schemaPath)) {
          fs.unlinkSync(schemaPath);
        }
        return {
          id: issue.id,
          fixed: true,
          message: `已删除损坏的 Schema 缓存文件：${issue.fixTarget}`,
        };
      }

      case 'init-project': {
        try {
          const copy = require('./copy');
          await copy.run([]);
          return {
            id: issue.id,
            fixed: true,
            message: '已自动初始化 project/ 工作目录',
          };
        } catch (error) {
          return {
            id: issue.id,
            fixed: false,
            message: `project/ 初始化失败，请手动运行：openyida copy（${error.message}）`,
          };
        }
      }

      default:
        return {
          id: issue.id,
          fixed: false,
          message: `未知的修复动作：${issue.fixAction}`,
        };
    }
  }

  /**
   * 格式化修复结果输出。
   * @returns {string}
   */
  formatFixOutput() {
    const lines = [];
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
class ReportGenerator {
  constructor({ projectRoot } = {}) {
    this.projectRoot = projectRoot || findProjectRoot();
  }

  /**
   * 生成诊断报告。
   * @param {Array} results - 诊断结果
   * @param {object} summary - 汇总信息
   * @param {string} format - 报告格式（json | markdown | html）
   * @returns {string} 报告文件路径
   */
  generate(results, summary, format) {
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
        console.warn(`未知报告格式：${format}，使用 markdown`);
        return this.generateMarkdown(results, summary, reportDir, timestamp);
    }
  }

  generateJson(results, summary, reportDir, timestamp) {
    const reportPath = path.join(reportDir, `doctor-${timestamp}.json`);
    const report = {
      timestamp: new Date().toISOString(),
      summary,
      results,
    };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    return reportPath;
  }

  generateMarkdown(results, summary, reportDir, timestamp) {
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

  generateHtml(results, summary, reportDir, timestamp) {
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
class PreChecker {
  constructor({ projectRoot } = {}) {
    this.projectRoot = projectRoot || findProjectRoot();
  }

  /**
   * 执行发布前预检查。
   * @returns {Promise<{ passed: boolean, results: Array }>}
   */
  async prePublishCheck() {
    const engine = new DiagnosticEngine({ projectRoot: this.projectRoot });
    engine.registerChecker(new EnvironmentChecker({ projectRoot: this.projectRoot }));
    engine.registerChecker(new ApplicationChecker({ projectRoot: this.projectRoot }));

    const results = await engine.runAll();
    const criticalIssues = results.filter(
      (r) => !r.passed && r.severity === Severity.ERROR
    );

    return {
      passed: criticalIssues.length === 0,
      results,
      criticalIssues,
    };
  }

  /**
   * 执行创建前预检查（仅环境检查）。
   * @returns {Promise<{ passed: boolean, results: Array }>}
   */
  async preCreateCheck() {
    const engine = new DiagnosticEngine({ projectRoot: this.projectRoot });
    engine.registerChecker(new EnvironmentChecker({ projectRoot: this.projectRoot }));

    const results = await engine.runAll();
    const criticalIssues = results.filter(
      (r) => !r.passed && r.severity === Severity.ERROR
    );

    return {
      passed: criticalIssues.length === 0,
      results,
      criticalIssues,
    };
  }
}

// ── HealthMonitor ─────────────────────────────────────

/**
 * 持续健康度监控。
 * 定时执行诊断并记录趋势数据。
 */
class HealthMonitor {
  constructor({ projectRoot, intervalMs, onResult } = {}) {
    this.projectRoot = projectRoot || findProjectRoot();
    this.intervalMs = intervalMs || 60_000;
    this.onResult = onResult || null;
    this.timer = null;
    this.history = [];
  }

  /**
   * 启动监控。
   */
  start() {
    this.runOnce();
    this.timer = setInterval(() => this.runOnce(), this.intervalMs);
  }

  /**
   * 停止监控。
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * 执行一次诊断快照。
   */
  async runOnce() {
    const engine = new DiagnosticEngine({ projectRoot: this.projectRoot });
    engine.registerChecker(new EnvironmentChecker({ projectRoot: this.projectRoot }));
    engine.registerChecker(new ApplicationChecker({ projectRoot: this.projectRoot }));

    await engine.runAll();
    const summary = engine.getSummary();
    const snapshot = {
      timestamp: new Date().toISOString(),
      ...summary,
      healthScore: this.calculateHealthScore(summary),
    };

    this.history.push(snapshot);
    if (this.onResult) {
      this.onResult(snapshot);
    }
  }

  /**
   * 计算健康度分数（0-100）。
   * @param {object} summary
   * @returns {number}
   */
  calculateHealthScore(summary) {
    if (summary.total === 0) {return 100;}
    const passRate = summary.passed / summary.total;
    const errorPenalty = summary.errorCount * 10;
    const warningPenalty = summary.warningCount * 3;
    return Math.max(0, Math.round(passRate * 100 - errorPenalty - warningPenalty));
  }

  /**
   * 格式化监控输出。
   * @param {object} snapshot
   * @returns {string}
   */
  formatMonitorOutput(snapshot) {
    const time = new Date(snapshot.timestamp).toLocaleTimeString();
    const trend = this.history.length >= 2
      ? this.history[this.history.length - 1].healthScore - this.history[this.history.length - 2].healthScore
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
class ProductionErrorCollector {
  constructor({ projectRoot, appId } = {}) {
    this.projectRoot = projectRoot || findProjectRoot();
    this.appId = appId || null;
  }

  /**
   * 执行线上错误检查。
   * @returns {Promise<Array>}
   */
  async check() {
    const results = [];

    // 检查应用 ID 是否提供
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

    // 检查本地错误日志
    const errorLogPath = path.join(this.projectRoot, '.cache', 'error-logs', `${this.appId}.json`);
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
class TicketCreator {
  constructor({ projectRoot } = {}) {
    this.projectRoot = projectRoot || findProjectRoot();
  }

  /**
   * 创建工单。
   * @param {object} options - { title, description, type, labels }
   * @returns {Promise<object>}
   */
  async createTicket({ title, description, type = 'bug', labels = [] }) {
    const ticket = {
      id: `TICKET-${Date.now()}`,
      title,
      description,
      type,
      labels: [...labels, type],
      createdAt: new Date().toISOString(),
      status: 'draft',
      remoteUrl: null,
    };

    // 尝试通过 gh CLI 创建 GitHub Issue
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
      // gh CLI 不可用时保存到本地
      ticket.status = 'local';
    }

    // 保存到本地
    this.saveTicketLocally(ticket);
    return ticket;
  }

  /**
   * 保存工单到本地文件。
   * @param {object} ticket
   */
  saveTicketLocally(ticket) {
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
class VOCCreator {
  constructor({ projectRoot } = {}) {
    this.projectRoot = projectRoot || findProjectRoot();
  }

  /**
   * 创建 VOC。
   * @param {object} options - { title, description, priority, businessValue }
   * @returns {Promise<object>}
   */
  async createVOC({ title, description, priority, businessValue } = {}) {
    const analysis = this.analyzeBusinessValue(description || '');
    const voc = {
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

    // 尝试通过 gh CLI 创建 GitHub Issue（带 VOC 标签）
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

  /**
   * 分析业务价值。
   * @param {string} description
   * @returns {object}
   */
  analyzeBusinessValue(description) {
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

  /**
   * 保存 VOC 到本地文件。
   * @param {object} voc
   */
  saveVOCLocally(voc) {
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
class SubmissionDecider {
  constructor({ projectRoot } = {}) {
    this.projectRoot = projectRoot || findProjectRoot();
  }

  /**
   * 自动提交决策。
   * @param {object} options - { title, description }
   * @returns {Promise<object>}
   */
  async autoSubmit({ title, description }) {
    const decision = this.decide(title, description);

    let result;
    if (decision.type === 'ticket') {
      const creator = new TicketCreator({ projectRoot: this.projectRoot });
      const ticket = await creator.createTicket({ title, description, type: 'bug' });
      result = {
        decision,
        type: 'ticket',
        data: ticket,
        message: ticket.status === 'submitted'
          ? `工单已提交：${ticket.remoteUrl}`
          : `工单已保存到本地（ID: ${ticket.id}）`,
      };
    } else {
      const creator = new VOCCreator({ projectRoot: this.projectRoot });
      const voc = await creator.createVOC({ title, description });
      result = {
        decision,
        type: 'voc',
        data: voc,
        message: voc.status === 'submitted'
          ? `VOC 已提交：${voc.remoteUrl}`
          : `VOC 已保存到本地（ID: ${voc.id}）`,
      };
    }

    return result;
  }

  /**
   * 决策逻辑：判断是工单还是 VOC。
   * @param {string} title
   * @param {string} description
   * @returns {object}
   */
  decide(title, description) {
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

/**
 * 解析 doctor 命令的参数。
 * @param {string[]} args - CLI 参数列表
 * @returns {object}
 */
function parseArgs(args) {
  const options = {
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

/**
 * 执行 doctor 命令。
 * @param {string[]} args - CLI 参数列表
 */
async function run(args) {
  const options = parseArgs(args);
  const projectRoot = findProjectRoot();
  const doFix = options.repair || options.fix;

  // ── 监控模式 ──
  if (options.monitor) {
    const { c } = require('./chalk');
    console.log(`\n  ${c.cyan}📊${c.reset} ${c.bold}启动健康度实时监控...${c.reset}\n`);
    const monitor = new HealthMonitor({
      projectRoot,
      intervalMs: 60_000,
      onResult: (snapshot) => {
        console.log(monitor.formatMonitorOutput(snapshot));
        console.log('');
      },
    });
    monitor.start();
    console.log(`  ${c.dim}按 Ctrl+C 停止监控${c.reset}\n`);
    process.on('SIGINT', () => {
      monitor.stop();
      console.log(`\n  ${c.dim}👋 监控已停止${c.reset}`);
      process.exit(0);
    });
    return;
  }

  // ── 创建工单 ──
  if (options.createTicket) {
    const readline = require('readline');
    const readlineInterface = readline.createInterface({ input: process.stdin, output: process.stdout });
    readlineInterface.question('工单标题：', (title) => {
      readlineInterface.question('问题描述：', async (description) => {
        readlineInterface.close();
        const creator = new TicketCreator({ projectRoot });
        const ticket = await creator.createTicket({ title, description, type: 'bug' });
        const { c: cc1 } = require('./chalk');
        if (ticket.status === 'submitted') {
          console.log(`\n  ${cc1.green}✔${cc1.reset} 工单已提交：${cc1.cyan}${ticket.remoteUrl}${cc1.reset}`);
        } else {
          console.log(`\n  ${cc1.green}✔${cc1.reset} 工单已保存到本地（ID: ${cc1.cyan}${ticket.id}${cc1.reset}）`);
        }
      });
    });
    return;
  }

  // ── 创建 VOC ──
  if (options.createVoc) {
    const readline = require('readline');
    const readlineInterface = readline.createInterface({ input: process.stdin, output: process.stdout });
    readlineInterface.question('需求标题：', (title) => {
      readlineInterface.question('需求描述：', async (description) => {
        readlineInterface.close();
        const creator = new VOCCreator({ projectRoot });
        const voc = await creator.createVOC({ title, description });
        const { c: cc2 } = require('./chalk');
        if (voc.status === 'submitted') {
          console.log(`\n  ${cc2.green}✔${cc2.reset} VOC 已提交：${cc2.cyan}${voc.remoteUrl}${cc2.reset}`);
        } else {
          console.log(`\n  ${cc2.green}✔${cc2.reset} VOC 已保存到本地（ID: ${cc2.cyan}${voc.id}${cc2.reset}）`);
        }
      });
    });
    return;
  }

  // ── 自动提交 ──
  if (options.autoSubmit) {
    const readline = require('readline');
    const readlineInterface = readline.createInterface({ input: process.stdin, output: process.stdout });
    readlineInterface.question('标题：', (title) => {
      readlineInterface.question('描述：', async (description) => {
        readlineInterface.close();
        const decider = new SubmissionDecider({ projectRoot });
        const result = await decider.autoSubmit({ title, description });
        const { c: cc3 } = require('./chalk');
        console.log(
          `\n  ${cc3.cyan}🤖${cc3.reset} 智能判断：${result.decision.reason}` +
          ` ${cc3.dim}（置信度 ${Math.round(result.decision.confidence * 100)}%）${cc3.reset}`
        );
        console.log(`  ${cc3.green}✔${cc3.reset} ${result.message}`);
      });
    });
    return;
  }

  // ── 主诊断流程 ──
  const engine = new DiagnosticEngine({ projectRoot });
  engine.registerChecker(new VersionChecker({ projectRoot }));
  engine.registerChecker(new ProjectInitChecker({ projectRoot }));
  engine.registerChecker(new EnvironmentChecker({ projectRoot }));
  engine.registerChecker(new ApplicationChecker({ projectRoot, appId: options.app }));

  if (options.production && options.app) {
    engine.registerChecker(new ProductionErrorCollector({ projectRoot, appId: options.app }));
  }

  const { c: cc4 } = require('./chalk');
  console.log(`\n  ${cc4.cyan}🔍${cc4.reset} ${cc4.bold}检查 OpenYida 环境依赖...${cc4.reset}\n`);

  const results = await engine.runAll();
  console.log(engine.formatConsoleOutput());

  // 自动修复
  if (doFix) {
    const fixableIssues = engine.getAutoFixableIssues();
    if (fixableIssues.length > 0) {
      console.log(`\n  ${cc4.yellow}🔧${cc4.reset} ${cc4.bold}正在自动修复...${cc4.reset}\n`);
      const fixEngine = new FixEngine({ projectRoot });
      await fixEngine.autoFix(fixableIssues);
      console.log(fixEngine.formatFixOutput());
    } else {
      console.log(`\n  ${cc4.green}✔${cc4.reset} 没有可自动修复的问题`);
    }
  } else {
    const summary = engine.getSummary();
    if (summary.autoFixable > 0) {
      console.log(`\n  ${cc4.dim}运行 ${cc4.cyan}yida doctor --fix${cc4.reset}${cc4.dim} 自动修复可修复的问题${cc4.reset}`);
    }
  }

  // 生成报告
  if (options.report) {
    const reporter = new ReportGenerator({ projectRoot });
    const summary = engine.getSummary();
    const reportPath = reporter.generate(results, summary, options.report);
    console.log(`\n  ${cc4.green}📄${cc4.reset} 诊断报告已生成：${cc4.cyan}${reportPath}${cc4.reset}`);
  }
}

module.exports = {
  DiagnosticEngine,
  VersionChecker,
  ProjectInitChecker,
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
  run,
};
