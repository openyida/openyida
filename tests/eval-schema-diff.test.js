'use strict';

const {
  normalizeSchemaSnapshot,
  diffSchemaSnapshots,
  checkExpectedSchemaDiff,
} = require('../scripts/eval/schema-diff');

describe('eval schema diff', () => {
  test('snapshot 归一化忽略时间戳与数组顺序漂移', () => {
    const a = normalizeSchemaSnapshot({ forms: [
      { formUuid: 'F2', name: '客户', updatedAt: '2026-01-01' },
      { formUuid: 'F1', name: '线索', updatedAt: '2026-01-01' },
    ] });
    const b = normalizeSchemaSnapshot({ forms: [
      { formUuid: 'F1', name: '线索', updatedAt: '2026-08-28' },
      { formUuid: 'F2', name: '客户', updatedAt: '2026-08-28' },
    ] });
    expect(a).toEqual(b);
  });

  test('diff 识别 added/removed/changed', () => {
    const diff = diffSchemaSnapshots(
      { resources: [
        { type: 'form', formUuid: 'F1', name: '线索', fields: [{ fieldId: 'a', label: '名称' }] },
        { type: 'form', formUuid: 'F2', name: '客户' },
      ] },
      { resources: [
        { type: 'form', formUuid: 'F1', name: '线索', fields: [{ fieldId: 'a', label: '线索名称' }] },
        { type: 'form', formUuid: 'F3', name: '商机' },
      ] },
    );
    expect(diff.summary).toEqual({ added: 1, removed: 1, changed: 1 });
    expect(diff.changed[0].key).toBe('form:formUuid:F1');
  });

  test('fieldId wins over parent formUuid when diffing fields from the same form', () => {
    const diff = diffSchemaSnapshots(
      { resources: [
        { type: 'FORM_X/field', formUuid: 'FORM_X', fieldId: 'field_a', label: 'A' },
      ] },
      { resources: [
        { type: 'FORM_X/field', formUuid: 'FORM_X', fieldId: 'field_a', label: 'A' },
        { type: 'FORM_X/field', formUuid: 'FORM_X', fieldId: 'field_b', label: 'B' },
      ] },
    );
    expect(diff.summary).toEqual({ added: 1, removed: 0, changed: 0 });
    expect(diff.added[0].key).toBe('FORM_X/field:fieldId:field_b');
  });

  test('expected diff 校验数量、变化键和稳定键', () => {
    const diff = {
      added: [{ key: 'field:fieldId:new' }],
      removed: [],
      changed: [{ key: 'form:formUuid:F1' }],
      summary: { added: 1, removed: 0, changed: 1 },
    };
    const result = checkExpectedSchemaDiff(diff, {
      minAdded: 1,
      minChanged: 1,
      addedKeys: ['field:fieldId:new'],
      stableKeys: ['form:formUuid:F2'],
    });
    expect(result.pass).toBe(true);
    expect(result.checks.every((check) => check.ok)).toBe(true);
  });

  test('expected diff supports zero-change upper bounds for idempotent replay', () => {
    const result = checkExpectedSchemaDiff({
      added: [], removed: [], changed: [],
      summary: { added: 0, removed: 0, changed: 0 },
    }, {
      maxAdded: 0,
      maxRemoved: 0,
      maxChanged: 0,
    });
    expect(result.pass).toBe(true);
    expect(result.checks).toHaveLength(3);
  });
});
