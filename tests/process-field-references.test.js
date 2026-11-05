'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { normalizeSchemaFields } = require('../lib/app/schema-field-resolution');
const { hasFieldReferences, resolveProcessFieldReferences, preflightNewFormReferences } = require('../lib/process/services/process-form-fields');
const { buildProcessAndViewJson } = require('../lib/process/services/process-compiler');

const fields = normalizeSchemaFields({ content: { pages: [{ componentsTree: [
  { componentName: 'NumberField', props: { fieldId: 'numberField_amount', label: '金额' } },
  { componentName: 'TextField', props: { fieldId: 'textField_name', label: '名称' } },
  { componentName: 'TableField', props: { fieldId: 'tableField_items', label: '明细' }, children: [
    { componentName: 'TextField', props: { fieldId: 'textField_child', label: '名称' } },
  ] },
] }] } });

test('resolves explicit condition and permission references with their actual component types', () => {
  const source = { nodes: [{ type: 'route', conditions: [{ rules: [{ fieldId: '@label:金额', op: 'GreaterThan', value: 100 }] }] }],
    startFormConfig: [{ fieldId: '@label:明细/名称', fieldBehavior: 'READONLY' }], title: '@label:金额' };
  expect(hasFieldReferences(source)).toBe(true);
  const result = resolveProcessFieldReferences(source, fields);
  expect(result.nodes[0].conditions[0].rules[0]).toMatchObject({ fieldId: 'numberField_amount', componentType: 'NumberField', fieldName: '金额' });
  expect(result.startFormConfig[0].fieldId).toBe('textField_child');
  expect(result.title).toBe('@label:金额');
  expect(source.startFormConfig[0].fieldId).toBe('@label:明细/名称');
});

test.each(['@label:名称', '@label:不存在'])('ambiguous or missing references fail explicitly: %s', ref => {
  expect(() => resolveProcessFieldReferences({ fieldId: ref }, fields)).toThrow(expect.objectContaining({ code: 'PROCESS_FIELD_REFERENCE_INVALID' }));
});

test('rejects conflicting component types and preserves explicit external field IDs', () => {
  expect(() => resolveProcessFieldReferences({ fieldId: '@label:金额', componentType: 'TextField', op: 'Equal' }, fields))
    .toThrow(expect.objectContaining({ code: 'PROCESS_FIELD_REFERENCE_INVALID' }));
  expect(resolveProcessFieldReferences({ targetFieldId: 'numberField_external' }, fields)).toEqual({ targetFieldId: 'numberField_external' });
});

test('validates new-form symbolic references using the real local form builder before remote creation', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'process-fields-'));
  try {
    const file = path.join(dir, 'fields.json');
    fs.writeFileSync(file, JSON.stringify([{ type: 'NumberField', label: '金额' }]));
    expect(() => preflightNewFormReferences({ fieldId: '@label:缺失' }, file, '申请'))
      .toThrow(expect.objectContaining({ code: 'PROCESS_FIELD_REFERENCE_INVALID', details: { remoteWrites: 0, reference: '@label:缺失', missingFields: ['缺失'], ambiguousFields: [] } }));
    expect(preflightNewFormReferences({ fieldId: '@label:金额', op: 'GreaterThan' }, file, '申请').componentType).toBe('NumberField');
  } finally {fs.rmSync(dir, { recursive: true, force: true });}
});

test.each([
  ['GreaterThan', 'Bigger'], ['GreaterThanOrEqual', 'BiggerOrEqual'],
  ['LessThan', 'Lesser'], ['LessThanOrEqual', 'LesserOrEqual'],
  ['Bigger', 'Bigger'], ['BiggerOrEqual', 'BiggerOrEqual'],
  ['Lesser', 'Lesser'], ['LesserOrEqual', 'LesserOrEqual'],
])('binds %s to native %s in process and view rules without a competing formula', (op, native) => {
  const definition = resolveProcessFieldReferences({ nodes: [{ type: 'route', conditions: [{
    name: '金额条件', rules: [{ fieldId: '@label:金额', op, value: 0 }],
    childNodes: [{ type: 'approval', name: '复核', approver: 'originator' }],
  }] }] }, fields);
  const compiled = buildProcessAndViewJson(definition, 'TPROC_TEST', 'FORM_TEST', 'https://example.com', 'APP_TEST');
  const expected = { id: 'numberField_amount', componentType: 'NumberField', opCode: native,
    value: 0, ruleValue: 0, ruleType: 'rule_text' };
  for (const rule of [compiled.processJson.nodes[1].childNodes[0].props.conditions.rules[0],
    compiled.viewJson.schema.children[1].children[0].props.conditions.conditions.rules[0]]) {
    expect(rule).toMatchObject(expected);
    expect(rule).not.toHaveProperty('formula');
  }
});

test('field-based jump rules use the same native comparison contract', () => {
  const definition = resolveProcessFieldReferences({ nodes: [
    { type: 'approval', name: '金额复核', approver: 'originator', routeRules: [{ jumpTo: '票据复核',
      fieldRules: [{ fieldId: '@label:金额', op: 'LessThan', value: 0 }] }] },
    { type: 'approval', name: '票据复核', approver: 'originator' },
  ] }, fields);
  const result = buildProcessAndViewJson(definition, 'TPROC_TEST', 'FORM_TEST', 'https://example.com', 'APP_TEST');
  expect(result.processJson.nodes[1].props.routeRule.rules[0].props.conditions.rules[0])
    .toMatchObject({ id: 'numberField_amount', componentType: 'NumberField', value: 0, opCode: 'Lesser', ruleType: 'rule_text' });
});

test.each(['NumberField', 'SelectField', 'RadioField', 'DateField', 'EmployeeField'])(
  '%s uses the native expression discriminator for both conditional branches and jumps', componentType => {
    const result = buildProcessAndViewJson({ nodes: [{ type: 'route', conditions: [{
      rules: [{ fieldId: 'field', componentType, op: 'Equal', value: 0 }],
    }] }] }, 'PROC', 'FORM', 'https://example.com', 'APP_TEST');
    expect(result.processJson.nodes[1].childNodes[0].props.conditions.rules[0])
      .toMatchObject({ componentType, ruleType: 'rule_text', opCode: 'Equal' });
  });
