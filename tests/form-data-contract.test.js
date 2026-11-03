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
    .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UNKNOWN_OPTION' }), expect.objectContaining({ code: 'UNSUPPORTED_COMPONENT' })]));
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
