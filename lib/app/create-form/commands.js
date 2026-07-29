'use strict';

function dispatchCreateFormCommand(parsedArgs, authContext, handlers) {
  const args = [parsedArgs, authContext];

  switch (parsedArgs.mode) {
    case 'update':
      return handlers.update(...args);
    case 'patch':
      return handlers.patch(...args);
    case 'rule':
      return handlers.rule(...args);
    case 'validation':
      return handlers.validation(...args);
    case 'bind-datasource':
      return handlers.bindDataSource(...args);
    case 'add-option':
      return handlers.addOption(...args);
    case 'validate-fields':
      return handlers.validateFields(...args);
    case 'create':
      return handlers.create(...args);
    default:
      if (parsedArgs.mode && parsedArgs.mode !== 'create') {
        throw new Error('Unknown create-form mode: ' + parsedArgs.mode);
      }
      return handlers.create(...args);
  }
}

module.exports = {
  dispatchCreateFormCommand,
};
