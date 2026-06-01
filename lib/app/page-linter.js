'use strict';

const { t } = require('../core/i18n');
const { warn, fail, hint, success } = require('../core/chalk');
const Babel = require('@babel/standalone');

const THEN_CALLBACK_LINE_LIMIT = 50;
const CALLBACK_SCAN_LINE_LIMIT = 80;
const parser = Babel.packages.parser;
const traverse = Babel.packages.traverse.default || Babel.packages.traverse;

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

const EVENT_NAME_ALIASES = {
  onclick: 'onClick',
  onchange: 'onChange',
  oninput: 'onChange',
  onsubmit: 'onSubmit',
  onkeydown: 'onKeyDown',
  onkeyup: 'onKeyUp',
  onkeypress: 'onKeyPress',
  onfocus: 'onFocus',
  onblur: 'onBlur',
  onmouseenter: 'onMouseEnter',
  onmouseleave: 'onMouseLeave',
  onmousedown: 'onMouseDown',
  onmouseup: 'onMouseUp',
  onmousemove: 'onMouseMove',
  oncompositionstart: 'onCompositionStart',
  oncompositionend: 'onCompositionEnd',
};

const PUBLIC_CDN_HOSTS = [
  'cdn.jsdelivr.net',
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'cdn.tailwindcss.com',
];

function isInCommentOrString(line, matchIndex) {
  const beforeMatch = line.substring(0, matchIndex);
  if (beforeMatch.includes('//')) {
    return true;
  }

  const quotes = (beforeMatch.match(/['"]/g) || []).length;
  return quotes % 2 !== 0;
}

function parseDisableRules(rawRules) {
  if (!rawRules || !rawRules.trim()) {
    return ['*'];
  }
  return rawRules
    .split(/[,\s]+/)
    .map(rule => rule.trim())
    .filter(Boolean);
}

function addLineDisable(disableMap, lineNumber, rules) {
  if (lineNumber < 1) {
    return;
  }
  if (!disableMap.has(lineNumber)) {
    disableMap.set(lineNumber, new Set());
  }
  rules.forEach(rule => disableMap.get(lineNumber).add(rule));
}

function buildLineDisableMap(lines) {
  const disableMap = new Map();

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const disableLineMatch = line.match(/openyida-lint-disable-line(?:\s+([a-z0-9_,\-\s]+))?/i);
    if (disableLineMatch) {
      addLineDisable(disableMap, lineNumber, parseDisableRules(disableLineMatch[1]));
    }

    const disableNextLineMatch = line.match(/openyida-lint-disable-next-line(?:\s+([a-z0-9_,\-\s]+))?/i);
    if (disableNextLineMatch) {
      addLineDisable(disableMap, lineNumber + 1, parseDisableRules(disableNextLineMatch[1]));
    }
  });

  return disableMap;
}

function isRuleDisabled(disableMap, line, rule) {
  const disabledRules = disableMap && disableMap.get(line);
  return !!disabledRules && (disabledRules.has('*') || disabledRules.has(rule));
}

function pushIssue(list, line, rule, message, disableMap) {
  if (isRuleDisabled(disableMap, line, rule)) {
    return;
  }
  if (list.some(issue => issue.line === line && issue.rule === rule && issue.message === message)) {
    return;
  }
  list.push({ line, rule, message });
}

function stripCommentsAndStrings(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');
}

function extractFunctionBody(lines, startLineIndex, functionIndex) {
  const endLineIndex = Math.min(lines.length, startLineIndex + CALLBACK_SCAN_LINE_LIMIT);
  const source = lines.slice(startLineIndex, endLineIndex).join('\n');
  const openBraceIndex = source.indexOf('{', functionIndex);

  if (openBraceIndex < 0) {
    return '';
  }

  let braceDepth = 0;
  let quote = null;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = openBraceIndex; i < source.length; i++) {
    const char = source[i];
    const nextChar = source[i + 1];

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (quote) {
      if (char === '\\') {
        i++;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '/' && nextChar === '/') {
      inLineComment = true;
      i++;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      continue;
    }

    if (char === '{') {
      braceDepth++;
    } else if (char === '}') {
      braceDepth--;
      if (braceDepth === 0) {
        return source.slice(openBraceIndex + 1, i);
      }
    }
  }

  return source.slice(openBraceIndex + 1);
}

function functionCallbackUsesThis(lines, lineIndex, matchIndex) {
  const line = lines[lineIndex];
  const functionIndex = line.indexOf('function', matchIndex);
  if (functionIndex < 0) {
    return false;
  }

  const body = extractFunctionBody(lines, lineIndex, functionIndex);
  return /\bthis\b/.test(stripCommentsAndStrings(body));
}

function detectLargeThenCallbacks(lines) {
  const results = [];
  let inThenCallback = false;
  let braceDepth = 0;
  let thenStartLine = 0;
  let thenBodyStartLine = 0;
  const thenStartRegex = /\.then\s*\(\s*(function\s*\(|(\([^)]*\)|[a-zA-Z_$]\w*)\s*=>)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }

    if (!inThenCallback) {
      const thenMatch = line.match(thenStartRegex);
      if (thenMatch && !isInCommentOrString(line, thenMatch.index)) {
        inThenCallback = true;
        thenStartLine = i + 1;
        braceDepth = 0;

        const afterMatch = line.substring(thenMatch.index);
        for (const char of afterMatch) {
          if (char === '{') {braceDepth++;}
          if (char === '}') {braceDepth--;}
        }
        thenBodyStartLine = i + 1;
      }
    } else {
      for (const char of line) {
        if (char === '{') {braceDepth++;}
        if (char === '}') {braceDepth--;}
      }

      if (braceDepth <= 0) {
        const callbackLineCount = (i + 1) - thenBodyStartLine;
        if (callbackLineCount > THEN_CALLBACK_LINE_LIMIT) {
          results.push({
            line: thenStartLine,
            lineCount: callbackLineCount,
          });
        }
        inThenCallback = false;
      }
    }
  }

  return results;
}

function detectYidaCallsWithoutCatch(sourceCode, warnings, disableMap) {
  const callRegex = /this\.utils\.yida\.[A-Za-z_$][\w$]*\s*\(/g;
  let match;

  while ((match = callRegex.exec(sourceCode)) !== null) {
    const before = sourceCode.slice(0, match.index);
    const line = before.split('\n').length;
    const statement = sourceCode.slice(match.index, match.index + 600);

    if (!statement.includes('.catch(')) {
      pushIssue(warnings, line, 'yida-api-catch', t('publish.lint_yida_api_catch'), disableMap);
    }
  }
}

function detectEchartsRichLabelFormatter(sourceCode, warnings, disableMap) {
  const labelFormatterRegex = /\blabel\s*:\s*\{[\s\S]{0,1200}?\bformatter\s*:\s*function\b/g;
  let match;

  while ((match = labelFormatterRegex.exec(sourceCode)) !== null) {
    const before = sourceCode.slice(0, match.index);
    const line = before.split('\n').length;
    const labelBlock = sourceCode.slice(match.index, match.index + 1600);
    const usesRichTemplate = /\brich\s*:/.test(labelBlock) || /return\s+['"`][\s\S]{0,300}?\{[A-Za-z0-9_]+\|/.test(labelBlock);

    if (usesRichTemplate) {
      pushIssue(warnings, line, 'echarts-rich-label-formatter', t('publish.lint_echarts_rich_label_formatter'), disableMap);
    }
  }
}

function getNodeLine(node) {
  return node && node.loc && node.loc.start && node.loc.start.line ? node.loc.start.line : 1;
}

function getJsxElementName(nameNode) {
  if (!nameNode) {
    return '';
  }
  if (nameNode.type === 'JSXIdentifier') {
    return nameNode.name;
  }
  if (nameNode.type === 'JSXMemberExpression') {
    return getJsxElementName(nameNode.property);
  }
  return '';
}

function getJsxAttributeName(nameNode) {
  if (!nameNode || nameNode.type !== 'JSXIdentifier') {
    return '';
  }
  return nameNode.name;
}

function hasJsxAttribute(attrs, name) {
  return attrs.some(attr => getJsxAttributeName(attr.name) === name);
}

function getStaticStringAttribute(attrs, name) {
  const attr = attrs.find(item => getJsxAttributeName(item.name) === name);
  if (!attr || !attr.value) {
    return '';
  }
  if (attr.value.type === 'StringLiteral') {
    return attr.value.value;
  }
  return '';
}

function isThisOrSelfMember(expression) {
  return !!(
    expression &&
    expression.type === 'MemberExpression' &&
    (
      expression.object.type === 'ThisExpression' ||
      (expression.object.type === 'Identifier' && expression.object.name === 'self')
    )
  );
}

function isBindThisCall(expression) {
  return !!(
    expression &&
    expression.type === 'CallExpression' &&
    expression.callee &&
    expression.callee.type === 'MemberExpression' &&
    expression.callee.property &&
    expression.callee.property.type === 'Identifier' &&
    expression.callee.property.name === 'bind' &&
    expression.arguments &&
    expression.arguments[0] &&
    expression.arguments[0].type === 'ThisExpression'
  );
}

function expressionIsBareHandlerReference(expression) {
  if (!expression) {
    return false;
  }
  if (isThisOrSelfMember(expression)) {
    return true;
  }
  if (expression.type === 'Identifier') {
    return /^handle[A-Z]|^on[A-Z]/.test(expression.name);
  }
  return false;
}

function blockContainsBareHandlerReference(blockStatement) {
  return blockStatement.body.some((statement) => {
    return statement.type === 'ExpressionStatement' &&
      expressionIsBareHandlerReference(statement.expression);
  });
}

function isEventAttribute(name) {
  return /^on[A-Z]/.test(name || '');
}

function isLowercaseEventAttribute(name) {
  return /^on[a-z]/.test(name || '');
}

function isInteractiveButton(attrs) {
  if (hasJsxAttribute(attrs, 'disabled') || hasJsxAttribute(attrs, 'aria-disabled')) {
    return true;
  }

  const buttonType = getStaticStringAttribute(attrs, 'type').toLowerCase();
  if (buttonType === 'submit') {
    return true;
  }

  return attrs.some((attr) => {
    const attrName = getJsxAttributeName(attr.name);
    return attrName === 'onClick' || attrName === 'onMouseDown' || attrName === 'onKeyDown';
  });
}

function getCanonicalEventName(name) {
  if (EVENT_NAME_ALIASES[name]) {
    return EVENT_NAME_ALIASES[name];
  }
  if (!name || name.length <= 2) {
    return name;
  }
  return 'on' + name.charAt(2).toUpperCase() + name.slice(3);
}

function isThisOrSelfUtilsCall(node, methodName) {
  const callee = node && node.callee;
  return !!(
    callee &&
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property &&
    callee.property.type === 'Identifier' &&
    callee.property.name === methodName &&
    callee.object &&
    callee.object.type === 'MemberExpression' &&
    !callee.object.computed &&
    callee.object.property &&
    callee.object.property.type === 'Identifier' &&
    callee.object.property.name === 'utils' &&
    callee.object.object &&
    (
      callee.object.object.type === 'ThisExpression' ||
      (callee.object.object.type === 'Identifier' && callee.object.object.name === 'self')
    )
  );
}

function getStaticStringValue(node, scope) {
  if (!node) {
    return '';
  }
  if (node.type === 'StringLiteral') {
    return node.value;
  }
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0 && node.quasis[0]) {
    return node.quasis[0].value.cooked || node.quasis[0].value.raw || '';
  }
  if (node.type === 'Identifier' && scope && typeof scope.getBinding === 'function') {
    const binding = scope.getBinding(node.name);
    const declaration = binding && binding.path && binding.path.node;
    if (declaration && declaration.type === 'VariableDeclarator') {
      return getStaticStringValue(declaration.init);
    }
  }
  return '';
}

function getUrlPathname(rawUrl) {
  try {
    return new URL(rawUrl).pathname || rawUrl;
  } catch {
    return rawUrl;
  }
}

function getUrlPathCandidates(rawUrl) {
  const candidates = [];
  const addCandidate = (value) => {
    const cleanValue = String(value || '').split(/[?#]/)[0].toLowerCase();
    if (cleanValue) {
      candidates.push(cleanValue);
    }
  };

  addCandidate(getUrlPathname(rawUrl));

  const comboIndex = rawUrl.indexOf('??');
  if (comboIndex >= 0) {
    rawUrl
      .slice(comboIndex + 2)
      .split('#')[0]
      .split(',')
      .forEach(addCandidate);
  }

  return candidates;
}

function urlHasExtension(rawUrl, extension) {
  return getUrlPathCandidates(rawUrl).some(pathname => pathname.endsWith(extension));
}

function isPublicCdnUrl(rawUrl) {
  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase();
    return PUBLIC_CDN_HOSTS.some(host => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    const lowered = rawUrl.toLowerCase();
    return PUBLIC_CDN_HOSTS.some(host => lowered.includes(host));
  }
}

function collectAstLintIssues(sourceCode, errors, warnings, disableMap) {
  let ast;
  try {
    ast = parser.parse(sourceCode, PARSER_OPTIONS);
  } catch {
    return;
  }

  traverse(ast, {
    ExportNamedDeclaration(pathRef) {
      const declaration = pathRef.node.declaration;
      if (!declaration || declaration.type !== 'FunctionDeclaration' || !declaration.id) {
        return;
      }

      const name = declaration.id.name;
      if (/^didmount$/i.test(name) && name !== 'didMount') {
        pushIssue(errors, getNodeLine(declaration), 'lifecycle-case', t('publish.lint_lifecycle_case', name, 'didMount'), disableMap);
      }
      if (/^didunmount$/i.test(name) && name !== 'didUnmount') {
        pushIssue(errors, getNodeLine(declaration), 'lifecycle-case', t('publish.lint_lifecycle_case', name, 'didUnmount'), disableMap);
      }
      if (name === 'componentDidMount' || name === 'componentWillUnmount') {
        const expected = name === 'componentDidMount' ? 'didMount' : 'didUnmount';
        pushIssue(errors, getNodeLine(declaration), 'react-lifecycle-method', t('publish.lint_react_lifecycle_method', name, expected), disableMap);
      }
    },
    ClassMethod(pathRef) {
      const key = pathRef.node.key;
      const name = key && key.type === 'Identifier' ? key.name : '';
      if (name === 'componentDidMount' || name === 'componentWillUnmount') {
        const expected = name === 'componentDidMount' ? 'didMount' : 'didUnmount';
        pushIssue(errors, getNodeLine(pathRef.node), 'react-lifecycle-method', t('publish.lint_react_lifecycle_method', name, expected), disableMap);
      }
    },
    ObjectMethod(pathRef) {
      const key = pathRef.node.key;
      const name = key && key.type === 'Identifier' ? key.name : '';
      if (name === 'componentDidMount' || name === 'componentWillUnmount') {
        const expected = name === 'componentDidMount' ? 'didMount' : 'didUnmount';
        pushIssue(errors, getNodeLine(pathRef.node), 'react-lifecycle-method', t('publish.lint_react_lifecycle_method', name, expected), disableMap);
      }
    },
    ObjectProperty(pathRef) {
      if (pathRef.node.computed) {
        pushIssue(errors, getNodeLine(pathRef.node), 'computed-property', t('publish.lint_computed_property'), disableMap);
      }
    },
    CallExpression(pathRef) {
      const firstArg = pathRef.node.arguments && pathRef.node.arguments[0];
      const url = getStaticStringValue(firstArg, pathRef.scope);

      if (!url) {
        return;
      }

      if (isThisOrSelfUtilsCall(pathRef.node, 'loadScript')) {
        if (isPublicCdnUrl(url)) {
          pushIssue(warnings, getNodeLine(pathRef.node), 'external-resource-public-cdn', t('publish.lint_external_resource_public_cdn'), disableMap);
        }
        if (urlHasExtension(url, '.css')) {
          pushIssue(warnings, getNodeLine(pathRef.node), 'loadscript-css-file', t('publish.lint_loadscript_css_file'), disableMap);
        }
      }

      if (isThisOrSelfUtilsCall(pathRef.node, 'loadStyleSheet')) {
        if (isPublicCdnUrl(url)) {
          pushIssue(warnings, getNodeLine(pathRef.node), 'external-resource-public-cdn', t('publish.lint_external_resource_public_cdn'), disableMap);
        }
        if (urlHasExtension(url, '.js')) {
          pushIssue(warnings, getNodeLine(pathRef.node), 'loadstylesheet-js-file', t('publish.lint_loadstylesheet_js_file'), disableMap);
        }
      }
    },
    JSXOpeningElement(pathRef) {
      const elementName = getJsxElementName(pathRef.node.name);
      const attrs = pathRef.node.attributes || [];

      if (elementName === 'input' && attrs.some(attr => getJsxAttributeName(attr.name) === 'value')) {
        pushIssue(errors, getNodeLine(pathRef.node), 'controlled-input', t('publish.lint_controlled_input'), disableMap);
      }

      if (elementName === 'select') {
        pushIssue(warnings, getNodeLine(pathRef.node), 'native-select-ui', t('publish.lint_native_select_ui'), disableMap);
      }

      if (elementName === 'button' && !isInteractiveButton(attrs)) {
        pushIssue(errors, getNodeLine(pathRef.node), 'button-missing-handler', t('publish.lint_button_missing_handler'), disableMap);
      }

      attrs.forEach((attr) => {
        const attrName = getJsxAttributeName(attr.name);
        if (!attrName) {
          return;
        }

        if (isLowercaseEventAttribute(attrName)) {
          pushIssue(errors, getNodeLine(attr), 'event-lowercase', t('publish.lint_event_lowercase', attrName, getCanonicalEventName(attrName)), disableMap);
          return;
        }

        if (!isEventAttribute(attrName)) {
          return;
        }

        if (!attr.value || attr.value.type !== 'JSXExpressionContainer') {
          pushIssue(errors, getNodeLine(attr), 'event-call-result', t('publish.lint_event_call_result'), disableMap);
          return;
        }

        const expression = attr.value.expression;

        if (isThisOrSelfMember(expression)) {
          pushIssue(errors, getNodeLine(attr), 'event-direct-method', t('publish.lint_event_direct_method'), disableMap);
          return;
        }

        if (isBindThisCall(expression)) {
          pushIssue(errors, getNodeLine(attr), 'event-bind-this', t('publish.lint_event_bind_this'), disableMap);
          return;
        }

        if (expression && expression.type === 'CallExpression') {
          pushIssue(errors, getNodeLine(attr), 'event-call-result', t('publish.lint_event_call_result'), disableMap);
          return;
        }

        if (expression && expression.type === 'ArrowFunctionExpression') {
          if (expressionIsBareHandlerReference(expression.body)) {
            pushIssue(errors, getNodeLine(attr), 'event-noop-arrow', t('publish.lint_event_noop_arrow'), disableMap);
            return;
          }
          if (expression.body && expression.body.type === 'BlockStatement' && blockContainsBareHandlerReference(expression.body)) {
            pushIssue(errors, getNodeLine(attr), 'event-noop-arrow', t('publish.lint_event_noop_arrow'), disableMap);
          }
        }
      });
    },
  });
}

function lintYidaSource(sourceCode, filePath) {
  const errors = [];
  const warnings = [];
  const lines = sourceCode.split('\n');
  const disableMap = buildLineDisableMap(lines);

  const hasRenderJsx = /export\s+function\s+renderJsx\s*\(/.test(sourceCode);
  if (!hasRenderJsx) {
    pushIssue(errors, 1, 'missing-render-jsx', t('publish.lint_missing_render_jsx'), disableMap);
  }

  if (/\buse(State|Effect|Memo|Callback|Ref|Reducer|Context)\s*\(/.test(sourceCode)) {
    pushIssue(errors, 1, 'react-hooks', t('publish.lint_react_hooks'), disableMap);
  }

  if (/export\s+default\b/.test(sourceCode)) {
    pushIssue(errors, 1, 'export-default', t('publish.lint_export_default'), disableMap);
  }

  if (filePath && /\.js$/i.test(filePath) && hasRenderJsx && /<[A-Za-z][\w.-]*(\s|>)/.test(sourceCode)) {
    pushIssue(warnings, 1, 'jsx-extension', t('publish.lint_jsx_extension'), disableMap);
  }

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      return;
    }

    const importRequireMatch = line.match(/^\s*import\s+|\brequire\s*\(/);
    if (importRequireMatch && !isInCommentOrString(line, importRequireMatch.index)) {
      pushIssue(errors, lineNumber, 'import-require', t('publish.lint_import_require'), disableMap);
    }

    const legacyEchartsMapMatch = line.match(/(?:echarts(?:\.min)?\.js\/map\/js\/china|echarts\/map\/js\/china|map\/js\/china(?:\.js)?)/i);
    if (legacyEchartsMapMatch) {
      pushIssue(errors, lineNumber, 'echarts-legacy-map-china', t('publish.lint_echarts_legacy_map_china'), disableMap);
    }

    const eventFunctionMatch = line.match(/on[A-Z]\w+=\{function\b/);
    if (eventFunctionMatch && !isInCommentOrString(line, eventFunctionMatch.index) && functionCallbackUsesThis(lines, index, eventFunctionMatch.index)) {
      pushIssue(errors, lineNumber, 'event-function', t('publish.lint_event_function'), disableMap);
    }

    const directMethodMatch = line.match(/on[A-Z]\w+=\{this\.[A-Za-z_$][\w$]*\s*\}/);
    if (directMethodMatch && !isInCommentOrString(line, directMethodMatch.index)) {
      pushIssue(errors, lineNumber, 'event-direct-method', t('publish.lint_event_direct_method'), disableMap);
    }

    const bindMatch = line.match(/on[A-Z]\w+=\{[^}]*\.bind\(this\)[^}]*\}/);
    if (bindMatch && !isInCommentOrString(line, bindMatch.index)) {
      pushIssue(errors, lineNumber, 'event-bind-this', t('publish.lint_event_bind_this'), disableMap);
    }

    const constLetMatch = line.match(/\b(const|let)\s+/);
    if (constLetMatch && !isInCommentOrString(line, constLetMatch.index)) {
      pushIssue(warnings, lineNumber, 'const-let', t('publish.lint_const_let'), disableMap);
    }

    const computedMatch = line.match(/\{\s*\[/);
    if (computedMatch && !isInCommentOrString(line, computedMatch.index)) {
      pushIssue(errors, lineNumber, 'computed-property', t('publish.lint_computed_property'), disableMap);
    }

    const padMatch = line.match(/\.(padStart|padEnd)\s*\(/);
    if (padMatch && !isInCommentOrString(line, padMatch.index)) {
      pushIssue(warnings, lineNumber, 'pad-method', t('publish.lint_pad_method', padMatch[1]), disableMap);
    }

    const mapFilterFunctionMatch = line.match(/\.(map|filter)\s*\(\s*function\b/);
    if (mapFilterFunctionMatch && !isInCommentOrString(line, mapFilterFunctionMatch.index) && functionCallbackUsesThis(lines, index, mapFilterFunctionMatch.index)) {
      pushIssue(errors, lineNumber, 'array-callback-function', t('publish.lint_array_callback_function', mapFilterFunctionMatch[1]), disableMap);
    }

    const forEachFunctionMatch = line.match(/\.forEach\s*\(\s*function\b/);
    if (forEachFunctionMatch && !isInCommentOrString(line, forEachFunctionMatch.index) && functionCallbackUsesThis(lines, index, forEachFunctionMatch.index)) {
      pushIssue(warnings, lineNumber, 'foreach-callback-function', t('publish.lint_foreach_callback_function'), disableMap);
    }

    const controlledInputMatch = line.match(/<input\b[^>]*\bvalue=/);
    if (controlledInputMatch && !isInCommentOrString(line, controlledInputMatch.index)) {
      pushIssue(errors, lineNumber, 'controlled-input', t('publish.lint_controlled_input'), disableMap);
    }

    const nativeSelectMatch = line.match(/<select\b/);
    if (nativeSelectMatch && !isInCommentOrString(line, nativeSelectMatch.index)) {
      pushIssue(warnings, lineNumber, 'native-select-ui', t('publish.lint_native_select_ui'), disableMap);
    }

    const iframeSelfNavigationMatch = line.match(/<a\b(?=[^>]*(?:aliwork\.com|yidaapps\.com|\/preview\/|\/workbench))(?!(?=[^>]*\btarget=(['"]?)_top\1))(?!(?=[^>]*\btarget=(['"]?)_blank\2))[^>]*>/i);
    if (iframeSelfNavigationMatch && !isInCommentOrString(line, iframeSelfNavigationMatch.index)) {
      pushIssue(warnings, lineNumber, 'iframe-self-navigation', t('publish.lint_iframe_self_navigation'), disableMap);
    }

    const topLocationMatch = line.match(/window\.location\.href\s*=\s*[^;\n]*(?:aliwork\.com|yidaapps\.com|\/preview\/|\/workbench)/i);
    if (topLocationMatch && !isInCommentOrString(line, topLocationMatch.index) && !line.includes('window.top.location')) {
      pushIssue(warnings, lineNumber, 'iframe-self-navigation', t('publish.lint_iframe_self_navigation'), disableMap);
    }

    const pageSizeMatch = line.match(/\bpageSize\s*:\s*(\d+)/);
    if (pageSizeMatch && Number(pageSizeMatch[1]) > 100 && !isInCommentOrString(line, pageSizeMatch.index)) {
      pushIssue(errors, lineNumber, 'page-size-limit', t('publish.lint_page_size_limit', pageSizeMatch[1]), disableMap);
    }
  });

  detectLargeThenCallbacks(lines).forEach(({ line, lineCount }) => {
    pushIssue(warnings, line, 'large-then-callback', t('publish.lint_large_then_callback', lineCount, THEN_CALLBACK_LINE_LIMIT), disableMap);
  });

  detectYidaCallsWithoutCatch(sourceCode, warnings, disableMap);
  detectEchartsRichLabelFormatter(sourceCode, warnings, disableMap);
  collectAstLintIssues(sourceCode, errors, warnings, disableMap);

  return { errors, warnings };
}

function printLintResult(lintResult, options = {}) {
  const { successMessage = true } = options;
  const { errors, warnings } = lintResult;
  const hasIssues = errors.length > 0 || warnings.length > 0;

  if (!hasIssues) {
    if (successMessage) {
      success(t('publish.lint_passed'));
    }
    return true;
  }

  warn(t('publish.lint_title'));

  errors.forEach(({ line, message }) => {
    fail(t('publish.lint_error_line', line, message));
  });

  warnings.forEach(({ line, message }) => {
    warn(t('publish.lint_warning_line', line, message));
  });

  if (errors.length > 0) {
    fail(t('publish.lint_fix_errors'));
    hint(t('publish.lint_skip_hint'));
    return false;
  }

  return true;
}

function runLintCheck(sourceCode, filePath, options = {}) {
  return printLintResult(lintYidaSource(sourceCode, filePath), options);
}

module.exports = {
  lintYidaSource,
  printLintResult,
  runLintCheck,
};
