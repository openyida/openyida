'use strict';

const fs = require('fs');
const path = require('path');
const { applyTemplateVariables } = require('../core/sample');
const { t } = require('../core/i18n');
const { error, success, hint, result } = require('../core/chalk');
const { runLintCheck } = require('./page-linter');
const { compileSource } = require('./page-compiler');
const { buildPageFile, isAuthoringPath } = require('./page-compat');
const {
  buildTemplateVariablesFromIr,
  escapeJsStringValue,
  normalizePageSpec,
} = require('./page-ir');

const TEMPLATES = {
  'product-homepage': {
    name: 'product-homepage',
    file: path.join(__dirname, '..', 'samples', 'yida-custom-page', 'product-homepage.jsx'),
    defaultOutput: path.join('pages', 'src', 'home.jsx'),
  },
  'todo-mvc': {
    name: 'todo-mvc',
    file: path.join(__dirname, '..', 'samples', 'yida-custom-page', 'todo-mvc.oyd.jsx'),
    defaultOutput: path.join('pages', 'src', 'todo-mvc.oyd.jsx'),
  },
};

function parseArgs(args) {
  const options = {
    template: args[0] && !args[0].startsWith('--') ? args[0] : null,
    output: null,
    spec: null,
    compile: false,
    variables: {},
  };

  for (let i = options.template ? 1 : 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--output' && args[i + 1]) {
      options.output = args[++i];
      continue;
    }

    if (arg === '--spec' && args[i + 1]) {
      options.spec = args[++i];
      continue;
    }

    if (arg === '--compile') {
      options.compile = true;
      continue;
    }

    if (arg === '--var' && args[i + 1]) {
      const pair = args[++i];
      const eqIndex = pair.indexOf('=');
      if (eqIndex > 0) {
        options.variables[pair.slice(0, eqIndex)] = pair.slice(eqIndex + 1);
      }
      continue;
    }

    if (arg.startsWith('--') && args[i + 1] && !args[i + 1].startsWith('--')) {
      options.variables[arg.slice(2)] = args[++i];
    }
  }

  return options;
}

function loadSpec(specPath) {
  if (!specPath) {
    return {};
  }

  const resolvedPath = path.resolve(specPath);
  if (!fs.existsSync(resolvedPath)) {
    error(t('generate_page.spec_not_found', resolvedPath));
  }

  try {
    return JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'));
  } catch (err) {
    error(t('generate_page.spec_invalid', err.message));
  }
}

function buildTemplateVariables(templateConfig, cliVariables, spec) {
  const ir = normalizePageSpec(spec || {}, {
    template: templateConfig.name,
    variables: cliVariables || {},
  });
  return buildTemplateVariablesFromIr(ir);
}

function ensureOutputDir(outputPath) {
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

function getManifestPath(outputPath) {
  const parsed = path.parse(outputPath);
  return path.join(parsed.dir, `${parsed.name}.openyida-page.json`);
}

async function run(args) {
  const options = parseArgs(args || []);
  const spec = loadSpec(options.spec);
  const templateName = options.template || spec.template || 'product-homepage';
  const templateConfig = TEMPLATES[templateName];

  if (!templateConfig) {
    error(t('generate_page.unknown_template', templateName), {
      hint: t('generate_page.available_templates', Object.keys(TEMPLATES).join(', ')),
    });
  }

  if (!fs.existsSync(templateConfig.file)) {
    error(t('generate_page.template_not_found', templateConfig.file));
  }

  const outputPath = path.resolve(options.output || spec.output || templateConfig.defaultOutput);
  const manifestPath = getManifestPath(outputPath);
  const templateSource = fs.readFileSync(templateConfig.file, 'utf-8');
  const ir = normalizePageSpec(spec, { template: templateName, variables: options.variables });
  const variables = buildTemplateVariablesFromIr(ir);
  const outputSource = applyTemplateVariables(templateSource, variables);

  ensureOutputDir(outputPath);
  fs.writeFileSync(outputPath, outputSource, 'utf-8');
  fs.writeFileSync(manifestPath, `${JSON.stringify(ir, null, 2)}\n`, 'utf-8');

  success(t('generate_page.done', outputPath));
  hint(t('generate_page.hint'));

  let checkPath = outputPath;
  let checkSource = outputSource;

  if (isAuthoringPath(outputPath)) {
    const buildResult = buildPageFile(outputPath);
    if (!buildResult.ok) {
      buildResult.errors.forEach((issue) => error(`${issue.code}: ${issue.message}`));
    }
    checkPath = buildResult.outputPath;
    checkSource = fs.readFileSync(checkPath, 'utf-8');
  }

  const lintPassed = runLintCheck(checkSource, checkPath);
  if (!lintPassed) {
    process.exit(1);
  }

  if (options.compile || spec.compile === true) {
    compileSource(checkPath);
  } else {
    result(true, t('generate_page.success'), [
      ['Template', templateName],
      ['Blocks', ir.blocks.map((block) => block.type).join(', ')],
      ['Output', outputPath],
      ['Manifest', manifestPath],
    ]);
  }
}

module.exports = {
  run,
  parseArgs,
  buildTemplateVariables,
  escapeJsStringValue,
  getManifestPath,
};
