'use strict';

const fs = require('fs');
const path = require('path');

const KNOWN_FUNCTIONS = new Set([
  'ABS',
  'AND',
  'ARRAYGET',
  'AVG',
  'CEILING',
  'CONCATENATE',
  'DATE',
  'DATEDELTA',
  'DAY',
  'DAYS',
  'EQ',
  'FLOOR',
  'GE',
  'GT',
  'IF',
  'ISEMPTY',
  'LE',
  'LEFT',
  'LEN',
  'LOWER',
  'LT',
  'MAX',
  'MID',
  'MIN',
  'MONTH',
  'NE',
  'NETWORKDAYS',
  'NOT',
  'NOW',
  'OR',
  'RMBFORMAT',
  'ROUND',
  'SPLIT',
  'SUM',
  'TEXT',
  'TIMESTAMP',
  'TODAY',
  'TRIM',
  'UPPER',
  'UUID',
  'VALUE',
  'YEAR',
]);

const CHINESE_PUNCTUATION = {
  '，': ',',
  '；': ',',
  '（': '(',
  '）': ')',
  '“': '"',
  '”': '"',
  '‘': "'",
  '’': "'",
};

const COMPARISON_OPERATORS = [
  { token: '>=', replacement: 'GE(left, right)' },
  { token: '<=', replacement: 'LE(left, right)' },
  { token: '==', replacement: 'EQ(left, right)' },
  { token: '!=', replacement: 'NE(left, right)' },
  { token: '>', replacement: 'GT(left, right)' },
  { token: '<', replacement: 'LT(left, right)' },
  { token: '=', replacement: 'EQ(left, right)' },
];

function parseArgs(args) {
  const parsed = {
    formulaInput: '',
    schemaPath: '',
    json: false,
    strict: false,
    help: false,
  };
  const formulaParts = [];

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--json') {
      parsed.json = true;
    } else if (arg === '--strict') {
      parsed.strict = true;
    } else if ((arg === '--schema' || arg === '-s') && args[index + 1]) {
      parsed.schemaPath = args[index + 1];
      index++;
    } else if (!arg.startsWith('--')) {
      formulaParts.push(arg);
    }
  }

  parsed.formulaInput = formulaParts.join(' ').trim();
  return parsed;
}

function usage() {
  return [
    'Usage: openyida formula evaluate <formula|file> [--schema schema.json] [--json] [--strict]',
    'Example: openyida formula evaluate \'IF(GT(#{numberField_total}, 100), "high", "low")\' --schema .cache/schema.json',
  ].join('\n');
}

function createDiagnostic(level, code, message, details = {}) {
  return {
    level,
    code,
    message,
    ...details,
  };
}

function readFormulaInput(formulaInput) {
  const resolved = path.resolve(formulaInput);
  if (formulaInput && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    return fs.readFileSync(resolved, 'utf-8').replace(/^\uFEFF/, '').trim();
  }
  return String(formulaInput || '').trim();
}

function loadSchemaFieldIds(schemaPath) {
  if (!schemaPath) {
    return null;
  }
  const resolved = path.resolve(schemaPath);
  const schema = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
  return collectSchemaFieldIds(schema);
}

function collectSchemaFieldIds(value) {
  const fieldIds = new Set();

  function visit(node) {
    if (!node || typeof node !== 'object') {
      return;
    }

    if (typeof node.fieldId === 'string' && node.fieldId) {
      fieldIds.add(node.fieldId);
    }

    for (const child of Object.values(node)) {
      if (Array.isArray(child)) {
        child.forEach(visit);
      } else if (child && typeof child === 'object') {
        visit(child);
      }
    }
  }

  visit(value);
  return fieldIds;
}

function scanOutsideStrings(formula, callback) {
  let quote = '';
  let escaped = false;

  for (let index = 0; index < formula.length; index++) {
    const char = formula[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    callback(char, index);
  }
}

function maskIgnoredRanges(formula) {
  const chars = formula.split('');
  let quote = '';
  let escaped = false;

  for (let index = 0; index < chars.length; index++) {
    const char = chars[index];
    if (quote) {
      chars[index] = ' ';
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      chars[index] = ' ';
      continue;
    }

    if (char === '#' && chars[index + 1] === '{') {
      chars[index] = ' ';
      chars[index + 1] = ' ';
      index += 2;
      while (index < chars.length && chars[index] !== '}') {
        chars[index] = ' ';
        index++;
      }
      if (index < chars.length) {
        chars[index] = ' ';
      }
    }
  }

  return chars.join('');
}

function collectFieldRefs(formula, diagnostics) {
  const refs = [];
  let quote = '';
  let escaped = false;

  for (let index = 0; index < formula.length; index++) {
    const char = formula[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char !== '#') {
      continue;
    }

    if (formula[index + 1] !== '{') {
      diagnostics.push(createDiagnostic(
        'warning',
        'field_ref_missing_brace',
        'Field references should use #{fieldId}.',
        { index }
      ));
      continue;
    }

    const end = formula.indexOf('}', index + 2);
    if (end === -1) {
      diagnostics.push(createDiagnostic(
        'error',
        'field_ref_unclosed',
        'Field reference is missing a closing }.',
        { index }
      ));
      break;
    }

    const fieldId = formula.slice(index + 2, end).trim();
    if (!fieldId) {
      diagnostics.push(createDiagnostic(
        'error',
        'field_ref_empty',
        'Field reference cannot be empty.',
        { index }
      ));
    } else {
      if (/\s/.test(fieldId)) {
        diagnostics.push(createDiagnostic(
          'warning',
          'field_ref_whitespace',
          `Field reference "${fieldId}" contains whitespace; use the exact fieldId from get-schema.`,
          { fieldId, index }
        ));
      }
      refs.push({ fieldId, index });
    }

    index = end;
  }

  if (quote) {
    diagnostics.push(createDiagnostic(
      'error',
      'string_unclosed',
      `String literal is missing a closing ${quote}.`
    ));
  }

  return refs;
}

function checkParentheses(formula, diagnostics) {
  const stack = [];
  let maxDepth = 0;

  scanOutsideStrings(formula, (char, index) => {
    if (char === '(') {
      stack.push(index);
      maxDepth = Math.max(maxDepth, stack.length);
    } else if (char === ')') {
      if (stack.length === 0) {
        diagnostics.push(createDiagnostic(
          'error',
          'parenthesis_extra_close',
          'Closing parenthesis has no matching opening parenthesis.',
          { index }
        ));
      } else {
        stack.pop();
      }
    }
  });

  for (const index of stack) {
    diagnostics.push(createDiagnostic(
      'error',
      'parenthesis_unclosed',
      'Opening parenthesis has no matching closing parenthesis.',
      { index }
    ));
  }

  return maxDepth;
}

function collectFunctionCalls(formula, diagnostics) {
  const masked = maskIgnoredRanges(formula);
  const calls = [];
  const pattern = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  let match = pattern.exec(masked);

  while (match) {
    const name = match[1];
    const upperName = name.toUpperCase();
    const call = {
      name,
      normalizedName: upperName,
      index: match.index,
    };
    calls.push(call);

    if (KNOWN_FUNCTIONS.has(upperName) && name !== upperName) {
      diagnostics.push(createDiagnostic(
        'warning',
        'function_case',
        `Function "${name}" is known; prefer uppercase "${upperName}" for Yida formulas.`,
        { functionName: name, suggestion: upperName, index: match.index }
      ));
    } else if (!KNOWN_FUNCTIONS.has(upperName)) {
      diagnostics.push(createDiagnostic(
        'warning',
        'function_unknown',
        `Function "${name}" is not in the local OpenYida formula reference. Verify it in Yida before publishing.`,
        { functionName: name, index: match.index }
      ));
    }

    match = pattern.exec(masked);
  }

  return calls;
}

function checkPunctuation(formula, diagnostics) {
  scanOutsideStrings(formula, (char, index) => {
    if (Object.prototype.hasOwnProperty.call(CHINESE_PUNCTUATION, char)) {
      diagnostics.push(createDiagnostic(
        'warning',
        'fullwidth_punctuation',
        `Full-width punctuation "${char}" may break formulas; use "${CHINESE_PUNCTUATION[char]}".`,
        { index, suggestion: CHINESE_PUNCTUATION[char] }
      ));
    } else if (char === ';') {
      diagnostics.push(createDiagnostic(
        'warning',
        'semicolon_argument_separator',
        'Yida formulas normally use commas between function arguments, not semicolons.',
        { index, suggestion: ',' }
      ));
    }
  });
}

function checkOperators(formula, diagnostics) {
  const masked = maskIgnoredRanges(formula);

  for (let index = 0; index < masked.length; index++) {
    const pair = masked.slice(index, index + 2);
    const twoCharOperator = COMPARISON_OPERATORS.find(entry => entry.token === pair);
    if (twoCharOperator) {
      diagnostics.push(createDiagnostic(
        'warning',
        'comparison_operator',
        `Direct comparison operator "${pair}" is risky in Yida formulas; use ${twoCharOperator.replacement}.`,
        { index, suggestion: twoCharOperator.replacement }
      ));
      index++;
      continue;
    }

    const char = masked[index];
    if (char === '>' || char === '<' || char === '=') {
      const operator = COMPARISON_OPERATORS.find(entry => entry.token === char);
      diagnostics.push(createDiagnostic(
        'warning',
        'comparison_operator',
        `Direct comparison operator "${char}" is risky in Yida formulas; use ${operator.replacement}.`,
        { index, suggestion: operator.replacement }
      ));
    } else if (char === '&' && masked[index + 1] === '&') {
      diagnostics.push(createDiagnostic(
        'warning',
        'logical_operator',
        'Use AND(a, b) instead of && in Yida formulas.',
        { index, suggestion: 'AND(left, right)' }
      ));
      index++;
    } else if (char === '|' && masked[index + 1] === '|') {
      diagnostics.push(createDiagnostic(
        'warning',
        'logical_operator',
        'Use OR(a, b) instead of || in Yida formulas.',
        { index, suggestion: 'OR(left, right)' }
      ));
      index++;
    }
  }
}

function checkSchemaFieldRefs(fieldRefs, schemaFieldIds, diagnostics) {
  if (!schemaFieldIds) {
    return;
  }

  for (const ref of fieldRefs) {
    if (!schemaFieldIds.has(ref.fieldId)) {
      diagnostics.push(createDiagnostic(
        'error',
        'field_ref_not_in_schema',
        `Field reference "#{${ref.fieldId}}" was not found in the provided schema.`,
        { fieldId: ref.fieldId, index: ref.index }
      ));
    }
  }
}

function analyzeFormula(formula, options = {}) {
  const diagnostics = [];
  const normalized = String(formula || '').trim();

  if (!normalized) {
    diagnostics.push(createDiagnostic('error', 'formula_empty', 'Formula is empty.'));
    return {
      ok: false,
      formula: normalized,
      diagnostics,
      fieldRefs: [],
      functions: [],
      metrics: {
        length: 0,
        fieldRefCount: 0,
        uniqueFieldRefCount: 0,
        functionCallCount: 0,
        maxParenDepth: 0,
      },
    };
  }

  checkPunctuation(normalized, diagnostics);
  checkOperators(normalized, diagnostics);
  const fieldRefs = collectFieldRefs(normalized, diagnostics);
  const functions = collectFunctionCalls(normalized, diagnostics);
  const maxParenDepth = checkParentheses(normalized, diagnostics);
  const schemaFieldIds = options.schemaFieldIds || null;
  checkSchemaFieldRefs(fieldRefs, schemaFieldIds, diagnostics);

  const uniqueFieldRefs = Array.from(new Set(fieldRefs.map(ref => ref.fieldId)));
  const metrics = {
    length: normalized.length,
    fieldRefCount: fieldRefs.length,
    uniqueFieldRefCount: uniqueFieldRefs.length,
    functionCallCount: functions.length,
    maxParenDepth,
  };

  if (metrics.length > 1000) {
    diagnostics.push(createDiagnostic(
      'warning',
      'formula_long',
      'Formula is longer than 1000 characters; consider splitting logic into helper fields.'
    ));
  }
  if (metrics.maxParenDepth > 10) {
    diagnostics.push(createDiagnostic(
      'warning',
      'formula_deep',
      'Formula nesting is deep; review readability and platform limits.'
    ));
  }
  if (metrics.functionCallCount > 30) {
    diagnostics.push(createDiagnostic(
      'warning',
      'formula_many_functions',
      'Formula has many function calls; consider simplifying before publishing.'
    ));
  }

  return {
    ok: diagnostics.every(item => item.level !== 'error'),
    formula: normalized,
    diagnostics,
    fieldRefs: uniqueFieldRefs,
    functions: functions.map(call => call.name),
    metrics,
  };
}

function renderText(result) {
  const lines = [];
  const errors = result.diagnostics.filter(item => item.level === 'error');
  const warnings = result.diagnostics.filter(item => item.level === 'warning');

  lines.push('openyida formula evaluate - static check');
  lines.push(result.ok ? 'OK: no blocking issues found.' : `ERROR: ${errors.length} blocking issue(s) found.`);
  lines.push(`Warnings: ${warnings.length}`);
  lines.push('');

  if (result.diagnostics.length > 0) {
    lines.push('Diagnostics:');
    result.diagnostics.forEach((item) => {
      const location = typeof item.index === 'number' ? ` @${item.index}` : '';
      lines.push(`  [${item.level}] ${item.code}${location}: ${item.message}`);
    });
    lines.push('');
  }

  lines.push('Metrics:');
  lines.push(`  length: ${result.metrics.length}`);
  lines.push(`  field refs: ${result.metrics.fieldRefCount} (${result.metrics.uniqueFieldRefCount} unique)`);
  lines.push(`  function calls: ${result.metrics.functionCallCount}`);
  lines.push(`  max parenthesis depth: ${result.metrics.maxParenDepth}`);

  if (result.fieldRefs.length > 0) {
    lines.push('');
    lines.push('Field refs:');
    result.fieldRefs.forEach(fieldId => lines.push(`  - ${fieldId}`));
  }

  return lines.join('\n');
}

async function run(args) {
  const parsed = parseArgs(args);

  if (parsed.help || !parsed.formulaInput) {
    console.log(usage());
    if (!parsed.help) {
      process.exit(1);
    }
    return;
  }

  const formula = readFormulaInput(parsed.formulaInput);
  const schemaFieldIds = loadSchemaFieldIds(parsed.schemaPath);
  const result = analyzeFormula(formula, { schemaFieldIds });

  if (parsed.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(renderText(result));
  }

  if (parsed.strict && !result.ok) {
    process.exit(1);
  }
}

module.exports = {
  KNOWN_FUNCTIONS,
  analyzeFormula,
  collectSchemaFieldIds,
  parseArgs,
  readFormulaInput,
  renderText,
  run,
};
