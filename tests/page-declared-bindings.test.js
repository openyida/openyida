'use strict';

const { collectDeclaredBindings, verifyDeclaredBindings } = require('../lib/app/services/field-bindings');
const source = fields => `const APP_TYPE = 'APP_TEST'; const FIELDS = ${JSON.stringify(fields)};
const DATA_BINDING = { mode: 'form', appType: APP_TYPE, formUuid: 'FORM-X', fields: FIELDS, optionValues: { status: ['待执行'] } };
export default function Page() { return <div>业务数据</div>; }`;
const schema = { success: true, content: { pages: [{ componentsTree: [
  { componentName: 'SelectField', props: { fieldId: 'selectField_status', label: '状态', dataSource: [{ value: '待执行' }, { value: '已执行' }] } },
] }] } };

test('reads JSON declarations and constant aliases without executing source', () => {
  expect(collectDeclaredBindings(source({ status: 'selectField_status' }))).toEqual([
    expect.objectContaining({ appType: 'APP_TEST', fields: { status: 'selectField_status' } }),
  ]);
  expect(() => collectDeclaredBindings('const DATA_BINDING = { mode:"form", appType: makeApp(), formUuid:"FORM-X", fields:{} };'))
    .toThrow(expect.objectContaining({ code: 'PAGE_DATA_BINDING_INVALID' }));
});

test('checks declared IDs and options using one schema read per resource', async () => {
  const read = jest.fn(async () => schema);
  const code = source({ status: 'selectField_status' });
  expect(await verifyDeclaredBindings(code + '\nconst B = { mode:"process", appType: APP_TYPE, formUuid:"FORM-X", fields:FIELDS };', read))
    .toEqual({ verifiedBindings: 2, schemaReads: 1 });
  expect(read).toHaveBeenCalledTimes(1);
  await expect(verifyDeclaredBindings(source({ status: 'selectField_invented' }), read))
    .rejects.toMatchObject({ code: 'PAGE_DATA_BINDING_INVALID', details: { missing: [{ semanticPath: 'status', fieldId: 'selectField_invented' }] } });
  await expect(verifyDeclaredBindings(code.replace("['待执行']", "['未执行']"), read))
    .rejects.toMatchObject({ code: 'PAGE_DATA_BINDING_INVALID', details: { reason: 'option_value_mismatch' } });
});

test('validates static resource and field declarations while allowing runtime query and refresh values', async () => {
  const code = source({ status: 'selectField_status' }).replace('fields: FIELDS,', 'fields: FIELDS, query: buildQuery(), refresh: onRefresh,');
  const read = jest.fn(async () => schema);
  await expect(verifyDeclaredBindings(code, read)).resolves.toEqual({ verifiedBindings: 1, schemaReads: 1 });
  await expect(verifyDeclaredBindings(code.replace('fields: FIELDS', 'fields: buildFields()'), read))
    .rejects.toMatchObject({ code: 'PAGE_DATA_BINDING_INVALID', details: { remoteWrites: 0 } });
});

test('undeclared custom readers add no schema calls and schema failures stop validation', async () => {
  const read = jest.fn();
  expect(await verifyDeclaredBindings('const count = 3;', read)).toEqual({ verifiedBindings: 0, schemaReads: 0 });
  expect(read).not.toHaveBeenCalled();
  read.mockResolvedValue({ success: false });
  await expect(verifyDeclaredBindings(source({ status: 'selectField_status' }), read)).rejects.toMatchObject({
    code: 'PAGE_DATA_BINDING_INVALID', details: { reason: 'schema_unavailable', remoteWrites: 0 },
  });
});
