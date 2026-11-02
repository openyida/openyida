'use strict';

// Shared by the CLI and the published page bridge; scope is always explicit.
function createTaskCenterNavigation() {
  const kinds = {
    todo: { tab: 'running', nav: 'NAV-SYSTEM-RUNNING-UUID' },
    created: { tab: 'fromMe', nav: 'NAV-SYSTEM-FROM-ME-UUID' },
    done: { tab: 'done', nav: 'NAV-SYSTEM-DONE-UUID' },
    cc: { tab: 'notifyMe', nav: 'NAV-SYSTEM-NOTIFY-ME-UUID' },
  };
  function fail(field) {
    const error = new Error('TASK_LINK_INVALID: ' + field);
    error.code = 'TASK_LINK_INVALID';
    throw error;
  }
  function target(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) { fail('options'); }
    for (const key of Object.keys(input)) {
      if (!['scope', 'appType', 'kind', 'baseUrl', 'mode'].includes(key)) { fail(key); }
    }
    const { scope, appType } = input;
    const kind = input.kind === 'submitted' ? 'created' : input.kind;
    if (!Object.prototype.hasOwnProperty.call(kinds, kind)) { fail('kind'); }
    if (!['app', 'corp'].includes(scope)) { fail('scope'); }
    if (scope === 'app' && (typeof appType !== 'string' || !/^APP_[A-Za-z0-9_-]+$/.test(appType))) { fail('appType'); }
    if (scope === 'corp' && appType !== undefined) { fail('appType'); }
    let origin;
    try { origin = new URL(input.baseUrl); } catch { fail('baseUrl'); }
    if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password) { fail('baseUrl'); }
    const mode = input.mode === undefined ? 'auto' : input.mode;
    if (!['auto', 'dingtalk', 'browser'].includes(mode)) { fail('mode'); }
    const definition = kinds[kind];
    const url = new URL(scope === 'app' ? '/' + appType + '/workbench/' + definition.nav : '/taskCenter.html', origin.origin);
    if (scope === 'app') { url.searchParams.set('showTodoTab', 'true'); } else { url.searchParams.set('tab', definition.tab); }
    if (mode === 'dingtalk') { url.searchParams.set('ddtab', 'true'); }
    return { scope, appType: scope === 'app' ? appType : null, kind, pageUrl: url.href, mode };
  }
  return { target };
}

module.exports = { createTaskCenterNavigation, ...createTaskCenterNavigation() };
