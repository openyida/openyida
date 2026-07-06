'use strict';

const {
  stripSubtableFieldPrefix,
  normalizeFormulaFieldRefs,
} = require('../lib/formula/evaluate');

describe('stripSubtableFieldPrefix', () => {
  test('strips a subtable prefix from a single reference', () => {
    expect(stripSubtableFieldPrefix('#{tableField_abc123.dateField_ieae4v66g}')).toEqual({
      value: '#{dateField_ieae4v66g}',
      count: 1,
    });
  });

  test('strips the prefix from every reference in one formula', () => {
    expect(stripSubtableFieldPrefix('SUM(#{tableField_a.numberField_x} + #{tableField_a.numberField_y})')).toEqual({
      value: 'SUM(#{numberField_x} + #{numberField_y})',
      count: 2,
    });
  });

  test('leaves clean plain references untouched', () => {
    expect(stripSubtableFieldPrefix('#{numberField_x}')).toEqual({
      value: '#{numberField_x}',
      count: 0,
    });
  });

  test('tolerates whitespace inside the reference', () => {
    expect(stripSubtableFieldPrefix('#{ tableField_a.numberField_x }')).toEqual({
      value: '#{numberField_x}',
      count: 1,
    });
  });

  test('does not touch a JS regex quantifier like #{1,3}', () => {
    const src = 'line.match(/^(#{1,3})\\s+(.+)$/)';
    expect(stripSubtableFieldPrefix(src)).toEqual({ value: src, count: 0 });
  });

  test('returns non-strings unchanged', () => {
    expect(stripSubtableFieldPrefix(42)).toEqual({ value: 42, count: 0 });
    expect(stripSubtableFieldPrefix(null)).toEqual({ value: null, count: 0 });
    expect(stripSubtableFieldPrefix(undefined)).toEqual({ value: undefined, count: 0 });
  });
});

describe('normalizeFormulaFieldRefs', () => {
  test('fixes both formula and complexValue.formula on a field (screenshot case)', () => {
    const field = {
      componentName: 'EmployeeField',
      props: {
        complexValue: {
          complexType: 'formula',
          formula: '#{tableField_xxx.dateField_ieae4v66g}',
        },
        formula: '#{tableField_xxx.dateField_ieae4v66g}',
      },
    };

    const fixed = normalizeFormulaFieldRefs(field);

    expect(fixed).toBe(2);
    expect(field.props.complexValue.formula).toBe('#{dateField_ieae4v66g}');
    expect(field.props.formula).toBe('#{dateField_ieae4v66g}');
  });

  test('recurses into nested component arrays', () => {
    const schema = {
      content: [
        {
          componentName: 'TableField',
          children: [
            { props: { formula: '#{tableField_t.numberField_a}' } },
            { props: { formula: 'ROUND(#{tableField_t.numberField_b}, 2)' } },
          ],
        },
      ],
    };

    const fixed = normalizeFormulaFieldRefs(schema);

    expect(fixed).toBe(2);
    expect(schema.content[0].children[0].props.formula).toBe('#{numberField_a}');
    expect(schema.content[0].children[1].props.formula).toBe('ROUND(#{numberField_b}, 2)');
  });

  test('returns 0 and mutates nothing for a clean schema', () => {
    const schema = { props: { formula: '#{numberField_x}', label: 'total' } };
    const snapshot = JSON.parse(JSON.stringify(schema));

    expect(normalizeFormulaFieldRefs(schema)).toBe(0);
    expect(schema).toEqual(snapshot);
  });

  test('is safe on empty/non-object input', () => {
    expect(normalizeFormulaFieldRefs(null)).toBe(0);
    expect(normalizeFormulaFieldRefs(undefined)).toBe(0);
    expect(normalizeFormulaFieldRefs({})).toBe(0);
    expect(normalizeFormulaFieldRefs([])).toBe(0);
  });
});
