'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const packageJson = require('../package.json');
const { getPackageBudgetErrors, MAX_TARBALL_BYTES, MAX_UNPACKED_BYTES, MAX_ENTRY_COUNT } = require('../scripts/validate-package-size');

const ROOT = path.join(__dirname, '..');
const NPM_BIN = process.env.OPENYIDA_NPM_BIN || (process.platform === 'win32' ? 'npm.cmd' : 'npm');

describe('npm package smoke', () => {
  const budgetLimit = { size: MAX_TARBALL_BYTES, unpackedSize: MAX_UNPACKED_BYTES, entryCount: MAX_ENTRY_COUNT };

  test('package budgets accept their exact boundaries', () => {
    expect(getPackageBudgetErrors(budgetLimit)).toEqual([]);
  });

  test('package budget covers the Windows Node 20 measurement from PR 614', () => {
    expect(getPackageBudgetErrors({ ...budgetLimit, unpackedSize: 8358003 })).toEqual([]);
  });

  test('package budget covers the task-center package measured on CI Node 20', () => {
    expect(getPackageBudgetErrors({ size: 2439886, unpackedSize: 9099864, entryCount: 707 })).toEqual([]);
  });

  test('package budget includes portable workflow readers and optional components on Node 20', () => {
    expect(getPackageBudgetErrors({ size: 2452398, unpackedSize: 9144691, entryCount: 712 })).toEqual([]);
  });

  test('package budget covers merged formula and workflow capabilities on Node 20', () => {
    expect(getPackageBudgetErrors({ size: 2504841, unpackedSize: 9309589, entryCount: 726 })).toEqual([]);
  });

  test('package budget covers task-driven responsive guidance on Node 26', () => {
    expect(getPackageBudgetErrors({ size: 2588870, unpackedSize: 9676590, entryCount: 764 })).toEqual([]);
  });

  test('package budget covers responsive guidance merged with dynamic personnel sources', () => {
    expect(getPackageBudgetErrors({ size: 2594266, unpackedSize: 9694016, entryCount: 766 })).toEqual([]);
  });

  test('package budget covers account/tool guidance measured on CI Node 20', () => {
    expect(getPackageBudgetErrors({ size: 2627647, unpackedSize: 9710118, entryCount: 767 })).toEqual([]);
  });

  test('package budget covers responsive feedback merged with main task transfer on Node 20', () => {
    expect(getPackageBudgetErrors({ size: 2634130, unpackedSize: 9733108, entryCount: 769 })).toEqual([]);
  });

  test('package budget covers stacked templates, messages and responsive features on Node 20', () => {
    expect(getPackageBudgetErrors({ size: 2654371, unpackedSize: 9808079, entryCount: 774 })).toEqual([]);
  });

  test('package budget covers consent-based GitHub setup on Node 20', () => {
    expect(getPackageBudgetErrors({ size: 2637999, unpackedSize: 9746094, entryCount: 770 })).toEqual([]);
  });

  test('package budget covers templates and messages merged with GitHub setup on Node 20', () => {
    expect(getPackageBudgetErrors({ size: 2659151, unpackedSize: 9821065, entryCount: 775 })).toEqual([]);
  });

  test.each([
    ['original PR 638', { size: 2444722, unpackedSize: 9113751, entryCount: 707 }],
    ['PR 638 merged with main', { size: 2496932, unpackedSize: 9278325, entryCount: 721 }],
    ['native cards combined with personal workflow', { size: 2528519, unpackedSize: 9387803, entryCount: 733 }],
    ['data and cool cards combined with personal workflow', { size: 2552878, unpackedSize: 9493590, entryCount: 738 }],
  ])('package budget covers the native data-card Node 20 artifact: %s', (_name, artifact) => {
    expect(getPackageBudgetErrors(artifact)).toEqual([]);
  });

  test.each(['size', 'unpackedSize', 'entryCount'])('package budgets reject %s above its boundary', field => {
    expect(getPackageBudgetErrors({ ...budgetLimit, [field]: budgetLimit[field] + 1 })).toHaveLength(1);
  });

  test('runtime dependencies stay lightweight for agent installs', () => {
    expect(packageJson.dependencies).not.toHaveProperty('playwright');
    expect(packageJson.dependencies).not.toHaveProperty('playwright-core');
    expect(packageJson.dependencies).not.toHaveProperty('qrcode');
    expect(packageJson.dependencies).not.toHaveProperty('ajv');
  });

  test('package size validator reports missing npm without TypeError', () => {
    const missingNpm = path.join(os.tmpdir(), 'openyida-missing-npm-' + Date.now());
    const result = spawnSync(process.execPath, ['scripts/validate-package-size.js'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        OPENYIDA_NPM_BIN: missingNpm,
      },
      timeout: 30000,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('failed to run');
    expect(result.stderr).toContain('OPENYIDA_NPM_BIN');
    expect(result.stderr).not.toContain('TypeError');
  });

  test('dry-run package includes runtime assets and excludes local-only files', () => {
    const npmCheck = spawnSync(NPM_BIN, ['--version'], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: process.platform === 'win32',
      timeout: 30000,
    });
    if (npmCheck.error || npmCheck.status !== 0) {
      console.warn(`Skipping npm pack smoke: ${NPM_BIN} is not available`);
      return;
    }

    const npmCache = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-npm-cache-'));
    try {
      const result = spawnSync(NPM_BIN, ['pack', '--dry-run', '--json'], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, npm_config_cache: npmCache },
        shell: process.platform === 'win32',
        timeout: 120000,
      });
      if (result.status !== 0 || result.error) {
        throw new Error([
          `npm pack --dry-run failed with status ${result.status}`,
          result.error ? result.error.message : '',
          result.stderr,
          result.stdout,
        ].filter(Boolean).join('\n'));
      }

      const [pack] = JSON.parse(result.stdout);
      expect(getPackageBudgetErrors(pack)).toEqual([]);
      const files = pack.files.map((file) => file.path);

      expect(files).toContain('bin/yida.js');
      expect(files).toContain('lib/app/inline-css-guard.js');
      expect(files).toContain('lib/core/utils.js');
      expect(files).toContain('lib/app/theme-scope.js');
      expect(files).toContain('lib/core/theme-brand-scale.js');
      expect(files).toContain('lib/design/palette-contrast.js');
      expect(files).toContain('yida-skills/skills/yida-design/references/theme-preview-images.json');
      expect(files).not.toContain('yida-skills/skills/yida-design/templates/application-styles.json');
      expect(files).not.toContain('yida-skills/skills/yida-design/templates/navigation-styles.json');
      expect(files).toContain('lib/core/locales/zh.js');
      expect(files).toContain('lib/core/locales/en.js');
      expect(files).toContain('project/config.json');
      expect(files).toContain('yida-skills/SKILL.md');
      expect(files).toContain('yida-skills/references/setup-and-env.md');
      expect(files).toContain('yida-skills/skills/yida-login/SKILL.md');
      expect(files).toContain('yida-skills/skills-index.json');
      expect(files).toContain('scripts/postinstall.js');
      expect(files.some((file) => file.startsWith('lib/templates/'))).toBe(false);
      expect(files).toContain('lib/samples/yida-rechart/trend-combo.canvas.jsx');
      expect(files).toContain('lib/samples/yida-canvas-table-form/table-form-batch-submit.canvas.jsx');
      expect(files).toContain('lib/samples/openyida-scaffold/form-fields.json');
      expect(files).toContain('lib/samples/openyida-scaffold/canvas-form-drawer.canvas.jsx');

      expect(files.some((file) => file.startsWith('locales-extra/'))).toBe(false);
      expect(files.some((file) => /^lib\/core\/locales\/(?!zh|en)[^/]+\.js$/.test(file))).toBe(false);
      expect(files.some((file) => file.startsWith('agent/'))).toBe(false);
      expect(files.some((file) => file.startsWith('docs/'))).toBe(false);
      expect(files.filter((file) => file.startsWith('scripts/'))).toEqual([
        'scripts/postinstall.js',
      ]);
      expect(files).not.toContain('.env.local');
      expect(files.some((file) => file.startsWith('tests/'))).toBe(false);
      expect(files.some((file) => file.startsWith('node_modules/'))).toBe(false);
    } finally {
      fs.rmSync(npmCache, { recursive: true, force: true });
    }
  });
});
