'use strict';

const {
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
} = require('../lib/auth/oauth-loopback');

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
