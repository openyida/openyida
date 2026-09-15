'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { renderPrd, normalizePlan } = require('../lib/design-plan/materialize');
const source = fs.readFileSync(path.join(__dirname, '../lib/samples/openyida-scaffold/canvas-nav/data.jsx'), 'utf8');
const runtime = fetch => new Function('fetch', `${source}; return {loadCanvasNavigation, filterCanvasNavigation, buildCanvasNavigationUrl, selectCanvasNavigation};`)(fetch);
const requirement = (formUuid, operation = 'OPERATE_VIEW', viewUuid) => ({ formUuid, operation, ...(viewUuid ? { viewUuid } : {}) });
const grant = (value, allowed = true) => ({ ...value, allowed });
const leaf = (key, targetType, access) => ({ key, label: key, targetType, formUuid: access[0].formUuid, access });

function planFixture() {
  const plan = normalizePlan(JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/design-plan.json'))));
  const front = plan.pages.customPageDetails[0];
  front.sceneKey = 'service';
  front.pageSpecHandoff = { entryMode: 'standalone', navigation: { type: 'custom', variant: 'top', reason: '访客独立办理' } };
  const menu = (key, resource, targetType, extra = {}) => ({ key, label: key, resource, targetType,
    access: [{ resource, operation: targetType === 'submission' ? 'OPERATE_CREATE' : 'OPERATE_VIEW', dataScope: '本人或已授权管理范围' }], ...extra });
  plan.execution = { appConfig: { navigationType: 'platform-side' }, entryRecommendation: {
    mode: 'service-management', source: 'user_selected', entries: [
      { key: 'front', name: '访客端', role: 'service', sceneKey: 'service', defaultMenuKey: 'mine', menu: [
        menu('mine', front.name, 'local', { viewKey: 'mine' }), menu('submit', '采购订单', 'submission'),
      ] },
      { key: 'management', name: '业务管理端', role: 'management', defaultMenuKey: 'orders', menu: [
        menu('requests', '采购申请', 'page'), menu('orders', '采购订单', 'page'),
      ] },
    ],
  } };
  return plan;
}
const handoff = plan => JSON.parse(renderPrd(plan).match(/```json\n([\s\S]*?)\n```/)[1]);

describe('entry planning and platform navigation', () => {
  test('derives management order without a management homepage and preserves frontend menu order', () => {
    const plan = planFixture();
    const result = handoff(plan);
    expect(result.navigationOrder).toEqual(['采购订单', '采购申请']);
    expect(result.pageNavigation).toEqual([{ name: '采购工作台', type: 'display-page', isRenderNav: false }]);
    expect(result.appConfig.hideAppNav).toBe('n');
    expect(result.entryRecommendation).toEqual(plan.execution.entryRecommendation);
    expect(result.pages).toHaveLength(1);
  });
  test('management-only native resources need no display page', () => {
    const plan = planFixture();
    plan.pages.customPageDetails = [];
    plan.execution.entryRecommendation.mode = 'unified';
    plan.execution.entryRecommendation.entries.shift();
    const result = handoff(plan);
    expect(result.pages).toEqual([]);
    expect(result.pageNavigation).toEqual([]);
    expect(result.navigationOrder).toEqual(['采购订单', '采购申请']);
  });
  test('frontend-only and explicit narrow scope do not reorder platform navigation', () => {
    for (const scope of ['frontend-only', 'narrow']) {
      const plan = planFixture();
      if (scope === 'frontend-only') {
        plan.execution.entryRecommendation.mode = scope;
        plan.execution.entryRecommendation.entries.pop();
      } else {plan.execution.explicitScope = { allowInferredResources: false };}
      expect(handoff(plan).navigationOrder).toEqual([]);
    }
  });
  test.each([
    ['conflicting platform order', plan => { plan.execution.navigationOrder = ['采购工作台']; }, /navigationOrder/],
    ['unavailable default', plan => { plan.execution.entryRecommendation.entries[1].defaultMenuKey = 'missing'; }, /默认菜单/],
    ['unknown resource', plan => { plan.execution.entryRecommendation.entries[1].menu[0].resource = '不存在'; }, /未知资源/],
    ['missing operation', plan => { plan.execution.entryRecommendation.entries[0].menu[1].access[0].operation = 'OPERATE_VIEW'; }, /OPERATE_CREATE/],
    ['duplicate task key', plan => { plan.execution.entryRecommendation.entries[1].menu[1].key = 'requests'; }, /重复/],
    ['wrong standalone route', plan => { plan.execution.entryRecommendation.entries[0].menu[0].targetType = 'page'; }, /双导航/],
    ['missing view permission', plan => { plan.execution.entryRecommendation.entries[1].menu[0].viewUuid = 'VIEW_REAL'; }, /OPERATE_VIEW/],
  ])('rejects %s', (_, change, message) => {
    const plan = planFixture(); change(plan);
    expect(() => handoff(plan)).toThrow(message);
  });
});

describe('independent menus use current viewer operation and view grants', () => {
  test('separates submission, own records, management view and platform hidden resources', async () => {
    const fetch = jest.fn();
    const { loadCanvasNavigation, filterCanvasNavigation } = runtime(fetch);
    const create = requirement('FORM_SHARED', 'OPERATE_CREATE');
    const own = requirement('FORM_SHARED', 'OPERATE_VIEW', 'VIEW_SELF');
    const manage = requirement('FORM_SHARED', 'OPERATE_VIEW', 'VIEW_MANAGE');
    const items = [leaf('submit', 'submission', [create]), { ...leaf('mine', 'page', [own]), viewUuid: 'VIEW_SELF' },
      { ...leaf('manage', 'page', [manage]), viewUuid: 'VIEW_MANAGE' }];
    const load = grants => loadCanvasNavigation({ items, appType: 'APP', mode: 'independent', hiddenNav: ['FORM_SHARED'],
      resolveAccess: async () => ({ appType: 'APP', grants }) });
    expect((await load([grant(create), grant(own)])).map(item => item.key)).toEqual(['submit', 'mine']);
    expect((await load([grant(manage)])).map(item => item.key)).toEqual(['manage']);
    expect((await load([grant(create), grant(own), grant(manage)])).map(item => item.key)).toEqual(['submit', 'mine', 'manage']);
    expect(filterCanvasNavigation(items, [{ navUuid: 'FORM_SHARED', hidden: true }], [], { access: { grants: [grant(create)] } })).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
  test('a local view requires both the host page and its business data capability', async () => {
    const host = requirement('PAGE'); const data = requirement('DATA');
    const items = [leaf('mine', 'local', [host, data])];
    const { filterCanvasNavigation, selectCanvasNavigation } = runtime();
    const filter = grants => filterCanvasNavigation(items, [], [], { mode: 'independent', access: { grants } });
    expect(filter([grant(host)])).toEqual([]);
    expect(filter([grant(host), grant(data)])).toEqual(items);
    expect(selectCanvasNavigation(filter([grant(host)]), 'mine', 'mine')).toBeUndefined();
    expect(selectCanvasNavigation([{ key: 'first' }, { key: 'default' }], 'denied', 'default').key).toBe('default');
  });
  test('unknown, conflicting, string grants and legacy ID-only items cannot authorize independent menus', () => {
    const r = requirement('FORM');
    const items = [leaf('task', 'page', [r]), { key: 'unbound', formUuid: 'FORM' }];
    const { filterCanvasNavigation } = runtime();
    for (const grants of [[], [grant(r, 'true')], [grant(r), grant(r, false)], [grant(requirement('OTHER'))]]) {
      expect(filterCanvasNavigation(items, [], [], { mode: 'independent', access: { grants } })).toEqual([]);
    }
  });
  test('missing adapters, mismatched app, rejected and aborted requests never fall back to platform menus', async () => {
    const fetch = jest.fn(); const { loadCanvasNavigation } = runtime(fetch);
    const input = { appType: 'APP', items: [leaf('task', 'page', [requirement('FORM')])], mode: 'independent' };
    await expect(loadCanvasNavigation(input)).rejects.toThrow('权限查询能力');
    await expect(loadCanvasNavigation({ ...input, resolveAccess: async () => ({ appType: 'OTHER', grants: [] }) })).rejects.toThrow('权限查询失败');
    await expect(loadCanvasNavigation({ ...input, resolveAccess: async () => { throw new Error('unavailable'); } })).rejects.toThrow('unavailable');
    const controller = new AbortController(); controller.abort();
    await expect(loadCanvasNavigation({ ...input, signal: controller.signal, resolveAccess: async () => ({ appType: 'APP', grants: [] }) })).rejects.toThrow('已取消');
    expect(fetch).not.toHaveBeenCalled();
  });
  test('standalone links use custom and management links preserve the authorized view and business parameters', () => {
    const { buildCanvasNavigationUrl } = runtime();
    expect(buildCanvasNavigationUrl({ formUuid: 'PAGE', targetType: 'custom', params: { isRenderNav: true, locale: 'zh_CN' } }, 'APP')).toBe('/APP/custom/PAGE?locale=zh_CN');
    const url = new URL(buildCanvasNavigationUrl({ formUuid: 'FORM', targetType: 'page', viewUuid: 'VIEW_ALLOWED', params: { viewUuid: 'OTHER', corpid: 'ding', query: 'a&b' } }, 'APP'), 'https://example.com');
    expect(url.pathname).toBe('/APP/workbench/FORM');
    expect(url.searchParams.get('viewUuid')).toBe('VIEW_ALLOWED');
    expect(url.searchParams.get('query')).toBe('a&b');
    expect(url.searchParams.get('corpid')).toBe('ding');
  });
  test('loader passes the adapter contract and platform query parameters without mixing navigation modes', async () => {
    const fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, content: { navs: [{ navUuid: 'FORM' }] } }) });
    const { loadCanvasNavigation, buildCanvasNavigationUrl } = runtime(fetch);
    const r = requirement('FORM', 'OPERATE_VIEW', 'VIEW');
    const items = [{ ...leaf('manage', 'page', [r]), viewUuid: 'VIEW' }];
    const signal = new AbortController().signal;
    const resolveAccess = jest.fn().mockResolvedValue({ appType: 'APP', grants: [grant(r)] });
    expect(await loadCanvasNavigation({ items, appType: 'APP', formUuid: 'PAGE', csrfToken: 'csrf-test', signal, resolveAccess })).toEqual(items);
    expect(resolveAccess).toHaveBeenCalledWith({ appType: 'APP', requirements: [r], signal });
    const [requested, options] = fetch.mock.calls[0];
    const query = new URL(requested, 'https://example.com').searchParams;
    expect(query.get('formUuid')).toBe('PAGE');
    expect(query.get('_csrf_token')).toBe('csrf-test');
    expect(options).toMatchObject({ credentials: 'include', cache: 'no-store', signal });
    expect(buildCanvasNavigationUrl(items[0], 'APP', { embedded: true })).toBe('/APP/workbench/FORM?viewUuid=VIEW&iframe=true');
    expect(buildCanvasNavigationUrl({ formUuid: 'FORM', targetType: 'submission' }, 'APP', { embedded: true })).toBe('/APP/submission/FORM?isRenderNav=false');
  });
  test('a view supplied in route params cannot reuse resource-wide viewing permission', () => {
    const r = requirement('FORM');
    const items = [{ ...leaf('manage', 'page', [r]), params: { viewUuid: 'VIEW_OTHER' } }];
    expect(runtime().filterCanvasNavigation(items, [], [], { mode: 'independent', access: { grants: [grant(r)] } })).toEqual([]);
  });
  test('the distributed helper compiles through the Canvas pipeline', () => {
    const { compileCanvasLocal } = require('../lib/app/canvas-compile');
    const { runtimeCode } = compileCanvasLocal(`${source}\nfunction YidaComp() { return selectCanvasNavigation([{key:'task'}], 'missing', 'task').key; }`);
    const result = new Function('window', `${runtimeCode}; return YidaComp();`)({ React: {}, LucideReact: {} });
    expect(result).toBe('task');
  });
});

describe('entry contract survives authoring and rendering', () => {
  const os = require('os');
  const { initialize } = require('../lib/design-plan/init');
  const { materialize } = require('../lib/design-plan/materialize');
  const { patchPlan } = require('../lib/design-plan/patch');
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-entry-test-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });
  test('CLI accepts the entry JSON through patch and rejects invalid defaults without writing', () => {
    const plan = planFixture();
    const recommendation = plan.execution.entryRecommendation;
    delete plan.execution.entryRecommendation;
    const file = path.join(dir, 'build-plan.json');
    fs.writeFileSync(file, JSON.stringify(plan));
    const bin = path.join(__dirname, '../bin/yida.js');
    const cli = args => JSON.parse(execFileSync(process.execPath, [bin, 'design-plan', ...args], { encoding: 'utf8' }));
    cli(['patch', file, '--set', 'execution.entryRecommendation=' + JSON.stringify(recommendation), '--materialize', '--output-dir', dir, '--json']);
    expect(cli(['materialize', file, '--check', '--json']).checked).toBe(true);
    expect(JSON.parse(fs.readFileSync(file)).execution.entryRecommendation).toEqual(recommendation);
    const prd = fs.readFileSync(path.join(dir, 'prd.md'), 'utf8');
    const execution = JSON.parse(prd.match(/```json\n([\s\S]*?)\n```/)[1]);
    expect(execution.navigationOrder).toEqual(['采购订单', '采购申请']);
    const before = fs.readFileSync(file, 'utf8');
    const rejected = spawnSync(process.execPath, [bin, 'design-plan', 'patch', file, '--set',
      'execution.entryRecommendation.entries[1].defaultMenuKey=missing', '--materialize', '--json'], { encoding: 'utf8' });
    expect(rejected.status).not.toBe(0);
    expect(rejected.stdout + rejected.stderr).toContain('DESIGN_PLAN_INVALID_ENTRY_NAVIGATION');
    expect(fs.readFileSync(file, 'utf8')).toBe(before);
  });
  test('initialization preserves entry suggestions and reports unfinished menus', () => {
    const recommendation = { mode: 'service-management', source: 'user_selected', entries: [{ key: 'front', name: '访客端', role: 'service', sceneKey: 'service', taskRefs: ['apply'] }] };
    const brief = { projectName: 'entry-test', intake: { firstBuild: true, sourceDetail: 'detailed', designMode: 'plan', confirmed: true }, openQuestions: [],
      navigation: { type: 'platform-side', source: 'user_selected' }, businessGoals: ['办理业务'],
      pageScenes: [{ key: 'service', name: '业务服务', kind: 'custom-page' }], entryRecommendation: recommendation };
    const file = path.join(dir, 'brief.json'); fs.writeFileSync(file, JSON.stringify(brief));
    const result = initialize(file, { themeId: 'airy-modular-clarity', outputDir: path.join(dir, 'plan') });
    const initialized = JSON.parse(fs.readFileSync(result.output));
    expect(initialized.execution.entryRecommendation).toEqual(recommendation);
    expect(JSON.stringify(result)).toContain('execution.entryRecommendation.entries[0].menu');
  });
  test('materializes menu defaults into PRD and preview, and patch invalidates previous confirmation', () => {
    const plan = planFixture();
    const file = path.join(dir, 'build-plan.json'); fs.writeFileSync(file, JSON.stringify(plan));
    materialize(file);
    expect(fs.readFileSync(path.join(dir, 'build-plan.html'), 'utf8')).toContain('业务管理端');
    const prd = fs.readFileSync(path.join(dir, 'prd.md'), 'utf8');
    expect(prd).toContain('访问态入口与权限');
    const next = JSON.parse(JSON.stringify(plan.execution.entryRecommendation));
    next.entries[1].defaultMenuKey = 'requests';
    const result = patchPlan(file, ['execution.entryRecommendation=' + JSON.stringify(next)], { materialize: true });
    expect(result.confirmationInvalidated).toBe(true);
    const newPrd = fs.readFileSync(path.join(dir, 'prd.md'), 'utf8');
    expect(JSON.parse(newPrd.match(/```json\n([\s\S]*?)\n```/)[1]).navigationOrder).toEqual(['采购申请', '采购订单']);
  });
});
