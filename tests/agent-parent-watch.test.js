'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const { PassThrough } = require('stream');
const { launchRuntime } = require('../lib/agent/stdio');
const { removeFixture } = require('./helpers/agent-bundle-fixture');

describe('runtime parent-watch and bounded stop contract (fake processes only)', () => {
  let root, outer, fakePid;
  beforeEach(() => {root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-parent-watch-'));});
  afterEach(() => {
    jest.useRealTimers();
    if (outer && outer.exitCode === null && outer.signalCode === null) {outer.kill('SIGKILL');}
    if (fakePid) {try {process.kill(fakePid, 'SIGKILL');} catch { /* Owned fake already exited. */ }}
    removeFixture(root);
  });
  test('config stdin EOF does not stop runtime; Node death closes only the separate watch pipe', async () => {
    const binary = path.join(root, 'fake-runtime');
    const receipt = path.join(root, 'parent-ended.json');
    const source = `#!${process.execPath}\nconst fs=require('fs');let text='';process.stdin.on('data',c=>text+=c);process.stdin.on('end',()=>{const c=JSON.parse(text);const watch=fs.createReadStream(null,{fd:c.parentWatchFD,autoClose:false});watch.on('end',()=>{fs.writeFileSync(${JSON.stringify(receipt)},JSON.stringify({parentEOF:true,notCompletion:true}));process.exit(0);});watch.resume();console.log(JSON.stringify({type:'ready',pid:process.pid,stdinEnded:true,watchFD:c.parentWatchFD}));});\n`;
    fs.writeFileSync(binary, source, { mode: 0o700 });
    const modulePath = path.resolve(__dirname, '../lib/agent/stdio.js');
    const config = { command: 'run', protocolVersion: 1, developmentRuntime: true, node: { packageRoot: root } };
    const code = `require(${JSON.stringify(modulePath)}).launchRuntime({executable:${JSON.stringify(binary)}},${JSON.stringify(config)}).catch(()=>{process.exitCode=1;});`;
    outer = spawn(process.execPath, ['-e', code], { stdio: ['ignore', 'pipe', 'pipe'] });
    const event = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('fake readiness timed out')), 5000);
      let text = '';
      outer.stdout.on('data', (chunk) => {
        text += chunk;
        if (text.includes('\n')) {clearTimeout(timeout); resolve(JSON.parse(text.split('\n')[0]));}
      });
      outer.once('error', (error) => {clearTimeout(timeout); reject(error);});
    });
    fakePid = event.pid;
    expect(event).toMatchObject({ type: 'ready', stdinEnded: true, watchFD: 3 });
    expect(fs.existsSync(receipt)).toBe(false);
    outer.kill('SIGKILL');
    await new Promise((resolve, reject) => {
      const started = Date.now();
      const interval = setInterval(() => {
        if (fs.existsSync(receipt)) {clearInterval(interval); resolve();}
        else if (Date.now() - started > 5000) {clearInterval(interval); reject(new Error('fake never saw parent EOF'));}
      }, 10);
    });
    expect(JSON.parse(fs.readFileSync(receipt, 'utf8'))).toEqual({ parentEOF: true, notCompletion: true });
  });
  test('malformed output grants 15 seconds before force kill and reports unknown', async () => {
    jest.useFakeTimers();
    const child = new EventEmitter();
    child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.stdio = [child.stdin, child.stdout, child.stderr, new PassThrough()];
    child.kill = jest.fn();
    const signals = new EventEmitter();
    const spawnFake = jest.fn(() => child);
    const pending = launchRuntime({ executable: '/fake-only' }, { command: 'run', node: { packageRoot: root } }, { spawn: spawnFake, signals });
    const outcome = pending.catch((error) => error);
    expect(spawnFake.mock.calls[0][2].stdio).toEqual(['pipe', 'pipe', 'pipe', 'pipe']);
    expect(child.stdio[3].destroyed).toBe(false);
    child.stdout.write('not-json\n');
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    jest.advanceTimersByTime(14999);
    expect(child.kill).not.toHaveBeenCalledWith('SIGKILL');
    jest.advanceTimersByTime(1);
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    child.emit('close', null, 'SIGKILL');
    expect(await outcome).toMatchObject({ code: 'AGENT_RUNTIME_STOP_UNCONFIRMED', details: { executionState: 'unknown' } });
    expect(child.stdio[3].destroyed).toBe(true);
    expect(signals.listenerCount('SIGTERM')).toBe(0);
  });
});
