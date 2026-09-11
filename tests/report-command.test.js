'use strict';

const querystring = require('querystring');

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://demo.aliwork.com'),
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  requestWithAutoLogin: jest.fn((requestFn, authRef) => requestFn(authRef)),
  detectActiveTool: jest.fn(() => null),
}));

jest.mock('../lib/core/chalk', () => ({
  warn: jest.fn(),
}));
jest.mock('../lib/integration/integration-api', () => ({
  getFormSchema: jest.fn(),
}));
jest.mock('../lib/report/runtime-probe', () => ({
  probeReportSchema: jest.fn(),
  repairMetadataFieldCodes: jest.fn(),
}));

const utils = require('../lib/core/utils');
const { warn } = require('../lib/core/chalk');
const { createBlankReport, saveReportSchema } = require('../lib/report/http');
const createReport = require('../lib/report/index');
const appendReport = require('../lib/report/append');
const { STALE_SCHEMA_MESSAGE } = require('../lib/core/server-revision');
const { getFormSchema } = require('../lib/integration/integration-api');
const { probeReportSchema, repairMetadataFieldCodes } = require('../lib/report/runtime-probe');

const authRef = {
  baseUrl: 'https://demo.aliwork.com',
  authMode: 'token',
  authSource: 'token',
  corpId: 'corp-1',
  userId: 'user-1',
  authData: {
    base_url: 'https://demo.aliwork.com',
    auth_mode: 'token',
    auth_source: 'token',
    corp_id: 'corp-1',
    user_id: 'user-1',
  },
};

const chartConfig = [{
  type: 'bar',
  title: '销售额',
  cubeCode: 'FORM_SALES',
  xField: { fieldCode: 'textField_name', aliasName: '名称', dataType: 'STRING' },
  yField: [{ fieldCode: 'numberField_amount', aliasName: '金额', dataType: 'NUMBER' }],
}];

function makeReportSchema() {
  return {
    gmtModified: 100,
    pages: [{
      componentsMap: [],
      componentsTree: [{
        children: [{
          componentName: 'RootContent',
          props: { layout: [] },
          children: [],
        }],
      }],
    }],
  };
}

describe('report command helpers', () => {
  let logSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    utils.httpGet.mockReset();
    utils.httpPost.mockReset();
    utils.loadAuthData.mockReturnValue({
      base_url: authRef.baseUrl,
      auth_mode: 'token',
      auth_source: 'token',
      corp_id: 'corp-1',
      user_id: 'user-1',
    });
    utils.requestWithAutoLogin.mockImplementation((requestFn, ref) => requestFn(ref));
    getFormSchema.mockResolvedValue([
      { componentName: 'TextField', props: { fieldId: 'textField_name', label: '名称' } },
      { componentName: 'NumberField', props: { fieldId: 'numberField_amount', label: '金额' } },
      { componentName: 'DateField', props: { fieldId: 'dateField_hireDate', label: '入职日期' } },
      { componentName: 'SelectField', props: { fieldId: 'selectField_status', label: '状态' } },
    ]);
    probeReportSchema.mockResolvedValue({
      success: true,
      runtimeQueryVerified: true,
      probes: [{
        cid: 'cid_1',
        className: 'YoushuGroupedBarChart',
        dataSetKey: 'chartData',
        fields: [],
        status: 'QUERY_OK',
        success: true,
      }],
    });
    repairMetadataFieldCodes.mockReturnValue({ schema: {}, changed: 0, replacements: [] });
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  test('createBlankReport and saveReportSchema use yida-client form posts', async () => {
    utils.httpPost
      .mockResolvedValueOnce({ success: true, content: { formUuid: 'REPORT_1' } })
      .mockResolvedValueOnce({ success: true });

    await createBlankReport(authRef, 'APP_XXX', '销售报表');
    await saveReportSchema(authRef, 'APP_XXX', 'REPORT_1', { pages: [] }, 100);

    expect(utils.httpPost.mock.calls[0][1]).toBe('/dingtalk/web/APP_XXX/query/formdesign/saveFormSchemaInfo.json');
    expect(querystring.parse(utils.httpPost.mock.calls[0][2])).toMatchObject({
      formType: 'report',
    });
    expect(utils.httpPost.mock.calls[1][1]).toBe('/alibaba/web/APP_XXX/_view/query/formdesign/saveFormSchema.json');
    expect(querystring.parse(utils.httpPost.mock.calls[1][2])).toMatchObject({
      formUuid: 'REPORT_1',
      schemaVersion: 'V5',
      domainCode: 'tEXDRG',
      gmtModified: '100',
    });
    expect(querystring.parse(utils.httpPost.mock.calls[1][2])).not.toHaveProperty('importSchema');
    expect(utils.requestWithAutoLogin).not.toHaveBeenCalled();
  });

  test.each([
    ['login expiry', { __needLogin: true }],
    ['CSRF expiry', { __csrfExpired: true }],
    ['redirect', { __needLogin: true, __httpStatus: 302 }],
    ['ordinary failure', { success: false, errorCode: 'FAILED' }],
  ])('report Schema save sends exactly once on %s', async (label, response) => {
    utils.httpPost.mockResolvedValue(response);

    await expect(saveReportSchema(
      authRef,
      'APP_XXX',
      'REPORT_1',
      { pages: [] },
      100
    )).resolves.toEqual(response);

    expect(label).toBeTruthy();
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(utils.requestWithAutoLogin).not.toHaveBeenCalled();
  });

  test('create-report run creates a report and saves generated schema', async () => {
    utils.httpPost
      .mockResolvedValueOnce({ success: true, content: { formUuid: 'REPORT_1' } })
      .mockResolvedValueOnce({ success: true });
    utils.httpGet
      .mockResolvedValueOnce({ success: true, content: { gmtModified: 100 } })
      .mockImplementationOnce(async () => {
        const saveBody = querystring.parse(utils.httpPost.mock.calls[1][2]);
        const { id: serverOwnedId, ...persisted } = JSON.parse(saveBody.content);
        expect(serverOwnedId).toBe('REPORT_1');
        return {
          success: true,
          content: { ...persisted, gmtModified: 101 },
        };
      });

    const result = await createReport.run(['APP_XXX', '销售报表', JSON.stringify(chartConfig)]);

    expect(result).toMatchObject({
      success: true,
      reportId: 'REPORT_1',
      reportTitle: '销售报表',
      appType: 'APP_XXX',
      chartCount: 1,
      readbackVerified: true,
      runtimeQueryVerified: true,
      verificationLevel: 'strict-schema-content',
      omitted: expect.any(Array),
      url: 'https://demo.aliwork.com/APP_XXX/workbench/REPORT_1',
      workbenchUrl: 'https://demo.aliwork.com/APP_XXX/workbench/REPORT_1',
    });
    const saveBody = querystring.parse(utils.httpPost.mock.calls[1][2]);
    expect(JSON.parse(saveBody.content)).toMatchObject({
      id: 'REPORT_1',
      pages: expect.any(Array),
    });
    expect(saveBody.gmtModified).toBe('100');
    expect(saveBody.domainCode).toBe('tEXDRG');
    expect(utils.httpGet.mock.calls[0][2]).toMatchObject({
      formUuid: 'REPORT_1',
      schemaVersion: 'V5',
      domainCode: 'tEXDRG',
    });
    expect(JSON.parse(logSpy.mock.calls[0][0])).toEqual(result);
    expect(warn.mock.calls.flat().join(' ')).toContain('敏感标识已隐藏');
    expect(warn.mock.calls.flat().join(' ')).not.toContain('corp-1');
  });

  test('create-report repairs a metadata field mismatch on the same report before success', async () => {
    utils.httpPost
      .mockResolvedValueOnce({ success: true, content: { formUuid: 'REPORT_REPAIR' } })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true });
    utils.httpGet
      .mockResolvedValueOnce({ success: true, content: { gmtModified: 100 } })
      .mockImplementationOnce(async () => {
        const saveBody = querystring.parse(utils.httpPost.mock.calls[1][2]);
        return { success: true, content: { ...JSON.parse(saveBody.content), gmtModified: 101 } };
      })
      .mockImplementationOnce(async () => {
        const saveBody = querystring.parse(utils.httpPost.mock.calls[2][2]);
        return { success: true, content: { ...JSON.parse(saveBody.content), gmtModified: 102 } };
      });
    probeReportSchema
      .mockResolvedValueOnce({
        success: false,
        runtimeQueryVerified: false,
        probes: [{
          cid: 'cid_status',
          className: 'YoushuPieChart',
          dataSetKey: 'chartData',
          fields: [{ fieldCode: 'selectField_status_value' }],
          status: 'QUERY_FAILED',
          success: false,
          errorCode: 'REPORT_METADATA_FIELD_NOT_FOUND',
          errorMsg: 'metadata missing',
        }],
      })
      .mockResolvedValueOnce({
        success: true,
        runtimeQueryVerified: true,
        probes: [{
          cid: 'cid_status',
          className: 'YoushuPieChart',
          dataSetKey: 'chartData',
          fields: [{ fieldCode: 'selectField_status' }],
          status: 'QUERY_OK',
          success: true,
        }],
      });
    repairMetadataFieldCodes.mockImplementation(schema => ({
      schema,
      changed: 1,
      replacements: [{ cid: 'cid_status', from: 'selectField_status_value', to: 'selectField_status' }],
    }));

    const result = await createReport.run(['APP_XXX', '状态报表', JSON.stringify(chartConfig)]);

    expect(result).toMatchObject({
      success: true,
      reportId: 'REPORT_REPAIR',
      runtimeQueryVerified: true,
      runtimeRepair: { attempted: true, changed: 1 },
    });
    expect(createBlankReport).toBeDefined();
    expect(utils.httpPost.mock.calls.filter(call => call[1].includes('saveFormSchemaInfo'))).toHaveLength(1);
    expect(probeReportSchema).toHaveBeenCalledTimes(2);
  });

  test('create-report returns one owned residual when runtime query still fails', async () => {
    utils.httpPost
      .mockResolvedValueOnce({ success: true, content: { formUuid: 'REPORT_RUNTIME_FAIL' } })
      .mockResolvedValueOnce({ success: true });
    utils.httpGet
      .mockResolvedValueOnce({ success: true, content: { gmtModified: 100 } })
      .mockImplementationOnce(async () => {
        const saveBody = querystring.parse(utils.httpPost.mock.calls[1][2]);
        return { success: true, content: { ...JSON.parse(saveBody.content), gmtModified: 101 } };
      });
    probeReportSchema.mockResolvedValueOnce({
      success: false,
      runtimeQueryVerified: false,
      probes: [{
        cid: 'cid_status',
        className: 'YoushuPieChart',
        dataSetKey: 'chartData',
        fields: [{ fieldCode: 'selectField_status_value' }],
        status: 'QUERY_FAILED',
        success: false,
        errorCode: 'REPORT_METADATA_FIELD_NOT_FOUND',
        errorMsg: 'metadata missing',
      }],
    });

    await expect(createReport.run([
      'APP_XXX',
      '状态报表',
      JSON.stringify(chartConfig),
    ])).rejects.toMatchObject({
      code: 'REPORT_RUNTIME_QUERY_FAILED',
      details: {
        partial: true,
        retrySafe: false,
        residual: { reportId: 'REPORT_RUNTIME_FAIL', owned: true },
        failedCharts: [expect.objectContaining({ cid: 'cid_status' })],
      },
    });
    expect(utils.httpPost.mock.calls.filter(call => call[1].includes('saveFormSchemaInfo'))).toHaveLength(1);
  });

  test('create-report accepts readback after platform strips client-only filter metadata', async () => {
    const config = {
      charts: chartConfig,
      filters: [{
        title: '状态',
        cubeCode: 'FORM_SALES',
        valueField: { fieldCode: 'selectField_status', aliasName: '状态', dataType: 'STRING' },
        labelField: { fieldCode: 'selectField_status', aliasName: '状态', dataType: 'STRING' },
        filterFieldCode: 'selectField_status',
        linkTo: [0],
      }],
    };
    utils.httpPost
      .mockResolvedValueOnce({ success: true, content: { formUuid: 'REPORT_FILTER' } })
      .mockResolvedValueOnce({ success: true });
    utils.httpGet
      .mockResolvedValueOnce({ success: true, content: { gmtModified: 100 } })
      .mockImplementationOnce(async () => {
        const saveBody = querystring.parse(utils.httpPost.mock.calls[1][2]);
        const { id, ...persisted } = JSON.parse(saveBody.content);
        expect(id).toBe('REPORT_FILTER');
        expect(JSON.stringify(persisted)).not.toContain('__filterMeta__');
        return { success: true, content: { ...persisted, gmtModified: 101 } };
      });

    await expect(createReport.run([
      'APP_XXX',
      '筛选器报表',
      JSON.stringify(config),
    ])).resolves.toMatchObject({
      success: true,
      reportId: 'REPORT_FILTER',
      readbackVerified: true,
    });
  });

  test('create-report fails closed when the single create write returns no report identity', async () => {
    utils.httpPost.mockResolvedValueOnce({ success: true, content: {} });

    await expect(createReport.run([
      'APP_XXX',
      '销售报表',
      JSON.stringify(chartConfig),
    ])).rejects.toMatchObject({
      code: 'CREATE_REPORT_IDENTITY_MISSING',
      details: {
        partial: true,
        residual: {
          type: 'report',
          appType: 'APP_XXX',
          reportId: null,
          owned: 'unknown',
          deleteAttempted: false,
        },
      },
    });

    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(utils.httpGet).not.toHaveBeenCalled();
    expect(utils.requestWithAutoLogin).not.toHaveBeenCalled();
  });

  test('create-report rejects an invalid timeGranularityType before remote writes', async () => {
    const invalidConfig = [{
      ...chartConfig[0],
      xField: {
        fieldCode: 'dateField_hireDate',
        aliasName: '入职日期',
        dataType: 'DATE',
        timeGranularityType: 'DECADE',
      },
    }];

    await expect(createReport.run([
      'APP_XXX',
      '入职报表',
      JSON.stringify(invalidConfig),
    ])).rejects.toMatchObject({
      code: 'CREATE_REPORT_CHART_CONFIG_INVALID',
    });

    expect(utils.httpPost).not.toHaveBeenCalled();
    expect(utils.httpGet).not.toHaveBeenCalled();
  });

  test('create-report rejects source fields that do not exist before creating a blank report', async () => {
    const invalidConfig = [{
      type: 'bar',
      title: '错误计数',
      cubeCode: 'FORM_SALES',
      xField: 'textField_name',
      yField: 'count',
    }];

    await expect(createReport.run([
      'APP_XXX',
      '错误字段报表',
      JSON.stringify(invalidConfig),
    ])).rejects.toMatchObject({
      code: 'CREATE_REPORT_SOURCE_FIELD_NOT_FOUND',
      details: {
        formUuid: 'FORM-SALES',
        missingFields: ['count'],
        remoteWrites: 0,
      },
    });

    expect(getFormSchema).toHaveBeenCalledTimes(1);
    expect(utils.httpPost).not.toHaveBeenCalled();
  });

  test('source preflight preserves the built-in pid COUNT measure without fetching schema', async () => {
    const configured = createReport.collectConfiguredFieldCodes([{
      type: 'indicator',
      cubeCode: 'FORM_SALES',
      kpi: { fieldCode: 'pid', aggregateType: 'COUNT' },
    }], []);

    expect(configured.has('FORM_SALES')).toBe(false);
    await createReport.preflightReportSourceFields({}, 'APP_XXX', [{
      type: 'indicator',
      cubeCode: 'FORM_SALES',
      kpi: { fieldCode: 'pid', aggregateType: 'COUNT' },
    }], []);
    expect(getFormSchema).not.toHaveBeenCalled();
  });

  test('create-report never prints an inline chart config containing organization metadata', async () => {
    const sensitiveMarker = 'tenant-secret-marker';
    const config = JSON.stringify({
      charts: [],
      filters: [{ cubeCode: 'FORM_SALES', cubeTenantId: sensitiveMarker }],
    });

    await expect(createReport.run(['APP_XXX', '安全日志报表', config])).rejects.toBeTruthy();

    expect(warn.mock.calls.flat().join(' ')).not.toContain(sensitiveMarker);
    expect(utils.httpPost).not.toHaveBeenCalled();
  });

  test.each([
    { ...chartConfig[0], type: 'radar' },
    { ...chartConfig[0], type: undefined },
    { ...chartConfig[0], type: 'combo', xField: undefined, yField: undefined, leftYFields: chartConfig[0].yField },
  ])('create-report fails closed on unsupported or incomplete capability before remote writes', async (invalidChart) => {
    await expect(createReport.run([
      'APP_XXX',
      '无效报表',
      JSON.stringify([invalidChart]),
    ])).rejects.toMatchObject({
      code: 'CREATE_REPORT_CHART_CONFIG_INVALID',
    });

    expect(utils.httpPost).not.toHaveBeenCalled();
    expect(utils.httpGet).not.toHaveBeenCalled();
  });

  test('create-report validates explicit filter link/cube/field consistency before remote writes', async () => {
    const invalidConfig = {
      charts: chartConfig,
      filters: [{
        title: '状态',
        cubeCode: 'FORM_OTHER',
        valueField: { fieldCode: 'selectField_status' },
        filterFieldCode: 'selectField_other',
        linkTo: ['missing chart'],
      }],
    };

    await expect(createReport.run([
      'APP_XXX',
      '无效筛选报表',
      JSON.stringify(invalidConfig),
    ])).rejects.toMatchObject({
      code: 'CREATE_REPORT_CHART_CONFIG_INVALID',
      details: {
        issues: expect.arrayContaining([
          expect.objectContaining({ code: 'REPORT_FILTER_LINK_TARGET_INVALID' }),
          expect.objectContaining({ code: 'REPORT_FILTER_FIELD_MISMATCH' }),
        ]),
      },
    });

    expect(utils.httpPost).not.toHaveBeenCalled();
    expect(utils.httpGet).not.toHaveBeenCalled();
  });

  test('create-report exposes a structured owned residual when post-create save fails', async () => {
    utils.httpPost
      .mockResolvedValueOnce({ success: true, content: { formUuid: 'REPORT_PARTIAL' } })
      .mockResolvedValueOnce({ success: false, errorCode: 'SAVE_FAILED', errorMsg: 'save failed' });
    utils.httpGet.mockResolvedValueOnce({ success: true, content: { gmtModified: 100 } });

    await expect(createReport.run([
      'APP_XXX',
      '部分创建报表',
      JSON.stringify(chartConfig),
    ])).rejects.toMatchObject({
      code: 'CREATE_REPORT_SAVE_FAILED',
      details: {
        partial: true,
        residual: {
          type: 'report',
          appType: 'APP_XXX',
          reportId: 'REPORT_PARTIAL',
          url: 'https://demo.aliwork.com/APP_XXX/workbench/REPORT_PARTIAL',
          workbenchUrl: 'https://demo.aliwork.com/APP_XXX/workbench/REPORT_PARTIAL',
          owned: true,
          ownershipStatus: 'owned_created_by_current_invocation',
          provenance: {
            operation: 'create-report',
            source: 'create_response',
            identityConfirmed: true,
          },
          deleteAttempted: false,
        },
      },
    });
  });

  test('create-report readback mismatch exposes the created report provenance', async () => {
    utils.httpPost
      .mockResolvedValueOnce({ success: true, content: { formUuid: 'REPORT_PARTIAL' } })
      .mockResolvedValueOnce({ success: true });
    utils.httpGet
      .mockResolvedValueOnce({ success: true, content: { gmtModified: 100 } })
      .mockImplementationOnce(async () => {
        const saveBody = querystring.parse(utils.httpPost.mock.calls[1][2]);
        const { id, ...persisted } = JSON.parse(saveBody.content);
        expect(id).toBe('REPORT_PARTIAL');
        persisted.pages[0].componentsTree[0].componentName = 'ChangedByServer';
        return { success: true, content: { ...persisted, gmtModified: 101 } };
      });

    await expect(createReport.run([
      'APP_XXX',
      '部分创建报表',
      JSON.stringify(chartConfig),
    ])).rejects.toMatchObject({
      code: 'REPORT_SCHEMA_READBACK_MISMATCH',
      details: {
        partial: true,
        residual: {
          type: 'report',
          appType: 'APP_XXX',
          reportId: 'REPORT_PARTIAL',
          url: 'https://demo.aliwork.com/APP_XXX/workbench/REPORT_PARTIAL',
          workbenchUrl: 'https://demo.aliwork.com/APP_XXX/workbench/REPORT_PARTIAL',
          owned: true,
          ownershipStatus: 'owned_created_by_current_invocation',
          provenance: {
            operation: 'create-report',
            source: 'create_response',
            identityConfirmed: true,
          },
          state: 'created_partial',
        },
        mismatch: {
          path: '$.pages[0].componentsTree[0].componentName',
          kind: 'value_mismatch',
        },
        retryable: false,
        retrySafe: false,
        sideEffectState: 'partial',
        readbackAllowed: true,
        recommendedRecovery: 'inspect_then_stop',
        url: 'https://demo.aliwork.com/APP_XXX/workbench/REPORT_PARTIAL',
        workbenchUrl: 'https://demo.aliwork.com/APP_XXX/workbench/REPORT_PARTIAL',
        nextAction: {
          type: 'report.inspect',
          commandId: 'report.inspect',
          args: {
            appType: 'APP_XXX',
            reportId: 'REPORT_PARTIAL',
          },
        },
      },
    });

    const createCalls = utils.httpPost.mock.calls.filter((call) => (
      call[1] === '/dingtalk/web/APP_XXX/query/formdesign/saveFormSchemaInfo.json'
    ));
    expect(createCalls).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith('报表创建成功，ID: REPORT_PARTIAL');
  });

  test('append-chart run fetches existing schema and saves appended chart', async () => {
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: makeReportSchema(),
    });
    utils.httpPost.mockResolvedValueOnce({ success: true });
    utils.httpGet.mockImplementationOnce(async () => {
      const saveBody = querystring.parse(utils.httpPost.mock.calls[0][2]);
      return {
        success: true,
        content: { ...JSON.parse(saveBody.content), gmtModified: 101 },
      };
    });

    const result = await appendReport.run(['APP_XXX', 'REPORT_1', JSON.stringify(chartConfig)]);

    expect(result).toMatchObject({
      success: true,
      reportId: 'REPORT_1',
      appType: 'APP_XXX',
      appendedChartCount: 1,
      readbackVerified: true,
      verificationLevel: 'strict-schema-content',
      omitted: expect.any(Array),
      url: 'https://demo.aliwork.com/APP_XXX/workbench/REPORT_1',
      workbenchUrl: 'https://demo.aliwork.com/APP_XXX/workbench/REPORT_1',
    });
    expect(utils.httpGet.mock.calls[0][1]).toBe('/alibaba/web/APP_XXX/_view/query/formdesign/getFormSchema.json');
    const saveBody = querystring.parse(utils.httpPost.mock.calls[0][2]);
    expect(saveBody.gmtModified).toBe('100');
    const savedSchema = JSON.parse(saveBody.content);
    const rootContent = savedSchema.pages[0].componentsTree[0].children[0];
    expect(rootContent.children).toHaveLength(1);
    expect(rootContent.props.layout).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith('报表 ID: REPORT_1');
    expect(warn).toHaveBeenCalledWith('追加图表数: 1');
  });

  test('append-chart fails closed when the report schema readback differs', async () => {
    utils.httpGet
      .mockResolvedValueOnce({
        success: true,
        content: makeReportSchema(),
      })
      .mockResolvedValueOnce({
        success: true,
        content: { ...makeReportSchema(), gmtModified: 101 },
      });
    utils.httpPost.mockResolvedValueOnce({ success: true });

    await expect(appendReport.run([
      'APP_XXX',
      'REPORT_1',
      JSON.stringify(chartConfig),
    ])).rejects.toMatchObject({
      code: 'REPORT_SCHEMA_READBACK_MISMATCH',
      details: {
        retryable: false,
        retrySafe: false,
        sideEffectState: 'partial',
        readbackAllowed: true,
        recommendedRecovery: 'inspect_then_stop',
        nextAction: {
          type: 'report.inspect',
          commandId: 'report.inspect',
          args: { appType: 'APP_XXX', reportId: 'REPORT_1' },
        },
      },
    });

    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(utils.httpGet).toHaveBeenCalledTimes(2);
  });

  test('append-chart retries a proven revision conflict once using the latest revision and the owned mutation only', async () => {
    utils.httpGet
      .mockResolvedValueOnce({ success: true, content: makeReportSchema() })
      .mockResolvedValueOnce({ success: true, content: { ...makeReportSchema(), gmtModified: 101 } })
      .mockImplementationOnce(async () => {
        const saveBody = querystring.parse(utils.httpPost.mock.calls[1][2]);
        return {
          success: true,
          content: { ...JSON.parse(saveBody.content), gmtModified: 102 },
        };
      });
    utils.httpPost
      .mockResolvedValueOnce({ success: false, errorCode: '500', errorMsg: STALE_SCHEMA_MESSAGE })
      .mockResolvedValueOnce({ success: true });

    const result = await appendReport.run(['APP_XXX', 'REPORT_1', JSON.stringify(chartConfig)]);

    expect(result).toMatchObject({
      success: true,
      recovery: {
        attempted: true,
        reason: 'revision_conflict',
        ownedMutationReapplied: true,
        latestRevision: 101,
      },
    });
    expect(utils.httpPost).toHaveBeenCalledTimes(2);
    expect(querystring.parse(utils.httpPost.mock.calls[1][2]).gmtModified).toBe('101');
  });

  test('append-chart does not replay an ordinary or unknown save failure', async () => {
    utils.httpGet.mockResolvedValueOnce({ success: true, content: makeReportSchema() });
    utils.httpPost.mockResolvedValueOnce({ success: false, errorCode: 'FAILED', errorMsg: 'unknown state' });

    await expect(appendReport.run([
      'APP_XXX',
      'REPORT_1',
      JSON.stringify(chartConfig),
    ])).rejects.toMatchObject({
      code: 'APPEND_CHART_SAVE_FAILED',
      details: {
        recovery: {
          attempted: false,
          reason: 'save_state_not_proven_safe_to_replay',
        },
      },
    });

    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(utils.httpGet).toHaveBeenCalledTimes(1);
  });

  test('usage errors reject as CliError instead of exiting', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit should not be called');
    });

    try {
      await expect(createReport.run([])).rejects.toMatchObject({
        isCliError: true,
        code: 'CREATE_REPORT_INVALID_ARGUMENTS',
      });
      await expect(appendReport.run([])).rejects.toMatchObject({
        isCliError: true,
        code: 'APPEND_CHART_INVALID_ARGUMENTS',
      });
      expect(exitSpy).not.toHaveBeenCalled();
    } finally {
      exitSpy.mockRestore();
    }
  });
});
