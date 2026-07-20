'use strict';

const mockGet = jest.fn();
const mockGetOnce = jest.fn();
const mockPostForm = jest.fn();
const mockPostFormOnce = jest.fn();

jest.mock('../lib/core/yida-client', () => ({
  createYidaClient: jest.fn(() => ({
    get: mockGet,
    getOnce: mockGetOnce,
    postForm: mockPostForm,
    postFormOnce: mockPostFormOnce,
  })),
}));

const {
  convertFormToProcess,
  getProcessCodeFromAppParam,
  getProcessCodeFromFormBinding,
  readFormMode,
  switchFormType,
} = require('../lib/app/services/form-mode-service');

beforeEach(() => {
  mockGet.mockReset();
  mockGetOnce.mockReset();
  mockPostForm.mockReset();
  mockPostFormOnce.mockReset();
});

describe('shared form mode service', () => {
  test('reads process mode from the exact form binding endpoint', async () => {
    let query;
    mockGet.mockImplementationOnce(async (requestPath, queryBuilder) => {
      expect(requestPath).toBe('/APP_TEST/query/formProcBinding/getBindingByFormUuid.json');
      query = queryBuilder({ csrfToken: 'csrf-refreshed' });
      return {
        success: true,
        content: {
          appType: 'APP_TEST',
          content: '',
          formUuid: '',
          procCode: 'TPROC_TEST',
          procId: '',
          systemType: 'default_system',
        },
      };
    });

    await expect(readFormMode({ authRef: {} }, {
      appType: 'APP_TEST',
      formUuid: 'FORM_TEST',
    })).resolves.toEqual({
      mode: 'process',
      processCode: 'TPROC_TEST',
    });
    expect(query).toMatchObject({
      _csrf_token: 'csrf-refreshed',
      _api: 'nattyFetch',
      _mock: 'false',
      formUuid: 'FORM_TEST',
    });
    expect(query).not.toHaveProperty('pageIndex');
    expect(query).not.toHaveProperty('pageSize');
  });

  test('treats an explicit empty procCode string as receipt mode', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      content: {
        appType: 'APP_TEST',
        procCode: '',
      },
    });

    await expect(readFormMode({}, {
      appType: 'APP_TEST',
      formUuid: 'FORM_TEST',
    })).resolves.toEqual({ mode: 'receipt' });
  });

  test('treats successful empty content as receipt mode', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      content: {},
    });

    await expect(readFormMode({}, {
      appType: 'APP_TEST',
      formUuid: 'FORM_TEST',
    })).resolves.toEqual({ mode: 'receipt' });
  });

  test.each([
    { systemType: 'default_system' },
    { appType: 'APP_TEST', systemType: 'default_system' },
    { appType: 'APP_TEST', formUuid: 'FORM_TEST', systemType: 'default_system' },
  ])('treats successful content without procCode as receipt when identity matches %#', async content => {
    mockGet.mockResolvedValueOnce({
      success: true,
      content,
    });

    await expect(readFormMode({}, {
      appType: 'APP_TEST',
      formUuid: 'FORM_TEST',
    })).resolves.toEqual({ mode: 'receipt' });
  });

  test.each([
    { success: false, errorCode: '500' },
    { success: true, content: null },
    { success: true, content: 'invalid' },
    { success: true, content: [] },
    { success: true, content: { procCode: null } },
    { success: false, content: {} },
    { success: true, content: { appType: 'APP_OTHER' } },
    { success: true, content: { appType: 'APP_TEST', formUuid: 'FORM_OTHER' } },
    { success: true, content: { appType: 'APP_OTHER', procCode: 'TPROC_TEST' } },
    { success: true, content: { appType: 'APP_TEST', formUuid: 'FORM_OTHER', procCode: 'TPROC_TEST' } },
  ])('returns a stable read failure for invalid binding responses', async result => {
    mockGet.mockResolvedValueOnce(result);

    await expect(readFormMode({}, {
      appType: 'APP_TEST',
      formUuid: 'FORM_TEST',
    })).rejects.toMatchObject({
      code: 'FORM_MODE_READ_FAILED',
      details: { operation: 'FormProcBinding.getBindingByFormUuid' },
    });
  });

  test('keeps the legacy helper alias and processCode null semantics', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      content: { appType: 'APP_TEST', procCode: 'TPROC_TEST' },
    });
    await expect(getProcessCodeFromFormBinding({}, 'APP_TEST', 'FORM_TEST')).resolves.toBe('TPROC_TEST');

    mockGet.mockResolvedValueOnce({ success: false, errorCode: '500' });
    await expect(getProcessCodeFromAppParam({}, 'APP_TEST', 'FORM_TEST')).resolves.toBeNull();
  });

  test('shares switchFormType while strict conversion validates success', async () => {
    let body;
    mockPostForm.mockImplementationOnce(async (requestPath, bodyBuilder) => {
      expect(requestPath).toContain('/APP_TEST/query/formdesign/switchFormType.json');
      body = bodyBuilder({ csrfToken: 'csrf-refreshed' });
      return { success: true, content: {} };
    });
    await expect(convertFormToProcess({ authRef: {} }, {
      appType: 'APP_TEST',
      formUuid: 'FORM_TEST',
    })).resolves.toEqual({ success: true, content: {} });
    expect(body).toMatchObject({
      _csrf_token: 'csrf-refreshed',
      formUuid: 'FORM_TEST',
      toFormType: 'process',
    });

    mockPostForm.mockResolvedValueOnce({ success: false, errorCode: '500' });
    await expect(convertFormToProcess({}, {
      appType: 'APP_TEST',
      formUuid: 'FORM_TEST',
    })).rejects.toMatchObject({
      code: 'FORM_MODE_CONVERSION_FAILED',
      details: { operation: 'Nav.transformForm' },
    });

    mockPostForm.mockResolvedValueOnce({ success: true });
    await expect(switchFormType({}, 'APP_TEST', 'FORM_TEST')).resolves.toEqual({ success: true });
  });

  test('apply conversion uses one-shot transport and never falls back to auto-login postForm', async () => {
    mockPostFormOnce.mockResolvedValueOnce({ __csrfExpired: true });

    await expect(convertFormToProcess({
      authRef: {
        baseUrl: 'https://example.test',
        csrfToken: 'csrf',
        cookies: [],
      },
      assertRemoteDispatchBoundary() {},
    }, {
      appType: 'APP_TEST',
      formUuid: 'FORM_TEST',
    })).rejects.toMatchObject({ code: 'FORM_MODE_CONVERSION_FAILED' });

    expect(mockPostFormOnce).toHaveBeenCalledTimes(1);
    expect(mockPostForm).not.toHaveBeenCalled();
  });

  test('apply mode read uses one-shot GET without auto-login replay', async () => {
    mockGetOnce.mockResolvedValueOnce({
      success: true,
      content: { appType: 'APP_TEST', procCode: 'TPROC_TEST' },
    });

    await expect(readFormMode({
      authRef: {},
      assertRemoteDispatchBoundary() {},
    }, {
      appType: 'APP_TEST',
      formUuid: 'FORM_TEST',
    })).resolves.toEqual({ mode: 'process', processCode: 'TPROC_TEST' });

    expect(mockGetOnce).toHaveBeenCalledTimes(1);
    expect(mockGet).not.toHaveBeenCalled();
  });
});
