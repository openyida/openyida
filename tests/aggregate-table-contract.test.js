'use strict';

const {
  DEFAULT_LIMITS,
  assertAggregateDesignConfig,
  projectAggregateDesignConfig,
  validateAggregateDesignConfig,
} = require('../lib/aggregate-table/contract');

function buildValidConfig(overrides = {}) {
  return {
    formUuid: 'FORM-VIEW',
    relationForms: [{ formUuid: 'FORM-SOURCE' }],
    relationships: [{
      relationId: 'REL-1',
      relationshipInfos: [{ id: 'field_name', name: '名称' }],
    }],
    aggregatedFields: [{ id: 'REL-1', name: '名称' }],
    auxFields: [],
    formulaFields: [{ id: 'metric_count', name: '数量', formula: 'COUNT(field_name)' }],
    validators: [],
    ...overrides,
  };
}

function buildTwoSourceConfig(overrides = {}) {
  return buildValidConfig({
    relationForms: [
      { formUuid: 'FORM-SOURCE-A' },
      { formUuid: 'FORM-SOURCE-B' },
    ],
    relationships: [{
      relationId: 'REL-1',
      relationshipInfos: [
        { id: 'field_name_a', name: '名称', formUuid: 'FORM-SOURCE-A' },
        { id: 'field_name_b', name: '名称', formUuid: 'FORM-SOURCE-B' },
      ],
    }],
    ...overrides,
  });
}

describe('aggregate-table frontend contract', () => {
  test('accepts a publishable designer payload and keeps filters optional', () => {
    const result = validateAggregateDesignConfig(buildValidConfig(), { mode: 'publish' });

    expect(result).toEqual({ valid: true, errors: [] });
  });

  test.each([
    ['relationForms', [], 'AGGREGATE_RELATION_FORMS_REQUIRED'],
    ['relationships', [], 'AGGREGATE_RELATIONSHIPS_REQUIRED'],
    ['aggregatedFields', [], 'AGGREGATE_COLUMNS_REQUIRED'],
    ['formulaFields', [], 'AGGREGATE_FORMULA_FIELDS_REQUIRED'],
  ])('rejects incomplete publish config: %s', (key, value, code) => {
    const result = validateAggregateDesignConfig(buildValidConfig({ [key]: value }), { mode: 'publish' });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code }),
    ]));
  });

  test('rejects invalid relationship, column, formula, and validator entries', () => {
    const result = validateAggregateDesignConfig(buildValidConfig({
      relationships: [{ relationId: 'REL-1', relationshipInfos: [null] }],
      aggregatedFields: [{ id: 'REL-1', name: '' }],
      formulaFields: [{ id: 'metric_count', formula: '' }],
      validators: [{ formula: '' }],
    }), { mode: 'publish' });

    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toEqual(expect.arrayContaining([
      'AGGREGATE_RELATIONSHIP_INVALID',
      'AGGREGATE_COLUMN_INVALID',
      'AGGREGATE_FORMULA_FIELD_INVALID',
      'AGGREGATE_VALIDATOR_INVALID',
    ]));
  });

  test('draft mode permits incomplete designer state but still enforces array shape and limits', () => {
    expect(validateAggregateDesignConfig({
      relationForms: [],
      relationships: [],
      aggregatedFields: [],
      auxFields: [],
      formulaFields: [],
      validators: [],
    }, { mode: 'draft' })).toEqual({ valid: true, errors: [] });

    const tooManySources = Array.from(
      { length: DEFAULT_LIMITS.relationForms + 1 },
      (_, index) => ({ formUuid: `FORM-${index}` })
    );
    const invalid = validateAggregateDesignConfig(buildValidConfig({
      relationForms: tooManySources,
    }), { mode: 'draft' });

    expect(invalid.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'AGGREGATE_RELATION_FORMS_LIMIT' }),
    ]));
  });

  test('rejects malformed array values instead of normalizing them into an empty design', () => {
    const invalid = validateAggregateDesignConfig(buildValidConfig({
      auxFields: { id: 'aux-1', name: '辅助列' },
    }), { mode: 'draft' });

    expect(invalid.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'AGGREGATE_DESIGN_ARRAY_REQUIRED',
        path: 'auxFields',
      }),
    ]));
  });

  test('requires each relationship to describe every selected source', () => {
    const invalid = validateAggregateDesignConfig(buildTwoSourceConfig({
      relationships: [{
        relationId: 'REL-1',
        relationshipInfos: [{ id: 'field_name_a', name: '名称' }],
      }],
    }), { mode: 'publish' });

    expect(invalid.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'AGGREGATE_RELATIONSHIP_SOURCE_COUNT_MISMATCH' }),
    ]));
  });

  test('enforces unique relationship ids and exact published column mapping', () => {
    const invalid = validateAggregateDesignConfig(buildValidConfig({
      relationships: [
        { relationId: 'REL-1', relationshipInfos: [{ id: 'field_a', name: '名称' }] },
        { relationId: 'REL-1', relationshipInfos: [{ id: 'field_b', name: '编号' }] },
      ],
      aggregatedFields: [{ id: 'REL-OTHER', name: '名称' }],
    }), { mode: 'publish' });

    expect(invalid.errors.map((error) => error.code)).toEqual(expect.arrayContaining([
      'AGGREGATE_RELATIONSHIP_ID_DUPLICATE',
      'AGGREGATE_COLUMN_RELATION_MISMATCH',
    ]));
  });

  test('validates metric names, validator prompt text, filters, and auxiliary field uniqueness', () => {
    const invalid = validateAggregateDesignConfig(buildValidConfig({
      relationForms: [{
        formUuid: 'FORM-SOURCE',
        filter: {
          logicOperator: 'AND',
          rules: Array.from({ length: 11 }, (_, index) => ({
            id: `rule-${index}`,
            operator: index === 0 ? '' : 'EQ',
          })),
        },
      }],
      auxFields: [
        { id: 'aux-1', name: '辅助列' },
        { id: 'aux-1', name: '重复辅助列' },
      ],
      formulaFields: [{ id: 'metric_count', name: '', formula: 'COUNT(field_name)' }],
      validators: [{ formula: 'metric_count > 0', text: { zh_CN: '' } }],
    }), { mode: 'publish' });

    expect(invalid.errors.map((error) => error.code)).toEqual(expect.arrayContaining([
      'AGGREGATE_FILTER_LIMIT',
      'AGGREGATE_FILTER_OPERATOR_REQUIRED',
      'AGGREGATE_AUX_FIELD_ID_DUPLICATE',
      'AGGREGATE_FORMULA_FIELD_INVALID',
      'AGGREGATE_VALIDATOR_INVALID',
    ]));
  });

  test('assert helper throws a stable contract error before a remote write', () => {
    expect(() => assertAggregateDesignConfig(buildValidConfig({
      formulaFields: [],
    }), { mode: 'publish' })).toThrow(expect.objectContaining({
      code: 'AGGREGATE_DESIGN_CONTRACT_INVALID',
    }));
  });

  test('readback projection only compares the six designer-owned arrays', () => {
    expect(projectAggregateDesignConfig({
      ...buildValidConfig(),
      gmtModified: 123,
      stashGmtModified: 456,
      isStashConfig: 'y',
      unknownServerField: 'ignored',
    })).toEqual({
      relationForms: [{ formUuid: 'FORM-SOURCE' }],
      relationships: [{
        relationId: 'REL-1',
        relationshipInfos: [{ id: 'field_name', name: '名称' }],
      }],
      aggregatedFields: [{ id: 'REL-1', name: '名称' }],
      auxFields: [],
      formulaFields: [{ id: 'metric_count', name: '数量', formula: 'COUNT(field_name)' }],
      validators: [],
    });
  });

  test('readback accepts deterministic platform normalization without weakening semantic equality', () => {
    const expected = buildValidConfig({
      relationForms: [{
        formUuid: 'FORM-SOURCE',
        title: { type: 'i18n', zh_CN: '订单', en_US: 'Orders' },
        filter: {},
      }],
      relationships: [{
        relationId: 'REL-1',
        relationshipInfos: [{
          id: 'field_name',
          name: { type: 'i18n', zh_CN: '名称', en_US: 'Name' },
        }],
      }],
      formulaFields: [{
        id: 'metric_count',
        formula: 'COUNT(field_name)',
        name: { type: 'i18n', zh_CN: '数量', en_US: 'Count' },
        props: { precision: 2 },
      }],
    });
    const actual = buildValidConfig({
      relationForms: [{
        formUuid: 'FORM-SOURCE',
        title: {
          type: 'i18n', zh_CN: '订单', en_US: 'Orders', pureEn_US: 'Orders',
          ja_JP: '', key: '', value: '',
        },
        filter: { logicOperator: '', rules: null },
        filterState: null,
      }],
      relationships: [{
        relationId: 'REL-1',
        relationshipInfos: [{
          id: 'field_name',
          parentId: '',
          name: {
            type: 'i18n', zh_CN: '名称', en_US: 'Name', pureEn_US: 'Name',
            ja_JP: '', key: '', value: '',
          },
        }],
      }],
      formulaFields: [{
        id: 'metric_count',
        formula: 'COUNT(field_name)',
        name: {
          type: 'i18n', zh_CN: '数量', en_US: 'Count', pureEn_US: 'Count',
          ja_JP: '', key: '', value: '',
        },
        props: { precision: '2' },
      }],
    });

    expect(() => require('../lib/aggregate-table/contract')
      .assertAggregateDesignReadback(expected, actual)).not.toThrow();

    actual.formulaFields[0].formula = 'COUNT(other_field)';
    expect(() => require('../lib/aggregate-table/contract')
      .assertAggregateDesignReadback(expected, actual)).toThrow(expect.objectContaining({
      code: 'AGGREGATE_DESIGN_READBACK_MISMATCH',
    }));
  });

  test('readback rejects an explicit non-array even when the expected designer array is empty', () => {
    const expected = buildValidConfig({ auxFields: [] });
    const actual = buildValidConfig({ auxFields: { id: 'server-invalid' } });

    expect(() => require('../lib/aggregate-table/contract')
      .assertAggregateDesignReadback(expected, actual)).toThrow(expect.objectContaining({
      code: 'AGGREGATE_DESIGN_READBACK_MISMATCH',
      path: 'auxFields',
    }));
  });
});
