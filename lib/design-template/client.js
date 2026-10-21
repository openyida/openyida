'use strict';

const { createAuthRef, createYidaClient, unwrapYidaResponse } = require('../core/yida-client');
const { t } = require('../core/i18n');

/** Template calls use the same Tianshu login client as ordinary Yida business APIs. */
class DesignTemplateClient {
  constructor({ authRef, yidaClient } = {}) {
    this.authRef = authRef || createAuthRef();
    this.yida = yidaClient || createYidaClient({ authRef: this.authRef });
  }

  /** No Agent bootstrap or service credential is exposed to the CLI. */
  async request(action, body) {
    if (!['match', 'files'].includes(action)) {
      throw new Error(t('design_template.invalid'));
    }
    const raw = await this.yida.postJson(`/query/designTemplates/${action}.json`, body);
    return unwrapYidaResponse(raw, { failMessage: t('design_template.service_error', '') });
  }
}

module.exports = { DesignTemplateClient };
