'use strict';

const Babel = require('@babel/standalone');

const parser = Babel.packages.parser;
const traverse = Babel.packages.traverse.default || Babel.packages.traverse;

const FORM_ROUTE_PATTERN = /\/(?:submission|formDetail)\//i;
const FORM_URL_NAME_PATTERN = /(?:submit|submission|detail|formOpen|form|workbench|management|dataManagement)Url|formHref|detailHref|submitHref|managementHref|buildWorkbenchUrl/i;
const FORM_OPEN_MODE_OVERRIDE_PATTERN = /@openyida-form-open-mode\s+(?:page|new-tab)\b/i;

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

function literalContainsFormRoute(node) {
  if (!node) {
    return false;
  }
  if (node.type === 'StringLiteral') {
    return FORM_ROUTE_PATTERN.test(node.value || '');
  }
  if (node.type === 'TemplateLiteral') {
    return node.quasis.some((quasi) => FORM_ROUTE_PATTERN.test((quasi.value && (quasi.value.cooked || quasi.value.raw)) || ''));
  }
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    return literalContainsFormRoute(node.left) || literalContainsFormRoute(node.right);
  }
  if (node.type === 'ConditionalExpression') {
    return literalContainsFormRoute(node.consequent) || literalContainsFormRoute(node.alternate);
  }
  return false;
}

function isWindowOpenCall(callee) {
  return !!(
    callee &&
    callee.type === 'MemberExpression' &&
    callee.object &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'window' &&
    callee.property &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'open'
  );
}

function isOpenPageCall(callee) {
  return !!(
    callee &&
    callee.type === 'MemberExpression' &&
    callee.property &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'openPage'
  );
}

function isLocationNavigationCall(callee) {
  if (!callee || callee.type !== 'MemberExpression') {
    return false;
  }
  const methodName = callee.property && callee.property.type === 'Identifier' ? callee.property.name : '';
  if (methodName !== 'assign' && methodName !== 'replace') {
    return false;
  }
  if (callee.object && callee.object.type === 'Identifier' && callee.object.name === 'location') {
    return true;
  }
  return !!(
    callee.object &&
    callee.object.type === 'MemberExpression' &&
    callee.object.object &&
    callee.object.object.type === 'Identifier' &&
    callee.object.object.name === 'window' &&
    callee.object.property &&
    callee.object.property.type === 'Identifier' &&
    callee.object.property.name === 'location'
  );
}

function isLocationHrefAssignment(node) {
  if (!node || node.type !== 'AssignmentExpression' || node.operator !== '=') {
    return false;
  }
  const left = node.left;
  if (!left || left.type !== 'MemberExpression') {
    return false;
  }
  if (!left.property || left.property.type !== 'Identifier' || left.property.name !== 'href') {
    return false;
  }
  if (left.object && left.object.type === 'Identifier' && left.object.name === 'location') {
    return true;
  }
  return !!(
    left.object &&
    left.object.type === 'MemberExpression' &&
    left.object.object &&
    left.object.object.type === 'Identifier' &&
    left.object.object.name === 'window' &&
    left.object.property &&
    left.object.property.type === 'Identifier' &&
    left.object.property.name === 'location'
  );
}

function expressionLooksLikeFormUrl(node, sourceCode, knownFormUrlNames) {
  if (!node) {
    return false;
  }
  if (literalContainsFormRoute(node)) {
    return true;
  }
  if (node.type === 'Identifier') {
    return knownFormUrlNames.has(node.name) || FORM_URL_NAME_PATTERN.test(node.name);
  }
  if (node.type === 'CallExpression') {
    return FORM_URL_NAME_PATTERN.test(getNodeText(sourceCode, node.callee));
  }
  return FORM_ROUTE_PATTERN.test(getNodeText(sourceCode, node));
}

function findJsxAttribute(node, name) {
  return (node && node.attributes || []).find((attribute) => (
    attribute &&
    attribute.type === 'JSXAttribute' &&
    attribute.name &&
    attribute.name.name === name
  ));
}

function getJsxAttributeValue(attribute) {
  if (!attribute || !attribute.value) {
    return null;
  }
  if (attribute.value.type === 'StringLiteral') {
    return attribute.value;
  }
  if (attribute.value.type === 'JSXExpressionContainer') {
    return attribute.value.expression;
  }
  return null;
}

function findDirectFormOpenIssues(sourceCode, options = {}) {
  if (typeof sourceCode !== 'string' || sourceCode.trim() === '') {
    return [];
  }
  if (FORM_OPEN_MODE_OVERRIDE_PATTERN.test(sourceCode)) {
    return [];
  }

  let ast;
  try {
    ast = parser.parse(sourceCode, options.parserOptions || DEFAULT_PARSER_OPTIONS);
  } catch {
    return [];
  }

  const knownFormUrlNames = new Set();
  traverse(ast, {
    VariableDeclarator(pathRef) {
      const id = pathRef.node.id;
      if (!id || id.type !== 'Identifier') {
        return;
      }
      if (literalContainsFormRoute(pathRef.node.init) || FORM_URL_NAME_PATTERN.test(id.name)) {
        knownFormUrlNames.add(id.name);
      }
    },
    AssignmentExpression(pathRef) {
      const left = pathRef.node.left;
      if (!left || left.type !== 'Identifier') {
        return;
      }
      if (expressionLooksLikeFormUrl(pathRef.node.right, sourceCode, knownFormUrlNames)) {
        knownFormUrlNames.add(left.name);
      }
    },
  });

  const issues = [];
  traverse(ast, {
    CallExpression(pathRef) {
      const callee = pathRef.node.callee;
      if (!isWindowOpenCall(callee) && !isOpenPageCall(callee) && !isLocationNavigationCall(callee)) {
        return;
      }
      const firstArg = pathRef.node.arguments && pathRef.node.arguments[0];
      if (!expressionLooksLikeFormUrl(firstArg, sourceCode, knownFormUrlNames)) {
        return;
      }
      issues.push({
        line: getNodeLine(pathRef.node),
        callee: getNodeText(sourceCode, callee),
      });
    },
    AssignmentExpression(pathRef) {
      if (!isLocationHrefAssignment(pathRef.node)) {
        return;
      }
      if (!expressionLooksLikeFormUrl(pathRef.node.right, sourceCode, knownFormUrlNames)) {
        return;
      }
      issues.push({
        line: getNodeLine(pathRef.node),
        callee: getNodeText(sourceCode, pathRef.node.left),
      });
    },
    JSXOpeningElement(pathRef) {
      const hrefAttribute = findJsxAttribute(pathRef.node, 'href');
      const hrefValue = getJsxAttributeValue(hrefAttribute);
      if (!expressionLooksLikeFormUrl(hrefValue, sourceCode, knownFormUrlNames)) {
        return;
      }
      const tagName = pathRef.node.name && pathRef.node.name.name
        ? pathRef.node.name.name
        : 'component';
      issues.push({
        line: getNodeLine(pathRef.node),
        callee: `<${tagName} href>`,
      });
    },
  });

  return issues;
}

function formatDirectFormOpenMessage() {
  return '自定义页内打开表单提交、详情或数据管理页必须使用 FormOpenContainer 抽屉。数据管理 URL 使用 workbench/{formUuid}?hideLeftNav=true&corpid={corpId}。按钮事件请调用 openForm(request)，不要使用 href、window.open、openPage 或 window.location。';
}

module.exports = {
  findDirectFormOpenIssues,
  formatDirectFormOpenMessage,
};
