'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { getLanguage, setLanguage } = require('../lib/core/i18n');

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
  collectDataSourceFormDescriptors,
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
      id: 'form_inst_id',
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

  test('rejects conflicting source form type declarations for one form UUID', () => {
    expect(() => collectDataSourceFormDescriptors({
      nodes: [
        { type: 'dataRetrieve', formUuid: 'FORM-B', formType: 'process' },
        { type: 'dataRetrieve', formUuid: 'FORM-B', formType: 'receipt' },
      ],
    }, 'FORM-A')).toThrow(/Conflicting source form types for FORM-B/);
  });

  test('rejects unsupported source form type declarations', () => {
    expect(() => collectDataSourceFormDescriptors({
      nodes: [{ type: 'dataRetrieve', formUuid: 'FORM-B', formType: 'display' }],
    }, 'FORM-A')).toThrow(/Unsupported source form type: display/);
  });

  test('does not treat sub_table originalType as a source form type', () => {
    expect(collectDataSourceFormDescriptors({
      nodes: [{
        type: 'dataRetrieve',
        formUuid: 'FORM-PROCESS',
        formType: 'process',
        originalType: 'sub_table',
      }],
    }, 'FORM-A')).toEqual([
      { formUuid: 'FORM-PROCESS', formType: 'process' },
    ]);
    expect(() => validateIntegrationSpec({
      events: ['insert'],
      nodes: [{
        type: 'dataRetrieve',
        formUuid: 'FORM-PROCESS',
        formType: 'process',
        originalType: 'sub_table',
        conditions: [{ fieldId: 'pid', value: 'x', valueType: 'literal' }],
      }],
    })).not.toThrow();
  });

  test('rejects conflicting source form metadata fields on one node', () => {
    expect(() => collectDataSourceFormDescriptors({
      nodes: [{
        type: 'dataRetrieve',
        formUuid: 'FORM-B',
        formType: 'process',
        originalType: 'form',
      }],
    }, 'FORM-A')).toThrow(/Conflicting source form types on node/);
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

  test.each([
    ['process', ['processFinish'], ['agree'], 'process_form', 'process', 'pid', 'proc_inst_id', '流程实例ID'],
    ['receipt', ['insert'], [], 'form', 'receipt', 'form_inst_id', 'form_inst_id', '表单实例ID'],
  ])('maps %s getSelf metadata for the designer', (name, events, approvalActions, originalType, formType, queryField, viewQueryField, queryFieldName) => {
    const built = buildSpecProcessAndViewJson({
      spec: {
        events,
        approvalActions,
        nodes: [{ id: 'self', type: 'getSelf' }],
      },
      processCode: `LPROC-${name.toUpperCase()}`,
      appType: 'APP-SPEC',
      formUuid: `FORM-${name.toUpperCase()}`,
      flowName: `${name} flow`,
      dataFormType: formType,
      dataFormName: `${name} source form`,
    });
    const processNode = built.processJson.nodes.find((node) => node.nodeId === built.nodeIdMap.self);
    const viewNode = built.viewJson.schema.children.find((node) => node.id === built.nodeIdMap.self);
    expect(processNode.props).toMatchObject({
      originalType,
      condition: { rules: [{ id: queryField, name: queryFieldName }] },
    });
    expect(viewNode.props.getData).toMatchObject({
      originalType,
      condition: { rules: [{ id: viewQueryField, name: queryFieldName }] },
      targetItem: { formItem: { formType } },
    });
    expect(viewNode.props.getData.targetItem.formItem.title).toBe(`${name} source form`);
  });

  test('converts explicit getSelf queryField pid to designer proc_inst_id', () => {
    const built = buildSpecProcessAndViewJson({
      spec: {
        events: ['processFinish'],
        approvalActions: ['agree'],
        nodes: [{ id: 'self', type: 'getSelf', queryField: 'pid' }],
      },
      processCode: 'LPROC-PROCESS-QUERY',
      appType: 'APP-SPEC',
      formUuid: 'FORM-PROCESS',
      flowName: 'explicit pid getSelf',
      dataFormType: 'process',
      dataFormName: '流程来源表单',
    });
    const processNode = built.processJson.nodes.find((node) => node.nodeId === built.nodeIdMap.self);
    const viewNode = built.viewJson.schema.children.find((node) => node.id === built.nodeIdMap.self);
    expect(processNode.props.condition.rules.map((rule) => rule.id)).toEqual(['pid']);
    expect(viewNode.props.getData.condition.rules.map((rule) => rule.id)).toEqual(['proc_inst_id']);
  });

  test('converts explicit getSelf queryField proc_inst_id to runtime pid', () => {
    const built = buildSpecProcessAndViewJson({
      spec: {
        events: ['processFinish'],
        approvalActions: ['agree'],
        nodes: [{ id: 'self', type: 'getSelf', queryField: 'proc_inst_id' }],
      },
      processCode: 'LPROC-PROCESS-QUERY-DESIGNER',
      appType: 'APP-SPEC',
      formUuid: 'FORM-PROCESS',
      flowName: 'explicit proc_inst_id getSelf',
      dataFormType: 'process',
      dataFormName: '流程来源表单',
    });
    const processNode = built.processJson.nodes.find((node) => node.nodeId === built.nodeIdMap.self);
    const viewNode = built.viewJson.schema.children.find((node) => node.id === built.nodeIdMap.self);
    expect(processNode.props.condition.rules).toMatchObject([
      { id: 'pid', name: '流程实例ID' },
    ]);
    expect(viewNode.props.getData.condition.rules).toMatchObject([
      { id: 'proc_inst_id', name: '流程实例ID' },
    ]);
  });

  test('does not infer a process source from insert/update events', () => {
    const built = buildSpecProcessAndViewJson({
      spec: {
        events: ['insert', 'update'],
        nodes: [{ id: 'self', type: 'getSelf' }],
      },
      processCode: 'LPROC-PROCESS-INSERT',
      appType: 'APP-SPEC',
      formUuid: 'FORM-PROCESS',
      flowName: 'process insert flow',
      dataSourceFormsByUuid: new Map([
        ['FORM-PROCESS', { formUuid: 'FORM-PROCESS', formName: '流程来源表单', formType: 'process' }],
      ]),
    });
    const processNode = built.processJson.nodes.find((node) => node.nodeId === built.nodeIdMap.self);
    const viewNode = built.viewJson.schema.children.find((node) => node.id === built.nodeIdMap.self);
    expect(processNode.props).toMatchObject({
      originalType: 'process_form',
      condition: { rules: [{ id: 'pid', name: '流程实例ID' }] },
    });
    expect(viewNode.props.getData).toMatchObject({
      originalType: 'process_form',
      condition: { rules: [{ id: 'proc_inst_id', name: '流程实例ID' }] },
      targetItem: { formItem: { formType: 'process', title: '流程来源表单' } },
    });
  });

  test('converts process dataRetrieve pid conditions for the designer only', () => {
    const built = buildSpecProcessAndViewJson({
      spec: {
        events: ['insert'],
        nodes: [{
          id: 'lookup',
          type: 'dataRetrieve',
          formUuid: 'FORM-PROCESS',
          conditions: [
            { fieldId: 'pid', fieldName: '流程实例ID', value: 'A-1', opCode: 'Equal' },
            { fieldId: 'textField_code', fieldName: '业务编码', value: 'B-1', valueType: 'literal', opCode: 'Equal' },
          ],
        }],
      },
      processCode: 'LPROC-PROCESS-DATA',
      appType: 'APP-SPEC',
      formUuid: 'FORM-A',
      flowName: 'Process data retrieve flow',
      dataSourceFormsByUuid: new Map([
        ['FORM-PROCESS', { formUuid: 'FORM-PROCESS', formName: '流程来源表单', formType: 'process' }],
      ]),
    });
    const processNode = built.processJson.nodes.find((node) => node.nodeId === built.nodeIdMap.lookup);
    const viewNode = built.viewJson.schema.children.find((node) => node.id === built.nodeIdMap.lookup);
    expect(processNode.props.condition.rules.map((rule) => rule.id)).toEqual(['pid', 'textField_code']);
    expect(viewNode.props.getData.condition.rules.map((rule) => rule.id)).toEqual(['proc_inst_id', 'textField_code']);
  });

  test('converts process dataRetrieve proc_inst_id conditions to runtime pid', () => {
    const built = buildSpecProcessAndViewJson({
      spec: {
        events: ['insert'],
        nodes: [{
          id: 'lookup',
          type: 'dataRetrieve',
          formUuid: 'FORM-PROCESS',
          conditions: [
            { fieldId: 'proc_inst_id', fieldName: '流程实例ID', value: 'A-1', opCode: 'Equal' },
            { fieldId: 'textField_code', fieldName: '业务编码', value: 'B-1', valueType: 'literal', opCode: 'Equal' },
          ],
        }],
      },
      processCode: 'LPROC-PROCESS-DATA-DESIGNER',
      appType: 'APP-SPEC',
      formUuid: 'FORM-A',
      flowName: 'Process data retrieve designer field flow',
      dataSourceFormsByUuid: new Map([
        ['FORM-PROCESS', { formUuid: 'FORM-PROCESS', formName: '流程来源表单', formType: 'process' }],
      ]),
    });
    const processNode = built.processJson.nodes.find((node) => node.nodeId === built.nodeIdMap.lookup);
    const viewNode = built.viewJson.schema.children.find((node) => node.id === built.nodeIdMap.lookup);
    expect(processNode.props.condition.rules.map((rule) => rule.id)).toEqual(['pid', 'textField_code']);
    expect(viewNode.props.getData.condition.rules.map((rule) => rule.id)).toEqual(['proc_inst_id', 'textField_code']);
  });

  test('normalizes process dataRetrieve pid condition names in process and designer json', () => {
    const built = buildSpecProcessAndViewJson({
      spec: {
        events: ['insert'],
        nodes: [{
          id: 'lookup',
          type: 'dataRetrieve',
          formUuid: 'FORM-PROCESS',
          conditions: [
            { fieldId: 'pid', fieldName: '旧字段名称', value: 'A-1', opCode: 'Equal' },
          ],
        }],
      },
      processCode: 'LPROC-PROCESS-DATA-NAME',
      appType: 'APP-SPEC',
      formUuid: 'FORM-A',
      flowName: 'Process data retrieve field name flow',
      dataSourceFormsByUuid: new Map([
        ['FORM-PROCESS', { formUuid: 'FORM-PROCESS', formName: '流程来源表单', formType: 'process' }],
      ]),
    });
    const processNode = built.processJson.nodes.find((node) => node.nodeId === built.nodeIdMap.lookup);
    const viewNode = built.viewJson.schema.children.find((node) => node.id === built.nodeIdMap.lookup);
    expect(processNode.props.condition.rules).toMatchObject([
      { id: 'pid', name: '流程实例ID' },
    ]);
    expect(viewNode.props.getData.condition.rules).toMatchObject([
      { id: 'proc_inst_id', name: '流程实例ID' },
    ]);
  });

  test('uses verified source form name over a stale spec formName', () => {
    const built = buildSpecProcessAndViewJson({
      spec: {
        events: ['insert'],
        nodes: [{
          id: 'lookup',
          type: 'dataRetrieve',
          formUuid: 'FORM-B',
          formName: '过期名称',
          conditions: [{ fieldId: 'textField_marker', fieldName: '标记', value: 'x', valueType: 'literal' }],
        }],
      },
      processCode: 'LPROC-FORM-NAME',
      appType: 'APP-SPEC',
      formUuid: 'FORM-A',
      flowName: 'Source form name flow',
      dataSourceFormsByUuid: new Map([
        ['FORM-B', { formUuid: 'FORM-B', formName: '导航真实名称', formType: 'receipt' }],
      ]),
    });
    const viewNode = built.viewJson.schema.children.find((node) => node.id === built.nodeIdMap.lookup);
    expect(viewNode.props.getData.targetItem.formItem.title).toBe('导航真实名称');
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

  test('resolves __source references on update assignments', () => {
    const built = buildSpecProcessAndViewJson({
      spec: {
        events: ['insert'],
        nodes: [
          {
            id: 'lookup',
            type: 'dataRetrieve',
            formUuid: 'FORM-B',
            conditions: [{ fieldId: 'textField_marker', fieldName: '标记', value: 'x', valueType: 'literal' }],
          },
          {
            id: 'update',
            type: 'dataUpdate',
            source: 'lookup',
            assignments: [{
              column: 'numberField_total',
              valueType: 'column',
              value: '${lookup}.numberField_total+1',
              __source: '#{lookup//numberField_total}+1',
              __display: '获取单条数据.总数+1',
            }],
          },
        ],
      },
      processCode: 'LPROC-SOURCE',
      appType: 'APP-SPEC',
      formUuid: 'FORM-A',
      flowName: 'Formula source flow',
    });

    const updateNode = built.processJson.nodes.find((node) => node.nodeId === built.nodeIdMap.update);
    const updateViewNode = built.viewJson.schema.children.find((node) => node.id === built.nodeIdMap.update);
    const expectedAssignment = {
      value: `\${${built.nodeIdMap.lookup}}.numberField_total+1`,
      __source: `#{${built.nodeIdMap.lookup}//numberField_total}+1`,
      __display: '获取单条数据.总数+1',
    };
    expect(updateNode.props.assignments[0]).toMatchObject(expectedAssignment);
    expect(updateViewNode.props.updateDataRules.assignments[0]).toMatchObject(expectedAssignment);
  });

  test('preserves registered node IDs in __source references', () => {
    const built = buildSpecProcessAndViewJson({
      spec: {
        events: ['insert'],
        nodes: [
          {
            id: 'lookup',
            nodeId: 'node-fixed',
            type: 'dataRetrieve',
            formUuid: 'FORM-B',
            conditions: [{ fieldId: 'textField_marker', fieldName: '标记', value: 'x', valueType: 'literal' }],
          },
          {
            id: 'update',
            nodeId: 'node-update',
            type: 'dataUpdate',
            source: 'lookup',
            assignments: [{
              column: 'numberField_total',
              valueType: 'column',
              value: '${lookup}.numberField_total+1',
              __source: '#{node-fixed//numberField_total}+1',
            }],
          },
        ],
      },
      processCode: 'LPROC-SOURCE-ID',
      appType: 'APP-SPEC',
      formUuid: 'FORM-A',
      flowName: 'Formula source node ID flow',
    });

    const expectedSource = '#{node-fixed//numberField_total}+1';
    const updateNode = built.processJson.nodes.find((node) => node.nodeId === 'node-update');
    const updateViewNode = built.viewJson.schema.children.find((node) => node.id === 'node-update');
    expect(updateNode.props.assignments[0].__source).toBe(expectedSource);
    expect(updateViewNode.props.updateDataRules.assignments[0].__source).toBe(expectedSource);
  });

  test.each(['node_typo', 'node-missing'])('rejects unregistered designer source node ID %s', (nodeId) => {
    expect(() => buildSpecProcessAndViewJson({
      spec: {
        events: ['insert'],
        nodes: [
          {
            id: 'lookup',
            type: 'dataRetrieve',
            formUuid: 'FORM-B',
            conditions: [{ fieldId: 'textField_marker', fieldName: '标记', value: 'x', valueType: 'literal' }],
          },
          {
            id: 'update',
            type: 'dataUpdate',
            source: 'lookup',
            assignments: [{
              column: 'numberField_total',
              valueType: 'column',
              value: '${lookup}.numberField_total+1',
              __source: `#{${nodeId}//numberField_total}+1`,
            }],
          },
        ],
      },
      processCode: 'LPROC-SOURCE-INVALID',
      appType: 'APP-SPEC',
      formUuid: 'FORM-A',
      flowName: 'Invalid formula source flow',
    })).toThrow(`Unknown integration spec node alias: ${nodeId}`);
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

    expect(() => validateIntegrationSpec({
      events: ['insert'],
      nodes: [{ type: 'route', branches: [] }],
    })).toThrow(/branches/);

    expect(() => validateIntegrationSpec({
      events: ['insert'],
      nodes: [{
        type: 'initiateApproval',
        formUuid: 'FORM-PROCESS',
        initiator: { type: 'select_user', value: 'not-json' },
        assignments: [{ column: 'textField_title', valueType: 'literal', value: 'x' }],
      }],
    })).toThrow(/身份 JSON|employee identity JSON/);
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
    const viewAssignments = built.viewJson.schema.children.find((node) => node.componentName === 'AddDataNode')
      .props.addDataRules.assignments.map((item) => item.value);

    expect(processValues).toEqual(['00123', 123, false]);
    expect(viewValues).toEqual(processValues);
    expect(viewAssignments).toEqual(processValues);
  });

  test('hydrates visible form names and configured summaries for getSelf, dataCreate and message nodes', () => {
    const built = buildSpecProcessAndViewJson({
      spec: {
        events: ['insert'],
        nodes: [
          { type: 'getSelf', id: 'self', name: '读取当前申请' },
          {
            type: 'dataCreate',
            id: 'create',
            name: '登记回执',
            formUuid: 'FORM-B',
            assignments: [{ fieldId: 'textField_code', valueType: 'literal', value: 'R-1' }],
          },
          {
            type: 'sendMessage',
            name: '发送通知',
            userFields: ['form_inst_creator'],
            title: '已登记',
            content: '完成',
          },
        ],
      },
      processCode: 'LPROC-SPEC',
      appType: 'APP-SPEC',
      formUuid: 'FORM-A',
      flowName: 'Spec Flow',
      formNamesByUuid: new Map([
        ['FORM-A', '变更申请'],
        ['FORM-B', '执行回执'],
      ]),
      formSchemasByUuid: new Map([['FORM-B', [
        { componentName: 'TextField', props: { fieldId: 'textField_code', label: { zh_CN: '回执编号' } } },
      ]]]),
    });
    const viewNodes = built.viewJson.schema.children;
    const getSelf = viewNodes.find((node) => node.componentName === 'GetSingleDataNode');
    const create = viewNodes.find((node) => node.componentName === 'AddDataNode');
    const message = viewNodes.find((node) => node.componentName === 'SendMessageNode');

    expect(getSelf.props.description).toContain('变更申请');
    expect(getSelf.props.getData.targetItem.formItem.title).toBe('变更申请');
    expect(create.props.description).toContain('执行回执');
    expect(create.props.addDataRules.assignments).toHaveLength(1);
    expect(create.props.addDataRules.description).toBe(create.props.description);
    expect(message.props.description).toContain('已配置通知');
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

  test.each([
    [{ type: 'dataRetrieve', formUuid: 'FORM-B', conditions: [] }, /conditions/],
    [{ type: 'dataCreate', formUuid: 'FORM-B', assignments: [] }, /assignments/],
    [{ type: 'dataUpdate', source: 'self', assignments: [] }, /assignments/],
  ])('rejects semantically empty data nodes before building platform JSON', (node, errorPattern) => {
    expect(() => validateIntegrationSpec({ events: ['insert'], nodes: [node] }))
      .toThrow(errorPattern);
  });

  test('builds a configured initiateApproval node using the authenticated current user without persisting an id in spec', () => {
    const originalLanguage = getLanguage();
    setLanguage('zh');
    try {
      const built = buildSpecProcessAndViewJson({
        spec: {
          events: ['insert'],
          nodes: [{
            id: 'approval',
            type: 'initiateApproval',
            formUuid: 'FORM-PROCESS',
            initiator: { type: 'current_user' },
            assignments: [{ column: 'textField_title', valueType: 'literal', value: '重大变更审批' }],
          }],
        },
        processCode: 'LPROC-SPEC',
        appType: 'APP-SPEC',
        formUuid: 'FORM-A',
        flowName: 'Spec Flow',
        currentUserId: 'user-current',
        formNamesByUuid: new Map([['FORM-PROCESS', '重大变更审批流程']]),
        formSchemasByUuid: new Map([['FORM-PROCESS', [
          { componentName: 'TextField', props: { fieldId: 'textField_title', label: '审批标题' } },
        ]]]),
      });
      const processNode = built.processJson.nodes.find((node) => node.type === 'initiateApproval');
      const viewNode = built.viewJson.schema.children.find((node) => node.componentName === 'InitiateApprovalNode');

      expect(processNode.description).toBe('在[重大变更审批流程]中发起审批并写入1个字段');
      expect(processNode.props.initiator).toEqual({
        type: 'select_user',
        value: JSON.stringify({ id: 'user-current', label: '', type: 'employee' }),
      });
      expect(viewNode.props.description).toBe(processNode.description);
      expect(viewNode.props.initiateApprovalRules.assignments).toEqual([
        { column: 'textField_title', valueType: 'literal', value: '重大变更审批', required: false },
      ]);
    } finally {
      setLanguage(originalLanguage);
    }
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
