#!/usr/bin/env node

'use strict';

/**
 * Generation eval 的 OpenYida CLI 命令轨迹。
 *
 * 该模块只服务于 harness：运行前解析真实 CLI，在临时 PATH 中放置同名 shim，
 * 运行后读取已脱敏的 NDJSON。它不修改 OpenYida CLI 本身。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SENSITIVE_FLAGS = new Set([
  '--access-token',
  '--authorization',
  '--client-secret',
  '--cookie',
  '--pair-token',
  '--password',
  '--refresh-token',
  '--secret',
  '--token',
]);

function redactArgs(args = []) {
  const out = [];
  let redactions = 0;
  for (let i = 0; i < args.length; i += 1) {
    const raw = String(args[i]);
    const equals = raw.indexOf('=');
    const flag = (equals === -1 ? raw : raw.slice(0, equals)).toLowerCase();
    if (SENSITIVE_FLAGS.has(flag)) {
      if (equals !== -1) {
        out.push(`${raw.slice(0, equals)}=[REDACTED]`);
      } else {
        out.push(raw);
        if (i + 1 < args.length) {
          out.push('[REDACTED]');
          i += 1;
        }
      }
      redactions += 1;
      continue;
    }
    if (/bearer\s+\S+/i.test(raw)) {
      out.push(raw.replace(/bearer\s+\S+/gi, 'Bearer [REDACTED]'));
      redactions += 1;
      continue;
    }
    out.push(raw);
  }
  return { args: out, redactions };
}

function normalizeTraceEntry(entry = {}) {
  const args = Array.isArray(entry.args)
    ? entry.args.map((arg) => String(arg))
    : (Array.isArray(entry.argv) ? entry.argv.map((arg) => String(arg)) : []);
  const exitCode = Number.isInteger(entry.exitCode)
    ? entry.exitCode
    : (Number.isInteger(entry.status) ? entry.status : null);
  return {
    name: entry.name || entry.command || 'openyida',
    args,
    exitCode,
    ok: entry.ok !== undefined ? !!entry.ok : exitCode === 0,
    startedAt: entry.startedAt || null,
    finishedAt: entry.finishedAt || null,
    durationMs: Number.isFinite(entry.durationMs) ? entry.durationMs : null,
    redactions: Number.isFinite(entry.redactions) ? entry.redactions : 0,
    source: entry.source || 'harness-cli-trace',
  };
}

function parseCommandTrace(text = '') {
  if (!text || typeof text !== 'string') {return [];}
  const trimmed = text.trim();
  if (!trimmed) {return [];}

  try {
    const parsed = JSON.parse(trimmed);
    const entries = Array.isArray(parsed) ? parsed : (parsed.commands || [parsed]);
    return entries.filter(Boolean).map(normalizeTraceEntry);
  } catch {
    return trimmed.split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {return normalizeTraceEntry(JSON.parse(line));} catch {return null;}
      })
      .filter(Boolean);
  }
}

function readCommandTrace(tracePath) {
  try {
    if (!tracePath || !fs.existsSync(tracePath)) {return [];}
    return parseCommandTrace(fs.readFileSync(tracePath, 'utf8'));
  } catch {
    return [];
  }
}

function resolveCliExecutable(name, options = {}) {
  const spawn = options.spawn || spawnSync;
  try {
    const result = spawn('which', [name], {
      encoding: 'utf8',
      env: options.env || process.env,
      timeout: 10000,
    });
    if (result && result.status === 0 && result.stdout) {
      return String(result.stdout).trim().split(/\r?\n/)[0] || null;
    }
  } catch {
    // CLI trace 是增强证据；解析失败时由 expectedCommands 给出明确 miss。
  }
  return null;
}

/**
 * 创建一条隔离的 trace session。
 * 返回的 env 仅应传给 generation agent 子进程。
 */
function createCommandTraceSession(options = {}) {
  const baseEnv = options.env || process.env;
  const cliNames = options.cliNames || ['openyida', 'yida'];
  const realCommands = {};
  for (const name of cliNames) {
    const resolved = resolveCliExecutable(name, { spawn: options.spawn, env: baseEnv });
    if (resolved) {realCommands[name] = resolved;}
  }

  const fallbackCommand = realCommands.openyida || realCommands.yida;
  if (fallbackCommand) {
    for (const name of cliNames) {
      if (!realCommands[name]) {realCommands[name] = fallbackCommand;}
    }
  }

  if (!Object.keys(realCommands).length) {
    return {
      available: false,
      env: { ...baseEnv },
      tracePath: null,
      read: () => [],
      cleanup: () => {},
    };
  }

  const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-eval-trace-'));
  const tracePath = path.join(sessionDir, 'commands.ndjson');
  const wrapperSource = path.join(__dirname, 'trace-openyida.js');
  const shimDir = path.join(sessionDir, 'bin');
  fs.mkdirSync(shimDir, { recursive: true });
  for (const name of Object.keys(realCommands)) {
    const shimPath = path.join(shimDir, name);
    fs.copyFileSync(wrapperSource, shimPath);
    fs.chmodSync(shimPath, 0o755);
  }

  const env = {
    ...baseEnv,
    PATH: `${shimDir}${path.delimiter}${baseEnv.PATH || ''}`,
    OPENYIDA_EVAL_REAL_CLI_MAP: JSON.stringify(realCommands),
    OPENYIDA_EVAL_TRACE_HELPER: __filename,
    OPENYIDA_EVAL_TRACE_PATH: tracePath,
  };

  return {
    available: true,
    env,
    tracePath,
    read: () => readCommandTrace(tracePath),
    cleanup: () => {
      try {fs.rmSync(sessionDir, { recursive: true, force: true });} catch { /* best effort */ }
    },
  };
}

module.exports = {
  SENSITIVE_FLAGS,
  redactArgs,
  normalizeTraceEntry,
  parseCommandTrace,
  readCommandTrace,
  resolveCliExecutable,
  createCommandTraceSession,
};
