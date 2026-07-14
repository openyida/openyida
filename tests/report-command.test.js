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
  csrfToken: 'csrf-token',
  baseUrl: 'https://demo.aliwork.com',
  authMode: 'token',
  authSource: 'token',
  corpId: 'corp-1',
  userId: 'user-1',
  authData: {
    csrf_token: 'csrf-token',
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
      csrf_token: authRef.csrfToken,
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
    await saveReportSchema(authRef, 'APP_XXX', 'REPORT_1', { pages: [] });

    expect(utils.httpPost.mock.calls[0][1]).toBe('/dingtalk/web/APP_XXX/query/formdesign/saveFormSchemaInfo.json');
    expect(querystring.parse(utils.httpPost.mock.calls[0][2])).toMatchObject({
      _csrf_token: 'csrf-token',
      formType: 'report',
    });
    expect(utils.httpPost.mock.calls[1][1]).toBe('/dingtalk/web/APP_XXX/_view/query/formdesign/saveFormSchema.json');
    expect(querystring.parse(utils.httpPost.mock.calls[1][2])).toMatchObject({
      _csrf_token: 'csrf-token',
      formUuid: 'REPORT_1',
      schemaVersion: 'V5',
      importSchema: 'true',
    });
  });

  test('create-report run creates a report and saves generated schema', async () => {
    utils.httpPost
      .mockResolvedValueOnce({ success: true, content: { formUuid: 'REPORT_1' } })
      .mockResolvedValueOnce({ success: true });

    const result = await createReport.run(['APP_XXX', '销售报表', JSON.stringify(chartConfig)]);

    expect(result).toMatchObject({
      success: true,
      reportId: 'REPORT_1',
      reportTitle: '销售报表',
      appType: 'APP_XXX',
      chartCount: 1,
      url: 'https://demo.aliwork.com/APP_XXX/workbench/REPORT_1',
    });
    const saveBody = querystring.parse(utils.httpPost.mock.calls[1][2]);
    expect(JSON.parse(saveBody.content)).toMatchObject({
      id: 'REPORT_1',
      pages: expect.any(Array),
    });
    expect(JSON.parse(logSpy.mock.calls[0][0])).toEqual(result);
  });

  test('append-chart run fetches existing schema and saves appended chart', async () => {
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: makeReportSchema(),
    });
    utils.httpPost.mockResolvedValueOnce({ success: true });

    const result = await appendReport.run(['APP_XXX', 'REPORT_1', JSON.stringify(chartConfig)]);

    expect(result).toMatchObject({
      success: true,
      reportId: 'REPORT_1',
      appType: 'APP_XXX',
      appendedChartCount: 1,
      url: 'https://demo.aliwork.com/APP_XXX/workbench/REPORT_1',
    });
    expect(utils.httpGet.mock.calls[0][1]).toBe('/alibaba/web/APP_XXX/_view/query/formdesign/getFormSchema.json');
    const saveBody = querystring.parse(utils.httpPost.mock.calls[0][2]);
    const savedSchema = JSON.parse(saveBody.content);
    const rootContent = savedSchema.pages[0].componentsTree[0].children[0];
    expect(rootContent.children).toHaveLength(1);
    expect(rootContent.props.layout).toHaveLength(1);
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
