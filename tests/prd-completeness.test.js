'use strict';

const {
  evaluatePrdCompleteness,
  parseArgs,
  parseBuildManifest,
  parsePrdMarkdown,
} = require('../lib/app/check-prd-completeness');

function buildPrd() {
  return `
# 销售管理 PRD

## 7. 资源蓝图

| 资源 | 类型 | 用途 | 关键字段 / 功能 | 创建策略 |
| --- | --- | --- | --- | --- |
| 销售工作台 | display-page / main | 入口和概览 | 客户入口 | 创建 |
| 客户信息 | normal-form | 客户数据录入 | 客户名称、状态 | 创建 |
`;
}

function buildManifest(overrides = {}) {
  return {
    resources: [
      { name: '销售工作台', type: 'display-page', formUuid: 'FORM-HOME', main: true, required: true },
      { name: '客户信息', type: 'normal-form', formUuid: 'FORM-CUSTOMER', required: true },
    ],
    ...overrides,
  };
}

describe('prd completeness check', () => {
  const forms = [
    { formUuid: 'FORM-HOME', formName: '销售工作台', formType: 'display' },
    { formUuid: 'FORM-CUSTOMER', formName: '客户信息', formType: 'receipt' },
  ];

  test.each([
    ['red theme', {}, 'pass'],
    ['equivalent CSS color', { themeColor: 'rgb(200, 37, 44)' }, 'pass'],
    ['platform blue', { colour: 'blue', themeColor: '#1677FF' }, 'fail'],
    ['custom blue', { themeColor: '#1677FF' }, 'fail'],
    ['missing application CSS', { customThemeStyle: null }, 'fail'],
    ['disabled CSS', { customThemeStyle: { enabled: false, cssUrl: 'https://example.test/theme.css' } }, 'fail'],
    ['wrong navigation tone', { navTheme: 'dark' }, 'fail'],
    ['legacy light alias', { navTheme: 'white' }, 'pass'],
    ['config field aliases', { colour: undefined, themeColor: undefined, navTheme: undefined, customThemeStyle: undefined,
      config: { COLOUR: 'custom', THEME_COLOR: '#C8252C', NAV_THEME: 'light',
        CUSTOM_THEME_STYLE: JSON.stringify({ enabled: true, cssUrl: 'https://example.test/theme.css' }) } }, 'pass'],
  ])('checks the live application theme against the selected project theme: %s', async (_label, overrides, verdict) => {
    const prd = buildPrd() + '\n```json\n' + JSON.stringify({ applicationTheme: { themeColor: '#C8252C', navTheme: 'light' } }) + '\n```\n';
    const app = { colour: 'custom', themeColor: '#C8252C', navTheme: 'light',
      customThemeStyle: { enabled: true, cssUrl: 'https://example.test/theme.css' }, ...overrides };
    const result = await evaluatePrdCompleteness(prd, { appType: 'APP_XXX', buildManifest: buildManifest() }, {
      fetchForms: jest.fn().mockResolvedValue(forms), fetchApp: jest.fn().mockResolvedValue(app),
    });
    expect(result.verdict).toBe(verdict);
    expect(result.themeVerification).toMatchObject({ configurationReadback: true, verified: verdict === 'pass', runtimeVerified: false });
    expect(JSON.stringify(result)).not.toContain('https://example.test/theme.css');
  });

  test('unavailable application settings never count as verified theme delivery', async () => {
    const prd = buildPrd() + '\n```json\n' + JSON.stringify({ applicationTheme: { themeColor: '#C8252C', navTheme: 'light' } }) + '\n```\n';
    const result = await evaluatePrdCompleteness(prd, { appType: 'APP_XXX', buildManifest: buildManifest() }, {
      fetchForms: jest.fn().mockResolvedValue(forms), fetchApp: jest.fn().mockRejectedValue(new Error('denied')),
    });
    expect(result.verdict).toBe('needs_review');
    expect(result.themeVerification).toEqual({ configurationReadback: false, verified: false, runtimeVerified: false });
  });

  test.each([{}, null])('empty application readback remains unverified: %j', async app => {
    const prd = buildPrd() + '\n```json\n' + JSON.stringify({ applicationTheme: { themeColor: '#C8252C', navTheme: 'light' } }) + '\n```\n';
    const result = await evaluatePrdCompleteness(prd, { appType: 'APP_XXX', buildManifest: buildManifest() }, {
      fetchForms: jest.fn().mockResolvedValue(forms), fetchApp: jest.fn().mockResolvedValue(app),
    });
    expect(result.verdict).toBe('needs_review');
    expect(result.themeVerification.configurationReadback).toBe(false);
  });

  test('legacy PRDs without theme expectations do not add a network request or claim verification', async () => {
    const fetchApp = jest.fn();
    const result = await evaluatePrdCompleteness(buildPrd(), { appType: 'APP_XXX', buildManifest: buildManifest() }, {
      fetchForms: jest.fn().mockResolvedValue(forms), fetchApp,
    });
    expect(fetchApp).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty('themeVerification');
  });

  test.each([
    [true, true, 'pass'], [false, true, 'fail'], [true, false, 'fail'], [false, undefined, 'fail'], [undefined, true, 'needs_review'],
  ])('audits frontend PC and mobile menu visibility independently: %s / %s', async (hidden, mobileHidden, verdict) => {
    const prd = buildPrd() + '\n```json\n' + JSON.stringify({ navigationVisibility: [
      { name: '销售工作台', type: 'display-page', hidden: true, mobileHidden: true },
    ] }) + '\n```\n';
    const fetchForms = jest.fn().mockResolvedValue([{ ...forms[0], hidden, mobileHidden }, forms[1]]);
    const result = await evaluatePrdCompleteness(prd, { appType: 'APP_XXX', buildManifest: buildManifest() }, { fetchForms });
    expect(result.verdict).toBe(verdict);
    expect(fetchForms).toHaveBeenCalledTimes(1);
    expect(fetchForms).toHaveBeenCalledWith('APP_XXX', {}, { includeNavigation: true });
    if (verdict !== 'pass') {expect(result.items[0].id).toMatch(/^frontend_navigation_/);}
  });

  test('does not treat a missing manifest binding as proof that the frontend menu is hidden', async () => {
    const prd = buildPrd() + '\n```json\n' + JSON.stringify({ navigationVisibility: [
      { name: '销售工作台', hidden: true, mobileHidden: true },
    ] }) + '\n```\n';
    const result = await evaluatePrdCompleteness(prd, { appType: 'APP_XXX' }, {
      fetchForms: jest.fn().mockResolvedValue([{ ...forms[0], hidden: true, mobileHidden: true }, forms[1]]),
    });
    expect(result.verdict).toBe('needs_review');
    expect(result.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'frontend_navigation_not_checked' })]));
  });

  test('passes when build manifest required resources match the remote resource list', async () => {
    const fetchSchema = jest.fn(() => Promise.reject(new Error('schema should not be read')));
    const fetchOneFormRecordCount = jest.fn(() => Promise.reject(new Error('seed should not be queried')));
    const result = await evaluatePrdCompleteness(buildPrd(), {
      appType: 'APP_XXX',
      authRef: { baseUrl: 'https://example.test', authMode: 'token' },
      buildManifest: buildManifest(),
      buildManifestPath: 'prd/sales/build-manifest.json',
    }, {
      fetchForms: jest.fn(() => Promise.resolve(forms)),
      fetchSchema,
      fetchOneFormRecordCount,
    });

    expect(result).toMatchObject({
      success: true,
      verdict: 'pass',
      mode: 'delivery_risk_radar',
      sources: {
        buildManifest: {
          mode: 'build_facts',
          path: 'prd/sales/build-manifest.json',
          resources: 2,
        },
      },
      summary: {
        hardFailures: 0,
        needsReview: 0,
        notChecked: 0,
        checked: {
          remoteResources: 2,
          expectedResources: 2,
          matchedResources: 2,
          prdHintResources: 2,
        },
      },
      items: [],
      hardFailures: [],
      warnings: [],
      manualReview: [],
    });
    expect(result).not.toHaveProperty('coverage');
    expect(fetchSchema).not.toHaveBeenCalled();
    expect(fetchOneFormRecordCount).not.toHaveBeenCalled();
  });

  test.each([
    ['portal', 'pass', 1],
    ['display', 'needs_review', 0],
  ])('checks native portal resources by type: %s', async (formType, verdict, matchedResources) => {
    const prd = buildPrd().replace('display-page / main', '宜搭原生门户');
    const manifest = buildManifest();
    manifest.resources[0].type = 'native-portal';
    expect(parsePrdMarkdown(prd).resources[0].kind).toBe('native-portal');
    expect(parsePrdMarkdown(prd.replace('宜搭原生门户', '门户')).resources[0].kind).toBe('display-page');

    const result = await evaluatePrdCompleteness(prd, { appType: 'APP_XXX', buildManifest: manifest }, {
      fetchForms: jest.fn().mockResolvedValue([{ ...forms[0], formType }, forms[1]]),
    });
    expect(result.verdict).toBe(verdict);
    expect(result.summary.checked).toMatchObject({ prdHintResources: 2, matchedResources: matchedResources + 1 });
    if (formType === 'display') {
      expect(result.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'resource_type_mismatch' })]));
    }
  });

  test('matches manifest resources by name and type when formUuid is absent', async () => {
    const result = await evaluatePrdCompleteness('', {
      appType: 'APP_XXX',
      authRef: { baseUrl: 'https://example.test', authMode: 'token' },
      buildManifest: {
        resources: [
          { name: '销售工作台', type: 'display-page', required: true },
          { name: '客户信息', type: 'normal-form', required: true },
        ],
      },
    }, {
      fetchForms: jest.fn(() => Promise.resolve(forms)),
    });

    expect(result.verdict).toBe('pass');
    expect(result.summary.checked).toMatchObject({
      expectedResources: 2,
      matchedResources: 2,
    });
    expect(result.items).toEqual([]);
  });

  test('fails when the target app resource list cannot be read', async () => {
    const result = await evaluatePrdCompleteness(buildPrd(), {
      appType: 'APP_XXX',
      authRef: { baseUrl: 'https://example.test', authMode: 'token' },
      buildManifest: buildManifest(),
    }, {
      fetchForms: jest.fn(() => Promise.reject(new Error('network down'))),
    });

    expect(result.verdict).toBe('fail');
    expect(result.hardFailures).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'app_resource_list_read_failed' }),
    ]));
  });

  test('fails when a required manifest resource has an exact formUuid missing remotely', async () => {
    const result = await evaluatePrdCompleteness(buildPrd(), {
      appType: 'APP_XXX',
      authRef: { baseUrl: 'https://example.test', authMode: 'token' },
      buildManifest: buildManifest(),
    }, {
      fetchForms: jest.fn(() => Promise.resolve(forms.filter(form => form.formUuid !== 'FORM-CUSTOMER'))),
    });

    expect(result.verdict).toBe('fail');
    expect(result.hardFailures).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'resource_missing',
        source: 'build_manifest.resources',
        expected: expect.objectContaining({ formUuid: 'FORM-CUSTOMER' }),
      }),
    ]));
  });

  test('returns needs_review without a build manifest and treats PRD resources as hints only', async () => {
    const result = await evaluatePrdCompleteness(buildPrd(), {
      appType: 'APP_XXX',
      authRef: { baseUrl: 'https://example.test', authMode: 'token' },
    }, {
      fetchForms: jest.fn(() => Promise.resolve([])),
    });

    expect(result.verdict).toBe('needs_review');
    expect(result.hardFailures).toEqual([]);
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'build_manifest_missing',
        status: 'not_checked',
      }),
      expect.objectContaining({
        id: 'prd_resource_hints_not_checked',
        source: 'prd.resourceBlueprint',
        status: 'needs_review',
      }),
    ]));
  });

  test('returns needs_review when a name-only manifest resource cannot be matched', async () => {
    const result = await evaluatePrdCompleteness('', {
      appType: 'APP_XXX',
      authRef: { baseUrl: 'https://example.test', authMode: 'token' },
      buildManifest: {
        resources: [
          { name: '销售工作台', type: 'display-page', required: true },
          { name: '客户信息', type: 'normal-form', required: true },
        ],
      },
    }, {
      fetchForms: jest.fn(() => Promise.resolve([forms[0]])),
    });

    expect(result.verdict).toBe('needs_review');
    expect(result.hardFailures).toEqual([]);
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'resource_unmatched_by_name_type',
        status: 'needs_review',
      }),
      expect.objectContaining({
        id: 'resource_count_mismatch',
        status: 'needs_review',
      }),
    ]));
  });

  test('returns needs_review when PRD hint count and manifest required count differ', async () => {
    const result = await evaluatePrdCompleteness(buildPrd(), {
      appType: 'APP_XXX',
      authRef: { baseUrl: 'https://example.test', authMode: 'token' },
      buildManifest: {
        resources: [
          { name: '销售工作台', type: 'display-page', formUuid: 'FORM-HOME', required: true },
        ],
      },
    }, {
      fetchForms: jest.fn(() => Promise.resolve(forms)),
    });

    expect(result.verdict).toBe('needs_review');
    expect(result.hardFailures).toEqual([]);
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'prd_manifest_resource_count_mismatch',
        status: 'needs_review',
      }),
    ]));
  });

  test('parses args, PRD resource hints, and minimal build manifest resources', () => {
    const parsedArgs = parseArgs(['prd/demo/prd.md', '--app-type', 'APP_XXX', '--build-manifest', 'prd/demo/build-manifest.json', '--json']);
    const parsedPrd = parsePrdMarkdown(buildPrd());
    const parsedManifest = parseBuildManifest({
      pages: [{ name: '销售工作台', type: 'display-page', formUuid: 'FORM-HOME', main: true }],
      forms: [
        { name: '客户信息', type: 'normal-form', formUuid: 'FORM-CUSTOMER' },
        { name: '审批流程', type: 'process-form', formUuid: 'FORM-PROCESS' },
      ],
    });

    expect(parsedArgs).toEqual({
      prdPath: 'prd/demo/prd.md',
      appType: 'APP_XXX',
      buildManifestPath: 'prd/demo/build-manifest.json',
      json: true,
      help: false,
    });
    expect(parsedPrd.resources.map(resource => resource.name)).toEqual(['销售工作台', '客户信息']);
    expect(parsedManifest.resources.map(resource => resource.kind)).toEqual(['display-page', 'normal-form', 'process-form']);
    expect(parsedArgs).not.toHaveProperty('mode');
  });
});
