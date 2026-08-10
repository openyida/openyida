'use strict';

const { CANVAS_YIDA_API_METHODS } = require('./runtime/canvas-yida-api-methods');

const CANVAS_SCAFFOLD_CAPABILITIES = Object.freeze([
  'runtime-ready-and-stable-errors',
  'current-parent-top-runtime-lookup',
  'theme-refresh-install-installIntoFrame-getTokens',
  'config-provider-root-theme-and-control-reset',
  'submission-and-form-detail-container',
  'all-device-drawer-and-mobile-full-screen',
  'deterministic-url-builders',
  'form-instance-id-guard',
  'iframe-theme-sync-and-close-refresh',
  'response-normalization-loading-error-empty',
  'app-form-field-theme-extension-points',
  'live-form-and-field-id-validation-before-publish',
]);

const NATIVE_FORM_DEFINITION_FIELDS = Object.freeze([
  'version',
  'formTitle',
  'layout',
  'theme',
  'labelAlign',
  'themeTokens',
  'formDetailPreset',
  'fields',
  'validations',
  'rules',
  'dataSources',
]);

function buildScaffoldContracts() {
  return {
    version: 1,
    canvas: {
      sample: 'openyida sample yida-canvas-custom-page canvas',
      source_path: 'lib/samples/yida-canvas-custom-page/canvas.canvas.jsx',
      runtime_path: 'lib/app/runtime/canvas-runtime.js',
      api_manifest_path: 'lib/app/runtime/canvas-yida-api-methods.js',
      api_methods: CANVAS_YIDA_API_METHODS.slice(),
      capabilities: CANVAS_SCAFFOLD_CAPABILITIES.slice(),
      binding_contract: {
        app_type_constant: 'APP_TYPE',
        form_map_constant: 'FORM_UUIDS',
        field_map_constant: 'FIELDS',
        field_map_shape: 'FIELDS.<formKey> matches FORM_UUIDS.<formKey>',
        validation_timing: 'before_remote_publish',
        validation_source: 'live_app_form_list_and_form_schema',
        failure_code: 'CANVAS_BINDING_VALIDATION_FAILED',
        auto_correct: false,
      },
    },
    native_form: {
      sample: 'openyida sample yida-create-form-page form',
      source_path: 'lib/samples/yida-create-form-page/form.form.json',
      definition_schema_path: 'lib/app/scaffolds/form/form-definition.schema.json',
      builder_path: 'lib/app/scaffolds/form/form-schema-builder.js',
      runtime_path: 'lib/app/services/form-runtime.js',
      definition_fields: NATIVE_FORM_DEFINITION_FIELDS.slice(),
      api_methods: CANVAS_YIDA_API_METHODS.slice(),
      capabilities: [
        'native-components-tree-map-actions-lifecycles',
        'divider-columns-page-section-layout',
        'validation-formula-rule-and-remote-data-source',
        'theme-and-conditional-form-detail-style',
        'single-builder-for-create-and-offline-compile',
        'remote-revision-runtime-theme-and-detail-readback',
      ],
    },
  };
}

module.exports = {
  CANVAS_SCAFFOLD_CAPABILITIES,
  NATIVE_FORM_DEFINITION_FIELDS,
  buildScaffoldContracts,
};
