'use strict';

const { AsyncLocalStorage } = require('async_hooks');
const { randomUUID } = require('crypto');

const commandContext = new AsyncLocalStorage();
const EMPTY_HEADERS = Object.freeze({});

function runWithCommandContext(run) {
  const startedAtMs = Date.now();
  const { resolveBuilderAiSource } = require('../app/builder-ai-source');
  const headers = Object.freeze({
    'X-OpenYida-Agent-Source': resolveBuilderAiSource(),
    'X-OpenYida-Command-Id': randomUUID(),
    'X-OpenYida-Command-Started-At-Ms': String(startedAtMs),
  });
  return commandContext.run(headers, run);
}

function getCommandContextHeaders(url) {
  const headers = commandContext.getStore();
  if (!headers || url.protocol !== 'https:' || url.port) { return EMPTY_HEADERS; }

  const { isYidaServiceHost } = require('./env-manager');
  return isYidaServiceHost(url.hostname) ? headers : EMPTY_HEADERS;
}

module.exports = { runWithCommandContext, getCommandContextHeaders };
