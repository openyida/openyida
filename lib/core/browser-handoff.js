'use strict';

const { detectActiveTool, detectRuntimeCapabilities } = require('./utils');

const BROWSER_TOOLS = ['codex', 'qwenwork', 'qoderwork', 'qoder'];

function browserVerificationPolicy(runtime = {}, env = process.env) {
  const remote = ['cloud', 'remote'].includes(String(env.OPENYIDA_MANAGED_RUNTIME || '').toLowerCase()) ||
    ['web_sandbox', 'cloud', 'remote'].includes(runtime.runtime) || runtime.tool === 'mulerun' ||
    !!(env.CI || env.CODEX_CI || env.SSH_CONNECTION || env.SSH_CLIENT || env.SSH_TTY ||
      env.VSCODE_REMOTE_NAME || env.CODESPACES || env.GITPOD_WORKSPACE_ID || /^rdp/i.test(env.SESSIONNAME || ''));
  const local = !remote && ['desktop_shell', 'local'].includes(runtime.runtime);
  return { execution_location: remote ? 'remote' : local ? 'local' : 'unknown',
    allowed: local, action: local ? 'use_existing_local_browser_tool' : 'do_not_open_browser',
    unavailable: 'record_internal_not_checked_and_continue_readback', default_user_action_required: false };
}

function parseOpenOption(args) {
  let mode = null;
  const filteredArgs = [];

  for (const arg of args || []) {
    if (arg === '--open') {
      mode = true;
      continue;
    }
    if (arg === '--no-open') {
      mode = false;
      continue;
    }
    filteredArgs.push(arg);
  }

  return { args: filteredArgs, mode };
}

function isBrowserHandoffEnvironment() {
  const activeTool = detectActiveTool();
  return !!activeTool && BROWSER_TOOLS.includes(activeTool.tool);
}

function shouldAttachBrowserHandoff(mode) {
  if (process.env.OPENYIDA_NO_BROWSER_HANDOFF) {
    return false;
  }
  if (mode === false) {
    return false;
  }
  if (mode === true) {
    return true;
  }
  return isBrowserHandoffEnvironment();
}

function buildBrowserHandoff(url, options = {}, mode = null) {
  if (!url || !shouldAttachBrowserHandoff(mode)) {
    return null;
  }

  const policy = browserVerificationPolicy(typeof detectRuntimeCapabilities === 'function' ? detectRuntimeCapabilities() : {});
  return {
    status: policy.allowed ? 'open_url' : 'present_url',
    handoff_type: 'browser',
    can_auto_use: policy.allowed,
    agent_action: policy.allowed ? 'open_url_in_in_app_browser' : 'present_url_to_user',
    browser_verification: policy,
    url,
    stage: options.stage,
    title: options.title,
  };
}

function withBrowserHandoff(payload, url, options = {}, mode = null) {
  const handoff = buildBrowserHandoff(url, options, mode);
  if (!handoff) {
    return payload;
  }
  return {
    ...payload,
    browser_handoff: handoff,
  };
}

module.exports = {
  browserVerificationPolicy,
  parseOpenOption,
  buildBrowserHandoff,
  withBrowserHandoff,
  isBrowserHandoffEnvironment,
};
