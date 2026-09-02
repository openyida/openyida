'use strict';

const fs = require('fs');
const path = require('path');
const Babel = require('@babel/standalone');
const { findProjectRoot } = require('../core/utils');
const { lintYidaSource } = require('./page-linter');
const { warnLargePageSource } = require('./page-size-guard');

const parser = Babel.packages.parser;
const generator = Babel.packages.generator.default || Babel.packages.generator;
const traverse = Babel.packages.traverse.default || Babel.packages.traverse;
const t = Babel.packages.types;

const PARSER_OPTIONS = {
  sourceType: 'module',
  plugins: [
    'jsx',
    'objectRestSpread',
    'classProperties',
    'optionalChaining',
    'nullishCoalescingOperator',
  ],
};

const SUPPORTED_REMOVABLE_IMPORTS = new Set([
  'react',
  'react-dom',
  'lodash',
  'moment',
]);

const SUPPORTED_HOOKS = new Set(['useState', 'useEffect']);
const UNSUPPORTED_HOOK_REPAIRS = Object.freeze({
  useReducer: 'Replace the reducer with supported useState state updates, or move the page to .canvas.jsx when reducer semantics are required.',
  useMemo: 'Compute the derived value with a plain local expression, or move the page to .canvas.jsx when memoization is required.',
  useCallback: 'Use a plain local function, or move the page to .canvas.jsx when stable callback identity is required.',
  useLayoutEffect: 'Use supported useEffect(..., []) for mount-only work, or move the page to .canvas.jsx when layout effects are required.',
});
const REQUIRED_RUNTIME_EXPORTS = {
  getCustomState: [
    'export function getCustomState(key) {',
    '  if (typeof _customState === "undefined") {',
    '    return key ? undefined : {};',
    '  }',
    '  if (key) {',
    '    return _customState[key];',
    '  }',
    '  return Object.assign({}, _customState);',
    '}',
  ].join('\n'),
  setCustomState: [
    'export function setCustomState(newState) {',
    '  if (typeof _customState === "undefined") {',
    '    return;',
    '  }',
    '  Object.keys(newState || {}).forEach(function(key) {',
    '    _customState[key] = newState[key];',
    '  });',
    '  this.forceUpdate();',
    '}',
  ].join('\n'),
  forceUpdate: [
    'export function forceUpdate() {',
    '  this.setState({ timestamp: new Date().getTime() });',
    '}',
  ].join('\n'),
  didMount: 'export function didMount() {}',
  didUnmount: 'export function didUnmount() {}',
};

function parseSource(sourceCode) {
  return parser.parse(sourceCode, PARSER_OPTIONS);
}

function generateCode(node) {
  return generator(node, {
    comments: true,
    compact: false,
    retainLines: false,
  }).code;
}

function hasYidaRenderExport(ast) {
  return ast.program.body.some((statement) => {
    return statement.type === 'ExportNamedDeclaration' &&
      statement.declaration &&
      statement.declaration.type === 'FunctionDeclaration' &&
      statement.declaration.id &&
      statement.declaration.id.name === 'renderJsx';
  });
}

function sourceHasYidaRenderExport(sourceCode) {
  return /export\s+function\s+renderJsx\s*\(/.test(sourceCode || '');
}

function isAuthoringPath(sourcePath) {
  return /\.oyd\.(jsx?|tsx?)$/i.test(sourcePath || '') ||
    /\.openyida\.(jsx?|tsx?)$/i.test(sourcePath || '');
}

function shouldBuildPageSource(sourceCode, sourcePath = '', options = {}) {
  return options.modern === true ||
    isAuthoringPath(sourcePath) ||
    (!sourceHasYidaRenderExport(sourceCode) && /export\s+default\b/.test(sourceCode || ''));
}

function isSupportedRemovableImport(sourceValue) {
  return SUPPORTED_REMOVABLE_IMPORTS.has(String(sourceValue || '').toLowerCase());
}

function makeEventWrapper(memberExpression, leadingArgs = []) {
  const eventParam = t.identifier('e');
  const callArgs = leadingArgs.map(arg => t.cloneNode(arg));
  callArgs.push(t.cloneNode(eventParam));
  return t.arrowFunctionExpression(
    [eventParam],
    t.blockStatement([
      t.expressionStatement(t.callExpression(memberExpression, callArgs)),
    ])
  );
}

function makeTimestampNode() {
  return t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier('div'), [
      t.jsxAttribute(
        t.jsxIdentifier('style'),
        t.jsxExpressionContainer(t.objectExpression([
          t.objectProperty(t.identifier('display'), t.stringLiteral('none')),
        ]))
      ),
    ], false),
    t.jsxClosingElement(t.jsxIdentifier('div')),
    [
      t.jsxExpressionContainer(
        t.logicalExpression(
          '&&',
          t.memberExpression(t.thisExpression(), t.identifier('state')),
          t.memberExpression(
            t.memberExpression(t.thisExpression(), t.identifier('state')),
            t.identifier('timestamp')
          )
        )
      ),
    ],
    false
  );
}

function hasTimestampReference(node) {
  return /\btimestamp\b/.test(generateCode(node));
}

function canInjectTimestampAsChild(node) {
  if (!node || node.type !== 'JSXElement' || node.openingElement.selfClosing) {
    return false;
  }
  if (!node.openingElement.name || node.openingElement.name.type !== 'JSXIdentifier') {
    return false;
  }
  return [
    'div',
    'section',
    'main',
    'article',
    'aside',
    'header',
    'footer',
    'form',
  ].indexOf(node.openingElement.name.name) !== -1;
}

function makeJsxChild(node) {
  if (!node) {
    return t.jsxExpressionContainer(t.nullLiteral());
  }
  if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
    return t.cloneNode(node);
  }
  return t.jsxExpressionContainer(t.cloneNode(node));
}

function ensureTimestampInRenderArgument(argument) {
  if (!argument || hasTimestampReference(argument)) {
    return { node: argument, changed: false };
  }

  if (canInjectTimestampAsChild(argument)) {
    const nextArgument = t.cloneNode(argument);
    nextArgument.children.unshift(makeTimestampNode());
    return { node: nextArgument, changed: true };
  }

  if (argument.type === 'JSXFragment') {
    const nextArgument = t.cloneNode(argument);
    nextArgument.children.unshift(makeTimestampNode());
    return { node: nextArgument, changed: true };
  }

  return {
    node: t.jsxElement(
      t.jsxOpeningElement(t.jsxIdentifier('div'), [], false),
      t.jsxClosingElement(t.jsxIdentifier('div')),
      [
        makeTimestampNode(),
        makeJsxChild(argument),
      ],
      false
    ),
    changed: true,
  };
}

function fixRenderTimestamp(ast, fixes) {
  traverse(ast, {
    FunctionDeclaration(pathRef) {
      if (!pathRef.node.id || pathRef.node.id.name !== 'renderJsx') {
        return;
      }

      const renderPath = pathRef;
      pathRef.traverse({
        Function(innerPath) {
          if (innerPath !== renderPath) {
            innerPath.skip();
          }
        },
        ReturnStatement(returnPath) {
          const result = ensureTimestampInRenderArgument(returnPath.node.argument);
          if (result.changed) {
            returnPath.node.argument = result.node;
            fixes.push({
              rule: 'render-timestamp',
              message: 'Injected hidden timestamp node into renderJsx return branch',
            });
          }
        },
      });
      pathRef.skip();
    },
  });
}

function fixEventHandlers(ast, fixes) {
  traverse(ast, {
    JSXAttribute(pathRef) {
      const attr = pathRef.node;
      if (!attr.name || !/^on[A-Z]/.test(attr.name.name || '')) {
        return;
      }
      if (!attr.value || attr.value.type !== 'JSXExpressionContainer') {
        return;
      }

      const expression = attr.value.expression;
      if (expression && expression.type === 'MemberExpression' && expression.object.type === 'ThisExpression') {
        attr.value.expression = makeEventWrapper(t.cloneNode(expression));
        fixes.push({
          rule: 'event-direct-method',
          message: `Wrapped ${attr.name.name} direct this-method handler`,
        });
        return;
      }

      if (
        expression &&
        expression.type === 'CallExpression' &&
        expression.callee.type === 'MemberExpression' &&
        expression.callee.property &&
        expression.callee.property.name === 'bind' &&
        expression.callee.object &&
        expression.callee.object.type === 'MemberExpression' &&
        expression.callee.object.object.type === 'ThisExpression' &&
        expression.arguments.length > 0 &&
        expression.arguments[0].type === 'ThisExpression'
      ) {
        attr.value.expression = makeEventWrapper(
          t.cloneNode(expression.callee.object),
          expression.arguments.slice(1)
        );
        fixes.push({
          rule: 'event-bind-this',
          message: `Replaced ${attr.name.name} .bind(this) handler`,
        });
      }
    },
  });
}

function fixArrayCallbacks(ast, fixes) {
  const callbackMethods = new Set([
    'map',
    'forEach',
    'filter',
    'find',
    'findIndex',
    'some',
    'every',
    'reduce',
    'sort',
  ]);

  traverse(ast, {
    CallExpression(pathRef) {
      const call = pathRef.node;
      if (
        !call.callee ||
        call.callee.type !== 'MemberExpression' ||
        !call.callee.property ||
        call.callee.property.type !== 'Identifier' ||
        !callbackMethods.has(call.callee.property.name)
      ) {
        return;
      }

      const callback = call.arguments[0];
      if (!callback || callback.type !== 'FunctionExpression') {
        return;
      }

      call.arguments[0] = t.arrowFunctionExpression(
        callback.params.map(param => t.cloneNode(param)),
        t.cloneNode(callback.body),
        callback.async
      );
      fixes.push({
        rule: 'array-callback-arrow',
        message: `Replaced ${call.callee.property.name}(function ...) callback with an arrow function`,
      });
    },
  });
}

function fixVariableDeclarations(ast, fixes) {
  traverse(ast, {
    VariableDeclaration(pathRef) {
      if (pathRef.node.kind === 'const' || pathRef.node.kind === 'let') {
        const originalKind = pathRef.node.kind;
        pathRef.node.kind = 'var';
        fixes.push({
          rule: 'variable-declaration-var',
          message: `Replaced ${originalKind} declaration with var for Yida runtime compatibility`,
        });
      }
    },
  });
}

function renderJsxDeclaresSelf(functionNode) {
  if (!functionNode.body || functionNode.body.type !== 'BlockStatement') {
    return false;
  }
  return functionNode.body.body.some((statement) => {
    return statement.type === 'VariableDeclaration' &&
      statement.declarations.some((declarator) => {
        return declarator.id &&
          declarator.id.type === 'Identifier' &&
          declarator.id.name === 'self' &&
          declarator.init &&
          declarator.init.type === 'ThisExpression';
      });
  });
}

// 决策 B：只在 renderJsx 顶部插入 var self = this;（幂等），不自动改写 this→self。
function fixSelfBinding(ast, fixes) {
  traverse(ast, {
    FunctionDeclaration(pathRef) {
      if (!pathRef.node.id || pathRef.node.id.name !== 'renderJsx') {
        return;
      }
      const body = pathRef.node.body;
      if (!body || body.type !== 'BlockStatement') {
        pathRef.skip();
        return;
      }
      if (!renderJsxDeclaresSelf(pathRef.node)) {
        body.body.unshift(
          t.variableDeclaration('var', [
            t.variableDeclarator(t.identifier('self'), t.thisExpression()),
          ])
        );
        fixes.push({
          rule: 'self-binding-inserted',
          message: 'Inserted var self = this; at the top of renderJsx',
        });
      }
      pathRef.skip();
    },
  });
}

// pageSize 前置引导（推荐 50，最大 100）：
// - 显式 pageSize > 100 -> 安全钳制为 100（平台硬上限）
// - 分页参数对象缺 pageSize（含 pageNumber/currentPage/pageNo）-> 补默认 pageSize: 50
//
// 作用域必须收窄到「真正的数据请求参数对象」，否则会误伤业务态更新对象：
// 例如 setCustomState({ currentPage: 1 }) 也含分页键 currentPage，但它是状态更新、
// 不是数据请求，绝不能被注入 pageSize。识别数据请求对象的可靠信号：
//   1) 对象携带表单目标键（formUuid / formGroupId）—— 宜搭数据查询 API 的必备参数；或
//   2) 对象是已知数据查询方法（searchFormDatas 等）的直接调用实参。
// 业务态对象（setCustomState/setState 的实参）既无 formUuid 也不是数据查询实参，故被排除。
function fixPageSize(ast, fixes) {
  const PAGINATION_KEYS = new Set(['pageNumber', 'currentPage', 'pageNo']);
  const FORM_TARGET_KEYS = new Set(['formUuid', 'formGroupId']);
  const DATA_FETCH_METHODS = new Set([
    'searchFormDatas',
    'searchFormDataIds',
    'searchSubformDatas',
    'fetchSubformDatas',
    'getFormData',
    'getFormDataById',
    'getSubTableDatas',
  ]);

  function propKeyName(prop) {
    if (prop.type !== 'ObjectProperty' || prop.computed) {
      return null;
    }
    const key = prop.key;
    if (key && key.type === 'Identifier') {
      return key.name;
    }
    if (key && key.type === 'StringLiteral') {
      return key.value;
    }
    return null;
  }

  // 该对象是否作为「已知数据查询方法」的直接调用实参
  function isDataFetchCallArgument(pathRef) {
    const parent = pathRef.parent;
    if (!parent || parent.type !== 'CallExpression') {
      return false;
    }
    if (!parent.arguments || parent.arguments.indexOf(pathRef.node) === -1) {
      return false;
    }
    const callee = parent.callee;
    if (!callee || callee.type !== 'MemberExpression' || callee.computed) {
      return false;
    }
    const prop = callee.property;
    return !!(prop && prop.type === 'Identifier' && DATA_FETCH_METHODS.has(prop.name));
  }

  traverse(ast, {
    ObjectExpression(pathRef) {
      const props = pathRef.node.properties;
      let pageSizeProp = null;
      let hasPaginationKey = false;
      let hasFormTarget = false;

      props.forEach((prop) => {
        const name = propKeyName(prop);
        if (name === 'pageSize') {
          pageSizeProp = prop;
        }
        if (name && PAGINATION_KEYS.has(name)) {
          hasPaginationKey = true;
        }
        if (name && FORM_TARGET_KEYS.has(name)) {
          hasFormTarget = true;
        }
      });

      // 仅当对象确属数据请求参数时才介入，避免误伤业务态更新对象
      const isDataRequestParams = hasFormTarget || isDataFetchCallArgument(pathRef);
      if (!isDataRequestParams) {
        return;
      }

      if (
        pageSizeProp &&
        pageSizeProp.value &&
        pageSizeProp.value.type === 'NumericLiteral' &&
        pageSizeProp.value.value > 100
      ) {
        const original = pageSizeProp.value.value;
        pageSizeProp.value = t.numericLiteral(100);
        fixes.push({
          rule: 'pagesize-clamped',
          message: `Clamped pageSize ${original} to platform max 100 (recommended 50)`,
        });
      }

      if (!pageSizeProp && hasPaginationKey) {
        pathRef.node.properties.unshift(
          t.objectProperty(t.identifier('pageSize'), t.numericLiteral(50))
        );
        fixes.push({
          rule: 'pagesize-default-inserted',
          message: 'Inserted recommended pageSize: 50 into pagination params',
        });
      }
    },
  });
}

function removeSupportedImports(ast, fixes, errors) {
  ast.program.body = ast.program.body.filter((statement) => {
    if (statement.type !== 'ImportDeclaration') {
      return true;
    }

    const importSource = statement.source && statement.source.value;
    if (isSupportedRemovableImport(importSource)) {
      fixes.push({
        rule: 'remove-runtime-import',
        message: `Removed ${importSource} import; Yida provides runtime globals or JSX transform support`,
      });
      return false;
    }

    errors.push({
      code: 'UNSUPPORTED_IMPORT',
      message: `Unsupported import "${importSource}". Load browser libraries with this.utils.loadScript/loadStyleSheet or use a supported runtime global.`,
      line: statement.loc && statement.loc.start && statement.loc.start.line,
    });
    return true;
  });
}

function collectExportedFunctionNames(ast) {
  const names = new Set();
  ast.program.body.forEach((statement) => {
    if (
      statement.type === 'ExportNamedDeclaration' &&
      statement.declaration &&
      statement.declaration.type === 'FunctionDeclaration' &&
      statement.declaration.id
    ) {
      names.add(statement.declaration.id.name);
    }
  });
  return names;
}

function hasTopLevelCustomState(ast) {
  return ast.program.body.some((statement) => {
    return statement.type === 'VariableDeclaration' &&
      statement.declarations.some((declarator) => {
        return declarator.id &&
          declarator.id.type === 'Identifier' &&
          declarator.id.name === '_customState';
      });
  });
}

function ensureYidaRuntimeContract(sourceCode) {
  const ast = parseSource(sourceCode);
  const exportedNames = collectExportedFunctionNames(ast);
  const fixes = [];
  const prepend = [];
  const append = [];
  const needsStateHelper = !exportedNames.has('getCustomState') || !exportedNames.has('setCustomState');

  if (needsStateHelper && !hasTopLevelCustomState(ast)) {
    prepend.push('var _customState = {};');
    fixes.push({
      rule: 'runtime-custom-state',
      message: 'Inserted default _customState store for Yida runtime helpers',
    });
  }

  Object.keys(REQUIRED_RUNTIME_EXPORTS).forEach((name) => {
    if (!exportedNames.has(name)) {
      append.push(REQUIRED_RUNTIME_EXPORTS[name]);
      fixes.push({
        rule: 'runtime-export-' + name,
        message: `Inserted missing export function ${name} for Yida runtime contract`,
      });
    }
  });

  if (prepend.length === 0 && append.length === 0) {
    return { code: sourceCode, fixes };
  }

  return {
    code: [
      prepend.join('\n'),
      sourceCode.trimEnd(),
      append.join('\n\n'),
      '',
    ].filter(Boolean).join('\n\n'),
    fixes,
  };
}

const TAILWIND_CDN_URL = 'https://g.alicdn.com/code/lib/tailwindcss-browser/0.0.0-insiders.fed6c6a/index.global.min.js';

const TAILWIND_RUNTIME_HELPERS = [
  'export function ensureTailwind() {',
  '  if (typeof window === "undefined" || typeof document === "undefined") { return; }',
  '  if (window.__openYidaTailwindLoaded) { return; }',
  '  window.__openYidaTailwindLoaded = true;',
  '  var self = this;',
  '  try {',
  '    self.injectTailwindSource();',
  '  } catch (err) {',
  '    self.injectTailwindFallback();',
  '  }',
  '}',
  '',
  'export function injectTailwindSource() {',
  '  var self = this;',
  '  var script = document.createElement("script");',
  '  script.src = TAILWIND_CDN;',
  '  script.onerror = function() { self.injectTailwindFallback(); };',
  '  document.head.appendChild(script);',
  '}',
  '',
  'export function injectTailwindFallback() {',
  '  // 兜底：CDN 不可用时可在此加载自托管的 Tailwind 样式表。',
  '}',
].join('\n');

// 保守检测 Tailwind 原子类使用：需在 className 上下文中命中若干判别性 token 才注入，
// 避免误注入外部 CDN 脚本。
function usesTailwind(sourceCode) {
  const classNameRegex = /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g;
  const tokenRegex = /\b(flex|grid|hidden|items-(?:center|start|end)|justify-(?:center|between|start|end)|gap-\d|[pm][xytblr]?-\d|space-[xy]-\d|text-(?:xs|sm|base|lg|xl|\d?xl)|bg-[a-z]+-\d{2,3}|text-[a-z]+-\d{2,3}|rounded(?:-[a-z]+)?|shadow(?:-[a-z]+)?|w-(?:\d|full|screen)|h-(?:\d|full|screen)|font-(?:bold|semibold|medium)|border(?:-\d)?)\b/g;
  let match;
  let hits = 0;
  while ((match = classNameRegex.exec(sourceCode)) !== null) {
    const classValue = match[1] || match[2] || match[3] || '';
    const tokens = classValue.match(tokenRegex);
    if (tokens) {
      hits += tokens.length;
      if (hits >= 3) {
        return true;
      }
    }
  }
  return false;
}

// 决策 A：按需注入 Tailwind CDN 加载器，且只在 didMount 为空实现（自动注入）时追加调用，
// 绝不覆盖用户手写的 didMount。字符串级处理，运行在 ensureYidaRuntimeContract 之后。
function injectTailwindRuntime(code, fixes) {
  if (!usesTailwind(code)) {
    return code;
  }

  let output = code;

  if (!/export\s+function\s+ensureTailwind\s*\(/.test(output)) {
    const cdnPrefix = /\bvar\s+TAILWIND_CDN\b/.test(output)
      ? ''
      : `var TAILWIND_CDN = "${TAILWIND_CDN_URL}";\n\n`;
    output = `${cdnPrefix}${output.trimEnd()}\n\n${TAILWIND_RUNTIME_HELPERS}\n`;
    fixes.push({
      rule: 'tailwind-injected',
      message: 'Injected on-demand Tailwind CDN loader (ensureTailwind/injectTailwindSource/injectTailwindFallback)',
    });
  }

  // 仅当 didMount 为空实现（自动注入版本）时追加 this.ensureTailwind();
  const emptyDidMountRegex = /export\s+function\s+didMount\s*\(\s*\)\s*\{\s*\}/;
  if (emptyDidMountRegex.test(output)) {
    output = output.replace(
      emptyDidMountRegex,
      'export function didMount() {\n  this.ensureTailwind();\n}'
    );
    fixes.push({
      rule: 'tailwind-didmount-hook',
      message: 'Appended this.ensureTailwind() into auto-injected empty didMount',
    });
  }

  return output;
}

function fixYidaSource(sourceCode) {
  const ast = parseSource(sourceCode);
  const fixes = [];
  const errors = [];

  removeSupportedImports(ast, fixes, errors);
  fixEventHandlers(ast, fixes);
  fixArrayCallbacks(ast, fixes);
  fixVariableDeclarations(ast, fixes);
  fixPageSize(ast, fixes);
  fixSelfBinding(ast, fixes);
  fixRenderTimestamp(ast, fixes);

  const runtimeResult = ensureYidaRuntimeContract(generateCode(ast));
  const tailwindFixes = [];
  const finalCode = injectTailwindRuntime(runtimeResult.code, tailwindFixes);

  return {
    code: finalCode,
    fixes: fixes.concat(runtimeResult.fixes).concat(tailwindFixes),
    errors,
    mode: 'yida-source',
  };
}

function getDefaultExportFunction(ast) {
  for (const statement of ast.program.body) {
    if (statement.type === 'ExportDefaultDeclaration') {
      const declaration = statement.declaration;
      if (declaration.type === 'FunctionDeclaration' || declaration.type === 'FunctionExpression' || declaration.type === 'ArrowFunctionExpression') {
        return { statement, declaration };
      }
      return { statement, declaration: null };
    }
  }
  return null;
}

function getHookName(callExpression) {
  if (!callExpression || callExpression.type !== 'CallExpression') {
    return '';
  }
  if (callExpression.callee.type === 'Identifier') {
    return callExpression.callee.name;
  }
  if (callExpression.callee.type === 'MemberExpression' && callExpression.callee.property.type === 'Identifier') {
    return callExpression.callee.property.name;
  }
  return '';
}

function isUseStateDeclarator(declarator) {
  return declarator &&
    declarator.id &&
    declarator.id.type === 'ArrayPattern' &&
    declarator.id.elements.length >= 2 &&
    declarator.id.elements[0] &&
    declarator.id.elements[0].type === 'Identifier' &&
    declarator.id.elements[1] &&
    declarator.id.elements[1].type === 'Identifier' &&
    getHookName(declarator.init) === 'useState';
}

function cloneStatementsFromFunctionLike(functionNode) {
  if (!functionNode) {
    return [];
  }
  if (functionNode.body.type === 'BlockStatement') {
    return functionNode.body.body.map(statement => t.cloneNode(statement));
  }
  return [t.returnStatement(t.cloneNode(functionNode.body))];
}

function extractEffect(effectCall, errors) {
  const callback = effectCall.arguments[0];
  const deps = effectCall.arguments[1];

  if (!callback || (callback.type !== 'ArrowFunctionExpression' && callback.type !== 'FunctionExpression')) {
    errors.push({ code: 'UNSUPPORTED_EFFECT', message: 'useEffect callback must be a function in OpenYida authoring mode.' });
    return null;
  }

  if (!deps || deps.type !== 'ArrayExpression' || deps.elements.length !== 0) {
    errors.push({ code: 'UNSUPPORTED_EFFECT_DEPS', message: 'Only useEffect(..., []) is supported in OpenYida authoring mode.' });
    return null;
  }

  const mount = [];
  const unmount = [];
  const bodyStatements = cloneStatementsFromFunctionLike(callback);

  bodyStatements.forEach((statement) => {
    if (statement.type === 'ReturnStatement') {
      const cleanup = statement.argument;
      if (cleanup && (cleanup.type === 'ArrowFunctionExpression' || cleanup.type === 'FunctionExpression')) {
        unmount.push(...cloneStatementsFromFunctionLike(cleanup));
      } else if (cleanup) {
        errors.push({ code: 'UNSUPPORTED_EFFECT_CLEANUP', message: 'useEffect cleanup must be a function.' });
      }
    } else {
      mount.push(statement);
    }
  });

  return { mount, unmount };
}

function collectUnsupportedHooks(ast, errors) {
  traverse(ast, {
    CallExpression(pathRef) {
      const name = getHookName(pathRef.node);
      if (/^use[A-Z]/.test(name) && !SUPPORTED_HOOKS.has(name)) {
        errors.push({
          code: 'UNSUPPORTED_HOOK',
          message: `${name} is not supported in OpenYida authoring mode.`,
          hook: name,
          line: pathRef.node.loc && pathRef.node.loc.start && pathRef.node.loc.start.line,
          retryable: false,
          retrySafe: true,
          sideEffectState: 'none',
          sourceRepairable: true,
          supportedHooks: [...SUPPORTED_HOOKS],
          recommendedAuthoringMode: 'canvas',
          replacement: UNSUPPORTED_HOOK_REPAIRS[name]
            || 'Use only supported useState/useEffect(..., []) authoring, or move the page to .canvas.jsx for full React Hook support.',
          nextAction: {
            type: 'edit_source_then_recheck',
            commandId: 'check-page',
          },
        });
      }
    },
  });
}

function replaceIdentifier(node, fromName, replacement) {
  const wrapper = t.file(t.program([t.expressionStatement(t.cloneNode(node))]));
  const replacementNode = typeof replacement === 'string' ? t.identifier(replacement) : replacement;
  traverse(wrapper, {
    Identifier(pathRef) {
      if (pathRef.node.name !== fromName) {
        return;
      }
      if (
        pathRef.parent.type === 'MemberExpression' &&
        pathRef.parent.property === pathRef.node &&
        !pathRef.parent.computed
      ) {
        return;
      }
      pathRef.replaceWith(t.cloneNode(replacementNode));
    },
  });
  return wrapper.program.body[0].expression;
}

function makeStateReadExpression(stateName) {
  return t.callExpression(
    t.memberExpression(t.thisExpression(), t.identifier('getCustomState')),
    [t.stringLiteral(stateName)]
  );
}

function makeStateUpdateExpression(stateName, setterArg) {
  let valueExpression = setterArg ? t.cloneNode(setterArg) : t.identifier('undefined');
  if (setterArg && setterArg.type === 'ArrowFunctionExpression' && setterArg.params.length === 1) {
    const param = setterArg.params[0];
    if (param.type === 'Identifier') {
      const previousState = makeStateReadExpression(stateName);
      if (setterArg.body.type === 'BlockStatement') {
        const returnStatement = setterArg.body.body.find(statement => statement.type === 'ReturnStatement');
        valueExpression = returnStatement && returnStatement.argument
          ? replaceIdentifier(returnStatement.argument, param.name, previousState)
          : previousState;
      } else {
        valueExpression = replaceIdentifier(setterArg.body, param.name, previousState);
      }
    }
  }

  return t.callExpression(
    t.memberExpression(t.thisExpression(), t.identifier('setCustomState')),
    [
      t.objectExpression([
        t.objectProperty(t.identifier(stateName), valueExpression),
      ]),
    ]
  );
}

function replaceStateSetters(node, stateSetters) {
  const wrapper = t.file(t.program([t.expressionStatement(t.cloneNode(node))]));
  traverse(wrapper, {
    CallExpression(pathRef) {
      if (pathRef.node.callee.type !== 'Identifier') {
        return;
      }
      const stateName = stateSetters.get(pathRef.node.callee.name);
      if (!stateName) {
        return;
      }
      pathRef.replaceWith(makeStateUpdateExpression(stateName, pathRef.node.arguments[0]));
    },
  });
  return wrapper.program.body[0].expression;
}

function replaceStateSettersInStatement(statement, stateSetters) {
  const wrapper = t.file(t.program([t.cloneNode(statement)]));
  traverse(wrapper, {
    CallExpression(pathRef) {
      if (pathRef.node.callee.type !== 'Identifier') {
        return;
      }
      const stateName = stateSetters.get(pathRef.node.callee.name);
      if (!stateName) {
        return;
      }
      pathRef.replaceWith(makeStateUpdateExpression(stateName, pathRef.node.arguments[0]));
    },
  });
  return wrapper.program.body[0];
}

function addBindingNames(pattern, names) {
  if (!pattern) {
    return;
  }
  if (pattern.type === 'Identifier') {
    names.add(pattern.name);
    return;
  }
  if (pattern.type === 'ArrayPattern') {
    pattern.elements.forEach(element => addBindingNames(element, names));
    return;
  }
  if (pattern.type === 'ObjectPattern') {
    pattern.properties.forEach((property) => {
      addBindingNames(property.value || property.argument || property.key, names);
    });
    return;
  }
  if (pattern.type === 'RestElement') {
    addBindingNames(pattern.argument, names);
    return;
  }
  if (pattern.type === 'AssignmentPattern') {
    addBindingNames(pattern.left, names);
  }
}

function collectComponentBindingNames(componentBody) {
  const names = new Set();
  componentBody.forEach((statement) => {
    if (statement.type === 'VariableDeclaration') {
      statement.declarations.forEach(declarator => addBindingNames(declarator.id, names));
    } else if ((statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') && statement.id) {
      names.add(statement.id.name);
    }
  });
  return names;
}

function collectUseStateSetterNames(componentBody) {
  const names = new Set();
  componentBody.forEach((statement) => {
    if (statement.type !== 'VariableDeclaration') {
      return;
    }
    statement.declarations.forEach((declarator) => {
      if (isUseStateDeclarator(declarator)) {
        names.add(declarator.id.elements[1].name);
      }
    });
  });
  return names;
}

function collectReferencedIdentifiersFromStatements(statements) {
  const names = new Set();
  if (!statements || statements.length === 0) {
    return names;
  }
  const wrapper = t.file(t.program(statements.map(statement => t.cloneNode(statement))));
  traverse(wrapper, {
    Identifier(pathRef) {
      if (typeof pathRef.isReferencedIdentifier === 'function') {
        if (!pathRef.isReferencedIdentifier()) {
          return;
        }
      } else if (
        pathRef.parent.type === 'MemberExpression' &&
        pathRef.parent.property === pathRef.node &&
        !pathRef.parent.computed
      ) {
        return;
      }
      names.add(pathRef.node.name);
    },
  });
  return names;
}

function collectStatementBindingNames(statements) {
  const names = new Set();
  (statements || []).forEach((statement) => {
    if (statement.type === 'VariableDeclaration') {
      statement.declarations.forEach(declarator => addBindingNames(declarator.id, names));
    } else if ((statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') && statement.id) {
      names.add(statement.id.name);
    }
  });
  return names;
}

function addUnsupportedEffectLocalReferenceErrors(effect, componentBindings, allowedBindings, errors, reportedNames, line) {
  const referencedNames = collectReferencedIdentifiersFromStatements(effect.mount.concat(effect.unmount));
  referencedNames.forEach((name) => {
    if (!componentBindings.has(name) || allowedBindings.has(name) || reportedNames.has(name)) {
      return;
    }
    reportedNames.add(name);
    errors.push({
      code: 'UNSUPPORTED_EFFECT_LOCAL_REFERENCE',
      message: `useEffect(..., []) references local component binding "${name}", which would be undefined inside Yida didMount/didUnmount. Move the logic inline, use a supported state setter functional update, or write native export function didMount().`,
      line,
    });
  });
}

function addUnsupportedEffectCleanupReferenceErrors(effect, errors, reportedNames, line) {
  const mountBindings = collectStatementBindingNames(effect.mount);
  if (mountBindings.size === 0 || effect.unmount.length === 0) {
    return;
  }

  const cleanupRefs = collectReferencedIdentifiersFromStatements(effect.unmount);
  cleanupRefs.forEach((name) => {
    if (!mountBindings.has(name) || reportedNames.has(name)) {
      return;
    }
    reportedNames.add(name);
    errors.push({
      code: 'UNSUPPORTED_EFFECT_CLEANUP_REFERENCE',
      message: `useEffect cleanup references effect-local binding "${name}", which would be undefined inside Yida didUnmount. Store it on this (for native didMount/didUnmount) or avoid cleanup-local captures in authoring mode.`,
      line,
    });
  });
}

function statementContainsUseEffect(statement) {
  return statement.type === 'ExpressionStatement' &&
    statement.expression &&
    statement.expression.type === 'CallExpression' &&
    getHookName(statement.expression) === 'useEffect';
}

function splitComponentBody(componentBody, errors) {
  const stateItems = [];
  const stateSetters = new Map();
  const componentBindings = collectComponentBindingNames(componentBody);
  const allowedEffectBindings = collectUseStateSetterNames(componentBody);
  const reportedEffectRefs = new Set();
  const reportedCleanupRefs = new Set();
  const renderStatements = [];
  const didMountStatements = [];
  const didUnmountStatements = [];
  let returnStatement = null;

  for (const statement of componentBody) {
    if (statement.type === 'VariableDeclaration') {
      const remainingDeclarators = [];
      statement.declarations.forEach((declarator) => {
        if (isUseStateDeclarator(declarator)) {
          const stateName = declarator.id.elements[0].name;
          const setterName = declarator.id.elements[1].name;
          stateItems.push({
            stateName,
            setterName,
            initialValue: declarator.init.arguments[0] || t.identifier('undefined'),
          });
          stateSetters.set(setterName, stateName);
        } else {
          remainingDeclarators.push(declarator);
        }
      });

      if (remainingDeclarators.length > 0) {
        const clone = t.cloneNode(statement);
        clone.declarations = remainingDeclarators;
        renderStatements.push(clone);
      }
      continue;
    }

    if (statementContainsUseEffect(statement)) {
      const effect = extractEffect(statement.expression, errors);
      if (effect) {
        addUnsupportedEffectLocalReferenceErrors(
          effect,
          componentBindings,
          allowedEffectBindings,
          errors,
          reportedEffectRefs,
          statement.loc && statement.loc.start ? statement.loc.start.line : undefined
        );
        addUnsupportedEffectCleanupReferenceErrors(
          effect,
          errors,
          reportedCleanupRefs,
          statement.loc && statement.loc.start ? statement.loc.start.line : undefined
        );
        didMountStatements.push(...effect.mount);
        didUnmountStatements.push(...effect.unmount);
      }
      continue;
    }

    if (statement.type === 'ReturnStatement') {
      returnStatement = statement;
      continue;
    }

    renderStatements.push(t.cloneNode(statement));
  }

  return {
    stateItems,
    stateSetters,
    renderStatements,
    didMountStatements,
    didUnmountStatements,
    returnStatement,
  };
}

function buildStateObjectCode(stateItems) {
  if (stateItems.length === 0) {
    return 'var _customState = {};\n';
  }

  const lines = stateItems.map((item) => {
    return `  ${item.stateName}: ${generateCode(item.initialValue)},`;
  });
  return `var _customState = {\n${lines.join('\n')}\n};\n`;
}

function buildRuntimeHelpersCode() {
  return [
    'function resolveCustomState(ctx) {',
    '  var runtimeState = ctx && ctx.state && ctx.state.__openYidaCompatState;',
    '  return Object.assign({}, _customState, runtimeState || {});',
    '}',
    '',
    'export function getCustomState(key) {',
    '  var state = resolveCustomState(this);',
    '  if (key) {',
    '    return state[key];',
    '  }',
    '  return state;',
    '}',
    '',
    'export function setCustomState(newState) {',
    '  var nextState = Object.assign({}, resolveCustomState(this), newState || {});',
    '  _customState = nextState;',
    '  this.setState({',
    '    __openYidaCompatState: nextState,',
    '    timestamp: new Date().getTime()',
    '  });',
    '}',
    '',
    'export function forceUpdate() {',
    '  this.setState({ timestamp: new Date().getTime() });',
    '}',
    '',
  ].join('\n');
}

function buildLifecycleCode(name, statements, stateSetters) {
  const normalizedStatements = stateSetters
    ? statements.map(statement => replaceStateSettersInStatement(statement, stateSetters))
    : statements;
  const body = normalizedStatements.map(statement => generateCode(statement)).join('\n');
  if (!body) {
    return `export function ${name}() {}\n`;
  }
  return `export function ${name}() {\n${body.split('\n').map(line => `  ${line}`).join('\n')}\n}\n`;
}

function buildRenderCode(parts) {
  const lines = ['export function renderJsx() {'];

  parts.stateItems.forEach((item) => {
    lines.push(`  var ${item.stateName} = this.getCustomState('${item.stateName}');`);
  });

  parts.renderStatements
    .map(statement => replaceStateSettersInStatement(statement, parts.stateSetters))
    .forEach((statement) => {
      generateCode(statement).split('\n').forEach((line) => {
        lines.push(`  ${line}`);
      });
    });

  const returnArgument = parts.returnStatement && parts.returnStatement.argument
    ? replaceStateSetters(parts.returnStatement.argument, parts.stateSetters)
    : t.jsxElement(
      t.jsxOpeningElement(t.jsxIdentifier('div'), [], true),
      null,
      [],
      true
    );

  const timestampResult = ensureTimestampInRenderArgument(returnArgument);
  const returnCode = generateCode(t.returnStatement(timestampResult.node));
  returnCode.split('\n').forEach((line) => {
    lines.push(`  ${line}`);
  });
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

function transformModernPage(sourceCode) {
  const ast = parseSource(sourceCode);
  const fixes = [];
  const errors = [];
  collectUnsupportedHooks(ast, errors);
  removeSupportedImports(ast, fixes, errors);

  const defaultExport = getDefaultExportFunction(ast);
  if (!defaultExport) {
    errors.push({
      code: 'MISSING_ENTRY',
      message: 'Expected export function renderJsx() or export default function Page() entry.',
    });
    return { code: sourceCode, fixes, errors, mode: 'unsupported' };
  }
  if (!defaultExport.declaration) {
    errors.push({
      code: 'UNSUPPORTED_DEFAULT_EXPORT',
      message: 'Only export default function Page() is supported in OpenYida authoring mode.',
    });
    return { code: sourceCode, fixes, errors, mode: 'unsupported' };
  }

  const topLevel = ast.program.body
    .filter(statement => statement !== defaultExport.statement && statement.type !== 'ImportDeclaration')
    .map(statement => generateCode(statement))
    .filter(Boolean);
  const componentBody = defaultExport.declaration.body.type === 'BlockStatement'
    ? defaultExport.declaration.body.body
    : [t.returnStatement(defaultExport.declaration.body)];
  const parts = splitComponentBody(componentBody, errors);

  if (errors.length > 0) {
    return { code: sourceCode, fixes, errors, mode: 'modern-authoring' };
  }

  const code = [
    '/* Generated by OpenYida compatibility compiler. Edit the .oyd.jsx source when possible. */',
    ...topLevel,
    buildStateObjectCode(parts.stateItems).trimEnd(),
    buildRuntimeHelpersCode().trimEnd(),
    buildLifecycleCode('didMount', parts.didMountStatements, parts.stateSetters).trimEnd(),
    buildLifecycleCode('didUnmount', parts.didUnmountStatements, parts.stateSetters).trimEnd(),
    buildRenderCode(parts).trimEnd(),
    '',
  ].filter(Boolean).join('\n\n');

  fixes.push({
    rule: 'modern-authoring-lower',
    message: 'Lowered export default function/useState/useEffect into Yida export functions',
  });

  const fixed = fixYidaSource(code);
  return {
    ...fixed,
    fixes: fixes.concat(fixed.fixes),
    errors: errors.concat(fixed.errors),
    mode: 'modern-authoring',
  };
}

function buildPageSource(sourceCode, sourcePath = '', options = {}) {
  const ast = parseSource(sourceCode);
  const shouldTransformModern = options.modern === true || !hasYidaRenderExport(ast);
  const result = shouldTransformModern
    ? transformModernPage(sourceCode)
    : fixYidaSource(sourceCode);

  const lintResult = result.errors.length === 0
    ? lintYidaSource(result.code, sourcePath.replace(/\.oyd(\.jsx?)$/i, '.yida$1'))
    : { errors: [], warnings: [] };

  return {
    ...result,
    lint: lintResult,
    ok: result.errors.length === 0 && lintResult.errors.length === 0,
  };
}

function getCompatOutputPath(sourcePath, outputPath) {
  if (outputPath) {
    return path.resolve(outputPath);
  }

  const parsed = path.parse(sourcePath);
  const normalizedName = parsed.name.replace(/\.oyd$/i, '').replace(/\.openyida$/i, '');
  return path.join(findProjectRoot(), 'pages', 'build', `${normalizedName}.yida${parsed.ext || '.jsx'}`);
}

function buildPageFile(sourcePath, options = {}) {
  const resolvedSource = path.resolve(sourcePath);
  const sourceCode = fs.readFileSync(resolvedSource, 'utf-8');
  if (!options.skipSizeWarning) {
    warnLargePageSource(sourceCode, resolvedSource);
  }
  const result = buildPageSource(sourceCode, resolvedSource, options);

  if (result.errors.length > 0) {
    return {
      ...result,
      sourcePath: resolvedSource,
      outputPath: null,
    };
  }

  const outputPath = options.write
    ? resolvedSource
    : getCompatOutputPath(resolvedSource, options.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, result.code, 'utf-8');

  return {
    ...result,
    sourcePath: resolvedSource,
    outputPath,
  };
}

module.exports = {
  buildPageSource,
  buildPageFile,
  ensureYidaRuntimeContract,
  fixYidaSource,
  getCompatOutputPath,
  isAuthoringPath,
  shouldBuildPageSource,
};
