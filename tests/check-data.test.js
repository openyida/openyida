'use strict';

const {
  checkInstance,
  checkInstanceAgainstRule,
  isFieldEmpty,
  evaluateOp,
} = require('../lib/core/check-data');

// ── 工具函数 mock ─────────────────────────────────────────────────────

jest.mock('../lib/core/utils', () => ({
  loadCookieData: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  triggerLogin: jest.fn(),
  requestWithAutoLogin: jest.fn(),
}));

// ── isFieldEmpty ──────────────────────────────────────────────────────

describe('isFieldEmpty()', () => {
  test('undefined 视为空', () => {
    expect(isFieldEmpty(undefined)).toBe(true);
  });

  test('null 视为空', () => {
    expect(isFieldEmpty(null)).toBe(true);
  });

  test('空字符串视为空', () => {
    expect(isFieldEmpty('')).toBe(true);
  });

  test('纯空白字符串视为空', () => {
    expect(isFieldEmpty('   ')).toBe(true);
  });

  test('空数组视为空', () => {
    expect(isFieldEmpty([])).toBe(true);
  });

  test('非空字符串不为空', () => {
    expect(isFieldEmpty('合格')).toBe(false);
  });

  test('数字 0 不为空', () => {
    expect(isFieldEmpty(0)).toBe(false);
  });

  test('非空数组不为空', () => {
    expect(isFieldEmpty(['a'])).toBe(false);
  });
});

// ── evaluateOp ────────────────────────────────────────────────────────

describe('evaluateOp()', () => {
  test('Equal：相等返回 true', () => {
    expect(evaluateOp('合格', 'Equal', '合格')).toBe(true);
  });

  test('Equal：不相等返回 false', () => {
    expect(evaluateOp('不合格', 'Equal', '合格')).toBe(false);
  });

  test('NotEqual：不相等返回 true', () => {
    expect(evaluateOp('不合格', 'NotEqual', '合格')).toBe(true);
  });

  test('GreaterThan：大于返回 true', () => {
    expect(evaluateOp(5, 'GreaterThan', 0)).toBe(true);
  });

  test('GreaterThan：等于返回 false', () => {
    expect(evaluateOp(0, 'GreaterThan', 0)).toBe(false);
  });

  test('GreaterThanOrEqual：等于返回 true', () => {
    expect(evaluateOp(0, 'GreaterThanOrEqual', 0)).toBe(true);
  });

  test('LessThan：小于返回 true', () => {
    expect(evaluateOp(-1, 'LessThan', 0)).toBe(true);
  });

  test('LessThanOrEqual：等于返回 true', () => {
    expect(evaluateOp(0, 'LessThanOrEqual', 0)).toBe(true);
  });

  test('未知 op 返回 false', () => {
    expect(evaluateOp('a', 'Unknown', 'a')).toBe(false);
  });
});

// ── checkInstanceAgainstRule ──────────────────────────────────────────

describe('checkInstanceAgainstRule() - contradiction 规则', () => {
  const contradictionRule = {
    name: '合格但异常字段不为空',
    type: 'contradiction',
    condition: { fieldId: 'radioField_result', op: 'Equal', value: '合格' },
    check: { fieldIds: ['textareaField_desc', 'textareaField_reason'], shouldBe: 'empty' },
  };

  test('条件不成立时跳过规则，返回 null', () => {
    const instance = {
      formData: { radioField_result: '不合格', textareaField_desc: '有描述' },
    };
    expect(checkInstanceAgainstRule(instance, contradictionRule)).toBeNull();
  });

  test('条件成立且字段为空时，无违规，返回 null', () => {
    const instance = {
      formData: { radioField_result: '合格', textareaField_desc: '', textareaField_reason: '' },
    };
    expect(checkInstanceAgainstRule(instance, contradictionRule)).toBeNull();
  });

  test('条件成立且字段有值时，返回违规详情', () => {
    const instance = {
      formData: { radioField_result: '合格', textareaField_desc: '有异常描述', textareaField_reason: '' },
    };
    const result = checkInstanceAgainstRule(instance, contradictionRule);
    expect(result).not.toBeNull();
    expect(result.violatingFields).toHaveLength(1);
    expect(result.violatingFields[0].fieldId).toBe('textareaField_desc');
  });
});

describe('checkInstanceAgainstRule() - missing 规则', () => {
  const missingRule = {
    name: '不合格但缺少异常描述',
    type: 'missing',
    condition: { fieldId: 'radioField_result', op: 'Equal', value: '不合格' },
    check: { fieldIds: ['textareaField_desc'], shouldBe: 'notEmpty' },
  };

  test('条件成立且字段有值时，无违规，返回 null', () => {
    const instance = {
      formData: { radioField_result: '不合格', textareaField_desc: '有描述' },
    };
    expect(checkInstanceAgainstRule(instance, missingRule)).toBeNull();
  });

  test('条件成立且字段为空时，返回违规详情', () => {
    const instance = {
      formData: { radioField_result: '不合格', textareaField_desc: '' },
    };
    const result = checkInstanceAgainstRule(instance, missingRule);
    expect(result).not.toBeNull();
    expect(result.violatingFields[0].fieldId).toBe('textareaField_desc');
    expect(result.violatingFields[0].issue).toContain('应有值但为空');
  });
});

describe('checkInstanceAgainstRule() - value 规则', () => {
  const valueRule = {
    name: '抽样数量异常',
    type: 'value',
    check: { fieldId: 'numberField_count', op: 'GreaterThan', value: 0 },
  };

  test('字段值满足条件时，无违规，返回 null', () => {
    const instance = { formData: { numberField_count: 5 } };
    expect(checkInstanceAgainstRule(instance, valueRule)).toBeNull();
  });

  test('字段值为 0 时（不满足 GreaterThan 0），返回违规详情', () => {
    const instance = { formData: { numberField_count: 0 } };
    const result = checkInstanceAgainstRule(instance, valueRule);
    expect(result).not.toBeNull();
    expect(result.violatingFields[0].fieldId).toBe('numberField_count');
  });

  test('字段值为负数时，返回违规详情', () => {
    const instance = { formData: { numberField_count: -1 } };
    const result = checkInstanceAgainstRule(instance, valueRule);
    expect(result).not.toBeNull();
  });
});

describe('checkInstanceAgainstRule() - comparison 规则', () => {
  const comparisonRule = {
    name: '时间顺序异常',
    type: 'comparison',
    check: { fieldA: 'dateField_sample', op: 'LessThanOrEqual', fieldB: 'dateField_inspect' },
  };

  test('fieldA <= fieldB 时，无违规，返回 null', () => {
    const instance = {
      formData: {
        dateField_sample: '2024-01-01T08:00:00',
        dateField_inspect: '2024-01-02T08:00:00',
      },
    };
    expect(checkInstanceAgainstRule(instance, comparisonRule)).toBeNull();
  });

  test('fieldA > fieldB 时（时间顺序错误），返回违规详情', () => {
    const instance = {
      formData: {
        dateField_sample: '2024-01-03T08:00:00',
        dateField_inspect: '2024-01-02T08:00:00',
      },
    };
    const result = checkInstanceAgainstRule(instance, comparisonRule);
    expect(result).not.toBeNull();
    expect(result.violatingFields[0].fieldId).toBe('dateField_sample');
  });

  test('任一字段为空时，跳过比较，返回 null', () => {
    const instance = {
      formData: { dateField_sample: '', dateField_inspect: '2024-01-02T08:00:00' },
    };
    expect(checkInstanceAgainstRule(instance, comparisonRule)).toBeNull();
  });
});

// ── checkInstance（多规则组合）────────────────────────────────────────

describe('checkInstance() - 多规则组合检测', () => {
  const rules = [
    {
      name: '合格但异常字段不为空',
      type: 'contradiction',
      condition: { fieldId: 'radioField_result', op: 'Equal', value: '合格' },
      check: { fieldIds: ['textareaField_desc'], shouldBe: 'empty' },
    },
    {
      name: '抽样数量异常',
      type: 'value',
      check: { fieldId: 'numberField_count', op: 'GreaterThan', value: 0 },
    },
  ];

  test('无违规时返回空数组', () => {
    const instance = {
      formData: { radioField_result: '合格', textareaField_desc: '', numberField_count: 5 },
    };
    expect(checkInstance(instance, rules)).toHaveLength(0);
  });

  test('违反一条规则时返回一条违规', () => {
    const instance = {
      formData: { radioField_result: '合格', textareaField_desc: '有描述', numberField_count: 5 },
    };
    const violations = checkInstance(instance, rules);
    expect(violations).toHaveLength(1);
    expect(violations[0].ruleName).toBe('合格但异常字段不为空');
  });

  test('同时违反多条规则时返回多条违规', () => {
    const instance = {
      formData: { radioField_result: '合格', textareaField_desc: '有描述', numberField_count: 0 },
    };
    const violations = checkInstance(instance, rules);
    expect(violations).toHaveLength(2);
    expect(violations.map((v) => v.ruleName)).toContain('合格但异常字段不为空');
    expect(violations.map((v) => v.ruleName)).toContain('抽样数量异常');
  });

  test('违规结果包含 ruleName 和 ruleType 字段', () => {
    const instance = {
      formData: { radioField_result: '合格', textareaField_desc: '有描述', numberField_count: 5 },
    };
    const violations = checkInstance(instance, rules);
    expect(violations[0]).toHaveProperty('ruleName');
    expect(violations[0]).toHaveProperty('ruleType');
    expect(violations[0]).toHaveProperty('violatingFields');
  });
});

// ── 无 condition 的规则 ───────────────────────────────────────────────

describe('checkInstanceAgainstRule() - 无 condition 的规则', () => {
  test('无 condition 的 value 规则直接检测字段', () => {
    const rule = {
      name: '数量必须大于零',
      type: 'value',
      check: { fieldId: 'numberField_qty', op: 'GreaterThan', value: 0 },
    };
    const instance = { formData: { numberField_qty: -5 } };
    const result = checkInstanceAgainstRule(instance, rule);
    expect(result).not.toBeNull();
  });

  test('无 condition 的 comparison 规则直接比较两字段', () => {
    const rule = {
      name: '结束时间不早于开始时间',
      type: 'comparison',
      check: { fieldA: 'dateField_start', op: 'LessThanOrEqual', fieldB: 'dateField_end' },
    };
    const instance = {
      formData: { dateField_start: '2024-03-01', dateField_end: '2024-02-01' },
    };
    const result = checkInstanceAgainstRule(instance, rule);
    expect(result).not.toBeNull();
  });
});
