'use strict';

function deleteFixture(retrieveType = 'batch') {
  return {
    nodes: [
      { id: 'targetRows', type: 'dataRetrieve', formUuid: 'FORM-TARGET', retrieveType, quantity: retrieveType === 'batch' ? 2 : 1,
        filterType: 'condition', conditions: [
          { fieldId: 'textField_batch', componentType: 'TextField', opCode: 'Equal', valueType: 'literal', value: 'batch-A' },
        ] },
      { id: 'deleteRows', type: 'dataDelete', source: 'targetRows' },
    ],
  };
}

const deleteSchemas = new Map([
  ['FORM-TARGET', [{ componentName: 'TextField', props: { fieldId: 'textField_batch', label: '批次' } }]],
]);

module.exports = { deleteFixture, deleteSchemas };
