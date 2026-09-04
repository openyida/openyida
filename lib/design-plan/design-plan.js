'use strict';

const { CliError } = require('../core/cli-error');
const { materialize } = require('./materialize');
const { patchPlan } = require('./patch');

function usage() {
  return [
    '用法：',
    '  openyida design-plan materialize <build-plan.json> [--output-dir <dir>] [--check] [--json]',
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

async function run(args) {
  const subcommand = args[0];
  if (!subcommand || args.includes('--help') || args.includes('-h')) {
    console.log(usage());
    return;
  }
  if (!['materialize', 'patch'].includes(subcommand)) {
    throw new CliError(`未知 design-plan 子命令：${subcommand}`, {
      code: 'DESIGN_PLAN_UNKNOWN_SUBCOMMAND',
      usage: usage(),
    });
  }
  const input = args[1];
  if (!input || input.startsWith('--')) {
    throw new CliError(`${subcommand} 缺少 build-plan.json 路径`, {
      code: 'DESIGN_PLAN_INVALID_ARGUMENT',
      usage: usage(),
    });
  }
  const options = args.slice(2);
  const outputDir = optionValue(options, '--output-dir');
  const result = subcommand === 'materialize'
    ? materialize(input, { outputDir, check: options.includes('--check') })
    : patchPlan(input, setValues(options), { outputDir, materialize: options.includes('--materialize') });

  if (options.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else if (subcommand === 'materialize') {
    console.log(result.checked ? `搭建计划校验通过：${result.input}` : `搭建计划产物已生成：${result.outputDir}`);
  } else {
    console.log(result.changed ? `搭建计划已更新：${result.input}` : `搭建计划无需修改：${result.input}`);
  }
}

module.exports = { run };
