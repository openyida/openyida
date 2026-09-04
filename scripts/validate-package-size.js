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
// Includes theme/navigation workflow updates and the inline CSS guard (6071113 bytes).
const MAX_UNPACKED_BYTES = 5936 * 1024;
// The inline CSS guard adds one runtime file to the previous 483-file package.
const MAX_ENTRY_COUNT = 484;
const MAX_SINGLE_FILE_BYTES = 512 * 1024;

const REQUIRED_PACKAGE_FILES = [
  'bin/yida.js',
  'lib/app/create-form/batch.js',
  'lib/app/inline-css-guard.js',
  'lib/design-plan/preview.js',
  'yida-skills/skills/yida-app/workflow/incremental-preview.md',
  'yida-skills/skills/yida-create-form-page/references/batch-forms.md',
  'lib/core/utils.js',
  'project/config.json',
  'scripts/postinstall.js',
  'yida-skills/SKILL.md',
  'yida-skills/skills-index.json',
  'lib/samples/openyida-scaffold/canvas-dialog.canvas.jsx',
  ...['shared', 'sidebar', 'side', 'top', 'mixed', 'dock', 'tabs', 'data'].map(name => `lib/samples/openyida-scaffold/canvas-nav/${name}.jsx`),
  'yida-skills/skills/yida-canvas-custom-page/references/dialog-guide.md',
];

const FORBIDDEN_PACKAGE_PREFIXES = [
  'agent/',
  'docs/',
  'scripts/e2e-real/',
  'scripts/eval/',
  'tests/',
];

const ALLOWED_PACKAGE_SCRIPTS = new Set([
  'scripts/postinstall.js',
]);

const STATIC_RELATIVE_REQUIRE = /require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;

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
  console.error('npm package validation failed:');
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

function validatePackageContents(files) {
  const packagePaths = new Set(files.map(file => file.path));

  for (const requiredPath of REQUIRED_PACKAGE_FILES) {
    if (!packagePaths.has(requiredPath)) {
      fail(`required runtime file is missing: ${requiredPath}`);
    }
  }

  for (const filePath of packagePaths) {
    const forbiddenPrefix = FORBIDDEN_PACKAGE_PREFIXES.find(prefix => filePath.startsWith(prefix));
    if (forbiddenPrefix) {
      fail(`local-only path was included: ${filePath}`);
    }

    if (filePath.startsWith('scripts/') && !ALLOWED_PACKAGE_SCRIPTS.has(filePath)) {
      fail(`development script was included: ${filePath}`);
    }
  }

  validatePublishedScriptRequires(packagePaths);
}

// Publishing only a narrow scripts/ allowlist is safe only when packaged runtime
// modules do not still point at excluded development scripts.
function validatePublishedScriptRequires(packagePaths) {
  for (const packagePath of packagePaths) {
    if (!/\.(?:cjs|js|mjs)$/.test(packagePath)) {
      continue;
    }

    const sourcePath = path.join(__dirname, '..', packagePath);
    const source = fs.readFileSync(sourcePath, 'utf8');
    let match;
    while ((match = STATIC_RELATIVE_REQUIRE.exec(source)) !== null) {
      const resolvedBase = path.posix.normalize(path.posix.join(path.posix.dirname(packagePath), match[1]));
      if (!resolvedBase.startsWith('scripts/')) {
        continue;
      }
      const candidates = [resolvedBase, `${resolvedBase}.js`, `${resolvedBase}.json`, `${resolvedBase}/index.js`];
      if (!candidates.some(candidate => packagePaths.has(candidate))) {
        fail(`${packagePath} requires unpublished script: ${match[1]}`);
      }
    }
    STATIC_RELATIVE_REQUIRE.lastIndex = 0;
  }
}

function run() {
  const pack = runNpmPackDryRun();
  const files = pack.files || [];
  validatePackageContents(files);
  const largestFiles = validateLargestFiles(files);

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
