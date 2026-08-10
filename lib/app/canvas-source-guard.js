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

const ANT_DESIGN_ICON_HELPERS = new Set([
  'IconProvider', 'createFromIconfontCN', 'getTwoToneColor', 'setTwoToneColor',
]);

const ANT_DESIGN_ICON_SUGGESTIONS = Object.freeze({
  Building: 'BankOutlined',
  Calendar: 'CalendarOutlined',
  Car: 'CarOutlined',
  Clock: 'ClockCircleOutlined',
  Coffee: 'CoffeeOutlined',
  Environment: 'EnvironmentOutlined',
  Expand: 'ExpandOutlined',
  Home: 'HomeOutlined',
  Mail: 'MailOutlined',
  Phone: 'PhoneOutlined',
  Search: 'SearchOutlined',
  Star: 'StarOutlined',
  Thunderbolt: 'ThunderboltOutlined',
  Trophy: 'TrophyOutlined',
  User: 'UserOutlined',
  Wifi: 'WifiOutlined',
});

const CONTROL_EVENT_REQUIREMENTS = Object.freeze({
  'Checkbox': ['onChange'],
  'Checkbox.Group': ['onChange'],
  'DatePicker': ['onChange'],
  'DatePicker.RangePicker': ['onChange'],
  'Dropdown.Button': ['onClick'],
  'Input': ['onChange', 'onPressEnter'],
  'Input.Search': ['onSearch', 'onPressEnter', 'onChange'],
  'Menu': ['onClick', 'onSelect'],
  'Pagination': ['onChange'],
  'Radio.Group': ['onChange'],
  'Segmented': ['onChange'],
  'Select': ['onChange'],
  'Slider': ['onChange'],
  'Switch': ['onChange'],
  'Tabs': ['onChange'],
  'Tree': ['onSelect', 'onCheck'],
  'Typography.Link': ['onClick'],
  'Upload': ['onChange'],
});

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

function objectExpressionHasPointerCursor(expression) {
  if (!expression || expression.type !== 'ObjectExpression') {return false;}
  return expression.properties.some((property) => {
    if (property.type !== 'ObjectProperty') {return false;}
    const key = property.key && (property.key.name || property.key.value);
    const value = property.value && property.value.value;
    return key === 'cursor' && String(value || '').toLowerCase() === 'pointer';
  });
}

function collectPointerStyleRefs(ast) {
  const refs = new Set();

  traverse(ast, {
    VariableDeclarator(pathRef) {
      const node = pathRef.node;
      if (!node.id || node.id.type !== 'Identifier' || !node.init || node.init.type !== 'ObjectExpression') {
        return;
      }

      if (objectExpressionHasPointerCursor(node.init)) {
        refs.add(node.id.name);
      }

      node.init.properties.forEach((property) => {
        if (property.type !== 'ObjectProperty' || property.value.type !== 'ObjectExpression') {
          return;
        }
        if (!objectExpressionHasPointerCursor(property.value)) {
          return;
        }
        const key = property.key && (property.key.name || property.key.value);
        if (key) {
          refs.add(`${node.id.name}.${key}`);
        }
      });
    },
  });

  return refs;
}

function hasPointerStyle(attrs, source, pointerStyleRefs) {
  const style = findAttribute(attrs, 'style');
  if (!style || !style.value || style.value.type !== 'JSXExpressionContainer') {return false;}
  const expression = style.value.expression;
  if (objectExpressionHasPointerCursor(expression)) {return true;}
  const expressionText = nodeSource(source, expression);
  return pointerStyleRefs.has(expressionText);
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

function getImportedName(specifier) {
  if (!specifier || specifier.type !== 'ImportSpecifier') {return '';}
  return specifier.imported && (specifier.imported.name || specifier.imported.value) || '';
}

function isValidAntDesignIconImport(name) {
  return ANT_DESIGN_ICON_HELPERS.has(name) || /(?:Outlined|Filled|TwoTone)$/.test(name);
}

function stripComments(source) {
  return String(source || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function sourceReadsFormDatas(source) {
  return /\bsearchFormDatas\s*\(|searchFormDatas\.json/.test(stripComments(source));
}

function nodeSource(source, node) {
  if (!node || typeof node.start !== 'number' || typeof node.end !== 'number') {
    return '';
  }
  return String(source || '').slice(node.start, node.end);
}

function getIdentifierRoot(node) {
  let current = node;
  while (current && current.type === 'MemberExpression') {
    current = current.object;
  }
  return current && current.type === 'Identifier' ? current.name : '';
}

function isFormDataContainer(node) {
  if (!node) {return false;}
  if (node.type === 'Identifier') {
    return node.name === 'formData';
  }
  if (node.type !== 'MemberExpression') {
    return false;
  }
  const property = node.property;
  const propertyName = property && (property.name || property.value);
  return propertyName === 'formData';
}

function isYidaFieldKeyExpression(source, node) {
  if (!node) {return false;}
  const root = getIdentifierRoot(node);
  if (['FIELD', 'FIELDS', 'fields', 'fieldIds', 'fieldMap'].includes(root)) {
    return true;
  }
  if (node.type === 'Identifier' && /field(?:Id|Uuid|Key)$/i.test(node.name)) {
    return true;
  }
  const text = nodeSource(source, node);
  return /\b(?:text|textarea|number|radio|select|date|employee|department|cascade|checkbox|image|attachment|table|address|phone|money)Field_[A-Za-z0-9_]+\b/.test(text);
}

function findCanvasSourceIssues(source) {
  const ast = parseSource(source);
  const pointerClassNames = extractPointerClassNames(source);
  const pointerStyleRefs = collectPointerStyleRefs(ast);
  const readsFormDatas = sourceReadsFormDatas(source);
  const issues = [];

  traverse(ast, {
    ImportDeclaration(pathRef) {
      if (!pathRef.node.source || pathRef.node.source.value !== '@ant-design/icons') {return;}
      for (const specifier of pathRef.node.specifiers || []) {
        const importedName = getImportedName(specifier);
        if (!importedName || isValidAntDesignIconImport(importedName)) {continue;}
        issues.push({
          type: 'invalid-ant-design-icon-import',
          importedName,
          localName: specifier.local && specifier.local.name || importedName,
          suggestedName: ANT_DESIGN_ICON_SUGGESTIONS[importedName] || '',
          line: getNodeLine(specifier),
        });
      }
    },
    MemberExpression(pathRef) {
      if (!readsFormDatas || !pathRef.node.computed) {return;}
      if (isFormDataContainer(pathRef.node.object)) {return;}
      if (/\.formData\b/.test(nodeSource(source, pathRef.node.object))) {return;}
      if (!isYidaFieldKeyExpression(source, pathRef.node.property)) {return;}
      issues.push({
        type: 'form-row-direct-field-read',
        expression: nodeSource(source, pathRef.node),
        fieldExpression: nodeSource(source, pathRef.node.property),
        line: getNodeLine(pathRef.node),
      });
    },
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
      const pointerAffordance = hasPointerStyle(attrs, source, pointerStyleRefs) || usesPointerClass(attrs, pointerClassNames);
      let requiredEvents = null;
      let actionType = elementName;

      if (elementName === 'button' || elementName === 'Button') {
        if (hasSubmitBehavior(elementName, attrs) || hasUsableHref(attrs)) {return;}
        requiredEvents = ['onClick', 'onMouseDown', 'onKeyDown'];
      } else if (elementName === 'a') {
        if (hasUsableHref(attrs)) {return;}
        requiredEvents = ['onClick', 'onKeyDown'];
      } else if (CONTROL_EVENT_REQUIREMENTS[elementName]) {
        if (elementName === 'Typography.Link' && hasUsableHref(attrs)) {return;}
        requiredEvents = CONTROL_EVENT_REQUIREMENTS[elementName];
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
  if (issue.type === 'invalid-ant-design-icon-import') {
    const antSuggestion = issue.suggestedName
      ? `可改为 ${issue.suggestedName}`
      : '请选择该包实际导出的 Outlined、Filled 或 TwoTone 图标名';
    return `@ant-design/icons 不导出 ${issue.importedName}。${antSuggestion}，`
      + '或把同名图标改为从 lucide-react 导入。不要把 lucide-react 的图标名写到 @ant-design/icons import 中。';
  }
  if (issue.type === 'unbound-component') {
    const importHint = issue.importExample
      ? `请补充标准导入：${issue.importExample}`
      : `请 import 或在源码中定义 ${issue.componentName}。`;
    return `Code Canvas JSX 组件 ${issue.componentName} 未声明。${importHint}`
      + ' 所有 JSX 组件都必须有明确的 import 或本地定义，避免发布后出现 is not defined。';
  }
  if (issue.type === 'form-row-direct-field-read') {
    return `Code Canvas 读取 searchFormDatas 返回行时不能直接写 ${issue.expression}。`
      + '接口字段值在 row.formData[fieldId]；请改成 fieldOf(row, fieldId) '
      + '或先取 var formData = row.formData || {} 后读取 formData[fieldId]。';
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
  const code = issue.type === 'invalid-ant-design-icon-import'
    ? 'OPENYIDA_CANVAS_INVALID_ANT_ICON_IMPORT'
    : issue.type === 'unbound-component'
      ? 'OPENYIDA_CANVAS_UNBOUND_COMPONENT'
      : issue.type === 'form-row-direct-field-read'
        ? 'OPENYIDA_CANVAS_FORM_ROW_DIRECT_FIELD_READ'
        : 'OPENYIDA_CANVAS_INTERACTION_INCOMPLETE';
  throw new CliError(formatCanvasSourceIssue(issue), {
    code,
    details: {
      stage: 'canvas_compile',
      sourcePath: options.sourcePath || '',
      line: issue.line,
      issueType: issue.type,
      componentName: issue.componentName || '',
      expression: issue.expression || '',
      fieldExpression: issue.fieldExpression || '',
      importedName: issue.importedName || '',
      localName: issue.localName || '',
      suggestedName: issue.suggestedName || '',
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
