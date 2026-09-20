'use strict';

const Babel = require('@babel/standalone');
const { t } = require('../core/i18n');

const parser = Babel.packages.parser;
const traverse = Babel.packages.traverse.default || Babel.packages.traverse;

const FORM_ROUTE_PATTERN = /\/(?:submission|formDetail)\//i;
const FORM_URL_NAME_PATTERN = /(?:submit|submission|detail|formOpen|form)Url|formHref|detailHref|submitHref/i;
const MOBILE_GUARD_PATTERN = /isMobile|isMobileViewport|matchMedia|utils\.isMobile|runtime\.isMobile/i;

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

function nodeContains(parent, child) {
  return !!(
    parent &&
    child &&
    typeof parent.start === 'number' &&
    typeof parent.end === 'number' &&
    typeof child.start === 'number' &&
    typeof child.end === 'number' &&
    parent.start <= child.start &&
    parent.end >= child.end
  );
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

function isLocationCall(callee) {
  return callee?.type === 'MemberExpression'
    && ['assign', 'replace'].includes(callee.property?.name)
    && (callee.object?.name === 'location'
      || (callee.object?.object?.name === 'window' && callee.object?.property?.name === 'location'));
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

function isMobileGuarded(pathRef, sourceCode) {
  const mobileCondition = node => {
    if (node?.type === 'UnaryExpression' && node.operator === '!') {return -mobileCondition(node.argument);}
    const text = getNodeText(sourceCode, node);
    if (node?.type === 'Identifier' || node?.type === 'MemberExpression' || node?.type === 'CallExpression') {
      return MOBILE_GUARD_PATTERN.test(text) && !/min-width/.test(text) ? 1 : 0;
    }
    return 0;
  };
  let cursor = pathRef;
  while (cursor && cursor.parentPath) {
    const parent = cursor.parentPath;
    if (['IfStatement', 'ConditionalExpression'].includes(parent.node?.type)) {
      const direction = mobileCondition(parent.node.test);
      if ((direction === 1 && nodeContains(parent.node.consequent, pathRef.node))
        || (direction === -1 && nodeContains(parent.node.alternate, pathRef.node))) {return true;}
    }
    if (parent.node?.type === 'LogicalExpression' && nodeContains(parent.node.right, pathRef.node)) {
      const direction = mobileCondition(parent.node.left);
      if ((parent.node.operator === '&&' && direction === 1)
        || (parent.node.operator === '||' && direction === -1)) {return true;}
    }
    cursor = parent;
  }
  return false;
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

function findDirectFormOpenIssues(sourceCode, options = {}) {
  if (typeof sourceCode !== 'string' || sourceCode.trim() === '') {
    return [];
  }

  let ast;
  try {
    ast = parser.parse(sourceCode, options.parserOptions || DEFAULT_PARSER_OPTIONS);
  } catch {
    return [];
  }

  const knownFormUrlNames = new Set();
  const containerNames = new Set(['formOpenContainer']);
  traverse(ast, {
    VariableDeclarator(pathRef) {
      const id = pathRef.node.id;
      if (id?.type === 'ObjectPattern' && pathRef.node.init?.callee?.name === 'useYidaFormOpen') {
        for (const property of id.properties) {
          if (property.key?.name === 'formOpenContainer' && property.value?.type === 'Identifier') {
            containerNames.add(property.value.name);
          }
        }
      }
      if (!id || id.type !== 'Identifier') {
        return;
      }
      if (literalContainsFormRoute(pathRef.node.init) || FORM_URL_NAME_PATTERN.test(id.name)) {
        knownFormUrlNames.add(id.name);
      }
    },
  });

  const issues = [];
  const templateParts = new Map();
  const templateUses = [];
  let containerRendered = false;
  const functionName = pathRef => {
    const owner = pathRef.getFunctionParent();
    return owner?.node.id?.name || owner?.parentPath?.node.id?.name;
  };
  const addTemplatePart = (owner, part) => {
    if (!templateParts.has(owner)) {templateParts.set(owner, new Set());}
    templateParts.get(owner).add(part);
  };
  traverse(ast, {
    CallExpression(pathRef) {
      const callee = pathRef.node.callee;
      if (callee.type === 'Identifier' && callee.name === 'useYidaFormOpen') {
        templateUses.push(pathRef.node);
      }
      if (callee.type === 'Identifier' && ['openForm', 'setFormRequest'].includes(callee.name)
        && pathRef.node.arguments[0]?.type === 'ObjectExpression'
        && pathRef.node.arguments[0].properties.some(property => (property.key?.name || property.key?.value) === 'type'
          && ['submission', 'detail'].includes(property.value?.value))) {
        templateUses.push(pathRef.node);
      }
      if (!isWindowOpenCall(callee) && !isOpenPageCall(callee) && !isLocationCall(callee)) {
        return;
      }
      const firstArg = pathRef.node.arguments && pathRef.node.arguments[0];
      if (!expressionLooksLikeFormUrl(firstArg, sourceCode, knownFormUrlNames)) {
        return;
      }
      if (isMobileGuarded(pathRef, sourceCode)) {
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
      if (isMobileGuarded(pathRef, sourceCode)) {
        return;
      }
      issues.push({
        line: getNodeLine(pathRef.node),
        callee: getNodeText(sourceCode, pathRef.node.left),
      });
    },
    JSXExpressionContainer(pathRef) {
      if ((pathRef.parentPath.isJSXElement() || pathRef.parentPath.isJSXFragment())
        && containerNames.has(pathRef.node.expression?.name)) {
        containerRendered = true;
      }
    },
    JSXOpeningElement(pathRef) {
      const name = pathRef.node.name?.name;
      const owner = functionName(pathRef);
      addTemplatePart(owner, name);
      if (name === 'FormOpenContainer' && owner !== 'useYidaFormOpen') {
        templateUses.push(pathRef.node);
        containerRendered = true;
      }
      const attribute = key => pathRef.node.attributes.find(item => item.type === 'JSXAttribute' && item.name?.name === key)?.value;
      const value = node => node?.type === 'JSXExpressionContainer' ? node.expression : node;
      if (owner === 'CanvasDrawer' && attribute('className')?.value === 'oy-drawer-resize'
        && attribute('onPointerDown') && attribute('onPointerMove') && attribute('onPointerUp') && attribute('onKeyDown')) {
        addTemplatePart(owner, 'resize-handle');
      }
      if (name === 'a' && expressionLooksLikeFormUrl(value(attribute('href')), sourceCode, knownFormUrlNames)) {
        issues.push({ line: getNodeLine(pathRef.node), callee: 'a[href]' });
      }
      if (!['iframe', 'YidaCanvasIframe'].includes(name) || owner === 'FormOpenContainer') {return;}
      if (!expressionLooksLikeFormUrl(value(attribute('src')), sourceCode, knownFormUrlNames)) {return;}
      // 导航主内容可以嵌原生页；弹层内的表单必须使用提供的容器。
      const overlay = pathRef.findParent(parent => parent.isJSXElement() && (
        ['Drawer', 'Modal', 'CanvasDrawer'].includes(parent.node.openingElement.name?.name)
        || parent.node.openingElement.attributes.some(item => item.type === 'JSXAttribute'
          && ((item.name?.name === 'role' && item.value?.value === 'dialog')
            || (item.name?.name === 'style' && /position\s*:\s*['"]fixed['"]/.test(getNodeText(sourceCode, item.value)))))));
      if (overlay) {issues.push({ line: getNodeLine(pathRef.node), callee: `${name} outside FormOpenContainer` });}
    },
  });

  if (templateUses.length) {
    const hasParts = (owner, parts) => parts.every(part => templateParts.get(owner)?.has(part));
    const complete = hasParts('FormOpenContainer', ['CanvasDrawer', 'iframe'])
      && hasParts('CanvasDrawer', ['Drawer', 'ExternalLink', 'Maximize2', 'Minimize2', 'X', 'resize-handle'])
      && hasParts('useYidaFormOpen', ['FormOpenContainer']) && containerRendered;
    if (!complete) {
      issues.push({ line: getNodeLine(templateUses[0]), callee: 'incomplete FormOpenContainer template' });
    }
  }

  return issues;
}

function formatDirectFormOpenMessage() {
  return t('publish.lint_form_open_container');
}

module.exports = {
  findDirectFormOpenIssues,
  formatDirectFormOpenMessage,
};
