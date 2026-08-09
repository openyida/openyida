'use strict';

const CANVAS_YIDA_API_METHODS = Object.freeze([
  'saveFormData',
  'updateFormData',
  'deleteFormData',
  'getFormDataById',
  'searchFormDatas',
  'searchFormDataIds',
  'getFormComponentDefinationList',
  'startProcessInstance',
  'updateProcessInstance',
  'deleteProcessInstance',
  'getProcessInstances',
  'getProcessInstanceIds',
  'getProcessInstanceById',
]);

const CANVAS_YIDA_QUERY_METHODS = Object.freeze([
  'searchFormDatas',
  'searchFormDataIds',
  'getProcessInstances',
  'getProcessInstanceIds',
]);

module.exports = {
  CANVAS_YIDA_API_METHODS,
  CANVAS_YIDA_QUERY_METHODS,
};
