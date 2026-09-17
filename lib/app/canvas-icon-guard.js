'use strict';

const Babel = require('@babel/standalone');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { packages } = require('./canvas-icon-exports.json');
const exportSets = Object.fromEntries(Object.entries(packages).map(([name, entry]) => [name, new Set(entry.exports)]));

function packageName(source) {
  return Object.keys(packages).find(name => source === name || source.startsWith(name + '/'));
}

// Resolve literal namespace members and immutable aliases, respecting lexical
// scope. Dynamic lookups still require a validated component map / fallback.
function namespacePackage(p, seen = new Set()) {
  if (!p?.isIdentifier() && !p?.isJSXIdentifier()) { return null; }
  const binding = p.scope.getBinding(p.node.name);
  if (!binding || seen.has(binding)) { return null; }
  seen.add(binding);
  if (binding.path.isImportNamespaceSpecifier()) {
    return packageName(binding.path.parent.source.value);
  }
  if (binding.constant && binding.path.isVariableDeclarator()) {
    return namespacePackage(binding.path.get('init'), seen);
  }
  return null;
}

function staticKey(node, computed) {
  if (!computed && ['Identifier', 'JSXIdentifier'].includes(node?.type)) { return node.name; }
  if (node?.type === 'StringLiteral') { return node.value; }
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) { return node.quasis[0].value.cooked; }
  return null;
}

function assertCanvasIconExports(source, options = {}) {
  if (!/lucide-react|@ant-design\/icons/.test(source)) { return; }
  let ast;
  try {
    ast = Babel.packages.parser.parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  } catch { return; } // The compiler owns syntax diagnostics.
  const check = (name, exported, node, namedImport = false) => {
    if (!name || exported === null || exportSets[name].has(exported)) { return; }
    if (namedImport && Object.hasOwn(packages[name].specialNamedExports || {}, exported)) { return; }
    const suggestions = name === 'lucide-react' && exported === 'Museum' ? ['Landmark'] : [];
    const line = node.loc?.start.line || 1;
    throw new CliError(t('publish.canvas_icon_export_unavailable', name, exported, line, suggestions.join(', ') || '—'), {
      code: 'OPENYIDA_CANVAS_ICON_EXPORT_UNAVAILABLE',
      details: {
        stage: 'canvas_compile', sourcePath: options.sourcePath || '',
        line, column: (node.loc?.start.column || 0) + 1,
        packageName: name, exportName: exported, suggestions,
        runtimeAsset: packages[name].assetUrl, runtimeSha256: packages[name].sha256,
      },
    });
  };
  const member = p => check(namespacePackage(p.get('object')), staticKey(p.node.property, p.node.computed), p.node);
  const destructure = (pattern, init) => {
    const name = namespacePackage(init);
    if (!name || !pattern.isObjectPattern()) { return; }
    for (const property of pattern.node.properties) {
      if (property.type === 'ObjectProperty') { check(name, staticKey(property.key, property.computed), property); }
    }
  };
  const traverse = Babel.packages.traverse.default || Babel.packages.traverse;
  traverse(ast, {
    ImportDeclaration(p) {
      const name = packageName(p.node.source.value);
      if (!name || p.node.importKind === 'type') { return; }
      for (const specifier of p.node.specifiers) {
        if (specifier.type === 'ImportSpecifier' && specifier.importKind !== 'type') {
          check(name, specifier.imported.name || specifier.imported.value, specifier, true);
        }
      }
    },
    MemberExpression: member,
    OptionalMemberExpression: member,
    JSXOpeningElement(p) {
      const name = p.get('name');
      if (name.isJSXMemberExpression()) { member(name); }
    },
    VariableDeclarator(p) { destructure(p.get('id'), p.get('init')); },
    AssignmentExpression(p) { destructure(p.get('left'), p.get('right')); },
  });
}

module.exports = { assertCanvasIconExports };
