'use strict';

const Babel = require('../core/babel');

const parser = Babel.packages.parser;
const traverse = Babel.packages.traverse.default || Babel.packages.traverse;

const CJK_IDENTIFIER_PATTERN = /[\u3400-\u9FFF\uF900-\uFAFF]/;

const DEFAULT_PARSER_OPTIONS = {
  sourceType: 'module',
  plugins: [
    'jsx',
    'typescript',
    'objectRestSpread',
    'classProperties',
    'optionalChaining',
    'nullishCoalescingOperator',
  ],
};

function getNodeLine(node) {
  return node && node.loc && node.loc.start ? node.loc.start.line : 1;
}

function isBareCjkIdentifier(node) {
  return !!(
    node &&
    node.type === 'Identifier' &&
    CJK_IDENTIFIER_PATTERN.test(node.name)
  );
}

function findBareCjkJsxTextIdentifiers(sourceCode, options = {}) {
  if (typeof sourceCode !== 'string' || sourceCode.trim() === '') {
    return [];
  }

  let ast;
  try {
    ast = parser.parse(sourceCode, options.parserOptions || DEFAULT_PARSER_OPTIONS);
  } catch {
    return [];
  }

  const issues = [];
  traverse(ast, {
    JSXExpressionContainer(pathRef) {
      const expression = pathRef.node.expression;
      if (!isBareCjkIdentifier(expression)) {
        return;
      }
      issues.push({
        line: getNodeLine(pathRef.node),
        name: expression.name,
      });
    },
  });
  return issues;
}

function formatBareCjkJsxTextMessage(name) {
  return `JSX 中文文案不能写成 {${name}}，这会被当作变量并导致 ${name} is not defined；请改成纯文本 ${name} 或字符串 {'${name}'}。`;
}

module.exports = {
  findBareCjkJsxTextIdentifiers,
  formatBareCjkJsxTextMessage,
};
