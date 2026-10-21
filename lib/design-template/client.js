'use strict';

const { createAuthRef, createYidaClient, unwrapYidaResponse } = require('../core/yida-client');
const { t } = require('../core/i18n');

/** Login exchange is scoped to this client and never persisted or printed. */
class DesignTemplateClient {
  constructor({ authRef, yidaClient, fetchImpl } = {}) {
    this.authRef = authRef || createAuthRef();
    this.yida = yidaClient || createYidaClient({ authRef: this.authRef });
    this.fetch = fetchImpl || globalThis.fetch;
    this.bootstrap = null;
  }

  async token(force = false) {
    const context = `${this.authRef.baseUrl}|${this.authRef.corpId}|${this.authRef.userId}`;
    if (!force && this.bootstrap?.context === context && this.bootstrap.expiresAt > Date.now() + 10000) {
      return this.bootstrap.token;
    }
    const raw = await this.yida.get('/query/openyida/config.json');
    const config = unwrapYidaResponse(raw);
    if (!config.agentToken || config.apiBase !== '/openyida/agent-api' ||
        (this.authRef.corpId && config.corpId !== this.authRef.corpId) ||
        (this.authRef.userId && config.userId !== this.authRef.userId)) {
      throw new Error(t('design_template.identity_error'));
    }
    const expiresAt = Number(config.agentTokenExpiresAt) * 1000;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      throw new Error(t('design_template.identity_error'));
    }
    this.bootstrap = { context, token: config.agentToken, expiresAt };
    return config.agentToken;
  }

  /** One auth refresh only. HTTP/provider failures never become an empty match. */
  async request(action, body) {
    if (!['match', 'files'].includes(action)) {
      throw new Error(t('design_template.invalid'));
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await this.token(attempt > 0);
      const url = new URL(`/openyida/agent-api/api/v1/design-templates/${action}`, this.authRef.baseUrl);
      const response = await this.fetch(url, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(30000), redirect: 'error',
      });
      if (response.status === 401 && attempt === 0) { continue; }
      if (!response.ok) {
        const error = new Error(t('design_template.service_error', response.status));
        error.code = 'DESIGN_TEMPLATE_SERVICE_ERROR';
        throw error;
      }
      return response.json();
    }
    throw new Error(t('design_template.identity_error'));
  }
}

module.exports = { DesignTemplateClient };
