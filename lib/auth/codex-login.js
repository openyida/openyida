/**
 * codex-login.js - Codex 登录模式
 *
 * Codex 自带 in-app browser。CLI 进程不能直接调用 Codex 的浏览器工具，
 * 因此这里返回一个明确的浏览器登录 handoff，由 Codex agent 打开 URL 让用户扫码。
 */

'use strict';

const { detectActiveTool } = require('../core/utils');
const { resolveLoginUrl } = require('../core/env-manager');
const { t } = require('../core/i18n');

/**
 * Codex 专用登录入口：不依赖 Playwright，也不走终端二维码接口。
 * @param {object} [options]
 * @returns {Promise<object>} loginResult
 */
async function codexLogin(options = {}) {
  const { banner, info, warn, hint, label } = require('../core/chalk');
  const activeTool = detectActiveTool();

  banner(t('codex_login.title'));

  if (!activeTool || activeTool.tool !== 'codex') {
    warn(t('codex_login.not_codex'));
  }

  const loginUrl = options.loginUrl || resolveLoginUrl();

  info(t('codex_login.no_playwright'));
  info(t('codex_login.using_browser'));
  label('URL', loginUrl);
  hint(t('codex_login.browser_handoff_hint'));

  return {
    status: 'need_codex_browser_login',
    can_auto_use: false,
    login_url: loginUrl,
    browser: 'codex',
    message: t('codex_login.handoff_message'),
  };
}

module.exports = { codexLogin };
