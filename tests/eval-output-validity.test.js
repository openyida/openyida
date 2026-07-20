'use strict';

const {
  OUTPUT_SCHEMAS,
  getSchema,
  validateUrl,
  validateOutput,
  checkOutputValidity,
  runOutputValidityEval,
} = require('../scripts/eval/output-validity');

// ── getSchema ────────────────────────────────────────────────────────

describe('getSchema()', () => {
  test('returns schema for known category (yida/app)', () => {
    const schema = getSchema('yida/app');
    expect(schema).not.toBeNull();
    expect(schema.requiredFields).toEqual(['appType', 'appUrl']);
    expect(schema.optionalFields).toContain('targets');
    expect(schema.fieldTypes).toHaveProperty('appType', 'string');
  });

  test('returns null for unknown category', () => {
    expect(getSchema('unknown/category')).toBeNull();
  });

  test('returns null for non-string input', () => {
    expect(getSchema(null)).toBeNull();
    expect(getSchema(undefined)).toBeNull();
    expect(getSchema(123)).toBeNull();
  });
});

// ── validateUrl ──────────────────────────────────────────────────────

describe('validateUrl()', () => {
  test('accepts valid https URLs', () => {
    expect(validateUrl('https://www.aliwork.com/app/123')).toBe(true);
    expect(validateUrl('https://example.com')).toBe(true);
  });

  test('accepts valid http URLs', () => {
    expect(validateUrl('http://example.com/path')).toBe(true);
  });

  test('rejects non-http URLs', () => {
    expect(validateUrl('ftp://example.com')).toBe(false);
    expect(validateUrl('file:///etc/passwd')).toBe(false);
  });

  test('rejects empty strings and non-string values', () => {
    expect(validateUrl('')).toBe(false);
    expect(validateUrl(null)).toBe(false);
    expect(validateUrl(undefined)).toBe(false);
    expect(validateUrl(123)).toBe(false);
  });
});

// ── validateOutput ───────────────────────────────────────────────────

describe('validateOutput()', () => {
  const schema = OUTPUT_SCHEMAS['yida/app'];

  test('passes with all required fields present', () => {
    const output = { appType: 'form', appUrl: 'https://example.com' };
    const result = validateOutput(output, schema);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('fails when required field is missing', () => {
    const output = { appUrl: 'https://example.com' };
    const result = validateOutput(output, schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('appType'))).toBe(true);
  });

  test('fails when required field is null', () => {
    const output = { appType: null, appUrl: 'https://example.com' };
    const result = validateOutput(output, schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('appType'))).toBe(true);
  });

  test('warns for unexpected fields', () => {
    const output = { appType: 'form', appUrl: 'https://example.com', extraField: 'x' };
    const result = validateOutput(output, schema);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes('extraField'))).toBe(true);
  });

  test('passes with null schema (unknown category)', () => {
    const output = { anything: 'goes' };
    const result = validateOutput(output, null);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/no schema/);
  });

  test('detects type mismatch: string field given number', () => {
    const output = { appType: 42, appUrl: 'https://example.com' };
    const result = validateOutput(output, schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('appType') && e.includes('string'))).toBe(true);
  });

  test('detects type mismatch: array field given string', () => {
    const output = { appType: 'form', appUrl: 'https://example.com', targets: 'not-an-array' };
    const result = validateOutput(output, schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('targets') && e.includes('array'))).toBe(true);
  });

  test('rejects non-object output', () => {
    const result = validateOutput(null, schema);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/non-null object/);
  });
});

// ── checkOutputValidity ──────────────────────────────────────────────

describe('checkOutputValidity()', () => {
  test('computes correct rate', () => {
    const outputs = [
      { category: 'yida/app', output: { appType: 'form', appUrl: 'https://example.com' } },
      { category: 'yida/app', output: { appUrl: 'https://example.com' } }, // missing appType
      { category: 'yida/app', output: { appType: 'form', appUrl: 'https://example.com' } },
    ];
    const result = checkOutputValidity({ outputs });
    expect(result.summary.total).toBe(3);
    expect(result.summary.valid).toBe(2);
    expect(result.summary.invalid).toBe(1);
    expect(result.summary.rate).toBeCloseTo(0.6667, 4);
  });

  test('handles empty outputs array', () => {
    const result = checkOutputValidity({ outputs: [] });
    expect(result.results).toHaveLength(0);
    expect(result.summary.total).toBe(0);
    expect(result.summary.valid).toBe(0);
    expect(result.summary.invalid).toBe(0);
    expect(result.summary.rate).toBeNull();
  });

  test('treats unknown category as valid with warning', () => {
    const outputs = [
      { category: 'unknown/cat', output: { foo: 'bar' } },
    ];
    const result = checkOutputValidity({ outputs });
    expect(result.summary.valid).toBe(1);
    expect(result.results[0].warnings.some((w) => w.includes('no schema'))).toBe(true);
  });
});

// ── runOutputValidityEval ────────────────────────────────────────────

describe('runOutputValidityEval()', () => {
  test('delegates to checkOutputValidity', () => {
    const outputs = [
      { category: 'yida/app', output: { appType: 'form', appUrl: 'https://example.com' } },
    ];
    const direct = checkOutputValidity({ outputs });
    const delegated = runOutputValidityEval({ outputs });
    expect(delegated).toEqual(direct);
  });

  test('handles undefined options gracefully', () => {
    const result = runOutputValidityEval();
    expect(result.summary.total).toBe(0);
    expect(result.summary.rate).toBeNull();
  });
});
