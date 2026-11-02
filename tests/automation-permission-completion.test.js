'use strict';

const { compilePermissionConditions } = require('../lib/permission/permission-conditions');
const { validateTriggerSpec, scheduleNodes } = require('../lib/integration/integration-triggers');
const { validateIntegrationSpec, buildSpecProcessAndViewJson } = require('../lib/integration/integration-spec-builder');
const { _private: compiler } = require('../lib/process/configure-process');
const { applyPatch } = require('../lib/integration/integration-update');
const { parseArgs } = require('../lib/permission/save-permission');

const fs = require('fs');
const path = require('path');

function documentedExamples(relativePath, section, select = example => Array.isArray(example.nodes) || !!example.schedule) {
  let markdown = fs.readFileSync(path.join(__dirname, '..', 'yida-skills/skills', relativePath), 'utf8');
  if (section) { markdown = markdown.split(section)[1].split(/\n#{1,3} /)[0]; }
  const replacements = {
    '<真实来源表单ID>': 'FORM_SOURCE', '<真实表单ID>': 'FORM_SOURCE',
    '<真实目标表单ID>': 'FORM_TARGET', '<真实目标formUuid>': 'FORM_TARGET',
    '<真实源编号字段ID>': 'sourceCode', '<真实目标编号字段ID>': 'targetCode',
    '<真实源金额字段ID>': 'amount', '<真实目标金额字段ID>': 'targetAmount',
    '<真实金额字段ID>': 'amount', '<真实优先级字段ID>': 'priority',
    '<目标库存字段ID>': 'stock', '<上游库存下限字段ID>': 'minStock',
    '<真实字段ID>': 'name', '<真实成员字段ID>': 'owner', '<真实部门字段ID>': 'dept',
    '<真实数字字段ID>': 'amount', '<真实角色ID>': 'ROLE_REAL',
    '<真实办理人ID>': 'USER_REAL', '<真实抄送人ID>': 'USER_REAL',
  };
  return [...markdown.matchAll(/```json\n([\s\S]*?)\n```/g)].map(match => JSON.parse(match[1])).filter(select).map(example => {
    const json = JSON.stringify(example).replace(/<[^>]+>/g, placeholder => {
      if (!replacements[placeholder]) { throw new Error(`Unmapped documented placeholder: ${placeholder}`); }
      return replacements[placeholder];
    });
    return JSON.parse(json);
  });
}

const fields = [
  { fieldId: 'owner', componentName: 'EmployeeField', label: '负责人' },
  { fieldId: 'dept', componentName: 'DepartmentSelectField', label: '部门' },
  { fieldId: 'amount', componentName: 'NumberField', label: '金额' },
  { fieldId: 'name', componentName: 'TextField', label: '编号' },
];
const condition = { logic: 'OR', rules: [
  { field: 'owner', op: 'contain', variable: 'currentUser' },
  { logic: 'AND', rules: [{ field: 'dept', op: 'belong', variable: 'currentDepartments' },
    { field: 'amount', op: 'gte', value: 0 }] },
] };
const options = { appType: 'APP', formUuid: 'FORM', processCode: 'PROC', flowName: 'test',
  formSchemasByUuid: new Map([['FORM', fields.map(field => ({ componentName: field.componentName,
    props: { fieldId: field.fieldId, label: field.label } }))]]) };

describe('permission condition tree', () => {
  test('retains nested AND/OR and contextual identity, including numeric zero', () => {
    const compiled = compilePermissionConditions(condition, fields);
    expect(compiled.dataRange).toBe('FORMULA');
    expect(compiled.formulaData.condition).toBe('OR');
    expect(compiled.formulaData.rules[0].value).toBe('${loginUser}');
    const subgroup = compiled.formulaData.rules[1];
    expect(subgroup.condition).toBe('AND');
    expect(subgroup.rules[0].value).toBe('${departments}');
    expect(subgroup.rules[1]).toMatchObject({ value: 0, op: 'gte', parentId: subgroup.ruleId });
  });
  test.each([
    { logic: 'XOR', rules: condition.rules }, { logic: 'AND', rules: [] },
    { logic: 'OR', rules: [{ field: 'missing', op: 'eq', value: 1 }] },
    { logic: 'OR', rules: [{ field: 'amount', op: 'like', value: 1 }] },
    { logic: 'OR', rules: [{ field: 'amount', op: 'gte', value: '0' }] },
    { logic: 'OR', rules: [{ field: 'name', op: 'eq', variable: 'currentUser' }] },
    { logic: 'OR', rules: [{ field: 'owner', op: 'contain', value: '${loginUser}' }] },
    { logic: 'OR', rules: [{ field: 'name', op: 'notnull' }] },
  ])('rejects unsupported or ambiguous rules %#', input => {
    expect(() => compilePermissionConditions(input, fields)).toThrow();
  });
  test('rejects implicit target when using conditions on an existing group', () => {
    const fs = require('fs');
    jest.spyOn(fs, 'readFileSync').mockReturnValueOnce(JSON.stringify(condition));
    expect(() => parseArgs(['APP', 'FORM', '--conditions-file', 'conditions.json'])).toThrow();
    fs.readFileSync.mockRestore();
  });
});

describe('complete configuration examples in skills', () => {
  const sourceFields = [...fields, { fieldId: 'sourceCode', componentName: 'TextField', label: '来源编号' },
    { fieldId: 'minStock', componentName: 'NumberField', label: '库存下限' },
    { fieldId: 'priority', componentName: 'SelectField', label: '优先级' }];
  const targetFields = [
    { fieldId: 'targetCode', componentName: 'TextField', label: '目标编号' },
    { fieldId: 'targetAmount', componentName: 'NumberField', label: '目标金额' },
    { fieldId: 'stock', componentName: 'NumberField', label: '库存' },
  ];
  const schema = list => list.map(field => ({ componentName: field.componentName,
    props: { fieldId: field.fieldId, label: field.label } }));
  const docOptions = { appType: 'APP', formUuid: 'FORM_SOURCE', processCode: 'PROC', flowName: 'documented example',
    formSchemasByUuid: new Map([['FORM_SOURCE', schema(sourceFields)], ['FORM_TARGET', schema(targetFields)]]) };

  test.each([
    ['yida-flow-node-config/references/control.md', undefined, 2],
    ['yida-integration/references/triggers.md', undefined, 4],
    ['yida-flow-node-config/references/conditions-variables.md', '### 获取数据节点：按条件过滤 → 字段', 1],
  ])('%s complete automation examples compile using actual documented JSON', (file, section, count) => {
    const examples = documentedExamples(file, section);
    expect(examples).toHaveLength(count);
    for (const spec of examples) {
      validateIntegrationSpec(spec, ['insert'], { triggerFields: sourceFields });
      const built = buildSpecProcessAndViewJson({ ...docOptions, spec });
      expect(built.processJson.nodes.at(-1).type).toBe('finish');
      if (spec.nodes.some(node => node.type === 'parallel')) {
        const fork = built.processJson.nodes.find(node => node.type === 'route');
        expect(fork.childNodes.every(branch => branch.props.calculate === 'all' && !branch.props.isDefault)).toBe(true);
      }
      if (spec.nodes.some(node => node.type === 'cycle')) {
        const loop = built.processJson.nodes.find(node => node.type === 'foreach');
        const body = loop.childNodes[0];
        expect(body.type).toBe('dataCreate');
        expect(body.props.assignments).toHaveLength(2);
        expect(JSON.stringify(body.props.assignments)).toContain(loop.nodeId);
        expect(JSON.stringify(body.props.assignments)).not.toContain('${loop}');
      }
    }
  });

  test('approval, operator and carbon recipes compile their own actors and conditional modes', () => {
    const examples = documentedExamples('yida-flow-node-config/references/actors.md');
    expect(examples).toHaveLength(2);
    const built = examples.map(spec => compiler.buildProcessAndViewJson(spec, 'PROC', 'FORM_SOURCE', 'https://example.com', 'APP'));
    const conditional = built[0].processJson.nodes.filter(node => node.approvalType === 'ext_target_approval_condition');
    expect(conditional).toHaveLength(3);
    const carbon = conditional.find(node => node.type === 'carbon');
    expect(carbon.props.approvals.every(rule => rule.props.params.some(param => param.key === 'receiver' && param.value))).toBe(true);
    const parallel = built[1].processJson.nodes.find(node => node.approvalType === 'ext_target_approval_condition');
    expect(parallel.props.conditionalMode).toBe('parallel_conditional');
    expect(parallel.props.approvals.every(rule => rule.conditions)).toBe(true);
  });

  test('nested permission example retains current-user and current-department semantics', () => {
    const examples = documentedExamples('yida-form-permission/references/row-field-access.md', undefined,
      example => example.logic && example.rules);
    expect(examples).toHaveLength(1);
    const result = compilePermissionConditions(examples[0], sourceFields);
    expect(result.formulaData.condition).toBe('OR');
    expect(result.formulaData.rules[0].value).toBe('${loginUser}');
    expect(result.formulaData.rules[1].rules[0].value).toBe('${departments}');
    expect(result.formulaData.rules[1].rules[1].value).toBe(0);
  });
});

describe('native trigger protocol', () => {
  test.each(['ONCE', 'DAILY', 'WORKDAY', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'LAST_DAY_PER_MONTH'])(
    'compiles %s into both native definitions', repeat => {
      const end = repeat === 'ONCE' ? {} : { maxCount: 3 };
      const result = scheduleNodes({ startDate: '2026-10-20 09:30:00', repeat, ...end }, 'start', 'end');
      expect(result.processNode.props).toEqual({ triggerType: 'TimerEvent',
        inputs: { startDate: Date.parse('2026-10-20T09:30:00+08:00'), repeat: { type: repeat },
          ...(repeat === 'ONCE' ? {} : { end }) } });
      expect(result.viewNode.props.start).toMatchObject({ type: 'trigger', repeatRuleType: repeat,
        overTimeType: 'count', overCount: repeat === 'ONCE' ? 1 : 3 });
    });
  test.each(['DAILY', 'WORKDAY', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'LAST_DAY_PER_MONTH'])(
    'requires an explicit end condition for %s', repeat => {
      expect(() => scheduleNodes({ startDate: '2026-10-20 09:30:00', repeat }, 'start', 'end'))
        .toThrow(/maxCount.*expireDate/);
    });
  test.each([1, 100])('keeps count termination consistent for %i runs', maxCount => {
    const result = scheduleNodes({ startDate: '2026-10-20 09:30:00', repeat: 'DAILY', maxCount }, 'start', 'end');
    expect(result.processNode.props.inputs.end).toEqual({ maxCount });
    expect(result.viewNode.props.start).toMatchObject({ overTimeType: 'count', overCount: maxCount });
    expect(result.viewNode.props.start).not.toHaveProperty('overTime');
  });
  test('keeps a user-selected distant expiry consistent across both definitions', () => {
    const expireDate = Date.parse('2036-10-20T09:30:00+08:00');
    const result = scheduleNodes({ startDate: '2026-10-20 09:30:00', repeat: 'DAILY', expireDate }, 'start', 'end');
    expect(result.processNode.props.inputs.end).toEqual({ expireDate });
    expect(result.viewNode.props.start).toMatchObject({ overTimeType: 'time', overTime: expireDate });
    expect(result.viewNode.props.start).not.toHaveProperty('overCount');
  });
  test('schedule creates a timer graph without form-event state', () => {
    const spec = { schedule: { startDate: '2026-10-20 09:30:00', repeat: 'DAILY', maxCount: 3 },
      nodes: [{ id: 'read', type: 'dataRetrieve', formUuid: 'FORM', filterType: 'all' }] };
    validateIntegrationSpec(spec);
    const built = buildSpecProcessAndViewJson({ ...options, spec });
    expect(built.processJson.nodes[0].props.inputs).toHaveProperty('end.maxCount', 3);
    expect(built.processJson.nodes[0].props.inputs).not.toHaveProperty('formEventType');
  });
  test.each([
    { schedule: { startDate: 'bad' } },
    { schedule: { startDate: '2026-10-20 09:30:00', repeat: 'DAILY', maxCount: 101 } },
    { schedule: { startDate: '2026-10-20 09:30:00', repeat: 'DAILY', maxCount: 0 } },
    { schedule: { startDate: '2026-10-20 09:30:00', repeat: 'DAILY', maxCount: 1.5 } },
    { schedule: { startDate: '2026-10-20 09:30:00', repeat: 'DAILY', maxCount: 3, expireDate: Date.parse('2036-10-20T09:30:00+08:00') } },
    { schedule: { startDate: '2026-10-20 09:30:00', repeat: 'ONCE', maxCount: 1 } },
    { schedule: { startDate: '2026-10-20 09:30:00' }, events: ['insert'] },
    { events: ['targetField'] }, { events: ['update'], changedFields: [] },
    { events: ['insert'], changedFields: ['name'] },
    { events: ['update'], changedFields: ['name', 'name'] },
  ])('rejects invalid trigger before mutation %#', spec => expect(() => validateTriggerSpec(spec)).toThrow());
  test('field changes compile to targetField, independently of value comparisons', () => {
    const spec = { events: ['update'], changedFields: ['name'], nodes: [{ type: 'getSelf' }] };
    validateTriggerSpec(spec, fields);
    const built = buildSpecProcessAndViewJson({ ...options, spec });
    expect(built.processJson.nodes[0].props.inputs).toMatchObject({ formEventType: ['targetField'], formEventField: 'name' });
    expect(built.viewJson.schema.children[0].props.start.formEventField).toBe('name');
    expect(() => validateTriggerSpec({ ...spec, changedFields: ['unknown'] }, fields)).toThrow();
  });
});

describe('parallel and loop graph integrity', () => {
  test('parallel uses multiple outgoing branches with an explicit common successor', () => {
    const spec = { nodes: [{ id: 'fork', type: 'parallel', branches: [
      { id: 'a', all: true, nodes: [{ id: 'aa', type: 'getSelf' }] },
      { id: 'b', all: true, nodes: [{ id: 'bb', type: 'getSelf' }] },
    ] }, { id: 'join', type: 'getSelf' }] };
    validateIntegrationSpec(spec);
    const built = buildSpecProcessAndViewJson({ ...options, spec });
    const fork = built.processJson.nodes[1];
    expect(fork.props.outgoingType).toBe('multiple');
    expect(fork.childNodes).toHaveLength(2);
    fork.childNodes.forEach(branch => expect(branch.props).toMatchObject({ isDefault: false, calculate: 'all' }));
    built.viewJson.schema.children[1].children.forEach(branch =>
      expect(branch.props.conditions).toMatchObject({ isDefault: false, calculate: 'all' }));
    fork.childNodes.forEach(branch => expect(branch.childNodes[0].nextId).toEqual([built.nodeIdMap.join]));
    expect(built.viewJson.schema.children[1].type).toBe('parallel');
  });
  test('rejects multiple fallbacks and contradictory unconditional branches', () => {
    const parallel = branches => ({ nodes: [{ type: 'parallel', branches }] });
    expect(() => validateIntegrationSpec(parallel([{ default: true }, { default: true }]))).toThrow('fallback');
    expect(() => validateIntegrationSpec(parallel([{ all: true, default: true }, { all: true }]))).toThrow('all:true');
    expect(() => validateIntegrationSpec(parallel([{ all: true, conditions: [{}] }, { all: true }]))).toThrow('all:true');
  });
  test('loop body returns to its container and exits to the successor', () => {
    const spec = { nodes: [{ id: 'rows', type: 'dataRetrieve', retrieveType: 'batch', quantity: 10, formUuid: 'FORM', filterType: 'all' },
      { id: 'loop', type: 'cycle', source: 'rows', nodes: [{ id: 'body', type: 'getSelf' }] },
      { id: 'after', type: 'getSelf' }] };
    validateIntegrationSpec(spec);
    const built = buildSpecProcessAndViewJson({ ...options, spec });
    const loop = built.processJson.nodes[2];
    expect(loop.type).toBe('foreach');
    expect(loop.nextId).toEqual([built.nodeIdMap.body, built.nodeIdMap.after]);
    expect(loop.childNodes[0].nextId).toEqual([loop.nodeId]);
    expect(loop.jumpId).toBe(built.nodeIdMap.after);
    expect(loop.props.sourceId).toBe(built.nodeIdMap.rows);
  });
});

describe('conditional human actors', () => {
  test.each(['approval', 'operator', 'carbon'])('%s compiles priority, actors and fallback on both sides', type => {
    const actor = { kind: 'conditional', cases: [
      { when: { logic: 'AND', rules: [{ fieldId: 'amount', componentType: 'NumberField', op: 'GreaterThan', value: 0 }] },
        actor: { kind: 'role', roles: [{ id: 'ROLE_REAL', name: 'Finance' }] } },
      { actor: { kind: 'user', users: [{ id: 'USER_REAL', name: 'User' }] } },
    ] };
    const def = { nodes: [{ type, name: 'review', approver: actor, executor: actor, receiver: actor }] };
    const built = compiler.buildProcessAndViewJson(def, 'PROC', 'FORM', 'https://example.com', 'APP');
    const node = built.processJson.nodes.find(item => item.approvalType === 'ext_target_approval_condition');
    expect(node.props.approvals).toHaveLength(2);
    expect(node.props.approvals[0]).toMatchObject({ priority: 1, approvalType: 'ext_target_approval_role' });
    expect(node.props.approvals[0].conditions.rules[0]).toMatchObject({ opCode: 'Bigger', ruleType: 'rule_text' });
    expect(node.props.approvals[0].conditions.rules[0]).not.toHaveProperty('formula');
    expect(node.props.approvals[1]).not.toHaveProperty('conditions');
    if (type === 'carbon') {
      expect(node.props.approvals[0].props.params).toContainEqual({ key: 'receiver', value: { type: 'ROLE', value: ['ROLE_REAL'] } });
      expect(node.props.approvals[1].props.params).toContainEqual({ key: 'receiver', value: { type: 'NORMAL', value: ['USER_REAL'] } });
      expect(() => compiler.buildProcessAndViewJson({ nodes: [{ type: 'carbon', receiver: {
        kind: 'conditional', cases: [{ actor: { kind: 'directLeader' } }],
      } }] }, 'PROC', 'FORM', 'https://example.com', 'APP')).toThrow('unsupported carbon receiver');
    }
    const view = built.viewJson.schema.children.find(item => item.props?.approverRules?.mode === 'ApprovalNode_rules_multiple');
    expect(view.props.approverRules.approverList).toHaveLength(2);
  });
});

describe('incremental patch preserves unrelated definitions', () => {
  function record() {
    return { nodeIdMap: { notify: 'n' }, processJson: { props: { unknown: true }, nodes: [{ nodeId: 'n', type: 'sendMessage',
      props: { messageInfo: { title: 'old', content: 'old', buttons: [{ id: 'retain' }] }, unknown: { keep: 1 } }, childNodes: [] }] },
    viewJson: { schema: { children: [{ id: 'n', componentName: 'SendMessageNode',
      props: { sendMessageRules: { messageInfo: { title: 'old', content: 'old', buttons: [{ id: 'retain' }] } }, unknown: 2 } }] },
    globalSetting: { unknown: { keep: 3 } } } };
  }
  test('changes exactly both message contents while preserving unknowns and stable node IDs', () => {
    const original = record();
    const updated = applyPatch(original, { nodes: [{ id: 'notify', message: { content: 'new' } }] });
    expect(updated.processJson.nodes[0].props.messageInfo.content).toBe('new');
    expect(updated.viewJson.schema.children[0].props.sendMessageRules.messageInfo.content).toBe('new');
    updated.processJson.nodes[0].props.messageInfo.content = 'old';
    updated.viewJson.schema.children[0].props.sendMessageRules.messageInfo.content = 'old';
    expect(updated).toEqual(original);
  });
  test('documented incremental patch preserves receivers and unrelated properties', () => {
    const patches = documentedExamples('yida-integration/references/operations.md', '## 修改已有自动化');
    expect(patches).toHaveLength(1);
    const updated = applyPatch(record(), patches[0]);
    expect(updated.processJson.nodes[0].name.zh_CN).toBe('库存预警');
    expect(updated.processJson.nodes[0].props.messageInfo).toMatchObject({ title: '库存提醒',
      content: '库存已低于阈值，请处理。', buttons: [{ id: 'retain' }] });
    expect(updated.globalSetting).toEqual(record().globalSetting);
  });
  test.each([{ nodes: [{ id: 'missing', name: 'x' }] }, { nodes: [{ id: 'notify', processProps: {} }] },
    { nodes: [{ id: 'notify' }] }, { nodes: [{ id: 'notify', name: 'a' }, { id: 'notify', name: 'b' }] }])(
    'rejects unsupported/ambiguous patches %#', patch => expect(() => applyPatch(record(), patch)).toThrow());
});
