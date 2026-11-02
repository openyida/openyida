'use strict';

const { assertFormUpdatePermissions } = require('../lib/core/form-edit-permissions');

const target = { appType: 'APP_TEST', formUuid: 'FORM-TEST', formInstId: 'FINST-TEST' };
const field = (fieldId, componentName = 'TextField', props = {}) => ({
  componentName, props: { fieldId, ...props },
});

function schema(nodes = [field('dateField_due', 'DateField'), field('textField_marker')]) {
  const behaviors = [];
  function collect(items) {
    items.forEach(node => {
      if (node.props && node.props.fieldId) {
        behaviors.push({ fieldId: node.props.fieldId, componentName: node.componentName,
          fieldBehavior: 'NORMAL', hidden: false, disabled: false, readOnly: true });
      }
      if (node.children) { collect(node.children); }
    });
  }
  collect(nodes);
  return { success: true, content: { pages: [{ id: target.formUuid, componentsTree: [
    { componentName: 'Page', children: [{ componentName: 'FormContainer', children: nodes }] },
  ] }], instanceData: [{ id: target.formUuid, flowData: { behaviors } }] } };
}

function probe(response = schema(), operations = { OPERATE_EDIT: 'y' }) {
  const get = jest.fn().mockImplementation(async path => path.endsWith('queryOperatePermission.json')
    ? { success: true, content: operations } : response);
  return { get, run: data => assertFormUpdatePermissions({ get, ...target, data }) };
}

test('reads instance operation permission and native edit schema with exact targets', async () => {
  const p = probe();
  await p.run({ dateField_due: 1793145600000 });
  expect(p.get.mock.calls).toEqual([
    ['/dingtalk/web/APP_TEST/query/formdata/queryOperatePermission.json',
      { formUuid: target.formUuid, formInstId: target.formInstId }],
    ['/dingtalk/web/APP_TEST/query/formdata/getFormEditSchema.json',
      { formUuid: target.formUuid, formInstId: target.formInstId }],
  ]);
});

test.each(['READONLY', 'HIDDEN', 'DISABLED', 'INVALID', '{"type":"JSExpression","value":"foo"}']) (
  'rejects a mixed patch when any field behavior is %s', async behavior => {
    const response = schema();
    response.content.instanceData[0].flowData.behaviors[1].fieldBehavior = behavior;
    await expect(probe(response).run({ dateField_due: 123, textField_marker: 'changed' }))
      .rejects.toMatchObject({ code: 'DATA_FORM_FIELDS_NOT_EDITABLE', details: {
        mutationPerformed: false, fields: [expect.objectContaining({ path: 'textField_marker' })],
      } });
  }
);

test.each(['hidden', 'disabled'])('native %s flag overrides NORMAL', async key => {
  const response = schema();
  response.content.instanceData[0].flowData.behaviors[0][key] = true;
  await expect(probe(response).run({ dateField_due: 1 })).rejects.toMatchObject({ code: 'DATA_FORM_FIELDS_NOT_EDITABLE' });
});

test.each(['HIDDEN', 'DISABLED', { type: 'JSExpression', value: 'x' }])(
  'a restrictive container blocks a NORMAL descendant: %j', async behavior => {
    const response = schema([{ componentName: 'ColumnContainer', props: { behavior }, children: [field('textField_child')] }]);
    await expect(probe(response).run({ textField_child: 'changed' })).rejects.toMatchObject({ code: 'DATA_FORM_FIELDS_NOT_EDITABLE' });
  }
);

test('readonly layout does not override a NORMAL child, but readonly table does', async () => {
  await probe(schema([{ componentName: 'ColumnContainer', props: { behavior: 'READONLY' },
    children: [field('textField_child')] }])).run({ textField_child: 'value' });
  const response = tableSchema();
  response.content.instanceData[0].flowData.behaviors[0].fieldBehavior = 'READONLY';
  await expect(probe(response).run({ tableField_items: [{ textField_note: 'value' }] }))
    .rejects.toMatchObject({ code: 'DATA_FORM_FIELDS_NOT_EDITABLE' });
});

test('server field behavior takes precedence over the design default', async () => {
  await probe(schema([field('textField_one', 'TextField', { behavior: 'READONLY' })])).run({ textField_one: 'value' });
});

test.each(['itemBehavior', 'fieldBehavior'])('does not evaluate dynamic %s', async key => {
  await expect(probe(schema([field('textField_one', 'TextField', { [key]: { type: 'JSFunction', value: 'evil()' } })]))
    .run({ textField_one: 'value' })).rejects.toMatchObject({ code: 'DATA_FORM_FIELDS_NOT_EDITABLE' });
});

test.each([false, { type: 'JSExpression', value: 'someCondition' }])(
  'top-level native condition blocks the field and descendants: %j', async condition => {
    const response = schema([{ componentName: 'ColumnContainer', condition, children: [field('textField_one')] }]);
    await expect(probe(response).run({ textField_one: 'value' })).rejects.toMatchObject({ code: 'DATA_FORM_FIELDS_NOT_EDITABLE' });
  }
);

test('the normal schema condition and null leaf children are supported', async () => {
  await probe(schema([{ ...field('textField_one'), condition: true, children: null }])).run({ textField_one: 'value' });
});

test.each([null, [], {}, { unknown: 'value' }].map(value => [value]))('rejects invalid or unknown patches: %j', async data => {
  await expect(probe().run(data)).rejects.toMatchObject({ isCliError: true, details: { mutationPerformed: false } });
});

test.each([{}, { OPERATE_EDIT: 'n', OPERATE_EDIT_AFTER_PROCESS: 'n' }])('record permission is required: %j', async operations => {
  const p = probe(schema(), operations);
  await expect(p.run({ dateField_due: 1 })).rejects.toMatchObject({ code: 'DATA_FORM_UPDATE_FORBIDDEN' });
  expect(p.get).toHaveBeenCalledTimes(1);
});

test('supports after-process editing only when explicitly authorized for the record', async () => {
  await probe(schema(), { OPERATE_EDIT: 'n', OPERATE_EDIT_AFTER_PROCESS: 'y' }).run({ dateField_due: 1 });
});

test('supports serialized schema and object instanceData', async () => {
  const response = schema();
  response.content.instanceData = response.content.instanceData[0];
  response.content = JSON.stringify(response.content);
  await probe(response).run({ dateField_due: 1 });
});

test.each([
  r => { r.success = false; },
  r => { r.content = '{'; },
  r => { r.content.pages[0].id = 'FORM-OTHER'; },
  r => { r.content.instanceData[0].id = 'FORM-OTHER'; },
  r => { r.content.instanceData[0].formInstId = 'FINST-OTHER'; },
  r => { r.content.instanceData[0].flowData.behaviors = []; },
  r => { r.content.instanceData[0].flowData.behaviors.push(r.content.instanceData[0].flowData.behaviors[0]); },
  r => { r.content.instanceData.push(r.content.instanceData[0]); },
  r => { r.content.pages[0].componentsTree[0].children.push(field('dateField_due')); },
])('fails closed on an unverified edit context %#', async mutate => {
  const response = schema(); mutate(response);
  await expect(probe(response).run({ dateField_due: 1 })).rejects.toMatchObject({ code: 'DATA_FORM_EDIT_CONTEXT_UNVERIFIED' });
});

test('a field missing its effective behavior cannot inherit permissive defaults', async () => {
  const response = schema();
  response.content.instanceData[0].flowData.behaviors.splice(0, 1);
  await expect(probe(response).run({ dateField_due: 1 })).rejects.toMatchObject({ code: 'DATA_FORM_FIELDS_NOT_EDITABLE' });
});

function tableSchema() {
  return schema([{ ...field('tableField_items', 'TableField'), children: [
    { componentName: 'TableFieldChildForm', children: [field('numberField_amount', 'NumberField'), field('textField_note')] },
  ] }]);
}

test('allows statically editable table fields and rejects misplaced child IDs', async () => {
  const p = probe(tableSchema());
  await p.run({ tableField_items: [{ numberField_amount: 2, textField_note: 'note' }] });
  await expect(p.run({ numberField_amount: 2 })).rejects.toMatchObject({ code: 'DATA_FORM_FIELDS_NOT_EDITABLE' });
  await expect(p.run({ tableField_items: [{ textField_foreign: 'value' }] }))
    .rejects.toMatchObject({ code: 'DATA_FORM_FIELDS_NOT_EDITABLE' });
});

test.each([[], [{ numberField_amount: 2 }], [{ numberField_amount: 2, textField_note: 'change' }]].map(value => [value]))(
  'table replacement cannot erase or modify a readonly column: %j', async rows => {
    const response = tableSchema();
    response.content.instanceData[0].flowData.behaviors[2].fieldBehavior = 'READONLY';
    await expect(probe(response).run({ tableField_items: rows })).rejects.toMatchObject({ code: 'DATA_FORM_FIELDS_NOT_EDITABLE' });
  }
);

test.each([null, {}, [null], [1]].map(value => [value]))('rejects unsupported subform replacement: %j', async rows => {
  await expect(probe(tableSchema()).run({ tableField_items: rows }))
    .rejects.toMatchObject({ code: 'DATA_FORM_FIELDS_NOT_EDITABLE' });
});

test.each([
  ['addButtonBehavior', 'HIDDEN'], ['delButtonBehavior', 'DISABLED'],
  ['delButtonBehavior', { type: 'JSFunction', value: 'rowRule' }],
])('table replacement respects restricted or dynamic row controls: %s', async (key, value) => {
  const response = tableSchema();
  response.content.pages[0].componentsTree[0].children[0].children[0].props[key] = value;
  await expect(probe(response).run({ tableField_items: [] }))
    .rejects.toMatchObject({ code: 'DATA_FORM_FIELDS_NOT_EDITABLE' });
});

test('permission reads are fresh for each update and read failures do not allow writes', async () => {
  const response = schema(); const p = probe(response);
  await p.run({ dateField_due: 1 });
  response.content.instanceData[0].flowData.behaviors[0].fieldBehavior = 'READONLY';
  await expect(p.run({ dateField_due: 2 })).rejects.toMatchObject({ code: 'DATA_FORM_FIELDS_NOT_EDITABLE' });
  expect(p.get).toHaveBeenCalledTimes(4);
  p.get.mockRejectedValue(new Error('network'));
  await expect(p.run({ dateField_due: 2 })).rejects.toMatchObject({ code: 'DATA_FORM_EDIT_CONTEXT_UNVERIFIED' });
});
