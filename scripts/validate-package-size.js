#!/usr/bin/env node

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Budgets are ratchets that track legitimate content growth (12 locale packs,
// samples, skills). Raise them intentionally when new content is justified; the
// per-file cap stays fixed to catch accidental large-blob embeds.
const MAX_TARBALL_BYTES = 1792 * 1024;
const MAX_UNPACKED_BYTES = 5632 * 1024;
const MAX_ENTRY_COUNT = 420;
const MAX_SINGLE_FILE_BYTES = 512 * 1024;

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function fail(message) {
  console.error('Package size validation failed:');
  console.error('  error ' + message);
  process.exit(1);
}

function resolveNpmBin() {
  if (process.env.OPENYIDA_NPM_BIN) {
    return process.env.OPENYIDA_NPM_BIN;
  }
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function runNpmPackDryRun() {
  const shouldCreateCache = !process.env.OPENYIDA_NPM_CACHE;
  const npmCache = shouldCreateCache
    ? fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-npm-cache-'))
    : process.env.OPENYIDA_NPM_CACHE;
  const npmBin = resolveNpmBin();
  const result = spawnSync(npmBin, ['pack', '--dry-run', '--json'], {
    encoding: 'utf8',
    env: { ...process.env, npm_config_cache: npmCache, NPM_CONFIG_CACHE: npmCache },
    stdio: 'pipe',
  });
  if (shouldCreateCache) {
    fs.rmSync(npmCache, { recursive: true, force: true });
  }

  if (result.error) {
    fail(`failed to run ${npmBin}: ${result.error.message}. Set OPENYIDA_NPM_BIN to a valid npm executable if npm is not on PATH.`);
  }

  if (result.status === null) {
    fail(`${npmBin} pack --dry-run exited without a status${result.signal ? ` (signal: ${result.signal})` : ''}`);
  }

  if (result.status !== 0) {
    const output = result.stderr || result.stdout || `${npmBin} pack --dry-run failed with status ${result.status}\n`;
    process.stderr.write(output);
    process.exit(result.status);
  }

  try {
    const parsed = JSON.parse(result.stdout);
    return parsed[0];
  } catch (_error) {
    process.stderr.write(result.stdout);
    fail('npm pack --dry-run --json did not return valid JSON');
  }
}

function validateLargestFiles(files) {
  const sorted = [...files].sort((a, b) => b.size - a.size);
  const oversized = sorted.find(file => file.size > MAX_SINGLE_FILE_BYTES);
  if (oversized) {
    fail(`${oversized.path} is ${formatBytes(oversized.size)}, above ${formatBytes(MAX_SINGLE_FILE_BYTES)}`);
  }

  return sorted.slice(0, 5).map(file => `${file.path} (${formatBytes(file.size)})`);
}

function run() {
  const pack = runNpmPackDryRun();
  const largestFiles = validateLargestFiles(pack.files || []);

  if (pack.size > MAX_TARBALL_BYTES) {
    fail(`tarball is ${formatBytes(pack.size)}, above ${formatBytes(MAX_TARBALL_BYTES)}`);
  }
  if (pack.unpackedSize > MAX_UNPACKED_BYTES) {
    fail(`unpacked package is ${formatBytes(pack.unpackedSize)}, above ${formatBytes(MAX_UNPACKED_BYTES)}`);
  }
  if (pack.entryCount > MAX_ENTRY_COUNT) {
    fail(`package has ${pack.entryCount} files, above ${MAX_ENTRY_COUNT}`);
  }

  console.log(
    `Package size OK: ${formatBytes(pack.size)} tarball, ${formatBytes(pack.unpackedSize)} unpacked, ${pack.entryCount} files`
  );
  console.log('Largest files: ' + largestFiles.join(', '));
}

run();
