#!/usr/bin/env node

'use strict';

/**
 * 临时 PATH shim 的静态入口。由 command-trace.js 复制为 openyida / yida，
 * 转发到运行前解析出的真实 CLI，并只记录脱敏参数与退出状态。
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function appendTrace(tracePath, entry) {
  if (!tracePath) {return;}
  try {fs.appendFileSync(tracePath, `${JSON.stringify(entry)}\n`, 'utf8');} catch { /* trace 不影响真实命令 */ }
}

function main() {
  const invokedAs = path.basename(process.argv[1] || 'openyida').replace(/\.(cmd|exe)$/i, '');
  let commandMap = {};
  try {commandMap = JSON.parse(process.env.OPENYIDA_EVAL_REAL_CLI_MAP || '{}');} catch {commandMap = {};}
  const realCommand = commandMap[invokedAs] || commandMap.openyida || commandMap.yida;
  const rawArgs = process.argv.slice(2);
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();

  let safe = { args: rawArgs, redactions: 0 };
  try {
    const helper = require(process.env.OPENYIDA_EVAL_TRACE_HELPER);
    safe = helper.redactArgs(rawArgs);
  } catch {
    // helper 不可用时不把潜在敏感参数写入 trace。
    safe = { args: ['[TRACE_REDACTION_UNAVAILABLE]'], redactions: rawArgs.length };
  }

  if (!realCommand) {
    appendTrace(process.env.OPENYIDA_EVAL_TRACE_PATH, {
      name: invokedAs,
      args: safe.args,
      exitCode: 127,
      ok: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      redactions: safe.redactions,
      source: 'harness-cli-trace',
    });
    process.exitCode = 127;
    return;
  }

  const childEnv = { ...process.env };
  delete childEnv.OPENYIDA_EVAL_REAL_CLI_MAP;
  delete childEnv.OPENYIDA_EVAL_TRACE_HELPER;
  delete childEnv.OPENYIDA_EVAL_TRACE_PATH;
  const result = spawnSync(realCommand, rawArgs, { stdio: 'inherit', env: childEnv });
  const exitCode = Number.isInteger(result.status) ? result.status : 1;
  appendTrace(process.env.OPENYIDA_EVAL_TRACE_PATH, {
    name: invokedAs,
    args: safe.args,
    exitCode,
    ok: exitCode === 0,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAtMs,
    redactions: safe.redactions,
    source: 'harness-cli-trace',
  });
  process.exitCode = exitCode;
}

main();
