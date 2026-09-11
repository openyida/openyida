'use strict';

const {
  isBrowserMissingError,
  BROWSER_MISSING_HINT,
  slugify,
  normalizeCookies,
  evaluatePageRuntime,
  runtimeFindingsFromScreenshots,
} = require('../scripts/eval/screenshot');

describe('eval screenshot', () => {
  test('isBrowserMissingError 识别浏览器二进制缺失横幅', () => {
    expect(isBrowserMissingError("browserType.launch: Executable doesn't exist at /x/chrome")).toBe(true);
    expect(isBrowserMissingError('Please run the following command to download new browsers')).toBe(true);
    expect(isBrowserMissingError('npx playwright install')).toBe(true);
    expect(isBrowserMissingError('chrome-headless-shell not found')).toBe(true);
  });

  test('isBrowserMissingError 对普通错误返回 false', () => {
    expect(isBrowserMissingError('net::ERR_CONNECTION_REFUSED')).toBe(false);
    expect(isBrowserMissingError('Timeout 30000ms exceeded')).toBe(false);
    expect(isBrowserMissingError('')).toBe(false);
    expect(isBrowserMissingError()).toBe(false);
  });

  test('BROWSER_MISSING_HINT 给出可执行的修复指引', () => {
    expect(BROWSER_MISSING_HINT).toMatch(/playwright install/);
  });

  test('slugify / normalizeCookies 基础行为保持', () => {
    expect(slugify('Dashboard 页面!', 'x')).toBe('Dashboard');
    expect(normalizeCookies([{ name: 'a', value: 1, domain: '.x.com' }], 'https://x.com')[0])
      .toMatchObject({ name: 'a', value: '1', domain: '.x.com', path: '/' });
  });

  test('页面运行时契约同时检查错误、破图、加载和空数据文案', () => {
    const evaluation = evaluatePageRuntime({
      bodyText: 'CRM 工作台 暂无数据',
      textLength: 12,
      consoleErrorCount: 0,
      pageErrorCount: 0,
      brokenImageCount: 0,
      loadingIndicatorCount: 0,
    }, { minTextLength: 10, forbiddenTextAny: ['暂无数据'] });
    expect(evaluation.pass).toBe(false);
    expect(evaluation.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'forbiddenTextAny', ok: false }),
      expect.objectContaining({ name: 'loadingSettled', ok: true }),
    ]));
  });

  test('已知数据非空但页面仍全 0 时运行态验收失败', () => {
    const failed = evaluatePageRuntime({
      bodyText: '客户看板 客户总数 0 联系人总数 0',
      textLength: 24,
    }, {
      requireKnownDataEvidence: true,
      knownDataCounts: [{ name: '客户', count: 3 }],
    });
    expect(failed.pass).toBe(false);
    expect(failed.checks).toContainEqual(expect.objectContaining({ name: 'knownDataEvidence', ok: false }));

    const passed = evaluatePageRuntime({
      bodyText: '客户经营看板 客户总数 3 联系人总数 2 商机总数 1',
      textLength: 28,
    }, {
      requireKnownDataEvidence: true,
      knownDataCounts: [{ name: '客户', count: 3 }],
    });
    expect(passed.pass).toBe(true);

    const emptySource = evaluatePageRuntime({
      bodyText: '客户经营看板 客户总数 0 当前暂无业务记录',
      textLength: 24,
    }, {
      requireKnownDataEvidence: true,
      knownDataCounts: [{ name: '客户', count: 0 }],
    });
    expect(emptySource.pass).toBe(true);
  });

  test('截图运行时失败转换为可归因证据且不携带页面正文', () => {
    const findings = runtimeFindingsFromScreenshots([{
      scenarioId: 'crm', name: '我的线索', url: 'https://x/page',
      runtimeChecks: [
        { name: 'forbiddenTextAny', ok: false, detail: '命中禁止文案：暂无数据' },
        { name: 'brokenImages', ok: false, detail: '期望 ≤0，实际 1' },
      ],
    }]);
    expect(findings).toEqual([
      expect.objectContaining({ code: 'page-visible-data-missing', scenarioId: 'crm' }),
      expect.objectContaining({ code: 'browser-runtime-signal-failed', scenarioId: 'crm' }),
    ]);
    expect(JSON.stringify(findings)).not.toContain('页面正文');
  });
});
