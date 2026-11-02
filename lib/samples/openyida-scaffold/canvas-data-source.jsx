import React from 'react';

// Merge into one Canvas file. Bind verified app/form IDs; retain the business UI.
// Read-only, one page per request. No credentials, seed data or automatic retries.
function getCanvasBridge(key, method) {
  let target = window;
  const seen = [];
  while (target && !seen.includes(target)) {
    seen.push(target);
    try {
      if (target !== window && (!window.location.origin || window.location.origin === 'null'
        || target.location.origin !== window.location.origin)) return null;
      const bridge = target[key];
      if (bridge && typeof bridge[method] === 'function') return bridge;
      const parent = target.parent;
      if (!parent || parent === target) return null;
      target = parent;
    } catch { return null; }
  }
  return null;
}

function canvasDataError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function normalizeCanvasFormPage(payload, currentPage = 1, pageSize = 50) {
  const queue = [payload], seen = new Set(), arrays = new Set(), counts = new Set();
  while (queue.length) {
    const item = queue.shift();
    if (!item || typeof item !== 'object' || seen.has(item)) continue;
    if (seen.size >= 32) throw canvasDataError('DATA_RESPONSE_TOO_DEEP');
    seen.add(item);
    if (Array.isArray(item)) { arrays.add(item); continue; }
    if (item.success === false) throw canvasDataError('DATA_QUERY_FAILED');
    for (const key of ['totalCount', 'total', 'count']) {
      if (!Object.prototype.hasOwnProperty.call(item, key) || item[key] === null) continue;
      const raw = item[key];
      if (!(typeof raw === 'number' || typeof raw === 'string' && /^\d+$/.test(raw))) {
        throw canvasDataError('DATA_TOTAL_INVALID');
      }
      const count = Number(raw);
      if (!Number.isSafeInteger(count) || count < 0) throw canvasDataError('DATA_TOTAL_INVALID');
      counts.add(count);
    }
    for (const key of ['data', 'list', 'values', 'records', 'result', 'content', 'value']) {
      if (item[key] && typeof item[key] === 'object') queue.push(item[key]);
    }
  }
  if (arrays.size !== 1 || counts.size > 1) throw canvasDataError('DATA_RESPONSE_UNRECOGNIZED');
  const rows = [...arrays][0];
  if (!rows.every(row => row && typeof row === 'object' && !Array.isArray(row))) {
    throw canvasDataError('DATA_ROWS_INVALID');
  }
  const totalCount = counts.size ? [...counts][0] : null;
  if (totalCount !== null && (rows.length && (currentPage - 1) * pageSize + rows.length > totalCount
    || totalCount > (currentPage - 1) * pageSize && !rows.length)) {
    throw canvasDataError('DATA_ROWS_MISSING');
  }
  // Preserve raw field values, including zero. Missing totals stay unknown.
  return { rows, totalCount, currentPage, pageSize };
}

async function queryCanvasFormPage(binding, request = {}) {
  if (!binding || typeof binding !== 'object' || !request || typeof request !== 'object') {
    throw canvasDataError('DATA_BINDING_INVALID');
  }
  const currentPage = request.currentPage === undefined ? 1 : request.currentPage;
  const pageSize = request.pageSize === undefined ? binding.pageSize === undefined ? 50 : binding.pageSize : request.pageSize;
  const query = request.query === undefined ? binding.query === undefined ? [] : binding.query : request.query;
  if (binding.mode !== undefined && binding.mode !== 'form'
    || !/^APP_[A-Za-z0-9_-]+$/.test(binding.appType || '')
    || typeof binding.formUuid !== 'string' || !binding.formUuid.trim()
    || !Number.isSafeInteger(currentPage) || currentPage < 1
    || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100
    || !query || typeof query !== 'object'
    || binding.dynamicOrder !== undefined && typeof binding.dynamicOrder !== 'string') {
    throw canvasDataError('DATA_BINDING_INVALID');
  }
  const bridge = getCanvasBridge('__OPENYIDA_YIDA_API__', 'searchFormDatas');
  if (!bridge) throw canvasDataError('DATA_BRIDGE_UNAVAILABLE');
  let payload;
  try {
    payload = await bridge.searchFormDatas({
      appType: binding.appType, formUuid: binding.formUuid, currentPage, pageSize,
      searchFieldJson: JSON.stringify(query), dynamicOrder: binding.dynamicOrder || '',
    });
  } catch { throw canvasDataError('DATA_QUERY_FAILED'); }
  return normalizeCanvasFormPage(payload, currentPage, pageSize);
}

function useCanvasFormData(binding, request = {}) {
  // Keep binding/request as JSON data. Equal configurations do not refetch on render.
  const key = JSON.stringify({ binding, request });
  const source = React.useRef(null);
  const [revision, setRevision] = React.useState(0);
  const [state, setState] = React.useState({
    rows: [], totalCount: null, loading: true, refreshing: false, error: null, lastUpdatedAt: null,
  });
  React.useEffect(() => {
    let active = true, settled = false;
    const sameSource = source.current === key;
    source.current = key;
    setState(previous => sameSource && previous.lastUpdatedAt !== null
      ? { ...previous, loading: false, refreshing: true, error: null }
      : { rows: [], totalCount: null, loading: true, refreshing: false, error: null, lastUpdatedAt: null });
    const timeoutMs = request.timeoutMs === undefined ? 15000 : request.timeoutMs;
    let timer;
    const finish = (data, error) => {
      if (!active || settled) return;
      settled = true;
      clearTimeout(timer);
      setState(previous => error
        ? { ...previous, loading: false, refreshing: false, error }
        : { ...data, loading: false, refreshing: false, error: null, lastUpdatedAt: Date.now() });
    };
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) {
      finish(null, canvasDataError('DATA_TIMEOUT_INVALID'));
    } else {
      timer = setTimeout(() => finish(null, canvasDataError('DATA_QUERY_TIMEOUT')), timeoutMs);
      Promise.resolve().then(() => active ? queryCanvasFormPage(binding, request) : null)
        .then(data => finish(data, null), error => finish(null, canvasDataError([
          'DATA_BINDING_INVALID', 'DATA_BRIDGE_UNAVAILABLE', 'DATA_QUERY_FAILED', 'DATA_RESPONSE_TOO_DEEP',
          'DATA_TOTAL_INVALID', 'DATA_RESPONSE_UNRECOGNIZED', 'DATA_ROWS_INVALID', 'DATA_ROWS_MISSING',
        ].includes(error && error.code) ? error.code : 'DATA_QUERY_FAILED')));
    }
    // The host bridge has no cancellation contract. Ignore late replies after
    // timeout, configuration changes or unmount; do not claim transport abort.
    return () => { active = false; clearTimeout(timer); };
  }, [key, revision]);
  const refetch = React.useCallback(() => setRevision(value => value + 1), []);
  return { ...state, refetch };
}
