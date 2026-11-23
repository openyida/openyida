'use strict';

const fs = require('fs');
const path = require('path');
const { findProjectRoot, detectActiveTool } = require('../core/utils');
const { CliError } = require('../core/cli-error');
const { fail } = require('../core/chalk');
const { t } = require('../core/i18n');

const REMINDER_FILE_NAME = 'reminder.json';
const LOGIN_EVENTS_FILE_NAME = 'login-events.json';
const LOGIN_LOOP_WINDOW_MS = 30 * 60 * 1000;
const LOGIN_LOOP_THRESHOLD = 3;
const LEGACY_URL_OPTIONS = new Set([
  '--config', '--tool', '--model', '--command', '--session-id', '--session',
  '--version', '--reason', '--diagnostics', '--diag', '--meta-json',
]);

function printUsage() {
  process.stderr.write(`
用法:
  openyida feedback report --input <summary.json> --output-dir <new-directory>
  openyida feedback github setup [--install --confirm] [--json]
  openyida feedback github <status|star|fork> [--confirm] [--json]
  openyida feedback url [--json]
  openyida feedback submit
  ${t('feedback_intake.usage')}
  openyida feedback dismiss --today|--forever|--reset
  openyida feedback status

说明:
  ${t('feedback_report.help')}
  ${t('feedback_intake.help')}
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

function getReminderPath(configPath) {
  return path.join(getFeedbackCacheDir(configPath), REMINDER_FILE_NAME);
}

function getLoginEventsPath(configPath) {
  return path.join(getFeedbackCacheDir(configPath), LOGIN_EVENTS_FILE_NAME);
}

function parseUrlArgs(args) {
  let json = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--json') {
      json = true;
    } else if (LEGACY_URL_OPTIONS.has(arg)) {
      // Older callers may pass prefill data. Ignore it instead of putting it in a URL.
      readOptionValue(args, index, arg);
      index++;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return { json };
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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function inferToolName() {
  const active = detectActiveTool();
  return active ? active.displayName || active.tool || '' : '';
}

function truncateValue(value, maxLength) {
  if (value === undefined || value === null) {
    return '';
  }
  const text = String(value);
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
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

function buildLoginLoopFeedbackHint(status) {
  if (!status || !status.shouldSuggestFeedback) {
    return null;
  }

  return {
    reason: 'login_loop',
    message: `检测到最近 ${status.windowMinutes} 分钟内已多次触发登录。`,
    dismissTodayCommand: 'openyida feedback dismiss --today',
    dismissForeverCommand: 'openyida feedback dismiss --forever',
  };
}

function printLoginLoopFeedbackHint(status) {
  const suggestion = buildLoginLoopFeedbackHint(status);
  if (!suggestion) {
    return;
  }

  process.stderr.write(`\n  ${suggestion.message}\n`);
  process.stderr.write(`  ${t('feedback_report.login_hint')}\n`);
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
  if (args[0] === 'setup') {
    throw new CliError(t('feedback_intake.setup_retired'), { code: 'FEEDBACK_SETUP_RETIRED' });
  }
  if (args[0] === 'submit') {
    await require('./intake').runSubmit(args.slice(1));
    return;
  }
  if (args[0] === 'url') {
    require('./intake').runUrl(parseUrlArgs(args.slice(1)));
    return;
  }
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
  buildLoginLoopFeedbackHint,
  getReminderStatus,
  getLoginLoopStatus,
  parseArgs,
  printLoginLoopFeedbackHint,
  recordLoginEvent,
  run,
};
