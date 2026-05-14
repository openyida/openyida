#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../../..');
const BLUEPRINT_PATH = path.join(__dirname, 'app-blueprint.json');
const FIELD_MAP_TEMPLATE_PATH = path.join(__dirname, 'field-map.template.json');
const DEFAULT_OUTPUT_PATH = path.join(__dirname, 'created-forms.local.json');
const DEFAULT_FIELD_MAP_PATH = path.join(__dirname, 'created-field-map.local.json');

function usage() {
  console.log([
    'Usage:',
    '  node project/prd/demo-dingtalk-ai-solution-center/build-solution-center.js --app-type APP_XXX [--execute]',
    '',
    'Options:',
    '  --app-type <id>          Required. Existing Yida appType.',
    '  --execute                Actually create forms. Default is dry-run.',
    '  --out <file>             Output created form summary. Default: created-forms.local.json',
    '  --field-map-out <file>   Output field-map skeleton. Default: created-field-map.local.json',
    '  --continue-on-error      Keep creating remaining forms after a failure.',
    '  --node <path>            Node executable. Default: current process.execPath.',
    '  --help                   Show this message.',
  ].join('\n'));
}

function parseArgs(argv) {
  const options = {
    appType: '',
    execute: false,
    out: DEFAULT_OUTPUT_PATH,
    fieldMapOut: DEFAULT_FIELD_MAP_PATH,
    continueOnError: false,
    nodePath: process.execPath,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--app-type' && argv[i + 1]) {
      options.appType = argv[++i];
    } else if (arg === '--execute') {
      options.execute = true;
    } else if (arg === '--out' && argv[i + 1]) {
      options.out = path.resolve(argv[++i]);
    } else if (arg === '--field-map-out' && argv[i + 1]) {
      options.fieldMapOut = path.resolve(argv[++i]);
    } else if (arg === '--continue-on-error') {
      options.continueOnError = true;
    } else if (arg === '--node' && argv[i + 1]) {
      options.nodePath = argv[++i];
    } else if (!arg.startsWith('--') && !options.appType) {
      options.appType = arg;
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
  const lines = stripAnsi(stdout).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].startsWith('{')) {
      continue;
    }
    try {
      return JSON.parse(lines[i]);
    } catch (err) {
      // Continue scanning; command output may contain non-JSON braces.
    }
  }
  return null;
}

function toRelative(filePath) {
  return path.relative(ROOT, filePath);
}

function quoteShell(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:-]+$/.test(text)) {
    return text;
  }
  return "'" + text.replace(/'/g, "'\\''") + "'";
}

function commandToString(command, args) {
  return [command].concat(args).map(quoteShell).join(' ');
}

function ensureOutputDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function buildCreateCommand(options, form) {
  const fieldsPath = path.join(__dirname, form.fieldsFile);
  return {
    command: options.nodePath,
    args: [
      path.join(ROOT, 'bin', 'yida.js'),
      'create-form',
      'create',
      options.appType,
      form.title,
      fieldsPath,
      '--no-open',
    ],
    fieldsPath,
  };
}

function buildFieldMapSkeleton(blueprint, createdForms) {
  const template = fs.existsSync(FIELD_MAP_TEMPLATE_PATH) ? readJson(FIELD_MAP_TEMPLATE_PATH) : {};
  const byKey = {};
  createdForms.forEach((item) => {
    byKey[item.key] = item;
  });

  const formEntries = {};
  blueprint.forms.forEach((form) => {
    const created = byKey[form.key] || {};
    const templateEntry = template[form.key] || {};
    const templateFields = templateEntry.fields || {};
    const fields = {};
    Object.keys(templateFields).forEach((alias) => {
      fields[alias] = {
        label: templateFields[alias].label || alias,
        fieldId: '',
      };
    });

    formEntries[form.key] = {
      formTitle: form.title,
      formUuid: created.formUuid || '',
      fields,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    appType: createdForms[0] ? createdForms[0].appType : '',
    note: 'Run openyida get-schema for each form and fill fields.* with real fieldId values before copying into FORM_CONFIG.',
    forms: formEntries,
  };
}

function runCreateForm(options, blueprint) {
  const createdForms = [];
  const failures = [];

  blueprint.forms.forEach((form, index) => {
    const createCommand = buildCreateCommand(options, form);
    const label = '[' + (index + 1) + '/' + blueprint.forms.length + '] ' + form.title;

    if (!fs.existsSync(createCommand.fieldsPath)) {
      const error = 'Fields file not found: ' + createCommand.fieldsPath;
      failures.push({ key: form.key, title: form.title, error });
      console.error('[x] ' + label + ' ' + error);
      if (!options.continueOnError) {
        throw new Error(error);
      }
      return;
    }

    if (!options.execute) {
      console.log(label);
      console.log('  ' + commandToString(createCommand.command, createCommand.args));
      createdForms.push({
        key: form.key,
        title: form.title,
        fieldsFile: toRelative(createCommand.fieldsPath),
        appType: options.appType,
        dryRun: true,
      });
      return;
    }

    console.log('Creating ' + label);
    const result = spawnSync(createCommand.command, createCommand.args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdout = result.stdout || '';
    const stderr = result.stderr || '';
    const parsed = extractLastJson(stdout);

    if (result.status !== 0 || !parsed || parsed.success === false) {
      const error = parsed && parsed.error ? parsed.error : stripAnsi(stderr || stdout).slice(-1000) || 'create-form failed';
      failures.push({ key: form.key, title: form.title, status: result.status, error });
      console.error('[x] Failed: ' + form.title);
      console.error(error);
      if (!options.continueOnError) {
        throw new Error('Failed to create form: ' + form.title);
      }
      return;
    }

    const created = {
      key: form.key,
      title: form.title,
      purpose: form.purpose,
      fieldsFile: toRelative(createCommand.fieldsPath),
      appType: options.appType,
      formUuid: parsed.formUuid || '',
      url: parsed.url || '',
      fieldCount: parsed.fieldCount || null,
    };
    createdForms.push(created);
    console.log('[ok] Created ' + form.title + ': ' + created.formUuid);
  });

  return { createdForms, failures };
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

  if (!options.appType) {
    console.error('Missing --app-type APP_XXX');
    usage();
    process.exit(1);
  }

  const blueprint = readJson(BLUEPRINT_PATH);
  console.log('OpenYida solution center builder');
  console.log('AppType: ' + options.appType);
  console.log('Mode: ' + (options.execute ? 'execute' : 'dry-run'));
  console.log('');

  let result;
  try {
    result = runCreateForm(options, blueprint);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    appType: options.appType,
    execute: options.execute,
    forms: result.createdForms,
    failures: result.failures,
  };

  if (options.execute) {
    ensureOutputDir(options.out);
    fs.writeFileSync(options.out, JSON.stringify(summary, null, 2) + '\n');

    const fieldMap = buildFieldMapSkeleton(blueprint, result.createdForms);
    ensureOutputDir(options.fieldMapOut);
    fs.writeFileSync(options.fieldMapOut, JSON.stringify(fieldMap, null, 2) + '\n');

    console.log('');
    console.log('Created forms summary: ' + options.out);
    console.log('Field map skeleton: ' + options.fieldMapOut);
    console.log('Next: run openyida get-schema for each form and fill field IDs into FORM_CONFIG.');
  } else {
    console.log('');
    console.log('Dry-run only. Add --execute to create forms.');
  }
}

if (require.main === module) {
  main();
}
