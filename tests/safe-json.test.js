'use strict';

const { safeParseJson, preprocessJsonInput, normalizeSmartQuotes } = require('../lib/core/safe-json');
const { setLanguage } = require('../lib/core/i18n');

describe('safe-json preprocessing (#3)', () => {
  beforeAll(() => setLanguage('zh'));

  test('parses plain valid JSON', () => {
    expect(safeParseJson('{"a":1,"b":[2,3]}')).toEqual({ a: 1, b: [2, 3] });
  });

  test('strips a UTF-8 BOM before parsing', () => {
    const withBom = '﻿{"ok":true}';
    expect(safeParseJson(withBom)).toEqual({ ok: true });
  });

  test('trims leading/trailing whitespace', () => {
    expect(safeParseJson('   \n  [1,2]  \n')).toEqual([1, 2]);
  });

  test('preprocessJsonInput strips BOM and trims', () => {
    expect(preprocessJsonInput('﻿  hi  ')).toBe('hi');
  });

  test('normalizeSmartQuotes converts curly quotes to ASCII', () => {
    expect(normalizeSmartQuotes('“name”')).toBe('"name"');
    expect(normalizeSmartQuotes('‘x’')).toBe("'x'");
  });

  test('auto-recovers when only smart quotes broke the JSON', () => {
    const input = '{“name”:“OpenKuma”}';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(safeParseJson(input)).toEqual({ name: 'OpenKuma' });
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('智能引号'));
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe('safe-json friendly diagnostics (#2)', () => {
  function messageOf(input) {
    try {
      safeParseJson(input, { recoverSmartQuotes: false });
      throw new Error('expected safeParseJson to throw');
    } catch (err) {
      return err.message;
    }
  }

  test('flags an unquoted key', () => {
    const msg = messageOf('{name:1}');
    expect(msg).toContain('疑似原因');
    expect(msg).toContain('未加双引号');
    expect(msg).toContain('建议');
  });

  test('flags a single-quoted value/key', () => {
    const msg = messageOf("{'a':1}");
    expect(msg).toContain('单引号');
  });

  test('flags a trailing comma', () => {
    const msg = messageOf('[1,2,]');
    expect(msg).toContain('尾逗号');
  });

  test('includes a position and caret snippet', () => {
    const msg = messageOf('{"a":1 "b":2}');
    expect(msg).toContain('出错位置');
    expect(msg).toContain('^');
  });

  test('error carries the original parse error', () => {
    try {
      safeParseJson('{bad}', { recoverSmartQuotes: false });
    } catch (err) {
      expect(err.original).toBeInstanceOf(Error);
    }
  });
});
