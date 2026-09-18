'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('managed CLI static help has no execution side effects', () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'managed-help-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  function invoke(argv) {
    const entry = path.resolve(__dirname, '../bin/yida.js');
    // Fail closed if the CLI attempts an auth/business/update load, file write
    // or network operation. Do not override the user's HOME or read login data.
    const script = String.raw`
      const fs = require('fs');
      const Module = require('module');
      const load = Module._load;
      Module._load = function(request, ...args) {
        if (/lib\/(?:app\/|auth\/|core\/(?:utils|update))/.test(request)) {
          throw new Error('Unexpected execution module: ' + request);
        }
        return load.call(this, request, ...args);
      };
      for (const name of ['writeFileSync','appendFileSync','mkdirSync','renameSync','unlinkSync','rmSync']) {
        fs[name] = () => { throw new Error('Unexpected file write: ' + name); };
      }
      const open = fs.openSync;
      fs.openSync = function(file, flags, ...args) {
        if (flags !== 'r') { throw new Error('Unexpected file open'); }
        return open.call(this, file, flags, ...args);
      };
      for (const name of ['http', 'https', 'net', 'tls']) {
        const mod = require(name);
        for (const method of ['request', 'get', 'connect', 'createConnection', 'createServer']) {
          if (mod[method]) { mod[method] = () => { throw new Error('Unexpected network operation'); }; }
        }
      }
      global.fetch = () => { throw new Error('Unexpected fetch'); };
      process.argv = [process.execPath, ${JSON.stringify(entry)}, ...${JSON.stringify(argv)}];
      require(${JSON.stringify(entry)});
    `;
    return spawnSync(process.execPath, ['-e', script], { cwd: dir, encoding: 'utf8', timeout: 10000,
      env: {
        PATH: path.dirname(process.execPath), OPENYIDA_MANAGED_RUN: '1',
        OPENYIDA_AGENT_APP_TYPE: 'APP_FIXTURE', OPENYIDA_AGENT_CORP_ID: 'corp-fixture',
        OPENYIDA_AGENT_USER_ID: 'user-fixture', OPENYIDA_AGENT_RUN_ID: 'run-fixture',
        OPENYIDA_AGENT_ATTEMPT_ID: 'attempt-fixture', OPENYIDA_AGENT_BASE_URL: 'https://fixture.invalid',
        OPENYIDA_AGENT_TASK_GRANT: 'fixture_' + 'g'.repeat(48),
      } });
  }

  test.each([
    ['create-form', '--help'], ['create-form', 'batch', '--help'],
    ['create-page', '--help'], ['publish', '--help'], ['nav-group', '--help'],
    ['agent', 'ask-human', '--help'], ['--help'],
  ])('%j prints help without Receipt, auth, first-run guide or network', (...argv) => {
    const result = invoke(argv);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('openyida ');
    expect(result.stdout).not.toContain('fixture_' + 'g'.repeat(48));
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  test('JSON help contains only matching static manifest commands', () => {
    const result = invoke(['create-form', 'batch', '--help', '--json', '--quiet']);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).commands.map(command => command.path)).toEqual([['create-form', 'batch']]);
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  test('help with business parameters is rejected without executing the module', () => {
    const result = invoke(['create-page', 'APP_FIXTURE', '--help', '--json']);
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stderr).errorCode).toBe('MANAGED_COMMAND_UNSUPPORTED');
    expect(fs.readdirSync(dir)).toEqual([]);
  });
});
