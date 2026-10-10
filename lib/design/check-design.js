'use strict';

const fs = require('fs');
const path = require('path');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { success, warn } = require('../core/chalk');
const { validateDesignDocument } = require('./document');

function parseArgs(args = []) {
  const options = { json: false, help: false };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--json') {options.json = true;}
    else if (arg === '--help' || arg === '-h') {options.help = true;}
    else if (['--prd', '--base-dir'].includes(arg) && args[index + 1] && !args[index + 1].startsWith('-')) {
      const key = arg === '--prd' ? 'prd' : 'baseDir';
      if (options[key]) {throw new CliError(t('design_document.usage'), { code: 'CHECK_DESIGN_USAGE' });}
      options[key] = args[++index];
    } else if (!arg.startsWith('-') && !options.design) {options.design = arg;}
    else {throw new CliError(t('design_document.usage'), { code: 'CHECK_DESIGN_USAGE' });}
  }
  if (!options.help && !options.design) {throw new CliError(t('design_document.usage'), { code: 'CHECK_DESIGN_USAGE' });}
  return options;
}

function readDocument(file) {
  try {return fs.readFileSync(file, 'utf8');} catch (error) {
    throw new CliError(t('design_document.read_error', file), {
      code: 'CHECK_DESIGN_FILE_UNREADABLE', details: { file, reason: error.code },
    });
  }
}

async function run(args = []) {
  const options = parseArgs(args);
  if (options.help) {console.log(t('design_document.usage')); return;}
  const designFile = path.resolve(options.design);
  const prdFile = options.prd ? path.resolve(options.prd) : undefined;
  const baseDir = path.resolve(options.baseDir || process.cwd());
  let result;
  try {
    result = validateDesignDocument(readDocument(designFile), {
      designFile, baseDir,
      ...(prdFile ? { prdMarkdown: readDocument(prdFile) } : {}),
    });
  } catch (error) {
    throw require('../core/source-repair').withSourceRepair(error, [designFile, prdFile], args);
  }
  const output = { ...result, designFile, ...(prdFile ? { prdFile, baseDir } : {}) };
  if (options.json) {console.log(JSON.stringify(output, null, 2));}
  else {
    success(t('design_document.checked', result.name, result.pages.length, result.tokenCount));
    if (result.paletteContrast.unresolved.length) {
      warn(t('design_document.invalid', 'tokens', 'PALETTE_COLOR_UNRESOLVED') + ': ' + result.paletteContrast.unresolved.map(pair => pair.role).join(', '));
    }
  }
  return output;
}

module.exports = { run, parseArgs };
