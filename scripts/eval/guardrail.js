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

// 通过 CLI 动词（args[0]）判定是否为"会变更真实资源"的命令。
// 比基于 step name 更可靠，因为 step name 是 runner 自定义的别名。
const MUTATING_VERB_PREFIXES = [
  'create-',
  'update-',
  'append-',
  'configure-',
  'import-',
];

const MUTATING_VERBS = new Set([
  'add-validation',
  'app-offline',
  'app-online',
  'publish',
  'save-permission',
  'save-share-config',
]);

// `data <sub>` 形式：仅 create/update/delete 子命令算变更。
const MUTATING_DATA_SUBCOMMANDS = new Set(['create', 'update', 'delete']);

const MUTATING_SUBCOMMANDS = new Map([
  ['agent-center', new Set(['create', 'update', 'cancel'])],
  ['aggregate-table', new Set(['create-empty', 'save', 'publish'])],
  ['ai-form-setting', new Set(['enable', 'disable', 'save'])],
  ['app-permission', new Set(['set', 'add', 'remove'])],
  ['connector', new Set(['create', 'add-action', 'update-action', 'delete-action', 'create-connection'])],
  ['form-detail-style', new Set(['apply', 'remove'])],
  ['i18n', new Set(['config', 'upsert', 'delete', 'translate', 'translate-all', 'upgrade'])],
  ['integration', new Set(['create', 'update', 'enable', 'disable'])],
  ['nav-group', new Set(['create', 'rename', 'delete', 'move', 'order', 'auto-order', 'hide', 'show'])],
]);

/**
 * 判断单条命令是否为资源变更命令。
 * @param {{name?:string, args?:string[]}} command
 */
function isMutatingCommand(command) {
  const args = Array.isArray(command && command.args) ? command.args : [];
  const verb = args[0];
  if (!verb) {return false;}
  if (MUTATING_VERBS.has(verb)) {return true;}
  if (MUTATING_VERB_PREFIXES.some((prefix) => verb.startsWith(prefix))) {return true;}
  if (verb === 'data' && MUTATING_DATA_SUBCOMMANDS.has(args[1])) {return true;}
  if (MUTATING_SUBCOMMANDS.has(verb) && MUTATING_SUBCOMMANDS.get(verb).has(args[1])) {return true;}
  return false;
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
  MUTATING_VERB_PREFIXES,
  MUTATING_VERBS,
  MUTATING_SUBCOMMANDS,
  isMutatingCommand,
  isLoginCheck,
  assertLoginBeforeMutation,
  runGuardrails,
  hasGuardrailFailure,
};
