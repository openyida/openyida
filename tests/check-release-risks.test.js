'use strict';

const {
  analyzeContent,
  analyzeFiles,
  collectSourceFiles,
} = require('../scripts/check-release-risks');

function errorIds(findings) {
  return findings.filter((f) => f.severity === 'error').map((f) => f.ruleId);
}

describe('check-release-risks HARD anti-patterns', () => {
  test('flags a real `cmd /c start` launch (Windows URL truncation bug)', () => {
    const code = "spawn('cmd /c start ' + url, { shell: true });";
    expect(errorIds(analyzeContent('x.js', code))).toContain('cmd-c-start-url');
  });

  test('flags spawn("cmd", ["/c", "start", ...]) argv form', () => {
    const code = "const child = spawn('cmd', ['/c', 'start', url]);";
    const ids = errorIds(analyzeContent('x.js', code));
    expect(ids).toContain('cmd-c-start-argv');
  });

  test('flags `open -n <url>` fake-new-window pattern', () => {
    const code = "return { command: 'open', args: ['-n', url] };";
    expect(errorIds(analyzeContent('x.js', code))).toContain('open-n-url-new-tab');
  });
});

describe('check-release-risks ignores comments and safe code', () => {
  test('does NOT flag `cmd /c start` written inside a line comment', () => {
    const code = [
      '// Going through `cmd /c start` would split the URL on `&`, so we',
      '// use rundll32 instead.',
      "return { command: 'rundll32', args: ['url.dll,FileProtocolHandler', url] };",
    ].join('\n');
    const findings = analyzeContent('safe.js', code);
    expect(errorIds(findings)).toHaveLength(0);
  });

  test('does NOT flag `cmd /c start` inside a block comment', () => {
    const code = [
      '/*',
      ' * Never use cmd /c start here.',
      ' */',
      "spawn('rundll32', ['url.dll,FileProtocolHandler', url]);",
    ].join('\n');
    expect(errorIds(analyzeContent('safe.js', code))).toHaveLength(0);
  });

  test('does NOT flag // that appears inside a string literal (e.g. https://)', () => {
    const code = [
      "const base = 'https://www.aliwork.com';",
      "spawn('cmd', ['/c', 'start', url]); // real bug on next stmt is caught",
    ].join('\n');
    // The URL string must not swallow the following code line as a comment.
    expect(errorIds(analyzeContent('mixed.js', code))).toContain('cmd-c-start-argv');
  });

  test('safe launcher code produces no errors but an advisory warning', () => {
    const code = "return { command: 'open', args: ['-b', bundleId, '-n', '--args', '--new-window', url] };";
    const findings = analyzeContent('launcher.js', code);
    expect(errorIds(findings)).toHaveLength(0);
    expect(findings.some((f) => f.severity === 'warning')).toBe(true);
  });

  test('does NOT warn for ordinary business enum values named open', () => {
    const code = [
      "const action = { target: 'open', label: 'Open permission' };",
      "if (!['open', 'share'].includes(action.target)) throw new Error('bad target');",
    ].join('\n');
    const findings = analyzeContent('business.js', code);
    expect(findings).toHaveLength(0);
  });
});

describe('check-release-risks guards the real repository', () => {
  test('current lib/ source has zero HARD anti-patterns', () => {
    const { errorCount } = analyzeFiles(collectSourceFiles());
    expect(errorCount).toBe(0);
  });
});
