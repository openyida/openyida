'use strict';

const {
  extractLastJsonValue,
  reportInspectMetadata,
  dataInstanceCount,
  collectOpenYidaReadback,
} = require('../scripts/eval/openyida-readback');

describe('eval OpenYida platform readback', () => {
  test('extractLastJsonValue tolerates ANSI logs before a JSON array', () => {
    const value = extractLastJsonValue('\u001b[33mwarn\u001b[0m\n[{"formUuid":"FORM_X"}]\n');
    expect(value).toEqual([{ formUuid: 'FORM_X' }]);
  });

  test('reportInspectMetadata 统计组件、图表和跨应用 cube', () => {
    expect(reportInspectMetadata({
      schemaVersion: 'V5',
      componentCount: 3,
      runtimeQueryVerified: true,
      components: [
        { componentName: 'YoushuGroupedBarChart', cubeCodes: ['FORM_A'], queryProbe: { success: true } },
        { componentName: 'YoushuPieChart', cubeCodes: ['FORM_EXTERNAL'] },
        { componentName: 'YoushuSelectFilter', cubeCodes: ['FORM_A'] },
      ],
      layout: [{ i: 'a' }, { i: 'b' }],
    }, ['FORM-A'])).toEqual({
      schemaVersion: 'V5', componentCount: 3, chartCount: 2, layoutCount: 2,
      componentNames: ['YoushuGroupedBarChart', 'YoushuPieChart', 'YoushuSelectFilter'],
      cubeCodes: ['FORM_A', 'FORM_EXTERNAL'],
      unknownCubeCodes: ['FORM_EXTERNAL'], unknownCubeCount: 1,
      runtimeQueryVerified: true, failedQueryProbeCount: 0,
    });
  });

  test('dataInstanceCount 兼容 query form 的直接和嵌套输出', () => {
    expect(dataInstanceCount({ totalCount: 3, data: [{}] })).toBe(3);
    expect(dataInstanceCount({ content: { totalCount: 2, data: [{}] } })).toBe(2);
    expect(dataInstanceCount({ data: [{}, {}] })).toBe(2);
  });

  test('collects resources and targets from deterministic CLI readback', () => {
    const responses = new Map([
      ['list-forms APP_X', [
        { formUuid: 'FORM_A', formName: '线索', formType: 'receipt' },
        { formUuid: 'FORM_P', formName: '报价', formType: 'process' },
        { formUuid: 'FORM_D', formName: 'CRM工作台', formType: 'display' },
        { formUuid: 'REPORT_R', formName: '经营报表', formType: 'report' },
      ]],
      ['integration list APP_X --json', [
        { processCode: 'LPROC_X', name: '新增线索通知', status: 'y' },
      ]],
      ['nav-group list APP_X', {
        tree: [{ type: 'group', navUuid: 'NAV_X', name: '客户管理', children: [] }],
      }],
      ['i18n overview APP_X', {
        config: { languageList: [
          { enabled: true, languageTag: 'zh_CN' },
          { enabled: true, languageTag: 'en_US' },
        ] },
      }],
      ['get-permission APP_X FORM_A', { permissionGroupList: [{ packageUuid: 'PKG_X' }] }],
      ['get-page-config APP_X FORM_D', { isOpen: true, openUrl: '/o/crm' }],
      ['data query form APP_X FORM_A --page 1 --size 1', { success: true, totalCount: 2, data: [{}] }],
      ['report inspect APP_X REPORT_R --json', {
        success: true, schemaVersion: 'V5', componentCount: 2, runtimeQueryVerified: true,
        components: [{ componentName: 'YoushuPieChart', cubeCodes: ['FORM_A'], queryProbe: { success: true } }],
        layout: [{ i: 'chart' }],
      }],
    ]);
    const spawn = (_cli, args) => ({
      status: 0,
      stdout: JSON.stringify(responses.get(args.join(' '))),
      stderr: '',
    });

    const evidence = collectOpenYidaReadback({
      scenario: {
        readback: {
          enabled: true,
          appType: 'APP_X',
          baseUrl: 'https://ding.aliwork.com',
          portalNames: ['CRM工作台'],
          reportInspect: true,
          pageRuntime: {
            enabled: true,
            defaults: { maxConsoleErrors: 0, requireKnownDataEvidence: true },
            byName: { CRM工作台: { minTextLength: 100 } },
          },
          permissionFormNames: ['线索'],
          dataPresenceFormNames: ['线索'],
          sharePageNames: ['CRM工作台'],
        },
      },
      result: { appType: 'APP_X' },
    }, { cliPath: '/fake/openyida', spawn });

    expect(evidence.resources).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'app', id: 'APP_X' }),
      expect.objectContaining({ type: 'form', id: 'FORM_A' }),
      expect.objectContaining({ type: 'process', id: 'FORM_P' }),
      expect.objectContaining({ type: 'page', id: 'FORM_D' }),
      expect.objectContaining({ type: 'portal', id: 'FORM_D' }),
      expect.objectContaining({
        type: 'report', id: 'REPORT_R', schemaVersion: 'V5', componentCount: 2,
        chartCount: 1, componentNames: ['YoushuPieChart'], unknownCubeCount: 0,
        runtimeQueryVerified: true, failedQueryProbeCount: 0,
      }),
      expect.objectContaining({ type: 'integration', id: 'LPROC_X' }),
      expect.objectContaining({ type: 'nav', id: 'NAV_X' }),
      expect.objectContaining({ type: 'i18n', id: 'zh_CN' }),
      expect.objectContaining({
        type: 'permission', id: 'FORM_A', packageCount: 1, packageNames: [],
      }),
      expect.objectContaining({ type: 'sample-data', id: 'FORM_A', instanceCount: 2 }),
      expect.objectContaining({ type: 'page-config', id: 'FORM_D' }),
    ]));
    expect(evidence.targets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'page', name: 'CRM工作台', url: 'https://ding.aliwork.com/APP_X/workbench/FORM_D',
        runtimeExpectations: {
          maxConsoleErrors: 0,
          requireKnownDataEvidence: true,
          minTextLength: 100,
          knownDataCounts: [{ name: '线索', formUuid: 'FORM_A', count: 2 }],
        },
      }),
      expect.objectContaining({ type: 'report', url: 'https://ding.aliwork.com/APP_X/workbench/REPORT_R' }),
    ]));
    expect(evidence.findings).toEqual([]);
    expect(evidence.sources).toEqual(['platform-readback']);
  });

  test('reports readback failures without inventing resources', () => {
    const evidence = collectOpenYidaReadback({
      scenario: { readback: { enabled: true, appType: 'APP_X' } },
      result: { appType: 'APP_X' },
    }, {
      cliPath: '/fake/openyida',
      spawn: () => ({ status: 1, stdout: '', stderr: 'boom' }),
    });
    expect(evidence.resources).toEqual([{ type: 'app', id: 'APP_X', name: 'APP_X', source: 'platform-readback' }]);
    expect(evidence.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'platform-readback-failed' }),
    ]));
  });

  test('before phase captures only requested Schema snapshots', () => {
    const responses = new Map([
      ['list-forms APP_X', [{ formUuid: 'FORM_A', formName: '客户', formType: 'receipt' }]],
      ['get-schema APP_X FORM_A --summary-json', {
        appType: 'APP_X', formUuid: 'FORM_A', fields: [{ fieldId: 'text_name' }],
      }],
    ]);
    const evidence = collectOpenYidaReadback({
      phase: 'before',
      scenario: { readback: {
        enabled: true, appType: 'APP_X', schemaSnapshotForms: ['客户'],
      } },
      result: { appType: 'APP_X' },
    }, {
      cliPath: '/fake/openyida',
      spawn: (_cli, args) => ({ status: 0, stdout: JSON.stringify(responses.get(args.join(' '))), stderr: '' }),
    });
    expect(evidence.resources).toEqual([]);
    expect(evidence.schemaSnapshots.before).toEqual({
      resources: [expect.objectContaining({
        type: 'FORM_A/field', formUuid: 'FORM_A', fieldId: 'text_name',
      })],
    });
  });

  test('resolves duplicate names by resource type instead of API order', () => {
    const responses = new Map([
      ['list-forms APP_X', [
        { formUuid: 'FORM_CONTACT', formName: '联系人', formType: 'receipt' },
        { formUuid: 'PAGE_CONTACT', formName: '联系人', formType: 'display' },
      ]],
      ['integration list APP_X --json', []],
      ['nav-group list APP_X', { tree: [] }],
      ['i18n overview APP_X', { config: { languageList: [] } }],
      ['get-permission APP_X FORM_CONTACT', {
        permissions: [{ packageUuid: 'PKG_X', packageName: '管理员' }],
        totalPackages: 1,
      }],
      ['get-page-config APP_X PAGE_CONTACT', { isOpen: true, openUrl: '/o/contact' }],
    ]);
    const calls = [];
    const evidence = collectOpenYidaReadback({
      scenario: { readback: {
        enabled: true,
        appType: 'APP_X',
        portalNames: ['联系人'],
        permissionFormNames: ['联系人'],
        sharePageNames: ['联系人'],
      } },
      result: { appType: 'APP_X' },
    }, {
      cliPath: '/fake/openyida',
      spawn: (_cli, args) => {
        calls.push(args.join(' '));
        return { status: 0, stdout: JSON.stringify(responses.get(args.join(' '))), stderr: '' };
      },
    });

    expect(calls).toEqual(expect.arrayContaining([
      'get-permission APP_X FORM_CONTACT',
      'get-page-config APP_X PAGE_CONTACT',
    ]));
    expect(evidence.resources).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'portal', id: 'PAGE_CONTACT' }),
      expect.objectContaining({ type: 'permission', id: 'FORM_CONTACT' }),
      expect.objectContaining({ type: 'page-config', id: 'PAGE_CONTACT' }),
    ]));
    expect(evidence.findings).toEqual([]);
  });
});
