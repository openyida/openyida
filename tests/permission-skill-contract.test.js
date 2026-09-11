'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('permission domain documentation contract', () => {
  test('form permission skill requires exact package identity and one-shot canonical readback', () => {
    const skill = read('yida-skills/skills/yida-form-permission/SKILL.md');

    expect(skill).toContain('--package-uuid <packageUuid>');
    expect(skill).toContain('只写一次');
    expect(skill).toContain('canonical readback');
    expect(skill).toContain('SAVE_PERMISSION_VERIFY_FAILED');
    expect(skill).toContain('SAVE_PERMISSION_VERIFY_UNKNOWN');
    expect(skill).toContain('禁止直接重放');
  });

  test('page config skill declares openAuth tri-state preservation', () => {
    const skill = read('yida-skills/skills/yida-page-config/SKILL.md');

    expect(skill).toContain('openAuth 为三态');
    expect(skill).toContain('省略=完整保留');
    expect(skill).toContain('显式 y/n=只修改 openAuth');
    expect(skill).toContain('authType/authSources');
    expect(skill).toContain('不可解析时 fail-closed');
  });

  test('all 12 locales expose the new safety messages', () => {
    const localePaths = [
      'lib/core/locales/zh.js',
      'lib/core/locales/en.js',
      ...['zh-HK', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'vi', 'hi', 'ar']
        .map(language => `locales-extra/core/${language}.js`),
    ];

    for (const localePath of localePaths) {
      const locale = require(path.join(ROOT, localePath));
      expect(locale.save_permission).toEqual(expect.objectContaining({
        package_uuid_create_conflict: expect.any(String),
        package_uuid_not_found: expect.any(String),
        before_unknown: expect.any(String),
        verify_failed: expect.any(String),
        verify_unknown: expect.any(String),
      }));
      expect(locale.save_share_config).toEqual(expect.objectContaining({
        open_auth_preserve: expect.any(String),
      }));
      expect(locale.save_share_config.open_auth_hint).toEqual(expect.any(String));
    }
  });
});
