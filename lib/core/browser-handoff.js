'use strict';

const { detectActiveTool } = require('./utils');

const BROWSER_TOOLS = ['codex', 'qwenwork', 'qoderwork', 'qoder'];

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

  return {
    status: 'open_url',
    handoff_type: 'browser',
    can_auto_use: true,
    agent_action: 'open_url_in_in_app_browser',
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
  parseOpenOption,
  buildBrowserHandoff,
  withBrowserHandoff,
  isBrowserHandoffEnvironment,
};
