'use strict';

const Babel = require('@babel/standalone');
const { CliError } = require('../core/cli-error');

const parser = Babel.packages.parser;
const traverse = Babel.packages.traverse.default || Babel.packages.traverse;

const PARSER_OPTIONS = {
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

const ANTD_COMPONENTS = new Set([
  'Alert', 'App', 'Avatar', 'Badge', 'Breadcrumb', 'Button', 'Card', 'Carousel',
  'Checkbox', 'Collapse', 'ConfigProvider', 'DatePicker', 'Descriptions', 'Divider',
  'Drawer', 'Dropdown', 'Empty', 'Flex', 'Form', 'Image', 'Input', 'List', 'Menu',
  'Modal', 'Pagination', 'Popconfirm', 'Popover', 'Progress', 'Radio', 'Result',
  'Row', 'Col', 'Segmented', 'Select', 'Skeleton', 'Slider', 'Space', 'Spin', 'Steps',
  'Switch', 'Table', 'Tabs', 'Tag', 'Timeline', 'Tooltip', 'Tree', 'Typography', 'Upload',
]);

const RECHARTS_COMPONENTS = new Set([
  'Area', 'AreaChart', 'Bar', 'BarChart', 'CartesianGrid', 'Cell', 'ComposedChart',
  'Funnel', 'FunnelChart', 'Label', 'Legend', 'Line', 'LineChart', 'Pie', 'PieChart',
  'PolarAngleAxis', 'PolarGrid', 'PolarRadiusAxis', 'Radar', 'RadarChart', 'RadialBar',
  'RadialBarChart', 'ReferenceArea', 'ReferenceLine', 'ResponsiveContainer', 'Scatter',
  'ScatterChart', 'Tooltip', 'Treemap', 'XAxis', 'YAxis', 'ZAxis',
]);

function parseSource(source) {
  return parser.parse(String(source || ''), PARSER_OPTIONS);
}

function getNodeLine(node) {
  return node && node.loc && node.loc.start ? node.loc.start.line : 0;
}

function getJsxName(node) {
  if (!node) {return '';}
  if (node.type === 'JSXIdentifier') {return node.name;}
  if (node.type === 'JSXMemberExpression') {
    const left = getJsxName(node.object);
    const right = getJsxName(node.property);
    return left && right ? `${left}.${right}` : left || right;
  }
  return '';
}

function getRootJsxName(node) {
  let current = node;
  while (current && current.type === 'JSXMemberExpression') {
    current = current.object;
  }
  return current && current.type === 'JSXIdentifier' ? current.name : '';
}

function getAttributeName(attr) {
  return attr && attr.type === 'JSXAttribute' && attr.name ? attr.name.name || '' : '';
}

function findAttribute(attrs, name) {
  return (attrs || []).find((attr) => getAttributeName(attr) === name) || null;
}

function getStaticAttributeValue(attr) {
  if (!attr || attr.type !== 'JSXAttribute') {return '';}
  if (!attr.value) {return true;}
  if (attr.value.type === 'StringLiteral') {return attr.value.value;}
  if (attr.value.type !== 'JSXExpressionContainer') {return '';}
  const expression = attr.value.expression;
  if (!expression) {return '';}
  if (expression.type === 'StringLiteral' || expression.type === 'BooleanLiteral') {
    return expression.value;
  }
  return '';
}

function isDisabled(attrs) {
  const attr = findAttribute(attrs, 'disabled') || findAttribute(attrs, 'aria-disabled');
  if (!attr) {return false;}
  const value = getStaticAttributeValue(attr);
  return value === true || value === 'true';
}

function hasUsableHref(attrs) {
  const attr = findAttribute(attrs, 'href');
  if (!attr || !attr.value) {return false;}
  if (attr.value.type === 'StringLiteral') {
    const value = attr.value.value.trim().toLowerCase();
    return value !== '' && value !== '#' && !value.startsWith('javascript:');
  }
  return attr.value.type === 'JSXExpressionContainer' &&
    attr.value.expression &&
    attr.value.expression.type !== 'NullLiteral' &&
    attr.value.expression.type !== 'BooleanLiteral';
}

function isNoopHandlerExpression(expression) {
  if (!expression) {return true;}
  if (expression.type === 'CallExpression') {return true;}
  if (expression.type !== 'ArrowFunctionExpression' && expression.type !== 'FunctionExpression') {
    return false;
  }
  if (expression.body.type === 'Identifier' || expression.body.type === 'MemberExpression') {
    return true;
  }
  if (expression.body.type !== 'BlockStatement') {return false;}
  if (expression.body.body.length === 0) {return true;}
  return expression.body.body.every((statement) => (
    statement.type === 'ExpressionStatement' &&
    (statement.expression.type === 'Identifier' || statement.expression.type === 'MemberExpression')
  ));
}

function getHandlerState(attrs, eventNames) {
  const eventAttrs = eventNames
    .map((name) => findAttribute(attrs, name))
    .filter(Boolean);
  if (eventAttrs.length === 0) {return 'missing';}
  const hasValid = eventAttrs.some((attr) => (
    attr.value &&
    attr.value.type === 'JSXExpressionContainer' &&
    !isNoopHandlerExpression(attr.value.expression)
  ));
  return hasValid ? 'valid' : 'invalid';
}

function hasSubmitBehavior(elementName, attrs) {
  const name = elementName === 'Button' ? 'htmlType' : 'type';
  const value = String(getStaticAttributeValue(findAttribute(attrs, name)) || '').toLowerCase();
  return value === 'submit' || value === 'reset';
}

function hasPointerStyle(attrs) {
  const style = findAttribute(attrs, 'style');
  if (!style || !style.value || style.value.type !== 'JSXExpressionContainer') {return false;}
  const expression = style.value.expression;
  if (!expression || expression.type !== 'ObjectExpression') {return false;}
  return expression.properties.some((property) => {
    if (property.type !== 'ObjectProperty') {return false;}
    const key = property.key && (property.key.name || property.key.value);
    const value = property.value && property.value.value;
    return key === 'cursor' && String(value || '').toLowerCase() === 'pointer';
  });
}

function extractPointerClassNames(source) {
  const names = new Set();
  const pattern = /\.([A-Za-z_][\w-]*)[^{}]*\{[^{}]*\bcursor\s*:\s*pointer\b[^{}]*\}/gi;
  let match;
  while ((match = pattern.exec(String(source || ''))) !== null) {
    names.add(match[1]);
  }
  return names;
}

function usesPointerClass(attrs, pointerClassNames) {
  if (pointerClassNames.size === 0) {return false;}
  const className = findAttribute(attrs, 'className');
  const value = getStaticAttributeValue(className);
  if (typeof value !== 'string') {return false;}
  return value.split(/\s+/).some((name) => pointerClassNames.has(name));
}

function inferImport(componentName) {
  if (ANTD_COMPONENTS.has(componentName)) {
    return `import { ${componentName} } from 'antd';`;
  }
  if (RECHARTS_COMPONENTS.has(componentName)) {
    return `import { ${componentName} } from 'recharts';`;
  }
  if (/Outlined$|Filled$|TwoTone$/.test(componentName)) {
    return `import { ${componentName} } from '@ant-design/icons';`;
  }
  return '';
}

function findCanvasSourceIssues(source) {
  const ast = parseSource(source);
  const pointerClassNames = extractPointerClassNames(source);
  const issues = [];

  traverse(ast, {
    JSXOpeningElement(pathRef) {
      const node = pathRef.node;
      const elementName = getJsxName(node.name);
      const rootName = getRootJsxName(node.name);
      const attrs = node.attributes || [];
      const line = getNodeLine(node);

      if (rootName && /^[A-Z]/.test(rootName) && !pathRef.scope.hasBinding(rootName)) {
        issues.push({
          type: 'unbound-component',
          componentName: rootName,
          importExample: inferImport(rootName),
          line,
        });
        return;
      }

      if (isDisabled(attrs)) {return;}

      const role = String(getStaticAttributeValue(findAttribute(attrs, 'role')) || '').toLowerCase();
      const hoverable = getStaticAttributeValue(findAttribute(attrs, 'hoverable')) === true;
      const pointerAffordance = hasPointerStyle(attrs) || usesPointerClass(attrs, pointerClassNames);
      let requiredEvents = null;
      let actionType = elementName;

      if (elementName === 'button' || elementName === 'Button') {
        if (hasSubmitBehavior(elementName, attrs) || hasUsableHref(attrs)) {return;}
        requiredEvents = ['onClick', 'onMouseDown', 'onKeyDown'];
      } else if (elementName === 'a') {
        if (hasUsableHref(attrs)) {return;}
        requiredEvents = ['onClick', 'onKeyDown'];
      } else if (elementName === 'Input.Search' || elementName === 'SearchInput') {
        requiredEvents = ['onSearch', 'onPressEnter', 'onChange'];
        actionType = 'search';
      } else if (role === 'button' || hoverable || pointerAffordance) {
        requiredEvents = ['onClick', 'onMouseDown', 'onKeyDown'];
        actionType = role === 'button' ? 'role="button"' : elementName || 'element';
      }

      if (!requiredEvents) {return;}
      const handlerState = getHandlerState(attrs, requiredEvents);
      if (handlerState !== 'valid') {
        issues.push({
          type: handlerState === 'invalid' ? 'invalid-handler' : 'missing-handler',
          elementName: actionType,
          expectedEvents: requiredEvents,
          line,
        });
      }
    },
  });

  return issues;
}

function formatCanvasSourceIssue(issue) {
  if (issue.type === 'unbound-component') {
    const importHint = issue.importExample
      ? `请补充标准导入：${issue.importExample}`
      : `请 import 或在源码中定义 ${issue.componentName}。`;
    return `Code Canvas JSX 组件 ${issue.componentName} 未声明。${importHint}`
      + ' 所有 JSX 组件都必须有明确的 import 或本地定义，避免发布后出现 is not defined。';
  }
  const events = issue.expectedEvents.join('、');
  const primaryEvent = issue.expectedEvents[0] || 'onClick';
  if (issue.type === 'invalid-handler') {
    return `Code Canvas 交互元素 <${issue.elementName}> 的事件写法不会执行。`
      + `请传入会实际执行动作的函数，例如 ${primaryEvent}={() => doAction()}。`;
  }
  return `Code Canvas 交互元素 <${issue.elementName}> 没有事件处理。`
    + `请绑定 ${events}，或去掉按钮、搜索、hoverable、role="button"、cursor:pointer 等可点击外观。`;
}

function assertCanvasSourceContracts(source, options = {}) {
  const issues = findCanvasSourceIssues(source);
  if (issues.length === 0) {return;}
  const issue = issues[0];
  const code = issue.type === 'unbound-component'
    ? 'OPENYIDA_CANVAS_UNBOUND_COMPONENT'
    : 'OPENYIDA_CANVAS_INTERACTION_INCOMPLETE';
  throw new CliError(formatCanvasSourceIssue(issue), {
    code,
    details: {
      stage: 'canvas_compile',
      sourcePath: options.sourcePath || '',
      line: issue.line,
      issueType: issue.type,
      componentName: issue.componentName || '',
      elementName: issue.elementName || '',
      expectedEvents: issue.expectedEvents || [],
    },
  });
}

module.exports = {
  assertCanvasSourceContracts,
  findCanvasSourceIssues,
  formatCanvasSourceIssue,
};
