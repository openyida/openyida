'use strict';
const { bindPage } = require('../lib/code-workspace/page-binding');
const { parseArgs } = require('../lib/code-workspace');
const { resolveCodeBundleSchema, validateCodeBundleDescriptor } = require('../lib/app/get-schema');

const options = { 'form-uuid': 'FORM-A', entry: 'home' };
test('get-schema preserves V2 entry references instead of treating them as legacy single-file bundles', async () => {
  const binding = { version: '2', workspaceId: 'workspace1', entryId: 'home' };
  const result = { success: true, content: { pages: [{ componentsTree: [
    { componentName: 'YidaCodeCanvas', id: 'node1', props: { codeBundle: binding } },
  ] }] } };
  expect(await resolveCodeBundleSchema(result, 'APP_A', 'FORM-A', {})).toEqual(result);
  expect(result.content.pages[0].componentsTree[0].props).toEqual({ codeBundle: binding });
  expect(() => validateCodeBundleDescriptor({ ...binding, runtimeUrl: 'https://untrusted.test/code.js' })).toThrow('invalid');
});
test('binding preserves unrelated nodes, data sources and input; removes stale inline code', () => {
  const schema = { gmtModified: 123, pages: [{ dataSource: { list: ['keep'] }, componentsTree: [
    { id: 'root', componentName: 'Page', children: [
      { id: 'canvas', componentName: 'YidaCodeCanvas', props: { code: 'secret source', runtimeCode: 'old', componentProps: { a: 1 } } },
      { id: 'other', componentName: 'Text', props: { text: 'keep' } },
    ] },
  ] }] };
  const result = bindPage(schema, options, 'W1');
  expect(result.schema.pages[0].componentsTree[0].children[0].props).toEqual({
    componentProps: { a: 1 }, codeBundle: { version: '2', workspaceId: 'W1', entryId: 'home' },
  });
  expect(result.schema.pages[0].componentsTree[0].children[1]).toEqual(schema.pages[0].componentsTree[0].children[1]);
  expect(result.schema.pages[0].dataSource).toEqual(schema.pages[0].dataSource);
  expect(schema.pages[0].componentsTree[0].children[0].props.code).toBe('secret source');
});
test('ambiguous canvases require exact node and missing node never overwrites content', () => {
  const schema = { pages: [{ componentsTree: ['A', 'B'].map(id => ({ id, componentName: 'YidaCodeCanvas' })) }] };
  expect(() => bindPage(schema, options, 'W1')).toThrow('exactly one');
  expect(bindPage(schema, { ...options, 'canvas-node-id': 'B' }, 'W1').canvasNodeId).toBe('B');
  expect(() => bindPage(schema, { ...options, 'canvas-node-id': 'missing' }, 'W1')).toThrow('exactly one');
});
test('create-canvas initializes only a genuinely empty page and preserves its data source', () => {
  const schema = { status: 'TEST', pages: [{ componentsTree: [{ dataSource: { list: ['keep'] } }] }] };
  const result = bindPage(schema, { ...options, 'create-canvas': true }, 'W1');
  expect(result.schema.pages[0].componentsTree[0].dataSource).toEqual({ list: ['keep'] });
  expect(result.binding).toEqual({ version: '2', workspaceId: 'W1', entryId: 'home' });
  expect(() => bindPage({ pages: [{ componentsTree: [{ componentName: 'Text' }] }] },
    { ...options, 'create-canvas': true }, 'W1')).toThrow('empty display page');
});
test('binding requires explicit real page and declared entry arguments', () => {
  expect(() => parseArgs(['bind', 'APP_A', '/tmp/work'])).toThrow('form-uuid');
  expect(parseArgs(['bind', 'APP_A', '/tmp/work', '--form-uuid', 'FORM-A', '--entry', 'home', '--create-canvas']))
    .toMatchObject({ action: 'bind', 'create-canvas': true, entry: 'home' });
  expect(parseArgs(['start-test', 'APP_A'])).toEqual({ action: 'start-test', appType: 'APP_A' });
});
