'use strict';

const path = require('path');
const { CliError } = require('../core/cli-error');
const { materialize } = require('./materialize');
const { patchPlan } = require('./patch');
const { initialize, catalog } = require('./init');
const { preview } = require('./preview');

function usage() {
  return [
    '用法：',
    '  openyida design-plan catalog [--json]',
    '  openyida design-plan init <requirement-brief.json> [--theme-id <id>] [--output-dir <dir>] [--json]',
    '  openyida design-plan preview <build-plan.json> --part-file <module.json> [--json]',
    '  openyida design-plan materialize <build-plan.json> [--from-preview | --business-file <json> --visual-file <json>] [--output-dir <dir>] [--rebase-parts] [--check] [--json]',
    '  openyida design-plan patch <build-plan.json> --set <path=value> [--set <path=value> ...] [--materialize] [--output-dir <dir>] [--json]',
  ].join('\n');
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  if (!args[index + 1] || args[index + 1].startsWith('--')) {
    throw new CliError(`${name} 缺少参数值`, {
      code: 'DESIGN_PLAN_INVALID_ARGUMENT',
      usage: usage(),
    });
  }
  return args[index + 1];
}

function setValues(args) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--set') {
      if (!args[index + 1] || args[index + 1].startsWith('--')) {
        throw new CliError('--set 缺少 path=value', {
          code: 'DESIGN_PLAN_INVALID_ARGUMENT',
          usage: usage(),
        });
      }
      values.push(args[index + 1]);
      index += 1;
    } else if (args[index].startsWith('--set=')) {
      values.push(args[index].slice('--set='.length));
    }
  }
  return values;
}

const OPTION_SCHEMA = Object.freeze({
  catalog: { flags: ['--json'], values: [] },
  init: { flags: ['--json'], values: ['--theme-id', '--output-dir'] },
  preview: { flags: ['--json'], values: ['--part-file'] },
  materialize: { flags: ['--from-preview', '--rebase-parts', '--check', '--json'], values: ['--business-file', '--visual-file', '--output-dir'] },
  patch: { flags: ['--materialize', '--json'], values: ['--set', '--output-dir'], inlineValues: ['--set'] },
});

function assertKnownOptions(subcommand, args) {
  const schema = OPTION_SCHEMA[subcommand];
  const flags = new Set(schema.flags);
  const values = new Set(schema.values);
  const inlineValues = new Set(schema.inlineValues || []);
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    const equalsAt = token.indexOf('=');
    const option = equalsAt === -1 ? token : token.slice(0, equalsAt);
    if (equalsAt !== -1 && inlineValues.has(option)) {
      continue;
    }
    if (flags.has(token)) {
      continue;
    }
    if (values.has(token)) {
      if (!args[index + 1] || args[index + 1].startsWith('--')) {
        throw new CliError(`${token} 缺少参数值`, {
          code: 'DESIGN_PLAN_INVALID_ARGUMENT',
          usage: usage(),
        });
      }
      index += 1;
      continue;
    }
    throw new CliError(`未知 ${subcommand} 参数：${token}`, {
      code: 'DESIGN_PLAN_INVALID_ARGUMENT',
      usage: usage(),
    });
  }
}

async function run(args) {
  const subcommand = args[0];
  if (!subcommand || args.includes('--help') || args.includes('-h')) {
    console.log(usage());
    return;
  }
  if (!['catalog', 'init', 'preview', 'materialize', 'patch'].includes(subcommand)) {
    throw new CliError(`未知 design-plan 子命令：${subcommand}`, {
      code: 'DESIGN_PLAN_UNKNOWN_SUBCOMMAND',
      usage: usage(),
    });
  }
  if (subcommand === 'catalog') {
    assertKnownOptions(subcommand, args.slice(1));
    console.log(JSON.stringify(catalog(), null, 2));
    return;
  }
  const input = args[1];
  if (!input || input.startsWith('--')) {
    throw new CliError(`${subcommand} 缺少 ${subcommand === 'init' ? 'requirement-brief.json' : 'build-plan.json'} 路径`, {
      code: 'DESIGN_PLAN_INVALID_ARGUMENT',
      usage: usage(),
    });
  }
  const options = args.slice(2);
  assertKnownOptions(subcommand, options);
  const outputDir = optionValue(options, '--output-dir');
  let result;
  try {
    result = subcommand === 'init'
      ? initialize(input, { outputDir, themeId: optionValue(options, '--theme-id') })
      : subcommand === 'preview'
        ? preview(input, { partFile: optionValue(options, '--part-file') })
        : subcommand === 'materialize'
          ? materialize(input, { outputDir, check: options.includes('--check'), rebaseParts: options.includes('--rebase-parts'), fromPreview: options.includes('--from-preview'), businessFile: optionValue(options, '--business-file'), visualFile: optionValue(options, '--visual-file') })
          : patchPlan(input, setValues(options), { outputDir, materialize: options.includes('--materialize') });
  } catch (error) {
    const files = [input, ...['--business-file', '--visual-file', '--part-file'].map(flag => optionValue(options, flag))];
    if (subcommand !== 'init') {
      const inputDir = path.dirname(path.resolve(input));
      // Preview facts, merge baselines and preserved artifacts are also inputs.
      files.push(path.join(inputDir, '.build-plan-base.json'));
      for (const dir of [path.join(inputDir, 'preview'), path.resolve(outputDir || inputDir)]) {
        files.push(...['.state.json', '.build-plan-artifacts.json', 'prd.md', 'design.md', 'app-theme.css', 'build-plan.html'].map(name => path.join(dir, name)));
      }
    }
    throw require('../core/source-repair').withSourceRepair(error, files, args);
  }

  if (options.includes('--json') || subcommand === 'preview') {
    console.log(JSON.stringify(result, null, 2));
  } else if (subcommand === 'init') {
    console.log(`计划草稿已初始化：${result.output}`);
  } else if (subcommand === 'materialize') {
    console.log(result.checked ? `搭建计划校验通过：${result.input}` : `搭建计划产物已生成：${result.outputDir}`);
  } else {
    console.log(result.changed ? `搭建计划已更新：${result.input}` : `搭建计划无需修改：${result.input}`);
  }
}

module.exports = { run };
