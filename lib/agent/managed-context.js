'use strict';

const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');

function managedError(code, key) {
  return new CliError(t(`agent.${key}`), { code, details: { retryable: false } });
}

// Supplied only by the Go-owned attempt launcher. The fixed-value task grant has
// a server-managed lease and is app-scoped by Tianshu; ordinary OpenYida profiles
// are never consulted and Node cannot renew the task grant.
function readManagedContext(env = process.env) {
  if (env.OPENYIDA_MANAGED_RUN !== '1') {return null;}
  const context = {
    appType: env.OPENYIDA_AGENT_APP_TYPE,
    corpId: env.OPENYIDA_AGENT_CORP_ID,
    userId: env.OPENYIDA_AGENT_USER_ID,
    runId: env.OPENYIDA_AGENT_RUN_ID,
    attemptId: env.OPENYIDA_AGENT_ATTEMPT_ID,
    formUuid: env.OPENYIDA_AGENT_FORM_UUID || null,
    baseUrl: env.OPENYIDA_AGENT_BASE_URL,
    taskGrant: env.OPENYIDA_AGENT_TASK_GRANT,
  };
  let parsed;
  try {parsed = new URL(context.baseUrl);} catch {parsed = null;}
  if (!/^APP_[a-zA-Z0-9_-]{1,200}$/.test(context.appType || '') ||
      ['corpId', 'userId', 'runId', 'attemptId'].some(key => typeof context[key] !== 'string' || !context[key] || context[key].length > 512 || /\s/.test(context[key]) || [...context[key]].some(char => char.charCodeAt(0) < 32)) ||
      !parsed || parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash ||
      typeof context.taskGrant !== 'string' || context.taskGrant.length < 16 || context.taskGrant.length > 4096 || /\s/.test(context.taskGrant)) {
    throw managedError('MANAGED_CONTEXT_INVALID', 'managed_context_invalid');
  }
  if (context.formUuid !== null && (context.formUuid.length > 256 || !/^(?:FORM|REPORT)-[a-zA-Z0-9_-]+$/.test(context.formUuid))) {
    throw managedError('MANAGED_CONTEXT_INVALID', 'managed_context_invalid');
  }
  context.baseUrl = context.baseUrl.replace(/\/+$/, '');
  return context;
}

module.exports = { readManagedContext, managedError };
