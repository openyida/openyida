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
    expect(() => validateIntegrationSpec({ events: ['unknown'], nodes: [{ type: 'getSelf' }] })).toThrow(/Unsupported integration event/);
  });

  test('accepts route condition objects with explicit logic and adds a missing default branch', () => {
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
    expect(route.childNodes).toHaveLength(2);
    expect(route.childNodes[1].props).toMatchObject({
      isDefault: true,
      priority: 2147483647,
    });
    const routeView = built.viewJson.schema.children.find((node) => node.componentName === 'ConditionContainer');
    expect(routeView.children[1].props.isDefault).toBe(true);
    expect(routeView.children[1].props.priority).toBe(2147483647);
  });

  test('resolves declared upstream aliases inside sendMessage title and content', () => {
    const built = buildSpecProcessAndViewJson({
      spec: {
        events: ['insert'],
        nodes: [
          { id: 'self', type: 'getSelf' },
          {
            id: 'notify',
            type: 'sendMessage',
            receivers: ['user-1'],
            title: 'Record ${self}.pid',
            content: 'Status ${self}.textField_status',
          },
        ],
      },
      processCode: 'LPROC-SPEC',
      appType: 'APP-SPEC',
      formUuid: 'FORM-A',
      flowName: 'Spec Flow',
    });
    const processMessage = built.processJson.nodes.find((node) => node.type === 'sendMessage');
    const viewMessage = built.viewJson.schema.children.find((node) => node.componentName === 'SendMessageNode');

    expect(processMessage.props.messageInfo).toMatchObject({
      title: `Record \${${built.nodeIdMap.self}}.pid`,
      content: `Status \${${built.nodeIdMap.self}}.textField_status`,
    });
    expect(viewMessage.props.sendMessageRules.messageInfo).toMatchObject(
      processMessage.props.messageInfo
    );
  });

  test('does not use duplicate display names as node aliases', () => {
    const built = buildSpecProcessAndViewJson({
      spec: {
        events: ['insert'],
        nodes: [
          { type: 'sendMessage', name: 'Notify', receivers: ['user-1'], content: 'first' },
          { type: 'sendMessage', name: 'Notify', receivers: ['user-1'], content: 'second' },
        ],
      },
      processCode: 'LPROC-SPEC',
      appType: 'APP-SPEC',
      formUuid: 'FORM-A',
      flowName: 'Spec Flow',
    });

    const messages = built.processJson.nodes.filter((node) => node.type === 'sendMessage');
    expect(messages).toHaveLength(2);
    expect(messages[0].props.messageInfo.buttons[0].value).toBe('//yidalogin.aliwork.com/APP-SPEC/formDetail/FORM-A?formInstId=${formInstId}&isRenderNav=false');
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
          { id: 'notify', type: 'sendMessage', receivers: ['user-1'], content: 'first' },
          { id: 'notify', type: 'sendMessage', receivers: ['user-1'], content: 'second' },
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
                nodes: [{ type: 'sendMessage', receivers: ['user-1'], content: 'first' }],
              },
              {
                name: 'Matched',
                conditions: [{ fieldId: 'textField_b', opCode: 'ExistValue' }],
                nodes: [{ type: 'sendMessage', receivers: ['user-1'], content: 'second' }],
              },
              { id: 'fallback', name: 'Other', default: true },
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

  test('preserves dataRetrieve primitive literals in process and view JSON', () => {
    const built = buildSpecProcessAndViewJson({
      spec: {
        events: ['insert'],
        nodes: [{
          id: 'lookup',
          type: 'dataRetrieve',
          formUuid: 'FORM-B',
          conditions: [
            {
              fieldId: 'numberField_zero',
              aFieldId: 0,
              componentType: 'NumberField',
              opCode: 'Equal',
              valueType: 'literal',
            },
            {
              fieldId: 'checkboxField_false',
              value: false,
              componentType: 'CheckboxField',
              opCode: 'Equal',
              valueType: 'literal',
            },
            {
              fieldId: 'textField_empty',
              ruleValue: '',
              componentType: 'TextField',
              opCode: 'Equal',
              valueType: 'literal',
            },
          ],
        }],
      },
      processCode: 'LPROC-SPEC',
      appType: 'APP-SPEC',
      formUuid: 'FORM-A',
      flowName: 'Spec Flow',
    });
    const processRules = built.processJson.nodes.find((node) => node.type === 'dataRetrieve').props.condition.rules;
    const viewRules = built.viewJson.schema.children.find((node) => node.componentName === 'GetSingleDataNode')
      .props.getData.condition.rules;

    expect(processRules.map((rule) => rule.value)).toEqual([0, false, '']);
    expect(processRules.map((rule) => rule.ruleValue)).toEqual([0, false, '']);
    expect(viewRules.map((rule) => rule.value)).toEqual([0, false, '']);
    expect(viewRules.map((rule) => rule.ruleValue)).toEqual([0, false, '']);
  });

  test('rejects undeclared sendMessage messageInfo.content instead of silently using a default', () => {
    expect(() => validateIntegrationSpec({
      events: ['insert'],
      nodes: [{
        type: 'sendMessage',
        receivers: ['user-1'],
        messageInfo: { content: 'declared in an unsupported shape' },
      }],
    })).toThrow(/sendMessage node content is required/);
  });

  test('resolveNodeRefs replaces spec aliases only inside ${alias}', () => {
    const context = {
      aliasToNodeId: new Map([['self', 'node-self']]),
    };

    expect(_private.resolveNodeRefs('${self}.numberField_count+1', context)).toBe('${node-self}.numberField_count+1');
    expect(_private.resolveNodeRefs('literal-self', context)).toBe('literal-self');
  });

  test('rejects unresolved aliases, invalid assignments, and routes with multiple default branches', () => {
    const base = {
      processCode: 'LPROC-SPEC',
      appType: 'APP-SPEC',
      formUuid: 'FORM-A',
      flowName: 'Spec Flow',
    };

    expect(() => buildSpecProcessAndViewJson({
      ...base,
      spec: {
        events: ['insert'],
        nodes: [{
          type: 'dataUpdate',
          source: 'missingAlias',
          assignments: [{ column: 'textField_a', valueType: 'literal', value: 'x' }],
        }],
      },
    })).toThrow(/Unknown integration spec node alias: missingAlias/);

    expect(() => validateIntegrationSpec({
      events: ['insert'],
      nodes: [{
        type: 'dataCreate',
        formUuid: 'FORM-B',
        assignments: [{ valueType: 'literal', value: 'x' }],
      }],
    })).toThrow(/assignment column/);

    expect(() => validateIntegrationSpec({
      events: ['insert'],
      nodes: [{
        type: 'dataCreate',
        formUuid: 'FORM-B',
        assignments: [{ column: 'textField_a', valueType: 'unknown', value: 'x' }],
      }],
    })).toThrow(/assignment valueType/);

    expect(() => validateIntegrationSpec({
      events: ['insert'],
      nodes: [{
        type: 'dataCreate',
        formUuid: 'FORM-B',
        assignments: [{ column: 'textField_a', valueType: 'literal' }],
      }],
    })).toThrow(/assignment value/);

    expect(() => validateIntegrationSpec({
      events: ['insert'],
      nodes: [{ type: 'connector', connectorId: 'G-CONN-ONLY' }],
    })).toThrow(/connectorId and actionId/);

    expect(() => validateIntegrationSpec({
      events: ['insert'],
      nodes: [{ type: 'notADeclaredNode' }],
    })).toThrow(/Unsupported integration spec node type/);

    expect(() => validateIntegrationSpec({
      events: ['insert'],
      nodes: [{ type: 'route', branches: [{ id: 'a', default: true }, { id: 'b', default: true }] }],
    })).toThrow(/at most one default branch/);
  });

  test('preserves primitive literal types exactly in spec JSON', () => {
    const built = buildSpecProcessAndViewJson({
      spec: {
        events: ['insert'],
        nodes: [{
          id: 'create',
          type: 'dataCreate',
          formUuid: 'FORM-B',
          assignments: [
            { column: 'textField_code', valueType: 'literal', value: '00123' },
            { column: 'numberField_count', valueType: 'literal', value: 123 },
            { column: 'checkboxField_flag', valueType: 'literal', value: false },
          ],
        }],
      },
      processCode: 'LPROC-SPEC',
      appType: 'APP-SPEC',
      formUuid: 'FORM-A',
      flowName: 'Spec Flow',
      formSchemasByUuid: new Map([['FORM-B', [
        { componentName: 'TextField', props: { fieldId: 'textField_code' } },
        { componentName: 'NumberField', props: { fieldId: 'numberField_count' } },
        { componentName: 'CheckboxField', props: { fieldId: 'checkboxField_flag' } },
      ]]]),
    });
    const processValues = built.processJson.nodes.find((node) => node.type === 'dataCreate')
      .props.assignments.map((item) => item.value);
    const viewValues = built.viewJson.schema.children.find((node) => node.componentName === 'AddDataNode')
      .props.addDataRules.rules.rules.map((item) => item.value);

    expect(processValues).toEqual(['00123', 123, false]);
    expect(viewValues).toEqual(processValues);
  });

  test('serializes activityTask trigger semantics consistently in process and view JSON', () => {
    const built = buildSpecProcessAndViewJson({
      spec: {
        events: ['activityTask'],
        approvalActions: ['agree'],
        approvalNodeIds: ['activity-1'],
        nodes: [{ type: 'sendMessage', receivers: ['user-1'], content: 'done' }],
      },
      processCode: 'LPROC-SPEC',
      appType: 'APP-SPEC',
      formUuid: 'FORM-A',
      flowName: 'Spec Flow',
    });
    const processStart = built.processJson.nodes[0].props.inputs;
    const viewStart = built.viewJson.schema.children[0].props.start;

    expect(processStart).toMatchObject({
      formEventType: ['activityTask'],
      activityAction: ['agree'],
      activityId: ['activity-1'],
      activityTask: [{ activityId: ['activity-1'], activityAction: ['agree'] }],
    });
    expect(viewStart).toMatchObject({
      examineApproveType: 'activityTask',
      formEventType: ['processEvents'],
      examineApproveNode: 'activity-1',
      examineApproveActiveList: ['agree'],
      examineApproveActiveTask: [{ activityId: ['activity-1'], activityAction: ['agree'] }],
    });
  });

  test('documents recursive form-event triggering as default false', () => {
    const doc = fs.readFileSync(path.join(
      __dirname,
      '../yida-skills/skills/yida-integration/references/integration-node-schemas.md'
    ), 'utf8');
    expect(doc).toMatch(/triggerFormEventRecursively[^\n]*默认[^\n]*false/i);
    expect(doc).not.toMatch(/triggerFormEventRecursively[^\n]*固定[^\n]*true/i);
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
