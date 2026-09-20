'use strict';

const Babel = require('@babel/standalone');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');

const { findCssStructureIssue } = require('../core/css-structure');

function resolveStaticCss(pathRef, seen = new Set()) {
  if (pathRef.isStringLiteral()) { return { text: pathRef.node.value, node: pathRef.node }; }
  if (pathRef.isTemplateLiteral() && pathRef.node.expressions.length === 0) {
    return { text: pathRef.node.quasis[0].value.cooked, node: pathRef.node };
  }
  if (pathRef.isIdentifier()) {
    const binding = pathRef.scope.getBinding(pathRef.node.name);
    if (binding && binding.constant && binding.path.isVariableDeclarator() && !seen.has(binding)) {
      seen.add(binding);
      return resolveStaticCss(binding.path.get('init'), seen);
    }
  }
  return null;
}

function assertInlineCssStructure(source, options = {}) {
  let ast;
  try {
    ast = Babel.packages.parser.parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  } catch { return; } // JSX/TS 解析错误由主编译器报告。
  const traverse = Babel.packages.traverse.default || Babel.packages.traverse;
  traverse(ast, {
    JSXElement(pathRef) {
      const name = pathRef.node.openingElement.name;
      if (name.type !== 'JSXIdentifier' || name.name !== 'style') { return; }
      for (const child of pathRef.get('children')) {
        const resolved = child.isJSXExpressionContainer() ? resolveStaticCss(child.get('expression')) : null;
        if (!resolved || typeof resolved.text !== 'string') { continue; }
        const issue = findCssStructureIssue(resolved.text);
        if (!issue) { continue; }
        const line = resolved.node.loc.start.line + resolved.text.slice(0, issue.index).split('\n').length - 1;
        throw new CliError(t('publish.canvas_inline_css_invalid', line), {
          code: 'OPENYIDA_CANVAS_INLINE_CSS_INVALID',
          details: { stage: 'canvas_compile', sourcePath: options.sourcePath || '', line, ...issue },
        });
      }
    },
  });
}

module.exports = { assertInlineCssStructure, findCssStructureIssue };
