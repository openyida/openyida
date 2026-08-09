'use strict';

const Babel = require('@babel/standalone');

const parser = Babel.packages.parser;
const traverse = Babel.packages.traverse.default || Babel.packages.traverse;

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

function getNodeText(sourceCode, node) {
  if (!node || typeof node.start !== 'number' || typeof node.end !== 'number') {
    return '';
  }
  return sourceCode.slice(node.start, node.end);
}

function stringValue(node) {
  if (!node) {
    return '';
  }
  if (node.type === 'StringLiteral') {
    return node.value || '';
  }
  if (node.type === 'TemplateLiteral') {
    return node.quasis.map((quasi) => (quasi.value && (quasi.value.cooked || quasi.value.raw)) || '').join('${}');
  }
  return '';
}

function propertyName(property) {
  if (!property) {
    return '';
  }
  const key = property.key || property.property;
  if (!key) {
    return '';
  }
  if (key.type === 'Identifier') {
    return key.name;
  }
  if (key.type === 'StringLiteral') {
    return key.value;
  }
  return '';
}

function findObjectProperty(objectNode, name) {
  if (!objectNode || objectNode.type !== 'ObjectExpression') {
    return null;
  }
  return objectNode.properties.find((property) => (
    property &&
    property.type === 'ObjectProperty' &&
    propertyName(property) === name
  )) || null;
}

function isDetailRequestObject(objectNode) {
  const typeProperty = findObjectProperty(objectNode, 'type') || findObjectProperty(objectNode, 'targetType');
  return !!(typeProperty && stringValue(typeProperty.value) === 'detail');
}

function expressionMayBeEmptyFallback(node, sourceCode) {
  if (!node) {
    return false;
  }
  if (node.type === 'StringLiteral') {
    return node.value === '';
  }
  if (node.type === 'NullLiteral') {
    return true;
  }
  if (node.type === 'Identifier' && node.name === 'undefined') {
    return true;
  }
  if (
    (node.type === 'LogicalExpression' || node.type === 'BinaryExpression') &&
    (node.operator === '||' || node.operator === '??')
  ) {
    return expressionMayBeEmptyFallback(node.right, sourceCode);
  }
  return /\|\|\s*['"]['"]|\?\?\s*['"]['"]/.test(getNodeText(sourceCode, node));
}

function expressionUsesPrimaryFormInstId(node, sourceCode) {
  return /(?:^|[^A-Za-z0-9_$])formInstId(?:[^A-Za-z0-9_$]|$)/.test(getNodeText(sourceCode, node));
}

function sourceHasDetailRoute(sourceCode) {
  return /\/formDetail\//.test(sourceCode) || /targetType\s*:\s*['"]detail['"]/.test(sourceCode) || /type\s*:\s*['"]detail['"]/.test(sourceCode);
}

function sourceHasPrimaryRowFormInstId(sourceCode) {
  return /\.\s*formInstId\b|\[\s*['"]formInstId['"]\s*\]/.test(sourceCode);
}

function sourceHasLegacyInstanceIdOnly(sourceCode) {
  return /\.\s*(formInstanceId|instanceId|id)\b|\[\s*['"](formInstanceId|instanceId|id)['"]\s*\]/.test(sourceCode);
}

function resolveLocalIdentifier(pathRef, node) {
  if (!node || node.type !== 'Identifier' || !pathRef || !pathRef.scope) {return node;}
  const binding = pathRef.scope.getBinding(node.name);
  const declaration = binding && binding.path && binding.path.node;
  if (declaration && declaration.type === 'VariableDeclarator' && declaration.init) {
    return declaration.init;
  }
  return node;
}

function findFormDetailLinkIssues(sourceCode, options = {}) {
  if (typeof sourceCode !== 'string' || sourceCode.trim() === '' || !sourceHasDetailRoute(sourceCode)) {
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
    ObjectExpression(pathRef) {
      const node = pathRef.node;
      if (!isDetailRequestObject(node)) {
        return;
      }
      const formInstIdProperty = findObjectProperty(node, 'formInstId');
      if (!formInstIdProperty) {
        issues.push({
          type: 'missing-formInstId',
          line: getNodeLine(node),
        });
        return;
      }
      const formInstIdExpression = resolveLocalIdentifier(pathRef, formInstIdProperty.value);
      if (expressionMayBeEmptyFallback(formInstIdExpression, sourceCode)) {
        issues.push({
          type: 'empty-formInstId-fallback',
          line: getNodeLine(formInstIdProperty.value),
        });
      }
      if (!expressionUsesPrimaryFormInstId(formInstIdExpression, sourceCode)) {
        issues.push({
          type: 'missing-primary-formInstId',
          line: getNodeLine(formInstIdProperty.value),
        });
      } else if (sourceHasLegacyInstanceIdOnly(getNodeText(sourceCode, formInstIdExpression))) {
        issues.push({
          type: 'legacy-formInstId-fallback',
          line: getNodeLine(formInstIdProperty.value),
        });
      }
    },
    TemplateLiteral(pathRef) {
      const text = getNodeText(sourceCode, pathRef.node);
      if (!/\/formDetail\//.test(text) || !/formInstId=/.test(text)) {
        return;
      }
      if (/\|\|\s*['"]['"]|\?\?\s*['"]['"]/.test(text)) {
        issues.push({
          type: 'empty-formInstId-fallback',
          line: getNodeLine(pathRef.node),
        });
      }
    },
  });

  if (
    issues.length === 0 &&
    sourceHasLegacyInstanceIdOnly(sourceCode) &&
    !sourceHasPrimaryRowFormInstId(sourceCode)
  ) {
    issues.push({
      type: 'legacy-instance-id-without-formInstId',
      line: 1,
    });
  }

  return issues;
}

function formatFormDetailLinkMessage(issue) {
  if (issue && issue.type === 'missing-formInstId') {
    return '打开表单详情页必须传入真实 formInstId。openForm({ type: "detail", ... }) 不能缺少 formInstId；请先从 searchFormDatas 返回行读取 row.formInstId，再构造详情请求。';
  }
  if (issue && issue.type === 'empty-formInstId-fallback') {
    return '表单详情页 URL 禁止用空字符串兜底 formInstId。缺少实例 ID 时应禁用详情按钮或提示“未找到数据实例”，不要打开空 formInstId 的 formDetail 页面。';
  }
  if (issue && issue.type === 'missing-primary-formInstId') {
    return '表单详情页实例 ID 只能使用 searchFormDatas 返回的 row.formInstId，不能改用 formInstanceId、instanceId 或 id。';
  }
  if (issue && issue.type === 'legacy-formInstId-fallback') {
    return '表单详情页禁止用 formInstanceId、instanceId 或 id 兜底；只读取 row.formInstId，缺失时阻止打开。';
  }
  return '表单详情页实例 ID 只能使用 row.formInstId，并在缺失时阻止打开详情页。';
}

module.exports = {
  findFormDetailLinkIssues,
  formatFormDetailLinkMessage,
};
