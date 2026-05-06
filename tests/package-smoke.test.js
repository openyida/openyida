'use strict';

const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const NPM_BIN = process.platform === 'win32' ? 'npm.cmd' : 'npm';

describe('npm package smoke', () => {
  test('dry-run package includes runtime assets and excludes local-only files', () => {
    const output = execFileSync(NPM_BIN, ['pack', '--dry-run', '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 30000,
    });

    const [pack] = JSON.parse(output);
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
