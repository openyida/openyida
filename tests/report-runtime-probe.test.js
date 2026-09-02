'use strict';

const querystring = require('querystring');

jest.mock('../lib/core/utils', () => ({
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  requestWithAutoLogin: jest.fn((requestFn, authRef) => requestFn(authRef)),
}));

const utils = require('../lib/core/utils');
const {
  buildReportProbeTargets,
  probeReportSchema,
  repairMetadataFieldCodes,
} = require('../lib/report/runtime-probe');

const authRef = {
  baseUrl: 'https://demo.aliwork.com',
  authMode: 'token',
  authSource: 'token',
  authData: { auth_mode: 'token', auth_source: 'token' },
};

function reportSchema(fieldCode = 'selectField_status_value') {
  return {
    id: 'REPORT_1',
    gmtModified: 101,
    config: { prdId: 'PRD_1' },
    pages: [{
      componentsTree: [{
        componentName: 'Page',
        children: [{
          componentName: 'RootContent',
          children: [{
            componentName: 'YoushuPieChart',
            id: 'cid_status',
            props: {
              cid: 'cid_status',
              title: '状态分布',
              dataSetModelMap: {
                chartData: {
                  xField: {
                    cubeCode: 'FORM_CONTRACT',
                    fieldCode,
                    aggregateType: 'NONE',
                  },
                },
              },
            },
          }],
        }],
      }],
    }],
  };
}

describe('report runtime query probe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('extracts real component bindings and sends a read-only runtime query', async () => {
    utils.httpPost.mockResolvedValue({ success: true, content: { data: [] } });

    const targets = buildReportProbeTargets(reportSchema(), { reportId: 'REPORT_1' });
    expect(targets).toEqual([expect.objectContaining({
      reportId: 'REPORT_1',
      prdId: 'PRD_1',
      cid: 'cid_status',
      className: 'YoushuPieChart',
      dataSetKey: 'chartData',
      fields: [expect.objectContaining({ fieldCode: 'selectField_status_value' })],
    })]);

    await expect(probeReportSchema(authRef, 'APP_1', 'REPORT_1', reportSchema()))
      .resolves.toMatchObject({ runtimeQueryVerified: true });
    const [baseUrl, requestPath, body] = utils.httpPost.mock.calls[0];
    expect(baseUrl).toBe('https://demo.aliwork.com');
    expect(requestPath).toContain('/APP_1/visual/visualizationDataRpc/getDataAsync.json');
    expect(querystring.parse(body)).toMatchObject({
      prdId: 'PRD_1',
      pageId: 'REPORT_1',
      cid: 'cid_status',
      componentClassName: 'YoushuPieChart',
      dataSetKey: 'chartData',
      enabledCache: 'false',
    });
  });

  test('classifies metadata errors and narrowly repairs only the failed component', async () => {
    utils.httpPost.mockResolvedValue({
      success: false,
      errorMsg: '元数据没有找到 cubeCode: FORM_CONTRACT, fieldCode: selectField_status_value',
    });
    const probe = await probeReportSchema(authRef, 'APP_1', 'REPORT_1', reportSchema());

    expect(probe).toMatchObject({
      runtimeQueryVerified: false,
      probes: [expect.objectContaining({ errorCode: 'REPORT_METADATA_FIELD_NOT_FOUND' })],
    });
    const repair = repairMetadataFieldCodes(reportSchema(), probe.probes);
    expect(repair).toMatchObject({
      changed: 1,
      replacements: [{
        cid: 'cid_status',
        from: 'selectField_status_value',
        to: 'selectField_status',
      }],
    });
    expect(JSON.stringify(repair.schema)).toContain('selectField_status');
    expect(JSON.stringify(repair.schema)).not.toContain('selectField_status_value');
  });

  test('resolves missing prdId from the current report navigation topicId', async () => {
    const schema = reportSchema();
    delete schema.config.prdId;
    utils.httpGet.mockResolvedValue({
      success: true,
      content: [{ formUuid: 'REPORT_1', topicId: 'TOPIC_1' }],
    });
    utils.httpPost.mockResolvedValue({ success: true, content: { data: [] } });

    const result = await probeReportSchema(authRef, 'APP_1', 'REPORT_1', schema);

    expect(result).toMatchObject({
      runtimeQueryVerified: true,
      probes: [expect.objectContaining({ prdId: 'TOPIC_1' })],
    });
    expect(utils.httpGet).toHaveBeenCalledTimes(1);
    expect(utils.httpGet.mock.calls[0][1]).toContain('getFormNavigationListByOrder.json');
  });

  test('does not rewrite non-metadata failures', () => {
    const repair = repairMetadataFieldCodes(reportSchema(), [{
      cid: 'cid_status',
      errorCode: 'REPORT_RATE_LIMITED',
      fields: [{ fieldCode: 'selectField_status_value' }],
    }]);
    expect(repair.changed).toBe(0);
    expect(JSON.stringify(repair.schema)).toContain('selectField_status_value');
  });

  test.each([
    ['selectField_status_value', 'selectField_status'],
    ['radioField_status_value', 'radioField_status'],
    ['checkboxField_tags_value', 'checkboxField_tags'],
    ['employeeField_owner_value', 'employeeField_owner'],
  ])('repairs the supported runtime metadata candidate %s', (from, to) => {
    const repair = repairMetadataFieldCodes(reportSchema(from), [{
      cid: 'cid_status',
      errorCode: 'REPORT_METADATA_FIELD_NOT_FOUND',
      fields: [{ fieldCode: from }],
    }]);
    expect(repair).toMatchObject({ changed: 1, replacements: [{ cid: 'cid_status', from, to }] });
  });
});
