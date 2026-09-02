'use strict';

jest.mock('../lib/connector/api', () => ({
  findConnectorById: jest.fn(),
  findConnectorByName: jest.fn(),
  getConnectorDetail: jest.fn(),
}));

const connectorApi = require('../lib/connector/api');
const { SUPPORTED_LANGUAGES, loadLocaleForLanguage } = require('../lib/core/i18n');
const {
  resolveConnectorActionSchema,
  validateConnectorAssignmentsAgainstSchema,
} = require('../lib/integration/integration-connector-schema');

describe('integration connector schema discovery', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('uses a fixed proven preset without platform discovery', async () => {
    const result = await resolveConnectorActionSchema({}, {
      connectorId: 'G-CONN-1016B8AEBED50B01B8D00009',
      actionId: 'G-ACT-1016B8B1911A0B01B8D0000I',
    });
    expect(result).toMatchObject({
      verificationLevel: 'FIXED_PROVEN_PRESET',
      inputs: expect.any(Array),
      outputs: expect.any(Array),
    });
    expect(connectorApi.findConnectorById).not.toHaveBeenCalled();
  });

  test('uses exact read-only connector/action discovery and preserves platform field types', async () => {
    connectorApi.findConnectorById.mockResolvedValue({
      id: 7, connectorName: 'Http_owned', connectorMode: 5,
    });
    connectorApi.getConnectorDetail.mockResolvedValue({
      operations: JSON.stringify([{
        operationId: 'sync',
        inputs: [
          { name: 'amount', componentName: 'NumberField', paramType: 'Number' },
          { name: 'active', componentName: 'CheckboxField', paramType: 'Boolean' },
        ],
        outputs: [{ name: 'requestId', componentName: 'TextField' }],
      }]),
    });

    const result = await resolveConnectorActionSchema({}, {
      connectorId: '7', actionId: 'sync', connectorMode: 5,
    });

    expect(result.verificationLevel).toBe('PLATFORM_READ_ONLY_DISCOVERY');
    expect(result.inputs.map((input) => input.componentName)).toEqual(['NumberField', 'CheckboxField']);
    expect(result.outputs).toHaveLength(1);
  });

  test('discovers common Http_ connector names when the numeric-id lookup has no match', async () => {
    connectorApi.findConnectorById.mockResolvedValue(null);
    connectorApi.findConnectorByName.mockResolvedValue({
      id: 7, connectorName: 'Http_owned', connectorMode: 5,
    });
    connectorApi.getConnectorDetail.mockResolvedValue({
      operations: [{ operationId: 'sync', inputs: [], outputs: [] }],
    });

    await expect(resolveConnectorActionSchema({}, {
      connectorId: 'Http_owned', actionId: 'sync', connectorMode: 5,
    })).resolves.toMatchObject({ verificationLevel: 'PLATFORM_READ_ONLY_DISCOVERY' });

    expect(connectorApi.findConnectorByName).toHaveBeenCalledWith('Http_owned', {});
  });

  test.each([
    ['connector missing', null, null, 'INTEGRATION_CONNECTOR_NOT_FOUND'],
    ['action missing', { id: 7, connectorName: 'Http_owned' }, { operations: '[]' }, 'INTEGRATION_CONNECTOR_ACTION_NOT_FOUND'],
    ['operations malformed', { id: 7, connectorName: 'Http_owned' }, { operations: '{bad' }, 'INTEGRATION_CONNECTOR_SCHEMA_UNVERIFIED'],
  ])('fails closed when %s', async (_label, connector, detail, code) => {
    connectorApi.findConnectorById.mockResolvedValue(connector);
    connectorApi.findConnectorByName.mockResolvedValue(connector);
    connectorApi.getConnectorDetail.mockResolvedValue(detail);
    await expect(resolveConnectorActionSchema({}, {
      connectorId: '7', actionId: 'sync', connectorMode: 5,
    })).rejects.toMatchObject({ code });
  });

  test('rejects assignment columns absent from the discovered schema', () => {
    expect(() => validateConnectorAssignmentsAgainstSchema(
      [{ column: 'unknown', valueType: 'literal', value: 'x' }],
      [{ name: 'amount', componentName: 'NumberField' }]
    )).toThrow(expect.objectContaining({ code: 'INTEGRATION_CONNECTOR_INPUT_UNKNOWN' }));
  });

  test('all 12 locale packs expose control-plane readback and connector fail-closed messages', () => {
    const keys = [
      'publish_readback_unverified',
      'readback_exact_match_failed',
      'readback_status_mismatch',
      'readback_detail_failed',
      'readback_detail_empty',
      'readback_detail_identity_mismatch',
      'detail_api_failed',
      'list_pagination_limit',
      'form_list_pagination_limit',
      'connector_schema_file_unverified',
      'connector_not_found',
      'connector_schema_discovery_failed',
      'connector_schema_missing',
      'connector_action_not_found',
      'connector_action_schema_missing',
      'connector_input_unknown',
      'connector_schema_unverified',
      'runtime_case_unknown',
      'runtime_adapter_missing',
      'runtime_preflight_not_read_only',
      'runtime_ownership_unverified',
      'runtime_trigger_rejected',
      'runtime_contract_failed',
      'runtime_cleanup_failed',
      'runtime_primary_cleanup_failed',
    ];
    expect(SUPPORTED_LANGUAGES).toHaveLength(12);
    for (const language of SUPPORTED_LANGUAGES) {
      const locale = loadLocaleForLanguage(language);
      for (const key of keys) {
        expect(locale.integration[key]).toEqual(expect.any(String));
        expect(locale.integration[key]).not.toBe('');
      }
    }
  });
});
