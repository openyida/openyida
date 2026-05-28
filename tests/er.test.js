'use strict';

const {
  parseArgs,
  filterErSourceForms,
  collectTopLevelFieldNodes,
  buildErModel,
  renderMermaid,
  formatErOutput,
} = require('../lib/app/er');

function schemaFrom(children, aliasItems = []) {
  return {
    success: true,
    content: {
      pages: [
        {
          componentAlias: {
            items: aliasItems,
          },
          componentsTree: [
            {
              componentName: 'FormContainer',
              children,
            },
          ],
        },
      ],
    },
  };
}

function field(componentName, fieldId, label, props = {}, children = []) {
  return {
    componentName,
    props: {
      fieldId,
      label: { zh_CN: label },
      ...props,
    },
    children,
  };
}

function record(formUuid, formName, children, aliasItems = []) {
  return {
    formUuid,
    formName,
    formType: 'receipt',
    pathName: formName,
    success: true,
    schema: schemaFrom(children, aliasItems),
  };
}

describe('er argument parsing', () => {
  test('parses output options and normalizes mmd format', () => {
    expect(parseArgs([
      'APP_XXX',
      '--format',
      'mmd',
      '--output',
      '.cache/openyida/er/app.mmd',
      '--include-system',
      '--keyword',
      '客户',
      '--concurrency',
      '8',
      '--retries',
      '2',
    ])).toEqual({
      appType: 'APP_XXX',
      format: 'mermaid',
      output: '.cache/openyida/er/app.mmd',
      includeSystem: true,
      includePages: false,
      keyword: '客户',
      concurrency: 8,
      retries: 2,
      json: false,
      help: false,
    });
  });

  test('--json switches output format', () => {
    expect(parseArgs(['APP_XXX', '--json'])).toMatchObject({
      appType: 'APP_XXX',
      format: 'json',
      json: true,
    });
  });

  test('--include-pages opts display pages into the ER source set', () => {
    expect(parseArgs(['APP_XXX', '--include-pages'])).toMatchObject({
      appType: 'APP_XXX',
      includePages: true,
    });
  });

  test('--help is parsed before login is needed', () => {
    expect(parseArgs(['--help'])).toMatchObject({
      appType: '',
      help: true,
    });
  });
});

describe('er source form filtering', () => {
  test('skips display pages by default and includes them only when requested', () => {
    const forms = [
      { formUuid: 'FORM-CUSTOMER', formName: 'Customer', formType: 'receipt' },
      { formUuid: 'PAGE-DASHBOARD', formName: 'Dashboard', formType: 'display' },
      { formUuid: 'FORM-APPROVAL', formName: 'Approval', formType: 'process' },
    ];

    expect(filterErSourceForms(forms, { includePages: false }).map(form => form.formUuid)).toEqual([
      'FORM-CUSTOMER',
      'FORM-APPROVAL',
    ]);
    expect(filterErSourceForms(forms, { includePages: true }).map(form => form.formUuid)).toEqual([
      'FORM-CUSTOMER',
      'PAGE-DASHBOARD',
      'FORM-APPROVAL',
    ]);
  });

  test('applies keyword filtering before display page exclusion', () => {
    const forms = [
      { formUuid: 'FORM-CUSTOMER', formName: 'Customer', formType: 'receipt' },
      { formUuid: 'PAGE-DASHBOARD', formName: 'Dashboard', formType: 'display' },
    ];

    expect(filterErSourceForms(forms, { keyword: 'Dashboard', includePages: false })).toEqual([]);
    expect(filterErSourceForms(forms, { keyword: 'Dashboard', includePages: true })).toEqual([
      forms[1],
    ]);
  });
});

describe('er model extraction', () => {
  test('keeps table children out of the parent entity field list', () => {
    const schema = schemaFrom([
      field('TextField', 'textField_name', '客户名称'),
      field('TableField', 'tableField_contacts', '联系人', {}, [
        field('TextField', 'textField_contactName', '联系人姓名'),
      ]),
    ]);

    expect(collectTopLevelFieldNodes(schema).map(node => node.props.fieldId)).toEqual([
      'textField_name',
      'tableField_contacts',
    ]);
  });

  test('builds form, subtable, association, and system relationships', () => {
    const customerRecord = record('FORM-CUSTOMER', '客户', [
      field('TextField', 'textField_name', '客户名称', { required: true }),
      field('DepartmentSelectField', 'departmentSelectField_dept', '归属部门'),
      field('TableField', 'tableField_contacts', '联系人', {}, [
        field('TextField', 'textField_contactName', '联系人姓名'),
        field('EmployeeField', 'employeeField_contactOwner', '联系人负责人'),
      ]),
    ], [
      { fieldId: 'textField_name', alias: 'customerName' },
      { fieldId: 'tableField_contacts', alias: 'contacts' },
      { fieldId: 'textField_contactName', alias: 'contactName' },
    ]);

    const orderRecord = record('FORM-ORDER', '订单', [
      field('AssociationFormField', 'associationFormField_customer', '关联客户', {
        associationForm: {
          appType: 'APP_XXX',
          formUuid: 'FORM-CUSTOMER',
          formTitle: '客户',
          mainFieldId: 'textField_name',
          mainFieldLabel: { zh_CN: '客户名称' },
        },
      }),
      field('EmployeeField', 'employeeField_owner', '负责人'),
      field('NumberField', 'numberField_amount', '金额'),
    ]);

    const model = buildErModel([customerRecord, orderRecord], { appType: 'APP_XXX' });
    const entityIds = model.entities.map(entity => entity.id);
    const relationshipKeys = model.relationships.map(rel => `${rel.from}->${rel.to}:${rel.source}`);

    expect(entityIds).toEqual(expect.arrayContaining([
      'FORM_CUSTOMER',
      'FORM_ORDER',
      'FORM_CUSTOMER_tableField_contacts',
      'SystemUser',
      'SystemDepartment',
    ]));
    expect(entityIds).not.toContain('SystemRole');
    expect(relationshipKeys).toEqual(expect.arrayContaining([
      'FORM_ORDER->FORM_CUSTOMER:AssociationFormField',
      'FORM_ORDER->SystemUser:EmployeeField',
      'FORM_CUSTOMER->SystemDepartment:DepartmentSelectField',
      'FORM_CUSTOMER->FORM_CUSTOMER_tableField_contacts:TableField',
      'FORM_CUSTOMER_tableField_contacts->SystemUser:EmployeeField',
      'SystemUser->SystemDepartment:SystemEntity',
      'SystemDepartment->SystemDepartment:SystemEntity',
    ]));
    expect(model.warnings).toHaveLength(0);

    const customerEntity = model.entities.find(entity => entity.id === 'FORM_CUSTOMER');
    expect(customerEntity.fields.map(item => item.name)).toEqual([
      'formInstId',
      'customerName',
      'departmentSelectField_dept',
      'contacts',
    ]);

    const contactEntity = model.entities.find(entity => entity.id === 'FORM_CUSTOMER_tableField_contacts');
    expect(contactEntity.fields.map(item => item.name)).toEqual([
      'parentInstId',
      'contactName',
      'employeeField_contactOwner',
    ]);
  });

  test('includeSystem adds optional role and organization entities', () => {
    const model = buildErModel([
      record('FORM-CUSTOMER', '客户', [
        field('TextField', 'textField_name', '客户名称'),
      ]),
    ], { includeSystem: true });

    expect(model.entities.map(entity => entity.id)).toEqual(expect.arrayContaining([
      'SystemUser',
      'SystemDepartment',
      'SystemRole',
      'SystemOrganization',
    ]));
    expect(model.relationships.map(rel => `${rel.from}->${rel.to}:${rel.source}`)).toEqual(expect.arrayContaining([
      'SystemDepartment->SystemOrganization:SystemEntity',
      'SystemRole->SystemOrganization:SystemEntity',
      'SystemUser->SystemRole:SystemEntity',
    ]));
  });

  test('marks association targets outside the exported app as warnings', () => {
    const model = buildErModel([
      record('FORM-ORDER', '订单', [
        field('AssociationFormField', 'associationFormField_customer', '关联客户', {
          associationForm: {
            appType: 'APP_OTHER',
            formUuid: 'FORM-MISSING',
            formTitle: '外部客户',
          },
        }),
      ]),
    ]);

    expect(model.relationships[0]).toMatchObject({
      from: 'FORM_ORDER',
      to: 'FORM_MISSING',
      unresolved: true,
    });
    expect(model.warnings).toEqual([
      expect.objectContaining({
        type: 'unresolved-relationship',
        toFormUuid: 'FORM-MISSING',
      }),
    ]);
  });
});

describe('er output rendering', () => {
  test('renders Mermaid ER syntax and skips unresolved edges', () => {
    const model = buildErModel([
      record('FORM-ORDER', '订单', [
        field('AssociationFormField', 'associationFormField_customer', '关联客户', {
          associationForm: {
            formUuid: 'FORM-CUSTOMER',
            formTitle: '客户',
          },
        }),
      ]),
      record('FORM-CUSTOMER', '客户', [
        field('TextField', 'textField_name', '客户名称'),
      ]),
      record('FORM-INVOICE', '发票', [
        field('AssociationFormField', 'associationFormField_missing', '外部记录', {
          associationForm: {
            formUuid: 'FORM-MISSING',
            formTitle: '外部记录',
          },
        }),
      ]),
    ]);

    const mermaid = renderMermaid(model);
    expect(mermaid).toContain('erDiagram');
    expect(mermaid).toContain('FORM_ORDER {');
    expect(mermaid).toContain('string formInstId PK');
    expect(mermaid).toContain('FORM_ORDER }o--|| FORM_CUSTOMER : "关联客户"');
    expect(mermaid).not.toContain('FORM_INVOICE }o--|| FORM_MISSING');
  });

  test('formats JSON output', () => {
    const model = buildErModel([
      record('FORM-CUSTOMER', '客户', [
        field('TextField', 'textField_name', '客户名称'),
      ]),
    ], { appType: 'APP_XXX' });

    expect(JSON.parse(formatErOutput(model, 'json'))).toMatchObject({
      schemaVersion: 1,
      appType: 'APP_XXX',
      entities: [
        expect.objectContaining({ id: 'FORM_CUSTOMER' }),
      ],
    });
  });
});
