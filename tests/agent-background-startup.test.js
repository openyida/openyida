'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { launchBackgroundRuntime } = require('../lib/agent/stdio');
const { writeStartupReceipt } = require('./helpers/agent-startup-receipt');

describe('background runtime readiness', () => {
  jest.setTimeout(process.platform === 'win32' ? 20000 : 5000);
  let root; let children;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'oya-start-')); children = new Set(); });
  afterEach(async () => {
    await Promise.all([...children].map(child => new Promise(resolve => {
      child.once('close', resolve); child.kill('SIGKILL');
    })));
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  });
  function fixture(body) {
    const executable = path.join(root, 'runtime.js');
    fs.writeFileSync(executable, `const fs=require('fs'),path=require('path');let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{const c=JSON.parse(input);${body}});`);
    const config = { command: 'run', stateDir: root, node: { packageRoot: root } };
    const options = { startupTimeoutMs: process.platform === 'win32' ? 5000 : 1500, stopTimeoutMs: 200,
      spawn: (file, args, opts) => {
        const child = spawn(process.execPath, [file, ...args], opts);
        children.add(child); child.once('close', () => children.delete(child)); return child;
      } };
    return { runtime: { executable }, config, options };
  }
  const ready = `(${writeStartupReceipt})(c);`;
  test('waits for readiness and leaves the child running with log descriptors', async () => {
    const f = fixture(`setTimeout(()=>{${ready}},150);setInterval(()=>{},1000);`);
    let settled = false;
    const started = launchBackgroundRuntime(f.runtime, f.config, f.options).then(value => { settled = true; return value; });
    await new Promise(resolve => setTimeout(resolve, 70));
    expect(settled).toBe(false);
    const result = await started;
    expect(process.kill(result.pid, 0)).toBe(true);
    expect(fs.readdirSync(root).filter(name => name.startsWith('startup-'))).toEqual([]);
  });
  test('ignores an incomplete staged receipt until it is atomically published', async () => {
    const f = fixture(`const pending=path.join(c.stateDir,'.startup-'+c.startupId+'.json.tmp');fs.writeFileSync(pending,'{',{mode:0o600});fs.writeFileSync(path.join(c.stateDir,'staged-ready'),'ready');const gate=setInterval(()=>{if(fs.existsSync(path.join(c.stateDir,'publish-ready'))){clearInterval(gate);${ready}}},25);setInterval(()=>{},1000);`);
    let settled = false;
    const started = launchBackgroundRuntime(f.runtime, f.config, f.options);
    // Attach both handlers immediately, including when a regression rejects early.
    started.then(() => { settled = true; }, () => { settled = true; });
    const deadline = Date.now() + f.options.startupTimeoutMs;
    let pending;
    while (!pending && !settled && Date.now() < deadline) {
      if (fs.existsSync(path.join(root, 'staged-ready'))) {pending = fs.readdirSync(root).find(name => name.endsWith('.json.tmp'));}
      if (!pending) {await new Promise(resolve => setTimeout(resolve, 25));}
    }
    expect(pending).toBeDefined();
    expect(fs.readFileSync(path.join(root, pending), 'utf8')).toBe('{');
    // Leave the partial write visible for several launcher polling intervals.
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(settled).toBe(false);
    fs.writeFileSync(path.join(root, 'publish-ready'), 'go');
    const result = await started;
    expect(process.kill(result.pid, 0)).toBe(true);
    expect(fs.readdirSync(root).filter(name => name.includes('startup-'))).toEqual([]);
  });
  test('the daemon survives a launcher that exits after readiness', async () => {
    const f = fixture(`fs.writeFileSync(path.join(c.stateDir,'daemon.pid'),String(process.pid));${ready}setInterval(()=>{if(fs.existsSync(path.join(c.stateDir,'stop-fixture'))){process.chdir(require('os').tmpdir());process.exit(0);}},25);`);
    const script = `const {spawn}=require('child_process');const {launchBackgroundRuntime}=require(${JSON.stringify(require.resolve('../lib/agent/stdio'))});launchBackgroundRuntime(${JSON.stringify(f.runtime)},${JSON.stringify(f.config)},{spawn:(file,args,opts)=>spawn(process.execPath,[file,...args],opts)}).then(r=>console.log(r.pid)).catch(()=>process.exitCode=1);`;
    const launcher = spawn(process.execPath, ['-e', script]);
    children.add(launcher); launcher.once('close', () => children.delete(launcher));
    let daemonExited = false;
    try {
      const exitCode = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('launcher retained daemon handles')), process.platform === 'win32' ? 10000 : 3000);
        launcher.once('close', code => { clearTimeout(timeout); resolve(code); });
        launcher.once('error', error => { clearTimeout(timeout); reject(error); });
      });
      expect(exitCode).toBe(0);
      const pid = Number(fs.readFileSync(path.join(root, 'daemon.pid'), 'utf8'));
      expect(process.kill(pid, 0)).toBe(true);
    } finally {
      const pidFile = path.join(root, 'daemon.pid');
      if (fs.existsSync(pidFile)) {
        const pid = Number(fs.readFileSync(pidFile, 'utf8'));
        fs.writeFileSync(path.join(root, 'stop-fixture'), 'stop');
        if (process.platform === 'win32') {
          await new Promise((resolve, reject) => execFile(path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
            ['-NoProfile', '-NonInteractive', '-Command', '$p=Get-Process -Id ' + pid + " -ErrorAction SilentlyContinue;if($p -and !$p.WaitForExit(10000)){throw 'Owned daemon did not exit'};exit 0"],
            {windowsHide:true, timeout:15000}, (error) => error ? reject(error) : resolve()));
          daemonExited = true;
        } else {
          const deadline = Date.now() + 5000;
          while (Date.now() < deadline) {
            try {process.kill(pid, 0);} catch {daemonExited = true; break;}
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
      }
    }
    expect(daemonExited).toBe(true);
  });
  test.each([0, 1])('an immediate exit (%s) is never connected', async (code) => {
    const f = fixture(`process.exit(${code});`);
    await expect(launchBackgroundRuntime(f.runtime, f.config, f.options)).rejects.toMatchObject({ code: 'AGENT_RUNTIME_START_FAILED' });
    expect(children.size).toBe(0);
  });
  test('spawn failure rejects instead of reporting success', async () => {
    const f = fixture('');
    await expect(launchBackgroundRuntime({ executable: path.join(root, 'missing') }, f.config, { startupTimeoutMs: 500 }))
      .rejects.toMatchObject({ code: 'AGENT_RUNTIME_START_FAILED' });
  });
  test('logs and stale receipts cannot spoof readiness; timeout stops the child', async () => {
    const f = fixture('console.log(JSON.stringify({type:\'ready\',ready:true}));setInterval(()=>{},1000);');
    fs.writeFileSync(path.join(root, 'startup-old.json'), JSON.stringify({ protocolVersion: 1, startupId: 'old', ready: true }));
    await expect(launchBackgroundRuntime(f.runtime, f.config, { ...f.options, startupTimeoutMs: 250 }))
      .rejects.toMatchObject({ code: 'AGENT_RUNTIME_START_TIMEOUT' });
    expect(children.size).toBe(0);
  });
  test.each(['false', '"yes"'])('non-ready receipt (%s) rejects and stops the child', async (value) => {
    const f = fixture(`(${writeStartupReceipt})(c,${value});setInterval(()=>{},1000);`);
    await expect(launchBackgroundRuntime(f.runtime, f.config, f.options)).rejects.toMatchObject({ code: 'AGENT_RUNTIME_START_FAILED' });
    expect(children.size).toBe(0);
  });
});
