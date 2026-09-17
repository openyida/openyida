#!/usr/bin/env node
'use strict';

// Maintainer-only: execute reviewed runtime bundles, never page source. The VM
// is a convenient browser shim, NOT a security boundary for untrusted files.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const assets = {
  react: 'https://g.alicdn.com/code/lib/react/18.3.1/umd/react.development.js',
  'lucide-react': 'https://g.alicdn.com/yida-components/yida-plugin-ui-shared/0.0.1/lucideReact.js',
  '@ant-design/icons': 'https://g.alicdn.com/code/lib/ant-design-icons/5.5.1/index.umd.min.js',
};

function generateManifest(directory) {
  const sandbox = {
    URL, URLSearchParams, setTimeout, clearTimeout,
    console: { log() {}, warn() {}, error() {} },
    location: { href: 'https://www.aliwork.com/' },
    document: {
      currentScript: { tagName: 'SCRIPT', src: assets['lucide-react'] },
      getElementsByTagName: () => [],
    },
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  const bundles = {};
  for (const [name, filename] of Object.entries({ react: 'react.js', 'lucide-react': 'lucideReact.js', '@ant-design/icons': 'antDesignIcons.js' })) {
    const source = fs.readFileSync(path.join(directory, filename));
    bundles[name] = { assetUrl: assets[name], sha256: crypto.createHash('sha256').update(source).digest('hex') };
    vm.runInContext(source.toString('utf8'), sandbox, { timeout: 10000, filename });
  }
  const packages = {};
  for (const [name, globalName] of Object.entries({ 'lucide-react': 'LucideReact', '@ant-design/icons': 'icons' })) {
    const exports = Object.keys(sandbox[globalName] || {}).filter(key => sandbox[globalName][key] !== undefined).sort();
    if (exports.length < 100 || !sandbox[globalName][name === 'lucide-react' ? 'Landmark' : 'HomeOutlined']) {
      throw new Error(`Missing runtime exports: ${name}`);
    }
    packages[name] = { ...bundles[name], globalName, exports };
  }
  if (!sandbox.DynamicIcon) { throw new Error('Missing DynamicIcon runtime'); }
  packages['lucide-react'].specialNamedExports = { DynamicIcon: 'DynamicIcon' };
  return { schemaVersion: 1, react: bundles.react, packages };
}

if (require.main === module) {
  const directory = process.argv[2];
  if (!directory) { throw new Error('Usage: node scripts/update-canvas-icon-exports.js <reviewed-bundle-directory>'); }
  const manifest = generateManifest(directory);
  fs.writeFileSync(path.join(__dirname, '../lib/app/canvas-icon-exports.json'), JSON.stringify(manifest, null, 2) + '\n');
}

module.exports = { generateManifest };
