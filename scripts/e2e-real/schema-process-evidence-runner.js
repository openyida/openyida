#!/usr/bin/env node

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_BIN = path.join(ROOT, 'bin', 'yida.js');
const SOURCE_SKILL_ROOT = path.join(ROOT, 'yida-skills');
const DEFAULT_RESULT_DIR = path.join(ROOT, 'project', '.cache', 'e2e-real', 'schema-process-evidence');
const DEFAULT_COOKIE_FILE_CANDIDATES = Object.freeze([
  path.join(ROOT, 'project', '.cache', 'cookies-public.json'),
  path.join(ROOT, 'project', '.cache', 'cookies.json'),
  path.join(os.homedir(), '.cache', 'cookies-public.json'),
]);
const DEFAULT_TIMEOUT_MS = 120000;
const READ_PROBE_REPEAT_COUNT = 2;
const LOCAL_ERROR_MARKER = Symbol('openyida.schemaProcessEvidence.localError');
const NODE_TRANSPORT_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
  'ENETDOWN',
  'ENETUNREACH',
  'ECONNABORTED',
  'ESOCKETTIMEDOUT',
]);

const IDENTIFIER_KEYS = new Set([
  'appType',
  'corpId',
  'corp_id',
  'formUuid',
  'id',
  'processCode',
  'processId',
  'userId',
  'user_id',
]);
const DEFINITION_KEYS = new Set([
  'content',
  'json',
  'processJson',
  'schema',
  'viewJson',
]);
const ERROR_KEYS = Object.freeze(['success', 'status', 'code', 'errorCode', 'errorMsgCode']);
const UNSAFE_EVIDENCE_KEYS = new Set(['pathTemplate', 'transportError']);
const INTERNAL_PATH_PATTERNS = Object.freeze([
  /https?:\/\/[^"'\s]+/i,
  /\/(?:alibaba|dingtalk)\/web\/[^"'\s]+\/query\/[^"'\s]+/i,
  /\/query\/(?:simpleProcess|process|formdesign|app)\/[^"'\s]+/i,
  /\/Users\/[^"'\s]+/i,
]);
const CREDENTIAL_PATTERNS = Object.freeze([
  /OPENYIDA_COOKIE_B64/i,
  /tianshu_csrf_token/i,
  /global_csrf_token/i,
  /\bCookie\s*[:=]/i,
  /\bAuthorization\s*[:=]/i,
  /\btoken\s*[:=]/i,
]);

function nowStamp(date = new Date()) {
  return date.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function hashFile(filePath) {
  return sha256(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value, mode = 0o600) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode });
  fs.chmodSync(filePath, mode);
  return filePath;
}

function createLocalError(code, category) {
  const error = new Error(code);
  Object.defineProperty(error, LOCAL_ERROR_MARKER, {
    value: true,
    enumerable: false,
  });
  error.localErrorCode = code;
  error.localErrorCategory = category;
  return error;
}

function isTrustedLocalError(error) {
  return !!(
    error &&
    error[LOCAL_ERROR_MARKER] === true &&
    typeof error.localErrorCode === 'string' &&
    /^[A-Z0-9_]+$/.test(error.localErrorCode)
  );
}

function safeTransportErrorCode(error) {
  const code = error && error.code ? String(error.code) : '';
  return NODE_TRANSPORT_ERROR_CODES.has(code) ? code : null;
}

function classifyError(error, fallbackCategory = 'runtime') {
  const transportCode = safeTransportErrorCode(error);
  if (isTrustedLocalError(error) && error.localErrorCategory) {
    return error.localErrorCategory;
  }
  if (transportCode) {
    return 'transport';
  }
  if (error && error.name === 'SyntaxError') {
    return 'parse';
  }
  return fallbackCategory;
}

function safeErrorCode(error, fallbackCode = 'EVIDENCE_RUNTIME_ERROR') {
  if (isTrustedLocalError(error)) {
    return error.localErrorCode;
  }
  if (error && error.name === 'SyntaxError') {
    return 'EVIDENCE_PARSE_ERROR';
  }
  const transportCode = safeTransportErrorCode(error);
  if (transportCode) {
    return transportCode;
  }
  return fallbackCode;
}

function projectError(error, context = {}) {
  const category = context.category || classifyError(error, context.transportFailure ? 'transport' : 'runtime');
  return {
    category,
    code: safeErrorCode(error, category === 'transport' ? 'TRANSPORT_FAILURE' : 'EVIDENCE_RUNTIME_ERROR'),
    phase: context.phase || null,
    operation: context.operation || null,
    transportFailure: !!context.transportFailure,
  };
}

function assertPathInside(child, parent, label) {
  const childReal = fs.realpathSync(child);
  const parentReal = fs.realpathSync(parent);
  const relative = path.relative(parentReal, childReal);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} is outside the expected source root`);
  }
  return childReal;
}

function readSourceSkillEvidence(skillRoot = SOURCE_SKILL_ROOT) {
  const rootReal = fs.realpathSync(skillRoot);
  if (rootReal !== fs.realpathSync(SOURCE_SKILL_ROOT)) {
    throw new Error('Skill root must be the checkout yida-skills directory');
  }
  const files = [
    path.join(skillRoot, 'SKILL.md'),
    path.join(skillRoot, 'skills', 'yida-create-process', 'SKILL.md'),
    path.join(skillRoot, 'skills', 'yida-process-rule', 'SKILL.md'),
  ];
  return {
    root: path.relative(ROOT, rootReal),
    files: files.map((filePath) => {
      const realPath = assertPathInside(filePath, skillRoot, 'Skill file');
      const content = fs.readFileSync(realPath, 'utf8');
      return {
        file: path.relative(ROOT, realPath),
        sha256: sha256(content),
        bytes: Buffer.byteLength(content),
      };
    }),
  };
}

function parseArgs(argv) {
  const options = {
    real: false,
    cookieFile: process.env.OPENYIDA_SCHEMA_PROCESS_EVIDENCE_COOKIE_FILE || '',
    resultDir: process.env.OPENYIDA_SCHEMA_PROCESS_EVIDENCE_RESULT_DIR || DEFAULT_RESULT_DIR,
    runId: '',
    keepWorkspace: false,
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--real') {
      options.real = true;
    } else if (arg === '--keep-workspace') {
      options.keepWorkspace = true;
    } else if (arg === '--cookie-file') {
      options.cookieFile = argv[++index] || '';
    } else if (arg === '--result-dir') {
      options.resultDir = argv[++index] || '';
    } else if (arg === '--run-id') {
      options.runId = argv[++index] || '';
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function printUsage() {
  process.stdout.write([
    'Usage: npm run e2e:schema-process-evidence -- --real [--cookie-file <path>]',
    '',
    'Runs a real, opt-in Yida process API evidence collection against current checkout sources.',
  ].join('\n') + '\n');
}

function resolveCookieFile(explicitCookieFile) {
  const candidates = explicitCookieFile
    ? [explicitCookieFile]
    : DEFAULT_COOKIE_FILE_CANDIDATES;
  for (const candidate of candidates) {
    if (!candidate) { continue; }
    const resolved = path.resolve(candidate);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }
  throw new Error('No existing OpenYida cookie cache found; run openyida login first or pass --cookie-file');
}

function readCookieData(cookieFile) {
  const parsed = JSON.parse(fs.readFileSync(cookieFile, 'utf8'));
  const cookieData = Array.isArray(parsed)
    ? { cookies: parsed }
    : parsed;
  const cookies = Array.isArray(cookieData.cookies) ? cookieData.cookies : [];
  if (cookies.length === 0) {
    throw new Error('Cookie cache has no cookies array');
  }
  const csrfCookie = cookies.find((cookie) => (
    cookie && ['tianshu_csrf_token', 'china_csrf_token', 'csrf_token', '_csrf_token'].includes(cookie.name) && cookie.value
  ));
  const csrfToken = cookieData.csrf_token || cookieData.csrfToken || cookieData._csrf_token || (csrfCookie && csrfCookie.value);
  if (!csrfToken) {
    throw new Error('Cookie cache has no csrf token');
  }
  return {
    ...cookieData,
    cookies,
    csrf_token: csrfToken,
    base_url: cookieData.base_url || 'https://www.aliwork.com',
  };
}

function cookieHeaderFromData(cookieData) {
  return cookieData.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

function createLauncher(workspace) {
  const binDir = path.join(workspace, 'bin');
  const tracePath = path.join(workspace, 'launcher-trace.jsonl');
  fs.mkdirSync(binDir, { recursive: true, mode: 0o700 });
  const launcherPath = path.join(binDir, 'openyida');
  const launcher = `#!/usr/bin/env node
'use strict';
const fs = require('fs');
const { spawnSync } = require('child_process');
const tracePath = ${JSON.stringify(tracePath)};
const sourceBin = ${JSON.stringify(SOURCE_BIN)};
fs.appendFileSync(tracePath, JSON.stringify({
  argv: process.argv.slice(2),
  execPath: process.execPath,
  sourceBin,
  cwd: process.cwd(),
  at: new Date().toISOString()
}) + '\\n', 'utf8');
const result = spawnSync(process.execPath, [sourceBin, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit'
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);
`;
  fs.writeFileSync(launcherPath, launcher, { encoding: 'utf8', mode: 0o755 });
  const yidaPath = path.join(binDir, 'yida');
  fs.copyFileSync(launcherPath, yidaPath);
  fs.chmodSync(yidaPath, 0o755);
  return { binDir, launcherPath, tracePath };
}

function buildCommandEnv(launcher, cookieData) {
  return {
    ...process.env,
    PATH: `${launcher.binDir}${path.delimiter}${process.env.PATH || ''}`,
    YIDA_AUTH_ENABLED: 'true',
    OPENYIDA_COOKIE_B64: Buffer.from(cookieHeaderFromData(cookieData), 'utf8').toString('base64'),
    OPENYIDA_BASE_URL: cookieData.base_url || '',
    OPENYIDA_SKIP_UPDATE_CHECK: '1',
    NO_UPDATE_NOTIFIER: '1',
    OPENYIDA_LANG: 'en',
    CI: '1',
  };
}

function runCommand(commandEnv, args, options = {}) {
  const result = spawnSync('openyida', args, {
    cwd: ROOT,
    env: commandEnv,
    encoding: 'utf8',
    timeout: options.timeoutMs || DEFAULT_TIMEOUT_MS,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) {
    throw result.error;
  }
  const status = result.status === null ? 1 : result.status;
  const expectedStatus = options.expectStatus === undefined ? 0 : options.expectStatus;
  if (expectedStatus !== 'any' && status !== expectedStatus) {
    throw new Error(`Command failed with status ${status}: openyida ${summarizeArgs(args)}`);
  }
  return {
    args,
    status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function summarizeArgs(args = []) {
  const first = args[0] || '';
  if (first === 'create-form') { return 'create-form create'; }
  if (first === 'create-app') { return 'create-app'; }
  if (first === 'login') { return 'login --check-only'; }
  return first;
}

function parseLastJsonLine(commandResult) {
  const stdout = String(commandResult.stdout || '').trim();
  if (stdout.startsWith('{') && stdout.endsWith('}')) {
    try {
      return JSON.parse(stdout);
    } catch {
      // Fall back to the single-line protocol used by most commands.
    }
  }
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index--) {
    const line = lines[index].trim();
    if (!line.startsWith('{')) { continue; }
    try {
      return JSON.parse(line);
    } catch {
      // Try previous line.
    }
  }
  throw new Error(`Command did not emit a JSON result: openyida ${summarizeArgs(commandResult.args)}`);
}

function commandEvidence(commandResult, parsed) {
  const command = summarizeArgs(commandResult.args);
  const evidence = {
    command: summarizeArgs(commandResult.args),
    status: commandResult.status,
  };
  if (command === 'login --check-only') {
    evidence.preflightStatus = parsed && parsed.status === 'ok' ? 'ok' : 'not_ok';
    evidence.canAutoUse = !!(parsed && parsed.can_auto_use === true);
  }
  return evidence;
}

function createAuthRef(cookieData) {
  return {
    csrfToken: cookieData.csrf_token,
    cookies: cookieData.cookies,
    baseUrl: cookieData.base_url || 'https://www.aliwork.com',
    cookieData,
  };
}

function evidenceFieldsFile() {
  return [
    { type: 'TextField', label: 'Applicant', required: true },
    { type: 'TextareaField', label: 'Reason', required: true },
  ];
}

function evidenceProcessDefinition() {
  return {
    nodes: [
      { type: 'approval', name: 'Evidence Review A', approver: 'originator' },
      { type: 'approval', name: 'Evidence Review B', approver: 'originator' },
    ],
  };
}

function redactIdentifier(value) {
  if (value === undefined || value === null || value === '') {
    return { present: false };
  }
  return {
    present: true,
    type: typeof value,
    length: String(value).length,
    sha256: sha256(value).slice(0, 16),
  };
}

function summarizeDefinitionValue(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const summary = {
    type: typeof value,
    byteLength: Buffer.byteLength(text || ''),
    sha256: sha256(text || '').slice(0, 16),
  };
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (parsed && typeof parsed === 'object') {
      summary.parsedType = Array.isArray(parsed) ? 'array' : 'object';
      summary.topLevelKeys = Object.keys(parsed).slice(0, 20).sort();
      if (Array.isArray(parsed.nodes)) {
        summary.nodeCount = parsed.nodes.length;
      } else if (parsed.schema && Array.isArray(parsed.schema.children)) {
        summary.schemaChildCount = parsed.schema.children.length;
      }
    }
  } catch {
    summary.parsedType = 'unparsed';
  }
  return summary;
}

function parseMaybeJson(value) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (value && typeof value === 'object') {
    return value;
  }
  return null;
}

function isEquivalentDefinitionContent(value) {
  const parsed = parseMaybeJson(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return false;
  }
  const keys = new Set(Object.keys(parsed));
  return !!(
    keys.has('schema') &&
    (keys.has('bindingForm') || keys.has('flowConfig') || keys.has('globalSetting') || keys.has('formulaRules'))
  );
}

function summarizeEquivalentDefinitionContent(value) {
  if (!isEquivalentDefinitionContent(value)) {
    return null;
  }
  const summary = summarizeDefinitionValue(value);
  return {
    field: 'content',
    equivalentTo: 'designer process definition',
    topLevelKeys: summary.topLevelKeys || [],
    schemaChildCount: summary.schemaChildCount || null,
    byteLength: summary.byteLength,
    sha256: summary.sha256,
  };
}

function valueType(value) {
  if (Array.isArray(value)) { return 'array'; }
  if (value === null) { return 'null'; }
  return typeof value;
}

function shapeValue(value, key = '', depth = 0) {
  if (IDENTIFIER_KEYS.has(key)) {
    return redactIdentifier(value);
  }
  if (DEFINITION_KEYS.has(key) && (typeof value === 'string' || (value && typeof value === 'object'))) {
    return summarizeDefinitionValue(value);
  }
  if (DEFINITION_KEYS.has(key)) {
    return redactIdentifier(value);
  }
  if (Array.isArray(value)) {
    return {
      type: 'array',
      length: value.length,
      itemShape: value.length > 0 && depth < 3 ? shapeValue(value[0], key, depth + 1) : null,
    };
  }
  if (value && typeof value === 'object') {
    if (depth >= 4) {
      return { type: 'object', keys: Object.keys(value).sort() };
    }
    const shaped = {};
    for (const objectKey of Object.keys(value).sort()) {
      if (objectKey.startsWith('_') || objectKey.toLowerCase().includes('token')) {
        shaped[objectKey] = { redacted: true, type: valueType(value[objectKey]) };
      } else {
        shaped[objectKey] = shapeValue(value[objectKey], objectKey, depth + 1);
      }
    }
    return {
      type: 'object',
      keys: Object.keys(value).sort(),
      fields: shaped,
    };
  }
  if (ERROR_KEYS.includes(key)) {
    return value;
  }
  if (typeof value === 'string') {
    return {
      type: 'string',
      length: value.length,
      sha256: sha256(value).slice(0, 16),
    };
  }
  return {
    type: valueType(value),
    value: typeof value === 'boolean' || typeof value === 'number' ? value : undefined,
  };
}

function summarizeApiResult(result) {
  const content = result && result.content;
  const definitionFieldPaths = findDefinitionFields(content || result);
  const equivalentDefinitionContent = summarizeEquivalentDefinitionContent(content);
  return {
    success: !!(result && result.success),
    status: result && result.status !== undefined ? result.status : null,
    code: result && result.code !== undefined ? result.code : null,
    errorCode: result && result.errorCode !== undefined ? result.errorCode : null,
    topLevelKeys: result && typeof result === 'object' ? Object.keys(result).sort() : [],
    shape: shapeValue(result || null),
    contentHasDefinitionFields: !!definitionFieldPaths.length || !!equivalentDefinitionContent,
    definitionFieldPaths: equivalentDefinitionContent
      ? definitionFieldPaths.concat(['content(equivalentDefinition)'])
      : definitionFieldPaths,
    equivalentDefinitionContent,
  };
}

function findDefinitionFields(value, prefix = '') {
  if (!value || typeof value !== 'object') {
    return [];
  }
  const found = [];
  for (const [key, child] of Object.entries(value)) {
    const nextPath = prefix ? `${prefix}.${key}` : key;
    if (['json', 'processJson', 'viewJson'].includes(key)) {
      found.push(nextPath);
      continue;
    }
    if (child && typeof child === 'object' && found.length < 20) {
      found.push(...findDefinitionFields(child, nextPath));
    }
  }
  return found.slice(0, 20);
}

function extractVersionRows(result) {
  const rows = result && result.content && Array.isArray(result.content.data)
    ? result.content.data
    : [];
  return rows.map((row) => ({
    id: redactIdentifier(row.id),
    version: row.version === undefined ? { present: false } : { present: true, type: typeof row.version },
    status: row.status || null,
    keys: row && typeof row === 'object' ? Object.keys(row).sort() : [],
    definitionFieldPaths: findDefinitionFields(row),
  }));
}

function extractFormModeEvidence(schemaResult, appParamResult, formUuid) {
  const evidence = {
    schema: {
      success: !!(schemaResult && schemaResult.success),
      contentType: valueType(schemaResult && schemaResult.content),
      contentSha256: schemaResult && schemaResult.content ? sha256(
        typeof schemaResult.content === 'string' ? schemaResult.content : JSON.stringify(schemaResult.content)
      ).slice(0, 16) : null,
      discoveredModeKeys: [],
    },
    navigation: {
      success: !!(appParamResult && appParamResult.success),
      matched: false,
      matchedKeys: [],
      formType: null,
      type: null,
      mode: null,
      hasProcessCode: false,
    },
  };

  try {
    const parsed = typeof schemaResult.content === 'string'
      ? JSON.parse(schemaResult.content)
      : schemaResult.content;
    const found = [];
    collectModeKeys(parsed, found);
    evidence.schema.discoveredModeKeys = found.slice(0, 20);
  } catch {
    evidence.schema.parseable = false;
  }

  const navList = appParamResult && appParamResult.content && Array.isArray(appParamResult.content.formNavigationList)
    ? appParamResult.content.formNavigationList
    : [];
  const matched = navList.find((item) => item && item.formUuid === formUuid);
  if (matched) {
    evidence.navigation.matched = true;
    evidence.navigation.matchedKeys = Object.keys(matched).sort();
    evidence.navigation.formType = matched.formType || null;
    evidence.navigation.type = matched.type || null;
    evidence.navigation.mode = matched.mode || null;
    evidence.navigation.hasProcessCode = !!matched.processCode;
  }
  return evidence;
}

function collectModeKeys(value, found, prefix = '') {
  if (!value || typeof value !== 'object' || found.length >= 20) {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const lower = key.toLowerCase();
    const nextPath = prefix ? `${prefix}.${key}` : key;
    if (['formtype', 'mode', 'type', 'processtype', 'processcode'].includes(lower)) {
      found.push({
        path: nextPath,
        valueShape: IDENTIFIER_KEYS.has(key) ? redactIdentifier(child) : shapeValue(child, key),
      });
    }
    if (child && typeof child === 'object') {
      collectModeKeys(child, found, nextPath);
    }
  }
}

async function readFormObservations(authRef, appType, formUuid) {
  const { createYidaClient } = require(path.join(ROOT, 'lib', 'core', 'yida-client'));
  const client = createYidaClient({ authRef });
  const schemaResult = await client.get(`/dingtalk/web/${appType}/query/formdesign/getFormSchema.json`, {
    formUuid,
    schemaVersion: 'V5',
  }, { silentStatus: true });
  const appParamResult = await client.get(`/${appType}/query/app/getAppPlatFormParam.json`, (auth) => ({
    _api: 'nattyFetch',
    _mock: 'false',
    _csrf_token: auth.csrfToken,
    _locale_time_zone_offset: '28800000',
    pageIndex: 1,
    pageSize: 50,
    _stamp: Date.now(),
  }), { silentStatus: true });
  return {
    schema: summarizeApiResult(schemaResult),
    appParam: summarizeApiResult(appParamResult),
    mode: extractFormModeEvidence(schemaResult, appParamResult, formUuid),
  };
}

async function probeProcessDefinitionReads(authRef, appType, formUuid, processCode, processId, processVersion) {
  const { createYidaClient } = require(path.join(ROOT, 'lib', 'core', 'yida-client'));
  const client = createYidaClient({ authRef });
  const baseParams = {
    formUuid,
    processCode,
    processId: String(processId),
    processVersion: String(processVersion),
    version: String(processVersion),
  };
  const probes = [
    {
      operation: 'Process.getProcessVersionInfo',
      method: 'GET',
      pathTemplate: '/alibaba/web/{appType}/query/process/pageProcessVersion.json',
      params: {
        processCode: true,
        appType: true,
        status: 'PUBLISHED|SAVED|empty',
        pageIndex: true,
        pageSize: true,
        orderByModifyTime: true,
      },
      call: () => client.get(`/alibaba/web/${appType}/query/process/pageProcessVersion.json`, (auth) => ({
        _api: 'Process.getProcessVersionInfo',
        _mock: 'false',
        _csrf_token: auth.csrfToken,
        _locale_time_zone_offset: '28800000',
        processCode,
        appType,
        status: '',
        pageIndex: 1,
        pageSize: 10,
        orderByModifyTime: 'desc',
        _stamp: Date.now(),
      }), { silentStatus: true }),
    },
    {
      operation: 'SimpleProcess.getProcessById',
      method: 'GET',
      pathTemplate: '/alibaba/web/{appType}/query/simpleProcess/getProcessById.json',
      params: { formUuid: true, processCode: true, processId: true, processVersion: true },
      call: () => client.get(`/alibaba/web/${appType}/query/simpleProcess/getProcessById.json`, (auth) => ({
        _api: 'SimpleProcess.getProcessById',
        _mock: 'false',
        _csrf_token: auth.csrfToken,
        _locale_time_zone_offset: '28800000',
        ...baseParams,
        _stamp: Date.now(),
      }), { silentStatus: true }),
    },
    {
      operation: 'SimpleProcess.getProcessById',
      method: 'POST',
      pathTemplate: '/alibaba/web/{appType}/query/simpleProcess/getProcessById.json',
      params: { formUuid: true, processCode: true, processId: true, processVersion: true },
      call: () => client.postForm(`/alibaba/web/${appType}/query/simpleProcess/getProcessById.json`, (auth) => ({
        _api: 'SimpleProcess.getProcessById',
        _mock: 'false',
        _csrf_token: auth.csrfToken,
        _locale_time_zone_offset: '28800000',
        ...baseParams,
      }), { silentStatus: true }),
    },
    {
      operation: 'SimpleProcess.getProcessInfo',
      method: 'GET',
      pathTemplate: '/alibaba/web/{appType}/query/simpleProcess/getProcessInfo.json',
      params: { formUuid: true, processCode: true, processId: true, processVersion: true },
      call: () => client.get(`/alibaba/web/${appType}/query/simpleProcess/getProcessInfo.json`, (auth) => ({
        _api: 'SimpleProcess.getProcessInfo',
        _mock: 'false',
        _csrf_token: auth.csrfToken,
        _locale_time_zone_offset: '28800000',
        ...baseParams,
        _stamp: Date.now(),
      }), { silentStatus: true }),
    },
  ];

  const observations = [];
  for (const probe of probes) {
    let result;
    try {
      result = await probe.call();
    } catch (error) {
      observations.push({
        operation: probe.operation,
        method: probe.method,
        params: probe.params,
        transportFailure: true,
        error: projectError(error, {
          category: 'transport',
          operation: probe.operation,
          transportFailure: true,
        }),
      });
      continue;
    }
    const summarizedResult = summarizeApiResult(result);
    observations.push({
      operation: probe.operation,
      method: probe.method,
      params: probe.params,
      result: summarizedResult,
      versionRows: probe.operation === 'Process.getProcessVersionInfo' ? extractVersionRows(result) : undefined,
      confirmedDefinitionRead: summarizedResult.contentHasDefinitionFields,
    });
  }
  return observations;
}

async function probeMissingContracts(authRef, appType, formUuid, processCode, confirmedProbe) {
  const { createYidaClient } = require(path.join(ROOT, 'lib', 'core', 'yida-client'));
  const client = createYidaClient({ authRef });
  const fakeId = '999999999999999999';
  const fakeVersion = '999999';
  const probes = [
    {
      operation: 'Process.getProcessVersionInfo',
      method: 'GET',
      pathTemplate: '/alibaba/web/{appType}/query/process/pageProcessVersion.json',
      missingKind: 'nonexistentProcessCode',
      call: () => client.get(`/alibaba/web/${appType}/query/process/pageProcessVersion.json`, (auth) => ({
        _api: 'Process.getProcessVersionInfo',
        _mock: 'false',
        _csrf_token: auth.csrfToken,
        _locale_time_zone_offset: '28800000',
        processCode: `${processCode}_MISSING`,
        appType,
        status: '',
        pageIndex: 1,
        pageSize: 10,
        orderByModifyTime: 'desc',
        _stamp: Date.now(),
      }), { silentStatus: true }),
    },
  ];
  if (confirmedProbe && confirmedProbe.operation === 'SimpleProcess.getProcessById') {
    probes.push({
      operation: confirmedProbe.operation,
      method: confirmedProbe.method,
      missingKind: 'nonexistentProcessIdVersion',
      call: () => {
        const body = (auth) => ({
          _api: 'SimpleProcess.getProcessById',
          _mock: 'false',
          _csrf_token: auth.csrfToken,
          _locale_time_zone_offset: '28800000',
          formUuid,
          processCode,
          processId: fakeId,
          processVersion: fakeVersion,
          version: fakeVersion,
          _stamp: Date.now(),
        });
        if (confirmedProbe.method === 'POST') {
          return client.postForm(`/alibaba/web/${appType}/query/simpleProcess/getProcessById.json`, body, { silentStatus: true });
        }
        return client.get(`/alibaba/web/${appType}/query/simpleProcess/getProcessById.json`, body, { silentStatus: true });
      },
    });
  }

  const observations = [];
  for (const probe of probes) {
    let result;
    try {
      result = await probe.call();
    } catch (error) {
      observations.push({
        operation: probe.operation,
        method: probe.method,
        missingKind: probe.missingKind,
        transportFailure: true,
        error: projectError(error, {
          category: 'transport',
          operation: probe.operation,
          transportFailure: true,
        }),
      });
      continue;
    }
    observations.push({
      operation: probe.operation,
      method: probe.method,
      missingKind: probe.missingKind,
      result: summarizeApiResult(result),
      errorContract: {
        success: result && result.success,
        status: result && result.status !== undefined ? result.status : null,
        code: result && result.code !== undefined ? result.code : null,
        errorCode: result && result.errorCode !== undefined ? result.errorCode : null,
        hasStructuredCode: !!(result && (result.code || result.errorCode || result.status)),
      },
    });
  }
  return observations;
}

function firstConfirmedDefinitionProbe(readObservations) {
  return readObservations.find((probe) => probe.confirmedDefinitionRead && probe.operation !== 'Process.getProcessVersionInfo')
    || readObservations.find((probe) => probe.confirmedDefinitionRead)
    || null;
}

function readTrace(tracePath) {
  if (!fs.existsSync(tracePath)) {
    return [];
  }
  const raw = fs.readFileSync(tracePath, 'utf8').trim();
  return raw ? raw.split(/\r?\n/).map((line) => JSON.parse(line)) : [];
}

function assertLauncherTrace(tracePath, launcherPath) {
  const trace = readTrace(tracePath);
  if (trace.length === 0) {
    throw new Error('Launcher trace is empty; source launcher was not used');
  }
  const sourceBinReal = fs.realpathSync(SOURCE_BIN);
  for (const entry of trace) {
    if (fs.realpathSync(entry.sourceBin) !== sourceBinReal) {
      throw new Error('Launcher did not execute current checkout bin/yida.js');
    }
  }
  return {
    commandCount: trace.length,
    launcherSha256: sha256(fs.realpathSync(launcherPath)).slice(0, 16),
    sourceBin: path.relative(ROOT, sourceBinReal),
    sourceBinSha256: hashFile(sourceBinReal).slice(0, 16),
    commands: trace.map((entry) => summarizeArgs(entry.argv)),
  };
}

function buildStageBindings(stage, values) {
  return {
    stage,
    appType: redactIdentifier(values.appType),
    formUuid: redactIdentifier(values.formUuid),
    processCode: redactIdentifier(values.processCode),
    processId: redactIdentifier(values.processId),
    processVersion: values.processVersion === undefined || values.processVersion === null
      ? { present: false }
      : { present: true, type: typeof values.processVersion },
  };
}

function isUnsafeString(value, forbiddenValues = []) {
  const text = String(value || '');
  if (!text) {
    return false;
  }
  if (forbiddenValues.some((forbiddenValue) => forbiddenValue && text.includes(String(forbiddenValue)))) {
    return true;
  }
  return INTERNAL_PATH_PATTERNS.concat(CREDENTIAL_PATTERNS).some((pattern) => pattern.test(text));
}

function extractShapedFieldValue(shape, key) {
  const field = shape && shape.fields && shape.fields[key];
  if (field === undefined) {
    return undefined;
  }
  if (field && typeof field === 'object' && Object.prototype.hasOwnProperty.call(field, 'value')) {
    return field.value;
  }
  return field;
}

function scrubLoginEvidence(value) {
  const preflightPassed = !!(
    value &&
    typeof value === 'object' &&
    (value.preflightPassed === true || value.hasCsrf === true)
  );
  return {
    source: 'local-cache',
    preflightPassed,
  };
}

function scrubCommandEvidence(value) {
  const command = typeof value.command === 'string' ? value.command : 'unknown';
  const output = {
    command,
    status: typeof value.status === 'number' ? value.status : null,
  };
  if (command === 'login --check-only') {
    const shapedStatus = extractShapedFieldValue(value.stdoutJsonShape, 'status');
    const shapedCanAutoUse = extractShapedFieldValue(value.stdoutJsonShape, 'can_auto_use');
    const preflightStatus = value.preflightStatus || shapedStatus;
    output.preflightStatus = preflightStatus === 'ok' ? 'ok' : 'not_ok';
    output.canAutoUse = value.canAutoUse === true || value.can_auto_use === true || shapedCanAutoUse === true;
  }
  return output;
}

function isCommandEvidenceObject(value) {
  return !!(
    value &&
    typeof value === 'object' &&
    typeof value.command === 'string' &&
    Object.prototype.hasOwnProperty.call(value, 'status') &&
    (
      typeof value.status === 'number' ||
      Array.isArray(value.stdoutJsonKeys) ||
      value.stdoutJsonShape ||
      value.stdoutSha256 ||
      value.stderrSha256
    )
  );
}

function scrubEvidenceForWrite(value, forbiddenValues = []) {
  if (Array.isArray(value)) {
    return value.map((item) => scrubEvidenceForWrite(item, forbiddenValues));
  }
  if (value && typeof value === 'object') {
    if (isCommandEvidenceObject(value)) {
      return scrubCommandEvidence(value);
    }
    const output = {};
    for (const [key, child] of Object.entries(value)) {
      if (UNSAFE_EVIDENCE_KEYS.has(key)) {
        continue;
      }
      if (key === 'login') {
        output[key] = scrubLoginEvidence(child);
        continue;
      }
      if (key === 'message' && typeof child === 'string') {
        output[key] = { redacted: true, type: 'string', length: child.length, sha256: sha256(child).slice(0, 16) };
        continue;
      }
      output[key] = scrubEvidenceForWrite(child, forbiddenValues);
    }
    return output;
  }
  if (typeof value === 'string' && isUnsafeString(value, forbiddenValues)) {
    return { redacted: true, type: 'string', length: value.length, sha256: sha256(value).slice(0, 16) };
  }
  return value;
}

function scanContentForLeaks(content, forbiddenValues, options = {}) {
  const findings = [];
  const file = options.file || '<memory>';
  const patterns = CREDENTIAL_PATTERNS
    .concat(INTERNAL_PATH_PATTERNS)
    .concat(options.extraPatterns || []);
  for (const value of forbiddenValues) {
    if (value && content.includes(String(value))) {
      findings.push({
        file,
        valueSha256: sha256(value).slice(0, 16),
      });
    }
  }
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) {
      findings.push({
        file,
        pattern: String(pattern),
      });
    }
  }
  return {
    passed: findings.length === 0,
    findings,
  };
}

function leakScan(filePaths, forbiddenValues, options = {}) {
  const findings = [];
  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) { continue; }
    const content = fs.readFileSync(filePath, 'utf8');
    const result = scanContentForLeaks(content, forbiddenValues, {
      file: path.relative(ROOT, filePath),
      extraPatterns: options.extraPatterns,
    });
    findings.push(...result.findings);
  }
  return {
    passed: findings.length === 0,
    findings,
  };
}

function buildForbiddenValues(cookieData, privateState, extraValues = []) {
  const ids = privateState && privateState.resourceIds || {};
  return [
    ids.appType,
    ids.formUuid,
    ids.processCode,
    ids.processId,
    cookieData && cookieData.csrf_token,
    cookieData && cookieData.base_url,
    cookieData && cookieData.cookies ? cookieHeaderFromData(cookieData) : null,
    ...extraValues,
  ].filter(Boolean).map(String);
}

function safeEnvelopeScalar(value, fallback) {
  const text = String(value || '');
  if (!text || isUnsafeString(text, [])) {
    return fallback;
  }
  return /^[A-Za-z0-9_.:-]{1,160}$/.test(text) ? text : fallback;
}

function minimalRedactionFailureEnvelope(evidence, phase) {
  return {
    kind: safeEnvelopeScalar(evidence && evidence.kind, 'openyida_schema_process_api_evidence'),
    version: typeof (evidence && evidence.version) === 'number' ? evidence.version : 1,
    runId: safeEnvelopeScalar(evidence && evidence.runId, null),
    status: 'failed',
    error: {
      category: 'redaction',
      code: 'EVIDENCE_LEAK_SCAN_FAILED',
      phase: safeEnvelopeScalar(phase, null),
      operation: null,
      transportFailure: false,
    },
  };
}

function writeSafeEvidence(evidencePath, evidence, forbiddenValues, options = {}) {
  const safeEvidence = scrubEvidenceForWrite(evidence, forbiddenValues);
  let serialized = `${JSON.stringify(safeEvidence, null, 2)}\n`;
  let leakResult = scanContentForLeaks(serialized, forbiddenValues, {
    file: path.relative(ROOT, evidencePath),
    extraPatterns: options.extraScanPatterns,
  });
  if (leakResult.passed) {
    safeEvidence.leakScan = { passed: true, findings: [] };
    serialized = `${JSON.stringify(safeEvidence, null, 2)}\n`;
    leakResult = scanContentForLeaks(serialized, forbiddenValues, {
      file: path.relative(ROOT, evidencePath),
      extraPatterns: options.extraScanPatterns,
    });
  }
  if (!leakResult.passed) {
    const failureEnvelope = minimalRedactionFailureEnvelope(evidence, options.phase);
    writeJson(evidencePath, failureEnvelope);
    if (options.throwOnLeak !== false) {
      throw createLocalError('EVIDENCE_LEAK_SCAN_FAILED', 'redaction');
    }
    return failureEnvelope;
  }
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(evidencePath, serialized, { encoding: 'utf8', mode: 0o600 });
  fs.chmodSync(evidencePath, 0o600);
  return safeEvidence;
}

async function run(options = {}) {
  if (!options.real) {
    throw new Error('This runner requires explicit --real opt-in');
  }
  const runId = options.runId || `schema-process-evidence-${nowStamp()}`;
  const resultDir = path.resolve(options.resultDir || DEFAULT_RESULT_DIR);
  const runDir = path.join(resultDir, runId);
  fs.mkdirSync(runDir, { recursive: true, mode: 0o700 });
  fs.chmodSync(runDir, 0o700);

  const workspace = path.join(runDir, 'workspace');
  fs.mkdirSync(workspace, { recursive: true, mode: 0o700 });

  const cookieFile = resolveCookieFile(options.cookieFile);
  const cookieData = readCookieData(cookieFile);
  const launcher = createLauncher(workspace);
  const commandEnv = buildCommandEnv(launcher, cookieData);
  const authRef = createAuthRef(cookieData);
  const prefix = `SAC06_EVIDENCE_${nowStamp()}`;
  const evidencePath = path.join(runDir, 'evidence.v1.json');
  const privateStatePath = path.join(runDir, 'private-state.v1.json');

  const evidence = {
    kind: 'openyida_schema_process_api_evidence',
    version: 1,
    runId,
    startedAt: new Date().toISOString(),
    prefixHash: sha256(prefix).slice(0, 16),
    source: {
      cli: {
        bin: path.relative(ROOT, fs.realpathSync(SOURCE_BIN)),
        binSha256: hashFile(SOURCE_BIN).slice(0, 16),
      },
      skills: readSourceSkillEvidence(),
    },
    login: {
      source: 'local-cache',
      preflightPassed: false,
    },
    commands: [],
    formConversion: {},
    processStages: [],
    readObservations: [],
    missingContracts: [],
    cleanup: {
      remoteResourcesDeleted: false,
      remoteResourcesRetained: true,
      reason: 'No safe delete API was exercised in this evidence runner',
    },
  };
  const privateState = {
    runId,
    prefix,
    cookieFile,
    resourceIds: {},
  };
  let currentPhase = 'init';

  try {
    currentPhase = 'login-preflight';
    const loginResult = runCommand(commandEnv, ['login', '--check-only']);
    const loginJson = parseLastJsonLine(loginResult);
    evidence.commands.push(commandEvidence(loginResult, loginJson));
    if (!loginJson || loginJson.status !== 'ok' || loginJson.can_auto_use !== true) {
      throw createLocalError('LOGIN_PREFLIGHT_FAILED', 'validation');
    }
    evidence.login.preflightPassed = true;

    currentPhase = 'create-app';
    const appResult = runCommand(commandEnv, ['create-app', `${prefix}_App`, `${prefix}_App`], { expectStatus: 'any' });
    const appJson = parseLastJsonLine(appResult);
    evidence.commands.push(commandEvidence(appResult, appJson));
    if (appResult.status !== 0 || !appJson || appJson.success !== true || !appJson.appType) {
      throw createLocalError('CREATE_APP_RESULT_MISSING', 'validation');
    }
    privateState.resourceIds.appType = appJson.appType;

    currentPhase = 'prepare-local-files';
    const fieldsPath = path.join(runDir, 'fields.json');
    const processDefinitionPath = path.join(runDir, 'process-definition.json');
    writeJson(fieldsPath, evidenceFieldsFile());
    writeJson(processDefinitionPath, evidenceProcessDefinition());

    currentPhase = 'create-form';
    const formResult = runCommand(commandEnv, ['create-form', 'create', appJson.appType, `${prefix}_Form`, fieldsPath], { expectStatus: 'any' });
    const formJson = parseLastJsonLine(formResult);
    evidence.commands.push(commandEvidence(formResult, formJson));
    if (formResult.status !== 0 || !formJson || formJson.success !== true || !formJson.formUuid) {
      throw createLocalError('CREATE_FORM_RESULT_MISSING', 'validation');
    }
    privateState.resourceIds.formUuid = formJson.formUuid;

    currentPhase = 'switch-form-type';
    const configureProcess = require(path.join(ROOT, 'lib', 'process', 'configure-process'));
    const beforeSwitch = await readFormObservations(authRef, appJson.appType, formJson.formUuid);
    const switchResult = await configureProcess.switchFormType(authRef, appJson.appType, formJson.formUuid);
    const afterSwitch = await readFormObservations(authRef, appJson.appType, formJson.formUuid);
    const processCode = await configureProcess.getProcessCodeFromAppParam(authRef, appJson.appType, formJson.formUuid)
      || await configureProcess.getProcessCodeFromSchema(authRef, appJson.appType, formJson.formUuid);
    if (!processCode) {
      throw createLocalError('PROCESS_CODE_NOT_AVAILABLE', 'validation');
    }
    privateState.resourceIds.processCode = processCode;
    evidence.formConversion = {
      before: beforeSwitch.mode,
      switchResult: summarizeApiResult(switchResult),
      after: afterSwitch.mode,
      readMethod: 'getFormSchema + getAppPlatFormParam',
      processCodeAvailableAfterSwitch: true,
    };
    evidence.processStages.push(buildStageBindings('after-switch', {
      appType: appJson.appType,
      formUuid: formJson.formUuid,
      processCode,
    }));

    currentPhase = 'query-versions-before-draft';
    const publishedBefore = await configureProcess.queryProcessVersions(authRef, appJson.appType, processCode, 'PUBLISHED');
    const allBefore = await configureProcess.queryProcessVersions(authRef, appJson.appType, processCode, '');
    evidence.readObservations.push({
      phase: 'before-draft',
      operation: 'Process.getProcessVersionInfo',
      published: summarizeApiResult(publishedBefore),
      all: summarizeApiResult(allBefore),
      allVersionRows: extractVersionRows(allBefore),
    });

    const latestRows = allBefore && allBefore.content && Array.isArray(allBefore.content.data)
      ? allBefore.content.data
      : [];
    const latestItem = latestRows[0] || null;
    const latestProcessId = latestItem && latestItem.id || null;
    const latestVersion = latestItem && latestItem.version !== undefined
      ? parseInt(latestItem.version, 10) || 0
      : 0;
    const newVersion = latestVersion + 1;
    currentPhase = 'draft-create';
    const draftResult = await configureProcess.newDraftProcess(
      authRef,
      appJson.appType,
      processCode,
      formJson.formUuid,
      latestProcessId,
      newVersion
    );
    let processId = draftResult && draftResult.content && draftResult.content.processId;
    if (!processId && draftResult && typeof draftResult.content === 'number') {
      processId = draftResult.content;
    }
    if (!processId) {
      const allAfterDraft = await configureProcess.queryProcessVersions(authRef, appJson.appType, processCode, '');
      const draftRows = allAfterDraft && allAfterDraft.content && Array.isArray(allAfterDraft.content.data)
        ? allAfterDraft.content.data.filter((item) => item && item.status === 'SAVED')
        : [];
      processId = draftRows[0] && draftRows[0].id || null;
    }
    if (!processId) {
      throw createLocalError('DRAFT_PROCESS_ID_NOT_RECOVERED', 'validation');
    }
    privateState.resourceIds.processId = processId;
    privateState.resourceIds.processVersion = newVersion;
    evidence.processStages.push({
      ...buildStageBindings('after-draft-create', {
        appType: appJson.appType,
        formUuid: formJson.formUuid,
        processCode,
        processId,
        processVersion: newVersion,
      }),
      response: summarizeApiResult(draftResult),
    });

    currentPhase = 'read-after-draft';
    const afterDraftReads = await probeProcessDefinitionReads(authRef, appJson.appType, formJson.formUuid, processCode, processId, newVersion);
    evidence.readObservations.push({
      phase: 'after-draft-create',
      probes: afterDraftReads,
    });

    currentPhase = 'save-process';
    const built = configureProcess._private.buildProcessAndViewJson(
      evidenceProcessDefinition(),
      processCode,
      formJson.formUuid,
      authRef.baseUrl,
      appJson.appType
    );
    const processJsonStr = JSON.stringify(built.processJson);
    const viewJsonStr = JSON.stringify(built.viewJson);
    const saveResult = await configureProcess.saveProcessById(
      authRef,
      appJson.appType,
      formJson.formUuid,
      processCode,
      processId,
      newVersion,
      processJsonStr,
      viewJsonStr
    );
    if (!saveResult || saveResult.success !== true) {
      throw createLocalError('SAVE_PROCESS_FAILED', 'validation');
    }
    evidence.processStages.push({
      ...buildStageBindings('after-save', {
        appType: appJson.appType,
        formUuid: formJson.formUuid,
        processCode,
        processId,
        processVersion: newVersion,
      }),
      response: summarizeApiResult(saveResult),
      localDefinition: {
        processJson: summarizeDefinitionValue(processJsonStr),
        viewJson: summarizeDefinitionValue(viewJsonStr),
      },
      recoveryObservation: 'processId/version/processCode are available before publish and can be used for read-only probes',
    });

    currentPhase = 'read-after-save';
    const afterSaveReads = await probeProcessDefinitionReads(authRef, appJson.appType, formJson.formUuid, processCode, processId, newVersion);
    evidence.readObservations.push({
      phase: 'after-save',
      probes: afterSaveReads,
    });

    currentPhase = 'publish-process';
    const publishResult = await configureProcess.publishProcessById(
      authRef,
      appJson.appType,
      formJson.formUuid,
      processCode,
      processId,
      newVersion
    );
    if (!publishResult || publishResult.success !== true) {
      throw createLocalError('PUBLISH_PROCESS_FAILED', 'validation');
    }
    evidence.processStages.push({
      ...buildStageBindings('after-publish', {
        appType: appJson.appType,
        formUuid: formJson.formUuid,
        processCode,
        processId,
        processVersion: newVersion,
      }),
      response: summarizeApiResult(publishResult),
      recoveryObservation: 'published version can be discovered by processCode/version list after publish',
    });

    currentPhase = 'read-after-publish';
    let confirmedProbe = null;
    for (let index = 0; index < READ_PROBE_REPEAT_COUNT; index++) {
      const reads = await probeProcessDefinitionReads(authRef, appJson.appType, formJson.formUuid, processCode, processId, newVersion);
      if (!confirmedProbe) {
        confirmedProbe = firstConfirmedDefinitionProbe(reads);
      }
      evidence.readObservations.push({
        phase: `after-publish-repeat-${index + 1}`,
        probes: reads,
      });
    }
    evidence.definitionReadConclusion = confirmedProbe
      ? {
        confirmed: true,
        operation: confirmedProbe.operation,
        method: confirmedProbe.method,
        params: confirmedProbe.params,
      }
      : {
        confirmed: false,
        reason: 'No probed read-only endpoint returned processJson/viewJson/json fields',
      };

    currentPhase = 'missing-contracts';
    evidence.missingContracts = await probeMissingContracts(
      authRef,
      appJson.appType,
      formJson.formUuid,
      processCode,
      confirmedProbe
    );

    currentPhase = 'finalize-evidence';
    evidence.launcher = assertLauncherTrace(launcher.tracePath, launcher.launcherPath);
    privateState.finishedAt = new Date().toISOString();
    evidence.finishedAt = privateState.finishedAt;
    evidence.status = 'passed';

    writeJson(privateStatePath, privateState);
    const forbiddenValues = buildForbiddenValues(cookieData, privateState);
    const safeEvidence = writeSafeEvidence(evidencePath, evidence, forbiddenValues, { phase: currentPhase });
    writeJson(path.join(resultDir, 'latest.json'), {
      runId,
      status: safeEvidence.status,
      evidence: path.relative(ROOT, evidencePath),
      privateState: path.relative(ROOT, privateStatePath),
      finishedAt: safeEvidence.finishedAt,
    });
    return {
      runId,
      evidencePath,
      privateStatePath,
      status: safeEvidence.status,
      definitionReadConclusion: safeEvidence.definitionReadConclusion,
      cleanup: safeEvidence.cleanup,
    };
  } catch (error) {
    evidence.finishedAt = new Date().toISOString();
    evidence.status = 'failed';
    evidence.error = projectError(error, { phase: currentPhase });
    writeJson(privateStatePath, privateState);
    const forbiddenValues = buildForbiddenValues(cookieData, privateState);
    writeSafeEvidence(evidencePath, evidence, forbiddenValues, {
      phase: currentPhase,
      throwOnLeak: false,
    });
    throw Object.assign(error, {
      runSummary: {
        runId,
        evidencePath,
        privateStatePath,
        error: projectError(error, { phase: currentPhase }),
      },
    });
  } finally {
    if (!options.keepWorkspace) {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  }
}

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    process.exit(0);
  }
  run(options).then((summary) => {
    process.stdout.write(`${JSON.stringify({
      ok: true,
      runId: summary.runId,
      status: summary.status,
      definitionReadConfirmed: !!(summary.definitionReadConclusion && summary.definitionReadConclusion.confirmed),
      evidence: path.relative(ROOT, summary.evidencePath),
      privateState: path.relative(ROOT, summary.privateStatePath),
      remoteResourcesRetained: summary.cleanup.remoteResourcesRetained,
    })}\n`);
  }).catch((error) => {
    const summary = error.runSummary || {};
    const projectedError = summary.error || projectError(error);
    process.stderr.write(`${JSON.stringify({
      ok: false,
      runId: summary.runId || null,
      errorCode: projectedError.code,
      errorCategory: projectedError.category,
      failurePhase: projectedError.phase,
      evidence: summary.evidencePath ? path.relative(ROOT, summary.evidencePath) : null,
    })}\n`);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_RESULT_DIR,
  buildForbiddenValues,
  leakScan,
  projectError,
  readSourceSkillEvidence,
  run,
  scrubEvidenceForWrite,
  summarizeApiResult,
  writeSafeEvidence,
};
