#!/usr/bin/env node
'use strict';

/**
 * check-release-risks.js
 *
 * 发布前静态风险扫描，专注「跨平台浏览器/URL 拉起」这一类在 macOS 本地
 * 测试里查不出、却会在 Windows/Linux 用户侧炸掉的历史坑：
 *
 *   - `cmd /c start <url>`：cmd.exe 把 URL 里的 `&` 当命令分隔符，截断
 *     OAuth/bridge URL，丢失 client_id/state 或 bridge 配对参数（见 ce7efdd）。
 *   - `open -n <url>`：macOS 下不会真正开新窗口，只是在默认浏览器里开新
 *     标签页，属于「假装开新窗口」的反模式。
 *
 * HARD 反模式（error）→ 退出码 1，阻断发布。
 * SOFT 提示（warning）→ 退出码 0，仅提醒发布人做人工跨端验证。
 *
 * 该脚本无第三方依赖，纯静态扫描 lib/ 源码；核心分析函数导出供单测使用。
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['lib'];

// HARD 反模式：命中即 error，阻断发布。
const HARD_RULES = [
  {
    id: 'cmd-c-start-url',
    pattern: /cmd\s*\/c\s*start/i,
    message:
      'cmd /c start 会把 URL 中的 & 当作命令分隔符截断参数（丢失 client_id/state 或 bridge 配对参数）。请改用 rundll32 url.dll,FileProtocolHandler，并复用 resolveBrowserLauncher。',
  },
  {
    id: 'cmd-c-start-argv',
    pattern: /['"]cmd['"]\s*,\s*\[\s*['"]\/c['"]\s*,\s*['"]start['"]/i,
    message:
      'spawn("cmd", ["/c", "start", ...]) 与 cmd /c start 同源风险：& 处截断 URL。请改用 rundll32 或平台专用浏览器拉起命令。',
  },
  {
    id: 'open-n-url-new-tab',
    pattern: /\[\s*(['"])-n\1\s*,\s*url\s*\]/,
    message:
      'open -n <url> 在 macOS 上不会开新窗口，只会在默认浏览器新开标签页（假装开窗口）。要真正开新窗口须指定浏览器 App 并传其 --new-window/-new-window，检测不到默认浏览器时回退纯 open <url>。',
  },
];

// SOFT 提示：命中不阻断，只提醒发布人补人工跨端验证。
const SOFT_LAUNCH_PRIMITIVES =
  /rundll32|xdg-open|osascript|FileProtocolHandler|--new-window|-new-window|command\s*:\s*['"]open['"]|spawn(?:Sync)?\(\s*['"]open['"]/;

// 把注释内容替换成等长空白（保留换行以维持行号），避免把「解释为何避免
// cmd /c start」这类说明性注释误判成真实反模式。会跟踪字符串/模板字面量，
// 不会把字符串里的 // 或 /* 当注释。
function stripComments(content) {
  const src = String(content);
  let out = '';
  let i = 0;
  const n = src.length;
  let state = 'code'; // code | line | block | sq | dq | tpl
  while (i < n) {
    const ch = src[i];
    const next = src[i + 1];
    if (state === 'code') {
      if (ch === '/' && next === '/') {
        state = 'line';
        out += '  ';
        i += 2;
        continue;
      }
      if (ch === '/' && next === '*') {
        state = 'block';
        out += '  ';
        i += 2;
        continue;
      }
      if (ch === "'") {
        state = 'sq';
      } else if (ch === '"') {
        state = 'dq';
      } else if (ch === '`') {
        state = 'tpl';
      }
      out += ch;
      i += 1;
      continue;
    }
    if (state === 'line') {
      if (ch === '\n') {
        state = 'code';
        out += ch;
      } else {
        out += ' ';
      }
      i += 1;
      continue;
    }
    if (state === 'block') {
      if (ch === '*' && next === '/') {
        state = 'code';
        out += '  ';
        i += 2;
      } else {
        out += ch === '\n' ? '\n' : ' ';
        i += 1;
      }
      continue;
    }
    // string / template states: copy verbatim, honor escapes, exit on matching quote
    out += ch;
    if (ch === '\\') {
      out += next !== undefined ? next : '';
      i += 2;
      continue;
    }
    if (
      (state === 'sq' && ch === "'") ||
      (state === 'dq' && ch === '"') ||
      (state === 'tpl' && ch === '`')
    ) {
      state = 'code';
    }
    i += 1;
  }
  return out;
}

function analyzeContent(relPath, content) {
  const findings = [];
  const scannable = stripComments(content);
  const lines = scannable.split(/\r?\n/);

  for (const rule of HARD_RULES) {
    lines.forEach((line, index) => {
      if (rule.pattern.test(line)) {
        findings.push({
          file: relPath,
          line: index + 1,
          severity: 'error',
          ruleId: rule.id,
          message: rule.message,
        });
      }
    });
  }

  if (SOFT_LAUNCH_PRIMITIVES.test(scannable)) {
    findings.push({
      file: relPath,
      line: 0,
      severity: 'warning',
      ruleId: 'cross-platform-launch-touched',
      message:
        '涉及浏览器/URL 拉起代码。CI 只跑纯函数单测，不覆盖真实系统拉起——发布前请在 Windows / macOS / Linux 各自实测 login 与 bridge 页面唤起。',
    });
  }

  return findings;
}

function analyzeFiles(files) {
  const findings = [];
  for (const f of files) {
    findings.push(...analyzeContent(f.path, f.content));
  }
  const errorCount = findings.filter((x) => x.severity === 'error').length;
  const warnCount = findings.filter((x) => x.severity === 'warning').length;
  return { findings, errorCount, warnCount };
}

function collectSourceFiles(root = REPO_ROOT, dirs = SCAN_DIRS) {
  const out = [];
  const walk = (abs) => {
    let entries = [];
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(abs, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') {
          continue;
        }
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        out.push({
          path: path.relative(root, full),
          content: fs.readFileSync(full, 'utf8'),
        });
      }
    }
  };
  for (const dir of dirs) {
    walk(path.join(root, dir));
  }
  return out;
}

function formatFindings({ findings, errorCount, warnCount }) {
  const lines = [];
  const errors = findings.filter((x) => x.severity === 'error');
  const warnings = findings.filter((x) => x.severity === 'warning');

  if (errors.length) {
    lines.push('发布风险检查：发现 HARD 反模式（阻断发布）');
    for (const f of errors) {
      lines.push(`  ✗ [${f.ruleId}] ${f.file}:${f.line}`);
      lines.push(`      ${f.message}`);
    }
  }

  if (warnings.length) {
    lines.push('发布风险检查：跨端人工验证提醒（不阻断）');
    const byFile = new Set(warnings.map((w) => w.file));
    for (const file of byFile) {
      lines.push(`  ⚠ ${file}`);
    }
    lines.push(
      '      涉及浏览器/URL 拉起：请在 Windows / macOS / Linux 各自实测 openyida login 与 bridge 页面唤起。'
    );
  }

  lines.push('');
  lines.push(`发布风险检查完成：error=${errorCount}, warning=${warnCount}`);
  return lines.join('\n');
}

function main() {
  const result = analyzeFiles(collectSourceFiles());
  process.stdout.write(`${formatFindings(result)}\n`);
  if (result.errorCount > 0) {
    process.stdout.write(
      '\n存在阻断发布的 HARD 反模式，请修复后重试（详见 .qoder/skills 跨端发布风险技能）。\n'
    );
    process.exit(1);
  }
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = {
  HARD_RULES,
  SOFT_LAUNCH_PRIMITIVES,
  analyzeContent,
  analyzeFiles,
  collectSourceFiles,
  formatFindings,
};
