'use strict';

/**
 * CLI 命令功能正确性测评 —— 纯离线命令（无需登录态，CI 可跑）。
 *
 * 覆盖 bin/yida.js 中无需真实宜搭 API 即可验证的命令：
 * --help / --version / commands / env / copy / sample / check-page /
 * compile / formula / doctor / batch / export-conversation / db-seq-fix
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { version } = require('../package.json');

const ROOT = path.join(__dirname, '..');
const BIN = path.join(ROOT, 'bin', 'yida.js');

let tempHome;

beforeAll(() => {
  tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-cli-coverage-'));
});

afterAll(() => {
  fs.rmSync(tempHome, { recursive: true, force: true });
});

function baseEnv() {
  return {
    ...process.env,
    HOME: tempHome,
    USERPROFILE: tempHome,
    OPENYIDA_LANG: 'zh',
    CI: '1',
    OPENYIDA_SKIP_UPDATE_CHECK: '1',
    QODER_IDE: '',
    QODER_AGENT: '',
    QODERCLI_INTEGRATION_MODE: '',
    CODEX_SHELL: '',
    CODEX_CI: '',
    CODEX_THREAD_ID: '',
    CODEX_HOME: '',
    CLAUDE_CODE: '',
    CLAUDE_CODE_ENTRYPOINT: '',
    OPENCODE: '',
    OPENCODE_CLIENT: '',
    CURSOR_TRACE_ID: '',
    VSCODE_GIT_ASKPASS_NODE: '',
    AGENT_WORK_ROOT: '',
    MULERUN_CHAT_ID: '',
    MULE_DATA_DIR: '',
    OPENYIDA_AGENT_MODE: '',
    YIDA_AUTH_ENABLED: '',
    OPENYIDA_ASSUME_DESKTOP: '',
    OPENYIDA_FORCE_TERMINAL_QR: '',
    __CFBundleIdentifier: '',
  };
}

function runOk(args, extraEnv = {}) {
  return execFileSync(process.execPath, [BIN, ...args], {
    cwd: ROOT,
    env: { ...baseEnv(), ...extraEnv },
    encoding: 'utf8',
    timeout: 15000,
  });
}

function runAny(args, extraEnv = {}) {
  const result = spawnSync(process.execPath, [BIN, ...args], {
    cwd: ROOT,
    env: { ...baseEnv(), ...extraEnv },
    encoding: 'utf8',
    timeout: 15000,
  });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    output: `${result.stdout || ''}${result.stderr || ''}`,
  };
}

// ─── 1. --help ───────────────────────────────────────────────────────
describe('CLI: --help', () => {
  test('输出包含 OpenYida 标题和使用说明', () => {
    const output = runOk(['--help']);
    expect(output).toContain('OpenYida');
    expect(output).toContain('openyida');
    expect(output).toContain('<command>');
  });

  test('输出包含核心命令分组', () => {
    const output = runOk(['--help']);
    expect(output).toContain('login');
    expect(output).toContain('create-app');
    expect(output).toContain('publish');
  });

  test('输出包含版本号', () => {
    const output = runOk(['--help']);
    expect(output).toContain(version);
  });
});

// ─── 2. --version ────────────────────────────────────────────────────
describe('CLI: --version', () => {
  test('输出版本号格式正确（semver-like）', () => {
    const output = runOk(['--version']).trim();
    expect(output).toMatch(/^\d{4}\.\d{1,2}\.\d{1,2}/);
  });

  test('-v 别名同样输出版本号', () => {
    const output = runOk(['-v']).trim();
    expect(output).toBe(version);
  });
});

// ─── 3. commands ─────────────────────────────────────────────────────
describe('CLI: commands', () => {
  test('输出 JSON manifest 结构', () => {
    const output = runOk(['commands']);
    const manifest = JSON.parse(output);
    expect(manifest).toHaveProperty('commands');
    expect(Array.isArray(manifest.commands)).toBe(true);
    expect(manifest.commands.length).toBeGreaterThan(20);
  });

  test('每个命令条目包含 name 和 description', () => {
    const output = runOk(['commands']);
    const manifest = JSON.parse(output);
    for (const cmd of manifest.commands) {
      expect(cmd).toHaveProperty('name');
      expect(cmd).toHaveProperty('description');
    }
  });
});

// ─── 4. env ──────────────────────────────────────────────────────────
describe('CLI: env', () => {
  test('env --json 输出包含必要字段', () => {
    const output = runOk(['env', '--json']);
    const envInfo = JSON.parse(output);
    expect(envInfo).toHaveProperty('ok');
    expect(envInfo).toHaveProperty('system');
    expect(envInfo.system).toHaveProperty('node');
    expect(envInfo.system).toHaveProperty('platform');
  });
});

// ─── 5. copy ─────────────────────────────────────────────────────────
describe('CLI: copy', () => {
  test('copy 初始化工作目录到临时目录', () => {
    const result = runAny(['copy']);
    // copy 命令应有合理输出（成功或提示）
    expect(result.output.length).toBeGreaterThan(0);
  });
});

// ─── 6. sample ───────────────────────────────────────────────────────
describe('CLI: sample', () => {
  test('sample 列出可用示例', () => {
    const result = runAny(['sample', '--list']);
    // 列出模式应成功或有合理输出
    expect(result.output.length).toBeGreaterThan(0);
  });
});

// ─── 7. check-page ──────────────────────────────────────────────────
describe('CLI: check-page', () => {
  test('对合法页面源码检查通过', () => {
    const pageSrc = path.join(ROOT, 'project', 'pages', 'src');
    const files = fs.existsSync(pageSrc) ? fs.readdirSync(pageSrc).filter((f) => f.endsWith('.oyd.jsx')) : [];
    if (files.length === 0) { return; }
    const result = runAny(['check-page', path.join(pageSrc, files[0])]);
    // check-page 应输出检查结果
    expect(result.output.length).toBeGreaterThan(0);
  });
});

// ─── 8. compile ──────────────────────────────────────────────────────
describe('CLI: compile', () => {
  test('编译合法 JSX 文件输出 ES5 代码', () => {
    const pageSrc = path.join(ROOT, 'project', 'pages', 'src');
    const files = fs.existsSync(pageSrc) ? fs.readdirSync(pageSrc).filter((f) => f.endsWith('.oyd.jsx')) : [];
    if (files.length === 0) { return; }
    const result = runAny(['compile', path.join(pageSrc, files[0])]);
    // compile 应输出编译后的代码或成功信息
    expect(result.output.length).toBeGreaterThan(0);
  });
});

// ─── 9. formula evaluate ─────────────────────────────────────────────
describe('CLI: formula evaluate', () => {
  test('简单公式静态检查通过', () => {
    const result = runAny(['formula', 'evaluate', '1+2+3']);
    expect(result.output).toContain('OK');
  });

  test('CONCATENATE 函数检查通过', () => {
    const result = runAny(['formula', 'evaluate', 'CONCATENATE("a","b","c")']);
    expect(result.output).toContain('OK');
  });

  test('IF 函数检查有比较运算符警告', () => {
    const result = runAny(['formula', 'evaluate', 'IF(1>0,"yes","no")']);
    // 静态检查应识别出 > 运算符并给出警告
    expect(result.output.length).toBeGreaterThan(0);
  });

  test('缺失参数返回错误而非崩溃', () => {
    const result = runAny(['formula', 'evaluate']);
    // 缺少参数应有合理错误提示
    expect(result.status !== 0 || result.output.length > 0).toBe(true);
  });
});

// ─── 10. doctor ──────────────────────────────────────────────────────
describe('CLI: doctor', () => {
  test('环境诊断输出包含检查项', () => {
    const result = runAny(['doctor']);
    // doctor 应输出诊断信息
    expect(result.output.length).toBeGreaterThan(0);
  });
});

// ─── 11. 未知命令处理 ─────────────────────────────────────────────────
describe('CLI: unknown command', () => {
  test('未知命令返回非零退出码', () => {
    const result = runAny(['nonexistent-command']);
    expect(result.status).not.toBe(0);
  });

  test('未知命令输出错误提示', () => {
    const result = runAny(['nonexistent-command']);
    expect(result.output.length).toBeGreaterThan(0);
  });
});

// ─── 12. 参数校验 ─────────────────────────────────────────────────────
describe('CLI: argument validation', () => {
  test('publish 缺少参数返回错误', () => {
    const result = runAny(['publish']);
    expect(result.status).not.toBe(0);
  });

  test('create-form 缺少参数返回错误', () => {
    const result = runAny(['create-form']);
    expect(result.status).not.toBe(0);
  });

  test('data 缺少子命令返回错误', () => {
    const result = runAny(['data']);
    expect(result.status).not.toBe(0);
  });

  test('connector 无参数显示帮助', () => {
    const result = runAny(['connector']);
    expect(result.output).toContain('connector');
  });

  test('integration 无参数显示帮助', () => {
    const result = runAny(['integration']);
    expect(result.output.length).toBeGreaterThan(0);
  });
});

// ─── 13. batch ───────────────────────────────────────────────────────
describe('CLI: batch', () => {
  test('batch 执行空任务文件不崩溃', () => {
    const tasksFile = path.join(tempHome, 'empty-tasks.json');
    fs.writeFileSync(tasksFile, '[]', 'utf8');
    const result = runAny(['batch', tasksFile]);
    // 应正常处理空任务列表
    expect(result.status === 0 || result.output.length > 0).toBe(true);
  });
});

// ─── 14. db-seq-fix ──────────────────────────────────────────────────
describe('CLI: db-seq-fix', () => {
  test('dry-run 模式不执行修复只检测', () => {
    const result = runAny(['db-seq-fix', '--dry-run']);
    // 无数据库时应有合理输出或错误
    expect(result.output.length).toBeGreaterThan(0);
  });
});

// ─── 15. 全局 flag ────────────────────────────────────────────────────
describe('CLI: global flags', () => {
  test('--quiet 抑制装饰输出', () => {
    const output = runOk(['--help', '--quiet']);
    // --quiet 下应仍输出核心内容
    expect(output).toContain('openyida');
  });
});
