'use strict';

const FORM_DID_MOUNT_ACTION_NAME = 'didMount';

function buildFormConstructorCode() {
  return "function constructor() {\nvar module = { exports: {} };\nvar _this = this;\nthis.__initMethods__(module.exports, module);\nObject.keys(module.exports).forEach(function(item) {\n  if(typeof module.exports[item] === 'function'){\n    _this[item] = module.exports[item];\n  }\n});\n\n}";
}

function buildFormActionsSource() {
  return 'export function didMount() {\n  console.log(`「页面 JS」：当前页面地址 ${location.href}`);\n}';
}

function buildFormActionsCompiled() {
  return '"use strict";\n\nexports.__esModule = true;\nexports.didMount = didMount;\nfunction didMount() {\n  console.log("\\u300C\\u9875\\u9762 JS\\u300D\\uFF1A\\u5F53\\u524D\\u9875\\u9762\\u5730\\u5740 " + location.href);\n}\n';
}

function buildFormActionsModule() {
  return {
    compiled: buildFormActionsCompiled(),
    source: buildFormActionsSource(),
  };
}

function buildFormActionListItem(nextNodeId) {
  const id = typeof nextNodeId === 'function' ? nextNodeId() : FORM_DID_MOUNT_ACTION_NAME;
  return {
    id,
    type: 'lifeCycleEvent',
    name: FORM_DID_MOUNT_ACTION_NAME,
    relatedEventId: 'lifecycle:didMount',
    params: {},
  };
}

function buildFormDidMountLifecycle() {
  return {
    name: FORM_DID_MOUNT_ACTION_NAME,
    id: FORM_DID_MOUNT_ACTION_NAME,
    params: {},
    type: 'actionRef',
  };
}

module.exports = {
  FORM_DID_MOUNT_ACTION_NAME,
  buildFormActionListItem,
  buildFormActionsCompiled,
  buildFormActionsModule,
  buildFormActionsSource,
  buildFormConstructorCode,
  buildFormDidMountLifecycle,
};
