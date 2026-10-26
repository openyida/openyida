'use strict';

const fs = require('fs');
const path = require('path');
const contract = require('./contract');
const { createTaskCenterLoader } = require('./loader');
const { createTaskCenterLookups } = require('./lookups');
const { createWorkflowContract } = require('./workflow');
const { createWorkflowLoader } = require('./workflow-loader');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { findEmojiInValue } = require('../core/no-emoji-detector');
const { buildApplicationProvider } = require('../../yida-skills/skills/yida-canvas-custom-page/scripts/build-canvas-theme');

function fail(code, field) {
  throw new CliError(t('task_center.invalid_spec', field || code), { code, details: { field: field || '' } });
}

function capabilities() {
  return {
    ...contract.capabilities(),
    navigation: {
      command: 'task-center link [appType] --scope app|corp --type todo|created|done|cc [--base-url URL] [--mode dingtalk|auto|browser] --json',
      scopes: ['app', 'corp'], scopeRequired: true, defaultMode: 'auto',
      runtime: 'window.__OPENYIDA_UTILS__.openTaskCenter({ scope, appType (app only), kind, mode })',
      opensFromCli: false,
    },
    lookups: {
      command: 'task-center options <appType> --type <originators|processes|forms> [--keyword TEXT] [--size N] --json',
      kinds: ['originators', 'processes', 'forms'],
      identity: 'current-visitor',
    },
    workflow: {
      readOnly: true, customPageChoiceRequired: false,
      inspect: 'task-center inspect <appType> --process-inst-id <id> [--form-uuid <id>] [--history] [--task-id <id>] --json',
      count: 'task-center count <appType> --type todo|created|done|cc [--transport app-v1|app-query] [--filters-json JSON] --json',
      scope: 'current-visitor-visible-process', historyDefault: false,
      results: { personal: 'personalResult on done tasks', process: 'processResult', task: 'taskResult matched by taskId; not proof of current-visitor ownership' },
      runtimeCount: 'window.__OPENYIDA_UTILS__.taskCenterCount({ scope, appType (app only), kind, filters })',
      scopedCount: 'task-center count [appType] --scope app|corp --type todo|created|done|cc --json',
      corpCount: 'task-center count --scope corp --type todo|created|done|cc [--filters-json JSON] --json',
      countBasis: 'server-total', unknownCount: null, historyFailure: 'explicit-partial-error',
    },
    scaffold: {
      modes: ['page', 'embedded'],
      views: ['tasks', 'progress'],
      required: ['appType', 'designFile', 'customPage'],
      specExample: {
        appType: 'APP_REPLACE_WITH_TARGET',
        designFile: 'prd/application/design.md',
        customPage: { source: 'explicit-user-request', confirmed: true },
        view: 'tasks', mode: 'embedded', title: t('task_center.kind_todo'), kinds: ['todo'], defaultKind: 'todo', pageSize: 5,
        transport: 'app-query', filters: {}, filterFields: {}, showSearch: false, showPagination: false,
        fields: ['title', 'originator', 'summary', 'time'], expandProcess: false,
      },
      progressSpecExample: {
        appType: 'APP_REPLACE_WITH_TARGET', designFile: 'prd/application/design.md',
        customPage: { source: 'explicit-user-request', confirmed: true },
        view: 'progress', mode: 'embedded', history: false,
      },
      progressProps: ['processInstanceId', 'formUuid (optional)', 'taskId (optional, history required)', 'onOpen (reuse host native container)', 'refreshKey (host refresh revision)'],
      confirmationSources: ['explicit-user-request', 'ask_human'],
      confirmation: t('task_center.confirmation_required'),
    },
  };
}

function validateSpec(spec, baseDir = process.cwd()) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) { fail('TASK_SPEC_INVALID'); }
  const allowed = ['appType', 'designFile', 'customPage', 'mode', 'title', 'kinds', 'defaultKind', 'pageSize', 'transport', 'filters',
    'view', 'processInstanceId', 'formUuid', 'taskId', 'history', 'fields', 'filterFields', 'expandProcess', 'showSearch', 'showPagination'];
  for (const field of Object.keys(spec)) { if (!allowed.includes(field)) { fail('TASK_SPEC_INVALID', field); } }
  const choice = spec.customPage;
  if (!choice || choice.confirmed !== true || !['explicit-user-request', 'ask_human'].includes(choice.source)) {
    throw new CliError(t('task_center.confirmation_required'), { code: 'TASK_CUSTOM_PAGE_CONFIRMATION_REQUIRED' });
  }
  contract.appOf(spec.appType);
  if (process.env.OPENYIDA_MANAGED_RUN === '1' && spec.appType !== process.env.OPENYIDA_AGENT_APP_TYPE) {
    fail('TASK_SCOPE_MISMATCH', 'appType');
  }
  if (typeof spec.designFile !== 'string' || !spec.designFile.trim()) { fail('TASK_DESIGN_REQUIRED', 'designFile'); }
  const designFile = path.resolve(baseDir, spec.designFile);
  if (!fs.existsSync(designFile) || !fs.statSync(designFile).isFile() || fs.statSync(designFile).size > 1024 * 1024
    || !fs.readFileSync(designFile, 'utf8').trim()) { fail('TASK_DESIGN_REQUIRED', 'designFile'); }
  const view = spec.view || 'tasks';
  if (!['tasks', 'progress'].includes(view)) { fail('TASK_SPEC_INVALID', 'view'); }
  const mode = spec.mode || (view === 'progress' ? 'embedded' : 'page');
  if (!['page', 'embedded'].includes(mode)) { fail('TASK_SPEC_INVALID', 'mode'); }
  const title = spec.title === undefined ? t(view === 'progress' ? 'task_center.progress' : 'task_center.page_title') : spec.title;
  if (typeof title !== 'string' || !title.trim() || title.length > 120 || findEmojiInValue(title).length) { fail('TASK_SPEC_INVALID', 'title'); }
  if (spec.history !== undefined && typeof spec.history !== 'boolean') { fail('TASK_SPEC_INVALID', 'history'); }
  const history = spec.history === true;
  if (view === 'progress') {
    for (const key of ['kinds', 'defaultKind', 'pageSize', 'transport', 'filters', 'fields', 'filterFields', 'expandProcess', 'showSearch', 'showPagination']) {
      if (spec[key] !== undefined) { fail('TASK_SPEC_INVALID', key); }
    }
    if (spec.processInstanceId !== undefined) {
      createWorkflowContract(contract).options({ appType: spec.appType, processInstanceId: spec.processInstanceId, history,
        ...(spec.formUuid !== undefined ? { formUuid: spec.formUuid } : {}), ...(spec.taskId !== undefined ? { taskId: spec.taskId } : {}) });
    } else {
      if (mode !== 'embedded' || spec.formUuid !== undefined || spec.taskId !== undefined) { fail('TASK_SPEC_INVALID', 'processInstanceId'); }
    }
    return { view, appType: spec.appType, mode, title, history, kinds: [], processInstanceId: spec.processInstanceId, formUuid: spec.formUuid, taskId: spec.taskId };
  }
  for (const key of ['processInstanceId', 'formUuid', 'taskId']) { if (spec[key] !== undefined) { fail('TASK_SPEC_INVALID', key); } }
  const kinds = spec.kinds || ['todo'];
  if (!Array.isArray(kinds) || kinds.length < 1 || kinds.length > 4) { fail('TASK_SPEC_INVALID', 'kinds'); }
  const canonical = kinds.map(contract.kindOf);
  if (new Set(canonical).size !== canonical.length) { fail('TASK_SPEC_INVALID', 'kinds'); }
  const defaultKind = contract.kindOf(spec.defaultKind || canonical[0]);
  if (!canonical.includes(defaultKind)) { fail('TASK_SPEC_INVALID', 'defaultKind'); }
  const pageSize = contract.request(defaultKind, { appType: spec.appType, pageSize: spec.pageSize }).params.pageSize;
  const transport = contract.transportOf(spec.transport);
  if (spec.filters !== undefined && (!spec.filters || typeof spec.filters !== 'object' || Array.isArray(spec.filters))) { fail('TASK_FILTER_INVALID', 'filters'); }
  const filters = {};
  for (const [kind, values] of Object.entries(spec.filters || {})) {
    const canonicalKind = contract.kindOf(kind);
    if (!canonical.includes(canonicalKind) || Object.prototype.hasOwnProperty.call(filters, canonicalKind)) { fail('TASK_FILTER_INVALID', kind); }
    filters[canonicalKind] = contract.normalizeFilters(canonicalKind, values, transport);
  }
  const fields = spec.fields || ['title', 'originator', 'status', 'time'];
  if (!Array.isArray(fields) || !fields.includes('title') || new Set(fields).size !== fields.length
    || fields.some(field => !['title', 'originator', 'summary', 'status', 'time'].includes(field))) { fail('TASK_SPEC_INVALID', 'fields'); }
  if (spec.expandProcess !== undefined && typeof spec.expandProcess !== 'boolean') { fail('TASK_SPEC_INVALID', 'expandProcess'); }
  for (const key of ['showSearch', 'showPagination']) { if (spec[key] !== undefined && typeof spec[key] !== 'boolean') { fail('TASK_SPEC_INVALID', key); } }
  if (history && !spec.expandProcess) { fail('TASK_SPEC_INVALID', 'history requires expandProcess'); }
  const filterFields = {};
  if (spec.filterFields !== undefined && (!spec.filterFields || typeof spec.filterFields !== 'object' || Array.isArray(spec.filterFields))) { fail('TASK_SPEC_INVALID', 'filterFields'); }
  for (const [kind, selected] of Object.entries(spec.filterFields || {})) {
    if (!canonical.includes(kind) || !Array.isArray(selected) || new Set(selected).size !== selected.length
      || selected.some(field => field === 'keyword' || !Object.prototype.hasOwnProperty.call(contract.filterSchema(kind, transport), field))) { fail('TASK_SPEC_INVALID', 'filterFields'); }
    filterFields[kind] = selected;
  }
  return { view, appType: spec.appType, mode, kinds: canonical, defaultKind, pageSize, title, transport, filters, fields, filterFields, history,
    expandProcess: spec.expandProcess === true, showSearch: spec.showSearch !== false, showPagination: spec.showPagination !== false };
}

function buildSource(config) {
  const drawerSource = fs.readFileSync(path.join(__dirname, '../samples/openyida-scaffold/canvas-form-drawer.canvas.jsx'), 'utf8');
  const match = drawerSource.match(/\/\/ @openyida-form-drawer:start\r?\n([\s\S]*?)\/\/ @openyida-form-drawer:end/);
  if (!match) { fail('TASK_TEMPLATE_INVALID'); }
  const drawer = match[1].replace(/^import .*;\r?\n/gm, '');
  const strings = {
    kinds: Object.fromEntries(config.kinds.map(kind => [kind, t('task_center.kind_' + kind)])),
    times: Object.fromEntries(config.kinds.map(kind => [kind, t('task_center.time_' + kind)])),
    statuses: Object.fromEntries(['RUNNING', 'COMPLETED', 'TERMINATED', 'ERROR', 'UNKNOWN', 'AGREE', 'DISAGREE', 'agree', 'disagree'].map(status => [status, t('task_center.status_' + status.toLowerCase())])),
    filters: Object.fromEntries(['originators', 'processCodes', 'instanceStatus', 'instanceCreateFrom', 'instanceCreateTo', 'taskCreateFrom', 'taskCreateTo', 'taskFinishFrom', 'taskFinishTo', 'carbonCreateFrom', 'carbonCreateTo'].map(field => [field, t('task_center.filter_' + field)])),
  };
  for (const key of ['title', 'originator', 'status', 'result', 'action', 'handle', 'view', 'detail', 'untitled', 'search', 'refresh', 'retry', 'empty', 'unavailable', 'previous', 'next', 'total', 'totalUnknown', 'apiUnavailable', 'loginRequired', 'invalidResponse', 'requestFailed', 'missingDetail', 'stale', 'updated',
    'unknown', 'progress', 'instanceRequired', 'processResult', 'submittedAt', 'processFinishedAt', 'progressUnknown', 'taskResult', 'historyUnavailable', 'noHistory', 'summary']) {
    strings[key] = t('task_center.' + key);
  }
  const serialize = value => JSON.stringify(value).replace(/</g, '\\u003c');
  const progress = fs.readFileSync(path.join(__dirname, '../samples/yida-task-center/progress.canvas.jsx'), 'utf8');
  let source = config.view === 'progress' ? progress : fs.readFileSync(path.join(__dirname, '../samples/yida-task-center/center.canvas.jsx'), 'utf8');
  if (config.view !== 'progress') {
    const sections = progress.split('// @openyida-workflow-section:start')[1].split('// @openyida-workflow-section:end')[0]
      + fs.readFileSync(path.join(__dirname, '../samples/yida-task-center/filters.jsx'), 'utf8');
    source = source.replace('// @openyida-task-center:sections', () => sections);
  }
  source = source.replace('// @openyida-task-center:runtime', () => [contract.createTaskCenterContract, createTaskCenterLoader, createTaskCenterLookups, createWorkflowContract, createWorkflowLoader].map(fn => fn.toString()).join('\n'));
  source = source.replace('// @openyida-task-center:drawer', () => drawer);
  source = source.replace('// @openyida-task-center:theme', () => buildApplicationProvider(false));
  source = source.replace('/* @openyida-task-center:config */ {}', () => serialize(config));
  source = source.replace('/* @openyida-task-center:text */ {}', () => serialize(strings));
  return source.replace('import { Alert,', 'import { ConfigProvider, Drawer, Alert,').replace('useRef, useState', 'useRef, useState, useMemo');
}

function scaffold(specPath, outputPath) {
  const input = path.resolve(specPath);
  if (!fs.existsSync(input) || !fs.statSync(input).isFile() || fs.statSync(input).size > 64 * 1024) { fail('TASK_SPEC_INVALID', 'spec'); }
  let spec;
  try { spec = JSON.parse(fs.readFileSync(input, 'utf8')); } catch { fail('TASK_SPEC_INVALID', 'spec'); }
  // Design paths, like other page inputs, are relative to the current project.
  const config = validateSpec(spec);
  const output = path.resolve(outputPath);
  if (!output.endsWith('.canvas.jsx') || findEmojiInValue(output).length || fs.existsSync(output)) { fail('TASK_OUTPUT_INVALID', 'output'); }
  const source = buildSource(config);
  if (findEmojiInValue(source).length) { fail('TASK_SPEC_INVALID', 'source'); }
  require('../app/canvas-compile').compileCanvasLocal(source, { sourcePath: output });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, source, { encoding: 'utf8', flag: 'wx' });
  return { success: true, output, scope: 'app', mode: config.mode, component: config.view === 'progress' ? 'ProcessProgressSection' : 'TaskInboxSection',
    requiredProps: config.view === 'progress' && !config.processInstanceId ? ['processInstanceId'] : [], theme: 'existing-application', runtimeVerified: false };
}

module.exports = { capabilities, validateSpec, buildSource, scaffold };
