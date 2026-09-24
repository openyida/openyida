'use strict';

const { buildApplicationEntryUrls, buildDisplayPageEntryUrls } = require('../lib/app/application-entry-urls');
const base = { appType: 'APP_TEST', baseUrl: 'https://tenant.aliwork.com/' };

describe('display page entries from persisted navigation', () => {
  test.each([{ renderNav: false }, { renderNav: 'false' }, { isRenderNav: false }, { isRenderNav: 'false' }])('returns a clean standalone URL for %j', config => {
    expect(buildDisplayPageEntryUrls({ ...base, formUuid: 'FORM_PAGE', config: { formType: 'display', ...config } })).toEqual({
      url: 'https://tenant.aliwork.com/APP_TEST/custom/FORM_PAGE',
      standaloneUrl: 'https://tenant.aliwork.com/APP_TEST/custom/FORM_PAGE',
      workbenchUrl: 'https://tenant.aliwork.com/APP_TEST/workbench/FORM_PAGE',
      navigationVerification: { renderNav: false, verified: true },
    });
  });
  test.each([
    [{ renderNav: true, isRenderNav: false }, true],
    [{ renderNav: 'true' }, true],
    [{ renderNav: null, isRenderNav: false }, null],
    [{ renderNav: 'invalid', isRenderNav: false }, null],
    [{}, null],
  ])('does not claim a hidden-navigation entry for %j', (config, renderNav) => {
    expect(buildDisplayPageEntryUrls({ ...base, formUuid: 'FORM_PAGE', config: { formType: 'display', ...config } })).toMatchObject({
      url: 'https://tenant.aliwork.com/APP_TEST/workbench/FORM_PAGE',
      standaloneUrl: null,
      navigationVerification: { renderNav, verified: renderNav !== null },
    });
  });
  test.each([
    { formType: 'receipt', renderNav: false },
    { renderNav: false },
    { formType: 'display', appType: 'APP_OTHER', renderNav: false },
    { formType: 'display', formUuid: 'FORM_OTHER', renderNav: false },
  ])('does not invent display routes for an unknown or mismatched target %j', config => {
    expect(buildDisplayPageEntryUrls({ ...base, formUuid: 'FORM_PAGE', config })).toEqual({});
  });
});

test('returns separate workbench and developer admin routes with the actual app ID', () => {
  expect(buildApplicationEntryUrls(base)).toEqual({
    appUrl: 'https://tenant.aliwork.com/APP_TEST/workbench',
    workbenchUrl: 'https://tenant.aliwork.com/APP_TEST/workbench',
    adminUrl: 'https://tenant.aliwork.com/APP_TEST/admin',
  });
});

test('uses the returned tenant link but does not carry page presentation or credential queries into admin', () => {
  expect(buildApplicationEntryUrls({ ...base, systemLink: 'https://exclusive.aliwork.com/APP_TEST/custom/FORM_A?corpid=corp1&locale=zh_CN&isRenderNav=false&token=secret#view' })).toEqual({
    appUrl: 'https://exclusive.aliwork.com/APP_TEST/workbench?corpid=corp1&locale=zh_CN',
    workbenchUrl: 'https://exclusive.aliwork.com/APP_TEST/workbench?corpid=corp1&locale=zh_CN',
    adminUrl: 'https://exclusive.aliwork.com/APP_TEST/admin?corpid=corp1&locale=zh_CN',
  });
});

test.each(['https://other.test/APP_OTHER/workbench', 'https://other.test/APP_TEST_WRONG/workbench', 'javascript:alert(1)', 'https://user:pass@other.test/APP_TEST/workbench', 'https://[broken'])('ignores an unrelated or invalid optional system link: %s', systemLink => {
  expect(buildApplicationEntryUrls({ ...base, systemLink })).toEqual(buildApplicationEntryUrls(base));
});

test('accepts a relative server link', () => {
  expect(buildApplicationEntryUrls({ ...base, systemLink: '/APP_TEST/workbench?corpid=a%26b' }).adminUrl).toBe('https://tenant.aliwork.com/APP_TEST/admin?corpid=a%26b');
});

test.each(['', undefined, 'APP_TEST/../../other', 'APP_TEST?x=1', 'FORM_TEST'])('does not invent a route for invalid app ID %s', appType => {
  expect(buildApplicationEntryUrls({ ...base, appType })).toEqual({});
});

test.each(['', 'not-a-url', 'file:///tmp/app', 'https://user:pass@tenant.test'])('does not invent a route for invalid base URL %s', baseUrl => {
  expect(buildApplicationEntryUrls({ ...base, baseUrl })).toEqual({});
});

test('accepts a returned tenant application root without a trailing slash', () => {
  expect(buildApplicationEntryUrls({ ...base, systemLink: 'https://exclusive.aliwork.com/APP_TEST' }).adminUrl).toBe('https://exclusive.aliwork.com/APP_TEST/admin');
});
