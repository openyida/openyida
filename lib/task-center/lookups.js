'use strict';

// Portable option loading shared by CLI consumers and generated pages.
function createTaskCenterLookups() {
  function fail(field) {
    const error = new Error('TASK_LOOKUP_INVALID: ' + field);
    error.code = 'TASK_LOOKUP_INVALID';
    error.field = field;
    throw error;
  }
  function request(type, options = {}) {
    if (!['originators', 'processes', 'forms'].includes(type)) { fail('type'); }
    if (!options || typeof options !== 'object' || Array.isArray(options)) { fail('options'); }
    for (const key of Object.keys(options)) {
      if (!['appType', 'keyword', 'pageSize', 'signal'].includes(key)) { fail(key); }
    }
    if (typeof options.appType !== 'string' || !/^APP_[A-Za-z0-9_-]+$/.test(options.appType)) { fail('appType'); }
    if (options.keyword !== undefined && (typeof options.keyword !== 'string' || options.keyword.length > 200)) { fail('keyword'); }
    const size = options.pageSize === undefined ? 50 : Number(options.pageSize);
    if ((options.pageSize !== undefined && !/^\d+$/.test(String(options.pageSize))) || !Number.isInteger(size) || size < 1 || size > 50) { fail('pageSize'); }
    const key = options.keyword || '';
    if (type === 'originators') {
      return { method: 'GET', path: '/query/userservice/searchUsers.json', params: { key, size } };
    }
    // Match taskCenter.html advanced search. `formTypes=process` hydrates processCode for process rows;
    // the endpoint still returns receipt rows for the "created by me" form selector.
    return {
      method: 'POST', path: '/dingtalk/web/' + options.appType + '/query/formdesign/listFormDesignsByFormType.json',
      params: { formTypes: 'process', key, pageIndex: 1, pageSize: size },
    };
  }
  function text(value) {
    if (typeof value === 'string') { return value; }
    return value && typeof value === 'object' ? value.zh_CN || value.en_US || value.text || '' : '';
  }
  function normalize(type, payload, context = {}) {
    if (!['originators', 'processes', 'forms'].includes(type)) { fail('type'); }
    if (!payload || payload.success !== true || payload.__needLogin || payload.__csrfExpired
      || (payload.errorCode !== undefined && payload.errorCode !== null && payload.errorCode !== '' && String(payload.errorCode) !== '0')) { fail('response'); }
    const raw = type === 'originators' ? payload.content?.values : payload.content;
    if (raw !== null && !Array.isArray(raw)) { fail('response'); }
    const seen = new Set();
    const items = [];
    const keyword = type === 'originators' ? '' : String(context.keyword || '').trim().toLocaleLowerCase();
    for (const row of raw || []) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) { fail('item'); }
      if (context.appType && row.appType && row.appType !== context.appType) { fail('scope'); }
      const process = typeof row.processCode === 'string' && row.processCode.trim();
      const form = typeof row.formUuid === 'string' && row.formUuid.trim();
      if (type === 'processes' && (row.formType !== 'process' || !process)) { continue; }
      if (type === 'forms' && (!form || !['receipt', 'process'].includes(row.formType))) { continue; }
      const value = type === 'originators' ? row.staffId || row.userId || row.emplId : row.formType === 'receipt' ? form : process || form;
      const label = type === 'originators' ? text(row.displayName || row.name) : text(row.title || row.i18nTitle);
      if (typeof value !== 'string' || !value.trim() || !label || seen.has(value)) { continue; }
      if (keyword && !label.toLocaleLowerCase().includes(keyword)) { continue; }
      seen.add(value);
      items.push({ value, label, ...(type !== 'originators' ? { formUuid: form, formType: row.formType || '' } : {}) });
    }
    if (type === 'originators') { return { items, total: null }; }
    // The native task center sends key/pageSize too, but the endpoint can return every design. Keep the lookup contract deterministic.
    const pageSize = context.pageSize === undefined ? 50 : Number(context.pageSize);
    return { items: items.slice(0, pageSize), total: items.length };
  }
  async function load(type, options, fetcher) {
    const operation = request(type, options);
    const params = new URLSearchParams({ _api: 'nattyFetch', _mock: 'false', ...operation.params });
    const send = fetcher || fetch;
    const response = await send(operation.path + (operation.method === 'GET' ? '?' + params : ''), {
      method: operation.method, credentials: 'include', cache: 'no-store', signal: options.signal,
      ...(operation.method === 'POST' ? {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: params.toString(),
      } : {}),
    });
    if (!response || response.ok !== true || typeof response.json !== 'function') { fail('request'); }
    let payload;
    try { payload = await response.json(); } catch { fail('response'); }
    return normalize(type, payload, { ...options, keyword: operation.params.key, pageSize: operation.params.pageSize });
  }
  return { request, normalize, load };
}

module.exports = { createTaskCenterLookups, ...createTaskCenterLookups() };
