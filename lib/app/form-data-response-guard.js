'use strict';

const Babel = require('../core/babel');
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

// Recognize the local, synchronous association parser by its explicit error
// contract, not its name alone. Constant aliases work; shadowed parameters and
// arbitrary adapters remain outside this rule.
function isAssociationParser(callee, cache, seen = new Set()) {
  if (!callee.isIdentifier()) {return false;}
  const binding = callee.scope.getBinding(callee.node.name);
  if (!binding || !binding.constant || seen.has(binding)) {return false;}
  if (cache.has(binding)) {return cache.get(binding);}
  seen.add(binding);
  let fn = binding.path;
  if (fn.isVariableDeclarator()) {
    const init = fn.get('init');
    if (init.isIdentifier()) {
      const result = isAssociationParser(init, cache, seen);
      cache.set(binding, result);
      return result;
    }
    fn = init;
  }
  let marker = false, parsesJson = false;
  if (fn.isFunction() && !fn.node.async && !fn.node.generator && fn.get('body').isBlockStatement()
    && fn.node.body.body.some(node => node.type === 'ReturnStatement' && node.argument?.type === 'Identifier')) {
    fn.traverse({
      Function(path) { path.skip(); },
      StringLiteral(path) { if (path.node.value === 'DATA_ASSOCIATION_INVALID') {marker = true;} },
      CallExpression(path) {
        if (member(path.node.callee, 'parse') && path.node.callee.object?.name === 'JSON'
          && !path.scope.getBinding('JSON')) {parsesJson = true;}
      },
    });
  }
  const result = marker && parsesJson;
  cache.set(binding, result);
  return result;
}

function constantValue(path, seen = new Set()) {
  if (!path.isIdentifier()) {return path;}
  const binding = path.scope.getBinding(path.node.name);
  if (!binding || !binding.constant || !binding.path.isVariableDeclarator() || seen.has(binding)) {return path;}
  seen.add(binding);
  return constantValue(binding.path.get('init'), seen);
}

// Deliberately narrow: a known association ID under formData, its constant
// alias, or a direct String/template coercion. Do not guess custom renderers.
function rendersRawAssociation(path) {
  path = constantValue(path);
  if (path.isMemberExpression() || path.isOptionalMemberExpression()) {
    const key = path.node.computed ? path.node.property.value : path.node.property.name;
    return typeof key === 'string' && /^associationFormField_.+/.test(key)
      && member(constantValue(path.get('object')).node, 'formData');
  }
  if (path.isCallExpression() && path.get('callee').isIdentifier({ name: 'String' })
    && !path.scope.getBinding('String') && path.node.arguments.length === 1) {
    return rendersRawAssociation(path.get('arguments.0'));
  }
  if (path.isTemplateLiteral()) {return path.get('expressions').some(rendersRawAssociation);}
  return false;
}

function assertFormDataResponse(source, options = {}) {
  let ast;
  try { ast = Babel.packages.parser.parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] }); }
  catch { return; } // The compiler owns syntax diagnostics.
  const issues = [];
  const associationIssues = [], parserCache = new WeakMap();
  traverse(ast, {
    TryStatement(path) {
      const handler = path.get('handler');
      if (!handler.node || path.node.finalizer) {return;}
      const statements = handler.node.body.body;
      const last = statements[statements.length - 1];
      // Only the observed unconditional empty-array fallback. Branches, throws,
      // structured error states and nested handlers are not inferred here.
      if (last?.type !== 'ReturnStatement' || last.argument?.type !== 'ArrayExpression'
        || last.argument.elements.length || statements.slice(0, -1).some(node =>
        !['ExpressionStatement', 'VariableDeclaration'].includes(node.type))) {return;}
      let callsParser = false;
      path.get('block').traverse({
        Function(inner) { inner.skip(); },
        TryStatement(inner) { inner.skip(); },
        CallExpression(call) { if (isAssociationParser(call.get('callee'), parserCache)) {callsParser = true;} },
      });
      if (callsParser) {associationIssues.push({ line: handler.node.loc?.start.line || 1, kind: 'association_error_swallowed' });}
    },
    JSXExpressionContainer(path) {
      if (path.parentPath.isJSXAttribute()) {return;}
      const host = path.findParent(parent => parent.isJSXElement());
      if (host) {
        const name = host.node.openingElement.name;
        if (name.type !== 'JSXIdentifier' || !/^[a-z][a-z0-9]*$/.test(name.name)) {return;}
      }
      if (!rendersRawAssociation(path.get('expression'))) {return;}
      const debug = path.findParent(parent => parent.isJSXElement()
        && ['pre', 'code'].some(name => parent.get('openingElement.name').isJSXIdentifier({ name })));
      if (!debug) {
        associationIssues.push({ line: path.node.loc?.start.line || 1, kind: 'raw_association_rendered' });
      }
    },
    VariableDeclarator(path) {
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
    },
  });
  if (issues.length) {
    throw new CliError(t('publish.lint_searchformdata_bridge_unwrap'), {
      code: 'OPENYIDA_FORM_DATA_RESPONSE_INVALID',
      details: { sourcePath: options.sourcePath || '', issues, nextAction: 'normalize_form_rows' },
    });
  }
  if (associationIssues.length) {
    throw new CliError(t('publish.lint_association_data_contract'), {
      code: 'OPENYIDA_ASSOCIATION_DATA_INVALID',
      details: { sourcePath: options.sourcePath || '', issues: associationIssues,
        nextAction: 'use_read_canvas_association_and_preserve_error_status' },
    });
  }
}
module.exports = { assertFormDataResponse };
