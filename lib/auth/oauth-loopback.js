'use strict';

const crypto = require('crypto');
const http = require('http');
const { spawn } = require('child_process');

const CALLBACK_PATH = '/oauth/callback';
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function openBrowser(url) {
  if (process.env.OPENYIDA_NO_BROWSER === '1') {
    return false;
  }

  let command = 'xdg-open';
  let args = [url];
  if (process.platform === 'darwin') {
    command = 'open';
  } else if (process.platform === 'win32') {
    command = 'cmd';
    args = ['/c', 'start', '', url];
  }

  try {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

function buildDingtalkOAuthUrl(options) {
  const {
    clientId,
    redirectUri,
    state,
    loginOrigin = 'https://login.dingtalk.com',
    scope = 'openid',
    prompt = 'consent',
  } = options;

  const url = new URL('/oauth2/auth', loginOrigin);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', scope);
  url.searchParams.set('state', state);
  if (prompt) {
    url.searchParams.set('prompt', prompt);
  }
  return url.toString();
}

function responseHtml(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><h3>${title}</h3><p>${body}</p></body></html>`;
}

function runDingtalkLoopback(options = {}) {
  return new Promise((resolve, reject) => {
    const state = options.state || randomToken();
    const timeoutMs = Number(options.timeoutMs || process.env.OPENYIDA_OAUTH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
    let settled = false;
    let timer;

    const finish = (err, value) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (server) {
        server.close(() => {});
      }
      if (err) {
        reject(err);
      } else {
        resolve(value);
      }
    };

    const server = http.createServer((req, res) => {
      const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
      if (requestUrl.pathname !== CALLBACK_PATH) {
        res.statusCode = 404;
        res.end('not found');
        return;
      }

      const receivedState = requestUrl.searchParams.get('state');
      if (!receivedState || receivedState !== state) {
        res.statusCode = 400;
        res.setHeader('content-type', 'text/html; charset=utf-8');
        res.end(responseHtml('OpenYida login failed', 'Invalid OAuth state. Please close this page and retry.'));
        finish(new Error('invalid_oauth_state'));
        return;
      }

      const code = requestUrl.searchParams.get('code');
      const authCode = requestUrl.searchParams.get('authCode') || requestUrl.searchParams.get('auth_code') || code;
      if (!code && !authCode) {
        res.statusCode = 400;
        res.setHeader('content-type', 'text/html; charset=utf-8');
        res.end(responseHtml('OpenYida login failed', 'Missing OAuth authorization code. Please close this page and retry.'));
        finish(new Error('missing_oauth_code'));
        return;
      }

      res.statusCode = 200;
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(responseHtml('OpenYida login completed', 'You can close this page and return to the terminal.'));
      finish(null, {
        code,
        authCode,
        state,
        corpId: requestUrl.searchParams.get('corpId') || requestUrl.searchParams.get('corp_id'),
        redirectUri: options.redirectUri,
      });
    });

    server.on('error', finish);
    server.listen(Number(options.port || 0), '127.0.0.1', () => {
      const address = server.address();
      const redirectUri = options.redirectUri || `http://127.0.0.1:${address.port}${CALLBACK_PATH}`;
      options.redirectUri = redirectUri;
      const authUrl = buildDingtalkOAuthUrl({
        clientId: options.clientId,
        redirectUri,
        state,
        loginOrigin: options.loginOrigin,
        scope: options.scope,
        prompt: options.prompt,
      });

      if (!options.quiet) {
        process.stderr.write(`Open this URL to login:\n${authUrl}\n`);
      }
      openBrowser(authUrl);

      timer = setTimeout(() => finish(new Error('oauth_login_timeout')), timeoutMs);
    });
  });
}

module.exports = {
  runDingtalkLoopback,
  buildDingtalkOAuthUrl,
  CALLBACK_PATH,
};
