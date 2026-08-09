'use strict';

const formCompiler = require('./form-compiler');

function buildFormSchema(formTitle, fields, formUuid, corpId, appType, layout, theme, labelAlign, options) {
  return formCompiler.buildFormSchema(
    formTitle,
    fields,
    formUuid,
    corpId,
    appType,
    layout,
    theme,
    labelAlign,
    options
  );
}

function buildEmptyFormSchema() {
  return formCompiler.buildEmptyFormSchema();
}

function compileFormDefinition(definition, options) {
  return formCompiler.compileFormDefinition(definition, options);
}

module.exports = {
  buildEmptyFormSchema,
  buildFormSchema,
  compileFormDefinition,
};
