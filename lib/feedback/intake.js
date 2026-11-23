'use strict';

const { randomUUID } = require('node:crypto');
const { createInterface } = require('node:readline/promises');
const {
  containsCredential, environmentSummary, validateEnvironment, readRegularFile, selectedAttachments, prepareRequest,
} = require('./intake-evidence');
const { loadTokenSession } = require('../auth/token-store');
const { CliError } = require('../core/cli-error');
const { resolveBaseUrl } = require('../core/utils');
const { t } = require('../core/i18n');

const ENTRY_PATH = '/openyida/feedback';
const SUBMIT_PATH = '/openyida/feedback/submit.json';
const MAX_BODY_BYTES = 16 * 1024;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const FEEDBACK_ID = /^OYF-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const TEXT_LIMITS = {
  title: 120, description: 2000, expected: 2000, reproduction: 2000,
  host: 128, channel: 128, commandExecutionId: 128, traceId: 128, errorCode: 128,
};
const CHOICES = {
  type: ['slow', 'error', 'unexpected_result', 'hard_to_use', 'suggestion'],
  domain: ['auth', 'app', 'page', 'data', 'workflow', 'cli', 'other'],
  impact: ['blocked', 'workaround', 'minor', 'unknown'],
};
const INPUT_FIELDS = new Set([...Object.keys(TEXT_LIMITS), ...Object.keys(CHOICES), 'diagnosticRef', 'occurredAt', 'environment']);
const DIGEST = /^[a-f0-9]{64}$/;
const ABSOLUTE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const ERRORS = {
  invalid_request: 'FEEDBACK_INPUT_INVALID',
  unauthenticated: 'FEEDBACK_AUTH_REQUIRED',
  feedback_blocked: 'FEEDBACK_BLOCKED',
  feedback_not_enabled: 'FEEDBACK_NOT_ENABLED',
  idempotency_conflict: 'FEEDBACK_IDEMPOTENCY_CONFLICT',
  request_too_large: 'FEEDBACK_INPUT_TOO_LARGE',
  rate_limited: 'FEEDBACK_RATE_LIMITED',
  feedback_unavailable: 'FEEDBACK_UNAVAILABLE',
  invalid_attachment: 'FEEDBACK_ATTACHMENT_INVALID',
  feedback_attachments_unavailable: 'FEEDBACK_ATTACHMENTS_UNAVAILABLE',
};

function intakeError(code, key, requestId, details) {
  return new CliError(t(`feedback_intake.${key}`, requestId || ''), {
    code,
    details: requestId ? { requestId, ...details } : undefined,
  });
}

function parseSubmitArgs(args) {
  const options = { screenshot: [], log: [] };
  const flags = { '--json': 'json', '--confirm': 'confirm', '--preview': 'preview', '--include-environment': 'includeEnvironment' };
  const valueOptions = { '--input': 'input', '--request-id': 'requestId', '--review-digest': 'reviewDigest' };
  const usage = () => intakeError('FEEDBACK_USAGE', 'usage');
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (Object.hasOwn(flags, arg)) {
      options[flags[arg]] = true;
    } else if (Object.hasOwn(valueOptions, arg) || arg === '--screenshot' || arg === '--log') {
      const value = args[++index];
      if (!value || value.startsWith('--')) {
        throw usage();
      }
      if (arg === '--screenshot' || arg === '--log') {
        options[arg.slice(2)].push(value);
      } else {
        const key = valueOptions[arg];
        if (options[key]) {
          throw usage();
        }
        options[key] = value;
      }
    } else {
      throw usage();
    }
  }
  if ((options.requestId && (options.requestId.length !== 36 || !UUID.test(options.requestId))) ||
      (options.reviewDigest && (options.reviewDigest.length !== 64 || !DIGEST.test(options.reviewDigest)))) {
    throw usage();
  }
  if (!options.input) {
    if (!process.stdin.isTTY || !process.stderr.isTTY || options.json || options.confirm || options.preview ||
        options.reviewDigest || options.includeEnvironment || options.screenshot.length || options.log.length) {
      throw usage();
    }
    options.interactive = true;
  } else if (!options.requestId || options.preview && (options.confirm || options.reviewDigest)) {
    throw usage();
  } else if (!options.preview && !options.confirm) {
    throw intakeError('FEEDBACK_CONFIRMATION_REQUIRED', 'confirmation_required');
  }
  options.requestId = options.requestId ? options.requestId.toLowerCase() : randomUUID();
  return options;
}

function readFeedbackBody(input) {
  try {
    const bytes = readRegularFile(input, MAX_BODY_BYTES);
    if (!bytes) {
      throw intakeError('FEEDBACK_INPUT_TOO_LARGE', 'request_too_large');
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    // A parser or file error can contain excerpts of the user's feedback.
    throw intakeError('FEEDBACK_INPUT_INVALID', 'invalid_request');
  }
}

function validateFeedback(data, options) {
  const invalid = () => intakeError('FEEDBACK_INPUT_INVALID', 'invalid_request');
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.description !== 'string' || !data.description.trim() || !CHOICES.type.includes(data.type)) {
    throw invalid();
  }
  const validated = {};
  for (const [key, value] of Object.entries(data)) {
    if (!INPUT_FIELDS.has(key)) {
      throw invalid();
    }
    if (key === 'environment') {
      if (!validateEnvironment(value) || options.includeEnvironment) {
        throw invalid();
      }
      validated[key] = value;
      continue;
    }
    if (typeof value !== 'string') {
      throw invalid();
    }
    if ((Object.hasOwn(CHOICES, key) && !CHOICES[key].includes(value)) ||
        (key === 'diagnosticRef' && (value.length !== 36 || !UUID.test(value))) ||
        (key === 'occurredAt' && (!ABSOLUTE_TIME.test(value) || !Number.isFinite(Date.parse(value))))) {
      throw invalid();
    }
    if (Object.hasOwn(TEXT_LIMITS, key)) {
      if (Array.from(value.trim()).length > TEXT_LIMITS[key] || /[\ud800-\udfff]/u.test(value)) {
        throw invalid();
      }
      if (containsCredential(value)) {
        throw intakeError('FEEDBACK_ATTACHMENT_SENSITIVE', 'attachment_sensitive');
      }
    }
    validated[key] = value;
  }
  if (options.includeEnvironment) {
    validated.environment = environmentSummary();
  }
  if (Buffer.byteLength(JSON.stringify(validated)) > MAX_BODY_BYTES) {
    throw intakeError('FEEDBACK_INPUT_TOO_LARGE', 'request_too_large');
  }
  return validated;
}

function displayReview(manifest, output) {
  output.write(t('feedback_intake.review_heading', manifest.destination) + '\n');
  for (const [field, value] of Object.entries(manifest.feedback)) {
    const display = CHOICES[field] ? t('feedback_intake.labels.' + value) : value;
    output.write(t('feedback_intake.fields.' + field) + ': ' + JSON.stringify(display).replace(/[\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, '?') + '\n');
  }
  if (!manifest.attachments.length) {
    output.write(t('feedback_intake.no_attachments') + '\n');
  }
  for (const { kind, file, bytes } of manifest.attachments) {
    output.write(t('feedback_intake.attachment_row', t('feedback_intake.fields.' + kind), file, bytes) + '\n');
  }
  if (!manifest.feedback.environment) {
    output.write(t('feedback_intake.no_environment') + '\n');
  }
  output.write(t('feedback_intake.review_warning') + '\n');
}

async function choose(question, field, optional = false) {
  const entries = CHOICES[field];
  for (;;) {
    const choices = entries.map((key, index) => (index + 1) + '. ' + t('feedback_intake.labels.' + key));
    const answer = await question(t('feedback_intake.fields.' + field) + ' (' + choices.join('  ') + ')' +
      (optional ? ' ' + t('feedback_intake.optional') : '') + ': ');
    if (!answer && optional) {
      return undefined;
    }
    if (/^[1-9]$/.test(answer) && entries[Number(answer) - 1]) {
      return entries[Number(answer) - 1];
    }
    process.stderr.write(t('feedback_intake.choose_number') + '\n');
  }
}

async function runInteractive(options, session, url, destination) {
  const output = process.stderr;
  const reader = createInterface({ input: process.stdin, output });
  const controller = new AbortController();
  const abort = () => controller.abort();
  reader.on('SIGINT', abort);
  reader.on('close', abort);
  const question = async prompt => (await reader.question(prompt, { signal: controller.signal })).trim();
  try {
    output.write(t('feedback_intake.wizard_intro') + '\n');
    const data = { type: await choose(question, 'type') };
    for (const field of ['title', 'description', 'expected', 'reproduction', 'occurredAt', 'diagnosticRef']) {
      const answer = await question(t('feedback_intake.fields.' + field) +
        (field === 'description' ? '' : ' ' + t('feedback_intake.optional')) + ': ');
      if (answer) {
        data[field] = answer;
      }
    }
    for (const kind of ['screenshot', 'log']) {
      for (let index = 0; index < (kind === 'screenshot' ? 3 : 1); index++) {
        const answer = await question(t('feedback_intake.select_file', t('feedback_intake.fields.' + kind), index + 1) + ': ');
        if (!answer) {
          break;
        }
        options[kind].push(answer.replace(/^(?:"(.*)"|'(.*)')$/, (_, double, single) => double ?? single));
      }
    }
    options.includeEnvironment = /^y(?:es)?$/i.test(await question(t('feedback_intake.include_environment') + ' [y/N] '));
    const payload = validateFeedback(data, options);
    const request = prepareRequest(payload, selectedAttachments(options), options.requestId, destination);
    displayReview(request.manifest, output);
    if (!/^y(?:es)?$/i.test(await question(t('feedback_intake.confirm_wizard') + ' [y/N] '))) {
      output.write(t('feedback_intake.canceled') + '\n');
      return;
    }
    if (request.manifest.attachments.length &&
        prepareRequest(payload, selectedAttachments(options), options.requestId, destination).manifest.reviewDigest !== request.manifest.reviewDigest) {
      throw intakeError('FEEDBACK_REVIEW_REQUIRED', 'review_changed', options.requestId);
    }
    await sendRequest(options, session, url, request);
  } catch (error) {
    if (error.name === 'AbortError') {
      output.write(t('feedback_intake.canceled') + '\n');
      return;
    }
    throw error;
  } finally {
    reader.close();
  }
}

function feedbackUrl(path, baseUrl) {
  let origin;
  try {
    origin = new URL(baseUrl);
  } catch {
    throw intakeError('FEEDBACK_ENDPOINT_INVALID', 'endpoint_invalid');
  }
  if (origin.protocol !== 'https:' || origin.username || origin.password ||
      origin.pathname !== '/' || origin.search || origin.hash) {
    throw intakeError('FEEDBACK_ENDPOINT_INVALID', 'endpoint_invalid');
  }
  return new URL(path, origin).href;
}

function runUrl({ json }) {
  const session = loadTokenSession();
  const url = feedbackUrl(ENTRY_PATH, session?.base_url || resolveBaseUrl());
  console.log(json ? JSON.stringify({ success: true, url }, null, 2) : url);
}

async function runSubmit(args) {
  const options = parseSubmitArgs(args);
  const { requestId, preview, json } = options;
  // Read the token and its business origin together so a concurrent profile
  // switch cannot send a credential to a different origin.
  const session = loadTokenSession();
  if (!preview && (!session?.access_token || !session.base_url)) {
    throw intakeError('FEEDBACK_AUTH_REQUIRED', 'unauthenticated', requestId);
  }
  const url = feedbackUrl(SUBMIT_PATH, session?.base_url || resolveBaseUrl());
  const destination = { origin: new URL(url).origin, corp: session?.corp_id, user: session?.user_id };
  if (options.interactive) {
    await runInteractive(options, session, url, destination);
    return;
  }
  const data = validateFeedback(readFeedbackBody(options.input), options);
  const attachments = selectedAttachments(options);
  const request = prepareRequest(data, attachments, requestId, destination);
  if (preview) {
    if (json) {
      console.log(JSON.stringify({ success: true, submissionPerformed: false, ...request.manifest }, null, 2));
    } else {
      displayReview(request.manifest, process.stdout);
      console.log(t('feedback_intake.review_digest', request.manifest.reviewDigest));
    }
    return;
  }
  if ((attachments.length || data.environment || options.reviewDigest) && options.reviewDigest !== request.manifest.reviewDigest) {
    throw intakeError('FEEDBACK_REVIEW_REQUIRED', 'review_required', requestId);
  }
  await sendRequest(options, session, url, request);
}

async function sendRequest({ requestId, json }, session, url, request) {
  let response;
  let payload;
  try {
    response = await globalThis.fetch(url, {
      method: 'POST',
      redirect: 'error',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': request.contentType,
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Idempotency-Key': requestId,
      },
      body: request.body,
      signal: globalThis.AbortSignal.timeout(30000),
    });
    payload = await response.json().catch(() => null);
  } catch {
    throw intakeError('FEEDBACK_OUTCOME_UNKNOWN', 'outcome_unknown', requestId, { status: 'unknown' });
  }

  if ([200, 201].includes(response.status) && payload?.status === 'submitted' &&
      typeof payload.feedbackId === 'string' && payload.feedbackId.length === 40 && FEEDBACK_ID.test(payload.feedbackId)) {
    console.log(json
      ? JSON.stringify({ success: true, status: 'submitted', feedbackId: payload.feedbackId, requestId }, null, 2)
      : t('feedback_intake.submitted', payload.feedbackId));
    return;
  }
  if (response.status === 202 && payload?.status === 'pending') {
    throw intakeError('FEEDBACK_PENDING', 'pending', requestId, { status: 'pending' });
  }
  if (response.status === 413 && request.manifest.attachments.length) {
    throw intakeError('FEEDBACK_ATTACHMENT_TOO_LARGE', 'attachment_limit', requestId);
  }
  if (response.status === 401) {
    throw intakeError('FEEDBACK_AUTH_REQUIRED', 'unauthenticated', requestId);
  }
  if (response.status === 403 && payload?.code === 'feedback_credential_not_allowed') {
    throw intakeError('FEEDBACK_CREDENTIAL_NOT_ALLOWED', 'unauthenticated', requestId);
  }
  const errorCode = payload?.code;
  if (response.status >= 400 && typeof errorCode === 'string' &&
      Object.prototype.hasOwnProperty.call(ERRORS, errorCode)) {
    throw intakeError(ERRORS[errorCode], errorCode, requestId);
  }
  throw intakeError('FEEDBACK_OUTCOME_UNKNOWN', 'outcome_unknown', requestId, { status: 'unknown' });
}

module.exports = { runUrl, runSubmit };
