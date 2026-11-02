'use strict';

// Kept portable so the CLI and generated pages use the same task contract.
function createTaskCenterContract() {
  const definitions = {
    todo: { method: 'getTodoTasksInApp', endpoint: 'task/getTodoTasksInApp', filters: ['keyword'] },
    created: { method: 'getMySubmitInApp', endpoint: 'process/getMySubmitInApp', filters: ['keyword'] },
    done: { method: 'getDoneTasksInApp', endpoint: 'task/getDoneTasksInApp', filters: ['keyword'] },
    cc: { method: 'getNotifyMeTasksInApp', endpoint: 'task/getNotifyMeTasksInApp', filters: ['keyword', 'processCodes', 'instanceStatus'] },
  };
  const queryDefinitions = {
    todo: { endpoint: 'getTodoTasksInCorp', filters: ['keyword', 'originators', 'processCodes', 'instanceCreateFrom', 'instanceCreateTo', 'taskCreateFrom', 'taskCreateTo'] },
    created: { endpoint: 'getMyCreateInCorp', filters: ['keyword', 'processCodes', 'instanceCreateFrom', 'instanceCreateTo'] },
    done: { endpoint: 'getDoneTasksInCorp', filters: ['keyword', 'originators', 'processCodes', 'instanceCreateFrom', 'instanceCreateTo', 'taskFinishFrom', 'taskFinishTo'] },
    cc: { endpoint: 'getNotifyMeInCorp', filters: ['keyword', 'originators', 'processCodes', 'instanceCreateFrom', 'instanceCreateTo', 'carbonCreateFrom', 'carbonCreateTo', 'instanceStatus'] },
  };
  const filterDefinitions = {
    keyword: { type: 'string' },
    originators: { type: 'string-array', maxItems: 1 },
    processCodes: { type: 'string-array', maxItems: 100 },
    instanceStatus: { type: 'string' },
    instanceCreateFrom: { type: 'timestamp', format: 'unix-ms' },
    instanceCreateTo: { type: 'timestamp', format: 'unix-ms' },
    taskCreateFrom: { type: 'timestamp', format: 'unix-ms' },
    taskCreateTo: { type: 'timestamp', format: 'unix-ms' },
    taskFinishFrom: { type: 'timestamp', format: 'unix-ms' },
    taskFinishTo: { type: 'timestamp', format: 'unix-ms' },
    carbonCreateFrom: { type: 'timestamp', format: 'unix-ms' },
    carbonCreateTo: { type: 'timestamp', format: 'unix-ms' },
  };
  function fail(code, field) {
    const error = new Error(code + (field ? ': ' + field : ''));
    error.code = code;
    error.field = field || '';
    throw error;
  }
  function kindOf(kind) {
    const value = kind === 'submitted' ? 'created' : kind;
    if (!Object.prototype.hasOwnProperty.call(definitions, value)) { fail('TASK_KIND_INVALID', kind); }
    return value;
  }
  function appOf(appType) {
    if (typeof appType !== 'string' || !/^APP_[A-Za-z0-9_-]+$/.test(appType)) { fail('TASK_APP_INVALID', 'appType'); }
    return appType;
  }
  function positive(value, fallback, max) {
    if (value === undefined) { return fallback; }
    if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > max) {
      fail('TASK_PAGINATION_INVALID');
    }
    return Number(value);
  }
  function transportOf(value = 'app-v1') {
    if (value !== 'app-v1' && value !== 'app-query') { fail('TASK_TRANSPORT_INVALID', 'transport'); }
    return value;
  }
  function filterSchema(kind, transport = 'app-v1') {
    const canonical = kindOf(kind);
    const selectedTransport = transportOf(transport);
    const selected = selectedTransport === 'app-query' ? queryDefinitions[canonical] : definitions[canonical];
    return Object.fromEntries(selected.filters.map(key => [key, selectedTransport === 'app-query' && key === 'instanceStatus'
      ? { type: 'enum', values: [0, 1, 2, 3], labels: { 0: 'RUNNING', 1: 'TERMINATED', 2: 'COMPLETED', 3: 'ERROR' } } : { ...filterDefinitions[key] }]));
  }
  function normalizeFilters(kind, filters = {}, transport = 'app-v1') {
    if (!filters || typeof filters !== 'object' || Array.isArray(filters)) { fail('TASK_FILTER_INVALID', 'filters'); }
    const schema = filterSchema(kind, transport);
    const normalized = {};
    for (const [field, value] of Object.entries(filters)) {
      if (!Object.prototype.hasOwnProperty.call(schema, field)) { fail('TASK_FILTER_UNSUPPORTED', field); }
      if (value === undefined || value === null || value === '') { continue; }
      const definition = schema[field];
      if (definition.type === 'string-array') {
        let values = value;
        if (typeof values === 'string') {
          try { values = JSON.parse(values); } catch { fail('TASK_FILTER_INVALID', field); }
        }
        if (!Array.isArray(values) || values.length > definition.maxItems
          || values.some(item => typeof item !== 'string' || !item.trim())) { fail('TASK_FILTER_INVALID', field); }
        normalized[field] = [...new Set(values)];
      } else if (definition.type === 'enum') {
        if (!/^\d+$/.test(String(value)) || !definition.values.includes(Number(value))) { fail('TASK_FILTER_INVALID', field); }
        normalized[field] = Number(value);
      } else if (definition.type === 'timestamp') {
        if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value))
          || Number(value) > 8640000000000000) { fail('TASK_FILTER_INVALID', field); }
        normalized[field] = Number(value);
      } else {
        if (typeof value !== 'string') { fail('TASK_FILTER_INVALID', field); }
        normalized[field] = value;
      }
    }
    for (const prefix of ['instanceCreate', 'taskCreate', 'taskFinish', 'carbonCreate']) {
      const from = normalized[prefix + 'From'];
      const to = normalized[prefix + 'To'];
      if (from !== undefined && to !== undefined && from > to) { fail('TASK_FILTER_INVALID', prefix); }
    }
    return normalized;
  }
  function request(kind, options = {}) {
    const canonical = kindOf(kind);
    if (!options || typeof options !== 'object' || Array.isArray(options)) { fail('TASK_FILTER_INVALID', 'options'); }
    const transport = transportOf(options.transport);
    const def = definitions[canonical];
    const fields = Object.keys(options).filter(key => !['appType', 'page', 'pageSize', 'transport'].includes(key));
    const filters = normalizeFilters(canonical, Object.fromEntries(fields.map(key => [key, options[key]])), transport);
    const params = {
      appType: appOf(options.appType),
      currentPage: positive(options.page, 1, Number.MAX_SAFE_INTEGER),
      pageSize: positive(options.pageSize, 20, 100),
    };
    if (transport === 'app-query') {
      const query = { page: params.currentPage, limit: params.pageSize, ...filters, appKeys: [params.appType] };
      const queryDef = queryDefinitions[canonical];
      return { kind: canonical, transport, endpoint: queryDef.endpoint,
        path: '/query/task/' + queryDef.endpoint + '.json',
        params: { _api: 'nattyFetch', _mock: 'false', ...(canonical === 'todo' ? { taskQueryType: 1 } : {}), query: JSON.stringify(query) } };
    }
    for (const [field, value] of Object.entries(filters)) { params[field] = Array.isArray(value) ? JSON.stringify(value) : value; }
    return { kind: canonical, transport, method: def.method, endpoint: def.endpoint,
      path: '/dingtalk/web/' + params.appType + '/v1/' + def.endpoint + '.json', params };
  }
  function corpCountRequest(kind, options) {
    const canonical = kindOf(kind);
    if (!options || options.scope !== 'corp' || options.appType !== undefined || options.transport !== 'app-query') {
      fail('TASK_FILTER_INVALID', 'scope');
    }
    const filters = { ...options };
    delete filters.scope;
    delete filters.transport;
    const normalizedFilters = normalizeFilters(canonical, filters, 'app-query');
    return { kind: canonical, transport: 'app-query', path: '/query/task/' + queryDefinitions[canonical].endpoint + '.json',
      params: { _api: 'nattyFetch', _mock: 'false', ...(canonical === 'todo' ? { taskQueryType: 1 } : {}),
        query: JSON.stringify({ page: 1, limit: 1, ...normalizedFilters, appKeys: [] }) }, filters: normalizedFilters };
  }
  function corpCount(payload, kind, filters) {
    checkFailure(payload);
    const page = Object.prototype.hasOwnProperty.call(payload, 'content') ? payload.content : payload;
    checkFailure(page);
    if (!Array.isArray(page.values)) { fail('TASK_RESPONSE_INVALID', 'values'); }
    let total = null;
    if (page.totalCount !== undefined && page.totalCount !== null) {
      if (!/^\d+$/.test(String(page.totalCount)) || !Number.isSafeInteger(Number(page.totalCount))) { fail('TASK_RESPONSE_INVALID', 'totalCount'); }
      total = Number(page.totalCount);
    }
    return { appType: null, kind: kindOf(kind), total, available: total !== null, basis: 'server-total', scope: 'current-visitor-in-corp', filters };
  }
  function text(value) {
    let parsed = value;
    if (typeof value === 'string' && /^\s*\{/.test(value)) {
      try { parsed = JSON.parse(value); } catch { return value; }
    }
    if (typeof parsed === 'string' || typeof parsed === 'number') { return String(parsed); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) { return ''; }
    return String(parsed.zh_CN || parsed.zh || parsed.en_US || parsed.en || parsed.text || '');
  }
  function id(value) { return typeof value === 'string' && value.trim() ? value : null; }
  function outcome(code, label) {
    const classify = value => {
      const normalized = text(value).trim().toUpperCase();
      if (['AGREE', 'APPROVED', 'PASS', '同意', '通过'].includes(normalized)) { return 'AGREE'; }
      if (['DISAGREE', 'REJECT', 'REJECTED', 'REFUSE', '拒绝', '驳回', '不同意'].includes(normalized)) { return 'DISAGREE'; }
      return 'UNKNOWN';
    };
    const first = classify(code), second = classify(label);
    return first !== 'UNKNOWN' && second !== 'UNKNOWN' && first !== second ? 'UNKNOWN' : first !== 'UNKNOWN' ? first : second;
  }
  function summary(value) {
    let parsed = value;
    if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch { return parsed ? [{ label: '', value: parsed.slice(0, 2000) }] : []; } }
    if (!Array.isArray(parsed)) { return []; }
    return parsed.slice(0, 16).filter(item => item && typeof item === 'object' && !Array.isArray(item)).map(item => ({
      label: text(item.label || item.title).slice(0, 120), value: text(item.value ?? item.content).slice(0, 2000),
    })).filter(item => item.value);
  }
  function normalizeItem(row, kind, appType, index) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) { fail('TASK_RESPONSE_INVALID', 'item'); }
    if (row.appType && row.appType !== appType) { fail('TASK_SCOPE_MISMATCH', 'appType'); }
    const taskId = id(row.taskId);
    const formInstId = id(row.formInstId || row.formInstanceId);
    const processInstanceId = id(row.processInstanceId || row.procInstId)
      || (kind === 'created' && row.dataType === 'pinst' ? formInstId : null);
    const formUuid = id(row.formUuid);
    const activityId = id(row.carbonActivityId || row.activityId);
    let detailTarget = null;
    if (kind === 'created' && row.dataType === 'finst') {
      if (formUuid && formInstId) { detailTarget = { type: 'detail', appType, formUuid, formInstId }; }
    } else if (kind === 'cc') {
      if ((processInstanceId || formInstId) && activityId) {
        detailTarget = { type: 'carbon-detail', appType, processInstanceId: processInstanceId || formInstId, activityId };
      }
    } else if (processInstanceId) {
      detailTarget = { type: 'process-detail', appType, processInstanceId, ...(taskId ? { taskId } : {}) };
    }
    const recordId = kind === 'cc' ? id(row.id) || (Number.isSafeInteger(row.id) ? String(row.id) : null) : null;
    const originator = row.creatorInfo || {};
    const identity = kind === 'created' ? processInstanceId || formInstId
      : kind === 'cc' ? recordId || (activityId && (processInstanceId || formInstId) ? [processInstanceId || formInstId, activityId] : null)
        : taskId;
    return {
      key: JSON.stringify([appType, kind, identity || ['unidentified', index]]),
      kind, appType, taskId, processInstanceId, formInstanceId: formInstId, formUuid,
      title: text(row.title || row.titleEn),
      originator: text(row.originatorName || row.originatorDisplayName || originator.displayName),
      instanceStatus: text(row.processInstanceStatusText || row.processInstanceStatus),
      result: kind === 'done' ? outcome(row.outResult, row.outResultName) : text(row.processApprovedResultText || row.processApprovedResult),
      personalResult: kind === 'done' ? outcome(row.outResult, row.outResultName) : null,
      processResult: outcome(row.processApprovedResult, row.processApprovedResultText),
      summary: summary(row.approvalSummary),
      submittedAt: row.packageGmtCreate || (kind === 'created' ? row.createTime : null),
      arrivedAt: kind === 'todo' ? row.activeTime || row.createTime : null,
      finishedAt: kind === 'done' ? row.finishTime || null : null,
      taskFinishedAt: kind === 'done' ? row.finishTime || null : null,
      processFinishedAt: row.processFinishTime || row.processEndTime || (kind === 'created' && processInstanceId ? row.finishTime || row.endTime : null) || null,
      notifiedAt: kind === 'cc' ? row.gmtCreate || row.createTime : null,
      agentType: text(row.agentType),
      sourceActionerName: text(row.sourceActionerName),
      toActionerName: text(row.toActionerName),
      detailTarget,
    };
  }
  function checkFailure(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) { fail('TASK_RESPONSE_INVALID'); }
    if (payload.__needLogin) { fail('NEED_LOGIN'); }
    const code = payload.errorCode;
    if (payload.success === false || (code !== undefined && code !== null && code !== '' && String(code) !== '0')) {
      fail('TASK_REQUEST_FAILED', text(payload.errorMsg || payload.errorMessage || code));
    }
  }
  function normalize(payload, context) {
    const kind = kindOf(context.kind);
    const appType = appOf(context.appType);
    const transport = transportOf(context.transport);
    checkFailure(payload);
    const page = Object.prototype.hasOwnProperty.call(payload, 'content') ? payload.content : payload;
    // The app-v1 task API uses successful null content for an empty result.
    if (page === null && payload.success === true) {
      return { items: [], total: 0, page: context.page || 1, pageSize: context.pageSize || 20 };
    }
    checkFailure(page);
    const field = transport === 'app-query' ? 'values' : 'data';
    const rows = (page[field] === undefined || page[field] === null) && page.totalCount === 0 ? [] : page[field];
    if (!Array.isArray(rows)) { fail('TASK_RESPONSE_INVALID', 'data'); }
    let total = null;
    if (page.totalCount !== undefined && page.totalCount !== null) {
      if (!/^\d+$/.test(String(page.totalCount)) || !Number.isSafeInteger(Number(page.totalCount))) { fail('TASK_RESPONSE_INVALID', 'totalCount'); }
      total = Number(page.totalCount);
    }
    const responsePage = page.currentPage === 0 && total === 0 && rows.length === 0 ? context.page : page.currentPage;
    return {
      items: rows.map((row, index) => {
        if (transport === 'app-query' && (!row || row.appType !== appType)) { fail('TASK_SCOPE_MISMATCH', 'appType'); }
        return normalizeItem(row, kind, appType, index);
      }),
      total,
      page: positive(responsePage, context.page || 1, Number.MAX_SAFE_INTEGER),
      pageSize: context.pageSize || 20,
    };
  }
  function capabilities() {
    return {
      scope: 'app', kinds: Object.keys(definitions), aliases: { submitted: 'created' },
      filters: Object.fromEntries(Object.entries(definitions).map(([kind, def]) => [kind, def.filters.slice()])),
      defaultTransport: 'app-v1',
      transports: Object.fromEntries(['app-v1', 'app-query'].map(transport => [transport, {
        scope: 'app', filters: Object.fromEntries(Object.keys(definitions).map(kind => [kind, filterSchema(kind, transport)])),
      }])),
      defaultPageSize: 20, maxPageSize: 100, inlineApproval: false,
      identity: 'current-visitor', detail: 'native-page', theme: 'existing-application',
    };
  }
  return { kindOf, appOf, transportOf, filterSchema, normalizeFilters, request, corpCountRequest, corpCount, normalize, capabilities, text, outcome, summary, checkFailure };
}

module.exports = { createTaskCenterContract, ...createTaskCenterContract() };
