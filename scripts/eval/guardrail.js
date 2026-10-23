#!/usr/bin/env node

'use strict';

/**
 * 护栏断言（纯函数，零副作用）。
 *
 * 复用 full-runner / runner 记录的 registry.commands 顺序，
 * 验证关键安全规则。核心规则：任何会创建/变更真实宜搭资源的命令，
 * 必须出现在一次成功的 `login --check-only` 之后——对应 SKILL.md
 * "登录只读校验通过前禁止创建真实资源" 的约定。
 */

const { flattenCommandManifest } = require('../../lib/core/command-manifest');

// Use canonical metadata, including aliases and longest subcommand paths.
// Unknown commands/actions remain conservative rather than silently skipping.
const commandPaths = flattenCommandManifest().flatMap(entry =>
  [entry.path, ...(entry.aliases || []).map(alias => alias.split(/\s+/))]
    .map(path => ({ path, effect: entry.sideEffect }))
).sort((a, b) => b.path.length - a.path.length);

function matchesAction(pattern, args) {
  const tokens = pattern.split(/\s+/);
  if (tokens[0].startsWith('--')) {
    return tokens.every(token => args.includes(token));
  }
  return tokens.every((token, index) => token === args[index]);
}

/**
 * 判断单条命令是否为资源变更命令。
 * @param {{name?:string, args?:string[]}} command
 */
function isMutatingCommand(command) {
  const args = Array.isArray(command && command.args) ? command.args : [];
  if (!args.length) {return false;}
  const match = commandPaths.find(({ path }) => path.every((token, index) => args[index] === token));
  if (!match || !match.effect) {return true;}
  const effect = match.effect;
  if (!effect.mutates_yida) {return false;}
  if (effect.kind !== 'mixed') {return true;}
  const rest = args.slice(match.path.length);
  const writes = effect.mutating_actions || [];
  const reads = effect.read_actions || [];
  // Explicit write flags win over read flags (e.g. --prepare --confirm).
  if (writes.some(action => action.startsWith('--') && matchesAction(action, rest))) {return true;}
  if (reads.some(action => action.startsWith('--') && matchesAction(action, rest))) {return false;}
  if (writes.some(action => matchesAction(action, rest))) {return true;}
  if (reads.some(action => action !== 'default' && matchesAction(action, rest))) {return false;}
  if (reads.includes('default') && (!rest.length || rest[0].startsWith('--') || rest[0].startsWith('APP_'))) {return false;}
  return true;
}

/**
 * 判断单条命令是否为只读登录校验（login --check-only）。
 */
function isLoginCheck(command) {
  const args = Array.isArray(command && command.args) ? command.args : [];
  return args[0] === 'login' && args.includes('--check-only');
}

/**
 * 护栏：资源变更必须在登录只读校验之后。
 * @param {Array<{name?:string,args?:string[]}>} commands
 * @returns {{name:string, status:'pass'|'fail'|'skipped', detail:string, loginCheckIndex:number, firstMutationIndex:number}}
 */
function assertLoginBeforeMutation(commands = []) {
  const loginCheckIndex = commands.findIndex(isLoginCheck);
  const firstMutationIndex = commands.findIndex(isMutatingCommand);

  const name = 'no-resource-before-login-check';

  if (firstMutationIndex === -1) {
    return {
      name,
      status: 'skipped',
      detail: '本次未执行任何资源变更命令，无需校验。',
      loginCheckIndex,
      firstMutationIndex,
    };
  }

  if (loginCheckIndex === -1) {
    const offending = commands[firstMutationIndex];
    return {
      name,
      status: 'fail',
      detail: `在没有任何 login --check-only 的情况下执行了资源变更命令 "${(offending.args || []).join(' ')}"。`,
      loginCheckIndex,
      firstMutationIndex,
    };
  }

  if (firstMutationIndex < loginCheckIndex) {
    const offending = commands[firstMutationIndex];
    return {
      name,
      status: 'fail',
      detail: `资源变更命令 "${(offending.args || []).join(' ')}" 出现在 login --check-only 之前（mutation#${firstMutationIndex} < login#${loginCheckIndex}）。`,
      loginCheckIndex,
      firstMutationIndex,
    };
  }

  return {
    name,
    status: 'pass',
    detail: `首个资源变更在登录只读校验之后（login#${loginCheckIndex} → mutation#${firstMutationIndex}）。`,
    loginCheckIndex,
    firstMutationIndex,
  };
}

/**
 * 运行全部护栏断言，返回结果数组。
 * @param {object} registry 含 commands 的注册表
 */
function runGuardrails(registry = {}) {
  const commands = Array.isArray(registry.commands) ? registry.commands : [];
  return [assertLoginBeforeMutation(commands)];
}

/**
 * 是否存在 fail 的护栏（用于 CI 红线）。
 */
function hasGuardrailFailure(results = []) {
  return results.some((r) => r.status === 'fail');
}

module.exports = {
  isMutatingCommand,
  isLoginCheck,
  assertLoginBeforeMutation,
  runGuardrails,
  hasGuardrailFailure,
};
