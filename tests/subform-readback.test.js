'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { readCanvasSubformRows } = require('../lib/app/subform-readback');
const { buildWriteContract, compareWriteData } = require('../lib/app/form-data-contract');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../lib/samples/openyida-scaffold/canvas-data-source.jsx'), 'utf8')
  .replace(/^import .*;\n/gm, ''), context);
const ref = { appType: 'APP_TARGET', formUuid: 'FORM-TARGET', formType: 'receipt', instanceId: 'FINST-1', title: '商机甲' };
const cell = (id, value, rowId) => ({ componentName: id === 'relation' ? 'AssociationFormField' : 'TextField',
  fieldId: id, fieldData: { value }, rowId });
const fixture = () => ({ formData: { lines: [
  { name: '设备', relation_id: JSON.stringify(JSON.stringify([ref])) }, { name: '培训' },
] }, instValue: [{ componentName: 'TableField', fieldId: 'lines', fieldData: { value: [
  [cell('name', '设备', 'ROW-A'), cell('relation', [ref], 'ROW-A')],
  [cell('name', '培训', 'ROW-B'), cell('relation', [], 'ROW-B')],
] } }] });
const fields = [{ componentName: 'TableField', props: { fieldId: 'lines' }, children: [
  { componentName: 'TextField', props: { fieldId: 'name' } },
  { componentName: 'AssociationFormField', props: { fieldId: 'relation', multiple: false } },
] }];
const contract = buildWriteContract({ content: { pages: [{ componentsTree: fields }] } });
const expected = { lines: [{ name: '设备', relation: [ref] }, { name: '培训', relation: [] }] };

describe.each([
  ['backend', readCanvasSubformRows], ['standalone Canvas sample', context.readCanvasSubformRows],
])('%s subform evidence', (_name, read) => {
  test.each([false, true])('uses explicit nested raw values without changing raw data; encoded=%s', encode => {
    const row = fixture();
    if (encode) {row.instValue = JSON.stringify(row.instValue); row.formData.lines = JSON.stringify(row.formData.lines);}
    const before = JSON.stringify(row);
    const result = read(row, 'lines');
    expect(result.status).toBe('ready');
    expect(context.readCanvasAssociation(result.rows[0], 'relation')).toMatchObject({ status: 'ready', titles: ['商机甲'] });
    expect(context.readCanvasAssociation(result.rows[1], 'relation')).toMatchObject({ status: 'empty', instanceIds: [] });
    expect(JSON.stringify(row)).toBe(before);
  });
  test('missing raw evidence stays unavailable; does not guess an empty association', () => {
    const row = fixture(); delete row.instValue;
    expect(context.readCanvasAssociation(read(row, 'lines').rows[1], 'relation'))
      .toMatchObject({ status: 'error', error: { code: 'DATA_ASSOCIATION_UNAVAILABLE' } });
  });
  test('explicit child clear overrides stale raw values', () => {
    const row = fixture(); row.formData.lines[1].relation = [];
    row.instValue[0].fieldData.value[1][1].fieldData.value = [ref];
    expect(context.readCanvasAssociation(read(row, 'lines').rows[1], 'relation')).toMatchObject({ status: 'empty' });
  });
  test.each([
    row => {row.instValue = '[broken';},
    row => {row.instValue.push(row.instValue[0]);},
    row => {row.instValue[0].fieldData.value.pop();},
    row => {row.instValue[0].fieldData.value.reverse();},
    row => {row.formData.lines[1].rowId = 'ROW-WRONG';},
    row => {row.instValue[0].fieldData.value[1][1].rowId = 'ROW-A';},
    row => {row.instValue[0].fieldData.value[1] = [cell('relation', [], 'ROW-A')];},
  ])('rejects malformed, ambiguous or mismatched rows', change => {
    const row = fixture(); change(row);
    expect(read(row, 'lines')).toMatchObject({ status: 'error', rows: [], error: { code: 'DATA_SUBFORM_INVALID' } });
  });
  test('empty table is authoritative and missing table is unavailable', () => {
    const row = fixture(); row.formData.lines = [];
    expect(read(row, 'lines')).toMatchObject({ status: 'empty', rows: [] });
    delete row.formData.lines;
    expect(read(row, 'lines')).toMatchObject({ status: 'error', error: { code: 'DATA_SUBFORM_UNAVAILABLE' } });
  });
});

test('write verification consumes nested raw evidence, retaining strict missing-field behavior without it', () => {
  const row = fixture();
  expect(compareWriteData(expected, row.formData, contract, JSON.stringify(row.instValue))).toEqual([]);
  expect(compareWriteData(expected, row.formData, contract)).toEqual([expect.objectContaining({
    path: '$["lines"][1]["relation"]', code: 'READBACK_FIELD_MISSING',
  })]);
  row.instValue[0].fieldData.value[1][1].fieldData.value = [ref];
  expect(compareWriteData(expected, row.formData, contract, row.instValue)).toHaveLength(1);
});

test('duplicate or mistyped raw association cells cannot prove an empty value', () => {
  for (const duplicate of [false, true]) {
    const row = fixture(), cells = row.instValue[0].fieldData.value[1];
    if (duplicate) {cells.push(cell('relation', [], 'ROW-B'));}
    else {cells[1].componentName = 'TextField';}
    expect(compareWriteData(expected, row.formData, contract, row.instValue)).toHaveLength(1);
    expect(context.readCanvasAssociation(context.readCanvasSubformRows(row, 'lines').rows[1], 'relation').status).toBe('error');
  }
});

describe.each(['CheckboxField', 'MultiSelectField', 'EmployeeField', 'DepartmentSelectField', 'AttachmentField', 'ImageField'])(
  '%s stored empty collection', type => {
    const setup = () => ({
      contract: buildWriteContract({ content: { pages: [{ componentsTree: [{ componentName: 'TableField',
        props: { fieldId: 'lines', behavior: 'NORMAL' }, children: [
          { componentName: 'TextField', props: { fieldId: 'name' } },
          { componentName: type, props: { fieldId: 'selection', behavior: 'NORMAL' } },
        ] }] }] } }),
      expected: { lines: [{ name: '安装', selection: [] }] },
      actual: { lines: [{ name: '安装' }] },
      raw: [{ componentName: 'TableField', fieldId: 'lines', fieldData: { value: [[
        cell('name', '安装', 'ROW-A'), { componentName: type, fieldId: 'selection', rowId: 'ROW-A', fieldData: {} },
      ]] } }],
    });
    test('verifies a retained typed raw cell after the server omits its null value', () => {
      const { expected, actual, contract, raw } = setup(), before = JSON.stringify(raw);
      expect(compareWriteData(expected, actual, contract, JSON.stringify(raw))).toEqual([]);
      expect(JSON.stringify(raw)).toBe(before);
    });
    test('uses the same stored-cell contract for a main field, without accepting missing or hidden evidence', () => {
      const contract = buildWriteContract({ content: { pages: [{ componentsTree: [
        { componentName: type, props: { fieldId: 'selection', behavior: 'NORMAL' } },
      ] }] } });
      const expected = { selection: [] }, raw = [{ componentName: type, fieldId: 'selection', fieldData: {} }];
      expect(compareWriteData(expected, {}, contract, raw)).toEqual([]);
      expect(compareWriteData(expected, {}, contract, [])).toHaveLength(1);
      contract.props.selection.behavior = 'HIDDEN';
      expect(compareWriteData(expected, {}, contract, raw)).toHaveLength(1);
    });
    test.each(['filtered-cell', 'missing-snapshot', 'wrong-type', 'duplicate', 'wrong-row', 'unknown-shape',
      'nonempty-raw', 'nonempty-projection', 'hidden-field', 'hidden-table', 'no-row-id'])(
      'keeps uncertain or contradictory evidence unverified: %s', scenario => {
        const data = setup(), cells = data.raw[0].fieldData.value[0];
        if (scenario === 'filtered-cell') {cells.pop();}
        if (scenario === 'missing-snapshot') {data.raw = null;}
        if (scenario === 'wrong-type') {cells[1].componentName = 'TextField';}
        if (scenario === 'duplicate') {cells.push({ ...cells[1] });}
        if (scenario === 'wrong-row') {cells[1].rowId = 'ROW-B';}
        if (scenario === 'unknown-shape') {cells[1].fieldData = { hidden: true };}
        if (scenario === 'nonempty-raw') {cells[1].fieldData.value = ['still-present'];}
        if (scenario === 'nonempty-projection') {data.actual.lines[0].selection_id = ['still-present'];}
        if (scenario === 'hidden-field') {data.contract.props.selection.behavior = 'HIDDEN';}
        if (scenario === 'hidden-table') {data.contract.props.lines.behavior = 'HIDDEN';}
        if (scenario === 'no-row-id') {delete cells[0].rowId; delete cells[1].rowId;}
        expect(compareWriteData(data.expected, data.actual, data.contract, data.raw).length).toBeGreaterThan(0);
      });
  });
