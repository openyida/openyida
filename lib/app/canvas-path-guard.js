'use strict';

const Babel = require('@babel/standalone');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');

// Inspect navigation destinations, not every string: '/custom/' is a valid
// suffix in '/' + appType + '/custom/' + formUuid. Unknown values need runtime QA.
function assertCanvasNavigationPaths(source, options = {}) {
  let ast;
  try { ast = Babel.packages.parser.parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] }); }
  catch { return; }
  const traverse = Babel.packages.traverse.default || Babel.packages.traverse;
  const name = node => node?.computed ? node.property?.value : node?.property?.name;
  function value(p, seen = new Set()) {
    if (!p?.node || seen.has(p.node)) { return null; }
    seen.add(p.node);
    if (p.isStringLiteral()) { return p.node.value; }
    if (p.isTemplateLiteral()) { return p.node.quasis[0].value.cooked + (p.node.expressions.length ? '<dynamic>' : ''); }
    if (p.isBinaryExpression({ operator: '+' })) {
      const left = value(p.get('left'), new Set(seen));
      const right = value(p.get('right'), new Set(seen));
      return left === null ? null : left + (right === null ? '<dynamic>' : right);
    }
    if (p.isIdentifier()) {
      const binding = p.scope.getBinding(p.node.name);
      return binding?.constant && binding.path.isVariableDeclarator() ? value(binding.path.get('init'), seen) : null;
    }
    if (p.isNewExpression() && p.node.callee.name === 'URL') { return value(p.get('arguments.0'), seen); }
    if (p.isMemberExpression() && ['href', 'pathname'].includes(name(p.node))) { return value(p.get('object'), seen); }
    return null;
  }
  function check(p) {
    if (!p?.node) { return; }
    if (p.isConditionalExpression() || p.isLogicalExpression()) {
      for (const key of p.isConditionalExpression() ? ['consequent', 'alternate'] : ['left', 'right']) { check(p.get(key)); }
      return;
    }
    const path = value(p);
    if (!/^\s*\/(?:custom|workbench|submission|formDetail)(?:\/|[?#]|$)/.test(path || '')) { return; }
    const line = p.node.loc?.start.line || 1;
    throw new CliError(t('publish.canvas_path_missing_app_type', line), {
      code: 'OPENYIDA_CANVAS_PATH_MISSING_APP_TYPE',
      details: { stage: 'canvas_compile', sourcePath: options.sourcePath || '', line, path,
        expectedPath: '/{appType}/{pageType}/{formUuid}', sample: 'openyida sample openyida-page-template canvas-navigation' },
    });
  }
  traverse(ast, {
    JSXAttribute(p) {
      if (!['href', 'action', 'formAction'].includes(p.node.name.name)) { return; }
      const val = p.get('value');
      check(val.isJSXExpressionContainer() ? val.get('expression') : val);
    },
    AssignmentExpression(p) {
      const left = p.node.left;
      if ((left.type === 'Identifier' && left.name === 'location') || name(left) === 'location'
        || (['href', 'pathname'].includes(name(left)) && (left.object?.name === 'location' || name(left.object) === 'location'))) { check(p.get('right')); }
    },
    CallExpression(p) {
      const callee = p.node.callee;
      const method = name(callee);
      const receiver = callee.object;
      if ((method === 'open' && ['window', 'self', 'globalThis'].includes(receiver?.name))
        || (['assign', 'replace'].includes(method) && (receiver?.name === 'location' || name(receiver) === 'location'))
        || (['push', 'replace'].includes(method) && (receiver?.name === 'router' || name(receiver) === 'router'))) { check(p.get('arguments.0')); }
      if (method === 'openPage' || callee.name === 'openPage') {
        const arg = p.get('arguments.0');
        if (arg?.isObjectExpression()) {
          for (const prop of arg.get('properties')) {
            if (prop.isObjectProperty() && (prop.node.key.name || prop.node.key.value) === 'url') { check(prop.get('value')); }
          }
        } else { check(arg); }
      }
    },
  });
}

module.exports = { assertCanvasNavigationPaths };
