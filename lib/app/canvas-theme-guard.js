'use strict';

const Babel = require('@babel/standalone');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');

// Check the maintained theme contract without executing business code.
// Dynamic component factories and runtime branches still need browser verification.
function assertCanvasThemeStructure(source, options = {}) {
  if (!/CanvasThemeProvider|useCanvasThemeContext|CanvasThemeContext|@canvas-theme-provider|antd/.test(source)) { return; }
  let ast;
  try {
    ast = Babel.packages.parser.parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  } catch { return; } // Let the compiler report syntax errors.
  const marker = ast.comments?.find(comment => comment.type === 'CommentBlock' && comment.value.trim() === '@canvas-theme-provider');
  if (marker) {
    const line = marker.loc.start.line;
    throw new CliError(t('publish.canvas_theme_not_assembled', line), {
      code: 'OPENYIDA_CANVAS_THEME_NOT_ASSEMBLED',
      details: { stage: 'canvas_compile', sourcePath: options.sourcePath || '', line, issueType: 'unexpanded_marker' },
    });
  }
  const traverse = Babel.packages.traverse.default || Babel.packages.traverse;
  assertBrandOverrides(ast, traverse, options);
  const functions = new Map();
  let program;
  let defaultExport;
  const fail = (kind, node) => {
    const line = node?.loc?.start.line || 1;
    throw new CliError(t(`publish.canvas_theme_${kind}`, line), {
      code: 'OPENYIDA_CANVAS_THEME_PROVIDER_INVALID',
      details: { stage: 'canvas_compile', sourcePath: options.sourcePath || '', line, issueType: kind },
    });
  };

  traverse(ast, {
    Program(p) { program = p; },
    ExportDefaultDeclaration(p) { defaultExport = p.get('declaration'); },
    Function(p) {
      const name = p.node.id?.name || (p.parentPath.isVariableDeclarator() ? p.parentPath.node.id.name : '');
      functions.set(p.node, { name, calls: [], renders: [], hooks: [] });
    },
    VariableDeclarator(p) {
      if (p.node.id.name === 'CanvasThemeContext' && p.getFunctionParent()) {
        fail('context_scope', p.node);
      }
    },
  });

  function resolveFunction(p, seen = new Set()) {
    if (!p?.node || seen.has(p.node)) { return null; }
    seen.add(p.node);
    if (p.isFunction()) { return p.node; }
    if (p.isVariableDeclarator()) { return resolveFunction(p.get('init'), seen); }
    if (p.isIdentifier() || p.isJSXIdentifier()) {
      return resolveFunction(p.scope.getBinding(p.node.name)?.path, seen);
    }
    // React.memo/forwardRef retain the wrapped component's theme requirements.
    if (p.isCallExpression()) {
      const callee = p.node.callee;
      const name = callee.type === 'Identifier' ? callee.name : callee.property?.name;
      if (['memo', 'forwardRef'].includes(name)) { return resolveFunction(p.get('arguments.0'), seen); }
    }
    return null;
  }

  traverse(ast, {
    CallExpression(p) {
      const owner = functions.get(p.getFunctionParent()?.node);
      const target = resolveFunction(p.get('callee'));
      const targetName = functions.get(target)?.name || p.node.callee.name;
      if (targetName === 'useCanvasThemeContext') {
        if (!owner) { fail('root_hook', p.node); }
        owner.hooks.push(p.node);
      }
      if (!owner) { return; }
      if (target) { owner.calls.push(target); }
      const callee = p.node.callee;
      if (callee.type === 'MemberExpression' && callee.object.name === 'React' && callee.property.name === 'createElement') {
        const component = resolveFunction(p.get('arguments.0'));
        if (component) { owner.renders.push(component); }
      }
    },
    JSXOpeningElement(p) {
      const owner = functions.get(p.getFunctionParent()?.node);
      const component = resolveFunction(p.get('name'));
      if (owner && component) { owner.renders.push(component); }
    },
  });

  const entry = resolveFunction(program.scope.getBinding('YidaComp')?.path) || resolveFunction(defaultExport);
  if (!entry) { return; }

  // Calling a hook before returning a Provider cannot read that Provider.
  const directSeen = new Set();
  function checkEntryCalls(node) {
    if (directSeen.has(node)) { return; }
    directSeen.add(node);
    const info = functions.get(node);
    if (info.hooks.length) { fail('root_hook', info.hooks[0]); }
    info.calls.forEach(checkEntryCalls);
  }
  checkEntryCalls(entry);

  const seen = new Set();
  let providerMounted = false;
  let firstHook;
  function visit(node) {
    if (seen.has(node)) { return; }
    seen.add(node);
    const info = functions.get(node);
    firstHook = firstHook || info.hooks[0];
    info.renders.forEach(child => {
      if (functions.get(child).name === 'CanvasThemeProvider') { providerMounted = true; }
      visit(child);
    });
    info.calls.forEach(visit);
  }
  visit(entry);
  const hasProvider = [...functions.values()].some(info => info.name === 'CanvasThemeProvider');
  if (!providerMounted && (hasProvider || firstHook)) {
    fail('provider_missing', firstHook || entry);
  }
}

// Only reject provably fixed brand colors passed to antd's ConfigProvider.
// Semantic colors, layout tokens and dynamic theme resolvers remain supported.
function assertBrandOverrides(ast, traverse, options) {
  const resolve = (p, seen = new Set()) => {
    if (!p?.node || seen.has(p.node)) { return null; }
    seen.add(p.node);
    if (!p.isIdentifier()) { return p; }
    const binding = p.scope.getBinding(p.node.name);
    return binding?.constant && binding.path.isVariableDeclarator() ? resolve(binding.path.get('init'), seen) : null;
  };
  const properties = p => {
    const object = resolve(p);
    // Spreads may override earlier values; unknown shapes are not rejected.
    return object?.isObjectExpression() && !object.node.properties.some(prop => prop.type === 'SpreadElement')
      ? object.get('properties').filter(prop => prop.isObjectProperty() && !prop.node.computed) : [];
  };
  const key = p => p.node.key.name || p.node.key.value;
  const prop = (p, name) => properties(p).filter(item => key(item) === name).pop()?.get('value');
  const check = (p, field) => {
    const val = resolve(p);
    if (!val?.isStringLiteral() && !(val?.isTemplateLiteral() && !val.node.expressions.length)) { return; }
    const color = val.isStringLiteral() ? val.node.value : val.node.quasis[0].value.cooked;
    if (!color) { return; }
    const line = val.node.loc?.start.line || 1;
    throw new CliError(t('publish.canvas_theme_fixed_brand', line), {
      code: 'OPENYIDA_CANVAS_THEME_FIXED_BRAND',
      details: { stage: 'canvas_compile', sourcePath: options.sourcePath || '', line, field, value: color,
        sample: 'openyida sample openyida-page-template canvas-theme' },
    });
  };
  const tokens = p => properties(p).forEach(item => {
    if (/^color(?:Primary|Link)(?:Hover|Active|Bg|BgHover|Border|BorderHover|Text|TextHover|TextActive)?$/.test(key(item))) {
      check(item.get('value'), key(item));
    }
  });
  traverse(ast, {
    JSXOpeningElement(p) {
      const name = p.get('name');
      const binding = p.scope.getBinding(name.isJSXIdentifier() ? name.node.name : name.node.object?.name);
      const imported = binding?.path;
      if (imported?.parent.source?.value !== 'antd') { return; }
      if (!(imported.isImportSpecifier() && imported.node.imported.name === 'ConfigProvider')
        && !(imported.isImportNamespaceSpecifier() && name.node.property?.name === 'ConfigProvider')) { return; }
      const attribute = p.get('attributes').find(attr => attr.isJSXAttribute() && attr.node.name.name === 'theme');
      const theme = attribute?.get('value.expression');
      tokens(prop(theme, 'token'));
      const components = prop(theme, 'components');
      for (const component of ['Button', 'Tabs', 'Segmented']) {
        const config = prop(components, component);
        tokens(config);
        const fields = component === 'Tabs' ? ['inkBarColor', 'itemSelectedColor', 'itemHoverColor', 'itemActiveColor']
          : component === 'Button' ? ['defaultHoverColor', 'defaultHoverBorderColor', 'defaultActiveColor', 'defaultActiveBorderColor'] : [];
        fields.forEach(field => check(prop(config, field), `${component}.${field}`));
      }
    },
  });
}

module.exports = { assertCanvasThemeStructure };
