'use strict';

const Babel = require('@babel/standalone');
const traverse = Babel.packages.traverse.default || Babel.packages.traverse;
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');

const member = (node, name) => node && ['MemberExpression', 'OptionalMemberExpression'].includes(node.type)
  && (node.computed ? node.property.value : node.property.name) === name;

// Only inspect a direct result from the installed Yida bridge, not arbitrary
// HTTP clients, adapters, similarly named methods, or a shadowed variable.
function bridgeMember(node) {
  return (member(node, '__OPENYIDA_YIDA_API__') || member(node, 'openyidaYidaApi'))
    && node.object?.type === 'Identifier' && node.object.name === 'window';
}

function isYidaBridge(path) {
  if (bridgeMember(path.node) && !path.scope.getBinding('window')) {return true;}
  if (!path.isIdentifier()) {return false;}
  const binding = path.scope.getBinding(path.node.name);
  return !!(binding && binding.constant && binding.path.isVariableDeclarator()
    && bridgeMember(binding.path.node.init) && !binding.path.scope.getBinding('window'));
}

function assertFormDataResponse(source, options = {}) {
  let ast;
  try { ast = Babel.packages.parser.parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] }); }
  catch { return; } // The compiler owns syntax diagnostics.
  const issues = [];
  traverse(ast, { VariableDeclarator(path) {
    if (!path.get('id').isIdentifier() || !path.get('init').isAwaitExpression()) {return;}
    const call = path.get('init.argument');
    if (!call.isCallExpression() || !member(call.node.callee, 'searchFormDatas') || !isYidaBridge(call.get('callee.object'))) {return;}
    const binding = path.scope.getBinding(path.node.id.name);
    if (!binding || !binding.constant) {return;}
    let unwrapsArray = false;
    const doubleData = [];
    for (const ref of binding.referencePaths) {
      const first = ref.parentPath;
      if (!member(first.node, 'data') || first.node.object !== ref.node) {continue;}
      const next = first.parentPath;
      if (member(next.node, 'data') && next.node.object === first.node) {doubleData.push(next);}
      if (next.isCallExpression() && member(next.node.callee, 'isArray') && next.node.callee.object?.name === 'Array') {unwrapsArray = true;}
    }
    if (!unwrapsArray && doubleData.length) {
      issues.push({ line: doubleData[0].node.loc?.start.line || 1, variable: path.node.id.name });
    }
  } });
  if (issues.length) {
    throw new CliError(t('publish.lint_searchformdata_bridge_unwrap'), {
      code: 'OPENYIDA_FORM_DATA_RESPONSE_INVALID',
      details: { sourcePath: options.sourcePath || '', issues, nextAction: 'normalize_form_rows' },
    });
  }
}
module.exports = { assertFormDataResponse };
