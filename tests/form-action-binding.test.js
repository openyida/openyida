'use strict';

const createForm = require('../lib/app/create-form');
const formCompiler = require('../lib/app/services/form-compiler');
const {
  extractExportedActionFunctionNames,
  findFieldById,
  inspectActionBindings,
  syncDesignerActionCatalog,
} = require('../lib/app/form-action-binding');

function createSelectSchema() {
  return formCompiler.compileFormDefinition({
    formTitle: '动作绑定测试',
    fields: [{ key: 'status', type: 'SelectField', label: '状态', options: ['A', 'B'] }],
  }, {
    appType: 'APP_TEST',
    formUuid: 'FORM_ACTION_TEST',
  }).schema;
}

function createRuleMatrixSchema() {
  return formCompiler.compileFormDefinition({
    formTitle: '联动规则矩阵测试',
    fields: [
      { key: 'status', type: 'SelectField', label: '状态', options: ['A', 'B'] },
      { key: 'result', type: 'TextField', label: '结果' },
      { key: 'quantity', type: 'NumberField', label: '数量' },
      { key: 'amount', type: 'NumberField', label: '金额' },
    ],
  }, {
    appType: 'APP_TEST',
    formUuid: 'FORM_RULE_MATRIX_TEST',
  }).schema;
}

function findField(value, componentName) {
  if (!value) {return null;}
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findField(item, componentName);
      if (found) {return found;}
    }
    return null;
  }
  if (typeof value !== 'object') {return null;}
  if (value.componentName === componentName && value.props && value.props.fieldId) {
    return value;
  }
  for (const child of Object.values(value)) {
    const found = findField(child, componentName);
    if (found) {return found;}
  }
  return null;
}

function findFieldByLabel(value, label) {
  if (!value) {return null;}
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFieldByLabel(item, label);
      if (found) {return found;}
    }
    return null;
  }
  if (typeof value !== 'object') {return null;}
  const fieldLabel = value.props && value.props.label;
  const labelText = fieldLabel && typeof fieldLabel === 'object' ? fieldLabel.zh_CN : fieldLabel;
  if (labelText === label) {return value;}
  for (const child of Object.values(value)) {
    const found = findFieldByLabel(child, label);
    if (found) {return found;}
  }
  return null;
}

describe('form action binding integrity', () => {
  test('action function extraction excludes exported business constants', () => {
    const source = [
      'export const TAX_RATE = 0.06;',
      'export const calculateArrow = () => TAX_RATE;',
      'export async function loadTax() {}',
      'export function calculateTax() {}',
    ].join('\n');

    expect(extractExportedActionFunctionNames(source)).toEqual(['calculateTax', 'loadTax']);
  });

  test('designer action catalog merges functions without deleting existing metadata', () => {
    const actions = {
      module: {
        source: 'export const TAX_RATE = 0.06;\nexport function calculateTax() {}',
      },
      list: [{
        id: 'platform-entry-id',
        name: 'platformAction',
        type: 'componentEvent',
        relatedEventId: 'node:onChange',
      }],
    };

    syncDesignerActionCatalog(actions);

    expect(actions.list).toEqual([
      expect.objectContaining({
        id: 'platform-entry-id',
        name: 'platformAction',
        type: 'componentEvent',
        relatedEventId: 'node:onChange',
      }),
      { id: 'calculateTax', title: 'calculateTax' },
    ]);
    expect(actions.list.some(item => item.id === 'TAX_RATE')).toBe(false);
  });

  test('readback field lookup accepts top-level fieldId', () => {
    const field = { fieldId: 'textField_top_level', props: {} };

    expect(findFieldById({ pages: [{ children: [field] }] }, 'textField_top_level')).toBe(field);
  });

  test('field-action atomically writes source, registry entry, and field binding', () => {
    const schema = createSelectSchema();
    const operations = createForm._private.applySchemaPatchOperations(schema, [{
      action: 'field-action',
      field: '状态',
      event: 'onChange',
      name: 'handleStatusChange',
      source: 'export function handleStatusChange(event) { return event && event.value === "A"; }',
    }]);
    const expectations = createForm._private.actionBindingExpectationsFromOperations(operations);
    const inspection = createForm._private.assertFormActionBindings(schema, expectations);

    expect(operations).toEqual([
      expect.objectContaining({
        action: 'field-action',
        event: 'onChange',
        actionName: 'handleStatusChange',
        fieldId: expect.stringMatching(/^selectField_/),
        relatedEventId: expect.stringContaining(':onChange'),
      }),
    ]);
    expect(inspection).toMatchObject({
      verified: true,
      bindings: [{
        bindingFound: true,
        designerBindingFound: true,
        actionEntryFound: true,
        actionFunctionFound: true,
        verified: true,
      }],
    });
    const field = findField(schema.pages, 'SelectField');
    expect(field.props.onChange).toMatchObject({
      type: 'JSExpression',
      value: expect.stringContaining('legaoBuiltin.execEventFlow'),
      events: [expect.objectContaining({
        name: 'handleStatusChange',
        type: 'actionRef',
        uuid: expect.any(String),
      })],
    });
    expect(schema.actions.list).toContainEqual({ id: 'handleStatusChange', title: 'handleStatusChange' });
    expect(schema.actions.module.source).toContain('openyida:field-action:start:handleStatusChange');
    expect(schema.actions.module.compiled).toContain('handleStatusChange');
  });

  test('bind-field-action without an exported function is rejected before save', () => {
    const schema = createSelectSchema();
    const operations = createForm._private.applySchemaPatchOperations(schema, [{
      action: 'bind-field-action',
      field: '状态',
      name: 'missingAction',
    }]);
    const expectations = createForm._private.actionBindingExpectationsFromOperations(operations);

    expect(() => createForm._private.assertFormActionBindings(schema, expectations)).toThrow(
      expect.objectContaining({ code: 'FORM_ACTION_BINDING_INCOMPLETE' })
    );
  });

  test('field-action requires its source to export the requested function', () => {
    const schema = createSelectSchema();

    expect(() => createForm._private.applySchemaPatchOperations(schema, [{
      action: 'field-action',
      field: '状态',
      name: 'handleStatusChange',
      source: 'export function anotherAction() {}',
    }])).toThrow(expect.objectContaining({ code: 'FORM_ACTION_FUNCTION_MISSING' }));
  });

  test('field-action rejects an exported constant with the requested action name', () => {
    const schema = createSelectSchema();

    expect(() => createForm._private.applySchemaPatchOperations(schema, [{
      action: 'field-action',
      field: '状态',
      name: 'TAX_RATE',
      source: 'export const TAX_RATE = 0.06;',
    }])).toThrow(expect.objectContaining({ code: 'FORM_ACTION_FUNCTION_MISSING' }));
  });

  test('existing field action is not silently overwritten', () => {
    const schema = createSelectSchema();
    createForm._private.applySchemaPatchOperations(schema, [{
      action: 'field-action',
      field: '状态',
      name: 'firstAction',
      source: 'export function firstAction() {}',
    }]);

    expect(() => createForm._private.applySchemaPatchOperations(schema, [{
      action: 'field-action',
      field: '状态',
      name: 'secondAction',
      source: 'export function secondAction() {}',
    }])).toThrow(expect.objectContaining({ code: 'FORM_ACTION_EVENT_CONFLICT' }));
  });

  test('readback inspection reports each broken contract edge', () => {
    const schema = createSelectSchema();
    const operations = createForm._private.applySchemaPatchOperations(schema, [{
      action: 'field-action',
      field: '状态',
      name: 'handleStatusChange',
      source: 'export function handleStatusChange() {}',
    }]);
    const expectations = createForm._private.actionBindingExpectationsFromOperations(operations);
    schema.actions.list = [];

    expect(inspectActionBindings(schema, expectations)).toMatchObject({
      verified: false,
      bindings: [{
        bindingFound: true,
        actionEntryFound: false,
        actionFunctionFound: true,
        mismatches: ['ACTION_ENTRY_MISSING'],
      }],
    });
  });

  test('readback accepts a catalog entry whose action name is stored in name', () => {
    const schema = createSelectSchema();
    const operations = createForm._private.applySchemaPatchOperations(schema, [{
      action: 'field-action',
      field: '状态',
      name: 'handleStatusChange',
      source: 'export function handleStatusChange() {}',
    }]);
    const expectations = createForm._private.actionBindingExpectationsFromOperations(operations);
    schema.actions.list = [{
      id: 'platform-entry-id',
      name: 'handleStatusChange',
      type: 'componentEvent',
      relatedEventId: expectations[0].relatedEventId,
    }];

    expect(inspectActionBindings(schema, expectations)).toMatchObject({
      verified: true,
      bindings: [{ actionEntryFound: true, actionFunctionFound: true, verified: true }],
    });
  });

  test('legacy actionRef is executable-shaped but not accepted as a designer binding', () => {
    const schema = createSelectSchema();
    const field = findField(schema.pages, 'SelectField');
    const fieldId = field.props.fieldId;
    schema.actions.module.source = 'export function handleStatusChange() {}';
    schema.actions.list = [{ id: 'handleStatusChange', title: 'handleStatusChange' }];
    field.props.onChange = {
      type: 'actionRef',
      id: 'handleStatusChange',
      name: 'handleStatusChange',
    };

    expect(inspectActionBindings(schema, [{
      fieldId,
      event: 'onChange',
      actionName: 'handleStatusChange',
    }])).toMatchObject({
      verified: false,
      bindings: [{
        actualActionName: 'handleStatusChange',
        designerBindingFound: false,
        mismatches: ['DESIGNER_EVENT_BINDING_MISSING'],
      }],
    });
  });

  test('replacing rule definitions removes obsolete generated field bindings', () => {
    const schema = createRuleMatrixSchema();
    createForm._private.applyFormRules(schema, [{
      type: 'set-value',
      on: '状态',
      target: '结果',
      value: '已处理',
    }]);
    const status = findFieldByLabel(schema.pages, '状态');
    expect(status.props.onChange).toBeDefined();

    createForm._private.applyFormRules(schema, [{
      type: 'set-value',
      on: '数量',
      target: '金额',
      expression: 'Number(value || 0) * 10',
    }]);

    const quantity = findFieldByLabel(schema.pages, '数量');
    expect(status.props.onChange).toBeUndefined();
    expect(quantity.props.onChange).toMatchObject({
      type: 'JSExpression',
      events: [expect.objectContaining({
        name: expect.stringMatching(/^openyidaRuleChange_numberField_/),
      })],
    });
    expect(schema.actions.list.some(item => item.id.includes('selectField_'))).toBe(false);
  });

  test('reapplying rules preserves the pre-existing designer action call', () => {
    const schema = createRuleMatrixSchema();
    createForm._private.applySchemaPatchOperations(schema, [{
      action: 'field-action',
      field: '状态',
      event: 'onChange',
      name: 'existingStatusAction',
      source: 'export function existingStatusAction() {}',
    }]);
    const rules = [{
      type: 'set-value',
      on: '状态',
      target: '结果',
      value: '已处理',
    }];

    createForm._private.applyFormRules(schema, rules);
    createForm._private.applyFormRules(schema, rules);

    expect(schema.actions.module.source).toContain('this.existingStatusAction(event)');
    expect(schema.actions.list).toContainEqual({ id: 'existingStatusAction', title: 'existingStatusAction' });
  });

  test('rule catalog sync preserves lifecycle metadata and unknown platform actions', () => {
    const schema = createRuleMatrixSchema();
    schema.actions.list.push({
      id: 'platform-entry-id',
      name: 'platformAction',
      type: 'componentEvent',
      relatedEventId: 'platform:onChange',
    });

    createForm._private.applyFormRules(schema, [{
      type: 'set-value',
      on: '状态',
      target: '结果',
      value: '已处理',
    }]);

    expect(schema.actions.list).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'openyidaRulesDidMount',
        type: 'lifeCycleEvent',
        relatedEventId: 'lifecycle:didMount',
      }),
      expect.objectContaining({
        id: 'openyidaApplyRules',
        type: 'componentEvent',
        relatedEventId: expect.stringContaining(':afterFormDataInit'),
      }),
      expect.objectContaining({
        id: 'platform-entry-id',
        name: 'platformAction',
        relatedEventId: 'platform:onChange',
      }),
    ]));
  });
});
