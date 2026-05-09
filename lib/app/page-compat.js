'use strict';

const fs = require('fs');
const path = require('path');
const Babel = require('@babel/standalone');
const { findProjectRoot } = require('../core/utils');
const { lintYidaSource } = require('./page-linter');

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

function isAuthoringPath(sourcePath) {
  return /\.oyd\.(jsx?|tsx?)$/i.test(sourcePath || '') ||
    /\.openyida\.(jsx?|tsx?)$/i.test(sourcePath || '');
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

function fixYidaSource(sourceCode) {
  const ast = parseSource(sourceCode);
  const fixes = [];
  const errors = [];

  removeSupportedImports(ast, fixes, errors);
  fixEventHandlers(ast, fixes);
  fixArrayCallbacks(ast, fixes);
  fixVariableDeclarations(ast, fixes);
  fixRenderTimestamp(ast, fixes);

  return {
    code: generateCode(ast),
    fixes,
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
          line: pathRef.node.loc && pathRef.node.loc.start && pathRef.node.loc.start.line,
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

function statementContainsUseEffect(statement) {
  return statement.type === 'ExpressionStatement' &&
    statement.expression &&
    statement.expression.type === 'CallExpression' &&
    getHookName(statement.expression) === 'useEffect';
}

function splitComponentBody(componentBody, errors) {
  const stateItems = [];
  const stateSetters = new Map();
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
  fixYidaSource,
  getCompatOutputPath,
  isAuthoringPath,
};
