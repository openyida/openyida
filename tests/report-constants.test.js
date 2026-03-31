'use strict';

const {
  CHART_COMPONENT_MAP,
  randomId,
  genNodeId,
  genFieldAlias,
  genFieldId,
} = require('../lib/report/constants');

const {
  normalizeCubeCode,
  normalizeFieldCode,
  inferDataType,
  normalizeField,
  normalizeFieldArray,
} = require('../lib/report/field-utils');

// ── CHART_COMPONENT_MAP ───────────────────────────────────────────────────────

describe('CHART_COMPONENT_MAP', () => {
  test('包含所有必要的图表类型', () => {
    const requiredTypes = ['bar', 'line', 'pie', 'funnel', 'gauge', 'combo', 'table', 'indicator', 'pivot'];
    requiredTypes.forEach((type) => {
      expect(CHART_COMPONENT_MAP).toHaveProperty(type);
      expect(typeof CHART_COMPONENT_MAP[type]).toBe('string');
      expect(CHART_COMPONENT_MAP[type].length).toBeGreaterThan(0);
    });
  });

  test('indicator 映射到 YoushuSimpleIndicatorCard', () => {
    expect(CHART_COMPONENT_MAP.indicator).toBe('YoushuSimpleIndicatorCard');
  });

  test('table 映射到 YoushuTable', () => {
    expect(CHART_COMPONENT_MAP.table).toBe('YoushuTable');
  });

  test('pie 映射到 YoushuPieChart', () => {
    expect(CHART_COMPONENT_MAP.pie).toBe('YoushuPieChart');
  });
});

// ── randomId ─────────────────────────────────────────────────────────────────

describe('randomId', () => {
  test('返回 8 位字符串', () => {
    expect(randomId()).toHaveLength(8);
  });

  test('只包含小写字母和数字', () => {
    for (let i = 0; i < 20; i++) {
      expect(randomId()).toMatch(/^[a-z0-9]{8}$/);
    }
  });

  test('多次调用结果不同（随机性）', () => {
    const ids = new Set(Array.from({ length: 20 }, () => randomId()));
    expect(ids.size).toBeGreaterThan(1);
  });
});

// ── genNodeId ─────────────────────────────────────────────────────────────────

describe('genNodeId', () => {
  test('以 node_oc 开头', () => {
    expect(genNodeId()).toMatch(/^node_oc/);
  });

  test('总长度为 19（node_oc + 12位）', () => {
    expect(genNodeId()).toHaveLength(19);
  });

  test('多次调用结果不同', () => {
    const ids = new Set(Array.from({ length: 20 }, () => genNodeId()));
    expect(ids.size).toBeGreaterThan(1);
  });
});

// ── genFieldAlias ─────────────────────────────────────────────────────────────

describe('genFieldAlias', () => {
  test('以 field_ 开头', () => {
    expect(genFieldAlias()).toMatch(/^field_/);
  });

  test('格式为 field_ + 8位随机字符', () => {
    expect(genFieldAlias()).toMatch(/^field_[a-z0-9]{8}$/);
  });
});

// ── genFieldId ────────────────────────────────────────────────────────────────

describe('genFieldId', () => {
  test('以传入的 componentName 开头', () => {
    expect(genFieldId('YoushuTable')).toMatch(/^YoushuTable_/);
    expect(genFieldId('YoushuPieChart')).toMatch(/^YoushuPieChart_/);
  });

  test('格式为 ComponentName_ + 8位随机字符', () => {
    expect(genFieldId('MyComp')).toMatch(/^MyComp_[a-z0-9]{8}$/);
  });
});

// ── normalizeCubeCode ─────────────────────────────────────────────────────────

describe('normalizeCubeCode', () => {
  test('将连字符替换为下划线', () => {
    expect(normalizeCubeCode('FORM-CB89B060-1234')).toBe('FORM_CB89B060_1234');
  });

  test('已经是下划线格式时保持不变', () => {
    expect(normalizeCubeCode('FORM_CB89B060_1234')).toBe('FORM_CB89B060_1234');
  });

  test('空字符串返回空字符串', () => {
    expect(normalizeCubeCode('')).toBe('');
  });

  test('null/undefined 返回空字符串', () => {
    expect(normalizeCubeCode(null)).toBe('');
    expect(normalizeCubeCode(undefined)).toBe('');
  });

  test('真实 formUuid 格式转换正确', () => {
    const input = 'FORM-E4CA4FA5DC44463D85C0CAC3799DC27EEUS7';
    const expected = 'FORM_E4CA4FA5DC44463D85C0CAC3799DC27EEUS7';
    expect(normalizeCubeCode(input)).toBe(expected);
  });
});

// ── normalizeFieldCode ────────────────────────────────────────────────────────

describe('normalizeFieldCode', () => {
  test('selectField_ 自动添加 _value 后缀', () => {
    expect(normalizeFieldCode('selectField_abc')).toBe('selectField_abc_value');
  });

  test('radioField_ 自动添加 _value 后缀', () => {
    expect(normalizeFieldCode('radioField_xyz')).toBe('radioField_xyz_value');
  });

  test('checkboxField_ 自动添加 _value 后缀', () => {
    expect(normalizeFieldCode('checkboxField_xyz')).toBe('checkboxField_xyz_value');
  });

  test('multiSelectField_ 自动添加 _value 后缀', () => {
    expect(normalizeFieldCode('multiSelectField_xyz')).toBe('multiSelectField_xyz_value');
  });

  test('employeeField_ 自动添加 _value 后缀', () => {
    expect(normalizeFieldCode('employeeField_xyz')).toBe('employeeField_xyz_value');
  });

  test('已有 _value 后缀时不重复添加', () => {
    expect(normalizeFieldCode('selectField_abc_value')).toBe('selectField_abc_value');
  });

  test('textField_ 不添加 _value 后缀', () => {
    expect(normalizeFieldCode('textField_abc')).toBe('textField_abc');
  });

  test('numberField_ 不添加 _value 后缀', () => {
    expect(normalizeFieldCode('numberField_abc')).toBe('numberField_abc');
  });

  test('空值返回原值', () => {
    expect(normalizeFieldCode('')).toBe('');
    expect(normalizeFieldCode(null)).toBe(null);
  });
});

// ── inferDataType ─────────────────────────────────────────────────────────────

describe('inferDataType', () => {
  test('numberField_ 推断为 NUMBER', () => {
    expect(inferDataType('numberField_abc')).toBe('NUMBER');
  });

  test('dateField_ 推断为 DATE', () => {
    expect(inferDataType('dateField_abc')).toBe('DATE');
  });

  test('textField_ 推断为 STRING', () => {
    expect(inferDataType('textField_abc')).toBe('STRING');
  });

  test('selectField_ 推断为 STRING', () => {
    expect(inferDataType('selectField_abc')).toBe('STRING');
  });

  test('空值返回 STRING', () => {
    expect(inferDataType('')).toBe('STRING');
    expect(inferDataType(null)).toBe('STRING');
    expect(inferDataType(undefined)).toBe('STRING');
  });
});

// ── normalizeField ────────────────────────────────────────────────────────────

describe('normalizeField', () => {
  test('字符串输入自动展开为对象', () => {
    const result = normalizeField('textField_abc');
    expect(result.fieldCode).toBe('textField_abc');
    expect(result.aliasName).toBe('textField_abc');
    expect(result.dataType).toBe('STRING');
    expect(result.aggregateType).toBe('NONE');
  });

  test('numberField_ 字符串推断 dataType 为 NUMBER', () => {
    const result = normalizeField('numberField_budget');
    expect(result.dataType).toBe('NUMBER');
  });

  test('对象输入保留已有属性', () => {
    const result = normalizeField({ fieldCode: 'textField_name', aliasName: '项目名称', dataType: 'STRING', aggregateType: 'NONE' });
    expect(result.aliasName).toBe('项目名称');
    expect(result.aggregateType).toBe('NONE');
  });

  test('对象输入缺少 aliasName 时用 fieldCode 补全', () => {
    const result = normalizeField({ fieldCode: 'textField_name' });
    expect(result.aliasName).toBe('textField_name');
  });

  test('对象输入缺少 dataType 时自动推断', () => {
    const result = normalizeField({ fieldCode: 'numberField_budget' });
    expect(result.dataType).toBe('NUMBER');
  });

  test('defaultAggregateType 参数生效', () => {
    const result = normalizeField('numberField_budget', 'SUM');
    expect(result.aggregateType).toBe('SUM');
  });

  test('null/undefined 输入返回空对象', () => {
    const result = normalizeField(null);
    expect(result.fieldCode).toBe('');
    expect(result.aliasName).toBe('');
  });
});

// ── normalizeFieldArray ───────────────────────────────────────────────────────

describe('normalizeFieldArray', () => {
  test('数组输入逐个标准化', () => {
    const result = normalizeFieldArray(['textField_a', 'numberField_b']);
    expect(result).toHaveLength(2);
    expect(result[0].fieldCode).toBe('textField_a');
    expect(result[1].dataType).toBe('NUMBER');
  });

  test('单对象输入包装为数组', () => {
    const result = normalizeFieldArray({ fieldCode: 'textField_a' });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  test('字符串输入包装为数组', () => {
    const result = normalizeFieldArray('textField_a');
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].fieldCode).toBe('textField_a');
  });

  test('null/undefined 返回空数组', () => {
    expect(normalizeFieldArray(null)).toEqual([]);
    expect(normalizeFieldArray(undefined)).toEqual([]);
  });

  test('空数组返回空数组', () => {
    expect(normalizeFieldArray([])).toEqual([]);
  });
});
