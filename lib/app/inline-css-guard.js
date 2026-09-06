'use strict';

const Babel = require('@babel/standalone');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');

// 检查 CSS 的结构闭合，避免一个未闭合 var() 吞掉后续规则。
// 不执行页面代码，也不把动态插值当成完整 CSS 进行猜测性校验。
function findCssStructureIssue(css) {
  const stack = [];
  const pairs = { '(': ')', '[': ']', '{': '}' };
  for (let index = 0; index < css.length; index++) {
    const char = css[index];
    if (char === '\\') { index++; continue; }
    if (char === '/' && css[index + 1] === '*') {
      const end = css.indexOf('*/', index + 2);
      if (end < 0) { return { index, type: 'unclosed_comment' }; }
      index = end + 1;
    } else if (char === '"' || char === "'") {
      const start = index;
      for (index++; index < css.length; index++) {
        if (css[index] === '\\') { index++; continue; }
        if (css[index] === char) { break; }
      }
      if (index >= css.length) { return { index: start, type: 'unclosed_string' }; }
    } else if (pairs[char]) {
      stack.push({ char, index });
    } else if (')]}'.includes(char)) {
      const open = stack.pop();
      if (!open || pairs[open.char] !== char) {
        return { index: open ? open.index : index, type: 'mismatched_delimiter', expected: open && pairs[open.char], actual: char };
      }
    }
  }
  const open = stack.pop();
  return open ? { index: open.index, type: 'unclosed_delimiter', expected: pairs[open.char] } : null;
}

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
