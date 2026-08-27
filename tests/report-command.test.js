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

const utils = require('../lib/core/utils');
const { createBlankReport, saveReportSchema } = require('../lib/report/http');
const createReport = require('../lib/report/index');
const appendReport = require('../lib/report/append');

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
    utils.loadAuthData.mockReturnValue({
      base_url: authRef.baseUrl,
      auth_mode: 'token',
      auth_source: 'token',
      corp_id: 'corp-1',
      user_id: 'user-1',
    });
    utils.requestWithAutoLogin.mockImplementation((requestFn, ref) => requestFn(ref));
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
        return {
          success: true,
          content: { ...JSON.parse(saveBody.content), gmtModified: 101 },
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
      url: 'https://demo.aliwork.com/APP_XXX/workbench/REPORT_1',
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
  });

  test('create-report fails closed when the single create write returns no report identity', async () => {
    utils.httpPost.mockResolvedValueOnce({ success: true, content: {} });

    await expect(createReport.run([
      'APP_XXX',
      '销售报表',
      JSON.stringify(chartConfig),
    ])).rejects.toMatchObject({
      code: 'CREATE_REPORT_IDENTITY_MISSING',
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
      url: 'https://demo.aliwork.com/APP_XXX/workbench/REPORT_1',
    });
    expect(utils.httpGet.mock.calls[0][1]).toBe('/alibaba/web/APP_XXX/_view/query/formdesign/getFormSchema.json');
    const saveBody = querystring.parse(utils.httpPost.mock.calls[0][2]);
    expect(saveBody.gmtModified).toBe('100');
    const savedSchema = JSON.parse(saveBody.content);
    const rootContent = savedSchema.pages[0].componentsTree[0].children[0];
    expect(rootContent.children).toHaveLength(1);
    expect(rootContent.props.layout).toHaveLength(1);
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
    });

    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(utils.httpGet).toHaveBeenCalledTimes(2);
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
