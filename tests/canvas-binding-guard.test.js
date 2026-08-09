'use strict';

const {
  extractCanvasBindingContract,
  validateCanvasBindingContract,
} = require('../lib/app/canvas-binding-guard');

function createSchema(fieldId, label) {
  return {
    pages: [{
      componentsTree: [{
        componentName: 'Page',
        children: [{
          componentName: 'FormContainer',
          children: [{
            componentName: 'TextField',
            fieldId,
            props: { fieldId, label: { zh_CN: label } },
          }],
        }],
      }],
    }],
  };
}

describe('Code Canvas binding guard', () => {
  const forms = [
    { formUuid: 'FORM-CUSTOMERS-001', formName: '客户表', formType: 'receipt' },
  ];
  const schemasByFormUuid = {
    'FORM-CUSTOMERS-001': createSchema('textField_customerName_12345', '客户名称'),
  };

  test('extracts the scaffold app, form, and nested field declarations', () => {
    const contract = extractCanvasBindingContract(`
      const APP_TYPE = 'APP_REAL';
      const FORM_UUIDS = { primary: 'FORM-CUSTOMERS-001' };
      const FIELDS = { primary: { title: 'textField_customerName_12345' } };
    `);

    expect(contract).toMatchObject({
      present: true,
      dynamic: [],
      missing: [],
      appType: 'APP_REAL',
      formUuids: { primary: 'FORM-CUSTOMERS-001' },
      fields: { primary: { title: 'textField_customerName_12345' } },
    });
  });

  test('accepts only exact live form and field IDs', () => {
    const contract = extractCanvasBindingContract(`
      const APP_TYPE = 'APP_REAL';
      const FORM_UUIDS = { primary: 'FORM-CUSTOMERS-001' };
      const FIELDS = { primary: { title: 'textField_customerName_12345' } };
    `);

    expect(validateCanvasBindingContract(contract, {
      appType: 'APP_REAL',
      forms,
      schemasByFormUuid,
    })).toMatchObject({
      valid: true,
      verified: {
        forms: [{ formKey: 'primary', formUuid: 'FORM-CUSTOMERS-001' }],
        fields: [{ fieldKey: 'title', fieldId: 'textField_customerName_12345' }],
      },
    });
  });

  test('rejects truncated IDs and returns the closest real candidates', () => {
    const contract = extractCanvasBindingContract(`
      const APP_TYPE = 'APP_REAL';
      const FORM_UUIDS = { primary: 'FORM-CUSTOMERS-00' };
      const FIELDS = { primary: { title: 'textField_customerName_1234' } };
    `);
    const result = validateCanvasBindingContract(contract, {
      appType: 'APP_REAL',
      forms,
      schemasByFormUuid,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'CANVAS_BINDING_FORM_UUID_NOT_FOUND',
        candidates: [expect.objectContaining({ id: 'FORM-CUSTOMERS-001' })],
      }),
    ]));

    const fieldTypo = extractCanvasBindingContract(`
      const APP_TYPE = 'APP_REAL';
      const FORM_UUIDS = { primary: 'FORM-CUSTOMERS-001' };
      const FIELDS = { primary: { title: 'textField_customerName_1234' } };
    `);
    const fieldResult = validateCanvasBindingContract(fieldTypo, {
      appType: 'APP_REAL',
      forms,
      schemasByFormUuid,
    });
    expect(fieldResult.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'CANVAS_BINDING_FIELD_ID_NOT_FOUND',
        candidates: [expect.objectContaining({ id: 'textField_customerName_12345' })],
      }),
    ]));
  });

  test('rejects empty, cross-app, and dynamic scaffold bindings', () => {
    const contract = extractCanvasBindingContract(`
      const APP_TYPE = 'APP_WRONG';
      const FORM_UUIDS = { primary: '' };
      const FIELDS = buildFields();
    `);
    const result = validateCanvasBindingContract(contract, {
      appType: 'APP_REAL',
      forms,
      schemasByFormUuid,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.map((item) => item.code)).toEqual(expect.arrayContaining([
      'CANVAS_BINDING_DYNAMIC',
      'CANVAS_BINDING_APP_TYPE_MISMATCH',
      'CANVAS_BINDING_FORM_UUID_EMPTY',
    ]));
  });
});
