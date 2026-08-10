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

  test('blocks common Antd controls without real handlers', () => {
    const source = `
import React from 'react';
import { Segmented, Select, Tabs, Typography } from 'antd';

export default function Page() {
  return (
    <div>
      <Segmented options={['今日', '本周']} />
      <Select options={[]} />
      <Tabs items={[]} />
      <Typography.Link>查看全部</Typography.Link>
    </div>
  );
}
`;

    const issues = findCanvasSourceIssues(source);

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'missing-handler', elementName: 'Segmented' }),
      expect.objectContaining({ type: 'missing-handler', elementName: 'Select' }),
      expect.objectContaining({ type: 'missing-handler', elementName: 'Tabs' }),
      expect.objectContaining({ type: 'missing-handler', elementName: 'Typography.Link' }),
    ]));
  });

  test('allows controlled Antd controls and real links', () => {
    const source = `
import React from 'react';
import { Segmented, Select, Tabs, Typography } from 'antd';

export default function Page() {
  const [tab, setTab] = React.useState('home');
  return (
    <div>
      <Segmented options={['今日', '本周']} onChange={(value) => setTab(value)} />
      <Select options={[]} onChange={(value) => setTab(value)} />
      <Tabs items={[]} activeKey={tab} onChange={(key) => setTab(key)} />
      <Typography.Link href="https://example.com">查看全部</Typography.Link>
    </div>
  );
}
`;

    expect(findCanvasSourceIssues(source).map(issue => issue.type))
      .not.toContain('missing-handler');
  });

  test('blocks pointer style references without handlers', () => {
    const source = `
import React from 'react';

const styles = {
  actionCard: { cursor: 'pointer', padding: 12 },
};

export default function Page() {
  return <div style={styles.actionCard}>快捷入口</div>;
}
`;

    expect(findCanvasSourceIssues(source)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'missing-handler',
        elementName: 'div',
      }),
    ]));
  });
});
