'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_CANVAS_SOURCE = path.join(ROOT, 'lib', 'samples', 'yida-canvas-custom-page', 'canvas.canvas.jsx');

function i18nText(value) {
  if (!value) {return '';}
  if (typeof value === 'string') {return value;}
  return value.zh_CN || value.en_US || value.pureEn_US || '';
}

function collectFields(node, fields = []) {
  if (!node || typeof node !== 'object') {return fields;}
  if (node.props && node.props.fieldId) {
    fields.push({
      label: i18nText(node.props.label),
      componentName: node.componentName,
      fieldId: node.props.fieldId,
    });
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      value.forEach((item) => collectFields(item, fields));
    } else if (value && typeof value === 'object') {
      collectFields(value, fields);
    }
  }
  return fields;
}

function fieldIdByLabel(fields, label) {
  const field = (fields || []).find((item) => item.label === label);
  if (!field || !field.fieldId) {
    throw new Error(`Canvas E2E field not found: ${label}`);
  }
  return field.fieldId;
}

function replaceRequired(source, expected, replacement, label) {
  if (!source.includes(expected)) {
    throw new Error(`Canvas scaffold contract changed: ${label}`);
  }
  return source.replace(expected, replacement);
}

function configureCanvasScaffold(source, context) {
  const title = fieldIdByLabel(context.fields, 'E2E Text');
  const status = fieldIdByLabel(context.fields, 'E2E Status');
  const updatedAt = fieldIdByLabel(context.fields, 'E2E Number');
  let output = String(source || '');
  output = replaceRequired(output, "const APP_TYPE = '';", `const APP_TYPE = ${JSON.stringify(context.appType)};`, 'APP_TYPE');
  output = replaceRequired(
    output,
    "const FORM_UUIDS = { primary: '' };",
    `const FORM_UUIDS = { primary: ${JSON.stringify(context.formUuid)} };`,
    'FORM_UUIDS',
  );
  output = replaceRequired(
    output,
    "const FIELDS = {\n  primary: {\n    title: '',\n    status: '',\n    owner: '',\n    updatedAt: '',\n  },\n};",
    `const FIELDS = {\n  primary: {\n    title: ${JSON.stringify(title)},\n    status: ${JSON.stringify(status)},\n    owner: ${JSON.stringify(title)},\n    updatedAt: ${JSON.stringify(updatedAt)},\n  },\n};`,
    'FIELDS',
  );
  return output;
}

function prepareDefaultCanvasSource(options) {
  const sourcePath = path.resolve(options.sourcePath);
  if (sourcePath !== path.resolve(DEFAULT_CANVAS_SOURCE)) {return options.sourcePath;}
  const source = fs.readFileSync(sourcePath, 'utf8');
  const configured = configureCanvasScaffold(source, options);
  return options.writeText(options.outputPath, configured);
}

module.exports = {
  DEFAULT_CANVAS_SOURCE,
  collectFields,
  configureCanvasScaffold,
  prepareDefaultCanvasSource,
};
