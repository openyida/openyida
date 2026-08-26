'use strict';

const fs = require('fs');
const Module = require('module');

const originalLoad = Module._load;
const counterFile = process.env.OPENYIDA_CREATE_AUTH_COUNTER_FILE;
let preflightCalls = 0;

function updateCounter(kind, requestPath) {
  if (!counterFile) {
    return;
  }
  let counter = { get: 0, post: 0, paths: [] };
  try {
    counter = JSON.parse(fs.readFileSync(counterFile, 'utf8'));
  } catch {
    // The first request creates the counter file.
  }
  counter[kind] = (counter[kind] || 0) + 1;
  counter.paths = Array.isArray(counter.paths) ? counter.paths : [];
  counter.paths.push({ method: kind.toUpperCase(), path: requestPath });
  fs.writeFileSync(counterFile, JSON.stringify(counter));
}

function isCreateCommandParent(parent) {
  return !!(
    parent
    && typeof parent.filename === 'string'
    && /[/\\]lib[/\\]app[/\\]create-(form|page)\.js$/.test(parent.filename)
  );
}

Module._load = function patchedLoad(request, parent, isMain) {
  const loaded = originalLoad.call(this, request, parent, isMain);
  if (
    parent
    && /[/\\]lib[/\\]core[/\\]utils\.js$/.test(parent.filename || '')
    && request === '../auth/token-auth'
  ) {
    return {
      ...loaded,
      async tokenRefresh() {
        return {
          ok: true,
          access_token: 'x',
          base_url: 'https://example.invalid',
          corp_id: 'c',
        };
      },
      isRefreshAuthRequired() {
        return false;
      },
    };
  }
  if (!isCreateCommandParent(parent)) {
    return loaded;
  }

  if (request === '../core/yida-client') {
    return {
      ...loaded,
      createAuthRef() {
        return {
          baseUrl: 'https://example.invalid',
          csrfToken: 'test-csrf',
          authData: { corp_id: 'c' },
        };
      },
    };
  }

  if (request === '../core/utils') {
    return {
      ...loaded,
      async httpGet(baseUrl, requestPath) {
        preflightCalls += 1;
        updateCounter('get', requestPath);
        if (preflightCalls === 1) {
          return { __needLogin: true };
        }
        return { success: true, content: [] };
      },
      async httpPost(baseUrl, requestPath) {
        updateCounter('post', requestPath);
        return { __needLogin: true };
      },
    };
  }

  return loaded;
};
