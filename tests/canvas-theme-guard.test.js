'use strict';

const { compileCanvasLocal } = require('../lib/app/canvas-compile');
const { assertCanvasThemeStructure } = require('../lib/app/canvas-theme-guard');
const { buildApplicationProvider } = require('../yida-skills/skills/yida-canvas-custom-page/scripts/build-canvas-theme');

const provider = buildApplicationProvider();
const content = 'function PageContent() { const { token } = useCanvasThemeContext(); return <div style={{color: token.colorPrimary}}>指标</div>; }';

function expectIssue(source, issueType) {
  let caught;
  try { compileCanvasLocal(source, { sourcePath: 'page.canvas.jsx' }); } catch (error) { caught = error; }
  expect(caught).toMatchObject({
    code: 'OPENYIDA_CANVAS_THEME_PROVIDER_INVALID',
    details: { stage: 'canvas_compile', sourcePath: 'page.canvas.jsx', issueType, line: expect.any(Number) },
  });
}

test('blocks a page with an injected provider that was never mounted', () => {
  expectIssue(provider + content + 'function YidaComp() { return <PageContent />; }', 'provider_missing');
});

test('also blocks unused theme injection on an antd page without a theme hook', () => {
  expectIssue(provider + 'function YidaComp() { return <div>官网</div>; }', 'provider_missing');
});

test('an unused component containing a provider does not cover the page', () => {
  expectIssue(provider + content + `
    function Unused() { return <CanvasThemeProvider><PageContent /></CanvasThemeProvider>; }
    function YidaComp() { return <PageContent />; }
  `, 'provider_missing');
});

test.each([
  'const theme = useCanvasThemeContext();',
  'const theme = usePalette();',
])('blocks theme reads in the entry before its returned provider: %s', hook => {
  expectIssue(provider + `
    function usePalette() { return useCanvasThemeContext(); }
    function YidaComp() { ${hook} return <CanvasThemeProvider><div>{theme.status}</div></CanvasThemeProvider>; }
  `, 'root_hook');
});

test('calling content as a function inside provider JSX still runs the hook too early', () => {
  expectIssue(provider + content + 'function YidaComp() { return <CanvasThemeProvider>{PageContent()}</CanvasThemeProvider>; }', 'root_hook');
});

test('blocks context recreated inside a component', () => {
  expectIssue(`import React from 'react';
    function YidaComp() { const CanvasThemeContext = React.createContext(null); return <div>{String(CanvasThemeContext)}</div>; }
  `, 'context_scope');
});

test.each([
  'function YidaComp() { return <CanvasThemeProvider><PageContent /></CanvasThemeProvider>; }',
  'const YidaComp = () => <CanvasThemeProvider><PageContent /></CanvasThemeProvider>;',
  'function Shell({children}) { return <CanvasThemeProvider>{children}</CanvasThemeProvider>; } function YidaComp() { return <Shell><PageContent /></Shell>; }',
  'const Theme = CanvasThemeProvider; function YidaComp() { return <Theme><PageContent /></Theme>; }',
  'const YidaComp = React.memo(() => <CanvasThemeProvider><PageContent /></CanvasThemeProvider>);',
  'function YidaComp() { return React.createElement(CanvasThemeProvider, null, React.createElement(PageContent)); }',
  'export default function App() { return <CanvasThemeProvider><PageContent /></CanvasThemeProvider>; }',
])('accepts a mounted provider and child component: %s', entry => {
  expect(compileCanvasLocal(provider + content + entry).runtimeCode).toBeTruthy();
});

test('plain pages and comments about theme do not require a provider', () => {
  expect(compileCanvasLocal('// CanvasThemeProvider useCanvasThemeContext\nfunction YidaComp() { return <div>内容</div>; }').runtimeCode).toBeTruthy();
  expect(() => assertCanvasThemeStructure('function YidaComp( invalid')).not.toThrow();
});

test('unexpanded theme markers report assembly instructions before missing binding errors', () => {
  expect(() => compileCanvasLocal('/* @canvas-theme-provider */\nfunction YidaComp() { return <CanvasThemeProvider><div/></CanvasThemeProvider>; }', { sourcePath: 'source.canvas.jsx' }))
    .toThrow(expect.objectContaining({ code: 'OPENYIDA_CANVAS_THEME_NOT_ASSEMBLED',
      details: { stage: 'canvas_compile', sourcePath: 'source.canvas.jsx', line: 1, issueType: 'unexpanded_marker' } }));
  expect(() => compileCanvasLocal('/* @canvas-theme-provider */\nfunction YidaComp() { return <div/>; }'))
    .toThrow(expect.objectContaining({ code: 'OPENYIDA_CANVAS_THEME_NOT_ASSEMBLED' }));
});

test('marker text in a string or explanatory comment is not an assembly placeholder', () => {
  expect(() => compileCanvasLocal('/* Documenting @canvas-theme-provider here */\nfunction YidaComp() { return <div>{"/* @canvas-theme-provider */"}</div>; }')).not.toThrow();
});

test.each([
  "{token:{colorPrimary:'#1677ff'}}",
  "{token:{colorLink:'var(--color-brand1-6)'}}",
  "{components:{Tabs:{itemSelectedColor:'#1677ff',inkBarColor:'#1677ff'}}}",
  "{components:{Button:{colorPrimary:'blue'}}}",
])('rejects fixed brand overrides including nested component overrides under --strict-theme: %s', theme => {
  expect(() => compileCanvasLocal(`import {ConfigProvider as Theme} from 'antd'; const config=${theme}; function YidaComp(){return <Theme theme={config}><div/></Theme>}`, { strictBrand: true }))
    .toThrow(expect.objectContaining({ code: 'OPENYIDA_CANVAS_THEME_FIXED_BRAND' }));
});

test.each([
  "{token:{colorError:'#ff0000',borderRadius:12}}",
  '{token:window.resolvedTheme}',
  '{components:{Tabs:{itemSelectedColor:window.resolvedTheme.colorPrimary}}}',
])('preserves semantic and dynamic colors: %s', theme => {
  expect(() => compileCanvasLocal(`import {ConfigProvider} from 'antd'; function YidaComp(){return <ConfigProvider theme={${theme}}><div/></ConfigProvider>}`)).not.toThrow();
});

test('namespace ConfigProvider fixed tokens are checked under --strict-theme', () => {
  expect(() => assertCanvasThemeStructure("import * as UI from 'antd'; const color='orange'; function YidaComp(){return <UI.ConfigProvider theme={{token:{colorPrimary:color}}}><div/></UI.ConfigProvider>}", { strictBrand: true }))
    .toThrow(expect.objectContaining({ code: 'OPENYIDA_CANVAS_THEME_FIXED_BRAND' }));
});

const fixedBrand = "import {ConfigProvider} from 'antd'; function YidaComp(){return <ConfigProvider theme={{token:{colorPrimary:'#1677ff'}}}><div/></ConfigProvider>}";

test('fixed brand error under --strict-theme carries local-only, non-network recovery metadata', () => {
  let caught;
  try { compileCanvasLocal(fixedBrand, { sourcePath: 'page.canvas.jsx', strictBrand: true }); } catch (error) { caught = error; }
  expect(caught).toMatchObject({
    code: 'OPENYIDA_CANVAS_THEME_FIXED_BRAND',
    details: { stage: 'canvas_compile', retryable: false, retrySafe: true, sideEffectState: 'none',
      nextAction: { type: 'edit_source_then_recheck' }, field: 'colorPrimary', value: '#1677ff' },
  });
});

test('relaxes fixed brand to a non-blocking warning by default so users are not stuck', () => {
  const warnings = [];
  const result = compileCanvasLocal(fixedBrand, { onThemeWarning: message => warnings.push(message) });
  expect(result.runtimeCode).toContain('#1677ff');
  expect(result.warnings).toEqual([expect.objectContaining({
    code: 'OPENYIDA_CANVAS_THEME_FIXED_BRAND', field: 'colorPrimary', value: '#1677ff', themeConsistency: 'fixed_override',
  })]);
  expect(warnings).toHaveLength(1);
});

test('honors OPENYIDA_CANVAS_STRICT_THEME env to restore the hard block', () => {
  const previous = process.env.OPENYIDA_CANVAS_STRICT_THEME;
  process.env.OPENYIDA_CANVAS_STRICT_THEME = '1';
  try {
    expect(() => assertCanvasThemeStructure(fixedBrand)).toThrow(expect.objectContaining({ code: 'OPENYIDA_CANVAS_THEME_FIXED_BRAND' }));
  } finally {
    if (previous === undefined) { delete process.env.OPENYIDA_CANVAS_STRICT_THEME; }
    else { process.env.OPENYIDA_CANVAS_STRICT_THEME = previous; }
  }
});

test('downgrades fixed brand to a warning when explicitly allowed via option', () => {
  const warnings = [];
  expect(compileCanvasLocal(fixedBrand, { allowFixedBrand: true, onThemeWarning: message => warnings.push(message) }).runtimeCode).toBeTruthy();
  expect(warnings).toHaveLength(1);
});

test('honors OPENYIDA_CANVAS_ALLOW_FIXED_BRAND env as the bypass switch', () => {
  const previous = process.env.OPENYIDA_CANVAS_ALLOW_FIXED_BRAND;
  process.env.OPENYIDA_CANVAS_ALLOW_FIXED_BRAND = '1';
  try {
    const warnings = [];
    expect(assertCanvasThemeStructure(fixedBrand, { onThemeWarning: message => warnings.push(message) })).toBeUndefined();
    expect(warnings).toHaveLength(1);
  } finally {
    if (previous === undefined) { delete process.env.OPENYIDA_CANVAS_ALLOW_FIXED_BRAND; }
    else { process.env.OPENYIDA_CANVAS_ALLOW_FIXED_BRAND = previous; }
  }
});
