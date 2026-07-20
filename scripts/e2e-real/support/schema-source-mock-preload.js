#!/usr/bin/env node

'use strict';

const fs = require('fs');
const Module = require('module');
const path = require('path');

const NETWORK_BLOCK_CODE = 'OPENYIDA_TEST_NETWORK_BLOCKED';
const DNS_NETWORK_METHODS = Object.freeze([
  'lookup', 'lookupService', 'resolve', 'resolve4', 'resolve6', 'resolveAny',
  'resolveCaa', 'resolveCname', 'resolveMx', 'resolveNaptr', 'resolveNs',
  'resolvePtr', 'resolveSoa', 'resolveSrv', 'resolveTxt', 'reverse',
]);
const UNDICI_NETWORK_MEMBERS = new Set([
  'Agent', 'BalancedPool', 'Client', 'Pool', 'ProxyAgent', 'RetryAgent',
  'connect', 'fetch', 'pipeline', 'request', 'stream', 'upgrade',
]);

if (process.env.OPENYIDA_SCHEMA_SOURCE_E2E_MOCK === '1') {
  installMockServices();
}

function installMockServices() {
  const root = path.resolve(__dirname, '..', '..', '..');
  const dbPath = process.env.OPENYIDA_SCHEMA_SOURCE_MOCK_DB;
  if (!dbPath) {
    throw new Error('OPENYIDA_SCHEMA_SOURCE_MOCK_DB is required for schema source E2E mock mode');
  }

  const appReaderPath = path.join(root, 'lib', 'app', 'services', 'app-reader.js');
  const appServicePath = path.join(root, 'lib', 'app', 'services', 'app-service.js');
  const formReaderPath = path.join(root, 'lib', 'app', 'services', 'form-schema-reader.js');
  const formServicePath = path.join(root, 'lib', 'app', 'services', 'form-service.js');
  const formCompilerPath = path.join(root, 'lib', 'app', 'services', 'form-compiler.js');
  const formModeServicePath = path.join(root, 'lib', 'app', 'services', 'form-mode-service.js');
  const pageServicePath = path.join(root, 'lib', 'app', 'services', 'page-resource-service.js');
  const pageSchemaBuilderPath = path.join(root, 'lib', 'app', 'services', 'native-page-schema-builder.js');
  const processReaderPath = path.join(root, 'lib', 'process', 'services', 'process-reader.js');
  const processResourceServicePath = path.join(root, 'lib', 'process', 'services', 'process-resource-service.js');

  const originalLoad = Module._load;

  function loadOriginal(request, parent, isMain) {
    return originalLoad.call(Module, request, parent, isMain);
  }

  function readDb() {
    if (!fs.existsSync(dbPath)) {
      return emptyDb();
    }
    const parsed = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    parsed.counters = parsed.counters || {};
    for (const kind of ['app', 'form', 'page', 'process']) {
      parsed.counters[kind] = parsed.counters[kind] || 0;
    }
    parsed.apps = parsed.apps || {};
    parsed.forms = parsed.forms || {};
    parsed.pages = parsed.pages || {};
    parsed.processes = parsed.processes || {};
    parsed.calls = parsed.calls || [];
    parsed.networkAttempts = parsed.networkAttempts || [];
    return parsed;
  }

  function emptyDb() {
    return {
      counters: { app: 0, form: 0, page: 0, process: 0 },
      apps: {},
      forms: {},
      pages: {},
      processes: {},
      calls: [],
      networkAttempts: [],
    };
  }

  function writeDb(db) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
  }

  function recordCall(name, details = {}) {
    const db = readDb();
    db.calls.push({ name, resource: details.resource || null });
    writeDb(db);
  }

  function recordNetworkAttempt(primitive) {
    const db = readDb();
    db.networkAttempts.push(String(primitive));
    writeDb(db);
  }

  function installNetworkBlocker() {
    const fail = primitive => function blockedNetworkPrimitive() {
      recordNetworkAttempt(primitive);
      const error = new Error(`Schema source mock blocked network primitive: ${primitive}`);
      error.code = NETWORK_BLOCK_CODE;
      throw error;
    };
    const http = loadOriginal('http', module, false);
    const https = loadOriginal('https', module, false);
    const net = loadOriginal('net', module, false);
    const tls = loadOriginal('tls', module, false);
    const dns = loadOriginal('dns', module, false);
    const dgram = loadOriginal('dgram', module, false);
    const http2 = loadOriginal('http2', module, false);
    const childProcess = loadOriginal('child_process', module, false);
    const originalSpawnSync = childProcess.spawnSync.bind(childProcess);
    http.request = fail('http.request');
    http.get = fail('http.get');
    https.request = fail('https.request');
    https.get = fail('https.get');
    net.connect = fail('net.connect');
    net.createConnection = fail('net.createConnection');
    net.Socket.prototype.connect = fail('net.Socket.prototype.connect');
    tls.connect = fail('tls.connect');
    http2.connect = fail('http2.connect');
    dgram.Socket.prototype.connect = fail('dgram.Socket.prototype.connect');
    dgram.Socket.prototype.send = fail('dgram.Socket.prototype.send');
    for (const name of DNS_NETWORK_METHODS) {
      if (typeof dns[name] === 'function') {
        dns[name] = fail(`dns.${name}`);
      }
      if (dns.promises && typeof dns.promises[name] === 'function') {
        dns.promises[name] = fail(`dns.promises.${name}`);
      }
      if (dns.Resolver && typeof dns.Resolver.prototype[name] === 'function') {
        dns.Resolver.prototype[name] = fail(`dns.Resolver.prototype.${name}`);
      }
      if (dns.promises && dns.promises.Resolver && typeof dns.promises.Resolver.prototype[name] === 'function') {
        dns.promises.Resolver.prototype[name] = fail(`dns.promises.Resolver.prototype.${name}`);
      }
    }
    global.fetch = fail('fetch');
    global.WebSocket = fail('WebSocket');
    for (const name of ['exec', 'execFile', 'execFileSync', 'execSync', 'fork', 'spawn']) {
      childProcess[name] = fail(`child_process.${name}`);
    }
    childProcess.spawnSync = function guardedSourceLauncher(command, args, options) {
      const sourceBin = path.join(root, 'bin', 'yida.js');
      const values = Array.isArray(args) ? args : [];
      let trustedLauncher = false;
      try {
        trustedLauncher = fs.realpathSync(command) === fs.realpathSync(global.process.execPath) &&
          values.length > 0 && fs.realpathSync(values[0]) === fs.realpathSync(sourceBin);
      } catch (error) {
        trustedLauncher = false;
      }
      if (!trustedLauncher) {
        return fail('child_process.spawnSync')();
      }
      return originalSpawnSync(command, args, options);
    };
  }

  function nextId(kind) {
    const db = readDb();
    db.counters[kind] = (db.counters[kind] || 0) + 1;
    const prefixes = {
      app: 'APP_SOURCE_E2E_',
      form: 'FORM_SOURCE_E2E_',
      page: 'FORM_SOURCE_E2E_PAGE_',
      process: 'PROCESS_SOURCE_E2E_',
    };
    const value = `${prefixes[kind]}${String(db.counters[kind]).padStart(4, '0')}`;
    writeDb(db);
    return value;
  }

  function createServiceError(message, code, details) {
    const error = new Error(message);
    error.code = code;
    if (details) {
      error.details = details;
    }
    return error;
  }

  async function readApp(context, input = {}) {
    recordCall('read:app', { resource: 'app' });
    const db = readDb();
    const app = db.apps[input.appType];
    if (!app) {
      throw createServiceError('app not found', 'APP_READ_NOT_FOUND', { appType: input.appType });
    }
    return {
      appType: app.appType,
      appName: app.appName,
      systemLink: `https://source-e2e.example.test/${app.appType}`,
    };
  }

  async function createAppResource(context, input = {}) {
    recordCall('create:app', { resource: 'app' });
    const appType = nextId('app');
    const db = readDb();
    db.apps[appType] = {
      appType,
      appName: input.appName || input.name || 'Schema Source E2E App',
    };
    writeDb(db);
    return {
      appType,
      appName: db.apps[appType].appName,
    };
  }

  async function updateAppResource(context, input = {}) {
    recordCall('update:app', { resource: 'app' });
    const db = readDb();
    const app = db.apps[input.appType];
    if (!app) {
      throw createServiceError('app not found', 'APP_UPDATE_FAILED', { appType: input.appType });
    }
    if (input.name) {
      app.appName = input.name;
    }
    writeDb(db);
    return { appType: input.appType };
  }

  async function readFormSchema(context, input = {}) {
    recordCall('read:form', { resource: 'form' });
    const db = readDb();
    const form = db.forms[input.formUuid];
    if (!form) {
      throw createServiceError('form not found', 'FORM_SCHEMA_READ_FAILED', { formUuid: input.formUuid });
    }
    return {
      success: true,
      content: form.content,
    };
  }

  function createFormResourceFactory() {
    const { compileFormDefinition } = loadOriginal(formCompilerPath, module, false);
    return async function createFormResource(context, input = {}) {
      recordCall('create:form', { resource: 'form' });
      const formUuid = nextId('form');
      const compiled = compileFormDefinition(input.definition || input, {
        appType: input.appType,
        formUuid,
      });
      compiled.schema.title = input.definition && input.definition.title || input.title || '';
      compiled.schema.gmtModified = 100;

      const db = readDb();
      const form = {
        appType: input.appType,
        formUuid,
        mode: input.formType === 'process' ? 'process' : 'receipt',
        processCode: null,
        title: input.definition && input.definition.title || '',
        content: compiled.schema,
      };
      db.forms[formUuid] = form;
      // Mirrors the real platform: creating a blank process form binds a procCode immediately.
      const processCode = form.mode === 'process' ? ensureProcessBinding(db, form) : null;
      writeDb(db);

      if (typeof context.checkpointCreateIdentity === 'function') {
        await context.checkpointCreateIdentity({
          appType: input.appType,
          formUuid,
          fieldBindings: compiled.fieldBindings,
          fieldBindingComponents: compiled.fieldBindingComponents,
        });
      }

      return {
        appType: input.appType,
        formUuid,
        schema: compiled.schema,
        fieldBindings: compiled.fieldBindings,
        fieldBindingComponents: compiled.fieldBindingComponents,
        ...(processCode ? { processCode } : {}),
        schemaResult: { success: true, content: compiled.schema },
      };
    };
  }

  function updateFormResourceFactory(originalFormService) {
    return async function updateFormResource(context, input = {}) {
      recordCall('update:form', { resource: 'form' });
      const prepared = input.prepared || originalFormService.prepareFormResourceUpdate(input);
      const db = readDb();
      if (!db.forms[input.formUuid]) {
        throw createServiceError('form not found', 'FORM_SAVE_SCHEMA_FAILED', { formUuid: input.formUuid });
      }
      prepared.schema.gmtModified = Number(db.forms[input.formUuid].content.gmtModified || 0) + 1;
      const processCode = input.targetMode === 'process'
        ? ensureProcessBinding(db, db.forms[input.formUuid])
        : db.forms[input.formUuid].processCode;
      db.forms[input.formUuid] = {
        appType: input.appType,
        formUuid: input.formUuid,
        mode: db.forms[input.formUuid].mode || 'receipt',
        processCode,
        title: input.definition && input.definition.title || db.forms[input.formUuid].title || '',
        content: prepared.schema,
      };
      writeDb(db);
      return {
        appType: input.appType,
        formUuid: input.formUuid,
        schema: prepared.schema,
        fieldBindings: prepared.compiled.fieldBindings,
        fieldBindingComponents: prepared.compiled.fieldBindingComponents,
        ...(processCode ? { processCode } : {}),
        schemaResult: { success: true, content: prepared.schema },
      };
    };
  }

  async function readFormMode(context, input = {}) {
    recordCall('read:form-mode', { resource: 'form' });
    const db = readDb();
    const form = db.forms[input.formUuid];
    if (!form || form.appType !== input.appType) {
      throw createServiceError('form mode not found', 'FORM_MODE_READ_FAILED');
    }
    return form.mode === 'process'
      ? { mode: 'process', processCode: form.processCode }
      : { mode: 'receipt' };
  }

  async function convertFormToProcess(context, input = {}) {
    recordCall('convert:form', { resource: 'form' });
    const db = readDb();
    const form = db.forms[input.formUuid];
    if (!form || form.appType !== input.appType) {
      throw createServiceError('form mode conversion failed', 'FORM_MODE_CONVERSION_FAILED');
    }
    form.mode = 'process';
    form.processCode = ensureProcessBinding(db, form);
    writeDb(db);
    return { success: true, processCode: form.processCode };
  }

  function ensureProcessBinding(db, form) {
    if (!form.processCode) {
      db.counters.process += 1;
      form.processCode = `TPROC_SOURCE_E2E_${String(db.counters.process).padStart(4, '0')}`;
    }
    if (!db.processes[form.processCode]) {
      db.processes[form.processCode] = {
        appType: form.appType,
        formUuid: form.formUuid,
        processCode: form.processCode,
        active: { processId: `${nextProcessId(db)}_V0`, processVersion: 0 },
        activeDefinition: null,
        activeProcessJson: null,
        activeProcessJsonHash: null,
        activeManagedDefinition: null,
        draft: null,
        draftSaved: false,
        draftDefinition: null,
        draftProcessJson: null,
        draftProcessJsonHash: null,
        draftManagedDefinition: null,
        historical: [],
      };
    }
    return form.processCode;
  }

  function nextProcessId(db) {
    db.counters.process += 1;
    return `PROCESS_SOURCE_E2E_${String(db.counters.process).padStart(4, '0')}`;
  }

  function makeInitialPageSchema(formUuid) {
    const { buildDefaultPageDataSource } = loadOriginal(pageSchemaBuilderPath, module, false);
    const defaults = buildDefaultPageDataSource(formUuid);
    return {
      gmtModified: 100,
      i18nData: [],
      pages: [{ componentsTree: [{ dataSource: {
        globalConfig: clone(defaults.globalConfig),
        list: [],
        offline: [],
        online: [],
        sync: true,
      } }] }],
      status: 'ONLINE',
    };
  }

  async function createPageShellOnce(context, input = {}) {
    recordCall('create:page', { resource: 'page' });
    const formUuid = nextId('page');
    const db = readDb();
    db.pages[formUuid] = {
      appType: input.appType,
      formUuid,
      observedFormType: 'display',
      observedTitle: input.title,
      schema: makeInitialPageSchema(formUuid),
    };
    writeDb(db);
    return { appType: input.appType, formUuid };
  }

  async function readPageResource(context, input = {}) {
    recordCall('read:page', { resource: 'page' });
    const db = readDb();
    const page = db.pages[input.formUuid];
    if (!page || page.appType !== input.appType) {
      throw createServiceError('page not found', 'SCHEMA_PAGE_READ_FAILED');
    }
    return {
      ...clone(page),
      serverRevision: page.schema.gmtModified,
    };
  }

  async function savePageSchemaOnce(context, input = {}) {
    recordCall('save:page', { resource: 'page' });
    const db = readDb();
    const page = db.pages[input.formUuid];
    if (!page || page.appType !== input.appType || input.serverRevision !== page.schema.gmtModified) {
      throw createServiceError('page save conflict', 'SCHEMA_APPLY_JIT_CONFLICT');
    }
    page.schema = clone(input.schema);
    page.schema.gmtModified = input.serverRevision + 1;
    writeDb(db);
    return { success: true };
  }

  async function queryProcessVersions(auth, appType, processCode, status, options = {}) {
    recordCall('read:process-versions', { resource: 'process' });
    const process = readDb().processes[processCode];
    if (
      !process ||
      process.appType !== appType ||
      status !== '' ||
      options.pageIndex !== 1 ||
      options.pageSize !== 10
    ) {
      throw createServiceError('process versions not found', 'PROCESS_RESOURCE_VERSION_READ_FAILED');
    }
    const rows = process.historical.map(identity => ({
      code: processCode,
      id: identity.processId,
      status: 'INVALID',
      version: identity.processVersion,
    }));
    if (process.draft) {
      rows.push({
        code: processCode,
        id: process.draft.processId,
        status: 'SAVED',
        version: process.draft.processVersion,
      });
    }
    rows.push({
      code: processCode,
      id: process.active.processId,
      status: 'PUBLISHED',
      version: process.active.processVersion,
    });
    return { success: true, content: { data: rows, currentPage: 1, totalCount: rows.length } };
  }

  async function newDraftProcess(auth, appType, processCode, formUuid, baseProcessId, processVersion) {
    recordCall('create:process-draft', { resource: 'process' });
    const db = readDb();
    const process = db.processes[processCode];
    const form = db.forms[formUuid];
    if (
      !process ||
      !form ||
      process.appType !== appType ||
      process.formUuid !== formUuid ||
      form.appType !== appType ||
      form.processCode !== processCode ||
      process.draft ||
      baseProcessId !== process.active.processId ||
      processVersion !== process.active.processVersion + 1
    ) {
      throw createServiceError('process draft failed', 'PROCESS_RESOURCE_DRAFT_FAILED');
    }
    process.draft = { processId: nextProcessId(db), processVersion };
    process.draftSaved = false;
    process.draftDefinition = { bindingForm: formUuid, schema: { children: [] } };
    process.draftProcessJson = null;
    process.draftProcessJsonHash = null;
    process.draftManagedDefinition = null;
    writeDb(db);
    return { success: true, content: { processId: process.draft.processId } };
  }

  async function saveProcessById(auth, appType, formUuid, processCode, processId, processVersion, processJson, viewJson) {
    recordCall('save:process', { resource: 'process' });
    const db = readDb();
    const process = db.processes[processCode];
    const form = db.forms[formUuid];
    const parsedPayload = parseAndValidateProcessPayload(processJson, viewJson, {
      formUuid,
      processCode,
    });
    if (
      !process ||
      !form ||
      process.appType !== appType ||
      process.formUuid !== formUuid ||
      form.appType !== appType ||
      form.processCode !== processCode ||
      !process.draft ||
      process.draft.processId !== processId ||
      process.draft.processVersion !== processVersion ||
      processVersion !== process.active.processVersion + 1
    ) {
      throw createServiceError('process save failed', 'PROCESS_RESOURCE_SAVE_FAILED');
    }
    process.draftDefinition = parsedPayload.viewJson;
    process.draftProcessJson = parsedPayload.processJson;
    process.draftProcessJsonHash = parsedPayload.processJsonHash;
    process.draftManagedDefinition = parsedPayload.managedDefinition;
    process.draftSaved = true;
    writeDb(db);
    return { success: true };
  }

  async function publishProcessById(auth, appType, formUuid, processCode, processId, processVersion) {
    recordCall('publish:process', { resource: 'process' });
    const db = readDb();
    const process = db.processes[processCode];
    const form = db.forms[formUuid];
    if (
      !process ||
      !form ||
      process.appType !== appType ||
      process.formUuid !== formUuid ||
      form.appType !== appType ||
      form.processCode !== processCode ||
      !process.draft ||
      process.draft.processId !== processId ||
      process.draft.processVersion !== processVersion ||
      processVersion !== process.active.processVersion + 1 ||
      process.draftSaved !== true
    ) {
      throw createServiceError('process publish failed', 'PROCESS_RESOURCE_PUBLISH_FAILED');
    }
    process.historical.push(process.active);
    process.active = process.draft;
    process.activeDefinition = process.draftDefinition;
    process.activeProcessJson = process.draftProcessJson;
    process.activeProcessJsonHash = process.draftProcessJsonHash;
    process.activeManagedDefinition = process.draftManagedDefinition;
    process.draft = null;
    process.draftSaved = false;
    process.draftDefinition = null;
    process.draftProcessJson = null;
    process.draftProcessJsonHash = null;
    process.draftManagedDefinition = null;
    writeDb(db);
    return { success: true };
  }

  async function readProcessDefinition(context, bindings = {}) {
    recordCall('read:process', { resource: 'process' });
    const process = readDb().processes[bindings.processCode];
    const identityMatches = process && process.appType === bindings.appType && process.formUuid === bindings.formUuid;
    const isActive = identityMatches && process.active.processId === bindings.processId &&
      process.active.processVersion === bindings.processVersion;
    const isDraft = identityMatches && process.draft && process.draft.processId === bindings.processId &&
      process.draft.processVersion === bindings.processVersion;
    const definition = isActive ? process.activeDefinition : isDraft ? process.draftDefinition : null;
    if (!definition) {
      throw createServiceError('process definition not found', 'PROCESS_READ_FAILED');
    }
    return { definition: clone(definition) };
  }

  function withProcessServices(context) {
    return {
      ...context,
      services: {
        ...(context && context.services || {}),
        newDraftProcess,
        publishProcessById,
        queryProcessVersions,
        readProcessDefinition,
        saveProcessById,
      },
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function parseAndValidateProcessPayload(processJsonText, viewJsonText, expected) {
    const processJson = parsePlainJson(processJsonText, 'processJson');
    const viewJson = parsePlainJson(viewJsonText, 'viewJson');
    if (
      !isPlainRecord(processJson.props) ||
      processJson.props.bindingForm !== expected.formUuid ||
      processJson.props.processCode !== expected.processCode ||
      !Array.isArray(processJson.nodes) ||
      processJson.nodes.length < 2 ||
      processJson.nodes[0].type !== 'apply' ||
      processJson.nodes[processJson.nodes.length - 1].type !== 'finish'
    ) {
      throw createServiceError('processJson identity is invalid', 'PROCESS_RESOURCE_SAVE_FAILED');
    }
    const nodeIds = new Set();
    for (const node of processJson.nodes) {
      if (!isPlainRecord(node) || typeof node.nodeId !== 'string' || !node.nodeId || nodeIds.has(node.nodeId)) {
        throw createServiceError('processJson node identity is invalid', 'PROCESS_RESOURCE_SAVE_FAILED');
      }
      nodeIds.add(node.nodeId);
    }
    const approvalNodes = processJson.nodes.slice(1, -1);
    if (approvalNodes.length === 0 || approvalNodes.some(node => (
      node.type !== 'approval' ||
      !isPlainRecord(node.name) ||
      typeof node.name.zh_CN !== 'string' ||
      !node.name.zh_CN ||
      !isPlainRecord(node.props) ||
      JSON.stringify(node.props.approvals) !== JSON.stringify([['originator']])
    ))) {
      throw createServiceError('processJson managed nodes are invalid', 'PROCESS_RESOURCE_SAVE_FAILED');
    }
    if (
      viewJson.bindingForm !== expected.formUuid ||
      !isPlainRecord(viewJson.schema) ||
      viewJson.schema.componentName !== 'CanvasEngine' ||
      !Array.isArray(viewJson.schema.children)
    ) {
      throw createServiceError('viewJson identity is invalid', 'PROCESS_RESOURCE_SAVE_FAILED');
    }
    const viewApprovalNodes = viewJson.schema.children.filter(node => node && node.componentName === 'ApprovalNode');
    if (
      viewApprovalNodes.length !== approvalNodes.length ||
      viewApprovalNodes.some((node, index) => (
        node.id !== approvalNodes[index].nodeId ||
        !isPlainRecord(node.props) ||
        !isPlainRecord(node.props.name) ||
        node.props.name.zh_CN !== approvalNodes[index].name.zh_CN
      ))
    ) {
      throw createServiceError('process/view managed nodes differ', 'PROCESS_RESOURCE_SAVE_FAILED');
    }
    const managedDefinition = approvalNodes.map(node => ({
      approver: 'originator',
      name: node.name.zh_CN,
      type: node.type,
    }));
    return {
      managedDefinition,
      processJson,
      processJsonHash: stableHash(processJson),
      viewJson,
    };
  }

  function parsePlainJson(value, label) {
    if (typeof value !== 'string' || !value) {
      throw createServiceError(`${label} is invalid`, 'PROCESS_RESOURCE_SAVE_FAILED');
    }
    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch (error) {
      throw createServiceError(`${label} is invalid`, 'PROCESS_RESOURCE_SAVE_FAILED');
    }
    if (!isPlainRecord(parsed)) {
      throw createServiceError(`${label} is invalid`, 'PROCESS_RESOURCE_SAVE_FAILED');
    }
    return parsed;
  }

  function isPlainRecord(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
  }

  function stableHash(value) {
    const crypto = loadOriginal('crypto', module, false);
    return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
  }

  function canonicalize(value) {
    if (Array.isArray(value)) {
      return value.map(canonicalize);
    }
    if (isPlainRecord(value)) {
      const result = {};
      for (const key of Object.keys(value).sort()) {
        result[key] = canonicalize(value[key]);
      }
      return result;
    }
    return value;
  }

  async function runNegativeProcessContractChecks() {
    const process = Object.values(readDb().processes)[0];
    if (!process) {
      throw new Error('process contract probe requires an existing process');
    }
    const nextVersion = process.active.processVersion + 1;
    const rejected = async (operation) => {
      try {
        await operation();
        return false;
      } catch (error) {
        return true;
      }
    };
    const processJson = clone(process.activeProcessJson);
    const viewJson = clone(process.activeDefinition);
    const evidence = {
      wrongStatus: await rejected(() => queryProcessVersions(null, process.appType, process.processCode, 'PUBLISHED', { pageIndex: 1, pageSize: 10 })),
      wrongIdentity: await rejected(() => readProcessDefinition({}, {
        appType: process.appType,
        formUuid: process.formUuid,
        processCode: process.processCode,
        processId: 'PROCESS_SOURCE_E2E_WRONG',
        processVersion: process.active.processVersion,
      })),
      wrongBase: await rejected(() => newDraftProcess(null, process.appType, process.processCode, process.formUuid, 'PROCESS_SOURCE_E2E_WRONG', nextVersion)),
      crossForm: await rejected(() => newDraftProcess(null, process.appType, process.processCode, 'FORM_SOURCE_E2E_WRONG', process.active.processId, nextVersion)),
      wrongVersion: await rejected(() => newDraftProcess(null, process.appType, process.processCode, process.formUuid, process.active.processId, nextVersion + 1)),
    };
    const created = await newDraftProcess(null, process.appType, process.processCode, process.formUuid, process.active.processId, nextVersion);
    evidence.invalidProcessJson = await rejected(() => saveProcessById(
      null, process.appType, process.formUuid, process.processCode,
      created.content.processId, nextVersion, '{', JSON.stringify(viewJson)
    ));
    evidence.processJsonWrongBinding = await rejected(() => saveProcessById(
      null, process.appType, process.formUuid, process.processCode,
      created.content.processId, nextVersion,
      JSON.stringify({ ...processJson, props: { ...processJson.props, bindingForm: 'FORM_SOURCE_E2E_WRONG' } }),
      JSON.stringify(viewJson)
    ));
    evidence.processJsonWrongCode = await rejected(() => saveProcessById(
      null, process.appType, process.formUuid, process.processCode,
      created.content.processId, nextVersion,
      JSON.stringify({ ...processJson, props: { ...processJson.props, processCode: 'TPROC_SOURCE_E2E_WRONG' } }),
      JSON.stringify(viewJson)
    ));
    evidence.viewJsonWrongBinding = await rejected(() => saveProcessById(
      null, process.appType, process.formUuid, process.processCode,
      created.content.processId, nextVersion,
      JSON.stringify(processJson),
      JSON.stringify({ ...viewJson, bindingForm: 'FORM_SOURCE_E2E_WRONG' })
    ));
    evidence.saveWrongVersion = await rejected(() => saveProcessById(
      null, process.appType, process.formUuid, process.processCode,
      created.content.processId, nextVersion + 1,
      JSON.stringify(processJson), JSON.stringify(viewJson)
    ));
    evidence.saveCrossForm = await rejected(() => saveProcessById(
      null,
      process.appType,
      'FORM_SOURCE_E2E_WRONG',
      process.processCode,
      created.content.processId,
      nextVersion,
      JSON.stringify(processJson),
      JSON.stringify(viewJson)
    ));
    evidence.publishBeforeSave = await rejected(() => publishProcessById(
      null,
      process.appType,
      process.formUuid,
      process.processCode,
      created.content.processId,
      nextVersion
    ));
    const net = loadOriginal('net', module, false);
    const dgram = loadOriginal('dgram', module, false);
    const dns = loadOriginal('dns', module, false);
    const resolver = new dns.Resolver();
    const promisesResolver = dns.promises && dns.promises.Resolver ? new dns.promises.Resolver() : null;
    const undici = Module._load('undici', module, false);
    const networkChecks = [
      ['http.get', () => loadOriginal('http', module, false).get('http://blocked.invalid')],
      ['https.request', () => loadOriginal('https', module, false).request('https://blocked.invalid')],
      ['net.connect', () => net.connect(1, 'blocked.invalid')],
      ['net.Socket.prototype.connect', () => new net.Socket().connect(1, 'blocked.invalid')],
      ['tls.connect', () => loadOriginal('tls', module, false).connect(1, 'blocked.invalid')],
      ['http2.connect', () => loadOriginal('http2', module, false).connect('https://blocked.invalid')],
      ['dgram.Socket.prototype.send', () => {
        const socket = dgram.createSocket('udp4');
        try {
          socket.send(Buffer.from('x'), 1, 'blocked.invalid');
        } finally {
          socket.close();
        }
      }],
      ['fetch', () => global.fetch('https://blocked.invalid')],
      ['WebSocket', () => new global.WebSocket('wss://blocked.invalid')],
      ['undici.request', () => undici.request('https://blocked.invalid')],
      ['child_process.execFileSync', () => loadOriginal('child_process', module, false).execFileSync(global.process.execPath, ['--version'])],
    ];
    for (const name of DNS_NETWORK_METHODS) {
      if (typeof dns[name] === 'function') {
        networkChecks.push([`dns.${name}`, () => dns[name]('blocked.invalid')]);
      }
      if (dns.promises && typeof dns.promises[name] === 'function') {
        networkChecks.push([`dns.promises.${name}`, () => dns.promises[name]('blocked.invalid')]);
      }
      if (typeof resolver[name] === 'function') {
        networkChecks.push([`dns.Resolver.prototype.${name}`, () => resolver[name]('blocked.invalid')]);
      }
      if (promisesResolver && typeof promisesResolver[name] === 'function') {
        networkChecks.push([`dns.promises.Resolver.prototype.${name}`, () => promisesResolver[name]('blocked.invalid')]);
      }
    }
    let allBlocked = true;
    for (const [primitive, operation] of networkChecks) {
      const before = readDb().networkAttempts.length;
      try {
        await operation();
        allBlocked = false;
      } catch (error) {
        const attempts = readDb().networkAttempts;
        if (
          !error || error.code !== NETWORK_BLOCK_CODE ||
          attempts.length !== before + 1 || attempts[before] !== primitive
        ) {
          allBlocked = false;
        }
      }
    }
    evidence.networkPrimitivesBlocked = allBlocked;
    evidence.undiciPurePrimitivesPreserved = ['Headers', 'Request', 'Response'].every(name => typeof undici[name] === 'function');
    return evidence;
  }

  installNetworkBlocker();
  global.__OPENYIDA_SCHEMA_SOURCE_MOCK_HARNESS__ = Object.freeze({
    runNegativeProcessContractChecks,
  });

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'undici' || request.startsWith('undici/')) {
      let original;
      try {
        original = originalLoad.call(Module, request, parent, isMain);
      } catch (error) {
        if (!error || error.code !== 'MODULE_NOT_FOUND') {
          throw error;
        }
        original = {
          Headers: global.Headers,
          Request: global.Request,
          Response: global.Response,
        };
      }
      return new Proxy(original, {
        get(target, property, receiver) {
          if (UNDICI_NETWORK_MEMBERS.has(property)) {
            return function blockedUndiciNetworkMember() {
              recordNetworkAttempt(`undici.${String(property)}`);
              const error = new Error(`Schema source mock blocked network primitive: undici.${String(property)}`);
              error.code = NETWORK_BLOCK_CODE;
              throw error;
            };
          }
          return Reflect.get(target, property, receiver);
        },
      });
    }
    const resolved = Module._resolveFilename(request, parent, isMain);
    if (resolved === appReaderPath) {
      const original = loadOriginal(request, parent, isMain);
      return { ...original, readApp };
    }
    if (resolved === appServicePath) {
      const original = loadOriginal(request, parent, isMain);
      return { ...original, createAppResource, updateAppResource };
    }
    if (resolved === formReaderPath) {
      const original = loadOriginal(request, parent, isMain);
      return { ...original, readFormSchema };
    }
    if (resolved === formServicePath) {
      const original = loadOriginal(request, parent, isMain);
      return {
        ...original,
        createFormResource: createFormResourceFactory(),
        updateFormResource: updateFormResourceFactory(original),
      };
    }
    if (resolved === formModeServicePath) {
      const original = loadOriginal(request, parent, isMain);
      return { ...original, convertFormToProcess, readFormMode };
    }
    if (resolved === pageServicePath) {
      const original = loadOriginal(request, parent, isMain);
      return { ...original, createPageShellOnce, readPageResource, savePageSchemaOnce };
    }
    if (resolved === processReaderPath) {
      const original = loadOriginal(request, parent, isMain);
      return { ...original, readProcessDefinition };
    }
    if (resolved === processResourceServicePath) {
      const original = loadOriginal(request, parent, isMain);
      return {
        ...original,
        applyProcessResource(context, input) {
          return original.applyProcessResource(withProcessServices(context), input);
        },
        prepareProcessResource(context, input) {
          return original.prepareProcessResource(withProcessServices(context), input);
        },
        readProcessVersionSnapshot(context, input) {
          return original.readProcessVersionSnapshot(withProcessServices(context), input);
        },
        reconcileProcessResource(context, input) {
          return original.reconcileProcessResource(withProcessServices(context), input);
        },
      };
    }
    return loadOriginal(request, parent, isMain);
  };
}
