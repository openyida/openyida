'use strict';

const { t } = require('../core/i18n');
const { warn, fail, hint, success } = require('../core/chalk');

const THEN_CALLBACK_LINE_LIMIT = 50;

function isInCommentOrString(line, matchIndex) {
  const beforeMatch = line.substring(0, matchIndex);
  if (beforeMatch.includes('//')) {
    return true;
  }

  const quotes = (beforeMatch.match(/['"]/g) || []).length;
  return quotes % 2 !== 0;
}

function pushIssue(list, line, rule, message) {
  list.push({ line, rule, message });
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

function detectYidaCallsWithoutCatch(sourceCode, warnings) {
  const callRegex = /this\.utils\.yida\.[A-Za-z_$][\w$]*\s*\(/g;
  let match;

  while ((match = callRegex.exec(sourceCode)) !== null) {
    const before = sourceCode.slice(0, match.index);
    const line = before.split('\n').length;
    const statement = sourceCode.slice(match.index, match.index + 600);

    if (!statement.includes('.catch(')) {
      pushIssue(warnings, line, 'yida-api-catch', t('publish.lint_yida_api_catch'));
    }
  }
}

function lintYidaSource(sourceCode, filePath) {
  const errors = [];
  const warnings = [];
  const lines = sourceCode.split('\n');

  const hasRenderJsx = /export\s+function\s+renderJsx\s*\(/.test(sourceCode);
  if (!hasRenderJsx) {
    pushIssue(errors, 1, 'missing-render-jsx', t('publish.lint_missing_render_jsx'));
  }

  if (/\buse(State|Effect|Memo|Callback|Ref|Reducer|Context)\s*\(/.test(sourceCode)) {
    pushIssue(errors, 1, 'react-hooks', t('publish.lint_react_hooks'));
  }

  if (/export\s+default\b/.test(sourceCode)) {
    pushIssue(errors, 1, 'export-default', t('publish.lint_export_default'));
  }

  if (filePath && /\.js$/i.test(filePath) && hasRenderJsx && /<[A-Za-z][\w.-]*(\s|>)/.test(sourceCode)) {
    pushIssue(warnings, 1, 'jsx-extension', t('publish.lint_jsx_extension'));
  }

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      return;
    }

    const importRequireMatch = line.match(/^\s*import\s+|\brequire\s*\(/);
    if (importRequireMatch && !isInCommentOrString(line, importRequireMatch.index)) {
      pushIssue(errors, lineNumber, 'import-require', t('publish.lint_import_require'));
    }

    const eventFunctionMatch = line.match(/on[A-Z]\w+=\{function\b/);
    if (eventFunctionMatch && !isInCommentOrString(line, eventFunctionMatch.index)) {
      pushIssue(errors, lineNumber, 'event-function', t('publish.lint_event_function'));
    }

    const directMethodMatch = line.match(/on[A-Z]\w+=\{this\.[A-Za-z_$][\w$]*\s*\}/);
    if (directMethodMatch && !isInCommentOrString(line, directMethodMatch.index)) {
      pushIssue(errors, lineNumber, 'event-direct-method', t('publish.lint_event_direct_method'));
    }

    const bindMatch = line.match(/on[A-Z]\w+=\{[^}]*\.bind\(this\)[^}]*\}/);
    if (bindMatch && !isInCommentOrString(line, bindMatch.index)) {
      pushIssue(errors, lineNumber, 'event-bind-this', t('publish.lint_event_bind_this'));
    }

    const constLetMatch = line.match(/\b(const|let)\s+/);
    if (constLetMatch && !isInCommentOrString(line, constLetMatch.index)) {
      pushIssue(warnings, lineNumber, 'const-let', t('publish.lint_const_let'));
    }

    const computedMatch = line.match(/\{\s*\[/);
    if (computedMatch && !isInCommentOrString(line, computedMatch.index)) {
      pushIssue(warnings, lineNumber, 'computed-property', t('publish.lint_computed_property'));
    }

    const padMatch = line.match(/\.(padStart|padEnd)\s*\(/);
    if (padMatch && !isInCommentOrString(line, padMatch.index)) {
      pushIssue(warnings, lineNumber, 'pad-method', t('publish.lint_pad_method', padMatch[1]));
    }

    const mapFilterFunctionMatch = line.match(/\.(map|filter)\s*\(\s*function\b/);
    if (mapFilterFunctionMatch && !isInCommentOrString(line, mapFilterFunctionMatch.index)) {
      pushIssue(errors, lineNumber, 'array-callback-function', t('publish.lint_array_callback_function', mapFilterFunctionMatch[1]));
    }

    const forEachFunctionMatch = line.match(/\.forEach\s*\(\s*function\b/);
    if (forEachFunctionMatch && !isInCommentOrString(line, forEachFunctionMatch.index)) {
      pushIssue(warnings, lineNumber, 'foreach-callback-function', t('publish.lint_foreach_callback_function'));
    }

    const controlledInputMatch = line.match(/<input\b[^>]*\bvalue=/);
    if (controlledInputMatch && !isInCommentOrString(line, controlledInputMatch.index)) {
      pushIssue(errors, lineNumber, 'controlled-input', t('publish.lint_controlled_input'));
    }

    const pageSizeMatch = line.match(/\bpageSize\s*:\s*(\d+)/);
    if (pageSizeMatch && Number(pageSizeMatch[1]) > 100 && !isInCommentOrString(line, pageSizeMatch.index)) {
      pushIssue(errors, lineNumber, 'page-size-limit', t('publish.lint_page_size_limit', pageSizeMatch[1]));
    }
  });

  detectLargeThenCallbacks(lines).forEach(({ line, lineCount }) => {
    pushIssue(warnings, line, 'large-then-callback', t('publish.lint_large_then_callback', lineCount, THEN_CALLBACK_LINE_LIMIT));
  });

  detectYidaCallsWithoutCatch(sourceCode, warnings);

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
