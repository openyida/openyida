'use strict';

const {
  assertActionUpdateReadback,
  buildConnectorSaveParams,
  createActionSnapshot,
  mergeAddedOperations,
  patchActionQuery,
  updateConnectorAction,
} = require('../lib/connector/connector-action-update');
const { parseArgs, parseQueryPatch, run } = require('../lib/connector/connector-update-action');

function queryNode(name, value) {
  return {
    name,
    paramType: 'String',
    paramLocation: 'query',
    queryDefaultValue: { paramType: 'fixedValue', defaultValue: value },
    childList: [],
    children: [],
  };
}

function operation(operationId, overrides = {}) {
  const values = {
    _api: 'nattyFetch',
    _mock: 'false',
    userLanguage: 'zh_CN',
    pageSize: '1',
    currentPage: '2',
    type: 'yida_helper_base',
    searchFieldJson: '{"radioField_lbarqa36":"y"}',
    _stamp: '1000',
  };
  return {
    id: `operation-${operationId}`,
    operationId,
    summary: operationId,
    description: operationId,
    url: 'query/loginFreeFormData/listFormDataByType.json',
    method: 'get',
    inputs: [{
      name: 'Query',
      paramType: 'Object',
      paramLocation: 'query',
      childList: Object.entries(values).map(([name, value]) => queryNode(name, value)),
    }],
    parameters: {
      header: [{ name: 'Referer', value: 'https://www.aliwork.com/' }],
      query: Object.entries(values).map(([name, value]) => ({ name, value })),
    },
    responses: { type: 'object', properties: {} },
    outputs: [{ name: 'Response', paramType: 'Object', defaultValue: '{}', childList: [] }],
    origin: true,
    ...overrides,
  };
}

function detail(overrides = {}) {
  return {
    id: 101,
    operations: JSON.stringify([operation('fixtureSearch'), operation('untouched')]),
    displayName: 'Owned update regression',
    iconUrl: 'chaxun%%#FFA200',
    connectorDesc: 'stable description',
    host: 'www.aliwork.com',
    baseUrl: '/',
    scheme: 'https',
    tongxunluTemplateId: '',
    faasTemplateId: '0',
    securitySchemes: '{}',
    connectorMode: '5',
    connectorName: 'Http_owned_update',
    category: 'http',
    ...overrides,
  };
}

describe('connector action query-only update contract', () => {
  test('changes exactly one declared query value and its mirrored input default', () => {
    const before = createActionSnapshot(detail());
    const expected = patchActionQuery(before, 'fixtureSearch', { currentPage: '1' });

    const target = expected.operations[0];
    expect(target.parameters.query.find(item => item.name === 'currentPage').value).toBe('1');
    expect(target.inputs[0].childList.find(item => item.name === 'currentPage').queryDefaultValue.defaultValue).toBe('1');
    expect(expected.operations[1]).toEqual(before.operations[1]);
    expect(expected.connectorFingerprint).toBe(before.connectorFingerprint);

    expect(assertActionUpdateReadback(before, expected.operations, {
      ...detail(), operations: JSON.stringify(expected.operations),
    })).toMatchObject({ verified: true, changedOperationId: 'fixtureSearch' });
  });

  test.each([
    ['missing patch', {}],
    ['empty value', { currentPage: '' }],
    ['unknown field', { unknown: '1' }],
    ['missing value', { currentPage: undefined }],
  ])('fails closed for %s', (label, patch) => {
    expect(label).toBeTruthy();
    expect(() => patchActionQuery(createActionSnapshot(detail()), 'fixtureSearch', patch))
      .toThrow(expect.objectContaining({ code: expect.stringMatching(/^CONNECTOR_ACTION_/) }));
  });

  test('fails closed for incomplete platform detail and duplicate operationId', () => {
    expect(() => createActionSnapshot(detail({ operations: undefined })))
      .toThrow(expect.objectContaining({ code: 'CONNECTOR_ACTION_PREFLIGHT_INCOMPLETE' }));
    expect(() => createActionSnapshot(detail({ host: undefined })))
      .toThrow(expect.objectContaining({ code: 'CONNECTOR_ACTION_PREFLIGHT_INCOMPLETE' }));
    expect(() => createActionSnapshot(detail({
      operations: JSON.stringify([operation('duplicate'), operation('duplicate')]),
    }))).toThrow(expect.objectContaining({ code: 'CONNECTOR_OPERATION_ID_DUPLICATE' }));
  });

  test('readback rejects action loss, non-target mutation, connector mutation, and unstable IDs', () => {
    const before = createActionSnapshot(detail());
    const expected = patchActionQuery(before, 'fixtureSearch', { pageSize: '2' });
    const cases = [
      { ...detail(), operations: JSON.stringify([expected.operations[0]]) },
      { ...detail(), operations: JSON.stringify([expected.operations[0], { ...expected.operations[1], method: 'post' }]) },
      { ...detail(), host: 'different.invalid', operations: JSON.stringify(expected.operations) },
      { ...detail(), operations: JSON.stringify([{ ...expected.operations[0], id: 'changed' }, expected.operations[1]]) },
    ];
    for (const actual of cases) {
      expect(() => assertActionUpdateReadback(before, expected.operations, actual))
        .toThrow(expect.objectContaining({ code: 'CONNECTOR_ACTION_READBACK_MISMATCH' }));
    }
  });

  test('builds replace-all save params only from a complete preflight snapshot', () => {
    const before = createActionSnapshot(detail());
    const params = buildConnectorSaveParams(before, before.operations);
    expect(JSON.parse(params.operations)).toEqual(before.operations);
    expect(params).toMatchObject({
      id: '101',
      host: 'www.aliwork.com',
      baseUrl: '/',
      securitySchemes: '{}',
      connectorName: 'Http_owned_update',
    });
  });

  test('add-action appends without normalizing existing actions and rejects any stable ID conflict', () => {
    const before = createActionSnapshot(detail());
    const added = operation('newAction');
    expect(mergeAddedOperations(before, [added])).toEqual([...before.operations, added]);
    expect(() => mergeAddedOperations(before, [operation('fixtureSearch')]))
      .toThrow(expect.objectContaining({ code: 'CONNECTOR_ACTION_ID_CONFLICT' }));
    expect(() => mergeAddedOperations(before, [{ ...operation('different'), id: 'operation-fixtureSearch' }]))
      .toThrow(expect.objectContaining({ code: 'CONNECTOR_ACTION_ID_CONFLICT' }));
  });

  test('performs one non-idempotent write and marks an exception as outcome unknown', async () => {
    const calls = [];
    const sourceDetail = detail();
    const deps = {
      getAuthRef: () => ({ baseUrl: 'https://www.aliwork.com', authMode: 'token' }),
      findConnectorById: async () => ({ id: 101, connectorName: sourceDetail.connectorName }),
      getConnectorDetail: async () => sourceDetail,
      saveConnector: async () => {
        calls.push('save');
        throw new Error('socket closed after request');
      },
    };

    await expect(updateConnectorAction({
      connectorId: '101', operationId: 'fixtureSearch', queryPatch: { currentPage: '1' },
    }, deps)).rejects.toMatchObject({
      code: 'CONNECTOR_ACTION_WRITE_OUTCOME_UNKNOWN',
      writeAttempted: true,
      outcome: 'outcome_unknown',
    });
    expect(calls).toEqual(['save']);
  });

  test('rejects an all-no-op patch before the non-idempotent write', async () => {
    const sourceDetail = detail();
    const saveConnector = jest.fn();
    await expect(updateConnectorAction({
      connectorId: '101', operationId: 'fixtureSearch', queryPatch: { currentPage: '2' },
    }, {
      getAuthRef: () => ({ baseUrl: 'https://www.aliwork.com', authMode: 'token' }),
      findConnectorById: async () => ({ id: 101, connectorName: sourceDetail.connectorName }),
      getConnectorDetail: async () => sourceDetail,
      saveConnector,
    })).rejects.toMatchObject({ code: 'CONNECTOR_ACTION_NO_CHANGES' });
    expect(saveConnector).not.toHaveBeenCalled();
  });

  test('allows a mixed patch when at least one value changes and preserves all non-target state', async () => {
    const sourceDetail = detail();
    const saveConnector = jest.fn(async params => ({
      detail: { ...sourceDetail, operations: params.operations },
    }));
    const result = await updateConnectorAction({
      connectorId: '101',
      operationId: 'fixtureSearch',
      queryPatch: { currentPage: '2', pageSize: '2' },
    }, {
      getAuthRef: () => ({ baseUrl: 'https://www.aliwork.com', authMode: 'token' }),
      findConnectorById: async () => ({ id: 101, connectorName: sourceDetail.connectorName }),
      getConnectorDetail: async () => sourceDetail,
      saveConnector,
    });

    expect(saveConnector).toHaveBeenCalledTimes(1);
    const saved = JSON.parse(saveConnector.mock.calls[0][0].operations);
    expect(saved[0].parameters.query.find(item => item.name === 'currentPage').value).toBe('2');
    expect(saved[0].parameters.query.find(item => item.name === 'pageSize').value).toBe('2');
    expect(saved[1]).toEqual(JSON.parse(sourceDetail.operations)[1]);
    expect(result.changedQuery).toEqual({ currentPage: '2', pageSize: '2' });
  });

  test('does not write when preflight or query validation fails', async () => {
    const saveConnector = jest.fn();
    const baseDeps = {
      getAuthRef: () => ({ baseUrl: 'https://www.aliwork.com', authMode: 'token' }),
      findConnectorById: async () => ({ id: 101, connectorName: 'Http_owned_update' }),
      saveConnector,
    };
    await expect(updateConnectorAction({
      connectorId: '101', operationId: 'fixtureSearch', queryPatch: { unknown: '1' },
    }, { ...baseDeps, getConnectorDetail: async () => detail() }))
      .rejects.toMatchObject({ code: 'CONNECTOR_ACTION_QUERY_UNKNOWN' });
    await expect(updateConnectorAction({
      connectorId: '101', operationId: 'fixtureSearch', queryPatch: { currentPage: '1' },
    }, { ...baseDeps, getConnectorDetail: async () => detail({ host: undefined }) }))
      .rejects.toMatchObject({ code: 'CONNECTOR_ACTION_PREFLIGHT_INCOMPLETE' });
    await expect(updateConnectorAction({
      connectorId: '101', operationId: 'duplicate', queryPatch: { currentPage: '1' },
    }, {
      ...baseDeps,
      getConnectorDetail: async () => detail({
        operations: JSON.stringify([operation('duplicate'), operation('duplicate')]),
      }),
    })).rejects.toMatchObject({ code: 'CONNECTOR_OPERATION_ID_DUPLICATE' });
    expect(saveConnector).not.toHaveBeenCalled();
  });
});

describe('connector update-action command', () => {
  let logSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  test('parses only the explicit query-only command surface', () => {
    expect(parseArgs([
      '--connector-id', '101', '--action', 'fixtureSearch',
      '--query-json', '{"currentPage":"1"}', '--confirm', '--json',
    ])).toMatchObject({
      connectorId: '101', operationId: 'fixtureSearch', confirm: true, json: true,
    });
    expect(parseQueryPatch('{"currentPage":"1"}')).toEqual({ currentPage: '1' });
    expect(() => parseArgs(['--connector-id', '101', '--unknown', 'x']))
      .toThrow(expect.objectContaining({ code: 'CONNECTOR_UPDATE_ACTION_INVALID_ARGUMENTS' }));
    expect(() => parseQueryPatch('[]'))
      .toThrow(expect.objectContaining({ code: 'CONNECTOR_UPDATE_ACTION_QUERY_JSON_INVALID' }));
  });

  test('updates once and emits only verified canonical evidence', async () => {
    const sourceDetail = detail();
    const saveConnector = jest.fn(async params => ({
      detail: { ...sourceDetail, operations: params.operations },
      readbackVerified: true,
    }));
    const result = await run([
      '--connector-id', '101', '--action', 'fixtureSearch',
      '--query-json', '{"currentPage":"1"}', '--confirm', '--json',
    ], {
      getAuthRef: () => ({ baseUrl: 'https://www.aliwork.com', authMode: 'token' }),
      findConnectorById: async () => ({ id: 101, connectorName: sourceDetail.connectorName }),
      getConnectorDetail: async () => sourceDetail,
      saveConnector,
    });

    expect(saveConnector).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      success: true,
      connectorId: '101',
      operationId: 'fixtureSearch',
      changedQuery: { currentPage: '1' },
      readbackVerified: true,
      actionCount: 2,
    });
    expect(result.beforeFingerprint).toBe(result.afterFingerprint);
  });

  test.each([
    ['missing confirm', ['--connector-id', '101', '--action', 'fixtureSearch', '--query-json', '{"currentPage":"1"}']],
    ['missing query', ['--connector-id', '101', '--action', 'fixtureSearch', '--confirm']],
    ['empty query', ['--connector-id', '101', '--action', 'fixtureSearch', '--query-json', '{}', '--confirm']],
  ])('%s fails before resolving dependencies', async (label, args) => {
    expect(label).toBeTruthy();
    const getAuthRef = jest.fn();
    await expect(run(args, { getAuthRef })).rejects.toMatchObject({
      code: expect.stringMatching(/^CONNECTOR_UPDATE_ACTION_/),
    });
    expect(getAuthRef).not.toHaveBeenCalled();
  });
});
