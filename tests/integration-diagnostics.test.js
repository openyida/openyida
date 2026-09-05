'use strict';

const {
  diagnoseText,
  diagnoseFlow,
  buildCheckHints,
  listPitfallRules,
} = require('../lib/integration/integration-diagnostics');
const { readInput } = require('../lib/integration/integration-diagnose');

describe('integration diagnostics', () => {
  test('diagnoseText detects connector failures and retry overwrite risk', () => {
    const findings = diagnoseText('连接器异常：接口参数异常。流程异常后重试会从头执行并覆盖之前更新的数据。');
    const ids = findings.map((finding) => finding.id);

    expect(ids).toContain('connector-error');
    expect(ids).toContain('retry-replays-flow');
  });

  test('diagnoseText covers get-self, serial number and empty branch pitfalls', () => {
    const findings = diagnoseText('获取自身请用表单实例ID；流水号在编辑触发后可能为空；条件分支空值建议 ISEMPTY()。');
    const ids = findings.map((finding) => finding.id);

    expect(ids).toEqual(expect.arrayContaining([
      'get-self-form-inst-id',
      'serial-number-after-trigger',
      'condition-empty-isempty',
    ]));
  });

  test('diagnoseText detects invalid data retrieve filter field', () => {
    const findings = diagnoseText('RetryException: page fail,selectListException  暂时不支持其他类型Field: field is null');
    const fieldFinding = findings.find((finding) => finding.id === 'data-retrieve-field-null');

    expect(fieldFinding).toMatchObject({
      severity: 'error',
    });
    expect(fieldFinding.recommendation).toContain('pid');
    expect(fieldFinding.recommendation).toContain('proc_inst_id');
    expect(fieldFinding.recommendation).toContain('form_inst_id');
    expect(fieldFinding.recommendation).toContain('__masterdata_form_inst_id');
  });

  test('diagnoseFlow falls back for unknown abnormal logs', () => {
    const findings = diagnoseFlow({
      name: 'unknown',
      logs: [{ exceptionEntity: 'some platform failure', status: '2' }],
    });

    expect(findings[0]).toMatchObject({
      id: 'unknown-abnormal',
      severity: 'warning',
    });
  });

  test('pitfall rules and check hints are machine-readable', () => {
    expect(listPitfallRules().map((rule) => rule.id)).toContain('direct-update-no-recursive-trigger');
    expect(buildCheckHints().map((hint) => hint.id)).toContain('get-self-standard');
    expect(buildCheckHints({ lang: 'en' }).find((hint) => hint.id === 'get-self-standard').message)
      .toContain('pid at runtime and proc_inst_id in the designer');
  });

  test('diagnose command reads positional text', () => {
    expect(readInput(['连接器异常', '接口参数异常'])).toBe('连接器异常 接口参数异常');
  });
});
