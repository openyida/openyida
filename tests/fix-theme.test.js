'use strict';

const Babel = require('@babel/standalone');
const { transformFixedBrandTheme } = require('../lib/app/fix-theme');
const { assertCanvasThemeStructure } = require('../lib/app/canvas-theme-guard');

// Reparse the migrated output; a codemod that emits broken syntax is a bug.
function parses(source) {
  Babel.packages.parser.parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  return true;
}

const wrap = theme =>
  `import {ConfigProvider} from 'antd'; function YidaComp(){return <ConfigProvider theme={${theme}}><div/></ConfigProvider>}`;

test('removes a fixed brand token so the guard stops rejecting it', () => {
  const source = wrap("{token:{colorPrimary:'#1677ff'}}");
  const result = transformFixedBrandTheme(source);
  expect(result.changed).toBe(true);
  expect(result.output).not.toContain('#1677ff');
  expect(parses(result.output)).toBe(true);
  expect(() => assertCanvasThemeStructure(result.output)).not.toThrow();
});

test('reports the violations it migrated without leaking char offsets', () => {
  const result = transformFixedBrandTheme(wrap("{token:{colorPrimary:'#1677ff'}}"));
  expect(result.violations).toEqual([
    { field: 'colorPrimary', color: '#1677ff', line: expect.any(Number) },
  ]);
});

test('removes every fixed override across token and nested components', () => {
  const source = wrap("{token:{colorPrimary:'#1677ff'},components:{Tabs:{itemSelectedColor:'#1677ff',inkBarColor:'#1677ff'}}}");
  const result = transformFixedBrandTheme(source);
  expect(result.changed).toBe(true);
  expect(result.output).not.toContain('#1677ff');
  expect(result.violations).toHaveLength(3);
  expect(parses(result.output)).toBe(true);
  expect(() => assertCanvasThemeStructure(result.output)).not.toThrow();
});

test('strips a fixed override but keeps sibling semantic and layout tokens', () => {
  const source = wrap("{token:{colorPrimary:'#1677ff',colorError:'#ff0000',borderRadius:12}}");
  const result = transformFixedBrandTheme(source);
  expect(result.changed).toBe(true);
  expect(result.output).not.toContain('#1677ff');
  expect(result.output).toContain("colorError:'#ff0000'");
  expect(result.output).toContain('borderRadius:12');
  expect(parses(result.output)).toBe(true);
});

test.each([
  "{token:{colorError:'#ff0000',borderRadius:12}}",
  '{token:window.resolvedTheme}',
  '{components:{Tabs:{itemSelectedColor:window.resolvedTheme.colorPrimary}}}',
])('leaves semantic and dynamic themes untouched: %s', theme => {
  const source = wrap(theme);
  const result = transformFixedBrandTheme(source);
  expect(result.changed).toBe(false);
  expect(result.output).toBe(source);
  expect(result.violations).toEqual([]);
});

test('is a no-op on sources without antd theme markers', () => {
  const source = 'function YidaComp(){ return <div>官网</div>; }';
  expect(transformFixedBrandTheme(source)).toEqual({ changed: false, output: source, violations: [] });
});

test('drops a preceding comma when the fixed override is the last property', () => {
  const source = wrap("{token:{borderRadius:12,colorPrimary:'#1677ff'}}");
  const result = transformFixedBrandTheme(source);
  expect(result.changed).toBe(true);
  expect(result.output).toContain('borderRadius:12');
  expect(result.output).not.toContain('#1677ff');
  expect(parses(result.output)).toBe(true);
});

test.each([
  "{token:{colorPrimary:'#1677ff' /* brand */,borderRadius:12}}",
  "{token:{colorPrimary:'#1677ff' // brand\n,borderRadius:12}}",
  "{token:{borderRadius:12,/* brand */colorPrimary:'#1677ff'}}",
  "{token:{colorPrimary:'#1677ff',colorLink:'#1677ff' /* link */,borderRadius:12}}",
])('preserves valid syntax and unrelated tokens around comments: %s', theme => {
  const result = transformFixedBrandTheme(wrap(theme));
  expect(result.changed).toBe(true);
  expect(result.output).toContain('borderRadius:12');
  expect(result.output).not.toContain('#1677ff');
  expect(parses(result.output)).toBe(true);
  expect(transformFixedBrandTheme(result.output).changed).toBe(false);
});

test('keeps the maintained dynamic provider and its drawer theme unchanged', () => {
  const { buildApplicationProvider } = require('../yida-skills/skills/yida-canvas-custom-page/scripts/build-canvas-theme');
  const source = buildApplicationProvider();
  expect(transformFixedBrandTheme(source)).toEqual({ changed: false, output: source, violations: [] });
});
