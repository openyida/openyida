'use strict';

const readline = require('readline');
const { t } = require('../core/i18n');
const { CliError } = require('../core/cli-error');
const {
  DINGTALK_LOGIN_ORIGIN,
  DINGTALK_INTL_LOGIN_ORIGIN,
  isYidaAppsHost,
} = require('../core/env-manager');

function originForVersion(version) {
  if (version === 'domestic') { return DINGTALK_LOGIN_ORIGIN; }
  if (version === 'intl') { return DINGTALK_INTL_LOGIN_ORIGIN; }
  throw new CliError(t('dingtalk_login.invalid_version'), { code: 'INVALID_ARGUMENTS' });
}

function explicitLoginOrigin(value) {
  try {
    const origin = new URL(value).origin;
    if ([DINGTALK_LOGIN_ORIGIN, DINGTALK_INTL_LOGIN_ORIGIN].includes(origin)) {
      return origin;
    }
  } catch {
    // A service entry URL does not select the DingTalk account system.
  }
  return null;
}

async function selectDingtalkLoginOrigin(options = {}) {
  if (options.dingtalkVersion !== undefined) {
    return originForVersion(options.dingtalkVersion);
  }
  if (options.loginOrigin) {
    const origin = explicitLoginOrigin(options.loginOrigin);
    if (!origin) {
      throw new CliError(t('dingtalk_login.invalid_origin'), { code: 'INVALID_ARGUMENTS' });
    }
    return origin;
  }
  const env = options.env || process.env;
  const explicitOrigin = explicitLoginOrigin(options.loginUrl || env.OPENYIDA_LOGIN_URL);
  if (explicitOrigin) { return explicitOrigin; }

  const input = options.input || process.stdin;
  const output = options.output || process.stderr;
  if (!isYidaAppsHost(options.baseUrl) || options.quiet || !input.isTTY || !output.isTTY) {
    return DINGTALK_LOGIN_ORIGIN;
  }

  const rl = readline.createInterface({ input, output });
  output.write(`${t('dingtalk_login.select_version')}\n1. ${t('dingtalk_login.domestic')}\n2. ${t('dingtalk_login.international')}\n`);
  try {
    return await new Promise((resolve, reject) => {
      let settled = false;
      rl.once('close', () => {
        if (!settled) {
          reject(new CliError(t('dingtalk_login.cancelled'), { code: 'LOGIN_CANCELLED' }));
        }
      });
      const ask = () => rl.question(t('dingtalk_login.choose'), answer => {
        const choice = answer.trim();
        if (choice === '' || choice === '1' || choice === '2') {
          settled = true;
          resolve(choice === '2' ? DINGTALK_INTL_LOGIN_ORIGIN : DINGTALK_LOGIN_ORIGIN);
        } else {
          output.write(`${t('dingtalk_login.invalid_choice')}\n`);
          ask();
        }
      });
      ask();
    });
  } finally {
    rl.close();
  }
}

module.exports = { selectDingtalkLoginOrigin };
