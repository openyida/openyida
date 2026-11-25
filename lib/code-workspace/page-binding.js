'use strict';

const { fail } = require('./files');
const { buildCanvasPageSchemaObject } = require('../app/services/canvas-page-schema-builder');

function canvases(schema) {
  const result = [];
  function visit(node) {
    if (!node || typeof node !== 'object') { return; }
    if (node.componentName === 'YidaCodeCanvas') { result.push(node); }
    if (Array.isArray(node.children)) { node.children.forEach(visit); }
  }
  (schema.pages || []).forEach(page => (page.componentsTree || []).forEach(visit));
  return result;
}

function bindPage(schema, options, workspaceId) {
  const next = JSON.parse(JSON.stringify(schema));
  let nodes = canvases(next);
  if (!nodes.length && options['create-canvas']) {
    // Only initialize the untouched, empty display-page schema. Never replace existing content.
    const page = next.pages?.[0];
    const roots = page?.componentsTree;
    if (next.pages?.length !== 1 || !Array.isArray(roots) || roots.length !== 1 ||
        Object.keys(roots[0]).some(key => key !== 'dataSource')) {
      fail('create-canvas requires an empty display page');
    }
    const generated = buildCanvasPageSchemaObject('', '', '[]', options['form-uuid']);
    for (const [key, value] of Object.entries(generated)) {
      if (key !== 'pages' && next[key] === undefined) { next[key] = value; }
    }
    for (const [key, value] of Object.entries(generated.pages[0])) {
      if (key !== 'componentsTree' && page[key] === undefined) { page[key] = value; }
    }
    page.id = page.id || options['form-uuid'];
    page.componentsMap = generated.pages[0].componentsMap;
    page.componentsTree = generated.pages[0].componentsTree;
    if (roots[0].dataSource) { page.componentsTree[0].dataSource = roots[0].dataSource; }
    nodes = canvases(next);
  }
  const selected = options['canvas-node-id']
    ? nodes.filter(node => node.id === options['canvas-node-id']) : nodes;
  if (selected.length !== 1) { fail('Select exactly one existing YidaCodeCanvas with --canvas-node-id, or initialize an empty page with --create-canvas'); }
  const node = selected[0];
  node.props = { ...node.props, codeBundle: { version: '2', workspaceId, entryId: options.entry } };
  delete node.props.code;
  delete node.props.runtimeCode;
  return { schema: next, canvasNodeId: node.id, binding: node.props.codeBundle };
}

module.exports = { bindPage, canvases };
