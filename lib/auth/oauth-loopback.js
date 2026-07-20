'use strict';

const crypto = require('crypto');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const CALLBACK_PATH = '/oauth/callback';
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

const CHROMIUM_MAC_BUNDLES = {
  'com.google.chrome': 'com.google.Chrome',
  'com.microsoft.edgemac': 'com.microsoft.edgemac',
  'com.brave.browser': 'com.brave.Browser',
  'com.operasoftware.opera': 'com.operasoftware.Opera',
  'com.vivaldi.vivaldi': 'com.vivaldi.Vivaldi',
  'org.chromium.chromium': 'org.chromium.Chromium',
};

// Only these browser families have a known reliable new-window launch path.
// Anything else (unknown/unsupported default browser) must fall back.
const SUPPORTED_BROWSER_FAMILIES = new Set(['chromium', 'firefox', 'safari']);

// Chromium accepts `--new-window`; Firefox uses the single-dash `-new-window`.
function newWindowFlag(family) {
  return family === 'firefox' ? '-new-window' : '--new-window';
}

function appleScriptSafe(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function classifyMacBundleId(bundleId) {
  if (!bundleId) {
    return null;
  }
  const id = String(bundleId).toLowerCase();
  if (id === 'com.apple.safari') {
    return { family: 'safari' };
  }
  if (id === 'org.mozilla.firefox') {
    return { family: 'firefox', bundleId: 'org.mozilla.firefox' };
  }
  if (CHROMIUM_MAC_BUNDLES[id]) {
    return { family: 'chromium', bundleId: CHROMIUM_MAC_BUNDLES[id] };
  }
  return null;
}

function classifyWindowsProgId(progId) {
  if (!progId) {
    return null;
  }
  const id = String(progId).toLowerCase();
  if (id.includes('firefox')) {
    return 'firefox';
  }
  if (
    id.startsWith('chromehtml') ||
    id.startsWith('msedge') ||
    id.startsWith('bravehtml') ||
    id.startsWith('opera') ||
    id.includes('vivaldi') ||
    id.includes('chromium')
  ) {
    return 'chromium';
  }
  return null;
}

function classifyLinuxDesktop(name) {
  if (!name) {
    return null;
  }
  const id = String(name).toLowerCase();
  if (id.includes('firefox')) {
    return 'firefox';
  }
  if (
    id.includes('chrome') ||
    id.includes('chromium') ||
    id.includes('brave') ||
    id.includes('edge') ||
    id.includes('opera') ||
    id.includes('vivaldi')
  ) {
    return 'chromium';
  }
  return null;
}

function parseMacDefaultBrowser(defaultsOutput) {
  if (!defaultsOutput) {
    return null;
  }
  // The secure plist is an array of dicts; each `}` closes one handler entry.
  const blocks = String(defaultsOutput).split('}');
  for (const block of blocks) {
    if (/LSHandlerURLScheme\s*=\s*https\b/i.test(block)) {
      const match = block.match(/LSHandlerRole(?:All|Viewer)\s*=\s*"?([\w.-]+)"?/i);
      if (match) {
        return match[1].toLowerCase();
      }
    }
  }
  return null;
}

function parseWindowsProgId(regOutput) {
  if (!regOutput) {
    return null;
  }
  const match = String(regOutput).match(/ProgId\s+REG_\w+\s+(\S+)/i);
  return match ? match[1] : null;
}

function parseWindowsCommandExec(regOutput) {
  if (!regOutput) {
    return null;
  }
  const match = String(regOutput).match(/REG_\w+\s+(.+)$/m);
  if (!match) {
    return null;
  }
  const value = match[1].trim();
  if (value.startsWith('"')) {
    const end = value.indexOf('"', 1);
    if (end > 1) {
      return value.slice(1, end);
    }
  }
  return value.split(/\s+/)[0] || null;
}

function parseLinuxExec(desktopContent) {
  if (!desktopContent) {
    return null;
  }
  const match = String(desktopContent).match(/^Exec=(.+)$/m);
  if (!match) {
    return null;
  }
  // Drop desktop-entry field codes (%u %U %f %F ...) then take the executable.
  const withoutCodes = match[1].replace(/%[a-zA-Z]/g, '').trim();
  const first = withoutCodes.match(/^"([^"]+)"|^(\S+)/);
  if (!first) {
    return null;
  }
  return first[1] || first[2] || null;
}

function runCapture(command, args) {
  try {
    const result = spawnSync(command, args, {
      encoding: 'utf8',
      timeout: 2500,
      windowsHide: true,
    });
    if (result && typeof result.stdout === 'string' && result.stdout.length > 0) {
      return result.stdout;
    }
  } catch {
    return null;
  }
  return null;
}

// Detect the system default browser so we can open a real new window.
// Returns { family, bundleId? , execPath? } or null when detection fails or
// the default browser is not a supported family (unknown ProgId/desktop/bundle).
// `deps` allows injecting command runner / file reader for deterministic tests.
function detectDefaultBrowser(platform = process.platform, deps = {}) {
  const run = deps.run || runCapture;
  const readFile = deps.readFile || ((filePath) => fs.readFileSync(filePath, 'utf8'));
  const homedir = deps.homedir || os.homedir;
  try {
    if (platform === 'darwin') {
      const output = run('defaults', [
        'read',
        'com.apple.LaunchServices/com.apple.launchservices.secure',
      ]);
      return classifyMacBundleId(parseMacDefaultBrowser(output));
    }
    if (platform === 'win32') {
      const progOutput = run('reg', [
        'query',
        'HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice',
        '/v',
        'ProgId',
      ]);
      const progId = parseWindowsProgId(progOutput);
      const family = classifyWindowsProgId(progId);
      // Unknown ProgId (e.g. IE.HTTP or any browser we don't map) -> fall back.
      if (!family) {
        return null;
      }
      const commandOutput =
        run('reg', ['query', `HKCU\\Software\\Classes\\${progId}\\shell\\open\\command`, '/ve']) ||
        run('reg', ['query', `HKEY_CLASSES_ROOT\\${progId}\\shell\\open\\command`, '/ve']);
      const execPath = parseWindowsCommandExec(commandOutput);
      if (!execPath) {
        return null;
      }
      return { family, execPath };
    }
    // linux and other unix-like desktops
    const desktop = run('xdg-settings', ['get', 'default-web-browser']);
    const name = desktop ? desktop.trim() : '';
    if (!name) {
      return null;
    }
    const family = classifyLinuxDesktop(name);
    // Unknown .desktop (e.g. some non-browser or unmapped browser) -> fall back.
    if (!family) {
      return null;
    }
    const candidates = [
      path.join(homedir(), '.local/share/applications', name),
      path.join('/usr/share/applications', name),
      path.join('/usr/local/share/applications', name),
    ];
    for (const candidate of candidates) {
      try {
        const content = readFile(candidate);
        const execPath = parseLinuxExec(content);
        if (execPath) {
          return { family, execPath };
        }
      } catch {
        // try the next candidate location
      }
    }
    return null;
  } catch {
    return null;
  }
}

function resolveBrowserLauncher(url, platform = process.platform, openMode = 'legacy', browser = null) {
  if (openMode === 'newWindow' && browser && SUPPORTED_BROWSER_FAMILIES.has(browser.family)) {
    if (platform === 'darwin') {
      if (browser.family === 'safari') {
        // Safari has no CLI new-window flag; AppleScript opens a new window.
        const safeUrl = appleScriptSafe(url);
        return {
          command: 'osascript',
          args: [
            '-e',
            `tell application "Safari" to make new document with properties {URL:"${safeUrl}"}`,
            '-e',
            'tell application "Safari" to activate',
          ],
        };
      }
      if (browser.bundleId) {
        // `open -b <bundle> -n --args --new-window <url>` forces a new window
        // in the specific Chromium/Firefox app instead of a new tab.
        return {
          command: 'open',
          args: ['-b', browser.bundleId, '-n', '--args', newWindowFlag(browser.family), url],
        };
      }
    } else if (browser.execPath) {
      return {
        command: browser.execPath,
        args: [newWindowFlag(browser.family), url],
      };
    }
  }

  if (platform === 'darwin') {
    return { command: 'open', args: [url] };
  }
  if (platform === 'win32') {
    // rundll32 hands the URL to the default browser as a single argument.
    // Going through `cmd /c start` would let cmd.exe treat the `&` in the
    // OAuth URL as command separators and truncate the query string after
    // redirect_uri, dropping client_id/state and breaking login.
    return { command: 'rundll32', args: ['url.dll,FileProtocolHandler', url] };
  }
  return { command: 'xdg-open', args: [url] };
}

function launchBrowserLauncher(launcher, onError) {
  try {
    const child = spawn(launcher.command, launcher.args, {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    if (onError) {
      child.once('error', onError);
    }
    return true;
  } catch {
    if (onError) {
      onError();
    }
    return false;
  }
}

function openBrowser(url) {
  if (process.env.OPENYIDA_NO_BROWSER === '1') {
    return false;
  }

  const platform = process.platform;
  const legacyLauncher = resolveBrowserLauncher(url, platform, 'legacy');
  const runLegacy = () => launchBrowserLauncher(legacyLauncher);

  let browser = null;
  try {
    browser = detectDefaultBrowser(platform);
  } catch {
    browser = null;
  }

  // Default browser detected and supported → open a real new window in that
  // browser, falling back to the plain default-browser open if launch errors.
  if (browser && SUPPORTED_BROWSER_FAMILIES.has(browser.family)) {
    const newWindowLauncher = resolveBrowserLauncher(url, platform, 'newWindow', browser);
    let fallbackUsed = false;
    const runFallback = () => {
      if (fallbackUsed) {
        return false;
      }
      fallbackUsed = true;
      return runLegacy();
    };

    const launched = launchBrowserLauncher(newWindowLauncher, runFallback);
    if (!launched) {
      return runFallback();
    }
    return true;
  }

  // Detection failed → fall back to the system default browser (new tab).
  return runLegacy();
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

function responseHtml(title, body, options = {}) {
  const {
    autoClose = false,
    autoCloseDelayMs = 1200,
    staticHint = 'You can close this page and return to the terminal.',
  } = options;

  const closeScript = autoClose ? `
    <script>
      (function() {
        const delay = Math.max(0, ${Number(autoCloseDelayMs)});
        function forceClose() {
          try {
            if (window.opener && !window.opener.closed && window.opener.focus) {
              window.opener.focus();
            }
          } catch (err) {}

          try {
            window.close();
          } catch (err) {}

          if (!window.closed) {
            try {
              window.open('', '_self').close();
            } catch (err) {}
          }
        }

        setTimeout(forceClose, delay);
      })();
    </script>
  ` : '';

  const closeHint = autoClose
    ? ''
    : `<p>${staticHint}</p>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><h3>${title}</h3><p>${body}</p>${closeHint}${closeScript}</body></html>`;
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
      res.end(responseHtml(
        'OpenYida login completed',
        'Login callback received. Returning to terminal.',
        {
          autoClose: true,
        }
      ));
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
  resolveBrowserLauncher,
  detectDefaultBrowser,
  classifyMacBundleId,
  classifyWindowsProgId,
  classifyLinuxDesktop,
  parseMacDefaultBrowser,
  parseWindowsProgId,
  parseWindowsCommandExec,
  parseLinuxExec,
  CALLBACK_PATH,
};
