'use strict';

const { AsyncLocalStorage } = require('async_hooks');
const { randomUUID } = require('crypto');

const commandContext = new AsyncLocalStorage();
const EMPTY_HEADERS = Object.freeze({});

async function trackCommand(command, run) {
  const { allowedCommand, appendCommandLog } = require('../feedback/command-log');
  if (!allowedCommand(command) || process.env.OPENYIDA_MANAGED_RUN === '1') {return run();}
  const diagnostic = { commandExecutionId: randomUUID(), startedAt: Date.now() };
  let cwd;
  try {cwd = process.cwd();} catch {return run();}
  let finished = false;
  function finish(exitCode, error) {
    if (finished) {return;}
    finished = true;
    const now = Date.now();
    appendCommandLog({
      command, commandExecutionId: diagnostic.commandExecutionId, timestamp: new Date(now).toISOString(),
      durationMs: Math.max(0, now - diagnostic.startedAt), exitCode,
      nativeErrorObserved: Boolean(diagnostic.failure),
      traceId: diagnostic.failure ? diagnostic.failure.traceId : diagnostic.traceId,
      errorCode: diagnostic.failure?.errorCode || error?.cause?.code || error?.code,
      errorType: diagnostic.failure?.errorType || error?.cause?.name || error?.name,
    }, { cwd });
  }
  process.once('exit', finish); // Some older commands call process.exit() directly.
  return commandContext.run({ diagnostic }, async () => {
    try {
      const result = await run();
      finish(Number(process.exitCode) || 0);
      return result;
    } catch (error) {
      finish(Number(error?.exitCode) || 1, error);
      throw error;
    } finally {process.removeListener('exit', finish);}
  });
}

function runWithCommandContext(run) {
  const diagnostic = commandContext.getStore()?.diagnostic;
  const { resolveBuilderAiSource } = require('../app/builder-ai-source');
  const headers = Object.freeze({
    'X-OpenYida-Agent-Source': resolveBuilderAiSource(),
    'X-OpenYida-Command-Id': diagnostic?.commandExecutionId || randomUUID(),
    'X-OpenYida-Command-Started-At-Ms': String(diagnostic?.startedAt || Date.now()),
  });
  return commandContext.run({ headers, diagnostic }, run);
}

function getCommandContextHeaders(url) {
  const headers = commandContext.getStore()?.headers;
  if (!headers || url.protocol !== 'https:' || url.port) { return EMPTY_HEADERS; }

  const { isYidaServiceHost } = require('./env-manager');
  return isYidaServiceHost(url.hostname) ? headers : EMPTY_HEADERS;
}

function exceptionType(value) {
  const raw = typeof value === 'string' ? value : value?.exceptionClass || value?.className || value?.name;
  if (typeof raw !== 'string') {return undefined;}
  // Match a class at the very start of the native throwable. Discard all
  // following text (exception message, stack frames and customer input).
  return /^(?:Caused by:\s*)?((?:[\w$]+\.)*(?:[A-Z][\w$]*)?(?:Exception|Error|Throwable))(?=[:\s]|$)/.exec(raw.slice(0, 192))?.[1];
}

function observeCommandResponse(url, traceHeader, status, payload) {
  const diagnostic = commandContext.getStore()?.diagnostic;
  if (!diagnostic) {return;}
  const failure = payload?.success === false || status >= 400;
  if ((!failure && !traceHeader) || getCommandContextHeaders(url) === EMPTY_HEADERS) {return;}
  const traceId = traceHeader || (failure && payload?.traceId);
  if (typeof traceId === 'string' && /^[0-9a-f]{16,64}$/i.test(traceId)) {diagnostic.traceId = traceId;}
  if (failure) {
    // Only the native failure envelope, never message, throwable, body or URL.
    const code = payload?.errorCode ?? payload?.errCode;
    diagnostic.failure = {
      traceId: typeof traceId === 'string' ? traceId : undefined,
      errorCode: typeof code === 'string' || typeof code === 'number' ? String(code) : undefined,
      errorType: exceptionType(payload?.exceptionClass) || exceptionType(payload?.throwable),
    };
  }
}

function observeCommandNetworkError(url, error) {
  const native = error?.cause || error;
  observeCommandResponse(url, undefined, 0, { success: false, errorCode: native?.code, exceptionClass: native?.name });
}

module.exports = { trackCommand, runWithCommandContext, getCommandContextHeaders, observeCommandResponse, observeCommandNetworkError };
