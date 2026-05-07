'use strict';

const {
  analyzeFormula,
  collectSchemaFieldIds,
  parseArgs,
} = require('../lib/formula/evaluate');

describe('formula evaluate parseArgs', () => {
  test('parses formula evaluator options', () => {
    expect(parseArgs([
      'IF(GT(#{numberField_total}, 100), "high", "low")',
      '--schema',
      '.cache/schema.json',
      '--json',
      '--strict',
    ])).toEqual({
      formulaInput: 'IF(GT(#{numberField_total}, 100), "high", "low")',
      schemaPath: '.cache/schema.json',
      json: true,
      strict: true,
      help: false,
    });
  });
});

describe('collectSchemaFieldIds', () => {
  test('collects field ids from nested schema objects', () => {
    const fieldIds = collectSchemaFieldIds({
      content: {
        pages: [
          {
            componentsTree: [
              {
                props: { fieldId: 'textField_name' },
                children: [
                  { props: { fieldId: 'numberField_total' } },
                ],
              },
            ],
          },
        ],
      },
    });

    expect(Array.from(fieldIds).sort()).toEqual(['numberField_total', 'textField_name']);
  });
});

describe('analyzeFormula', () => {
  test('accepts a basic formula with known functions and schema refs', () => {
    const result = analyzeFormula(
      'IF(GT(#{numberField_total}, 100), "high", "low")',
      { schemaFieldIds: new Set(['numberField_total']) }
    );

    expect(result.ok).toBe(true);
    expect(result.fieldRefs).toEqual(['numberField_total']);
    expect(result.metrics.functionCallCount).toBe(2);
  });

  test('reports missing schema field refs as blocking errors', () => {
    const result = analyzeFormula(
      'IF(GT(#{numberField_total}, 100), "high", "low")',
      { schemaFieldIds: new Set(['numberField_other']) }
    );

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'field_ref_not_in_schema', level: 'error' }),
    ]));
  });

  test('warns about risky operators and full-width punctuation', () => {
    const result = analyzeFormula('IF(#{numberField_total} >= 100，"high"，"low")');
    const codes = result.diagnostics.map(item => item.code);

    expect(codes).toContain('comparison_operator');
    expect(codes).toContain('fullwidth_punctuation');
  });

  test('detects unbalanced field refs and parentheses', () => {
    const result = analyzeFormula('IF(#{numberField_total, "x"');
    const codes = result.diagnostics.map(item => item.code);

    expect(result.ok).toBe(false);
    expect(codes).toContain('field_ref_unclosed');
    expect(codes).toContain('parenthesis_unclosed');
  });
});
