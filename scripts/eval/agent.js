#!/usr/bin/env node

'use strict';

/**
 * 唯一的 headless agent 封装。路由测评、真实生成与截图打分共用此模块，
 * 都通过本地无头 agent（`claude -p` / `qodercli -p` 等）运行时完成，无需独立 vision API key。
 *
 * agent 命令可通过环境变量 OPENYIDA_EVAL_AGENT_CMD 切换（默认 claude；阿里内网可设为 qodercli）。
 * 不同 agent 的 JSON 信封格式一致（{type:'result', result, is_error}），故解析逻辑通用；
 * 仅权限模式/工具白名单的 flag 写法不同，由 AGENT_ADAPTERS 抹平。
 *
 * agent CLI 缺失时返回 { available:false }，调用方据此优雅降级。
 */

const { spawnSync } = require('child_process');

/**
 * 各 agent CLI 的差异适配表（键为命令 basename）。
 * 信封解析对所有 agent 通用，这里只描述「开放工具执行权限」时的 flag 差异。
 */
const AGENT_ADAPTERS = {
  claude: {
    permissionBypass: ['--permission-mode', 'bypassPermissions'],
    allowedTools: (tools) => ((tools && tools.length) ? ['--allowedTools', ...tools] : []),
  },
  qodercli: {
    permissionBypass: ['--permission-mode', 'bypass_permissions'],
    allowedTools: (tools) => (tools || []).flatMap((t) => ['--allowed-tools', t]),
  },
};

/**
 * 取命令的 basename（去掉路径与 .exe/.cmd/.sh 后缀），用于匹配 adapter。
 */
function agentBasename(command) {
  return String(command || '').split(/[\\/]/).pop().replace(/\.(exe|cmd|sh)$/i, '');
}

/**
 * 解析当前应使用的 agent 命令：环境变量 OPENYIDA_EVAL_AGENT_CMD 优先，默认 claude。
 */
function resolveAgentCommand(env = process.env) {
  const c = env && env.OPENYIDA_EVAL_AGENT_CMD;
  return (typeof c === 'string' && c.trim()) ? c.trim() : 'claude';
}

/**
 * 取指定命令对应的 adapter；未知命令回退到 claude 风格。
 */
function getAgentAdapter(command) {
  return AGENT_ADAPTERS[agentBasename(command)] || AGENT_ADAPTERS.claude;
}

/**
 * 检测本地是否可用 agent CLI。
 * 结果按命令缓存于进程内：同一次评测会对每条用例调用 runAgent，
 * 若每次都 spawn 一个 `--version` 探测子进程，开销可占总耗时相当比例。
 * 缓存后每个 agent 命令在整个进程只探测一次。
 */
const _availabilityCache = new Map();
function isAgentAvailable(command = resolveAgentCommand(), useCache = true) {
  if (useCache && _availabilityCache.has(command)) {
    return _availabilityCache.get(command);
  }
  let ok = false;
  try {
    const probe = spawnSync(command, ['--version'], { encoding: 'utf8', timeout: 15000 });
    ok = probe.status === 0;
  } catch {
    ok = false;
  }
  _availabilityCache.set(command, ok);
  return ok;
}

/**
 * 从一段文本里抽取第一个完整 JSON 对象（容忍前后的解释性文字 / ```json 围栏）。
 * @param {string} text
 * @returns {object|null}
 */
function extractJsonObject(text) {
  if (!text || typeof text !== 'string') {return null;}
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [];
  if (fenced) {candidates.push(fenced[1]);}
  candidates.push(text);

  for (const candidate of candidates) {
    const start = candidate.indexOf('{');
    if (start === -1) {continue;}
    // 从第一个 { 起做花括号配平扫描
    let depth = 0;
    for (let i = start; i < candidate.length; i += 1) {
      const ch = candidate[i];
      if (ch === '{') {depth += 1;}
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          const slice = candidate.slice(start, i + 1);
          try {
            return JSON.parse(slice);
          } catch {
            break; // 该候选无效，换下一个
          }
        }
      }
    }
  }
  return null;
}

/**
 * 跑一次 headless agent。
 * @param {object} options
 * @param {string} options.prompt 完整 prompt（图片以"读取截图：<绝对路径>"形式内联，agent 自行 Read）
 * @param {string} [options.command='claude']
 * @param {string} [options.cwd]
 * @param {number} [options.timeoutMs=180000]
 * @param {string[]} [options.extraArgs] 追加到 `claude -p <prompt> --output-format json` 之后的额外 flag
 *   （如真实生成测评需要 `--permission-mode bypassPermissions --allowedTools Bash Read --add-dir <repo>`）
 * @param {function} [options.spawn] 注入用，便于测试
 * @returns {{available:boolean, ok:boolean, text:string|null, json:object|null, raw:string|null, error:string|null}}
 */
function runAgent(options = {}) {
  const command = options.command || resolveAgentCommand();
  const timeout = options.timeoutMs || 180000;
  const spawn = options.spawn || spawnSync;

  if (!options.prompt) {
    return { available: true, ok: false, text: null, json: null, raw: null, error: 'empty prompt' };
  }

  if (options.spawn === undefined && !isAgentAvailable(command)) {
    return { available: false, ok: false, text: null, json: null, raw: null, error: 'claude CLI not found' };
  }

  const extraArgs = Array.isArray(options.extraArgs) ? options.extraArgs : [];
  let result;
  try {
    result = spawn(
      command,
      ['-p', options.prompt, '--output-format', 'json', ...extraArgs],
      { encoding: 'utf8', timeout, cwd: options.cwd, maxBuffer: 32 * 1024 * 1024 },
    );
  } catch (error) {
    return { available: true, ok: false, text: null, json: null, raw: null, error: error.message };
  }

  if (result.error) {
    const missing = result.error.code === 'ENOENT';
    return {
      available: !missing,
      ok: false,
      text: null,
      json: null,
      raw: null,
      error: result.error.message,
    };
  }

  const stdout = result.stdout || '';
  // claude -p --output-format json 返回信封 { type:'result', result:'<assistant text>', is_error, ... }
  let text = stdout;
  const envelope = extractJsonObject(stdout);
  if (envelope && typeof envelope.result === 'string') {
    text = envelope.result;
  }

  // CLI 退出码可能为 0 但信封标记 is_error（最常见:未登录 / 配额 / API 错误）。
  // 这类情况下 result 是错误文案而非模型回答,必须当作 agent 调用失败,而不是“输出无法解析”。
  if (envelope && envelope.is_error) {
    return {
      available: true,
      ok: false,
      text,
      json: null,
      raw: stdout,
      error: `agent-error: ${text || 'unknown'}`,
    };
  }

  const json = extractJsonObject(text);

  return {
    available: true,
    ok: result.status === 0,
    text,
    json,
    raw: stdout,
    error: result.status === 0 ? null : (result.stderr || `exit ${result.status}`),
  };
}

module.exports = {
  AGENT_ADAPTERS,
  agentBasename,
  resolveAgentCommand,
  getAgentAdapter,
  isAgentAvailable,
  extractJsonObject,
  runAgent,
};
