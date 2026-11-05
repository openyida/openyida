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

// Only call for a Schema-confirmed AssociationFormField, never ordinary text.
// Platform `_id` projections can wrap the array in two JSON string envelopes.
function parseCanvasAssociationValue(value) {
  if (value === undefined || value === null || value === '') return [];
  for (let depth = 0; depth < 2 && typeof value === 'string' && value !== ''; depth++) {
    try { value = JSON.parse(value); } catch { throw canvasDataError('DATA_ASSOCIATION_INVALID'); }
  }
  if (value === null || value === '') return [];
  if (!Array.isArray(value) || !value.every(item => item && typeof item === 'object'
    && !Array.isArray(item) && typeof item.instanceId === 'string' && item.instanceId.trim()
    && ['appType', 'formUuid', 'formType'].every(key => !Object.prototype.hasOwnProperty.call(item, key)
      || typeof item[key] === 'string' && item[key].trim()))
    || new Set(value.map(item => item.instanceId)).size !== value.length) {
    throw canvasDataError('DATA_ASSOCIATION_INVALID');
  }
  return value;
}

// Use only for a Schema-confirmed association field. titleById is an optional
// dictionary built from records the page already loaded; this reader never queries.
function readCanvasAssociation(row, fieldId, titleById) {
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  let items = [], instanceIds = [];
  try {
    if (!object(row) || typeof fieldId !== 'string' || !fieldId.trim()
      || titleById !== undefined && titleById !== null && !object(titleById)) {
      throw canvasDataError('DATA_ASSOCIATION_INVALID');
    }
    const data = own(row, 'formData') ? row.formData : row;
    if (!object(data)) throw canvasDataError('DATA_ASSOCIATION_INVALID');
    let value;
    if (own(data, fieldId)) value = data[fieldId];
    else if (own(data, fieldId + '_id')) value = data[fieldId + '_id'];
    else if (row.instValue !== undefined && row.instValue !== null && row.instValue !== '') {
      let entries = row.instValue;
      if (typeof entries === 'string') {
        try { entries = JSON.parse(entries); } catch { throw canvasDataError('DATA_ASSOCIATION_INVALID'); }
      }
      if (!Array.isArray(entries)) throw canvasDataError('DATA_ASSOCIATION_INVALID');
      const matches = entries.filter(entry => object(entry) && entry.fieldId === fieldId);
      if (matches.length > 1) throw canvasDataError('DATA_ASSOCIATION_INVALID');
      if (matches.length && matches[0].componentName !== undefined
        && matches[0].componentName !== 'AssociationFormField') throw canvasDataError('DATA_ASSOCIATION_INVALID');
      if (matches.length && object(matches[0].fieldData)) value = matches[0].fieldData.value;
    }
    // Missing/hidden fields are not evidence that the association is empty.
    // Explicit null, empty string and [] are authoritative clears, even if an
    // older projection or instValue still contains a record.
    if (value === undefined) throw canvasDataError('DATA_ASSOCIATION_UNAVAILABLE');
    items = parseCanvasAssociationValue(value);
    instanceIds = items.map(item => item.instanceId);
    const titles = items.map(item => {
      const title = titleById && own(titleById, item.instanceId) ? titleById[item.instanceId] : item.title;
      if (typeof title !== 'string' || !title.trim()) throw canvasDataError('DATA_ASSOCIATION_TITLE_UNAVAILABLE');
      return title;
    });
    return { status: items.length ? 'ready' : 'empty', items, instanceIds, titles, error: null };
  } catch (error) {
    return { status: 'error', items, instanceIds, titles: [],
      error: { code: ['DATA_ASSOCIATION_UNAVAILABLE', 'DATA_ASSOCIATION_TITLE_UNAVAILABLE'].includes(error && error.code)
        ? error.code : 'DATA_ASSOCIATION_INVALID', fieldId } };
  }
}

// Schema-confirmed TableField only. Preserve same-response raw cells so an
// omitted empty association can be distinguished from a missing/hidden field.
// Same contract as lib/app/subform-readback.js. Hidden filtering emits data:[].
function isOmittedEmptySubformPage(response) {
  const page = response && response.content;
  return response?.success === true && page !== null && typeof page === 'object' && !Array.isArray(page)
    && page.currentPage === 1 && page.totalCount === 0
    && Object.keys(page).every(key => ['idCursor', 'currentPage', 'totalCount'].includes(key))
    && !['data', 'dataList', 'rows'].some(key => Object.prototype.hasOwnProperty.call(page, key));
}

function readCanvasSubformRows(row, fieldId) {
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const failure = code => ({ status: 'error', rows: [], error: { code, fieldId } });
  if (!object(row) || typeof fieldId !== 'string' || !fieldId.trim()) return failure('DATA_SUBFORM_INVALID');
  const data = own(row, 'formData') ? row.formData : row;
  if (!object(data)) return failure('DATA_SUBFORM_INVALID');
  if (!own(data, fieldId)) return failure('DATA_SUBFORM_UNAVAILABLE');
  let rows = data[fieldId];
  for (let depth = 0; depth < 2 && typeof rows === 'string' && rows !== ''; depth++) {
    try { rows = JSON.parse(rows); } catch { return failure('DATA_SUBFORM_INVALID'); }
  }
  if (rows === null || rows === '') rows = [];
  if (!Array.isArray(rows) || !rows.every(object)) return failure('DATA_SUBFORM_INVALID');
  if (!rows.length) return { status: 'empty', rows: [], error: null };
  let entries = row.instValue;
  if (entries !== undefined && entries !== null && entries !== '') {
    if (typeof entries === 'string') {
      try { entries = JSON.parse(entries); } catch { return failure('DATA_SUBFORM_INVALID'); }
    }
    if (!Array.isArray(entries)) return failure('DATA_SUBFORM_INVALID');
    const matches = entries.filter(entry => object(entry) && entry.fieldId === fieldId);
    if (matches.length > 1) return failure('DATA_SUBFORM_INVALID');
    if (matches.length) {
      const table = matches[0];
      if (table.componentName !== 'TableField' || !object(table.fieldData)
        || !Array.isArray(table.fieldData.value) || table.fieldData.value.length !== rows.length) {
        return failure('DATA_SUBFORM_INVALID');
      }
      const rawRows = table.fieldData.value;
      const rowIds = new Set();
      for (let index = 0; index < rows.length; index++) {
        const cells = rawRows[index];
        if (!Array.isArray(cells) || !cells.every(object)) return failure('DATA_SUBFORM_INVALID');
        const ids = [...new Set(cells.map(cell => cell.rowId).filter(id => typeof id === 'string' && id))];
        if (ids.length > 1 || own(rows[index], 'rowId') && (ids.length !== 1 || rows[index].rowId !== ids[0])) {
          return failure('DATA_SUBFORM_INVALID');
        }
        if (ids.length && rowIds.has(ids[0])) return failure('DATA_SUBFORM_INVALID');
        if (ids.length) rowIds.add(ids[0]);
        for (const cell of cells) {
          if (['TextField', 'TextareaField'].includes(cell.componentName) && own(rows[index], cell.fieldId)
            && typeof rows[index][cell.fieldId] === 'string' && typeof cell.fieldData?.value === 'string'
            && rows[index][cell.fieldId] !== cell.fieldData.value) return failure('DATA_SUBFORM_INVALID');
        }
      }
      rows = rows.map((item, index) => ({ ...item,
        instValue: own(item, 'instValue') ? item.instValue : rawRows[index] }));
    }
  }
  return { status: 'ready', rows, error: null };
}

async function readCanvasMissingSubform(binding, row, fieldId, timeoutMs) {
  const instanceId = binding.mode === 'process' ? row.processInstanceId : row.formInstId;
  if (typeof instanceId !== 'string' || !instanceId.trim()
    || row.formUuid !== undefined && row.formUuid !== binding.formUuid) return false;
  const sources = [window.g_config, window.pageConfig, window.__YIDA__, window.__YIDA__?.config];
  let csrf = '';
  for (const source of sources) {
    for (const key of ['_csrf_token', 'csrfToken', 'csrf_token', 'global_csrf_token']) {
      if (typeof source?.[key] === 'string' && source[key]) {csrf = source[key]; break;}
    }
    if (csrf) break;
  }
  if (!csrf && typeof document !== 'undefined') {
    const match = (document.cookie || '').match(/(?:^|;\s*)(?:tianshu_csrf_token|aliwork_csrf_token|XSRF-TOKEN|_csrf_token|csrfToken)=([^;]+)/);
    if (match) {try {csrf = decodeURIComponent(match[1]);} catch {return false;}}
  }
  if (!csrf || typeof window.fetch !== 'function' || typeof AbortController !== 'function') return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const params = new URLSearchParams({ formUuid: binding.formUuid, formInstanceId: instanceId,
      tableFieldId: fieldId, currentPage: '1', pageSize: '1', _csrf_token: csrf });
    const response = await window.fetch(`/dingtalk/web/${binding.appType}/v1/form/listTableDataByFormInstIdAndTableId.json?${params}`, {
      credentials: 'include', headers: { global_csrf_token: csrf }, signal: controller.signal,
    });
    return response.ok && isOmittedEmptySubformPage(await response.json());
  } catch {return false;} finally {clearTimeout(timer);}
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
  const subformDeadline = Date.now() + (request.timeoutMs || 15000);
  if (binding.mode !== undefined && !['form', 'process'].includes(binding.mode)
    || !/^APP_[A-Za-z0-9_-]+$/.test(binding.appType || '')
    || typeof binding.formUuid !== 'string' || !binding.formUuid.trim()
    || !Number.isSafeInteger(currentPage) || currentPage < 1
    || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100
    || !query || typeof query !== 'object'
    || binding.dynamicOrder !== undefined && typeof binding.dynamicOrder !== 'string'
    || binding.subformFieldIds !== undefined && (!Array.isArray(binding.subformFieldIds)
      || !binding.subformFieldIds.every(id => typeof id === 'string' && id.trim())
      || new Set(binding.subformFieldIds).size !== binding.subformFieldIds.length)) {
    throw canvasDataError('DATA_BINDING_INVALID');
  }
  const method = binding.mode === 'process' ? 'getProcessInstances' : 'searchFormDatas';
  const bridge = getCanvasBridge('__OPENYIDA_YIDA_API__', method);
  if (!bridge) throw canvasDataError('DATA_BRIDGE_UNAVAILABLE');
  let payload;
  try {
    payload = await bridge[method]({
      appType: binding.appType, formUuid: binding.formUuid, currentPage, pageSize,
      searchFieldJson: JSON.stringify(query), dynamicOrder: binding.dynamicOrder || '',
      ...(binding.mode === 'process' && binding.instanceStatus ? { instanceStatus: binding.instanceStatus } : {}),
    });
  } catch { throw canvasDataError('DATA_QUERY_FAILED'); }
  const page = normalizeCanvasFormPage(payload, currentPage, pageSize);
  if (binding.mode === 'process') {
    page.rows = page.rows.map(row => {
      let formData = row.formData === undefined ? row.data : row.formData;
      if (typeof formData === 'string') {
        try {formData = JSON.parse(formData);} catch {throw canvasDataError('DATA_ROWS_INVALID');}
      }
      // Retain original IDs/status; historical ordinary rows do not gain workflow metadata.
      return { ...row, formData };
    });
  }
  // Opt in with Schema-confirmed table IDs. Only missing tables cause reads,
  // sequentially, so a page never fans out unbounded requests or retries.
  if (binding.subformFieldIds?.length) {page.rows = [...page.rows];}
  for (let index = 0; index < page.rows.length; index++) {
    let row = page.rows[index];
    for (const fieldId of binding.subformFieldIds || []) {
      const remainingMs = subformDeadline - Date.now();
      if (remainingMs > 0 && readCanvasSubformRows(row, fieldId).error?.code === 'DATA_SUBFORM_UNAVAILABLE'
        && await readCanvasMissingSubform(binding, row, fieldId, remainingMs)) {
        row = { ...row, formData: { ...row.formData, [fieldId]: [] } };
      }
    }
    page.rows[index] = row;
  }
  return page;
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
