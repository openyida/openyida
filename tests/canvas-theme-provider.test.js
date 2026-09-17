'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { readThemeSnapshot, buildProvider, run } = require('../yida-skills/skills/yida-canvas-custom-page/scripts/build-canvas-theme');
const { compileCanvasLocal } = require('../lib/app/canvas-compile');
const css = ':root { --color-brand1-6: #246834; --color-white: #fff; --pod-page-bg-color: var(--color-white); }\n.dark { --color-white: #111; }';
let directory;
beforeEach(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-provider-')); });
afterEach(() => { fs.rmSync(directory, { recursive: true, force: true }); });

test('extracts only root defaults and preserves variable expressions', () => {
  expect(readThemeSnapshot(css)).toEqual({ '--color-brand1-6': '#246834', '--color-white': '#fff', '--pod-page-bg-color': 'var(--color-white)' });
  expect(readThemeSnapshot(css + '\n@media (min-width: 1px) { .x {} :root { --color-white: red; } }')['--color-white']).toBe('#fff');
  expect(() => readThemeSnapshot('.page { --color-brand1-6: red; }')).toThrow('top-level :root');
  expect(() => buildProvider(css, 'http://example.com/theme.css')).toThrow('HTTPS');
});

test('generates a self-contained preview with the supplied theme and compiles its dependencies', () => {
  const themeFile = path.join(directory, 'theme.css');
  const output = path.join(directory, 'preview.canvas.jsx');
  fs.writeFileSync(themeFile, css);
  run(['--theme-file', themeFile, '--theme-url', 'https://example.com/theme.css', '--output', output]);
  const source = fs.readFileSync(output, 'utf8');
  const compiled = compileCanvasLocal(source);
  expect(JSON.parse(compiled.importedModules)).toEqual(['antd', 'react']);
  expect(source).toContain('https://example.com/theme.css');
  expect(source).toContain('#246834');
  expect(source).toContain('<CanvasThemeProvider preview>');
  expect(source).not.toMatch(/document\.body|createElement\(['"]link|fetch\(/);
});

test('assembles an existing page at an explicit marker without overwriting its source', () => {
  const themeFile = path.join(directory, 'theme.css');
  const page = path.join(directory, 'source.canvas.jsx');
  const output = path.join(directory, 'built.canvas.jsx');
  fs.writeFileSync(themeFile, css);
  const input = "/* @canvas-theme-provider */\nimport { Button } from 'antd';\nfunction YidaComp() { return <CanvasThemeProvider><Button type='primary'>保存</Button></CanvasThemeProvider>; }";
  fs.writeFileSync(page, input);
  run(['--theme-file', themeFile, '--page', page, '--output', output]);
  expect(fs.readFileSync(page, 'utf8')).toBe(input);
  expect(JSON.parse(compileCanvasLocal(fs.readFileSync(output, 'utf8')).importedModules)).toEqual(['antd', 'react']);
  expect(() => run(['--theme-file', themeFile, '--page', page, '--output', page])).toThrow('overwrite');
  fs.writeFileSync(page, 'function YidaComp() {}');
  expect(() => run(['--theme-file', themeFile, '--page', page, '--output', output])).toThrow('exactly one');
});

test('the maintained full application theme can generate a compilable preview', () => {
  const themeFile = path.join(__dirname, '../yida-skills/skills/yida-design/references/theme/app-custom-theme-template.css');
  const output = path.join(directory, 'preview.canvas.jsx');
  run(['--theme-file', themeFile, '--output', output]);
  expect(compileCanvasLocal(fs.readFileSync(output, 'utf8')).runtimeCode).toContain('CanvasThemeProvider');
});

test.each(['\n', '\r\n'])('runtime resolver maps scoped surfaces and removes its probe even on failure (%j)', (eol) => {
  const vm = require('vm');
  const values = { '--color-brand1-6': '#246834', '--color-white': '#fff', '--pod-page-bg-color': '#eee' };
  const probe = { style: {}, remove: jest.fn() };
  const root = { appendChild: jest.fn() };
  root.ownerDocument = {
    createElement: () => probe,
    defaultView: {
      CSS: { supports: () => true },
      getComputedStyle: (element) => element === root
        ? { getPropertyValue: (name) => values[name] || '' }
        : { color: probe.style.color },
    },
  };
  const context = { React: { createContext: () => ({}) } };
  vm.createContext(context);
  const source = buildProvider(css).replace(/\r?\n/g, eol).split('// preview=true')[0].replace(/^import .*;\r?\n/gm, '');
  vm.runInContext(source, context);
  const theme = context.resolveCanvasTheme(root);
  expect(theme.colorPrimary).toBe('#246834');
  expect(theme.colorBgLayout).toBe('#eee');
  expect(theme.colorBgContainer).toBe('#fff');
  root.ownerDocument.defaultView.CSS.supports = () => { throw new Error('style failure'); };
  expect(() => context.resolveCanvasTheme(root)).toThrow('style failure');
  expect(probe.remove).toHaveBeenCalledTimes(2);
});

test('documented business and chart examples assemble and compile through the same script', () => {
  const skillRoot = path.join(__dirname, '../yida-skills/skills/yida-canvas-custom-page');
  const themeFile = path.join(directory, 'theme.css');
  fs.writeFileSync(themeFile, css);
  for (const file of ['canvas-theme-provider.md', 'canvas-style-implementation-guide.md']) {
    const guide = fs.readFileSync(path.join(skillRoot, 'references', file), 'utf8');
    const examples = [...guide.matchAll(/```jsx\n([\s\S]*?)```/g)]
      .map(match => match[1]).filter(source => source.includes('/* @canvas-theme-provider */'));
    expect(examples).toHaveLength(1);
    const page = path.join(directory, file + '.canvas.jsx');
    const output = path.join(directory, file + '.themed.canvas.jsx');
    fs.writeFileSync(page, examples[0]);
    run(['--theme-file', themeFile, '--page', page, '--output', output]);
    expect(compileCanvasLocal(fs.readFileSync(output, 'utf8')).runtimeCode).toContain('CanvasThemeProvider');
  }
});
