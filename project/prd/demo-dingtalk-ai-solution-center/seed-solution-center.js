#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_SEED = path.join(__dirname, 'seed-records.logical.json');
const DEFAULT_TEMPLATE = path.join(__dirname, 'field-map.template.json');
const DEFAULT_CREATED_FORMS = path.join(__dirname, 'created-forms.local.json');
const DEFAULT_FORM_CONFIG = path.join(__dirname, 'form-config.local.js');
const DEFAULT_OUTPUT = path.join(__dirname, 'seed-result.local.json');

const COLLECTION_TO_FORM = {
  customers: 'customer',
  visits: 'visit',
  solutionPackages: 'solutionPackage',
  demoInstances: 'demoInstance',
  meetingNotes: 'meetingNote',
  weeklyReports: 'weeklyReport',
  riskCustomers: 'riskCustomer',
};

function usage() {
  console.log([
    'Usage:',
    '  node project/prd/demo-dingtalk-ai-solution-center/seed-solution-center.js --app-type APP_XXX [--execute]',
    '',
    'Options:',
    '  --app-type <id>          Yida appType. If omitted, tries created-forms.local.json.',
    '  --created-forms <file>   created-forms.local.json from build-solution-center.js.',
    '  --form-config <file>     form-config.local.js from generate-form-config.js.',
    '  --seed <file>            Logical seed data JSON.',
    '  --user-map <file>        JSON mapping display names to userIds, e.g. {"林晨":"123"}',
    '  --default-user-id <id>   Fallback userId for EmployeeField values.',
    '  --execute                Actually create records. Default is dry-run.',
    '  --out <file>             Output seed result. Default: seed-result.local.json.',
    '  --continue-on-error      Keep importing remaining records after a failure.',
    '  --help                   Show this message.',
  ].join('\n'));
}

function parseArgs(argv) {
  const options = {
    appType: '',
    createdForms: DEFAULT_CREATED_FORMS,
    formConfig: DEFAULT_FORM_CONFIG,
    seed: DEFAULT_SEED,
    template: DEFAULT_TEMPLATE,
    userMap: '',
    defaultUserId: '',
    execute: false,
    out: DEFAULT_OUTPUT,
    continueOnError: false,
    nodePath: process.execPath,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--app-type' && argv[i + 1]) {
      options.appType = argv[++i];
    } else if (arg === '--created-forms' && argv[i + 1]) {
      options.createdForms = path.resolve(argv[++i]);
    } else if (arg === '--form-config' && argv[i + 1]) {
      options.formConfig = path.resolve(argv[++i]);
    } else if (arg === '--seed' && argv[i + 1]) {
      options.seed = path.resolve(argv[++i]);
    } else if (arg === '--user-map' && argv[i + 1]) {
      options.userMap = path.resolve(argv[++i]);
    } else if (arg === '--default-user-id' && argv[i + 1]) {
      options.defaultUserId = argv[++i];
    } else if (arg === '--execute') {
      options.execute = true;
    } else if (arg === '--out' && argv[i + 1]) {
      options.out = path.resolve(argv[++i]);
    } else if (arg === '--continue-on-error') {
      options.continueOnError = true;
    } else {
      throw new Error('Unknown argument: ' + arg);
    }
  }

  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function stripAnsi(value) {
  return String(value || '').replace(/\x1b\[[0-9;]*m/g, '');
}

function extractLastJson(stdout) {
  const raw = stripAnsi(stdout);
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
    } catch (err) {
      // Fall back to line-by-line parsing below.
    }
  }

  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].startsWith('{')) {
      continue;
    }
    try {
      return JSON.parse(lines[i]);
    } catch (err) {
      // Keep scanning.
    }
  }
  return null;
}

function loadCreatedForms(filePath) {
  if (!fs.existsSync(filePath)) {
    return { appType: '', byKey: {} };
  }
  const raw = readJson(filePath);
  const byKey = {};
  (raw.forms || []).forEach((form) => {
    byKey[form.key] = form;
  });
  return { appType: raw.appType || '', byKey };
}

function loadFormConfig(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error('FORM_CONFIG file not found: ' + filePath);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const match = raw.match(/var\s+FORM_CONFIG\s*=\s*([\s\S]*?);\s*$/m);
  if (!match) {
    throw new Error('Cannot find "var FORM_CONFIG = ...;" in ' + filePath);
  }
  return JSON.parse(match[1]);
}

function buildLabelMap(template) {
  const result = {};
  Object.keys(template).forEach((formKey) => {
    result[formKey] = {};
    const fields = template[formKey].fields || {};
    Object.keys(fields).forEach((alias) => {
      result[formKey][fields[alias].label] = alias;
    });
  });
  return result;
}

function parseDate(value) {
  if (value === undefined || value === null || value === '') {
    return value;
  }
  if (typeof value === 'number') {
    return value;
  }
  const normalized = String(value).replace(/-/g, '/');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.getTime();
}

function isEmployeeField(fieldId, alias) {
  return String(fieldId || '').indexOf('employeeField_') === 0 ||
    ['owner', 'creator', 'collaborator'].indexOf(alias) !== -1;
}

function isDateField(fieldId, alias) {
  return String(fieldId || '').indexOf('dateField_') === 0 ||
    String(fieldId || '').indexOf('cascadeDateField_') === 0 ||
    /time|date|At|deadline/i.test(alias);
}

function normalizeEmployeeValue(value, options, userMap, warnings, context) {
  if (value === undefined || value === null || value === '') {
    return value;
  }
  if (Array.isArray(value)) {
    return value;
  }
  const name = String(value);
  if (userMap[name]) {
    return [userMap[name]];
  }
  if (options.defaultUserId) {
    return [options.defaultUserId];
  }
  warnings.push(context + ' employee value "' + name + '" has no userId mapping; skipped');
  return undefined;
}

function convertRecord(formKey, record, env, options, warnings) {
  const labelMap = env.labelMap[formKey] || {};
  const formConfig = env.formConfig[formKey] || {};
  const fields = formConfig.fields || {};
  const output = {};

  Object.keys(record).forEach((label) => {
    const alias = labelMap[label];
    if (!alias) {
      warnings.push(formKey + ' unknown label: ' + label);
      return;
    }
    const fieldId = fields[alias];
    if (!fieldId) {
      warnings.push(formKey + '.' + alias + ' has no fieldId; label=' + label);
      return;
    }

    let value = record[label];
    if (isEmployeeField(fieldId, alias)) {
      value = normalizeEmployeeValue(value, options, env.userMap, warnings, formKey + '.' + alias);
    } else if (isDateField(fieldId, alias)) {
      value = parseDate(value);
    }

    if (value !== undefined) {
      output[fieldId] = value;
    }
  });

  return output;
}

function buildSeedPayloads(seed, env, options, warnings) {
  const payloads = [];
  Object.keys(COLLECTION_TO_FORM).forEach((collectionKey) => {
    const formKey = COLLECTION_TO_FORM[collectionKey];
    const records = Array.isArray(seed[collectionKey]) ? seed[collectionKey] : [];
    const formConfig = env.formConfig[formKey] || {};
    const created = env.createdForms[formKey] || {};
    const formUuid = formConfig.formUuid || created.formUuid || '';

    records.forEach((record, recordIndex) => {
      const data = convertRecord(formKey, record, env, options, warnings);
      payloads.push({
        collectionKey,
        formKey,
        recordIndex,
        title: record['客户名称'] || record['方案名称'] || record['Demo名称'] || record['SA'] || record['风险编号'] || (collectionKey + '#' + (recordIndex + 1)),
        formUuid,
        data,
      });
    });
  });
  return payloads;
}

function commandToString(command, args) {
  return [command].concat(args).map((value) => {
    const text = String(value);
    if (/^[A-Za-z0-9_./:-]+$/.test(text)) {
      return text;
    }
    return "'" + text.replace(/'/g, "'\\''") + "'";
  }).join(' ');
}

function runImport(payloads, options, appType) {
  const imported = [];
  const failures = [];

  payloads.forEach((payload) => {
    if (!payload.formUuid) {
      const error = 'Missing formUuid for ' + payload.formKey;
      failures.push({ ...payload, error });
      console.error('[x] ' + error);
      if (!options.continueOnError) {
        throw new Error(error);
      }
      return;
    }

    const args = [
      path.join(ROOT, 'bin', 'yida.js'),
      'data',
      'create',
      'form',
      appType,
      payload.formUuid,
      '--data-json',
      JSON.stringify(payload.data),
    ];

    if (!options.execute) {
      console.log(payload.formKey + ' #' + (payload.recordIndex + 1) + ' ' + payload.title);
      console.log('  ' + commandToString(options.nodePath, args));
      imported.push({ ...payload, dryRun: true });
      return;
    }

    const result = spawnSync(options.nodePath, args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const parsed = extractLastJson(result.stdout || '');
    if (result.status !== 0 || !parsed || parsed.success === false) {
      const error = parsed && parsed.errorMsg ? parsed.errorMsg : stripAnsi(result.stderr || result.stdout).slice(-1000);
      failures.push({ ...payload, status: result.status, error });
      console.error('[x] Failed seed: ' + payload.formKey + ' ' + payload.title);
      console.error(error);
      if (!options.continueOnError) {
        throw new Error('Failed seed: ' + payload.formKey);
      }
      return;
    }
    imported.push({
      formKey: payload.formKey,
      collectionKey: payload.collectionKey,
      title: payload.title,
      formUuid: payload.formUuid,
      result: parsed,
    });
    console.log('[ok] Seeded ' + payload.formKey + ': ' + payload.title);
  });

  return { imported, failures };
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

  const created = loadCreatedForms(options.createdForms);
  const appType = options.appType || created.appType;
  if (!appType) {
    console.error('Missing --app-type APP_XXX and appType not found in created forms file.');
    usage();
    process.exit(1);
  }

  const warnings = [];
  const env = {
    template: readJson(options.template),
    labelMap: buildLabelMap(readJson(options.template)),
    formConfig: loadFormConfig(options.formConfig),
    createdForms: created.byKey,
    userMap: options.userMap ? readJson(options.userMap) : {},
  };
  const seed = readJson(options.seed);
  const payloads = buildSeedPayloads(seed, env, options, warnings);

  console.log('OpenYida solution center seeder');
  console.log('AppType: ' + appType);
  console.log('Mode: ' + (options.execute ? 'execute' : 'dry-run'));
  console.log('Records: ' + payloads.length);
  if (warnings.length) {
    console.log('Warnings:');
    warnings.forEach((warning) => console.log('  - ' + warning));
  }
  console.log('');

  let result;
  try {
    result = runImport(payloads, options, appType);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  if (options.execute) {
    fs.mkdirSync(path.dirname(options.out), { recursive: true });
    fs.writeFileSync(options.out, JSON.stringify({
      generatedAt: new Date().toISOString(),
      appType,
      imported: result.imported,
      failures: result.failures,
      warnings,
    }, null, 2) + '\n');
    console.log('');
    console.log('Seed result written: ' + options.out);
  } else {
    console.log('');
    console.log('Dry-run only. Add --execute to create records.');
  }
}

if (require.main === module) {
  main();
}
