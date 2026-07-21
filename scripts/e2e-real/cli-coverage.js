#!/usr/bin/env node

'use strict';

/**
 * E2E CLI 覆盖测评：验证需要登录态的 CLI 命令功能正确性。
 *
 * 与 runner.js 的区别：
 *   - runner.js 关注 agent 端到端生成
 *   - full-runner.js 关注确定性 CLI 链路
 *   - 本文件关注每个需登录态 CLI 命令本身的输入/输出正确性
 *
 * 使用方式：
 *   OPENYIDA_E2E=1 node scripts/e2e-real/cli-coverage.js
 *
 * 需要：
 *   - OPENYIDA_E2E=1 环境变量
 *   - 有效的 OAuth token session，或宿主注入的 OPENYIDA_ACCESS_TOKEN / OPENYIDA_REFRESH_TOKEN
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const BIN = path.join(ROOT, 'bin', 'yida.js');
const OUT_DIR = path.join(ROOT, 'project', '.cache', 'eval', 'cli-coverage');

function log(...args) {
  console.log(...args);
}

function runCli(args, timeoutMs = 30000) {
  const result = spawnSync(process.execPath, [BIN, ...args, '--quiet'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      OPENYIDA_LANG: 'zh',
      CI: '1',
      OPENYIDA_SKIP_UPDATE_CHECK: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: timeoutMs,
  });
  return {
    status: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

function parseJson(stdout) {
  try { return JSON.parse(stdout); } catch { return null; }
}

/**
 * 定义 CLI 覆盖测试用例。
 * 每个用例：{ name, args, validate(result) -> {pass, detail} }
 *
 * 分为两阶段：
 *   Phase 1: 只读查询（无副作用）
 *   Phase 2: 创建资源（有副作用，仅在 Phase 1 全部通过时执行）
 */
function defineTestCases() {
  return {
    phase1_readonly: [
      {
        name: 'login --check-only',
        args: ['login', '--check-only', '--json'],
        validate: (r) => {
          const j = parseJson(r.stdout);
          return { pass: !!j && j.status === 'ok', detail: j ? `status=${j.status}` : 'no JSON' };
        },
      },
      {
        name: 'app-list',
        args: ['app-list', '--size', '3', '--json'],
        validate: (r) => ({
          pass: r.status === 0 && r.stdout.length > 0,
          detail: `exit=${r.status}, output=${r.stdout.slice(0, 100)}`,
        }),
      },
      {
        name: 'basic-info',
        args: ['basic-info', '--json'],
        validate: (r) => ({
          pass: r.status === 0 && r.stdout.length > 0,
          detail: `exit=${r.status}, len=${r.stdout.length}`,
        }),
      },
      {
        name: 'corp-efficiency overview',
        args: ['corp-efficiency', 'overview', '--json'],
        validate: (r) => ({
          pass: r.status === 0,
          detail: `exit=${r.status}`,
        }),
      },
      {
        name: 'connector list',
        args: ['connector', 'list', '--json'],
        validate: (r) => ({
          pass: r.status === 0,
          detail: `exit=${r.status}`,
        }),
      },
      {
        name: 'aggregate-table list',
        args: ['aggregate-table', 'list', '--json'],
        validate: (r) => ({
          pass: r.status === 0,
          detail: `exit=${r.status}`,
        }),
      },
      {
        name: 'ai-form-setting models',
        args: ['ai-form-setting', 'models', '--json'],
        validate: (r) => ({
          pass: r.status === 0,
          detail: `exit=${r.status}`,
        }),
      },
    ],
    phase2_mutating: [
      {
        name: 'create-app',
        args: () => ['create-app', `CLI_Coverage_${Date.now()}`, '--desc', 'CLI coverage test', '--no-open'],
        validate: (r) => {
          const j = parseJson(r.stdout);
          return {
            pass: !!j && !!j.appType,
            detail: j ? `appType=${j.appType}` : 'no JSON',
            resource: j ? { type: 'app', appType: j.appType } : null,
          };
        },
      },
      {
        name: 'create-form',
        args: (ctx) => {
          if (!ctx.appType) { return null; }
          const fieldsFile = path.join(__dirname, 'fixtures', 'form-fields.json');
          return ['create-form', 'create', ctx.appType, `CLI_Form_${Date.now()}`, fieldsFile, '--no-open'];
        },
        validate: (r) => {
          const j = parseJson(r.stdout);
          return {
            pass: !!j && !!j.formUuid,
            detail: j ? `formUuid=${j.formUuid}` : 'no JSON',
            resource: j ? { type: 'form', formUuid: j.formUuid } : null,
          };
        },
      },
      {
        name: 'get-schema',
        args: (ctx) => {
          if (!ctx.appType || !ctx.formUuid) { return null; }
          return ['get-schema', ctx.appType, ctx.formUuid, '--json'];
        },
        validate: (r) => ({
          pass: r.status === 0 && r.stdout.length > 100,
          detail: `exit=${r.status}, len=${r.stdout.length}`,
        }),
      },
      {
        name: 'data query form',
        args: (ctx) => {
          if (!ctx.appType || !ctx.formUuid) { return null; }
          return ['data', 'query', 'form', ctx.appType, ctx.formUuid, '--size', '1', '--json'];
        },
        validate: (r) => ({
          pass: r.status === 0,
          detail: `exit=${r.status}`,
        }),
      },
      {
        name: 'list-forms',
        args: (ctx) => {
          if (!ctx.appType) { return null; }
          return ['list-forms', ctx.appType, '--json'];
        },
        validate: (r) => ({
          pass: r.status === 0,
          detail: `exit=${r.status}`,
        }),
      },
      {
        name: 'nav-group list',
        args: (ctx) => {
          if (!ctx.appType) { return null; }
          return ['nav-group', 'list', ctx.appType, '--json'];
        },
        validate: (r) => ({
          pass: r.status === 0,
          detail: `exit=${r.status}`,
        }),
      },
      {
        name: 'app-permission list',
        args: (ctx) => {
          if (!ctx.appType) { return null; }
          return ['app-permission', 'list', ctx.appType, '--json'];
        },
        validate: (r) => ({
          pass: r.status === 0,
          detail: `exit=${r.status}`,
        }),
      },
      {
        name: 'integration list',
        args: (ctx) => {
          if (!ctx.appType) { return null; }
          return ['integration', 'list', ctx.appType, '--json'];
        },
        validate: (r) => ({
          pass: r.status === 0,
          detail: `exit=${r.status}`,
        }),
      },
      {
        name: 'create-page',
        args: (ctx) => {
          if (!ctx.appType) { return null; }
          return ['create-page', ctx.appType, `CLI_Page_${Date.now()}`, '--no-open'];
        },
        validate: (r) => {
          const j = parseJson(r.stdout);
          return {
            pass: !!j && (!!j.pageId || !!j.formUuid),
            detail: j ? `pageId=${j.pageId || j.formUuid}` : 'no JSON',
            resource: j ? { type: 'page', pageId: j.pageId || j.formUuid } : null,
          };
        },
      },
      {
        name: 'verify-short-url',
        args: (ctx) => {
          if (!ctx.appType) { return null; }
          return ['verify-short-url', ctx.appType, '--slug', `cli-test-${Date.now()}`];
        },
        validate: (r) => ({
          pass: r.status === 0,
          detail: `exit=${r.status}`,
        }),
      },
    ],
  };
}

function run() {
  if (process.env.OPENYIDA_E2E !== '1') {
    log('Skipping CLI coverage: set OPENYIDA_E2E=1 to run.');
    return { skipped: true };
  }

  const cases = defineTestCases();
  const results = [];
  const ctx = {};
  let phase1Failed = false;

  // Phase 1: 只读查询
  log('\n=== Phase 1: 只读查询命令 ===');
  for (const tc of cases.phase1_readonly) {
    const r = runCli(tc.args);
    const v = tc.validate(r);
    const icon = v.pass ? '✔' : '✗';
    log(`  ${icon} ${tc.name}: ${v.pass ? 'PASS' : 'FAIL'} — ${v.detail}`);
    results.push({ phase: 1, name: tc.name, ...v });
    if (!v.pass) { phase1Failed = true; }
  }

  if (phase1Failed) {
    log('\nPhase 1 存在失败，跳过 Phase 2（写操作）。');
  } else {
    // Phase 2: 创建资源
    log('\n=== Phase 2: 写操作命令 ===');
    for (const tc of cases.phase2_mutating) {
      const args = typeof tc.args === 'function' ? tc.args(ctx) : tc.args;
      if (!args) {
        log(`  ⊘ ${tc.name}: SKIPPED（前置资源缺失）`);
        results.push({ phase: 2, name: tc.name, pass: null, detail: 'skipped' });
        continue;
      }
      const r = runCli(args);
      const v = tc.validate(r);
      const icon = v.pass ? '✔' : '✗';
      log(`  ${icon} ${tc.name}: ${v.pass ? 'PASS' : 'FAIL'} — ${v.detail}`);
      results.push({ phase: 2, name: tc.name, ...v });

      // 收集资源上下文供后续命令使用
      if (v.resource) {
        if (v.resource.appType) { ctx.appType = v.resource.appType; }
        if (v.resource.formUuid) { ctx.formUuid = v.resource.formUuid; }
        if (v.resource.pageId) { ctx.pageId = v.resource.pageId; }
      }
    }
  }

  // 汇总
  const total = results.length;
  const passed = results.filter((r) => r.pass === true).length;
  const failed = results.filter((r) => r.pass === false).length;
  const skipped = results.filter((r) => r.pass === null).length;

  log('\n=== CLI 覆盖测评汇总 ===');
  log(`  总计：${total}，通过：${passed}，失败：${failed}，跳过：${skipped}`);
  log(`  通过率：${total ? ((passed / (total - skipped)) * 100).toFixed(1) : 0}%`);

  // 写入报告
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const reportPath = path.join(OUT_DIR, `cli-coverage-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({
    runAt: new Date().toISOString(),
    summary: { total, passed, failed, skipped },
    results,
  }, null, 2), 'utf8');
  log(`  报告：${reportPath}`);

  return { skipped: false, summary: { total, passed, failed, skipped }, results };
}

if (require.main === module) {
  try {
    const outcome = run();
    if (!outcome.skipped && outcome.summary.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { run, defineTestCases };
