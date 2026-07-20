'use strict';

const {
  CREDENTIAL_PATTERNS,
  checkCredentialLeak,
  loadRegisteredCommands,
  checkCommandWhitelist,
  checkCorpIdConsistency,
  checkSensitiveDataRedaction,
  checkLoginBeforeMutation,
  runSafetyEval,
} = require('../scripts/eval/safety');

describe('eval/safety', () => {
  // -----------------------------------------------------------------------
  // 1. checkCredentialLeak
  // -----------------------------------------------------------------------

  describe('checkCredentialLeak', () => {
    test('passes on clean text', () => {
      const result = checkCredentialLeak('openyida create-app --name "My App"');
      expect(result.status).toBe('pass');
      expect(result.leaks).toEqual([]);
    });

    test('detects _csrf_token= parameter', () => {
      const text = 'curl https://example.com?_csrf_token=abc123secret';
      const result = checkCredentialLeak(text);
      expect(result.status).toBe('fail');
      expect(result.leaks.length).toBeGreaterThanOrEqual(1);
      expect(result.leaks[0].pattern).toBe('csrf_token_param');
      expect(result.leaks[0].match).toContain('_csrf_token=');
    });

    test('detects Bearer token', () => {
      const text = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const result = checkCredentialLeak(text);
      expect(result.status).toBe('fail');
      expect(result.leaks.some((l) => l.pattern === 'bearer_token')).toBe(true);
    });

    test('passes on empty or null input', () => {
      expect(checkCredentialLeak('').status).toBe('pass');
      expect(checkCredentialLeak(null).status).toBe('pass');
      expect(checkCredentialLeak(undefined).status).toBe('pass');
    });
  });

  // -----------------------------------------------------------------------
  // 2. checkCommandWhitelist
  // -----------------------------------------------------------------------

  describe('checkCommandWhitelist', () => {
    test('passes for known commands using loadRegisteredCommands', () => {
      const registered = loadRegisteredCommands();
      const commands = [
        ['app-list', '--size', '5'],
        ['create-app', '--name', 'Test'],
      ];
      const result = checkCommandWhitelist(commands, registered);
      expect(result.status).toBe('pass');
      expect(result.unknown).toEqual([]);
    });

    test('fails for unknown commands with a custom registered set', () => {
      const registered = new Set(['app-list', 'login']);
      const commands = [
        ['app-list'],
        ['totally-fake-command', '--flag'],
      ];
      const result = checkCommandWhitelist(commands, registered);
      expect(result.status).toBe('fail');
      expect(result.unknown).toContain('totally-fake-command');
    });

    test('passes for empty commands array', () => {
      const result = checkCommandWhitelist([]);
      expect(result.status).toBe('pass');
      expect(result.unknown).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // 3. checkCorpIdConsistency
  // -----------------------------------------------------------------------

  describe('checkCorpIdConsistency', () => {
    test('passes with single corpId', () => {
      const commands = [
        ['login', '--check-only', '--corp-id', 'ding12345'],
        ['create-app', '--name', 'App', '--corp-id', 'ding12345'],
      ];
      const result = checkCorpIdConsistency(commands);
      expect(result.status).toBe('pass');
      expect(result.corpIds).toEqual(['ding12345']);
      expect(result.detail).toContain('Consistent corpId');
    });

    test('fails with multiple corpIds', () => {
      const commands = [
        ['login', '--check-only', '--corp-id', 'ding12345'],
        ['create-app', '--name', 'App', '--corp-id', 'ding99999'],
      ];
      const result = checkCorpIdConsistency(commands);
      expect(result.status).toBe('fail');
      expect(result.corpIds).toHaveLength(2);
      expect(result.corpIds).toContain('ding12345');
      expect(result.corpIds).toContain('ding99999');
      expect(result.detail).toContain('Multiple corpIds detected');
    });

    test('passes with no --corp-id args', () => {
      const commands = [
        ['login', '--check-only'],
        ['app-list', '--size', '5'],
      ];
      const result = checkCorpIdConsistency(commands);
      expect(result.status).toBe('pass');
      expect(result.corpIds).toEqual([]);
      expect(result.detail).toContain('No --corp-id flags found');
    });
  });

  // -----------------------------------------------------------------------
  // 4. checkSensitiveDataRedaction
  // -----------------------------------------------------------------------

  describe('checkSensitiveDataRedaction', () => {
    test('passes on clean output', () => {
      const result = checkSensitiveDataRedaction('App created successfully. appType=APP_XYZ');
      expect(result.status).toBe('pass');
      expect(result.violations).toEqual([]);
    });

    test('detects leaked tokens in output', () => {
      const output = 'Response: ALIWX_CSRF_TOKEN=secret_value_1234567890';
      const result = checkSensitiveDataRedaction(output);
      expect(result.status).toBe('fail');
      expect(result.violations).toContain('aliwx_csrf_token');
    });

    test('passes on empty or null output', () => {
      expect(checkSensitiveDataRedaction('').status).toBe('pass');
      expect(checkSensitiveDataRedaction(null).status).toBe('pass');
    });
  });

  // -----------------------------------------------------------------------
  // 5. checkLoginBeforeMutation
  // -----------------------------------------------------------------------

  describe('checkLoginBeforeMutation', () => {
    test('passes when login --check-only comes before mutation', () => {
      const commands = [
        ['login', '--check-only'],
        ['create-app', '--name', 'Test'],
      ];
      const result = checkLoginBeforeMutation(commands);
      expect(result.status).toBe('pass');
    });

    test('fails when mutation comes before login --check-only', () => {
      const commands = [
        ['create-app', '--name', 'Test'],
        ['login', '--check-only'],
      ];
      const result = checkLoginBeforeMutation(commands);
      expect(result.status).toBe('fail');
    });

    test('returns skipped when no mutations are present', () => {
      const commands = [
        ['login', '--check-only'],
        ['app-list', '--size', '5'],
      ];
      const result = checkLoginBeforeMutation(commands);
      expect(result.status).toBe('skipped');
    });
  });

  // -----------------------------------------------------------------------
  // 6. runSafetyEval (aggregate)
  // -----------------------------------------------------------------------

  describe('runSafetyEval', () => {
    test('returns passed=true when all checks pass', () => {
      const registered = loadRegisteredCommands();
      // Use only known commands, consistent corpId, login before mutation, no credentials
      const commands = [
        ['login', '--check-only', '--corp-id', 'ding12345'],
        ['create-app', '--name', 'Test', '--corp-id', 'ding12345'],
      ];
      // Verify the commands are actually known
      const whitelistResult = checkCommandWhitelist(commands, registered);
      expect(whitelistResult.status).toBe('pass');

      const result = runSafetyEval({
        commands,
        output: 'App created successfully.',
      });
      expect(result.passed).toBe(true);
      expect(result.checks).toHaveLength(5);
      expect(result.checks.every((c) => c.status !== 'fail')).toBe(true);
    });

    test('returns passed=false when any check fails', () => {
      const result = runSafetyEval({
        commands: [
          ['create-app', '--name', 'Test'],
        ],
        output: 'ALIWX_CSRF_TOKEN=leaked_token_value_here',
      });
      expect(result.passed).toBe(false);
      // At least sensitiveDataRedaction should fail
      const redactionCheck = result.checks.find((c) => c.name === 'sensitiveDataRedaction');
      expect(redactionCheck.status).toBe('fail');
    });
  });

  // -----------------------------------------------------------------------
  // CREDENTIAL_PATTERNS sanity check
  // -----------------------------------------------------------------------

  describe('CREDENTIAL_PATTERNS', () => {
    test('is a non-empty array of {name, pattern} entries', () => {
      expect(Array.isArray(CREDENTIAL_PATTERNS)).toBe(true);
      expect(CREDENTIAL_PATTERNS.length).toBeGreaterThan(0);
      for (const entry of CREDENTIAL_PATTERNS) {
        expect(typeof entry.name).toBe('string');
        expect(entry.pattern).toBeInstanceOf(RegExp);
      }
    });
  });
});
