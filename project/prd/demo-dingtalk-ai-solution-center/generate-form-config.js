#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const TEMPLATE_PATH = path.join(__dirname, 'field-map.template.json');
const DEFAULT_SCHEMAS_DIR = path.join(ROOT, '.cache', 'solution-center');
const DEFAULT_CREATED_FORMS = path.join(__dirname, 'created-forms.local.json');
const DEFAULT_OUT = path.join(__dirname, 'form-config.local.js');

const SCHEMA_FILE_CANDIDATES = {
  customer: ['customer-schema.json', 'customer.json'],
  visit: ['visit-schema.json', 'visit.json'],
  demoInstance: ['demo-schema.json', 'demo-instance-schema.json', 'demoInstance-schema.json'],
  riskCustomer: ['risk-schema.json', 'risk-customer-schema.json', 'riskCustomer-schema.json'],
  weeklyReport: ['weekly-schema.json', 'weekly-report-schema.json', 'weeklyReport-schema.json'],
};

function usage() {
  console.log([
    'Usage:',
    '  node project/prd/demo-dingtalk-ai-solution-center/generate-form-config.js [--schemas-dir .cache/solution-center]',
    '',
    'Options:',
    '  --schemas-dir <dir>      Directory containing openyida get-schema outputs.',
    '  --created-forms <file>   created-forms.local.json from build-solution-center.js.',
    '  --out <file>             Output JS snippet. Default: form-config.local.js.',
    '  --help                   Show this message.',
  ].join('\n'));
}

function parseArgs(argv) {
  const options = {
    schemasDir: DEFAULT_SCHEMAS_DIR,
    createdForms: DEFAULT_CREATED_FORMS,
    out: DEFAULT_OUT,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--schemas-dir' && argv[i + 1]) {
      options.schemasDir = path.resolve(argv[++i]);
    } else if (arg === '--created-forms' && argv[i + 1]) {
      options.createdForms = path.resolve(argv[++i]);
    } else if (arg === '--out' && argv[i + 1]) {
      options.out = path.resolve(argv[++i]);
    } else {
      throw new Error('Unknown argument: ' + arg);
    }
  }

  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseMixedJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const firstBrace = raw.indexOf('{');
  if (firstBrace < 0) {
    throw new Error('No JSON object found in ' + filePath);
  }
  return JSON.parse(raw.slice(firstBrace));
}

function getLabel(props) {
  const label = props && props.label;
  if (!label) {
    return '';
  }
  if (typeof label === 'string') {
    return label;
  }
  if (typeof label === 'object') {
    return label.zh_CN || label.en_US || label.value || '';
  }
  return String(label);
}

function getSchemaRoot(parsed) {
  if (parsed && parsed.content && parsed.content.pages) {
    return parsed.content;
  }
  if (parsed && parsed.content && typeof parsed.content === 'string') {
    try {
      return JSON.parse(parsed.content);
    } catch (err) {
      return parsed;
    }
  }
  return parsed;
}

function walk(node, visitor) {
  if (!node || typeof node !== 'object') {
    return;
  }
  visitor(node);
  if (Array.isArray(node.children)) {
    node.children.forEach((child) => walk(child, visitor));
  }
  if (Array.isArray(node.componentsTree)) {
    node.componentsTree.forEach((child) => walk(child, visitor));
  }
}

function extractFields(parsedSchema) {
  const schema = getSchemaRoot(parsedSchema);
  const fields = {};
  const pages = schema && Array.isArray(schema.pages) ? schema.pages : [];

  pages.forEach((page) => {
    walk(page, (node) => {
      const props = node.props || {};
      const fieldId = node.fieldId || props.fieldId;
      const label = getLabel(props);
      if (fieldId && label && !fields[label]) {
        fields[label] = {
          fieldId,
          componentName: node.componentName || '',
        };
      }
    });
  });

  return fields;
}

function findSchemaFile(schemasDir, formKey) {
  const candidates = SCHEMA_FILE_CANDIDATES[formKey] || [formKey + '-schema.json', formKey + '.json'];
  for (let i = 0; i < candidates.length; i++) {
    const filePath = path.join(schemasDir, candidates[i]);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return '';
}

function loadCreatedForms(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const raw = readJson(filePath);
  const forms = Array.isArray(raw.forms) ? raw.forms : [];
  const byKey = {};
  forms.forEach((form) => {
    byKey[form.key] = form;
  });
  return byKey;
}

function buildFormConfig(options) {
  const template = readJson(TEMPLATE_PATH);
  const createdForms = loadCreatedForms(options.createdForms);
  const config = {};
  const warnings = [];

  Object.keys(template).forEach((formKey) => {
    const templateEntry = template[formKey];
    const schemaFile = findSchemaFile(options.schemasDir, formKey);
    const created = createdForms[formKey] || {};
    const formConfig = {
      formUuid: created.formUuid || templateEntry.formUuid || '',
      fields: {},
    };

    let schemaFields = {};
    if (schemaFile) {
      schemaFields = extractFields(parseMixedJson(schemaFile));
    } else {
      warnings.push('Schema not found for ' + formKey);
    }

    Object.keys(templateEntry.fields || {}).forEach((alias) => {
      const expected = templateEntry.fields[alias];
      const label = expected.label;
      const matched = schemaFields[label];
      if (matched) {
        formConfig.fields[alias] = matched.fieldId;
      } else {
        formConfig.fields[alias] = '';
        warnings.push('Field not found: ' + formKey + '.' + alias + ' (' + label + ')');
      }
    });

    config[formKey] = formConfig;
  });

  return { config, warnings };
}

function writeOutput(outPath, config, warnings) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const content = [
    '// Generated by generate-form-config.js',
    '// Copy this FORM_CONFIG object into project/pages/src/demo-dingtalk-ai-solution-center.oyd.jsx',
    '// Warnings: ' + warnings.length,
    'var FORM_CONFIG = ' + JSON.stringify(config, null, 2) + ';',
    '',
  ].join('\n');
  fs.writeFileSync(outPath, content);
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    usage();
    process.exit(1);
  }

  if (options.help) {
    usage();
    return;
  }

  const result = buildFormConfig(options);
  writeOutput(options.out, result.config, result.warnings);
  console.log('FORM_CONFIG written: ' + options.out);
  if (result.warnings.length > 0) {
    console.log('Warnings:');
    result.warnings.forEach((warning) => console.log('  - ' + warning));
  }
}

if (require.main === module) {
  main();
}
