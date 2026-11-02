'use strict';

/* global window */

function createTaskCenterLoader(contract, resolveBridge, requestJson) {
  async function fetchPage(request) {
    const fetcher = typeof window !== 'undefined' && typeof window.fetch === 'function' ? window.fetch.bind(window)
      : typeof fetch === 'function' ? fetch : null;
    if (!fetcher) {
      const error = new Error('TASK_API_UNAVAILABLE');
      error.code = 'TASK_API_UNAVAILABLE';
      throw error;
    }
    const response = await fetcher(request.path + '?' + new URLSearchParams(request.params).toString(), {
      method: 'GET', credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' },
    });
    if (!response || response.ok !== true || typeof response.json !== 'function') {
      const error = new Error('TASK_REQUEST_FAILED');
      error.code = 'TASK_REQUEST_FAILED';
      throw error;
    }
    try { return await response.json(); } catch {
      const error = new Error('TASK_RESPONSE_INVALID');
      error.code = 'TASK_RESPONSE_INVALID';
      throw error;
    }
  }
  async function load(kind, options) {
    const request = contract.request(kind, options);
    if (requestJson || request.transport === 'app-query') {
      const payload = await (requestJson || fetchPage)(request);
      return contract.normalize(payload, { ...options, kind: request.kind, transport: request.transport });
    }
    const bridge = await resolveBridge();
    if (!bridge || typeof bridge[request.method] !== 'function'
      || (Array.isArray(bridge.availableMethods) && !bridge.availableMethods.includes(request.method))) {
      const error = new Error('TASK_API_UNAVAILABLE');
      error.code = 'TASK_API_UNAVAILABLE';
      throw error;
    }
    const payload = await bridge[request.method](request.params);
    return contract.normalize(payload, { ...options, kind: request.kind });
  }
  load.count = async function count(kind, options) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      const error = new Error('TASK_FILTER_INVALID: options'); error.code = 'TASK_FILTER_INVALID'; throw error;
    }
    if (options.page !== undefined || options.pageSize !== undefined) {
      const error = new Error('TASK_FILTER_UNSUPPORTED: pagination');
      error.code = 'TASK_FILTER_UNSUPPORTED';
      throw error;
    }
    if (options.scope === 'corp') {
      const request = contract.corpCountRequest(kind, options);
      const payload = await (requestJson || fetchPage)(request);
      return contract.corpCount(payload, kind, request.filters);
    }
    const canonical = contract.kindOf(kind);
    const { appType, transport, ...filters } = options;
    const normalizedFilters = contract.normalizeFilters(canonical, filters, transport);
    const result = await load(canonical, { appType, transport, ...normalizedFilters, page: 1, pageSize: 1 });
    return { appType, kind: canonical, total: result.total, available: result.total !== null,
      basis: 'server-total', scope: 'current-visitor-in-app', filters: normalizedFilters };
  };
  return load;
}

module.exports = { createTaskCenterLoader };
