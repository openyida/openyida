'use strict';

const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');

/** Explicit server classification wins; historical sessions without either field default to DingTalk organizations. */
function sessionIdentity(value = {}) {
  const empty = field => field === undefined || field === null || field === '';
  const identity = empty(value.identity_type) ? undefined : value.identity_type;
  const organization = empty(value.organization_type) ? undefined : value.organization_type;
  if (identity === undefined && organization === undefined) {
    return { identity_type: 'ORGANIZATION', organization_type: 'DINGTALK' };
  }
  if ((identity === 'PERSONAL' && organization === undefined) ||
      (identity === 'ORGANIZATION' && ['DINGTALK', 'QWENWORK', 'OTHER'].includes(organization))) {
    return { identity_type: identity, ...(organization === undefined ? {} : { organization_type: organization }) };
  }
  throw new CliError(t('qwenwork.login_check_failed'), {
    code: 'AUTH_IDENTITY_TYPE_INVALID', details: { reason: 'identity_classification' },
  });
}

module.exports = { sessionIdentity };
