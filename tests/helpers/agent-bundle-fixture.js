'use strict';

const fs = require('fs');
const path = require('path');
const { digest, resolveRuntime } = require('../../lib/agent/runtime-package');

function createBundleFixture(root) {
  function write(relative, content, mode = 0o600) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    fs.writeFileSync(target, content, { mode });
  }
  write('package/package.json', JSON.stringify({ name: 'openyida', version: '2026.9.7', dependencies: { 'fixture-a': '1.0.0' }, devDependencies: { 'never-copy-dev': '1.0.0' } }));
  write('package/bin/yida.js', "const fs=require('fs');const path=require('path');console.log(JSON.stringify({dependency:require('fixture-a'),skill:fs.readFileSync(path.join(__dirname,'../yida-skills/SKILL.md'),'utf8')}));\n", 0o700);
  write('package/lib/fixture.js', "module.exports='only-fixture';\n");
  write('package/lib/\uE000.js', '// UTF-8 order: private-use before astral.\n');
  write('package/lib/\u{10000}.js', '// UTF-16 would incorrectly sort this first.\n');
  write('package/yida-skills/SKILL.md', 'frozen skill v1\n');
  write('package/node_modules/fixture-a/package.json', JSON.stringify({ name: 'fixture-a', version: '1.0.0', main: 'index.js', dependencies: { 'fixture-b': '1.0.0' } }));
  write('package/node_modules/fixture-a/index.js', "module.exports='a/'+require('fixture-b');\n");
  write('package/node_modules/fixture-b/package.json', JSON.stringify({ name: 'fixture-b', version: '1.0.0', main: 'index.js', dependencies: { 'fixture-a': '1.0.0' } }));
  write('package/node_modules/fixture-b/index.js', "module.exports='b-v1';\n");
  write('package/node_modules/never-copy-dev/index.js', 'SECRET_DEV_FIXTURE');
  write('package/project/user-login.json', 'SECRET_USER_FIXTURE');
  write('package/.git/config', 'SECRET_CHECKOUT_FIXTURE');
  const source = `#!${process.execPath}\nlet input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{let c=JSON.parse(input);console.log(JSON.stringify({type:c.command,config:c}));});\n`;
  write('fake-runtime', source, 0o700);
  write('runtime-manifest.json', JSON.stringify({ schemaVersion: 1, version: '0.1.0-dev', protocolVersion: 1, platform: process.platform, arch: process.arch,
    binary: { file: 'fake-runtime', sha256: digest(Buffer.from(source)) } }));
  const runtimePath = path.join(root, 'fake-runtime');
  const manifestPath = path.join(root, 'runtime-manifest.json');
  return {
    runtimePath, manifestPath,
    runtime: resolveRuntime({ developmentRuntime: true, runtimePath, manifestPath }),
    config: { protocolVersion: 1, command: 'run', developmentRuntime: true, stateDir: path.join(root, 'state'),
      node: { executable: process.execPath, packageRoot: path.join(root, 'package'), cliEntry: path.join(root, 'package/bin/yida.js'), version: '2026.9.7' }, providers: [] },
  };
}

function removeFixture(root) {
  function writable(directory) {
    if (!fs.existsSync(directory)) {return;}
    fs.chmodSync(directory, 0o700);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.isSymbolicLink()) {writable(path.join(directory, entry.name));}
    }
  }
  writable(root);
  fs.rmSync(root, { recursive: true, force: true });
}

module.exports = { createBundleFixture, removeFixture };
