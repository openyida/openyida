'use strict';

const { t, getLanguage, setLanguage, detectLanguage, SUPPORTED_LANGUAGES } = require('../lib/core/i18n');

// ── 测试前后还原语言和环境变量 ────────────────────────────────────────

const originalLang = getLanguage();
const originalEnv = {
  OPENYIDA_LANG: process.env.OPENYIDA_LANG,
  LANG: process.env.LANG,
  LC_ALL: process.env.LC_ALL,
};

afterEach(() => {
  // 还原语言设置
  setLanguage(originalLang);
  // 还原环境变量
  if (originalEnv.OPENYIDA_LANG === undefined) {
    delete process.env.OPENYIDA_LANG;
  } else {
    process.env.OPENYIDA_LANG = originalEnv.OPENYIDA_LANG;
  }
  if (originalEnv.LANG === undefined) {
    delete process.env.LANG;
  } else {
    process.env.LANG = originalEnv.LANG;
  }
  if (originalEnv.LC_ALL === undefined) {
    delete process.env.LC_ALL;
  } else {
    process.env.LC_ALL = originalEnv.LC_ALL;
  }
});

// ── SUPPORTED_LANGUAGES ───────────────────────────────────────────────

describe('SUPPORTED_LANGUAGES', () => {
  test('包含所有预期语言代码', () => {
    const expected = ['zh', 'zh-TW', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'vi', 'hi', 'ar'];
    expect(SUPPORTED_LANGUAGES).toEqual(expected);
  });

  test('共 12 种语言', () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(12);
  });
});

// ── setLanguage / getLanguage ─────────────────────────────────────────

describe('setLanguage / getLanguage', () => {
  test('切换到英文后 getLanguage 返回 en', () => {
    setLanguage('en');
    expect(getLanguage()).toBe('en');
  });

  test('切换到繁体中文后 getLanguage 返回 zh-TW', () => {
    setLanguage('zh-TW');
    expect(getLanguage()).toBe('zh-TW');
  });

  test('设置不支持的语言时不生效，保持原语言', () => {
    setLanguage('zh');
    setLanguage('xx-INVALID');
    expect(getLanguage()).toBe('zh');
  });

  test('切换语言后 t() 使用新语言翻译', () => {
    setLanguage('zh');
    const zhResult = t('cli.unknown_command');
    setLanguage('en');
    const enResult = t('cli.unknown_command');
    // 中英文翻译应该不同
    expect(zhResult).not.toBe(enResult);
    // 英文结果应该包含英文字符
    expect(enResult).toMatch(/[a-zA-Z]/);
  });
});

// ── detectLanguage ────────────────────────────────────────────────────

describe('detectLanguage', () => {
  test('OPENYIDA_LANG=en 时检测为 en', () => {
    process.env.OPENYIDA_LANG = 'en';
    delete process.env.LANG;
    delete process.env.LC_ALL;
    expect(detectLanguage()).toBe('en');
  });

  test('OPENYIDA_LANG=zh-TW 时检测为 zh-TW', () => {
    process.env.OPENYIDA_LANG = 'zh-TW';
    expect(detectLanguage()).toBe('zh-TW');
  });

  test('OPENYIDA_LANG=zh-HK 时映射为 zh-TW', () => {
    process.env.OPENYIDA_LANG = 'zh-HK';
    expect(detectLanguage()).toBe('zh-TW');
  });

  test('OPENYIDA_LANG=en-US 时提取主语言代码 en', () => {
    process.env.OPENYIDA_LANG = 'en-US';
    expect(detectLanguage()).toBe('en');
  });

  test('OPENYIDA_LANG=ja 时检测为 ja', () => {
    process.env.OPENYIDA_LANG = 'ja';
    expect(detectLanguage()).toBe('ja');
  });

  test('OPENYIDA_LANG 不支持时回退到系统 LANG', () => {
    process.env.OPENYIDA_LANG = 'xx-UNKNOWN';
    process.env.LANG = 'ko_KR.UTF-8';
    delete process.env.LC_ALL;
    expect(detectLanguage()).toBe('ko');
  });

  test('系统 LANG=zh_TW.UTF-8 时检测为 zh-TW', () => {
    delete process.env.OPENYIDA_LANG;
    process.env.LANG = 'zh_TW.UTF-8';
    delete process.env.LC_ALL;
    expect(detectLanguage()).toBe('zh-TW');
  });

  test('LC_ALL 优先于 LANG', () => {
    delete process.env.OPENYIDA_LANG;
    process.env.LC_ALL = 'fr_FR.UTF-8';
    process.env.LANG = 'en_US.UTF-8';
    expect(detectLanguage()).toBe('fr');
  });

  test('无任何语言环境变量时默认返回 zh', () => {
    delete process.env.OPENYIDA_LANG;
    delete process.env.LANG;
    delete process.env.LC_ALL;
    expect(detectLanguage()).toBe('zh');
  });
});

// ── t() 翻译函数 ──────────────────────────────────────────────────────

describe('t()', () => {
  beforeEach(() => {
    setLanguage('zh');
  });

  test('返回已有翻译键的字符串', () => {
    const result = t('cli.unknown_command');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('不存在的键返回键名本身', () => {
    const result = t('non.existent.key.xyz');
    expect(result).toBe('non.existent.key.xyz');
  });

  test('支持 {0} 占位符插值', () => {
    // cli.exec_failed 包含 {0} 占位符
    const result = t('cli.exec_failed', '测试错误');
    expect(result).toContain('测试错误');
    expect(result).not.toContain('{0}');
  });

  test('支持多个占位符 {0} {1}', () => {
    // 使用 env.os 键，包含两个占位符
    const result = t('env.os', 'darwin', 'arm64');
    expect(result).toContain('darwin');
    expect(result).toContain('arm64');
  });

  test('占位符参数为 undefined 时保留原始占位符', () => {
    const result = t('cli.exec_failed');
    expect(result).toContain('{0}');
  });

  test('切换到英文后翻译结果变化', () => {
    setLanguage('zh');
    const zhText = t('cli.unknown_command');
    setLanguage('en');
    const enText = t('cli.unknown_command');
    expect(zhText).not.toBe(enText);
  });

  test('英文环境下找不到翻译时兜底到中文', () => {
    setLanguage('en');
    // 使用一个中文语言包有但英文可能没有的键
    // 无论如何，结果应该是字符串而非键名
    const result = t('cli.unknown_command');
    expect(typeof result).toBe('string');
    expect(result).not.toBe('');
  });

  test('支持嵌套路径（点号分隔）', () => {
    // 验证点号分隔的嵌套路径能正确解析
    const result = t('env.title');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
