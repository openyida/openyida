'use strict';

const { buildCommandManifest } = require('../lib/core/command-manifest');
const { buildPageNavigationPolicy, getPageNavigationContract } = require('../lib/design-plan/navigation-policy');
const { renderPrd, renderDesign } = require('../lib/design-plan/materialize');
const fixture = require('./fixtures/design-plan.json');
const contract = () => buildCommandManifest().summary.core_workflows.full_app_build.entry_navigation_contract.page_navigation_policy;

const cases = [
  ['platform-top', { entryMode: 'platform-shell' }, 'platform_shell'],
  ['platform-side', { entryMode: 'platform-shell' }, 'platform_shell'],
  ['platform-l-shape', { entryMode: 'platform-shell' }, 'platform_shell'],
  ['custom', { entryMode: 'standalone' }, 'page_owned'],
  ['platform-side', { entryMode: 'standalone', navigation: { type: 'custom', variant: 'top', reason: '独立访客菜单' } }, 'page_owned'],
  ['platform-side', { entryMode: 'standalone', navigation: { type: 'none', reason: '单步办理' } }, 'no_menu'],
  ['custom', { entryMode: 'standalone', navigation: { type: 'none', reason: '单页专注任务' } }, 'no_menu'],
  ['platform-side', { entryMode: 'standalone' }, 'no_menu'],
];

test.each(cases)('CLI contract and materialized handoff agree for %s / %j', (applicationType, spec, expected) => {
  const plan = JSON.parse(JSON.stringify(fixture));
  plan.execution = { ...plan.execution, appConfig: { navigationType: applicationType } };
  plan.pages.customPageDetails[0].pageSpecHandoff = spec;
  const result = JSON.parse(renderPrd(plan).match(/```json\n([\s\S]*?)\n```/)[1]);
  const policy = result.pages[0].navigationPolicy;
  expect(policy).toEqual(contract()[expected]);
  expect(policy).toEqual(buildPageNavigationPolicy(spec, applicationType));
  expect(result.appConfig.hideAppNav).toBe(applicationType === 'custom' ? 'y' : 'n');
  if (applicationType === 'platform-side' && spec.entryMode === 'standalone' && !spec.navigation) {
    expect(renderDesign(plan)).toContain('未规划应用菜单，仅实现业务内容');
    expect(policy.renderApplicationMenu).toBe(false);
    expect(policy.localTabs).toBe('same-task-only');
  }
});

test('policy results and manifest metadata do not share mutable state', () => {
  const first = buildPageNavigationPolicy({ entryMode: 'platform-shell' }, 'platform-side');
  first.renderApplicationMenu = true;
  expect(buildPageNavigationPolicy({ entryMode: 'platform-shell' }, 'platform-side').renderApplicationMenu).toBe(false);
  expect(contract()).toEqual(getPageNavigationContract());
});

test('a platform page still rejects an explicitly conflicting custom menu', () => {
  const plan = JSON.parse(JSON.stringify(fixture));
  plan.execution = { ...plan.execution, appConfig: { navigationType: 'platform-side' } };
  plan.pages.customPageDetails[0].pageSpecHandoff = {
    entryMode: 'platform-shell', navigation: { type: 'custom', variant: 'top', reason: '重复菜单' },
  };
  expect(() => renderPrd(plan)).toThrow(/不能叠加平台导航/);
});
