'use strict';

const {
  findCanvasSourceIssues,
  formatCanvasSourceIssue,
  assertCanvasSourceContracts,
} = require('../lib/app/canvas-source-guard');

describe('canvas source guard', () => {
  test('blocks direct field reads from searchFormDatas rows', () => {
    const source = `
import React from 'react';

const FIELDS = { apartment: { name: 'textField_name' } };

export default function Page() {
  const rows = [];
  React.useEffect(function () {
    window.__OPENYIDA_YIDA_API__.searchFormDatas({ formUuid: 'FORM-X', currentPage: 1, pageSize: 20, searchFieldJson: '' });
  }, []);
  return rows.map(function (apt) {
    return <div>{apt[FIELDS.apartment.name]}</div>;
  });
}
`;

    const issues = findCanvasSourceIssues(source);

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'form-row-direct-field-read',
        expression: 'apt[FIELDS.apartment.name]',
        fieldExpression: 'FIELDS.apartment.name',
        line: 12,
      }),
    ]));
    expect(formatCanvasSourceIssue(issues.find(issue => issue.type === 'form-row-direct-field-read')))
      .toContain('row.formData[fieldId]');
    expect(() => assertCanvasSourceContracts(source, { sourcePath: '/tmp/page.canvas.jsx' }))
      .toThrow(/OPENYIDA_CANVAS_FORM_ROW_DIRECT_FIELD_READ|searchFormDatas/);
  });

  test('allows fieldOf helper and explicit row.formData reads', () => {
    const source = `
import React from 'react';

const FIELDS = { apartment: { name: 'textField_name' } };

function fieldOf(row, fieldId) {
  return ((row && row.formData) || {})[fieldId];
}

export default function Page() {
  const rows = [];
  React.useEffect(function () {
    window.__OPENYIDA_YIDA_API__.searchFormDatas({ formUuid: 'FORM-X', currentPage: 1, pageSize: 20, searchFieldJson: '' });
  }, []);
  return rows.map(function (row) {
    return <div>{fieldOf(row, FIELDS.apartment.name)} {row.formData[FIELDS.apartment.name]}</div>;
  });
}
`;

    expect(findCanvasSourceIssues(source).map(issue => issue.type))
      .not.toContain('form-row-direct-field-read');
  });
});
