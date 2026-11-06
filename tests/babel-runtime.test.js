'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const vm = require('vm');
const Babel = require('../lib/core/babel');
const { default: compileLegacy } = require('../lib/core/babel-transform');

test('Node presets strip TypeScript and compile classic JSX for the Canvas runtime', () => {
  const { code } = Babel.transform('const View = (props: { value: number }) => <div>{props.value}</div>;', {
    filename: 'view.tsx',
    presets: [[Babel.presets.typescript, { allExtensions: true, isTSX: true }], [Babel.presets.react, { runtime: 'classic' }]],
  });
  const React = { createElement: (type, props, value) => ({ type, value }) };
  expect(vm.runInNewContext(code + '\nView({ value: 7 });', { React })).toEqual({ type: 'div', value: 7 });
  expect(code).not.toContain('jsx-runtime');
});

test('legacy compilation preserves custom component bindings and old browser transforms', () => {
  const result = compileLegacy('function renderJsx() { return <Button>{this.state?.label ?? "fallback"}</Button>; }', {}, false, { RE_VERSION: '7.0' });
  expect(result.error).toBeNull();
  expect(result.compiled).not.toMatch(/\?\.|\?\?/);
  const React = { createElement: (type, props, value) => ({ type, value }) };
  const context = { state: {}, _getComponentView: name => 'Resolved' + name };
  expect(vm.runInNewContext(result.compiled + '\nrenderJsx.call(context);', { React, context }))
    .toEqual({ type: 'ResolvedButton', value: 'fallback' });
});

test('compilation never executes Babel config from the user project', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-babel-config-'));
  try {
    fs.writeFileSync(path.join(directory, 'babel.config.cjs'), 'throw new Error("host Babel config executed");');
    fs.writeFileSync(path.join(directory, '.babelrc.json'), JSON.stringify({ plugins: ['./host-plugin.cjs'] }));
    fs.writeFileSync(path.join(directory, 'host-plugin.cjs'), 'throw new Error("host Babel plugin executed");');
    const script = `
      const Babel = require(${JSON.stringify(require.resolve('../lib/core/babel'))});
      const { default: compileLegacy } = require(${JSON.stringify(require.resolve('../lib/core/babel-transform'))});
      const { compileCanvasLocal } = require(${JSON.stringify(require.resolve('../lib/app/canvas-compile'))});
      const typed = Babel.transform('const value: number = 7;', {
        filename: ${JSON.stringify(path.join(directory, 'view.ts'))},
        presets: [Babel.presets.typescript], babelrc: true,
        configFile: ${JSON.stringify(path.join(directory, 'babel.config.cjs'))}
      });
      const legacy = compileLegacy('function renderJsx() { return <div />; }', {}, false, { RE_VERSION: '7.0' });
      if (legacy.error) throw legacy.error;
      const canvas = compileCanvasLocal('export function YidaComp() { return <div />; }');
      console.log(JSON.stringify({ typed: typed.code, legacy: legacy.compiled, canvas: canvas.runtimeCode }));
    `;
    const output = JSON.parse(execFileSync(process.execPath, ['-e', script], {
      cwd: directory, encoding: 'utf8', timeout: 30000,
    }));
    expect(output.typed).toContain('const value = 7;');
    expect(output.legacy).toContain('React.createElement');
    expect(output.canvas).toContain('YidaComp');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test.each(['package.json', '.browserslistrc', 'environment'])('compilation ignores ambient Browserslist configuration from %s', (configuration) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-browserslist-'));
  const workspace = path.join(directory, 'workspace');
  const configPath = path.join(directory, '.browserslistrc');
  try {
    fs.mkdirSync(workspace);
    if (configuration === 'package.json') {
      fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ browserslist: ['invalid-browser-query'] }));
    } else {
      fs.writeFileSync(configPath, 'invalid-browser-query');
    }
    const output = compileInWorkspace(workspace, {
      environment: configuration === 'environment' ? { BROWSERSLIST: 'invalid-browser-query', BROWSERSLIST_CONFIG: configPath } : {},
      // 调用者也不能重新开启用户机器上的配置发现。
      transformOptions: { browserslistConfigFile: configuration === 'package.json' ? true : configPath },
    });
    expect(output.typed).toBe(7);
    expect(output.legacy).toEqual({ type: 'div', value: 'fallback' });
    expect(output.canvas).toContain('YidaComp');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('compilation succeeds without probing sandbox-denied ancestor package metadata', () => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-browserslist-denied-')));
  const workspace = path.join(directory, 'workspace');
  const deniedPath = path.join(directory, 'package.json');
  try {
    fs.mkdirSync(workspace);
    fs.writeFileSync(deniedPath, '{}');
    const output = compileInWorkspace(workspace, {
      beforeCompile: `
        const fs = require('fs');
        const stat = fs.statSync;
        let deniedProbes = 0;
        fs.statSync = function (file, ...args) {
          if (file === ${JSON.stringify(deniedPath)}) {
            deniedProbes++;
            const error = new Error('sandbox denied ancestor metadata');
            error.code = 'EPERM';
            throw error;
          }
          return stat.call(this, file, ...args);
        };
      `,
      extraOutput: 'deniedProbes',
    });
    expect(output.typed).toBe(7);
    expect(output.legacy).toEqual({ type: 'div', value: 'fallback' });
    expect(output.canvas).toContain('YidaComp');
    expect(output.extra).toBe(0);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function compileInWorkspace(workspace, { environment = {}, transformOptions = {}, beforeCompile = '', extraOutput = 'null' } = {}) {
  const script = `
    const vm = require('vm');
    ${beforeCompile}
    const Babel = require(${JSON.stringify(require.resolve('../lib/core/babel'))});
    const { default: compileLegacy } = require(${JSON.stringify(require.resolve('../lib/core/babel-transform'))});
    const { compileCanvasLocal } = require(${JSON.stringify(require.resolve('../lib/app/canvas-compile'))});
    const typed = Babel.transform('const value: number = 7;', {
      filename: 'view.ts', presets: [Babel.presets.typescript],
      ...${JSON.stringify(transformOptions)}
    });
    const legacy = compileLegacy('function renderJsx() { return <div>{this.state?.label ?? "fallback"}</div>; }', {}, false, { RE_VERSION: '7.0' });
    if (legacy.error) throw legacy.error;
    const canvas = compileCanvasLocal('export function YidaComp() { return <div />; }');
    const React = { createElement: (type, props, value) => ({ type, value }) };
    console.log(JSON.stringify({
      typed: vm.runInNewContext(typed.code + '\\nvalue;'),
      legacy: vm.runInNewContext(legacy.compiled + '\\nrenderJsx.call({ state: {} });', { React }),
      canvas: canvas.runtimeCode, extra: ${extraOutput}
    }));
  `;
  return JSON.parse(execFileSync(process.execPath, ['-e', script], {
    cwd: workspace, encoding: 'utf8', timeout: 30000,
    env: { ...process.env, BROWSERSLIST: '', BROWSERSLIST_CONFIG: '', BROWSERSLIST_ROOT_PATH: '', ...environment },
  }));
}
