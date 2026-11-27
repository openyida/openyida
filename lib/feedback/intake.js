'use strict';

const {
  containsCredential, environmentSummary, validateEnvironment, readRegularFile, selectedAttachments, prepareRequest,
} = require('./intake-evidence');
const { isAccessTokenUsable, isEnvTokenAuthMode, loadTokenSession } = require('../auth/token-store');
const { CliError } = require('../core/cli-error');
const { resolveBaseUrl } = require('../core/utils');
const { t } = require('../core/i18n');

const SUBMIT_USAGE = 'openyida feedback submit --input <file> --request-id <UUID> [--screenshot <file>] [--log <file>] [--include-environment] --preview|--confirm [--review-digest <digest>] [--json]';
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
  feedback_request_conflict: 'FEEDBACK_IDEMPOTENCY_CONFLICT',
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
  const usage = () => new CliError(SUBMIT_USAGE, { code: 'FEEDBACK_USAGE' });
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
  if (!options.input || !options.requestId || (options.preview && (options.confirm || options.reviewDigest))) {
    throw usage();
  }
  if (!options.preview && !options.confirm) {
    throw intakeError('FEEDBACK_CONFIRMATION_REQUIRED', 'confirmation_required');
  }
  options.requestId = options.requestId.toLowerCase();
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
  const environmentAliases = {};
  for (const [key, value] of Object.entries(data)) {
    if (!INPUT_FIELDS.has(key)) {
      throw invalid();
    }
    if (value === null && ['environment', 'host', 'channel'].includes(key)) {
      continue;
    }
    if (key === 'environment') {
      if (!validateEnvironment(value) || options.includeEnvironment) {
        throw invalid();
      }
      validated.environment = Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null));
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
    if (['host', 'channel', 'commandExecutionId', 'traceId', 'errorCode'].includes(key) && value.length > 128) {
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
    if (key === 'host' || key === 'channel') {
      environmentAliases[key === 'channel' ? 'releaseChannel' : 'host'] = value;
    } else {
      validated[key] = value;
    }
  }
  if (options.includeEnvironment) {
    validated.environment = environmentSummary();
  }
  for (const [key, value] of Object.entries(environmentAliases)) {
    const environment = validated.environment || (validated.environment = {});
    if (Object.hasOwn(environment, key) && environment[key] !== value) {
      throw invalid();
    }
    environment[key] = value;
  }
  if (validated.environment && !Object.keys(validated.environment).length) {
    delete validated.environment;
  }
  if (Buffer.byteLength(JSON.stringify(validated)) > MAX_BODY_BYTES) {
    throw intakeError('FEEDBACK_INPUT_TOO_LARGE', 'request_too_large');
  }
  return validated;
}

function feedbackUrl(path, baseUrl) {
  try {
    const url = new URL(baseUrl);
    if (url.protocol === 'https:' && !url.username && !url.password &&
        url.pathname === '/' && !url.search && !url.hash) {
      return new URL(path, url).href;
    }
  } catch { /* Invalid URL. */ }
  throw intakeError('FEEDBACK_ENDPOINT_INVALID', 'endpoint_invalid');
}

function runUrl({ json }) {
  const session = loadTokenSession();
  const url = isAccessTokenUsable(session, 0)
    ? feedbackUrl(ENTRY_PATH, session.base_url || resolveBaseUrl())
    : 'https://xmtrf1.aliwork.com/o/openyida-login-75bacb3e';
  console.log(json ? JSON.stringify({ success: true, url }, null, 2) : url);
}

async function runSubmit(args) {
  const options = parseSubmitArgs(args);
  const { requestId, preview } = options;
  const session = loadTokenSession();
  const hostSession = isEnvTokenAuthMode() || session?.auth_store === 'env';
  if (!preview && (!session?.access_token || (!hostSession && !session.base_url))) {
    throw intakeError('FEEDBACK_AUTH_REQUIRED', 'unauthenticated', requestId);
  }
  const baseUrl = hostSession ? process.env.OPENYIDA_ENDPOINT : session?.base_url || resolveBaseUrl();
  const url = feedbackUrl(SUBMIT_PATH, baseUrl);
  // Legacy project token files, unlike sandbox token files, are not keyed by endpoint.
  if (hostSession && session?.auth_store === 'project_cache' && feedbackUrl(SUBMIT_PATH, session.base_url) !== url) {
    throw intakeError('FEEDBACK_ENDPOINT_INVALID', 'endpoint_invalid', requestId);
  }
  const destination = { origin: new URL(url).origin, corp: session?.corp_id, user: session?.user_id };
  const data = validateFeedback(readFeedbackBody(options.input), options);
  const attachments = selectedAttachments(options);
  const request = prepareRequest(data, attachments, requestId, destination);
  if (preview) {
    console.log(JSON.stringify({ success: true, submissionPerformed: false, ...request.manifest }, null, 2));
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
        Referer: new URL(ENTRY_PATH, url).href,
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
    const feedbackId = typeof payload.feedbackId === 'string' && payload.feedbackId.length === 40 && FEEDBACK_ID.test(payload.feedbackId)
      ? payload.feedbackId : undefined;
    throw intakeError('FEEDBACK_PENDING', 'pending', requestId, { status: 'pending', ...(feedbackId && { feedbackId }) });
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
    throw intakeError(ERRORS[errorCode], errorCode === 'feedback_request_conflict' ? 'idempotency_conflict' : errorCode, requestId);
  }
  throw intakeError('FEEDBACK_OUTCOME_UNKNOWN', 'outcome_unknown', requestId, { status: 'unknown' });
}

module.exports = { SUBMIT_USAGE, runUrl, runSubmit };
