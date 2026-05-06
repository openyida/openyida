'use strict';

const path = require('path');
const { spawnSync } = require('child_process');
const packageJson = require('../package.json');

const ROOT = path.join(__dirname, '..');
const NPM_BIN = process.platform === 'win32' ? 'npm.cmd' : 'npm';

describe('npm package smoke', () => {
  test('runtime dependencies stay lightweight for agent installs', () => {
    expect(packageJson.dependencies).not.toHaveProperty('playwright');
    expect(packageJson.dependencies).not.toHaveProperty('playwright-core');
  });

  test('dry-run package includes runtime assets and excludes local-only files', () => {
    const result = spawnSync(NPM_BIN, ['pack', '--dry-run', '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: process.platform === 'win32',
      timeout: 30000,
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
    expect(files).toContain('project/config.json');
    expect(files).toContain('yida-skills/SKILL.md');
    expect(files).toContain('scripts/postinstall.js');
    expect(files.some((file) => file.startsWith('project/pages/src/demo-'))).toBe(true);

    expect(files).not.toContain('.env.local');
    expect(files.some((file) => file.startsWith('tests/'))).toBe(false);
    expect(files.some((file) => file.startsWith('node_modules/'))).toBe(false);
  });
});
