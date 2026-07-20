'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const packageJson = require('../package.json');

const ROOT = path.join(__dirname, '..');
const NPM_BIN = process.env.OPENYIDA_NPM_BIN || (process.platform === 'win32' ? 'npm.cmd' : 'npm');

describe('npm package smoke', () => {
  test('runtime dependencies stay lightweight for agent installs', () => {
    expect(packageJson.dependencies).not.toHaveProperty('playwright');
    expect(packageJson.dependencies).not.toHaveProperty('playwright-core');
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
      const files = pack.files.map((file) => file.path);

      expect(files).toContain('bin/yida.js');
      expect(files).toContain('lib/core/utils.js');
      expect(files).toContain('lib/core/locales/zh.js');
      expect(files).toContain('lib/core/locales/en.js');
      expect(files).toContain('docs/capabilities.md');
      expect(files).toContain('project/config.json');
      expect(files).toContain('yida-skills/SKILL.md');
      expect(files).toContain('yida-skills/references/setup-and-env.md');
      expect(files).toContain('yida-skills/skills/yida-login/SKILL.md');
      expect(files).toContain('yida-skills/skills-index.json');
      expect(files).toContain('scripts/postinstall.js');
      expect(files).toContain('lib/samples/yida-canvas-custom-page/dashboard-starter.canvas.jsx');

      expect(files.some((file) => file.startsWith('locales-extra/'))).toBe(false);
      expect(files.some((file) => /^lib\/core\/locales\/(?!zh|en)[^/]+\.js$/.test(file))).toBe(false);
      expect(files).not.toContain('.env.local');
      expect(files.some((file) => file.startsWith('tests/'))).toBe(false);
      expect(files.some((file) => file.startsWith('node_modules/'))).toBe(false);
    } finally {
      fs.rmSync(npmCache, { recursive: true, force: true });
    }
  });
});
