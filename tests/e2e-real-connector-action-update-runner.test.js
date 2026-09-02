'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildFixtureOperations,
  getConfig,
  run,
  summarizeFixtureResponse,
} = require('../scripts/e2e-real/connector/action-update-runner');
const { createActionSnapshot, patchActionQuery } = require('../lib/connector/connector-action-update');

function connectorDetail(operations) {
  return {
    id: 101,
    operations: JSON.stringify(operations),
    displayName: 'owned',
    iconUrl: 'chaxun%%#FFA200',
    connectorDesc: 'stable',
    host: 'www.aliwork.com',
    baseUrl: '/',
    scheme: 'https',
    tongxunluTemplateId: '',
    faasTemplateId: '0',
    securitySchemes: '{}',
    connectorMode: '5',
    connectorName: 'Http_owned_action_update',
    category: 'http',
  };
}

describe('real connector action update runner contract', () => {
  test('builds one target plus one preservation sentinel with the proven no-auth fixture contract', () => {
    const operations = buildFixtureOperations('RUN-OWNED', 1000);
    expect(operations.map(operation => operation.operationId)).toEqual([
      'openyida_fixture_search',
      'openyida_preservation_sentinel',
    ]);
    const target = operations[0];
    expect(target).toMatchObject({
      method: 'get',
      url: 'query/loginFreeFormData/listFormDataByType.json',
    });
    expect(target.parameters.header).toEqual(expect.arrayContaining([
      { name: 'Referer', value: 'https://www.aliwork.com/' },
      { name: 'X-Requested-With', value: 'XMLHttpRequest' },
    ]));
    expect(Object.fromEntries(target.parameters.query.map(item => [item.name, item.value])))
      .toMatchObject({
        _api: 'nattyFetch',
        _mock: 'false',
        userLanguage: 'zh_CN',
        pageSize: '1',
        currentPage: '2',
        type: 'yida_helper_base',
        searchFieldJson: '{"radioField_lbarqa36":"y"}',
        _stamp: '1000',
      });
    expect(JSON.stringify(operations)).not.toMatch(/cookie|authorization|token|profile|corpId/i);
  });

  test('requires explicit opt-in without accepting identity or fixture overrides', () => {
    expect(getConfig({})).toMatchObject({ enabled: false, ready: false });
    const config = getConfig({
      OPENYIDA_E2E: '1',
      OPENYIDA_E2E_CONNECTOR_ACTION_UPDATE: '1',
      OPENYIDA_E2E_REGISTRY_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'connector-action-config-')),
    }, new Date('2026-08-28T00:00:00Z'));
    expect(config).toMatchObject({
      enabled: true,
      ready: true,
      host: 'www.aliwork.com',
      baseUrl: '/',
      securitySchemes: '{}',
    });
    expect(config).not.toHaveProperty('corpId');
    expect(config).not.toHaveProperty('profile');
  });

  test('summarizes only response structure, count, and hash and rejects unproven responses', () => {
    const response = {
      statusLine: 'HTTP/1.1 200 OK',
      responseHeaders: { 'content-type': 'application/json;charset=UTF-8' },
      content: JSON.stringify({
        success: true,
        content: {
          currentPage: 2,
          data: [{ privateRealValue: 'MUST_NOT_PERSIST' }],
          totalCount: 10,
        },
      }),
    };
    const summary = summarizeFixtureResponse(response, { dataLength: 1, currentPage: '2' });
    expect(summary).toMatchObject({
      statusCode: 200,
      dataLength: 1,
      topKeys: ['content', 'success'],
      contentKeys: ['currentPage', 'data', 'totalCount'],
      bodyHash: expect.stringMatching(/^sha256:/),
      currentPage: 2,
    });
    expect(JSON.stringify(summary)).not.toContain('MUST_NOT_PERSIST');

    expect(() => summarizeFixtureResponse({ ...response, statusLine: 'HTTP/1.1 500 Error' }, 1))
      .toThrow(expect.objectContaining({ code: 'CONNECTOR_ACTION_E2E_RESPONSE_INVALID' }));
    expect(() => summarizeFixtureResponse({ ...response, content: '{broken' }, 1))
      .toThrow(expect.objectContaining({ code: 'CONNECTOR_ACTION_E2E_RESPONSE_INVALID' }));
    expect(() => summarizeFixtureResponse(response, 0))
      .toThrow(expect.objectContaining({ code: 'CONNECTOR_ACTION_E2E_COUNT_MISMATCH' }));
  });

  test('rejects an ignored currentPage even when the response count matches', () => {
    const ignoredParameterResponse = {
      statusLine: 'HTTP/1.1 200 OK',
      responseHeaders: { 'content-type': 'application/json' },
      content: JSON.stringify({
        success: true,
        content: { currentPage: 2, data: [{}] },
      }),
    };
    expect(() => summarizeFixtureResponse(
      ignoredParameterResponse,
      { dataLength: 1, currentPage: '1' }
    )).toThrow(expect.objectContaining({ code: 'CONNECTOR_ACTION_E2E_CURRENT_PAGE_MISMATCH' }));
  });

  test('runs every isolated edit and restore with pre-write evidence and no response values persisted', async () => {
    const registryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'connector-action-e2e-success-'));
    const prefix = 'OY_E2E_CONNECTOR_ACTION_TEST';
    const initialOperations = buildFixtureOperations(prefix, 1000);
    let currentOperations = JSON.parse(JSON.stringify(initialOperations));
    let updateCalls = 0;
    let testCalls = 0;
    let createEvidenceReady = false;
    const responseSecret = 'REMOTE_RESPONSE_VALUE_MUST_NOT_PERSIST';
    const runCli = args => {
      const command = args.slice(0, 2).join(' ');
      if (command === 'login --check-only') {
        return { json: { ok: true, status: 'ok', corp_id: 'DO_NOT_PERSIST', auth_profile: 'DO_NOT_PERSIST' } };
      }
      if (command === 'connector create') {
        createEvidenceReady = fs.existsSync(path.join(registryDir, `${prefix}.json`)) &&
          fs.existsSync(path.join(registryDir, `${prefix}.manifest.json`)) &&
          fs.existsSync(path.join(registryDir, prefix, 'evidence', 'operations.json'));
        return { json: {
          success: true,
          connectorId: 101,
          connectorName: 'Http_owned_action_update',
          readbackVerified: true,
        } };
      }
      if (command === 'connector detail') {
        return { json: { success: true, connectorId: '101', detail: connectorDetail(currentOperations) } };
      }
      if (command === 'connector list-actions') {
        return { json: { success: true, connectorId: '101', operations: currentOperations } };
      }
      if (command === 'connector list-connections') {
        return { json: { success: true, connectorId: '101', connections: [] } };
      }
      if (command === 'connector update-action') {
        updateCalls += 1;
        const before = createActionSnapshot(connectorDetail(currentOperations));
        const queryPatch = JSON.parse(args[args.indexOf('--query-json') + 1]);
        currentOperations = patchActionQuery(before, 'openyida_fixture_search', queryPatch).operations;
        return { json: {
          success: true,
          readbackVerified: true,
          beforeFingerprint: before.connectorFingerprint,
          afterFingerprint: before.connectorFingerprint,
        } };
      }
      if (command === 'connector test') {
        testCalls += 1;
        const query = JSON.parse(args[args.indexOf('--query-json') + 1]);
        const filter = JSON.parse(query.searchFieldJson).radioField_lbarqa36;
        const dataLength = filter === 'n' ? 0 : (query.pageSize === '2' ? 2 : 1);
        return { json: {
          success: true,
          statusLine: 'HTTP/1.1 200 OK',
          responseHeaders: { 'content-type': 'application/json;charset=UTF-8' },
          content: JSON.stringify({
            success: true,
            content: {
              currentPage: Number(query.currentPage),
              data: Array.from({ length: dataLength }, () => ({ value: responseSecret })),
            },
          }),
        } };
      }
      throw new Error(`unexpected command: ${command}`);
    };

    const result = await run({
      env: {
        OPENYIDA_E2E: '1',
        OPENYIDA_E2E_CONNECTOR_ACTION_UPDATE: '1',
        OPENYIDA_E2E_CONNECTOR_ACTION_PREFIX: prefix,
        OPENYIDA_E2E_REGISTRY_DIR: registryDir,
      },
      initialStamp: 1000,
      logger: () => {},
      runCli,
    });

    expect(createEvidenceReady).toBe(true);
    expect(updateCalls).toBe(10);
    expect(testCalls).toBe(7);
    expect(result).toMatchObject({
      status: 'cleanup_blocked',
      remoteWrites: 11,
      registry: { evidenceLevel: 'mixed_explicit_contracts' },
    });
    expect(result.registry.steps).toHaveLength(11);
    expect(result.registry.steps.map(step => [step.label, step.evidenceLevel, step.response && step.response.dataLength])).toEqual([
      ['baseline', 'runtime_structure_count', 1],
      ['currentPage', 'runtime_exact_current_page', 1], ['currentPage:restore', 'runtime_exact_current_page', 1],
      ['pageSize', 'runtime_exact_count', 2], ['pageSize:restore', 'runtime_exact_count', 1],
      ['userLanguage', 'platform_exact_readback_restore', undefined],
      ['userLanguage:restore', 'platform_exact_readback_restore', undefined],
      ['searchFieldJson', 'runtime_exact_count', 0], ['searchFieldJson:restore', 'runtime_exact_count', 1],
      ['_stamp', 'platform_exact_readback_restore', undefined],
      ['_stamp:restore', 'platform_exact_readback_restore', undefined],
    ]);
    expect(currentOperations).toEqual(initialOperations);
    expect(result.registry.cleanup).toMatchObject({
      status: 'cleanup_blocked',
      residual: [expect.objectContaining({ reason: 'remote_cleanup_unsupported' })],
      deleteCommands: [],
    });
    const serializedEvidence = [result.registryPath, result.manifestPath]
      .map(file => fs.readFileSync(file, 'utf8')).join('\n');
    const persistedManifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf8'));
    expect(persistedManifest).toMatchObject({ evidenceLevel: 'mixed_explicit_contracts' });
    expect(persistedManifest.steps.every(step => typeof step.evidenceLevel === 'string')).toBe(true);
    expect(serializedEvidence).not.toContain(responseSecret);
    expect(serializedEvidence).not.toContain('DO_NOT_PERSIST');
  });

  test('records an unknown update outcome once and never retries or deletes', async () => {
    const registryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'connector-action-e2e-unknown-'));
    const prefix = 'OY_E2E_CONNECTOR_ACTION_UNKNOWN';
    const initialOperations = buildFixtureOperations(prefix, 1000);
    let updateCalls = 0;
    const runCli = args => {
      const command = args.slice(0, 2).join(' ');
      if (command === 'login --check-only') {
        return { json: { ok: true, status: 'ok' } };
      }
      if (command === 'connector create') {
        return { json: {
          success: true, connectorId: 101, connectorName: 'Http_owned_action_update', readbackVerified: true,
        } };
      }
      if (command === 'connector detail') {
        return { json: {
          success: true, connectorId: '101', detail: connectorDetail(initialOperations),
        } };
      }
      if (command === 'connector list-actions') {
        return { json: {
          success: true, connectorId: '101', operations: initialOperations,
        } };
      }
      if (command === 'connector list-connections') {
        return { json: {
          success: true, connectorId: '101', connections: [],
        } };
      }
      if (command === 'connector test') {
        return { json: {
          success: true,
          statusLine: 'HTTP/1.1 200 OK',
          responseHeaders: { 'content-type': 'application/json' },
          content: '{"success":true,"content":{"currentPage":2,"data":[{}]}}',
        } };
      }
      if (command === 'connector update-action') {
        updateCalls += 1;
        throw new Error('socket closed after request');
      }
      throw new Error(`unexpected command: ${command}`);
    };

    await expect(run({
      env: {
        OPENYIDA_E2E: '1',
        OPENYIDA_E2E_CONNECTOR_ACTION_UPDATE: '1',
        OPENYIDA_E2E_CONNECTOR_ACTION_PREFIX: prefix,
        OPENYIDA_E2E_REGISTRY_DIR: registryDir,
      },
      initialStamp: 1000,
      logger: () => {},
      runCli,
    })).rejects.toMatchObject({ code: 'CONNECTOR_ACTION_E2E_FAILED' });

    expect(updateCalls).toBe(1);
    const registry = JSON.parse(fs.readFileSync(path.join(registryDir, `${prefix}.json`), 'utf8'));
    expect(registry.writeAttempts.map(attempt => attempt.status)).toEqual(['completed', 'outcome_unknown']);
    expect(registry.cleanup).toMatchObject({ status: 'cleanup_blocked', deleteCommands: [] });
    expect(registry.cleanup.residual).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'remote_cleanup_unsupported' }),
      expect.objectContaining({ reason: 'remote_outcome_unknown' }),
    ]));
  });

  test('returns probe-required with zero writes and no residual when no active auth selection exists', async () => {
    const registryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'connector-action-e2e-probe-'));
    const result = await run({
      env: {
        OPENYIDA_E2E: '1',
        OPENYIDA_E2E_CONNECTOR_ACTION_UPDATE: '1',
        OPENYIDA_E2E_CONNECTOR_ACTION_PREFIX: 'OY_E2E_CONNECTOR_ACTION_PROBE',
        OPENYIDA_E2E_REGISTRY_DIR: registryDir,
      },
      initialStamp: 1000,
      logger: () => {},
      runCli: () => ({ json: { ok: false, status: 'profile_required', auth_profile: 'MUST_NOT_PERSIST' } }),
    });
    expect(result).toMatchObject({
      status: 'PLATFORM_PROBE_REQUIRED',
      remoteWrites: 0,
      registry: {
        writeAttempts: [],
        resources: [],
        cleanup: { status: 'passed', residual: [], deleteCommands: [] },
      },
    });
    expect(fs.readFileSync(result.registryPath, 'utf8')).not.toContain('MUST_NOT_PERSIST');
  });
});
