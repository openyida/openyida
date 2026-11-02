'use strict';

const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { redactSensitive } = require('../core/redact');
const { getQwenWorkIdentity } = require('./qwenwork-client');

async function run(args, options = {}) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(t('qwenwork.usage'));
    return;
  }
  if (args[0] !== 'user-info' || args.slice(1).some(arg => arg !== '--json')) {
    throw new CliError(t('qwenwork.usage'), { code: 'CLI_USAGE_ERROR', exitCode: 2 });
  }
  const identity = await getQwenWorkIdentity(options);
  const { profile, ...metadata } = identity;
  const result = redactSensitive({
    ok: true,
    provider: 'qwenwork',
    ...metadata,
    user: {
      user_id: profile.user_id,
      nickname: profile.nickname,
      username: profile.username,
      email: profile.email,
      is_biz: profile.is_biz,
      biz_org_id: profile.biz && profile.biz.org_id,
      biz_org_name: profile.biz && profile.biz.org_name,
    },
    yida_session_created: false,
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

module.exports = { run };
