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

  test('compile and check-page route .canvas.jsx through the Canvas compiler', () => {
    const sourcePath = path.join(tmpDir, 'pages', 'src', 'portal.canvas.jsx');
    fs.writeFileSync(sourcePath, `
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Button, ConfigProvider } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

function usePortalState() {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const label = useMemo(() => '已选择 ' + count, [count]);
  const increase = useCallback(() => setCount((value) => value + 1), []);
  return { count, increase, label, ref };
}

export default function Portal() {
  const state = usePortalState();
  return (
    <ConfigProvider>
      <Button ref={state.ref} icon={<SearchOutlined />} onClick={state.increase}>
        {state.label}
      </Button>
    </ConfigProvider>
  );
}
`, 'utf8');

    const compileOutput = execFileSync(process.execPath, [
      BIN, 'compile', 'pages/src/portal.canvas.jsx', '--compat', '--skip-lint', '--json',
    ], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });
    expect(JSON.parse(compileOutput)).toMatchObject({
      success: true,
      mode: 'canvas',
      importedModules: ['@ant-design/icons', 'antd', 'react'],
      runtimeCodeBytes: expect.any(Number),
    });

    const checkOutput = execFileSync(process.execPath, [
      BIN, 'check-page', 'pages/src/portal.canvas.jsx', '--json',
    ], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });
    expect(JSON.parse(checkOutput)).toMatchObject({
      ok: true,
      mode: 'canvas',
      importedModules: ['@ant-design/icons', 'antd', 'react'],
      errors: [],
    });
  });

  test('compile reports invalid Ant Design icon exports before publish', () => {
    const sourcePath = path.join(tmpDir, 'pages', 'src', 'invalid-icon.canvas.jsx');
    fs.writeFileSync(sourcePath, `
import React from 'react';
import { Search as SearchIcon } from '@ant-design/icons';
export default function Portal() { return <SearchIcon />; }
`, 'utf8');

    expect(() => execFileSync(process.execPath, [
      BIN, 'compile', 'pages/src/invalid-icon.canvas.jsx', '--json',
    ], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
      stdio: 'pipe',
    })).toThrow(/OPENYIDA_CANVAS_INVALID_ANT_ICON_IMPORT/);
  });

  test('build-page refuses Canvas source instead of using the native compatibility compiler', () => {
    const sourcePath = path.join(tmpDir, 'pages', 'src', 'canvas-only.canvas.jsx');
    fs.writeFileSync(sourcePath, `
import React from 'react';
export default function Page() { return <div>Canvas</div>; }
`, 'utf8');

    expect(() => execFileSync(process.execPath, [
      BIN, 'build-page', 'pages/src/canvas-only.canvas.jsx', '--json',
    ], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
      stdio: 'pipe',
    })).toThrow(/OPENYIDA_PAGE_COMPILER_MISMATCH/);
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
