'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
jest.mock('../lib/app/form-navigation', () => ({ fetchFormPageList: jest.fn() }));
jest.mock('../lib/app/get-schema', () => ({ fetchSchemaRecord: jest.fn(), resolveCodeBundleSchema: jest.fn() }));
const { fetchFormPageList } = require('../lib/app/form-navigation');
const { fetchSchemaRecord, resolveCodeBundleSchema } = require('../lib/app/get-schema');
const { inspectUpgradeSchema, prepareAppThemeUpgrade } = require('../lib/app/prepare-app-theme-upgrade');
let root;
const auth = { corpId: 'corp-1', baseUrl: 'https://private.example' };
const schema = node => ({ success: true, content: { pages: [{ componentName: 'Page', children: [node] }] } });
beforeEach(() => {
  jest.resetAllMocks();
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-upgrade-prepare-'));
  fetchFormPageList.mockResolvedValue([{ formUuid: 'FORM_1', formName: '../../outside', formType: 'display' }]);
  fetchSchemaRecord.mockResolvedValue({ success: true, schema: schema({ componentName: 'YidaCodeCanvas', props: { code: 'export default function YidaComp() { return <div>Original business</div>; }' } }) });
  resolveCodeBundleSchema.mockImplementation(async value => value);
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
const prepare = () => prepareAppThemeUpgrade({ appType: 'APP_1', outputDir: path.join(root, 'backup') }, auth);

test('preparation saves exact source and raw schema without claiming migration complete', async () => {
  const result = await prepare();
  expect(result).toMatchObject({ success: true, stage: 'prepared', appUpgradeComplete: false, remoteModified: false, inventoryCoverageVerified: false });
  const resource = result.resources[0];
  expect(resource.status).toBe('pending-review');
  expect(resource.sources[0].file).toBe(path.join(root, 'backup/resource-1/source-1.canvas.jsx'));
  expect(fs.readFileSync(resource.sources[0].file, 'utf8')).toContain('Original business');
  expect(resource.schemaSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.parse(fs.readFileSync(result.manifestFile, 'utf8')).resources).toHaveLength(1);
  expect(fetchSchemaRecord).toHaveBeenCalledWith('APP_1', expect.any(Object), auth, 0, { resolveCodeBundles: false });
});
test('codeBundle resolution never alters raw backup', async () => {
  const raw = schema({ componentName: 'YidaCodeCanvas', props: { codeBundle: { bundleId: 'original-bundle' } } });
  fetchSchemaRecord.mockResolvedValue({ success: true, schema: raw });
  resolveCodeBundleSchema.mockImplementation(async value => {
    const props = value.content.pages[0].children[0].props;
    props.code = 'export default function YidaComp() { return null; }';
    delete props.codeBundle;
    return value;
  });
  const result = await prepare();
  const original = JSON.parse(fs.readFileSync(result.resources[0].schemaFile, 'utf8'));
  expect(original.content.pages[0].children[0].props.codeBundle.bundleId).toBe('original-bundle');
  expect(raw.content.pages[0].children[0].props.codeBundle).toBeDefined();
  expect(result.resources[0].sources[0].kind).toBe('canvas');
});
test('legacy source is extracted exactly; compiled output is never treated as source', async () => {
  const raw = schema({ componentName: 'Jsx', props: {} });
  raw.content.actions = { module: { source: 'export function renderJsx() { return <button onClick={this.submit}>Submit</button>; }', compiled: 'compiled' } };
  fetchSchemaRecord.mockResolvedValue({ success: true, schema: raw });
  const result = await prepare();
  expect(result.resources[0].kind).toBe('legacy-jsx');
  expect(fs.readFileSync(result.resources[0].sources[0].file, 'utf8')).toBe(raw.content.actions.module.source);
  delete raw.content.actions.module.source;
  expect(inspectUpgradeSchema(raw).blockers).toContainEqual({ code: 'LEGACY_JSX_SOURCE_MISSING', pointer: '/actions/module/source' });
});
test('form actions/style candidates are reported without deleting business logic or field IDs', () => {
  const raw = schema({ componentName: 'TextField', props: { fieldId: 'textField_original' } });
  raw.content.actions = { module: { source: "export function didMount() { this.loadOrders(); const s = document.createElement('style'); this.openFormDetail(); }" } };
  raw.content.css = '.detail { color: red; }';
  const before = JSON.stringify(raw);
  const result = inspectUpgradeSchema(raw);
  expect(result.sources[0].kind).toBe('actions');
  expect(result.styleCandidates.map(item => item.pointer)).toEqual(expect.arrayContaining(['/actions/module/source', '/css']));
  expect(JSON.stringify(raw)).toBe(before);
});
test('mixed JSX/Canvas pages block single-template publishing', () => {
  const raw = schema({ componentName: 'YidaCodeCanvas', props: { code: 'source' } });
  raw.content.pages[0].children.push({ componentName: 'Jsx', props: {} });
  expect(inspectUpgradeSchema(raw).blockers.map(item => item.code)).toContain('MIXED_PAGE_REQUIRES_SCHEMA_PRESERVING_MIGRATION');
});
test('missing Canvas source is blocked and artifact retained', async () => {
  fetchSchemaRecord.mockResolvedValue({ success: true, schema: schema({ componentName: 'YidaCodeCanvas', props: { runtimeCode: 'compiledOnly' } }) });
  const result = await prepare();
  expect(result).toMatchObject({ success: false, stage: 'blocked', blockedCount: 1 });
  expect(result.resources[0].sources).toHaveLength(0);
  expect(fs.existsSync(result.manifestFile)).toBe(true);
});
test('failed resource does not silently disappear from the inventory', async () => {
  fetchFormPageList.mockResolvedValue([{ formUuid: 'GOOD' }, { formUuid: 'FAILED' }]);
  fetchSchemaRecord.mockResolvedValueOnce({ success: true, schema: schema({ componentName: 'TextField' }) })
    .mockResolvedValueOnce({ success: false, errorMsg: 'permission denied' });
  const result = await prepare();
  expect(result).toMatchObject({ total: 2, blockedCount: 1, success: false });
  expect(result.resources[1]).toMatchObject({ formUuid: 'FAILED', status: 'blocked' });
});
test('bundle download failure leaves recoverable raw schema and blocks completion', async () => {
  resolveCodeBundleSchema.mockRejectedValue(new Error('bundle hash mismatch'));
  const result = await prepare();
  expect(result.success).toBe(false);
  expect(fs.existsSync(result.resources[0].schemaFile)).toBe(true);
});
test('never overwrites existing backup directory', async () => {
  fs.mkdirSync(path.join(root, 'backup'));
  fs.writeFileSync(path.join(root, 'backup/original'), 'keep');
  await expect(prepare()).rejects.toMatchObject({ code: 'APP_THEME_PREPARE_OUTPUT_EXISTS' });
  expect(fs.readFileSync(path.join(root, 'backup/original'), 'utf8')).toBe('keep');
  expect(fetchFormPageList).not.toHaveBeenCalled();
});

test('component declarations do not count as live Canvas instances', () => {
  const raw = schema({ componentName: 'TextField', props: { fieldId: 'field1' } });
  raw.content.componentsMap = [{ componentName: 'YidaCodeCanvas' }, { componentName: 'Jsx' }];
  expect(inspectUpgradeSchema(raw)).toMatchObject({ canvasCount: 0, jsxCount: 0, blockers: [] });
});
