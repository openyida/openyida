const { assertFormDataResponse } = require('../lib/app/form-data-response-guard');
const { compileCanvasLocal } = require('../lib/app/canvas-compile');
const fs = require('fs');
const path = require('path');
const fragment = fs.readFileSync(path.join(__dirname, '../lib/samples/openyida-scaffold/canvas-data-source.jsx'), 'utf8');
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

test.each([
  'function unsafe(value){try{return parseCanvasAssociationValue(value);}catch(error){return [];}}',
  'const decode=parseCanvasAssociationValue; const unsafe=(value)=>{try{return decode(value);}catch{return [];}};',
])('rejects the reproduced catch-and-empty-array wrapper, including a constant alias', unsafe => {
  const code = `${fragment}\n${unsafe}\nfunction YidaComp(){return <div>{unsafe('bad').length}</div>;}`;
  expect(() => compileCanvasLocal(code)).toThrow(expect.objectContaining({ code: 'OPENYIDA_ASSOCIATION_DATA_INVALID' }));
});

test.each([
  'function safe(value){try{return parseCanvasAssociationValue(value);}catch(error){throw error;}}',
  'function safe(value){try{return parseCanvasAssociationValue(value);}catch(error){return {status:"error",error};}}',
  'function other(parseCanvasAssociationValue,value){try{return parseCanvasAssociationValue(value);}catch{return [];}}',
  'function other(value){try{function deferred(){return parseCanvasAssociationValue(value);}return deferred;}catch{return [];}}',
  'function outer(value){try{try{return parseCanvasAssociationValue(value);}catch(error){return {error};}}catch{return [];}}',
  'function final(value){try{return parseCanvasAssociationValue(value);}catch{return [];}finally{return {status:"error"};}}',
])('does not reject explicit errors, shadowed functions or unrelated catches', body => {
  expect(() => assertFormDataResponse(`${fragment}\n${body}`)).not.toThrow();
});

test('does not guess the contract of an unrelated function sharing the parser name', () => {
  expect(() => assertFormDataResponse('function parseCanvasAssociationValue(v){return v;} function f(v){try{return parseCanvasAssociationValue(v);}catch{return [];}}'))
    .not.toThrow();
});

test.each([
  'row.formData.associationFormField_customer_id',
  'String(row.formData["associationFormField_customer_id"])',
  '`客户：${row.formData.associationFormField_customer_id}`',
  'raw',
])('rejects directly rendering a known association field: %s', expression => {
  const code = `import React from 'react'; function YidaComp(){const row={formData:{associationFormField_customer_id:'raw'}}; const raw=row.formData.associationFormField_customer_id; return <span>{${expression}}</span>;}`;
  expect(() => compileCanvasLocal(code)).toThrow(expect.objectContaining({ code: 'OPENYIDA_ASSOCIATION_DATA_INVALID' }));
});

test.each([
  'function YidaComp(){return <span>{row.formData.textField_note}</span>;}',
  'function YidaComp(){return <span>{adapter.associationFormField_customer_id}</span>;}',
  'function YidaComp(){return <pre>{row.formData.associationFormField_customer_id}</pre>;}',
  'function YidaComp(){return <span>{renderCustomer(row.formData.associationFormField_customer_id)}</span>;}',
  'function YidaComp(){return <AssociationField value={row.formData.associationFormField_customer_id} />;}',
  'function YidaComp(){return <AssociationField>{row.formData.associationFormField_customer_id}</AssociationField>;}',
  'function YidaComp(){return <x-association>{row.formData.associationFormField_customer_id}</x-association>;}',
])('keeps ordinary text, unknown adapters, debug output and custom renderers outside this narrow rule', source => {
  expect(() => assertFormDataResponse(source)).not.toThrow();
});
