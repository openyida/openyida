'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

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

  test('preserves actionable Canvas guard errors as JSON', () => {
    fs.writeFileSync(path.join(tmpDir, 'pages', 'src', 'direct-open.canvas.jsx'), `
import React from 'react';

export default function YidaComp() {
  return <button onClick={() => window.open('/submission/FORM_TEST', '_blank')}>新增预约</button>;
}
`, 'utf8');

    const result = spawnSync(process.execPath, [
      BIN,
      'compile',
      'pages/src/direct-open.canvas.jsx',
      '--json',
    ], {
      cwd: tmpDir,
      env: { ...cliEnv(), YIDA_QUIET: '1' },
      encoding: 'utf8',
      timeout: 10000,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(JSON.parse(result.stderr.trim())).toMatchObject({
      success: false,
      errorCode: 'OPENYIDA_CANVAS_FORM_OPEN_CONTAINER_REQUIRED',
      errorMsg: expect.stringContaining('FormOpenContainer'),
      stage: 'canvas_compile',
      details: {
        stage: 'canvas_compile',
        sourcePath: 'pages/src/direct-open.canvas.jsx',
        line: 5,
        callee: 'window.open',
      },
    });
  });

  test('JSON compile preserves theme warnings and supports explicit strict checks', () => {
    const sourcePath = path.join(tmpDir, 'pages', 'src', 'brand.canvas.jsx');
    const source = "import {ConfigProvider} from 'antd'; function YidaComp(){return <ConfigProvider theme={{token:{colorPrimary:'#1677ff'}}}><div/></ConfigProvider>}";
    fs.writeFileSync(sourcePath, source);
    const run = extra => spawnSync(process.execPath, [BIN, 'compile', path.relative(tmpDir, sourcePath), '--json', ...extra], {
      cwd: tmpDir, env: { ...cliEnv(), YIDA_QUIET: '1', OPENYIDA_CANVAS_STRICT_THEME: '', OPENYIDA_CANVAS_ALLOW_FIXED_BRAND: '' },
      encoding: 'utf8', timeout: 10000,
    });
    const normal = run([]);
    expect(normal.status).toBe(0);
    expect(JSON.parse(normal.stdout).warnings).toEqual([expect.objectContaining({
      code: 'OPENYIDA_CANVAS_THEME_FIXED_BRAND', field: 'colorPrimary', value: '#1677ff',
    })]);
    const strict = run(['--strict-theme']);
    expect(strict.status).toBe(1);
    const failure = JSON.parse(strict.stderr.trim());
    expect(failure.errorCode).toBe('OPENYIDA_CANVAS_THEME_FIXED_BRAND');
    expect(failure.repair).toMatchObject({ unchangedRetryAllowed: false, maxAttemptsWithoutProgress: 2 });
    expect(run(['--allow-fixed-brand']).status).toBe(0);
    expect(fs.readFileSync(sourcePath, 'utf8')).toBe(source);
  });

  test.each(['compile', 'publish'])('%s rejects unavailable runtime icons before login or saving', command => {
    fs.writeFileSync(path.join(tmpDir, 'pages', 'src', 'icon.canvas.jsx'), "import { Museum } from 'lucide-react'; export default () => <Museum/>;");
    const args = [BIN, command, 'pages/src/icon.canvas.jsx'];
    if (command === 'publish') { args.push('APP_TEST', 'FORM_TEST', '--canvas'); }
    args.push('--json');
    const result = spawnSync(process.execPath, args, {
      cwd: tmpDir, env: { ...cliEnv(), YIDA_QUIET: '1', OPENYIDA_SKIP_UPDATE_CHECK: '1' },
      encoding: 'utf8', timeout: 10000,
    });
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stderr.trim())).toMatchObject({
      errorCode: 'OPENYIDA_CANVAS_ICON_EXPORT_UNAVAILABLE',
      errorMsg: expect.stringContaining('Museum'),
      details: { exportName: 'Museum', suggestions: ['Landmark'], line: 1 },
    });
  });

  test.each(['compile', 'publish'])('%s blocks local menus sent to platform filtering before login', command => {
    fs.writeFileSync(path.join(tmpDir, 'pages', 'src', 'nav.canvas.jsx'), "function YidaComp(){ loadCanvasNavigation({items:[{key:'home',targetType:'local'}]}); return <div/>; }");
    const args = [BIN, command, 'pages/src/nav.canvas.jsx'];
    if (command === 'publish') { args.push('APP_TEST', 'FORM_TEST', '--canvas'); }
    const result = spawnSync(process.execPath, [...args, '--json'], {
      cwd: tmpDir, env: { ...cliEnv(), YIDA_QUIET: '1', OPENYIDA_SKIP_UPDATE_CHECK: '1' },
      encoding: 'utf8', timeout: 10000,
    });
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stderr.trim())).toMatchObject({
      errorCode: 'OPENYIDA_CANVAS_NAVIGATION_INVALID',
      details: { issueType: 'local_platform', line: 1 },
    });
  });

  test.each(['compile', 'publish'])('%s rejects an unassembled theme source before login', command => {
    fs.writeFileSync(path.join(tmpDir, 'pages', 'src', 'theme.canvas.jsx'), '/* @canvas-theme-provider */\nexport default () => <CanvasThemeProvider><div/></CanvasThemeProvider>;');
    const args = [BIN, command, 'pages/src/theme.canvas.jsx'];
    if (command === 'publish') { args.push('APP_TEST', 'FORM_TEST', '--canvas'); }
    const result = spawnSync(process.execPath, [...args, '--json'], {
      cwd: tmpDir, env: { ...cliEnv(), YIDA_QUIET: '1', OPENYIDA_SKIP_UPDATE_CHECK: '1' },
      encoding: 'utf8', timeout: 10000,
    });
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stderr.trim())).toMatchObject({
      errorCode: 'OPENYIDA_CANVAS_THEME_NOT_ASSEMBLED',
      errorMsg: expect.stringContaining('build-canvas-theme.js'),
      details: { line: 1, issueType: 'unexpanded_marker' },
    });
  });

  test('returns Canvas syntax errors as structured JSON', () => {
    fs.writeFileSync(path.join(tmpDir, 'pages', 'src', 'invalid.canvas.jsx'), `
import React from 'react';
export default function YidaComp( {
`, 'utf8');

    const result = spawnSync(process.execPath, [
      BIN,
      'compile',
      'pages/src/invalid.canvas.jsx',
      '--json',
    ], {
      cwd: tmpDir,
      env: { ...cliEnv(), YIDA_QUIET: '1' },
      encoding: 'utf8',
      timeout: 10000,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(JSON.parse(result.stderr.trim())).toMatchObject({
      success: false,
      errorCode: 'OPENYIDA_CANVAS_COMPILE_FAILED',
      errorMsg: expect.stringContaining('本地编译失败'),
      stage: 'canvas_compile',
      details: {
        stage: 'canvas_compile',
        sourcePath: 'pages/src/invalid.canvas.jsx',
        causeName: 'SyntaxError',
        loc: expect.objectContaining({
          line: expect.any(Number),
          column: expect.any(Number),
        }),
      },
    });
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
