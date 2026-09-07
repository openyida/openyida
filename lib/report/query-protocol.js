'use strict';

// Self-contained so the CLI and the published browser client execute the same protocol.
function createReportQueryProtocol(messages = {}) {
  function fail(code, message) {
    const error = new Error(message || messages[code] || code);
    error.code = code;
    return error;
  }

  function content(response) {
    if (!response || typeof response !== 'object' || Array.isArray(response)) {throw fail('REPORT_INVALID_RESPONSE');}
    if (response.success === false || response.__needLogin || response.__csrfExpired
      || (response.errorCode && response.errorCode !== '0')) {
      throw fail(String(response.errorCode || 'REPORT_QUERY_FAILED'), response.errorMsg || response.message);
    }
    return Object.prototype.hasOwnProperty.call(response, 'content') ? response.content : response;
  }

  function total(value) {
    if ((typeof value !== 'string' && typeof value !== 'number') || (typeof value === 'string' && !value.trim())) {return null;}
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  }

  function result(response) {
    const body = content(response);
    if (body && body.success === false) {throw fail(String(body.errorCode || 'REPORT_QUERY_FAILED'), body.errorMsg);}
    if (body && body.continuePolling === true) {
      if (typeof body.traceId !== 'string' || !body.traceId) {throw fail('REPORT_TRACE_ID_MISSING');}
      return { pending: true, traceId: body.traceId };
    }
    // Native reports can return null/{} for a completed empty query.
    if (body === null || (body && typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length === 0)) {
      return { pending: false, rows: [], meta: [], totalCount: 0 };
    }
    if (!body || !Array.isArray(body.data)) {throw fail('REPORT_ROWS_MISSING');}
    if (body.meta !== undefined && !Array.isArray(body.meta)) {throw fail('REPORT_META_INVALID');}
    const meta = body.meta || [];
    const rows = body.data.map(row => {
      if (!row || typeof row !== 'object') {throw fail('REPORT_ROW_INVALID');}
      if (!Array.isArray(row)) {return row;}
      if (meta.length !== row.length || meta.some(field => !field || !field.alias)
        || new Set(meta.map(field => field.alias)).size !== meta.length) {
        throw fail('REPORT_META_INVALID');
      }
      return Object.fromEntries(meta.map((field, index) => [field.alias, row[index]]));
    });
    const totalCount = total(body.totalCount);
    if (body.totalCount !== undefined && body.totalCount !== null && totalCount === null) {
      throw fail('REPORT_TOTAL_INVALID');
    }
    return { pending: false, rows, meta, totalCount };
  }

  function schema(value) {
    let current = value;
    for (let depth = 0; depth < 8; depth++) {
      if (typeof current === 'string') {current = JSON.parse(current); continue;}
      if (!current || typeof current !== 'object') {break;}
      if (Array.isArray(current.pages) || Array.isArray(current.componentsTree)) {return current;}
      if (current.componentName) {return { componentsTree: [current] };}
      if (Object.prototype.hasOwnProperty.call(current, 'content')) {current = content(current); continue;}
      if (current.schemaBody !== undefined) {current = current.schemaBody; continue;}
      if (current.schema !== undefined) {current = current.schema; continue;}
      break;
    }
    throw fail('REPORT_SCHEMA_INVALID');
  }

  function valuesByKey(value, key, output = new Set()) {
    if (!value || typeof value !== 'object') {return output;}
    if (typeof value[key] === 'string' && value[key]) {output.add(value[key]);}
    Object.values(value).forEach(child => valuesByKey(child, key, output));
    return output;
  }

  function bindings(value, reportId) {
    const definition = schema(value);
    const targets = [];
    function visit(node, page) {
      if (!node || typeof node !== 'object') {return;}
      const props = node.props || {};
      const models = props.dataSetModelMap || {};
      Object.entries(models).forEach(([dataSetKey, model]) => {
        if (!model || typeof model !== 'object' || !node.componentName) {return;}
        targets.push({
          reportId,
          pageId: reportId,
          prdId: definition.prdId || (definition.config || {}).prdId || page.prdId || (page.props || {}).prdId || null,
          cid: props.cid || node.cid || node.id || null,
          className: node.componentName,
          dataSetKey,
          filterKeys: [...valuesByKey(model, 'filterKey')],
          aliases: [...valuesByKey(model, 'alias')],
          staticOrderByList: (model.dataViewQueryModel || {}).orderByList || [],
          usesVariables: [...valuesByKey(model, 'filterType')].includes('variable'),
          model,
        });
      });
      (node.children || []).forEach(child => visit(child, page));
    }
    (definition.pages || [definition]).forEach(page => {
      (page.componentsTree || []).forEach(root => visit(root, page));
    });
    return targets;
  }

  function findNavigation(response, appType, reportId) {
    const matches = [];
    function visit(node) {
      if (!node || typeof node !== 'object') {return;}
      if (node.formUuid === reportId) {matches.push(node);}
      Object.values(node).forEach(visit);
    }
    visit(content(response));
    if (matches.length !== 1) {throw fail('REPORT_NAVIGATION_NOT_UNIQUE');}
    const match = matches[0];
    if (match.appType && match.appType !== appType) {throw fail('REPORT_APP_MISMATCH');}
    const prdId = match.topicId || match.prdId;
    if (!prdId) {throw fail('REPORT_TOPIC_MISSING');}
    return String(prdId);
  }

  function parameters(target, query = {}) {
    for (const key of ['prdId', 'reportId', 'cid', 'className', 'dataSetKey']) {
      if (!target[key]) {throw fail('REPORT_BINDING_INCOMPLETE');}
    }
    if (target.usesVariables) {throw fail('REPORT_VARIABLES_UNSUPPORTED');}
    const filters = query.filters || {};
    if (!filters || typeof filters !== 'object' || Array.isArray(filters)
      || Object.keys(filters).some(key => !(target.filterKeys || []).includes(key) || !Array.isArray(filters[key]))) {
      throw fail('REPORT_FILTER_INVALID');
    }
    const start = query.start === undefined ? 0 : query.start;
    const limit = query.limit === undefined ? 50 : query.limit;
    if (!Number.isInteger(start) || start < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw fail('REPORT_PAGING_INVALID');
    }
    let orderByList = query.orderByList || [];
    if (!Array.isArray(orderByList) || orderByList.some(order => !order
      || !(target.aliases || []).includes(order.alias) || !['ASC', 'DESC'].includes(order.orderType))) {
      throw fail('REPORT_ORDER_INVALID');
    }
    // Match the native report: explicit sorting overrides the same alias, retaining other defaults.
    orderByList = orderByList.concat((target.staticOrderByList || []).filter(order => order
      && ['ASC', 'DESC'].includes(order.orderType) && !orderByList.some(item => item.alias === order.alias)));
    return {
      prdId: target.prdId, pageId: target.reportId, cid: target.cid,
      componentClassName: target.className, dataSetKey: target.dataSetKey,
      draft: 'false', visualType: 'TOPIC',
      queryContext: JSON.stringify({
        aliasList: [], filterValueMap: filters, dim2table: true, orderByList,
        needTotalCount: true, variableParams: {}, paging: { start, limit },
      }),
    };
  }

  function abortError() {return fail('REPORT_ABORTED');}

  function delay(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal && signal.aborted) {reject(abortError()); return;}
      function abort() {clearTimeout(timer); reject(abortError());}
      const timer = setTimeout(() => {
        if (signal) {signal.removeEventListener('abort', abort);}
        resolve();
      }, ms);
      if (signal) {signal.addEventListener('abort', abort, { once: true });}
    });
  }

  // Deadline bounds both the initial request and all cache requests, including a hung transport.
  async function query(request, params, options = {}) {
    const timeoutMs = options.timeoutMs === undefined ? 90000 : options.timeoutMs;
    const pollIntervalMs = options.pollIntervalMs === undefined ? 3000 : options.pollIntervalMs;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || !Number.isFinite(pollIntervalMs) || pollIntervalMs <= 0) {
      throw fail('REPORT_TIMING_INVALID');
    }
    const controller = new AbortController();
    const signal = controller.signal;
    const external = options.signal;
    let rejectDeadline;
    let timedOut = false;
    const deadline = new Promise((resolve, reject) => {rejectDeadline = reject;});
    function abort() {controller.abort(); rejectDeadline(abortError());}
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      rejectDeadline(fail('REPORT_TIMEOUT'));
    }, timeoutMs);
    if (external) {external.addEventListener('abort', abort, { once: true });}
    try {
      if (external && external.aborted) {throw abortError();}
      return await Promise.race([deadline, (async () => {
        let output = result(await request('getDataAsync', params, signal));
        while (output.pending) {
          await delay(pollIntervalMs, signal);
          if (signal.aborted) {throw abortError();}
          output = result(await request('getCacheData', { traceId: output.traceId }, signal));
        }
        if (signal.aborted) {throw abortError();}
        const start = params.queryContext ? ((JSON.parse(params.queryContext).paging || {}).start || 0) : 0;
        if (output.totalCount > 0 && output.rows.length === 0 && start < output.totalCount) {
          throw fail('REPORT_EMPTY_RESULT_MISMATCH');
        }
        return output;
      })()]);
    } catch (error) {
      if (timedOut) {throw fail('REPORT_TIMEOUT');}
      throw error;
    } finally {
      clearTimeout(timer);
      if (external) {external.removeEventListener('abort', abort);}
      controller.abort();
    }
  }

  function stableKey(value) {
    if (Array.isArray(value)) {return '[' + value.map(stableKey).join(',') + ']';}
    if (value && typeof value === 'object') {
      return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableKey(value[key])).join(',') + '}';
    }
    return JSON.stringify(value);
  }

  return { fail, content, total, result, schema, bindings, findNavigation, parameters, query, stableKey };
}

module.exports = { createReportQueryProtocol };
