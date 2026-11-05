'use strict';

const { createYidaClient } = require('../../core/yida-client');
const { CliError } = require('../../core/cli-error');
const { t } = require('../../core/i18n');
const { execute } = require('../form-view');

const TITLE_IDS = ['processInstanceTitle', 'formInstanceTitle'];
// Same exclusions as the native data-management table (yc-utils).
const HIDDEN_COMPONENTS = ['TableField', 'EditorField', 'TimeSelectField', 'RichText', 'Link'];

async function configureCreatedFormView(authRef, appType, formUuid) {
  const client = createYidaClient({ authRef });
  const target = { appType, formUuid };
  try {
    const listed = await execute({ ...target, action: 'list', flags: {} }, client);
    const view = listed.views.find(item => item.viewType === 'table');
    if (!view) {
      throw new CliError(t('form_view.unsupported'), { code: 'CREATE_FORM_DEFAULT_VIEW_MISSING' });
    }
    const viewTarget = { ...target, viewUuid: view.viewUuid };
    const inspected = await execute({ ...viewTarget, action: 'inspect', flags: {} }, client);
    const { config, fields, configHash } = inspected;
    const configured = config.defaultConfig.showFields;
    const allowed = config.staticConfig.columnFilter;
    const showFields = Array.isArray(configured) && configured.length
      ? configured
      : fields.filter(field => field.supportVisible === true && field.showTerm === 'y'
          && !HIDDEN_COMPONENTS.includes(field.componentName)
          && (!Array.isArray(allowed) || allowed.includes('all') || allowed.includes(field.id)))
        .sort((a, b) => a.showOrder - b.showOrder).map(field => field.id);
    const titleIds = showFields.filter(id => TITLE_IDS.includes(id));
    const ordered = [...showFields.filter(id => !TITLE_IDS.includes(id)), ...titleIds];
    // A hidden title stays hidden; a one-column view still gets a concrete server default.
    if (!ordered.length) {
      throw new CliError(t('form_view.invalid_config', 'showFields'), { code: 'CREATE_FORM_DEFAULT_VIEW_EMPTY' });
    }
    const saved = await execute({ ...viewTarget, action: 'save', flags: { '--expected-hash': configHash } },
      client, { configPatch: { defaultConfig: { showFields: ordered } } });
    return { viewUuid: view.viewUuid, changed: saved.changed, readbackVerified: saved.readbackVerified,
      showFields: saved.config.defaultConfig.showFields, ...(saved.backupPath ? { backupPath: saved.backupPath } : {}) };
  } catch (error) {
    throw new CliError(error.message, { code: error.code?.startsWith('CREATE_FORM_DEFAULT_VIEW_')
      ? error.code : 'CREATE_FORM_DEFAULT_VIEW_FAILED', details: {
      ...error.details, ...target, causeCode: error.code, stage: 'configureDefaultView', formCreated: true,
    } });
  }
}

module.exports = { configureCreatedFormView };
