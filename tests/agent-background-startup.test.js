'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { launchBackgroundRuntime } = require('../lib/agent/stdio');

describe('background runtime readiness', () => {
  let root; let children;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'oya-start-')); children = new Set(); });
  afterEach(async () => {
    await Promise.all([...children].map(child => new Promise(resolve => {
      child.once('close', resolve); child.kill('SIGKILL');
    })));
    fs.rmSync(root, { recursive: true, force: true });
  });
  function fixture(body) {
    const executable = path.join(root, 'runtime.js');
    fs.writeFileSync(executable, `const fs=require('fs'),path=require('path');let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{const c=JSON.parse(input);${body}});`);
    const config = { command: 'run', stateDir: root, node: { packageRoot: root } };
    const options = { startupTimeoutMs: 1500, stopTimeoutMs: 200,
      spawn: (file, args, opts) => {
        const child = spawn(process.execPath, [file, ...args], opts);
        children.add(child); child.once('close', () => children.delete(child)); return child;
      } };
    return { runtime: { executable }, config, options };
  }
  const ready = 'fs.writeFileSync(path.join(c.stateDir,\'startup-\'+c.startupId+\'.json\'),JSON.stringify({protocolVersion:1,startupId:c.startupId,ready:true}),{mode:0o600});';
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
  test('the daemon survives a launcher that exits after readiness', async () => {
    const f = fixture(`fs.writeFileSync(path.join(c.stateDir,'daemon.pid'),String(process.pid));${ready}setInterval(()=>{},1000);`);
    const script = `const {spawn}=require('child_process');const {launchBackgroundRuntime}=require(${JSON.stringify(require.resolve('../lib/agent/stdio'))});launchBackgroundRuntime(${JSON.stringify(f.runtime)},${JSON.stringify(f.config)},{spawn:(file,args,opts)=>spawn(process.execPath,[file,...args],opts)}).then(r=>console.log(r.pid)).catch(()=>process.exitCode=1);`;
    const launcher = spawn(process.execPath, ['-e', script]);
    children.add(launcher); launcher.once('close', () => children.delete(launcher));
    try {
      const exitCode = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('launcher retained daemon handles')), 3000);
        launcher.once('close', code => { clearTimeout(timeout); resolve(code); });
        launcher.once('error', error => { clearTimeout(timeout); reject(error); });
      });
      expect(exitCode).toBe(0);
      const pid = Number(fs.readFileSync(path.join(root, 'daemon.pid'), 'utf8'));
      expect(process.kill(pid, 0)).toBe(true);
    } finally {
      try {process.kill(Number(fs.readFileSync(path.join(root, 'daemon.pid'), 'utf8')), 'SIGTERM');} catch { /* child failed before recording its pid */ }
    }
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
    const f = fixture(`${ready.replace('ready:true', 'ready:' + value)}setInterval(()=>{},1000);`);
    await expect(launchBackgroundRuntime(f.runtime, f.config, f.options)).rejects.toMatchObject({ code: 'AGENT_RUNTIME_START_FAILED' });
    expect(children.size).toBe(0);
  });
});
