'use strict';

// No Node dependencies: this factory is installed by the Canvas schema builder.
function createCanvasReportRuntime(protocol, win) {
  function appScope() {
    const path = win.location.pathname;
    const match = path.match(/^\/(?:alibaba|dingtalk)\/web\/([^/]+)/) || path.match(/^\/(APP_[^/]+)/);
    const appType = match && match[1];
    if (!appType) {throw protocol.fail('REPORT_APP_CONTEXT_MISSING');}
    return appType;
  }

  function csrf() {
    const configs = [win.g_config, win.pageConfig, win.__YIDA__, win.YIDA_CONFIG];
    for (const config of configs) {
      if (!config) {continue;}
      for (const key of ['_csrf_token', 'csrfToken', 'csrf_token']) {
        if (typeof config[key] === 'string' && config[key]) {return config[key];}
      }
    }
    const match = (win.document.cookie || '').match(/(?:^|;\s*)(?:tianshu_csrf_token|aliwork_csrf_token|XSRF-TOKEN|_csrf_token)=([^;]+)/);
    if (match) {return decodeURIComponent(match[1]);}
    throw protocol.fail('REPORT_CSRF_MISSING');
  }

  async function post(appType, suffix, params, signal, navigation = false) {
    if (appType !== appScope()) {throw protocol.fail('REPORT_APP_MISMATCH');}
    const token = csrf();
    const body = new URLSearchParams({ ...params, _csrf_token: token, _csrf: token });
    const url = (navigation ? '/dingtalk/web/' : '/alibaba/web/') + encodeURIComponent(appType) + '/' + suffix;
    const response = await win.fetch(url + (navigation ? '?' + body.toString() : ''), {
      method: navigation ? 'GET' : 'POST', credentials: 'include', signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', global_csrf_token: token },
      ...(navigation ? {} : { body: body.toString() }),
    });
    if (!response.ok) {throw protocol.fail('REPORT_HTTP_' + response.status);}
    if (response.redirected) {throw protocol.fail('REPORT_LOGIN_REDIRECT');}
    let payload;
    try {payload = await response.json();} catch {throw protocol.fail('REPORT_JSON_INVALID');}
    protocol.content(payload);
    return payload;
  }

  function createBridge(binding, options = {}) {
    options = { ...options };
    for (const key of ['timeoutMs', 'pollIntervalMs']) {
      if (options[key] !== undefined && (!Number.isFinite(options[key]) || options[key] <= 0)) {
        throw protocol.fail('REPORT_TIMING_INVALID');
      }
    }
    const fixed = JSON.parse(JSON.stringify(binding));
    if (fixed.mode !== 'report' || !fixed.reportUuid || !fixed.cid || !fixed.componentClassName || !fixed.dataSetKey) {
      throw protocol.fail('REPORT_BINDING_INCOMPLETE');
    }
    if (fixed.appType !== appScope()) {throw protocol.fail('REPORT_APP_MISMATCH');}
    let state = { loading: false, error: null, rows: [], meta: [], totalCount: null, lastUpdatedAt: null, appliedQuery: null };
    const listeners = new Set();
    let active = null;
    let generation = 0;
    let disposed = false;
    function update(patch) {
      state = { ...state, ...patch };
      listeners.forEach(listener => listener(state));
    }
    function cancel() {
      generation++;
      if (active) {active.controller.abort(); active = null;}
      if (!disposed) {update({ loading: false });}
    }

    async function resolveTarget(signal) {
      const navigation = await post(fixed.appType, 'query/formnav/getFormNavigationListByOrder.json', {}, signal, true);
      const prdId = protocol.findNavigation(navigation, fixed.appType, fixed.reportUuid);
      const response = await post(fixed.appType, 'visual/topicVersionPageRpc/getPage.json', {
        topicId: prdId, pageCode: fixed.reportUuid, isPreview: 'false',
      }, signal);
      const schema = protocol.schema(response);
      if (schema.id && schema.id !== fixed.reportUuid) {throw protocol.fail('REPORT_SCHEMA_ID_MISMATCH');}
      const matches = protocol.bindings(schema, fixed.reportUuid).filter(target => target.cid === fixed.cid
        && target.className === fixed.componentClassName && target.dataSetKey === fixed.dataSetKey);
      if (matches.length !== 1) {throw protocol.fail('REPORT_BINDING_NOT_FOUND');}
      return { ...matches[0], prdId };
    }

    function refresh(query = {}) {
      if (disposed) {return Promise.reject(protocol.fail('REPORT_DISPOSED'));}
      const key = protocol.stableKey(query);
      if (active && active.key === key) {return active.promise;}
      cancel();
      const id = generation;
      const controller = new AbortController();
      const job = { key, controller, promise: null };
      active = job;
      const snapshot = JSON.parse(JSON.stringify(query));
      update({ loading: true, error: null });
      const timeoutMs = options.timeoutMs === undefined ? 90000 : options.timeoutMs;
      let timer;
      let timedOut = false;
      let abort;
      const deadline = new Promise((resolve, reject) => {
        abort = () => reject(protocol.fail(timedOut ? 'REPORT_TIMEOUT' : 'REPORT_ABORTED'));
        controller.signal.addEventListener('abort', abort, { once: true });
        timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
          reject(protocol.fail('REPORT_TIMEOUT'));
        }, timeoutMs);
      });
      const work = (async () => {
        const target = await resolveTarget(controller.signal);
        if (controller.signal.aborted) {throw protocol.fail('REPORT_ABORTED');}
        return protocol.query((method, params, signal) => post(fixed.appType,
          'visual/visualizationDataRpc/' + method + '.json', params, signal),
        protocol.parameters(target, snapshot), { ...options, signal: controller.signal });
      })();
      job.promise = Promise.race([work, deadline]).then(output => {
        if (disposed || id !== generation) {throw protocol.fail('REPORT_ABORTED');}
        update({ ...output, loading: false, error: null, lastUpdatedAt: Date.now(), appliedQuery: snapshot });
        return state;
      }).catch(error => {
        const failure = timedOut ? protocol.fail('REPORT_TIMEOUT') : error;
        if (!disposed && id === generation) {
          update({ loading: false, error: { code: failure.code || 'REPORT_REQUEST_FAILED', message: failure.message } });
        }
        throw failure;
      }).finally(() => {
        clearTimeout(timer);
        controller.signal.removeEventListener('abort', abort);
        if (active === job) {active = null;}
      });
      return job.promise;
    }

    return {
      refresh, cancel,
      getSnapshot: () => state,
      subscribe(listener) {listeners.add(listener); return () => listeners.delete(listener);},
      dispose() {disposed = true; cancel(); listeners.clear();},
    };
  }

  return Object.freeze({ version: 1, createBridge });
}

module.exports = { createCanvasReportRuntime };
