#!/usr/bin/env node

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Budgets are ratchets that track legitimate content growth (12 locale packs,
// samples, skills). Raise them intentionally when new content is justified; the
// per-file cap stays fixed to catch accidental large-blob embeds.
// Application styles add 18 paired presets plus the independent creative scaffold
// (57 design/CSS/layout assets), their catalog, recipe and runtime consumer. Complete
// content/navigation tone and detail-field tokens are retained in every standalone preset.
// Anonymous form submission guidance adds about 14 KiB of required runtime skill content.
// Retain npm-version overhead and round budgets to 16 KiB boundaries.
const MAX_TARBALL_BYTES = 1920 * 1024;
const MAX_UNPACKED_BYTES = 7072 * 1024;
const MAX_ENTRY_COUNT = 569;
const MAX_SINGLE_FILE_BYTES = 512 * 1024;

const REQUIRED_PACKAGE_FILES = [
  'bin/yida.js',
  'lib/app/create-form/batch.js',
  'lib/app/application-entry-urls.js',
  'lib/app/inline-css-guard.js',
  'lib/app/canvas-icon-guard.js',
  'lib/app/canvas-navigation-guard.js',
  'lib/app/canvas-path-guard.js',
  'lib/samples/openyida-scaffold/canvas-navigation.jsx',
  'lib/samples/openyida-scaffold/canvas-admin-entry.jsx',
  'lib/samples/openyida-scaffold/canvas-view-state.jsx',
  'yida-skills/skills/yida-canvas-custom-page/references/view-state-recovery.md',
  'yida-skills/skills/yida-canvas-data-binding/references/business-action-permissions.md',
  'lib/asset/asset-execution.js',
  'lib/app/canvas-icon-exports.json',
  'lib/design-plan/preview.js',
  'lib/design-plan/entry-navigation.js',
  'lib/design-plan/navigation-policy.js',
  'yida-skills/skills/yida-app/references/entry-navigation.md',
  'yida-skills/skills/yida-app/workflow/incremental-preview.md',
  'yida-skills/skills/yida-create-form-page/references/batch-forms.md',
  'lib/core/utils.js',
  'lib/asset/asset-plan.js',
  'lib/asset/attachment-upload.js',
  'lib/process/services/process-actions.js',
  'project/config.json',
  'scripts/postinstall.js',
  'yida-skills/SKILL.md',
  'yida-skills/skills-index.json',
  'yida-skills/skills/yida-requirement-analysis/references/experience-groups.md',
  'yida-skills/skills/yida-requirement-analysis/references/handoff.md',
  'yida-skills/skills/yida-design/references/navigation-decision.md',
  'yida-skills/skills/yida-design/templates/design-themes/index.json',
  'yida-skills/skills/yida-design/templates/design-themes/basic-tokens.json',
  'lib/app/application-style.js',
  'yida-skills/skills/yida-design/references/application-style-library.md',
  'yida-skills/skills/yida-design/references/theme/application-style-recipes.css',
  ...require('../yida-skills/skills/yida-design/templates/design-themes/index.json').themes
    .filter(theme => theme.collection === 'application-styles')
    .flatMap(theme => [theme.templatePath, theme.cssTemplatePath, theme.formLayoutPath]
      .map(file => `yida-skills/skills/yida-design/${file}`)),
  'yida-skills/skills/yida-design/scripts/validate_design_themes.py',
  'lib/samples/openyida-scaffold/canvas-dialog.canvas.jsx',
  ...['shared', 'sidebar', 'side', 'top', 'mixed', 'dock', 'tabs', 'data', 'content'].map(name => `lib/samples/openyida-scaffold/canvas-nav/${name}.jsx`),
  'yida-skills/skills/yida-canvas-custom-page/references/dialog-guide.md',
  'yida-skills/skills/yida-process-rule/references/approval-actions.md',
];

const FORBIDDEN_PACKAGE_PREFIXES = [
  'agent/',
  'docs/',
  'scripts/e2e-real/',
  'scripts/eval/',
  'tests/',
  'yida-skills/skills/yida-design/references/style-designs/',
  'yida-skills/skills/yida-design/sub_skill/yida-design-plan/templates/design-themes/',
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

function sizeLimitMessage(label, actual, limit) {
  return `${label} is ${formatBytes(actual)} (${actual} bytes), above ${formatBytes(limit)} (${limit} bytes) by ${actual - limit} bytes`;
}

function getPackageBudgetErrors(pack) {
  const errors = [];
  if (pack.size > MAX_TARBALL_BYTES) {
    errors.push(sizeLimitMessage('tarball', pack.size, MAX_TARBALL_BYTES));
  }
  if (pack.unpackedSize > MAX_UNPACKED_BYTES) {
    errors.push(sizeLimitMessage('unpacked package', pack.unpackedSize, MAX_UNPACKED_BYTES));
  }
  if (pack.entryCount > MAX_ENTRY_COUNT) {
    errors.push(`package has ${pack.entryCount} files, above ${MAX_ENTRY_COUNT}`);
  }
  return errors;
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
    fail(sizeLimitMessage(oversized.path, oversized.size, MAX_SINGLE_FILE_BYTES));
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

  const themeRoot = 'yida-skills/skills/yida-design/';
  const themeIndex = JSON.parse(fs.readFileSync(path.join(__dirname, '..', themeRoot, 'templates/design-themes/index.json'), 'utf8'));
  for (const theme of themeIndex.themes) {
    if (!packagePaths.has(themeRoot + theme.templatePath)) {
      fail(`shared theme template is missing: ${themeRoot + theme.templatePath}`);
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
  console.log(`Package measurements (Node ${process.version}): ${pack.size} tarball bytes, ${pack.unpackedSize} unpacked bytes, ${pack.entryCount} files`);
  const files = pack.files || [];
  validatePackageContents(files);
  const largestFiles = validateLargestFiles(files);

  const budgetErrors = getPackageBudgetErrors(pack);
  if (budgetErrors.length) {fail(budgetErrors.join('\n  error '));}

  console.log(
    `Package size OK: ${formatBytes(pack.size)} tarball, ${formatBytes(pack.unpackedSize)} unpacked, ${pack.entryCount} files`
  );
  console.log('Largest files: ' + largestFiles.join(', '));
}

if (require.main === module) {run();}

module.exports = { getPackageBudgetErrors, MAX_TARBALL_BYTES, MAX_UNPACKED_BYTES, MAX_ENTRY_COUNT };
