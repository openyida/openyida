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
