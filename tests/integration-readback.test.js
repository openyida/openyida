'use strict';

jest.mock('../lib/integration/integration-check', () => ({
  listAllLogicflows: jest.fn(),
}));
jest.mock('../lib/integration/integration-api', () => ({
  getLogicflowDetail: jest.fn(),
}));

const { listAllLogicflows } = require('../lib/integration/integration-check');
const { getLogicflowDetail } = require('../lib/integration/integration-api');
const { projectAddDataAssignments, verifyLogicflowFinalState } = require('../lib/integration/integration-readback');
const { setLanguage } = require('../lib/core/i18n');

describe('integration control-plane readback', () => {
  beforeEach(() => {
    setLanguage('zh');
    jest.clearAllMocks();
    listAllLogicflows.mockResolvedValue([
      { formUuid: 'FORM-A', processCode: 'LPROC-TARGET', status: 'y', name: 'target' },
      { formUuid: 'FORM-A', processCode: 'LPROC-OTHER', status: 'n', name: 'other' },
    ]);
    getLogicflowDetail.mockResolvedValue({
      success: true,
      content: { schema: { componentName: 'CanvasEngine', children: [] }, globalSetting: {} },
    });
  });

  test('requires an exact processCode/formUuid list match and a non-empty detail readback', async () => {
    await expect(verifyLogicflowFinalState({}, {
      appType: 'APP-A',
      formUuid: 'FORM-A',
      processCode: 'LPROC-TARGET',
      expectedStatus: 'y',
    })).resolves.toEqual(expect.objectContaining({
      verificationLevel: 'PLATFORM_LIST_EXACT_DETAIL_PRESENT',
      processCode: 'LPROC-TARGET',
      status: 'y',
      exactMatchCount: 1,
      detailReadback: true,
      detailProvenance: 'SUCCESS_CONTENT_WRAPPER',
    }));

    expect(listAllLogicflows).toHaveBeenCalledWith({}, 'APP-A', expect.objectContaining({
      formUuid: 'FORM-A',
    }));
    expect(getLogicflowDetail).toHaveBeenCalledWith({}, {
      appType: 'APP-A', formUuid: 'FORM-A', processCode: 'LPROC-TARGET',
    });
  });

  test.each([
    ['missing exact list row', [], 'INTEGRATION_READBACK_EXACT_MATCH_FAILED'],
    ['duplicate exact list rows', [
      { formUuid: 'FORM-A', processCode: 'LPROC-TARGET', status: 'y' },
      { formUuid: 'FORM-A', processCode: 'LPROC-TARGET', status: 'y' },
    ], 'INTEGRATION_READBACK_EXACT_MATCH_FAILED'],
    ['wrong final status', [
      { formUuid: 'FORM-A', processCode: 'LPROC-TARGET', status: 'n' },
    ], 'INTEGRATION_READBACK_STATUS_MISMATCH'],
  ])('fails closed for %s', async (_label, rows, code) => {
    listAllLogicflows.mockResolvedValue(rows);
    await expect(verifyLogicflowFinalState({}, {
      appType: 'APP-A', formUuid: 'FORM-A', processCode: 'LPROC-TARGET', expectedStatus: 'y',
    })).rejects.toMatchObject({ code });
  });

  test.each([null, '', {}, { success: true }, { success: false, content: { schema: {} } }, { success: true, content: null }])(
    'fails closed when detail cannot prove the target exists: %p',
    async (detail) => {
      getLogicflowDetail.mockResolvedValue(detail);
      await expect(verifyLogicflowFinalState({}, {
        appType: 'APP-A', formUuid: 'FORM-A', processCode: 'LPROC-TARGET', expectedStatus: 'y',
      })).rejects.toMatchObject({ code: 'INTEGRATION_READBACK_DETAIL_UNVERIFIED' });
    }
  );

  test.each([
    [{ processCode: 'LPROC-OTHER', formUuid: 'FORM-A', schema: {} }, 'processCode'],
    [{ processCode: 'LPROC-TARGET', formUuid: 'FORM-OTHER', schema: {} }, 'formUuid'],
  ])('rejects non-empty detail whose projected %s conflicts with the exact list target', async (content, field) => {
    setLanguage('ja');
    getLogicflowDetail.mockResolvedValue({ success: true, content });
    await expect(verifyLogicflowFinalState({}, {
      appType: 'APP-A', formUuid: 'FORM-A', processCode: 'LPROC-TARGET', expectedStatus: 'y',
    })).rejects.toMatchObject({
      code: 'INTEGRATION_READBACK_DETAIL_IDENTITY_MISMATCH',
      message: `ロジックフロー詳細の識別情報が対象と一致しません：${field}`,
      details: expect.objectContaining({ field }),
    });
  });

  test('requires exact AddData assignment readback when the caller supplies an expected projection', async () => {
    const expected = [{
      nodeId: 'add-1',
      assignments: [{ column: 'textField_name', valueType: 'literal', value: 'Ada' }],
    }];
    getLogicflowDetail.mockResolvedValue({
      success: true,
      content: {
        schema: {
          componentName: 'CanvasEngine',
          children: [{
            componentName: 'AddDataNode',
            id: 'add-1',
            props: { addDataRules: { assignments: [] } },
          }],
        },
      },
    });

    await expect(verifyLogicflowFinalState({}, {
      appType: 'APP-A',
      formUuid: 'FORM-A',
      processCode: 'LPROC-TARGET',
      expectedStatus: 'y',
      expectedAddDataAssignments: expected,
    })).rejects.toMatchObject({ code: 'INTEGRATION_READBACK_ASSIGNMENTS_MISMATCH' });

    getLogicflowDetail.mockResolvedValue({
      success: true,
      content: {
        schema: {
          componentName: 'CanvasEngine',
          children: [{
            componentName: 'AddDataNode',
            id: 'add-1',
            props: { addDataRules: { assignments: expected[0].assignments } },
          }],
        },
      },
    });
    await expect(verifyLogicflowFinalState({}, {
      appType: 'APP-A',
      formUuid: 'FORM-A',
      processCode: 'LPROC-TARGET',
      expectedStatus: 'y',
      expectedAddDataAssignments: expected,
    })).resolves.toMatchObject({ addDataAssignmentProjection: 'EXACT' });
  });

  test('projects nested route AddData nodes by stable node id', () => {
    expect(projectAddDataAssignments({ schema: { children: [{
      componentName: 'ConditionContainer',
      children: [{
        componentName: 'AddDataNode',
        id: 'add-2',
        props: { addDataRules: { assignments: [{ name: 'textField_code', valueType: 'literal', value: '0012' }] } },
      }],
    }] } })).toEqual([{ nodeId: 'add-2', assignments: [{
      column: 'textField_code', valueType: 'literal', value: '0012',
    }] }]);
  });
});
