'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../lib/integration/integration-node-ids', () => {
  let counter = 0;
  return {
    generateNodeId: jest.fn(() => `node_${++counter}`),
    generateRuleGroupId: jest.fn(() => 'group-fixed'),
    generateRuleItemId: jest.fn(() => 'item-fixed'),
    generateDataRuleId: jest.fn(() => 'rule-fixed'),
    generateButtonUuid: jest.fn(() => 'button-fixed'),
  };
});

const {
  buildSpecProcessAndViewJson,
  collectAddDataFormUuids,
  readIntegrationSpec,
  validateIntegrationSpec,
  _private,
} = require('../lib/integration/integration-spec-builder');

describe('integration spec builder', () => {
  test('builds dataRetrieve -> route -> dataUpdate/dataCreate flow from spec', () => {
    const spec = {
      events: ['insert'],
      nodes: [
        {
          id: 'self',
          type: 'getSelf',
        },
        {
          id: 'branch',
          type: 'route',
          branches: [
            {
              id: 'hasData',
              name: '有自身数据',
              conditions: [
                {
                  fieldId: '${self}.pid',
                  fieldName: '表单实例ID',
                  opCode: 'ExistValue',
                  componentType: 'TextField',
                },
              ],
              nodes: [
                {
                  id: 'updateSelf',
                  type: 'dataUpdate',
                  source: 'self',
                  assignments: [
                    {
                      column: 'textareaField_result',
                      valueType: 'literal',
                      value: '已更新',
                    },
                  ],
                },
              ],
            },
            {
              id: 'fallback',
              name: '其他情况',
              default: true,
              nodes: [
                {
                  id: 'createBackup',
                  type: 'dataCreate',
                  formUuid: 'FORM-B',
                  assignments: [
                    {
                      column: 'textField_name',
                      valueType: 'processVar',
                      value: 'textField_name',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const built = buildSpecProcessAndViewJson({
      spec,
      processCode: 'LPROC-SPEC',
      appType: 'APP-SPEC',
      formUuid: 'FORM-A',
      flowName: 'Spec Flow',
      formEventTypes: ['insert'],
      formSchemasByUuid: new Map([
        ['FORM-B', [
          { componentName: 'TextField', props: { fieldId: 'textField_name', label: { zh_CN: '名称' } } },
        ]],
      ]),
    });

    expect(built.processJson.props.processCode).toBe('LPROC-SPEC');
    expect(built.processJson.nodes.map((node) => node.type)).toEqual([
      'trigger',
      'dataRetrieve',
      'route',
      'finish',
    ]);
    expect(built.processJson.nodes[1].props.condition.rules[0]).toMatchObject({
      id: 'pid',
      value: '__masterdata_form_inst_id',
      opCode: 'Equal',
    });

    const route = built.processJson.nodes[2];
    expect(route.childNodes.map((node) => node.type)).toEqual(['condition', 'condition']);
    expect(route.childNodes[0].props.conditions.rules[0]).toMatchObject({
      id: `\${${built.nodeIdMap.self}}.pid`,
      opCode: 'ExistValue',
      op: '有值',
    });
    expect(route.childNodes[0].childNodes[0]).toMatchObject({
      type: 'dataUpdate',
      props: {
        type: 'node',
        sourceId: built.nodeIdMap.self,
      },
    });
    expect(route.childNodes[1].props.isDefault).toBe(true);
    expect(route.childNodes[1].childNodes[0]).toMatchObject({
      type: 'dataCreate',
      props: {
        formUuid: 'FORM-B',
      },
    });

    expect(built.viewJson.schema.children.map((node) => node.componentName)).toEqual([
      'StartNode',
      'GetSingleDataNode',
      'ConditionContainer',
      'EndNode',
    ]);
    expect(built.viewJson.schema.children[2].children[0].children[0].componentName).toBe('UpdateDataNode');
    expect(Object.keys(built.nodeIdMap).sort()).toEqual([
      'branch',
      'createBackup',
      'fallback',
      'hasData',
      'self',
      'updateSelf',
    ]);
  });

  test('collectAddDataFormUuids walks branch child nodes', () => {
    expect(collectAddDataFormUuids({
      nodes: [
        {
          type: 'route',
          branches: [
            { nodes: [{ type: 'dataCreate', formUuid: 'FORM-A' }] },
            { nodes: [{ type: 'dataCreate', targetFormUuid: 'FORM-B' }] },
          ],
        },
      ],
    }).sort()).toEqual(['FORM-A', 'FORM-B']);
  });

  test('validates spec shape before remote calls are needed', () => {
    expect(() => validateIntegrationSpec({ nodes: [{ type: 'getSelf' }] }, ['insert'])).not.toThrow();
    expect(() => validateIntegrationSpec({ events: ['insert'], nodes: [] })).toThrow(/non-empty nodes array/);
    expect(() => validateIntegrationSpec({ events: ['unknown'], nodes: [{ type: 'getSelf' }] })).toThrow(/valid event/);
  });

  test('accepts route condition objects with explicit logic', () => {
    const built = buildSpecProcessAndViewJson({
      spec: {
        events: ['insert'],
        nodes: [
          { id: 'self', type: 'getSelf' },
          {
            type: 'route',
            branches: [
              {
                id: 'matched',
                condition: {
                  logic: 'OR',
                  rules: [
                    {
                      fieldId: '${self}.textField_a',
                      fieldName: 'A',
                      opCode: 'ExistValue',
                    },
                    {
                      fieldId: '${self}.textField_b',
                      fieldName: 'B',
                      opCode: 'ExistValue',
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
      processCode: 'LPROC-SPEC',
      appType: 'APP-SPEC',
      formUuid: 'FORM-A',
      flowName: 'Spec Flow',
    });

    const route = built.processJson.nodes.find((node) => node.type === 'route');
    expect(route.childNodes[0].props.conditions).toMatchObject({
      condition: 'OR',
      conditionCode: '||',
    });
    expect(route.childNodes[0].props.conditions.rules).toHaveLength(2);
  });

  test('does not use duplicate display names as node aliases', () => {
    const built = buildSpecProcessAndViewJson({
      spec: {
        events: ['insert'],
        nodes: [
          { type: 'sendMessage', name: 'Notify', content: 'first' },
          { type: 'sendMessage', name: 'Notify', content: 'second' },
        ],
      },
      processCode: 'LPROC-SPEC',
      appType: 'APP-SPEC',
      formUuid: 'FORM-A',
      flowName: 'Spec Flow',
    });

    const messages = built.processJson.nodes.filter((node) => node.type === 'sendMessage');
    expect(messages).toHaveLength(2);
    expect(messages[0].nodeId).not.toBe(messages[1].nodeId);
    expect(messages[0].nextId).toEqual([messages[1].nodeId]);
    expect(messages[0].nextId).not.toEqual([messages[0].nodeId]);
    expect(built.nodeIdMap).not.toHaveProperty('Notify');
  });

  test('rejects duplicate explicit node aliases', () => {
    expect(() => buildSpecProcessAndViewJson({
      spec: {
        events: ['insert'],
        nodes: [
          { id: 'notify', type: 'sendMessage', content: 'first' },
          { id: 'notify', type: 'sendMessage', content: 'second' },
        ],
      },
      processCode: 'LPROC-SPEC',
      appType: 'APP-SPEC',
      formUuid: 'FORM-A',
      flowName: 'Spec Flow',
    })).toThrow(/Duplicate integration spec node alias: notify/);
  });

  test('does not use duplicate route branch names as aliases', () => {
    const built = buildSpecProcessAndViewJson({
      spec: {
        events: ['insert'],
        nodes: [
          {
            type: 'route',
            branches: [
              {
                name: 'Matched',
                conditions: [{ fieldId: 'textField_a', opCode: 'ExistValue' }],
                nodes: [{ type: 'sendMessage', content: 'first' }],
              },
              {
                name: 'Matched',
                conditions: [{ fieldId: 'textField_b', opCode: 'ExistValue' }],
                nodes: [{ type: 'sendMessage', content: 'second' }],
              },
            ],
          },
        ],
      },
      processCode: 'LPROC-SPEC',
      appType: 'APP-SPEC',
      formUuid: 'FORM-A',
      flowName: 'Spec Flow',
    });

    const route = built.processJson.nodes.find((node) => node.type === 'route');
    expect(route.nextId).toHaveLength(3);
    expect(new Set(route.nextId).size).toBe(3);
    expect(route.nextId).not.toContain(undefined);
    expect(built.nodeIdMap).not.toHaveProperty('Matched');
  });

  test('resolves node references inside dataRetrieve conditions', () => {
    const built = buildSpecProcessAndViewJson({
      spec: {
        events: ['insert'],
        nodes: [
          { id: 'self', type: 'getSelf' },
          {
            id: 'lookup',
            type: 'dataRetrieve',
            formUuid: 'FORM-B',
            conditions: [
              {
                fieldId: 'textField_b',
                value: '${self}.textField_a',
              },
            ],
          },
        ],
      },
      processCode: 'LPROC-SPEC',
      appType: 'APP-SPEC',
      formUuid: 'FORM-A',
      flowName: 'Spec Flow',
    });

    const lookup = built.processJson.nodes.find((node) => node.nodeId === built.nodeIdMap.lookup);
    expect(lookup.props.condition.rules[0]).toMatchObject({
      id: 'textField_b',
      value: `\${${built.nodeIdMap.self}}.textField_a`,
    });
  });

  test('resolveNodeRefs replaces spec aliases only inside ${alias}', () => {
    const context = {
      aliasToNodeId: new Map([['self', 'node-self']]),
    };

    expect(_private.resolveNodeRefs('${self}.numberField_count+1', context)).toBe('${node-self}.numberField_count+1');
    expect(_private.resolveNodeRefs('literal-self', context)).toBe('literal-self');
  });

  test('readIntegrationSpec accepts UTF-8 BOM files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-integration-spec-'));
    const file = path.join(dir, 'flow.json');
    fs.writeFileSync(file, '\uFEFF{"nodes":[{"type":"getSelf"}]}', 'utf8');
    try {
      expect(readIntegrationSpec(file).nodes[0].type).toBe('getSelf');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
