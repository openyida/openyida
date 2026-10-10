'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { renderPrd, normalizePlan } = require('../lib/design-plan/materialize');
const { collectIssues } = require('../lib/design-plan/validate');
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
  test.each(['service-management', 'frontend-only'])('%s infers a standalone service page without entryMode or menu styling', mode => {
    const plan = planFixture();
    delete plan.pages.customPageDetails[0].pageSpecHandoff;
    plan.execution.entryRecommendation.mode = mode;
    if (mode === 'frontend-only') {plan.execution.entryRecommendation.entries.pop();}
    const result = handoff(plan);
    expect(result.pages[0].pageSpecHandoff.entryMode).toBe('standalone');
    expect(result.pageNavigation).toEqual([{ name: '采购工作台', type: 'display-page', isRenderNav: false }]);
    expect(result.appConfig.hideAppNav).toBe('n');
    expect(renderPrd(plan)).toContain('独立页面入口');
    expect(plan.pages.customPageDetails[0].pageSpecHandoff).toBeUndefined();
  });

  test('does not infer a standalone page from a management role or page name', () => {
    const plan = planFixture();
    delete plan.pages.customPageDetails[0].pageSpecHandoff;
    plan.execution.entryRecommendation = { mode: 'unified', entries: [
      { ...plan.execution.entryRecommendation.entries[0], role: 'workspace' },
    ] };
    expect(handoff(plan).pages[0].pageSpecHandoff.entryMode).toBe('platform-shell');
    expect(handoff(plan).pageNavigation).toEqual([]);
  });

  test('does not override an explicit conflicting platform-shell service page', () => {
    const plan = planFixture();
    plan.pages.customPageDetails[0].pageSpecHandoff = { entryMode: 'platform-shell' };
    expect(() => handoff(plan)).toThrow(/访客入口.*必须关联独立页面/);
  });

  test('derives management order without a management homepage and preserves frontend menu order', () => {
    const plan = planFixture();
    const result = handoff(plan);
    expect(result.navigationOrder).toEqual(['采购订单', '采购申请']);
    expect(result.pageNavigation).toEqual([{ name: '采购工作台', type: 'display-page', isRenderNav: false }]);
    expect(result.appConfig.hideAppNav).toBe('n');
    expect(result.entryRecommendation).toEqual(plan.execution.entryRecommendation);
    expect(result.pages).toHaveLength(1);
  });
  test.each(['unified', 'backend-only'])('%s native management resources need no display page', mode => {
    const plan = planFixture();
    plan.pages.customPageDetails = [];
    plan.execution.entryRecommendation.mode = mode;
    plan.execution.entryRecommendation.entries.shift();
    const result = handoff(plan);
    expect(result.pages).toEqual([]);
    expect(result.pageNavigation).toEqual([]);
    expect(result.navigationOrder).toEqual(['采购订单', '采购申请']);
    expect(result.entryRecommendation.mode).toBe(mode);
    expect(collectIssues(plan).filter(issue => issue.path.startsWith('execution.entryRecommendation'))).toEqual([]);
  });
  test.each(['service', 'workspace'])('backend-only rejects a %s entry in both validation stages', role => {
    const plan = planFixture();
    const entry = plan.execution.entryRecommendation.entries[role === 'service' ? 0 : 1];
    entry.role = role;
    plan.execution.entryRecommendation = { mode: 'backend-only', entries: [entry] };
    expect(collectIssues(plan)).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'execution.entryRecommendation.entries' }),
    ]));
    expect(() => handoff(plan)).toThrow(expect.objectContaining({ code: 'DESIGN_PLAN_INVALID_ENTRY_NAVIGATION' }));
  });
  test('backend-only also rejects mixed frontend and management entries', () => {
    const plan = planFixture();
    plan.execution.entryRecommendation.mode = 'backend-only';
    expect(() => handoff(plan)).toThrow(expect.objectContaining({ code: 'DESIGN_PLAN_INVALID_ENTRY_NAVIGATION' }));
  });
  test('legacy unified frontend entries remain unchanged', () => {
    const plan = planFixture();
    plan.execution.entryRecommendation.mode = 'unified';
    plan.execution.entryRecommendation.entries.pop();
    expect(handoff(plan).entryRecommendation).toEqual(plan.execution.entryRecommendation);
  });
  test.each(['management', 'workspace'])('%s local menus bind sceneKey, resource and viewKey together', role => {
    const plan = planFixture();
    const page = plan.pages.customPageDetails[0];
    page.pageSpecHandoff = { entryMode: 'platform-shell' };
    const entry = plan.execution.entryRecommendation.entries[0];
    entry.role = role;
    entry.menu = [entry.menu[0]];
    plan.execution.entryRecommendation = { mode: 'unified', entries: [entry] };
    expect(handoff(plan).entryRecommendation.entries[0].sceneKey).toBe('service');
    for (const field of ['sceneKey', 'resource', 'viewKey']) {
      const owner = field === 'sceneKey' ? entry : entry.menu[0];
      const old = owner[field];
      // Keep resource real but point at the wrong page, so binding validation owns the diagnostic.
      if (field === 'resource') { owner[field] = '采购订单'; } else { delete owner[field]; }
      expect(() => handoff(plan)).toThrow(expect.objectContaining({
        code: 'DESIGN_PLAN_INVALID_ENTRY_NAVIGATION',
        details: expect.objectContaining({ entryKey: entry.key, menuKey: 'mine', missingFields: [field === 'sceneKey' ? 'entry.sceneKey' : `menu.${field}`] }),
      }));
      owner[field] = old;
    }
  });
  test('missing scene and view report only those fields, then accept the unchanged resource', () => {
    const plan = planFixture();
    const entry = plan.execution.entryRecommendation.entries[0];
    entry.role = 'workspace';
    entry.menu = [entry.menu[0]];
    plan.execution.entryRecommendation = { mode: 'unified', entries: [entry] };
    plan.pages.customPageDetails[0].pageSpecHandoff = { entryMode: 'platform-shell' };
    const resource = entry.menu[0].resource;
    delete entry.sceneKey;
    delete entry.menu[0].viewKey;
    expect(() => handoff(plan)).toThrow(expect.objectContaining({
      code: 'DESIGN_PLAN_INVALID_ENTRY_NAVIGATION',
      details: expect.objectContaining({ resource, missingFields: ['entry.sceneKey', 'menu.viewKey'] }),
    }));
    entry.sceneKey = 'service';
    entry.menu[0].viewKey = 'mine';
    expect(handoff(plan).entryRecommendation.entries[0].menu[0].resource).toBe(resource);
  });
  test.each([0, 1])('requires access for frontend and management leaf menus (%i)', index => {
    const plan = planFixture();
    delete plan.execution.entryRecommendation.entries[index].menu[0].access;
    expect(() => handoff(plan)).toThrow(/权限依赖/);
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
  test.each(['frontend-only', 'custom'])('%s preserves ordered menu groups and default tasks when platform sorting is skipped', mode => {
    const plan = planFixture();
    const entry = plan.execution.entryRecommendation.entries[0];
    const [mine, submit] = entry.menu;
    entry.menu = [{ key: 'service-tasks', label: '办理与查询', children: [submit, mine] }];
    // A default task can differ from the first item when the business order is explicit.
    entry.defaultMenuKey = 'mine';
    if (mode === 'frontend-only') {
      plan.execution.entryRecommendation.mode = mode;
      plan.execution.entryRecommendation.entries = [entry];
    } else {
      plan.execution.appConfig.navigationType = 'custom';
    }
    const result = handoff(plan);
    expect(result.navigationOrder).toEqual([]);
    expect(result.entryRecommendation.entries).toEqual(plan.execution.entryRecommendation.entries);
    expect(result.entryRecommendation.entries[0].menu[0].children.map(item => item.key)).toEqual(['submit', 'mine']);
    expect(result.entryRecommendation.entries[0].defaultMenuKey).toBe('mine');
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

describe('local presentation menus do not depend on platform navigation', () => {
  const items = ['home', 'culture', 'tour', 'booking'].map(key => ({ key, label: key, targetType: 'local', viewKey: key }));
  test('keeps all four views, grouping and requested/default selection when platform service is unavailable', async () => {
    const fetch = jest.fn().mockRejectedValue(new Error('platform unavailable'));
    const { loadCanvasNavigation, selectCanvasNavigation } = runtime(fetch);
    const input = [{ key: 'group', children: items }];
    const result = await loadCanvasNavigation({ items: input, mode: 'local' });
    expect(result).toEqual(input);
    expect(selectCanvasNavigation(result, 'tour', 'home').viewKey).toBe('tour');
    expect(selectCanvasNavigation(result, 'missing', 'home').viewKey).toBe('home');
    expect(fetch).not.toHaveBeenCalled();
  });
  test('declared business permissions still fail closed and never fall back to the full menu', async () => {
    const view = requirement('FORM_PRIVATE');
    const input = { items: [items[0], { ...items[1], access: [view] }], mode: 'local', appType: 'APP' };
    const fetch = jest.fn();
    const { loadCanvasNavigation } = runtime(fetch);
    await expect(loadCanvasNavigation(input)).rejects.toThrow('权限查询');
    await expect(loadCanvasNavigation({ ...input, resolveAccess: async () => ({ appType: 'APP', grants: [] }) })).resolves.toEqual([items[0]]);
    await expect(loadCanvasNavigation({ ...input, resolveAccess: async () => ({ appType: 'APP', grants: [grant(view)] }) })).resolves.toEqual(input.items);
    await expect(loadCanvasNavigation({ ...input, resolveAccess: async () => { throw new Error('permission unavailable'); } })).rejects.toThrow('permission unavailable');
    expect(fetch).not.toHaveBeenCalled();
  });
  test('rejects mismatched modes before network access', async () => {
    const fetch = jest.fn();
    const { loadCanvasNavigation } = runtime(fetch);
    for (const mode of [undefined, 'platform']) {
      await expect(loadCanvasNavigation({ items, mode, appType: 'APP' })).rejects.toThrow('页内菜单不能');
    }
    for (const item of [{ ...items[0], href: '/private' }, { ...items[0], viewKey: '' }, { key: 'remote', targetType: 'page', formUuid: 'FORM' }]) {
      await expect(loadCanvasNavigation({ items: [item], mode: 'local' })).rejects.toThrow('local 模式只接受');
    }
    await expect(loadCanvasNavigation({ items, mode: 'local', signal: { aborted: true } })).rejects.toThrow('取消');
    expect(fetch).not.toHaveBeenCalled();
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
  test.each(['service-management', 'backend-only'])('CLI accepts %s through patch and rejects invalid defaults without writing', mode => {
    const plan = planFixture();
    if (mode === 'backend-only') {
      plan.pages.customPageDetails = [];
      plan.execution.entryRecommendation.mode = mode;
      plan.execution.entryRecommendation.entries.shift();
    }
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
      `execution.entryRecommendation.entries[${mode === 'backend-only' ? 0 : 1}].defaultMenuKey=missing`, '--materialize', '--json'], { encoding: 'utf8' });
    expect(rejected.status).not.toBe(0);
    expect(rejected.stdout + rejected.stderr).toContain('DESIGN_PLAN_INVALID_ENTRY_NAVIGATION');
    expect(fs.readFileSync(file, 'utf8')).toBe(before);
  });
  test.each([
    ['unified', '不分前后台'], ['service-management', '分前后台'],
    ['frontend-only', '只有访问前台'], ['backend-only', '只有访问后台'],
  ])('%s renders its own usage explanation in PRD and HTML', (mode, label) => {
    const plan = planFixture();
    plan.execution.entryRecommendation.mode = mode;
    if (mode === 'frontend-only') { plan.execution.entryRecommendation.entries.pop(); }
    if (mode === 'backend-only' || mode === 'unified') {
      plan.pages.customPageDetails = [];
      plan.execution.entryRecommendation.entries.shift();
      if (mode === 'unified') { plan.execution.entryRecommendation.entries[0].role = 'workspace'; }
    }
    const file = path.join(dir, 'build-plan.json');
    fs.writeFileSync(file, JSON.stringify(plan));
    materialize(file);
    const prd = fs.readFileSync(path.join(dir, 'prd.md'), 'utf8');
    const html = fs.readFileSync(path.join(dir, 'build-plan.html'), 'utf8');
    expect(prd).toContain(`${label}：`);
    expect(html).toContain(`${label}：`);
    if (mode !== 'service-management') {
      expect(prd).not.toContain('两边共享业务数据');
      expect(html).not.toContain('两边共享业务数据');
    }
    expect(JSON.parse(fs.readFileSync(file)).execution.entryModeSummary).toBeUndefined();
  });
  test('initialization preserves entry suggestions and reports unfinished menus', () => {
    const recommendation = { mode: 'service-management', source: 'user_selected', entries: [{ key: 'front', name: '访客端', role: 'service', sceneKey: 'service', taskRefs: ['apply'] }] };
    const brief = { projectName: 'entry-test', intake: { firstBuild: true, sourceDetail: 'detailed', designMode: 'plan', confirmed: true }, openQuestions: [],
      navigation: { type: 'platform-side', source: 'user_selected' }, businessGoals: ['办理业务'],
      pageScenes: [{ key: 'service', name: '业务服务', kind: 'custom-page' }], entryRecommendation: recommendation };
    const file = path.join(dir, 'brief.json'); fs.writeFileSync(file, JSON.stringify(brief));
    const result = initialize(file, { themeId: 'soft-inset-surfaces', outputDir: path.join(dir, 'plan') });
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
