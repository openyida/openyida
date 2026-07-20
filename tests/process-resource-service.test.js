'use strict';

const {
  applyProcessResource,
  prepareProcessResource,
  readProcessVersionSnapshot,
  reconcileProcessResource,
} = require('../lib/process/services/process-resource-service');

const desired = {
  form: 'form:request',
  nodes: [{
    key: 'managerApproval',
    type: 'approval',
    name: 'Manager approval',
    approver: 'originator',
  }],
};

function baseInput(overrides = {}) {
  return {
    appType: 'APP_TEST',
    baseUrl: 'https://example.test',
    desired,
    existingBindings: {},
    formUuid: 'FORM_TEST',
    processCode: 'TPROC_TEST',
    stateBindings: null,
    ...overrides,
  };
}

function context(services = {}) {
  return {
    authRef: { baseUrl: 'https://example.test' },
    services,
  };
}

function nodeBinding(nodeId, componentName = 'ApprovalNode') {
  return { nodeId, componentName };
}

function versionRow(processId, processVersion, status = 'PUBLISHED') {
  return {
    id: processId,
    version: processVersion,
    status,
    code: 'TPROC_TEST',
  };
}

function versionPage(data, options = {}) {
  return {
    success: true,
    content: {
      data,
      currentPage: options.currentPage || 1,
      totalCount: options.totalCount === undefined ? data.length : options.totalCount,
    },
  };
}

describe('process resource staged service', () => {
  test('default apply writer requires ready auth before version or write I/O', async () => {
    const queryProcessVersions = jest.fn();

    await expect(prepareProcessResource({
      authRef: { baseUrl: 'https://example.test', cookies: [] },
      services: { queryProcessVersions },
      assertRemoteDispatchBoundary() {},
    }, baseInput())).rejects.toMatchObject({
      code: 'PROCESS_RESOURCE_WRITE_PRECHECK_FAILED',
      details: { operation: 'write_precheck' },
    });

    expect(queryProcessVersions).not.toHaveBeenCalled();
  });

  test('prepares from the exact processCode and checkpoints draft, save, and publish', async () => {
    const calls = [];
    const checkpoints = [];
    const services = {
      queryProcessVersions: jest.fn(async () => ({
        success: true,
        content: {
          data: [versionRow(40, '2')],
          currentPage: 1,
          totalCount: 1,
        },
      })),
      newDraftProcess: jest.fn(async (_auth, appType, processCode, formUuid, processId, version) => {
        calls.push(['draft', appType, processCode, formUuid, processId, version]);
        return { success: true, content: { processId: 41 } };
      }),
      saveProcessById: jest.fn(async (_auth, appType, formUuid, processCode, processId, version, processJson, viewJson) => {
        calls.push(['save', appType, formUuid, processCode, processId, version]);
        expect(JSON.parse(processJson).props.bindingForm).toBe('FORM_TEST');
        expect(JSON.parse(viewJson).bindingForm).toBe('FORM_TEST');
        return { success: true };
      }),
      publishProcessById: jest.fn(async (_auth, appType, formUuid, processCode, processId, version) => {
        calls.push(['publish', appType, formUuid, processCode, processId, version]);
        return { success: true };
      }),
    };
    const prepared = await prepareProcessResource(context(services), baseInput());
    const result = await applyProcessResource({
      ...context(services),
      checkpointStage(stage, partial) {
        checkpoints.push({ stage, partial });
      },
    }, { prepared });

    expect(calls).toEqual([
      ['draft', 'APP_TEST', 'TPROC_TEST', 'FORM_TEST', '40', 3],
      ['save', 'APP_TEST', 'FORM_TEST', 'TPROC_TEST', '41', 3],
      ['publish', 'APP_TEST', 'FORM_TEST', 'TPROC_TEST', '41', 3],
    ]);
    expect(checkpoints.map(item => item.stage)).toEqual(['draft_created', 'saved', 'published']);
    expect(checkpoints[0].partial).toMatchObject({
      processCode: 'TPROC_TEST',
      processId: '41',
      processVersion: 3,
      nodeBindings: {
        managerApproval: {
          componentName: 'ApprovalNode',
          nodeId: expect.any(String),
        },
      },
    });
    expect(result).toMatchObject({
      appType: 'APP_TEST',
      formUuid: 'FORM_TEST',
      processCode: 'TPROC_TEST',
      processId: '41',
      processVersion: 3,
    });
  });

  test.each([
    { success: true, content: null },
    versionPage([], { totalCount: 0 }),
    { success: false, errorCode: '500' },
  ])('treats an unusable version list as read failure, never missing', async result => {
    const services = {
      queryProcessVersions: jest.fn(async () => result),
      newDraftProcess: jest.fn(),
    };

    await expect(prepareProcessResource(context(services), baseInput())).rejects.toMatchObject({
      code: 'PROCESS_RESOURCE_VERSION_READ_FAILED',
      details: { operation: 'version_read' },
    });
    expect(services.newDraftProcess).not.toHaveBeenCalled();
  });

  test('stops when the latest bound version no longer matches State', async () => {
    const services = {
      queryProcessVersions: jest.fn(async () => ({
        success: true,
        content: {
          data: [versionRow('PROCESS_NEWER', 8)],
          currentPage: 1,
          totalCount: 1,
        },
      })),
    };

    await expect(prepareProcessResource(context(services), baseInput({
      stateBindings: {
        processId: 'PROCESS_BOUND',
        processVersion: 7,
      },
    }))).rejects.toMatchObject({
      code: 'PROCESS_RESOURCE_VERSION_CONFLICT',
      details: { operation: 'version_compare' },
    });
  });

  test('paginates by currentPage/totalCount and selects the unique PUBLISHED row', async () => {
    const firstPage = Array.from({ length: 10 }, (_value, index) => (
      versionRow(`PROCESS_HISTORY_${index}`, index, 'INVALID')
    ));
    const services = {
      queryProcessVersions: jest.fn(async (_auth, _appType, _processCode, _status, options) => (
        options.pageIndex === 1
          ? versionPage(firstPage, { currentPage: 1, totalCount: 11 })
          : versionPage([versionRow('PROCESS_ACTIVE', 10)], { currentPage: 2, totalCount: 11 })
      )),
    };

    const snapshot = await readProcessVersionSnapshot(context(services), baseInput());

    expect(snapshot.active).toEqual({
      processId: 'PROCESS_ACTIVE',
      processVersion: 10,
      status: 'PUBLISHED',
    });
    expect(services.queryProcessVersions.mock.calls.map(call => call[4])).toEqual([
      { pageIndex: 1, pageSize: 10 },
      { pageIndex: 2, pageSize: 10 },
    ]);
  });

  test('uses PUBLISHED rather than response order and reserves INVALID version numbers', async () => {
    const services = {
      queryProcessVersions: jest.fn(async () => versionPage([
        versionRow('PROCESS_HISTORY', 4, 'INVALID'),
        versionRow('PROCESS_ACTIVE', 2, 'PUBLISHED'),
      ])),
    };

    const prepared = await prepareProcessResource(context(services), baseInput({
      stateBindings: {
        processId: 'PROCESS_ACTIVE',
        processVersion: 2,
      },
    }));

    expect(prepared.baseProcessId).toBe('PROCESS_ACTIVE');
    expect(prepared.processVersion).toBe(5);
  });

  test('rejects an external SAVED draft before compiling or writing', async () => {
    const services = {
      queryProcessVersions: jest.fn(async () => versionPage([
        versionRow('PROCESS_HISTORY', 1, 'INVALID'),
        versionRow('PROCESS_ACTIVE', 0, 'PUBLISHED'),
        versionRow('PROCESS_DRAFT', 2, 'SAVED'),
      ])),
      newDraftProcess: jest.fn(),
    };

    await expect(prepareProcessResource(context(services), baseInput({
      stateBindings: {
        processId: 'PROCESS_ACTIVE',
        processVersion: 0,
      },
    }))).rejects.toMatchObject({
      code: 'PROCESS_RESOURCE_DRAFT_CONFLICT',
      details: { operation: 'version_compare' },
    });
    expect(services.newDraftProcess).not.toHaveBeenCalled();
  });

  test.each([
    ['wrong current page', async () => versionPage([versionRow('PROCESS_ACTIVE', 0)], { currentPage: 2 })],
    ['multiple published versions', async () => versionPage([
      versionRow('PROCESS_ACTIVE_A', 0),
      versionRow('PROCESS_ACTIVE_B', 1),
    ])],
    ['unknown status', async () => versionPage([versionRow('PROCESS_ACTIVE', 0, 'UNKNOWN')])],
  ])('rejects %s as an ambiguous version snapshot', async (_label, implementation) => {
    const services = { queryProcessVersions: jest.fn(implementation) };

    await expect(readProcessVersionSnapshot(context(services), baseInput())).rejects.toMatchObject({
      code: 'PROCESS_RESOURCE_VERSION_READ_FAILED',
    });
    expect(services.queryProcessVersions).toHaveBeenCalledTimes(1);
  });

  test('stops when a later version page cannot be read', async () => {
    const services = {
      queryProcessVersions: jest.fn(async (_auth, _appType, _processCode, _status, options) => {
        if (options.pageIndex === 2) {
          throw new Error('page read failed');
        }
        return versionPage(
          Array.from({ length: 10 }, (_value, index) => versionRow(`PROCESS_HISTORY_${index}`, index, 'INVALID')),
          { currentPage: 1, totalCount: 11 }
        );
      }),
    };

    await expect(readProcessVersionSnapshot(context(services), baseInput())).rejects.toMatchObject({
      code: 'PROCESS_RESOURCE_VERSION_READ_FAILED',
    });
    expect(services.queryProcessVersions).toHaveBeenCalledTimes(2);
  });

  test.each([
    ['empty', desired, {}],
    ['partial', {
      ...desired,
      nodes: desired.nodes.concat({
        key: 'financeApproval',
        type: 'approval',
        name: 'Finance approval',
        approver: 'originator',
      }),
    }, {
      managerApproval: nodeBinding('node-manager'),
    }],
    ['extra', desired, {
      managerApproval: nodeBinding('node-manager'),
      unexpectedApproval: nodeBinding('node-extra'),
    }],
    ['wrong component', desired, {
      managerApproval: nodeBinding('node-manager', 'CarbonNode'),
    }],
  ])('rejects %s checkpoint node bindings before recovery I/O', async (_label, recoveryDesired, nodeBindings) => {
    const services = {
      queryProcessVersions: jest.fn(),
      readProcessDefinition: jest.fn(),
      newDraftProcess: jest.fn(),
      saveProcessById: jest.fn(),
      publishProcessById: jest.fn(),
    };
    const stageCheckpoint = {
      stage: 'saved',
      processCode: 'TPROC_TEST',
      processId: 'PROCESS_DRAFT',
      processVersion: 4,
      nodeBindings,
    };

    await expect(prepareProcessResource(context(services), baseInput({
      desired: recoveryDesired,
      recovery: { stageCheckpoint },
    }))).rejects.toMatchObject({
      code: 'PROCESS_RESOURCE_RECONCILIATION_REQUIRED',
      details: { operation: 'checkpoint_validate' },
    });
    await expect(reconcileProcessResource(context(services), {
      appType: 'APP_TEST',
      formUuid: 'FORM_TEST',
      processCode: 'TPROC_TEST',
      resource: { desired: recoveryDesired },
      stageCheckpoint,
    })).resolves.toBeNull();
    for (const service of Object.values(services)) {
      expect(service).not.toHaveBeenCalled();
    }
  });

  test('reuses checkpointed node bindings and resumes from saved without another draft or save', async () => {
    const services = {
      queryProcessVersions: jest.fn(),
      newDraftProcess: jest.fn(),
      saveProcessById: jest.fn(),
      publishProcessById: jest.fn(async () => ({ success: true })),
    };
    const stageCheckpoint = {
      stage: 'saved',
      processCode: 'TPROC_TEST',
      processId: 'PROCESS_DRAFT',
      processVersion: 4,
      nodeBindings: {
        managerApproval: {
          nodeId: 'node-existing-manager',
          componentName: 'ApprovalNode',
        },
      },
    };
    const recovery = { stageCheckpoint };
    const prepared = await prepareProcessResource(context(services), baseInput({ recovery }));
    const checkpoints = [];
    const result = await applyProcessResource({
      ...context(services),
      checkpointStage(stage) {
        checkpoints.push(stage);
      },
    }, { prepared, recovery });

    expect(services.queryProcessVersions).not.toHaveBeenCalled();
    expect(services.newDraftProcess).not.toHaveBeenCalled();
    expect(services.saveProcessById).not.toHaveBeenCalled();
    expect(services.publishProcessById).toHaveBeenCalledTimes(1);
    expect(checkpoints).toEqual(['published']);
    expect(result.nodeBindings.managerApproval.nodeId).toBe('node-existing-manager');
  });

  test('reconciliation only resumes or completes with exact bound read evidence', async () => {
    const prepared = await prepareProcessResource(context({
      queryProcessVersions: jest.fn(async () => ({
        success: true,
        content: {
          data: [versionRow('PROCESS_BASE', 0)],
          currentPage: 1,
          totalCount: 1,
        },
      })),
    }), baseInput());
    const checkpoint = {
      stage: 'saved',
      processCode: 'TPROC_TEST',
      processId: 'PROCESS_DRAFT',
      processVersion: 1,
      nodeBindings: prepared.compiled.nodeBindings,
      desiredManagedHash: 'sha256:' + 'a'.repeat(64),
    };
    const services = {
      readFormMode: jest.fn(async () => ({
        mode: 'process',
        processCode: 'TPROC_TEST',
        processId: 'PROCESS_DRAFT',
      })),
      readProcessDefinition: jest.fn(async () => ({ definition: prepared.compiled.viewJson })),
      queryProcessVersions: jest.fn(async () => ({
        success: true,
        content: {
          data: [
            versionRow('PROCESS_BASE', 0, 'PUBLISHED'),
            versionRow('PROCESS_DRAFT', 1, 'SAVED'),
          ],
          currentPage: 1,
          totalCount: 2,
        },
      })),
    };
    const resource = { key: 'approval', desired };
    const operation = {
      operationId: 'sha256:' + 'd'.repeat(64),
      resourceType: 'process',
      key: resource.key,
      operation: 'create',
      status: 'uncertain',
      desiredHash: checkpoint.desiredManagedHash,
      stageCheckpoint: checkpoint,
    };
    const input = {
      appType: 'APP_TEST',
      formUuid: 'FORM_TEST',
      processCode: 'TPROC_TEST',
      operation,
      resource,
      stageCheckpoint: checkpoint,
    };

    await expect(reconcileProcessResource(context(services), input)).resolves.toEqual({ action: 'resume' });
    services.queryProcessVersions.mockResolvedValueOnce({
      success: true,
      content: {
        data: [
          versionRow('PROCESS_BASE', 0, 'INVALID'),
          versionRow('PROCESS_DRAFT', 1, 'PUBLISHED'),
        ],
        currentPage: 1,
        totalCount: 2,
      },
    });
    await expect(reconcileProcessResource(context(services), {
      ...input,
      stageCheckpoint: { ...checkpoint, stage: 'published' },
    })).resolves.toMatchObject({
      action: 'complete',
      result: {
        processCode: 'TPROC_TEST',
        processId: 'PROCESS_DRAFT',
        processVersion: 1,
      },
    });

    services.queryProcessVersions.mockResolvedValueOnce({
      success: true,
      content: {
        data: [
          versionRow('PROCESS_BASE', 0, 'INVALID'),
          versionRow('PROCESS_DRAFT', 1, 'PUBLISHED'),
        ],
        currentPage: 1,
        totalCount: 2,
      },
    });
    await expect(reconcileProcessResource(context(services), input)).resolves.toMatchObject({
      action: 'complete',
    });

    services.queryProcessVersions.mockResolvedValueOnce({
      success: true,
      content: { data: [], currentPage: 1, totalCount: 0 },
    });
    await expect(reconcileProcessResource(context(services), input)).resolves.toBeNull();

    services.readProcessDefinition.mockRejectedValueOnce(Object.assign(new Error('private failure'), {
      code: 'PROCESS_READ_FAILED',
    }));
    await expect(reconcileProcessResource(context(services), input)).resolves.toBeNull();
  });

  test.each([
    ['rebound', { mode: 'process', processCode: 'TPROC_REBOUND', processId: 'PROCESS_OTHER' }],
    ['unbound', { mode: 'receipt' }],
  ])('saved recovery rejects a currently %s form before process definition/version/publish I/O', async (_label, observedMode) => {
    const prepared = await prepareProcessResource(context({
      queryProcessVersions: jest.fn(async () => versionPage([versionRow('PROCESS_BASE', 0)])),
    }), baseInput());
    const checkpoint = {
      stage: 'saved',
      processCode: 'TPROC_TEST',
      processId: 'PROCESS_DRAFT',
      processVersion: 1,
      nodeBindings: prepared.compiled.nodeBindings,
      desiredManagedHash: 'sha256:' + 'a'.repeat(64),
    };
    const resource = { key: 'approval', desired };
    const operation = {
      operationId: 'sha256:' + 'd'.repeat(64),
      resourceType: 'process',
      key: resource.key,
      operation: 'create',
      status: 'uncertain',
      desiredHash: checkpoint.desiredManagedHash,
      stageCheckpoint: checkpoint,
    };
    const services = {
      readFormMode: jest.fn(async () => observedMode),
      readProcessDefinition: jest.fn(),
      queryProcessVersions: jest.fn(),
      saveProcessById: jest.fn(),
      publishProcessById: jest.fn(),
    };

    await expect(reconcileProcessResource(context(services), {
      appType: 'APP_TEST',
      formUuid: 'FORM_TEST',
      processCode: 'TPROC_TEST',
      operation,
      resource,
      stageCheckpoint: checkpoint,
    })).resolves.toBeNull();

    expect(services.readFormMode).toHaveBeenCalledTimes(1);
    expect(services.readProcessDefinition).not.toHaveBeenCalled();
    expect(services.queryProcessVersions).not.toHaveBeenCalled();
    expect(services.saveProcessById).not.toHaveBeenCalled();
    expect(services.publishProcessById).not.toHaveBeenCalled();
  });

  test('draft recovery requires operation-bound positive identity evidence', async () => {
    const prepared = await prepareProcessResource(context({
      queryProcessVersions: jest.fn(async () => versionPage([versionRow('PROCESS_BASE', 0)])),
    }), baseInput());
    const checkpoint = {
      stage: 'draft_created',
      processCode: 'TPROC_TEST',
      processId: 'PROCESS_DRAFT',
      processVersion: 1,
      nodeBindings: prepared.compiled.nodeBindings,
      desiredManagedHash: 'sha256:' + 'a'.repeat(64),
      compiledProcessHash: 'sha256:' + 'b'.repeat(64),
      compiledViewHash: 'sha256:' + 'c'.repeat(64),
    };
    const services = {
      readFormMode: jest.fn(async () => ({ mode: 'process', processCode: 'TPROC_TEST' })),
      readProcessDefinition: jest.fn(async () => ({
        definition: {
          ...prepared.compiled.viewJson,
          bindingForm: 'FORM_TEST',
          schema: { children: [] },
        },
      })),
      queryProcessVersions: jest.fn(async () => versionPage([
        versionRow('PROCESS_BASE', 0, 'PUBLISHED'),
        versionRow('PROCESS_DRAFT', 1, 'SAVED'),
      ])),
    };
    const resource = { key: 'approval', desired };
    const operation = {
      operationId: 'sha256:' + 'd'.repeat(64),
      resourceType: 'process',
      key: resource.key,
      operation: 'create',
      status: 'uncertain',
      desiredHash: checkpoint.desiredManagedHash,
      stageCheckpoint: checkpoint,
    };
    const input = {
      appType: 'APP_TEST',
      formUuid: 'FORM_TEST',
      processCode: 'TPROC_TEST',
      operation,
      resource,
      stageCheckpoint: checkpoint,
    };

    await expect(reconcileProcessResource(context(services), input)).resolves.toEqual({ action: 'resume' });

    services.readProcessDefinition.mockClear();
    services.queryProcessVersions.mockClear();
    await expect(reconcileProcessResource(context(services), {
      ...input,
      operation: { ...operation, operationId: 'sha256:' + 'e'.repeat(64), key: 'replaced' },
    })).resolves.toBeNull();
    expect(services.readProcessDefinition).not.toHaveBeenCalled();
    expect(services.queryProcessVersions).not.toHaveBeenCalled();

    const noPositiveVersion = {
      ...services,
      queryProcessVersions: jest.fn(async () => versionPage([
        versionRow('PROCESS_BASE', 0, 'PUBLISHED'),
        versionRow('PROCESS_DRAFT', 1, 'INVALID'),
      ])),
    };
    await expect(reconcileProcessResource(context(noPositiveVersion), input)).resolves.toBeNull();
  });

  test('draft recovery rejects a current form rebind before process definition/version I/O', async () => {
    const prepared = await prepareProcessResource(context({
      queryProcessVersions: jest.fn(async () => versionPage([versionRow('PROCESS_BASE', 0)])),
    }), baseInput());
    const checkpoint = {
      stage: 'draft_created',
      processCode: 'TPROC_TEST',
      processId: 'PROCESS_DRAFT',
      processVersion: 1,
      nodeBindings: prepared.compiled.nodeBindings,
      desiredManagedHash: 'sha256:' + 'a'.repeat(64),
    };
    const operation = {
      operationId: 'sha256:' + 'd'.repeat(64),
      resourceType: 'process',
      key: 'approval',
      operation: 'create',
      status: 'uncertain',
      desiredHash: checkpoint.desiredManagedHash,
      stageCheckpoint: checkpoint,
    };
    const services = {
      readFormMode: jest.fn(async () => ({ mode: 'process', processCode: 'TPROC_REBOUND' })),
      readProcessDefinition: jest.fn(),
      queryProcessVersions: jest.fn(),
      saveProcessById: jest.fn(),
      publishProcessById: jest.fn(),
    };

    await expect(reconcileProcessResource(context(services), {
      appType: 'APP_TEST',
      formUuid: 'FORM_TEST',
      processCode: 'TPROC_TEST',
      operation,
      resource: { key: 'approval', desired },
      stageCheckpoint: checkpoint,
    })).resolves.toBeNull();

    expect(services.readFormMode).toHaveBeenCalledTimes(1);
    expect(services.readProcessDefinition).not.toHaveBeenCalled();
    expect(services.queryProcessVersions).not.toHaveBeenCalled();
    expect(services.saveProcessById).not.toHaveBeenCalled();
    expect(services.publishProcessById).not.toHaveBeenCalled();
  });

  test('version pagination stops before its next GET when the apply lock is lost', async () => {
    const queryProcessVersions = jest.fn(async () => versionPage(
      Array.from({ length: 10 }, (_value, index) => versionRow(`PROCESS_HISTORY_${index}`, index, 'INVALID')),
      { currentPage: 1, totalCount: 11 }
    ));
    const lost = Object.assign(new Error('lock lost'), { code: 'SCHEMA_APPLY_LOCK_LOST' });
    let completedPrimitive = 0;

    await expect(readProcessVersionSnapshot({
      ...context({ queryProcessVersions }),
      assertRemoteDispatchBoundary(phase) {
        if (phase === 'after' && ++completedPrimitive === 1) {
          throw lost;
        }
      },
    }, baseInput())).rejects.toBe(lost);

    expect(queryProcessVersions).toHaveBeenCalledTimes(1);
  });
});
