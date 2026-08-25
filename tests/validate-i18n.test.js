'use strict';

const path = require('path');

const { computeReport, findRegressions } = require('../scripts/validate-i18n');
const en = require('../lib/core/locales/en');

const optionalLocales = ['ar', 'de', 'es', 'fr', 'hi', 'ja', 'ko', 'pt', 'vi', 'zh-HK'];
const translatedKeys = {
  app_permission: Object.keys(en.app_permission),
  corp_manager: Object.keys(en.corp_manager),
  save_permission: Object.keys(en.save_permission),
  save_share_config: ['err_page_url_prefix', 'verify_failed', 'current_state_incomplete'],
  publish: [
    'lint_jsx_text_identifier',
    'lint_form_open_container',
    'lint_form_detail_link',
    'lint_searchformdata_http_path',
    'lint_searchformdata_http_query_params',
    'lint_searchformdata_http_csrf',
    'lint_searchformdata_http_credentials',
    'lint_canvas_yida_api_bridge_missing',
  ],
};

function placeholders(value) {
  return [...value.matchAll(/\{\d+\}/g)].map((match) => match[0]).sort();
}

describe('i18n baseline ratchet', () => {
  test('detects a different missing key even when the total count is unchanged', () => {
    const report = {
      vi: {
        missing: ['save_permission.new_verify_failed'],
        typeMismatch: [],
      },
    };
    const baseline = {
      locales: {
        vi: {
          missing: 1,
          missingKeys: ['save_permission.old_verify_failed'],
          typeMismatch: 0,
          typeMismatchKeys: [],
        },
      },
    };

    expect(findRegressions(report, baseline)).toEqual([
      'vi 新增缺失 1 个：save_permission.new_verify_failed',
    ]);
  });

  test('checks optional locales instead of limiting the ratchet to English', () => {
    const report = {
      en: { missing: [], typeMismatch: [] },
      'zh-HK': { missing: ['corp_manager.admin_verify_failed'], typeMismatch: [] },
    };
    const baseline = {
      locales: {
        en: { missingKeys: [], typeMismatchKeys: [] },
        'zh-HK': { missingKeys: [], typeMismatchKeys: [] },
      },
    };

    expect(findRegressions(report, baseline)).toEqual([
      'zh-HK 新增缺失 1 个：corp_manager.admin_verify_failed',
    ]);
  });

  test('keeps backward compatibility with count-only baselines', () => {
    const report = {
      vi: { missing: ['a', 'b'], typeMismatch: [] },
    };
    const baseline = {
      locales: {
        vi: { missing: 1, typeMismatch: 0 },
      },
    };

    expect(findRegressions(report, baseline)).toEqual(['vi 缺失 1 → 2']);
  });

  test('all locale packs are structurally complete', () => {
    const { report } = computeReport();

    Object.values(report).forEach((localeReport) => {
      expect(localeReport.missing).toEqual([]);
      expect(localeReport.typeMismatch).toEqual([]);
    });
  });

  test.each(optionalLocales)('%s preserves placeholders in newly completed messages', (locale) => {
    const translated = require(path.join('..', 'locales-extra', 'core', locale));

    Object.entries(translatedKeys).forEach(([group, keys]) => {
      keys.forEach((key) => {
        expect(placeholders(translated[group][key])).toEqual(placeholders(en[group][key]));
      });
    });
  });
});
