'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

describe('ordinary CLI is independent from optional local runtime packages', () => {
  let root;
  beforeEach(() => {root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-package-boundary-'));});
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
  test.each([['--version'], ['--help'], ['commands', '--json']])('%j needs no runtime resolution, spawn or download', (...args) => {
    const entry = path.resolve(__dirname, '../bin/yida.js');
    const code = `const fail=()=>{throw new Error('unexpected process/network access');};const cp=require('child_process');for(const key of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])cp[key]=fail;for(const name of ['http','https']){const module=require(name);module.get=fail;module.request=fail;}global.fetch=fail;const Module=require('module'),load=Module._load;Module._load=function(name,...rest){if(/agent[\\/]runtime-package|agent[\\/]frozen-bundle/.test(name))throw new Error('unexpected runtime module');return load.call(this,name,...rest);};process.argv=${JSON.stringify([process.execPath, entry, ...args])};require(${JSON.stringify(entry)});`;
    const output = execFileSync(process.execPath, ['-e', code], { encoding: 'utf8', env: {
      HOME: root, USERPROFILE: root, OPENYIDA_AUTH_DIR: path.join(root, 'auth'), OPENYIDA_LANG: 'en',
      OPENYIDA_AGENT_RUNTIME_PATH: '/invalid-not-used', OPENYIDA_AGENT_RUNTIME_MANIFEST: '/invalid-not-used',
    } });
    expect(output.length).toBeGreaterThan(0);
  });
});
