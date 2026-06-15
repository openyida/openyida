'use strict';

jest.mock('../lib/core/utils', () => ({
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  requestWithAutoLogin: jest.fn((fn, authRef) => fn(authRef)),
}));

const { httpGet } = require('../lib/core/utils');
const { createYidaClient } = require('../lib/core/yida-client');
const { getFormSchema, listFormLogicflows, listLogicflowLogs } = require('../lib/integration/integration-api');

jest.mock('../lib/core/yida-client', () => ({
  createYidaClient: jest.fn(),
}));

describe('integration api', () => {
  beforeEach(() => {
    httpGet.mockReset();
    createYidaClient.mockReset();
    createYidaClient.mockReturnValue({
      get: jest.fn(async (path, query, options) => {
        const auth = {
          baseUrl: 'https://example.com',
          csrfToken: 'csrf-token',
          cookies: [],
        };
        const resolvedQuery = typeof query === 'function' ? query(auth) : query;
        return httpGet(auth.baseUrl, path, resolvedQuery, auth.cookies, options);
      }),
    });
  });

  test('listLogicflowLogs sends the frontend status filter for exception logs', async () => {
    httpGet.mockResolvedValue({
      success: true,
      content: {
        currentPage: 1,
        data: [{ procInstId: 'PROC-1', status: 2, exceptionEntity: 'failed' }],
        totalCount: 1,
      },
    });

    const result = await listLogicflowLogs({
      baseUrl: 'https://example.com',
      csrfToken: 'csrf-token',
      cookies: [],
    }, {
      appType: 'APP_TEST',
      processCode: 'LPROC-TEST',
      status: 2,
      pageIndex: 1,
      pageSize: 10,
    });

    expect(result.totalCount).toBe(1);
    expect(httpGet).toHaveBeenCalledTimes(1);
    const [, path, query,, options] = httpGet.mock.calls[0];
    expect(path).toBe('/alibaba/web/APP_TEST/query/formLogicflowBinding/listLog.json');
    expect(query).toMatchObject({
      _api: 'Connector.listLog',
      processCode: 'LPROC-TEST',
      status: '2',
      dateType: 'modifyTime',
    });
    expect(options).toEqual({ silentStatus: true });
  });

  test('listFormLogicflows uses the form binding endpoint for grouped load-more flows', async () => {
    httpGet.mockResolvedValue({
      success: true,
      content: {
        currentPage: 1,
        data: [{ name: 'flow', processCode: 'LPROC-A' }],
        totalCount: 1,
      },
    });

    await listFormLogicflows({
      baseUrl: 'https://example.com',
      csrfToken: 'csrf-token',
      cookies: [],
    }, {
      appType: 'APP_TEST',
      formUuid: 'FORM_TEST',
      type: '1',
    });

    const [, path, query,, options] = httpGet.mock.calls[0];
    expect(path).toBe('/alibaba/web/APP_TEST/query/formLogicflowBinding/listflow.json');
    expect(query).toMatchObject({
      _api: 'Connector.getTriggerList',
      formUuid: 'FORM_TEST',
    });
    expect(options).toEqual({ silentStatus: true });
  });

  test('getFormSchema extracts nested field components from V5 containers only', async () => {
    const mockGet = jest.fn().mockResolvedValue({
      success: true,
      content: JSON.stringify({
        pages: [
          {
            componentsTree: [
              {
                componentName: 'Page',
                children: [
                  {
                    componentName: 'RootContent',
                    children: [
                      {
                        componentName: 'FormContainer',
                        props: {
                          fieldId: 'formContainer_wrapper',
                        },
                        children: [
                          {
                            componentName: 'TextField',
                            props: {
                              fieldId: 'textField_name',
                              label: { zh_CN: '名称' },
                            },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    });
    createYidaClient.mockReturnValue({ get: mockGet });

    const fields = await getFormSchema({
      baseUrl: 'https://example.com',
      csrfToken: 'csrf-token',
      cookies: [],
    }, {
      appType: 'APP_TEST',
      formUuid: 'FORM_TARGET',
    });

    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({
      componentName: 'TextField',
      props: { fieldId: 'textField_name' },
    });
  });
});
