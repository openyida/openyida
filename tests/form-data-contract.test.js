'use strict';
const { buildWriteContract, prepareWriteData, compareWriteData } = require('../lib/app/form-data-contract');
const field = (type, id, label, props = {}, children) => ({ componentName: type,
  props: { fieldId: id, label, ...props }, ...(children ? { children } : {}) });
const schema = { success: true, content: { pages: [{ componentsTree: [
  field('TextField', 'textField_name', '客户名称'), field('NumberField', 'numberField_total', '金额'),
  field('RadioField', 'radioField_status', '状态', { dataSource: [{ value: 'open' }, { value: 'done' }] }),
  field('DateField', 'dateField_due', '日期'), field('CheckboxField', 'checkboxField_tags', '标签'),
  field('CascadeDateField', 'cascadeDateField_period', '时间段'),
  field('AssociationFormField', 'associationFormField_ref', '关联'),
  field('ImageField', 'imageField_photo', '图片'),
  field('AddressField', 'addressField_address', '地址'),
  field('TableField', 'tableField_lines', '明细', {}, [field('TextField', 'textField_item', '项目')]),
  field('TableField', 'tableField_other', '其他', {}, [field('TextField', 'textField_other', '项目')]),
], componentAlias: { items: [{ fieldId: 'textField_name', alias: 'name' }, { fieldId: 'textField_item', alias: 'item' }] } }] } };
const contract = buildWriteContract(schema);
const error = fn => { try {fn();} catch (e) {return e;} throw new Error('Expected failure'); };

describe('member and department identity readback', () => {
  const scoped = buildWriteContract({ content: { pages: [{ componentsTree: [
    field('EmployeeField', 'employee', '成员'), field('DepartmentSelectField', 'department', '部门'),
    field('TableField', 'lines', '明细', {}, [
      field('EmployeeField', 'childEmployee', '成员'), field('DepartmentSelectField', 'childDepartment', '部门'),
    ]),
  ] }] } });
  const wanted = { employee: ['user-1'], department: ['123'],
    lines: [{ childEmployee: ['user-1'], childDepartment: ['123'] }] };
  const observed = { employee: ['成员甲'], employee_id: '["user-1"]', department: ['技术部门'], department_id: [123],
    lines: [{ childEmployee: ['成员甲'], childEmployee_id: ['user-1'], childDepartment: ['技术部门'], childDepartment_id: ['123'] }] };
  test('compares identity projections in main and table fields without rewriting display values', () => {
    const before = JSON.stringify(observed);
    expect(compareWriteData(prepareWriteData(wanted, scoped), observed, scoped)).toEqual([]);
    expect(JSON.stringify(observed)).toBe(before);
  });
  test.each(['wrong', 'missing', 'malformed', 'empty'])('does not verify an invalid identity projection: %s', scenario => {
    const row = JSON.parse(JSON.stringify(observed));
    for (const [data, id] of [[row, 'employee'], [row.lines[0], 'childEmployee']]) {
      if (scenario === 'missing') {delete data[`${id}_id`];}
      else {data[`${id}_id`] = { wrong: ['user-2'], malformed: '[bad', empty: [] }[scenario];}
    }
    expect(compareWriteData(wanted, row, scoped)).toEqual([
      expect.objectContaining({ fieldId: 'employee', code: 'READBACK_VALUE_MISMATCH' }),
      expect.objectContaining({ fieldId: 'childEmployee', code: 'READBACK_VALUE_MISMATCH' }),
    ]);
  });
});

test('compiles only configured aliases and preserves data/zero while scoping subform children', () => {
  const input = { name: 'A', numberField_total: 0, tableField_lines: [{ item: 'B' }] };
  const output = prepareWriteData(input, contract, true);
  expect(output).toEqual({ textField_name: 'A', numberField_total: 0, tableField_lines: [{ textField_item: 'B' }] });
  expect(input).toEqual({ name: 'A', numberField_total: 0, tableField_lines: [{ item: 'B' }] });
  expect(compareWriteData(output, { textField_name: 'A', numberField_total: '0', tableField_lines: '[{"textField_item":"B","id":"ROW"}]' }, contract)).toEqual([]);
});

test('reports independent unknown fields and type errors together before writing', () => {
  const e = error(() => prepareWriteData({ 客户名称: 'A', numberField_total: '5', radioField_status: ['open'],
    dateField_due: '2026-11-02', tableField_lines: [{ textField_other: 'wrong parent' }] }, contract));
  expect(e.code).toBe('DATA_WRITE_PREFLIGHT_FAILED');
  expect(e.details).toMatchObject({ sideEffectState: 'none', retrySafe: true });
  expect(e.details.issues).toHaveLength(5);
  expect(e.details.issues[0]).toMatchObject({ code: 'UNKNOWN_FIELD', candidates: [{ fieldId: 'textField_name', label: '客户名称' }] });
});

test('does not pick ambiguous aliases or overwrite a canonical field via another alias', () => {
  expect(error(() => prepareWriteData({ textField_name: 'A', name: 'B' }, contract, true)).details.issues)
    .toContainEqual(expect.objectContaining({ code: 'DUPLICATE_FIELD_REFERENCE' }));
  const changed = JSON.parse(JSON.stringify(schema));
  changed.content.pages[0].componentAlias.items.push({ fieldId: 'numberField_total', alias: 'name' });
  expect(error(() => prepareWriteData({ name: 'A' }, buildWriteContract(changed), true)).details.issues)
    .toContainEqual(expect.objectContaining({ code: 'AMBIGUOUS_FIELD_REFERENCE' }));
});

test('detects silent empty fields, missing fields, wrong options and unsupported formats', () => {
  expect(compareWriteData({ numberField_total: 0 }, { numberField_total: '' }, contract)).toHaveLength(1);
  expect(compareWriteData({ textField_name: 'A' }, {}, contract)[0].code).toBe('READBACK_FIELD_MISSING');
  expect(error(() => prepareWriteData({ radioField_status: 'missing', addressField_address: {} }, contract)).details.issues)
    .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UNKNOWN_OPTION' }), expect.objectContaining({ code: 'INVALID_VALUE_TYPE' })]));
  expect(compareWriteData({ numberField_total: 16 }, { numberField_total: '0x10' }, contract)).toHaveLength(1);
});

test('decodes only typed readbacks, including association projections, selection sets, ranges and stable file IDs', () => {
  const data = { textField_name: '["literal"]', checkboxField_tags: ['b', 'a'], cascadeDateField_period: [0, ''],
    associationFormField_ref: [{ appType: 'APP_SOURCE', formUuid: 'FORM-SOURCE', formType: 'receipt', instanceId: 'FINST-1', title: 'Record' }],
    imageField_photo: [{ fileId: 'FILE-1', downloadUrl: 'https://example.test/old' }] };
  prepareWriteData(data, contract);
  const actual = { textField_name: '["literal"]', checkboxField_tags: '["a","b"]', cascadeDateField_period: '[0,null]',
    associationFormField_ref_id: JSON.stringify(JSON.stringify([{ instanceId: 'FINST-1' }])),
    imageField_photo: JSON.stringify([{ fileId: 'FILE-1', downloadUrl: 'https://example.test/new' }]) };
  expect(compareWriteData(data, actual, contract)).toEqual([]);
  actual.textField_name = ['literal'];
  expect(compareWriteData(data, actual, contract)).toHaveLength(1);
});

test('empty/malformed schemas and empty payloads never produce verified writes', () => {
  expect(error(() => prepareWriteData({ textField_name: 'A' }, buildWriteContract({ content: { pages: {} } }))).details.issues)
    .toContainEqual(expect.objectContaining({ code: 'SCHEMA_FIELDS_UNAVAILABLE' }));
  expect(error(() => prepareWriteData({}, contract)).details.issues[0].code).toBe('EMPTY_WRITE_PAYLOAD');
  expect(compareWriteData({ textField_name: 'A' }, null, contract)[0].code).toBe('READBACK_DATA_UNAVAILABLE');
});

describe('association format contract', () => {
  const ref = { appType: 'APP_REMOTE', formUuid: 'FORM-REMOTE', formType: 'receipt', instanceId: 'FINST-A', title: '客户甲' };
  const relation = { multiple: false, associationForm: { appType: ref.appType, formUuid: ref.formUuid, formType: ref.formType } };
  const scoped = buildWriteContract({ content: { pages: [{ componentsTree: [
    field('AssociationFormField', 'single', '单选', relation),
    field('AssociationFormField', 'many', '多选', { ...relation, multiple: true }),
    field('AssociationFormField', 'process', '已完成流程', { associationForm: { formType: 'process' } }),
    field('TableField', 'lines', '明细', {}, [field('AssociationFormField', 'child', '子表关联', relation)]),
  ] }] } });

  test.each([[[]], [[ref]]])('supports explicit clear and cross-app selection, including children: %j', value => {
    expect(prepareWriteData({ single: value, lines: [{ child: value }] }, scoped))
      .toEqual({ single: value, lines: [{ child: value }] });
  });
  test('allows multiple selections only when configured and preserves order and extra platform keys', () => {
    const values = [ref, { ...ref, instanceId: 'FINST-B', title: '客户乙', value: 'FINST-B', label: '客户乙' }];
    expect(prepareWriteData({ many: values }, scoped)).toEqual({ many: values });
    expect(compareWriteData({ many: values }, { many: JSON.stringify(values.slice().reverse()) }, scoped)).toEqual([]);
    expect(prepareWriteData({ process: [{ ...ref, formType: 'process' }] }, scoped).process[0].formType).toBe('process');
  });
  test.each([
    [null, 'INVALID_VALUE_TYPE'], ['', 'INVALID_VALUE_TYPE'], [JSON.stringify([ref]), 'INVALID_VALUE_TYPE'],
    [ref, 'INVALID_VALUE_TYPE'], [[{ ...ref, subTitle: null }], 'SUBTITLE_MUST_BE_STRING'],
    [[ref, { ...ref, instanceId: 'FINST-B' }], 'SINGLE_SELECTION_REQUIRED'],
    [[{ ...ref, appType: 'APP_WRONG' }], 'ASSOCIATION_TARGET_MISMATCH'],
    [[{ ...ref, formUuid: 'FORM-WRONG' }], 'ASSOCIATION_TARGET_MISMATCH'],
    [[{ ...ref, formType: 'process' }], 'ASSOCIATION_TARGET_MISMATCH'],
  ])('rejects invalid writes before any mutation, including child paths: %j', (value, code) => {
    expect(error(() => prepareWriteData({ lines: [{ child: value }] }, scoped)).details.issues)
      .toContainEqual(expect.objectContaining({ code, fieldId: 'child', path: '$["lines"][0]["child"]' }));
  });
  test('rejects duplicates even when titles differ', () => {
    expect(error(() => prepareWriteData({ many: [ref, { ...ref, title: '旧名称' }] }, scoped)).details.issues[0].code)
      .toBe('DUPLICATE_SELECTION');
  });
  test.each(['appType', 'formUuid', 'formType'])('readback cannot verify a conflicting %s even without schema target metadata', key => {
    const data = { associationFormField_ref: [ref] };
    expect(compareWriteData(data, { associationFormField_ref_id: JSON.stringify([{ ...ref, [key]: 'WRONG' }]) }, contract))
      .toEqual([expect.objectContaining({ code: 'READBACK_VALUE_MISMATCH' })]);
  });
  test.each([value => value, JSON.stringify, value => JSON.stringify(JSON.stringify(value))])(
    'supports typed child projections and ID-only reads with bounded envelopes', wrap => {
      expect(compareWriteData({ lines: [{ child: [ref] }] }, { lines: wrap([
        { child_id: wrap([{ instanceId: ref.instanceId }]), rowId: 'row-1' },
      ]) }, scoped)).toEqual([]);
    });
  test.each([null, '', [], '[]', '"[]"', 'null', '"null"', '""', '"\\"\\""'])('verifies explicit clear in readback: %j', value => {
    expect(compareWriteData({ single: [] }, { single: value, single_id: [ref] }, scoped)).toEqual([]);
  });
  test.each([undefined, '[broken', JSON.stringify(JSON.stringify(JSON.stringify([ref]))), [{ instanceId: '' }], [ref, ref]])(
    'missing, malformed or duplicate values cannot count as verified: %j', value => {
      expect(compareWriteData({ many: [ref] }, { many: value }, scoped)).toHaveLength(1);
    });
  test('renamed titles do not change the verified association identity', () => {
    expect(compareWriteData({ single: [ref] }, { single: [{ ...ref, title: '新名称', subTitle: '已更新' }] }, scoped)).toEqual([]);
    expect(compareWriteData({ single: [ref] }, { single: [{ ...ref, formUuid: 'FORM-WRONG' }] }, scoped)).toHaveLength(1);
  });
});
