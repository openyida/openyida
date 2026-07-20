'use strict';

const mockGet = jest.fn();
const mockGetOnce = jest.fn();

jest.mock('../lib/core/yida-client', () => ({
  createYidaClient: jest.fn(() => ({
    get: mockGet,
    getOnce: mockGetOnce,
  })),
}));

const {
  compileProcessDefinition,
} = require('../lib/process/services/process-compiler');
const {
  projectProcessManaged,
  readProcessDefinition,
} = require('../lib/process/services/process-reader');
const { normalizeManifest } = require('../lib/schema/normalize-manifest');

const desired = {
  form: 'form:request',
  nodes: [
    {
      key: 'managerApproval',
      type: 'approval',
      name: '主管审批',
      approver: 'originator',
    },
    {
      key: 'financeApproval',
      type: 'approval',
      name: '财务审批',
      approver: 'originator',
    },
  ],
};

function completeReadBindings(overrides) {
  return Object.assign({
    appType: 'APP_TEST',
    formUuid: 'FORM_TEST',
    processCode: 'TPROC_TEST',
    processId: 'PROCESS_TEST',
    processVersion: 3,
  }, overrides || {});
}

describe('shared process compiler', () => {
  test('reuses existing semantic node bindings and rejects duplicate keys', () => {
    const compiled = compileProcessDefinition(desired, {
      appType: 'APP_TEST',
      baseUrl: 'https://example.test',
      formUuid: 'FORM_TEST',
      processCode: 'TPROC_TEST',
      existingBindings: {
        managerApproval: { nodeId: 'node-existing-manager' },
      },
    });

    expect(compiled.nodeBindings.managerApproval).toEqual({
      nodeId: 'node-existing-manager',
      componentName: 'ApprovalNode',
    });
    expect(compiled.nodeBindings.financeApproval.nodeId).toEqual(expect.any(String));
    expect(compiled.viewJson.schema.children).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'node-existing-manager', componentName: 'ApprovalNode' }),
    ]));

    expect(() => compileProcessDefinition({
      form: 'form:request',
      nodes: [
        { key: 'same', type: 'approval', name: '一', approver: 'originator' },
        { key: 'same', type: 'approval', name: '二', approver: 'originator' },
      ],
    }, {})).toThrow(expect.objectContaining({
      code: 'PROCESS_COMPILE_NODE_KEY_DUPLICATE',
    }));
  });

  test('requires explicit semantic node keys in managed mode', () => {
    expect(() => compileProcessDefinition({
      form: 'form:request',
      nodes: [{ type: 'approval', name: '审批', approver: 'originator' }],
    }, {})).toThrow(expect.objectContaining({
      code: 'PROCESS_COMPILE_NODE_KEY_REQUIRED',
    }));
  });

  test('rejects duplicate existing node identities without exposing the real nodeId', () => {
    const privateNodeId = 'node-private-real-id';
    let caught;
    try {
      compileProcessDefinition(desired, {
        existingBindings: {
          managerApproval: { nodeId: privateNodeId },
          financeApproval: { nodeId: privateNodeId },
        },
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({
      code: 'PROCESS_COMPILE_NODE_BINDING_CONFLICT',
      details: { semanticPath: 'nodes.financeApproval' },
    });
    expect(JSON.stringify({
      code: caught.code,
      message: caught.message,
      details: caught.details,
    })).not.toContain(privateNodeId);
  });

  test('uses a null-prototype binding dictionary and rejects unsafe keys at the compiler boundary', () => {
    const compiled = compileProcessDefinition({
      form: 'form:request',
      nodes: [
        { key: 'constructor', type: 'approval', name: '审批', approver: 'originator' },
      ],
    }, {});

    expect(Object.getPrototypeOf(compiled.nodeBindings)).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(compiled.nodeBindings, 'constructor')).toBe(true);
    expect(() => compileProcessDefinition({
      form: 'form:request',
      nodes: [
        { key: '__proto__', type: 'approval', name: '审批', approver: 'originator' },
      ],
    }, {})).toThrow(expect.objectContaining({
      code: 'PROCESS_COMPILE_DEFINITION_INVALID',
      details: { semanticPath: 'nodes' },
    }));
  });
});

describe('process observed reader', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGetOnce.mockReset();
  });

  test('closes normalized desired through compile, read, and managed projection', async () => {
    const normalized = normalizeManifest({
      kind: 'openyida_app_manifest',
      schemaVersion: 1,
      app: { key: 'workflowApp', name: '流程应用' },
      forms: {
        request: {
          title: '流程申请',
          mode: 'process',
          fields: {
            requester: { type: 'TextField', label: '申请人' },
          },
        },
      },
      processes: {
        approval: {
          form: 'request',
          nodes: desired.nodes,
        },
      },
    });
    const normalizedDesired = normalized.normalized.resources.find(resource => (
      resource.resourceType === 'process' && resource.key === 'approval'
    )).desired;
    expect(normalizedDesired).toEqual(desired);

    const compiled = compileProcessDefinition(normalizedDesired, {
      appType: 'APP_TEST',
      baseUrl: 'https://example.test',
      formUuid: 'FORM_TEST',
      processCode: 'TPROC_TEST',
    });
    let capturedQuery;
    mockGet.mockImplementationOnce(async (requestPath, queryBuilder) => {
      expect(requestPath).toBe('/alibaba/web/APP_TEST/query/simpleProcess/getProcessById.json');
      capturedQuery = queryBuilder({ csrfToken: 'csrf-refreshed' });
      return {
        success: true,
        content: JSON.stringify(compiled.viewJson),
      };
    });

    const readResult = await readProcessDefinition({ authRef: {} }, {
      appType: 'APP_TEST',
      formUuid: 'FORM_TEST',
      processCode: 'TPROC_TEST',
      processId: 'PROCESS_TEST',
      processVersion: 3,
    });
    const observed = projectProcessManaged(readResult, {
      desired: normalizedDesired,
      formUuid: 'FORM_TEST',
      nodeBindings: compiled.nodeBindings,
    });

    expect(capturedQuery).toMatchObject({
      _api: 'SimpleProcess.getProcessById',
      _csrf_token: 'csrf-refreshed',
      formUuid: 'FORM_TEST',
      processCode: 'TPROC_TEST',
      processId: 'PROCESS_TEST',
      processVersion: 3,
    });
    expect(observed).toEqual(normalizedDesired);
  });

  test.each([
    { success: false, errorCode: '500', errorMsg: 'private failure' },
    { success: false, errorCode: 'UNKNOWN' },
  ])('does not interpret failed responses as resource missing', async result => {
    mockGet.mockResolvedValueOnce(result);

    await expect(readProcessDefinition({}, completeReadBindings({
      processVersion: 0,
    }))).rejects.toMatchObject({
      code: 'PROCESS_READ_FAILED',
      details: { operation: 'SimpleProcess.getProcessById' },
    });
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  test('apply reads the exact process definition once without auto-login replay', async () => {
    mockGetOnce.mockResolvedValueOnce({ success: false, errorCode: '500' });

    await expect(readProcessDefinition({
      authRef: {},
      assertRemoteDispatchBoundary() {},
    }, completeReadBindings())).rejects.toMatchObject({ code: 'PROCESS_READ_FAILED' });

    expect(mockGetOnce).toHaveBeenCalledTimes(1);
    expect(mockGet).not.toHaveBeenCalled();
  });

  test.each([null, '', 'not-json'])('rejects empty or malformed process content', async content => {
    mockGet.mockResolvedValueOnce({ success: true, content });

    await expect(readProcessDefinition({}, completeReadBindings())).rejects.toMatchObject({
      code: 'PROCESS_READ_CONTENT_INVALID',
    });
  });

  test.each([
    ['appType', undefined],
    ['formUuid', ''],
    ['processCode', '   '],
    ['processId', null],
    ['processVersion', ''],
    ['processVersion', null],
    ['processVersion', undefined],
  ])('rejects invalid %s before issuing a remote request', async (property, invalidValue) => {
    const bindings = completeReadBindings({ [property]: invalidValue });
    let caught;
    try {
      await readProcessDefinition({}, bindings);
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({
      code: 'PROCESS_READ_BINDING_INVALID',
      details: {
        operation: 'SimpleProcess.getProcessById',
        property,
      },
    });
    expect(JSON.stringify({
      code: caught.code,
      message: caught.message,
      details: caught.details,
    })).not.toContain('FORM_TEST');
    expect(mockGet).not.toHaveBeenCalled();
  });

  test('requires and verifies the bound formUuid during managed projection', () => {
    const compiled = compileProcessDefinition(desired, {
      appType: 'APP_TEST',
      baseUrl: 'https://example.test',
      formUuid: 'FORM_TEST',
      processCode: 'TPROC_TEST',
    });
    const options = {
      desired,
      nodeBindings: compiled.nodeBindings,
    };

    expect(() => projectProcessManaged({ definition: compiled.viewJson }, options)).toThrow(expect.objectContaining({
      code: 'PROCESS_OBSERVED_STRUCTURE_MISMATCH',
      details: { semanticPath: 'form' },
    }));
    expect(() => projectProcessManaged({ definition: compiled.viewJson }, Object.assign({}, options, {
      formUuid: 'FORM_OTHER',
    }))).toThrow(expect.objectContaining({
      code: 'PROCESS_OBSERVED_STRUCTURE_MISMATCH',
      details: { semanticPath: 'form' },
    }));
  });

  test('never guesses a stale node binding from the node name', () => {
    const compiled = compileProcessDefinition(desired, {
      appType: 'APP_TEST',
      baseUrl: 'https://example.test',
      formUuid: 'FORM_TEST',
      processCode: 'TPROC_TEST',
    });
    const staleBindings = Object.assign({}, compiled.nodeBindings, {
      managerApproval: { nodeId: 'stale-real-id' },
    });

    expect(() => projectProcessManaged({ definition: compiled.viewJson }, {
      desired,
      formUuid: 'FORM_TEST',
      nodeBindings: staleBindings,
    })).toThrow(expect.objectContaining({
      code: 'PROCESS_OBSERVED_STRUCTURE_MISMATCH',
      details: { semanticPath: 'nodes' },
    }));
  });
});
