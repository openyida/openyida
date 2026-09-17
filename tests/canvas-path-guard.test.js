'use strict';

const { assertCanvasNavigationPaths } = require('../lib/app/canvas-path-guard');
const { compileCanvasLocal } = require('../lib/app/canvas-compile');

test.each([
  "window.open('/custom/FORM-a')",
  "window.location.href = '/submission/FORM-a'",
  'location.assign(`/workbench/${page}`)',
  "const path='/custom/' + page; window.open(path)",
  "const path='/custom/FORM-a'; const alias=path; utils.router.push(alias)",
  "utils.router.replace('/workbench')",
  "utils.openPage({url:'/formDetail/FORM-a?formInstId=123'})",
  'const x=<a href="/custom/FORM-a">预订</a>',
  "const x=<a href={ok ? '/custom/FORM-a' : '/APP_x/custom/FORM-b'}/>",
  "const x=<form action='/submission/FORM-a'/>",
  "const url=new URL('/custom/FORM-a',window.location.origin); window.open(url.href)",
])('blocks incomplete navigation destinations: %s', source => {
  expect(() => assertCanvasNavigationPaths(source, { sourcePath: 'page.canvas.jsx' })).toThrow(expect.objectContaining({
    code: 'OPENYIDA_CANVAS_PATH_MISSING_APP_TYPE', details: expect.objectContaining({ line: 1, sourcePath: 'page.canvas.jsx', expectedPath: '/{appType}/{pageType}/{formUuid}' }),
  }));
});

test.each([
  "window.open('/' + appType + '/custom/' + page)",
  'window.open(`/${appType}/custom/${page}`)',
  "window.open('/APP_x/custom/FORM-a')",
  "window.open('https://example.com/custom/catalog')",
  "const suffix='/custom/'; const url='/APP_x'+suffix+'FORM-a'; window.open(url)",
  "utils.router.push('FORM-a', {query:1})",
  "const doc='/custom/FORM-a'; console.log(doc)",
  "fetch('/custom/api')",
  "const x=<div data-example='/custom/a'/>",
  "const x=<a href='#booking'/>",
  'window.open(window.targetUrl)',
])('does not reject suffixes, documentation or unknown dynamic targets: %s', source => {
  expect(() => assertCanvasNavigationPaths(source)).not.toThrow();
});

test('compile calls path guard for real business handlers', () => {
  expect(() => compileCanvasLocal("function YidaComp(){return <button onClick={()=>window.open('/custom/FORM-a')}>预订</button>}"))
    .toThrow(expect.objectContaining({ code: 'OPENYIDA_CANVAS_PATH_MISSING_APP_TYPE' }));
});
