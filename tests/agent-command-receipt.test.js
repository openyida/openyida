'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { beginCommandReceipt, writeReceipt } = require('../lib/agent/command-receipt');

describe('direct Node mutation receipts', () => {
  let dir;
  let env;
  beforeEach(() => {
    dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'command-receipt-')));
    fs.chmodSync(dir, 0o700);
    env = { ...process.env, OPENYIDA_MANAGED_RUN: '1', OPENYIDA_AGENT_APP_TYPE: 'APP_X',
      OPENYIDA_AGENT_CORP_ID: 'corp', OPENYIDA_AGENT_USER_ID: 'user', OPENYIDA_AGENT_RUN_ID: 'run',
      OPENYIDA_AGENT_ATTEMPT_ID: 'attempt', OPENYIDA_AGENT_BASE_URL: 'https://platform.example.test',
      OPENYIDA_AGENT_TASK_GRANT: 'test-grant-1234567890', OPENYIDA_AGENT_RECEIPTS_DIR: dir };
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
  const entries = dir => fs.readdirSync(dir).map(name => JSON.parse(fs.readFileSync(path.join(dir, name))));

  test('read-only CLI processes do not create mutation receipts', () => {
    for (let i = 0; i < 3; i++) {
      const result = spawnSync(process.execPath, [path.resolve(__dirname, '../bin/yida.js'), 'commands', '--json'], { env, encoding: 'utf8' });
      expect(result.status).toBe(0);
    }
    expect(entries(dir)).toEqual([]);
  });
  test('independent write commands each complete a private mutation receipt without a Go gateway', () => {
    const records = [];
    for (let i = 0; i < 3; i++) {
      const consoleObject = { log() {} };
      const capture = beginCommandReceipt({ command: 'create-page', args: ['APP_X', 'Page'], env, consoleObject });
      consoleObject.log(JSON.stringify({ success: true, pageId: `FORM_${i}` }));
      capture.finish();
    }
    records.push(...entries(dir));
    expect(records).toHaveLength(3);
    expect(new Set(records.map(r => r.id)).size).toBe(3);
    for (const receipt of records) {
      expect(receipt).toMatchObject({ schemaVersion: 1, runId: 'run', attemptId: 'attempt' });
      expect(receipt.phase).toBeUndefined();
      expect(receipt.exitCode).toBeUndefined();
      expect(JSON.stringify(receipt)).not.toContain(env.OPENYIDA_AGENT_TASK_GRANT);
    }
  });
  test('non-write failures do not create a mutation receipt', () => {
    const result = spawnSync(process.execPath, [path.resolve(__dirname, '../bin/yida.js'), 'no-such-command'], { env });
    expect(result.status).not.toBe(0);
    expect(entries(dir)).toEqual([]);
  });
  test('only successful writes persist a compact mutation receipt', () => {
    const consoleObject = { log() {} };
    const capture = beginCommandReceipt({ command: 'create-page', args: ['APP_X'], env, consoleObject });
    expect(entries(dir)).toEqual([]);
    consoleObject.log(JSON.stringify({ success: true, pageId: 'FORM_X', source: 'x'.repeat(10000) }));
    capture.finish(); capture.finish();
    expect(entries(dir)[0].mutation.formUuid).toBe('FORM_X');
    expect(JSON.stringify(entries(dir)[0]).length).toBeLessThan(1024);
    expect(() => writeReceipt(dir, { id: 'oversize', value: 'x'.repeat(16384) })).toThrow();
  });
  test('failed and interrupted writes persist no receipt', () => {
    beginCommandReceipt({ command: 'create-page', args: ['APP_X'], env }).finish(1);
    beginCommandReceipt({ command: 'create-page', args: ['APP_X'], env });
    expect(entries(dir)).toEqual([]);
  });
  test('ordinary mode creates no files', () => {
    beginCommandReceipt({ command: 'commands', env: {} }).finish();
    expect(entries(dir)).toEqual([]);
  });
});


describe('Windows receipt publication conflicts', () => {
  const windowsTest = process.platform === 'win32' ? test : test.skip;
  windowsTest('retries a temporary sharing error and publishes exactly once', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'receipt-retry-'));
    const rename = jest.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
      throw Object.assign(new Error('sharing conflict'), { code: 'EBUSY' });
    });
    try {
      writeReceipt(dir, { id: 'receipt-1', schemaVersion: 1 });
      expect(rename).toHaveBeenCalledTimes(2);
      expect(fs.readdirSync(dir)).toEqual(['receipt-1.json']);
      expect(JSON.parse(fs.readFileSync(path.join(dir, 'receipt-1.json'))).id).toBe('receipt-1');
    } finally {rename.mockRestore(); fs.rmSync(dir, { recursive: true, force: true });}
  });
  windowsTest('persistent publish failure stays bounded and cleanup cannot mask it', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'receipt-conflict-'));
    const original = Object.assign(new Error('publish denied'), { code: 'EACCES' });
    const rename = jest.spyOn(fs, 'renameSync').mockImplementation(() => {throw original;});
    const unlink = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {
      throw Object.assign(new Error('cleanup locked'), { code: 'EBUSY' });
    });
    try {
      expect(() => writeReceipt(dir, { id: 'receipt-1' })).toThrow(original);
      expect(rename).toHaveBeenCalledTimes(6);
      expect(unlink).toHaveBeenCalledTimes(6);
      expect(fs.existsSync(path.join(dir, 'receipt-1.json'))).toBe(false);
    } finally {rename.mockRestore(); unlink.mockRestore(); fs.rmSync(dir, { recursive: true, force: true });}
  });
});
