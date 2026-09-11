'use strict';

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://demo.aliwork.com'),
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  requestWithAutoLogin: jest.fn((requestFn, authRef) => requestFn(authRef)),
  detectActiveTool: jest.fn(() => null),
}));

const utils = require('../lib/core/utils');
const { run, summarizeReportSchema } = require('../lib/report/inspect');

function schemaFixture() {
  return {
    id: 'REPORT_1',
    gmtModified: 42,
    config: { prdId: 'PRD_1' },
    pages: [{
      id: 'PAGE_1',
      componentsTree: [{
        componentName: 'Page',
        children: [{
          componentName: 'RootContent',
          props: {
            layout: [{ i: 'field_1', x: 0, y: 0, w: 3, h: 22, moved: false, static: false }],
          },
          children: [{
            componentName: 'YoushuGroupedBarChart',
            id: 'node_1',
            props: {
              cid: 'cid_1',
              fieldId: 'field_1',
              dataSetModelMap: {
                chartData: {
                  dataViewQueryModel: {
                    cubeCode: 'FORM_1',
                    filterList: [{ filterKey: 'filter-1' }],
                  },
                  filterList: [{ filterKey: 'filter-1' }],
                },
              },
            },
          }],
        }],
      }],
    }],
  };
}

describe('report inspect', () => {
  let logSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    utils.loadAuthData.mockReturnValue({
      base_url: 'https://demo.aliwork.com',
      auth_mode: 'token',
      auth_source: 'token',
      corp_id: 'corp-1',
    });
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => logSpy.mockRestore());

  test('summarizes revision and stable runtime binding identifiers', () => {
    expect(summarizeReportSchema(schemaFixture(), {
      appType: 'APP_1',
      reportId: 'REPORT_1',
      baseUrl: 'https://demo.aliwork.com/',
    })).toEqual({
      success: true,
      operation: 'report.inspect',
      appType: 'APP_1',
      reportId: 'REPORT_1',
      url: 'https://demo.aliwork.com/APP_1/workbench/REPORT_1',
      workbenchUrl: 'https://demo.aliwork.com/APP_1/workbench/REPORT_1',
      schemaVersion: 'V5',
      domainCode: 'tEXDRG',
      revision: 42,
      prdId: 'PRD_1',
      pageId: 'PAGE_1',
      componentCount: 1,
      components: [{
        componentName: 'YoushuGroupedBarChart',
        cid: 'cid_1',
        fieldId: 'field_1',
        dataSetKeys: ['chartData'],
        filterKeys: ['filter-1'],
        cubeCodes: ['FORM_1'],
        fields: [],
      }],
      layout: [{ i: 'field_1', x: 0, y: 0, w: 3, h: 22, moved: false, static: false }],
    });
  });

  test('runs a V5+tEXDRG read-only fetch and emits parseable JSON', async () => {
    utils.httpGet.mockResolvedValue({ success: true, content: schemaFixture() });
    utils.httpPost.mockResolvedValue({ success: true, content: { data: [] } });

    const result = await run(['APP_1', 'REPORT_1', '--json']);

    expect(result).toMatchObject({
      operation: 'report.inspect',
      revision: 42,
      url: 'https://demo.aliwork.com/APP_1/workbench/REPORT_1',
      workbenchUrl: 'https://demo.aliwork.com/APP_1/workbench/REPORT_1',
      runtimeQueryVerified: true,
      components: [expect.objectContaining({
        cid: 'cid_1',
        queryProbe: { status: 'QUERY_OK', success: true, errorCode: null, errorMsg: null },
      })],
    });
    expect(utils.httpGet).toHaveBeenCalledTimes(1);
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(utils.httpGet.mock.calls[0][2]).toMatchObject({
      formUuid: 'REPORT_1',
      schemaVersion: 'V5',
      domainCode: 'tEXDRG',
    });
    expect(JSON.parse(logSpy.mock.calls[0][0])).toEqual(result);
  });
});
