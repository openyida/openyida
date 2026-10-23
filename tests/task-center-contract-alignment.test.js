'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { flattenCommandManifest } = require('../lib/core/command-manifest');
const { assertManagedInvocation } = require('../lib/agent/managed-run');
const { classifyManagedMutation } = require('../lib/agent/managed-command-map');
const { capabilities, validateSpec } = require('../lib/task-center/scaffold');
const contract = require('../lib/task-center/contract');
const { SKILL_COVERAGE } = require('../scripts/e2e-real/skill-coverage');
const index = require('../yida-skills/skills-index.json');

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(), triggerLogin: jest.fn(), resolveBaseUrl: jest.fn(() => 'https://example.test'),
  httpGet: jest.fn(), httpPost: jest.fn(), requestWithAutoLogin: jest.fn(),
}));
const utils = require('../lib/core/utils');
const taskCli = require('../lib/core/task-center');
const dataCli = require('../lib/core/query-data');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const entry = flattenCommandManifest().find(command => command.id === 'task-center');
const references = [
  'yida-skills/skills/yida-task-center/references/task-filters.md',
  'yida-skills/skills/yida-canvas-data-binding/references/workflow-capabilities.md',
];
const exampleCommands = file => [...read(file).replace(/\\\r?\n/g, ' ').matchAll(/^openyida (.+)$/gm)].map(match => 'openyida ' + match[1]);
const documented = references.flatMap(file => exampleCommands(file).map(command => [file, command]));
const variables = Object.fromEntries(references.flatMap(file => [...read(file).matchAll(/^([A-Z_]+)=(\d+)$/gm)].map(match => [match[1], match[2]])));
const env = {
  OPENYIDA_MANAGED_RUN: '1', OPENYIDA_AGENT_APP_TYPE: 'APP_TEST',
  OPENYIDA_AGENT_CORP_ID: 'corp-test', OPENYIDA_AGENT_USER_ID: 'user-test',
  OPENYIDA_AGENT_RUN_ID: 'run-test', OPENYIDA_AGENT_ATTEMPT_ID: 'attempt-test',
  OPENYIDA_AGENT_BASE_URL: 'https://example.test', OPENYIDA_AGENT_TASK_GRANT: 'task_' + 'g'.repeat(48),
};
let directory, designFile, log;
beforeEach(() => {
  jest.resetAllMocks();
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'task-alignment-'));
  designFile = path.join(directory, 'design.md'); fs.writeFileSync(designFile, 'Use the current application theme.');
  utils.loadAuthData.mockReturnValue({ base_url: 'https://example.test', auth_mode: 'token', auth_source: 'token', user_id: 'visitor-test', corp_id: 'corp-test' });
  utils.resolveBaseUrl.mockReturnValue('https://example.test');
  utils.requestWithAutoLogin.mockImplementation((request, auth) => request(auth));
  utils.httpGet.mockImplementation(async (_base, endpoint) => {
    if (endpoint.endsWith('/getInstanceById.json')) {
      return { success: true, content: { appType: 'APP_TEST', processInstanceId: 'instance-a', formUuid: 'FORM_TEST', instanceStatus: 'RUNNING' } };
    }
    if (endpoint.endsWith('/getOperationRecords.json')) { return { success: true, content: [] }; }
    if (endpoint.endsWith('/searchUsers.json')) { return { success: true, content: { values: [{ staffId: 'user-a', displayName: 'Member' }] } }; }
    const row = { appType: 'APP_TEST', taskId: 'task-a', processInstanceId: 'instance-a', formUuid: 'FORM_TEST', carbonActivityId: 'node-a', dataType: 'pinst', title: 'Request' };
    return { success: true, content: { data: [row], values: [row], totalCount: 37 } };
  });
  utils.httpPost.mockResolvedValue({ success: true, content: [{ appType: 'APP_TEST', processCode: 'process-a', formUuid: 'FORM_TEST', formType: 'process', title: '报销采购' }] });
  log = jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { log.mockRestore(); fs.rmSync(directory, { recursive: true, force: true }); });

// The maintained examples use only simple shell quoting and these two variables.
// Replay them through the real command handlers; no shell or live API is used.
function tokens(command) {
  return (command.match(/'[^']*'|"[^"]*"|[^\s]+/g) || []).map(token => token.replace(/^(['"])(.*)\1$/, '$2')
    .replace(/\$(TASK_[A-Z_]+)/g, (_match, name) => { if (!variables[name]) { throw new Error('Undefined example variable: ' + name); } return variables[name]; })
    .replace(/APP_REPLACE|APP_XXX/g, 'APP_TEST').replace(/INSTANCE_REPLACE/g, 'instance-a')
    .replace(/FORM_REPLACE/g, 'FORM_TEST').replace(/TASK_REPLACE/g, 'task-a'));
}
async function replay(command) {
  const [, name, ...args] = tokens(command);
  if (name === 'task-center' && args[0] === 'scaffold') {
    const specFile = path.join(directory, 'spec.json');
    fs.writeFileSync(specFile, JSON.stringify({ ...capabilities().scaffold.progressSpecExample, appType: 'APP_TEST', designFile }));
    args[args.indexOf('--spec') + 1] = specFile;
    args[args.indexOf('--output') + 1] = path.join(directory, 'progress.canvas.jsx');
  }
  expect(() => assertManagedInvocation(name, args, { env })).not.toThrow();
  await (name === 'data' ? dataCli : taskCli).run(args);
  return JSON.parse(log.mock.calls.at(-1)[0]);
}

test.each(documented)('Skill command in %s executes with documented parameters: %s', async (_file, command) => {
  const result = await replay(command);
  const args = tokens(command);
  if (args[1] === 'data') {
    expect(result).toMatchObject({ success: true, content: { total: 37, page: 1 } });
    const params = utils.httpGet.mock.calls.at(-1)[2];
    expect(JSON.parse(params.query).appKeys).toEqual(['APP_TEST']);
    expect(result.content.items[0].kind).toBe(contract.kindOf(args[args.indexOf('--type') + 1]));
  } else if (args[2] === 'inspect') {
    expect(result).toMatchObject({ appType: 'APP_TEST', processInstanceId: 'instance-a', history: { state: args.includes('--history') ? 'ready' : 'not-requested' } });
    expect(utils.httpGet).toHaveBeenCalledTimes(args.includes('--history') ? 2 : 1);
  } else if (args[2] === 'count') {
    expect(result).toMatchObject({ total: 37, available: true, filters: { keyword: '采购' } });
    expect(utils.httpGet).toHaveBeenCalledTimes(1);
  } else if (args[2] === 'scaffold') {
    expect(result).toMatchObject({ component: 'ProcessProgressSection', requiredProps: ['processInstanceId'], runtimeVerified: false });
    expect(fs.existsSync(result.output)).toBe(true);
    expect(utils.httpGet).not.toHaveBeenCalled();
  } else if (args[2] === 'options') { expect(result.items.length).toBeGreaterThan(0); }
  else { expect(result.scope).toBe('app'); expect(utils.loadAuthData).not.toHaveBeenCalled(); }
});

test.each(entry.examples)('manifest example is accepted by the real CLI: %s', async command => {
  await replay(command);
});

test('CLI help, manifest actions and side-effect declarations advertise the same operations', async () => {
  let usage;
  try { await taskCli.run([]); } catch (error) { usage = error.usage; }
  const helpActions = [...usage.matchAll(/^ {2}openyida task-center ([a-z-]+)/gm)].map(match => match[1]);
  const manifestActions = entry.usage.match(/<([^>]+)>/)[1].split('|');
  expect([...new Set(helpActions)].sort()).toEqual(manifestActions.slice().sort());
  expect([...entry.sideEffect.read_actions, ...entry.sideEffect.mutating_actions].sort()).toEqual(manifestActions.slice().sort());
  expect(entry.sideEffect.mutates_yida).toBe(false);
});

test.each(['options', 'inspect', 'count'])('%s stays app-bound and read-only in the actual managed guard', action => {
  const args = [action, 'APP_TEST'];
  expect(assertManagedInvocation('task-center', args, { env })).toMatchObject({ appType: 'APP_TEST' });
  expect(classifyManagedMutation('task-center', args)).toBeNull();
  expect(entry.sideEffect.read_actions).toContain(action);
  expect(() => assertManagedInvocation('task-center', [action, 'APP_OTHER'], { env })).toThrow(expect.objectContaining({ code: 'MANAGED_APP_MISMATCH' }));
  expect(() => assertManagedInvocation('task-center', [...args, '--user-id', 'other'], { env })).toThrow(expect.objectContaining({ code: 'MANAGED_OVERRIDE_FORBIDDEN' }));
});

test.each(['todo', 'created', 'done', 'cc', 'proxy', 'unknown'])('%s never expands an app-bound run to a global query', action => {
  expect(() => assertManagedInvocation('task-center', [action], { env })).toThrow(expect.objectContaining({ code: 'MANAGED_COMMAND_UNSUPPORTED' }));
});

test.each(['app-v1', 'app-query'].flatMap(transport => contract.capabilities().kinds.map(kind => [transport, kind])))('%s %s list and count preserve the same supported filters', async (transport, kind) => {
  const filters = Object.fromEntries(Object.entries(contract.filterSchema(kind, transport)).map(([field, schema]) => [field,
    schema.type === 'string-array' ? ['id-a'] : schema.type === 'timestamp' ? 1790784000000 : schema.type === 'enum' ? 0 : field === 'instanceStatus' ? 'RUNNING' : 'Request']));
  const list = contract.request(kind, { appType: 'APP_TEST', transport, ...filters, page: 2, pageSize: 7 });
  const count = await taskCli.run(['count', 'APP_TEST', '--type', kind, '--transport', transport, '--filters-json', JSON.stringify(filters), '--json']);
  const params = utils.httpGet.mock.calls.at(-1)[2];
  const listParams = transport === 'app-query' ? JSON.parse(list.params.query) : list.params;
  const countParams = transport === 'app-query' ? JSON.parse(params.query) : params;
  for (const key of Object.keys(filters)) { expect(countParams[key]).toEqual(listParams[key]); }
  expect(count).toMatchObject({ total: 37, filters: contract.normalizeFilters(kind, filters, transport) });
  expect(countParams).toMatchObject(transport === 'app-query' ? { page: 1, limit: 1, appKeys: ['APP_TEST'] } : { currentPage: 1, pageSize: 1, appType: 'APP_TEST' });
});

test.each([
  ['todo', 'instance-status', 'instanceStatus', 0],
  ['created', 'originators', 'originators', ['user-a']],
  ['done', 'carbon-create-from', 'carbonCreateFrom', 1790784000000],
  ['cc', 'task-finish-from', 'taskFinishFrom', 1790784000000],
])('%s list and count both reject unsupported filters before any request', async (kind, flag, field, value) => {
  await expect(dataCli.run(['query', 'tasks', 'APP_TEST', '--type', kind, '--transport', 'app-query', '--' + flag, typeof value === 'object' ? JSON.stringify(value) : String(value), '--normalized']))
    .rejects.toHaveProperty('code', 'TASK_FILTER_UNSUPPORTED');
  await expect(taskCli.run(['count', 'APP_TEST', '--type', kind, '--transport', 'app-query', '--filters-json', JSON.stringify({ [field]: value }), '--json']))
    .rejects.toHaveProperty('code', 'TASK_FILTER_UNSUPPORTED');
  expect(utils.httpGet).not.toHaveBeenCalled();
  expect(utils.httpPost).not.toHaveBeenCalled();
  expect(log).not.toHaveBeenCalled();
});

test('published capability specs and Skill configuration fragments use valid defaults and the same confirmation boundary', () => {
  const advertised = capabilities().scaffold;
  const specs = [advertised.specExample, advertised.progressSpecExample];
  for (const file of references) {
    for (const match of read(file).matchAll(/```json\n([\s\S]*?)\n```/g)) { specs.push({ ...advertised.specExample, ...JSON.parse(match[1]) }); }
  }
  for (const spec of specs) {
    const input = { ...spec, appType: 'APP_TEST', designFile };
    expect(() => validateSpec(input)).not.toThrow();
    for (const choice of [undefined, { source: 'ask_human', confirmed: false }, { source: 'fast', confirmed: true }]) {
      expect(() => validateSpec({ ...input, customPage: choice })).toThrow(expect.objectContaining({ code: 'TASK_CUSTOM_PAGE_CONFIRMATION_REQUIRED' }));
    }
    expect(() => validateSpec({ ...input, customPage: { source: 'ask_human', confirmed: true } })).not.toThrow();
  }
  expect(validateSpec({ ...advertised.specExample, appType: 'APP_TEST', designFile }).kinds).toEqual(['todo']);
  expect(validateSpec({ ...advertised.progressSpecExample, appType: 'APP_TEST', designFile }).history).toBe(false);
});

test('task-related Skills register their command IDs, references and executable coverage', () => {
  for (const name of ['yida-task-center', 'yida-canvas-data-binding', 'yida-data-management']) {
    const discovery = index.skills.find(skill => skill.name === name);
    expect(discovery.command_ids).toContain('task-center');
    for (const id of discovery.command_ids) { expect(flattenCommandManifest().some(command => command.id === id)).toBe(true); }
    expect(SKILL_COVERAGE[name].tests).toContain('tests/task-center-contract-alignment.test.js');
    const file = 'yida-skills/skills/' + name + '/SKILL.md';
    for (const [, link] of read(file).matchAll(/\]\(([^)]+\.md)(?:#[^)]*)?\)/g)) {
      if (!link.includes('://')) { expect(fs.existsSync(path.resolve(root, path.dirname(file), link))).toBe(true); }
    }
  }
  const taskTests = fs.readdirSync(path.join(root, 'tests')).filter(name => /^task-center.*\.test\.js$/.test(name)).map(name => 'tests/' + name);
  expect(SKILL_COVERAGE['yida-task-center'].tests).toEqual(expect.arrayContaining(taskTests));
});
