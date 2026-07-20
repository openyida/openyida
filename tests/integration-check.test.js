'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { SUPPORTED_LANGUAGES, loadLocaleForLanguage, t } = require('../lib/core/i18n');
const {
  formatProgressBar,
  sanitizeSheetName,
  buildAppRows,
  buildXlsxWorkbook,
  exportResultToExcel,
  formatTimestamp,
  normalizeLogStatus,
  parseAppTypes,
  collectFlowsFromListResponse,
} = require('../lib/integration/integration-check');

describe('integration check', () => {
  const integrationCheckLocaleKeys = [
    'result_sheet',
    'header_app',
    'header_form_title',
    'header_form_uuid',
    'header_flow_name',
    'header_process_code',
    'header_flow_status',
    'header_event_name',
    'header_last_action',
    'header_modifier',
    'header_modified_time',
    'header_abnormal_log_count',
    'header_proc_inst_id',
    'header_form_inst_id',
    'header_execution_status',
    'header_exception',
    'header_diagnosis',
    'header_recommendation',
    'header_start_time',
    'header_finish_time',
    'header_elapsed_ms',
    'no_abnormal',
    'app_failed',
    'summary',
    'apps_failed',
    'no_logs',
    'usage',
    'example',
    'missing_app',
    'banner_title',
    'status_filter',
    'checking_app',
    'progress',
    'current',
    'excel_exported',
  ];

  test('formatProgressBar renders a horizontal progress bar', () => {
    expect(formatProgressBar(5, 10, 10)).toBe('[#####-----]  50% (5/10)');
    expect(formatProgressBar(10, 10, 10)).toBe('[##########] 100% (10/10)');
    expect(formatProgressBar(0, 0, 10)).toBe('[----------]   0% (0/0)');
  });

  test('normalizeLogStatus maps frontend log status aliases', () => {
    expect(normalizeLogStatus()).toBe('2');
    expect(normalizeLogStatus('exception')).toBe('2');
    expect(normalizeLogStatus('success')).toBe('3');
    expect(normalizeLogStatus('running')).toBe('0');
    expect(normalizeLogStatus('2')).toBe('2');
    expect(() => normalizeLogStatus('bad')).toThrow('不支持的日志状态');
  });

  test('parseAppTypes keeps app ids while excluding valued flags', () => {
    expect(parseAppTypes(['--json', 'APP_A', '--output', 'result.xlsx', 'APP_B'])).toEqual(['APP_A', 'APP_B']);
    expect(parseAppTypes(['APP_A', '-o', 'result.xlsx', '--log-page-size', '1'])).toEqual(['APP_A']);
  });

  test('sanitizeSheetName removes invalid characters, truncates and deduplicates', () => {
    const usedNames = new Set();
    expect(sanitizeSheetName('APP/A:*?[测试]', 'fallback', usedNames)).toBe('APP A 测试');
    expect(sanitizeSheetName('012345678901234567890123456789012345', 'fallback', usedNames)).toHaveLength(31);
    expect(sanitizeSheetName('APP/A:*?[测试]', 'fallback', usedNames)).toBe('APP A 测试 2');
  });

  test('formatTimestamp renders millisecond timestamps as readable text', () => {
    expect(formatTimestamp('abc')).toBe('abc');
    expect(formatTimestamp('')).toBe('');
    expect(formatTimestamp(0)).toMatch(/^1970-01-01 /);
  });

  test('buildAppRows returns abnormal log rows for one app', () => {
    const rows = buildAppRows('APP_A', [
      {
        appType: 'APP_A',
        formTitle: '项目线索',
        formUuid: 'FORM-A',
        name: '分配负责人',
        processCode: 'LPROC-A',
        status: 'y',
        eventName: '表单更新成功',
        abnormalLogCount: 1,
        diagnostics: [{
          severity: 'error',
          title: '连接器执行异常',
          recommendation: '检查连接器配置',
        }],
        logs: [
          {
            procInstId: 'PROC-1',
            formInstId: 'FORMINST-1',
            status: '2',
            exceptionEntity: '目标列不存在',
            elapsedTime: 20,
          },
        ],
      },
      {
        appType: 'APP_B',
        name: '其他应用',
        processCode: 'LPROC-B',
        abnormalLogCount: 1,
        logs: [{ exceptionEntity: '不应出现' }],
      },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual(expect.arrayContaining(['APP_A', '项目线索', '分配负责人', '目标列不存在']));
    expect(rows[1]).toEqual(expect.arrayContaining(['[error] 连接器执行异常', '检查连接器配置']));
  });

  test('buildAppRows records no-abnormal and app-error rows', () => {
    expect(buildAppRows('APP_EMPTY', [])[1][14]).toBe(t('integration_check.no_abnormal'));
    expect(buildAppRows('APP_ERR', [], [{ appType: 'APP_ERR', message: '登录态失效' }])[1][14])
      .toBe(t('integration_check.app_failed', '登录态失效'));
  });

  test('all locale packs include integration check messages', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const locale = loadLocaleForLanguage(language);
      expect(locale).toBeTruthy();
      expect(locale.help.cmd_integration_check).toEqual(expect.any(String));
      for (const key of integrationCheckLocaleKeys) {
        expect(locale.integration_check[key]).toEqual(expect.any(String));
        expect(locale.integration_check[key]).not.toBe('');
      }
    }
  });

  test('buildXlsxWorkbook creates an xlsx zip buffer', () => {
    const buffer = buildXlsxWorkbook([{ name: 'APP_A', rows: buildAppRows('APP_A', []) }]);
    expect(buffer.slice(0, 2).toString()).toBe('PK');
    expect(buffer.includes(Buffer.from('xl/workbook.xml'))).toBe(true);
    expect(buffer.includes(Buffer.from('xl/worksheets/sheet1.xml'))).toBe(true);
  });

  test('exportResultToExcel writes one workbook file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-integration-check-'));
    const file = path.join(dir, 'result.xlsx');
    const exportedPath = exportResultToExcel({
      checkedApps: ['APP_A'],
      totalFlows: 0,
      abnormalFlows: [],
      errors: [],
    }, file);

    const buffer = fs.readFileSync(exportedPath);
    expect(exportedPath).toBe(file);
    expect(buffer.slice(0, 2).toString()).toBe('PK');
  });

  test('collectFlowsFromListResponse flattens grouped flowList items and deduplicates processCode', () => {
    const result = {
      appType: 'APP_TEST',
      flows: [],
      seenProcessCodes: new Set(),
    };

    collectFlowsFromListResponse(result, {
      data: [
        {
          formUuid: 'FORM-A',
          formTitle: '表单A',
          formType: 'receipt',
          flowList: [
            { name: '异常同步', processCode: 'LPROC-A', status: 'y', eventName: '表单创建成功' },
            { name: '异常同步重复', processCode: 'LPROC-A', status: 'y' },
          ],
        },
        { formUuid: 'FORM-B', name: '平铺自动化', processCode: 'LPROC-B', status: 'n' },
      ],
    });

    expect(result.flows).toHaveLength(2);
    expect(result.flows[0]).toMatchObject({
      appType: 'APP_TEST',
      formUuid: 'FORM-A',
      formTitle: '表单A',
      name: '异常同步',
      processCode: 'LPROC-A',
    });
    expect(result.flows[1]).toMatchObject({
      formUuid: 'FORM-B',
      name: '平铺自动化',
      processCode: 'LPROC-B',
    });
  });
});
