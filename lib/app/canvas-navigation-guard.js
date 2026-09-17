'use strict';

const Babel = require('@babel/standalone');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');

// Only diagnose statically known misuse of the shipped navigation contracts.
// Dynamic data and actual host geometry still require browser verification.
function assertCanvasNavigationStructure(source, options = {}) {
  if (!/CanvasNavigationContent|loadCanvasNavigation|filterCanvasNavigation/.test(source)) { return; }
  let ast;
  try { ast = Babel.packages.parser.parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] }); }
  catch { return; }
  const traverse = Babel.packages.traverse.default || Babel.packages.traverse;
  const fail = (kind, node) => {
    const line = node.loc?.start.line || 1;
    throw new CliError(t(`publish.canvas_navigation_${kind}`, line), {
      code: 'OPENYIDA_CANVAS_NAVIGATION_INVALID',
      details: { stage: 'canvas_compile', sourcePath: options.sourcePath || '', line, issueType: kind },
    });
  };
  function resolve(p, seen = new Set()) {
    if (!p?.node || seen.has(p.node)) { return null; }
    seen.add(p.node);
    if (!p.isIdentifier()) { return p; }
    const binding = p.scope.getBinding(p.node.name);
    return binding?.constant && binding.path.isVariableDeclarator() ? resolve(binding.path.get('init'), seen) : null;
  }
  const prop = (p, name) => {
    const object = resolve(p);
    return object?.isObjectExpression() ? object.get('properties').find(item => item.isObjectProperty()
      && !item.node.computed && (item.node.key.name || item.node.key.value) === name)?.get('value') : undefined;
  };
  const string = p => { const value = resolve(p); return value?.isStringLiteral() ? value.node.value : undefined; };
  const hasUnboundLocal = (p, seen = new Set()) => {
    const array = resolve(p);
    if (!array?.isArrayExpression() || seen.has(array.node)) { return false; }
    seen.add(array.node);
    return array.get('elements').some(element => {
      const item = resolve(element);
      if (!item?.isObjectExpression() || item.node.properties.some(node => node.type === 'SpreadElement')) { return false; }
      const children = resolve(prop(item, 'children'));
      if (children?.isArrayExpression() && children.node.elements.length) { return hasUnboundLocal(children, seen); }
      return string(prop(item, 'targetType')) === 'local'
        || (!prop(item, 'formUuid') && !prop(item, 'navUuid') && !!prop(item, 'key'));
    });
  };
  let documentLayout = false;
  const collapsedMains = [];
  traverse(ast, {
    CallExpression(p) {
      const name = p.node.callee.name;
      const args = p.get('arguments');
      if (name === 'CanvasNavigationContent' && string(prop(args[0], 'layout')) === 'document') { documentLayout = true; }
      if (!['loadCanvasNavigation', 'filterCanvasNavigation'].includes(name)) { return; }
      const configArg = name === 'loadCanvasNavigation' ? args[0] : args[3];
      const config = resolve(configArg);
      if (configArg?.node && !config) { return; }
      if (config && (!config.isObjectExpression() || config.node.properties.some(node => node.type === 'SpreadElement'))) { return; }
      const mode = prop(config, 'mode');
      if (mode && string(mode) !== 'platform') { return; }
      const items = name === 'loadCanvasNavigation' ? prop(config, 'items') : args[0];
      if (hasUnboundLocal(items)) { fail('local_platform', p.node); }
    },
    JSXOpeningElement(p) {
      const attributes = p.get('attributes');
      const attribute = name => {
        const value = attributes.find(item => item.isJSXAttribute() && item.node.name.name === name)?.get('value');
        return value?.isJSXExpressionContainer() ? value.get('expression') : value;
      };
      if (p.node.name.name === 'CanvasNavigationContent' && string(attribute('layout')) === 'document') { documentLayout = true; }
      if (string(attribute('className')) !== 'openyida-nav-main') { return; }
      const owner = p.getFunctionParent();
      const ownerName = owner?.node.id?.name || (owner?.parentPath.isVariableDeclarator() ? owner.parentPath.node.id.name : '');
      if (ownerName !== 'CanvasNavigationContent') { return; }
      const style = resolve(attribute('style'));
      if (style?.isObjectExpression() && string(prop(style, 'display')) === 'flex'
        && /^1\s+1\s+0(?:px|%)?$/.test(string(prop(style, 'flex')) || '')) { collapsedMains.push(p.node); }
    },
  });
  if (documentLayout && collapsedMains.length) { fail('document_flex', collapsedMains[0]); }
}

module.exports = { assertCanvasNavigationStructure };
