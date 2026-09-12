'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BIN = path.join(ROOT, 'bin', 'yida.js');

describe('compile command', () => {
  let tmpDir;
  let tmpHome;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-compile-'));
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-compile-home-'));
    fs.writeFileSync(path.join(tmpDir, 'config.json'), '{}', 'utf8');
    fs.mkdirSync(path.join(tmpDir, 'pages', 'src'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  function cliEnv() {
    const env = {
      ...process.env,
      HOME: tmpHome,
      USERPROFILE: tmpHome,
      OPENYIDA_LANG: 'zh',
      CI: '1',
    };

    for (const key of Object.keys(env)) {
      if (key.startsWith('CODEX') || key === 'AGENT_WORK_ROOT') {
        delete env[key];
      }
    }

    return env;
  }

  test('compiles a JSX custom page sample without login or network work', () => {
    execFileSync(process.execPath, [
      BIN,
      'sample',
      'yida-density',
      'density-switch-page',
      '--output',
      'pages/src/home.jsx',
    ], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });

    execFileSync(process.execPath, [BIN, 'compile', 'pages/src/home.jsx', '--skip-lint'], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });

    const compiledPath = path.join(tmpDir, 'pages', 'dist', 'home.js');
    expect(fs.existsSync(compiledPath)).toBe(true);
    expect(fs.statSync(compiledPath).size).toBeGreaterThan(1000);
  });

  test('compiles a Canvas page to deterministic JSON without publishing', () => {
    const sourcePath = path.join(tmpDir, 'pages', 'src', 'dashboard.canvas.jsx');
    fs.writeFileSync(sourcePath, `
import React from 'react';

export default function YidaComp() {
  return <div>访客看板</div>;
}
`, 'utf8');

    const stdout = execFileSync(process.execPath, [
      BIN,
      'compile',
      'pages/src/dashboard.canvas.jsx',
      '--json',
    ], {
      cwd: tmpDir,
      env: { ...cliEnv(), YIDA_QUIET: '1' },
      encoding: 'utf8',
      timeout: 10000,
    });
    const payload = JSON.parse(stdout.trim());

    expect(payload).toMatchObject({
      ok: true,
      pageType: 'canvas',
      sourcePath: fs.realpathSync(sourcePath),
    });
    expect(payload.compiledHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(payload.importedModules).toEqual(['react']);
    expect(fs.existsSync(path.join(tmpDir, 'pages', 'dist', 'dashboard.canvas.js'))).toBe(false);
  });

  test('rejects emoji even when lint is skipped', () => {
    const sourcePath = path.join(tmpDir, 'pages', 'src', 'emoji.jsx');
    fs.writeFileSync(sourcePath, `
export function renderJsx() {
  return <div>✅ 已完成</div>;
}
`, 'utf8');

    expect(() => execFileSync(process.execPath, [BIN, 'compile', 'pages/src/emoji.jsx', '--skip-lint'], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
      stdio: 'pipe',
    })).toThrow(/contains emoji/);

    expect(fs.existsSync(path.join(tmpDir, 'pages', 'dist', 'emoji.js'))).toBe(false);
  });

  test('rejects unicode escape emoji before writing compiled output', () => {
    const sourcePath = path.join(tmpDir, 'pages', 'src', 'escaped.jsx');
    fs.writeFileSync(sourcePath, `
export function renderJsx() {
  return <div>{"\\u2705"}</div>;
}
`, 'utf8');

    expect(() => execFileSync(process.execPath, [BIN, 'compile', 'pages/src/escaped.jsx', '--skip-lint'], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
      stdio: 'pipe',
    })).toThrow(/contains emoji/);

    expect(fs.existsSync(path.join(tmpDir, 'pages', 'dist', 'escaped.js'))).toBe(false);
  });

  test('rejects emoji in source filenames', () => {
    const sourcePath = path.join(tmpDir, 'pages', 'src', 'home-✅.jsx');
    fs.writeFileSync(sourcePath, `
export function renderJsx() {
  return <div>ok</div>;
}
`, 'utf8');

    expect(() => execFileSync(process.execPath, [BIN, 'compile', 'pages/src/home-✅.jsx', '--skip-lint'], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
      stdio: 'pipe',
    })).toThrow(/contains emoji/);

    expect(fs.existsSync(path.join(tmpDir, 'pages', 'dist', 'home-✅.js'))).toBe(false);
  });
});
