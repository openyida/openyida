'use strict';

const EventEmitter = require('events');
const http = require('http');
const vm = require('vm');

const {
  buildDingtalkOAuthUrl,
  resolveBrowserLauncher,
  detectDefaultBrowser,
  openBrowser,
  isQwenWorkEnvironment,
  classifyMacBundleId,
  classifyWindowsProgId,
  classifyLinuxDesktop,
  parseMacDefaultBrowser,
  parseWindowsProgId,
  parseWindowsCommandExec,
  parseLinuxExec,
  launchLoginBrowser,
  runDingtalkLoopback,
} = require('../lib/auth/oauth-loopback');
const { getLanguage, setLanguage } = require('../lib/core/i18n');

function requestText(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        statusCode: response.statusCode,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    request.on('error', reject);
  });
}

describe('OAuth callback page experience', () => {
  test('renders a friendly success page and reveals manual-close guidance when closing is blocked', async () => {
    const originalLanguage = getLanguage();
    let resolveAuthUrl;
    const authUrlPromise = new Promise((resolve) => {
      resolveAuthUrl = resolve;
    });

    setLanguage('zh');
    try {
      const loginPromise = runDingtalkLoopback({
        clientId: 'test-client',
        state: 'known-state',
        quiet: true,
        timeoutMs: 2000,
        openBrowser: (url) => {
          resolveAuthUrl(url);
          return true;
        },
      });
      const authUrl = await authUrlPromise;
      await new Promise((resolve) => setImmediate(resolve));
      const callbackUrl = new URL(new URL(authUrl).searchParams.get('redirect_uri'));
      callbackUrl.searchParams.set('state', 'known-state');
      callbackUrl.searchParams.set('code', 'test-code');

      const response = await requestText(callbackUrl);
      const callback = await loginPromise;

      expect(response.statusCode).toBe(200);
      expect(callback.code).toBe('test-code');
      expect(response.body).toContain('<html lang="zh" dir="ltr">');
      expect(response.body).toContain('<meta name="viewport"');
      expect(response.body).toContain('<h1 id="page-title">登录成功</h1>');
      expect(response.body).toContain('登录已完成，请返回刚才的窗口继续操作。');
      expect(response.body).toContain('正在自动关闭此窗口…');
      expect(response.body).toContain('id="manual-close"');
      expect(response.body).toContain('此窗口未能自动关闭，请手动关闭后返回刚才的窗口继续操作。');

      const scriptMatch = response.body.match(/<script>([\s\S]*?)<\/script>/);
      expect(scriptMatch).not.toBeNull();

      const closingStatus = { hidden: false };
      const manualClose = { hidden: true };
      const timers = [];
      const browserWindow = {
        opener: null,
        closed: false,
        close: jest.fn(),
        open: jest.fn(),
      };
      browserWindow.open.mockReturnValue(browserWindow);

      vm.runInNewContext(scriptMatch[1], {
        window: browserWindow,
        document: {
          getElementById: (id) => id === 'closing-status' ? closingStatus : manualClose,
        },
        setTimeout: (callbackFn, delay) => timers.push({ callbackFn, delay }),
      });

      expect(timers.map(({ delay }) => delay)).toEqual([1200, 2100]);
      timers[0].callbackFn();
      expect(browserWindow.close).toHaveBeenCalledTimes(2);
      expect(manualClose.hidden).toBe(true);

      timers[1].callbackFn();
      expect(closingStatus.hidden).toBe(true);
      expect(manualClose.hidden).toBe(false);
    } finally {
      setLanguage(originalLanguage);
    }
  });
});

describe('launchLoginBrowser browser ownership', () => {
  test('requests one browser launch by default', () => {
    const openBrowser = jest.fn(() => true);
    expect(launchLoginBrowser('https://login.example.test', { openBrowser })).toBe(true);
    expect(openBrowser).toHaveBeenCalledTimes(1);
    expect(openBrowser).toHaveBeenCalledWith('https://login.example.test');
  });

  test('noBrowser leaves the authorization URL to the caller', () => {
    const openBrowser = jest.fn();
    expect(launchLoginBrowser('https://login.example.test', {
      noBrowser: true,
      openBrowser,
    })).toBe(false);
    expect(openBrowser).not.toHaveBeenCalled();
  });

  test('OPENYIDA_NO_BROWSER leaves the authorization URL to the caller', () => {
    const openBrowser = jest.fn();
    expect(launchLoginBrowser('https://login.example.test', {
      env: { OPENYIDA_NO_BROWSER: '1' },
      openBrowser,
    })).toBe(false);
    expect(openBrowser).not.toHaveBeenCalled();
  });
});

describe('resolveBrowserLauncher', () => {
  // A realistic OAuth URL: redirect_uri is the FIRST query param, so anything
  // that truncates at the first `&` loses client_id/scope/state.
  const oauthUrl = buildDingtalkOAuthUrl({
    clientId: 'suite9xvlxxerybljwheo',
    redirectUri: 'http://127.0.0.1:34882/oauth/callback',
    state: 'abc123',
    scope: 'openid corpid',
  });

  test('darwin passes the full URL as a single argument', () => {
    const { command, args } = resolveBrowserLauncher(oauthUrl, 'darwin');
    expect(command).toBe('open');
    expect(args).toEqual([oauthUrl]);
  });

  test('linux passes the full URL as a single argument', () => {
    const { command, args } = resolveBrowserLauncher(oauthUrl, 'linux');
    expect(command).toBe('xdg-open');
    expect(args).toEqual([oauthUrl]);
  });

  test('win32 uses rundll32 and never routes the URL through cmd', () => {
    const { command, args } = resolveBrowserLauncher(oauthUrl, 'win32');
    // The core of the fix: NOT cmd.exe, which would split the URL on `&`.
    expect(command).toBe('rundll32');
    expect(command).not.toBe('cmd');
    expect(args[0]).toBe('url.dll,FileProtocolHandler');
    // The URL must be a single, untouched argv element (not split on `&`).
    expect(args).toHaveLength(2);
    expect(args[1]).toBe(oauthUrl);
  });

  test('win32 preserves client_id and all params after the first &', () => {
    const { args } = resolveBrowserLauncher(oauthUrl, 'win32');
    const passedUrl = args[1];
    expect(passedUrl).toContain('&client_id=suite9xvlxxerybljwheo');
    expect(passedUrl).toContain('&response_type=code');
    expect(passedUrl).toContain('&scope=');
    expect(passedUrl).toContain('&state=abc123');
    // Simulate the old cmd truncation-at-first-& bug and prove we avoid it:
    const truncated = passedUrl.split('&')[0];
    expect(truncated).not.toContain('client_id');
    expect(passedUrl).not.toBe(truncated);
  });

  test('newWindow falls back to plain default-browser open when browser is unknown', () => {
    // No browser detected -> must NOT pretend to open a new window.
    expect(resolveBrowserLauncher(oauthUrl, 'darwin', 'newWindow', null)).toEqual({
      command: 'open',
      args: [oauthUrl],
    });
    expect(resolveBrowserLauncher(oauthUrl, 'win32', 'newWindow', null).command).toBe('rundll32');
    expect(resolveBrowserLauncher(oauthUrl, 'linux', 'newWindow', null).command).toBe('xdg-open');
  });

  test('newWindow falls back when the default browser family is unsupported', () => {
    // e.g. Arc or any browser we do not have a known new-window path for:
    // even with a bundleId/execPath present, an unknown family must fall back.
    expect(
      resolveBrowserLauncher(oauthUrl, 'darwin', 'newWindow', {
        family: 'arc',
        bundleId: 'company.thebrowser.Browser',
      })
    ).toEqual({ command: 'open', args: [oauthUrl] });
    expect(
      resolveBrowserLauncher(oauthUrl, 'win32', 'newWindow', {
        family: 'unknown',
        execPath: 'C:\\weird\\browser.exe',
      }).command
    ).toBe('rundll32');
    expect(
      resolveBrowserLauncher(oauthUrl, 'linux', 'newWindow', {
        family: 'unknown',
        execPath: '/usr/bin/weird-browser',
      }).command
    ).toBe('xdg-open');
  });

  test('darwin newWindow uses `open -b ... --args --new-window` for Chromium', () => {
    const { command, args } = resolveBrowserLauncher(oauthUrl, 'darwin', 'newWindow', {
      family: 'chromium',
      bundleId: 'com.google.Chrome',
    });
    expect(command).toBe('open');
    expect(args).toEqual([
      '-b',
      'com.google.Chrome',
      '-n',
      '--args',
      '--new-window',
      oauthUrl,
    ]);
    // URL still passed as a single untouched argv element.
    expect(args[args.length - 1]).toBe(oauthUrl);
  });

  test('darwin newWindow uses single-dash flag for Firefox', () => {
    const { args } = resolveBrowserLauncher(oauthUrl, 'darwin', 'newWindow', {
      family: 'firefox',
      bundleId: 'org.mozilla.firefox',
    });
    expect(args).toContain('-new-window');
    expect(args).not.toContain('--new-window');
  });

  test('darwin newWindow uses AppleScript for Safari', () => {
    const { command, args } = resolveBrowserLauncher(oauthUrl, 'darwin', 'newWindow', {
      family: 'safari',
    });
    expect(command).toBe('osascript');
    expect(args.join(' ')).toContain('make new document with properties');
    expect(args.some((a) => a.includes(oauthUrl))).toBe(true);
  });

  test('win32 newWindow launches the detected browser exe with a new-window flag', () => {
    const { command, args } = resolveBrowserLauncher(oauthUrl, 'win32', 'newWindow', {
      family: 'chromium',
      execPath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    });
    expect(command).toBe('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
    expect(args).toEqual(['--new-window', oauthUrl]);
  });

  test('linux newWindow launches the detected browser exe with a new-window flag', () => {
    const { command, args } = resolveBrowserLauncher(oauthUrl, 'linux', 'newWindow', {
      family: 'chromium',
      execPath: '/usr/bin/google-chrome-stable',
    });
    expect(command).toBe('/usr/bin/google-chrome-stable');
    expect(args).toEqual(['--new-window', oauthUrl]);
  });
});

describe('openBrowser launch policy', () => {
  const oauthUrl = buildDingtalkOAuthUrl({
    clientId: 'suite9xvlxxerybljwheo',
    redirectUri: 'http://127.0.0.1:34882/oauth/callback',
    state: 'abc123',
    scope: 'openid corpid',
  });

  function createChild() {
    const child = new EventEmitter();
    child.unref = jest.fn();
    return child;
  }

  test('detects QwenWork desktop shell signals', () => {
    expect(isQwenWorkEnvironment({ QWENWORK_INTEGRATION_MODE: '1' })).toBe(true);
    expect(isQwenWorkEnvironment({ QWENWORKCN_INTEGRATION_MODE: '1' })).toBe(true);
    expect(isQwenWorkEnvironment({ __CFBundleIdentifier: 'com.alibaba.qwenwork' })).toBe(true);
    expect(isQwenWorkEnvironment({ QODER_WORK_INTEGRATION_PRODUCT: 'qwen-work' })).toBe(true);
    expect(isQwenWorkEnvironment({ QODER_WORK_INTEGRATION_PRODUCT: 'qwenworkcn' })).toBe(true);
    expect(isQwenWorkEnvironment({ QODERCN_CONFIG_DIR: '/Users/me/.qwenworkcn' })).toBe(true);
    expect(isQwenWorkEnvironment({ QODER_WORKER_CWD: '/Users/me/.qwenworkcn/workspace/chat-1' })).toBe(true);
    expect(isQwenWorkEnvironment({ __CFBundleIdentifier: 'com.openai.codex' })).toBe(false);
  });

  test('QwenWork opens the system default browser before new-window fallback', () => {
    const calls = [];
    const child = createChild();
    const ok = openBrowser(oauthUrl, {
      env: { QWENWORKCN_INTEGRATION_MODE: '1' },
      platform: 'darwin',
      detectDefaultBrowser: () => ({ family: 'chromium', bundleId: 'com.google.Chrome' }),
      spawn: (command, args) => {
        calls.push({ command, args });
        return child;
      },
    });

    expect(ok).toBe(true);
    expect(calls).toEqual([{ command: 'open', args: [oauthUrl] }]);
  });

  test('QwenWork falls back to the new-window launcher when system open fails', () => {
    const calls = [];
    const children = [createChild(), createChild()];
    const ok = openBrowser(oauthUrl, {
      env: { __CFBundleIdentifier: 'com.alibaba.qwen-work' },
      platform: 'darwin',
      detectDefaultBrowser: () => ({ family: 'chromium', bundleId: 'com.google.Chrome' }),
      spawn: (command, args) => {
        calls.push({ command, args });
        return children[calls.length - 1];
      },
    });

    children[0].emit('exit', 1, null);

    expect(ok).toBe(true);
    expect(calls).toEqual([
      { command: 'open', args: [oauthUrl] },
      {
        command: 'open',
        args: ['-b', 'com.google.Chrome', '-n', '--args', '--new-window', oauthUrl],
      },
    ]);
  });

  test('QwenWork reports success when synchronous system-open failure falls back', () => {
    const calls = [];
    const child = createChild();
    const ok = openBrowser(oauthUrl, {
      env: { QWENWORKCN_INTEGRATION_MODE: '1' },
      platform: 'darwin',
      detectDefaultBrowser: () => ({ family: 'chromium', bundleId: 'com.google.Chrome' }),
      spawn: (command, args) => {
        calls.push({ command, args });
        if (calls.length === 1) {
          throw new Error('spawn failed');
        }
        return child;
      },
    });

    expect(ok).toBe(true);
    expect(calls).toEqual([
      { command: 'open', args: [oauthUrl] },
      {
        command: 'open',
        args: ['-b', 'com.google.Chrome', '-n', '--args', '--new-window', oauthUrl],
      },
    ]);
  });

  test('non-QwenWork agents still prefer a real browser new window', () => {
    const calls = [];
    const child = createChild();
    const ok = openBrowser(oauthUrl, {
      env: { CODEX_SHELL: '1' },
      platform: 'darwin',
      detectDefaultBrowser: () => ({ family: 'chromium', bundleId: 'com.google.Chrome' }),
      spawn: (command, args) => {
        calls.push({ command, args });
        return child;
      },
    });

    expect(ok).toBe(true);
    expect(calls).toEqual([
      {
        command: 'open',
        args: ['-b', 'com.google.Chrome', '-n', '--args', '--new-window', oauthUrl],
      },
    ]);
  });
});

describe('default browser classification and parsing', () => {
  test('classifyMacBundleId maps known browsers (case-insensitive)', () => {
    expect(classifyMacBundleId('com.google.chrome')).toEqual({
      family: 'chromium',
      bundleId: 'com.google.Chrome',
    });
    expect(classifyMacBundleId('com.apple.Safari')).toEqual({ family: 'safari' });
    expect(classifyMacBundleId('org.mozilla.firefox')).toEqual({
      family: 'firefox',
      bundleId: 'org.mozilla.firefox',
    });
    expect(classifyMacBundleId('com.unknown.browser')).toBeNull();
    // Arc is a real browser but unmapped -> treated as unknown so we fall back.
    expect(classifyMacBundleId('company.thebrowser.Browser')).toBeNull();
    expect(classifyMacBundleId(null)).toBeNull();
  });

  test('parseMacDefaultBrowser finds the https handler bundle id', () => {
    const output = [
      '{',
      '    LSHandlerRoleAll = "com.apple.mail";',
      '    LSHandlerURLScheme = mailto;',
      '},',
      '{',
      '    LSHandlerRoleAll = "com.google.chrome";',
      '    LSHandlerURLScheme = https;',
      '}',
    ].join('\n');
    expect(parseMacDefaultBrowser(output)).toBe('com.google.chrome');
    expect(parseMacDefaultBrowser('')).toBeNull();
  });

  test('classifyWindowsProgId maps ProgIds to families', () => {
    expect(classifyWindowsProgId('ChromeHTML')).toBe('chromium');
    expect(classifyWindowsProgId('MSEdgeHTM')).toBe('chromium');
    expect(classifyWindowsProgId('FirefoxURL-308046B0AF4A39CB')).toBe('firefox');
    expect(classifyWindowsProgId('IE.HTTP')).toBeNull();
  });

  test('parseWindowsProgId and parseWindowsCommandExec read the registry output', () => {
    const progOut = '\r\n    ProgId    REG_SZ    ChromeHTML\r\n';
    expect(parseWindowsProgId(progOut)).toBe('ChromeHTML');

    const cmdOut =
      '\r\n    (Default)    REG_SZ    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" -- "%1"\r\n';
    expect(parseWindowsCommandExec(cmdOut)).toBe(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    );
  });

  test('classifyLinuxDesktop and parseLinuxExec resolve the browser binary', () => {
    expect(classifyLinuxDesktop('google-chrome.desktop')).toBe('chromium');
    expect(classifyLinuxDesktop('firefox.desktop')).toBe('firefox');
    expect(classifyLinuxDesktop('nautilus.desktop')).toBeNull();

    const desktop = [
      '[Desktop Entry]',
      'Name=Google Chrome',
      'Exec=/usr/bin/google-chrome-stable %U',
    ].join('\n');
    expect(parseLinuxExec(desktop)).toBe('/usr/bin/google-chrome-stable');
  });
});

describe('detectDefaultBrowser (injected deps, per-platform identifiers differ)', () => {
  test('macOS resolves known bundle id, unknown bundle id falls back to null', () => {
    const macKnown = (bundleId) => () =>
      `{\n  LSHandlerRoleAll = "${bundleId}";\n  LSHandlerURLScheme = https;\n}`;
    expect(detectDefaultBrowser('darwin', { run: macKnown('com.google.chrome') })).toEqual({
      family: 'chromium',
      bundleId: 'com.google.Chrome',
    });
    // Unknown bundle id (e.g. Arc) -> null so openBrowser falls back.
    expect(
      detectDefaultBrowser('darwin', { run: macKnown('company.thebrowser.Browser') })
    ).toBeNull();
  });

  test('Windows resolves known ProgId, unknown ProgId falls back to null', () => {
    const winRun = (progId, execLine) => (command, args) => {
      const key = args.join(' ');
      if (key.includes('UserChoice')) {
        return `\r\n    ProgId    REG_SZ    ${progId}\r\n`;
      }
      if (key.includes('shell\\open\\command')) {
        return `\r\n    (Default)    REG_SZ    ${execLine}\r\n`;
      }
      return null;
    };
    expect(
      detectDefaultBrowser('win32', {
        run: winRun('ChromeHTML', '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" -- "%1"'),
      })
    ).toEqual({
      family: 'chromium',
      execPath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    });
    // Unknown ProgId (IE.HTTP) -> null so openBrowser falls back.
    expect(detectDefaultBrowser('win32', { run: winRun('IE.HTTP', 'iexplore.exe') })).toBeNull();
  });

  test('Linux resolves known .desktop, unknown .desktop falls back to null', () => {
    const linuxRun = (desktopName) => () => `${desktopName}\n`;
    const readFile = () => '[Desktop Entry]\nExec=/usr/bin/google-chrome %U\n';
    expect(
      detectDefaultBrowser('linux', { run: linuxRun('google-chrome.desktop'), readFile })
    ).toEqual({ family: 'chromium', execPath: '/usr/bin/google-chrome' });
    // Unknown .desktop -> null so openBrowser falls back (readFile never reached).
    expect(
      detectDefaultBrowser('linux', {
        run: linuxRun('some-unknown-app.desktop'),
        readFile,
      })
    ).toBeNull();
  });

  test('returns null when the detection command yields nothing', () => {
    expect(detectDefaultBrowser('darwin', { run: () => null })).toBeNull();
    expect(detectDefaultBrowser('win32', { run: () => '' })).toBeNull();
    expect(detectDefaultBrowser('linux', { run: () => '' })).toBeNull();
  });
});
