'use strict';

const { spawnSync } = require('child_process');
const { t } = require('../core/i18n');

const INSTALL_URL = 'https://github.com/cli/cli#installation';
const LOGIN_COMMAND = 'gh auth login --hostname github.com --web --skip-ssh-key';

/** Fixed argv only. Capture diagnostics privately, including package-manager failures. */
function invoke(binary, args, options, installing = false) {
  try {
    return (options.spawnSyncFn || spawnSync)(binary, args, {
      shell: false, encoding: 'utf8', timeout: installing ? 300000 : 15000,
      maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
      env: { ...(options.env || process.env), GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1',
        GIT_TERMINAL_PROMPT: '0', HOMEBREW_NO_AUTO_UPDATE: '1', HOMEBREW_NO_INSTALL_CLEANUP: '1',
        HOMEBREW_NO_INSTALL_UPGRADE: '1', HOMEBREW_NO_INSTALLED_DEPENDENTS_CHECK: '1', HOMEBREW_NO_SUDO: '1',
        ...(installing ? { HOMEBREW_NO_ASK: '1' } : {}) },
    });
  } catch { return { status: null }; }
}

function toolState(options) {
  const result = invoke('gh', ['--version'], options);
  if (result.error?.code === 'ENOENT') { return { state: 'missing', version: null }; }
  const version = String(result.stdout || '').match(/^gh version (\d+\.\d+\.\d+)\b/)?.[1];
  return result.status === 0 && !result.error && version
    ? { state: 'available', version } : { state: 'unverified', version: null };
}

function installPlan(options) {
  const platform = options.platform || process.platform;
  const binary = platform === 'win32' ? 'winget' : ['darwin', 'linux'].includes(platform) ? 'brew' : null;
  if (!binary) { return { available: false, reason: 'unsupported_platform', url: INSTALL_URL }; }
  const probe = invoke(binary, ['--version'], options);
  if (probe.error || probe.status !== 0) {
    return { available: false, reason: probe.error?.code === 'ENOENT' ? 'manager_missing' : 'manager_unverified', url: INSTALL_URL };
  }
  const args = binary === 'brew' ? ['install', 'homebrew/core/gh']
    : ['install', '--id', 'GitHub.cli', '--exact', '--source', 'winget', '--no-upgrade', '--disable-interactivity',
      '--accept-source-agreements', '--accept-package-agreements'];
  return { available: true, binary, args, url: INSTALL_URL, requiresConsent: true };
}

function accountState(options) {
  const result = invoke('gh', ['api', '--hostname', 'github.com', '--method', 'GET', 'user'], options);
  if (result.status === 4 && !result.error) { return { state: 'login_required', login: null }; }
  let account;
  try { account = JSON.parse(result.stdout); } catch { /* Unknown response stays unverified. */ }
  if (result.status === 0 && !result.error && account?.type === 'User'
    && /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(account.login || '')) {
    return { state: 'verified', login: account.login };
  }
  return { state: 'unverified', login: null };
}

/** Called only after the router validates consent and the managed-run boundary. */
function setup(parsed, options) {
  let tool = toolState(options);
  const installation = { attempted: false, state: 'not_requested', plan: null };
  if (tool.state === 'missing') {
    installation.plan = installPlan(options);
    if (parsed.install) {
      installation.state = 'unavailable';
      if (installation.plan.available) {
        installation.attempted = true;
        const result = invoke(installation.plan.binary, installation.plan.args, options, true);
        tool = toolState(options);
        installation.state = result.status === 0 && !result.error && tool.state === 'available'
          ? 'verified' : 'unverified';
      }
    }
  } else if (parsed.install) {
    installation.state = tool.state === 'available' ? 'already_available' : 'unavailable';
  }
  const account = tool.state === 'available' ? accountState(options) : { state: 'not_checked', login: null };
  const ready = tool.state === 'available' && account.state === 'verified';
  const nextStep = installation.state === 'unverified' ? 'inspect_installation'
    : tool.state === 'unverified' ? 'check_execution'
      : tool.state === 'missing' ? (installation.plan?.available ? 'confirm_install' : 'manual_install')
        : ready ? 'ready' : account.state === 'login_required' ? 'browser_login' : 'check_account';
  return {
    success: !parsed.install || ['verified', 'already_available'].includes(installation.state),
    action: 'setup', tool, account, ready, installation, nextStep,
    message: t(`feedback_github.setup_${nextStep}`),
    consentNotice: t('feedback_github.setup_consent'),
    privacyNotice: t('feedback_github.setup_privacy'),
    authorization: { performed: false, requiresSeparateConsent: true,
      command: tool.state === 'available' && !ready ? LOGIN_COMMAND : null,
      url: 'https://cli.github.com/manual/gh_auth_login' },
    links: { install: INSTALL_URL, signup: 'https://github.com/signup', issue: 'https://github.com/openyida/openyida/issues/new' },
    submissionPerformed: false, publicConfirmationRequired: true,
    inspectBeforeRetry: installation.state === 'unverified',
  };
}

module.exports = { setup };
