'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');
const { run } = require('../lib/core/sample');

/** Load the exact CLI-emitted sample with a minimal React renderer, without a browser or platform writes. */
async function loadSample(name, win = { location: { hash: '#/tasks?owner=m2' }, addEventListener() {}, removeEventListener() {} }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-layout-'));
  const file = path.join(root, 'layout.jsx');
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await run(['yida-code-workspace', name, '--output', file]);
    const code = babel.transformSync(fs.readFileSync(file, 'utf8'), {
      configFile: false, babelrc: false, presets: [['@babel/preset-react', { runtime: 'classic' }]],
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    }).code;
    const react = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
      useState: init => [init(), () => {}], useEffect: fn => fn() };
    const module = { exports: {} };
    vm.runInNewContext(code, { module, exports: module.exports, require: () => react, URLSearchParams, window: win });
    return module.exports;
  } finally { log.mockRestore(); fs.rmSync(root, { recursive: true, force: true }); }
}

test('native page layout renders its own content with no application sidebar', async () => {
  const { WorkspacePageLayout } = await loadSample('native-pages');
  const tree = WorkspacePageLayout({ title: 'Tasks', children: 'task-table' });
  expect(tree.type).toBe('main');
  expect(tree.children).toContain('task-table');
  expect(JSON.stringify(tree)).not.toContain('"nav"');
  expect(JSON.stringify(tree)).not.toContain('"iframe"');
});

test('single page resolves only declared local views and preserves view parameters', async () => {
  const { readWorkspaceView, workspaceViewHref } = await loadSample('single-page');
  const routes = [{ key: 'overview', title: 'Overview' }, { key: 'tasks', title: 'Tasks' }];
  const result = readWorkspaceView(workspaceViewHref('tasks', { owner: 'm2' }), routes, 'overview');
  expect(result.key).toBe('tasks');
  expect(result.params.get('owner')).toBe('m2');
  expect(readWorkspaceView('#/unknown', routes, 'overview').key).toBe('overview');
  expect(readWorkspaceView('#/%ZZ', routes, 'overview').key).toBe('overview');
});

test('single page mounts one selected view and subscribes to local history changes', async () => {
  const events = [];
  const win = { location: { hash: '#/tasks' }, addEventListener: name => events.push(name), removeEventListener() {} };
  const { WorkspaceApplication } = await loadSample('single-page', win);
  const renderView = jest.fn(view => 'view:' + view.key);
  const tree = WorkspaceApplication({ title: 'Demo', routes: [{ key: 'overview', title: 'Overview' }, { key: 'tasks', title: 'Tasks' }], defaultView: 'overview', renderView });
  expect(events).toEqual(['hashchange']);
  expect(renderView).toHaveBeenCalledTimes(1);
  expect(renderView.mock.calls[0][0].key).toBe('tasks');
  expect(JSON.stringify(tree)).not.toContain('"iframe"');
});
