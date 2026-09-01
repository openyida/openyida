'use strict';

const { CliError } = require('../core/cli-error');
const { materialize } = require('./materialize');
const { patchPlan } = require('./patch');

function usage() {
  return [
    '用法：',
    '  openyida design-plan materialize <build-plan.json> [--output-dir <dir>] [--check] [--json]',
    '  openyida design-plan patch <build-plan.json> --set <path=value> [--set <path=value> ...] [--materialize] [--json]',
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
  if (subcommand === 'materialize') {
    const input = args[1];
    if (!input || input.startsWith('--')) {
      throw new CliError('materialize 缺少 build-plan.json 路径', {
        code: 'DESIGN_PLAN_INVALID_ARGUMENT',
        usage: usage(),
      });
    }
    const result = materialize(input, {
      outputDir: optionValue(args.slice(2), '--output-dir'),
      check: args.includes('--check'),
    });
    if (args.includes('--json')) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.checked) {
      console.log(`搭建计划校验通过：${result.input}`);
    } else {
      console.log(`搭建计划产物已生成：${result.outputDir}`);
    }
    return;
  }
  if (subcommand === 'patch') {
    const input = args[1];
    if (!input || input.startsWith('--')) {
      throw new CliError('patch 缺少 build-plan.json 路径', {
        code: 'DESIGN_PLAN_INVALID_ARGUMENT',
        usage: usage(),
      });
    }
    const patchArgs = args.slice(2);
    const result = patchPlan(input, setValues(patchArgs), {
      materialize: patchArgs.includes('--materialize'),
      outputDir: optionValue(patchArgs, '--output-dir'),
    });
    if (patchArgs.includes('--json')) {
      console.log(JSON.stringify(result, null, 2));
    } else if (!result.changed) {
      console.log(`搭建计划无需修改：${result.input}`);
    } else {
      console.log(`搭建计划已更新至 ${result.revision}：${result.input}`);
    }
    return;
  }
  throw new CliError(`未知 design-plan 子命令：${subcommand}`, {
    code: 'DESIGN_PLAN_UNKNOWN_SUBCOMMAND',
    usage: usage(),
  });
}

module.exports = { run };
