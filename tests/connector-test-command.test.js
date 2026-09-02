'use strict';

const {
  buildTestParams,
  parseArgs,
  resolveOwnedConnection,
} = require('../lib/connector/connector-test');

const operation = {
  operationId: 'echoOwned',
  method: 'post',
  inputs: [
    { name: 'Path', paramLocation: 'path', childList: [{ name: 'id', paramLocation: 'path' }] },
    { name: 'Query', paramLocation: 'query', childList: [{ name: 'trace', paramLocation: 'query' }] },
    { name: 'Headers', paramLocation: 'header', childList: [{ name: 'X-E2E', paramLocation: 'header' }] },
    { name: 'Body', paramLocation: 'body', childList: [{ name: 'message', paramLocation: 'body' }] },
  ],
  parameters: {
    path: [{ name: 'id', value: '' }],
    query: [{ name: 'trace', value: '' }],
    header: [{ name: 'X-E2E', value: '' }],
    body: { default: '{"message":"default"}' },
  },
};

describe('connector test command parameter contract', () => {
  test('parses explicit per-location JSON flags', () => {
    expect(parseArgs([
      '--connector-id', '101',
      '--action', 'echoOwned',
      '--path-json', '{"id":"42"}',
      '--query-json', '{"trace":"q"}',
      '--header-json', '{"X-E2E":"h"}',
      '--body-json', '{"message":"b"}',
      '--account-id', '7',
    ])).toMatchObject({
      connectorId: '101',
      actionId: 'echoOwned',
      pathJson: '{"id":"42"}',
      queryJson: '{"trace":"q"}',
      headerJson: '{"X-E2E":"h"}',
      bodyJson: '{"message":"b"}',
      accountId: '7',
    });
  });

  test('keeps flat params compatible but dispatches only by action schema', () => {
    expect(buildTestParams(operation, {
      params: '{"id":"42","trace":"q","X-E2E":"h","message":"b"}',
    })).toEqual({
      path: { id: '42' },
      query: { trace: 'q' },
      header: { 'X-E2E': 'h' },
      body: { message: 'b' },
    });
  });

  test('structured values override defaults without crossing locations', () => {
    expect(buildTestParams(operation, {
      pathJson: '{"id":"42"}',
      queryJson: '{"trace":"q"}',
      headerJson: '{"X-E2E":"h"}',
      bodyJson: '{"message":"b"}',
    })).toEqual({
      path: { id: '42' },
      query: { trace: 'q' },
      header: { 'X-E2E': 'h' },
      body: { message: 'b' },
    });
  });

  test('flat params fail closed for unknown or ambiguous schema fields', () => {
    expect(() => buildTestParams(operation, { params: '{"unknown":1}' }))
      .toThrow(expect.objectContaining({ code: 'CONNECTOR_TEST_PARAM_UNKNOWN' }));
    expect(() => buildTestParams({
      ...operation,
      inputs: [
        { name: 'Query', paramLocation: 'query', childList: [{ name: 'shared' }] },
        { name: 'Body', paramLocation: 'body', childList: [{ name: 'shared' }] },
      ],
    }, { params: '{"shared":1}' }))
      .toThrow(expect.objectContaining({ code: 'CONNECTOR_TEST_PARAM_AMBIGUOUS' }));
  });

  test('requires an owned account whenever auth is configured', () => {
    const accounts = [{ id: 7, connectorName: 'Http_owned' }];
    expect(() => resolveOwnedConnection({
      requiresAuth: true,
      accountId: null,
      accounts: [],
      connectorName: 'Http_owned',
    })).toThrow(expect.objectContaining({ code: 'CONNECTOR_AUTH_ACCOUNT_REQUIRED' }));
    expect(() => resolveOwnedConnection({
      requiresAuth: true,
      accountId: '8',
      accounts,
      connectorName: 'Http_owned',
    })).toThrow(expect.objectContaining({ code: 'CONNECTOR_AUTH_ACCOUNT_NOT_OWNED' }));
    expect(resolveOwnedConnection({
      requiresAuth: true,
      accountId: '7',
      accounts,
      connectorName: 'Http_owned',
    })).toMatchObject({ id: 7 });
  });
});
