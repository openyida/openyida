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
