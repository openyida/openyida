#!/usr/bin/env node

'use strict';

const { execFileSync } = require('child_process');

const TIME_ZONE = 'Asia/Shanghai';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function dateVersion(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}.${Number(values.month)}.${Number(values.day)}`;
}

function parseDate(value) {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (!match) {
    throw new Error(`无效日期：${value}，应为 YYYY-MM-DD`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day, 4));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`无效日期：${value}`);
  }
  return parsed;
}

function nextVersion(channel, base, tags) {
  const escapedBase = escapeRegExp(base);

  if (channel === 'stable') {
    const pattern = new RegExp(`^v?${escapedBase}(?:-(\\d+))?$`);
    const suffixes = tags.flatMap((tag) => {
      const match = pattern.exec(tag);
      if (!match) {
        return [];
      }
      return [match[1] === undefined ? 0 : Number(match[1])];
    });
    if (suffixes.length === 0) {
      return base;
    }
    return `${base}-${Math.max(...suffixes) + 1}`;
  }

  if (channel === 'beta') {
    const pattern = new RegExp(`^v?${escapedBase}-beta\\.(\\d+)$`);
    const suffixes = tags.flatMap((tag) => {
      const match = pattern.exec(tag);
      return match ? [Number(match[1])] : [];
    });
    const next = suffixes.length === 0 ? 0 : Math.max(...suffixes) + 1;
    return `${base}-beta.${next}`;
  }

  throw new Error(`未知发布类型：${channel}，仅支持 stable 或 beta`);
}

function commandOutput(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function collectTags(base, remote, cwd) {
  const local = commandOutput(['tag', '--list', `v${base}*`], cwd)
    .split(/\r?\n/)
    .filter(Boolean);

  let remoteOutput;
  try {
    remoteOutput = commandOutput(
      ['ls-remote', '--tags', remote, `refs/tags/v${base}*`],
      cwd,
    );
  } catch (_error) {
    throw new Error(`无法读取远端 ${remote} 的 tag；未生成发布版本`);
  }

  const remoteTags = remoteOutput
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split('\t')[1])
    .filter(Boolean)
    .map((ref) => ref.replace(/^refs\/tags\//, '').replace(/\^\{\}$/, ''));

  return [...new Set([...local, ...remoteTags])];
}

function parseArgs(argv) {
  const channel = argv[0];
  let now = new Date();
  let remote = 'origin';

  for (let index = 1; index < argv.length; index += 1) {
    if (argv[index] === '--date' && argv[index + 1]) {
      now = parseDate(argv[index + 1]);
      index += 1;
    } else if (argv[index] === '--remote' && argv[index + 1]) {
      remote = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`未知参数：${argv[index]}`);
    }
  }

  return { channel, now, remote };
}

function main() {
  try {
    const { channel, now, remote } = parseArgs(process.argv.slice(2));
    const base = dateVersion(now);
    const tags = collectTags(base, remote, process.cwd());
    process.stdout.write(`${nextVersion(channel, base, tags)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  collectTags,
  dateVersion,
  nextVersion,
  parseArgs,
  parseDate,
};
