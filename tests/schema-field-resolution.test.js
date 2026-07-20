'use strict';

const {
  createSchemaHash,
  normalizeSchemaFields,
  buildFieldResolution,
} = require('../lib/app/schema-field-resolution');

function buildNestedSchema() {
  return {
    success: true,
    content: {
      pages: [
        {
          componentAlias: {
            items: [{ fieldId: 'textField_top', alias: 'topName' }],
          },
          componentsTree: [
            {
              componentName: 'FormContainer',
              children: [
                {
                  componentName: 'TextField',
                  props: { fieldId: 'textField_top', label: '名称', valueType: 'custom' },
                },
                {
                  componentName: 'TableField',
                  props: { fieldId: 'tableField_a', label: '明细A' },
                  children: [
                    {
                      componentName: 'TextField',
                      props: {
                        fieldId: 'textField_a_name',
                        label: { zh_CN: '名称', en_US: 'Name', ko_KR: '이름' },
                        valueType: 'custom',
                        secret: 'DO_NOT_EXPOSE',
                      },
                    },
                  ],
                },
              ],
            },
            {
              componentName: 'TableField',
              props: { fieldId: 'tableField_b', label: '明细B' },
              children: [
                {
                  componentName: 'TextField',
                  props: {
                    fieldId: 'textField_b_name',
                    label: { zh_CN: '名称', en_US: 'topName' },
                    valueType: 'formula',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

describe('schema field normalizer', () => {
  test('normalizes multiple roots and subtable paths deterministically', () => {
    const fields = normalizeSchemaFields(buildNestedSchema());
    expect(fields.map(field => field.fieldId)).toEqual([
      'textField_top',
      'tableField_a',
      'textField_a_name',
      'tableField_b',
      'textField_b_name',
    ]);
    expect(fields.find(field => field.fieldId === 'textField_a_name')).toMatchObject({
      path: ['tableField_a', 'textField_a_name'],
      labelPath: ['明细A', '名称'],
      parentFieldId: 'tableField_a',
      componentType: 'TextField',
      valueType: 'custom',
    });
  });

  test('returns exact, missing and ambiguous results without first-match guessing', () => {
    const output = buildFieldResolution(
      'APP_XXX',
      'FORM-A',
      buildNestedSchema(),
      ['textField_top', '明细A/名称', '名称', '不存在']
    );

    expect(output.fields.map(field => field.fieldId)).toEqual([
      'textField_top',
      'textField_a_name',
    ]);
    expect(output.missingFields).toEqual(['不存在']);
    expect(output.ambiguousFields).toHaveLength(1);
    expect(output.ambiguousFields[0].query).toBe('名称');
    expect(output.ambiguousFields[0].reason).toBe('multiple_exact_matches');
    expect(output.ambiguousFields[0].matches.map(field => field.fieldId)).toEqual([
      'textField_top',
      'textField_a_name',
      'textField_b_name',
    ]);
    expect(JSON.stringify(output)).not.toContain('DO_NOT_EXPOSE');
  });

  test('matches every localized label and unions exact identities before ambiguity checks', () => {
    const english = buildFieldResolution('APP_XXX', 'FORM-A', buildNestedSchema(), ['Name']);
    const korean = buildFieldResolution('APP_XXX', 'FORM-A', buildNestedSchema(), ['이름']);
    const crossIdentity = buildFieldResolution('APP_XXX', 'FORM-A', buildNestedSchema(), ['topName']);

    expect(english.fields[0]).toMatchObject({
      fieldId: 'textField_a_name',
      matchedBy: ['label:en_US'],
    });
    expect(korean.fields[0]).toMatchObject({
      fieldId: 'textField_a_name',
      matchedBy: ['label:ko_KR'],
    });
    expect(crossIdentity.ambiguousFields[0].matches.map(field => field.fieldId)).toEqual([
      'textField_top',
      'textField_b_name',
    ]);
  });

  test('keeps valueType raw and does not infer unsupported values', () => {
    const schema = buildNestedSchema();
    schema.content.pages[0].componentsTree[0].children[0].props.valueType = { type: 'STRING' };
    expect(normalizeSchemaFields(schema)[0].valueType).toBeNull();
  });

  test('creates the same hash for semantically equal content key order', () => {
    const first = { content: { metadata: { b: 2, a: 1 }, pages: [] }, success: true };
    const second = { success: false, content: { pages: [], metadata: { a: 1, b: 2 } } };
    expect(createSchemaHash(first)).toBe(createSchemaHash(second));
    expect(createSchemaHash(first)).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  test('excludes only the root server revision from the canonical Schema hash', () => {
    const first = { content: { gmtModified: 100, pages: [], metadata: { gmtModified: 1 } } };
    const second = { content: { gmtModified: 101, pages: [], metadata: { gmtModified: 1 } } };
    const nestedChange = { content: { gmtModified: 101, pages: [], metadata: { gmtModified: 2 } } };
    expect(createSchemaHash(first)).toBe(createSchemaHash(second));
    expect(createSchemaHash(first)).not.toBe(createSchemaHash(nestedChange));
  });
});
