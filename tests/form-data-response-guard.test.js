const { assertFormDataResponse } = require('../lib/app/form-data-response-guard');
const { compileCanvasLocal } = require('../lib/app/canvas-compile');
const page = body => `import React from 'react'; function YidaComp(){ async function load(){const api=window.__OPENYIDA_YIDA_API__; const res=await api.searchFormDatas({formUuid:'FORM',currentPage:1}); ${body}} return <button onClick={load}>Load</button>;}`;
test('rejects the observed silent empty-list bug at the publish compiler boundary', () => {
  expect(() => compileCanvasLocal(page('return res.data.data || [];'))).toThrow(expect.objectContaining({ code: 'OPENYIDA_FORM_DATA_RESPONSE_INVALID' }));
});
test.each(['return res.data || [];', 'return Array.isArray(res.data) ? res.data : res.data.data || [];'])('accepts array-aware bridge consumption: %s', body => {
  expect(() => assertFormDataResponse(page(body))).not.toThrow();
});
test('does not infer contracts for other adapters or shadowed results', () => {
  expect(() => assertFormDataResponse('async function f(api){const res=await api.searchFormDatas({});return res.data.data;}')).not.toThrow();
  expect(() => assertFormDataResponse(page('function g(res){return res.data.data;} return res.data;'))).not.toThrow();
});

test('does not apply the global bridge contract to another object or a shadowed window', () => {
  expect(() => assertFormDataResponse('async function f(adapter){const api=adapter.__OPENYIDA_YIDA_API__;const res=await api.searchFormDatas({});return res.data.data;}')).not.toThrow();
  expect(() => assertFormDataResponse('async function f(window){const api=window.__OPENYIDA_YIDA_API__;const res=await api.searchFormDatas({});return res.data.data;}')).not.toThrow();
});
