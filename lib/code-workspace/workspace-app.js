'use strict';

const path = require('path');
const { fail, sha256 } = require('./files');

const APP_TAG = 'WORKSPACE';
const ABI = 'yida-workspace/react-iife-v1';
const TOOLCHAIN = 'openyida/esbuild@0.25.12/iife-v1';

function requireWorkspaceRecipe(recipe) {
  if (recipe.runtimeAbi !== ABI || recipe.toolchainRef !== TOOLCHAIN ||
      Object.keys(recipe.entries).length !== 1 || !recipe.entries.main) {
    fail('WORKSPACE projects require the React WORKSPACE ABI, the pinned esbuild toolchain and one main entry');
  }
}

function workspaceUrl(baseUrl, appType, params = {}) {
  const url = new URL('/' + encodeURIComponent(appType) + '/workspace', baseUrl || 'https://workspace.invalid');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return baseUrl ? url.href : url.pathname + url.search;
}

function testUrl(api, appType, draftVersion) {
  return workspaceUrl(api.baseUrl, appType, { workspaceEnv: 'test', workspaceVersion: draftVersion });
}

function stableTestUrl(api, appType) {
  return workspaceUrl(api.baseUrl, appType) + '-test';
}

function pinnedTest(appType, link) {
  if (typeof link !== 'string' || !link) {
    fail('Unable to identify the current WORKSPACE test version', 'CODE_WORKSPACE_TEST_CONTEXT_UNAVAILABLE');
  }
  const url = new URL(link, 'https://workspace.invalid');
  const draftVersion = url.searchParams.get('workspaceVersion');
  if (url.pathname !== workspaceUrl(undefined, appType) || url.searchParams.get('workspaceEnv') !== 'test' ||
      !draftVersion) {
    fail('Unable to identify the current WORKSPACE test version', 'CODE_WORKSPACE_TEST_CONTEXT_UNAVAILABLE');
  }
  return draftVersion;
}

function previewUrl(api, appType, state, buildId) {
  return workspaceUrl(api.baseUrl, appType,
    { workspaceEnv: 'preview', sourceSnapshotId: state.sourceSnapshotId, buildId });
}

function workspaceCompilerPlugin(files, entry) {
  const aliases = {
    react: 'module.exports = window.React;',
    'react-dom': 'module.exports = window.ReactDOM;',
  };
  const loaders = { '.js': 'js', '.jsx': 'jsx', '.ts': 'ts', '.tsx': 'tsx', '.css': 'css', '.json': 'json' };
  const extensions = ['.tsx', '.ts', '.jsx', '.js', '.json', '.css'];
  return {
    name: 'workspace-source',
    setup(build) {
      build.onResolve({ filter: /^workspace-entry$/ }, args =>
        args.kind === 'entry-point' ? { path: args.path, namespace: 'workspace-entry' } : null);
      build.onLoad({ filter: /.*/, namespace: 'workspace-entry' }, () => ({
        contents: 'import Workspace from ' + JSON.stringify('./' + entry) + '; export default Workspace;',
        loader: 'js',
      }));
      build.onResolve({ filter: /.*/ }, args => {
        if (Object.hasOwn(aliases, args.path)) {
          return { path: args.path, namespace: 'workspace-runtime' };
        }
        if (!args.path.startsWith('./') && !args.path.startsWith('../') && !args.path.startsWith('@/')) {
          fail('Unsupported WORKSPACE import: ' + args.path);
        }
        const target = args.path.startsWith('@/') ? path.posix.join('src', args.path.slice(2))
          : path.posix.join(path.posix.dirname(args.importer), args.path);
        const candidates = [target, ...extensions.map(ext => target + ext),
          ...extensions.slice(0, 4).map(ext => path.posix.join(target, 'index' + ext))];
        const source = candidates.find(candidate => Object.hasOwn(files, candidate));
        if (!source) {
          fail('WORKSPACE import is outside the project, missing, or unsupported: ' + args.path);
        }
        return { path: source, namespace: 'workspace-source' };
      });
      build.onLoad({ filter: /.*/, namespace: 'workspace-runtime' }, args =>
        ({ contents: aliases[args.path], loader: 'js' }));
      build.onLoad({ filter: /.*/, namespace: 'workspace-source' }, args => {
        const loader = loaders[path.posix.extname(args.path).toLowerCase()];
        if (!loader) {
          fail('Unsupported WORKSPACE source file: ' + args.path);
        }
        return { contents: files[args.path], loader };
      });
    },
  };
}

async function compileWorkspace(files, recipe, state) {
  requireWorkspaceRecipe(recipe);
  const esbuild = require('esbuild-wasm');
  if (TOOLCHAIN !== 'openyida/esbuild@' + esbuild.version + '/iife-v1') {
    fail('Installed esbuild version does not match the WORKSPACE recipe');
  }
  const build = await esbuild.build({
    entryPoints: ['workspace-entry'],
    outfile: 'main.js',
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'YidaWorkspaceApp',
    platform: 'browser',
    target: 'es2017',
    jsx: 'transform',
    legalComments: 'none',
    logLevel: 'silent',
    logOverride: { 'unsupported-dynamic-import': 'error', 'unsupported-require-call': 'error' },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [workspaceCompilerPlugin(files, recipe.entries.main)],
  });
  const output = Object.create(null);
  const entry = { runtimeFiles: ['main.js'], cssFiles: [], assetFiles: [], importedModules: [] };
  const descriptors = build.outputFiles.map(file => {
    const name = path.basename(file.path);
    const content = Buffer.from(file.contents);
    output['files/' + name] = content;
    if (name === 'main.css') {
      entry.cssFiles.push(name);
    } else if (name !== 'main.js') {
      fail('Unsupported WORKSPACE build output: ' + name);
    }
    return { path: name, size: content.length, sha256: sha256(content),
      mediaType: name === 'main.js' ? 'application/javascript' : 'text/css', audience: 'runtime' };
  }).sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const manifest = {
    formatVersion: 2,
    workspaceId: state.workspaceId,
    sourceSnapshotId: state.sourceSnapshotId,
    runtimeAbi: ABI,
    files: descriptors,
    entries: { main: entry },
  };
  manifest.buildId = sha256(JSON.stringify(manifest)).slice(0, 32);
  output['runtime.manifest.json'] = Buffer.from(JSON.stringify(manifest));
  return output;
}

module.exports = { APP_TAG, ABI, TOOLCHAIN, compileWorkspace, requireWorkspaceRecipe, previewUrl, testUrl, stableTestUrl, workspaceUrl, pinnedTest };
