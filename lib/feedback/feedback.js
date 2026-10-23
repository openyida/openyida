'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const { findProjectRoot, detectActiveTool } = require('../core/utils');
const { parseOpenOption, withBrowserHandoff } = require('../core/browser-handoff');
const { banner, step, label, success, fail, hint } = require('../core/chalk');
const { t } = require('../core/i18n');

const DEFAULT_FORM_NAME = 'OpenYida 体验反馈';
const DEFAULT_APP_NAME = 'OpenYida 体验反馈';
const CONFIG_FILE_NAME = 'config.json';
const REMINDER_FILE_NAME = 'reminder.json';
const LOGIN_EVENTS_FILE_NAME = 'login-events.json';
const LOGIN_LOOP_WINDOW_MS = 30 * 60 * 1000;
const LOGIN_LOOP_THRESHOLD = 3;

const FIELD_LABELS = {
  result: '处理结果',
  content: '反馈内容',
  screenshot: '截图（选填）',
  issueType: '问题类型',
  score: '体验评分',
  contact: '联系方式',
  privacy: '隐私确认',
  tool: 'AI 工具',
  model: '模型',
  command: '命令场景',
  session: '匿名会话 ID',
  version: 'OpenYida 版本',
  reason: '触发原因',
  diagnostics: '脱敏诊断信息',
};

const METADATA_PARAM_MAP = {
  tool: ['oy_tool', 'tool', 'ai_tool'],
  model: ['oy_model', 'model'],
  command: ['oy_command', 'command', 'cmd'],
  session: ['oy_session', 'session', 'session_id'],
  version: ['oy_version', 'openyida_version', 'version'],
  reason: ['oy_reason', 'reason'],
  diagnostics: ['oy_diag', 'diagnostics', 'diag'],
};

function printUsage() {
  process.stderr.write(`
用法:
  openyida feedback setup <appType> [--name "OpenYida 体验反馈"] [--path /o/openyida-feedback] [--open|--no-open]
  openyida feedback setup --create-app [--app-name "OpenYida 体验反馈"] [--name "OpenYida 体验反馈"]
  openyida feedback report --input <summary.json> --output-dir <new-directory>
  openyida feedback github setup [--install --confirm] [--json]
  openyida feedback github <status|star|fork> [--confirm] [--json]
  openyida feedback url [--tool Codex] [--model gpt-5] [--command publish] [--diagnostics "..."]
  openyida feedback dismiss --today|--forever|--reset
  openyida feedback status

说明:
  ${t('feedback_report.help')}
  feedback setup 会在宜搭创建一个公开反馈表单，并写入本地 .cache/openyida/feedback/config.json。
  url 只生成带脱敏元数据的填写链接，不提交任何网络请求。
  dismiss/status 只读写本地提醒状态。
`);
}

function readOptionValue(args, index, optionName) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${optionName} requires a value`);
  }
  return value;
}

function getFeedbackCacheDir(configPath) {
  if (configPath) {
    return path.dirname(path.resolve(configPath));
  }
  return path.join(findProjectRoot(), '.cache', 'openyida', 'feedback');
}

function getFeedbackConfigPath(configPath) {
  if (configPath) {
    return path.resolve(configPath);
  }
  return path.join(getFeedbackCacheDir(), CONFIG_FILE_NAME);
}

function getReminderPath(configPath) {
  return path.join(getFeedbackCacheDir(configPath), REMINDER_FILE_NAME);
}

function getLoginEventsPath(configPath) {
  return path.join(getFeedbackCacheDir(configPath), LOGIN_EVENTS_FILE_NAME);
}

function ensureFeedbackCacheDir(configPath) {
  const dir = getFeedbackCacheDir(configPath);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function parseSetupArgs(args) {
  const openOption = parseOpenOption(args);
  const filteredArgs = openOption.args;
  const options = {
    appType: '',
    createApp: false,
    appName: DEFAULT_APP_NAME,
    formName: DEFAULT_FORM_NAME,
    openPath: '',
    openAuth: 'n',
    configPath: '',
    openMode: openOption.mode,
  };
  const positionals = [];

  for (let index = 0; index < filteredArgs.length; index++) {
    const arg = filteredArgs[index];
    if (arg === '--create-app') {
      options.createApp = true;
    } else if (arg === '--app-name') {
      options.appName = readOptionValue(filteredArgs, index, arg);
      index++;
    } else if (arg === '--name' || arg === '--form-name') {
      options.formName = readOptionValue(filteredArgs, index, arg);
      index++;
    } else if (arg === '--app-type' || arg === '--appType' || arg === '-a') {
      options.appType = readOptionValue(filteredArgs, index, arg);
      index++;
    } else if (arg === '--path' || arg === '--open-url' || arg === '--openUrl') {
      options.openPath = readOptionValue(filteredArgs, index, arg);
      index++;
    } else if (arg === '--open-auth' || arg === '--openAuth') {
      options.openAuth = readOptionValue(filteredArgs, index, arg);
      index++;
    } else if (arg === '--config') {
      options.configPath = readOptionValue(filteredArgs, index, arg);
      index++;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }

  if (!options.appType && positionals[0]) {
    options.appType = positionals[0];
  }
  if (options.openAuth !== 'y' && options.openAuth !== 'n') {
    throw new Error('--open-auth must be y or n');
  }
  if (options.openPath && !/^\/o\/[A-Za-z0-9_-]+$/.test(options.openPath)) {
    throw new Error('--path must look like /o/openyida-feedback');
  }
  return options;
}

function parseUrlArgs(args) {
  const options = {
    configPath: '',
    tool: '',
    model: '',
    command: '',
    session: '',
    version: '',
    reason: '',
    diagnostics: '',
    metaJson: '',
    json: false,
  };

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--config') {
      options.configPath = readOptionValue(args, index, arg);
      index++;
    } else if (arg === '--tool') {
      options.tool = readOptionValue(args, index, arg);
      index++;
    } else if (arg === '--model') {
      options.model = readOptionValue(args, index, arg);
      index++;
    } else if (arg === '--command') {
      options.command = readOptionValue(args, index, arg);
      index++;
    } else if (arg === '--session-id' || arg === '--session') {
      options.session = readOptionValue(args, index, arg);
      index++;
    } else if (arg === '--version') {
      options.version = readOptionValue(args, index, arg);
      index++;
    } else if (arg === '--reason') {
      options.reason = readOptionValue(args, index, arg);
      index++;
    } else if (arg === '--diagnostics' || arg === '--diag') {
      options.diagnostics = readOptionValue(args, index, arg);
      index++;
    } else if (arg === '--meta-json') {
      options.metaJson = readOptionValue(args, index, arg);
      index++;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function parseDismissArgs(args) {
  const options = {
    configPath: '',
    today: false,
    forever: false,
    reset: false,
  };

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--config') {
      options.configPath = readOptionValue(args, index, arg);
      index++;
    } else if (arg === '--today') {
      options.today = true;
    } else if (arg === '--forever') {
      options.forever = true;
    } else if (arg === '--reset') {
      options.reset = true;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function parseArgs(args = []) {
  const command = args[0] || 'help';
  const subArgs = args.slice(1);

  if (command === 'report') {
    return { command, options: require('./report').parseReportArgs(subArgs) };
  }
  if (command === 'setup') {
    return { command, options: parseSetupArgs(subArgs) };
  }
  if (command === 'url') {
    return { command, options: parseUrlArgs(subArgs) };
  }
  if (command === 'dismiss' || command === 'snooze') {
    return { command: 'dismiss', options: parseDismissArgs(subArgs) };
  }
  if (command === 'status' || command === 'should-remind') {
    const options = { configPath: '' };
    for (let index = 0; index < subArgs.length; index++) {
      const arg = subArgs[index];
      if (arg === '--config') {
        options.configPath = readOptionValue(subArgs, index, arg);
        index++;
      } else if (arg.startsWith('-')) {
        throw new Error(`Unknown option: ${arg}`);
      }
    }
    return { command, options };
  }
  if (command === '--help' || command === '-h' || command === 'help') {
    return { command: 'help', options: {} };
  }
  throw new Error(`Unknown feedback sub-command: ${command}`);
}

function buildFeedbackFields() {
  return [
    {
      type: 'RadioField',
      label: FIELD_LABELS.result,
      required: true,
      options: ['未解决', '部分解决', '已解决', '只是建议'],
    },
    {
      type: 'TextareaField',
      label: FIELD_LABELS.content,
      required: true,
      placeholder: '请写下哪里没有达到预期，或你希望我们怎么改进。',
    },
    {
      type: 'ImageField',
      label: FIELD_LABELS.screenshot,
    },
    {
      type: 'SelectField',
      label: FIELD_LABELS.issueType,
      options: ['登录认证', '创建应用', '表单配置', '页面发布', '数据查询', '连接器/集成', '文档/技能', '性能/稳定性', '其他'],
    },
    {
      type: 'RateField',
      label: FIELD_LABELS.score,
    },
    {
      type: 'TextField',
      label: FIELD_LABELS.contact,
      placeholder: '选填；如需回复可填写联系方式。',
    },
    {
      type: 'CheckboxField',
      label: FIELD_LABELS.privacy,
      required: true,
      options: ['我确认本次反馈只提交我填写的内容、我主动上传的截图和脱敏诊断信息，不提交 Cookie、密钥或完整会话。'],
    },
    ...[
      FIELD_LABELS.tool,
      FIELD_LABELS.model,
      FIELD_LABELS.command,
      FIELD_LABELS.session,
      FIELD_LABELS.version,
      FIELD_LABELS.reason,
      FIELD_LABELS.diagnostics,
    ].map((fieldLabel) => ({
      type: fieldLabel === FIELD_LABELS.diagnostics ? 'TextareaField' : 'TextField',
      label: fieldLabel,
      behavior: 'HIDDEN',
      visibility: ['PC', 'MOBILE'],
    })),
  ];
}

function resolveCliPath() {
  return path.join(__dirname, '..', '..', 'bin', 'yida.js');
}

function runOpenYidaJson(args, options = {}) {
  const cliPath = options.cliPath || resolveCliPath();
  const child = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd || process.cwd(),
    env: {
      ...process.env,
      YIDA_QUIET: '1',
      OPENYIDA_NO_BROWSER_HANDOFF: '1',
    },
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });

  if (child.status !== 0) {
    const output = [child.stderr, child.stdout].filter(Boolean).join('\n').trim();
    throw new Error(`openyida ${args.join(' ')} failed${output ? `: ${output}` : ''}`);
  }

  return parseJsonOutput(child.stdout, `openyida ${args.join(' ')}`);
}

function parseJsonOutput(output, source = 'command') {
  const text = String(output || '').trim();
  if (!text) {
    throw new Error(`${source} did not return JSON`);
  }

  try {
    return JSON.parse(text);
  } catch (firstError) {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1));
      } catch {
        // fall through
      }
    }
    throw firstError;
  }
}

function collectFieldMap(schemaResult, requiredLabels = Object.values(FIELD_LABELS)) {
  const content = schemaResult && schemaResult.content;
  const pages = content && content.pages;
  const fieldMap = {};
  const missing = new Set(requiredLabels);

  function labelOf(node) {
    const labelValue = node && node.props && node.props.label;
    if (!labelValue) {
      return '';
    }
    if (typeof labelValue === 'object') {
      return labelValue.zh_CN || labelValue.en_US || labelValue.ja_JP || '';
    }
    return String(labelValue);
  }

  function visit(node) {
    if (!node) {
      return;
    }
    const fieldId = node.props && node.props.fieldId;
    const fieldLabel = labelOf(node);
    if (fieldId && requiredLabels.includes(fieldLabel)) {
      fieldMap[fieldLabel] = fieldId;
      missing.delete(fieldLabel);
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(visit);
    }
  }

  (pages || []).forEach((page) => {
    const root = page.componentsTree && page.componentsTree[0];
    visit(root);
  });

  if (missing.size > 0) {
    throw new Error(`反馈表单字段缺失: ${Array.from(missing).join(', ')}`);
  }

  return fieldMap;
}

function buildAutofillActionSource(fieldMap) {
  const mapJson = JSON.stringify(fieldMap, null, 2);
  const paramMapJson = JSON.stringify(METADATA_PARAM_MAP, null, 2);
  return `var OPENYIDA_FEEDBACK_FIELDS = ${mapJson};
var OPENYIDA_FEEDBACK_PARAMS = ${paramMapJson};

function openyidaFeedbackGetComponent(ctx, fieldId) {
  if (!fieldId) { return null; }
  if (ctx && typeof ctx.$ === 'function') { return ctx.$(fieldId); }
  if (typeof $ === 'function') { return $(fieldId); }
  return null;
}

function openyidaFeedbackSetValue(ctx, label, value) {
  if (value === undefined || value === null || value === '') { return; }
  var fieldId = OPENYIDA_FEEDBACK_FIELDS[label];
  var component = openyidaFeedbackGetComponent(ctx, fieldId);
  if (!component) { return; }
  if (typeof component.setValue === 'function') {
    component.setValue(String(value), { triggerChange: false });
    return;
  }
  if (typeof component.set === 'function') {
    component.set('value', String(value));
  }
}

function openyidaFeedbackDecodeBase64Url(value) {
  if (!value) { return ''; }
  try {
    var normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
    while (normalized.length % 4) { normalized += '='; }
    var binary = window.atob(normalized);
    var escaped = '';
    for (var index = 0; index < binary.length; index++) {
      escaped += '%' + ('00' + binary.charCodeAt(index).toString(16)).slice(-2);
    }
    return decodeURIComponent(escaped);
  } catch (error) {
    return '';
  }
}

function openyidaFeedbackReadParams() {
  var params = {};
  try {
    var searchParams = new URLSearchParams(window.location.search || '');
    Object.keys(OPENYIDA_FEEDBACK_PARAMS).forEach(function(key) {
      var names = OPENYIDA_FEEDBACK_PARAMS[key] || [];
      for (var index = 0; index < names.length; index++) {
        var value = searchParams.get(names[index]);
        if (value) {
          params[key] = value;
          break;
        }
      }
    });
    var metaValue = searchParams.get('oy_meta') || searchParams.get('meta');
    if (metaValue) {
      var decoded = openyidaFeedbackDecodeBase64Url(metaValue);
      if (decoded) {
        var meta = JSON.parse(decoded);
        Object.keys(meta || {}).forEach(function(key) {
          if (params[key] === undefined && meta[key] !== undefined) {
            params[key] = meta[key];
          }
        });
      }
    }
  } catch (error) {
    params.diagnostics = params.diagnostics || 'metadata_parse_failed';
  }
  return params;
}

export function didMount() {
  var metadata = openyidaFeedbackReadParams();
  openyidaFeedbackSetValue(this, '${FIELD_LABELS.tool}', metadata.tool);
  openyidaFeedbackSetValue(this, '${FIELD_LABELS.model}', metadata.model);
  openyidaFeedbackSetValue(this, '${FIELD_LABELS.command}', metadata.command);
  openyidaFeedbackSetValue(this, '${FIELD_LABELS.session}', metadata.session);
  openyidaFeedbackSetValue(this, '${FIELD_LABELS.version}', metadata.version);
  openyidaFeedbackSetValue(this, '${FIELD_LABELS.reason}', metadata.reason);
  openyidaFeedbackSetValue(this, '${FIELD_LABELS.diagnostics}', metadata.diagnostics);
}
`;
}

function buildDefaultOpenPath(appType, formUuid) {
  const digest = crypto
    .createHash('sha1')
    .update(`${appType}:${formUuid}:${Date.now()}`)
    .digest('hex')
    .slice(0, 10);
  return `/o/openyida-feedback-${digest}`;
}

function inferBaseUrl(formResult, publicPath) {
  if (formResult && formResult.url) {
    try {
      return new URL(formResult.url).origin;
    } catch {
      // ignore
    }
  }
  if (formResult && formResult.publicUrl) {
    try {
      return new URL(formResult.publicUrl).origin;
    } catch {
      // ignore
    }
  }
  return publicPath && publicPath.startsWith('http') ? new URL(publicPath).origin : 'https://www.aliwork.com';
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function readFeedbackConfig(configPath) {
  const envConfigPath = configPath || process.env.OPENYIDA_FEEDBACK_CONFIG || '';
  const resolved = getFeedbackConfigPath(envConfigPath);
  if (!fs.existsSync(resolved)) {
    const publicUrl = process.env.OPENYIDA_FEEDBACK_PUBLIC_URL || '';
    if (publicUrl) {
      return {
        schemaVersion: 1,
        source: 'env',
        publicUrl,
        privacy: {
          uploadsFullConversationByDefault: false,
          hashesSessionId: true,
        },
      };
    }
    throw new Error(`未找到反馈表单配置: ${resolved}。请先运行 openyida feedback setup <appType>。`);
  }
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function packageVersion() {
  try {
    return require('../../package.json').version || '';
  } catch {
    return '';
  }
}

function inferToolName() {
  const active = detectActiveTool();
  return active ? active.displayName || active.tool || '' : '';
}

function hashSessionId(value) {
  if (!value) {
    return '';
  }
  const digest = crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
  return `anon_${digest}`;
}

function truncateValue(value, maxLength) {
  if (value === undefined || value === null) {
    return '';
  }
  const text = String(value);
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}

function sanitizeMetadata(raw = {}) {
  const metadata = {};
  const sessionValue = raw.session || raw.sessionId || raw.session_id || process.env.CODEX_THREAD_ID || process.env.CLAUDE_SESSION_ID || '';

  metadata.tool = truncateValue(raw.tool || inferToolName(), 120);
  metadata.model = truncateValue(raw.model || process.env.OPENYIDA_MODEL || process.env.CODEX_MODEL || '', 120);
  metadata.command = truncateValue(raw.command || raw.cmd || '', 160);
  metadata.session = hashSessionId(sessionValue);
  metadata.version = truncateValue(raw.version || raw.openyidaVersion || packageVersion(), 80);
  metadata.reason = truncateValue(raw.reason || '', 240);
  metadata.diagnostics = truncateValue(raw.diagnostics || raw.diag || '', 1800);

  Object.keys(metadata).forEach((key) => {
    if (!metadata[key]) {
      delete metadata[key];
    }
  });
  return metadata;
}

function encodeMetadata(metadata) {
  return Buffer.from(JSON.stringify(metadata), 'utf8').toString('base64url');
}

function buildFeedbackUrl(config, metadataInput = {}) {
  const publicUrl = config.publicUrl || (config.baseUrl && config.openPath ? config.baseUrl + config.openPath : '');
  if (!publicUrl) {
    throw new Error('反馈表单配置缺少 publicUrl');
  }

  const metadata = sanitizeMetadata(metadataInput);
  const url = new URL(publicUrl);
  if (Object.keys(metadata).length > 0) {
    url.searchParams.set('oy_meta', encodeMetadata(metadata));
  }
  return { url: url.toString(), metadata };
}

async function runSetup(options) {
  if (!options.appType && !options.createApp) {
    throw new Error('请提供 appType，或使用 --create-app 创建专用反馈应用');
  }

  banner('OpenYida 反馈表单配置');
  label('Form', options.formName);
  label('Open Auth', options.openAuth);

  const cacheDir = ensureFeedbackCacheDir(options.configPath);
  const fieldsFile = path.join(cacheDir, 'feedback-fields.json');
  const patchFile = path.join(cacheDir, 'feedback-autofill-patch.json');
  const actionsFile = path.join(cacheDir, 'feedback-autofill-actions.js');

  let appType = options.appType;
  let appResult = null;

  if (!appType && options.createApp) {
    step(1, '创建反馈应用');
    appResult = runOpenYidaJson(['create-app', '--name', options.appName, '--desc', 'OpenYida feedback collection', '--no-open']);
    appType = appResult.appType;
    success(`应用已创建: ${appType}`);
  }

  step(options.createApp ? 2 : 1, '创建反馈表单');
  writeJson(fieldsFile, buildFeedbackFields());
  const formResult = runOpenYidaJson([
    'create-form',
    'create',
    appType,
    options.formName,
    fieldsFile,
    '--layout',
    'section',
    '--theme',
    'comfortable',
    '--label-align',
    'top',
    '--no-open',
  ]);

  const formUuid = formResult.formUuid;
  if (!formUuid) {
    throw new Error('创建反馈表单后未拿到 formUuid');
  }
  success(`反馈表单已创建: ${formUuid}`);

  step(options.createApp ? 3 : 2, '写入元数据自动回填脚本');
  const schemaResult = runOpenYidaJson(['get-schema', appType, formUuid]);
  const fieldMap = collectFieldMap(schemaResult);
  fs.writeFileSync(actionsFile, buildAutofillActionSource(fieldMap), 'utf8');
  writeJson(patchFile, [{ action: 'actions-module', sourceFile: actionsFile }]);
  runOpenYidaJson(['create-form', 'patch', appType, formUuid, patchFile, '--no-open']);
  success('自动回填脚本已写入');

  step(options.createApp ? 4 : 3, '开启公开提交链接');
  const openPath = options.openPath || buildDefaultOpenPath(appType, formUuid);
  const shareResult = runOpenYidaJson(['save-share-config', appType, formUuid, openPath, 'y', options.openAuth]);
  if (!shareResult.success) {
    throw new Error(shareResult.message || '公开访问配置失败');
  }

  const baseUrl = inferBaseUrl(formResult, openPath);
  const publicUrl = `${baseUrl}${openPath}`;
  const config = {
    schemaVersion: 1,
    appType,
    appName: appResult ? options.appName : undefined,
    formUuid,
    formName: options.formName,
    baseUrl,
    openPath,
    publicUrl,
    openAuth: options.openAuth,
    fields: fieldMap,
    privacy: {
      uploadsFullConversationByDefault: false,
      hashesSessionId: true,
      note: 'Only explicit user feedback and sanitized metadata should be submitted.',
    },
    createdAt: new Date().toISOString(),
  };

  const configPath = getFeedbackConfigPath(options.configPath);
  writeJson(configPath, config);

  success(`公开反馈表单已配置: ${publicUrl}`);
  hint(`本地配置: ${configPath}`);

  console.log(JSON.stringify(withBrowserHandoff(
    {
      success: true,
      configPath,
      appType,
      formUuid,
      publicUrl,
      openPath,
      fieldCount: Object.keys(fieldMap).length,
    },
    publicUrl,
    { stage: 'feedback_setup_success', title: options.formName },
    options.openMode
  ), null, 2));
}

function runUrl(options) {
  const config = readFeedbackConfig(options.configPath);
  let metaFromJson = {};
  if (options.metaJson) {
    metaFromJson = JSON.parse(options.metaJson);
  }
  const { url, metadata } = buildFeedbackUrl(config, {
    ...metaFromJson,
    tool: options.tool || metaFromJson.tool,
    model: options.model || metaFromJson.model,
    command: options.command || metaFromJson.command,
    session: options.session || metaFromJson.session,
    version: options.version || metaFromJson.version,
    reason: options.reason || metaFromJson.reason,
    diagnostics: options.diagnostics || metaFromJson.diagnostics,
  });

  if (options.json) {
    console.log(JSON.stringify({ success: true, url, metadata }, null, 2));
    return;
  }
  console.log(url);
}

function endOfToday() {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return end;
}

function getReminderStatus(configPath) {
  const reminderPath = getReminderPath(configPath);
  if (!fs.existsSync(reminderPath)) {
    return {
      shouldRemind: true,
      reason: 'active',
      reminderPath,
    };
  }

  const state = JSON.parse(fs.readFileSync(reminderPath, 'utf8'));
  if (state.disabled === true) {
    return {
      shouldRemind: false,
      reason: 'disabled',
      reminderPath,
      state,
    };
  }

  if (state.snoozedUntil && new Date(state.snoozedUntil).getTime() > Date.now()) {
    return {
      shouldRemind: false,
      reason: state.reason || 'snoozed',
      snoozedUntil: state.snoozedUntil,
      reminderPath,
      state,
    };
  }

  return {
    shouldRemind: true,
    reason: 'active',
    reminderPath,
    state,
  };
}

function readJsonIfExists(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch {
    // Ignore invalid local state; the next write will repair it.
  }
  return fallback;
}

function sanitizeLoginDetails(details = {}) {
  return {
    mode: truncateValue(details.mode || details.loginMode || '', 80),
    reason: truncateValue(details.reason || details.status || '', 160),
    command: truncateValue(details.command || 'login', 160),
    activeTool: truncateValue(details.activeTool || inferToolName(), 80),
  };
}

function recordLoginEvent(status, details = {}, options = {}) {
  const eventsPath = getLoginEventsPath(options.configPath);
  fs.mkdirSync(path.dirname(eventsPath), { recursive: true });

  const now = Date.now();
  const state = readJsonIfExists(eventsPath, { events: [] });
  const events = Array.isArray(state.events) ? state.events : [];
  const recentEvents = events.filter((event) => {
    return event && event.timeMs && now - event.timeMs <= LOGIN_LOOP_WINDOW_MS;
  });

  recentEvents.push({
    status: String(status || 'unknown'),
    timeMs: now,
    at: new Date(now).toISOString(),
    details: sanitizeLoginDetails(details),
  });

  const nextState = {
    schemaVersion: 1,
    updatedAt: new Date(now).toISOString(),
    events: recentEvents.slice(-30),
  };
  writeJson(eventsPath, nextState);
  return getLoginLoopStatus(options.configPath);
}

function getLoginLoopStatus(configPath) {
  const eventsPath = getLoginEventsPath(configPath);
  const state = readJsonIfExists(eventsPath, { events: [] });
  const now = Date.now();
  const events = (Array.isArray(state.events) ? state.events : []).filter((event) => {
    return event && event.timeMs && now - event.timeMs <= LOGIN_LOOP_WINDOW_MS;
  });
  const noisyEvents = events.filter((event) => {
    return ['trigger', 'failed', 'need_login', 'need_qr_scan', 'need_browser_login'].includes(event.status);
  });
  const reminder = getReminderStatus(configPath);

  return {
    detected: noisyEvents.length >= LOGIN_LOOP_THRESHOLD,
    shouldSuggestFeedback: noisyEvents.length >= LOGIN_LOOP_THRESHOLD && reminder.shouldRemind,
    count: noisyEvents.length,
    threshold: LOGIN_LOOP_THRESHOLD,
    windowMinutes: Math.round(LOGIN_LOOP_WINDOW_MS / 60000),
    eventsPath,
    reminder,
    lastEvent: events[events.length - 1] || null,
  };
}

function buildLoginLoopDiagnostics(status) {
  return JSON.stringify({
    signal: 'login_loop',
    count: status.count,
    threshold: status.threshold,
    windowMinutes: status.windowMinutes,
    lastStatus: status.lastEvent && status.lastEvent.status,
    lastReason: status.lastEvent && status.lastEvent.details && status.lastEvent.details.reason,
    tool: inferToolName(),
    version: packageVersion(),
  });
}

function buildLoginLoopFeedbackHint(status, options = {}) {
  if (!status || !status.shouldSuggestFeedback) {
    return null;
  }
  let feedbackUrl = '';
  try {
    const config = readFeedbackConfig(options.configPath);
    feedbackUrl = buildFeedbackUrl(config, {
      command: 'openyida login',
      reason: 'login_loop',
      diagnostics: buildLoginLoopDiagnostics(status),
    }).url;
  } catch {
    // Feedback form may not be configured yet. The dismiss command is still useful.
  }

  return {
    reason: 'login_loop',
    message: `检测到最近 ${status.windowMinutes} 分钟内已多次触发登录。`,
    feedbackUrl,
    dismissTodayCommand: 'openyida feedback dismiss --today',
    dismissForeverCommand: 'openyida feedback dismiss --forever',
  };
}

function printLoginLoopFeedbackHint(status, options = {}) {
  const suggestion = buildLoginLoopFeedbackHint(status, options);
  if (!suggestion) {
    return;
  }

  process.stderr.write(`\n  ${suggestion.message}\n`);
  if (suggestion.feedbackUrl) {
    process.stderr.write(`  反馈链接: ${suggestion.feedbackUrl}\n`);
  } else {
    process.stderr.write(`  ${t('feedback_report.login_hint')}\n`);
  }
  process.stderr.write(`  今天不再提醒: ${suggestion.dismissTodayCommand}\n`);
}

function runDismiss(options) {
  const reminderPath = getReminderPath(options.configPath);
  fs.mkdirSync(path.dirname(reminderPath), { recursive: true });

  if (options.reset) {
    if (fs.existsSync(reminderPath)) {
      fs.unlinkSync(reminderPath);
    }
    console.log(JSON.stringify({ success: true, shouldRemind: true, reminderPath }, null, 2));
    return;
  }

  if (!options.today && !options.forever) {
    throw new Error('请指定 --today、--forever 或 --reset');
  }

  const state = options.forever
    ? {
      disabled: true,
      reason: 'forever',
      updatedAt: new Date().toISOString(),
    }
    : {
      disabled: false,
      reason: 'today',
      snoozedUntil: endOfToday().toISOString(),
      updatedAt: new Date().toISOString(),
    };

  writeJson(reminderPath, state);
  console.log(JSON.stringify({ success: true, reminderPath, state, status: getReminderStatus(options.configPath) }, null, 2));
}

function runStatus(options) {
  console.log(JSON.stringify(getReminderStatus(options.configPath), null, 2));
}

async function run(args = []) {
  // Let the central CLI error handler own new report errors and exit codes.
  if (args[0] === 'report') {
    const { parseReportArgs, writeReport } = require('./report');
    console.log(JSON.stringify(writeReport(parseReportArgs(args.slice(1))), null, 2));
    return;
  }
  let parsed;
  try {
    parsed = parseArgs(args);
  } catch (error) {
    fail(error.message);
    printUsage();
    process.exit(1);
  }

  if (parsed.command === 'help') {
    printUsage();
    return;
  }

  try {
    if (parsed.command === 'setup') {
      await runSetup(parsed.options);
      return;
    }
    if (parsed.command === 'url') {
      runUrl(parsed.options);
      return;
    }
    if (parsed.command === 'dismiss') {
      runDismiss(parsed.options);
      return;
    }
    if (parsed.command === 'status' || parsed.command === 'should-remind') {
      runStatus(parsed.options);
      return;
    }
  } catch (error) {
    fail(error.message);
    process.exit(1);
  }
}

module.exports = {
  FIELD_LABELS,
  METADATA_PARAM_MAP,
  buildAutofillActionSource,
  buildFeedbackFields,
  buildFeedbackUrl,
  collectFieldMap,
  encodeMetadata,
  buildLoginLoopFeedbackHint,
  getReminderStatus,
  getLoginLoopStatus,
  parseArgs,
  parseJsonOutput,
  printLoginLoopFeedbackHint,
  readFeedbackConfig,
  recordLoginEvent,
  sanitizeMetadata,
  run,
};
